from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict

# --- Restaurant Schemas ---
class RestaurantBase(BaseModel):
    id: str
    name: str
    address: str
    contact_name: str
    phone: str
    cuisine_type: str
    is_verified: bool = True

class RestaurantOut(RestaurantBase):
    model_config = ConfigDict(from_attributes=True)

# --- NGO Schemas ---
class NGOBase(BaseModel):
    id: str
    name: str
    address: str
    contact_name: str
    phone: str
    max_capacity_meals: int
    current_load_meals: int
    accepted_food_types: List[str]
    pickup_radius_km: float
    default_drop_off_location: str
    is_active: bool = True
    status: str = "ONLINE"

class NGOOut(NGOBase):
    available_capacity: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)

# --- Donation Schemas ---
class DonationCreate(BaseModel):
    restaurant_id: str
    food_name: str = Field(..., min_length=2)
    food_type: str
    description: Optional[str] = None
    quantity: int = Field(..., gt=0, description="Quantity must be greater than zero")
    unit: str = "meal_boxes"
    prepared_at: datetime
    pickup_deadline: datetime
    pickup_address: str = Field(..., min_length=5)
    storage_temp_celsius: float
    packaging_sealed: bool = True
    safety_evidence: Optional[Dict[str, Any]] = None

class DonationOut(BaseModel):
    id: str
    restaurant_id: str
    restaurant_name: str
    food_name: str
    food_type: str
    description: Optional[str] = None
    quantity: int
    unit: str
    prepared_at: datetime
    pickup_deadline: datetime
    pickup_address: str
    storage_temp_celsius: float
    packaging_sealed: bool
    safety_evidence: Optional[Dict[str, Any]] = None
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# --- Matching & Reasoning Schemas ---
class CandidateConstraintCheck(BaseModel):
    name: str
    passed: bool
    details: str
    evidence: Optional[Dict[str, Any]] = None

class CandidateEvaluation(BaseModel):
    ngo_id: str
    ngo_name: str
    eligible: bool
    constraints: List[CandidateConstraintCheck]
    score: float
    capacity_available: int
    estimated_distance_km: float
    exclusion_reasons: List[str]

class MatchingEvaluationResponse(BaseModel):
    donation_id: str
    food_safety_passed: bool
    food_safety_details: Dict[str, Any]
    candidates_evaluated: int
    eligible_candidates: List[CandidateEvaluation]
    ineligible_candidates: List[CandidateEvaluation]
    recommended_ngo: Optional[CandidateEvaluation] = None
    reasoning_summary: str
    is_llm_generated: bool
    requires_human_approval: bool
    next_action: str

# --- Pickup Request Schemas ---
class PickupProposeRequest(BaseModel):
    donation_id: str
    ngo_id: str
    pickup_window_start: datetime
    pickup_window_end: datetime
    drop_off_location: str
    idempotency_key: Optional[str] = None

class PickupApprovalRequest(BaseModel):
    approved_by: str = Field(..., min_length=2)
    approval_version: int

class PickupAcceptRequest(BaseModel):
    accepted_by: Optional[str] = "Driver David Morales (City Hope Rescue)"
    expected_version: Optional[int] = None
    notes: Optional[str] = None

class PickupChangeLocationRequest(BaseModel):
    new_drop_off_location: str = Field(..., min_length=5)
    reason: Optional[str] = None

class PickupRequestOut(BaseModel):
    id: str
    donation_id: str
    ngo_id: str
    restaurant_id: str
    quantity: int
    pickup_window_start: datetime
    pickup_window_end: datetime
    drop_off_location: str
    original_drop_off_location: str
    approval_version: int
    status: str
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    accepted_by_ngo: bool = False
    accepted_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    collected_at: Optional[datetime] = None
    verified_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class PickupProposalOut(BaseModel):
    id: str
    thread_id: Optional[str] = None
    donation_id: str
    ngo_id: str
    restaurant_id: str
    quantity: int
    pickup_window_start: datetime
    pickup_window_end: datetime
    drop_off_location: str
    original_drop_off_location: str
    approval_version: int
    status: str
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    candidate_selection_reasons: Optional[Dict[str, Any]] = None
    eligibility_results: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class AuditEventOut(BaseModel):
    id: str
    run_id: Optional[str] = None
    thread_id: Optional[str] = None
    event_type: str
    source: str
    details: Optional[Dict[str, Any]] = None
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)

# --- Agent Run Schemas ---
class AgentTraceStep(BaseModel):
    step_number: int
    stage: str
    timestamp: str
    status: str # SUCCESS, WARNING, ERROR, PENDING
    message: str
    data: Optional[Dict[str, Any]] = None

class AgentRunOut(BaseModel):
    id: str
    scenario_id: Optional[str] = None
    donation_id: Optional[str] = None
    pickup_request_id: Optional[str] = None
    current_stage: str
    status: str
    started_at: datetime
    completed_at: Optional[datetime] = None
    input_snapshot: Optional[Dict[str, Any]] = None
    retrieved_ngos: Optional[List[Dict[str, Any]]] = None
    matching_constraints: Optional[Dict[str, Any]] = None
    decision_explanation: Optional[Dict[str, Any]] = None
    execution_trace: List[Dict[str, Any]]
    verified_state: Optional[Dict[str, Any]] = None
    is_llm_powered: bool
    fallback_used: bool
    notes: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

# --- Test Scenario Schemas ---
class ScenarioRunResult(BaseModel):
    scenario_id: str
    name: str
    description: str
    input_summary: Dict[str, Any]
    expected_result: Dict[str, Any]
    actual_result: Dict[str, Any]
    passed: bool
    agent_run_id: str
    evidence: Dict[str, Any]
    completed_at: datetime

# --- Dashboard Overview Schemas ---
class DashboardMetrics(BaseModel):
    total_donations: int
    awaiting_match: int
    pending_approval: int
    pending_ngo_acceptance: int
    collected_or_verified: int
    active_ngos: int
    active_restaurants: int
    total_agent_runs: int
