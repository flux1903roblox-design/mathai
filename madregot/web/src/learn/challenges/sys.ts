// Challenge tasks of systems of equations (curriculum stage 1, CURRICULUM-6.5), as the spec writes them: sys:c1, a claim
// about how many solutions a system of two linear equations has; sys:c2, a substitution where −1 crossed over without the
// inverse operation ('move-no-flip'); sys:c3, cinema tickets for children and adults. Every number is in the lane
// skeptic's check.mjs and in verify/facts-challenges17.mjs; learn/challenges.test.ts checks them again.
// PRODUCT2-21 (a task after every stair): sys:c4, after sys:1, a coat 40% dearer than a shirt, and the percent the
// other way; sys:c5, after sys:3, a system solved by subtracting its equations, each step with its reason, then
// another; sys:c6, after sys:5, an inequality divided by a negative number without turning ('no-flip'), a claim about
// multiplying both sides, and its whole solutions.
import type { ChallengeTask } from '../types';

export const SYS_CHALLENGES: ChallengeTask[] = [
  {
    id: 'sys:c1', topic: 'sys', after: 'sys:2', kind: 'claim', title: 'פתרון אחד למערכת?', minutes: 4,
    parts: [
      { type: 'claim', prompt: 'מתי הטענה נכונה?', claim: '"למערכת של שתי משוואות קוויות יש פתרון אחד."', verdict: 'sometimes',
        why: 'שני ישרים שנחתכים נפגשים בנקודה אחת. ישרים מקבילים לא נפגשים, ואז אין פתרון. ואם שתי המשוואות הן אותו ישר, יש אינסוף פתרונות.' },
      { type: 'mc', prompt: 'למערכת $y = 2x + 1$ ו־$y = 2x + 4$:', choices: [
        { text: 'אין פתרון: הישרים מקבילים', ok: true, feedback: 'נכון: לשני הישרים אותו שיפוע, $2$, ו־$b$ שונה. הם לא נפגשים, ולמערכת אין פתרון.' },
        { text: 'פתרון אחד', ok: false, feedback: 'מציבים: $2x + 1 = 2x + 4$, ונשאר $1 = 4$. אין $x$ כזה: הישרים מקבילים.' },
        { text: 'אינסוף פתרונות', ok: false, feedback: 'אינסוף פתרונות יש רק כששתי המשוואות הן אותו ישר. כאן ה־$b$ שונה, $1$ ו־$4$, והישרים מקבילים.' },
      ] },
    ],
  },
  {
    id: 'sys:c2', topic: 'sys', after: 'sys:2', kind: 'error', title: 'הטעות בהצבה', minutes: 5, misc: 'move-no-flip',
    parts: [
      { type: 'error', prompt: 'כך פתר יונתן.',
        lines: ['$y = 2x - 1$ ו־$3x + y = 14$', 'מציבים: $3x + 2x - 1 = 14$', '$5x = 13$', '$x = 2.6$'], wrong: 2,
        why: 'מעבירים את $-1$ בפעולה ההפוכה: מוסיפים $1$ לשני האגפים, ו־$5x = 15$.',
        lineWhy: { 0: 'זו רק המערכת מהשאלה. הטעות מתחילה אחריה.', 1: 'ההצבה נכונה: במקום $y$ כתבו $2x - 1$.', 3: 'מ־$5x = 13$ באמת יוצא $x = 2.6$. הטעות בשורה שלפניה.' },
        fix: { prompt: 'מה $x$?', answer: 3, check: '(14+1)/5' } },
      { type: 'num', prompt: 'ומה $y$?', answer: 5, check: '2*3-1',
        solution: ['מציבים $x = 3$ ב־$y = 2x - 1$.', '$y = 2 \\cdot 3 - 1 = 5$. בדיקה: $3 \\cdot 3 + 5 = 14$.'] },
    ],
  },
  {
    id: 'sys:c3', topic: 'sys', after: 'sys:4', kind: 'literacy', title: 'כרטיסים לקולנוע', minutes: 8,
    story: 'בקולנוע נמכרו ביום אחד $120$ כרטיסים: כרטיס ילד ב־$30$ ש״ח וכרטיס מבוגר ב־$45$ ש״ח. הקופה הכניסה $4{,}350$ ש״ח.',
    parts: [
      { type: 'mc', prompt: 'איזו מערכת מתאימה? ($x$ כרטיסי ילד, $y$ כרטיסי מבוגר)', choices: [
        { text: '$x + y = 120$ ו־$30x + 45y = 4350$', ok: true, feedback: 'נכון: מספר הכרטיסים יחד הוא $120$, והכסף יחד הוא $4{,}350$ ש״ח.' },
        { text: '$x + y = 4350$ ו־$30x + 45y = 120$', ok: false, feedback: 'כאן הכרטיסים והכסף התחלפו. $x + y$ סופר כרטיסים, ולכן הוא $120$.' },
        { text: '$x + y = 120$ ו־$45x + 30y = 4350$', ok: false, feedback: 'כאן המחירים התחלפו: $x$ הם כרטיסי ילד, ולכן הם מוכפלים ב־$30$.' },
      ] },
      { type: 'num', prompt: 'כמה כרטיסי ילד נמכרו?', answer: 70, check: '(45*120-4350)/(45-30)', unit: 'כרטיסים',
        solution: ['מ־$x + y = 120$: $y = 120 - x$. מציבים במשוואת הכסף: $30x + 45(120 - x)$ שווה ל־$4350$.', '$5400 - 15x = 4350$, ולכן $15x = 1050$ ו־$x = 70$.'] },
      { type: 'num', prompt: 'וכמה כרטיסי מבוגר?', answer: 50, check: '120-70', unit: 'כרטיסים',
        solution: ['$y = 120 - x$.', '$120 - 70 = 50$ כרטיסי מבוגר.'] },
      { type: 'explain', prompt: 'בדקו את התשובה בלי לפתור שוב.',
        rubric: ['בדקתי שיש $120$ כרטיסים', 'בדקתי שהכסף יוצא $4{,}350$'],
        sample: '$70 + 50 = 120$ כרטיסים. הכסף: $70 \\cdot 30 = 2{,}100$ ו־$50 \\cdot 45 = 2{,}250$, וביחד $4{,}350$ ש״ח. שתי המשוואות מתקיימות.' },
    ],
  },
  {
    id: 'sys:c4', topic: 'sys', after: 'sys:1', kind: 'literacy', title: 'מעיל וחולצה', minutes: 7,
    story: 'בחנות, מעיל יקר ב־$40\\%$ מחולצה. מעיל וחולצה יחד עולים $360$ ש״ח.',
    parts: [
      { type: 'mc', prompt: 'החולצה עולה $x$ ש״ח. כמה עולה המעיל?', choices: [
        { text: '$1.4x$', ok: true, feedback: 'נכון: המעיל עולה כמו החולצה ועוד $40\\%$ מהמחיר שלה: $x + 0.4x = 1.4x$.' },
        { text: '$x + 40$', ok: false, feedback: '$40\\%$ הם לא $40$ ש״ח, אלא $40\\%$ מהמחיר של החולצה: $0.4x$. לכן המעיל עולה $1.4x$.' },
        { text: '$0.4x$', ok: false, feedback: '$0.4x$ הוא רק ההפרש בין המחירים. המעיל עולה כמו החולצה ועוד ההפרש: $1.4x$.' },
      ] },
      { type: 'num', prompt: 'כמה עולה החולצה?', answer: 150, check: '360/2.4', unit: 'ש״ח',
        solution: ['המשוואה: $x + 1.4x = 360$, כלומר $2.4x = 360$.', '$x = 360 : 2.4$, כלומר $150$ ש״ח.'] },
      { type: 'num', prompt: 'וכמה עולה המעיל?', answer: 210, check: '1.4*360/2.4', unit: 'ש״ח',
        solution: ['$1.4 \\cdot 150 = 210$ ש״ח.', 'בדיקה: $150 + 210 = 360$.'] },
      { type: 'mc', prompt: 'בכמה אחוזים החולצה זולה מהמעיל?', choices: [
        { text: 'בערך $28.6\\%$', ok: true, feedback: 'נכון: ההפרש, $60$ ש״ח, מחולק במחיר המעיל: $\\frac{60}{210} \\approx 0.286$. האחוז נמדד מהמחיר שמשווים אליו.' },
        { text: '$40\\%$', ok: false, feedback: 'את ה־$40\\%$ מדדו מהמחיר של החולצה. כאן משווים למעיל: $\\frac{60}{210} \\approx 28.6\\%$.' },
        { text: '$60\\%$', ok: false, feedback: '$60$ הוא ההפרש בש״ח, לא באחוזים. באחוזים מהמעיל: $\\frac{60}{210} \\approx 28.6\\%$.' },
      ] },
    ],
  },
  {
    id: 'sys:c5', topic: 'sys', after: 'sys:3', kind: 'proof', title: 'למה מותר לחסר משוואות?', minutes: 8,
    parts: [
      { type: 'order', prompt: 'פותרים את המערכת $2x + y = 11$ ו־$x + y = 7$ בהשוואת מקדמים. סדרו את שלבי הפתרון, מהראשון לאחרון.',
        steps: [
          { text: 'הזוג $(x, y)$ פותר את שתי המשוואות: $2x + y = 11$ וגם $x + y = 7$.' },
          { text: 'מחסרים את המשוואות, אגף מאגף: $(2x + y) - (x + y)$ שווה ל־$11 - 7$.',
            reason: { choices: ['מחסרים משני דברים שווים דברים שווים, והשוויון נשמר', 'מחלקים את המשוואה הראשונה ב־$2$', 'כופלים את שתי המשוואות זו בזו'], answer: 0 } },
          { text: '$y$ מתבטל, ונשאר $x = 4$.',
            reason: { choices: ['$y - y = 0$', '$y = 0$', '$2x - x = 2$'], answer: 0 } },
          { text: 'מציבים $x = 4$ ב־$x + y = 7$: $y = 3$.' },
          { text: 'בדיקה במשוואה הראשונה: $2 \\cdot 4 + 3 = 11$.' },
        ] },
      { type: 'num', prompt: 'פתרו: $5x + 2y = 19$ ו־$x + 2y = 7$. מה $x$?', answer: 3, check: '(19-7)/(5-1)',
        solution: ['ל־$y$ אותו מקדם, $2$. מחסרים את המשוואות: $4x = 12$.', '$x = 3$.'] },
      { type: 'num', prompt: 'ומה $y$?', answer: 2, check: '(7-3)/2',
        solution: ['מציבים $x = 3$ ב־$x + 2y = 7$: $2y = 4$.', '$y = 2$. בדיקה: $5 \\cdot 3 + 2 \\cdot 2 = 19$.'] },
    ],
  },
  {
    id: 'sys:c6', topic: 'sys', after: 'sys:5', kind: 'error', title: 'הכיוון שלא התהפך', minutes: 6, misc: 'no-flip',
    parts: [
      { type: 'error', prompt: 'כך פתרה מאיה.',
        lines: ['$5 - 3x > 17$', '$-3x > 12$', '$x > -4$'], wrong: 2,
        why: 'מחלקים ב־$-3$, מספר שלילי, ולכן כיוון אי־השוויון מתהפך: $x < -4$. בדיקה: $x = 0$ גדול מ־$-4$, אבל $5 - 0 = 5$ לא גדול מ־$17$.',
        lineWhy: { 0: 'זה רק אי־השוויון מהשאלה. הטעות מתחילה אחריו.', 1: 'מחסרים $5$ משני האגפים: $17 - 5 = 12$. השורה נכונה.' },
        fix: { prompt: 'מה המספר השלם הגדול ביותר שפותר את אי־השוויון?', answer: -5, check: '-5' } },
      { type: 'claim', prompt: 'מתי הטענה נכונה?', claim: '"כופלים את שני האגפים של אי־שוויון באותו מספר, והכיוון שלו לא משתנה."', verdict: 'sometimes',
        why: 'בכפל במספר חיובי הכיוון נשאר: $2 < 3$, וגם $8 < 12$. בכפל במספר שלילי הוא מתהפך: בכפל ב־$-1$ יוצאים $-2$ ו־$-3$, ו־$-2 > -3$. ובכפל ב־$0$ שני האגפים שווים.',
        example: {
          ask: 'תנו מספר שאם כופלים בו את שני האגפים של $2 < 3$, אי־השוויון כבר לא נכון.', slots: [{ name: 'k', label: 'המספר' }],
          domain: 'number', expr: '3*k - 2*k', rel: '<=', value: 0, hint: 'נסו מספר שלילי.',
        } },
      { type: 'num', prompt: 'כמה מספרים שלמים מ־$-10$ עד $10$ פותרים את $5 - 3x > 17$?', answer: 6, check: '-5-(-10)+1',
        solution: ['הפתרון: $x < -4$. מ־$-10$ עד $10$, המספרים השלמים שקטנים מ־$-4$ הם:', '$-10$, $-9$, $-8$, $-7$, $-6$ ו־$-5$: שישה מספרים.'] },
    ],
  },
];
