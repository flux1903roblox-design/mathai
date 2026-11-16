# Madregot: publish a new version (after setup.ps1 ran once).
# Applies new database migrations, rebuilds the app, deploys the Worker.
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

# Windows PowerShell 5 turns stderr lines into errors once they are redirected with 2>&1, so a wrangler warning would end
# the script under "Stop": the one command whose output is read runs with "Continue" (the same helper as setup.ps1).
# A plain function on purpose: $args keeps arguments such as --binding as text, where a param() block would read them
# as its own parameter names.
function Invoke-Captured {
  $exe, $rest = $args
  $prev = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try { $text = (& $exe @rest 2>&1 | ForEach-Object { "$_" }) -join "`n" } finally { $ErrorActionPreference = $prev }
  [pscustomobject]@{ Text = $text; Code = $LASTEXITCODE }
}

# The Worker needs these two secrets for classes (create, look up, join), sign-in and every network counter: without
# them those routes answer 503 server_config. Stop here, before anything is deployed, if either is missing.
Push-Location worker
$secrets = (Invoke-Captured npx wrangler secret list).Text
Pop-Location
$missing = @('AUTH_SECRET', 'IP_HASH_SECRET') | Where-Object { $secrets -notmatch ('"' + $_ + '"') }
if ($missing) {
  throw ("Missing Worker secrets: " + ($missing -join ', ') + ". Run .\setup.ps1 again (it creates them), or for each one: " +
    "cd worker; npx wrangler secret put <NAME>  and paste the output of: openssl rand -hex 32")
}

npm test --prefix web
if ($LASTEXITCODE -ne 0) { throw "The web tests failed: nothing was deployed." }
npm test --prefix worker
if ($LASTEXITCODE -ne 0) { throw "The server tests failed: nothing was deployed." }
npm run build --prefix web
if ($LASTEXITCODE -ne 0) { throw "The app did not build: nothing was deployed." }

Push-Location worker
npx wrangler d1 migrations apply madregot --remote   # applies only the migrations not applied yet
if ($LASTEXITCODE -ne 0) { Pop-Location; throw "The database migrations failed: nothing was deployed." }
# wrangler.toml with the empty settings sent as one, so the free plan's 64 are enough (scripts/deploy-config.mjs)
node scripts/deploy-config.mjs
if ($LASTEXITCODE -ne 0) { Pop-Location; throw "Could not prepare the deploy (see above): nothing was deployed." }
npx wrangler deploy --config wrangler.deploy.toml
if ($LASTEXITCODE -ne 0) { Pop-Location; throw "The deploy failed (see above)." }
Pop-Location

Write-Host "Deployed." -ForegroundColor Green
