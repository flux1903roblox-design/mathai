# Mobile UI and interaction patterns from top phone learning apps, adapted for a Hebrew (RTL), phone-first math practice app for grades 7-8

Scope note for the report writer: Duolingo publishes the most about its own design. The other apps named in the brief (Prodigy, Elevate, Headway, Speak, Ling, Babbel) have little public design writing, and I found nothing reliable on most of them (see Gaps). Many exact measurements of "Duolingo style" come from third-party, reverse-engineered design-token write-ups, not from Duolingo. They are labelled that way below. Platform and standards facts (WCAG, MDN, Material, MathML Core, Google Fonts metadata) are primary sources and were checked directly. Everything under "Inferences" is my design recommendation, built on the cited findings. It is not a sourced fact.

## Onboarding: placement test vs. choosing a level, first lesson before signup, goal setting, time to first question

### Takeaway
The best apps let the learner answer real questions before creating an account. They ask a few quick self-segmentation questions first: goal, level, and whether to take a placement test. Signup is offered after the first lesson, framed as "save your progress". Brilliant goes further: a visitor can solve a problem on the landing page itself.

### Cited Findings
- Duolingo has learners self-segment by experience level. "Brand new users can jump right into the 101-level material", and learners with some experience can take a placement test that "starts off easy and gets harder according to performance". — [Appcues GoodUX: Duolingo onboarding](https://goodux.appcues.com/blog/duolingo-user-onboarding)
- At Duolingo, signup is optional at first. Learners can keep going without an account, but some features (e.g. leaderboards) stay locked. Registration prompts appear "after users complete lessons," and "signup is optional, but becomes increasingly compelling over time as users wish to save their progress." — [Appcues GoodUX](https://goodux.appcues.com/blog/duolingo-user-onboarding)
- A product teardown says Duolingo doesn't ask for signup until after the first lesson, when it asks you to save your progress. This comes from a search-result summary; I did not read the full article. — [Product Breakdown, Medium](https://medium.com/product-breakdown/product-breakdown-3-learnings-from-the-duolingo-app-7cb4a2e15cb3)
- A recorded Duolingo onboarding shows the mascot speech bubble "Just 7 quick questions before we start your first lesson!". The sequence runs splash, welcome, mascot calibration questions, language choice, a loading screen with the owl, then the first lesson with a progress bar. The same teardown advises against putting account setup before the first learning choice. — [ScreensDesign: Duolingo onboarding design](https://screensdesign.com/articles/duolingo-onboarding-design/)
- Duolingo A/B tested delayed signup, i.e. forced signup vs. letting users sample first. I could not open the article (redirect loop), so its result figures are unverified. An Appcues list claims delayed signup drove a "20% lift in daily active users", but that snippet cites no source. — [Taplytics (title/summary only)](https://taplytics.com/blog/duolingo-ab-test-onboarding); [Appcues: 10 best onboarding experiences](https://www.appcues.com/blog/the-10-best-user-onboarding-experiences)
- A low-quality 2024 teardown says Duolingo's intro lesson now takes about 2 minutes, down from 3-4 minutes in 2022. The methodology is unknown, so weigh it lightly. — [junoschool.pages.dev (low confidence)](https://junoschool.pages.dev/article/duolingo-onboarding-experience/)
- Daily goal tiers are Casual, Regular, Serious and Intense. On mobile they are reported as 5, 10, 15 and 20 minutes a day; on desktop or in older versions as XP targets (10, 20, 30 and 50 XP). Third-party guides disagree on whether the choice is still offered. — [The Huntswoman](https://thehuntswoman.com/change-daily-goal-on-duolingo/); [Lingoly (Jan 2026)](https://lingoly.io/change-duolingo-daily-goals/)
- Duolingo separated the streak from the daily goal, so one lesson now extends the streak. In the A/B test this raised Day-14 retention 3.3%, daily active learners 1%, daily learners on a streak 10.5% (within 20 days), new learners on a streak 19%, and learners on a 7+ day streak by "over 40%". A year later, just over half of daily learners had a 7+ day streak, up from about a third. Learners with the "intense" goal had been less likely to keep a streak. — [Duolingo blog: Improving the streak (Nov 2020)](https://blog.duolingo.com/improving-the-streak)
- Brilliant's web landing page puts interactive problem previews in the hero, so visitors solve something before signing up. — [Landing Doctor teardown of Brilliant](https://landingdoctors.com/teardowns/brilliant-org)
- Duolingo Math launched with beginner and intermediate tracks, which acts as a coarse level choice. Its launch post cites "93% of U.S. adults have experienced at least some math anxiety", one reason for the low-pressure framing. — [Duolingo blog: Duolingo launches Math app](https://blog.duolingo.com/duolingo-launches-math-app/)

### Inferences
- Recommended first-open flow for grades 7-8, with a target of the first real question in 60 seconds or less and 5 or fewer taps:
  1. Splash, with the mascot and one line ("בוא/י נתרגל מתמטיקה").
  2. "Which grade?" (ז׳ / ח׳) as two large tiles.
  3. "Where do you want to start?" with two choices: "From the beginning of the year" or "Short placement quiz", which is adaptive, 5-8 questions, easy to hard, as in Duolingo's placement.
  4. Daily goal, 3-4 tiles (e.g. 5 / 10 / 15 minutes). Tie the streak to one completed lesson, not to the goal, following Duolingo's retention result.
  5. Straight into the first lesson.
  6. After the lesson-complete screen, offer "Save your progress" (signup or Google sign-in).
  7. Ask for notification permission only after the first successful lesson, never on first launch.
- Placement should be skippable. Use the quiz result to unlock path nodes, not to block anything.
- For a school audience, a "class code" entry can sit next to signup, after the first lesson, so a teacher link doesn't force an early account wall.

### Gaps
- No primary source gives Duolingo's current (2025-2026) onboarding screen count or measured time to first question. The 2-minute figure is low-confidence.
- The delayed-signup A/B test figures could not be verified (the source page failed to load).
- I found no onboarding documentation for Prodigy, Elevate, Headway, Speak, Ling or Babbel.

## Home screen: learning path/map designs, alternatives, bottom tab bars

### Takeaway
Duolingo's home screen is one vertical, winding path of round "pebble" nodes, grouped into units with a header each. Stories, practice and unit-end challenges are built into the path. Completed nodes turn gold, and a floating button scrolls back to the current node. The path removed learner choice and drew backlash. Brilliant uses color-coded paths per topic built in Rive. Duolingo's 2026 tab refresh moved toward flatter, whitespace-separated layouts with consistent headers.

### Cited Findings
- **Path structure (Duolingo, launched to all learners Nov 1, 2022):**
  - The path is a series of pebble-shaped circles in a swirling line running down the screen.
  - Each circle is one level, equal to one old "crown level".
  - Stories sit on the path with a book icon, and practice sessions are built in.
  - Units end with Legendary challenges.
  - Lessons are grouped into units. Each unit has a header describing its new concepts (e.g. "get directions") and a guidebook in its top-right corner.
  - Tapping a circle opens a popup with the lesson topic.
  - Completed levels are shown in gold and can be replayed.
  - When you scroll away, a floating arrow button in the bottom-right corner brings you back to your current spot.
  - Characters cheer along the path.
  - Quests, monthly challenges and Practice Hub sit in bottom-menu tabs, not on the path.

  — [Duolingo blog: New home screen design](https://blog.duolingo.com/new-duolingo-home-screen-design)
- The path redesign drew backlash: users could no longer choose which lessons to do first. — [PiunikaWeb, Nov 22 2022](https://piunikaweb.com/2022/11/22/duolingo-app-update-with-path-ui-faces-backlash-from-users/); critique essays: [Duo's Cage I (Medium)](https://medium.com/design-bootcamp/duos-cage-part-i-80ec44f4ab45), [Ilya Birman](https://ilyabirman.net/meanwhile/all/duolingo-no-more/)
- **Tab refresh (Duolingo "core tabs" redesign, Feb 4 2026):**
  - Headers had varied in size, typography lacked hierarchy, and spacing was inconsistent. Headers are now tiered by each tab's purpose, with titles in the same position, and the number of type styles was reduced.
  - Containers were removed in favor of whitespace, and some bordered cards became flatter.
  - Four directions were explored: Punchy (solid vibrant headers), Soft (gradients, muted), Modular (rounded cards) and Flat (minimal, heavy whitespace).
  - Principles: "Consistency must serve purpose" (header art on every tab felt forced) and "Simplicity must not sacrifice clarity".
  - Engagement rose across tabs while core learning metrics held steady. It was live on iOS first.
  - The article's screenshots suggest areas for lessons, quests, leaderboard, video calls, profile and a social feed. The tab count is not stated.

  — [Duolingo blog: Elevating craft, core tabs refresh](https://blog.duolingo.com/core-tabs-redesign/)
- **Brilliant's path:** node and connecting-line graphics are built in Rive. Each path's color matches its topic, with many color variants and multiple node types. — [Rive: How Brilliant motivates learners](https://rive.app/blog/how-brilliant-org-motivates-learners-with-rive-animations)
- Brilliant release 7.20.0 redesigned the course overview screen "to make moving between lessons and tracking progress easier". A 2024 release mentioned design updates including new fonts. — [APKMirror Brilliant 7.20.0 release notes](https://www.apkmirror.com/?p=5350638); [APKMirror Brilliant](https://www.apkmirror.com/apk/brilliant-org/brilliant/)

### Inferences
- **Path for grades 7-8 (buildable spec):**
  - One vertical scroll of circular nodes, about 64-72px in diameter, comfortably above the 44pt/48dp minimum.
  - Nodes zig-zag horizontally in a gentle sine pattern (offset about ±60-80px from center), in a 360-430px-wide column.
  - Each unit is one curriculum topic (e.g. משוואות, חזקות, אחוזים) with a sticky colored unit header (title plus a "guidebook / הסבר" button).
  - Node states:
    - Locked: gray, with a lock or blank pebble.
    - Available: brand color, flat.
    - Current: brand color, pulsing ring and a "התחל" tooltip bubble. Under reduced motion, use a static ring.
    - Completed: gold with a check.
    - Checkpoint/unit test: larger, trophy icon.
  - Tap opens a popover card with the lesson title, number of questions, and a big "התחל" button.
  - Keep a "back to my spot" floating button (bottom-start corner in RTL, i.e. bottom-right).
- To avoid Duolingo's backlash, add "jump ahead" (a short test-out on the unit header). Also let teachers or learners open any unit in a "practice" mode. Grade 7-8 students are often told by teachers which topic to practice, so free topic choice matters more than in language learning.
- **Alternative or secondary view:** a "Topics" (נושאים) list tab with mastery bars per skill, for students preparing for a specific test.
- **Bottom tabs:** 4 tabs, each with icon plus label: Learn (path) / Practice (mistakes + topics) / Leaderboard or Class / Profile. In RTL the first tab sits at the right edge. Keep labels, because icon-only tabs hurt young users.

### Gaps
- I did not find Duolingo's exact node sizes, path offsets, or the visual treatment of the locked and current states in a primary source.
- I did not verify the Material 3 navigation bar or Apple HIG tab bar guidance on tab count in this session. Both are commonly cited as 3-5 destinations, so verify before citing.
- Khan Academy's and Prodigy's current home designs were not found in reliable write-ups.

## Lesson screen anatomy: progress bar, exit, question area, answer area, pinned "Check" button, feedback bottom sheet, retry of missed questions

### Takeaway
Most of these apps share one lesson pattern:
- Top row: close (X) plus a thick rounded progress bar, with hearts or lives at the end.
- Middle: the question.
- Below that: the answer area.
- Bottom: a full-width primary "Check" button, pinned. It stays disabled until an answer exists.

Checking slides up a bottom feedback panel. Correct is green with praise and "Continue". Wrong is red with the correct answer and "Got it". Each result has its own sound. Missed items come back before the lesson ends, and a separate "mistakes review" practice mode exists.

### Cited Findings
- Duolingo's lesson flow: the learner taps an option, then presses a "Check" button that is disabled until an answer is chosen. A bottom confirmation panel then shows feedback with a primary Continue button. A bottom-banner variant with Continue appears when a section such as listening is skipped. — [Lazyweb flow library: Duolingo start lesson](https://www.lazyweb.com/canvas/flows/duolingo/start-lesson) (third-party screen library)
- A correct-answer feedback banner appears alongside a Continue button. There is also a positive-feedback screen with a "Brilliant!" message and mascot animation. — [Plotline inspiration: Duolingo quiz](https://www.plotline.so/inspiration/duolingo-quiz-feature-for-language-lessons/) (third-party)
- Wrong answers show "a red pop-up with a text telling that the answer was incorrect" and "a specific beep". Correct answers get a green pop-up and a different sound. — [UX Planet: Analyzing Duolingo after 400 days](https://uxplanet.org/analyzing-duolingo-from-product-design-perspective-after-400-days-of-non-stop-practice-c4d4809bdb37) (search-result excerpt; page returned 403)
- When a learner makes a mistake, the correct answer is shown with a brief explanation. — [NextLeap Duolingo product teardown (PDF)](https://assets.nextleap.app/submissions/Duolingo-ProductTeardown-493c762b-fd01-4638-affe-36e138574c56.pdf) (search-result summary)
- Missed questions coming back within a lesson is reported only anecdotally, e.g. users fixing mistakes "when it comes back around again". Duolingo's official Practice Hub has a separate mistakes-review set ("You'll review 10 mistakes in this practice set"). — [Duolingo blog: Practice Hub guide (KO)](https://blog.duolingo.com/ko/guide-to-duolingo-practice-hub); anecdotal [r/duolingo mirror](https://reddit.birdcat.cafe/r/duolingo/comments/1mbs5l8/are_duolingo_units_too_long_and_repetitive)
- Free users have hearts (lives). Super subscribers get a Practice Hub with practice sets. — [Duolingo blog: New home screen design](https://blog.duolingo.com/new-duolingo-home-screen-design)
- Mimo uses lives-based gameplay, streaks and leaderboards, with tap-to-fill-in exercises sized for a phone. — [Mimo review blog (2025)](https://codeyouimagine.blogspot.com/2025/03/mimo-application-review.html); [Coddy vs Mimo (competitor page)](https://coddy.tech/vs/mimo)

### Inferences
Buildable lesson screen for a 360-430 x 640-932 px phone viewport. Values are proposed, not sourced.

- **Top bar** (about 56px plus `env(safe-area-inset-top)`):
  - Close X at the start edge (top-right in RTL). The X is symmetric and does not mirror. Tapping it opens an "Are you sure? progress will be lost" sheet.
  - Progress bar fills the remaining width: 12-16px tall, fully rounded, filling right-to-left in RTL. It animates about 300ms on each correct answer and can show a "combo" sparkle after 3-5 correct in a row.
  - Hearts (optional) at the end edge. For a school math app, consider no hearts, or hearts only in "challenge" mode. Punishing mistakes conflicts with the math-anxiety finding.
- **Question area:**
  - A Hebrew instruction line (e.g. "פתרו את המשוואה"), 17-20px bold, right-aligned.
  - The math expression centered in its own LTR-isolated block, 24-32px.
  - An optional illustration or interactive figure.
- **Answer area:** one of these:
  - 2-4 multiple-choice tiles (min 56px tall, full width or 2x2).
  - An answer field plus custom keypad.
  - A drag/tap tile bank.
  - A number line or graph manipulative.
- **Primary button:**
  - Full width minus 16px side gutters, 50-56px tall, pinned to the bottom with `padding-bottom: calc(16px + env(safe-area-inset-bottom))`.
  - Label "בדיקה". It is disabled (gray, no 3D shadow) until an answer is entered.
  - When a custom keypad is open, the button sits directly above the keypad, or replaces its "enter" key.
- **Feedback sheet:**
  - Slides up from the bottom in about 200-250ms and covers only the bottom 25-35% of the screen, so the question stays visible.
  - Correct: light-green background, check icon, short praise ("מעולה!", "בדיוק!", rotated), green "המשך" button.
  - Wrong: light-red background, X icon, "התשובה הנכונה:" with the correct answer in LTR math, an optional "למה?" link to a worked solution, and a red "הבנתי" button.
  - Sound and haptic fire at the moment of reveal.
- **Retry:** re-queue every missed question at the end of the lesson ("בואו נתקן טעויות"). The lesson completes only when each item has been answered correctly once. Store missed item IDs for a "My mistakes" (הטעויות שלי) practice mode.
- **Length:** 8-12 questions, about 3-5 minutes, consistent with the "one lesson keeps the streak" model.

### Gaps
- No primary source documents Duolingo's exact feedback-sheet height, colors, animation timing, or copy rotation.
- The exact mechanics of re-presenting missed items within a Duolingo lesson are not officially documented.
- I found no reliable public anatomy of Khan Academy, Prodigy or Elevate lesson screens.

## Math input on phones: custom keypads vs. system keyboard, fraction/negative entry, tiles, drag-and-drop, number lines and graphs, handwriting, equation editors, math accessibility

### Takeaway
Serious math apps replace the system keyboard with a custom math keypad:
- Khan Academy: multi-page swipeable keypads with a draggable cursor handle.
- Photomath: a math keyboard with arrow keys, a "new line" key, function chips, and long-press alternates.
- MathLive: configurable layouts with placeholder-aware fraction keys.

Duolingo Math mostly avoids free typing. It uses manipulatives (drag bills, turn clock hands, match pairs, grids) and simple typed numeric answers. A grade 7-8 app should mix both: tap and drag formats for speed, and a compact custom keypad for numeric or algebraic answers.

### Cited Findings
**Duolingo Math (manipulatives first):**
- Exercises are "uniquely engineered for the content they teach". Learners manipulate virtual tools, such as moving a clock's minute or hour hand and watching the other respond, and setting a clock to 5:40. Other formats are "Match the pairs" of written fractions with partly shaded shapes, and typed answers ("write the answer to 3x5"). — [Duolingo blog: Duolingo launches Math app](https://blog.duolingo.com/duolingo-launches-math-app/)
- Visuals are drawn in code, and one class generates thousands of variations:
  - A shared `GriddedGraphView` draws an M x N grid used for area, perimeter, decimals, shapes and coordinates: "We can add masks, lines, buttons, and labels anywhere along the grid". It also supports interactive tasks like building quadrilaterals.
  - Learners drag $50/$20/$5 bills into the center for money problems.
  - Rive animates fraction pies and liquid volume.
  - Difficulty rises by changing visuals and number range (addition max 10 to 100 to 500).

  — [Duolingo blog: Developing Math](https://blog.duolingo.com/developing-math)
- A Duolingo method whitepaper excerpt describes a number-line exercise where learners drag along the line "while receiving haptic feedback at fractional intervals". The text is fragmentary. — [Duolingo method whitepaper (Scribd)](https://www.scribd.com/document/684747885/duolingo-method-whitepaper)

**Khan Academy (custom mobile keypad):**
- `math-input` is "Khan Academy's new expression editor for the mobile web", used in Perseus for "math input and expression editing on small screens". It is built on React, Redux and MathQuill.
- It supports multiple keypad configurations (e.g. fractions/mixed numbers, algebraic expressions) and multi-page keypads with "swipeable page navigation".
- The cursor is draggable with a "detached handle, for fine-grained control on touch devices", and touch-and-drag interactions match stock iOS/Android keypads.
- The keypad responds only to touch events.
- Development moved into the Perseus repo in April 2022. The package is `@khanacademy/math-input` (MIT).

  — [Khan/math-input (archived README)](https://github.com/Khan/math-input); [npm @khanacademy/math-input](https://www.npmjs.com/package/@khanacademy/math-input); [Perseus API docs](https://khan.github.io/perseus/api-docs/modules/_khanacademy_math-input.html)

**Photomath (Google):**
- The math keyboard on the Calculator screen uses tap to enter symbols, arrow keys to move through the problem, and a new-line button for systems of equations.
- Advanced functions sit under chips at the top of the keyboard. Holding any key with a small dot in its bottom-right corner gives alternative functions. — [Google Photomath Help: Use Math keyboard](https://support.google.com/photomath/answer/14335006?hl=en)
- Photomath uses a special keyboard so users get "more sophisticated symbols than can be found on normal app keyboards". Its palette is grays with a red accent. — [DesignRush: Photomath](https://www.designrush.com/best-designs/apps/photomath)

**MathLive (web component, buildable today):**
- Keyboard policy:
  - `mathVirtualKeyboardPolicy = "auto"` (default) shows the virtual keyboard on focus on touch devices only.
  - `"manual"` lets you call `mathVirtualKeyboard.show()/hide()` yourself.
  - `"sandboxed"` covers iframes.
- Built-in layouts are `numeric`, `symbols`, `alphabetic`, `greek`, `minimalist`, `compact` and `numeric-only`.
- The keyboard is shared by all mathfields, so per-field layouts are set in `focusin`.
- Custom layouts are `rows` of keycaps, about 10 per row. Each keycap's LaTeX is both its label and its inserted content.
- Placeholder tokens:
  - `#@` takes the selection or the implicit argument left of the caret. So `\frac{#@}{#?}` turns "3" into 3/□.
  - `#0` takes the selection or a placeholder.
  - `#?` always inserts a placeholder.
- Keycap object fields: `label`, `latex`, `insert`, `key`, `command`, `class` (e.g. `action`, `small`, `ghost`), `width` (0.5, 1.5, 2...), `aside`, `shift`, `variants` (long-press alternatives).
- Theming uses CSS variables such as `--keycap-height`, `--keycap-gap`, `--keycap-font-size`, `--keycap-background`, `--keycap-primary-background` and `--keyboard-accent-color`.
- A `geometrychange` event plus `mathVirtualKeyboard.boundingRect` let you pad the layout above the keyboard.
- A custom `container` is supported and should be at least 320px wide.

  — [MathLive: Customizing the virtual keyboard](https://mathlive.io/mathfield/guides/virtual-keyboard/); [MathLive: Virtual keyboard](https://mathlive.io/mathfield/virtual-keyboard/)
- MathLive's README calls it screen-reader friendly with math-to-speech and ARIA labels. It outputs LaTeX, MathML, ASCIIMath and MathJSON. — [arnog/mathlive on GitHub](https://github.com/arnog/mathlive)

**Accessibility of math:**
- A MathQuill-fork discussion found "surprisingly good support for reading out MathML by screen readers". The approach is hidden MathML (`<math>`) alongside the visually rendered HTML. — [mathspace/msquill issue #2](https://github.com/mathspace/msquill/issues/2)
- ARIA has little to say about math expressions. — [Carleton University TLS](https://carleton.ca/tls/wp-json/wp/v2/posts/21023)
- Desmos offers:
  - Audio trace: explore graphs through sound, with pitch following the curve. On Windows it is Alt+T, then H.
  - JAWS/NVDA support and refreshable Braille.
  - Nemeth and UEB Braille math input in all tools except the matrix calculator.
  - Embosser export.

  — [Desmos Help: Accessibility features](https://help.desmos.com/hc/en-us/articles/4404860698253); [Desmos accessibility](https://desmos.com/accessibility); [Perkins: Desmos sonification](https://www.perkins.org/resource/understanding-desmos-sonification-lessons/)

### Inferences
- **Input format mix for grades 7-8** (fastest first):
  1. Multiple-choice tiles.
  2. Tap-to-build tiles (tap tokens like `3`, `x`, `+`, `=` into slots), the math version of Duolingo's word bank. Tap-to-place works one-handed and is more reliable than drag on small screens.
  3. Number-line drag, with snap points and a light haptic tick at each snap (Android only on web, see Celebration section).
  4. Coordinate-grid tap or drag of points/lines (`GriddedGraphView`-style).
  5. Short typed answer with a custom keypad.
- **Custom numeric keypad, recommended default for typed answers:**
  - Layout: a 4-column grid of 0-9 plus `.`, `−` (negative), `/` or a fraction key, and ⌫. A row of context keys (`x`, `(`, `)`, `^`, `√`) appears only when the question needs them.
  - Size: keys 48-56px tall, 6-8px gaps, bottom-anchored above the safe-area inset.
  - Suppress the system keyboard (e.g. `inputmode="none"` or a non-input display element; verify on iOS Safari).
  - Ship the custom keypad as a React component, or use MathLive with `mathVirtualKeyboardPolicy="manual"` and a custom `rows` layout.
- **Negative numbers:** make "−" a dedicated key. Show it as a true minus (U+2212), not a hyphen, and normalize on grading.
- **Fractions:** a fraction key that wraps the previous number as numerator and moves the caret to the denominator, as with MathLive's `\frac{#@}{#?}`. Also allow "3/4" typing and normalize to a fraction for display.
- **Grading:** accept equivalent forms (0.5 = 1/2 = 2/4 when the question allows), and tell the learner which forms are accepted.
- **Keep math LTR inside the RTL page:** wrap the mathfield/keypad in `dir="ltr"`. Digits on the keypad stay in standard calculator order: 7-8-9 on the top row, left to right, not mirrored.
- **Handwriting/stylus input:** not a priority for grade 7-8 phone practice (finger handwriting of math is error-prone). Leave for a later "scratchpad" feature.
- **Accessibility:** every expression rendered as visual HTML/KaTeX should also have a MathML or aria-label equivalent, with Hebrew speech text for the instruction. Every manipulative needs a non-drag alternative (tap buttons or a keypad) for motor and screen-reader users.

### Gaps
- I did not research MyScript (handwriting) documentation or current pricing.
- No source specifies Khan Academy's actual key sizes, page contents, or Photomath's fraction-entry mechanics.
- I did not confirm how MathLive's virtual keyboard behaves inside a `dir="rtl"` document, or whether its speech output supports Hebrew. Test before adopting.
- I did not check iOS Safari behavior of `inputmode="none"` in this session.

## Celebration and feedback moments: lesson-complete screen, confetti/character animation, sound, haptics, keeping it short, reduced motion

### Takeaway
Feedback is multimodal: color, a distinct sound for correct and wrong, a mascot reaction, and (on native apps) haptics. Streak and XP moments are animated with state-machine tools (Rive), so a number count-up and the animation stay in sync from one small file across platforms. On the web, haptics are effectively Android-only: Safari and iOS don't support the Vibration API. Reduced motion is detectable with `prefers-reduced-motion` and should swap motion for fades.

### Cited Findings
- A Duolingo correct answer plays a "bouncy chime"; a wrong answer plays "a deflated, descending tone". — [Out of Scope newsletter](https://out-of-scope-product.beehiiv.com/p/duolingo-has-it-venmo-has-it-even-slack-has-it-your-product-doesn-t)
- Duolingo uses sound, visuals and haptics together. Wrong answers get a red pop-up and beep; correct answers get a green pop-up and a different sound. — [UX Planet (search excerpt)](https://uxplanet.org/analyzing-duolingo-from-product-design-perspective-after-400-days-of-non-stop-practice-c4d4809bdb37)
- Duolingo chose Rive for its State Machine, "a visual representation of the logic linking animation states". Each character has pose states plus separate mouth-only states, exported as one runtime file. Audio timing data drives the state machine in sync with speech. — [Duolingo blog: World character visemes](https://blog.duolingo.com/world-character-visemes)
- Rive's state machine blends animations in real time rather than pre-baking every reaction, which kept file size down (Duolingo's Lily video-call character). — [Rive blog: Duolingo's Lily](https://rive.app/blog/duolingo-s-ai-powered-video-call-brings-lily-to-life)
- **Brilliant:**
  - Brilliant redesigned its game mechanics at the start of 2023, moving from Lottie, After Effects and native code to Rive.
  - Its streak animation is fired by event triggers and "lines up with the increasing number count".
  - The streak feature was its first launched on Android, iOS and web at the same time from one file, so a bug fix applies everywhere.
  - Engineers found Lottie needed extra work for custom state transitions.
  - A product illustrator said "I saved a full day of work using Rive".
  - Rive claims its files are much smaller than video, GIF or Lottie (vendor claim, no numbers).

  — [Rive: How Brilliant motivates learners with Rive](https://rive.app/blog/how-brilliant-org-motivates-learners-with-rive-animations)
- **Web Vibration API browser support** (MDN browser-compat-data):
  - Chrome Android supports `navigator.vibrate` from version 32, but from Chrome 60 it requires a user gesture, and it doesn't work in cross-origin iframes.
  - Safari, desktop and iOS, has no support (`version_added: false`).
  - Firefox Android returns true but does not vibrate from version 79 on.
  - Firefox desktop removed it in version 129.

  — [MDN browser-compat-data: Navigator.json](https://github.com/mdn/browser-compat-data/blob/main/api/Navigator.json); [MDN: Vibration API](https://developer.mozilla.org/en-US/docs/Web/API/Vibration_API)
- Vibration pattern syntax is `navigator.vibrate([200, 100, 200])` (vibrate, pause, vibrate, in ms), and `navigator.vibrate(0)` cancels. — [MDN: Vibration API](https://developer.mozilla.org/en-US/docs/Web/API/Vibration_API)
- **`prefers-reduced-motion`:**
  - `reduce` is true when the user has enabled reduced motion: iOS Settings > Accessibility > Motion; Android 9+ Remove animations; Windows 11 Visual Effects > Animation Effects; macOS Reduce motion.
  - MDN's example swaps a scaling "pulse" for an opacity "dissolve", because "scaling or panning large objects can be vestibular motion triggers".

  — [MDN: prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)
- A third-party reverse-engineered Duolingo token set lists these motion values. They are not official. — [webdesignhot Duolingo DESIGN.md (third-party)](https://www.webdesignhot.com/api/design-md/duolingo.md)
  - Durations: fast 120ms, standard 200ms, slow 320ms, "celebrate" 600ms, button press 80ms.
  - Easing: `cubic-bezier(0.4,0,0.2,1)`; "emphasized" overshoot `cubic-bezier(0.34,1.56,0.64,1)`.
  - Reduced motion: translate replaced with opacity 0.85.
- The Duolingo whitepaper mentions haptics at fractional intervals on number-line exercises. — [Duolingo method whitepaper (Scribd)](https://www.scribd.com/document/684747885/duolingo-method-whitepaper)

### Inferences
**Lesson-complete sequence** (proposed; each step auto-advances or advances on tap, total 4 seconds or less if not tapped):
1. Mascot and title "השיעור הושלם!" with a confetti burst of about 600-900ms, which becomes a static badge under reduced motion.
2. Three stat cards that count up in sequence, about 150ms stagger each: XP earned (gold), accuracy % (green), time (blue).
3. Streak flame +1, with a count-up synced to the animation as Brilliant does, shown only on the day's first lesson.
4. A single "המשך" button. Tapping anywhere skips straight to the final state.
5. Optional next step: "Review X mistakes" or "Next lesson".

**Rules:**
- Never block for more than about 1s before the Continue button is tappable.
- Show only one celebratory animation per screen.
- Big moments (streak milestones 7/30/100, unit complete) get a full-screen celebration. A normal lesson gets the short version.

**Sound:**
- Two to three short sounds, each 0.5s or less: correct (rising chime), wrong (soft low tone, not harsh, given math anxiety), lesson complete (short fanfare).
- Provide a mute toggle in settings and in the lesson top bar.
- Respect the device silent mode, which happens naturally on iOS for Web Audio only if handled. Test this.

**Haptics on web:**
- Call `navigator.vibrate(15-30)` on correct, `[40,60,40]` on wrong, and short ticks on number-line snaps. This works only on Android Chrome, inside the user-gesture handler.
- Feature-detect it and treat it as a bonus. iOS users get none in a web app unless it is wrapped natively (e.g. Capacitor Haptics), which I did not research.

**Reduced motion:**
- In `@media (prefers-reduced-motion: reduce)`, replace confetti, bounces and path pulses with fades and static highlights.
- Keep the 3D button press (a 2-4px translate, not a vestibular trigger), or swap it for an opacity change.
- Also offer an in-app "reduce animations" toggle.

**Animation format:**
- Rive suits the mascot and streak (state machine, small file, one asset for web and native).
- CSS keyframes are enough for confetti, sheet slides and button presses.
- Lottie is fine for simple one-shot celebrations.

### Gaps
- No primary source documents the order of stats on Duolingo's lesson-complete screen, or its timings. A workflow template only mentions XP and accuracy.
- I found no published Rive or Lottie file-size or runtime-performance benchmarks in a primary source. Rive's "much smaller" claim is vendor marketing.
- I did not research iOS web-app haptic workarounds or native wrappers.

## Visual language of "Duolingo-like" apps and how others adapt it without copying

### Takeaway
The look combines a bright saturated green CTA (#58CC02), a short vivid accent set (orange streak, red hearts, gold XP, blue info, purple premium), and white or very light gray backgrounds. It uses chunky "3D" pressable buttons, made with a solid, no-blur bottom shadow in a darker shade that collapses on press. Corners are generously rounded (12-20px), and the display type is rounded and bold. Competitors set themselves apart through color (Mimo: purple and yellow; Photomath: grays and red; Brilliant: per-topic color-coded paths) and interaction style, rather than by dropping the friendly geometry.

### Cited Findings
- **Third-party reverse-engineered Duolingo tokens** (not official; values vary between sources):
  - Colors:
    - Brand/CTA #58cc02 (hover #61e002, pressed or shadow #46a302, deep #3a8c00, tint #d7ffb8).
    - Accents, each with a shadow shade: streak orange #ff9600/#cc7700, heart red #ff4b4b/#e02e2e, XP gold #ffc800/#cc9f00, premium purple #ce82ff/#a560d4, blue #1cb0f6/#0a8acf.
    - Text #4b4b4b, strong #3c3c3c, muted #777, borders #e5e5e5.
  - Buttons:
    - Primary: padding 14x24, radius 16, weight 700, 15px text with 0.04em tracking, resting shadow `0 4px 0 0 #46a302` (no blur).
    - Press: `translateY(2px)` with the shadow trimmed to 0 in 80ms. The same file's token says 4px, so it conflicts with itself.
    - Secondary: white with a 2px #d4d4d4 border and `0 2px 0 0 #d4d4d4`.
    - Disabled: #a8e8a0 at reduced shadow opacity. Minimum tap target 44x44.
  - Shape and type:
    - Radius scale 4/8/12/16/20/24/pill.
    - Display type "din-round" / "Feather Bold" at 700-800 weight.
    - Base spacing 4px.

  — [webdesignhot Duolingo DESIGN.md](https://www.webdesignhot.com/api/design-md/duolingo.md)
- Another third-party write-up gives the primary button a 4px darker-green bottom border (#58a700) on #58cc02, with an active state of `translate-y 4px` and `border-bottom 0`. This conflicts with the 2px/#46a302 values above. — [open-design.ai Duolingo design system](https://open-design.ai/plugins/design-system-duolingo/)
- Implementation note: a bottom edge that disappears on click is usually a `box-shadow`, not a `border-bottom`, so it doesn't shift layout. — [GeneratePress forum](https://generatepress.com/forums/topic/border-bottom-in-button/)
- Sources describe the shape language as cards with 16-20px radii, buttons 12px, chips and progress bars pill-shaped, and solid colored drop shadows as a recurring motif. Feather is for large display headings only, "not for body text or small UI elements". — [refero.design style](https://styles.refero.design/style/95b472c5-fc07-46a8-a11f-c5432e290fcd); [open-design.ai systems/duolingo](https://open-design.ai/systems/duolingo/)
- Duolingo's 2026 tab refresh moved toward fewer type styles, consistent header positions, and whitespace instead of bordered containers. It removed header art that "took space without conveying anything useful". — [Duolingo blog: core tabs redesign](https://blog.duolingo.com/core-tabs-redesign/)
- Mimo feels close to Duolingo (lives, streaks, leaderboards) but uses a purple-and-yellow scheme and a "very straightforward" interface. — [Mimo review (2025)](https://codeyouimagine.blogspot.com/2025/03/mimo-application-review.html)
- Brilliant's design is "genuinely differentiated; it looks nothing like a typical course platform". It color-codes paths by topic. — [Landing Doctor](https://landingdoctors.com/teardowns/brilliant-org); [Rive: Brilliant](https://rive.app/blog/how-brilliant-org-motivates-learners-with-rive-animations)
- Photomath uses a palette of grays with a red accent. — [DesignRush: Photomath](https://www.designrush.com/best-designs/apps/photomath)

### Inferences
- **Own palette, avoiding Duolingo's owl green as primary:**
  - Primary: a saturated blue-violet or teal (e.g. a violet around #6C4CF5 with a shadow around #4B32C3).
  - Correct and wrong: keep green and red, since those meanings are universal.
  - Streak: orange. XP: gold.
  - Unit colors: one per topic, as Brilliant does (algebra = violet, geometry = teal, percentages = orange...).
  - Check contrast: white text on #58CC02-like greens is low-contrast, so use darker greens for text-bearing buttons or dark text.
- **3D button recipe** (CSS, works in RTL unchanged because it is vertical):

  ```css
  border-radius: 16px;
  min-height: 52px;
  font-weight: 700;
  box-shadow: 0 4px 0 var(--btn-shadow);
  transition: transform 80ms, box-shadow 80ms;
  ```

  On `:active`, set `transform: translateY(4px); box-shadow: 0 0 0 var(--btn-shadow);`. Disabled: flat gray, no shadow. Apply the same treatment to answer tiles: a white tile with a 2px gray border and `0 2px 0` gray shadow. The selected tile gets a blue/brand border and tint.
- **Geometry:** 16px page gutters, 12-20px radii, 4px spacing grid, 1-2 illustration styles at most (a flat mascot plus simple geometric spot illustrations).
- **Character:** one original mascot (e.g. a friendly geometric shape) animated in Rive with 4-5 states: idle, happy, sad/encouraging, thinking, celebrate.

### Gaps
- Duolingo's official brand site (design.duolingo.com) now redirects to the blog design hub. I found no official published token values, so every hex and px value above is third-party.
- I found no design write-ups of Ling, Babbel, Speak, Elevate, Headway or Prodigy visual systems.

## RTL specifics: mirroring the path and progress bars, which icons mirror, LTR math inside RTL text, Hebrew rounded fonts

### Takeaway
In RTL, the following mirror: layout order, back/forward arrows, progress bars (0% at the right), and tabs, which start on the right. These do not mirror: numbers, clocks, media controls, checkmarks, symmetric icons like X or star, slashes, logos, or handed icons. Mathematical formulas stay LTR. Hebrew publishing sets formulas LTR, and MathML Core's default stylesheet forces `direction: ltr` on `<math>`. Plain-text formulas inside RTL text can be scrambled by the bidi algorithm unless isolated. For a rounded Duolingo-like Hebrew face, Fredoka (with Hebrew by Hafontia) is the closest Google Fonts option. Rubik, Heebo, Assistant and Varela Round are alternatives.

### Cited Findings
**What mirrors (Material Design bidirectionality):**
- Navigation buttons appear in reverse order, and direction-communicating icons such as arrows flip.
- Primary and secondary buttons flip. Checkboxes sit to the right of their text.
- Tabs start on the right. Time sequences and "next" run right-to-left.
- "Progress bars fill from right to left, with 0% on the right."
- Back/forward are "the most important icons for mirroring".
- Volume sliders mirror. Text-representing icons (chat with ragged edge) mirror.

— [Material Design (M1): Bidirectionality](https://m1.material.io/usability/bidirectionality.html)

**What doesn't mirror (Material):**
- Non-directional icons (camera).
- Clocks and circular refresh/progress: "Clocks still turn clockwise for RTL languages".
- Physical objects (keyboard, headset) and handed icons (search, cafe).
- Slashes.
- Media playback controls and media progress: "Media controls for playback are always LTR".
- Numbers, including phone numbers. Untranslated LTR text such as URLs stays LTR.

— [Material Design (M1): Bidirectionality](https://m1.material.io/usability/bidirectionality.html)

**Firefox RTL guidelines:**
- Don't mirror text, numbers, or icons containing them.
- Don't mirror symmetric icons (X buttons, bookmark star), checkmarks, video/audio controls, product logos, dimensions ("1920x1080 must not become 1080x1920"), or size units.
- Code is always LTR.
- Mirror with `transform: scaleX(-1)` (or `scale: -1 1`), and use separate RTL `@keyframes` for directional animations.
- Prefer logical properties: `margin-inline-start`, `padding-inline-end`, `inset-inline-start`, `border-inline-end`, `text-align: start`. Use `:dir(rtl)` when no logical property fits.
- Forced-LTR elements embedded in RTL need extra rules.

— [Firefox Source Docs: RTL guidelines](https://firefox-source-docs.mozilla.org/code-quality/coding-style/rtl_guidelines.html)

- Wikimedia designers warn that "mirroring" is a misleading frame, since RTL text and numbers aren't reversed. — [Wikimedia Phabricator T300053](https://phabricator.wikimedia.org/T300053)

**Math direction:**
- The MathML Core user-agent stylesheet sets `math { direction: ltr; text-indent: 0; letter-spacing: normal; ... }`. The spec says surrounding properties like direction "are not expected to apply to the math formula and so the user agent stylesheet has rules to reset them by default." — [W3C MathML Core](https://www.w3.org/TR/mathml-core/) (verified in spec HTML)
- Hebrew math publications have long set formulas LTR. A 2010 W3C i18n discussion (Aharon Lanin, Google) reported that the Israel Standards Institute's tentative direction was to keep that convention. — [W3C public-i18n-bidi, 2010](https://lists.w3.org/Archives/Public/public-i18n-bidi/2010JulSep/0007.html) (via search summary)
- Without markup, the Unicode Bidi Algorithm can garble simple LTR formulas mixed with RTL letters. Murray Sargent's example renders as "(C = 3 * (B - A". In Word math zones, Hebrew text inside a formula is wrapped as "Normal Text" (quoted) so ordinary bidi rules apply. — [Murray Sargent (Microsoft): Plain-text math in bidirectional contexts](https://learn.microsoft.com/en-nz/archive/blogs/murrays/plain-text-math-in-bidirectional-contexts); [Directionality in math zones](https://learn.microsoft.com/en-us/archive/blogs/murrays/directionality-in-math-zones)

**Hebrew-capable Google Fonts** (from Google Fonts' own metadata and the google/fonts repo; popularity is Google Fonts' rank, lower = more used):

| Font | Hebrew subset | Weights / axes | Designer(s) | Popularity rank | Notes |
|---|---|---|---|---|---|
| **Fredoka** | yes | variable wght 300-700, wdth 75-125 | Milena Brandão, Hafontia | 119 | Rounded; closest to "Duolingo-like" |
| **Rubik** | yes | variable wght 300-900 + italics | Hubert & Fischer, Meir Sadan, Cyreal, Daniel Grumer, Omaima Dajani | 31 | Most-used of the Hebrew-capable candidates here (global rank); slightly softened corners (visual judgment) |
| **Heebo** | yes (+ "math" and "symbols" subsets) | variable wght 100-900 | Oded Ezer | 69 | Neutral, not rounded |
| **Assistant** | yes | variable wght 200-800 | Adobe, Ben Nathan | 95 | Neutral |
| **Varela Round** | yes | **400 only** | Joe Prince | 190 | Rounded but no bold |
| **Secular One** | yes | 400 only | Michal Sahar | 499 | Heavy display face |
| **M PLUS Rounded 1c** | yes | 100-900 (static) | Coji Morishita, M+ Fonts | 134 | Rounded; Hebrew quality unverified |
| **Google Sans** | yes | wght 400-700, GRAD, opsz | (not checked) | 4 | Added 2025-12-09 |
| **Playpen Sans Hebrew** | yes | wght 100-800 | (handwriting) | 1637 | Added 2025-05-12; "handwritten" accents |
| **Rubik Bubbles** | yes | 400 | (Rubik family display) | 1171 | Celebration headings only |

Other Hebrew families listed: Alef, Noto Sans/Serif Hebrew, IBM Plex Sans Hebrew, Miriam Libre, Karantina, Suez One, Frank Ruhl Libre, David Libre, Amatic SC, Gveret Levin (2026, handwriting), Lunasima.

— [Google Fonts metadata endpoint](https://fonts.google.com/metadata/fonts); [google/fonts ofl/fredoka/METADATA.pb](https://github.com/google/fonts/blob/main/ofl/fredoka/METADATA.pb); [google/fonts ofl/rubik/METADATA.pb](https://github.com/google/fonts/blob/main/ofl/rubik/METADATA.pb); [google/fonts ofl/varelaround/METADATA.pb](https://github.com/google/fonts/blob/main/ofl/varelaround/METADATA.pb)

**Font backgrounds:**
- Ben Nathan (Hafontia) designed Fredoka's Hebrew as a full alef-bet, "making the letters as round as possible". — [googlefonts-discuss: Fredoka One Hebrew](https://groups.google.com/g/googlefonts-discuss/c/k_uu5mlBLpg)
- Varela Round's Hebrew was designed by Alef Alef Alef for Google Fonts. An Opensiddur list says it lacks some niqqud and diacritic features (possibly outdated). — [Alef Alef Alef: free Hebrew fonts](https://alefalefalef.co.il/en/%D7%A4%D7%95%D7%A0%D7%98%D7%99%D7%9D-%D7%91%D7%97%D7%99%D7%A0%D7%9D-%D7%91%D7%A2%D7%91%D7%A8%D7%99%D7%AA-%D7%9E%D7%A8%D7%97%D7%91%D7%99-%D7%94%D7%A8%D7%A9%D7%AA/); [Opensiddur Hebrew fonts list](https://opensiddur.org/help/fonts/)

### Inferences
- **Font pairing recommendation:** Fredoka 600-700 for headings, buttons, numbers in stats and the mascot's speech. Rubik or Heebo 400-500 for body and instructions, since they are more legible at 15-17px for long Hebrew word problems. Load only the `hebrew` + `latin` subsets.
  - Varela Round is attractive but has a single weight, so you can't make chunky bold buttons without faux-bold.
  - If one family must cover everything, Rubik (300-900) is the safest.
- **Math typography:** render formulas in KaTeX/MathLive's own math fonts, or in a font with good digits (Heebo includes a "math" subset). Don't render equations in Fredoka, whose rounded digits can be ambiguous (1/7, 0/o). Use tabular figures for counters.
- **Mirroring checklist for this app:**
  - Mirror:
    - Page `dir="rtl"` and `lang="he"`.
    - The path's unit headers and tooltip bubbles, with text right-aligned.
    - The progress bar, which fills from right to left.
    - Back arrows, which point right.
    - "Next" chevrons, which point left.
    - The tab bar order, with Home at the far right.
    - Swipe direction between lesson cards.
    - The answer-tile grid order.
    - The streak calendar, with weeks starting on Sunday at the right.
  - Do NOT mirror: the X close button, checkmarks, numbers and digits, all formulas and expressions, keypad digit order, number lines and coordinate axes (math convention: negatives on the left, x increasing to the right), clocks, the flame, star and trophy icons, the play/sound button, the search icon, or logos.
- **LTR isolation:** wrap every inline expression in `<bdi dir="ltr">` or `<span dir="ltr" style="unicode-bidi:isolate">`, or use `<math>` (LTR by default). Never concatenate Hebrew strings with raw "x = -3" without isolation. This prevents the minus sign or parentheses from jumping to the wrong side.
- For a winding path, mirroring the zig-zag doesn't matter. What matters is that the "current node" tooltip and the unit header read from right to left.
- In code, use only logical CSS (Tailwind's `ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`, `rtl:` variants) so the layout flips without forks.

### Gaps
- I found no authoritative Israeli Ministry of Education guidance on number-line or coordinate-axis direction in Hebrew textbooks. The "keep LTR" recommendation rests on the formula convention and should be checked against a grade 7-8 textbook.
- I did not visually audit Hebrew glyph quality or digit legibility of M PLUS Rounded 1c, Google Sans Hebrew, or Fredoka at small sizes.
- I found no Material 3-era bidirectionality page. The M1 and M2 guidance is the latest I could retrieve (the M2 page did not render).

## Performance and touch targets, one-handed reach zones, safe areas

### Takeaway
Targets should be at least 44x44pt (Apple) or 48x48dp (Material). The legal or accessibility floor is WCAG 2.2's 24x24 CSS px, with a spacing exception. About half of people use their phone one-handed with the thumb, so primary actions (Check, Continue, keypad, answer tiles) belong in the bottom-center band. The edges of the bottom area need `env(safe-area-inset-bottom)` padding.

### Cited Findings
- **WCAG 2.2 SC 2.5.8 Target Size (Minimum, AA):** "The size of the target for pointer inputs is at least 24 by 24 CSS pixels", except for these cases:
  - Spacing: undersized targets positioned so that 24px circles centered on each don't intersect another target.
  - Equivalent control.
  - Inline.
  - User-agent control.
  - Essential.

  — [W3C Understanding SC 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) (verified)
- WCAG 2.5.5 (AAA) asks for 44x44 CSS px. Apple HIG recommends 44x44pt minimum, and Material recommends 48x48dp. These are secondary summaries; I didn't open the HIG or Material pages. — [Frontend Checklist: touch targets](https://frontendchecklist.io/rules/accessibility/touch-targets); [w3c/wcag issue #1831](https://github.com/w3c/wcag/issues/1831)
- Steven Hoober observed 1,333 phone interactions:
  - 49% one-handed grip.
  - 36% cradled in one hand and tapped with the other hand's finger or thumb.
  - 15% two-handed thumb typing.
  - For right-handed one-handed users, the bottom and top-right corners were the least accurate zones, and comfort and accuracy don't perfectly align.

  — [A List Apart: How We Hold Our Gadgets](https://alistapart.com/article/how-we-hold-our-gadgets/); [Gizmodo](https://gizmodo.com/were-designing-apps-wrong-for-huge-smartphones-1651751412)
- A small independent test (84 tiles, iPhone 5S) found tiles bordering the screen edge were faster to tap. — [Medium: Mobile UI ergonomics](https://medium.com/@mibosc/mobile-ui-ergonomics-how-hard-is-it-really-to-tap-different-areas-of-your-phone-interface-bb043d409af8)
- `env(safe-area-inset-top|right|bottom|left)` give the safe distance from notches, rounded corners and dynamic UI. They are 0 on rectangular viewports. MDN's sticky-footer example uses `padding: 1em 1em calc(1em + env(safe-area-inset-bottom))`. `safe-area-max-inset-*` give static maximums. — [MDN: env()](https://developer.mozilla.org/en-US/docs/Web/CSS/env)
- The MathLive virtual keyboard fires `geometrychange`, and `boundingRect` gives its height for reserving layout space. Its container should be at least 320px wide. — [MathLive: virtual keyboard guide](https://mathlive.io/mathfield/guides/virtual-keyboard/)
- Rive files are much smaller than video, GIF, image sequences or Lottie JSON, and stay small with interactivity added (vendor claim, no numbers). — [Rive: Brilliant case](https://rive.app/blog/how-brilliant-org-motivates-learners-with-rive-animations)

### Inferences
**Layout rules:**
- 16px side gutters.
- All primary buttons and tiles at least 48px tall (52-56px for Check/Continue).
- 8px minimum gap between adjacent tiles or keys.
- The close X gets at least a 44x44 hit area even if the icon is 24px.

**Reach:**
- Put answers and actions in the lower 55-60% of the screen. Keep only status (progress, hearts) and the infrequent exit button at the top.
- In RTL, the exit X sits top-right, a hard spot for one-handed right-thumb users. That is acceptable, even desirable, for a destructive action, but confirm exit with a bottom sheet whose buttons sit low.

**Safe areas:**
- Add `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`. Not verified in-session that `viewport-fit=cover` is required for non-zero insets; test on iPhone.
- Pad the top bar with `env(safe-area-inset-top)` and the bottom action bar or keypad with `env(safe-area-inset-bottom)`.
- Use `100dvh` (not `100vh`) for full-height lesson layouts, so mobile browser toolbars don't hide the Check button.

**Performance budget for a Vite/React web app on mid-range Android:**
- Lazy-load lesson illustrations and Rive or Lottie assets.
- Preload the next question's assets while feedback shows.
- Animate only `transform` and `opacity`.
- Keep the feedback-sheet and progress-bar animations on the compositor.
- Preload the 2-3 sound effects as small files and decode them once on the first user gesture.
- Subset fonts to Hebrew + Latin.

### Gaps
- I did not open Apple HIG or Material 3 pages directly (JS-rendered), so the 44pt/48dp values are from secondary summaries, though they are widely consistent.
- I found no primary-source performance numbers (frame rate, bundle size) for Rive vs. Lottie web runtimes, or for MathLive's bundle size.
- I found no thumb-zone research specific to RTL or left-to-right-reading differences. Hoober's data is about hand posture, independent of language.
