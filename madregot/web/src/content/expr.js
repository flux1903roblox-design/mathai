// Grade 7 (ז׳): algebraic expressions (ביטויים אלגבריים), in the order of the Ministry's programme: substituting a
// number, writing an expression from a pattern or a sentence, collecting like terms, the distributive law, and
// simplifying (brackets, then collecting). The expression answers use the 'lin' form (□x + □): the coefficient and the
// constant are typed, an expression is never parsed from free text.
// Taught from December, so the first-day placement test skips it (placement: false); a grade 8 test that revises
// equations with brackets can include it in Exam Rescue (alsoFor).
import { R, NZ, pick, shuffle, T, near } from './util.js';

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
// Forms: 0 b + ax, 1 b − ax, 2 ax + b. The three documented errors: 3x read as the number 34 (concat), left to right
// without multiplication first (order), and a negative value put in without brackets, its minus lost (neg-sub).

const SUB_FORMS = {
  show: (f, a, b) => (f === 0 ? `${T(b)} + ${a}x` : f === 1 ? `${T(b)} - ${a}x` : `${a}x ${b < 0 ? '-' : '+'} ${abs(b)}`),
  /** The value with the product ax replaced by `prod`. */
  with: (f, b, prod) => (f === 1 ? b - prod : b + prod),
  /** Left to right, as if there were no order of operations: (b ± a)·x. Form 2 is already in that order. */
  ltr: (f, a, b, x) => (f === 0 ? (b + a) * x : f === 1 ? (b - a) * x : null),
};
const substValue = (f, a, b, x) => SUB_FORMS.with(f, b, a * x);
/** The three predictions of a wrong substitution; null when it does not apply here. */
function substBugs(f, a, b, x) {
  return {
    concat: x >= 1 && x <= 9 ? SUB_FORMS.with(f, b, 10 * a + x) : null,
    order: SUB_FORMS.ltr(f, a, b, x),
    'neg-sub': x < 0 ? SUB_FORMS.with(f, b, a * -x) : null,
  };
}
const substDiag = (f, a, b, x) => (u) => {
  const ans = substValue(f, a, b, x);
  const hit = Object.entries(substBugs(f, a, b, x)).find(([, v]) => v != null && v !== ans && near(u, v));
  return hit ? hit[0] : null;
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

// 3x at x = 4 is 12, not 34 and not 7: the three readings side by side.
function substMc() {
  for (;;) {
    const a = R(2, 9); const x = R(2, 9);
    if (a + x === a * x) continue; // 2x at x = 2: two choices would be the same
    const choices = shuffle([{ ...tex(String(a * x)), ok: true }, { ...tex(String(10 * a + x)), bug: 'concat' }, tex(String(a + x))]);
    return {
      key: `ex1m:${a}:${x}`, text: `מה ערך הביטוי כש־$x = ${x}$?`, display: `${a}x`, form: 'mc',
      choices, answer: choices.findIndex((c) => c.ok),
      hint: `$${a}x$ הוא קיצור של $${a} \\cdot x$: מספר צמוד לאות כופל אותה.`,
      solution: [`$${a}x = ${a} \\cdot x$`, `$${a} \\cdot ${x} = ${a * x}$`, `$${10 * a + x}$ הוא מה שיוצא כשכותבים את הספרות זו ליד זו, ו־$${a + x}$ הוא חיבור.`],
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
    key: `ex2l:${s}:${d}:${P.head[0]}`, text: `${P.story(s, d)} כתבו ביטוי ל${P.what} ה־$n$.`, form: 'lin', var: 'n',
    answer: { k: d, c: s - d }, fig: { type: 'table', head: P.head, rows: patternRows(s, d, 4) },
    hint: `בכל צעד מוסיפים $${d}$, ולכן יש $${d}n$ בביטוי. בדקו את $n = 1$: הביטוי צריך לתת $${s}$.`,
    solution: [stepsWhy(s, d), `$${s} + ${d}(n - 1) = ${s} + ${d}n - ${d} = ${linTex(d, s - d, 'n')}$`, `בדיקה: כש־$n = 1$ יוצא $${d} ${s - d < 0 ? '-' : '+'} ${abs(s - d)} = ${s}$, כמו בטבלה.`],
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

// Choose the expression. The right one is written simplified half the time, and a distractor with (n + 1) is there
// too, so "the one with n − 1" is not a give-away: substituting n = 1 is.
function patternMc() {
  const { s, d, P } = patternParams();
  const simple = Math.random() < 0.5;
  const choices = shuffle([
    { ...tex(simple ? linTex(d, s - d, 'n') : `${s} + ${d}(n - 1)`), ok: true },
    { ...tex(`${s} + ${d}n`), bug: 'start-n' },
    { ...tex(`${d}n`), bug: 'diff-only' },
    tex(`${s} + ${d}(n + 1)`),
  ]);
  return {
    key: `ex2m:${s}:${d}:${simple}:${P.head[0]}`, text: `${P.story(s, d)} איזה ביטוי נותן את ${P.what} ה־$n$?`, form: 'mc',
    choices, answer: choices.findIndex((c) => c.ok), fig: { type: 'table', head: P.head, rows: patternRows(s, d, 3) },
    hint: 'הציבו $n = 1$ ו־$n = 2$ בכל ביטוי, והשוו לטבלה.',
    solution: [stepsWhy(s, d), simple ? `$${s} + ${d}(n - 1) = ${linTex(d, s - d, 'n')}$` : `כש־$n = 1$: $${s} + ${d} \\cdot 0 = ${s}$, כמו בטבלה.`, `$${s} + ${d}n$ נותן $${s + d}$ כבר באיבר הראשון, ו־$${d}n$ נותן רק $${d}$.`],
    diag: (u) => choices[u]?.bug || null,
  };
}

// From a sentence to an expression. The check is a number, never a key word: "if Amit has 5, David has 11".
const WORDS = [
  (c) => ({ v: 'x', text: `לעמית יש $x$ ספרים. לדוד יש $${c}$ ספרים יותר מלעמית. כמה ספרים יש לדוד?`, right: `x + ${c}`, wrong: [[`${c}x`, 'times-plus'], [`x - ${c}`, 'reversal']], at: 5, value: (x) => x + c, story: (x) => `לעמית $${x}$ ספרים, ולדוד $${c}$ יותר: $${x + c}$.` }),
  (c) => ({ v: 'x', text: `לעמית יש $x$ ספרים. ליובל יש פי $${c}$ מספר הספרים של עמית. כמה ספרים יש ליובל?`, right: `${c}x`, wrong: [[`x + ${c}`, 'times-plus'], [`x : ${c}`, 'reversal']], at: 5, value: (x) => c * x, story: (x) => `לעמית $${x}$ ספרים, וליובל פי $${c}$: $${c * x}$.` }),
  (c) => ({ v: 'x', text: `לנועה יש $x$ ₪. לשירה יש $${c}$ ₪ פחות מלנועה. כמה כסף יש לשירה?`, right: `x - ${c}`, wrong: [[`${c} - x`, 'reversal'], [`x + ${c}`, 'reversal']], at: 20, value: (x) => x - c, story: (x) => `לנועה $${x}$ ₪, ולשירה $${c}$ פחות: $${x - c}$.` }),
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

/** p x + q + r x (+ s) in a random order with two x-terms; p + r ≠ 0. */
function collectParams() {
  for (;;) {
    const p = NZ(-9, 9); const r = NZ(-9, 9); const q = NZ(-12, 12); const s = Math.random() < 0.7 ? NZ(-12, 12) : 0;
    if (p + r === 0 || (q + s === 0 && Math.random() < 0.8)) continue;
    const terms = shuffle([[p, 'x'], [q, ''], [r, 'x'], ...(s ? [[s, '']] : [])]);
    if (terms[0][1] === '' && terms[1][1] === '' && !terms.slice(2).some(([, v]) => v === '')) continue; // not already grouped
    return { p, q, r, s, terms };
  }
}
/** The x-terms and the numbers as they stand in the display, for the diagnosis. */
function collectBugs(terms) {
  const xs = terms.filter(([, v]) => v === 'x').map(([k]) => k);
  const ns = terms.filter(([, v]) => v === '').map(([k]) => k);
  const K = xs.reduce((a, b) => a + b, 0); const C = ns.reduce((a, b) => a + b, 0);
  const oneNeg = (arr) => arr.length === 2 && (arr[0] < 0) !== (arr[1] < 0);
  return {
    K, C,
    conjoin: { k: K + C, c: 0 },
    // the minus of the negative x-term dropped (only one of the two is negative)
    dropX: oneNeg(xs) ? { k: abs(xs[0]) + abs(xs[1]), c: C } : null,
    dropN: oneNeg(ns) ? { k: K, c: abs(ns[0]) + abs(ns[1]) } : null,
    // a negative x-term followed by a positive one: −3x + 2x read as −(3x + 2x)
    detach: xs.length === 2 && xs[0] < 0 && xs[1] > 0 ? { k: -(abs(xs[0]) + xs[1]), c: C } : null,
  };
}
const collectDiag = (terms) => (u) => {
  const b = collectBugs(terms);
  if (is(u, b.conjoin.k, b.conjoin.c)) return 'conjoin';
  if (b.detach && is(u, b.detach.k, b.detach.c)) return 'detach';
  if ((b.dropX && is(u, b.dropX.k, b.dropX.c)) || (b.dropN && is(u, b.dropN.k, b.dropN.c))) return 'drop-minus';
  return null;
};
function collectSolution(terms) {
  const xs = terms.filter(([, v]) => v === 'x'); const ns = terms.filter(([, v]) => v === '');
  const K = xs.reduce((a, [k]) => a + k, 0); const C = ns.reduce((a, [k]) => a + k, 0);
  return [
    `מסדרים: קודם האיברים עם $x$, אחר כך המספרים. כל איבר זז עם הסימן שלפניו: $${sumTex([...xs, ...ns])}$`,
    `$x$־ים: $${xs.map(([k]) => T(k, true)).join(' + ')} = ${T(K)}$, כלומר $${linTex(K, 0)}$`,
    `מספרים: $${ns.map(([k]) => T(k, true)).join(' + ')} = ${T(C)}$`,
    `התשובה: $${linTex(K, C)}$`,
  ];
}

function collectItem() {
  const { terms } = collectParams();
  const b = collectBugs(terms);
  return {
    key: `ex3:${sumTex(terms)}`, text: 'כנסו איברים דומים:', display: sumTex(terms), form: 'lin', answer: { k: b.K, c: b.C },
    hint: 'מחברים $x$־ים עם $x$־ים ומספרים עם מספרים. הסימן שלפני איבר שייך לו.',
    solution: collectSolution(terms), diag: collectDiag(terms),
  };
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
        `מכנסים: $${T(p)}x ${r < 0 ? '-' : '+'} ${abs(r)}x = ${linTex(K, 0)}$, והמספרים: $${T(C)}$. התשובה: $${linTex(K, C)}$`,
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
      // only the first term in a bracket multiplied: a(x + b) gave ax + b, and c(x + e) gave cx + e
      // (in a(x + b) − (x + e) the second bracket is the minus-bracket error, so there only the first counts)
      const pd = k === 0 ? b + d : k === 1 ? b - e : b + e;
      if (is(u, K, pd)) return 'partial-dist';
      // a minus before the brackets changed only the first sign: −(x + e) gave −x + e
      if ((k === 1 || (k === 2 && c < 0)) && is(u, K, a * b - c * e)) return 'minus-bracket';
      if (is(u, K + C, 0)) return 'conjoin';
      return null;
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
    diag: () => null,
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
      solution: [`$${show} = ${a}x ${a * b < 0 ? '-' : '+'} ${abs(a * b)} - x ${e < 0 ? '+' : '-'} ${abs(e)}$`, `$= ${linTex(K, right)}$`, `בדיקה בהצבה $x = 0$: הביטוי נותן $${T(a)} \\cdot ${T(b, true)} - ${T(e, true)} = ${T(right)}$, וגם $${linTex(K, right)}$ נותן $${T(right)}$.`],
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
    { title: 'כינוס איברים דומים', gen: () => { const r = Math.random(); return r < 0.5 ? collectItem() : r < 0.7 ? tilesFig() : identityMc(); } },
    { title: 'חוק הפילוג', gen: () => { const r = Math.random(); return r < 0.55 ? expandItem() : r < 0.75 ? areaFig() : mentalItem(); } },
    { title: 'פישוט ביטויים', gen: () => { const r = Math.random(); return r < 0.55 ? simplifyItem() : r < 0.7 ? structureItem() : equalMc(); } },
  ],
  cats: {
    concat: '$3x$ נקרא כמספר דו־ספרתי במקום כפל',
    order: 'חישבו משמאל לימין בלי לתת קדימות לכפל',
    'neg-sub': 'מספר שלילי הוצב בלי סוגריים, והמינוס נעלם',
    'start-n': 'נספרו $n$ צעדים מהאיבר הראשון במקום $n - 1$',
    'diff-only': 'רק הצעד נכפל ב־$n$, וההתחלה נשכחה',
    'whole-object': 'איבר שלם הוכפל: האיבר ה־$20$ אינו פי $2$ מהאיבר ה־$10$',
    'times-plus': '"פי" (כפל) ו"יותר" (חיבור) התחלפו',
    reversal: 'היחס נכתב הפוך: מי שיש לו יותר קיבל פחות',
    conjoin: 'איברים לא דומים חוברו לאיבר אחד ($3x + 5$ הפך ל־$8x$)',
    'drop-minus': 'המינוס שלפני איבר נעלם ($7x - 3x$ הפך ל־$10x$)',
    detach: 'המינוס עבר גם לאיבר שאחריו ($9 - 3x + 2x$ הפך ל־$9 - 5x$)',
    'partial-dist': 'רק האיבר הראשון שבסוגריים נכפל',
    'minus-bracket': 'מינוס לפני סוגריים הפך רק את הסימן הראשון',
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
