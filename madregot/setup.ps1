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
npx wrangler d1 execute madregot --remote --file=schema.sql --yes

Write-Host "=== 4/6: Building the app ===" -ForegroundColor Cyan
Pop-Location
npm run build --prefix web

Write-Host "=== 5/6: Deploying (app and API at one address) ===" -ForegroundColor Cyan
Push-Location worker
$out = npx wrangler deploy 2>&1 | Out-String
Write-Host $out
$url = [regex]::Match($out, 'https://[\w.-]+\.workers\.dev').Value

Write-Host "=== 6/6: Saving the Claude API key on the server ===" -ForegroundColor Cyan
Write-Host "Paste your Anthropic API key (starts with sk-ant-) when asked. It stays on Cloudflare, never in the app." -ForegroundColor Yellow
npx wrangler secret put ANTHROPIC_API_KEY
Pop-Location

Write-Host ""
Write-Host "Done. Madregot is live at:" -ForegroundColor Green
if ($url) { Write-Host $url } else { Write-Host "(see the workers.dev address in the deploy output above)" }
Write-Host "Check the AI connection at: $url/api/health  (ai should be true)"
Write-Host "Later updates: .\deploy.ps1"
