---
name: Madregot
description: Daily math practice for grades 7–8, set like a printed textbook, with a Claude tutor.
colors:
  paper: "#ffffff"
  ground: "#f4f6f8"
  ink: "#16191d"
  ink-soft: "#4c5561"
  rule: "#d6dde4"
  rule-strong: "#85909d"
  process-cyan: "#006fa8"
  process-cyan-tint: "#e3f2fa"
  process-magenta: "#b0105f"
  process-magenta-tint: "#fbe6f0"
  marker: "#fff1a6"
  marker-strong: "#ffe25c"
  correct-green: "#0b7340"
  correct-green-tint: "#e2f3e9"
  chapter-orange: "#b2470b"
  chapter-orange-tint: "#fdeee3"
  chapter-violet: "#6a3fa8"
  chapter-violet-tint: "#efe9f8"
  chapter-ochre: "#8a5a00"
  chapter-ochre-tint: "#fbf1d6"
typography:
  display-expression:
    fontFamily: "KaTeX_Main, Times New Roman, serif"
    fontSize: "38px"
    lineHeight: 1.2
  headline:
    fontFamily: "Secular One, Assistant Variable, Arial Hebrew, sans-serif"
    fontSize: "28px"
    fontWeight: 400
    lineHeight: "36px"
  title:
    fontFamily: "Secular One, Assistant Variable, Arial Hebrew, sans-serif"
    fontSize: "22px"
    fontWeight: 400
    lineHeight: "28px"
  body-large:
    fontFamily: "Assistant Variable, Assistant, Segoe UI, Arial Hebrew, Arial, sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: "28px"
  body:
    fontFamily: "Assistant Variable, Assistant, Segoe UI, Arial Hebrew, Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "24px"
    fontFeature: "tnum"
  label:
    fontFamily: "Assistant Variable, Assistant, Segoe UI, Arial Hebrew, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 700
    lineHeight: "20px"
  caption:
    fontFamily: "Assistant Variable, Assistant, Segoe UI, Arial Hebrew, Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: "20px"
rounded:
  sm: "8px"
  control: "10px"
  md: "12px"
  lg: "16px"
  pill: "999px"
spacing:
  s1: "4px"
  s2: "8px"
  s3: "12px"
  s4: "16px"
  s5: "20px"
  s6: "24px"
  s8: "32px"
  s10: "40px"
  s12: "48px"
components:
  button-primary:
    backgroundColor: "{colors.process-cyan}"
    textColor: "{colors.paper}"
    rounded: "{rounded.control}"
    padding: "0 20px"
    height: "48px"
  button-primary-hover:
    backgroundColor: "#005e8f"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "48px"
  button-ai:
    backgroundColor: "{colors.process-magenta-tint}"
    textColor: "{colors.process-magenta}"
    rounded: "{rounded.control}"
    height: "48px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.process-cyan}"
    rounded: "{rounded.control}"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "48px"
  answer-slot:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    width: "104px"
    height: "56px"
  keypad-key:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "48px"
  box-note:
    backgroundColor: "{colors.process-cyan-tint}"
    rounded: "{rounded.md}"
    padding: "24px 16px 16px"
  box-attention:
    backgroundColor: "{colors.process-magenta-tint}"
    rounded: "{rounded.md}"
    padding: "24px 16px 16px"
  chapter-mark:
    backgroundColor: "{colors.process-cyan}"
    textColor: "{colors.paper}"
    rounded: "{rounded.pill}"
    size: "36px"
  exercise-number:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.pill}"
    height: "28px"
---

# Design System: Madregot

## Overview

**Creative North Star: "The Printed Textbook, Working"**

Madregot is a Hebrew math textbook that answers back. The page is white paper with black ink. Colour comes from offset printing: cyan, magenta and a yellow marker, laid down as flat tints. Every topic is a chapter with its own colour. Exercises carry circled numbers, math is set in serif italics, and help arrives the way a textbook prints it, in a tinted box with its label on the top edge, next to the exercise it is about. The app refuses the gamified-path look of learning apps: no mascots, confetti or emoji. Progress is drawn the way a book would draw it, as a fixed row of level squares.

Density is that of a working page: one question at a time, read at arm's length on a phone, often in a quiet classroom. The expression is the only large type on the practice screen. Everything else (labels, help, navigation) stays at reading size, so the eye goes to the math first. The teacher dashboard uses the same paper and ink at desktop density, with tables and boxes and no decoration.

The layout is right to left (Hebrew), but math is always left to right and isolated, so a minus sign never wanders to the wrong side of a number.

**Key Characteristics:**
- White paper, black ink, process-colour tints; no gradients, no glass, no dark theme.
- One chapter colour per topic, carried on the topic band, its circle mark, its level squares and its tinted boxes.
- The expression at display size (38px) is the only large type during practice.
- Help as textbook boxes: tinted panel, label set on the top edge.
- Fixed marks with one meaning each: squares are levels, round dots are correct answers counted toward a goal, solid circles are exercise and chapter numbers.
- A strict 4px spacing grid, and figures drawn on the same grid.

## Colors

Paper and ink carry the page. Three process colours carry meaning, and six chapter colours tell topics apart. All text colours reach at least 4.5:1 on paper and on their own tints.

### Primary
- **Process Cyan** (`process-cyan`): structure and the primary action. Used for the main button on each screen, the active tab, focus rings, the docked check key, and the first chapter. Its tint (`process-cyan-tint`) fills the "note" box and the lesson summary.

### Secondary
- **Process Magenta** (`process-magenta`): "שימו לב" and the AI. Used for mistake feedback, the struck-through wrong answer, the AI tutor's buttons and boxes, the minus key, and destructive actions. Its tint (`process-magenta-tint`) fills the attention box and the AI box.

### Tertiary
- **Marker Yellow** (`marker`, `marker-strong`): a highlighter. It marks words that matter (the student's own note in a help request, the next step of the improvement plan), the "new" tag, the daily-goal bar, and text selection.
- **Correct Green** (`correct-green`, tint): a right answer, a finished plan step, a score of 80% or more.

### Chapter colours
- **Cyan, Magenta, Burnt Orange, Green, Violet, Ochre** (`process-cyan`, `process-magenta`, `chapter-orange`, `correct-green`, `chapter-violet`, `chapter-ochre`, each with a `-tint`): one per topic, assigned in order within a grade. A chapter colour appears on that topic's band, circle mark, level squares and weak-topic panel, and nowhere else.

### Neutral
- **Paper** (`paper`): every page background and card.
- **Ground** (`ground`): keypad keys, read-only slots, segmented-control track, hover on rows.
- **Ink** (`ink`): body text, headings, exercise-number circles, the active teacher tab.
- **Soft Ink** (`ink-soft`): secondary text, descriptions, unselected tabs.
- **Rule** (`rule`) and **Strong Rule** (`rule-strong`): hairlines between rows, and borders on controls that must be visible (inputs, secondary buttons, answer slots, empty level squares).

### Named Rules
**The Marker Rule.** Yellow highlights words; it does not fill cards. The one exception is the hint box, which a textbook prints on a yellow panel.

**The Chapter Rule.** A chapter colour belongs to its topic. It is never used for status or decoration on another topic's content.

**The Magenta Means Look Rule.** Magenta always means "look at this": a mistake, the AI, or a destructive action. Never use it for neutral emphasis.

## Typography

**Display Font:** Secular One (with Assistant, Arial Hebrew)
**Body Font:** Assistant Variable (with Segoe UI, Arial Hebrew, Arial)
**Math:** KaTeX's Computer Modern (serif, italic variables), always left to right

**Character:** Secular One is a round, sturdy Hebrew display face, like a textbook's chapter titles. Assistant is a plain, readable sans for everything a student reads in running text. Math is set the way it is printed, in serif italics, so an expression on screen looks like the one on the worksheet.

### Hierarchy
- **Display expression** (KaTeX, 38px, line-height 1.2; 28px on printed exams): the question's expression. The only large type on the practice screen.
- **Headline** (Secular One 400, 28px / 36px): page titles.
- **Title** (Secular One 400, 22px / 28px): section titles; box labels use Secular One at 14px.
- **Body large** (Assistant 400, 18px / 28px): question text, lead paragraphs (max 60ch), topic titles at 700.
- **Body** (Assistant 400, 16px / 24px, tabular numbers): everything else.
- **Label** (Assistant 700, 14px / 20px): buttons in small size, chips, field labels.
- **Caption** (Assistant 600, 13px / 20px): tab-bar labels, level captions, footnotes.

### Named Rules
**The One Large Thing Rule.** On a practice screen only the expression is set large. No headline, score or decoration competes with it.

**The Math Stays Left-to-Right Rule.** Every number, coordinate and expression is set as isolated LTR (KaTeX, or a `bdi` with a real minus sign U+2212), and an inline expression never breaks across lines.

## Layout

A single reading column, at most 600px wide, centred, with 16px side gutters plus the safe-area insets. Sections stack with 20px between them; related items stack with 12px or 16px. All spacing comes from the 4px grid (4, 8, 12, 16, 20, 24, 32, 40, 48).

On phones the five-tab bar is fixed at the bottom (60px targets, safe-area padded). From 960px wide it moves to the top as a row of pill tabs next to the wordmark. The practice screen hides the tab bar: a 48px top bar, the exercise, and the keypad docked to the bottom.

The teacher dashboard is a 1200px container. A four-cell stat strip (two by two under 700px) sits above pill tabs; boxes flow into up to three columns so a short box never leaves a hole beside a tall one; tables scroll horizontally inside their own wrapper.

Printed practice exams drop the tab bar and every on-screen control, and set questions in one column with ruled working space and an answer line.

## Elevation & Depth

The system is flat. Paper sits on paper; depth comes from hairlines and tints, not shadows. Two shadows exist, both functional: a soft lift for the bottom sheet that rises over the page, and an upward dock shadow under the keypad so it reads as attached to the screen edge. The selected segment of a segmented control carries a one-pixel lift to read as pressed out of the track.

### Shadow Vocabulary
- **Sheet lift** (`box-shadow: 0 2px 4px rgba(22,25,29,0.06), 0 8px 24px rgba(22,25,29,0.08)`): the bottom sheet (chat, help). Toasts keep the toast library's own soft shadow.
- **Dock** (`box-shadow: 0 -2px 6px rgba(22,25,29,0.05), 0 -8px 24px rgba(22,25,29,0.06)`): the docked keypad.

### Named Rules
**The Flat Paper Rule.** Cards and boxes have no shadow. If something needs to stand out, give it a tint or a rule, not elevation.

## Shapes

Gently rounded and consistent. Controls (buttons, inputs, keys) use a 10px radius; boxes and cards 12px; the topic band 16px; the bottom sheet 18px on its top corners. Circles are reserved for numbers (exercise numbers, chapter marks, plan step numbers) and for the round answer-count dots. Level squares are 14px squares with 4px corners (10px on narrow phones). Pills appear only for chips, the teacher's tabs and the desktop tab bar. Borders are 1px hairlines, or 1.5–2px on controls that must read as inputs.

## Components

### Buttons
Calm and solid, sized for thumbs.
- **Shape:** 10px radius, 48px tall (44px small, 56px large), Assistant 700.
- **Primary:** process cyan with white text; one per screen, usually full width at the bottom of the content.
- **Hover / Focus / Press:** hover darkens to `#005e8f`; focus shows a 2px cyan outline offset 2px; press moves the button down 1px.
- **Secondary:** paper with a strong-rule border, ink text; the border turns ink on hover.
- **AI:** magenta tint with magenta text and border, for anything that calls the tutor.
- **Ghost:** cyan text, no border, cyan tint on hover.
- **Danger:** solid magenta; danger outline is magenta text and border on paper. Destructive actions sit alone and confirm inline.

### Textbook Box (signature)
The help panel of a printed textbook.
- **Shape:** 12px radius, 1px border in a darker shade of the tint, padding 24px top and 16px sides.
- **Label:** set on the top edge in Secular One 14px, white on the box colour, 7px radius.
- **Tones:** note (cyan, lesson and general), attention (magenta, "שימו לב"), AI (pale magenta), ok (green), hint (yellow).

### Chips
- **Status chips:** pill, 28px tall, Assistant 800 at 14px, colour and tint by result: green "נכון", ochre "נכון בחלקו", magenta "טעות" / "לא נענה".
- **Score chips:** 56px wide, 10px radius, same three tones by percentage (80+, 60+, below).

### Cards / Containers
- **Rows, not cards:** topic lists, exam lists and actions are full-width rows (72px tall) divided by hairlines, with a chevron at the end.
- **Exam feedback:** each question is a ruled section (strong rule on top), not a card: number circle, status chip, chapter-colour topic tag, the question, one comparison line, the feedback box.
- **Plan steps:** 12px radius, 1px rule; a finished step turns green tint with a white check in its number circle.

### Inputs / Fields
- **Style:** paper, 1.5px strong-rule border, 10px radius, 48px tall; labels above in Assistant 700.
- **Focus:** border turns cyan with a 3px cyan-tint ring.
- **Answer slots:** 104×56px, 26px bold numerals, LTR. After a mistake the wrong answer stays in the slot, struck through in magenta, until a new key replaces it.

### Navigation
- **Phone:** five tabs fixed at the bottom (היום, נושאים, מבחנים, עוזר AI, אני), icon over a 13px caption, cyan when active.
- **Desktop:** the same tabs as pills in a top row beside the wordmark; the active pill has a cyan tint.
- **Teacher:** pill tabs, ink fill when active; the open tab is kept in the address (`?tab=`).

### Keypad (signature)
A custom keypad docked to the bottom of the practice screen: four columns of 48px keys (52px on tablets) on the ground colour, a magenta minus key, a fraction key, and a double-width cyan check key. It replaces the phone keyboard so the expression is never covered.

### Level Squares and Answer Dots (signature)
- **Level squares:** one 14px square per level of the topic, filled with the chapter colour when passed, hatched for the current level, outlined when ahead. The same scale everywhere a level is shown.
- **Answer dots:** 12px circles, filled when a correct answer counts toward a goal: two or four to move up a level, four to finish a plan step.

## Do's and Don'ts

### Do:
- **Do** keep the expression the only large type on any practice screen (38px display KaTeX).
- **Do** put help, feedback and AI output in a textbook box with its label on the top edge.
- **Do** use the topic's chapter colour for its band, circle, level squares and weak-topic panel.
- **Do** set every number and expression as isolated LTR with a real minus sign (U+2212).
- **Do** keep a mistake visible: the wrong answer stays struck through in magenta until the student replaces it.
- **Do** keep spacing on the 4px grid and touch targets at 44px or more.

### Don't:
- **Don't** fill whole cards with marker yellow; highlight the words that matter instead.
- **Don't** reuse level squares for anything except levels, or answer dots for anything except correct answers counted toward a goal.
- **Don't** add mascots, confetti, emoji icons or a gamified path.
- **Don't** add shadows to cards or boxes; use a tint or a rule.
- **Don't** use magenta for neutral emphasis; it means "look at this".
- **Don't** put a small grey label above a title; fold it into the title or drop it.
