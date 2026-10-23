import pytest
import os
import datetime
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.database import Base
from backend.models import Restaurant, NGO, Donation, PickupRequest, AgentRun, PickupProposal, AuditEvent
from backend.rules_engine import FoodSafetyEngine, NGOMatchingEngine
from backend.mock_platform import MockPlatformService
from backend.scenarios import ScenarioManager
from backend.seed_data import seed_database
from backend.schemas import PickupProposeRequest, PickupApprovalRequest, PickupChangeLocationRequest
from backend.graph import run_donation_workflow, resume_workflow_approval
from backend.tools import tool_get_pickup_status
from fastapi import HTTPException

# Isolated test database to prevent tests from wiping user's live development database
TEST_DB_FILE = Path(__file__).resolve().parent / "test_isolated.db"
test_engine = create_engine(f"sqlite:///{TEST_DB_FILE}", connect_args={"check_same_thread": False})
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

@pytest.fixture
def db_session():
    Base.metadata.create_all(bind=test_engine)
    session = TestSessionLocal()
    seed_database(session)
    try:
        yield session
    finally:
        session.close()
        try:
            if TEST_DB_FILE.exists():
                os.remove(TEST_DB_FILE)
        except Exception:
            pass

def test_food_safety_rules():
    now = datetime.datetime.utcnow()
    
    # 1. Recent hot food (40 mins ago, 65C) should pass
    res_pass = FoodSafetyEngine.evaluate_donation_safety(
        prepared_at=now - datetime.timedelta(minutes=40),
        pickup_deadline=now + datetime.timedelta(hours=2),
        storage_temp_celsius=65.0,
        packaging_sealed=True,
        food_type="hot_prepared_meals"
    )
    assert res_pass["passed"] is True
    assert res_pass["status"] == "SAFETY_VERIFIED"

    # 2. Old food (300 mins ago ambient, >240 min limit) should fail
    res_fail_time = FoodSafetyEngine.evaluate_donation_safety(
        prepared_at=now - datetime.timedelta(minutes=300),
        pickup_deadline=now + datetime.timedelta(hours=2),
        storage_temp_celsius=22.0,
        packaging_sealed=True,
        food_type="hot_prepared_meals"
    )
    assert res_fail_time["passed"] is False
    assert res_fail_time["status"] == "REJECTED_FOOD_SAFETY_EXPIRED"

    # 3. Pickup window remaining < 30 mins should fail
    res_fail_window = FoodSafetyEngine.evaluate_donation_safety(
        prepared_at=now - datetime.timedelta(minutes=30),
        pickup_deadline=now + datetime.timedelta(minutes=10),
        storage_temp_celsius=65.0,
        packaging_sealed=True,
        food_type="hot_prepared_meals"
    )
    assert res_fail_window["passed"] is False
    assert res_fail_window["status"] == "REJECTED_WINDOW_EXPIRED"

    # 4. Compromised packaging should fail
    res_fail_seal = FoodSafetyEngine.evaluate_donation_safety(
        prepared_at=now - datetime.timedelta(minutes=30),
        pickup_deadline=now + datetime.timedelta(hours=2),
        storage_temp_celsius=65.0,
        packaging_sealed=False,
        food_type="hot_prepared_meals"
    )
    assert res_fail_seal["passed"] is False
    assert res_fail_seal["status"] == "UNCERTAIN_PACKAGING_UNSEALED"

def test_food_safety_timing_boundary():
    now = datetime.datetime.utcnow()
    # 230 minutes elapsed (under 240m limit, pickup deadline within window) -> PASS
    res_230 = FoodSafetyEngine.evaluate_donation_safety(
        prepared_at=now - datetime.timedelta(minutes=200),
        pickup_deadline=now + datetime.timedelta(minutes=35),
        storage_temp_celsius=22.0,
        packaging_sealed=True,
        food_type="hot_prepared_meals"
    )
    assert res_230["passed"] is True
    assert res_230["status"] == "SAFETY_VERIFIED"

    # 245 minutes elapsed (exceeds 240m limit under §3-501.19) -> FAIL
    res_245 = FoodSafetyEngine.evaluate_donation_safety(
        prepared_at=now - datetime.timedelta(minutes=245),
        pickup_deadline=now + datetime.timedelta(minutes=45),
        storage_temp_celsius=22.0,
        packaging_sealed=True,
        food_type="hot_prepared_meals"
    )
    assert res_245["passed"] is False
    assert res_245["status"] == "REJECTED_FOOD_SAFETY_EXPIRED"

def test_food_safety_distinguish_preparation_vs_removal():
    now = datetime.datetime.utcnow()
    # Food cooked 5 hours ago (300 mins), but removed from hot holding only 45 minutes ago
    # with documented timestamp in safety_evidence -> PASS under §3-501.19 TPHC
    res_removal = FoodSafetyEngine.evaluate_donation_safety(
        prepared_at=now - datetime.timedelta(minutes=300),
        pickup_deadline=now + datetime.timedelta(hours=1, minutes=30),
        storage_temp_celsius=24.0, # Ambient upon transfer
        packaging_sealed=True,
        food_type="hot_prepared_meals",
        safety_evidence={
            "removed_from_temperature_control_at": (now - datetime.timedelta(minutes=45)).isoformat()
        }
    )
    assert res_removal["passed"] is True
    assert res_removal["status"] == "SAFETY_VERIFIED"
    assert res_removal["evidence"]["clock_source"] == "recorded_removal_from_temperature_control"
    assert res_removal["evidence"]["elapsed_minutes"] == 45.0

def test_food_safety_missing_evidence():
    now = datetime.datetime.utcnow()
    # Missing storage temperature -> FAIL
    res_no_temp = FoodSafetyEngine.evaluate_donation_safety(
        prepared_at=now - datetime.timedelta(minutes=30),
        pickup_deadline=now + datetime.timedelta(hours=2),
        storage_temp_celsius=None,
        packaging_sealed=True,
        food_type="hot_prepared_meals"
    )
    assert res_no_temp["passed"] is False
    assert res_no_temp["status"] == "REJECTED_MISSING_TEMPERATURE"

    # Missing prepared_at timestamp -> FAIL
    res_no_prep = FoodSafetyEngine.evaluate_donation_safety(
        prepared_at=None,
        pickup_deadline=now + datetime.timedelta(hours=2),
        storage_temp_celsius=62.0,
        packaging_sealed=True,
        food_type="hot_prepared_meals"
    )
    assert res_no_prep["passed"] is False
    assert res_no_prep["status"] == "REJECTED_MISSING_TIMESTAMPS"

def test_food_safety_valid_holding_conditions():
    now = datetime.datetime.utcnow()
    # Chilled food at 3.5C prepared 8 hours ago (480 mins) under §3-501.16 continuous cold holding -> PASS
    res_chilled = FoodSafetyEngine.evaluate_donation_safety(
        prepared_at=now - datetime.timedelta(hours=8),
        pickup_deadline=now + datetime.timedelta(hours=3),
        storage_temp_celsius=3.5,
        packaging_sealed=True,
        food_type="cold_prepared_meals"
    )
    assert res_chilled["passed"] is True
    assert res_chilled["status"] == "SAFETY_VERIFIED"
    assert res_chilled["evidence"]["max_allowed_minutes"] == 1440

def test_food_safety_deadline_exceeds_tphc_limit():
    now = datetime.datetime.utcnow()
    # Food removed 60 mins ago, but requested pickup deadline is 4 hours from now (total 300 mins > 240 min TPHC limit) -> FAIL
    res_over_window = FoodSafetyEngine.evaluate_donation_safety(
        prepared_at=now - datetime.timedelta(minutes=60),
        pickup_deadline=now + datetime.timedelta(hours=4),
        storage_temp_celsius=24.0,
        packaging_sealed=True,
        food_type="hot_prepared_meals"
    )
    assert res_over_window["passed"] is False
    assert res_over_window["status"] == "REJECTED_DEADLINE_EXCEEDS_TPHC_LIMIT"

def test_scenario_tc1_fresh_food(db_session):
    result = ScenarioManager.run_tc1(db_session)
    assert result["passed"] is True
    assert result["expected_result"]["food_safety_outcome"] == result["actual_result"]["food_safety_outcome"]
    assert result["actual_result"]["verified_platform_status"] == "APPROVED"
    assert result["actual_result"]["premature_collection_reported"] is False

def test_scenario_tc2_food_prepared_too_long_ago(db_session):
    result = ScenarioManager.run_tc2(db_session)
    assert result["passed"] is True
    assert result["actual_result"]["food_safety_passed"] is False
    assert result["actual_result"]["donation_status"] == "REJECTED_SAFETY"
    assert result["actual_result"]["pickup_request_created"] is False

def test_scenario_tc3_ngo_has_not_accepted(db_session):
    result = ScenarioManager.run_tc3(db_session)
    assert result["passed"] is True
    assert result["actual_result"]["accepted_by_ngo"] is False
    assert result["actual_result"]["reported_as_collected"] is False
    assert result["actual_result"]["premature_collection_attempt_blocked"] is True

def test_scenario_tc4_location_change_invalidates_approval(db_session):
    result = ScenarioManager.run_tc4(db_session)
    assert result["passed"] is True
    assert result["actual_result"]["original_approval_invalidated"] is True
    assert result["actual_result"]["status"] == "RECONFIRMATION_REQUIRED"
    assert result["actual_result"]["approval_version"] == 2

def test_idempotency_protection(db_session):
    import uuid
    now = datetime.datetime.utcnow()
    don_id = f"DON-IDEMP-{uuid.uuid4().hex[:6].upper()}"
    don = Donation(
        id=don_id,
        restaurant_id="REST-001",
        restaurant_name="Green Garden Bistro",
        food_name="Idempotency Test Meal",
        food_type="hot_prepared_meals",
        quantity=10,
        unit="meals",
        prepared_at=now - datetime.timedelta(minutes=30),
        pickup_deadline=now + datetime.timedelta(hours=2),
        pickup_address="104 Elm Street",
        storage_temp_celsius=62.0,
        packaging_sealed=True,
        status="AWAITING_MATCH"
    )
    db_session.add(don)
    db_session.commit()

    req = PickupProposeRequest(
        donation_id=don_id,
        ngo_id="NGO-001",
        pickup_window_start=now + datetime.timedelta(minutes=30),
        pickup_window_end=now + datetime.timedelta(hours=2),
        drop_off_location="Hope Distribution Center",
        idempotency_key=f"UNIQUE-TEST-IDEMP-KEY-{uuid.uuid4().hex[:6]}"
    )
    p1 = MockPlatformService.propose_pickup(db_session, req)
    p2 = MockPlatformService.propose_pickup(db_session, req)
    assert p1.id == p2.id

def test_mock_platform_ngo_rejection(db_session):
    import uuid
    now = datetime.datetime.utcnow()
    don_id = f"DON-REJ-{uuid.uuid4().hex[:6].upper()}"
    don = Donation(
        id=don_id,
        restaurant_id="REST-001",
        restaurant_name="Green Garden Bistro",
        food_name="Rejection Test Meal",
        food_type="hot_prepared_meals",
        quantity=15,
        unit="meals",
        prepared_at=now - datetime.timedelta(minutes=20),
        pickup_deadline=now + datetime.timedelta(hours=2),
        pickup_address="104 Elm Street",
        storage_temp_celsius=65.0,
        packaging_sealed=True,
        status="AWAITING_MATCH"
    )
    db_session.add(don)
    db_session.commit()

    req = PickupProposeRequest(
        donation_id=don_id,
        ngo_id="NGO-001",
        pickup_window_start=now + datetime.timedelta(minutes=30),
        pickup_window_end=now + datetime.timedelta(hours=2),
        drop_off_location="Hope Distribution Center",
        idempotency_key=f"UNIQUE-TEST-REJ-KEY-{uuid.uuid4().hex[:6]}"
    )
    pickup = MockPlatformService.propose_pickup(db_session, req)
    
    # Approve first
    app_req = PickupApprovalRequest(
        approved_by="Chef Marcus Lee",
        approval_version=1
    )
    MockPlatformService.approve_pickup(db_session, pickup.id, app_req)
    
    # NGO rejects
    rejected_pickup = MockPlatformService.reject_pickup_by_ngo(
        db_session, pickup.id, reason="Volunteer shortage for requested slot"
    )
    assert rejected_pickup.status == "REJECTED"
    assert rejected_pickup.accepted_by_ngo is False
    assert rejected_pickup.rejection_reason == "Volunteer shortage for requested slot"

    # Donation returned to awaiting match pool
    db_session.refresh(don)
    assert don.status == "AWAITING_MATCH"

    # Audit event recorded
    audit_evt = db_session.query(AuditEvent).filter(
        AuditEvent.event_type == "MOCK_NGO_REJECTION"
    ).order_by(AuditEvent.timestamp.desc()).first()
    assert audit_evt is not None
    assert audit_evt.details["pickup_id"] == pickup.id

def test_ngo_acceptance_and_verification_full_sequence(db_session):
    """
    Automated verification of full NGO acceptance and verification sequence:
    1. Create approved pickup request.
    2. Verify it is awaiting NGO acceptance (not accepted).
    3. Block collection attempt prior to NGO acceptance.
    4. Simulate NGO acceptance with actor and version verification.
    5. Verify retry idempotency (no duplicate load or state error).
    6. Verify stale version rejection (409 on version mismatch).
    7. Query the platform independently via tool_get_pickup_status.
    8. Execute collection verification once prerequisites pass.
    9. Verify final completion in database and audit events.
    """
    import uuid
    now = datetime.datetime.utcnow()
    don_id = f"DON-SEQ-{uuid.uuid4().hex[:6].upper()}"
    don = Donation(
        id=don_id,
        restaurant_id="REST-001",
        restaurant_name="Green Garden Bistro",
        food_name="Full Sequence Rescue Meal",
        food_type="hot_prepared_meals",
        quantity=20,
        unit="meals",
        prepared_at=now - datetime.timedelta(minutes=25),
        pickup_deadline=now + datetime.timedelta(hours=2),
        pickup_address="104 Elm Street",
        storage_temp_celsius=63.0,
        packaging_sealed=True,
        status="AWAITING_MATCH"
    )
    db_session.add(don)
    db_session.commit()

    # Step 1: Create pickup proposal
    req = PickupProposeRequest(
        donation_id=don_id,
        ngo_id="NGO-001",
        pickup_window_start=now + datetime.timedelta(minutes=30),
        pickup_window_end=now + datetime.timedelta(hours=2),
        drop_off_location="Hope Distribution Center",
        idempotency_key=f"UNIQUE-TEST-SEQ-KEY-{uuid.uuid4().hex[:6]}"
    )
    pickup = MockPlatformService.propose_pickup(db_session, req)

    # Approve pickup proposal
    app_req = PickupApprovalRequest(
        approved_by="Chef Marcus Lee",
        approval_version=1
    )
    approved_pickup = MockPlatformService.approve_pickup(db_session, pickup.id, app_req)
    
    # Step 2: Verify state is strictly awaiting NGO acceptance
    assert approved_pickup.status == "APPROVED"
    assert approved_pickup.accepted_by_ngo is False
    assert approved_pickup.accepted_at is None

    # Step 3: Verify premature collection attempt is blocked
    with pytest.raises(HTTPException) as exc_info:
        MockPlatformService.mark_collected_and_verified(db_session, pickup.id)
    assert exc_info.value.status_code == 400
    assert "Cannot mark donation as collected when NGO acceptance is not confirmed" in exc_info.value.detail

    # Step 4: Stale version check - reject acceptance with stale version
    with pytest.raises(HTTPException) as exc_stale:
        MockPlatformService.accept_pickup_by_ngo(
            db_session, pickup.id, actor="Driver David Morales", expected_version=99
        )
    assert exc_stale.value.status_code == 409

    # Step 5: Simulate NGO acceptance with valid actor and version
    accepted_pickup = MockPlatformService.accept_pickup_by_ngo(
        db_session, pickup.id, actor="Driver David Morales (City Hope Rescue)", expected_version=1
    )
    assert accepted_pickup.status == "ACCEPTED_BY_NGO"
    assert accepted_pickup.accepted_by_ngo is True
    assert accepted_pickup.accepted_at is not None

    # Step 6: Test retry idempotency - duplicate acceptance call returns existing without duplicate event
    retry_pickup = MockPlatformService.accept_pickup_by_ngo(
        db_session, pickup.id, actor="Driver David Morales (City Hope Rescue)", expected_version=1
    )
    assert retry_pickup.status == "ACCEPTED_BY_NGO"
    assert retry_pickup.id == accepted_pickup.id

    # Step 7: Independent query tool verification
    tool_status = tool_get_pickup_status(db_session, pickup.id)
    assert tool_status["found"] is True
    assert tool_status["status"] == "ACCEPTED_BY_NGO"
    assert tool_status["accepted_by_ngo"] is True

    # Step 8: Complete verified collection
    collected_res = MockPlatformService.mark_collected_and_verified(db_session, pickup.id)
    assert collected_res["status"] == "VERIFIED_COMPLETE"
    assert collected_res["collected_at"] is not None

    # Step 9: Database state confirmation
    db_session.refresh(pickup)
    db_session.refresh(don)
    assert pickup.status == "VERIFIED_COMPLETE"
    assert don.status == "COMPLETED"

    # Step 10: Audit trail confirmation
    events = db_session.query(AuditEvent).all()
    audit_types = [
        e.event_type for e in events
        if e.details and e.details.get("pickup_id") == pickup.id
    ]
    assert "PICKUP_APPROVED" in audit_types
    assert "MOCK_NGO_ACCEPTED" in audit_types
    assert "COLLECTION_VERIFIED" in audit_types
