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
import Simulate, { simRun, simTrial, simCoach } from '@/components/manip/Simulate.jsx';
import Chart, { chartSet, chartKey, pieOwners, pieCounts, pieLayout, pieNext, pieStep, pieKey, pieHit, pieTap, pieRuns, chartCoach, chartValueText } from '@/components/manip/Chart.jsx';
import Manip from '@/components/manip/Manip.jsx';
import GridShape from '@/components/manip/GridShape.jsx';
import NetFold from '@/components/manip/NetFold.jsx';
import CircleRoll, { sectorStrip, circleSaid } from '@/components/manip/CircleRoll.jsx';
import { loadKatex } from '@/components/MathText.jsx';
import { TOPICS, makeItem, isCorrect, answerText, itemPlain, readAnswer, slotsFor, figPlain } from './index.js';
import {
  quadOf, manipSolution, manipWrong, manipText, manipPlain, triangleAngles, rightAtC,
  balanceTilt, balanceSolved, balanceDivisor, balanceReachable, boxesDivisor, balanceSplits, balanceDivide, balanceTex, balanceWords, panWords,
  tilesTex, tilesPairs, tilesWords, areaTex, areaSumTex, rayText, rayTex, rayHas, TILES_MAX,
  fbarDenFor, fbarWords, dlineAt, dlineNum, withUnit, ticksWords, manipCorrect,
  graphMove, graphKey, graphShape, graphXs, squaresWords, seriesAt, seriesCrossings, seriesMeet, figWords,
  protAligned, armTurns, baselineOnArm, buildWords, alignWords, clockHands, mod360,
  simOutcomes, simEmpty, simSentence, simDiag, simGuidedOrder,
} from './manip.js';
import { maxRectArea, polyArea, cutAreas, cutMakesRectangles, cutAt, gridControls, gridStep } from './grid.js';
import { NET_LAYOUTS, netModel, netView, netWithSlot, foldFaces, oblique, netStep, netControls, oppositeFace, closedNeighbours, netfigLabels, prismSides, CYL_N, solidLabels } from './net.js';
import { circleStep, circleControls, SECTORS } from './roll.js';
import * as SW from './solid.js';
import { tfSlide, tfReflect, tfRotate, tfInside, tfOrient, tfMoves, tfImages, transformReachable } from './transform.js';
import Transform from '@/components/manip/Transform.jsx';
import ProofTable from '@/components/manip/ProofTable.jsx';
import OrderPart from '@/components/challenge/OrderPart.jsx';
import { KINDS, transformCoach, proofCoach } from '@/components/manip/Manip.jsx';
import { PROOFS, PROOF, LETTER_SETS, R, proofManip } from './proofs.js';
import { proofStart, proofFirstWrong, askedSteps } from './proof.js';
import { texText } from '@/components/MathText.jsx';
import { linText, listMath } from './util.js';
import { holds, texToExpr, identical, seeded } from '@/learn/expr.ts';
import { loadAllGens } from './index.js';
// the exercise generators load per topic (the boot split); this file makes questions while its tests are collected
await loadAllGens();

// Draw interactive items from their levels until each kind has been seen. 1000 draws: with 400, a level whose share
// of interactive items is about 15% (angles:1) gave 50 or fewer, under the tests' 50, in about one run in ten.
function manipItems(topic, level, n = 1000) {
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
    // the line shown before the first trial is short (the long sentence ran past the card at 320 × 568)
    expect(fresh).toContain('<span class="mp-sim-small" aria-hidden="true">עוד אין סיבובים</span>');
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
  const bar = chart({ mode: 'bar', start: [0, 0, 0, 0], bar: { max: 14, step: 2, unit: 'מספר תלמידים', unitWord: 'תלמידים' } }, [12, 8, 6, 4]);
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
    expect(manipPlain(bar)).toBe('[דיאגרמת עמודות: כדורגל, כדורסל, שחייה, טניס; הציר עד 14 בקפיצות של 2 (מספר תלמידים); מכוונים את גובה כל עמודה]');
    expect(manipPlain(given)).toBe('[דיאגרמת עמודות: כדורגל, כדורסל, שחייה, טניס; הציר עד 14 בקפיצות של 2; מכוונים את גובה כל עמודה; קבועה: כדורגל 12]');
    expect(manipPlain(pie)).toBe('[עוגה מחולקת ל־12 חלקים שווים; צובעים לכל קטגוריה חלקים: כדורגל, כדורסל, שחייה, טניס]');
    // a bar is said with the short noun, never the axis title ("4 מספר ילדים", review); without one, the number alone
    expect(chartValueText(bar.manip, 0, 12)).toBe('כדורגל: 12 תלמידים');
    expect(chartValueText(tall.manip, 2, 30)).toBe('שחייה: 30');
    expect(chartValueText({ ...bar.manip, bar: { ...bar.manip.bar, step: 1 } }, 3, 1)).toBe('טניס: 1');
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
    const p = pie.manip; const owners = (vs) => pieOwners(p, vs);
    expect(pieCounts(p, pieKey(p, { sel: 0, owners: owners([3, 0, 0, 0]) }, 'ArrowUp').owners)).toEqual([4, 0, 0, 0]);
    expect(pieCounts(p, pieKey(p, { sel: 1, owners: owners([3, 4, 0, 0]) }, 'End').owners)).toEqual([3, 9, 0, 0]); // the rest of the pie
    expect(pieCounts(p, pieKey(p, { sel: 1, owners: owners([3, 4, 0, 0]) }, 'Home').owners)).toEqual([3, 0, 0, 0]);
    const full = owners([3, 9, 0, 0]);
    expect(pieKey(p, { sel: 1, owners: full }, 'ArrowUp').owners).toBe(full); // none grey left: nothing changes
    expect(pieKey(p, { sel: 2, owners: full }, 'Home').owners).toBe(full); // none of its own to give back
    expect(pieKey(p, { sel: 0, owners: full }, 'ArrowLeft').sel).toBe(1);
    expect(pieKey(p, { sel: 0, owners: full }, 'Enter')).toBe(null);
  });

  it('a pie never has more slices than its parts, whatever is pressed or tapped, and a locked category never moves', () => {
    const rnd = seeded(20261111);
    for (const it of [pie, half, pieGiven]) {
      const m = it.manip; const parts = m.pie.parts;
      let st = { sel: 0, owners: pieOwners(m, m.start) };
      for (let k = 0; k < 3000; k += 1) {
        const r = rnd();
        if (r < 0.45) st = pieKey(m, st, ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'][Math.floor(rnd() * 7)]);
        else if (r < 0.9) st = pieTap(m, st, pieHit(m, st.owners, rnd() * 360, 0.5 + rnd()));
        else st = { ...st, sel: Math.floor(rnd() * 4) };
        const values = pieCounts(m, st.owners);
        expect(st.owners).toHaveLength(parts);
        expect(values.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(parts);
        (m.lock || []).forEach((i) => expect(values[i]).toBe(m.start[i]));
        expect(pieLayout(m, st.owners, values)).toBe(st.owners); // the drawing keeps its own slices while the counts hold
      }
    }
  });

  it('the slices: the one a finger touches is the one that changes (review: a tap coloured another slice)', () => {
    const m = half.manip; // 20 slices of 18°: a slice is about 31px of rim, so the grey one is widened to 44px
    const o = pieOwners(m, [2, 3, 0, 0]); // כדורגל 0-1, כדורסל 2-4, the rest grey
    expect(o).toEqual([0, 0, 1, 1, 1, ...Array(15).fill(-1)]);
    // כדורגל chosen, the grey slice at 6 o'clock tapped: that slice is כדורגל's, and כדורסל keeps 2-4
    const t = pieTap(m, { sel: 0, owners: o }, 10);
    expect(t.owners).toEqual([0, 0, 1, 1, 1, ...Array(5).fill(-1), 0, ...Array(9).fill(-1)]);
    expect(pieCounts(m, t.owners)).toEqual([3, 3, 0, 0]);
    expect(pieLayout(m, t.owners, [3, 3, 0, 0])).toBe(t.owners); // drawn as tapped, not laid out again
    expect(pieLayout(m, t.owners, [6, 9, 5, 0])).toEqual(pieOwners(m, [6, 9, 5, 0])); // a value from outside is laid out
    // one of its own slices tapped: that one is given back; another colour: that category is chosen, nothing changes
    expect(pieTap(m, { sel: 0, owners: t.owners }, 1).owners).toEqual([0, -1, 1, 1, 1, ...Array(5).fill(-1), 0, ...Array(9).fill(-1)]);
    expect(pieTap(m, { sel: 0, owners: t.owners }, 3)).toEqual({ sel: 1, owners: t.owners });
    // a locked category's slices are never taken or given
    const g = pieGiven.manip; const go = pieOwners(g, [5, 0, 0, 0]);
    expect(pieTap(g, { sel: 0, owners: go }, 7).owners).toBe(go);
    expect(pieTap(g, { sel: 0, owners: go }, 2).owners).toBe(go);
  });

  it('the Stepper: + colours the next grey slice after the category\'s last one, − gives its last one back', () => {
    const m = half.manip;
    const o = pieOwners(m, [2, 3, 0, 0]);
    expect(pieNext(o, 0)).toBe(5); // after כדורגל come כדורסל's slices: the next grey one is 5
    expect(pieNext(o, 2)).toBe(5); // a category with none starts after the last coloured slice
    expect(pieNext(pieOwners(m, [0, 0, 0, 0]), 3)).toBe(0); // an empty pie starts at 12 o'clock
    expect(pieNext(pieOwners(m, [20, 0, 0, 0]), 1)).toBe(-1);
    const plus = pieStep(m, o, 2, 1);
    expect(plus.slice(0, 7)).toEqual([0, 0, 1, 1, 1, 2, -1]);
    expect(pieStep(m, plus, 1, -1).slice(0, 7)).toEqual([0, 0, 1, 1, -1, 2, -1]);
    expect(pieStep(m, o, 3, -1)).toBe(o); // none to give back
    // a stepper-only pie, coloured in order, is the counts laid out in order
    let st = pieOwners(m, [0, 0, 0, 0]);
    [[0, 6], [1, 9], [2, 5]].forEach(([i, n]) => { for (let k = 0; k < n; k += 1) st = pieStep(m, st, i, 1); });
    expect(st).toEqual(pieOwners(m, [6, 9, 5, 0]));
    // the outline on the rim: one arc a run, a run across 12 o'clock is one arc
    expect(pieRuns(t0(), 0)).toEqual([[18, 4]]);
    expect(pieRuns(o, 1)).toEqual([[2, 3]]);
    expect(pieRuns(pieOwners(m, [20, 0, 0, 0]), 0)).toEqual([[0, 20]]);
    function t0() { const x = Array(20).fill(-1); [18, 19, 0, 1].forEach((s) => { x[s] = 0; }); return x; }
  });

  it('a tap near a grey slice counts for it, by 44 screen pixels of rim', () => {
    const m = half.manip; const o = pieOwners(m, [3, 0, 0, 0]);
    expect(pieHit(m, o, 52)).toBe(3); // in slice 2, 2° from the grey slice 3
    expect(pieHit(m, o, 47)).toBe(2); // 7° away: still slice 2
    expect(pieHit(m, o, 100)).toBe(5);
    // drawn smaller (0.8px a unit: a slice is 25px of rim), the widening is wider in degrees
    expect(pieHit(m, o, 49, 0.8)).toBe(3);
    expect(pieHit(m, o, 49, 1)).toBe(2);
    expect(pieHit(pie.manip, pieOwners(pie.manip, [3, 0, 0, 0]), 88)).toBe(2); // 30° slices are wide enough: no widening
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
    // the words are HTML at a fixed size, never SVG text that shrinks with the drawing (review: 10px at 320)
    expect(out).not.toMatch(/<text[\s>]/);
    expect(tagged(out, /class="mp-chart-cat[^"]*"[^>]*>([^<]+)</g)).toEqual(cats);
    expect(out).toContain('<p class="mp-chart-title" aria-hidden="true">מספר תלמידים</p>');
    expect(tagged(out, /class="mp-chart-num"[^>]*>([^<]+)</g)).toEqual(['0', '2', '4', '6', '8', '10', '12', '14']);
    const big = html(Chart, { m: tall.manip, value: [0, 0, 0, 0], answer: tall.answer });
    expect((big.match(/class="mp-chart-num"/g) || []).length).toBe(8);
    const fixed = html(Chart, { m: given.manip, value: [12, 0, 0, 0], answer: given.answer });
    expect(fixed).toContain('aria-readonly="true"');
    expect(fixed).toMatch(/class="mp-chart-given"[^>]*>12</); // a given bar says its value
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
    expect(tagged(out, /data-slice="\d+" data-owner="(-?\d+)"/g).map(Number)).toEqual([0, 0, 0, 1, 1, -1, -1, -1, -1, -1, -1, -1]);
    expect((out.match(/class="mp-chart-next"/g) || []).length).toBe(1); // where + goes next, on the rim
    expect(out).toMatch(/viewBox="0 0 216 216"/);
    const check = html(Chart, { m: pie.manip, value: [3, 2, 0, 0], answer: pie.answer, test: true });
    expect(check).toContain('כדורגל: 3 חלקים מתוך 12');
    expect(check).not.toMatch(/%/);
    const shown = html(Chart, { m: pie.manip, value: [3, 2, 0, 0], answer: pie.answer, reveal: true });
    expect(shown).toContain('צריך 6');
    for (const o of [out, check, shown]) expect(o).not.toMatch(/NaN|undefined|Infinity/);
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
    // a geo drawing with none of these has no words of its own (figWords), and figPlain says only that there is a
    // drawing (GEOM-1.5's reading, which the classroom lane brought first: "שרטוט", or its marks after it)
    const bare = { type: 'geo', pts: { A: [0, 0], B: [1, 0], C: [0, 1] }, polys: [{ pts: ['A', 'B', 'C'] }] };
    expect(figWords(bare)).toBe('');
    expect(figPlain(bare)).toBe('שרטוט');
    // a drawing that writes an angle's size is read angle by angle, each with its vertex, even with a written length
    expect(figPlain({ type: 'geo', pts: { A: [0, 0], B: [4, 0], C: [0, 3] }, segs: [{ a: 'A', b: 'B', label: 4 }], angles: [{ at: 'B', from: 'A', to: 'C', text: '37°' }] })).toBe('שרטוט: ∢B 37°, AB = 4');
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
  it('a netfig writes a word in a face and draws a straight way across the net, and says both (space:c3, MEASURE-7)', () => {
    const fig = { type: 'netfig', solid: 'box', dims: { a: 6, b: 5, c: 3 }, labels: true, shade: ['B', 'E'], names: { B: 'קדמית', E: 'מכסה' },
      path: { from: [0, 0], to: [6, 8], words: 'קו ישר מהפינה התחתונה של הדופן הקדמית עד הפינה הרחוקה של המכסה' } };
    const out = renderToStaticMarkup(createElement(Figure, { fig }));
    expect(out).not.toMatch(/NaN|undefined|Infinity/);
    const words = figPlain(fig);
    expect(out).toContain(`aria-label="${words}"`);
    for (const t of [...out.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((x) => x[1])) expect(words, t).toContain(t);
    expect(words).toContain('במלבן בשורה 2 ובעמודה 2: קדמית; במלבן בשורה 1 ובעמודה 2: מכסה');
    expect(words).toContain('קדמית ומכסה צבועים');
    // the words sit beside the way, not on it: each word's middle is off the line by more than a third of its face
    const names = [...out.matchAll(/<text x="([\d.]+)" y="([\d.]+)"[^>]*class="fg-net-name">/g)].map((x) => [Number(x[1]), Number(x[2]) - 5]);
    expect(names).toHaveLength(2);
    expect(words).toContain('קו ישר מהפינה התחתונה של הדופן הקדמית עד הפינה הרחוקה של המכסה');
    // the way is drawn from the front's bottom corner to the lid's far corner: the two shaded faces are one 6 by 8
    // rectangle, so the line is its diagonal, as long as √(6² + 8²) = 10 net lengths
    const line = out.match(/<g class="fg-net-path"><line x1="([\d.]+)" y1="([\d.]+)" x2="([\d.]+)" y2="([\d.]+)"/);
    expect(line).not.toBeNull();
    const shaded = [...out.matchAll(/<polygon points="([^"]+)" class="fg-net-face shade"/g)].map((x) => x[1].split(' ').map((p) => p.split(',').map(Number)));
    expect(shaded).toHaveLength(2);
    const xs = shaded.flat().map((p) => p[0]); const ys = shaded.flat().map((p) => p[1]);
    const [x1, y1, x2, y2] = line.slice(1).map(Number);
    expect(Math.min(x1, x2)).toBeCloseTo(Math.min(...xs), 1); expect(Math.max(x1, x2)).toBeCloseTo(Math.max(...xs), 1);
    expect(Math.min(y1, y2)).toBeCloseTo(Math.min(...ys), 1); expect(Math.max(y1, y2)).toBeCloseTo(Math.max(...ys), 1);
    const w = Math.max(...xs) - Math.min(...xs); const h = Math.max(...ys) - Math.min(...ys);
    expect(h / w).toBeCloseTo(8 / 6, 2);
    // and each word is beside the way, far enough from the line that the line does not cross its letters
    for (const [x, y] of names) {
      const d = Math.abs((y2 - y1) * x - (x2 - x1) * y + x2 * y1 - y2 * x1) / Math.hypot(x2 - x1, y2 - y1);
      expect(d, `a word at ${Math.round(x)}, ${Math.round(y)}`).toBeGreaterThan(14);
    }
  });

  // ---- the practice layer of boxes and prisms (content/solid.js, MEASURE-3) writes out what net.js computes, so that
  // it does not load the folding code: every net, every opposite face and every slot that closes is checked here
  describe('the nets of the boxes-and-prisms practice (content/solid.js)', () => {
    /** Every draw of a stair's practice of one kind, as makeItem gives it (a right answer is never a mistake). */
    const draws = (level, kind, n) => {
      const out = []; const L = SW.SOLID.levels[level - 1];
      for (let i = 0; out.length < n && i < 40 * n; i += 1) { const it = L.gen(); if (it.key.startsWith(`${kind}:`)) out.push({ ...it, diag: (u) => (isCorrect(it, u) ? null : it.diag(u)) }); }
      expect(out.length, kind).toBe(n);
      return out;
    };
    it('the eleven cube nets are net.js\'s, and every opposite face written out is the one the fold gives', () => {
      expect(SW.CUBE_NETS).toEqual(NET_LAYOUTS);
      for (const layout of Object.keys(NET_LAYOUTS)) {
        for (const id of 'ABCDEF') expect(SW.CUBE_OPPOSITE[layout][id], `${layout} ${id}`).toBe(oppositeFace({ solid: 'cube', dims: { a: 3 }, layout }, id));
      }
    });
    it('the six "not a net" shapes are six joined squares, none folds into a cube, and no two are the same shape', () => {
      const norm = (cells) => { const x0 = Math.min(...cells.map((c) => c[0])); const y0 = Math.min(...cells.map((c) => c[1])); return cells.map(([x, y]) => [x - x0, y - y0]).sort((a, b) => a[0] - b[0] || a[1] - b[1]); };
      const forms = (cells) => { const out = []; let c = cells; for (let r = 0; r < 4; r += 1) { c = c.map(([x, y]) => [y, -x]); out.push(norm(c), norm(c.map(([x, y]) => [-x, y]))); } return out; };
      const key = (cells) => forms(cells).map((f) => JSON.stringify(f)).sort()[0];
      for (const [name, cells] of Object.entries(SW.NOT_NETS)) {
        expect(new Set(cells.map((c) => c.join())).size, name).toBe(6);
        // joined: every square reached from the first through shared edges
        const seen = new Set([cells[0].join()]); const queue = [cells[0]];
        while (queue.length) { const [x, y] = queue.shift(); for (const c of cells) if (Math.abs(c[0] - x) + Math.abs(c[1] - y) === 1 && !seen.has(c.join())) { seen.add(c.join()); queue.push(c); } }
        expect(seen.size, name).toBe(6);
        const m = { solid: 'cube', dims: { a: 1 }, layout: cells, task: 'fold' };
        expect(closes(m, netModel(m).tree), name).toBe(false);
      }
      const keys = Object.values(SW.NOT_NETS).map(key);
      expect(new Set(keys).size).toBe(keys.length);
      Object.values(NET_LAYOUTS).forEach((cells) => expect(keys).not.toContain(key(cells)));
    });
    it('so1n: the face to tap is the opposite one; a face beside the shaded one is named opposite-adjacent', () => {
      for (const it of draws(1, 'so1n', 60)) {
        solves(it);
        const { layout, shade } = it.manip;
        expect(it.answer.face, it.key).toBe(oppositeFace(it.manip, shade));
        const beside = closedNeighbours(it.manip, shade);
        expect(beside, it.key).toHaveLength(4);
        beside.forEach((id) => expect(it.diag({ face: id }), `${it.key} ${id}`).toBe('opposite-adjacent'));
        expect(it.diag({ face: it.answer.face })).toBeNull();
        expect(it.diag({ face: shade }), `${layout}: the shaded face itself is not a mistake about opposite faces`).toBeNull();
      }
    });
    it('so3n: the slots the answer accepts are exactly the slots that fold closed', () => {
      for (const it of draws(3, 'so3n', 40)) {
        solves(it);
        const nm = netModel(it.manip);
        expect([...nm.okSlots].sort(), it.key).toEqual([...SW.PRISM_FIX_OK].sort());
        for (const s of nm.slots) {
          expect(closes(it.manip, netWithSlot(it.manip, s.id)), `${it.key} ${s.id}`).toBe(SW.PRISM_FIX_OK.includes(s.id));
          expect(isCorrect(it, { slot: s.id }), `${it.key} ${s.id}`).toBe(SW.PRISM_FIX_OK.includes(s.id));
        }
        expect(nm.slots.length, it.key).toBeGreaterThan(nm.okSlots.length);
      }
    });
    it('so2b and so4b: the build reaches its volume from its start by the steppers alone, and draws without NaN', () => {
      for (const it of [...draws(2, 'so2b', 25), ...draws(4, 'so4b', 25)]) {
        solves(it);
        const keys = netControls(it.manip, it.answer);
        const seen = new Set([JSON.stringify(it.manip.start)]); const queue = [it.manip.start]; let found = null;
        while (queue.length && !found) {
          const v = queue.shift();
          if (isCorrect(it, v)) { found = v; break; }
          for (const k of keys) for (const d of [-1, 1]) { const n = netStep(it.manip, v, k, d, it.answer); const j = JSON.stringify(n); if (!seen.has(j)) { seen.add(j); queue.push(n); } }
        }
        expect(found, it.key).toBeTruthy();
        expect(html(NetFold, { m: it.manip, value: it.manip.start, answer: it.answer })).not.toMatch(/NaN|undefined/);
      }
    });
    it('so1m: four nets drawn as buttons with words, exactly one folds, and it is the answer', () => {
      for (const it of draws(1, 'so1m', 40)) {
        expect(it.choices).toHaveLength(4);
        it.choices.forEach((c, i) => {
          const m = { solid: 'cube', dims: { a: 1 }, layout: c.fig.layout, task: 'fold' };
          expect(closes(m, netModel(m).tree), `${it.key} ${c.text}`).toBe(i === it.answer);
          const out = renderToStaticMarkup(createElement(Figure, { fig: c.fig }));
          expect(out).toMatch(/<svg/); expect(out).not.toMatch(/NaN|undefined|Infinity/);
          expect(figPlain(c.fig)).toMatch(/^פריסה של קובייה: בשורה העליונה/);
        });
        expect(new Set(it.choices.map((c) => figPlain(c.fig))).size, it.key).toBe(4);
      }
    });
  });
});

// ---------------------------------------------------------------- the circle (stage 4, MEASURE-1.3)
// No stair uses the object yet: these are fixtures, the spec's own explores (circle:1, circle:2), a radius to set, and
// circle:2's practice ci2m (a radius set on the disc in sectors).
describe('the circle (עיגול)', () => {
  const circ = (manip, answer) => fixture({ kind: 'circle', rMax: 8, rStep: 0.5, ...manip }, answer);
  const radius = circ({ show: 'circumference', start: { r: 2, t: 0 } }, { mode: 'r', r: 5 });
  const roll = circ({ show: 'circumference', start: { r: 2, t: 0 } }, { mode: 'unrolled' });
  const slices = circ({ show: 'area', start: { r: 4, n: 4 } }, { mode: 'sectors', min: 16 });
  // circle:2's ci2m: the disc in sectors, its radius set until its area is about S (radius: true gives it a Stepper)
  const areaR = circ({ show: 'area', radius: true, start: { r: 2, n: 16 } }, { mode: 'r', r: 5 });
  const all = [radius, roll, slices, areaR];
  it('every answer kind: the solution is right, the near miss and the start are not, and the words hold no undefined', () => {
    for (const it of all) solves(it);
    expect(manipSolution(radius)).toEqual({ r: 5, t: 0 }); expect(manipWrong(radius)).toEqual({ r: 5.5, t: 0 });
    expect(manipSolution(roll)).toEqual({ r: 2, t: 1 }); expect(manipWrong(roll)).toEqual({ r: 2, t: 0.5 });
    expect(manipSolution(slices)).toEqual({ r: 4, n: 16 }); expect(manipWrong(slices)).toEqual({ r: 4, n: 4 });
    expect(isCorrect(slices, { r: 4, n: 32 })).toBe(true); // at least min
    expect(isCorrect(slices, { r: 4, n: 17 })).toBe(false); // not a number of sectors the stepper has
    expect(isCorrect(radius, { r: 5, t: 1 })).toBe(true); // the roll does not matter to the radius
    expect(isCorrect(radius, { r: 9, t: 0 }) || isCorrect(radius, { r: 0, t: 0 })).toBe(false);
    expect(manipWrong(circ({ show: 'circumference', start: { r: 2, t: 0 } }, { mode: 'r', r: 8 }))).toEqual({ r: 7.5, t: 0 });
    expect(manipSolution(areaR)).toEqual({ r: 5, n: 16 }); expect(manipWrong(areaR)).toEqual({ r: 5.5, n: 16 });
    expect(isCorrect(areaR, { r: 5, n: 4 })).toBe(true); // the sectors do not matter to the radius
  });
  it('the disc in sectors has a radius Stepper only when its task sets the radius', () => {
    expect(circleControls(slices.manip)).toEqual(['n']);
    expect(circleControls(areaR.manip)).toEqual(['r', 'n']);
    expect(circleControls(radius.manip)).toEqual(['r', 't']);
    expect(circleStep(areaR.manip, { r: 2, n: 16 }, 'r', 1)).toEqual({ r: 2.5, n: 16 });
    const out = html(CircleRoll, { m: areaR.manip, value: { r: 5, n: 16 }, answer: areaR.answer });
    expect(out).toContain('רדיוס גדול ב־0.5'); expect(out).toContain('יותר פרוסות');
    expect(out.replace(/<[^>]+>/g, '')).toContain('שטח ≈ 78.5');
    expect(html(CircleRoll, { m: slices.manip, value: { r: 4, n: 4 }, answer: slices.answer })).not.toContain('רדיוס גדול');
  });
  it('every task reaches its answer by its steppers alone, within rMax', () => {
    for (const it of all) {
      const keys = circleControls(it.manip);
      const seen = new Set([JSON.stringify(it.manip.start)]); const queue = [it.manip.start]; let found = null;
      while (queue.length && !found) {
        const v = queue.shift();
        if (isCorrect(it, v)) { found = v; break; }
        for (const k of keys) for (const d of [-1, 1]) { const n = circleStep(it.manip, v, k, d); const s2 = JSON.stringify(n); if (!seen.has(s2)) { seen.add(s2); queue.push(n); } }
      }
      expect(found, JSON.stringify(it.answer)).toBeTruthy();
    }
    expect(circleStep(radius.manip, { r: 8, t: 0 }, 'r', 1)).toEqual({ r: 8, t: 0 });
    expect(circleStep(radius.manip, { r: 0.5, t: 0 }, 'r', -1)).toEqual({ r: 0.5, t: 0 });
    expect(circleStep(roll.manip, { r: 2, t: 1 }, 't', 1)).toEqual({ r: 2, t: 1 });
    expect(circleStep(slices.manip, { r: 4, n: 32 }, 'n', 1)).toEqual({ r: 4, n: 32 });
    expect(SECTORS).toEqual([4, 6, 8, 12, 16, 24, 32]);
  });
  it('is said in words; the readouts as the spec writes them, and in a check no circumference or area', () => {
    expect(answerText(radius)).toBe('רדיוס 5');
    expect(answerText(roll, { r: 5, t: 1 })).toBe('עיגול ברדיוס 5, מגולגל עד הסוף');
    expect(answerText(slices, { r: 5, n: 32 })).toBe('עיגול ברדיוס 5, חתוך ל־32 פרוסות');
    expect(circleSaid(roll.manip, { r: 5, t: 1 }).line).toBe('רדיוס 5 · קוטר 10 · היקף ≈ 31.4');
    expect(circleSaid(slices.manip, { r: 5, n: 32 }).line).toBe('32 פרוסות · בסיס ≈ 15.7 · גובה 5 · שטח ≈ 78.5');
    expect(circleSaid(roll.manip, { r: 5, t: 1 }, { test: true }).line).toBe('רדיוס 5 · קוטר 10');
    for (const it of all) expect(itemPlain(it)).not.toMatch(/undefined|NaN/);
    const open = html(CircleRoll, { m: roll.manip, value: { r: 5, t: 1 }, answer: roll.answer });
    expect(open).toContain('aria-valuetext="עיגול ברדיוס 5, מגולגל עד הסוף"');
    expect(open).toContain('≈ 3.14 קטרים'); expect(open).toContain('היקף ≈ 31.4');
    // the readout's pairs are kept whole: a narrow screen wraps between them, never inside one
    expect(open).toMatch(/<span class="mp-circ-part"><span class="mp-circ-sep"> · <\/span>היקף ≈ 31.4<\/span>/);
    for (const [it, v] of [[roll, { r: 5, t: 1 }], [radius, { r: 5, t: 0.5 }], [slices, { r: 5, n: 32 }]]) {
      const check = html(CircleRoll, { m: it.manip, value: v, answer: it.answer, test: true });
      expect(check, JSON.stringify(v)).not.toMatch(/היקף|שטח|≈|hit/);
      expect(check.replace(/<[^>]+>/g, '')).toContain('רדיוס 5 · קוטר 10');
    }
    // the line is marked in diameters: 0, d, 2d, 3d, 4d for the radius set
    const marks = [...html(CircleRoll, { m: radius.manip, value: { r: 2.5, t: 0 }, answer: radius.answer }).matchAll(/class="mp-num">([^<]*)</g)].map((x) => x[1]);
    expect(marks).toEqual(['0', '5', '10', '15', '20']);
    for (const it of all) {
      const out = html(CircleRoll, { m: it.manip, value: it.manip.start, answer: it.answer, reveal: true });
      expect(out).not.toMatch(/NaN|undefined/);
      expect(out).toMatch(/mp-circ-ghost/);
    }
  });
  it('the sectors lie alternately up and down, each sharing an edge with the next, into a shape πr wide', () => {
    for (const n of SECTORS) {
      const st = sectorStrip(n, 50, 0); const th = (2 * Math.PI) / n;
      const ends = (p) => [p.a, p.b].map((a) => [p.apex[0] + 50 * Math.cos(a), p.apex[1] + 50 * Math.sin(a)]);
      for (let k = 0; k + 1 < n; k += 1) {
        const [x, y] = [st[k], st[k + 1]];
        // the right edge of one piece is the left edge of the next: from one's apex to the other's
        const shared = [x.apex, ...ends(x)].filter((p) => [y.apex, ...ends(y)].some((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-9));
        expect(shared.length, `${n} sectors, pieces ${k} and ${k + 1}`).toBe(2);
        expect(x.up).toBe(!y.up);
      }
      // the base: along the top, from the first apex to the last piece's far corner, n/2 chords (πr as n grows)
      const base = st[n - 1].apex[0] + 50 * Math.sin(th / 2) - st[0].apex[0];
      expect(base).toBeCloseTo((n / 2) * 100 * Math.sin(th / 2), 9);
      if (n === 32) expect(Math.abs(base - Math.PI * 50) / (Math.PI * 50)).toBeLessThan(0.005);
    }
  });
});

// ---------------------------------------------------------------- the solid figure (stage 4, MEASURE-1.5)
describe('the solid figure: box, cube, prism, cylinder and cone, with their diagonals, cubes, cuts and sections', () => {
  const figs = [
    { type: 'solid', shape: 'box', a: 7, b: 4, c: 3 },
    { type: 'solid', shape: 'box', a: 7, b: 4, c: 3, diag: 'space' },
    { type: 'solid', shape: 'box', a: 6, b: 4, c: 5, diag: ['face', 'space'] },
    { type: 'solid', shape: 'box', a: 3, b: 4, c: 6, diag: 'tri' },
    { type: 'solid', shape: 'box', a: 4, b: 3, c: 2, cubes: true },
    { type: 'solid', shape: 'box', a: 6, b: 4, c: 5, cut: 'diagonal' },
    { type: 'solid', shape: 'box', a: 8, b: 4, c: 5, cut: 'half' },
    { type: 'solid', shape: 'box', a: 6, b: 4, c: 3, open: true },
    { type: 'solid', shape: 'box', a: 8, b: 4, c: 5, labels: { a: 'x', c: '?' } },
    { type: 'solid', shape: 'cube', a: 4 },
    { type: 'solid', shape: 'cube', a: 10, label: '1 ליטר' },
    { type: 'solid', shape: 'cube', a: 2, diag: 'face' },
    { type: 'solid', shape: 'prism', p: 3, q: 4, L: 10 },
    { type: 'solid', shape: 'prism', p: 3, q: 4, r: 5, L: 10 },
    { type: 'solid', shape: 'prism', p: 10, h: 3, q: 5, L: 8 },
    { type: 'solid', shape: 'cylinder', r: 3, h: 10 },
    { type: 'solid', shape: 'cylinder', r: 2, h: 5, diag: 'axial' },
    { type: 'solid', shape: 'cylinder', r: 3, h: 8, diag: 'rod' },
    { type: 'solid', shape: 'cone', r: 6, h: 8, l: 10 },
    { type: 'solid', shape: 'cone', r: 6, h: 8, l: 10, diag: 'axial' },
    { type: 'solid', shape: 'box', a: 5, b: 3, c: 2, labels: false },
  ];
  it('each renders, with no broken numbers, and reads every number and word it writes', () => {
    for (const fig of figs) {
      const out = renderToStaticMarkup(createElement(Figure, { fig }));
      expect(out, JSON.stringify(fig)).toMatch(/<svg/);
      expect(out, JSON.stringify(fig)).not.toMatch(/NaN|undefined|Infinity/);
      const words = figPlain(fig);
      expect(out).toContain(`aria-label="${words}"`);
      const drawn = [...out.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((x) => x[1]);
      for (const t of drawn) expect(words, `${JSON.stringify(fig)}: ${t}`).toContain(t);
      // every length given is written, unless labels say otherwise
      if (fig.labels == null) Object.values(solidLabels(fig)).forEach((t) => expect(drawn, `${JSON.stringify(fig)}: ${t}`).toContain(t));
    }
  });
  it('says what it draws', () => {
    expect(figPlain(figs[1])).toBe('תיבה: אורך 7, רוחב 4, גובה 3; מסומן אלכסון התיבה');
    expect(figPlain(figs[2])).toBe('תיבה: אורך 6, רוחב 4, גובה 5; מסומנים אלכסון של הבסיס ואלכסון התיבה');
    expect(figPlain(figs[3])).toBe('תיבה: אורך 3, רוחב 4, גובה 6; מסומן המשולש ישר־הזווית שצלעותיו אלכסון הבסיס, המקצוע האנכי שבקצה שלו ואלכסון התיבה');
    expect(figPlain(figs[4])).toBe('תיבה: אורך 4, רוחב 3, גובה 2; בנויה מקוביות שמקצוען 1');
    expect(figPlain(figs[7])).toBe('תיבה: אורך 6, רוחב 4, גובה 3; בלי מכסה');
    expect(figPlain(figs[8])).toBe('תיבה: אורך x, רוחב 4, גובה ?');
    expect(figPlain(figs[10])).toBe('קובייה שמקצועה 10; כתוב: 1 ליטר');
    expect(figPlain(figs[12])).toBe('מנסרה משולשת: בסיס: משולש ישר־זווית שניצביו 3 ו־4; אורך המנסרה 10');
    expect(figPlain(figs[14])).toBe('מנסרה משולשת: בסיס: משולש שצלע אחת שלו 10 והגובה אליה 3, וצלע נוספת 5; אורך המנסרה 8');
    expect(figPlain(figs[16])).toBe('גליל: רדיוס הבסיס 2, גובה 5; מסומן החתך הצירי: מלבן');
    expect(figPlain(figs[19])).toBe('חרוט: רדיוס הבסיס 6, גובה 8, קו יוצר 10; מסומן החתך הצירי: משולש שווה־שוקיים');
    expect(figPlain(figs[20])).toBe('תיבה');
  });
  it('draws its hidden edges dashed, the base of a cylinder and a cone half dashed, and its marks', () => {
    const r = (fig) => renderToStaticMarkup(createElement(Figure, { fig }));
    expect((r(figs[0]).match(/class="fg-solid-hidden"/g) || []).length).toBe(3); // the three edges at the hidden corner
    expect((r(figs[12]).match(/class="fg-solid-hidden"/g) || []).length).toBe(3);
    expect((r(figs[15]).match(/fg-solid-hidden/g) || []).length).toBe(1); // the back of the base
    expect((r(figs[18]).match(/fg-solid-hidden/g) || []).length).toBe(2); // the back of the base and the height
    expect(r(figs[3])).toMatch(/fg-solid-tri/); expect(r(figs[3])).toMatch(/fg-solid-diag edge/);
    expect(r(figs[2])).toMatch(/fg-solid-diag face/); expect(r(figs[2])).toMatch(/fg-solid-diag space/);
    expect((r(figs[4]).match(/fg-solid-unit/g) || []).length).toBe((4 - 1) * 2 + (2 - 1) * 2 + (3 - 1) * 2);
    expect(r(figs[5])).toMatch(/fg-solid-cut/); expect(r(figs[7])).toMatch(/fg-solid-inside/);
    expect(r(figs[17])).toMatch(/fg-solid-axial/);
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
    // a slide-only item has one row: no empty second row takes a gap from the plane
    const slideOnly = html(Transform, { m: { ...busy, moves: { drag: true } }, value: null, answer: ans });
    expect((slideOnly.match(/class="mp-tf-row/g) || []).length).toBe(1);
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

  // one rule for the class's signs in a screen reader's words (components/MathText.jsx texText): they are said, as the
  // classroom lane's ∢ is ("זווית"), since a screen reader has no Hebrew name for ∢, △, ≅, ∼, ∥ or ⊥
  it('screen-reader words say the class\'s signs', () => {
    expect(texText('\\sphericalangle AMC = \\sphericalangle BMD')).toBe('זווית AMC = זווית BMD');
    expect(texText('\\triangle ABC \\cong \\triangle KML')).toBe('משולש ABC חופף ל־משולש KML');
    expect(texText('\\triangle ADE \\sim \\triangle ABC')).toBe('משולש ADE דומה ל־משולש ABC');
    expect(texText('AB \\parallel CD, CD \\perp AB')).toBe('AB מקביל ל־CD, CD מאונך ל־AB');
    expect(texText('\\angle A')).toBe('זווית A');
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
