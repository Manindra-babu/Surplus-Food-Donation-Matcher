import requests
import sqlite3
import json
import time
import datetime

BASE_URL = "http://127.0.0.1:8000"

def get_db_counts():
    conn = sqlite3.connect("backend/foodbridge.db")
    c = conn.cursor()
    c.execute("SELECT count(*) FROM donations")
    donations = c.fetchone()[0]
    c.execute("SELECT count(*) FROM pickup_proposals")
    proposals = c.fetchone()[0]
    c.execute("SELECT count(*) FROM pickup_requests")
    pickups = c.fetchone()[0]
    conn.close()
    return {"donations": donations, "proposals": proposals, "pickups": pickups}

def run_verification():
    print("==================================================")
    print("FOODBRIDGE AI: PHASE 7 LIVE VERIFICATION TRACE")
    print("==================================================")

    # 1. Reset sandbox
    print("\n--- STEP 1: RESET SANDBOX ---")
    res = requests.post(f"{BASE_URL}/api/demo/reset")
    print("Reset response:", res.status_code, res.json())
    baseline_counts = get_db_counts()
    print("Baseline DB counts:", baseline_counts)

    # 2. Submit new donation
    print("\n--- STEP 2: SUBMIT SURPLUS FOOD DONATION ---")
    now_utc = datetime.datetime.now(datetime.timezone.utc)
    prep_time = now_utc - datetime.timedelta(minutes=25)
    deadline_time = now_utc + datetime.timedelta(hours=2)

    donation_payload = {
        "restaurant_id": "REST-001",
        "food_name": "Artisan Roast Chicken & Wild Rice Pilaf",
        "food_type": "hot_prepared_meals",
        "description": "Surplus freshly prepared catering boxes held in commercial thermal warmers.",
        "quantity": 20,
        "unit": "meal_boxes",
        "prepared_at": prep_time.isoformat(),
        "pickup_deadline": deadline_time.isoformat(),
        "pickup_address": "Skyline Bistro — 450 Grand Concourse, Floor 2",
        "storage_temp_celsius": 63.5,
        "packaging_sealed": True,
        "safety_evidence": {
            "removed_from_temperature_control_at": prep_time.isoformat(),
            "storage_condition": "hot_held",
            "has_label_procedures": True,
            "use_time_as_public_health_control": True,
            "applicable_rule": "TPHC_4_HOUR"
        }
    }
    res = requests.post(f"{BASE_URL}/api/donations", json=donation_payload)
    print("Create donation status:", res.status_code)
    if res.status_code != 200:
        print("Error body:", res.text)
    created_donation = res.json()
    donation_id = created_donation.get("id")
    print(f"Created donation ID: {donation_id}, Status: {created_donation.get('status')}")

    # 3. Trigger LangGraph matching agent
    print(f"\n--- STEP 3: TRIGGER LANGGRAPH MATCHING AGENT FOR {donation_id} ---")
    res = requests.post(f"{BASE_URL}/api/matching/evaluate?donation_id={donation_id}")
    print("Evaluate status:", res.status_code)
    if res.status_code != 200:
        print("Error body:", res.text)
    eval_result = res.json()
    print("Orchestrator:", eval_result.get("orchestrator"))
    print("Safety outcome:", eval_result.get("food_safety", {}).get("outcome"))
    print("Matched NGO:", eval_result.get("selected_candidate", {}).get("ngo_name"))
    print("StateGraph Interrupt Reached (Awaiting Human Approval):", eval_result.get("checkpoint_reached"))
    proposal_id = eval_result.get("proposal_id")
    print(f"Generated Proposal ID: {proposal_id}")

    # 4. Check SQLite prior to approval
    print("\n--- STEP 4: VERIFY SQLITE PRIOR TO HUMAN APPROVAL ---")
    counts_after_eval = get_db_counts()
    print("DB counts after matching:", counts_after_eval)
    conn = sqlite3.connect("backend/foodbridge.db")
    c = conn.cursor()
    c.execute("SELECT id, status, ngo_id, quantity FROM pickup_proposals WHERE id=?", (proposal_id,))
    proposal_row = c.fetchone()
    print(f"Proposal in DB: {proposal_row}")
    c.execute("SELECT count(*) FROM pickup_requests WHERE donation_id=?", (donation_id,))
    pickups_before_approval = c.fetchone()[0]
    print(f"Pickup requests created for donation before human approval: {pickups_before_approval} (MUST BE 0)")
    assert pickups_before_approval == 0, "Execution leaked pickup request before approval!"
    conn.close()

    # 5. Premature collection attempt (should fail if attempted via direct endpoint)
    print("\n--- STEP 5: ATTEMPT DISPATCH CREATION WITHOUT APPROVAL ---")
    res = requests.post(f"{BASE_URL}/api/pickups/{proposal_id}/verify-completion")
    print(f"Attempting completion on proposal {proposal_id}: HTTP {res.status_code} ({res.text})")

    # 6. Human Approval
    print("\n--- STEP 6: HUMAN APPROVAL (OPERATOR SIGN-OFF) ---")
    res = requests.post(f"{BASE_URL}/api/pickups/{proposal_id}/approve", json={
        "approved_by": "Executive Chef Marco Alvarez",
        "approval_version": 1
    })
    print("Approval response:", res.status_code)
    if res.status_code != 200:
        print("Error body:", res.text)
    approved_pickup = res.json()
    pickup_id = approved_pickup.get("id")
    print(f"Approved Pickup Request ID: {pickup_id}")
    print(f"Status: {approved_pickup.get('status')}")
    print(f"Approved By: {approved_pickup.get('approved_by')}")
    print(f"Accepted by NGO: {approved_pickup.get('accepted_by_ngo')}")
    print(f"Approval Version: {approved_pickup.get('approval_version')}")

    # 7. Check SQLite after approval
    print("\n--- STEP 7: VERIFY SQLITE AFTER HUMAN APPROVAL ---")
    conn = sqlite3.connect("backend/foodbridge.db")
    c = conn.cursor()
    c.execute("SELECT id, status, accepted_by_ngo, approved_by, approval_version FROM pickup_requests WHERE id=?", (pickup_id,))
    pickup_row = c.fetchone()
    print(f"Pickup in DB: {pickup_row}")
    assert pickup_row[1] == "APPROVED", "Status should be APPROVED"
    assert pickup_row[2] == 0, "NGO acceptance must be False"
    conn.close()

    # 8. Test Premature Collection Guard (TC3 verification)
    print("\n--- STEP 8: PREMATURE COLLECTION GUARD (TC3) ---")
    res = requests.post(f"{BASE_URL}/api/pickups/{pickup_id}/verify-completion")
    print(f"Premature collection attempt status: HTTP {res.status_code}")
    print(f"Response: {res.json()}")
    assert res.status_code == 400, "Backend should have blocked collection without NGO acceptance!"

    # 9. Independent Status Query Tool
    print("\n--- STEP 9: INDEPENDENT AGENT STATUS VERIFICATION TOOL ---")
    res = requests.get(f"{BASE_URL}/api/pickups/{pickup_id}/verify-status")
    print("Independent query status:", res.status_code)
    status_data = res.json()
    print("Tool retrieved state:", json.dumps(status_data["retrieved_state"], indent=2))

    # 10. Simulate NGO Acceptance
    print("\n--- STEP 10: SIMULATE NGO ACCEPTANCE (MOCK PLATFORM ACTOR) ---")
    res = requests.post(f"{BASE_URL}/api/pickups/{pickup_id}/accept", json={
        "accepted_by": "Driver David Morales (City Hope Rescue)",
        "expected_version": 1
    })
    print("Acceptance response:", res.status_code)
    accepted_pickup = res.json()
    print(f"Updated status: {accepted_pickup.get('status')}")
    print(f"Accepted by: {accepted_pickup.get('accepted_by')}")

    # 11. Verify Database After Acceptance
    print("\n--- STEP 11: VERIFY SQLITE AFTER NGO ACCEPTANCE ---")
    conn = sqlite3.connect("backend/foodbridge.db")
    c = conn.cursor()
    c.execute("SELECT status, accepted_by_ngo, accepted_at FROM pickup_requests WHERE id=?", (pickup_id,))
    row = c.fetchone()
    print(f"Database row: Status={row[0]}, AcceptedByNGO={row[1]}, Timestamp={row[2]}")
    assert row[0] == "ACCEPTED_BY_NGO", "Database status must be ACCEPTED_BY_NGO"
    assert row[1] == 1, "accepted_by_ngo must be 1"

    c.execute("SELECT event_type, source, details FROM audit_events WHERE event_type='MOCK_NGO_ACCEPTED' ORDER BY timestamp DESC LIMIT 1")
    audit_row = c.fetchone()
    if audit_row:
        print(f"Audit log recorded: {audit_row[0]} by {audit_row[1]}: {audit_row[2]}")
    conn.close()

    # 12. Verify Collection Completion
    print("\n--- STEP 12: VERIFY PHYSICAL COLLECTION ---")
    res = requests.post(f"{BASE_URL}/api/pickups/{pickup_id}/verify-completion")
    print("Completion response:", res.status_code)
    completed_pickup = res.json()
    print(f"Final status: {completed_pickup.get('status')}")

    # 13. Final Independent Status Query Tool Check
    print("\n--- STEP 13: FINAL INDEPENDENT TOOL STATUS VERIFICATION ---")
    res = requests.get(f"{BASE_URL}/api/pickups/{pickup_id}/verify-status")
    final_query = res.json()
    print("Final verified state:", json.dumps(final_query["retrieved_state"], indent=2))
    assert final_query["retrieved_state"]["status"] == "VERIFIED_COMPLETE"

    print("\n==================================================")
    print("SUCCESS: 100% OF END-TO-END WORKFLOW VERIFIED LIVE!")
    print("==================================================")

if __name__ == "__main__":
    run_verification()
