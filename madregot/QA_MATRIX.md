# Madregot QA matrix

Results of the final round, by screen and by device, on the final build. Every PASS below comes from a check that
ran on the current code; nothing is marked PASS from memory. The tables are generated from the audit data.
Defects referred to by ID are in [QA_AUDIT.md](QA_AUDIT.md).

**Legend:** PASS · FIXED AND RETESTED (a defect was observed on this screen at this size, was fixed, and the check
passes now) · FAIL · BLOCKED · NOT TESTED

**Engine:** Chromium (Playwright 1.63) with mobile emulation. **Real iOS Safari, real Android Chrome, WebKit and
screen readers: NOT TESTED** (A-2, A-3 in the audit).

## Devices

| Code | Viewport | Stands for |
|---|---|---|
| S | 320×568 | iPhone SE (1st gen), smallest supported |
| A | 360×640 | small Android |
| B | 375×667 | iPhone SE 2/3, iPhone 8 |
| C | 390×844 | iPhone 12–15 |
| D | 393×852 | Pixel 7, iPhone 15/16 |
| E | 430×932 | iPhone Pro Max |
| T | 768×1024 | iPad portrait |
| L | 1440×900 | laptop |
| W | 1920×1080 | desktop |

## What each check covers

- **Exercise audit** (9 devices × 14 exercise kinds × 3 states = 378 measurements): the question, the maths and the
  answer field visible together; the answer not covered and reachable; the check and feedback buttons on screen; the
  page never scrolls; nothing scrolls sideways; **the whole drawing or table inside the maths region, and at least
  60 % of it still in view after a wrong answer and after the answer is revealed** (added in round 4, R-31).
- **Screen audit** (19 screens × 9 devices = 171, both builds): no sideways scroll, nothing pressable and no error
  under the tab bar, no tap target under 32 px, no broken image, no clipped text, no console error.
- **Playwright suite** (`npm run test:e2e`): layout of 14 exercise kinds and the keypad on S, C, T, L; 8 journeys on
  C and L; 11 screens on S, C, T, L; 39 visual baselines on S, C, L; keyboard typing on L.
- **Retest scripts for the review** (47 checks), **AI failure states** (8), **axe-core** (30 scans), **keyboard focus**
  (7 screens). These were one-off scripts in that round's session, not files in the repo; the axe numbers in this file
  above "The standing axe suite" are from them.
- **The standing axe suite** (since 11 November 2026, PKG-1): `web/e2e/a11y.spec.js`, part of the normal Playwright
  suite and of CI. See its own section below.

## Exercise screen

| Exercise kind | S | A | B | C | D | E | T | L | W |
|---|---|---|---|---|---|---|---|---|---|
| Signed number (one field) | FIXED AND RETESTED | FIXED AND RETESTED | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Multiple choice | FIXED AND RETESTED | FIXED AND RETESTED | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Long expression | FIXED AND RETESTED | FIXED AND RETESTED | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Point on a grid (two fields) | FIXED AND RETESTED | FIXED AND RETESTED | FIXED AND RETESTED | PASS | PASS | PASS | PASS | PASS | PASS |
| Area on a grid | FIXED AND RETESTED | FIXED AND RETESTED | FIXED AND RETESTED | FIXED AND RETESTED | FIXED AND RETESTED | PASS | PASS | PASS | PASS |
| Missing vertex | FIXED AND RETESTED | FIXED AND RETESTED | FIXED AND RETESTED | FIXED AND RETESTED | FIXED AND RETESTED | PASS | PASS | PASS | PASS |
| Triangle drawing | FIXED AND RETESTED | FIXED AND RETESTED | FIXED AND RETESTED | PASS | PASS | PASS | PASS | PASS | PASS |
| Parallel lines | FIXED AND RETESTED | FIXED AND RETESTED | FIXED AND RETESTED | PASS | PASS | PASS | PASS | PASS | PASS |
| Table of values | FIXED AND RETESTED | FIXED AND RETESTED | FIXED AND RETESTED | PASS | PASS | PASS | PASS | PASS | PASS |
| Graph | FIXED AND RETESTED | FIXED AND RETESTED | FIXED AND RETESTED | FIXED AND RETESTED | FIXED AND RETESTED | PASS | PASS | PASS | PASS |
| Line equation (two fields) | FIXED AND RETESTED | FIXED AND RETESTED | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Word problem with a drawing | FIXED AND RETESTED | FIXED AND RETESTED | FIXED AND RETESTED | PASS | PASS | PASS | PASS | PASS | PASS |
| List of data | FIXED AND RETESTED | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Frequency table | FIXED AND RETESTED | FIXED AND RETESTED | FIXED AND RETESTED | PASS | PASS | PASS | PASS | PASS | PASS |

FIXED AND RETESTED marks cells that failed in the baseline measurement (D-001 to D-004). Round 4's stricter
drawing check (R-01, R-31) passes in every cell.

Share of the screen taken by the bottom region (answer, keypad, tools, check) / smallest maths region:
320×568 11–38 % / 153 px · 360×640 10–34 % / 222 px · 375×667 9–32 % / 249 px · 390×844 9–38 % / 285 px · 393×852 8–37 % / 293 px · 430×932 8–34 % / 371 px · 768×1024 7–31 % / 484 px · 1440×900 8–36 % / 770 px · 1920×1080 7–30 % / 950 px.

## Other screens

| Screen | S | A | B | C | D | E | T | L | W | Defects fixed |
|---|---|---|---|---|---|---|---|---|---|---|
| Welcome | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |  |
| Onboarding (questions) | FIXED AND RETESTED | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | R-19 |
| Teacher entry, no server | FIXED AND RETESTED | FIXED AND RETESTED | FIXED AND RETESTED | FIXED AND RETESTED | FIXED AND RETESTED | FIXED AND RETESTED | FIXED AND RETESTED | FIXED AND RETESTED | FIXED AND RETESTED | D-015 |
| Learn, first day | FIXED AND RETESTED | PASS | PASS | FIXED AND RETESTED | PASS | PASS | FIXED AND RETESTED | PASS | PASS | D-011 |
| Learn, with history | FIXED AND RETESTED | PASS | PASS | FIXED AND RETESTED | PASS | PASS | FIXED AND RETESTED | PASS | PASS | D-011, R-13 at 320 |
| Daily quests | FIXED AND RETESTED | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | R-18 |
| Exams | FIXED AND RETESTED | PASS | FIXED AND RETESTED | PASS | PASS | PASS | PASS | PASS | PASS | R-11, R-21 |
| Exam check, no server | PASS | PASS | FIXED AND RETESTED | PASS | PASS | PASS | PASS | PASS | PASS | R-11 |
| New practice exam | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |  |
| Practice exam sheet | PASS | PASS | FIXED AND RETESTED | PASS | PASS | PASS | PASS | PASS | PASS | R-11, R-14 |
| Improvement plan | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |  |
| AI assistant, not connected | FIXED AND RETESTED | FIXED AND RETESTED | FIXED AND RETESTED | FIXED AND RETESTED | FIXED AND RETESTED | FIXED AND RETESTED | FIXED AND RETESTED | FIXED AND RETESTED | FIXED AND RETESTED | D-009 |
| Profile | FIXED AND RETESTED | FIXED AND RETESTED | FIXED AND RETESTED | FIXED AND RETESTED | FIXED AND RETESTED | FIXED AND RETESTED | FIXED AND RETESTED | FIXED AND RETESTED | FIXED AND RETESTED | D-017, D-018 |
| Topics | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |  |
| Topic guide | FIXED AND RETESTED | PASS | FIXED AND RETESTED | PASS | PASS | PASS | PASS | PASS | PASS | R-11 |
| AI chat with an answer (full build) | FIXED AND RETESTED | PASS | FIXED AND RETESTED | PASS | PASS | PASS | PASS | PASS | PASS | R-04, R-16 |
| AI exercise writing (full build) | FIXED AND RETESTED | PASS | FIXED AND RETESTED | PASS | PASS | PASS | PASS | PASS | PASS | R-04, R-16 |
| AI photo check (full build) | FIXED AND RETESTED | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | R-16 |
| Exam check (full build) | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |  |

## Journeys and states not in the screen audit

| Journey or state | S | C | L | Other sizes |
|---|---|---|---|---|
| Onboarding, whole journey, first lesson opens (R-20) | PASS (retest) | PASS | PASS | NOT TESTED |
| Placement test → result → board | NOT TESTED | PASS | PASS | NOT TESTED |
| Whole lesson: mistake, retry, reveal, end screens, XP saved | NOT TESTED | PASS | PASS | NOT TESTED |
| Back button in a started lesson, quick repeated presses (R-02, R-29) | NOT TESTED | FIXED AND RETESTED | FIXED AND RETESTED | B: FIXED AND RETESTED |
| Plan lesson counts for the plan quest (R-03) | NOT TESTED | FIXED AND RETESTED | FIXED AND RETESTED | B: FIXED AND RETESTED |
| Hint on the second try, drawing whole (R-06) | FIXED AND RETESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| Notebook check result in view, full build (R-10) | NOT TESTED | NOT TESTED | NOT TESTED | B: FIXED AND RETESTED |
| Toast in a lesson above the keypad, class student (R-09) | NOT TESTED | NOT TESTED | NOT TESTED | B: FIXED AND RETESTED |
| Teacher: new class, key and tabs on screen (R-15) | NOT TESTED | NOT TESTED | NOT TESTED | B: FIXED AND RETESTED |
| AI failures: chat, writing, photo, tutor in a lesson (D-010, D-019) | FIXED AND RETESTED | FIXED AND RETESTED | NOT TESTED | NOT TESTED |
| Practice exam printing | NOT TESTED | PASS | PASS | NOT TESTED |
| Class join with code and PIN, offline sync, help requests reaching the teacher | Tested by the round-4 reviewer on the build before round 4 (PASS); not repeated after round 4 | | | |

## Accessibility and input

| Check | Result |
|---|---|
| axe-core WCAG 2.1 A/AA, 15 screens on C and L (30 scans; a one-off script in that round, see "The standing axe suite" for the suite that runs now) | PASS, 0 violations (was 1: math-only choices without a name, fixed) |
| Keyboard: Tab through 7 screens on L, focus ring on every control | PASS (text inputs had a border-only focus state, fixed) |
| Keyboard in an exercise: digits, Enter to check and continue; choices with arrows, number keys, one tab stop (D-022, R-22) | PASS (Playwright and retest, L) |
| App keypad: minus, decimal point, fraction, next field, delete; the phone keyboard stays closed | PASS (Playwright, S C T L) |
| Reduced motion | All runs used `prefers-reduced-motion: reduce`; the reviewer confirmed no running animations under it |
| Screen reader with real assistive technology (VoiceOver, TalkBack) | NOT TESTED |

## Automated test results (final run, final build)

| Suite | Result |
|---|---|
| Web unit tests (vitest) | 80 passed |
| Worker unit tests | 5 passed |
| Playwright (`npm run test:e2e`) | 160 passed, 0 failed, 32 skipped by design (journeys on C and L only, screenshots on S C L, keyboard test on L) |
| Visual regression | 39 baselines; the 11 that changed in round 4 (and the profile in round 3) were reviewed before being accepted |
| Exercise audit | 378 measurements, 0 failures |
| Screen audit | 171 checks (19 screens × 9 sizes, both builds): 125 PASS, 46 FIXED AND RETESTED, 0 FAIL, 0 tap targets under 32 px |
| Review retest scripts | 47 checks, all passing |
| AI failure states | 8 of 8 |
| axe-core (the round's one-off script) | 30 scans, 0 violations |
| Keyboard focus walk | 7 screens, every control shows a ring |

## The standing axe suite (PKG-1)

Added 11 November 2026, with the package the owner approved: `@axe-core/playwright` 4.10.2, which brings axe-core
4.10.3. Unlike the round's one-off 30 scans above, it is a file in the repo that runs with every Playwright run of the
`phone` project, and CI runs it again on `phone-dark`.

| What | How |
|---|---|
| The check | `web/e2e/axe.js` `expectNoAxeViolations(page)`: axe on the whole page, tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` (WCAG 2.0 and 2.1, levels A and AA). A failure lists each rule, its impact, its help text and every element it hit |
| The screens | `web/e2e/a11y.spec.js`: every route of the site and its main states, one test per screen or flow (the student, the tutor and the exams, the parents' area, the legal and landing pages, every teacher screen and the demo), on C (390×844) |
| The sheets | every kind of sheet in at least one state: each of the 37 files under `web/src` that renders its own `<Sheet>`, and `ConfirmSheet` (one shared component in `Screen.jsx`, used 18 times, scanned in two of its uses: stopping the backup, the bind question). The section "the remaining sheets" adds those the first pass left out (the answer-report sheet, PhotoWarn before the picker, the generate sheet, MyHelp and the reply notice, BackupNudge, PersistInfoSheet and InstallSheet on an iPhone, the delete-account and licence-cancel sheets, the licence quote, the class-AI change, the new teacher key, the bind sheet and its question, the email's other classes, AssignSheet's "לספר לכיתה?", DemoAsk). `e2e/trust.spec.js` › "axe: every screen" fails if one of these scans goes. Not scanned on its own: the lesson's "בואו נראה את זה אחרת" sheet, which holds RemedyFlow (scanned as the repair screen); `PageScene`'s `<Sheet check={false}>` is a drawing of a paper sheet, not a dialog; and the store build's AIConsentSheet belongs to the iPhone store build, which this suite does not build |
| The themes | light (`phone`) and dark (`phone-dark`) |
| Left out, turned off | nothing: `NOT_JUDGED` in `axe.js` is empty (KaTeX's MathML twin is judged correctly and stays in), no test passes `exclude` or `disableRules`, and `color-contrast` cannot be turned off at all |
| Proof the check can fail | `web/e2e/axe-self.spec.js`: a button with no name and text under 4.5:1 each fail, with the rule named |
| Not judged by axe | control edges at 3:1 (WCAG 1.4.11: `e2e/contrast.js`), keyboard reach with a visible ring and the 320 px width (`e2e/trust.spec.js` › "accessibility statement"), and a real screen reader (VoiceOver, TalkBack: the owner's pass, NOT TESTED) |
| Run it | `cd madregot/web && npx playwright test -c e2e/playwright.config.js --project=phone --project=phone-dark e2e/a11y.spec.js` |

**Result, 11 November 2026:** 105 tests on `phone` and the same 105 on `phone-dark`, every one passed: no WCAG 2.0 or
2.1 A/AA violation on any screen, in either theme. The 5 tests of `axe-self.spec.js` passed. Adding the notebook page
to the suite found one real defect (`scrollable-region-focusable`: the question squeezed into a clipped strip when the
notebook opens), fixed in `app.css` before this run.

**Result after the merge into the main branch, 12 November 2026:** the units the main branch merged after the lane
started got scans of their own (the last section of `a11y.spec.js`: the functions unit's teaching step by step with the
graph object and the situation graph, the graph object in practice, the protractor and clock figures and the protractor
object in both modes, the data and probability units' teaching with the simulate and chart objects and the chart,
outcomes and pair figures, both objects in practice, and the guest rule: the banner's reason line, Topics' guest stairs
and Rescue's functions row). 134 tests on `phone` and the same 134 on `phone-dark`, every one passed, and the 5 of
`axe-self.spec.js`. The new scans found one real defect: a struck-through row of a figure's table (stats:7) at 4.46:1
(`.fg-table tr.cross td` on `--ink-3`, a token for icons), fixed in `styles/lazy/figure.css` (`--ink-2`) before this
run. The protractor has no stair yet (angles:8 comes after the classroom lane), so its scan reaches it through a class
exam's fixed questions; when angles:8 lands it is scanned on its own stair.

**Result after the classroom lane's merge, 15 November 2026:** the lane's stairs and states got scans of their own (the
section "the classroom lane" of `a11y.spec.js`): the teaching of signed:1, 2, 3, 5 and 7 and of angles:1, 3, 6 and 7
step by step, with the angle tool's whole angle (as it opens, answered, and checked while the ray is not yet the
bisector); the lane's questions, each as it opens and with its solution shown as the class writes it (the bisector and
the worksheet's yes-or-no question, the quadrilateral, three angles on a line, the fan, three lines, a bisector at a
crossing, the split triangle, a triangle between parallel lines, a power, a chain of five bracketed numbers, the
regrouped line, absolute values, dividing with 0 and 1, brackets inside brackets, collecting and the families in
order, an equation's lines with the slash marks, the rectangle, the transfer table, angles with x); the worked examples
(every step shown) and solving together (a wrong move, then the last step typed) of eq:1, eq:5, signed:7, angles:6 and
angles:7; and the constant-first note on expr:3. Every teaching walk is its own test now and waits until the step on
screen is the step it reads: after a second `open()` in one page the faked clock runs ahead of the page's animation
timeline, so the steps of a second walk left the screen seconds late and a scan could read the step before. 180 tests
on `phone` and the same 180 on `phone-dark`, every one passed, and the 5 of `axe-self.spec.js`. The new scans found
two real defects, both `scrollable-region-focusable`, fixed before this run: signed:5's rule wrote its two identities
side by side, wider than a phone at the smallest size a display is set to (now one a line), and a question's
expression was squeezed into a strip that scrolled inside itself when the feedback panel opened under long choices
(`.lesson .q-stage > .qdisplay` keeps its height in `app.css`; the middle region scrolls). The worked examples and
solving together had no heading: `Teach.jsx` gives both the stage's name as the screen's heading, read by a screen
reader.

## The parents' progress report (PARENTS-1 to PARENTS-10)

Added 11 November 2026 on the family lane. Each PASS below is a check that ran on this build: `e2e/report.spec.js` on
S (320×568) and C (390×844), the Worker's `test/report.test.js` and `test/week.test.js`, the web's unit tests, and the
`parents-report` and `report-week` visual baselines on S, C and L. Screenshots of every state are in
`qa-evidence/parent-report/` (C, and `-phone-small` for S). Real phones, real WhatsApp, real mail programs and a real
Resend send: NOT TESTED (owner steps, `SUBSCRIPTION.md`, "דוח להורים").

| Flow or state | Check | S | C | L |
|---|---|---|---|---|
| 1. The child's weekly summary: tiles, mastered, repairs, Shabbat as rest; the share sheet; the `wa.me` text with `#/r/1.`; unticking repairs drops `fx`; at most 4,096 characters; no request reaches the API host and no request carries the payload | `report.spec.js` › flow 1 | PASS | PASS | NOT TESTED |
| 2. The parent opens the link on another phone: the same numbers, no `/api/` request, every request same-origin; a cut link says so | `report.spec.js` › flow 2 | PASS | PASS | NOT TESTED |
| 3. A linked device: the notice before anything is sent, nothing before "הבנתי", then one post with `X-Family-Device` only; the Me chip; the sheet lists the day; stop and delete posts `{on:false, forget:true}`; a new profile is told again | `report.spec.js` › flow 3, and the two notice tests | PASS | PASS | NOT TESTED |
| 4. `/parents`: each device's week and last week, 8 weeks with an 8-row table, the parent's switch, deleting history, the feedback question once, the unlink sentence, the checkout line, the Sunday email switch (`role="switch"`, posts `{on}`, toasts) | `report.spec.js` › flow 4 (four tests) | PASS | PASS | Visual baseline PASS |
| 4. The first day: signed out (About and the free summary), a plan with no device, linked with nothing yet (with the example), nothing this week, a consent-only device (6b) | `report.spec.js` › flow 4, the first day | PASS | PASS | NOT TESTED |
| 5. A class student's numbers say the teacher sees every answer | `report.spec.js` › flow 5 | PASS | PASS | NOT TESTED |
| States 8 and 9: an empty week on the child's summary; a broken link | `report.spec.js` › state 8, flow 2 | PASS | PASS | NOT TESTED |
| The Sunday email: queued only Sunday 07:00-20:00 in Jerusalem, once a week; sent after the other notices in Resend batches of 50, 100 a run in at most 3 SELECTs; no mistake names, no price; RFC 8058 headers; two empty weeks in a row not sent; opted out, unlinked or plan ended between queue and send not sent; the report off sends nothing | Worker `test/report.test.js` W1-W10 | n/a | n/a | n/a |
| The unsubscribe link: the GET page changes nothing; multipart, urlencoded and empty POSTs stop it; never a 3xx; a bad token is 400; CSP and no-store; 200 a day per network | Worker `test/report.test.js` W7; pages in `qa-evidence/parent-report/unsubscribe-*.png` | PASS (screenshot) | PASS (screenshot) | n/a |
| The rendered email at a phone width | `node scripts/preview-weekly.mjs`, then `weekly-email.png` and `weekly-email-empty.png` | PASS (no sideways scroll) | PASS (no sideways scroll) | n/a |
| The words: `/privacy` has the family device's section, the 90 days, the Sunday email and the family exception; `/parents` says what is kept in one merged text, with the 90 days and the progress copy, never "only the email" | `report.spec.js` › the words (PARENTS-9); `src/screens/parents/reportCopy.test.js`; Worker `test/notice.test.js` | PASS | PASS | NOT TESTED |
| What the plan gives (PRODUCT2-30): the About card's heading is the family plan; its list leads with the report that comes by itself every day, then the Sunday email, the exam ahead and the helper, in the words of `content/familyPlan.js`, which are also checked claims; the free summary says it is this week only, sent by the child when they choose; the price lines unchanged | `report.spec.js` › flow 4, the first day; `subscription.spec.js` › a parent on their own phone; `reportCopy.test.js`; `claims.test.js` | PASS | PASS | NOT TESTED |
| The exam ahead (PRODUCT2-30): within 7 days, a "לקראת המבחן" card above the devices on `/parents` (today, tomorrow or the date, and how far the exam's stairs are) and a line in the Sunday email, also on a quiet week; none for a passed exam or with no plan | `report.spec.js` › flow 4; `WeeksChart.test.jsx` › the exam ahead; Worker `test/report.test.js` W11 | PASS | PASS | NOT TESTED |
| Sharing paused on the child's device: a calm card with since when, that it is the child's choice and no reason is sent, and what the parent can do (talk, and only the device turns it on, from "שיתוף עם ההורים"); the parent's own switch says their side is on | `report.spec.js` › flow 4, sharing paused; `reportCopy.test.js`; `WeeksChart.test.jsx` | PASS | PASS | NOT TESTED |
| A copy with no server (PRODUCT2-33): `/parents` lists what the family plan includes from the same source, says nothing can be bought here and every lesson is free; no price, no checkout; `/parents/info` and `/cancel` say the same | `subscription.spec.js` › a copy without a server | PASS | PASS | NOT TESTED |
| `/mivchan/` (SK-BUYERS-3, PRODUCT2-30): each grade's coverage in its own sentence from `store/counts.json`, never one share of both grades; the plan card lists the four claims above the unchanged price line | `landing.spec.js` › /mivchan/; `claims.test.js`; `scripts/landing-build.test.mjs` | PASS | PASS | NOT TESTED |

**Commands for a judge** (in `madregot/`; nothing here deploys, sends an email or calls a paid service):

```bash
cd web && npx vitest run && npx tsc -p tsconfig.json
cd web && npx playwright test -c e2e/playwright.config.js --project=phone --project=phone-small e2e/report.spec.js
cd web && npx playwright test -c e2e/playwright.config.js --project=phone --project=phone-small --project=desktop e2e/visual.spec.js -g "report"
cd worker && node --test test/*.test.js
cd worker && node scripts/preview-weekly.mjs    # writes qa-evidence/parent-report/weekly-email.html and .txt, no network
```

Add `REPORT_SHOTS=<folder>` before the `report.spec.js` run to save its screenshots; `E2E_PORT=<port>` when another copy
of the suite is running.

## ח׳ geometry: transformations, congruent triangles, isosceles triangles and similarity (curriculum stage 4)

Added 12 November 2026 on the stage-4 lane. The 13 stairs of `transf`, `congr` and `sim` were looked at on S (320×568)
and C (390×844): for each stair its first discover step and one practice exercise (the lesson's first, seed 424242), 52
pictures. `e2e/geometry.spec.js` takes them (`GEOM_SHOTS=<folder>`, named `<topic><level>-discover1-<width>.png` and
`<topic><level>-practice-<width>.png`) and checks on both phones what a picture cannot prove by itself: the step has its
drawing or its object, inside the screen; its button, the practice question, its answer and the check button are on
screen and not covered; nothing scrolls sideways; no script error. Real phones and screen readers: NOT TESTED.

What the look found, and what changed:
- **Labels on top of each other in the congruence drawings.** In about four congr:1 and congr:2 practice drawings in five
  (the x form), the two numbered angles of a flat triangle sat on each other (45° on 100°) and the angle written
  (3x − 15)° ran across the triangle's sides; congr:4's median length sat on the neighbouring side. Every geo drawing now
  lays its words out with `components/geoLayout.js`: a label that would sit on another label or a letter, across a line,
  past a neighbouring line or outside the box takes the first free place of a few (further along its bisector or its
  side, its side's other face, just outside its vertex). A drawing with no clash is laid out exactly as before. The
  congruence pairs get a taller box when a label is an expression, and more room between the two triangles when a side
  carries one. Numbers on geo drawings have a halo, as letters have.
- **"1x + 2".** sim:1 wrote a coefficient of 1; it writes `x + 2` now, in the question and on the drawing.
- **Needle triangles.** sim:1 could draw a base of 1 under legs of 31 (its letters B and C on each other); its base is
  now between half a leg and 1.6 legs. congr:1's "AB = 4x − 1" pair could have a side of 2 under sides of 17 and 18; its
  shortest side is now at least a third of the longest, and the gap between the two triangles is as wide as the
  expression at the drawing's scale.
- **An axis number under a letter.** transf:1's practice read "−4A" where A's letter fell on the axis number; a shape's
  letter now hides the number under it (the grid line still shows the place).
- **transf:c1 at 320 px.** The 320 px walk of every challenge had left out the transformations; with them in, two chains
  of maths were wider than the reason box. Each is two short pieces now.

The stage's review then reproduced these, and each has a test that failed before its fix:
- **The transform object under the bar.** congr:2's step 5 (4 lines of question) at 320 × 568 and 360 × 640, and three
  steps at 375 × 667, had buttons under בדיקה's bar. The plane now takes the room the question leaves (Transform.jsx
  measures it, at least 200 px); the question of congr:2's step 5 is two lines; the vertex chips stay on screen, or, only
  where they would take the plane under 220 px, leave the screen but not the live region. `manip.spec.js` walks every
  teaching step and repair with the object at 320 × 568, 360 × 640 and 375 × 667.
- **C on O.** The transform object's letters (target, original, copy, shown answer, O) go through a clash check
  (`components/manip/tfLayout.js`); `figures.test.ts` checks every teaching and repair object and 200 draws of each
  practice kind.
- **∢A = ∢P three in a row.** A choice that states a relation, or whose drawn signs make it wider than three
  characters, goes in the list (`lib/lesson.js` inlineChoices); `geometry.spec.js` opens a cg2n item on both phones.
- **Solving together at 320 × 568.** transf:1-3's plane shrinks on a short screen, so the first choice shows above the
  bar (`geometry.spec.js`).
- **A printed number as the answer.** "AB = 5x − 6 … x = 6": the printed numbers are compared without their sign too
  (`content/util.test.js`, 1,500 draws of every geometry stair).
- **Axes of symmetry.** transf:2 asks about "מלבן שאינו ריבוע", "משולש שווה־שוקיים שאינו שווה־צלעות" and the like, so
  every shape has one count.

| Stair | First discover step | Practice exercise looked at | Tests that hold it (beyond the ones every stair has) |
|---|---|---|---|
| transf:1 הזזה | a triangle slid 5 right and 2 down, dashed arrows from each vertex | B′ after a slide of 3 right, 2 up (a point answer) | `manip.spec.js` the transform object (a slide); `learn.spec.js` transf:1 at 320; `layout.spec.js` the transform controls |
| transf:2 שיקוף | a triangle and its mirror image in the y-axis | A(−2, 3) reflected in the y-axis | `manip.spec.js` the transform object (a flip in an axis, in x = k) |
| transf:3 סיבוב | a triangle turned about O, the turn's arc | A(−3, 2) turned 180° about O | `manip.spec.js` the transform object (a turn) |
| transf:4 צורות חופפות וריצוף | a triangle moved onto its copy, dashed arrows | the perimeter of a right trapezoid glued to its mirror image | `learn.spec.js` transf:4 check drawing at 320; `challenge.spec.js` transf:c1–c3 at 320 |
| congr:1 צלעות וזוויות מתאימות | two congruent triangles, matching ticks and arcs | the x form, △ABC ≅ △QRP with ∢A = (3x − 15)° | `manip.spec.js` the transform object at its busiest (step 5, 320) |
| congr:2 משפטי החפיפה | sides 4 and 6 with 40° between them, the third side dashed | the x form with the equal sides ticked | `challenge.spec.js` congr:c2 from the keyboard |
| congr:3 הוכחה בחפיפה | two segments crossing at M, AM = MB, CM = MD (נתון and צ״ל only) | ∢ACB in an isosceles triangle from its altitude | `manip.spec.js` the proof object (order by buttons, reason by keyboard) |
| congr:4 תיכון ושטחים | the median AD with its two ticked halves | the area of △ABD from the median and the height | |
| congr:5 צלעות במשולש | three segments 3, 4 and 8 that do not meet | how many whole third sides with 14 and 9 | |
| sim:1 שווה־שוקיים ומשפטים הפוכים | the isosceles triangle: legs, base, apex angle | AB from ∢B = ∢C and three expressions | `challenge.spec.js` sim:c1–c3 at 320 |
| sim:2 צורות דומות | triangles 3-4-5 and 6-8-10 | the width of a similar rectangle | |
| sim:3 דמיון משולשים (ז.ז) | two triangles of different size with two equal angles | BC from DE ∥ BC | |
| sim:4 יחס צלעות ויחס שטחים | a 1 by 1 square inside a 3 by 3 one | the area of a similar triangle from AB = 4, DE = 8 | |

Every stair is also held by: `learn/content.test.ts` (the maths of every step), `checks.test.ts` (mastery, review and
verification checks), `guessing.test.ts` (no check passed by guessing, every one under 2%), `content/labels.test.js`
(every mistake label describes the answer), `figures.test.ts` (every drawn number and letter, and since this round no
label on another, crossed by a line or cut off, over 300 practice draws of each stair and every teaching and challenge
drawing), `visuals.test.ts` (every discover step has a drawing or an object), `programme.test.ts` and the Worker's
`coverage.test.js` (7.11, 8.5, 8.12 and 8.13 taught), `engines.test.ts`, `challenges.test.ts`, the tutor's evaluation
rows (`worker/eval/case-specs.json`, one per named mistake of the three topics), `e2e/teach-all.spec.js` on C (the
stair's teaching end to end), `e2e/geometry.spec.js` on S and C, and `e2e/programme.spec.js` and `e2e/learn.spec.js` (the
four units read יש on /programme; the new units and their emblems on both maps) on S and C.

**Commands** (in `madregot/web`; `E2E_PORT=<port>` when another copy of the suite is running):

```bash
npx vitest run src/learn/figures.test.ts src/learn/content.test.ts src/learn/checks.test.ts src/learn/guessing.test.ts src/content/labels.test.js
GEOM_SHOTS=<folder> npx playwright test -c e2e/playwright.config.js --project=phone --project=phone-small e2e/geometry.spec.js
npx playwright test -c e2e/playwright.config.js --project=phone --project=phone-small e2e/programme.spec.js e2e/learn.spec.js e2e/challenge.spec.js e2e/manip.spec.js e2e/layout.spec.js
```
