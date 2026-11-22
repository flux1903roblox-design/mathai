// The proof object (GEOM-3): a proof in the class's table, טענה | נימוק. It takes exactly the challenge track's `order`
// part (learn/types.ts: steps { text, reason?: { choices, answer }, fixed? }, free groups), so a proof written once
// serves a practice item, a discover step and a challenge. A step with `reason` asks it (a choice); a step with `fixed`
// shows its reason and asks nothing (`נתון` on a given).
//   spec   { kind: 'proof', given, goal, part, lockOrder?, seed, fig?, tpl?, set? }
//          lockOrder keeps the rows in order (only the missing reasons are asked); otherwise the rows start in the
//          challenge track's seeded shuffle (learn/challenges/grade.ts shuffledOrder), which is never already right.
//          fig is the drawing the proof is read against; tpl and set name the template it was made from (content/proofs.js)
//   value  { order: the step shown at each place, reasons: per step the chosen choice (null until chosen) }
// This file registers the kind with content/manip.js when it loads, so manipCorrect, manipText, manipPlain,
// manipSolution and manipWrong answer for it; it is not part of the first screen. Whatever makes a proof item imports
// it: components/manip/ProofTable.jsx and content/proofs.js (the templates).
import { registerKind } from './manip.js';
import { firstOutOfPlace, shuffledOrder } from '@/learn/challenges/grade.ts';
import { texToPlain } from '@shared/plain.js';

const plain = (t) => texToPlain(t);
/** The places 0..n−1. */
const identity = (n) => Array.from({ length: n }, (_, i) => i);
/** A step's right reason: the fixed one, or the right choice. */
export const rightReason = (step) => (step.fixed != null ? step.fixed : step.reason ? step.reason.choices[step.reason.answer] : '');
/** The steps whose reason is asked, by index. */
export const askedSteps = (part) => part.steps.map((s, i) => (s.reason ? i : -1)).filter((i) => i >= 0);
/** The reason a value gives a step: the fixed one, the chosen choice, or null while none is chosen. */
export function reasonShown(step, chosen) {
  if (step.fixed != null) return step.fixed;
  return chosen == null || !step.reason ? null : step.reason.choices[chosen] ?? null;
}
/** Is a value well formed for this part: the order a permutation of the steps, a reason slot per step? */
export function proofValueOk(part, v) {
  const n = part.steps.length;
  return !!v && Array.isArray(v.order) && v.order.length === n && [...v.order].sort((a, b) => a - b).every((s, i) => s === i)
    && Array.isArray(v.reasons) && v.reasons.length === n;
}

/** Where the rows start: in order with lockOrder, else the seeded shuffle; no reason chosen yet. */
export function proofStart(m) {
  const n = m.part.steps.length;
  return { order: m.lockOrder ? identity(n) : shuffledOrder(m.part, String(m.seed ?? '')), reasons: m.part.steps.map(() => null) };
}
/** Is the order right (the free groups in any order)? */
export const proofOrderRight = (m, v) => proofValueOk(m.part, v) && firstOutOfPlace(m.part, v.order) === -1;
/** How many of the asked reasons are chosen, and how many there are. */
export function proofChosen(m, v) {
  const asked = askedSteps(m.part);
  return { k: asked.filter((i) => v?.reasons?.[i] != null).length, n: asked.length };
}
/**
 * What a check outlines (GEOM-3.5): the first row out of place ({ place, why: 'order' }); when the order is right, the
 * first row, top to bottom, whose asked reason is wrong ('reason') or not chosen yet ('missing'); null when all is right.
 */
export function proofFirstWrong(m, v) {
  if (!proofValueOk(m.part, v)) return null;
  const off = firstOutOfPlace(m.part, v.order);
  if (off >= 0) return { place: off, why: 'order' };
  for (let place = 0; place < v.order.length; place += 1) {
    const s = m.part.steps[v.order[place]];
    if (!s.reason) continue;
    const c = v.reasons[v.order[place]];
    if (c == null) return { place, why: 'missing' };
    if (c !== s.reason.answer) return { place, why: 'reason' };
  }
  return null;
}
/**
 * The fewest reasons a proof in a check asks, each a choice of three or more: a student who knows the order of the rows
 * and picks the reasons at random is right once in 27 or less (proofReasonGuess).
 */
export const CHECK_REASONS = 3;
/**
 * Can a check ask this proof (GEOM-3.10; the council's round 3: the proof stairs were mastered by numbers alone)? Only a
 * whole one: its rows shuffled (no lockOrder) and at least CHECK_REASONS reasons asked, each a choice of three or more.
 * Filling in one or two reasons, or choosing the theorem alone, is guessed too easily: practice only.
 */
export function proofCheckable(m) {
  const asked = askedSteps(m.part);
  return !m.lockOrder && asked.length >= CHECK_REASONS && asked.every((i) => m.part.steps[i].reason.choices.length >= 3);
}
/** The chance that reasons picked at random are all right, the order of the rows known: one over the choices' product. */
export const proofReasonGuess = (m) => askedSteps(m.part).reduce((p, i) => p / m.part.steps[i].reason.choices.length, 1);
/** Right: the order right (free groups in any order) and every asked reason the right one. */
export const proofCorrect = (m, v) => proofOrderRight(m, v) && askedSteps(m.part).every((i) => v.reasons[i] === m.part.steps[i].reason.answer);
/** The right table: the steps in order, every asked reason right. */
export const proofSolution = (m) => ({ order: identity(m.part.steps.length), reasons: m.part.steps.map((s) => (s.reason ? s.reason.answer : null)) });
/**
 * A table one step from right: the first two rows of different groups swapped, every reason right; with lockOrder (the
 * order cannot change) the first asked reason is the next choice instead.
 */
export function proofWrong(m) {
  const sol = proofSolution(m);
  if (m.lockOrder) {
    const i = askedSteps(m.part)[0];
    const r = [...sol.reasons]; r[i] = (r[i] + 1) % m.part.steps[i].reason.choices.length;
    return { order: sol.order, reasons: r };
  }
  const order = [...sol.order];
  const other = order.findIndex((s) => firstOutOfPlace(m.part, swap(order, 0, s)) !== -1);
  return { order: swap(order, 0, other), reasons: sol.reasons };
}
const swap = (a, i, j) => { const b = [...a]; [b[i], b[j]] = [b[j], b[i]]; return b; };

/** The table as it stands, row by row: "1. AM = MB — נתון; 2. …" (a reason not chosen yet is "?"). */
export function proofText(m, v) {
  return v.order.map((s, place) => `${place + 1}. ${plain(m.part.steps[s].text)} — ${plain(reasonShown(m.part.steps[s], v.reasons[s]) ?? '?')}`).join('; ');
}
/** The setup for the tutor and the teacher: the givens, what to prove, and the rows as they are first shown. */
export function proofPlain(m) {
  const start = proofStart(m);
  const rows = start.order.map((s, place) => {
    const st = m.part.steps[s];
    return `${place + 1}. ${plain(st.text)} (${st.fixed != null ? `נימוק: ${plain(st.fixed)}` : `נימוק לבחירה: ${st.reason.choices.map(plain).join(' / ')}`})`;
  });
  const task = m.lockOrder ? 'הסדר נכון, משלימים את הנימוקים החסרים' : 'מסדרים את השורות ובוחרים נימוקים';
  return `[הוכחה בטבלה, טענה ונימוק. נתון: ${plain(m.given)}; צ״ל: ${plain(m.goal)}; השורות כפי שהן מוצגות: ${rows.join(', ')}; ${task}]`;
}

// ---------------------------------------------------------------- the kind, as content/manip.js asks for it
registerKind('proof', {
  correct: (it, u) => proofCorrect(it.manip, u),
  text: (it, u) => (proofValueOk(it.manip.part, u) ? proofText(it.manip, u) : ''),
  plain: (it) => proofPlain(it.manip),
  solution: (it) => proofSolution(it.manip),
  wrong: (it) => proofWrong(it.manip),
});
