#!/bin/sh
# Publish a temporary STAGING copy of Madregot for outside review:
# https://flux1903roblox-design.github.io/mathai/madregot-staging/
#
# - No server (VITE_API_URL=none): no AI, classes, teacher dashboard or sync, and no keys in the build.
# - Its own saved-state key (madregot-staging), so it never reads or writes the public site's data.
# - Not for search engines (noindex), with qa.html (test entry points) and version.json (the commit).
# - Only the madregot-staging/ folder of gh-pages changes; the public Madregot (madregot/) and the
#   MathAI site at the root are never touched. Remove it later with: ./publish-staging.sh --remove
set -e
ROOT=$(cd "$(dirname "$0")/.." && pwd)
DIR=madregot-staging
WORK=$(mktemp -d)
trap 'git -C "$ROOT" worktree remove --force "$WORK/pages" >/dev/null 2>&1 || true; rm -rf "$WORK"' EXIT

if [ "$1" != "--remove" ]; then
  # staging must be exactly a commit that is on GitHub, so the review can name it
  if [ -n "$(git -C "$ROOT" status --porcelain -- madregot)" ]; then echo "Commit the changes first: staging is built from a commit."; exit 1; fi
  SHA=$(git -C "$ROOT" rev-parse HEAD)
  git -C "$ROOT" fetch -q origin
  if [ -z "$(git -C "$ROOT" branch -r --contains "$SHA")" ]; then echo "Push $SHA first: staging must match a commit on GitHub."; exit 1; fi

  cd "$ROOT/madregot/web"
  VITE_API_URL=none VITE_STORE_KEY=madregot-staging npx vite build --base ./ --outDir "$WORK/site" --emptyOutDir
  node -e "const f=process.argv[1],fs=require('fs');fs.writeFileSync(f,fs.readFileSync(f,'utf8').replace('<head>','<head>\n    <meta name=\"robots\" content=\"noindex, nofollow\">'))" "$WORK/site/index.html"
  cp "$ROOT/madregot/staging/qa.html" "$WORK/site/qa.html"
  printf '{ "commit": "%s", "built": "%s", "server": "none", "storageKey": "madregot-staging" }\n' "$SHA" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$WORK/site/version.json"
fi

git -C "$ROOT" fetch -q origin gh-pages
git -C "$ROOT" worktree add -q --detach "$WORK/pages" origin/gh-pages
cd "$WORK/pages"
rm -rf "$DIR"
if [ "$1" != "--remove" ]; then mkdir "$DIR" && cp -r "$WORK/site/." "$DIR/"; fi
git add -A "$DIR"
# a staging publish may change its own folder and nothing else
if git diff --cached --name-only | grep -v "^$DIR/" >/dev/null; then echo "Refusing: the change reaches outside $DIR/."; exit 1; fi
if git diff --cached --quiet; then echo "Nothing changed."; exit 0; fi
if [ "$1" = "--remove" ]; then git commit -q -m "Remove the Madregot staging copy"; else git commit -q -m "Madregot staging from $SHA (no server)"; fi
git push -q origin HEAD:gh-pages
echo "Pushed to gh-pages. GitHub publishes it in about a minute: https://flux1903roblox-design.github.io/mathai/$DIR/"
