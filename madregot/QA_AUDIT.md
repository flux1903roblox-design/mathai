# Madregot QA audit: defect register

What was checked, what was wrong, why, how it was fixed and how the fix was proven.
The device matrix and the screen-by-screen results are in [QA_MATRIX.md](QA_MATRIX.md).

## How the testing was done

- **Browser:** Playwright 1.63 with Chromium (desktop engine with mobile emulation: touch, `isMobile`, Hebrew locale).
  **Not tested on a real iPhone or in iOS Safari.** WebKit was not run either. Safe-area insets, the iOS
  keyboard, rubber-band scrolling and `100dvh` behaviour in Safari are covered by the code (`env(safe-area-inset-*)`,
  `100dvh`, the app's own keypad with `inputmode="none"`) but not verified on the device.
- **The iPhone screenshot mentioned in the brief was not attached to the conversation** that did this work, so the
  audit started from a fresh measurement of the exercise screen on nine viewports instead.
- **Builds:** the full app (Worker + D1 + a local stand-in for the Claude API) and the no-server build that the
  GitHub Pages site serves (`VITE_API_URL=none`). Exercises were made repeatable with a seeded `Math.random`
  (`localStorage['madregot-seed']`) and a fixed clock.
- **Tools** (all run, results below):
  - `npm test` (vitest): 74 unit tests.
  - `npm run test:e2e` (Playwright, in the repo under `web/e2e/`): exercise layout for 14 exercise kinds on
    4 devices, the app keypad, 6 user journeys on phone and desktop, 11 screens on 4 devices, and 39 visual
    regression screenshots (13 screens on 2 phones and desktop).
  - Audit scripts (session scratchpad, not committed): exercise layout measured on 9 viewports × 14 exercises ×
    3 states (load, wrong answer, revealed answer) = 378 measurements per round; a screen audit of 19 screens ×
    4 viewports (sideways scroll, controls under the tab bar, tap targets under 32 px, broken images,
    clipped text, console errors); AI error states with the AI endpoints forced to fail.
- **Evidence** lives in `qa-evidence/` (before/after sheets) and `web/e2e/__screens__/` (approved visual baselines).

## Severity scale

| Level | Meaning |
|---|---|
| P0 | A student cannot finish an exercise or loses data. |
| P1 | A core task is blocked or misleading on some devices, or a broken promise in the UI. |
| P2 | Works, but confusing, wrong-looking or inconsistent. |
| P3 | Polish. |

## Summary

| Status | Count |
|---|---|
| VERIFIED (fixed, retested by an automated check and by looking at the screenshots) | 23 |
| ACCEPTED (known limitation, documented below) | 2 |
| OPEN | 0 |

Measured before and after on the exercise screen (378 measurements per round):

| Round | Load state failures | After a wrong answer | Answer revealed |
|---|---|---|---|
| Baseline (before) | 37 / 126 | 21 / 126 | 39 / 125 |
| Iteration 4 (after) | 0 / 126 | 0 / 126 | 2 / 126 → fixed by D-021 |

Screen audit: round 1 found 14 problems in 76 checks; round 2: 0 problems, 0 tap targets under 32 px.

---

## Exercise screen

### D-001 · P0 · The question scrolls away while answering
- **Screen / viewport:** lesson, every exercise with a drawing or a table · 320×568, 360×640, 375×667 (also 390×844 and 393×852 for the grid, area and graph exercises).
- **Steps:** open a coordinate, graph or table exercise on a small phone; tap the answer field.
- **Expected:** the question, the maths and the answer field are visible together, above the keypad.
- **Actual:** the page scrolled so the answer field was above the keypad; the question went off the top. 37 of 126 load-state measurements failed (13 of 14 exercises at 320×568).
- **Root cause:** the lesson was one scrolling column with a fixed keypad dock laid over it, and the dock's height was measured in JavaScript and added as bottom padding. Everything competed for one scroll position.
- **Fix:** the exercise screen is now three grid regions in `100dvh` (`grid-template-rows: auto minmax(0,1fr) auto`, `min-height: 0`): a top region (progress, close, question bubble with מדי), a middle region that is the only thing that scrolls (drawing, table, choices), and a bottom region (answer field, keypad, tools, check). The answer field moved out of the scrolling region into the bottom region, directly above the keypad. On very short screens (`max-height: 620px`) the question moves into the scrolling region so the maths keeps room (`Lesson.jsx` `useMedia`). Files: `screens/Lesson.jsx`, `styles/app.css` (exercise v4 block).
- **Tests:** `e2e/layout.spec.js` (14 exercise kinds × 4 devices: question usable, answer usable, check usable, page never scrolls, maths region ≥ 120 px, wrong answer, right answer, next exercise); exercise audit iteration 4: 0 failures at load.
- **Evidence:** `qa-evidence/D-001-*.jpg` (before / after / after a wrong answer at 320×568 and 375×667).
- **Status:** VERIFIED

### D-002 · P1 · The keypad took more than half the phone
- **Viewport:** 320×568 (64 %), 360×640 (57 %), 375×667 (54 %).
- **Expected:** the bottom region leaves room for the maths. **Actual:** keys were fixed 56 px tall.
- **Root cause:** key height did not scale with the viewport.
- **Fix:** `.lesson .key { height: clamp(40px, 6.3dvh, 52px) }`, tools as compact icon+label buttons in one row with the check button. Bottom region is now 13–48 % at 320×568 and 9–38 % at 390×844.
- **Tests:** exercise audit (`bottomShare`), keypad check (keys 83×42 px at 375×667, all ≥ 40 px tall).
- **Status:** VERIFIED

### D-003 · P1 · Two-field answers wrapped onto two lines at 320 px
- **Screen:** point `A( x , y )` and line `y = m x + b` exercises · 320×568.
- **Root cause:** fixed 104 px answer slots.
- **Fix:** slots `clamp(62px, 22vw, 104px)`; the answer row never wraps.
- **Tests:** `layout.spec.js` "a point on a grid", "a line equation (two fields)".
- **Status:** VERIFIED

### D-004 · P1 · An answer slot could be under the keypad and not tappable
- **Root cause:** same as D-001 (fixed dock over a scrolling column).
- **Fix:** D-001. **Tests:** `expectUsable` (inside the viewport and not covered at its centre) on every answer field before and after a mistake.
- **Status:** VERIFIED

### D-005 · P1 · Regression: the lesson top bar became transparent
- **Found by:** the first post-fix screenshot review (iteration 1).
- **Actual:** the progress bar floated over scrolling content.
- **Root cause:** the old sticky header background was tied to a class removed with the old layout.
- **Fix:** the top region has its own background and bottom rule (`.lesson-head`).
- **Status:** VERIFIED (visual baselines `exercise-*.png`)

### D-006 · P2 · Statistics answers shown as fractions ("27/5" instead of 5.4)
- **Screen:** feedback panel, revealed answer, statistics topic.
- **Root cause:** `answerText` always formatted with `plainNum`, which prefers fractions.
- **Fix:** `plainNum(x, { decimal: true })` for statistics (`content/util.js`, `content/index.js`).
- **Tests:** unit tests in `content` suite; audit screenshots of `stats-2-median` and `stats-4-table` reveal state.
- **Status:** VERIFIED

### D-007 · P2 · Lists of numbers read in the wrong order in RTL
- **Screen:** statistics and Pythagoras questions with data lists; coordinate questions with several points.
- **Actual:** in a right-to-left paragraph, a comma-separated list of numbers can be reordered by the bidi algorithm.
- **Fix:** lists are wrapped in a left-to-right isolate (`⁦ … ⁩`) and each number is its own math run (`content/grade8.js listMath`, `content/grade7.js`); the isolate marks are stripped for the AI text (`itemPlain`).
- **Status:** VERIFIED (screenshot review at 320 and 390)

### D-008 · P3 → fixed · Unit test failed on Sundays
- **Root cause:** a streak-freeze test depended on the real day of the week (Shabbat rule).
- **Fix:** the test fixes the clock (`vi.setSystemTime`). **Status:** VERIFIED

### D-014 · P1 · Regression: מדי dropped to its own row above the question
- **Found by:** iteration 3 screenshot review at 768×1024 and 1440×900.
- **Root cause:** a class-name collision: the lesson used `.q-head`, which the exam result screen also styles with `flex-wrap: wrap`; a later `flex: 0 1 auto` on the bubble exposed it.
- **Fix:** the lesson class is now `.lesson-q`; `.q-head` belongs to the exam result only.
- **Tests:** visual baselines `exercise-*` on desktop; exercise audit iteration 4.
- **Status:** VERIFIED

### D-021 · P2 · After a revealed answer, the right choice could sit below the fold
- **Screen / viewport:** multiple choice, answer revealed · 320×568, 360×640.
- **Actual:** the feedback panel shrinks the maths region; the highlighted right choice was below its fold (2 of 126 measurements).
- **Fix:** when the right choice is marked, it is scrolled into view inside the maths region (`Lesson.jsx`, effect on `marked`).
- **Tests:** `layout.spec.js` multiple choice; `flows.spec.js` whole lesson.
- **Status:** VERIFIED

### D-022 · P3 · Keyboard users had no way to type on desktop without clicking a field
- **Fix:** digits, `.`, `-`, `/` and Backspace typed anywhere on the exercise go to the active field; Enter checks / continues.
- **Status:** VERIFIED (manual run with Playwright keyboard)

## AI assistant

### D-009 · P1 · The assistant without a connection still offered actions that fail
- **Reported by:** the brief ("disconnected screen allowed generation").
- **Steps:** open the AI tab in the no-server build (the public site).
- **Expected:** a clear statement that the assistant is not connected, and a way on.
- **Actual:** the tabs, the chat box and "כתיבת תרגילים" were shown; pressing them produced an error.
- **Root cause:** the screen rendered the tools regardless of `aiReady()`.
- **Fix:** `AiOffline` replaces the tabs when the assistant is not ready: מדי, what the assistant can do, "להמשיך לתרגל" and "איך מחברים את העוזר" (goes to the AI settings on the profile and focuses them).
- **Tests:** `flows.spec.js` "the AI tutor without a connection…"; visual `assistant-offline`.
- **Evidence:** `qa-evidence/D-008-offline-assistant.jpg`
- **Status:** VERIFIED

### D-010 · P1 · AI errors appeared under the bottom tab bar
- **Reported by:** the brief.
- **Root cause:** results and errors were appended at the end of the page with no scroll, and nothing kept them clear of the fixed tab bar.
- **Fix:** each result and error has a `.reveal-anchor` that scrolls into view (`useReveal`), and `html { scroll-padding-bottom }` keeps it above the tab bar and the safe area.
- **Tests:** the AI endpoints forced to fail (HTTP 503) on the full build: chat, exercise writing, photo check and the in-lesson tutor, at 320×568 and 390×844: every error fully visible above the tab bar; in a lesson the error shows in the feedback panel and the button stays on screen (8/8 checks passed).
- **Evidence:** `qa-evidence/D-009-320x568-ai-errors.jpg`
- **Status:** VERIFIED

### D-019 · P2 · Server failures showed a vague "משהו השתבש"
- **Root cause:** the codes `upstream`, `server_error` and `not_found` returned by the Worker had no message.
- **Fix:** plain messages that say what happened and what to do (`lib/api.js`).
- **Status:** VERIFIED

### D-020 · P3 · Chat messages had no visual owner
- **Fix:** מדי avatar next to the assistant's messages, thinking state while waiting (`components/AIChat.jsx`).
- **Status:** VERIFIED

## Learn screen, map, quests

### D-011 · P1 · The "back to my stair" button covered the tab bar
- **Viewport:** 320×568, 390×844, 768×1024 (round 1 of the screen audit: "חזרה לשלב הבא" under the tab bar).
- **Root cause (two):** the `.jump-current` rule had been deleted by mistake in an earlier commit, so the button lost its fixed position; and the screen transition animated `transform`, which makes `position: fixed` children relative to the moving screen.
- **Fix:** rule restored (with a wide-screen variant); the screen transition animates opacity only (`Shell.jsx`).
- **Tests:** `screens.spec.js` "nothing under the tab bar" on 4 devices; screen audit round 2.
- **Evidence:** `qa-evidence/D-010-320x568-learn.jpg`
- **Status:** VERIFIED

### D-012 · P2 · Home screen hierarchy: no clear "continue", the board pushed the map down
- **Fix:** order is now: Continue card (next stair, unit, progress, play button, "N things to strengthen") → map → level board below the map. The placement result scrolls to the board once.
- **Tests:** `flows.spec.js` first visit (the map is right under the continue card); visual `learn`.
- **Status:** VERIFIED

### D-013 · P2 · The continue card rendered unstyled; the quests chest bubble was too narrow; the grade switch label wrapped
- **Root cause:** new markup without its CSS block; a `max-width` on the bubble; no `white-space: nowrap`.
- **Fix:** CSS for `.continue`, `.quest-say`, `.grade-switch`.
- **Status:** VERIFIED (visual `learn`, `quests`)

### D-016 · P2 · Quests looked like a to-do list
- **Fix:** mission tiles with an icon, an animated progress bar and a tick; a chest (Lottie, first frame / last frame when all are done) with מדי and a line about the reward.
- **Status:** VERIFIED (visual `quests` on 3 devices)

## Teacher, profile

### D-015 · P1 · The teacher entry on the public site led to a dead end
- **Reported by:** the brief ("teacher not just README").
- **Actual:** text pointing to the README.
- **Fix:** a teacher screen for the no-server build: what the teacher dashboard does (4 features), the 3 steps to turn it on, and a way back.
- **Tests:** `flows.spec.js` "the teacher view without a server…".
- **Evidence:** `qa-evidence/D-015-teacher-noserver.jpg`
- **Status:** VERIFIED

### D-017 · P2 · The profile offered a class-join form that cannot work without a server
- **Found by:** reviewing the regenerated visual baseline of the profile on desktop.
- **Fix:** without a server, the section explains that progress stays on this device and how to join a class from the class address.
- **Status:** VERIFIED (visual `profile` desktop, reviewed)

### D-018 · P2 · The AI settings said "works through the app's server" when there is no server
- **Found by:** the same review.
- **Fix:** without a server the text says so and points to the advanced setting (class server address) or a personal key; "בדיקת חיבור" is only offered when there is a server.
- **Status:** VERIFIED (visual `profile` desktop, reviewed)

## Test-suite defects found and fixed

| ID | Problem | Fix |
|---|---|---|
| T-1 | Visual baselines captured the "טוענים…" placeholder | each shot waits for a ready selector and for the placeholder to be gone; regenerated, stable on 2 runs |
| T-2 | The multiple-choice layout check did not fit the desktop side column | each choice is scrolled into view and checked separately |
| T-3 | End-screen loop raced the screen change | waits for the heading to change |
| T-4 | Placement journey failed once in 3 full runs under load | the next answer could go to the previous exercise; `proceedToNext` waits for the exercise to change. 12/12 and 144/144 repeated runs passed after |
| T-5 | The feedback panel can hold two buttons | selectors target `.fb-actions .btn` |

## Accepted limitations

| ID | What | Why it is accepted |
|---|---|---|
| A-1 | 320×568, "missing vertex" exercise: the drawing starts one short scroll below the long question | The question is in the scrolling region on short screens by design (D-001); the answer field, keypad and check stay in place. Scroll shadows show there is more. |
| A-2 | Not tested on a real iPhone / iOS Safari / WebKit | No device or WebKit run in this environment. Needs one pass on a real iPhone (Safari, home-screen app) before calling mobile done. |
