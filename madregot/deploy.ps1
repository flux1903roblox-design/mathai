# Madregot: publish a new version (after setup.ps1 ran once).
# Applies new database migrations, rebuilds the app, deploys the Worker.
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

# The Worker needs these two secrets for classes (create, look up, join), sign-in and every network counter: without
# them those routes answer 503 server_config. Stop here, before anything is deployed, if either is missing.
Push-Location worker
$secrets = (npx wrangler secret list 2>&1 | Out-String)
Pop-Location
$missing = @('AUTH_SECRET', 'IP_HASH_SECRET') | Where-Object { $secrets -notmatch ('"' + $_ + '"') }
if ($missing) {
  throw ("Missing Worker secrets: " + ($missing -join ', ') + ". Run .\setup.ps1 again (it creates them), or for each one: " +
    "cd worker; npx wrangler secret put <NAME>  and paste the output of: openssl rand -hex 32")
}

npm test --prefix web
npm test --prefix worker
npm run build --prefix web

Push-Location worker
npx wrangler d1 migrations apply madregot --remote   # applies only the migrations not applied yet
npx wrangler deploy
Pop-Location

Write-Host "Deployed." -ForegroundColor Green
