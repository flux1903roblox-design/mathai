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
 */
export function plainNum(x, { decimal = false } = {}) {
  if (Number.isInteger(x)) return String(x);
  if (decimal && Math.abs(Math.round(x * 100) / 100 - x) < 1e-9) return String(Math.round(x * 100) / 100);
  for (let q = 2; q <= 12; q++) {
    const p = Math.round(x * q);
    if (Math.abs(p / q - x) < 1e-9) { const [a, b] = reduce(p, q); return `${a}/${b}`; }
  }
  return String(Math.round(x * 100) / 100);
}

/** Parse what a student typed: "−3", "-3", "2.5", "2,5", "3/4", "-3/4". */
export function parseNum(s) {
  const t = String(s ?? '').trim().replace(/[−–—]/g, '-').replace(/\s+/g, '').replace(',', '.');
  if (!t) return null;
  let m = t.match(/^([+-]?\d+)\/([+-]?\d+)$/);
  if (m) { const d = Number(m[2]); return d === 0 ? null : Number(m[1]) / d; }
  m = t.match(/^[+-]?(\d+\.?\d*|\.\d+)$/);
  return m ? Number(t) : null;
}

export const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;

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
