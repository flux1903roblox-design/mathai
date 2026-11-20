#!/usr/bin/env bash
# The iPhone app (STUDENT-12 §3): Capacitor's native shell around the app's own files, built with VITE_STORE=ios.
# OWNER-ONLY: run it on a Mac with Xcode, after the Worker is deployed at PUBLIC_URL (store/ios/README.md, step 3).
#
#   IOS_BUNDLE_ID=il.example.madregot PUBLIC_URL=https://madregot.example bash madregot/store/ios/make.sh
#
# What it does, in IOS_DIR (outside the repository, like the Android project):
#   1. writes capacitor.config.json (this folder's, filled: the bundle id and the name from shared/brand.js APP_NAME)
#      and package.json (the pinned Capacitor packages);
#   2. builds the web app for the iPhone into IOS_DIR/www: VITE_STORE=ios (store mode: nothing sold, no family plan,
#      the AI permission sheet, local reminders, native haptics, no service worker) and VITE_API_URL=PUBLIC_URL (the
#      app's files are on the phone; the API is the Worker's address, which allows capacitor://localhost);
#   3. installs the pinned packages there (npm ci after the first run), adds the iOS project the first time
#      (npx cap add ios), and copies the web build into it (npx cap sync ios);
#   4. copies PrivacyInfo.xcprivacy into ios/App/App/, makes the app iPhone-only (TARGETED_DEVICE_FAMILY = 1) and
#      declares no non-exempt encryption (ITSAppUsesNonExemptEncryption = NO: HTTPS only).
# Then open IOS_DIR/ios/App/App.xcodeproj (or .xcworkspace) in Xcode, set your team, archive and upload (README step 4).
#
# Settings (environment):
#   IOS_BUNDLE_ID      required, e.g. il.example.madregot (the App Store Connect record's bundle id; never changes)
#   PUBLIC_URL         required, https://… (the Worker's address, the same value as in worker/wrangler.toml)
#   IOS_DIR            the iOS project's folder, outside the repository (default ~/madregot-ios)
#   VITE_STORE_CLASS_AI  0: class AI off in this build (FOLLOWUP-44): a class licence does not open the AI on the
#                      phone, and a class student gets only the free taste (web/src/lib/account.js classAiInApp, the
#                      Worker's X-Class-AI). Empty or 1 (the default): on. Only if App Review objects to 3.1.3(c).
# --config-only writes IOS_DIR/capacitor.config.json and package.json and stops (no build, no download, no Xcode).
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MADREGOT="$(cd "$HERE/../.." && pwd)"
REPO="$(git -C "$HERE" rev-parse --show-toplevel 2>/dev/null || dirname "$MADREGOT")"

: "${IOS_BUNDLE_ID:?set IOS_BUNDLE_ID, e.g. il.example.madregot}"
: "${PUBLIC_URL:?set PUBLIC_URL, the deployed Worker, e.g. https://madregot.example}"
IOS_DIR="${IOS_DIR:-$HOME/madregot-ios}"
case "$IOS_DIR" in /*) ;; *) IOS_DIR="$PWD/$IOS_DIR" ;; esac
case "$IOS_DIR/" in "$REPO"/*)
  echo "make.sh: $IOS_DIR is inside the repository; the iOS project lives outside it" >&2
  exit 1 ;;
esac
case "${VITE_STORE_CLASS_AI:-}" in
  ''|1) CLASS_AI=on ;;
  0) CLASS_AI=off ;;
  *) echo "make.sh: VITE_STORE_CLASS_AI is 0 (class AI off in this build) or empty or 1 (on), not \"$VITE_STORE_CLASS_AI\"" >&2; exit 1 ;;
esac
export IOS_BUNDLE_ID PUBLIC_URL

mkdir -p "$IOS_DIR"
# 1. the Capacitor settings, filled, and the pinned packages
node --input-type=module - "$HERE" "$IOS_DIR" "$MADREGOT/shared/brand.js" <<'NODE'
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const [here, out, brand] = process.argv.slice(2);
const { APP_NAME } = await import(pathToFileURL(brand).href);
const fail = (m) => { console.error(`make.sh: ${m}`); process.exit(1); };
const id = process.env.IOS_BUNDLE_ID.trim();
if (!/^[A-Za-z][A-Za-z0-9-]*(\.[A-Za-z][A-Za-z0-9-]*)+$/.test(id)) fail(`IOS_BUNDLE_ID "${id}" is not a bundle id (letters, digits and hyphens, at least two parts, e.g. il.example.madregot)`);
let site;
try { site = new URL(process.env.PUBLIC_URL); } catch { fail('PUBLIC_URL is not an address'); }
if (site.protocol !== 'https:') fail('PUBLIC_URL must be https://');
const config = JSON.parse(readFileSync(join(here, 'capacitor.config.json'), 'utf8'));
const filled = JSON.parse(JSON.stringify(config).replaceAll('<IOS_BUNDLE_ID>', id).replaceAll('<APP_NAME>', APP_NAME));
const left = JSON.stringify(filled).match(/<[A-Z_]+>/);
if (left) fail(`capacitor.config.json still has ${left[0]}`);
writeFileSync(join(out, 'capacitor.config.json'), `${JSON.stringify(filled, null, 2)}\n`);
copyFileSync(join(here, 'package.json'), join(out, 'package.json'));
console.log(`make.sh: ${join(out, 'capacitor.config.json')} (${id}, ${APP_NAME}), API ${site.origin}`);
NODE
echo "make.sh: class AI in this build: $CLASS_AI$([ "$CLASS_AI" = off ] && echo ' (VITE_STORE_CLASS_AI=0: the free taste only)')"

if [ "${1:-}" = "--config-only" ]; then exit 0; fi

if [ "$(uname -s)" != "Darwin" ] || ! command -v xcodebuild >/dev/null; then
  echo "make.sh: the iOS project needs a Mac with Xcode (xcodebuild). Run --config-only to check the settings anywhere." >&2
  exit 1
fi

# 2. the web app for the iPhone (relative paths: the files load from capacitor://localhost)
(cd "$MADREGOT/web" && VITE_STORE=ios VITE_API_URL="${PUBLIC_URL%/}" VITE_STORE_CLASS_AI="${VITE_STORE_CLASS_AI:-}" npx vite build --base ./ --outDir "$IOS_DIR/www" --emptyOutDir)

# 3. the pinned packages, the iOS project (first time) and the web files copied into it
cd "$IOS_DIR"
if [ -f package-lock.json ]; then npm ci; else npm install --save-exact; fi
[ -d ios ] || npx cap add ios
npx cap sync ios

# 4. privacy manifest, iPhone only, no non-exempt encryption
cp "$HERE/PrivacyInfo.xcprivacy" ios/App/App/PrivacyInfo.xcprivacy
PBX=ios/App/App.xcodeproj/project.pbxproj
perl -pi -e 's/TARGETED_DEVICE_FAMILY = "1,2";/TARGETED_DEVICE_FAMILY = 1;/g' "$PBX"
/usr/libexec/PlistBuddy -c 'Delete :ITSAppUsesNonExemptEncryption' ios/App/App/Info.plist 2>/dev/null || true
/usr/libexec/PlistBuddy -c 'Add :ITSAppUsesNonExemptEncryption bool false' ios/App/App/Info.plist
echo
echo "make.sh: done. The project is $IOS_DIR/ios/App."
if ! grep -q 'PrivacyInfo.xcprivacy' "$PBX"; then
  echo "make.sh: one step in Xcode, once: drag ios/App/App/PrivacyInfo.xcprivacy into the App group and tick the App target"
  echo "         (it must be in Build Phases > Copy Bundle Resources). Later runs keep it."
fi
echo "make.sh: in Xcode set your team (Signing & Capabilities), then Product > Archive and upload (README step 4)."
