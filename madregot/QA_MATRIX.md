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
  (7 screens).

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
| axe-core WCAG 2.1 A/AA, 15 screens on C and L (30 scans) | PASS, 0 violations (was 1: math-only choices without a name, fixed) |
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
| axe-core | 30 scans, 0 violations |
| Keyboard focus walk | 7 screens, every control shows a ring |
