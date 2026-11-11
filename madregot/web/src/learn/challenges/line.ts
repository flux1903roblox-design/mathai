// Challenge tasks of the linear function (curriculum stage 1, CURRICULUM-6.5): line:c1, two taxi companies and the
// distance where they cost the same; line:c2, a claim about two lines with the same slope; line:c3, a slope computed
// upside down. Their numbers are checked by the lane's verify/facts-challenges17.mjs and by learn/challenges.test.ts.
import type { ChallengeTask } from '../types';

export const LINE_CHALLENGES: ChallengeTask[] = [
  {
    id: 'line:c1', topic: 'line', after: 'line:8', kind: 'literacy', title: 'שתי חברות מוניות', minutes: 7,
    story: 'בחברת מוניות א משלמים $12$ ש״ח על הכניסה ועוד $4$ ש״ח לכל קילומטר. בחברה ב משלמים $20$ ש״ח על הכניסה ועוד $3$ ש״ח לכל קילומטר. המחיר בחברה א הוא $y = 12 + 4x$, ובחברה ב $y = 20 + 3x$, כש־$x$ הוא אורך הנסיעה בק״מ.',
    parts: [
      { type: 'num', prompt: 'כמה עולה נסיעה של $5$ ק״מ בחברה א?', answer: 32, check: '12+4*5', unit: 'ש״ח',
        solution: ['מציבים $x = 5$: $y = 12 + 4 \\cdot 5$.', '$12 + 20 = 32$ ש״ח.'] },
      { type: 'num', prompt: 'באיזה אורך נסיעה המחיר בשתי החברות שווה?', answer: 8, check: '(20-12)/(4-3)', unit: 'ק״מ',
        solution: ['משווים את שני המחירים: $12 + 4x = 20 + 3x$.', 'מחסרים $3x$ ו־$12$ משני האגפים: $x = 8$ ק״מ.'] },
      { type: 'num', prompt: 'ומה המחיר בנסיעה הזאת?', answer: 44, check: '12+4*8', unit: 'ש״ח',
        solution: ['בחברה א: $12 + 4 \\cdot 8 = 44$.', 'בחברה ב: $20 + 3 \\cdot 8 = 44$. אותו מחיר, $44$ ש״ח: זו נקודת המפגש של שני הישרים.'] },
      { type: 'mc', prompt: 'נסיעה של $15$ ק״מ: איזו חברה זולה יותר?', choices: [
        { text: 'חברה ב: $65$ ש״ח מול $72$', ok: true, feedback: 'נכון: $20 + 3 \\cdot 15 = 65$, ו־$12 + 4 \\cdot 15 = 72$. אחרי $8$ ק״מ חברה ב זולה יותר.' },
        { text: 'חברה א', ok: false, feedback: 'בחברה א: $12 + 4 \\cdot 15 = 72$ ש״ח, ובחברה ב רק $65$. חברה א זולה יותר רק בנסיעות קצרות מ־$8$ ק״מ.' },
        { text: 'אותו מחיר', ok: false, feedback: 'המחירים שווים רק בנסיעה של $8$ ק״מ. ב־$15$ ק״מ: $72$ מול $65$.' },
      ] },
    ],
  },
  {
    id: 'line:c2', topic: 'line', after: 'line:8', kind: 'claim', title: 'אותו שיפוע', minutes: 5,
    parts: [
      { type: 'claim', prompt: 'מתי הטענה נכונה?', claim: '"שני ישרים עם אותו שיפוע לא נפגשים."', verdict: 'sometimes',
        why: 'ל־$y = 2x + 1$ ול־$y = 2x + 4$ יש אותו שיפוע, והם מקבילים: הם לא נפגשים. אבל $y = 2x + 1$ ו־$y = 1 + 2x$ הם אותו ישר בדיוק, ונפגשים בכל נקודה שלו.' },
      { type: 'num', prompt: 'הישרים $y = 2x + 1$ ו־$y = 2x + 4$. בכמה הישר השני גבוה מהראשון, ב־$x = 5$?', answer: 3, check: '(2*5+4)-(2*5+1)',
        solution: ['ב־$x = 5$: $2 \\cdot 5 + 4 = 14$, ו־$2 \\cdot 5 + 1 = 11$.', '$14 - 11 = 3$. בכל $x$ ההפרש הוא $4 - 1 = 3$, ולכן הישרים לא נפגשים.'] },
      { type: 'mc', prompt: 'מתי שני ישרים עם אותו שיפוע נפגשים?', choices: [
        { text: 'כשגם $b$ שלהם שווה: אז זה אותו ישר', ok: true, feedback: 'נכון: אותו $m$ ואותו $b$ הם אותו ישר. עם $b$ שונה, הם מקבילים.' },
        { text: 'כשהשיפוע גדול מ־$1$', ok: false, feedback: 'גודל השיפוע לא משנה. $y = 5x$ ו־$y = 5x + 1$ מקבילים, כי ההפרש ביניהם תמיד $1$.' },
        { text: 'כשממשיכים אותם מספיק רחוק', ok: false, feedback: 'ישרים מקבילים לא נפגשים, גם רחוק מאוד: ההפרש ביניהם נשאר אותו הפרש בכל $x$.' },
      ] },
    ],
  },
  {
    id: 'line:c3', topic: 'line', after: 'line:4', kind: 'error', title: 'שיפוע הפוך', minutes: 4,
    parts: [
      { type: 'error', prompt: 'כך חישבה שירה.',
        lines: ['השיפוע של הישר דרך $(1, 2)$ ו־$(3, 8)$:', '$m = \\frac{3 - 1}{8 - 2}$', '$m = \\frac{2}{6} = \\frac{1}{3}$'], wrong: 1,
        why: 'שיפוע הוא השינוי ב־$y$ חלקי השינוי ב־$x$: $m = \\frac{8 - 2}{3 - 1}$. אצל שירה המונה והמכנה התחלפו.',
        fix: { prompt: 'מה השיפוע של הישר?', answer: 3, check: '(8-2)/(3-1)' } },
      { type: 'mc', prompt: 'איך אפשר לחשוד בתשובה $\\frac{1}{3}$ בלי לחשב?', choices: [
        { text: '$x$ גדל ב־$2$ ו־$y$ עולה ב־$6$: הישר תלול, והשיפוע גדול מ־$1$', ok: true, feedback: 'נכון: כש־$y$ משתנה יותר מ־$x$, השיפוע גדול מ־$1$. ו־$\\frac{1}{3}$ קטן מ־$1$.' },
        { text: 'שיפוע הוא מספר שלם', ok: false, feedback: 'שיפוע יכול להיות שבר, למשל $\\frac{1}{3}$. החשד כאן בא מזה ש־$y$ עולה ב־$6$ כש־$x$ גדל רק ב־$2$.' },
        { text: 'אי אפשר לחשוד בלי לחשב', ok: false, feedback: 'אפשר: $y$ עולה ב־$6$ כש־$x$ גדל ב־$2$. ישר כזה תלול, והשיפוע שלו גדול מ־$1$.' },
      ] },
    ],
  },
];
