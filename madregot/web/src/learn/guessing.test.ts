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
//    or the last two. An object whose answer is one number (a number line, the angle tool, a bar) is set to it. Every
//    drawing is read (CURRICULUM-10): a table, a situation graph, a protractor and a clock (stage 5 §0.4 decision 5:
//    every number their words write) as before, and now the angle drawings, the charts and the rest;
//  - for a question in degrees (CURRICULUM-10), 180° minus a printed number, 90° minus one, and 360° minus one, each
//    at random, the first or the last: what a student who copies the angle drawn, or completes it to a straight
//    line, a right angle or a full turn, types without reading which angle is asked.
// And two arithmetic shortcuts, only in the topics where they are a tool and not the skill (congruence and similarity,
// GEOM-1; in `angles` 180 − a − b is the skill itself):
//  - 180° minus the printed angles: the first two printed, or all of them (a congruence item that asks the third angle
//    of a triangle can be answered so without reading the correspondence at all);
//  - two printed lengths multiplied, over 4 (a median's half-triangle area: b·h/4).
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
import { isCorrect, TOPIC, topicsFor, placementTopicsFor, figPlain, fairForCheck } from '@/content/index.js';
// @ts-ignore: plain JS
import { manipSolution } from '@/content/manip.js';
// @ts-ignore: plain JS
import { toFrac, choiceWidth } from '@/content/util.js';
// @ts-ignore: plain JS
import { probeItem, startLevel, nextProbe, placementTop, PER_TOPIC, PROBE_LEN, KNOW } from '@/lib/placement.js';
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
// @ts-ignore: plain JS
import { fanItem, splitTriangleS1, splitTriangleS2 } from '@/content/angleItems.js';
// @ts-ignore: plain JS
import { bisItem, quadItem } from '@/content/angles67.js';

// the teaching content loads one topic at a time (DURABLE-11): these tests run on all of it, loaded
const CONTENT = await loadAllContent();

const LIMIT = 0.02;
const SLOW = 60_000; // each test generates thousands of questions
// a verification's control question looks for a draw the misconception leaves unchanged, up to 400 draws a question
// (learn/items.ts): signed:6's sign almost never is (only an answer of 0), so that one test makes about 400 times the
// questions: 60 s run alone and 75-220 s within the whole suite on the shared 4-CPU machine, past SLOW
const VERIFY_SLOW = 300_000;
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
/**
 * The same answer written another way (stage 2, MEASURE-1 item 4): a π ≈ 3.14 answer (`pk`) typed with the calculator's
 * π, or as its multiple of π (the "with π" habit, 25 for 78.5). A □π question's answer is already its number before π.
 */
const altAnswers = (it: Item): unknown[] => (it.form === 'num' && Number.isFinite(it.pk) ? [Math.round(Math.PI * it.pk * 100) / 100, it.pk] : []);

/** The two guessing strategies, learned from a sample of a check's questions (all its sources together). */
function learnGuesses(samples: Item[]) {
  const byKind: Record<string, Record<string, { n: number; v: unknown }>> = {};
  const byForm: Record<string, Record<string, { n: number; v: unknown }>> = {};
  samples.forEach((it) => {
    const v = answerOf(it); const key = JSON.stringify(v);
    ((byKind[kindOf(it)] ||= {})[key] ||= { n: 0, v }).n += 1;
    // the constants tried include the π-form answers (each is right exactly when the answer is)
    [v, ...altAnswers(it)].forEach((w) => { ((byForm[formOf(it)] ||= {})[JSON.stringify(w)] ||= { n: 0, v: w }).n += 1; });
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
    : m.kind === 'angle' ? [m.target, m.whole] : m.kind === 'pins' ? (m.labels || []).filter((l: unknown) => typeof l === 'number') : [];
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

/**
 * The numbers a question prints as angles (a number with a degree sign, in its text, its expression or a drawing's angle
 * marks) and as lengths (every other printed number, and a drawing's side labels), each in reading order.
 */
const DEG = /(-?\d+(?:\.\d+)?)\s*(?:\^\s*\{?\s*\\circ\s*\}?|°)/g;
export function printedParts(it: Item): { angles: number[]; lengths: number[] } {
  const said = [it.text, it.display].filter(Boolean).join(' ');
  const angles = [...said.matchAll(DEG)].map((m) => Number(m[1]));
  const lengths = printed({ ...it, text: said.replace(DEG, ' '), display: '' });
  if (it.fig?.type === 'geo') {
    // a drawing that repeats a number the text prints shows it once, not twice: a mark is added only past the text's
    // own count of that number (the 62° of "∢CAD = 62°" drawn at A is one printed angle, so "180° minus the first two"
    // does not become 180° − 2 · 62°, which is a stair's real answer and no shortcut)
    const more = (to: number[], vs: number[]) => { const left = [...to]; vs.forEach((v) => { const i = left.indexOf(v); if (i >= 0) left.splice(i, 1); else to.push(v); }); };
    more(angles, (it.fig.angles || []).flatMap((g: any) => [...String(g.text || '').matchAll(DEG)].map((m) => Number(m[1]))));
    more(lengths, (it.fig.segs || []).filter((sg: any) => /^-?\d+(\.\d+)?$/.test(String(sg.label ?? ''))).map((sg: any) => Number(sg.label)));
  }
  return { angles, lengths };
}
/** The topics where the arithmetic shortcuts are measured: there the triangle sum and b·h/4 are tools, not the skill. */
const ARITH_TOPICS = new Set(['congr', 'sim']);
const ARITH: ((it: Item) => number)[] = [
  // 180° minus the first two printed angles
  (it) => { if (it.form !== 'num' || !ARITH_TOPICS.has(it.topic)) return 0; const { angles: a } = printedParts(it); return a.length >= 2 && isCorrect(it, 180 - a[0] - a[1]) ? 1 : 0; },
  // 180° minus every printed angle
  (it) => { if (it.form !== 'num' || !ARITH_TOPICS.has(it.topic)) return 0; const { angles: a } = printedParts(it); return a.length >= 1 && isCorrect(it, 180 - a.reduce((x, y) => x + y, 0)) ? 1 : 0; },
  // the first two printed lengths multiplied, over 4
  (it) => { if (it.form !== 'num' || !ARITH_TOPICS.has(it.topic)) return 0; const { lengths: l } = printedParts(it); return l.length >= 2 && isCorrect(it, (l[0] * l[1]) / 4) ? 1 : 0; },
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
  const fromQuestion = [...SHOWN, ...DEGREES, ...ARITH].map((c) => atLeast(samples.map((xs) => xs.reduce((a, it) => a + c(it), 0) / N), need));
  return Math.max(...learnGuesses(samples.flat()).map((g) => atLeast(chances(draws, g), need)), ...fromQuestion);
}

const rnd = () => Math.random();
// guessing.arabic.test.ts runs these again with the app in Arabic, on the topics taught in Arabic (COUNCIL2-34)
const ONLY: string[] | undefined = (globalThis as { __ONLY_TOPICS?: string[] }).__ONLY_TOPICS;
const inScope = (id: string) => !ONLY || ONLY.includes(id.split(':')[0]);
const drawOf = (skill: string, source: Source, candidates?: string[]): Draw => () => itemFor(skill, source, rnd, undefined, candidates, { test: true });
const planDraws = (purpose: 'mastery' | 'review', skill: string) => checkPlan({ purpose, skill }, rnd).map((q) => drawOf(q.skill, q.source));

describe('a check cannot be passed by guessing', () => {
  it.each(ALL_SKILLS.filter(inScope))('%s: the mastery check, the review and the jump test', (skill) => {
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
  it.each(miscs.filter(([skill]) => inScope(skill)))('%s: the verification after repairing %s', (skill, misc) => {
    const plan = checkPlan({ purpose: 'verify', skill, misc }, rnd);
    expect(plan).toHaveLength(VERIFY_N);
    const rate = passRate(plan.map((q) => drawOf(q.skill, q.source, q.candidates)), VERIFY_NEED);
    expect(rate, `${skill} verify ${misc}: ${(100 * rate).toFixed(2)}%`).toBeLessThan(LIMIT);
  }, VERIFY_SLOW);
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
 * - ex2m (the pattern's n-th term, a choice) was not in the council's list either, and the merged app's checks draw
 *   enough of it to measure (the product2 merge): written as the right one is, the right one and the swapped one carry
 *   n − 1 and are longer than s + dn and dn. FOLLOW-UP: four choices of one length.
 */
const KNOWN_TELLS = new Set([
  'expr:1 ex1m|longest', 'expr:1 ex1m|widest', 'expr:1 ex1m|middle value', 'expr:2 ex2m|longest', 'expr:2 ex2m|widest',
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
  // Every unit on a grade's path is walked as the first-day test walks it, also a unit that test skips (placement:
  // false, content/topics.js placementTopicsFor: taught later in the year), so a unit switched on later already holds.
  // One skipped unit is over 2% on the walk and is held to its measured bound: the congruent triangles (curriculum
  // stage 4). Each of its probes alone is under 2% (congr:4 1.8%, congr:2 0.8%), two in a row reach 2.6%, because one
  // strategy answers congr:4's transfer question (the median halves the area) half the time. Its mastery check, review
  // and jump test are held to 2% above, like every stair's. That question changes before congr is asked on the first
  // day: a unit the first-day test asks never has a wider bound (checked below).
  const WALK_LIMIT: Record<string, number> = { congr: 0.03 };
  const asked = new Set(([...placementTopicsFor('7'), ...placementTopicsFor('8')] as { id: string }[]).map((t) => t.id));
  // (the Arabic run, guessing.arabic.test.ts, walks only its own topics: ONLY)
  const topics = ([...topicsFor('7'), ...topicsFor('8')] as { id: string; levels: unknown[] }[]).filter((t) => inScope(t.id));
  it('a wider bound is only ever a skipped unit\'s, and is still a small one', () => {
    for (const [id, limit] of Object.entries(WALK_LIMIT)) {
      expect(asked.has(id), id).toBe(false);
      expect(([...topicsFor('7'), ...topicsFor('8')] as { id: string }[]).some((t) => t.id === id), id).toBe(true);
      expect(limit).toBeLessThanOrEqual(0.03);
    }
  });
  it.each(topics.map((t) => t.id))('%s: a guesser is placed on or above any stair less than 2% of the time', (topic) => {
    // the levels the first-day test can reach (lib/placement.js placementTop: stats stops at stats:5)
    const top = placementTop(topic);
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
        expect(p, `${topic} (onboarding answer ${know}): placed on stair ${L} or above ${(100 * p).toFixed(2)}%`).toBeLessThan(WALK_LIMIT[topic] ?? LIMIT);
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
  const plain = (r: () => number) => { for (;;) { const it = collectItem(); if (!String(it.key).startsWith('ex3b:') && !(it as { practiceOnly?: boolean }).practiceOnly) return it; } };
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

// CLASSROOM-9 and -11: the fan and the split triangle's S2 alone: no answer common enough to pass a check, and never a
// copied number, nor 180°, 90° or 360° minus one (∢C = 90° is printed too). Their ranges stop where each number still
// fits inside its own angle in the drawing, so the most common answer is about 6.2% (the fan) and 5.3% (S2), not the
// spec's 5.2% and 3.5%: 4 of 5 by typing it is still below 1 in 10,000.
// S1 is 90° minus a printed number by its nature: it is practice only and never reaches a check.
describe('the class\'s new angle kinds cannot be guessed', () => {
  it.each([['the fan', () => fanItem(), 0.075], ['the split triangle, S2', () => splitTriangleS2(), 0.065]] as const)('%s', (_name, make, most) => {
    const items = Array.from({ length: 6000 }, () => make());
    const freq = new Map<number, number>();
    items.forEach((it) => freq.set(it.answer, (freq.get(it.answer) || 0) + 1));
    const common = Math.max(...freq.values()) / items.length;
    expect(common).toBeLessThan(most);
    expect(atLeast([common, common, common, common, common], 4)).toBeLessThan(LIMIT / 100);
    items.forEach((it) => {
      const guesses = shownNumbers(it).flatMap((n) => [n, 180 - n, 90 - n, 360 - n]);
      expect(guesses.some((v) => isCorrect(it, v)), it.key).toBe(false);
    });
  }, SLOW);
  it('S1 never reaches a check', () => {
    for (let i = 0; i < 200; i += 1) expect(splitTriangleS1().practiceOnly).toBe(true);
  });
});

// CLASSROOM-10 and -12: the bisector's four typed kinds as practice draws them (spec 1.7% for the most common answer;
// 1.4% measured, bisTwo alone 4.2%) and the quadrilateral's three (spec 9.3%; 9.2% measured): no answer common enough to
// pass a check, and never a copied number, nor 180°, 90° or 360° minus one (a right angle's 90° counts as printed)
describe('the bisector and the quadrilateral cannot be guessed', () => {
  it.each([['the bisector, its four typed kinds', () => bisItem(), 0.02], ['two bisectors in a fan (bisTwo) alone', () => bisItem('t'), 0.05],
    ['the quadrilateral, its three kinds', () => quadItem(), 0.1]] as const)('%s', (_name, make, most) => {
    const items = Array.from({ length: 6000 }, () => make());
    const freq = new Map<number, number>();
    items.forEach((it) => freq.set(it.answer, (freq.get(it.answer) || 0) + 1));
    const common = Math.max(...freq.values()) / items.length;
    expect(common).toBeLessThan(most);
    expect(atLeast([common, common, common, common, common], 4)).toBeLessThan(LIMIT / 10);
    items.forEach((it) => {
      const guesses = [...shownNumbers(it), ...(/ישרה/.test(it.text) ? [90] : [])].flatMap((n) => [n, 180 - n, 90 - n, 360 - n]);
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
  it('reads the numbers of a situation graph: its axes, every point in order and what it marks', () => {
    const fig = { type: 'sgraph', x: { max: 45, step: 5, label: 'זמן', unit: 'דקות', every: 2 }, y: { max: 700, step: 100, label: 'מרחק מהבית', unit: 'מטרים' }, series: [{ pts: [[0, 0], [10, 600], [25, 600], [45, 0]] }], bands: [{ from: 10, to: 25 }] };
    expect(shownNumbers({ form: 'num', text: 'כמה דקות עמדה נועה?', fig })).toEqual([0, 45, 5, 10, 0, 700, 100, 0, 0, 10, 600, 25, 600, 45, 0, 10, 25]);
    // a protractor: each arm's two readings; a clock: its hour and minutes
    expect(shownNumbers({ form: 'num', text: 'מה גודל הזווית?', fig: { type: 'protractor', arms: [180, 130], letters: { vertex: 'B', a: 'A', b: 'C' } } })).toEqual([180, 0, 130, 50]);
    expect(shownNumbers({ form: 'num', fig: { type: 'clock', h: 2, m: 30 } })).toEqual([2, 30]);
    // a table keeps being read, and every other drawing too (CURRICULUM-10): an angle drawing's 40°
    expect(shownNumbers({ form: 'num', fig: { type: 'table', head: ['x', 'y'], rows: [[1, 9]] } })).toEqual([1, 9]);
    expect(shownNumbers({ form: 'num', fig: { type: 'linear', a: 40 } })).toEqual([40]);
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
  it('reads 3.14 as a printed number, and grades π answers as the lesson does (stage 2)', () => {
    // "with π ≈ 3.14": the 3.14 is printed, so copying it is one of the guesses measured
    expect(shownNumbers({ form: 'num', text: 'מה היקף מעגל שקוטרו $20$ ס״מ? חשבו עם $\\pi \\approx 3.14$ ועגלו לעשירית.' })).toEqual([20, 3.14]);
    // a π ≈ 3.14 check whose multiples repeat is passed by a constant, read with pk rightness (62.8 or 62.83 for 20π)
    const pk: Draw = () => ({ form: 'num', text: 'חשבו עם $\\pi \\approx 3.14$', pk: 20, answer: 62.8, key: 'pk:x' });
    expect(passRate([pk, pk, pk], 3)).toBeGreaterThan(0.9);
    expect(isCorrect(pk(), 62.83)).toBe(true);
    expect(isCorrect(pk(), 20)).toBe(false);
    // a □π check whose number before π is always 25: the constant 25 is found
    const pi: Draw = () => ({ form: 'num', text: 'כתבו בעזרת $\\pi$', after: '\\pi', answer: 25, key: 'pi:x' });
    expect(passRate([pi, pi, pi], 3)).toBeGreaterThan(0.9);
    // the π-form constants are tried too: on questions of both forms with one multiple of π, typing 25 passes the □π
    // ones and 78.5 the π ≈ 3.14 ones
    const both: Draw = () => (Math.random() < 0.5 ? { form: 'num', pk: 25, answer: 78.5, key: 'm:pk' } : { form: 'num', after: '\\pi', answer: 25, key: 'm:pi' });
    expect(passRate([both, both, both], 3)).toBeGreaterThan(0.1);
  });
  it('the arithmetic shortcuts of congruence and similarity run, and only there (GEOM-1 Tests)', () => {
    // synthetic items show the guessers guess (the congruence and similarity units' real ones run in the checks above),
    // so they cannot pass a real check by never running
    const third = { form: 'num', topic: 'congr', text: 'במשולש $ABC$: $\\sphericalangle A = 50^\\circ$, $\\sphericalangle B = 60^\\circ$. כמה מעלות $\\sphericalangle C$?', answer: 70, key: 'syn:third' };
    expect(printedParts(third)).toEqual({ angles: [50, 60], lengths: [] });
    expect(ARITH[0](third)).toBe(1);
    expect(ARITH[1](third)).toBe(1);
    // with three printed angles, "minus all of them" is the one that guesses
    const all = { ...third, text: 'זוויות של $30°$, $40°$ ו־$50^{\\circ}$', answer: 60 };
    expect(printedParts(all).angles).toEqual([30, 40, 50]);
    expect([ARITH[0](all), ARITH[1](all)]).toEqual([0, 1]);
    // two lengths multiplied over 4: the base 8 and the height 6 guess 12, in the text or as a drawing's side labels
    const area = { form: 'num', topic: 'sim', text: '$BC = 8$, $AH = 6$. מה השטח של $\\triangle ABD$?', answer: 12, key: 'syn:area' };
    expect(printedParts(area)).toEqual({ angles: [], lengths: [8, 6] });
    expect(ARITH[2](area)).toBe(1);
    const drawn = { form: 'num', topic: 'sim', text: 'מה השטח?', answer: 12, key: 'syn:drawn', fig: { type: 'geo', pts: { A: [0, 3], B: [0, 0], C: [4, 0] }, segs: [{ a: 'B', b: 'C', label: '8' }, { a: 'A', b: 'B', label: '6' }], angles: [{ at: 'B', from: 'C', to: 'A', right: true }] } };
    expect(ARITH[2](drawn)).toBe(1);
    // the triangle sum is the skill of `angles`: there the shortcut is not counted against the check
    expect(ARITH.map((g) => g({ ...third, topic: 'angles' }))).toEqual([0, 0, 0]);
    // and it reaches the pass rate: a check whose answer is always 180 − a − b falls to it
    const draw: Draw = () => { const a = 5 * (7 + Math.floor(Math.random() * 10)); const b = 5 * (7 + Math.floor(Math.random() * 10)); return { ...third, text: `$\\sphericalangle A = ${a}^\\circ$, $\\sphericalangle B = ${b}^\\circ$`, answer: 180 - a - b, key: `syn:${a}:${b}` }; };
    expect(passRate([draw, draw, draw, draw, draw], 4)).toBeGreaterThan(0.9);
  });
  it('sees the old pyth:5 hole: always typing 5 when the answers are 5 or 10', () => {
    // a check of five questions whose answers are 5 three times out of four: the measure must catch it
    const old: Draw = () => ({ form: 'num', answer: Math.random() < 0.75 ? 5 : 10, key: 'old:x' });
    expect(passRate([old, old, old, old, old], 4)).toBeGreaterThan(0.5);
    expect(skillId('pyth', 5)).toBe('pyth:5');
  });
});
