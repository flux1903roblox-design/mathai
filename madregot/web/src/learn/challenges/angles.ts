// Challenge tasks of angles (curriculum stage 1, CURRICULUM-6.5): angles:c1, the proof that a triangle's angles add up
// to 180°, put in order with the reason for each step; angles:c2, a claim about two right angles in a triangle;
// angles:c3, a runner's turns on a triangular track, with someone's exterior angle taken as 180° minus a far angle.
// (The draft listed angles:c3 as an error task; it is a real-world task with that error as one of its parts, so the
// topic has its literacy task like every other.) Checked by learn/challenges.test.ts and verify/facts-challenges17.mjs.
// PRODUCT2-21 (a task after every stair): angles:c4, after angles:1, three angles on a line where only one was taken
// from 180° ('one-angle'); angles:c5, after angles:2, the proof that vertical angles are equal, then an angle twice its
// neighbour, found by parts.
import type { ChallengeTask, FigSpec } from '../types';

/** Triangle ABC with a line through C parallel to AB; the three angles at C on the line marked 1, 2 and 3. */
const PROOF_FIG: FigSpec = {
  type: 'geo', label: 'משולש ABC וישר דרך C המקביל ל־AB. שלוש הזוויות ליד C מסומנות 1, 2 ו־3',
  pts: { A: [0, 0], B: [5, 0], C: [1.8, 3], _L: [-0.8, 3], _R: [4.6, 3] },
  polys: [{ pts: ['A', 'B', 'C'] }],
  segs: [{ a: '_L', b: '_R', dash: true }],
  angles: [
    { at: 'C', from: '_L', to: 'A', text: '1', r: 30 },
    { at: 'C', from: 'A', to: 'B', text: '2', r: 22 },
    { at: 'C', from: 'B', to: '_R', text: '3', r: 30 },
    { at: 'A', from: 'B', to: 'C', r: 22 },
    { at: 'B', from: 'C', to: 'A', r: 22, n: 2 },
  ],
  view: [300, 210],
};
/**
 * The track of angles:c3: triangle ABC with ∠A = 50° and ∠B = 70° (so ∠C = 60°), side AC extended past C, and the
 * exterior angle at C, between the extension and CB, marked "?". C is where the rays from A at 50° and from B at 110°
 * meet: AC = 5 · sin 70° / sin 60°.
 */
const AC = (5 * Math.sin((70 * Math.PI) / 180)) / Math.sin((60 * Math.PI) / 180);
const C_TRACK: [number, number] = [AC * Math.cos((50 * Math.PI) / 180), AC * Math.sin((50 * Math.PI) / 180)];
const TRACK_FIG: FigSpec = {
  type: 'geo', label: 'משולש ABC. ב־A זווית של 50 מעלות, ב־B זווית של 70 מעלות. הצלע AC ממשיכה מעבר ל־C, והזווית החיצונית ב־C מסומנת בסימן שאלה',
  pts: { A: [0, 0], B: [5, 0], C: C_TRACK, _E: [C_TRACK[0] * 1.2, C_TRACK[1] * 1.2] },
  polys: [{ pts: ['A', 'B', 'C'] }],
  segs: [{ a: 'C', b: '_E', dash: true }],
  angles: [
    { at: 'A', from: 'B', to: 'C', text: '50°', r: 20 },
    { at: 'B', from: 'C', to: 'A', text: '70°', r: 20 },
    { at: 'C', from: 'B', to: '_E', text: '?', target: true, r: 20 },
  ],
  lab: { C: [-14, 2] },
  view: [300, 220],
};

/** Why the angle at C equals the one at A (or at B): the three reasons to choose from. */
const WHY_EQUAL = { choices: ['זוויות מתחלפות בין מקבילים', 'זוויות קודקודיות', 'זוויות צמודות'], answer: 0 };
/** Why two angles add up to 180° (angles:c5): the three reasons to choose from. */
const WHY_SUPP = { choices: ['זוויות צמודות משלימות ל־$180°$', 'זוויות קודקודיות שוות', 'סכום הזוויות במשולש הוא $180°$'], answer: 0 };

const RAD = Math.PI / 180;
/** A point `deg` degrees counterclockwise from the ray O→right, `r` units from O (y up). */
const ray = (deg: number, r = 3): [number, number] => [r * Math.cos(deg * RAD), r * Math.sin(deg * RAD)];
/**
 * angles:c4: a straight line through O and two rays from O, at 35° and 110° from the ray to the right, so the three
 * angles on the line are 35°, x = 75° and 70°.
 */
const ON_LINE_FIG: FigSpec = {
  type: 'geo', label: 'ישר ועליו הנקודה O. שתי קרניים יוצאות מ־O, ועל הישר יש שלוש זוויות: 35 מעלות, x ו־70 מעלות',
  pts: { O: [0, 0], _R: [3.6, 0], _L: [-3.6, 0], _P: ray(35), _Q: ray(110) },
  segs: [{ a: '_L', b: '_R' }, { a: 'O', b: '_P' }, { a: 'O', b: '_Q' }],
  angles: [
    { at: 'O', from: '_R', to: '_P', text: '35°', r: 26 },
    { at: 'O', from: '_P', to: '_Q', text: 'x', r: 30, target: true },
    { at: 'O', from: '_Q', to: '_L', text: '70°', r: 26 },
  ],
  dots: ['O'],
  view: [300, 170],
};
/**
 * angles:c5: the lines AB (A at 200°, B at 20°) and CD (C at 120°, D at 300°) crossing at O. Angle 1 is BOC (100°),
 * angle 2 is COA (80°) and angle 3 is AOD (100°): 1 and 3 face each other, 2 is next to both.
 */
const CROSS_FIG: FigSpec = {
  type: 'geo', label: 'הישרים AB ו־CD נחתכים בנקודה O. הזוויות 1 ו־3 עומדות זו מול זו, והזווית 2 ביניהן',
  pts: { O: [0, 0], A: ray(200), B: ray(20), C: ray(120), D: ray(300) },
  segs: [{ a: 'A', b: 'B' }, { a: 'C', b: 'D' }],
  angles: [
    { at: 'O', from: 'B', to: 'C', text: '1', r: 24 },
    { at: 'O', from: 'C', to: 'A', text: '2', r: 24 },
    { at: 'O', from: 'A', to: 'D', text: '3', r: 24 },
  ],
  // O's letter in the free angle DOB, clear of the arcs and the lines
  lab: { O: [20, 14] },
  view: [300, 220],
};

export const ANGLES_CHALLENGES: ChallengeTask[] = [
  {
    id: 'angles:c1', topic: 'angles', after: 'angles:4', kind: 'proof', title: 'למה סכום הזוויות במשולש הוא $180°$?', minutes: 6, fig: PROOF_FIG,
    parts: [
      { type: 'order', prompt: 'סדרו את שלבי ההוכחה, מהראשון לאחרון.',
        steps: [
          { text: 'מעבירים דרך $C$ ישר מקביל ל־$AB$.' },
          { text: 'הזווית בין הישר ל־$CA$ שווה ל־$\\angle A$.', reason: WHY_EQUAL },
          { text: 'הזווית בין הישר ל־$CB$ שווה ל־$\\angle B$.', reason: WHY_EQUAL },
          { text: 'שלוש הזוויות שליד $C$ יוצרות זווית שטוחה, $180°$.' },
          { text: 'לכן $\\angle A + \\angle B + \\angle C = 180°$.' },
        ],
        // the angles at A and at B can be found in either order: the proof holds both ways
        free: [[1, 2]] },
      { type: 'num', prompt: 'ב־$\\triangle ABC$, $\\angle A = 50°$ ו־$\\angle B = 60°$. כמה $\\angle C$?', answer: 70, check: '180-50-60', unit: 'מעלות',
        solution: ['סכום הזוויות במשולש הוא $180°$.', '$180 - 50 - 60 = 70$, כלומר $\\angle C = 70°$.'] },
    ],
  },
  {
    id: 'angles:c2', topic: 'angles', after: 'angles:3', kind: 'claim', title: 'שתי זוויות ישרות?', minutes: 4,
    parts: [
      { type: 'claim', prompt: 'מתי הטענה נכונה?', claim: '"במשולש יש שתי זוויות ישרות."', verdict: 'never',
        why: 'שתי זוויות ישרות הן כבר $90° + 90° = 180°$, כל סכום הזוויות במשולש. לזווית השלישית לא נשאר כלום. ושתי הצלעות שיוצאות מהן מאונכות לאותה צלע, ולכן הן מקבילות ולא נפגשות.' },
      { type: 'num', prompt: 'במשולש ישר־זווית, אחת הזוויות החדות היא $35°$. כמה מעלות הזווית השלישית?', answer: 55, check: '180-90-35', unit: 'מעלות',
        solution: ['סכום הזוויות במשולש $180°$, ואחת מהן ישרה, $90°$.', '$180 - 90 - 35 = 55$, כלומר $55°$.'] },
      { type: 'mc', prompt: 'במשולש יש זווית ישרה אחת. מה נכון על שתי הזוויות האחרות?', choices: [
        { text: 'שתיהן חדות, וביחד $90°$', ok: true, feedback: 'נכון: נשארו להן $180° - 90° = 90°$, אז כל אחת קטנה מ־$90°$.' },
        { text: 'אחת מהן יכולה להיות קהה', ok: false, feedback: 'זווית קהה גדולה מ־$90°$, ולשתיהן ביחד נשארו רק $90°$.' },
        { text: 'אחת מהן יכולה להיות ישרה', ok: false, feedback: 'אז היו שתי זוויות ישרות, $180°$, והשלישית הייתה $0°$. זה כבר לא משולש.' },
      ] },
    ],
  },
  {
    id: 'angles:c3', topic: 'angles', after: 'angles:5', kind: 'literacy', title: 'הפניות במסלול הריצה', minutes: 7, fig: TRACK_FIG,
    story: 'נועה רצה במסלול בצורת משולש $ABC$, ובכל פינה היא פונה. זווית הפנייה היא הזווית החיצונית של המשולש באותה פינה.',
    parts: [
      { type: 'num', prompt: 'במשולש $\\angle A = 50°$ ו־$\\angle B = 70°$. כמה מעלות הזווית של המשולש ב־$C$?', answer: 60, check: '180-50-70', unit: 'מעלות',
        solution: ['סכום הזוויות במשולש הוא $180°$.', '$180 - 50 - 70 = 60$, כלומר $\\angle C = 60°$.'] },
      { type: 'error', prompt: 'כך חישב דני את הפנייה ב־$C$.',
        lines: ['הזווית החיצונית ב־$C$ משלימה זווית ל־$180°$.', 'ולכן היא $180° - 50° = 130°$.', 'נועה פונה ב־$C$ ב־$130°$.'], wrong: 1,
        why: 'הזווית החיצונית ב־$C$ צמודה לזווית של המשולש באותה פינה, $\\angle C = 60°$, ולא ל־$\\angle A$ הרחוקה. $180° - 60° = 120°$, וזה גם $50° + 70°$: הזווית החיצונית שווה לסכום שתי הזוויות הרחוקות.',
        lineWhy: { 0: 'זווית חיצונית והזווית של המשולש לידה הן יחד $180°$. השאלה היא איזו זווית לקחו.', 2: 'השורה רק מעתיקה את התוצאה של השורה הקודמת. הטעות שם.' },
        fix: { prompt: 'בכמה מעלות נועה פונה ב־$C$?', answer: 120, check: '180-(180-50-70)' } },
      { type: 'num', prompt: 'כמה מעלות נועה פונה בסך הכול, בשלוש הפינות?', answer: 360, check: '(180-50)+(180-70)+(50+70)', unit: 'מעלות',
        solution: ['ב־$A$: $180° - 50° = 130°$. ב־$B$: $180° - 70° = 110°$. ב־$C$: $120°$.', '$130 + 110 + 120$ הם $360$: סיבוב שלם, ונועה רצה שוב לכיוון שבו התחילה.'] },
    ],
  },
  {
    id: 'angles:c4', topic: 'angles', after: 'angles:1', kind: 'error', title: 'שלוש זוויות על ישר', minutes: 4, misc: 'one-angle', fig: ON_LINE_FIG,
    parts: [
      { type: 'error', prompt: 'כך חישבה הילה את $x$.',
        lines: ['על הישר שלוש זוויות: $35°$, $x$ ו־$70°$.', 'הזוויות שעל ישר הן יחד $180°$.', 'לכן $x = 180° - 35° = 145°$.'], wrong: 2,
        why: 'על הישר יש שלוש זוויות, וכולן יחד $180°$. צריך להוריד גם את $70°$: $35° + 70° = 105°$, ו־$x = 180° - 105°$, כלומר $75°$.',
        lineWhy: { 0: 'אלה רק הנתונים מהשרטוט. הטעות מתחילה אחריהם.', 1: 'הכלל נכון: הזוויות שעל ישר, מצד אחד שלו, הן יחד $180°$.' },
        fix: { prompt: 'כמה מעלות $x$?', answer: 75, check: '180-35-70' } },
      { type: 'mc', prompt: 'איך אפשר לראות ש־$145°$ לא יכול להיות נכון?', choices: [
        { text: '$145° + 35° + 70°$ הם יותר מ־$180°$', ok: true, feedback: 'נכון: $145 + 35 + 70$ הם $250$. שלוש הזוויות שעל הישר צריכות להיות יחד $180°$ בדיוק.' },
        { text: '$145°$ היא זווית קהה', ok: false, feedback: 'גם זווית קהה יכולה להיות על ישר. הבעיה היא שסכום שלוש הזוויות יוצא $250°$, ולא $180°$.' },
        { text: 'אי אפשר לראות בלי מד־זווית', ok: false, feedback: 'אפשר: מחברים את שלוש הזוויות. $145 + 35 + 70$ הם $250$, יותר מ־$180°$.' },
      ] },
    ],
  },
  {
    id: 'angles:c5', topic: 'angles', after: 'angles:2', kind: 'proof', title: 'למה זוויות קודקודיות שוות?', minutes: 7, fig: CROSS_FIG,
    parts: [
      { type: 'order', prompt: 'הישרים $AB$ ו־$CD$ נחתכים ב־$O$. למה $\\angle 1 = \\angle 3$? סדרו את שלבי ההוכחה, מהראשון לאחרון.',
        steps: [
          { text: '$\\angle 1 + \\angle 2 = 180°$.', reason: WHY_SUPP },
          { text: '$\\angle 3 + \\angle 2 = 180°$.', reason: WHY_SUPP },
          { text: 'לכן $\\angle 1 + \\angle 2 = \\angle 3 + \\angle 2$.' },
          { text: 'מחסרים את $\\angle 2$ משני הצדדים: $\\angle 1 = \\angle 3$.' },
        ],
        // angle 1 and angle 3 can be paired with angle 2 in either order: the proof holds both ways
        free: [[0, 1]] },
      { type: 'num', prompt: 'בשרטוט $\\angle 2 = 80°$. כמה מעלות $\\angle 1$?', answer: 100, check: '180-80', unit: 'מעלות',
        solution: ['$\\angle 1$ ו־$\\angle 2$ צמודות, ולכן הן יחד $180°$.', '$180 - 80 = 100$, כלומר $\\angle 1 = 100°$. וגם $\\angle 3 = 100°$.'] },
      { type: 'num', prompt: 'שני ישרים אחרים נחתכים. אחת הזוויות גדולה פי $2$ מהזווית הצמודה לה. כמה מעלות היא?', answer: 120, check: '180/3*2', unit: 'מעלות',
        solution: ['הזווית הגדולה היא שני חלקים, והצמודה לה חלק אחד. יחד אלה $3$ חלקים שווים, $180°$.', 'חלק אחד הוא $180 : 3 = 60°$, והזווית הגדולה $2 \\cdot 60 = 120°$.'] },
    ],
  },
];
