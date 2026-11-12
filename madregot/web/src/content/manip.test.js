import { describe, it, expect, beforeAll } from 'vitest';
import katex from 'katex';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Figure from '@/components/Figure.jsx';
import NumberLine from '@/components/manip/NumberLine.jsx';
import NumberPins from '@/components/manip/NumberPins.jsx';
import FracBar from '@/components/manip/FracBar.jsx';
import DoubleLine from '@/components/manip/DoubleLine.jsx';
import GraphDraw from '@/components/manip/GraphDraw.jsx';
import AngleTurner from '@/components/manip/AngleTurner.jsx';
import { loadKatex } from '@/components/MathText.jsx';
import { TOPICS, makeItem, isCorrect, answerText, itemPlain, readAnswer, slotsFor, figPlain } from './index.js';
import {
  quadOf, manipSolution, manipWrong, manipText, manipPlain, triangleAngles, rightAtC,
  balanceTilt, balanceSolved, balanceDivisor, balanceReachable, boxesDivisor, balanceSplits, balanceDivide, balanceTex, balanceWords, panWords,
  tilesTex, tilesPairs, tilesWords, areaTex, areaSumTex, rayText, rayTex, rayHas, TILES_MAX,
  fbarDenFor, fbarWords, dlineAt, dlineNum, withUnit, ticksWords, manipCorrect,
  graphMove, graphKey, graphShape, graphXs, squaresWords, seriesAt, seriesCrossings, seriesMeet, figWords,
  protAligned, armTurns, baselineOnArm, buildWords, alignWords, clockHands, mod360,
} from './manip.js';
import { linText, listMath } from './util.js';
import { holds, texToExpr, identical, seeded } from '@/learn/expr.ts';
import { loadAllGens } from './index.js';
// the exercise generators load per topic (the boot split); this file makes questions while its tests are collected
await loadAllGens();

// Draw interactive items from their levels until each kind has been seen.
function manipItems(topic, level, n = 400) {
  const out = [];
  for (let k = 0; k < n; k += 1) { const it = makeItem(topic, level); if (it.form === 'manip') out.push(it); }
  return out;
}

describe('interactive exercises: deterministic checking', () => {
  it('number line: only the exact result is right; the opposite move is a direction mistake, never a sign mistake', () => {
    const items = manipItems('signed', 1);
    expect(items.length).toBeGreaterThan(50);
    for (const it of items) {
      expect(it.manip.kind).toBe('numberline');
      expect(it.answer).toBeGreaterThanOrEqual(it.manip.min);
      expect(it.answer).toBeLessThanOrEqual(it.manip.max);
      expect(isCorrect(it, it.answer)).toBe(true);
      expect(isCorrect(it, it.answer + 1)).toBe(false);
      const opposite = it.manip.from - (it.answer - it.manip.from);
      // subtracting a negative number moved like subtracting a positive one is that misconception; any other
      // opposite move is the direction (the answer is not the negative of the right one: the start is not 0)
      const subNeg = / - \(-\d+\)$/.test(it.display);
      if (opposite !== it.answer) expect(it.diag(opposite)).toBe(subNeg ? 'minus-minus' : 'direction');
      // the real negative of the answer is a sign mistake
      if (it.answer !== 0) expect(it.diag(-it.answer)).toBe('sign');
    }
  });
  it('plotting a point: only the exact point; swapped coordinates are diagnosed', () => {
    const items = manipItems('coord', 1);
    expect(items.length).toBeGreaterThan(50);
    for (const it of items) {
      const [x, y] = it.answer;
      expect(isCorrect(it, [x, y])).toBe(true);
      expect(isCorrect(it, [x + 1, y])).toBe(false);
      expect(isCorrect(it, null)).toBe(false);
      if (x !== y) expect(it.diag([y, x])).toBe('swap');
    }
  });
  it('a point in a quadrant: any point inside (on the given line, when a coordinate is given) is right; points on the axes are not', () => {
    const items = manipItems('coord', 2);
    expect(items.length).toBeGreaterThan(50);
    let fixed = 0;
    for (const it of items) {
      const q = it.manip.quadrant; const { fixX, fixY } = it.manip;
      const sx = q === 1 || q === 4 ? 1 : -1; const sy = q === 1 || q === 2 ? 1 : -1;
      const at = (x, y) => [fixX ?? x, fixY ?? y];
      expect(isCorrect(it, at(sx * 5, sy * 1))).toBe(true);
      expect(isCorrect(it, at(sx * 1, sy * 6))).toBe(true);
      expect(isCorrect(it, at(0, sy * 3))).toBe(fixX != null && fixX !== 0 ? true : false);
      expect(isCorrect(it, [-sx * 2, sy * 2])).toBe(false);
      expect(quadOf(it.answer)).toBe(q);
      expect(isCorrect(it, it.answer)).toBe(true);
      if (fixX != null || fixY != null) {
        fixed += 1;
        // in the right quadrant but off the given line: not right
        expect(isCorrect(it, fixX != null ? [fixX + sx, sy * 2] : [sx * 2, fixY + sy])).toBe(false);
        // the given coordinate's sign agrees with the quadrant
        if (fixX != null) expect(Math.sign(fixX)).toBe(sx); else expect(Math.sign(fixY)).toBe(sy);
      }
    }
    expect(fixed).toBeGreaterThan(0);
  });
  it('building a line: exactly the slope and the intercept asked for', () => {
    const items = manipItems('line', 2);
    expect(items.length).toBeGreaterThan(50);
    for (const it of items) {
      const { m, b } = it.answer;
      expect(isCorrect(it, { m, b })).toBe(true);
      expect(isCorrect(it, { m: m + 1, b })).toBe(false);
      expect(isCorrect(it, { m, b: b - 1 })).toBe(false);
      expect(Math.abs(b)).toBeLessThanOrEqual(6); expect(Math.abs(m + b)).toBeLessThanOrEqual(6); // both handles fit on the grid
      expect(answerText(it)).toMatch(/^y = /);
    }
  });
  it('turning the ray: the right angle must be 180 minus the target', () => {
    const items = manipItems('angles', 1);
    expect(items.length).toBeGreaterThan(50);
    for (const it of items) {
      expect(it.answer + it.manip.target).toBe(180);
      expect(it.answer % 5).toBe(0);
      expect(isCorrect(it, it.answer)).toBe(true);
      expect(isCorrect(it, it.manip.target)).toBe(false);
      expect(it.diag(it.manip.target)).toBe('equal-not-supp');
    }
  });
  it('Pythagoras squares: any whole legs with a² + b² = c² are right', () => {
    const items = manipItems('pyth', 1);
    expect(items.length).toBeGreaterThan(50);
    for (const it of items) {
      const { a, b, c } = it.answer;
      expect(isCorrect(it, { a, b })).toBe(true);
      expect(isCorrect(it, { a: b, b: a })).toBe(true);
      expect(isCorrect(it, { a: a + 1, b })).toBe(false);
      expect(a <= it.manip.max && b <= it.manip.max).toBe(true);
      if (c === 10) expect(isCorrect(it, { a: 8, b: 6 })).toBe(true);
    }
  });
  it('mean bars: only the value that makes the mean exact', () => {
    const items = manipItems('stats', 3);
    expect(items.length).toBeGreaterThan(50);
    for (const it of items) {
      const all = [...it.manip.values, it.answer];
      expect(all.reduce((t, v) => t + v, 0) / all.length).toBe(it.manip.mean);
      expect(isCorrect(it, it.answer)).toBe(true);
      expect(isCorrect(it, it.answer + 1)).toBe(false);
      expect(it.manip.start).not.toBe(it.answer);
    }
  });
  it('every interactive exercise is described in words for the tutor and the teacher', () => {
    for (const [t, l] of [['signed', 1], ['coord', 1], ['coord', 2], ['line', 2], ['angles', 1], ['pyth', 1], ['stats', 3]]) {
      for (const it of manipItems(t, l, 60)) expect(itemPlain(it)).toMatch(/\[.+\]/);
    }
  });
  it('the solve helpers: the solution is right, the near miss is wrong, and the start never answers', () => {
    for (const [t, l] of [['signed', 1], ['signed', 2], ['coord', 1], ['coord', 2], ['coord', 5], ['line', 1], ['line', 2], ['angles', 1], ['angles', 3], ['pyth', 1], ['stats', 2], ['stats', 3]]) {
      for (const it of manipItems(t, l, 120)) {
        expect(isCorrect(it, manipSolution(it))).toBe(true);
        expect(isCorrect(it, manipWrong(it))).toBe(false);
        if (it.manip.start != null) expect(isCorrect(it, it.manip.start)).toBe(false);
      }
    }
  });
  it('ordering on a number line: every marker in its own place; a negative placed at its distance is diagnosed', () => {
    const items = manipItems('signed', 2).filter((x) => x.manip.kind === 'pins');
    expect(items.length).toBeGreaterThan(30);
    for (const it of items) {
      expect(isCorrect(it, it.answer)).toBe(true);
      expect(isCorrect(it, it.manip.start)).toBe(false);
      expect(new Set(it.manip.start).size).toBe(it.manip.start.length);
      it.manip.start.forEach((p, i) => expect(p).not.toBe(it.answer[i]));
    }
  });
  it('the missing vertex of a rectangle: only the fourth corner', () => {
    const items = manipItems('coord', 5).filter((x) => x.manip.kind === 'plot');
    expect(items.length).toBeGreaterThan(50);
    for (const it of items) {
      const [A, B, C] = it.manip.shape.map((q) => q.at);
      expect(A[1]).toBe(B[1]); expect(B[0]).toBe(C[0]); // A-B horizontal, B-C vertical
      expect(it.answer).toEqual([A[0], C[1]]);
      expect(isCorrect(it, it.answer)).toBe(true);
      expect(isCorrect(it, [C[0], A[1]])).toBe(false);
    }
  });
  it('dragging the vertex of a triangle: right at C exactly when the vectors are perpendicular, angles sum to 180', () => {
    const items = manipItems('angles', 3).filter((x) => x.manip.kind === 'triangle');
    expect(items.length).toBeGreaterThan(50);
    for (const it of items) {
      expect(isCorrect(it, it.answer)).toBe(true);
      expect(isCorrect(it, it.manip.start)).toBe(false);
      const s = triangleAngles(it.manip, it.answer);
      expect(Math.abs(s[2] - 90)).toBeLessThan(1e-9);
      expect(Math.abs(s.reduce((x, y) => x + y, 0) - 180)).toBeLessThan(1e-9);
    }
    const m = { A: [-5, 0], B: [5, 0] };
    expect(rightAtC(m, [3, 4])).toBe(true); expect(rightAtC(m, [3, -4])).toBe(false); expect(rightAtC(m, [2, 4])).toBe(false);
  });
  it('a point of the line: only the point at the asked x; forgetting b is diagnosed', () => {
    const items = manipItems('line', 1).filter((x) => x.manip.kind === 'plot');
    expect(items.length).toBeGreaterThan(50);
    for (const it of items) {
      const { m, b } = it.manip.line;
      expect(it.answer[1]).toBe(m * it.answer[0] + b);
      expect(isCorrect(it, it.answer)).toBe(true);
      if (b !== 0) expect(it.diag([it.answer[0], m * it.answer[0]])).toBe('forgot-b');
    }
  });
  it('the median bar: the middle value is the target only at the answer', () => {
    const items = manipItems('stats', 2).filter((x) => x.manip.kind === 'bars');
    expect(items.length).toBeGreaterThan(50);
    const median = (a) => [...a].sort((x, y) => x - y)[2];
    for (const it of items) {
      for (let v = 0; v <= 12; v += 1) expect(isCorrect(it, v)).toBe(median([...it.manip.values, v]) === it.manip.target);
      expect(isCorrect(it, it.manip.start)).toBe(false);
    }
  });
});

// ---------------------------------------------------------------- algebra: the balance, tiles, area, ray, two lines
const fixture = (manip, answer) => ({ form: 'manip', manip, answer });
const renders = (tex) => expect(() => katex.renderToString(tex, { throwOnError: true }), tex).not.toThrow();

describe('the balance (מאזניים)', () => {
  const it3 = fixture({ kind: 'balance', start: { lx: 3, l1: 5, rx: 1, r1: 11 } }, 3); // 3x + 5 = x + 11
  it('is solved by one box alone against x weights, on either pan, and nothing else', () => {
    expect(isCorrect(it3, { lx: 1, l1: 0, rx: 0, r1: 3 })).toBe(true);
    expect(isCorrect(it3, { lx: 0, l1: 3, rx: 1, r1: 0 })).toBe(true);
    expect(isCorrect(it3, { lx: 2, l1: 0, rx: 0, r1: 6 })).toBe(false); // level, not yet one box
    expect(isCorrect(it3, { lx: 1, l1: 0, rx: 0, r1: 4 })).toBe(false); // one box, wrong weight (and not level)
    expect(isCorrect(it3, { lx: 1, l1: 1, rx: 0, r1: 4 })).toBe(false); // level, a weight beside the box
    expect(isCorrect(it3, it3.manip.start)).toBe(false);
    expect(isCorrect(it3, manipSolution(it3))).toBe(true);
    expect(isCorrect(it3, manipWrong(it3))).toBe(false);
    expect(balanceTilt(manipWrong(it3), 3)).toBe(0); // the near miss is level: only "one box alone" is missing
  });
  it('leans to the heavier pan and divides only when level', () => {
    expect(balanceTilt({ lx: 3, l1: 5, rx: 1, r1: 11 }, 3)).toBe(0);
    expect(balanceTilt({ lx: 2, l1: 5, rx: 1, r1: 11 }, 3)).toBe(1); // 11 against 14: the right pan goes down
    expect(balanceTilt({ lx: 3, l1: 5, rx: 0, r1: 11 }, 3)).toBe(-1);
    expect(balanceDivisor({ lx: 2, l1: 0, rx: 0, r1: 6 }, 3)).toBe(2);
    expect(balanceDivisor({ lx: 2, l1: 4, rx: 0, r1: 10 }, 3)).toBe(2); // 2x + 4 = 10 → x + 2 = 5
    expect(balanceDivisor({ lx: 3, l1: 0, rx: 0, r1: 10 }, 3)).toBeNull(); // not level
    expect(balanceDivisor({ lx: 1, l1: 2, rx: 0, r1: 5 }, 3)).toBeNull(); // nothing to divide by
    expect(balanceSolved({ lx: 1, l1: 0, rx: 0, r1: 3 }, 3)).toBe(true);
  });
  it('can be solved, but never by working on one pan only', () => {
    const cases = [[{ lx: 3, l1: 5, rx: 1, r1: 11 }, 3], [{ lx: 1, l1: 5, rx: 0, r1: 12 }, 7], [{ lx: 3, l1: 4, rx: 0, r1: 19 }, 5], [{ lx: 5, l1: 2, rx: 3, r1: 10 }, 4], [{ lx: 1, l1: 11, rx: 3, r1: 5 }, 3]];
    for (const [st, x] of cases) {
      expect(balanceTilt(st, x), JSON.stringify(st)).toBe(0);
      expect(balanceReachable(st, x), JSON.stringify(st)).toBe(true);
      expect(balanceReachable(st, x, 'l'), JSON.stringify(st)).toBe(false);
      expect(balanceReachable(st, x, 'r'), JSON.stringify(st)).toBe(false);
    }
  });
  it('is written as its equation and in words', () => {
    expect(balanceTex({ lx: 3, l1: 5, rx: 1, r1: 11 }, 3)).toBe('3x + 5 = x + 11');
    expect(balanceTex({ lx: 2, l1: 5, rx: 1, r1: 11 }, 3)).toBe('2x + 5 \\ne x + 11');
    expect(balanceTex({ lx: 1, l1: 0, rx: 0, r1: 7 }, 7)).toBe('x = 7');
    expect(balanceTex({ lx: 0, l1: 0, rx: 0, r1: 0 }, 7)).toBe('0 = 0');
    expect(holds(balanceTex({ lx: 3, l1: 5, rx: 1, r1: 11 }, 3), { x: 3 })).toBe(true);
    renders(balanceTex({ lx: 2, l1: 5, rx: 1, r1: 11 }, 3));
    expect(answerText(it3)).toBe('x = 3');
    expect(manipText(it3, { lx: 2, l1: 5, rx: 1, r1: 11 })).toBe('2x + 5 ≠ x + 11');
    renders(manipText(it3, { lx: 2, l1: 5, rx: 1, r1: 11 }));
    expect(balanceWords({ lx: 3, l1: 5, rx: 1, r1: 11 })).toBe('בכף השמאלית 3 קופסאות ו־5 משקולות, בכף הימנית קופסה אחת ו־11 משקולות');
    expect(panWords(0, 1)).toBe('משקולת אחת'); expect(panWords(0, 0)).toBe('כף ריקה');
    expect(itemPlain({ ...it3, text: 'מצאו את x' })).toMatch(/\[מאזניים מאוזנים: בכף השמאלית 3 קופסאות/);
  });
});

describe('algebra tiles (אריחים)', () => {
  const t = fixture({ kind: 'tiles', start: { px: 3, nx: 1, p1: 2, n1: 5 } }, { k: 2, c: -3 }); // 3x - x + 2 - 5
  it('are collected when no zero pair is left and the totals are the answer', () => {
    expect(isCorrect(t, { px: 2, nx: 0, p1: 0, n1: 3 })).toBe(true);
    expect(isCorrect(t, { px: 3, nx: 1, p1: 0, n1: 3 })).toBe(false); // an x pair is left
    expect(isCorrect(t, { px: 2, nx: 0, p1: 1, n1: 4 })).toBe(false); // a unit pair is left
    expect(isCorrect(t, { px: 2, nx: 0, p1: 3, n1: 0 })).toBe(false); // the sign of the constant
    expect(isCorrect(t, t.manip.start)).toBe(false);
    expect(isCorrect(t, manipSolution(t))).toBe(true);
    expect(isCorrect(t, manipWrong(t))).toBe(false);
    const w = manipWrong(t); expect(w.px - w.nx).toBe(2); expect(w.p1 - w.n1).toBe(-3); // only a zero pair more
  });
  it('are written term by term, and the answer collected', () => {
    expect(tilesTex({ px: 3, nx: 1, p1: 2, n1: 5 })).toBe('3x - x + 2 - 5');
    expect(identical(texToExpr(tilesTex({ px: 3, nx: 1, p1: 2, n1: 5 })), '2*x - 3')).toBe(true);
    expect(tilesTex({ px: 0, nx: 2, p1: 0, n1: 1 })).toBe('-2x - 1');
    expect(tilesTex({ px: 0, nx: 0, p1: 0, n1: 0 })).toBe('0');
    expect(tilesPairs({ px: 3, nx: 1, p1: 2, n1: 5 })).toEqual({ x: 1, unit: 2 });
    expect(answerText(t)).toBe('2x - 3');
    expect(tilesWords({ px: 3, nx: 1, p1: 0, n1: 2 })).toBe('3 אריחי x, אריח −x אחד, 2 אריחי −1');
    expect(manipPlain(t)).toMatch(/^\[אריחים: 3 אריחי x/);
    expect(TILES_MAX).toEqual({ x: 5, unit: 8 });
  });
});

describe('the area model (מלבן)', () => {
  const a = fixture({ kind: 'area', start: { a: 1, b: 0 }, maxA: 6, maxB: 9 }, { a: 3, b: 4 });
  it('is right only at the asked height and units', () => {
    expect(isCorrect(a, { a: 3, b: 4 })).toBe(true);
    expect(isCorrect(a, { a: 4, b: 3 })).toBe(false);
    expect(isCorrect(a, { a: 3, b: 5 })).toBe(false);
    expect(isCorrect(a, manipWrong(a))).toBe(false);
    expect(isCorrect(a, a.manip.start)).toBe(false);
  });
  it('reads a(x + b) and its two areas', () => {
    expect(areaTex({ a: 3, b: 4 })).toBe('3(x + 4)');
    expect(areaTex({ a: 1, b: 4 })).toBe('x + 4');
    expect(areaTex({ a: 3, b: 0 })).toBe('3x');
    expect(areaSumTex({ a: 3, b: 4 })).toBe('3x + 12');
    for (let p = 1; p <= 6; p += 1) for (let q = 0; q <= 9; q += 1) expect(identical(texToExpr(areaTex({ a: p, b: q })), texToExpr(areaSumTex({ a: p, b: q })))).toBe(true);
    expect(answerText(a)).toBe('3(x + 4)');
  });
});

describe('an inequality on the number line (קרן)', () => {
  const r = fixture({ kind: 'ray', min: -10, max: 10, start: { at: 0, dir: 1, closed: false } }, { at: 4, dir: -1, closed: true });
  it('is right only with the point, the side and the circle all right', () => {
    expect(isCorrect(r, { at: 4, dir: -1, closed: true })).toBe(true);
    expect(isCorrect(r, { at: 4, dir: -1, closed: false })).toBe(false);
    expect(isCorrect(r, { at: 4, dir: 1, closed: true })).toBe(false);
    expect(isCorrect(r, { at: 3, dir: -1, closed: true })).toBe(false);
    expect(isCorrect(r, manipWrong(r))).toBe(false);
  });
  it('writes the inequality it shows, and its numbers solve that inequality', () => {
    expect(rayText({ at: 4, dir: -1, closed: true })).toBe('x ≤ 4');
    expect(rayText({ at: -3, dir: -1, closed: false })).toBe('x < -3');
    expect(rayText({ at: 2, dir: 1, closed: true })).toBe('x ≥ 2');
    expect(rayTex({ at: 2, dir: 1, closed: false })).toBe('x > 2');
    for (const ray of [{ at: 4, dir: -1, closed: true }, { at: -3, dir: -1, closed: false }, { at: 2, dir: 1, closed: true }, { at: 0, dir: 1, closed: false }]) {
      renders(rayTex(ray)); renders(rayText(ray));
      for (let n = -10; n <= 10; n += 0.5) expect(holds(rayTex(ray), { x: n }), `${rayText(ray)} at ${n}`).toBe(rayHas(ray, n));
    }
    expect(answerText(r)).toBe('x ≤ 4');
  });
});

describe('two lines and their meeting point', () => {
  const p = fixture({ kind: 'plot', lines: [{ m: 2, b: -1 }, { m: -1, b: 5 }], range: 6 }, [2, 3]);
  it('is right only at the meeting point, and says both lines in words', () => {
    expect(isCorrect(p, [2, 3])).toBe(true);
    expect(isCorrect(p, [3, 2])).toBe(false);
    expect(isCorrect(p, manipWrong(p))).toBe(false);
    expect(manipPlain(p)).toBe('[מערכת צירים עם שני ישרים, y = 2x - 1 ו־y = -x + 5; שמים את נקודת המפגש שלהם]');
  });
});

describe('the expression answer (□x + □)', () => {
  const it5 = { form: 'lin', answer: { k: 5, c: 4 }, text: 'פשטו:', display: '2x + 3x + 4' };
  it('reads two slots, accepts any way of writing a number, and needs both', () => {
    expect(slotsFor(it5)).toEqual(['k', 'c']);
    expect(readAnswer(it5, { k: '5', c: '4' })).toEqual({ k: 5, c: 4 });
    expect(readAnswer(it5, { k: '−3', c: '2,5' })).toEqual({ k: -3, c: 2.5 });
    expect(readAnswer(it5, { k: '5/2', c: '0' })).toEqual({ k: 2.5, c: 0 });
    expect(readAnswer(it5, { k: '5', c: '' })).toBeNull();
    expect(isCorrect(it5, { k: 5, c: 4 })).toBe(true);
    expect(isCorrect(it5, { k: 4, c: 5 })).toBe(false);
    expect(isCorrect(it5, 9)).toBe(false);
    expect(isCorrect(it5, null)).toBe(false);
  });
  it('is written as a student writes it, and reads back the same', () => {
    expect(answerText(it5)).toBe('5x + 4');
    const cases = [[{ k: 1, c: -3 }, 'x - 3'], [{ k: -1, c: 0 }, '-x'], [{ k: 0, c: 7 }, '7'], [{ k: 0, c: 0 }, '0'], [{ k: -6, c: 18 }, '-6x + 18'], [{ k: 0.5, c: -2 }, '(1/2)x - 2']];
    for (const [u, text] of cases) {
      expect(linText(u)).toBe(text);
      expect(identical(texToExpr(text.replace('(1/2)', '\\frac{1}{2}')), `${u.k}*x + ${u.c}`)).toBe(true);
    }
    expect(answerText({ ...it5, var: 'n', answer: { k: 3, c: 1 } })).toBe('3n + 1');
    renders(answerText(it5));
  });
});

describe('the still figures of the algebra objects are described in words', () => {
  it('scale, rectangle, ray and tiles', () => {
    expect(figPlain({ type: 'scale', left: { x: 3, n: 5 }, right: { x: 1, n: 11 } })).toBe('מאזניים: בכף השמאלית 3 קופסאות ו־5 משקולות, בכף הימנית קופסה אחת ו־11 משקולות; המאזניים מאוזנים');
    expect(figPlain({ type: 'scale', left: { x: 1, n: 0 }, right: { x: 0, n: 12 }, tilt: 1 })).toMatch(/הכף הימנית למטה$/);
    expect(figPlain({ type: 'area', a: 3, b: 4 })).toBe('מלבן: גובה 3, אורך x ועוד 4');
    expect(figPlain({ type: 'area', a: 3, b: 4, areas: true })).toBe('מלבן: גובה 3, אורך x ועוד 4; שטחי החלקים 3x ו־12, השטח כולו 3(x + 4)');
    expect(figPlain({ type: 'ray', at: 4, dir: 1, closed: true })).toBe('ציר מספרים: עיגול מלא ב־4 וקרן ימינה (x ≥ 4)');
    expect(figPlain({ type: 'tiles', px: 2, nx: 0, p1: 0, n1: 3 })).toBe('אריחים: 2 אריחי x, 3 אריחי −1');
  });
  it('lists of numbers keep their order inside Hebrew', () => {
    expect(listMath([4, 7, 10])).toBe('⁦$4$, $7$, $10$⁩');
  });
});

// Every generated exercise of the algebra objects, whatever topic adds it, meets the same rules as the teaching steps.
describe('generated algebra exercises meet the rules of their object', () => {
  const NEW = ['balance', 'tiles', 'area', 'ray'];
  const found = [];
  for (const t of TOPICS) t.levels.forEach((_, i) => { for (let k = 0; k < 60; k += 1) { const it = makeItem(t.id, i + 1); if (it.form === 'manip' && (NEW.includes(it.manip.kind) || it.manip.lines)) found.push(it); } });
  it('balance: level at the start, solvable, never by one pan alone, within 6 boxes and 15 weights a pan', () => {
    for (const it of found.filter((x) => x.manip.kind === 'balance')) {
      const st = it.manip.start; const at = it.key;
      expect(balanceTilt(st, it.answer), at).toBe(0);
      expect(balanceReachable(st, it.answer), at).toBe(true);
      expect(balanceReachable(st, it.answer, 'l') || balanceReachable(st, it.answer, 'r'), at).toBe(false);
      // 15 weights are three bars of five, the most a pan's half holds (components/manip/Balance.jsx)
      expect(st.lx <= 6 && st.rx <= 6 && st.l1 <= 15 && st.r1 <= 15, at).toBe(true);
      if (it.display) expect(holds(it.display, { x: it.answer }), at).toBe(true);
    }
  });
  it('balance in a check: "divide" is offered by the shape, so following it does not find x', () => {
    // boxes alone against weights alone, whether or not the weights split; a press that cannot split them changes nothing
    expect(boxesDivisor({ lx: 3, l1: 0, rx: 0, r1: 8 })).toBe(3);
    expect(balanceSplits({ lx: 3, l1: 0, rx: 0, r1: 8 }, 3)).toBe(false);
    expect(boxesDivisor({ lx: 3, l1: 2, rx: 0, r1: 8 })).toBe(null);
    expect(boxesDivisor({ lx: 0, l1: 6, rx: 2, r1: 0 })).toBe(2);
    expect(boxesDivisor({ lx: 1, l1: 0, rx: 0, r1: 4 })).toBe(null);
    // the council's strategy, never keeping the scale level: boxes off the pan with fewer, weights off the boxes' pan,
    // then weights off the other pan one at a time until "divide" is offered, and divide
    const real = Math.random; Math.random = seeded(5);
    const bal = []; try { for (let k = 0; k < 4000; k += 1) { const it = makeItem('eq', 2 + (k % 2)); if (it.form === 'manip' && it.manip.kind === 'balance') bal.push(it); } } finally { Math.random = real; }
    let wins = 0; const xs = {};
    bal.forEach((it) => {
      const s = it.manip.start; const left = s.lx >= s.rx;
      let u = left ? { lx: s.lx - s.rx, l1: 0, rx: 0, r1: s.r1 } : { lx: 0, l1: s.l1, rx: s.rx - s.lx, r1: 0 };
      const w = left ? 'r1' : 'l1';
      while (!boxesDivisor(u) && u[w] > 0) u = { ...u, [w]: u[w] - 1 };
      const d = boxesDivisor(u); if (d && balanceSplits(u, d)) u = balanceDivide(u, d);
      if (isCorrect(it, u)) wins += 1;
      if (it.key.startsWith('eq2b:')) xs[it.answer] = (xs[it.answer] || 0) + 1;
    });
    expect(bal.length).toBeGreaterThan(300);
    expect(wins / bal.length, `${wins} of ${bal.length}`).toBeLessThan(0.05);
    // and no one value of x is a likely guess in two steps (one box against one or two weights)
    const n2 = Object.values(xs).reduce((a, b) => a + b, 0);
    Object.entries(xs).forEach(([x, n]) => expect(n / n2, `x = ${x}`).toBeLessThan(0.33));
  });
  it('tiles, area, ray and two lines: the start is not the answer, the near miss is wrong, the answer is reachable', () => {
    for (const it of found) {
      expect(isCorrect(it, manipSolution(it)), it.key).toBe(true);
      expect(isCorrect(it, manipWrong(it)), it.key).toBe(false);
      if (it.manip.start != null) expect(isCorrect(it, it.manip.start), it.key).toBe(false);
      if (it.manip.kind === 'tiles') { const st = it.manip.start; expect([st.px - st.nx, st.p1 - st.n1], it.key).toEqual([it.answer.k, it.answer.c]); }
      // the inequality a ray answers: shown as the display, or written in the question line (ineq)
      const shown = it.display || it.ineq;
      if (it.manip.kind === 'ray') expect(shown, `${it.key}: a ray answers an inequality`).toBeTruthy();
      if (it.manip.kind === 'ray' && shown) for (let n = -10; n <= 10; n += 0.5) expect(holds(shown, { x: n }), it.key).toBe(rayHas(it.answer, n));
      if (it.manip.lines) it.manip.lines.forEach((L) => expect(L.m * it.answer[0] + L.b, it.key).toBe(it.answer[1]));
    }
  });
});

// ---------------------------------------------------------------- curriculum stage 1: fractions, percent and ratio
const html = (C, props) => renderToStaticMarkup(createElement(C, { onChange: () => {}, locked: false, reveal: false, good: false, hint: false, ...props }));
const solves = (it) => {
  expect(isCorrect(it, manipSolution(it)), `${JSON.stringify(it.answer)}: the solution`).toBe(true);
  expect(isCorrect(it, manipWrong(it)), `${JSON.stringify(it.answer)}: the near miss`).toBe(false);
  if (it.manip.start != null) expect(isCorrect(it, it.manip.start), `${JSON.stringify(it.answer)}: the start`).toBe(false);
  for (const u of [it.answer, manipSolution(it), manipWrong(it)]) expect(manipText(it, u)).not.toMatch(/undefined|NaN/);
  expect(manipPlain(it)).not.toMatch(/undefined|NaN/);
  expect(manipPlain(it)).toMatch(/^\[.+\]$/);
};

describe('the fraction bar (פס שברים)', () => {
  // KaTeX is its own file now (DURABLE-11): until it has loaded, maths shows as plain words
  beforeAll(() => loadKatex());
  const bar = (manip, answer) => fixture({ kind: 'fbar', ...manip }, answer);
  const value = bar({ start: { den: 3, shaded: 2 } }, { mode: 'value', value: 3 / 4 });
  const locked = bar({ start: { den: 8, shaded: 0 }, lockDen: true }, { mode: 'value', value: 3 / 4 });
  const full = bar({ start: { den: 5, shaded: 0 }, lockDen: true }, { mode: 'value', value: 1 });
  const common = bar({ start: { den: 1, shaded: 0 }, marks: [1 / 3, 1 / 4] }, { mode: 'common', of: [3, 4] });
  const exact = bar({ start: { den: 3, shaded: 2 }, marks: [2 / 3] }, { mode: 'exact', den: 12, shaded: 8 });
  const whole = bar({ start: { den: 1, shaded: 0 }, whole: 56 }, { mode: 'value', value: 2 / 7 });
  it('every mode: the solution is right, the near miss and the start are not, and the words hold no undefined', () => {
    for (const it of [value, locked, full, common, exact, whole]) solves(it);
  });
  it('value: any number of parts that shows the value; the solution is the smallest; a locked bar keeps its parts', () => {
    expect(isCorrect(value, { den: 4, shaded: 3 })).toBe(true);
    expect(isCorrect(value, { den: 12, shaded: 9 })).toBe(true);
    expect(isCorrect(value, { den: 12, shaded: 8 })).toBe(false);
    expect(manipSolution(value)).toEqual({ den: 4, shaded: 3 });
    expect(manipSolution(locked)).toEqual({ den: 8, shaded: 6 });
    expect(isCorrect(locked, { den: 4, shaded: 3 })).toBe(false); // the right value, but the question fixed eighths
    expect(manipWrong(full)).toEqual({ den: 5, shaded: 4 }); // a full locked bar: one part less
    expect(isCorrect(value, { den: 25, shaded: 18 })).toBe(false); // more parts than the bar takes
    expect(isCorrect(value, { den: 4, shaded: 5 })).toBe(false);
    expect(fbarDenFor(0.75)).toBe(4); expect(fbarDenFor(7 / 12)).toBe(12); expect(fbarDenFor(1 / 25)).toBeNull();
  });
  it('common: a number of parts every mark falls on, shading free; exact: those parts and that shading', () => {
    expect(isCorrect(common, { den: 12, shaded: 5 })).toBe(true);
    expect(isCorrect(common, { den: 24, shaded: 0 })).toBe(true);
    expect(isCorrect(common, { den: 6, shaded: 2 })).toBe(false);
    expect(manipSolution(common)).toEqual({ den: 12, shaded: 0 });
    expect(manipWrong(common)).toEqual({ den: 13, shaded: 0 });
    expect(isCorrect(exact, { den: 12, shaded: 8 })).toBe(true);
    expect(isCorrect(exact, { den: 6, shaded: 4 })).toBe(false); // the same value, not the bar asked for
  });
  it('is said in words, and the answer is written as a student would', () => {
    expect(fbarWords({ den: 12, shaded: 7 })).toBe('הפס מחולק ל־12 חלקים, 7 צבועים');
    expect(fbarWords({ den: 4, shaded: 1 })).toBe('הפס מחולק ל־4 חלקים, חלק אחד צבוע');
    expect(fbarWords({ den: 1, shaded: 0 })).toBe('הפס שלם, חלק אחד, אף חלק לא צבוע');
    expect(answerText(value)).toBe('3/4');
    expect(answerText(exact)).toBe('8/12');
    expect(answerText(common)).toBe('מספר חלקים שמתחלק ב־3 וב־4, למשל 12');
    expect(answerText(value, { den: 12, shaded: 9 })).toBe('9/12');
    expect(manipPlain(whole)).toBe('[פס שברים: הפס שלם, חלק אחד, אף חלק לא צבוע; אפשר לחלק לעד 24 חלקים; הפס כולו 56]');
  });
  it('draws the fraction built and, outside a check, the amount; in a check only the fraction', () => {
    const shown = html(FracBar, { m: whole.manip, value: { den: 7, shaded: 2 }, answer: whole.answer });
    expect(shown).toMatch(/\\dfrac\{2\}\{7\} = 16/);
    expect(shown).toContain('aria-valuetext="הפס מחולק ל־7 חלקים, 2 צבועים, הכמות 16 מתוך 56"');
    const check = html(FracBar, { m: whole.manip, value: { den: 7, shaded: 2 }, answer: whole.answer, test: true });
    expect(check).toMatch(/\\dfrac\{2\}\{7\}/);
    expect(check).not.toMatch(/= 16|הכמות/);
    expect(check).not.toMatch(/NaN|undefined/);
  });
});

describe('the double number line (ציר כפול)', () => {
  const top = { max: 100, step: 10, unit: '%', label: 'אחוזים' };
  const t = fixture({ kind: 'dline', top, bottom: { max: 240, step: 24, unit: '₪', label: 'מחיר' }, move: 't', start: { t: 0 } }, 30);
  const mx = fixture({ kind: 'dline', top: { ...top, step: 5, every: 2 }, bottom: { max: 6000, step: 100, unit: 'MB', label: 'גודל הקובץ', every: 10 }, move: 'max', fixT: 35, start: { t: 35, max: 1000 } }, 4000);
  const km = fixture({ kind: 'dline', top: { max: 10, step: 1, unit: 'ס״מ', label: 'במפה' }, bottom: { max: 5, step: 0.5, unit: 'ק״מ', label: 'במציאות' }, move: 't', start: { t: 0 } }, 7);
  it('both moves: the solution is right, the near miss and the start are not, and the words hold no undefined', () => {
    for (const it of [t, mx, km]) solves(it);
  });
  it('the value under the marker is t · bottom.max / top.max, and in "max" the marker stays at fixT', () => {
    expect(dlineAt(t.manip, 30)).toEqual({ t: 30, max: 240, under: 72 });
    expect(dlineAt(mx.manip, 4000)).toEqual({ t: 35, max: 4000, under: 1400 });
    expect(dlineAt(km.manip, 7).under).toBe(3.5);
    expect(withUnit(3.5, 'ק״מ')).toBe('3.5 ק״מ'); expect(withUnit(30, '%')).toBe('30%'); expect(dlineNum(12500)).toBe('12,500');
    expect(answerText(t)).toBe('30%'); expect(answerText(mx)).toBe('4000 MB'); // a comma only from 10,000
  });
  it('"max" reaches the answer in bottom.step steps from start.max, within the line', () => {
    const { step, max } = mx.manip.bottom; let v = mx.manip.start.max; let n = 0;
    while (v < mx.answer - 1e-9 && n < 1000) { v += step; n += 1; }
    expect(Math.abs(v - mx.answer)).toBeLessThan(1e-9);
    expect(mx.answer).toBeLessThanOrEqual(max);
    expect(isCorrect(mx, { t: 35, max: 4000 })).toBe(true); // the object's start shape is read too
  });
  it('outside a check both values show; in a check only the givens (the value under the marker is hidden)', () => {
    const open = html(DoubleLine, { m: mx.manip, value: 4000, answer: mx.answer });
    expect(open).toContain('1400 MB');
    const check = html(DoubleLine, { m: mx.manip, value: 4000, answer: mx.answer, test: true });
    expect(check).not.toMatch(/1,400|1400/); // not in the pill, the readout, the labels or the spoken text
    expect(check).toMatch(/>4000</); // the end of the bottom line stays
    expect(check).toContain('35%');
    const tCheck = html(DoubleLine, { m: t.manip, value: 30, answer: t.answer, test: true });
    expect(tCheck).toContain('30%');
    expect(tCheck).not.toMatch(/>72|72 ₪/);
    expect(tCheck).toMatch(/>240</); // the bottom line's end, a given
    expect(tCheck).not.toMatch(/>48<|>96</); // its other labels would give the value away
  });
});

describe('fractions on the number lines (den)', () => {
  const nl = fixture({ kind: 'numberline', min: 0, max: 2, from: 0, start: 0, den: 3 }, 5 / 3);
  const dec = fixture({ kind: 'numberline', min: 0, max: 1, from: 0, start: 0, den: 20, fmt: 'dec' }, 0.35);
  const pins = fixture({ kind: 'pins', min: 0, max: 1, den: 20, labels: ['0.4', '\\frac{1}{4}', '0.7'], start: [0, 0.05, 0.1] }, [0.4, 0.25, 0.7]);
  it('values are k/den, compared exactly; the near miss is one part away', () => {
    for (const it of [nl, dec, pins]) solves(it);
    expect(isCorrect(nl, 1 + 2 / 3)).toBe(true);
    expect(isCorrect(nl, 1.67)).toBe(false);
    expect(manipWrong(nl)).toBeCloseTo(2, 9);
    expect(manipWrong(dec)).toBeCloseTo(0.4, 9);
    expect(manipWrong(pins)[0]).toBeCloseTo(0.45, 9);
    expect(answerText(nl)).toBe('5/3'); expect(answerText(dec)).toBe('0.35');
    expect(answerText(pins)).toBe('0.4 ב־⁦2/5⁩, 1/4 ב־⁦1/4⁩, 0.7 ב־⁦7/10⁩');
    expect(answerText({ ...pins, manip: { ...pins.manip, fmt: 'dec' } })).toBe('0.4 ב־⁦0.4⁩, 1/4 ב־⁦0.25⁩, 0.7 ב־⁦0.7⁩');
    expect(manipPlain(pins)).toBe('[ציר מספרים מ־0 עד 1, כל יחידה מחולקת ל־20 חלקים שווים; שמים עליו את המספרים 0.4, 1/4, 0.7]');
    expect(ticksWords(nl.manip, 5 / 3, 0)).toBe('5 שנתות ימינה מ־0');
    expect(ticksWords(nl.manip, 1 / 3, 0)).toBe('שנתה אחת ימינה מ־0');
  });
  it('outside a check the step label and the arc write the fraction; in a check the line shows no value', () => {
    const open = html(NumberLine, { m: nl.manip, value: 5 / 3, answer: nl.answer });
    expect(open).toMatch(/\\frac\{5\}\{3\}/);
    const check = html(NumberLine, { m: nl.manip, value: 5 / 3, answer: nl.answer, test: true });
    expect(check).not.toMatch(/\\frac|katex/);
    expect(check).not.toMatch(/<b[ >]/); // no value in the step label
    expect(check).not.toMatch(/class="[^"]*mp-jump/); // no number on the arc
    expect(check).toContain('aria-valuetext="5 שנתות ימינה מ־0"');
    expect(check).toContain('aria-valuenow="5"'); // parts, not the value
    const pinCheck = html(NumberPins, { m: pins.manip, value: [0.4, 0.05, 0.1], answer: pins.answer, test: true });
    expect(pinCheck).not.toMatch(/<b[ >]/);
    expect(pinCheck).toContain('aria-valuetext="הסמן 0.4: 8 שנתות ימינה מ־0"');
  });
  it('markers that stack are drawn top one first, so the head under each covers the stem above it', () => {
    const order = (value) => [...html(NumberPins, { m: pins.manip, value, answer: pins.answer }).matchAll(/data-pin="(\d)"/g)].map((x) => x[1]);
    expect(order([0, 0.05, 0.1])).toEqual(['2', '1', '0']); // the start: all three stacked
    expect(order([0.4, 0.25, 0.7])).toEqual(['0', '1', '2']); // apart: nothing stacks, the order of the labels
  });
  it('a whole-number line draws as before', () => {
    const it0 = fixture({ kind: 'numberline', min: -10, max: 10, from: 3, start: 3 }, -2);
    const out = html(NumberLine, { m: it0.manip, value: -2, answer: -2, test: true });
    expect(out).toContain('aria-valuetext="−2, קפיצה של −5 מ־3"');
    expect(out).toContain('<b dir="ltr">−2</b>');
    expect(manipWrong(it0)).toBe(-1);
  });
});

describe('the still figures of stage 1 are drawn, and said in words with every number', () => {
  const figs = {
    numline: { type: 'numline', from: 0, to: 2, den: 5, marks: [{ x: 7 / 5, label: 'A' }], jumps: [{ from: 0, to: 1, label: '\\frac{5}{5}' }] },
    fbar: { type: 'fbar', rows: [{ den: 6, shaded: 1, label: '\\frac{1}{6}' }, { den: 8, shaded: 1, label: '\\frac{1}{8}' }], hatch: 1, marks: [1 / 3], whole: 48 },
    fgrid: { type: 'fgrid', rows: 2, cols: 4, shadeRows: 1, shadeCols: 3, label: '\\frac{3}{4}' },
    dline: { type: 'dline', top: { max: 100, step: 10, unit: '%', label: 'אחוזים' }, bottom: { max: 4000, step: 400, unit: 'MB', label: 'גודל' }, at: 35, show: 'top', label: '1400' },
    groups: { type: 'groups', rows: [{ n: 2, label: 'מדריכים' }, { n: 10, label: 'צופים' }] },
  };
  it('each renders, with no broken numbers', () => {
    for (const [k, fig] of Object.entries(figs)) {
      const out = renderToStaticMarkup(createElement(Figure, { fig }));
      expect(out, k).toMatch(/<svg/);
      expect(out, k).not.toMatch(/NaN|undefined|Infinity/);
    }
    const g = renderToStaticMarkup(createElement(Figure, { fig: figs.groups }));
    expect((g.match(/fg-dot/g) || []).length).toBe(12);
  });
  it('figPlain reads every number drawn', () => {
    expect(figPlain(figs.numline)).toBe('ציר מספרים מ־0 עד 2, כל יחידה מחולקת ל־5 חלקים שווים; A: 7 חלקים מ־0; קפיצה מ־0 ל־1 (5/5)');
    expect(figPlain(figs.fbar)).toBe('פס שברים: 1/6: הפס מחולק ל־6 חלקים, חלק אחד צבוע; 1/8: הפס מחולק ל־8 חלקים, חלק אחד צבוע; חלק צבוע אחד מקווקו; סימונים מעל הפס ב־1/3; הפס כולו 48');
    expect(figPlain(figs.fgrid)).toBe('מלבן מחולק ל־2 שורות ול־4 עמודות; 3 עמודות צבועות בכיוון אחד ו־1 שורות בכיוון השני, והחלק המשותף כהה; 3/4');
    expect(figPlain(figs.dline)).toBe('ציר כפול: למעלה אחוזים מ־0 עד 100%, שנתה כל 10%; למטה גודל מ־0 עד 4000 MB, שנתה כל 400 MB; הסמן על 35%, מתחתיו 1400');
    expect(figPlain(figs.groups)).toBe('קבוצות: מדריכים 2, צופים 10');
    // a line with no parts is the student lane's teaching figure (STUDENT-8): its words are that lane's (content/manip.js
    // teachLineWords): real minus signs, and each point with its place
    expect(figPlain({ type: 'numline', from: -6, to: 6, marks: [{ x: -2, label: 'B' }, { x: 0.75, label: '0.75' }] })).toBe('ציר מספרים מ־−6 עד 6, נקודה B ב־−2, נקודה ב־0.75');
  });
});

// ---------------------------------------------------------------- stage 5: the graph you draw and the situation graph
describe('the graph you draw (גרף שמציירים, FUNC-1)', () => {
  const time = { max: 15, step: 5, label: 'זמן', unit: 'דקות' };
  const dist = { max: 600, step: 100, label: 'מרחק מהבית', unit: 'מטרים' };
  const walk = fixture({ kind: 'graph', x: time, y: dist, start: [0, 200, 200, 200], fixed: [0] }, { mode: 'values', values: [0, 400, 400, 0] });
  const shape = fixture({ kind: 'graph', x: { max: 6, step: 1, label: 'x' }, y: { max: 8, step: 1, label: 'y' }, start: [4, 4, 4, 4, 4, 4, 4] }, { mode: 'shape', shape: ['up', 'up', 'flat', 'flat', 'down', 'down'] });
  const story = fixture({ kind: 'graph', x: time, y: dist, start: [0, 0, 0, 0], fixed: [0] }, { mode: 'shape', shape: ['up', 'flat', 'down'] });
  // a rate continued: two fixed points between... on the grid (y from 38 every 10), the rest to draw
  const heat = fixture({ kind: 'graph', x: { min: 4, max: 9, step: 1, label: 'זמן', unit: 'דקות' }, y: { min: 38, max: 98, step: 10, label: 'טמפרטורה', unit: 'מעלות' }, start: [48, 58, 58, 58, 58, 58], fixed: [0, 1] }, { mode: 'uniform' });
  const rate = fixture({ kind: 'graph', x: { max: 5, step: 1, label: 'זמן', unit: 'שעות' }, y: { max: 300, step: 60, label: 'מרחק', unit: 'ק״מ' }, start: [0, 0, 0, 0, 0, 0], fixed: [0], ref: { pts: [[0, 300], [5, 100]], label: 'רכב ב' } }, { mode: 'uniform', start: 0, rate: 60 });
  const perFive = fixture({ kind: 'graph', x: time, y: dist, start: [100, 100, 100, 100] }, { mode: 'uniform', rate: 20 }); // 20 a minute: 100 a column
  const free = fixture({ kind: 'graph', x: { max: 4, step: 1, label: 'x' }, y: { max: 8, step: 2, label: 'y' }, start: [8, 2, 0, 0, 0] }, { mode: 'uniform', start: 2 });

  it('every mode: the solution is right, the near miss and the start are not, and the words hold no undefined', () => {
    for (const it of [walk, shape, story, heat, rate, perFive, free]) solves(it);
  });
  it('values: every point exactly; shape: each segment\'s direction at any height; uniform: one change for every segment', () => {
    expect(isCorrect(walk, [0, 400, 400, 0])).toBe(true);
    expect(isCorrect(walk, [0, 400, 300, 0])).toBe(false);
    expect(manipWrong(walk)).toEqual([0, 500, 400, 0]); // the first point that moves, one step up
    expect(isCorrect(shape, [0, 1, 2, 2, 2, 1, 0])).toBe(true); // the same shape lower down
    expect(isCorrect(shape, [0, 1, 2, 2, 3, 1, 0])).toBe(false);
    expect(graphShape(manipSolution(shape))).toEqual(shape.answer.shape);
    expect(manipSolution(story)).toEqual([0, 100, 100, 0]); // from the fixed start, one step a segment
    expect(graphShape(manipWrong(story))[0]).toBe('flat'); // its first sloping segment made flat
    expect(manipSolution(heat)).toEqual([48, 58, 68, 78, 88, 98]); // the rate the fixed points give
    expect(isCorrect(heat, [48, 58, 68, 78, 88, 88])).toBe(false);
    expect(manipSolution(rate)).toEqual([0, 60, 120, 180, 240, 300]);
    expect(isCorrect(rate, [0, 0, 0, 0, 0, 0])).toBe(false); // flat is uniform, but not 60 an hour
    expect(manipSolution(perFive)).toEqual([0, 100, 200, 300]); // a rate is per one unit of x: 20 a minute is 100 in five
    expect(isCorrect(perFive, [100, 200, 300, 400])).toBe(true); // no start asked: any start at that rate
    expect(isCorrect(perFive, [0, 20, 40, 60])).toBe(false); // off the grid: not a state the object can be in
    // only a start asked: a step up would leave the axis (2 to 10), a step down too, so the example is flat, also uniform
    expect(manipSolution(free)).toEqual([2, 2, 2, 2, 2]);
    expect(isCorrect(free, [2, 3.5, 5, 6.5, 8])).toBe(false); // uniform, but between grid lines
  });
  it('a fixed point stays where it is, under a drag, a step button and every key, and never counts as moved', () => {
    const m = walk.manip; const v = [0, 200, 200, 200];
    expect(graphMove(m, v, 0, 400)).toBe(v); // the drag and the step buttons go through graphMove
    for (const key of ['ArrowUp', 'ArrowDown', 'Home', 'End', 'ArrowLeft', 'ArrowRight', 'a']) expect(graphKey(m, v, 0, key)).toBe(v);
    expect(isCorrect(walk, [100, 400, 400, 0])).toBe(false); // a state with the fixed point elsewhere is not one
    // a point that moves: snapped to a grid line, kept on the axis; a move to where it is changes nothing
    expect(graphMove(m, v, 1, 437)).toEqual([0, 400, 200, 200]);
    expect(graphMove(m, v, 1, 9999)).toEqual([0, 600, 200, 200]);
    expect(graphMove(m, v, 1, -50)).toEqual([0, 0, 200, 200]);
    expect(graphMove(m, v, 1, 210)).toBe(v);
    expect(graphKey(m, v, 2, 'ArrowUp')).toEqual([0, 200, 300, 200]);
    expect(graphKey(m, v, 2, 'End')).toEqual([0, 200, 600, 200]);
    expect(graphKey(m, v, 2, 'Home')).toEqual([0, 200, 0, 200]);
    // a fixed point between grid lines keeps its value (a given), and the others still move on the grid
    const h = heat.manip; const hv = h.start;
    expect(graphMove(h, hv, 1, 70)).toBe(hv);
    expect(graphKey(h, hv, 2, 'ArrowUp')).toEqual([48, 58, 68, 58, 58, 58]);
  });
  it('is written as points with their units, as a shape in words, and set out for the tutor', () => {
    expect(answerText(walk)).toBe('⁦(0, 0) → (5, 400) → (10, 400) → (15, 0)⁩ (x בדקות, y במטרים)');
    expect(answerText(walk, [0, 300, 300, 0])).toBe('⁦(0, 0) → (5, 300) → (10, 300) → (15, 0)⁩ (x בדקות, y במטרים)');
    expect(answerText(shape)).toBe('קטעים משמאל לימין: עולה, עולה, קבוע, קבוע, יורד, יורד');
    expect(answerText(rate)).toBe('קצב אחיד: כל קטע משתנה באותו מספר, מתחילים ב־0, 60 לכל יחידה של x; למשל ⁦(0, 0) → (1, 60) → (2, 120) → (3, 180) → (4, 240) → (5, 300)⁩ (x בשעות, y בק״מ)');
    expect(manipPlain(walk)).toBe('[גרף: ציר x זמן מ־0 עד 15 כל 5; ציר y מרחק מהבית מ־0 עד 600 כל 100; מזיזים נקודה מעל כל ערך של x; הנקודה הראשונה קבועה]');
    expect(manipPlain(shape)).toBe('[גרף: ציר x x מ־0 עד 6 כל 1; ציר y y מ־0 עד 8 כל 1; מזיזים נקודה מעל כל ערך של x]');
    expect(manipPlain(heat)).toMatch(/; שתי הנקודות הראשונות קבועות\]$/);
    expect(manipPlain(rate)).toMatch(/; קו קבוע נוסף רכב ב: \(0, 300\) → \(5, 100\)\]$/);
    expect(graphXs(heat.manip)).toEqual([4, 5, 6, 7, 8, 9]);
  });
  it('draws each point as a slider; in a check no value is shown or spoken, only squares above the axis', () => {
    const open = html(GraphDraw, { m: walk.manip, value: [0, 400, 300, 200], answer: walk.answer });
    expect(open).toContain('role="group" aria-label="גרף: מרחק מהבית לפי זמן"');
    expect(open.match(/role="slider"/g)).toHaveLength(4);
    expect(open).toContain('aria-valuetext="ב־5 דקות: 400 מטרים"');
    expect(open).toMatch(/<g[^>]*aria-readonly="true"[^>]*aria-valuetext="ב־0 דקות: 0 מטרים"/); // the fixed start
    expect(open).toContain('class="manip-readout"');
    expect(open).toContain('<b dir="ltr">400</b>'); // the step label of the chosen point (5)
    const check = html(GraphDraw, { m: walk.manip, value: [0, 400, 300, 200], answer: walk.answer, test: true });
    expect(check).not.toContain('manip-readout');
    expect(check).not.toMatch(/<b[ >]/);
    expect(check).toContain('aria-valuetext="ב־5 דקות: 4 משבצות מעל הציר"');
    expect(check).toContain('aria-valuetext="ב־0 דקות: על הציר"');
    expect(check).not.toMatch(/מטרים"/); // no value in words (the axes keep their numbers: the eye reads the grid)
    expect(squaresWords(walk.manip, 100)).toBe('משבצת אחת מעל הציר');
    for (const out of [open, check]) expect(out).not.toMatch(/NaN|undefined/);
  });
  it('shows the answer once it is revealed, and a hint marks only what is off', () => {
    const shown = html(GraphDraw, { m: walk.manip, value: [0, 300, 400, 100], answer: walk.answer, reveal: true, locked: true });
    expect(shown).toContain('class="mp-graph-ghost"');
    expect(html(GraphDraw, { m: walk.manip, value: [0, 400, 400, 0], answer: walk.answer, reveal: true, locked: true })).not.toContain('mp-graph-ghost');
    const hinted = html(GraphDraw, { m: walk.manip, value: [0, 400, 300, 200], answer: walk.answer, hint: true });
    expect(hinted.match(/class="mp-graph-hint"/g)).toHaveLength(2); // the points at 10 and 15
    const seg = html(GraphDraw, { m: shape.manip, value: [4, 5, 6, 6, 5, 4, 4], answer: shape.answer, hint: true });
    expect(seg.match(/class="mp-graph-hint-seg"/g)).toHaveLength(2); // down where flat, flat where down were asked
    expect(html(GraphDraw, { m: rate.manip, value: rate.manip.start, answer: rate.answer })).toMatch(/class="mp-graph-ref"><polyline/);
  });
});

describe('the situation graph (sgraph, FUNC-1) is drawn and said with every number', () => {
  const walk = { type: 'sgraph', x: { max: 45, step: 5, label: 'זמן', unit: 'דקות', every: 2 }, y: { max: 700, step: 100, label: 'מרחק מהבית', unit: 'מטרים' }, series: [{ pts: [[0, 0], [10, 600], [25, 600], [45, 0]] }], bands: [{ from: 10, to: 25 }], guide: { x: 5, y: 300 } };
  const temp = { type: 'sgraph', x: { min: 6, max: 18, step: 2, label: 'שעה' }, y: { min: 10, max: 26, step: 1, every: 2, label: 'טמפרטורה', unit: 'מעלות' }, series: [{ pts: [[6, 12], [8, 15], [10, 18], [12, 22], [14, 24], [16, 21], [18, 18]], dots: true }], marks: [{ x: 14, y: 24, label: 'A' }] };
  const meet = { type: 'sgraph', x: { max: 4, step: 1, label: 'זמן', unit: 'שעות' }, y: { max: 240, step: 60, label: 'מרחק מתל אביב', unit: 'ק״מ' }, series: [{ pts: [[0, 0], [4, 240]], label: 'רכב א' }, { pts: [[0, 240], [4, 0]], label: 'רכב ב', dashed: true }], meet: true, riseRun: { from: 1, to: 3 }, dirArrow: true };
  const vase = { type: 'sgraph', x: { max: 10, step: 1, label: 'זמן', unit: 'שניות', every: 2 }, y: { max: 20, step: 2, label: 'גובה המים', unit: 'ס״מ' }, series: [{ pts: [[0, 0], [4, 4], [7, 10], [9, 16], [10, 20]], smooth: true }] };
  it('figPlain reads the axes, every point in order and what is marked', () => {
    expect(figPlain(walk)).toBe('גרף: מרחק מהבית (מטרים) לפי זמן (דקות); ציר x מ־0 עד 45, קו כל 5, מספר כל 10; ציר y מ־0 עד 700, קו כל 100; (0, 0) → (10, 600) → (25, 600) → (45, 0); מסומן על ציר x מ־10 עד 25; קו עזר מ־x = 5 עד הגרף, בגובה 300; קו עזר מ־y = 300 עד הגרף, ב־x = 5 וב־x = 35');
    expect(figPlain(temp)).toBe('גרף: טמפרטורה (מעלות) לפי שעה; ציר x מ־6 עד 18, קו כל 2; ציר y מ־10 עד 26, קו כל 1, מספר כל 2; נקודות (6, 12), (8, 15), (10, 18), (12, 22), (14, 24), (16, 21), (18, 18); הנקודה A ב־(14, 24)');
    expect(figPlain(meet)).toBe('גרף: מרחק מתל אביב (ק״מ) לפי זמן (שעות); ציר x מ־0 עד 4, קו כל 1; ציר y מ־0 עד 240, קו כל 60; רכב א: (0, 0) → (4, 240); רכב ב: (0, 240) → (4, 0); שינוי ב־x: 2, שינוי ב־y: 120; הקווים נפגשים ב־(2, 120); חץ משמאל לימין');
    expect(figPlain(vase)).toMatch(/\(קו מעוגל\)$/);
    // a screen reader hears the same as the tutor: the reading is the picture's content
    for (const f of [walk, temp, meet, vase]) expect(figWords(f)).toBe(figPlain(f));
  });
  it('places what it marks on the series', () => {
    const pts = walk.series[0].pts;
    expect(seriesAt(pts, 5)).toBe(300); expect(seriesAt(pts, 35)).toBe(300); expect(seriesAt(pts, 50)).toBeNull();
    expect(seriesCrossings(pts, 300)).toEqual([5, 35]);
    expect(seriesCrossings(pts, 600)).toEqual([10, 25]); // a flat piece at that height: its two ends
    expect(seriesMeet(meet.series[0].pts, meet.series[1].pts)).toEqual([2, 120]);
    expect(seriesMeet([[0, 0], [5, 100]], [[0, 50], [5, 150]])).toBeNull(); // parallel
  });
  it('each renders as one picture, with its words and no broken numbers', () => {
    for (const f of [walk, temp, meet, vase]) {
      const out = renderToStaticMarkup(createElement(Figure, { fig: f }));
      expect(out).toMatch(/<svg [^>]*class="figure fig-obj fig-sgraph" role="img"/);
      expect(out).not.toMatch(/NaN|undefined|Infinity/);
      expect(out).toContain(`aria-label="${figPlain(f)}"`);
    }
    const out = renderToStaticMarkup(createElement(Figure, { fig: meet }));
    expect(out).toContain('משמאל לימין');
    expect(out.match(/class="fig-sgraph-rr-num"[^>]*>([^<]+)</g).map((t) => t.replace(/.*>|<$/g, ''))).toEqual(['2', '120']);
    expect(out).toContain('class="fig-sgraph-meet"');
    expect(renderToStaticMarkup(createElement(Figure, { fig: temp })).match(/class="fig-sgraph-dot"/g)).toHaveLength(7);
  });
});

// ---------------------------------------------------------------- stage 5: the protractor and the clock (FUNC-1.2, 1.3b)
describe('the protractor in the angle object (FUNC-1.2)', () => {
  const build = (target, extra = {}) => fixture({ kind: 'angle', protractor: true, mode: 'build', from: 'right', start: 90, ...extra }, target);
  const align = (arms, answer, extra = {}) => fixture({ kind: 'angle', protractor: true, mode: 'align', arms, start: 0, ...extra }, answer);
  it('build: the target is right, the other scale\'s reading is the near miss (a right angle: one step off)', () => {
    for (const it of [build(40), build(130, { from: 'left' }), build(90, { start: 45 }), build(15, { base: 30 })]) solves(it);
    expect(manipWrong(build(40))).toBe(140);
    expect(manipWrong(build(130, { from: 'left' }))).toBe(50);
    expect(manipWrong(build(90, { start: 45 }))).toBe(95);
    expect(isCorrect(build(40), 140)).toBe(false);
  });
  it('align: right at exactly two turns for every pair of arms, wrong at the other two that put the baseline on an arm', () => {
    let pairs = 0;
    for (let a = 0; a < 360; a += 5) {
      for (let s = 5; s <= 175; s += 5) {
        const arms = [a, mod360(a + s)]; const turns = armTurns(arms);
        expect(turns, `${arms}`).toHaveLength(4);
        const right = turns.filter((r) => protAligned(arms, r));
        expect(right, `${arms}`).toHaveLength(2);
        expect(turns.filter((r) => !protAligned(arms, r)).every((r) => baselineOnArm(arms, r)), `${arms}`).toBe(true);
        // and no turn off an arm is right
        for (let r = 0; r < 360; r += 5) if (!turns.includes(r)) expect(protAligned(arms, r), `${arms} at ${r}`).toBe(false);
        pairs += 1;
      }
    }
    expect(pairs).toBe(72 * 35);
    // the spec's own case: arms 30° and 95°: 30 and 275 are right, 95 and 210 put the baseline on an arm with the angle outside
    expect(armTurns([30, 95]).filter((r) => protAligned([30, 95], r))).toEqual([30, 275]);
    expect(armTurns([30, 95]).filter((r) => !protAligned([30, 95], r))).toEqual([95, 210]);
  }, 30_000); // 2520 pairs of arms, each turned all the way round: about a second alone, longer on a busy machine
  it('align: the solution is right, the near miss and the start are not, and the words hold no undefined', () => {
    const it = align([30, 95], 30, { letters: { vertex: 'B', a: 'A', b: 'C' } });
    solves(it);
    expect(manipWrong(it)).toBe(95);
    expect(isCorrect(it, 275)).toBe(true);
    expect(manipSolution(align([30, 95], 40))).toBe(30); // an answer that is not a right turn is replaced by one
  });
  it('is said in words: build by its angle, align by its turn; the setup for the tutor', () => {
    expect(answerText(build(40))).toBe('40°');
    expect(answerText(align([30, 95], 30), 210)).toBe('מד הזווית מסובב ב־210°');
    expect(manipPlain(build(40))).toBe('[מד זווית על הקודקוד; השוק הקבועה על 0 של הסולם שמתחיל מימין; מסובבים את הקרן]');
    expect(manipPlain(build(130, { from: 'left', letters: { vertex: 'B', a: 'A', b: 'C' } }))).toBe('[מד זווית על הקודקוד B; השוק הקבועה על 0 של הסולם שמתחיל משמאל; מסובבים את הקרן]');
    expect(manipPlain(align([30, 95], 30))).toBe('[זווית ששוקיה בכיוונים 30° ו־95°; מסובבים את מד הזווית עד שקו האפס שלו על אחת השוקיים]');
  });
  it('a screen reader hears the two numbers at the ray, by scale; and where the baseline is', () => {
    expect(buildWords(build(40).manip, 65)).toBe('הקרן מול 65 בסולם שמתחיל מימין ומול 115 בסולם שמתחיל משמאל');
    expect(buildWords(build(130, { from: 'left' }).manip, 50)).toBe('הקרן מול 130 בסולם שמתחיל מימין ומול 50 בסולם שמתחיל משמאל');
    const m = align([30, 95], 30, { letters: { vertex: 'B', a: 'A', b: 'C' } }).manip;
    expect(alignWords(m, 30)).toBe('קו האפס על השוק BA, והזווית מתחת למד הזווית');
    expect(alignWords(m, 275)).toBe('קו האפס על השוק BC, והזווית מתחת למד הזווית');
    expect(alignWords(m, 210)).toBe('קו האפס על השוק BA, אבל הזווית מחוץ למד הזווית');
    expect(alignWords(m, 60)).toBe('קו האפס בין השוקיים, 30 מעלות מהשוק BA');
    expect(alignWords(m, 0)).toBe('קו האפס 30 מעלות מהשוק BA');
    expect(alignWords({ arms: [30, 95] }, 0)).toBe('קו האפס 30 מעלות מהשוק הראשונה');
  });
  it('draws both modes with their sliders, nothing shown as a number but the scales, and no broken numbers', () => {
    const b = html(AngleTurner, { m: build(40).manip, value: 65, answer: 40 });
    expect(b).toContain('role="slider" aria-label="הקרן"');
    expect(b).toContain('aria-valuetext="הקרן מול 65 בסולם שמתחיל מימין ומול 115 בסולם שמתחיל משמאל"');
    expect(b).not.toContain('manip-readout');
    expect(b).not.toMatch(/<b[ >]/); // no value on the step buttons: the protractor is the reading
    expect(b).toMatch(/viewBox="0 0 300 /);
    const a = html(AngleTurner, { m: align([30, 95], 30).manip, value: 210, answer: 30 });
    expect(a).toContain('role="slider" aria-label="מד הזווית"');
    expect(a).toMatch(/viewBox="0 0 300 300"/);
    // the old mode keeps its 360-wide box
    expect(html(AngleTurner, { m: { kind: 'angle', start: 90 }, value: 90, answer: 120 })).toMatch(/viewBox="0 0 360 212"/);
    for (const out of [b, a]) expect(out).not.toMatch(/NaN|undefined|Infinity/);
  });
});

describe('the protractor and the clock, still (FUNC-1.3b)', () => {
  const prot = { type: 'protractor', arms: [180, 130], letters: { vertex: 'B', a: 'A', b: 'C' } };
  it('figPlain reads the protractor arm by arm, the arm on a 0 first, each arm\'s two numbers by scale', () => {
    expect(figPlain(prot)).toBe('מד זווית על ∢ABC; השוק BA: 180 בסולם שמתחיל מימין, 0 בסולם שמתחיל משמאל; השוק BC: 130 בסולם שמתחיל מימין, 50 בסולם שמתחיל משמאל');
    expect(figPlain({ type: 'protractor', arms: [65, 0], letters: { vertex: 'O', a: 'P', b: 'Q' } })).toBe('מד זווית על ∢POQ; השוק OQ: 0 בסולם שמתחיל מימין, 180 בסולם שמתחיל משמאל; השוק OP: 65 בסולם שמתחיל מימין, 115 בסולם שמתחיל משמאל');
    expect(figPlain({ type: 'protractor', arms: [20, 75] })).toBe('מד זווית על הזווית; השוק הראשונה: 20 בסולם שמתחיל מימין, 160 בסולם שמתחיל משמאל; השוק השנייה: 75 בסולם שמתחיל מימין, 105 בסולם שמתחיל משמאל');
    expect(figWords(prot)).toBe(figPlain(prot));
  });
  it('the clock says its time, and its hands are at their true angles', () => {
    expect(figPlain({ type: 'clock', h: 2, m: 30 })).toBe('שעון: השעה 2:30');
    expect(figPlain({ type: 'clock', h: 10, m: 5 })).toBe('שעון: השעה 10:05');
    expect(clockHands(2, 30)).toEqual({ hour: 75, minute: 180 });
    expect(clockHands(4, 30)).toEqual({ hour: 135, minute: 180 });
    expect(clockHands(12, 0)).toEqual({ hour: 0, minute: 0 });
    expect(clockHands(7, 30)).toEqual({ hour: 225, minute: 180 });
    for (let h = 1; h <= 12; h += 1) for (let m = 0; m < 60; m += 5) {
      const out = renderToStaticMarkup(createElement(Figure, { fig: { type: 'clock', h, m } }));
      const hands = [...out.matchAll(/<line x1="120" y1="120" x2="([\d.-]+)" y2="([\d.-]+)" class="fig-clock-hand (hour|minute)"/g)];
      expect(hands, `${h}:${m}`).toHaveLength(2);
      for (const [, x, y, which] of hands) {
        const deg = mod360((Math.atan2(Number(x) - 120, 120 - Number(y)) * 180) / Math.PI); // clockwise from 12
        expect(Math.abs(mod360(deg - clockHands(h, m)[which] + 180) - 180), `${h}:${m} ${which}`).toBeLessThan(0.05);
      }
    }
  });
  it('each renders as one picture with its words, and no broken numbers', () => {
    for (const fig of [prot, { type: 'protractor', arms: [0, 65], base: 45 }, { type: 'clock', h: 10, m: 0, marks: true }]) {
      const out = renderToStaticMarkup(createElement(Figure, { fig }));
      expect(out).toMatch(/<svg [^>]*role="img"/);
      expect(out).not.toMatch(/NaN|undefined|Infinity/);
      expect(out).toContain(`aria-label="${figPlain(fig)}"`);
    }
    expect(renderToStaticMarkup(createElement(Figure, { fig: { type: 'clock', h: 1, m: 0, marks: true } })).match(/class="fig-clock-tick/g)).toHaveLength(60);
  });
});
