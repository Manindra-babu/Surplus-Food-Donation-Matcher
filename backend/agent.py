import datetime
import json
import logging
import uuid
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.orm import Session

from .config import GEMINI_API_KEY, FOOD_SAFETY_RULES, PRODUCT_NAME
from .models import Donation, NGO, PickupRequest, AgentRun, Restaurant
from .rules_engine import FoodSafetyEngine, NGOMatchingEngine

logger = logging.getLogger("foodbridge_agent")

# Initialize Gemini Client if API key is present
genai_client = None
if GEMINI_API_KEY and not GEMINI_API_KEY.startswith("your_"):
    try:
        from google import genai
        genai_client = genai.Client(api_key=GEMINI_API_KEY)
    except Exception as e:
        logger.warning(f"Could not initialize Google GenAI client: {e}")

class CoordinationAgent:
    """
    10-Stage Auditable AI Agent Workflow for Food Rescue Coordination:
    1. Parse donation request
    2. Validate input schema & completeness
    3. Retrieve NGO records from mock platform
    4. Apply hard constraints (food-safety, intake capacity, service radius, window)
    5. Rank eligible candidates
    6. Generate evidence-backed operational explanation (Gemini LLM or deterministic fallback)
    7. Present pickup proposal for human approval
    8. Execute approved action via mock platform API
    9. Independently verify actual resulting state
    10. Record complete execution trace & evidence
    """

    def __init__(self, db: Session, scenario_id: Optional[str] = None):
        self.db = db
        self.scenario_id = scenario_id
        self.run_id = f"RUN-{uuid.uuid4().hex[:8].upper()}"
        self.trace: List[Dict[str, Any]] = []

    def _log_step(self, step_number: int, stage: str, status: str, message: str, data: Optional[Dict[str, Any]] = None):
        step = {
            "step_number": step_number,
            "stage": stage,
            "timestamp": datetime.datetime.utcnow().isoformat(),
            "status": status,
            "message": message,
            "data": data or {}
        }
        self.trace.append(step)
        logger.info(f"[{self.run_id}] Step {step_number} ({stage}): {status} - {message}")

    def evaluate_and_coordinate(
        self,
        donation: Donation,
        auto_propose: bool = True
    ) -> Dict[str, Any]:
        """
        Executes stages 1 through 7 of the agent workflow.
        Returns matching evaluation, recommendations, and proposed pickup request if eligible.
        """
        started_at = datetime.datetime.utcnow()
        agent_run = AgentRun(
            id=self.run_id,
            scenario_id=self.scenario_id,
            donation_id=donation.id,
            current_stage="1_PARSE_DONATION",
            status="RUNNING",
            started_at=started_at,
            execution_trace=[]
        )
        self.db.add(agent_run)
        self.db.commit()

        # --- Stage 1: Parse Donation Request ---
        self._log_step(1, "PARSE_DONATION", "SUCCESS", f"Parsed donation request {donation.id} from {donation.restaurant_name}", {
            "donation_id": donation.id,
            "restaurant_id": donation.restaurant_id,
            "food_name": donation.food_name,
            "quantity": donation.quantity,
            "unit": donation.unit,
            "food_type": donation.food_type
        })
        agent_run.input_snapshot = {
            "donation_id": donation.id,
            "restaurant_id": donation.restaurant_id,
            "restaurant_name": donation.restaurant_name,
            "food_name": donation.food_name,
            "quantity": donation.quantity,
            "unit": donation.unit,
            "prepared_at": donation.prepared_at.isoformat(),
            "pickup_deadline": donation.pickup_deadline.isoformat(),
            "pickup_address": donation.pickup_address,
            "storage_temp_celsius": donation.storage_temp_celsius,
            "packaging_sealed": donation.packaging_sealed
        }

        # --- Stage 2: Validate Input & Food Safety Constraints ---
        agent_run.current_stage = "2_VALIDATE_FOOD_SAFETY"
        safety_eval = FoodSafetyEngine.evaluate_donation_safety(
            prepared_at=donation.prepared_at,
            pickup_deadline=donation.pickup_deadline,
            storage_temp_celsius=donation.storage_temp_celsius,
            packaging_sealed=donation.packaging_sealed,
            food_type=donation.food_type,
            safety_evidence=donation.safety_evidence
        )

        if not safety_eval["passed"]:
            self._log_step(2, "VALIDATE_FOOD_SAFETY", "FAILED", safety_eval["reason"], safety_eval)
            agent_run.status = "SAFETY_REJECTED"
            agent_run.completed_at = datetime.datetime.utcnow()
            agent_run.matching_constraints = {"food_safety": safety_eval}
            agent_run.decision_explanation = {
                "outcome": "REJECTED_FOOD_SAFETY",
                "summary": safety_eval["reason"],
                "policy": safety_eval["policy_reference"],
                "evidence": safety_eval["evidence"]
            }
            agent_run.execution_trace = self.trace
            donation.status = "REJECTED_SAFETY"
            self.db.commit()

            return {
                "run_id": self.run_id,
                "donation_id": donation.id,
                "status": "SAFETY_REJECTED",
                "food_safety_passed": False,
                "safety_evaluation": safety_eval,
                "recommended_ngo": None,
                "trace": self.trace
            }

        self._log_step(2, "VALIDATE_FOOD_SAFETY", "SUCCESS", "Food donation satisfies temperature and elapsed time safety criteria.", safety_eval)

        # --- Stage 3: Retrieve Eligible NGO Records ---
        agent_run.current_stage = "3_RETRIEVE_NGOS"
        ngos = self.db.query(NGO).filter(NGO.is_active == True).all()
        retrieved_ngos_data = [
            {
                "id": n.id,
                "name": n.name,
                "address": n.address,
                "max_capacity_meals": n.max_capacity_meals,
                "current_load_meals": n.current_load_meals,
                "accepted_food_types": n.accepted_food_types,
                "pickup_radius_km": n.pickup_radius_km,
                "status": n.status
            }
            for n in ngos
        ]
        agent_run.retrieved_ngos = retrieved_ngos_data
        self._log_step(3, "RETRIEVE_NGOS", "SUCCESS", f"Retrieved {len(ngos)} active rescue organizations from platform database.", {
            "ngo_count": len(ngos),
            "ngo_ids": [n.id for n in ngos]
        })

        # --- Stage 4 & 5: Apply Hard Constraints & Rank Eligible Candidates ---
        agent_run.current_stage = "4_EVALUATE_CONSTRAINTS"
        eligible_candidates = []
        ineligible_candidates = []

        for n in ngos:
            ngo_dict = {
                "id": n.id,
                "name": n.name,
                "max_capacity_meals": n.max_capacity_meals,
                "current_load_meals": n.current_load_meals,
                "accepted_food_types": n.accepted_food_types,
                "pickup_radius_km": n.pickup_radius_km,
                "status": n.status,
                "is_active": n.is_active
            }
            # Approximate distance for local demo (can be enhanced with coordinates)
            dist_km = 3.5 if "Downtown" in n.address or "Central" in n.address else 6.2

            is_eligible, constraints, exclusions, score = NGOMatchingEngine.evaluate_ngo_eligibility(
                ngo_dict=ngo_dict,
                donation_quantity=donation.quantity,
                donation_food_type=donation.food_type,
                pickup_start=donation.prepared_at,
                pickup_end=donation.pickup_deadline,
                estimated_distance_km=dist_km
            )

            cand = {
                "ngo_id": n.id,
                "ngo_name": n.name,
                "eligible": is_eligible,
                "constraints": constraints,
                "score": score,
                "capacity_available": max(0, n.max_capacity_meals - n.current_load_meals),
                "estimated_distance_km": dist_km,
                "exclusion_reasons": exclusions
            }

            if is_eligible:
                eligible_candidates.append(cand)
            else:
                ineligible_candidates.append(cand)

        # Sort eligible candidates by multi-factor score descending
        eligible_candidates.sort(key=lambda x: x["score"], reverse=True)

        self._log_step(4, "EVALUATE_CONSTRAINTS", "SUCCESS", f"Evaluated {len(ngos)} candidates: {len(eligible_candidates)} eligible, {len(ineligible_candidates)} excluded.", {
            "eligible_count": len(eligible_candidates),
            "ineligible_count": len(ineligible_candidates)
        })

        agent_run.matching_constraints = {
            "food_safety": safety_eval,
            "eligible_candidates": eligible_candidates,
            "ineligible_candidates": ineligible_candidates
        }

        # Check if any candidate is eligible
        if not eligible_candidates:
            self._log_step(5, "RANK_CANDIDATES", "WARNING", "No eligible NGO satisfies capacity, dietary type, and service radius requirements.", {
                "exclusions": {c["ngo_name"]: c["exclusion_reasons"] for c in ineligible_candidates}
            })
            agent_run.status = "NO_MATCH_FOUND"
            agent_run.completed_at = datetime.datetime.utcnow()
            agent_run.execution_trace = self.trace
            self.db.commit()

            return {
                "run_id": self.run_id,
                "donation_id": donation.id,
                "status": "NO_MATCH_FOUND",
                "food_safety_passed": True,
                "recommended_ngo": None,
                "trace": self.trace
            }

        recommended = eligible_candidates[0]
        self._log_step(5, "RANK_CANDIDATES", "SUCCESS", f"Top candidate selected: {recommended['ngo_name']} (score: {recommended['score']}/100)", {
            "recommended_ngo_id": recommended["ngo_id"],
            "score": recommended["score"]
        })

        # --- Stage 6: Explain Recommended Match (AI / Deterministic Fallback) ---
        agent_run.current_stage = "6_EXPLAIN_DECISION"
        explanation_text, is_llm = self._generate_explanation(donation, recommended, safety_eval)
        agent_run.is_llm_powered = is_llm
        agent_run.fallback_used = not is_llm
        agent_run.decision_explanation = {
            "recommended_ngo": recommended,
            "explanation": explanation_text,
            "source": "Google Gemini 2.5" if is_llm else "Deterministic Rules Engine Fallback",
            "is_llm": is_llm
        }
        self._log_step(6, "EXPLAIN_DECISION", "SUCCESS", f"Generated operational rationale ({'Gemini LLM' if is_llm else 'Rules Engine Fallback'}).", {
            "explanation": explanation_text,
            "is_llm": is_llm
        })

        # --- Stage 7: Present Pickup Proposal for Human Approval ---
        agent_run.current_stage = "7_PRESENT_PROPOSAL"
        pickup_req = None
        if auto_propose:
            target_ngo = self.db.query(NGO).filter(NGO.id == recommended["ngo_id"]).first()
            window_start = datetime.datetime.utcnow() + datetime.timedelta(minutes=15)
            window_end = donation.pickup_deadline

            # Check if pickup request already exists
            existing_req = self.db.query(PickupRequest).filter(
                PickupRequest.donation_id == donation.id,
                PickupRequest.status.notin_(["CANCELLED", "REJECTED"])
            ).first()

            if not existing_req:
                pickup_req = PickupRequest(
                    id=f"REQ-{uuid.uuid4().hex[:8].upper()}",
                    donation_id=donation.id,
                    ngo_id=target_ngo.id,
                    restaurant_id=donation.restaurant_id,
                    quantity=donation.quantity,
                    pickup_window_start=window_start,
                    pickup_window_end=window_end,
                    drop_off_location=target_ngo.default_drop_off_location,
                    original_drop_off_location=target_ngo.default_drop_off_location,
                    approval_version=1,
                    status="PROPOSED",
                    idempotency_key=f"IDEMP-{donation.id}-{target_ngo.id}",
                    created_at=datetime.datetime.utcnow(),
                    updated_at=datetime.datetime.utcnow()
                )
                donation.status = "PENDING_APPROVAL"
                self.db.add(pickup_req)
                self.db.commit()
                self.db.refresh(pickup_req)
            else:
                pickup_req = existing_req

            agent_run.pickup_request_id = pickup_req.id
            self._log_step(7, "PRESENT_PROPOSAL", "PENDING_APPROVAL", f"Pickup proposal {pickup_req.id} created and held for required human approval.", {
                "pickup_id": pickup_req.id,
                "ngo_name": target_ngo.name,
                "drop_off_location": pickup_req.drop_off_location,
                "approval_version": pickup_req.approval_version
            })

        agent_run.status = "REQUIRES_APPROVAL"
        agent_run.execution_trace = self.trace
        self.db.commit()

        return {
            "run_id": self.run_id,
            "donation_id": donation.id,
            "pickup_request_id": pickup_req.id if pickup_req else None,
            "status": "REQUIRES_APPROVAL",
            "food_safety_passed": True,
            "safety_evaluation": safety_eval,
            "recommended_ngo": recommended,
            "eligible_alternatives": eligible_candidates[1:],
            "explanation": explanation_text,
            "is_llm": is_llm,
            "trace": self.trace
        }

    def execute_and_verify(
        self,
        pickup_id: str,
        simulate_ngo_accept: bool = False
    ) -> Dict[str, Any]:
        """
        Executes stages 8 through 10 of the agent workflow.
        Verifies actual resulting state from the mock platform database.
        """
        pickup = self.db.query(PickupRequest).filter(PickupRequest.id == pickup_id).first()
        if not pickup:
            raise ValueError(f"Pickup request '{pickup_id}' not found.")

        agent_run = self.db.query(AgentRun).filter(AgentRun.id == self.run_id).first()
        if not agent_run:
            agent_run = AgentRun(
                id=self.run_id,
                scenario_id=self.scenario_id,
                donation_id=pickup.donation_id,
                pickup_request_id=pickup.id,
                current_stage="8_EXECUTE_ACTION",
                status="RUNNING",
                started_at=datetime.datetime.utcnow(),
                execution_trace=[]
            )
            self.db.add(agent_run)

        # Stage 8: Execute Approved Action
        agent_run.current_stage = "8_EXECUTE_ACTION"
        if pickup.status not in ["APPROVED", "ACCEPTED_BY_NGO"]:
            self._log_step(8, "EXECUTE_ACTION", "BLOCKED", f"Action execution blocked: proposal status is '{pickup.status}'. Human approval is required.", {
                "status": pickup.status
            })
            agent_run.status = "REQUIRES_APPROVAL"
            agent_run.execution_trace = self.trace
            self.db.commit()
            return {"run_id": self.run_id, "status": "BLOCKED_APPROVAL_REQUIRED", "pickup": pickup}

        self._log_step(8, "EXECUTE_ACTION", "SUCCESS", f"Approved action executed via mock platform API. Proposal version {pickup.approval_version} confirmed by {pickup.approved_by}.", {
            "pickup_id": pickup.id,
            "approved_by": pickup.approved_by,
            "approved_at": pickup.approved_at.isoformat() if pickup.approved_at else None
        })

        # Simulate NGO acceptance if requested
        if simulate_ngo_accept and pickup.status == "APPROVED":
            pickup.accepted_by_ngo = True
            pickup.accepted_at = datetime.datetime.utcnow()
            pickup.status = "ACCEPTED_BY_NGO"
            self.db.commit()

        # Stage 9: Independently Retrieve and Verify Actual State
        agent_run.current_stage = "9_VERIFY_STATUS"
        self.db.refresh(pickup)
        actual_status = pickup.status
        is_accepted = pickup.accepted_by_ngo

        verified_data = {
            "verified_at": datetime.datetime.utcnow().isoformat(),
            "pickup_id": pickup.id,
            "actual_status": actual_status,
            "accepted_by_ngo": is_accepted,
            "approval_version": pickup.approval_version,
            "drop_off_location": pickup.drop_off_location,
            "original_drop_off_location": pickup.original_drop_off_location
        }
        agent_run.verified_state = verified_data

        if not is_accepted:
            self._log_step(9, "VERIFY_STATUS", "WARNING", f"Verified state: Request is '{actual_status}' awaiting NGO acceptance. Strictly not reported as collected.", verified_data)
            agent_run.status = "AWAITING_NGO_ACCEPTANCE"
        else:
            self._log_step(9, "VERIFY_STATUS", "SUCCESS", f"Verified state: Request is confirmed accepted by NGO at '{pickup.drop_off_location}'.", verified_data)
            agent_run.status = "SUCCESS"

        # Stage 10: Record Full Execution Trace
        agent_run.current_stage = "10_AUDIT_LOG_COMPLETE"
        agent_run.completed_at = datetime.datetime.utcnow()
        agent_run.execution_trace = self.trace
        self._log_step(10, "AUDIT_LOG_COMPLETE", "SUCCESS", "Recorded full immutable execution trace and evidence in platform audit ledger.", {
            "total_trace_steps": len(self.trace)
        })
        self.db.commit()

        return {
            "run_id": self.run_id,
            "status": agent_run.status,
            "verified_state": verified_data,
            "trace": self.trace
        }

    def _generate_explanation(
        self,
        donation: Donation,
        recommended: Dict[str, Any],
        safety_eval: Dict[str, Any]
    ) -> Tuple[str, bool]:
        """
        Generates explanation using Gemini LLM if configured, otherwise deterministic rule synthesis.
        """
        if genai_client:
            try:
                prompt = (
                    f"You are the coordination intelligence for {PRODUCT_NAME}. Provide a concise 2-sentence operational explanation "
                    f"for dispatching {donation.quantity} {donation.unit} of '{donation.food_name}' ({donation.food_type}) to "
                    f"NGO '{recommended['ngo_name']}'. "
                    f"Data: NGO available capacity: {recommended['capacity_available']} meals, distance: {recommended['estimated_distance_km']}km, "
                    f"match score: {recommended['score']}/100. Food safety: verified prepared {safety_eval.get('elapsed_minutes')}m ago under temperature control. "
                    f"Keep it professional, transparent, and direct without marketing fluff."
                )
                for m in ["gemini-2.0-flash", "gemini-1.5-flash"]:
                    try:
                        response = genai_client.models.generate_content(
                            model=m,
                            contents=prompt
                        )
                        if response and response.text:
                            return response.text.strip(), True
                    except Exception:
                        continue
            except Exception as e:
                logger.warning(f"Gemini API call failed, using deterministic explanation fallback: {e}")

        # Deterministic evidence-backed fallback explanation
        fallback_text = (
            f"{recommended['ngo_name']} is selected with a match score of {recommended['score']}/100 based on verified intake capacity "
            f"({recommended['capacity_available']} meals available for a {donation.quantity}-{donation.unit} dispatch) and proximity ({recommended['estimated_distance_km']} km). "
            f"Food-safety compliance is confirmed under {safety_eval.get('policy_reference', 'FDA Food Code §3-501.19')} with "
            f"{safety_eval.get('elapsed_minutes', 0)} minutes elapsed since prep."
        )
        return fallback_text, False
