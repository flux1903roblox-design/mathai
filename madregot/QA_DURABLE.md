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
