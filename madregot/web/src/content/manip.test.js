import { describe, it, expect, beforeAll } from 'vitest';
import katex from 'katex';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Figure from '@/components/Figure.jsx';
import NumberLine from '@/components/manip/NumberLine.jsx';
import NumberPins from '@/components/manip/NumberPins.jsx';
import FracBar from '@/components/manip/FracBar.jsx';
import DoubleLine from '@/components/manip/DoubleLine.jsx';
import GridShape from '@/components/manip/GridShape.jsx';
import NetFold from '@/components/manip/NetFold.jsx';
import { loadKatex } from '@/components/MathText.jsx';
import { TOPICS, makeItem, isCorrect, answerText, itemPlain, readAnswer, slotsFor, figPlain } from './index.js';
import {
  quadOf, manipSolution, manipWrong, manipText, manipPlain, triangleAngles, rightAtC,
  balanceTilt, balanceSolved, balanceDivisor, balanceReachable, boxesDivisor, balanceSplits, balanceDivide, balanceTex, balanceWords, panWords,
  tilesTex, tilesPairs, tilesWords, areaTex, areaSumTex, rayText, rayTex, rayHas, TILES_MAX,
  fbarDenFor, fbarWords, dlineAt, dlineNum, withUnit, ticksWords, manipCorrect,
} from './manip.js';
import { maxRectArea, polyArea, cutAreas, cutMakesRectangles, cutAt, gridControls, gridStep } from './grid.js';
import { NET_LAYOUTS, netModel, netView, netWithSlot, foldFaces, oblique, netStep, netControls, oppositeFace, closedNeighbours, netfigLabels, prismSides, CYL_N } from './net.js';
import { linText, listMath } from './util.js';
import { holds, texToExpr, identical, seeded } from '@/learn/expr.ts';

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

// ---------------------------------------------------------------- shapes on a grid (stage 2, MEASURE-1.1)
// No stair uses the object yet: these are fixtures, the spec's own explores (area:1, area:2, area:3, area:4, area:5).
describe('shapes on a grid (רשת משבצות)', () => {
  const iso = (t) => `\u2066${t}\u2069`;
  const L = [[0, 0], [8, 0], [8, 4], [5, 4], [5, 6], [0, 6]];
  const para = [[2, 0], [6, 0], [8, 4], [2, 4]]; // the parallelogram (0, 0) (6, 0) (8, 4) (2, 4) less the triangle cut off its left
  const grid = (manip, answer) => fixture({ kind: 'polygon', ...manip }, answer);
  const rect = grid({ grid: [10, 8], task: 'rect', start: { w: 2, h: 2 } }, { mode: 'rect', area: 12, perim: 14 });
  const area = grid({ grid: [10, 8], task: 'rect', start: { w: 1, h: 1 } }, { mode: 'rect', area: 12 });
  const maxA = grid({ grid: [10, 8], task: 'rect', start: { w: 7, h: 1 } }, { mode: 'maxArea', perim: 16 });
  const max14 = grid({ grid: [10, 8], task: 'rect', start: { w: 6, h: 1 } }, { mode: 'maxArea', perim: 14 });
  const move = grid({ grid: [10, 6], task: 'move', shape: para, piece: { pts: [[0, 0], [2, 0], [2, 4]], name: 'המשולש' }, start: { dx: 0, dy: 0 } }, { mode: 'move', dx: 6, dy: 0 });
  const moveUp = grid({ grid: [10, 8], task: 'move', shape: [[0, 0], [6, 0], [6, 3], [0, 3]], piece: { pts: [[0, 4], [3, 4], [3, 7], [0, 7]] }, start: { dx: 0, dy: 0 } }, { mode: 'move', dx: 3, dy: -4 });
  const cut = grid({ grid: [8, 6], task: 'cut', shape: L, start: { axis: 'y', at: 1 } }, { mode: 'cut', lines: [{ axis: 'y', at: 4 }, { axis: 'x', at: 5 }] });
  const cutNear = grid({ grid: [8, 6], task: 'cut', shape: [[0, 0], [6, 0], [6, 2], [3, 2], [3, 4], [0, 4]], start: { axis: 'x', at: 1 } }, { mode: 'cut', lines: [{ axis: 'x', at: 3 }, { axis: 'y', at: 2 }] });
  const cutPair = grid({ grid: [8, 6], task: 'cut', shape: [[0, 0], [6, 0], [6, 4], [0, 4]], start: { axis: 'y', at: 1 } }, { mode: 'cut', lines: [{ axis: 'x', at: 3 }, { axis: 'x', at: 4 }] });
  const apex = grid({ grid: [10, 6], task: 'apex', base: { x0: 0, x1: 8, h: 4 }, start: { x: 6 } }, { mode: 'apex', xs: [0, 8] });
  const all = [rect, area, maxA, max14, move, moveUp, cut, cutNear, cutPair, apex];

  it('every mode: the solution is right, the near miss and the start are not, and the words hold no undefined', () => {
    for (const it of all) solves(it);
  });
  it('rect: every property given holds, either way round; maxArea: the perimeter and the largest area', () => {
    expect([isCorrect(rect, { w: 3, h: 4 }), isCorrect(rect, { w: 4, h: 3 }), isCorrect(rect, { w: 2, h: 6 }), isCorrect(rect, { w: 5, h: 2 })]).toEqual([true, true, false, false]);
    expect(isCorrect(area, { w: 6, h: 2 }) && isCorrect(area, { w: 2, h: 6 }) && isCorrect(area, { w: 3, h: 4 })).toBe(true);
    expect(manipSolution(rect)).toEqual({ w: 4, h: 3 }); // the wider one
    expect(manipWrong(rect)).toEqual({ w: 5, h: 3 });
    expect(manipSolution(area)).toEqual({ w: 6, h: 2 }); // 12 by 1 does not fit the grid
    expect(maxRectArea(16)).toBe(16); expect(maxRectArea(14)).toBe(12); expect(maxRectArea(18)).toBe(20);
    expect(manipSolution(maxA)).toEqual({ w: 4, h: 4 });
    expect(manipSolution(max14)).toEqual({ w: 3, h: 4 });
    expect([isCorrect(max14, { w: 4, h: 3 }), isCorrect(max14, { w: 5, h: 2 }), isCorrect(max14, { w: 3, h: 3 })]).toEqual([true, false, false]);
    expect(isCorrect(rect, { w: 3.5, h: 4 })).toBe(false);
  });
  it('move: exactly the move that fills the gap; cut: any listed line; apex: every x listed', () => {
    expect(isCorrect(move, { dx: 6, dy: 0 })).toBe(true);
    expect(isCorrect(move, { dx: 6 })).toBe(true); // no dy is no move up
    expect(isCorrect(move, { dx: 5, dy: 0 })).toBe(false);
    expect(isCorrect(moveUp, { dx: 3, dy: 0 })).toBe(false);
    expect(isCorrect(cut, { axis: 'x', at: 5 }) && isCorrect(cut, { axis: 'y', at: 4 })).toBe(true);
    expect(isCorrect(cut, { axis: 'x', at: 4 }) || isCorrect(cut, { axis: 'y', at: 5 })).toBe(false);
    // the near miss of a cut: the next line, or the one before when the next is right too
    expect(manipWrong(cut)).toEqual({ axis: 'y', at: 5 });
    expect(manipWrong(cutNear)).toEqual({ axis: 'x', at: 4 });
    expect(manipWrong(cutPair)).toEqual({ axis: 'x', at: 2 }); // 4 is right too
    // a rectangle cut anywhere one way leaves two rectangles: the near miss is a line the other way not listed
    const box = grid({ grid: [8, 6], task: 'cut', shape: [[0, 0], [3, 0], [3, 4], [0, 4]], start: { axis: 'y', at: 1 } }, { mode: 'cut', lines: [{ axis: 'x', at: 1 }, { axis: 'x', at: 2 }] });
    expect(manipWrong(box)).toEqual({ axis: 'y', at: 1 });
    // apex: a right angle above either end of the base
    expect([isCorrect(apex, { x: 0 }), isCorrect(apex, { x: 8 }), isCorrect(apex, { x: 1 })]).toEqual([true, true, false]);
    expect(manipSolution(apex)).toEqual({ x: 0 });
    expect(manipWrong(apex)).toEqual({ x: 1 });
    expect(manipWrong(grid({ grid: [10, 6], task: 'apex', base: { x0: 3, x1: 4, h: 4 }, start: { x: 6 } }, { mode: 'apex', xs: [3, 4] }))).toEqual({ x: 2 }); // never another right place
  });
  it('a cut is two rectangles only along the lines that continue the missing corner, and each part has its area', () => {
    for (let at = 1; at <= 7; at += 1) expect(cutMakesRectangles(L, { axis: 'x', at }), `x = ${at}`).toBe(at === 5);
    for (let at = 1; at <= 5; at += 1) expect(cutMakesRectangles(L, { axis: 'y', at }), `y = ${at}`).toBe(at === 4);
    expect(cutAreas(L, { axis: 'y', at: 4 })).toEqual([32, 10]);
    expect(cutAreas(L, { axis: 'x', at: 5 })).toEqual([30, 12]);
    expect(polyArea(L)).toBe(42);
  });
  it('tapping a grid line sets the cut there: the nearest line of the cut\'s direction, inside the shape', () => {
    expect(cutAt(cut.manip, 'x', 4.7)).toEqual({ axis: 'x', at: 5 });
    expect(cutAt(cut.manip, 'x', 5.4)).toEqual({ axis: 'x', at: 5 });
    expect(cutAt(cut.manip, 'y', 3.6)).toEqual({ axis: 'y', at: 4 });
    expect(cutAt(cut.manip, 'x', -2)).toEqual({ axis: 'x', at: 1 }); // never on the shape's edge
    expect(cutAt(cut.manip, 'y', 9)).toEqual({ axis: 'y', at: 5 });
    expect(isCorrect(cut, cutAt(cut.manip, 'x', 4.8))).toBe(true);
  });
  it('every task reaches its answer by its steppers alone, without a drag', () => {
    for (const it of all) {
      const keys = gridControls(it.manip, it.answer);
      const seen = new Set([JSON.stringify(it.manip.start)]); const queue = [it.manip.start]; let found = null;
      while (queue.length && !found) {
        const v = queue.shift();
        if (isCorrect(it, v)) { found = v; break; }
        for (const k of keys) for (const d of [-1, 1]) {
          const n = gridStep(it.manip, v, k, d, it.answer); const s = JSON.stringify(n);
          if (!seen.has(s)) { seen.add(s); queue.push(n); }
        }
      }
      expect(found, `${it.manip.task} ${JSON.stringify(it.answer)}`).toBeTruthy();
    }
    // the up stepper is there only when the answer moves the piece up or down
    expect(gridControls(move.manip, move.answer)).toEqual(['dx']);
    expect(gridControls(moveUp.manip, moveUp.answer)).toEqual(['dx', 'dy']);
    // a step never leaves the grid
    expect(gridStep(rect.manip, { w: 10, h: 8 }, 'w', 1, rect.answer)).toEqual({ w: 10, h: 8 });
    expect(gridStep(move.manip, { dx: 8, dy: 0 }, 'dx', 1, move.answer)).toEqual({ dx: 8, dy: 0 }); // the triangle's right end is at x 10
    expect(gridStep(move.manip, { dx: 2, dy: 0 }, 'dy', 1, move.answer)).toEqual({ dx: 2, dy: 0 }); // no move up when the answer has none
    expect(gridStep(cut.manip, { axis: 'y', at: 4 }, 'axis', 1, cut.answer)).toEqual({ axis: 'x', at: 4 });
  });
  it('is said in words, as the spec writes them', () => {
    expect(answerText(rect)).toBe('מלבן 4 על 3');
    expect(answerText(maxA)).toBe('מלבן 4 על 4');
    expect(answerText(rect, { w: 3, h: 4 })).toBe('מלבן 3 על 4');
    expect(answerText(move)).toBe('המשולש הוזז 6 משבצות ימינה');
    expect(answerText(moveUp)).toBe('החלק הוזז 3 משבצות ימינה ו־4 משבצות למטה');
    expect(answerText(move, { dx: -1, dy: 0 })).toBe('המשולש הוזז משבצת אחת שמאלה');
    expect(answerText(cut, { axis: 'x', at: 5 })).toBe(`חיתוך לאורך בקו ${iso('x = 5')}`);
    expect(answerText(cut)).toBe(`חיתוך לרוחב בקו ${iso('y = 4')} או חיתוך לאורך בקו ${iso('x = 5')}`);
    expect(answerText(apex, { x: 0 })).toBe(`הקודקוד מעל ${iso('x = 0')}`);
    expect(answerText(apex)).toBe(`הקודקוד מעל ${iso('x = 0')} או מעל ${iso('x = 8')}`);
    expect(manipPlain(rect)).toBe('[רשת משבצות 10 על 8; בונים מלבן מהפינה השמאלית התחתונה: גוררים את הפינה שמולה, או משנים רוחב וגובה]');
    expect(manipPlain(apex)).toBe(`[רשת משבצות 10 על 6; משולש שבסיסו על הקו ${iso('y = 0')} מ־${iso('x = 0')} עד ${iso('x = 8')}, והקודקוד העליון זז על קו מקווקו בגובה 4]`);
    for (const it of all) expect(itemPlain(it)).not.toMatch(/undefined|NaN/);
  });
  it('draws: the readout and the spoken state in practice; in a check only what the student set', () => {
    const open = html(GridShape, { m: rect.manip, value: { w: 3, h: 4 }, answer: rect.answer });
    expect(open).toContain('aria-roledescription="רשת משבצות"');
    expect(open).toContain('aria-valuetext="מלבן ברוחב 3 ובגובה 4 משבצות, שטח 12, היקף 14"');
    expect(open).toContain('<span>רוחב 3 · גובה 4</span><span>שטח 12 משבצות · היקף 14</span>');
    const check = html(GridShape, { m: rect.manip, value: { w: 3, h: 4 }, answer: rect.answer, test: true });
    expect(check).toContain('aria-valuetext="מלבן ברוחב 3 ובגובה 4 משבצות"');
    expect(check).toContain('רוחב 3 · גובה 4');
    expect(check).not.toMatch(/שטח|היקף|mp-grid-shape hit/);
    // a right cut shows each part's area outside a check, and not in one
    expect(html(GridShape, { m: cut.manip, value: { axis: 'y', at: 4 }, answer: cut.answer })).toContain('שני מלבנים: 32 ו־10 משבצות');
    expect(html(GridShape, { m: cut.manip, value: { axis: 'y', at: 4 }, answer: cut.answer, test: true })).not.toContain('שני מלבנים');
    expect(html(GridShape, { m: cut.manip, value: { axis: 'y', at: 3 }, answer: cut.answer })).not.toContain('שני מלבנים');
    // the apex keeps its base, height and area wherever the vertex is: the area does not change
    for (const x of [0, 3, 8]) expect(html(GridShape, { m: apex.manip, value: { x }, answer: apex.answer })).toContain('בסיס 8 · גובה 4 · שטח 16 משבצות');
    // the move steppers: הזזה, and למעלה only when the answer has a dy
    expect(html(GridShape, { m: move.manip, value: { dx: 2, dy: 0 }, answer: move.answer })).not.toContain('למעלה');
    expect(html(GridShape, { m: moveUp.manip, value: { dx: 0, dy: 0 }, answer: moveUp.answer })).toContain('aria-label="למעלה"');
    // the cut's direction: two buttons, pressed as the cut lies
    expect(html(GridShape, { m: cut.manip, value: { axis: 'x', at: 5 }, answer: cut.answer })).toMatch(/aria-pressed="true"[^>]*>לחתוך לאורך/);
    for (const it of all) {
      const out = html(GridShape, { m: it.manip, value: it.manip.start, answer: it.answer, reveal: true });
      expect(out, it.manip.task).not.toMatch(/NaN|undefined/);
      expect(out, `${it.manip.task}: the answer is drawn after a miss`).toMatch(/mp-grid-ghost/);
    }
  });
});

describe('the geo figure of stage 2: a grid, circles and arcs, parts taken away or added', () => {
  const iso = (t) => `\u2066${t}\u2069`;
  const gridFig = { type: 'geo', label: 'משולש על רשת', pts: { A: [0, 0], B: [5, 0], C: [2, 3] }, polys: [{ pts: ['A', 'B', 'C'] }], grid: [0, 0, 6, 4] };
  const circleFig = { type: 'geo', pts: { O: [0, 0], _e: [5, 0] }, circles: [{ c: 'O', r: 5, label: '5' }], dots: ['O'] };
  const ring = { type: 'geo', pts: { M: [0, 0] }, circles: [{ c: 'M', r: 4, fill: true }, { c: 'M', r: 6, dash: true, label: '6' }], arcs: [{ c: 'M', r: 2, from: 0, to: 180 }] };
  const tones = { type: 'geo', pts: { A: [0, 0], B: [8, 0], C: [8, 6], D: [0, 6], E: [5, 4], F: [8, 4], G: [5, 6] }, polys: [{ pts: ['A', 'B', 'C', 'D'] }, { pts: ['E', 'F', 'C', 'G'], tone: 'cut' }, { pts: ['A', 'B', 'F'], tone: 'add' }], segs: [{ a: 'A', b: 'B', label: '8' }, { a: 'B', b: 'C', label: '6' }] };
  it('each renders, with no broken numbers, and draws what it holds', () => {
    for (const fig of [gridFig, circleFig, ring, tones]) {
      const out = renderToStaticMarkup(createElement(Figure, { fig }));
      expect(out).toMatch(/<svg/);
      expect(out).not.toMatch(/NaN|undefined|Infinity/);
    }
    const g = renderToStaticMarkup(createElement(Figure, { fig: gridFig }));
    expect((g.match(/fg-geo-grid/g) || []).length).toBe(7 + 5); // 7 lines across x 0..6, 5 across y 0..4
    const c = renderToStaticMarkup(createElement(Figure, { fig: ring }));
    expect((c.match(/class="fg-circle/g) || []).length).toBe(2);
    expect(c).toMatch(/fg-circle dashed/); expect(c).toMatch(/fg-circle filled/); expect(c).toMatch(/fg-geo-arc/); expect(c).toMatch(/>6</);
    const t = renderToStaticMarkup(createElement(Figure, { fig: tones }));
    expect(t).toMatch(/fg-tone-cut[^>]*style="fill:url\(#geo-hatch-/); expect(t).toMatch(/<pattern id="geo-hatch-/); expect(t).toMatch(/fg-tone-add/);
  });
  it('figPlain reads every number drawn: the corners on a grid, the radius written on a circle, the sides', () => {
    expect(figPlain(gridFig)).toBe(`רשת משבצות 6 על 4, כל משבצת ריבוע שצלעו 1; צורה שקודקודיה A${iso('(0, 0)')} B${iso('(5, 0)')} C${iso('(2, 3)')}`);
    expect(figPlain(circleFig)).toBe('עיגול שמרכזו O ורדיוסו 5');
    expect(figPlain(ring)).toBe('עיגול שמרכזו M; עיגול מקווקו שמרכזו M ורדיוסו 6; חצי עיגול שמרכזו M');
    expect(figPlain({ type: 'geo', pts: { _o: [0, 0] }, circles: [{ c: '_o', r: 3, label: 'r' }] })).toBe('עיגול שרדיוסו r');
    expect(figPlain(tones)).toBe('מצולע ABCD; מצולע EFCG (חלק שהוסר, מקווקו); מצולע ABF (חלק שנוסף, צבוע); על הקטעים כתוב: 8, 6');
    // a geo drawing with none of these says what it said before
    expect(figPlain({ type: 'geo', pts: { A: [0, 0], B: [1, 0], C: [0, 1] }, polys: [{ pts: ['A', 'B', 'C'] }] })).toBe('');
    // every number written in the drawings is in its words
    for (const fig of [gridFig, circleFig, ring, tones]) {
      const words = figPlain(fig);
      const drawn = [...(fig.circles || []).map((x) => x.label), ...(fig.segs || []).map((x) => x.label)].filter((x) => x != null);
      drawn.forEach((n) => expect(words).toContain(n));
    }
  });
});

// ---------------------------------------------------------------- nets of solids (stage 3, MEASURE-1.2 and 1.5)
// No stair uses the object yet: these are fixtures, the spec's own explores (solid:1–4, circle:3, space:1) and every net.
describe('nets of solids (פריסה)', () => {
  const net = (manip, answer) => fixture({ kind: 'net', ...manip }, answer);
  const boxFold = net({ solid: 'box', dims: { a: 4, b: 3, c: 2 }, layout: 'cross', task: 'fold', start: { t: 0 } }, { mode: 'fold', t: 1 });
  const prismFold = net({ solid: 'prism', dims: { p: 3, q: 4, r: 5, L: 10 }, task: 'fold', start: { t: 0 } }, { mode: 'fold', t: 1 });
  const unroll = net({ solid: 'cylinder', dims: { r: 2, h: 5 }, task: 'fold', start: { t: 1 } }, { mode: 'fold', t: 0 });
  const face = net({ solid: 'cube', dims: { a: 3 }, layout: 'cross', task: 'face', shade: 'A', start: { face: null } }, { mode: 'face', face: 'C' });
  const prismFix = net({ solid: 'prism', dims: { p: 6, q: 8, r: 10, L: 5 }, task: 'fix', loose: 'E', start: { slot: null } }, { mode: 'slot', ok: ['A-down', 'B-down', 'C-down'] });
  const cylFix = net({ solid: 'cylinder', dims: { r: 2, h: 5 }, task: 'fix', start: { slot: null } }, { mode: 'slot', ok: ['side-down'] });
  const build = net({ solid: 'box', task: 'build', start: { a: 1, b: 1, c: 2 } }, { mode: 'build', V: 24, fixed: { c: 2 } });
  const diag = net({ solid: 'box', task: 'build', start: { a: 1, b: 1, c: 1 } }, { mode: 'build', d2: 81 });
  const surf = net({ solid: 'box', task: 'build', start: { a: 1, b: 1, c: 1 } }, { mode: 'build', S: 52 });
  const prismBuild = net({ solid: 'prism', task: 'build', start: { p: 1, q: 1, L: 6 } }, { mode: 'build', V: 36, fixed: { L: 6 } });
  const all = [boxFold, prismFold, unroll, face, prismFix, cylFix, build, diag, surf, prismBuild];

  // ---- an independent check that a net closed: no two faces on one place, and the faces bound the solid's volume
  // (a closed surface's volume does not depend on where it is measured from; a surface with a gap's does)
  const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dt = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const newell = (P) => P.reduce((n, p, i) => { const q = P[(i + 1) % P.length]; return [n[0] + (p[1] - q[1]) * (p[2] + q[2]), n[1] + (p[2] - q[2]) * (p[0] + q[0]), n[2] + (p[0] - q[0]) * (p[1] + q[1])]; }, [0, 0, 0]);
  function volumeFrom(F, o) {
    return F.reduce((v, f) => {
      const P = dt(newell(f.p3), f.n) >= 0 ? f.p3 : [...f.p3].reverse(); // each face wound with its outer side
      let s = 0; for (let i = 1; i < P.length - 1; i += 1) s += dt(sub3(P[0], o), crs(sub3(P[i], o), sub3(P[i + 1], o))) / 6;
      return v + s;
    }, 0);
  }
  function overlapping(F) {
    for (let i = 0; i < F.length; i += 1) for (let j = i + 1; j < F.length; j += 1) {
      const a = F[i]; const b = F[j];
      if (Math.abs(Math.abs(dt(a.n, b.n)) - 1) > 1e-6 || Math.abs(dt(sub3(b.p3[0], a.p3[0]), a.n)) > 1e-6) continue; // not in one plane
      const u = Math.abs(a.n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]; const e1 = crs(a.n, u); const e2 = crs(a.n, e1);
      const flat = (f) => f.p3.map((p) => [dt(p, e1), dt(p, e2)]);
      const A = flat(a); const B = flat(b);
      const axes = [A, B].flatMap((P) => P.map((p, k) => { const q = P[(k + 1) % P.length]; return [q[1] - p[1], p[0] - q[0]]; }));
      if (axes.every((ax) => { const pa = A.map((p) => p[0] * ax[0] + p[1] * ax[1]); const pb = B.map((p) => p[0] * ax[0] + p[1] * ax[1]); return Math.min(Math.max(...pa), Math.max(...pb)) - Math.max(Math.min(...pa), Math.min(...pb)) > 1e-6; })) return true;
    }
    return false;
  }
  const discArea = (r) => { const w = (2 * Math.PI * r) / CYL_N; return (CYL_N * w * w) / (4 * Math.tan(Math.PI / CYL_N)); };
  function volumeOf(m) {
    if (m.solid === 'cube') return m.dims.a ** 3;
    if (m.solid === 'box') return m.dims.a * m.dims.b * m.dims.c;
    if (m.solid === 'prism') { const s = prismSides(m.dims); const h = (s.p + s.q + s.r) / 2; return Math.sqrt(h * (h - s.p) * (h - s.q) * (h - s.r)) * s.L; }
    return discArea(m.dims.r) * m.dims.h;
  }
  /** Did these faces, folded to t = 1, close the solid? */
  function closes(m, tree) {
    const F = foldFaces(tree, 1);
    if (F.length !== { cube: 6, box: 6, prism: 5, cylinder: CYL_N + 2 }[m.solid] || overlapping(F)) return false;
    const v1 = volumeFrom(F, [0, 0, 0]); const v2 = volumeFrom(F, [37, -21, 13]);
    return Math.abs(v1 - v2) < 1e-6 && Math.abs(v1 - volumeOf(m)) < 1e-6 * Math.max(1, volumeOf(m));
  }

  it('every task: the solution is right, the near miss and the start are not, and the words hold no undefined', () => {
    for (const it of all) solves(it);
    expect(manipWrong(boxFold)).toEqual({ t: 0.5 });
    expect(manipWrong(face).face).not.toBe('C'); expect(closedNeighbours(face.manip, 'C')).toContain(manipWrong(face).face);
    expect(prismFix.answer.ok).not.toContain(manipWrong(prismFix).slot);
    expect(manipSolution(build)).toEqual({ a: 4, b: 3, c: 2 }); // a ≥ b ≥ c, the first found
    expect(manipWrong(build)).toEqual({ a: 5, b: 3, c: 2 });
    expect(manipSolution(diag)).toEqual({ a: 6, b: 6, c: 3 }); // 36 + 36 + 9 = 81
    expect(manipSolution(surf)).toEqual({ a: 4, b: 3, c: 2 }); // 2(12 + 8 + 6) = 52
    expect(manipSolution(prismBuild)).toEqual({ p: 4, q: 3, L: 6 }); // p ≥ q: 4 · 3 / 2 · 6 = 36
    expect(isCorrect(prismBuild, { p: 3, q: 4, L: 6 })).toBe(true);
    expect(isCorrect(build, { a: 6, b: 2, c: 2 }) && isCorrect(build, { a: 3, b: 4, c: 2 })).toBe(true);
    expect(isCorrect(build, { a: 12, b: 1, c: 2 }) || isCorrect(build, { a: 4, b: 2, c: 3 })).toBe(false); // too long; c is pinned at 2
  });
  it('the eleven cube nets, a box, a prism and a cylinder each fold closed', () => {
    for (const layout of Object.keys(NET_LAYOUTS)) {
      const m = { solid: 'cube', dims: { a: 2 }, layout, task: 'fold' };
      expect(closes(m, netModel(m).tree), layout).toBe(true);
    }
    for (const m of [boxFold.manip, prismFold.manip, unroll.manip, { solid: 'prism', dims: { p: 10, q: 5, r: Math.sqrt(45), L: 8 }, task: 'fold' }]) expect(closes(m, netModel(m).tree), m.solid).toBe(true);
    // and half folded, nothing closes
    expect(closes(boxFold.manip, netModel(boxFold.manip).tree.map((f) => ({ ...f, angle: f.angle / 2 })))).toBe(false);
  });
  it('of all 35 hexominoes, exactly the eleven nets fold into a cube', () => {
    const norm = (cells) => { const x0 = Math.min(...cells.map((c) => c[0])); const y0 = Math.min(...cells.map((c) => c[1])); return cells.map(([x, y]) => [x - x0, y - y0]).sort((a, b) => a[0] - b[0] || a[1] - b[1]); };
    const forms = (cells) => { const out = []; let c = cells; for (let r = 0; r < 4; r += 1) { c = c.map(([x, y]) => [y, -x]); out.push(norm(c), norm(c.map(([x, y]) => [-x, y]))); } return out; };
    const key = (cells) => forms(cells).map((f) => JSON.stringify(f)).sort()[0];
    let shapes = new Map([[key([[0, 0]]), [[0, 0]]]]);
    for (let n = 2; n <= 6; n += 1) {
      const next = new Map();
      for (const cells of shapes.values()) for (const [x, y] of cells) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const c = [x + dx, y + dy]; if (cells.some((d) => d[0] === c[0] && d[1] === c[1])) continue;
        const grown = norm([...cells, c]); next.set(key(grown), grown);
      }
      shapes = next;
    }
    expect(shapes.size).toBe(35);
    const folding = [...shapes.values()].filter((cells) => { const m = { solid: 'cube', dims: { a: 1 }, layout: cells, task: 'fold' }; return closes(m, netModel(m).tree); });
    expect(folding.length).toBe(11);
    expect(new Set(folding.map(key))).toEqual(new Set(Object.values(NET_LAYOUTS).map(key)));
  });
  it('fix: every slot in ok folds closed and no other slot does (the cube\'s 11 nets, a box, a prism, a cylinder)', () => {
    const cases = [
      // every face that hangs at the end of a net (a face with one neighbour) can be the loose one
      ...Object.entries(NET_LAYOUTS).flatMap(([layout, cells]) => cells.map((c, i) => [c, 'ABCDEF'[i]])
        .filter(([c]) => cells.filter((d) => Math.abs(d[0] - c[0]) + Math.abs(d[1] - c[1]) === 1).length === 1)
        .map(([, loose]) => ({ solid: 'cube', dims: { a: 2 }, layout, task: 'fix', loose }))),
      { solid: 'box', dims: { a: 4, b: 3, c: 2 }, task: 'fix' }, { solid: 'box', dims: { a: 5, b: 3, c: 2 }, task: 'fix', loose: 'D' },
      prismFix.manip, { ...prismFix.manip, loose: 'D' }, { ...prismFix.manip, layout: 'column' },
      cylFix.manip, { ...cylFix.manip, loose: 'top' },
    ];
    for (const m of cases) {
      const nm = netModel(m);
      const where = `${m.solid} ${m.layout || ''} loose ${m.loose || ''}`;
      // a wrong place to choose: always on a cube's, a prism's and a cylinder's net (a box's back face 5 by 2 fits only
      // the four edges where it closes the box)
      if (!(m.solid === 'box' && m.loose === 'D')) expect(nm.slots.length, where).toBeGreaterThan(nm.okSlots.length);
      expect(nm.okSlots.length, where).toBeGreaterThan(0);
      for (const s of nm.slots) expect(closes(m, netWithSlot(m, s.id)), `${where} ${s.id}`).toBe(nm.okSlots.includes(s.id));
    }
    // the spec's prism: the loose triangle closes the net on the far end of any strip face, never beside its twin
    expect(netModel(prismFix.manip).okSlots).toEqual(['A-down', 'B-down', 'C-down']);
    expect(netModel(prismFix.manip).slots.map((s) => s.id)).toEqual(['A-up', 'A-down', 'B-down', 'C-up', 'C-down']);
    expect(netModel(cylFix.manip).okSlots).toEqual(['side-down']);
    expect(netModel({ solid: 'box', dims: { a: 5, b: 3, c: 2 }, task: 'fix', loose: 'D' }).okSlots).toEqual(['A-left', 'C-right', 'E-up', 'F-down']);
    // a face that holds the net together is never the loose one
    expect(() => netModel({ solid: 'cube', dims: { a: 2 }, layout: 'cross', task: 'fix', loose: 'B' })).toThrow(/holds the net together/);
  });
  it('face: the face opposite the shaded one; a near miss is a face beside it', () => {
    expect(oppositeFace(face.manip, 'A')).toBe('C');
    expect(oppositeFace(face.manip, 'B')).toBe('D');
    expect(oppositeFace(face.manip, 'E')).toBe('F');
    expect(oppositeFace({ solid: 'cube', dims: { a: 1 }, layout: 'steps' }, 'A')).toBe('D');
    expect(oppositeFace(prismFold.manip, 'D')).toBe('E');
    expect(oppositeFace(prismFold.manip, 'A')).toBe(null);
    expect(closedNeighbours(face.manip, 'A').sort()).toEqual(['B', 'D', 'E', 'F']);
  });
  it('build reaches its target from its start by the steppers alone; the fold reaches its end by its stepper', () => {
    for (const it of all.filter((x) => ['build', 'fold'].includes(x.manip.task))) {
      const keys = netControls(it.manip, it.answer);
      const seen = new Set([JSON.stringify(it.manip.start)]); const queue = [it.manip.start]; let found = null;
      while (queue.length && !found) {
        const v = queue.shift();
        if (isCorrect(it, v)) { found = v; break; }
        for (const k of keys) for (const d of [-1, 1]) { const n = netStep(it.manip, v, k, d, it.answer); const s = JSON.stringify(n); if (!seen.has(s)) { seen.add(s); queue.push(n); } }
      }
      expect(found, `${it.manip.task} ${JSON.stringify(it.answer)}`).toBeTruthy();
    }
    // a pinned dimension that the start already has keeps its stepper still; nothing goes past 1..9 or 0..100%
    expect(netControls(build.manip, build.answer)).toEqual(['a', 'b']);
    expect(netStep(build.manip, { a: 9, b: 1, c: 2 }, 'a', 1, build.answer)).toEqual({ a: 9, b: 1, c: 2 });
    expect(netStep(build.manip, { a: 1, b: 1, c: 2 }, 'c', 1, build.answer)).toEqual({ a: 1, b: 1, c: 2 });
    expect(netStep(boxFold.manip, { t: 1 }, 't', 1)).toEqual({ t: 1 });
    expect(netStep(boxFold.manip, { t: 0.5 }, 't', -1)).toEqual({ t: 0.25 });
  });
  it('at 320 px the net fits its drawing at every step of the fold, and each cube face is at least 44 px', () => {
    const px = 288 / 300; // a 300-wide drawing across a 320 px screen less its 16 px margins
    for (const layout of Object.keys(NET_LAYOUTS)) {
      for (const task of ['fold', 'face']) {
        const m = { solid: 'cube', dims: { a: 3 }, layout, task }; const nm = netModel(m); const v0 = netView(m, nm);
        expect([v0.W, v0.H]).toEqual([300, 220]);
        expect(v0.s * 3 * px, `${layout} ${task}`).toBeGreaterThanOrEqual(44);
        // the view follows the fold: every moment fits, and the drawing never shrinks much (a face that starts to turn
        // widens the net a little) nor grows past twice the open net
        for (let t = 0; t <= 1.0001; t += 0.05) {
          const v = netView(m, nm, { t: task === 'fold' ? t : 0 });
          expect(v.s, `${layout} at ${t}`).toBeGreaterThanOrEqual(0.9 * v0.s);
          expect(v.s, `${layout} at ${t}`).toBeLessThanOrEqual(2 * v0.s + 1e-9);
          for (const f of foldFaces(nm.tree, task === 'fold' ? t : 0)) for (const p of f.p3) {
            expect(v.X(p) >= -1e-6 && v.X(p) <= 300 + 1e-6 && v.Y(p) >= -1e-6 && v.Y(p) <= 220 + 1e-6, `${layout} at ${t}`).toBe(true);
          }
        }
      }
    }
    // the faces turn away from the viewer, and the far ones are drawn first: at t = 1 the root is the front
    const F = foldFaces(netModel(boxFold.manip).tree, 1); const front = F.find((f) => f.id === 'B');
    expect(front.n).toEqual([0, 0, -1]);
    expect(oblique([0, 0, 2])[0]).toBeCloseTo(Math.cos(Math.PI / 6), 9); // depth at 30°, half its length
    expect(oblique([0, 0, 2])[1]).toBeCloseTo(0.5, 9);
  });
  it('is said in words, as the spec writes them', () => {
    expect(answerText(boxFold)).toBe('התיבה סגורה');
    expect(answerText(boxFold, { t: 0.5 })).toBe('הפריסה מקופלת עד חצי');
    expect(answerText(unroll)).toBe('הפריסה פתוחה');
    expect(answerText(face)).toBe('פאה C');
    expect(answerText(prismFix)).toBe('הבסיס החסר מתחת לפאה A או הבסיס החסר מתחת לפאה B או הבסיס החסר מתחת לפאה C');
    expect(answerText(cylFix, { slot: 'side-right' })).toBe('הבסיס החסר מימין למעטפת');
    expect(answerText(build)).toBe('תיבה 4 על 3 על 2');
    expect(answerText(prismBuild)).toBe('מנסרה שניצביה 4 ו־3 ואורכה 6');
    expect(manipPlain(boxFold)).toBe('[פריסה של תיבה 4 על 3 על 2; מקפלים ופורשים אותה ברבעים, מפריסה פתוחה עד תיבה סגורה]');
    expect(manipPlain(face)).toBe('[פריסה של קובייה שמקצועה 3; A משמאל ל־B, C מימין ל־B, D מימין ל־C, E מעל B, F מתחת ל־B; פאה A צבועה; מקישים על פאה]');
    expect(manipPlain(prismFix)).toBe('[פריסה של מנסרה משולשת שבסיסה משולש שצלעותיו 6, 8 ו־10, ואורכה 5, בלי פאה E; שמים את הבסיס החסר באחד המקומות המקווקווים]');
    for (const it of all) expect(itemPlain(it)).not.toMatch(/undefined|NaN/);
  });
  it('draws: the fold is a slider with no drag, the faces are buttons, the slots are buttons, the build reads its sizes', () => {
    const fold = html(NetFold, { m: boxFold.manip, value: { t: 0.5 }, answer: boxFold.answer });
    expect(fold).toContain('role="slider"'); expect(fold).toContain('aria-valuetext="הפריסה מקופלת עד חצי"'); expect(fold).toContain('aria-valuenow="50"');
    expect(fold).toContain('mp-net-canvas'); expect(fold).toContain('aria-label="לקפל עוד רבע"');
    expect(html(NetFold, { m: boxFold.manip, value: { t: 1 }, answer: boxFold.answer })).toContain('aria-valuetext="התיבה סגורה"');
    const faces = html(NetFold, { m: face.manip, value: { face: 'B' }, answer: face.answer });
    expect((faces.match(/role="button"/g) || []).length).toBe(6);
    expect(faces).toContain('aria-label="פאה C"'); expect(faces).toMatch(/aria-label="פאה B" aria-pressed="true"/);
    expect(faces).toMatch(/tabindex="0"/);
    const fix = html(NetFold, { m: prismFix.manip, value: { slot: null }, answer: prismFix.answer });
    expect((fix.match(/class="mp-net-slot/g) || []).length).toBe(5);
    expect(fix).toContain('aria-label="לשים את הבסיס החסר מתחת לפאה B"');
    expect(fix).toMatch(/<circle[^>]*r="23"/); // each slot's target at least 46 units across
    const b = html(NetFold, { m: build.manip, value: { a: 4, b: 3, c: 2 }, answer: build.answer });
    expect(b).toContain('<span>תיבה 4 על 3 על 2</span><span>נפח 24 סמ״ק · שטח פנים 52 סמ״ר</span>');
    expect(b).toContain('aria-label="אורך"'); expect(b).toContain('aria-label="רוחב"'); expect(b).toContain('aria-label="גובה"');
    expect(html(NetFold, { m: diag.manip, value: { a: 2, b: 3, c: 4 }, answer: diag.answer })).toContain('<span>אלכסון בריבוע 29</span>');
    const check = html(NetFold, { m: build.manip, value: { a: 4, b: 3, c: 2 }, answer: build.answer, test: true });
    expect(check).toContain('תיבה 4 על 3 על 2'); expect(check).not.toMatch(/נפח|שטח|hit/);
    const pb = html(NetFold, { m: prismBuild.manip, value: { p: 3, q: 4, L: 6 }, answer: prismBuild.answer });
    expect(pb).toContain('aria-label="ניצב א׳"'); expect(pb).toContain('aria-label="ניצב ב׳"'); expect(pb).toContain('שטח הבסיס 6 סמ״ר · נפח 36 סמ״ק');
    for (const it of all) {
      const out = html(NetFold, { m: it.manip, value: it.manip.start, answer: it.answer, reveal: true });
      expect(out, it.manip.task).not.toMatch(/NaN|undefined/);
      expect(out, `${it.manip.task}: the answer is drawn after a miss`).toMatch(/mp-net-ghost/);
    }
  });
  it('the netfig figure reads every number and letter it draws', () => {
    const figs = [
      { type: 'netfig', solid: 'cube', dims: { a: 3 }, layout: 'cross', letters: true, labels: true, shade: 'A' },
      { type: 'netfig', solid: 'box', dims: { a: 4, b: 3, c: 2 }, letters: true, labels: true },
      { type: 'netfig', solid: 'box', dims: { a: 4, b: 3, c: 2 }, letters: true, labels: 'area' },
      { type: 'netfig', solid: 'box', dims: { a: 6, b: 5, c: 3 }, labels: true },
      { type: 'netfig', solid: 'cube', dims: { a: 1 }, layout: 'steps' },
      { type: 'netfig', solid: 'prism', dims: { p: 3, q: 4, L: 10 }, letters: true, labels: true },
      { type: 'netfig', solid: 'prism', dims: { p: 6, q: 8, L: 5 }, labels: 'area' },
      { type: 'netfig', solid: 'cylinder', dims: { r: 2, h: 5 }, labels: true, shade: 'side' },
    ];
    for (const fig of figs) {
      const out = renderToStaticMarkup(createElement(Figure, { fig }));
      expect(out).toMatch(/<svg/); expect(out).not.toMatch(/NaN|undefined|Infinity/);
      const words = figPlain(fig);
      expect(out).toContain(`aria-label="${words}"`);
      const drawn = [...out.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((x) => x[1]).filter((t) => t !== '2πr');
      if (fig.letters || fig.labels) expect(drawn.length, JSON.stringify(fig)).toBeGreaterThan(0);
      for (const t of drawn) expect(words, `${fig.solid}: ${t}`).toContain(t);
    }
    expect(figPlain(figs[0])).toBe('פריסה של קובייה: A משמאל ל־B, C מימין ל־B, D מימין ל־C, E מעל B, F מתחת ל־B; כל פאה ריבוע שצלעו 3; פאה A צבועה');
    expect(figPlain(figs[2])).toBe('פריסה של תיבה: A משמאל ל־B, C מימין ל־B, D מימין ל־C, E מעל B, F מתחת ל־B; שטחי הפאות: A 6, B 8, C 6, D 8, E 12, F 12');
    expect(figPlain(figs[4])).toBe('פריסה של קובייה: בשורה העליונה ריבועים בעמודות 1, 2; בשורה השנייה ריבועים בעמודות 2, 3; בשורה התחתונה ריבועים בעמודות 3, 4');
    expect(netfigLabels(figs[1]).edges.map((e) => e.text)).toEqual(['4', '3', '2']);
    expect(netfigLabels(figs[5]).edges.map((e) => e.text)).toEqual(['3', '4', '5', '10']);
  });
});
