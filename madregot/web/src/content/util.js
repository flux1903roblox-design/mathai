// Helpers shared by the question generators. Math is written in TeX and
// rendered with KaTeX; Hebrew text carries inline math between $...$.

export const R = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
export const NZ = (a, b) => { let v; do { v = R(a, b); } while (v === 0); return v; };
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
export const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; };

/** A number as TeX; negative numbers get parentheses when `wrap` is set. */
export const T = (n, wrap = false) => {
  if (Number.isInteger(n)) return n < 0 ? (wrap ? `(${n})` : `${n}`) : `${n}`;
  return fracTex(n, wrap);
};

/** Reduce p/q to [p, q] with q > 0. */
export const reduce = (p, q) => { const g = gcd(p, q); const s = q < 0 ? -1 : 1; return [(s * p) / g, (s * q) / g]; };

/** A rational value p/q as TeX (\frac), or an integer. */
export function ratioTex(p, q, wrap = false) {
  const [a, b] = reduce(p, q);
  if (b === 1) return T(a, wrap);
  const t = `${a < 0 ? '-' : ''}\\frac{${Math.abs(a)}}{${b}}`;
  return wrap && a < 0 ? `\\left(${t}\\right)` : t;
}
function fracTex(x, wrap) {
  for (let q = 2; q <= 12; q++) {
    const p = Math.round(x * q);
    if (Math.abs(p / q - x) < 1e-9) return ratioTex(p, q, wrap);
  }
  const s = String(Math.round(x * 100) / 100);
  return x < 0 && wrap ? `(${s})` : s;
}

/**
 * Plain-text number for answers shown to students and sent to the AI.
 * Fractions by default (a slope of 3/4); with { decimal: true } a short decimal stays a decimal (a mean of 5.4).
 * `maxDen` is the largest denominator tried (12; an item marked `precise` asks for 100, so 11/36 prints as 11/36 and
 * not as 0.31), and `places` the decimal places a decimal keeps (2; 3 for precise and `fmt: 'dec'` items).
 */
export function plainNum(x, { decimal = false, maxDen = 12, places = 2 } = {}) {
  if (Number.isInteger(x)) return String(x);
  // a whole number that floating point left a hair off (2.9999999999999996) is that whole number, never "3/1"
  if (Math.abs(x - Math.round(x)) < 1e-9) return String(Math.round(x) || 0);
  const k = 10 ** places;
  if (decimal && Math.abs(Math.round(x * k) / k - x) < 1e-9) return String(Math.round(x * k) / k);
  for (let q = 2; q <= maxDen; q++) {
    const p = Math.round(x * q);
    if (Math.abs(p / q - x) < 1e-9) { const [a, b] = reduce(p, q); return b === 1 ? String(a) : `${a}/${b}`; }
  }
  return String(Math.round(x * k) / k);
}

/** A value as an exact fraction in lowest terms, { n, d } with d > 0, or null when no denominator up to maxDen fits. */
export function toFrac(x, maxDen = 1000) {
  if (typeof x !== 'number' || !Number.isFinite(x)) return null;
  for (let q = 1; q <= maxDen; q++) {
    const p = Math.round(x * q);
    if (Math.abs(p / q - x) < 1e-9) { const [n, d] = reduce(p, q); return { n: n || 0, d }; }
  }
  return null;
}

/** A value as exact TeX: a fraction in lowest terms up to /100 (\frac{11}{36}), else as T writes it. */
export const exactTex = (x) => { const f = toFrac(x, 100); return f ? ratioTex(f.n, f.d) : T(x); };

const DASHES = /[−–—]/g;
/** A mixed number as typed on a computer keyboard: "2 1/2", "-1 3/4" (a whole number, a space, a fraction). */
const MIXED = /^([+-]?)(\d+)\s+(\d+)\/(\d+)$/;

/**
 * Parse what a student typed: "−3", "-3", "2.5", "2,5", "3/4", "-3/4", and, on a computer keyboard, a mixed number:
 * "2 1/2" is 2.5 and "-1 3/4" is −1.75 (the sign is the whole number's). "13/4" stays 3.25. Any other space is
 * dropped ("- 3" is −3). A comma is the decimal comma ("2,5" is 2.5); "2,000" has a second reading, see readNumCandidates.
 */
export function parseNum(s) {
  const raw = String(s ?? '').trim().replace(DASHES, '-');
  const mixed = raw.match(MIXED);
  if (mixed) {
    const d = Number(mixed[4]);
    if (d === 0) return null;
    const v = Number(mixed[2]) + Number(mixed[3]) / d;
    return mixed[1] === '-' ? -v : v;
  }
  const t = raw.replace(/\s+/g, '').replace(',', '.');
  if (!t) return null;
  let m = t.match(/^([+-]?\d+)\/([+-]?\d+)$/);
  if (m) { const d = Number(m[2]); return d === 0 ? null : Number(m[1]) / d; }
  m = t.match(/^[+-]?(\d+\.?\d*|\.\d+)$/);
  return m ? Number(t) : null;
}

/** "2,000" or "-1,250,000": groups of three digits after each comma, which an Israeli reader reads as thousands. */
const THOUSANDS = /^[+-]?\d{1,3}(,\d{3})+$/;

/**
 * Every number a typed answer can mean, the app's usual reading first. "2,000" has two: the decimal comma the app
 * already accepts (2), and Israeli thousands (2000). Anything else has one reading (parseNum's), or none (an empty
 * list). readAnswer (content/index.js) keeps the reading the question accepts.
 */
export function readNumCandidates(s) {
  const raw = String(s ?? '').trim().replace(DASHES, '-');
  const one = parseNum(raw);
  if (!THOUSANDS.test(raw)) return one == null ? [] : [one];
  return [...new Set([one, Number(raw.replace(/,/g, ''))].filter((v) => v != null))];
}

export const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;

/** At most three decimal places: 0.125, 2.5, 7 (and not 7/12 = 0.5833…, not 1/36). */
export const shortDec = (x) => Math.abs(Math.round(x * 1000) - x * 1000) < 1e-6;

/**
 * Is a typed number right for an answer? The one rule for every typed number: isCorrect, and the last step of
 * "solve together". By default within ±0.01, as always. An item marked `precise` (the fractions, percent and ratio
 * stairs) is compared exactly: the exact value is right, and when the answer has no short decimal (7/12, 1/36) a
 * decimal of at most three places within half a hundredth is right too (0.58 or 0.583 for 7/12, never 0.59). So 1/35
 * is wrong for 1/36, and 0.12 and 0.13 are wrong for 0.125.
 */
export function numRight(u, a, precise = false) {
  if (typeof u !== 'number' || !Number.isFinite(u) || typeof a !== 'number') return false;
  if (!precise) return near(u, a, 0.01);
  return near(u, a, 1e-6) || (!shortDec(a) && shortDec(u) && Math.abs(u - a) < 0.005 + 1e-9);
}

/** Example fractions for the format note, in order of preference: never the question's own answer or its negative. */
const NOTE_EXAMPLES = ['7/12', '5/9', '-4/3'];
/** How to write an answer that has no short decimal, with an example fraction. */
export const fractionHint = (example = NOTE_EXAMPLES[0]) => `אפשר לכתוב כשבר (למשל $${example}$) או כמספר עשרוני מעוגל לשתי ספרות אחרי הנקודה.`;
const HINT_START = 'אפשר לכתוב כשבר';

/**
 * A question whose answer has no short decimal (7/12, 1/36) says once how to write it (CURRICULUM-2 item 6): the item
 * comes back with the sentence after its text. An item that already says it, or whose answer is whole or a short
 * decimal, comes back as it is. The example is never the answer itself.
 */
export function withFormatNote(it) {
  if (typeof it?.answer !== 'number' || shortDec(it.answer) || String(it.text || '').includes(HINT_START)) return it;
  const example = NOTE_EXAMPLES.find((e) => !near(Math.abs(parseNum(e)), Math.abs(it.answer), 1e-9));
  return { ...it, text: `${it.text ? `${it.text} ` : ''}${fractionHint(example)}` };
}

// ---------------------------------------------------------------- answers with π (stage 2, MEASURE-1 item 4)
// Two answer forms the Ministry accepts. "With π": the slot is followed by π (`after: '\\pi'`) and the student types the
// number before it, 25 for 25π. "With π ≈ 3.14": the item carries `pk`, the multiple of π, and its `answer` is
// 3.14 · pk rounded to tenths; a student who used the calculator's π is right too.

/** π after an answer slot: the item's `after`, as TeX. */
export const PI_AFTER = '\\pi';
/** Does this item's answer row end with π (□π)? */
export const piRow = (it) => it?.after === PI_AFTER;
/**
 * Is `u` the value of k·π computed with π ≈ 3.14 or with the calculator's π, within half a tenth? The rule for an item
 * with `pk` (isCorrect), for a pk item's diag (compare each misconception's multiple of π the same two ways), and for a
 * decimal typed into a □π row (partialOf).
 */
export function piNear(u, k) {
  if (typeof u !== 'number' || !Number.isFinite(u) || typeof k !== 'number' || !Number.isFinite(k)) return false;
  return Math.abs(u - 3.14 * k) <= 0.05 + 1e-9 || Math.abs(u - Math.PI * k) <= 0.05 + 1e-9;
}
/** k·π with π ≈ 3.14, rounded to tenths: a pk item's `answer`. */
export const piValue = (k) => Math.round(31.4 * k) / 10;

// (a no-break space keeps "שלפני π" on one line: π alone at the start of a line reads as a stray sign)
/** The note after a □π row's first question in a lesson: what to type (the question already says "בעזרת π"). */
export const PI_NOTE = '(כותבים רק את המספר שלפני\u00a0$\\pi$.)';
/** The line shown when the value of the answer is typed into a □π row as a decimal: right, and in another form. */
export const PI_VALUE_LINE = 'נכון בקירוב. כאן כותבים רק את המספר שלפני\u00a0$\\pi$.';

/**
 * A question whose answer row ends with π says what to type there: the item comes back with PI_NOTE after its text.
 * An item with no π row, or one that already says it, comes back as it is. A lesson adds it to its first such question
 * only (lib/lesson.js).
 */
export function withPiNote(it) {
  if (!piRow(it) || String(it.text || '').includes(PI_NOTE)) return it;
  return { ...it, text: `${it.text ? `${it.text} ` : ''}${PI_NOTE}` };
}
/** TeX drawn after a slot, as plain text: \pi is π. */
export const afterPlain = (after) => String(after || '').replace(/\\pi(?![a-zA-Z])/g, 'π').replace(/\\[a-zA-Z]+|[{}$]/g, '').trim();

/**
 * A list of numbers inside a Hebrew sentence, kept in its order: each number is maths ($4$), and the whole list is
 * isolated left to right (U+2066 ... U+2069), so "4, 7, 10" never reads "10, 7, 4". The marks never reach the AI text.
 */
export const listMath = (arr) => `\u2066${arr.map((v) => `$${v}$`).join(', ')}\u2069`;

/**
 * A linear expression kx + c as plain text, the way a student writes it: 5x + 4, x - 3, -x, 7, 0.
 * A coefficient of 1 or -1 has no digit; a constant of 0 is left out; a fractional coefficient is bracketed, (1/2)x.
 * `v` is the letter (x, n, ...).
 */
export function linText({ k, c }, v = 'x') {
  const coef = k === 1 ? '' : k === -1 ? '-' : Number.isInteger(k) ? String(k) : `(${plainNum(k)})`;
  const xs = k === 0 ? '' : `${coef}${v}`;
  if (!xs) return plainNum(c);
  if (c === 0) return xs;
  return `${xs} ${c > 0 ? '+' : '-'} ${plainNum(Math.abs(c))}`;
}

/** Pythagorean triples with small sides, scaled. */
export const TRIPLES = [[3, 4, 5], [6, 8, 10], [5, 12, 13], [9, 12, 15], [8, 15, 17], [12, 16, 20], [7, 24, 25], [20, 21, 29], [15, 20, 25], [10, 24, 26]];

/** When, in words: "מחר" for one day, "בעוד יומיים", "בעוד 3 ימים" (never "בעוד 1 יום"). */
export const inDays = (n) => (n <= 0 ? 'היום' : n === 1 ? 'מחר' : n === 2 ? 'בעוד יומיים' : `בעוד ${n} ימים`);
