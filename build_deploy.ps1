Write-Host "==========================================" -ForegroundColor Green
Write-Host " Building FoodBridge AI for Production" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green

# 1. Install and build Frontend
Write-Host "`n[1/3] Building React Frontend..." -ForegroundColor Cyan
npm --prefix frontend run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Frontend build failed!" -ForegroundColor Red
    exit 1
}

# 2. Run Backend Tests
Write-Host "`n[2/3] Verifying Backend Tests..." -ForegroundColor Cyan
python -m pytest backend/test_backend.py -v
if ($LASTEXITCODE -ne 0) {
    Write-Host "Tests failed!" -ForegroundColor Red
    exit 1
}

# 3. Ready
Write-Host "`n[3/3] Build & Verification Complete!" -ForegroundColor Green
Write-Host "`nYou can now deploy using:" -ForegroundColor Yellow
Write-Host "  - Docker:  docker compose up --build" -ForegroundColor White
Write-Host "  - Local:   python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000" -ForegroundColor White
Write-Host "  - Cloud:   Push to GitHub and connect to Render / Railway" -ForegroundColor White
