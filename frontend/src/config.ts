// Central Configuration for FoodBridge AI
export const PRODUCT_NAME = "FoodBridge AI";
export const PRODUCT_TAGLINE = "Surplus Food Donation & Rescue Coordination Platform";
export const ORGANIZATION_NAME = "FoodBridge Rescue Coordination Network";
export const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || "/api";
export const IS_MOCK_ENVIRONMENT = true;

export const FOOD_SAFETY_STANDARDS = {
  policy: "FDA Food Code §3-501.19 & Codex Alimentarius CAC/RCP 39-1993",
  maxAmbientMinutes: 240, // 4 hours for hot/ambient held prepared meals
  maxRefrigeratedMinutes: 1440, // 24 hours for chilled prepared meals
  minLeadMinutes: 30, // Minimum dispatch notice
};
