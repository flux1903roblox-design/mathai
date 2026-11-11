// Challenge tasks of isosceles triangles and similarity (curriculum stage 4, GEOM-7): sim:c1, the claim that adding 2 cm
// to a rectangle's length and width keeps it similar (only for a square), with a counterexample typed into slots;
// sim:c2, the converse theorem proved in the class's table (T6's rows); sim:c3, a projector moved back, and the area that
// grows by the square of the ratio. Checked by learn/challenges.test.ts and the lane's spec/facts-sim.mjs.
//
// The challenge track loads with the first screen, so sim:c2 writes template T6's rows here (content/proofs.js, which
// loads with the unit, holds the same rows: challenges.test.ts compares them).
import type { ChallengeTask, FigSpec } from '../types';

/** T6's drawing: △ABC with ∢B = ∢C marked and the bisector AD (AB = AC = 4.5 over BC = 5, drawn true). */
const T6_FIG: FigSpec = (() => {
  const A: [number, number] = [2.5, Math.sqrt(4.5 * 4.5 - 2.5 * 2.5)];
  return {
    type: 'geo', label: 'משולש ABC שבו הזוויות B ו־C מסומנות שוות, והקטע AD חוצה את הזווית A',
    pts: { A, B: [5, 0], C: [0, 0], D: [2.5, 0] },
    polys: [{ pts: ['A', 'B', 'C'] }],
    segs: [{ a: 'A', b: 'D' }],
    angles: [
      { at: 'B', from: 'A', to: 'C', r: 26 }, { at: 'C', from: 'B', to: 'A', r: 26 },
      { at: 'A', from: 'C', to: 'D', r: 32, n: 2 }, { at: 'A', from: 'D', to: 'B', r: 32, n: 2 },
    ],
    view: [300, 210],
  } as FigSpec;
})();

export const SIM_CHALLENGES: ChallengeTask[] = [
  {
    id: 'sim:c1', topic: 'sim', after: 'sim:2', kind: 'claim', title: 'מוסיפים $2$ ס״מ', minutes: 4, misc: 'additive',
    parts: [
      { type: 'claim', prompt: 'מתי הטענה נכונה?', claim: '"אם מוסיפים $2$ ס״מ לאורך ולרוחב של מלבן, מקבלים מלבן דומה לו."', verdict: 'sometimes',
        why: 'ריבוע נשאר ריבוע, ולכן דומה. אבל מלבן $4 \\times 2$ (יחס $2$) הופך ל־$6 \\times 4$ (יחס $1.5$): לא דומה.',
        example: {
          ask: 'תנו אורך ורוחב של מלבן שבו המלבן החדש אינו דומה.', slots: [{ name: 'a', label: 'אורך' }, { name: 'b', label: 'רוחב' }],
          domain: 'positive-int', expr: '(a+2)*b - a*(b+2)', rel: '!=', value: 0, hint: 'נסו מלבן שאינו ריבוע.',
        } },
      { type: 'mc', prompt: 'מה כן נותן מלבן דומה?', choices: [
        { text: 'לכפול כל צלע באותו מספר', ok: true, feedback: 'נכון: כפל באותו מספר שומר על היחס בין הצלעות, ולכן על הצורה.' },
        { text: 'להוסיף לכל צלע אותו מספר', ok: false, feedback: 'הוספה משנה את היחס: $4 \\times 2$ הופך ל־$6 \\times 4$, ו־$6 : 4$ אינו $4 : 2$.' },
        { text: 'להוסיף רק לצלע הארוכה', ok: false, feedback: 'כך המלבן נמתח לאורך, והיחס בין הצלעות גדל. צריך לשנות את שתיהן פי אותו מספר.' },
      ] },
    ],
  },
  {
    id: 'sim:c2', topic: 'sim', after: 'sim:1', kind: 'proof', title: 'המשפט ההפוך', minutes: 6, fig: T6_FIG,
    parts: [
      { type: 'order', prompt: 'ב־$\\triangle ABC$: $\\sphericalangle B = \\sphericalangle C$, ו־$AD$ חוצה את $\\sphericalangle A$. סדרו את ההוכחה ש־$AB = AC$, ובחרו נימוק לכל שורה.',
        steps: [
          { text: '$\\sphericalangle B = \\sphericalangle C$', fixed: 'נתון' },
          { text: '$\\sphericalangle BAD = \\sphericalangle CAD$', fixed: 'הגדרת חוצה זווית' },
          { text: '$AD = AD$', fixed: 'צלע משותפת' },
          { text: '$\\sphericalangle ADB = \\sphericalangle ADC$', reason: { choices: ['סכום הזוויות במשולש הוא $180°$', 'זוויות קודקודיות', 'נתון'], answer: 0 } },
          { text: '$\\triangle ABD \\cong \\triangle ACD$', reason: { choices: ['לפי צ.ז.צ', 'לפי ז.צ.ז', 'לפי צ.צ.צ'], answer: 1 } },
          { text: '$AB = AC$', fixed: 'צלעות מתאימות במשולשים חופפים' },
        ],
        // the given, the bisector and the common side can come in any order: all three come before the third angle
        free: [[0, 1, 2]] },
      { type: 'num', prompt: 'ב־$\\triangle ABC$: $\\sphericalangle B = \\sphericalangle C = 65°$, ו־$AD$ חוצה את $\\sphericalangle A$. כמה מעלות $\\sphericalangle BAD$?', answer: 25, check: '(180-2*65)/2',
        solution: ['הזוויות ב־$B$ וב־$C$ יחד: $65° + 65° = 130°$. נשארות $180° - 130° = 50°$ לזווית $A$.', 'חוצה הזווית מחלק אותה לשתיים: $50° : 2 = 25°$.'] },
    ],
  },
  {
    id: 'sim:c3', topic: 'sim', after: 'sim:4', kind: 'literacy', title: 'המקרן', minutes: 8, misc: 'linear-area',
    story: 'מקרן עומד $2$ מטר מהקיר ומקרין תמונה ברוחב $1.2$ מטר ובגובה $0.9$ מטר. מזיזים את המקרן כך שיעמוד $5$ מטר מהקיר, באותו כיוון. התמונה החדשה דומה לקודמת.',
    parts: [
      { type: 'num', prompt: 'מה יחס הדמיון?', answer: 2.5, check: '5/2',
        solution: ['המרחק גדל מ־$2$ ל־$5$ מטר, וכל אורך בתמונה גדל באותו יחס.', '$5 : 2 = 2.5$'] },
      { type: 'num', prompt: 'מה הרוחב החדש, במטרים?', answer: 3, check: '1.2*5/2', unit: 'מטר',
        solution: ['$1.2 \\cdot 2.5 = 3$'] },
      { type: 'error', prompt: 'כך חישבה נועה את השטח החדש.',
        lines: ['השטח הישן: $1.2 \\cdot 0.9 = 1.08$ מ״ר.', 'יחס הדמיון $2.5$, ולכן השטח החדש $1.08 \\cdot 2.5 = 2.7$ מ״ר.', 'התמונה החדשה גדולה פי $2.5$.'], wrong: 1,
        why: 'השטח גדל פי ריבוע יחס הדמיון, $2.5^2 = 6.25$. בדיקה: הרוחב $3$, הגובה $2.25$, והשטח $3 \\cdot 2.25 = 6.75$.',
        fix: { prompt: 'מה השטח החדש, במ״ר?', answer: 6.75, check: '1.08*2.5^2' } },
      { type: 'explain', prompt: 'למה התמונה נראית חלשה יותר כשמרחיקים את המקרן?',
        rubric: ['אותו אור מתפזר על שטח גדול יותר', 'השטח גדל פי $6.25$, לא פי $2.5$'],
        sample: 'המקרן שולח אותה כמות אור. כשהמרחק פי $2.5$ השטח פי $6.25$, ולכן לכל מטר רבוע מגיע הרבה פחות אור.' },
    ],
  },
];
