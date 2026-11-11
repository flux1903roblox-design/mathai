// Challenge tasks of congruent triangles (curriculum stage 4, GEOM-7): congr:c1, the claim that two equal sides and an
// equal angle make congruent triangles (only when the angle is between them); congr:c2, the proof of the crossing
// segments ordered in the class's table; congr:c3, the neighbourhood's plot shared by paths from one corner. Checked by
// learn/challenges.test.ts and the lane's spec/facts-congr.mjs.
//
// The challenge track loads with the first screen, so congr:c2 writes template T1's rows here (content/proofs.js, which
// loads with the unit, holds the same rows: challenges.test.ts compares them).
import type { ChallengeTask, FigSpec } from '../types';

/** T1's drawing: AB and CD cross at M, each halved there (AM = MB = 3, CM = MD = 2.2, the angle AMC 110°). */
const T1_FIG: FigSpec = (() => {
  const a = (150 * Math.PI) / 180; const c = (40 * Math.PI) / 180;
  const A: [number, number] = [3 * Math.cos(a), 3 * Math.sin(a)]; const C: [number, number] = [2.2 * Math.cos(c), 2.2 * Math.sin(c)];
  return {
    type: 'geo', label: 'הקטעים AB ו־CD נחתכים בנקודה M. AM ו־MB מסומנים שווים, וגם CM ו־MD. הקטעים AC ו־BD סוגרים שני משולשים',
    pts: { A, B: [-A[0], -A[1]], C, D: [-C[0], -C[1]], M: [0, 0] },
    polys: [{ pts: ['A', 'M', 'C'] }, { pts: ['B', 'M', 'D'] }],
    segs: [{ a: 'A', b: 'M', ticks: 1 }, { a: 'M', b: 'B', ticks: 1 }, { a: 'C', b: 'M', ticks: 2 }, { a: 'M', b: 'D', ticks: 2 }, { a: 'A', b: 'C' }, { a: 'B', b: 'D' }],
    view: [300, 200],
  } as FigSpec;
})();

export const CONGR_CHALLENGES: ChallengeTask[] = [
  {
    id: 'congr:c1', topic: 'congr', after: 'congr:2', kind: 'claim', title: 'שתי צלעות וזווית', minutes: 5, misc: 'ssa',
    parts: [
      { type: 'claim', prompt: 'מתי הטענה נכונה?', claim: '"אם בשני משולשים יש שתי צלעות שוות וזווית שווה, המשולשים חופפים."', verdict: 'sometimes',
        why: 'כשהזווית כלואה בין שתי הצלעות, זה צ.ז.צ והם חופפים. כשהיא לא ביניהן יכולים לצאת שני משולשים שונים: עם $AB = 6$, $BC = 4.5$ ו־$\\sphericalangle A = 40°$, הצלע $AC$ יכולה להיות בערך $2.28$ או $6.91$.' },
      { type: 'mc', prompt: 'מה צריך להוסיף כדי שהטענה תהיה משפט?', choices: [
        { text: 'שהזווית תהיה בין שתי הצלעות', ok: true, feedback: 'נכון: זה משפט צ.ז.צ. הזווית הכלואה "נועלת" את הצלע השלישית.' },
        { text: 'שהצלעות יהיו ארוכות', ok: false, feedback: 'האורך לא משנה: גם עם צלעות ארוכות, זווית שאינה ביניהן יכולה לתת שני משולשים.' },
        { text: 'שהזווית תהיה חדה', ok: false, feedback: 'בדוגמה $\\sphericalangle A = 40°$, חדה, ובכל זאת יש שני משולשים. מה שחשוב הוא איפה הזווית.' },
      ] },
      { type: 'explain', prompt: 'תארו שני משולשים שונים עם שתי צלעות שוות וזווית שווה.',
        rubric: ['הזווית אינה בין הצלעות השוות', 'הראיתי שהצלע השלישית יוצאת שונה'],
        sample: '$AB = 6$ ו־$\\sphericalangle A = 40°$. מ־$B$ פותחים מחוגה ל־$4.5$: היא פוגשת את הקרן מ־$A$ בשתי נקודות, $C_1$ ו־$C_2$. ב־$\\triangle ABC_1$ וב־$\\triangle ABC_2$ שתי צלעות וזווית שוות, אבל $AC_1 \\ne AC_2$.' },
    ],
  },
  {
    id: 'congr:c2', topic: 'congr', after: 'congr:3', kind: 'proof', title: 'קטעים שחוצים זה את זה', minutes: 6, fig: T1_FIG,
    parts: [
      { type: 'order', prompt: 'הקטעים $AB$ ו־$CD$ נחתכים בנקודה $M$, $AM = MB$ ו־$CM = MD$. סדרו את ההוכחה ש־$AC = BD$, ובחרו נימוק לכל שורה.',
        steps: [
          { text: '$AM = MB$', fixed: 'נתון' },
          { text: '$CM = MD$', fixed: 'נתון' },
          { text: '$\\sphericalangle AMC = \\sphericalangle BMD$', reason: { choices: ['זוויות מתחלפות בין ישרים מקבילים', 'זוויות קודקודיות', 'נתון'], answer: 1 } },
          { text: '$\\triangle AMC \\cong \\triangle BMD$', reason: { choices: ['לפי צ.צ.צ', 'לפי ז.צ.ז', 'לפי צ.ז.צ'], answer: 2 } },
          { text: '$AC = BD$', reason: { choices: ['צלעות מתאימות במשולשים חופפים', 'נתון', 'זוויות קודקודיות'], answer: 0 } },
        ],
        // the two givens and the vertical angles can come in any order: all three come before the congruence
        free: [[0, 1, 2]] },
      { type: 'num', prompt: '$AM = 4$, $CM = 5$ ו־$AC = 7$ ס״מ. מה ההיקף של $\\triangle BMD$?', answer: 16, check: '4+5+7', unit: 'ס״מ',
        solution: ['המשולשים חופפים, ולכן $BM = 4$, $MD = 5$, $BD = 7$.', '$4 + 5 + 7 = 16$'] },
      { type: 'mc', prompt: 'מה עוד נובע מהחפיפה?', choices: [
        { text: '$\\sphericalangle CAM = \\sphericalangle DBM$', ok: true, feedback: 'נכון: $A \\leftrightarrow B$ ו־$C \\leftrightarrow D$, ולכן הזוויות ב־$A$ וב־$B$ מתאימות.' },
        { text: '$AC \\perp BD$', ok: false, feedback: 'החפיפה לא אומרת דבר על זווית בין $AC$ ל־$BD$. (הם מקבילים, אבל זה כבר משהו אחר.)' },
        { text: '$AM = CM$', ok: false, feedback: '$AM$ ו־$CM$ שייכות לאותו משולש, ואינן מתאימות זו לזו. $AM = MB$ נתון, ו־$CM = MD$.' },
      ] },
    ],
  },
  {
    id: 'congr:c3', topic: 'congr', after: 'congr:4', kind: 'literacy', title: 'החלקה של השכונה', minutes: 8,
    story: 'לשכונה חלקה בצורת משולש $ABC$. הצלע $BC$ באורך $40$ מטר, והמרחק מ־$A$ אל הישר $BC$ הוא $30$ מטר. רוצים לחלק את החלקה בין משפחות בשבילים ישרים שיוצאים מ־$A$.',
    parts: [
      { type: 'num', prompt: 'מה שטח החלקה, במ״ר?', answer: 600, check: '40*30/2', unit: 'מ״ר',
        solution: ['שטח משולש: בסיס כפול גובה, לחלק ל־$2$.', '$\\frac{40 \\cdot 30}{2} = 600$'] },
      { type: 'mc', prompt: 'לאן צריך להגיע שביל אחד כדי ששני החלקים יהיו שווי שטח?', choices: [
        { text: 'לאמצע $BC$: השביל הוא תיכון', ok: true, feedback: 'נכון: לשני החלקים בסיס של $20$ מטר ואותו גובה, $30$ מטר.' },
        { text: 'לנקודה שבה השביל מאונך ל־$BC$', ok: false, feedback: 'זה הגובה. הוא מחלק את $BC$ לשני קטעים שאינם שווים בדרך כלל, ולכן גם השטחים לא שווים.' },
        { text: 'לנקודה שבה השביל חוצה את $\\sphericalangle A$', ok: false, feedback: 'חוצה הזווית מחלק את הזווית, לא את $BC$ לשניים. השטחים שווים רק כשהבסיסים שווים.' },
      ] },
      { type: 'num', prompt: 'לארבע משפחות מחלקים את $BC$ לארבעה קטעים שווים, ומעבירים שבילים מ־$A$. מה השטח של כל חלק?', answer: 150, check: '600/4', unit: 'מ״ר',
        solution: ['לכל חלק בסיס של $40 : 4 = 10$ מטר, ואותו גובה, $30$ מטר.', '$\\frac{10 \\cdot 30}{2} = 150$'] },
      { type: 'mc', prompt: 'לאחד החלקים היקף גדול יותר. זה סותר את השטחים השווים?', choices: [
        { text: 'לא: שטח שווה לא אומר היקף שווה', ok: true, feedback: 'נכון: השטח תלוי בבסיס ובגובה, וההיקף בכל הצלעות. השבילים באורכים שונים.' },
        { text: 'כן: החלוקה לא הוגנת', ok: false, feedback: 'החלוקה הוגנת בשטח: לכל משפחה $150$ מ״ר. ההיקף הוא רק אורך הגדר.' },
        { text: 'כן: צריך גם היקפים שווים', ok: false, feedback: 'שטחים שווים לא דורשים היקפים שווים: לכל חלק בסיס שווה ואותו גובה, אבל צלעות אחרות.' },
      ] },
    ],
  },
];
