# Madregot 2.0: architecture, content conventions, status

מדרגות — מתמטיקה שסוף סוף מבינים. The app teaches before it drills: every stair is a journey of five stages,
a misconception engine looks for *why* an answer is wrong, mastery means solving alone, and what to do next is
always explained.

## Baseline (8 November 2026, before any 2.0 change)

| What | Value |
|---|---|
| Branch | `claude/software-improvement-92s9ze` at `dcd44c3` |
| Staging `version.json` | `{"commit": "dcd44c3…", "server": "none", "storageKey": "madregot-staging"}` |
| Production (`gh-pages:madregot/`) | tree `5f299f9b`, script `assets/index-H0kuLUrS.js`, no `version.json`. Not touched by 2.0. |
| Tests | unit 99/99, end-to-end 227/227 |
| Stairs | signed, coord, angles, line, pyth, stats, each stair a generator with a `diag()` category per wrong answer (what the app has today: `PROGRAMME.md`) |

## Where things live

```
web/src/learn/                 the learning model: pure TypeScript, no React, all unit-tested
  types.ts                     the contract (content, learner state, actions)
  expr.ts                      a safe arithmetic evaluator + a seeded random source
  skills.ts                    one skill per stair and the prerequisite graph, with the reason for each edge
  mastery.ts                   evidence → state (not started … needs review), mastery checks, spaced reviews
  misconceptions.ts            diagnosis by prediction, slips, evidence, confirmation, discriminating questions, repair
  recommend.ts                 the engine's building blocks: states, what is missing, the next stage, routes, words
  next.ts                      planNext: the one ranked "what next" every surface reads (home, mission, Rescue)
  programme.ts                 the Ministry's programme (shared/programme.js) and its coverage (shared/coverage.js),
                               bound to the stairs that exist: the /programme page and PROGRAMME.md read it
  challenges/                  the challenge track: grade.ts (grading by code) and one file of tasks per topic
  mission.ts                   the daily ~5-minute mission, made from planNext's items
  examRescue.ts                Exam Rescue: diagnostic, standing per stair, day-by-day plan, message
  tutor.ts                     the tutor without a model: six intents answered from content
  analytics.ts                 local events and the outcome metrics (with a minimum sample)
  items.ts                     exercises from diagnostic models; the plan of each kind of check
  storeGlue.ts                 store transitions + the v1 → v2 migration
  content/index.ts             the registry: CONTENT['signed:1'] …
  content/<topic>.ts           the stairs of a topic
web/src/lib/lesson.js          the lesson engine (+ kind 'check': mastery | review | verify | diagnostic | exam | floor)
web/src/lib/store.js           zustand persist, version 4 (`learn` came in version 2; a persist merge gives an older
                               save `learn.floor` and `learn.challenges`)
web/scripts/programme-md.mjs   `npm run programme:md`: writes PROGRAMME.md and store/counts.json from the code
```

Run: `npm test` (unit, includes every content check), `npm run typecheck`, `npm run test:e2e`.

## The rules the engines implement

- **Mastery is independent.** Watching, a hint, a second try or solving together count as learning with help. Mastery
  is a check of 5 questions, one try each, no hints, 4 right. It is checked again after 1, 3, 7, 16, 35, 60 days;
  a missed review marks it "needs review" (nothing is taken away). States: not started, learning, needs support,
  practicing, mastered (independently), needs review. The student sees the rules (`MASTERY_RULES`).
- **A misconception is never decided from one answer.** Each stair has a diagnostic model: parameters, the right
  answer, and the answer each misconception predicts. A wrong answer adds evidence to every misconception that
  predicts it (split when several do). Confirmed = 1.5 evidence from at least two different questions. A right answer
  where it could have shown removes evidence. Off by one, ten off and two swapped digits are slips. An answer no
  misconception explains is "unknown": the tutor says it does not know rather than guess. When an answer is
  ambiguous, one more question tells the candidates apart (some pairs need two questions: the engine narrows).
- **Repair, then verify.** A confirmed misconception gets its own explanation and an interactive activity (not the
  stair's general explanation again), then 3 questions where it would show. Resolved when 2 are right and it does not
  show. At most 2 offers a day, and after 2 failed verifications it is not offered again: the student is pointed to
  the prerequisite, the other explanations or the tutor instead (no endless loop).
- **What next** (next.ts planNext, one ranked plan): Exam Rescue's steps for today when the exam is within 14 days
  (its diagnostic first; none on Shabbat) > confirmed misconception > due review > points lost in a checked exam of
  the last 45 days, not recovered since > the floor check, or the smallest missing prerequisite of a stair that is
  hard > the stair in progress, then a kept stair's mastery check > the next new stair (taught by now in the school
  calendar first, in school order, never skipping ahead inside a unit) > a challenge task of a mastered stair (it moves
  up to just after the exam losses when the student is strong today: the last three mastery checks passed on the first
  attempt, or every stair of the grade mastered). Every item carries its reason. A
  prerequisite counts as missing only on evidence (or, in the student's own grade, never started and not passed on
  the map); stairs passed on the old map count as known. A short check's miss (the floor check, Exam Rescue's
  diagnostic) counts until the stair is mastered, passes a review or gets three independent right answers after it
  (recommend.ts recoveredSince, the exam-loss rule), so one early miss never blocks the units above that stair. The home map focuses the plan's top when it is a stair of the
  map, and shows it in a banner above the path when it is not; today's mission starts with it; Exam Rescue's "today"
  is the plan's exam steps. So two buttons never send the student to two different next things. The older improvement
  plan (raw mistake counts, `/plan`) is retired: its exam evidence is the exam-loss band, listed as "מה לחזק אחרי
  המבחן" on the quests and the exams tab, and `/plan` redirects to the quests. The daily quests suggest no work of their
  own: one of them is "finish today's mission" (days[d].missionDone, set when the mission's last item is done).
- **The floor (יסודות)** is a bridge unit, fractions and decimals (frac:1–4), below grade 7. It is in no grade's unit
  list and in no public count; `topicsFor` never returns it. A bridge stair counts as missing only on evidence (needs
  support, a failed review, a confirmed misconception, an exam diagnostic or a failed floor check), never for not being
  started. The floor check (`/floor`) asks one diagnostic question of each bridge stair and two multiplication facts;
  a missed fractions question sets `learn.floor.on`, and only then does the unit appear on the map, first, labelled
  "יסודות" with no unit number. A missed fact offers `/facts`, a short practice that records nothing on any stair. The
  student can open the unit from Topics at any time and hide it from the map (`setFloor({ on: false })`) without losing
  the evidence.
- **The challenge track** (`learn/challenges/`): three optional tasks per topic, the floor included: a claim (always,
  sometimes or never, with a counterexample typed into named slots when one is asked), a proof to order with a reason
  per step or an error to find and fix, and a real-world task. Code grades every part: a counterexample is evaluated
  with `learn/expr.ts` in its domain, a proof is checked step by step (steps that may swap are a `free` group), typed
  numbers are compared exactly. Two tries per part, then the solution. A task opens when its stair is mastered. It
  gives XP once and counts for the day like a lesson, and never touches `learn.skills` or a check. An explain part is
  kept in component state only (not saved, not sent) and self-checked against a sample and a rubric.
- **Exam Rescue** starts with a 2-question diagnostic per stair, sorts stairs into strong / shaky / gap / untested,
  orders gaps (and stairs others lean on) first, and spreads learn → practice → mastery tasks over the days, with a
  practice exam on the last day. It is recomputed from the evidence every time, so it follows real performance. It
  never promises a grade.
- **Analytics** stay on the device: event type, stair, right or not. Metrics (independent mastery gain, misconception
  resolution rate, 7-day retained mastery, reviews, returns after 1/7/30 days, adoption) show "not enough data" below
  3 cases. Time in the app is not a learning metric.

## Content authoring conventions (`web/src/learn/content/<topic>.ts`)

Each stair is a `StairContent` (types.ts). The tests in `content.test.ts` check every stair automatically.

1. **Its own strategy.** Choose the representation that makes *this* idea visible (number line, grid, a ray that
   turns, squares on the sides, bars that move). No shared template sentences: ideas and "why" texts must differ
   (tested).
2. **Discover (A):** 6–10 short steps. Intuition first, then a prediction (`predict`), something to move (`explore`,
   reusing the `components/manip` kinds), and only then the rule (`rule`) with *why* it works. At least one predict
   and one rule (tested). Explore goals must be reachable and not already true at the start (tested). A numberline
   explore's `display` must evaluate to its answer (tested).
3. **Examples (B):** at least 2, each step = action + why + result. Steps that rewrite the problem carry `value` (must
   equal the answer); side computations carry `calc` (checked). Use a context in the second example.
4. **Together (C):** choose-the-next-step questions, one right choice, feedback on every choice, two hints that get
   stronger; the last move is the student's (a typed number, checked by `check`).
5. **Diagnostic model:** `params(rnd)` (use `rint`/`rnz` from expr.ts), `answer`, and `bugs`: for each misconception,
   the answer it predicts (null when it does not apply). Every bug must show on at least 4% of questions, and every pair
   must be distinguishable (tested). `solution(p)` must reach the answer (tested). `transfer` is the same skill with an
   unfamiliar surface (a story, a table).
6. **Misconceptions:** every bug has one (tested), with `cause`, a targeted `explain`, an interactive `remedy`, and an
   entry in the topic's `cats` (content/grade7.js, grade8.js, linear.js) so the board can name it. Reuse the ids the
   generators' `diag()` already returns, so older exercises count as evidence.
7. **Hebrew:** short sentences, plural address (as the rest of the app), maths between `$…$`; a minus inside Hebrew
   text is TeX (`$-3$`), never a bare hyphen.

## Status (checkpoint 3)

| Phase | State |
|---|---|
| 1. Audit, baseline, architecture | done |
| 2. Flagship lesson (signed:1, subtracting negatives) | done: stages A–E, six misconceptions with targeted repairs, transfer questions, verification |
| 3. Engines | done and unit-tested |
| 4. Home, daily mission, Exam Rescue | done: home leads with today's mission, the exam button and a mastery map; the mission screen; Exam Rescue from inputs to a plan that follows performance |
| 5. Content for every stair | done: authored per topic, each stair with its own strategy, then checked (below) |
| 6. QA and staging | done for this checkpoint (see QA_AUDIT.md, round 8) |
| 7. Curriculum stage 1 | done: the programme map and `/programme`, the fraction bar, double number line and fractions on number lines, the floor (frac:1–4, the floor check, multiplication facts), signed:6, ratio and percent for grade 8, the one ranked "what next", the challenge track |

### Screens and routes added

| Route | What |
|---|---|
| `#/` | home: today's mission (one clear next action, each part with its reason), "יש לי מבחן בקרוב", the mastery map, then the map |
| `#/learn/:topic/:level` | the stair's journey: five stages, the mastery state and its rules, what still confuses, the tutor |
| `#/learn/:topic/:level/A`, `/B`, `/C` | understand, worked examples, solve together (the place is saved: closing needs no warning) |
| `#/lesson/:topic/:level?kind=check&purpose=mastery\|review\|verify` | checks without hints, one try each |
| `#/repair/:topic/:level/:misc` | a misconception's own explanation and activity, then its verification |
| `#/mission` | today's mission |
| `#/rescue`, `#/rescue/check`, `#/rescue/exam` | Exam Rescue: setup, diagnostic, plan, practice exam |
| `#/me` | adds "הלמידה שלי במספרים" and full data deletion |
| `#/programme` | what the app teaches of the Ministry's programme, unit by unit, for each grade (opens with no profile too) |
| `#/floor`, `#/facts` | the floor check, and the multiplication-facts practice it can offer |
| `#/challenge/:id` | a challenge task, part by part, outside the tab bar like a lesson |
| `#/plan` | retired: redirects to `#/quests`, where "מה לחזק אחרי המבחן" lists the plan's exam losses |

### The stairs

Every stair below has its discover steps, worked examples, solve-together problems, a diagnostic model, a transfer
model and its misconceptions, each with a cause, a targeted explanation and an interactive repair. "Complete, tested"
means: `content.test.ts` checks the maths of every step and the misconception models; `checks.test.ts` runs a mastery
check, a review and a verification for every misconception on the stair; `e2e/teach-all.spec.js` completes the
stair's teaching (A–C) in the browser. The rows marked יסודות are the floor: a bridge unit below grade 7, counted in
neither grade. The table is the code's: `learn/claims.test.ts` compares every row with the stair's content (title,
discover steps and the objects moved in them, examples, solve-together problems, misconceptions, transfer) and prints
the row to paste when one differs.

| Stair | Title | Discover steps (objects to move) | Worked examples | Solve together | Misconceptions (ids) | Transfer | Status |
|---|---|---|---|---|---|---|---|
| frac:1 | שבר ושברים שווים | 8 (numberline, fbar) | 3 | 2 | 3 (count-marks, whole-line, add-same) | yes | יסודות; complete, tested |
| frac:2 | השוואת שברים ועשרוניים | 8 (pins) | 2 | 2 | 3 (longer-larger, shorter-larger, bigger-den) | yes | יסודות; complete, tested |
| frac:3 | חיבור וחיסור שברים | 8 (fbar) | 3 | 2 | 2 (add-across, num-not-scaled) | yes | יסודות; complete, tested |
| frac:4 | כפל וחילוק שברים | 8 (numberline) | 3 | 2 | 3 (keep-den, divide-flip, mult-bigger) | yes | יסודות; complete, tested |
| signed:1 | חיבור וחיסור | 10 (numberline) | 2 | 2 | 6 (minus-minus, sign, abs-add, drop-sign, neg-neg-plus, direction) | yes | complete, tested |
| signed:2 | השוואת מספרים | 10 (pins, numberline) | 2 | 2 | 2 (neg-compare, ignore-sign) | yes | complete, tested |
| signed:3 | כפל וחילוק | 10 (numberline) | 2 | 2 | 3 (sign, add-sign, neg-many) | yes | complete, tested |
| signed:4 | סדר פעולות | 10 (numberline) | 2 | 2 | 3 (order, minus-minus, mul-sign) | yes | complete, tested |
| signed:5 | סוגריים | 10 (numberline) | 2 | 2 | 4 (minus-bracket, ignore-brackets, order, minus-minus) | yes | complete, tested |
| signed:6 | שברים ועשרוניים מכוונים | 8 (numberline) | 3 | 2 | 4 (abs-add, minus-minus, sign, toward-zero) | yes | complete, tested |
| coord:1 | קריאת נקודה | 10 (plot) | 2 | 2 | 3 (swap, sign, axis-zero) | yes | complete, tested |
| coord:2 | רביעים | 10 (plot) | 2 | 2 | 4 (swap, quad-order, sign, axis-quadrant) | yes | complete, tested |
| coord:3 | אורך קטע | 9 (plot) | 2 | 2 | 3 (add-coords, sign, coord-length) | yes | complete, tested |
| coord:4 | שטח מלבן | 9 (plot) | 2 | 2 | 4 (perimeter, add-sides, add-coords, coord-length) | yes | complete, tested |
| coord:5 | קודקוד חסר | 10 (plot) | 2 | 2 | 4 (swap, wrong-neighbour, coord-length, sign) | yes | complete, tested |
| angles:1 | זוויות צמודות | 10 (angle) | 2 | 2 | 4 (equal-not-supp, wrong-total, sum-360, one-angle) | yes | complete, tested |
| angles:2 | זוויות קודקודיות | 10 (angle) | 2 | 2 | 3 (supp-not-equal, equal-not-supp, wrong-total) | yes | complete, tested |
| angles:3 | סכום זוויות במשולש | 10 (triangle, angle) | 2 | 2 | 2 (sum-360, one-angle) | yes | complete, tested |
| angles:4 | ישרים מקבילים | 10 (angle) | 2 | 2 | 2 (supp-not-equal, equal-not-supp) | yes | complete, tested |
| angles:5 | שווה־שוקיים וזווית חיצונית | 10 (angle) | 2 | 2 | 4 (forgot-half, one-angle, apex-base-swap, interior-not-exterior) | yes | complete, tested |
| expr:1 | הצבה בביטוי | 8 (numberline) | 3 | 2 | 3 (concat, order, neg-sub) | yes | complete, tested |
| expr:2 | כותבים ביטוי | 8 | 2 | 2 | 5 (start-n, diff-only, whole-object, reversal, times-plus) | yes | complete, tested |
| expr:3 | כינוס איברים דומים | 9 (tiles) | 2 | 2 | 3 (conjoin, detach, drop-minus) | yes | complete, tested |
| expr:4 | חוק הפילוג | 9 (area) | 3 | 2 | 2 (partial-dist, minus-bracket) | yes | complete, tested |
| expr:5 | פישוט ביטויים | 8 (tiles) | 3 | 2 | 3 (partial-dist, minus-bracket, conjoin) | yes | complete, tested |
| data:1 | דיאגרמות וטבלת שכיחויות | 8 (chart) | 3 | 2 | 5 (scale-units, one-value, icon-count, half-icon, truncated-axis) | yes | complete, tested |
| data:2 | שכיחות יחסית | 8 (fbar) | 2 | 2 | 7 (part-part, bigger-count, freq-only, inverse-ratio, per-category, pct-for-dec, div-by-rel) | yes | complete, tested |
| data:3 | אחוזים ודיאגרמת עוגה | 8 (chart) | 3 | 2 | 6 (count-as-pct, div-by-pct, pct-of-part, stop-at-one, inverse-ratio, pie-not-whole) | yes | complete, tested |
| data:4 | הסתברות מתוך שכיחות | 8 (simulate) | 3 | 2 | 8 (equiprob, part-part, old-total, new-not-counted, old-rel, rel-not-scaled, draws-as-count, small-sample) | yes | complete, tested |
| eq:1 | משוואה ופתרון | 10 (balance) | 3 | 2 | 4 (move-no-flip, divide-flip, sign, sub-coef) | yes | complete, tested |
| eq:2 | משוואה בשני צעדים | 10 (balance) | 3 | 2 | 4 (move-no-flip, divide-part, sign, sub-coef) | yes | complete, tested |
| eq:3 | נעלם בשני האגפים | 9 (balance) | 2 | 2 | 2 (move-no-flip, move-x-no-flip) | yes | complete, tested |
| eq:4 | משוואות עם סוגריים | 9 (area) | 2 | 2 | 2 (partial-dist, minus-bracket) | yes | complete, tested |
| eq:5 | בעיות מילוליות | 9 (balance) | 2 | 2 | 3 (wrong-unknown, partial-dist, reversal) | yes | complete, tested |
| ratio:1 | יחס | 8 (fbar) | 2 | 2 | 3 (reversed-ratio, part-whole, add-same) | yes | complete, tested |
| ratio:2 | חלוקה ביחס | 8 (fbar) | 2 | 2 | 3 (reversed-ratio, part-whole, whole-perimeter) | yes | complete, tested |
| ratio:3 | פרופורציה | 8 (dline) | 2 | 2 | 2 (additive, divide-flip) | yes | complete, tested |
| ratio:4 | קנה מידה | 8 (dline) | 2 | 2 | 3 (no-convert, cm-km, linear-area) | yes | complete, tested |
| pct:1 | מהו אחוז | 8 (fbar) | 3 | 2 | 2 (count-as-pct, digit-pct) | yes | complete, tested |
| pct:2 | אחוז מכמות | 8 (dline) | 3 | 2 | 2 (count-as-pct, div-by-pct) | yes | complete, tested |
| pct:3 | איזה אחוז? | 8 (dline) | 2 | 2 | 2 (inverse-ratio, count-as-pct) | yes | complete, tested |
| pct:4 | מציאת השלם | 8 (dline) | 2 | 2 | 2 (pct-of-part, stop-at-one) | yes | complete, tested |
| pct:5 | הגדלה והקטנה באחוזים | 8 (dline) | 3 | 2 | 4 (add-pct, change-only, additive-changes, pct-of-new) | yes | complete, tested |
| line:1 | טבלת ערכים | 10 (plot) | 2 | 2 | 4 (forgot-b, neg-sub, added-m, proportional) | yes | complete, tested |
| line:2 | מה אומרים m ו־b | 10 (line) | 2 | 2 | 6 (m-b, sign, hidden-one, b-first, rise-only, sign-from-b) | yes | complete, tested |
| line:3 | שיפוע מהגרף: מדרגות | 10 (plot) | 2 | 2 | 3 (inverse, sign, rise-only) | yes | complete, tested |
| line:4 | שיפוע בין שתי נקודות | 10 (plot) | 2 | 2 | 3 (inverse, mixed-order, minus-minus) | yes | complete, tested |
| line:5 | משוואת ישר | 10 (line, plot) | 2 | 2 | 4 (b-is-y, move-no-flip, b-sign, swap) | yes | complete, tested |
| line:6 | חיתוך עם הצירים | 10 (plot) | 2 | 2 | 3 (sign, no-divide, axes-mixed) | yes | complete, tested |
| line:7 | משולש עם הצירים | 10 (plot, line) | 2 | 2 | 4 (no-half, added-sides, neg-length, no-divide) | yes | complete, tested |
| line:8 | נקודת מפגש של שני ישרים | 10 (plot) | 2 | 2 | 4 (move-no-flip, sign, no-divide, forgot-y) | yes | complete, tested |
| pyth:1 | מציאת היתר | 10 (squares) | 2 | 2 | 2 (add-legs, no-root) | yes | complete, tested |
| pyth:2 | מציאת ניצב | 10 (squares) | 2 | 2 | 3 (add-not-sub, subtract-sides, no-root) | yes | complete, tested |
| pyth:3 | האם המשולש ישר־זווית? | 10 (triangle, squares) | 2 | 2 | 3 (wrong-hyp, assume-right, add-legs) | yes | complete, tested |
| pyth:4 | שאלה מילולית | 10 (squares) | 2 | 2 | 5 (add-legs, no-root, wrong-hyp, add-not-sub, subtract-sides) | yes | complete, tested |
| pyth:5 | מרחק בין נקודות | 10 (plot, squares) | 2 | 1 | 3 (add-legs, no-root, coord-diff) | yes | complete, tested |
| stats:1 | שכיח | 10 (pins) | 2 | 2 | 3 (mode-max, mode-count, mode-median) | yes | complete, tested |
| stats:2 | חציון | 10 (bars, pins) | 2 | 2 | 4 (unsorted, mean-not-median, one-middle, median-position) | yes | complete, tested |
| stats:3 | ממוצע | 10 (bars) | 2 | 2 | 4 (mean-as-answer, no-divide, median-not-mean, midrange) | yes | complete, tested |
| stats:4 | ממוצע מטבלה | 9 (pins) | 2 | 2 | 5 (ignore-freq, wrong-count, no-divide, freq-as-data, skip-zero) | yes | complete, tested |
| stats:5 | נתון חסר | 9 (bars) | 2 | 2 | 2 (mean-as-answer, known-count) | yes | complete, tested |
| sys:1 | משוואות עם אחוזים | 7 | 3 | 2 | 2 (pct-of-new, wrong-unknown) | yes | complete, tested |
| sys:2 | שיטת ההצבה | 9 (plot) | 3 | 2 | 3 (partial-dist, forgot-y, swap) | yes | complete, tested |
| sys:3 | השוואת מקדמים | 10 (plot) | 3 | 2 | 3 (minus-bracket, forgot-y, swap) | yes | complete, tested |
| sys:4 | בעיות עם שני נעלמים | 9 (plot) | 2 | 2 | 2 (wrong-unknown, partial-dist) | yes | complete, tested |
| sys:5 | אי־שוויונות | 10 (ray, pins) | 3 | 2 | 4 (no-flip, over-flip, boundary, move-no-flip) | yes | complete, tested |

### What needs a server or an AI (not on staging, which runs without a server)

- **The AI tutor (Claude).** The tutor on staging answers from authored content and says so ("העוזר החכם לא מחובר בגרסה
  הזאת"). With the existing Cloudflare Worker and a key on the server, the lesson and the tutor sheet offer the AI as a
  separate button; the key never reaches the browser.
- **Exam topics from a photo.** Needs the AI on the server; staging offers manual selection and says why.
- **Class, teacher dashboard, sync.** Existing features that need the server; unchanged.
- **Analytics across students.** By design the learning metrics stay on the device. Product-level metrics (retention
  after 1/7/30 days across users) would need a privacy-reviewed server endpoint and consent; none is built.

### Known limitations

- **Not checked against real students.** Automated tests show the content is correct, complete and usable; they cannot
  show that students learn from it. A consent-based pilot is proposed below.
- **Curriculum alignment** is checked unit by unit against the Ministry's teaching schedules (`shared/programme.js`:
  every unit, its hours and months, and the stairs that teach each part). `PROGRAMME.md`, generated by
  `npm run programme:md`, shows what is taught, partly taught and not yet, and the app's `/programme` page shows the same
  numbers; neither is typed by hand. Today they read "במדרגות יש כבר את החומר של 117 מתוך 150 שעות ההוראה של כיתה ז׳
  (78%)." and "במדרגות יש כבר את החומר של 66 מתוך 147 שעות ההוראה של כיתה ח׳ (45%)." (`learn/claims.test.ts` checks
  every quoted sentence against the code). A few authored items go slightly beyond the old generators (three-factor products in
  signed:3, side-length questions in coord:5, a "30° larger" problem in angles:1).
- **Some misconceptions are research-based rather than observed in Israeli classrooms** (e.g. proportional reasoning
  in line:1, midrange in stats:3, clockwise quadrant numbering in coord:2). They only act on evidence from at least two
  questions.
- **Drawings in teaching steps.** Every discover step of the floor, signed:6, ratio and percent has a drawing or an
  object to move (tested), and every step that names a shape shows it; other steps of the older units rely on the
  interactive objects and words.
- **The tutor without a server** answers six question types from content; it does not understand free text.

### Recommended before release: a small student pilot

With consent from parents and the school, 8–12 students in grades 7–8, two stairs each (one taught, one a review),
in two short sessions a week apart: a 5-question pre-check, the stair's journey, the mastery check, and a 3-question
recall a week later; plus a 2-minute think-aloud on one misconception repair. Measure: independent mastery gain, the
share of repaired misconceptions that stay resolved at the recall, time to finish each stage, and where students
stop. Fix what they show before the public site.
