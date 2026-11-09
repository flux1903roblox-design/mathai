---
name: Madregot
description: A bright, chunky daily-practice path for grade 7–8 math in Hebrew, with a stair-block mascot and a Claude tutor.
colors:
  paper: "#ffffff"
  ground: "#f6f6fb"
  ink: "#24253a"
  ink-2: "#5f6178"
  rule: "#e6e6f0"
  rule-strong: "#c9cad9"
  rule-press: "#d9dae6"
  brand: "#5b4ff0"
  brand-d: "#3f33c4"
  brand-tint: "#ecebff"
  good: "#1f9d55"
  good-d: "#16803f"
  good-tint: "#dff6e7"
  good-ink: "#157a41"
  bad: "#e5375a"
  bad-d: "#b8213f"
  bad-tint: "#ffe6ec"
  bad-ink: "#c01d43"
  streak: "#f07b0f"
  streak-ink: "#a84f00"
  streak-tint: "#ffeedd"
  gold: "#f5b400"
  gold-d: "#d39600"
  gold-ink: "#8a5c00"
  gold-tint: "#fff4cc"
  madi-hi: "#7a70ff"
  madi-lo: "#5246ea"
  madi-edge: "#3f33c4"
  madi-limb: "#3f33c4"
  ai-tint: "#fde8f3"
  ai-ink: "#a3165f"
  ch-sky: "#1a8fd6"
  ch-sky-d: "#0d6ba8"
  ch-sky-tint: "#e2f2fc"
  ch-fuchsia: "#c0349f"
  ch-fuchsia-d: "#93246f"
  ch-fuchsia-tint: "#fbe6f5"
  ch-petrol: "#0d8597"
  ch-petrol-d: "#08606e"
  ch-petrol-tint: "#ddf3f5"
  ch-cobalt: "#2563d9"
  ch-cobalt-d: "#1a47a3"
  ch-cobalt-tint: "#e3ecfc"
  ch-violet: "#8a4fe0"
  ch-violet-d: "#6a35bf"
  ch-violet-tint: "#f1eafd"
typography:
  display:
    fontFamily: "Fredoka Variable, Fredoka, Rubik Variable, Arial Hebrew, sans-serif"
    fontSize: "36px"
    fontWeight: 600
    lineHeight: "44px"
    letterSpacing: "-0.005em"
  headline:
    fontFamily: "Fredoka Variable, Fredoka, Rubik Variable, Arial Hebrew, sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: "36px"
    letterSpacing: "-0.005em"
  title:
    fontFamily: "Fredoka Variable, Fredoka, Rubik Variable, Arial Hebrew, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: "28px"
  button:
    fontFamily: "Fredoka Variable, Fredoka, Rubik Variable, Arial Hebrew, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    letterSpacing: "0.01em"
  question:
    fontFamily: "Rubik Variable, Rubik, Segoe UI, Arial Hebrew, Arial, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: "32px"
  body-large:
    fontFamily: "Rubik Variable, Rubik, Segoe UI, Arial Hebrew, Arial, sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: "28px"
  body:
    fontFamily: "Rubik Variable, Rubik, Segoe UI, Arial Hebrew, Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "24px"
    fontFeature: "tnum"
  label:
    fontFamily: "Rubik Variable, Rubik, Segoe UI, Arial Hebrew, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: "20px"
  label-small:
    fontFamily: "Rubik Variable, Rubik, Segoe UI, Arial Hebrew, Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: "20px"
  math-display:
    fontFamily: "KaTeX_Main, Times New Roman, serif"
    fontSize: "40px"
    lineHeight: 1.2
rounded:
  sm: "10px"
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
components:
  button-primary:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.paper}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: "0 20px"
    height: "48px"
  button-primary-large:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.paper}"
    rounded: "{rounded.md}"
    height: "54px"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.brand-d}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: "0 20px"
    height: "48px"
  button-good:
    backgroundColor: "{colors.good}"
    textColor: "{colors.paper}"
    rounded: "{rounded.md}"
    height: "48px"
  button-disabled:
    backgroundColor: "{colors.rule}"
    textColor: "#8a8ca0"
    rounded: "{rounded.md}"
    height: "48px"
  choice:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
    height: "60px"
  choice-selected:
    backgroundColor: "{colors.brand-tint}"
    textColor: "{colors.brand-d}"
  choice-correct:
    backgroundColor: "{colors.good-tint}"
    textColor: "{colors.good-ink}"
  choice-wrong:
    backgroundColor: "{colors.bad-tint}"
    textColor: "{colors.bad-ink}"
  answer-slot:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "14px"
    width: "104px"
    height: "56px"
  keypad-key:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "12px"
    height: "46px"
  path-node:
    backgroundColor: "{colors.ch-sky}"
    textColor: "{colors.paper}"
    rounded: "{rounded.circle}"
    size: "70px"
  path-node-current:
    size: "76px"
  path-node-done:
    backgroundColor: "{colors.gold}"
    textColor: "#6b4500"
    rounded: "{rounded.circle}"
    size: "70px"
  path-node-locked:
    backgroundColor: "#e4e5ee"
    textColor: "#a3a5bb"
    rounded: "{rounded.circle}"
    size: "70px"
  unit-band:
    backgroundColor: "{colors.ch-sky-d}"
    textColor: "{colors.paper}"
    typography: "{typography.title}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
  feedback-correct:
    backgroundColor: "{colors.good-tint}"
    textColor: "{colors.good-ink}"
    typography: "{typography.headline}"
    padding: "16px"
  feedback-not-yet:
    backgroundColor: "{colors.bad-tint}"
    textColor: "{colors.bad-ink}"
    typography: "{typography.headline}"
    padding: "16px"
  help-tool:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-2}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 12px"
    height: "40px"
  card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "16px"
  tab-active:
    backgroundColor: "{colors.brand-tint}"
    textColor: "{colors.brand-d}"
    typography: "{typography.label-small}"
    rounded: "{rounded.md}"
    height: "60px"
  input:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "50px"
---

# Design System: Madregot

## Overview

**Creative North Star: "The Friendly Staircase"**

Madregot means stairs, and the whole system is a staircase a student climbs a few steps of every day. The ground is plain white, the ink a soft navy, and everything the thumb can press is a chunky, rounded block standing on a solid lip that sinks when pressed. A winding path of round coins carries the student from lesson to lesson; each topic is a unit with its own chapter colour; the mascot מדי, a purple two-step stair block with a face, stands beside the next step and reacts to every answer.

The loop is Duolingo's (path, one big check button, a green or red panel after every answer, streak, XP) with its own identity: electric indigo instead of green as the brand, Fredoka and Rubik instead of a proprietary face, a stair block instead of an owl. The density is phone-first and generous: 44px minimum targets, one question per screen, the action dock within thumb reach. Colour is loud but semantic; every saturated hue has exactly one job.

The genre's pressure devices are absent by design and stay absent: no hearts or energy meters, no global league tables, no guilt-tinted states. A mistake is shown, crossed out and explained, never charged for. Shabbat is drawn as a calm rest day in the streak week, never as a break.

**Key Characteristics:**
- White ground, soft navy ink, electric indigo for action and selection.
- Semantic colour: green right, red not yet, orange streak, gold XP and finished nodes.
- Five chapter colours (sky, fuchsia, petrol, cobalt, violet), one per unit.
- Chunky pressable controls on a solid lip that collapses on press; nothing else gets a lip.
- Fredoka for the voice (headings, buttons, numbers), Rubik for reading, serif KaTeX for math, always LTR.
- Hebrew RTL throughout, phone-first, with a side rail and side panel from 960px.
- Short exponential ease-out motion; celebrations only after an answer, skippable, off under reduced motion.

## Colors

A bright, clean palette in which every saturated colour carries one meaning, set on white with soft navy ink.

### Primary
- **Electric Indigo** (brand): the primary action (the full-width check and continue buttons), the active tab, the selected choice, focused slots and inputs and the wordmark.
- **Deep Indigo** (brand-d): the lip under indigo buttons, indigo text on tints, the lesson-complete title.
- **Indigo Mist** (brand-tint): selected and active fills (tab, choice, segmented option, help tool), focus halos. Its border partner is a literal lavender line (#b9b3ff; #cfcaff on the tab), used for selected borders and their lip.

### Secondary (meaning colours)
- **Correct Green** (good, good-d, good-tint, good-ink): the lesson progress bar, the correct choice, the correct feedback panel, the "accuracy" stat. Green is the colour of being right.
- **Not-Yet Red** (bad, bad-d, bad-tint, bad-ink): the wrong choice (struck through), the struck answer slot, the retry and reveal feedback panels, the keypad minus key.
- **Streak Orange** (streak, streak-ink, streak-tint): the flame in the top bar, the combo count and combo pop, the streak screen and its week dots, the "comes back later" note.
- **XP Gold** (gold, gold-d, gold-ink, gold-tint): finished path nodes, the XP stat and counter, daily-goal and quest bars, hints.
- **Tutor Rose** (ai-tint, ai-ink): the AI help tool and the tutor's box. It is close to fuchsia by hue but never sits on a unit's path.

### Tertiary (chapter colours)
- **Sky, Fuchsia, Petrol, Cobalt, Violet** (ch-*): each topic owns one. The fill colours the unit's path coins and ring segments; the "-d" value is the unit band, the coin lip and coloured text; the tint is the unbuilt ring segments and the lesson's level line. Sky also marks streak freezes (snowflake, frozen week dot).

### Neutral
- **Paper** (#ffffff): the ground of every screen, cards, buttons at rest, docks.
- **Ground** (#f6f6fb): input fields, hover fills, rest-day dots, stat tiles on older screens.
- **Soft Navy Ink** (ink): all primary text and the mascot's eyes.

### The mascot's own colours
- **Madi Purple** (madi-hi, madi-lo, madi-edge, madi-tread, madi-limb): מדי's body, its 3D edge, the light on his treads, his arms, hands and feet. The brand's purple, kept by the product brief. Changing his colour is a change to these tokens only (a coral-and-teal version was tried on staging and set aside).
- **Slate** (ink-2): secondary text, inactive tabs, unpressed counts.
- **Hairline / Strong Rule / Press Rule** (rule, rule-strong, rule-press): borders of cards and controls, empty bar tracks; rule-press is the lip under white controls.

### Named Rules
**The One Meaning Rule.** Green means right, red means not yet, orange means streak, gold means XP and finished. No chapter colour is green, orange or gold, and none of the four is used for decoration.

**The Ink Value Rule.** Fills may be light; text always takes an "-ink" or "-d" value (4.5:1 or more on its tint or on white). White text sits only on brand, good, bad and "-d" chapter fills.

**The Indigo Acts Rule.** Indigo is where the student acts or has chosen: the primary button, the selected option, the active tab, focus. It never marks correctness.

## Typography

**Display Font:** Fredoka (variable, rounded Hebrew), with Rubik and Arial Hebrew fallback
**Body Font:** Rubik (variable), with Segoe UI and Arial Hebrew fallback
**Math:** KaTeX's serif (KaTeX_Main), isolated left-to-right

**Character:** Fredoka's soft round terminals give the app its friendly voice on headings, buttons and celebrated numbers; Rubik is the sturdy, readable Hebrew text face. The math is the only serif on screen, so an expression always reads as math.

### Hierarchy
- **Display** (Fredoka 600, 36px/44px): the lesson-complete, streak and quests-done titles.
- **Headline** (Fredoka 600, 28px/36px): page titles, the feedback panel verdict, the revealed answer.
- **Title** (Fredoka 600, 22px/28px): unit band titles, node card titles, card titles, sheet titles.
- **Button** (Fredoka 600, 18px, 0.01em): every chunky button; 22px on large buttons, 16px on small.
- **Question** (Rubik 600, 22px/32px, pretty wrap): the question text in a lesson.
- **Body Large** (Rubik 400, 18px/28px, 60ch max): leads under titles and on celebration screens.
- **Body** (Rubik 400, 16px/24px, tabular numerals): everything else.
- **Label** (Rubik 600, 14px/20px; 13px on tab labels): help tools, notes, stat labels.
- **Math Display** (KaTeX, 40px/1.2, centred): the expression of the current question; inline math runs at 1.08em and never wraps.

Celebration numerals are the one place type grows past the ramp: the streak count (Fredoka 700, 76px/80px) and the combo pop (Fredoka 700, 44px/52px).

### Named Rules
**The Rounded Voice Rule.** Fredoka speaks (headings, buttons, counts, stats); Rubik explains (questions, body, labels). Questions are Rubik so long Hebrew sentences stay readable.

**The LTR Math Rule.** Every expression is KaTeX in its own left-to-right isolate, and a short inline expression never splits across lines inside Hebrew text.

## Layout

A single phone column on a 4px grid (s1 to s12). Pages cap at 600px, the path at 560px, celebration screens at 520px, centred, with safe-area insets on every edge.

- **Path screen:** a sticky 60px top bar (grade switch at the reading start, then streak, freezes and today's XP of the goal), then units stacked 32px apart. Each unit opens with a sticky chapter band, then the path: coins 42px apart, swung sideways on an 8-step curve (0, 52, 78, 52, 0, −52, −78, −52 px) so the path winds. מדי stands 18px beside the current coin on the side away from the swing. A round jump-back button appears when the current coin scrolls away.
- **Lesson (three regions):** the screen is exactly `100dvh` and never scrolls as a page. A grid of three rows (`auto / minmax(0, 1fr) / auto`, every child `min-height: 0`): the **top region** (close, progress bar, combo or topic chip, and the question bubble with מדי pinned under it), the **maths region** (the expression, drawing, table or choices; the only part that scrolls, with soft scroll shadows), and the **bottom region** (the answer field, then the keypad, then one row with the help tools and the check button). The answer field sits in the bottom region directly above the keypad, so the keypad can never cover it; the hint, when open, sits just above the answer. The feedback panel replaces the keypad in the bottom region: its body scrolls, its button row never does. The maths region is a size container: a drawing is sized to the room it is given (`100cqh`), so it is always whole, small on a 320px phone and large on a laptop; on phones a small enlarge button on its corner opens it full width in a sheet. In a multiple-choice exercise the expression and the choices come right under the question as one group, and the space left over goes to the bottom, above the check button; typed exercises keep the maths centred in its region. Short phones (up to 700px tall) get a compact question bubble without מדי (he waits in the maths region when there is nothing to draw), a three-row keypad (1–5, 6–0, then − . / ⌫ and next field) and a feedback panel capped at 40dvh; with a typed answer the check button joins the answer row and the help buttons (hint, notebook) sit beside the progress bar, and the hint shows two lines first, with "עוד" under the word "רמז". From 900px wide (and 560px tall) the lesson becomes two columns: the maths on one side, the answer, keypad and feedback in a side column.
- **Navigation:** bottom tabs, five equal columns at 60px, under 960px; from 960px a 240px side rail with the wordmark, and the path gains a 320px side column (streak, goal, quests) 40px away.
- **Breakpoints:** 400px (tighter pips), 700px (sheets become centred dialogs, taller keys), 960px (rail and side panel).

## Elevation & Depth

Depth is physical and almost entirely structural: a solid, unblurred lip under pressable things, which collapses when pressed. Soft shadows are reserved for things that float over the page.

### Shadow Vocabulary
- **Lip** (`box-shadow: 0 4px 0 <lip colour>`): buttons and answer choices; the lip is the fill's "-d" value, or rule-press under white controls. Pressing translates the control down by the lip and removes it (80ms).
- **Small lip** (`box-shadow: 0 3px 0 <lip colour>`): keypad keys, segmented options, the grade switch.
- **Coin lip** (`box-shadow: 0 7px 0 <chapter -d / gold-d / #c9cad9>`): path coins.
- **Border lip** (`border-bottom-width: 4px`, 2px when pressed): pressable cards and banners (plan banner, linked cards, linked side cards) and the lesson's answer slots.
- **Lift** (`box-shadow: 0 2px 4px rgba(36,37,58,.06), 0 8px 24px rgba(36,37,58,.1)`): floating layers only: sheets, the node card, the jump-back button.
- **Dock** (`box-shadow: 0 -2px 6px rgba(36,37,58,.05), 0 -8px 24px rgba(36,37,58,.06)`): bottom docks on the older practice screens; the lesson dock uses a 2px top rule instead.

### Named Rules
**The Lip Means Press Rule.** A lip promises that something can be pressed, and pressing collapses it. Static content (stat tiles, plain cards, the feedback panel, chips) sits flat with a 2px rule.

**The Float Only Rule.** Blurred shadows are for layers above the page (sheets, the node card); nothing at rest on the page casts one.

## Shapes

Generously rounded, never sharp. Controls and cards use 16px corners, small buttons and the grade switch 10px, unit openers 20px; keys and slots sit between (12px, 14px). Help tools, chips and bars are full pills. Path coins, week dots, quest checks and the feedback icon are true circles; the current coin wears a ring of rounded, evenly gapped segments (one per lesson, 6px gaps, 2px corner) in its unit colour. Borders are 2px on every interactive surface and 1px only for list hairlines. The mascot's geometry (13px-rounded rectangles stepping up) echoes the same rounded block.

## Components

### Buttons
Tactile and confident: a fat rounded block on its lip.
- **Shape:** gently rounded (16px), 48px tall, 54px large, 40px small (10px corners); 2px border in the fill colour.
- **Primary:** indigo fill, white Fredoka text, deep-indigo lip. The check and continue buttons are full-width and large.
- **Secondary:** white fill, deep-indigo text, rule-strong border on a rule-press lip; inside a node card its text takes the unit's "-d" colour.
- **Good:** green fill and lip, for continuing after a correct answer.
- **Ghost:** no border or lip, indigo text, indigo-mist hover.
- **Hover / Press / Disabled:** hover brightens 4%; press sinks by the lip in 80ms; disabled is a grey block (rule fill, #8a8ca0 text) that keeps its shape.
- **Focus:** 2px indigo outline, 2px offset.

### Answer choices
- **Style:** white 60px block, 2px rule border, 16px corners, rule-press lip, a 30px key badge at the reading start.
- **States:** selected turns indigo mist with a lavender border and lip; correct turns green tint with green-ink text; wrong turns red tint, red-ink text, struck through. A three-number choice row centres its values and drops the badges.

### Answer slot and keypad
- **Slot:** `clamp(62px, 22vw, 104px)` wide × 56px, 26px bold LTR value (two slots never wrap, even at 320px), 2px rule border with a 4px bottom, 14px corners; focus is an indigo border with a 3px indigo-mist halo; a wrong answer stays in the slot, struck through in red, until a new one is typed.
- **Keypad:** the app's own keypad (phones have no minus key; fields use `inputmode="none"` so the phone keyboard never opens): four columns of white keys `clamp(40px, 6.3dvh, 52px)` tall with a small lip, Rubik 24px; the minus key is red ink; pressing sinks 3px in 60ms. With two answer fields the last key moves to the other field (two-arrows icon, "מעבר ל…"); otherwise 0 spans three columns. Every key has a spoken name (מינוס, שבר, נקודה עשרונית, מחיקה). On a computer, digits typed anywhere on the exercise go to the active field and Enter checks, then continues.
- **Tools row:** hint, tutor, notebook (and "למורה" in a class) as compact icon-over-label buttons sharing one row with the check button.

### Feedback panel (signature)
Rises 24px from the bottom in 250ms when an answer is checked and replaces the dock. Correct is green tint with a green top rule; "not yet" (retry) is warm gold with a gold button, never alarm red; the revealed answer is rose tint with a pink top rule. It holds מדי (cheer, oops or think), the headline verdict in the panel's ink, then the body: the correct answer at headline size, the worked solution as a staircase (one numbered step at a time, each a little further in, with a "השלב הבא" button), and the tutor's note as plain text under a rule (never a card inside the panel). Announced assertively.

### Path stair and lesson marks (signature)
- **Stair block:** a 70px rounded-square block (30% corners) with a lit top band, a 9px solid riser in the edge colour and a soft drop; the current stop is 78px, the unit's trophy 86px. The app is named for stairs, so the stops are stairs, not coins. Glyphs are solid white SVG with a 2px drop.
- **States:** locked is a pale grey stone with a grey lock; current wears the unit colour, floats 5px on a 2.8s loop, breathes a halo in its colour and carries one mark per lesson under it and the "התחלה" / "המשך" bubble; done is gold with a dark-amber check; mastered (the unit's review passed) is gold with a crown and a light glint every 5s; the unit's last stop is a trophy.
- **Lesson marks:** white pills under the current stair that fill in the unit colour as lessons finish (in the reading direction); back from a lesson, the earned one fills 260ms after arrival.
- **Treasure chest:** halfway along each unit a wooden chest sits on the road: shut and greyed until the stair before it is done, then open with coins and rays. Coming back from the lesson that reached it, the lid springs open. It counts as the "תיבת אוצר" medal, computed from the saved path only.
- **Completion:** back on the map after a lesson that finished a stop, that stop springs in from 70% scale and throws eight gold, white and unit-colour flecks.
- **Node card:** a 320px white card under the stop with a 2px unit-colour border, a pointer, a lift shadow, a Fredoka title and one full-width button.

### Continue card
The learn screen opens on one card: the next stair's emblem in the unit colour, its title, "יחידה N, title: x מתוך y מדרגות", a progress bar and a round play button; under it two chips (stairs climbed in the grade, things to strengthen) that jump to the level board. The map follows directly under the card.

### Level board (signature)
The board sits below the map (the placement result scrolls to it once). A Fredoka title with the mascot, one line of stairs climbed in the grade, and a 14px track split into one pill segment per topic (as long as its stairs, chapter tint filled in the chapter colour from the reading start). Topics sit in one 2px-bordered, 20px-rounded list with 2px dividers, not cards: each row is a stair meter with a done/total count in the chapter's dark colour, the topic name, the current stair and a status pill (done gold, on the way chapter tint, needs work red tint, not started ground). Under a row, "what is not clear yet" sits in a ground-filled block with each misconception and a small secondary "practise" button; cleared ones collapse into one green line. Under 400px the pill moves under the name.

### Stair meter
One rounded bar per level, rising from 14px to 32px toward the reading direction (right to left), 11px wide (9px when a topic has more than six levels). Done steps fill in the chapter colour, the current step in its tint (filling from its foot as lessons finish), the rest in rule grey. It is the product's own level meter: it appears on the board, on the placement result and in the onboarding answers.

### Screen headers (page scenes)
Every screen's header pairs the title and one line about the screen with its scene, drawn in code in the screen's colour: מדי on a two-step stair beside the one thing the screen is for (an open chest for quests, a checked sheet for exams, a phone scanning a page for exam checking, a printed sheet and pencil for a practice exam, a flagged staircase for the plan, a maths speech bubble for the assistant, world tiles for the topics, a board with a graph for the teacher). No stock illustration. The topics list and each topic's page open on the same world landscape as the unit on the map.

### First screen (welcome)
It says what Madregot is and for whom in one Fredoka headline ("תרגול מתמטיקה לכיתות ז׳ וח׳, מדרגה אחרי מדרגה"), one line of real numbers counted from the content (topics, stairs, minutes a day), and then shows the product itself: a live number line from the first stair (−2 + 5) to drag before signing up, with מדי describing each jump and the card turning green when it lands on 3. Nothing is saved. The two buttons follow; on a short phone they stay at the bottom while the demo stays whole above them. The hero enters once.

### Onboarding question
One question per screen: a back arrow and an indigo progress bar on top, the mascot asking in a 2px-bordered speech bubble whose tail points at him, answers as 68px chunky rows (2px border, 4px lip; selected is indigo mist with a lavender lip and indigo title), and a sticky full-width button at the bottom. Small gold pills mark a recommendation.

### Unit band and the unit's world (signature)
- **Band:** sticky, 22px corners, a diagonal gradient from the unit colour to its "-d", white text, a white 58px emblem tile with the unit's first piece of scenery, a number tile, the title, a one-line description, a thin white progress bar with done/total, and an outlined guidebook button. A soft coloured drop, no lip (it is not pressed).
- **World entrance:** each world opens with its own landscape behind its first stairs (168px, drawn in SVG in the unit's colours): a valley of frost on the left (below zero, as on a number line) and fire on the right for signed numbers; an island on a gridded sea with an X for coordinates; sharp peaks with an angle marked and a gear sun for angles; a city whose road is a straight line rising at a steady slope for linear functions; pyramids of square blocks among dunes for Pythagoras; market towers of different heights with the mean line across for statistics.
- **World ground:** under the landscape, the land follows the topic: cold to warm left to right (signed numbers), a faint grid (coordinates, linear functions), sand dots (Pythagoras), or the unit's tint fading to white, with 32px bottom corners.
- **Road:** a white road (21px) with a faint edge runs through the stop centres as smooth curves; the stretch walked so far is laid over it in the unit colour at half strength, and stepping dots run along it. Back from a lesson in that unit, the newest leg draws itself in (0.9s).
- **Scenery:** three pieces of the topic's own world stand beside the stops the road swings away from, never beside the stop where מדי stands: a thermometer, the sea line and a cloud (signed numbers); a treasure grid, a compass and a pin (coordinates); a protractor, peaks and a kite (angles); slope stairs, a ramp with a flag and a paper plane (linear functions); the squares on a right triangle, a ladder and a pyramid (Pythagoras); a bar-chart skyline, a pie chart and dice (statistics). Drawn flat in the unit's fill, edge, tint, white and gold.

### Mascot מדי (signature)
An SVG purple two-step stair block with a light-to-deep gradient, lighter treads, a highlight, a plus sign on the lower step, feet, hands and a face with brows. Motion drives six states from real events: idle (breathing and a blink every 3–5s), happy (a hop and a wave, replayed on every right answer), thinking (head tilt, eyes up, a question bubble while a hint or the notebook is open), encouraging (a lean and a thumbs up after a wrong answer), excited (two jumps and sparkles after a lesson) and achievement (a gold star held high for a unit, a perfect lesson, a placement). Arms, brows and pupils spring between poses; mouths cross-fade. He stands beside the current stop, asks each question from beside its speech bubble, and leads every celebration. Under reduced motion he holds still poses.

### Exercise screen (signature)
- **Top:** a close button, the lesson as a short staircase of results (one step per exercise, rising in the reading direction: green right away, gold when fixed on the second try, hatched rose when the answer was shown and green once it is solved on its return, the current step outlined in indigo), and the combo as an orange chip that pops in from two in a row. A placement test keeps a plain bar.
- **Question:** מדי (68px) on the reading-start side, the question in a white speech bubble with a 2px border and a tail pointing at him; the expression on a squared-paper card (22px grid in the unit tint, 20px corners).
- **Answers:** chunky choices with a 4px lip that shrink to 96% under the finger; a right one turns green and swaps its number for a check, a wrong one red with a cross. Answer slots turn green on a right answer.
- **Feedback:** the panel springs up from the bottom; its mark is a disc that pops in, with a check that draws itself and a small burst of green and gold dots, or a soft cross. Each question slides in from the reading side and the last one leaves the other way.

### Daily quests (missions)
Each quest is a mission tile: an icon in a tinted square, the mission name, a gold progress bar that fills with a spring when the screen opens, and a round tick that turns green when it is done. Above them, a chest (Lottie, held on its first frame, opened to its last frame when every quest is done) with מדי and one line about the reward. Under 560px the tiles stack.

### AI assistant states
When the assistant has no connection, the tabs are replaced by one honest panel: מדי, what the assistant can do (three rows), "להמשיך לתרגל" and "איך מחברים את העוזר" (opens the AI settings on the profile). Results and errors scroll themselves into view above the tab bar (`scroll-padding-bottom` covers the bar and the safe area). Chat replies carry a small מדי avatar that thinks while the answer is on its way.

### Celebrations
- **Lesson summary:** confetti (Lottie, once) behind the hero, מדי excited (or holding the star), a Lottie trophy when the lesson finished a unit, stars when it had no mistakes. Medals pop in on ribbons for what the lesson really earned (a finished stair or unit, no mistakes, mistakes fixed, the daily goal), then three stat tiles rise in one after another and the XP counts up.
- **Streak:** a looping Lottie flame over the number, which ticks up from yesterday's value; the week's dots pop in left to right.
- **Daily quests done:** a treasure chest opens (Lottie); a snowflake marks an earned streak freeze.
- Confetti is left out under reduced motion; the other animations hold a still frame.

### Screen header
Every secondary screen opens on its own land: a soft gradient in the screen's colour (exams sky, quests orange, plan petrol, assistant rose, profile indigo, practice exams fuchsia), two faint circles of the colour, a Fredoka title in the colour's dark, one line about the screen, and an unDraw illustration in the brand indigo (or מדי). Full-bleed with 32px bottom corners on phones, a 28px card from 640px.

### Medals
A medal is an SVG disc with a darker rim, a highlight arc and a two-colour ribbon, a white icon and a caption. Tones: gold, indigo, green, orange and the unit colour. On the profile, medals not earned yet are grey with how far along they are. Medals only ever reflect real history.

### Motion system
Motion for React through LazyMotion (DOM animation features only) and MotionConfig that follows the device's reduced-motion setting. Screens rise 12px into place as they open; celebration content staggers in by 90ms; springs for anything that answers a touch; CSS for loops (the floating stop, the halo, the start bubble, the mastered glint). Lottie (light player) loads on demand only on celebration screens, with a static fallback when it cannot load.

### Top bar and stats
Streak, freezes and XP are Fredoka 22px counts with their icon in the meaning colour (orange flame filled when the streak is alive, grey when not; sky snowflake; gold bolt). Celebration stats are three bordered tiles with a solid label strip in gold, green-dark or indigo and a Fredoka value in the matching ink.

### Cards / Containers
- **Corner Style:** 16px.
- **Background:** paper, 2px rule border, flat; linked cards gain the border lip.
- **Internal Padding:** 16px, 12px gaps.
- **Box:** tinted notes (indigo, red, gold, green, rose) with a 2px matching border and a Fredoka title in the box ink.

### Help tools and chips
Pill-shaped 40px tools (36px in the dock) with a 2px rule border and slate text; the AI tool is rose; an active tool is indigo mist. Status chips are tinted pills in the meaning colours.

### Inputs / Fields
- **Style:** 50px, ground fill, 2px rule border, 16px corners, 18px text.
- **Focus:** indigo border, fill turns paper.
- **Error:** red-ink message text under the field.

### Navigation
Hover styles apply only where a pointer can hover, so a tap on a phone never leaves a lit state; screens clip anything wider than the phone instead of scrolling sideways. Five tabs (לימוד, משימות, מבחנים, עוזר AI, אני) with 26px line icons and 13px labels; the active tab is an indigo-mist block with a lavender border and a heavier icon stroke. From 960px they become a side rail of 52px rows with hover in ground.

### Streak week
Seven 36px day dots: practised days solid orange with a white flame, frozen days sky tint with a snowflake, Shabbat a ground-grey dot with a moon (a rest day, never a broken day), today ringed in indigo mist.

### AI thinking line (exception)
While the tutor works, a slate label shimmers with a gradient-clipped highlight and swaps labels with a blur-and-rise (transitions.dev "thinking states"). This is a contained, recorded exception for loading text only; gradient-clipped text is not a device for any other surface, and under reduced motion the shimmer is removed.

## Do's and Don'ts

### Do:
- **Do** put every primary action in one full-width indigo button on its lip, within thumb reach in the bottom dock.
- **Do** give anything pressable a lip that collapses on press (translate by the lip, 80ms ease-out), and nothing else.
- **Do** keep each meaning colour to its one job: green right, red not yet, orange streak, gold XP and done nodes.
- **Do** colour a unit's coins, ring, band and level line from its chapter colour, with text in the "-d" value.
- **Do** set headings, buttons and counts in Fredoka 600, questions and text in Rubik, math in KaTeX inside an LTR isolate.
- **Do** keep a wrong answer visible, struck through in red ink, next to the hint.
- **Do** play celebrations (combo pop, mascot cheer, streak tick) only after an answer, let a tap skip them, and switch them off under reduced motion.
- **Do** keep targets at 44px or more and text at 4.5:1 or more.

### Don't:
- **Don't** use Duolingo's green as the brand, or its owl, name, typeface or art.
- **Don't** draw hearts, lives or energy meters, global or league leaderboards, or guilt-tinted states.
- **Don't** draw Shabbat as a missed or broken day in the streak.
- **Don't** make a chapter colour green, orange or gold, or use those colours decoratively.
- **Don't** put a lip or a blurred shadow on static content (stat tiles, plain cards, the feedback panel, chips).
- **Don't** nest a card inside the feedback panel; the tutor's note is text under a rule.
- **Don't** use gradient-clipped text outside the AI thinking line.

### Interactive maths objects (signature)
An exercise can be an object to move instead of an answer to type (form "manip"), checked exactly from its state: a marker on a number line (cold-to-warm ground, the jump drawn as an arc with its signed size), a point on the plane (tap a crossing or drag; dashed guides to the axes, no coordinates printed), a line built from two handles (the intercept on the y-axis and one step to the right; the equation above follows every move, m in amber and b in indigo everywhere), a ray turned on a straight line (the live equation "θ + ? = 180°"), the legs of a right triangle with a square on every side showing its area (the readout sums them against the target), and the last bar of a chart dragged to a target mean (a live mean line and a dashed target line).
- **Canvas:** a 22px-cornered card tinted in the unit colour with a 2px border and a 4px lip, as large as the room allows (it shrinks before anything else on a short phone). The drawing reads left to right inside the Hebrew page.
- **Ways to move it:** drag (pointer capture, snapping to whole units), tap, arrow keys on the focused drawing, and chunky 44px step buttons under it with a short label (a longer name where there is room). Checking is off until the object has moved, and again after "not yet" until it moves again.
- **מדי as companion:** on a screen with room he stands under the object and says what just happened ("from 4 you jumped 3 to the right; right is adding"), never whether it is right.
- **Hints drawn on the object:** with a hint open, a dashed indigo guide appears on the drawing itself (the direction on the number line, the 180° of the straight line, the band where b lives and the column x = 1, the names of the quadrants, the square on the hypotenuse, the total the bars must reach). A guide, never the answer.
- **Reveal:** the right state is drawn as a dashed green ghost beside the student's.

### End of a lesson: the climb (signature)
The unit's staircase (one block per level, rising in the reading direction, the done ones in the unit colour with a light tread), with מדי hopping up to the step the lesson completed or bouncing on the step in progress (its part filled). Then the title, the numbers (XP, accuracy, time) and the medals rise in one after another. On a short phone the stairs shrink and the button stays at the bottom. Under reduced motion everything is simply there.

### Motion system
One scale for every animation (`src/lib/motion.js`, matching the CSS tokens): the smooth-out easing, durations from 80ms (micro) to 500ms (very slow) plus a 900ms draw for paths, and springs by role: settle (a panel arriving, no overshoot), pop (a reward or a chip), bounce (a celebration: the streak number, the chest lid, a stair just completed), soft (the mascot's limbs), lean and fill. Movement answers what the student did; the only idle loops are the current stair's float, its halo and מדי's breathing. Under reduced motion transforms stop and opacity stays.


## Layouts after Duolingo and Brilliant (9 November 2026)

> Superseded in part the same day by the structural rebuild: the full, measured screen-by-screen specification is in
> `LAYOUT_SPEC.md` (home is the path, practice follows Duolingo's measured exercise skeleton, lessons follow
> Brilliant's measured step layout, settings are their own screen, Exam Rescue details are a one-question flow).

At the owner's request the screens now follow the layouts of two apps students already know. The layout structure
is borrowed; the colours, fonts (Fredoka, Rubik), icons, maths rendering and מדי stay Madregot's own, and no art,
mascot, wording or brand asset of either app is used. Code: `src/styles/v4.css` (the layout layer, loaded last) and
`src/components/ds.jsx`. This replaces the short-lived "v4" riser/staircase language of 8 November.

### Duolingo's layout: the daily loop
- **Look:** a white page; flat cards with a 2px border and no shadow; solid buttons on a lip; thick progress bars
  with a highlight stripe.
- **Home:** the daily quests card first (header with the time it takes, one row per part: an icon tile, the title,
  and a thick bar with the count written inside, then one big button), the exam entry as its own card, then the path.
  Each unit has a sticky banner in its colour ("יחידה N · X מתוך Y מדרגות", the title, the guidebook behind a divider);
  a stop's card opens in the unit's colour with a white button. The mastery snapshot sits under the path.
- **Practice:** a close button and one thick continuous progress bar; מדי large beside a bordered speech bubble with
  the question; the maths in the middle of a plain white page; the answer and a full-width check button at the
  bottom; after checking, the coloured result strip (green / gold) with its button.
- **Results:** the lesson-complete layout: מדי, the title, stat tiles with a coloured label strip (correct, XP), and
  the next step at the bottom.
- **Missions:** a progress card with the thick bar ("1 / 3"), then one bordered card per quest.
- **Profile:** stat tiles (icon, number, label) in a grid, the next step, the stairs that need work, the medals.

### Brilliant's layout: the lessons
- **Teaching stages A, B, C and every remedy:** a thin segmented bar on top; the text first, large and plain, with a
  small מדי beside it; the maths or the object to move on a light panel in the middle; answer cards across the width
  (no numbers, centred). The student selects, then presses "בדיקה" at the bottom; the bottom bar turns into a result
  strip ("נכון!" in green, "ניחוש טוב לבדוק" / "עוד לא" in yellow, never red) with "המשך"; the explanation appears in
  the text above. Worked examples reveal their steps on the panel one at a time.
- **The stair page:** a course outline. The header with the next step, a thin bar of the five stages and the button;
  then the five stages as nodes on one vertical line (done ones green with a check, the current one filled in the unit
  colour with a ring), each with its own button.

### Shared pieces (`ds.jsx`)
- `Segments` (thin for a lesson's steps, thick for a breakdown such as exam readiness), `Bar` (a thick bar with its
  count inside), `Badge`, `Stat` (a stat tile), `StateCard` (empty, error, celebration).
