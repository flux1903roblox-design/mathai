// Challenge tasks of angles (curriculum stage 1, CURRICULUM-6.5): angles:c1, the proof that a triangle's angles add up
// to 180°, put in order with the reason for each step. Checked by learn/challenges.test.ts.
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
];
