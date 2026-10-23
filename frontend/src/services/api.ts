import { API_BASE_URL } from '../config';
import type {
  Restaurant,
  NGO,
  Donation,
  PickupRequest,
  AgentRun,
  ScenarioRunResult,
  DashboardMetrics,
  MatchingEvaluationResponse
} from '../types';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorDetail = 'Network request failed';
    try {
      const errorJson = await res.json();
      errorDetail = errorJson.detail || errorDetail;
    } catch {
      errorDetail = await res.text() || res.statusText;
    }
    throw new Error(errorDetail);
  }
  return res.json();
}

export const api = {
  // Operational Metrics
  async getMetrics(): Promise<DashboardMetrics> {
    const res = await fetch(`${API_BASE_URL}/metrics`);
    return handleResponse<DashboardMetrics>(res);
  },

  // Restaurants & NGOs
  async getRestaurants(): Promise<Restaurant[]> {
    const res = await fetch(`${API_BASE_URL}/restaurants`);
    return handleResponse<Restaurant[]>(res);
  },

  async getNGOs(): Promise<NGO[]> {
    const res = await fetch(`${API_BASE_URL}/ngos`);
    return handleResponse<NGO[]>(res);
  },

  // Donations
  async getDonations(): Promise<Donation[]> {
    const res = await fetch(`${API_BASE_URL}/donations`);
    return handleResponse<Donation[]>(res);
  },

  async getDonation(id: string): Promise<Donation> {
    const res = await fetch(`${API_BASE_URL}/donations/${id}`);
    return handleResponse<Donation>(res);
  },

  async createDonation(payload: {
    restaurant_id: string;
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
  }): Promise<Donation> {
    const res = await fetch(`${API_BASE_URL}/donations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return handleResponse<Donation>(res);
  },

  // Matching & AI Coordination
  async evaluateMatching(donationId: string): Promise<MatchingEvaluationResponse> {
    const res = await fetch(`${API_BASE_URL}/matching/evaluate?donation_id=${donationId}`, {
      method: 'POST'
    });
    return handleResponse<MatchingEvaluationResponse>(res);
  },

  // Pickups & State Machine
  async getPickups(): Promise<PickupRequest[]> {
    const res = await fetch(`${API_BASE_URL}/pickups`);
    return handleResponse<PickupRequest[]>(res);
  },

  async getPickup(id: string): Promise<PickupRequest> {
    const res = await fetch(`${API_BASE_URL}/pickups/${id}`);
    return handleResponse<PickupRequest>(res);
  },

  async approvePickup(id: string, approvedBy: string, approvalVersion: number): Promise<PickupRequest> {
    const res = await fetch(`${API_BASE_URL}/pickups/${id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved_by: approvedBy, approval_version: approvalVersion })
    });
    return handleResponse<PickupRequest>(res);
  },

  async acceptPickup(id: string, payload?: { accepted_by?: string; expected_version?: number }): Promise<PickupRequest> {
    const res = await fetch(`${API_BASE_URL}/pickups/${id}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {})
    });
    return handleResponse<PickupRequest>(res);
  },

  async verifyPickupStatus(id: string): Promise<{ verified: boolean; query_timestamp: string; retrieved_state: any }> {
    const res = await fetch(`${API_BASE_URL}/pickups/${id}/verify-status`);
    return handleResponse<{ verified: boolean; query_timestamp: string; retrieved_state: any }>(res);
  },

  async rejectPickup(id: string, reason?: string): Promise<PickupRequest> {
    const res = await fetch(`${API_BASE_URL}/pickups/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: reason || 'Capacity or volunteer constraint' })
    });
    return handleResponse<PickupRequest>(res);
  },

  async changeLocation(id: string, newLocation: string, reason?: string): Promise<PickupRequest> {
    const res = await fetch(`${API_BASE_URL}/pickups/${id}/change-location`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ new_drop_off_location: newLocation, reason })
    });
    return handleResponse<PickupRequest>(res);
  },

  async verifyCompletion(id: string): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/pickups/${id}/verify-completion`, {
      method: 'POST'
    });
    return handleResponse<any>(res);
  },

  // Agent Runs & Trace
  async getAgentRuns(): Promise<AgentRun[]> {
    const res = await fetch(`${API_BASE_URL}/agent-runs`);
    return handleResponse<AgentRun[]>(res);
  },

  async getAgentRun(id: string): Promise<AgentRun> {
    const res = await fetch(`${API_BASE_URL}/agent-runs/${id}`);
    return handleResponse<AgentRun>(res);
  },

  // Test Scenarios
  async runScenario(id: string): Promise<ScenarioRunResult> {
    const res = await fetch(`${API_BASE_URL}/test-scenarios/${id}/run`, {
      method: 'POST'
    });
    return handleResponse<ScenarioRunResult>(res);
  },

  async runAllScenarios(): Promise<ScenarioRunResult[]> {
    const res = await fetch(`${API_BASE_URL}/test-scenarios/run-all`, {
      method: 'POST'
    });
    return handleResponse<ScenarioRunResult[]>(res);
  },

  // Reset Demo
  async resetDemo(): Promise<{ message: string }> {
    const res = await fetch(`${API_BASE_URL}/demo/reset`, {
      method: 'POST'
    });
    return handleResponse<{ message: string }>(res);
  }
};
