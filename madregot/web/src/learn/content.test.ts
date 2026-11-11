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
import { TOPIC, fairForCheck } from '@/content/index.js';
// @ts-ignore: plain JS
import { T } from '@/content/util.js';

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
    // expr:1's own questions: 5 + 3x at x = 4 is 17; 12 reads 3x as 3 + 4, and 9 as x alone (FOLLOWUP-36: the readings
    // its choice question offers, so a typed answer names them too)
    const sub = CONTENT['expr:1'].diag as DiagModel<{ f: number; a: number; b: number; x: number }>;
    const named = (u: number) => { const d = diagnose(sub, { f: 0, a: 3, b: 5, x: 4 }, u); return d.kind === 'misconception' ? d.candidates.map((c) => c.id) : []; };
    expect(sub.answer({ f: 0, a: 3, b: 5, x: 4 })).toBe(17);
    expect(named(12)).toEqual(['plus']);
    expect(named(9)).toEqual(['coef']);
    expect(named(39)).toEqual(['concat']);
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
