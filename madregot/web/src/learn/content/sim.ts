// Isosceles triangles and similarity (שווה־שוקיים ודמיון): the ח׳ unit 8.13 of March and April (curriculum stage 4,
// GEOM-6). Four stairs: the isosceles triangle proved by congruence and its converse theorems, similar shapes (one
// multiplier for every side, never an addition), similar triangles by two angles (ז.ז, the parallel cut and the "פרפר"),
// and the ratio of sides and of areas (k and k²).
//
// Every drawing is computed from its numbers: lengths drawn to scale, angles drawn their size (content/proofs.js
// triFromAngles through content/sim.gen.js). The diagnostic models are the stage's (content/sim.gen.js SIM1 to SIM4T);
// every misconception's source is listed there. That module is the topic's arithmetic, off the first screen like this
// file (the stairs' generators load with the topic, content/topics.js importGens). Every number written here is checked
// by the lane's spec/facts-sim.mjs, and the maths of every step by learn/content.test.ts.
import type { DiagModel, FigSpec, ManipSpec, StairContent } from '../types';
// @ts-ignore: plain JS, the practice generators' draws, texts, worked solutions and drawings
import * as GEN from '@/content/sim.gen.js';
// @ts-ignore: plain JS, the proof templates
import { PROOF, proofManip, triFromAngles } from '@/content/proofs.js';
// @ts-ignore: plain JS, the proof object's answer
import { proofSolution } from '@/content/proof.js';

/** The plain-JS modules, untyped here: their drawings are checked by learn/figures.test.ts, not by the compiler. */
const G: any = GEN;
const P: any = PROOF;

// ---------------------------------------------------------------- drawings
type Pt = [number, number];
/** A drawing with no letters (a step whose text names no point). */
const unnamed = (f: any): FigSpec => ({ ...f, hide: Object.keys(f.pts).filter((k: string) => !k.startsWith('_')) });
/** A triangle from its three sides, base c from (x0, 0), l from its left end and r from its right end. */
function triPts(c: number, l: number, r: number, x0 = 0): [Pt, Pt, Pt] {
  const x = (l * l - r * r + c * c) / (2 * c); const y = Math.sqrt(l * l - x * x);
  return [[x0, 0], [x0 + c, 0], [x0 + x, y]];
}
/** Two similar triangles from three sides and a ratio, side by side, unnamed; `labels` writes each side (or nothing). */
function similarPair(sides: [number, number, number], k: number, labels: [string[], string[]], label: string): FigSpec {
  const [c, l, r] = sides;
  const a = triPts(c, l, r, 0); const b = triPts(c * k, l * k, r * k, c + 1.2);
  const pts: Record<string, Pt> = { _a: a[0], _b: a[1], _c: a[2], _d: b[0], _e: b[1], _f: b[2] };
  // a label goes away from the middle of the whole drawing: the two sides that face each other (the first triangle's
  // right side, the second's left) would take theirs inside, so they are turned out ('in' flips the side)
  const seg = (s: string, e: string, t: string, facing = false) => (t ? { a: s, b: e, label: t, ...(facing ? { side: 'in' } : {}) } : { a: s, b: e });
  return {
    type: 'geo', label, pts, polys: [{ pts: ['_a', '_b', '_c'] }, { pts: ['_d', '_e', '_f'] }],
    segs: [seg('_a', '_b', labels[0][0]), seg('_a', '_c', labels[0][1]), seg('_b', '_c', labels[0][2], true),
      seg('_d', '_e', labels[1][0]), seg('_d', '_f', labels[1][1], true), seg('_e', '_f', labels[1][2])],
    view: [320, 190], pad: [28, 26],
  } as FigSpec;
}
/** Two similar triangles by base and height (so the area written inside is the drawn area), each base written. */
function areaPair(b1: number, h1: number, k: number, [w1, w2]: [string, string], [s1, s2]: [string, string], names: string[] | null, label: string): FigSpec {
  const n = names || ['_a', '_b', '_c', '_d', '_e', '_f'];
  const o = b1 + 1.4; const off = 0.3;
  const pts: Record<string, Pt> = { [n[0]]: [0, 0], [n[1]]: [b1, 0], [n[2]]: [b1 * off, h1], [n[3]]: [o, 0], [n[4]]: [o + b1 * k, 0], [n[5]]: [o + b1 * k * off, h1 * k] };
  const mid = (i: number, j: number, m: number): Pt => [(pts[n[i]][0] + pts[n[j]][0] + pts[n[m]][0]) / 3, (pts[n[i]][1] + pts[n[j]][1] + pts[n[m]][1]) / 3];
  return {
    type: 'geo', label, pts, polys: [{ pts: n.slice(0, 3) }, { pts: n.slice(3) }],
    segs: [{ a: n[0], b: n[1], label: w1 }, { a: n[3], b: n[4], label: w2 }],
    words: [{ at: mid(0, 1, 2), text: s1 }, { at: mid(3, 4, 5), text: s2 }],
    view: [320, 200], pad: [28, 26],
  } as FigSpec;
}
/** A circle as a polygon of 48 points (unnamed), with its diameter drawn and written. */
function circlePts(cx: number, r: number, tag: string) {
  const pts: Record<string, Pt> = {};
  const ring = Array.from({ length: 48 }, (_, i) => { const k = `_${tag}${i}`; pts[k] = [cx + r * Math.cos((2 * Math.PI * i) / 48), r * Math.sin((2 * Math.PI * i) / 48)]; return k; });
  pts[`_${tag}l`] = [cx - r, 0]; pts[`_${tag}r`] = [cx + r, 0];
  return { pts, ring };
}

// ================================================================ stair 1: isosceles triangles and the converse theorems

/** An isosceles triangle ABC (AB = AC = 4.5 over BC = 5) with the bisector AD, drawn true. */
const ISO = G.isoPts(5, 4.5);
const isoParts: FigSpec = (() => {
  const { A, B, C } = ISO;
  return {
    type: 'geo', label: 'משולש שווה־שוקיים: שתי השוקיים מסומנות שוות, הבסיס למטה וזווית הראש למעלה',
    pts: { _a: A, _b: B, _c: C }, polys: [{ pts: ['_a', '_b', '_c'] }],
    segs: [{ a: '_a', b: '_b', ticks: 1 }, { a: '_a', b: '_c', ticks: 1 }],
    angles: [G.innerAngle({ _a: A, _b: B, _c: C }, '_a', '_b', '_c', { n: 1, r: 26 })],
    words: [{ at: [A[0] + 1.7, A[1] / 2 + 0.3] as Pt, text: 'שוק' }, { at: [A[0] - 1.7, A[1] / 2 + 0.3] as Pt, text: 'שוק' }, { at: [2.5, -0.55] as Pt, text: 'בסיס' }, { at: [A[0], A[1] + 0.55] as Pt, text: 'זווית הראש' }],
    view: [300, 220], pad: [34, 30],
  } as FigSpec;
})();
/** ABC with AB = AC and the bisector AD; `right` marks the right angles at D and the equal halves of BC. */
const bisectFig = (right: boolean, named = true): FigSpec => {
  const f = {
    type: 'geo', label: right ? 'משולש ABC עם AB שווה ל־AC והקטע AD: הזוויות ב־A שוות, BD שווה ל־DC, והזווית ב־D ישרה' : 'משולש ABC עם AB שווה ל־AC, והקטע AD חוצה את הזווית A',
    pts: ISO, polys: [{ pts: ['A', 'B', 'C'] }],
    segs: [{ a: 'A', b: 'B', ticks: 1 }, { a: 'A', b: 'C', ticks: 1 }, { a: 'A', b: 'D' }, ...(right ? [{ a: 'C', b: 'D', ticks: 2 }, { a: 'D', b: 'B', ticks: 2 }] : [])],
    angles: [G.innerAngle(ISO, 'A', 'C', 'D', { n: 1, r: 30 }), G.innerAngle(ISO, 'A', 'D', 'B', { n: 1, r: 30 }), ...(right ? [{ at: 'D', from: 'B', to: 'A', right: true }] : [])],
    view: [300, 210], pad: [30, 28],
  };
  return named ? (f as FigSpec) : unnamed(f);
};
/** ABC with ∢B = ∢C marked (and, for the converse theorems, the bisector AD). */
const baseAnglesFig = (bisector: boolean, named = true): FigSpec => {
  const pts = bisector ? ISO : { A: ISO.A, B: ISO.B, C: ISO.C };
  const f = {
    type: 'geo', label: bisector ? 'משולש ABC שבו הזוויות B ו־C מסומנות שוות, והקטע AD חוצה את הזווית A' : 'משולש ABC שבו הזוויות B ו־C מסומנות שוות',
    pts, polys: [{ pts: ['A', 'B', 'C'] }],
    segs: bisector ? [{ a: 'A', b: 'D' }] : [],
    angles: [G.innerAngle(pts, 'B', 'A', 'C', { n: 1 }), G.innerAngle(pts, 'C', 'A', 'B', { n: 1 }),
      ...(bisector ? [G.innerAngle(pts, 'A', 'C', 'D', { n: 2, r: 30 }), G.innerAngle(pts, 'A', 'D', 'B', { n: 2, r: 30 })] : [])],
    view: [300, 210], pad: [30, 28],
  };
  return named ? (f as FigSpec) : unnamed(f);
};
// step 7: two triangles of area 6 that are not congruent (base 6 and height 2, base 4 and height 3)
const area6: FigSpec = {
  type: 'geo', label: 'שני משולשים: בסיס 6 וגובה 2, ובסיס 4 וגובה 3. לשניהם שטח 6',
  pts: { _a: [0, 0], _b: [6, 0], _c: [2, 2], _h: [2, 0], _d: [7.5, 0], _e: [11.5, 0], _f: [9, 3], _g: [9, 0] },
  polys: [{ pts: ['_a', '_b', '_c'] }, { pts: ['_d', '_e', '_f'] }],
  segs: [{ a: '_a', b: '_b', label: '6' }, { a: '_c', b: '_h', label: '2', dash: true, thin: true }, { a: '_d', b: '_e', label: '4' }, { a: '_f', b: '_g', label: '3', dash: true, thin: true }],
  words: [{ at: [3, -1.75] as Pt, text: 'שטח 6' }, { at: [9.5, -1.75] as Pt, text: 'שטח 6' }],
  view: [320, 180], pad: [26, 26],
} as FigSpec;
/** T5 completed (the order locked): the bisector's definition, the theorem and the right angle asked. */
const t5Fill = (() => {
  const m: any = proofManip(P.T5, { lockOrder: true });
  const ask = new Set([1, 3, 6]);
  const steps = m.part.steps.map((s: any, i: number) => (ask.has(i) || !s.reason ? s : { text: s.text, fixed: s.reason.choices[s.reason.answer] }));
  return { ...m, part: { ...m.part, steps }, seed: 'T5:0:fill' } as ManipSpec;
})();

type PX = Record<string, number>;
const sim1: DiagModel<PX> = {
  params: (rnd) => G.SIM1.params(rnd),
  text: (p) => G.sim1Text(p),
  fig: (p) => G.sim1Fig(p),
  answer: (p) => G.SIM1.answer(p),
  bugs: G.SIM1.bugs,
  solution: (p) => G.sim1Solution(p),
  hint: () => G.sim1Hint(),
};
const sim1T: DiagModel<PX> = {
  params: (rnd) => G.SIM1T.params(rnd),
  text: (p) => G.sim1TText(p),
  fig: (p) => G.sim1Fig(p, 'אוהל בצורת משולש ABC: הזוויות ליד הקרקע מסומנות שוות, ועל כל דופן ביטוי'),
  answer: (p) => G.SIM1T.answer(p),
  bugs: G.SIM1T.bugs,
  solution: (p) => G.sim1Solution(p),
  hint: () => 'הזוויות ליד הקרקע שוות, ולכן הדפנות שמולן שוות.',
};
const ex1Fig = G.sim1Fig({ x: 4, p: 3, q: 2, r: 5, s: -6, t: 2, u: 7 });
const tg1Fig = G.sim1Fig({ x: 4, p: 2, q: 5, r: 4, s: -3, t: 3, u: -1 });
/** The height to the base: AB = AC = leg, BC = 2·bd, the median AD with its right angle (examples and together). */
const isoHeightFig = (bd: number, leg: number, label: string): FigSpec => {
  const pts = G.isoPts(2 * bd, leg);
  return {
    type: 'geo', label, pts, polys: [{ pts: ['A', 'B', 'C'] }],
    segs: [{ a: 'A', b: 'B', label: String(leg), ticks: 1 }, { a: 'A', b: 'C', ticks: 1 }, { a: 'C', b: 'D', ticks: 2 }, { a: 'D', b: 'B', ticks: 2 }, { a: 'A', b: 'D', label: '?' }],
    view: [300, 210], pad: [30, 28],
  } as FigSpec;
};

const stair1: StairContent = {
  skill: 'sim:1', topic: 'sim', level: 1, title: 'שווה־שוקיים ומשפטים הפוכים',
  objectives: [
    'להוכיח בחפיפה שבמשולש שווה־שוקיים זוויות הבסיס שוות, וחוצה זווית הראש הוא גם התיכון וגם הגובה לבסיס.',
    'להשתמש במשפטים ההפוכים: משולש עם שתי זוויות שוות הוא שווה־שוקיים; משולש שבו התיכון הוא גם גובה הוא שווה־שוקיים.',
    'להבחין בין משפט לבין המשפט ההפוך לו, ולבדוק כל אחד בנפרד.',
  ],
  idea: 'במשולש שווה־שוקיים חוצה זווית הראש יוצר שני משולשים חופפים, ומהחפיפה יוצא כל השאר; וההפך: משולש עם שתי זוויות שוות הוא שווה־שוקיים.',
  why: [
    '$AB = AC$, $\\sphericalangle BAD = \\sphericalangle CAD$ ו־$AD$ משותפת: צ.ז.צ. ולכן $BD = DC$, $\\sphericalangle B = \\sphericalangle C$, ושתי הזוויות ליד $D$ שוות וצמודות, $90°$ כל אחת.',
    'במשפט ההפוך מתחילים מ־$\\sphericalangle B = \\sphericalangle C$; עם חוצה הזווית גם הזווית השלישית שווה, וז.צ.ז נותן $AB = AC$.',
  ],
  alt: ['קפלו משולש שווה־שוקיים לאורך חוצה זווית הראש: חצי אחד נופל בדיוק על השני. הקיפול הוא ציר סימטריה.'],
  discover: [
    { kind: 'say', text: 'במשולש שווה־שוקיים שתי צלעות שוות: השוקיים. הזווית ביניהן היא זווית הראש, והצלע השלישית היא הבסיס.', fig: isoParts },
    { kind: 'predict', text: '$AB = AC$, ו־$AD$ חוצה את $\\sphericalangle A$. לפי איזה משפט $\\triangle ABD \\cong \\triangle ACD$?', fig: bisectFig(false),
      choices: ['צ.ז.צ', 'צ.צ.צ', 'ז.צ.ז'], answer: 0,
      why: '$AB = AC$, $\\sphericalangle BAD = \\sphericalangle CAD$, ו־$AD$ משותפת: שתי צלעות והזווית שביניהן.',
      wrongWhy: { 1: 'לא ידוע ש־$BD = DC$; את זה מקבלים מהחפיפה.', 2: 'ידועה רק זווית אחת שווה, $\\sphericalangle BAD = \\sphericalangle CAD$. ידועות שתי צלעות, והזווית שביניהן.' } },
    { kind: 'rule', text: 'במשולש שווה־שוקיים זוויות הבסיס שוות, וחוצה זווית הראש הוא גם התיכון לבסיס וגם הגובה לבסיס. כאן: $\\sphericalangle B = \\sphericalangle C$, $BD = DC$ ו־$AD \\perp BC$.',
      why: 'מהחפיפה: $\\sphericalangle B = \\sphericalangle C$, $BD = DC$, ו־$\\sphericalangle ADB = \\sphericalangle ADC$, שתי זוויות צמודות שוות, כלומר $90°$.', fig: bisectFig(true) },
    { kind: 'explore', text: 'השלימו את הנימוקים החסרים בהוכחה ש־$BD = DC$ ו־$AD \\perp BC$.', manip: t5Fill, answer: proofSolution(t5Fill),
      hint: 'חוצה זווית מחלק אותה לשתי זוויות שוות. שתי צלעות והזווית שביניהן: איזה משפט? ושתי זוויות צמודות שוות: כמה כל אחת?',
      success: 'צ.ז.צ, ואז המסקנות: $BD = DC$, ושתי הזוויות ליד $D$ שוות וצמודות, ולכן ישרות.' },
    { kind: 'predict', text: 'ב־$\\triangle ABC$: $\\sphericalangle B = \\sphericalangle C$. מה נכון?', fig: baseAnglesFig(false),
      choices: ['$AB = AC$', '$AB = BC$', 'אי אפשר לדעת'], answer: 0,
      why: 'מול זוויות שוות מונחות צלעות שוות: מול $\\sphericalangle C$ נמצאת $AB$, ומול $\\sphericalangle B$ נמצאת $AC$.',
      wrongWhy: { 1: '$AB$ ו־$BC$ יוצאות מ־$B$; משווים את הצלעות שמול הזוויות.', 2: 'אפשר: משולש עם שתי זוויות שוות הוא שווה־שוקיים, והצלעות שמול הזוויות שוות.' } },
    { kind: 'rule', text: 'המשפטים ההפוכים: משולש עם שתי זוויות שוות הוא שווה־שוקיים. משולש שבו התיכון לצלע הוא גם הגובה לה, או שחוצה הזווית הוא גם הגובה, הוא שווה־שוקיים.',
      why: 'בכל אחד מהם מוכיחים בחפיפה ש־$AB = AC$ (ז.צ.ז או צ.ז.צ).', fig: baseAnglesFig(true, false) },
    { kind: 'predict', text: '"אם שני משולשים חופפים, השטחים שלהם שווים." נכון. האם גם ההפוך נכון: "אם השטחים שווים, המשולשים חופפים"?', fig: area6,
      choices: ['לא בהכרח', 'כן, משפט הפוך תמיד נכון'], answer: 0,
      why: 'שני המשולשים בשרטוט שווים בשטח, $6$, ולא חופפים. משפט הפוך בודקים בנפרד.',
      wrongWhy: { 1: 'בשרטוט שני משולשים שווי שטח, $6$, עם בסיסים שונים: הם לא חופפים. משפט הפוך צריך הוכחה משלו.' } },
    { kind: 'predict', text: '$AB = AC$, $\\sphericalangle B = \\sphericalangle C = 72°$, ו־$BD$ חוצה את $\\sphericalangle B$. כמה משולשים שווי־שוקיים יש בשרטוט?', fig: G.goldenFig('bisector'),
      choices: ['$3$', '$1$', '$2$'], answer: 0,
      why: '$\\triangle ABC$; $\\triangle ABD$, כי $\\sphericalangle A = \\sphericalangle ABD = 36°$; ו־$\\triangle BDC$, כי $\\sphericalangle C = \\sphericalangle BDC = 72°$. בכל אחד, שתי זוויות שוות.',
      wrongWhy: { 1: 'גם המשולשים הקטנים: $\\sphericalangle A = 36°$ ו־$\\sphericalangle ABD = 36°$, ו־$\\sphericalangle BDC = 72°$ כמו $\\sphericalangle C$.', 2: 'חשבו את כל הזוויות: $\\sphericalangle A = 36°$, $\\sphericalangle ABD = \\sphericalangle DBC = 36°$, $\\sphericalangle BDC = 72°$. שלושה משולשים עם שתי זוויות שוות.' } },
  ],
  examples: [
    { problem: 'ב־$\\triangle ABC$: $\\sphericalangle B = \\sphericalangle C$, $AB = 3x + 2$, $AC = 5x - 6$, $BC = 2x + 7$. מה אורך $AB$?', fig: ex1Fig,
      answer: 14, check: '3*4+2', vars: { x: 4 },
      steps: [
        { action: 'מול זוויות שוות צלעות שוות: $AB = AC$', why: '$AB$ מול $\\sphericalangle C$, ו־$AC$ מול $\\sphericalangle B$.', result: '3x + 2 = 5x - 6', eq: '3*x + 2 = 5*x - 6' },
        { action: 'מעבירים את $x$ לאגף אחד.', why: 'מחסרים $3x$ ומוסיפים $6$ לשני האגפים.', result: '8 = 2x', eq: '8 = 2*x' },
        { action: '$x = 4$', why: 'מחלקים ב־$2$.', result: 'x = 4', calc: { expr: '8/2', value: 4 } },
        { action: 'מציבים ב־$AB$.', why: 'שאלו על אורך $AB$, לא על $x$.', result: 'AB = 3 \\cdot 4 + 2 = 14', value: '3*4+2' },
      ] },
    { problem: '$AB = AC = 17$, $BC = 16$, $AD$ תיכון לבסיס. מה $AD$?', fig: isoHeightFig(8, 17, 'משולש שווה־שוקיים ABC, השוק 17, והתיכון AD לבסיס'),
      answer: 15, check: 'sqrt(17^2-8^2)',
      steps: [
        { action: 'התיכון לבסיס הוא גם גובה', why: 'במשולש שווה־שוקיים התיכון לבסיס, חוצה זווית הראש והגובה לבסיס הם אותו קטע.', result: 'AD \\perp BC' },
        { action: '$BD = 8$', why: '$D$ אמצע $BC$.', result: 'BD = 16 : 2 = 8', calc: { expr: '16/2', value: 8 } },
        { action: 'פיתגורס ב־$\\triangle ABD$.', why: 'היתר $AB = 17$, והניצב $BD = 8$.', result: 'AD = \\sqrt{17^2 - 8^2} = 15', value: 'sqrt(289-64)' },
      ] },
  ],
  together: [
    { problem: '$\\sphericalangle B = \\sphericalangle C$, $AB = 2x + 5$, $AC = 4x - 3$, $BC = 3x - 1$. מה $AB$?', fig: tg1Fig,
      steps: [
        { prompt: 'אילו צלעות שוות?', choices: [
          { text: '$AB = AC$', ok: true, feedback: 'הן מול הזוויות השוות.' },
          { text: '$AB = BC$', ok: false, feedback: 'הן יוצאות מ־$B$; הצלעות השוות מול הזוויות השוות.' },
          { text: '$AC = BC$', ok: false, feedback: 'הן יוצאות מ־$C$; הצלעות השוות מול הזוויות השוות.' },
        ], hints: ['מה מול $\\sphericalangle B$, ומה מול $\\sphericalangle C$?', '$2x + 5 = 4x - 3$, ולכן $x = 4$.'], done: '$AB = AC$: $2x + 5 = 4x - 3$, ו־$x = 4$.' },
      ],
      final: { prompt: 'מה אורך $AB$?', answer: 13, check: '2*4+5', hints: ['מה מול $\\sphericalangle B$, ומה מול $\\sphericalangle C$?', '$2x + 5 = 4x - 3$, ולכן $x = 4$.'] } },
    { problem: '$AB = AC = 10$, $BC = 12$, $AD$ תיכון לבסיס. מה $AD$?', fig: isoHeightFig(6, 10, 'משולש שווה־שוקיים ABC, השוק 10, והתיכון AD לבסיס'),
      steps: [
        { prompt: 'מה $BD$?', choices: [
          { text: '$6$', ok: true, feedback: '$D$ אמצע $BC = 12$.' },
          { text: '$12$', ok: false, feedback: '$D$ אמצע הבסיס: $BD$ הוא חצי מ־$BC$.' },
        ], hints: ['התיכון לבסיס הוא גם הגובה.', '$\\sqrt{10^2 - 6^2}$.'], done: '$BD = 6$, והזווית ב־$D$ ישרה.' },
      ],
      final: { prompt: 'מה אורך $AD$?', answer: 8, check: 'sqrt(10^2-6^2)', hints: ['התיכון לבסיס הוא גם הגובה.', '$\\sqrt{10^2 - 6^2}$.'] } },
  ],
  diag: sim1,
  transfer: sim1T,
  words: ['שוקיים', 'בסיס', 'זווית ראש', 'זוויות בסיס', 'משפט', 'משפט הפוך', 'מתלכדים'],
  misconceptions: [
    { id: 'side-at-angle', title: 'השוו צלעות שיוצאות מהזוויות השוות, ולא את הצלעות שמולן',
      cause: '"$\\sphericalangle B$ שווה" נשמע כמו "הצלעות של $B$ שוות".',
      explain: ['צלע מול זווית: הצלע שלא נוגעת בה. מול $\\sphericalangle B$ נמצאת $AC$, ומול $\\sphericalangle C$ נמצאת $AB$.'],
      remedy: [
        { kind: 'predict', text: 'ב־$\\triangle ABC$: $\\sphericalangle B = \\sphericalangle C$. מה נכון?', fig: baseAnglesFig(false),
          choices: ['$AB = AC$', '$AB = BC$'], answer: 0, why: 'מול $\\sphericalangle C$ נמצאת $AB$, ומול $\\sphericalangle B$ נמצאת $AC$.', wrongWhy: { 1: '$AB$ ו־$BC$ יוצאות מ־$B$. משווים את הצלעות שמול הזוויות.' } },
        { kind: 'rule', text: 'משולש שווה־שוקיים מתקפל לאורך ציר הסימטריה שלו: $B$ נופל על $C$, ו־$AB$ נופלת על $AC$.', why: 'הצלעות שמתלכדות בקיפול הן השוקיים, והן מול הזוויות השוות.', fig: bisectFig(false) },
      ] },
    { id: 'stopped-at-x', title: 'מצאו את $x$ ועצרו, בלי לחשב את אורך הצלע',
      cause: 'פתרון המשוואה מרגיש כמו הסוף.',
      explain: ['$x$ הוא רק כלי. שאלו על אורך הצלע: מציבים את $x$ בביטוי של הצלע.'],
      remedy: [
        { kind: 'predict', text: '$AB = 2x + 5$, ומצאנו ש־$x = 4$. מה שאלו?', fig: tg1Fig,
          choices: ['את אורך $AB$', 'את $x$'], answer: 0, why: 'שאלו על $AB$: $2 \\cdot 4 + 5 = 13$.', wrongWhy: { 1: '$x$ הוא רק הדרך. האורך הוא $2 \\cdot 4 + 5 = 13$.' } },
      ] },
    { id: 'whole-base', title: 'השתמשו בכל הבסיס במקום בחצי שלו',
      cause: '$BC$ כתובה בשאלה, ו־$BD$ לא.',
      explain: ['במשולש $ABD$ הניצב שעל הבסיס הוא $BD$, חצי מ־$BC$, כי התיכון מגיע לאמצע הבסיס.'],
      remedy: [
        { kind: 'predict', text: '$AB = AC = 10$, $BC = 12$, $AD$ תיכון לבסיס. מה $BD$?', fig: isoHeightFig(6, 10, 'משולש שווה־שוקיים ABC, השוק 10, והתיכון AD לבסיס'),
          choices: ['$6$', '$12$'], answer: 0, why: '$D$ אמצע $BC$: $BD = 6$, ואז $AD = \\sqrt{10^2 - 6^2} = 8$.', wrongWhy: { 1: '$12$ הוא כל הבסיס. ל־$\\triangle ABD$ רק החצי.' } },
      ] },
    { id: 'converse-equal', title: 'חשבו שמשפט והמשפט ההפוך לו נכונים או לא נכונים יחד',
      cause: 'משפט ומשפט הפוך נשמעים כמו אותו משפט בסדר אחר.',
      explain: ['משפט הפוך הוא טענה חדשה. לפעמים הוא נכון ולפעמים לא, ובודקים אותו בנפרד: בהוכחה, או בדוגמה שבה הוא לא מתקיים.'],
      remedy: [
        { kind: 'predict', text: '"אם שני משולשים חופפים, השטחים שלהם שווים." נכון. האם גם ההפוך נכון: "אם השטחים שווים, המשולשים חופפים"?', fig: area6,
          choices: ['לא בהכרח', 'כן'], answer: 0, why: 'בשרטוט שני משולשים בשטח $6$ שאינם חופפים.' },
      ] },
  ],
};

// ================================================================ stair 2: similar shapes

const tri345x2 = similarPair([5, 3, 4], 2, [['5', '3', '4'], ['10', '6', '8']], 'משולש עם הצלעות 3, 4 ו־5, והגדלה שלו פי 2: 6, 8 ו־10');
const rect46 = G.twoRects([6, 4], [9, 6], ['6', '4', '?', '6'], 'מלבן 4 על 6, ומלבן דומה לו שהצלע 4 הפכה בו ל־6');
const rect34v65 = G.twoRects([4, 3], [5, 6], ['4', '3', '5', '6'], 'מלבן 3 על 4 ומלבן 6 על 5');
const rectsAndSquares: FigSpec = (() => {
  const r = G.twoRects([4, 3], [5, 6], ['4', '3', '5', '6'], '');
  const pts = { ...r.pts, _s1: [0, -4.4], _s2: [2, -4.4], _s3: [2, -2.4], _s4: [0, -2.4], _t1: [5.2, -4.4], _t2: [8.2, -4.4], _t3: [8.2, -1.4], _t4: [5.2, -1.4] };
  return { ...r, label: 'מלבן 3 על 4 ומלבן 6 על 5, ומתחתם שני ריבועים בגדלים שונים', pts, polys: [...r.polys, { pts: ['_s1', '_s2', '_s3', '_s4'] }, { pts: ['_t1', '_t2', '_t3', '_t4'] }], view: [320, 240] } as FigSpec;
})();
const tri8to6 = similarPair([14, 8, 12], 0.75, [['14', '8', '12'], ['', '6', '?']], 'משולש עם הצלעות 8, 12 ו־14, ומשולש קטן ממנו שבו 8 הפכה ל־6');
const seg5to12: FigSpec = {
  type: 'geo', label: 'קטע באורך 5 והקטע שהוא הפך אליו, באורך 12.5',
  pts: { _a: [0, 1.6], _b: [5, 1.6], _c: [0, 0], _d: [12.5, 0] }, segs: [{ a: '_a', b: '_b', label: '5' }, { a: '_c', b: '_d', label: '12.5' }],
  dots: ['_a', '_b', '_c', '_d'], view: [320, 120], pad: [28, 26],
} as FigSpec;
const sim2: DiagModel<PX> = {
  params: (rnd) => G.SIM2.params(rnd),
  text: (p) => G.sim2Text(p),
  fig: (p) => G.sim2Fig(p),
  answer: (p) => G.SIM2.answer(p),
  bugs: G.SIM2.bugs,
  solution: (p) => G.sim2Solution(p),
  hint: () => G.sim2Hint(),
  fmt: 'dec',
};
const sim2T: DiagModel<PX> = {
  params: (rnd) => G.SIM2T.params(rnd),
  text: (p) => G.sim2TText(p),
  fig: (p) => G.sim2Fig(p, 'תמונה והעותק שלה מהמדפסת: לתמונה רוחב וגובה, לעותק רק הרוחב'),
  answer: (p) => G.SIM2T.answer(p),
  bugs: G.SIM2T.bugs,
  solution: (p) => G.sim2Solution(p),
  hint: () => 'פי כמה השתנה הרוחב? הגובה משתנה פי אותו מספר.',
  fmt: 'dec',
};
const dlineMove = (): ManipSpec => ({ kind: 'dline', top: { max: 16, step: 2, label: 'במשולש המקורי' }, bottom: { max: 12, step: 1.5, label: 'במשולש הקטן' }, move: 't', start: { t: 0 } } as ManipSpec);

const stair2: StairContent = {
  skill: 'sim:2', topic: 'sim', level: 2, title: 'צורות דומות',
  objectives: [
    'לזהות צורות דומות: כל הזוויות המתאימות שוות, והיחס בין כל זוג צלעות מתאימות זהה (יחס הדמיון).',
    'למצוא צלע חסרה בצורה דומה בעזרת יחס הדמיון, בהגדלה ובהקטנה.',
    'לדעת שהוספה של אותו מספר לכל צלע לא נותנת צורה דומה, ושבמרובעים זוויות שוות לא מספיקות.',
  ],
  idea: 'הגדלה כופלת כל צלע באותו מספר, יחס הדמיון, ולא משנה אף זווית.',
  why: [
    '$4 \\to 6$ זה פי $1.5$, ולכן גם $6 \\to 9$. הוספה של $2$ לכל צלע משנה את היחס בין הצלעות, ולכן גם את הצורה.',
    'במלבנים כל הזוויות ישרות, אבל $3 \\times 4$ ו־$6 \\times 5$ אינם דומים: $6 : 3 = 2$ ו־$5 : 4 = 1.25$.',
  ],
  alt: ['כמו צילום בזום: כל מה שבתמונה גדל פי אותו מספר, ולכן הפנים לא "נמתחות".'],
  discover: [
    { kind: 'say', text: 'צורות דומות הן הגדלה או הקטנה זו של זו: אותה צורה, גודל אחר.', fig: tri345x2 },
    { kind: 'predict', text: 'מגדילים מלבן $4 \\times 6$ כך שהצלע $4$ הופכת ל־$6$. מה הופכת הצלע $6$?', fig: rect46,
      choices: ['$9$', '$8$', '$4$'], answer: 0,
      why: '$4 \\to 6$ זה פי $1.5$, ולכן $6 \\cdot 1.5 = 9$.',
      wrongWhy: { 1: 'הוספתם $2$ לכל צלע. הגדלה כופלת: במלבן $6 \\times 8$ היחס בין הצלעות כבר אחר.', 2: 'חילקתם ב־$1.5$ במקום לכפול.' } },
    { kind: 'rule', text: 'בצורות דומות כל הזוויות המתאימות שוות, והיחס בין כל זוג צלעות מתאימות זהה. היחס הזה הוא יחס הדמיון.', display: '\\frac{A\'B\'}{AB} = \\frac{B\'C\'}{BC} = k',
      why: 'כל אורך גדל פי $k$, ולכן גם היחס בין שני אורכים בתוך הצורה לא משתנה.', fig: tri345x2 },
    { kind: 'predict', text: 'בשני המלבנים כל הזוויות ישרות. הם דומים?', fig: rect34v65,
      choices: ['לא', 'כן'], answer: 0,
      why: '$6 : 3 = 2$, אבל $5 : 4 = 1.25$: יחס אחר לכל זוג צלעות.',
      wrongWhy: { 1: 'הזוויות שוות, אבל היחסים לא: $6 : 3 = 2$ ו־$5 : 4 = 1.25$.' } },
    { kind: 'rule', text: 'במרובעים זוויות שוות לא מבטיחות דמיון: בודקים גם את יחס הצלעות. כל שני ריבועים דומים.',
      why: 'ריבוע קובע את היחס בין הצלעות שלו, $1 : 1$; מלבן לא.', fig: rectsAndSquares },
    { kind: 'predict', text: 'מקטינים משולש בצלעות $8$, $12$, $14$ כך ש־$8 \\to 6$. מה הופכת הצלע $12$?', fig: tri8to6,
      choices: ['$9$', '$10$', '$16$'], answer: 0,
      why: '$8 \\to 6$ זה פי $0.75$: $12 \\cdot 0.75 = 9$.',
      wrongWhy: { 1: 'הורדתם $2$ מכל צלע.', 2: 'כפלתם ב־$\\frac{8}{6}$ במקום ב־$\\frac{6}{8}$: הקטנה נותנת צלע קטנה יותר.' } },
    { kind: 'explore', text: 'על הציר העליון הצלעות של המשולש המקורי, ועל התחתון של הקטן. הזיזו את הסמן ל־$12$.', manip: dlineMove(), answer: 12,
      hint: 'כל צעד של $2$ למעלה הוא $1.5$ למטה.', success: '$12 \\to 9$: אותו פי $0.75$ לכל צלע.' },
    { kind: 'predict', text: 'צלע של $5$ הופכת ל־$12.5$. מה יחס הדמיון?', fig: seg5to12,
      choices: ['$2.5$', '$7.5$', '$0.4$'], answer: 0,
      why: '$12.5 : 5 = 2.5$: כופלים ב־$2.5$.',
      wrongWhy: { 1: '$7.5$ הוא ההפרש. יחס הדמיון הוא פי כמה.', 2: '$0.4$ הוא $5 : 12.5$, ההפוך: הצלע גדלה, ולכן היחס גדול מ־$1$.' } },
  ],
  examples: [
    { problem: 'משולש בצלעות $6$, $9$, $10$ הוגדל כך ש־$6 \\to 15$. מה הופכת הצלע $9$?',
      fig: similarPair([10, 6, 9], 2.5, [['10', '6', '9'], ['', '15', '?']], 'משולש עם הצלעות 6, 9 ו־10, והגדלה שלו שבה 6 הפכה ל־15'),
      answer: 22.5, check: '9*15/6',
      steps: [
        { action: 'יחס הדמיון', why: 'פי כמה גדלה הצלע $6$?', result: '15 : 6 = 2.5', calc: { expr: '15/6', value: 2.5 } },
        { action: 'כופלים את $9$ ביחס הדמיון.', why: 'כל צלע גדלה פי אותו מספר.', result: '9 \\cdot 2.5 = 22.5', value: '9*2.5' },
      ] },
    { problem: 'מלבן $12 \\times 8$ הוקטן כך ש־$12 \\to 9$. מה הופכת הצלע $8$?', fig: G.twoRects([12, 8], [9, 6], ['12', '8', '9', '?'], 'מלבן 12 על 8, ומלבן קטן ממנו שבו 12 הפכה ל־9'),
      answer: 6, check: '8*9/12',
      steps: [
        { action: 'יחס הדמיון', why: 'פי כמה השתנתה הצלע $12$?', result: '9 : 12 = 0.75', calc: { expr: '9/12', value: 0.75 } },
        { action: 'כופלים את $8$ ביחס הדמיון.', why: 'הקטנה: כופלים במספר קטן מ־$1$.', result: '8 \\cdot 0.75 = 6', value: '8*0.75' },
      ] },
  ],
  together: [
    { problem: 'מלבן $10 \\times 4$; למלבן דומה הצלע הארוכה $25$. מה הקצרה?', fig: G.twoRects([10, 4], [25, 10], ['10', '4', '25', '?'], 'מלבן 10 על 4, ומלבן דומה לו שהצלע הארוכה שלו 25'),
      steps: [
        { prompt: 'פי כמה?', choices: [
          { text: 'פי $2.5$', ok: true, feedback: '$25 : 10 = 2.5$.' },
          { text: 'ב־$15$ יותר', ok: false, feedback: 'הגדלה כופלת, לא מוסיפה.' },
          { text: 'פי $0.4$', ok: false, feedback: '$0.4$ הוא $10 : 25$, ההפוך.' },
        ], hints: ['$25 : 10$.', '$4 \\cdot 2.5$.'], done: 'פי $2.5$.' },
      ],
      final: { prompt: 'מה אורך הצלע הקצרה?', answer: 10, check: '4*25/10', hints: ['$25 : 10$.', '$4 \\cdot 2.5$.'] } },
    { problem: 'משולש $6$, $8$, $12$; במשולש דומה $6 \\to 9$. מה הופכת $12$?', fig: similarPair([12, 6, 8], 1.5, [['12', '6', '8'], ['?', '9', '']], 'משולש עם הצלעות 6, 8 ו־12, ומשולש דומה לו שבו 6 הפכה ל־9'),
      steps: [
        { prompt: 'פי כמה?', choices: [
          { text: 'פי $1.5$', ok: true, feedback: '$9 : 6 = 1.5$.' },
          { text: 'ב־$3$ יותר', ok: false, feedback: 'הגדלה כופלת: $9 : 6 = 1.5$.' },
        ], hints: ['$9 : 6$.', '$12 \\cdot 1.5$.'], done: 'פי $1.5$.' },
      ],
      final: { prompt: 'מה הופכת הצלע $12$?', answer: 18, check: '12*9/6', hints: ['$9 : 6$.', '$12 \\cdot 1.5$.'] } },
  ],
  diag: sim2,
  transfer: sim2T,
  words: ['דומים', 'יחס הדמיון', 'הגדלה', 'הקטנה', 'צלעות מתאימות'],
  misconceptions: [
    { id: 'additive', title: 'הוסיפו לכל צלע אותו מספר במקום לכפול באותו מספר',
      cause: 'בחשבון של שלמים "אותו דבר לכולם" שומר על ההפרשים; בדמיון שומרים על היחס (הארט 1984).',
      explain: ['הגדלה כופלת: אם $4 \\to 6$ זה פי $1.5$, אז כל צלע מוכפלת ב־$1.5$. הוספה של $2$ לכל צלע עושה מלבן ארוך פחות.'],
      remedy: [
        { kind: 'predict', text: 'מגדילים מלבן $4 \\times 6$ כך שהצלע $4$ הופכת ל־$6$. מה הופכת הצלע $6$?', fig: rect46,
          choices: ['$9$', '$8$'], answer: 0, why: 'פי $1.5$: $6 \\cdot 1.5 = 9$.', wrongWhy: { 1: 'הוספתם $2$. מלבן $6 \\times 8$ אינו באותה צורה: $8 : 6$ שונה מ־$6 : 4$.' } },
        { kind: 'explore', text: 'על הציר העליון הצלעות של המשולש המקורי, ועל התחתון של הקטן. הזיזו את הסמן ל־$12$.', manip: dlineMove(), answer: 12,
          hint: 'כל צעד של $2$ למעלה הוא $1.5$ למטה.', success: '$12 \\to 9$: כל הצלעות מוכפלות באותו מספר, $0.75$.' },
      ] },
    { id: 'ratio-flip', title: 'הכפילו ביחס הדמיון ההפוך',
      cause: '$\\frac{6}{4}$ ו־$\\frac{4}{6}$ נראים דומים.',
      explain: ['בהגדלה התשובה גדלה, בהקטנה היא קטנה. יחס הדמיון הוא הצלע החדשה לחלק לצלע המקורית.'],
      remedy: [
        { kind: 'predict', text: 'מקטינים משולש בצלעות $8$, $12$, $14$ כך ש־$8 \\to 6$. מה הופכת הצלע $12$?', fig: tri8to6,
          choices: ['$9$', '$16$'], answer: 0, why: 'הקטנה: פי $0.75$, ו־$12 \\cdot 0.75 = 9$.', wrongWhy: { 1: '$16$ גדול מ־$12$, אבל המשולש הוקטן. כפלתם ביחס ההפוך.' } },
      ] },
    { id: 'angles-enough', title: 'חשבו שבמרובעים זוויות שוות מספיקות לדמיון',
      cause: 'במשולשים שתי זוויות שוות מספיקות, ונדמה שכך גם במרובעים.',
      explain: ['בכל המלבנים הזוויות ישרות, אבל היחס בין הצלעות משתנה: מלבן ארוך ומלבן כמעט ריבועי אינם דומים.'],
      remedy: [
        { kind: 'predict', text: 'בשני המלבנים כל הזוויות ישרות. הם דומים?', fig: rect34v65,
          choices: ['לא', 'כן'], answer: 0, why: '$6 : 3 = 2$, אבל $5 : 4 = 1.25$: היחסים שונים.' },
      ] },
  ],
};

// ================================================================ stair 3: similar triangles by two angles (ז.ז)

const twoArcs: FigSpec = (() => {
  const f: any = G.twoAngleTris([50, 70], [50, 70], 'שני משולשים בגדלים שונים, ובכל אחד שתי זוויות מסומנות כמו בשני', 0.6);
  return { ...f, angles: f.angles.map((g: any, i: number) => ({ ...g, text: undefined, n: (i % 2) + 1 })) } as FigSpec;
})();
const cutBare = G.cutFig({ a: 4, b: 3, bc: 7 }, { AD: '', DB: '', BC: '' });
const sim3: DiagModel<PX> = {
  params: (rnd) => G.SIM3.params(rnd),
  text: (p) => G.sim3Text(p),
  fig: (p) => G.sim3Fig(p),
  answer: (p) => G.SIM3.answer(p),
  bugs: G.SIM3.bugs,
  solution: (p) => G.sim3Solution(p),
  hint: () => G.sim3Hint(),
  fmt: 'dec',
};
const sim3T: DiagModel<PX> = {
  params: (rnd) => G.SIM3T.params(rnd),
  text: (p) => G.sim3TText(p),
  fig: (p) => G.shadowFig({ ...p, H: G.SIM3T.answer(p) }),
  answer: (p) => G.SIM3T.answer(p),
  bugs: G.SIM3T.bugs,
  solution: (p) => G.sim3TSolution(p),
  hint: () => G.sim3THint(),
  fmt: 'dec',
};
const t7Whole = proofManip(P.T7) as ManipSpec;
const bow365 = G.bowtieFig({ a: 3, b: 6, d: 5 });
const cut466 = G.cutFig({ a: 4, b: 6, bc: 15 }, { DE: '6' });
const shadow8 = G.shadowFig({ h: 1.6, s: 2, S: 10, H: 8 });

const stair3: StairContent = {
  skill: 'sim:3', topic: 'sim', level: 3, title: 'דמיון משולשים (ז.ז)',
  objectives: [
    'לזהות משולשים דומים לפי שתי זוויות שוות (משפט ז.ז), גם כשמשולש אחד בתוך השני.',
    'לכתוב דמיון לפי סדר הקודקודים ולמצוא את הצלעות המתאימות.',
    'למצוא אורך חסר בפרופורציה: ישר מקביל לצלע, צל של עמוד ושל אדם.',
  ],
  idea: 'בשני משולשים מספיקות שתי זוויות שוות: הזווית השלישית שווה ממילא, ולכן הם דומים (ז.ז).',
  why: [
    'סכום הזוויות $180°$, ולכן שתי זוויות קובעות את השלישית ואת צורת המשולש.',
    'ישר מקביל לצלע חותך משולש קטן שדומה לגדול: זווית משותפת, וזוויות מתאימות בין מקבילים.',
  ],
  alt: ['קרני השמש מגיעות באותה זווית לכל העצמים. לכן אדם וצילו ועץ וצילו הם משולשים דומים: זווית ישרה וזווית השמש.'],
  discover: [
    { kind: 'say', text: 'בשני משולשים מספיקות שתי זוויות שוות כדי לקבוע שהם דומים.', fig: twoArcs },
    { kind: 'predict', text: 'במשולש אחד $50°$ ו־$60°$, ובשני $60°$ ו־$70°$. הם דומים?', fig: G.twoAngleTris([50, 60], [60, 70], 'משולש עם זוויות של 50 ושל 60 מעלות, ומשולש עם זוויות של 60 ושל 70 מעלות'),
      choices: ['כן: הזווית השלישית בראשון $70°$', 'לא: הזוויות שונות'], answer: 0,
      why: '$180 - 50 - 60 = 70$: לשניהם $50°$, $60°$, $70°$.',
      wrongWhy: { 1: 'חשבו את הזווית השלישית: בראשון $180 - 50 - 60 = 70$, ובשני $180 - 60 - 70 = 50$. אותן שלוש זוויות.' } },
    { kind: 'rule', text: 'משפט ז.ז: אם שתי זוויות במשולש אחד שוות לשתי זוויות במשולש אחר, המשולשים דומים. כותבים לפי סדר הקודקודים: $\\triangle ADE \\sim \\triangle ABC$.',
      why: 'שתי זוויות קובעות צורה, ויחס אחד קובע גודל.', fig: cutBare },
    { kind: 'predict', text: '$AB \\parallel CD$, והקטעים $AD$ ו־$BC$ נחתכים ב־$M$. $AM = 3$, $MD = 6$, $AB = 5$. מה $CD$?', fig: bow365,
      choices: ['$10$', '$2.5$', '$8$'], answer: 0,
      why: '$\\sphericalangle AMB = \\sphericalangle DMC$ (קודקודיות) ו־$\\sphericalangle A = \\sphericalangle D$ (מתחלפות בין מקבילים): $\\triangle AMB \\sim \\triangle DMC$. $MD : AM = 2$, ולכן $CD = 5 \\cdot 2 = 10$.',
      wrongWhy: { 1: 'כפלתם ביחס ההפוך. $\\triangle DMC$ הוא הגדול, כי $MD$ ארוכה מ־$AM$.', 2: 'הוספתם $3$, כמו מ־$3$ ל־$6$. בדמיון כופלים.' } },
    { kind: 'explore', text: 'סדרו את ההוכחה ש־$\\triangle ADE \\sim \\triangle ABC$.', manip: t7Whole, answer: proofSolution(t7Whole),
      hint: 'שתי זוויות שוות: זווית משותפת, וזוויות מתאימות בין ישרים מקבילים. ורק אחריהן הדמיון.',
      success: 'זווית משותפת, זוויות מתאימות בין מקבילים, ז.ז.' },
    { kind: 'predict', text: '$DE \\parallel BC$, $AD = 4$, $DB = 6$, $DE = 6$. מה $BC$?', fig: cut466,
      choices: ['$15$', '$9$', '$12$'], answer: 0,
      why: 'הצלע המתאימה ל־$AD$ במשולש הגדול היא $AB = 4 + 6 = 10$, לא $DB$. $10 : 4 = 2.5$, ולכן $BC = 6 \\cdot 2.5 = 15$.',
      wrongWhy: { 1: 'השוויתם ל־$DB$, חלק מהצלע.', 2: 'הוספתם $6$ במקום לכפול.' } },
    { kind: 'rule', text: 'בדמיון משווים צלע של המשולש הקטן לצלע המתאימה בגדול, כל הצלע: $AD$ ל־$AB$, ולא ל־$DB$.', display: '\\frac{AD}{AB} = \\frac{DE}{BC}',
      why: '$\\triangle ADE \\sim \\triangle ABC$: $D$ מתאים ל־$B$, ולכן $AD$ מתאימה ל־$AB$.', fig: cut466 },
    { kind: 'predict', text: 'אדם בגובה $1.6$ מטר מטיל צל של $2$ מטר. עץ מטיל באותה שעה צל של $10$ מטר. מה גובה העץ?', fig: shadow8,
      choices: ['$8$', '$9.6$', '$0.32$'], answer: 0,
      why: 'הצל של העץ ארוך פי $5$, ולכן גם העץ גבוה פי $5$: $1.6 \\cdot 5 = 8$.',
      wrongWhy: { 1: 'הוספתם $8$ מטר, כמו הצל. בדמיון כופלים.', 2: 'כפלתם ביחס ההפוך: העץ גבוה מהאדם.' } },
  ],
  examples: [
    { problem: 'ב־$\\triangle ABC$: $DE \\parallel BC$, $AD = 3$, $DB = 6$, $DE = 4$. מה $BC$?', fig: G.cutFig({ a: 3, b: 6, bc: 12 }, { DE: '4' }),
      answer: 12, check: '4*(3+6)/3',
      steps: [
        { action: '$\\triangle ADE \\sim \\triangle ABC$ (ז.ז)', why: 'זווית משותפת, וזוויות מתאימות בין מקבילים.', result: '\\triangle ADE \\sim \\triangle ABC' },
        { action: '$AB = 9$', why: '$AD$ מתאימה לכל $AB$.', result: 'AB = 3 + 6 = 9', calc: { expr: '3+6', value: 9 } },
        { action: 'יחס הדמיון', why: 'פי כמה $AB$ ארוכה מ־$AD$?', result: '9 : 3 = 3', calc: { expr: '9/3', value: 3 } },
        { action: 'כופלים את $DE$.', why: '$BC$ מתאימה ל־$DE$.', result: 'BC = 4 \\cdot 3 = 12', value: '4*3' },
      ] },
    { problem: 'ילדה בגובה $1.5$ מטר מטילה צל של $2$ מטר. בניין מטיל באותה שעה צל של $18$ מטר. מה גובה הבניין?', fig: G.shadowFig({ h: 1.5, s: 2, S: 18, H: 13.5 }, {}, 'ילדה וצלה, ובניין וצלו. קרן שמש מראש כל אחד לקצה הצל שלו'),
      answer: 13.5, check: '1.5*18/2',
      steps: [
        { action: 'הצלים: פי $9$', why: 'באותה שעה קרני השמש באותה זווית, ולכן המשולשים דומים.', result: '18 : 2 = 9', calc: { expr: '18/2', value: 9 } },
        { action: 'גם הגובה פי $9$.', why: 'כל אורך גדל פי אותו מספר.', result: '1.5 \\cdot 9 = 13.5', value: '1.5*9' },
      ] },
  ],
  together: [
    { problem: '$DE \\parallel BC$, $AD = 5$, $DB = 10$, $DE = 4$. מה $BC$?', fig: G.cutFig({ a: 5, b: 10, bc: 12 }, { DE: '4' }),
      steps: [
        { prompt: 'מה מתאים ל־$AD$ במשולש הגדול?', choices: [
          { text: '$AB = 15$', ok: true, feedback: '$D \\leftrightarrow B$, ו־$AB = 5 + 10$.' },
          { text: '$DB = 10$', ok: false, feedback: '$DB$ הוא רק חלק מ־$AB$.' },
          { text: '$BC$', ok: false, feedback: '$BC$ מתאימה ל־$DE$, לא ל־$AD$.' },
        ], hints: ['$\\triangle ADE \\sim \\triangle ABC$: $D \\leftrightarrow B$.', '$15 : 5 = 3$.'], done: '$AB = 15$: יחס הדמיון $3$.' },
      ],
      final: { prompt: 'מה אורך $BC$?', answer: 12, check: '4*15/5', hints: ['$\\triangle ADE \\sim \\triangle ABC$: $D \\leftrightarrow B$.', '$15 : 5 = 3$.'] } },
    { problem: 'מקל באורך $1$ מטר מטיל צל של $1.5$ מטר; עמוד מטיל צל של $6$ מטר. מה גובה העמוד?', fig: G.shadowFig({ h: 1, s: 1.5, S: 6, H: 4 }, {}, 'מקל וצלו, ועמוד וצלו. קרן שמש מראש כל אחד לקצה הצל שלו'),
      steps: [
        { prompt: 'פי כמה הצל של העמוד?', choices: [
          { text: 'פי $4$', ok: true, feedback: '$6 : 1.5 = 4$.' },
          { text: 'ב־$4.5$ יותר', ok: false, feedback: 'בדמיון כופלים.' },
        ], hints: ['$6 : 1.5$.', '$1 \\cdot 4$.'], done: 'פי $4$.' },
      ],
      final: { prompt: 'מה גובה העמוד, במטרים?', answer: 4, check: '1*6/1.5', hints: ['$6 : 1.5$.', '$1 \\cdot 4$.'] } },
  ],
  diag: sim3,
  transfer: sim3T,
  words: ['דמיון', 'ז.ז', 'זווית משותפת', 'זוויות מתאימות בין מקבילים'],
  misconceptions: [
    { id: 'part-not-whole', title: 'השוו לחלק של הצלע במקום לכל הצלע',
      cause: '$DB$ כתובה בשרטוט ליד $DE$, והיא נראית "הצלע של הטרפז".',
      explain: ['בדמיון $\\triangle ADE \\sim \\triangle ABC$ הצלע $AD$ מתאימה לכל $AB$, כלומר $AD + DB$.'],
      remedy: [
        { kind: 'predict', text: '$DE \\parallel BC$, $AD = 4$, $DB = 6$, $DE = 6$. מה $BC$?', fig: cut466,
          choices: ['$15$', '$9$'], answer: 0, why: '$AB = 10$, $10 : 4 = 2.5$, ו־$BC = 6 \\cdot 2.5 = 15$.', wrongWhy: { 1: 'השוויתם ל־$DB$, חלק מהצלע. $AD$ מתאימה לכל $AB$.' } },
      ] },
    { id: 'additive', title: 'הוסיפו לכל צלע אותו מספר במקום לכפול באותו מספר',
      cause: 'בחשבון של שלמים "אותו דבר לכולם" שומר על ההפרשים; בדמיון שומרים על היחס (הארט 1984).',
      explain: ['הצל של העץ ארוך פי $5$ מהצל של האדם, ולכן העץ גבוה פי $5$ מהאדם. לא ב־$8$ מטר יותר.'],
      remedy: [
        { kind: 'predict', text: 'אדם בגובה $1.6$ מטר מטיל צל של $2$ מטר. עץ מטיל באותה שעה צל של $10$ מטר. מה גובה העץ?', fig: shadow8,
          choices: ['$8$', '$9.6$'], answer: 0, why: 'פי $5$: $1.6 \\cdot 5 = 8$.', wrongWhy: { 1: 'הוספתם $8$ מטר, כמו הצל. בדמיון כופלים.' } },
      ] },
    { id: 'ratio-flip', title: 'הכפילו ביחס הדמיון ההפוך',
      cause: 'לא ברור איזה משולש הקטן ואיזה הגדול.',
      explain: ['המשולש עם הצלע הארוכה יותר הוא הגדול. בפרפר: אם $MD$ ארוכה מ־$AM$, אז $CD$ ארוכה מ־$AB$.'],
      remedy: [
        { kind: 'predict', text: '$AB \\parallel CD$, והקטעים $AD$ ו־$BC$ נחתכים ב־$M$. $AM = 3$, $MD = 6$, $AB = 5$. מה $CD$?', fig: bow365,
          choices: ['$10$', '$2.5$'], answer: 0, why: '$MD$ ארוכה פי $2$ מ־$AM$, ולכן $CD = 5 \\cdot 2 = 10$.', wrongWhy: { 1: '$\\triangle DMC$ הוא הגדול. כפלתם ביחס ההפוך.' } },
      ] },
    { id: 'order-mixed', title: 'כתבו את הדמיון בסדר קודקודים שאינו מתאים',
      cause: 'כותבים את המשולשים לפי סדר האותיות, ולא לפי הזוויות השוות.',
      explain: ['כל קודקוד מתאים לקודקוד עם אותה זווית. בפרפר הזווית ב־$A$ שווה לזווית ב־$D$, ולכן $A$ מתאים ל־$D$.'],
      remedy: [
        { kind: 'predict', text: '$AB \\parallel CD$, והקטעים $AD$ ו־$BC$ נחתכים ב־$M$. לאיזה קודקוד של $\\triangle DMC$ מתאים $A$?', fig: G.bowtieFig({ a: 3, b: 6, d: 5 }, { AM: '', MD: '', AB: '', CD: '' }),
          choices: ['$D$', '$C$'], answer: 0, why: '$\\sphericalangle MAB = \\sphericalangle MDC$ (מתחלפות בין מקבילים): $A \\leftrightarrow D$. לכן $\\triangle AMB \\sim \\triangle DMC$.', wrongWhy: { 1: '$C$ מתאים ל־$B$: $\\sphericalangle MBA = \\sphericalangle MCD$.' } },
      ] },
    { id: 'third-angle', title: 'השוו זוויות בלי לחשב קודם את הזווית השלישית',
      cause: 'משווים את המספרים הכתובים, ולא את שלוש הזוויות.',
      explain: ['בכל משולש סכום הזוויות $180°$. מחשבים את הזווית השלישית בכל אחד, ואז משווים.'],
      remedy: [
        { kind: 'predict', text: 'במשולש אחד $50°$ ו־$60°$, ובשני $60°$ ו־$70°$. הם דומים?', fig: G.twoAngleTris([50, 60], [60, 70], 'משולש עם זוויות של 50 ושל 60 מעלות, ומשולש עם זוויות של 60 ושל 70 מעלות'),
          choices: ['כן', 'לא'], answer: 0, why: 'בראשון השלישית $70°$, ובשני $50°$: לשניהם $50°$, $60°$, $70°$.' },
      ] },
  ],
};

// ================================================================ stair 4: the ratio of sides and the ratio of areas

const grid1of9: FigSpec = { type: 'fgrid', rows: 3, cols: 3, shadeRows: 1, shadeCols: 1, label: '1 על 1 בתוך 3 על 3' } as FigSpec;
const grid4of9: FigSpec = { type: 'fgrid', rows: 3, cols: 3, shadeRows: 2, shadeCols: 2, label: '2 על 2 בתוך 3 על 3' } as FigSpec;
/** A triangle and its enlargement by 3, the large one cut into 9 small congruent triangles by lines parallel to its sides. */
const nineFig: FigSpec = (() => {
  const s = 1.2; const top = triFromAngles(60, 60, s);
  const pts: Record<string, Pt> = { _a: [0, 0], _b: [s, 0], _c: [top[0], top[1]] };
  const o = s + 1.2;
  const at = (i: number, j: number): Pt => [o + i * s + j * top[0], j * top[1]]; // the lattice point i steps along the base, j up the left side
  const name = (i: number, j: number) => `_p${i}${j}`;
  for (let j = 0; j <= 3; j += 1) for (let i = 0; i + j <= 3; i += 1) pts[name(i, j)] = at(i, j);
  const segs = [
    { a: '_a', b: '_b', label: '1' }, { a: name(0, 0), b: name(3, 0), label: '3' },
    // the lines parallel to each side, at the thirds
    { a: name(0, 1), b: name(2, 1) }, { a: name(0, 2), b: name(1, 2) },
    { a: name(1, 0), b: name(0, 1) }, { a: name(2, 0), b: name(0, 2) },
    { a: name(1, 0), b: name(1, 2) }, { a: name(2, 0), b: name(2, 1) },
  ];
  return { type: 'geo', label: 'משולש קטן, ומשולש גדול פי 3 שמחולק ל־9 משולשים קטנים חופפים', pts, polys: [{ pts: ['_a', '_b', '_c'] }, { pts: [name(0, 0), name(3, 0), name(0, 3)] }], segs, view: [320, 190], pad: [28, 26] } as FigSpec;
})();
const per15 = similarPair([6, 4, 5], 2, [['6', '4', '5'], ['12', '8', '10']], 'משולש עם הצלעות 4, 5 ו־6, ומשולש דומה לו פי 2: 8, 10 ו־12');
const areas872 = areaPair(4, 4, 3, ['4', '12'], ['8', '72'], null, 'שני משולשים דומים, בשטח 8 ובשטח 72');
const pizzas: FigSpec = (() => {
  const a = circlePts(0, 1.5, 'p'); const b = circlePts(5.2, 3, 'q');
  return {
    type: 'geo', label: 'שתי פיצות עגולות: קוטר 15 ס״מ וקוטר 30 ס״מ', pts: { ...a.pts, ...b.pts },
    polys: [{ pts: a.ring }, { pts: b.ring }],
    segs: [{ a: '_pl', b: '_pr', label: '15' }, { a: '_ql', b: '_qr', label: '30' }],
    view: [320, 190], pad: [24, 24],
  } as FigSpec;
})();
const sim4: DiagModel<PX> = {
  params: (rnd) => G.SIM4.params(rnd),
  text: (p) => G.sim4Text(p),
  answer: (p) => G.SIM4.answer(p),
  bugs: G.SIM4.bugs,
  solution: (p) => G.sim4Solution(p),
  hint: () => G.sim4Hint(),
  fmt: 'dec',
};
const sim4T: DiagModel<PX> = {
  params: (rnd) => G.SIM4T.params(rnd),
  text: (p) => G.sim4TText(p),
  answer: (p) => G.SIM4T.answer(p),
  bugs: G.SIM4T.bugs,
  solution: (p) => G.sim4TSolution(p),
  hint: () => G.sim4THint(),
  fmt: 'dec',
};
const ex4Fig = areaPair(4, 6, 2.5, ['4', '10'], ['12', '?'], ['A', 'B', 'C', 'D', 'E', 'F'], 'משולש ABC בשטח 12 עם AB שווה 4, ומשולש דומה DEF עם DE שווה 10');

const stair4: StairContent = {
  skill: 'sim:4', topic: 'sim', level: 4, title: 'יחס צלעות ויחס שטחים',
  objectives: [
    'לדעת שבצורות דומות יחס ההיקפים שווה ליחס הדמיון, ויחס השטחים שווה לריבוע שלו.',
    'למצוא היקף ושטח של צורה דומה כשיחס הדמיון ידוע.',
    'למצוא את יחס הדמיון מיחס השטחים.',
  ],
  idea: 'כשאורכים גדלים פי $k$, היקף גדל פי $k$ ושטח פי $k^2$.',
  why: [
    'היקף הוא סכום של אורכים, וכל אחד גדל פי $k$.',
    'שטח הוא אורך כפול אורך, ולכן גדל פי $k \\cdot k$: משולש שהוגדל פי $3$ מתחלק ל־$9$ משולשים קטנים חופפים.',
  ],
  alt: ['פיצה בקוטר כפול היא פיצה פי $4$, לא פי $2$.'],
  discover: [
    { kind: 'say', text: 'כשמגדילים צורה פי $3$, כל האורכים גדלים פי $3$. מה קורה לשטח?', fig: grid1of9 },
    { kind: 'predict', text: 'מגדילים משולש פי $3$. פי כמה גדל השטח?', fig: nineFig,
      choices: ['$9$', '$3$', '$6$'], answer: 0,
      why: 'המשולש הגדול מתחלק ל־$9$ משולשים קטנים חופפים: $3 \\cdot 3 = 9$.',
      wrongWhy: { 1: 'האורכים פי $3$; השטח הוא אורך כפול אורך.', 2: 'ספרו את המשולשים הקטנים בגדול: $9$.' } },
    { kind: 'rule', text: 'בצורות דומות ההיקף גדל פי יחס הדמיון, והשטח פי יחס הדמיון בריבוע.', display: '\\frac{S_{2}}{S_{1}} = k^2',
      why: 'שטח נמדד בריבועים, וכל ריבוע קטן גדל לרוחב ולגובה.', fig: nineFig },
    // SK-LEARN-7: the student moves the object once on every stair
    { kind: 'explore', text: 'מגדילים ריבוע פי $4$: כל צלע ארוכה פי $4$. שימו את הסמן על פי כמה גדל השטח.',
      manip: { kind: 'numberline', min: 0, max: 20, from: 0, start: 0, plain: true } as ManipSpec, answer: 16,
      hint: 'השטח גדל פי יחס הדמיון בריבוע: $4^2$.', success: 'פי $16$: בכל ריבוע גדול יש $4 \\cdot 4 = 16$ ריבועים כמו הקטן.' },
    { kind: 'predict', text: 'יחס הדמיון $2$. היקף הקטן $15$. מה היקף הגדול?', fig: per15,
      choices: ['$30$', '$60$', '$17$'], answer: 0,
      why: 'היקף הוא סכום אורכים, וכל אורך גדל פי $2$.',
      wrongWhy: { 1: 'העליתם בריבוע גם את ההיקף; רק שטח גדל פי $k^2$.', 2: 'הגדלה כופלת: $15 \\cdot 2$, לא $15 + 2$.' } },
    { kind: 'say', text: 'שטח גדל מהר יותר מהאורך: פי $2$ באורך הוא פי $4$ בשטח, ופי $3$ הוא פי $9$.', fig: grid4of9 },
    { kind: 'predict', text: 'שטחי שני משולשים דומים $8$ ו־$72$. מה יחס הדמיון?', fig: areas872,
      choices: ['$3$', '$9$', '$64$'], answer: 0,
      why: '$72 : 8 = 9 = 3^2$, ולכן $k = 3$.',
      wrongWhy: { 1: '$9$ הוא יחס השטחים. יחס הדמיון הוא המספר שבריבוע נותן $9$.', 2: '$64$ הוא ההפרש בין השטחים. יחס הוא פי כמה.' } },
    { kind: 'predict', text: 'פיצה בקוטר $30$ ס״מ במקום $15$ ס״מ. פי כמה יותר פיצה?', fig: pizzas,
      choices: ['פי $4$', 'פי $2$'], answer: 0,
      why: 'הקוטר פי $2$, והשטח פי $2^2 = 4$.',
      wrongWhy: { 1: 'הקוטר פי $2$, אבל הפיצה גדלה גם לרוחב וגם לגובה: פי $2 \\cdot 2 = 4$.' } },
    { kind: 'rule', text: 'כדי למצוא יחס דמיון מיחס שטחים, מוציאים שורש: יחס שטחים $9$ הוא יחס דמיון $3$.', why: '$k^2 = 9$, ולכן $k = 3$.', fig: areas872 },
  ],
  examples: [
    { problem: '$\\triangle ABC \\sim \\triangle DEF$, $AB = 4$, $DE = 10$, שטח $\\triangle ABC$ הוא $12$. מה שטח $\\triangle DEF$?', fig: ex4Fig,
      answer: 75, check: '12*(10/4)^2',
      steps: [
        { action: 'יחס הדמיון', why: 'פי כמה $DE$ ארוכה מ־$AB$?', result: '10 : 4 = 2.5', calc: { expr: '10/4', value: 2.5 } },
        { action: 'יחס השטחים', why: 'השטח גדל פי ריבוע יחס הדמיון.', result: '2.5^2 = 6.25', calc: { expr: '2.5^2', value: 6.25 } },
        { action: 'כופלים את השטח.', why: 'שטח $\\triangle DEF$ גדול פי $6.25$.', result: '12 \\cdot 6.25 = 75', value: '12*6.25' },
      ] },
    { problem: 'שטחי שני משולשים דומים $5$ ו־$45$; צלע במשולש הקטן $3$. מה הצלע המתאימה בגדול?', fig: areaPair(3, 10 / 3, 3, ['3', '?'], ['5', '45'], null, 'שני משולשים דומים, בשטח 5 ובשטח 45. בקטן צלע 3'),
      answer: 9, check: '3*sqrt(45/5)',
      steps: [
        { action: 'יחס השטחים', why: 'פי כמה השטח הגדול?', result: '45 : 5 = 9', calc: { expr: '45/5', value: 9 } },
        { action: 'יחס הדמיון', why: 'יחס השטחים הוא ריבוע יחס הדמיון.', result: '\\sqrt{9} = 3', calc: { expr: 'sqrt(9)', value: 3 } },
        { action: 'כופלים את הצלע.', why: 'כל צלע גדלה פי $3$.', result: '3 \\cdot 3 = 9', value: '3*3' },
      ] },
  ],
  together: [
    { problem: 'יחס הדמיון $3$, ושטח הקטן $7$. מה שטח הגדול?', fig: grid1of9,
      steps: [
        { prompt: 'פי כמה השטח?', choices: [
          { text: 'פי $9$', ok: true, feedback: 'פי $3^2 = 9$.' },
          { text: 'פי $3$', ok: false, feedback: 'זה לאורכים.' },
          { text: 'פי $6$', ok: false, feedback: '$6$ הוא $3 + 3$; שטח גדל פי $3 \\cdot 3$.' },
        ], hints: ['$k^2$.', '$7 \\cdot 9$.'], done: 'השטח פי $9$.' },
      ],
      final: { prompt: 'מה שטח הגדול?', answer: 63, check: '7*9', hints: ['$k^2$.', '$7 \\cdot 9$.'] } },
    { problem: 'היקף משולש $24$, וצלע שלו $6$; במשולש דומה הצלע המתאימה $9$. מה ההיקף שלו?', fig: similarPair([6, 8, 10], 1.5, [['6', '', ''], ['9', '', '']], 'משולש בהיקף 24 עם צלע 6, ומשולש דומה לו שהצלע המתאימה בו 9'),
      steps: [
        { prompt: 'פי כמה?', choices: [
          { text: 'פי $1.5$', ok: true, feedback: '$9 : 6 = 1.5$.' },
          { text: 'פי $2.25$', ok: false, feedback: '$2.25$ הוא לשטח.' },
        ], hints: ['$9 : 6$.', '$24 \\cdot 1.5$.'], done: 'פי $1.5$, וההיקף גדל פי אותו מספר.' },
      ],
      final: { prompt: 'מה ההיקף?', answer: 36, check: '24*9/6', hints: ['$9 : 6$.', '$24 \\cdot 1.5$.'] } },
  ],
  diag: sim4,
  transfer: sim4T,
  words: ['יחס ההיקפים', 'יחס השטחים', 'ריבוע יחס הדמיון'],
  misconceptions: [
    { id: 'linear-area', title: 'חשבו שהשטח גדל פי אותו מספר כמו האורכים',
      cause: '"פי $k$" בכל מקום הוא הכלל הפשוט, והוא נכון לאורכים (דה בוק ועמיתיו 1998).',
      explain: ['שטח הוא אורך כפול אורך: כשכל אורך גדל פי $3$, השטח גדל פי $3 \\cdot 3 = 9$.'],
      remedy: [
        { kind: 'predict', text: 'מגדילים משולש פי $3$. פי כמה גדל השטח?', fig: nineFig,
          choices: ['$9$', '$3$'], answer: 0, why: '$9$ משולשים קטנים חופפים בגדול.', wrongWhy: { 1: 'האורכים פי $3$. ספרו את המשולשים הקטנים.' } },
        { kind: 'predict', text: 'פיצה בקוטר $30$ ס״מ במקום $15$ ס״מ. פי כמה יותר פיצה?', fig: pizzas,
          choices: ['פי $4$', 'פי $2$'], answer: 0, why: 'הקוטר פי $2$, והשטח פי $2^2 = 4$.' },
      ] },
    { id: 'ratio-flip', title: 'הכפילו ביחס הדמיון ההפוך',
      cause: 'לא בודקים אם המשולש גדל או קטן.',
      explain: ['אם הצלע המתאימה ארוכה יותר, המשולש גדול יותר, וגם השטח שלו גדול יותר.'],
      remedy: [
        { kind: 'predict', text: '$\\triangle ABC \\sim \\triangle DEF$, $AB = 4$, $DE = 10$, ושטח $\\triangle ABC$ הוא $12$. שטח $\\triangle DEF$ קטן מ־$12$?', fig: ex4Fig,
          choices: ['לא', 'כן'], answer: 0, why: '$DE$ ארוכה מ־$AB$: המשולש גדל, והשטח גדל פי $2.5^2 = 6.25$, ל־$75$.' },
      ] },
    { id: 'area-for-perimeter', title: 'העלו בריבוע גם את יחס ההיקפים',
      cause: 'אחרי שלומדים $k^2$, מעלים בריבוע הכול.',
      explain: ['היקף הוא סכום של אורכים, ולכן גדל פי $k$ בלבד. רק שטח גדל פי $k^2$.'],
      remedy: [
        { kind: 'predict', text: 'יחס הדמיון $2$. היקף הקטן $15$. מה היקף הגדול?', fig: per15,
          choices: ['$30$', '$60$'], answer: 0, why: 'כל צלע פי $2$, ולכן ההיקף $15 \\cdot 2 = 30$.', wrongWhy: { 1: 'העליתם בריבוע. היקף הוא סכום אורכים.' } },
      ] },
  ],
};

export const SIM: StairContent[] = [stair1, stair2, stair3, stair4];
/** Names of misconceptions new to this topic: none beyond the topic's own (content/sim.js names them all). */
export const CATS_SIM: Record<string, string> = {};
export { sim1, sim1T, sim2, sim2T, sim3, sim3T, sim4, sim4T };
