// The store listing (STUDENT-12 §4): writes store/listing.he.json, what the owner pastes into App Store Connect and
// Play Console. The description's topic lines come from the app's own content (topicsFor('7'), topicsFor('8'), read
// through Vite as the landing pages read them), so the listing can never name a topic the app does not teach; the name
// comes from shared/brand.js APP_NAME. Each grade's share of the Ministry's programme ({{COVERAGE_7}}, {{COVERAGE_8}})
// is quoted from store/counts.json (coverage['7'], coverage['8']: the /programme page's sentences, written from the code
// by `npm run programme:md`), so no number in the listing is typed by hand (FOLLOWUP-15). Edit the words here (the short fields) or in description.he.md (the description),
// then run it again:
//
//   node madregot/store/make-listing.mjs
//
// PUBLIC_URL (the build env, else worker/wrangler.toml [vars]) fills the privacy line; while it is empty the line is
// left out, so run this again once the owner has filled it.
// What the listing says about features is checked like the landing pages' (STUDENT-17, web/src/content/claims.js):
// the description names claims as {{CLAIM id}}, and the review notes' sentences about a feature name the claim that
// backs them. A claim whose code is not in this build is left out, so run this again after a lane merges. web/scripts/listing.test.mjs checks the lengths and words
// against the stores' limits, and that the file is what this script writes for the app as it is.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const LISTING_FILE = join(HERE, 'listing.he.json');
export const TEMPLATE_FILE = join(HERE, 'description.he.md');
export const COUNTS_FILE = join(HERE, 'counts.json');

/** Each grade's coverage sentence from counts.json ({ 7, 8 }); {} while the file or its sentences are missing. */
export function countsCoverage(file = COUNTS_FILE) {
  try {
    const c = JSON.parse(readFileSync(file, 'utf8'))?.coverage || {};
    return Object.fromEntries(['7', '8'].filter((g) => typeof c[g] === 'string' && c[g].trim()).map((g) => [g, c[g].trim()]));
  } catch { return {}; }
}

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
// Android paragraph about families who subscribe on the website. { claim: id } is that claim's sentence, or nothing
// while the claim is hidden.
export const NOTES = {
  common: ['Madregot is a Hebrew maths practice app for grades 7–8. All lessons and practice work offline.', { claim: 'local-reminders' }, 'The app sells nothing and shows no prices or purchase links. No account is needed to use the app.'],
  apple: ["(iOS version) The AI helper is limited to a small free daily allowance, or is included in class licences that schools buy directly from us (guideline 3.1.3(c)). No consumer subscription is unlocked in this app. Before the first AI request the app explains that the exercise text (and a photo, if the student takes one) is sent to Anthropic's Claude to get an answer, and asks permission (5.1.2(i)).", { claim: 'parent-ok' }],
  play: ['(Android version) Families who subscribe on our website can use the AI helper here; nothing can be bought in the app, and there are no links to purchase (consumption-only).', { claim: 'report-answer' }],
  test: ['Test path: open the app, choose a name and grade, tap "מתחילים מההתחלה".'],
};

/** A claim's words, '' while it is hidden; an id the claims do not know stops the script. */
function claimOf(claims, id) {
  if (!claims.known.includes(id)) throw new Error(`make-listing: no claim "${id}" in web/src/content/claims.js`);
  return claims.shown[id] || '';
}
/** A paragraph of the notes: its sentences, without the hidden claims'. */
const notesText = (parts, claims) => parts.map((p) => (typeof p === 'string' ? p : claimOf(claims, p.claim))).filter(Boolean).join(' ');

/** The topic names joined with commas, as on the landing pages. */
const list = (names) => names.join(', ');

/**
 * The description: the template with its slots filled; a line whose slot has no value (the privacy line, a coverage line
 * with no counts.json) is left out. {{CLAIM id}} is that claim's sentence, or nothing while it is hidden; a line left
 * empty is left out. `coverage` is countsCoverage().
 */
export function description(template, { appName, topics, privacyUrl, coverage = {}, claims = { shown: {}, known: [] } }) {
  const slots = {
    APP_NAME: appName, TOPICS_7: list(topics['7']), TOPICS_8: list(topics['8']), PRIVACY_URL: privacyUrl || '',
    COVERAGE_7: coverage['7'] || '', COVERAGE_8: coverage['8'] || '',
  };
  const withClaims = template.replace(/\r\n/g, '\n').replace(/\{\{CLAIM ([\w-]+)\}\}/g, (_, id) => claimOf(claims, id));
  const unknown = [...withClaims.matchAll(/\{\{(\w+)\}\}/g)].find((m) => !(m[1] in slots));
  if (unknown) throw new Error(`description.he.md: unknown slot ${unknown[0]}`);
  const claimLine = new Set(template.replace(/\r\n/g, '\n').split('\n').map((l, i) => (/\{\{CLAIM /.test(l) ? i : -1)).filter((i) => i >= 0));
  return withClaims.split('\n')
    .filter((line, i) => [...line.matchAll(/\{\{(\w+)\}\}/g)].every((m) => slots[m[1]]) && !(claimLine.has(i) && !line.trim()))
    .map((line) => line.replace(/\{\{(\w+)\}\}/g, (all, k) => slots[k]).replace(/ {2,}/g, ' ').trimEnd())
    .join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * The whole listing for the app as it is. `topics` is { 7: [titles], 8: [titles] }; `claims` is the landing build's
 * checked claims ({ shown: { id: text }, known: [ids] }, web/scripts/landing-build.mjs checkClaims).
 */
export function listing({ appName, topics, privacyUrl, claims, coverage = countsCoverage(), template = readFileSync(TEMPLATE_FILE, 'utf8') }) {
  const name = (s) => s.replaceAll('{{APP_NAME}}', appName);
  const text = description(template, { appName, topics, privacyUrl, coverage, claims });
  return {
    apple: { ...Object.fromEntries(Object.entries(FIELDS.apple).map(([k, v]) => [k, name(v)])), description: text },
    play: { ...Object.fromEntries(Object.entries(FIELDS.play).map(([k, v]) => [k, name(v)])), fullDescription: text },
    reviewNotes: {
      apple: [NOTES.common, NOTES.apple, NOTES.test].map((p) => notesText(p, claims)).join('\n\n'),
      play: [NOTES.common, NOTES.play, NOTES.test].map((p) => notesText(p, claims)).join('\n\n'),
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
  const { appData, checkClaims, wranglerVars } = await import('../web/scripts/landing-build.mjs');
  const app = await appData();
  const toml = join(HERE, '..', 'worker', 'wrangler.toml');
  const claims = checkClaims(app, wranglerVars(existsSync(toml) ? readFileSync(toml, 'utf8') : ''));
  const { topics } = app;
  const privacyUrl = privacyUrlFor(publicUrl());
  const out = listing({ appName: APP_NAME, topics, privacyUrl, claims });
  writeFileSync(LISTING_FILE, `${JSON.stringify(out, null, 2)}\n`);
  const hidden = claims.status.filter((c) => !c.visible).map((c) => c.id);
  console.log(`make-listing: ${LISTING_FILE} (${topics['7'].length + topics['8'].length} topics${privacyUrl ? `, privacy ${privacyUrl}` : '; no privacy line until PUBLIC_URL is set'}; claims hidden: ${hidden.join(', ') || 'none'})`);
}
