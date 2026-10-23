# FoodBridge AI — Deployment Guide

This guide provides step-by-step instructions for deploying **FoodBridge AI** across different environments, from free cloud platforms to local Docker containers.

---

## Architecture Overview

FoodBridge AI is built with:
* **Frontend:** React + TypeScript + Vite + Tailwind CSS
* **Backend:** FastAPI + Python 3.11 + SQLAlchemy + Pydantic
* **Agent Orchestrator:** LangGraph StateGraph + Google Gemini LLM API
* **Database:** SQLite (`foodbridge.db` + persistent checkpoint ledger)

FoodBridge AI supports **Unified Single-Port Deployment**: FastAPI automatically serves both the backend API endpoints (`/api/...`) and the production React SPA build (`/`) from a single server/container, eliminating CORS issues and separate hosting requirements.

---

## Option 1: 1-Click Cloud Deployment on Render (Recommended & Free)

[Render](https://render.com) provides free hosting with support for Docker and native Python web services.

### Steps:
1. **Push your code to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit for FoodBridge AI deployment"
   git branch -M main
   git remote add origin https://github.com/<your-username>/surplus-food-donation-matcher.git
   git push -u origin main
   ```
2. **Log into Render:**
   * Go to [dashboard.render.com](https://dashboard.render.com) and click **"New +"** $\to$ **"Blueprint"** (or **"Web Service"**).
3. **Connect Repository:**
   * Select your GitHub repository.
   * Render will automatically detect [`render.yaml`](./render.yaml).
4. **Configure Environment Variables:**
   * In the Render settings, add:
     * `GEMINI_API_KEY`: *(Optional)* Your Google Gemini API Key. (If omitted, the agent automatically falls back to deterministic rule synthesis).
     * `PRODUCT_NAME`: `FoodBridge AI`
5. **Deploy:**
   * Click **"Create Web Service"**.
   * Render will build the container using the multi-stage [`Dockerfile`](./Dockerfile) and deploy it to a live public URL (e.g. `https://foodbridge-ai.onrender.com`).

---

## Option 2: Docker Container Deployment (Universal)

You can run FoodBridge AI anywhere Docker is supported (local machine, VPS, AWS EC2, GCP, DigitalOcean).

### Quick Start with Docker Compose:
1. Clone or navigate to the project directory:
   ```bash
   cd "Surplus Food Donation Matcher"
   ```
2. Create your `.env` file from the example:
   ```bash
   cp .env.example .env
   ```
   Add your `GEMINI_API_KEY` if you have one.
3. Build and launch:
   ```bash
   docker compose up --build -d
   ```
4. Access the application:
   * **Web Application:** `http://localhost:8000`
   * **API Docs (Swagger):** `http://localhost:8000/docs`
   * **Health Check:** `http://localhost:8000/api/health`

### Single Docker Container:
```bash
# Build image
docker build -t foodbridge-ai .

# Run container
docker run -d -p 8000:8000 -e GEMINI_API_KEY="your_key" --name foodbridge foodbridge-ai
```

---

## Option 3: Deploy to Railway

[Railway](https://railway.app) automatically deploys repositories with Dockerfiles.

1. Go to [railway.app](https://railway.app) and create a new project.
2. Select **"Deploy from GitHub repo"** and choose your repository.
3. Railway will detect [`Dockerfile`](./Dockerfile) and build both the React frontend and FastAPI backend automatically.
4. Under **Variables**, add:
   * `GEMINI_API_KEY`: `your_key`
   * `PORT`: `8000`
5. Under **Settings**, click **"Generate Domain"** to obtain a public URL.

---

## Option 4: Split Deployment (Vercel Frontend + Render Backend)

If you prefer deploying the frontend and backend on separate platforms:

### 1. Deploy Backend (Render / Railway / Fly.io):
* Deploy the backend directory using [`requirements.txt`](./requirements.txt) and [`Procfile`](./Procfile):
  ```bash
  python -m uvicorn backend.main:app --host 0.0.0.0 --port $PORT
  ```
* Note down your backend URL (e.g., `https://foodbridge-backend.onrender.com`).

### 2. Deploy Frontend (Vercel):
* Push repository to GitHub.
* Import into Vercel with **Root Directory** set to `frontend`.
* Add Environment Variable:
  * `VITE_API_BASE_URL`: `https://foodbridge-backend.onrender.com/api`
* Deploy! Vercel will use [`frontend/vercel.json`](./frontend/vercel.json) to handle single-page routing.

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|:---|:---:|:---:|:---|
| `GEMINI_API_KEY` | Optional | `""` | Google Gemini API key. If omitted, deterministic rule synthesis fallback is active. |
| `PORT` | Optional | `8000` | Port for the FastAPI HTTP server. Automatically provided by Render/Railway/Fly. |
| `PRODUCT_NAME` | Optional | `FoodBridge AI` | Branding title displayed across UI and API headers. |
| `VITE_API_BASE_URL` | Optional | `/api` | Base API URL. Leave as default `/api` for unified Docker/Render deployments. |

---

## Post-Deployment Verification Checklist

Once deployed, verify the system using these checks:

1. **Health Check:**
   ```bash
   curl https://<your-deployed-domain>/api/health
   # Expected: {"status":"healthy","product":"FoodBridge AI",...}
   ```
2. **Interactive UI Check:**
   * Open `https://<your-deployed-domain>/` in your browser.
   * Verify navigation across Dashboard, Donations, NGO Matching, Pickups, and Scenarios.
3. **Run 4 Official Challenge Scenarios:**
   * Navigate to `https://<your-deployed-domain>/test-scenarios`.
   * Click **"Run All 4 Official Scenarios"** to verify that TC1, TC2, TC3, and TC4 execute with valid audit traces.
