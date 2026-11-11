import { describe, it, expect, beforeAll } from 'vitest';
import katex from 'katex';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Figure from '@/components/Figure.jsx';
import NumberLine from '@/components/manip/NumberLine.jsx';
import NumberPins from '@/components/manip/NumberPins.jsx';
import FracBar from '@/components/manip/FracBar.jsx';
import DoubleLine from '@/components/manip/DoubleLine.jsx';
import { loadKatex } from '@/components/MathText.jsx';
import { TOPICS, makeItem, isCorrect, answerText, itemPlain, readAnswer, slotsFor, figPlain } from './index.js';
import {
  quadOf, manipSolution, manipWrong, manipText, manipPlain, triangleAngles, rightAtC,
  balanceTilt, balanceSolved, balanceDivisor, balanceReachable, boxesDivisor, balanceSplits, balanceDivide, balanceTex, balanceWords, panWords,
  tilesTex, tilesPairs, tilesWords, areaTex, areaSumTex, rayText, rayTex, rayHas, TILES_MAX,
  fbarDenFor, fbarWords, dlineAt, dlineNum, withUnit, ticksWords, manipCorrect,
} from './manip.js';
import { tfSlide, tfReflect, tfRotate, tfInside, tfOrient, tfMoves, tfImages, transformReachable } from './transform.js';
import Transform from '@/components/manip/Transform.jsx';
import ProofTable from '@/components/manip/ProofTable.jsx';
import OrderPart from '@/components/challenge/OrderPart.jsx';
import { KINDS, transformCoach, proofCoach } from '@/components/manip/Manip.jsx';
import { PROOFS, PROOF, LETTER_SETS, R, proofManip } from './congr.js';
import { proofStart, proofFirstWrong, askedSteps } from './proof.js';
import { texText } from '@/components/MathText.jsx';
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

describe('a geo drawing in words (GEOM-1.5): what it marks, for the tutor and an answer key', () => {
  // an isosceles triangle ABC (AB = AC, two ticks each), its height AH (a right angle at H), BC labelled 12, the apex
  // angle 40° and the base angle at B asked; "_M" is a helper point drawn with no letter
  const fig = {
    type: 'geo', label: 'משולש שווה־שוקיים ABC והגובה AH',
    pts: { A: [0, 5], B: [-3, 0], C: [3, 0], H: [0, 0], _M: [1.5, 2.5] },
    segs: [{ a: 'A', b: 'B', ticks: 2 }, { a: 'A', b: 'C', ticks: 2 }, { a: 'B', b: 'C', label: '12' }, { a: 'A', b: 'H', dash: true }, { a: 'H', b: '_M', label: '' }],
    angles: [{ at: 'A', from: 'B', to: 'C', text: '40°' }, { at: 'B', from: 'C', to: 'A', text: '?', target: true }, { at: 'H', from: 'C', to: 'A', right: true }, { at: '_M', from: 'A', to: 'H', text: 'x' }],
  };
  it('reads the angles with their text, the right angles, the labelled sides and the ticks, in that order', () => {
    expect(figPlain(fig)).toBe('שרטוט: ∢A 40°, ∢B ?, ∢M x, ∢H ישרה, BC = 12, AB: 2 סימונים, AC: 2 סימונים');
    expect(itemPlain({ form: 'num', text: 'מה גודל הזווית?', fig, answer: 70 })).toContain('[שרטוט: ∢A 40°');
  });
  it('a drawing that marks nothing still says it is a drawing', () => {
    expect(figPlain({ type: 'geo', pts: { A: [0, 0], B: [1, 0] }, segs: [{ a: 'A', b: 'B' }] })).toBe('שרטוט');
  });
});

// ---------------------------------------------------------------- the transform object (GEOM-2)
describe('the transform object: moves on the grid (GEOM-2)', () => {
  const tri = { pts: [[1, 1], [4, 1], [1, 3]], names: ['A', 'B', 'C'] };
  it('slides, reflects in x, y, x = k and y = k, and turns about a centre, in exact whole numbers', () => {
    expect(tfSlide(tri.pts, 2, -3)).toEqual([[3, -2], [6, -2], [3, 0]]);
    expect(tfReflect([[4, 1]], { x: 2 })).toEqual([[0, 1]]); // the spec's flip in x = 2
    expect(tfReflect([[4, 1]], 'x')).toEqual([[4, -1]]);
    expect(tfReflect([[4, 1]], 'y')).toEqual([[-4, 1]]);
    expect(tfReflect([[4, 1]], { y: -1 })).toEqual([[4, -3]]);
    expect(tfRotate([[4, 0]], [0, 0], 90)).toEqual([[0, 4]]); // a quarter turn ↶ about the origin
    expect(tfRotate([[4, 0]], [0, 0], -90)).toEqual([[0, -4]]);
    expect(tfRotate([[4, 0]], [1, 1], 180)).toEqual([[-2, 2]]);
    expect(tfRotate([[3, 1]], [1, 1], 90)).toEqual([[1, 3]]);
    // never −0, so a vertex reads (0, 1) and compares equal
    expect(Object.is(tfReflect([[0, 1]], 'y')[0][0], 0)).toBe(true);
    // four quarter turns, or two flips in one line, bring the copy back
    let p = tri.pts; for (let k = 0; k < 4; k += 1) p = tfRotate(p, [2, -1], 90);
    expect(p).toEqual(tri.pts);
    expect(tfReflect(tfReflect(tri.pts, { x: 3 }), { x: 3 })).toEqual(tri.pts);
  });
  it('a flip reverses the cyclic order of the letters; a slide and a turn keep it', () => {
    const o = Math.sign(tfOrient(tri.pts));
    expect(o).toBe(1); // A, B, C run counterclockwise
    expect(Math.sign(tfOrient(tfReflect(tri.pts, 'y')))).toBe(-o);
    expect(Math.sign(tfOrient(tfReflect(tri.pts, { y: 2 })))).toBe(-o);
    expect(Math.sign(tfOrient(tfSlide(tri.pts, -5, 2)))).toBe(o);
    expect(Math.sign(tfOrient(tfRotate(tri.pts, [0, 0], 90)))).toBe(o);
    expect(Math.sign(tfOrient(tfRotate(tri.pts, [1, -2], 180)))).toBe(o);
  });
  it('a vertex off the plane is off: the test every refused move uses', () => {
    expect(tfInside([[6, -6], [0, 0]])).toBe(true);
    expect(tfInside([[7, 0]])).toBe(false);
    expect(tfInside([[0, -7]], 6)).toBe(false);
    expect(tfInside([[7, 0]], 8)).toBe(true);
    // a flip in x = 4 of a copy slid to the left edge would leave the plane
    expect(tfInside(tfReflect([[-5, 1], [-2, 1], [-5, 3]], { x: 4 }))).toBe(false);
  });
  it('transformReachable: only with the item\'s own moves, never through a vertex off the plane', () => {
    const slide = { shape: tri, moves: { drag: true } };
    expect(transformReachable(slide, tfSlide(tri.pts, -5, -4))).toBe(true);
    expect(transformReachable(slide, tfReflect(tri.pts, 'y'))).toBe(false); // a slide never gives a mirror image
    expect(transformReachable(slide, tfSlide(tri.pts, 3, 0))).toBe(false); // B would be at x = 7
    const flip = { shape: tri, moves: { flips: ['y'] } };
    expect(transformReachable(flip, tfReflect(tri.pts, 'y'))).toBe(true);
    expect(transformReachable(flip, tfSlide(tfReflect(tri.pts, 'y'), 0, 1))).toBe(false); // no drag: no slide
    const turn = { shape: tri, moves: { drag: true, turns: { centre: [0, 0], by: 90 } } };
    expect(transformReachable(turn, tfSlide(tfRotate(tri.pts, [0, 0], -90), -1, 2))).toBe(true);
    expect(transformReachable(turn, tfReflect(tri.pts, 'x'))).toBe(false);
    const half = { shape: tri, moves: { turns: { centre: [3, 3], by: 180 } } };
    expect(transformReachable(half, tfRotate(tri.pts, [3, 3], 180))).toBe(true);
    expect(transformReachable(half, tfRotate(tri.pts, [3, 3], 90))).toBe(false);
    // a flip in x = 4 from a copy at the left edge would cross the other edge: the copy is slid nearer the line first
    const far = { shape: tri, start: [[-6, 0], [-3, 0], [-6, 2]], moves: { drag: true, flips: [{ x: 4 }] } };
    const goal = tfReflect(tfSlide(far.start, 8, 0), { x: 4 });
    expect(tfInside(tfReflect(far.start, { x: 4 }))).toBe(false);
    expect(goal).toEqual([[6, 0], [3, 0], [6, 2]]);
    expect(transformReachable(far, goal)).toBe(true);
    // without drag, the same goal is out of reach: the only flip leaves the plane
    expect(transformReachable({ ...far, moves: { flips: [{ x: 4 }] } }, goal)).toBe(false);
    // a cover whatever the letters: a half turn of a rectangle about its middle covers it
    const rect = { shape: { pts: [[0, 0], [4, 0], [4, 2], [0, 2]], names: ['A', 'B', 'C', 'D'] }, start: [[-5, -4], [-1, -4], [-1, -2], [-5, -2]], moves: { drag: true } };
    expect(transformReachable(rect, [[4, 2], [0, 2], [0, 0], [4, 0]], 'set')).toBe(true);
    expect(transformReachable(rect, [[4, 2], [0, 2], [0, 0], [4, 0]])).toBe(false);
  });
  it('tfMoves lists only the item\'s moves; tfImages its flips\' and turns\' images on the plane', () => {
    expect(tfMoves({ shape: tri, moves: { drag: true, flips: ['y', { x: 2 }], turns: { centre: [0, 0], by: 90 } } }).map((mv) => mv.id))
      .toEqual(['left', 'right', 'up', 'down', 'flip:y', 'flip:x=2', 'ccw', 'cw']);
    expect(tfMoves({ shape: tri, moves: { turns: { centre: [1, 1], by: 180 } } }).map((mv) => mv.id)).toEqual(['half']);
    expect(tfImages({ shape: tri, moves: { drag: true, flips: ['x'] } }, tri.pts)).toEqual([tfReflect(tri.pts, 'x')]);
  });
});

describe('the transform object: checking and words (GEOM-2.7)', () => {
  const tri = { pts: [[1, 1], [4, 1], [1, 3]], names: ['A', 'B', 'C'] };
  const labels = fixture({ kind: 'transform', shape: tri, start: [[-3, -2], [0, -2], [-3, 0]], moves: { drag: true, flips: ['y'], turns: { centre: [0, 0], by: 90 } } },
    { pts: [[1, -1], [4, -1], [1, 2]] });
  const cover = fixture({ kind: 'transform', shape: { pts: [[-4, -4], [0, -4], [0, -2], [-4, -2]], names: ['A', 'B', 'C', 'D'] }, moves: { drag: true },
    target: { pts: [[1, 2], [5, 2], [5, 4], [1, 4]] } }, { pts: [[5, 4], [1, 4], [1, 2], [5, 2]], match: 'set' });
  const edge = fixture({ kind: 'transform', shape: tri, moves: { drag: true } }, { pts: [[3, 0], [6, 0], [3, 2]] });
  it('labels: every vertex in place; set: the same vertices whatever the letters', () => {
    solves(labels);
    solves(cover);
    expect(manipCorrect(labels, [[4, -1], [1, -1], [1, 2]])).toBe(false); // the right place, the letters swapped
    expect(manipCorrect(cover, [[1, 2], [5, 2], [5, 4], [1, 4]])).toBe(true); // the cover with other letters
    expect(manipCorrect(cover, [[1, 2], [5, 2], [5, 4], [1, 5]])).toBe(false);
    expect(manipCorrect(labels, null)).toBe(false);
    expect(manipCorrect(labels, [[1, -1], [4, -1]])).toBe(false);
  });
  it('the near miss is one step right, or one step left when right leaves the plane', () => {
    expect(manipWrong(labels)).toEqual([[2, -1], [5, -1], [2, 2]]);
    expect(manipWrong(edge)).toEqual([[2, 0], [5, 0], [2, 2]]);
    expect(manipCorrect(edge, manipWrong(edge))).toBe(false);
    expect(manipSolution(labels)).toEqual(labels.answer.pts);
    expect(manipSolution(labels)).not.toBe(labels.answer.pts); // a copy: the lesson may hold it
  });
  it('in words: the copy with its letters, the setup for the tutor, no undefined', () => {
    expect(manipText(labels, [[1, -1], [4, -1], [1, 2]])).toBe('⁦A′(1, −1), B′(4, −1), C′(1, 2)⁩');
    expect(manipText(labels)).toBe('⁦A′(1, −1), B′(4, −1), C′(1, 2)⁩');
    expect(manipText(cover)).toBe('העותק מכסה את ⁦(5, 4), (1, 4), (1, 2), (5, 2)⁩');
    expect(answerText(labels)).toBe(manipText(labels));
    expect(manipPlain(labels)).toBe('[משולש A(1, 1), B(4, 1), C(1, 3); אפשר להזיז, לשקף ביחס לציר y, לסובב רבע סיבוב סביב O(0, 0); העותק מתחיל ב־(−3, −2), (0, −2), (−3, 0)]');
    expect(manipPlain(cover)).toBe('[מרובע A(−4, −4), B(0, −4), C(0, −2), D(−4, −2); אפשר להזיז; יעד מקווקו: (1, 2), (5, 2), (5, 4), (1, 4)]');
    expect(manipPlain(fixture({ kind: 'transform', shape: tri, moves: { flips: [{ x: 2 }], turns: { centre: [1, -1], by: 180 } } }, { pts: tri.pts })))
      .toBe('[משולש A(1, 1), B(4, 1), C(1, 3); אפשר לשקף ביחס לישר x = 2, לסובב חצי סיבוב סביב O(1, −1)]');
    for (const it of [labels, cover, edge]) {
      for (const u of [it.answer, manipSolution(it), manipWrong(it)]) expect(manipText(it, u)).not.toMatch(/undefined|NaN/);
      expect(itemPlain({ ...it, text: 'הזיזו את העותק.' })).not.toMatch(/undefined|NaN/);
    }
  });
});

describe('the transform object drawn (GEOM-2.3 to 2.6)', () => {
  beforeAll(() => loadKatex());
  const tri = { pts: [[1, 1], [4, 1], [1, 3]], names: ['A', 'B', 'C'] };
  const busy = { kind: 'transform', shape: tri, start: [[-4, -2], [-1, -2], [-4, 0]], moves: { drag: true, flips: ['y'], turns: { centre: [0, 0], by: 90 } }, target: { pts: [[2, -3], [5, -3], [2, -1]], names: ['K', 'L', 'M'] } };
  const ans = { pts: [[2, -3], [5, -3], [2, -1]] };
  const coords = /\(\s*[−-]?\d+\s*,\s*[−-]?\d+\s*\)/;
  const buttons = (out) => [...out.matchAll(/<button[^>]*aria-label="([^"]*)"/g)].map((x) => x[1]);
  it('in practice: the plane, the readout chips, A′ B′ C′, every mirror and O, and one button per move', () => {
    const out = html(Transform, { m: busy, value: null, answer: ans });
    expect(out).toMatch(/role="application"/);
    expect(out).toMatch(/aria-roledescription="מערכת צירים"/);
    expect(out).toMatch(/viewBox="0 0 316 316"/);
    expect(out).toContain('A′(−4, −2)');
    expect(out).toMatch(/aria-label="משולש ABC\. העותק: A′ ב־\(−4, −2\)/);
    expect(out).toMatch(/class="mp-tf-mirror"/);
    expect(out).toContain('>O<');
    expect(out).not.toMatch(/undefined|NaN/);
    expect(buttons(out)).toEqual(['הזיזו שמאלה', 'הזיזו למעלה', 'הזיזו למטה', 'הזיזו ימינה', 'התחלה מחדש', 'שיקוף ביחס לציר y',
      'סיבוב של 90° נגד כיוון השעון סביב O', 'סיבוב של 90° עם כיוון השעון סביב O']);
    // two rows at most: the arrows with התחלה מחדש, then the flips and turns
    expect((out.match(/class="mp-tf-row/g) || []).length).toBe(2);
  });
  it('in a check (test): no coordinate text anywhere, the moves counted instead, and buttons only for the listed moves', () => {
    const out = html(Transform, { m: busy, value: null, answer: ans, test: true });
    expect(out).not.toMatch(coords);
    expect(out).not.toMatch(/mp-tf-chip|manip-readout/);
    expect(out).toMatch(/aria-label="משולש ABC\. העותק במקום שבו התחיל"/);
    const onlyFlip = html(Transform, { m: { kind: 'transform', shape: tri, moves: { flips: [{ x: 2 }] } }, value: null, answer: ans, test: true });
    expect(onlyFlip).not.toMatch(coords);
    expect(buttons(onlyFlip)).toEqual(['שיקוף ביחס לישר x = 2', 'התחלה מחדש']);
    expect(onlyFlip).not.toMatch(/הזיזו/);
    expect(onlyFlip).toContain('x</tspan> = 2'); // the mirror line's equation is drawn
  });
  it('letters: the original\'s are hidden where the copy covers them; a shown answer is green and dashed', () => {
    const on = html(Transform, { m: { kind: 'transform', shape: tri, moves: { drag: true } }, value: null, answer: ans });
    expect((on.match(/mp-tf-letter orig/g) || []).length).toBe(0);
    expect((on.match(/mp-tf-letter copy/g) || []).length).toBe(3);
    const off = html(Transform, { m: { kind: 'transform', shape: tri, moves: { drag: true } }, value: tfSlide(tri.pts, -4, 0), answer: ans });
    expect((off.match(/mp-tf-letter orig/g) || []).length).toBe(3);
    const shown = html(Transform, { m: busy, value: null, answer: ans, reveal: true });
    expect(shown).toMatch(/class="mp-tf-ghost"/);
    const locked = html(Transform, { m: busy, value: null, answer: ans, locked: true });
    expect((locked.match(/<button[^>]*disabled=""/g) || []).length).toBe(buttons(locked).length);
  });
  it('Manip draws it as KINDS.transform (loaded when needed), and מדי names the moves the item has', () => {
    // loaded on demand (React.lazy): the first screen's bundle does not carry it
    expect(KINDS.transform.$$typeof).toBe(Symbol.for('react.lazy'));
    expect(transformCoach(busy, null, false, null)).toBe('גררו את העותק, או השתמשו בכפתורים: חצים מזיזים, שיקוף הופך, סיבוב מסובב.');
    expect(transformCoach({ ...busy, moves: { flips: ['x'] } }, null, false, null)).toBe('השתמשו בכפתורים: שיקוף הופך.');
    expect(transformCoach(busy, null, true, { move: 'flip' })).toBe('העותק הפוך עכשיו, כמו במראה: האותיות רצות בכיוון השני.');
    expect(transformCoach(busy, null, true, { move: 'refuse', text: 'העותק ייצא מהרשת. הזיזו אותו קודם קרוב יותר לישר השיקוף.' })).toMatch(/^העותק ייצא מהרשת/);
    expect(transformCoach(busy, tfSlide(busy.start, 4, 1), true, { move: 'slide' })).toBe('מהמקום שבו התחלתם: 4 ימינה ו־1 למעלה.');
    expect(transformCoach(busy, tfSlide(busy.start, -2, 0), true, { move: 'slide' })).toBe('מהמקום שבו התחלתם: 2 שמאלה.');
    expect(transformCoach(busy, tfReflect(busy.start, 'y'), true, { move: 'slide' })).toMatch(/^העותק זז\./);
    const turned = renderToStaticMarkup(createElement('p', null, transformCoach(busy, tfRotate(busy.start, [0, 0], 90), true, { move: 'turn' })));
    expect(turned).toContain('לא השתנה');
  });
});

describe('the coord figure twin of the transform object (GEOM-2.8)', () => {
  const fig = {
    type: 'coord',
    shapes: [{ pts: [[-4, 1], [-1, 1], [-4, 3]], names: ['A', 'B', 'C'] }, { pts: [[1, -1], [4, -1], [1, 1]], names: ['A′', 'B′', 'C′'], tone: 'alt' }, { pts: [[2, 2], [5, 2], [2, 4]], tone: 'ghost', label: 'יעד' }],
    arrows: [{ from: [-4, 1], to: [1, -1] }],
    mirror: { x: 2 }, centre: [1, 1], turn: 90,
  };
  it('draws the shapes with their letters, the arrow, the mirror and its equation, O and the turn', () => {
    const out = renderToStaticMarkup(createElement(Figure, { fig }));
    expect(out).toMatch(/<svg/);
    expect(out).not.toMatch(/NaN|undefined|Infinity/);
    expect((out.match(/class="fig-cd-shape tone-/g) || []).length).toBe(3);
    for (const n of ['A', 'B′', 'C′']) expect(out).toContain(`>${n}<`);
    expect(out).toContain('x = 2');
    expect(out).toMatch(/class="fig-cd-arrow"/);
    expect(out).toMatch(/class="fig-cd-centre"/);
    expect(out).toContain('>O<');
    expect((out.match(/class="arc"/g) || []).length).toBe(2); // the curved arrow and its head
    for (const t of [-90, 180]) expect(renderToStaticMarkup(createElement(Figure, { fig: { ...fig, turn: t } }))).not.toMatch(/NaN/);
    // the drawing's name reads its shapes by name, never where they are
    expect(out).toMatch(/aria-label="[^"]*משולש ABC[^"]*ישר השיקוף x = 2[^"]*מרכז סיבוב O, חץ של 90° נגד כיוון השעון/);
  });
  it('figPlain reads every vertex, the arrow, the mirror, the centre and the turn', () => {
    expect(figPlain(fig)).toBe('צורות: ABC (A(−4, 1), B(−1, 1), C(−4, 3)), A′B′C′ (A′(1, −1), B′(4, −1), C′(1, 1)), ((2, 2), (5, 2), (2, 4)) יעד; חץ מ־(−4, 1) ל־(1, −1); ישר שיקוף x = 2; מרכז סיבוב O(1, 1), 90° נגד כיוון השעון');
    expect(figPlain({ type: 'coord', mirror: 'y', centre: [0, 0], turn: 180 })).toBe('ישר השיקוף: ציר y; מרכז סיבוב O(0, 0), חצי סיבוב');
    expect(figPlain({ type: 'coord', centre: [2, -1], turn: -90 })).toBe('מרכז סיבוב O(2, −1), 90° עם כיוון השעון');
  });
});

// ---------------------------------------------------------------- the proof object (GEOM-3)
/** Every order of a list. */
const perms = (a) => (a.length <= 1 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p])));
const proofItem = (m) => ({ form: 'manip', manip: m, answer: manipSolution({ form: 'manip', manip: m }) });
const proofItems = () => PROOFS.flatMap((T) => LETTER_SETS.flatMap((_, set) => [
  proofItem(proofManip(T, { set, seed: 'a' })), proofItem(proofManip(T, { set, lockOrder: true })), proofItem(proofManip(T, { set, ask: 'theorem', seed: 'b' })),
]));

describe('the proof object: checking and words (GEOM-3.6)', () => {
  it('for every template, its solution is right and its near miss is not; every order the free groups allow is right', () => {
    for (const it of proofItems()) {
      const m = it.manip; const at = `${m.tpl} set ${m.set}${m.lockOrder ? ' locked' : ''}`;
      expect(manipCorrect(it, manipSolution(it)), at).toBe(true);
      expect(manipCorrect(it, manipWrong(it)), at).toBe(false);
      expect(manipCorrect(it, null), at).toBe(false);
      expect(manipCorrect(it, proofStart(m)), `${at}: the start is not already right`).toBe(false);
      const sol = manipSolution(it);
      // every order the free groups allow: each group's rows in any order, in the group's own places
      const groups = m.part.free || [];
      let orders = [sol.order];
      for (const g of groups) orders = orders.flatMap((o) => perms(g).map((p) => { const n = [...o]; g.forEach((place, k) => { n[place] = p[k]; }); return n; }));
      expect(orders.length, at).toBe(groups.reduce((n, g) => n * perms(g).length, 1));
      orders.forEach((order) => expect(manipCorrect(it, { order, reasons: sol.reasons }), `${at}: ${order}`).toBe(true));
      // a wrong reason on any asked row is wrong, and so is a reason left out
      askedSteps(m.part).forEach((i) => {
        const n = m.part.steps[i].reason.choices.length;
        for (let k = 0; k < n; k += 1) {
          if (k === sol.reasons[i]) continue;
          const reasons = [...sol.reasons]; reasons[i] = k;
          expect(manipCorrect(it, { order: sol.order, reasons }), `${at} row ${i + 1} choice ${k}`).toBe(false);
        }
        const reasons = [...sol.reasons]; reasons[i] = null;
        expect(manipCorrect(it, { order: sol.order, reasons }), at).toBe(false);
      });
      // a row moved out of its group is wrong
      const swapped = [...sol.order]; [swapped[0], swapped[swapped.length - 1]] = [swapped[swapped.length - 1], swapped[0]];
      expect(manipCorrect(it, { order: swapped, reasons: sol.reasons }), at).toBe(false);
    }
  });

  it('manipText reads every row with its reason, in the order shown; manipPlain the givens, the goal and the choices', () => {
    for (const it of proofItems()) {
      const text = manipText(it, manipSolution(it));
      const m = it.manip;
      expect(text.split('; '), m.tpl).toHaveLength(m.part.steps.length);
      expect(text).toMatch(/^1\. /);
      expect(text).not.toMatch(/undefined|null|\$|\\[a-z]/);
      const plain = manipPlain(it);
      expect(plain).toMatch(/^\[הוכחה בטבלה, טענה ונימוק\. נתון: /);
      expect(plain).toContain('צ״ל:');
      expect(plain).not.toMatch(/undefined|null|\$|\\[a-z]/);
      expect(plain).toContain(m.lockOrder ? 'הסדר נכון, משלימים את הנימוקים החסרים' : 'מסדרים את השורות ובוחרים נימוקים');
    }
    const t1 = proofItem(proofManip(PROOF.T1));
    expect(manipText(t1, manipSolution(t1))).toBe('1. ⁦AM = MB⁩ — נתון; 2. ⁦CM = MD⁩ — נתון; 3. ⁦∢AMC = ∢BMD⁩ — זוויות קודקודיות; 4. ⁦△AMC ≅ △BMD⁩ — לפי צ.ז.צ; 5. ⁦AC = BD⁩ — צלעות מתאימות במשולשים חופפים');
    // a reason not chosen yet reads "?"
    expect(manipText(t1, { order: [0, 1, 2, 3, 4], reasons: [null, null, null, null, null] })).toContain('3. ⁦∢AMC = ∢BMD⁩ — ?');
    expect(answerText(t1)).toBe(manipText(t1, t1.answer));
  });

  it('a check outlines the first row out of place, or, when the order is right, the first wrong reason', () => {
    const m = proofManip(PROOF.T5);
    const sol = proofItem(m).answer;
    expect(proofFirstWrong(m, sol)).toBeNull();
    // the conclusion above the congruence: row 4 (place 3) is out of place
    expect(proofFirstWrong(m, { order: [0, 1, 2, 4, 3, 5, 6], reasons: sol.reasons })).toEqual({ place: 3, why: 'order' });
    // the order right, the bisector's reason wrong
    const r = [...sol.reasons]; r[1] = (r[1] + 1) % 3;
    expect(proofFirstWrong(m, { order: sol.order, reasons: r })).toEqual({ place: 1, why: 'reason' });
    // a free group in another order is still right; the first reason not chosen is found
    const gaps = [...sol.reasons]; gaps[5] = null;
    expect(proofFirstWrong(m, { order: [2, 0, 1, 3, 5, 4, 6], reasons: gaps })).toEqual({ place: 4, why: 'missing' });
  });

  it('מדי says what to do, then counts the reasons and says when the order is right (GEOM-3.6)', () => {
    const all = proofManip(PROOF.T1);
    expect(proofCoach(all, null, false)).toBe('סדרו את השורות מהנתונים אל המסקנה, ובחרו נימוק לכל שורה.');
    expect(proofCoach(proofManip(PROOF.T1, { lockOrder: true }), null, false)).toBe('השלימו את הנימוקים החסרים. הסדר כבר נכון.');
    expect(proofCoach(proofManip(PROOF.T1, { ask: 'theorem' }), null, false)).toBe('סדרו את השורות, ובחרו לפי איזה משפט המשולשים חופפים.');
    expect(proofCoach(proofManip(PROOF.T7, { ask: 'theorem' }), null, false)).toBe('סדרו את השורות, ובחרו לפי איזה משפט המשולשים דומים.');
    const start = proofStart(all);
    expect(proofCoach(all, start, true)).toBe('בחרתם 0 מתוך 3 נימוקים.');
    const one = { ...start, reasons: [null, null, 0, null, null] };
    expect(proofCoach(all, one, true)).toBe('בחרתם 1 מתוך 3 נימוקים.');
    expect(proofCoach(all, { order: [0, 1, 2, 3, 4], reasons: [null, null, 0, null, null] }, true)).toBe('בחרתם 1 מתוך 3 נימוקים. הסדר נכון. נשארו הנימוקים.');
    expect(proofCoach(all, { order: [0, 1, 2, 3, 4], reasons: [null, null, 0, 1, 2] }, true)).toBe('בחרתם 3 מתוך 3 נימוקים.');
    const only = proofManip(PROOF.T1, { ask: 'theorem' });
    expect(proofCoach(only, proofStart(only), true)).toBe('עוד לא בחרתם נימוק.');
    expect(proofCoach(only, { ...proofStart(only), reasons: [null, null, null, 2, null] }, true)).toBe('בחרתם נימוק.');
  });

  it('screen-reader words read the class\'s signs', () => {
    expect(texText('\\sphericalangle AMC = \\sphericalangle BMD')).toBe('∢AMC = ∢BMD');
    expect(texText('\\triangle ABC \\cong \\triangle KML')).toBe('△ABC ≅ △KML');
    expect(texText('\\triangle ADE \\sim \\triangle ABC')).toBe('△ADE ∼ △ABC');
    expect(texText('AB \\parallel CD, CD \\perp AB')).toBe('AB ∥ CD, CD ⊥ AB');
    expect(texText('\\angle A')).toBe('∢A');
  });
});

describe('the proof table drawn (GEOM-3.4, 3.5)', () => {
  beforeAll(() => loadKatex());
  const m = proofManip(PROOF.T1, { seed: 'x' });
  const ans = proofItem(m).answer;
  const buttons = (out) => [...out.matchAll(/<button[^>]*aria-label="([^"]*)"/g)].map((x) => x[1]);
  it('the drawing on top, נתון and צ״ל, a table with טענה and נימוק, rows with 44px moves described by their claim', () => {
    const out = html(ProofTable, { m, value: null, answer: ans });
    expect(out).toMatch(/class="mp-proof-fig"[\s\S]*<svg/);
    expect(out.indexOf('mp-proof-fig')).toBeLessThan(out.indexOf('<table'));
    expect(out).toContain('נתון:');
    expect(out).toContain('צ״ל:');
    expect(out).toMatch(/<th role="columnheader" scope="col" class="claim">טענה<\/th>/);
    expect(out).toMatch(/<th role="columnheader" scope="col" class="why">נימוק<\/th>/);
    expect((out.match(/class="mp-proof-row/g) || []).length).toBe(5);
    // the start is the seeded shuffle, never already right
    const start = proofStart(m).order;
    expect(start).not.toEqual([0, 1, 2, 3, 4]);
    // two move buttons a row, each described by its claim; the fixed reasons are text, the asked ones chips
    expect(buttons(out).filter((b) => b === 'הזיזו למעלה')).toHaveLength(5);
    expect(buttons(out).filter((b) => b === 'הזיזו למטה')).toHaveLength(5);
    const desc = [...out.matchAll(/aria-label="הזיזו למעלה" aria-describedby="([^"]+)"/g)].map((x) => x[1]);
    desc.forEach((id) => expect(out).toContain(`id="${id}"`));
    expect((out.match(/aria-label="בחרו נימוק לשורה \d"/g) || []).length).toBe(3);
    expect((out.match(/class="mp-proof-fixed"/g) || []).length).toBe(2);
    expect(out).toMatch(/aria-expanded="false"/);
    expect(out).not.toMatch(/role="radiogroup"/); // closed until a chip is pressed
    expect(out).not.toMatch(/undefined|NaN/);
  });
  it('with lockOrder the rows stay in order and nothing moves', () => {
    const out = html(ProofTable, { m: proofManip(PROOF.T1, { lockOrder: true }), value: null });
    expect(buttons(out).filter((b) => /הזיזו/.test(b))).toHaveLength(0);
    expect(out).not.toContain('class="mv"');
    const claims = [...out.matchAll(/class="claim" id="[^"]+">([\s\S]*?)<\/td>/g)].length;
    expect(claims).toBe(5);
  });
  it('after a wrong check: the first row out of place is outlined; with the order right, the first wrong reason; never in a check', () => {
    const wrongOrder = { order: [0, 1, 2, 4, 3], reasons: ans.reasons };
    const out = html(ProofTable, { m, value: wrongOrder, checked: true });
    expect((out.match(/mp-proof-row off/g) || []).length).toBe(1);
    expect(out).toContain('השורה הזאת עוד לא במקום');
    const r = [...ans.reasons]; r[2] = (r[2] + 1) % 3;
    const why = html(ProofTable, { m, value: { order: ans.order, reasons: r }, checked: true });
    expect(why).toContain('הנימוק הזה לא מתאים לשורה');
    expect(html(ProofTable, { m, value: wrongOrder, checked: true, test: true })).not.toMatch(/mp-proof-row off|עוד לא במקום/);
    expect(html(ProofTable, { m, value: wrongOrder, checked: false })).not.toMatch(/mp-proof-row off/);
  });
  it('reveal shows the whole right table; locked shows the choices as text', () => {
    const out = html(ProofTable, { m, value: { order: [4, 3, 2, 1, 0], reasons: [null, null, null, null, null] }, reveal: true });
    const claims = [...out.matchAll(/class="claim" id="[^"]+">([\s\S]*?)<\/td>/g)].map((x) => x[1]);
    expect(claims[0]).toContain('AM');
    expect(out).toContain('זוויות קודקודיות');
    expect(out).toContain('לפי צ.ז.צ');
    expect(buttons(out)).toHaveLength(0);
  });
  it('Manip draws it as KINDS.proof, loaded when needed', () => {
    expect(KINDS.proof.$$typeof).toBe(Symbol.for('react.lazy'));
  });
});

describe('a proof as a still figure (GEOM-3.9)', () => {
  const fig = { type: 'proof', given: '$AM = MB$', goal: '$AC = BD$', rows: [{ claim: '$AM = MB$', reason: 'נתון' }, { claim: '$\\sphericalangle AMC = \\sphericalangle BMD$', reason: 'זוויות קודקודיות' }], ask: 1 };
  it('is an HTML table, טענה | נימוק, with "?" in the asked row', () => {
    const out = renderToStaticMarkup(createElement(Figure, { fig }));
    expect(out).toMatch(/<table class="fg-proof-table">/);
    expect(out).toMatch(/<th scope="col">טענה<\/th><th scope="col">נימוק<\/th>/);
    expect(out).toContain('נתון:');
    expect(out).toMatch(/class="fg-proof-ask"[^>]*>\?</);
    expect(out).not.toContain('זוויות קודקודיות');
  });
  it('figPlain reads it: הוכחה. נתון: …; צ״ל: …; 1. … — …', () => {
    expect(figPlain(fig)).toBe('הוכחה. נתון: AM = MB; צ״ל: AC = BD; 1. AM = MB — נתון; 2. \\sphericalangle AMC = \\sphericalangle BMD — ?');
    expect(figPlain({ type: 'proof', rows: [{ claim: '$x$', reason: 'נתון' }] })).toBe('הוכחה. 1. x — נתון');
  });
});

describe('the challenge\'s order part shows a fixed reason, and grades only the asked ones (GEOM-3.1)', () => {
  beforeAll(() => loadKatex());
  it('a step with `fixed` shows its reason under its text', () => {
    const part = { type: 'order', prompt: 'סדרו.', steps: PROOF.T1.steps, free: PROOF.T1.free };
    const out = renderToStaticMarkup(createElement(OrderPart, { part, seed: 't1', onDone: () => {}, last: true }));
    expect((out.match(/class="ch-step-fixed"/g) || []).length).toBe(2);
    expect(out).toContain('נימוק: </span>');
    expect(out).toContain(R.given);
  });
});
