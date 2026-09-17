# Production smoke checks (services-improvement-plan §6)
$ErrorActionPreference = "Stop"

$platform = $env:PLATFORM_URL
if (-not $platform) { $platform = "https://casuya-platform-production.up.railway.app" }

Write-Host "== Platform health =="
$health = Invoke-RestMethod -Uri "$platform/health" -TimeoutSec 20
$health | ConvertTo-Json -Depth 6

if ($health.status -ne "ok") { throw "Platform health not ok" }
if (-not $health.casuya_ai.reachable) { Write-Warning "casuya-ai not reachable from platform" }

Write-Host "`n== Platform readyz =="
try {
  Invoke-RestMethod -Uri "$platform/readyz" -TimeoutSec 20 | ConvertTo-Json -Depth 4
} catch {
  Write-Warning "readyz probe failed: $_"
}

Write-Host "`nSmoke complete."
