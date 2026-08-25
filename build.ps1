# Casuya Platform - Full Build
# Typechecks, bundles JS, minifies CSS+JS

Set-Location $PSScriptRoot

Write-Host "1. Typechecking..." -ForegroundColor Cyan
npx tsc --noEmit -p "packages/blackboard/tsconfig.json"
npx tsc --noEmit -p "packages/ai/tsconfig.json"
npx tsc --noEmit -p "packages/editor/tsconfig.json"

Write-Host "2. Building CSS..." -ForegroundColor Cyan
Set-Location "apps\platform\frontend"
npx tailwindcss -i .\assets\css\input.css -o .\assets\css\tailwind.min.css --minify
npx clean-css-cli -o .\assets\css\main.min.css .\assets\css\main.css

Write-Host "3. Building JS..." -ForegroundColor Cyan
npm run minify:js

Write-Host "Build complete!" -ForegroundColor Green
