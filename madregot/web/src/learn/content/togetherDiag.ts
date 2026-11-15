// The last step of "solve together" is typed by the student. A wrong number there is diagnosed like any other
// answer: against the answer each of the stair's misconceptions predicts for this very problem.
//
// For each stair, one entry per guided problem (in order). An entry is either the stair's own diagnostic model
// with the problem's parameters (the model then predicts every misconception's answer, and a test checks that its
// right answer is the problem's), or, where the problem does not fit the model, the predictions written out, each
// with the reasoning in a comment. `{ bugs: {} }` says that no misconception of the stair can show on that number.
//
// The last step starts where the steps left the problem, not where the problem began (SK-LEARN-4): frac:3's first
// problem is 6/10 + 5/10 by then, so adding across gives 11/20, not 4/7. A model takes the parameters of what the
// steps have shown. A misconception whose move a step offered and the student turned down (the choice's `misc`) is
// not predicted again, and a number a step turned down is no prediction unless `still` keeps it, with the reason in
// a comment (the same number reached by another slip, or offered for another quantity). content.test.ts checks both.
import type { SkillId, StairContent } from '../types';
import { same } from '../expr';
import { matchesValue } from '../misconceptions';

export type FinalDiag =
  | { model: 'diag' | 'transfer'; p: Record<string, unknown>; still?: string[] }
  | { bugs: Record<string, number | number[]>; still?: string[] };

export const TOGETHER_DIAG: Record<SkillId, FinalDiag[]> = {
  'frac:1': [
    // 2/5 = □/15: the step found that the denominator grew 3 times and turned down "by 10", so the same number
    // added (2 + 10 = 12) is a move the student has just rejected; what is left is 2 · 3
    { bugs: {} },
    // A at the 5th of 6 parts: the step counted 6 parts and turned down 5 (the marks), so 5/5 = 1 is ruled out
    { bugs: {} },
  ],
  'frac:2': [
    // 0.5, 0.45, 0.405 in order: read by length (more digits larger) the order is 0.5, 0.45, 0.405 and by the opposite
    // rule 0.405, 0.45, 0.5; either way 0.45 is in the middle, so no misconception shows on this number
    { bugs: {} },
    // the larger of 5/8 and 3/4: the step wrote 6/8 > 5/8, both in eighths, so "the bigger denominator is bigger"
    // has nothing left to compare
    { bugs: {} },
  ],
  'frac:3': [
    // 3/5 + 1/2, which the steps wrote as 6/10 + 5/10: adding across now gives 11/20 (4/7 was across the fractions the
    // student no longer looks at). The numerators not expanded (4/10) is the choice step 2 turned down; on 6/10 + 5/10
    // it gives the answer itself
    { model: 'diag', p: { a: 6, b: 10, c: 5, d: 10, op: 1, L: 10 } },
    // 3/4 − 1/3, which the steps wrote as 9/12 − 4/12: across is no subtraction mistake here (12 − 12 = 0 below), and
    // the numerators are already expanded, so no misconception is left on the last number
    { model: 'diag', p: { a: 9, b: 12, c: 4, d: 12, op: -1, L: 12 } },
  ],
  'frac:4': [
    // 2/5 · 3/5: the step found the denominator 25 and turned down 5 (the denominator kept, 6/5)
    { bugs: {} },
    // 3/4 litre in cups of 1/8: the step chose 3/4 : 1/8 and turned down both 1/8 : 3/4 (flipped, 1/6) and 3/4 · 1/8
    // (multiplied, 3/32)
    { bugs: {} },
  ],
  'ratio:1': [
    // "□ : 1" for scouts to instructors: the step wrote 10 : 2 and turned down 2 : 10 (0.2). The whole group (12 : 2,
    // 6) would mean leaving the 10 : 2 just written
    { bugs: {} },
    // 9 : 15 = 3 : □: the step divided both 9 and 15 by 3, so neither the other order (1.8) nor the 24 balls (8) is
    // left: what remains is 15 : 3
    { bugs: {} },
  ],
  'ratio:2': [
    // Tamar's 5 of 9 parts of 45, after the step found 9 parts of 5: Noa's 4 parts, 20, is the ratio read the other
    // way. (20 was also offered in the step, as 4 · 5 parts; that is another question, so `still` keeps it.) 5/4 of
    // 45 (56.25) needs the 9 parts the step just counted to be forgotten
    { bugs: { 'reversed-ratio': 20 }, still: ['reversed-ratio'] },
    // the long 3 of 4 parts of 36, after the step found 9 cm a part: the short part, 9, is the ratio read the other way;
    // 3/1 of 36 (108) needs the parts the step just counted to be forgotten
    { bugs: { 'reversed-ratio': 9 } },
  ],
  'ratio:3': [
    // 21 ₪ for 3 kg, 5 kg: the step found 7 ₪ a kilo and turned down 1/7 (flipped) and 18 (the same difference)
    { bugs: {} },
    // 150 km in 2 hours, 5 hours: the step found 75 km an hour and turned down 148 (the same difference); flipped
    // (5/75) needs the 75 just found to be turned over
    { bugs: {} },
  ],
  'ratio:4': [
    { model: 'diag', p: { k: 0, S: 20000, d: 12 } }, // 12 cm at 1 : 20,000 in metres: left in cm 240,000; as km 2.4
    // 4 by 3 cm at 1 : 100, in m²: the step wrote 4 m by 3 m and turned down 400 m (centimetres left unconverted)
    { bugs: {} },
  ],
  'func:1': [
    // the minute Dani was 800 m from home on the way back: reading the other crossing (the way out, 10) names no
    // misconception of the stair, and no prediction of the model fits this question
    { bugs: {} },
    // the litres added from hour 2 to hour 6: the value at the end, 500, instead of the change
    { bugs: { 'value-not-change': 500 } },
  ],
  'func:2': [
    { model: 'diag', p: { m: 4, b: 12, x: 8, y: 44, q: 0 } }, // 8 km at 4 ₪ and 12 ₪ once: the fixed part left out gives 32
    // paid 60 ₪: the step chose 4x + 12 = 60 and turned down 4 · 60 + 12 (60 put in for x, 252) and 60 : 4 (without the
    // 12, 15), so no misconception is left on the last number
    { bugs: {} },
  ],
  'func:3': [
    // up from (1, 3) to (4, 9), down to (6, 5), flat to 9: how long it rises; the falling part read instead gives 2, the
    // change in y 6
    { model: 'diag', p: { s: 1, x0: 1, x1: 4, x2: 6, x3: 9, y0: 3, y1: 9, y2: 5, q: 0 } },
    // the same graph, how long it falls: the rising part 3, the change in y 4
    { model: 'diag', p: { s: 1, x0: 1, x1: 4, x2: 6, x3: 9, y0: 3, y1: 9, y2: 5, q: 1 } },
  ],
  'func:4': [
    // the pool, 40 m³ at 8:00 and 130 at 11:00: per hour, 30. The step chose 90 in three hours and turned down 130 in
    // three hours (as if it started empty, 130 : 3) and 90 an hour (the whole change), so nothing is left to predict
    { bugs: {} },
    // the same pool at 13:00, five hours after 8:00: 190; from empty, 5 · 130 : 3; the start left out, 5 · 30 = 150
    { model: 'diag', p: { s: 40, r: 30, T: 3, v: 130, t: 5, q: 1 } },
  ],
  'pct:1': [
    { model: 'transfer', p: { a: 19, b: 25 } }, // 19 of 25 questions: the count of right answers, 19, written as the percent
    // 0.6 as a percent: the step wrote 60/100 and turned down 6 hundredths (the digit read as the percent)
    { bugs: {} },
  ],
  'pct:2': [
    // 30% of 70: the step found 10% = 7 and turned down 10 (the percent itself); 70 : 30 needs the 7 just found to be
    // dropped. What is left is 3 · 7
    { bugs: {} },
    // 25% of 28 pupils: the step said 25% is a quarter and turned down 1/25 (28 : 25); 25 pupils would contradict the
    // quarter just found
    { bugs: {} },
  ],
  'pct:3': [
    // 12 of 80: the step wrote 12/80 and turned down 80/12. Writing the part as the percent, 12, is still the move of
    // the last step
    { bugs: { 'count-as-pct': 12 } },
    // 50 against 40: the step took 40 as the whole and turned down the new price (80%). The new price itself, 50, is
    // still the move of the last step
    { bugs: { 'count-as-pct': 50 } },
  ],
  'pct:4': [
    // 25% is 300 g, after the step said 300 g is a quarter: a quarter of the 300 (75) is the percent taken of the part.
    // Stopping at 1% (12) belongs to a route the steps did not take
    { bugs: { 'pct-of-part': 75 } },
    // 30% is 45 km, after the step found 10% = 15: stopping there gives 15. 13.5 and 4.5 (percents of the part) were
    // turned down in the step, and 1.5 (stopping at 1%) belongs to a route the steps did not take
    { bugs: { 'stop-at-one': 15 } },
  ],
  'pct:5': [
    // 300 less 15%: the step chose × 0.85 and turned down × 0.15 (the discount alone, 45); 15 shekels off (285) needs
    // the × 0.85 just chosen to be dropped
    { bugs: {} },
    // 300 plus 15%: the step chose × 1.15, so 15 shekels on (315) and the rise alone (45) need it to be dropped
    { bugs: {} },
  ],
  // data:1-4 (curriculum stage 3, DATA-4): the spec's entries, each prediction checked by its critique/check.mjs D
  'data:1': [
    // blue − orange: the step read a square as 2 children and turned down "one child" (the squares counted, 3). Blue's
    // own 10 is still predicted: 10 was offered there as a square's worth, another quantity than the bar read alone
    { bugs: { 'one-value': 10 }, still: ['one-value'] },
    // the pupils measured: the shoe sizes added (190) and the rows counted (5) are no misconception of the stair
    { bugs: {} },
  ],
  'data:2': [
    // 7 of 25 chose volleyball: against the other 18 (7/18), the whole over the part (25/7), the count (7), in percent (28)
    { bugs: { 'part-part': 7 / 18, 'inverse-ratio': 25 / 7, 'freq-only': 7, 'pct-for-dec': 28 } },
    { bugs: { 'part-part': 6 / 14 } }, // 6 vegetarians of 20 against the other 14
  ],
  'data:3': [
    // 45% of 300: the percent itself 45; 300 : 45. 45 was offered in the step as 1% of 300, another quantity than the
    // percent typed as the count, so it is kept
    { model: 'diag', p: { N: 300, ps: [20, 45, 35], x: 1 }, still: ['count-as-pct'] },
    { model: 'transfer', p: { p: 25, N: 240, c: 60 } }, // 60 is 25%: 25% of 60 is 15; 60 : 25 = 2.4
  ],
  'data:4': [
    { model: 'diag', p: { c: [5, 2, 3], N: 10, j: 1, k: 3 } }, // red of 5, 2, 3: each colour a third 1/3; red against the rest 2/8
    // 150 sixes in 600 throws: the step chose 150/600 and turned down 1/6 (the fair die's), so what is left is 150
    // against the other 450
    { bugs: { 'part-part': 150 / 450 } },
  ],
  // curriculum stage 4's transformations (learn/content/transf.ts)
  'transf:1': [
    // P(−3, 2) moved 4 right and 5 down, the y of P′: the other way 7, the shifts swapped 6, along x only 2
    { model: 'transfer', p: { p1: -3, p2: 2, dx: 4, dy: -5, ask: 'y' } },
    // A(1, 1) → A′(4, −1), so B(−2, 3) → the x of B′: the other way −5, the shifts swapped −4, along y only −2
    { model: 'diag', p: { a1: 1, a2: 1, dx: 3, dy: -2, c1: -2, c2: 3, ask: 'x' } },
  ],
  'transf:2': [
    // C(−2, −5) in the x-axis, the y of C′: in the other axis y stays −5 (the model's line y = k needs k ≠ 0: in the
    // axis itself "the axis, not the line" is the answer, and both signs changed gives the same y, 5)
    { bugs: { 'wrong-axis': -5 } },
    // D(5, 2) in the line x = 3, the x of D′: the step measured 2 from the line and turned down 5 (from the y-axis, the
    // mirror in the y-axis, −5). Mirrored the other way x stays 5: the same number by another slip, so it is kept
    { bugs: { 'wrong-axis': 5 }, still: ['wrong-axis'] },
  ],
  'transf:3': [
    // P(−3, 1) a half turn about O(1, 2), the x of P′: the step measured 4 left of O and turned down 3 left (from the
    // origin, the turn about the origin, 3). Reflected through O (x kept) −3 is left
    { bugs: { 'reflect-not-turn': -3 } },
    // Q(2, 3) a quarter turn clockwise about the origin is (3, −2), the y of Q′: swapped with no sign (3, 2) and turned
    // the other way (−3, 2) both give 2; reflected in an axis instead (2, −3) or (−2, 3) gives −3 or 3
    { bugs: { 'rot-swap': 2, 'turn-direction': 2, 'reflect-not-turn': [-3, 3] } },
  ],
  'transf:4': [
    // two right triangles 3, 4, 5 glued along the hypotenuse make a 3 by 4 rectangle, 14: both perimeters added, 24
    { bugs: { 'double-perimeter': 24 } },
    // the fourth tile at a point with two squares and an equilateral triangle, 120°: no misconception of the stair
    // shows on an angle
    { bugs: {} },
  ],
  // curriculum stage 4's congruent triangles (learn/content/congr.ts)
  'congr:1': [
    // DEF ≅ RPQ, ∢E = 80°, ∢F = 40°, ∢R: R, last of P, Q, R, paired with F gives 40; only 80 taken from 180 gives 100
    { bugs: { 'alpha-order': 40, 'one-angle': 100 } },
    // ABC ≅ NML, BC = 3x − 4: BC taken equal to NM (the alphabet's pair), 3x − 4 = 8 gives 4
    { bugs: { 'alpha-order': 4 } },
  ],
  'congr:2': [
    // ∢F after ז.צ.ז: F matches C, so the alphabet's order cannot show on this one; only 50 taken from 180 gives 130
    { bugs: { 'one-angle': 130 } },
    // AB = QR, BC = RP, CA = PQ: R, last of P, Q, R, paired with C gives 95; only 35 taken from 180 gives 145
    { bugs: { 'alpha-order': 95, 'one-angle': 145 } },
  ],
  'congr:3': [
    // the perpendicular to the middle, ∢CAD = 62°: one triangle's angle only 28, only 62 taken from 180 gives 118
    { model: 'diag', p: { T: 'K5', a: 62, c: 0 } },
    // the crossing segments, (2x + 10)° = 50°: ∢ACM taken equal to ∢MBD, 70°, gives 30
    { model: 'diag', p: { T: 'K2', f: 'x', th: 50, ph: 70, p: 2, q: 10, x: 20 } },
  ],
  'congr:4': [
    // the rectangle 8 by 6, the area of ABE (12): the whole BC as the base gives 24
    { bugs: { 'full-base': 24 } },
    // the height from the area 15 of ADC on BC = 12 (5): BC as the base gives 2.5, the median 13 taken for the height
    { model: 'diag', p: { f: 'h', b: 12, h: 5, t: 12, m: 13, S: 15 } },
  ],
  'congr:5': [
    // sides 7 and 3 (5 lengths): both ends counted gives 7, only "shorter than the sum" (1 to 9) gives 9
    { model: 'diag', p: { a: 7, b: 3 } },
    // the isosceles triangle with sides 6 and 14 (34): legs of 6, which do not meet over 14, give 6 + 6 + 14 = 26
    { bugs: { 'ignore-inequality': 26 } },
  ],
  // curriculum stage 4's isosceles triangles and similarity (learn/content/sim.ts)
  'sim:1': [
    // ∢B = ∢C, AB = 2x + 5, AC = 4x − 3, BC = 3x − 1 (13): AB set equal to BC gives x = 6 and 17; x = 4 left as it is
    { model: 'diag', p: { x: 4, p: 2, q: 5, r: 4, s: -3, t: 3, u: -1 } },
    // the height from AB = AC = 10 over BC = 12 (8): the whole base gives √(100 − 144), no number; no other mistake of the
    // stair gives a number here
    { bugs: {} },
  ],
  'sim:2': [
    // 10 × 4 → 25 × ? (10): the same added gives 19, the factor turned over 1.6
    { model: 'diag', p: { k: 2.5, p: 10, q: 4 } },
    // 6 → 9, what 12 becomes (18): the same added gives 15, the factor turned over 8
    { model: 'diag', p: { k: 1.5, p: 6, q: 12 } },
  ],
  'sim:3': [
    // DE ∥ BC, AD = 5, DB = 10, DE = 4 (12): DB compared instead of AB gives 8, the same added 14
    { model: 'diag', p: { a: 5, b: 10, d: 4 } },
    // a stick 1 m with a shadow 1.5 m, a pole's shadow 6 m (4): the ratio turned over gives 0.25, the same added 5.5
    { model: 'transfer', p: { h: 1, s: 1.5, S: 6 } },
  ],
  'sim:4': [
    // k = 3 and the small area 7 (63): the area scaled like a length gives 21, the factor turned over 7/9
    { model: 'diag', p: { k: 3, p: 1, q: 3, S: 7 } },
    // the perimeter 24 with 6 → 9 (36): the perimeter scaled by k² gives 24 · 2.25 = 54
    { bugs: { 'area-for-perimeter': 54 } },
  ],
  'signed:1': [
    // −3 − (−8): the steps wrote −3 + 8 and moved 8 to the right, turning down −3 − 8, 3 + 8 and 8 to the left, so
    // −11 and 11 are moves the student has rejected. The sign lost at the end, −5, is still the last step's own slip
    { bugs: { sign: -5 } },
    // −5 − (−5): the step wrote −5 + 5 and turned down −5 − 5 and 5 + 5. On −5 + 5, adding the distances and keeping
    // the minus gives −10: the number the step turned down as −5 − 5, reached by another slip (`still`)
    { bugs: { 'abs-add': -10 }, still: ['abs-add'] },
  ],
  'signed:2': [
    // the larger of −15 and −4: the steps turned down comparing 15 with 4 and "−15, because 15 > 4", and placed −4 to
    // the right of −15. Both misconceptions give −15, which the student has just turned down
    { bugs: {} },
    // the smallest of −3, 0, −11, 2: the steps turned down 0 ("zero is nothing") and "−3, because 3 < 11", and wrote
    // −11 < −3
    { bugs: {} },
  ],
  'signed:3': [
    // (−48) : (−6): the step settled the sign first (positive), turning down "both negative, so negative" and "the
    // sign of −48", so −8 is a sign the student has just rejected
    { bugs: {} },
    // (−2) · 5 · (−3): the steps found −10 and then a positive sign for (−10) · (−3), turning down "negative"
    { bugs: {} },
  ],
  'signed:4': [
    // 9 − 3 · (−5): the steps multiplied first (turning down 9 − 3), found −15, and wrote 9 + 15 (turning down 9 − 15).
    // What is left is 9 + 15, where none of the stair's misconceptions has a move
    { bugs: {} },
    // −2 · 4 + 18 : (−6): the steps found −8 and −3 (turning down 4 + 18 first) and wrote −8 + (−3) as 8 + 3 with the
    // minus kept; left to right (−5/3) and a sign lost in a product (±5) are behind the student now
    { bugs: {} },
  ],
  'signed:5': [
    // 8 − (3 − 10): the steps found 3 − 10 = −7 (turning down opening the bracket as 8 − 3 − 10) and wrote 8 + 7
    // (turning down 8 − 7)
    { bugs: {} },
    // −3 + (4 − 6) · 5: the steps found −2 (turning down 6 · 5 first) and −3 + (−10) (turning down −3 + (−2) first)
    { bugs: {} },
  ],
  'signed:6': [
    // −4.2 + 2.5: the steps subtracted the distances (turning down 4.2 + 2.5) and chose the minus: what is left is −1.7
    { bugs: {} },
    // −1½ − (−2¾): the step wrote −1½ + 2¾ and turned down −1½ − 2¾ (subtracted as if positive, −4¼)
    { bugs: {} },
  ],
  'signed:7': [
    { model: 'diag', p: { f: 1, a: 2, n: 4 } }, // −2⁴ = −16: read as (−2)⁴ gives 16; the base times the exponent −8
    { model: 'diag', p: { f: 4, a: 2, n: 2, b: 5, c: 4 } }, // 5 − 4·(−2)² = −11: left to right (5 − 4)·4 = 4; (−2)·2 for the power gives 21
  ],
  'coord:1': [
    // L is under K(−4, 1) on the x-axis, so L(−4, 0) and its x is −4: "x is 0 on the x-axis" gives 0; the sign lost gives 4
    { bugs: { 'axis-zero': 0, sign: 4 } },
    // M is 6 down, then 2 right: (2, −6). The step asked for x and turned down −6 (the first move taken as x, so the
    // swap is behind the student). The sign of y can still be lost: 6. (6 was also offered in the step, for x; that is
    // another coordinate, so `still` keeps it)
    { bugs: { sign: 6 }, still: ['sign'] },
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
    // M(−1, −6), N(−1, 3): the step wrote 3 − (−6) and turned down 6 − 3 (the signs dropped, 3) and −6 − 3 (−9)
    { bugs: {} },
    // R(−6, 4), S(−2, 4): the step wrote −2 − (−6) and turned down −6 − (−2), the negative length −4
    { bugs: {} },
  ],
  'coord:4': [
    // K(−5, −3) … M(1, 2): the steps found the width 6 and the height 5 (turning down 5 − 1 and 3 − 2) and chose
    // 6 · 5 (turning down 6 + 5 and 2(6 + 5)), so nothing of the stair's is left on 30
    { bugs: {} },
    // opposite corners (−4, 3) and (2, −1): the steps found the width 6 and the height 4 (turning down 4 − 2 and
    // 3 − 1). The last step is the area itself, so the perimeter (20) and the sides added (10) can still show
    { bugs: { perimeter: 20, 'add-sides': 10 } },
  ],
  'coord:5': [
    // B of the rectangle with A(−3, 4), C(5, −2), D(−3, −2) is (5, 4); its y is 4. Swapped: 5. From the vertex across, D: −2
    { bugs: { swap: 5, 'wrong-neighbour': -2 } },
    // A(−5, −2), AB horizontal of length 7 to the right: B's x is 2. The step wrote −5 + 7 and turned down 7 (the
    // length itself) and 5 + 7 (the minus lost). The y, −2, which the steps put on screen, can still be typed for x
    { bugs: { swap: -2 } },
  ],
  'angles:1': [
    // ∠AOB = 38°, its neighbour 142°: the steps wrote 180° − 38° and turned down "equal" (38°) and 90° − 38° (52°);
    // 360° (322°) would mean leaving the 180° − 38° just written
    { bugs: {} },
    // two neighbours, one 30° larger: the steps found 180° together (turning down 360°) and the small one 75°; the big
    // one is 75° + 30°, and the totals the steps settled leave no misconception on it
    { bugs: {} },
  ],
  'angles:2': [
    // ∠2 = 104°, ∠1 beside it: the step wrote 180° − 104° and turned down "vertical, so equal" (104°)
    { bugs: {} },
    // two equal neighbours are 90° each, and the one across is 90° too: every misconception gives 90 here
    { bugs: {} },
  ],
  'angles:3': [
    // ∠A = 35°, ∠C = 100°: the steps wrote 180° − 35° − 100° and turned down 360° and 180° − 100°
    { bugs: {} },
    // three equal angles: the step wrote 180° : 3 and turned down 360° : 3
    { bugs: {} },
  ],
  'angles:4': [
    // co-interior with 72°: the step wrote 72° + x = 180° and turned down "equal" (72°)
    { bugs: {} },
    // the step wrote x = 180° − 58° and turned down "vertical, so equal" (58°)
    { bugs: {} },
  ],
  'angles:5': [
    // base angle 52°: the steps found two base angles and wrote 180° − 104°, turning down "one" and 180° − 52° (128°)
    // and (180° − 52°) : 2 (64°, the base taken as the apex)
    { bugs: {} },
    // the exterior angle at C: the step chose ∠A + ∠B and turned down 180° − 38° − 77° (the interior one, 65°)
    { bugs: {} },
  ],
  'angles:6': [
    // OC halves ∢AOB and ∢BOC = 37°: ∢AOB = 74°. The step chose 2 · 37° and turned down 37° itself (the part for the
    // whole) and 37° : 2 (half and double swapped), so no misconception of the stair is left on the last number
    { bugs: {} },
    // OC halves ∢AOB = 128°: ∢BOC = 64°. The whole: 128°; doubled instead of halved: 256°
    { model: 'diag', p: { k: 'h', w: 128 } },
  ],
  'angles:7': [
    // a right angle at B, ∢A = 115°, ∢C = 70°: ∢D = 85°. The steps counted three known angles (turning down two) and
    // chose 360° − 115° − 90° − 70°, turning down 360° − 115° − 70° (the right angle forgotten, 175°) and 180° − 115° −
    // 70° (a triangle's total): nothing is left to predict
    { bugs: {} },
  ],
  'line:1': [
    // y = −2x + 3 at x = −4 is 11. The steps wrote −2 · (−4) + 3 (turning down −2 − 4 + 3 and −2 · 4 + 3) and found
    // −2 · (−4) = 8; the + 3 is still to add, so without b, 8, is the last step's own slip
    { bugs: { 'forgot-b': 8 } },
    // y at x = 4, after the step wrote 5 + 4 · (−3) and turned down 4 · 2 (in proportion, 8). Without the 5: −12
    { bugs: { 'forgot-b': -12 } },
  ],
  'line:2': [
    // y = −x − 2 at x = 1 is −3. The steps found b = −2 and m = −1, turning down b = 2, m = 0 and m = 1, so the
    // hidden 1 taken as 0 and a lost sign are both behind the student
    { bugs: {} },
    // the table from x = 1 (5, 8, 11, 14): the steps found m = 3 and turned down "b is 5, the first value". The m just
    // found, 3, can still be typed for b
    { bugs: { 'm-b': 3 } },
  ],
  'line:3': [
    // through (−3, 4) and (3, 0): the steps found 6 to the right and a change of −4 (turning down "up 4"), so the sign
    // is settled. The division is the last step's own: upside down, −3/2; the drop alone, −4
    { bugs: { inverse: -1.5, 'rise-only': -4 } },
    // through (0, 1) and (2, 6): the steps wrote m = 5/2 and turned down 2/5; the sign and the division are settled
    { bugs: {} },
  ],
  'line:4': [
    // A(−1, 3), B(3, −5): the steps wrote (−5 − 3)/(3 − (−1)) and found 4 below, turning down both mixed orders and
    // 3 − (−1) = 2, so what is left is −8 : 4
    { bugs: {} },
    // from (2, 4) to (6, 10): 6/4 = 3/2, a new slope the last step works out. Upside down: 2/3; the points mixed
    // between top and bottom: −3/2. (2/3 was turned down in step 1 as the first pair's slope upside down; here it is
    // the same slip on the new pair, so `still` keeps it)
    { bugs: { inverse: 2 / 3, 'mixed-order': -1.5 }, still: ['inverse'] },
  ],
  'line:5': [
    // m = 2 through (1, 7), after the steps reached 7 = 2 + b (turning down b as a point's y and x, y swapped). Left:
    // the 2 moved without its sign turning, 7 + 2 = 9, or b with the sign turned, −5
    { bugs: { 'move-no-flip': 9, 'b-sign': -5 } },
    // m = −2 through (−3, 4), after the steps reached b = 4 − 6 (turning down x, y swapped and adding 6 to both sides).
    // Left: the sign of b turned, 2. The point's y, 4, would mean leaving the 4 − 6 just written
    { bugs: { 'b-sign': 2 } },
  ],
  'line:6': [
    // y = 4x + 10: the steps put y = 0 (turning down x = 0), reached 4x = −10 (turning down 10 = 4x) and wrote
    // x = −10/4 (turning down x = −10)
    { bugs: {} },
    // g(x) = 12 − 3x: the step reached 3x = 12 and turned down 3x = −12 and x = 12
    { bugs: {} },
  ],
  'line:7': [
    // y = x − 5: the steps found legs 5 and 5 (turning down −5 and 5). The area is the last step's own: without
    // halving, 25; the legs added, 10
    { bugs: { 'no-half': 25, 'added-sides': 10 } },
    // y = 2x + 8: the steps found legs 8 and 4 (turning down (−8, 0) and the length −4). Without halving: 32; added: 12
    { bugs: { 'no-half': 32, 'added-sides': 12 } },
  ],
  'line:8': [
    { model: 'diag', p: { m1: 2, b1: 1, m2: -1, b2: 7, x: 2, y: 5, ask: 1 } },
    { model: 'diag', p: { m1: -2, b1: 1, m2: 1, b2: 7, x: -2, y: 5, ask: 1 } },
  ],
  'pyth:1': [
    // legs 8 and 15: the steps squared them, added the squares to c² = 289 and chose to take the root, turning down
    // 8 + 15 and "289 is the hypotenuse", so neither the legs added (23) nor the root forgotten (289) is left
    { bugs: {} },
    // Danny's 20 + 21 = 41: the step turned down "no problem" and wrote c² = 841. The root is the last step's own, so
    // stopping at 841 can still show
    { bugs: { 'no-root': 841 } },
  ],
  'pyth:2': [
    // hypotenuse 20, leg 12: the steps took 400 as the whole and found b² = 256 (turning down 400 + 144 and 20 − 12).
    // The root is the last step's own: 256
    { bugs: { 'no-root': 256 } },
    // hypotenuse 26, leg 24: the step found b² = 676 − 576 = 100 (turning down 26² + 24²); the lengths subtracted (2)
    // would mean leaving the squares just written. The root forgotten: 100
    { bugs: { 'no-root': 100 } },
  ],
  'pyth:3': [
    // 20, 29, 21 is right-angled, with the hypotenuse written in the middle. A 0 ("not right") would fit the side written
    // last checked as the hypotenuse, or the sides compared without squaring, but the steps above it ruled both out: the
    // student chose 29, the longest side, compared the squares and concluded "right-angled". So no misconception is named
    { bugs: {} },
    // 9, 12, 16 is not right-angled; a right angle needs 15. Taken as right as it is (16) is ruled out by step 2, where
    // the student chose "not right-angled", and the legs added (9 + 12 = 21) by step 1, which turned down 9 + 12 against
    // 16 and compared the squares
    { bugs: {} },
  ],
  'pyth:4': [
    // the kite: string 17, 8 along the ground. The steps reached h² = 289 − 64 = 225 (turning down 17² + 8² and
    // 17 − 8); the root is the last step's own: 225
    { bugs: { 'no-root': 225 } },
    // the screen 96 by 72: the step wrote d² = 96² + 72², so the sides added (168) would mean leaving the squares just
    // written. The square not rooted: 14400
    { bugs: { 'no-root': 14400 } },
  ],
  'pyth:5': [
    // P(−5, 4), Q(4, −8): the steps found legs 9 and 12 (turning down the differences without the signs, 1 and 4) and
    // wrote √(81 + 144) = √225 (turning down 9 + 12 = 21 and stopping at 9² + 12² = 225), so what is left is √225
    { bugs: {} },
  ],
  'stats:1': [
    // 12, 8, 15, 8, 12, 8, 3: the steps counted (turning down "the biggest value, 15") and found 8 three times. How
    // many times, 3, can still be written instead of the value
    { bugs: { 'mode-count': 3 } },
    // with three more 5s the mode is 5 (five times); the biggest value is 7
    { bugs: { 'mode-max': 7 } },
  ],
  'stats:2': [
    // 10, 15, 4, 12, 7, 20, 8, 5: the steps sorted the list (turning down the unsorted middle and the mean) and found
    // the middles 8 and 10 (turning down each alone). The place between them, 4.5, can still be written for the value
    { bugs: { 'median-position': 4.5 } },
    // 9, 11, 10, 12, 58: the steps sorted it and found the middle in the third place, so the unsorted middle (10) is
    // behind the student. The mean, 20, stands in the problem, and the place, 3, was just found: both can still be typed
    { bugs: { 'mean-not-median': 20, 'median-position': 3 } },
  ],
  'stats:3': [
    // 6, 13, 9, 2, 10: mean 8. The steps found the sum 40 (turning down the middle value and halfway between 2 and 13)
    // and chose to divide by 5; the division is the last step's own, so the sum, 40, can still show
    { bugs: { 'no-divide': 40 } },
    // mean 10 of four numbers, 8 added to one: the steps found the new sum 48. Not divided: 48; and the 8 not shared
    // among the four, 18, the old mean plus 8, which the problem's own numbers invite
    { bugs: { 'no-divide': [18, 48] } },
  ],
  'stats:4': [
    // grades 4, 6, 8 by 1, 2, 5 students: the steps found 8 students and the sum 56 (turning down 3 grades and
    // 4 + 6 + 8), so the mean of the counts (8/3) is behind the student too. Not divided: 56
    { bugs: { 'no-divide': 56 } },
    // and four more 10s: the steps found 12 students and the sum 96 (turning down 4 and 56 + 10). Not divided: 96
    { bugs: { 'no-divide': 96 } },
  ],
  'stats:5': [
    // mean 7 of four, three known 4, 9, 6: the steps wrote 7 · 4 = 28 and 28 − 19, turning down "the missing one is 7,
    // like the mean"; the known three only (21 − 19 = 2) would mean leaving the 28 just found
    { bugs: {} },
    // five friends of mean 12, six of mean 13: the steps found 60 and 78 (turning down 13 · 5 = 65). The new mean, 13,
    // can still be typed as his age
    { bugs: { 'mean-as-answer': 13 } },
  ],
  // stats:6-8 (curriculum stage 3, DATA-5): the spec's entries, each prediction checked by its critique/check.mjs D
  'stats:6': [
    // 14, 3, 9, 21, 6, 17: the range 18. The largest value: 21. The last minus the first: 17 − 14 = 3
    { bugs: { 'range-max': 21, 'first-last': 3 } },
    // a range of 25 and 8 added to every grade: the 8 added to the range
    { bugs: { 'shift-range': 33 } },
  ],
  'stats:7': [
    // the spring total against a monthly mean: 1050 − 330 = 720; all five months: 390 − 330 = 60
    { model: 'transfer', p: { m: [460, 440, 380, 350, 320], S: 330, seasons: [600, 330, 500, 400] } },
    // a warm-up with one right path: no misconception of the stair shows on 155
    { bugs: {} },
  ],
  'stats:8': [
    // 48 in 2011, 84 in 2017, asked 2013: the midpoint 66, the whole change each year 120, from the other end 72, the
    // change only 12
    { model: 'diag', p: { d: 6, j: 2, rate: 6, y1: 48, y2: 84, x1: 2011 } },
    // 240 by 12:00, 60 more every two hours, asked 18:00: the trend stopped 240, one step 300, hours as steps 600
    { bugs: { 'last-value': 240, 'one-step': 300, 'hours-as-steps': 600 } },
  ],
  // Probability (curriculum stage 3, DATA-6)
  'prob:1': [
    // cards 1 to 10, more than 7: the count 3, one card 1/10, "it happens or not" 1/2
    { model: 'diag', p: { n: 10, e: 'gt', t: 7, k: 3 } },
    // tickets 1 to 100, winners 1-5 and 91-100: 91 to 100 counted as 9 gives 14/100, the count 15
    { model: 'transfer', p: { N: 100, a: 5, b: 91, w: 15 } },
  ],
  'prob:2': [
    // red 0.35, blue 0.4, not blue: blue's own 0.4, 100 − 0.4, only red added 0.35
    { bugs: { 'same-prob': 0.4, 'hundred-minus': 99.6, 'others-given': 0.35 } },
    // winning 3/8, not winning: the same 3/8, 100 − 3/8
    { bugs: { 'same-prob': 3 / 8, 'hundred-minus': 100 - 3 / 8 } },
  ],
  'prob:3': [
    // a double of two dice: the 21 pairs without order taken as equally likely, 6/21
    { bugs: { 'space-21': 6 / 21 } },
    // red (one of three) and tails (one of two): the two added 1/3 + 1/2, one stage only 1/3 or 1/2
    { bugs: { 'add-probs': 1 / 3 + 1 / 2, 'one-stage': [1 / 3, 1 / 2] } },
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
  // stage 2 (measurement): areas and perimeters
  'area:1': [
    // the area of 11 by 3: the step chose 11 · 3 and turned down the border (11 + 3 + 11 + 3, the perimeter 28) and
    // 11 + 3 (the sides added, 14), so neither is predicted again
    { bugs: {} },
    // a fence of 40 round a garden 14 long: the steps read the 40 as the perimeter (turning down the area, 40 : 14) and
    // halved it to 20 (turning down one length off, 26), so no misconception is left on the last number
    { bugs: {} },
  ],
  'area:2': [
    // legs 9 and 12, hypotenuse 15: not halved 108; the hypotenuse taken as the height to either leg 90 or 67.5
    { bugs: { 'no-half': 108, 'hyp-as-height': [90, 67.5] } },
    // AC = 2x with BC = 6 and the area 48 (AC is 16): not halved, halved twice and x itself (8) all give 8, so the
    // number names no one mistake
    { bugs: {} },
  ],
  'area:3': [
    // the L 12 by 8 less 5 by 3: the step chose 12 · 8 less 5 · 3 and turned down 12 · 8 (the whole, 96) and the part
    // added (111); the two parts with the shared part twice (12 · 5 + 7 · 8 = 116) is still a way to get it wrong
    { bugs: { 'double-count': 12 * 5 + 7 * 8 } },
    { model: 'transfer', p: { W: 8, H: 5, p: 4, q: 2 } }, // 8 by 5 less the triangle 4, 2: the whole 40; the rectangle taken off 32
  ],
  'area:4': [
    // the parallelogram 14, height 5, side 13: the step chose 14 · 5 and turned down 14 · 13 (the slanted side, 182) and
    // 14 · 5 : 2 (halved, 35), so no misconception is left on the last number
    { bugs: {} },
    // the trapezoid 6 and 10, height 5: not halved 80; only the long base 50
    { bugs: { 'no-half': 80, 'one-base': 50 } },
  ],
  'area:5': [
    { model: 'diag', p: { W: 12, H: 9, w: 5, h: 4 } }, // the L's fence: the written sides only 30; its area 88
    // the square 5 against the 8 by 2 rectangle, both of perimeter 20: the same perimeter read as the same area, 0
    { bugs: { 'same-perim-same-area': 0 } },
  ],
  // stage 2 (measurement): boxes and prisms
  'solid:1': [
    { model: 'diag', p: { a: 10, b: 6, c: 4 } }, // the gift box 10 by 6 by 4: three faces 124; its volume 240
    // the cube of edge 5: its volume 125 for the cardboard
    { bugs: { 'vol-for-surf': 125 } },
  ],
  'solid:2': [
    { model: 'diag', p: { a: 30, b: 20, c: 5 } }, // the baking tin 30 by 20 by 5: its surface 1700; the edges added 55
    // cubes of edge 2 in the box 8 by 6 by 4: its volume 192 divided by the edge 2 gives 96
    { bugs: { 'div-by-edge': 96 } },
  ],
  'solid:3': [
    { model: 'diag', p: { p: 9, q: 12, c: 15, L: 20 } }, // legs 9 and 12, hypotenuse 15, length 20: one base 774; no face on the hypotenuse 528
    // legs 6 and 8, length 10 (the hypotenuse 10 found): the legs added for it (14) 328; no face on it 188; one base 264
    { bugs: { 'add-legs': 328, 'missing-face': 188, 'one-base': 264 } },
  ],
  'solid:4': [
    // the trough (base 60 and its height 30, length 200) in litres: the base not halved 360
    { bugs: { 'no-half': 360 } },
    { model: 'diag', p: { p: 5, q: 12, c: 13, L: 10 } }, // legs 5 and 12, length 10: not halved 600; the hypotenuse for a leg 325
  ],
  // stage 2 (measurement): the circle, the cylinder and the cone. A π ≈ 3.14 final lists each mistake's number both ways,
  // with 3.14 and with the calculator's π, to tenths
  'circle:1': [
    // the wheel of diameter 70: 2π times the diameter 439.6 (439.8); the area of a disc of radius 35, 3846.5 (3848.5)
    { bugs: { 'd-for-r': [439.6, 439.8], 'area-for-circ': [3846.5, 3848.5] } },
    // a lap of the track of radius 50: the step found the diameter 100 and turned down 50 (π times the radius), so what
    // is left is its area, 50² = 2500
    { bugs: { 'area-for-circ': 2500 } },
  ],
  'circle:2': [
    // the pizza of diameter 30: the step found the radius 15 and turned down 30 (the diameter for the radius, which is
    // the diameter squared, 900). The circumference's 30 (πd = 30π) is still predicted: the same number by another slip,
    // the formula of the circumference for the area's
    { bugs: { 'circ-for-area': 30 }, still: ['circ-for-area'] },
    // the table of radius 60: its circumference 2 · 3.14 · 60 = 376.8 (377 with π)
    { bugs: { 'circ-for-area': [376.8, 377] } },
  ],
  'circle:3': [
    { model: 'diag', p: { r: 4, h: 12 } }, // the can's volume, radius 4 and height 12: the diameter squared 768; the label 96
    { model: 'transfer', p: { r: 4, h: 12 } }, // its label: πr for the width 48; the base's area times the height 192
  ],
  'circle:4': [
    { model: 'transfer', p: { r: 9, h: 12, l: 15 } }, // the funnel, radius 9 and slant 15 (height 12): the cylinder 972; the slant for the height 405
    // the cone carved out of the cylinder of radius 4 and height 9: the cone taken as the whole cylinder leaves 0
    { bugs: { 'no-third': 0 } },
  ],
  // and Pythagoras in space
  'space:1': [
    { model: 'transfer', p: { a: 60, b: 20, c: 90, d: 110 } }, // the crate 60 by 20 by 90: its base's diagonal 63.2; the edges added 170
    // the cube of edge 4: a face's diagonal 5.7; the edges added 12; the square of the diagonal, not rooted, 48
    { bugs: { 'face-for-space': 4 * Math.SQRT2, 'add-edges3': 12, 'no-root': 48 } },
  ],
  'space:2': [
    // the pencil case of diameter 5 and height 12: the radius 2.5 for the section's width gives 12.3; the sides added 17
    { bugs: { 'r-for-d': Math.sqrt(2.5 * 2.5 + 12 * 12), 'add-legs': 17 } },
    { model: 'transfer', p: { a: 5, b: 12, e: 13, c: 4 } }, // the box 5 by 12, 4 high: the base's diagonal as 5 + 12 gives 34; not halved 52
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
  'eq:6': [
    // two cyclists 54 km apart at 10 and 8 km/h: they meet after 54 : 18 = 3 hours; the speeds subtracted give 54 : 2 = 27
    { model: 'diag', p: { k: 'toward', bike: true, v1: 10, v2: 8, t: 3, D: 54, q: 0 } },
    // a car at 90 km/h an hour after a bus at 60: it catches up after 2 hours; the bus's 3 hours answered (wrong-unknown),
    // or the gap of 60 km closed at the sum of the speeds, 60 : 150 = 0.4 (rel-speed)
    { model: 'diag', p: { k: 'catch', v1: 60, h: 1, v2: 90, t: 2, q: 0 } },
  ],
  'eq:7': [
    // x/3 − x/5 = 4, the step chose 15: 5x − 3x = 60, x = 30. The 4 not multiplied by 15: 2x = 4, x = 2. The step
    // offered 2 as what to multiply by, another quantity than x, so the prediction is kept
    { bugs: { 'lcd-partial': 2 }, still: ['lcd-partial'] },
    // (x + 2)/4 = (x − 1)/3, the step wrote 3(x + 2) = 4(x − 1), so x = 10; only x multiplied (3x + 2 = 4x − 1, x = 3)
    // is what that step ruled out
    { bugs: {} },
    // x + x/3 = 8 (the ז׳ programme's form): 6; the 8 not multiplied by 3 gives 8 : 4 = 2, added across 8 · 4 : 2 = 16
    { model: 'diag', p: { k: 1, a: 3, x: 6, c: 8 } },
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
