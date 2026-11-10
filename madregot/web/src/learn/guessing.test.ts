// A guesser who does no maths must not pass a check that grants something: a mastery check, a review, a jump test,
// the verification after a repair, or a level of the placement test. Every guessing strategy below passes each of
// them less than MAX_PASS of the time.
//
// The guesser sees what the student sees: the question's text, its display expression and its drawing. A drawing's
// numbers (an angle, a side, a point, a table) are read through figPlain, the same words the tutor gets, so a number
// printed only in the figure counts like one in the text.
//
// The checks run through the real lesson engine (src/lib/lesson.js) with a seeded random source, so every run is the
// same each time; a run's pass chance is computed exactly from the guesser's chance on each of its questions.
//
// Covered: the angle stairs. A placement level is measured as a probe of three questions of the stair, one from each
// source (an exercise, a diagnostic question, a transfer question), all right: a level settled by one exercise alone
// cannot stay under MAX_PASS while the plain one-step questions (the opposite angle, a corresponding angle) are kept
// in practice.
import { describe, it, expect, afterAll } from 'vitest';
// @ts-ignore: plain JS
import * as lessonJs from '@/lib/lesson.js';
// @ts-ignore: plain JS
import { isCorrect, figPlain } from '@/content/index.js';
import { seeded } from './expr';
import { ALL_SKILLS, parseSkill } from './skills';
import { contentOf } from './content/index';
import { itemFor } from './items';

const { startLesson, answer, next, JUMP_LEN, JUMP_MISTAKES } = lessonJs as any;

const MAX_PASS = 0.02;
const RUNS = 1500;
const COVERED = ALL_SKILLS.filter((s) => parseSkill(s).topic === 'angles');

// ------------------------------------------------------------------ what the guesser sees and types

/** Every number printed in the question: its text, its display expression and its drawing. */
function shownNumbers(it: any): number[] {
  const seen = [it.text, it.display, figPlain(it.fig)].filter(Boolean).join(' ');
  return [...seen.matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));
}

/**
 * The strategies: type a number printed in the question (a random one, the first, the last, the largest), or 0.
 * On a stair where "always complete to 180°" is a known misconception (supp-not-equal), also 180° minus a printed
 * number: a student who has it must not pass either.
 */
type Strategy = 'random' | 'first' | 'last' | 'largest' | 'zero' | 'supplement';
const BASE: Strategy[] = ['random', 'first', 'last', 'largest', 'zero'];
const strategiesOf = (skill: string): Strategy[] => {
  const c = contentOf(skill);
  return c?.misconceptions.some((m) => m.id === 'supp-not-equal') ? [...BASE, 'supplement'] : BASE;
};

/** The guesser's possible answers to one question under a strategy, each with its chance. */
function guesses(it: any, how: Strategy): { u: unknown; w: number }[] {
  const xs = shownNumbers(it);
  const each = (f: (x: number) => number) => xs.map((x) => ({ u: f(x), w: 1 / xs.length }));
  const one = (): { u: number; w: number }[] => {
    if (how === 'zero' || !xs.length) return [{ u: 0, w: 1 }];
    if (how === 'first') return [{ u: xs[0], w: 1 }];
    if (how === 'last') return [{ u: xs[xs.length - 1], w: 1 }];
    if (how === 'largest') return [{ u: Math.max(...xs), w: 1 }];
    return how === 'supplement' ? each((x) => 180 - x) : each((x) => x);
  };
  const two = (): { u: [number, number]; w: number }[] => {
    if (how === 'zero' || xs.length < 2) return [{ u: [xs[0] ?? 0, xs[0] ?? 0], w: 1 }];
    if (how === 'first') return [{ u: [xs[0], xs[1]], w: 1 }];
    if (how === 'last') return [{ u: [xs[xs.length - 2], xs[xs.length - 1]], w: 1 }];
    const ys = [...xs].sort((a, b) => b - a);
    if (how === 'largest') return [{ u: [ys[0], ys[1]], w: 1 }];
    return xs.flatMap((a) => xs.map((b) => ({ u: [a, b] as [number, number], w: 1 / xs.length ** 2 })));
  };
  switch (it.form) {
    case 'mc': {
      const n = it.choices.length;
      if (how === 'random' || how === 'supplement') return it.choices.map((_: unknown, i: number) => ({ u: i, w: 1 / n }));
      return [{ u: how === 'last' || how === 'largest' ? n - 1 : 0, w: 1 }];
    }
    case 'pt': return two();
    case 'line': return two().map(({ u: [m, b], w }) => ({ u: { m, b }, w }));
    case 'manip': {
      const k = it.manip.kind;
      if (k === 'angle' || k === 'numberline' || k === 'bars') return one();
      if (k === 'plot') return two();
      return [{ u: it.manip.start ?? null, w: 1 }]; // nothing to type: the object is left where it started
    }
    default: return one();
  }
}

/** The chance that the guesser answers right, and that a wrong answer shows the misconception `misc`. */
function chances(it: any, how: Strategy, misc?: string) {
  let right = 0; let showed = 0;
  for (const { u, w } of guesses(it, how)) {
    if (isCorrect(it, u)) right += w;
    else if (misc && it.diagnosis) {
      const d = it.diagnosis(u);
      if (d.kind === 'misconception' && d.candidates.some((c: { id: string }) => c.id === misc)) showed += w;
    }
  }
  return { right, showed };
}

/** The chance of at least `need` right answers to independent questions with these chances. */
function atLeast(ps: number[], need: number) {
  let dist = [1];
  for (const p of ps) {
    const nd = new Array(dist.length + 1).fill(0);
    dist.forEach((v, k) => { nd[k] += v * (1 - p); nd[k + 1] += v * p; });
    dist = nd;
  }
  return dist.slice(need).reduce((a, b) => a + b, 0);
}

// ------------------------------------------------------------------ running the real checks

const withSeed = <T>(seed: number, f: () => T): T => {
  const real = Math.random; Math.random = seeded(seed);
  try { return f(); } finally { Math.random = real; }
};

/** The questions of one run of a check, as the engine asks them (answered right, so the run goes to its end). */
function questionsOf(opts: any): any[] {
  let s = startLesson(opts); const out: any[] = [];
  for (let i = 0; i < 20 && s && !s.finished; i += 1) { out.push(s.item); s = next(answer(s, s.item.answer).s); }
  return out;
}

type Kind = 'mastery' | 'review' | 'jump' | 'probe' | `verify:${string}`;

/** The questions of one run of a check of this kind. */
function runOf(skill: string, kind: Kind): any[] {
  const { topic, level } = parseSkill(skill);
  if (kind === 'jump') return questionsOf({ kind: 'jump', topic, level });
  if (kind === 'probe') return (['gen', 'diag', 'transfer'] as const).map((src) => itemFor(skill, src, Math.random));
  const misc = kind.startsWith('verify:') ? kind.slice(7) : undefined;
  return questionsOf({ kind: 'check', purpose: misc ? 'verify' : kind, skill, misc });
}

/** The chance a guesser passes one run, given its questions. */
function passOf(kind: Kind, qs: any[], how: Strategy): number {
  const misc = kind.startsWith('verify:') ? kind.slice(7) : undefined;
  const c = qs.map((q) => chances(q, how, misc));
  const ps = c.map((x) => x.right);
  if (kind === 'mastery') return atLeast(ps, qs.length - 1); // 4 of 5 (mastery.ts)
  if (kind === 'jump') return atLeast(ps, JUMP_LEN - JUMP_MISTAKES);
  if (kind === 'review' || kind === 'probe') return atLeast(ps, qs.length);
  // the verification: at least two right, and the misconception never shows again (misconceptions.ts)
  const clean = c.map((x) => (x.showed < 1 ? x.right / (1 - x.showed) : 0));
  return c.reduce((a, x) => a * (1 - x.showed), 1) * atLeast(clean, 2);
}

/** The share of runs each strategy passes. */
function passRate(skill: string, kind: Kind, seed: number) {
  const hows = strategiesOf(skill);
  const total = Object.fromEntries(hows.map((h) => [h, 0])) as Record<Strategy, number>;
  withSeed(seed, () => {
    for (let r = 0; r < RUNS; r += 1) {
      const qs = runOf(skill, kind);
      hows.forEach((h) => { total[h] += passOf(kind, qs, h) / RUNS; });
    }
  });
  return total;
}

const report: string[] = [];
afterAll(() => { if ((globalThis as any).process?.env?.GUESS_REPORT) console.log(report.join('\n')); });

describe('a guesser does not pass a check', () => {
  it('reads the numbers of a drawing too', () => {
    const it0: any = withSeed(3, () => itemFor('angles:4', 'gen', Math.random));
    expect(it0.fig).toBeTruthy();
    expect(shownNumbers({ text: 'מה גודל הזווית המסומנת?', fig: { type: 'cross', a: 40, target: 'vertical' } })).toEqual([40]);
  });

  it.each(COVERED)('%s', (skill) => {
    const c = contentOf(skill)!;
    const misc = [...new Set([...Object.keys(c.diag.bugs), ...Object.keys(c.transfer?.bugs || {})])];
    const kinds: Kind[] = ['mastery', 'review', 'jump', 'probe', ...misc.map((m) => `verify:${m}` as Kind)];
    const bad: string[] = [];
    kinds.forEach((kind, i) => {
      const rate = passRate(skill, kind, 1000 * ALL_SKILLS.indexOf(skill) + i);
      const hows = Object.keys(rate) as Strategy[];
      report.push(`${skill.padEnd(9)} ${kind.padEnd(28)} ${hows.map((h) => `${h} ${(100 * rate[h]).toFixed(2).padStart(6)}%`).join('  ')}`);
      hows.forEach((h) => { if (rate[h] >= MAX_PASS) bad.push(`${kind} by "${h}": ${(100 * rate[h]).toFixed(1)}%`); });
    });
    expect(bad, `${skill}: a guesser passes`).toEqual([]);
  });
});
