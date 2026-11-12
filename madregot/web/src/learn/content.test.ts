// Every stair's teaching content is checked mathematically, not only for shape:
// worked examples step by step, guided problems, interactive goals, the diagnostic models and their
// misconception predictions. A stair added to the registry is covered without writing new tests.
import { describe, it, expect } from 'vitest';
import { loadAllContent } from './content/index';
import type { DiscoverStep, DiagModel, FigSpec, StairContent, WorkedExample } from './types';
import { createElement } from 'react';
// @ts-ignore: react-dom has no type declarations here
import { renderToStaticMarkup } from 'react-dom/server';
// @ts-ignore: plain JS
import Figure from '@/components/Figure.jsx';
import { evaluate, same, seeded, identical, texToExpr, texRelation, holds } from './expr';
import { discriminating, diagnose, roundAway } from './misconceptions';
import { checkPlan, itemFor, canProbe } from './items';
import { ALL_SKILLS } from './skills';
import { TOGETHER_DIAG, finalPredictions, diagnoseFinal } from './content/togetherDiag';
// @ts-ignore: plain JS
import { manipCorrect, manipSolution, balanceTilt, balanceReachable, rayHas, TILES_MAX } from '@/content/manip.js';
// @ts-ignore: plain JS
import { TOPIC, fairForCheck, makeItem, namesOf } from '@/content/index.js';
// @ts-ignore: plain JS
import { drawNested, nestedBugs, nestedValue } from '@/content/signedItems.js';
// @ts-ignore: plain JS
import { T } from '@/content/util.js';
// @ts-ignore: plain JS
import { drawPow, powValue, powBugs, POW_MIX } from '@/content/signed7.js';
// @ts-ignore: plain JS
import { STORY_MIX, storyMix } from '@/content/eq.js';
// @ts-ignore: plain JS
import { bisCheckItem } from '@/content/angles67.js';
// @ts-ignore: plain JS
import { itemPlain } from '@/content/index.js';
import { readFileSync } from 'node:fs';
import { CHALLENGES } from './challenges/index';

// the teaching content loads one topic at a time (DURABLE-11): these tests run on all of it, loaded
const CONTENT = await loadAllContent();

const stairs = Object.values(CONTENT) as StairContent[];
const DRAWS = 400;

/** A side of an equation as { k, c } (k·x + c). */
const sideOf = (tex: string) => { const e = texToExpr(tex); const f = (x: number) => evaluate(e, { x }); return { k: f(1) - f(0), c: f(0) }; };
/**
 * A wrong choice explained as "the number N moved to the other side without changing its sign" must be what that
 * slip gives: in 7 − x = 3 the 7 moved over gives −x = 10, so x = −10 (10 needs a second slip, the minus of −x lost).
 */
function checkMovedNumber(s: Extract<DiscoverStep, { kind: 'predict' }>, at: string) {
  if (!s.display || !s.wrongWhy || (s.display.match(/=/g) || []).length !== 1 || /[<>]|\\(le|ge)/.test(s.display)) return;
  Object.entries(s.wrongWhy).forEach(([i, why]) => {
    const m = why.match(/ה־\$(-?\d+(?:\.\d+)?)\$ (?:עובר|עבר) לאגף השני בלי להתהפך/);
    if (!m) return;
    const N = Number(m[1]);
    const [L, R] = s.display!.split('=').map(sideOf);
    // the number keeps its sign on the other side; the x-terms are moved the right way
    const moved = L.c === N ? (R.c + L.c) / (L.k - R.k) : R.c === N ? -(L.c + R.c) / (L.k - R.k) : NaN;
    expect(Number.isFinite(moved), `${at}: ${N} is not a number term of ${s.display}`).toBe(true);
    const chosen = evaluate(texToExpr(s.choices[Number(i)].replace(/\$/g, '')));
    expect(same(chosen, moved), `${at}: moving ${N} without its sign gives ${moved}, not ${s.choices[Number(i)]}`).toBe(true);
  });
}

function checkSteps(steps: DiscoverStep[], where: string) {
  steps.forEach((s, i) => {
    const at = `${where} step ${i + 1}`;
    expect(s.text, at).toBeTruthy();
    if (s.kind === 'predict') {
      expect(s.choices.length, at).toBeGreaterThanOrEqual(2);
      expect(s.answer, at).toBeGreaterThanOrEqual(0);
      expect(s.answer, at).toBeLessThan(s.choices.length);
      expect(new Set(s.choices).size, `${at}: duplicate choices`).toBe(s.choices.length);
      expect(s.why, at).toBeTruthy();
      checkMovedNumber(s, at);
    }
    if (s.kind === 'explore') {
      const it = { form: 'manip', manip: s.manip, answer: s.answer };
      // the goal is a state the object can reach, and reaching it counts as right
      expect(manipCorrect(it, manipSolution(it)), `${at}: goal not reachable`).toBe(true);
      // the starting state is not already the answer (the student has to move something)
      const start = (s.manip as { start?: unknown }).start;
      if (start != null) expect(manipCorrect(it, start), `${at}: starts on the goal`).toBe(false);
      if (s.manip.kind === 'numberline') {
        const m = s.manip as unknown as { min: number; max: number; start: number; den?: number };
        expect(s.answer as number, at).toBeGreaterThanOrEqual(m.min);
        expect(s.answer as number, at).toBeLessThanOrEqual(m.max);
        expect(m.start, `${at}: starts on the answer`).not.toBe(s.answer);
        // a line cut into parts reaches only whole numbers of parts
        if (m.den) expect(onParts(s.answer as number, m.den), `${at}: ${s.answer} is not a whole number of 1/${m.den}`).toBe(true);
        // the expression shown is the movement asked for (a fraction or a decimal too: 5/3, \frac{5}{3}, 0.75)
        if (s.display && /^([-+0-9 ().\/]|\\frac|[{}])+$/.test(s.display)) expect(same(evaluate(s.display.includes('\\') ? texToExpr(s.display) : s.display), s.answer as number), `${at}: ${s.display}`).toBe(true);
      }
      if (s.manip.kind === 'pins') {
        const m = s.manip as unknown as { min: number; max: number; den?: number };
        (s.answer as number[]).forEach((v) => {
          expect(v >= m.min && v <= m.max, `${at}: ${v} is off the line`).toBe(true);
          expect(onParts(v, m.den || 1), `${at}: ${v} is not on a tick`).toBe(true);
        });
      }
      if (s.manip.kind === 'fbar') checkFbar(s.manip as any, s.answer as any, at);
      if (s.manip.kind === 'dline') checkDline(s.manip as any, s.answer as number, at);
      // a point goal must be on the drawn grid: the tool clamps every move to it, so a goal off the grid can never be reached
      if (s.manip.kind === 'plot') {
        const r = ((s.manip as { range?: number }).range) || 6;
        const [x, y] = s.answer as [number, number];
        expect(Math.abs(x) <= r && Math.abs(y) <= r, `${at}: goal (${x}, ${y}) is off the ${r}-grid`).toBe(true);
        // two lines: the goal is where they meet, and they do meet once
        const lines = (s.manip as { lines?: { m: number; b: number }[] }).lines;
        if (lines) {
          expect(lines.length, at).toBe(2);
          expect(lines[0].m !== lines[1].m, `${at}: parallel lines never meet`).toBe(true);
          lines.forEach((L) => expect(same(L.m * x + L.b, y), `${at}: (${x}, ${y}) is not on y = ${L.m}x + ${L.b}`).toBe(true));
        }
      }
      if (s.manip.kind === 'balance') checkBalance(s.manip as any, s.answer as number, s.display, at);
      if (s.manip.kind === 'tiles') checkTiles(s.manip as any, s.answer as any, s.display, at);
      if (s.manip.kind === 'area') checkArea(s.manip as any, s.answer as any, s.display, at);
      if (s.manip.kind === 'ray') checkRay(s.manip as any, s.answer as any, s.display, at);
      expect(s.hint, at).toBeTruthy();
      expect(s.success, at).toBeTruthy();
    }
    if (s.kind === 'rule') expect(s.why, at).toBeTruthy();
  });
}

/** A value is a whole number of parts of size 1/den. */
const onParts = (v: number, den: number) => Math.abs(v * den - Math.round(v * den)) < 1e-9;
const gcdN = (a: number, b: number): number => (b ? gcdN(b, a % b) : a);
/**
 * A fraction bar: its start is a bar the object can show, and its goal can be built with at most maxDen parts (the
 * locked number of parts when the step fixes it): a value that is a whole number of parts, an exact bar that fits, a
 * common number of parts no larger than maxDen.
 */
function checkFbar(m: { start: { den: number; shaded: number }; lockDen?: boolean; maxDen?: number; marks?: number[] }, a: any, at: string) {
  const maxDen = m.maxDen || 24; const st = m.start;
  expect(Number.isInteger(st.den) && st.den >= 1 && st.den <= maxDen && Number.isInteger(st.shaded) && st.shaded >= 0 && st.shaded <= st.den, `${at}: the start is not a bar`).toBe(true);
  (m.marks || []).forEach((x) => expect(x > 0 && x < 1, `${at}: a mark at ${x} is off the bar`).toBe(true));
  if (a.mode === 'value') {
    expect(a.value >= 0 && a.value <= 1, `${at}: ${a.value} is not a part of one bar`).toBe(true);
    if (m.lockDen) expect(onParts(a.value, st.den), `${at}: ${a.value} is not a whole number of 1/${st.den}`).toBe(true);
    else expect(Array.from({ length: maxDen }, (_, i) => i + 1).some((d) => onParts(a.value, d)), `${at}: ${a.value} needs more than ${maxDen} parts`).toBe(true);
  } else if (a.mode === 'exact') {
    expect(a.den >= 1 && a.den <= maxDen && a.shaded >= 0 && a.shaded <= a.den, `${at}: ${a.shaded}/${a.den} does not fit the bar`).toBe(true);
    if (m.lockDen) expect(a.den, `${at}: the parts are locked`).toBe(st.den);
  } else {
    expect(a.mode, at).toBe('common');
    const l = (a.of as number[]).reduce((x, y) => (x * y) / gcdN(x, y), 1);
    expect(l <= maxDen && !m.lockDen, `${at}: a common number of parts ${l} cannot be made`).toBe(true);
  }
}
/**
 * A double number line: the goal is a multiple of the moving line's step, within it (the bottom end at least one step
 * long), and reached from the start in whole steps; the fixed marker of "max" sits on a tick of the top line.
 */
function checkDline(m: { top: { max: number; step: number }; bottom: { max: number; step: number }; move: 't' | 'max'; start: { t: number; max?: number }; fixT?: number }, a: number, at: string) {
  const L = m.move === 'max' ? m.bottom : m.top; const lo = m.move === 'max' ? L.step : 0;
  const from = m.move === 'max' ? m.start.max : m.start.t;
  expect(onParts(a, 1 / L.step), `${at}: ${a} is not a multiple of ${L.step}`).toBe(true);
  expect(a >= lo - 1e-9 && a <= L.max + 1e-9, `${at}: ${a} is off the line (${lo}..${L.max})`).toBe(true);
  expect(typeof from === 'number' && onParts((a - from), 1 / L.step), `${at}: not reached in steps of ${L.step} from ${from}`).toBe(true);
  expect(onParts(m.top.max, 1 / m.top.step) && onParts(m.bottom.max, 1 / m.bottom.step), `${at}: a line does not end on a tick`).toBe(true);
  if (m.move === 'max') expect(typeof m.fixT === 'number' && onParts(m.fixT, 1 / m.top.step) && m.fixT > 0 && m.fixT <= m.top.max, `${at}: the marker is not on a tick`).toBe(true);
}

type Pans = { lx: number; l1: number; rx: number; r1: number };
/**
 * A balance: whole counts that fit the drawing (6 boxes, 12 weights a pan), level at the answer, solvable with the
 * student's moves, and never by working on one pan alone (that is what makes "the same on both sides" the student's
 * decision). An equation shown with it is the scale itself, side for side.
 */
function checkBalance(m: { start: Pans }, x: number, display: string | undefined, at: string) {
  const st = m.start;
  expect(Number.isInteger(x) && x > 0, `${at}: a box weighs a positive whole number of weights`).toBe(true);
  (['lx', 'l1', 'rx', 'r1'] as const).forEach((g) => expect(Number.isInteger(st[g]) && st[g] >= 0, `${at}: ${g} is not a count`).toBe(true));
  expect(st.lx <= 6 && st.rx <= 6, `${at}: more than 6 boxes on a pan`).toBe(true);
  expect(st.l1 <= 12 && st.r1 <= 12, `${at}: more than 12 weights on a pan`).toBe(true);
  expect(balanceTilt(st, x), `${at}: the scale must start level (its equation true at x = ${x})`).toBe(0);
  expect(balanceReachable(st, x), `${at}: one box alone cannot be reached`).toBe(true);
  expect(balanceReachable(st, x, 'l') || balanceReachable(st, x, 'r'), `${at}: one pan alone reaches the goal`).toBe(false);
  if (display && display.includes('=')) {
    const { left, right } = texRelation(display);
    expect(identical(left, `${st.lx}*x+${st.l1}`) && identical(right, `${st.rx}*x+${st.r1}`), `${at}: ${display} is not the scale's equation`).toBe(true);
  }
}
/** Tiles: the start collects to the answer (only zero pairs go), fits its rows, and has a zero pair to remove. */
function checkTiles(m: { start: { px: number; nx: number; p1: number; n1: number } }, a: { k: number; c: number }, display: string | undefined, at: string) {
  const st = m.start;
  expect(st.px - st.nx, `${at}: the x tiles do not collect to ${a.k}`).toBe(a.k);
  expect(st.p1 - st.n1, `${at}: the unit tiles do not collect to ${a.c}`).toBe(a.c);
  expect(st.px + st.nx <= TILES_MAX.x && st.p1 + st.n1 <= TILES_MAX.unit, `${at}: too many tiles for a row`).toBe(true);
  expect(Math.min(st.px, st.nx) + Math.min(st.p1, st.n1) > 0, `${at}: no zero pair to remove`).toBe(true);
  if (display) expect(identical(texToExpr(display), `${a.k}*x+${a.c}`), `${at}: ${display} is not ${a.k}x + ${a.c}`).toBe(true);
}
/** A rectangle a by x + b: whole lengths the object can reach, a start that is not the goal, the display a(x + b). */
function checkArea(m: { start: { a: number; b: number }; maxA?: number; maxB?: number }, a: { a: number; b: number }, display: string | undefined, at: string) {
  const maxA = m.maxA || 6; const maxB = m.maxB || 9;
  [a, m.start].forEach((p) => expect(Number.isInteger(p.a) && Number.isInteger(p.b) && p.a >= 1 && p.a <= maxA && p.b >= 0 && p.b <= maxB, `${at}: ${JSON.stringify(p)} is outside the object`).toBe(true));
  expect(m.start.a === a.a && m.start.b === a.b, `${at}: starts on the answer`).toBe(false);
  if (display) expect(identical(texToExpr(display), `${a.a}*(x+${a.b})`), `${at}: ${display} is not ${a.a}(x + ${a.b})`).toBe(true);
}
/** A ray: on the line, not the start; an inequality shown with it has exactly the ray's numbers as solutions. */
function checkRay(m: { start: { at: number; dir: number; closed: boolean }; min?: number; max?: number }, a: { at: number; dir: number; closed: boolean }, display: string | undefined, at: string) {
  const min = m.min ?? -10; const max = m.max ?? 10;
  [a, m.start].forEach((p) => expect(Number.isInteger(p.at) && p.at >= min && p.at <= max && Math.abs(p.dir) === 1, `${at}: ${JSON.stringify(p)} is outside the object`).toBe(true));
  expect(m.start.at === a.at && m.start.dir === a.dir && !!m.start.closed === !!a.closed, `${at}: starts on the answer`).toBe(false);
  if (display) for (let n = min; n <= max; n += 0.5) expect(holds(display, { x: n }), `${at}: ${display} at x = ${n}`).toBe(rayHas(a, n));
}

/**
 * A worked example: its answer, every step's value and side computation; for algebra, every rewritten expression
 * (`ident`) is identical to the given one, and every equation (`eq`) holds at the solution and, with one unknown,
 * there only: a step that loses or invents a solution fails. A step with `ident` or `eq` shows in `result` the same
 * expression or equation, so the TeX the student reads is checked too.
 */
function checkExample(ex: WorkedExample, k: number) {
  const vars = ex.vars || {};
  expect(same(evaluate(ex.check, vars), ex.answer), `example ${k + 1}: ${ex.check} ≠ ${ex.answer}`).toBe(true);
  expect(ex.steps.length, `example ${k + 1}`).toBeGreaterThanOrEqual(2);
  if (ex.expr) expect(() => evaluate(ex.expr!, { x: 1 }), `example ${k + 1}: expr ${ex.expr}`).not.toThrow();
  ex.steps.forEach((s, i) => {
    const at = `example ${k + 1} step ${i + 1}`;
    expect(s.action, at).toBeTruthy(); expect(s.why, at).toBeTruthy(); expect(s.result, at).toBeTruthy();
    if (s.value) expect(same(evaluate(s.value, vars), ex.answer), `${at}: ${s.value} ≠ ${ex.answer}`).toBe(true);
    if (s.calc) expect(same(evaluate(s.calc.expr, vars), s.calc.value), `${at}: ${s.calc.expr} ≠ ${s.calc.value}`).toBe(true);
    if (s.ident) {
      expect(ex.expr, `${at}: ident needs the example's expr`).toBeTruthy();
      expect(identical(s.ident, ex.expr!), `${at}: ${s.ident} is not ${ex.expr}`).toBe(true);
      expect(identical(texToExpr(s.result), ex.expr!), `${at}: the result ${s.result} is not ${ex.expr}`).toBe(true);
    }
    if (s.ineq) {
      expect(ex.ray, `${at}: ineq needs the example's ray`).toBeTruthy();
      const r = ex.ray!;
      for (let n = r.at - 12; n <= r.at + 12; n += 0.25) {
        expect(holds(s.ineq, { x: n }), `${at}: ${s.ineq} at x = ${n}`).toBe(rayHas(r, n));
        expect(holds(s.result, { x: n }), `${at}: the result ${s.result} at x = ${n}`).toBe(rayHas(r, n));
      }
    }
    if (s.eq) {
      const sides = s.eq.split('=');
      expect(sides.length, `${at}: ${s.eq} is not one equation`).toBe(2);
      const f = `(${sides[0]}) - (${sides[1]})`;
      if (ex.vars) {
        expect(same(evaluate(f, vars), 0), `${at}: ${s.eq} does not hold at ${JSON.stringify(vars)}`).toBe(true);
        expect(holds(s.result, vars), `${at}: the result ${s.result} does not hold at ${JSON.stringify(vars)}`).toBe(true);
      } else {
        const v = (x: number) => evaluate(f, { x });
        expect(same(v(ex.answer) + 1, 1), `${at}: ${s.eq} does not hold at x = ${ex.answer}`).toBe(true);
        // still one equation in x with exactly that solution: linear (second difference 0) and not constant
        expect(same(v(3) - 2 * v(1.5) + v(0) + 1, 1), `${at}: ${s.eq} is not linear`).toBe(true);
        expect(same(v(1), v(0)), `${at}: ${s.eq} no longer has exactly one solution`).toBe(false);
        expect(holds(s.result, { x: ex.answer }), `${at}: the result ${s.result} does not hold at x = ${ex.answer}`).toBe(true);
      }
    }
  });
}

function checkModel(model: DiagModel<any>, c: StairContent, name: string) {
  const rnd = seeded(c.level * 1000 + c.topic.length);
  const fired: Record<string, number> = {};
  for (let i = 0; i < DRAWS; i += 1) {
    const p = model.params(rnd);
    const ans = model.answer(p);
    const at = `${c.skill} ${name} ${JSON.stringify(p)}`;
    expect(Number.isFinite(ans), at).toBe(true);
    expect(model.text(p), at).toBeTruthy();
    expect(model.hint(p), at).toBeTruthy();
    const sol = model.solution(p);
    expect(sol.length, at).toBeGreaterThan(0);
    // the worked solution ends at the same answer the checker accepts
    expect(sol.join(' ').includes(String(T(ans))) || sol.join(' ').includes(String(ans)), `${at}: solution does not reach ${ans}`).toBe(true);
    Object.entries(model.bugs).forEach(([id, f]) => {
      const v = f(p);
      if (v != null && Number.isFinite(v) && !same(v, ans)) fired[id] = (fired[id] || 0) + 1;
    });
  }
  // every misconception in the model shows on a fair share of questions (otherwise it can never be diagnosed)
  Object.keys(model.bugs).forEach((id) => expect(fired[id] || 0, `${c.skill} ${name}: bug ${id} never shows`).toBeGreaterThan(DRAWS * 0.04));
  // every pair of misconceptions can be told apart by some question
  const ids = Object.keys(model.bugs);
  ids.forEach((x, i) => ids.slice(i + 1).forEach((y) => {
    const p = discriminating(model, [x, y], seeded(7), 2000);
    expect(p, `${c.skill} ${name}: ${x} and ${y} cannot be told apart`).not.toBeNull();
  }));
}

describe('the content registry', () => {
  it('has only real stairs, each once', () => {
    stairs.forEach((c) => {
      expect(ALL_SKILLS).toContain(c.skill);
      expect(c.skill).toBe(`${c.topic}:${c.level}`);
      expect(c.title).toBe(TOPIC[c.topic].levels[c.level - 1].title);
    });
  });
  it('does not repeat one template across stairs', () => {
    const ideas = stairs.map((c) => c.idea);
    expect(new Set(ideas).size).toBe(ideas.length);
    const whys = stairs.map((c) => c.why.join(' '));
    expect(new Set(whys).size).toBe(whys.length);
  });
});

describe.each(stairs.map((c) => [c.skill, c] as const))('stair %s', (_id, c) => {
  it('has a complete journey', () => {
    expect(c.objectives.length).toBeGreaterThanOrEqual(2);
    expect(c.idea).toBeTruthy();
    expect(c.why.length).toBeGreaterThanOrEqual(1);
    expect(c.alt.length).toBeGreaterThanOrEqual(1);
    expect(c.discover.length).toBeGreaterThanOrEqual(4);
    expect(c.discover.some((s) => s.kind === 'predict')).toBe(true);
    expect(c.discover.some((s) => s.kind === 'rule')).toBe(true);
    expect(c.examples.length).toBeGreaterThanOrEqual(2);
    expect(c.together.length).toBeGreaterThanOrEqual(1);
    expect(c.misconceptions.length).toBeGreaterThanOrEqual(2);
  });

  it('teaches with steps that are valid and reachable', () => {
    checkSteps(c.discover, 'discover');
    c.misconceptions.forEach((m) => { expect(m.remedy.length, m.id).toBeGreaterThan(0); checkSteps(m.remedy, `remedy ${m.id}`); });
  });

  it('works its examples correctly, step by step', () => {
    c.examples.forEach((ex, k) => checkExample(ex, k));
  });

  it('solves together with one right move per step and growing hints', () => {
    c.together.forEach((g, k) => {
      g.steps.forEach((s, i) => {
        const at = `together ${k + 1} step ${i + 1}`;
        expect(s.choices.filter((x) => x.ok).length, at).toBe(1);
        expect(s.choices.length, at).toBeGreaterThanOrEqual(2);
        s.choices.forEach((x) => expect(x.feedback, at).toBeTruthy());
        expect(s.hints[0] && s.hints[1] && s.hints[0] !== s.hints[1], at).toBeTruthy();
      });
      expect(same(evaluate(g.final.check), g.final.answer), `together ${k + 1}: ${g.final.check} ≠ ${g.final.answer}`).toBe(true);
    });
  });

  it('diagnoses a wrong last step of solving together by the stair\'s own misconceptions', () => {
    const specs = TOGETHER_DIAG[c.skill];
    expect(specs?.length, 'one entry per guided problem').toBe(c.together.length);
    const ids = c.misconceptions.map((m) => m.id);
    specs.forEach((sp, k) => {
      const ans = c.together[k].final.answer;
      if ('model' in sp) {
        const model = sp.model === 'transfer' ? c.transfer! : c.diag;
        // the parameters are this very problem: the model's right answer is the problem's
        expect(same(model.answer(sp.p), ans), `together ${k + 1}: the model gives ${model.answer(sp.p)}, not ${ans}`).toBe(true);
      } else {
        Object.keys(sp.bugs).forEach((id) => expect(ids, `together ${k + 1}: ${id} is not a misconception of the stair`).toContain(id));
        Object.values(sp.bugs).flat().forEach((v) => expect(same(v, ans), `together ${k + 1}: a prediction equals the answer`).toBe(false));
      }
      // every prediction is diagnosed back to its misconception
      // typed rounded to tenths the way the checker rounds (half away from zero: −4.25 is −4.3, misconceptions.ts roundAway)
      finalPredictions(c, k).forEach(([id, v]) => expect(diagnoseFinal(c, k, roundAway(v, 1)), `together ${k + 1}: ${v}`).toContain(id));
      expect(diagnoseFinal(c, k, ans), `together ${k + 1}: the right answer is no mistake`).toEqual([]);
    });
  });

  it('diagnoses with a model whose predictions are real, reachable and distinguishable', () => {
    checkModel(c.diag, c, 'diag');
    if (c.transfer) checkModel(c.transfer, c, 'transfer');
  });

  it('explains every misconception its models can find', () => {
    const explained = new Set(c.misconceptions.map((m) => m.id));
    [c.diag, c.transfer].filter(Boolean).forEach((model) => Object.keys(model!.bugs).forEach((id) => expect(explained.has(id), `bug ${id} has no explanation`).toBe(true)));
    // and the board can name it
    c.misconceptions.forEach((m) => expect((TOPIC[c.topic].cats as Record<string, string>)[m.id], `cats.${m.id} missing in the topic`).toBeTruthy());
  });

  it('verifies every repaired misconception with questions where it can show again', () => {
    // a repair is offered for any misconception the stair can confirm, from a model or from its exercises' labels;
    // its verification must be able to see a relapse: each of its probes can show it
    c.misconceptions.forEach((m) => {
      // a misconception that shows only in practice-only choices has no question a check may ask (items.ts canProbe):
      // its verification asks the stair's ordinary questions, never a practice-only one
      if (!canProbe(c.skill, [m.id])) {
        const plan = checkPlan({ purpose: 'verify', skill: c.skill, misc: m.id }, Math.random);
        plan.forEach((q) => expect(fairForCheck(itemFor(q.skill, q.source, Math.random, undefined, q.candidates, { test: true })), `${c.skill} verify ${m.id}`).toBe(true));
        return;
      }
      for (let r = 0; r < 3; r += 1) {
        const plan = checkPlan({ purpose: 'verify', skill: c.skill, misc: m.id }, Math.random);
        expect(plan.filter((q) => q.source === 'probe').length, `${c.skill} verify ${m.id}`).toBeGreaterThanOrEqual(2);
        plan.filter((q) => q.source === 'probe').forEach((q) => {
          const it = itemFor(q.skill, q.source, Math.random, undefined, q.candidates, { test: true });
          expect(it.could || [], `${c.skill} verify ${m.id}: "${it.text}" cannot show it`).toContain(m.id);
        });
      }
    });
  });

  it('never sets two pieces of maths side by side in a line of text (in a right-to-left line they read backwards)', () => {
    // "$= 106 + 114$ $= 220$" shows as "= 220 = 106 + 114": each piece is isolated, so the line orders them right to left
    const bad: string[] = [];
    const walk = (v: unknown) => {
      // a piece that goes on the one before it (it starts with =, +, −, · or a comparison) and only a space between them
      const goesOn = (q: string) => /^\$\s*(=|\+|-|\\cdot|:|<|>|\\le|\\ge)/.test(q);
      if (typeof v === 'string') { const parts = v.split(/(\$[^$]+\$)/).filter(Boolean); parts.forEach((q, i) => { if (i > 1 && goesOn(q) && parts[i - 2].startsWith('$') && !parts[i - 1].trim()) bad.push(v); }); }
      else if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') Object.values(v).forEach(walk);
    };
    walk([c.discover, c.examples, c.together, c.misconceptions, c.why, c.alt, c.idea, c.objectives]);
    const rnd = seeded(5);
    [c.diag, c.transfer].filter(Boolean).forEach((m) => { for (let i = 0; i < 50; i += 1) { const p = m!.params(rnd); walk([m!.text(p), m!.hint(p), m!.solution(p)]); } });
    expect(bad).toEqual([]);
  });

  it('writes "מספר" with a definite noun and a definite adjective (מספר הקוראים הרשומים)', () => {
    const rnd = seeded(7);
    [c.diag, c.transfer].filter(Boolean).forEach((m) => {
      for (let i = 0; i < 300; i += 1) {
        const p = m!.params(rnd);
        const words = [m!.text(p), m!.hint(p), ...m!.solution(p)].join(' ');
        // an adjective after the noun (not a phrase that starts with ב, ל, מ, כ, ש or ו: "מספר הכרטיסים למבוגרים")
        expect(words, words).not.toMatch(/מספר ה\S+ים (?![הבלמכשו])\S+ים(?=[\s.,?:])/);
      }
    });
  });

  it('diagnoses its own predictions back', () => {
    const rnd = seeded(99);
    for (let i = 0; i < 100; i += 1) {
      const p = c.diag.params(rnd);
      Object.entries(c.diag.bugs).forEach(([id, f]) => {
        const v = f(p);
        if (v == null || same(v, c.diag.answer(p))) return;
        const d = diagnose(c.diag, p, v);
        expect(d.kind).toBe('misconception');
        if (d.kind === 'misconception') expect(d.candidates.map((x) => x.id)).toContain(id);
      });
    }
  });
});

describe('solving together: the last step names the mistake', () => {
  it('the council\'s cases', () => {
    // stats:3, mean 10 of four numbers, 8 added to one: 18 is the 8 not shared among the four
    expect(diagnoseFinal(CONTENT['stats:3'], 1, 18)).toEqual(['no-divide']);
    // signed:1, −3 − (−8): −11 is subtracting −8 as if it were 8 (or two other readings of the same number)
    expect(diagnoseFinal(CONTENT['signed:1'], 0, -11)).toContain('minus-minus');
    // a number no misconception predicts gets the general hint, not a made-up name
    expect(diagnoseFinal(CONTENT['signed:1'], 0, 4)).toEqual([]);
  });
  it('the algebra stairs name the mistake their number shows, and none the steps ruled out', () => {
    // expr:1, 3(x + 5) at x = −1 after the step −1 + 5 = 4: 34 is 3 next to the bracket read as digits
    expect(diagnoseFinal(CONTENT['expr:1'], 1, 34)).toEqual(['concat']);
    // expr:5, the steps opened −(x − 5) as −x + 5: 3, what −x − 5 would give, is not named
    expect(diagnoseFinal(CONTENT['expr:5'], 0, 3)).toEqual([]);
    // eq:2, 17 = 4x + 5 after the step 12 = 4x: 8 is the coefficient subtracted instead of divided by
    expect(diagnoseFinal(CONTENT['eq:2'], 1, 8)).toEqual(['sub-coef']);
    // sys:5, the smallest whole solution of x ≥ 3 is 3; 4 leaves the boundary out
    expect(diagnoseFinal(CONTENT['sys:5'], 0, 4)).toEqual(['boundary']);
    // eq:3, 2x − 7 = 5x + 8: −4 is no misconception's number, so nothing is named
    expect(diagnoseFinal(CONTENT['eq:3'], 0, -4)).toEqual([]);
  });
});

// The fractions floor is for students who need to see a fraction before they compute with it: every teaching step of
// its stairs draws one (a figure or an object to move), and every drawing renders with real numbers.
describe('the fractions floor teaches with pictures', () => {
  // the floor's four stairs, and the signed fractions and decimals of signed:6 (the same pictures, below zero)
  const frac = stairs.filter((c) => c.topic === 'frac' || c.skill === 'signed:6');
  it('every discover step of frac:1-4 and signed:6 has a figure or an object', () => {
    expect(frac.map((c) => c.skill)).toEqual(['frac:1', 'frac:2', 'frac:3', 'frac:4', 'signed:6']);
    const bare = frac.flatMap((c) => c.discover.map((st, i) => ({ c, i, st })).filter(({ st }) => !(st as { fig?: unknown }).fig && st.kind !== 'explore'));
    expect(bare.map(({ c, i }) => `${c.skill} #${i + 1}`)).toEqual([]);
  });
  it('every figure of the floor renders, with no broken numbers', () => {
    const figs = frac.flatMap((c) => [
      ...c.discover, ...c.misconceptions.flatMap((m) => m.remedy),
      ...c.examples, ...c.together,
    ].map((x) => (x as { fig?: FigSpec }).fig).filter(Boolean) as FigSpec[]);
    expect(figs.length).toBeGreaterThan(10);
    figs.forEach((fig) => {
      const html = renderToStaticMarkup(createElement(Figure, { fig }));
      expect(html, fig.type).toMatch(/<svg/);
      expect(html, fig.type).not.toMatch(/NaN|undefined|Infinity/);
    });
  });
});

// Ratio and scale is taught with the same pictures (the beads on the fraction bar, the scouts in rows, the double number
// line, the 1 by 1 square inside the 3 by 3 one): every teaching step of its stairs draws one, and every drawing renders.
describe('ratio and scale teach with pictures', () => {
  const ratio = stairs.filter((c) => c.topic === 'ratio');
  it('every discover step of ratio:1-4 has a figure or an object', () => {
    expect(ratio.map((c) => c.skill)).toEqual(['ratio:1', 'ratio:2', 'ratio:3', 'ratio:4']);
    const bare = ratio.flatMap((c) => c.discover.map((st, i) => ({ c, i, st })).filter(({ st }) => !(st as { fig?: unknown }).fig && st.kind !== 'explore'));
    expect(bare.map(({ c, i }) => `${c.skill} #${i + 1}`)).toEqual([]);
  });
  it('every figure of the unit renders, with no broken numbers', () => {
    const figs = ratio.flatMap((c) => [
      ...c.discover, ...c.misconceptions.flatMap((m) => m.remedy),
      ...c.examples, ...c.together,
    ].map((x) => (x as { fig?: FigSpec }).fig).filter(Boolean) as FigSpec[]);
    expect(new Set(figs.map((f) => f.type))).toEqual(new Set(['groups', 'fbar', 'geo', 'dline', 'table', 'fgrid']));
    figs.forEach((fig) => {
      const html = renderToStaticMarkup(createElement(Figure, { fig }));
      expect(html, fig.type).toMatch(/<svg|<table/);
      expect(html, fig.type).not.toMatch(/NaN|undefined|Infinity/);
    });
  });
});

// Percent is taught with the percent bar (the double number line, the fraction bar with its whole written under it), the
// volunteers' table and two price changes in a table: every teaching step draws one, and every drawing renders. A
// picture that asks for the whole writes no number on its bottom line but 0 (blank), so it does not give the answer.
describe('percent teaches with pictures', () => {
  const pct = stairs.filter((c) => c.topic === 'pct');
  it('every discover step of pct:1-5 has a figure or an object', () => {
    expect(pct.map((c) => c.skill)).toEqual(['pct:1', 'pct:2', 'pct:3', 'pct:4', 'pct:5']);
    const bare = pct.flatMap((c) => c.discover.map((st, i) => ({ c, i, st })).filter(({ st }) => !(st as { fig?: unknown }).fig && st.kind !== 'explore'));
    expect(bare.map(({ c, i }) => `${c.skill} #${i + 1}`)).toEqual([]);
  });
  it('every figure of the unit renders, with no broken numbers, and a blank line hides its end', () => {
    const figs = pct.flatMap((c) => [
      ...c.discover, ...c.misconceptions.flatMap((m) => m.remedy),
      ...c.examples, ...c.together,
    ].map((x) => (x as { fig?: FigSpec }).fig).filter(Boolean) as FigSpec[]);
    expect(new Set(figs.map((f) => f.type))).toEqual(new Set(['dline', 'fbar', 'table']));
    figs.forEach((fig) => {
      const html = renderToStaticMarkup(createElement(Figure, { fig }));
      expect(html, fig.type).toMatch(/<svg|<table/);
      expect(html, fig.type).not.toMatch(/NaN|undefined|Infinity/);
    });
    // pct:4 step 1: 35% of the download is 1400; the file's size (4000) is the question, and is not drawn
    const first = CONTENT['pct:4'].discover[0] as { fig: FigSpec };
    const html = renderToStaticMarkup(createElement(Figure, { fig: first.fig }));
    expect(html).toMatch(/>1400</);
    expect(html).not.toMatch(/>4,?000</); // no text of the drawing says it
    expect(html.match(/aria-label="([^"]*)"/)![1]).not.toMatch(/4,?000/); // nor its words for a screen reader
  });
});

// The checks above are what keeps the algebra stairs honest before they exist: each is shown here to pass a right
// fixture and to fail a broken one, so a check that silently passes everything cannot slip in.
describe('the algebra checks catch what they are for', () => {
  const explore = (manip: any, answer: unknown, display?: string): DiscoverStep => ({ kind: 'explore', text: 'נסו', display, manip, answer, hint: 'רמז', success: 'יפה' });
  const ok = (st: DiscoverStep) => expect(() => checkSteps([st], 'fixture')).not.toThrow();
  const bad = (st: DiscoverStep) => expect(() => checkSteps([st], 'fixture')).toThrow();
  it('a balance: level, solvable, not by one pan, and its equation', () => {
    ok(explore({ kind: 'balance', start: { lx: 3, l1: 5, rx: 1, r1: 11 } }, 3, '3x + 5 = x + 11'));
    ok(explore({ kind: 'balance', start: { lx: 1, l1: 5, rx: 0, r1: 12 } }, 7, 'x + 5 = 12'));
    bad(explore({ kind: 'balance', start: { lx: 1, l1: 5, rx: 0, r1: 12 } }, 6)); // not level at 6
    bad(explore({ kind: 'balance', start: { lx: 1, l1: 5, rx: 0, r1: 12 } }, 7, 'x + 5 = 13')); // not this scale
    bad(explore({ kind: 'balance', start: { lx: 1, l1: 0, rx: 0, r1: 7 } }, 7)); // already solved
    bad(explore({ kind: 'balance', start: { lx: 1, l1: 9, rx: 0, r1: 16 } }, 7, 'x + 9 = 16')); // 16 weights on a pan
  });
  it('tiles: they collect to the answer and there is something to remove', () => {
    ok(explore({ kind: 'tiles', start: { px: 3, nx: 1, p1: 2, n1: 5 } }, { k: 2, c: -3 }, '3x - x + 2 - 5'));
    bad(explore({ kind: 'tiles', start: { px: 3, nx: 1, p1: 2, n1: 5 } }, { k: 2, c: 3 }));
    bad(explore({ kind: 'tiles', start: { px: 2, nx: 0, p1: 0, n1: 3 } }, { k: 2, c: -3 })); // nothing to do
    bad(explore({ kind: 'tiles', start: { px: 3, nx: 1, p1: 2, n1: 5 } }, { k: 2, c: -3 }, '3x + x + 2 - 5'));
  });
  it('a rectangle: reachable, not the start, and the display is a(x + b)', () => {
    ok(explore({ kind: 'area', start: { a: 1, b: 0 } }, { a: 3, b: 4 }, '3(x + 4)'));
    bad(explore({ kind: 'area', start: { a: 3, b: 4 } }, { a: 3, b: 4 }));
    bad(explore({ kind: 'area', start: { a: 1, b: 0 } }, { a: 7, b: 4 }));
    bad(explore({ kind: 'area', start: { a: 1, b: 0 } }, { a: 3, b: 4 }, '3x + 4'));
  });
  it('a ray: the inequality shown has exactly the ray as its solutions', () => {
    ok(explore({ kind: 'ray', min: -10, max: 10, start: { at: 0, dir: 1, closed: false } }, { at: 4, dir: -1, closed: true }, '2x + 1 \\le 9'));
    ok(explore({ kind: 'ray', start: { at: 0, dir: 1, closed: false } }, { at: -3, dir: -1, closed: false }, '-2x > 6'));
    bad(explore({ kind: 'ray', start: { at: 0, dir: 1, closed: false } }, { at: -3, dir: 1, closed: false }, '-2x > 6')); // not flipped
    bad(explore({ kind: 'ray', start: { at: 0, dir: 1, closed: false } }, { at: -3, dir: -1, closed: true }, '-2x > 6')); // the boundary
    bad(explore({ kind: 'ray', start: { at: 4, dir: -1, closed: true } }, { at: 4, dir: -1, closed: true }));
  });
  it('a cut number line: the goal is a whole number of parts, and the display is its value', () => {
    ok(explore({ kind: 'numberline', min: 0, max: 2, from: 0, start: 0, den: 3 }, 5 / 3, '\\frac{5}{3}'));
    ok(explore({ kind: 'numberline', min: 0, max: 1, from: 0, start: 0, den: 20, fmt: 'dec' }, 0.35, '0.35'));
    bad(explore({ kind: 'numberline', min: 0, max: 2, from: 0, start: 0, den: 3 }, 1.6)); // not on a third
    bad(explore({ kind: 'numberline', min: 0, max: 2, from: 0, start: 0, den: 3 }, 5 / 3, '\\frac{4}{3}'));
    bad(explore({ kind: 'numberline', min: 0, max: 2, from: 0, start: 5 / 3, den: 3 }, 5 / 3));
    ok(explore({ kind: 'pins', min: 0, max: 1, den: 20, labels: ['0.4', '0.25'], start: [0, 0] }, [0.4, 0.25]));
    bad(explore({ kind: 'pins', min: 0, max: 1, den: 20, labels: ['0.4', '0.33'], start: [0, 0] }, [0.4, 0.33]));
  });
  it('a fraction bar: the goal can be built within maxDen, and the start is not it', () => {
    ok(explore({ kind: 'fbar', start: { den: 3, shaded: 2 }, marks: [2 / 3] }, { mode: 'exact', den: 12, shaded: 8 }));
    ok(explore({ kind: 'fbar', start: { den: 1, shaded: 0 } }, { mode: 'value', value: 3 / 4 }));
    ok(explore({ kind: 'fbar', start: { den: 1, shaded: 0 }, marks: [1 / 3, 1 / 4] }, { mode: 'common', of: [3, 4] }));
    bad(explore({ kind: 'fbar', start: { den: 1, shaded: 0 } }, { mode: 'value', value: 1 / 25 })); // 25 parts
    bad(explore({ kind: 'fbar', start: { den: 1, shaded: 0 }, maxDen: 10 }, { mode: 'common', of: [3, 4] }));
    bad(explore({ kind: 'fbar', start: { den: 8, shaded: 0 }, lockDen: true }, { mode: 'value', value: 1 / 3 })); // not in eighths
    bad(explore({ kind: 'fbar', start: { den: 4, shaded: 3 } }, { mode: 'value', value: 3 / 4 })); // starts on the goal
  });
  it('a double line: the goal is a multiple of its step, on the line, reached in steps', () => {
    const top = { max: 100, step: 10, unit: '%', label: 'אחוזים' };
    ok(explore({ kind: 'dline', top, bottom: { max: 240, step: 24, unit: '₪', label: 'מחיר' }, move: 't', start: { t: 0 } }, 30));
    const top5 = { ...top, step: 5, every: 2 };
    ok(explore({ kind: 'dline', top: top5, bottom: { max: 6000, step: 100, unit: 'MB', label: 'גודל' }, move: 'max', fixT: 35, start: { t: 35, max: 1000 } }, 4000));
    bad(explore({ kind: 'dline', top, bottom: { max: 6000, step: 100 }, move: 'max', fixT: 35, start: { t: 35, max: 1000 } }, 4000)); // 35 is between ticks of 10
    bad(explore({ kind: 'dline', top, bottom: { max: 240, step: 24 }, move: 't', start: { t: 0 } }, 35)); // not on a step
    bad(explore({ kind: 'dline', top, bottom: { max: 240, step: 24 }, move: 't', start: { t: 0 } }, 110)); // off the line
    bad(explore({ kind: 'dline', top: top5, bottom: { max: 6000, step: 100 }, move: 'max', fixT: 35, start: { t: 35, max: 1050 } }, 4000)); // not in steps
    bad(explore({ kind: 'dline', top: top5, bottom: { max: 6000, step: 100 }, move: 'max', fixT: 35, start: { t: 35, max: 4000 } }, 4000)); // starts on it
  });
  it('two lines: the goal is their meeting point', () => {
    ok(explore({ kind: 'plot', lines: [{ m: 2, b: -1 }, { m: -1.5, b: 6 }] }, [2, 3]));
    bad(explore({ kind: 'plot', lines: [{ m: 2, b: -1 }, { m: -1, b: 6 }] }, [2, 3]));
  });
  const ex = (steps: any[], extra: Partial<WorkedExample> = {}): WorkedExample => ({ problem: 'פשטו', answer: 0, check: '0', steps, ...extra });
  const exOk = (e: WorkedExample) => expect(() => checkExample(e, 0)).not.toThrow();
  const exBad = (e: WorkedExample) => expect(() => checkExample(e, 0)).toThrow();
  const st = (result: string, extra: object) => ({ action: 'עושים', why: 'כי', result, ...extra });
  it('an expression rewritten step by step stays the same expression', () => {
    const base = { expr: '3*(x-2) - (x+4)', answerTex: '2x - 10', answer: -6, check: '3*(2-2) - (2+4)' };
    exOk(ex([st('3x - 6 - x - 4', { ident: '3*x - 6 - x - 4' }), st('2x - 10', { ident: '2*x - 10' })], base));
    exBad(ex([st('3x - 6 - x + 4', { ident: '3*x - 6 - x + 4' }), st('2x - 2', { ident: '2*x - 2' })], base)); // the minus bracket
    exBad(ex([st('3x - 6 - x - 4', { ident: '3*x - 6 - x - 4' }), st('2x - 2', { ident: '2*x - 10' })], base)); // the TeX shown is wrong
  });
  it('an equation solved step by step keeps exactly its solution', () => {
    const base = { answer: 4, check: '4' };
    exOk(ex([st('7x - 3 = 4x + 9', { eq: '7*x - 3 = 4*x + 9' }), st('3x = 12', { eq: '3*x = 12' }), st('x = 4', { eq: 'x = 4' })], base));
    exBad(ex([st('7x - 3 = 4x + 9', { eq: '7*x - 3 = 4*x + 9' }), st('3x = 6', { eq: '3*x = 6' })], base)); // moved without changing the sign
    exBad(ex([st('7x - 3 = 4x + 9', { eq: '7*x - 3 = 4*x + 9' }), st('0 = 0', { eq: '0*x = 0' })], base)); // lost the unknown
    exBad(ex([st('7x - 3 = 4x + 9', { eq: '7*x - 3 = 4*x + 9' }), st('3x = 10', { eq: '3*x = 12' })], base)); // the TeX shown is wrong
  });
  it('an inequality solved step by step keeps exactly its solutions', () => {
    const base = { answer: 5, check: '5', ray: { at: 4, dir: 1 as const, closed: false } };
    exOk(ex([st('2x - 3 > 5', { ineq: '2*x - 3 > 5' }), st('x > 4', { ineq: 'x > 4' })], base));
    exBad(ex([st('2x - 3 > 5', { ineq: '2*x - 3 > 5' }), st('x \\ge 4', { ineq: 'x ≥ 4' })], base)); // the boundary taken
    exBad(ex([st('-2x < -8', { ineq: '-2*x < -8' }), st('x < 4', { ineq: 'x < 4' })], base)); // divided by a negative without flipping
    exBad(ex([st('2x > 8', { ineq: '2*x > 8' }), st('x < 4', { ineq: 'x > 4' })], base)); // the TeX shown is wrong
  });
  it('a system checks every equation at both unknowns', () => {
    const base = { answer: 3, check: 'x', vars: { x: 3, y: 6 } };
    exOk(ex([st('y = 2x', { eq: 'y = 2*x' }), st('x + 2x = 9', { eq: 'x + 2*x = 9' })], base));
    exBad(ex([st('y = 2x', { eq: 'y = 2*x' }), st('x + 2x = 8', { eq: 'x + 2*x = 8' })], base));
  });
});

// CLASSROOM-1 and -2: the book's order in signed:1, the class's chains in its two steps, absolute value and opposites
describe('the real classroom: signed:1 and signed:2', () => {
  const s1 = CONTENT['signed:1'];
  const s2 = CONTENT['signed:2'];
  const words = (st: DiscoverStep) => JSON.stringify(st);
  it('signed:1 teaches in the book\'s order: the line, absolute value as arrows, adding, opposites, subtracting', () => {
    const at = (pred: (st: DiscoverStep) => boolean) => s1.discover.findIndex(pred);
    const arrows = at((st) => words(st).includes('הערך המוחלט') && words(st).includes('\\\\lvert'));
    const adding = at((st) => st.kind === 'explore' && /\+/.test(st.display || ''));
    const opposites = at((st) => st.kind === 'rule' && st.text.includes('נגדיים'));
    const subtracting = at((st) => st.text.startsWith('ומה עם חיסור?'));
    expect(arrows).toBe(1);
    expect(arrows < adding && adding < opposites && opposites < subtracting, `${arrows} ${adding} ${opposites} ${subtracting}`).toBe(true);
    // the word "the opposite" is never used before the step that teaches it
    s1.discover.slice(0, opposites).forEach((st, i) => expect(words(st), `step ${i + 1} says הנגדי before the opposites rule`).not.toContain('הנגדי'));
    expect(words(s1.discover[opposites + 1])).toContain('מה הנגדי של $-17$?');
  });
  it('signed:2 asks which is bigger and which is farther from zero, after its comparison rule', () => {
    const rule = s2.discover.findIndex((st) => st.kind === 'rule');
    const both = s2.discover.findIndex((st) => st.kind === 'predict' && st.text.includes('\\lvert -9 \\rvert'));
    expect(rule).toBeGreaterThanOrEqual(0);
    expect(both).toBeGreaterThan(rule);
  });
  it('the chains\' worked examples are the class\'s two steps, and every step evaluates', () => {
    const chains = s1.examples.filter((e) => /\(\+/.test(e.display || ''));
    expect(chains.map((e) => e.answer)).toEqual([-12, -17]);
    chains.forEach((e, k) => checkExample(e, k));
    const said = JSON.stringify(chains);
    for (const w of ['מורידים סוגריים', 'השליליים יחד', 'החיוביים יחד', 'מחסרים $0$: לא משתנה כלום']) expect(said).toContain(w);
    expect(evaluate(chains[0].check)).toBe(-12);
    expect(evaluate(chains[1].check)).toBe(-17);
  });
  it('the chain in signed:1\'s model: a quarter of the draws, and each of its mistakes shows (spec 100%, 97%, 52%)', () => {
    const rnd = seeded(2026);
    const fired: Record<string, number> = {}; let chains = 0;
    for (let i = 0; i < 4000; i += 1) {
      const p = s1.diag.params(rnd);
      if (p.f !== 2) continue;
      chains += 1;
      const ans = s1.diag.answer(p);
      Object.entries(s1.diag.bugs).forEach(([id, f]) => { const v = f(p); if (v != null && !same(v, ans)) fired[id] = (fired[id] || 0) + 1; });
    }
    expect(chains / 4000).toBeGreaterThan(0.2);
    expect(chains / 4000).toBeLessThan(0.3);
    expect(fired['minus-minus']).toBe(chains);
    expect(fired.sign / chains).toBeGreaterThan(0.9);
    expect(fired['drop-sign'] / chains).toBeGreaterThan(0.4);
    for (const id of ['abs-add', 'neg-neg-plus', 'direction']) expect(fired[id] || 0, id).toBe(0);
  });
  it('absolute value and opposites each show on more than 4% of signed:2\'s model draws', () => {
    const rnd = seeded(2027);
    const fired: Record<string, number> = {};
    for (let i = 0; i < DRAWS * 5; i += 1) {
      const p = s2.diag.params(rnd); const ans = s2.diag.answer(p);
      Object.entries(s2.diag.bugs).forEach(([id, f]) => { const v = f(p); if (v != null && !same(v, ans)) fired[id] = (fired[id] || 0) + 1; });
    }
    expect(fired['abs-keep-sign'] / (DRAWS * 5)).toBeGreaterThan(0.04);
    expect(fired['opp-same'] / (DRAWS * 5)).toBeGreaterThan(0.04);
    expect(s2.misconceptions.map((m) => m.id)).toEqual(expect.arrayContaining(['abs-keep-sign', 'opp-same']));
    // each remedy draws: an arrow from 0 for the absolute value, two marks at one distance for the opposite
    for (const id of ['abs-keep-sign', 'opp-same']) expect(s2.misconceptions.find((m) => m.id === id)!.remedy.some((st) => (st as { fig?: FigSpec }).fig?.type === 'numline'), id).toBe(true);
  });
});

// CLASSROOM-3 and -4: dividing with 0 and 1 on signed:3, brackets inside brackets on signed:5
describe('the real classroom: signed:3 and signed:5', () => {
  const s3 = CONTENT['signed:3'];
  const s5 = CONTENT['signed:5'];
  it('signed:3 teaches 0 : a, a : 0, a : 1 and a : (−1) after its division rule, with no value for a : 0', () => {
    const division = s3.discover.findIndex((st) => st.kind === 'rule' && st.text.includes('בחילוק אותו כלל סימנים'));
    const zero = s3.discover.findIndex((st) => st.kind === 'rule' && st.text.includes('לא מוגדר'));
    expect(division).toBeGreaterThanOrEqual(0);
    expect(zero).toBe(division + 1);
    const st = s3.discover[zero] as Extract<DiscoverStep, { kind: 'rule' }>;
    expect(st.display).not.toMatch(/: 0(?!\d)/); // the undefined part is said in words, never computed
    expect(evaluate('0 : (-6)') + 0).toBe(0); // written 0, not −0
    expect([evaluate('(-6) : 1'), evaluate('(-6) : (-1)')]).toEqual([-6, 6]);
    for (const id of ['div-zero', 'zero-div']) {
      const m = s3.misconceptions.find((x) => x.id === id)!;
      expect(m, id).toBeTruthy();
      expect(JSON.stringify(m.remedy), id).toContain('בודקים בכפל');
    }
  });
  it('every mistake a signed:5 exercise can name has a repair on the stair, so a repair always finds its remedy', () => {
    const named = new Set<string>();
    for (let i = 0; i < 400; i += 1) namesOf(makeItem('signed', 5)).forEach((id: string) => named.add(id));
    const own = new Set(s5.misconceptions.map((m) => m.id));
    expect([...named].filter((id) => !own.has(id))).toEqual([]);
    for (const id of ['factor-sign', 'sign', 'minus-minus', 'order', 'ignore-brackets', 'minus-bracket']) expect(named.has(id), id).toBe(true);
  });
  it('the nested-brackets rule and its two worked examples are in the class\'s words, and every step evaluates', () => {
    const rule = s5.discover.findIndex((st) => st.kind === 'rule' && st.text.includes('סוגריים בתוך סוגריים'));
    expect(rule).toBe(s5.discover.length - 1);
    for (const w of ['סוגריים הפנימיים', 'סוגריים החיצוניים', 'עם הסימן שלו']) expect(s5.discover[rule].text).toContain(w);
    const nested = s5.examples.filter((e) => /\d\[/.test(e.display || ''));
    expect(nested.map((e) => e.answer)).toEqual([-51, 18]);
    nested.forEach((e, k) => checkExample(e, k));
    expect(evaluate('-3[12 - (2 - 7)]')).toBe(-51);
    expect(evaluate('30 - 4[-3 - (8 - 2)*(-1)]')).toBe(18);
  });
  it('factor-sign shows on a fair share of the shapes a[b − (c − d)] and e − a[b − (c − d)·g] (spec 41%), and in the model', () => {
    const rnd = seeded(2028);
    let n = 0; let fs = 0;
    for (let i = 0; i < 4000; i += 1) {
      const q = drawNested(rnd, rnd() < 0.6 ? 1 : 2); n += 1;
      const v = nestedBugs(q)['factor-sign']; if (v != null && !same(v, nestedValue(q))) fs += 1;
    }
    expect(fs / n).toBeGreaterThan(0.3);
    const r2 = seeded(2029); let f2 = 0;
    for (let i = 0; i < DRAWS * 5; i += 1) { const p = s5.diag.params(r2); const v = s5.diag.bugs['factor-sign'](p); if (v != null && !same(v, s5.diag.answer(p))) f2 += 1; }
    expect(f2 / (DRAWS * 5)).toBeGreaterThan(0.04);
  });
});

// CLASSROOM-5: the new stair signed:7, powers of directed numbers, taught in the class's written form
describe('the real classroom: signed:7, powers of directed numbers', () => {
  const s7 = CONTENT['signed:7'];
  const step = (pred: (st: DiscoverStep) => boolean) => s7.discover.findIndex(pred);
  it('teaches in the spec\'s order: the meaning, (−5)², the predict, the rule, odd and even, then the decimal', () => {
    const meaning = step((st) => st.kind === 'say' && st.text.includes('הבסיס') && st.text.includes('המעריך'));
    const sq = step((st) => st.kind === 'say' && (st.display || '') === '(-5)^2 = (-5)(-5) = +25 = 25');
    const predict = step((st) => st.kind === 'predict' && st.choices[st.answer] === '$25$ ו־$-25$');
    const rule = step((st) => st.kind === 'rule' && st.text.includes('המעריך שייך למה שצמוד אליו'));
    const parity = step((st) => st.kind === 'rule' && st.text.includes('מעריך זוגי'));
    const decimal = step((st) => st.kind === 'predict' && (st.display || '') === '(-0.3)^3');
    expect([meaning, sq, predict, rule, parity, decimal]).toEqual([0, 1, 2, 3, 4, 6]);
    expect((s7.discover[0] as Extract<DiscoverStep, { kind: 'say' }>).display).toBe('2^5 = 2 \\cdot 2 \\cdot 2 \\cdot 2 \\cdot 2 = 32');
    expect((s7.discover[rule] as Extract<DiscoverStep, { kind: 'rule' }>).display).toBe('-5^2 = (-5 \\cdot 5) = -25');
    // the odd and even rule links to signed:3's many negative factors, and says only an even exponent shows the difference
    expect((s7.discover[parity] as Extract<DiscoverStep, { kind: 'rule' }>).why).toContain('כל זוג מינוסים נותן פלוס');
    expect((s7.discover[parity] as Extract<DiscoverStep, { kind: 'rule' }>).why).toContain('רק מעריך זוגי');
    expect((s7.discover[decimal] as Extract<DiscoverStep, { kind: 'predict' }>).choices[0]).toBe('$-0.027$');
    // every step shows a picture: the factors as tiles side by side, or the number line
    s7.discover.forEach((st, i) => expect(!!((st as { fig?: unknown }).fig || (st as { manip?: unknown }).manip), `step ${i}`).toBe(true));
    // pow-odd-pos repairs through signed:3, where many negative factors are taught (neg-many); order through signed:4
    expect(s7.misconceptions.find((m) => m.id === 'pow-odd-pos')!.prereq).toBe('signed:3');
    expect(s7.misconceptions.find((m) => m.id === 'order')!.prereq).toBe('signed:4');
  });
  it('the app\'s evaluator gives every value the teaching writes', () => {
    const facts: [string, number][] = [['2^5', 32], ['(-5)^2', 25], ['(-5)*(-5)', 25], ['-5^2', -25], ['-(5*5)', -25], ['(-3)^4', 81], ['-3^4', -81],
      ['(-4)^3', -64], ['-4^3', -64], ['-(-5)^2', -25], ['-(-5^2)', 25], ['9 - 2*(-3)^3', 63], ['(-0.3)^3', -0.027], ['(-3/4)^2', 9 / 16],
      ['(-2)^2 - 9', -5], ['(-3/4)^3', -27 / 64], ['(-1.2)^2', 1.44], ['-2^4', -16], ['5 - 4*(-2)^2', -11]];
    facts.forEach(([e, v]) => expect(same(evaluate(e), v), e).toBe(true));
    // the F4 example's mistakes: left to right −189, the odd power taken as positive −45, the base times the exponent 27
    expect(powBugs({ f: 4, a: 3, n: 3, b: 9, c: 2 })).toEqual({ order: -189, 'pow-odd-pos': -45, 'pow-times': 27 });
    s7.examples.forEach((ex, k) => checkExample(ex, k));
    expect(s7.examples.map((e) => e.answer)).toEqual([-25, 25, 63]);
  });
  it('every mistake shows on more than 4% of the draws of its form and of the model\'s, and pow-keep-sign on about 15% of the checks (spec 15.2%)', () => {
    const rnd = seeded(2030);
    const FORMS: Record<number, string[]> = { 0: ['pow-odd-pos', 'pow-keep-sign', 'pow-times'], 1: ['pow-neg-base', 'pow-times'], 2: ['outer-minus', 'pow-times'],
      3: ['outer-minus', 'pow-times'], 4: ['order', 'pow-odd-pos', 'pow-times'], 5: ['pow-odd-pos', 'pow-times', 'dec-places', 'num-only'], 6: ['pow-times'] };
    for (const [f, ids] of Object.entries(FORMS)) {
      const shown: Record<string, number> = {};
      for (let i = 0; i < 1000; i += 1) {
        const q = drawPow(rnd, Number(f)); const ans = powValue(q);
        Object.entries(powBugs(q) as Record<string, number | null>).forEach(([id, v]) => { if (v != null && !same(v, ans)) shown[id] = (shown[id] || 0) + 1; });
      }
      expect(Object.keys(shown).sort(), `F${f}`).toEqual([...ids].sort());
      ids.forEach((id) => expect(shown[id] / 1000, `F${f} ${id}`).toBeGreaterThan(0.04));
    }
    // the model's own draws
    const shownM: Record<string, number> = {};
    const r2 = seeded(2031);
    for (let i = 0; i < 4000; i += 1) {
      const p = s7.diag.params(r2); const ans = s7.diag.answer(p);
      Object.entries(s7.diag.bugs).forEach(([id, b]) => { const v = b(p); if (v != null && !same(v, ans)) shownM[id] = (shownM[id] || 0) + 1; });
    }
    Object.keys(s7.diag.bugs).forEach((id) => expect(shownM[id] / 4000, `model ${id}`).toBeGreaterThan(0.04));
    // the checks' mix (F0-F5 in the exercises' shares; F6, a positive base, never reaches a check)
    const r3 = seeded(2032); let keep = 0; const N = 8000;
    for (let i = 0; i < N; i += 1) {
      let f: number; do { const y = r3(); let acc = 0; f = (POW_MIX as [number, number][]).find(([, w]) => (acc += w) > y)![0]; } while (f === 6);
      const q = drawPow(r3, f); if (powBugs(q)['pow-keep-sign'] != null) keep += 1;
    }
    expect(keep / N).toBeGreaterThan(0.12);
    expect(keep / N).toBeLessThan(0.19);
  });
  it('a question never has a mistake that predicts the answer, two mistakes on one value, or a slip, and F6 never reaches a check', () => {
    const rnd = seeded(2033);
    for (let i = 0; i < 3000; i += 1) {
      const q = drawPow(rnd); const ans = powValue(q);
      const vals = Object.values(powBugs(q) as Record<string, number | null>).filter((v): v is number => v != null);
      vals.forEach((v) => expect(same(v, ans), JSON.stringify(q)).toBe(false));
      expect(new Set(vals.map((v) => v.toFixed(6))).size, JSON.stringify(q)).toBe(vals.length);
    }
    for (let i = 0; i < 300; i += 1) { const it = makeItem('signed', 7); expect(fairForCheck(it), it.key).toBe(!it.key.startsWith('sn7:6:')); }
  });
});

// CLASSROOM-6: collecting the class's way on expr:3. The diagnostic model keeps every mistake above 4% of its draws (the
// checks' typed questions); the teaching names the families, adds the table of bracketed x-terms after the rule, and
// explains abs-add and sign; a generated solution marks the families and keeps "0x" when the x-terms cancel.
describe('expr:3, collecting the class\'s way (CLASSROOM-6)', () => {
  const s3 = CONTENT['expr:3'];
  it('collectModel keeps every bug above 4% of its draws', () => {
    const rnd = seeded(2061); const shown: Record<string, number> = {}; const N = 4000;
    for (let i = 0; i < N; i += 1) {
      const p = s3.diag.params(rnd); const ans = s3.diag.answer(p);
      Object.entries(s3.diag.bugs).forEach(([id, b]) => { const v = b(p); if (v != null && !same(v, ans)) shown[id] = (shown[id] || 0) + 1; });
    }
    expect(Object.keys(shown).sort()).toEqual(['conjoin', 'detach', 'drop-minus']);
    Object.keys(s3.diag.bugs).forEach((id) => expect(shown[id] / N, id).toBeGreaterThan(0.04));
  });
  it('the rule names the families, and the table of bracketed x-terms follows it', () => {
    const i = s3.discover.findIndex((st) => st.kind === 'rule' && st.text.includes('"משפחות"'));
    expect(i).toBeGreaterThan(0);
    const table = s3.discover[i + 1] as Extract<DiscoverStep, { kind: 'rule' }> & { fig: { type: string; head: string[]; rows: string[][] } };
    expect(table.fig.type).toBe('table');
    expect(table.fig.head).toEqual(['מספרים', 'עם x']);
    expect(table.text).toBe('אותו כלל כמו בחיבור מספרים מכוונים: הסימן של הרחוק מאפס בחוץ, ובסוגריים הגדול פחות הקטן.');
    // each sum and the row under it, read back (x as 1): (+4) + (−11) = −7 and −7x, (−6) + (+5) = −1 and −x
    const read = (t: string) => evaluate(t.replace(/−/g, '-').replace(/=/g, '').replace(/(\d)x/g, '$1').replace(/x/g, '1'));
    const rows = table.fig.rows;
    expect([0, 1, 2, 3].map((r) => [read(rows[r][0]), read(rows[r][1])])).toEqual([[-7, -7], [-7, -7], [-1, -1], [-1, -1]]);
    expect(identical(texToExpr('(+4x) + (-11x)'), '-7*x')).toBe(true);
    expect(['abs-add', 'sign'].every((id) => s3.misconceptions.some((m) => m.id === id && m.prereq === 'signed:1'))).toBe(true);
  });
  it('a generated solution marks the families, regroups them under braces, and keeps 0x when the x-terms cancel', () => {
    let zero = 0;
    for (let i = 0; i < 600; i += 1) {
      const it = makeItem('expr', 3);
      if (!String(it.key).startsWith('ex3:')) continue;
      const [first, second] = it.solution as string[];
      expect(first, it.key).toContain('\\underline{\\underline{');
      expect(second, it.key).toContain('\\underbrace{');
      if (it.answer.k === 0) { zero += 1; expect(it.solution.join(' '), it.key).toContain(`$0${it.var || 'x'} `); }
    }
    expect(zero).toBeGreaterThan(0);
  });
});

// CLASSROOM-8: the class's word problems on eq:5. The story model (the checks' questions) keeps every mistake above 4% of its
// draws, the rectangle among them; the mix keeps every kind above 4% of the stair's questions; the two new worked examples
// are the spec's (x 11, d 5, P 54 → 11, 16, 176, the last step drawing the lengths; d 5, T 31 → 13 and box B 18).
describe('eq:5, the class\'s word problems (CLASSROOM-8)', () => {
  const s5 = CONTENT['eq:5'];
  it('the story model keeps every mistake above 4% of its draws, the rectangle\'s two-sides and add-sides among them', () => {
    const rnd = seeded(2081); const shown: Record<string, number> = {}; const N = 4000;
    for (let i = 0; i < N; i += 1) {
      const p = s5.diag.params(rnd); const ans = s5.diag.answer(p);
      Object.entries(s5.diag.bugs).forEach(([id, b]) => { const v = b(p); if (v != null && !same(v, ans)) shown[id] = (shown[id] || 0) + 1; });
    }
    expect(Object.keys(shown).sort()).toEqual(['add-sides', 'partial-dist', 'two-sides', 'wrong-unknown']);
    Object.keys(s5.diag.bugs).forEach((id) => expect(shown[id] / N, id).toBeGreaterThan(0.04));
  });
  it('every kind of the stair\'s mix is above 4% of its questions, and the mix adds up', () => {
    expect(STORY_MIX.reduce((a: number, [w]: [number]) => a + w, 0)).toBeCloseTo(1, 9);
    STORY_MIX.forEach(([w]: [number]) => expect(w).toBeGreaterThan(0.04));
    const kinds: Record<string, number> = {}; const N = 6000; const rnd = seeded(2082);
    for (let i = 0; i < N; i += 1) { const it = storyMix(rnd()); const k = String(it.key).split(':')[0]; kinds[k] = (kinds[k] || 0) + 1; }
    ['eq5s', 'eq5a', 'eq5w', 'eq5t', 'eq5b', 'eq5c', 'eq5r', 'eq5x', 'eq5y', 'eq5g', 'eq5p'].forEach((k) => expect((kinds[k] || 0) / N, k).toBeGreaterThan(0.04));
  });
  it('the rectangle and the transfer are worked in the class\'s layout', () => {
    const rect = s5.examples.find((e) => e.problem.includes('$54$'))!;
    expect([rect.answer, rect.vars]).toEqual([176, { x: 11 }]);
    expect(rect.steps.map((st) => st.result)).toContain('\\boxed{x + 5} = 11 + 5 = 16');
    const last = rect.steps[rect.steps.length - 1] as { fig?: { segs: { label?: string }[] } };
    expect(last.fig!.segs.map((sg) => sg.label).filter(Boolean)).toEqual(['16 ס״מ', '11 ס״מ']);
    expect(rect.steps[0].action).toContain('צ״ל');
    const tr = s5.examples.find((e) => e.problem.includes('$31$'))!;
    expect([tr.answer, tr.vars]).toEqual([18, { x: 13 }]);
    expect((tr.fig as { head: string[]; rows: string[][] }).head).toEqual(['', 'לפני ההעברה', 'אחרי ההעברה']);
    expect((tr.fig as { rows: string[][] }).rows[1][2]).toBe('x + 5 + x = 2x + 5');
    [rect, tr].forEach((ex, k) => checkExample(ex, k));
    // the students and teachers are t and m: in this class S is an area and P a perimeter
    expect(JSON.stringify(s5.discover)).not.toMatch(/S = 6P|6S = P/);
  });
});

// CURRICULUM-10: a check's angle questions take two steps. The stairs' new worked examples solve such a question in two
// written steps, and the models' check params (testParams) never ask what a copied number, or 180°, 90° or 360° minus
// one, answers; their mistakes still show, and practice keeps the one-step kinds too.
describe('the angle stairs: two-step checks and their worked examples', () => {
  const geoSweep = (P: Record<string, [number, number]>, g: { at: string; from: string; to: string }) => {
    const v = P[g.at]; const f = P[g.from]; const t = P[g.to];
    let d = ((Math.atan2(t[1] - v[1], t[0] - v[0]) - Math.atan2(f[1] - v[1], f[0] - v[0])) * 180) / Math.PI;
    while (d <= 0) d += 360;
    return d;
  };
  it.each([['angles:2', 110, 55], ['angles:4', null, 60]] as const)('%s: a two-step example in two written steps, then a check', (skill, first, answer) => {
    const c = CONTENT[skill];
    const ex = c.examples.find((e) => /^שלב 1/.test(e.steps[0].action))!;
    expect(ex, `${skill} has no two-step example`).toBeTruthy();
    expect(ex.answer).toBe(answer);
    // two solving steps, named שלב 1 and שלב 2, the second reaching the answer; the third checks it another way
    expect(ex.steps.map((s) => s.action.slice(0, 5))).toEqual(['שלב 1', 'שלב 2', 'בודקי']);
    if (first != null) expect(ex.steps[0].calc?.value).toBe(first);
    expect(same(evaluate(ex.steps[1].value!), answer)).toBe(true);
    expect(ex.steps[2].calc?.value).toBe(180);
    // its drawing: the '?' drawn the size of the answer, every given angle its size
    const f = ex.fig as { pts: Record<string, [number, number]>; angles: { at: string; from: string; to: string; text?: string; target?: boolean }[] };
    const target = f.angles.find((g) => g.target)!;
    expect(Math.abs(geoSweep(f.pts, target) - answer)).toBeLessThan(0.6);
    f.angles.filter((g) => /°$/.test(g.text || '')).forEach((g) => expect(Math.abs(geoSweep(f.pts, g) - parseFloat(g.text!))).toBeLessThan(0.6));
    expect(renderToStaticMarkup(createElement(Figure, { fig: ex.fig }))).not.toMatch(/NaN|undefined|Infinity/);
  });
  const withCheck = stairs.flatMap((c) => [['diag', c.diag], ['transfer', c.transfer]].filter(([, m]) => (m as DiagModel<any> | undefined)?.testParams).map(([n, m]) => [`${c.skill} ${n}`, c, m] as const));
  it('the angle stairs 1 to 4 have check params on each model that needed them', () => {
    expect(withCheck.map(([n]) => n)).toEqual(['angles:1 diag', 'angles:1 transfer', 'angles:2 diag', 'angles:2 transfer', 'angles:3 diag', 'angles:4 diag', 'angles:4 transfer']);
  });
  it.each(withCheck)('%s: a check question is never a copied number, nor 180°, 90° or 360° minus one, and its mistakes still show', (_n, c, model) => {
    const m = model as DiagModel<any>; const rnd = seeded(31);
    const fired: Record<string, number> = {};
    for (let i = 0; i < 2000; i += 1) {
      const p = m.testParams!(rnd); const ans = m.answer(p);
      const printed = (String(m.text(p)).replace(/\\[a-zA-Z]+/g, ' ').match(/\d+(\.\d+)?/g) || []).map(Number);
      // a right triangle's 90° is no copy: the drawing never prints it, and 90 − a is the skill there (one in ten checks)
      if (!(c.skill === 'angles:3' && p.k === 1)) expect(printed.flatMap((n) => [n, 180 - n, 90 - n, 360 - n]).some((g) => same(g, ans)), `${c.skill} ${JSON.stringify(p)}`).toBe(false);
      Object.entries(m.bugs).forEach(([id, f]) => { const v = f(p); if (v != null && Number.isFinite(v) && !same(v, ans)) fired[id] = (fired[id] || 0) + 1; });
      expect(m.solution(p).join(' ')).toContain(String(ans));
    }
    expect(Object.values(fired).some((n) => n > 2000 * 0.04), c.skill).toBe(true);
  });
});

// CLASSROOM-9: the class writes an angle ∢AOB (\sphericalangle), never ∠. No stair's teaching, models (their questions,
// hints and solutions, sampled), challenge or the triangle tool's readout uses the other sign.
describe('the class\'s angle sign, ∢', () => {
  const OLD = /\\angle(?![a-zA-Z])|∠/;
  it('no stair, model, challenge or the drag readout writes ∠', () => {
    const bad: string[] = [];
    for (const c of stairs) {
      if (OLD.test(JSON.stringify(c))) bad.push(`${c.skill} teaching`);
      const rnd = seeded(9);
      for (const [name, m] of [['diag', c.diag], ['transfer', c.transfer]] as const) {
        if (!m) continue;
        for (let i = 0; i < 200; i += 1) {
          const p = m.params(rnd);
          if (OLD.test([m.text(p), m.hint(p), ...m.solution(p)].join(' '))) { bad.push(`${c.skill} ${name} ${JSON.stringify(p)}`); break; }
        }
      }
    }
    if (OLD.test(JSON.stringify(CHALLENGES))) bad.push('challenges');
    const drag = readFileSync(new URL('../components/manip/TriangleDrag.jsx', import.meta.url), 'utf8');
    if (OLD.test(drag)) bad.push('TriangleDrag.jsx');
    expect(bad).toEqual([]);
    // and the angles stairs do write ∢
    expect(JSON.stringify(CONTENT['angles:1'])).toContain('\\\\sphericalangle');
    expect(drag).toContain('∢A');
  });
});

// CLASSROOM-11: the class's way on the split triangle, two helper sketches (שרטוטי עזר), each its own small triangle with
// its own right angle, each line with its reason, then a check in the third triangle
describe('angles:3, the split triangle solved with helper sketches', () => {
  const ex = CONTENT['angles:3'].examples.find((e) => /שרטוט עזר 1/.test(e.steps[0].action))!;
  it('two helper sketches, then a check in the third triangle', () => {
    expect(ex).toBeTruthy();
    expect(ex.answer).toBe(45);
    expect(ex.steps.map((st) => st.action.slice(0, 12))).toEqual(['שרטוט עזר 1:', 'שרטוט עזר 2:', 'בודקים במשול']);
    ex.steps.forEach((st) => expect(st.why).toContain('סכום זוויות ב־$\\Delta$ שווה $180^\\circ$'));
    expect(ex.steps[0].calc).toEqual({ expr: '180 - 90 - 64', value: 26 });
    expect(same(evaluate(ex.steps[1].value!), 45)).toBe(true);
    expect(ex.steps[2].calc).toEqual({ expr: '19 + 116 + 45', value: 180 });
  });
  it('each sketch is its own triangle with its own right angle at C, and the angle it finds marked', () => {
    const sketch = (i: number) => ex.steps[i].fig as unknown as { pts: Record<string, [number, number]>; polys: { pts: string[] }[]; angles: { at: string; right?: boolean; text?: string; target?: boolean }[] };
    const small = sketch(0); const big = sketch(1);
    expect(Object.keys(small.pts).sort()).toEqual(['A', 'C', 'D']);
    expect(Object.keys(big.pts).sort()).toEqual(['A', 'B', 'C']);
    for (const f of [small, big]) {
      expect(f.polys).toHaveLength(1);
      expect(f.angles.some((g) => g.right && g.at === 'C')).toBe(true);
    }
    expect(small.angles.find((g) => g.target)?.text).toBe('α');
    expect(small.angles.some((g) => g.text === '64°')).toBe(true);
    expect(big.angles.find((g) => g.target)?.text).toBe('β');
    expect(big.angles.some((g) => g.text === '45°')).toBe(true);
  });
  it('the notebook\'s β + 64° = 180° has a repair that asks whether the two angles share a vertex', () => {
    const m = CONTENT['angles:3'].misconceptions.find((x) => x.id === 'other-vertex')!;
    expect(m).toBeTruthy();
    expect(m.remedy[0].text).toContain('קודקוד משותף');
    expect((m.remedy[0] as { fig?: { dots?: string[] } }).fig?.dots).toEqual(['B', 'D']);
  });
});

// CLASSROOM-10: the class's worksheet said "OB חוצה זווית ∢AOB", but OB is an arm of ∢AOB (the drawing showed OB halving
// ∢AOD). A text that says a ray halves an angle is checked against itself and its drawing: the ray starts at the angle's
// vertex, it is not one of the angle's arms, and on the drawing its two halves differ by less than 0.5°.
// a statement, not the question "האם $OC$ חוצה את ∢BOD?" (practice's choice, whose answer may be no)
const BISECTS = /(?<!האם )\$([A-Z])([A-Z])\$ חוצה את \$\\sphericalangle ([A-Z])([A-Z])([A-Z])/g;
const between = (P: Record<string, [number, number]>, v: string, a: string, b: string) => {
  const u = [P[a][0] - P[v][0], P[a][1] - P[v][1]]; const w = [P[b][0] - P[v][0], P[b][1] - P[v][1]];
  return (Math.acos((u[0] * w[0] + u[1] * w[1]) / (Math.hypot(u[0], u[1]) * Math.hypot(w[0], w[1]))) * 180) / Math.PI;
};
function bisectorTypos(text: string, fig?: unknown): string[] {
  const out: string[] = [];
  const P = (fig as { pts?: Record<string, [number, number]> } | undefined)?.pts;
  for (const [, v, ray, p, q, r] of String(text).matchAll(BISECTS)) {
    const name = `${v}${ray} חוצה את ∢${p}${q}${r}`;
    if (v !== q) out.push(`${name}: the ray does not start at the vertex ${q}`);
    if (ray === p || ray === r) out.push(`${name}: ${v}${ray} is an arm of the angle, not its bisector`);
    if (P && [p, q, r, ray].every((k) => P[k]) && ray !== p && ray !== r) {
      const one = between(P, q, p, ray); const two = between(P, q, ray, r);
      if (Math.abs(one - two) >= 0.5) out.push(`${name}: drawn ${one.toFixed(1)}° and ${two.toFixed(1)}°`);
    }
  }
  return out;
}
describe('angles:6, a bisector is what its text says (the worksheet\'s typo cannot happen)', () => {
  it('catches the worksheet\'s "OB חוצה זווית ∢AOB", a ray from another vertex, and a drawing that does not halve', () => {
    const P = { O: [0, 0], A: [3, 0], B: [0, 3], C: [2.1213, 2.1213], D: [-3, 0] } as Record<string, [number, number]>;
    expect(bisectorTypos('$OC$ חוצה את $\\sphericalangle AOB$', { pts: P })).toEqual([]);
    expect(bisectorTypos('$OB$ חוצה את $\\sphericalangle AOB$', { pts: P })[0]).toContain('is an arm');
    expect(bisectorTypos('$AC$ חוצה את $\\sphericalangle AOB$', { pts: P })[0]).toContain('does not start at the vertex');
    expect(bisectorTypos('$OB$ חוצה את $\\sphericalangle AOD$', { pts: P })).toEqual([]);
    expect(bisectorTypos('$OC$ חוצה את $\\sphericalangle AOD$', { pts: P })[0]).toContain('drawn 45.0° and 135.0°');
    expect(bisectorTypos('האם $OC$ חוצה את $\\sphericalangle AOD$?', { pts: P })).toEqual([]);
  });
  it('every bisector named in the stairs\' teaching (each step, example, problem and repair) and in 2,000 exercises', () => {
    const bad: string[] = [];
    const seen = { teaching: 0, items: 0, model: 0 };
    for (const c of stairs.filter((x) => x.topic === 'angles')) {
      const steps = [...c.discover, ...c.misconceptions.flatMap((m) => m.remedy)];
      steps.forEach((st, i) => { const t = `${st.text} ${(st as { display?: string }).display || ''}`; if (t.match(BISECTS)) seen.teaching += 1; bad.push(...bisectorTypos(t, (st as { fig?: unknown }).fig).map((x) => `${c.skill} step ${i + 1}: ${x}`)); });
      c.examples.forEach((ex, k) => [ex.problem, ...ex.steps.map((sp) => `${sp.action} ${sp.why}`)].forEach((t, j) => { if (String(t).match(BISECTS)) seen.teaching += 1; bad.push(...bisectorTypos(t, ex.steps[j - 1]?.fig || ex.fig).map((x) => `${c.skill} example ${k + 1}: ${x}`)); }));
      c.together.forEach((g, k) => { if (g.problem.match(BISECTS)) seen.teaching += 1; bad.push(...bisectorTypos(g.problem, g.fig).map((x) => `${c.skill} together ${k + 1}: ${x}`)); });
    }
    for (let i = 0; i < 2000; i += 1) {
      const it = makeItem('angles', 6);
      if (String(it.text).match(BISECTS)) seen.items += 1;
      bad.push(...bisectorTypos(it.text, it.fig).map((x) => `${it.key}: ${x}`));
    }
    const m = CONTENT['angles:6'].diag; const rnd = seeded(66);
    for (let i = 0; i < 400; i += 1) { const p = m.params(rnd); const t = String(m.text(p)); if (t.match(BISECTS)) seen.model += 1; bad.push(...bisectorTypos(t, m.fig!(p)).map((x) => `model ${JSON.stringify(p)}: ${x}`)); }
    expect(bad.slice(0, 10)).toEqual([]);
    // the check really ran: the teaching names a bisector in more than ten places, and most exercises do
    expect(seen.teaching).toBeGreaterThan(10);
    expect(seen.items).toBeGreaterThan(1000);
    expect(seen.model).toBeGreaterThan(200);
  });
  it('"is OC the bisector?" is a choice with a reason, practice only, OC halving ∢BOD half the time, read plainly by the tutor', () => {
    let yes = 0;
    for (let i = 0; i < 400; i += 1) {
      const it = bisCheckItem();
      expect(it).toMatchObject({ form: 'mc', practiceOnly: true });
      expect(it.choices).toHaveLength(3);
      expect(new Set(it.choices.map((c: { text: string }) => c.text)).size).toBe(3);
      const [, aod, aob, cod] = String(it.key).split(':').map(Number);
      const right = it.choices[it.answer].text as string;
      if (aod - aob === 2 * cod) { yes += 1; expect(right.startsWith('כן')).toBe(true); } else expect(right.startsWith('לא')).toBe(true);
      expect(itemPlain({ ...it, topic: 'angles', level: 6 })).not.toMatch(/[\u2066\u2069]/);
    }
    expect(yes / 400).toBeGreaterThan(0.4);
    expect(yes / 400).toBeLessThan(0.6);
  });
  it('teaches in the spec\'s order: the word, the turning ray, a prediction, the rule with ⇔, then a bisector on a line', () => {
    const d = CONTENT['angles:6'].discover;
    expect(d.map((s) => s.kind)).toEqual(['say', 'explore', 'predict', 'rule', 'predict', 'predict']);
    expect(d[0].text).toContain('נקראת חוצה זווית');
    expect(d[1]).toMatchObject({ kind: 'explore', manip: { kind: 'angle', whole: 110 }, answer: 55 });
    expect(d[3].text).toContain('\\iff');
    expect((d[3] as { display?: string }).display).toBe('\\sphericalangle AOC = \\sphericalangle COB = \\tfrac{1}{2}\\sphericalangle AOB');
    // the worked examples: the worksheet's two bisectors (41° and 27°: 136°) and one on a line (58°: 61°), each checked
    expect(CONTENT['angles:6'].examples.map((e) => e.answer)).toEqual([136, 61]);
    CONTENT['angles:6'].examples.forEach((e) => expect(e.steps.at(-1)!.action).toContain('בודקים'));
  });
});

// CLASSROOM-12: the quadrilateral taught from two triangles, and the worked examples write the found value on the figure
describe('angles:7, the sum of the angles of a quadrilateral', () => {
  it('a diagonal, 180° + 180°, the rule, two shapes in place of a dragged vertex, the right angle, then the angles with x', () => {
    const d = CONTENT['angles:7'].discover;
    expect(d.map((s) => s.kind)).toEqual(['say', 'predict', 'rule', 'predict', 'predict', 'say']);
    expect(d[0].text).toContain('אלכסון מחלק מרובע לשני משולשים');
    expect((d[1] as { choices: string[] }).choices[0]).toBe('$360^\\circ$');
    expect(d[2].text).toContain('סכום זוויות במרובע שווה $360^\\circ$');
    expect((d[2] as { display?: string }).display).toBe('\\sphericalangle A + \\sphericalangle B + \\sphericalangle C + \\sphericalangle D = 360^\\circ');
    // the last step: 2x, 4x − 15°, 3x + 15° and x make 360°, so x = 36°, and the figure carries the angles found
    const last = d[5] as unknown as { text: string; fig: { angles: { text: string }[] } };
    expect(last.text).toContain('$10x = 360^\\circ$');
    expect(last.text).toContain('$x = 36^\\circ$');
    expect(last.text).toContain('בעיות מילוליות');
    expect([2 * 36, 4 * 36 - 15, 3 * 36 + 15, 36].reduce((a, b) => a + b, 0)).toBe(360);
    expect(last.fig.angles.map((g) => g.text)).toEqual(['72°', '129°', '123°', '36°']);
  });
  it('the worked examples, Q0 (75°, 110°, 95°: 80°) and Q2 (100°, 70°: 95°), end by writing the answer on the figure', () => {
    const ex = CONTENT['angles:7'].examples;
    expect(ex.map((e) => e.answer)).toEqual([80, 95]);
    ex.forEach((e) => {
      const before = (e.fig as unknown as { angles: { text?: string; target?: boolean }[] }).angles;
      const after = (e.steps.at(-1)!.fig as unknown as { angles: { text?: string; target?: boolean }[] }).angles;
      expect(before.some((g) => g.target)).toBe(true);
      expect(after.some((g) => g.target)).toBe(false);
      expect(after.filter((g) => g.text === `${e.answer}°`).length).toBeGreaterThanOrEqual(1);
    });
    // the two equal angles both carry it
    expect((ex[1].steps.at(-1)!.fig as unknown as { angles: { text?: string }[] }).angles.filter((g) => g.text === '95°')).toHaveLength(2);
  });
});

