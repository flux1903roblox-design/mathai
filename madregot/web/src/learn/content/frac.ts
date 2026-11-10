// Fractions and decimals (שברים ועשרוניים): the bridge unit, the floor under grade 7 (curriculum stage 1). A student
// who cannot place 3/5 on a number line or tell 0.4 from 0.25 is found by evidence and sent here; one who can never
// sees it. Two stairs now (frac:1 and frac:2); adding, subtracting, multiplying and dividing come next (frac:3-4).
//
// One picture carries the unit: a fraction is a place on the number line. Cut each unit into equal parts and count
// parts (gaps, not marks); equal fractions are the same place; a decimal is compared digit by digit after padding.
// The diagnostic models are the plan's (content/frac.js FRAC1, FRAC1T, FRAC2, FRAC2T, ported unchanged); every
// misconception's source is listed in content/frac.js. Every number written here is checked by the lane's
// verify/facts-frac.mjs, and the maths of every step by learn/content.test.ts.
// Teaching content: see MADREGOT2.md (content conventions) and content/signed.ts (the quality bar).
import type { DiagModel, FigSpec, StairContent, ManipSpec } from '../types';
// @ts-ignore: plain JS, the practice generators' draws, texts and worked solutions
import * as G from '@/content/frac.js';
// @ts-ignore: plain JS helpers shared with the exercise generators
import { listMath } from '@/content/util.js';

const F = (n: number, d: number) => `\\frac{${n}}{${d}}`;
/** A number line 0..to cut into den parts, with points named by letters at k/den. */
const line = (to: number, den: number, marks: { k: number; label?: string }[] = [], extra: Record<string, unknown> = {}): FigSpec =>
  ({ type: 'numline', from: 0, to, den, marks: marks.map((m) => ({ x: m.k / den, ...(m.label ? { label: m.label } : {}) })), ...extra });
const bars = (rows: { den: number; shaded: number; label?: string }[], extra: Record<string, unknown> = {}): FigSpec => ({ type: 'fbar', rows, ...extra });
const cutLine = (max: number, den: number, extra: Record<string, unknown> = {}): ManipSpec => ({ kind: 'numberline', min: 0, max, from: 0, start: 0, den, ...extra });
const pins = (labels: string[], den: number): ManipSpec => ({ kind: 'pins', min: 0, max: 1, den, fmt: 'dec', labels, start: labels.map(() => 0) });

// ================================================================ stair 1: a fraction and equal fractions

type P1 = { d: number; L: number; k: number };
const frac1: DiagModel<P1> = {
  params: (rnd) => G.FRAC1.params(rnd),
  text: (p) => G.pointText(p),
  fig: (p) => G.pointFig(p),
  answer: (p) => G.FRAC1.answer(p),
  bugs: G.FRAC1.bugs,
  solution: (p) => G.pointSolution(p),
  hint: () => G.pointHint(),
  precise: true,
};
type P1T = { a: number; b: number; m: number; c: number };
const frac1T: DiagModel<P1T> = {
  params: (rnd) => G.FRAC1T.params(rnd),
  text: (p) => `פיצה חתוכה ל־$${p.b}$ משולשים שווים, ודנה אכלה ${p.a === 1 ? 'משולש אחד' : `$${p.a}$ מהם`}. פיצה זהה חתוכה ל־$${p.c}$ משולשים. כמה משולשים צריך לאכול ממנה כדי לאכול אותה כמות?`,
  answer: (p) => G.FRAC1T.answer(p),
  bugs: G.FRAC1T.bugs,
  solution: (p) => [
    `$${p.c} : ${p.b} = ${p.m}$: כל משולש של הפיצה הראשונה הוא $${p.m}$ משולשים של השנייה.`,
    `לכן כופלים גם את מספר המשולשים שנאכלו: $${p.a} \\cdot ${p.m} = ${p.a * p.m}$`,
    `$${F(p.a, p.b)} = ${F(p.a * p.m, p.c)}$`,
  ],
  hint: () => 'פי כמה יותר משולשים יש בפיצה השנייה? גם המשולשים שאוכלים, פי אותו מספר.',
};

const stair1: StairContent = {
  skill: 'frac:1', topic: 'frac', level: 1, title: 'שבר ושברים שווים',
  objectives: [
    'לראות שבר כמקום על ציר המספרים: מחלקים את היחידה לחלקים שווים וסופרים.',
    'להרחיב ולצמצם שבר בלי לשנות את ערכו.',
    'לזהות שברים שווים.',
  ],
  idea: 'שבר הוא מספר: מחלקים את היחידה לחלקים שווים וסופרים חלקים. שברים שווים הם אותו מקום על הציר.',
  why: [
    'בהרחבה כופלים את המונה ואת המכנה באותו מספר: החלקים קטנים פי כמה, ויש פי כמה יותר מהם, ולכן הכמות לא משתנה.',
    'הוספה של אותו מספר למונה ולמכנה משנה את הכמות: $\\frac{1}{2}$ ו־$\\frac{2}{3}$ אינם באותו מקום על הציר.',
  ],
  alt: ['פיצה: חצי פיצה הם $4$ משולשים מתוך $8$. אותה כמות, חתוכה דק יותר.'],
  discover: [
    { kind: 'say', text: 'שבר הוא מספר, ויש לו מקום על ציר המספרים. כדי למצוא אותו מחלקים כל יחידה לחלקים שווים.',
      fig: line(1, 4, [], { anim: true }) },
    { kind: 'predict', text: 'איזה מספר מסומן ב־$A$?', fig: line(1, 5, [{ k: 3, label: 'A' }]),
      choices: ['$\\frac{3}{5}$', '$\\frac{3}{4}$', '$3$'], answer: 0,
      why: 'בין $0$ ל־$1$ יש $5$ רווחים שווים, ו־$A$ נמצאת אחרי $3$ מהם: $\\frac{3}{5}$.',
      wrongWhy: { 1: 'ספרתם $4$ שנתות. אבל $4$ שנתות מחלקות את היחידה ל־$5$ חלקים: סופרים רווחים, לא קווים.', 2: '$3$ הוא שלוש יחידות שלמות, רחוק מימין ל־$1$.' } },
    { kind: 'rule', text: 'השבר $\\frac{a}{b}$: מחלקים את היחידה ל־$b$ חלקים שווים, וסופרים $a$ חלקים מ־$0$.',
      why: 'המכנה הוא מספר החלקים ביחידה, לא מספר השנתות. השנתות הן הגבולות בין החלקים.',
      fig: line(1, 5, [{ k: 3, label: 'A' }], { jumps: [1, 2, 3, 4, 5].map((k) => ({ from: (k - 1) / 5, to: k / 5, label: String(k) })) }) },
    { kind: 'predict', text: 'הציר הזה ממשיך עד $2$. איזה מספר מסומן ב־$A$?', fig: line(2, 4, [{ k: 3, label: 'A' }]),
      choices: ['$\\frac{3}{4}$', '$\\frac{3}{8}$', '$\\frac{3}{2}$'], answer: 0,
      why: 'היחידה היא תמיד מ־$0$ עד $1$, והיא מחולקת ל־$4$.',
      wrongWhy: { 1: 'ספרתם את כל הציר כיחידה אחת. גם כשהציר ארוך, השלם הוא הקטע מ־$0$ עד $1$.', 2: '$\\frac{3}{2}$ הוא יותר מ־$1$, ו־$A$ נמצאת לפני $1$.' } },
    { kind: 'explore', text: 'שימו את הסמן על $\\frac{5}{3}$.', manip: cutLine(2, 3), answer: 5 / 3,
      hint: 'כל יחידה מחולקת ל־$3$. $\\frac{5}{3}$ הם $5$ חלקים כאלה: יחידה שלמה ועוד $2$.',
      success: '$\\frac{5}{3} = 1\\frac{2}{3}$: אחרי $1$, ועוד שני שלישים.' },
    { kind: 'predict', text: '$\\frac{1}{2}$ ו־$\\frac{3}{6}$: אותו מקום על הציר?',
      fig: bars([{ den: 2, shaded: 1, label: '\\frac{1}{2}' }, { den: 6, shaded: 3, label: '\\frac{3}{6}' }]),
      choices: ['כן', 'לא, $\\frac{3}{6}$ גדול יותר'], answer: 0,
      why: '$\\frac{3}{6}$ הם שלושה חלקים, כל אחד קטן פי $3$ מחצי: $1 \\cdot 3 = 3$ ו־$2 \\cdot 3 = 6$.',
      wrongWhy: { 1: 'יש יותר חלקים, אבל כל חלק קטן יותר. שני הפסים צבועים עד אותו מקום.' } },
    { kind: 'explore', text: 'הפס מראה $\\frac{2}{3}$. חלקו אותו ל־$12$ חלקים, וצבעו אותה כמות.',
      manip: { kind: 'fbar', start: { den: 3, shaded: 2 }, marks: [2 / 3] }, answer: { mode: 'exact', den: 12, shaded: 8 },
      hint: 'כל שליש נחתך ל־$4$. כמה חלקים קטנים בשני שלישים?',
      success: '$\\frac{2}{3} = \\frac{8}{12}$: אותה כמות, בחלקים קטנים פי $4$.' },
    { kind: 'rule', text: 'הרחבה וצמצום: כופלים או מחלקים את המונה ואת המכנה באותו מספר.',
      display: '\\frac{2}{3} = \\frac{2 \\cdot 4}{3 \\cdot 4} = \\frac{8}{12}',
      why: 'הוספה של אותו מספר משנה את הכמות: $\\frac{2}{3}$ הם $\\frac{4}{6}$, ו־$\\frac{5}{6}$ כבר יותר.',
      fig: bars([{ den: 3, shaded: 2 }, { den: 12, shaded: 8 }], { labels: true }) },
  ],
  examples: [
    { problem: 'איזה מספר מסומן ב־$A$?', fig: line(2, 5, [{ k: 7, label: 'A' }]), answer: 1.4, check: '7/5',
      steps: [
        { action: 'סופרים את החלקים בין $0$ ל־$1$.', why: '$4$ שנתות בפנים יוצרות $5$ רווחים: סופרים רווחים, לא קווים.', result: '4 + 1 = 5', calc: { expr: '4 + 1', value: 5 } },
        { action: 'סופרים חלקים מ־$0$ עד $A$.', why: 'כל חלק הוא $\\frac{1}{5}$, ו־$A$ נמצאת $7$ חלקים מ־$0$.', result: '\\frac{7}{5}', value: '7/5' },
        { action: 'כותבים כמספר מעורב.', why: '$5$ חמישיות הן יחידה שלמה, ועוד $2$ חמישיות.', result: '\\frac{7}{5} = 1\\frac{2}{5}', value: '1 + 2/5' },
      ] },
    { problem: 'השלימו: $\\frac{3}{4} = \\frac{\\square}{20}$', answer: 15, check: '3*20/4',
      steps: [
        { action: 'פי כמה גדל המכנה?', why: 'מ־$4$ ל־$20$.', result: '20 : 4 = 5', calc: { expr: '20/4', value: 5 } },
        { action: 'גם המונה גדל פי $5$.', why: 'בהרחבה כופלים את המונה ואת המכנה באותו מספר.', result: '3 \\cdot 5 = 15', value: '3*5' },
        { action: 'כותבים את השבר השווה.', why: 'אותה כמות, בחלקים קטנים פי $5$.', result: '\\frac{3}{4} = \\frac{15}{20}', calc: { expr: '15/20', value: 0.75 } },
      ] },
    { problem: 'צמצמו עד הסוף: $\\frac{18}{24}$', answer: 0.75, check: '18/24',
      steps: [
        { action: 'מחפשים את המחלק המשותף הגדול ביותר.', why: 'גם $18$ וגם $24$ מתחלקים ב־$6$, ואין מספר גדול יותר שמחלק את שניהם.', result: '18 : 6 = 3', calc: { expr: '18/6', value: 3 } },
        { action: 'מחלקים גם את המכנה ב־$6$.', why: 'בצמצום מחלקים את המונה ואת המכנה באותו מספר.', result: '24 : 6 = 4', calc: { expr: '24/6', value: 4 } },
        { action: 'כותבים את השבר המצומצם.', why: '$3$ ו־$4$ כבר לא מתחלקים יחד באף מספר חוץ מ־$1$.', result: '\\frac{18}{24} = \\frac{3}{4}', value: '3/4' },
      ] },
  ],
  together: [
    { problem: 'השלימו: $\\frac{2}{5} = \\frac{\\square}{15}$.',
      steps: [
        { prompt: 'פי כמה גדל המכנה?', choices: [
          { text: 'פי $3$', ok: true, feedback: 'נכון: $5 \\cdot 3 = 15$.' },
          { text: 'ב־$10$', ok: false, feedback: 'הוספה משנה את הכמות. בשבר שואלים "פי כמה".' },
          { text: 'פי $15$', ok: false, feedback: '$5 \\cdot 15$ הוא $75$, לא $15$.' },
        ], hints: ['במכנה היה $5$, ועכשיו $15$.', '$15 : 5 = 3$.'], done: 'המכנה גדל פי $3$.' },
      ],
      final: { prompt: 'מה המונה?', answer: 6, check: '2*3', hints: ['גם המונה גדל פי $3$.', '$2 \\cdot 3$.'] } },
    { problem: 'איזה מספר מסומן ב־$A$?', fig: line(1, 6, [{ k: 5, label: 'A' }]),
      steps: [
        { prompt: 'לכמה חלקים מחולקת היחידה?', choices: [
          { text: '$6$', ok: true, feedback: 'נכון: $5$ שנתות בפנים יוצרות $6$ רווחים.' },
          { text: '$5$', ok: false, feedback: 'יש $5$ שנתות, והן יוצרות $6$ חלקים.' },
          { text: '$1$', ok: false, feedback: 'היחידה היא הקטע מ־$0$ עד $1$, וכאן היא חתוכה לחלקים קטנים.' },
        ], hints: ['סופרים את הרווחים בין $0$ ל־$1$, לא את הקווים.', 'יש $5$ קווים בפנים, ורווח אחד יותר.'], done: 'כל חלק הוא $\\frac{1}{6}$.' },
      ],
      final: { prompt: 'מה המספר ב־$A$? כתבו כשבר.', answer: 5 / 6, check: '5/6', precise: true, hints: ['כמה חלקים של $\\frac{1}{6}$ יש מ־$0$ עד $A$?', '$5$ חלקים של $\\frac{1}{6}$.'] } },
  ],
  diag: frac1,
  transfer: frac1T,
  words: ['שבר', 'מונה', 'מכנה', 'חלקים שווים', 'שנתה', 'הרחבה', 'צמצום', 'שברים שווים'],
  misconceptions: [
    { id: 'count-marks', title: 'ספרו את השנתות במקום את החלקים',
      cause: 'סופרים את מה שרואים, את הקווים. אבל שבר סופר רווחים: $4$ שנתות יוצרות $5$ חלקים.',
      explain: ['המכנה הוא מספר החלקים השווים ביחידה.', 'בין $0$ ל־$1$ סופרים רווחים: $4$ קווים בפנים, $5$ רווחים.'],
      remedy: [
        { kind: 'predict', text: 'איזה מספר מסומן ב־$A$?', fig: line(1, 5, [{ k: 2, label: 'A' }]), choices: ['$\\frac{2}{5}$', '$\\frac{2}{4}$'], answer: 0,
          why: '$4$ שנתות בפנים, ולכן $5$ חלקים. $A$ נמצאת אחרי $2$ מהם: $\\frac{2}{5}$.' },
        { kind: 'explore', text: 'שימו את הסמן על $\\frac{3}{4}$.', manip: cutLine(1, 4), answer: 3 / 4,
          hint: 'כמה רווחים יש בין $0$ ל־$1$? ספרו $3$ מהם.', success: '$3$ רווחים מתוך $4$: $\\frac{3}{4}$.' },
      ] },
    { id: 'whole-line', title: 'התייחסו לכל הציר כאל יחידה אחת',
      cause: 'כשהציר ארוך מ־$1$, נדמה שכל הציר הוא השלם. השלם הוא תמיד הקטע מ־$0$ עד $1$.',
      explain: ['על ציר מ־$0$ עד $2$ יש שתי יחידות.', 'סופרים חלקים של יחידה אחת, מ־$0$ עד $1$, ולא של כל הציר.'],
      remedy: [
        { kind: 'predict', text: 'איזה מספר מסומן ב־$A$?', fig: line(2, 3, [{ k: 2, label: 'A' }]), choices: ['$\\frac{2}{3}$', '$\\frac{2}{6}$'], answer: 0,
          why: 'היחידה מ־$0$ עד $1$ מחולקת ל־$3$, ו־$A$ נמצאת אחרי $2$ חלקים: $\\frac{2}{3}$.' },
        { kind: 'explore', text: 'שימו את הסמן על $\\frac{5}{4}$.', manip: cutLine(2, 4), answer: 5 / 4,
          hint: 'כל יחידה מחולקת ל־$4$. $\\frac{5}{4}$ הם יחידה שלמה ועוד חלק אחד.', success: '$\\frac{5}{4} = 1\\frac{1}{4}$: אחרי $1$, ועוד רבע.' },
      ] },
    { id: 'add-same', title: 'הוסיפו אותו מספר למונה ולמכנה במקום לכפול',
      cause: 'בחשבון של שלמים "אותו דבר לשני הצדדים" שומר על ההפרש. בשבר שומרים על היחס, ולכן כופלים.',
      explain: ['$\\frac{1}{2}$ ועוד $1$ למעלה ולמטה הוא $\\frac{2}{3}$, וזה יותר מחצי.', 'מרחיבים בכפל: $\\frac{1}{2} = \\frac{1 \\cdot 4}{2 \\cdot 4} = \\frac{4}{8}$.'],
      remedy: [
        { kind: 'predict', text: 'השלימו: $\\frac{1}{2} = \\frac{?}{8}$', fig: bars([{ den: 2, shaded: 1 }]), choices: ['$4$', '$7$'], answer: 0,
          why: 'המכנה גדל פי $4$, ולכן גם המונה: $1 \\cdot 4 = 4$. ו־$\\frac{7}{8}$ הוא כמעט פס שלם, לא חצי.' },
        { kind: 'explore', text: 'הפס מראה $\\frac{1}{2}$. חלקו אותו ל־$8$ חלקים, וצבעו אותה כמות.',
          manip: { kind: 'fbar', start: { den: 2, shaded: 1 }, marks: [1 / 2] }, answer: { mode: 'exact', den: 8, shaded: 4 },
          hint: 'כל חצי נחתך ל־$4$. כמה חלקים קטנים בחצי?', success: '$\\frac{1}{2} = \\frac{4}{8}$: כפלנו את המונה ואת המכנה ב־$4$.' },
      ] },
  ],
};

// ================================================================ stair 2: comparing fractions and decimals

type P2 = { k: 0 | 1; a: number; b: number; c: number; e: number; n: number; x: number; y: number; w: number; z: number; ord: number[] };
const order4 = (rnd: () => number) => { const o = [0, 1, 2, 3]; for (let i = 3; i > 0; i -= 1) { const j = Math.floor(rnd() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; } return o; };
const frac2: DiagModel<P2> = {
  // four numbers in a shuffled order (the order is part of the question, so it is drawn with it)
  params: (rnd) => ({ ...G.FRAC2.params(rnd), ord: order4(rnd) }),
  text: (p) => G.biggestText(G.biggestList(p, p.ord)),
  answer: (p) => G.FRAC2.answer(p),
  bugs: G.FRAC2.bugs,
  solution: (p) => G.biggestSolution(p),
  hint: (p) => G.biggestHint(p),
  precise: true,
  fmt: 'dec',
};
type P2T = { a: number; b: number; c: number; e: number; ord: number[] };
const jumps2 = (p: P2T) => p.ord.map((i) => [p.a, p.b, p.c, p.e][i]);
const frac2T: DiagModel<P2T> = {
  params: (rnd) => ({ ...G.FRAC2T.params(rnd), ord: order4(rnd) }),
  text: (p) => { const j = jumps2(p).map(G.dec); return `בתחרות קפיצה לרוחק קפצו ארבעה ילדים: ${listMath(j.slice(0, 3))} ו־$${j[3]}$ מטר. כמה קפץ המנצח?`; },
  answer: (p) => G.FRAC2T.answer(p),
  bugs: G.FRAC2T.bugs,
  solution: (p) => {
    const pad = (v: number) => G.dec(v).padEnd(5, '0');
    return [
      `משלימים לשלוש ספרות אחרי הנקודה: ${listMath(jumps2(p).map(pad))}.`,
      `משווים את מה שאחרי הנקודה, באלפיות: $${Math.round((p.b - 1) * 1000)}$ הוא הגדול.`,
      `המנצח קפץ $${G.dec(p.b)}$ מטר.`,
    ];
  },
  hint: () => 'לכולם $1$ מטר ועוד משהו. השלימו אפסים בסוף עד שיש אותו מספר ספרות, והשוו.',
  unit: 'מטר',
  precise: true,
  fmt: 'dec',
};

const stair2: StairContent = {
  skill: 'frac:2', topic: 'frac', level: 2, title: 'השוואת שברים ועשרוניים',
  objectives: [
    'להשוות שברים: באותו מכנה, באותו מונה, ובעזרת הרחבה.',
    'להשוות מספרים עשרוניים לפי ערך המקום, לא לפי מספר הספרות.',
    'לעבור בין שבר לעשרוני: $\\frac{3}{4} = 0.75$.',
  ],
  idea: 'משווים מספרים לפי המקום שלהם על הציר: עשרוניים ספרה אחרי ספרה לפי ערך המקום, ושברים לפי גודל החלקים.',
  why: [
    '$0.75$ הם $75$ מאיות, ו־$0.125$ הם $125$ אלפיות, כלומר $12.5$ מאיות. מספר הספרות לא קובע.',
    '$\\frac{1}{8}$ קטן מ־$\\frac{1}{6}$: כשמחלקים לשמונה, כל חלק קטן יותר.',
  ],
  alt: ['כסף: $0.5$ ש״ח הם $50$ אגורות, ו־$0.25$ ש״ח הם $25$ אגורות. משלימים אפסים בסוף עד שיש אותו מספר ספרות, ומשווים.'],
  discover: [
    { kind: 'predict', text: 'מה גדול יותר: $0.4$ או $0.25$?', fig: line(1, 20),
      choices: ['$0.4$', '$0.25$'], answer: 0,
      why: '$0.4 = 0.40$, ו־$40$ מאיות יותר מ־$25$ מאיות.',
      wrongWhy: { 1: '$25$ גדול מ־$4$, אבל כאן הספרות במקומות שונים.' } },
    { kind: 'explore', text: 'שימו את $0.4$ ואת $0.25$ על הציר.', manip: pins(['0.4', '0.25'], 20), answer: [0.4, 0.25],
      hint: '$0.25$ הוא רבע, באמצע בין $0.2$ ל־$0.3$.',
      success: '$0.4$ מימין ל־$0.25$, ולכן הוא גדול יותר.' },
    { kind: 'rule', text: 'משווים עשרוניים ספרה אחרי ספרה משמאל: קודם עשיריות, אחר כך מאיות.', display: '0.40 > 0.25',
      why: 'אפס בסוף ($0.4 = 0.40$) לא משנה את המספר, ועכשיו לשניהם אותו מספר ספרות.',
      fig: line(1, 20, [{ k: 5, label: '0.25' }, { k: 8, label: '0.4' }]) },
    { kind: 'predict', text: 'מה גדול יותר: $0.3$ או $0.275$?', fig: line(1, 40, [{ k: 11 }, { k: 12 }]),
      choices: ['$0.3$', '$0.275$'], answer: 0,
      why: '$0.300$ מול $0.275$: $300$ אלפיות מול $275$.',
      wrongWhy: { 1: 'ל־$0.275$ יש יותר ספרות, אבל $0.3$ הם $300$ אלפיות, יותר מ־$275$.' } },
    { kind: 'predict', text: 'מה גדול יותר: $\\frac{1}{6}$ או $\\frac{1}{8}$?',
      fig: bars([{ den: 6, shaded: 1, label: '\\frac{1}{6}' }, { den: 8, shaded: 1, label: '\\frac{1}{8}' }]),
      choices: ['$\\frac{1}{6}$', '$\\frac{1}{8}$'], answer: 0,
      why: 'החלק הצבוע בפס של שישיות גדול יותר.',
      wrongWhy: { 1: '$8$ גדול מ־$6$, אבל כשמחלקים לשמונה כל חלק קטן יותר.' } },
    { kind: 'rule', text: 'באותו מונה: המכנה הקטן נותן שבר גדול יותר. באותו מכנה: המונה הגדול נותן שבר גדול יותר.',
      why: 'המכנה אומר כמה קטן כל חלק, והמונה כמה חלקים יש.',
      fig: bars([{ den: 6, shaded: 1, label: '\\frac{1}{6}' }, { den: 8, shaded: 1, label: '\\frac{1}{8}' }]) },
    { kind: 'predict', text: '$\\frac{3}{4}$ כמספר עשרוני:', fig: bars([{ den: 4, shaded: 3 }]),
      choices: ['$0.75$', '$0.34$', '$3.4$'], answer: 0,
      why: '$\\frac{3}{4} = \\frac{75}{100} = 0.75$.',
      wrongWhy: { 1: 'המונה והמכנה אינם ספרות של המספר: $\\frac{3}{4}$ הוא $3$ לחלק ל־$4$.', 2: '$\\frac{3}{4}$ קטן מ־$1$: שלושה רבעים של פס אחד.' } },
    { kind: 'rule', text: 'משבר לעשרוני: מרחיבים למכנה $10$, $100$ או $1000$, או מחלקים את המונה במכנה.',
      display: '\\frac{3}{4} = \\frac{75}{100} = 0.75',
      why: 'כפל המונה והמכנה ב־$25$ לא משנה את הערך.',
      fig: line(1, 100, [{ k: 75, label: '0.75' }], { jumps: [{ from: 0, to: 0.75, label: '\\frac{3}{4}' }] }) },
  ],
  examples: [
    { problem: 'מה הגדול ביותר: $0.6$, $0.125$, $0.75$?', answer: 0.75, check: '0.75',
      steps: [
        { action: 'משלימים אפסים עד שלוש ספרות אחרי הנקודה.', why: 'אפס בסוף לא משנה את המספר, ועכשיו לכולם אותו מספר ספרות.', result: '0.600,\\ 0.125,\\ 0.750' },
        { action: 'משווים אלפיות.', why: '$750$ אלפיות הן הכי הרבה.', result: '750 > 600 > 125', calc: { expr: '0.75*1000', value: 750 } },
        { action: 'הגדול ביותר הוא:', why: 'בלי האפס שהוספנו.', result: '0.75', value: '0.75' },
      ] },
    { problem: 'מה גדול יותר: $\\frac{2}{3}$ או $\\frac{3}{5}$?', answer: 2 / 3, check: '2/3',
      steps: [
        { action: 'מרחיבים את $\\frac{2}{3}$ למכנה משותף $15$.', why: 'גם $3$ וגם $5$ נכנסים ב־$15$. מ־$3$ ל־$15$ זה פי $5$.', result: '\\frac{2}{3} = \\frac{10}{15}', calc: { expr: '2*5', value: 10 } },
        { action: 'מרחיבים את $\\frac{3}{5}$ גם הוא ל־$15$.', why: 'מ־$5$ ל־$15$ זה פי $3$.', result: '\\frac{3}{5} = \\frac{9}{15}', calc: { expr: '3*3', value: 9 } },
        { action: 'משווים את המונים.', why: 'באותו מכנה, המונה הגדול נותן שבר גדול יותר.', result: '\\frac{10}{15} > \\frac{9}{15}', value: '10/15' },
      ] },
  ],
  together: [
    { problem: 'סדרו מהקטן לגדול: $0.5$, $0.45$, $0.405$.',
      steps: [
        { prompt: 'איך משווים?', choices: [
          { text: 'משלימים לאותו מספר ספרות', ok: true, feedback: 'נכון: $0.500$, $0.450$, $0.405$.' },
          { text: 'לפי מספר הספרות', ok: false, feedback: 'יותר ספרות לא אומר גדול יותר: $0.405 < 0.5$.' },
          { text: 'לפי הספרה האחרונה', ok: false, feedback: 'הספרה האחרונה היא החלק הקטן ביותר. מתחילים מהעשיריות.' },
        ], hints: ['איך משווים $0.5$ ו־$0.45$, שיש להם מספר ספרות שונה?', 'משלימים אפסים בסוף: $0.500$, $0.450$, $0.405$.'], done: '$0.405 < 0.450 < 0.500$' },
      ],
      final: { prompt: 'מה המספר האמצעי?', answer: 0.45, check: '0.45', fmt: 'dec', hints: ['השוו $500$, $450$ ו־$405$ אלפיות.', 'הקטן $0.405$ והגדול $0.5$. מה באמצע?'] } },
    { problem: 'מה גדול יותר: $\\frac{5}{8}$ או $\\frac{3}{4}$?',
      steps: [
        { prompt: '$\\frac{3}{4}$ בשמיניות:', choices: [
          { text: '$\\frac{6}{8}$', ok: true, feedback: 'נכון: $\\frac{3 \\cdot 2}{4 \\cdot 2} = \\frac{6}{8}$.' },
          { text: '$\\frac{7}{8}$', ok: false, feedback: 'הוספתם $4$ למונה ולמכנה. מרחיבים בכפל: $\\frac{3 \\cdot 2}{4 \\cdot 2}$.' },
          { text: '$\\frac{3}{8}$', ok: false, feedback: 'המכנה גדל פי $2$, ולכן גם המונה צריך לגדול פי $2$.' },
        ], hints: ['פי כמה גדל המכנה מ־$4$ ל־$8$?', 'פי $2$, ולכן גם המונה: $3 \\cdot 2$.'], done: '$\\frac{6}{8} > \\frac{5}{8}$' },
      ],
      final: { prompt: 'כתבו את הגדול מהשניים.', answer: 0.75, check: '3/4', precise: true, hints: ['$\\frac{6}{8}$ מול $\\frac{5}{8}$.', '$\\frac{6}{8}$ הוא $\\frac{3}{4}$.'] } },
  ],
  diag: frac2,
  transfer: frac2T,
  words: ['עשיריות', 'מאיות', 'אלפיות', 'ערך המקום', 'השוואה', 'מכנה משותף'],
  misconceptions: [
    { id: 'longer-larger', title: 'חשבו שמספר עשרוני עם יותר ספרות הוא גדול יותר',
      cause: 'מסתכלים על הספרות שאחרי הנקודה כמו על מספר שלם: $125$ נראה יותר מ־$75$.',
      explain: ['הספרה הראשונה אחרי הנקודה היא עשיריות, והיא קובעת יותר מכל השאר.', '$0.125$ הם $125$ אלפיות, ו־$0.75$ הם $750$ אלפיות.'],
      remedy: [
        { kind: 'predict', text: 'מה גדול יותר: $0.3$ או $0.275$?', fig: line(1, 40, [{ k: 11 }, { k: 12 }]), choices: ['$0.3$', '$0.275$'], answer: 0,
          why: 'משלימים: $0.300$ מול $0.275$. $300$ אלפיות יותר מ־$275$.' },
        { kind: 'explore', text: 'שימו את $0.3$ ואת $0.275$ על הציר.', manip: pins(['0.3', '0.275'], 40), answer: [0.3, 0.275],
          hint: 'כל שנתה כאן היא $0.025$. $0.3$ הוא $12$ שנתות מ־$0$.', success: '$0.275$ משמאל ל־$0.3$, ולכן הוא קטן יותר.' },
      ] },
    { id: 'shorter-larger', title: 'חשבו שמספר עשרוני עם פחות ספרות הוא גדול יותר',
      cause: 'יודעים שאלפיות קטנות ממאיות, ומסיקים שמספר עם יותר ספרות קטן יותר.',
      explain: ['מספר הספרות לא קובע. משלימים אפסים בסוף ומשווים ספרה אחרי ספרה.', '$0.6 = 0.60$, ו־$60$ מאיות פחות מ־$75$ מאיות.'],
      remedy: [
        { kind: 'predict', text: 'מה גדול יותר: $0.6$ או $0.75$?', fig: line(1, 20), choices: ['$0.75$', '$0.6$'], answer: 0,
          why: '$0.60$ מול $0.75$: $75$ מאיות יותר מ־$60$.' },
        { kind: 'explore', text: 'שימו את $0.6$ ואת $0.75$ על הציר.', manip: pins(['0.6', '0.75'], 20), answer: [0.6, 0.75],
          hint: 'כל שנתה היא $0.05$. $0.75$ הוא שלושה רבעים מהדרך ל־$1$.', success: '$0.75$ מימין ל־$0.6$, ולכן הוא גדול יותר.' },
      ] },
    { id: 'bigger-den', title: 'חשבו שמכנה גדול יותר נותן שבר גדול יותר',
      cause: 'במספרים שלמים $8 > 6$, וזה עובר בטעות גם למכנה.',
      explain: ['המכנה אומר לכמה חלקים מחלקים. יותר חלקים הם חלקים קטנים יותר.', 'לכן $\\frac{1}{8} < \\frac{1}{6}$.'],
      remedy: [
        { kind: 'predict', text: 'מה גדול יותר: $\\frac{1}{6}$ או $\\frac{1}{8}$?', fig: bars([{ den: 6, shaded: 1, label: '\\frac{1}{6}' }, { den: 8, shaded: 1, label: '\\frac{1}{8}' }]),
          choices: ['$\\frac{1}{6}$', '$\\frac{1}{8}$'], answer: 0, why: 'חלק אחד מתוך $6$ גדול מחלק אחד מתוך $8$.' },
        { kind: 'explore', text: 'הפס מראה $\\frac{1}{6}$, והסימון הוא $\\frac{1}{8}$. חלקו את הפס לשמיניות, וצבעו $\\frac{1}{8}$.',
          manip: { kind: 'fbar', start: { den: 6, shaded: 1 }, marks: [1 / 8] }, answer: { mode: 'exact', den: 8, shaded: 1 },
          hint: 'הגדילו את מספר החלקים ל־$8$, וצבעו חלק אחד.', success: 'חלק אחד מתוך $8$ קטן מחלק אחד מתוך $6$: $\\frac{1}{8} < \\frac{1}{6}$.' },
      ] },
  ],
};

export const FRAC: StairContent[] = [stair1, stair2];
/** Names of misconceptions new to this topic: none beyond the topic's own (content/frac.js names them all). */
export const CATS_FRAC: Record<string, string> = {};
export { frac1, frac1T, frac2, frac2T };
