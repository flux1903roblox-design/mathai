# Madregot: publish a new version (after setup.ps1 ran once).
# Applies database changes that are safe to repeat, rebuilds the app, deploys the Worker.
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

npm test --prefix web
npm test --prefix worker
npm run build --prefix web

Push-Location worker
npx wrangler d1 execute madregot --remote --file=schema.sql --yes   # CREATE TABLE IF NOT EXISTS only
npx wrangler deploy
Pop-Location

Write-Host "Deployed." -ForegroundColor Green
