// Proofs of congruence and similarity (ח׳, curriculum stage 4): the parts every proof shares. The topic object CONGR
// (GEOM-5) is content/congr.js, in the first screen's list; this module loads with the proofs (the congruence unit's
// generators, the proof object, the tests), so the bank and the seven templates never enter the first download.
// sim.js imports the templates from here.
//   REASONS        the bank of reasons a proof row may give, in the Ministry's and the Weizmann books' wording (GEOM-3.7)
//   PROOFS         the seven proof templates T1–T7 (GEOM-3.8), each { id, thm, uses, letters, given, goal, steps, free,
//                  fig }: steps in the challenge track's `order` shape (a reason asked as a choice, or `fixed`), `thm`
//                  the row that names the theorem and `uses` the rows that theorem stands on; the letters can be swapped
//                  for a fresh set (proofIn), so a template is not remembered by its letters
//   proofManip     a template as the proof object (content/proof.js): the whole template, or only the theorem asked
//   proofDiag      the two proof mistakes: a conclusion above the congruence it follows from ('circular'), another
//                  theorem on the congruence row ('wrong-theorem')
//   triFromAngles  a true triangle from its angles: every congruence and similarity drawing is computed with it
import './proof.js'; // the proof object registers itself with content/manip.js: a template is always checkable

// ---------------------------------------------------------------- the reason bank
/** The reasons by name, as the class writes them. */
export const R = {
  given: 'נתון',
  commonSide: 'צלע משותפת',
  commonAngle: 'זווית משותפת',
  vertical: 'זוויות קודקודיות',
  alternate: 'זוויות מתחלפות בין ישרים מקבילים',
  correspondingPar: 'זוויות מתאימות בין ישרים מקבילים',
  midpoint: 'הגדרת אמצע קטע',
  bisector: 'הגדרת חוצה זווית',
  perpendicular: 'ישרים מאונכים יוצרים זוויות ישרות',
  triangleSum: 'סכום הזוויות במשולש הוא $180°$',
  linearPair: 'סכום זוויות צמודות הוא $180°$',
  sas: 'לפי צ.ז.צ',
  asa: 'לפי ז.צ.ז',
  sss: 'לפי צ.צ.צ',
  aa: 'לפי ז.ז',
  sides: 'צלעות מתאימות במשולשים חופפים',
  angles: 'זוויות מתאימות במשולשים חופפים',
  isoBase: 'במשולש שווה־שוקיים זוויות הבסיס שוות',
  simSides: 'צלעות מתאימות במשולשים דומים',
};
/** The 19 reasons a proof row may give. */
export const REASONS = Object.values(R);
/** The theorems a congruence (or similarity) row names. */
export const THEOREMS = [R.sas, R.asa, R.sss, R.aa];
/** "Corresponding parts": a conclusion that follows from a congruence (or a similarity). */
export const PARTS_REASONS = [R.sides, R.angles, R.simSides];

// ---------------------------------------------------------------- a true triangle from its angles
/**
 * The apex of a triangle on the base from (0, 0) to (base, 0), with the angle `al` (degrees) at (0, 0) and `be` at
 * (base, 0): where the rays from the two ends of the base meet (as learn/challenges/angles.ts computes its track).
 * By the law of sines the side from (0, 0) is base · sin be / sin(al + be).
 */
export function triFromAngles(al, be, base) {
  const rad = (d) => (d * Math.PI) / 180;
  const side = (base * Math.sin(rad(be))) / Math.sin(rad(al + be));
  return [side * Math.cos(rad(al)), side * Math.sin(rad(al))];
}

// ---------------------------------------------------------------- the templates
/** A string's own number: where a row's right reason sits among its choices. */
const hash = (s) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);
/** A row whose reason is shown and not asked. */
const fixed = (text, reason) => ({ text, fixed: reason });
/**
 * A row whose reason is asked: the right one and the near misses, in a turn of that order fixed by the claim (so the
 * right reason is not always first, and the same row always shows the same order).
 */
function asked(text, right, ...wrong) {
  const all = [right, ...wrong];
  const k = hash(text) % all.length;
  return { text, reason: { choices: all.map((_, i) => all[(i - k + all.length) % all.length]), answer: k } };
}
const ang = (s) => `\\sphericalangle ${s}`;
const tri = (s) => `\\triangle ${s}`;

/** The letter sets a template is written in (A–D with M, K–N with P, E–H with O). */
export const LETTER_SETS = ['ABCDM', 'KLMNP', 'EFGHO'];

const T1_PTS = (() => {
  // AB and CD cross at M, each halved there: AM = MB = 3, CM = MD = 2.2, the angle AMC 110°
  const a = (150 * Math.PI) / 180; const c = (40 * Math.PI) / 180;
  const A = [3 * Math.cos(a), 3 * Math.sin(a)]; const C = [2.2 * Math.cos(c), 2.2 * Math.sin(c)];
  return { A, B: [-A[0], -A[1]], C, D: [-C[0], -C[1]], M: [0, 0] };
})();
// T5 and T6: an isosceles triangle with base angles 55° on a base of 5, C on the left and B on the right, D the
// middle of the base (where the bisector of the apex meets it)
const ISO_A = triFromAngles(55, 55, 5);
// T7: a triangle with 55° at C and 70° at B on a base of 6; D and E 0.45 of the way from A to B and to C, so DE ∥ BC
const T7_A = triFromAngles(55, 70, 6);
const along = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];

/** The seven templates, in their first letter set. */
export const PROOFS = [
  {
    id: 'T1', thm: 3, uses: [0, 1, 2], letters: 'ABCDM',
    given: 'הקטעים $AB$ ו־$CD$ נחתכים בנקודה $M$. $AM = MB$ ו־$CM = MD$.',
    goal: '$AC = BD$',
    steps: [
      fixed('$AM = MB$', R.given),
      fixed('$CM = MD$', R.given),
      asked(`$${ang('AMC')} = ${ang('BMD')}$`, R.vertical, R.alternate, R.given),
      asked(`$${tri('AMC')} \\cong ${tri('BMD')}$`, R.sas, R.sss, R.asa),
      asked('$AC = BD$', R.sides, R.given, R.vertical),
    ],
    free: [[0, 1, 2]],
    fig: {
      type: 'geo', label: 'הקטעים AB ו־CD נחתכים בנקודה M. AM ו־MB מסומנים שווים, וגם CM ו־MD. הקטעים AC ו־BD סוגרים שני משולשים',
      pts: T1_PTS,
      polys: [{ pts: ['A', 'M', 'C'] }, { pts: ['B', 'M', 'D'] }],
      segs: [{ a: 'A', b: 'M', ticks: 1 }, { a: 'M', b: 'B', ticks: 1 }, { a: 'C', b: 'M', ticks: 2 }, { a: 'M', b: 'D', ticks: 2 }, { a: 'A', b: 'C' }, { a: 'B', b: 'D' }],
      view: [300, 200],
    },
  },
  {
    id: 'T2', thm: 3, uses: [0, 1, 2], letters: 'ABCD',
    given: 'במרובע $ABCD$: $AB = AD$ ו־$CB = CD$.',
    goal: `$${ang('B')} = ${ang('D')}$`,
    steps: [
      fixed('$AB = AD$', R.given),
      fixed('$CB = CD$', R.given),
      asked('$AC = AC$', R.commonSide, R.given, R.midpoint),
      asked(`$${tri('ABC')} \\cong ${tri('ADC')}$`, R.sss, R.sas, R.asa),
      asked(`$${ang('B')} = ${ang('D')}$`, R.angles, R.given, R.isoBase),
    ],
    free: [[0, 1, 2]],
    fig: {
      type: 'geo', label: 'מרובע ABCD והאלכסון AC. AB ו־AD מסומנים שווים, וגם CB ו־CD',
      // a kite: B and D mirror each other in the line AC, so AB = AD and CB = CD
      pts: { A: [0, 2.6], B: [2.4, 0.6], C: [0, -3.4], D: [-2.4, 0.6] },
      polys: [{ pts: ['A', 'B', 'C', 'D'] }],
      segs: [{ a: 'A', b: 'B', ticks: 1 }, { a: 'A', b: 'D', ticks: 1 }, { a: 'C', b: 'B', ticks: 2 }, { a: 'C', b: 'D', ticks: 2 }, { a: 'A', b: 'C', thin: true }],
      view: [300, 220],
    },
  },
  {
    id: 'T3', thm: 3, uses: [0, 1, 2], letters: 'ABCD',
    given: '$CD \\perp AB$, ו־$D$ היא אמצע הקטע $AB$.',
    goal: '$AC = BC$',
    steps: [
      asked('$AD = DB$', R.midpoint, R.given, R.commonSide),
      asked(`$${ang('ADC')} = ${ang('BDC')} = 90°$`, R.perpendicular, R.vertical, R.given),
      fixed('$CD = CD$', R.commonSide),
      asked(`$${tri('ADC')} \\cong ${tri('BDC')}$`, R.sas, R.asa, R.sss),
      fixed('$AC = BC$', R.sides),
    ],
    free: [[0, 1, 2]],
    fig: {
      type: 'geo', label: 'משולש ABC והקטע CD המאונך ל־AB. D באמצע AB: AD ו־DB מסומנים שווים, ושתי הזוויות ב־D ישרות',
      pts: { A: [-3, 0], B: [3, 0], C: [0, 3.6], D: [0, 0] },
      polys: [{ pts: ['A', 'B', 'C'] }],
      segs: [{ a: 'A', b: 'D', ticks: 1 }, { a: 'D', b: 'B', ticks: 1 }, { a: 'C', b: 'D' }],
      angles: [{ at: 'D', from: 'B', to: 'C', right: true }, { at: 'D', from: 'C', to: 'A', right: true }],
      view: [300, 200],
    },
  },
  {
    id: 'T4', thm: 3, uses: [0, 1, 2], letters: 'ABCDM',
    given: 'הקטעים $AD$ ו־$BC$ נחתכים בנקודה $M$, $M$ היא אמצע $AD$, ו־$AB \\parallel CD$.',
    goal: '$AB = DC$',
    steps: [
      fixed('$AM = MD$', R.midpoint),
      asked(`$${ang('A')} = ${ang('D')}$`, R.alternate, R.correspondingPar, R.vertical),
      asked(`$${ang('AMB')} = ${ang('DMC')}$`, R.vertical, R.alternate, R.given),
      asked(`$${tri('AMB')} \\cong ${tri('DMC')}$`, R.asa, R.sas, R.sss),
      fixed('$AB = DC$', R.sides),
    ],
    free: [[0, 1, 2]],
    fig: {
      type: 'geo', label: 'הקטעים AD ו־BC נחתכים בנקודה M. AB מקביל ל־CD, ו־AM ו־MD מסומנים שווים',
      // C and D are A and B turned half a turn about M: M halves AD, and AB ∥ CD
      pts: { A: [-3, 2], B: [1, 2], C: [-1, -2], D: [3, -2], M: [0, 0] },
      polys: [{ pts: ['A', 'M', 'B'] }, { pts: ['D', 'M', 'C'] }],
      segs: [{ a: 'A', b: 'B', arrows: 1 }, { a: 'C', b: 'D', arrows: 1 }, { a: 'A', b: 'M', ticks: 1 }, { a: 'M', b: 'D', ticks: 1 }, { a: 'B', b: 'M' }, { a: 'M', b: 'C' }],
      view: [300, 200],
    },
  },
  {
    id: 'T5', thm: 3, uses: [0, 1, 2], letters: 'ABCD',
    given: '$AB = AC$, ו־$AD$ חוצה את $\\sphericalangle A$.',
    goal: '$BD = DC$ ו־$AD \\perp BC$',
    steps: [
      fixed('$AB = AC$', R.given),
      asked(`$${ang('BAD')} = ${ang('CAD')}$`, R.bisector, R.given, R.vertical),
      fixed('$AD = AD$', R.commonSide),
      asked(`$${tri('ABD')} \\cong ${tri('ACD')}$`, R.sas, R.sss, R.asa),
      asked('$BD = DC$', R.sides, R.midpoint, R.given),
      asked(`$${ang('ADB')} = ${ang('ADC')}$`, R.angles, R.vertical, R.given),
      // what is being proved is the circular choice: the right one is that the two equal angles make a straight one
      asked(`$${ang('ADB')} = ${ang('ADC')} = 90°$`, R.linearPair, R.perpendicular, R.given),
    ],
    free: [[0, 1, 2], [4, 5]],
    fig: {
      type: 'geo', label: 'משולש ABC ש־AB ו־AC בו מסומנים שווים, והקטע AD חוצה את הזווית A',
      pts: { A: ISO_A, B: [5, 0], C: [0, 0], D: [2.5, 0] },
      polys: [{ pts: ['A', 'B', 'C'] }],
      segs: [{ a: 'A', b: 'B', ticks: 1 }, { a: 'A', b: 'C', ticks: 1 }, { a: 'A', b: 'D' }],
      angles: [{ at: 'A', from: 'C', to: 'D', r: 30 }, { at: 'A', from: 'D', to: 'B', r: 30 }],
      view: [300, 210],
    },
  },
  {
    id: 'T6', thm: 4, uses: [1, 2, 3], letters: 'ABCD',
    given: '$\\sphericalangle B = \\sphericalangle C$, ו־$AD$ חוצה את $\\sphericalangle A$.',
    goal: '$AB = AC$',
    steps: [
      fixed(`$${ang('B')} = ${ang('C')}$`, R.given),
      fixed(`$${ang('BAD')} = ${ang('CAD')}$`, R.bisector),
      fixed('$AD = AD$', R.commonSide),
      asked(`$${ang('ADB')} = ${ang('ADC')}$`, R.triangleSum, R.vertical, R.given),
      asked(`$${tri('ABD')} \\cong ${tri('ACD')}$`, R.asa, R.sas, R.sss),
      fixed('$AB = AC$', R.sides),
    ],
    free: [[0, 1, 2]],
    fig: {
      type: 'geo', label: 'משולש ABC שבו הזוויות B ו־C מסומנות שוות, והקטע AD חוצה את הזווית A',
      pts: { A: ISO_A, B: [5, 0], C: [0, 0], D: [2.5, 0] },
      polys: [{ pts: ['A', 'B', 'C'] }],
      segs: [{ a: 'A', b: 'D' }],
      angles: [
        { at: 'B', from: 'A', to: 'C', r: 26 }, { at: 'C', from: 'B', to: 'A', r: 26 },
        { at: 'A', from: 'C', to: 'D', r: 32, n: 2 }, { at: 'A', from: 'D', to: 'B', r: 32, n: 2 },
      ],
      view: [300, 210],
    },
  },
  {
    id: 'T7', thm: 2, uses: [0, 1], letters: 'ABCDE',
    given: '$DE \\parallel BC$, הנקודה $D$ על $AB$ והנקודה $E$ על $AC$.',
    goal: `$${tri('ADE')} \\sim ${tri('ABC')}$`,
    steps: [
      asked(`$${ang('A')} = ${ang('A')}$`, R.commonAngle, R.vertical, R.given),
      asked(`$${ang('ADE')} = ${ang('ABC')}$`, R.correspondingPar, R.alternate, R.angles),
      asked(`$${tri('ADE')} \\sim ${tri('ABC')}$`, R.aa, R.asa, R.sss),
    ],
    free: [[0, 1]],
    fig: {
      type: 'geo', label: 'משולש ABC. הנקודה D על AB, הנקודה E על AC, והקטע DE מקביל ל־BC',
      pts: { A: T7_A, B: [6, 0], C: [0, 0], D: along(T7_A, [6, 0], 0.45), E: along(T7_A, [0, 0], 0.45) },
      polys: [{ pts: ['A', 'B', 'C'] }],
      segs: [{ a: 'D', b: 'E', arrows: 1 }, { a: 'C', b: 'B', arrows: 1 }],
      view: [300, 210],
    },
  },
];
export const PROOF = Object.fromEntries(PROOFS.map((T) => [T.id, T]));

/** Every string and key of a value with its capital letters swapped by `f` (one letter at a time: A→K and K→… at once). */
const swapDeep = (v, f) => (typeof v === 'string' ? f(v)
  : Array.isArray(v) ? v.map((x) => swapDeep(x, f))
    : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [f(k), swapDeep(x, f)])) : v);
/** A template written in letter set `set` (0, 1 or 2 of LETTER_SETS): its claims, givens and drawing, all at once. */
export function proofIn(T, set = 0) {
  const to = LETTER_SETS[set];
  if (!set) return T;
  const map = Object.fromEntries([...T.letters].map((c, i) => [c, to[i]]));
  const f = (s) => s.replace(/[A-Z]/g, (c) => map[c] ?? c);
  return { ...swapDeep(T, f), id: T.id, letters: to.slice(0, T.letters.length) };
}

/**
 * A template as the proof object (GEOM-3.2): the whole template as written (`ask` 'all'), or only the theorem asked
 * ('theorem', every other row showing its reason); in order with lockOrder, else shuffled by `seed`.
 */
export function proofManip(T0, { set = 0, seed = T0.id, lockOrder = false, ask = 'all' } = {}) {
  const T = proofIn(T0, set);
  const steps = ask === 'theorem' ? T.steps.map((s, i) => (i === T.thm ? s : s.reason ? { text: s.text, fixed: s.reason.choices[s.reason.answer] } : s)) : T.steps;
  const part = { prompt: lockOrder ? 'השלימו את הנימוקים החסרים.' : 'סדרו את שורות ההוכחה, ובחרו נימוק לכל שורה.', steps, free: T.free };
  return { kind: 'proof', given: T.given, goal: T.goal, part, ...(lockOrder ? { lockOrder: true } : {}), seed: `${T.id}:${set}:${seed}`, fig: T.fig, tpl: T.id, set };
}

// ---------------------------------------------------------------- the proof mistakes
/** A step's right reason (fixed, or the right choice). */
const reasonOf = (s) => (s.fixed != null ? s.fixed : s.reason ? s.reason.choices[s.reason.answer] : '');
/** The row that names the theorem, and the rows that follow from the congruence (or the similarity). */
export function proofRows(part) {
  const thm = part.steps.findIndex((s) => THEOREMS.includes(reasonOf(s)));
  const parts = part.steps.map((s, i) => (PARTS_REASONS.includes(reasonOf(s)) ? i : -1)).filter((i) => i >= 0);
  return { thm, parts };
}
/**
 * The mistake a proof shows (GEOM-3.6): 'circular' when a row that follows from the congruence ("corresponding sides
 * or angles in congruent triangles", or in similar ones) is placed above the congruence row; else 'wrong-theorem' when
 * the congruence row's chosen reason is another theorem; else null.
 */
export function proofDiag(part, v) {
  if (!v || !Array.isArray(v.order)) return null;
  const { thm, parts } = proofRows(part);
  if (thm < 0) return null;
  const at = (i) => v.order.indexOf(i);
  if (parts.some((i) => at(i) < at(thm))) return 'circular';
  const t = part.steps[thm];
  const chosen = t.reason && v.reasons?.[thm] != null ? t.reason.choices[v.reasons[thm]] : null;
  if (chosen && THEOREMS.includes(chosen) && chosen !== reasonOf(t)) return 'wrong-theorem';
  return null;
}