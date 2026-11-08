# Madregot QA matrix

Results of the final round, by screen and by device. Every PASS below comes from a check that ran on the
current code; nothing is marked PASS from memory. Defects referred to by ID are in [QA_AUDIT.md](QA_AUDIT.md).

**Legend:** PASS · FIXED AND RETESTED (a defect was found on this screen and size, fixed, and the check passed
again) · FAIL · BLOCKED · NOT TESTED

**Engine:** Chromium (Playwright 1.63) with mobile emulation. **Real iOS Safari, real Android Chrome and WebKit:
NOT TESTED** (see A-2 in the audit).

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

- **Exercise audit** (9 devices × 14 exercise kinds × 3 states = 378 measurements): the question, the maths and
  the answer field visible together; the answer not covered by the keypad and reachable; the check button and the
  feedback button on screen; the page itself never scrolls; nothing scrolls sideways.
- **Screen audit** (no-server build, 15 screens × 9 devices = 135): no sideways scroll, nothing pressable or any
  error under the tab bar, no tap target under 32 px, no broken image, no clipped text, no console error.
- **Full-build audit** (the AI screens and the exam check with the Worker): same checks.
- **Playwright suite** (`npm run test:e2e`): layout of 14 exercise kinds and the keypad on S, C, T, L; journeys on
  C and L; 11 screens on S, C, T, L; visual baselines on S, C, L.
- **axe-core** (WCAG 2.1 A/AA rules) on C and L; **keyboard focus** walk on L.

## Exercise screen (iteration 5, current code)

| Exercise kind | S | A | B | C | D | E | T | L | W |
|---|---|---|---|---|---|---|---|---|---|
| Signed number (one field) | FIXED AND RETESTED | FIXED AND RETESTED | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Multiple choice | FIXED AND RETESTED | FIXED AND RETESTED | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Long expression | FIXED AND RETESTED | FIXED AND RETESTED | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Point on a grid (two fields) | FIXED AND RETESTED | FIXED AND RETESTED | FIXED AND RETESTED | PASS | PASS | PASS | PASS | PASS | PASS |
| Area on a grid | FIXED AND RETESTED | FIXED AND RETESTED | FIXED AND RETESTED | FIXED AND RETESTED | FIXED AND RETESTED | PASS | PASS | PASS | PASS |
| Missing vertex | FIXED AND RETESTED (A-1) | FIXED AND RETESTED | FIXED AND RETESTED | FIXED AND RETESTED | FIXED AND RETESTED | PASS | PASS | PASS | PASS |
| Triangle drawing | FIXED AND RETESTED | FIXED AND RETESTED | FIXED AND RETESTED | PASS | PASS | PASS | PASS | PASS | PASS |
| Parallel lines | FIXED AND RETESTED | FIXED AND RETESTED | FIXED AND RETESTED | PASS | PASS | PASS | PASS | PASS | PASS |
| Table of values | FIXED AND RETESTED | FIXED AND RETESTED | FIXED AND RETESTED | PASS | PASS | PASS | PASS | PASS | PASS |
| Graph | FIXED AND RETESTED | FIXED AND RETESTED | FIXED AND RETESTED | FIXED AND RETESTED | FIXED AND RETESTED | PASS | PASS | PASS | PASS |
| Line equation (two fields) | FIXED AND RETESTED | FIXED AND RETESTED | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Word problem with a drawing | FIXED AND RETESTED | FIXED AND RETESTED | FIXED AND RETESTED | PASS | PASS | PASS | PASS | PASS | PASS |
| List of data | FIXED AND RETESTED | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Frequency table | FIXED AND RETESTED | FIXED AND RETESTED | FIXED AND RETESTED | PASS | PASS | PASS | PASS | PASS | PASS |

FIXED AND RETESTED marks the cells where any of the three states failed in the baseline measurement (D-001 to D-004) or in iteration 4 (D-021), and every state passes now. Generated from the audit data, not by hand.
A-1: at S the drawing of the missing-vertex exercise starts one short scroll below its long question (accepted).

Measured share of the screen taken by the bottom region (answer, keypad, tools, check), and the smallest maths
region: S 13–48 % / 186 px · A 11–42 % / 154 px · B 11–42 % / 174 px · C 9–38 % / 285 px · D 8–37 % / 293 px ·
E 8–34 % / 371 px · T 7–31 % / 484 px · L 8–36 % / 770 px · W 7–30 % / 950 px.

## Other screens

| Screen | S | A | B | C | D | E | T | L | W |
|---|---|---|---|---|---|---|---|---|---|
| Welcome | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Onboarding (questions) | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Onboarding, whole journey | NOT TESTED | NOT TESTED | NOT TESTED | PASS | NOT TESTED | NOT TESTED | NOT TESTED | PASS | NOT TESTED |
| Placement test → result → board | NOT TESTED | NOT TESTED | NOT TESTED | PASS | NOT TESTED | NOT TESTED | NOT TESTED | PASS | NOT TESTED |
| Teacher entry, no server | FIXED AND RETESTED | FIXED AND RETESTED | FIXED AND RETESTED | FIXED AND RETESTED | FIXED AND RETESTED | FIXED AND RETESTED | FIXED AND RETESTED | FIXED AND RETESTED | FIXED AND RETESTED |
| Learn, first day | FIXED AND RETESTED | PASS | PASS | FIXED AND RETESTED | PASS | PASS | FIXED AND RETESTED | PASS | PASS |
| Learn, with history | FIXED AND RETESTED | PASS | PASS | FIXED AND RETESTED | PASS | PASS | FIXED AND RETESTED | PASS | PASS |
| Whole lesson → end screens → map | NOT TESTED | NOT TESTED | NOT TESTED | PASS | NOT TESTED | NOT TESTED | NOT TESTED | PASS | NOT TESTED |
| Daily quests | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Exams | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| New practice exam | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Practice exam sheet (and print) | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Exam check, no server | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Improvement plan | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| AI assistant, not connected | FIXED AND RETESTED | FIXED AND RETESTED | FIXED AND RETESTED | FIXED AND RETESTED | FIXED AND RETESTED | FIXED AND RETESTED | FIXED AND RETESTED | FIXED AND RETESTED | FIXED AND RETESTED |
| Profile | FIXED AND RETESTED | FIXED AND RETESTED | FIXED AND RETESTED | FIXED AND RETESTED | FIXED AND RETESTED | FIXED AND RETESTED | FIXED AND RETESTED | FIXED AND RETESTED | FIXED AND RETESTED |
| Topics | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Topic guide | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |

Print: checked on C and L (the tab bar and the app frame are hidden in print media).

## Full build (with the Worker and the AI)

Measured in screen-audit round 2 on the full build as it was before round 3 (the round-3 changes do not touch
these screens' layout). The other five sizes were not run on the full build yet. Round 1 flagged "clipped text" on
the chat and exercise-writing screens; those were visually-hidden labels counted by the audit script itself
(script bug, fixed), not defects in the app.

| Screen | S | A | B | C | D | E | T | L | W |
|---|---|---|---|---|---|---|---|---|---|
| AI chat with an answer | PASS | NOT TESTED | NOT TESTED | PASS | NOT TESTED | NOT TESTED | PASS | PASS | NOT TESTED |
| AI exercise writing with results | PASS | NOT TESTED | NOT TESTED | PASS | NOT TESTED | NOT TESTED | PASS | PASS | NOT TESTED |
| AI photo check | PASS | NOT TESTED | NOT TESTED | PASS | NOT TESTED | NOT TESTED | PASS | PASS | NOT TESTED |
| Exam check with the server | PASS | NOT TESTED | NOT TESTED | PASS | NOT TESTED | NOT TESTED | PASS | PASS | NOT TESTED |
| AI failures (chat, writing, photo, tutor in a lesson) | FIXED AND RETESTED | NOT TESTED | NOT TESTED | FIXED AND RETESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED | NOT TESTED |
| Class join, teacher dashboard | NOT TESTED in this QA round (covered by the earlier legacy end-to-end scripts only) | | | | | | | | |

## Accessibility and input

| Check | Result |
|---|---|
| axe-core WCAG 2.1 A/AA, 15 screens on C and L (30 scans) | PASS (was 1 violation family: math-only choices without a name, fixed) |
| Keyboard: Tab through 7 screens on L, focus ring on every control | FIXED AND RETESTED (text inputs had a border-colour-only focus state) |
| Keyboard typing in an exercise (digits, Enter to check, Enter to continue) | PASS (Playwright, L) |
| App keypad (minus, decimal point, fraction, next field, delete; phone keyboard stays closed) | PASS (Playwright, S C T L) |
| Reduced motion | All runs used `prefers-reduced-motion: reduce`; the full-motion version was reviewed in screenshots only |
| Screen reader with a real assistive technology (VoiceOver, TalkBack) | NOT TESTED |
| Colour contrast | PASS within axe's automated rule (text on its background) |

## Automated test results (final run)

| Suite | Result |
|---|---|
| Unit tests (vitest) | 78 passed |
| Playwright (`npm run test:e2e`) | 156 passed, 0 failed, 28 skipped by design (journeys only on C and L, screenshots on S C L, keyboard test only on L) |
| Visual regression | 39 baselines, all match (the desktop profile baseline was updated after D-017/D-018 and reviewed) |
| Exercise audit | 378 measurements, 0 failures (A-1 noted) |
| Screen audit | 135 checks, 0 problems, 0 tap targets under 32 px |
| AI failure states | 8 of 8 checks passed (S and C) |
| axe-core | 30 scans, 0 violations |
