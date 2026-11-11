// Challenge tasks of ratio (curriculum stage 1, CURRICULUM-6.5): ratio:c1, someone's solution of sharing in a ratio,
// with the error to find and fix. Checked by learn/challenges.test.ts.
import type { ChallengeTask } from '../types';

export const RATIO_CHALLENGES: ChallengeTask[] = [
  {
    id: 'ratio:c1', topic: 'ratio', after: 'ratio:2', kind: 'error', title: 'הטעות של רוני', minutes: 4,
    parts: [
      { type: 'error', prompt: 'כך פתר רוני.',
        lines: ['חילקו $56$ גולות בין אורי לדן ביחס $2 : 5$.', 'לאורי: $\\frac{2}{5} \\cdot 56 = 22.4$', 'לדן: $56 - 22.4 = 33.6$'], wrong: 1,
        why: '$\\frac{2}{5}$ הוא היחס בין אורי לדן, לא החלק של אורי מכל הגולות: מכל הגולות לאורי $\\frac{2}{7}$. וגם $22.4$ גולות אינו מספר שלם.',
        fix: { prompt: 'כמה גולות מקבל אורי?', answer: 16, check: '56/7*2' } },
      { type: 'mc', prompt: 'איך אפשר היה לחשוד בטעות בלי לחשב?', choices: [
        { text: 'אי אפשר לקבל חלק של גולה', ok: true, feedback: 'נכון: $22.4$ גולות לא יכול להיות. תשובה שאינה מספר שלם של גולות מסמנת טעות.' },
        { text: '$22.4$ גדול מדי', ok: false, feedback: '$22.4$ לא גדול מדי: אורי מקבל פחות מחצי. מה שחשוד הוא החלק של גולה.' },
        { text: 'אי אפשר לדעת', ok: false, feedback: 'אפשר: גולות סופרים במספרים שלמים, ו־$22.4$ אינו מספר שלם.' },
      ] },
    ],
  },
];
