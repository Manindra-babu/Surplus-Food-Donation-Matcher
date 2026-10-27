import os
import sqlite3
import datetime
import uuid
import logging
from typing import Dict, Any, List, Optional, TypedDict
from pathlib import Path

from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.sqlite import SqliteSaver

from .database import SessionLocal, DB_FILE
from .models import AgentRun, Donation, PickupProposal, PickupRequest, AuditEvent
from .llm_adapter import llm_adapter
from .tools import (
    tool_get_donation_details,
    tool_search_eligible_ngos,
    tool_validate_food_safety,
    tool_rank_ngo_candidates,
    tool_create_pickup_proposal,
    tool_get_proposal_details,
    tool_record_human_decision,
    tool_create_pickup_request,
    tool_get_pickup_status,
    tool_reconfirm_dropoff_location,
    tool_record_verification,
    tool_write_audit_event
)

logger = logging.getLogger("foodbridge_graph")

# Persistent checkpointer database path
CHECKPOINT_DB_FILE = Path(__file__).resolve().parent / "foodbridge_checkpoints.db"

# --- Typed LangGraph Agent State ---
class FoodBridgeAgentState(TypedDict):
    run_id: str
    scenario_id: Optional[str]
    donation_id: Optional[str]
    raw_input: Optional[str]
    structured_request: Dict[str, Any]
    missing_information: List[str]
    retrieved_donation: Optional[Dict[str, Any]]
    retrieved_ngos: List[Dict[str, Any]]
    safety_eval: Dict[str, Any]
    safety_outcome: str # eligible, ineligible, manual_review
    candidate_evaluations: List[Dict[str, Any]]
    ranked_candidates: List[Dict[str, Any]]
    selected_ngo: Optional[Dict[str, Any]]
    recommendation_explanation: Optional[str]
    is_llm_explanation: bool
    proposal_id: Optional[str]
    proposal_version: int
    human_approved: Optional[bool]
    approved_by: Optional[str]
    pickup_request_id: Optional[str]
    execution_response: Optional[Dict[str, Any]]
    verified_state: Optional[Dict[str, Any]]
    trace: List[Dict[str, Any]]
    current_stage: str
    status: str
    final_outcome: str
    errors: List[str]

def _append_trace(state: FoodBridgeAgentState, step: int, stage: str, status: str, message: str, data: Optional[Dict[str, Any]] = None):
    step_entry = {
        "step_number": step,
        "stage": stage,
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "status": status,
        "message": message,
        "data": data or {}
    }
    state["trace"].append(step_entry)
    state["current_stage"] = stage

# ============================================================================
# 12 LANGGRAPH WORKFLOW NODES
# ============================================================================

def node_parse_donation_request(state: FoodBridgeAgentState) -> FoodBridgeAgentState:
    """Node 1: Interprets natural-language input or validates pre-structured request."""
    raw = state.get("raw_input")
    structured = state.get("structured_request") or {}

    if raw and not structured.get("food_name"):
        parsed, is_llm = llm_adapter.parse_natural_language_donation(raw)
        state["structured_request"] = parsed
        _append_trace(
            state, 1, "PARSE_DONATION_REQUEST", "SUCCESS",
            f"Interpreted natural language donation via {'LLM' if is_llm else 'Deterministic Parser'}.",
            {"parsed": parsed, "is_llm": is_llm}
        )
    else:
        _append_trace(
            state, 1, "PARSE_DONATION_REQUEST", "SUCCESS",
            f"Using structured donation request (ID: {state.get('donation_id')}).",
            {"donation_id": state.get("donation_id")}
        )
    return state

def node_validate_request(state: FoodBridgeAgentState) -> FoodBridgeAgentState:
    """Node 2: Deterministic backend validation of required fields and bounds."""
    req = state.get("structured_request") or {}
    missing = []
    
    # Check fields if provided directly or verify donation exists
    if not state.get("donation_id") and not req.get("food_name"):
        missing.append("food_name")
    
    state["missing_information"] = missing
    if missing:
        state["status"] = "NEEDS_CLARIFICATION"
        state["final_outcome"] = "needs_clarification"
        state["errors"].append(f"Missing mandatory fields: {', '.join(missing)}")
        _append_trace(state, 2, "VALIDATE_REQUEST", "FAILED", f"Validation blocked: missing {missing}", {"missing": missing})
    else:
        _append_trace(state, 2, "VALIDATE_REQUEST", "SUCCESS", "Request schema validated successfully.")
    
    return state

def node_retrieve_donation_and_ngo_data(state: FoodBridgeAgentState) -> FoodBridgeAgentState:
    """Node 3: Calls registered tools to retrieve persistent records from mock platform."""
    db = SessionLocal()
    try:
        donation_id = state.get("donation_id")
        if donation_id and not (state.get("structured_request") and state["structured_request"].get("food_name")):
            don_data = tool_get_donation_details(db, donation_id)
            if don_data.get("found"):
                state["retrieved_donation"] = don_data
                state["structured_request"] = {
                    "food_name": don_data["food_name"],
                    "food_type": don_data["food_type"],
                    "quantity": don_data["quantity"],
                    "unit": don_data["unit"],
                    "prepared_at": don_data["prepared_at"],
                    "pickup_deadline": don_data["pickup_deadline"],
                    "storage_temp_celsius": don_data["storage_temp_celsius"],
                    "packaging_sealed": don_data["packaging_sealed"],
                    "pickup_address": don_data["pickup_address"]
                }
        
        # Retrieve candidate NGOs
        food_type = state["structured_request"].get("food_type", "hot_prepared_meals")
        quantity = state["structured_request"].get("quantity", 1)
        ngos = tool_search_eligible_ngos(db, food_type=food_type, min_capacity=quantity)
        state["retrieved_ngos"] = ngos

        _append_trace(
            state, 3, "RETRIEVE_DONATION_AND_NGO_DATA", "SUCCESS",
            f"Retrieved persistent donation data and {len(ngos)} candidate NGOs with compatible categories.",
            {"candidate_ngos_count": len(ngos), "ngo_ids": [n["id"] for n in ngos]}
        )
    finally:
        db.close()

    return state

def node_validate_food_safety(state: FoodBridgeAgentState) -> FoodBridgeAgentState:
    """Node 4: Deterministic Python validation under FDA Food Code §3-501.19."""
    req = state["structured_request"]
    
    prep_at_str = req.get("prepared_at")
    deadline_str = req.get("pickup_deadline")
    
    prep_at = datetime.datetime.fromisoformat(prep_at_str) if isinstance(prep_at_str, str) else prep_at_str
    deadline = datetime.datetime.fromisoformat(deadline_str) if isinstance(deadline_str, str) else deadline_str

    safety = tool_validate_food_safety(
        prepared_at=prep_at,
        pickup_deadline=deadline,
        storage_temp_celsius=float(req.get("storage_temp_celsius", 20.0)),
        packaging_sealed=bool(req.get("packaging_sealed", True)),
        food_type=req.get("food_type", "hot_prepared_meals")
    )
    state["safety_eval"] = safety

    if safety["passed"]:
        state["safety_outcome"] = "eligible"
        _append_trace(state, 4, "VALIDATE_FOOD_SAFETY", "SUCCESS", "Food donation satisfies temperature holding and elapsed-time public health limits.", safety)
    else:
        state["safety_outcome"] = "ineligible"
        state["status"] = "SAFETY_REJECTED"
        state["final_outcome"] = "safety_blocked"
        expl, _ = llm_adapter.generate_rejection_explanation(req.get("food_name", "Donation"), safety)
        state["recommendation_explanation"] = expl
        _append_trace(state, 4, "VALIDATE_FOOD_SAFETY", "FAILED", safety["reason"], safety)
        # Update donation record in database
        don_id = state.get("donation_id")
        if don_id:
            db = SessionLocal()
            try:
                don = db.query(Donation).filter(Donation.id == don_id).first()
                if don:
                    don.status = "REJECTED_SAFETY"
                    db.commit()
            finally:
                db.close()

    return state

def node_evaluate_capacity_and_feasibility(state: FoodBridgeAgentState) -> FoodBridgeAgentState:
    """Node 5: Evaluates hard constraints (capacity, radius, service window) on candidate NGOs."""
    db = SessionLocal()
    try:
        req = state["structured_request"]
        prep_at = datetime.datetime.fromisoformat(req["prepared_at"]) if isinstance(req["prepared_at"], str) else req["prepared_at"]
        deadline = datetime.datetime.fromisoformat(req["pickup_deadline"]) if isinstance(req["pickup_deadline"], str) else req["pickup_deadline"]

        ranking_res = tool_rank_ngo_candidates(
            db=db,
            donation_quantity=req["quantity"],
            donation_food_type=req["food_type"],
            pickup_start=prep_at,
            pickup_end=deadline
        )
        state["candidate_evaluations"] = ranking_res["ranked_candidates"]
        state["ranked_candidates"] = ranking_res["ranked_candidates"]
        
        _append_trace(
            state, 5, "EVALUATE_CAPACITY_AND_FEASIBILITY", "SUCCESS",
            f"Hard constraints evaluated: {ranking_res['eligible_count']} eligible, {ranking_res['ineligible_count']} excluded.",
            {"eligible_count": ranking_res["eligible_count"], "ineligible_count": ranking_res["ineligible_count"]}
        )
    finally:
        db.close()

    return state

def node_rank_candidates(state: FoodBridgeAgentState) -> FoodBridgeAgentState:
    """Node 6: Multi-factor ranking of eligible candidates and LLM explanation synthesis."""
    eligible = state.get("ranked_candidates", [])
    if not eligible:
        state["status"] = "NO_ELIGIBLE_NGO"
        state["final_outcome"] = "no_eligible_ngo"
        _append_trace(state, 6, "RANK_CANDIDATES", "WARNING", "No NGO candidate satisfied capacity and service radius constraints.")
        return state

    top = eligible[0]
    state["selected_ngo"] = top

    # LLM operational explanation
    explanation, is_llm = llm_adapter.generate_match_explanation(
        donation=state["structured_request"],
        candidate=top,
        safety_eval=state["safety_eval"]
    )
    state["recommendation_explanation"] = explanation
    state["is_llm_explanation"] = is_llm

    _append_trace(
        state, 6, "RANK_CANDIDATES", "SUCCESS",
        f"Top candidate selected: {top['ngo_name']} (score: {top['score']}/100). Explanation generated via {'LLM' if is_llm else 'Deterministic Rules'}.",
        {"top_ngo": top["ngo_name"], "score": top["score"], "is_llm": is_llm}
    )
    return state

def node_prepare_pickup_proposal(state: FoodBridgeAgentState) -> FoodBridgeAgentState:
    """Node 7: Persists a pickup proposal. Creating a proposal DOES NOT create a pickup request."""
    db = SessionLocal()
    try:
        donation_id = state.get("donation_id")
        selected_ngo = state.get("selected_ngo")
        if not donation_id or not selected_ngo:
            state["status"] = "FAILED"
            return state

        proposal_res = tool_create_pickup_proposal(
            db=db,
            donation_id=donation_id,
            ngo_id=selected_ngo["ngo_id"],
            thread_id=state.get("run_id")
        )
        if not proposal_res or "proposal_id" not in proposal_res:
            state["status"] = "FAILED"
            state["final_outcome"] = "proposal_creation_failed"
            _append_trace(
                state, 7, "PREPARE_PICKUP_PROPOSAL", "FAILED",
                proposal_res.get("error", "Failed to create pickup proposal") if proposal_res else "No response"
            )
            return state

        state["proposal_id"] = proposal_res["proposal_id"]
        state["proposal_version"] = proposal_res.get("proposal_version", 1)

        _append_trace(
            state, 7, "PREPARE_PICKUP_PROPOSAL", "SUCCESS",
            f"Persisted pickup proposal {proposal_res['proposal_id']} (version {state['proposal_version']}).",
            proposal_res
        )
    finally:
        db.close()

    return state

def node_await_human_approval(state: FoodBridgeAgentState) -> FoodBridgeAgentState:
    """Node 8: Checkpoint node. Pauses graph execution pending explicit human operator review."""
    state["status"] = "REQUIRES_APPROVAL"
    state["final_outcome"] = "awaiting_approval"
    
    _append_trace(
        state, 8, "AWAIT_HUMAN_APPROVAL", "PENDING_APPROVAL",
        f"Workflow paused at Proposal {state.get('proposal_id')}. Awaiting mandatory human operator sign-off.",
        {"proposal_id": state.get("proposal_id"), "version": state.get("proposal_version")}
    )
    return state

def node_execute_approved_pickup(state: FoodBridgeAgentState) -> FoodBridgeAgentState:
    """Node 9: Resumes after human approval. Verifies proposal version and executes dispatch via mock platform."""
    if not state.get("human_approved"):
        state["status"] = "REJECTED_BY_HUMAN"
        state["final_outcome"] = "rejected_by_human"
        _append_trace(state, 9, "EXECUTE_APPROVED_PICKUP", "BLOCKED", "Execution blocked: Human approval was declined or missing.")
        return state

    db = SessionLocal()
    try:
        # Re-check proposal and version
        proposal_id = state.get("proposal_id")
        prop_details = tool_get_proposal_details(db, proposal_id)
        if not prop_details.get("found"):
            state["status"] = "EXECUTION_FAILED"
            state["final_outcome"] = "execution_failed"
            return state

        if prop_details.get("approval_version") != state.get("proposal_version"):
            state["status"] = "REQUIRES_RECONFIRMATION"
            state["final_outcome"] = "requires_reconfirmation"
            _append_trace(state, 9, "EXECUTE_APPROVED_PICKUP", "BLOCKED", "Approval version mismatch. Reconfirmation required.")
            return state

        # Call mock platform tool to create pickup request
        idemp_key = f"IDEMP-GRAPH-{proposal_id}-v{state.get('proposal_version')}"
        exec_res = tool_create_pickup_request(db, proposal_id=proposal_id, idempotency_key=idemp_key)
        state["execution_response"] = exec_res

        if exec_res.get("success"):
            state["pickup_request_id"] = exec_res["pickup_id"]
            state["status"] = "APPROVED" # Mock platform created request in APPROVED state awaiting NGO
            _append_trace(
                state, 9, "EXECUTE_APPROVED_PICKUP", "SUCCESS",
                f"Approved action executed on mock platform API. Request ID: {exec_res['pickup_id']}.",
                exec_res
            )
        else:
            state["status"] = "EXECUTION_FAILED"
            state["final_outcome"] = "execution_failed"
            _append_trace(state, 9, "EXECUTE_APPROVED_PICKUP", "FAILED", exec_res.get("error", "Execution failed"))
    finally:
        db.close()

    return state

def node_verify_pickup_state(state: FoodBridgeAgentState) -> FoodBridgeAgentState:
    """Node 10: Independent query against mock platform database to verify actual state."""
    pickup_id = state.get("pickup_request_id")
    if not pickup_id:
        return state

    db = SessionLocal()
    try:
        actual_state = tool_get_pickup_status(db, pickup_id)
        state["verified_state"] = actual_state

        if not actual_state.get("found"):
            state["status"] = "VERIFICATION_FAILED"
            state["final_outcome"] = "verification_failed"
            _append_trace(state, 10, "VERIFY_PICKUP_STATE", "FAILED", "Independent query could not verify pickup request.")
            return state

        # Check NGO acceptance state
        is_accepted = actual_state.get("accepted_by_ngo", False)
        if is_accepted:
            state["status"] = "SUCCESS"
            state["final_outcome"] = "verified_accepted"
            _append_trace(state, 10, "VERIFY_PICKUP_STATE", "SUCCESS", "Independently verified: NGO confirmed acceptance.", actual_state)
        else:
            state["status"] = "AWAITING_NGO_ACCEPTANCE"
            state["final_outcome"] = "awaiting_ngo_acceptance"
            _append_trace(
                state, 10, "VERIFY_PICKUP_STATE", "WARNING",
                "Independently verified: Request is registered and awaiting NGO acceptance. Strictly not reported as collected.",
                actual_state
            )
    finally:
        db.close()

    return state

def node_record_evidence(state: FoodBridgeAgentState) -> FoodBridgeAgentState:
    """Node 11: Persists complete execution trace, node outcomes, and audit events."""
    db = SessionLocal()
    try:
        run_id = state.get("run_id")
        
        # Record audit event
        tool_write_audit_event(
            db=db,
            run_id=run_id,
            thread_id=run_id,
            event_type=f"STAGE_{state.get('current_stage')}",
            source="LANGGRAPH_COORDINATOR",
            details={
                "status": state.get("status"),
                "final_outcome": state.get("final_outcome"),
                "proposal_id": state.get("proposal_id"),
                "pickup_request_id": state.get("pickup_request_id")
            }
        )

        # Update or create AgentRun record
        agent_run = db.query(AgentRun).filter(AgentRun.id == run_id).first()
        if not agent_run:
            agent_run = AgentRun(
                id=run_id,
                thread_id=run_id,
                scenario_id=state.get("scenario_id"),
                donation_id=state.get("donation_id"),
                proposal_id=state.get("proposal_id"),
                pickup_request_id=state.get("pickup_request_id"),
                current_stage=state.get("current_stage", "UNKNOWN"),
                status=state.get("status", "RUNNING"),
                started_at=datetime.datetime.utcnow(),
                execution_trace=state.get("trace", [])
            )
            db.add(agent_run)
        
        agent_run.current_stage = state.get("current_stage", agent_run.current_stage)
        agent_run.status = state.get("status", agent_run.status)
        agent_run.input_snapshot = state.get("structured_request")
        agent_run.retrieved_ngos = state.get("retrieved_ngos")
        agent_run.matching_constraints = {
            "food_safety": state.get("safety_eval"),
            "candidate_evaluations": state.get("candidate_evaluations")
        }
        agent_run.decision_explanation = {
            "recommendation": state.get("recommendation_explanation"),
            "is_llm": state.get("is_llm_explanation", False)
        }
        agent_run.execution_trace = state.get("trace", [])
        agent_run.verified_state = state.get("verified_state")
        agent_run.is_llm_powered = state.get("is_llm_explanation", False)
        agent_run.fallback_used = not state.get("is_llm_explanation", False)
        agent_run.completed_at = datetime.datetime.utcnow()
        
        db.commit()

        _append_trace(state, 11, "RECORD_EVIDENCE", "SUCCESS", f"Recorded immutable audit trail in platform ledger for {run_id}.")
    finally:
        db.close()

    return state

def node_finalize_agent_run(state: FoodBridgeAgentState) -> FoodBridgeAgentState:
    """Node 12: Produces verified final structured result."""
    _append_trace(
        state, 12, "FINALIZE_AGENT_RUN", "SUCCESS",
        f"Workflow finalized with outcome: {state.get('final_outcome', 'unknown')}.",
        {"outcome": state.get("final_outcome")}
    )
    return state

# ============================================================================
# CONDITIONAL ROUTING FUNCTIONS
# ============================================================================

def route_after_validation(state: FoodBridgeAgentState) -> str:
    if state.get("missing_information"):
        return "node_record_evidence"
    return "node_retrieve_donation_and_ngo_data"

def route_after_safety(state: FoodBridgeAgentState) -> str:
    if state.get("safety_outcome") != "eligible":
        return "node_record_evidence"
    return "node_evaluate_capacity_and_feasibility"

def route_after_ranking(state: FoodBridgeAgentState) -> str:
    if not state.get("ranked_candidates"):
        return "node_record_evidence"
    return "node_prepare_pickup_proposal"

# ============================================================================
# LANGGRAPH BUILDER & PERSISTENT CHECKPOINTER
# ============================================================================

def create_foodbridge_graph():
    builder = StateGraph(FoodBridgeAgentState)

    # Add all 12 nodes
    builder.add_node("node_parse_donation_request", node_parse_donation_request)
    builder.add_node("node_validate_request", node_validate_request)
    builder.add_node("node_retrieve_donation_and_ngo_data", node_retrieve_donation_and_ngo_data)
    builder.add_node("node_validate_food_safety", node_validate_food_safety)
    builder.add_node("node_evaluate_capacity_and_feasibility", node_evaluate_capacity_and_feasibility)
    builder.add_node("node_rank_candidates", node_rank_candidates)
    builder.add_node("node_prepare_pickup_proposal", node_prepare_pickup_proposal)
    builder.add_node("node_await_human_approval", node_await_human_approval)
    builder.add_node("node_execute_approved_pickup", node_execute_approved_pickup)
    builder.add_node("node_verify_pickup_state", node_verify_pickup_state)
    builder.add_node("node_record_evidence", node_record_evidence)
    builder.add_node("node_finalize_agent_run", node_finalize_agent_run)

    # Edges & Transitions
    builder.add_edge(START, "node_parse_donation_request")
    builder.add_edge("node_parse_donation_request", "node_validate_request")
    builder.add_conditional_edges("node_validate_request", route_after_validation)
    builder.add_edge("node_retrieve_donation_and_ngo_data", "node_validate_food_safety")
    builder.add_conditional_edges("node_validate_food_safety", route_after_safety)
    builder.add_edge("node_evaluate_capacity_and_feasibility", "node_rank_candidates")
    builder.add_conditional_edges("node_rank_candidates", route_after_ranking)
    builder.add_edge("node_prepare_pickup_proposal", "node_await_human_approval")
    builder.add_edge("node_await_human_approval", "node_execute_approved_pickup")
    builder.add_edge("node_execute_approved_pickup", "node_verify_pickup_state")
    builder.add_edge("node_verify_pickup_state", "node_record_evidence")
    builder.add_edge("node_record_evidence", "node_finalize_agent_run")
    builder.add_edge("node_finalize_agent_run", END)

    # Persistent SQLite Checkpointer for restart recovery
    conn = sqlite3.connect(str(CHECKPOINT_DB_FILE), check_same_thread=False)
    checkpointer = SqliteSaver(conn)
    checkpointer.setup()

    # Compile with human-in-the-loop interruption checkpoint
    compiled_graph = builder.compile(
        checkpointer=checkpointer,
        interrupt_before=["node_execute_approved_pickup"]
    )
    return compiled_graph

# Global compiled graph instance
foodbridge_graph = create_foodbridge_graph()

def run_donation_workflow(
    donation_id: Optional[str] = None,
    scenario_id: Optional[str] = None,
    raw_input: Optional[str] = None,
    structured_request: Optional[Dict[str, Any]] = None,
    run_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Initiates the 12-stage LangGraph food rescue coordination workflow.
    Executes stages 1-8 and halts at Node 8 (await_human_approval) via persistent checkpoint.
    """
    active_run_id = run_id or f"RUN-{uuid.uuid4().hex[:8].upper()}"
    config = {"configurable": {"thread_id": active_run_id}}

    initial_state: FoodBridgeAgentState = {
        "run_id": active_run_id,
        "scenario_id": scenario_id,
        "donation_id": donation_id,
        "raw_input": raw_input,
        "structured_request": structured_request or {},
        "missing_information": [],
        "retrieved_donation": None,
        "retrieved_ngos": [],
        "safety_eval": {},
        "safety_outcome": "pending",
        "candidate_evaluations": [],
        "ranked_candidates": [],
        "selected_ngo": None,
        "recommendation_explanation": None,
        "is_llm_explanation": False,
        "proposal_id": None,
        "proposal_version": 1,
        "human_approved": None,
        "approved_by": None,
        "pickup_request_id": None,
        "execution_response": None,
        "verified_state": None,
        "trace": [],
        "current_stage": "INIT",
        "status": "RUNNING",
        "final_outcome": "running",
        "errors": []
    }

    result = foodbridge_graph.invoke(initial_state, config=config)
    return result

def resume_workflow_approval(
    thread_id: str,
    proposal_id: str,
    approved: bool,
    operator_name: str,
    approval_version: int = 1
) -> Dict[str, Any]:
    """
    Resumes a paused LangGraph workflow from Node 8 checkpoint after human operator decision.
    Executes Node 9 (execute_approved_pickup) -> Node 10 (verify_pickup_state) -> Node 11 -> Node 12.
    """
    db = SessionLocal()
    try:
        # 1. Deterministic tool verification and audit record
        decision_res = tool_record_human_decision(
            db=db,
            proposal_id=proposal_id,
            approved=approved,
            operator_name=operator_name,
            approval_version=approval_version
        )
        if not decision_res.get("success"):
            return {"success": False, "error": decision_res.get("error")}
    finally:
        db.close()

    # 2. Update LangGraph checkpointed state
    config = {"configurable": {"thread_id": thread_id}}
    foodbridge_graph.update_state(
        config,
        {
            "human_approved": approved,
            "approved_by": operator_name,
            "proposal_version": approval_version
        }
    )

    # 3. Resume graph from interrupt point
    result = foodbridge_graph.invoke(None, config=config)
    return result

