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
  pair of texts to it.

## How it is built

- `src/lib/i18n.js`: `t(key, vars)`, plural sets (Arabic's six forms), `setLocale`, `useLocale`, `fmtNum`, `fmtDate`, and
  `localized()` for a module's constant that holds words (it is computed again when the language changes).
- `src/locales/shell.he.json` is in the first download (it replaced the words that were written into those screens);
  `settings.he.json` comes with Settings. All of Arabic (`*.ar.json`) is fetched only on an Arabic device, and the
  service worker keeps it as it is used (it is not in the precache, so Hebrew devices store nothing extra).
- App.jsx draws every screen again when the language changes.
- Converting another screen: `node scripts/i18n-codemod.mjs src/locales/shell.he.json shell src/screens/X.jsx`
  moves its Hebrew into the catalogue and leaves `t()` calls; then add the Arabic for the new keys and the file to
  `CONVERTED` in `src/locales/locales.test.js`.

## Tests

- `src/locales/locales.test.js`: every key in both languages, the same `{values}`, complete plural sets, no Hebrew in
  the Arabic, the glossary, no Hebrew string left in the converted screens, and the runtime (plurals, dates, numbers).
- `e2e/arabic.spec.js` (phone 390 and 320): the choice on the first screen and in Settings, `lang`/`dir`, the font
  fetched only for Arabic, `?lang=ar`, and Welcome, home and Settings in Arabic (Settings with no Hebrew word at all).

## Owner steps

1. **A native Arabic speaker reviews the text** (and, for the maths words, an Arabic-speaking maths teacher):
   `cd madregot/web && node scripts/locale-sheet.mjs locale-review.csv` writes every text as key | Hebrew | Arabic, with
   an empty column for corrections. The reviewer fills that column; the corrected Arabic goes back into
   `src/locales/*.ar.json` (same keys), and `npx vitest run src/locales` checks it.
2. Confirm the glossary (`src/locales/terms.js`) against the Ministry's Arabic maths terms. A changed term is one line;
   the test then lists every text that has to follow it.
3. Confirm the product's Arabic name (`مدريجوت`, a transliteration of the working name, in the catalogues'
   `shell.shell.7`, `shell.welcome.22`).

## Not in Arabic yet

The shell is Arabic: navigation, buttons, sheets, Settings and its sheets, errors, the legal links, the support card,
the first screen and the student's first questions, and home's own words. Still Hebrew, in order of what comes next:

- the teaching content and exercises (grade 7 is the next stage; grade 8 after it), and with it the topic and stair names
  on the map;
- the lesson, journey, quests, exams, profile, the tutor's screen and the topics list;
- the legal pages (privacy, terms, safety, accessibility): their Arabic needs the lawyer's approved Hebrew first;
- the parents' area, the teacher's screens, the landing pages and the store listing;
- the daily reminder's rest days follow the Hebrew calendar (Shabbat and Jewish holidays); Arab-sector rest days
  (Friday, the Eids, Christmas, Easter) are a product decision for the owner.
