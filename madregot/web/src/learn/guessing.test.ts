// Can a check be passed by guessing? For every check (mastery, review, jump test, the verification after a repair)
// and every placement level, a student who answers without thinking must pass under 2% of the time.
//
// Two guessing strategies, the better one counts:
//  - most common answer: for each kind of question (its form and where it comes from), the answer that question
//    has most often, learned from a sample of the same check's questions;
//  - best constant: one fixed answer per form (number, choice, point, line, object), the one right most often.
// Each question's chance is measured on a fresh sample; a check's pass rate is then exact (its questions are drawn
// independently): mastery and jump tests need 4 of 5, a review 3 of 3, a verification 3 of 3; a placement probe needs
// all three of its questions, and a topic's placement is followed through both its probes.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { checkPlan, itemFor } from './items';
import type { Source } from './items';
import { ALL_SKILLS, parseSkill, skillId } from './skills';
import { CONTENT } from './content/index';
import { MASTERY_N, MASTERY_NEED, REVIEW_NEED } from './mastery';
import { VERIFY_N, VERIFY_NEED } from './misconceptions';
import { seeded } from './expr';
// @ts-ignore: plain JS
import { isCorrect, TOPIC, topicsFor } from '@/content/index.js';
// @ts-ignore: plain JS
import { manipSolution } from '@/content/manip.js';
// @ts-ignore: plain JS
import { probeItem, startLevel, nextProbe, PER_TOPIC, PROBE_LEN, KNOW } from '@/lib/placement.js';
// @ts-ignore: plain JS
import { JUMP_SOURCES, JUMP_MISTAKES } from '@/lib/lesson.js';

const LIMIT = 0.02;
const N = 500; // questions sampled per kind of question, to learn the guess and again to measure it

// a fixed random source (the exercise generators use Math.random), so the measure is the same on every run
const realRandom = Math.random;
beforeEach(() => { Math.random = seeded(20261110); });
afterEach(() => { Math.random = realRandom; });

type Item = any;
type Draw = () => Item;
/** What a guesser can tell apart without reading the question: its form and its source. */
const kindOf = (it: Item) => `${it.form}|${it.source ? `${it.topic}:${it.level}:${it.source === 'probe' || it.source === 'control' ? 'diag' : it.source}` : String(it.key).split(':')[0]}`;
const answerOf = (it: Item) => (it.form === 'manip' ? manipSolution(it) : it.answer);
const formOf = (it: Item) => (it.form === 'manip' ? `manip:${it.manip.kind}` : it.form);

/** The two guessing strategies, learned from a sample of a check's questions (all its sources together). */
function learnGuesses(samples: Item[]) {
  const byKind: Record<string, Record<string, { n: number; v: unknown }>> = {};
  const byForm: Record<string, Record<string, { n: number; v: unknown }>> = {};
  samples.forEach((it) => {
    const v = answerOf(it); const key = JSON.stringify(v);
    ((byKind[kindOf(it)] ||= {})[key] ||= { n: 0, v }).n += 1;
    ((byForm[formOf(it)] ||= {})[key] ||= { n: 0, v }).n += 1;
  });
  const mode = (m: Record<string, { n: number; v: unknown }>) => Object.values(m).sort((a, b) => b.n - a.n)[0].v;
  const common = Object.fromEntries(Object.entries(byKind).map(([k, m]) => [k, mode(m)]));
  // the best constant of a form: the answer right on the most questions of that form (answers seen are the candidates)
  const constant: Record<string, unknown> = {};
  Object.entries(byForm).forEach(([f, m]) => {
    const pool = samples.filter((it) => formOf(it) === f);
    let best: unknown = null; let bestN = -1;
    Object.values(m).sort((a, b) => b.n - a.n).slice(0, 40).forEach(({ v }) => {
      const n = pool.filter((it) => isCorrect(it, v)).length;
      if (n > bestN) { best = v; bestN = n; }
    });
    constant[f] = best;
  });
  return [(it: Item) => common[kindOf(it)], (it: Item) => constant[formOf(it)]];
}

/** The chance that a guess is right on a question from each draw. */
function chances(draws: Draw[], guess: (it: Item) => unknown) {
  return draws.map((d) => { let ok = 0; for (let i = 0; i < N; i += 1) { const it = d(); const g = guess(it); if (g !== undefined && isCorrect(it, g)) ok += 1; } return ok / N; });
}

/** P(at least `need` right) for independent questions with these chances. */
function atLeast(qs: number[], need: number) {
  let dist = [1];
  qs.forEach((q) => { const nd = Array(dist.length + 1).fill(0); dist.forEach((p, k) => { nd[k] += p * (1 - q); nd[k + 1] += p * q; }); dist = nd; });
  return dist.slice(need).reduce((a, b) => a + b, 0);
}

/** The best guessing strategy's pass rate for a check made of these draws. */
function passRate(draws: Draw[], need: number) {
  const train = draws.flatMap((d) => Array.from({ length: N }, d));
  return Math.max(...learnGuesses(train).map((g) => atLeast(chances(draws, g), need)));
}

const rnd = () => Math.random();
const drawOf = (skill: string, source: Source, candidates?: string[]): Draw => () => itemFor(skill, source, rnd, undefined, candidates, { test: true });
const planDraws = (purpose: 'mastery' | 'review', skill: string) => checkPlan({ purpose, skill }, rnd).map((q) => drawOf(q.skill, q.source));

describe('a check cannot be passed by guessing', () => {
  it.each(ALL_SKILLS)('%s: the mastery check, the review and the jump test', (skill) => {
    const { topic, level } = parseSkill(skill);
    const mastery = passRate(planDraws('mastery', skill), MASTERY_NEED);
    expect(mastery, `${skill} mastery: ${(100 * mastery).toFixed(2)}%`).toBeLessThan(LIMIT);
    const review = passRate(planDraws('review', skill), REVIEW_NEED);
    expect(review, `${skill} review: ${(100 * review).toFixed(2)}%`).toBeLessThan(LIMIT);
    const c = CONTENT[skill];
    const jump = passRate((JUMP_SOURCES as Source[]).map((src) => (src === 'gen' || !c ? drawOf(skill, 'gen') : drawOf(skill, src === 'transfer' && !c.transfer ? 'diag' : src))), JUMP_SOURCES.length - JUMP_MISTAKES);
    expect(jump, `${topic}:${level} jump: ${(100 * jump).toFixed(2)}%`).toBeLessThan(LIMIT);
    expect(MASTERY_N).toBe(5);
  });

  const miscs = Object.values(CONTENT).flatMap((c) => [...new Set([...Object.keys(c.diag.bugs), ...Object.keys(c.transfer?.bugs || {})])].map((m) => [c.skill, m] as const));
  it.each(miscs)('%s: the verification after repairing %s', (skill, misc) => {
    const plan = checkPlan({ purpose: 'verify', skill, misc }, rnd);
    expect(plan).toHaveLength(VERIFY_N);
    const rate = passRate(plan.map((q) => drawOf(q.skill, q.source, q.candidates)), VERIFY_NEED);
    expect(rate, `${skill} verify ${misc}: ${(100 * rate).toFixed(2)}%`).toBeLessThan(LIMIT);
  });
});

describe('the placement test cannot be passed by guessing', () => {
  const topics = [...topicsFor('7'), ...topicsFor('8')] as { id: string; levels: unknown[] }[];
  it.each(topics.map((t) => t.id))('%s: a guesser is placed on or above any stair less than 2% of the time', (topic) => {
    const top = TOPIC[topic].levels.length;
    // the chance of passing a probe at each level: all PROBE_LEN questions right
    const pass = Array.from({ length: top }, (_, i) => {
      const draws = Array.from({ length: PROBE_LEN }, (_, k): Draw => () => probeItem(topic, i + 1, k));
      return passRate(draws, PROBE_LEN);
    });
    // follow the search exactly, from every starting point the onboarding offers
    KNOW.forEach((_k: unknown, know: number) => {
      const placed: Record<number, number> = {};
      const walk = (lo: number, hi: number, asked: number, L: number, pr: number) => {
        for (const ok of [true, false]) {
          const p = pr * (ok ? pass[L - 1] : 1 - pass[L - 1]);
          if (!p) continue;
          const n = ok ? { lo: Math.max(lo, L), hi, asked: asked + 1 } : { lo, hi: Math.min(hi, L), asked: asked + 1 };
          const nx = nextProbe(n);
          if (nx == null) placed[n.lo] = (placed[n.lo] || 0) + p; else walk(n.lo, n.hi, n.asked, nx, p);
        }
      };
      walk(0, top + 1, 0, startLevel(top, know), 1);
      for (let L = 1; L <= top; L += 1) {
        const p = Object.entries(placed).filter(([lv]) => Number(lv) >= L).reduce((a, [, x]) => a + x, 0);
        expect(p, `${topic} (onboarding answer ${know}): placed on stair ${L} or above ${(100 * p).toFixed(2)}%`).toBeLessThan(LIMIT);
      }
    });
    expect(PER_TOPIC).toBe(2);
  });
});

describe('the guessing measure itself', () => {
  it('sees the old pyth:5 hole: always typing 5 when the answers are 5 or 10', () => {
    // a check of five questions whose answers are 5 three times out of four: the measure must catch it
    const old: Draw = () => ({ form: 'num', answer: Math.random() < 0.75 ? 5 : 10, key: 'old:x' });
    expect(passRate([old, old, old, old, old], 4)).toBeGreaterThan(0.5);
    expect(skillId('pyth', 5)).toBe('pyth:5');
  });
});
