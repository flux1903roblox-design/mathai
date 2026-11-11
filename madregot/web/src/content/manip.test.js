import { describe, it, expect, beforeAll } from 'vitest';
import katex from 'katex';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Figure from '@/components/Figure.jsx';
import NumberLine from '@/components/manip/NumberLine.jsx';
import NumberPins from '@/components/manip/NumberPins.jsx';
import FracBar from '@/components/manip/FracBar.jsx';
import DoubleLine from '@/components/manip/DoubleLine.jsx';
import Simulate, { simRun, simTrial, simCoach } from '@/components/manip/Simulate.jsx';
import Chart, { chartSet, chartKey, pieOwners, pieHit, pieTap, chartCoach, chartValueText } from '@/components/manip/Chart.jsx';
import Manip from '@/components/manip/Manip.jsx';
import { loadKatex } from '@/components/MathText.jsx';
import { TOPICS, makeItem, isCorrect, answerText, itemPlain, readAnswer, slotsFor, figPlain } from './index.js';
import {
  quadOf, manipSolution, manipWrong, manipText, manipPlain, triangleAngles, rightAtC,
  balanceTilt, balanceSolved, balanceDivisor, balanceReachable, boxesDivisor, balanceSplits, balanceDivide, balanceTex, balanceWords, panWords,
  tilesTex, tilesPairs, tilesWords, areaTex, areaSumTex, rayText, rayTex, rayHas, TILES_MAX,
  fbarDenFor, fbarWords, dlineAt, dlineNum, withUnit, ticksWords, manipCorrect,
  simOutcomes, simEmpty, simSentence, simDiag, simGuidedOrder,
} from './manip.js';
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

describe('a random experiment repeated (simulate, DATA-2.1)', () => {
  const RYG = [{ label: 'אדום', parts: 3 }, { label: 'כחול', parts: 5 }, { label: 'ירוק', parts: 4 }];
  const sim = (manip, answer) => fixture({ kind: 'simulate', ...manip }, answer);
  const wheel = sim({ device: 'spinner', sectors: RYG, watch: 0, seed: 20261111, guided: true, truth: true }, { mode: 'trials', atLeast: 1000 });
  const free = sim({ device: 'spinner', sectors: RYG, watch: 0 }, { mode: 'trials', atLeast: 100 });
  const die = sim({ device: 'die', watch: 6, seed: 20261111 }, { mode: 'trials', atLeast: 1000 });
  const coin = sim({ device: 'coin', watch: 0, guided: true }, { mode: 'trials', atLeast: 100 });
  const dice2 = sim({ device: 'dice2', watch: 7, seed: 20261111 }, { mode: 'trials', atLeast: 1000 });
  const QUARTERS = ['\\frac{1}{4}', { tex: '\\frac{1}{2}', tag: 'equiprob' }, '\\frac{3}{4}'];
  const covered = sim({ device: 'spinner', sectors: [{ label: 'אדום', parts: 3 }, { label: 'כחול', parts: 9 }], watch: 0, hidden: true }, { mode: 'estimate', choices: QUARTERS, answer: 0 });
  const bag = sim({ device: 'bag', bag: [{ label: 'אדום', n: 1 }, { label: 'כחול', n: 3 }], watch: 0, hidden: true }, { mode: 'estimate', choices: QUARTERS, answer: 0 });
  const all = [wheel, free, die, coin, dice2, covered, bag];

  it('every device and mode: the solution is right, the near miss is wrong, and the words hold no undefined', () => {
    for (const it of all) solves(it);
    for (const it of all) {
      const s = manipSolution(it);
      expect(s.counts.reduce((a, b) => a + b, 0), JSON.stringify(it.manip)).toBe(s.n);
      expect(s.hist.length).toBe(s.n / 10);
    }
    // the expected run: 1110 spins of a wheel with red 3 of 12 (a guided run is 10, then 100, then 1000)
    expect(manipSolution(wheel)).toMatchObject({ n: 1110, batches: [10, 100, 1000] });
    expect(manipSolution(wheel).counts).toEqual([278, 462, 370]);
    expect(manipSolution(free).batches).toEqual([100]);
    expect(manipSolution(dice2).counts[5]).toBe(Math.round(1000 / 6)); // sum 7, 6 ways of 36
  });

  it('the seeded runs are the ones the spec checked (critique note 29)', () => {
    const m = { ...wheel.manip, guided: false };
    const red = (sizes) => simRun(m, sizes).counts[0];
    expect(Math.abs(red([1000]) / 1000 - 0.25)).toBeLessThanOrEqual(0.05); // 1000 spins from the start: 0.270
    expect(red([1000])).toBe(270);
    expect(red([10])).toBe(2); // red 2 of the first 10
    expect((red([10, 100]) / 110).toFixed(3)).toBe('0.291'); // the stream continues: 10, then 100 more
    expect((red([10, 100, 1000]) / 1110).toFixed(3)).toBe('0.268');
    expect(simRun(die.manip, [1000]).counts[5]).toBe(144); // the die: 6 came 144 times
    expect(simRun(dice2.manip, [1000]).counts[5]).toBe(163); // two dice: sum 7 came 163 times
    // a spin is part floor(12r), the sectors in order; a roll is 1 + floor(6r)
    const at = (r) => simTrial(m, () => r).o;
    expect([at(0), at(2.99 / 12), at(3 / 12), at(7.99 / 12), at(8 / 12), at(0.9999)]).toEqual([0, 0, 1, 1, 2, 2]);
    expect(simTrial(die.manip, () => 0.9999)).toEqual({ o: 5, f: 6 });
    // the line holds the watched count after every 10 trials
    const run = simRun(m, [10, 100]);
    expect(run.hist.length).toBe(11);
    expect(run.hist[0]).toBe(2);
    expect(run.hist[10]).toBe(run.counts[0]);
  });

  it('a guided run counts only in order: 10 first, a 100 before any 1000', () => {
    const run = (batches) => ({ ...simRun({ ...wheel.manip, seed: 1 }, batches) });
    expect(isCorrect(wheel, run([10, 100, 1000]))).toBe(true);
    expect(isCorrect(wheel, run([10, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100]))).toBe(true); // 1010, never a 1000
    expect(isCorrect(wheel, run([1000]))).toBe(false); // one tap on 1000 skips the jumpy start
    expect(isCorrect(wheel, run([100, 1000]))).toBe(false);
    expect(isCorrect(wheel, run([10, 1000]))).toBe(false);
    expect(isCorrect(wheel, run([10, 100]))).toBe(false); // 110 is not 1000
    expect(simGuidedOrder([10, 100, 10, 1000])).toBe(true);
    // without guided, any batches that reach the count
    expect(isCorrect(free, simRun(free.manip, [100]))).toBe(true);
    expect(isCorrect(free, simRun(free.manip, [10, 10]))).toBe(false);
  });

  it('the estimate: right on the wheel\'s fraction; a wrong pick under 100 trials is the small sample, else its own tag', () => {
    const at = (n, pick) => ({ ...simEmpty(covered.manip), n, pick });
    expect(isCorrect(covered, at(0, 0))).toBe(true);
    expect(isCorrect(covered, at(1000, 2))).toBe(false);
    expect(simDiag(covered, at(50, 1))).toBe('small-sample');
    expect(simDiag(covered, at(90, 2))).toBe('small-sample');
    expect(simDiag(covered, at(100, 1))).toBe('equiprob');
    expect(simDiag(covered, at(1000, 2))).toBe(null); // a choice with no tag names nothing
    expect(simDiag(covered, at(10, 0))).toBe(null); // right
    expect(simDiag(covered, manipWrong(covered))).toBe('small-sample');
    expect(answerText(covered)).toBe('בערך 1/4');
    expect(answerText(wheel)).toBe('לפחות 1000 סיבובים');
    expect(answerText(bag, { ...simRun(bag.manip, [100], seeded(3)), pick: 1 })).toMatch(/^1\/2, 100 הוצאות: אדום \d+ פעמים \(0\.\d\d\)$/);
  });

  it('is said in words for the tutor; a covered wheel or bag never says its parts', () => {
    expect(manipPlain(free)).toBe('[גלגל: אדום 3 מתוך 12 חלקים, כחול 5, ירוק 4; מסובבים 10, 100 או 1000 פעמים ורואים את השכיחות היחסית של אדום]');
    expect(manipPlain(wheel)).toContain('(קודם 10, אחר כך 100, ואז 1000)');
    expect(manipPlain(covered)).toBe('[גלגל מכוסה, עם החלקים אדום, כחול; מסובבים 10, 100 או 1000 פעמים ורואים את השכיחות היחסית של אדום; בוחרים בערך איזה חלק: 1/4, 1/2, 3/4]');
    expect(manipPlain(bag)).not.toMatch(/\d כדורים|אדום 1/);
    expect(manipPlain(dice2)).toContain('כמה פעמים יצא כל סכום, ואת השכיחות היחסית של סכום 7');
    expect(simSentence(wheel.manip, simRun(wheel.manip, [10, 100]))).toBe('עד עכשיו 110 סיבובים. אדום: 32 פעמים, שכיחות יחסית 0.29.');
    expect(simSentence(die.manip, simEmpty(die.manip))).toBe('עוד לא הטלתם את הקובייה.');
    expect(simOutcomes(dice2.manip).reduce((a, o) => a + o.p, 0)).toBeCloseTo(1, 12);
  });

  it('מדי: the start, a short run, a long run; in the estimate mode, more trials before a pick', () => {
    const m = wheel.manip;
    expect(simCoach(m, null, wheel.answer, false)).toBe('סובבו 10 פעמים, ואז עוד 100. מה קורה לשכיחות היחסית?');
    expect(simCoach(m, simRun(m, [10]), wheel.answer, true)).toBe('עשרה סיבובים זה מעט: השכיחות היחסית עוד קופצת.');
    expect(simCoach(m, simRun(m, [10, 100, 1000]), wheel.answer, true)).toBe('אחרי הרבה סיבובים השכיחות היחסית כמעט לא זזה.');
    expect(simCoach(die.manip, simRun(die.manip, [10]), die.answer, true)).toBe('עשר הטלות זה מעט: השכיחות היחסית עוד קופצת.');
    expect(simCoach(covered.manip, null, covered.answer, false)).toBe('הגלגל מכוסה. סובבו כמה פעמים, ואז בחרו.');
    expect(simCoach(covered.manip, { ...simRun(covered.manip, [10]), pick: 1 }, covered.answer, true)).toBe('אפשר לסובב עוד לפני שבוחרים.');
    expect(simCoach(bag.manip, null, bag.answer, false)).toBe('לא רואים מה יש בשקית. הוציאו כדור כמה פעמים, ואז בחרו.');
  });

  // the visible text of each button, the way a screen reader names it
  const buttons = (html) => [...html.matchAll(/<button[^>]*?(?:aria-label="([^"]*)")?[^>]*>(.*?)<\/button>/g)]
    .map(([all, label, inner]) => (/aria-label="/.test(all.slice(0, all.indexOf('>'))) ? all.match(/aria-label="([^"]*)"/)[1] : inner.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()));
  it('draws the buttons, the locked ones, the readout and a chart that fits a 288px column', () => {
    const fresh = html(Simulate, { m: wheel.manip, value: null, answer: wheel.answer });
    expect(buttons(fresh)).toEqual(['כל התוצאות', '10 סיבובים', '100 סיבובים, קודם 10', '1000 סיבובים, קודם 100', 'להתחיל מחדש']);
    expect((fresh.match(/aria-disabled="true"/g) || []).length).toBe(2);
    expect(fresh).toContain('קודם 10</span>');
    expect(fresh).toContain('aria-live="polite"');
    expect(fresh).toContain('role="img" aria-label="עוד לא סובבתם את הגלגל."');
    const ten = html(Simulate, { m: wheel.manip, value: simRun(wheel.manip, [10]), answer: wheel.answer });
    expect(buttons(ten).slice(1, 4)).toEqual(['10 סיבובים', '100 סיבובים', '1000 סיבובים, קודם 100']);
    const run = simRun(wheel.manip, [10, 100, 1000]);
    const long = html(Simulate, { m: wheel.manip, value: run, answer: wheel.answer });
    expect(buttons(long).slice(1, 4)).toEqual(['10 סיבובים', '100 סיבובים', '1000 סיבובים']);
    expect(long).not.toContain('aria-disabled');
    expect(long).toContain(`class="mp-sim-chart" role="img" aria-label="${simSentence(wheel.manip, run)}"`);
    expect(long).toContain('mp-sim-truth'); // the dashed line at 1/4, asked for with truth
    expect(long).toContain('<th scope="col">תוצאה</th><th scope="col">כמה פעמים</th><th scope="col">שכיחות יחסית</th>');
    for (const out of [fresh, ten, long]) {
      expect(out).not.toMatch(/NaN|undefined|Infinity/);
      for (const [, w] of out.matchAll(/viewBox="0 0 ([\d.]+) [\d.]+"/g)) expect(Number(w)).toBeLessThanOrEqual(288);
    }
    // no batch past the most a run takes
    const big = html(Simulate, { m: free.manip, value: simRun(free.manip, Array(10).fill(1000)), answer: free.answer });
    expect((big.match(/class="mp-sim-btn" disabled=""/g) || []).length).toBe(3);
    expect(big).not.toMatch(/mp-sim-btn reset" aria-label="להתחיל מחדש" disabled/);
  });

  it('two dice draw the 11 sums as bars; a covered wheel lifts its cover only after the answer', () => {
    const sums = html(Simulate, { m: dice2.manip, value: simRun(dice2.manip, [100]), answer: dice2.answer });
    expect((sums.match(/class="mp-sim-sum( on)?"/g) || []).length).toBe(11);
    expect(sums).toMatch(/כמה פעמים יצא כל סכום: 2: \d+, 3: \d+/);
    const shut = html(Simulate, { m: covered.manip, value: null, answer: covered.answer });
    expect(shut).toContain('aria-label="גלגל מכוסה"');
    expect(shut).not.toMatch(/חלקים שווים|fig-ch-fill/);
    expect(shut).toContain('role="group" aria-label="בערך איזה חלק?"');
    expect(shut).toContain('aria-pressed="false"');
    expect(shut).not.toContain('mp-sim-truth');
    const open = html(Simulate, { m: covered.manip, value: { ...simEmpty(covered.manip), pick: 0 }, answer: covered.answer, good: true, locked: true });
    expect(open).toContain('aria-label="גלגל מחולק ל־12 חלקים שווים: אדום 3, כחול 9"');
    expect(open).toContain('aria-label="1/4 (התשובה)"');
    expect(open).toContain('aria-pressed="true"');
  });

  it('is never drawn in a check: Manip.jsx shows its words instead', () => {
    const item = { ...free, text: '' };
    const inTest = renderToStaticMarkup(createElement(Manip, { item, value: null, onChange: () => {}, test: true }));
    expect(inTest).toBe(`<p class="manip-plain">${manipPlain(free)}</p>`);
    const inPractice = renderToStaticMarkup(createElement(Manip, { item, value: null, onChange: () => {} }));
    expect(inPractice).toContain('mp-sim-btns');
    expect(inPractice).toContain('סובבו 10 פעמים, ואז עוד 100. מה קורה לשכיחות היחסית?');
  });
});

describe('building a chart (chart, DATA-2.2)', () => {
  const cats = ['כדורגל', 'כדורסל', 'שחייה', 'טניס'];
  const chart = (manip, values) => fixture({ kind: 'chart', cats, ...manip }, { values });
  const bar = chart({ mode: 'bar', start: [0, 0, 0, 0], bar: { max: 14, step: 2, unit: 'תלמידים' } }, [12, 8, 6, 4]);
  const given = chart({ mode: 'bar', start: [12, 0, 0, 0], lock: [0], bar: { max: 14, step: 2 } }, [12, 8, 6, 4]);
  const tall = chart({ mode: 'bar', start: [0, 0, 0, 0], bar: { max: 140, step: 10, every: 2 } }, [140, 70, 30, 100]);
  const pie = chart({ mode: 'pie', start: [0, 0, 0, 0], pie: { parts: 12 } }, [6, 3, 2, 1]);
  const half = chart({ mode: 'pie', start: [0, 0, 0, 0], pie: { parts: 20 } }, [6, 9, 5, 0]);
  const pieGiven = chart({ mode: 'pie', start: [5, 0, 0, 0], lock: [0], pie: { parts: 10 } }, [5, 2, 2, 0]);
  const all = [bar, given, tall, pie, half, pieGiven];

  it('every mode: the solution is right, the near miss and the start are not, and the words hold no undefined', () => {
    for (const it of all) solves(it);
    expect(manipWrong(bar)).toEqual([14, 8, 6, 4]); // the first bar one step up
    expect(manipWrong(given)).toEqual([12, 10, 6, 4]); // the locked first bar never moves
    expect(manipWrong(tall)).toEqual([130, 70, 30, 100]); // the first bar is at the top: one step down
    expect(manipWrong(pie)).toEqual([5, 3, 2, 1]); // every slice coloured: one given back
    expect(manipWrong(half)).toEqual([5, 9, 5, 0]); // 20 of 20 too
    expect(manipWrong(pieGiven)).toEqual([5, 3, 2, 0]); // a grey slice left: one more, never for the locked first
    expect(isCorrect(pie, [6, 3, 2, 1])).toBe(true);
    expect(isCorrect(pie, [6, 3, 1, 2])).toBe(false);
    expect(isCorrect(pie, { values: [6, 3, 2, 1] })).toBe(false); // the object holds a list
  });

  it('is said in words: each category with its value, a pie\'s parts in percent', () => {
    expect(answerText(bar)).toBe('כדורגל 12, כדורסל 8, שחייה 6, טניס 4');
    expect(answerText(pie)).toBe('כדורגל 6 חלקים (50%), כדורסל 3 חלקים (25%), שחייה 2 חלקים (16.7%), טניס חלק אחד (8.3%)');
    expect(manipPlain(bar)).toBe('[דיאגרמת עמודות: כדורגל, כדורסל, שחייה, טניס; הציר עד 14 בקפיצות של 2 (תלמידים); מכוונים את גובה כל עמודה]');
    expect(manipPlain(given)).toBe('[דיאגרמת עמודות: כדורגל, כדורסל, שחייה, טניס; הציר עד 14 בקפיצות של 2; מכוונים את גובה כל עמודה; קבועה: כדורגל 12]');
    expect(manipPlain(pie)).toBe('[עוגה מחולקת ל־12 חלקים שווים; צובעים לכל קטגוריה חלקים: כדורגל, כדורסל, שחייה, טניס]');
    expect(chartValueText(bar.manip, 0, 12)).toBe('כדורגל: 12 תלמידים');
    expect(chartValueText(pie.manip, 1, 3)).toBe('כדורסל: 3 מתוך 12 חלקים');
    expect(chartCoach(bar.manip, null, false)).toBe('גררו כל עמודה עד הקו של המספר שלה. בדקו בכמה קופץ הציר.');
    expect(chartCoach(pie.manip, null, false)).toBe('בחרו קטגוריה, וצבעו לה חלקים. כל חלק הוא בערך 8.3% מהעוגה.');
    expect(chartCoach(half.manip, null, false)).toBe('בחרו קטגוריה, וצבעו לה חלקים. כל חלק הוא 5% מהעוגה.');
    expect(chartCoach(pie.manip, [6, 3, 2, 0], true)).toBe('צבועים 11 חלקים מתוך 12. עוד חלק אחד לא צבוע.');
    expect(chartCoach(pie.manip, [6, 3, 2, 1], true)).toBe('כל 12 החלקים צבועים: יחד הם 100%.');
  });

  it('the moves: a bar snaps to the step within the axis; a locked bar never moves', () => {
    const m = bar.manip;
    expect(chartSet(m, [0, 0, 0, 0], 1, 7.2)).toEqual([0, 8, 0, 0]);
    expect(chartSet(m, [0, 0, 0, 0], 1, 30)).toEqual([0, 14, 0, 0]);
    expect(chartSet(m, [0, 0, 0, 0], 1, -3)).toEqual([0, 0, 0, 0]);
    const g = given.manip; const v = [12, 0, 0, 0];
    expect(chartSet(g, v, 0, 4)).toBe(v);
    for (const key of ['ArrowUp', 'ArrowDown', 'Home', 'End']) expect(chartKey(g, { sel: 0, values: v }, key).values, key).toBe(v);
    expect(isCorrect(given, chartSet(g, [12, 8, 6, 4], 0, 10))).toBe(true); // a drag on the locked bar changes nothing
  });

  it('the keys: ←/→ choose in reading order (the first category is on the right), ↑/↓ a step, Home/End the ends', () => {
    const m = bar.manip; const values = [2, 4, 6, 8];
    expect(chartKey(m, { sel: 0, values }, 'ArrowLeft').sel).toBe(1);
    expect(chartKey(m, { sel: 0, values }, 'ArrowRight').sel).toBe(0);
    expect(chartKey(m, { sel: 3, values }, 'ArrowLeft').sel).toBe(3);
    expect(chartKey(m, { sel: 2, values }, 'ArrowUp').values).toEqual([2, 4, 8, 8]);
    expect(chartKey(m, { sel: 2, values }, 'ArrowDown').values).toEqual([2, 4, 4, 8]);
    expect(chartKey(m, { sel: 1, values }, 'Home').values).toEqual([2, 0, 6, 8]);
    expect(chartKey(m, { sel: 1, values }, 'End').values).toEqual([2, 14, 6, 8]);
    expect(chartKey(m, { sel: 1, values }, 'Enter')).toBe(null);
    const p = pie.manip;
    expect(chartKey(p, { sel: 0, values: [3, 0, 0, 0] }, 'ArrowUp').values).toEqual([4, 0, 0, 0]);
    expect(chartKey(p, { sel: 1, values: [3, 4, 0, 0] }, 'End').values).toEqual([3, 9, 0, 0]); // the rest of the pie
    expect(chartKey(p, { sel: 1, values: [3, 9, 0, 0] }, 'ArrowUp').values).toEqual([3, 9, 0, 0]); // none grey left
  });

  it('a pie never has more slices than its parts, whatever is pressed or tapped', () => {
    const rnd = seeded(20261111);
    for (const it of [pie, half, pieGiven]) {
      const m = it.manip; const parts = m.pie.parts;
      let st = { sel: 0, values: [...m.start] };
      for (let k = 0; k < 3000; k += 1) {
        const r = rnd();
        if (r < 0.45) st = chartKey(m, st, ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'][Math.floor(rnd() * 7)]);
        else if (r < 0.75) st = pieTap(m, st, pieHit(m, st.values, rnd() * 360));
        else st = { ...st, values: chartSet(m, st.values, Math.floor(rnd() * 4), Math.floor(rnd() * 25) - 2) };
        expect(st.values.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(parts);
        expect(st.values.every((v) => Number.isInteger(v) && v >= 0)).toBe(true);
        (m.lock || []).forEach((i) => expect(st.values[i]).toBe(m.start[i]));
      }
    }
  });

  it('the slices: owned in order clockwise from 12; a tap near a grey slice counts for it; a tap gives the last one back', () => {
    const m = half.manip; // 20 slices of 18°: a slice is about 31px of rim, so the grey one is widened to 44px
    expect(pieOwners(m, [3, 2, 0, 0])).toEqual([0, 0, 0, 1, 1, ...Array(15).fill(-1)]);
    expect(pieHit(m, [3, 0, 0, 0], 52)).toBe(3); // in slice 2, 2° from the grey slice 3
    expect(pieHit(m, [3, 0, 0, 0], 47)).toBe(2); // 7° away: still slice 2
    expect(pieHit(m, [3, 0, 0, 0], 100)).toBe(5);
    expect(pieHit(pie.manip, [3, 0, 0, 0], 88)).toBe(2); // 30° slices are wide enough: no widening
    expect(pieTap(m, { sel: 1, values: [3, 2, 0, 0] }, 10)).toEqual({ sel: 1, values: [3, 3, 0, 0] }); // grey: coloured
    expect(pieTap(m, { sel: 1, values: [3, 2, 0, 0] }, 4)).toEqual({ sel: 1, values: [3, 1, 0, 0] }); // its last: back
    expect(pieTap(m, { sel: 1, values: [3, 2, 0, 0] }, 3).values).toEqual([3, 2, 0, 0]); // not its last: nothing
    expect(pieTap(m, { sel: 1, values: [3, 2, 0, 0] }, 1)).toEqual({ sel: 0, values: [3, 2, 0, 0] }); // another colour: chosen
  });

  const tagged = (out, re) => [...out.matchAll(re)].map((x) => x[1]);
  it('draws each bar as a slider with its name and value, one in the tab order, on an axis of at most 8 numbers', () => {
    const out = html(Chart, { m: bar.manip, value: [12, 8, 0, 0], answer: bar.answer });
    expect(tagged(out, /role="slider"[^>]*?aria-label="([^"]+)"/g)).toEqual(cats.map((c) => `העמודה של ${c}`));
    expect(tagged(out, /aria-valuetext="([^"]+)"/g)).toEqual(['כדורגל: 12 תלמידים', 'כדורסל: 8 תלמידים', 'שחייה: 0 תלמידים', 'טניס: 0 תלמידים']);
    expect((out.match(/role="slider"[^>]*?tabindex="0"/g) || []).length).toBe(1);
    expect(out).toContain('aria-label="העמודה של כדורגל"'); // the Stepper's group
    expect(out).toContain('aria-live="polite"');
    expect(out).toMatch(/<span>כדורגל:<\/span> <b dir="ltr">12<\/b>/);
    const big = html(Chart, { m: tall.manip, value: [0, 0, 0, 0], answer: tall.answer });
    expect((big.match(/class="fig-ch-tick"/g) || []).length).toBe(8);
    const fixed = html(Chart, { m: given.manip, value: [12, 0, 0, 0], answer: given.answer });
    expect(fixed).toContain('aria-readonly="true"');
    expect(fixed).toMatch(/class="fig-ch-val">12</); // a given bar says its value
    for (const o of [out, big, fixed]) {
      expect(o).not.toMatch(/NaN|undefined|Infinity/);
      for (const [, w] of o.matchAll(/viewBox="0 0 ([\d.]+) [\d.]+"/g)) expect(Number(w)).toBeLessThanOrEqual(320);
    }
  });

  it('draws a pie\'s chips as sliders, its readout in parts and percent, and no percent in a check', () => {
    const out = html(Chart, { m: pie.manip, value: [3, 2, 0, 0], answer: pie.answer });
    expect(tagged(out, /class="mp-chart-chip[^"]*" role="slider"[^>]*?aria-valuetext="([^"]+)"/g)).toEqual(['כדורגל: 3 מתוך 12 חלקים', 'כדורסל: 2 מתוך 12 חלקים', 'שחייה: 0 מתוך 12 חלקים', 'טניס: 0 מתוך 12 חלקים']);
    const text = (o) => o.replace(/<[^>]+>/g, '');
    expect(text(out)).toContain('כדורגל: 3 חלקים מתוך 12, כלומר 25%');
    expect(out).toContain('עוד לא צבועים: 7 חלקים');
    expect(out).toContain('aria-label="חלקים לכדורגל"');
    expect((out.match(/class="mp-chart-grey"/g) || []).length).toBe(7);
    const check = html(Chart, { m: pie.manip, value: [3, 2, 0, 0], answer: pie.answer, test: true });
    expect(check).toContain('כדורגל: 3 חלקים מתוך 12');
    expect(check).not.toMatch(/%/);
    const shown = html(Chart, { m: pie.manip, value: [3, 2, 0, 0], answer: pie.answer, reveal: true });
    expect(shown).toContain('צריך 6');
    for (const o of [out, check, shown]) expect(o).not.toMatch(/NaN|undefined|Infinity/);
  });
});
