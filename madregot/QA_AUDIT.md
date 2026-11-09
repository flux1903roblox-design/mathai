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
  - `npm test` (vitest): 80 web unit tests; `npm test` in `worker/`: 5.
  - `npm run test:e2e` (Playwright, in the repo under `web/e2e/`): exercise layout for 14 exercise kinds on
    4 devices, the app keypad, keyboard typing, 8 user journeys on phone and desktop (including the back button and
    the plan quest), 11 screens on 4 devices, and 39 visual regression screenshots (13 screens on 2 phones and desktop).
  - An independent adversarial review (round 4), then scripts that repeat each of its findings (47 checks).
  - axe-core (WCAG 2.1 A/AA) on 15 screens at two sizes, and a keyboard focus walk through 7 screens.
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
| VERIFIED (fixed, retested by an automated check and by looking at the screenshots) | 53 (D-001 to D-022, R-01 to R-31) |
| ACCEPTED (known limitation, documented below) | 4 (A-1 to A-4) |
| OPEN | 0 |

By severity: P0 1 (D-001), P1 15, P2 24, P3 13, all fixed and retested. Test-suite defects (T-1 to T-8) are listed
separately; they were problems in the tests, not in the app.

Measured before and after on the exercise screen (378 measurements per round):

| Round | Load state failures | After a wrong answer | Answer revealed |
|---|---|---|---|
| Baseline (before) | 37 / 126 | 21 / 126 | 39 / 125 |
| Iteration 4 | 0 / 126 | 0 / 126 | 2 / 126 → fixed by D-021 |
| Round 4, stricter (whole drawing, R-31), final build | 0 / 126 | 0 / 126 | 0 / 126 |

Screen audit: round 1 found 14 problems in 76 checks; round 2: 0; round 3 (9 sizes, no-server build): 0 in 135;
final round (19 screens × 9 sizes, both builds): 0 problems in 171 checks, 0 tap targets under 32 px.

---

## Exercise screen

### D-001 · P0 · The question scrolls away while answering
- **Screen / viewport:** lesson, every exercise with a drawing or a table · 320×568, 360×640, 375×667 (also 390×844 and 393×852 for the grid, area and graph exercises).
- **Steps:** open a coordinate, graph or table exercise on a small phone; tap the answer field.
- **Expected:** the question, the maths and the answer field are visible together, above the keypad.
- **Actual:** the page scrolled so the answer field was above the keypad; the question went off the top. 37 of 126 load-state measurements failed (13 of 14 exercises at 320×568).
- **Root cause:** the lesson was one scrolling column with a fixed keypad dock laid over it, and the dock's height was measured in JavaScript and added as bottom padding. Everything competed for one scroll position.
- **Fix:** the exercise screen is now three grid regions in `100dvh` (`grid-template-rows: auto minmax(0,1fr) auto`, `min-height: 0`): a top region (progress, close, question bubble with מדי), a middle region that is the only thing that scrolls (drawing, table, choices), and a bottom region (answer field, keypad, tools, check). The answer field moved out of the scrolling region into the bottom region, directly above the keypad. (Round 4 replaced the short-screen part of this fix: the question now stays pinned everywhere and short phones get a 3-row keypad and drawings that fit the region; see R-01.) Files: `screens/Lesson.jsx`, `styles/app.css` (exercise v4 block).
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
- **Tests:** `layout.spec.js` "on a computer: digits typed anywhere go to the answer, Enter checks and Enter continues".
- **Status:** VERIFIED

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

## Round 4: independent adversarial review

A separate reviewer (a fresh agent, not shown my conclusions) tested both builds in a browser for 41 minutes and
reported 28 findings: 0 P0, 5 P1, 13 P2, 10 P3, each with steps and screenshots. I reproduced each one before fixing it.
All 28 are fixed and each fix was retested by a script that repeats the reviewer's steps
(`p1check` 17, `p23check` 27, `toastcheck` 3: 47 checks, all passing on the final build) and, where it fits, by a repo test.

| ID | Sev | Screen · viewport | What was wrong | Root cause | Fix | Retest | Status |
|---|---|---|---|---|---|---|---|
| R-01 | P1 | Lesson · 320×568, 360×640 | Drawings and tables mostly hidden behind the keypad; after a second mistake the feedback covered the graph | Three things competed for ~570 px: a 4-row keypad, the question and מדי moved into the maths region on short screens, and drawings had a fixed size. My own audit missed it: it only checked that a drawing *starts* on screen | Question always pinned on top (compact, no מדי on short phones); keypad in 3 rows (1–5 / 6–0 / − . / ⌫) under 700 px tall; the maths region is a size container and drawings fit it (`100cqh`); feedback capped at 46dvh on short phones; tap-to-enlarge sheet for drawings on phones; the audit now fails when a drawing is not whole, or less than 60 % visible after feedback | Exercise audit: 126 cases × 3 states on 9 sizes, 0 failures with the stricter checks | VERIFIED |
| R-02 | P1 | Lesson · all | The phone/browser back button left a started lesson with no question; progress lost | The declarative `HashRouter` cannot block navigation | Moved to `createHashRouter` (data router); `useBlocker` asks "לצאת מהשיעור?" once the student has answered. While testing the fix I found a second bug in it (see R-29) | `flows.spec.js` back-button test; `p1check` on both builds | VERIFIED |
| R-03 | P1 | Plan → lesson → quests | A lesson from the improvement plan never counted for the quest "שיעור חזרה או שיעור מהתוכנית" | The lesson counts `from=plan`, but no link set it | Plan steps and the exam result's weak-topic links carry `&from=plan` | `flows.spec.js` plan-quest test (`planLessons` = 1); unit test updated | VERIFIED |
| R-04 | P1 | Assistant, lesson tutor | Switching tabs wiped the chat and the written exercises; closing the tutor sheet emptied the conversation | Inactive tabs and the closed sheet were unmounted, taking their state with them | All three tabs stay mounted (inactive ones `hidden`); the lesson keeps the tutor conversation per exercise, and a reply still arrives if the sheet was closed mid-answer | `p1check`: chat 2→2 messages, 3 exercises and the typed answer kept, tutor 2→2 | VERIFIED |
| R-05 | P1 | Profile · no-server | Class-join form and "check connection" that cannot work | (D-017, D-018, already fixed before the review on a newer build) | — | `p1check` | VERIFIED |
| R-06 | P2 | Lesson | The hint disappeared on the second try | It rendered only in the first-try phase | The hint shows on the second try too, above the answer (the drawing makes room for it) | `p23check` at 320×568: hint visible, drawing whole | VERIFIED |
| R-07 | P2 | Map, quests | An abandoned lesson lit the streak | Answers created a day record without `lessons`, and a rule for very old data counts such days as active | Every answer writes `lessons: 0`; only genuinely old records use the old rule | Unit test; `p23check` (streak 0) | VERIFIED |
| R-08 | P2 | All screens | A new screen kept the previous screen's scroll position | No scroll reset between routes | `ScrollRestoration` (top on new screens, restored on back); the map keeps its own target after a lesson (`preventScrollReset`) | `p23check`: quests at 0, back to "אני" at 1152 | VERIFIED |
| R-09 | P2 | Lesson (class student) | Toasts covered the keypad and blocked taps | The toaster was placed for the tab bar, which lessons do not have | In lessons, toasts appear at the top | `toastcheck`: toast bottom 130 px, keypad top 458 px | VERIFIED |
| R-10 | P2 | Lesson notebook | The notebook check result appeared under the bottom region | Nothing scrolled it into view | The maths region scrolls to the waiting state and to the result | `p23check` | VERIFIED |
| R-11 | P2 | Topic, exams, practice sheet · no-server | AI-only actions led to dead ends | They were shown regardless of `aiReady()` | Hidden or reworded without the assistant; the practice sheet points to its answer key; exam check explains instead of offering an upload that cannot be checked | `p23check` | VERIFIED |
| R-12 | P2 | Coordinate drawings | Axis numbers ~7–8 px; point letters on top of them | 11-unit text in a scaled-down SVG; letters always above-right | Numbers 14 units with a white halo; letters placed away from both axes; drawings now larger | `p23check`: axis numbers 15.9 px at 390 | VERIFIED |
| R-13 | P2 | Map · 320 | Sticky unit header ~185 px tall | Title, three-line description and a labelled button in a narrow row | Under 400 px: smaller emblem, icon-only guide button (still named), no description in the sticky header | `p23check`: 90 px | VERIFIED |
| R-14 | P2 | Practice exam answer key · phones | "10." clipped; answers misaligned; multiple choice could show raw TeX | Items were `dir=auto`; the raw answer string was printed | Right-to-left list; the choice letter with rendered maths; values as left-to-right runs with a real minus | `p23check` | VERIFIED |
| R-15 | P2 | Teacher dashboard · 320–375 | Teacher key outside its box; tabs cut off; table cut | No wrapping; the tab row scrolled with no hint | The key wraps inside its chip; tabs wrap; wide tables show a scroll shadow | `p23check` with a real class | VERIFIED |
| R-16 | P2 | Assistant · 320 | Tabs wrapped and clipped; selects truncated | Icons and labels too wide; two selects side by side | One-line tabs (icons dropped under 340 px); selects full width under 420 px | `p23check` | VERIFIED |
| R-17 | P2 | Lesson end · 320–375 | "%" wrapped onto its own line | No `nowrap`, number too wide for the tile | `nowrap` and a smaller number and icon on narrow phones | Screen audit, screenshots | VERIFIED |
| R-18 | P2 | Quests · 320 | Week row crossed the card's border | Fixed 36 px dots with gaps | Dots share the width under 400 px | `p23check` | VERIFIED |
| R-19 | P3 | Onboarding · 320 | A step opened already scrolled | No scroll reset between steps | Each step opens at its top | `p23check` | VERIFIED |
| R-20 | P3 | Onboarding | "לשיעור הראשון" opened the map | — | It opens the first lesson | `flows.spec.js` first-visit test | VERIFIED |
| R-21 | P3 | Exams vs plan | The plan was "0 of 1 steps" on one screen and "empty" on the other | Different rules | The exams list uses the plan screen's rule | Screenshot | VERIFIED |
| R-22 | P3 | Lesson · keyboard | Choices were separate tab stops; arrows and the printed numbers did nothing; focus stayed in the field after checking | — | One tab stop for the group, arrow keys move, number keys pick, Enter checks; focus moves to the feedback button | `p23check` | VERIFIED |
| R-23 | P3 | Help requests | The same request could be sent again and again | No de-duplication on the server | One open request per exercise; a repeat updates its note and page | `toastcheck`: 2 sends → 1 open request | VERIFIED |
| R-24 | P3 | Lesson · bad link | "השיעור לא נמצא." with no way back | — | מדי, a sentence and "חזרה למפה" | `p23check` | VERIFIED |
| R-25 | P3 | Lesson · lines | The answer row named a point (E, A, B) the question never mentioned | — | The question names the point; a unit test checks every point answer | Unit test | VERIFIED |
| R-26 | P3 | Assistant | "Works through the class server" for students outside a class | — | Says "the app's server" outside a class | `p23check` | VERIFIED |
| R-27 | P3 | Lesson · tablet, desktop | Drawings did not grow | Fixed maximum sizes | Drawings fit the maths region (up to 560 px wide) | Screenshots at 768 and 1440 | VERIFIED |
| R-28 | P3 | Jump test | A greyed-out hint button with no reason | — | No hint button in tests | `p23check` | VERIFIED |

### Found while fixing round 4

| ID | Sev | What | Root cause | Fix | Retest | Status |
|---|---|---|---|---|---|---|
| R-29 | P1 | After "להמשיך ללמוד", a quick second back press hid the question and the back button stopped working | The fix for R-02 opened the question when the blocker's *state* changed; "stay" reset it and the next back blocked it again within one render, so React saw `blocked → blocked` and nothing happened | Open the question for every new blocked navigation (the blocker object), and mount a fresh dialog each time | `backfast` script: question shown on the 1st, 2nd (100 ms later) and 3rd press; `flows.spec.js` | VERIFIED |
| R-30 | P2 | Short phones, line-equation exercise: an empty maths region | My R-01 change took מדי out with the question | מדי waits in the maths region when there is nothing to draw (short phones only) | Visual baseline `exercise-line` (320×568), reviewed | VERIFIED |
| R-31 | P2 | Audit gap: the exercise audit accepted a drawing that was mostly hidden | It checked only where a drawing starts | It now requires the whole drawing in the maths region, and 60 % of it in view after feedback | Ran on 9 sizes | VERIFIED |

## Round 5: independent external review of staging (commit 7a9468b)

An outside reviewer (ChatGPT with Firecrawl, 231 screen and render checks on the public staging copy) reported four
findings. Each one was reproduced on the exact deployed files (taken from `gh-pages`) before it was fixed, and each fix
has a repo test that fails on the old code and passes on the new one.

| ID | Sev | What the reviewer saw | Reproduced (before) | Root cause | Fix | Proof (after) | Status |
|---|---|---|---|---|---|---|---|
| E-01 | P1 | Map → Start → a partial answer → browser Back: back on the map with no question | Yes: no question, back on the map. After a *checked* answer it did ask. A lesson opened by link left the app (to the previous page) | My R-02 fix asked only after the first checked answer; a lesson opened by link was the first page of the visit, so Back left the document | Back asks whenever a lesson is under way, exactly like the close button (`useBlocker` on an unfinished lesson). A lesson opened straight from a link gets the map underneath it in the history before the router starts (`lib/historySeed.js`) | `flows.spec.js`: from the map with a partial answer (it asks; "stay" keeps the typed 7; three quick Backs keep asking; "exit" returns to the map), by link (asks, then the map), after answering (progress kept). The first two fail on the old code | VERIFIED |
| E-02 | P2 | Choice exercises at 390×844: large empty areas between the question and the answers | Yes: 176–253 px between the question and the maths | Round 4 centred the maths region's content vertically, which floats a short group of choices in the middle | Multiple choice: the expression and the choices come right under the question as one group, and the space left over goes to the bottom, above the check button. Typed answers keep their centred placement (not part of the finding, so not changed). Cards were not stretched | Gap now 26 px (coord/2, pyth/3, signed/2). `layout.spec.js`: the maths starts within 64 px of the question on every device (fails on the old code) | VERIFIED |
| E-03 | P2 | Graphs about 99 px high at 320×568 | Yes, in the feedback states: 84 px with the hint open (and not whole in 6 of 15 stairs), 84–129 px when the answer is revealed; 131–174 px on load | On a short phone the bottom region took a whole row for the help tools and the check button, and a long hint took four lines | Short phones (≤700 px tall), typed answers: the check button joins the answer row and the help buttons move up beside the progress bar; the hint shows two lines first, with "עוד" under the word "רמז"; the feedback panel is capped at 40dvh (its text scrolls). The enlarge button stays | At 320×568, 15 drawing stairs × 4 states: load 161–224 px (was 131–174), hint 101–154 (was 84–150), revealed 119–161 (was 84–129); every drawing whole in every state. `layout.spec.js`: drawings at least 160 px on load at 320×568 (fails on 6 of 7 cases on the old code); whole on load; at least 60 % in view after a mistake | VERIFIED |
| E-04 | P3 | `window.__madregotItem` undefined despite `madregot-debug=1` | Yes, two causes: a script running in an isolated context cannot see page variables; and setting the flag after the lesson opened did nothing until the next exercise | The hook lived only in a page variable and read the flag only when the exercise changed | In the staging build the hook is always on (`VITE_QA_HOOKS=1`), and the exercise is also published as JSON in `<html data-qa-item>`, which any script context and the page HTML can read. Production still needs the flag | `flows.spec.js`: the attribute matches the exercise, is readable from an isolated world (Chrome DevTools Protocol), and follows the next exercise (fails on the old code) | VERIFIED |

### Found in my own checks during round 5

| ID | What | Effect | Fix | Status |
|---|---|---|---|---|
| T-9 | The visual regression comparison was too tolerant (1 % of pixels may differ, colour threshold 0.2). On this light design, moving a pale box and thin glyphs stays under both, so it passed the round-4 centred choices against a top-aligned baseline, and 20 baselines had silently gone stale | Earlier "39 baselines match" results were weaker than they looked: they would have caught large changes but not layout shifts of light content | Threshold 0.1 and 0.2 % of pixels. The old layout now fails. All 20 changed screenshots were reviewed side by side (every difference was an intended change from rounds 4 and 5) before being accepted; the strict suite passed twice in a row | FIXED AND RETESTED |
| T-10 | My axe scan and focus walk seed the test student under the production storage key; on the staging build (its own key) they saw only the Welcome screen | A "0 violations" result on the staging build would have meant nothing | Caught before reporting (the assistant screen showed 2 controls instead of 7); the scans were rerun on a build of the same code with the default key | FIXED AND RETESTED |

## Test-suite defects found and fixed

| ID | Problem | Fix |
|---|---|---|
| T-1 | Visual baselines captured the "טוענים…" placeholder | each shot waits for a ready selector and for the placeholder to be gone; regenerated, stable on 2 runs |
| T-2 | The multiple-choice layout check did not fit the desktop side column | each choice is scrolled into view and checked separately |
| T-3 | End-screen loop raced the screen change | waits for the heading to change |
| T-4 | Placement journey failed once in 3 full runs under load | the next answer could go to the previous exercise; `proceedToNext` waits for the exercise to change. 12/12 and 144/144 repeated runs passed after |
| T-5 | The feedback panel can hold two buttons | selectors target `.fb-actions .btn` |
| T-6 | New journey tests answered before the lesson had rendered | they wait for the exercise (`expect.poll(item)`); 48/48 over 3 repeats |
| T-7 | A test entered the lesson by setting `location.hash`, which the router cannot block (not a real path) | it starts the lesson from the map's continue button, as a student does |
| T-8 | The exercise audit treated the desktop side column as covering the maths | it knows when the bottom region is beside the maths |

## Accepted limitations

| ID | What | Why it is accepted |
|---|---|---|
| A-1 | 320×568 with the hint open, or after a second mistake: a coordinate drawing shrinks to about 85 px (whole, with the enlarge button on it) | The smallest supported phone has about 570 px for the question, the maths, the hint, the answer and the keypad. The drawing stays whole and opens full width with one tap. |
| A-2 | Not tested on a real iPhone, in iOS Safari, in WebKit or on Android Chrome | No device or WebKit run in this environment. Needs one pass on a real iPhone (Safari, home-screen app) before calling mobile done. |
| A-3 | No test with a real screen reader (VoiceOver, TalkBack) | axe-core and keyboard checks only. |
| A-4 | The wording of the AI's answers was not reviewed | The local build uses a stand-in for the Claude API. |

## Round 6: the transformation, checked at every size (8 November 2026)

- **Sweep:** every screen (welcome, both grades' maps, quests, profile, exams, practice exam, exam check, plan, assistant, topics, a topic, the teacher dashboard) and sixteen lesson types, at 320×568, 360×640, 375×667, 390×844, 430×932, 768×1024 and 1440×900: 203 screen-and-size checks, with no sideways scroll, the main action on screen and not covered, no script error and no text cut by its box. None found.
- **Interactive exercises:** eleven kinds (number line, ordering, point, quadrant, rectangle vertex, point of a line, line builder, angle, triangle, Pythagoras squares, mean and median bars) driven with real drags, arrow keys and step buttons on four device sizes, through "not yet" and the right answer: 48/48.
- **Accessibility:** axe (WCAG 2.1 A/AA) clean on 30 screen scans and on 24 interactive states (eight kinds, each open, with the hint and with the answer shown). Colour pairs checked with a WCAG contrast tool: 25 pairs, all AA, after raising five.
- **Suites:** unit 94/94, end-to-end 225/225; visual baselines updated only after each changed picture was reviewed.
- **Assistive-technology check (agent-desktop):** Chromium on a virtual X display with a window manager and the AT-SPI accessibility bus, read and driven by agent-desktop through the native accessibility tree, as a screen reader or switch user would. The welcome screen exposes its headings, the number line as a named slider with its value, the two named step buttons, and both main buttons. Pressing "הסמן ימינה" five times through the tree moved the slider from −2 to 3 and changed the heading to "בדיוק! ככה נראה תרגול במדרגות.", so the live demo works with no pointer at all.

## Round 7: מדי's colour, an answer-box bug, the production publish (8 November 2026)

- **Production publish:** `gh-pages:madregot/` went from tree `a67d6804` (the rollback point) to `5f299f9b`; staging and the rest of the site were unchanged. The Pages run for `807637e` succeeded, and the new build's script (`assets/index-H0kuLUrS.js`, which only exists in that build) is served from github.io.
- **מדי's colour:** he was the brand indigo, the colour of every main button and of the stairs, so he blended into the screen. His colours now live in tokens (`--madi-*` in `tokens.css`: body, edge, treads, limbs, plus sign, cheeks), so a change of colour is a change of tokens only. Four single colours and four two-tone combinations were captured on the first screen, the map, a wrong answer and the end of a lesson, and each one in its weakest place (teal in the petrol "angles" world, coral beside a red final answer). Pink was dropped (it vanishes into the fuchsia coordinates world and the AI rose). Chosen: a coral body with teal hands and feet. He is the only warm character on cool screens, so he stands out in every world; coral is not red, orange or gold, which carry meanings. Checked on twelve screens and the five store frames, which were made again from the real app.
- **D-019 · P2 · After a wrong first try, a pasted or replaced answer kept only its last character** (`screens/Lesson.jsx`). The struck-out answer assumed new keys were typed after the old answer: pasting 98 over 97, or typing at the start of the box, gave "8". The on-screen keypad was not affected (it has its own path); a computer keyboard was. Fixed with `lib/strike.js` (`afterStrike`: keys typed before, after or inside the old answer start the new one, a delete clears it, a paste or a replaced selection is taken whole), five unit tests and an end-to-end test on phone and desktop. The end-to-end test fails on the old code (it got "1" for "41") and passes on the new.
- **Stale baselines found:** the phone exercise baselines still had the old progress bar from before the lesson staircase. The difference was thin grey lines, under the 0.2% tolerance, so it passed until מדי's colour pushed it over. Every changed picture was measured (where the changed pixels are, and what share is in מדי's colours: 92–96% where he is the only change) and looked at before the 27 baselines were updated.
- **T-9 · flaky once:** "a right answer" at 320×568 failed once in a full run (the page 28 px scrolled, the button in its pressed state) and passed 5/5 on its own. With real taps and the CPU slowed 1×, 4× and 8× (12 runs) the lesson never scrolled (`scrollY` 0, the page exactly the screen height), so it is Playwright scrolling a clicked button into view under load, not something a student sees. The test is unchanged.
- **Suites:** unit 99/99, end-to-end 227/227 (45 skipped by design: each spec runs on its own devices).

## Round 8: Madregot 2.0 (8 November 2026)

- **Unit tests: 405/405.** Engines (prerequisites, mastery, misconceptions, recommendations, mission, Exam Rescue,
  tutor, analytics), the store glue and migration, the lesson engine's checks, and the content of all 33 stairs:
  every worked-example step's value, every guided problem's answer, every interactive goal reachable, every
  misconception's prediction showing on at least 4% of questions and distinguishable from every other, the solution
  reaching the answer, and a mastery check, a review and a verification for every misconception on every stair.
  (Checkpoint 2's commit message says 415: that was a miscount; the run gave 405.)
- **End-to-end: 274 passed, 0 failed (158 skipped by design).** New: `learn.spec.js` (learn before practising, keeping
  the place, mastery only without hints, a misconception repaired and verified, Exam Rescue, profile numbers and
  deletion, data from before 2.0) on phone and desktop, and `teach-all.spec.js` completing the teaching of all 33 stairs.
  Changed on purpose: a new student starts with the first stair's teaching; Back from a lesson started on a stair
  returns to the stair. Visual baselines updated after review (Madi purple, the new home).
- **Accessibility:** axe (WCAG 2.1 A/AA) on 36 scans of the new screens and states (home, mission, journeys, each
  teaching stage with a prediction chosen and a wrong guided move, the tutor open, repair, Exam Rescue setup and plan,
  a check, the profile): 0 violations after fixing two (a badge's contrast, choice buttons whose text is only maths).
- **Sizes:** 60 checks of the new screens at 320×568, 375×667, 390×844, 430×932, 768×1024 and 1440×900: no
  sideways scroll, no control under the tab bar, no script error (one flag was a button inside a closed section).
- **Found and fixed by the tests and walks:** two misconceptions that predict the same answer wherever both apply
  (narrowed over two questions now); counter-evidence was taken from questions where the misconception could not show;
  a mission item was completed by an unrelated activity; predictions that are not whole numbers needed the student's
  rounding; the bars' median was wrong for an even count; statistics answers showed as fractions; a teaching step's
  text contradicted its drawing.

## Round 9: independent review of staging b151f978 (8 November 2026)

Both findings were reproduced on the deployed files themselves (`gh-pages:madregot-staging/` at b151f978, served
locally with its own storage key), following the reviewer's steps.

| ID | Before (b151f978) | Cause | After |
|---|---|---|---|
| R-1 · P1 | Exam Rescue for signed:1 and signed:2, 4/4 right in the diagnostic: "כבר שולטים ב־2 מתוך 2 המדרגות במבחן", both rows badged "שולטים", the plan only "חזרה קצרה". The map at the same time: "שולטים לבד ב־0 מתוך 15". | Logic, not only words: two right diagnostic answers were treated as mastery ("strong") and scheduled as a review of something never mastered. | A separate standing, "עברו את הבדיקה הראשונה" (likely ready), and "שולטים לבד" only after a mastery check, as everywhere else. Message: "ב־2 מתוך 2 המדרגות עברתם את הבדיקה הראשונה: כנראה מוכנים, ובדיקת שליטה קצרה תאשר." The plan now schedules a mastery check for those stairs; a legend under the list explains the two terms. The map still says 0 of 15, and now agrees. |
| R-2 · P2 | The mission item "מדרגה חדשה: חיבור וחיסור" was marked done after stage A only; the home card said "המשימה של היום הושלמה. כל הכבוד." while the stair page showed 1 of 5 stages. | The mission item named the stair but was meant as one short activity, and any learning on the stair completed it. | Learning items name their stage ("מבינים את הרעיון: חיבור וחיסור", "שלב 1 מתוך 5") and open it directly; an item is done only when that stage is (or a mastery check passes). On completion: "במדרגה "חיבור וחיסור" סיימתם את שלב 1 מתוך 5 (מבינים את הרעיון). המדרגה עצמה עוד לא הושלמה: השלבים הבאים מחכים בדף שלה." |
| R-3 (found while retesting) | The home mission said "המבחן בעוד 4 ימים" while Exam Rescue said "עוד 3 ימים", and called a stair "עוד לא בטוח" right after Exam Rescue called it "כנראה מוכנים". | The mission counted to the end of the exam day; its reason made its own claim. | Days counted the same way in both; the mission says "המבחן בעוד 3 ימים. הצעד הבא בתוכנית ההכנה מחכה." |

Regression tests: unit (Exam Rescue standings and message, mission stage naming and completion, day count) and
end-to-end (`learn.spec.js`: the reviewer's two procedures, on phone and desktop). Retested at 320×568 and 375×667.
Suites: unit 409/409, end-to-end 278 passed, 0 failed (162 skipped by design); axe 36 scans, 0 violations; size sweep
60 checks, one flag that is a button inside a closed section. Two visual baselines (the home screen on two phones)
updated after review: the mission item now reads "מבינים את הרעיון: אורך קטע · שלב 1 מתוך 5".

## Round 10: design system v4, the premium redesign (8 November 2026)

Design language and components: `DESIGN.md` → "Design system v4". Screens redesigned: home (mission hero, exam
entry, mastery snapshot), the teaching stages A, B, C and every remedy (one lesson module: prompt with מדי, the board,
the response, pinned actions), practice (the board in the middle, the expression centred and larger), the stair's
journey (five rising stages), Exam Rescue (countdown hero, readiness riser, three-step setup with stair chips),
the mission (riser, celebration card), the check result (a celebration card), and the profile (progress summary).

Before/after: the same 19 app states captured from the pre-redesign commit (6f96d5c, built locally with the same
settings) and from the redesign, at 320×568, 375×667, 390×844, 430×932, 768×1024 and 1440×900.

Defects found during the redesign review and fixed:

| Where | Before | Cause | After |
|---|---|---|---|
| Check result, every phone | The whole page rendered zoomed out (tiny text) when the next step's title had maths in it | The button never wrapped (`white-space: nowrap`), so the page was wider than the phone | Long titles wrap inside the button; overflow 0 at 320, 390 and 1440 (scanned) |
| Exam Rescue header | A black slab under מדי | The screen asked for a colour family that does not exist (`ch-exams`), so the drawing had no fill | The orange family, matching the countdown |
| Lesson progress (new riser) | Steps stayed grey | An older rule (`.sp-progress i`) was more specific | Two-class selectors |
| Stair chips in Exam Rescue (new) | An invisible checkbox lay over each chip and took the tap before its label | Overlay technique | A visually hidden input; the label takes the tap (the reviewer's procedure test caught it) |
| Practice on a 320×568 phone (new) | A drawing shrank to 138px (the floor is 160) and the page could shift 28px | The new board's margins | On short screens the board runs edge to edge and the question card is tighter |
| Home on a 320×568 phone (new) | The mission's button was below the fold | The parts were listed first | The button comes right after the reason; the parts follow |

Suites on the final code: unit 409/409; typecheck clean; end-to-end 278 passed, 0 failed (162 skipped by design);
axe 36 scans + 9 new (check results passed and not yet, the profile with work to do; 320, 390, 1440), 0 violations;
size sweep 60 checks, one flag that is a button inside a closed section. Visual baselines: 50 images updated after
side-by-side review (old against new, phone and short phone), then the 17 short-phone images again after the
short-screen fix. These tests check that the screens work and fit; they say nothing about whether students learn more.

## Round 11: layouts after Duolingo and Brilliant (9 November 2026)

The owner asked for the layouts of Duolingo and Brilliant rather than an original layout. Layout structure only:
Madregot's colours, fonts, icons and מדי stay; no art, character, wording or brand asset of either app is used.
Details in `DESIGN.md` → "Layouts after Duolingo and Brilliant".

Behaviour change in the teaching stages (A and every remedy): an answer card is now selected and then checked with
"בדיקה" at the bottom (as in both reference apps), and an object to move is checked from the same bottom button. The
result strip ("נכון!" green, "ניחוש טוב לבדוק" / "עוד לא" yellow) replaces the inline verdict title. The end-to-end
drivers were updated accordingly (`.lm-check`, "המשך").

Found and fixed during this round: a count such as "0 / 2" read "2 / 0" in the right-to-left bar, and a score such
as 4/5 could read 5/4 (both now isolated left to right); the unit banner's small label was 3.9:1 and the exam
countdown's "ימים" 3.8:1 (both now 4.5:1 or more, axe).

Suites on the final code: unit 409/409; typecheck clean; end-to-end 278 passed, 0 failed (162 skipped by design);
axe 36 + 9 scans, 0 violations; size sweep 60 checks, the one known flag (a button inside a closed section).
Visual baselines: 50 images updated after an old/new review on phone and short phone.

## Round 12: structural rebuild on the real Duolingo and Brilliant layouts (9 November 2026)

The owner asked for the actual screen composition, navigation and interaction flow of the two apps, researched from
real screens, not a restyle. Research: 67 Duolingo images (about 40 raw device captures, 2024–2026) and 71 Brilliant
images (62 raw in-app captures), each with its source URL and measured region positions; kept outside the repository.
Specification: `LAYOUT_SPEC.md`.

What changed in structure (JSX, not only CSS):
- Home is the path (top stats bar with today's mission count, sticky unit banner, nodes, icon-only tabs). The mission
  card moved to the Missions tab; the mastery grid and level board moved to Topics; a path stop's first button opens
  the next stage directly.
- Practice: a bold instruction line under the bar (a word problem is said by מדי in a bubble); help moved to the top
  bar; the footer holds only the answer and one full-width check, which sits right above the number pad; text answers
  sit low; no divider behind the button.
- Teaching stages, remedies: one header row (close, segmented bar, help) replaces the title bar; the lesson title on
  the first screen only; the text at the top, then the visual and its controls in the middle band; answer cards in a
  centred grid of two; select, then "בדיקה"; the result sheet with "למה?" beside "המשך" (the explanation opens on
  request); a first miss shows a yellow hint and keeps "בדיקה".
- Welcome: the character in the middle, two buttons pinned at the bottom (the demo exercise was removed from it).
- Exam Rescue: the details are a one-question-per-screen flow without the tab bar; the plan's days are a path with
  today's stop open and a trophy for the exam.
- Profile and a new Settings screen (`/settings`); Topics as a sections overview; the guidebook; the assistant as a
  conversation; the quit sheet with a quiet red "יציאה"; tab headers as solid colour blocks.

Proof: 16 side-by-side sheets (reference with its measured bands, Madregot after with regions measured from
`data-region` markers, Madregot before), 3 interaction-sequence strips, and before/after at 320×568, 375×667,
390×844, 430×932, 768×1024 and 1440×900.

Found and fixed during this round: the e2e run collided with another run on the same port (rerun cleanly); two
desktop journeys matched two "משימות" links once the side panel existed (exact name); the white subtitle on the orange
tab header was 4.39:1 (now darker, 4.5:1 or more).

Suites on the final code: unit 409/409; typecheck clean; end-to-end 278 passed, 0 failed (162 skipped by design; the
teaching drivers now pick, press "בדיקה" and read the result sheet); axe 45 scans, 0 violations; size sweep 60
checks, 0 problems. Visual baselines: 51 images updated after an old/new review.
