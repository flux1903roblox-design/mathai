// The family challenge's goals and how many weeks a device keeps (PRODUCT2-39), on their own so the store (in the first
// load) can check and keep an accepted challenge without the challenge's links, texts and weeks (lib/familyChallenge.js,
// which re-exports these and loads with the screens that show a challenge). No imports: nothing comes with it.

/** The goals a parent can pick: few, small, and each one a week can hold. */
export const GOALS = Object.freeze([
  { k: 'd', n: 3 }, { k: 'd', n: 4 }, { k: 'd', n: 5 },
  { k: 's', n: 5 }, { k: 's', n: 10 },
]);
/** Weeks of accepted challenges a device keeps (the newest). */
export const KEEP_WEEKS = 4;

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
/** A real calendar day written 'YYYY-MM-DD'. */
export const isDay = (s) => typeof s === 'string' && DAY_RE.test(s) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;

/** Is [k, n] one of the goals on the list? */
export const isGoal = (k, n) => GOALS.some((g) => g.k === k && g.n === n);

/** The newest KEEP_WEEKS weeks of a { [week]: challenge } map. */
export function keepWeeks(map) {
  return Object.fromEntries(Object.entries(map || {}).filter(([w]) => isDay(w)).sort(([a], [b]) => (a < b ? 1 : -1)).slice(0, KEEP_WEEKS));
}
