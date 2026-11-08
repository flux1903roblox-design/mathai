# App Store research: what leading learning apps do, and what Madregot took from it

November 2026. This note records a review of the current iPhone App Store listings and store screenshots of seven learning apps, the design patterns found there, and which of them Madregot adopted (adapted to its own Hebrew, right-to-left, stairs identity). No asset, screen or text was copied, and no screenshot of another app is stored in this repository.

## Method and limits

- **Apps:** Duolingo (which includes Math), Brilliant, Khan Academy, Photomath, Prodigy Math, Kahoot! Algebra 2 by DragonBox (no app named "DragonBox Algebra 12+" is listed any more), and Go Math, an Israeli Hebrew practice app chosen because it ranks highest among practice maths apps in Israel's free Education chart. Mathins, an Israeli Hebrew app for grades 10–12, was looked at in passing.
- **Sources:** the listing data came from Apple's store data (through Firecrawl's App Store provider and Apple's public lookup), and the screenshots were downloaded and viewed one by one, 23 for group A and 30 for group B. Store screenshots are marketing frames, not full flows, so anything not shown is reported as not visible.
- **AppMonkey:** its MCP connector needs a sign-in on claude.ai and loads only when a session starts, so it was not used. Its public app pages were available, but the store data above already covered the same listings.

## What each app shows

| App | What stands out in its store screenshots | Not visible |
|---|---|---|
| Duolingo | one prompt per screen; drag tiles with a 3D lip, the dragged tile lifted and tilted, the next empty slot outlined, used tiles leave ghosts; an energy counter in the lesson header; the progress bar heats up after a run; the streak screen with a big number and a week row | XP, leagues, quests, chests in the frames |
| Brilliant | one hero object per step on a calm canvas; an AI tutor that draws hints on the problem itself; colour that links a variable across views; a point dragged on a circle drives a graph; "Correct! +15 XP" in green and "Try again!" in yellow, not red; onboarding cards that each show a mini problem | streaks, leagues |
| Khan Academy | mastery points as fractions; a 6-question mastery challenge; a tool bar with scratchpad and hint; Check disabled until there is an answer; digits that keep their colour across a table and the equations | streaks, XP, the tutor |
| Photomath | worked solutions as an accordion, one step at a time with a "Next step" button and undo; the changed terms in colour; a choice of method; terms that open a definition | any game layer |
| Prodigy | an avatar creator ("you can change this later"); a pet book with silhouettes of what is not found yet; an island map with locked zones; maths in one frame of seven | — |
| Kahoot! Algebra 2 by DragonBox | everything is direct manipulation of cards; pictures fade into letters over the chapters; a glow marks what can combine; a chapter creature with a star counter | onboarding |
| Go Math | chunky 3D topic tiles; answer cards stamped with a ✓ or ✗ disc; a row of result squares per session; written step-by-step solutions | Hebrew screens (the store served the English set) |

## Adopted in Madregot

| Pattern | Seen in | Where it is now |
|---|---|---|
| The object is the answer: drag, tap, keys or step buttons, checked exactly | DragonBox, Brilliant | interactive exercises for all six topics (`components/manip`) |
| One hero object on a tinted canvas, with live readouts | Brilliant | the interactive canvas and its readouts (the equation, the sum of areas, the mean) |
| Hints drawn on the problem, not only written | Brilliant's tutor | dashed indigo guides on the objects when a hint is open |
| One colour per quantity across views | Khan, Brilliant | m (amber) and b (indigo) in the equation, the handles and the step buttons; a, b and c on the squares and the readout |
| "Try again" in a warm colour, not alarm red | Brilliant | the retry panel and its button are gold |
| A row of result squares per session | Go Math | the lesson header is a staircase of results, one step per exercise |
| Worked solutions one step at a time | Photomath, Mathins | the solution goes down one stair at a time with "השלב הבא" |
| Onboarding cards that show a mini problem | Brilliant | each "how much do you know" card shows a sample of that level |
| A world map with a next marker, locked areas and counters | Prodigy, DragonBox | a landscape per unit, stair stops, the current stair marked, done/total on each unit band |
| A reward on the road | Duolingo (description), Prodigy | a treasure chest halfway along each unit, counted as a medal |
| A week row on the streak screen | Duolingo | already in place (Sunday to Saturday, right to left, with frozen and Shabbat days) |

## Considered and not adopted

- **Energy or hearts that limit practice, paid streak repair:** they suit a subscription business, not a school tool.
- **Battles, player-against-player, pets to collect:** they put the game shell in front of the maths (in Prodigy's set, maths is in one frame of seven).
- **XP on every answer:** Madregot awards XP per lesson, so a per-answer number would be invented.
- **Tappable terms with definitions, a choice of method, a scratchpad rail, choosing מדי's colour:** good candidates for a next round; they need new content (a glossary, alternative solutions) rather than design work.

## A risk to decide on

Mathins, an Israeli Hebrew maths app, uses a lavender and purple palette with a purple mascot. Madregot's brand is indigo with a purple mascot. The stairs geometry (the mascot is a stair block, the stops are stairs, the end of a lesson is a climb) and the per-topic worlds keep Madregot distinct, but the owner may want to weigh a different mascot colour if the two apps meet the same students.
