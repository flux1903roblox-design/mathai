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

Write-Host "=== 3/6: Creating the database (in the European Union) ===" -ForegroundColor Cyan
# The data stays in the EU (trust spec TRUST-15 step 1). Cloudflare sets a database's jurisdiction only when it is
# created, so this runs once, before any real data exists. DB_JURISDICTION = "eu" in wrangler.toml records it: the
# privacy notice says "באיחוד האירופי" only then, and online checkout stays closed without it.
$tomlPath = Join-Path (Get-Location) "wrangler.toml"
$toml = [IO.File]::ReadAllText($tomlPath)
if ($toml -match 'REPLACE_WITH_DATABASE_ID') {
  $out = npx wrangler d1 create madregot --binding DB --update-config=false --jurisdiction=eu 2>&1 | Out-String
  Write-Host $out
  $id = [regex]::Match($out, '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}').Value
  if (-not $id) { throw "Could not read the database id above. Put it in worker\wrangler.toml (database_id) and run this script again." }
  $toml = $toml.Replace('REPLACE_WITH_DATABASE_ID', $id).Replace('DB_JURISDICTION = ""', 'DB_JURISDICTION = "eu"')
  [IO.File]::WriteAllText($tomlPath, $toml)  # UTF-8, no BOM
  Write-Host "Saved database id $id and DB_JURISDICTION = ""eu"" in worker\wrangler.toml" -ForegroundColor Green
} else {
  Write-Host "worker\wrangler.toml already has a database id; using it."
  if ($toml -notmatch 'DB_JURISDICTION = "eu"') {
    Write-Host "DB_JURISDICTION is not ""eu"": this database was not created by this script in the EU, so online checkout stays closed." -ForegroundColor Yellow
    Write-Host "Before any real data: delete it in the Cloudflare dashboard, put database_id back to REPLACE_WITH_DATABASE_ID and run this script again." -ForegroundColor Yellow
  }
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
# AUTH_SECRET (sign-in codes, link codes) and IP_HASH_SECRET (network counters without storing any address): random
# 32-byte values made here, sent straight to Cloudflare and never written to a file. An existing value is kept.
function New-HexSecret {
  $bytes = New-Object byte[] 32
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  ($bytes | ForEach-Object { $_.ToString('x2') }) -join ''
}
$existing = (npx wrangler secret list 2>&1 | Out-String)
foreach ($name in @('AUTH_SECRET', 'IP_HASH_SECRET')) {
  if ($existing -match ('"' + $name + '"')) { Write-Host "$name is already set; keeping it." }
  else { New-HexSecret | npx wrangler secret put $name; Write-Host "$name created." -ForegroundColor Green }
}
Write-Host "Saving the Claude API key on the server" -ForegroundColor Cyan
Write-Host "Paste your Anthropic API key (starts with sk-ant-) when asked. It stays on Cloudflare, never in the app." -ForegroundColor Yellow
npx wrangler secret put ANTHROPIC_API_KEY
Pop-Location

Write-Host ""
Write-Host "Done. Madregot is live at:" -ForegroundColor Green
if ($url) { Write-Host $url } else { Write-Host "(see the workers.dev address in the deploy output above)" }
Write-Host "Check the server at: $url/api/health  (ai, netKeys and auth should all be true)"
Write-Host "Later updates: .\deploy.ps1"
