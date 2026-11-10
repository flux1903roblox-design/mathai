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
