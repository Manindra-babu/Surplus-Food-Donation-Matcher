import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from system env, root .env, or backend/.env
load_dotenv()
root_env = Path(__file__).resolve().parent.parent / ".env"
backend_env = Path(__file__).resolve().parent / ".env"
if root_env.exists():
    load_dotenv(dotenv_path=root_env, override=False)
if backend_env.exists():
    load_dotenv(dotenv_path=backend_env, override=False)

# Product Branding
PRODUCT_NAME = os.getenv("PRODUCT_NAME", "FoodBridge AI")
PRODUCT_TAGLINE = "AI-Powered Surplus Food Donation & Rescue Coordination Platform"
ORGANIZATION_NAME = "FoodBridge Rescue Coordination Network"
IS_MOCK_ENVIRONMENT = True

# Security & API Keys
# Note: GEMINI_API_KEY must be stored in environment variables, never sent to frontend.
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# Food Safety Policy Standards
# Regulatory References:
# 1. FDA Food Code §3-501.19: Time as a Public Health Control (TPHC)
#    - Up to 4 hours maximum elapsed time for ready-to-eat TCS food held without continuous temperature control.
# 2. FDA Food Code §3-501.16: Holding Temperatures for TCS Food
#    - Hot holding threshold: 135°F (57.2°C) or above.
#    - Cold holding threshold: 41°F (5.0°C) or below.
# Note: Holding temperature represents a point-of-donation recorded kitchen measurement, not continuous IoT telemetry.
FOOD_SAFETY_RULES = {
    "policy_name": "Food Rescue Time & Temperature Safety Standard",
    "policy_source": "FDA Food Code §3-501.19 (Time Control) & §3-501.16 (Holding Temp)",
    "tphc_max_elapsed_minutes": 240,             # 4 hours max under §3-501.19 for ambient/uncontrolled holding
    "max_elapsed_ambient_minutes": 240,          # 4 hours max threshold without continuous temperature control
    "max_elapsed_refrigerated_minutes": 1440,    # 24 hours for chilled meals logged at <= 5.0°C (§3-501.16)
    "min_hot_holding_celsius": 57.2,             # 135°F FDA §3-501.16(A)(1)
    "max_cold_holding_celsius": 5.0,             # 41°F FDA §3-501.16(A)(2)
    "minimum_safe_window_remaining_minutes": 30, # Minimum operational dispatch lead time
    "continuous_monitoring_claimed": False,       # Temperature is point-in-time logged, not continuous IoT
    "required_evidence_fields": ["prepared_at", "storage_temp_celsius", "packaging_sealed"]
}

# Supported Food Categories
FOOD_CATEGORIES = [
    "hot_prepared_meals",
    "cold_prepared_meals",
    "bakery_breads",
    "packaged_pantry",
    "fresh_produce",
    "dairy_refrigerated"
]
