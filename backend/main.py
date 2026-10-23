import os
import datetime
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, Depends, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from .config import PRODUCT_NAME, PRODUCT_TAGLINE, FOOD_SAFETY_RULES, IS_MOCK_ENVIRONMENT
from .database import engine, Base, get_db
from .models import Restaurant, NGO, Donation, PickupRequest, AgentRun, PickupProposal, AuditEvent
from .schemas import (
    RestaurantOut, NGOOut, DonationCreate, DonationOut,
    MatchingEvaluationResponse, PickupProposeRequest, PickupApprovalRequest,
    PickupAcceptRequest, PickupChangeLocationRequest, PickupRequestOut, PickupProposalOut, AuditEventOut,
    AgentRunOut, ScenarioRunResult, DashboardMetrics
)
from .mock_platform import MockPlatformService
from .graph import run_donation_workflow, resume_workflow_approval
from .scenarios import ScenarioManager
from .seed_data import seed_database
from .tools import tool_get_pickup_status

# Initialize database schema
Base.metadata.create_all(bind=engine)

# Auto-seed initial demo data
with next(get_db()) as db_session:
    seed_database(db_session)

app = FastAPI(
    title=f"{PRODUCT_NAME} Platform API",
    description="Operational API for surplus food donation matching, safety validation, human approval, and mock rescue execution.",
    version="1.0.0"
)

# CORS configuration for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Health & Config ---
@app.get("/api/health")
def get_health():
    return {
        "status": "healthy",
        "product": PRODUCT_NAME,
        "is_mock_environment": IS_MOCK_ENVIRONMENT,
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
    }

@app.get("/api/config")
def get_config():
    return {
        "product_name": PRODUCT_NAME,
        "tagline": PRODUCT_TAGLINE,
        "is_mock_environment": IS_MOCK_ENVIRONMENT,
        "food_safety_rules": FOOD_SAFETY_RULES
    }

# --- Operational Metrics ---
@app.get("/api/metrics", response_model=DashboardMetrics)
def get_metrics(db: Session = Depends(get_db)):
    total_donations = db.query(Donation).count()
    awaiting_match = db.query(Donation).filter(Donation.status == "AWAITING_MATCH").count()
    pending_approval = db.query(PickupRequest).filter(
        PickupRequest.status.in_(["PROPOSED", "RECONFIRMATION_REQUIRED"])
    ).count()
    pending_ngo_acceptance = db.query(PickupRequest).filter(
        PickupRequest.status == "APPROVED",
        PickupRequest.accepted_by_ngo == False
    ).count()
    collected_or_verified = db.query(PickupRequest).filter(
        PickupRequest.status.in_(["COLLECTED", "VERIFIED_COMPLETE"])
    ).count()
    active_ngos = db.query(NGO).filter(NGO.is_active == True).count()
    active_restaurants = db.query(Restaurant).filter(Restaurant.is_verified == True).count()
    total_agent_runs = db.query(AgentRun).count()

    return DashboardMetrics(
        total_donations=total_donations,
        awaiting_match=awaiting_match,
        pending_approval=pending_approval,
        pending_ngo_acceptance=pending_ngo_acceptance,
        collected_or_verified=collected_or_verified,
        active_ngos=active_ngos,
        active_restaurants=active_restaurants,
        total_agent_runs=total_agent_runs
    )

# --- Restaurants & NGOs ---
@app.get("/api/restaurants", response_model=List[RestaurantOut])
def get_restaurants(db: Session = Depends(get_db)):
    return MockPlatformService.list_restaurants(db)

@app.get("/api/ngos", response_model=List[NGOOut])
def get_ngos(db: Session = Depends(get_db)):
    ngos = MockPlatformService.list_ngos(db)
    result = []
    for n in ngos:
        out = NGOOut.from_orm(n)
        out.available_capacity = max(0, n.max_capacity_meals - n.current_load_meals)
        result.append(out)
    return result

# --- Donations ---
@app.get("/api/donations", response_model=List[DonationOut])
def get_donations(db: Session = Depends(get_db)):
    return MockPlatformService.list_donations(db)

@app.get("/api/donations/{donation_id}", response_model=DonationOut)
def get_donation(donation_id: str, db: Session = Depends(get_db)):
    donation = MockPlatformService.get_donation(db, donation_id)
    if not donation:
        raise HTTPException(status_code=404, detail=f"Donation '{donation_id}' not found.")
    return donation

@app.post("/api/donations", response_model=DonationOut)
def create_donation(donation_in: DonationCreate, db: Session = Depends(get_db)):
    return MockPlatformService.create_donation(db, donation_in)

# --- Matching & Agent Evaluation (LangGraph Orchestrated) ---
@app.post("/api/matching/evaluate")
def evaluate_matching(donation_id: str = Query(...), db: Session = Depends(get_db)):
    donation = MockPlatformService.get_donation(db, donation_id)
    if not donation:
        raise HTTPException(status_code=404, detail=f"Donation '{donation_id}' not found.")

    # Execute LangGraph 12-stage workflow through checkpointer
    graph_res = run_donation_workflow(
        donation_id=donation.id,
        scenario_id="LIVE_INTERACTIVE"
    )

    top = graph_res.get("selected_ngo")
    ranked = graph_res.get("ranked_candidates", [])
    alternatives = [c for c in ranked if not top or c.get("ngo_id") != top.get("ngo_id")]

    # Return structured evaluation payload
    return {
        "run_id": graph_res.get("run_id"),
        "donation_id": donation.id,
        "proposal_id": graph_res.get("proposal_id"),
        "pickup_request_id": graph_res.get("proposal_id"), # Provides target ID for approval gating
        "status": graph_res.get("status"),
        "food_safety_passed": graph_res.get("safety_outcome") == "eligible",
        "safety_evaluation": graph_res.get("safety_eval", {}),
        "recommended_ngo": top,
        "eligible_alternatives": alternatives,
        "explanation": graph_res.get("recommendation_explanation"),
        "is_llm": graph_res.get("is_llm_explanation", False),
        "trace": graph_res.get("trace", [])
    }

# --- Pickup Proposals ---
@app.get("/api/proposals", response_model=List[PickupProposalOut])
def list_proposals(db: Session = Depends(get_db)):
    return db.query(PickupProposal).order_by(PickupProposal.created_at.desc()).all()

@app.get("/api/proposals/{proposal_id}", response_model=PickupProposalOut)
def get_proposal(proposal_id: str, db: Session = Depends(get_db)):
    prop = db.query(PickupProposal).filter(PickupProposal.id == proposal_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail=f"Proposal '{proposal_id}' not found.")
    return prop

# --- Pickup Requests & Human Approval ---
@app.get("/api/pickups", response_model=List[PickupRequestOut])
def list_pickups(db: Session = Depends(get_db)):
    return db.query(PickupRequest).order_by(PickupRequest.created_at.desc()).all()

@app.get("/api/pickups/{pickup_id}", response_model=PickupRequestOut)
def get_pickup(pickup_id: str, db: Session = Depends(get_db)):
    pickup = db.query(PickupRequest).filter(PickupRequest.id == pickup_id).first()
    if not pickup:
        raise HTTPException(status_code=404, detail=f"Pickup '{pickup_id}' not found.")
    return pickup

@app.post("/api/pickups/propose", response_model=PickupRequestOut)
def propose_pickup(req: PickupProposeRequest, db: Session = Depends(get_db)):
    return MockPlatformService.propose_pickup(db, req)

@app.post("/api/pickups/{pickup_id}/approve", response_model=PickupRequestOut)
def approve_pickup(pickup_id: str, req: PickupApprovalRequest, db: Session = Depends(get_db)):
    # Check if this is a proposal ID (PROP-) or pickup request ID (REQ-)
    if pickup_id.startswith("PROP-"):
        proposal = db.query(PickupProposal).filter(PickupProposal.id == pickup_id).first()
        if not proposal:
            raise HTTPException(status_code=404, detail=f"Proposal '{pickup_id}' not found.")
        
        # Resume LangGraph checkpoint
        thread_id = proposal.thread_id or f"THREAD-{proposal.id}"
        resume_res = resume_workflow_approval(
            thread_id=thread_id,
            proposal_id=proposal.id,
            approved=True,
            operator_name=req.approved_by,
            approval_version=req.approval_version
        )
        if not resume_res or resume_res.get("error"):
            error_msg = resume_res.get("error") if resume_res else "Failed to resume workflow approval"
            raise HTTPException(status_code=400, detail=error_msg)

        # Retrieve the resulting created pickup request
        created_req = db.query(PickupRequest).filter(PickupRequest.donation_id == proposal.donation_id).first()
        if not created_req:
            raise HTTPException(status_code=500, detail="Pickup request was not created after approval resume.")
        return created_req

    return MockPlatformService.approve_pickup(db, pickup_id, req)

@app.post("/api/proposals/{proposal_id}/approve", response_model=PickupRequestOut)
def approve_proposal(proposal_id: str, req: PickupApprovalRequest, db: Session = Depends(get_db)):
    return approve_pickup(proposal_id, req, db)

@app.post("/api/pickups/{pickup_id}/accept", response_model=PickupRequestOut)
def accept_pickup(pickup_id: str, body: Optional[PickupAcceptRequest] = None, db: Session = Depends(get_db)):
    actor = body.accepted_by if body and body.accepted_by else "Driver David Morales (City Hope Rescue)"
    expected_ver = body.expected_version if body else None
    return MockPlatformService.accept_pickup_by_ngo(db, pickup_id, actor=actor, expected_version=expected_ver)

@app.get("/api/pickups/{pickup_id}/verify-status")
def verify_pickup_status(pickup_id: str, db: Session = Depends(get_db)):
    """
    Independent platform query tool:
    Simulates the agent querying the mock platform to verify live state.
    """
    res = tool_get_pickup_status(db, pickup_id)
    if not res.get("found"):
        raise HTTPException(status_code=404, detail=f"Pickup '{pickup_id}' not found on platform.")
    return {
        "verified": True,
        "query_timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "retrieved_state": res
    }

@app.post("/api/pickups/{pickup_id}/reject", response_model=PickupRequestOut)
def reject_pickup(pickup_id: str, body: Optional[Dict[str, Any]] = None, db: Session = Depends(get_db)):
    reason = (body or {}).get("reason", "Capacity or volunteer constraint")
    return MockPlatformService.reject_pickup_by_ngo(db, pickup_id, reason=reason)

@app.post("/api/pickups/{pickup_id}/change-location", response_model=PickupRequestOut)
def change_location(pickup_id: str, req: PickupChangeLocationRequest, db: Session = Depends(get_db)):
    return MockPlatformService.change_drop_off_location(db, pickup_id, req)

@app.post("/api/pickups/{pickup_id}/verify-completion")
def verify_pickup_completion(pickup_id: str, db: Session = Depends(get_db)):
    return MockPlatformService.mark_collected_and_verified(db, pickup_id)

# --- Audit Events & Transparency ---
@app.get("/api/audit-events", response_model=List[AuditEventOut])
def list_audit_events(db: Session = Depends(get_db)):
    return db.query(AuditEvent).order_by(AuditEvent.timestamp.desc()).all()


# --- Agent Runs & Trace Ledger ---
@app.get("/api/agent-runs", response_model=List[AgentRunOut])
def list_agent_runs(db: Session = Depends(get_db)):
    return db.query(AgentRun).order_by(AgentRun.started_at.desc()).all()

@app.get("/api/agent-runs/{run_id}", response_model=AgentRunOut)
def get_agent_run(run_id: str, db: Session = Depends(get_db)):
    run = db.query(AgentRun).filter(AgentRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail=f"Agent Run '{run_id}' not found.")
    return run

# --- Official Test Scenarios ---
@app.post("/api/test-scenarios/{scenario_id}/run", response_model=ScenarioRunResult)
def run_scenario(scenario_id: str, db: Session = Depends(get_db)):
    sid = scenario_id.upper()
    if sid == "TC1":
        return ScenarioManager.run_tc1(db)
    elif sid == "TC2":
        return ScenarioManager.run_tc2(db)
    elif sid == "TC3":
        return ScenarioManager.run_tc3(db)
    elif sid == "TC4":
        return ScenarioManager.run_tc4(db)
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown test scenario '{scenario_id}'. Must be one of TC1, TC2, TC3, TC4."
        )

@app.post("/api/test-scenarios/run-all", response_model=List[ScenarioRunResult])
def run_all_scenarios(db: Session = Depends(get_db)):
    return ScenarioManager.run_all(db)

# --- Reset Demo Data ---
@app.post("/api/demo/reset")
def reset_demo_data(db: Session = Depends(get_db)):
    # Drop and recreate all tables for a clean slate
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    seed_database(db)
    return {"message": "Demo database successfully reset with fresh seed records."}

# --- Static File Serving & Production SPA Fallback ---
frontend_dist = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend", "dist")
if os.path.exists(frontend_dist):
    assets_dir = os.path.join(frontend_dist, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith("api"):
            raise HTTPException(status_code=404, detail="API endpoint not found")
        file_path = os.path.join(frontend_dist, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        index_file = os.path.join(frontend_dist, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
        raise HTTPException(status_code=404, detail="Page not found")
