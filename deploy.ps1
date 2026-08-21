# One-command deploy of MathAI to GitHub Pages
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

# 1. Create the public repo and push source (first run), or just push (later runs)
$hasRemote = git remote
if (-not $hasRemote) { gh repo create mathai --public --source . --push } else { git push -u origin main }

# 2. Fresh production build + SPA fallback
npm run build
Copy-Item dist\index.html dist\404.html -Force

# 3. Publish dist/ to the gh-pages branch
Push-Location dist
if (Test-Path .git) { Remove-Item .git -Recurse -Force }
git init -b gh-pages
git add -A
git -c user.email=ami@digititle.co.il -c user.name=Ami commit -m "deploy"
git push -f "https://github.com/flux1903roblox-design/mathai.git" gh-pages
Remove-Item .git -Recurse -Force
Pop-Location

# 4. Enable GitHub Pages from the gh-pages branch (ignored if already enabled)
try { gh api -X POST repos/flux1903roblox-design/mathai/pages -f "source[branch]=gh-pages" -f "source[path]=/" | Out-Null } catch {}

Write-Host ""
Write-Host "Done! Site will be live in ~1 minute at:"
Write-Host "https://flux1903roblox-design.github.io/mathai/"
