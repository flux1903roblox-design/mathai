# Madregot layout specification: Duolingo for the daily loop, Brilliant for discovery

Status: implemented (9 November 2026); part E added in round 13 (the remaining routes, the confirmation rules). Evidence: real reference captures collected and measured in this round
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

## E. One grammar for every screen (round 13)

Round 12 rebuilt the main loop. Round 13 finished the routes that still had the old structure (exams, the plan, the
mission page, the assistant's tools, the tutor, the lesson's sheets, the teacher's screens) with the same parts, so
that navigation, feedback, where content starts and where the primary action sits are the same everywhere. The parts
live in `src/components/Screen.jsx` (`ScreenBar`, `ScreenFoot`, `EmptyState`, `Flow`).

### E1. Four kinds of screen
| Kind | Structure | Navigation | Primary action | Screens |
|---|---|---|---|---|
| A tab's own screen | a solid header block in the screen's colour (Duolingo's quests and profile tabs), then cards | the tab bar | at most one solid button, inside the first card | home (the path), missions, exams, assistant, profile |
| A pushed screen | `ScreenBar`: back at the start, the title in the middle, an optional icon at the end; then the content | back only; **no tab bar on a phone** (Duolingo's settings, guidebook and section overview are full screen) | **one**, pinned at the bottom in `ScreenFoot` (where the tab bar was); a second way is a quiet text link under it | settings, topics, guidebook, stair page, Exam Rescue plan, exam check, practice sheet, exam result, improvement plan |
| A question flow | `Flow`: back and a thick progress bar; מדי asks in a speech bubble; the answers as full-width rows; the button at the bottom, grey until answered (Duolingo's onboarding) | back steps back | "המשך", the last step names what happens ("הכנת המבחן", "פתיחת הכיתה") | onboarding, Exam Rescue details, new practice exam, teacher sign-in, teacher without a server |
| A result | מדי or the trophy in the upper half, a coloured title, three stat tiles, then any details, one wide button pinned at the bottom (Duolingo's lesson complete) | none until the button | the one button; a second way only as a quiet text button | lesson done, check done, placement done, streak, quests done, exam result (as a pushed screen with the same order) |

Sheets (the quit sheet, the tutor, the assistant's chat and tools, the remedy, help from the teacher, adding a class)
are one build too: a title and the close button at the top, the content, and the sheet's one action pinned at its
bottom (the chat's input, the remedy's button, "שליחה למורה", "פתיחת הכיתה"). Conversations (the assistant, the
tutor, the chat sheets) share one layout: מדי's messages as bubbles at the start side with his face, the student's at
the end side, the starters or questions docked above the input at the bottom (LAYOUT_SPEC B3).

### E2. When an answer is judged: explicit checking vs. immediate feedback
The rule is the same in teaching (Brilliant), guided solving and practice (Duolingo):

1. **A graded answer is never judged on tap.** Tapping a choice, typing a number or moving an object only *selects*.
   The bottom button "בדיקה" (off until there is something to check) judges it. This holds for practice exercises,
   teaching predictions, teaching objects, every step of "פותרים יחד" and its typed last step, the placement test and
   the checks.
2. **The result always appears in the same place:** a sheet rising from the bottom over the button row, green when
   right, yellow (gold in practice) when not yet — never red for a first miss — with מדי beside the explanation.
   The exercise stays in view above it.
3. **The button changes in place.** After a right answer "בדיקה" becomes "המשך" in the same slot (in teaching, "למה?"
   sits beside it and opens the explanation). After a miss it stays "בדיקה" (off until the answer changes), the
   wrong choice is marked and locked, and the hints grow (in guided solving: a hint, then a stronger one; after a
   third miss on the last step the answer is shown with the reason, and "המשך").
4. **Immediate feedback only where nothing is graded:** live readouts while moving an object (the number line's value,
   the slope's rise and run), revealing the next step of a worked example, the tutor's answers to a question chip,
   choosing options in a flow (only highlighted, nothing judged), navigation.
5. **One primary per screen state.** A row in a list opens its own screen (it is a link with a chevron, not a second
   button); a card that is not the current one gets a quiet text button; secondary actions are secondary or ghost
   buttons and never the solid primary.

What changed in round 13 under these rules: guided solving judged a choice on tap and advanced by itself after 0.9 s,
and its typed last step had its own "בדיקה" beside the input; now the choice is selected, "בדיקה" at the bottom judges
it, the result rises in the sheet (that choice's own feedback), and "המשך" advances. Duplicate primaries removed: the
exams tab's practice exams (each row had "פתיחה" and a solid "בדיקה"), the exam result's solid button per weak topic,
the mission page (a button per row and one at the bottom), the practice sheet (print and check side by side), the
empty plan (two buttons), the topics screen (a solid button on every unit card), the level board's own "המשך" (unused,
removed), and the failed jump test (two stacked buttons; the second is now a quiet text button).

### E3. The routes finished in round 13 (reference pattern → Madregot)
| Route / state | Kind | Built as |
|---|---|---|
| `/exams` | tab | the solid header; ONE featured card (the plan in progress, else checking an exam, else a practice exam) with its button; the other ways as plain rows; checked exams and practice exams as rows (no buttons in rows) |
| `/exams/check` (offline, no pages, pages, loading, error) | pushed | מדי asks for the pages in a bubble; the page thumbnails; the optional name; "בדיקת המבחן" pinned; loading: מדי and the steps of the check in the middle; error: the message above the pinned "לבדוק שוב"; offline: an empty state with "הכנת מבחן תרגול" pinned and the way to connect as a text link |
| `/exams/new` | flow | two questions (which topics, how many questions), "המשך" then "הכנת המבחן" |
| `/exams/practice/:id` | pushed | print as the bar's end icon; the sheet; "סיימתי, לבדיקה" (or "למפתח התשובות") pinned |
| `/exams/:id` (all, wrong only, asking about a question) | pushed + result order | מדי and the exam's name; score, correct and topics-to-strengthen as three tiles; the summary; what to strengthen as rows; the feedback per question with its filter; delete as a red row; "תרגול: <the weakest stair>" pinned; the question chat as a sheet with the conversation layout |
| `/plan` (empty, with steps) | pushed | a course outline like the stair page: a thin bar, "הצעד הבא", the steps as stops on one line (done ✓, current filled with its reason and count); the current step's button pinned; empty: מדי, one pinned button and a text link |
| `/mission` | merged | now opens the missions tab; today's card there shows each part's kind, minutes, reason and bar, a part opens by tapping its row, and the one button starts the next part |
| `/assistant` (online) | tab | one conversation: no tabs; the photo check and new exercises are tools docked above the input, each opens a sheet with its button pinned |
| Tutor ("שאלה למדי") | sheet | a conversation: מדי's greeting, the question as the student's bubble, his answer as a bubble, the worked example or steps under it; the six questions docked at the bottom |
| Lesson sheets (assistant chat, remedy, help from the teacher, zoom) | sheet | one build: title and close, content, the one action pinned at the bottom; the help request opens with מדי's bubble |
| Placement done, streak, failed jump test | result | tiles before the details (placement); the week and its rule inside one card (streak); one button and a quiet text button (failed jump) |
| "פותרים יחד" (choice, wrong, right, typed last step) | lesson (B1) | rules E2: select, "בדיקה", the sheet, "המשך" |
| `/topics` | pushed | only the unit being climbed has the solid button; the others "מעבר ליחידה" as a text button |
| Teacher without a server, sign-in, new class / existing class | flow | onboarding's flow: back, מדי's bubble, rows to choose, then the fields, the button at the bottom |
| `/teacher` (tomorrow, students, exams, help, a fresh class, adding a class, no students) | tab-like | the solid header with the class, its code and two icon actions (refresh, add a class); four tiles; a segmented switch; groups of plain rows; leaving as a red row; a fresh class as a celebration card with one button; adding a class as a sheet with its button pinned; no students as an empty state |
| Stair page, Exam Rescue plan, settings, topics, guidebook | pushed | the same `ScreenBar` (the stair page's old text link "למפה" and the plan's colour header were replaced), no tab bar on a phone |
