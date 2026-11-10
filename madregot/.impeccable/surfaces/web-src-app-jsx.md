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
Round 17 (10 November 2026): the owner called the UI childish, inconsistent, too colourful, too small to read and too dark, opened the palette, named Brilliant, Duolingo, Apple/Revolut and Photomath as the bar, and chose the category standard over the dealt directions (road signs; graph-paper notebook). The previous "Electric Premium" black world is replaced.

## Direction contract

THESIS: The category standard, played straight: Brilliant and Duolingo at their best, for Israeli grade 7–8 math. Light screens, one brand blue, big readable Hebrew, and one card and one button grammar on every screen. Refuses what made the old look childish and loud: scenery illustrations, neon glow, black screens, a colour per element, small grey text, eyebrows over headings.
OWN-WORLD: White ground; cool grey #F4F6F9 only behind grouped content; ink #14161A, secondary #565B66. One brand blue #1A5CF5 (white text 5.4:1) with lip #1246C4 and tint #EAF1FF for buttons, selection, progress and the current level. Green #2FBF4A only for correct (black text), red #C4213B only for "not yet" (white text), gold #FFC233 XP, orange #FF8A1F streak. Rubik only, weights 400–800, scale 32/30/22/20/19/17/15/14 (body 17, nothing under 14). Cards: white, 2px #E4E7EC border, radius 16, no soft shadows. Pressable controls add a 4px lip that collapses on press. Math in KaTeX serif at display size. מדי in the brand blue, only in feedback, empty states, results, the welcome screen (the brand's first screen) and as the tutor's small avatar in chat. The welcome keeps the owner's own copy, "LEVEL UP YOUR MATH" under the wordmark (owner-pinned, round 15).
STORY: The student opens on the path, reads the next step in one card with one button, and starts. In a lesson the question owns the screen: the instruction in 20px, the expression large, a large answer field, the keypad and one check button at the bottom; the feedback panel rises with the reason. The lesson ends with one title, three tiles and one button. The teacher's board stays a clean light dashboard.
FIRST VIEWPORT: Phone home: a 60px white top bar (grade switch at the start; streak and XP at the end, icons in their meaning colour, numbers in ink); the current unit as a brand-blue card (white 22px title, level count, guidebook button); the path below, 68px round nodes (76px for the current one) in a gentle zig-zag, done brand with a white check, the current one brand with a progress ring and a "התחלה" bubble, locked light grey; a 58px tab bar with icon and a 14px label, the active tab in brand.
FORM: The standing exit (category canon), chosen by the owner over the dealt direction (Israeli road signs, candidate 3) and the pick (graph-paper notebook); craft bar Brilliant, Duolingo, Apple, Photomath. Signature interaction: the lipped press and the feedback panel rising from the bottom. Motion: short exponential ease-out, off under reduced motion. seed:e2d330cda2b9d85b
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
