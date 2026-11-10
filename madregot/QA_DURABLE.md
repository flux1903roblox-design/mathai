# QA: durable progress

What protects a student's saved progress, how each part is tested, and the limits that remain. The full before/after
table of the council's probes comes with the proof pack (DURABLE-15); this file starts with the parts built so far.

## Two tabs on one device (DURABLE-2)

- **What happens.** Each save carries `meta.seen` (for each tab, the last of its saves this one includes) and a stamp
  under `madregot:rev` ("7 a1b2c3d4": the revision and the tab). A tab that receives another tab's `storage` event
  loads that save when it holds everything the tab has, or merges the two (`mergeTabs`, an exact three-way merge from
  the newest copy both grew from) and saves the merge. Before every save the stamp is checked, so a tab that saves
  before the other tab's event reaches it merges instead of replacing.
- **Tests.** `web/src/lib/durable/tabs.test.js` (two real stores on one storage: cases (a) to (e), a late event, three
  tabs, "delete all" in another tab), `merge.test.js` (the three-way property test with the store's own actions),
  `e2e/durable.spec.js` (the council's probe reversed, with and without the event, and a lesson finished in each tab).
- **Honest limit.** localStorage in Chromium is cached per page and kept in step by messages, so two tabs can save
  within the same few milliseconds without seeing each other. The next event or save catches that, so nothing is lost.
  With three or more tabs racing in the same instant, an additive counter (XP, today's lessons) can at worst be counted
  twice. It is never lost.
- **Across devices** (`mergeDevices`, used by every restore): every counter takes the larger value, so a lesson done
  on each of two devices on the same day counts once in that day's `lessons`. The streak, the stairs and the total XP
  (a per-device counter, `xpBy`) are exact.

## A backup file anyone can keep (DURABLE-4)

- **What happens.** Settings › שמירת ההתקדמות › "לשמור קובץ גיבוי" shares the file where the browser can share files
  and downloads it everywhere else. The file holds the whole progress except what belongs to the device (the tutor, the
  class outbox, the save settings, the backup settings, the class token and the student id); a teacher's file keeps the
  class keys, and the teacher's note says so. "לשחזר מקובץ" (and "יש לי קובץ גיבוי" on the first screen, which needs no
  server) checks the size, the JSON, that it is a Madregot backup, and that it is sound after the migrations, then
  shows what it holds. An empty device takes it; the same student's progress is merged (nothing lowered, no undo);
  another student's replaces the progress here only after "להחליף", keeps the old progress in quarantine and offers
  "לבטל את השחזור האחרון" for 30 days. A replace lets go of the vault, so a sibling's progress never reaches the first
  child's vault; undo brings the old backup settings back with `forcePush`.
- **Tests.** `web/src/lib/durable/file.test.js`, `apply.test.js`, `components/durable/SaveSection.test.jsx`,
  `e2e/backup-file.spec.js` (download, share sheet, a fresh browser restoring through the first screen, the same
  student, a sibling with undo, refusals, keyboard).
- **Evidence.** `qa-evidence/durable/restore-preview-{empty,same,other}.png` (390x844).
- **Note for a test machine.** Chromium keeps a download's Hebrew name only when the system locale is UTF-8 (phones
  and computers are); on the POSIX locale it names the file "download". The e2e launches its browser with C.UTF-8.

## Kept by the browser, installable, and honest about where the data lives (DURABLE-3)

- **Asking the browser to keep the data.** After the first finished lesson or check (LessonDone, CheckDone) the app
  reads `navigator.storage.persisted()`; when the browser has not promised and this device was never asked
  (`durable.persistAsked`), it calls `persist()` once and notes when. Firefox prompts for it, so there it is asked
  only from Settings › שמירת ההתקדמות › "לבקש מהדפדפן לשמור". The answer is read again on every open and whenever the
  app comes back into view, and Settings shows it as it is: "כן", "לא מובטחת", or "לא ידוע" where the browser cannot
  say (WebKit can answer false, bug 271401).
- **Installable.** `web/public/manifest.webmanifest` (name, `lang`/`dir`, `start_url ./#/`, `scope ./`, `display:
  standalone`, white colours, icons 192, 512 and a maskable 512). The icons are drawn from the favicon by
  `web/scripts/make-icons.mjs` with Playwright's Chromium (run it again after the favicon changes). The iPhone icon
  (`icons/180.png`) and the maskable one are full bleed on #1A5CF5, because iOS paints transparent corners black.
  `index.html` links the manifest, the apple-touch-icon and `apple-mobile-web-app-title`; `_headers` serves the
  manifest as `application/manifest+json` on Cloudflare.
- **The iPhone guide.** On an iPhone or iPad in the browser, Settings has "להוסיף למסך הבית", and Learn shows one quiet
  card from the 3rd day the student learned (then not for 30 days: `durable.installHintAt`). Its first step saves the
  backup file, because a Home Screen app keeps its data apart from Safari; the last step opens it with "יש לי קובץ
  גיבוי". (With a server, the backup code takes the first step's place when it exists, DURABLE-5.)
- **Where the data lives, said once.** `web/src/lib/durable/copy.js` `whereSavedText` is the only sentence about it:
  MyNumbers (on the profile) and the end of Settings use it. No server: "ההתקדמות נשמרת במכשיר הזה. כדאי לשמור קובץ
  גיבוי מדי פעם." A student alone: "ההתקדמות נשמרת רק במכשיר הזה." A class student: the trust lane's sentence (the
  answers go to the teacher's board too). A family device hears the solo sentence until its progress has a server copy
  (DURABLE-6). Nothing says "מוצפן".
- **Tests.** `web/src/lib/durable/{persist,copy,install}.test.js`, `components/durable/SaveSection.test.jsx`,
  `e2e/install.spec.js` (the manifest and every icon's PNG size, one ask after the first lesson and none after a
  reload, an iPhone user agent with three days on Learn, the honest copy for no server, solo and class).
- **Evidence.** `qa-evidence/durable/save-section-{none,solo,class}.png` (Settings, whole page, 390 wide),
  `install-card.png` and `install-sheet.png` (390x844).
- **Owner checks (optional, once).**
  - GitHub Pages ignores `_headers` and serves the manifest by its extension: `curl -sI <pages-url>/manifest.webmanifest`
    and note the Content-Type here (browsers accept `application/json` for a manifest too).
  - Chrome DevTools › Application › Manifest on the deployed site shows no installability errors.
  - On a real iPhone, run the four steps of the guide once and confirm the progress arrives in the Home Screen app;
    if iOS's menu labels differ from the ones quoted in step 2 and 3, only those labels change
    (`components/durable/InstallSheet.jsx` `INSTALL_STEPS`).

## Error monitoring with no third party (DURABLE-9)

- **In the app** (`web/src/lib/monitor.js`, imported first by `main.jsx`). It hears the window's `error` and
  `unhandledrejection`, `ErrorBoundary.componentDidCatch` (kind `render`, with the nearest component), parts of the app
  that failed to load (kind `chunk`: the page reloads once when online, not again within 60 s), the safe write path
  (kind `storage`: quota, parse, mirror) and `securitypolicyviolation` (kind `csp`: the directive and the blocked
  origin only). A record is `{ kind, name, message, frame, route, agent, n }`: the message scrubbed (digit runs, emails,
  keys, long hex) and clipped to 200 characters; the frame is `file:line:col` of our own `/assets/*.js`; the route is
  the screen's pattern from `App.jsx` (`/lesson/:topic/:level`, never its values); the agent a coarse class
  (`android-chrome-131`). One report per failure a page, at most 10 a page load, sent 10 s after the first or with
  `sendBeacon` when the page is hidden (within the keepalive budget, after the class outbox), as `text/plain` so there
  is no CORS preflight. Nothing is sent with no server or with `VITE_MONITOR=off`; every record is also kept in the
  device's errors ring (IndexedDB, the last 20), which "delete all" deletes.
- **On the server** (`worker/src/errors.js`, `POST /api/errors`). At most 8 KB; an unknown kind is 400; the scrubbing
  is repeated; rows are counted per `(day, fp, release, agent, route)` in `client_errors` (migration `0003_durable.sql`).
  Caps: 100 items a day per network, 20,000 a day for all; beyond them 202 and dropped. The Worker's own unhandled
  exceptions are counted as kind `server` under the route's pattern (`/api/billing/webhook/:provider/:secret`, never the
  path). No column holds a device id, an address, a name or a route value. Kept 30 days.
- **The owner.** The daily summary has the day's total and the 5 most frequent; more than 300 reports in a day, or more
  than 100 of one failure, queue a notice that night (`owner:errors:<day>`); `npm run owner -- errors [--days 7]`
  prints a table. A sample from the in-memory database of the tests (synthetic reports):

  ```
  $ npm run owner -- errors --days 7
  count  kind     route      release  agents  name       message                                                       frame
  -----  -------  ---------  -------  ------  ---------  ------------------------------------------------------------  ------------------
  3      render   /me        055dcb4  2       Error@Me   QA: a test error while the profile renders                    Me-B2x9k.js:1:4521
  1      chunk    /settings  055dcb4  1       TypeError  Failed to fetch dynamically imported module: https://madreg…
  1      storage  /          055dcb4  1       quota      localStorage is full
  ```
  (The two time columns, `first` and `last`, are left out here. The same command on a local Worker after the e2e
  belongs to the proof pack, DURABLE-15.)
- **For families.** Settings › מידע לתמיכה: the build, the saving, whether the browser promised to keep the data, the
  room used, the backup, and the last 5 errors on this device; "להעתיק לתמיכה" copies them as plain text. No name, no
  code.
- **Tests.** `web/src/lib/monitor.test.js` (scrubbing, every route of `App.jsx` has its pattern, dedupe, the cap, no
  server sends nothing, sendBeacon within the budget, the reload guard), `components/durable/SupportInfo.test.jsx`,
  `worker/test/errors.test.js` (counts, unknown kind, server-side scrubbing, the network cap, no column with the test
  address, the webhook path stored as its pattern, the 31-day purge, the summary's top 5 and the notice, the owner's
  table), `e2e/monitor.spec.js` (the QA hook `?qa-throw=render` in the profile: the error screen, one `POST
  /api/errors` of kind `render` for `/me`, and מידע לתמיכה listing it; and no request at all without a server).
- **Evidence.** `qa-evidence/durable/support-info.png`, `error-screen.png` (390x844).
- **For the trust lane's privacy notice:** "כשמשהו לא עובד באפליקציה, נשלח לשרת דיווח תקלה קצר: איזה מסך, איזו שגיאה
  ואיזה סוג דפדפן. בלי שם, בלי מזהה מכשיר ובלי כתובת רשת. הדיווחים נשמרים 30 יום."
