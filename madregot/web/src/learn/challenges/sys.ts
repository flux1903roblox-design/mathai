// Challenge tasks of systems of equations (curriculum stage 1, CURRICULUM-6.5), as the spec writes them: sys:c1, a claim
// about how many solutions a system of two linear equations has; sys:c2, a substitution where −1 crossed over without the
// inverse operation ('move-no-flip'); sys:c3, cinema tickets for children and adults. Every number is in the lane
// skeptic's check.mjs and in verify/facts-challenges17.mjs; learn/challenges.test.ts checks them again.
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
        solution: ['מ־$x + y = 120$: $y = 120 - x$. מציבים: $30x + 45(120 - x) = 4350$.', '$5400 - 15x = 4350$, ולכן $15x = 1050$ ו־$x = 70$.'] },
      { type: 'num', prompt: 'וכמה כרטיסי מבוגר?', answer: 50, check: '120-70', unit: 'כרטיסים',
        solution: ['$y = 120 - x$.', '$120 - 70 = 50$ כרטיסי מבוגר.'] },
      { type: 'explain', prompt: 'בדקו את התשובה בלי לפתור שוב.',
        rubric: ['בדקתי שיש $120$ כרטיסים', 'בדקתי שהכסף יוצא $4{,}350$'],
        sample: '$70 + 50 = 120$ כרטיסים. הכסף: $70 \\cdot 30 = 2{,}100$ ו־$50 \\cdot 45 = 2{,}250$, וביחד $4{,}350$ ש״ח. שתי המשוואות מתקיימות.' },
    ],
  },
];
