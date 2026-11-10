# Madregot: publish a new version (after setup.ps1 ran once).
# Applies new database migrations, rebuilds the app, deploys the Worker.
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

npm test --prefix web
npm test --prefix worker
npm run build --prefix web

Push-Location worker
npx wrangler d1 migrations apply madregot --remote   # applies only the migrations not applied yet
npx wrangler deploy
Pop-Location

Write-Host "Deployed." -ForegroundColor Green
