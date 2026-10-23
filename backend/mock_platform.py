import datetime
import uuid
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException

from .models import Restaurant, NGO, Donation, PickupRequest, AgentRun, AuditEvent
from .schemas import DonationCreate, PickupProposeRequest, PickupApprovalRequest, PickupChangeLocationRequest
from .rules_engine import FoodSafetyEngine

class MockPlatformService:
    """
    Mock Donation Platform Service providing operational persistence and state transitions:
    - Enforces idempotency on pickup proposals
    - Manages auditable state machine for food rescue coordination
    - Enforces human approval before dispatch execution
    - Enforces invalidation and reconfirmation upon location alteration
    """

    @classmethod
    def list_restaurants(cls, db: Session) -> List[Restaurant]:
        return db.query(Restaurant).all()

    @classmethod
    def list_ngos(cls, db: Session) -> List[NGO]:
        return db.query(NGO).filter(NGO.is_active == True).all()

    @classmethod
    def list_donations(cls, db: Session) -> List[Donation]:
        return db.query(Donation).order_by(Donation.created_at.desc()).all()

    @classmethod
    def get_donation(cls, db: Session, donation_id: str) -> Optional[Donation]:
        return db.query(Donation).filter(Donation.id == donation_id).first()

    @classmethod
    def create_donation(cls, db: Session, donation_in: DonationCreate) -> Donation:
        # Verify restaurant exists
        restaurant = db.query(Restaurant).filter(Restaurant.id == donation_in.restaurant_id).first()
        if not restaurant:
            raise HTTPException(status_code=404, detail=f"Restaurant with ID '{donation_in.restaurant_id}' not found.")

        # Backend food-safety validation check
        safety_eval = FoodSafetyEngine.evaluate_donation_safety(
            prepared_at=donation_in.prepared_at,
            pickup_deadline=donation_in.pickup_deadline,
            storage_temp_celsius=donation_in.storage_temp_celsius,
            packaging_sealed=donation_in.packaging_sealed,
            food_type=donation_in.food_type,
            safety_evidence=donation_in.safety_evidence
        )

        donation_id = f"DON-{uuid.uuid4().hex[:8].upper()}"
        initial_status = "AWAITING_MATCH" if safety_eval["passed"] else "REJECTED_SAFETY"

        prep_dt = donation_in.prepared_at
        if prep_dt.tzinfo is not None:
            prep_dt = prep_dt.astimezone(datetime.timezone.utc).replace(tzinfo=None)
        deadline_dt = donation_in.pickup_deadline
        if deadline_dt.tzinfo is not None:
            deadline_dt = deadline_dt.astimezone(datetime.timezone.utc).replace(tzinfo=None)

        donation = Donation(
            id=donation_id,
            restaurant_id=restaurant.id,
            restaurant_name=restaurant.name,
            food_name=donation_in.food_name,
            food_type=donation_in.food_type,
            description=donation_in.description,
            quantity=donation_in.quantity,
            unit=donation_in.unit,
            prepared_at=prep_dt,
            pickup_deadline=deadline_dt,
            pickup_address=donation_in.pickup_address,
            storage_temp_celsius=donation_in.storage_temp_celsius,
            packaging_sealed=donation_in.packaging_sealed,
            safety_evidence={
                "input_evidence": donation_in.safety_evidence or {},
                "backend_verification": safety_eval
            },
            status=initial_status,
            created_at=datetime.datetime.utcnow()
        )
        db.add(donation)
        db.commit()
        db.refresh(donation)
        return donation

    @classmethod
    def propose_pickup(cls, db: Session, req: PickupProposeRequest) -> PickupRequest:
        # Check idempotency key to prevent duplicate proposal creation
        if req.idempotency_key:
            existing = db.query(PickupRequest).filter(PickupRequest.idempotency_key == req.idempotency_key).first()
            if existing:
                return existing

        donation = db.query(Donation).filter(Donation.id == req.donation_id).first()
        if not donation:
            raise HTTPException(status_code=404, detail=f"Donation '{req.donation_id}' not found.")

        ngo = db.query(NGO).filter(NGO.id == req.ngo_id).first()
        if not ngo:
            raise HTTPException(status_code=404, detail=f"NGO '{req.ngo_id}' not found.")

        # Verify donation is not already completed or cancelled
        if donation.status in ["COMPLETED", "REJECTED_SAFETY"]:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot propose pickup for donation in status '{donation.status}'."
            )

        # Check if an active pickup request already exists for this donation
        active_pickup = db.query(PickupRequest).filter(
            PickupRequest.donation_id == donation.id,
            PickupRequest.status.notin_(["CANCELLED", "REJECTED"])
        ).first()

        if active_pickup:
            return active_pickup

        pickup_id = f"REQ-{uuid.uuid4().hex[:8].upper()}"
        pickup = PickupRequest(
            id=pickup_id,
            donation_id=donation.id,
            ngo_id=ngo.id,
            restaurant_id=donation.restaurant_id,
            quantity=donation.quantity,
            pickup_window_start=req.pickup_window_start,
            pickup_window_end=req.pickup_window_end,
            drop_off_location=req.drop_off_location,
            original_drop_off_location=req.drop_off_location,
            approval_version=1,
            status="PROPOSED",
            accepted_by_ngo=False,
            idempotency_key=req.idempotency_key or f"IDEMP-{uuid.uuid4().hex[:12]}",
            created_at=datetime.datetime.utcnow(),
            updated_at=datetime.datetime.utcnow()
        )
        donation.status = "PENDING_APPROVAL"

        # Record audit event
        event = AuditEvent(
            id=f"EVT-{uuid.uuid4().hex[:8].upper()}",
            event_type="PICKUP_PROPOSED",
            source="MOCK_PLATFORM",
            details={
                "pickup_id": pickup.id,
                "donation_id": pickup.donation_id,
                "ngo_id": pickup.ngo_id,
                "idempotency_key": pickup.idempotency_key
            },
            timestamp=datetime.datetime.utcnow()
        )
        db.add(event)

        db.add(pickup)
        db.commit()
        db.refresh(pickup)
        return pickup

    @classmethod
    def approve_pickup(cls, db: Session, pickup_id: str, approval_req: PickupApprovalRequest) -> PickupRequest:
        pickup = db.query(PickupRequest).filter(PickupRequest.id == pickup_id).first()
        if not pickup:
            raise HTTPException(status_code=404, detail=f"Pickup request '{pickup_id}' not found.")

        # Verify approval version matches current version to prevent race conditions
        if approval_req.approval_version != pickup.approval_version:
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Approval version mismatch. Provided version {approval_req.approval_version}, "
                    f"current proposal version is {pickup.approval_version}. Proposal must be re-evaluated."
                )
            )

        # Transition status to APPROVED (awaiting NGO confirmation)
        pickup.status = "APPROVED"
        pickup.approved_by = approval_req.approved_by
        pickup.approved_at = datetime.datetime.utcnow()
        pickup.updated_at = datetime.datetime.utcnow()

        donation = db.query(Donation).filter(Donation.id == pickup.donation_id).first()
        if donation:
            donation.status = "APPROVED"

        # Record audit event
        event = AuditEvent(
            id=f"EVT-{uuid.uuid4().hex[:8].upper()}",
            event_type="PICKUP_APPROVED",
            source="HUMAN_OPERATOR",
            details={
                "pickup_id": pickup.id,
                "donation_id": pickup.donation_id,
                "approved_by": pickup.approved_by,
                "approval_version": pickup.approval_version
            },
            timestamp=datetime.datetime.utcnow()
        )
        db.add(event)

        db.commit()
        db.refresh(pickup)
        return pickup

    @classmethod
    def accept_pickup_by_ngo(
        cls,
        db: Session,
        pickup_id: str,
        actor: str = "Driver David Morales (City Hope Rescue)",
        expected_version: Optional[int] = None
    ) -> PickupRequest:
        pickup = db.query(PickupRequest).filter(PickupRequest.id == pickup_id).first()
        if not pickup:
            raise HTTPException(status_code=404, detail=f"Pickup request '{pickup_id}' not found.")

        # Stale proposal version check
        if expected_version is not None and expected_version != pickup.approval_version:
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Stale proposal version. Action attempted for v{expected_version}, "
                    f"but current version is v{pickup.approval_version}. Reconfirmation required."
                )
            )

        # Retry idempotency: if already accepted, return existing accepted record without duplicating load/event
        if pickup.status == "ACCEPTED_BY_NGO" and pickup.accepted_by_ngo:
            return pickup

        # Invalid state check
        if pickup.status not in ["APPROVED"]:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot accept pickup in status '{pickup.status}'. Must be in 'APPROVED' status awaiting NGO acceptance."
            )

        now = datetime.datetime.utcnow()
        pickup.accepted_by_ngo = True
        pickup.accepted_at = now
        pickup.status = "ACCEPTED_BY_NGO"
        pickup.updated_at = now

        # Update NGO current load
        ngo = db.query(NGO).filter(NGO.id == pickup.ngo_id).first()
        if ngo:
            ngo.current_load_meals += pickup.quantity

        # Record audit event
        event = AuditEvent(
            id=f"EVT-{uuid.uuid4().hex[:8].upper()}",
            event_type="MOCK_NGO_ACCEPTED",
            source="MOCK_PLATFORM",
            details={
                "pickup_id": pickup.id,
                "donation_id": pickup.donation_id,
                "ngo_id": pickup.ngo_id,
                "accepted_by": actor,
                "approval_version": pickup.approval_version,
                "accepted_at": now.isoformat()
            },
            timestamp=now
        )
        db.add(event)

        db.commit()
        db.refresh(pickup)
        return pickup

    @classmethod
    def reject_pickup_by_ngo(cls, db: Session, pickup_id: str, reason: str = "Capacity or volunteer constraint") -> PickupRequest:
        """
        Simulates NGO declining or rejecting the dispatch request.
        Updates state to REJECTED, clears acceptance, returns donation to AWAITING_MATCH,
        and logs audit trail.
        """
        pickup = db.query(PickupRequest).filter(PickupRequest.id == pickup_id).first()
        if not pickup:
            raise HTTPException(status_code=404, detail=f"Pickup request '{pickup_id}' not found.")

        if pickup.status in ["VERIFIED_COMPLETE", "COLLECTED"]:
            raise HTTPException(status_code=400, detail=f"Cannot reject pickup in status '{pickup.status}'.")

        if pickup.accepted_by_ngo:
            ngo = db.query(NGO).filter(NGO.id == pickup.ngo_id).first()
            if ngo:
                ngo.current_load_meals = max(0, ngo.current_load_meals - pickup.quantity)

        pickup.status = "REJECTED"
        pickup.accepted_by_ngo = False
        pickup.rejection_reason = reason
        pickup.updated_at = datetime.datetime.utcnow()

        donation = db.query(Donation).filter(Donation.id == pickup.donation_id).first()
        if donation:
            donation.status = "AWAITING_MATCH"

        event = AuditEvent(
            id=f"EVT-{uuid.uuid4().hex[:8].upper()}",
            event_type="MOCK_NGO_REJECTION",
            source="MOCK_PLATFORM",
            details={
                "pickup_id": pickup.id,
                "donation_id": pickup.donation_id,
                "ngo_id": pickup.ngo_id,
                "reason": reason,
                "donation_reopened": True
            },
            timestamp=datetime.datetime.utcnow()
        )
        db.add(event)

        db.commit()
        db.refresh(pickup)
        return pickup

    @classmethod
    def change_drop_off_location(cls, db: Session, pickup_id: str, change_req: PickupChangeLocationRequest) -> PickupRequest:
        """
        Critical safety / governance protocol (TC4):
        If the NGO modifies the drop-off location after restaurant approval,
        the previous human approval is explicitly INVALIDATED.
        The restaurant must re-review and reconfirm the updated proposal.
        """
        pickup = db.query(PickupRequest).filter(PickupRequest.id == pickup_id).first()
        if not pickup:
            raise HTTPException(status_code=404, detail=f"Pickup request '{pickup_id}' not found.")

        # Invalidate previous human approval
        pickup.drop_off_location = change_req.new_drop_off_location
        pickup.approval_version += 1
        pickup.approved_by = None
        pickup.approved_at = None
        pickup.accepted_by_ngo = False
        pickup.status = "RECONFIRMATION_REQUIRED"
        pickup.updated_at = datetime.datetime.utcnow()

        donation = db.query(Donation).filter(Donation.id == pickup.donation_id).first()
        if donation:
            donation.status = "PENDING_APPROVAL"

        # Record audit event
        event = AuditEvent(
            id=f"EVT-{uuid.uuid4().hex[:8].upper()}",
            event_type="LOCATION_ALTERED_APPROVAL_INVALIDATED",
            source="MOCK_PLATFORM",
            details={
                "pickup_id": pickup.id,
                "donation_id": pickup.donation_id,
                "old_location": pickup.original_drop_off_location,
                "new_location": pickup.drop_off_location,
                "approval_version": pickup.approval_version,
                "previous_approval_cleared": True
            },
            timestamp=datetime.datetime.utcnow()
        )
        db.add(event)

        db.commit()
        db.refresh(pickup)
        return pickup

    @classmethod
    def mark_collected_and_verified(cls, db: Session, pickup_id: str) -> Dict[str, Any]:
        """
        Marks collection and verifies completion.
        CRITICAL GUARD: Cannot collect if NGO has not accepted!
        """
        pickup = db.query(PickupRequest).filter(PickupRequest.id == pickup_id).first()
        if not pickup:
            raise HTTPException(status_code=404, detail=f"Pickup request '{pickup_id}' not found.")

        # Hard guard: Check that NGO has accepted
        if not pickup.accepted_by_ngo or pickup.status != "ACCEPTED_BY_NGO":
            raise HTTPException(
                status_code=400,
                detail="Illegal state transition: Cannot mark donation as collected when NGO acceptance is not confirmed."
            )

        now = datetime.datetime.utcnow()
        pickup.collected_at = now
        pickup.verified_at = now
        pickup.status = "VERIFIED_COMPLETE"
        pickup.updated_at = now

        donation = db.query(Donation).filter(Donation.id == pickup.donation_id).first()
        if donation:
            donation.status = "COMPLETED"

        # Record audit event
        event = AuditEvent(
            id=f"EVT-{uuid.uuid4().hex[:8].upper()}",
            event_type="COLLECTION_VERIFIED",
            source="INDEPENDENT_VERIFIER",
            details={
                "pickup_id": pickup.id,
                "donation_id": pickup.donation_id,
                "ngo_id": pickup.ngo_id,
                "collected_at": pickup.collected_at.isoformat()
            },
            timestamp=now
        )
        db.add(event)

        db.commit()
        db.refresh(pickup)

        return {
            "pickup_id": pickup.id,
            "donation_id": pickup.donation_id,
            "status": "VERIFIED_COMPLETE",
            "collected_at": pickup.collected_at.isoformat(),
            "verified_at": pickup.verified_at.isoformat(),
            "audit_evidence": {
                "approval_version": pickup.approval_version,
                "approved_by": pickup.approved_by,
                "ngo_accepted": pickup.accepted_by_ngo,
                "drop_off_location": pickup.drop_off_location
            }
        }
