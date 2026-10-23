import datetime
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, JSON, ForeignKey, Text
from sqlalchemy.orm import relationship
from .database import Base

class Restaurant(Base):
    __tablename__ = "restaurants"

    id = Column(String(50), primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    address = Column(String(200), nullable=False)
    contact_name = Column(String(100), nullable=False)
    phone = Column(String(50), nullable=False)
    cuisine_type = Column(String(50), nullable=False)
    is_verified = Column(Boolean, default=True)

class NGO(Base):
    __tablename__ = "ngos"

    id = Column(String(50), primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    address = Column(String(200), nullable=False)
    contact_name = Column(String(100), nullable=False)
    phone = Column(String(50), nullable=False)
    max_capacity_meals = Column(Integer, nullable=False)
    current_load_meals = Column(Integer, default=0)
    accepted_food_types = Column(JSON, nullable=False)  # list of strings
    pickup_radius_km = Column(Float, default=15.0)
    default_drop_off_location = Column(String(200), nullable=False)
    is_active = Column(Boolean, default=True)
    status = Column(String(50), default="ONLINE") # ONLINE, BUSY, OFFLINE

class Donation(Base):
    __tablename__ = "donations"

    id = Column(String(50), primary_key=True, index=True)
    restaurant_id = Column(String(50), ForeignKey("restaurants.id"), nullable=False)
    restaurant_name = Column(String(100), nullable=False)
    food_name = Column(String(150), nullable=False)
    food_type = Column(String(50), nullable=False)
    description = Column(Text, nullable=True)
    quantity = Column(Integer, nullable=False)
    unit = Column(String(30), default="meal_boxes")
    prepared_at = Column(DateTime, nullable=False)
    pickup_deadline = Column(DateTime, nullable=False)
    pickup_address = Column(String(200), nullable=False)
    storage_temp_celsius = Column(Float, nullable=False)
    packaging_sealed = Column(Boolean, default=True)
    safety_evidence = Column(JSON, nullable=True)
    status = Column(String(50), default="AWAITING_MATCH") # AWAITING_MATCH, MATCHED, PENDING_APPROVAL, APPROVED, REJECTED_SAFETY, COMPLETED
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class PickupRequest(Base):
    __tablename__ = "pickup_requests"

    id = Column(String(50), primary_key=True, index=True)
    donation_id = Column(String(50), ForeignKey("donations.id"), nullable=False)
    ngo_id = Column(String(50), ForeignKey("ngos.id"), nullable=False)
    restaurant_id = Column(String(50), nullable=False)
    quantity = Column(Integer, nullable=False)
    pickup_window_start = Column(DateTime, nullable=False)
    pickup_window_end = Column(DateTime, nullable=False)
    drop_off_location = Column(String(200), nullable=False)
    original_drop_off_location = Column(String(200), nullable=False)
    approval_version = Column(Integer, default=1)
    status = Column(String(50), default="PROPOSED") 
    # PROPOSED, PENDING_APPROVAL, APPROVED, ACCEPTED_BY_NGO, LOCATION_CHANGED, RECONFIRMATION_REQUIRED, COLLECTED, VERIFIED_COMPLETE, REJECTED, CANCELLED
    approved_by = Column(String(100), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    accepted_by_ngo = Column(Boolean, default=False)
    accepted_at = Column(DateTime, nullable=True)
    collected_at = Column(DateTime, nullable=True)
    verified_at = Column(DateTime, nullable=True)
    idempotency_key = Column(String(100), unique=True, index=True, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

class AgentRun(Base):
    __tablename__ = "agent_runs"

    id = Column(String(50), primary_key=True, index=True)
    thread_id = Column(String(100), nullable=True, index=True)
    scenario_id = Column(String(50), nullable=True) # TC1, TC2, TC3, TC4, or LIVE
    donation_id = Column(String(50), nullable=True)
    pickup_request_id = Column(String(50), nullable=True)
    proposal_id = Column(String(50), nullable=True)
    current_stage = Column(String(100), nullable=False)
    status = Column(String(50), default="RUNNING") 
    # RUNNING, SUCCESS, SAFETY_REJECTED, REQUIRES_APPROVAL, AWAITING_NGO_ACCEPTANCE, REQUIRES_RECONFIRMATION, FAILED
    started_at = Column(DateTime, default=datetime.datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    input_snapshot = Column(JSON, nullable=True)
    retrieved_ngos = Column(JSON, nullable=True)
    matching_constraints = Column(JSON, nullable=True)
    decision_explanation = Column(JSON, nullable=True)
    execution_trace = Column(JSON, default=list) # List of step items
    verified_state = Column(JSON, nullable=True)
    is_llm_powered = Column(Boolean, default=False)
    fallback_used = Column(Boolean, default=False)
    notes = Column(Text, nullable=True)

class PickupProposal(Base):
    __tablename__ = "pickup_proposals"

    id = Column(String(50), primary_key=True, index=True)
    thread_id = Column(String(100), nullable=True, index=True)
    donation_id = Column(String(50), ForeignKey("donations.id"), nullable=False)
    ngo_id = Column(String(50), ForeignKey("ngos.id"), nullable=False)
    restaurant_id = Column(String(50), nullable=False)
    quantity = Column(Integer, nullable=False)
    pickup_window_start = Column(DateTime, nullable=False)
    pickup_window_end = Column(DateTime, nullable=False)
    drop_off_location = Column(String(200), nullable=False)
    original_drop_off_location = Column(String(200), nullable=False)
    approval_version = Column(Integer, default=1)
    status = Column(String(50), default="PROPOSED") 
    # PROPOSED, APPROVED, REJECTED, RECONFIRMATION_REQUIRED, EXECUTED
    candidate_selection_reasons = Column(JSON, nullable=True)
    eligibility_results = Column(JSON, nullable=True)
    approved_by = Column(String(100), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

class AuditEvent(Base):
    __tablename__ = "audit_events"

    id = Column(String(50), primary_key=True, index=True)
    run_id = Column(String(50), nullable=True, index=True)
    thread_id = Column(String(100), nullable=True, index=True)
    event_type = Column(String(100), nullable=False, index=True)
    source = Column(String(50), nullable=False) # AGENT, HUMAN_OPERATOR, MOCK_PLATFORM, INDEPENDENT_VERIFIER
    details = Column(JSON, nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow, index=True)

