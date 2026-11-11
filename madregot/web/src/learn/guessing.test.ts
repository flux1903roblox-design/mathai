// Can a check be passed by guessing? For every check (mastery, review, jump test, the verification after a repair)
// and every placement level, a student who answers without thinking must pass under 2% of the time.
//
// Eight guessing strategies, the best one counts:
//  - most common answer: for each kind of question (its form and where it comes from), the answer that question
//    has most often, learned from a sample of the same check's questions;
//  - best constant: one fixed answer per form (number, choice, point, line, object), the one right most often;
//  - a number from the question: one of the numbers printed in it (its text, its expression, its table), picked at
//    random, or always the first one, or always the last one; for an answer of two numbers (a point, a line, an
//    expression's coefficient and constant), two of them: a pair at random, the first two, or the last two. Not yet the number inside a drawing: an angle check can
//    still be passed by copying the angle drawn (angles:2 about 31%, angles:4 about 47%, from a run with drawings in),
//    because its questions are one step, equal or adding to 180°. That needs the angle checks to mix in other kinds of
//    questions, and is left for that change.
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
import { isCorrect, TOPIC, topicsFor, figPlain, fairForCheck } from '@/content/index.js';
// @ts-ignore: plain JS
import { manipSolution } from '@/content/manip.js';
// @ts-ignore: plain JS
import { toFrac, choiceWidth } from '@/content/util.js';
// @ts-ignore: plain JS
import { probeItem, startLevel, nextProbe, PER_TOPIC, PROBE_LEN, KNOW } from '@/lib/placement.js';
// @ts-ignore: plain JS
import { JUMP_SOURCES, JUMP_MISTAKES } from '@/lib/lesson.js';

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

/** The numbers a typed question prints: in its text, its expression and its table, in reading order. */
export function shownNumbers(it: Item): number[] {
  if (it.form !== 'num') return [];
  return printed(it);
}
/** Every number printed in a question, whatever its form. */
function printed(it: Item): number[] {
  const shown = [it.text, it.display, it.fig?.type === 'table' ? figPlain(it.fig) : ''].filter(Boolean).join(' ')
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
  const fromQuestion = SHOWN.map((c) => atLeast(samples.map((xs) => xs.reduce((a, it) => a + c(it), 0) / N), need));
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

// PRODUCT2-8: guessing by how the choices look. A student who does not read the maths can still pick the longest
// choice (as written, and as wide on screen), the shortest, the middle number, or the choice in the same place every
// time. On every choice question a check can ask, no such look may pick the right choice more often than a blind
// guess (one in three for three choices, one in four for four), within the measure's noise; and a mastery check stays
// under 2% for a guesser who answers its choice questions by look and its typed questions by the best guess above.
/** A choice as written, and its number when it is one (−12, 3.5, \frac{3}{4}). */
const shownOf = (c: { tex?: string; text?: string }) => String(c.tex ?? c.text);
function valueOf(c: { tex?: string; text?: string }) {
  const s = shownOf(c).replace(/−/g, '-').replace(/\\[,;! ]|\s+/g, '');
  const f = s.match(/^(-?)\\frac\{(\d+)\}\{(\d+)\}$/);
  return f ? (f[1] ? -1 : 1) * Number(f[2]) / Number(f[3]) : s === '' ? NaN : Number(s);
}
const allTies = (xs: number[], m: number) => xs.map((x, j) => (x === m ? j : -1)).filter((j) => j >= 0);
const most = (f: (c: Item) => number, pickMax: boolean) => (it: Item) => { const L = it.choices.map(f); return allTies(L, pickMax ? Math.max(...L) : Math.min(...L)); };
/** Each look names the choices it would pick (a guesser picks one of them at random); none: it cannot be used here. */
const LOOKS: Record<string, (it: Item) => number[]> = {
  longest: most((c) => shownOf(c).length, true),
  shortest: most((c) => shownOf(c).length, false),
  widest: most(choiceWidth, true),
  narrowest: most(choiceWidth, false),
  // the middle number (of an even count, either of the middle two)
  'middle value': (it) => {
    const v: number[] = it.choices.map(valueOf); if (v.some((x) => !Number.isFinite(x))) return [];
    const s = [...v].sort((a, b) => a - b); const k = s.length; const mids = k % 2 ? [s[(k - 1) / 2]] : [s[k / 2 - 1], s[k / 2]];
    return v.map((x, j) => (mids.includes(x) ? j : -1)).filter((j) => j >= 0);
  },
  ...Object.fromEntries([0, 1, 2, 3, 4].map((p) => [`always place ${p + 1}`, (it: Item) => (p < it.choices.length ? [p] : [])])),
};
/** The chance a look picks the right choice of this question; a look that names nothing here is a blind guess. */
function lookChance(it: Item, look: string) {
  const named = LOOKS[look](it); const pool = named.length ? named : it.choices.map((_: unknown, j: number) => j);
  return pool.filter((j: number) => isCorrect(it, j)).length / pool.length;
}
/**
 * Tells known and left for another change, each with its reason. A kind of question not listed here may not have one.
 * - ex1m (3x at x = −4: −12, 12, −1): the right product of a negative is the widest of its readings, and the right
 *   one is the middle number whenever x ≥ 2. Both follow from which readings are offered, which FOLLOWUP-36 redesigns.
 * - ex2w, ex5e, eq1w and lf2 were not in the council's list (PRODUCT2-8 names sn2, sy1e, lf2p, sy3m, sy5g and ex1m).
 * - eq5p is a tell only on screen, where a fraction is narrow: the right equation, with every part, is the widest.
 */
const KNOWN_TELLS = new Set([
  'expr:1 ex1m|longest', 'expr:1 ex1m|widest', 'expr:1 ex1m|middle value',
  'expr:2 ex2w|shortest', 'expr:2 ex2w|narrowest', 'expr:5 ex5e|longest', 'expr:5 ex5e|widest',
  'eq:1 eq1w|middle value', 'eq:1 eq1w|shortest', 'eq:1 eq1w|narrowest',
  'line:2 lf2|shortest', 'line:2 lf2|narrowest', 'line:2 lf2|always place 1', 'eq:5 eq5p|widest',
]);

describe('a check cannot be passed by how its choices look', () => {
  // every kind of choice question a check can ask (its stair and its key's prefix), from every source a check draws
  const LOOK_N = 3000; // questions per stair and source; a kind is measured once it has 150
  const kinds: Record<string, { blind: number; n: number; right: Record<string, number> }> = {};
  it('no look picks the right choice of a check\'s choice question more often than a blind guess', () => {
    for (const skill of ALL_SKILLS) {
      for (const source of ['gen', 'diag', 'transfer'] as Source[]) {
        for (let i = 0; i < LOOK_N; i += 1) {
          const it = itemFor(skill, source, rnd, undefined, undefined, { test: true });
          if (it.form !== 'mc' || !fairForCheck(it)) continue;
          const r = (kinds[`${skill} ${String(it.key).split(':')[0]}`] ||= { blind: 0, n: 0, right: {} });
          r.n += 1; r.blind += 1 / it.choices.length; // a kind can mix three and four choices
          Object.keys(LOOKS).forEach((look) => { r.right[look] = (r.right[look] || 0) + lookChance(it, look); });
        }
      }
    }
    expect(Object.keys(kinds).length).toBeGreaterThan(10);
    const tells: string[] = [];
    Object.entries(kinds).filter(([, r]) => r.n >= 150).forEach(([kind, r]) => {
      // a blind guess, and the noise of a sample of n (four standard errors, at least 4 points)
      const blind = r.blind / r.n; const noise = Math.max(0.04, 4 * Math.sqrt(blind * (1 - blind) / r.n));
      Object.entries(r.right).forEach(([look, ok]) => {
        if (ok / r.n >= blind + noise && !KNOWN_TELLS.has(`${kind}|${look}`)) tells.push(`${kind}: "${look}" is right ${(100 * ok / r.n).toFixed(1)}% of ${r.n} (a blind guess ${(100 * blind).toFixed(0)}%)`);
      });
    });
    expect(tells).toEqual([]);
    // the kinds PRODUCT2-8 fixed are measured, and fair to every look
    ['signed:2 sn2', 'sys:1 sy1e', 'line:2 lf2p', 'sys:3 sy3m', 'sys:5 sy5g'].forEach((k) => expect(kinds[k]?.n, k).toBeGreaterThanOrEqual(150));
  }, 4 * SLOW);
  it.each(ALL_SKILLS)('%s: the mastery check, answered by look and the best typed guess', (skill) => {
    const draws = planDraws('mastery', skill);
    const samples = draws.map((d) => Array.from({ length: N }, d));
    // each typed strategy's chance on each question: the learned guesses (right or wrong) and the numbers shown
    const typed: ((it: Item) => number)[] = [...learnGuesses(samples.flat()).map((g) => (it: Item) => { const v = g(it); return v !== undefined && isCorrect(it, v) ? 1 : 0; }), ...SHOWN];
    let best = 0;
    Object.keys(LOOKS).forEach((look) => typed.forEach((t) => {
      const per = samples.map((xs) => xs.reduce((a, it) => a + (it.form === 'mc' ? lookChance(it, look) : t(it)), 0) / N);
      best = Math.max(best, atLeast(per, MASTERY_NEED));
    }));
    expect(best, `${skill} mastery by look: ${(100 * best).toFixed(2)}%`).toBeLessThan(LIMIT);
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
