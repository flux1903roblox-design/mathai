# QA_MEASURE: curriculum stage 2, measurement, with evidence

The proof pack of the stage-2 lane (`finish/specs/stage2.md`, MEASURE-1 to MEASURE-8): areas and perimeters, boxes
and prisms (ז׳ 7.12 and 7.13), the circle, the cylinder and the cone, and Pythagoras in space (ח׳ 8.4 and 8.17). It
answers two council findings: learning (critical) "Curriculum coverage is about 30% of the ז-ח programme" and buyers
(critical) "… ratio, probability and area/volume are missing" (CURRICULUM-8). Every number below was computed on the
branch by the command named beside it; nothing is typed from memory.

What the stage moved, as `/programme` and `PROGRAMME.md` compute it (`shared/coverage.js`):

| | ז׳ | ח׳ | ז׳–ח׳ |
|---|---|---|---|
| before the stage (`b347414`) | 104/150 (69%) | 66/147 (45%) | 170/297 (57%) |
| after the stage | 122/150 (81%) | 78/147 (53%) | 200/297 (67%) |
| after the stage and the classroom lane's `signed:7`, `angles:6`, `angles:7` | 128/150 (85%) | 78/147 (53%) | 206/297 (69%) |

## 1. How to check it yourself

From `madregot/` on a checkout of the branch (no server, no AI key, no network: the tests use stand-ins):

| What | Command | Expected |
|---|---|---|
| Worker | `cd worker && node --test test/*.test.js` | all pass (`coverage.test.js` holds the stage's fixture: ז׳ 122, ח׳ 78) |
| Web unit | `cd web && npx vitest run` | all pass |
| Types, colours | `cd web && npm run typecheck && npm run lint:colors` | no error |
| Build and budget | `cd web && npm run build` | `check-dist` and `check-budget` pass |
| Generated docs | `cd web && npm run programme:check` | `PROGRAMME.md` and `store/counts.json` are what the code gives |
| The phone suite | `cd web && npx playwright test -c e2e/playwright.config.js --project=phone` | all pass |
| The stage's objects and layouts on the smallest phone | `… --project=phone-small manip.spec.js layout.spec.js identity.spec.js` | all pass |

Another copy of the repo runs the browser suite on its own port: `E2E_PORT=4431 npx playwright …`.

## 2. The lane's commits

| Commit | What | Spec items |
|---|---|---|
| `e7ebd52` | answers with π (`after`, the number before π typed) and with π ≈ 3.14 (`pk`) on every answer surface: lesson, practice exam, class exam, challenge; decimals for the four topics; the `'pi-value'` note | MEASURE-1.4, §0.5 |
| `68d23de` | the `polygon` object (`GridShape.jsx`, `content/grid.js`: rect, maxArea, move, cut, apex) and the `geo` grid, circles, arcs and tones | MEASURE-1.1, 1.5 |
| `a4fcd31` | the `net` object (`NetFold.jsx`, `content/net.js`: fold, face, fix, build) and the `netfig` figure | MEASURE-1.2, 1.5 |
| `dcaaf00` | the `circle` object (`CircleRoll.jsx`, `content/roll.js`: roll, slice) and the `solid` figure | MEASURE-1.3, 1.5 |
| `306889d` | a programme part's own months (`monthIndex`), π, ≈, ℓ and ∢ in `shared/plain.js` | MEASURE-6.1, 6.3 |
| `ea8108d`, `92dccd0` | `area:1-5`: generators, models, labels; teaching, the ז׳ path, three challenges, 7.12 | MEASURE-2, -6, -7 |
| `7cdcae6`, `464ca56` | `solid:1-4`: generators, models, nets, labels; teaching, the ז׳ path, three challenges, 7.13 | MEASURE-3, -6, -7 |
| `8441bb3`, `aa60039` | `circle:1-4`: generators, π models, labels; teaching, the ח׳ path, three challenges, 8.4 | MEASURE-4, -6, -7 |
| `4a068ee` | `space:1-2`: the whole topic, the ח׳ path, three challenges, 8.17 | MEASURE-5, -6, -7 |
| `acfa79b` | the proof pack: the full run, the live screenshots, this note, the merge notes, MEASURE-8's owner action; and what the run and the pictures found: `programme:check` exited 1 on a clean tree, the objects' lines were too dark to see in dark mode, the last unit of ח׳ had one drawing beside its path, a `learn.spec` selector matched two units, two pictures of the teacher's student sheet were stale | build order 7, MEASURE-1, -6, -8 |
| the review fix | the stage-2 review's eight findings and its six missing items (section 11) | MEASURE-1.4, -1, -2..5, -7, -8 |

## 3. What was built

- **Three objects** every later geometry stage can use, each with a way that needs no drag (Steppers of 44 px, arrow keys,
  a tap on a grid line, a slot or a face), a live readout that a check hides, `aria-valuetext`, colours from tokens only,
  and no autoplay with reduced motion: `polygon` (build a rectangle, slide the cut-off triangle of a parallelogram, cut an
  L into two rectangles, slide a triangle's top vertex between parallels), `net` (fold a box, a prism or a cylinder a
  quarter at a time, pick the face opposite, place the missing face, build a box or a prism from unit cubes), `circle`
  (roll one turn along a line marked in diameters, cut the disc into 4 to 32 sectors).
- **Two figures**: `solid` (box, cube, prism, cylinder, cone in oblique view, with layers of cubes, an inner solid, a
  diagonal, the axial section and lettered segments) and `netfig` (a still net with letters and lengths); `geo` gained
  a grid under a shape, circles and arcs, a cut-off tone and an added tone. Every number a figure draws is in its words
  (`figWords`), so the tutor, an answer key and the guessers read it.
- **Answers with π**: a row `□ π` where the number before π is typed, and questions with π ≈ 3.14 rounded to tenths
  that also accept the calculator's π. A whole value typed into a π row (31.4 for 10π) is told the form and the question
  stays open; nothing right is marked wrong.
- **Four topics, 15 stairs** to stage 1's depth: eight discover steps (each with a figure or an object), three worked
  examples, two solve-together problems, a diagnostic and a transfer model of documented errors per stair (30 models,
  ported unchanged from the spec's `models.mjs`), practice kinds with honest labels, checks a guesser passes under 2%,
  and twelve challenge tasks (a claim, an error and a real-world task per topic).
- **The programme**: 7.12, 7.13, 8.4 and 8.17 are taught, each part with its own months, so the plan never offers the
  parallelogram (April) or the prism (May) as "taught by now" in December. Only 7.6 still waits for `S2`: its powers
  are the classroom lane's `signed:7` (CLASSROOM-5).

## 4. The tests

**Unit** (vitest and the worker's node tests; every new stair is also checked by the suites that read `STAIRS`):
`content/manip.test.js` (every mode of the three objects: solution right, wrong value wrong, reachable by Steppers
alone, a net folds closed only from the right slots, nothing undefined, a check hides the asked quantity),
`content/util.test.js` (the π and 3.14 table, `'pi-value'`, `answerText` of decimals), `content/content.test.js` (300
draws a level, colours of neighbouring units, scenery, every kind read back from its text), `content/labels.test.js`
(every new label against its property), `learn/content.test.ts` (journeys, models: every bug above 4%, pairs told
apart, explained, together diagnosis), `learn/guessing.test.ts`, `learn/checks.test.ts`, `learn/figures.test.ts`,
`learn/challenges.test.ts`, `learn/programme.test.ts` and `learn/next.test.ts` (part months: `area:4` in April says
באפריל), `learn/engines.test.ts`, `learn/claims.test.ts`, `lib/exam.test.js` and `lib/examGrade.test.js` (π rows in
both exams), `components/challenge/NumPart.test.jsx`, `worker/test/coverage.test.js` (the `STAGE2` fixture),
`worker/test/pedagogy.test.js` (the four ways and the stable block).

**End to end** (`web/e2e/`):
- `manip.spec.js`: the grid object on a 320×568 phone (tall enough, its corner dragged, no sideways scroll); the net
  object folded to 100% by its Stepper (solid:1 discover 2); the net at 320×568 (Steppers thumb-sized, no sideways
  scroll while it folds); the net in practice (a tap on the face opposite the shaded one); the circle rolled one turn
  (a little past three diameters); the circle at 320×568.
- `layout.spec.js`: a triangle whose height falls outside it, a cylinder's volume with π, a disc with π ≈ 3.14, a box's
  diagonal and the three lettered segments, each on phone and phone-small; the class's right triangle after 6.5 twice
  (CLASSROOM-13's lines, nothing cut at 320 px); the cube net at 320×568 (every face a thumb target); the π answer row
  at 320×568 (`□ π סמ״ק` on one line, the whole value noted, then the number before π right).
- `challenge.spec.js` walks the twelve new tasks at 320 px; `teach-all.spec.js` teaches every new stair from start to
  end, fits its worked examples on a 320 phone and finds a drawing on every step; `learn.spec.js` lists the new ז׳
  topics.

## 5. This stage's run

Run on 11-12 November 2026 on this branch, on a machine whose load stayed between 29 and 37 on four CPUs (five lanes
building at once). Every number is from the run's own output.

| Suite | Result |
|---|---|
| Worker (`node --test test/*.test.js`) | 807 tests: 806 pass, 1 skipped, 0 fail |
| Web unit, whole (`npx vitest run`) | 133 files, 3,475 tests: 3,466 pass; 9 failed on the 5-second test timeout under load, in 8 files (`content.test.js` sys 4-5 generators, `checks.test.ts` and `content.test.ts` expr:2, `figures.test.ts`, `durable/merge.test.js`, `parent.test.js`, `report.test.js`, `teacher.test.js`) |
| Web unit, those 8 files again alone (`--testTimeout=60000`), with `claims.test.ts` and the new `programme-md.test.mjs` | 10 files, 1,258 tests, all pass |
| `styles/styles.test.js` after the colour change | 50 tests (one new), all pass |
| `npm run typecheck`, `npm run lint:colors` | clean; 205 files, every colour a token |
| `npm run build` | `check-dist` clean; boot JS 470.9 KB (gate 494), render-blocking CSS 53.9 KB (gate 59), largest lazy chunk 77.0 KB (katex, gate 150), precache 5.09 MB (gate 5.12) |
| `npm run programme:check` | "up to date", exit 0 (exit 1 before this commit, below) |
| The whole phone suite, first run | stopped after 210 tests to fix what it had found: `identity.spec` (the last unit of ח׳ had one path drawing) and `learn.spec` (a selector that matched "פיתגורס במרחב" too) |
| The whole phone suite, on the final code | 744 tests: 721 passed, 21 skipped, 2 failed: `teacher.spec` `teacher-student-sheet` and `teacher-student-ai-off`, two pictures of the teacher's student sheet (below) |
| `teacher.spec` TEACHER-8 and TEACHER-9 on phone, phone-small, tablet and desktop, after the pictures were refreshed | 24 passed |
| phone-small: `manip.spec`, `layout.spec`, `identity.spec` | 78 passed, 3 skipped, 1 failed: the net at 320×568 scrolled sideways by 4 px while its step was still coming in; it passed 3 times of 3 alone, and the test now waits for the step to settle (below) |
| `manip.spec` on phone and phone-small after that | 68 passed, 2 skipped |
| The stage's new `manip.spec` and `layout.spec` cases in dark (390×844) | 14 passed. The repo's `phone-dark` project runs only `visual.spec` and `student-week.spec`, so these ran through a scratch config that reuses the repo's config with one dark phone project |
| The proof harness (section 7) | 20 passed, 4 skipped (`/programme` is shot at 390×844 only) |

Found by the run and fixed in this commit:
- **`npm run programme:check` exited 1 on a clean tree.** It printed "up to date", then vite-node closed its server
  under the late files `content/manip.js` asks for as it loads (`content/late.js`: the grid's rules and `Figure.jsx`),
  `ERR_CLOSED_SERVER`. The script now waits for those files before it ends, as the tests import them
  (`web/scripts/programme-md.mjs`). `web/scripts/programme-md.test.mjs` runs the check and wants exit 0 and no
  `ERR_CLOSED_SERVER`; with the wait removed it fails.
- **The last unit of ח׳ had one drawing beside its path** (`identity.spec`, section 7).
- **`learn.spec` "a stair mastered out of order"** found the Pythagoras unit by the word "פיתגורס", which "פיתגורס במרחב"
  also has; it now matches the whole title, "משפט פיתגורס".
- **Two pictures of the teacher's student sheet** (`teacher-student-sheet`, `teacher-student-ai-off`) no longer
  matched: a ז׳ student's sheet now lists "שטחים והיקפים" and "תיבה ומנסרה" between the algebraic expressions and the
  equations, and the signed numbers row has six squares, not five (signed:6 merged after these pictures were taken, so
  they were stale at `b347414` already). Looked at before and after, on every size, and refreshed, as the stage-3 lane
  did for its unit: `teacher-student-sheet` (phone, phone-small, tablet, desktop), `teacher-student-ai-off` and
  `teacher-student-ai-actions` (phone, tablet, desktop), `teacher-student-sheet-end` (tablet). Nothing else in them
  moved; the desktop ones also take the unit colours of the badges, which the old ones held within the tolerance.
- **The net and circle tests at 320×568** now wait until the step that comes in sits inside the screen before they
  check for sideways scroll (`manip.spec.js` `toFold`, `toRoll`): on a busy machine its card can still stick out for a
  moment. A page that really scrolls sideways still fails.

## 6. The spec's verification

`node verify.mjs` (the lane's spec folder, `scratchpad/lanes/stage2/spec/`; it reads the spec and the branch's
`shared/programme.js` and `shared/coverage.js`):

```
## 1. Models (4,000 draws each)
| model | answer range | whole | bug rates |
|---|---|---|---|
| area1 | 8..180 | 100% | perimeter 51%, add-sides 51%, area-for-perim 49%, two-sides 49% |
| area1T | 2..15 | 100% | one-side-perim 100%, perim-as-area 99% |
| area2 | 6..120 | 100% | no-half 100%, slant-as-height 100% |
| area2T | 4..15 | 100% | no-half 100%, half-twice 100% |
| area3 | 18..164 | 100% | no-subtract 100%, double-count 100% |
| area3T | 18..138 | 100% | no-subtract 100%, no-half 100% |
| area4 | 18..240 | 100% | no-half 100%, one-base 100%, slant-as-height 100% |
| area4T | 12..240 | 100% | slant-as-height 100%, half-para 100% |
| area5 | 22..52 | 100% | missing-sides 100%, area-for-perim 98% |
| area5T | 260..880 | 100% | no-convert 100%, two-sides 100% |
| solid1 | 52..724 | 100% | three-faces 100%, vol-for-surf 100% |
| solid1T | 40..614 | 100% | lid-counted 100%, vol-for-surf 100% |
| solid2 | 24..1320 | 100% | surf-for-vol 100%, add-edges 100% |
| solid2T | 24..270 | 100% | no-convert 100%, surf-for-vol 100% |
| solid3 | 84..920 | 100% | one-base 100%, missing-face 100% |
| solid3T | 104..1296 | 100% | one-base 100%, slant-as-height 100% |
| solid4 | 18..900 | 100% | no-half 100%, hyp-as-height 100% |
| solid4T | 12..720 | 100% | no-half 100%, slant-as-height 100% |
| circle1 | 2..30 | 100% | r-for-d 47%, area-for-circ 43%, d-for-r 53% |
| circle1T | 2..30 | 100% | r-for-d 47%, area-for-circ 43%, d-for-r 53% |
| circle2 | 9..144 | 100% | circ-for-area 100%, d-in-area 50% |
| circle2T | 5..125 | 100% | ring-sub-radii 100%, no-subtract 100% |
| circle3 | 12..2000 | 100% | d-in-area 100%, lateral-for-vol 89% |
| circle3T | 12..400 | 100% | r-for-d 100%, area-for-circ 89% |
| circle4 | 12..800 | 100% | no-third 100%, slant-as-height 100% |
| circle4T | 12..800 | 100% | no-third 100%, slant-as-height 100% |
| space1 | 3..33 | 100% | face-for-space 100%, add-edges3 100%, no-root 100% |
| space1T | 3..33 | 100% | face-for-space 100%, add-edges3 100% |
| space2 | 5..30 | 100% | r-for-d 100%, add-legs 100% |
| space2T | 5..225 | 100% | add-legs 100%, no-half 100% |

## 2. Guessing (mastery 4 of 5, review 3 of 3; limit 2%)
| stair | practice kinds in checks | most common (per question) | best constant | from the question | mastery pass | review pass |
|---|---|---|---|---|---|---|
| area:1 | ar1r, ar1m, ar1s | 9.0% / 5.4% / 10.7% | 11.0% | 0.0% | 2.4e-4 | 5.2e-4 |
| area:2 | ar2l, ar2t, ar2x, ar2g, ar2q | 7.1% / 5.1% / 11.5% | 10.9% | 0.0% | 1.4e-4 | 4.2e-4 |
| area:3 | ar3l, ar3t, ar3k, ar3u, ar3g | 4.0% / 2.7% / 2.2% | 2.7% | 0.0% | 5.9e-6 | 2.4e-5 |
| area:4 | ar4p, ar4t, ar4i | 6.1% / 4.9% / 6.0% | 6.3% | 0.0% | 5.5e-5 | 1.8e-4 |
| area:5 | ar5l, ar5p, ar5u, ar5x | 9.0% / 11.4% / 2.2% | 10.6% | 0.0% | 1.6e-4 | 2.3e-4 |
| solid:1 | so1s, so1c, so1e, so1o | 3.4% / 2.3% / 1.6% | 2.6% | 0.0% | 2.8e-6 | 1.2e-5 |
| solid:2 | so2v, so2m, so2c, so2l, so2f | 7.5% / 3.0% / 8.5% | 8.6% | 0.0% | 8.6e-5 | 1.9e-4 |
| solid:3 | so3s, so3h, so3l, so3i | 4.6% / 5.6% / 2.3% | 5.7% | 0.0% | 1.5e-5 | 5.8e-5 |
| solid:4 | so4v, so4a, so4m, so4h | 4.8% / 4.9% / 5.6% | 5.0% | 0.0% | 2.9e-5 | 1.3e-4 |
| circle:1 | ci1p, ci1n, ci1r, ci1w | 6.8% / 8.3% / 7.4% | 8.0% | 0.0% | 1.3e-4 | 4.2e-4 |
| circle:2 | ci2p, ci2n, ci2h, ci2r | 8.9% / 12.0% / 4.0% | 10.7% | 0.0% | 2.2e-4 | 4.3e-4 |
| circle:3 | ci3v, ci3l, ci3s, ci3f | 3.9% / 2.0% / 3.3% | 3.0% | 0.0% | 5.8e-6 | 2.5e-5 |
| circle:4 | ci4v, ci4h, ci4a, ci4c | 7.5% / 8.4% / 8.5% | 8.6% | 0.0% | 1.8e-4 | 5.4e-4 |
| space:1 | sp1s, sp1f, sp1c, sp1m | 10.0% / 13.7% / 14.5% | 15.2% | 0.0% | 8.0e-4 | 2.0e-3 |
| space:2 | sp2r, sp2t, sp2v, sp2p | 8.3% / 13.8% / 3.9% | 14.6% | 0.0% | 2.0e-4 | 4.4e-4 |

## 3. Worked numbers in the spec
examples and challenge answers 65, side computations 63, rewriting steps 45, together finals 30

## 4. Facts
279 facts
24 quoted model rates; the worst check passed by guessing: 0.20%

## 5. Coverage
parts marked later: 'S2' at b347414: 7.6 (4 h)
| skills | ז׳ | ח׳ | ז׳–ח׳ |
|---|---|---|---|
| b347414 (62 stairs) | 104/150 (69%) | 66/147 (45%) | 170/297 (57%) |
| + this stage | 122/150 (81%) | 78/147 (53%) | 200/297 (67%) |
| + classroom (signed:7, angles:6–7) | 110/150 (73%) | 66/147 (45%) | 176/297 (59%) |
| + classroom + this stage | 128/150 (85%) | 78/147 (53%) | 206/297 (69%) |
monthIndex: area:1 3, solid:1 4, circle:1 1, space:1 8

## Result: 120909 checks, 0 failed
```

Beside it, run on the branch: the per-topic fact checks (`facts-area.mjs` 41, `facts-area-teach.mjs` 190,
`facts-solid.mjs` 27, `facts-solid-teach.mjs` 168, `facts-circle.mjs` 29, `facts-circle-teach.mjs` 172,
`facts-space-teach.mjs` 113 facts, 0 wrong), and the port checks, which run the app's own models against the spec's
over the same seeded draws (area 40,000, solid 32,000, circle 32,000, space 16,000 draws, 0 differences).

## 7. The pictures

Taken from the real app (a production build with no server, as the public site runs), not from a page that shows the
objects alone: a scratch Playwright script opened each object on the discover step of a real stair, moved it with its
own Steppers and pressed the app's own check button. Every state was
asserted before it was shot (the readout or the Stepper's value, the check's answer), every shot was checked for
sideways scroll, and every picture was looked at. Committed as contact sheets in `qa-evidence/measure/` (in each object's sheet
the rows are 390×844, 320×568, 390×844 dark and 320×568 dark, and the columns are start, mid and solved):

| Sheet | What it shows |
|---|---|
| `polygon-start-mid-solved.jpg` | `area:1` discover 4, "בנו מלבן ששטחו 12 משבצות והיקפו 14": 2 × 2 (area 4, perimeter 8), 3 × 2 after one tap on רוחב (6, 10), 4 × 3 checked (12, 14): the rectangle and the frame turn green, the Steppers lock |
| `net-start-mid-solved.jpg` | `solid:1` discover 2, "קפלו את הפריסה עד שתיסגר תיבה": the cross open (0%), half folded (50%, the faces about their hinges), the box closed (100%) and checked |
| `circle-start-mid-solved.jpg` | `circle:1` discover 2, "גלגלו את העיגול סיבוב אחד על הקו": radius 2 on a line marked 0, 4, 8, 12, 16; half a turn (50%, the unrolled part in blue); one turn (100%), checked, the end a little past 12 with "≈ 3.14 קטרים" |
| `programme-7-and-8.jpg` | `/programme` at 390×844, light and dark: for ז׳ the sentence "במדרגות יש כבר את החומר של 122 מתוך 150 שעות ההוראה של כיתה ז׳ (81%)." and 7.12 and 7.13 as יש; for ח׳ "… 78 מתוך 147 … (53%)." and 8.4 and 8.17 as יש (each unit's chip asserted, and no gap line under it) |
| `path-space-390.jpg`, `path-space-390-dark.jpg` | the end of the ח׳ path: "פיתגורס במרחב", its two stairs, its review and its two drawings |

What looking at them found, and what changed in this commit:
- **Dark mode, the three objects' lines.** In a lesson, `--c-d` is the buttons' deep lip blue (`#0f3fae` in dark), and
  the three objects drew their grid lines, the moved piece, the cut, the height, the net's slots, the circle's outline,
  its sectors and the note "≈ 3.14 קטרים" in it: on the dark canvas the grid was almost invisible and the note read at
  about 1.8:1. They now use the unit's ink colour `--c-ink`, as the balance, the tiles and the area model already do. In
  light the two tokens are the same colour in every context that sets them, so nothing changes in light (`app.css`).
- **The last unit of ח׳ had one drawing beside its path, not two** (`identity.spec.js` failed on it in the full run):
  the second drawing came after the fourth stop, and "פיתגורס במרחב" has three (two stairs and its review). A short unit
  now has its second drawing after its last stop (`screens/Learn.jsx`); every other unit is unchanged.
- One frame of the first run (the grid at 320×568, light, at start) came out blank: the step was still coming in when
  it was shot, with the machine's load near 33. The harness now also waits until the step is fully opaque; all 36
  frames of the last run are whole.

## 8. For the merge

- **`ROADMAP_NEXT` stays `'S2'`** (`shared/programme.js`). This lane teaches every part it owns, but 7.6's four hours of
  powers still wait for CLASSROOM-5's `signed:7`, which is on the classroom lane. Whoever merges the last of this lane
  and CLASSROOM-5 sets `ROADMAP_NEXT` to the lowest stage that still has a `later` part (`'S3'` if stage 3 has not
  merged by then, otherwise the next one that still has one). `coverage.test.js` "the next stage" fails until it does:
  it asks that some part still waits for `ROADMAP_NEXT`.
- **At that merge, the coverage fixture** in `worker/test/coverage.test.js` gains the classroom lane's stairs:
  `const STAGE2_CLASSROOM = [...STAGE2, 'signed:7', 'angles:6', 'angles:7']`, with
  `coverage('7', STAGE2_CLASSROOM).taught === 128` (of 150, 85%) and `coverage('8', STAGE2_CLASSROOM).taught === 78`
  (of 147, 53%), both grades 206/297 (69%), as `verify.mjs` section 5 computes (it puts `signed:7` on 7.6's four hours
  of powers and `angles:6-7` on two of 7.10's four hours, out of its `S5` part, as `classroom.md` places them). The tests
  that run on `STAGE2` today ("every stair a part lists …", "the stages add up") run on the combined fixture, with
  `AFTER` recomputed from it; `COMPLETES.S2` becomes `[]`; and a new test asserts that **no part lists `later: 'S2'`**.
  The classroom lane's own `CLASSROOM` fixture (stage 1 plus `signed:7`, ז׳ 108) stays beside it.
- **Merge watch** (each said in its own commit): `web/budget.json` boot JS gate 494 KB (DURABLE-11's measured + 5%; another
  lane that grew boot JS takes the larger measured value + 5%); `worker/test/pedagogy.test.js` stable-block cap 24,000
  characters (regenerate the fixtures with `node test/fixtures/make-full-params.mjs` after any merge that touches the
  ways or the stairs); `TOPIC_ORDER`, `GRADE7`/`GRADE8`, `STAIRS`, `stairs.js`, `Scenery.jsx` and the challenge index
  keep every lane's insertions, and `content.test.js` re-checks the neighbouring units' colours; `COMPLETES.S2` is
  `['7.6']` until the classroom merge; `listing.test.mjs` compares each grade's topic line whole (a title has a comma).
- **Also changed in this commit**, for whoever merges near them: `web/scripts/programme-md.mjs` waits for the late files
  before it ends; `screens/Learn.jsx` places a short unit's second path drawing after its last stop (`artAfter`);
  `styles/app.css` draws the three objects' lines in `--c-ink`; `e2e/learn.spec.js` finds "משפט פיתגורס" by its whole
  title; eleven `teacher-student-*` pictures in `e2e/__screens__/` were refreshed (section 5). The stage-3 lane refreshed
  the same eleven for its data unit: at the merge, take neither, and refresh them once more on the merged app (each lane
  adds its own rows to the ז׳ sheet).
- **The review sheet** (MEASURE-8, below) is on this branch now: `web/scripts/review-sheet.mjs`, the `review:sheet`
  npm script, `.github/ISSUE_TEMPLATE/content-review.md` and the `review/` line of `madregot/.gitignore` are the stage-3
  lane's commit `e289e83`, unchanged, except that the script's `QUESTIONS` table gains three rows (`area`, `circle`,
  `space`, MEASURE-8's questions). Both branches add the file, so the merge of the second one shows a small conflict
  in `QUESTIONS`: keep both lanes' rows. The stage-3 lane's `review-sheet.test.mjs` (which reads the `data` topic) and
  its README and MADREGOT2 paragraphs arrive with that lane; this lane's own test is `review-sheet.measure.test.mjs`.

## 9. Owner-only: a teacher reads the stage before students do (MEASURE-8)

**The one action**: send the four topics to one ז׳–ח׳ maths teacher for review (about 2–3 hours a topic) and ask three
questions by name:
1. the order of `area:3` and `area:4`: composite shapes (December–January) before the parallelogram and the trapezoid
   (April), as the school year teaches them;
2. `space` (Pythagoras in space) as a two-stair unit of its own at the end of ח׳, rather than two more Pythagoras stairs;
3. whether answers with π should default to "with π" (typing 25 for 25π) or to π ≈ 3.14 rounded to tenths.

The comments go into issues, and the next build round fixes them first.

**The one command** (on this branch since the review fix):

```
cd madregot/web
npm run review:sheet -- area
npm run review:sheet -- solid
npm run review:sheet -- circle
npm run review:sheet -- space
```

It writes `madregot/review/area.html`, `solid.html`, `circle.html` and `space.html`: one printable right-to-left page a
unit, with every stair's objectives, discover steps and their drawings, worked examples, solve-together problems,
misconceptions and remedies, 20 practice exercises with answers and solutions, and the diagnostic models, an empty
comment column beside every block, and no student data. The `area`, `circle` and `space` sheets print the question
above for their unit. Send the four files; the comments go into issues with `.github/ISSUE_TEMPLATE/content-review.md`
(נושא, מדרגה, שלב / שאלה, מה לא תקין, הצעה). Generated on this branch for all four units: no `undefined`, no `NaN`, no
drawing that failed (`scripts/review-sheet.measure.test.mjs`).

## 10. Deferred, and why

- **`could` on the generator items (MEASURE-1 item 4's last sentence, CURRICULUM-11 item 2).** The readouts are done
  for this stage's three objects (section 11); `could` is not. Setting it on the stage's generators alone would make
  their right answers count against a suspected misconception at a model item's full weight: CURRICULUM-11 item 2 also
  adds the generator weight (`GENERATOR_COUNTER_WEIGHT` in `storeGlue.ts`, `gen` on the event) and the labels test's
  soundness and completeness properties over every generator of every topic. That is one change across all topics, the
  curriculum lane's; it is not on any branch yet.
- **The older objects' readouts** (the bars' mean, the squares' sum, the triangle's angle, the line's equation) on a
  practice first try are CURRICULUM-11 item 1 for those kinds; `readoutLine` (Manip.jsx) is where their lines go.
- **The teacher's reading itself (MEASURE-8)** is owner-only: the command above makes the sheets.
- **The classroom-lane coverage fixture and `ROADMAP_NEXT`** belong to the merge of this lane with CLASSROOM-5 (section
  8): before it, `signed:7` is not on this branch, and the fixture's stairs and the "no `later: 'S2'`" test would fail.
- **`sp2m`** (which triangle in a cone has a right angle) names its three triangles in words over the cone's drawing
  instead of drawing each one: it is practice-only multiple choice, and drawing three triangles needs a new cone option.
- **Older stairs' wide rules.** The review fix's e2e check (every display of every stair's stage A shows whole at 390
  and 320) passes for every stair, because a display still too wide at 60% now breaks after its = signs. For this
  lane's stairs the long rules are written on stacked lines; a few older ones (`signed:5`'s two bracket rules on one
  line, at 320) break after an = sign instead, which reads less well than two lines: stacking them is their own
  lanes' one-line change.
- **The spec's checks** (`verify.mjs`, the `facts-*.mjs` and `port-check-*.mjs`) and the full-size screenshots live in
  the lane's scratch folder, not in the repo: `verify.mjs` reads the spec, which is not in the repo either. Their output
  is in section 6 and in this commit's message; the contact sheets are committed.
- **Dark mode beyond this lane's objects.** The older objects (the number line's jump labels, the pins, the plot's
  guides) draw with the same `--c-d` and have the same low contrast in dark. Fixing them is a design-system change
  (`.lesson, .teach { --c-d }` in dark, or each object's rules), with the phone-dark visual baselines to look at again:
  not this lane's.
- **Load timeouts.** Under the machine's load (about 30-37 on four CPUs shared by five lanes) the full web unit run hits
  5-second test timeouts; this stage's run had 9 in 8 files, all passing when rerun alone (section 5). No existing
  test's timeout was raised (the one new test, which starts vite-node, has a 3-minute limit of its own).

## 11. The stage-2 review, fixed

The lane's review reproduced eight problems and named six items short of a 10. Each was checked again on the branch
first (all eight reproduced: by reading the code for the AI exercises, the exam sheet, the semicolons, `ar2q` and the
copy, and in the browser for the slot, the rule displays and solve-together), then fixed with a test that fails on the
code before the fix.

| Finding | Fix | Test that failed before |
|---|---|---|
| AI exercises with π: no π, the whole value marked wrong and recorded | `Assistant.jsx` GeneratedQuestion draws `after` beside the slot (left to right), the list's first □π exercise says what to type (`PI_NOTE`), and `partialOf` runs first: the whole value gets the lesson's note, the exercise stays open, nothing is recorded | `tutor.spec.js` "a □π exercise draws π, says what to type, and notes the whole value without counting it" |
| The 320 slot hid the last digits (251.2 as 251) | one number's slot is `clamp(96px, 32vw, 132px)` beside the check button, and a longer number is set smaller until it shows whole (down to 60%) | `layout.spec.js` "a 320×568 phone shows every digit of a measurement answer" (75.4, 251.2, 1080, 153.86, 1004.8), and the π-row test now checks the typed value shows |
| The printed exam had no π, so "180" read as 180 cm³ | the answer line is `תשובה: ____π` (left to right) and the unit after it, as the lesson's row; the key reads the number before the printed π | `flows.spec.js` "a practice exam on the circle prints π after the blank …" |
| `\;` with one backslash: "52; /·2" | the three strings fixed; the area:2 rule on stacked lines | `learn/contentText.test.js`: no one-backslash TeX spacing in any content source, no control character left by a lost `\f`, `\t`, `\v`, `\b` |
| Rule displays cut off (x = 1 for 13, "V = π·") | the cause was app-wide: under reduced motion every element has a 0.01 ms transition, so FitDisplay measured a display at its old size and set it too large. KaTeX's elements take no transition now (`tokens.css`); a display still too wide at 60% breaks after its = signs (`fit-wrap`); area:2, area:5 and space:2's rules are written on stacked lines | `teach-all.spec.js`: every display of stage A of every stair shows whole at 390 (the walk) and at 320 (the drawing walk); before the fix signed:3 failed at 390 and area:2 at 320 |
| `ar2q` said "outside the base" for a right triangle | three cases: inside (nothing said), above an end (the side standing on that end, a right triangle), outside | `content.test.js` the area:2 grid triangle's solution wording, per case |
| Solve-together: the whole value shown as "כמעט" in red | its own calm tone, `note` (brand blue, an i), titled "נכון, בצורה אחרת", with the lesson's words | `learn.spec.js` "solve together: the whole value in a □π step is noted calmly" |
| "הארוכה ובולטת", "מדף נייר" | "הארוכה והבולטת", "מגלגלים דף נייר … לגליל" | `contentText.test.js` "copy the review corrected" |

| Item short of a 10 | Now |
|---|---|
| MEASURE-1.4, everywhere a typed answer is shown or graded | the AI's exercises and the printed exam draw the π row (above); the lesson's, solving together's, a challenge's and the exercises' note is one text (`content/partial.js`) |
| MEASURE-1, "nothing right is marked wrong on a 320 phone" | the slot (above) |
| MEASURE-1.4 readouts | a practice first try of the grid's rectangle (`ar1b`, `ar5b`), the net's build (`so2b`, `so4b`) and the circle (`ci1m`, `ci2m`) hides the readout of the quantity asked, as a check does; after a miss (an answer with help) it shows, and the feedback says so: `readoutLine` in `Manip.jsx` ("עכשיו רואים גם את השטח ואת ההיקף. נסו שוב." and the others). Tests: `components/manip/readout.test.js` (every stage-2 object exercise has a line exactly when its readout hides something) and `manip.spec.js` "a practice first try hides the grid's area and perimeter". `could` on generator items stays deferred (section 10) |
| MEASURE-8, one command | `npm run review:sheet -- area` and the rest (section 9) |
| MEASURE-7 `space:c3` as a `netfig` | the box's whole net, the front face and the lid shaded (one 6 by 8 rectangle), their words beside the ant's straight way from the front's bottom corner to the lid's far corner: `netfig` gained `names` and `path`, said in its words (`manip.test.js`, `challenges.test.ts`) |
| Proof for MEASURE-2..5 displays | the `teach-all.spec.js` check above |

Pictures looked at (scratch folder `lanes/stage2/shots/fix/`): the AI exercise with π and its note (390), the slot with
1004.8 at 320, the exam's π line, the solve-together note at 320, the area:2, area:5 and space:2 rules at 390 and 320,
the readout on a first try and after a miss, the ant's net at 390 and 320 (at 320 the challenge's story keeps every
drawing within 22% of the screen's height, so the net's numbers are small there, as every story drawing's are).
