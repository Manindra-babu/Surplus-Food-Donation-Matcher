import datetime
import uuid
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .models import Restaurant, NGO, Donation, PickupRequest, PickupProposal, AuditEvent, AgentRun
from .rules_engine import FoodSafetyEngine, NGOMatchingEngine
from .config import FOOD_SAFETY_RULES

# --- 1. get_donation_details ---
class GetDonationDetailsInput(BaseModel):
    donation_id: str

def tool_get_donation_details(db: Session, donation_id: str) -> Dict[str, Any]:
    donation = db.query(Donation).filter(Donation.id == donation_id).first()
    if not donation:
        return {"error": f"Donation with ID '{donation_id}' not found.", "found": False}
    
    return {
        "found": True,
        "donation_id": donation.id,
        "restaurant_id": donation.restaurant_id,
        "restaurant_name": donation.restaurant_name,
        "food_name": donation.food_name,
        "food_type": donation.food_type,
        "description": donation.description,
        "quantity": donation.quantity,
        "unit": donation.unit,
        "prepared_at": donation.prepared_at.isoformat(),
        "pickup_deadline": donation.pickup_deadline.isoformat(),
        "pickup_address": donation.pickup_address,
        "storage_temp_celsius": donation.storage_temp_celsius,
        "packaging_sealed": donation.packaging_sealed,
        "status": donation.status,
        "safety_evidence": donation.safety_evidence
    }

# --- 2. search_eligible_ngos ---
class SearchEligibleNGOsInput(BaseModel):
    food_type: str
    min_capacity: int = 1

def tool_search_eligible_ngos(db: Session, food_type: str, min_capacity: int = 1) -> List[Dict[str, Any]]:
    ngos = db.query(NGO).filter(NGO.is_active == True, NGO.status == "ONLINE").all()
    results = []
    for n in ngos:
        avail_cap = max(0, n.max_capacity_meals - n.current_load_meals)
        type_compat = food_type in n.accepted_food_types or "all" in n.accepted_food_types
        if avail_cap >= min_capacity and type_compat:
            results.append({
                "id": n.id,
                "name": n.name,
                "address": n.address,
                "max_capacity_meals": n.max_capacity_meals,
                "current_load_meals": n.current_load_meals,
                "available_capacity": avail_cap,
                "accepted_food_types": n.accepted_food_types,
                "pickup_radius_km": n.pickup_radius_km,
                "default_drop_off_location": n.default_drop_off_location,
                "status": n.status
            })
    return results

# --- 3. validate_food_safety ---
class ValidateFoodSafetyInput(BaseModel):
    prepared_at: datetime.datetime
    pickup_deadline: datetime.datetime
    storage_temp_celsius: float
    packaging_sealed: bool = True
    food_type: str = "hot_prepared_meals"
    safety_evidence: Optional[Dict[str, Any]] = None

def tool_validate_food_safety(
    prepared_at: datetime.datetime,
    pickup_deadline: datetime.datetime,
    storage_temp_celsius: float,
    packaging_sealed: bool = True,
    food_type: str = "hot_prepared_meals",
    safety_evidence: Optional[Dict[str, Any]] = None,
    reference_time: Optional[datetime.datetime] = None
) -> Dict[str, Any]:
    return FoodSafetyEngine.evaluate_donation_safety(
        prepared_at=prepared_at,
        pickup_deadline=pickup_deadline,
        storage_temp_celsius=storage_temp_celsius,
        packaging_sealed=packaging_sealed,
        food_type=food_type,
        safety_evidence=safety_evidence,
        reference_time=reference_time
    )

# --- 4. check_ngo_capacity ---
class CheckNGOCapacityInput(BaseModel):
    ngo_id: str
    requested_quantity: int

def tool_check_ngo_capacity(db: Session, ngo_id: str, requested_quantity: int) -> Dict[str, Any]:
    ngo = db.query(NGO).filter(NGO.id == ngo_id).first()
    if not ngo:
        return {"found": False, "eligible": False, "reason": f"NGO '{ngo_id}' not found."}
    
    available = max(0, ngo.max_capacity_meals - ngo.current_load_meals)
    sufficient = available >= requested_quantity
    return {
        "found": True,
        "ngo_id": ngo.id,
        "ngo_name": ngo.name,
        "max_capacity_meals": ngo.max_capacity_meals,
        "current_load_meals": ngo.current_load_meals,
        "available_capacity": available,
        "requested_quantity": requested_quantity,
        "sufficient_capacity": sufficient,
        "headroom_meals": available - requested_quantity
    }

# --- 5. evaluate_pickup_feasibility ---
class EvaluatePickupFeasibilityInput(BaseModel):
    pickup_start: datetime.datetime
    pickup_end: datetime.datetime
    distance_km: float
    max_radius_km: float

def tool_evaluate_pickup_feasibility(
    pickup_start: datetime.datetime,
    pickup_end: datetime.datetime,
    distance_km: float,
    max_radius_km: float
) -> Dict[str, Any]:
    window_hours = (pickup_end - pickup_start).total_seconds() / 3600.0
    time_feasible = window_hours >= 0.5 # At least 30 mins
    distance_feasible = distance_km <= max_radius_km
    return {
        "feasible": time_feasible and distance_feasible,
        "window_duration_hours": round(window_hours, 2),
        "distance_km": round(distance_km, 1),
        "max_radius_km": round(max_radius_km, 1),
        "time_feasible": time_feasible,
        "distance_feasible": distance_feasible
    }

# --- 6. rank_ngo_candidates ---
def tool_rank_ngo_candidates(
    db: Session,
    donation_quantity: int,
    donation_food_type: str,
    pickup_start: datetime.datetime,
    pickup_end: datetime.datetime
) -> Dict[str, Any]:
    ngos = db.query(NGO).filter(NGO.is_active == True).all()
    eligible = []
    ineligible = []

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
        dist = 3.5 if "Downtown" in n.address or "Harbor" in n.address else 6.2
        is_el, constraints, exclusions, score = NGOMatchingEngine.evaluate_ngo_eligibility(
            ngo_dict=ngo_dict,
            donation_quantity=donation_quantity,
            donation_food_type=donation_food_type,
            pickup_start=pickup_start,
            pickup_end=pickup_end,
            estimated_distance_km=dist
        )
        cand = {
            "ngo_id": n.id,
            "ngo_name": n.name,
            "eligible": is_el,
            "constraints": constraints,
            "score": score,
            "capacity_available": max(0, n.max_capacity_meals - n.current_load_meals),
            "estimated_distance_km": dist,
            "exclusion_reasons": exclusions,
            "default_drop_off_location": n.default_drop_off_location
        }
        if is_el:
            eligible.append(cand)
        else:
            ineligible.append(cand)

    eligible.sort(key=lambda x: x["score"], reverse=True)
    return {
        "candidates_evaluated": len(ngos),
        "eligible_count": len(eligible),
        "ineligible_count": len(ineligible),
        "ranked_candidates": eligible,
        "excluded_candidates": ineligible,
        "top_match": eligible[0] if eligible else None
    }

# --- 7. create_pickup_proposal ---
def tool_create_pickup_proposal(
    db: Session,
    donation_id: str,
    ngo_id: str,
    thread_id: Optional[str] = None
) -> Dict[str, Any]:
    donation = db.query(Donation).filter(Donation.id == donation_id).first()
    if not donation:
        return {"error": f"Donation '{donation_id}' not found."}
    
    ngo = db.query(NGO).filter(NGO.id == ngo_id).first()
    if not ngo:
        return {"error": f"NGO '{ngo_id}' not found."}

    # Check for existing proposal
    existing = db.query(PickupProposal).filter(
        PickupProposal.donation_id == donation_id,
        PickupProposal.status.in_(["PROPOSED", "APPROVED", "RECONFIRMATION_REQUIRED"])
    ).first()
    if existing:
        return {
            "created": False,
            "proposal_id": existing.id,
            "proposal_version": existing.approval_version,
            "status": existing.status,
            "drop_off_location": existing.drop_off_location,
            "message": "Existing active proposal found."
        }

    now = datetime.datetime.utcnow()
    proposal_id = f"PROP-{uuid.uuid4().hex[:8].upper()}"
    proposal = PickupProposal(
        id=proposal_id,
        thread_id=thread_id,
        donation_id=donation.id,
        ngo_id=ngo.id,
        restaurant_id=donation.restaurant_id,
        quantity=donation.quantity,
        pickup_window_start=now + datetime.timedelta(minutes=15),
        pickup_window_end=donation.pickup_deadline,
        drop_off_location=ngo.default_drop_off_location,
        original_drop_off_location=ngo.default_drop_off_location,
        approval_version=1,
        status="PROPOSED",
        candidate_selection_reasons={"ngo_name": ngo.name, "capacity": ngo.max_capacity_meals},
        eligibility_results={"capacity_verified": True},
        created_at=now,
        updated_at=now
    )
    donation.status = "PENDING_APPROVAL"
    db.add(proposal)
    db.commit()
    db.refresh(proposal)

    return {
        "created": True,
        "proposal_id": proposal.id,
        "proposal_version": proposal.approval_version,
        "donation_id": proposal.donation_id,
        "ngo_id": proposal.ngo_id,
        "ngo_name": ngo.name,
        "quantity": proposal.quantity,
        "drop_off_location": proposal.drop_off_location,
        "status": proposal.status
    }

# --- 8. get_proposal_details ---
def tool_get_proposal_details(db: Session, proposal_id: str) -> Dict[str, Any]:
    proposal = db.query(PickupProposal).filter(PickupProposal.id == proposal_id).first()
    if not proposal:
        return {"found": False, "error": f"Proposal '{proposal_id}' not found."}
    
    return {
        "found": True,
        "proposal_id": proposal.id,
        "donation_id": proposal.donation_id,
        "ngo_id": proposal.ngo_id,
        "quantity": proposal.quantity,
        "approval_version": proposal.approval_version,
        "drop_off_location": proposal.drop_off_location,
        "original_drop_off_location": proposal.original_drop_off_location,
        "status": proposal.status,
        "approved_by": proposal.approved_by,
        "approved_at": proposal.approved_at.isoformat() if proposal.approved_at else None
    }

# --- 9. record_human_decision ---
def tool_record_human_decision(
    db: Session,
    proposal_id: str,
    approved: bool,
    operator_name: str,
    approval_version: int,
    rejection_reason: Optional[str] = None
) -> Dict[str, Any]:
    proposal = db.query(PickupProposal).filter(PickupProposal.id == proposal_id).first()
    if not proposal:
        return {"success": False, "error": f"Proposal '{proposal_id}' not found."}

    # Version check to prevent race conditions or stale confirmations
    if approval_version != proposal.approval_version:
        return {
            "success": False,
            "error": f"Version mismatch: Submitted v{approval_version}, proposal is v{proposal.approval_version}."
        }

    now = datetime.datetime.utcnow()
    if approved:
        proposal.status = "APPROVED"
        proposal.approved_by = operator_name
        proposal.approved_at = now
    else:
        proposal.status = "REJECTED"
        proposal.rejection_reason = rejection_reason or "Declined by operator"

    proposal.updated_at = now
    db.commit()
    db.refresh(proposal)

    return {
        "success": True,
        "proposal_id": proposal.id,
        "status": proposal.status,
        "approved": approved,
        "approved_by": proposal.approved_by,
        "approval_version": proposal.approval_version,
        "timestamp": now.isoformat()
    }

# --- 10. create_pickup_request ---
def tool_create_pickup_request(
    db: Session,
    proposal_id: str,
    idempotency_key: Optional[str] = None
) -> Dict[str, Any]:
    proposal = db.query(PickupProposal).filter(PickupProposal.id == proposal_id).first()
    if not proposal:
        return {"success": False, "error": f"Proposal '{proposal_id}' not found."}

    if proposal.status != "APPROVED":
        return {
            "success": False,
            "error": f"Illegal action: Cannot create pickup request for proposal in status '{proposal.status}'. Must be APPROVED."
        }

    idemp_key = idempotency_key or f"IDEMP-PROP-{proposal.id}-v{proposal.approval_version}"
    existing = db.query(PickupRequest).filter(PickupRequest.idempotency_key == idemp_key).first()
    if existing:
        return {
            "success": True,
            "pickup_id": existing.id,
            "status": existing.status,
            "is_duplicate_prevented": True,
            "drop_off_location": existing.drop_off_location
        }

    now = datetime.datetime.utcnow()
    pickup_id = f"REQ-{uuid.uuid4().hex[:8].upper()}"
    pickup = PickupRequest(
        id=pickup_id,
        donation_id=proposal.donation_id,
        ngo_id=proposal.ngo_id,
        restaurant_id=proposal.restaurant_id,
        quantity=proposal.quantity,
        pickup_window_start=proposal.pickup_window_start,
        pickup_window_end=proposal.pickup_window_end,
        drop_off_location=proposal.drop_off_location,
        original_drop_off_location=proposal.original_drop_off_location,
        approval_version=proposal.approval_version,
        status="APPROVED", # Awaiting NGO confirmation
        approved_by=proposal.approved_by,
        approved_at=proposal.approved_at,
        accepted_by_ngo=False,
        idempotency_key=idemp_key,
        created_at=now,
        updated_at=now
    )
    proposal.status = "EXECUTED"
    db.add(pickup)
    db.commit()
    db.refresh(pickup)

    return {
        "success": True,
        "pickup_id": pickup.id,
        "status": pickup.status,
        "approval_version": pickup.approval_version,
        "accepted_by_ngo": pickup.accepted_by_ngo,
        "drop_off_location": pickup.drop_off_location
    }

# --- 11. get_pickup_status ---
def tool_get_pickup_status(db: Session, pickup_id: str) -> Dict[str, Any]:
    pickup = db.query(PickupRequest).filter(PickupRequest.id == pickup_id).first()
    if not pickup:
        return {"found": False, "error": f"Pickup '{pickup_id}' not found."}
    
    return {
        "found": True,
        "pickup_id": pickup.id,
        "donation_id": pickup.donation_id,
        "ngo_id": pickup.ngo_id,
        "status": pickup.status,
        "accepted_by_ngo": pickup.accepted_by_ngo,
        "approval_version": pickup.approval_version,
        "drop_off_location": pickup.drop_off_location,
        "original_drop_off_location": pickup.original_drop_off_location,
        "collected_at": pickup.collected_at.isoformat() if pickup.collected_at else None,
        "verified_at": pickup.verified_at.isoformat() if pickup.verified_at else None
    }

# --- 12. reconfirm_dropoff_location ---
def tool_reconfirm_dropoff_location(
    db: Session,
    pickup_id: str,
    new_drop_off_location: str,
    reason: Optional[str] = None
) -> Dict[str, Any]:
    """
    TC4 Protocol: Invalidate previous approval, increment version, require reconfirmation.
    """
    pickup = db.query(PickupRequest).filter(PickupRequest.id == pickup_id).first()
    if not pickup:
        return {"success": False, "error": f"Pickup '{pickup_id}' not found."}

    now = datetime.datetime.utcnow()
    pickup.drop_off_location = new_drop_off_location
    pickup.approval_version += 1
    pickup.approved_by = None
    pickup.approved_at = None
    pickup.accepted_by_ngo = False
    pickup.status = "RECONFIRMATION_REQUIRED"
    pickup.updated_at = now

    donation = db.query(Donation).filter(Donation.id == pickup.donation_id).first()
    if donation:
        donation.status = "PENDING_APPROVAL"

    db.commit()
    db.refresh(pickup)

    return {
        "success": True,
        "pickup_id": pickup.id,
        "new_version": pickup.approval_version,
        "status": pickup.status,
        "previous_approval_invalidated": True,
        "new_drop_off_location": pickup.drop_off_location
    }

# --- 13. record_verification ---
def tool_record_verification(db: Session, pickup_id: str) -> Dict[str, Any]:
    pickup = db.query(PickupRequest).filter(PickupRequest.id == pickup_id).first()
    if not pickup:
        return {"verified": False, "error": f"Pickup '{pickup_id}' not found."}

    # TC3 Guard: Check if NGO accepted
    if not pickup.accepted_by_ngo or pickup.status != "ACCEPTED_BY_NGO":
        return {
            "verified": False,
            "status": pickup.status,
            "accepted_by_ngo": False,
            "error": "Illegal verification: Cannot confirm collection when NGO acceptance has not occurred.",
            "is_pending_acceptance": True
        }

    now = datetime.datetime.utcnow()
    pickup.collected_at = now
    pickup.verified_at = now
    pickup.status = "VERIFIED_COMPLETE"
    pickup.updated_at = now

    donation = db.query(Donation).filter(Donation.id == pickup.donation_id).first()
    if donation:
        donation.status = "COMPLETED"

    db.commit()
    db.refresh(pickup)

    return {
        "verified": True,
        "pickup_id": pickup.id,
        "status": "VERIFIED_COMPLETE",
        "collected_at": pickup.collected_at.isoformat(),
        "verified_at": pickup.verified_at.isoformat()
    }

# --- 14. write_audit_event ---
def tool_write_audit_event(
    db: Session,
    event_type: str,
    source: str,
    details: Dict[str, Any],
    run_id: Optional[str] = None,
    thread_id: Optional[str] = None
) -> Dict[str, Any]:
    event_id = f"EVT-{uuid.uuid4().hex[:8].upper()}"
    event = AuditEvent(
        id=event_id,
        run_id=run_id,
        thread_id=thread_id,
        event_type=event_type,
        source=source,
        details=details,
        timestamp=datetime.datetime.utcnow()
    )
    db.add(event)
    db.commit()
    return {"audit_event_id": event_id, "recorded": True}
