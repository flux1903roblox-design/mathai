// The class's signed-number questions (CLASSROOM-1 and -2): chains of five numbers in brackets, absolute value and
// opposites. One source for the exercise generators (content/grade7.js, with Math.random) and the diagnostic models
// (learn/content/signed.ts, with a seeded source), so a question, its predicted mistakes and its worked solution are
// drawn and written the same way in both. `r` is a random source: a function returning a number in [0, 1).
//
// Every draw follows the redraw rule of finish/specs/classroom.md §0.3: no predicted mistake equals the answer or is
// a slip of it (learn/misconceptions.ts slipOf), no two mistakes predict one value, and the answer is never a number
// printed in the question. The numbers are checked by the lane's verify script (spec_check.mjs, section C).
import { S, T } from './util.js';
import { slipOf } from '@/learn/misconceptions.ts';

const rint = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const rnz = (r, a, b) => { let v; do { v = rint(r, a, b); } while (v === 0); return v; };
const same = (x, y) => Math.abs(x - y) < 1e-9;
const mix = (arr, r) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i -= 1) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
/** Left-to-right mark: keeps a minus in front of its number inside a Hebrew choice ("רק ‎−7", not "7− רק"). */
const LRM = '‎';

/** The redraw rule: true when the draw may be asked. `bugs` maps an id to its predicted answer (or null). */
export function fair(ans, bugs, printed = []) {
  const vals = Object.values(bugs).filter((v) => v != null && Number.isFinite(v));
  if (vals.some((v) => same(v, ans) || slipOf(v, ans))) return false;
  if (new Set(vals.map((v) => v.toFixed(6))).size !== vals.length) return false;
  return !printed.some((n) => same(n, ans));
}

/** A line of signed numbers without brackets, as the class writes it after removing them: -8 + 3 + 6 - 9 - 4. */
export function lineTex(ws) {
  return ws.map((w, i) => (i === 0 ? T(w) : `${w < 0 || Object.is(w, -0) ? '-' : '+'} ${Math.abs(w)}`)).join(' ');
}

/**
 * The class's sign-outside line for a + b: the sign goes outside, the absolute values inside.
 * (+4) + (-11) = -(11 - 4) = -7, and (-6) + (+13) = +(13 - 6) = +7 = 7. Null when the sum is 0.
 */
export function signOutside(a, b) {
  const ans = a + b;
  if (ans === 0) return null;
  const [big, small] = Math.abs(a) >= Math.abs(b) ? [Math.abs(a), Math.abs(b)] : [Math.abs(b), Math.abs(a)];
  const inner = Math.sign(a) === Math.sign(b) ? `${Math.abs(a)} + ${Math.abs(b)}` : `${big} - ${small}`;
  const end = ans < 0 ? `${ans}` : `+${ans} = ${ans}`;
  return `${S(a)} + ${S(b)} = ${ans < 0 ? '-' : '+'}(${inner}) = ${end}`;
}

// ---------------------------------------------------------------- chains of five bracketed numbers (CLASSROOM-2)
// A chain is { o, v }: term i is o[i]·v[i], written "op S(v)" (o = 1 for +, -1 for −; the first term has no op).

/** The value of a chain. */
export const chainValue = (c) => c.o.reduce((s, o, i) => s + o * c.v[i], 0);
/** Each term after the brackets are removed: −(−6) is +6, −(+9) is −9, +(−4) is −4, and "− 0" is −0. */
export const chainTerms = (c) => c.o.map((o, i) => o * c.v[i]);
/** The terms when every −(−n) is read as −n: the bracket removed wrongly. */
const mmTerms = (c) => c.o.map((o, i) => (o < 0 && c.v[i] < 0 ? c.v[i] : o * c.v[i]));

/** The chain's mistakes (labels.test.js recomputes each from the key). */
export function chainBugs(c) {
  const ans = chainValue(c);
  return {
    // every −(−n) read as −n
    'minus-minus': mmTerms(c).reduce((s, w) => s + w, 0),
    // the first number's minus dropped
    'drop-sign': c.v[0] < 0 ? ans - 2 * c.v[0] : null,
    // the size right, the sign not
    sign: ans !== 0 ? -ans : null,
  };
}

const hasBoth = (c) => [1, 2, 3, 4].some((i) => c.o[i] < 0 && c.v[i] < 0) && [1, 2, 3, 4].some((i) => c.o[i] < 0 && c.v[i] > 0);

/**
 * Five terms, n in ±1..12, the first op +, at least one −(−n) and one −(+n); in about one draw in five a term is "− 0"
 * (`zero: false` never). Redrawn by the rule above.
 */
export function drawChain(r, { zero = true } = {}) {
  for (;;) {
    const c = { o: [1, ...[1, 2, 3, 4].map(() => (r() < 0.5 ? 1 : -1))], v: [0, 1, 2, 3, 4].map(() => rnz(r, -12, 12)) };
    if (!hasBoth(c)) continue;
    if (zero && r() < 0.2) { const i = rint(r, 1, 4); if (!(c.o[i] < 0 && c.v[i] < 0)) { c.o[i] = -1; c.v[i] = 0; } }
    if (!hasBoth(c)) continue;
    if (fair(chainValue(c), chainBugs(c), c.v)) return c;
  }
}

/** The chain as TeX, in the class's brackets: (-8) + (+3) - (-6) - (+9) + (-4); a zero is "- 0". */
export const chainTex = (c) => c.v.map((v, i) => (i === 0 ? S(v) : `${c.o[i] < 0 ? '-' : '+'} ${S(v)}`)).join(' ');
/** The chain in a key: its ops and its values, "+,+,-,-,+:-8,3,-6,9,-4". */
export const chainKey = (c) => `${c.o.map((o) => (o < 0 ? '-' : '+')).join(',')}:${c.v.join(',')}`;
/** A key's chain back (labels.test.js reads the numbers the student saw from it). */
export const chainOfKey = (key) => {
  const [ops, vals] = String(key).split(':').slice(1);
  return { o: ops.split(',').map((s) => (s === '-' ? -1 : 1)), v: vals.split(',').map(Number) };
};

/** A group of numbers of one sign, with its sum when it has more than one: "-8 - 9 - 4 = -21", or "6". */
const groupTex = (ws) => (ws.length > 1 ? `${lineTex(ws)} = ${T(ws.reduce((s, w) => s + w, 0))}` : T(ws[0]));

/** The class's two steps: remove the brackets in one line, then the negatives together and the positives together. */
export function chainSolution(c) {
  const ws = chainTerms(c); const ans = chainValue(c);
  const neg = ws.filter((w) => w < 0); const pos = ws.filter((w) => w > 0);
  const N = neg.reduce((s, w) => s + w, 0); const P = pos.reduce((s, w) => s + w, 0);
  const out = [`מורידים סוגריים: $${lineTex(ws)}$`];
  if (ws.some((w) => w === 0)) out.push('מחסרים $0$: לא משתנה כלום.');
  out.push(`השליליים יחד: $${groupTex(neg)}$. החיוביים יחד: $${groupTex(pos)}$.`);
  out.push(`וכולם יחד: $${T(N)} + ${P} = ${T(ans)}$`);
  out.push(`התשובה: $${T(ans)}$`);
  return out;
}
export const CHAIN_HINT = 'קודם מורידים סוגריים: $-(-a)$ הוא $+a$, ו־$-(+a)$ הוא $-a$. אחר כך מחברים את השליליים יחד ואת החיוביים יחד.';

/**
 * The regrouping step as a choice (practice only): the right line, the same line with one negative number's minus
 * gone (drop-minus, the notebook's slip), and the line with every −(−n) taken as −n (minus-minus), each grouped
 * negatives first. No "− 0" here: the line is about signs that move.
 */
export function regroupLines(c, r) {
  const ws = chainTerms(c);
  const right = [...ws.filter((w) => w < 0), ...ws.filter((w) => w > 0)];
  // the minus lost on a number that moved (any negative but the first when there is one, else the first)
  const negAt = right.map((w, i) => (w < 0 ? i : -1)).filter((i) => i >= 0);
  const pool = negAt.length > 1 ? negAt.slice(1) : negAt;
  const j = pool[Math.floor(r() * pool.length)];
  const lost = right.map((w, i) => (i === j ? -w : w));
  const mm = mmTerms(c);
  const wrong = [...mm.filter((w) => w < 0), ...mm.filter((w) => w > 0)];
  return { right, lost, wrong, j };
}

// ---------------------------------------------------------------- absolute value (CLASSROOM-1)
// { k, a, b }: k 0 |a| + |b|, k 1 |a| − |b|; a in −15..−2, b in ±1..12.

const abs = (x) => `\\lvert ${T(x)} \\rvert`; // a space before the minus, so content/index.js fairForCheck sees it
export const absValue = (p) => (p.k ? Math.abs(p.a) - Math.abs(p.b) : Math.abs(p.a) + Math.abs(p.b));
/** The bars ignored: |−7| + |−5| read as −7 + (−5). */
export const absBug = (p) => (p.k ? p.a - p.b : p.a + p.b);
export function drawAbs(r) {
  for (;;) {
    const p = { k: rint(r, 0, 1), a: -rint(r, 2, 15), b: rnz(r, -12, 12) };
    if (fair(absValue(p), { 'abs-keep-sign': absBug(p) }, [p.a, p.b])) return p;
  }
}
export const absTex = (p) => `${abs(p.a)} ${p.k ? '-' : '+'} ${abs(p.b)}`;
export const absSolution = (p) => [
  `הערך המוחלט הוא המרחק מאפס: $${abs(p.a)} = ${Math.abs(p.a)}$, $${abs(p.b)} = ${Math.abs(p.b)}$.`,
  `$${Math.abs(p.a)} ${p.k ? '-' : '+'} ${Math.abs(p.b)} = ${T(absValue(p))}$`,
  `התשובה: $${T(absValue(p))}$`,
];
export const ABS_HINT = 'הערך המוחלט הוא המרחק מאפס, ולכן הוא אף פעם לא שלילי. קודם כל ערך מוחלט לבד, ואחר כך הפעולה.';

// ---------------------------------------------------------------- opposites (CLASSROOM-1)
// { k, a }: k 0 "the opposite of a" (a in ±2..20), k 1 −(a) with a < 0, k 2 a + □ = 0. The answer is −a.

export function drawOpp(r) {
  const k = rint(r, 0, 2);
  const a = k === 1 ? -rint(r, 2, 20) : (r() < 0.5 ? -1 : 1) * rint(r, 2, 20);
  return { k, a };
}
export const oppText = (p) => (p.k === 0 ? `מה המספר הנגדי של $${T(p.a)}$?` : p.k === 1 ? 'חשבו:' : 'איזה מספר צריך לכתוב במקום הריבוע?');
export const oppTex = (p) => (p.k === 1 ? `-(${T(p.a)})` : p.k === 2 ? `${T(p.a)} + \\square = 0` : undefined);
const side = (a) => (a < 0 ? 'משמאל' : 'מימין');
export const oppSolution = (p) => {
  const far = `$${T(p.a)}$ נמצא ${Math.abs(p.a)} צעדים ${side(p.a)} לאפס. הנגדי שלו נמצא באותו מרחק, בצד השני: $${T(-p.a)}$.`;
  if (p.k === 1) return [`מינוס לפני מספר הוא הנגדי שלו: $-(${T(p.a)})$ הוא הנגדי של $${T(p.a)}$.`, far, `התשובה: $${T(-p.a)}$`];
  if (p.k === 2) return ['מספר ועוד הנגדי שלו הם $0$.', far, `$${T(p.a)} + ${T(-p.a, true)} = 0$, ולכן התשובה: $${T(-p.a)}$`];
  return [far, `התשובה: $${T(-p.a)}$`];
};
export const oppHint = (p) => (p.k === 2 ? 'מספר ועוד הנגדי שלו הם $0$. מה הנגדי של המספר הראשון?' : 'המספר הנגדי נמצא באותו מרחק מאפס, בצד השני של האפס.');

// ---------------------------------------------------------------- the exercise generators' items

/** signed:1, a typed chain (key sn1c). */
export function chainItem(r) {
  const c = drawChain(r); const ans = chainValue(c); const bugs = chainBugs(c);
  return {
    key: `sn1c:${chainKey(c)}`, text: 'חשבו:', display: chainTex(c), form: 'num', answer: ans,
    hint: CHAIN_HINT, solution: chainSolution(c),
    diag: (u) => Object.keys(bugs).find((id) => bugs[id] != null && same(u, bugs[id])) || null,
  };
}

/** signed:1, which line regroups the chain right (practice only: a choice among three; key sn1r). */
export function regroupItem(r) {
  const c = drawChain(r, { zero: false });
  const { right, lost, wrong } = regroupLines(c, r);
  const choices = mix([{ tex: lineTex(right), ok: true }, { tex: lineTex(lost), bug: 'drop-minus' }, { tex: lineTex(wrong), bug: 'minus-minus' }], r);
  return {
    key: `sn1r:${chainKey(c)}`, text: 'מורידים סוגריים, ואז מסדרים: השליליים יחד והחיוביים יחד. איזו שורה היא הסידור הנכון?',
    display: chainTex(c), form: 'mc', choices: choices.map(({ tex, bug }) => ({ tex, ...(bug ? { bug } : {}) })), answer: choices.findIndex((x) => x.ok), practiceOnly: true,
    hint: 'בכל איבר, הפעולה והסימן שבסוגריים הופכים לסימן אחד. כשמסדרים, כל מספר זז יחד עם הסימן שלפניו.',
    solution: [`מורידים סוגריים: $${lineTex(chainTerms(c))}$`, `מסדרים, וכל מספר זז עם הסימן שלו: $${lineTex(right)}$`],
    diag: (u) => choices[u]?.bug || null,
  };
}

/** signed:2, absolute value (key sn2a:k:a:b). */
export function absItem(r) {
  const p = drawAbs(r); const ans = absValue(p); const bug = absBug(p);
  return {
    key: `sn2a:${p.k}:${p.a}:${p.b}`, text: 'חשבו:', display: absTex(p), form: 'num', answer: ans,
    hint: ABS_HINT, solution: absSolution(p),
    diag: (u) => (same(u, bug) ? 'abs-keep-sign' : null),
  };
}

/** signed:2, the opposite of a number (key sn2o:k:a). */
export function oppItem(r) {
  const p = drawOpp(r); const display = oppTex(p);
  return {
    key: `sn2o:${p.k}:${p.a}`, text: oppText(p), ...(display ? { display } : {}), form: 'num', answer: -p.a,
    hint: oppHint(p), solution: oppSolution(p),
    diag: (u) => (same(u, p.a) ? 'opp-same' : null),
  };
}

/** signed:2, which numbers have absolute value n (practice only: a choice among three; key sn2m:n). */
export function absMc(r) {
  const n = rint(r, 2, 15);
  const choices = mix([{ text: `${n} ו־${LRM}−${n}`, ok: true }, { text: `רק ${n}` }, { text: `רק ${LRM}−${n}` }], r);
  return {
    key: `sn2m:${n}`, text: `לאילו מספרים הערך המוחלט הוא $${n}$?`, form: 'mc',
    choices: choices.map(({ text }) => ({ text })), answer: choices.findIndex((x) => x.ok), practiceOnly: true,
    hint: `הערך המוחלט הוא המרחק מאפס. כמה מספרים נמצאים ${n} צעדים מאפס?`,
    solution: [`גם $${n}$ וגם $${-n}$ נמצאים ${n} צעדים מאפס, משני צדדיו.`, `$${abs(n)} = ${abs(-n)} = ${n}$`],
    diag: () => null,
  };
}
