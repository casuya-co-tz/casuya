# Casuya Platform - Start Backend + Frontend
# Backend serves frontend on http://localhost:8765

Set-Location "$PSScriptRoot\apps\platform"
Write-Host "Starting Casuya Platform on http://localhost:8765" -ForegroundColor Cyan
python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8765
