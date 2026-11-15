// A miss on a teaching step's object (an explore step, learn/types.ts ExploreStep), named like an exercise's miss
// (PRODUCT2-18): the explore steps carry no diag() of their own, so the mistake is read from what the object shows.
//   numberline  a − (−b) moved as a − b (minus-minus: the display is "a - (-b)" and the marker is on a + b), or the right
//               distance from the start the wrong way (direction). Only moves are read here: a marker one step off that
//               happens to sit on −answer is a slip of the hand on a line, not a sign error.
//   plot        the coordinates swapped (swap), or one coordinate's sign lost (sign). With given points that are the first
//               terms of a sequence as (place, term) from place 1 (manip.dots, expr:2): the asked place with its term one
//               step too far, n steps counted from the first term instead of n − 1 (start-n), or the step times the place
//               alone, the start forgotten (diff-only)
//   line        m and b swapped (m-b)
//   dline       the whole found from a part on a percent line (move 'max', "60 is 75% of it"): the part with the missing
//               percent of the part itself added back (60 + 25% of 60 = 75), the percent of the new amount (pct-of-new)
// Only a mistake the stair (or its topic) has a name for is returned: the line under the miss is the same line a typed
// miss shows (content/index.js diagnosisLine), and null leaves the step's own "not yet" in place.
import { catLabel } from './index.js';
import { manipCorrect, dlineValue } from './manip.js';

const near = (a, b) => typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) < 1e-9;
const SUB_NEG = /^\s*(-?\d+(?:\.\d+)?)\s*-\s*\(\s*(-\d+(?:\.\d+)?)\s*\)\s*$/; // a - (-b)

/** Given points that are a sequence's first terms, (1, s), (2, s + d), (3, s + 2d)…: its step d, or null. */
export function seqStep(dots) {
  if (!Array.isArray(dots) || dots.length < 2) return null;
  const d = dots[1][1] - dots[0][1];
  return dots.every(([x, y], i) => x === i + 1 && near(y, dots[0][1] + d * i)) ? d : null;
}

/** The mistakes an object's state shows, most telling first (the stair's own mistake, minus-minus, before a move). */
function shown(step, u) {
  const m = step.manip; const a = step.answer; const out = [];
  if (m.kind === 'numberline' && typeof u === 'number') {
    const from = m.from ?? m.start ?? 0;
    const sub = SUB_NEG.exec(step.display || '');
    if (sub && near(u, Number(sub[1]) + Number(sub[2]))) out.push('minus-minus');
    if (!near(u, from) && near(u - from, -(a - from))) out.push('direction');
  }
  if (m.kind === 'plot' && !m.quadrant && Array.isArray(u) && Array.isArray(a)) {
    if (a[0] !== a[1] && near(u[0], a[1]) && near(u[1], a[0])) out.push('swap');
    else if ((a[0] !== 0 && near(u[0], -a[0]) && near(u[1], a[1])) || (a[1] !== 0 && near(u[0], a[0]) && near(u[1], -a[1]))) out.push('sign');
  }
  const d = m.kind === 'plot' ? seqStep(m.dots) : null;
  if (d != null && Array.isArray(u) && Array.isArray(a) && near(u[0], a[0])) {
    if (near(u[1], a[1] + d)) out.push('start-n');
    else if (near(u[1], d * a[0])) out.push('diff-only');
  }
  if (m.kind === 'line' && u && a && typeof a === 'object' && a.m !== a.b && near(u.m, a.b) && near(u.b, a.m)) out.push('m-b');
  if (m.kind === 'dline' && m.move === 'max' && m.top?.unit === '%' && m.top.max === 100 && m.fixT < 100 && typeof a === 'number') {
    const part = (m.fixT * a) / 100;
    if (near(dlineValue(m, u), part + ((100 - m.fixT) / 100) * part)) out.push('pct-of-new');
  }
  return out;
}

/** The named mistake of a wrong state `u` of an explore step on a stair (topic, level), or null. */
export function exploreCat(topic, level, step, u) {
  if (!step?.manip || u == null || manipCorrect({ form: 'manip', manip: step.manip, answer: step.answer }, u)) return null;
  return shown(step, u).find((id) => catLabel(topic, level, id)) || null;
}
