# Madregot layout specification: Duolingo for the daily loop, Brilliant for discovery

Status: implemented (9 November 2026). Evidence: real reference captures collected and measured in this round
(Duolingo: 67 images, about 40 of them raw device captures from 2024–2026; Brilliant: 71 images, 62 of them raw in-app
captures published by Mobbin), each listed in a manifest with its source URL. The images stay outside the repository
because they belong to their owners. Percentages are of the phone screen's height (H) or width (W), measured on
the captures. Madregot's own measurements come from `data-region` markers in the code (header, question, content,
visual, answers, footer, primary, feedback), measured in a browser at 390×844 and 320×568.

What is borrowed: the **layout structure** (where each region sits, its share of the screen, the order of things,
how the bottom changes after an answer, the interaction sequence). What is not: art, characters, names, colours,
fonts, icons, wording. Madregot keeps מדי, its purple family, Fredoka and Rubik, lucide icons and Hebrew right-to-left
(so "left" in a reference becomes the start side, the right, in Madregot).

## A. Duolingo: the daily loop

### A1. Practice exercise (`/lesson/...`, `Lesson.jsx`) — reference: Duolingo lesson and Duolingo Math captures
| Region | Duolingo (measured) | Madregot |
|---|---|---|
| Header | X + one thick rounded progress bar + one counter at the trailing end, 9.1–11.5 %H (incl. status bar) | X + one thick bar (the per-exercise strip was replaced) + help icons where Duolingo keeps its counter |
| Instruction | bold, start-aligned title right under the bar ("Type the answer", "Match the pairs"), 13.4–15.8 %H | bold title `#qtext` ("חשבו:"); a longer word problem is said by מדי in a speech bubble beside him (Duolingo's "Help Bea" pattern, character about a fifth of the width) |
| Content | the expression large and centred, or a grid of cards | the expression large and centred on a plain white page (no frame); drawings and objects to move |
| Answers | text options as full-width stacked rows sitting low (53–71 %H), picture options as a 2×2 grid | choice rows pushed to the bottom of the content, near the button |
| Number pad (maths) | CHECK directly **above** the pad; the grey pad fills the bottom ~31 % | the same: answer box, full-width check, then a grey pad panel across the bottom |
| Primary | full width with 16 pt gutters, about 44 pt + a 4 pt lip, bottom at 94.6 %H, **no bar or divider behind it** | full-width check, no divider |
| After CHECK | a full-bleed sheet rises from the bottom (green when right, red when wrong), the title and the answer, CHECK becomes CONTINUE in the same spot; the exercise is not dimmed | the same sheet (green; gold for "try again" — Madregot keeps a warm colour for a first miss), "המשך" in the same spot |

### A2. Home = the path (`/`, `Learn.jsx`) — reference: Duolingo home path 2024–2026
- Top stats bar (no background) 7.8–10.6 %H → Madregot: grade switch, **today's mission count** (new), streak, freezes, XP.
- Unit banner 11.9–22.6 %H, 88.7 %W, in the unit colour, label + title, guidebook in its own cell behind a divider,
  pinned while the path scrolls → Madregot: the same (label "יחידה N · X מתוך Y מדרגות", title, "תזכורת").
- The path: round nodes about 16.5 %W, a vertical pitch of about 9 %H, a sine-like swing of about ±16 %W; the
  current node marked with a START bubble → Madregot's path (unchanged geometry, already this shape).
- Node popover under the node, 79 %W, in the unit colour, full-width stacked buttons → Madregot: the stair's card in
  the unit colour; **its first button now opens the next stage directly** (Duolingo's START), the second the stair page.
- Tab bar from 89.8 %H, icons only → Madregot: five tabs, icons only (names kept for screen readers).
- Removed from home (it is not on Duolingo's home): today's mission card (→ Missions tab), the mastery grid and the
  level board (→ Topics).

### A3. Welcome and onboarding (`Welcome.jsx`) — reference: Duolingo welcome and question screens
- Welcome: no header; the character centred at 28–42 %H; the wordmark and one line; **two stacked full-width
  buttons at 82.6–94.6 %H** → Madregot: the same (the interactive demo on the first screen was removed).
- Questions: back + progress bar 8.3–10.3 %H; the character small at the start side with the question in a bubble
  14.4–25 %H; options as full-width rows of about 56–60 pt with 12 pt gaps from about 27 %H; CONTINUE at the bottom,
  grey until an answer → Madregot's onboarding already had this; the Exam Rescue details now use it too.

### A4. Missions (`/quests`, `Quests.jsx`) — reference: Duolingo quests tab
- A solid full-bleed colour header with a white title and the character (0–20 %H) → Madregot: the tab header is now a
  solid block in the screen's colour.
- Sections stacked: quest cards with a thick bar and its count, a chest → Madregot: today's mission card (one row per
  part: icon, title, thick bar with its count), then the three daily quests with the chest, then streak and goal.

### A5. Lesson complete and check results (`LessonDone.jsx`, `CheckDone.jsx`)
- Character centred in the upper half; a coloured title at 56–59.5 %H; **three stat tiles in a row** (each 25.5 %W)
  at 71.6–81.4 %H; one wide button at 88.7–94.2 %H → Madregot: the same order; the button pinned to the bottom.

### A6. Profile and settings (`Me.jsx`, `Settings.jsx`, new route `/settings`)
- Profile: a coloured header block (0–27.5 %H) with the avatar and a gear at the top corner; name; an overview grid of
  2×2 stats → Madregot: the same (מדי as the avatar; streak, XP, stairs climbed, mastered alone), then the next step,
  medals, the learning numbers.
- Settings: pushed from the gear; back and a centred title; grey section labels over plain rows, no cards, one
  hairline between sections → Madregot: the same; the forms (name, class, assistant, sound, deleting data) moved here.

### A7. Topics (`/topics`) and the guidebook (`/topic/:id`)
- Section overview: back + centred title; full-width stacked section cards with a progress bar and a "jump here"
  button → Madregot: one card per unit in its colour, a thick bar with "X / Y מדרגות", "המשך" back to its place on
  the path, the guidebook link; then the level board and the mastery grid.
- Guidebook: a bar with the way back and the unit's banner, then the key ideas one card each.

### A8. Exam Rescue (`/rescue`)
- Details: Duolingo's onboarding flow, one question per screen, full screen without the tab bar (when, which
  stairs, how sure, how many minutes).
- Plan: the days drawn as Duolingo draws a unit's path: one stop per day on a winding road, today's stop open with its
  tasks and its button, a trophy for the exam at the end; the countdown and the readiness bar above it.

### A9. Modals
- Quit sheet: the lesson dimmed, a white sheet from about half the height, the character, a bold title, the big
  "keep learning" button, and leaving as a quiet red text link → Madregot: the same ("להמשיך ללמוד" / "יציאה").

## B. Brilliant: discovery (teaching stages A, B, C, remedies, the stair page)

### B1. A lesson step (`StepPlayer.jsx`, `WorkedExample.jsx`, `Together.jsx`) — reference: Brilliant lesson captures
| Region | Brilliant (observed) | Madregot |
|---|---|---|
| Header | one row at 9.4–11.9 %H: X, a progress bar across ~70 %W, one icon at the trailing end; no title | `LessonHeader`: close, a thin segmented bar, help (מדי); no title bar |
| Title | the lesson's name on its first screen only | `bl-intro` on the first step |
| Text | start-aligned at a 16–20 pt margin, a bold lead-in then plain sentences, 14.7–23.1 %H, then an empty gap | the step's text first (`lm-prompt`), no character beside it, then the gap |
| Visual | the visual and its controls in the middle band, 36.2–78.6 %H (about 42 %); sliders directly under the visual, acting on it live | the expression, drawing or object to move on a light panel (`lm-canvas`) pushed into the middle band, its step buttons under it |
| Answers | short tiles in a centred 2×2 grid (each ~35 %W, 68.7–81.4 %H), or stacked when long | answer cards in a centred grid of two (max ~380 px); stacked when there are many or in "solve together" |
| Primary | a full-width "Check" (~90 %W, ~45 pt) at 88.0–94.1 %H, grey until there is an answer | "בדיקה" at the bottom, off until an answer or a move |
| After Check | a pale green drawer from 79.6 %H: "Correct! +15 XP", then "Why?" (~27 %W) beside "Continue" in Check's slot; a first miss shows a yellow hint card (81.6–96 %H) and keeps Check; "Here's the answer" in grey | a green sheet "נכון!" with "למה?" (opens the explanation, מדי beside it) beside "המשך"; a first miss in an object step: a yellow hint and "בדיקה" stays; a wrong prediction: the explanation in yellow |
| Sequence | one idea per screen; the visual first, then the move, then the question, then the result | the same: each step is one screen (say → explore → predict → rule), the result appears only after "בדיקה" |

### B2. The stair page (`/learn/:topic/:level`, `Journey.jsx`) — reference: Brilliant's course path (raw 35–40, 64)
- The stair's header with the next step, a thin bar of its five stages and one button; then the five stages as nodes
  on one vertical line, done ones checked, the current one filled.

### B3. The assistant (`/assistant`)
- A conversation: מדי's messages as bubbles, the input bar pinned at the bottom (off, and saying why, when the
  assistant is not connected), with the two ways on.

## C. Interaction sequences (what changes on screen)
1. Practice: select or type → "בדיקה" turns on → press → the bottom sheet rises in place of the button row (green or
   gold), the exercise stays visible → "המשך" in the same spot → the next exercise slides in, the bar fills.
2. Teaching: read → move or choose → "בדיקה" → the sheet rises (green or yellow) → "למה?" opens the explanation in the
   sheet → "המשך" → the next step, the segmented bar advances.
3. Home: the path → tap the current stop → its card opens under it → the first button starts the next stage.
4. Exam Rescue: four question screens with "המשך" → the plan → today's stop → "מתחילים".

## D. Measured comparison (390×844, Madregot after this change)
Madregot's numbers come from `data-region` boxes measured in a browser (no status bar on the web, so Madregot's
header starts at 0 %; the references include a 6 % status bar). Side-by-side proof sheets (reference with its bands,
Madregot after with its measured regions, Madregot before) were produced for 16 screens.

| Screen | Reference bands (%H) | Madregot (%H) |
|---|---|---|
| Teaching step with an object (Brilliant 02) | text 14.7–23.1 · visual+controls 36.2–78.6 · Check 88.0–94.1 | text 9.5–16 · visual 35.8–78.2 · button at the bottom |
| Teaching step with answers (Brilliant 10) | question 28.2–35.4 · visual 40.4–65.0 · tiles 68.7–81.4 · Check 90.6–95.9 | question 9.5–19.4 · visual 38.4–52.6 · cards 55.7–71 · button at the bottom |
| After a correct check in a lesson (Brilliant 23) | drawer 79.6–100 · Continue 88.1–93.7 | sheet 83.9–100 · "המשך" in the button's slot |
| Practice (Duolingo 02) | header 9.1–11.5 · title 13.4–15.8 · answers low · button 89.9–94.6 | header + title 0–11.8 · content 11.8–91 · button 92–99 |
| Practice with a number pad (Duolingo Math 11) | check 61.6–66.4, directly above the pad; pad 68.5–100 | check right above the pad; pad across the bottom |
| After check, practice (Duolingo 20) | sheet 73.0–100 (grows upward), button in place | sheet 78–100, button in place |
| Home (Duolingo 30) | stats 7.8–10.6 · banner 11.9–22.6 · path 24–89.8 · tabs 89.8–100 | stats 0–7 · banner 9.5–18 · path 18 onward · tabs 91–100 |
| Welcome (Duolingo 50) | character + name 27.8–53.8 · buttons 82.6–94.6 | centre column · buttons 81.5–100 |
