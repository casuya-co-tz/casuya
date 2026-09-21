# Production smoke checks (services-improvement-plan section 6, ai-tutor-roadmap section 0.5)
$ErrorActionPreference = "Stop"

$platform = $env:PLATFORM_URL
if (-not $platform) { $platform = "https://casuya-platform-production.up.railway.app" }
$platform = $platform.TrimEnd("/")

$smokeEmail = $env:SMOKE_EMAIL
if (-not $smokeEmail) { $smokeEmail = "student@casuya.co.tz" }
$smokePassword = $env:SMOKE_PASSWORD
if (-not $smokePassword) { $smokePassword = "student123" }

Write-Host "== Platform health =="
$health = Invoke-RestMethod -Uri "$platform/health" -TimeoutSec 20
$health | ConvertTo-Json -Depth 6

if ($health.status -ne "ok") { throw "Platform health not ok" }
if (-not $health.casuya_ai.reachable) { Write-Warning "casuya-ai not reachable from platform" }
if ($health.casuya_ai.embeddings_ready -eq $false) {
  Write-Warning "Hybrid RAG embeddings not loaded on casuya-ai (BM25-only until embeddings.json is built)"
}

Write-Host ""
Write-Host "== Platform readyz =="
try {
  Invoke-RestMethod -Uri "$platform/readyz" -TimeoutSec 20 | ConvertTo-Json -Depth 4
} catch {
  Write-Warning "readyz probe failed: $_"
}

if ($env:SMOKE_SKIP_STREAM -eq "1") {
  Write-Warning "SMOKE_SKIP_STREAM=1 - skipping tutor stream probe"
  Write-Host ""
  Write-Host "Smoke complete."
  exit 0
}

Write-Host ""
Write-Host "== Tutor stream probe =="
try {
  $loginBody = @{ email = $smokeEmail; password = $smokePassword } | ConvertTo-Json
  $login = Invoke-RestMethod -Uri "$platform/auth/login" -Method POST -ContentType "application/json" -Body $loginBody -TimeoutSec 20
  $token = $login.access_token
  if (-not $token) { throw "Login succeeded but no access_token returned" }
  Write-Host "Logged in as $smokeEmail"

  $streamBody = @{
    question = "Smoke test: what is a linear equation?"
    lesson_context = "A linear equation has the form ax + b = 0."
    subject_slug = "mathematics"
    form_level = 1
    language = "en"
  } | ConvertTo-Json

  Add-Type -AssemblyName System.Net.Http
  $handler = New-Object System.Net.Http.HttpClientHandler
  $client = New-Object System.Net.Http.HttpClient($handler)
  $client.Timeout = [TimeSpan]::FromSeconds(60)
  [void]$client.DefaultRequestHeaders.TryAddWithoutValidation("Authorization", "Bearer $token")

  $content = New-Object System.Net.Http.StringContent($streamBody, [System.Text.Encoding]::UTF8, "application/json")
  $request = New-Object System.Net.Http.HttpRequestMessage([System.Net.Http.HttpMethod]::Post, "$platform/ai/tutoring/stream")
  $request.Content = $content

  $response = $client.SendAsync($request, [System.Net.Http.HttpCompletionOption]::ResponseHeadersRead).GetAwaiter().GetResult()
  if (-not $response.IsSuccessStatusCode) {
    throw "Tutor stream HTTP $($response.StatusCode)"
  }

  $stream = $response.Content.ReadAsStreamAsync().GetAwaiter().GetResult()
  $reader = New-Object System.IO.StreamReader($stream)
  $deadline = (Get-Date).AddSeconds(55)
  $sawEvent = $false
  $firstByteMs = $null
  $started = Get-Date

  while ((Get-Date) -lt $deadline) {
    if ($reader.EndOfStream) { break }
    $line = $reader.ReadLine()
    if ($null -eq $line) { Start-Sleep -Milliseconds 50; continue }
    if ($line.StartsWith("data:")) {
      $sawEvent = $true
      if ($null -eq $firstByteMs) {
        $firstByteMs = [int]((Get-Date) - $started).TotalMilliseconds
      }
      if ($line.Contains('"done": true') -or $line.Contains('"done":true')) { break }
    }
  }

  $reader.Dispose()
  $client.Dispose()

  if (-not $sawEvent) { throw "Tutor stream returned no SSE data events within 55s" }

  Write-Host "First SSE event in ${firstByteMs}ms"
  if ($firstByteMs -gt 15000) {
    Write-Warning "First tutor chunk slower than 15s - check casuya-ai provider chain"
  } else {
    Write-Host "Tutor stream OK"
  }
} catch {
  Write-Warning "Tutor stream probe failed: $_"
  Write-Warning "Platform health passed; investigate AI provider latency separately."
}

Write-Host ""
Write-Host "Smoke complete."
