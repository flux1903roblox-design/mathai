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

/**
 * A whole number as the class writes it in a chain of signed numbers: always in brackets with its sign, (+14) and
 * (-9); zero alone, with no sign (CLASSROOM-2: "(−9) + (−4) − (+5) − 0").
 */
export const S = (n) => (n === 0 ? '0' : n > 0 ? `(+${n})` : `(${n})`);

/**
 * An equation line as the class writes it on the board (CLASSROOM-7): the operation done to both sides goes at the end
 * of the line it acts on, after a slash, and the next line is what it gives. `op` is '-3x' or '+5' (added to both
 * sides), ':2' or ':(-3)' (both divided), '\\cdot 2' (both multiplied):
 * opMark('3x + 9 = 4x', '-3x') is '3x + 9 = 4x \\qquad /{-3x}'; ':2' writes '/{:}2' and '\\cdot 2' writes '/{\\cdot}2'.
 * The braces keep KaTeX from spacing the sign or the colon as an operation between two things. `gap` is the space
 * before the mark, two quads; a long line that must fit a phone takes one ('\\quad').
 */
export function opMark(tex, op, gap = '\\qquad') {
  const o = String(op).trim();
  let mark;
  if (o.startsWith(':')) mark = `/{:}${o.slice(1).trim()}`;
  else if (o.startsWith('\\cdot') || o.startsWith('·')) mark = `/{\\cdot}${o.replace(/^(\\cdot|·)/, '').trim()}`;
  else if (/^[+-]./.test(o)) mark = `/{${o[0]}${o.slice(1).trim()}}`;
  else throw new Error(`opMark: "${op}" is not an operation on both sides`);
  return `${tex} ${gap} ${mark}`;
}
/** The operation that takes a term away from both sides: '3x' gives '-3x', '-5' gives '+5' (for opMark). */
export const minusOp = (term) => { const t = String(term); return t.startsWith('-') ? `+${t.slice(1)}` : `-${t}`; };
/** The operation that removes the number b added to the unknown: 5 gives '-5', -5 gives '+5'. */
export const undoOp = (b) => minusOp(T(b));
/** Divide both sides by a: ':4', ':(-3)'. */
export const divOp = (a) => `:${T(a, true)}`;
/** Multiply both sides by a: '\\cdot 3', '\\cdot (-2)'. */
export const mulOp = (a) => `\\cdot ${T(a, true)}`;
/** The equation of a board line without its mark: '3x + 9 = 4x \\qquad /{-3x}' is '3x + 9 = 4x'. */
export const unmark = (tex) => String(tex).replace(/\s*\\qquad\s*\/.*$/, '');
/** A board line ('words: $2x = 8 \\qquad /{:}2$') without the mark of a next step, when no next line follows it. */
export const unmarkLine = (l) => String(l).replace(/\s*\\qquad\s*\/[^$]*(?=\$)/g, '');
/** A "number = x" line turned round, as the class writes it: '$x = 9$ (הפכנו צדדים)'. `value` is TeX. */
export const flipLine = (value, v = 'x') => `$${v} = ${value}$ (הפכנו צדדים)`;

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

/** A space inside a number: between two digits, or beside its point or comma ("1 3", "5 13", "1 .5"). */
const SPLIT = /[\d.,]\s+[\d.,]/;

/**
 * Parse what a student typed: "−3", "-3", "2.5", "2,5", "3/4", "-3/4", and a mixed number (the keypad's space key, or a
 * computer keyboard): "2 1/2" is 2.5 and "-1 3/4" is −1.75 (the sign is the whole number's). "13/4" stays 3.25. A space
 * beside the sign or the fraction bar is dropped ("- 3" is −3, "3 / 4" is 0.75); a space inside a number is not a number
 * yet (null): "1 3" is on its way to 1 3/4, never 13. A comma is the decimal comma ("2,5" is 2.5); "2,000" has a second
 * reading, see readNumCandidates.
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
  if (SPLIT.test(raw)) return null;
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
// (the line a □π row shows for the whole value typed as a decimal, "נכון בקירוב…", is in the lesson and the challenge
// screens, which alone show it: it stays out of the first download)

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

/**
 * A count and its noun as Hebrew says it (PRODUCT2-9): one is written after the noun (חלק אחד, כוס סוכר אחת), a part
 * of one takes the noun in the singular ($0.25$ כוס), and any other count the plural ($3$ חלקים, $1.5$ כוסות).
 * `shown` is the number as TeX (a fraction, a decimal); `oneWord` is אחד or אחת, by the noun.
 */
export const countOf = (n, one, many, { shown = String(n), oneWord = 'אחד' } = {}) => (n === 1 ? `${one} ${oneWord}` : n > 0 && n < 1 ? `$${shown}$ ${one}` : `$${shown}$ ${many}`);

/** When, in words: "מחר" for one day, "בעוד יומיים", "בעוד 3 ימים" (never "בעוד 1 יום"). */
export const inDays = (n) => (n <= 0 ? 'היום' : n === 1 ? 'מחר' : n === 2 ? 'בעוד יומיים' : `בעוד ${n} ימים`);

// ---------------------------------------------------------------- choices whose look tells nothing (PRODUCT2-8)
/**
 * How wide a choice looks on screen: its words, or its TeX with each command one sign (\cdot is one dot), the braces
 * gone and a fraction as wide as its wider part. The source writes a space around + and =, where KaTeX puts one too.
 */
export function choiceWidth(c) {
  if (c.tex == null) return [...String(c.text ?? '')].length;
  return String(c.tex)
    .replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, (_, a, b) => '#'.repeat(Math.max(a.length, b.length)))
    .replace(/\\(?:left|right)\b/g, '').replace(/\\[a-zA-Z]+/g, '#').replace(/\\[,;:! ]/g, ' ').replace(/[{}]/g, '').length;
}
/** Where choice `right` stands by width: 'narrowest', 'widest' or 'between'; null when it ties another at an end. */
export function widthPlace(choices, right) {
  const w = choices.map(choiceWidth); const r = w[right]; const others = w.filter((_, j) => j !== right);
  if (others.every((x) => x > r)) return 'narrowest';
  if (others.every((x) => x < r)) return 'widest';
  return others.some((x) => x < r) && others.some((x) => x > r) ? 'between' : null;
}
/**
 * A place for the right one of n choices: the narrowest one time in n, the widest one time in n, between otherwise.
 * `narrowest: false` when another choice is always the narrowest (y = 5 among lines): that time goes to between.
 */
export function drawPlace(n, rnd = Math.random, { narrowest = true } = {}) {
  const u = rnd() * n;
  return u < 1 ? (narrowest ? 'narrowest' : 'between') : u < 2 ? 'widest' : 'between';
}
const subsetsOf = (xs, k) => (k === 0 ? [[]] : xs.length < k ? [] : [...subsetsOf(xs.slice(1), k - 1).map((s) => [xs[0], ...s]), ...subsetsOf(xs.slice(1), k)]);
const eachForm = (lists) => lists.reduce((acc, l) => acc.flatMap((a) => l.map((f) => [...a, f])), [[]]);
/**
 * Choices that give nothing away by their width (PRODUCT2-8). Each option is one answer and the ways it can be written
 * (`forms`: the same equation or the same words each time) with its other fields (ok, bug); the right one comes first,
 * then the wrong ones always used (`keep` of them), then the others, of which as many are taken as fill `n` choices.
 * Of every way to take and write them that puts the right choice at `place` (drawPlace), no two choices reading the
 * same, one is drawn, and the choices come back shuffled; null when none does (the caller draws new numbers).
 */
export function byWidth(options, place, { n = options.length, keep = 0, rnd = Math.random } = {}) {
  const [right, ...wrong] = options;
  const shown = (c) => String(c.tex ?? c.text).replace(/\s+/g, '');
  const fits = subsetsOf(wrong.slice(keep), n - 1 - keep).flatMap((s) => {
    const set = [right, ...wrong.slice(0, keep), ...s];
    return eachForm(set.map((o) => o.forms)).filter((fs) => widthPlace(fs, 0) === place && new Set(fs.map(shown)).size === fs.length)
      .map((fs) => set.map(({ forms, ...rest }, i) => ({ ...rest, ...fs[i] })));
  });
  if (!fits.length) return null;
  const a = fits[Math.floor(rnd() * fits.length)];
  for (let i = a.length - 1; i > 0; i -= 1) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
