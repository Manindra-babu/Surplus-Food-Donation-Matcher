#!/usr/bin/env bash
set -e

echo "=========================================="
echo " Building FoodBridge AI for Production"
echo "=========================================="

echo -e "\n[1/3] Building React Frontend..."
npm --prefix frontend run build

echo -e "\n[2/3] Verifying Backend Tests..."
python -m pytest backend/test_backend.py -v

echo -e "\n[3/3] Build & Verification Complete!"
echo "Deploy using:"
echo "  - Docker: docker compose up --build"
echo "  - Local:  python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000"
echo "  - Cloud:  Push to GitHub and connect to Render / Railway"
