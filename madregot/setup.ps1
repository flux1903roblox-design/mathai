# Madregot: one-time setup on Cloudflare, then the first deploy.
# Needs: Node.js 20 or newer, a free Cloudflare account, and an Anthropic API key
# (console.anthropic.com > API keys). Run from PowerShell:  .\setup.ps1
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "=== 1/6: Installing packages ===" -ForegroundColor Cyan
npm ci --prefix web
npm ci --prefix worker

Write-Host "=== 2/6: Cloudflare login (opens the browser) ===" -ForegroundColor Cyan
Push-Location worker
npx wrangler login

Write-Host "=== 3/6: Creating the database ===" -ForegroundColor Cyan
$tomlPath = Join-Path (Get-Location) "wrangler.toml"
$toml = [IO.File]::ReadAllText($tomlPath)
if ($toml -match 'REPLACE_WITH_DATABASE_ID') {
  $out = npx wrangler d1 create madregot --binding DB --update-config=false 2>&1 | Out-String
  Write-Host $out
  $id = [regex]::Match($out, '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}').Value
  if (-not $id) { throw "Could not read the database id above. Put it in worker\wrangler.toml (database_id) and run this script again." }
  [IO.File]::WriteAllText($tomlPath, $toml.Replace('REPLACE_WITH_DATABASE_ID', $id))  # UTF-8, no BOM
  Write-Host "Saved database id $id in worker\wrangler.toml" -ForegroundColor Green
} else {
  Write-Host "worker\wrangler.toml already has a database id; using it."
}
npx wrangler d1 migrations apply madregot --remote   # database changes go only through worker/migrations

Write-Host "=== 4/6: Building the app ===" -ForegroundColor Cyan
Pop-Location
npm run build --prefix web

Write-Host "=== 5/6: Deploying (app and API at one address) ===" -ForegroundColor Cyan
Push-Location worker
$out = npx wrangler deploy 2>&1 | Out-String
Write-Host $out
$url = [regex]::Match($out, 'https://[\w.-]+\.workers\.dev').Value

Write-Host "=== 6/6: Secrets on the server ===" -ForegroundColor Cyan
# The random ones (AUTH_SECRET: sign-in and link codes; IP_HASH_SECRET: network counters without storing any address;
# WEBHOOK_PATH_SECRET: the secret part of the payment webhook's address; VAULT_SECRET: seals the class and family copies
# of a backup code): made here, sent straight to Cloudflare and never written to a file. An existing value is kept.
function New-HexSecret {
  $bytes = New-Object byte[] 32
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  ($bytes | ForEach-Object { $_.ToString('x2') }) -join ''
}
$existing = (npx wrangler secret list --format json 2>&1 | Out-String)
foreach ($name in @('AUTH_SECRET', 'IP_HASH_SECRET', 'WEBHOOK_PATH_SECRET', 'VAULT_SECRET')) {
  if ($existing -match ('"' + $name + '"')) { Write-Host "$name is already set; keeping it." }
  else { New-HexSecret | npx wrangler secret put $name; Write-Host "$name created." -ForegroundColor Green }
}
# The pasted ones, only for what is on: the Claude key always, the Resend key once EMAIL_FROM is set.
if ($existing -notmatch '"ANTHROPIC_API_KEY"') {
  Write-Host "Saving the Claude API key on the server" -ForegroundColor Cyan
  Write-Host "Paste your Anthropic API key (starts with sk-ant-) when asked. It stays on Cloudflare, never in the app." -ForegroundColor Yellow
  npx wrangler secret put ANTHROPIC_API_KEY
}
if (([IO.File]::ReadAllText($tomlPath) -match '(?m)^EMAIL_FROM = "[^"]+"') -and ($existing -notmatch '"RESEND_API_KEY"')) {
  Write-Host "Paste your Resend API key (starts with re_) when asked." -ForegroundColor Yellow
  npx wrangler secret put RESEND_API_KEY
}

Write-Host "=== What is still missing ===" -ForegroundColor Cyan
# exits 1 while something required is missing: the setup itself is done, so the script does not stop on it
npm run owner -- doctor
Pop-Location

Write-Host ""
Write-Host "Done. Madregot is live at:" -ForegroundColor Green
if ($url) { Write-Host $url } else { Write-Host "(see the workers.dev address in the deploy output above)" }
Write-Host "Run npm run owner -- doctor (in worker) after each change, until it says the setup is complete."
Write-Host "Later updates: .\deploy.ps1"
