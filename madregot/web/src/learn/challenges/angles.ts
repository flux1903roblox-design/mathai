// Challenge tasks of angles (curriculum stage 1, CURRICULUM-6.5): angles:c1, the proof that a triangle's angles add up
// to 180°, put in order with the reason for each step; angles:c2, a claim about two right angles in a triangle;
// angles:c3, a runner's turns on a triangular track, with someone's exterior angle taken as 180° minus a far angle.
// (The draft listed angles:c3 as an error task; it is a real-world task with that error as one of its parts, so the
// topic has its literacy task like every other.) Checked by learn/challenges.test.ts and verify/facts-challenges17.mjs.
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
        fix: { prompt: 'בכמה מעלות נועה פונה ב־$C$?', answer: 120, check: '180-(180-50-70)' } },
      { type: 'num', prompt: 'כמה מעלות נועה פונה בסך הכול, בשלוש הפינות?', answer: 360, check: '(180-50)+(180-70)+(50+70)', unit: 'מעלות',
        solution: ['ב־$A$: $180° - 50° = 130°$. ב־$B$: $180° - 70° = 110°$. ב־$C$: $120°$.', '$130 + 110 + 120 = 360$: סיבוב שלם, ונועה רצה שוב לכיוון שבו התחילה.'] },
    ],
  },
];
