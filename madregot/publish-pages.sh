#!/bin/sh
# Publish the no-server version of Madregot to GitHub Pages:
# https://flux1903roblox-design.github.io/mathai/madregot/
# It builds the app and replaces only the madregot/ folder of the gh-pages branch;
# the MathAI site at the root of that branch is left as it is.
set -e
ROOT=$(cd "$(dirname "$0")/.." && pwd)
WORK=$(mktemp -d)
trap 'git -C "$ROOT" worktree remove --force "$WORK/pages" >/dev/null 2>&1 || true; rm -rf "$WORK"' EXIT

cd "$ROOT/madregot/web"
VITE_API_URL=none npx vite build --base ./ --outDir "$WORK/site" --emptyOutDir

git -C "$ROOT" fetch origin gh-pages
git -C "$ROOT" worktree add --detach "$WORK/pages" origin/gh-pages
cd "$WORK/pages"
rm -rf madregot
mkdir madregot
cp -r "$WORK/site/." madregot/
git add -A madregot
if git diff --cached --quiet; then
  echo "Nothing changed: the site is already up to date."
  exit 0
fi
git commit -m "Update Madregot on GitHub Pages"
git push origin HEAD:gh-pages
echo "Pushed. GitHub publishes it in about a minute."
