# The store apps, their listing and their pictures (STUDENT-12)

What is here, and what each piece is for:

| Path | What | Made by |
|---|---|---|
| `listing.he.json` | the listing text to paste: App Store (name, subtitle, promotional text, keywords, description) and Play (title, short and full description), plus the English review notes for each store | `node madregot/store/make-listing.mjs` |
| `description.he.md` | the description's template; `{{TOPICS_7}}` and `{{TOPICS_8}}` are filled from the app's own topics, and `{{CLAIM id}}` from the checked claims (`web/src/content/claims.js`) | edited by hand |
| `apple/iphone-6.9-1…5-*.jpg` | App Store screenshots, iPhone 6.9": 1320 × 2868 JPEG, no alpha | `node madregot/store/capture.cjs store` |
| `apple/icon-1024.png` | App Store icon, 1024 × 1024, no alpha | the same |
| `play/phone-1…5-*.png`, `play/phone-dark-3-map.png` | Play phone screenshots, 1080 × 1920, and one in dark mode | the same |
| `play/feature-graphic.png`, `play/icon-512.png` | Play feature graphic (1024 × 500) and icon (512 × 512), no alpha | the same |
| `../web/public/screens/*.png` | the web manifest's screenshots (the install sheet): three 1080 × 2340, one 1920 × 1080 | the same |
| `privacy-answers.md` | **DRAFT** answers for Play's Data safety and Apple's App Privacy, per mode | by hand, from the schema |
| `android/` | the Play Store app (a Trusted Web Activity): `twa-manifest.json`, `make.sh`, its README | |
| `ios/` | the iPhone app (Capacitor around the `VITE_STORE=ios` build): `capacitor.config.json`, the pinned `package.json`, `PrivacyInfo.xcprivacy`, `make.sh`, its README | |

`web/scripts/listing.test.mjs` checks the listing against the stores' limits (Apple: name and subtitle 30, promotional
text 170, keywords 100 with no space after a comma, description 4000; Play: title 30, short 80, full 4000), finds no
English letters in the Hebrew (except XP), none of "הכי", "מספר 1", "כל תכנית הלימודים" or "100%", and checks that every
topic named is one the app teaches and that the file is what `make-listing.mjs` writes today.

## The screenshots

Five frames, one benefit each, in this order (headline, then the line under it):

| # | Headline | Line under it | The real screen |
|---|---|---|---|
| 1 | טעות? מדי מראה מה כנראה קרה | ונותן עוד ניסיון, בלי לגלות את התשובה | a coordinates exercise answered with x and y swapped: "עוד לא" and "מה כנראה קרה" |
| 2 | מזיזים את המתמטיקה בידיים | ציר מספרים, מערכת צירים, זוויות | the number line, the marker moved +5 |
| 3 | יחידה לכל נושא | 9 נושאים לכיתות ז׳ וח׳ (the count is the app's) | the home path, each unit in its own colour |
| 4 | מבחן ביום חמישי? יש תוכנית | חזרה לפי הימים שנשארו, ושבת חופשית | the Exam Rescue plan for next Thursday |
| 5 | המדי שלכם | צבעים ואביזרים מכל מה שלמדתם | מדי's wardrobe |

Every screen inside the phone is the real app: the build with no server (`VITE_API_URL=none`), driven by Playwright with
the QA hooks (`madregot-debug`), in light mode, at 390 × 844 at 3x; nothing is drawn by hand. The frames use the app's
tokens (the brand tint behind, ink for the headline) and Rubik. Every phone in a set starts at the same height.

To make them again after a screen changes:

```bash
node madregot/store/capture.cjs store                 # builds the app, takes the screens, writes every image above
node madregot/store/capture.cjs store --raw /tmp/raw --no-frames   # only the bare screens (kept in /tmp/raw)
node madregot/store/frames.cjs /tmp/raw               # only the frames, from screens already taken
node madregot/store/capture.cjs store --only map      # one scene, to look at it (map, mistake, numberline, rescue, wardrobe)
```

`--dist <folder>` reuses a build made with `VITE_API_URL=none`; `CAPTURE_PORT` (default 4238) is the preview's port.

## Owner steps (OWNER-ONLY)

Nothing below can be done from the code. Each step says where its code side is.

0. **The name.** `PRODUCT.md` still calls "מדרגות" a working name. Before any listing:
   - confirm the name;
   - search the Israel Patent Office's trademark database for conflicts in class 9 (apps) and class 41 (education),
     and search both stores for apps with the same or a similar name.
   A rename is one line, `APP_NAME` in `shared/brand.js`, then `node madregot/store/make-listing.mjs` and
   `node madregot/store/capture.cjs store`.
1. **Fill `PUBLIC_URL`** (and `CONTACT_EMAIL`, `BUSINESS_NAME`) in `worker/wrangler.toml` and deploy. Then run
   `node madregot/store/make-listing.mjs` again: the description gains its privacy line (`<PUBLIC_URL>/#/privacy`).
2. **Google Play** ($25, once). Choose one account type:
   - **personal account** (created after 13 Nov 2023): Play requires a **closed test with at least 12 testers opted in
     for 14 days in a row** before you can apply for production. The testers are adults with Google accounts (the
     pilot teachers' adult contacts, your family), never the students;
   - **organisation account**: needs a D-U-N-S number for the business, and has no 12-tester rule.
   Then:
   1. Create the app (default language Hebrew, app, free).
   2. Build and sign it: `android/README.md` (the package id, `make.sh`, the upload key kept outside the repository).
   3. Upload the `.aab` to internal testing; then (personal account) to closed testing with the 12 testers.
   4. Copy Play App Signing's SHA-256 into `ANDROID_CERT_SHA256` and the package into `ANDROID_PACKAGE`
      (`worker/wrangler.toml`), deploy, and check `/.well-known/assetlinks.json` (`android/README.md`, step 5).
   5. Data safety and target audience: from `privacy-answers.md` (target ages 9–12 and 13–15; the Families Policy).
   6. Countries: **Israel only**.
   7. Store listing: paste `listing.he.json` › `play` and upload `play/*` (five phone screenshots, the dark one, the
      feature graphic, the icon). Category Education. The privacy policy address is `<PUBLIC_URL>/#/privacy`.
   8. Review notes (App content › App access): paste `reviewNotes.play`.
   9. After the 14 days (personal account), apply for production and submit.
3. **Apple** ($99 a year; needs a Mac with current Xcode). The iPhone app is Capacitor's shell around the
   `VITE_STORE=ios` build: `ios/README.md` (the settings, `make.sh`, the privacy manifest, local reminders, haptics).
   1. Enrol in the Apple Developer Program; create the bundle id and the App Store Connect record (iPhone only).
   2. Build with `ios/make.sh` (one command), then archive and upload from Xcode (`ios/README.md`, steps 3-5).
   3. App Privacy: from `privacy-answers.md` (it names Anthropic as the third party that receives what a student types or
      photographs for the AI). Age rating: answer the questionnaire on the day. Not the Kids category.
   4. Availability: **Israel only**. Paste `listing.he.json` › `apple`, upload `apple/*`, and paste `reviewNotes.apple`
      into App Review Information.
   5. Submit.
4. **On the submission day**, read again Apple's guidelines 3.1.1, 3.1.3 and 5.1.2 and Google Play's Payments and
   AI-Generated Content policies, and check that the store builds still do what this file says. Then record Play's
   pre-launch report and the TestFlight build number here.

Merges this lane's store submission waits for (each named in `privacy-answers.md`): TRUST-4 (report an AI answer, which
Play's AI policy requires), TRUST-9 (the free parent OK), TRUST-1 (the data map), TEACHER-1 (a teacher can delete the
account in the app; Apple 5.1.1(v)). The listing and the review notes say only what the code has: `make-listing.mjs`
asks the same checked claims as the landing pages (`web/src/content/claims.js`), so the teachers' line names
assignments, and the review notes name reporting an AI answer and the parent's OK, only once those lanes have merged.
Run `node madregot/store/make-listing.mjs` again after a merge and paste what it writes.

## Landing page pictures

`node madregot/store/capture.cjs landing` makes the pictures of the landing pages (STUDENT-13) in `web/landing/img/`:
`phone-rescue.webp` and `phone-teacher.webp` (Exam Rescue and the teacher's board in a phone, 1080 wide, at most 70 KB,
WebP encoded by Chromium's canvas in the page) and `og-mivchan.png` / `og-pilot.png` (the link previews, 1200 × 630).
The teacher's board needs a server, so `page.route` answers it with a synthetic class (first names only). Run it again
after a screen it shows changes; `npm run build` copies the files into `dist/l/`.

## Store mode inside the app (STUDENT-12)

The store apps sell nothing, so neither Play Billing nor Apple 3.1.1 applies. `canSell()` (`web/src/lib/price.js`) is
false in a store app: the iPhone build (`VITE_STORE` set at build time) and the Play Store app (opened with `?src=play`
and running standalone; the same phone's ordinary Chrome tab is not a store app). Then:

- the tutor's limit sheet says only when the questions come back ("סיימתם את השאלות לעוזר החכם להיום. מחר יש עוד.
  השיעורים, התרגול ומדי פתוחים תמיד."), and no sheet or locked tool links to the parents' pages;
- Settings has no "חיבור למנוי משפחתי" and no "ביטול מנוי" row; "מידע להורים" stays;
- `/parents`, `/parents/link`, `/parents/info` and `/cancel` show one page, "מידע להורים", with the sentence about the
  parent's free one-time OK (TRUST-9's QR code and link go under it when that lane merges); no plan, price,
  subscription or website;
- the first screen has no "להורים" or "ביטול מנוי" link, and the teacher's licence card offers a trial or a quote (by
  invoice) but no card purchase and no price.

The iPhone build only (`VITE_STORE=ios`):

- the family plan is not used (Apple 3.1.3(b)/(c)): the family-device token is never sent and the family rows are
  hidden. `VITE_STORE_FAMILY=1` turns it back on, for the day the owner sells the plan by Apple in-app purchase;
- before the first AI request the app asks, naming Claude by Anthropic, what is sent and to the US, and what is never
  sent or kept (Apple 5.1.2(i)); "לא עכשיו" sends nothing, "כן, להמשיך" is kept in `ai.consentAt`;
- no service worker is registered (WKWebView runs none on `capacitor://`, and the files are on the phone);
- the Worker allows the app's origin, `capacitor://localhost`, in `ALLOWED_ORIGINS` (`worker/wrangler.toml`).

- the daily reminder is a local notification on the phone (`web/src/lib/localReminder.js`; `pushState()` answers
  `store-ios` first, so Settings never tells the student to add the app to the Home Screen), and the phone's own
  haptics play (`web/src/lib/sound.js`), both through the shell's bridge (`web/src/lib/native.js`);
- each day's first open counts `store_open_ios` once (STUDENT-14); the Play Store app counts `store_open_play` the
  same way (`web/src/lib/install.js countStoreOpen`).

`ios/make.sh` builds it (`VITE_STORE=ios VITE_API_URL=<PUBLIC_URL> npx vite build --base ./`) into the Capacitor
project. The tests: `web/e2e/store-mode.spec.js` (the Play Store app, phone) and `web/e2e/store-ios.spec.js` (the `ios`
Playwright project, which builds `dist-ios-test` on its own port, with a stand-in for the shell's bridge).

The product's name is `APP_NAME` in `shared/brand.js`: the web manifest, `index.html`, the landing pages, the store
listing (`make-listing.mjs`), the Play app (`android/make.sh`) and the feature graphic read it, so a rename is one line,
a new listing and new screenshots.
