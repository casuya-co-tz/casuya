Write-Host "=== Casuya Platform ===" -ForegroundColor Cyan
Write-Host "1. Starting Backend (port 8000)..." -ForegroundColor Yellow
$backend = Start-Process -PassThru -NoNewWindow python -ArgumentList "-m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload"

$timeout = 15
$deadline = (Get-Date).AddSeconds($timeout)
$ready = $false
Write-Host "   Waiting for backend to be ready..." -ForegroundColor Gray
while ((Get-Date) -lt $deadline) {
    try {
        $resp = Invoke-WebRequest -Uri "http://localhost:8000/health" -TimeoutSec 2 -UseBasicParsing
        if ($resp.StatusCode -eq 200) { $ready = $true; break }
    } catch {}
    Start-Sleep -Milliseconds 500
}
if (-not $ready) {
    Write-Host "   WARNING: Backend did not respond within ${timeout}s. Starting frontend anyway." -ForegroundColor Red
}

Write-Host "2. Starting Frontend (port 5173)..." -ForegroundColor Yellow
$frontend = Start-Process -PassThru -NoNewWindow python -ArgumentList "-m http.server 5173" -WorkingDirectory "$PSScriptRoot\frontend"
Start-Sleep 1

Write-Host ""
Write-Host " Backend:  http://localhost:8000" -ForegroundColor Green
Write-Host " Frontend: http://localhost:5173" -ForegroundColor Green
Write-Host ""
Write-Host "Press any key to stop both services..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

Stop-Process -Id $backend.Id -Force -ErrorAction SilentlyContinue
Stop-Process -Id $frontend.Id -Force -ErrorAction SilentlyContinue
Write-Host "Stopped." -ForegroundColor Red
