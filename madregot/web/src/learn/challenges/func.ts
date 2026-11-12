// Challenge tasks of the functions unit (stage5.md FUNC-7; Critique notes 21 and 22): func:c1, a claim that a uniform
// rate starts at 0 (from-zero); func:c2, a graph read right to left (rtl-read); func:c3, a bicycle ride read off its
// graph: a rest, two speeds and the average. Their numbers are checked by the lane's spec/facts.mjs and critique/check.mjs,
// and by learn/challenges.test.ts.
import type { ChallengeTask, FigSpec } from '../types';

/** Tal's graph: up from (0, 1) to the peak (3, 7), down to (8, 2), flat to 10. */
const TAL_FIG: FigSpec = {
  type: 'sgraph', x: { max: 10, step: 1, label: 'x' }, y: { max: 8, step: 1, label: 'y' },
  series: [{ pts: [[0, 1], [3, 7], [8, 2], [10, 2]] }],
};
/** Yoav's ride: 6 km in the first 20 minutes, a rest until minute 35, 5 km more by minute 60. */
const RIDE_FIG: FigSpec = {
  type: 'sgraph', x: { max: 60, step: 5, every: 2, label: 'זמן', unit: 'דקות' }, y: { max: 12, step: 1, every: 2, label: 'מרחק מהבית', unit: 'ק״מ' },
  series: [{ pts: [[0, 0], [20, 6], [35, 6], [60, 11]] }],
};

export const FUNC_CHALLENGES: ChallengeTask[] = [
  {
    // "משתנה", not "מתחממים": the slot takes any whole start, and a start above 20° is water that cools; every start but
    // 0 is then a true counterexample (Critique note 21)
    id: 'func:c1', topic: 'func', after: 'func:4', kind: 'claim', title: 'התחלה מאפס?', minutes: 4, misc: 'from-zero',
    parts: [
      { type: 'claim', prompt: 'מתי הטענה נכונה?', claim: '"הטמפרטורה של מים משתנה בקצב אחיד. אחרי $2$ דקות היא $20^\\circ$, ולכן אחרי $4$ דקות היא $40^\\circ$."', verdict: 'sometimes',
        why: 'רק אם התחילו מ־$0^\\circ$. אם התחילו מ־$8^\\circ$, הקצב $6^\\circ$ בדקה, ואחרי $4$ דקות $32^\\circ$.',
        example: {
          ask: 'תנו טמפרטורת התחלה שבה הטענה לא נכונה.', slots: [{ name: 's', label: 'הטמפרטורה בהתחלה' }],
          // from s at the start to 20 after 2 minutes, (20 − s) : 2 a minute: after 4 minutes s + 4 · (20 − s) : 2 = 40 − s
          domain: 'positive-int', expr: '40 - s', rel: '!=', value: 40, hint: 'נסו $8^\\circ$.',
        } },
      // the spec's question, asked after the verdict: when exactly does the claim hold
      { type: 'mc', prompt: 'ומתי בדיוק הטענה נכונה?', choices: [
        { text: 'כשההתחלה $0^\\circ$', ok: true, feedback: 'נכון: רק מ־$0^\\circ$ עולים $10^\\circ$ בכל דקה, וב־$4$ דקות מגיעים ל־$40^\\circ$.' },
        { text: 'תמיד, כי הקצב אחיד', ok: false, feedback: 'קצב אחיד לא אומר שההתחלה $0$. מ־$8^\\circ$ הקצב $6^\\circ$ בדקה, ואחרי $4$ דקות $32^\\circ$.' },
        { text: 'אף פעם', ok: false, feedback: 'מ־$0^\\circ$ זה נכון: $20^\\circ$ בשתי דקות הם $10^\\circ$ בדקה, ואחרי $4$ דקות $40^\\circ$.' },
      ] },
    ],
  },
  {
    id: 'func:c2', topic: 'func', after: 'func:3', kind: 'error', title: 'הקריאה של טל', minutes: 4, misc: 'rtl-read', fig: TAL_FIG,
    parts: [
      { type: 'error', prompt: 'כך קרא טל את הגרף.',
        lines: ['הגרף מתחיל ב־$(0, 1)$ ומגיע לשיא ב־$(3, 7)$.', 'לכן הפונקציה עולה כש־$3 < x < 8$.', 'והיא קבועה כש־$8 < x < 10$.'], wrong: 1,
        why: 'בין $3$ ל־$8$, כש־$x$ גדל, $y$ קטן מ־$7$ ל־$2$: הפונקציה יורדת. טל קרא מימין לשמאל.',
        fix: { prompt: 'כמה יחידות על ציר $x$ הפונקציה עולה?', answer: 3, check: '3-0' } },
      { type: 'num', prompt: 'וכמה יחידות על ציר $x$ היא יורדת?', answer: 5, check: '8-3',
        solution: ['משמאל לימין: מהשיא ב־$x = 3$ הגרף יורד עד $x = 8$.', 'את האורך מודדים על ציר $x$: $8 - 3 = 5$'] },
    ],
  },
  {
    // the plan's (60, 12) made the average 12, the last part's own speed, so a student who answered that speed was marked
    // right; with (60, 11) the speeds are 18 and 12 and the average 11 (Critique note 22)
    id: 'func:c3', topic: 'func', after: 'func:4', kind: 'literacy', title: 'הרכיבה של יואב', minutes: 8, fig: RIDE_FIG,
    story: 'יואב רכב על אופניים. הגרף מראה את המרחק שלו מהבית (ק״מ) לפי הזמן (דקות).',
    parts: [
      { type: 'num', prompt: 'כמה דקות נח יואב?', answer: 15, check: '35-20', unit: 'דקות',
        solution: ['יואב נח כשהמרחק מהבית לא השתנה: הקו שטוח מהדקה ה־$20$ עד הדקה ה־$35$.', '$35 - 20 = 15$ דקות'] },
      { type: 'num', prompt: 'מה הייתה המהירות שלו ב־$20$ הדקות הראשונות, בקמ״ש?', answer: 18, check: '6/20*60', unit: 'קמ״ש',
        solution: ['ב־$20$ הדקות הראשונות הוא עבר $6$ ק״מ.', 'שעה היא $60$ דקות, פי $3$ מ־$20$: $6 \\cdot 3 = 18$ קמ״ש'] },
      { type: 'mc', prompt: 'באיזה קטע רכב מהר יותר?', choices: [
        { text: 'בקטע הראשון', ok: true, feedback: '$18$ קמ״ש לעומת $12$: הקו הראשון תלול יותר.' },
        { text: 'בקטע האחרון, כי הוא גבוה יותר', ok: false, feedback: 'גבוה אומר רחוק מהבית, לא מהר.' },
        { text: 'באותה מהירות', ok: false, feedback: 'בקטע האחרון $5$ ק״מ ב־$25$ דקות, כלומר $12$ קמ״ש. בקטע הראשון $18$.' },
      ] },
      { type: 'num', prompt: 'מה המהירות הממוצעת שלו בכל השעה, בקמ״ש?', answer: 11, check: '11/60*60', unit: 'קמ״ש',
        solution: ['בכל השעה, עם המנוחה, הוא עבר $11$ ק״מ.', 'מהירות ממוצעת היא כל הדרך חלקי כל הזמן: $11$ ק״מ בשעה אחת, כלומר $11$ קמ״ש'] },
    ],
  },
];
