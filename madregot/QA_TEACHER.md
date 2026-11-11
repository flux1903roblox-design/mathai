# Madregot for teachers and schools: the proof pack

What the council found about the teacher's side, what changed, and where the proof is: the commit, the tests and the
pictures. Every row below points to tests that run on the current code. Nothing is marked done from memory. The council's
findings are numbered as in the council's own list (`council1.json`, `annotated`, counted from 0). The work items
(TEACHER-1 … TEACHER-16) are the teacher lane's spec.

## How to check it yourself

From `madregot/` on a checkout of this branch (no server, no email, no payment company, no AI key: the tests use a fake
Worker and synthetic names, all at `example.test`):

| What | Command | Expected |
|---|---|---|
| Worker (D1 in memory) | `cd worker && node --test test/*.test.js` | all pass |
| Web unit | `cd web && npx vitest run` | all pass |
| The teacher's side end to end, on all four sizes | `cd web && npx playwright test -c e2e/playwright.config.js teacher.spec.js` | 240 pass (60 cases × 4 projects) |
| The demo class, by hand | open the public build, then **אני מורה** › **לראות לוח לדוגמה, בלי הרשמה** (or `#/?start=demo`) | the board of 24 invented students, with no request to `/api` |

Another copy of the repo can run the suite on its own port: `E2E_PORT=4221 npx playwright …`.

**The pictures.** Each `shot()` in `web/e2e/teacher.spec.js` is a visual baseline: the screen is compared with
`web/e2e/__screens__/<project>/teacher-<name>.png` on all four projects, phone-small (320×568), phone (390×844), tablet
(768×1024) and desktop (1440×900). That is 64 screens × 4 = 256 pictures, each looked at before it was accepted. Toasts
are hidden in the compared picture (they leave on a timer; each test checks their words). After an intended change, look
at the new pictures, then: `npx playwright test -c e2e/playwright.config.js teacher.spec.js --update-snapshots`.
In the table, `teacher-x` means the four files `__screens__/{phone-small,phone,tablet,desktop}/teacher-x.png`.

**The printouts** are written by the same suite to `web/test-results/`: `teacher-exam-exam.pdf`, `teacher-exam-key.pdf`,
`teacher-report.pdf`, `teacher-guide-letter.pdf`, `teacher-guide-principal.pdf`, and the CSV `teacher-report.csv`.

## The lane's commits

| Commit | What it holds | Items |
|---|---|---|
| `f2f544e` | Board split into tabs, the shared e2e fake server, D1 tests of the routes that already existed | TEACHER-4 §6, TEACHER-14 §1-2 |
| `3ddb8b0` | A teacher's email account opens the class: `class_owners`, the key or the owner's session, recovery | TEACHER-1 §1-4 |
| `c2c96ba` | The email sign-in screens, the public teacher page, the bind card, the class switcher | TEACHER-1 §5-6 |
| `787fc74` | Retention periods and class delete on the server, the night purge | TRUST-7 (server), TEACHER-9 §4 (server) |
| `9f7d095` | The class settings page and the delete flow | TEACHER-9 §1, §4-5 |
| `2b055db` | Every lesson, check and the AI in a marked student view; the lessons library; the teacher's assistant | TEACHER-2 |
| `e56fc95` | Assignments on the server, teacher and student routes | TEACHER-4 §1-5, TEACHER-5 §1 |
| `224ff2e` | Giving work with a due date and following it per student | TEACHER-4 §6-7 |
| `33f27a5` | The teacher's work at the top of the student's mission | TEACHER-5 §2-6 |
| `99aa36a` | The printable class exam with its key, two versions | TEACHER-3 |
| `e50f74a` | The class exam sent to the class and solved in the app | TEACHER-3 §4, TEACHER-5 §4 |
| `245b8c6` | The class report, its CSV for Excel and its printout | TEACHER-7, TEACHER-9 §1.7 |
| `c7b4c9e` | Help both ways: replies, status, the student's answer, the daily email | TEACHER-6 |
| `38125a7` | A page per student and the short ranked "כדאי לבדוק איתם" | TEACHER-8 |
| `31845bf` | The Ministry's AI rules per class on the server (student AI off in school classes) | TRUST-11 |
| `e6ecaad` | The teacher's screens for the class's student AI | TEACHER-9 §1.3, §2-3 |
| `62eff5c` | The demo class, with no server and no sign-in | TEACHER-15 |
| `c4a82d2` | The pilot kit, in the repo and in the app | TEACHER-10 |
| `0ed5b5c` | The pilot's numbers, the Gefen readiness document, its code side | TEACHER-11, TEACHER-12 |
| `faa060c` | The 240 visual baselines and the fixes the tablet and desktop pictures asked for | TEACHER-14 §3 |

## Findings answered

### buyers #33 (major): "The teacher cannot direct the work: no assigning a stair or homework with a due date, no completion tracking, no export to משו"ב or Google Classroom, no per-student drill-down (names are plain text)."

- **What changed.** A teacher gives a stair, a mastery check or a class exam to the class, to the students who made a
  mistake or to chosen students, with a due date that moves off a rest day (TEACHER-4). Students see it first in today's
  mission, in calm words, and their progress comes back once, never backwards, offline included (TEACHER-5). "משימות"
  shows "{done}/{n} סיימו" per assignment and a row per student. After sending, a message to copy (for Mashov messages,
  WhatsApp or Teams) and a Google Classroom share link. The class report exports a CSV that opens in Excel and Google
  Sheets in Hebrew, with names only (TEACHER-7). No Mashov supplier API was found, so the export is the CSV and the
  copied message. Every name opens the student's own page (TEACHER-8).
- **Worker tests.** `assignments.test.js` (all 16: creation and refusals, the class exam's items byte for byte, both caps,
  counts by Jerusalem day with the 23:30 and 00:30 cases, targets, update, delete, student removal, the dashboard, both
  credentials, the student's list, the monotonic report, refusals, the purge); `teacher-report.test.js` (the week equals
  the board, ranges, 400 days, assignments by row with no id, 60 an hour, the student's page and its 404s).
- **Vitest.** `lib/assign.test.js`, `learn/assignments.test.ts`, `lib/classWork.test.js`, `lib/teacherCsv.test.js`
  (cases 1-7: BOM and CRLF, quoting, the formula guard with the header cells, numbers, no ID-shaped number, plain TeX,
  RFC 4180 round trip), `lib/report.test.js`.
- **e2e** (`teacher.spec.js`). TEACHER-4: "from "מחר": practice on that stair for the two students who made the mistake,
  then the message and the Classroom link"; "a week from a Saturday is a Saturday"; ""משימות" for a class of 24";
  "from the library: "לתת לכיתה" …". TEACHER-5 (7 cases). TEACHER-7 cases 1-4. TEACHER-8 cases 1-3.
- **Pictures.** `teacher-assign-sheet`, `teacher-assign-share`, `teacher-assign-restday`, `teacher-work-tab`,
  `teacher-assignment-detail`, `teacher-student-today-teacher-work`, `teacher-student-home-teacher-work` (the home's
  banner names the work once it is the plan's next step, FOLLOWUP-17; it replaced `teacher-student-home-teacher-chip`),
  `teacher-report`, `teacher-student-sheet`, `teacher-student-sheet-end`, `teacher-attention`.
- **Commits.** `e56fc95`, `224ff2e`, `33f27a5`, `245b8c6`, `38125a7`.

### buyers #34 (major): "The teacher role is locked out of the content and the AI it supposedly licenses. A teacher cannot preview a lesson, use the tutor … or generate the printable practice exam with answer key."

- **What changed.** From the board's tools strip, "השיעורים" lists every stair of grade ז׳ and ח׳ (algebra included), and
  each opens at any stage or as its mastery check in a marked "תצוגת תלמיד" frame that leads back and sends nothing to
  the class (TEACHER-2). "העוזר החכם" opens the tutor for the teacher with the Ministry's no-names line, on the class's
  credentials. "מבחן להדפסה" builds a practice exam from chosen stairs, 6, 10 or 14 questions, one or two versions, and
  prints the exam (name and date lines, room to work) and a separate key with the worked steps (TEACHER-3). Every
  answer is computed by the app's own generators.
- **Worker tests.** `assignments.test.js` "1. a class exam: 1..14 items with the app's fields only; exact and var are kept"
  (the frozen exam the server accepts).
- **Vitest.** `lib/teacher.test.js` "the student view (TEACHER-2)" (previewMode, no automatic tutor questions, the way
  back); `lib/exam.test.js` "class exam" cases 1-7 and the server-validator round trip; `lib/lesson.test.js` (fixed
  questions, √50 as 7.07 through the frozen exact).
- **e2e.** TEACHER-2 cases 1-7 (the library to a stair and back; grade ח׳ to stage C; a check and practice that send
  nothing; the assistant's note and its class headers; the keypad inside 320×568; the way back from a check, a stage and
  /rescue; the student addresses). TEACHER-3: "6 questions on 2 stairs in two versions …", "?skills preselects the
  stairs …", "sent to the class as version ב …", ""מבחן תרגול" in the assign sheet with no exam …".
- **Pictures.** `teacher-board-tools`, `teacher-library`, `teacher-preview-stage`, `teacher-assistant`,
  `teacher-exam-new`, `teacher-exam-sheet`, `teacher-exam-key`, `teacher-assign-exam`; PDFs `teacher-exam-exam.pdf`,
  `teacher-exam-key.pdf`.
- **Commits.** `2b055db`, `99aa36a`, `e50f74a`.

### buyers #35 (major): "School procurement and privacy blockers: … no data retention or deletion for student records … There is also no path into the Gefen (גפ"ן) catalogue schools buy from."

- **What changed.** Retention periods in one module (`shared/retention.js`) that both the night purge and the teacher's
  words read: notebook pages 30 days after a request is closed, help requests 180 days, attempts, exams and
  assignments 400 days, idle students and idle classes 400 days. A class settings page shows them, and deletes the
  class after its name is typed (and, for a class bound to an email, after the owner's fresh code), with the year's
  CSV offered first (TEACHER-9). `docs/schools/GEFEN_READINESS.md` sets out the three Gefen routes from the tender
  texts, where Madregot stands on each requirement, and the owner's steps; a Gefen order is one owner command,
  `grant-school --gefen <order>` (TEACHER-12). The security headers a technical check expects are held by a test and
  by the build check; a load test script waits for the staging run. The privacy policy and terms are the trust lane's
  (TRUST-2), not this lane's.
- **Worker tests.** `retention.test.js` (all 10: each period at its edge, the upload guard, idle student and idle class
  gone from every table by a scan of `sqlite_master`, batches of 2000, class delete with confirm and licence, the other
  class untouched); `teacher.test.js` "deleting a class bound to an email …", "renaming a class …", "a Gefen order's
  code (grant-school --gefen) …"; `owner-script.test.js` (`--gefen` in both approval states, bad references, `list
  --gefen`); `loadtest.test.js` (4).
- **Vitest.** `shared/retention.test.js` (the words follow the numbers); `lib/teacher.test.js` "the class itself: rename,
  delete …"; `headers.test.js` (the four headers and `check-dist.mjs`).
- **e2e.** TEACHER-9 "the settings open from the board's tools …", "a new teacher key …", "deleting a class waits for its
  name …", "a class bound to the email: the owner's fresh code first …"; TEACHER-7 case 4 (the year's CSV from the
  settings and the delete sheet).
- **Pictures.** `teacher-settings`, `teacher-delete-class`, `teacher-demo-settings-end`.
- **Commits.** `787fc74`, `9f7d095`, `245b8c6`, `0ed5b5c`.

### buyers #37 (major): "Teacher onboarding is fragile. Access is a class code plus a 24-hex 'teacher key' kept on one device, with no email account and no recovery. Lose it and the class is gone."

- **What changed.** A teacher opens a class with an email code and never sees a key to guard. On any other device the same
  email brings the classes back, with no key typed. A class opened with its key alone is offered a one-tap bind to the
  email. The key keeps working until the owner replaces it, which needs a fresh code and sends an email; it is never
  replaced behind the teacher's back. A shared staff-room computer keeps the sign-in for the tab only (TEACHER-1).
- **Worker tests.** `teacher-account.test.js` cases 1-10 (bound at once, the dashboard with the owner's session, binding
  and `owned_by_other`, the class list, a new key only with a fresh code, the teacher's AI tier, account deletion
  unbinding, 20 classes, the key checked first, an invalid session making no class).
- **Vitest.** `lib/teacher.test.js` "teacherHeaders", "teacherApi", "the account's classes", "the bind card and the public
  site's link"; `lib/parent.test.js` (a teacher's session survives the profile and a reload; "shared computer" keeps it in
  the tab).
- **e2e.** TEACHER-1 (9 cases, the public site's one under buyers #29): "a teacher opens a class with email, and on a
  second device signs in and gets the class back with no key", "an email with no classes …", "the sign-in survives a
  reload, and with "shared computer" …",
  "FreshClass explains the real student path …", "without email on the server …", ""להמשיך בלי מייל" asks first …",
  "a class opened with its key: the board offers to bind it …", "signed in, the board adds the email's other classes …".
- **Pictures.** `teacher-start-choose`, `teacher-start-email`, `teacher-start-details`, `teacher-fresh-bound`,
  `teacher-restore`, `teacher-restore-empty`, `teacher-signin-again`, `teacher-no-email-sheet`, `teacher-fresh-key`,
  `teacher-bind-card`, `teacher-more-classes`.
- **Commits.** `3ddb8b0`, `c2c96ba`, `9f7d095` (the new key in the settings).

### buyers (minor): "Half of the teacher dashboard's exam data comes from a paid feature … in an unlicensed class … 'נושאים חלשים במבחנים' stay empty."

- **What changed.** A class exam the teacher sends is solved in the app by every student, free, and its result feeds the
  board's "מבחנים" tab and "נושאים חלשים במבחנים" (TEACHER-3 §4, TEACHER-5 §4).
- **Worker tests.** `assignments.test.js` "8. the dashboard: open assignments with counts, mistakes with ids and their
  stair, class exams with the other exams".
- **Vitest.** `lib/lesson.test.js` (the fixed questions, per-slot results, the class-exam-done log); `lib/classWork.test.js`
  "a class exam's questions on the device".
- **e2e.** TEACHER-5 "3. the class exam: the start card, the three questions in order, the result to the teacher; no AI
  is asked", "4. offline at the end …", "started before and left …".
- **Pictures.** `teacher-student-class-exam-start`, `teacher-student-class-exam-done`, `teacher-demo-board` (the weak
  topics group from six finished class exams).
- **Commits.** `e50f74a`, `e56fc95`.

### buyers (minor): "Help requests are one-way. The student never learns whether the teacher saw or handled the request, and the teacher cannot reply in the app."

- **What changed.** The teacher answers in a few words or with a quick reply; the student sees the status (נשלחה, נקראה,
  יש תשובה, טופלה) and the reply, gets one calm notice outside lessons, and can answer "תודה, הבנתי" or "עדיין לא ברור
  לי" only after the teacher wrote. Three messages a side, no links, phone numbers or email addresses in either
  direction, deleted with the request. The owner can turn on one daily email with the count (TEACHER-6).
- **Worker tests.** `help-thread.test.js` cases 1-6 and 4a (the reply and its limit, the student's status, answering only
  after the teacher, the contact guard both ways, the dashboard's threads, deletion and the purge, the daily email);
  `teacher.test.js` "asking for help twice …", "help requests: seen keeps its first time …", "the notebook page: only
  for its own class …".
- **Vitest.** `lib/help.test.js`.
- **e2e.** TEACHER-6 cases 1-4.
- **Pictures.** `teacher-help-thread`, `teacher-settings-notices`, `teacher-student-my-help`.
- **Commits.** `c7b4c9e`.

### buyers (minor): "The 'כדאי לבדוק איתם' list is unbounded and unranked. In a 24-student synthetic class it listed 22 students, which stops being an action list."

- **What changed.** At most six students, ranked by one stated score (idle days, a low first-try rate, open help
  requests, late work), with the reasons beside each name; "ועוד {n}. לרשימה המלאה" opens the students tab sorted the
  same way (TEACHER-8).
- **Worker tests.** `teacher-report.test.js` "a student's page: the work given to that student (late as in the report) …".
- **Vitest.** `learn/attention.test.ts` (24 students where 22 met the old rule give 6 and "16 more"; the reasons by weight;
  help and late work outrank 3 idle days; a never-practised student).
- **e2e.** TEACHER-8 "1. "מחר" ranks six with their reasons …", "2. "ועוד": the students tab sorted by need …".
- **Pictures.** `teacher-attention`, `teacher-demo-board`.
- **Commits.** `38125a7`.

### buyers #29 (critical), the teacher part: "Nothing can be bought or used by a teacher today" (the public build told a teacher to open a Cloudflare account and run `setup.ps1`).

- **What changed.** The public no-server site no longer mentions a server set-up: it sends a teacher to the hosted app
  (`VITE_TEACHER_URL`) and offers the demo class to try at once (TEACHER-1 §5, TEACHER-15). The deployment itself is
  the owner's (below).
- **Vitest.** `lib/teacher.test.js` "teacherSiteLink opens the hosted app on the teacher's way in …".
- **e2e.** TEACHER-1 "the public no-server build sends a teacher to the full app, and never to a server set-up";
  TEACHER-15 case 1.
- **Pictures.** `teacher-public-site`, `teacher-public-demo-button`.
- **Commits.** `c2c96ba`, `62eff5c`.

### market topFix 1: "Choose one beachhead … free use in grade 7-8 classrooms led by teachers. Get 3-5 real teachers using the teacher dashboard for a few weeks, and measure weekly active students and return rate."

- **What changed.** Everything a pilot needs except the pilot itself: the kit (a teacher guide, a parent letter with its
  consent slip, the principal's approval form quoting items 3 and 8 of the Ministry's letter, a two-week plan, a
  product sheet), in the repo and filled in for the class in the app (TEACHER-10); one read-only owner command that
  turns the plan's measures into numbers with no names, weekly actives and the return rate included (TEACHER-11); the
  demo class a teacher sees before agreeing (TEACHER-15); the Gefen route (TEACHER-12). Running the pilot is the
  owner's (TEACHER-13, below).
- **Worker tests.** `pilot.test.js` cases 1-8 (weekly actives and return rate, medians, on-time work and passes, paired
  pre/post, reply times, "מעט מדי נתונים" under five, the JSON with no name or student id, the usage line and `--list`).
- **Vitest.** `lib/schoolDocs.test.js` cases 1-8 plus escaping and copying; `lib/teacherDemo.test.js`.
- **e2e.** TEACHER-10 (3 cases); TEACHER-15 (5 cases).
- **Pictures.** `teacher-guide-list`, `teacher-guide-letter`, `teacher-guide-letter-slip`, `teacher-guide-principal`,
  `teacher-guide-demo-sheet`; PDFs `teacher-guide-letter.pdf`, `teacher-guide-principal.pdf`.
- **Commits.** `c4a82d2`, `0ed5b5c`, `62eff5c`.

### learning #9 (major): "There is no evidence that it teaches real students. No pilot has been run and no learning outcomes have been measured."

- **What changed.** The code side of measuring it: the pilot plan's pre and post class exams (one exam, version א on day 1
  and ב on day 10, solved in the app), their results paired per student, first-try rates on the stairs given early and
  late, and the command that computes it (TEACHER-3, -5, -10, -11). No real students have used it yet: that is
  TEACHER-13, the owner's.
- **Tests.** As market topFix 1, plus `pilot.test.js` "4. prePost pairs only the students with both exams …" and
  TEACHER-3 "sent to the class as version ב …".
- **Commits.** `c4a82d2`, `0ed5b5c`, `e50f74a`.

### trust #53 (critical), the UI half: "SCHOOL BLOCKER: class licences conflict with the Ministry of Education's AI-tool rules."

- **What changed.** The teacher's screens on the trust lane's rule engine (TRUST-11, built on this branch in `31845bf`):
  the settings card "העוזר החכם לתלמידים" says off and why in a school class while Madregot is not in the catalogue,
  with no switch and only a quote for a licence; once approved, the Ministry's consent forms, then the switch; a
  per-student switch; "איפה הכיתה הזו לומדת?" when a class is opened, a private group needing an attestation. The
  copy is trust Appendix E §E.8 word for word.
- **Worker tests.** `classai.test.js` (all 8); `schoolRules.test.js` (every row of the rule's truth table, failing closed).
- **Vitest.** `content/classAi.test.js` (§E.8 word for word, every state of the card, failing closed).
- **e2e.** TEACHER-9 "a school class before approval: "כבוי" …", "approved, consent needed …", ""איפה הכיתה הזו
  לומדת?" …"; `subscription.spec.js` "the server says the class's AI is off …", "a call refused with class_ai_off …".
- **Pictures.** `teacher-settings-school-ai-off`, `teacher-settings-school-ai-off-card`, `teacher-settings-consent`,
  `teacher-settings-ai-on`, `teacher-student-ai-off`, `teacher-student-ai-actions`, `teacher-start-setting`,
  `teacher-settings-change-setting`, `teacher-add-class-setting`.
- **Commits.** `31845bf` (server), `e6ecaad` (screens).

### trust topFix 4: "Get the parental-consent form into the class onboarding."

- **What changed.** A new class shows "מכתב להורים להדפסה" right under its code, and the consent block of the AI card
  shows it too; the letter opens filled in with the class, the teacher and the dates, prints with its slip on a new
  page under a cut line, and has a short WhatsApp version. Its AI sentence follows the class's policy (TEACHER-10).
- **Vitest.** `lib/schoolDocs.test.js` "3. AI_LINE follows the class's policy …", "4. the parent letter: voluntary, the
  practice sheets for who does not take part, no ID number, the privacy address".
- **e2e.** TEACHER-10 "the guide, the parent letter filled in from the form …", "the ways in: the new class's link and the
  consent block both open the parent letter …".
- **Pictures.** `teacher-fresh-bound`, `teacher-fresh-key`, `teacher-settings-consent`, `teacher-guide-letter`,
  `teacher-guide-letter-slip`.
- **Commits.** `c4a82d2`.

### engineering #47 (major), the teacher half: "Minors' data cannot be deleted, and a teacher who loses their device loses the class."

- **What changed.** The class follows the teacher's email (buyers #37). A teacher deletes a class, and every table of the
  class goes in one batch (students, attempts, help and its replies, pages, exams, assignments, work, owners, counters,
  notices); retention runs every night (buyers #35). Removing a student takes their work, targets, replies and
  counters.
- **Tests.** As buyers #35 and #37, plus `teacher.test.js` "removing a student deletes their rows, and their token stops
  working", `assignments.test.js` "7. removing a student deletes their work and targets", `help-thread.test.js` "5.
  deleting a student deletes the replies …", and `schema.test.js` (every migration applied in order).
- **Commits.** `3ddb8b0`, `787fc74`, `9f7d095`, `e56fc95`, `c7b4c9e`.

### market #72 (strength, kept): "The exam features match the Israeli school routine of 'a test on date X'."

- **What changed.** Kept and taken into the classroom: the teacher prints a practice exam for the class with its key
  (TEACHER-3) and sends it with a date; students solve it in the app (TEACHER-5).
- **Tests.** As buyers #34 (TEACHER-3) and the class-exam minor finding (TEACHER-5).
- **Commits.** `99aa36a`, `e50f74a`.

### market and buyers, unverified: "I could not see the teacher dashboard and class features at runtime, because there is no server" · "The teacher dashboard against a real D1 database was not exercised."

- **What changed.** The demo class: on the public no-server site and in the app, "לראות לוח לדוגמה, בלי הרשמה" opens the
  full board with 24 invented students, two weeks of practice, assignments, help threads, class exams and a report.
  Every teacher screen works there and nothing is sent: the e2e records no request to `/api` (TEACHER-15). For the
  second note, the worker tests now run the dashboard, help and PIN routes against D1 (TEACHER-14 §2).
- **Worker tests.** `teacher.test.js` "the dashboard of a 3-student class: today, the week by Jerusalem days, first-try,
  mistakes with names, help and exams", the help, page, PIN and lock tests.
- **Vitest.** `lib/teacherDemo.test.js` (determinism, the counts, the names, every attention reason, each route's shape
  as the Worker answers it).
- **e2e.** TEACHER-15 cases 1-5 (no `/api` request; a student's device untouched; `#/?start=demo` and
  `?qa-teacher=demo`); TEACHER-10 "the demo class: the guide opens with the demo class …".
- **Pictures.** `teacher-public-demo-button`, `teacher-demo-board`, `teacher-demo-assign`, `teacher-demo-report`,
  `teacher-demo-settings`, `teacher-demo-settings-end`, `teacher-demo-assistant`, `teacher-demo-ask`,
  `teacher-guide-demo-sheet`.
- **Commits.** `62eff5c`, `f2f544e`.

## What the tablet and desktop pictures showed, and what was fixed

The teacher suite had run only on the phone. Run on all four projects, every case passed the first time; the pictures
showed five things, and a second run caught a sixth (a case that failed now and then on the wider screens). All six are
fixed in `faa060c`, in `web/src/styles/canon.css`:

| Seen on | What | Fix |
|---|---|---|
| tablet, desktop | The new-class sheet held its form in a second, narrower box (an old 420px limit) | the form fills the sheet, with no box of its own (phone too) |
| tablet | The tools strip hid "מדריך למורה" and cut "הגדרות הכיתה" behind the fade; a mouse cannot easily scroll a strip sideways | from 600px the tools wrap onto a second row, with no fade |
| tablet, desktop | On "מחר" in two or three columns, a rule sat above some cards and not others, so the headings did not line up | no rule between side-by-side groups (from 648px, where the grid has two columns) |
| desktop | The board's header (class name, code, buttons) sat at the window's edges, outside the board's 1100px column | the header's content lines up with the column from 1100px |
| desktop | The class report's table scrolled sideways inside an 880px page on a 1440px screen, and each student's row stood five lines tall (three repeated mistakes wrapped in a narrow column) | from 1024px the report takes the board's width, its two buttons sit side by side, and the mistakes column is wide enough for a mistake a line (the demo's rows went from 145px to 105px) |
| tablet, desktop | After "הארכת המועד", the toast sat over the sheet's "מחיקת המשימה"; a mouse resting on the toast held it open, so the button could not be clicked (the TEACHER-4 case timed out about one run in eight) | a toast lets the pointer through to what is under it; only its own action button takes it (on every screen). 24 runs of the three cases with toasts then passed |

The phone pictures did not change, except the new-class sheet.

Running the whole suite twice on the four projects (456 runs) caught two races in the tests themselves, fixed there: the
delete sheet's picture now waits for the settings page's licence card, so the page under the sheet is always scrolled
to the same place; and the demo's "nothing reaches the server" check now waits for TeacherStart's one `/api/health`
call before it starts counting. One case, TEACHER-5 "4. offline at the end …", failed once on desktop in a loaded run
and passed in all 34 runs after it (12 of them on desktop); see "Not covered here".

## The lane's review: what it reproduced, and what changed

A review of this lane reproduced five problems against the in-memory D1 and the app. Each is fixed, with a test that
failed before the fix.

| Problem the review reproduced | What changed | Tests |
|---|---|---|
| Anyone with the teacher key could bind a class opened without email to their own email, and the normal co-teacher path did it by accident: the creator lost delete, and after a new key, her way in (major) | The app offers the bind only on the device that opened the class (`createdHere`, set by TeacherStart and "כיתה נוספת"; a class whose key was typed in gets a quiet "אני פתחתי את הכיתה הזו" in the settings, with a question first). A class bound after it was opened is a late bind: the dashboard tells every device that comes with the key when (`boundElsewhere`, `boundAt`; a line on "מחר" for the first week, and the settings), nobody can make a new key for 7 days (409 `rekey_hold`, the owner sees from when), and support undoes a mistaken bind in that week with `npm run owner -- unbind-class --class <CODE>` | worker `teacher-account.test.js` 11, `owner-script.test.js` "unbind-class"; web `teacher.test.js` "only the device that opened the class …", "boundElsewhere …"; e2e TEACHER-1 "a device that came with the key …", "the owner of a class bound late …", "an email with no classes …" |
| The help-reply contact guard let phone numbers through with other separators (`_ * + ,`, a letter between groups), full-width or Arabic-Indic digits, handles and spelled-out addresses (minor) | `shared/contact.js`, used by the Worker (both directions) and the demo: NFKC, invisible characters removed, every script's digits read as ASCII; seven digits or more in one number across any short separator that is not maths; `@handle`, `at … dot`, `[at]`, `(dot)`, spaced domains. Maths still passes (`3 + 4 = 7`, `(-3)·(-4)`, lists, dates, decimals, thousands) | worker `help-thread.test.js` 4a (the review's variants, through both routes); web `teacherDemo.test.js` |
| A student could report any score for a class exam or check: a 3-question exam kept as 40/40 (minor) | `cleanWork`: a finished class exam reports exactly its questions, one status each; a check is a mastery check of 5 at most, and "passed" needs 5 asked and 4 right (the numbers are `learn/mastery.ts`'s, and a test keeps them equal) | worker `assignments.test.js` "reports that do not fit …", "a check assignment is the app's mastery check …" |
| "מחר" showed the topic's words for a mistake, sometimes a different mistake from the one the student was told, and grouped one id on two stairs as one row (TEACHER-16, minor) | Every mistake row is a stair's: the dashboard, the class report and the student's page group by topic, stair and mistake; "מחר", the student's sheet and the report name the stair on its own line, then the student's words (`lib/teacherText.js`: `mistakeText`, `stairName`); each student's cells, the printout and the CSV add the stair in brackets; "לתת תרגול על זה" goes to that stair, for the students who made the mistake there. The demo groups the same way | worker `teacher.test.js` "TEACHER-16 …"; web `lib/teacherText.test.js` (every stair, every id its content and its generators give), `teacherCsv.test.js` 6, `teacherDemo.test.js`; e2e TEACHER-4 "TEACHER-16 …" (`teacher-tomorrow-stairs`) |
| The load test did not reliably stay off production, and the repo had no staging Worker for the owner's step (minor) | `loadtest.mjs` refuses the production Worker by name (`madregot-api.*.workers.dev`, read from `wrangler.toml`) as well as `PUBLIC_URL`, and before sending anything asks `GET /api/health` and goes on only when it says `"staging": true`, which only the `[env.staging]` Worker says (`STAGING = "true"`, its own D1 `madregot-staging`). `npm run staging:deploy` deploys it | worker `loadtest.test.js` "the production Worker's own workers.dev address is refused …", "a real run first asks /api/health …"; `subscription.test.js` "health reports …" |

New pictures (each looked at on the four sizes): `teacher-tomorrow-stairs`, `teacher-settings-key-device`,
`teacher-bound-elsewhere-board`, `teacher-bound-elsewhere`. Updated, because the mistake rows now name their stair:
`teacher-report`, `teacher-student-sheet`, `teacher-student-sheet-end`, `teacher-demo-board`, `teacher-demo-assign`,
`teacher-demo-report` and `teacher-assign-share`/`teacher-assign-sheet` (the board under the sheet); and
`teacher-restore-empty`, whose words now send the teacher to the class settings to bind a class.

## Owner-only steps

The code for each is done and tested; each needs the owner once.

| Step | Status | The one action |
|---|---|---|
| TEACHER-1: email sending live | not done (owner) | Resend key and sender domain, as `SUBSCRIPTION.md` step 4 says: `cd madregot/worker && npx wrangler secret put RESEND_API_KEY` |
| TEACHER-1: the public site links to the hosted app | not done (owner) | `export TEACHER_URL=https://<the hosted app>/ CONTACT_EMAIL=<support address>`, then `./publish-pages.sh` |
| The lane's migration at deploy (`0005_teacher.sql`, the lane's `0003_teacher.sql` renumbered on main: `class_owners`, `class_settings`, assignments, help messages, `student_ai_off`) | not applied anywhere | `cd madregot/worker && npm run db:migrate` (then `npx wrangler deploy`) |
| TEACHER-11: the pilot's numbers on the live database | not run (no pilot yet) | `cd madregot/worker && npm run owner -- pilot-report --class <CODE> --from <D1> --to <D10> --consented <N> --pre <A> --post <B> --json > pilot-<CODE>.json` (the ids from `pilot-report --class <CODE> --list`) |
| TEACHER-12: the Gefen and catalogue filings | not started (owner) | the steps in `docs/schools/GEFEN_READINESS.md` §4; the load test on staging first: once, the staging Worker's database and secrets (§4 step 5), then `cd madregot/worker && npm run staging:deploy && node scripts/loadtest.mjs https://madregot-api-staging.<account>.workers.dev --classes 10 --minutes 5`, its p50, p95 and error rate pasted into §3; the live headers once after deploy: `curl -sI https://<app>/ \| grep -i -E 'content-security\|nosniff\|referrer\|permissions'`; on the first order: `npm run owner -- grant-school --classes K --seats N --until YYYY-MM-DD --invoice R --gefen <order>` |
| A class bound to the wrong email (a late bind, within its first week) | when a teacher writes in | `cd madregot/worker && npm run owner -- unbind-class --class <CODE>` (the class keeps its key; the teacher who opened it binds it from the device that opened it) |
| TEACHER-13: the real pilot | not started (owner) | 3-5 teachers in at least 2 schools, run by `docs/schools/` (the principal's form, the parent letter, the plan), then the TEACHER-11 command per class |
| The parent letter's legal look | not done (owner) | add the letter (Appendix B) to the lawyer's packet of TRUST-13 |

## Not covered here

- **Axe on the teacher screens (TEACHER-14 §4).** Not run: neither `axe-core` nor `@axe-core/playwright` is among the
  installed packages, and this lane adds no dependency. The package to add is `@axe-core/playwright@4.10.1` (dev), then
  one e2e case per screen: `/teacher`, `/teacher/lessons`, `/teacher/settings`, `/teacher/report`, the demo board and the
  student's Quests class block. Until then the e2e finds every control by its role and accessible name, which checks
  those; contrast and axe's other rules are not checked here.
- **TRUST-3's distress check on a student's help reply** and its care marker: `detectDistress` is the trust lane's and
  is not on this branch yet; the reply route is where it goes (`worker/src/help.js`, the student's side).
- **The backup row in the class settings (TEACHER-9 §1.2, `SaveSection role="teacher"`)**: it waits on DURABLE-3/4,
  which are not on this branch.
- **A sync asked for while another is running is dropped** (`syncNow` in `web/src/lib/api.js`), so a class exam's
  result that waited offline can take up to the next minute's sync to reach the teacher. This is one possible cause of
  the one TEACHER-5 failure above; it belongs to the sync code, not this lane, and was left as it is.
- **Real devices.** Every picture is Chromium with phone emulation; iOS Safari and a real tablet were not tested.
