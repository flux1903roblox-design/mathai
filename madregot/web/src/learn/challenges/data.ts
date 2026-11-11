// Challenge tasks of data and frequency (curriculum stage 3, DATA-7): data:c1, a real-world choice between two shooters
// by their success rate (the Ministry's shooters, retold); data:c2, a claim about more players and a larger share;
// data:c3, a probability over the old total after a survey grew (RAMA's structure, retold with 300, 10% and 60).
// Their numbers are checked by web/scripts/verify/facts-stage3.mjs and by learn/challenges.test.ts.
import type { ChallengeTask } from '../types';

export const DATA_CHALLENGES: ChallengeTask[] = [
  {
    id: 'data:c1', topic: 'data', after: 'data:3', kind: 'literacy', title: 'הקלע המצטיין', minutes: 6, misc: 'bigger-count',
    story: 'לקראת הגמר המאמן בודק שני שחקנים. עידו זרק $20$ פעמים וקלע $12$; נועם זרק $10$ וקלע $7$.',
    parts: [
      { type: 'num', prompt: 'איזה אחוז מהזריקות שלו קלע עידו?', answer: 60, check: '12/20*100', unit: '%',
        solution: ['$\\frac{12}{20} = \\frac{60}{100}$', 'עידו קלע ב־$60\\%$ מהזריקות.'] },
      { type: 'num', prompt: 'ואיזה אחוז קלע נועם?', answer: 70, check: '7/10*100', unit: '%',
        solution: ['$\\frac{7}{10} = \\frac{70}{100}$', 'נועם קלע ב־$70\\%$ מהזריקות.'] },
      { type: 'mc', prompt: 'המאמן אומר: "עידו קלע כמעט פי $2$ סלים, אז הוא יזרוק." מה חסר בשיקול?', choices: [
        { text: 'הוא השווה מספרי סלים ולא אחוזי הצלחה', ok: true, feedback: 'נכון: עידו זרק פי $2$ יותר. בחלק מהזריקות נועם מדויק יותר, $70\\%$ מול $60\\%$.' },
        { text: 'עידו באמת מדויק יותר', ok: false, feedback: 'עידו קלע $60\\%$ מהזריקות ונועם $70\\%$. נועם מדויק יותר.' },
        { text: 'שום דבר', ok: false, feedback: 'כשמספרי הזריקות שונים, משווים חלקים: $\\frac{12}{20}$ מול $\\frac{7}{10}$.' },
      ] },
      { type: 'num', prompt: 'כמה סלים מתוך $20$ זריקות היה עידו צריך לקלוע כדי להגיע לאחוז של נועם?', answer: 14, check: '0.7*20',
        solution: ['$70\\%$ מ־$20$ זריקות:', '$0.7 \\cdot 20 = 14$ סלים.'] },
    ],
  },
  {
    id: 'data:c2', topic: 'data', after: 'data:2', kind: 'claim', title: 'יותר מנגנים, חלק גדול יותר?', minutes: 4,
    parts: [
      { type: 'claim', prompt: 'מתי הטענה נכונה?', claim: '"בכיתה שבה יותר תלמידים מנגנים, השכיחות היחסית של המנגנים גדולה יותר."', verdict: 'sometimes',
        why: 'בכיתה אחת $20$ מתוך $40$, כלומר $0.5$; בכיתה אחרת $15$ מתוך $25$, כלומר $0.6$. יותר מנגנים, חלק קטן יותר. ובשתי כיתות של $30$, יותר מנגנים הם גם חלק גדול יותר.' },
      { type: 'mc', prompt: 'מה צריך לדעת כדי להשוות?', choices: [
        { text: 'את גודל כל כיתה', ok: true, feedback: 'נכון: השכיחות היחסית היא המנגנים חלקי כל התלמידים בכיתה.' },
        { text: 'רק את מספר המנגנים', ok: false, feedback: '$20$ מנגנים מתוך $40$ הם חלק קטן יותר מ־$15$ מתוך $25$.' },
        { text: 'את שמות התלמידים', ok: false, feedback: 'השמות לא משנים את החלק. צריך את מספר התלמידים בכל כיתה.' },
      ] },
    ],
  },
  {
    id: 'data:c3', topic: 'data', after: 'data:4', kind: 'error', title: 'סקר שגדל', minutes: 5, misc: 'old-total',
    parts: [
      { type: 'error', prompt: 'כך פתרה מאיה.',
        lines: [
          'בסקר $300$ תלמידים, ו־$10\\%$ מהם לא בשום חוג: $30$ תלמידים.',
          'הצטרפו $60$ תלמידים, וכולם לא בשום חוג. עכשיו $90$ כאלה.',
          'ההסתברות לבחור באקראי אחד מהם: $\\frac{90}{300} = 0.3$.',
        ], wrong: 2,
        why: 'גם השלם גדל: $300 + 60 = 360$ תלמידים. בוחרים מבין כולם.',
        fix: { prompt: 'מה ההסתברות?', answer: 0.25, check: '90/360' } },
      { type: 'explain', prompt: 'למה צריך לשנות גם את המכנה?',
        rubric: ['אמרתי שהשלם השתנה', 'אמרתי שהחלק והשלם הם מאותה קבוצה'],
        sample: 'בוחרים מבין כל $360$ התלמידים, גם מבין החדשים, ולכן מחלקים ב־$360$: $\\frac{90}{360} = 0.25$.' },
    ],
  },
];
