# FoodBridge AI — AI-Powered Surplus Food Donation & Rescue Coordination Platform

**FoodBridge AI** is an intelligent, auditable food rescue coordination platform connecting commercial restaurant kitchens with verified NGOs capable of collecting surplus food safely and on time.

The system enforces evidence-backed food-safety policies (FDA Food Code §3-501.19 / Codex Alimentarius), NGO capacity constraints, strict human approval gating, location alteration invalidation, and independent status verification.

---

## Key Features

1. **Deterministic Food-Safety Engine**
   - Implements Time-as-a-Public-Health-Control (FDA Food Code §3-501.19) and Holding Temperatures (FDA Food Code §3-501.16).
   - Strict 240-minute maximum elapsed duration for ambient or uncontrolled holding.
   - Hot holding threshold: 135°F (57.2°C) or above; Cold holding threshold: 41°F (5.0°C) or below (logged as point-of-intake measurement; continuous IoT monitoring is not claimed).
   - 24-hour maximum duration for chilled prepared food (≤5.0°C).
   - Minimum 30-minute advance notice window for dispatch feasibility.
   - Packaging integrity and tamper-evident seal verification.

2. **12-Stage LangGraph Agentic Coordination Graph**
   - Stage 1: Parse donation request (Google Gemini 3.8/3.5 Flash or deterministic parser).
   - Stage 2: Validate input schema & parameter bounds.
   - Stage 3: Retrieve active NGO profiles & persistent donation data via registered tools.
   - Stage 4: Validate food-safety holding constraints (FDA §3-501.19 & §3-501.16).
   - Stage 5: Evaluate hard constraints (capacity, dietary classification, service radius).
   - Stage 6: Rank eligible candidates via multi-factor scoring.
   - Stage 7: Prepare persistent pickup proposal with versioning.
   - Stage 8: Checkpoint and await mandatory human operator approval (`SqliteSaver`).
   - Stage 9: Execute approved dispatch via mock platform API with idempotency key protection.
   - Stage 10: Independently query and verify actual resulting database status.
   - Stage 11: Record immutable audit trace log.
   - Stage 12: Finalize agent run and persist complete snapshot.

3. **Human Approval & Governance State Machine**
   - No consequential action executes automatically.
   - Proposals are held in `PROPOSED` status until a human operator confirms approval.
   - If an NGO modifies the destination drop-off location post-approval (TC4), the platform automatically **invalidates** the approval, increments the proposal version, and mandates reconfirmation.
   - If an NGO has not accepted an approved pickup (TC3), the platform actively **blocks** any premature attempt to mark the donation as collected.

4. **Official Test Scenarios Suite (TC1 – TC4)**
   - **TC1: Fresh Food with NGO Capacity**: Validates that safe prepared food is matched, proposed, human approved, and verified on the platform.
   - **TC2: Food Prepared Too Long Ago**: Validates that food prepared beyond permitted holding limits is deterministically rejected by backend rules with policy citations.
   - **TC3: NGO Has Not Accepted**: Validates that an approved pickup with no NGO confirmation remains strictly pending acceptance and cannot be marked collected.
   - **TC4: NGO Changes Drop-off Location**: Validates that an NGO location alteration immediately invalidates prior human approval, increments the version, and mandates reconfirmation.

5. **Restrained Visual Design System**
   - Forest Green (`#245B45`), Deep Forest Green (`#193F32`), Warm Ivory (`#FAF8F2`), Soft Sage (`#E7EFE6`), Warm Food Accent (`#D97745`).
   - Rectangular buttons with modest rounding (7px), cards with 10px radii.
   - Typography: Plus Jakarta Sans for headings, Inter for interface body.
   - Documentary-style authentic kitchen and community logistics photography.
   - Custom geometric SVG brand favicon and product mark.

---

## Technology Stack

- **Backend**: Python 3.13, LangGraph 1.2, LangChain Core, LangGraph Checkpoint SQLite, FastAPI, SQLAlchemy ORM, SQLite database, Pydantic v2 validation, Google GenAI SDK (`google-genai`), Pytest.
- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, Lucide React icons.

---

## Project Structure

```text
Surplus Food Donation Matcher/
├── backend/
│   ├── .env                    # Environment variables (GEMINI_API_KEY, PRODUCT_NAME)
│   ├── .env.example            # Template configuration
│   ├── config.py               # Central branding and FDA food safety rules
│   ├── database.py             # SQLite engine and session management
│   ├── models.py               # SQLAlchemy models (Restaurant, NGO, Donation, PickupRequest, AgentRun)
│   ├── schemas.py              # Pydantic v2 schemas and request models
│   ├── rules_engine.py         # Deterministic food safety and NGO matching engine
│   ├── mock_platform.py        # Mock donation platform service & state machine
│   ├── agent.py                # 10-stage coordination agent with Gemini LLM integration
│   ├── scenarios.py            # Official test scenarios manager (TC1, TC2, TC3, TC4)
│   ├── seed_data.py            # Initial seed data for restaurants, NGOs, and donations
│   ├── main.py                 # FastAPI application and REST endpoints
│   └── test_backend.py         # Pytest test suite (6 tests covering rules & scenarios)
├── frontend/
│   ├── public/
│   │   ├── favicon.svg         # Custom geometric brand mark
│   │   └── images/             # 5 photorealistic documentary-style assets
│   │       ├── hero.jpg
│   │       ├── food-donation.jpg
│   │       ├── ngo-collection.jpg
│   │       ├── restaurant-ops.jpg
│   │       └── community-impact.jpg
│   ├── src/
│   │   ├── components/
│   │   │   ├── common/         # BrandLogo, Button, Badge, Card
│   │   │   └── layout/         # Navigation, Sidebar, TopBar
│   │   ├── pages/              # LandingPage, DashboardPage, DonationsPage, DonationNewPage,
│   │   │                       # MatchingPage, PickupsPage, ScenariosPage, AgentRunsPage,
│   │   │                       # AgentRunDetailPage, PrivacyPage, TermsPage, NotFoundPage
│   │   ├── services/api.ts     # Typed API client
│   │   ├── types/index.ts      # TypeScript interfaces
│   │   ├── config.ts           # Central product configuration
│   │   ├── App.tsx             # Multi-page router and state management
│   │   ├── main.tsx
│   │   └── index.css           # Tailwind base, typography, and reduced-motion rules
│   ├── tailwind.config.js
│   ├── tsconfig.app.json
│   └── package.json
└── README.md
```

---

## Setup & Run Instructions

### 1. Backend Setup
```bash
# Navigate to workspace
cd "c:\Users\manin\OneDrive\Desktop\Projects\Surplus Food Donation Matcher"

# Install dependencies
pip install -r requirements.txt

# Start the FastAPI server on port 8000
uvicorn backend.main:app --host 127.0.0.1 --port 8000
```
Backend API will be live at `http://127.0.0.1:8000` with interactive OpenAPI docs at `http://127.0.0.1:8000/docs`.

### 2. Frontend Setup
```bash
cd "c:\Users\manin\OneDrive\Desktop\Projects\Surplus Food Donation Matcher\frontend"

# Install dependencies (if first time)
npm install

# Start the Vite development server on port 5173
npm run dev -- --host 127.0.0.1 --port 5173
```
Frontend interface will be live at `http://127.0.0.1:5173`.

### 3. Run Automated Tests
```bash
# Execute backend test suite covering food safety rules and all 4 official scenarios
python -m pytest backend/test_backend.py -v
```

---

## Production Deployment

FoodBridge AI includes production deployment configurations for Docker, Render, Railway, and Vercel. For complete details, see [**`DEPLOYMENT.md`**](./DEPLOYMENT.md).

### Quick Deploy with Docker Compose
```bash
# Build unified container serving API and React frontend on port 8000
docker compose up --build -d
```
Visit `http://localhost:8000` for the complete application and `http://localhost:8000/docs` for the interactive API documentation.

### 1-Click Free Cloud Deploy (Render)
1. Push repository to GitHub.
2. Go to [dashboard.render.com](https://dashboard.render.com) $\to$ **New Blueprint**.
3. Select your repository. Render will automatically read [`render.yaml`](./render.yaml) and deploy the multi-stage Docker container.

---

## Step-by-Step Scenario Demonstration

1. **TC1: Fresh Food with NGO Capacity**
   - Navigate to `/test-scenarios` and click **"Run TC1"** (or use the interactive matching page `/matching` on `DON-DEMO-01`).
   - Outcome: Food safety is verified under FDA §3-501.19 (45m elapsed). Top NGO (City Hope Food Rescue) is matched with score 84.5/100. Proposal is presented for human sign-off. After approval, request is created, and verified platform status confirms `APPROVED` (awaiting NGO confirmation) without premature collection.

2. **TC2: Food Prepared Too Long Ago**
   - Navigate to `/test-scenarios` and click **"Run TC2"**.
   - Input: Steam table pasta prepared 330 minutes ago without temperature control (>240m limit).
   - Outcome: Agent issues immediate deterministic rejection (`REJECTED_FOOD_SAFETY_EXPIRED`). No pickup request is created. Policy citations are documented in the trace ledger.

3. **TC3: NGO Has Not Accepted**
   - Navigate to `/test-scenarios` and click **"Run TC3"** (or test on `/pickups`).
   - Input: An approved pickup proposal where the NGO has not yet confirmed acceptance.
   - Outcome: Request status remains strictly `APPROVED (awaiting NGO acceptance)`. Attempt to mark donation as collected is actively blocked by backend guards.

4. **TC4: NGO Changes Drop-off Location**
   - Navigate to `/test-scenarios` and click **"Run TC4"** (or click "Simulate Location Change" on `/pickups`).
   - Input: An approved proposal has its drop-off facility changed by the recipient NGO.
   - Outcome: Original approval is invalidated (`approved_by=None`), proposal version increments to 2, and status transitions to `RECONFIRMATION_REQUIRED`. Restaurant re-approval is mandatory.
