# One-time cloud AI setup: deploys the key-protecting proxy and wires the site to it.
# Prerequisite: a free Groq API key from https://console.groq.com/keys
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "=== 1/4: Cloudflare login (free account, opens browser) ===" -ForegroundColor Cyan
npx -y wrangler@latest login

Write-Host "=== 2/4: Deploying the AI proxy worker ===" -ForegroundColor Cyan
Set-Location worker
$out = npx -y wrangler@latest deploy 2>&1 | Out-String
Write-Host $out
$workerUrl = [regex]::Match($out, 'https://[\w.-]+\.workers\.dev').Value
if (-not $workerUrl) { throw "Could not find worker URL in deploy output" }

Write-Host "=== 3/4: Storing your Groq API key as a server-side secret ===" -ForegroundColor Cyan
Write-Host "Paste your Groq key (starts with gsk_) when prompted:" -ForegroundColor Yellow
npx -y wrangler@latest secret put GROQ_API_KEY
Set-Location ..

Write-Host "=== 4/4: Wiring the site to $workerUrl and redeploying ===" -ForegroundColor Cyan
$lib = "src\lib\localdb.js"
$content = Get-Content $lib -Raw
$content = $content -replace "export const SHARED_AI_URL = '[^']*'", "export const SHARED_AI_URL = '$workerUrl'"
Set-Content $lib $content -Encoding utf8 -NoNewline

git add -A
git -c user.email=ami@digititle.co.il -c user.name=Ami commit -m "cloud AI via key-protecting proxy"
& .\deploy.ps1

Write-Host ""
Write-Host "All done! AI now works for every visitor at:" -ForegroundColor Green
Write-Host "https://flux1903roblox-design.github.io/mathai/"
