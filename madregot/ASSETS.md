# Third-party visual assets and credits

All files below were downloaded on **2026-11-06**. Paths are relative to `madregot/web/`.
Licences were checked on each source page on that date, not assumed.

## 1. Lottie animations (`src/assets/lottie/`)

Source: [LottieFiles](https://lottiefiles.com) free animations. Every source page below says
"Free to use under the Lottie Simple License".

**Licence:** Lottie Simple License (FL 9.13.21), Copyright © 2021 Design Barn Inc.
(<https://lottiefiles.com/page/license>).
- Free use, including commercial use. You may modify, publish and distribute.
- Attribution is not required, though "strongly encouraged". If you include one, the end user should be able to see it.
- Any distribution of the files, and any modified versions, stays under the same licence terms. This file records that.
- The licence does not allow collecting or compiling files from LottieFiles to build a similar or competing service.

**Modification:** none. Each file is the creator's original Lottie JSON variant from the page's asset
list (not LottieFiles' auto-"optimized" copy), renamed only. All files are vector-only: no embedded or
external raster images, no text layers, no expressions, no background layer (transparent).

| File | Used for | Source page | Author (LottieFiles user) | Size | Timing | Plays |
|---|---|---|---|---|---|---|
| `src/assets/lottie/confetti.json` | Behind every celebration screen (lesson, placement result, daily quests); left out under reduced motion | [confetti-coMR5KBYrt](https://lottiefiles.com/free-animation/confetti-coMR5KBYrt) | Jacques Mauriac (`jojolafrite`) | 30,454 B | 29.97 fps, 59 frames = 1.97 s, 800×800 | once (burst, ends empty) |
| `src/assets/lottie/trophy.json` | Lesson summary when the lesson finished a unit | [trophy-OJxKdZoIJh](https://lottiefiles.com/free-animation/trophy-OJxKdZoIJh) | Lucas Nemo (`LucasNemo`) | 47,829 B | 29.97 fps, 60 frames = 2.00 s, 550×400 | once (rises, stars pop, settles) |
| `src/assets/lottie/flame.json` | Streak screen after the day's first lesson (a still frame under reduced motion) | [calm-flame-oIGx0ljGQN](https://lottiefiles.com/free-animation/calm-flame-oIGx0ljGQN) | Pavel Breiva | 24,105 B | 30 fps, 22 frames = 0.73 s, 300×250 | loop |
| `src/assets/lottie/chest.json` | "All daily quests done" screen | [chest-opening-4hibEWv4bu](https://lottiefiles.com/free-animation/chest-opening-4hibEWv4bu) | del veritas | 71,347 B | 60 fps, 69 frames = 1.15 s, 1282×1282 | once (gold chest opens) |
| `src/assets/lottie/stars.json` | Lesson summary of a lesson with no mistakes | [tap-burst-4iFocfda2b](https://lottiefiles.com/free-animation/tap-burst-4iFocfda2b) | Eddy (`eddymakes`) | 9,395 B | 30 fps, 30 frames = 1.00 s, 100×100 | once (violet/gold star burst, ends empty) |
| `src/assets/lottie/xp-star.json` | Quests screen: the daily-goal card once today's XP reaches the goal | [star-08vFCarDfk](https://lottiefiles.com/free-animation/star-08vFCarDfk) | Animo Arts (`animoarts`) | 23,224 B | 30 fps, 50 frames = 1.67 s, 200×200 | once (outline star fills gold, sparkles) |
| `src/assets/lottie/snowflake.json` | "All daily quests done" screen, when it earns a streak freeze | [snowflake-M8zVa44dtf](https://lottiefiles.com/free-animation/snowflake-M8zVa44dtf) | Manda Batkhishig | 6,429 B | 29.97 fps, 30 frames = 1.00 s, 24×24 | once (flake grows in, ends full) |

Direct file URLs downloaded (each page's original JSON variant):
- confetti: `https://assets-v2.lottiefiles.com/a/b48a863e-1150-11ee-8fb8-9fe971b7941f/60ig8F7iw1.json`
- trophy: `https://assets-v2.lottiefiles.com/a/a4e9145c-1150-11ee-a111-5f0b42c20def/6Lkpn1JCKE.json`
- flame: `https://assets-v2.lottiefiles.com/a/4d275eba-1185-11ee-ade9-df7c94170384/WF2cQHwSj8.json`
- chest: `https://assets-v2.lottiefiles.com/a/a4872402-1152-11ee-984f-6ba8d60fbcb1/ecJeCjmRzV.json`
- stars: `https://assets-v2.lottiefiles.com/a/77821d00-1179-11ee-ac08-7b1fa0459534/IZfELFLIgZ.json`
- xp-star: `https://assets-v2.lottiefiles.com/a/1b2cc498-1178-11ee-ac1c-3fbdcdfcd8bd/pItyjxHEcS.json`
- snowflake: `https://assets-v2.lottiefiles.com/a/66bb0880-1181-11ee-bc80-7b7fdd26324c/zRqgy05OeO.json`

Notes:
- `chest.json` is a little more shaded than the rest (soft drop shadow, darker edges). It sits low-left in its canvas because the lid opens up and to the left.
- `stars.json` opens with a soft lavender ripple circle (frames 0–10) before the stars fly out.
- Considered and rejected:
  - "Fire" (`fire-NG4n3YU51z`) describes itself as an animated Noto Emoji from Google, which has its own licence (CC BY 4.0), so its licence is mixed.
  - Several gold-coin animations were uploaded by more than one account or credit someone else, so their author is unclear.
  - Grey-to-lit "streak" flames were too close to Duolingo.

## 2. Illustrations (`src/assets/illustrations/`)

Source: [unDraw](https://undraw.co) by **Katerina Limpitsouni**. Each SVG was downloaded with the
site's own "Download SVG" button after setting the colour picker to `#5b4ff0`.
The site recolours `fill="#6c63ff"` to the chosen colour and adds `artist="Katerina Limpitsouni"
source="https://undraw.co/"` to the root `<svg>`.

**Licence:** unDraw License (<https://undraw.co/license>), Copyright 2026 Katerina Limpitsouni. As read on 2026-11-06:
- Free for commercial and non-commercial use. No permission or credit is needed. You may copy, modify and distribute.
- **Not allowed:**
  - compiling the assets to replicate a similar or competing service;
  - distributing the assets in packs;
  - extending that to automated or manual linking, embedding, scraping, searching or downloading of the assets without unDraw's consent.
- **Not allowed:** using the assets to train, fine-tune, validate or test AI/ML models, or any automated processing for AI/ML development.
- Brand logos in some illustrations remain their owners' trademarks. None of the files below contain logos.
- The page's short summary says illustrations are fine for improving an app's appearance. It also says not to proceed if unDraw illustrations are "in the center of what you are doing" (selling or redistributing them, training AI, "add them in an app"). Here they are decorative empty-state and section art, not a feature built around unDraw.

**Modification:** accent colour set to `#5b4ff0` (unDraw default `#6c63ff`), using unDraw's own colour picker; file renamed.
No other changes. Checked: every `#6c63ff` in the CDN original became `#5b4ff0`, and no `#6c63ff` or `currentColor` is left.

| File | Used for | Source page (unDraw title) | Author | Size | Modification |
|---|---|---|---|---|---|
| `src/assets/illustrations/exams-empty.svg` | Exams screen, empty state | [Grading Papers](https://undraw.co/illustration/grading-papers_lty0) | Katerina Limpitsouni | 6,027 B | accent → `#5b4ff0`; renamed from `undraw_grading-papers_lty0.svg` |
| `src/assets/illustrations/upload.svg` | Uploading / scanning pages | [Files Uploading](https://undraw.co/illustration/files-uploading_qf8u) | Katerina Limpitsouni | 7,357 B | accent → `#5b4ff0`; renamed |
| `src/assets/illustrations/assistant.svg` | Asking questions / tutor chat | [Question Answered](https://undraw.co/illustration/question-answered_ezyn) | Katerina Limpitsouni | 9,860 B | accent → `#5b4ff0`; renamed |
| `src/assets/illustrations/plan.svg` | Progress / plan / goals | [Stepping Up](https://undraw.co/illustration/stepping-up_i0i7) | Katerina Limpitsouni | 5,648 B | accent → `#5b4ff0`; renamed |
| `src/assets/illustrations/teacher.svg` | Teacher area / teaching a class | [Visual Explanation](https://undraw.co/illustration/visual-explanation_vd4l) | Katerina Limpitsouni | 12,577 B | accent → `#5b4ff0`; renamed |
| `src/assets/illustrations/achievements.svg` | Achievements | [Winner](https://undraw.co/illustration/winner_x40e) | Katerina Limpitsouni | 5,614 B | accent → `#5b4ff0`; renamed |
| `src/assets/illustrations/study.svg` | Studying / math | [Math](https://undraw.co/illustration/math_ldpv) | Katerina Limpitsouni | 7,993 B | accent → `#5b4ff0`; renamed |
| `src/assets/illustrations/empty.svg` | Generic empty state | [Empty Mailbox](https://undraw.co/illustration/empty-mailbox_ef0e) | Katerina Limpitsouni | 2,947 B | accent → `#5b4ff0`; renamed |

All eight are from unDraw's current illustration series (served from `cdn.undraw.co/illustration/`), so they share one look.
They are plain vector SVGs: no `<image>`, no `data:` URIs, no scripts, no external references.
`exams-empty.svg` shows a Latin "A" grade mark on the paper.

## 3. Code libraries used for visuals

Versions are from `web/package.json`. Licences were confirmed in `node_modules/*/package.json` and LICENSE files.

| Package | Version | Licence | Copyright / project |
|---|---|---|---|
| `lucide-react` | 1.61.0 | ISC | Lucide Icons and Contributors (<https://lucide.dev>) |
| `motion` | 12.23.24 | MIT | Matt Perry / Motion (<https://motion.dev>) |
| `lottie-web` | 5.12.2 | MIT | Airbnb (<https://github.com/airbnb/lottie-web>); LICENSE: "Copyright (c) 2015 Bodymovin" |
| `katex` | 0.16.22 | MIT | Khan Academy and contributors (<https://katex.org>) |
| `@fontsource-variable/fredoka` | 5.3.0 | OFL-1.1 | Font: Copyright 2016 The Fredoka Project Authors |
| `@fontsource-variable/rubik` | 5.3.0 | OFL-1.1 | Font: Copyright 2015 The Rubik Project Authors |

## 4. Mascot

מדי, the mascot, is original to Madregot: an indigo two-step stair block with a face and a plus sign on its lower
step (`web/src/components/Mascot.jsx`). It is drawn in SVG and animated with Motion (`motion/react`), with six states
driven by app events: idle (breathing, blinking), happy (a hop and a wave after a right answer), thinking (head tilt,
question bubble while a hint or the notebook is open), encouraging (a lean and a thumbs up after a wrong answer),
excited (two jumps and sparkles after a lesson) and achievement (a gold star held up for a unit, a perfect lesson,
a placement result). Under reduced motion it holds still poses.

Rive was considered and not used: no marketplace character could be our own mascot, a Rive file has to be authored in
the Rive editor, and the runtime adds a WebAssembly download to the first screen. No third-party character or mascot
assets are used.

The map scenery (thermometer, sea line, treasure grid, compass, protractor, peaks, kite, slope stairs, ramp, paper
plane, the squares on a right triangle, ladder, pyramid, bar chart, pie chart, dice) and the reward medals are
original SVG drawn for Madregot (`web/src/components/map/Scenery.jsx`, `web/src/components/RewardBadge.jsx`).

## 4. Original artwork drawn in code (no third-party source)

Everything below was drawn for Madregot as SVG in the source code. None of it is copied or traced from another app; the research that informed the design looked at store screenshots only and no image from it is in the repository.

| Where | What |
|---|---|
| `src/components/map/WorldBackdrop.jsx` | the six world entrances on the map (frost and fire valley, gridded-sea island, angle peaks, slope city, square-block pyramids, market towers) |
| `src/components/map/Chest.jsx` | the treasure chest halfway along each unit |
| `src/components/map/Scenery.jsx` | the scenery pieces beside the stops |
| `src/components/Climb.jsx` | the staircase at the end of a lesson |
| `src/components/manip/*.jsx` | the interactive maths objects (number line, plane, line builder, angle, Pythagoras squares, bars) |
| `src/components/Mascot.jsx` | the mascot מדי |
