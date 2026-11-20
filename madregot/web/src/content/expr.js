// Grade 7 (ז׳): algebraic expressions (ביטויים אלגבריים), in the order of the Ministry's programme: substituting a
// number, writing an expression from a pattern or a sentence, collecting like terms, the distributive law, and
// simplifying (brackets, then collecting). The expression answers use the 'lin' form (□x + □): the coefficient and the
// constant are typed, an expression is never parsed from free text.
// Taught from December, so the first-day placement test skips it (placement: false); a grade 8 test that revises
// equations with brackets can include it in Exam Rescue (alsoFor).
import { R, NZ, pick, shuffle, T, S, near } from './util.js';
import { slipOf } from '@/learn/misconceptions.ts';

const abs = Math.abs;

/** A sum of terms as TeX, as a student writes it: [[3, 'x'], [-2, ''], [-1, 'x']] gives 3x - 2 - x. */
export function sumTex(terms) {
  return terms.map(([k, v], i) => {
    const body = v ? (abs(k) === 1 ? v : `${abs(k)}${v}`) : `${abs(k)}`;
    if (i === 0) return k < 0 ? `-${body}` : body;
    return `${k < 0 ? '-' : '+'} ${body}`;
  }).join(' ');
}
/** kx + c as TeX: 5x + 4, x - 3, -x, 7. */
export const linTex = (k, c, v = 'x') => sumTex([[k, v], [c, '']].filter(([n]) => n !== 0)) || '0';
/** a(cx + b) as TeX: 3(x + 4), -2(3x - 5), -(x - 3). */
export const bracketTex = (a, c, b, v = 'x') => `${a === 1 ? '' : a === -1 ? '-' : a}(${linTex(c, b, v)})`;
/** A choice that is maths. */
const tex = (t) => ({ tex: t });
/** Is a typed expression {k, c} this one? */
const is = (u, k, c) => !!u && typeof u === 'object' && near(u.k, k) && near(u.c, c);

// ---------------------------------------------------------------- 1. substituting (הצבה בביטוי)
// Forms: 0 b + ax, 1 b − ax, 2 ax + b. The documented errors: 3x read as the number 34 (concat), left to right
// without multiplication first (order), a negative value put in without brackets, its minus lost (neg-sub), 3x read
// as 3 + x (plus), and the 3 before the letter dropped (coef). The last two are the choice question's readings of ax
// too (substMc), so a typed answer and a chosen one name the same mistakes (FOLLOWUP-36).

const SUB_FORMS = {
  show: (f, a, b) => (f === 0 ? `${T(b)} + ${a}x` : f === 1 ? `${T(b)} - ${a}x` : `${a}x ${b < 0 ? '-' : '+'} ${abs(b)}`),
  /** The value with the product ax replaced by `prod`. */
  with: (f, b, prod) => (f === 1 ? b - prod : b + prod),
  /** Left to right, as if there were no order of operations: (b ± a)·x. Form 2 is already in that order. */
  ltr: (f, a, b, x) => (f === 0 ? (b + a) * x : f === 1 ? (b - a) * x : null),
};
const substValue = (f, a, b, x) => SUB_FORMS.with(f, b, a * x);
/** The predictions of a wrong substitution; null when it does not apply here. */
function substBugs(f, a, b, x) {
  return {
    concat: x >= 1 && x <= 9 ? SUB_FORMS.with(f, b, 10 * a + x) : null,
    order: SUB_FORMS.ltr(f, a, b, x),
    'neg-sub': x < 0 ? SUB_FORMS.with(f, b, a * -x) : null,
    plus: SUB_FORMS.with(f, b, a + x),
    coef: SUB_FORMS.with(f, b, x),
  };
}
/**
 * The first error whose prediction the answer is. A prediction that is the right answer, or that a slip of the hand
 * also gives (one off, ten off, two digits swapped: 2x + 5 at x = 1 read as x + 5 is one off), names nothing.
 */
const substDiag = (f, a, b, x) => (u) => {
  const ans = substValue(f, a, b, x);
  // every mistake that gives this number (several: an ambiguous answer, content/index.js makeItem); a slip of the
  // right answer's own digits names none (slipOf)
  return Object.entries(substBugs(f, a, b, x)).filter(([, v]) => v != null && v !== ans && !slipOf(v, ans) && near(u, v)).map(([id]) => id);
};
/** The worked substitution: put the number in (brackets for a negative), multiply, then add or subtract. */
function substSolution(f, a, b, x) {
  const prod = a * x; const ans = substValue(f, a, b, x);
  const put = f === 2 ? `${a} \\cdot ${T(x, true)} ${b < 0 ? '-' : '+'} ${abs(b)}` : `${T(b)} ${f === 1 ? '-' : '+'} ${a} \\cdot ${T(x, true)}`;
  const after = f === 2 ? `${T(prod)} ${b < 0 ? '-' : '+'} ${abs(b)}` : `${T(b)} ${f === 1 ? '-' : '+'} ${T(prod, true)}`;
  return [
    `מציבים${x < 0 ? ' בסוגריים' : ''}: $${put}$`,
    `קודם הכפל: $${a} \\cdot ${T(x, true)} = ${T(prod)}$`,
    `אחר כך: $${after} = ${T(ans)}$`,
  ];
}
const substHint = (a, x) => (x < 0
  ? `מציבים את $${T(x)}$ בסוגריים: $${a} \\cdot ${T(x, true)}$. ואחר כך כפל לפני חיבור וחיסור.`
  : `$${a}x$ פירושו $${a} \\cdot x$. אחרי ההצבה: קודם הכפל, אחר כך החיבור או החיסור.`);

function substItem() {
  const f = pick([0, 0, 1, 1, 2]); const a = R(2, 9); const b = NZ(-12, 12); const x = NZ(-6, 9);
  return {
    key: `ex1:${f}:${a}:${b}:${x}`, text: `מה ערך הביטוי כש־$x = ${T(x)}$?`, display: SUB_FORMS.show(f, a, b),
    form: 'num', answer: substValue(f, a, b, x), hint: substHint(a, x), solution: substSolution(f, a, b, x), diag: substDiag(f, a, b, x),
  };
}

// A table of values of one expression: the student fills the missing value.
function substTable() {
  for (;;) {
    const f = pick([0, 1, 2]); const a = R(2, 6); const b = NZ(-9, 9);
    const xs = shuffle([-4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6]).slice(0, 4).sort((p, q) => p - q);
    if (!xs.some((v) => v < 0) || !xs.some((v) => v > 0)) continue;
    const neg = xs.filter((v) => v < 0);
    const x = Math.random() < 0.5 ? pick(neg) : pick(xs.filter((v) => v !== 0));
    const rows = xs.map((v) => [v, v === x ? '?' : substValue(f, a, b, v)]);
    return {
      key: `ex1t:${f}:${a}:${b}:${xs.join(',')}:${x}`, text: `בטבלה ערכים של הביטוי $${SUB_FORMS.show(f, a, b)}$. מה המספר במקום סימן השאלה?`,
      form: 'num', answer: substValue(f, a, b, x), fig: { type: 'table', head: ['x', 'ערך הביטוי'], rows },
      hint: `בשורה של סימן השאלה $x = ${T(x)}$. ${substHint(a, x)}`, solution: substSolution(f, a, b, x), diag: substDiag(f, a, b, x),
    };
  }
}

// 3x at x = 4 is 12, not 34 and not 7: the right value beside two misreadings of ax, each a documented mistake with
// its own name in the topic's cats: the digits written side by side (concat: 34, for a digit x from 1 to 9), the term
// read as addition (plus: 3 + 4 = 7; at x = −4, 3 + (−4) = −1, the notebook's 3 − 4), a negative x put in without
// brackets so that its minus is lost (neg-sub: 12 for x = −4), and the number before the letter dropped (coef: 3x read
// as x, 4). Where each lies against ax decides where the answer stands among the three:
//   x < 0: neg-sub, plus and coef all lie above ax (ax is the most negative of them), so the answer is the smallest
//   x = 1: concat and plus lie above a, coef (1) below
//   x ≥ 2: concat lies above ax, plus and coef below
// so the share of each case makes the answer the smallest, the middle or the largest a third of the time each
// (FOLLOWUP-36), and "the middle one" or "never the largest" is not a rule a student can follow:
//   x < 0 (1/3): neg-sub and coef, or neg-sub and plus when a + x is below 0: the smallest. ax is negative, so a plus
//     at or above 0 (7 + (−3) = 4 beside −21 and 21) would leave the answer the only choice with a minus; with coef
//     (−3) or a negative plus there are always two
//   x = 1 (1/10): coef and one of concat, plus: the middle
//   x ≥ 2 (17/30): plus and coef (10 in 17): the largest; concat and one of them (7 in 17): the middle
// the smallest 1/3, the largest 17/30 · 10/17 = 1/3, the middle 1/10 + 17/30 · 7/17 = 1/3.
const SUB_READ = {
  concat: (a, x) => 10 * a + x,
  plus: (a, x) => a + x,
  'neg-sub': (a, x) => -a * x,
  coef: (a, x) => x,
};
/** The solution's words for a wrong choice: where its number comes from. */
const SUB_WHY = {
  concat: (v) => `$${T(v)}$ יוצא כשכותבים את הספרות זו ליד זו`,
  plus: (v, a, x) => `$${T(v)}$ הוא חיבור: $${a} + ${T(x, true)}$`,
  'neg-sub': (v, a, x) => `$${T(v)}$ יוצא כשהמינוס של $${T(x)}$ נעלם`,
  coef: (v, a) => `$${T(v)}$ הוא רק $x$, בלי ה־$${a}$`,
};
/** One of the three cases above: how x is drawn, and the two misreadings shown beside ax (for its a and x). */
function substCase() {
  const r = Math.random();
  if (r < 1 / 3) return { x: () => -R(1, 6), pair: (a, x) => ['neg-sub', a + x < 0 ? pick(['plus', 'coef']) : 'coef'] };
  if (r < 1 / 3 + 1 / 10) { const pair = ['coef', pick(['concat', 'plus'])]; return { x: () => 1, pair: () => pair }; }
  const pair = Math.random() < 10 / 17 ? ['plus', 'coef'] : ['concat', pick(['plus', 'coef'])];
  return { x: () => R(2, 9), pair: () => pair };
}
function substMc() {
  const c = substCase();
  for (;;) {
    // the case stays and only the numbers are drawn again, so the shares above hold exactly
    const a = R(2, 9); const x = c.x();
    const wrong = c.pair(a, x).map((bug) => [SUB_READ[bug](a, x), bug]);
    if (new Set([a * x, ...wrong.map(([v]) => v)]).size < 3) continue; // 2x at x = 2: 2 + 2 would be the answer itself
    const choices = shuffle([{ ...tex(T(a * x)), ok: true }, ...wrong.map(([v, bug]) => ({ ...tex(T(v)), bug }))]);
    const why = wrong.map(([v, bug]) => SUB_WHY[bug](v, a, x));
    return {
      key: `ex1m:${a}:${x}`, text: `מה ערך הביטוי כש־$x = ${T(x)}$?`, display: `${a}x`, form: 'mc',
      choices, answer: choices.findIndex((c) => c.ok),
      hint: x < 0 ? `$${a}x$ הוא $${a} \\cdot x$. מספר שלילי מציבים בסוגריים: $${a} \\cdot ${T(x, true)}$.` : `$${a}x$ הוא קיצור של $${a} \\cdot x$: מספר צמוד לאות כופל אותה.`,
      // the last line names the two misreadings actually shown
      solution: [`$${a}x = ${a} \\cdot x$`, `$${a} \\cdot ${T(x, true)} = ${T(a * x)}$`, `${why[0]}, ו־${why[1]}.`],
      diag: (u) => choices[u]?.bug || null,
    };
  }
}

// ---------------------------------------------------------------- 2. writing an expression (כותבים ביטוי)
// A growing pattern: the first term s, the same step d each time, so the n-th term is s + d(n − 1). The documented
// errors (Stacey 1989; the Ministry exam's own distractor 10 + 3n): n steps from the first term instead of n − 1
// (start-n: s + dn), the step times n alone (diff-only: dn).

const PATTERNS = [
  { head: ['צורה', 'גפרורים'], story: (s, d) => `צורות מגפרורים: בצורה הראשונה $${s}$ גפרורים, ובכל צורה מוסיפים $${d}$ גפרורים.`, what: 'מספר הגפרורים בצורה', ask: (n) => `כמה גפרורים יש בצורה ה־$${n}$?` },
  { head: ['יום', 'גובה (ס״מ)'], story: (s, d) => `ביום הראשון גובה הצמח $${s}$ ס״מ, ובכל יום הוא גדל ב־$${d}$ ס״מ.`, what: 'גובה הצמח ביום', ask: (n) => `מה גובה הצמח ביום ה־$${n}$?`, unit: 'ס״מ' },
  { head: ['שבוע', 'בקופה (₪)'], story: (s, d) => `בשבוע הראשון יש בקופה של נועה $${s}$ ₪, ובכל שבוע היא מוסיפה $${d}$ ₪.`, what: 'הסכום בקופה בשבוע', ask: (n) => `כמה ₪ יהיו בקופה בשבוע ה־$${n}$?`, unit: '₪' },
];
function patternParams() {
  for (;;) {
    const s = R(2, 15); const d = R(2, 9);
    if (s !== d) return { s, d, P: pick(PATTERNS) };
  }
}
const patternRows = (s, d, upTo) => Array.from({ length: upTo }, (_, i) => [i + 1, s + d * i]);
const stepsWhy = (s, d) => `מהאיבר הראשון לאיבר ה־$n$ יש $n - 1$ צעדים של $${d}$: $${s} + ${d}(n - 1)$.`;

// Write the expression: □n + □. The real skill of the stair, and it cannot be guessed.
function patternLin() {
  const { s, d, P } = patternParams();
  return {
    key: `ex2l:${s}:${d}:${P.head[0]}`, text: `${P.story(s, d)} כתבו ביטוי ל${P.what.replace(/^ה/, '')} ה־$n$.`, form: 'lin', var: 'n',
    answer: { k: d, c: s - d }, fig: { type: 'table', head: P.head, rows: patternRows(s, d, 4) },
    hint: `בכל צעד מוסיפים $${d}$, ולכן יש $${d}n$ בביטוי. בדקו את $n = 1$: הביטוי צריך לתת $${s}$.`,
    solution: [stepsWhy(s, d), `$${s} + ${d}(n - 1) = ${s} + ${d}n - ${d}$`, `$= ${linTex(d, s - d, 'n')}$`, `בדיקה: כש־$n = 1$ יוצא $${d} ${s - d < 0 ? '-' : '+'} ${abs(s - d)} = ${s}$, כמו בטבלה.`],
    diag: (u) => (is(u, d, s) ? 'start-n' : is(u, d, 0) ? 'diff-only' : null),
  };
}

// A far term from the first three.
function patternTerm() {
  const { s, d, P } = patternParams(); const n = R(8, 40); const ans = s + d * (n - 1);
  return {
    key: `ex2n:${s}:${d}:${n}:${P.head[0]}`, text: `${P.story(s, d)} ${P.ask(n)}`, form: 'num', answer: ans, unit: P.unit,
    fig: { type: 'table', head: P.head, rows: patternRows(s, d, 3) },
    hint: `מהאיבר הראשון עד האיבר ה־$${n}$ יש $${n - 1}$ צעדים, לא $${n}$.`,
    solution: [`מהאיבר הראשון עד האיבר ה־$${n}$: $${n} - 1 = ${n - 1}$ צעדים של $${d}$.`, `$${s} + ${d} \\cdot ${n - 1} = ${s} + ${d * (n - 1)} = ${ans}$`],
    diag: (u) => (near(u, s + d * n) ? 'start-n' : near(u, d * n) ? 'diff-only' : null),
  };
}

// Choose the expression. The right one is written simplified half the time. Every choice is written the way the
// right one is, and one more has the start and the step swapped (d + s(n − 1)), so neither "the one with n − 1" nor
// "the only one with a minus" is a give-away: substituting n = 1 is.
function patternMc() {
  const { s, d, P } = patternParams();
  const simple = Math.random() < 0.5;
  const choices = shuffle([
    { ...tex(simple ? linTex(d, s - d, 'n') : `${s} + ${d}(n - 1)`), ok: true },
    { ...tex(simple ? linTex(d, s, 'n') : `${s} + ${d}n`), bug: 'start-n' },
    { ...tex(`${d}n`), bug: 'diff-only' },
    tex(simple ? linTex(s, d - s, 'n') : `${d} + ${s}(n - 1)`),
  ]);
  return {
    key: `ex2m:${s}:${d}:${simple}:${P.head[0]}`, text: `${P.story(s, d)} איזה ביטוי נותן את ${P.what} ה־$n$?`, form: 'mc',
    choices, answer: choices.findIndex((c) => c.ok), fig: { type: 'table', head: P.head, rows: patternRows(s, d, 3) },
    hint: 'הציבו $n = 1$ ו־$n = 2$ בכל ביטוי, והשוו לטבלה.',
    solution: [stepsWhy(s, d), simple ? `$${s} + ${d}(n - 1) = ${linTex(d, s - d, 'n')}$` : `כש־$n = 1$: $${s} + ${d} \\cdot 0 = ${s}$, כמו בטבלה.`, `$${s} + ${d}n$ נותן $${s + d}$ כבר באיבר הראשון, ו־$${d}n$ נותן רק $${d}$. ו־$${d} + ${s}(n - 1)$ מתחיל ב־$${d}$ ומוסיף $${s}$ בכל צעד.`],
    diag: (u) => choices[u]?.bug || null,
  };
}

// From a sentence to an expression. The check is a number, never a key word: "if Amit has 5, David has 11".
// c − x for "c less than x" is a wrong choice with no name: it reverses the subtraction, but it does not give more
// to the one who has less (at x = 20 it gives c − 20), which is what 'reversal' says.
const WORDS = [
  (c) => ({ v: 'x', text: `לעמית יש $x$ ספרים. לדוד יש $${c}$ ספרים יותר מלעמית. כמה ספרים יש לדוד?`, right: `x + ${c}`, wrong: [[`${c}x`, 'times-plus'], [`x - ${c}`, 'reversal']], at: 5, value: (x) => x + c, story: (x) => `לעמית $${x}$ ספרים, ולדוד $${c}$ יותר: $${x + c}$.` }),
  (c) => ({ v: 'x', text: `לעמית יש $x$ ספרים. ליובל יש פי $${c}$ מספר הספרים של עמית. כמה ספרים יש ליובל?`, right: `${c}x`, wrong: [[`x + ${c}`, 'times-plus'], [`x : ${c}`, 'reversal']], at: 5, value: (x) => c * x, story: (x) => `לעמית $${x}$ ספרים, וליובל פי $${c}$: $${c * x}$.` }),
  (c) => ({ v: 'x', text: `לנועה יש $x$ ₪. לשירה יש $${c}$ ₪ פחות מלנועה. כמה כסף יש לשירה?`, right: `x - ${c}`, wrong: [[`${c} - x`], [`x + ${c}`, 'reversal']], at: 20, value: (x) => x - c, story: (x) => `לנועה $${x}$ ₪, ולשירה $${c}$ פחות: $${x - c}$.` }),
  (c) => ({ v: 'a', text: `האורך של מלבן גדול פי $${c}$ מהרוחב שלו. הרוחב הוא $a$ ס״מ. מה האורך?`, right: `${c}a`, wrong: [[`a + ${c}`, 'times-plus'], [`a : ${c}`, 'reversal']], at: 5, value: (x) => c * x, story: (x) => `אם הרוחב $${x}$ ס״מ, האורך פי $${c}$: $${c * x}$ ס״מ.` }),
  (c) => ({ v: 'n', text: `תמר מבוגרת מאחיה ב־$${c}$ שנים. אחיה בן $n$. בת כמה תמר?`, right: `n + ${c}`, wrong: [[`n - ${c}`, 'reversal'], [`${c}n`, 'times-plus']], at: 10, value: (x) => x + c, story: (x) => `אם האח בן $${x}$, תמר מבוגרת ממנו ב־$${c}$: $${x + c}$.` }),
];
function wordsMc() {
  const w = pick(WORDS)(R(2, 5));
  const choices = shuffle([{ ...tex(w.right), ok: true }, ...w.wrong.map(([t, bug]) => ({ ...tex(t), bug }))]);
  return {
    key: `ex2w:${w.text}`, text: w.text, form: 'mc', choices, answer: choices.findIndex((c) => c.ok),
    hint: `בדקו במספר: נניח ש־$${w.v} = ${w.at}$. כמה זה לפי הסיפור, ואיזה ביטוי נותן את זה?`,
    solution: [w.story(w.at), `הביטוי $${w.right}$ נותן גם הוא $${w.value(w.at)}$ כש־$${w.v} = ${w.at}$.`, `התשובה: $${w.right}$`],
    diag: (u) => choices[u]?.bug || null,
  };
}

// ---------------------------------------------------------------- 3. collecting like terms (כינוס איברים דומים)
// Documented errors: unlike terms joined into one (conjoin: 3x + 5 → 8x; Booth 1988, Tirosh, Even & Robinson 1998),
// the minus of a term dropped (drop-minus: 7x − 3x → 10x), and the minus carried on to the next x-term, the
// "detachment" Herscovics & Linchevski (1994) describe (detach: 9 − 3x + 2x → 9 − 5x).
// The class's way (CLASSROOM-6): 3 to 6 terms; like terms called "משפחות", one line under the x-terms and two under
// the numbers, a brace under each family once they are regrouped; x-terms that cancel ("0x + 0 = 0"); letters other
// than x; and the minus a term loses when it moves (the notebook's −12x − 3 + 5x … rewritten 12x + 5x …), named on
// any term: one prediction per negative term.

/** The letter of an expression: x most of the time, and as in class sometimes b, a or y. */
const LETTERS = ['x', 'x', 'x', 'b', 'a', 'y'];
const sumOf = (arr) => arr.reduce((a, b) => a + b, 0);
/** [K, C]: the sum of the x-family and the sum of the numbers. */
const families = (terms) => [sumOf(terms.filter(([, v]) => v).map(([k]) => k)), sumOf(terms.filter(([, v]) => !v).map(([k]) => k))];

/**
 * 2 or 3 x-terms (±1..15) and 1 to 3 numbers (±1..30), shuffled. In about one item in ten the x-terms cancel (the
 * last one is minus the others), otherwise their sum is not 0; when the numbers cancel too, collectItem makes the item
 * practice only (always typing 0 and 0 would earn it). |K| ≤ 20 and |C| ≤ 40 keep the answers in a notebook's range.
 */
function collectParams() {
  const v = pick(LETTERS);
  const zero = Math.random() < 0.1;
  for (;;) {
    const nx = R(2, 3); const nn = R(1, 3);
    const xs = Array.from({ length: nx }, () => NZ(-15, 15)); const ns = Array.from({ length: nn }, () => NZ(-30, 30));
    if (zero) { const rest = sumOf(xs.slice(0, -1)); if (rest === 0 || abs(rest) > 15) continue; xs[nx - 1] = -rest; }
    const K = sumOf(xs); const C = sumOf(ns);
    if ((!zero && K === 0) || abs(K) > 20 || abs(C) > 40) continue;
    return { v, terms: shuffle([...xs.map((k) => [k, v]), ...ns.map((k) => [k, ''])]) };
  }
}
/** A pair {k, c} that a slip of the hand also gives: one box right, the other one off, ten off or two digits swapped. */
const pairSlip = (u, a) => (u.k === a.k && !!slipOf(u.c, a.c)) || (u.c === a.c && !!slipOf(u.k, a.k));
/**
 * The predictions [id, {k, c}] that may name a mistake, from a list of candidates: one that is the right answer, the
 * right answer in swapped boxes (it counts as right on expr:3 when neither box is 0, content/index.js swappedLin) or a
 * slip of it names nothing, and a value that two different mistakes predict names neither.
 */
function fairBugs(list, K, C) {
  const ans = { k: K, c: C };
  const swap = K !== 0 && C !== 0;
  const keep = list.filter(([, u]) => !(u.k === K && u.c === C) && !(swap && u.k === C && u.c === K) && !pairSlip(u, ans));
  const ids = new Map();
  keep.forEach(([id, u]) => { const key = `${u.k},${u.c}`; ids.set(key, (ids.get(key) || new Set()).add(id)); });
  return keep.filter(([, u]) => ids.get(`${u.k},${u.c}`).size === 1);
}
/** Every negative term's minus removed in turn: one prediction per negative term (−11x as 11x, −5 as 5). */
const minusEach = (terms, K, C) => terms.filter(([k]) => k < 0).map(([k, v]) => ['drop-minus', v ? { k: K - 2 * k, c: C } : { k: K, c: C - 2 * k }]);
/** The answer and the mistakes' predictions of a collecting question, from its terms as they stand in the display. */
export function collectBugs(terms) {
  const [K, C] = families(terms);
  const xs = terms.filter(([, v]) => v).map(([k]) => k);
  const list = [];
  // everything joined into one x-term; when the x-terms cancel (0x + C) that is C written as Cx, an x that is not
  // there any more: still conjoin, and wrong (swappedLin accepts no swap with a 0 box)
  if (C !== 0) list.push(['conjoin', { k: K + C, c: 0 }]);
  list.push(...minusEach(terms, K, C));
  // a negative x-term followed by a positive one: −3x + 2x read as −(3x + 2x)
  const i = xs.findIndex((k, j) => k < 0 && xs[j + 1] > 0);
  if (i >= 0) list.push(['detach', { k: K - 2 * xs[i + 1], c: C }]);
  return { K, C, bugs: fairBugs(list, K, C) };
}
/** The mistake whose prediction the typed pair is. */
const pairDiag = (bugs) => (u) => bugs.find(([, b]) => is(u, b.k, b.c))?.[0] || null;
/** A term marked with its family, its sign underlined with it: one line under an x-term, two under a number. */
const familyMark = ([k, v], first) => {
  const t = `${!first && k > 0 ? '+' : ''}${sumTex([[k, v]])}`;
  return v ? `\\underline{${t}}` : `\\underline{\\underline{${t}}}`;
};
/** The expression with its families marked, as the class marks them. */
export const familiesTex = (terms) => terms.map((t, i) => familyMark(t, i === 0)).join('\\;');
/** The families regrouped, the x-terms first, each under a brace with its sum (0x when they cancel). */
export function bracesTex(terms, v = 'x') {
  const xs = terms.filter(([, w]) => w); const ns = terms.filter(([, w]) => !w);
  const [K, C] = families(terms);
  const xPart = `\\underbrace{${sumTex(xs)}}_{${K === 0 ? `0${v}` : linTex(K, 0, v)}}`;
  // the numbers' first sign stays an operation between the two families: {}- 2 - 5 + 3
  const nPart = ns.length ? ` \\underbrace{{}${sumTex([[1, 'Q'], ...ns]).replace(/^Q /, '')}}_{${T(C)}}` : '';
  return `${xPart}${nPart}`;
}
/** The answer; when the x-terms cancel, 0x is written out and then dropped, as the class does ("0x + 0 = 0"). */
function answerLines(K, C, v) {
  if (K !== 0) return [`התשובה: $${linTex(K, C, v)}$`];
  return [`האיברים עם $${v}$ התבטלו: $0${v} ${C < 0 ? '-' : '+'} ${abs(C)} = ${T(C)}$`, `התשובה: $${T(C)}$`];
}
function collectSolution(terms, v) {
  const [K, C] = families(terms);
  const xs = terms.filter(([, w]) => w); const ns = terms.filter(([, w]) => !w);
  return [
    `מסמנים משפחות, קו אחד מתחת לאיברים עם $${v}$ ושני קווים מתחת למספרים: $${familiesTex(terms)}$`,
    `מסדרים לפי משפחות. כל איבר זז עם הסימן שלפניו: $${bracesTex(terms, v)}$`,
    `משפחת ה־$${v}$: $${sumTex(xs)} = ${K === 0 ? `0${v}` : linTex(K, 0, v)}$`,
    // a number alone is its own family's sum
    ns.length > 1 ? `משפחת המספרים: $${sumTex(ns)} = ${T(C)}$` : `משפחת המספרים: מספר אחד, $${T(C)}$`,
    ...answerLines(K, C, v),
  ];
}
const COLLECT_HINT = (v) => `כל משפחה לחוד: האיברים עם $${v}$ יחד, והמספרים יחד. הסימן שלפני איבר שייך לו.`;

/** A bracketed term as the class writes it, with its sign: (+4x), (−x), (−9). */
const bracketed = ([k, v]) => (v ? `(${k < 0 ? '-' : '+'}${abs(k) === 1 ? v : `${abs(k)}${v}`})` : S(k));
/**
 * (a) + (b) as the class adds two signed terms, as two short lines that fit a phone: the sum as written, then the sign
 * outside and inside the brackets the larger less the smaller (opposite signs) or the two added (the same sign).
 */
function signOutside(a, b, v, family) {
  const t = (n) => (v && n === 1 ? v : `${n}${v}`);
  const [L, Sm] = abs(a) >= abs(b) ? [a, b] : [b, a];
  const same = Math.sign(a) === Math.sign(b);
  const inside = same ? `${t(abs(a))} + ${t(abs(b))}` : `${t(abs(L))} - ${t(abs(Sm))}`;
  const sum = a + b;
  const out = sum === 0 ? '0' : v ? linTex(sum, 0, v) : T(sum);
  return [
    `${family}: $${bracketed([a, v])} + ${bracketed([b, v])}$`,
    `${same ? 'אותו סימן: הסימן בחוץ, ומחברים' : 'הסימן של הרחוק מאפס בחוץ'}: $${L < 0 ? '-' : '+'}(${inside}) = ${out}$`,
  ];
}
/**
 * Bracketed x-terms, the same rule as numbers (CLASSROOM-6.6): (ax) + (c) + (bx) + (d), a and b of opposite signs and
 * |a| − |b| = ±1 in a third of the draws, so the answer is x or −x. Mistakes: a minus dropped (any negative term), the
 * distances added with the larger term's sign when it is negative (abs-add; when it is positive that is drop-minus),
 * and the sign of the x-family's sum turned (sign). The numbers' sum stays right in the last two.
 */
export function bracketCollect() {
  const one = Math.random() < 1 / 3;
  for (;;) {
    let a; let b;
    if (one) { const m = R(2, 12); a = m * (Math.random() < 0.5 ? -1 : 1); b = -Math.sign(a) * (m - 1); } else { a = NZ(-12, 12); b = -Math.sign(a) * R(1, 12); if (abs(a + b) < 2) continue; }
    if (Math.random() < 0.5) [a, b] = [b, a];
    const c = NZ(-15, 15); const d = NZ(-15, 15);
    if (c + d === 0) continue;
    const terms = shuffle([[a, 'x'], [c, ''], [b, 'x'], [d, '']]);
    const xs = terms.filter(([, v]) => v).map(([k]) => k); const ns = terms.filter(([, v]) => !v).map(([k]) => k);
    const K = a + b; const C = c + d;
    const big = abs(a) > abs(b) ? a : b;
    const list = [...minusEach(terms, K, C), ...(big < 0 ? [['abs-add', { k: -(abs(a) + abs(b)), c: C }]] : []), ['sign', { k: -K, c: C }]];
    const bugs = fairBugs(list, K, C);
    const display = terms.map(bracketed).join(' + ');
    return {
      key: `ex3b:${display}`, text: 'כנסו איברים דומים:', display, form: 'lin', answer: { k: K, c: C },
      hint: 'כמו בחיבור מספרים מכוונים: הסימן של הרחוק מאפס בחוץ, ובסוגריים הגדול פחות הקטן. כל משפחה לחוד.',
      solution: [
        `מורידים סוגריים, כל איבר עם הסימן שלו: $${sumTex(terms)}$`,
        ...signOutside(xs[0], xs[1], 'x', 'משפחת ה־$x$, כמו בחיבור מספרים מכוונים'),
        ...signOutside(ns[0], ns[1], '', 'משפחת המספרים'),
        `התשובה: $${linTex(K, C)}$`,
      ],
      diag: pairDiag(bugs), tries: bugs.map(([, u]) => u),
    };
  }
}

export function collectItem() {
  if (Math.random() < 0.15) return bracketCollect();
  const { v, terms } = collectParams();
  const { K, C, bugs } = collectBugs(terms);
  return {
    // both families cancel (ex3z): typing 0 and 0 would always earn it, so it stays in practice
    key: `${K === 0 && C === 0 ? 'ex3z' : 'ex3'}:${sumTex(terms)}`, text: 'כנסו איברים דומים:', display: sumTex(terms), form: 'lin', answer: { k: K, c: C },
    ...(v !== 'x' ? { var: v } : {}), ...(K === 0 && C === 0 ? { practiceOnly: true } : {}),
    // diag() names only these pairs: what a verification's search for a misconception needs to try (index.js namesOf)
    hint: COLLECT_HINT(v), solution: collectSolution(terms, v), diag: pairDiag(bugs), tries: bugs.map(([, u]) => u),
  };
}

/**
 * Which line regroups the expression rightly, family by family (practice only: three choices)? The right line keeps
 * every sign; one has the first x-term's minus dropped (drop-minus, the notebook's slip: −11x moved as 11x); one has
 * that minus carried on to the x-terms after it (detach: −11x − 4x − 9x).
 */
function regroupMc() {
  for (;;) {
    const { v, terms } = collectParams();
    const xs = terms.filter(([, w]) => w); const ns = terms.filter(([, w]) => !w);
    // two numbers at least, and at most five terms: a line of six does not fit a choice on a 320px phone
    if (xs[0][0] > 0 || !xs.slice(1).some(([k]) => k > 0) || ns.length < 2 || terms.length > 5) continue;
    // not already in order: some number stands before an x-term
    if (terms.findIndex(([, w]) => !w) > terms.map(([, w]) => w).lastIndexOf(v)) continue;
    const right = sumTex([...xs, ...ns]);
    const dropped = sumTex([[-xs[0][0], v], ...xs.slice(1), ...ns]);
    const detached = sumTex([xs[0], ...xs.slice(1).map(([k]) => [-abs(k), v]), ...ns]);
    const choices = shuffle([{ ...tex(right), ok: true }, { ...tex(dropped), bug: 'drop-minus' }, { ...tex(detached), bug: 'detach' }]);
    return {
      key: `ex3r:${sumTex(terms)}`, text: 'איזו שורה היא הסידור הנכון של הביטוי לפי משפחות?', display: sumTex(terms), form: 'mc',
      ...(v !== 'x' ? { var: v } : {}), practiceOnly: true,
      choices, answer: choices.findIndex((c) => c.ok),
      hint: 'כל איבר זז עם הסימן שלפניו, והסימן לא עובר לאיבר אחר.',
      solution: [
        `הנכונה: $${right}$. כל איבר זז עם הסימן שלפניו.`,
        `בשורה $${dropped}$ המינוס של $${sumTex([xs[0]])}$ נעלם כשהאיבר זז.`,
        `בשורה $${detached}$ המינוס של $${sumTex([xs[0]])}$ עבר גם לאיברים עם $${v}$ שאחריו.`,
      ],
      diag: (u) => choices[u]?.bug || null,
    };
  }
}

// The tiles as a still picture: what is left once every zero pair is gone.
function tilesFig() {
  for (;;) {
    const px = R(0, 5); const nx = R(0, 5 - px); const p1 = R(0, 8); const n1 = R(0, 8 - p1);
    if (Math.min(px, nx) + Math.min(p1, n1) === 0 || px === nx || px + nx === 0 || p1 + n1 === 0) continue;
    const k = px - nx; const c = p1 - n1;
    return {
      key: `ex3t:${px}:${nx}:${p1}:${n1}`, text: 'אריח $x$ ואריח $-x$ יחד הם אפס, וכך גם $1$ ו־$-1$. איזה ביטוי נשאר כשמורידים את כל זוגות האפס?',
      form: 'lin', answer: { k, c }, fig: { type: 'tiles', px, nx, p1, n1 },
      hint: 'בכל שורה: כמה אריחים חיוביים יש יותר מאריחים שליליים, או להפך?',
      solution: [`בשורת ה־$x$: $${px} - ${nx} = ${T(k)}$, כלומר $${linTex(k, 0)}$`, `בשורת ה־$1$: $${p1} - ${n1} = ${T(c)}$`, `נשאר $${linTex(k, c)}$`],
      // every tile counted, the negative ones as positive: the minus dropped
      diag: (u) => (is(u, px + nx, c) || is(u, k, p1 + n1) || is(u, px + nx, p1 + n1) ? 'drop-minus' : null),
      // the only pairs diag() names (index.js namesOf): a verification's search reads these, not the whole grid
      tries: [{ k: px + nx, c }, { k, c: p1 + n1 }, { k: px + nx, c: p1 + n1 }],
    };
  }
}

// Which expression is equal for every x? Two of the wrong ones agree with the right one at one value (x = 1 or x = 0),
// so the solution shows that one substitution can only find a difference.
function identityMc() {
  for (;;) {
    const p = R(2, 9); const r = -R(1, 9); const q = NZ(-9, 9); const s = Math.random() < 0.5 ? NZ(-9, 9) : 0;
    if (p + r === 0 || q + s === 0 || p + q + r + s === 0) continue;
    // the H&L order (9 − 3x + 2x) half the time, so a detached minus is one of the choices
    const hl = Math.random() < 0.5;
    const terms = hl ? [[q, ''], [r, 'x'], [p, 'x'], ...(s ? [[s, '']] : [])] : [[p, 'x'], [q, ''], [r, 'x'], ...(s ? [[s, '']] : [])];
    const K = p + r; const C = q + s;
    const opts = [{ k: K, c: C, ok: true }, { k: K + C, c: 0, bug: 'conjoin' }, { k: p - r, c: C, bug: 'drop-minus' }];
    if (hl) opts.push({ k: -(abs(r) + p), c: C, bug: 'detach' });
    if (new Set(opts.map((o) => `${o.k},${o.c}`)).size < opts.length) continue;
    const choices = shuffle(opts.map((o) => ({ ...tex(linTex(o.k, o.c)), ok: o.ok, bug: o.bug })));
    const at = (o, x) => o.k * x + o.c; const orig = (x) => K * x + C;
    const conj = opts[1]; const drop = opts[2];
    return {
      key: `ex3i:${sumTex(terms)}`, text: 'איזה ביטוי שווה לביטוי הזה לכל ערך של $x$?', display: sumTex(terms), form: 'mc',
      choices, answer: choices.findIndex((c) => c.ok),
      hint: 'כנסו איברים דומים, ובדקו בהצבה של שני מספרים, למשל $x = 0$ ו־$x = 1$.',
      solution: [
        `מכנסים: $${T(p)}x ${r < 0 ? '-' : '+'} ${abs(r) === 1 ? '' : abs(r)}x = ${linTex(K, 0)}$, והמספרים: $${T(C)}$. התשובה: $${linTex(K, C)}$`,
        `$${linTex(conj.k, conj.c)}$ שווה לביטוי כש־$x = 1$ (שניהם $${orig(1)}$), אבל כש־$x = 0$ הביטוי $${orig(0)}$ ו־$${linTex(conj.k, conj.c)}$ נותן $${at(conj, 0)}$.`,
        `$${linTex(drop.k, drop.c)}$ שווה לביטוי כש־$x = 0$, אבל כש־$x = 1$ הוא $${at(drop, 1)}$ ולא $${orig(1)}$. הצבה אחת יכולה רק לגלות שביטויים שונים.`,
      ],
      diag: (u) => choices[u]?.bug || null,
    };
  }
}

// ---------------------------------------------------------------- 4. the distributive law (חוק הפילוג)
// Documented errors: only the first term multiplied (partial-dist: 3(x + 4) → 3x + 4; teacher-reported, Kirshner &
// Awtry 2004 on its visual pull), and a minus before the brackets that changes only the first sign
// (minus-bracket: −2(x − 3) → −2x − 6, −(x − 3) → −x − 3).

function expandItem() {
  // a term times a number first: 3 · 4x = 12x
  if (Math.random() < 0.12) {
    const A = R(2, 6) * (Math.random() < 0.4 ? -1 : 1); const c = R(2, 6);
    return {
      key: `ex4t:${A}:${c}`, text: 'כתבו בלי סימן הכפל:', display: `${T(A)} \\cdot ${c}x`, form: 'lin', answer: { k: A * c, c: 0 },
      hint: `$${c}x$ הוא $${c} \\cdot x$. כופלים את המספרים: $${T(A)} \\cdot ${c}$.`,
      solution: [`$${T(A)} \\cdot ${c}x = ${T(A)} \\cdot ${c} \\cdot x$`, `$= ${linTex(A * c, 0)}$`],
      diag: () => null,
    };
  }
  for (;;) {
    const a = Math.random() < 0.15 ? -1 : R(2, 7) * (Math.random() < 0.4 ? -1 : 1);
    const c = Math.random() < 0.6 ? 1 : R(2, 4); const b = NZ(-9, 9);
    if (a === -1 && c > 1) continue;
    const k = a * c; const cc = a * b;
    return {
      key: `ex4:${a}:${c}:${b}`, text: 'פתחו סוגריים:', display: bracketTex(a, c, b), form: 'lin', answer: { k, c: cc },
      hint: a < 0 ? `$${T(a)}$ כופל כל איבר בסוגריים, עם חוקי הסימנים: גם את $${linTex(c, 0)}$ וגם את $${T(b)}$.` : `$${a}$ כופל כל איבר בסוגריים: גם את $${linTex(c, 0)}$ וגם את $${T(b)}$.`,
      solution: [`$${T(a, true)} \\cdot ${c === 1 ? 'x' : `${c}x`} = ${linTex(k, 0)}$`, `$${T(a, true)} \\cdot ${T(b, true)} = ${T(cc)}$`, `$${bracketTex(a, c, b)} = ${linTex(k, cc)}$`],
      diag: (u) => {
        // −(x − 3) → −x − 3: with a = −1 the two errors are one and the same, the minus that changed only the first sign
        if (a === -1 && is(u, k, b)) return 'minus-bracket';
        if (is(u, k, b)) return 'partial-dist';
        if (a < 0 && is(u, k, -cc)) return 'minus-bracket';
        return null;
      },
    };
  }
}

// A rectangle a high and x + b long, still: its area without brackets (building one is taught in the discover step).
function areaFig() {
  for (;;) {
    const a = R(2, 5); const b = R(1, 9);
    if (a * b > 45) continue;
    return {
      key: `ex4a:${a}:${b}`, text: `כתבו את השטח של המלבן כביטוי בלי סוגריים. הגובה $${a}$, והאורך $x + ${b}$.`, form: 'lin', answer: { k: a, c: a * b },
      fig: { type: 'area', a, b },
      hint: 'המלבן מורכב משני חלקים. השטח של כל חלק הוא הגובה כפול האורך שלו.',
      solution: [`החלק של $x$: $${a} \\cdot x = ${a}x$`, `החלק של היחידות: $${a} \\cdot ${b} = ${a * b}$`, `$${a}(x + ${b}) = ${a}x + ${a * b}$`],
      diag: (u) => (is(u, a, b) ? 'partial-dist' : null),
    };
  }
}

// 7 · 98 = 7(100 − 2) = 700 − 14: the same law, in mental arithmetic.
function mentalItem() {
  const a = R(3, 9); const c = R(1, 3); const minus = Math.random() < 0.6; const n = minus ? 100 - c : 100 + c;
  const ans = a * n;
  return {
    key: `ex4m:${a}:${n}`, text: 'חשבו בעל פה, בעזרת חוק הפילוג:', display: `${a} \\cdot ${n}`, form: 'num', answer: ans,
    hint: `$${n} = 100 ${minus ? '-' : '+'} ${c}$. הכפילו ב־$${a}$ גם את $100$ וגם את $${c}$.`,
    solution: [`$${a} \\cdot ${n} = ${a} \\cdot (100 ${minus ? '-' : '+'} ${c})$`, `$= ${100 * a} ${minus ? '-' : '+'} ${a * c} = ${ans}$`],
    diag: (u) => (near(u, minus ? 100 * a - c : 100 * a + c) ? 'partial-dist' : null),
  };
}

// ---------------------------------------------------------------- 5. simplifying (פישוט ביטויים)

/** k 0: a(x + b) + cx + d; k 1: a(x + b) − (x + e); k 2: a(x + b) + c(x + e), c may be negative. */
function simplifyParams() {
  for (;;) {
    const k = pick([0, 1, 1, 2]); const a = R(2, 6); const b = NZ(-9, 9); const e = NZ(-9, 9);
    const c = k === 0 ? NZ(-6, 6) : k === 2 ? R(2, 5) * (Math.random() < 0.5 ? -1 : 1) : -1; const d = NZ(-9, 9);
    const K = a + c; const C = k === 0 ? a * b + d : a * b + c * e;
    if (K === 0) continue;
    const show = k === 0 ? `${bracketTex(a, 1, b)} ${c < 0 ? '-' : '+'} ${abs(c) === 1 ? '' : abs(c)}x ${d < 0 ? '-' : '+'} ${abs(d)}`
      : `${bracketTex(a, 1, b)} ${c < 0 ? '-' : '+'} ${bracketTex(abs(c), 1, e)}`;
    return { k, a, b, c, d, e, K, C, show };
  }
}
function simplifyItem() {
  const P = simplifyParams(); const { k, a, b, c, d, e, K, C } = P;
  const open1 = `${a}x ${a * b < 0 ? '-' : '+'} ${abs(a * b)}`;
  const second = k === 0 ? `${c < 0 ? '-' : '+'} ${abs(c) === 1 ? '' : abs(c)}x ${d < 0 ? '-' : '+'} ${abs(d)}` : `${c < 0 ? '-' : '+'} ${abs(c) === 1 ? '' : abs(c)}x ${c * e < 0 ? '-' : '+'} ${abs(c * e)}`;
  return {
    key: `ex5:${P.show}`, text: 'פשטו את הביטוי:', display: P.show, form: 'lin', answer: { k: K, c: C },
    hint: k === 0 ? 'קודם פותחים את הסוגריים, אחר כך מכנסים איברים דומים.' : 'קודם פותחים סוגריים. מינוס לפני סוגריים הופך את הסימן של כל איבר בתוכם.',
    solution: [`פותחים סוגריים: $${open1} ${second}$`, `מכנסים: $${linTex(K, C)}$`],
    diag: (u) => {
      // only the first term in a bracket multiplied: a(x + b) gave ax + b, and c(x + e) gave cx + e, in one bracket or
      // in both (in a(x + b) − (x + e) the second bracket is the minus-bracket error, so there only the first counts)
      const pd = k === 0 ? [b + d] : k === 1 ? [b - e] : [b + e, b + c * e, a * b + e];
      // every mistake that gives this expression: the two bracket mistakes can give the same one, and then the answer
      // is ambiguous (content/index.js makeItem)
      return [
        pd.some((v) => is(u, K, v)) && 'partial-dist',
        // a minus before the brackets changed only the first sign: −(x + e) gave −x + e
        (k === 1 || (k === 2 && c < 0)) && is(u, K, a * b - c * e) && 'minus-bracket',
        is(u, K + C, 0) && 'conjoin',
      ].filter(Boolean);
    },
  };
}

// The Ministry exam: a + b = −4, so −3(a + b) = 12. The whole bracket is one number.
function structureItem() {
  const s = NZ(-9, 9); const kind = pick(['k', 'k', 'half', 'square']);
  if (kind === 'half' && s % 2) return structureItem();
  const m = R(2, 5) * (Math.random() < 0.5 ? -1 : 1);
  const show = kind === 'k' ? `${m}(a + b)` : kind === 'half' ? '\\frac{a + b}{2}' : '(a + b)^2';
  const ans = kind === 'k' ? m * s : kind === 'half' ? s / 2 : s * s;
  return {
    key: `ex5s:${kind}:${s}:${m}`, text: `נתון: $a + b = ${T(s)}$. מה ערך הביטוי?`, display: show, form: 'num', answer: ans,
    hint: 'לא צריך לדעת מה $a$ ומה $b$. הסוגריים הם מספר אחד, והוא ידוע.',
    solution: [`מציבים $${T(s)}$ במקום $a + b$.`, kind === 'k' ? `$${m} \\cdot ${T(s, true)} = ${T(ans)}$` : kind === 'half' ? `$${T(s)} : 2 = ${T(ans)}$` : `$${T(s, true)}^2 = ${T(ans)}$`],
    // CLASSROOM-5: a negative sum squared, with its minus kept ((−4)² as −16) is signed:7's pow-keep-sign; not
    // pow-neg-base, whose words (−a² read as (−a)²) say the opposite
    diag: (u) => (kind === 'square' && s < 0 && near(u, -s * s) ? 'pow-keep-sign' : null),
  };
}

// Which expression equals a(x + b) − (x + e)? Every wrong choice is a real error; substituting x = 0 tells them apart.
function equalMc() {
  for (;;) {
    const a = R(2, 6); const b = NZ(-7, 7); const e = NZ(-9, 9);
    const K = a - 1; const right = a * b - e; const mb = a * b + e; const pd = b - e;
    if (new Set([right, mb, pd]).size < 3) continue;
    const show = `${bracketTex(a, 1, b)} - ${bracketTex(1, 1, e)}`;
    const choices = shuffle([{ ...tex(linTex(K, right)), ok: true }, { ...tex(linTex(K, mb)), bug: 'minus-bracket' }, { ...tex(linTex(K, pd)), bug: 'partial-dist' }]);
    return {
      key: `ex5e:${show}`, text: 'איזה ביטוי שווה לביטוי הזה?', display: show, form: 'mc', choices, answer: choices.findIndex((c) => c.ok),
      hint: 'פתחו את שני הסוגריים. מינוס לפני סוגריים הופך את הסימן של כל איבר בתוכם.',
      solution: [`פותחים את שני הסוגריים: $${a}x ${a * b < 0 ? '-' : '+'} ${abs(a * b)} - x ${e < 0 ? '+' : '-'} ${abs(e)}$`, `מכנסים: $${linTex(K, right)}$`, `בדיקה בהצבה $x = 0$: הביטוי נותן $${T(a)} \\cdot ${T(b, true)} - ${T(e, true)} = ${T(right)}$, וגם $${linTex(K, right)}$ נותן $${T(right)}$.`],
      diag: (u) => choices[u]?.bug || null,
    };
  }
}

export const EXPR = {
  id: 'expr', grade: '7', title: 'ביטויים אלגבריים', color: 'cobalt',
  desc: 'הצבה, ביטוי מתוך מצב, כינוס איברים דומים וחוק הפילוג',
  placement: false, alsoFor: ['8'],
  levels: [
    { title: 'הצבה בביטוי', gen: () => { const r = Math.random(); return r < 0.55 ? substItem() : r < 0.8 ? substTable() : substMc(); } },
    { title: 'כותבים ביטוי', gen: () => { const r = Math.random(); return r < 0.4 ? patternLin() : r < 0.65 ? patternTerm() : r < 0.8 ? patternMc() : wordsMc(); } },
    { title: 'כינוס איברים דומים', gen: () => { const r = Math.random(); return r < 0.5 ? collectItem() : r < 0.6 ? regroupMc() : r < 0.78 ? tilesFig() : identityMc(); } },
    { title: 'חוק הפילוג', gen: () => { const r = Math.random(); return r < 0.55 ? expandItem() : r < 0.75 ? areaFig() : mentalItem(); } },
    { title: 'פישוט ביטויים', gen: () => { const r = Math.random(); return r < 0.55 ? simplifyItem() : r < 0.7 ? structureItem() : equalMc(); } },
  ],
  cats: {
    concat: '$3x$ נקרא כמספר דו־ספרתי במקום כפל',
    order: 'חישבו משמאל לימין בלי לתת קדימות לכפל',
    'neg-sub': 'מספר שלילי הוצב בלי סוגריים, והמינוס נעלם',
    plus: '$3x$ נקרא כחיבור, $3 + x$, במקום כפל',
    coef: '$3x$ חושב כאילו כתוב רק $x$: המספר שלפני האות נשכח',
    'start-n': 'נספרו $n$ צעדים מהאיבר הראשון במקום $n - 1$',
    'diff-only': 'רק הצעד נכפל ב־$n$, וההתחלה נשכחה',
    'whole-object': 'איבר שלם הוכפל: האיבר ה־$20$ אינו פי $2$ מהאיבר ה־$10$',
    'times-plus': '"פי" (כפל) ו"יותר" (חיבור) התחלפו',
    reversal: 'היחס נכתב הפוך: מי שיש לו יותר קיבל פחות',
    conjoin: 'איברים לא דומים חוברו לאיבר אחד ($3x + 5$ הפך ל־$8x$)',
    'drop-minus': 'המינוס שלפני איבר נעלם ($7x - 3x$ הפך ל־$10x$)',
    detach: 'המינוס עבר גם לאיבר שאחריו ($9 - 3x + 2x$ הפך ל־$9 - 5x$)',
    // CLASSROOM-6.6, bracketed x-terms added as the class adds signed numbers (signed's ids; expr:3 has its own titles)
    'abs-add': 'חיברו את המקדמים כשהסימנים שונים, במקום לחסר ($(-9x) + (+4x)$ הפך ל־$-13x$)',
    sign: 'הסכום של משפחת ה־$x$ יצא עם הסימן ההפוך ($(-6x) + (+5x)$ הפך ל־$x$)',
    'partial-dist': 'רק האיבר הראשון שבסוגריים נכפל',
    'minus-bracket': 'מינוס לפני סוגריים הפך רק את הסימן הראשון',
    // CLASSROOM-5: (a + b)² with a negative sum squared to a negative number, as signed:7 names it
    'pow-keep-sign': 'השאירו את המינוס של הבסיס גם במעריך זוגי ($(-5)^2 = -25$)',
  },
  lesson: {
    points: [
      '$3x$ פירושו $3 \\cdot x$. כש־$x = 4$: $3x = 12$.',
      'מציבים מספר שלילי בסוגריים: $10 - 2 \\cdot (-3) = 16$.',
      'איברים דומים: $2x + 3x = 5x$. אבל $3x + 5$ נשאר כמו שהוא.',
      'חוק הפילוג: $3(x + 4) = 3x + 12$.',
      'מינוס לפני סוגריים הופך כל סימן בפנים: $-(x - 3) = -x + 3$.',
      'בודקים פישוט בהצבה: $2(x + 3) - x = x + 6$, וכש־$x = 4$ שני הביטויים $10$.',
    ],
  },
};
