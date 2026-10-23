export interface Restaurant {
  id: string;
  name: string;
  address: string;
  contact_name: string;
  phone: string;
  cuisine_type: string;
  is_verified: boolean;
}

export interface NGO {
  id: string;
  name: string;
  address: string;
  contact_name: string;
  phone: string;
  max_capacity_meals: number;
  current_load_meals: number;
  available_capacity?: number;
  accepted_food_types: string[];
  pickup_radius_km: number;
  default_drop_off_location: string;
  is_active: boolean;
  status: string;
}

export interface Donation {
  id: string;
  restaurant_id: string;
  restaurant_name: string;
  food_name: string;
  food_type: string;
  description?: string;
  quantity: number;
  unit: string;
  prepared_at: string;
  pickup_deadline: string;
  pickup_address: string;
  storage_temp_celsius: number;
  packaging_sealed: boolean;
  safety_evidence?: Record<string, any>;
  status: 'AWAITING_MATCH' | 'MATCHED' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED_SAFETY' | 'COMPLETED';
  created_at: string;
}

export interface CandidateConstraint {
  name: string;
  passed: boolean;
  details: string;
  evidence?: Record<string, any>;
}

export interface CandidateEvaluation {
  ngo_id: string;
  ngo_name: string;
  eligible: boolean;
  constraints: CandidateConstraint[];
  score: number;
  capacity_available: number;
  estimated_distance_km: number;
  exclusion_reasons: string[];
}

export interface MatchingEvaluationResponse {
  run_id: string;
  donation_id: string;
  status: string;
  food_safety_passed: boolean;
  safety_evaluation: {
    passed: boolean;
    status: string;
    reason: string;
    policy_reference: string;
    elapsed_minutes: number;
    max_allowed_minutes: number;
    evidence: Record<string, any>;
  };
  recommended_ngo?: CandidateEvaluation;
  eligible_alternatives?: CandidateEvaluation[];
  explanation?: string;
  is_llm?: boolean;
  pickup_request_id?: string;
  trace: AgentTraceStep[];
}

export interface PickupRequest {
  id: string;
  donation_id: string;
  ngo_id: string;
  restaurant_id: string;
  quantity: number;
  pickup_window_start: string;
  pickup_window_end: string;
  drop_off_location: string;
  original_drop_off_location: string;
  approval_version: number;
  status: 'PROPOSED' | 'PENDING_APPROVAL' | 'APPROVED' | 'ACCEPTED_BY_NGO' | 'LOCATION_CHANGED' | 'RECONFIRMATION_REQUIRED' | 'COLLECTED' | 'VERIFIED_COMPLETE' | 'REJECTED' | 'CANCELLED';
  approved_by?: string;
  approved_at?: string;
  accepted_by_ngo: boolean;
  accepted_at?: string;
  collected_at?: string;
  verified_at?: string;
  created_at: string;
  updated_at: string;
}

export interface AgentTraceStep {
  step_number: number;
  stage: string;
  timestamp: string;
  status: 'SUCCESS' | 'WARNING' | 'FAILED' | 'BLOCKED' | 'PENDING_APPROVAL';
  message: string;
  data?: Record<string, any>;
}

export interface AgentRun {
  id: string;
  scenario_id?: string;
  donation_id?: string;
  pickup_request_id?: string;
  current_stage: string;
  status: 'RUNNING' | 'SUCCESS' | 'SAFETY_REJECTED' | 'REQUIRES_APPROVAL' | 'AWAITING_NGO_ACCEPTANCE' | 'REQUIRES_RECONFIRMATION' | 'FAILED';
  started_at: string;
  completed_at?: string;
  input_snapshot?: Record<string, any>;
  retrieved_ngos?: any[];
  matching_constraints?: Record<string, any>;
  decision_explanation?: Record<string, any>;
  execution_trace: AgentTraceStep[];
  verified_state?: Record<string, any>;
  is_llm_powered: boolean;
  fallback_used: boolean;
  notes?: string;
}

export interface ScenarioRunResult {
  scenario_id: string;
  name: string;
  description: string;
  input_summary: Record<string, any>;
  expected_result: Record<string, any>;
  actual_result: Record<string, any>;
  passed: boolean;
  agent_run_id: string;
  evidence: Record<string, any>;
  completed_at: string;
}

export interface DashboardMetrics {
  total_donations: number;
  awaiting_match: number;
  pending_approval: number;
  pending_ngo_acceptance: number;
  collected_or_verified: number;
  active_ngos: number;
  active_restaurants: number;
  total_agent_runs: number;
}
