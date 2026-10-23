import datetime
from typing import Dict, Any, List, Tuple, Optional
from .config import FOOD_SAFETY_RULES, FOOD_CATEGORIES

class FoodSafetyEngine:
    """
    Deterministic food-safety validator implementing:
    - Time-as-a-Public-Health-Control (FDA Food Code §3-501.19 / Codex Alimentarius CAC/RCP 39-1993)
    - Storage temperature check (refrigerated vs ambient)
    - Preparation recency check
    - Packaging seal integrity check
    - Pickup window remaining margin check
    """

    @classmethod
    def evaluate_donation_safety(
        cls,
        prepared_at: Optional[datetime.datetime],
        pickup_deadline: Optional[datetime.datetime],
        storage_temp_celsius: Optional[float],
        packaging_sealed: bool,
        food_type: str,
        safety_evidence: Optional[Dict[str, Any]] = None,
        reference_time: Optional[datetime.datetime] = None
    ) -> Dict[str, Any]:
        now = reference_time or datetime.datetime.utcnow()
        if now.tzinfo is not None:
            now = now.astimezone(datetime.timezone.utc).replace(tzinfo=None)
            
        # Check 1: Missing timestamps
        if not prepared_at or not pickup_deadline:
            return {
                "passed": False,
                "status": "REJECTED_MISSING_TIMESTAMPS",
                "reason": "Missing required preparation timestamp or pickup deadline.",
                "policy_reference": FOOD_SAFETY_RULES["policy_source"],
                "elapsed_minutes": 0,
                "max_allowed_minutes": 0,
                "evidence": {
                    "prepared_at": str(prepared_at),
                    "pickup_deadline": str(pickup_deadline),
                    "evaluated_at": now.isoformat()
                }
            }

        # Check 2: Missing temperature measurement
        if storage_temp_celsius is None:
            return {
                "passed": False,
                "status": "REJECTED_MISSING_TEMPERATURE",
                "reason": "Missing required storage temperature measurement. Food safety eligibility cannot be verified without recorded temperature.",
                "policy_reference": FOOD_SAFETY_RULES["policy_source"],
                "elapsed_minutes": 0,
                "max_allowed_minutes": 0,
                "evidence": {
                    "issue": "Missing storage_temp_celsius measurement",
                    "evaluated_at": now.isoformat()
                }
            }

        if prepared_at.tzinfo is not None:
            prepared_at = prepared_at.astimezone(datetime.timezone.utc).replace(tzinfo=None)
        if pickup_deadline.tzinfo is not None:
            pickup_deadline = pickup_deadline.astimezone(datetime.timezone.utc).replace(tzinfo=None)

        # Check 3: Extraction of removal from temperature control timestamp (§3-501.19)
        removed_at = None
        if safety_evidence and isinstance(safety_evidence, dict):
            raw_rem = safety_evidence.get("removed_from_temperature_control_at") or safety_evidence.get("time_removed_from_temp_control")
            if raw_rem:
                if isinstance(raw_rem, str):
                    try:
                        removed_at = datetime.datetime.fromisoformat(raw_rem)
                    except Exception:
                        pass
                elif isinstance(raw_rem, datetime.datetime):
                    removed_at = raw_rem
                if removed_at and removed_at.tzinfo is not None:
                    removed_at = removed_at.astimezone(datetime.timezone.utc).replace(tzinfo=None)

        # Distinguish active temperature holding (§3-501.16) vs Time as a Public Health Control (§3-501.19)
        # Point-in-time logged storage temperature is recorded upon intake (continuous IoT telemetry not claimed)
        is_refrigerated = storage_temp_celsius <= FOOD_SAFETY_RULES.get("max_cold_holding_celsius", 5.0)
        is_hot_held = storage_temp_celsius >= FOOD_SAFETY_RULES.get("min_hot_holding_celsius", 57.2)

        # Under FDA Food Code §3-501.19, the 4-hour clock begins when food is removed from temperature control.
        # If removal time is explicitly provided in safety_evidence, use it as clock start.
        # Otherwise, use preparation timestamp as the conservative upper-bound proxy.
        if removed_at:
            tphc_clock_start = removed_at
            clock_source = "recorded_removal_from_temperature_control"
        else:
            tphc_clock_start = prepared_at
            clock_source = "preparation_timestamp_conservative_proxy"

        # Check for future timestamp
        if tphc_clock_start > now + datetime.timedelta(minutes=5):
            return {
                "passed": False,
                "status": "BLOCKED_INVALID_TIMESTAMP",
                "reason": f"{clock_source} is in the future relative to system clock.",
                "policy_reference": FOOD_SAFETY_RULES["policy_source"],
                "elapsed_minutes": 0,
                "max_allowed_minutes": 0,
                "evidence": {
                    "tphc_clock_start": tphc_clock_start.isoformat(),
                    "clock_source": clock_source,
                    "evaluated_at": now.isoformat()
                }
            }

        elapsed_minutes = (now - tphc_clock_start).total_seconds() / 60.0

        # Maximum allowed duration under applicable rule:
        # If refrigerated (<= 5.0°C), safe window is up to 24 hours (1440 mins) under §3-501.16
        # If ambient or hot-held food placed on TPHC, limit is strictly 240 mins (4 hours) under §3-501.19
        max_allowed_minutes = (
            FOOD_SAFETY_RULES["max_elapsed_refrigerated_minutes"]
            if is_refrigerated
            else FOOD_SAFETY_RULES["max_elapsed_ambient_minutes"]
        )

        tphc_discard_deadline = tphc_clock_start + datetime.timedelta(minutes=max_allowed_minutes)

        # Check 4: Time elapsed since removal from temperature control / preparation
        if elapsed_minutes > max_allowed_minutes:
            return {
                "passed": False,
                "status": "REJECTED_FOOD_SAFETY_EXPIRED",
                "reason": (
                    f"Elapsed time of {elapsed_minutes:.1f} minutes exceeds the statutory threshold of "
                    f"{max_allowed_minutes} minutes for {'refrigerated' if is_refrigerated else 'ambient/TPHC'} holding."
                ),
                "policy_reference": FOOD_SAFETY_RULES["policy_source"],
                "elapsed_minutes": round(elapsed_minutes, 1),
                "max_allowed_minutes": max_allowed_minutes,
                "evidence": {
                    "clock_start": tphc_clock_start.isoformat(),
                    "clock_source": clock_source,
                    "elapsed_minutes": round(elapsed_minutes, 1),
                    "max_allowed_minutes": max_allowed_minutes,
                    "storage_temp_celsius": storage_temp_celsius,
                    "is_refrigerated": is_refrigerated,
                    "exceeded_by_minutes": round(elapsed_minutes - max_allowed_minutes, 1)
                }
            }

        # Check 5: FDA §3-501.19(B)(2) Mandatory 4-hour discard boundary
        # If food is not continuously refrigerated, pickup deadline cannot extend past the 4-hour discard threshold
        if not is_refrigerated and pickup_deadline > tphc_discard_deadline + datetime.timedelta(minutes=1):
            return {
                "passed": False,
                "status": "REJECTED_DEADLINE_EXCEEDS_TPHC_LIMIT",
                "reason": (
                    f"Pickup deadline ({pickup_deadline.strftime('%H:%M')}) extends past the mandatory 4-hour "
                    f"discard limit ({tphc_discard_deadline.strftime('%H:%M')}) under FDA Food Code §3-501.19(B)(2)."
                ),
                "policy_reference": "FDA Food Code §3-501.19(B)(2) (Mandatory 4-hour Discard Time)",
                "elapsed_minutes": round(elapsed_minutes, 1),
                "max_allowed_minutes": max_allowed_minutes,
                "evidence": {
                    "tphc_clock_start": tphc_clock_start.isoformat(),
                    "clock_source": clock_source,
                    "elapsed_minutes": round(elapsed_minutes, 1),
                    "max_allowed_minutes": max_allowed_minutes,
                    "tphc_discard_deadline": tphc_discard_deadline.isoformat(),
                    "pickup_deadline": pickup_deadline.isoformat(),
                    "excess_minutes": round((pickup_deadline - tphc_discard_deadline).total_seconds() / 60.0, 1)
                }
            }

        # Check 6: Minimum safe collection window remaining
        remaining_pickup_minutes = (pickup_deadline - now).total_seconds() / 60.0
        min_lead = FOOD_SAFETY_RULES["minimum_safe_window_remaining_minutes"]
        if remaining_pickup_minutes < min_lead:
            return {
                "passed": False,
                "status": "REJECTED_WINDOW_EXPIRED",
                "reason": (
                    f"Only {remaining_pickup_minutes:.1f} minutes remain before pickup deadline ({pickup_deadline.isoformat()}). "
                    f"Minimum rescue dispatch requirement is {min_lead} minutes."
                ),
                "policy_reference": FOOD_SAFETY_RULES["policy_source"],
                "elapsed_minutes": round(elapsed_minutes, 1),
                "max_allowed_minutes": max_allowed_minutes,
                "evidence": {
                    "pickup_deadline": pickup_deadline.isoformat(),
                    "remaining_minutes": round(remaining_pickup_minutes, 1),
                    "min_required_lead_minutes": min_lead
                }
            }

        # Check 7: Packaging integrity
        if not packaging_sealed:
            return {
                "passed": False,
                "status": "UNCERTAIN_PACKAGING_UNSEALED",
                "reason": "Food packaging is unsealed or compromised. Mandatory food safety protocol requires intact tamper-evident containment.",
                "policy_reference": FOOD_SAFETY_RULES["policy_source"],
                "elapsed_minutes": round(elapsed_minutes, 1),
                "max_allowed_minutes": max_allowed_minutes,
                "evidence": {
                    "packaging_sealed": False,
                    "risk": "Potential airborne cross-contamination during transit"
                }
            }

        # Food passed all safety checks
        return {
            "passed": True,
            "status": "SAFETY_VERIFIED",
            "reason": (
                f"Food meets safety constraints. Elapsed time is {elapsed_minutes:.1f}m (limit: {max_allowed_minutes}m, "
                f"basis: {clock_source}). Point-of-intake temp: {storage_temp_celsius}°C. "
                f"{remaining_pickup_minutes:.1f}m remaining for pickup."
            ),
            "policy_reference": FOOD_SAFETY_RULES["policy_source"],
            "elapsed_minutes": round(elapsed_minutes, 1),
            "max_allowed_minutes": max_allowed_minutes,
            "evidence": {
                "clock_start": tphc_clock_start.isoformat(),
                "clock_source": clock_source,
                "elapsed_minutes": round(elapsed_minutes, 1),
                "max_allowed_minutes": max_allowed_minutes,
                "storage_temp_celsius": storage_temp_celsius,
                "packaging_sealed": packaging_sealed,
                "remaining_pickup_minutes": round(remaining_pickup_minutes, 1),
                "tphc_discard_deadline": tphc_discard_deadline.isoformat(),
                "regulatory_citations": {
                    "tphc_rule": "FDA Food Code §3-501.19 (Time as a Public Health Control)",
                    "temp_holding_standard": "FDA Food Code §3-501.16 (Holding Temperatures for TCS Food)"
                },
                "compliance_note": "Temperature recorded at donation intake; continuous IoT sensor telemetry is not claimed.",
                "disclaimer": "Demonstration protocol. Not a universal legal certification. Verify with local health authority."
            }
        }


class NGOMatchingEngine:
    """
    Evaluates candidate NGOs against hard eligibility constraints and scores eligible candidates:
    Hard Constraints:
    1. Operational Status (Must be ONLINE & Active)
    2. Capacity Check (available capacity >= donation quantity)
    3. Food Type Compatibility (NGO must accept this food type)
    4. Distance / Collection Radius Constraint
    5. Pickup Window Compatibility
    """

    @classmethod
    def evaluate_ngo_eligibility(
        cls,
        ngo_dict: Dict[str, Any],
        donation_quantity: int,
        donation_food_type: str,
        pickup_start: datetime.datetime,
        pickup_end: datetime.datetime,
        estimated_distance_km: float = 4.5
    ) -> Tuple[bool, List[Dict[str, Any]], List[str], float]:
        constraints = []
        exclusion_reasons = []

        # 1. Active & Status check
        is_active = ngo_dict.get("is_active", True)
        status = ngo_dict.get("status", "ONLINE")
        status_passed = is_active and status == "ONLINE"
        constraints.append({
            "name": "operational_status_check",
            "passed": status_passed,
            "details": f"NGO status is {status} (active={is_active})"
        })
        if not status_passed:
            exclusion_reasons.append(f"NGO is currently {status} and unable to accept new rescue dispatches.")

        # 2. Capacity check
        max_cap = ngo_dict.get("max_capacity_meals", 0)
        curr_load = ngo_dict.get("current_load_meals", 0)
        available_cap = max(0, max_cap - curr_load)
        cap_passed = available_cap >= donation_quantity
        constraints.append({
            "name": "intake_capacity_check",
            "passed": cap_passed,
            "details": f"Available capacity: {available_cap} meals, required: {donation_quantity} meals (max: {max_cap}, load: {curr_load})"
        })
        if not cap_passed:
            exclusion_reasons.append(
                f"Insufficient capacity: NGO has {available_cap} meals available, but donation requires {donation_quantity}."
            )

        # 3. Food Type Compatibility check
        accepted_types = ngo_dict.get("accepted_food_types", [])
        type_passed = donation_food_type in accepted_types or "all" in accepted_types
        constraints.append({
            "name": "food_type_compatibility_check",
            "passed": type_passed,
            "details": f"Donation type '{donation_food_type}' in accepted types {accepted_types}"
        })
        if not type_passed:
            exclusion_reasons.append(
                f"Incompatible food type: NGO does not handle '{donation_food_type}' (handles: {', '.join(accepted_types)})."
            )

        # 4. Service Radius check
        radius_km = ngo_dict.get("pickup_radius_km", 15.0)
        dist_passed = estimated_distance_km <= radius_km
        constraints.append({
            "name": "service_radius_check",
            "passed": dist_passed,
            "details": f"Distance {estimated_distance_km:.1f}km within NGO service radius {radius_km:.1f}km"
        })
        if not dist_passed:
            exclusion_reasons.append(
                f"Location outside service radius: {estimated_distance_km:.1f}km exceeds NGO limit of {radius_km:.1f}km."
            )

        # 5. Timing constraint check
        duration_hours = (pickup_end - pickup_start).total_seconds() / 3600.0
        time_passed = duration_hours >= 0.5  # At least 30 min window for NGO coordination
        constraints.append({
            "name": "pickup_window_feasibility_check",
            "passed": time_passed,
            "details": f"Pickup window span is {duration_hours:.2f}h (minimum required 0.5h)"
        })
        if not time_passed:
            exclusion_reasons.append(f"Pickup window duration ({duration_hours:.2f}h) is too short for safe NGO dispatch.")

        is_eligible = (
            status_passed and cap_passed and type_passed and dist_passed and time_passed
        )

        # Multi-factor ranking score for eligible candidates
        # Weights: capacity headroom (40%), proximity (40%), baseline reliability (20%)
        score = 0.0
        if is_eligible:
            capacity_score = min(1.0, available_cap / max(1, donation_quantity * 2))
            distance_score = max(0.0, 1.0 - (estimated_distance_km / max(1.0, radius_km)))
            score = round((capacity_score * 40.0) + (distance_score * 40.0) + 20.0, 1)

        return is_eligible, constraints, exclusion_reasons, score
