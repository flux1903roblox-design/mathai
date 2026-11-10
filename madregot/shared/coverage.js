// How much of the Ministry's programme the app teaches, computed from the stairs that exist (shared/programme.js).
// Nothing here is typed by hand: give it the list of stair ids the app has, and the hours, the per-unit state, the
// "not yet" list and the school calendar follow. Plain JS, no web imports, so the Worker and the web app share it.
import { PROGRAMME } from './programme.js';

/**
 * @typedef {{ hours: number, skills: string[], note?: string, later?: 'S2' | 'S3' | 'S4' | 'S5' }} ProgrammePart
 * @typedef {{ hours: number, skills: string[], note: string | null, later: string | null, taught: boolean }} PartState
 * @typedef {{ id: string, domain: string, title: string, months: number[], hours: number, taught: number,
 *   state: 'yes' | 'part' | 'no', stairs: string[], missing: string[], parts: PartState[] }} UnitCoverage
 * @typedef {{ hours: number, taught: number, pct: number, units: UnitCoverage[] }} Coverage
 */

/** A part is taught when every stair it lists exists; a part that lists none is not taught yet. */
const partTaught = (part, have) => part.skills.length > 0 && part.skills.every((s) => have.has(s));

/** The words for an untaught part: its note, else the unit's title. */
const labelOf = (part, unit) => (part.note || unit.title || '').trim();

const unitsOf = (grade) => PROGRAMME.units.filter((u) => u.grade === String(grade));

/**
 * The coverage of one grade, given the stair ids the app has.
 * `stairs` are the unit's stairs that exist (for links); `missing` the words for its untaught parts;
 * `parts` each part with whether it is taught, so a page can say which stage brings a missing one.
 * @param {'7' | '8' | string | number} grade
 * @param {Iterable<string>} skills
 * @returns {Coverage}
 */
export function coverage(grade, skills) {
  const have = new Set(skills);
  const units = unitsOf(grade).map((u) => {
    const parts = u.parts.map((p) => ({ hours: p.hours, skills: [...p.skills], note: p.note || null, later: p.later || null, taught: partTaught(p, have) }));
    const hours = parts.reduce((a, p) => a + p.hours, 0);
    const taught = parts.reduce((a, p) => a + (p.taught ? p.hours : 0), 0);
    const listed = [...new Set(u.parts.flatMap((p) => p.skills))];
    const missing = [...new Set(u.parts.filter((p) => !partTaught(p, have)).map((p) => labelOf(p, u)).filter(Boolean))];
    /** @type {'yes' | 'part' | 'no'} */
    const state = taught === hours ? 'yes' : taught === 0 ? 'no' : 'part';
    return { id: u.id, domain: u.domain, title: u.title, months: [...u.months], hours, taught, state, stairs: listed.filter((s) => have.has(s)), missing, parts };
  });
  const hours = units.reduce((a, u) => a + u.hours, 0);
  const taught = units.reduce((a, u) => a + u.taught, 0);
  return { hours, taught, pct: hours ? Math.round((100 * taught) / hours) : 0, units };
}

/**
 * What the programme of a grade has that the app does not teach yet, in a few Hebrew words per part (the AI tutor's
 * "not yet" list): deduplicated, non-empty.
 * @param {'7' | '8' | string | number} grade
 * @param {Iterable<string>} skills
 * @returns {string[]}
 */
export const notYet = (grade, skills) => [...new Set(coverage(grade, skills).units.flatMap((u) => u.missing))].filter((s) => typeof s === 'string' && s.length > 0);

/** A calendar month (1-12) as its place in the school year: September 0 … June 9; July and August count as June. */
const schoolIndex = (month) => (month >= 9 ? month - 9 : Math.min(month + 3, 9));

/**
 * The earliest month of the school year (September 0 … June 9) in which a grade's programme teaches a stair, or null
 * when no unit of that grade lists it. A stair can serve both grades (pyth:1 is December in ז׳ and September in ח׳).
 * @param {string} skill
 * @param {'7' | '8' | string | number} grade
 * @returns {number | null}
 */
export function monthIndex(skill, grade) {
  const months = unitsOf(grade).filter((u) => u.parts.some((p) => p.skills.includes(skill))).flatMap((u) => u.months.map(schoolIndex));
  return months.length ? Math.min(...months) : null;
}

/**
 * Where a date falls in the school year: September 0 … June 9. July and August are 9: in the summer the whole year
 * counts as taught. A 'YYYY-MM-DD' string is read as written (no time-zone shift); a Date or a timestamp in local time.
 * @param {Date | string | number} [date]
 * @returns {number}
 */
export function schoolMonth(date = new Date()) {
  const m = typeof date === 'string' && /^\d{4}-\d{2}(-\d{2})?$/.test(date) ? Number(date.slice(5, 7)) : new Date(date).getMonth() + 1;
  return schoolIndex(m);
}
