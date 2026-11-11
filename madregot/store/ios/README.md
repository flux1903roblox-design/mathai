# The iPhone app (Capacitor)

The iPhone app is the app's own files on the phone (the `VITE_STORE=ios` build) inside Capacitor's native shell. It
works fully offline (lessons, practice, checks), sends its daily reminder as a local notification, plays the phone's
haptics, and never shows browser UI: Apple 4.2's "native value". Everything below is OWNER-ONLY; the code side is done:

- `capacitor.config.json`: the shell's settings, reviewed with the code (`<IOS_BUNDLE_ID>` and `<APP_NAME>` are filled
  by `make.sh`). The pages load from `capacitor://localhost`, which the Worker allows (`ALLOWED_ORIGINS` in
  `worker/wrangler.toml`, tested by `worker/test/cors.test.js`).
- `package.json`: the Capacitor packages, pinned on 11 Nov 2026 (`@capacitor/core`, `ios` and `cli` 8.5.3,
  `local-notifications` 8.3.1, `haptics` 8.0.2, `app` 8.1.2; each released at least two weeks before). They are installed
  in `IOS_DIR` on the owner's Mac, never in `web/`: the web app bundles no Capacitor code and talks to the plugins
  through the bridge the shell puts in the page (`window.Capacitor.nativePromise`, `web/src/lib/native.js`).
- `make.sh`: one command from the repository to an Xcode project (below).
- `PrivacyInfo.xcprivacy`: the app's privacy manifest: no tracking, no tracking domains, no data collected by the app
  itself, no required-reason API in the app's own code. The plugins ship their own manifests.

What the iPhone build does differently (all tested in `web/e2e/store-ios.spec.js`, the `ios` Playwright project, and
the unit tests named):

- **Nothing is sold** and no family plan is unlocked (Apple 3.1.1, 3.1.3(b)/(c)); see `../README.md`, "Store mode".
- **AI permission first** (Apple 5.1.2(i)): the sheet that names Claude by Anthropic and what is sent comes before the
  first AI request.
- **Daily reminder = local notifications** (`web/src/lib/localReminder.js`, `localReminder.test.js`): at the hour the
  student chooses in Settings (16:00-20:00), on each of the next 60 days (iOS keeps at most 64 pending), never on
  Shabbat, Yom Tov, the memorial days or Tish'a B'Av or on their eve, and not on a day the student already learned (a
  finished lesson cancels today's). Every first open of a day schedules the 60 days again. No server and no push keys.
  If the student turns notifications off for the app in the phone's settings, Settings says so.
- **Haptics** (`web/src/lib/sound.js`, `sound.test.js`): a light tap for a right answer, a warning for "not yet", a
  success at the end of a lesson and at the daily goal; only when "רטט" is on in Settings and reduced motion is off.
- **No service worker**: WKWebView runs none on `capacitor://`, and the files are on the phone.
- **Counted**: one `store_open_ios` a day a device (STUDENT-14), nothing else.

## Steps (OWNER-ONLY)

0. **Before anything:** the Worker is deployed at `PUBLIC_URL` (https), and the name in `shared/brand.js` is confirmed
   (`../README.md`, step 0).
1. **Install once, on a Mac:** current Xcode (from the App Store; open it once and accept the licence), Xcode's command
   line tools (`xcode-select --install`), and Node 22 or later.
2. **Apple Developer Program** ($99 a year): enrol; in Certificates, Identifiers & Profiles create the bundle id (e.g.
   `il.<your-domain>.madregot`; it can never change); in App Store Connect create the app record with that bundle id
   (iPhone only, primary language Hebrew).
3. **Build:**
   ```bash
   IOS_BUNDLE_ID=il.example.madregot PUBLIC_URL=https://madregot.example bash madregot/store/ios/make.sh
   ```
   - It writes the project to `~/madregot-ios/` (or `IOS_DIR=…`), outside the repository.
   - The first run downloads the pinned packages and runs `npx cap add ios`. If it says so, drag
     `ios/App/App/PrivacyInfo.xcprivacy` into the App group in Xcode once, with the App target ticked.
   - Run it again after every change to the app: it rebuilds the web files and copies them in (`npx cap sync ios`).
   - `--config-only` checks the settings on any computer without building.
4. **Xcode:** open `~/madregot-ios/ios/App/App.xcodeproj` (or `App.xcworkspace` if there is one). In Signing &
   Capabilities choose your team. Set the version and build number (one higher for every upload). Then Product ›
   Archive, and in the Organizer: Distribute App › App Store Connect › Upload.
5. **Before submitting**, in the Organizer's archive: Generate Privacy Report. It must list no required-reason API
   without a reason. Then try the TestFlight build on a real iPhone: turn the reminder on in Settings for the next hour
   and see it arrive; finish a lesson and see that today's does not; answer a question and feel the tap.
6. Go on with `../README.md`, step 3 (App Privacy from `privacy-answers.md`, age rating, Israel only, the listing, the
   iOS review notes, submit).

If App Review objects to class licences unlocking the AI in the app (3.1.3(c) is worded for apps sold only to
organisations), the class AI in the iPhone build would need a switch that this branch does not have yet; see
`../../QA_STUDENT.md` §7.
