# Arabic (COUNCIL2-27, COUNCIL2-34)

The app speaks Hebrew (the default, unchanged) and Arabic. Arab schools in Israel teach the same grade 7-8 programme in
Arabic, and the Ministry's own maths pilot (Project 720) runs in both languages; this is the code side of that offer.

## What a student sees

- The first screen offers **עברית | العربية** at the top; Settings has the same choice under **שפה / اللغة**. The
  choice belongs to the device (`localStorage <store key>-locale`). `?lang=ar` in an address opens the app in Arabic,
  so a school or a landing page can link straight to it.
- The page says its language (`<html lang="ar" dir="rtl">`) from the first paint (`public/theme-boot.js`), so a screen
  reader reads Arabic as Arabic.
- Arabic text is set in Rubik's own Arabic part (the same OFL font package as the Hebrew, `src/styles/fonts.css`). A
  Hebrew device never downloads it: the browser fetches it only for Arabic characters, and the language button names
  "العربية" in the phone's own font.
- Numbers use the digits 0-9 and dates Arabic month names (`fmtNum`, `fmtDate` in `src/lib/i18n.js`, locale
  `ar-IL-u-nu-latn`), as maths is written in Arab schools in Israel. Phone numbers stay left to right inside Arabic text.
- The maths words follow one glossary (`src/locales/terms.js`): wherever the Hebrew says a term, the Arabic says its
  programme term (`محور الأعداد`, `هيئة المحاور`, `الأعداد الموجّهة`, `زاويتان متقابلتان بالرأس`...). A test holds every
  pair of texts to it, the catalogues' and the teaching content's.
- A topic taught in Arabic (`ARABIC_TOPICS` in `src/content/arabic.js`: the directed numbers, `الأعداد الموجّهة`, all
  six stairs and their three challenge tasks) is Arabic whole: its name and stair names on the map, its guide, its
  teaching (the five stages), its exercises, the words about a mistake, and its challenge tasks. Every other topic
  keeps its Hebrew on an Arabic device until its translation is in (the list below).
- The tutor answers in the student's language: an Arabic device sends `locale: 'ar'` with every request, and the
  Worker builds the Arabic form of the stable block (`shared/arabic.js`: the language line, the programme's terms,
  each topic's Arabic words, the safety block with the services' Arabic names and the same numbers). A Hebrew request
  is byte for byte what it was. The fixed care reply and the distress detector have an Arabic form too.

## How it is built

- `src/lib/i18n.js`: `t(key, vars)`, plural sets (Arabic's six forms), `setLocale`, `useLocale`, `fmtNum`, `fmtDate`, and
  `localized()` for a module's constant that holds words (it is computed again when the language changes).
- `src/locales/shell.he.json` is in the first download (it replaced the words that were written into those screens);
  `settings.he.json` comes with Settings. All of Arabic (`*.ar.json`) is fetched only on an Arabic device, and the
  service worker keeps it as it is used (it is not in the precache, so Hebrew devices store nothing extra).
- App.jsx draws every screen again when the language changes.
- The teaching content stays Hebrew-first. `src/content/ar/grade7.json` holds each Hebrew text's Arabic (keyed by a
  hash of the Hebrew; a template's values as ⟦0⟧, ⟦1⟧), and `node scripts/gen-arabic.mjs build` writes each content
  file's Arabic twin next to it (`grade7.ar.js`, `signed.ar.ts`, `signed6.ar.ts`, `challenges/signed.ar.ts`, and the
  names: `meta.gen.ar.ts`, `topics.gen.ar.js`, `challenges/meta.gen.ar.ts`, `lessons.ar.js`). A twin is the Hebrew
  file's own code with only its words changed, so the exercises, answers and checks cannot drift. After a Hebrew
  change, `node scripts/gen-arabic.mjs check` lists the texts that need Arabic (`units <file>` prints them as JSON,
  `add <json>` takes their translations), and `build` writes the twins again; `src/learn/arabic.test.ts` fails on a
  stale twin.
- `src/content/arabic.js` loads the names with the Arabic catalogue and puts them in place on every change of
  language; a topic's teaching and exercises load per topic in the language on screen (`learn/content/index.ts`,
  `content/index.js`), and its challenge tasks come with the catalogue. Every Arabic file is fetched only on an Arabic
  device and kept out of the service worker's precache (`*.ar-*.js`).
- Adding a topic in Arabic: translate the units of its files (`node scripts/gen-arabic.mjs units src/learn/content/coord.ts
  src/learn/challenges/coord.ts`), `add` them, add the files to `TWINS` in `scripts/gen-arabic.mjs`, a case to each
  Arabic loader (`importArabic` in `learn/content/index.ts`, `importGens` in `content/index.js`, `ARABIC_CHALLENGES`
  in `content/arabic.js`) and the topic to `ARABIC_TOPICS`; `src/learn/arabic.test.ts` checks it whole.
- Converting another screen: `node scripts/i18n-codemod.mjs src/locales/shell.he.json shell src/screens/X.jsx`
  moves its Hebrew into the catalogue and leaves `t()` calls; then add the Arabic for the new keys and the file to
  `CONVERTED` in `src/locales/locales.test.js`.

## Tests

- `src/locales/locales.test.js`: every key in both languages, the same `{values}`, complete plural sets, no Hebrew in
  the Arabic, the glossary, no Hebrew string left in the converted screens, and the runtime (plurals, dates, numbers).
- `e2e/arabic.spec.js` (phone 390 and 320): the choice on the first screen and in Settings, `lang`/`dir`, the font
  fetched only for Arabic, `?lang=ar`, and Welcome, home and Settings in Arabic (Settings with no Hebrew word at all);
  an Arabic topic's guide, teaching step and question on the device, and a Hebrew topic staying Hebrew.
- `src/learn/arabic.test.ts`: the twins are what the generator builds, keep no Hebrew text, and every translation
  keeps its values and maths and the glossary's terms; an Arabic topic's teaching, challenge tasks and exercises (from
  the same random numbers) are the Hebrew ones with only the words changed; the names follow the language and come
  back. `src/content/labels.arabic.test.js` and `src/learn/guessing.arabic.test.ts` run the label properties and the
  guessing measure again with the app in Arabic. `worker/test/arabic.test.js`: the Arabic tutor block, safety block,
  care reply and distress set, and that a Hebrew request does not change; `worker/test/fixtures/stable-system.ar.txt`
  is the Arabic stable block for the reviewer (`node test/fixtures/make-full-params.mjs` writes it).

## Owner steps

1. **A native Arabic speaker reviews the text, and an Arabic-speaking maths teacher reviews the teaching content**:
   `cd madregot/web && node scripts/locale-sheet.mjs locale-review.csv` writes every text (the shell, Settings and
   the teaching content: about 1,860 rows) as key | Hebrew | Arabic, with an empty column for corrections. The reviewers
   fill that column; then one action, `node scripts/locale-sheet.mjs apply locale-review.csv`, puts every correction
   back (the catalogues, `src/content/ar/grade7.json`) and writes the Arabic content files again. It lists any
   correction it left out (a lost `{value}` or `⟦value⟧`, a Hebrew letter). Then `npx vitest run src/locales
   src/learn/arabic.test.ts`. Points for the teacher: the exercises' names (روني، ميخال...) are the Hebrew stories'
   names written in Arabic letters, and a number written beside a noun ("⟦0⟧ وحدات") does not change the noun's form
   with the number.
2. Confirm the glossary (`src/locales/terms.js`, and the tutor's `ARABIC_TERMS` in `shared/arabic.js`) against the
   Ministry's Arabic maths terms. A changed term is one line; the tests then list every text that has to follow it.
3. Confirm the product's Arabic name (`مدريجوت`, a transliteration of the working name, in the catalogues'
   `shell.shell.7`, `shell.welcome.22`).
4. A school counsellor who works in Arabic reviews the Arabic distress set (`AR_RULES` in `shared/distress.js`, its
   cases in `worker/test/arabic.test.js`) and the Arabic care reply (`careStaticArabic` in `shared/arabic.js`).

## Not in Arabic yet

The shell is Arabic: navigation, buttons, sheets, Settings and its sheets, errors, the legal links, the support card,
the first screen and the student's first questions, and home's own words. Still Hebrew, in order of what comes next:

- the teaching content of grade 7's other topics (the coordinate plane, angles, algebraic expressions, equations, the
  fractions floor) and their challenge tasks, then grade 8. Their exercise generators that live in `grade7.js` (the
  coordinate plane and angles) are already translated in `grade7.ar.js`, waiting for their teaching;
- the screens around the content: the lesson's and the stair page's own buttons and headings, the journey, quests,
  exams, profile, the tutor's screen and the topics list (an Arabic topic's lesson shows Arabic teaching and questions
  inside a Hebrew frame for now);
- the drawings' words for the tutor and the teacher (`figPlain`, `manipPlain`): the tutor reads them in Hebrew and
  answers in Arabic;
- the legal pages (privacy, terms, safety, accessibility): their Arabic needs the lawyer's approved Hebrew first;
- the parents' area, the teacher's screens, the landing pages and the store listing;
- the daily reminder's rest days follow the Hebrew calendar (Shabbat and Jewish holidays); Arab-sector rest days
  (Friday, the Eids, Christmas, Easter) are a product decision for the owner.
