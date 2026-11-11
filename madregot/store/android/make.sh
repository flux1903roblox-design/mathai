#!/usr/bin/env bash
# The Play Store app (STUDENT-12 §2): a Trusted Web Activity around the deployed site, built with Google's Bubblewrap.
# OWNER-ONLY: run it on your own computer after the site is deployed at PUBLIC_URL (store/android/README.md, step 2).
#
#   ANDROID_PACKAGE=il.example.madregot PUBLIC_URL=https://madregot.example bash madregot/store/android/make.sh
#
# What it does:
#   1. fills twa-manifest.json (this folder; reviewed in the repository) into TWA_DIR/twa-manifest.json: the package id,
#      the site's host, the name from shared/brand.js APP_NAME, the version, and the signing key's path;
#   2. makes the upload key if KEYSTORE does not exist yet (keytool asks for two passwords: keep them safe);
#   3. runs the pinned Bubblewrap CLI with npx (nothing is added to the repository): `update` writes the Android project
#      from that file, `build` signs app-release-bundle.aab (for Play) and app-release-signed.apk (to try on a phone).
# `bubblewrap init` is not used: it asks some twenty questions and writes its own file from the web manifest, while the
# answers here (the store-app start address ?src=play, the shortcuts, notifications, the dark colours) are kept in
# twa-manifest.json and reviewed with the code.
#
# Settings (environment):
#   ANDROID_PACKAGE        required, e.g. il.example.madregot (never changes after the first upload)
#   PUBLIC_URL             required, https://… (the site the Worker serves; the same value as in worker/wrangler.toml)
#   TWA_DIR                the Android project's folder, outside the repository (default ~/madregot-android)
#   KEYSTORE               the upload key, outside the repository (default ~/.madregot/android-upload.keystore)
#   ANDROID_VERSION_CODE   a whole number, one higher for every upload to Play (default 1)
#   ANDROID_VERSION_NAME   what people see as the version (default 1.0.0)
#   BUBBLEWRAP_KEYSTORE_PASSWORD, BUBBLEWRAP_KEY_PASSWORD   optional: else Bubblewrap asks for them
# --manifest-only writes TWA_DIR/twa-manifest.json and stops (no key, no download, no build).
set -euo pipefail

BUBBLEWRAP="@bubblewrap/cli@1.27.0" # pinned on 11 Nov 2026 (released 9 Oct 2026); check for a newer one before a release
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MADREGOT="$(cd "$HERE/../.." && pwd)"
REPO="$(git -C "$HERE" rev-parse --show-toplevel 2>/dev/null || dirname "$MADREGOT")"

: "${ANDROID_PACKAGE:?set ANDROID_PACKAGE, e.g. il.example.madregot}"
: "${PUBLIC_URL:?set PUBLIC_URL, the deployed site, e.g. https://madregot.example}"
TWA_DIR="${TWA_DIR:-$HOME/madregot-android}"
KEYSTORE="${KEYSTORE:-$HOME/.madregot/android-upload.keystore}"
export ANDROID_PACKAGE PUBLIC_URL KEYSTORE
export ANDROID_VERSION_CODE="${ANDROID_VERSION_CODE:-1}" ANDROID_VERSION_NAME="${ANDROID_VERSION_NAME:-1.0.0}"

abs() { case "$1" in /*) printf '%s' "$1" ;; *) printf '%s/%s' "$PWD" "$1" ;; esac; }
TWA_DIR="$(abs "$TWA_DIR")"
KEYSTORE="$(abs "$KEYSTORE")"
for p in "$TWA_DIR" "$KEYSTORE"; do
  case "$p/" in "$REPO"/*)
    echo "make.sh: $p is inside the repository; the Android project and the signing key live outside it" >&2
    exit 1 ;;
  esac
done

mkdir -p "$TWA_DIR"
# 1. the manifest, filled (node is needed for npx anyway)
node --input-type=module - "$HERE/twa-manifest.json" "$TWA_DIR/twa-manifest.json" "$MADREGOT/shared/brand.js" <<'NODE'
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const [from, to, brand] = process.argv.slice(2);
const { APP_NAME } = await import(pathToFileURL(brand).href);
const fail = (m) => { console.error(`make.sh: ${m}`); process.exit(1); };
const pkg = process.env.ANDROID_PACKAGE.trim();
if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(pkg)) fail(`ANDROID_PACKAGE "${pkg}" is not a package id (lower case, at least two parts, e.g. il.example.madregot)`);
let site;
try { site = new URL(process.env.PUBLIC_URL); } catch { fail('PUBLIC_URL is not an address'); }
if (site.protocol !== 'https:' || (site.pathname !== '/' && site.pathname !== '')) fail('PUBLIC_URL must be https:// and the site root (a Trusted Web Activity needs https and asset links at /.well-known/)');
const code = Number(process.env.ANDROID_VERSION_CODE);
if (!Number.isInteger(code) || code < 1) fail('ANDROID_VERSION_CODE must be a whole number from 1');
const fill = (v) => (typeof v === 'string'
  ? v.replaceAll('<ANDROID_PACKAGE>', pkg).replaceAll('<PUBLIC_HOST>', site.host).replaceAll('<APP_NAME>', APP_NAME).replaceAll('<KEYSTORE>', process.env.KEYSTORE)
  : Array.isArray(v) ? v.map(fill) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fill(x)])) : v);
const out = { ...fill(JSON.parse(readFileSync(from, 'utf8'))), appVersionCode: code, appVersion: process.env.ANDROID_VERSION_NAME };
const left = JSON.stringify(out).match(/<[A-Z_]+>/);
if (left) fail(`twa-manifest.json still has ${left[0]}`);
writeFileSync(to, `${JSON.stringify(out, null, 2)}\n`);
console.log(`make.sh: ${to} (${pkg}, ${site.host}, version ${out.appVersion} / ${code})`);
NODE

if [ "${1:-}" = "--manifest-only" ]; then exit 0; fi

# 2. the upload key (Play App Signing keeps the real signing key; this one only proves the upload is yours)
if [ ! -f "$KEYSTORE" ]; then
  KEYTOOL="$(command -v keytool || true)"
  if [ -z "$KEYTOOL" ] && [ -f "$HOME/.bubblewrap/config.json" ]; then
    JDK="$(node -e "try{console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).jdkPath||'')}catch{}" "$HOME/.bubblewrap/config.json")"
    [ -n "$JDK" ] && [ -x "$JDK/bin/keytool" ] && KEYTOOL="$JDK/bin/keytool"
  fi
  if [ -z "$KEYTOOL" ]; then
    echo "make.sh: no keytool. Run 'npx --yes $BUBBLEWRAP doctor' once (it installs the JDK and Android SDK it needs), then run make.sh again." >&2
    exit 1
  fi
  mkdir -p "$(dirname "$KEYSTORE")"
  echo "make.sh: making the upload key at $KEYSTORE (keytool asks for a password and a name; keep both passwords safe)"
  "$KEYTOOL" -genkeypair -v -keystore "$KEYSTORE" -alias upload -keyalg RSA -keysize 2048 -validity 10000
fi

# 3. the Android project and the signed builds
cd "$TWA_DIR"
npx --yes "$BUBBLEWRAP" update --skipVersionUpgrade --manifest "$TWA_DIR/twa-manifest.json"
npx --yes "$BUBBLEWRAP" build --manifest "$TWA_DIR/twa-manifest.json"
echo
echo "make.sh: done. Upload $TWA_DIR/app-release-bundle.aab to Play Console (internal testing first)."
echo "make.sh: to try app-release-signed.apk on a phone before Play signs it, add the upload key's SHA-256 (below) to"
echo "         ANDROID_CERT_SHA256 in worker/wrangler.toml next to Play's, and deploy:"
"${KEYTOOL:-keytool}" -list -v -keystore "$KEYSTORE" -alias upload 2>/dev/null | grep -i 'SHA256:' || echo "         (keytool -list -v -keystore \"$KEYSTORE\" -alias upload prints it)"
