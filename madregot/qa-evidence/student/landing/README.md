# Landing pages: /mivchan/ and /pilot/ (STUDENT-13)

Built by `web/scripts/landing-build.mjs` from `web/landing/` into a copy of the e2e build, with stand-in owner values
(`PUBLIC_URL=https://madregot.example.test`, `CONTACT_EMAIL=hello@example.test`, `BUSINESS_NAME=מדרגות (דוגמה)`).
Full-page shots at 390 wide (a phone) and 1440 wide (a desktop), light and dark (the pages follow the phone's setting
with the app's own tokens). The phone pictures inside the pages are the real no-server app, made by
`store/capture.cjs landing` (Exam Rescue for a test next Thursday; the teacher's board of a synthetic class).

| File | What it shows |
|---|---|
| `mivchan-390-light.png`, `mivchan-390-dark.png` | Parents: "מבחן במתמטיקה ביום חמישי?", the sentence and the button "לבנות תוכנית חזרה, חינם" in the first screen, then the plan in a phone, איך זה עובד (3 steps), the topics per grade (from `topicsFor`), what is free and what the family plan costs (₪29.90 / ₪249, VAT included, from the Worker's prices), privacy, four questions, the button again with מדי, and the footer (business, e-mail, terms, privacy, accessibility). |
| `mivchan-1440-light.png`, `mivchan-1440-dark.png` | The same on a desktop: the hero in two columns, the steps in three. |
| `pilot-390-light.png`, `pilot-390-dark.png` | Schools: "פיילוט של שבועיים בכיתה אחת. חינם.", "לפתוח כיתה", the teacher's board in a phone, what a class gets, privacy, the catalogue status, what the pilot measures, the message for parents to copy, the contact, and the footer. No price anywhere. |
| `pilot-1440-light.png`, `pilot-1440-dark.png` | The same on a desktop. |

Checked by tests:

- `web/scripts/landing-build.test.mjs` (vitest, runs the real command): no `{{` left; the token blocks equal
  `tokens.css` `:root` and `dark.css`'s phone-dark block; the prices equal `lib/price.js`, which equal the Worker's
  defaults in `billing.js` and `wrangler.toml`; the topic lines equal `topicsFor`; the goal minutes equal `GOALS`;
  each page with its CSS and script is under 30 KB without images (`landing.css` as written under 8 KB, `count.js`
  under 400 B, each phone picture under 70 KB); `lang="he" dir="rtl"`, one `h1`, landmarks, a skip link, every `img`
  with `alt` and its real `width`/`height`; owner values escaped; every link relative (`../#/…`); without
  `PUBLIC_URL` no canonical, preview image or sitemap.
- `web/e2e/landing.spec.js` (phone): the `h1`; the first screen holds the question, the sentence and the button; the
  button leads to Welcome, and after the first questions (no "where to start" question; the last button says
  "לתוכנית החזרה") the address is `#/rescue`; a student who already uses the app goes to `#/rescue` at once; `/pilot/`'s
  button opens the teacher's way in (`start=teacher`, and `role=teacher`); text contrast (WCAG AA, `e2e/contrast.js`)
  on the whole page in light and dark; no sideways scroll at 320; the skip link is the first Tab stop and moves focus
  to the content; every link at least 44 px tall; `count.js` beacons `landing_view_mivchan` / `landing_view_pilot`
  and `landing_cta_*` to a mocked `/api/metrics`.
- `web/src/lib/deepLink.test.js`: only `/rescue`, `/teacher`, `/parents`, `/quests` are followed; `welcome_from_landing`
  is counted once per load, only for `src=mivchan` or `src=pilot`.

Not here yet: an axe run (TRUST-2's `e2e/axe.js` is not on this branch; the contrast probe stands in for text
contrast), the `/pilot/` block "העוזר החכם" (TRUST's `shared/schoolRules.js`) and the "לראות כיתה לדוגמה" button
(TEACHER-15's demo class).
