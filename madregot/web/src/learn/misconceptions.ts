// The misconception engine. Deterministic: a wrong answer is matched against the answer each known
// misconception predicts for the same question (the stair's DiagModel bugs). It never decides from one answer:
//  - a match adds evidence (1, split between misconceptions that predict the same answer);
//  - a misconception is "confirmed" only with CONFIRM_SCORE evidence from at least two different questions;
//  - a right answer to a question where the misconception would have shown removes some evidence;
//  - a small slip (off by one, two digits swapped, ten off) is a slip, not a misconception;
//  - an ambiguous answer asks for a discriminating question: one where every candidate predicts something else.
import type { DiagModel, MisconRecord, Rng, SkillId } from './types';
import { same } from './expr';

export const CONFIRM_SCORE = 1.5;
/** Evidence from the older exercise generators: their diag() names one category and may hide another. */
export const GENERATOR_WEIGHT = 0.75;
/** A right answer where the misconception could have shown. */
export const COUNTER_WEIGHT = 0.5;
/**
 * The last step of solving together: the student was just led through the steps, so a wrong number there weighs half
 * an answer given alone (the two guided problems of a stair can never confirm a misconception by themselves).
 */
export const GUIDED_WEIGHT = 0.5;
export const MAX_OFFERS_PER_DAY = 2;
export const MAX_FAILED_VERIFY = 2;

export type Diagnosis =
  | { kind: 'right' }
  | { kind: 'misconception'; candidates: { id: string; conf: number }[]; ambiguous: boolean }
  | { kind: 'slip'; why: 'off-by-one' | 'swapped-digits' | 'ten-off' }
  | { kind: 'unknown' };

/** Is a wrong number a slip of the hand rather than of understanding? Same sign, and close or with two digits swapped. */
export function slipOf(u: number, ans: number): Extract<Diagnosis, { kind: 'slip' }>['why'] | null {
  if (!Number.isFinite(u) || same(u, ans)) return null;
  if (Math.sign(u) !== Math.sign(ans) && u !== 0 && ans !== 0) return null; // a sign error is about signs
  const d = Math.abs(u - ans);
  if (Number.isInteger(u) && Number.isInteger(ans)) {
    if (d === 1 && Math.abs(ans) >= 3) return 'off-by-one';
    if (d === 10 && Math.abs(ans) >= 10) return 'ten-off';
    const a = String(Math.abs(ans)); const b = String(Math.abs(u));
    if (a.length === 2 && b === a[1] + a[0] && a[0] !== a[1]) return 'swapped-digits';
  }
  return null;
}

/** v rounded to d decimal places, halves away from zero as at school: −0.75 to tenths is −0.8, not −0.7. */
export const roundAway = (v: number, d: number) => { const f = 10 ** d; return (Math.sign(v) * Math.round(Math.abs(v) * f + 1e-9)) / f; };
const whole = (v: number) => Math.abs(v - Math.round(v)) <= 1e-9;
/** A prediction that is not whole, as a student types it: rounded to tenths and to hundredths. */
export const roundings = (v: number) => (whole(v) ? [] : [roundAway(v, 1), roundAway(v, 2)]);

/**
 * Does a typed answer u match a predicted value v? The one rule of every diagnosis (practice exercises, the
 * diagnostic models, the last step of solving together). A whole prediction matches only itself. A prediction that is
 * not whole matches itself and its rounding to tenths or to hundredths, and nothing else near it: 4.45 is not 4.5
 * rounded. A root a misconception predicts is kept exact (√1025 = 32.02…), so 32 and 32.02 both match it.
 * With the right answer `ans`: a rounding that is also a slip of the hand from the answer (418.95 typed as 419 when
 * the answer is 420) matches nothing, since a slip is not a misconception.
 */
export function matchesValue(v: number, u: number, ans?: number) {
  if (same(v, u)) return true;
  return roundings(v).some((r) => same(r, u) && !(ans != null && slipOf(r, ans)));
}
/** A prediction a slip of the hand also gives, itself or as it is typed rounded (fair draws avoid them). */
export const slipLike = (v: number, ans: number) => !!slipOf(v, ans) || roundings(v).some((r) => !!slipOf(r, ans));

/** Is a typed answer right? A rounded length is right within half a tenth of its exact value (as content/index.js isCorrect). */
function isRight<P>(model: DiagModel<P>, p: P, u: number) {
  const ex = model.exact?.(p);
  if (ex != null && Math.abs(ex - Math.round(ex)) > 1e-9) return Math.abs(u - ex) <= 0.05 + 1e-9;
  return same(u, model.answer(p));
}

/** Diagnose one answer to a DiagModel question with parameters p. */
export function diagnose<P>(model: DiagModel<P>, p: P, u: number | null): Diagnosis {
  if (u == null || !Number.isFinite(u)) return { kind: 'unknown' };
  const ans = model.answer(p);
  if (isRight(model, p, u)) return { kind: 'right' };
  const matches = (v: number) => matchesValue(v, u, ans);
  const hits = Object.entries(model.bugs)
    .map(([id, f]) => ({ id, v: f(p) }))
    .filter((b) => b.v != null && Number.isFinite(b.v) && !same(b.v, ans) && matches(b.v!))
    .map((b) => b.id);
  if (hits.length) {
    const conf = 1 / hits.length;
    return { kind: 'misconception', candidates: hits.map((id) => ({ id, conf })), ambiguous: hits.length > 1 };
  }
  const slip = slipOf(u, ans);
  return slip ? { kind: 'slip', why: slip } : { kind: 'unknown' };
}

/** Misconceptions that would have shown on this question (their prediction differs from the right answer). */
export function couldShow<P>(model: DiagModel<P>, p: P): string[] {
  const ans = model.answer(p);
  return Object.entries(model.bugs).filter(([, f]) => { const v = f(p); return v != null && Number.isFinite(v) && !same(v, ans); }).map(([id]) => id);
}

/**
 * Parameters for the question that best tells the candidates apart. A misconception that does not apply to a
 * question predicts the right answer there (a student who has it would still answer correctly). The best question
 * splits the candidates into the most groups by their predictions (all different is best); with one candidate it is
 * one where that misconception would show. Some candidates can only be told apart over two questions: ask, narrow
 * with `narrow`, and ask again. Null when no question splits them at all.
 */
export function discriminating<P>(model: DiagModel<P>, candidates: string[], rnd: Rng, tries = 400): P | null {
  let best: P | null = null; let bestGroups = 1; let bestWrong = 0;
  for (let i = 0; i < tries; i += 1) {
    const p = model.params(rnd);
    const ans = model.answer(p);
    const values = candidates.map((c) => { const v = model.bugs[c]?.(p); return v == null || !Number.isFinite(v) ? ans : v; });
    const groups = new Set(values.map((v) => Math.round(v * 1e6))).size;
    const wrong = values.filter((v) => !same(v, ans)).length;
    if (candidates.length === 1) { if (wrong) return p; continue; }
    if (groups > bestGroups || (groups === bestGroups && groups > 1 && wrong > bestWrong)) { best = p; bestGroups = groups; bestWrong = wrong; }
    if (groups === candidates.length && wrong >= candidates.length - 1) return p;
  }
  return bestGroups > 1 ? best : null;
}

/** After the student answered a discriminating question: the candidates still consistent with that answer. */
export function narrow<P>(model: DiagModel<P>, candidates: string[], p: P, u: number): string[] {
  const ans = model.answer(p);
  return candidates.filter((c) => { const v = model.bugs[c]?.(p); return matchesValue(v == null || !Number.isFinite(v) ? ans : v, u, ans); });
}

const keyOf = (skill: SkillId, id: string) => `${skill}|${id}`;
export { keyOf as misconKey };

/** Add evidence for a misconception. The same question (itemKey) counts once. */
export function addEvidence(all: Record<string, MisconRecord>, skill: SkillId, id: string, weight: number, itemKey: string, at: string): Record<string, MisconRecord> {
  const k = keyOf(skill, id);
  const r = all[k];
  if (r?.seen.includes(itemKey)) return all;
  // a resolved misconception that shows again starts over as a suspicion (a relapse is information, not failure)
  const base: MisconRecord = r && r.state !== 'resolved' ? r : { skill, id, score: 0, seen: [], state: 'suspected', at };
  const score = base.score + weight;
  const seen = [...base.seen, itemKey].slice(-12);
  const confirmed = score >= CONFIRM_SCORE && seen.length >= 2;
  const state = base.state === 'repairing' ? 'repairing' : confirmed ? 'confirmed' : 'suspected';
  return { ...all, [k]: { ...base, score, seen, state, at } };
}

/** A right answer where the misconception could have shown: less evidence. A suspicion with none left is dropped. */
export function addCounter(all: Record<string, MisconRecord>, skill: SkillId, id: string, weight: number): Record<string, MisconRecord> {
  const k = keyOf(skill, id); const r = all[k];
  if (!r || r.state === 'resolved' || r.state === 'repairing') return all;
  const score = Math.max(0, r.score - weight);
  if (score === 0 && r.state === 'suspected') { const { [k]: _gone, ...rest } = all; return rest; }
  return { ...all, [k]: { ...r, score, state: score >= CONFIRM_SCORE ? r.state : 'suspected' } };
}

/** Remediation started (the explanation and the activity were shown). */
export function startRepair(all: Record<string, MisconRecord>, skill: SkillId, id: string, day: string, at: string): Record<string, MisconRecord> {
  const k = keyOf(skill, id); const r = all[k] || { skill, id, score: 0, seen: [], state: 'suspected' as const, at };
  const offered = r.offered?.day === day ? { day, n: r.offered.n + 1 } : { day, n: 1 };
  return { ...all, [k]: { ...r, state: 'repairing', offered, at } };
}

/**
 * The verification after a remediation: VERIFY_N questions, two where the misconception would show and one where it
 * would not. Resolved when all of them are right (so it is not passed by a fixed answer or by luck) and the
 * misconception did not show again; otherwise back to confirmed.
 */
export const VERIFY_N = 3;
export const VERIFY_NEED = 3;
export function finishVerify(all: Record<string, MisconRecord>, skill: SkillId, id: string, right: number, showedAgain: number, at: string): Record<string, MisconRecord> {
  const k = keyOf(skill, id); const r = all[k]; if (!r) return all;
  if (right >= VERIFY_NEED && showedAgain === 0) return { ...all, [k]: { ...r, state: 'resolved', score: 0, resolvedAt: at, at, failedVerify: 0 } };
  return { ...all, [k]: { ...r, state: 'confirmed', failedVerify: (r.failedVerify || 0) + 1, at } };
}

/** Can the remediation be offered again now? Not more than MAX_OFFERS_PER_DAY a day, and not after it failed twice. */
export function canOffer(r: MisconRecord | undefined, day: string): boolean {
  if (!r) return true;
  if ((r.failedVerify || 0) >= MAX_FAILED_VERIFY) return false;
  return !(r.offered?.day === day && r.offered.n >= MAX_OFFERS_PER_DAY);
}

/** The misconceptions that need attention, strongest first. */
export function openMisconceptions(all: Record<string, MisconRecord>): MisconRecord[] {
  return Object.values(all).filter((r) => r.state === 'confirmed' || r.state === 'repairing').sort((a, b) => b.score - a.score);
}

/** The share of misconceptions ever confirmed that are now resolved (a learning-outcome metric). */
export function resolutionRate(all: Record<string, MisconRecord>): { resolved: number; total: number } {
  const rs = Object.values(all).filter((r) => r.state !== 'suspected' || r.resolvedAt);
  return { resolved: rs.filter((r) => r.state === 'resolved').length, total: rs.length };
}
