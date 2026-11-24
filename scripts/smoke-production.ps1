# Production smoke checks (health, readiness and authentication)
# All probes are fatal by default: a deploy that fails a smoke check must fail
# loudly. Set SMOKE_ALLOW_DEGRADED=1 only for intentional degraded-mode runs
# (e.g. verifying fallback behaviour during a planned dependency outage).
param(
    [string] $PlatformUrl = $env:PLATFORM_URL,
    [string] $SmokeEmail = $env:SMOKE_EMAIL,
    [string] $SmokePassword = $env:SMOKE_PASSWORD,
    [switch] $AllowDegraded
)

$ErrorActionPreference = "Stop"

if (-not $PlatformUrl) { $PlatformUrl = "https://casuya-platform-production.up.railway.app" }
$PlatformUrl = $PlatformUrl.TrimEnd("/")
if (-not $SmokeEmail) { $SmokeEmail = "student@casuya.co.tz" }
if (-not $SmokePassword) { $SmokePassword = "student123" }
if ($env:SMOKE_ALLOW_DEGRADED -eq "1") { $AllowDegraded = $true }

$failures = [System.Collections.Generic.List[string]]::new()

function Assert-Probe {
    param([string] $Name, [scriptblock] $Probe)
    try {
        & $Probe
        Write-Host "PASS: $Name" -ForegroundColor Green
    } catch {
        $message = "$Name failed: $_"
        if ($AllowDegraded) {
            Write-Warning $message
        } else {
            $failures.Add($message)
            Write-Error $message
        }
    }
}

Write-Host "== Platform health =="
$health = $null
Assert-Probe "health" {
    $script:health = Invoke-RestMethod -Uri "$PlatformUrl/health" -TimeoutSec 20
    $script:health | ConvertTo-Json -Depth 6
    if ($script:health.status -ne "ok") { throw "status=$($script:health.status)" }
}

Write-Host ""
Write-Host "== Platform readyz =="
Assert-Probe "readyz" {
    $ready = Invoke-RestMethod -Uri "$PlatformUrl/readyz" -TimeoutSec 20
    $ready | ConvertTo-Json -Depth 4
    # /readyz now returns HTTP 503 when the primary DB is down, so a 200 here
    # must still report status=ok. Redis is only required when explicitly set.
    if ($ready.status -ne "ok") { throw "status=$($ready.status) (db=$($ready.database), redis=$($ready.redis))" }
}

Write-Host ""
Write-Host "== Authentication probe =="
Assert-Probe "authentication" {
    $loginBody = @{ email = $SmokeEmail; password = $SmokePassword } | ConvertTo-Json
    $login = Invoke-RestMethod -Uri "$PlatformUrl/auth/login" -Method POST -ContentType "application/json" -Body $loginBody -TimeoutSec 20
    if (-not $login.access_token) { throw "login succeeded but returned no access_token" }
    Write-Host "Logged in as $SmokeEmail"
    # Verify the token actually authorizes a request, not just that it exists.
    $me = Invoke-RestMethod -Uri "$PlatformUrl/users/me" -Headers @{ Authorization = "Bearer $($login.access_token)" } -TimeoutSec 20
    if (-not $me.id) { throw "/auth/me returned no user id" }
}

Write-Host ""
if ($failures.Count -gt 0) {
    throw "Smoke checks failed ($($failures.Count)):`n- $($failures -join "`n- ")"
}

Write-Host "Smoke complete." -ForegroundColor Green
