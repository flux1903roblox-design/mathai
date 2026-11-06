---
version: 2
slug: "web-src-app-jsx"
primary_target: "web/src/App.jsx"
related_targets: ["web/src/screens/Learn.jsx", "web/src/screens/Lesson.jsx", "web/src/screens/LessonDone.jsx", "web/src/screens/Quests.jsx"]
---

# Surface: Madregot student app + teacher dashboard

Scope: the whole web app (student practice on phones, teacher dashboard on laptops). Mode: operate.
Audience and job: grade 7–8 students practise daily and get unstuck; teachers see what to reteach. Constraints: Hebrew RTL, one-handed phone use, quiet classrooms, children's privacy.
History: v1 was a "printed textbook" world. In November 2026 the owner asked for a Duolingo-style app after a research round (reports/אפליקציות מתמטיקה בסגנון דואלינגו.md); this brief replaces that world. Pinned by the owner: Duolingo style, phone-first. Not copied: Duolingo's owl, name, green, typeface or art.

## Direction contract

THESIS: Duolingo's daily loop for Israeli middle-school math, without its pressure. A winding path of short lessons, one big check button, a green or red panel after every answer, and a mascot that cheers. Refuses the punishing parts of the genre: no hearts or energy, no global leagues, no guilt messages; mistakes are fixed, not charged for.
OWN-WORLD: White ground and soft navy ink; electric indigo as brand and primary action; green only for correct, red only for "not yet", orange for the streak, gold for XP and finished nodes. Every topic is a unit with its own chapter colour. Chunky pressable controls with a solid lip that collapses on press. Fredoka (rounded Hebrew) for headings and buttons, Rubik for text, serif KaTeX for math, always LTR. The mascot מדי is an indigo two-step stair block with a face.
STORY: The student opens the app on the path, sees the streak and today's XP, taps the bouncing current node and starts an 8-question lesson. A wrong answer stays on screen crossed out with a hint; a second miss shows the answer, the steps and the tutor's explanation, and a similar exercise comes back at the end. The lesson ends with XP, accuracy and time, then the streak. The teacher still sees who needs help first.
FIRST VIEWPORT: Phone: a 60px top bar (grade switch, streak, freezes, today's XP of the goal); the current unit's band in its chapter colour with a guidebook button; the path of round nodes zig-zagging down, done nodes gold, the current one larger with a progress ring, a "התחלה" bubble and מדי beside it; locked nodes grey; bottom tabs לימוד, משימות, מבחנים, עוזר AI, אני. Lesson: X, a thick green progress bar and the combo count; the question in 22px, the expression at display size, the figure, answer slots; the dock with help chips, a chunky keypad and the full-width בדיקה button.
FORM: Owner-pinned direction (Duolingo-like loop), own identity. Signature interaction: the press of a lipped control and the feedback panel rising from the bottom. Motion grammar: short exponential ease-out; celebrations only after an answer, skippable, and off under reduced motion. seed:e50c2dfd021a5ba4 (v1 roll, superseded by the owner's pinned direction)
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
