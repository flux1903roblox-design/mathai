// The store listing (STUDENT-12 §4): writes store/listing.he.json, what the owner pastes into App Store Connect and
// Play Console. The description's topic lines come from the app's own content (topicsFor('7'), topicsFor('8'), read
// through Vite as the landing pages read them), so the listing can never name a topic the app does not teach; the name
// comes from shared/brand.js APP_NAME. Edit the words here (the short fields) or in description.he.md (the description),
// then run it again:
//
//   node madregot/store/make-listing.mjs
//
// PUBLIC_URL (the build env, else worker/wrangler.toml [vars]) fills the privacy line; while it is empty the line is
// left out, so run this again once the owner has filled it. web/scripts/listing.test.mjs checks the lengths and words
// against the stores' limits, and that the file is what this script writes for the app as it is.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const LISTING_FILE = join(HERE, 'listing.he.json');
export const TEMPLATE_FILE = join(HERE, 'description.he.md');

/** The fields with no generated part. {{APP_NAME}} is the product's name. */
export const FIELDS = {
  apple: {
    name: '{{APP_NAME}}: מתמטיקה לכיתות ז׳–ח׳',
    subtitle: 'תרגול קצר והסבר לכל טעות',
    promotionalText: 'מבחן בקרוב? בונים תוכנית חזרה לימים שנשארו. שיעורים קצרים, תרגול שנבדק במקום, ומדי שמסביר מה כנראה קרה בכל טעות.',
    keywords: 'מתמטיקה,חשבון,כיתה ז,כיתה ח,מבחן,אלגברה,משוואות,זוויות,פיתגורס,סטטיסטיקה,שיעורי בית,תרגול',
  },
  play: {
    title: '{{APP_NAME}}: מתמטיקה לכיתות ז׳–ח׳',
    shortDescription: 'מתמטיקה לכיתות ז׳–ח׳ בעברית: שיעורים קצרים, תרגול והסבר לכל טעות.',
  },
};

// For the reviewers, in English (both stores read it). Each store gets the shared part, its own paragraph and the test
// path: the iOS app unlocks no consumer plan bought elsewhere (Apple 3.1.3(b)/(c)), so Apple's reviewer must not read the
// Android paragraph about families who subscribe on the website.
const NOTES = {
  common: 'Madregot is a Hebrew maths practice app for grades 7–8. All lessons and practice work offline. Daily reminders are local notifications (iOS) / web push (Android), opt-in, never on Shabbat or holidays. The app sells nothing and shows no prices or purchase links. No account is needed to use the app.',
  apple: "(iOS version) The AI helper is limited to a small free daily allowance, or is included in class licences that schools buy directly from us (guideline 3.1.3(c)). No consumer subscription is unlocked in this app. Before the first AI request the app explains that the exercise text (and a photo, if the student takes one) is sent to Anthropic's Claude to get an answer, and asks permission (5.1.2(i)). A parent's one-time approval is also required.",
  play: '(Android version) Families who subscribe on our website can use the AI helper here; nothing can be bought in the app, and there are no links to purchase (consumption-only). AI answers can be reported in the app.',
  test: 'Test path: open the app, choose a name and grade, tap "מתחילים מההתחלה".',
};

/** The topic names joined with commas, as on the landing pages. */
const list = (names) => names.join(', ');

/** The description: the template with its slots filled; a line whose slot has no value (the privacy line) is left out. */
export function description(template, { appName, topics, privacyUrl }) {
  const slots = { APP_NAME: appName, TOPICS_7: list(topics['7']), TOPICS_8: list(topics['8']), PRIVACY_URL: privacyUrl || '' };
  const unknown = [...template.matchAll(/\{\{(\w+)\}\}/g)].find((m) => !(m[1] in slots));
  if (unknown) throw new Error(`description.he.md: unknown slot ${unknown[0]}`);
  return template.replace(/\r\n/g, '\n').split('\n')
    .filter((line) => [...line.matchAll(/\{\{(\w+)\}\}/g)].every((m) => slots[m[1]]))
    .map((line) => line.replace(/\{\{(\w+)\}\}/g, (all, k) => slots[k]))
    .join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** The whole listing for the app as it is. `topics` is { 7: [titles], 8: [titles] }. */
export function listing({ appName, topics, privacyUrl, template = readFileSync(TEMPLATE_FILE, 'utf8') }) {
  const name = (s) => s.replaceAll('{{APP_NAME}}', appName);
  const text = description(template, { appName, topics, privacyUrl });
  return {
    apple: { ...Object.fromEntries(Object.entries(FIELDS.apple).map(([k, v]) => [k, name(v)])), description: text },
    play: { ...Object.fromEntries(Object.entries(FIELDS.play).map(([k, v]) => [k, name(v)])), fullDescription: text },
    reviewNotes: {
      apple: [NOTES.common, NOTES.apple, NOTES.test].join('\n\n'),
      play: [NOTES.common, NOTES.play, NOTES.test].join('\n\n'),
    },
  };
}

/** The app's privacy page for a site address ('' when there is none yet). */
export const privacyUrlFor = (publicUrl) => (/^https:\/\/[^\s"'<>]+$/.test(publicUrl || '') ? `${publicUrl.replace(/\/+$/, '')}/#/privacy` : '');

/** PUBLIC_URL from the env, else worker/wrangler.toml [vars] (where the owner fills it once). */
function publicUrl() {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL;
  const toml = join(HERE, '..', 'worker', 'wrangler.toml');
  if (!existsSync(toml)) return '';
  const vars = /^\[vars\]\s*$([\s\S]*?)(?=^\[)/m.exec(readFileSync(toml, 'utf8'))?.[1] || '';
  return /^PUBLIC_URL\s*=\s*"([^"]*)"/m.exec(vars)?.[1] || '';
}

// node madregot/store/make-listing.mjs
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { APP_NAME } = await import('../shared/brand.js');
  const { appData } = await import('../web/scripts/landing-build.mjs');
  const { topics } = await appData();
  const privacyUrl = privacyUrlFor(publicUrl());
  const out = listing({ appName: APP_NAME, topics, privacyUrl });
  writeFileSync(LISTING_FILE, `${JSON.stringify(out, null, 2)}\n`);
  console.log(`make-listing: ${LISTING_FILE} (${topics['7'].length + topics['8'].length} topics${privacyUrl ? `, privacy ${privacyUrl}` : '; no privacy line until PUBLIC_URL is set'})`);
}
