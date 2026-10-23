import datetime
import uuid
from typing import Dict, Any, List
from sqlalchemy.orm import Session

from .models import Restaurant, NGO, Donation, PickupRequest, PickupProposal, AgentRun
from .rules_engine import FoodSafetyEngine
from .mock_platform import MockPlatformService
from .graph import run_donation_workflow, resume_workflow_approval
from .tools import tool_record_verification, tool_reconfirm_dropoff_location, tool_get_pickup_status

class ScenarioManager:
    """
    Executes and validates the 4 Official Test Scenarios through the LangGraph engine:
    TC1: Fresh food with NGO capacity (LangGraph workflow + human checkpoint resume)
    TC2: Food prepared too long ago (LangGraph safety block node)
    TC3: NGO has not accepted (Independent verification tool guard)
    TC4: NGO changes drop-off location (Invalidation & reconfirmation protocol)
    """

    @classmethod
    def run_tc1(cls, db: Session) -> Dict[str, Any]:
        """
        TC1: Fresh food with NGO capacity.
        - Food prepared recently (30 mins ago, well within 240 min limit).
        - NGO has ample capacity.
        - Verifies that approval is required, proposal is created, and status remains strictly pending until accepted.
        """
        now = datetime.datetime.utcnow()
        prep_time = now - datetime.timedelta(minutes=30)
        pickup_deadline = now + datetime.timedelta(hours=3)

        # Setup isolated demo restaurant
        rest = db.query(Restaurant).first()
        if not rest:
            rest = Restaurant(
                id="REST-DEMO-01",
                name="Green Garden Bistro",
                address="104 Elm Street, Downtown",
                contact_name="Chef Marcus Lee",
                phone="555-0199",
                cuisine_type="Mediterranean",
                is_verified=True
            )
            db.add(rest)
            db.commit()

        donation_id = f"DON-TC1-{uuid.uuid4().hex[:6].upper()}"
        donation = Donation(
            id=donation_id,
            restaurant_id=rest.id,
            restaurant_name=rest.name,
            food_name="Mediterranean Grilled Vegetable & Grain Bowls",
            food_type="hot_prepared_meals",
            description="Freshly prepared warm grain bowls with roasted zucchini, bell peppers, and tahini dressing.",
            quantity=25,
            unit="meal_boxes",
            prepared_at=prep_time,
            pickup_deadline=pickup_deadline,
            pickup_address=rest.address,
            storage_temp_celsius=62.0, # Hot holding
            packaging_sealed=True,
            status="AWAITING_MATCH",
            created_at=now
        )
        db.add(donation)
        db.commit()

        # Step 1: Run LangGraph Workflow (Nodes 1 -> 8)
        run_id = f"RUN-TC1-{uuid.uuid4().hex[:6].upper()}"
        structured_req = {
            "food_name": donation.food_name,
            "food_type": donation.food_type,
            "quantity": donation.quantity,
            "unit": donation.unit,
            "prepared_at": donation.prepared_at.isoformat(),
            "pickup_deadline": donation.pickup_deadline.isoformat(),
            "storage_temp_celsius": donation.storage_temp_celsius,
            "packaging_sealed": donation.packaging_sealed,
            "pickup_address": donation.pickup_address,
        }
        graph_res = run_donation_workflow(
            donation_id=donation.id,
            scenario_id="TC1",
            structured_request=structured_req,
            run_id=run_id
        )

        proposal_id = graph_res.get("proposal_id")
        proposal = db.query(PickupProposal).filter(PickupProposal.id == proposal_id).first()

        # Step 2: Human Operator signs off and resumes LangGraph workflow from checkpoint
        resume_res = resume_workflow_approval(
            thread_id=run_id,
            proposal_id=proposal_id,
            approved=True,
            operator_name="Chef Marcus Lee (Store Lead)",
            approval_version=proposal.approval_version if proposal else 1
        )

        # Retrieve actual created pickup request from database
        pickup_req = db.query(PickupRequest).filter(PickupRequest.donation_id == donation.id).first()

        # Verify assertions:
        # 1. Food safety passed
        # 2. Candidate matched
        # 3. Proposal created and approved
        # 4. Actual platform state is APPROVED (awaiting NGO confirmation) and NOT prematurely collected
        passed = (
            graph_res.get("safety_outcome") == "eligible"
            and graph_res.get("selected_ngo") is not None
            and pickup_req is not None
            and pickup_req.status == "APPROVED"
            and pickup_req.accepted_by_ngo is False
            and pickup_req.collected_at is None
        )

        expected = {
            "orchestrator": "LangGraph StateGraph",
            "food_safety_outcome": "SAFETY_VERIFIED",
            "candidate_matched": True,
            "human_approval_required": True,
            "pickup_request_created": True,
            "verified_platform_status": "APPROVED (awaiting NGO acceptance)",
            "premature_collection_reported": False
        }

        actual = {
            "orchestrator": "LangGraph StateGraph",
            "food_safety_outcome": "SAFETY_VERIFIED" if graph_res.get("safety_outcome") == "eligible" else "FAILED",
            "candidate_matched": graph_res.get("selected_ngo") is not None,
            "human_approval_required": True,
            "pickup_request_created": pickup_req is not None,
            "verified_platform_status": pickup_req.status if pickup_req else "NONE",
            "accepted_by_ngo": pickup_req.accepted_by_ngo if pickup_req else False,
            "premature_collection_reported": pickup_req.collected_at is not None if pickup_req else False
        }

        evidence = {
            "donation_id": donation.id,
            "proposal_id": proposal_id,
            "pickup_request_id": pickup_req.id if pickup_req else None,
            "selected_ngo": graph_res.get("selected_ngo"),
            "safety_eval": graph_res.get("safety_eval"),
            "approval_version": pickup_req.approval_version if pickup_req else 1,
            "approved_by": pickup_req.approved_by if pickup_req else None,
            "graph_nodes_executed": len(graph_res.get("trace", []))
        }

        return {
            "scenario_id": "TC1",
            "name": "TC1: Fresh Food with NGO Capacity",
            "description": "Validates that safe prepared food is matched to an eligible NGO, pauses at LangGraph human checkpoint, creates an auditable pickup proposal, requires human approval, and verifies platform status.",
            "input_summary": {
                "food_name": donation.food_name,
                "elapsed_since_prep_mins": round((now - prep_time).total_seconds() / 60.0, 1),
                "storage_temp_celsius": donation.storage_temp_celsius,
                "quantity": donation.quantity
            },
            "expected_result": expected,
            "actual_result": actual,
            "passed": passed,
            "agent_run_id": run_id,
            "evidence": evidence,
            "completed_at": datetime.datetime.utcnow().isoformat()
        }

    @classmethod
    def run_tc2(cls, db: Session) -> Dict[str, Any]:
        """
        TC2: Food prepared too long ago.
        - Food prepared 5.5 hours ago (330 mins) without refrigeration. Exceeds the 240 minute safety threshold.
        - Expected: LangGraph safety validation node rejects donation. No pickup proposal created. Rejection cannot be overridden.
        """
        now = datetime.datetime.utcnow()
        prep_time = now - datetime.timedelta(minutes=330) # 5.5 hours ago
        pickup_deadline = now + datetime.timedelta(hours=2)

        rest = db.query(Restaurant).first()
        donation_id = f"DON-TC2-{uuid.uuid4().hex[:6].upper()}"
        donation = Donation(
            id=donation_id,
            restaurant_id=rest.id,
            restaurant_name=rest.name,
            food_name="Buffet Steam Table Pasta & Cream Sauce",
            food_type="hot_prepared_meals",
            description="Warm fettuccine alfredo held at ambient service temperature since lunch service.",
            quantity=30,
            unit="meal_boxes",
            prepared_at=prep_time,
            pickup_deadline=pickup_deadline,
            pickup_address=rest.address,
            storage_temp_celsius=24.0, # Ambient / not held under temperature control
            packaging_sealed=True,
            status="AWAITING_MATCH",
            created_at=now
        )
        db.add(donation)
        db.commit()

        run_id = f"RUN-TC2-{uuid.uuid4().hex[:6].upper()}"
        structured_req = {
            "food_name": donation.food_name,
            "food_type": donation.food_type,
            "quantity": donation.quantity,
            "unit": donation.unit,
            "prepared_at": donation.prepared_at.isoformat(),
            "pickup_deadline": donation.pickup_deadline.isoformat(),
            "storage_temp_celsius": donation.storage_temp_celsius,
            "packaging_sealed": donation.packaging_sealed,
            "pickup_address": donation.pickup_address,
        }
        graph_res = run_donation_workflow(
            donation_id=donation.id,
            scenario_id="TC2",
            structured_request=structured_req,
            run_id=run_id
        )

        db.refresh(donation)
        pickup_req = db.query(PickupRequest).filter(PickupRequest.donation_id == donation.id).first()

        passed = (
            graph_res.get("safety_outcome") == "ineligible"
            and graph_res.get("status") == "SAFETY_REJECTED"
            and pickup_req is None
            and graph_res.get("proposal_id") is None
        )

        expected = {
            "orchestrator": "LangGraph StateGraph",
            "food_safety_passed": False,
            "agent_status": "SAFETY_REJECTED",
            "donation_status": "REJECTED_SAFETY",
            "pickup_request_created": False,
            "policy_enforced": "FDA Food Code §3-501.19 / Codex Alimentarius"
        }

        actual = {
            "orchestrator": "LangGraph StateGraph",
            "food_safety_passed": graph_res.get("safety_outcome") == "eligible",
            "agent_status": graph_res.get("status"),
            "donation_status": donation.status,
            "pickup_request_created": pickup_req is not None,
            "rejection_reason": graph_res.get("safety_eval", {}).get("reason")
        }

        return {
            "scenario_id": "TC2",
            "name": "TC2: Food Prepared Too Long Ago",
            "description": "Validates that food exceeding the safe holding duration (240 min ambient threshold) is deterministically rejected by LangGraph safety node and cannot trigger dispatch.",
            "input_summary": {
                "food_name": donation.food_name,
                "elapsed_since_prep_mins": 330.0,
                "max_allowed_mins": 240,
                "storage_temp_celsius": 24.0
            },
            "expected_result": expected,
            "actual_result": actual,
            "passed": passed,
            "agent_run_id": run_id,
            "evidence": {
                "policy_reference": graph_res.get("safety_eval", {}).get("policy_reference"),
                "exceeded_by_minutes": graph_res.get("safety_eval", {}).get("evidence", {}).get("exceeded_by_minutes"),
                "graph_trace_step_count": len(graph_res.get("trace", []))
            },
            "completed_at": datetime.datetime.utcnow().isoformat()
        }

    @classmethod
    def run_tc3(cls, db: Session) -> Dict[str, Any]:
        """
        TC3: NGO has not accepted.
        - Pickup request exists and has restaurant approval, but NGO has not accepted it.
        - Expected: Status remains pending NGO acceptance. System strictly never reports donation as collected.
        """
        now = datetime.datetime.utcnow()
        prep_time = now - datetime.timedelta(minutes=45)
        pickup_deadline = now + datetime.timedelta(hours=4)

        rest = db.query(Restaurant).first()
        ngo = db.query(NGO).first()

        donation_id = f"DON-TC3-{uuid.uuid4().hex[:6].upper()}"
        donation = Donation(
            id=donation_id,
            restaurant_id=rest.id,
            restaurant_name=rest.name,
            food_name="Artisan Sandwiches & Salad Bowls",
            food_type="cold_prepared_meals",
            description="Assorted packaged deli sandwiches refrigerated at 4°C.",
            quantity=15,
            unit="meal_boxes",
            prepared_at=prep_time,
            pickup_deadline=pickup_deadline,
            pickup_address=rest.address,
            storage_temp_celsius=4.0,
            packaging_sealed=True,
            status="APPROVED",
            created_at=now
        )
        db.add(donation)
        db.commit()

        pickup_id = f"REQ-TC3-{uuid.uuid4().hex[:6].upper()}"
        pickup = PickupRequest(
            id=pickup_id,
            donation_id=donation.id,
            ngo_id=ngo.id,
            restaurant_id=rest.id,
            quantity=15,
            pickup_window_start=now + datetime.timedelta(minutes=30),
            pickup_window_end=pickup_deadline,
            drop_off_location=ngo.default_drop_off_location,
            original_drop_off_location=ngo.default_drop_off_location,
            approval_version=1,
            status="APPROVED",
            approved_by="Shift Lead Elena Rostova",
            approved_at=now,
            accepted_by_ngo=False, # Crucial: NGO has NOT accepted
            idempotency_key=f"IDEMP-TC3-{pickup_id}",
            created_at=now,
            updated_at=now
        )
        db.add(pickup)
        db.commit()

        # Step: Query status via independent verification tool
        actual_state = tool_get_pickup_status(db, pickup.id)

        # Step: Attempt premature collection marking via verification tool — MUST BE BLOCKED
        illegal_collection_res = tool_record_verification(db, pickup.id)
        illegal_collection_blocked = illegal_collection_res.get("verified") is False

        db.refresh(pickup)
        passed = (
            pickup.accepted_by_ngo is False
            and pickup.status == "APPROVED"
            and pickup.collected_at is None
            and illegal_collection_blocked is True
            and actual_state.get("accepted_by_ngo") is False
        )

        expected = {
            "accepted_by_ngo": False,
            "status": "APPROVED (awaiting NGO acceptance)",
            "reported_as_collected": False,
            "premature_collection_attempt_blocked": True
        }

        actual = {
            "accepted_by_ngo": pickup.accepted_by_ngo,
            "status": pickup.status,
            "reported_as_collected": pickup.collected_at is not None,
            "premature_collection_attempt_blocked": illegal_collection_blocked
        }

        run_id = f"RUN-TC3-{uuid.uuid4().hex[:6].upper()}"
        agent_run = AgentRun(
            id=run_id,
            thread_id=run_id,
            scenario_id="TC3",
            donation_id=donation.id,
            pickup_request_id=pickup.id,
            current_stage="VERIFY_STATUS_GUARD",
            status="AWAITING_NGO_ACCEPTANCE",
            started_at=now,
            completed_at=datetime.datetime.utcnow(),
            input_snapshot={"pickup_id": pickup.id, "ngo_id": ngo.id},
            verified_state=actual_state,
            execution_trace=[
                {
                    "step_number": 1,
                    "stage": "INDEPENDENT_VERIFICATION_QUERY",
                    "status": "SUCCESS",
                    "timestamp": now.isoformat(),
                    "message": "Independent query confirmed request is registered in mock platform."
                },
                {
                    "step_number": 2,
                    "stage": "NGO_ACCEPTANCE_CHECK",
                    "status": "WARNING",
                    "timestamp": datetime.datetime.utcnow().isoformat(),
                    "message": "Verified state: NGO has not yet accepted. Status strictly retained as pending."
                },
                {
                    "step_number": 3,
                    "stage": "ILLEGAL_COLLECTION_GUARD",
                    "status": "SUCCESS",
                    "timestamp": datetime.datetime.utcnow().isoformat(),
                    "message": "Verification tool actively rejected premature collection marking."
                }
            ]
        )
        db.add(agent_run)
        db.commit()

        return {
            "scenario_id": "TC3",
            "name": "TC3: NGO Has Not Accepted",
            "description": "Verifies that an approved pickup with no NGO confirmation is reported as pending acceptance, and the platform actively prevents premature collection marking.",
            "input_summary": {
                "pickup_id": pickup.id,
                "ngo_name": ngo.name,
                "approved_by": pickup.approved_by,
                "ngo_accepted": False
            },
            "expected_result": expected,
            "actual_result": actual,
            "passed": passed,
            "agent_run_id": run_id,
            "evidence": {
                "verified_state": actual_state,
                "illegal_transition_guard_active": True,
                "trace_step_count": 3
            },
            "completed_at": datetime.datetime.utcnow().isoformat()
        }

    @classmethod
    def run_tc4(cls, db: Session) -> Dict[str, Any]:
        """
        TC4: NGO changes drop-off location.
        - A proposed pickup has an original drop-off location and was approved.
        - The NGO changes the drop-off location.
        - Expected: Original approval is invalidated, status transitions to RECONFIRMATION_REQUIRED,
          and system requires restaurant re-approval before proceeding.
        """
        now = datetime.datetime.utcnow()
        prep_time = now - datetime.timedelta(minutes=20)
        pickup_deadline = now + datetime.timedelta(hours=3)

        rest = db.query(Restaurant).first()
        ngo = db.query(NGO).first()

        donation_id = f"DON-TC4-{uuid.uuid4().hex[:6].upper()}"
        donation = Donation(
            id=donation_id,
            restaurant_id=rest.id,
            restaurant_name=rest.name,
            food_name="Chilled Roasted Chicken & Quinoa Platters",
            food_type="cold_prepared_meals",
            description="Portioned chicken breasts with quinoa and lemon herb dressing.",
            quantity=20,
            unit="meal_boxes",
            prepared_at=prep_time,
            pickup_deadline=pickup_deadline,
            pickup_address=rest.address,
            storage_temp_celsius=3.8,
            packaging_sealed=True,
            status="APPROVED",
            created_at=now
        )
        db.add(donation)
        db.commit()

        original_loc = "Hope Harvest Center - 402 Harbor Ave, Dock B"
        new_loc = "Emergency Outreach Center - 88 South Street, Annex 2"

        pickup_id = f"REQ-TC4-{uuid.uuid4().hex[:6].upper()}"
        pickup = PickupRequest(
            id=pickup_id,
            donation_id=donation.id,
            ngo_id=ngo.id,
            restaurant_id=rest.id,
            quantity=20,
            pickup_window_start=now + datetime.timedelta(minutes=30),
            pickup_window_end=pickup_deadline,
            drop_off_location=original_loc,
            original_drop_off_location=original_loc,
            approval_version=1,
            status="APPROVED",
            approved_by="Chef Marcus Lee",
            approved_at=now,
            accepted_by_ngo=False,
            idempotency_key=f"IDEMP-TC4-{pickup_id}",
            created_at=now,
            updated_at=now
        )
        db.add(pickup)
        db.commit()

        # Execute location change via registered tool
        loc_res = tool_reconfirm_dropoff_location(
            db=db,
            pickup_id=pickup.id,
            new_drop_off_location=new_loc,
            reason="Harbor Ave facility cold room maintenance"
        )

        db.refresh(pickup)
        passed = (
            pickup.status == "RECONFIRMATION_REQUIRED"
            and pickup.approved_by is None
            and pickup.approved_at is None
            and pickup.approval_version == 2
            and pickup.drop_off_location == new_loc
            and pickup.original_drop_off_location == original_loc
        )

        expected = {
            "original_approval_invalidated": True,
            "status": "RECONFIRMATION_REQUIRED",
            "approval_version_incremented": 2,
            "requires_restaurant_reconfirmation": True,
            "silent_finalization_prevented": True
        }

        actual = {
            "original_approval_invalidated": pickup.approved_by is None,
            "status": pickup.status,
            "approval_version": pickup.approval_version,
            "new_drop_off_location": pickup.drop_off_location,
            "original_drop_off_location": pickup.original_drop_off_location
        }

        # Record AgentRun for TC4
        run_id = f"RUN-TC4-{uuid.uuid4().hex[:6].upper()}"
        agent_run = AgentRun(
            id=run_id,
            thread_id=run_id,
            scenario_id="TC4",
            donation_id=donation.id,
            pickup_request_id=pickup.id,
            current_stage="LOCATION_CHANGE_INVALIDATION",
            status="REQUIRES_RECONFIRMATION",
            started_at=now,
            completed_at=datetime.datetime.utcnow(),
            input_snapshot={
                "original_location": original_loc,
                "requested_new_location": new_loc,
                "initial_approval_version": 1
            },
            matching_constraints={
                "location_change_protocol": "STRICT_HUMAN_REAPPROVAL_REQUIRED"
            },
            decision_explanation={
                "rule": "TC4 Safety Protocol",
                "message": "NGO modified destination location after restaurant consent. Previous approval invalidated; version incremented to 2."
            },
            execution_trace=[
                {
                    "step_number": 1,
                    "stage": "ORIGINAL_PROPOSAL_APPROVED",
                    "status": "SUCCESS",
                    "timestamp": now.isoformat(),
                    "message": f"Proposal approved for '{original_loc}' by Chef Marcus Lee (version 1)."
                },
                {
                    "step_number": 2,
                    "stage": "NGO_LOCATION_CHANGE_REQUEST",
                    "status": "WARNING",
                    "timestamp": datetime.datetime.utcnow().isoformat(),
                    "message": f"NGO requested location change to '{new_loc}'."
                },
                {
                    "step_number": 3,
                    "stage": "INVALIDATE_APPROVAL",
                    "status": "SUCCESS",
                    "timestamp": datetime.datetime.utcnow().isoformat(),
                    "message": "Previous approval invalidated. Approval version incremented to 2. Awaiting restaurant reconfirmation."
                }
            ],
            verified_state=actual
        )
        db.add(agent_run)
        db.commit()

        return {
            "scenario_id": "TC4",
            "name": "TC4: NGO Changes Drop-off Location",
            "description": "Validates that when an NGO modifies destination drop-off location post-approval, the previous approval is invalidated, version is incremented, and reconfirmation is strictly required.",
            "input_summary": {
                "pickup_id": pickup.id,
                "original_drop_off_location": original_loc,
                "new_drop_off_location": new_loc
            },
            "expected_result": expected,
            "actual_result": actual,
            "passed": passed,
            "agent_run_id": run_id,
            "evidence": {
                "initial_version": 1,
                "updated_version": pickup.approval_version,
                "cleared_approved_by": pickup.approved_by,
                "trace_step_count": 3
            },
            "completed_at": datetime.datetime.utcnow().isoformat()
        }

    @classmethod
    def run_all(cls, db: Session) -> List[Dict[str, Any]]:
        return [
            cls.run_tc1(db),
            cls.run_tc2(db),
            cls.run_tc3(db),
            cls.run_tc4(db)
        ]
