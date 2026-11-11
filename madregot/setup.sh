#!/bin/sh
# Madregot: one-time setup on Cloudflare, then the first deploy. The twin of setup.ps1, for a Mac or Linux machine.
# Needs: Node.js 20 or newer, openssl, a free Cloudflare account, and an Anthropic API key (console.anthropic.com >
# API keys). Run from this folder:  sh setup.sh
# Random secrets are made here with openssl, sent straight to Cloudflare and never written to a file; one that is set
# already is kept. It ends with `npm run owner -- doctor`, which lists what is still missing, each with its command.
set -eu
cd "$(dirname "$0")"

echo "=== 1/7: Installing packages ==="
npm ci --prefix web
npm ci --prefix worker

echo "=== 2/7: Cloudflare login (opens the browser) ==="
cd worker
npx wrangler login

echo "=== 3/7: Creating the database ==="
if grep -q 'REPLACE_WITH_DATABASE_ID' wrangler.toml; then
  out=$(npx wrangler d1 create madregot --binding DB --update-config=false 2>&1) || { printf '%s\n' "$out"; exit 1; }
  printf '%s\n' "$out"
  id=$(printf '%s' "$out" | grep -Eo '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -n 1 || true)
  if [ -z "$id" ]; then
    echo "Could not read the database id above. Put it in worker/wrangler.toml (database_id) and run this script again."
    exit 1
  fi
  sed "s/REPLACE_WITH_DATABASE_ID/$id/" wrangler.toml > wrangler.toml.new && mv wrangler.toml.new wrangler.toml
  echo "Saved database id $id in worker/wrangler.toml"
else
  echo "worker/wrangler.toml already has a database id; using it."
fi
npx wrangler d1 migrations apply madregot --remote   # database changes go only through worker/migrations

echo "=== 4/7: Building the app ==="
cd ..
npm run build --prefix web

echo "=== 5/7: Deploying (app and API at one address) ==="
cd worker
npx wrangler deploy

echo "=== 6/7: Secrets on the server ==="
existing=$(npx wrangler secret list --format json 2>/dev/null || echo '[]')
has() { printf '%s' "$existing" | grep -q "\"$1\""; }
for name in AUTH_SECRET IP_HASH_SECRET WEBHOOK_PATH_SECRET VAULT_SECRET; do
  if has "$name"; then
    echo "$name is already set; keeping it."
  else
    openssl rand -hex 32 | npx wrangler secret put "$name" > /dev/null
    echo "$name created."
  fi
done
# the pasted ones, only for what is on: the Claude key always, the Resend key once EMAIL_FROM is set
if ! has ANTHROPIC_API_KEY; then
  echo "Paste your Anthropic API key (starts with sk-ant-) when asked. It stays on Cloudflare, never in the app."
  npx wrangler secret put ANTHROPIC_API_KEY
fi
if grep -Eq '^EMAIL_FROM = "[^"]+"' wrangler.toml && ! has RESEND_API_KEY; then
  echo "Paste your Resend API key (starts with re_) when asked."
  npx wrangler secret put RESEND_API_KEY
fi

echo "=== 7/7: What is still missing ==="
# exits 1 while something required is missing: the setup itself is done, so the script does not stop on it
npm run owner -- doctor || true
echo "Run 'npm run owner -- doctor' in worker/ again after each change, until it says הכול מוכן; then 'npx wrangler deploy'."
