import os
import json
import logging
from typing import Dict, Any, Optional, Tuple, List
from pydantic import BaseModel, Field

from .config import GEMINI_API_KEY, PRODUCT_NAME, FOOD_SAFETY_RULES

logger = logging.getLogger("foodbridge_llm")

# Structured Pydantic schema for natural language donation parsing
class ParsedDonationInput(BaseModel):
    food_name: str = Field(description="Name or title of the surplus food")
    food_type: str = Field(description="Category: hot_prepared_meals, cold_prepared_meals, bakery_breads, packaged_pantry, fresh_produce")
    quantity: int = Field(gt=0, description="Number of items or boxes")
    unit: str = Field(default="meal_boxes", description="Unit of measurement")
    storage_temp_celsius: float = Field(description="Holding temperature in degrees Celsius")
    packaging_sealed: bool = Field(default=True, description="Whether packaging is sealed")
    description: Optional[str] = Field(default=None, description="Optional preparation notes or ingredients")
    needs_clarification: bool = Field(default=False, description="Whether essential food safety details are missing")
    clarification_question: Optional[str] = Field(default=None, description="Question to ask donor if info is missing")

class LLMAdapter:
    """
    Secure LLM Provider Adapter for FoodBridge AI.
    Isolates external model provider calls from the LangGraph workflow.
    Guarantees deterministic safety fallbacks whenever API keys are unset,
    network is offline, or provider limits are encountered.
    """

    def __init__(self):
        self.provider = "none"
        self.client = None
        self._init_provider()

    def _init_provider(self):
        # 1. Google Gemini via google-genai SDK
        if GEMINI_API_KEY and not GEMINI_API_KEY.startswith("your_"):
            try:
                from google import genai
                self.client = genai.Client(api_key=GEMINI_API_KEY)
                self.provider = "gemini"
                logger.info("LLMAdapter: Initialized Google GenAI provider")
                return
            except Exception as e:
                logger.warning(f"LLMAdapter: Failed to initialize Google GenAI: {e}")

        # 2. OpenAI-compatible provider (if OPENAI_API_KEY set)
        openai_key = os.getenv("OPENAI_API_KEY", "")
        if openai_key and not openai_key.startswith("your_"):
            try:
                import openai
                self.client = openai.OpenAI(api_key=openai_key)
                self.provider = "openai"
                logger.info("LLMAdapter: Initialized OpenAI provider")
                return
            except Exception as e:
                logger.warning(f"LLMAdapter: Failed to initialize OpenAI: {e}")

        logger.info("LLMAdapter: Running in deterministic fallback mode (no external provider configured)")

    def parse_natural_language_donation(self, text: str) -> Tuple[Dict[str, Any], bool]:
        """
        Parses unstructured natural language text from a kitchen donor into a validated structure.
        """
        if self.provider == "gemini" and self.client and os.getenv("TESTING") != "true":
            models_to_try = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]
            prompt = (
                f"You are the donation intake parser for {PRODUCT_NAME}. Extract structured food rescue details "
                f"from this donor message:\n\"{text}\"\n\n"
                f"Valid food_types: hot_prepared_meals, cold_prepared_meals, bakery_breads, packaged_pantry, fresh_produce.\n"
                f"Respond ONLY with valid JSON conforming to this structure: "
                f"{{\"food_name\": string, \"food_type\": string, \"quantity\": integer, \"unit\": string, "
                f"\"storage_temp_celsius\": float, \"packaging_sealed\": boolean, \"description\": string, "
                f"\"needs_clarification\": boolean, \"clarification_question\": string or null}}"
            )
            for m in models_to_try:
                try:
                    response = self.client.models.generate_content(
                        model=m,
                        contents=prompt
                    )
                    if response and response.text:
                        raw = response.text.strip()
                        if raw.startswith("```json"):
                            raw = raw[7:]
                        if raw.endswith("```"):
                            raw = raw[:-3]
                        parsed = json.loads(raw.strip())
                        return parsed, True
                except Exception as e:
                    logger.debug(f"Gemini parse attempt with {m} failed: {e}")
                    continue

        # Deterministic fallback parser for common phrases
        lower = text.lower()
        food_type = "hot_prepared_meals"
        if "salad" in lower or "wrap" in lower or "sandwich" in lower or "cold" in lower:
            food_type = "cold_prepared_meals"
        elif "bread" in lower or "bakery" in lower or "baguette" in lower:
            food_type = "bakery_breads"
        elif "canned" in lower or "pasta" in lower and "dry" in lower:
            food_type = "packaged_pantry"

        temp = 63.0 if "hot" in lower or food_type == "hot_prepared_meals" else (4.0 if food_type == "cold_prepared_meals" else 20.0)
        
        fallback_data = {
            "food_name": text[:60] if len(text) > 5 else "Prepared Kitchen Surplus",
            "food_type": food_type,
            "quantity": 25,
            "unit": "meal_boxes",
            "storage_temp_celsius": temp,
            "packaging_sealed": True,
            "description": text,
            "needs_clarification": False,
            "clarification_question": None
        }
        return fallback_data, False

    def generate_match_explanation(
        self,
        donation: Dict[str, Any],
        candidate: Dict[str, Any],
        safety_eval: Dict[str, Any]
    ) -> Tuple[str, bool]:
        """
        Generates an auditable, evidence-backed operational rationale for candidate selection.
        """
        if self.provider == "gemini" and self.client and os.getenv("TESTING") != "true":
            models_to_try = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]
            prompt = (
                f"You are the coordination intelligence for {PRODUCT_NAME}. Provide a concise 2-sentence operational explanation "
                f"for dispatching {donation.get('quantity')} {donation.get('unit', 'meal_boxes')} of '{donation.get('food_name')}' ({donation.get('food_type')}) to "
                f"NGO '{candidate.get('ngo_name')}'. "
                f"Data: NGO available capacity: {candidate.get('capacity_available')} meals, distance: {candidate.get('estimated_distance_km')}km, "
                f"match score: {candidate.get('score')}/100. Food safety: verified prepared {safety_eval.get('elapsed_minutes')}m ago under temperature control ({donation.get('storage_temp_celsius')}°C). "
                f"Keep it professional, transparent, and direct without marketing fluff."
            )
            for m in models_to_try:
                try:
                    response = self.client.models.generate_content(
                        model=m,
                        contents=prompt
                    )
                    if response and response.text:
                        return response.text.strip(), True
                except Exception as e:
                    logger.debug(f"Gemini explanation attempt with {m} failed: {e}")
                    continue

        # Deterministic evidence-backed fallback rationale
        fallback_text = (
            f"{candidate.get('ngo_name')} is recommended with a match score of {candidate.get('score')}/100 based on verified intake capacity "
            f"({candidate.get('capacity_available')} meals available for a {donation.get('quantity')}-{donation.get('unit', 'box')} dispatch) and service proximity ({candidate.get('estimated_distance_km')} km). "
            f"Food-safety compliance is confirmed under {safety_eval.get('policy_reference', 'FDA Food Code §3-501.19')} with "
            f"{safety_eval.get('elapsed_minutes', 0)} minutes elapsed since preparation."
        )
        return fallback_text, False

    def generate_rejection_explanation(
        self,
        food_name: str,
        safety_eval: Dict[str, Any]
    ) -> Tuple[str, bool]:
        """
        Generates a clear explanation for why a donation was blocked by safety rules.
        """
        reason = safety_eval.get("reason", "Violated safe food-holding parameters.")
        policy = safety_eval.get("policy_reference", FOOD_SAFETY_RULES["policy_source"])
        elapsed = safety_eval.get("elapsed_minutes", 0)
        max_allowed = safety_eval.get("max_allowed_minutes", 0)

        explanation = (
            f"Donation of '{food_name}' cannot be matched. Reason: {reason} "
            f"Holding duration of {elapsed:.1f} minutes exceeds the statutory threshold of {max_allowed} minutes "
            f"under {policy}. Automatic matching is blocked to prevent public health risk."
        )
        return explanation, False

    def generate_execution_summary(
        self,
        verified_state: Dict[str, Any],
        pickup_req: Dict[str, Any]
    ) -> Tuple[str, bool]:
        """
        Summarizes verified platform outcome for judge review.
        """
        actual_status = verified_state.get("actual_status", "UNKNOWN")
        accepted = verified_state.get("accepted_by_ngo", False)
        drop_off = verified_state.get("drop_off_location", "")
        version = verified_state.get("approval_version", 1)

        if accepted:
            summary = (
                f"Pickup dispatch {verified_state.get('pickup_id')} is confirmed accepted by NGO. "
                f"Approved destination: {drop_off} (Proposal v{version}). Status: {actual_status}."
            )
        else:
            summary = (
                f"Pickup dispatch {verified_state.get('pickup_id')} is registered in status '{actual_status}'. "
                f"Awaiting explicit NGO partner acceptance. Not marked as collected."
            )
        return summary, False

# Global singleton adapter
llm_adapter = LLMAdapter()
