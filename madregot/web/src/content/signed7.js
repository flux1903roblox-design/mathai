// Powers of directed numbers (חזקות של מספרים מכוונים): the seventh stair of the signed-number unit, signed:7
// (the classroom lane, CLASSROOM-5). The programme's 7.6, "חזקות עם מעריך טבעי וסדר פעולות עם חזקות", taught the way
// the class writes it: the factors side by side, (−5)(−5) = +25 = 25; −5² written (−5 · 5) = −25, because the
// exponent belongs to what stands right next to it; the minus in front of a bracket kept as its own step, −(+25).
//
// One source for the exercise generator (content/grade7.js, with Math.random) and the diagnostic model
// (learn/content/signed7.ts, with a seeded source). A question is { f, a, n } and, by form:
//   f 6  aⁿ, a positive base: a in 2..10, n in 2..5, aⁿ ≤ 1000 (no minus in it, so it never reaches a check)
//   f 0  (−a)ⁿ        f 1  −aⁿ        f 2  −(−a)ⁿ, n even only        f 3  −(−aⁿ)
//        a in 2..6, n in 2..4, aⁿ ≤ 125, never a·n = aⁿ (2² would make "a times n" right)
//   f 4  b − c·(−a)ⁿ   a in 2..4, n in 2..3, b in 2..9, c in 2..5 (order of operations with a power)
//   f 5  (−p/q)ⁿ (k 0: p in 1..4, q in 2, 3, 4, 5, 7, 9, 10, p < q, in lowest terms, qⁿ ≤ 100, so the answer is a
//        fraction the app writes exactly) or (−0.d)ⁿ, n 2 or 3, and (−1.d)² (k 1, w 0 or 1: at most three decimal
//        places). (−2/5)³ would print as −0.064 and (−0.2)⁴ would round to 0.002: neither shape is drawn.
// The exercises mix the forms F6 12%, F0 22%, F1 22%, F2 11%, F3 11%, F4 11%, F5 11%: the form is drawn first, then
// a question of that form is redrawn until it is fair (the redraw rule of finish/specs/classroom.md §0.3: no mistake
// predicts the answer or a slip of it, no two mistakes one value, never a number printed in the question; and a
// prediction that is not whole is not typed rounded to the answer or to another prediction). Every number here is
// checked by the lane's verify script (spec_check.mjs, section D3) and by learn/content.test.ts.
import { T, shortDec, twoPlaces } from './util.js';
import { fair, shownIn } from './signedItems.js';
import { roundings, matchesValue } from '@/learn/misconceptions.ts';

const rint = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const same = (x, y) => Math.abs(x - y) < 1e-9;
const r6 = (v) => Math.round(v * 1e6) / 1e6;
const gcd = (x, y) => { let a = Math.abs(x); let b = Math.abs(y); while (b) [a, b] = [b, a % b]; return a || 1; };

/**
 * A question: its form f and exponent n, with a (the base's size) for forms 0-4 and 6, b and c for form 4, and for
 * form 5 k (0 a fraction −p/q, 1 a decimal −(w + d/10)).
 * @typedef {{ f: number, n: number, a?: number, b?: number, c?: number, k?: number, p?: number, q?: number, d?: number, w?: number }} PowQ
 */

/** The form mix of the exercises, as cumulative shares: F6 12%, F0 22%, F1 22%, F2 11%, F3 11%, F4 11%, F5 11%. */
export const POW_MIX = [[6, 0.12], [0, 0.22], [1, 0.22], [2, 0.11], [3, 0.11], [4, 0.11], [5, 0.11]];
/** The base of a question of form 5, as a number: −p/q, or −(w + d/10). */
const base5 = (q) => (q.k === 0 ? -q.p / q.q : -(10 * q.w + q.d) / 10);

/** The value of a question. @param {PowQ} q */
export function powValue(q) {
  const p = q.a ** q.n;
  switch (q.f) {
    case 0: return (-q.a) ** q.n;
    case 1: return -p;
    case 2: return -((-q.a) ** q.n);
    case 3: return p;
    case 4: return q.b - q.c * (-q.a) ** q.n;
    // exactly: (−p)ⁿ / qⁿ, or (−(10w + d))ⁿ / 10ⁿ
    case 5: return q.k === 0 ? (-q.p) ** q.n / q.q ** q.n : r6((-(10 * q.w + q.d)) ** q.n / 10 ** q.n);
    default: return p;
  }
}

/**
 * What each mistake gives (null where it does not apply). learn/content.test.ts and content/labels.test.js recompute
 * every one of them from the question's key.
 * @param {PowQ} q
 * @returns {Record<string, number | null>}
 */
export function powBugs(q) {
  const ans = powValue(q); const odd = q.n % 2 === 1; const p = q.a ** q.n;
  if (q.f === 5) {
    return {
      // a negative base to an odd power taken as positive
      'pow-odd-pos': odd ? -ans : null,
      // the base times the exponent (decimals: −0.3 · 3 = −0.9)
      'pow-times': q.k === 1 ? r6((base5(q) * q.n)) : null,
      // one decimal place too few: (−0.3)³ = −0.27 (not for 1.d, whose square already shows two places)
      'dec-places': q.k === 1 && q.w === 0 ? r6(ans * 10) : null,
      // only the numerator raised to the power: (−3/4)² = 9/4
      'num-only': q.k === 0 ? (-q.p) ** q.n / q.q : null,
    };
  }
  if (q.f === 4) {
    const pw = (-q.a) ** q.n;
    return {
      // left to right: b − c first, then times the power
      order: (q.b - q.c) * pw,
      // the power of a negative base with an odd exponent taken as positive
      'pow-odd-pos': odd ? q.b - q.c * p : null,
      // the base times the exponent: (−3)³ as −9
      'pow-times': q.b - q.c * (-q.a * q.n),
    };
  }
  if (q.f === 6) return { 'pow-times': q.a * q.n };
  return {
    // −aⁿ read as (−a)ⁿ: with an even exponent, aⁿ
    'pow-neg-base': q.f === 1 && !odd ? p : null,
    // (−a)ⁿ with an odd exponent taken as positive
    'pow-odd-pos': q.f === 0 && odd ? p : null,
    // (−a)ⁿ with an even exponent keeping the base's minus: −aⁿ
    'pow-keep-sign': q.f === 0 && !odd ? -p : null,
    // the minus in front of the bracket ignored: −(−a)ⁿ as (−a)ⁿ, −(−aⁿ) as −aⁿ
    'outer-minus': q.f === 2 ? (-q.a) ** q.n : q.f === 3 ? -p : null,
    // the base times the exponent, with the form's own sign: (−5)² as −10, −(−5)² as 10
    'pow-times': q.f <= 1 ? -q.a * q.n : q.a * q.n,
  };
}

// ---------------------------------------------------------------- the question as written

const fracTex = (p, q) => `\\frac{${p}}{${q}}`;
/** A form-5 base as TeX inside its brackets: \left(-\frac{3}{4}\right), (-0.3), (-1.2). */
const base5Tex = (q) => (q.k === 0 ? `\\left(-${fracTex(q.p, q.q)}\\right)` : `(-${q.w}.${q.d})`);
/** The question as TeX: (-5)^{2}, -5^{2}, -(-5)^{2}, -(-5^{2}), 9 - 2 \cdot (-3)^{3}, \left(-\frac{3}{4}\right)^{3}, 2^{5}. */
export function powTex(q) {
  const e = `^{${q.n}}`;
  switch (q.f) {
    case 0: return `(-${q.a})${e}`;
    case 1: return `-${q.a}${e}`;
    case 2: return `-(-${q.a})${e}`;
    case 3: return `-(-${q.a}${e})`;
    case 4: return `${q.b} - ${q.c} \\cdot (-${q.a})${e}`;
    case 5: return `${base5Tex(q)}${e}`;
    default: return `${q.a}${e}`;
  }
}
/** The base of form 5 as it is written in a key: 3/4, 0.3, 1.2. */
const base5Key = (q) => (q.k === 0 ? `${q.p}/${q.q}` : `${q.w}.${q.d}`);
/** The key of a question: sn7:f:a:n, sn7:4:a:n:b:c, sn7:5:3/4:n or sn7:5:0.3:n (labels.test.js reads it back). */
export const powKey = (q) => (q.f === 4 ? `sn7:4:${q.a}:${q.n}:${q.b}:${q.c}` : q.f === 5 ? `sn7:5:${base5Key(q)}:${q.n}` : `sn7:${q.f}:${q.a}:${q.n}`);
/** A key's question back. */
export function powOfKey(key) {
  const [, f, a, n, b, c] = String(key).split(':');
  if (f === '5') {
    if (a.includes('/')) { const [p, qq] = a.split('/').map(Number); return { f: 5, k: 0, p, q: qq, n: Number(n) }; }
    const [w, d] = a.split('.').map(Number); return { f: 5, k: 1, w, d, n: Number(n) };
  }
  return { f: Number(f), a: Number(a), n: Number(n), ...(f === '4' ? { b: Number(b), c: Number(c) } : {}) };
}

// ---------------------------------------------------------------- drawing a question

function powRaw(r, f) {
  if (f === 6) {
    const a = rint(r, 2, 10); const n = rint(r, 2, 5);
    return a ** n > 1000 || a * n === a ** n ? null : { f, a, n };
  }
  if (f === 4) return { f, a: rint(r, 2, 4), n: rint(r, 2, 3), b: rint(r, 2, 9), c: rint(r, 2, 5) };
  if (f === 5) {
    if (r() < 0.5) {
      const p = rint(r, 1, 4); const q = pick(r, [2, 3, 4, 5, 7, 9, 10]); const n = rint(r, 2, 4);
      return p >= q || q ** n > 100 || gcd(p, q) !== 1 ? null : { f, k: 0, p, q, n };
    }
    const d = rint(r, 1, 9); const w = r() < 0.3 ? 1 : 0;
    return { f, k: 1, d, w, n: w ? 2 : rint(r, 2, 3) };
  }
  const a = rint(r, 2, 6); const n = rint(r, 2, 4);
  if (a ** n > 125 || a * n === a ** n || (f === 2 && n % 2)) return null;
  return { f, a, n };
}

/**
 * A prediction that is not whole is typed rounded (to tenths or hundredths, misconceptions.ts roundings): none of
 * those may be the answer, another prediction, or one of its roundings, or one typed number would name two mistakes.
 */
function apart(ans, vals) {
  const sets = vals.map((v) => [v, ...roundings(v)]);
  if (sets.some((s) => s.some((x) => same(x, ans)))) return false;
  return sets.every((s, i) => sets.every((t, j) => j <= i || !s.some((x) => t.some((y) => same(x, y)))));
}

/**
 * A question of form f (or of the exercises' mix when f is not given), redrawn by the rule above.
 * @param {() => number} r
 * @param {number} [f]
 * @returns {PowQ}
 */
export function drawPow(r, f) {
  let x = f;
  if (x == null) { const y = r(); let acc = 0; x = POW_MIX.find(([, w]) => (acc += w) > y)?.[0] ?? 5; }
  for (;;) {
    const q = powRaw(r, x);
    if (!q) continue;
    const ans = powValue(q); const bugs = powBugs(q);
    if (!fair(ans, bugs, shownIn(powTex(q)))) continue;
    if (!apart(ans, Object.values(bugs).filter((v) => v != null))) continue;
    return q;
  }
}

// ---------------------------------------------------------------- words

/** n factors of a TeX number, side by side as the class writes them: (-5)(-5), or 2 \cdot 2 \cdot 2 for a positive base. */
const factors = (t, n, neg) => (neg ? Array(n).fill(`(${t})`).join('') : Array(n).fill(t).join(' \\cdot '));
const signWord = (odd) => (odd ? 'מעריך אי־זוגי: נשאר מינוס אחד, והתוצאה שלילית.' : 'מעריך זוגי: המינוסים מתקזזים בזוגות, והתוצאה חיובית.');
/** A value as the class writes it: −64, and a positive result of negative factors as +25 = 25. */
const plusTex = (v) => (v > 0 ? `+${v} = ${v}` : `${v}`);
/** A fraction or decimal answer as TeX: -\frac{27}{64}, 0.09. */
export function pow5AnswerTex(q, v = powValue(q)) {
  if (q.k === 1) return String(v);
  const num = q.p ** q.n; const den = q.q ** q.n;
  return `${v < 0 ? '-' : ''}${fracTex(num, den)}`;
}
/**
 * A fraction answer as a decimal too, unless the app writes it as a fraction anyway (T gives \frac up to twelfths):
 * exactly when it is a short decimal (4/25 is 0.16), else rounded to two places as the question asks and a student may
 * type it (-27/64 is about -0.42, -8/27 about -0.30: both places, so it never reads as a one-place rounding).
 */
const asDecimal = (v) => { const t = T(v); if (/frac/.test(t)) return ''; return shortDec(v) ? `, כלומר $${r6(v)}$` : `, בערך $${twoPlaces(v)}$`; };

export function powSolution(q) {
  const ans = powValue(q); const odd = q.n % 2 === 1;
  if (q.f === 6) {
    return [`חזקה היא כפל חוזר: $${q.a}^{${q.n}} = ${factors(q.a, q.n, false)}$`, `התשובה: $${ans}$`];
  }
  if (q.f === 0) {
    return [
      `הבסיס הוא $-${q.a}$, בתוך הסוגריים: כופלים אותו בעצמו $${q.n}$ פעמים.`,
      // the factors, then "=" the value on its own line: the whole chain is wider than a phone
      `$(-${q.a})^{${q.n}} = ${factors(`-${q.a}`, q.n, true)}$`,
      `$= ${plusTex(ans)}$`,
      signWord(odd),
      `התשובה: $${ans}$`,
    ];
  }
  if (q.f === 1) {
    return [
      `המעריך שייך רק ל־$${q.a}$, שצמוד אליו. המינוס נשאר בחוץ.`,
      `$-${q.a}^{${q.n}} = (-${factors(q.a, q.n, false)}) = ${ans}$`,
      `התשובה: $${ans}$`,
    ];
  }
  if (q.f === 2) {
    const pw = (-q.a) ** q.n;
    return [
      `קודם החזקה: $(-${q.a})^{${q.n}} = ${factors(`-${q.a}`, q.n, true)}$`,
      `$= +${pw}$`,
      `ואז המינוס שבחוץ, לפני הסוגריים: $-(+${pw}) = ${ans}$`,
      `התשובה: $${ans}$`,
    ];
  }
  if (q.f === 3) {
    return [
      `קודם החזקה, והיא שייכת רק ל־$${q.a}$: $${q.a}^{${q.n}} = ${q.a ** q.n}$, ולכן בתוך הסוגריים $-${q.a ** q.n}$.`,
      `ואז המינוס שבחוץ: $-(-${q.a ** q.n}) = +${ans} = ${ans}$`,
      `התשובה: $${ans}$`,
    ];
  }
  if (q.f === 4) {
    const pw = (-q.a) ** q.n; const prod = q.c * pw;
    return [
      `קודם החזקה: $(-${q.a})^{${q.n}} = ${factors(`-${q.a}`, q.n, true)}$`,
      `$= ${pw}$`,
      `אחר כך הכפל: $${q.c} \\cdot ${T(pw, true)} = ${prod}$`,
      `ובסוף החיסור: $${q.b} - ${T(prod, true)} = ${prod < 0 ? `${q.b} + ${-prod} = ` : ''}${ans}$`,
      `התשובה: $${ans}$`,
    ];
  }
  // form 5
  if (q.k === 0) {
    return [
      `מעלים בחזקה גם את המונה וגם את המכנה: $${powTex(q)} = ${odd ? '-' : ''}\\frac{${q.p}^{${q.n}}}{${q.q}^{${q.n}}} = ${pow5AnswerTex(q)}$`,
      signWord(odd),
      `התשובה: $${pow5AnswerTex(q)}$${asDecimal(ans)}`,
    ];
  }
  const t = `-${q.w}.${q.d}`; const places = q.n;
  return [
    `$${powTex(q)} = ${factors(t, q.n, true)}$`,
    `בלי הסימנים: ${q.n === 2 ? 'שני גורמים' : 'שלושה גורמים'}, ובכל אחד ספרה אחת אחרי הנקודה, ולכן ${places === 2 ? 'שתי ספרות' : 'שלוש ספרות'} אחרי הנקודה: $\\frac{${(10 * q.w + q.d) ** q.n}}{${10 ** q.n}} = ${Math.abs(ans)}$`,
    signWord(odd),
    `התשובה: $${ans}$`,
  ];
}
export const powHint = (q) => {
  if (q.f === 6) return 'חזקה היא כפל חוזר: המעריך אומר כמה פעמים כופלים את הבסיס בעצמו.';
  if (q.f === 4) return 'סדר הפעולות: קודם החזקה, אחר כך הכפל, ובסוף החיסור.';
  if (q.f === 5) return q.k === 0 ? 'מעלים בחזקה גם את המונה וגם את המכנה. הסימן: מעריך זוגי נותן חיובי, אי־זוגי משאיר מינוס.' : 'כופלים בלי הסימנים, וסופרים ספרות אחרי הנקודה בכל הגורמים. אחר כך הסימן: מעריך זוגי נותן חיובי.';
  return 'המעריך שייך למה שצמוד אליו: לסוגריים כולם, או רק למספר. מינוס שלפני הסוגריים בא בסוף.';
};

// ---------------------------------------------------------------- the generator

/**
 * A power of a decimal, (−0.4)³ = −0.064: its value is an exact decimal of at most three places, and the stair teaches
 * to count the places. It is asked as it is (no line about rounding to two places) and only the exact value is right
 * (exactDec, content/util.js numRight): −0.06 is another number (council round 3, math).
 */
export const powExactDec = (q) => q.f === 5 && q.k === 1;

/** signed:7, one question (key powKey): its form from the mix, or f when given (the tests draw each form). */
export function powItem(r, f) {
  const q = drawPow(r, f); const ans = powValue(q); const bugs = powBugs(q);
  const precise = q.f === 5;
  return {
    key: powKey(q), text: 'חשבו:', display: powTex(q), form: 'num', answer: ans,
    ...(precise ? { precise: true } : {}), ...(powExactDec(q) ? { fmt: 'dec', exactDec: true } : {}),
    hint: powHint(q), solution: powSolution(q),
    // a fraction's prediction may be typed rounded (misconceptions.ts matchesValue); a decimal is typed exactly
    diag: (u) => Object.keys(bugs).find((id) => bugs[id] != null && (q.f === 5 && q.k === 0 ? matchesValue(bugs[id], u, ans) : same(bugs[id], u))) || null,
  };
}

/** signed:7, as the seventh level of the signed topic (content/grade7.js). */
export const SIGNED7_LEVEL = { title: 'חזקות של מספרים מכוונים', gen: () => powItem(Math.random) };
