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
| Stairs | 33: signed 5, coord 5, angles 5, line 8, pyth 5, stats 5 (each a generator with a `diag()` category per wrong answer) |

## Where things live

```
web/src/learn/                 the learning model: pure TypeScript, no React, all unit-tested
  types.ts                     the contract (content, learner state, actions)
  expr.ts                      a safe arithmetic evaluator + a seeded random source
  skills.ts                    33 skills (one per stair) and the prerequisite graph, with the reason for each edge
  mastery.ts                   evidence → state (not started … needs review), mastery checks, spaced reviews
  misconceptions.ts            diagnosis by prediction, slips, evidence, confirmation, discriminating questions, repair
  recommend.ts                 what to do next, ranked, each with a reason; the smallest missing prerequisite
  mission.ts                   the daily ~5-minute mission
  examRescue.ts                Exam Rescue: diagnostic, standing per stair, day-by-day plan, message
  tutor.ts                     the tutor without a model: six intents answered from content
  analytics.ts                 local events and the outcome metrics (with a minimum sample)
  items.ts                     exercises from diagnostic models; the plan of each kind of check
  storeGlue.ts                 store transitions + the v1 → v2 migration
  content/index.ts             the registry: CONTENT['signed:1'] …
  content/<topic>.ts           the stairs of a topic
web/src/lib/lesson.js          the lesson engine (+ kind 'check': mastery | review | verify | diagnostic | exam)
web/src/lib/store.js           zustand persist, version 2 (adds `learn`, removes nothing)
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
- **What next** (recommend.ts): exam within 14 days > confirmed misconception > due review > smallest missing
  prerequisite of a stair that is hard > continue the stair in progress > the next new stair. Every action carries
  its reason. A prerequisite counts as missing only on evidence (or, in the student's own grade, never started and not
  passed on the map); stairs passed on the old map count as known.
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

## Status

| Phase | State |
|---|---|
| 1. Audit, baseline, architecture | done |
| 2. Flagship lesson (signed:1, subtracting negatives) | content done and tested; screens in progress |
| 3. Engines | done and unit-tested (prerequisites, misconceptions, mastery, reviews, recommendations, mission, Exam Rescue, tutor, analytics, checks, migration) |
| 4. Home, daily mission, Exam Rescue screens | not started |
| 5. Content for the other 32 stairs | not started |
| 6. Full QA, staging | not started |

Known gaps at this checkpoint: the visual baselines in `web/e2e/__screens__` still show the coral Madi from
`dcd44c3` (Madi is purple again, as the brief asks); they are regenerated after review once the 2.0 screens exist.
