# The Play Store app (Trusted Web Activity)

The Android app is the website in a Trusted Web Activity: Chrome shows the deployed site with no address bar, and
Android treats it as an app (its own icon, shortcuts, notifications by web push). Everything below is OWNER-ONLY; the
code side is done:

- `twa-manifest.json`: Bubblewrap's settings, reviewed with the code. The app opens `/#/?src=play`, so it runs in store
  mode (no prices, plans or purchase links; `web/src/lib/install.js isStoreApp`). The three shortcuts are the web
  manifest's, each with `src=play` too. Notifications are on (the daily reminder works through Chrome), and the fallback
  is a Custom Tab. The signing key is never in the repository.
- `make.sh`: fills that file into a folder outside the repository and builds with the pinned Bubblewrap CLI
  (`npx @bubblewrap/cli@1.27.0`, downloaded on the owner's computer; nothing is added to the repository).
- The Worker answers `/.well-known/assetlinks.json` from `ANDROID_PACKAGE` and `ANDROID_CERT_SHA256` in
  `worker/wrangler.toml` (`worker/src/assetlinks.js`). While they are empty it answers `[]`, and the app opens with an
  address bar, which is how you can tell the link is missing.

## Steps (OWNER-ONLY)

0. **Before anything:** the site is deployed at `PUBLIC_URL` (https), and the name in `shared/brand.js` is confirmed
   (see `../README.md`, step 0).
1. **Install once:** Node 20 or later. Run `npx --yes @bubblewrap/cli@1.27.0 doctor`; on the first run Bubblewrap
   offers to download the JDK and the Android SDK it needs. Say yes.
2. **Choose the package id**, e.g. `il.<your-domain>.madregot`. It can never change after the first upload.
3. **Build:**
   ```bash
   ANDROID_PACKAGE=il.example.madregot PUBLIC_URL=https://madregot.example bash madregot/store/android/make.sh
   ```
   - The first run makes the upload key at `~/.madregot/android-upload.keystore` (or `KEYSTORE=…`). Keep the key and
     both passwords safe and backed up outside the repository.
   - The output is in `~/madregot-android/` (or `TWA_DIR=…`): `app-release-bundle.aab` for Play and
     `app-release-signed.apk` to try on a phone.
   - Every later upload needs `ANDROID_VERSION_CODE` one higher (2, 3, …) and, if you like, a new `ANDROID_VERSION_NAME`.
4. **Play Console:** upload the `.aab` to internal testing. Then open Test and release › App integrity › App signing,
   and copy the **SHA-256 certificate fingerprint** of the app signing key.
5. **Asset links:** in `worker/wrangler.toml`, set
   ```toml
   ANDROID_PACKAGE = "il.example.madregot"
   ANDROID_CERT_SHA256 = "<Play's SHA-256>,<the upload key's SHA-256>"
   ```
   (`make.sh` prints the upload key's SHA-256 at the end. It is needed only to try the `.apk` from step 3 directly.)
   Deploy, then check that `curl -i <PUBLIC_URL>/.well-known/assetlinks.json` answers `200`, with
   `content-type: application/json` and your package. Open the app from internal testing: there must be no address bar.
6. Go on with `../README.md` (closed test, listing, Data safety, submission).
