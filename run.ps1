# Casuya Platform - Dev Server
# Starts Tailwind CSS watcher for live development

Set-Location "$PSScriptRoot\apps\platform\frontend"
Write-Host "Starting Casuya dev server... (Ctrl+C to stop)" -ForegroundColor Cyan
npm run dev
