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

/** The decimal places a number is written with: 0.67 → 2, 0.6667 → 4, 7 → 0 (10 for more than nine). */
export function placesOf(x) {
  for (let p = 0; p <= 9; p += 1) { const v = x * 10 ** p; if (Math.abs(v - Math.round(v)) < 1e-6) return p; }
  return 10;
}

/** x rounded to p decimal places as school rounds: a half goes away from zero (0.125 → 0.13, −1.335 → −1.34). */
export function roundTo(x, p) {
  const k = 10 ** p;
  // the nudge keeps a half that floating point stored a hair below (1.005) a half
  return (Math.sign(x) * Math.round(Math.abs(x) * k + 1e-9)) / k;
}

/** The same number, up to floating point (16/3 typed as a fraction is 16/3). */
const same = (u, a) => Math.abs(u - a) <= 1e-9 * Math.max(1, Math.abs(a));

/**
 * Is a decimal a correct rounding of x at its own number of places, counted as at least `min`? 0.67, 0.667 and
 * 0.6667 are for 2/3; 0.666 and 0.6666 (cut off, not rounded) are not. With min 1, 17 (17.0) is √288 = 16.97…
 * rounded to tenths, and 7 (7.0) is not √50 = 7.07… rounded to tenths.
 */
export function roundsTo(u, x, min) {
  const p = Math.max(min, placesOf(u));
  return p <= 9 && same(u, roundTo(x, p));
}

/**
 * Is a typed number right for an answer? The one rule for every typed number: isCorrect, and the last step of
 * "solve together". By default within ±0.01, as always. An item marked `precise` (the fractions, percent and ratio
 * stairs) is compared exactly: the exact value is right (7/12, 14/24, 5 1/3), and so is a decimal of two or more places
 * that is the exact value correctly rounded at its own number of places: 0.58, 0.583 and 0.5833 for 7/12, 0.67 and
 * 0.6667 for 2/3, 0.13 for 0.125 (a question whose answer has no exact two-place decimal says so, withFormatNote). A
 * decimal cut off instead of rounded (0.666, 0.6666 for 2/3), a wrong rounding (0.59 for 7/12) and one place (0.7)
 * are wrong, and so is 1/35 for 1/36.
 */
export function numRight(u, a, precise = false) {
  if (typeof u !== 'number' || !Number.isFinite(u) || typeof a !== 'number') return false;
  if (!precise) return near(u, a, 0.01);
  return same(u, a) || (placesOf(u) >= 2 && roundsTo(u, a, 2));
}

/**
 * Does a typed answer need to be told how to write it? Yes when it has no exact decimal with at most two places (7/12,
 * −4/3, 1/36, 0.125): it is written as a fraction or rounded to two places, and the question says so (withFormatNote).
 */
export const needsFormat = (a) => typeof a === 'number' && Number.isFinite(a) && Math.abs(Math.round(a * 100) - a * 100) > 1e-6;

/** Example fractions for the format note, in order of preference: never the question's own answer or its negative. */
const NOTE_EXAMPLES = ['7/12', '5/9', '-4/3'];
/** How to write an answer that has no two-place decimal, with an example fraction. */
export const fractionHint = (example = NOTE_EXAMPLES[0]) => `אפשר לכתוב כשבר (למשל $${example}$) או כמספר עשרוני מעוגל לשתי ספרות אחרי הנקודה.`;
/** The format line with its usual example (CURRICULUM-12: one wording everywhere). */
export const FRACTION_HINT = fractionHint();
/** A question that already says how to write its answer: the format line, or the fractions stairs' own "אפשר לכתוב כשבר או כמספר עשרוני". */
const HINT_START = 'אפשר לכתוב כשבר';
/** The format line, whatever its example, with its maths marks or as plain text (itemPlain): what a test looks for. */
export const FORMAT_LINE = /אפשר לכתוב כשבר \(למשל \$?[^$()]+\$?\) או כמספר עשרוני מעוגל לשתי ספרות אחרי הנקודה\./;

/** The format line of a question's text ('' when it has none), and the text without it. */
export const formatLineOf = (text) => String(text ?? '').match(FORMAT_LINE)?.[0] || '';
export const withoutFormatLine = (text) => String(text ?? '').replace(FORMAT_LINE, '').replace(/\s+$/, '');

/**
 * A typed number whose answer has no exact two-place decimal (7/12, −4/3, a slope of −5/6, a mean of 13/3) says once
 * how to write it (CURRICULUM-12): the item comes back with the line after its text. An item that already says it, a
 * rounded length (it carries `exact` and says to round to tenths), a question that asks for a decimal (askDec: a
 * fraction is not read there), and an answer that is whole or has two places or fewer come back as they are. The
 * example is never the answer itself.
 */
export function withFormatNote(it) {
  if (!needsFormat(it?.answer) || it.exact != null || it.askDec || String(it.text || '').includes(HINT_START)) return it;
  const example = NOTE_EXAMPLES.find((e) => !near(Math.abs(parseNum(e)), Math.abs(it.answer), 1e-9));
  return { ...it, text: `${it.text ? `${it.text} ` : ''}${fractionHint(example)}` };
}

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
