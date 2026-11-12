# QA: durable progress

What protects a student's saved progress, how each part is tested, and the limits that remain. The proof pack
(DURABLE-15) comes first: every council finding of the engineering lens that this lane answers, re-tested, with the
council's own probes run again next to the old code. After it, each item's detail, in the order it was built.

## The proof pack (DURABLE-15)

### Every finding, re-tested

"Old" is the council's evidence; where this lane ran the council's probe again on the council's commit (`43e4948`, the
ground truth of the spec), that result is given too. Every test named here passes on this branch (counts at the end of
this section). Screenshots are in `qa-evidence/durable/`.

| Council finding (lens, severity) | Old evidence | New test (file › name) | New result | Screenshot |
|---|---|---|---|---|
| All learner progress can be lost, and nothing can bring it back (engineering, critical; buyers: "a paying family's record is fragile") | One localStorage key; no `persist()`, service worker, manifest, export or restore endpoint; `joinClass`'s `returning` unused | `web/e2e/chaos.spec.js` › "(a) the backup code brings everything back", "(b) joining the class again with the PIN brings everything back"; `restore.spec.js` › "(1) the lost phone…", "class: A joins…", "family: A is linked…"; `backup-file.spec.js` › "save a backup file (a download), and restore it on a fresh browser through the first screen"; `install.spec.js` › "the browser is asked to keep the data once…" | After cookies, localStorage, sessionStorage, the IndexedDB copy and the caches are cleared, the app opens on Welcome; the code, and separately the class PIN, bring back every progress field equal (XP and its per-device counts, 3 days, the path, the stairs, the gaps, the mistakes, the learning model) | `chaos-welcome-after-eviction.png`, `chaos-restored-by-code.png`, `chaos-restored-by-class.png` (and `-320`) |
| Two open tabs overwrite each other's whole saved state (engineering, major) | `probe.cjs` twoTabs: tab A saved sound off, stale tab B's write saved it on again | `durable.spec.js` › "two tabs: the sound turned off in one stays off when a tab opened earlier changes another setting" (with and without the event), "two tabs: a lesson finished in each…"; `src/lib/durable/tabs.test.js` (a)–(e) | Probe again (lane copy): old `43e4948` sound back **on** after B wrote; new sound stays **off**, and B's own change (the tutor's mode) is kept too | — (no screen: the saved values) |
| Class progress sync drops answers (engineering, major) | `race.test.mjs`: 500 events → `saved: 300`, 300 rows; the outbox emptied before the request | `worker/test/class-sync.test.js` › "500 answers give 500 rows…", "half a batch already stored (a page closed mid-request)…"; `e2e/class-sync.spec.js` › "offline for three lessons, the page closed, opened again online: every answer reaches the class once" | Probe again: old `saved: 300`, 300 rows; new `saved: 500`, 500 rows | — |
| Daily limits, the PIN limit and the sign-in code limit are bypassed by parallel requests (engineering, major) | `race.test.mjs`: 20/20 free calls, 200 wrong codes never `too_many_tries`; `pin.test.mjs`: PIN 7391 found among 10,000 parallel joins | `worker/test/pin.test.js` › "50 wrong PINs at once: exactly 10 are compared (wrong_pin), 40 are refused (too_many_pin)…"; `counters.test.js` › "take() admits exactly the limit under 20 parallel requests" (`cc91cb0`) | Probes again: free calls 2 of 20 and sign-in 5 tries then 195 refused, old and new (fixed before this lane, in `cc91cb0`); PIN: old 300 PINs compared against a limit of 10, new exactly 10 compared, 290 `too_many_pin`, 9,700 `too_many_joins`, PIN not found | — |
| A full localStorage fails silently (engineering, minor) | `probe.cjs` storageFull: the screen said off, the save stayed on, an uncaught quota error | `durable.spec.js` › "storage full" › "the copy on the device works: the change survives a reload, and nothing alarms the child", "the copy cannot be written either: a calm banner says so…"; `src/lib/durable/storage.test.js` (3), (4), (7) | Probe again, filled to the last byte: old `43e4948` opened **Welcome** after the reload (the student looked gone until space was freed); new: no error, the IndexedDB copy holds the change, Settings says "נשמר", and the reload shows it | `probe-before-storage-full-reload.png`, `probe-after-storage-full-reload.png`, `durable-settings-saved.png`, `durable-full.png` (and `-320`) |
| (spec, DURABLE-1) A corrupt saved key | Not probed by the council; at `43e4948` the progress is one key with no copy to fall back on | `durable.spec.js` › "a broken save comes back from the copy on the device, with one calm toast, and its bytes are kept"; `storage.test.js` (5), (6) | The progress comes back from the copy on the device, once, with "החזרנו את ההתקדמות מהעותק שנשמר במכשיר."; the broken bytes stay in quarantine | `durable-recovered.png` (and `-320`) |
| Nothing works offline beyond the screen already loaded (engineering, minor) | `probe.cjs`: "משהו במסך הזה לא עבד" on `#/me` offline; a reload offline fails with `ERR_INTERNET_DISCONNECTED` | `e2e/offline.spec.js` › "after one visit, every screen opens offline, a reload works, and an answer given offline reaches the class", "a new release waits…" | Probe again: old the same error screen and a blank page on reload; new the profile opens offline, and the reload opens the app on the profile | `probe-before-offline-me.png`, `probe-after-offline-me.png`, `probe-before-offline-reload.png`, `probe-after-offline-reload.png`, `offline-*.png` |
| Initial download is heavy for a mid-range phone (engineering, minor) | Boot JS 549 KB gzip; `perf.cjs`: FCP 3.3 s, boot long task 368 ms | `web/scripts/check-budget.mjs` (the build fails over the gate) and `check-budget.test.mjs`; `e2e/perf.spec.js` (`@perf`) | Boot JS 291.4 KB (gate 306 KB); `perf.cjs` again, same machine, same hour: old FCP 3.35 / 3.38 s, longest task 274 / 292 ms; new FCP 2.36 / 2.49 s, longest task 240 / 185 ms | `budget-*.png`, `probe` table below |
| No CI, no monitoring, thin tests for class features and concurrency (engineering, minor) | No `.github/workflows`; the ErrorBoundary only logs to the console; no join, PIN or sync tests | `.github/workflows/ci.yml`, `perf.yml`; `e2e/monitor.spec.js` › "a screen that breaks: the error screen, one report to the server, and the details in Settings"; `worker/test/errors.test.js`; `pin.test.js`, `class-sync.test.js`, `teacher.test.js` | Workflows ready; their first run needs the owner's push (below). Errors counted on the app's own server with no name, device id or address | `error-screen.png`, `support-info.png` |
| Minors' data cannot be deleted, and a teacher who loses the device loses the class (engineering, major) | No deletes; the teacher key only in the teacher's localStorage | Teacher key: `src/lib/durable/file.test.js` › "a teacher's file keeps the class keys (the only way back to a class with no email)"; `SaveSection.test.jsx` › "a teacher: the note says the class keys are in the file…" | A backup file carries the teacher's class keys and "יש לי קובץ גיבוי" restores them; the section that makes the file for a teacher waits for the teacher lane to place it. TEACHER-1 (email sign-in for teachers) is not on this branch. Deletion is the trust lane's | — |
| Smaller security gaps: an aborted stream (engineering, minor) | "a client that aborts a streamed chat triggers giveBack()" | `worker/test/paid.test.js` › "a streamed chat the child leaves part-way, or that breaks, is still priced in ai_spend" (`9b061f0`, line 303 there; line 316 here) | Fixed before this lane; not rebuilt | — |
| AI cost in money (engineering, major): the family budget's code default | `DEFAULT_LIMITS.budgets.familyMonthlyUsd: 5` | `worker/test/paid.test.js` › "the family budget and the main model are the same in code and in wrangler.toml (neither can drift alone)" | $4 in code and in `wrangler.toml` (DURABLE-13, `ad4d199`) | — |

### The council's probes, run again

The four files in `scratchpad/council/engineering/` were copied, never edited in place. `race.test.mjs` and
`pin.test.mjs` changed only their import paths (this worktree, and a `git archive` of `43e4948` for the old column);
`perf.cjs` only its port. `probe.cjs` needed four changes, marked `[lane copy]` in the copy: the port; tab B's
"שרת הכיתה" radio moved to `#/settings/advanced` (opened by a hash change, so tab B keeps the state it holds); its fill
continues down to single characters, as `e2e/durable.spec.js` does (the council's fill leaves a few bytes free, enough
for the next save of the same size); and it also reads the IndexedDB copy and the screen after a reload. The council's
own `probe.cjs` on `43e4948` found tab B's radio missing (0) and the fill not full, so it could no longer show either
failure; the lane copy shows both again on the old build. Both builds are the council's staging build
(`VITE_API_URL=none VITE_ALLOW_PERSONAL_KEY=1 VITE_STORE_KEY=madregot-staging`), served by `python3 -m http.server` on
ports 4202 and 4203, uncompressed as the council served them. Machine load average 6 to 10 (other builds running).

| Probe | Council (`5117e5b`) | Old again (`43e4948`) | New (this branch) |
|---|---|---|---|
| race: 20 parallel free questions, one device | 20 served | 2 served | 2 served |
| race: 100 device ids, one address | 80 | 80 | 80 (by design: an anonymous caller is capped per network) |
| race: 200 parallel wrong sign-in codes | 200 `wrong_code` | 5 `wrong_code`, 195 `too_many_tries` | the same |
| race: 500 queued answers | `saved: 300`, 300 rows | `saved: 300`, 300 rows | `saved: 500`, 500 rows |
| race: webhook, bad delivery then a good retry | 0 subscriptions | 404 both (the probe's `generic` provider was removed in `cc91cb0`) | 404 both; the case is `worker/test/webhook.test.js` › "a failure inside the apply batch leaves no billing_events row, so the retry applies it" |
| pin: 10,000 parallel joins, one address | PIN 7391 found | 300 compared (limit 10), not found | 10 compared, 290 `too_many_pin`, 9,700 `too_many_joins`, not found |
| probe: offline, open the profile | "משהו במסך הזה לא עבד" | the same | the profile |
| probe: offline reload | `ERR_INTERNET_DISCONNECTED` | the same (a blank page) | the app, on the profile |
| probe: storage full, sound off (lane copy) | saved on, uncaught quota error | saved off, then the reload opens Welcome | no error; the copy on the device has off; "נשמר"; off after the reload |
| probe: two tabs (lane copy) | sound back on | sound back on, also after B's other change | sound stays off; B's change kept |
| probe: heavy year, one full save | 830 KB, 17.5 ms | 829 KB, 18.4 to 31.1 ms (two runs) | 829 KB, 18.1 to 18.4 ms (the probe times its own `setItem`, not the app's code, so no change is expected: the app now writes once per tick, `storage.test.js` (1), and makes a heavy year smaller once, (2)) |
| perf: first load, 4x CPU, 8 Mbit/s, 150 ms | FCP 3.3 s, long task 368 ms | FCP 3.35 / 3.38 s, longest task 274 / 292 ms, 2.21 MB | FCP 2.36 / 2.49 s, longest task 240 / 185 ms, 1.46 MB |

The raw outputs and the copies are in the lane's scratch folder (`lanes/family/probes/`: `RESULTS.txt`,
`probe-adapted-old.json`, `probe-adapted-new.json`, `probe-old.json`, `perf-runs.txt`).

### The chaos suite

`web/e2e/chaos.spec.js`, on the phone and phone-small projects.

1. **The student.** Two saved days (3 and 4 November) and a lesson today, finished in the app. The class K7Q2MD is joined
   from Settings with PIN 4821; the class keeps the backup code it makes (escrow). The page goes out of view, so the
   vault has today's lesson. The code is read the way a student reads it: Settings › "להציג את קוד הגיבוי".
2. **The eviction.** With the app closed (a blank page of the same address), cookies, localStorage, sessionStorage, the
   IndexedDB database `madregot-durable` and every cache are cleared; the test checks that nothing is left. The test
   build has no server compiled in (the public website's build), so the address of the fake server is put back alone,
   as a production build carries it in its code.
3. **Welcome.** "מתחילים", and the save holds no profile, no XP and no days.
4. **(a) The code.** "יש לי קוד גיבוי", the code, "לחפש את הגיבוי", "מצאנו גיבוי" with the XP and the name, "להמשיך
   מכאן", "ההתקדמות חזרה". Every progress field equals the one before the eviction. The class code comes back; the
   class token never travels in a backup, so Settings shows "התחברות מחדש לכיתה" for the PIN.
5. **(b) The class.** The first questions as on any new start, then the class code, the same name and the PIN:
   "ברוכים השבים לכיתה ז׳3. ההתקדמות שלכם חזרה.", every progress field equal, a new class token, the code kept by the
   class again.
- **Found by the suite and fixed.** The class rejoin first came back without the streak freeze the student had earned
  and without the last topic (the map opened on the first topic). The device had just made its profile, so it had saved
  last, and the merge's "newer side" kept its empty defaults. A device with no progress now takes the copy's single
  fields (`lib/durable/apply.js`; `apply.test.js` › "a device with no progress yet takes the copy's single fields, though
  it saved last (a class rejoin after the first questions)", which fails without the fix). The same path serves a family
  move to a new phone.

### Storage full

A full localStorage with a working IndexedDB copy is "saved", and only Settings says where; a calm banner appears only
when nothing could save the change. Tests and evidence: the "storage full" row above, and DURABLE-1's detail in
`web/src/lib/durable/storage.js` and its test. Owner check: none.

### Corrupt key

A key that does not parse, or one from a newer version, is kept in quarantine (IndexedDB, the newest 5 for 30 days) and
the start comes from the copy on the device, with one calm toast. Tests: `storage.test.js` (5), (6), "the same broken
bytes are kept once…"; `durable.spec.js` › "a broken save comes back from the copy on the device…".

### Two tabs

See "Two tabs on one device (DURABLE-2)" below. Probe: the table above.

### Lost phone (the backup code)

`restore.spec.js` (1) on two browsers, and `chaos.spec.js` (a) after an eviction on the same browser. Screenshots:
`restore-code.png`, `restore-preview.png`, `restore-done.png`, `chaos-restored-by-code.png`.

### Class rejoin

`restore.spec.js` › "class: A joins, learns and syncs; a fresh phone types the class code, the name and the PIN and is
back", and `chaos.spec.js` (b). Worker: `escrow.test.js` (the class rejoin with the right and the wrong PIN).
Screenshots: `class-rejoin-restored.png`, `chaos-restored-by-class.png`.

### Family move

`restore.spec.js` › "family: A is linked and its code kept, the parent unlinks it, a new phone linked "continue from"
gets A's progress". Screenshots: `parents-kept-progress.png`, `parents-link-continue-from.png`.

### Offline

`offline.spec.js` (both tests); the probe rows above. Screenshots: `offline-me.png`, `offline-lesson.png`,
`offline-learn.png`, `probe-after-offline-reload.png`.

### Killed tab during class sync

The outbox keeps every answer until the server acknowledges its id; a resent answer counts once. `class-sync.spec.js`
› "offline for three lessons, the page closed, opened again online: every answer reaches the class once";
`worker/test/class-sync.test.js` › "half a batch already stored (a page closed mid-request): the rest is added, nothing
twice"; `src/lib/sync.test.js` (keepalive within the hidden moment's budget).

### PIN race

`worker/test/pin.test.js` (four tests: 50 wrong PINs at once give exactly 10 comparisons; 5 wrong then the right one;
the right PIN 5 times at once; a classmate's tries are apart). The probe: 10 compared, the PIN not found.

### Aborted stream spend

Done before this lane, in `9b061f0`: `worker/test/paid.test.js` › "a streamed chat the child leaves part-way, or that
breaks, is still priced in ai_spend" (`git show 9b061f0:madregot/worker/test/paid.test.js`, line 303). Not rebuilt.

### Teacher on a new device

TEACHER-1 (a teacher signs in with email, the class has an owner, a key is reissued on request) is **not in this
branch**; it is the teacher lane's, and it supersedes DURABLE-14. What this branch has is the backup-file path for the
teacher key: a backup file keeps the class keys (`profile.classes[].key`, kept by `lib/durable/payload.js`
`snapshotForBackup`), and "יש לי קובץ גיבוי" on a new device's first screen restores them (`apply.js` counts a teacher
with classes as progress). The section that saves the file, `SaveSection role="teacher"` (its note says the file holds
the class keys, so it is kept private), is built but not placed: teachers have no Settings route, and the teacher
lane places it in the class settings (TEACHER-1/9). Until then no teacher screen offers the file. Tests:
`file.test.js` › "a teacher's file keeps the class keys (the only way back to a class with no email)",
`SaveSection.test.jsx` › "a teacher: the note says the class keys are in the file, so keep it to yourself".

### Budget and timing

The before/after of Stage 17 (detail in "A load-time budget enforced by the build" below), gzip level 9:

| step | boot JS | render-blocking CSS |
|---|---|---|
| council (`43e4948`) | 549.2 KB | 47.9 KB |
| before DURABLE-11 (`b0fbcb2`) | 666.6 KB | 50.7 KB |
| after DURABLE-11 (this branch) | **291.4 KB** (gate 306, target 260) | **41.8 KB** (gate 42, target 32) |

| release, `e2e/perf.spec.js` (gzip served, 4x CPU, 150 ms, 200,000 B/s) | FCP | LCP | longest boot task | repeat LCP |
|---|---|---|---|---|
| before DURABLE-11 (`b0fbcb2`) | 4.79 s | 4.79 s | 242 ms | 0.72 s |
| this release | 2.79 s | 2.79 s | 178 ms | 0.41 s |
| budget (fails over × 1.1) | 2.5 s | 3.0 s | 200 ms | 1.5 s |

FCP missed its budget by 38 ms in that run, on a loaded machine; the nightly `perf.yml` gives the number on a quiet
runner. The council's own `perf.cjs`, run again today on both builds, is in the probe table above.

### Monitoring

`monitor.spec.js` › "a screen that breaks: the error screen, one report to the server, and the details in Settings" (one
`POST /api/errors` of kind `render` for `/me`) and "no server: nothing is sent, and the device still keeps the report";
`worker/test/errors.test.js` (11 tests, including "no column holds the address the reports came from" and the owner's
table). The owner's table is shown in DURABLE-9's detail below, from the tests' in-memory database. Screenshots:
`error-screen.png`, `support-info.png`.

### CI run

**Workflow ready; the first run needs the owner's push** (owner step). `.github/workflows/ci.yml` runs web (types,
vitest, build with the budget), worker and the phone e2e on every push to `main` and every pull request;
`perf.yml` runs the timing test every night. Pushing files under `.github/workflows/` needs a token with the
`workflow` scope, or the files can be pasted in GitHub's web editor (`README.md`, "CI"). Then branch protection on
`main` with `web`, `worker` and `e2e` required. Result of the first run: ________ (date ________).

### The privacy notice

`web/src/content/legal/privacy.md` no longer says the progress is kept only on the device. Under its current headings
(the trust lane's Appendix A, which moves these blocks to its own anchors, is not on this branch) it says: the code-only
backup is an encrypted copy that only the code opens, kept 400 days after its last use and deleted by "להפסיק את
הגיבוי" and by "מחיקת כל הנתונים"; when a class or a family plan keeps the code, the server can open that copy while the
code is kept, and the code goes when the teacher removes the student, the student turns off "שמירת עותק בשרת הכיתה", the
parent deletes the kept progress, the account is deleted, or "מחיקת כל הנתונים" runs ("מוצפן" is never said of that
copy); error reports in DURABLE-9's sentence (30 days, no name, device id or address); Cloudflare as processor. Tests:
`web/src/content/legal/privacy.test.js` (5) and `worker/test/notice.test.js` (the notice's 400 and 30 days equal
`RETENTION.vaultIdleDays` and `RETENTION.clientErrorsDays` in `shared/retention.js`, FOLLOWUP-24). Screenshots: `privacy-390.png`, `privacy-320.png` (no sideways
scroll at either width).

### What this branch's suites gave at this stage (11 November 2026)

- Worker, `node --test test/*.test.js`: 255 passed, 0 failed.
- Web, `npx vitest run`: 1,367 passed in 52 files.
- End to end, the whole phone project (390x844) including `chaos.spec.js`: 207 passed, 2 skipped (the `@perf` timing
  test, which runs only with `PERF=1`), 8.4 minutes. `chaos.spec.js` also passes on phone-small (320x568).

### Still open

- **A real iPhone.** Safari › use the app › create a code › Settings › Safari › Clear History and Website Data › reopen ›
  restore by code; then the Home Screen path (DURABLE-3), noting the exact Hebrew labels of "שיתוף", "הוספה למסך הבית"
  and the "open as app" switch of iOS 26's Share sheet, so `InstallSheet.jsx` `INSTALL_STEPS` can match them.
  Result: ________ (pass/fail, date).
- **A real Android.** Install from Chrome's menu; Settings › "שמירה קבועה בדפדפן" reads "כן". Result: ________
  (pass/fail, date).
- **D1 and the largest vault.** Whether D1 accepts a 349,526-character bound string in a real database (not
  `node:sqlite`) is documented but not run: after the first deploy, one `POST /api/vault` with a blob of that length,
  then `GET /api/vault`. Result: ________ (pass/fail, date).
- **iOS 26's Share-sheet labels** (part of the iPhone check above): the InstallSheet copy quotes "שיתוף" and "הוספה למסך
  הבית" until the owner reads them on a device.
- The CI's first run (above).
- The three-way tab merge is new design; its property test (`merge.test.js`) is the main safety net.

## After the lane's review (11 November 2026)

### What the reviewers reproduced, and what now stops it

| finding | the fix | the test that failed before it |
|---|---|---|
| One self-made class student fills the size meter (599 creates; then nobody can back up for up to 400 days) | `vault.js` create(): `vault:new:i:<student or device>` 3 a day, `vault:new:in:<net>` 600 a day for credentialed creates, `vault:newkb:<net>` 20 MiB a day per network whoever asks; the owner hears at 90% as well as 70% | `worker/test/vault-guard.test.js` "one class Bearer cannot move the meter by more than 3 blobs", "many students of one self-made class … at most 20 MiB", "the owner hears at 90%" |
| "להפסיק את הגיבוי" / "מחיקת כל הנתונים" undone by another device with the same code | `0008_vault_guard.sql` (the lane wrote it as 0005_vault_guard; renumbered on the main branch) `vault_tombstones` (id_hash and time only, 400 days); every vault route answers 410 `vault_deleted`; the app turns its backup off with the one-time note "הגיבוי נמחק ממכשיר אחר…"; only an expired vault is made again | `vault-guard.test.js` "a deleted vault stays deleted", "an expired vault (no tombstone) is made again"; `web/src/lib/durable/vault.test.js` "a stop on one device is never undone by another"; `e2e/family-guard.spec.js` "a backup stopped on another device…" |
| The family copy gives the parent's own phone the child's restore code (sharing off, child left, still linked) | `family.js`: restoreFrom only for a kept escrow (409 `escrow_in_use` while linked); a child's leave deletes the escrow; a parent's unlink keeps it only while the child's sharing switch is on; a write with an unlinked device's token is 401 `not_linked` and the app moves to a new code (`familyGone`, `moveToNewCode`); `/parents` offers only kept progress | `worker/test/family-guard.test.js` (5); `vault-guard.test.js` "a write with a family token the server no longer knows"; `vault.test.js` "the family let go of this device…", "familyGone…"; `e2e/family-guard.spec.js` "/parents offers to continue only from…" |
| Joining a class from Settings escrowed a code-only backup with no sentence before | the join form says the class sentence, and with a code nobody keeps: "קוד הגיבוי שכבר יש לכם יישמר גם בשרת הכיתה…" with the switch's name | `e2e/family-guard.spec.js` "joining a class from Settings says, before the join…" |
| A failed leave ignored by "delete all" and the child's unlink | `leaveFamily()` rejects on no network or 5xx and keeps the token; "delete all" leaves the family first and stops with "לא הצלחנו למחוק את הסיכומים…, ולכן לא מחקנו כלום"; the unlink says it did not happen | `web/src/lib/account.test.js` "leaveFamily: …" (3); `e2e/family-guard.spec.js` "the leave the server did not hear" (2) |
| `/parents` read 56 days while 90 are kept: older summaries invisible and undeletable, and the first-day card shown wrongly | `GET /api/family/summary` gives each device `kept: { n, from, to }`; "מחיקת ההיסטוריה" shows whenever the server keeps a row; the first-day card only for a device that never sent; otherwise a dated line or "אין כרגע סיכומים שמורים" | `worker/test/report.test.js` "7b. a device whose only rows are 57 to 89 days old"; `WeeksChart.test.jsx` "a device whose only summaries are older…"; `e2e/family-guard.spec.js` (2) |
| A stale streak and a past exam shown as current | `shared/week.js`: the streak of the newest summary on or before the day read, kept only while only rest days lie between (as `streakOf`); an exam before today dropped; the same function in the email | `shared/week.fixture.json` "stale" (7 cases, read by both `learn/report.test.ts` and `worker/test/week.test.js`); `report.test.js` "W3b" |
| A sibling's new profile sent an empty today over the first child's day | no empty today before a profile's first send; the notice and the sharing sheet tell the new profile the earlier summaries stay | `familySync.test.js` "the new profile never sends an empty today…"; `e2e/report.spec.js` flow 3 |
| privacy.md promised a one-click stop | "…מהקישור שבתחתית כל מייל, או מכפתור הביטול של תוכנת המייל." (and the tombstone and the escrow rules in the same notice) | `reportCopy.test.js`, `privacy.test.js` |
| "ועוד 1" in the email, the report and the WhatsApp text | `he.stairs`: "ועוד מדרגה אחת", "ועוד שתי מדרגות", "ועוד 3 מדרגות" | `report.test.js` W3, `share.test.js`, `WeeksChart.test.jsx` "the worked list" |

### Go live in one command (DURABLE-16)

`worker/src/readiness.js` (the rules), `npm run owner -- doctor` (`scripts/owner.mjs`), `setup.sh` beside `setup.ps1`
(both now create every random secret and end with the doctor), `worker/src/edge.js` with `RL_AUTH` and `RL_AI`, and
`/api/health` booleans `resend`, `webhookPath`, `grow`, `edge`. The legal area (FOLLOWUP-32) reads billing.js `legalMissing`:
business details, `DB_JURISDICTION`, `LEGAL_APPROVED`, required while `AI_PAYWALL` is on, and `MOE_AI_APPROVAL` as a reminder.
Tests: `worker/test/readiness.test.js` (11),
`worker/test/edge.test.js` (6), `worker/test/owner-script.test.js` "doctor --local…" and "--grow-sandbox".

The doctor on this checkout (`npm run owner -- doctor --local`, nothing set yet):

```
✗ בסיס הנתונים: אין עדיין בסיס נתונים: database_id ב־wrangler.toml → npx wrangler d1 create madregot  (ואז להעתיק את database_id אל worker/wrangler.toml)
✗ בסיס הנתונים: מיגרציות שלא הורצו: 0000_base.sql, 0001_paid_tutor.sql, 0002_refund_once.sql, 0003_durable.sql, 0004_parent_report.sql, 0005_vault_guard.sql → npm run db:migrate:local
✗ כניסה במייל: חסר AUTH_SECRET (מפתח לקודי הכניסה) → openssl rand -hex 32 | npx wrangler secret put AUTH_SECRET
✗ כניסה במייל: חסר IP_HASH_SECRET (מונים בלי כתובות רשת) → openssl rand -hex 32 | npx wrangler secret put IP_HASH_SECRET
✗ בינה מלאכותית: חסר ANTHROPIC_API_KEY (העוזר החכם) → npx wrangler secret put ANTHROPIC_API_KEY
✗ כתובת האתר: PUBLIC_URL צריך להיות כתובת https של האתר → worker/wrangler.toml: PUBLIC_URL = "https://…"
✗ כתובת האתר: חסר CONTACT_EMAIL (מופיע בדפי המשפט ובמיילים) → worker/wrangler.toml: CONTACT_EMAIL = "…"
✓ הגנה מעומס: RL_AUTH, RL_AI, VAULT_RL
! מיילים: המיילים כבויים: EMAIL_FROM ריק, אז אין כניסה במייל להורים ולמורים → worker/wrangler.toml: EMAIL_FROM = "…"
✗ גיבוי מוצפן: חסר VAULT_SECRET (שמירת קוד הגיבוי בכיתה ובמנוי המשפחתי) → openssl rand -hex 32 | npx wrangler secret put VAULT_SECRET
(אין קובץ .dev.vars: אין סודות מקומיים)
(PUBLIC_URL ריק: לא בדקנו את השרת החי)
יש עוד מה להשלים (השורות עם ✗).
```

The same, after what the setup script does (a fixture: a database id, the migrations applied, the four random secrets
in a `.dev.vars` of synthetic values, `PUBLIC_URL`, `CONTACT_EMAIL`, `AI_PAYWALL = "on"`): only the key the owner pastes
is left, and no value of the file appears in the printout (checked by grep).

```
✓ בסיס הנתונים: database_id
✓ בסיס הנתונים: כל המיגרציות הורצו
✓ כניסה במייל: AUTH_SECRET
✓ כניסה במייל: IP_HASH_SECRET
✗ בינה מלאכותית: חסר ANTHROPIC_API_KEY (העוזר החכם) → npx wrangler secret put ANTHROPIC_API_KEY
✓ כתובת האתר: PUBLIC_URL
✓ כתובת האתר: CONTACT_EMAIL
✓ הגנה מעומס: RL_AUTH, RL_AI, VAULT_RL
! מיילים: המיילים כבויים: EMAIL_FROM ריק, אז אין כניסה במייל להורים ולמורים → worker/wrangler.toml: EMAIL_FROM = "…"
✓ תשלום: WEBHOOK_PATH_SECRET
! תשלום: ההצטרפות באתר כבויה: BILLING_PROVIDER = "manual" (מנויים ניתנים רק עם npm run owner) → worker/wrangler.toml: BILLING_PROVIDER = "grow"
✓ תשלום: FAMILY_MONTHLY_BUDGET_USD
✓ גיבוי מוצפן: VAULT_SECRET
יש עוד מה להשלים (השורות עם ✗).
```

The edge limit on a real local Worker (`npx wrangler d1 migrations apply madregot --local`, then `npx wrangler dev
--local` with synthetic `--var` secrets; `/api/health` answered `"edge": true`): 26 `POST /api/account/verify` from one
address in a few seconds gave `410` ×20 (the D1 path: no such code), then `429` with `Retry-After: 60` and
`{"error":"slow_down"}`. All six migrations, `0005_vault_guard.sql` included, applied cleanly to the local D1. (Both outputs are from the family
lane's tree; on the main branch the file is `0008_vault_guard.sql`, after the other lanes' 0004-0007.)

### The PIN race (DURABLE-8), `node --test test/pin.test.js`

```
ok 1 - 50 wrong PINs at once: exactly 10 are compared (wrong_pin), 40 are refused (too_many_pin); the right PIN waits for the reset
ok 2 - 5 wrong PINs and then the right one: 200, and only the 5 wrong tries stay counted
ok 3 - the right PIN 5 times at once: 5 x 200, and the count is back at 0
ok 4 - one student's wrong tries do not touch a classmate's, and a first join never counts a try
# tests 4
# pass 4
# fail 0
```

### The owner's error table on a local Worker (DURABLE-9)

The same local Worker, three `POST /api/errors` with the body the app's reporter sends (`text/plain`, two items each),
then `npm run owner -- errors --local`:

```
count  kind   route           release  agents  name            message                                            frame                   first                     last
-----  -----  --------------  -------  ------  --------------  -------------------------------------------------  ----------------------  ------------------------  ------------------------
3      chunk  /learn/:topic   proof    1       ChunkLoadError  Loading chunk Teach failed                         index-abc123.js:1:999   2026-11-11T04:53:17.554Z  2026-11-11T04:53:17.590Z
3      error  /lesson/:topic  proof    1       TypeError       Cannot read properties of undefined (reading 'x')  index-abc123.js:1:2345  2026-11-11T04:53:17.554Z  2026-11-11T04:53:17.590Z
```

### The suites at this commit

- Worker, `node --test test/*.test.js`: 330 tests, 329 passed, 0 failed, 1 skipped (Grow's sandbox contract test, which
  runs only with `GROW_SANDBOX=1` and the keys in `.dev.vars`).
- Web, `npx vitest run`: 1,489 passed in 59 files; `tsc -p tsconfig.json` clean; the budget: boot JS 295.9 KB (gate
  306), CSS 41.8 KB (gate 42), precache 3.67 MB.
- End to end, the whole phone project (390x844): 235 passed, 2 skipped (the `@perf` timing test), 8.6 minutes.
  `e2e/family-guard.spec.js` also passes on phone-small (320x568). No visual baseline changed.

### Still short of the proof the specs ask for

- **DURABLE-3 / PARENTS-5, an automated accessibility pass** on Settings › שמירת ההתקדמות and the `/parents` report: the
  repo has no axe runner, and this lane may not add a package. It needs `@axe-core/playwright@4.10.2` (dev dependency of
  `madregot/web`); then one spec per screen, `new AxeBuilder({ page }).include('.save-backup').analyze()` and the same
  for `.parents-report`, expecting no violations. Until then: keyboard and screen-reader paths are covered by the e2e
  (roles, names, focus) and the 44 px checks in `layout.spec.js`.
- **DURABLE-3, the manifest panel** screenshot is the owner's (a local CDP check found no installability errors).
- **DURABLE-11, FCP on the slow-phone profile**: the last measurement on this branch was 2.79 s against the 2.5 s budget
  (the test fails over 2.75 s). Not re-measured here: the machine's load was too high for a timing that means anything.
  The nightly `perf.yml` on a quiet runner gives the number; the byte gates pass.

---

The detail of each item follows, in the order it was built.

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
- **Evidence.** `qa-evidence/durable/restore-preview-{empty,same,other}.png` (390x844); `restore-start.png` (the file
  screen) and `restore-undo.png` (Settings with "לבטל את השחזור האחרון"), copied in by the proof pack.
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

## Teaching content per topic, loaded on demand (DURABLE-11, first half)

The council measured a heavy first download: every topic's teaching journeys and diagnostic models were in the main
script. They now load one topic at a time, and nothing the student sees changed.

- **The meta** (`web/src/learn/content/meta.gen.ts`, written by `web/scripts/gen-content-meta.mjs` from every
  `learn/content/*.ts`): per stair its title, its misconceptions' ids and titles, and whether it has transfer
  questions; per topic the misconception names the content adds (`NEW_CATS`). It is all the first screens need:
  `hasContent`, `catLabel` (`content/index.js`), `recommend.ts` (the stage of a stair, the repair title), `checkPlan`'s
  `has`/`hasT`, `lib/lesson.js` and `lib/placement.js` (which source a question comes from), `CheckDone` (the repaired
  misconception's name), `Welcome` (the first stair) and the feedback chip in `Lesson`. `npm run build` and
  `npm run dev` run the generator first; a stale file fails `learn/content-split.test.ts`.
- **The content** (`learn/content/index.ts`): `loadTopic(topic)` is a `switch` of dynamic imports, one file per topic
  (`signed`, `coord`, `angles`, `expr`, `eq`, `line` (stairs 1-4 and 5-8 through `line.ts`), `pyth`, `stats`, `sys`;
  `angles` and `pyth` share the small `geo` drawings file). `contentOf(skill)` reads what has loaded and is `null`
  before; in development it throws for a stair whose topic was never asked for, so no screen can quietly fall back to
  plain exercises. `ensureTopics(skills or topics)` waits for several at once.
- **Who waits.** `useStairContent(skill)` (`learn/useStairContent.js`, React's `use`) in `Journey`, `Teach` and
  `Repair`: the app's existing loading screen shows until the topic is there. `Lesson` waits with `useTopics` for
  `lessonTopics(spec)`: its own topic, every topic the placement test asks, or the topics of an Exam Rescue
  diagnostic or practice exam, so `items.ts` never makes a question from a topic that has not loaded. The Exam Rescue
  plan fetches its exam's topics while it is read, so the check opens at once. After the first screen, when the
  browser is idle, the topic worked on last loads (`requestIdleCallback`, `App.jsx`). Opened straight on a lesson, a
  stair, a teaching stage, a repair, the placement test or a rescue check (a reload, a link), `main.jsx` waits for that
  screen's topics with the device copy (`lib/bootTopics.js`, at most 2 s), so the screen appears whole, as before,
  instead of after a loading screen.
- **Found by the e2e.** A screen that waited for its topic and then rendered again sometimes broke its own hooks
  (React error 467 inside a concurrent render, recovered, so only a console error): React expects the same `use()` call
  in the same place on that second render, and the first version skipped it once the topic had loaded. `useTopics`
  now always calls `use()`, and `ensureTopics` hands it a promise marked as settled when nothing is loading, so it never
  suspends then (`restore.spec.js`'s class test failed 1 run in 3 before, 0 in 6 after). `e2e/helpers.js answer()` waits
  for the exercise to be on screen, because a lesson opened inside the app may first wait for its topic.
- **Offline.** The service worker (DURABLE-10) keeps every topic's file, so after one visit every topic opens offline.
  Without a service worker, a topic never loaded cannot open offline; the topic worked on last is loaded at idle. The
  class-sync e2e (which blocks the service worker) now gives its student a last topic and waits for that file before
  it goes offline.
- **Tests.** `learn/content-split.test.ts`: before anything loads, the meta answers and `contentOf` throws; a topic
  loads once, is `null` while it loads; every topic in `TOPICS` has a `loadTopic` case that loads exactly the meta's
  stairs; each topic's stairs and steps equal the counts recorded on the code before the split
  (`learn/__snapshots__/content-split.counts.json`); `meta.gen.ts` equals a fresh generation (in the test and by
  `node scripts/gen-content-meta.mjs --check`) and matches the loaded misconception ids and titles; `NEW_CATS` equals
  what the registry gathered before, keys in order. `learn/items.test.ts`: every check plan is made before any topic
  loads (the meta alone), then, once `ensureTopics` resolved, every question for the same seeds equals the record
  made by the same test on the code before the split (`learn/__snapshots__/items-split.json`; a deliberate content
  change updates both files with `vitest -u`). `lib/bootTopics.test.js` (which screens wait for which topics). The
  content, integrity, guessing, engine, check, figure, lesson and placement tests run on the loaded content.
  Visual baselines (`visual.spec.js` on phone, phone-small and desktop; `screens.spec.js`) unchanged.
- **Numbers** (gzip level 9, `dist/index.html`'s entry and modulepreloads, measured on this machine): boot JS
  666.6 KB before (main script 544.2 + KaTeX 77.0 + markdown 45.4) and 475.8 KB after (main 353.5 + 77.0 + 45.4).
  Render-blocking CSS unchanged at 50.7 KB. The ten new files are 3.8 to 36.7 KB gzip each. Stage 17 sets the gate.

## A load-time budget enforced by the build, and the timing test (DURABLE-11, second half; DURABLE-12 nightly)

- **Markdown off the first download.** `components/MathText.jsx` is plain text with `$…$` maths and imports no
  markdown. `components/RichText.jsx` (markdown plus maths) is lazy: its file (`components/Markdown.jsx`, with
  react-markdown, remark-math and rehype-katex) loads the first time such text is shown, and until then the text shows
  as written, lines kept, its maths drawn, in the same box. It is used by the assistant, the tutor chat (`AIChat`, which
  fetches the file as the chat opens), the exam check (`CheckResult`), `ExamResult`, `Plan`, the explanation box in a
  lesson, and the legal pages (`Legal.jsx`: `as="article"`, no maths, so a `$` stays a `$`; the existing loading screen
  until the file is there). `vite.config.js` drops its `markdown` manual chunk: it had pulled React in with the markdown
  libraries, which put the whole chunk on the first download. `dist/index.html` now has no `modulepreload` at all: one
  script, one stylesheet.
- **Rubik.** `@fontsource-variable/rubik` 5.3.0 ships no stylesheet per subset (only `index.css`, `wght.css`,
  `wght-italic.css`; the spec's `wght-hebrew.css` and `wght-latin.css` do not exist in it), so `src/styles/fonts.css`
  copies the Hebrew and Latin `@font-face` rules from its `index.css`, files and ranges unchanged, and `main.jsx`
  imports it. The build emits two Rubik files instead of six. ₪ is in the Hebrew subset too.
- **What was tried for boot JS, in order, each kept only with every visual baseline identical** (gzip-9, the entry and
  its modulepreloads):

  | step | boot JS | render-blocking CSS |
  |---|---|---|
  | before DURABLE-11 (`b0fbcb2`) | 666.6 KB (main 544.2 + KaTeX 77.0 + markdown 45.4) | 50.7 KB |
  | Stage 16: teaching content per topic | 475.8 KB (353.5 + 77.0 + 45.4) | 50.7 KB |
  | markdown off the first download, Rubik subsets | 433.7 KB (356.7 + 77.0) | 50.1 KB |
  | Topics, Topic and Quests lazy | 423.6 KB | 50.1 KB |
  | KaTeX lazy, with its stylesheet | 346.6 KB | 42.2 KB |
  | the lesson screen lazy, fetched ahead | 291.4 KB | 42.2 KB |
  | dead CSS removed | 291.4 KB | **41.8 KB** |

  KaTeX: `components/katex.js` (KaTeX and its stylesheet) loads once the first screen is up; until then an expression
  shows as plain words (`texText`, escaped, `.tex-plain`) and every `Tex` draws itself when it arrives (`useKatex`).
  KaTeX's stylesheet now comes after the app's, so the two app rules that override it with the same specificity
  (`tokens.css` `.katex` font size, `.katex-display` margin) became `:root .katex` and `:root .katex-display`: the
  first try without that changed the exercise baselines (KaTeX's own 1.21em and display margin won: a bigger
  question box), so the cause was fixed, and no baseline was updated.
  The lesson screen (`lib/lazyScreen.js`): at 346.6 KB boot JS was still over the 330 KB gate, so the practice route
  went lazy too, with a preload: a lesson opened straight (reload, link) waits for its file, its topic and KaTeX together
  (`lib/bootTopics.js`, at most 2 s), and after the first screen the browser fetches it when idle, with the last topic.
  Once fetched it renders at once, and a mounted lesson never switches component (that would start it over).
  Dead CSS: 31 classes no markup uses (found by searching every source file, dynamic class prefixes excluded), 48
  selectors, 38 rules, in `app.css`, `v4.css` and `canon.css`. The 260 KB and 32 KB targets are still missed (a
  warning); what is left is mostly React, React Router, motion and Base UI.
- **The gate** (`web/scripts/check-budget.mjs`, `web/budget.json`, run by `npm run build` after `check-dist`): boot
  JS from `dist/index.html`'s entry and modulepreloads, render-blocking CSS from every stylesheet link, each gzipped at
  level 9 and summed; the largest chunk that loads on demand (150 KB); the service worker's precache, from `sw.js`'s
  own list (4.5 MB). It prints value, gate and target, exits 1 over a gate and only warns on a missed target. KB is
  1000 bytes, as in the spec's measurements. The boot JS gate started at 330 KB and is now the measured 291.4 KB + 5%
  = **306 KB** (the ratchet: a later commit that makes boot smaller lowers it again; nobody raises it). CSS stays at 42
  KB. Today: 291.4 / 306, 41.8 / 42, largest lazy chunk 77.0 (KaTeX) / 150, precache 3.58 / 4.5 MB.
  On the main branch, with the other lanes' screens in the same first download (the teacher demo's boot, the trust
  lane's sheets, the student lane's theme and goal screens, the curriculum's fractions), the merge measured boot JS
  327.2 KB and render-blocking CSS 52.7 KB, so the gates there were set by the same rule (measured + 5%) to **344 KB**
  and **56 KB**; bringing the merged app back under 306 / 42 is open work (the teacher and trust CSS into files that
  load with their screens, and the demo's boot behind its own import). The safety lane's stages 11-28 added the
  tutor's whole stable prompt (pedagogy, stair map, topic ways), the final-answer guard and the code checks of written
  exercises to `shared/ai.js`, which `lib/account.js` and `lib/ai.js` import at boot: the merge measured boot JS
  348.7 KB (CSS 54.0 KB), and the boot gate moved by the same rule to **367 KB** (CSS stays 56). Open work there too: the
  personal-key path of `lib/ai.js` (dev builds only) and the prompt builders behind a dynamic import, and the few
  constants the boot needs (`KIND_GROUP`, `FREE_KINDS`, `AI_KINDS`) in a module of their own.
  The student lane's stages 8-19 (the calm streak, Madi's look and wardrobe, the class goal, the teaching figures, the
  install offer) added their rules to the main screens' stylesheet: the merge measured render-blocking CSS 56.45 KB, and
  the CSS gate moved by the same rule to **59 KB** (boot JS 366.1 KB, under its 367 KB gate). Open work: the wardrobe's,
  the class goal's and the teaching figures' rules into files that load with their screens.
  The curriculum lane's stages 6-17 (the floor's last two stairs, signed:6, ratio and percent, the floor check and the
  facts practice, the one ranked plan, the challenge track's 36 tasks) put the new topics' exercise generators
  (`content/*.js`, read by the map and the placement test) and the challenge track (`learn/challenges/*`, which the plan
  `learn/next.ts` and the store read) in the first download; their teaching content loads per topic as before
  (`frac`, `signed6`, `ratio`, `pct` chunks). The merge measured boot JS 412.3 KB and the service worker's precache
  4.56 MB, so both gates moved by the same rule to **433 KB** and **4.79 MB** (CSS 57.3 KB, under its 59 KB gate). Open
  work: the challenge tasks behind a dynamic import per topic (the curriculum spec asks for it), with the plan reading
  only their ids and stairs at boot.
  **FOLLOWUP-23** (the follow-ups lane's last stage) set both first-load gates on the merged app, after every lane's
  screens had landed. The teacher's rules (the board, the class settings, the library, the assistant, the class exam
  and its print sheets, the class report, the pilot kit, the student view's bar, the demo banner, the teacher's way in
  and the class setting question) left `app.css`, `v4.css` and `canon.css` for `styles/lazy/teacher.css`; the parents'
  area's (the frame, the plan and its renewal, the devices, the hand-over, the adult step, the legal draft note) for
  `lazy/parents.css`; the legal pages' reading rules for `lazy/legal.css` (the pilot kit's documents read the same way,
  so `teacher/Guide.jsx` imports it too); and the saving screens' (Settings › שמירת ההתקדמות, the support details, the
  reminder's Home Screen row, the backup code's sheet, the restore screen) for `lazy/durable.css`: 569 rules in all. A
  rule moved only when every selector in it names a class that no first-load file writes, and
  `web/src/styles/lazy.test.js` keeps it so for every rule of the four files (a file's markup is covered when the file
  imports the stylesheet, or brings it in through a static import, or every file that imports it is covered). Where a
  move would have changed the cascade (a lazy file loads after every first-load rule), the rule stayed or was made
  independent of the order: the board's view tabs are `.seg` buttons too, so their three `.t-tab` rules stay in
  `app.css`, ahead of `canon.css`'s `.seg`; the pilot kit's two heading rules became `.legal.sd-doc h2/h3`, so
  `legal.css` may load before or after `teacher.css`. The demo class's code (`lib/demo.js`) and its sheet
  (`components/DemoAsk.jsx`) load on demand: `lib/demoWanted.js` (this tab's demo record, the address, the sheet's
  flags) decides before the first screen, and `main.jsx` imports the demo only then, before the first render, so the
  saving hold in `store.js` works exactly as before (the demo's e2e tests pass).
  Proof that nothing changed on screen: a dump of every computed property of every element (and its ::before and
  ::after), taken at the same states in the build before the move and after it, phone light and dark. The states: the
  teacher suite's 64 in dark (its light states are its visual baselines, on four sizes); the parents' area in each of
  its 14 QA states, the hand-over, the cancel page, the four legal pages, Settings with the saving section and the
  support details, the restore screen, the demo's board, settings, library, report, guide and assistant, and a legal
  page opened before the pilot kit (the two lazy files loaded the other way round): 98 of 98 identical. The end states
  of the trust, report, subscription, restore, backup-file, family-guard, install, durable, push, monitor and
  class-goal specs matched too, apart from differences that come from the run, not the CSS: a random backup code's QR,
  a React id, a toast still on screen, a frame of a fade, and the content of a closed `<details>`, which a direct
  check measures the same in both builds, closed and open. The check caught two moves that did change the screen,
  and both were put right before the commit: the board's view tabs (their `.t-tab` rules stay in `app.css`), and the
  support details' rows, whose rules had stayed behind while `.save-row` moved (they moved too). The visual baselines
  are unchanged; none was updated.
  Measured (gzip-9, KB = 1000 B): boot JS 433.5 → **432.9 KB** (the demo's 0.7 KB), render-blocking CSS 52.6 →
  **45.4 KB**. The gates are now **433 KB** (it does not go up, so 0.1 KB of room is left) and **46 KB**. The four
  lazy files are 11.7, 1.9, 0.6 and 2.3 KB gzipped, each fetched only with its screens. The demo's two modules are on
  `budget.json`'s `lazyOnly` list now, so a build that pulls them back into the first load fails. FOLLOWUP-45's 260 KB
  and 32 KB stay DURABLE-11's targets: recorded, a warning, not a gate. Most of what is left in the first-load CSS is
  the lesson's, the teaching figures' and the stair player's rules (about 50 KB of source that only the lesson's chunks
  use): the next step toward 32 KB. `e2e/perf.spec.js` holds only the timing test (`PERF=1`), and a timing taken on
  this shared machine means little (FOLLOWUP-29), so the bytes here come from `check-budget.mjs` and the nightly run
  keeps the timings.
  **Room under the boot gate** (the follow-ups review: 432.9 against 433, and the public site's build, made with
  `VITE_API_URL=none` as `publish-pages.sh` and `publish-staging.sh` make it, measured 433.1 and failed). The vite
  module map (`scripts/vite-plugin-budget.mjs`, ranked by each module's gzipped size in the entry chunk) put the
  tutor's code next after React, React Router, motion and Base UI: `shared/ai.js` (the prompts, the answer schemas, the
  exam and feedback readers) with `shared/pedagogy.js`, `topicWays.js`, `guard.js`, `verify.js` and `tutorContext.js`,
  about 60 KB of source gzipped, all in the first load because `lib/account.js` and `lib/qaFixtures.js` read five
  constants from `shared/ai.js` (the kinds, their daily groups and weights, the free taste's kinds). Those five now live
  in `shared/aiKinds.js`, which `shared/ai.js` re-exports for the Worker, so the rest loads with the tutor (`lib/ai.js`,
  a screen with the assistant, the lesson's help, the exam check). `src/styles/lazy.test.js` walks every static import
  from `main.jsx` and fails if `shared/ai.js`, `pedagogy.js`, `topicWays.js`, `guard.js` or `lib/ai.js` is reached, and
  `budget.json`'s `lazyOnly` now names `ai`, `pedagogy`, `guard` and `topicWays`, so a build that pulls them back fails
  too. Measured: boot JS 432.9 → **403.3 KB** (`npm run build`'s `vite build`) and **403.5 KB** (the public site's
  build), CSS 45.5 KB (gate 46). The ratchet set the boot gate to 403.3 + 5% = **424 KB**: about **20.7 KB of room**
  (20.5 KB for the public site's build), where there was 0.1. The 306 KB family gate of FOLLOWUP-23's text belonged
  to the family lane alone; the merged app holds every lane's first screens, so its gate is this one, and the 260 KB
  target stays the aim (next in size: the exercise generators of `content/*.js` that the map and the placement test
  read, about 60 KB gzipped after minifying; they would need the map to read only titles and levels at boot).
  **The stage-5 merge** (curriculum stage 5: the functions unit, `eq:6`-`7`, the guest rule) brought its exercise
  generators (`content/func.js` 12.1 KB gzipped on its own, `content/eq.js` +6.6 KB, `content/manip.js`'s figure words
  +3.7 KB), its challenge tasks and the guest rule into the first load: 427.4 KB against the 424 KB gate, render-blocking
  CSS 46.0 KB against 46, precache 4.89 MB against 4.79. The boot gate does not go up, so two moves made room, each the
  same kind as FOLLOWUP-23's: the help lines (`SUPPORT`) that the first screen shows (`SupportSheet.jsx`,
  `SupportCard.jsx`) now live in `shared/helpLines.js`, which `shared/safety.js` re-exports for the Worker and every
  other caller, so the distress detector, the masking and the output screen (`safety.js`, with `blocklist.js`) load with
  the screens that read a child's words; `styles/lazy.test.js` walks main.jsx's static imports and fails if either comes
  back, and `budget.json`'s `lazyOnly` names `safety` and `blocklist`. The lane's graph and protractor rules (the drawn
  graph, FUNC-1; the protractor, FUNC-1.2) left `app.css` for `styles/lazy/graph.css`, which the two drawing modules
  (`components/manip/graphAxes.jsx`, `protractor.jsx`) import; no first-load rule sets the same properties on those
  elements with the same weight, so the later load changes nothing on screen. Measured: boot JS **420.9 KB** (gate 424,
  unchanged), CSS **45.5 KB** (gate 46, unchanged). The precache is the raw bytes of every file kept offline, which no
  lazy load changes: 4.89 MB, the new topic's own content, so its gate moved by the integration rule (measured + 5%) to
  **5.13 MB**. About 3 KB is left under the boot gate: the next curriculum merge (stages 2-4, the classroom lane) needs
  the generators split the paragraph above describes, not a raised gate.
- **The timing test** (`web/e2e/perf.spec.js`, tag `@perf`, phone project, skipped unless `PERF=1`):
  `web/scripts/serve-gzip.mjs` serves the build gzipped on port 4204 (vite preview does not compress); Chrome DevTools
  Protocol slows the CPU 4x and the network to 150 ms, 200,000 B/s down, 93,750 B/s up; FCP and LCP from
  `PerformanceObserver`, the longest task from `longtask`; a second visit with the service worker for the repeat LCP;
  `test-results/perf.json`; it fails over `budget.json`'s timing × 1.1. `PERF_DIST=<folder>` measures another build.
  `.github/workflows/perf.yml` runs the build and the test every night at 02:23 UTC and keeps `perf.json`.
- **Measured once, on this shared 4-CPU machine while four other builds ran (load average about 8)**, so the numbers
  are slower than a quiet machine or a CI runner would give:

  | release | FCP | LCP | longest boot task | repeat LCP |
  |---|---|---|---|---|
  | council (`43e4948`, from the council's run, vite preview without gzip) | 3.3 s | | 368 ms | |
  | before DURABLE-11 (`b0fbcb2`, this test) | 4.79 s | 4.79 s | 242 ms | 0.72 s |
  | this release (this test) | **2.79 s** | **2.79 s** | **178 ms** | **0.41 s** |
  | budget (fails over × 1.1) | 2.5 s | 3.0 s | 200 ms | 1.5 s |

  LCP, the longest task and the repeat visit are within budget; FCP is 2.79 s against 2.75 s (2.5 × 1.1), so the test
  failed here by 38 ms. The council's 3.3 s was measured differently (no gzip, no throttling profile of this test), so
  the comparable before/after is the middle two rows: 2.0 s faster to the first paint.
- **Tests.** `scripts/check-budget.test.mjs` (a fake dist: the boot files found in `index.html`, the CSS summed over
  two stylesheets, a target miss that only warns, each gate failing, the CLI's exit codes). `components/MathText.test.js`
  (plain words, escaped, before KaTeX; drawn after; fetched once). `components/RichText.test.jsx` (the text as written
  before its file, markdown after, inline, a fallback, the legal page's element with `$` kept; Markdown never renders
  raw HTML). `lib/bootTopics.test.js` (the routes that fetch the lesson screen). Visual baselines (`visual.spec.js` on
  phone, phone-small and desktop) and `screens.spec.js`: unchanged.
- **Screenshots, looked at** (`qa-evidence/durable/budget-*.png`): `terms-before-390` and `terms-after-390`
  (the legal page drawn by the lazy markdown: the same), `lesson-eq2-after-320/390` (a lesson opened straight: its
  maths drawn), `lesson-eq2-no-katex-390/320` (KaTeX blocked: `7x - 10 = -80` as plain words, readable).
