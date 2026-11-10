// Seeds for exercises the tutor rewrites (ai spec AI-4 Design 1, Tests "seeds"): every one of the 48 stairs gives
// distinct exercises with one number for an answer, as the generate request carries them, and the server's checks
// (shared/verify.js) can read and verify every one of them. No model, no network.
import { describe, it, expect } from 'vitest';
import { seedsFor, seedPayload, seedRounds, SEED_DRAWS } from './seeds.js';
import { itemPlain, answerText, isCorrect } from '@/content/index.js';
import { itemFor } from '@/learn/items.ts';
import { ALL_SKILLS } from '@/learn/skills.ts';
import { seeded } from '@/learn/expr.ts';
import { numbersIn, parseAnswer, verifyRewrite, finishRewrite, checkEquations } from '@shared/verify.js';

const N = 7; // count + 2 for five exercises, as the request asks
const BY_SKILL = Object.fromEntries(ALL_SKILLS.map((skill) => [skill, seedsFor(skill, N, seeded(1))]));

describe('seedsFor, over every stair', () => {
  it('covers all 48 stairs, the algebra ones included', () => {
    expect(ALL_SKILLS.length).toBe(48);
    for (const t of ['expr', 'eq', 'sys']) expect(ALL_SKILLS.filter((s) => s.startsWith(`${t}:`)).length).toBe(5);
  });

  // one test over the 48 stairs (not 48 tests): the messages name the stair
  it('every stair: seven distinct exercises, each one number, readable, with the full item kept', () => {
    for (const skill of ALL_SKILLS) everyStair(skill);
  });
  function everyStair(skill) {
    const seeds = BY_SKILL[skill];
    expect(seeds.length, skill).toBe(N);
    expect(new Set(seeds.map((s) => s.key)).size, skill).toBe(N);
    for (const s of seeds) {
      expect(s.form, skill).toBe('num');
      expect(Number.isFinite(s.answer), skill).toBe(true);
      const text = itemPlain(s);
      expect(text, skill).not.toMatch(/undefined|NaN|\[object/);
      expect(text.length).toBeGreaterThan(3);
      // what stays on the device: the app grades and diagnoses with it, never the AI
      expect(isCorrect(s, s.answer)).toBe(true);
      expect(typeof s.diag).toBe('function');
      expect(typeof s.diagnosis).toBe('function');
      expect(Array.isArray(s.solution) && s.solution.length > 0).toBe(true);
      expect(typeof s.hint).toBe('string');
      expect(s.topic && s.level).toBeTruthy();
    }
  }

  it('is reproducible from its random source', () => {
    for (const skill of ['signed:1', 'eq:3', 'pyth:2', 'sys:5']) {
      expect(seedsFor(skill, N, seeded(5)).map((s) => s.key)).toEqual(seedsFor(skill, N, seeded(5)).map((s) => s.key));
    }
  });

  it('prefers an exercise without a drawing: a drawn seed only where the stair\'s models always draw', () => {
    let drawnStairs = 0;
    for (const skill of ALL_SKILLS) {
      if (!BY_SKILL[skill].some((s) => s.fig)) continue;
      drawnStairs += 1;
      const rnd = seeded(99);
      const plain = Array.from({ length: SEED_DRAWS }, (_, i) => itemFor(skill, i % 2 ? 'transfer' : 'diag', rnd)).filter((it) => it.form === 'num' && !it.fig);
      // a stair with a drawn seed has (almost) no exercise without one: never a drawn seed by choice
      expect(plain.length, skill).toBeLessThan(3);
    }
    expect(drawnStairs).toBeGreaterThan(0);
  });
});

describe('seedPayload: what the generate request carries, and what the server can check', () => {
  it('carries only the index, the exercise as text, its answer as text and the two flags', () => {
    const seeds = BY_SKILL['signed:1'];
    const payload = seedPayload(seeds);
    expect(payload.map((p) => p.i)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    for (const [k, p] of payload.entries()) {
      expect(Object.keys(p).sort()).toEqual(['answer', 'fig', 'i', 'round', 'text']);
      expect(p.text).toBe(itemPlain(seeds[k]));
      expect(p.answer).toBe(answerText(seeds[k]));
      expect(p.fig).toBe(!!seeds[k].fig);
      expect(p.text).not.toMatch(/[$⁦⁩]/);
    }
    expect(seedRounds({ text: 'מה אורך היתר? עגלו לעשירית.' })).toBe(true);
    expect(seedRounds({ text: 'חשבו: 3 - (-5)' })).toBe(false);
  });

  it('every stair: the server reads every seed\'s answer, and a faithful rewrite passes while a changed number does not', () => {
    for (const skill of ALL_SKILLS) serverReads(skill);
  });
  function serverReads(skill) {
    const seeds = BY_SKILL[skill];
    const payload = seedPayload(seeds);
    const items = payload.map((p) => ({
      seed: p.i,
      // a seed with a drawing keeps its wording; any other may too ("could not be put in a story")
      prompt: p.text,
      hint: '',
      solution: [`התשובה: $= ${p.answer}$`],
      kept: p.fig,
    }));
    for (const [k, p] of payload.entries()) {
      const read = parseAnswer(p.answer);
      expect(typeof read, `${skill} ${p.answer}`).toBe('number');
      expect(Math.abs(read - seeds[k].answer), `${skill} ${p.answer}`).toBeLessThanOrEqual(p.round ? 0.05 : 0.01);
      // the app's own worked solution of the seed is true, equation by equation
      expect(checkEquations(seeds[k].solution.join('\n')).ok, `${skill}: ${seeds[k].solution.join(' | ')}`).toBe(true);
      const r = verifyRewrite(p, items[k], p.fig ? undefined : p.answer);
      expect(r.ok, `${skill} seed ${k}: ${r.reason} — ${p.text} → ${p.answer}`).toBe(true);
    }
    const done = finishRewrite(payload, { items }, { answers: payload.map((p) => ({ seed: p.i, answer: p.answer })) });
    expect(done.items.length, skill).toBe(N);
    expect(Object.values(done.dropped).every((x) => x === 0), skill).toBe(true);
    // a story that changes one number of a seed is dropped, whatever else it gets right: a whole number written once
    for (const p of payload.filter((x) => !x.fig)) {
      const nums = numbersIn(p.text).map(Math.abs);
      const once = nums.find((x) => Number.isInteger(x) && x >= 1 && nums.filter((y) => y === x).length === 1
        && (p.text.match(new RegExp(`(^|[^\\d.,])${x}(?![\\d.,]\\d)`, 'g')) || []).length === 1);
      if (once == null) continue;
      const changed = p.text.replace(new RegExp(`(^|[^\\d.,])${once}(?![\\d.,]\\d)`), `$1${once + 1000}`);
      const r = verifyRewrite(p, { ...items[p.i], prompt: changed, kept: false }, p.answer);
      expect(r.reason, `${skill}: ${changed}`).toBe('numbers');
    }
  }

  it('every seed states numbers the server checks, except "which quadrant is (a, b) in" exercises, which have none', () => {
    const none = ALL_SKILLS.flatMap((skill) => seedPayload(BY_SKILL[skill]).filter((p) => numbersIn(p.text).length === 0).map((p) => `${skill}: ${p.text}`));
    for (const x of none) expect(x).toMatch(/^coord:2: .*רביע/);
  });
});
