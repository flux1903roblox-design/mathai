---
version: 1
slug: "web-src-app-jsx"
primary_target: "web/src/App.jsx"
related_targets: []
---

# Surface: Madregot student app + teacher dashboard

Scope: the whole web app (student practice on phones, teacher dashboard on laptops). Mode: operate.
Audience and job: grade 7–8 students practise daily and get unstuck; teachers see what to reteach. Constraints: Hebrew RTL, one-handed phone use, quiet classrooms, children's privacy. The user asked for navigation that is easy and an app better than Vibewise; they delegated the visual world (the round's default direction was taken).

## Direction contract

THESIS: A printed math textbook turned into a working app. The question is the page's one large thing; help arrives the way a textbook gives it, in a tinted box beside the exercise. Refuses the gamified-path, confetti-and-emoji default of learning apps.
OWN-WORLD: White paper ground, black ink, offset process colours used as flat tints: cyan for structure and primary action, magenta for "שימו לב" and the AI, yellow as a highlighter. Each topic owns one chapter colour shown as a band on its header. Exercise numbers sit in solid circles; math is set like a textbook (serif, italic variables). Spacing on a strict 4px cell grid; figures drawn on the same grid.
STORY: The student opens the app, sees today's goal and one "continue" action, answers a question with a custom keypad, and after a mistake reads why in a box next to their own crossed-out answer. The teacher sees who needs help first.
FIRST VIEWPORT: Phone: a slim header with the student's name, streak and points; one card "ממשיכים" with the current topic, level pips and a full-width primary button; below it the topic list with chapter-colour tabs and levels; bottom tab bar (היום, נושאים, עוזר AI, אני). Practice: a 48px top bar (exit, goal progress, points), a topic-and-level line, the expression at display size, answer slots, feedback box, a single help row, keypad docked to the bottom with the check key.
FORM: Grounded candidate 6 of 7, the Israeli printed math textbook (spot-colour boxes, circled exercise numbers, chapter tabs). Raises: magnitude ramp (star atlas): mastery always drawn as the same fixed level-pip scale. Isolation (developer console): destructive actions sit alone. Cell grid (Crouwel specimen): everything snaps to the 4px grid, figures share it. Scale contrast (variable-font specimen): the expression is the only large type. Held state (gate board): a mistake or a new help request stays marked until seen. seed:e50c2dfd021a5ba4
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
