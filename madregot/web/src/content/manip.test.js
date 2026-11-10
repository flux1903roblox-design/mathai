import { describe, it, expect } from 'vitest';
import katex from 'katex';
import { TOPICS, makeItem, isCorrect, answerText, itemPlain, readAnswer, slotsFor, figPlain } from './index.js';
import {
  quadOf, manipSolution, manipWrong, manipText, manipPlain, triangleAngles, rightAtC,
  balanceTilt, balanceSolved, balanceDivisor, balanceReachable, boxesDivisor, balanceSplits, balanceDivide, balanceTex, balanceWords, panWords,
  tilesTex, tilesPairs, tilesWords, areaTex, areaSumTex, rayText, rayTex, rayHas, TILES_MAX,
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
