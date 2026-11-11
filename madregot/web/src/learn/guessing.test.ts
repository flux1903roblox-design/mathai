// Can a check be passed by guessing? For every check (mastery, review, jump test, the verification after a repair)
// and every placement level, a student who answers without thinking must pass under 2% of the time.
//
// Eight guessing strategies, the best one counts:
//  - most common answer: for each kind of question (its form and where it comes from), the answer that question
//    has most often, learned from a sample of the same check's questions;
//  - best constant: one fixed answer per form (number, choice, point, line, object), the one right most often;
//  - a number from the question: one of the numbers printed in it (its text, its expression, its drawing in words,
//    content/index.js figPlain, and the numbers an object draws: a number line's start, the bars and their target, the
//    angle tool's goal), picked at random, or always the first one, or always the last one; for an answer of two
//    numbers (a point, a line, an expression's coefficient and constant), two of them: a pair at random, the first two,
//    or the last two. An object whose answer is one number (a number line, the angle tool, a bar) is set to it;
//  - for a question in degrees (CURRICULUM-10), 180° minus a printed number, 90° minus one, and 360° minus one, each
//    at random, the first or the last: what a student who copies the angle drawn, or completes it to a straight
//    line, a right angle or a full turn, types without reading which angle is asked.
// Each question's chance is measured on a fresh sample; a check's pass rate is then exact (its questions are drawn
// independently): mastery and jump tests need 4 of 5, a review 3 of 3, a verification 3 of 3; a placement probe needs
// all three of its questions, and a topic's placement is followed through both its probes.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { checkPlan, itemFor } from './items';
import type { Source } from './items';
import { ALL_SKILLS, parseSkill, skillId } from './skills';
import { loadAllContent } from './content/index';
import { MASTERY_N, MASTERY_NEED, REVIEW_NEED } from './mastery';
import { VERIFY_N, VERIFY_NEED } from './misconceptions';
import { seeded } from './expr';
// @ts-ignore: plain JS
import { isCorrect, TOPIC, topicsFor, figPlain } from '@/content/index.js';
// @ts-ignore: plain JS
import { manipSolution } from '@/content/manip.js';
// @ts-ignore: plain JS
import { toFrac } from '@/content/util.js';
// @ts-ignore: plain JS
import { probeItem, startLevel, nextProbe, PER_TOPIC, PROBE_LEN, KNOW } from '@/lib/placement.js';
// @ts-ignore: plain JS
import { JUMP_SOURCES, JUMP_MISTAKES } from '@/lib/lesson.js';
// @ts-ignore: plain JS
import { chainItem, absItem, oppItem, nestedItem, drawNested, nestedTex, nestedValue } from '@/content/signedItems.js';
// @ts-ignore: plain JS
import { powItem } from '@/content/signed7.js';
// @ts-ignore: plain JS
import { bracketZero, bracketFrom } from '@/content/eq.js';
// @ts-ignore: plain JS
import { collectItem, bracketCollect } from '@/content/expr.js';
// @ts-ignore: plain JS
import { rectStory, transferTable, angleEqStory } from '@/content/eq.js';

// the teaching content loads one topic at a time (DURABLE-11): these tests run on all of it, loaded
const CONTENT = await loadAllContent();

const LIMIT = 0.02;
const SLOW = 60_000; // each test generates thousands of questions
const N = 500; // questions sampled per kind of question, to learn the guess and again to measure it

// a fixed random source (the exercise generators use Math.random), so the measure is the same on every run
const realRandom = Math.random;
beforeEach(() => { Math.random = seeded(20261110); });
afterEach(() => { Math.random = realRandom; });

type Item = any;
type Draw = () => Item;
/** What a guesser can tell apart without reading the question: its form and its source. */
const kindOf = (it: Item) => `${it.form}|${it.source ? `${it.topic}:${it.level}:${it.source === 'probe' || it.source === 'control' ? 'diag' : it.source}` : String(it.key).split(':')[0]}`;
// a fraction answer is typed as its numerator and denominator (in lowest terms, which every fraction item accepts)
const answerOf = (it: Item) => (it.form === 'manip' ? manipSolution(it) : it.form === 'frac' ? toFrac(it.answer) : it.answer);
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

/** The objects whose answer is one number a guesser can set them to: a point on a number line, a ray's angle, a bar. */
const ONE_NUMBER = new Set(['numberline', 'angle', 'bars', 'dline']);
const oneNumber = (it: Item) => it.form === 'num' || (it.form === 'manip' && ONE_NUMBER.has(it.manip?.kind) && typeof it.answer === 'number');
/** The numbers a typed question (or an object set to one number) prints: in its text, its expression, its drawing. */
export function shownNumbers(it: Item): number[] {
  if (!oneNumber(it)) return [];
  return printed(it);
}
/** The numbers an object draws as numbers: a number line's start, the bars and their target, the angle tool's goal. */
function drawnByObject(m: any): string {
  if (!m) return '';
  const nums = m.kind === 'numberline' ? [m.from, m.start] : m.kind === 'bars' ? [...(m.values || []), m.target ?? m.mean]
    : m.kind === 'angle' ? [m.target] : m.kind === 'pins' ? (m.labels || []).filter((l: unknown) => typeof l === 'number') : [];
  return nums.filter((v: unknown) => typeof v === 'number').join(' ');
}
/** Every number printed in a question, whatever its form: its text, its expression, its drawing in words, its object. */
const PRINTED = new WeakMap<object, number[]>();
function printed(it: Item): number[] {
  // read once per question: every guessing strategy asks for them
  if (it && typeof it === 'object' && PRINTED.has(it)) return PRINTED.get(it)!;
  const ns = readPrinted(it);
  if (it && typeof it === 'object') PRINTED.set(it, ns);
  return ns;
}
function readPrinted(it: Item): number[] {
  const shown = [it.text, it.display, it.fig ? figPlain(it.fig) : '', it.form === 'manip' ? drawnByObject(it.manip) : ''].filter(Boolean).join(' ')
    // a TeX thousands group is one number: 50{,}000 is 50000, not 50 and 0 (a scale's 1 : 50{,}000)
    .replace(/(\d)\{,\}(?=\d{3})/g, '$1')
    .replace(/\\(qquad|quad|[,;:! ])/g, ' ').replace(/\\[a-zA-Z]+/g, ' ').replace(/−/g, '-')
    .replace(/-\s+(?=\d)/g, '-'); // "3x - 4" reads b as -4
  return (shown.match(/-?\d+(\.\d+)?/g) || []).map(Number);
}
/**
 * An answer of two typed numbers (a point, an expression's coefficient and constant: 3(x + 4) read as 3 and 4, or a
 * fraction's numerator and denominator: "reduce 6/8" read as 6 and 8) guessed from two numbers printed in the question.
 */
const twoOf = (it: Item, a: number, b: number) => (it.form === 'pt' ? [a, b] : it.form === 'lin' ? { k: a, c: b } : it.form === 'line' ? { m: a, b } : it.form === 'frac' ? { n: a, d: b } : null);
const TWO = new Set(['pt', 'lin', 'line', 'frac']);
/** Guessing from the numbers in the question: the chance a guess is right on one question. */
const SHOWN: ((it: Item) => number)[] = [
  (it) => { const ns = shownNumbers(it); return ns.length ? ns.filter((v) => isCorrect(it, v)).length / ns.length : 0; }, // one at random
  (it) => { const ns = shownNumbers(it); return ns.length && isCorrect(it, ns[0]) ? 1 : 0; }, // the first
  (it) => { const ns = shownNumbers(it); return ns.length && isCorrect(it, ns[ns.length - 1]) ? 1 : 0; }, // the last
  // two numbers for a two-number answer: a pair at random, the first two, the last two
  (it) => { if (!TWO.has(it.form)) return 0; const ns = printed(it); if (!ns.length) return 0; let ok = 0; ns.forEach((a) => ns.forEach((b) => { if (isCorrect(it, twoOf(it, a, b))) ok += 1; })); return ok / (ns.length * ns.length); },
  (it) => { if (!TWO.has(it.form)) return 0; const ns = printed(it); return ns.length >= 2 && isCorrect(it, twoOf(it, ns[0], ns[1])) ? 1 : 0; },
  (it) => { if (!TWO.has(it.form)) return 0; const ns = printed(it); return ns.length >= 2 && isCorrect(it, twoOf(it, ns[ns.length - 2], ns[ns.length - 1])) ? 1 : 0; },
];
/**
 * For a question in degrees: 180° − n, 90° − n and 360° − n for a printed number n (at random, the first, the last).
 * Copying the angle drawn is the number strategy above.
 */
const DEG_GUESS: ((n: number) => number)[] = [(n) => 180 - n, (n) => 90 - n, (n) => 360 - n];
const inDegrees = (it: Item) => it.unit === 'מעלות';
export const DEGREES: ((it: Item) => number)[] = DEG_GUESS.flatMap((f) => [
  (it: Item) => { if (!inDegrees(it)) return 0; const ns = shownNumbers(it); return ns.length ? ns.filter((v) => isCorrect(it, f(v))).length / ns.length : 0; },
  (it: Item) => { if (!inDegrees(it)) return 0; const ns = shownNumbers(it); return ns.length && isCorrect(it, f(ns[0])) ? 1 : 0; },
  (it: Item) => { if (!inDegrees(it)) return 0; const ns = shownNumbers(it); return ns.length && isCorrect(it, f(ns[ns.length - 1])) ? 1 : 0; },
]);


/** P(at least `need` right) for independent questions with these chances. */
function atLeast(qs: number[], need: number) {
  let dist = [1];
  qs.forEach((q) => { const nd = Array(dist.length + 1).fill(0); dist.forEach((p, k) => { nd[k] += p * (1 - q); nd[k + 1] += p * q; }); dist = nd; });
  return dist.slice(need).reduce((a, b) => a + b, 0);
}

/** The best guessing strategy's pass rate for a check made of these draws. */
function passRate(draws: Draw[], need: number) {
  const samples = draws.map((d) => Array.from({ length: N }, d));
  // the numbers-from-the-question guesses learn nothing, so they are measured on the same sample
  const fromQuestion = [...SHOWN, ...DEGREES].map((c) => atLeast(samples.map((xs) => xs.reduce((a, it) => a + c(it), 0) / N), need));
  return Math.max(...learnGuesses(samples.flat()).map((g) => atLeast(chances(draws, g), need)), ...fromQuestion);
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
  }, SLOW);

  // every misconception a stair can confirm and repair: its models' and the ones only its exercises name
  const miscs = Object.values(CONTENT).flatMap((c) => [...new Set([...c.misconceptions.map((m) => m.id), ...Object.keys(c.diag.bugs), ...Object.keys(c.transfer?.bugs || {})])].map((m) => [c.skill, m] as const));
  it.each(miscs)('%s: the verification after repairing %s', (skill, misc) => {
    const plan = checkPlan({ purpose: 'verify', skill, misc }, rnd);
    expect(plan).toHaveLength(VERIFY_N);
    const rate = passRate(plan.map((q) => drawOf(q.skill, q.source, q.candidates)), VERIFY_NEED);
    expect(rate, `${skill} verify ${misc}: ${(100 * rate).toFixed(2)}%`).toBeLessThan(LIMIT);
  }, SLOW);
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
  }, SLOW);
});

// CLASSROOM-1 and -2: the class's new kinds alone, as the spec simulated them (the chain 3.8%, absItem 4.6%, oppItem 4.0%
// for the most common answer): never answered by a number printed in them, and no answer common enough to pass a check
describe('the class\'s signed kinds cannot be guessed', () => {
  // brackets inside brackets (CLASSROOM-4): a[b − (c − d)] and e − a[b − (c − d)·g] alone (spec 3.0%), e : [p + g(h − i)]
  // alone (spec 11.9%), and the mix the exercises draw
  const shape = (n: number) => (r: () => number) => { const q = drawNested(r, n); return { form: 'num', text: 'חשבו:', display: nestedTex(q), answer: nestedValue(q), key: `n${n}` }; };
  const twoShapes = (r: () => number) => shape(r() < 0.6 ? 1 : 2)(r);
  // powers (CLASSROOM-5): the checks' mix, F0-F5 in the exercises' shares (F6, a positive base, never reaches a check:
  // the spec gives 8.3%, measured 9.3% here, because the form is drawn first and keeps its share), and F5 alone (4.1%)
  const powCheck = (r: () => number) => { for (;;) { const it = powItem(r); if (!it.key.startsWith('sn7:6:')) return it; } };
  const powF5 = (r: () => number) => powItem(r, 5);
  it.each([['the chain of five', chainItem, 0.05], ['absolute value', absItem, 0.06], ['the opposite', oppItem, 0.055],
    ['brackets inside brackets, the first two shapes', twoShapes, 0.05], ['dividing by a bracket, alone', shape(3), 0.15], ['brackets inside brackets, as drawn', nestedItem, 0.05],
    ['powers, as the checks draw them', powCheck, 0.105], ['a fraction or a decimal to a power, alone', powF5, 0.05]] as const)('%s', (_name, make, most) => {
    const items = Array.from({ length: 4000 }, () => make(Math.random));
    const freq = new Map<number, number>();
    items.forEach((it) => freq.set(it.answer, (freq.get(it.answer) || 0) + 1));
    const common = Math.max(...freq.values()) / items.length;
    expect(common).toBeLessThan(most);
    expect(atLeast([common, common, common, common, common], 4)).toBeLessThan(LIMIT / 10);
    // a number copied from the question is never the answer
    items.forEach((it) => expect(shownNumbers(it).some((v) => isCorrect(it, v)), it.key).toBe(false));
  });
});

// CLASSROOM-7: the class's a(x + b) = cx (d = 0), drawn in a fifth of eq:4's a(x + b) = cx + d items. Its most common
// answer alone (spec 5.9%, P(4 of 5) = 5.8e-5; 6.2% and 6.9e-5 over all the draws the app allows: m from −6 to 6, so
// 5(x − 2) = 3x is a shape, and a printed answer, a first-term opening that gives the answer, or a slip are redrawn)
// never passes a check, and no printed number is it
describe('the class\'s equation shape cannot be guessed', () => {
  it('a(x + b) = cx alone', () => {
    const items = Array.from({ length: 6000 }, () => bracketFrom(bracketZero()));
    const freq = new Map<number, number>();
    items.forEach((it) => freq.set(it.answer, (freq.get(it.answer) || 0) + 1));
    const common = Math.max(...freq.values()) / items.length;
    expect(common).toBeLessThan(0.07);
    expect(atLeast([common, common, common, common, common], 4)).toBeLessThan(1e-4);
    items.forEach((it) => expect(shownNumbers(it).some((v) => isCorrect(it, v)), it.key).toBe(false));
    // the shape is the class's: nothing added on the right, and the answer whole
    items.forEach((it) => { expect(it.display, it.key).toMatch(/^\d\(x [+-] \d\) = \d*x$/); expect(Number.isInteger(it.answer)).toBe(true); });
  });
});

// CLASSROOM-6: collecting the class's way, 3 to 6 terms (spec: best constant pair 0.3%), and the bracketed x-terms (spec
// 0.8%; a third of them answer x or −x). The answer is a pair, and on expr:3 the swapped boxes count as right too, so
// the best constant is measured with isCorrect on the stair; copying two printed numbers into the boxes is measured too
describe('the class\'s collecting cannot be guessed', () => {
  const plain = (r: () => number) => { for (;;) { const it = collectItem(); if (!String(it.key).startsWith('ex3b:') && !it.practiceOnly) return it; } };
  it.each([['collecting, 3 to 6 terms', plain, 0.01], ['bracketed x-terms', () => bracketCollect(), 0.02]] as const)('%s', (_name, make, most) => {
    const items = Array.from({ length: 4000 }, () => ({ ...make(Math.random), topic: 'expr', level: 3 }));
    const pairs = new Map<string, { k: number; c: number }>();
    items.forEach((it) => pairs.set(`${it.answer.k},${it.answer.c}`, it.answer));
    let best = 0;
    [...pairs.values()].forEach((g) => { const n = items.filter((it) => isCorrect(it, g)).length; if (n > best) best = n; });
    const common = best / items.length;
    expect(common).toBeLessThan(most);
    expect(atLeast([common, common, common, common, common], 4)).toBeLessThan(LIMIT / 100);
    // two numbers copied from the question, in either box, are almost never the answer
    const copied = items.filter((it) => { const ns = (String(it.display).match(/-?\d+/g) || []).map(Number); return ns.some((a) => ns.some((b) => isCorrect(it, { k: a, c: b }))); }).length;
    expect(copied / items.length).toBeLessThan(0.05);
  }, SLOW);
});

// CLASSROOM-8: the class's word problems alone, as the spec simulated them (most common answer: the rectangle 5.6%, the
// transfer 6.3% and 5.3%, a triangle with x 11.3%, a quadrilateral with x 8.1%): no answer common enough to pass a check,
// no number copied from the question the answer, and for angles not 180 − n, 90 − n or 360 − n of one either
describe('the class\'s word problems cannot be guessed', () => {
  it.each([['the rectangle', () => rectStory(), 0.07, false], ['the transfer, form 1', () => transferTable(1), 0.08, false],
    ['the transfer, form 2', () => transferTable(2), 0.07, false], ['a triangle with x', () => angleEqStory(3), 0.13, true],
    ['a quadrilateral with x', () => angleEqStory(4), 0.1, true]] as const)('%s', (_name, make, most, deg) => {
    const items = Array.from({ length: 4000 }, () => make());
    const freq = new Map<number, number>();
    items.forEach((it) => freq.set(it.answer, (freq.get(it.answer) || 0) + 1));
    const common = Math.max(...freq.values()) / items.length;
    expect(common).toBeLessThan(most);
    expect(atLeast([common, common, common, common, common], 4)).toBeLessThan(LIMIT / 10);
    items.forEach((it) => {
      const shown = shownNumbers(it);
      const guesses = deg ? shown.flatMap((n) => [n, 180 - n, 90 - n, 360 - n]) : shown;
      expect(guesses.some((v) => isCorrect(it, v)), it.key).toBe(false);
    });
  }, SLOW);
});

describe('the guessing measure itself', () => {
  it('sees a guesser who types a number from the question: the old two-number comparison', () => {
    // "which is bigger? -8 or -10": typing either number shown is a coin flip, and three of them pass 1 in 8
    const pair: Draw = () => { const a = -2 - Math.floor(Math.random() * 9); const b = a - 1 - Math.floor(Math.random() * 5); return { form: 'num', text: 'איזה מספר גדול יותר? כתבו אותו.', display: `${b} \\qquad ${a}`, answer: a, key: 'pair:x' }; };
    expect(passRate([pair, pair, pair], 3)).toBeGreaterThan(0.1);
    expect(shownNumbers({ form: 'num', text: 'מה $y$ כש־$x = -3$?', display: 'y = 2x - 4', fig: { type: 'table', rows: [['א', '1, 10, 10']] } })).toEqual([-3, 2, -4, 1, 10, 10]);
  });
  it('reads a TeX thousands group as one number, so copying a printed number on a scale question is measured honestly', () => {
    // a scale question prints 1 : 50{,}000: the number a guesser would type is 50000, not 50 and 0
    expect(shownNumbers({ form: 'num', text: 'במפה בקנה מידה $1 : 50{,}000$ המרחק הוא $6$ ס״מ. מה המרחק במציאות, במטרים?' })).toEqual([1, 50000, 6]);
    expect(shownNumbers({ form: 'num', text: 'קוטר $12{,}500{,}000$ מטר', display: '1 : 250{,}000' })).toEqual([12500000, 1, 250000]);
    // a decimal comma or a list stays apart
    expect(shownNumbers({ form: 'num', text: 'המספרים $2, 3$ ו־$4$' })).toEqual([2, 3, 4]);
  });
  it('sees a guesser who copies two numbers into an expression\'s two boxes', () => {
    // "open the brackets: 3(x + 4)" answered as 3x + 4 is wrong; a question whose answer were always the numbers shown
    // (coefficient and constant as printed) would be passed by copying them
    const copy: Draw = () => { const k = 2 + Math.floor(Math.random() * 7); const c = 1 + Math.floor(Math.random() * 9); return { form: 'lin', text: 'כתבו בלי סוגריים:', display: `${k}x + ${c}`, answer: { k, c }, key: 'copy:x' }; };
    expect(passRate([copy, copy, copy, copy, copy], 4)).toBeGreaterThan(0.9);
  });
  it('sees the old pyth:5 hole: always typing 5 when the answers are 5 or 10', () => {
    // a check of five questions whose answers are 5 three times out of four: the measure must catch it
    const old: Draw = () => ({ form: 'num', answer: Math.random() < 0.75 ? 5 : 10, key: 'old:x' });
    expect(passRate([old, old, old, old, old], 4)).toBeGreaterThan(0.5);
    expect(skillId('pyth', 5)).toBe('pyth:5');
  });
});
