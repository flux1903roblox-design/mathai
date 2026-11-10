// Every mistake label an exercise generator can give must describe the answer the student actually gave.
// For each category there is a property, written here from the question's own numbers (read from its key, the
// numbers the student saw), not from the generator's diag(). Every generator is sampled with many wrong answers;
// whenever diag() names a category, the answer must have that property. And a label is only recorded as evidence
// about the student when it is honest: the learning model gets exactly the category the answer shows.
import { describe, it, expect } from 'vitest';
import { TOPICS, makeItem, isCorrect, catLabel } from './index.js';
import { quadOf as quadOfPt } from './manip.js';
import { startLesson, answer } from '@/lib/lesson.js';
import { learnAfterAnswer, emptyLearn } from '@/learn/storeGlue.ts';
import { evaluate, texToExpr, texRelation } from '@/learn/expr.ts';
import { roundsTo, EQ } from './eq.js';
import { EXPR } from './expr.js';
import { SYS } from './sys.js';
import { FRAC } from './frac.js';

const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;
const sgn = (x) => Math.sign(x);
const nums = (key) => key.split(':').slice(1).map(Number);
const sum = (a) => a.reduce((x, y) => x + y, 0);
const sortN = (a) => [...a].sort((x, y) => x - y);
const median = (a) => { const s = sortN(a); const n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const quadIndex = (x, y) => (x > 0 ? (y > 0 ? 0 : 3) : y > 0 ? 1 : 2);
const ptEq = (u, p) => Array.isArray(u) && near(u[0], p[0]) && near(u[1], p[1]);

/**
 * The numbers of a signed-number exercise, read from what is on screen: whole numbers, decimals (-2.5) and fractions,
 * mixed numbers included (\frac{3}{4}, -\frac{3}{4}, -1\frac{1}{4}, in \left( \right) brackets or not).
 */
function signedFacts(it) {
  const d = it.display.replace(/\\left|\\right/g, '').replace(/\\cdot/g, '*').replace(/[()]/g, '').trim();
  const num = (x) => {
    const f = x.match(/^(-?)(\d*)\\frac\{(\d+)\}\{(\d+)\}$/);
    if (f) { const v = Number(f[2] || 0) + Number(f[3]) / Number(f[4]); return f[1] ? -v : v; }
    return /^-?\d+(\.\d+)?$/.test(x) ? Number(x) : x;
  };
  return d.split(/\s+/).map(num);
}
/** The value subtracted in a signed exercise, when it is negative: the "minus-minus" spot. */
function subtractedNegative(it) {
  const p = it.key.split(':')[0];
  const t = signedFacts(it);
  if (p === 'sn1' || p === 'sn1n' || p === 'sn6s') return t[1] === '-' && t[2] < 0 ? t[2] : null; // a - b
  if (p === 'sn4') {
    if (t[3] === '*') return t[1] === '-' && t[2] * t[4] < 0 ? t[2] * t[4] : null; // a - b·c
    return t[3] === '-' && t[4] < 0 ? t[4] : null; // a·b - c
  }
  if (p === 'sn5') { const [a, , b, , c, , d] = t; const q = (b - c) * d; return q < 0 ? q : null; } // a - (b - c)·d
  return null;
}

// ---------------------------------------------------------------- algebra: reading a display back into its parts
/** A TeX expression as a function of its letter: '3(x - 2) + 1' at x = 4 is 7. */
const fnOf = (tex, v = 'x') => (t) => evaluate(texToExpr(tex), { [v]: t, x: t });
/** A linear TeX expression as { k, c }: '5 + 3(n - 1)' in n is { k: 3, c: 2 }. */
const linOf = (tex, v = 'x') => { const f = fnOf(tex, v); return { k: f(1) - f(0), c: f(0) }; };
const linEq = (w, k, c) => !!w && typeof w === 'object' && near(w.k, k) && near(w.c, c);
/** The letter of an expression or an equation (x unless another one is written). */
const letterOf = (tex) => (String(tex).replace(/\\[a-zA-Z]+/g, '').match(/[a-z]/) || ['x'])[0];
/**
 * A sum as a student reads it, term by term, with brackets kept: '3(x + 4) - 2x + 5' gives
 * [{ m: 3, inner: [{ k: 1, v: 'x' }, { k: 4, v: '' }] }, { k: -2, v: 'x' }, { k: 5, v: '' }].
 */
function parseSum(tex) {
  const src = String(tex).replace(/\s+/g, '').replace(/−/g, '-');
  const out = []; let i = 0;
  while (i < src.length) {
    let sign = 1;
    if (src[i] === '+') i += 1; else if (src[i] === '-') { sign = -1; i += 1; }
    let digits = ''; while (i < src.length && /[\d.]/.test(src[i])) { digits += src[i]; i += 1; }
    const n = digits ? Number(digits) : 1;
    if (src[i] === '(') {
      let depth = 0; let j = i;
      for (; j < src.length; j += 1) { if (src[j] === '(') depth += 1; else if (src[j] === ')') { depth -= 1; if (!depth) break; } }
      out.push({ m: sign * n, inner: parseSum(src.slice(i + 1, j)) }); i = j + 1; continue;
    }
    if (/[a-z]/.test(src[i] || '')) { out.push({ k: sign * n, v: src[i] }); i += 1; continue; }
    if (!digits) throw new Error(`parseSum: cannot read ${tex}`);
    out.push({ k: sign * n, v: '' });
  }
  return out;
}
/**
 * A parsed sum as { k, c }, each bracket opened the way `how(i)` says (i counts the brackets):
 *   right    every term multiplied, with its sign
 *   partial  only the first term multiplied, the rest copied as written (3(x + 4) → 3x + 4)
 *   minus    a minus (or a negative number) before the brackets changes only the first sign (-2(x - 3) → -2x - 6)
 */
function openSum(terms, how = () => 'right') {
  let k = 0; let c = 0; let b = 0;
  for (const t of terms) {
    if (!t.inner) { if (t.v) k += t.k; else c += t.k; continue; }
    const mode = how(b); b += 1;
    t.inner.forEach((u, j) => {
      const f = j === 0 || mode === 'right' ? t.m : mode === 'partial' ? 1 : -t.m;
      if (u.v) k += f * u.k; else c += f * u.k;
    });
  }
  return { k, c };
}
const bracketsOf = (terms) => terms.filter((t) => t.inner);
/**
 * Every way to open a sum's brackets with at least one of them opened `bad` (each other one opened right or `bad`),
 * only on brackets where `bad` changes something: partial needs a multiplier other than ±1, minus a negative one.
 */
function openings(terms, bad) {
  const br = bracketsOf(terms);
  const can = br.map((t) => (bad === 'partial' ? Math.abs(t.m) >= 2 : t.m < 0));
  const out = [];
  for (let mask = 1; mask < 1 << br.length; mask += 1) {
    if (br.some((_, i) => (mask >> i) & 1 && !can[i])) continue;
    out.push(openSum(terms, (i) => ((mask >> i) & 1 ? bad : 'right')));
  }
  return out;
}
/** Is u the value v, or v rounded to tenths or hundredths as a student types a fraction (−35/9 as −3.9)? */
const fits = (u, v) => typeof u === 'number' && Number.isFinite(v) && (near(u, v, 1e-6) || roundsTo(u, v));
/** The solution of an equation whose two sides are { k, c }. */
const solveLin = (L, R) => (near(L.k, R.k) ? NaN : (R.c - L.c) / (L.k - R.k));
/** The two sides of an equation display, as { k, c } (a fraction or a division is read as it evaluates). */
function sidesOf(display) {
  const [l, r] = display.split('=');
  const side = (t) => (/\\frac|:|\\dfrac/.test(t) ? linOf(t, letterOf(display)) : openSum(parseSum(t)));
  return [side(l), side(r)];
}
/** Does u solve the equation with its brackets opened `bad` in some way? */
function solvesOpened(display, u, bad) {
  const [l, r] = display.split('=').map(parseSum);
  const ls = [openSum(l), ...openings(l, bad)]; const rs = [openSum(r), ...openings(r, bad)];
  return ls.some((L, i) => rs.some((R, j) => (i || j) && fits(u, solveLin(L, R))));
}
/** \frac{x + b}{a} = c, read into its numbers; null for any other display. */
function fracSum(display) {
  const m = display.match(/^\\frac\{x ([+-]) (\d+)\}\{(\d+)\} = (-?\d+)$/);
  return m ? { b: (m[1] === '-' ? -1 : 1) * Number(m[2]), a: Number(m[3]), c: Number(m[4]) } : null;
}
/** One side holds x, the other only a number: [{ k, c } of the x side, the number]. */
function xSide(display) {
  const [L, R] = sidesOf(display);
  if (near(R.k, 0)) return [L, R.c];
  if (near(L.k, 0)) return [R, L.c];
  return null;
}
/** The choice a student picked, as maths. */
const chosen = (it, u) => it.choices[u]?.tex || '';
/** An mc choice that is an expression, as { k, c } in its letter. */
const chosenLin = (it, u) => { const t = chosen(it, u); return t ? linOf(t, letterOf(t)) : null; };
/** A property of an expression answer, for a typed answer ({ k, c }) and for a chosen expression alike. */
const asLin = (f) => (it, u) => f(it, it.form === 'mc' ? chosenLin(it, u) : u);
/** The terms of an expression item, read from what the student saw. */
function exprTerms(it) {
  if (it.key.startsWith('ex3t:')) { const [px, nx, p1, n1] = nums(it.key); return [{ k: px, v: 'x' }, { k: -nx, v: 'x' }, { k: p1, v: '' }, { k: -n1, v: '' }]; }
  if (it.key.startsWith('ex4a:')) { const [a, b] = nums(it.key); return [{ m: a, inner: [{ k: 1, v: 'x' }, { k: b, v: '' }] }]; }
  return parseSum(it.display);
}
/** Some of the negative terms of a sum written as positive. */
function minusDropped(terms) {
  const neg = terms.map((t, i) => [t, i]).filter(([t]) => !t.inner && t.k < 0).map(([, i]) => i);
  const out = [];
  for (let mask = 1; mask < 1 << neg.length; mask += 1) out.push(openSum(terms.map((t, i) => (neg.some((n, j) => n === i && (mask >> j) & 1) ? { ...t, k: -t.k } : t))));
  return out;
}
/** The quantities a story asks about (the unknown and the others built from it), from its key. */
function storyValues(it) {
  const [p, ...r] = it.key.split(':'); const n = r.map(Number);
  switch (p) {
    case 'eq5s': { const [k, g] = n; const x = (2 * g) / (k - 1); return [x, k * x, (k + 1) * x]; }
    case 'eq5a': { const [k, t, b] = n; const y = t + b; return [y, y + (k - 1) * t]; }
    case 'eq5w': { const [k, x] = n; return [x, k * x]; }
    case 'eq5t': { const [d] = n; const x = (90 - d) / 2; return [x, x + d]; }
    case 'eq5b': { const [n1, n2, pp] = n; const x = (n2 * pp) / (n1 - n2); return [x, x + pp]; }
    case 'eq5c': { const [S] = n; const x = (S - 3) / 3; return [x, x + 1, x + 2]; }
    case 'sy1t': { const [, pp, x] = n; const cheap = r[0] === 'true'; return [x, (x * (100 + (cheap ? -pp : pp))) / 100]; }
    case 'sy1h': { const [pp, A] = n; return [A, A - (2 * A * pp) / 100]; }
    case 'sy4': { const [pp, q, cnt, M] = n.slice(1); const x = (M - q * cnt) / (pp - q); return [x, cnt - x]; }
    case 'sy4s': { const [S, d] = n; return [(S + d) / 2, (S - d) / 2]; }
    case 'sy4l': return [2, 3];
    default: return [];
  }
}
/** The two equations of a system display (\begin{cases} … \\ … \end{cases}). */
const rowsOf = (display) => display.replace(/\\begin\{cases\}|\\end\{cases\}/g, '').split('\\\\').map((t) => t.trim());
/** px + qy = r as [p, q, r]. */
function rowOf(t) {
  const { left, right } = texRelation(t);
  const f = (x, y) => evaluate(left, { x, y }) - evaluate(right, { x, y });
  return [f(1, 0) - f(0, 0), f(0, 1) - f(0, 0), -f(0, 0)];
}
const pairOf = (tex) => String(tex).replace(/[()\s]/g, '').split(',').map(Number);
/** An inequality display: its two sides, its relation, and what solving it gives. */
function ineqOf(show) {
  const { left, rel, right } = texRelation(show);
  const f = (x) => evaluate(left, { x }) - evaluate(right, { x });
  const A = f(1) - f(0); const B = -f(0) / A;
  const FL = { '<': '>', '<=': '>=', '>': '<', '>=': '<=' };
  return { rel, A, B, sol: A > 0 ? rel : FL[rel], flip: FL, minus: show.includes('-') };
}
const relHolds = (rel, n, B) => (rel === '<' ? n < B - 1e-9 : rel === '<=' ? n <= B + 1e-9 : rel === '>' ? n > B + 1e-9 : n >= B - 1e-9);
const TOGGLE = { '<': '<=', '<=': '<', '>': '>=', '>=': '>' };
const rayDir = (rel) => (rel[0] === '>' ? 1 : -1);
/** The list of whole numbers of a counting item (sy5c: its first number and what is asked are in the key). */
const countList = (it) => { const lo = Number(it.key.split(':').slice(-2)[0]); return [0, 1, 2, 3, 4, 5].map((i) => lo + i); };
/** What a counting item asks of the numbers that solve: how many, or their sum. */
const tallyOf = (it, yes) => (it.key.endsWith(':sum') ? yes.reduce((a, b) => a + b, 0) : yes.length);
/** The solution of a linear equation in TeX. */
function solveTex(t) {
  const { left, right } = texRelation(t); const v = letterOf(t);
  const f = (x) => evaluate(left, { [v]: x, x }) - evaluate(right, { [v]: x, x });
  return -f(0) / (f(1) - f(0));
}
/** The numbers of a substitution item: f, a, b and the x put in (ex1, ex1t), or a and x (ex1m). */
function substOf(it) {
  const p = it.key.split(':');
  if (p[0] === 'ex1m') return { f: 2, a: Number(p[1]), b: 0, x: Number(p[2]) };
  return { f: Number(p[1]), a: Number(p[2]), b: Number(p[3]), x: Number(p[p.length - 1]) };
}
const withProd = ({ f, b }, prod) => (f === 1 ? b - prod : b + prod);
/** A substitution's value as the student gave it: typed, or the number of the choice. */
const substVal = (it, u) => (it.form === 'mc' ? Number(chosen(it, u)) : u);
/** From a sentence: the number in it and the relation it states (times, more, less). */
function wordsOf(it) {
  const c = Number(it.text.match(/\$(\d+)\$/)[1]);
  const kind = it.text.includes('פי') ? 'times' : it.text.includes('פחות') ? 'less' : 'more';
  return { c, kind };
}
/** Is the chosen expression this function of its letter (checked at several values)? */
const isFn = (it, u, g) => { const t = chosen(it, u); if (!t) return false; const f = fnOf(t, letterOf(t)); return [1, 2, 5, 12].every((v) => near(f(v), g(v))); };

// ---------------------------------------------------------------- fractions and decimals: read from the key
// frac:1  fr1r:d:L:k  the point A at the k-th of d parts a unit on a line 0..L;  fr1e:p:q:r  p/q = ?/r
// frac:2  fr2b:<list> and fr2p:<A>,<B>  the numbers as shown ('0.6', '0.125', '1/6')
// frac:3  fr3a:a:b:c:d:add|sub  a/b ± c/d  (mixed numbers, decimals and the bar name no mistake)
// frac:4  fr4m:a:b:c:d:mul and fr4v:a:b:c:d:div  a/b · c/d or a/b : c/d;  fr4g:N:x:mul|div  N · x or N : x, larger
//         or smaller than N (a choice)
const shownList = (it) => it.key.split(':')[1].split(',');
const valueOf = (s) => { const [a, b] = s.split('/'); return b === undefined ? Number(a) : Number(a) / Number(b); };
const placesOf = (s) => (s.includes('.') ? s.split('.')[1].length : 0);
const texOfShown = (s) => (s.includes('/') ? `\\frac{${s.split('/')[0]}}{${s.split('/')[1]}}` : s);
/** The listed number an answer stands for: the one typed (exactly or rounded as a student types it), or the one chosen. */
function pickedOf(it, u) {
  const list = shownList(it);
  if (it.form === 'mc') { const t = chosen(it, u); return list.find((s) => texOfShown(s) === t) ?? null; }
  // the number typed exactly first; a rounding only when it is the only listed number that rounds there
  const exact = list.find((s) => near(u, valueOf(s), 1e-9));
  if (exact !== undefined) return exact;
  const rounded = list.filter((s) => fits(u, valueOf(s)));
  return rounded.length === 1 ? rounded[0] : null;
}
/** Not the largest: some other listed number is at least as large (an equal pair has no largest). */
const notLargest = (list, s) => list.some((x) => x !== s && valueOf(x) >= valueOf(s) - 1e-9);
/** The picked decimal has strictly the most (or the fewest) places of the listed decimals, and is not the largest. */
function byPlaces(it, u, most) {
  const list = shownList(it); const s = pickedOf(it, u);
  if (s == null || s.includes('/')) return false;
  const decs = list.filter((x) => !x.includes('/')); const ps = decs.map(placesOf);
  const edge = most ? Math.max(...ps) : Math.min(...ps);
  return placesOf(s) === edge && ps.filter((p) => p === edge).length === 1 && notLargest(list, s);
}
const fracOp = (it) => { const p = it.key.split(':'); return { a: +p[1], b: +p[2], c: +p[3], d: +p[4], op: p[5] }; };
const lcmOf = (x, y) => { let a = x; let b = y; while (b) [a, b] = [b, a % b]; return (x * y) / a; };

/**
 * The property each category names, per topic. (it, u) → does the answer u really show this mistake?
 * A category a stair defines for itself is checked with that stair's meaning (catLabel shows the same).
 */
const PROPS = {
  frac: {
    // the marks counted instead of the gaps: k/(d − 1)
    'count-marks': (it, u) => { const [d, , k] = nums(it.key); return it.key.startsWith('fr1r:') && fits(u, k / (d - 1)); },
    // the line 0..2 taken as one unit: k/(2d)
    'whole-line': (it, u) => { const [d, L, k] = nums(it.key); return it.key.startsWith('fr1r:') && L === 2 && fits(u, k / (2 * d)); },
    // p/q = ?/r answered with the same number added to the numerator as to the denominator
    'add-same': (it, u) => { const [p, q, r] = nums(it.key); return it.key.startsWith('fr1e:') && near(u, p + (r - q)); },
    'longer-larger': (it, u) => byPlaces(it, u, true),
    'shorter-larger': (it, u) => byPlaces(it, u, false),
    // fractions with one numerator: the one with the largest denominator
    'bigger-den': (it, u) => {
      const list = shownList(it); const s = pickedOf(it, u);
      if (s == null || !list.every((x) => x.includes('/'))) return false;
      const [n, d] = s.split('/').map(Number);
      return list.every((x) => Number(x.split('/')[0]) === n) && list.every((x) => Number(x.split('/')[1]) <= d);
    },
    'add-across': (it, u) => { const q = fracOp(it); return q.op === 'add' && fits(u, (q.a + q.c) / (q.b + q.d)); },
    'num-not-scaled': (it, u) => { const q = fracOp(it); return (q.op === 'add' || q.op === 'sub') && fits(u, (q.a + (q.op === 'add' ? q.c : -q.c)) / lcmOf(q.b, q.d)); },
    'keep-den': (it, u) => { const q = fracOp(it); return q.b === q.d && (q.op === 'mul' ? fits(u, (q.a * q.c) / q.b) : q.op === 'div' && fits(u, q.a / q.c / q.b)); },
    'divide-flip': (it, u) => { const q = fracOp(it); return q.op === 'div' && fits(u, (q.c / q.d) / (q.a / q.b)); },
    // N · x or N : x with x smaller than 1, "larger or smaller than N": the product chosen as larger, or the quotient as
    // smaller (multiplying makes bigger, dividing smaller); typed, a product where a quotient was asked
    'mult-bigger': (it, u) => {
      if (it.key.startsWith('fr4g:')) {
        const [, , x, op] = it.key.split(':'); const larger = /^גדולה/.test(it.choices[u]?.text || '');
        return Number(x) < 1 && (op === 'mul' ? larger : !larger);
      }
      const q = fracOp(it); return q.op === 'div' && it.form !== 'mc' && fits(u, (q.a / q.b) * (q.c / q.d));
    },
  },
  expr: {
    concat: (it, u) => { const q = substOf(it); return q.x >= 1 && q.x <= 9 && near(substVal(it, u), withProd(q, 10 * q.a + q.x)); },
    order: (it, u) => { const q = substOf(it); return q.f < 2 && near(u, (q.f === 0 ? q.b + q.a : q.b - q.a) * q.x); },
    'neg-sub': (it, u) => { const q = substOf(it); return q.x < 0 && near(u, withProd(q, q.a * -q.x)); },
    // n steps of d from the first term instead of n − 1, and the step times n with the start forgotten
    'start-n': (it, u) => {
      const [s, d] = nums(it.key);
      if (it.key.startsWith('ex2n:')) { const n = nums(it.key)[2]; return near(u, s + d * n); }
      if (it.form === 'mc') return isFn(it, u, (n) => s + d * n);
      return linEq(u, d, s);
    },
    'diff-only': (it, u) => {
      const [s, d] = nums(it.key);
      if (it.key.startsWith('ex2n:')) { const n = nums(it.key)[2]; return near(u, d * n) && s !== 0; }
      if (it.form === 'mc') return isFn(it, u, (n) => d * n);
      return linEq(u, d, 0);
    },
    // a multiple of an earlier term taken as the term: the n-th as (n/m) times the m-th (the 20th as twice the 10th)
    'whole-object': (it, u) => {
      if (!it.key.startsWith('ex2n:')) return false;
      const [s, d, n] = nums(it.key);
      return [1, 2, 3].some((m) => n % m === 0 && near(u, (n / m) * (s + d * (m - 1))));
    },
    // "פי" read as "more by", or "more by" read as "פי"
    'times-plus': (it, u) => { const { c, kind } = wordsOf(it); return kind !== 'less' && isFn(it, u, (v) => (kind === 'times' ? v + c : c * v)); },
    // the relation written the other way round: the one with more gets less
    reversal: (it, u) => {
      const { c, kind } = wordsOf(it);
      if (kind === 'times') return isFn(it, u, (v) => v / c);
      if (kind === 'more') return isFn(it, u, (v) => v - c);
      return isFn(it, u, (v) => c - v) || isFn(it, u, (v) => v + c);
    },
    // unlike terms joined into one x-term
    conjoin: asLin((it, w) => { const { k, c } = openSum(exprTerms(it)); return !!w && c !== 0 && linEq(w, k + c, 0); }),
    'drop-minus': asLin((it, w) => minusDropped(exprTerms(it)).some(({ k, c }) => linEq(w, k, c))),
    // a negative x-term's minus carried on to the next x-term (9 − 3x + 2x → 9 − 5x)
    detach: asLin((it, w) => {
      const terms = exprTerms(it); const { k, c } = openSum(terms); const xs = terms.filter((t) => !t.inner && t.v).map((t) => t.k);
      return xs.some((a, i) => a < 0 && xs[i + 1] > 0 && linEq(w, k - 2 * xs[i + 1], c));
    }),
    'partial-dist': (it, u) => {
      if (it.key.startsWith('ex4m:')) { const [a, n] = nums(it.key); return near(u, 100 * a + (n - 100)); }
      return asLin((x, w) => openings(exprTerms(x), 'partial').some(({ k, c }) => linEq(w, k, c)))(it, u);
    },
    'minus-bracket': asLin((it, w) => openings(exprTerms(it), 'minus').some(({ k, c }) => linEq(w, k, c))),
  },
  eq: {
    // a number moved to the other side with the same operation: a constant keeps its sign, or the coefficient
    // multiplies where it should divide (x : 4 = 3 → 3/4); \frac{x + b}{a} = c: the division moved over as a division
    'move-no-flip': (it, u) => {
      if (it.key.startsWith('eq2s:')) { const [, f, r, P] = nums(it.key); return fits(u, (P + f) / r); }
      const fs = fracSum(it.display);
      if (fs) return fits(u, fs.c / fs.a - fs.b);
      const [L, R] = sidesOf(it.display);
      const vals = [(R.c + L.c) / (L.k - R.k), -(L.c + R.c) / (L.k - R.k)];
      const xs = xSide(it.display); if (xs) vals.push((xs[1] - xs[0].c) * xs[0].k);
      return vals.some((v) => fits(u, v));
    },
    // the x-term moved to the other side keeping its sign
    'move-x-no-flip': (it, u) => { const [L, R] = sidesOf(it.display); return fits(u, (R.c - L.c) / (L.k + R.k)) || fits(u, (L.c - R.c) / (L.k + R.k)); },
    // the larger divided by the smaller: 12x = 3 gives 4
    'divide-flip': (it, u) => { const xs = xSide(it.display); return !!xs && Math.abs(xs[0].k) > Math.abs(xs[1] - xs[0].c) && fits(u, xs[0].k / (xs[1] - xs[0].c)); },
    // the coefficient subtracted instead of divided by
    'sub-coef': (it, u) => { const xs = xSide(it.display); return !!xs && fits(u, xs[1] - xs[0].c - xs[0].k); },
    // only some terms divided by the coefficient: 2x + 4 = 10 → x + 4 = 5; (x + 1)/3 = 7 read as x/3 + 1 = 7
    'divide-part': (it, u) => {
      const fs = fracSum(it.display);
      if (fs) return fits(u, fs.a * (fs.c - fs.b));
      const xs = xSide(it.display); return !!xs && fits(u, xs[1] / xs[0].k - xs[0].c);
    },
    // the opposite of the solution, where a minus could be lost: a negative coefficient, or the missing number
    sign: (it, u) => {
      if (it.key.startsWith('eq1m:')) return near(u, -nums(it.key)[3]);
      const xs = xSide(it.display); return !!xs && xs[0].k < 0 && near(u, -it.answer);
    },
    'partial-dist': (it, u) => {
      // ages: x + g − b = k(x − b) opened as kx − b, then what was asked (the older one is g more)
      if (it.key.startsWith('eq5a:')) { const [k, t, b, q] = nums(it.key); const g = (k - 1) * t; return fits(u, solveLin({ k: 1, c: g - b }, { k, c: -b }) + (q ? g : 0)); }
      // balls: n1·x = n2(x + p) opened as n2·x + p, then what was asked (the dearer ball is p more)
      if (it.key.startsWith('eq5b:')) { const [n1, n2, p, q] = nums(it.key); return fits(u, p / (n1 - n2) + (q ? p : 0)); }
      if (it.form === 'mc') {
        // the right equation (in the key) with a bracket opened on its first term only
        const right = it.key.slice('eq5p:'.length); const [l, r] = right.split('=').map(parseSum); const t = chosen(it, u);
        const [cl, cr] = t.split('=').map((x) => openSum(parseSum(x)));
        return [...openings(l, 'partial').map((L) => [L, openSum(r)]), ...openings(r, 'partial').map((R) => [openSum(l), R])]
          .some(([L, R]) => linEq(cl, L.k, L.c) && linEq(cr, R.k, R.c));
      }
      return solvesOpened(it.display, u, 'partial');
    },
    'minus-bracket': (it, u) => solvesOpened(it.display, u, 'minus'),
    // a quantity of the story, but not the one asked
    'wrong-unknown': (it, u) => storyValues(it).some((v) => near(u, v)) && !near(u, it.answer),
    // "k times" given to the smaller group: k·x written x/k, or k(…) moved to the other side
    reversal: (it, u) => {
      const right = it.key.slice('eq5p:'.length); const t = chosen(it, u);
      const k = (it.text.match(/פי \$(\d+)\$/) || [])[1];
      if (!k) return false;
      const flipped = right.replace(new RegExp(`(^|[^\\d])${k}x`), `$1\\dfrac{x}{${k}}`);
      const m = right.match(/^(.*) = (\d+)\((.*)\)$/);
      return t === flipped || (!!m && t === `${m[2]}(${m[1]}) = ${m[3]}`);
    },
  },
  sys: {
    // the percent taken of the new price
    'pct-of-new': (it, u) => {
      const [, p, x] = nums(it.key); const up = it.key.split(':')[1] === 'true';
      const N = (x * (100 + (up ? p : -p))) / 100; const back = (N * (100 + (up ? -p : p))) / 100;
      return it.form === 'mc' ? near(solveTex(chosen(it, u)), back, 1e-6) : fits(u, back);
    },
    'wrong-unknown': (it, u) => storyValues(it).some((v) => near(u, v)) && !near(u, it.answer),
    // an explicit expression put into k(…) with only its first term multiplied
    'partial-dist': (it, u) => {
      // px + q(n − x) = M opened as px + qn − x, then what was asked
      if (it.key.startsWith('sy4:')) { const [p, q, n, M, ask] = nums(it.key).slice(1); const x = (M - q * n) / (p - 1); return fits(u, ask ? n - x : x); }
      const rows = rowsOf(it.display); const ei = rows.findIndex((t) => /^[xy] = /.test(t) && !t.slice(4).includes(t[0]));
      const [v, w] = rows[ei][0] === 'y' ? ['y', 'x'] : ['x', 'y'];
      const e = linOf(rows[ei].slice(4), w); const [p, q, r] = rowOf(rows[1 - ei]);
      const [kv, kw] = v === 'y' ? [q, p] : [p, q]; // the coefficient the expression goes into, and the other one
      const first = (r - e.c) / (kw + kv * e.k); // kv(e.k·w + e.c) opened as kv·e.k·w + e.c
      const i = w === 'x' ? 0 : 1;
      return Array.isArray(u) && Math.abs(kv) >= 2 && fits(u[i], first);
    },
    // one unknown found, the other left at 0 or copied from the first
    'forgot-y': (it, u) => Array.isArray(u) && [0, 1].some((i) => near(u[i], it.answer[i]) && !near(u[1 - i], it.answer[1 - i]) && (near(u[1 - i], 0) || near(u[1 - i], u[i]))),
    swap: (it, u) => {
      const a = it.form === 'mc' ? pairOf(chosen(it, it.answer)) : it.answer; const g = it.form === 'mc' ? pairOf(chosen(it, u)) : u;
      return Array.isArray(g) && a[0] !== a[1] && near(g[0], a[1]) && near(g[1], a[0]);
    },
    // subtracting one equation from the other with their constants added: the unknown left comes out as their sum
    'minus-bracket': (it, u) => {
      const [r1, r2] = rowsOf(it.display).map(rowOf);
      return [0, 1].some((g) => {
        const mu = r2[g] / r1[g]; if (!(mu > 0)) return false; // equal signs: the equations are subtracted
        const s = 1 - g; const coef = mu * r1[s] - r2[s]; const kv = (mu * r1[2] + r2[2]) / coef;
        return Array.isArray(u) && [kv, -kv].some((v) => fits(u[s], v));
      });
    },
    // the direction kept after dividing by a negative number
    'no-flip': (it, u) => ineqProp(it, u, (q) => q.A < 0, (q) => q.rel),
    // the direction reversed although the division is by a positive number (a minus elsewhere)
    'over-flip': (it, u) => ineqProp(it, u, (q) => q.A > 0 && q.minus, (q) => q.flip[q.rel]),
    // < and ≤ confused: the boundary itself taken or left
    boundary: (it, u) => {
      if (it.key.startsWith('sy5b:')) {
        const right = it.key.slice('sy5b:'.length); const t = chosen(it, u);
        return t === right.replace('\\le', '<') || t === right.replace('\\ge', '>');
      }
      if (it.key.startsWith('sy5m:')) { const q = ineqOf(it.display); return near(Number(chosen(it, u)), q.B); }
      return ineqProp(it, u, (q) => Number.isInteger(q.B) || it.form === 'manip', (q) => TOGGLE[q.sol], true);
    },
    // a number moved to the other side keeping its sign: the boundary moves
    'move-no-flip': (it, u) => {
      if (it.key.startsWith('sy5w:')) { const [, w, P, W] = nums(it.key); return u === Math.floor((W + P) / w); }
      const { left, right } = texRelation(it.ineq);
      const f = (x) => evaluate(left, { x }); const g = (x) => evaluate(right, { x });
      const L = { k: f(1) - f(0), c: f(0) }; const R = { k: g(1) - g(0), c: g(0) };
      const moved = [(R.c + L.c) / (L.k - R.k), -(L.c + R.c) / (L.k - R.k)];
      return !!u && moved.some((v) => near(u.at, v)) && u.dir === it.answer.dir && !!u.closed === !!it.answer.closed;
    },
  },
  signed: {
    // a fraction's prediction may be typed rounded, as diagOf reads it (-2.25 as -2.2): fits is near for whole numbers
    sign: (it, u) => it.answer !== 0 && fits(u, -it.answer),
    direction: (it, u) => it.manip?.kind === 'numberline' && u - it.manip.from === -(it.answer - it.manip.from),
    'minus-minus': (it, u) => { const q = subtractedNegative(it); return q != null && fits(u, it.answer - 2 * Math.abs(q)); },
    // whole numbers: the distances added, with the first number's sign; signed:6 (sn6a, decimals): with the sign of
    // the one farther from zero, as the plan's model predicts (-2.5 + 1.2 as -3.7)
    'abs-add': (it, u) => {
      const [a, op, b] = signedFacts(it); const bb = op === '-' ? -b : b;
      if (sgn(a) === sgn(bb)) return false;
      const sign = it.key.startsWith('sn6a:') ? sgn(Math.abs(a) > Math.abs(bb) ? a : bb) : sgn(a);
      return fits(u, sign * (Math.abs(a) + Math.abs(bb)));
    },
    // between which two whole numbers is v: the pair just to the right of the right one (toward zero)
    'toward-zero': (it, u) => {
      if (!it.key.startsWith('sn6b:') || it.form !== 'mc') return false;
      const v = Number(it.key.split(':')[1]); const [lo, hi] = (chosen(it, u).match(/-?\d+/g) || []).map(Number);
      return v < 0 && lo === Math.ceil(v) && hi === Math.ceil(v) + 1;
    },
    'ignore-sign': (it, u) => Array.isArray(u) && it.answer.some((v, i) => v < 0 && u[i] === -v),
    'neg-compare': (it, u) => { const [a, b] = nums(it.key); return a < 0 && b < 0 && a !== b && u === 2 - it.answer; },
    order: (it, u) => {
      const t = signedFacts(it);
      if (it.key.startsWith('sn4:') && t[3] === '*') return near(u, (t[1] === '+' ? t[0] + t[2] : t[0] - t[2]) * t[4]);
      if (it.key.startsWith('sn5:')) { const [a, , b, , c, , d] = t; return near(u, (a - (b - c)) * d); }
      return false;
    },
  },
  coord: {
    swap: (it, u) => {
      const p = it.key.split(':')[0];
      if (p === 'cp2') { const [x, y] = nums(it.key); return u === quadIndex(y, x) && u !== it.answer; }
      if (p === 'cp2p') return Array.isArray(u) && quadOfPt([u[1], u[0]]) === it.manip.quadrant && quadOfPt(u) !== it.manip.quadrant;
      return it.answer[0] !== it.answer[1] && ptEq(u, [it.answer[1], it.answer[0]]);
    },
    // coord:1 a coordinate's sign; coord:3 (its own meaning) a negative length
    sign: (it, u) => (it.level === 3 ? near(u, -it.answer) : ptEq(u, [-it.answer[0], it.answer[1]]) || ptEq(u, [it.answer[0], -it.answer[1]])),
    'add-coords': (it, u) => { const [x1, y1, x2, y2] = nums(it.key); const [p, q] = y1 === y2 ? [x1, x2] : [y1, y2]; return p * q < 0 && near(u, Math.abs(Math.abs(q) - Math.abs(p))); },
    perimeter: (it, u) => { const [x1, x2, y1, y2] = nums(it.key); return near(u, 2 * ((x2 - x1) + (y2 - y1))); },
    'add-sides': (it, u) => { const [x1, x2, y1, y2] = nums(it.key); return near(u, (x2 - x1) + (y2 - y1)); },
  },
  angles: {
    'equal-not-supp': (it, u) => {
      const p = it.key.split(':')[0]; const [a] = nums(it.key);
      if (p === 'an1t') return u === a; // the measured angle turned to the given size, as if the two were equal
      if (p === 'an2') return it.key.endsWith('false') && near(u, a);
      if (p === 'an4') return it.key.endsWith('cointerior') && near(u, a);
      return near(u, a) && near(it.answer, 180 - a);
    },
    'supp-not-equal': (it, u) => { const [a] = nums(it.key); return near(it.answer, a) && near(u, 180 - a); },
    'wrong-total': (it, u) => { const [a] = nums(it.key); return near(u, 90 - a) || near(u, 360 - a); },
    'sum-360': (it, u) => { const [a, b] = nums(it.key); return near(u, 360 - a - b); },
    'one-angle': (it, u) => { const [a, b] = nums(it.key); return near(u, 180 - a) || near(u, 180 - b); },
    'forgot-half': (it, u) => { const top = Number(it.key.split(':')[2]); return near(u, 180 - top); },
    'interior-not-exterior': (it, u) => { const [, , a, b] = it.key.split(':').map(Number); return near(u, 180 - a - b); },
  },
  line: {
    'forgot-b': (it, u) => {
      if (it.key.startsWith('lf1p:')) { const [m, , x0] = nums(it.key); return ptEq(u, [x0, m * x0]); }
      const [m, b, x] = nums(it.key); return b !== 0 && near(u, m * x);
    },
    'neg-sub': (it, u) => { const [m, b, x] = nums(it.key); return x < 0 && near(u, m * -x + b); },
    'added-m': (it, u) => { const [m, b, x] = nums(it.key); return near(u, m + x + b); },
    'sign-from-b': (it, u) => { const [, , m, b] = it.key.split(':').map(Number); return it.answer !== 2 && m !== 0 && sgn(m) !== sgn(b) && u === (b > 0 ? 0 : 1); },
    'm-b': (it, u) => {
      if (it.key.startsWith('lf2b:')) { const [m, b] = nums(it.key); return u.m === b && u.b === m; }
      const [, kind, m, b] = it.key.split(':'); return near(u, Number(kind === 'm' ? b : m));
    },
    sign: (it, u) => {
      const p = it.key.split(':')[0];
      if (p === 'lf2b') { const [m, b] = nums(it.key); return u.m === -m && u.b === b; }
      if (p === 'lf5') return near(u.m, -it.answer.m);
      if (p === 'lf6') { const [m, b] = nums(it.key); return near(u[0], b / m) && near(u[1], 0) && it.key.endsWith('true'); }
      return near(u, -it.answer);
    },
    inverse: (it, u) => {
      if (it.key.startsWith('lf3:')) { const [, , rise, run] = nums(it.key); return near(u, run / rise); }
      const [x1, y1, x2, y2] = nums(it.key); return near(u, (x2 - x1) / (y2 - y1));
    },
    'mixed-order': (it, u) => { const [x1, y1, x2, y2] = nums(it.key); return near(u, (y1 - y2) / (x2 - x1)) && !near(it.answer, 0); },
    'b-sign': (it, u) => near(u.m, it.answer.m) && near(u.b, -it.answer.b) && it.answer.b !== 0,
    'b-is-y': (it, u) => { const [, x1, y1] = it.key.split(':').slice(1).map(Number); return near(u.m, it.answer.m) && near(u.b, y1) && x1 !== undefined; },
    swap: (it, u) => ptEq(u, [it.answer[1], it.answer[0]]),
    'axes-mixed': (it, u) => { const [m, b] = nums(it.key); const onX = it.key.endsWith('true'); return onX ? ptEq(u, [0, b]) : ptEq(u, [-b / m, 0]); },
    'no-half': (it, u) => near(u, 2 * it.answer),
    'added-sides': (it, u) => { const [m, b] = nums(it.key); return near(u, Math.abs(b) + Math.abs(b / m)); },
    'forgot-y': (it, u) => near(u[0], it.answer[0]) && !near(u[1], it.answer[1]) && (near(u[1], 0) || near(u[1], u[0])),
  },
  pyth: {
    'add-legs': (it, u) => {
      const p = it.key.split(':')[0];
      if (p === 'py1s') return u && u.a + u.b === it.answer.c;
      if (p === 'py4') { const [, , foot, wall] = it.key.split(':'); return it.key.startsWith('py4:L:') && near(u, Number(wall) + Number(foot)); }
      if (p === 'py5') { const [x1, y1, x2, y2] = nums(it.key); return near(u, Math.abs(x2 - x1) + Math.abs(y2 - y1)); }
      const [a, b] = nums(it.key); return near(u, a + b);
    },
    'no-root': (it, u) => {
      if (it.key.startsWith('py5:')) { const [x1, y1, x2, y2] = nums(it.key); return near(u, (x2 - x1) ** 2 + (y2 - y1) ** 2); }
      if (it.key.startsWith('py2:')) { const [a, c] = nums(it.key); return near(u, c * c - a * a); }
      const [a, b] = nums(it.key); return near(u, a * a + b * b);
    },
    'add-not-sub': (it, u) => {
      if (it.key.startsWith('py4:')) { const [, , foot, len] = it.key.split(':').map(Number); return it.key.startsWith('py4:h:') && near(u, Math.hypot(len, foot), 0.06); }
      const [a, c] = nums(it.key); return near(u, Math.hypot(a, c), 0.06);
    },
    'subtract-sides': (it, u) => { const [a, c] = nums(it.key); return near(u, c - a); },
    // four triangles, 'a,b,c;…' in the key: the side written last checked as the hypotenuse
    'wrong-hyp': (it, u) => {
      const sets = it.key.split(':')[1].split(';').map((x) => x.split(',').map(Number));
      const right = (s) => { const [p, q, r] = [...s].sort((x, y) => x - y); return p * p + q * q === r * r; };
      const lastRight = (s) => s[0] * s[0] + s[1] * s[1] === s[2] * s[2];
      if (it.key.startsWith('py3w:')) return u === 4 && sets.some(right) && !sets.some(lastRight);
      return u === sets.filter(lastRight).length && u !== it.answer;
    },
    'assume-right': (it, u) => it.key.startsWith('py3n:') && u === 4 && it.answer < 4,
  },
  stats: {
    'mode-max': (it, u) => near(u, Math.max(...nums(it.key.replace(/,/g, ':')))),
    'mode-median': (it, u) => { const l = sortN(nums(it.key.replace(/,/g, ':'))); return near(u, l[Math.floor(l.length / 2)]); },
    'mode-count': (it, u) => { const l = nums(it.key.replace(/,/g, ':')); return near(u, l.filter((v) => v === it.answer).length); },
    unsorted: (it, u) => { const l = nums(it.key.replace(/,/g, ':')); const n = l.length; return near(u, n % 2 ? l[(n - 1) / 2] : (l[n / 2 - 1] + l[n / 2]) / 2); },
    'mean-not-median': (it, u) => {
      if (it.key.startsWith('st2b:')) { const [vals, t] = it.key.split(':').slice(1); return near((sum(vals.split(',').map(Number)) + u) / 5, Number(t)); }
      const l = nums(it.key.replace(/,/g, ':')); return near(u, sum(l) / l.length);
    },
    'median-not-mean': (it, u) => near(u, median(nums(it.key.replace(/,/g, ':')))),
    'no-divide': (it, u) => near(u, sum(nums(it.key.replace(/,/g, ':')))),
    'mean-as-answer': (it, u) => near(u, Number(it.key.split(':').pop())),
    'ignore-freq': (it, u) => { const vals = it.key.split(':')[1].split(',').map(Number); return near(u, sum(vals) / vals.length); },
    'wrong-count': (it, u) => { const [vals, freqs] = it.key.split(':').slice(1).map((x) => x.split(',').map(Number)); return near(u, sum(vals.map((v, i) => v * freqs[i])) / vals.length); },
  },
};

/**
 * An inequality item answered as if it said x rel' B with rel' = wrong(q): the ray drawn that way, the count of the
 * list's numbers that way, or a chosen number that solves it only that way. `when` is the condition under which the
 * mistake can be made at all; `edge`: only the boundary's inclusion changes (the ray keeps its side).
 */
function ineqProp(it, u, when, wrong, edge = false) {
  const show = it.ineq || it.display; const q = ineqOf(show);
  if (!when(q)) return false;
  const rel = wrong(q);
  if (it.form === 'manip') return !!u && near(u.at, q.B) && u.dir === rayDir(rel) && !!u.closed === (rel.length === 2) && (edge || u.dir !== rayDir(q.sol));
  if (it.form === 'mc') { const v = Number(chosen(it, u)); return relHolds(rel, v, q.B) && !relHolds(q.sol, v, q.B); }
  return u === tallyOf(it, countList(it).filter((n) => relHolds(rel, n, q.B)));
}

/** Wrong answers to try, in the shape of the item: wide enough to reach every prediction a diag() makes. */
function candidates(it) {
  const range = (a, b, step = 1) => { const out = []; for (let v = a; v <= b + 1e-9; v += step) out.push(Math.round(v * 100) / 100); return out; };
  if (it.form === 'mc') return it.choices.map((_, i) => i);
  if (it.form === 'pt') { const v = [...range(-14, 14), ...range(-12, 12, 0.5)]; const set = [...new Set(v)]; return set.flatMap((x) => set.filter((y) => Number.isInteger(x) || Number.isInteger(y) || true).map((y) => [x, y])).filter(([x, y]) => Number.isInteger(x) || y === 0); }
  if (it.form === 'line') return range(-6, 6, 0.5).flatMap((m) => range(-14, 14).map((b) => ({ m, b })));
  if (it.form === 'lin') return range(-30, 30).flatMap((k) => range(-100, 100).map((c) => ({ k, c })));
  if (it.form === 'frac') return range(-20, 60).flatMap((n) => range(-6, 60).filter((d) => d !== 0).map((d) => ({ n, d })));
  if (it.form === 'manip') {
    const m = it.manip;
    switch (m.kind) {
      case 'numberline': return range(m.min, m.max);
      case 'angle': return range(5, 175, 5);
      case 'bars': return range(0, m.max);
      case 'plot': return range(-6, 6).flatMap((x) => range(-6, 6).map((y) => [x, y]));
      case 'line': return range(-6, 6).flatMap((mm) => range(-6, 6).map((b) => ({ m: mm, b })));
      case 'squares': return range(1, 12).flatMap((a) => range(1, 12).map((b) => ({ a, b })));
      case 'triangle': return range(-6, 6).flatMap((x) => range(1, 6).map((y) => [x, y]));
      case 'ray': return range(m.min ?? -10, m.max ?? 10).flatMap((at) => [-1, 1].flatMap((dir) => [false, true].map((closed) => ({ at, dir, closed }))));
      case 'pins': { const st = 1 / (m.den || 1); const opts = it.answer.map((v, i) => [v, -v, m.start[i], v + st]); return opts.reduce((acc, o) => acc.flatMap((a) => o.map((x) => [...a, x])), [[]]); }
      case 'fbar': return range(1, m.maxDen || 24).flatMap((den) => range(0, den).map((shaded) => ({ den, shaded })));
      default: return [];
    }
  }
  // numbers: whole numbers far enough for squares and sums, tenths and simple fractions near zero
  const out = new Set([...range(-60, 900), ...range(-30, 30, 0.1), ...range(-12, 12, 0.05), ...range(-100, 1000, 0.5), ...range(-100, 100, 0.1)]);
  for (let q = 3; q <= 7; q += 1) for (let p = -40; p <= 40; p += 1) out.add(p / q);
  // square roots, as a misused theorem gives them (rounded the way the checker reads them)
  for (let n = 1; n <= 2000; n += 1) { out.add(Math.round(Math.sqrt(n) * 100) / 100); out.add(Math.round(Math.sqrt(n) * 10) / 10); }
  return [...out];
}

const ITEMS_PER_LEVEL = 60;

describe('every mistake label describes the answer', () => {
  TOPICS.forEach((t) => {
    t.levels.forEach((L, i) => {
      const level = i + 1;
      it(`${t.id} level ${level}: ${L.title}`, () => {
        for (let k = 0; k < ITEMS_PER_LEVEL; k += 1) {
          const item = makeItem(t.id, level);
          for (const u of candidates(item)) {
            if (isCorrect(item, u)) continue;
            const cat = item.diag(u);
            if (!cat) continue;
            const prop = PROPS[t.id]?.[cat];
            expect(prop, `${t.id}:${level} returns '${cat}', which has no property here`).toBeTruthy();
            expect(prop(item, u), `${t.id}:${level} ${item.key}: answer ${JSON.stringify(u)} labelled '${cat}' (${catLabel(t.id, level, cat)})`).toBe(true);
            // the words shown to the student exist for this stair
            expect(catLabel(t.id, level, cat), `${t.id}:${level} '${cat}' has no words`).toBeTruthy();
          }
        }
      });
    });
  });
});

describe('the algebra and fraction topics name only what a property can check', () => {
  it('every category of expressions, equations, systems and fractions has its property here', () => {
    for (const t of [EXPR, EQ, SYS, FRAC]) for (const cat of Object.keys(t.cats)) expect(PROPS[t.id][cat], `${t.id} '${cat}'`).toBeTypeOf('function');
  });
  it('a number near a prediction is not that mistake unless it is the prediction rounded', () => {
    // x : 2 = 9 moved over as a division gives 4.5: 4.5 is that mistake, 4.45 and 4.55 are not
    const it = find('eq', 1, (x) => x.key === 'eq1:\\frac{x}{2} = 9' || x.key === 'eq1:x : 2 = 9', 400000);
    expect(it.diag(4.5)).toBe('move-no-flip');
    expect(it.diag(4.45)).toBe(null);
    expect(it.diag(4.55)).toBe(null);
  });
});

/** An item of a generator with a given display (searched by sampling). */
function find(topic, level, pred, tries = 20000) {
  for (let i = 0; i < tries; i += 1) { const it = makeItem(topic, level); if (pred(it)) return it; }
  throw new Error('no such item');
}
/** Answer an item inside a practice lesson and return what the learning model recorded. */
function recorded(item, u) {
  const s = { ...startLesson({ kind: 'node', topic: item.topic, level: item.level }), item };
  const { result } = answer(s, u);
  const learn = learnAfterAnswer(emptyLearn(), result.event);
  return { cat: result.cat, miscon: Object.keys(learn.miscon) };
}

describe('the council\'s reproductions', () => {
  it('a wrong-direction move on the number line is a direction mistake, never a sign mistake', () => {
    // −4 − (−6) = 2; moving 6 to the left gives −10: subtracting −6 was moved like subtracting 6
    const a = find('signed', 1, (it) => it.key === 'sn1n:-4 - (-6)');
    expect(recorded(a, -10)).toEqual({ cat: 'minus-minus', miscon: ['signed:1|minus-minus'] });
    // 2 + 4 = 6; moving 4 to the left gives −2: the move went the wrong way; −2 is not −6
    const b = find('signed', 1, (it) => it.key === 'sn1n:2 + 4');
    expect(recorded(b, -2)).toEqual({ cat: 'direction', miscon: ['signed:1|direction'] });
    // 7 + 1 = 8; moved to 6
    const c = find('signed', 1, (it) => it.key === 'sn1n:7 + 1');
    expect(recorded(c, 6)).toEqual({ cat: 'direction', miscon: ['signed:1|direction'] });
    // the real negative of the answer is a sign mistake
    expect(recorded(b, -6)).toEqual({ cat: 'sign', miscon: ['signed:1|sign'] });
  });

  it('subtracting a positive product is never called "minus-minus"', () => {
    // 6 − (2 − 3)·(−3) = 6 − 3 = 3; typing 9 adds the product, but the product is positive
    const it = find('signed', 5, (x) => x.key === 'sn5:6 - (2 - 3) \\cdot (-3)', 200000);
    expect(it.answer).toBe(3);
    const r = recorded(it, 9);
    expect(r.cat).not.toBe('minus-minus');
    expect(r.miscon).not.toContain('signed:5|minus-minus');
  });

  it('a negative product subtracted as if positive is "minus-minus"', () => {
    // 6 − (2 − 3)·3 = 6 − (−3) = 9; typing 3 subtracts 3
    const it = find('signed', 5, (x) => x.key === 'sn5:6 - (2 - 3) \\cdot 3', 200000);
    expect(it.answer).toBe(9);
    expect(recorded(it, 3)).toEqual({ cat: 'minus-minus', miscon: ['signed:5|minus-minus'] });
  });

  it('a negative length is named as a negative length on its own stair', () => {
    expect(catLabel('coord', 3, 'sign')).toBe('יצא אורך שלילי');
    expect(catLabel('coord', 1, 'sign')).toBe('טעות בסימן של אחד השיעורים');
  });
});
