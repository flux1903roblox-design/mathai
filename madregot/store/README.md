# App Store screenshots

Five frames for the iPhone 6.7" display (1290 × 2796, JPEG, no transparency), one benefit each, in order:

| File | Headline | Line under it |
|---|---|---|
| `iphone-6.7-1-numberline.jpg` | מזיזים את המתמטיקה בידיים | גוררים, רואים מה קורה, ובודקים. |
| `iphone-6.7-2-map.jpg` | עולם לכל נושא | מפה של מדרגות, מכפור ואש ועד פירמידות. |
| `iphone-6.7-3-hint.jpg` | רמז שמצויר על התרגיל | מדי מראה איפה לחפש, בלי לגלות את התשובה. |
| `iphone-6.7-4-climb.jpg` | מדרגה אחרי מדרגה | כל שיעור מעלה את מדי עוד צעד. |
| `iphone-6.7-5-topics.jpg` | שישה נושאים, 33 מדרגות | כיתות ז׳ וח׳, כמה דקות ביום. |

Every screen inside the phone is the real app (a no-server build), captured at 430 × 932 at 3x: nothing is mocked. The framing follows the stageshow skill's rules: one thing said per frame, the product big and running off an edge, no plate behind it, real words only where the story is.

To make them again, in an empty working folder: `node <this folder>/capture.cjs store` (it builds the app without a server, serves it on port 4238 and saves the five screens, `raw-*.png`), then `node <this folder>/frames.cjs` (the frames, `store-*.png`); convert them to JPEG for the store. `--dist <folder>` reuses a build made with `VITE_API_URL=none`.

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

Build it with `VITE_STORE=ios VITE_API_URL=<PUBLIC_URL> npx vite build --base ./ --outDir dist-ios` in `web/` (the
Capacitor project's `make.sh` runs this). The tests: `web/e2e/store-mode.spec.js` (the Play Store app, phone) and
`web/e2e/store-ios.spec.js` (the `ios` Playwright project, which builds `dist-ios-test` on its own port).

The product's name is `APP_NAME` in `shared/brand.js`: the web manifest, `index.html`, the landing pages and (from the
listing stage) the store listing read it, so a rename is one line and new screenshots.
