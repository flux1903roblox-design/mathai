---
name: Madregot
description: Daily math practice for Israeli grade 7-8 students, in Hebrew. Light, calm, one brand blue, large readable type.
colors:
  paper: "#ffffff"
  ground: "#f4f6f9"
  ink: "#14161a"
  ink-2: "#565b66"
  quiet: "#6b7280"
  rule: "#e4e7ec"
  rule-strong: "#cdd2da"
  rule-press: "#d5dae2"
  track: "#e9ecf1"
  track-edge: "#d3d8e0"
  brand: "#1a5cf5"
  brand-d: "#1246c4"
  brand-tint: "#eaf1ff"
  brand-line: "#a9c3ff"
  selection: "#cfdcff"
  on-brand: "#ffffff"
  good: "#2fbf4a"
  good-d: "#1a8a34"
  good-tint: "#e3f8e7"
  good-ink: "#157a41"
  good-line: "#bfe9c9"
  on-good: "#000000"
  bad: "#c4213b"
  bad-d: "#96182c"
  bad-tint: "#fde8ec"
  bad-ink: "#b3203a"
  bad-line: "#f6c3cd"
  on-bad: "#ffffff"
  gold: "#ffc233"
  gold-d: "#e0a100"
  gold-ink: "#8a5c00"
  gold-tint: "#fff6d6"
  on-gold: "#5c3d00"
  streak: "#ff8a1f"
  streak-ink: "#a84f00"
  streak-tint: "#fff1e3"
typography:
  display:
    fontFamily: "Rubik Variable, Rubik, Segoe UI, Arial Hebrew, Arial, sans-serif"
    fontSize: "32px"
    fontWeight: 800
    lineHeight: "38px"
  page-title:
    fontFamily: "Rubik Variable, Rubik, Segoe UI, Arial Hebrew, Arial, sans-serif"
    fontSize: "30px"
    fontWeight: 800
    lineHeight: "36px"
    letterSpacing: "-0.015em"
  headline:
    fontFamily: "Rubik Variable, Rubik, Segoe UI, Arial Hebrew, Arial, sans-serif"
    fontSize: "22px"
    fontWeight: 800
    lineHeight: "30px"
  title:
    fontFamily: "Rubik Variable, Rubik, Segoe UI, Arial Hebrew, Arial, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: "26px"
    letterSpacing: "-0.01em"
  teaching:
    fontFamily: "Rubik Variable, Rubik, Segoe UI, Arial Hebrew, Arial, sans-serif"
    fontSize: "19px"
    fontWeight: 400
    lineHeight: "29px"
  body:
    fontFamily: "Rubik Variable, Rubik, Segoe UI, Arial Hebrew, Arial, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: "26px"
    fontFeature: "tnum"
  body-sm:
    fontFamily: "Rubik Variable, Rubik, Segoe UI, Arial Hebrew, Arial, sans-serif"
    fontSize: "15px"
    fontWeight: 500
    lineHeight: "22px"
  label:
    fontFamily: "Rubik Variable, Rubik, Segoe UI, Arial Hebrew, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 700
    lineHeight: "20px"
  button:
    fontFamily: "Rubik Variable, Rubik, Segoe UI, Arial Hebrew, Arial, sans-serif"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: "24px"
  number:
    fontFamily: "Rubik Variable, Rubik, Segoe UI, Arial Hebrew, Arial, sans-serif"
    fontSize: "22px"
    fontWeight: 800
    fontFeature: "tnum"
rounded:
  sm: "12px"
  btn-sm: "14px"
  md: "16px"
  lg: "20px"
  pill: "999px"
  circle: "50%"
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
  gutter: "20px"
  gutter-wide: "24px"
components:
  button-primary:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.on-brand}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: "0 20px"
    height: "52px"
  button-primary-disabled:
    backgroundColor: "#eceef2"
    textColor: "{colors.quiet}"
    rounded: "{rounded.md}"
    height: "52px"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.brand-d}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    height: "52px"
  button-ghost:
    textColor: "{colors.brand-d}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    height: "52px"
  button-bad:
    backgroundColor: "{colors.bad}"
    textColor: "{colors.on-bad}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    height: "52px"
  button-sm:
    rounded: "{rounded.btn-sm}"
    height: "44px"
  card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "20px 20px 16px"
  math-panel:
    backgroundColor: "{colors.ground}"
    rounded: "{rounded.md}"
    padding: "20px 12px"
  choice:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
  choice-selected:
    backgroundColor: "{colors.brand-tint}"
    textColor: "{colors.brand-d}"
    rounded: "{rounded.md}"
  choice-wrong:
    backgroundColor: "{colors.bad-tint}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
  answer-slot:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "14px"
    height: "64px"
  key:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
  segmented:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
  segmented-on:
    backgroundColor: "{colors.brand-tint}"
    textColor: "{colors.brand-d}"
  feedback-good:
    backgroundColor: "{colors.good-tint}"
    textColor: "{colors.good-ink}"
  feedback-not-yet:
    backgroundColor: "{colors.bad-tint}"
    textColor: "{colors.bad-ink}"
  unit-header:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.on-brand}"
    rounded: "{rounded.md}"
    padding: "16px 20px"
  path-stop:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.on-brand}"
    rounded: "{rounded.circle}"
    size: "68px"
  path-stop-current:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.on-brand}"
    rounded: "{rounded.circle}"
    size: "76px"
  path-stop-mastered:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.on-gold}"
    rounded: "{rounded.circle}"
    size: "68px"
  path-stop-locked:
    backgroundColor: "{colors.track}"
    textColor: "#9aa1ac"
    rounded: "{rounded.circle}"
    size: "68px"
  tab:
    textColor: "{colors.quiet}"
    typography: "{typography.label}"
    height: "58px"
  tab-active:
    textColor: "{colors.brand}"
  stat-tile:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.md}"
  earned-chip:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "6px 12px"
  sheet:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.lg}"
---

# Design System: Madregot

## Overview

**Creative North Star: "The Category Standard"**

Madregot is played straight at the level of Brilliant and Duolingo, for Hebrew-speaking grade 7-8 students. Screens are white, the ink is a near-black `ink`, and there is one brand blue. Blue marks what you can do and where you are: the main button, a selection, progress, the current unit and the current stop on the path. Four other colours each have one job: green for correct, red for "not yet", gold for XP and achievements, orange for the streak. Nothing else on a screen is coloured.

There is one card and one button on every screen. A card is white with a 2px light border and 16px corners and no soft shadow. Anything the thumb presses (buttons, answer choices, keypad keys, path stops, segmented choices) stands on a solid lip of a darker tone that disappears when pressed. Type is Rubik only, large: body text is 17px and nothing is smaller than 14px. Maths is rendered by KaTeX in its serif, left to right inside the right-to-left Hebrew, at display size on a light grey panel.

The build rejects what made earlier rounds look childish and loud: scenery illustrations behind the path, neon glow, black screens, a colour per unit or per element, small grey text, and small labels above headings. The mascot מדי appears only where a character helps: feedback, empty and error states, results, the welcome screen, and as the tutor's avatar in chat.

**Key Characteristics:**
- White screens; cool grey `ground` only as the panel the maths or grouped content sits on.
- One brand blue for action, selection, progress and "where I am"; four meaning colours, one job each.
- One card (white, 2px `rule` border, 16px radius, flat) and one button grammar everywhere.
- The lipped press: pressable things sit on a 3-6px solid lip that collapses when pressed.
- Rubik only, weights 400 to 800; body 17px; nothing under 14px; tabular numbers.
- Hebrew right to left, maths isolated left to right; phone first, one column.
- Short ease-out motion; the feedback panel rises from the bottom; everything stops under reduced motion.

## Colors

A white, quiet palette with one saturated blue and four meaning colours that appear only when their meaning does.

### Primary
- **Brand Blue** (`brand`): the primary button, the selected choice's border, every progress fill, the current unit header, done and current path stops, the active tab, icons in tiles and stat rows. White text on it is 5.4:1.
- **Deep Brand** (`brand-d`): the lip under every brand-blue surface, and blue text on white (secondary and ghost buttons, links, selected-choice text).
- **Brand Tint** (`brand-tint`): the selected choice's fill, icon tiles, the active desktop tab, the profile header band, the track of the current stop's ring.
- **Brand Line** (`brand-line`): focus rings and the lip under a selected choice or segment.

### Secondary (meaning colours)
- **Correct Green** (`good`, with `good-d`, `good-tint`, `good-ink`, `good-line`): correct answers only. The bright green is a fill with black text (8.7:1); on white, marks and borders use `good-d`, text uses `good-ink`. The correct feedback panel is `good-tint`.
- **Not-Yet Red** (`bad`, with `bad-d`, `bad-tint`, `bad-ink`, `bad-line`): "not yet" only, in lessons and in the teaching stages alike. White text on the red (5.8:1). The retry and reveal feedback panels are `bad-tint` with a `bad-line` top edge; a wrong choice gets a `bad` border on `bad-tint`.
- **XP Gold** (`gold`, with `gold-d`, `gold-ink`, `gold-tint`): XP, mastered stops, an opened gift, the exam day on a plan. Text on gold is the dark brown `on-gold`.
- **Streak Orange** (`streak`, with `streak-ink`, `streak-tint`): the streak flame and nothing else. An inactive flame is grey (`#b7bdc7`).

### Neutral
- **Paper** (`paper`): every screen, card, sheet, bar and footer.
- **Ground** (`ground`): the panel under a question's maths, the teaching canvas, the earned-reward chips. Never a page background.
- **Ink** (`ink`): headings, body text, numbers.
- **Secondary Ink** (`ink-2`): descriptions, subtitles, the label under a heading (6.6:1 on white).
- **Quiet** (`quiet`): inactive tab icons and labels, disabled button text.
- **Rule** (`rule`): card borders and dividers (2px), bar edges (1px). **Rule Strong** (`rule-strong`): the answer slot's border, dashed empty boxes. **Rule Press** (`rule-press`): the lip under white pressables.
- **Track** (`track`, with `track-edge`): empty progress tracks, locked path stops and their lip.
- **Selection** (`selection`): text selection.

### Named Rules
**The One Blue Rule.** Brand blue means "act here" or "you are here". Units do not get their own colours; every unit is the brand blue.

**The One Job Rule.** Green only for correct, red only for "not yet", gold only for XP and achievements, orange only for the streak. A meaning colour on a result tile goes on the icon and the number, never on the tile.

**The Readable Fill Rule.** Black text on green and gold, white on blue and red. A right or wrong answer never relies on colour alone: it carries an icon and words.

## Typography

**Display, Body and Label Font:** Rubik (variable, self-hosted via `@fontsource-variable/rubik`), with Segoe UI, Arial Hebrew and Arial as fallbacks.
**Maths:** KaTeX's serif, at 1.08em inline and `clamp(30px, 5dvh, 44px)` on the question panel, always left to right and never wrapped inline.

**Character:** one rounded, sturdy sans for everything, set large; the hierarchy comes from size and weight (800 for titles, 700 for headings and buttons), not from a second face.

### Hierarchy
- **Display** (800, 32px/38px): the lesson result title.
- **Page title** (800, 30px/36px, 36px/44px from 1100px wide): a tab's own screen title, ink on white, with a 17px `ink-2` line under it (max 46ch).
- **Headline** (800, 22px/30px): the question in a lesson and onboarding, the unit name on the unit header, the feedback panel title, empty-state titles. Drops to 18-19px on screens under 640px tall.
- **Title** (700, 20px/26px): section headings and card titles; sheet and path-popover titles use 800. The in-lesson instruction is 20px/700.
- **Teaching** (400, 19px/29px): the prose of the teaching stages and worked examples.
- **Body** (400, 17px/26px): all running text, descriptions in cards, feedback explanations.
- **Small body** (500, 15px/22px): descriptions in list rows, the label under a heading ("הצעד הבא", the topic under a level title), unit labels.
- **Label** (700, 14px/20px): stat tile labels, tab names on phones, the kind and duration of a mission. The floor of the scale.
- **Button** (700, 17px; 18px large, 16px small).
- **Number** (800, 22px, tabular): stat values, profile numbers; top-bar counts at 18px.

### Named Rules
**The 14px Floor Rule.** No text below 14px; body is 17px. Small text is secondary ink, never light grey.

**The Label Under Rule.** A label that says what a heading belongs to sits under the heading, at 15px in `ink-2`. Nothing sits above a heading.

## Layout

Phone first, one column, right to left. Content runs inside a 20px gutter (24px from 600px wide). Spacing is a 4px grid (`s1` to `s12`); sections are 24px apart, a section heading has 12px below it.

- **Home (the path):** a white top bar at least 60px tall with a 1px bottom rule: the grade switch at the start, streak and XP at the end (icons in their meaning colour, numbers in ink). Below it the current unit as a brand-blue header card, then the path of round stops in a gentle zig-zag, 28px apart, on plain white.
- **Tab bar:** fixed at the bottom, white, 1px top rule, five tabs with a 24px icon over a 14px label, at least 58px tall on phones. From 960px it becomes a side rail with the wordmark (26px/800 brand) and row tabs at 16px; the active tab gets a `brand-tint` fill.
- **Pushed screens:** a 56px white bar with the way back and an 18px/700 title, and a white footer with a 1px top rule for the main action.
- **Lesson:** the question owns the screen. The instruction and the maths at the top, the answer field, keypad and a full-width check button at the bottom, within thumb reach. On a computer (900px wide and 560px tall) the lesson is one column: the question and maths up to 760px wide, the answer and keypad in a centred 560px foot.
- **Wide screens:** a tab's screen keeps a readable column of at most 880px from 1024px.
- **Short phones** (under 640px tall): the question and teaching type step down one size and the panels tighten, so the drawing keeps its room.

## Elevation & Depth

The system is flat. Cards, rows, headers and panels have no soft shadow; depth is the 2px border and the solid lip under pressable things. Soft shadows appear only on layers that float over the page.

### Shadow Vocabulary
- **The lip** (`box-shadow: 0 4px 0 <darker tone>`; 3px on keys and segments, 6px on path stops and the gift): the pressable edge. Brand surfaces use `brand-d`, white ones `rule-press`, selected ones `brand-line`, locked ones `track-edge`.
- **Lift** (`box-shadow: 0 2px 6px rgba(20,22,26,.06), 0 12px 32px rgba(20,22,26,.12)`): the path stop's popover card and bottom sheets only.
- **Backdrop** (`rgba(20,22,26,.45)`): behind sheets and dialogs.

### Named Rules
**The Lipped Press Rule.** Something that can be pressed stands on a solid lip of its own darker tone; on press it moves down by the lip's height and the lip goes to zero, in 80ms. Something that cannot be pressed does not get a lip.

**The Flat Card Rule.** Cards never carry a soft shadow. Only floating layers (popover, sheet) do.

## Shapes

Rounded, sturdy geometry. Cards, buttons, answer choices and panels have 16px corners; small buttons 14px; keys, the grade switch and the answer-letter tag 10-12px; sheets 20px on the top corners only. Path stops, avatars, the gift and the progress ring are circles. Earned rewards and label chips are full pills. Borders are 2px everywhere inside content, 1px only on the edges of bars. The empty slot is a dashed 2px `rule-strong` box.

## Components

### Buttons
Big, solid and pressable.
- **Shape:** gently rounded (16px), at least 52px tall (56px large, 44px small with 14px corners), 2px border in the fill colour, 700 weight.
- **Primary:** brand blue with white text on a `brand-d` lip. One primary per screen.
- **Secondary:** white with `brand-d` text, a `rule` border and a `rule-press` lip.
- **Ghost:** no fill, border or lip; `brand-d` text; a `brand-tint` fill on hover.
- **Not yet:** red with white text on a `bad-d` lip, used only inside a "not yet" moment.
- **Disabled:** `#eceef2` with `quiet` text and a `#dfe2e8` lip.
- **Focus:** a 3px `brand-line` outline 2px outside the button.

### Cards / Containers
- **Corner Style:** 16px.
- **Background:** white.
- **Shadow Strategy:** none (see The Flat Card Rule).
- **Border:** 2px `rule`. A list in a card separates its rows with a 2px `rule` line; rows are at least 72px tall with a brand-tint icon tile, a 17px/700 title and a 15px `ink-2` description.
- **Internal Padding:** 20px, 16px at the bottom. The current topic card gets a brand border and a brand lip.

### Answer choices, slot and keypad
- **Choice:** a white card with a 2px `rule` border and a 4px `rule-press` lip, 18px text. Selected: `brand` border, `brand-tint` fill, `brand-line` lip, `brand-d` text. Wrong (teaching stages): `bad` border on `bad-tint`, and its letter tag turns solid red.
- **Answer slot:** a large white field (104-200px wide, 48-64px tall, 22-30px bold digits) with a 2px `rule-strong` border and a 4px bottom edge; active: brand border and a 3px brand-tint ring.
- **Keypad keys:** white, 12px corners, 2px `rule` border, 3px lip, 700 weight.

### Feedback panel (signature)
After a check, a panel rises from the bottom (24px, 250ms, smooth ease-out) over the lesson foot: `good-tint` with a `good-ink` 22px/800 title for correct; `bad-tint` with a `bad-ink` title for retry and reveal; a 2px top edge in the matching line colour; the explanation in 17px ink; the next button inside. The answer row shakes once on a wrong answer.

### Path (signature)
- **Stops:** 68px circles on a 6px lip. Done: brand with a white check. Current: 76px brand with a star, wrapped in a 7px progress ring (brand on a `brand-tint` track, showing how far it is along its five stages) and a white "start/continue" bubble above it. Mastered: gold. Locked: `track` with a grey lock. A gift is a 64px circle, grey until opened, gold after.
- **Unit header:** a brand-blue card with the white 22px/800 unit name, a 15px count line, a 6px white bar of all the unit's stages (five a stair) on a translucent white track, and the guidebook at the end behind a thin white divider. The count line moves from the first stage: the unit's size ("5 מדרגות"), then stages done ("3 מתוך 25 שלבים"), then stairs done once one is mastered ("1 מתוך 5 מדרגות"); never "0 מתוך".
- **Popover:** a white card with the lift shadow, a 20px/800 title and its buttons.

### Navigation
- **Tab bar:** icon and name; inactive in `quiet`, active in brand with a 2.4 icon stroke. Phones show 14px labels; the side rail from 960px uses 16px labels and a `brand-tint` active row.
- **Segmented choices:** white with a 2px `rule` border and 3px lip; on: brand border, `brand-tint` fill, `brand-d` text.

### Results
One title, מדי, what was earned as quiet pills (`ground` fill, 15px ink text, an icon in its meaning colour), three neutral stat tiles (white, 2px `rule`, a 14px `ink-2` label and a 22px/800 number in the tile's meaning ink), and one button. Under the title, the stair's five stages as thick segments with "{stair}: N מתוך 5 שלבים", and the unit's stairs only once one is done.

**A teaching stage done** is lighter than a lesson's end: no confetti, no stat tiles, no streak screen. מדי (112px), "שלב N הושלם!" at 30px/800 with the stage and the stair as a 15px `ink-2` label under it, the five segments, the earned pills (XP the first time, the streak when it starts or grows, the daily goal), a bordered "הבא:" card with the next stage and its minutes, the one primary button to that stage, and a ghost "למפה".

### Teaching stages
Clean text at 19px on white, the maths or the object to move on a `ground` panel with 16px corners, answer cards across the width, and the check at the bottom. A step that names a shape or a part of one shows it: a drawing (Figure type `geo`) in 2px ink lines with a light brand fill for the shape, brand for what the text points at (the ray, the hypotenuse, the transversal), arcs for angles (two or three arcs for equal ones), a small square for a right angle, and `bad-ink` for the "?" being asked. Letters appear only where the text has them; side labels sit clear of their lines; numbers in a drawing are its true sizes. The "why" box is a bordered white card that turns `good-tint` when right and gets a `bad-line` border when not yet; the bottom bar turns `bad-tint` for "not yet".

### Mascot מדי
A stair-block character in the brand blue (its own tokens `--madi-*` in `tokens.css`). Used only in feedback, empty and error states, results, the welcome screen and as the tutor's 34px chat avatar. Not beside questions, onboarding, the profile (which shows the student's initial in a 96px brand circle) or the teacher header.

### Settings
Grouped sections under small headings. A student sees whether the assistant is on and how it comes (through a class); the class server's address and a personal Claude key are one quiet row away, on an adult-facing "מתקדם" screen that says who it is for.

### Teacher's board
White, its sections and groups as the standard card, headings at 18px/800, stat icons in brand.

## Do's and Don'ts

### Do:
- **Do** use the brand blue for the one main action, selection, progress and the current place, and nothing else.
- **Do** keep every screen white; use `ground` only under the maths or grouped content.
- **Do** build every container as the one card: white, 2px `rule`, 16px corners, no soft shadow.
- **Do** give every pressable thing a solid lip that collapses on press, and nothing else.
- **Do** set body text at 17px and keep all text at 14px or larger, in ink or `ink-2`.
- **Do** put a heading's label under it, at 15px `ink-2`.
- **Do** isolate maths left to right inside Hebrew and keep inline expressions on one line.
- **Do** show "not yet" in red and correct in green, each with an icon and words, in lessons and teaching stages alike.
- **Do** keep touch targets at 44px or more and turn motion off under reduced motion.

### Don't:
- **Don't** give a unit, topic or section its own colour.
- **Don't** use black or dark screens, glow or neon effects.
- **Don't** put scenery or tinted worlds behind the path or colour blocks behind page titles.
- **Don't** put a small label or eyebrow above a heading, on any screen (the welcome screen's English line is gone too).
- **Don't** use gold for "not yet"; gold is XP.
- **Don't** colour a whole result tile; colour its icon and number.
- **Don't** put מדי beside questions, in onboarding, on the profile or in headers.
- **Don't** add a second typeface; Fredoka is gone.

## History

- **v1:** a "printed textbook" world.
- **Early November 2026 ("The Friendly Staircase"):** a Duolingo-style rebuild: electric indigo brand, Fredoka for headings and Rubik for reading, a chapter colour per unit, a purple mascot. Layouts were then remeasured after Duolingo and Brilliant (`LAYOUT_SPEC.md`).
- **Round 15 ("Electric Premium", 9 November):** black screens around white learning surfaces, `#0066FF` and glowing `#00C8FF`, generated dark stylesheets.
- **Round 16:** the rules of successful apps: one brand colour mostly on the main action, one job per extra colour, readable text on coloured fills (black on green, white on red), green and red far apart in lightness.
- **Dark mode (STUDENT-2, November 2026):** the app follows the phone's light or dark setting, and Settings → מראה lets the student choose "כמו במכשיר", "בהיר" or "כהה". Every colour is a token (`web/src/styles/tokens.css`; `npm run lint:colors` fails on a stray literal), and `web/src/styles/dark.css` holds the dark values: page `#0f1115`, cards `#181b22`, ink `#eef1f5`. Unit fills and the brand stay the same; a stop in a dark unit colour gets a 2px ring in its light `-ink`. `public/theme-boot.js` applies an explicit choice before the first paint. The notebook page, the QR code and printouts stay light. The old `theme-dark.css`, `dark.gen.css` and `scripts/theme-dark.cjs` were deleted.
- **Round 17 (10 November 2026, current):** the owner called the UI childish, inconsistent, too colourful, too small and too dark, and chose the category standard. Light only, one blue `#1A5CF5`, Rubik only, one card and one button grammar. The dark files (`theme-dark.css`, `dark.gen.css`, `scripts/theme-dark.cjs`) are no longer imported. Source of truth: `web/src/styles/tokens.css` and `web/src/styles/canon.css` (loaded last).
