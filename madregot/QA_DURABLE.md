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

## The encrypted vault on the server (DURABLE-5, Worker)

- **What the server keeps** (`worker/src/vault.js`, tables `vaults` and `meters` in `0003_durable.sql`). A vault row is
  the SHA-256 of the 64-hex lookup token the app derives from the restore code, the sealed blob (base64url, 40 to
  349,526 characters, always a bound parameter), the previous blob for undo, `bytes`, and three times. No token, no code,
  no key, no address, no device id, no name: a test scans every table for the token and the test address.
- **Routes.** `POST /api/vault` (`ifRev: null` creates; `ifRev: n` is one compare-and-swap statement), `GET /api/vault`,
  `GET /api/vault/rev`, `POST /api/vault/delete`, all with the `X-Vault` header (allowed by CORS). A stale `ifRev` is
  409 with the current rev; an update of a vault that is gone is 404 `vault_gone`.
- **Caps.** Counted per class student or family device when the request carries a valid credential, per network only
  otherwise, so a school behind one address is never blocked. Lookups that find nothing: 20 a day, taken before the
  lookup and given back on a hit (updates and deletes count too, because their answer would tell whether a vault
  exists). Anonymous creates: 60 a day per network; all creates: 5,000 a day; writes: 300 a day per vault. The
  `VAULT_RL` binding (`[[ratelimits]]`, 120 a minute per credential or network) is checked before any database call.
- **Size breaker.** `meters.vault_bytes` changes in the same batch as the vault row, under the same guard. A create
  stamps `created_at` with a one-time value until the end of its batch, so the meter's guard can only match the row
  that batch inserted: with the spec's plain `created_at = now` guard, ten parallel creates of one new vault in the
  same millisecond counted it up to ten times (the test "10 parallel creates of one new vault" fails that way). New
  vaults stop at `VAULT_MAX_MB` (200 by default) with 503 `vault_full`; existing vaults keep updating. The owner gets
  `owner:vault:70` once a month at 70%. Every night the meter is recomputed from `SUM(bytes)`; a drift becomes
  `owner:vault_drift:<day>`.
- **Retention.** Deleted when both the last write and the last read are more than 400 days ago; a read writes `read_at`
  at most once a day. `VAULT = "off"` answers 503 `vault_off` (deleting still works). `/api/health` adds `vault` and
  `vaultFull` (true when the largest backup would no longer fit; never the meter's value). The daily summary adds
  `vaults { count, mb, newYesterday }`. `forgetVault(env, req)` gives TRUST-6's `/api/me/forget` the statements that
  delete the vault and its bytes in its one batch.
- **Tests.** `worker/test/vault.test.js`: create and update (rev 2, `prev_blob`), stale `ifRev`, 20 parallel updates
  with one `ifRev` (exactly one 200), 10 parallel creates of one id (the meter counts it once), 50 parallel wrong
  lookups from one network (at most 20 reach the table), the school case (40 students and 10 anonymous devices behind
  one address all succeed), a family device counted as itself, 61 anonymous creates, the meter exact after 60 random
  parallel operations (three seeds), the meter blocking creates but not updates, the blob bounds, delete and
  `forgetVault`, `read_at` once a day and the purge at 399 and 401 days, the night job's drift notice and the summary,
  the rate-limit stub refusing before any database call, CORS, and the table scan. `schema.test.js` checks the tables'
  CHECKs and the meter's seed row; `logs.test.js` already forbids the vault's words in any log line.
- **Cost to watch.** Every vault read takes and gives back its miss counter, so a read that finds the vault is two small
  counter writes. With about 1,000 devices syncing all day, that approaches the D1 Free plan's 100,000 writes a day.
- **Owner steps.** At deploy, `cd madregot/worker && npm run db:migrate` (the new tables come with the existing step).
  Only on Workers Paid: raise `VAULT_MAX_MB` in `worker/wrangler.toml` (up to 3000) before `npm run deploy`; on the
  Free plan leave 200, because the whole database stops at 500 MB and it holds billing. `VAULT_SECRET` is needed only
  for the class and family copies (DURABLE-6).
- **For the trust lane's privacy notice:** "אם יוצרים קוד גיבוי, נשמר בשרת עותק מוצפן של ההתקדמות. רק הקוד פותח אותו,
  והוא לא נשמר אצלנו. עותק שלא השתמשו בו 400 יום נמחק, וגם 'להפסיק את הגיבוי' מוחק אותו."

## The backup code on the device (DURABLE-5, client)

- **The code** (`web/src/lib/durable/code.js`). 16 symbols of the Worker's class-code alphabet (a test reads
  `worker/src/util.js` and pins them equal): 15 random (rejection sampling) and a check symbol `Σ (i+1)·v_i mod 31`,
  shown as `ABCD-EFGH-JKMN-PQRS`, left to right, in mono. `normalise()` takes any letter case, spaces, dashes (the maqaf
  and Unicode dashes too), direction and zero-width marks, and the Hebrew keyboard (SI-1452, with ׳ and ’ for W), and
  answers `typo` or `chars` before any network call.
- **The cryptography** (`crypto.js`, WebCrypto only). PBKDF2-SHA-256, 100,000 iterations, salt `madregot-vault-v1`,
  512 bits: an AES-256-GCM key that cannot be exported and a 64-hex lookup token (the `X-Vault` header), made once per
  code in a session. `seal()` is gzip, then AES-GCM with a random 12-byte IV and the additional data
  `madregot-vault-v1`, as `base64url(0x01 | iv | ciphertext)`; `open()` throws `VaultOpenError` on any failure. The
  council's heavy year seals well under 256 KiB; a copy over it is compacted and sealed again, and when it is still over,
  the backup says "הגיבוי גדול מדי. שמרו קובץ במקום." and the file is the way.
- **The sync** (`vault.js`, on the moments of `moments.js`, only with a server and the backup on): boot, tick and online
  pull then push; visible pulls; lesson and hidden push (hidden with keepalive only on the same address and within the
  hidden moment's budget, after the family summary and the class outbox). A pull merges forward with
  `applyRestored(…, 'vault', { merge: true })` (logged `{ e: 'merge', m: 'vault' }`; a deliberate reset on either side
  wins) and never merges another student's copy (`other_student`: nothing merged or pushed until the student chooses).
  A push is skipped when the SHA-256 of the copy is the one pushed last. 409: pull, merge, push again, at most 3 times,
  then `error` and a `vault/conflict_loop` report. 404 `vault_gone`: made again with the same code, and Settings says
  so once. 429: quietly idle. After an undone restore (`forcePush`) the server's copy is pushed over, never pulled.
  Every call carries `X-Vault`, the class Bearer when there is one and `X-Family-Device` when the device is linked.
- **Beyond the spec: two devices settle.** When the copy a device pulls already holds everything that device has, the
  pull counts as pushed. Without that, each pull's own merge line made a new copy, and two devices sent each other the
  same progress at every moment, forever. The unit test "two devices settle" shows the posts stop.
- **Settings › שמירת ההתקדמות › גיבוי.** The state ("כבוי", "פועל · עודכן לפני 3 דקות", "פועל · מחכה לאינטרנט",
  "הגיבוי גדול מדי. שמרו קובץ במקום.", "פועל · ננסה לעדכן שוב בקרוב", "מושהה"), "ליצור קוד גיבוי" with the note on
  what the code keeps, then "להציג את קוד הגיבוי" and "להפסיק את הגיבוי" (after a confirmation: the copy on the
  server is deleted). The other-student note offers "ליצור קוד חדש" and "להשאיר כך"; both let go of that vault and
  delete nothing (it is the other student's). `BackupCodeSheet`: the code, a QR code of the bare code
  (`components/QrCode.jsx`, shared with the hand-over screen), "לשלוח להורים" (the share sheet with the text, or a copy),
  "להעתיק", "שמרתי". The where-it-lives sentence gains "ההתקדמות נשמרת במכשיר, ועותק מוצפן שרק הקוד שלכם פותח נשמר
  בגיבוי." ("מוצפן" only for this copy); מידע לתמיכה shows the backup's state, never its code.
- **Tests.** `code.test.js` (10,000 codes pass; every single substitution of 500 codes and every neighbour swap fail;
  the Hebrew keyboard; direction marks), `crypto.test.js` (round trip, a wrong code, a flipped byte, another additional
  data, a deterministic 64-hex lookup, the heavy year under 256 KiB), `vault.test.js` (a fake server in fetch: pull then
  push, a 409 merged and retried, a 404 made again, an unchanged copy not sent, offline, a conflict loop that stops,
  another student, 429, a copy that cannot be opened, forcePush, the identity headers, keepalive, two devices that
  settle, create, too big, stop and detach), `apply.test.js` (the merge mode), `copy.test.js`, `SaveSection.test.jsx`,
  `SupportInfo.test.jsx`; `e2e/restore.spec.js` (the fake server's in-memory vault: a code made in Settings, its
  sheet, the first copy created with `ifRev: null`, a lesson whose push reaches the vault and opens with the code,
  the code shown again, the backup stopped and the copy deleted, no request carrying the code; no server offers no
  code; a refusal keeps it off with a calm line).
- **Evidence.** `qa-evidence/durable/backup-code.png` (the sheet, 390x844), `save-section-backup-off.png`,
  `save-section-backup.png`; `save-section-solo.png` and `save-section-class.png` were taken again, since the section
  now has the backup row.

## Getting back in with the code, the backup question, and "delete all" (DURABLE-5, Stage 12)

- **The restore screen** (`web/src/screens/Restore.jsx`, `#/restore`, loaded on demand). It is routed before the role
  gate, next to the parents' area, so it works on a device with no profile and on one with a profile. The field
  "קוד הגיבוי" is left to right in mono, `autocomplete="off"`, with its label and the hint as its description; it fits
  19 symbols on one line at 320 px and never drops under 16 px (iOS would zoom). The check runs on the device first
  (`normalise()`, then `findCode()` for a whole pasted message): a typing mistake says "נראה שיש בקוד טעות הקלדה. בדקו
  אותו שוב.", a symbol that is not in a code says "בקוד יש רק אותיות באנגלית ומספרים מ־2 עד 9.", and neither reaches
  the network. Then `findVault()` derives, reads `GET /api/vault` and opens it ("פותחים את הגיבוי…" while it works);
  `vault_not_found`, `too_many_tries` and a copy the code does not open each have their sentence. `RestorePreview`
  says what the copy holds and what restoring does (the same rule as the file); after it, `adoptCode()` keeps the code
  on this device (backup on, the restored rev) and syncs at once. "יש לי קובץ גיבוי" switches to the file on the same
  screen; without a server there is only the file.
- **Ways in.** Welcome: "יש לי קוד גיבוי" beside "יש לי קובץ גיבוי" (with a server). The Home Screen app's first open
  puts a banner first: "פתחתם את מדרגות ממסך הבית? אם התחלתם בספארי, הדביקו את קוד הגיבוי וההתקדמות תעבור לכאן."
  with "להדביק קוד גיבוי", which reads the clipboard in the tap and fills the field when it holds a code (never other
  text); without a server the banner offers the file. Settings: "לשחזר מקוד או מקובץ". The file part of Settings keeps
  its own "לשחזר מקובץ", because the file's share text names that button.
- **The iPhone guide, step 1 with a server**: the code is made when there is none and copied in the same tap (Safari
  copies only inside a tap, so the clipboard is promised the code before the server answers: `copyWhenReady()`), then
  "יצרנו קוד גיבוי והעתקנו אותו." and the code itself, in case the clipboard said no. Step 4 and the note speak of the
  code. If the server cannot make a code, the file button appears under the reason.
- **The backup question** (`components/durable/BackupNudge.jsx`, `lib/durable/nudge.js`). Only with a server, no code
  and no kept copy, after two different days of learning, on the map, the missions, the topics or "אני" (never a
  lesson, a teaching stage, a repair, a check, Settings or a screen of its own), at most twice and 14 days apart. It
  opens 1.5 s after the screen settles, never over another sheet, and asking counts when it opens. "לקבל קוד גיבוי"
  makes the code and shows its sheet; "לשמור קובץ במקום" saves the file from the tap; "לא עכשיו".
- **"מחיקת כל הנתונים"** with the code on: `POST /api/vault/delete` with `X-Vault` first. If it fails, nothing is
  deleted here and the sheet says "לא הצלחנו למחוק את הגיבוי בשרת, ולכן לא מחקנו כלום." with the reason. Then the
  family link, a parent's session, `durableWipe()` and the reload. The sheet adds "גם הגיבוי המוצפן בשרת יימחק, וקוד
  הגיבוי יפסיק לעבוד." TRUST-6's `/api/me/forget` is not on this branch; when it lands, the vault rides in its one call
  (`forgetVault()` in `worker/src/vault.js`) and this first call goes.
- **"התנתקות מהמכשיר"** keeps the vault and says "הגיבוי בשרת נשאר. כדי לחזור להתקדמות, פותחים את מדרגות ובוחרים "יש לי
  קוד גיבוי"." Beyond the spec: before signing out, what was learned since the last update is pushed, if the server
  answers within 4 seconds.
- **The lost phone** (`e2e/restore.spec.js` (1), 390x844 and 320x568). Device A makes a code and finishes a lesson; a
  fresh browser types the code with dashes on Welcome › "יש לי קוד גיבוי":

  | | device A | device B after "להמשיך מכאן" |
  |---|---|---|
  | XP | 52 | 52 (and `xpBy` equal) |
  | stairs done | 0 | 0 |
  | mastered | 0 | 0 |
  | days (streak) | 2026-11-04, 2026-11-05 (2 lessons today) | the same days and counts |
  | path, progress, gaps, skills | | equal (the test compares them whole) |

  Then (2): B finishes a lesson and goes out of view; A comes back after two minutes and has B's lesson (3 today) and
  the same XP. (3) a typing mistake, a bad symbol, no network call. (4) "delete all" with a server that answers 500,
  then 200. (5) a sibling's code on a brother's device: read, never merged or written, and Settings shows the note.
- **Tests.** `nudge.test.js` (every condition), `code.test.js` (`findCode`), `vault.test.js` (`findVault`,
  `adoptCode`), `SaveSection.test.jsx`; `e2e/restore.spec.js` (cases 1-5, the Home Screen banner, the backup
  question twice), `e2e/install.spec.js` (step 1 with a server).
- **Evidence.** `qa-evidence/durable/restore-code.png`, `restore-preview.png`, `restore-done.png`, `backup-nudge.png`
  (390x844) and the same names with `-320` (320x568); `welcome-home-screen.png`, `install-sheet-code.png`;
  `save-section-backup.png` and `save-section-backup-off.png` taken again (the section has the new button).

## Several devices per class student, and escrow on the Worker (DURABLE-6, Worker half)

- **Tokens** (`student_tokens`). `studentFrom` (`entitle.js`) finds a class student by the token's row, joined to the
  student and the class; `students.token_hash` is no longer read, but `joinClass` and `resetPin` still write it, so an
  older Worker in a rollback lets the newest device in. `joinClass` inserts the new device's token and, in the same
  batch, deletes all but the newest 3 of that student (by `created_at`, then insertion order). `resetPin` and
  `removeStudent` delete every token of the student. A token's `last_seen` is written at most once an hour; the night
  purge drops tokens unused for 400 days and tokens whose student is gone. The migration copies every
  `students.token_hash` (with the student's `created_at` and `last_seen`), so no device is signed out by the deploy.
- **Escrow** (`vault.js`). The restore code sealed with AES-GCM under `HKDF(VAULT_SECRET, 'escrow-v1')`, with
  `escrow-v1|<owner kind>|<owner id>` as additional data (a sealed code copied into another owner's row does not open),
  stored as `base64url(0x01 | iv | ciphertext)`, 60 characters. `POST /api/vault/escrow` takes a class student's Bearer
  (one escrow per student) or `X-Family-Device` (one per device, with the device's label) and `{ code, lookup }`: the
  code must pass the app's check symbol and the vault must exist (404 `vault_not_found`); 30 writes a day per identity.
  `POST /api/vault/escrow/delete` removes the caller's own. Without `VAULT_SECRET`: 503 `server_config`, while joining and
  linking work as before (no code returned); `/api/health` says `escrow: true|false`. The server cannot check that the
  code opens the vault (that is the slow PBKDF2 on the device); a wrong pair only harms its own owner.
- **Class.** `joinClass`, after the atomic PIN check (or a PIN the teacher reset, which this join sets), adds
  `vault: { code }` when the student has an escrow whose vault still exists. `removeStudent` deletes the escrow and the
  tokens in its batch; `resetPin` keeps the escrow. Deleting a vault (`POST /api/vault/delete`, `forgetVault`) deletes
  its escrows in the same batch; the night's vault purge removes escrows whose vault is gone; the night purge removes
  escrows and tokens whose student is gone, and account escrows whose account is gone (the backstop for TRUST-6/7's
  paths, which are not on this branch).
- **Family.** `unlinkDevice` and `leaveFamily` set the device's escrow to `device_id = NULL` (kept in the account) in
  the batch, before the device row goes; `purgeFamilySql` does the same for the devices it deletes. `linkClaim` takes
  `restoreFrom` (an escrow of this account, else 404 `escrow_not_found`) and keeps it in `link_codes.restore_escrow`;
  `linkFinish`, in the batch that hands over the token, points that escrow at the new device and returns
  `vault: { code }`. `devices/this` has no link code to keep it in, so it moves the escrow in the batch that makes the
  token and returns the code at once. `GET /api/family/vaults` lists `{ id, label, device, updatedAt }` (never the
  code); `POST /api/family/vaults/:id/delete` deletes one (audited; the device itself is not affected).
  `forgetAccount` deletes the account's escrows; the export lists them (`id, label, deviceId, createdAt, updatedAt`).
- **Never the code** to a parent or a teacher: the tests read `GET /api/account`, `/api/account/export`,
  `/api/family/vaults` and `/api/teacher/dashboard` for any 16 symbols of the alphabet, the known codes and the sealed
  values. The `vault_escrow` table never holds the code itself.
- **Tests.** `worker/test/tokens.test.js` (two devices, the 4th join, a PIN reset, removal, last_seen hourly, the night
  purge, the migration copying old tokens), `worker/test/escrow.test.js` (sealing, the class rejoin with the right and the
  wrong PIN, the PIN reset, removal, the sweeps, the route's checks and the switch, the family flow with unlink, claim
  and finish, another account's escrow, devices/this, leaving, the parent's delete, account deletion, the export, the
  code never shown, no secret). `schema.test.js` checks `schema.sql` against the migrations (the `restore_escrow` column
  in the shape `ALTER TABLE` writes) and still runs twice.
- **Owner.** `openssl rand -hex 32`, then `cd madregot/worker && npx wrangler secret put VAULT_SECRET` (never in a file);
  `npm run db:migrate` (the same `0003_durable.sql`). Do not rotate the secret once escrows exist: every escrow sealed
  with the old one stops opening, and students then need their own code (a re-seal script is out of scope).

## The class and the family keep the code, on the device (DURABLE-6, client half)

- **One module** (`web/src/lib/durable/escrow.js`). `backup.escrow` says who keeps this device's backup code:
  `'class'`, `'family'`, `'both'` or none. `keepCode(kind)` makes a backup first when there is none (it pushes the first
  copy), then `POST /api/vault/escrow { code, lookup }`: the class with its Bearer only, the family with
  `X-Family-Device` only, so a class student on a family tablet gets one escrow of each. Another student's copy
  (`backup.state = 'other_student'`) is never handed over. A 503 `server_config` (no `VAULT_SECRET`) resolves
  `escrow_off` ("שמירת עותק בשרת עוד לא הוגדרה. שמרו את קוד הגיבוי."), said once as a quiet toast; nothing throws, so
  joining and linking go on.
- **Class rejoin.** `joinClass()` (Welcome) passes `r.vault` through; the profile never keeps it. Welcome's class step,
  on `r.vault`: derive, `GET /api/vault` with the new class token, then in one moment the profile (this student, this
  class, the goal just chosen) and `applyRestored(copy, 'class', { merge: true })`, then the code is adopted
  (`adoptCode(…, { escrow: 'class' })`, which syncs at once) and the app opens on the map with "ברוכים השבים לכיתה
  {className}. ההתקדמות שלכם חזרה." A copy that cannot be read lets the questions go on, and a new copy is kept at the
  end. With no `r.vault`, the class keeps the code once the profile is made (in the background, never in the way).
  Settings' class section does the same after its join; a device with progress of its own hears "ברוכים השבים לכיתה
  {className}. איחדנו את ההתקדמות מהכיתה עם מה שיש במכשיר הזה." Another student's progress on the device is never
  merged by a rejoin (the class's code is left alone).
- **Family.** After `pollLink()` says linked and after `linkThisDevice()`: with `r.vault` (the parent chose kept
  progress) the copy comes here, merged, or, when the device holds another name's progress, it replaces it with the
  30-day undo (the parent chose it); then "ההתקדמות עברה למכשיר הזה." Else the family keeps this device's code.
  `claimLink(code, label, restoreFrom)` and `linkThisDevice(label, { restoreFrom })` send the choice.
- **Parents page** (the block this lane supplies). Each linked device that syncs a kept copy has the line "ההתקדמות
  נשמרת · עודכנה {date}". "התקדמות שמורה" lists copies with no device: "{label} · עודכנה {date}", with "להעביר למכשיר
  חדש" (the link form opens with that copy chosen and its code field focused) and "למחוק" (a sheet: "למחוק את ההתקדמות
  השמורה של {label}?", "המכשיר עצמו לא מושפע. אי אפשר לבטל.", "למחוק" / "לא למחוק"). Every link form, and "המכשיר
  הזה", asks "להמשיך מההתקדמות של:" with each copy and "להתחיל מחדש" when the family keeps any; nothing is chosen for
  the parent, and linking without a choice says "בחרו אם להמשיך מהתקדמות שמורה או להתחיל מחדש.". `familyVaults()` and
  `deleteFamilyVault()` in `lib/parent.js`; the page never sees a code (the e2e reads the parent's page and storage).
- **Settings.** For a class student, the switch "שמירת עותק בשרת הכיתה" (`role="switch"`, a 48 px row, on while the
  class keeps the code). Off asks "להפסיק לשמור עותק בכיתה?" ("ההתקדמות תישאר במכשיר הזה ובקוד הגיבוי שלכם. בכיתה
  כבר לא יהיה עותק שאפשר להחזיר עם הקוד האישי.", "להפסיק" / "להשאיר"), then `POST /api/vault/escrow/delete` and
  `durable.escrowClass = false`; the backup code itself stays. On keeps the code again. The class note and the family
  note follow the spec's words. `whereSavedText`: the class sentence plus "עותק של ההתקדמות נשמר גם בשרת, כדי שתוכלו
  להמשיך מכל מכשיר עם הקוד האישי.", the family sentence "ההתקדמות נשמרת במכשיר, ועותק שלה נשמר בשרת דרך המנוי
  המשפחתי, כדי שאפשר יהיה להעביר אותה למכשיר חדש.", and for a student who left the class with a kept copy "ההתקדמות
  נשמרת במכשיר, ועותק שלה נשמר בשרת.". Stopping the backup and "delete all" leave out "מוצפן" when the code is kept.
  Welcome's class step adds the class sentence to its note.
- **Tests.** `web/src/lib/durable/escrow.test.js` (16: the class's join, rejoin on an empty device and with progress,
  another student, a copy that cannot be read, no secret, the switch both ways and a failed delete, the family's link,
  move and replace with the undo, the code only on the escrow route), `copy.test.js` (each new sentence, never
  "מוצפן"). `e2e/restore.spec.js`: the class (A joins in the first questions, two lessons, the vault holds A's XP;
  Settings' switch, note and sentence; a fresh phone with a wrong PIN and then the right one is back with `saved().xp`
  equal to A's and a new token; A turns the switch off), the family (A linked by the parent's phone and its code kept,
  the device line, unlinked to "התקדמות שמורה", the delete sheet kept, "להעביר למכשיר חדש" on a new phone that gets A's
  progress), and a family-device seed whose Settings and profile never say "מוצפן". The fake server
  (`e2e/fakeServer.js`) joins class K7Q2MD by name and PIN, keeps escrows, lists and deletes the family's, and takes
  `restoreFrom` on claim and on `devices/this`.
- **QA fixture.** The parents page's QA states with a plan list the tablet's own copy and an older phone's kept copy
  (`QA_VAULTS`), so the block can be seen with no server.
- **Evidence.** `qa-evidence/durable/class-rejoin-restored.png`, `parents-kept-progress.png`,
  `parents-link-continue-from.png`, `save-section-class-copy.png` (390x844) and the same names with `-320` (320x568).

## Offline: a service worker that keeps the whole app usable (DURABLE-10)

- **The worker** (`web/src/sw/sw.js`, hand-written, no Workbox). Install caches `madregot-<release>` with the release's
  files, all or none (`cache: 'reload'`, so no stale copy from the HTTP cache). It never calls `skipWaiting` by itself:
  only the page's `SKIP_WAITING` message does. Activate deletes the other releases' caches and takes over the open
  pages. Fetch handles only this site's own GET requests: `/api/` and every other address (the class server, the
  payment page) are never handled. A page load asks the network first and falls back to the cached `index.html` after
  3 s or on an error; `/assets/` comes from the cache first (a file not kept yet is kept once it arrives); anything else
  is the network, else the cache. Cache lookups ignore `Vary`: a module script asks with an `Origin` header, and a
  server that answers `Vary: Origin` would otherwise make every lazy screen miss the cache offline (found by the e2e).
  A marked, empty section waits for STUDENT-11's push handlers.
- **The build** (`web/scripts/vite-plugin-sw.mjs`, `enforce: 'post'`, so it runs after Vite emits `index.html` and the
  CSS). `sw.js` starts with `self.__PRECACHE` and `self.__RELEASE`: `index.html`, the manifest and the icons, every
  script and stylesheet, Rubik's Hebrew and Latin woff2 and KaTeX's woff2; never a source map, a `.ttf` or `.woff`, or
  Rubik's Arabic, Cyrillic or Latin Extended subsets. Measured on this branch: 65 files, 3.4 MiB raw (under DURABLE-11's
  4.5 MB cap). The release is `VITE_RELEASE` when it is set (the update test builds two), else the commit.
  `check-dist.mjs` scans `sw.js` with every other file and checks it: the list is at its top, holds `index.html`, names
  only files the build has, and no map, `.ttf`, `.woff` or `api/`. `_headers`: `/sw.js` no-cache, `/assets/*` public,
  a year, immutable (GitHub Pages ignores the file; browsers still check `sw.js` past the HTTP cache).
- **The page** (`web/src/lib/swClient.js`, from `main.jsx` once the page has loaded). Registers only in a production
  build with service workers and unless `VITE_SW=off`, at `BASE_URL + 'sw.js'` with scope `BASE_URL`. A waiting worker is
  let in only when the app comes back into view after 30 minutes or more away and the route is not a lesson, practice,
  the placement, a teaching stage, a repair, an Exam Rescue check or the exam check: then `SKIP_WAITING`, and one
  reload once the new worker controls the page. A return after a minute or more asks for a new release. A
  registration, an install (a worker that became redundant before it was installed) or an update check that fails while
  online is reported to the error monitor (kind `sw`). `window.__RELEASE` names the running release.
- **Offline words** (`components/durable/OfflineChip.jsx`). On Learn and the assistant, while the browser is offline, one
  calm line with `role="status"`: "אין אינטרנט כרגע. אפשר להמשיך לתרגל, והכול יישמר." The restore screen's code form and
  the parents' area say "כדי להמשיך צריך חיבור לאינטרנט." (the backup file still works offline, so its form says
  nothing). The class outbox and the vault already wait for the `online` moment.
- **Tests.** `web/scripts/vite-plugin-sw.test.mjs` (the filter keeps and drops what the spec lists; the list is sorted
  and once each; `sw.js` starts with the list and the release; the worker skips waiting only on the message, never
  handles `/api/`, leaves the push section empty; the plugin refuses a bundle with no `index.html`) and
  `web/src/lib/swClient.test.js` (busy routes, the 30-minute rule, one reload after `controllerchange`, no reload in a
  lesson, update checks, install and update failures reported, registration only where it should). Every other e2e
  spec runs with `serviceWorkers: 'block'` (`playwright.config.js`). `e2e/offline.spec.js` allows it: a class student
  visits once, the cache holds the whole list, then offline the profile, Settings, a lesson, a teaching stage and Exam
  Rescue open with no error screen; a reload offline opens the app; the line shows on the map (44 px) and the
  assistant; an answer given offline stays in the outbox and reaches the fake class server once back online; the
  restore and parents screens say they need the connection. The update test builds a second release
  (`VITE_RELEASE=e2e-next`) into `test-results/sw-next` and serves both from the test's own server on port 4203: the new
  worker waits; in a lesson, 31 minutes away (`page.clock`) reloads nothing; on the map it reloads into `e2e-next`, and
  only that release's cache is left.
- **Evidence.** `qa-evidence/durable/offline-me.png`, `offline-lesson.png`, `offline-learn.png` (390x844) and the same
  with `-320` (320x568); `offline-assistant.png`, `offline-restore.png` (390x844). They replace the council's
  `03-offline-open-me.png` failure ("משהו במסך הזה לא עבד").
