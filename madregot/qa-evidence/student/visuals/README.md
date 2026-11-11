# A picture or an object on every teaching step (STUDENT-8): the shared part

Stage 13 of the student lane: the figure types every topic needs, the "say" layout and the tests. The topics' own
figures (268 steps) come in stages 14-17, one topic a commit; `bare-steps.txt` lists every step still without a drawing
or an object, per topic, as they start.

## The figure types (`gallery.jsx`, drawn with the app's own stylesheet)

Each card is one figure as a teaching step shows it (in the grey panel), with the name a screen reader says under it.

| File | What it shows |
| --- | --- |
| `figures-light-390-a.png`, `figures-dark-390-a.png` | `numline` (the spec's `signed:1#0`, two points, two jumps with the letters under the numbers, a wide range every 5, a unit cut in quarters), `thermo` (below zero, with a caption; warm, every 10), `machine` (the output asked: `?` in the brand; no numbers: x in, y out) |
| `figures-light-390-b.png`, `figures-dark-390-b.png` | `dots` (the mode's column, the median's middle dot, the mean as a fulcrum), `bars` (the first bar on the right, one marked, the unit on top), and the plane's new fields: quadrants and a walk from the origin, a line with its rise and run, a falling line (run 2, rise −1), two lines and where they meet, two parallel lines |
| `figures-*-320-*.png` | The same at 320px wide |

The marked thing is orange next to blue, which reads for every kind of colour vision; every colour is a token, so dark
mode is the same drawing. Text has a halo of the panel it sits on.

## In a lesson (`steps.cjs`)

A build with sample figures on five steps (put in for these pictures only, then taken out: the content stages add the
real ones), on a phone with reduced motion:

| File | What it shows |
| --- | --- |
| `in-lesson-light-390.png` | `signed:1#0` with the spec's number line; `line:1#0` (the rule and the machine) and `#1` (what comes out of 3? `?`); `coord:1#2` (A and B on the plane); the dot plot on `stats:1` |
| `in-lesson-dark-320.png` | The same in dark mode on a 320x568 phone: the machine shrinks on a short screen so the text and the button stay in view |
| `say-layout-before-after.png` | `eq:1#0`, a "say" step with a drawing, at 390 and 320: before, the drawing floated down the screen; now it sits right under the sentence in a panel of 40% of the screen's height |
| `anim-numline.png` | With motion on: the point fades in, the jump draws itself from −2 to 3, then its head and "+5" appear (about 1.1 s, once, as the step comes in). Under reduced motion the line is there at once |

## Tests

- `web/src/components/Figure.test.js`: every new type renders as one picture (`role="img"`) with its Hebrew name from
  its props; what each draws (a point named by its own number lights that number up, quadrants, the walk's legs, the
  meeting point, the median's dot, the first bar on the right); and drawing in with `anim`, never under reduced motion.
- `web/src/learn/visuals.test.ts`: every discover step of a finished topic has a `fig` or a `manip`; exemptions
  (`learn/visualPlan.ts` `VISUAL_EXEMPT`, none yet) name a real bare step with a reason, at most 5% of a topic; a topic
  still in `PENDING_VISUALS` must have steps left to draw. It prints this table on every run (at this commit):

  ```
  topic    steps  visual  exempt  bare  done
  signed      50      15       0    35   30%  still being drawn
  coord       48      19       0    29   40%  still being drawn
  angles      50      50       0     0  100%  done
  expr        42      10       0    32   24%  still being drawn
  eq          47      12       0    35   26%  still being drawn
  line        80      23       0    57   29%  still being drawn
  pyth        50      49       0     1   98%  still being drawn
  stats       48       8       0    40   17%  still being drawn
  sys         45       6       0    39   13%  still being drawn
  ```
- `web/src/learn/figures.test.ts` (extended): in every topic, a figure agrees with itself (number-line marks and jumps
  on the line, dots on the axis, the marked mode, median and mean are the data's, a thermometer reading on its scale,
  bars with a name each, a rise and run on the plane, two lines that meet on a whole or half number inside the plane,
  never the `linear` figure, a linear pair of angles, in `line:*` or `sys:*`); in every finished topic, a letter the
  text names alone (`$A$`, `$x$`) or a point it names with coordinates is written in the figure and drawn where the text
  says, and a prediction's answer is never written in its own figure. The checks are run on made-up steps too, so each
  is shown to catch what it is for.

## Size

Measured with esbuild (minified, gzip -9, the libraries left out), each new type adds: numline 670 B, thermo 328 B,
machine 323 B, dots 455 B, bars 262 B (each under the 1.5 KB of the spec). The plane's new fields and the shared
drawing code add about 1.2 KB. They stay in the lesson's code (today the boot bundle, as `Lesson.jsx` is not split yet).

## Stage 14: every teaching step of signed numbers and the coordinate plane is drawn

The 35 bare steps of `signed` and the 29 of `coord` now have a figure, the Hebrew text unchanged; both topics left
`PENDING_VISUALS` (signed 50/50, coord 48/48, no exemptions). The rules: a step that names an object draws it; a step that
asks about a configuration draws it without the answer; a rule step redraws its example with the rule's numbers; a say
step that opens a stair draws itself in (`anim`).

| File | What it shows |
| --- | --- |
| `council-before-after-signed1-0.png` | The council's `i13f-02-teach-0.png` (one sentence on an empty phone) next to `signed:1#0` now: the spec's number line, a jump of +5 from −2 to 3 |
| `signed-first-steps.png` | The first step of each signed stair, light and dark, 390x844: the number line; a thermometer below zero; 3 · 4 as three jumps of 4; Roni's 5 points; the package (2 + 3) |
| `coord-first-steps.png` | The first step of each coord stair: the origin; the four quadrants; a horizontal and a vertical segment; a shape of squares; three corners of a rectangle |

How the figures follow the steps, by stair:

- signed:1-5. Moves are jumps over the number line, with their size on them (−(−3), 3·(−2), (2 + 3)). A prediction shows
  where it starts, never where it lands: `2 − (−3)` shows 2; the pattern 5 − 2, 5 − 1, 5 − 0 shows 3, 4, 5 and the +1
  steps, not 6. The two Hermon mornings are two thermometers side by side (`also`), so the explore step that puts −8 and
  −3 on the line is not given away. `signed:5#1` (the same numbers with and without brackets) is a small table of what is
  done first, since any line would compute one of the two answers.
- coord:1-5. Every point the text names is drawn where the text says. A prediction about where a point is (or what its
  coordinates are) keeps that point hidden: it is in the data, in its place, and not drawn (`E(0, −3)`, `(5, −1)`, the
  missing corner `D`). The quadrant rule names one point in each quadrant by its signs; the area rule writes `a` and `b`
  on the sides (`words`, a new field of the plane).

What changed in the shared figures while drawing these, each after looking at the screens:

- The number line spaces its numbers to fit a 320px phone (every 1, 2, 5… so a minus sign and two digits never touch),
  and always writes where a jump starts and lands. A jump that goes back over an earlier one (10 − 4 + 3) is an arch above
  it, so the two arcs and their labels never cross.
- The thermometer can stand two on one scale (`also`), drawn shorter so its numbers stay readable on a small phone, and
  draws its column up with `anim`.
- The plane takes `words` (a side's letter, a shape's name); its screen-reader name says when it shows a rectangle or
  segments.
- `.lm-why` keeps a long formula inside its box: on a 320px phone the rule `signed:5#7`'s why pushed the page 21px
  sideways (an inline formula never splits, and KaTeX's hidden MathML is positioned, so the box is positioned too).

Checks: `learn/figures.test.ts` now holds signed and coord to their text (no answer written in a prediction's figure, every
named point drawn or, in a prediction, hidden in its place) and to "a say step that opens a stair draws itself in";
`e2e/teach-all.spec.js` walks every step of every drawn topic at 320x568 and finds its visual region, with a drawing or an
object in it, at least 120px tall. Made with `walk.cjs` (every step of a stair, at a size), `firsts.cjs` and `proof.py`
against a `vite preview` of the build on port 4232.

## Stage 15: every teaching step of the linear function is drawn

The 57 bare steps of `line` (line1.ts, line2.ts) now have a figure but one, the Hebrew text unchanged, and `line` left
`PENDING_VISUALS` (79 of 80 drawn, 1 exempt).

| File | What it shows |
| --- | --- |
| `line-first-steps.png` | The first step of each of the eight stairs, light and dark, 390x844: the machine of y = 2x + 1; m and b on a line; a stair on the squares; a stair between two far points; a line to write the equation of; a line crossing both axes; the triangle with the axes and O; two lines meeting at (−1, 1) |

- A rule is a machine (`machine`): x goes in, y comes out; when a prediction asks what comes out, the machine shows `?`
  (its name reads "יוצא סימן שאלה").
- Slope and intercept are a line on the plane (`coord` with `lines`, never `linear`, which is a pair of angles) with its
  stair (`riseRun`), `(0, b)` at the intercept and `m = …` beside it. A prediction that asks for the slope, the
  intercept or the meeting point draws the line without that number: the stair as two plain segments, a run without its
  rise, the two lines without their meeting point, a dashed x = 2 for "what is the meeting point?".
- Tables of values are the `table` figure: the check-the-step tip shows a table whose steps are +2, +3, +1; "where does
  y = −2x + 8 cross the x axis?" shows the table that stops one column before 0.
- `line:6#6` (3x = 6, what is x?) is the balance of eq: three boxes against six weights.
- One step is exempt (`VISUAL_EXEMPT`): `line:5#4` is about the point (7, 30), which on purpose does not fit on any
  grid; that is the step's reason to compute b instead of drawing.

What changed while drawing these, after looking at every step at 320px: an equation beside a steep line is written as
a word in the line's colour (`words` with `tone`) in free space, since the name the plane puts at a line's end crossed
the line; a point's name near the right edge goes to its left; and the text check now finds a letter inside a label
(`m = 2`, `(0, b)`), not only a label that is the letter alone.

The 320px check in `e2e/teach-all.spec.js` now waits for the step it measures to be on screen (the steps swap one after
the other, and the leaving one could be measured), honours `VISUAL_EXEMPT`, and was shown to fail on a step with its
drawing taken out (`signed:1#3`).
