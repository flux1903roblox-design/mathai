// Grading a challenge (CURRICULUM-6.2), all by code: offline, no AI. Two tries per part; after the second miss the part's
// solution is shown and the task goes on. A finished task gives 20 XP and 5 more for each part right on the first try,
// at most 40, once. An `explain` part is the student's own words: it carries no score and is never stored.
import type { ChallengePart, ChallengeTask } from '../types';
import { evaluate, seeded } from '../expr';
// @ts-ignore: plain JS, the one rule for reading and checking typed numbers
import { readNumCandidates, numRight } from '@/content/util.js';

export const TRIES = 2;
export const XP_BASE = 20;
export const XP_PER_FIRST_TRY = 5;
export const XP_MAX = 40;

/** The XP of a finished task: 20, plus 5 per part right on the first try, at most 40. */
export const challengeXP = (firstTry: number) => Math.min(XP_MAX, XP_BASE + XP_PER_FIRST_TRY * Math.max(0, firstTry));
/** The parts that count: every part but `explain`. */
export const scoredParts = (task: ChallengeTask): ChallengePart[] => task.parts.filter((p) => p.type !== 'explain');

/**
 * A typed number against an answer: "2,000" may be 2 or 2000, and either reading that is right counts; compared as
 * every precise answer is (content/util.js numRight: exactly, or within half a hundredth for an answer with no short
 * decimal). Null when nothing readable was typed.
 */
export function numCheck(answer: number, typed: string): { u: number; ok: boolean } | null {
  const cands: number[] = readNumCandidates(typed);
  if (!cands.length) return null;
  const ok = (v: number) => numRight(v, answer, true);
  const u = cands.find(ok) ?? cands[0];
  return { u, ok: ok(u) };
}

type Example = NonNullable<Extract<ChallengePart, { type: 'claim' }>['example']>;
const inDomain = (v: number, domain: Example['domain']) => Number.isFinite(v)
  && (domain === 'number' || (Number.isInteger(v) && (domain === 'int' || v > 0)));
const holdsRel = (v: number, rel: Example['rel'], value: number) => {
  const eps = 1e-9;
  switch (rel) {
    case '<': return v < value - eps;
    case '<=': return v <= value + eps;
    case '>': return v > value + eps;
    case '>=': return v >= value - eps;
    default: return Math.abs(v - value) > eps;
  }
};
/**
 * Is this a counterexample? Every slot holds a number of the domain, and the expression evaluated there (learn/expr.ts)
 * is a real number for which `rel value` holds. A slot left empty, a value outside the domain or an expression that
 * cannot be evaluated (a zero denominator) is not.
 */
export function exampleHolds(ex: Example, values: Record<string, number | null | undefined>): boolean {
  const vars: Record<string, number> = {};
  for (const s of ex.slots) {
    const v = values[s.name];
    if (typeof v !== 'number' || !inDomain(v, ex.domain)) return false;
    vars[s.name] = v;
  }
  let v: number;
  try { v = evaluate(ex.expr, vars); } catch { return false; }
  return Number.isFinite(v) && holdsRel(v, ex.rel, ex.value);
}
/** The values a brute-force search tries for a domain (small numbers, and halves for `number`). */
export const domainValues = (domain: Example['domain']): number[] => {
  const ints = Array.from({ length: 21 }, (_, i) => i - 10);
  if (domain === 'positive-int') return ints.filter((v) => v > 0);
  if (domain === 'int') return ints;
  return [...ints, ...ints.map((v) => v + 0.5)];
};

type Order = Extract<ChallengePart, { type: 'order' }>;
/** The group of a step: steps that may come in any order among themselves share the smallest index of their group. */
const groupOf = (part: Order, step: number) => (part.free || []).find((g) => g.includes(step))?.reduce((a, b) => Math.min(a, b)) ?? step;
/** The first place whose step is not one that belongs there (-1: the order is right). `order` lists step indexes. */
export function firstOutOfPlace(part: Order, order: number[]): number {
  return order.findIndex((step, place) => groupOf(part, step) !== groupOf(part, place));
}
/** A string's own number, so a task always opens on the same shuffle. */
const hash = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);
/** The steps as first shown: a shuffle seeded by the task's id that is never already a right order. */
export function shuffledOrder(part: Order, seed: string): number[] {
  const rnd = seeded(hash(seed));
  const order = part.steps.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i -= 1) { const j = Math.floor(rnd() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  // a right order (or one only the free groups make right) is turned by one place until it is not
  for (let k = 0; k < order.length && firstOutOfPlace(part, order) === -1; k += 1) order.push(order.shift()!);
  return order;
}
/** Move the step at `from` one place up (-1) or down (+1). */
export function moveStep(order: number[], from: number, dir: -1 | 1): number[] {
  const to = from + dir;
  if (to < 0 || to >= order.length) return order;
  const next = [...order];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}
