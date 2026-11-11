// Challenge tasks of probability (curriculum stage 3, DATA-7): prob:c1, a claim about two outcomes and one half (worded
// as two plain sentences, with no "לכל"); prob:c2, Danny's error, (5, 6) counted once beside (6, 6); prob:c3, the
// Ministry's rain table, retold: certain, the complement, Danny's "half the day", and a decision. Their numbers are
// checked by web/scripts/verify/facts-stage3.mjs and by learn/challenges.test.ts. No event is named with a letter.
import type { ChallengeTask } from '../types';

export const PROB_CHALLENGES: ChallengeTask[] = [
  {
    id: 'prob:c1', topic: 'prob', after: 'prob:1', kind: 'claim', title: 'שתי תוצאות, חצי וחצי?', minutes: 4, misc: 'equiprob-event',
    parts: [
      { type: 'claim', prompt: 'מתי הטענה נכונה?', claim: '"בניסוי יש שתי תוצאות אפשריות. ההסתברות של כל אחת מהן היא $\\frac{1}{2}$."', verdict: 'sometimes',
        why: 'במטבע הוגן כן. בקובייה, "$6$" ו"לא $6$" הן שתי תוצאות, וההסתברויות שלהן $\\frac{1}{6}$ ו־$\\frac{5}{6}$. ובמטבע עקום, לא בטוח.' },
      { type: 'mc', prompt: 'מה צריך כדי שכל אחת מהשתיים תהיה חצי?', choices: [
        { text: 'ששתי התוצאות יהיו שוות סיכוי', ok: true, feedback: 'נכון: רק כשאין סיבה שאחת תצא יותר מהשנייה, כמו במטבע הוגן.' },
        { text: 'שיהיו שתי תוצאות', ok: false, feedback: '"$6$" ו"לא $6$" הן שתי תוצאות, וההסתברות של "$6$" היא $\\frac{1}{6}$ בלבד.' },
        { text: 'מזל', ok: false, feedback: 'ההסתברות לא תלויה במזל. היא תלויה בכמה תוצאות שוות סיכוי מתאימות.' },
      ] },
    ],
  },
  {
    id: 'prob:c2', topic: 'prob', after: 'prob:3', kind: 'error', title: 'סכום 11 וסכום 12', minutes: 5, misc: 'unordered',
    parts: [
      { type: 'error', prompt: 'כך חשב דני על הטלה של שתי קוביות.',
        lines: [
          'סכום $11$ יוצא רק מ־$5$ ו־$6$, וסכום $12$ רק מ־$6$ ו־$6$.',
          'לכל אחד מהם זוג אחד.',
          'לכן הסיכויים שלהם שווים.',
        ], wrong: 1,
        why: '$5$ ו־$6$ הם שני תאים בטבלה: $(5, 6)$ ו־$(6, 5)$. $6$ ו־$6$ הוא תא אחד.',
        fix: { prompt: 'בכמה תאים בטבלה הסכום $11$?', answer: 2, check: '2' } },
      { type: 'mc', prompt: 'אז מה הסיכויים?', choices: [
        { text: 'לסכום $11$ פי שניים: $\\frac{2}{36}$ מול $\\frac{1}{36}$', ok: true, feedback: 'נכון: שני תאים מול תא אחד.' },
        { text: 'שווים: $\\frac{1}{36}$ לכל אחד', ok: false, feedback: 'כך יוצא כשסופרים את $(5, 6)$ ואת $(6, 5)$ כתא אחד.' },
        { text: 'שווים: $\\frac{1}{11}$ לכל אחד', ok: false, feedback: '$11$ הסכומים אינם שווי סיכוי. סופרים תאים, לא סכומים.' },
      ] },
    ],
  },
  {
    id: 'prob:c3', topic: 'prob', after: 'prob:2', kind: 'literacy', title: 'תחזית גשם', minutes: 6, misc: 'outcome-approach',
    story: 'בתחזית: ההסתברות לגשם מחר בערד $0.05$, בירושלים $0.5$, בחיפה $0.9$ ובתל אביב $0$.',
    parts: [
      { type: 'mc', prompt: 'באיזו עיר בטוח שלא ירד גשם?', choices: [
        { text: 'תל אביב', ok: true, feedback: 'נכון: הסתברות $0$ היא "לא יכול לקרות".' },
        { text: 'ערד', ok: false, feedback: 'בערד $0.05$: לא סביר, אבל אפשרי.' },
        { text: 'ירושלים', ok: false, feedback: 'בירושלים $0.5$: סיכוי שווה לגשם וליום יבש.' },
      ] },
      { type: 'num', prompt: 'מה ההסתברות ליום יבש בחיפה?', answer: 0.1, check: '1 - 0.9',
        solution: ['יום יבש הוא המשלים של יום גשום.', '$1 - 0.9 = 0.1$'] },
      { type: 'mc', prompt: 'דני: "$0.5$ בירושלים אומר שחצי מהיום יירד גשם." זה נכון?', choices: [
        { text: 'לא: זה הסיכוי שיירד גשם, לא כמה זמן', ok: true, feedback: 'נכון: מתוך הרבה ימים עם תחזית כזאת, בערך בחצי מהם יורד גשם.' },
        { text: 'כן', ok: false, feedback: 'ההסתברות אומרת כמה סביר שיירד גשם, לא כמה שעות.' },
      ] },
      { type: 'mc', prompt: 'מרוץ בערד מבוטל רק אם ההסתברות לגשם גדולה מ־$0.2$. מה יחליטו?', choices: [
        { text: 'המרוץ יתקיים', ok: true, feedback: 'נכון: $0.05$ קטן מ־$0.2$.' },
        { text: 'המרוץ יבוטל', ok: false, feedback: 'בערד $0.05$, פחות מ־$0.2$, ולכן לא מבטלים.' },
      ] },
    ],
  },
];
