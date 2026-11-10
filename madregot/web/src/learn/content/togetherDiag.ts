// The last step of "solve together" is typed by the student. A wrong number there is diagnosed like any other
// answer: against the answer each of the stair's misconceptions predicts for this very problem.
//
// For each stair, one entry per guided problem (in order). An entry is either the stair's own diagnostic model
// with the problem's parameters (the model then predicts every misconception's answer, and a test checks that its
// right answer is the problem's), or, where the problem does not fit the model, the predictions written out, each
// with the reasoning in a comment. `{ bugs: {} }` says that no misconception of the stair can show on that number.
import type { SkillId, StairContent } from '../types';
import { same } from '../expr';
import { matchesValue } from '../misconceptions';

export type FinalDiag =
  | { model: 'diag' | 'transfer'; p: Record<string, unknown> }
  | { bugs: Record<string, number | number[]> };

export const TOGETHER_DIAG: Record<SkillId, FinalDiag[]> = {
  'frac:1': [
    { model: 'transfer', p: { a: 2, b: 5, m: 3, c: 15 } }, // 2/5 = ?/15: the same number added gives 2 + 10 = 12
    { model: 'diag', p: { d: 6, L: 1, k: 5 } }, // A at the 5th of 6 parts: counting the 5 marks gives 5/5 = 1
  ],
  'frac:2': [
    // 0.5, 0.45, 0.405 in order: read by length (more digits larger) the order is 0.5, 0.45, 0.405 and by the opposite
    // rule 0.405, 0.45, 0.5; either way 0.45 is in the middle, so no misconception shows on this number
    { bugs: {} },
    // the larger of 5/8 and 3/4: the bigger denominator taken as the bigger fraction gives 5/8
    { bugs: { 'bigger-den': 5 / 8 } },
  ],
  'signed:1': [
    { model: 'diag', p: { a: -3, b: -8, s: -1 } }, // −3 − (−8)
    { model: 'diag', p: { a: -5, b: -5, s: -1 } }, // −5 − (−5)
  ],
  'signed:2': [
    { model: 'diag', p: { k: 0, v: [-15, -4] } }, // the larger of −15 and −4
    // the smallest of −3, 0, −11, 2: among negatives the one closest to zero taken as smaller (−3); by distance only (0)
    { bugs: { 'neg-compare': -3, 'ignore-sign': 0 } },
  ],
  'signed:3': [
    { model: 'diag', p: { f: 1, a: -48, b: -6, c: 1 } }, // (−48) : (−6)
    { model: 'diag', p: { f: 2, a: -2, b: 5, c: -3 } }, // (−2) · 5 · (−3)
  ],
  'signed:4': [
    { model: 'diag', p: { f: 0, a: 9, b: 3, c: -5, s: -1 } }, // 9 − 3 · (−5)
    // −2 · 4 + 18 : (−6) = −11. Left to right: (−8 + 18) : (−6) = −5/3. A sign lost in the quotient: −8 + 3; in the product: 8 − 3
    { bugs: { order: -5 / 3, 'mul-sign': [-5, 5] } },
  ],
  'signed:5': [
    { model: 'diag', p: { f: 0, a: 8, o: -1, b: 3, s: -1, c: 10, d: 1 } }, // 8 − (3 − 10)
    { model: 'diag', p: { f: 1, a: -3, o: 1, b: 4, s: -1, c: 6, d: 5 } }, // −3 + (4 − 6) · 5
  ],
  'coord:1': [
    // L is under K(−4, 1) on the x-axis, so L(−4, 0) and its x is −4: "x is 0 on the x-axis" gives 0; the sign lost gives 4
    { bugs: { 'axis-zero': 0, sign: 4 } },
    { model: 'diag', p: { k: 0, x: -6, y: -2, ask: 0, rev: 0 } },
  ],
  'coord:2': [
    // Q(−8, 3) is in the second quadrant; counted clockwise, the second is called the fourth. Swapped, (3, −8) would be
    // in the fourth too, but the steps above ruled that out: the student read x = −8 as left and y = 3 as up
    { bugs: { 'quad-order': 4 } },
    // (−1, 4) and (−5, 2) are in the second quadrant; (0, 6) and (−3, 0) are on the axes, as the student just said in
    // the steps (so counting them, 4, is ruled out). Swapped, no point lands in the second; counted clockwise, the
    // "second" is the fourth, where there is none
    { bugs: { swap: 0, 'quad-order': 0 } },
  ],
  'coord:3': [
    { model: 'diag', p: { h: 0, f: -1, p: -6, q: 3 } }, // M(−1, −6), N(−1, 3)
    { model: 'diag', p: { h: 1, f: 4, p: -6, q: -2 } }, // R(−6, 4), S(−2, 4)
  ],
  'coord:4': [
    { model: 'diag', p: { x1: -5, x2: 1, y1: -3, y2: 2, d: 0 } }, // K(−5, −3) … M(1, 2)
    { model: 'transfer', p: { x1: -4, x2: 2, y1: -1, y2: 3, d: 1 } }, // opposite corners (−4, 3) and (2, −1)
  ],
  'coord:5': [
    // B of the rectangle with A(−3, 4), C(5, −2), D(−3, −2) is (5, 4); its y is 4. Swapped: 5. From the vertex across, D: −2
    { bugs: { swap: 5, 'wrong-neighbour': -2 } },
    // A(−5, −2), AB horizontal of length 7 to the right: B's x is 2. The length itself: 7; the minus of −5 lost: 12; the y: −2
    { bugs: { 'coord-length': 7, sign: 12, swap: -2 } },
  ],
  'angles:1': [
    // ∠AOB = 38°, its neighbour is 142°: the same 38°, completed to 90° (52°), or to 360° (322°)
    { bugs: { 'equal-not-supp': 38, 'wrong-total': 52, 'sum-360': 322 } },
    // two neighbours, one 30° larger: 75° and 105°. Completed to 90°: 30° and 60°; to 360°: 165° and 195°
    { bugs: { 'wrong-total': 60, 'sum-360': 195 } },
  ],
  'angles:2': [
    { model: 'diag', p: { k: 1, a: 104 } }, // ∠2 = 104°, ∠1 beside it
    // two equal neighbours are 90° each, and the one across is 90° too: every misconception gives 90 here
    { bugs: {} },
  ],
  'angles:3': [
    // ∠A = 35°, ∠C = 100°, so ∠B = 45°. From 360°: 225°; only one angle taken from 180°: 145° or 80°
    { bugs: { 'sum-360': 225, 'one-angle': [145, 80] } },
    // three equal angles: 60° each; from 360°: 120°
    { bugs: { 'sum-360': 120 } },
  ],
  'angles:4': [
    { bugs: { 'equal-not-supp': 72 } }, // co-interior with 72°: 108°, not 72°
    { bugs: { 'equal-not-supp': 58 } }, // co-interior with 58°: 122°, not 58°
  ],
  'angles:5': [
    // base angle 52°: the apex is 180° − 2 · 52° = 76°. Only one base angle taken away: 128°. 52° taken as the apex: 64°
    { bugs: { 'one-angle': 128, 'apex-base-swap': 64 } },
    // the exterior angle at C is 38° + 77° = 115°; the interior one is 65°
    { bugs: { 'interior-not-exterior': 65 } },
  ],
  'line:1': [
    // y = −2x + 3 at x = −4 is 11. Without b: 8. With x as if it were 4: −5. m and x added: −2 + (−4) + 3 = −3
    { bugs: { 'forgot-b': 8, 'neg-sub': -5, 'added-m': -3 } },
    // y = 5 − 3x at x = 4 is −7. As if y grew in proportion to x (4 times y at x = 1): 8. Without b: −12
    { bugs: { proportional: 8, 'forgot-b': -12 } },
  ],
  'line:2': [
    // y = −x − 2 at x = 1 is −3. The hidden 1 taken as 0: −2. A sign lost, of m (1 − 2) or of b (−1 + 2): −1 or 1
    { bugs: { 'hidden-one': -2, sign: [-1, 1] } },
    { model: 'transfer', p: { m: 3, b: 2, ask: 1, dx: 1, x0: 1 } }, // the table from x = 1: 5, 8, 11, 14
  ],
  'line:3': [
    // through (−3, 4) and (3, 0): −4/6 = −2/3. Upside down: −3/2. The sign lost: 2/3. The drop alone: −4
    { bugs: { inverse: -1.5, sign: 2 / 3, 'rise-only': -4 } },
    // through (0, 1) and (2, 6): 5/2. Upside down: 2/5. The sign turned: −5/2. The rise alone: 5
    { bugs: { inverse: 0.4, sign: -2.5, 'rise-only': 5 } },
  ],
  'line:4': [
    { model: 'diag', p: { x1: -1, y1: 3, x2: 3, y2: -5 } }, // A(−1, 3), B(3, −5)
    // from (2, 4) to (6, 10): 6/4 = 3/2. Upside down: 2/3. The points mixed between top and bottom: −3/2
    { bugs: { inverse: 2 / 3, 'mixed-order': -1.5 } },
  ],
  'line:5': [
    // m = 2 through (1, 7): b = 7 − 2 = 5. A point's y as b: 7 (or 1, of the other point). 2 · 1 moved without its sign
    // turning: 7 + 2 = 9. The sign of b turned: −5. x and y of the point swapped: 1 = 2 · 7 + b, b = −13
    { bugs: { 'b-is-y': [7, 1], 'move-no-flip': 9, 'b-sign': -5, swap: -13 } },
    // m = −2 through (−3, 4): b = 4 − 6 = −2. The point's y: 4. Moved without turning: 4 + 6 = 10. The sign turned: 2.
    // Swapped: −3 = −2 · 4 + b, b = 5
    { bugs: { 'b-is-y': 4, 'move-no-flip': 10, 'b-sign': 2, swap: 5 } },
  ],
  'line:6': [
    { model: 'diag', p: { m: 4, b: 10, ax: 0, f: 0, n: 0 } }, // y = 4x + 10
    { model: 'diag', p: { m: -3, b: 12, ax: 0, f: 1, n: 2 } }, // g(x) = 12 − 3x
  ],
  'line:7': [
    // y = x − 5 meets the axes at (0, −5) and (5, 0): 12.5. Without halving: 25. Legs added: 10. A negative length kept: −12.5
    { bugs: { 'no-half': 25, 'added-sides': 10, 'neg-length': -12.5 } },
    // y = 2x + 8 meets them at (0, 8) and (−4, 0): 16. Without halving: 32. Added: 12. Negative: −16. 8 not divided by 2: 8 · 8 / 2 = 32
    { bugs: { 'no-half': 32, 'added-sides': 12, 'neg-length': -16, 'no-divide': 32 } },
  ],
  'line:8': [
    { model: 'diag', p: { m1: 2, b1: 1, m2: -1, b2: 7, x: 2, y: 5, ask: 1 } },
    { model: 'diag', p: { m1: -2, b1: 1, m2: 1, b2: 7, x: -2, y: 5, ask: 1 } },
  ],
  'pyth:1': [
    { model: 'diag', p: { a: 8, b: 15, c: 17 } },
    { model: 'diag', p: { a: 20, b: 21, c: 29 } },
  ],
  'pyth:2': [
    { model: 'diag', p: { a: 12, b: 16, c: 20 } },
    { model: 'diag', p: { a: 24, b: 10, c: 26 } },
  ],
  'pyth:3': [
    // 20, 29, 21 is right-angled, with the hypotenuse written in the middle. A 0 ("not right") would fit the side written
    // last checked as the hypotenuse, or the sides compared without squaring, but the steps above it ruled both out: the
    // student chose 29, the longest side, compared the squares and concluded "right-angled". So no misconception is named
    { bugs: {} },
    // 9, 12, 16 is not right-angled; a right angle needs 15. Taken as right as it is (16) is ruled out by step 2, where
    // the student chose "not right-angled". The legs added as if the hypotenuse were their sum: 9 + 12 = 21
    { bugs: { 'add-legs': 21 } },
  ],
  'pyth:4': [
    { model: 'diag', p: { k: 0, ask: 1, c: 17, big: 15, small: 8 } }, // the kite: string 17, 8 along the ground
    // the screen 96 by 72: 120. The sides added: 168. The square not rooted: 14400
    { bugs: { 'add-legs': 168, 'no-root': 14400 } },
  ],
  'pyth:5': [
    // P(−5, 4), Q(4, −8): legs 9 and 12, distance 15. Legs added: 21. Not rooted: 225. Differences without the signs:
    // |4| − |−5| → 1 and |−8| − |4| → 4, so √17 ≈ 4.1 (kept exact: 4.1 and 4.12 both match it)
    { bugs: { 'add-legs': 21, 'no-root': 225, 'coord-diff': Math.sqrt(17) } },
  ],
  'stats:1': [
    // 12, 8, 15, 8, 12, 8, 3: the mode is 8. The biggest value: 15. How many times 8 appears: 3
    { bugs: { 'mode-max': 15, 'mode-count': 3 } },
    // with three more 5s the mode is 5 (five times); the biggest value is 7
    { bugs: { 'mode-max': 7 } },
  ],
  'stats:2': [
    // 10, 15, 4, 12, 7, 20, 8, 5 sorted: 4, 5, 7, 8, 10, 12, 15, 20, median 9. Unsorted middle: (12 + 7) / 2 = 9.5. Mean: 81/8.
    // One middle only: 8 or 10. The place in the list: 4.5
    { bugs: { unsorted: 9.5, 'mean-not-median': 81 / 8, 'one-middle': [8, 10], 'median-position': 4.5 } },
    // 9, 11, 10, 12, 58: median 11. Unsorted middle: 10. Mean: 20. The place: 3
    { bugs: { unsorted: 10, 'mean-not-median': 20, 'median-position': 3 } },
  ],
  'stats:3': [
    // 6, 13, 9, 2, 10: mean 8. The sum: 40. The median: 9. Halfway between the smallest and the biggest: 7.5
    { bugs: { 'no-divide': 40, 'median-not-mean': 9, midrange: 7.5 } },
    // mean 10 of four numbers, 8 added to one: 12. The 8 not shared among the four: 18
    { bugs: { 'no-divide': 18 } },
  ],
  'stats:4': [
    // grades 4, 6, 8 by 1, 2, 5 students: 56/8 = 7. Ignoring how many: 6. Divided by the grades: 56/3. Not divided: 56. Mean of the counts: 8/3
    { bugs: { 'ignore-freq': 6, 'wrong-count': 56 / 3, 'no-divide': 56, 'freq-as-data': 8 / 3 } },
    // and four more 10s: 96/12 = 8. Ignoring how many: 7. Divided by the grades: 24. Not divided: 96. Mean of the counts: 3
    { bugs: { 'ignore-freq': 7, 'wrong-count': 24, 'no-divide': 96, 'freq-as-data': 3 } },
  ],
  'stats:5': [
    // mean 7 of four, three known 4, 9, 6: the fourth is 9. The mean itself: 7. The mean times the known three only: 21 − 19 = 2
    { bugs: { 'mean-as-answer': 7, 'known-count': 2 } },
    // five friends of mean 12, six of mean 13: 78 − 60 = 18. The mean itself: 13. 13 times five: 65 − 60 = 5
    { bugs: { 'mean-as-answer': 13, 'known-count': 5 } },
  ],
  // Algebra. As for coord:2 and pyth:3, a prediction counts only when the steps the student has just solved leave it
  // possible: a bracket opened right in a step is not "opened wrong" in the last one, and an equation chosen in a step
  // is not "reversed". What is left is what the last step itself asks.
  'expr:1': [
    // 6 − 4x at x = −2: the steps put −2 in brackets and multiplied first, so what is left is 6 − (−8). Typing −2 there
    // subtracts −8 as if it were 8, a signed-number mistake, not one of this stair's
    { bugs: {} },
    // 3(x + 5) at x = −1: the steps worked out −1 + 5 = 4. Left: 3 next to the bracket read as digits, 34
    { bugs: { concat: 34 } },
  ],
  'expr:2': [
    // 5, 9, 13, 17, …: the steps found the step 4 and the 19 steps, so the 20th is 5 + 4 · 19 = 81. The start forgotten:
    // 4 · 19. A multiple of a term taken as the term: 20 times the 1st, 10 times the 2nd, 5 times the 4th
    { bugs: { 'diff-only': 76, 'whole-object': [100, 90, 85] } },
    // the steps wrote the long side 3a and the perimeter a + 3a + a + 3a: what is left is putting in a = 5
    { bugs: {} },
  ],
  'expr:3': [
    // the steps collected 5x − 3x = 2x and −2 + 9 = 7; at x = 4 the value is 15. Joined into one term: 9x, 36
    { bugs: { conjoin: 36 } },
    // the steps collected 3x and −4; at x = 3 the value is 5. Joined into one term: −x, −3
    { bugs: { conjoin: -3 } },
  ],
  'expr:4': [
    // the steps opened −4(x − 5) into −4x and +20; what is left is −8 + 20
    { bugs: {} },
    // the step opened 6(x + 3) into 6x + 18; what is left is 60 + 18
    { bugs: {} },
  ],
  'expr:5': [
    // the steps opened both brackets and collected 2x + 11; what is left is putting in x = 1
    { bugs: {} },
    // the step gave 7 − x; what is left is putting in x = 2
    { bugs: {} },
  ],
  'eq:1': [
    // −5x = 30, the step chose to divide by −5: 30 : (−5) = −6. The minus of −5 lost: 6
    { bugs: { sign: 6 } },
    // x + 8 = 3, the step chose to subtract 8 from both sides: 3 − 8 = −5
    { bugs: {} },
  ],
  'eq:2': [
    // 3x + 8 = 2, the steps subtracted 8 and divided by 3: (2 − 8) : 3 = −2
    { bugs: {} },
    // 17 = 4x + 5, the step subtracted 5, so 12 = 4x. The coefficient subtracted instead of divided by: 12 − 4
    { bugs: { 'sub-coef': 8 } },
  ],
  'eq:3': [
    // the steps took 2x and 8 from both sides: −15 = 3x, so x = −5. Neither term can have moved without its sign now
    { bugs: {} },
    // the step reached 4x = 2, so x = 1/2
    { bugs: {} },
  ],
  'eq:4': [
    // the step opened 5 − (x − 3) as 5 − x + 3, and the next added x to both sides: 8 = 3x − 4, so x = 4
    { bugs: {} },
    // the step opened both brackets: 2x + 10 = 4x − 4, so x = 7
    { bugs: {} },
  ],
  'eq:5': [
    // the light parcel is 4.5 kg, the heavy one 9: the heavy one answered. (The steps wrote x + 2x = 13.5, so the
    // relation reversed, x + x/2 = 13.5, which also gives 9, is ruled out.)
    { bugs: { 'wrong-unknown': 9 } },
    // the small angle is 35°, the large one 55°: the large one answered
    { bugs: { 'wrong-unknown': 55 } },
  ],
  'sys:1': [
    // the steps wrote 1.1x = 55, so the percent is of the old price: x = 50
    { bugs: {} },
    // the step found the price is 0.96 of the first one, so 100 before. The 4% taken of the new price: 96 + 3.84
    { bugs: { 'pct-of-new': 99.84 } },
  ],
  'sys:2': [
    // the steps found y = 2; x = 2 · 2 + 1 = 5. The value of y given again for x: the second unknown never computed
    { bugs: { 'forgot-y': 2 } },
    // the steps found x = 3; y = −3 + 4 = 1. The value of x given again
    { bugs: { 'forgot-y': 3 } },
  ],
  'sys:3': [
    // the steps reached 2x = 6, so x = 3; y = (19 − 15) : 2 = 2. The value of x given again
    { bugs: { 'forgot-y': 3 } },
    // the steps added the equations (no constant is subtracted) and reached 7x = 21: x is the unknown found first
    { bugs: {} },
  ],
  'sys:4': [
    // the steps reached 30 + 3y = 48, so 6 coins of 5 ₪ and 9 of 2 ₪: the other unknown answered
    { bugs: { 'wrong-unknown': 9 } },
    // the step reached 2x = 174, so 87 and 40: the larger one answered
    { bugs: { 'wrong-unknown': 87 } },
  ],
  'sys:5': [
    // x ≥ 3: the smallest whole solution is 3. 3 itself left out, as if it were x > 3: 4
    { bugs: { boundary: 4 } },
    // −x ≤ −4, so x ≥ 4: the smallest is 4. 4 itself left out: 5
    { bugs: { boundary: 5 } },
  ],
};

/** Every misconception's predicted answer to a guided problem's last step: [id, value] pairs, the right answer left out. */
export function finalPredictions(c: StairContent, k: number): [string, number][] {
  const spec = TOGETHER_DIAG[c.skill]?.[k];
  const answer = c.together[k]?.final.answer;
  if (!spec || answer == null) return [];
  const known = new Set(c.misconceptions.map((m) => m.id));
  let out: [string, number][];
  if ('model' in spec) {
    const model = spec.model === 'transfer' && c.transfer ? c.transfer : c.diag;
    out = Object.entries(model.bugs).map(([id, f]) => [id, f(spec.p as never)] as [string, number | null]).filter(([, v]) => v != null) as [string, number][];
  } else {
    out = Object.entries(spec.bugs).flatMap(([id, v]) => (Array.isArray(v) ? v : [v]).map((x) => [id, x] as [string, number]));
  }
  return out.filter(([id, v]) => known.has(id) && Number.isFinite(v) && !same(v, answer));
}

/** The misconceptions a typed last step fits (a prediction that is not whole matches the answer rounded to tenths). */
export function diagnoseFinal(c: StairContent, k: number, u: number): string[] {
  if (!Number.isFinite(u)) return [];
  const ans = c.together[k]?.final.answer;
  const ids = finalPredictions(c, k).filter(([, v]) => matchesValue(v, u, ans)).map(([id]) => id);
  return [...new Set(ids)];
}

/**
 * What a wrong last step most likely shows, in words: the misconceptions it fits, by name. The names are past-tense
 * descriptions ("החליפו בין $x$ ל־$y$") that read as advice without a frame, so they always come after "מה כנראה קרה:";
 * when more than one fits, each is said as a possibility, as in practice (screens/Lesson.jsx). Null when none fits.
 */
export function namedMistake(ids: string[], names: Record<string, string>): string | null {
  const t = [...new Set(ids.map((id) => names[id]).filter(Boolean))];
  if (!t.length) return null;
  return t.length === 1 ? `מה כנראה קרה: ${t[0]}.` : `מה כנראה קרה: אולי ${t.join(', ואולי ')}.`;
}
