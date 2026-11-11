// Congruent triangles (חפיפת משולשים): the ח׳ unit 8.12 of January and February (curriculum stage 4, GEOM-5). Four
// stairs: corresponding sides and angles read from a congruence written in the order of its vertices, the three
// congruence theorems (and why two sides with an angle that is not between them do not fix a triangle), a proof in the
// class's table טענה | נימוק, and the median with the areas it halves.
//
// Every drawing of two triangles is computed from their angles (content/proofs.js triFromAngles through
// content/congr.gen.js twoTriangles): ABC with A on top, B bottom right and C bottom left, the second turned or mirrored,
// its letters from the statement, so a student who matches vertices by where they are drawn is caught, not helped. The
// diagnostic models are the stage's (content/congr.gen.js CONGR1 to CONGR4T, as the critique revised them); every
// misconception's source is listed there. Importing that module also registers the topic's practice generators
// (content/lazyGen.js), so they load with this file and not on the first screen. Every number written here is checked by
// the lane's spec/facts-congr.mjs, and the maths of every step by learn/content.test.ts.
import type { DiagModel, FigSpec, ManipSpec, StairContent } from '../types';
// @ts-ignore: plain JS, the practice generators' draws, texts, worked solutions and drawings
import * as GEN from '@/content/congr.gen.js';
// @ts-ignore: plain JS, the proof templates
import { PROOF, proofManip, triFromAngles } from '@/content/proofs.js';
// @ts-ignore: plain JS, the proof object's answer
import { proofSolution } from '@/content/proof.js';

/** The plain-JS modules, untyped here: their drawings are checked by learn/figures.test.ts, not by the compiler. */
const G: any = GEN;
const P: any = PROOF;

// ---------------------------------------------------------------- drawings
type Pt = [number, number];
type Marks = Record<string, { text?: string; target?: boolean; n?: number; r?: number }>;
/** Two triangles, ABC and its image under `partner` (content/congr.gen.js twoTriangles). */
const two = (o: { angs: Record<string, number>; partner: Record<string, string>; top?: string; left?: string; marks?: Marks; ticks?: Record<string, number>; sides?: Record<string, string>; label?: string }): FigSpec => G.twoTriangles(o);
/** A drawing with no letters (a step whose text names no point). */
const unnamed = (f: any): FigSpec => ({ ...f, hide: Object.keys(f.pts).filter((k: string) => !k.startsWith('_')) });
/** The same drawing with its letters renamed (DEF ≅ RPQ is drawn as ABC ≅ RPQ, then A, B, C renamed D, E, F). */
function renamed(f: any, map: Record<string, string>, label: string): FigSpec {
  const r = (k: string) => map[k] ?? k;
  return {
    ...f, label,
    pts: Object.fromEntries(Object.entries(f.pts).map(([k, v]) => [r(k), v])),
    polys: f.polys?.map((pg: any) => ({ ...pg, pts: pg.pts.map(r) })),
    ...(f.segs ? { segs: f.segs.map((s: any) => ({ ...s, a: r(s.a), b: r(s.b) })) } : {}),
    ...(f.angles ? { angles: f.angles.map((g: any) => ({ ...g, at: r(g.at), from: r(g.from), to: r(g.to) })) } : {}),
    ...(f.match ? { match: f.match.map(([a, b]: string[]) => [r(a), r(b)]) } : {}),
  };
}
/** The angles of a triangle with AB = c, BC = a, CA = b (the law of cosines), in degrees. */
function anglesOfSides(c: number, a: number, b: number) {
  const at = (opp: number, s1: number, s2: number) => (Math.acos((s1 * s1 + s2 * s2 - opp * opp) / (2 * s1 * s2)) * 180) / Math.PI;
  return { A: at(a, b, c), B: at(b, a, c), C: at(c, a, b) };
}
const rad = (d: number) => (d * Math.PI) / 180;
const ALL6 = { A: { n: 1 }, B: { n: 2 }, C: { n: 3 } };
const TICKS3 = { AB: 1, BC: 2, CA: 3 };
/** Arcs at every vertex of both triangles: n arcs at a vertex and at its partner. */
const arcsOf = (partner: Record<string, string>): Marks => ({ ...ALL6, [partner.A]: { n: 1 }, [partner.B]: { n: 2 }, [partner.C]: { n: 3 } });

// ================================================================ stair 1: corresponding sides and angles

// steps 1 and 3: ABC and its mirror image DEF, every pair marked
const S1_ANGS = { A: 70, B: 45, C: 65 };
const DEF = { A: 'D', B: 'E', C: 'F' };
const pairsFig = (named: boolean): FigSpec => {
  // step 1: mirrored (E bottom left); steps 2 and 3: turned, E on top and F where B is drawn
  const f = named
    ? two({ angs: S1_ANGS, partner: DEF, top: 'B', left: 'A', ticks: TICKS3, marks: arcsOf(DEF), label: 'שני משולשים חופפים, ABC ו־DEF. צלעות מתאימות מסומנות באותו מספר קווים, וזוויות מתאימות באותו מספר קשתות' })
    : two({ angs: S1_ANGS, partner: DEF, top: 'A', left: 'B', ticks: TICKS3, marks: arcsOf(DEF), label: 'שני משולשים חופפים, השני הפוך כמו במראה. צלעות מתאימות מסומנות באותו מספר קווים, וזוויות מתאימות באותו מספר קשתות' });
  return named ? f : unnamed(f);
};
// step 2: DEF turned so F is drawn where B is (bottom right), only the angle at B marked
const turnedFig = two({ angs: S1_ANGS, partner: DEF, top: 'B', left: 'A', marks: { B: { n: 1 } }, label: 'שני משולשים, ABC ו־DEF. המשולש השני מסובב: F למטה מימין, במקום ש־B נמצא בראשון' });
// step 4: ABC and KML, L on top
const kmlFig = two({ angs: { A: 60, B: 75, C: 45 }, partner: { A: 'K', B: 'M', C: 'L' }, top: 'C', left: 'B', label: 'שני משולשים, ABC ו־KML. L למעלה, M למטה משמאל ו־K למטה מימין' });
// steps 6 and 7: ticks only, 70° opposite the side with two ticks
const oppositeFig = (both: boolean): FigSpec => unnamed(two({
  angs: { A: 70, B: 50, C: 60 }, partner: DEF, top: 'B', left: 'C', ticks: TICKS3,
  // the prediction marks the 70° of its text with an arc, so the drawing does not write the answer
  marks: both ? { A: { text: '70°' }, D: { text: '70°' } } : { A: { n: 1 }, D: { text: '?', target: true } },
  label: both ? 'שני משולשים חופפים: מול הצלע עם שני הסימונים זווית של 70 מעלות בשניהם' : 'שני משולשים חופפים. מול הצלע עם שני הסימונים בראשון זווית של 70 מעלות, ובשני סימן שאלה',
}));
// step 8: ABC (50° at A, 60° at B) and PQR, R bottom right
const pqrFig = two({ angs: { A: 50, B: 60, C: 70 }, partner: { A: 'P', B: 'Q', C: 'R' }, top: 'B', left: 'A', marks: { A: { text: '50°' }, B: { text: '60°' }, R: { text: '?', target: true } }, label: 'שני משולשים, ABC ו־PQR. ב־A זווית של 50 מעלות, ב־B של 60, ב־R סימן שאלה' });
/** The transform object (congr:1 step 5, congr:2 step 5). */
const tf = (pts: Pt[], names: string[], moves: Record<string, unknown>, target: { pts: Pt[]; names: string[] }): ManipSpec => ({ kind: 'transform', shape: { pts, names }, moves, target });
const S1_TARGET: Pt[] = [[-1, 4], [-4, 4], [-1, 1]];

type P12 = Record<string, any>;
const congr1: DiagModel<P12> = {
  params: (rnd) => G.CONGR1.params(rnd),
  text: (p) => G.congr1Text(p),
  fig: (p) => G.congrFig(p),
  answer: (p) => G.CONGR1.answer(p),
  bugs: G.CONGR1.bugs,
  solution: (p) => G.congr1Solution(p),
  hint: (p) => G.congr1Hint(p),
};
const congr1T: DiagModel<P12> = {
  params: (rnd) => G.CONGR1T.params(rnd),
  text: (p) => G.congr1TText(p),
  fig: (p) => G.congr1TFig(p),
  answer: (p) => G.CONGR1T.answer(p),
  bugs: G.CONGR1T.bugs,
  solution: (p) => G.congr1TSolution(p),
  hint: (p) => G.congr1THint(p),
};
// example 2: △ABC ≅ △FED, AB = 2x + 1 (13), BC = ED = 9, AC = FD = 15
const fedFig = two({ angs: anglesOfSides(13, 9, 15), partner: { A: 'F', B: 'E', C: 'D' }, top: 'C', left: 'A', sides: { AB: '2x + 1', FE: '13', ED: '9', FD: '15' }, label: 'שני משולשים חופפים, ABC ו־FED, עם אורכי הצלעות של FED' });
// together 2: △ABC ≅ △NML, BC = 3x − 4, ML = 11, NM = 8
const nmlFig = two({ angs: anglesOfSides(8, 11, 9), partner: { A: 'N', B: 'M', C: 'L' }, top: 'B', left: 'C', sides: { BC: '3x − 4', ML: '11', NM: '8' }, label: 'שני משולשים חופפים, ABC ו־NML. על BC כתוב 3x פחות 4, ML שווה 11 ו־NM שווה 8' });
// together 1: △DEF ≅ △RPQ, ∢E = 80°, ∢F = 40° (drawn as ABC ≅ RPQ, then renamed)
const rpqFig = renamed(two({ angs: { A: 60, B: 80, C: 40 }, partner: { A: 'R', B: 'P', C: 'Q' }, top: 'B', left: 'A', marks: { B: { text: '80°' }, C: { text: '40°' }, R: { text: '?', target: true } } }), { A: 'D', B: 'E', C: 'F' }, 'שני משולשים, DEF ו־RPQ. ב־E זווית של 80 מעלות, ב־F של 40, ב־R סימן שאלה');

const stair1: StairContent = {
  skill: 'congr:1', topic: 'congr', level: 1, title: 'צלעות וזוויות מתאימות',
  objectives: [
    'לקרוא חפיפה שכתובה לפי סדר הקודקודים: ב־$\\triangle ABC \\cong \\triangle DEF$, $A$ מתאים ל־$D$, $B$ ל־$E$ ו־$C$ ל־$F$.',
    'למצוא צלעות וזוויות מתאימות גם כשהמשולש השני מוזז, משוקף או מסובב.',
    'לדעת שמול צלעות שוות מונחות זוויות שוות, ולהשלים מידות חסרות בעזרת סכום הזוויות.',
  ],
  idea: 'בחפיפה הכתיבה אומרת מי מתאים למי: ראשון לראשון, שני לשני, שלישי לשלישי.',
  why: [
    'כשמניחים משולש על המשולש החופף לו, כל צלע מכסה את הצלע המתאימה, והזווית שמולה מכסה את הזווית שמולה.',
    'המשולש השני יכול להיות מסובב או הפוך בשרטוט; הכתיבה לא משתנה, ולכן סומכים עליה ולא על המקום.',
  ],
  alt: ['צבעו כל זוג מתאים באותו צבע: $A$ ו־$D$ באדום, $B$ ו־$E$ בכחול. צלע מתאימה מחברת שני צבעים מתאימים.'],
  discover: [
    { kind: 'say', text: 'שני משולשים חופפים אם אפשר להניח אחד על השני בדיוק. אז לכל צלע יש צלע מתאימה ששווה לה, ולכל זווית זווית מתאימה.', fig: pairsFig(false) },
    { kind: 'predict', text: '$\\triangle ABC \\cong \\triangle DEF$. איזו זווית שווה ל־$\\sphericalangle B$?', fig: turnedFig,
      choices: ['$\\sphericalangle E$', '$\\sphericalangle F$', '$\\sphericalangle D$'], answer: 0,
      why: '$B$ שני ב־$ABC$, ו־$E$ שני ב־$DEF$.',
      wrongWhy: { 1: 'בשרטוט $F$ במקום של $B$, אבל המשולש מסובב. הכתיבה קובעת, לא המקום.', 2: '$D$ ראשון ב־$DEF$, ולכן הוא מתאים ל־$A$, הראשון ב־$ABC$.' } },
    { kind: 'rule', text: '$\\triangle ABC \\cong \\triangle DEF$ אומר $A \\leftrightarrow D$, $B \\leftrightarrow E$, $C \\leftrightarrow F$, ולכן $AB = DE$, $BC = EF$, $AC = DF$.',
      why: 'צלע מתאימה מחברת קודקודים מתאימים.', fig: pairsFig(true) },
    { kind: 'predict', text: '$\\triangle ABC \\cong \\triangle KML$. איזו צלע שווה ל־$AB$?', fig: kmlFig,
      choices: ['$KM$', '$KL$', '$ML$'], answer: 0,
      why: '$A \\leftrightarrow K$ ו־$B \\leftrightarrow M$, ולכן $AB = KM$.',
      wrongWhy: { 1: '$KL$ מתאימה לפי סדר האלף־בית, אבל בחפיפה הסדר הוא $K, M, L$.', 2: '$ML$ מחברת את השני והשלישי, ולכן היא מתאימה ל־$BC$.' } },
    { kind: 'explore', text: 'הניחו את $\\triangle KML$ על $\\triangle ABC$ כך ש־$K$ על $A$, $M$ על $B$ ו־$L$ על $C$.',
      manip: tf([[1, -1], [4, -1], [1, 2]], ['K', 'M', 'L'], { drag: true, flips: ['y'], turns: { centre: [0, 0], by: 90 } }, { pts: S1_TARGET, names: ['A', 'B', 'C'] }),
      answer: { pts: S1_TARGET },
      hint: '$KML$ הפוך גם למעלה־למטה וגם לצדדים: נסו שני רבעי סיבוב, ואחר כך הזזה.',
      success: '$K$ על $A$, $M$ על $B$, $L$ על $C$: כך קוראים $\\triangle ABC \\cong \\triangle KML$.' },
    { kind: 'predict', text: 'הצלע עם שני הסימונים שווה בשני המשולשים. הזווית שמולה במשולש הראשון $70°$. מה הזווית שמולה במשולש השני?', fig: oppositeFig(false),
      choices: ['$70°$', '$110°$', 'אי אפשר לדעת'], answer: 0,
      why: 'מול צלעות מתאימות מונחות זוויות מתאימות, והן שוות.',
      wrongWhy: { 1: '$110°$ משלימה את $70°$ ל־$180°$, אבל זה משולש חופף, לא זווית צמודה: הזוויות המתאימות שוות.', 2: 'אפשר: המשולשים חופפים, והזווית מול הצלע המתאימה שווה.' } },
    { kind: 'rule', text: 'במשולשים חופפים: מול צלעות שוות מונחות זוויות שוות, ומול זוויות שוות מונחות צלעות שוות.',
      why: 'צלע מכסה צלע, והזווית שמולה מכסה את הזווית שמולה.', fig: oppositeFig(true) },
    { kind: 'predict', text: '$\\triangle ABC \\cong \\triangle PQR$, $\\sphericalangle A = 50°$, $\\sphericalangle B = 60°$. מה $\\sphericalangle R$?', fig: pqrFig,
      choices: ['$70°$', '$50°$', '$130°$'], answer: 0,
      why: '$R \\leftrightarrow C$, ו־$\\sphericalangle C = 180° - 50° - 60° = 70°$.',
      wrongWhy: { 1: '$50°$ היא הזווית ב־$A$, ו־$A$ מתאים ל־$P$.', 2: 'חיסרתם רק את $50°$.' } },
  ],
  examples: [
    { problem: '$\\triangle ABC \\cong \\triangle KML$. $\\sphericalangle A = 70°$, $\\sphericalangle B = 45°$. מה $\\sphericalangle L$?',
      fig: two({ angs: { A: 70, B: 45, C: 65 }, partner: { A: 'K', B: 'M', C: 'L' }, top: 'C', left: 'A', marks: { A: { text: '70°' }, B: { text: '45°' }, L: { text: '?', target: true } }, label: 'שני משולשים, ABC ו־KML. ב־A זווית של 70 מעלות, ב־B של 45, ב־L סימן שאלה' }),
      answer: 65, check: '180-70-45',
      steps: [
        { action: '$L$ שלישי ב־$KML$, ולכן $L \\leftrightarrow C$.', why: 'שלישי לשלישי.', result: '\\sphericalangle L = \\sphericalangle C' },
        { action: 'סכום הזוויות במשולש.', why: 'שתי הזוויות של $ABC$ ידועות.', result: '70° + 45° = 115°', calc: { expr: '70+45', value: 115 } },
        { action: 'מה שנשאר מ־$180°$.', why: '$\\sphericalangle C$ משלימה את שתיהן ל־$180°$, ו־$\\sphericalangle L$ שווה לה.', result: '180° - 115° = 65°', value: '180-115' },
      ] },
    { problem: '$\\triangle ABC \\cong \\triangle FED$. $AB = 2x + 1$, $FE = 13$, $ED = 9$, $FD = 15$ (ס״מ). מה $x$?', fig: fedFig,
      answer: 6, check: '(13-1)/2',
      steps: [
        { action: '$AB \\leftrightarrow FE$: שני הראשונים בכל משולש.', why: '$A \\leftrightarrow F$ ו־$B \\leftrightarrow E$.', result: '2x + 1 = 13', eq: '2*x + 1 = 13' },
        { action: 'מחסירים $1$ משני האגפים.', why: 'כדי ש־$2x$ יישאר לבד.', result: '2x = 12', eq: '2*x = 12' },
        { action: 'מחלקים ב־$2$.', why: 'אחד $x$.', result: 'x = 6', value: '12/2' },
      ] },
  ],
  together: [
    { problem: '$\\triangle DEF \\cong \\triangle RPQ$. $\\sphericalangle E = 80°$, $\\sphericalangle F = 40°$. מה $\\sphericalangle R$?', fig: rpqFig,
      steps: [
        { prompt: 'לאיזה קודקוד מתאים $R$?', choices: [
          { text: '$D$', ok: true, feedback: '$R$ ראשון, כמו $D$.' },
          { text: '$F$', ok: false, feedback: 'לפי האלף־בית $R$ אחרון, אבל בכתיבה הוא ראשון.' },
          { text: '$E$', ok: false, feedback: '$E$ שני ב־$DEF$, ולכן הוא מתאים ל־$P$, השני ב־$RPQ$.' },
        ], hints: ['ראשון לראשון.', '$\\sphericalangle R = \\sphericalangle D = 180° - 80° - 40°$.'], done: '$R \\leftrightarrow D$.' },
      ],
      final: { prompt: 'מה $\\sphericalangle R$, במעלות?', answer: 60, check: '180-80-40', hints: ['ראשון לראשון.', '$\\sphericalangle R = \\sphericalangle D = 180° - 80° - 40°$.'] } },
    { problem: '$\\triangle ABC \\cong \\triangle NML$. $BC = 3x - 4$, $ML = 11$, $NM = 8$. מה $x$?', fig: nmlFig,
      steps: [
        { prompt: 'איזו צלע שווה ל־$BC$?', choices: [
          { text: '$ML$', ok: true, feedback: '$B \\leftrightarrow M$ ו־$C \\leftrightarrow L$.' },
          { text: '$NM$', ok: false, feedback: '$NM$ מתאימה ל־$AB$.' },
          { text: '$NL$', ok: false, feedback: '$NL$ מחברת את הראשון והשלישי, ולכן היא מתאימה ל־$AC$.' },
        ], hints: ['$B \\leftrightarrow M$, $C \\leftrightarrow L$.', '$3x - 4 = 11$.'], done: '$BC = ML$.' },
      ],
      final: { prompt: 'מה $x$?', answer: 5, check: '(11+4)/3', hints: ['$B \\leftrightarrow M$, $C \\leftrightarrow L$.', '$3x - 4 = 11$.'] } },
  ],
  diag: congr1,
  transfer: congr1T,
  words: ['חפיפה', '$\\cong$', 'קודקודים מתאימים', 'צלעות מתאימות', 'זוויות מתאימות'],
  misconceptions: [
    { id: 'alpha-order', title: 'התאימו קודקודים לפי סדר האלף־בית, ולא לפי הסדר שבחפיפה',
      cause: 'כשהאותיות נראות "בסדר", קל להתאים לפי האלף־בית.',
      explain: ['הסדר בכתיבה הוא ההתאמה.', 'ב־$\\triangle ABC \\cong \\triangle KML$: $B$ שני, ולכן הוא מתאים ל־$M$, השני, ולא ל־$L$.'],
      remedy: [
        { kind: 'predict', text: '$\\triangle ABC \\cong \\triangle KML$. איזו צלע שווה ל־$AB$?', fig: kmlFig, choices: ['$KM$', '$KL$'], answer: 0,
          why: '$A \\leftrightarrow K$ ו־$B \\leftrightarrow M$: $AB = KM$.', wrongWhy: { 1: 'זה סדר האלף־בית. בכתיבה $M$ שני.' } },
        { kind: 'explore', text: 'הניחו את $\\triangle KML$ על $\\triangle ABC$ כך ש־$K$ על $A$, $M$ על $B$ ו־$L$ על $C$.',
          manip: tf([[1, -1], [4, -1], [1, 2]], ['K', 'M', 'L'], { drag: true, flips: ['y'], turns: { centre: [0, 0], by: 90 } }, { pts: S1_TARGET, names: ['A', 'B', 'C'] }),
          answer: { pts: S1_TARGET }, hint: 'שני רבעי סיבוב, ואחר כך הזזה.', success: 'ראשון על ראשון, שני על שני, שלישי על שלישי.' },
      ] },
    { id: 'match-by-place', title: 'התאימו קודקודים לפי המקום בשרטוט, ולא לפי החפיפה',
      cause: 'השרטוט משכנע יותר מהכתיבה: הצורה "מנצחת" את המושג.',
      explain: ['המשולש השני יכול להיות מסובב או הפוך. מה שבאותו מקום בשרטוט לא חייב להתאים.', 'סומכים על הכתיבה: ראשון לראשון, שני לשני.'],
      remedy: [
        { kind: 'predict', text: '$\\triangle ABC \\cong \\triangle DEF$. איזו זווית שווה ל־$\\sphericalangle B$?', fig: turnedFig, choices: ['$\\sphericalangle E$', '$\\sphericalangle F$'], answer: 0,
          why: '$B$ שני ו־$E$ שני. $F$ רק מצויר באותו מקום.', wrongWhy: { 1: '$F$ באותו מקום בשרטוט, אבל המשולש מסובב פעמיים.' } },
      ] },
    { id: 'one-angle', title: 'חיסרו מ־$180°$ רק זווית אחת',
      cause: 'ממהרים לסכום ושוכחים זווית.',
      explain: ['סכום שלוש הזוויות $180°$: מחסירים את שתי הזוויות הידועות.'],
      remedy: [
        { kind: 'predict', text: '$\\triangle ABC \\cong \\triangle PQR$, $\\sphericalangle A = 50°$, $\\sphericalangle B = 60°$. מה $\\sphericalangle R$?', fig: pqrFig,
          choices: ['$70°$', '$130°$'], answer: 0, why: '$180° - 50° - 60° = 70°$: שתי הזוויות.', wrongWhy: { 1: 'חיסרתם רק את $50°$.' } },
      ] },
    { id: 'wrong-pair', title: 'השוו חלקים שאינם מתאימים בחפיפה',
      cause: '"$180°$ פחות שתי הזוויות" נותן זווית שנראית כמו תשובה, אבל הזווית שמחפשים מתאימה לזווית שכבר כתובה.',
      explain: ['קודם מוצאים את הקודקוד המתאים לפי הכתיבה, ורק אחר כך מחשבים.'],
      remedy: [
        { kind: 'predict', text: '$\\triangle ABC \\cong \\triangle KML$. איזו צלע שווה ל־$AB$?', fig: kmlFig, choices: ['$KM$', '$ML$'], answer: 0,
          why: 'צלע מתאימה מחברת קודקודים מתאימים: $A \\leftrightarrow K$, $B \\leftrightarrow M$.', wrongWhy: { 1: '$ML$ מתאימה ל־$BC$.' } },
        { kind: 'predict', text: '$\\triangle ABC \\cong \\triangle NML$. איזו צלע שווה ל־$BC$?', fig: nmlFig, choices: ['$ML$', '$NM$', '$NL$'], answer: 0,
          why: '$B \\leftrightarrow M$ ו־$C \\leftrightarrow L$, ולכן $BC = ML$.', wrongWhy: { 1: '$NM$ מתאימה ל־$AB$.', 2: '$NL$ מתאימה ל־$AC$.' } },
      ] },
  ],
};

// ================================================================ stair 2: the congruence theorems

/** Two sides of 6 and 4 with 40° between them, the closing side dashed (no letters). */
const lockedFig: FigSpec = {
  type: 'geo', label: 'זווית של 40 מעלות, ועל שתי הקרניים שלה צלעות של 6 ושל 4. הצלע השלישית מקווקוות',
  pts: { _v: [0, 0], _p: [6, 0], _q: [4 * Math.cos(rad(40)), 4 * Math.sin(rad(40))] },
  segs: [{ a: '_v', b: '_p', label: '6' }, { a: '_v', b: '_q', label: '4' }, { a: '_p', b: '_q', dash: true }],
  angles: [{ at: '_v', from: '_p', to: '_q', text: '40°' }],
  view: [300, 170], pad: [28, 24],
} as FigSpec;
/** AB = 6, ∢A = 40°, BC = 4.5: the arc about B meets the ray from A at C₁ and C₂ (named, or with no letters). */
function ssaFig(named: boolean): FigSpec {
  const [c1, c2] = G.ssaPoints(6, 40, 4.5) as Pt[];
  const far: Pt = [7.6 * Math.cos(rad(40)), 7.6 * Math.sin(rad(40))];
  const A = named ? 'A' : '_a'; const B = named ? 'B' : '_b';
  return {
    type: 'geo', label: named ? 'הצלע AB שווה 6, ומ־A יוצאת קרן בזווית של 40 מעלות. קטע של 4.5 מ־B פוגש את הקרן בשתי נקודות, C1 ו־C2' : 'צלע של 6, קרן בזווית של 40 מעלות, וקטע של 4.5 שפוגש את הקרן בשתי נקודות',
    pts: { [A]: [0, 0], [B]: [6, 0], _c1: c1, _c2: c2, _r: far },
    segs: [{ a: A, b: B, label: '6' }, { a: B, b: '_c1', label: '4.5', dash: true, side: 'in' }, { a: B, b: '_c2', label: '4.5' }, { a: A, b: '_r', thin: true }],
    angles: [{ at: A, from: B, to: '_r', text: '40°' }],
    dots: ['_c1', '_c2'],
    ...(named ? { words: [{ at: '_c1', text: 'C₁', dx: -12, dy: -6 }, { at: '_c2', text: 'C₂', dx: -12, dy: -6 }] } : {}),
    view: [300, 200], pad: [28, 24],
  } as FigSpec;
}
/** Three small triangles: צ.ז.צ, ז.צ.ז and צ.צ.צ, each with its three parts marked. */
const theoremsFig: FigSpec = (() => {
  const apex = triFromAngles(62, 58, 2.4) as Pt;
  const pts: Record<string, Pt> = {};
  [0, 3.3, 6.6].forEach((x0, i) => { pts[`_l${i}`] = [x0, 0]; pts[`_r${i}`] = [x0 + 2.4, 0]; pts[`_t${i}`] = [x0 + apex[0], apex[1]]; });
  const ang = (i: number, at: 'l' | 'r', n: number) => G.innerAngle(pts, `_${at}${i}`, `_${at === 'l' ? 'r' : 'l'}${i}`, `_t${i}`, { n });
  return {
    type: 'geo', label: 'שלושה משולשים קטנים: בראשון שתי צלעות והזווית שביניהן, בשני שתי זוויות והצלע שביניהן, בשלישי שלוש צלעות',
    pts, polys: [0, 1, 2].map((i) => ({ pts: [`_l${i}`, `_r${i}`, `_t${i}`] })),
    segs: [
      { a: '_l0', b: '_r0', ticks: 1 }, { a: '_l0', b: '_t0', ticks: 2 },
      { a: '_l1', b: '_r1', ticks: 1 },
      { a: '_l2', b: '_r2', ticks: 1 }, { a: '_r2', b: '_t2', ticks: 2 }, { a: '_t2', b: '_l2', ticks: 3 },
    ],
    angles: [ang(0, 'l', 1), ang(1, 'l', 1), ang(1, 'r', 2)],
    words: [{ at: [1.2, -0.55], text: 'צ.ז.צ' }, { at: [4.5, -0.55], text: 'ז.צ.ז' }, { at: [7.8, -0.55], text: 'צ.צ.צ' }],
    view: [320, 150], pad: [20, 24],
  } as FigSpec;
})();
/** A small and a large triangle with the same three angles (no letters). */
const sizesFig: FigSpec = (() => {
  const a = triFromAngles(60, 45, 2.6) as Pt; const k = 1.7; const off = 3.8;
  const pts: Record<string, Pt> = { _a: [0, 0], _b: [2.6, 0], _c: a, _d: [off, 0], _e: [off + 2.6 * k, 0], _f: [off + a[0] * k, a[1] * k] };
  const at = (v: string, p: string, q: string, n: number) => G.innerAngle(pts, v, p, q, { n });
  return {
    type: 'geo', label: 'משולש קטן ומשולש גדול עם אותן שלוש זוויות',
    pts, polys: [{ pts: ['_a', '_b', '_c'] }, { pts: ['_d', '_e', '_f'] }],
    angles: [at('_a', '_b', '_c', 1), at('_b', '_a', '_c', 2), at('_c', '_a', '_b', 3), at('_d', '_e', '_f', 1), at('_e', '_d', '_f', 2), at('_f', '_d', '_e', 3)],
    view: [320, 170], pad: [24, 24],
  } as FigSpec;
})();
// step 6: ∢A = ∢D, ∢B = ∢E, BC = EF
const aasFig = two({ angs: { A: 50, B: 75, C: 55 }, partner: DEF, top: 'C', left: 'B', ticks: { BC: 1 }, marks: { A: { n: 1 }, D: { n: 1 }, B: { n: 2 }, E: { n: 2 } }, label: 'שני משולשים, ABC ו־DEF. הזוויות ב־A וב־D מסומנות שוות, וגם ב־B וב־E. הצלעות BC ו־EF מסומנות שוות' });
// step 8: AB = EF, BC = FD, CA = DE, ticks only
const ticksFig = two({ angs: { A: 75, B: 45, C: 60 }, partner: { A: 'E', B: 'F', C: 'D' }, top: 'C', left: 'B', ticks: TICKS3, label: 'שני משולשים, ABC ו־DEF, עם סימוני צלעות שוות: AB ו־EF בקו אחד, BC ו־FD בשניים, CA ו־DE בשלושה' });
const S2_TARGET: Pt[] = [[-4, 4], [-2, 1], [-6, 1]];

const congr2: DiagModel<P12> = {
  params: (rnd) => G.CONGR2.params(rnd),
  text: (p) => G.congr2Text(p),
  fig: (p) => G.congr2Fig(p),
  answer: (p) => G.CONGR2.answer(p),
  bugs: G.CONGR2.bugs,
  solution: (p) => G.congr2Solution(p),
  hint: (p) => G.congr2Hint(p),
};
const congr2T: DiagModel<P12> = {
  params: (rnd) => G.CONGR2T.params(rnd),
  text: (p) => G.congr2TText(p),
  fig: (p) => G.congr2TFig(p),
  answer: (p) => G.CONGR2T.answer(p),
  bugs: G.CONGR2T.bugs,
  solution: (p) => G.congr2TSolution(p),
  hint: () => 'כל פינה נמצאת על שתי גדרות. אילו גדרות שוות להן, ובאיזו פינה הן נפגשות?',
};

const stair2: StairContent = {
  skill: 'congr:2', topic: 'congr', level: 2, title: 'משפטי החפיפה',
  objectives: [
    'להכיר את שלושת משפטי החפיפה: צ.ז.צ, ז.צ.ז ו־צ.צ.צ, ולזהות לפי איזה מהם שני משולשים חופפים.',
    'לבדוק שהזווית כלואה בין שתי הצלעות (צ.ז.צ), ושהצלע כלואה בין שתי הזוויות (ז.צ.ז; את הזווית השלישית אפשר לחשב).',
    'לדעת מתי אין מספיק נתונים: שתי צלעות וזווית שלא ביניהן, שלוש זוויות, אותו היקף או אותו שטח; ולמצוא את ההתאמה מהנתונים.',
  ],
  idea: 'שלושה חלקים מתאימים, בסדר הנכון, קובעים משולש אחד בלבד: זה מה שמשפטי החפיפה אומרים.',
  why: [
    'שתי צלעות והזווית שביניהן "נועלות" את הצלע השלישית; אם הזווית לא ביניהן, הצלע יכולה "לנחות" בשני מקומות.',
    'שלוש זוויות קובעות צורה אבל לא גודל: משולש קטן וגדול עם אותן זוויות.',
  ],
  alt: ['במשולשים ישרי־זווית: אם ניצב ויתר שווים, פיתגורס נותן שגם הניצב השני שווה, ואז צ.צ.צ ("ניצב ויתר").'],
  discover: [
    { kind: 'say', text: 'כדי לבנות משולש לא צריך את כל שש המידות: לפעמים שלוש מספיקות. אילו שלוש? את זה נבדוק עכשיו.', fig: lockedFig },
    { kind: 'predict', text: 'נתונים $AB$, $BC$ ו־$\\sphericalangle A$, שאינה בין שתי הצלעות. כמה משולשים שונים אפשר לבנות?', fig: ssaFig(true),
      choices: ['שניים', 'אחד', 'אף אחד'], answer: 0,
      why: 'פותחים את המחוגה ל־$4.5$ ודוקרים ב־$B$: הקשת חותכת את הקרן מ־$A$ בשתי נקודות, $C_1$ ו־$C_2$. אלה שני משולשים שונים עם אותם נתונים.',
      wrongWhy: { 1: 'הקשת סביב $B$ חותכת את הקרן פעמיים: יש שני מקומות ל־$C$.', 2: 'הצלע $4.5$ מגיעה לקרן: הקשת חותכת אותה, ואפילו פעמיים.' } },
    { kind: 'rule', text: 'משפטי החפיפה: צ.ז.צ — שתי צלעות והזווית שביניהן; ז.צ.ז — שתי זוויות והצלע שביניהן; צ.צ.צ — שלוש צלעות. אם הם שווים בשני משולשים, המשולשים חופפים.',
      why: 'כל אחת משלוש האפשרויות קובעת משולש אחד בלבד.', fig: theoremsFig },
    { kind: 'predict', text: 'לשני המשולשים אותן שלוש זוויות. הם חופפים?', fig: sizesFig,
      choices: ['לא בהכרח', 'כן, לפי ז.צ.ז'], answer: 0,
      why: 'ז.צ.ז צריך גם צלע שווה. שלוש זוויות קובעות צורה, לא גודל.',
      wrongWhy: { 1: 'בז.צ.ז יש גם צלע שווה בין שתי הזוויות. כאן אין צלע: המשולש הגדול גדול יותר.' } },
    { kind: 'explore', text: 'הנתונים: $AB = DE$, $\\sphericalangle B = \\sphericalangle E$, $BC = EF$, שתי צלעות והזווית שביניהן. הניחו את $\\triangle DEF$ על $\\triangle ABC$ כך ש־$D$ על $A$, $E$ על $B$ ו־$F$ על $C$.',
      manip: tf([[4, -1], [2, -4], [6, -4]], ['D', 'E', 'F'], { drag: true, flips: ['y'] }, { pts: S2_TARGET, names: ['A', 'B', 'C'] }),
      answer: { pts: S2_TARGET },
      hint: '$\\triangle DEF$ הפוך, כמו במראה: קודם שיקוף, אחר כך הזזה.',
      success: 'הם מתלכדים בדיוק: צ.ז.צ.' },
    { kind: 'predict', text: '$\\sphericalangle A = \\sphericalangle D$, $\\sphericalangle B = \\sphericalangle E$, $BC = EF$. הצלע $BC$ אינה בין שתי הזוויות הנתונות. המשולשים חופפים?', fig: aasFig,
      choices: ['כן', 'לא', 'אי אפשר לדעת'], answer: 0,
      why: 'גם $\\sphericalangle C = \\sphericalangle F$, כי סכום הזוויות $180°$. עכשיו $BC$ כלואה בין $\\sphericalangle B$ ו־$\\sphericalangle C$: ז.צ.ז.',
      wrongWhy: { 1: 'אפשר לחשב את הזווית השלישית, ואז $BC$ כלואה בין שתי זוויות שוות: ז.צ.ז.', 2: 'הזווית השלישית שווה גם היא (סכום הזוויות $180°$), ואז יש ז.צ.ז.' } },
    { kind: 'rule', text: 'לפני שבוחרים משפט, בודקים: בצ.ז.צ הזווית בין שתי הצלעות; בז.צ.ז הצלע בין שתי הזוויות (אפשר לחשב קודם את הזווית השלישית). שתי צלעות וזווית שלא ביניהן אינן מספיקות.',
      why: 'רק אז החלקים קובעים משולש אחד.', fig: ssaFig(false) },
    { kind: 'predict', text: '$AB = EF$, $BC = FD$, $CA = DE$. לאיזה קודקוד מתאים $B$?', fig: ticksFig,
      choices: ['$F$', '$E$', '$D$'], answer: 0,
      why: '$B$ נמצא על $AB$ ועל $BC$. הצלעות השוות להן, $EF$ ו־$FD$, נפגשות ב־$F$.',
      wrongWhy: { 1: '$E$ שני באלף־בית, אבל הצלעות קובעות: $EF$ ו־$FD$ נפגשות ב־$F$.', 2: '$D$ נמצא על $FD$ ועל $DE$, שמתאימות ל־$BC$ ול־$CA$: הוא מתאים ל־$C$.' } },
  ],
  examples: [
    { problem: '$AB = DF$, $BC = DE$, $AC = EF$; $\\sphericalangle A = 55°$, $\\sphericalangle B = 85°$. מה $\\sphericalangle E$?',
      fig: two({ angs: { A: 55, B: 85, C: 40 }, partner: { A: 'F', B: 'D', C: 'E' }, top: 'B', left: 'C', ticks: TICKS3, marks: { A: { text: '55°' }, B: { text: '85°' }, E: { text: '?', target: true } }, label: 'שני משולשים, ABC ו־DEF, עם סימוני צלעות שוות. ב־A זווית של 55 מעלות, ב־B של 85, ב־E סימן שאלה' }),
      answer: 40, check: '180-55-85',
      steps: [
        { action: '$B$ על $AB$ ועל $BC$, ושתיהן נפגשות ב־$D$.', why: '$AB = DF$ ו־$BC = DE$: הצלעות השוות להן נפגשות ב־$D$.', result: 'B \\leftrightarrow D' },
        { action: 'וכך $A \\leftrightarrow F$, $C \\leftrightarrow E$.', why: 'כל קודקוד: איפה נפגשות הצלעות השוות לשתי הצלעות שלו.', result: '\\sphericalangle E = \\sphericalangle C' },
        { action: 'סכום הזוויות במשולש.', why: '$\\sphericalangle C$ משלימה את $55°$ ו־$85°$ ל־$180°$.', result: '180° - 55° - 85° = 40°', value: '180-55-85' },
      ] },
    { problem: '$AB = ED$, $AC = EF$, $\\sphericalangle A = \\sphericalangle E = 70°$, $\\sphericalangle B = 65°$. לפי איזה משפט המשולשים חופפים, ומה $\\sphericalangle F$?',
      fig: two({ angs: { A: 70, B: 65, C: 45 }, partner: { A: 'E', B: 'D', C: 'F' }, top: 'C', left: 'A', ticks: { AB: 1, CA: 2 }, marks: { A: { text: '70°' }, E: { text: '70°' }, B: { text: '65°' }, F: { text: '?', target: true } }, label: 'שני משולשים, ABC ו־DEF. AB ו־ED מסומנות שוות, וגם AC ו־EF. ב־A וב־E זוויות של 70 מעלות, ב־B של 65' }),
      answer: 45, check: '180-70-65',
      steps: [
        { action: 'שתי צלעות והזווית שביניהן: צ.ז.צ.', why: '$\\sphericalangle A$ בין $AB$ ל־$AC$, ו־$\\sphericalangle E$ בין $ED$ ל־$EF$.', result: '\\triangle ABC \\cong \\triangle EDF' },
        { action: '$C \\leftrightarrow F$.', why: '$AC = EF$ ו־$A \\leftrightarrow E$.', result: '\\sphericalangle F = \\sphericalangle C' },
        { action: 'סכום הזוויות במשולש.', why: '$\\sphericalangle C$ משלימה את $70°$ ו־$65°$ ל־$180°$.', result: '45°', value: '180-70-65' },
      ] },
  ],
  together: [
    { problem: '$\\sphericalangle A = \\sphericalangle D = 50°$, $AB = DE$, $\\sphericalangle B = \\sphericalangle E = 60°$. מה $\\sphericalangle F$?',
      fig: two({ angs: { A: 50, B: 60, C: 70 }, partner: DEF, top: 'B', left: 'C', ticks: { AB: 1 }, marks: { A: { text: '50°' }, D: { text: '50°' }, B: { text: '60°' }, E: { text: '60°' }, F: { text: '?', target: true } }, label: 'שני משולשים, ABC ו־DEF. ב־A וב־D זוויות של 50 מעלות, ב־B וב־E של 60, AB ו־DE מסומנות שוות' }),
      steps: [
        { prompt: 'לפי איזה משפט?', choices: [
          { text: 'ז.צ.ז', ok: true, feedback: '$AB$ כלואה בין $\\sphericalangle A$ ו־$\\sphericalangle B$.' },
          { text: 'צ.ז.צ', ok: false, feedback: 'יש כאן שתי זוויות וצלע אחת, לא שתי צלעות.' },
          { text: 'צ.צ.צ', ok: false, feedback: 'נתונה רק צלע אחת שווה.' },
        ], hints: ['כמה זוויות שוות נתונות?', '$AB$ בין $\\sphericalangle A$ ו־$\\sphericalangle B$.'], done: 'ז.צ.ז, ו־$F \\leftrightarrow C$.' },
      ],
      final: { prompt: 'מה $\\sphericalangle F$, במעלות?', answer: 70, check: '180-50-60', hints: ['$\\sphericalangle F = \\sphericalangle C$.', '$180° - 50° - 60°$.'] } },
    { problem: '$AB = QR$, $BC = RP$, $CA = PQ$, $\\sphericalangle A = 35°$, $\\sphericalangle C = 95°$. מה $\\sphericalangle R$?',
      fig: two({ angs: { A: 35, B: 50, C: 95 }, partner: { A: 'Q', B: 'R', C: 'P' }, top: 'A', left: 'B', ticks: TICKS3, marks: { A: { text: '35°' }, C: { text: '95°' }, R: { text: '?', target: true } }, label: 'שני משולשים, ABC ו־PQR, עם סימוני צלעות שוות. ב־A זווית של 35 מעלות, ב־C של 95, ב־R סימן שאלה' }),
      steps: [
        { prompt: 'לאיזה קודקוד מתאים $B$?', choices: [
          { text: '$R$', ok: true, feedback: '$B$ על $AB$ ועל $BC$, והצלעות השוות להן, $QR$ ו־$RP$, נפגשות ב־$R$.' },
          { text: '$Q$', ok: false, feedback: '$Q$ על $QR$ ועל $PQ$, שמתאימות ל־$AB$ ול־$CA$: הוא מתאים ל־$A$.' },
          { text: '$P$', ok: false, feedback: '$P$ על $RP$ ועל $PQ$, שמתאימות ל־$BC$ ול־$CA$: הוא מתאים ל־$C$.' },
        ], hints: ['$B$ על $AB$ ועל $BC$.', '$QR$ ו־$RP$ נפגשות ב־$R$.'], done: '$B \\leftrightarrow R$.' },
      ],
      final: { prompt: 'מה $\\sphericalangle R$, במעלות?', answer: 50, check: '180-35-95', hints: ['$\\sphericalangle R = \\sphericalangle B$.', '$180° - 35° - 95°$.'] } },
  ],
  diag: congr2,
  transfer: congr2T,
  words: ['משפט חפיפה', 'צ.ז.צ', 'ז.צ.ז', 'צ.צ.צ', 'כלואה', 'ניצב ויתר'],
  misconceptions: [
    { id: 'ssa', title: 'השתמשו בשתי צלעות ובזווית שאינה ביניהן כאילו זה משפט חפיפה',
      cause: '"שתי צלעות וזווית" נשמע כמו צ.ז.צ, ושוכחים לבדוק איפה הזווית.',
      explain: ['במשפט צ.ז.צ הזווית כלואה. כשהיא לא, יש לפעמים שני משולשים.'],
      remedy: [
        { kind: 'predict', text: 'נתונים $AB$, $BC$ ו־$\\sphericalangle A$, שאינה בין שתי הצלעות. כמה משולשים שונים אפשר לבנות?', fig: ssaFig(true),
          choices: ['שניים', 'אחד'], answer: 0, why: 'הקשת סביב $B$ חותכת את הקרן מ־$A$ פעמיים: $C_1$ ו־$C_2$.' },
        { kind: 'predict', text: '$AB = DE$, $BC = EF$. מה עוד צריך כדי שהמשולשים יהיו חופפים לפי צ.ז.צ?', fig: two({ angs: { A: 65, B: 50, C: 65 }, partner: DEF, top: 'A', left: 'B', ticks: { AB: 1, BC: 2 }, label: 'שני משולשים, ABC ו־DEF. AB ו־DE מסומנות שוות, וגם BC ו־EF' }),
          choices: ['$\\sphericalangle B = \\sphericalangle E$', '$\\sphericalangle A = \\sphericalangle D$', '$\\sphericalangle C = \\sphericalangle F$'], answer: 0,
          why: 'הצלעות $AB$ ו־$BC$ נפגשות ב־$B$: הזווית ביניהן היא $\\sphericalangle B$.',
          wrongWhy: { 1: '$\\sphericalangle A$ אינה בין $AB$ ל־$BC$: זה לא צ.ז.צ.', 2: '$\\sphericalangle C$ אינה בין $AB$ ל־$BC$: זה לא צ.ז.צ.' } },
      ] },
    { id: 'aaa', title: 'חשבו ששלוש זוויות שוות מספיקות לחפיפה',
      cause: 'שלוש זוויות שוות נראות כמו "אותו משולש".',
      explain: ['שלוש זוויות קובעות צורה, לא גודל: אפשר משולש קטן ומשולש גדול עם אותן זוויות.'],
      remedy: [
        { kind: 'predict', text: 'לשני המשולשים אותן שלוש זוויות. הם חופפים?', fig: sizesFig, choices: ['לא בהכרח', 'כן'], answer: 0,
          why: 'אחד גדול מהשני: אותה צורה, גודל אחר. כדי לחפוף צריך גם צלע שווה.' },
      ] },
    { id: 'alpha-order', title: 'התאימו קודקודים לפי סדר האלף־בית, ולא לפי הסדר שבחפיפה',
      cause: 'כשההתאמה לא כתובה, קל לקחת את סדר האלף־בית.',
      explain: ['ההתאמה נקראת מהצלעות השוות: קודקוד מתאים לנקודה שבה נפגשות הצלעות השוות לשתי הצלעות שלו.'],
      remedy: [
        { kind: 'predict', text: '$AB = EF$, $BC = FD$, $CA = DE$. לאיזה קודקוד מתאים $B$?', fig: ticksFig, choices: ['$F$', '$E$'], answer: 0,
          why: '$EF$ ו־$FD$ נפגשות ב־$F$.', wrongWhy: { 1: 'זה סדר האלף־בית. הצלעות השוות קובעות.' } },
        { kind: 'explore', text: 'הניחו את $\\triangle DEF$ על $\\triangle ABC$ כך ש־$D$ על $A$, $E$ על $B$ ו־$F$ על $C$.',
          manip: tf([[4, -1], [2, -4], [6, -4]], ['D', 'E', 'F'], { drag: true, flips: ['y'] }, { pts: S2_TARGET, names: ['A', 'B', 'C'] }),
          answer: { pts: S2_TARGET }, hint: 'שיקוף, ואחר כך הזזה.', success: 'כל צלע על הצלע השווה לה.' },
      ] },
    { id: 'one-angle', title: 'חיסרו מ־$180°$ רק זווית אחת',
      cause: 'ממהרים לסכום ושוכחים זווית.',
      explain: ['הזווית השלישית: $180°$ פחות שתי הזוויות הידועות.'],
      remedy: [
        { kind: 'predict', text: '$\\sphericalangle A = 50°$ ו־$\\sphericalangle B = 60°$. מה $\\sphericalangle C$?', fig: two({ angs: { A: 50, B: 60, C: 70 }, partner: DEF, top: 'B', left: 'C', marks: { A: { text: '50°' }, B: { text: '60°' } } }),
          choices: ['$70°$', '$130°$'], answer: 0, why: '$180° - 50° - 60° = 70°$.', wrongWhy: { 1: 'חיסרתם רק את $50°$.' } },
      ] },
    { id: 'wrong-pair', title: 'השוו חלקים שאינם מתאימים בחפיפה',
      cause: '"$180°$ פחות שתי הזוויות" נותן זווית שנראית כמו תשובה, אבל הזווית שמחפשים מתאימה לזווית שכבר כתובה.',
      explain: ['קודם מוצאים מהצלעות השוות לאיזה קודקוד מתאים כל קודקוד, ורק אחר כך משווים.'],
      remedy: [
        { kind: 'predict', text: '$AB = EF$, $BC = FD$, $CA = DE$. לאיזה קודקוד מתאים $B$?', fig: ticksFig, choices: ['$F$', '$D$'], answer: 0,
          why: '$EF$ ו־$FD$ נפגשות ב־$F$.', wrongWhy: { 1: '$D$ על $FD$ ועל $DE$: הוא מתאים ל־$C$.' } },
      ] },
  ],
};

// ================================================================ stair 3: a proof by congruence

const reasonOf = (s: any) => (s.fixed != null ? s.fixed : s.reason.choices[s.reason.answer]);
const rowsOf = (T: any) => T.steps.map((s: any) => ({ claim: s.text, reason: reasonOf(s) }));
const T1 = P.T1;
const T1_ROWS = rowsOf(T1);
const t1Table = (more: Record<string, unknown> = {}): FigSpec => ({ type: 'proof', given: T1.given, goal: T1.goal, rows: T1_ROWS, ...more } as FigSpec);
/** T1 with two reasons asked (the vertical angles and the theorem), in order: the conclusion's reason shown. */
const t1Fill = (() => {
  const m: any = proofManip(T1, { lockOrder: true });
  const steps = m.part.steps.map((s: any, i: number) => (i === 4 ? { text: s.text, fixed: reasonOf(s) } : s));
  return { ...m, part: { ...m.part, steps }, seed: 'T1:0:fill' } as ManipSpec;
})();
const t2Whole = proofManip(P.T2) as ManipSpec;
const t1Whole = proofManip(T1, { lockOrder: true }) as ManipSpec;
/** The SSA proof of findError, as a still table: row 4 says צ.ז.צ on data that are not. */
const ssaTable: FigSpec = {
  type: 'proof', given: 'במשולשים $ABC$ ו־$KLM$: $AB = KL$, $BC = LM$, $\\sphericalangle A = \\sphericalangle K$.', goal: '$AC = KM$',
  rows: [
    { claim: '$AB = KL$', reason: 'נתון' }, { claim: '$BC = LM$', reason: 'נתון' }, { claim: '$\\sphericalangle A = \\sphericalangle K$', reason: 'נתון' },
    { claim: '$\\triangle ABC \\cong \\triangle KLM$', reason: 'לפי צ.ז.צ' }, { claim: '$AC = KM$', reason: 'צלעות מתאימות במשולשים חופפים' },
  ],
} as FigSpec;

const congr3: DiagModel<P12> = {
  params: (rnd) => G.CONGR3.params(rnd),
  text: (p) => G.congr3Text(p),
  fig: (p) => G.congr3Fig(p),
  answer: (p) => G.CONGR3.answer(p),
  bugs: G.CONGR3.bugs,
  solution: (p) => G.congr3Solution(p),
  hint: (p) => G.congr3Hint(p),
};
const congr3T: DiagModel<P12> = {
  params: (rnd) => G.CONGR3T.params(rnd),
  text: (p) => G.congr3TText(p),
  fig: (p) => G.congr3TFig(p),
  answer: (p) => G.CONGR3T.answer(p),
  bugs: G.CONGR3T.bugs,
  solution: (p) => G.congr3TSolution(p),
  hint: () => 'האלכסון $AC$ משותף לשני המשולשים, ולכן הוא חוצה את זווית הראש ואת הזווית שמולה.',
};
const kite3525 = G.kiteFig(35, 25, { askD: true });
const perp62 = G.perpFig(62);
const cross2x = G.crossFig(70, 60, { C: { text: '(2x + 10)°' }, D: { text: '50°' }, B: { text: '70°' } });

const stair3: StairContent = {
  skill: 'congr:3', topic: 'congr', level: 3, title: 'הוכחה בחפיפה',
  objectives: [
    'לכתוב הוכחה בטבלה של טענה ונימוק: נתונים, חפיפה לפי משפט, ומסקנה מהחפיפה.',
    'למצוא את החלק השלישי לחפיפה: צלע משותפת, זוויות קודקודיות, זוויות מתחלפות בין מקבילים.',
    'להשתמש בחפיפה כדי למצוא זווית או צלע, גם בדלתון.',
  ],
  idea: 'הוכחה בחפיפה: מוצאים שלושה חלקים שווים לפי משפט, מסיקים שהמשולשים חופפים, ורק אז מסיקים שחלקים מתאימים נוספים שווים.',
  why: [
    'כל שורה בטבלה נשענת על שורות שכבר כתובות, ולכן רואים שאין קפיצות.',
    '"צלעות מתאימות במשולשים חופפים" מותר רק אחרי שורת החפיפה: לפני כן עוד לא ידוע שהם חופפים.',
  ],
  alt: ['דלתון: מרובע עם שני זוגות של צלעות סמוכות שוות. האלכסון הראשי שלו הוא צלע משותפת לשני משולשים חופפים (צ.צ.צ), ולכן הוא חוצה את זוויות הראש.'],
  discover: [
    { kind: 'say', text: 'הוכחה בחפיפה: מראים ששני משולשים חופפים לפי אחד המשפטים, ואז מסיקים שצלעות או זוויות מתאימות שוות. כותבים בטבלה: טענה ונימוק. כאן נתון: $AM = MB$, $CM = MD$. צ״ל: $AC = BD$.',
      fig: T1.fig },
    { kind: 'predict', text: 'מה הנימוק ל־$\\sphericalangle AMC = \\sphericalangle BMD$?', fig: T1.fig,
      choices: ['זוויות קודקודיות', 'זוויות מתחלפות בין ישרים מקבילים', 'נתון'], answer: 0,
      why: 'שני ישרים נחתכים ב־$M$, והזוויות שממול זו לזו קודקודיות, ולכן שוות.',
      wrongWhy: { 1: 'אין כאן ישרים מקבילים: הזוויות ב־$M$ נוצרות משני ישרים שנחתכים.', 2: 'זה לא כתוב בנתונים: צריך להסביר למה.' } },
    { kind: 'rule', text: 'כותבים: נתון ו־צ״ל. בטבלה — קודם הנתונים, אחר כך מה שמוסיפים (צלע משותפת, זוויות קודקודיות), אחר כך החפיפה ולפי איזה משפט, ובסוף המסקנה: "צלעות (או זוויות) מתאימות במשולשים חופפים".',
      why: 'כך כל טענה נשענת רק על מה שכבר הוכח.', fig: t1Table() },
    { kind: 'explore', text: 'השלימו את שני הנימוקים החסרים בהוכחה ש־$AC = BD$.', manip: t1Fill, answer: proofSolution(t1Fill),
      hint: 'שתי צלעות כבר נתונות. מה עוד שווה ב־$M$?',
      success: 'נתון, נתון, קודקודיות, צ.ז.צ, ואז המסקנה.' },
    { kind: 'predict', text: 'מישהו כתב בשורה הראשונה "$AC = BD$, צלעות מתאימות במשולשים חופפים", ורק אחר כך הוכיח את החפיפה. זה בסדר?',
      fig: t1Table({ rows: [T1_ROWS[4], ...T1_ROWS.slice(0, 4)], hl: 0 }),
      choices: ['לא: משתמשים בחפיפה לפני שהוכחנו אותה', 'כן, אם בסוף זה נכון'], answer: 0,
      why: 'בשורה הראשונה עוד לא ידוע שהמשולשים חופפים. מסקנה באה אחרי מה שמוכיח אותה.',
      wrongWhy: { 1: 'בהוכחה כל שורה נשענת רק על מה שכבר כתוב מעליה. בשורה הראשונה החפיפה עוד לא הוכחה.' } },
    { kind: 'rule', text: 'מסקנה מחפיפה באה רק אחרי שורת החפיפה, והנימוק שלה הוא "צלעות מתאימות במשולשים חופפים" או "זוויות מתאימות במשולשים חופפים".',
      why: 'החפיפה היא הסיבה; בלעדיה אין מסקנה.', fig: t1Table({ hl: 4 }) },
    { kind: 'predict', text: 'מה החלק השלישי לחפיפה של $\\triangle ABC$ ו־$\\triangle ADC$?', fig: P.T2.fig,
      choices: ['$AC$, צלע משותפת', '$\\sphericalangle B = \\sphericalangle D$', '$BD$'], answer: 0,
      why: '$AC$ שייכת לשני המשולשים, ולכן שווה לעצמה: צ.צ.צ.',
      wrongWhy: { 1: 'את זה רוצים להוכיח. אי אפשר להשתמש בו כנתון.', 2: '$BD$ אינה צלע של אף אחד מהמשולשים.' } },
    { kind: 'explore', text: 'הוכיחו ש־$\\sphericalangle B = \\sphericalangle D$ בדלתון.', manip: t2Whole, answer: proofSolution(t2Whole),
      hint: 'קודם שני הנתונים, אחר כך הצלע המשותפת, החפיפה, ובסוף הזוויות.',
      success: 'צ.צ.צ, ואז זוויות מתאימות במשולשים חופפים.' },
  ],
  examples: [
    { problem: '$AM = MB$, $CM = MD$, $\\sphericalangle CAM = 50°$, $\\sphericalangle AMC = 70°$. מה $\\sphericalangle MDB$?',
      fig: G.crossFig(50, 70, { A: { text: '50°' }, M: { text: '70°' }, D: { text: '?', target: true } }),
      answer: 60, check: '180-50-70',
      steps: [
        { action: '$\\sphericalangle AMC = \\sphericalangle BMD$', why: 'זוויות קודקודיות.', result: '\\sphericalangle BMD = 70°' },
        { action: '$\\triangle AMC \\cong \\triangle BMD$', why: 'לפי צ.ז.צ: $AM = MB$, הזווית ב־$M$, $CM = MD$.', result: '\\triangle AMC \\cong \\triangle BMD' },
        { action: '$\\sphericalangle MDB = \\sphericalangle MCA$', why: 'זוויות מתאימות במשולשים חופפים.', result: '\\sphericalangle MDB = \\sphericalangle MCA' },
        { action: 'סכום הזוויות ב־$\\triangle AMC$.', why: '$\\sphericalangle MCA$ משלימה את $50°$ ו־$70°$ ל־$180°$.', result: '180° - 50° - 70° = 60°', value: '180-50-70' },
      ] },
    { problem: 'בדלתון $ABCD$: $AB = AD$, $CB = CD$, $\\sphericalangle BAC = 35°$, $\\sphericalangle BCA = 25°$. מה $\\sphericalangle ADC$?', fig: kite3525,
      answer: 120, check: '180-35-25',
      steps: [
        { action: '$AC$ צלע משותפת.', why: 'היא צלע של שני המשולשים.', result: 'AC = AC' },
        { action: '$\\triangle ABC \\cong \\triangle ADC$', why: 'לפי צ.צ.צ: $AB = AD$, $CB = CD$, $AC = AC$.', result: '\\triangle ABC \\cong \\triangle ADC' },
        { action: '$\\sphericalangle ADC = \\sphericalangle ABC$', why: 'זוויות מתאימות במשולשים חופפים.', result: '\\sphericalangle ADC = \\sphericalangle ABC' },
        { action: 'סכום הזוויות ב־$\\triangle ABC$.', why: '$\\sphericalangle ABC$ משלימה את $35°$ ו־$25°$ ל־$180°$.', result: '180° - 35° - 25° = 120°', value: '180-35-25' },
      ] },
  ],
  together: [
    { problem: '$CD \\perp AB$, $D$ אמצע $AB$, $\\sphericalangle CAD = 62°$. מה $\\sphericalangle ACB$?', fig: perp62,
      steps: [
        { prompt: 'לפי איזה משפט $\\triangle ADC \\cong \\triangle BDC$?', choices: [
          { text: 'צ.ז.צ', ok: true, feedback: '$AD = DB$, הזווית הישרה ב־$D$, ו־$CD$ משותפת.' },
          { text: 'צ.צ.צ', ok: false, feedback: 'לא נתון ש־$AC = BC$; את זה מקבלים מהחפיפה.' },
          { text: 'ז.צ.ז', ok: false, feedback: 'ידועה רק זווית אחת שווה, הזווית הישרה ב־$D$. יש כאן שתי צלעות והזווית שביניהן.' },
        ], hints: ['$AD = DB$, הזווית הישרה, ו־$CD$ משותפת.', '$\\sphericalangle ACD = \\sphericalangle BCD = 90° - 62°$.'], done: 'צ.ז.צ, ולכן $\\sphericalangle ACD = \\sphericalangle BCD$.' },
      ],
      final: { prompt: 'מה $\\sphericalangle ACB$, במעלות?', answer: 56, check: '180-2*62', hints: ['$\\sphericalangle ACD = 90° - 62° = 28°$.', '$\\sphericalangle ACB$ בנויה משתי זוויות של $28°$.'] } },
    { problem: '$AM = MB$, $CM = MD$. $\\sphericalangle ACM = (2x + 10)°$, $\\sphericalangle MDB = 50°$, $\\sphericalangle MBD = 70°$. מה $x$?', fig: cross2x,
      steps: [
        { prompt: 'לאיזו זווית שווה $\\sphericalangle ACM$?', choices: [
          { text: '$\\sphericalangle MDB$', ok: true, feedback: '$\\triangle AMC \\cong \\triangle BMD$: $C$ מתאים ל־$D$.' },
          { text: '$\\sphericalangle MBD$', ok: false, feedback: '$B$ מתאים ל־$A$, לא ל־$C$.' },
          { text: '$\\sphericalangle BMD$', ok: false, feedback: '$\\sphericalangle BMD$ מתאימה ל־$\\sphericalangle AMC$, הזווית ב־$M$.' },
        ], hints: ['$\\triangle AMC \\cong \\triangle BMD$: $A \\leftrightarrow B$, $C \\leftrightarrow D$.', '$2x + 10 = 50$.'], done: '$\\sphericalangle ACM = \\sphericalangle MDB$.' },
      ],
      final: { prompt: 'מה $x$?', answer: 20, check: '(50-10)/2', hints: ['$\\triangle AMC \\cong \\triangle BMD$: $A \\leftrightarrow B$, $C \\leftrightarrow D$.', '$2x + 10 = 50$.'] } },
  ],
  diag: congr3,
  transfer: congr3T,
  words: ['טענה', 'נימוק', 'נתון', 'צ״ל', 'צלע משותפת', 'זוויות קודקודיות', 'דלתון', 'אלכסון ראשי'],
  misconceptions: [
    { id: 'wrong-pair', title: 'השוו חלקים שאינם מתאימים בחפיפה',
      cause: 'בשרטוט עם שני משולשים צמודים קל לקחת זווית של המשולש השני שאינה מתאימה.',
      explain: ['כותבים את החפיפה לפי סדר הקודקודים, ואז קוראים ממנה: $\\triangle AMC \\cong \\triangle BMD$ אומר $C \\leftrightarrow D$.'],
      remedy: [
        { kind: 'predict', text: '$AM = MB$, $CM = MD$. לאיזו זווית שווה $\\sphericalangle ACM$?', fig: cross2x,
          choices: ['$\\sphericalangle MDB$', '$\\sphericalangle MBD$', '$\\sphericalangle BMD$'], answer: 0,
          why: '$\\triangle AMC \\cong \\triangle BMD$: $C$ מתאים ל־$D$.', wrongWhy: { 1: '$B$ מתאים ל־$A$, לא ל־$C$.', 2: 'זו הזווית ב־$M$, שמתאימה ל־$\\sphericalangle AMC$.' } },
        { kind: 'explore', text: 'השלימו את הנימוקים בהוכחה ש־$AC = BD$.', manip: t1Whole, answer: proofSolution(t1Whole),
          hint: 'אחרי שתי שורות הנתונים: מה שווה ב־$M$? לפי איזה משפט? ומה נובע מהחפיפה?', success: 'מהחפיפה $\\triangle AMC \\cong \\triangle BMD$: $AC = BD$, צלעות מתאימות.' },
      ] },
    { id: 'one-angle', title: 'חיסרו מ־$180°$ רק זווית אחת',
      cause: 'ממהרים לסכום ושוכחים זווית.',
      explain: ['בכל משולש: $180°$ פחות שתי הזוויות הידועות.'],
      remedy: [
        { kind: 'predict', text: 'בדלתון $ABCD$: $\\sphericalangle BAC = 35°$, $\\sphericalangle BCA = 25°$. מה $\\sphericalangle ADC$?', fig: kite3525,
          choices: ['$120°$', '$145°$'], answer: 0, why: '$\\sphericalangle ADC = \\sphericalangle ABC = 180° - 35° - 25° = 120°$.', wrongWhy: { 1: 'חיסרתם רק את $35°$.' } },
      ] },
    { id: 'half-only', title: 'מצאו את הזווית של משולש אחד, ולא של שני המשולשים יחד',
      cause: 'רואים משולש אחד ושוכחים שהזווית בנויה משני חלקים.',
      explain: ['$\\sphericalangle ACB$ = שתי הזוויות ליד $C$: אחת בכל משולש.'],
      remedy: [
        { kind: 'predict', text: '$CD \\perp AB$, $D$ אמצע $AB$, $\\sphericalangle CAD = 62°$. מה $\\sphericalangle ACB$?', fig: perp62,
          choices: ['$56°$', '$28°$'], answer: 0, why: 'בכל משולש הזווית ליד $C$ היא $28°$, ו־$\\sphericalangle ACB$ בנויה משתיהן: $56°$.',
          wrongWhy: { 1: '$28°$ היא רק החצי שב־$\\triangle ADC$.' } },
      ] },
    { id: 'circular', title: 'השתמשו במה שצריך להוכיח כאילו הוא כבר ידוע',
      cause: 'המסקנה מוכרת מהשאלה ("הוכיחו ש..."), ונכתבת ראשונה.',
      explain: ['מה שצריך להוכיח מופיע רק בשורה האחרונה, אחרי שורת החפיפה.'],
      remedy: [
        { kind: 'predict', text: 'מישהו כתב בשורה הראשונה "$AC = BD$, צלעות מתאימות במשולשים חופפים", ורק אחר כך הוכיח את החפיפה. זה בסדר?',
          fig: t1Table({ rows: [T1_ROWS[4], ...T1_ROWS.slice(0, 4)], hl: 0 }),
          choices: ['לא: משתמשים בחפיפה לפני שהוכחנו אותה', 'כן, אם בסוף זה נכון'], answer: 0,
          why: 'בשורה הראשונה עוד לא ידוע שהמשולשים חופפים.' },
      ] },
    { id: 'ssa', title: 'השתמשו בשתי צלעות ובזווית שאינה ביניהן כאילו זה משפט חפיפה',
      cause: '"שתי צלעות וזווית" נשמע כמו צ.ז.צ, ושוכחים לבדוק איפה הזווית.',
      explain: ['בצ.ז.צ הזווית כלואה בין שתי הצלעות. אחרת יש לפעמים שני משולשים שונים עם אותם נתונים.'],
      remedy: [
        { kind: 'predict', text: 'נתונים $AB$, $BC$ ו־$\\sphericalangle A$, שאינה בין שתי הצלעות. כמה משולשים שונים אפשר לבנות?', fig: ssaFig(true),
          choices: ['שניים', 'אחד'], answer: 0, why: 'הקשת סביב $B$ חותכת את הקרן מ־$A$ פעמיים: $C_1$ ו־$C_2$.' },
        { kind: 'predict', text: 'איזו שורה בהוכחה שגויה?', fig: ssaTable, choices: ['שורה 4', 'שורה 5', 'אין שורה שגויה'], answer: 0,
          why: 'בשורה 4 כתוב צ.ז.צ, אבל $\\sphericalangle A$ אינה בין $AB$ ל־$BC$. שתי צלעות וזווית שאינה ביניהן לא מספיקות.',
          wrongWhy: { 1: 'שורה 5 נכונה אם החפיפה נכונה. הבעיה לפניה, בשורת החפיפה.', 2: 'בדקו את שורת החפיפה: איפה הזווית ביחס לשתי הצלעות?' } },
      ] },
    { id: 'no-half', title: 'לקחו את כל הזווית במקום חצי ממנה',
      cause: 'האלכסון חוצה את הזווית, אבל בחישוב נכנסה הזווית כולה.',
      explain: ['בדלתון האלכסון הראשי חוצה את זווית הראש: במשולש אחד נמצא רק חצי ממנה.'],
      remedy: [
        { kind: 'predict', text: 'לעפיפון צורה של דלתון $ABCD$: $\\sphericalangle BAD = 70°$, $\\sphericalangle BCD = 50°$. מה $\\sphericalangle ABC$?', fig: G.congr3TFig({ a: 35, c: 25 }),
          choices: ['$120°$', '$60°$'], answer: 0, why: 'ב־$\\triangle ABC$ רק החצאים: $35°$ ו־$25°$. $180° - 35° - 25° = 120°$.',
          wrongWhy: { 1: 'חיסרתם את הזוויות השלמות, $70°$ ו־$50°$. ב־$\\triangle ABC$ יש רק חצי מכל אחת.' } },
      ] },
  ],
};

// ================================================================ stair 4: the median and the areas

/** A triangle drawn from its three sides AB = p, AC = q, BC = r, with D the middle of BC (C on the left). */
function sidesTriangle(p: number, q: number, r: number): Record<string, Pt> {
  const ax = (q * q - p * p + r * r) / (2 * r); const ay = Math.sqrt(q * q - ax * ax);
  return { C: [0, 0], B: [r, 0], A: [ax, ay], D: [r / 2, 0] };
}
const medianOnly = (pts: Record<string, Pt>, label: string, more: Record<string, unknown> = {}): FigSpec => ({
  type: 'geo', label, pts, polys: [{ pts: ['A', 'B', 'C'] }],
  segs: [{ a: 'A', b: 'D' }, { a: 'C', b: 'D', ticks: 1 }, { a: 'D', b: 'B', ticks: 1 }], view: [300, 190], pad: [28, 26], ...more,
} as FigSpec);
// step 2: A median, an altitude and a bisector from A (∢A = 75°, ∢B = 70°, ∢C = 35°: the feet 0.7 and 1 apart)
const threeSegs = (named: boolean): FigSpec => {
  const A = triFromAngles(35, 70, 6) as Pt;
  const AB = Math.hypot(A[0] - 6, A[1]); const AC = Math.hypot(A[0], A[1]);
  const pts: Record<string, Pt> = { A, B: [6, 0], C: [0, 0], H: [A[0], 0], M: [3, 0], K: [(6 * AC) / (AB + AC), 0] };
  const f = {
    type: 'geo', label: named ? 'משולש ABC ושלושה קטעים מ־A ל־BC: AH מאונך ל־BC, AK חוצה את הזווית A, ו־M אמצע BC' : 'משולש ושלושה קטעים מהקודקוד העליון: גובה, חוצה זווית ותיכון',
    pts, polys: [{ pts: ['A', 'B', 'C'] }],
    segs: [{ a: 'A', b: 'H' }, { a: 'A', b: 'K' }, { a: 'A', b: 'M' }, { a: 'C', b: 'M', ticks: 1 }, { a: 'M', b: 'B', ticks: 1 }],
    angles: [{ at: 'H', from: 'B', to: 'A', right: true }, G.innerAngle(pts, 'A', 'C', 'K', { n: 1, r: 34 }), G.innerAngle(pts, 'A', 'K', 'B', { n: 1, r: 34 })],
    view: [320, 210], pad: [28, 26],
  };
  return named ? (f as FigSpec) : unnamed(f);
};
const median10 = G.medianFig({ b: 10, h: 6, t: 8 }, { labels: { AH: '6', AD: '10' } });
const halves10: FigSpec = (() => {
  const f = G.medianFig({ b: 10, h: 6, t: 8 }, { label: 'משולש ABC והתיכון AD: שני החצאים ABD ו־ADC צבועים באותו צבע' });
  return { ...f, polys: [{ pts: ['A', 'B', 'D'] }, { pts: ['A', 'D', 'C'] }], segs: f.segs.filter((s: any) => s.a !== 'B' && s.b !== 'H'), angles: [], hide: ['H'] } as FigSpec;
})();
const scalene = medianOnly(sidesTriangle(8, 5, 9), 'משולש ABC עם AB ארוכה מ־AC, והתיכון AD');
const plus3 = medianOnly(sidesTriangle(8, 5, 9), 'משולש ABC והתיכון AD. על AB כתוב AC ועוד 3', { segs: [{ a: 'A', b: 'D' }, { a: 'C', b: 'D', ticks: 1 }, { a: 'D', b: 'B', ticks: 1 }, { a: 'A', b: 'B', label: 'AC + 3' }] });

type P4 = Record<string, any>;
const congr4: DiagModel<P4> = {
  params: (rnd) => G.CONGR4.params(rnd),
  text: (p) => G.congr4Text(p),
  fig: (p) => G.congr4Fig(p),
  answer: (p) => G.CONGR4.answer(p),
  bugs: G.CONGR4.bugs,
  solution: (p) => G.congr4Solution(p),
  hint: (p) => G.congr4Hint(p),
};
const congr4T: DiagModel<P4> = {
  params: (rnd) => G.CONGR4T.params(rnd),
  text: (p) => G.congr4TText(p),
  fig: (p) => G.congr4TFig(p),
  answer: (p) => G.CONGR4T.answer(p),
  bugs: G.CONGR4T.bugs,
  solution: (p) => G.congr4TSolution(p),
  hint: () => 'השביל מגיע לאמצע הגדר: לכל חלק חצי מהגדר, ואותו מרחק מ־$A$.',
};
const rect86: FigSpec = {
  type: 'geo', label: 'מלבן ABCD והתיכון AE לאמצע BC', pts: { A: [6, 8], B: [6, 0], C: [0, 0], D: [0, 8], E: [3, 0] }, polys: [{ pts: ['A', 'B', 'C', 'D'] }],
  segs: [{ a: 'A', b: 'B', label: '8' }, { a: 'C', b: 'B', label: '6' }, { a: 'A', b: 'E' }, { a: 'C', b: 'E', ticks: 1 }, { a: 'E', b: 'B', ticks: 1 }],
  angles: [{ at: 'B', from: 'A', to: 'C', right: true }], view: [260, 220], pad: [28, 26],
} as FigSpec;
const ex2Fig: FigSpec = {
  type: 'geo', label: 'משולש ABC והתיכון AD לאמצע BC', pts: sidesTriangle(11, 7, 14), polys: [{ pts: ['A', 'B', 'C'] }],
  segs: [{ a: 'A', b: 'B', label: '11' }, { a: 'A', b: 'C', label: '7' }, { a: 'C', b: 'D', ticks: 1 }, { a: 'D', b: 'B', ticks: 1 }, { a: 'A', b: 'D', label: '6' }, { a: 'C', b: 'B', label: '14', side: 'in', thin: true }],
  view: [320, 200], pad: [28, 26],
} as FigSpec;

const stair4: StairContent = {
  skill: 'congr:4', topic: 'congr', level: 4, title: 'תיכון ושטחים',
  objectives: [
    'לזהות תיכון: קטע מקודקוד לאמצע הצלע שמולו, ולהבדיל בינו לבין גובה וחוצה זווית.',
    'להסביר למה תיכון מחלק משולש לשני משולשים שווי שטח: בסיסים שווים וגובה משותף.',
    'לחשב בעזרת תיכון אורכים, היקפים ושטחים.',
  ],
  idea: 'תיכון חוצה את הצלע שמולו, ולכן מחלק את המשולש לשני משולשים עם בסיסים שווים ואותו גובה: שווי שטח.',
  why: [
    'שטח משולש הוא בסיס כפול גובה לחלק ל־$2$; לשני החלקים חצי בסיס ואותו גובה.',
    'שטח שווה אינו חפיפה: אם $AB \\ne AC$, ההיקפים של שני החלקים שונים.',
  ],
  alt: ['חלקה משולשת שמחולקת בשביל מהקודקוד לאמצע הגדר שמולו: לשני השכנים אותו שטח, גם אם הצורות שונות.'],
  discover: [
    { kind: 'say', text: 'תיכון במשולש הוא קטע מקודקוד לאמצע הצלע שמולו: כאן $AD$ הוא התיכון לצלע $BC$.', fig: medianOnly(sidesTriangle(7, 5, 8), 'משולש ABC והתיכון AD: BD ו־DC מסומנים שווים') },
    { kind: 'predict', text: 'מ־$A$ יוצאים אל $BC$ שלושה קטעים: $AH$, $AK$ ו־$AM$. איזה מהם הוא התיכון?', fig: threeSegs(true),
      choices: ['$AM$', '$AH$', '$AK$'], answer: 0,
      why: 'רק $M$ היא אמצע $BC$: $BM = MC$. $AH$ מאונך ל־$BC$, ו־$AK$ חוצה את הזווית.',
      wrongWhy: { 1: '$AH$ מאונך ל־$BC$: הוא הגובה.', 2: '$AK$ מחלק את הזווית ב־$A$ לשתי זוויות שוות: הוא חוצה הזווית.' } },
    { kind: 'rule', text: 'תיכון חוצה צלע; גובה מאונך לצלע; חוצה זווית חוצה זווית. במשולש שאינו שווה־שוקיים אלה שלושה קטעים שונים.',
      why: 'כל אחד מוגדר על ידי דבר אחר: אמצע, זווית ישרה, חצי זווית.', fig: threeSegs(false) },
    { kind: 'predict', text: '$BC = 10$, הגובה $AH = 6$, והתיכון $AD = 10$. מה שטח $\\triangle ABD$?', fig: median10,
      choices: ['$15$', '$30$', '$25$'], answer: 0,
      why: 'ל־$\\triangle ABD$ בסיס $BD = 5$ וגובה $AH = 6$: $\\frac{5 \\cdot 6}{2} = 15$.',
      wrongWhy: { 1: '$30$ הוא שטח כל המשולש.', 2: '$AD$ אינו הגובה: הגובה מאונך לבסיס, והוא $AH$.' } },
    { kind: 'rule', text: 'תיכון מחלק משולש לשני משולשים שווי שטח.', display: 'S_{\\triangle ABD} = S_{\\triangle ADC} = \\frac{1}{2} S_{\\triangle ABC}',
      why: '$BD = DC$, והגובה מ־$A$ משותף.', fig: halves10 },
    { kind: 'predict', text: '$AD$ תיכון ב־$\\triangle ABC$. הוא מחלק את המשולש לשני משולשים חופפים?', fig: scalene,
      choices: ['לא בהכרח: השטחים שווים, הצורות לא', 'כן'], answer: 0,
      why: 'אם $AB \\ne AC$, ההיקפים של שני המשולשים שונים, ולכן הם לא חופפים.',
      wrongWhy: { 1: 'הבסיסים שווים והגובה משותף, ולכן השטחים שווים. אבל $AB$ ו־$AC$ שונות, ולכן הצורות שונות.' } },
    { kind: 'predict', text: '$AD$ תיכון, ו־$AB$ ארוכה מ־$AC$ ב־$3$. בכמה גדול ההיקף של $\\triangle ABD$ מההיקף של $\\triangle ADC$?', fig: plus3,
      choices: ['$3$', '$0$', '$6$'], answer: 0,
      why: '$BD = DC$ ו־$AD$ משותף, ולכן ההבדל הוא רק $AB - AC = 3$.',
      wrongWhy: { 1: 'השטחים שווים, לא ההיקפים: $AB$ ארוכה מ־$AC$.', 2: '$AD$ משותף ו־$BD = DC$: רק $AB$ ו־$AC$ שונות, ב־$3$.' } },
    { kind: 'rule', text: 'בתיכון: הצלע מתחלקת לשניים, השטח מתחלק לשניים, אבל ההיקפים שונים כשהצלעות האחרות שונות.',
      why: 'השטח תלוי בבסיס ובגובה, וההיקף בכל הצלעות.', fig: unnamed(plus3) },
  ],
  examples: [
    { problem: '$BC = 14$, $AH = 8$ (הגובה), $AD = 10$ (התיכון). מה שטח $\\triangle ABD$?',
      fig: G.medianFig({ b: 14, h: 8, t: 6 }, { labels: { AH: '8', AD: '10' } }), answer: 28, check: '14*8/4',
      steps: [
        { action: '$BD = 7$', why: '$D$ אמצע $BC$.', result: '14 : 2 = 7', calc: { expr: '14/2', value: 7 } },
        { action: 'הגובה $AH$, לא $AD$.', why: 'הגובה מאונך לבסיס; התיכון לא.', result: 'AH = 8' },
        { action: 'שטח המשולש.', why: 'בסיס כפול גובה, לחלק ל־$2$.', result: '\\frac{7 \\cdot 8}{2} = 28', value: '7*8/2' },
      ] },
    { problem: '$AD$ תיכון לצלע $BC$. $AB = 11$, $AC = 7$, $BC = 14$, $AD = 6$. מה ההיקף של $\\triangle ABD$?', fig: ex2Fig,
      answer: 24, check: '11+14/2+6',
      steps: [
        { action: '$BD = 7$', why: '$D$ אמצע $BC$: ל־$\\triangle ABD$ רק חצי מ־$BC$.', result: '14 : 2 = 7', calc: { expr: '14/2', value: 7 } },
        { action: 'מחברים את שלוש הצלעות.', why: '$AB$, $BD$ ו־$AD$.', result: '11 + 7 + 6 = 24', value: '11+7+6' },
      ] },
  ],
  together: [
    { problem: 'במלבן $ABCD$: $AB = 8$, $BC = 6$. $AE$ תיכון ב־$\\triangle ABC$ לצלע $BC$. מה שטח $\\triangle ABE$?', fig: rect86,
      steps: [
        { prompt: 'מה הבסיס $BE$?', choices: [
          { text: '$3$', ok: true, feedback: '$E$ אמצע $BC = 6$.' },
          { text: '$6$', ok: false, feedback: '$E$ אמצע $BC$: $BE$ הוא חצי מ־$6$.' },
          { text: '$4$', ok: false, feedback: '$4$ הוא חצי מ־$AB$. $E$ אמצע $BC$.' },
        ], hints: ['$E$ אמצע $BC = 6$.', '$\\frac{8 \\cdot 3}{2}$.'], done: '$BE = 3$, והגובה $AB = 8$.' },
      ],
      final: { prompt: 'מה שטח $\\triangle ABE$?', answer: 12, check: '8*3/2', hints: ['$E$ אמצע $BC = 6$.', '$\\frac{8 \\cdot 3}{2}$.'] } },
    { problem: '$AD$ תיכון לצלע $BC$. $BC = 12$, $AD = 13$, ושטח $\\triangle ADC$ הוא $15$. מה אורך הגובה $AH$?',
      fig: G.medianFig({ b: 12, h: 5, t: 12 }, { labels: { AD: '13', AH: '?' } }),
      steps: [
        { prompt: 'מה הבסיס של $\\triangle ADC$ על $BC$?', choices: [
          { text: '$DC = 6$', ok: true, feedback: '$D$ אמצע $BC$.' },
          { text: '$BC = 12$', ok: false, feedback: '$BC$ הוא הבסיס של כל המשולש; ל־$\\triangle ADC$ רק חצי ממנו.' },
          { text: '$AD = 13$', ok: false, feedback: '$AD$ הוא התיכון, צלע של המשולש, ולא הבסיס על $BC$.' },
        ], hints: ['$D$ אמצע $BC$.', '$\\frac{6 \\cdot AH}{2} = 15$.'], done: 'הבסיס $DC = 6$.' },
      ],
      final: { prompt: 'מה אורך הגובה $AH$?', answer: 5, check: '2*15/6', hints: ['$D$ אמצע $BC$.', '$\\frac{6 \\cdot AH}{2} = 15$.'] } },
  ],
  diag: congr4,
  transfer: congr4T,
  words: ['תיכון', 'אמצע צלע', 'גובה', 'חוצה זווית', 'שווי שטח'],
  misconceptions: [
    { id: 'median-as-height', title: 'השתמשו בתיכון כאילו הוא הגובה',
      cause: 'הגובה "הרגיל" נראה כמו קטע מהקודקוד למטה, וכל קטע כזה נראה גובה (דמות אב־טיפוס).',
      explain: ['גובה מאונך לבסיס. תיכון מגיע לאמצע הבסיס, ובדרך כלל אינו מאונך לו.'],
      remedy: [
        { kind: 'predict', text: '$BC = 10$, הגובה $AH = 6$, והתיכון $AD = 10$. מה שטח $\\triangle ABD$?', fig: median10,
          choices: ['$15$', '$25$'], answer: 0, why: 'הגובה הוא $AH = 6$: $\\frac{5 \\cdot 6}{2} = 15$.', wrongWhy: { 1: 'לקחתם את $AD$ כגובה. $AD$ לא מאונך ל־$BC$.' } },
      ] },
    { id: 'full-base', title: 'לקחו את כל הצלע כבסיס של חצי המשולש',
      cause: 'הצלע $BC$ כתובה בשאלה, וקל לשכוח שלחצי המשולש רק חצי ממנה.',
      explain: ['לכל אחד מהמשולשים שהתיכון יוצר בסיס של חצי $BC$.'],
      remedy: [
        { kind: 'predict', text: 'במלבן $ABCD$: $AB = 8$, $BC = 6$. $AE$ תיכון ב־$\\triangle ABC$ לצלע $BC$. מה הבסיס $BE$?', fig: rect86,
          choices: ['$3$', '$6$'], answer: 0, why: '$E$ אמצע $BC$: $BE = 3$.', wrongWhy: { 1: '$6$ הוא כל $BC$. ל־$\\triangle ABE$ רק החצי.' } },
      ] },
    { id: 'median-congruent', title: 'חשבו שתיכון מחלק משולש לשני משולשים חופפים',
      cause: 'שני החלקים שווי שטח, וזה נראה כמו "אותו משולש".',
      explain: ['שטח שווה אינו חפיפה: אם $AB \\ne AC$, הצלעות של שני החלקים שונות.'],
      remedy: [
        { kind: 'predict', text: '$AD$ תיכון ב־$\\triangle ABC$. הוא מחלק את המשולש לשני משולשים חופפים?', fig: scalene,
          choices: ['לא בהכרח: השטחים שווים, הצורות לא', 'כן'], answer: 0, why: 'אם $AB \\ne AC$, ההיקפים שונים, ולכן הם לא חופפים.' },
      ] },
    { id: 'median-altitude', title: 'בלבלו בין תיכון, גובה וחוצה זווית',
      cause: 'שלושתם יוצאים מקודקוד אל הצלע שמולו, ובמשולש שווה־שוקיים הם אותו קטע.',
      explain: ['תיכון: לאמצע הצלע. גובה: מאונך לצלע. חוצה זווית: מחלק את הזווית לשתיים.'],
      remedy: [
        { kind: 'predict', text: 'מ־$A$ יוצאים אל $BC$ שלושה קטעים: $AH$, $AK$ ו־$AM$. איזה מהם הוא התיכון?', fig: threeSegs(true),
          choices: ['$AM$', '$AH$', '$AK$'], answer: 0, why: '$M$ אמצע $BC$. $AH$ הוא הגובה, $AK$ חוצה הזווית.' },
      ] },
    { id: 'full-side', title: 'חיברו את כל הצלע במקום את החצי שלה',
      cause: 'בהיקף מחברים צלעות, ו־$BC$ כתובה בשאלה כולה.',
      explain: ['ל־$\\triangle ABD$ רק החצי $BD$ של $BC$.'],
      remedy: [
        { kind: 'predict', text: '$AD$ תיכון לצלע $BC$, $BC = 14$. מה האורך של $BD$, הצלע של $\\triangle ABD$ שעל $BC$?', fig: { ...ex2Fig, segs: [{ a: 'C', b: 'D', ticks: 1 }, { a: 'D', b: 'B', ticks: 1 }, { a: 'A', b: 'D' }, { a: 'C', b: 'B', label: '14', side: 'in', thin: true }] } as FigSpec,
          choices: ['$7$', '$14$'], answer: 0, why: '$D$ אמצע $BC$: $BD = 7$.', wrongWhy: { 1: '$14$ הוא כל $BC$. ל־$\\triangle ABD$ רק החצי.' } },
      ] },
  ],
};

export const CONGR: StairContent[] = [stair1, stair2, stair3, stair4];
/** Names of misconceptions new to this topic: none beyond the topic's own (content/congr.js names them all). */
export const CATS_CONGR: Record<string, string> = {};
export { congr1, congr1T, congr2, congr2T, congr3, congr3T, congr4, congr4T };
