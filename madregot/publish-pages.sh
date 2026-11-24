#!/bin/sh
# Publish the no-server version of Madregot to GitHub Pages:
# https://flux1903roblox-design.github.io/mathai/madregot/
# It builds the app and replaces only the madregot/ folder of the gh-pages branch;
# the MathAI site at the root of that branch is left as it is.
#
# The teacher page of this no-server site points teachers to the full app. Set once in the shell before publishing:
#   export TEACHER_URL=https://<the hosted app's address>/ CONTACT_EMAIL=<the support address>
# Without TEACHER_URL the page says the teacher board is not open to everyone yet (and gives CONTACT_EMAIL if set).
set -e
ROOT=$(cd "$(dirname "$0")/.." && pwd)
WORK=$(mktemp -d)
trap 'git -C "$ROOT" worktree remove --force "$WORK/pages" >/dev/null 2>&1 || true; rm -rf "$WORK"' EXIT

cd "$ROOT/madregot/web"
# No personal-key mode in a public copy (trust spec TRUST-4 §4.8): a child's app never offers a field for an Anthropic
# key. check-dist refuses the build if the Claude SDK for the browser got in anyway.
VITE_API_URL=none VITE_TEACHER_URL="${TEACHER_URL:-}" VITE_CONTACT_EMAIL="${CONTACT_EMAIL:-}" npx vite build --base ./ --outDir "$WORK/site" --emptyOutDir
node scripts/check-dist.mjs "$WORK/site"

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
