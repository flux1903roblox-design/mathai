// Challenge tasks of signed numbers (curriculum stage 1, CURRICULUM-6.5): signed:c1, a claim about adding two negative
// numbers; signed:c2, someone's "two minuses make a plus" where it does not hold; signed:c3, a cold week on the Hermon;
// signed:c4 (the classroom lane, CLASSROOM-4), the minus of the number before brackets lost at the end; signed:c5
// (CLASSROOM-5), the claim that a negative number to a power is positive.
// Their numbers are checked by the lanes' verify scripts and by learn/challenges.test.ts.
// PRODUCT2-21 (a task after every stair): signed:c6, after signed:2, a claim about the larger of two numbers and its
// distance from 0; signed:c7, after signed:4, an addition done before a multiplication ('order'), then a chain of
// division and multiplication; signed:c8, after signed:6, the proof that a − (−b) = a + b, then signed fractions and
// decimals. The classroom lane's signed:c4 (after signed:5) and signed:c5 (after signed:7) come before them.
import type { ChallengeTask } from '../types';

export const SIGNED_CHALLENGES: ChallengeTask[] = [
  {
    id: 'signed:c1', topic: 'signed', after: 'signed:1', kind: 'claim', title: 'שני מספרים שליליים', minutes: 4,
    parts: [
      { type: 'claim', prompt: 'מתי הטענה נכונה?', claim: '"סכום של שני מספרים שליליים הוא מספר שלילי."', verdict: 'always',
        why: 'על ציר המספרים מתחילים משמאל ל־$0$. מוסיפים מספר שלילי, וזזים עוד שמאלה. למשל $(-3) + (-5) = -8$. אי אפשר להגיע ל־$0$ או מימין לו.' },
      { type: 'num', prompt: 'כמה זה $(-7) + (-6)$?', answer: -13, check: '(-7)+(-6)',
        solution: ['שני המספרים שליליים, אז גם הסכום שלילי.', '$7 + 6 = 13$, ולכן $(-7) + (-6) = -13$.'] },
      { type: 'mc', prompt: 'ומה אפשר לומר על סכום של מספר שלילי ומספר חיובי?', choices: [
        { text: 'הוא יכול להיות חיובי, שלילי או $0$', ok: true, feedback: 'נכון: $(-2) + 5 = 3$, $(-5) + 2 = -3$, ו־$(-4) + 4 = 0$. זה תלוי באיזה מהם רחוק יותר מ־$0$.' },
        { text: 'הוא תמיד שלילי', ok: false, feedback: '$(-2) + 5 = 3$, וזה חיובי. כשהמספר החיובי רחוק יותר מ־$0$, הסכום חיובי.' },
        { text: 'הוא תמיד חיובי', ok: false, feedback: '$(-5) + 2 = -3$, וזה שלילי. כשהמספר השלילי רחוק יותר מ־$0$, הסכום שלילי.' },
      ] },
    ],
  },
  {
    id: 'signed:c2', topic: 'signed', after: 'signed:1', kind: 'error', title: 'שני מינוסים?', minutes: 4,
    parts: [
      { type: 'error', prompt: 'כך חישבה מיכל.',
        lines: ['צריך לחשב $-4 - 6$.', '"שני מינוסים הם פלוס", ולכן $-4 - 6 = -4 + 6$.', '$-4 + 6 = 2$'], wrong: 1,
        why: 'כאן מחסרים $6$, מספר חיובי. מינוס ועוד מינוס נהיים פלוס רק כשמחסרים מספר שלילי, כמו ב־$5 - (-2) = 5 + 2$. מ־$-4$ זזים $6$ שמאלה, ומגיעים ל־$-10$.',
        lineWhy: { 0: 'זו רק השאלה. הטעות מתחילה אחריה.', 2: 'החשבון בשורה הזאת נכון: $-4 + 6 = 2$. הבעיה בשורה שלפניה.' },
        fix: { prompt: 'כמה זה $-4 - 6$?', answer: -10, check: '-4-6' } },
      { type: 'mc', prompt: 'באיזה תרגיל שני המינוסים באמת נהיים פלוס?', choices: [
        { text: '$5 - (-2) = 5 + 2$', ok: true, feedback: 'נכון: מחסרים מספר שלילי, וזה כמו להוסיף את הנגדי שלו. $5 - (-2) = 7$.' },
        { text: '$-4 - 6 = -4 + 6$', ok: false, feedback: 'כאן מחסרים $6$, מספר חיובי. אין כאן מינוס לפני מספר שלילי, ו־$-4 - 6 = -10$.' },
        { text: '$-3 - 2 = 3 + 2$', ok: false, feedback: 'המינוס של $-3$ שייך למספר עצמו, והוא לא מתבטל. $-3 - 2 = -5$.' },
      ] },
    ],
  },
  {
    id: 'signed:c3', topic: 'signed', after: 'signed:3', kind: 'literacy', title: 'שבוע קר בחרמון', minutes: 6,
    story: 'בחרמון מדדו את הטמפרטורה בכל בוקר, שבוע שלם. ראשון $-3$, שני $-1$, שלישי $2$, רביעי $0$, חמישי $-4$, שישי $1$, שבת $-2$ מעלות.',
    parts: [
      { type: 'num', prompt: 'מה ההפרש בין הבוקר החם ביותר לבוקר הקר ביותר?', answer: 6, check: '2-(-4)', unit: 'מעלות',
        solution: ['החם ביותר: $2$ מעלות. הקר ביותר: $-4$ מעלות.', '$2 - (-4) = 2 + 4 = 6$ מעלות.'] },
      { type: 'num', prompt: 'מה הסכום של שבע הטמפרטורות?', answer: -7, check: '-3-1+2+0-4+1-2', unit: 'מעלות',
        solution: ['השליליים יחד: $-3 - 1 - 4 - 2 = -10$.', 'החיוביים יחד: $2 + 1 = 3$. וכולם יחד: $-10 + 3 = -7$.'] },
      { type: 'num', prompt: 'הממוצע הוא הסכום חלקי מספר הימים. מה הטמפרטורה הממוצעת בשבוע הזה?', answer: -1, check: '(-3-1+2+0-4+1-2)/7', unit: 'מעלות',
        solution: ['הסכום $-7$, ויש $7$ ימים.', '$(-7) : 7 = -1$ מעלות.'] },
      { type: 'mc', prompt: 'בבוקר שאחרי שבת הטמפרטורה ירדה עוד ב־$3$ מעלות. כמה מעלות היו?', choices: [
        { text: '$-5$', ok: true, feedback: 'נכון: מ־$-2$ יורדים $3$, כלומר $-2 - 3 = -5$.' },
        { text: '$1$', ok: false, feedback: '$1$ הוא $3$ מעלות יותר מ־$-2$. ירידה היא למטה בציר: $-2 - 3 = -5$.' },
        { text: '$-1$', ok: false, feedback: 'מ־$-2$ יורדים $3$ מעלות, לא עולים $1$: $-2 - 3 = -5$.' },
      ] },
    ],
  },
  {
    // CLASSROOM-4: the factor's minus lost at the end, the mistake of the class's exercise 129 (with numbers of its own)
    id: 'signed:c4', topic: 'signed', after: 'signed:5', kind: 'error', title: 'המינוס שנעלם בסוף', minutes: 4, misc: 'factor-sign',
    parts: [
      { type: 'error', prompt: 'כך חישב יואב.',
        lines: ['צריך לחשב $-4[9 - (1 - 6)]$.', '$= -4[9 - (-5)]$', '$= 4 \\cdot 14 = 56$'], wrong: 2,
        why: 'הסוגריים חושבו נכון: $9 - (-5) = 14$. אבל המינוס של $-4$ נעלם בשורה האחרונה. $-4 \\cdot 14$ הוא שלילי.',
        lineWhy: { 0: 'זה רק התרגיל. הטעות מתחילה אחריו.', 1: '$1 - 6 = -5$, וה־$-4$ נשאר לפני הסוגריים. השורה הזאת נכונה.' },
        fix: { prompt: 'כמה זה $-4[9 - (1 - 6)]$?', answer: -56, check: '-4*(9-(1-6))' } },
      { type: 'mc', prompt: 'איך נכון לכתוב את השורה האחרונה?', choices: [
        { text: '$= -4 \\cdot 14 = -56$', ok: true, feedback: 'נכון: המינוס של $-4$ נשאר עד הסוף, וסימנים שונים נותנים שלילי.' },
        { text: '$= 4 \\cdot 14 = 56$', ok: false, feedback: 'כאן המינוס של $-4$ נעלם. הוא היה בשורה הקודמת, והוא נשאר גם בזו.' },
        { text: '$= -4 + 14 = 10$', ok: false, feedback: 'בין $-4$ לבין הסוגריים יש כפל, לא חיבור: $-4[14] = -4 \\cdot 14$.' },
      ] },
    ],
  },
  {
    // CLASSROOM-5: "a negative number to a power is positive", true for an even exponent only ((−2)³ = −8 is the
    // notebook's own exercise, so the examples are (−6)² and (−3)³)
    id: 'signed:c5', topic: 'signed', after: 'signed:7', kind: 'claim', title: 'מינוס בחזקה', minutes: 4, misc: 'pow-odd-pos',
    parts: [
      { type: 'claim', prompt: 'מתי הטענה נכונה?', claim: '"מספר שלילי בחזקה הוא מספר חיובי."', verdict: 'sometimes',
        why: 'במעריך זוגי המינוסים מתקזזים בזוגות: $(-6)^2 = (-6)(-6) = 36$. אבל במעריך אי־זוגי נשאר מינוס אחד: $(-3)^3 = (-3)(-3)(-3) = -27$.',
        example: {
          ask: 'תנו מעריך שבשבילו $(-3)$ בחזקה יוצא שלילי.', slots: [{ name: 'n', label: 'המעריך' }],
          domain: 'positive-int', expr: '(-3)^n', rel: '<', value: 0, hint: 'נסו מעריך אי־זוגי, למשל $3$.',
        } },
      { type: 'mc', prompt: 'מתי מספר שלילי בחזקה יוצא שלילי?', choices: [
        { text: 'כשהמעריך אי־זוגי', ok: true, feedback: 'נכון: כל זוג מינוסים נותן פלוס, ובמעריך אי־זוגי נשאר מינוס אחד. $(-3)^3 = -27$.' },
        { text: 'כשהמעריך זוגי', ok: false, feedback: 'במעריך זוגי כל המינוסים מתקזזים בזוגות: $(-6)^2 = 36$, חיובי.' },
        { text: 'כשהבסיס גדול מ־$5$', ok: false, feedback: 'הגודל של הבסיס לא קובע את הסימן: $(-6)^2 = 36$ חיובי, ו־$(-3)^3 = -27$ שלילי. קובע רק המעריך.' },
      ] },
    ],
  },
  {
    id: 'signed:c6', topic: 'signed', after: 'signed:2', kind: 'claim', title: 'מי רחוק יותר מאפס?', minutes: 5,
    parts: [
      { type: 'claim', prompt: 'מתי הטענה נכונה?', claim: '"מבין שני מספרים, הגדול רחוק יותר מ־$0$."', verdict: 'sometimes',
        why: 'בין שני מספרים חיוביים זה נכון: $7 > 3$, ו־$7$ רחוק יותר מ־$0$. אבל $-1 > -7$, ו־$-1$ דווקא קרוב יותר ל־$0$. בין שני מספרים שליליים, הגדול הוא הקרוב ל־$0$.',
        // a counterexample: a > b, and a is not farther from 0 than b (|a| ≤ |b|; whole numbers, so ≤ is < 0.5 more)
        example: {
          ask: 'תנו שני מספרים שלמים שבהם הגדול לא רחוק יותר מ־$0$.', slots: [{ name: 'a', label: 'המספר הגדול' }, { name: 'b', label: 'המספר הקטן' }],
          domain: 'int', expr: 'min(a - b, abs(b) - abs(a) + 0.5)', rel: '>', value: 0, hint: 'נסו שני מספרים שליליים.',
        } },
      { type: 'mc', prompt: 'מה הסדר של $-3, 2, -8, 0$, מהקטן לגדול?', choices: [
        { text: '$-8, -3, 0, 2$', ok: true, feedback: 'נכון: על הציר $-8$ הכי שמאלה, אחריו $-3$, ואחר כך $0$ ו־$2$.' },
        { text: '$0, 2, -3, -8$', ok: false, feedback: 'כאן הסדר הוא לפי המרחק מ־$0$. אבל כל מספר שלילי קטן מ־$0$: $-8 < -3 < 0 < 2$.' },
        { text: '$-3, -8, 0, 2$', ok: false, feedback: '$-8$ שמאלה מ־$-3$ על הציר, ולכן הוא הקטן מביניהם: $-8 < -3$.' },
      ] },
      { type: 'num', prompt: 'כמה מספרים שלמים גדולים מ־$-4$ וקטנים מ־$1$?', answer: 4, check: '1-(-4)-1',
        solution: ['המספרים השלמים שבין $-4$ ל־$1$ הם $-3, -2, -1, 0$.', 'יש ארבעה מספרים כאלה.'] },
    ],
  },
  {
    id: 'signed:c7', topic: 'signed', after: 'signed:4', kind: 'error', title: 'מה מחשבים קודם?', minutes: 6, misc: 'order',
    parts: [
      { type: 'error', prompt: 'כך חישב עידו.',
        lines: ['צריך לחשב $-2 + 6 \\cdot (-3)$.', '$= 4 \\cdot (-3)$', '$= -12$'], wrong: 1,
        why: 'כפל בא לפני חיבור. קודם $6 \\cdot (-3) = -18$, ורק אחר כך $-2 + (-18) = -20$. עידו חיבר קודם, משמאל לימין.',
        lineWhy: { 0: 'זה רק התרגיל. הטעות מתחילה אחריו.', 2: '$4 \\cdot (-3) = -12$ נכון. הטעות בשורה שלפניה.' },
        fix: { prompt: 'כמה זה $-2 + 6 \\cdot (-3)$?', answer: -20, check: '-2+6*(-3)' } },
      { type: 'mc', prompt: 'בתרגיל $10 - 12 : (-4) \\cdot 2$, מה מחשבים ראשון?', choices: [
        { text: '$12 : (-4)$', ok: true, feedback: 'נכון: כפל וחילוק לפני חיסור. ובין חילוק לכפל הולכים לפי הסדר, משמאל לימין.' },
        { text: '$10 - 12$', ok: false, feedback: 'חיסור בא אחרי כפל וחילוק. קודם $12 : (-4)$, אחר כך כופלים ב־$2$, ורק בסוף מחסרים.' },
        { text: '$(-4) \\cdot 2$', ok: false, feedback: 'כפל וחילוק באותה דרגה, ולכן הולכים לפי הסדר, משמאל לימין: קודם $12 : (-4)$.' },
      ] },
      { type: 'num', prompt: 'כמה זה $10 - 12 : (-4) \\cdot 2$?', answer: 16, check: '10-12/(-4)*2',
        solution: ['$12 : (-4) = -3$, ואחר כך $-3 \\cdot 2 = -6$.', '$10 - (-6) = 10 + 6$, כלומר $16$.'] },
    ],
  },
  {
    id: 'signed:c8', topic: 'signed', after: 'signed:6', kind: 'proof', title: 'למה חיסור של מספר שלילי הוא חיבור?', minutes: 7,
    parts: [
      { type: 'order', prompt: 'למה $a - (-b) = a + b$? סדרו את שלבי ההוכחה, מהראשון לאחרון.',
        steps: [
          { text: '$a - (-b)$ הוא מה שמוסיפים ל־$-b$ כדי להגיע ל־$a$.',
            reason: { choices: ['חיסור הוא הפעולה ההפוכה לחיבור', 'חיסור הוא כפל ב־$-1$', 'שני מינוסים הם פלוס'], answer: 0 } },
          { text: 'מ־$-b$ מוסיפים $b$, ומגיעים ל־$0$.',
            reason: { choices: ['מספר ועוד הנגדי שלו הם $0$', 'מספר ועוד $0$ הוא אותו מספר', 'מינוס ועוד פלוס הם מינוס'], answer: 0 } },
          { text: 'מ־$0$ מוסיפים עוד $a$, ומגיעים ל־$a$.' },
          { text: 'בסך הכול הוספנו $b + a$. לכן $a - (-b) = a + b$.' },
        ] },
      { type: 'num', prompt: 'כמה זה $-\\frac{3}{4} - \\left(-2\\frac{1}{2}\\right)$? אפשר לכתוב שבר או מספר עשרוני.', answer: 1.75, check: '-3/4-(-(2+1/2))',
        solution: ['מחסרים מספר שלילי, ולכן מוסיפים את הנגדי שלו: $-\\frac{3}{4} + 2\\frac{1}{2}$.', '$2\\frac{2}{4} - \\frac{3}{4} = 1\\frac{3}{4}$, כלומר $1.75$.'] },
      { type: 'num', prompt: 'וכמה זה $-1.2 - (-0.5)$?', answer: -0.7, check: '-1.2-(-0.5)',
        solution: ['מוסיפים את הנגדי: $-1.2 + 0.5$.', 'מ־$-1.2$ זזים $0.5$ ימינה על הציר, ומגיעים ל־$-0.7$.'] },
    ],
  },
];
