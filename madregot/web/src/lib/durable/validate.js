// Is a saved state sound? validateState lists what is wrong with it, in plain words a developer can act on; an empty
// list means it is sound. Used by the migration tests, by a development-only check after every migration, and (later)
// by a restore, which refuses a backup with problems. Fields that are missing are fine (the store fills them with its
// defaults), except the XP counter, which must add up.
import { sumXp, TAG } from './xp.js';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_PROBLEMS = 25;

const kindOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);
// the type each top-level field must have when it is there
const TYPES = {
  profile: ['object', 'null'], progress: ['object'], days: ['object'], xp: ['number'], xpBy: ['object'], path: ['object'],
  freezes: ['number'], goalXp: ['number'], sound: ['boolean'], mistakes: ['object'], lastTopic: ['string', 'null'],
  outbox: ['array'], ai: ['object'], helpSent: ['number'], solveMode: ['string'], exams: ['array'], practiceExams: ['array'],
  planBase: ['object'], wins: ['object'], gaps: ['object'], placement: ['object', 'null'], learn: ['object'],
  resetAt: ['string', 'null'], durable: ['object'], backup: ['object'], haptics: ['boolean'], prefs: ['object'],
  teacherExams: ['array'],
  // the student lane (STUDENT-3/4/5/10): Madi's look, the streak's repair, the one-time notes, the class goal
  look: ['object'], streak: ['object'], nudges: ['object'], stepsOut: ['array'], classGoals: ['object'],
};
const LEARN_TYPES = { skills: ['object'], miscon: ['object'], missions: ['object'], events: ['array'], exam: ['object', 'null'] };

/** Every number that is NaN or infinite, by its path (functions, as in a live store, are skipped). */
function nonFinite(v, at, out) {
  if (out.length >= MAX_PROBLEMS) return;
  if (typeof v === 'number') { if (!Number.isFinite(v)) out.push(`${at}: not a finite number`); return; }
  if (!v || typeof v !== 'object') return;
  if (Array.isArray(v)) { v.forEach((x, i) => nonFinite(x, `${at}[${i}]`, out)); return; }
  for (const [k, x] of Object.entries(v)) if (typeof x !== 'function') nonFinite(x, at ? `${at}.${k}` : k, out);
}

/** What is wrong with a saved state (the store's `state`, at the current version): a list of problems, empty when sound. */
export function validateState(st) {
  if (!st || typeof st !== 'object' || Array.isArray(st)) return ['state: not an object'];
  const out = [];
  for (const [k, kinds] of Object.entries(TYPES)) {
    if (st[k] === undefined) continue;
    if (!kinds.includes(kindOf(st[k]))) out.push(`${k}: ${kindOf(st[k])}, expected ${kinds.join(' or ')}`);
  }
  if (kindOf(st.learn) === 'object') {
    for (const [k, kinds] of Object.entries(LEARN_TYPES)) {
      if (st.learn[k] !== undefined && !kinds.includes(kindOf(st.learn[k]))) out.push(`learn.${k}: ${kindOf(st.learn[k])}, expected ${kinds.join(' or ')}`);
    }
  }
  // the XP counter: one non-negative entry per device, adding up to xp
  if (st.xp === undefined) out.push('xp: missing');
  else if (Number.isFinite(st.xp) && st.xp < 0) out.push('xp: negative');
  if (st.xpBy === undefined) out.push('xpBy: missing');
  else if (kindOf(st.xpBy) === 'object') {
    for (const [tag, v] of Object.entries(st.xpBy)) {
      if (!(Number.isFinite(v) && v >= 0)) out.push(`xpBy.${tag}: ${String(v)}, expected a number 0 or more`);
    }
    if (Number.isFinite(st.xp) && sumXp(st.xpBy) !== st.xp) out.push(`xpBy: adds up to ${sumXp(st.xpBy)}, but xp is ${st.xp}`);
  }
  if (kindOf(st.durable) === 'object' && st.durable.tag != null && !(typeof st.durable.tag === 'string' && TAG.test(st.durable.tag))) {
    out.push(`durable.tag: ${JSON.stringify(st.durable.tag)}, expected 8 hex characters or null`);
  }
  if (kindOf(st.days) === 'object') {
    for (const [d, day] of Object.entries(st.days)) {
      if (!DAY.test(d)) out.push(`days.${d}: the key is not a date (YYYY-MM-DD)`);
      if (kindOf(day) !== 'object') out.push(`days.${d}: ${kindOf(day)}, expected object`);
    }
  }
  nonFinite(st, '', out);
  return out.slice(0, MAX_PROBLEMS);
}
