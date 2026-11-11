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
import { evaluate, texToExpr, texRelation, holds, seeded } from '@/learn/expr.ts';
import { roundsTo, EQ, rectStory, transferTable, angleEqStory } from './eq.js';
import { EXPR, collectItem, bracketCollect } from './expr.js';
import { SYS } from './sys.js';
import { FRAC } from './frac.js';
import { candidates } from './labels.sample.js';
import { RATIO } from './ratio.js';
import { PCT } from './pct.js';
import { chainItem, regroupItem, absItem, oppItem, nestedItem, zeroOne } from './signedItems.js';
import { powItem } from './signed7.js';
import { straightThree, linearPairDiff, threeLines, crossBisect, parallelTriangle, parallelBisect } from './angleItems.js';

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
 * mixed numbers included (\frac{3}{4}, -\frac{3}{4}, -1\frac{1}{4}, in \left( \right) brackets or not); the class's
 * bracketed numbers with their sign, (+3) and (-8), in chains of five (CLASSROOM-2); absolute value bars as "|"
 * (\lvert -7 \rvert, CLASSROOM-1).
 */
function signedFacts(it) {
  const d = String(it.display || '').replace(/\\left|\\right/g, '').replace(/\\[lr]vert/g, ' | ').replace(/\\cdot/g, '*').replace(/[()[\]]/g, ' ').trim();
  const num = (x) => {
    const f = x.match(/^(-?)(\d*)\\frac\{(\d+)\}\{(\d+)\}$/);
    if (f) { const v = Number(f[2] || 0) + Number(f[3]) / Number(f[4]); return f[1] ? -v : v; }
    return /^[+-]?\d+(\.\d+)?$/.test(x) ? Number(x) : x;
  };
  return d.split(/\s+/).map(num);
}
/** A chain's terms from its key, sn1c:+,+,-,-,+:-8,3,-6,9,-4: the ops and the numbers in brackets the student saw. */
function chainOf(key) {
  const [ops, vals] = key.split(':').slice(1);
  return { o: ops.split(',').map((x) => (x === '-' ? -1 : 1)), v: vals.split(',').map(Number) };
}
/** Each term once the brackets are removed, the right way, and with every −(−n) read as −n. */
const chainRight = (c) => c.o.map((o, i) => o * c.v[i]);
const chainMm = (c) => c.o.map((o, i) => (o < 0 && c.v[i] < 0 ? c.v[i] : o * c.v[i]));
/** A nested-brackets question from its key: sn5n:1:a:b:c:d, sn5n:2:e:a:b:c:d:g, sn5d:e:p:g:h:i (CLASSROOM-4). */
function nestOf(key) {
  const [kind, ...v] = key.split(':'); const n = v.map(Number);
  if (kind === 'sn5d') { const [e, p, g, h, i] = n; return { form: 3, e, p, g, h, i }; }
  if (n[0] === 1) { const [, a, b, c, d] = n; return { form: 1, a, b, c, d }; }
  const [, e, a, b, c, d, g] = n; return { form: 2, e, a, b, c, d, g };
}
/**
 * A power question from its key (CLASSROOM-5): sn7:f:a:n, sn7:4:a:n:b:c, sn7:5:p/q:n (the base −p/q) or sn7:5:w.d:n
 * (the base −w.d). Its value and the base, read back here and not from the generator.
 */
function powOf(key) {
  const [, f, a, n, b, c] = key.split(':');
  const q = { f: Number(f), n: Number(n) };
  if (f === '5') {
    if (a.includes('/')) { const [p, d] = a.split('/').map(Number); return { ...q, frac: true, p, d, base: -p / d }; }
    return { ...q, frac: false, base: -Number(a), places: a.split('.')[1].length };
  }
  return { ...q, a: Number(a), ...(f === '4' ? { b: Number(b), c: Number(c) } : {}) };
}
/** The power's value, from the key: (−a)ⁿ, −aⁿ, −(−a)ⁿ, −(−aⁿ), b − c·(−a)ⁿ, baseⁿ, aⁿ. */
function powVal(q) {
  if (q.f === 5) return q.base ** q.n;
  return [(-q.a) ** q.n, -(q.a ** q.n), -((-q.a) ** q.n), q.a ** q.n, q.b - q.c * (-q.a) ** q.n, 0, q.a ** q.n][q.f];
}
const isPow = (it) => String(it.key).startsWith('sn7:');
/** A line of signed numbers, "-8 - 9 + 3", as its terms [-8, -9, 3]. */
const lineTerms = (tex) => (String(tex).replace(/\s+/g, '').match(/[+-]?\d+/g) || []).map(Number);
/** The regrouped line: the negatives in order, then the positives (no zero in a regroup question). */
const regrouped = (ws) => [...ws.filter((w) => w < 0), ...ws.filter((w) => w > 0)];
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
  // the class's bracketed terms (CLASSROOM-6), (-7x) + (+4) + …: each bracket holds one term with its sign
  if (it.key.startsWith('ex3b:')) return parseSum(it.display).map((t) => (t.inner?.length === 1 && Math.abs(t.m) === 1 ? { k: t.m * t.inner[0].k, v: t.inner[0].v } : t));
  return parseSum(it.display);
}
/** Some of the negative terms of a sum written as positive. */
function minusDropped(terms) {
  const neg = terms.map((t, i) => [t, i]).filter(([t]) => !t.inner && t.k < 0).map(([, i]) => i);
  const out = [];
  for (let mask = 1; mask < 1 << neg.length; mask += 1) out.push(openSum(terms.map((t, i) => (neg.some((n, j) => n === i && (mask >> j) & 1) ? { ...t, k: -t.k } : t))));
  return out;
}
/** A rectangle story (CLASSROOM-8) from its key, eq5r:x:d:q: the sides x and x + d (x and 2x when d is 0), P, and what was asked. */
function rectOf(it) {
  const [x, d, q] = nums(it.key); const other = d ? x + d : 2 * x;
  return { x, d, q, other, P: 2 * (x + other), at: (v) => [v, d ? v + d : 2 * v, v * (d ? v + d : 2 * v)][q] };
}
/** An angles-with-x story from its key, eq5g:n:c1,c2,…:e1,e2,…:q (q −1 asks x): the angles c·x + e, their sum and the other shape's. */
function angOf(it) {
  const [, n, cs, es, q] = it.key.split(':'); const c = cs.split(',').map(Number); const e = es.split(',').map(Number);
  const total = Number(n) === 3 ? 180 : 360; const Cs = sum(c); const Es = sum(e);
  return { c, e, q: Number(q), total, other: total === 180 ? 360 : 180, Cs, Es, x: (total - Es) / Cs, at: (v) => (Number(q) < 0 ? v : c[Number(q)] * v + e[Number(q)]) };
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
    case 'eq5r': { const r = rectOf(it); return [r.x, r.other, r.x * r.other]; }
    case 'eq5x': { const [d, T] = n; const x = (T - d) / 2; return [x, x + d]; }
    case 'eq5y': { const [d, g, k] = n; const x = (d + g + k * g) / (k - 1); return [x, x + d]; }
    case 'eq5g': { const a = angOf(it); return [a.x, ...a.c.map((c, i) => c * a.x + a.e[i])]; }
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
const gcdOf = (x, y) => { let a = Math.abs(x); let b = Math.abs(y); while (b) [a, b] = [b, a % b]; return a || 1; };

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
  // pct:1-5, each property from the numbers the student saw (the key): a, b of pc1f (a/b) and x of pc1d and pc1o; N and p
  // of pc1e (a vote of p% of N); p, N of pc2 and pc2m (p% of N); A, B of pc3 and pc3g (A of B) and c, T of pc3t (c of all
  // T volunteers); p, A of pc4 and pc4d (p% is A); up, p, N of pc5 (one change), p, N of pc5w (up and down), N, M of pc5b
  pct: {
    // the parts, the percent itself, or the part written as the amount
    'count-as-pct': (it, u) => {
      const p = it.key.split(':')[0]; const n = nums(it.key);
      if (p === 'pc1f') return fits(u, n[0]);
      if (p === 'pc1e') return it.choices[u]?.text === `${n[1]} אנשים`;
      if (p === 'pc2' || p === 'pc2m') return fits(u, n[0]);
      if (p === 'pc3' || p === 'pc3g' || p === 'pc3t') return fits(u, n[0]);
      return false;
    },
    // the digits after the point read as the percent: 0.4 as 4, 1.5 as 15
    'digit-pct': (it, u) => {
      const p = it.key.split(':')[0]; const x = it.key.split(':')[1]; const digits = Number(x.replace('.', ''));
      if (p === 'pc1d') return x.includes('.') && fits(u, digits);
      if (p === 'pc1o') return chosen(it, u) === `${digits}\\%`;
      return false;
    },
    // the amount divided by the percent number
    'div-by-pct': (it, u) => { const [p, N] = nums(it.key); return /^pc2m?:/.test(it.key) && fits(u, N / p); },
    // the whole over the part, times 100
    'inverse-ratio': (it, u) => { const [A, B] = nums(it.key); return /^pc3[gt]?:/.test(it.key) && fits(u, (100 * B) / A); },
    // the percent taken of the part given
    'pct-of-part': (it, u) => { const [p, A] = nums(it.key); return /^pc4d?:/.test(it.key) && fits(u, (A * p) / 100); },
    // 1% found and the answer stopped there
    'stop-at-one': (it, u) => { const [p, A] = nums(it.key); return /^pc4d?:/.test(it.key) && fits(u, A / p); },
    // p shekels added or taken off, not p percent
    'add-pct': (it, u) => { const [up, p, N] = nums(it.key); return it.key.startsWith('pc5:') && fits(u, N + (up ? p : -p)); },
    // the size of the change given as the new price
    'change-only': (it, u) => { const [, p, N] = nums(it.key); return it.key.startsWith('pc5:') && fits(u, (p * N) / 100); },
    // a rise and a fall by the same percent taken to cancel: the price before
    'additive-changes': (it, u) => { const [, N] = nums(it.key); return it.key.startsWith('pc5w:') && fits(u, N); },
    // the change as a percent of the new price
    'pct-of-new': (it, u) => { const [N, M] = nums(it.key); return it.key.startsWith('pc5b:') && fits(u, (100 * Math.abs(M - N)) / M); },
  },
  // ratio:1-4, each property from the numbers the student saw (the key): a, b of ra1; m, n, T of ra2s; m, n, P of ra2r;
  // the investments X, Y and the profit P of ra2p; b, a, c of ra3m (b units need a, how much for c); the table rows of
  // ra3t; the scale S and the distance of ra4r (d cm) and ra4m (D m); d cm and D km of ra4f; k of ra4a
  ratio: {
    // the ratio read in the other order: the other term's value
    'reversed-ratio': (it, u) => {
      const p = it.key.split(':')[0]; const n = nums(it.key);
      if (p === 'ra1') { const [a, b] = n; const g = gcdOf(a, b); return fits(u, ((a / g) * a) / b); }
      if (p === 'ra1m') { const [a, b] = n; const g = gcdOf(a, b); return chosen(it, u) === `${a / g} : ${b / g}`; }
      if (p === 'ra2s') { const [m, nn, T] = n; return fits(u, (T * nn) / (m + nn)); }
      if (p === 'ra2r') { const [m, nn, P] = n; return fits(u, ((P / 2) * Math.min(m, nn)) / (m + nn)); }
      if (p === 'ra2p') { const [X, Y, P] = n; return fits(u, (P * Y) / (X + Y)); }
      if (p === 'ra2t') { const [m, nn] = n; return chosen(it, u) === `\\frac{${nn}}{${m + nn}}`; }
      return false;
    },
    // a part compared with the whole: ra1 the total over the common divisor, ra2 m/n of the total
    'part-whole': (it, u) => {
      const p = it.key.split(':')[0]; const n = nums(it.key);
      if (p === 'ra1') { const [a, b] = n; return fits(u, (a + b) / gcdOf(a, b)); }
      if (p === 'ra1m') { const [a, b] = n; const g = gcdOf(a, b); return chosen(it, u) === `${b / g} : ${(a + b) / g}`; }
      if (p === 'ra2s') { const [m, nn, T] = n; return fits(u, (T * m) / nn); }
      if (p === 'ra2p') { const [X, Y, P] = n; return fits(u, (P * X) / Y); }
      if (p === 'ra2t') { const [m, nn] = n; return chosen(it, u) === `\\frac{${m}}{${nn}}`; }
      return false;
    },
    // the whole perimeter shared as if it were one long and one short side: twice the long side
    'whole-perimeter': (it, u) => { const [m, n, P] = nums(it.key); return it.key.startsWith('ra2r:') && fits(u, (P * Math.max(m, n)) / (m + n)); },
    // the same difference kept: a + (c − b); in a table, from one of the given rows
    additive: (it, u) => {
      if (it.key.startsWith('ra3m:')) { const [b, a, c] = nums(it.key); return fits(u, a + (c - b)); }
      if (it.key.startsWith('ra3t:')) {
        const [rows, x3] = [it.key.slice(5).split(';').slice(0, 2).map((r) => r.split(',').map(Number)), Number(it.key.split(';')[2])];
        return rows.some(([x, y]) => fits(u, y + (x3 - x)));
      }
      return false;
    },
    // the rate per the other unit: c divided by a/b
    'divide-flip': (it, u) => { const [b, a, c] = nums(it.key); return it.key.startsWith('ra3m:') && fits(u, (c * b) / a); },
    // centimetres never converted: d·S cm for metres; D/S for centimetres; D km over d cm for the scale
    'no-convert': (it, u) => {
      const p = it.key.split(':')[0]; const n = nums(it.key);
      if (p === 'ra4r') { const [S, d] = n; return fits(u, d * S); }
      if (p === 'ra4m') { const [S, D] = n; return fits(u, D / S); }
      if (p === 'ra4f') { const [d, D] = n; return fits(u, D / d); }
      return false;
    },
    // kilometres written as metres: d·S / 100000
    'cm-km': (it, u) => { const [S, d] = nums(it.key); return it.key.startsWith('ra4r:') && fits(u, (d * S) / 100000); },
    // the area scaled like a length: k
    'linear-area': (it, u) => { const [k] = nums(it.key); return it.key.startsWith('ra4a:') && fits(u, k); },
    // "the same added to both keeps the ratio": the "no" choice, for legs p ≠ q
    'add-same': (it, u) => { const [p, q] = nums(it.key); return it.key.startsWith('ra1a:') && p !== q && /^לא/.test(it.choices[u]?.text || ''); },
  },
  expr: {
    // (a + b)² with a negative sum, squared to a negative number (CLASSROOM-5): ex5s:square:s:m, u = −s²
    'pow-keep-sign': (it, u) => { const [kind, s] = it.key.split(':').slice(1); return kind === 'square' && Number(s) < 0 && near(u, -(Number(s) ** 2)); },
    concat: (it, u) => { const q = substOf(it); return q.x >= 1 && q.x <= 9 && near(substVal(it, u), withProd(q, 10 * q.a + q.x)); },
    order: (it, u) => { const q = substOf(it); return q.f < 2 && near(u, (q.f === 0 ? q.b + q.a : q.b - q.a) * q.x); },
    'neg-sub': (it, u) => { const q = substOf(it); return q.x < 0 && near(substVal(it, u), withProd(q, q.a * -q.x)); },
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
      // "c less": only x + c gives the one with less more; c − x reverses a subtraction's order, and at the hint's
      // number (x = 20) it still gives her less, so it is not this mistake
      return isFn(it, u, (v) => v + c);
    },
    // unlike terms joined into one x-term
    conjoin: asLin((it, w) => { const { k, c } = openSum(exprTerms(it)); return !!w && c !== 0 && linEq(w, k + c, 0); }),
    'drop-minus': asLin((it, w) => minusDropped(exprTerms(it)).some(({ k, c }) => linEq(w, k, c))),
    // a negative x-term's minus carried on to the next x-term (9 − 3x + 2x → 9 − 5x), or, in the class's regrouping
    // choice, to every x-term after it (−11x + 4x + 9x moved as −11x − 4x − 9x, CLASSROOM-6)
    detach: asLin((it, w) => {
      const terms = exprTerms(it); const { k, c } = openSum(terms); const xs = terms.filter((t) => !t.inner && t.v).map((t) => t.k);
      return xs.some((a, i) => a < 0 && xs[i + 1] > 0 && (linEq(w, k - 2 * xs[i + 1], c) || linEq(w, k - 2 * sum(xs.slice(i + 1).filter((p) => p > 0)), c)));
    }),
    // the class's bracketed x-terms (CLASSROOM-6.6): the two coefficients' distances added, with the sign of the larger
    // term when it is negative (when it is positive that is drop-minus); the numbers' sum is right
    'abs-add': asLin((it, w) => {
      if (!it.key.startsWith('ex3b:')) return false;
      const terms = exprTerms(it); const { c } = openSum(terms); const xs = terms.filter((t) => t.v).map((t) => t.k);
      const big = Math.abs(xs[0]) > Math.abs(xs[1]) ? xs[0] : xs[1];
      return xs.length === 2 && sgn(xs[0]) !== sgn(xs[1]) && big < 0 && linEq(w, -(Math.abs(xs[0]) + Math.abs(xs[1])), c);
    }),
    // the x-family's sum with its sign turned, the numbers' sum right
    sign: asLin((it, w) => { if (!it.key.startsWith('ex3b:')) return false; const { k, c } = openSum(exprTerms(it)); return k !== 0 && linEq(w, -k, c); }),
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
      // the transfer, 2x + d = T divided as x + d = T : 2: box B at the start comes out T : 2
      if (it.key.startsWith('eq5x:')) { const [, T] = nums(it.key); return near(u, T / 2); }
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
      // the rectangle: 2(x + d) opened as 2x + d, then what was asked
      if (it.key.startsWith('eq5r:')) { const r = rectOf(it); return r.d > 0 && fits(u, r.at((r.P - r.d) / 4)); }
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
    // CLASSROOM-8. The rectangle's perimeter with two sides only, x + (x + d) = P, then what was asked; in the choice of
    // an equation, the right one halved (x + kx = P for 2(x + kx) = P)
    'two-sides': (it, u) => {
      if (it.key.startsWith('eq5r:')) { const r = rectOf(it); return fits(u, r.at(r.d ? (r.P - r.d) / 2 : r.P / 3)); }
      if (it.form !== 'mc') return false;
      const [rl, rr] = it.key.slice('eq5p:'.length).split('=').map((x) => openSum(parseSum(x)));
      const [cl, cr] = chosen(it, u).split('=').map((x) => openSum(parseSum(x)));
      return linEq(cl, rl.k / 2, rl.c / 2) && linEq(cr, rr.k, rr.c);
    },
    // the area with the two sides added
    'add-sides': (it, u) => { if (!it.key.startsWith('eq5r:')) return false; const r = rectOf(it); return r.q === 2 && near(u, r.x + r.other); },
    // the angles with x summed to the other shape's total (360° for a triangle, 180° for a quadrilateral)
    'wrong-total': (it, u) => { if (!it.key.startsWith('eq5g:')) return false; const a = angOf(it); return fits(u, a.at((a.other - a.Es) / a.Cs)); },
    // a negative constant's minus dropped in the sum of the angles
    'drop-minus': (it, u) => { if (!it.key.startsWith('eq5g:')) return false; const a = angOf(it); return a.e.some((ei) => ei < 0 && fits(u, a.at((a.total - a.Es + 2 * ei) / a.Cs))); },
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
        // the strict choice is the boundary mistake only where it loses a whole n that the right one keeps: a limit
        // no whole n reaches (90 + 30n ≤ 400) is passed by the same n either way
        const loses = Array.from({ length: 201 }, (_, n) => n).some((n) => holds(right, { n }) !== holds(t, { n }));
        return loses && (t === right.replace('\\le', '<') || t === right.replace('\\ge', '>'));
      }
      if (it.key.startsWith('sy5m:')) { const q = ineqOf(it.display); return near(Number(chosen(it, u)), q.B); }
      // the smallest (or largest) whole solution with the boundary's inclusion the other way
      if (it.key.startsWith('sy5g:')) {
        const q = ineqOf(it.display); const B = Math.round(q.B); const rel = TOGGLE[q.sol];
        return near(Number(chosen(it, u)), rel === '>' ? B + 1 : rel === '<' ? B - 1 : B);
      }
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
    'minus-minus': (it, u) => {
      // a chain of five (CLASSROOM-2): every −(−n) of the key read as −n, and only when the chain has one
      if (it.key.startsWith('sn1c:')) { const c = chainOf(it.key); return chainMm(c).some((w, i) => w !== chainRight(c)[i]) && fits(u, chainMm(c).reduce((a, w) => a + w, 0)); }
      // the regrouping choice: the line chosen holds exactly the terms of the brackets removed that wrong way
      if (it.key.startsWith('sn1r:')) { const c = chainOf(it.key); const got = sortN(lineTerms(it.choices[u]?.tex)); return JSON.stringify(got) === JSON.stringify(sortN(chainMm(c))) && JSON.stringify(got) !== JSON.stringify(sortN(chainRight(c))); }
      // brackets inside brackets: the negative inside the outer bracket (c − d, or (c − d)·g) subtracted as if positive
      if (it.key.startsWith('sn5n:')) {
        const q = nestOf(it.key);
        if (q.form === 1) return q.c - q.d < 0 && fits(u, q.a * (q.b + (q.c - q.d)));
        const inner = (q.c - q.d) * q.g; return inner < 0 && fits(u, q.e - q.a * (q.b + inner));
      }
      const q = subtractedNegative(it); return q != null && fits(u, it.answer - 2 * Math.abs(q));
    },
    // a[b − (c − d)] with a < 0: the factor's minus lost, the answer's opposite (CLASSROOM-4)
    'factor-sign': (it, u) => { if (!it.key.startsWith('sn5n:1:')) return false; const q = nestOf(it.key); return q.a < 0 && fits(u, -it.answer); },
    // the minus before the inner brackets turned only their first number: a(b − c − d)
    'minus-bracket': (it, u) => { if (!it.key.startsWith('sn5n:1:')) return false; const q = nestOf(it.key); return fits(u, q.a * (q.b - q.c - q.d)); },
    // the outer brackets ignored: a·b − (c − d); e − a·b − (c − d)·g; e : p + g·(h − i)
    'ignore-brackets': (it, u) => {
      if (it.key.startsWith('sn5d:')) { const q = nestOf(it.key); return fits(u, q.e / q.p + q.g * (q.h - q.i)); }
      if (!it.key.startsWith('sn5n:')) return false;
      const q = nestOf(it.key);
      return q.form === 1 ? fits(u, q.a * q.b - (q.c - q.d)) : fits(u, q.e - q.a * q.b - (q.c - q.d) * q.g);
    },
    // CLASSROOM-5, powers (from the key): −aⁿ with an even exponent read as (−a)ⁿ, so aⁿ
    'pow-neg-base': (it, u) => { if (!isPow(it)) return false; const q = powOf(it.key); return q.f === 1 && q.n % 2 === 0 && fits(u, q.a ** q.n); },
    // a negative base with an odd exponent taken as positive: (−a)ⁿ as aⁿ; b − c·|(−a)ⁿ|; (−p/q)ⁿ or (−0.d)ⁿ as positive
    'pow-odd-pos': (it, u) => {
      if (!isPow(it)) return false; const q = powOf(it.key);
      if (q.n % 2 === 0) return false;
      if (q.f === 0) return fits(u, q.a ** q.n);
      if (q.f === 4) return fits(u, q.b - q.c * q.a ** q.n);
      return q.f === 5 && fits(u, Math.abs(q.base) ** q.n);
    },
    // (−a)ⁿ with an even exponent keeping the base's minus: −aⁿ
    'pow-keep-sign': (it, u) => { if (!isPow(it)) return false; const q = powOf(it.key); return q.f === 0 && q.n % 2 === 0 && fits(u, -(q.a ** q.n)); },
    // the minus in front of the bracket ignored: −(−a)ⁿ as (−a)ⁿ, −(−aⁿ) as −aⁿ
    'outer-minus': (it, u) => { if (!isPow(it)) return false; const q = powOf(it.key); return (q.f === 2 && fits(u, (-q.a) ** q.n)) || (q.f === 3 && fits(u, -(q.a ** q.n))); },
    // the base times the exponent, with the form's sign: (−a)·n, −(a·n), a·n, b − c·(−a·n), (−0.d)·n, a·n
    'pow-times': (it, u) => {
      if (!isPow(it)) return false; const q = powOf(it.key);
      if (q.f === 5) return !q.frac && fits(u, q.base * q.n);
      if (q.f === 4) return fits(u, q.b - q.c * (-q.a * q.n));
      return fits(u, (q.f <= 1 ? -1 : 1) * q.a * q.n);
    },
    // one decimal place too few: (−0.3)³ = −0.027 typed −0.27 (a base under 1 only)
    'dec-places': (it, u) => { if (!isPow(it)) return false; const q = powOf(it.key); return q.f === 5 && !q.frac && Math.abs(q.base) < 1 && fits(u, 10 * powVal(q)); },
    // only the numerator raised: (−p/q)ⁿ as (−p)ⁿ/q
    'num-only': (it, u) => { if (!isPow(it)) return false; const q = powOf(it.key); return q.f === 5 && q.frac && fits(u, (-q.p) ** q.n / q.d); },
    // a : 0 answered 0 or a; 0 : a answered "not defined" (CLASSROOM-3)
    'div-zero': (it, u) => { if (!it.key.startsWith('sn3z:1:')) return false; const a = Number(it.key.split(':')[2]); const c = it.choices[u]; return !!c?.tex && (c.tex === '0' || Number(c.tex) === a); },
    'zero-div': (it, u) => it.key.startsWith('sn3z:0:') && it.choices[u]?.text === 'לא מוגדר',
    // the first number's minus dropped (a chain: the first number in brackets is negative)
    'drop-sign': (it, u) => { if (!it.key.startsWith('sn1c:')) return false; const c = chainOf(it.key); return c.v[0] < 0 && fits(u, it.answer - 2 * c.v[0]); },
    // the regrouped line with one negative number's minus gone, everything else as it should be
    'drop-minus': (it, u) => {
      if (!it.key.startsWith('sn1r:')) return false;
      const right = regrouped(chainRight(chainOf(it.key))); const got = lineTerms(it.choices[u]?.tex);
      if (got.length !== right.length) return false;
      const diff = right.map((w, i) => i).filter((i) => got[i] !== right[i]);
      return diff.length === 1 && right[diff[0]] < 0 && got[diff[0]] === -right[diff[0]];
    },
    // |a| ± |b| with the bars read as brackets: a ± b (CLASSROOM-1)
    'abs-keep-sign': (it, u) => { if (!it.key.startsWith('sn2a:')) return false; const [k, a, b] = nums(it.key); return a < 0 && fits(u, k ? a - b : a + b); },
    // the opposite of a written as a
    'opp-same': (it, u) => { if (!it.key.startsWith('sn2o:')) return false; const [, a] = nums(it.key); return fits(u, a); },
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
      // e − a[b − (c − d)·g] left to right: (e − a)·[…]; e : [p + g(h − i)] inside left to right: e : ((p + g)(h − i))
      if (it.key.startsWith('sn5n:2:')) { const q = nestOf(it.key); return fits(u, (q.e - q.a) * (q.b - (q.c - q.d) * q.g)); }
      if (it.key.startsWith('sn5d:')) { const q = nestOf(it.key); const o = (q.p + q.g) * (q.h - q.i); return o !== 0 && fits(u, q.e / o); }
      // b − c·(−a)ⁿ left to right: (b − c)·(−a)ⁿ (CLASSROOM-5)
      if (it.key.startsWith('sn7:4:')) { const q = powOf(it.key); return fits(u, (q.b - q.c) * (-q.a) ** q.n); }
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
      // CURRICULUM-10: the angle beside the given one (an2b s) or its co-interior angle (an4b s) taken as equal, then halved
      if (p === 'an2b' || p === 'an4b') return it.key.split(':')[2] === 's' && near(u, a / 2);
      return near(u, a) && near(it.answer, 180 - a);
    },
    'supp-not-equal': (it, u) => {
      const p = it.key.split(':')[0]; const [a, b] = nums(it.key);
      // CURRICULUM-10: the opposite angle (an2b v), or the corresponding or alternate one (an4b e), completed to 180°
      // and halved; the alternate angle at the triangle's base completed to 180°, so the top angle comes out a − b (an4t)
      if (p === 'an2b') return it.key.split(':')[2] === 'v' && near(u, (180 - a) / 2);
      if (p === 'an4b') return it.key.split(':')[2] === 'e' && near(u, (180 - a) / 2);
      if (p === 'an4t') return a > b && near(u, a - b);
      return near(it.answer, a) && near(u, 180 - a);
    },
    // CURRICULUM-10: two adjacent angles d apart (an1d:d): the larger found, or the difference taken off and not halved
    'took-larger': (it, u) => { const [d] = nums(it.key); return it.key.startsWith('an1d:') && near(u, (180 + d) / 2); },
    'diff-not-halved': (it, u) => { const [d] = nums(it.key); return it.key.startsWith('an1d:') && near(u, 180 - d); },
    // a bisector (an2b:a:v|s, an4b:g:e|s): the whole angle it halves, the given one (v, e) or 180° minus it (s)
    'no-half': (it, u) => {
      const [p, g, kind] = it.key.split(':');
      return (p === 'an2b' || p === 'an4b') && near(u, kind === 'v' || kind === 'e' ? Number(g) : 180 - Number(g));
    },
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
    'sign-from-b': (it, u) => {
      // which of four functions goes the asked way: one whose b has that sign and whose m has the other
      if (it.key.startsWith('lf2p:')) { const s = it.key.split(':')[1] === 'up' ? 1 : -1; const f = fnOf(chosen(it, u).split('=')[1]); const m = f(1) - f(0); const b = f(0); return m !== 0 && sgn(m) === -s && sgn(b) === s; }
      const [, , m, b] = it.key.split(':').map(Number); return it.answer !== 2 && m !== 0 && sgn(m) !== sgn(b) && u === (b > 0 ? 0 : 1);
    },
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

describe('the algebra, fraction, ratio and percent topics name only what a property can check', () => {
  it('every category of expressions, equations, systems, fractions, ratio and percent has its property here', () => {
    for (const t of [EXPR, EQ, SYS, FRAC, RATIO, PCT]) for (const cat of Object.keys(t.cats)) expect(PROPS[t.id][cat], `${t.id} '${cat}'`).toBeTypeOf('function');
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

// CLASSROOM-1 and -2: the class's chains, absolute value and opposites, 2,000 of each, every label against the key
describe('the class\'s signed questions name only what the answer shows', () => {
  const N = 2000;
  const real = Math.random;
  const props = PROPS.signed;
  /** Every whole answer near the question's numbers, and each prediction: any label must hold, each prediction labelled. */
  const sweep = (it, predicted) => {
    for (let u = -90; u <= 90; u += 1) {
      if (isCorrect(it, u)) continue;
      const cat = it.diag(u);
      if (cat) expect(props[cat](it, u), `${it.key}: ${u} labelled ${cat}`).toBe(true);
    }
    Object.entries(predicted).forEach(([id, v]) => { if (v != null) expect(it.diag(v), `${it.key}: ${v} should be ${id}`).toBe(id); });
  };
  it('reads what the student sees: brackets with a sign, five terms, absolute value bars', () => {
    expect(signedFacts({ display: '(-8) + (+3) - (-6) - (+9) + (-4)' })).toEqual([-8, '+', 3, '-', -6, '-', 9, '+', -4]);
    expect(signedFacts({ display: '(+5) - 0 + (-2) - (+1) - (-7)' })).toEqual([5, '-', 0, '+', -2, '-', 1, '-', -7]);
    expect(signedFacts({ display: '\\lvert -7 \\rvert + \\lvert 4 \\rvert' })).toEqual(['|', -7, '|', '+', '|', 4, '|']);
  });
  it('a chain of five: minus-minus, drop-sign and sign, recomputed from the key', () => {
    let seen = { 'minus-minus': 0, 'drop-sign': 0, sign: 0 };
    try {
      Math.random = seeded(1111);
      for (let i = 0; i < N; i += 1) {
        const it = { ...chainItem(Math.random), topic: 'signed', level: 1 };
        const c = chainOf(it.key);
        // the key is what is on screen
        const t = signedFacts(it);
        expect(t.filter((x, j) => j % 2 === 0), it.key).toEqual(c.v);
        expect(t.filter((x, j) => j % 2 === 1).map((x) => (x === '-' ? -1 : 1)), it.key).toEqual(c.o.slice(1));
        const right = chainRight(c).reduce((a, w) => a + w, 0);
        expect(it.answer).toBe(right);
        const mm = chainMm(c).reduce((a, w) => a + w, 0);
        const pred = { 'minus-minus': mm, 'drop-sign': c.v[0] < 0 ? right - 2 * c.v[0] : null, sign: right ? -right : null };
        Object.entries(pred).forEach(([k, v]) => { if (v != null) seen[k] += 1; });
        sweep(it, pred);
      }
    } finally { Math.random = real; }
    // each one shows on a fair share of chains (spec: 100%, 52%, 97%)
    expect(seen['minus-minus']).toBe(N);
    expect(seen['drop-sign'] / N).toBeGreaterThan(0.4);
    expect(seen.sign / N).toBeGreaterThan(0.9);
  });
  it('the regrouping choice: drop-minus and minus-minus are the lines they claim to be', () => {
    try {
      Math.random = seeded(1112);
      for (let i = 0; i < N; i += 1) {
        const it = regroupItem(Math.random);
        expect(it.practiceOnly).toBe(true);
        expect(it.choices.length).toBe(3);
        expect(lineTerms(it.choices[it.answer].tex)).toEqual(regrouped(chainRight(chainOf(it.key))));
        it.choices.forEach((ch, u) => { if (u === it.answer) return; const cat = it.diag(u); expect(cat).toBeTruthy(); expect(props[cat](it, u), `${it.key}: ${ch.tex} as ${cat}`).toBe(true); });
      }
    } finally { Math.random = real; }
  });
  it('absolute value: abs-keep-sign is u = a + b or a − b, from the key', () => {
    try {
      Math.random = seeded(1113);
      for (let i = 0; i < N; i += 1) {
        const it = { ...absItem(Math.random), topic: 'signed', level: 2 };
        const [k, a, b] = nums(it.key);
        expect(it.answer).toBe(k ? Math.abs(a) - Math.abs(b) : Math.abs(a) + Math.abs(b));
        expect(signedFacts(it).filter((x) => typeof x === 'number')).toEqual([a, b]);
        sweep(it, { 'abs-keep-sign': k ? a - b : a + b });
      }
    } finally { Math.random = real; }
  });
  it('opposites: opp-same is u = a, from the key', () => {
    try {
      Math.random = seeded(1114);
      for (let i = 0; i < N; i += 1) {
        const it = { ...oppItem(Math.random), topic: 'signed', level: 2 };
        const [, a] = nums(it.key);
        expect(it.answer).toBe(-a);
        sweep(it, { 'opp-same': a });
      }
    } finally { Math.random = real; }
  });
});

// CLASSROOM-3 and -4: dividing with 0 and 1, and brackets inside brackets, every label against the key
describe('dividing with 0 and 1, and brackets inside brackets, name only what the answer shows', () => {
  const real = Math.random;
  const props = PROPS.signed;
  it('reads square brackets, plain or \\left[ … \\right], as the numbers in them', () => {
    expect(signedFacts({ display: '-3[12 - (2 - 7)]' })).toEqual([-3, 12, '-', 2, '-', 7]);
    expect(signedFacts({ display: '-3\\left[12 - (2 - 7)\\right]' })).toEqual([-3, 12, '-', 2, '-', 7]);
  });
  it('brackets inside brackets: factor-sign, minus-minus, minus-bracket, ignore-brackets and order from the key', () => {
    const seen = {};
    try {
      Math.random = seeded(1115);
      for (let i = 0; i < 2000; i += 1) {
        const it = { ...nestedItem(Math.random), topic: 'signed', level: 5 };
        // the key is the question: its value is the answer
        const q = nestOf(it.key);
        const v = q.form === 1 ? q.a * (q.b - (q.c - q.d)) : q.form === 2 ? q.e - q.a * (q.b - (q.c - q.d) * q.g) : q.e / (q.p + q.g * (q.h - q.i));
        expect(near(v, it.answer), it.key).toBe(true);
        for (let u = -300; u <= 300; u += 1) {
          if (isCorrect(it, u)) continue;
          const cat = it.diag(u);
          if (cat) { expect(props[cat](it, u), `${it.key}: ${u} labelled ${cat}`).toBe(true); seen[cat] = (seen[cat] || 0) + 1; }
        }
        // factor-sign: a < 0 and the answer's opposite
        if (q.form === 1 && q.a < 0) expect(it.diag(-it.answer), it.key).toBe('factor-sign');
      }
    } finally { Math.random = real; }
    for (const id of ['factor-sign', 'minus-minus', 'minus-bracket', 'ignore-brackets', 'order']) expect(seen[id], id).toBeGreaterThan(50);
  });
  it('dividing with 0: div-zero is 0 or a chosen for a : 0, zero-div is "not defined" chosen for 0 : a', () => {
    try {
      Math.random = seeded(1116);
      for (let i = 0; i < 2000; i += 1) {
        const it = zeroOne(Math.random);
        expect(it.practiceOnly).toBe(true);
        expect(it.choices).toHaveLength(4);
        it.choices.forEach((c, u) => { const cat = it.diag(u); if (u === it.answer) expect(cat).toBeNull(); else if (cat) expect(props[cat](it, u), `${it.key}: ${c.tex || c.text} as ${cat}`).toBe(true); });
        const [, k, a] = it.key.split(':').map(Number);
        const shown = it.choices[it.answer];
        expect(k === 0 ? shown.tex === '0' : k === 1 ? shown.text === 'לא מוגדר' : Number(shown.tex) === (k === 2 ? a : -a), it.key).toBe(true);
      }
    } finally { Math.random = real; }
  });
});

// CLASSROOM-5: powers of directed numbers, every label against the key, 2,000 questions of each form that can show it
describe('powers of directed numbers name only what the answer shows', () => {
  const real = Math.random;
  const props = PROPS.signed;
  /** The mistakes each form can show (the spec's list), and 2,000 questions of it. */
  const FORMS = {
    0: ['pow-odd-pos', 'pow-keep-sign', 'pow-times'], 1: ['pow-neg-base', 'pow-times'], 2: ['outer-minus', 'pow-times'],
    3: ['outer-minus', 'pow-times'], 4: ['order', 'pow-odd-pos', 'pow-times'], 5: ['pow-odd-pos', 'pow-times', 'dec-places', 'num-only'], 6: ['pow-times'],
  };
  it('every form: the key is the question, each label is true of the answer, and each mistake of the form shows', () => {
    try {
      Math.random = seeded(1117);
      for (const [f, ids] of Object.entries(FORMS)) {
        const seen = {};
        for (let i = 0; i < 2000; i += 1) {
          const it = { ...powItem(Math.random, Number(f)), topic: 'signed', level: 7 };
          const q = powOf(it.key);
          expect(q.f, it.key).toBe(Number(f));
          expect(near(powVal(q), it.answer, 1e-9), `${it.key}: ${it.answer}`).toBe(true);
          // every prediction the form names is diagnosed back to its own mistake, and the property holds for it
          for (const id of ids) {
            const v = { 'pow-neg-base': q.f === 1 && q.n % 2 === 0 ? q.a ** q.n : null, 'pow-keep-sign': q.f === 0 && q.n % 2 === 0 ? -(q.a ** q.n) : null }[id];
            if (v != null) expect(it.diag(v), `${it.key}: ${v}`).toBe(id);
          }
          // whole numbers, and the tenths and thousandths a fraction or a decimal mistake gives
          const tries = q.f === 5 ? [...Array.from({ length: 801 }, (_, k) => (k - 400) / 100), ...Array.from({ length: 2001 }, (_, k) => (k - 1000) / 1000)] : Array.from({ length: 1001 }, (_, k) => k - 500);
          for (const u of [...tries, ...(q.f === 5 ? [-it.answer, 10 * it.answer, q.base * q.n, ...(q.frac ? [(-q.p) ** q.n / q.d] : [])] : [])]) {
            if (isCorrect(it, u)) continue;
            const cat = it.diag(u);
            if (!cat) continue;
            expect(ids, `${it.key}: ${u} labelled ${cat}`).toContain(cat);
            expect(props[cat](it, u), `${it.key}: ${u} labelled ${cat}`).toBe(true);
            seen[cat] = (seen[cat] || 0) + 1;
          }
        }
        // each of the form's mistakes is named on more than 4% of its questions (spec: 15-100%)
        for (const id of ids) expect(seen[id] || 0, `F${f} ${id}`).toBeGreaterThan(80);
      }
    } finally { Math.random = real; }
  }, 120_000);
  it('the spec\'s examples: (−5)² kept negative, −5² read as (−5)², the outer minus, (−0.3)³ and (−3/4)²', () => {
    const it = (key, display, answer, extra = {}) => ({ key, display, answer, form: 'num', topic: 'signed', level: 7, ...extra });
    expect(props['pow-keep-sign'](it('sn7:0:5:2', '(-5)^{2}', 25), -25)).toBe(true);
    expect(props['pow-neg-base'](it('sn7:1:5:2', '-5^{2}', -25), 25)).toBe(true);
    expect(props['outer-minus'](it('sn7:2:5:2', '-(-5)^{2}', -25), 25)).toBe(true);
    expect(props['outer-minus'](it('sn7:3:5:2', '-(-5^{2})', 25), -25)).toBe(true);
    expect(props['pow-times'](it('sn7:0:5:2', '(-5)^{2}', 25), -10)).toBe(true);
    expect(props.order(it('sn7:4:3:3:9:2', '9 - 2 \\cdot (-3)^{3}', 63), -189)).toBe(true);
    expect(props['pow-odd-pos'](it('sn7:4:3:3:9:2', '9 - 2 \\cdot (-3)^{3}', 63), -45)).toBe(true);
    expect(props['pow-times'](it('sn7:4:3:3:9:2', '9 - 2 \\cdot (-3)^{3}', 63), 27)).toBe(true);
    expect(props['dec-places'](it('sn7:5:0.3:3', '(-0.3)^{3}', -0.027, { precise: true, fmt: 'dec' }), -0.27)).toBe(true);
    expect(props['num-only'](it('sn7:5:3/4:2', '\\left(-\\frac{3}{4}\\right)^{2}', 9 / 16, { precise: true }), 9 / 4)).toBe(true);
    // and not the other way round: a positive answer to (−5)² is no mistake, 25 for −(−5²) is right
    expect(props['pow-keep-sign'](it('sn7:0:5:3', '(-5)^{3}', -125), -125)).toBe(false);
  });
  it('expressions: (a + b)² with a negative sum squared to a negative number is pow-keep-sign, and only that', () => {
    try {
      Math.random = seeded(1118);
      let seen = 0;
      for (let i = 0; i < 2000 && seen < 50; i += 1) {
        const it = makeItem('expr', 5);
        if (!it.key.startsWith('ex5s:square:')) continue;
        const s = Number(it.key.split(':')[2]);
        for (let u = -100; u <= 100; u += 1) {
          if (isCorrect(it, u)) continue;
          const cat = it.diag(u);
          if (cat) { expect(cat).toBe('pow-keep-sign'); expect(PROPS.expr[cat](it, u), `${it.key}: ${u}`).toBe(true); }
        }
        if (s < 0) { expect(it.diag(-s * s), it.key).toBe('pow-keep-sign'); seen += 1; } else expect(it.diag(-s * s), it.key).toBeNull();
      }
      expect(seen).toBeGreaterThan(10);
    } finally { Math.random = real; }
  });
});

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

// CLASSROOM-6: collecting the class's way, 2,000 of each kind. Every label is checked against the display the student
// saw (exprTerms), on the answers each mistake predicts and on a sweep of the pairs around them; a constant-first
// answer is right on expr:3 and records nothing.
describe('the class\'s collecting questions name only what the answer shows', () => {
  const N = 2000;
  const real = Math.random;
  const props = PROPS.expr;
  /** The pairs a mistake predicts here, read from the display (not from the generator), and their neighbours. */
  const tryPairs = (it) => {
    const terms = exprTerms(it); const { k, c } = openSum(terms);
    const out = [...minusDropped(terms), { k: k + c, c: 0 }, { k: -k, c }, { k: c, c: k }];
    const xs = terms.filter((t) => t.v).map((t) => t.k);
    xs.forEach((a, i) => { if (a < 0 && xs[i + 1] > 0) out.push({ k: k - 2 * xs[i + 1], c }); });
    if (xs.length === 2) out.push({ k: -(Math.abs(xs[0]) + Math.abs(xs[1])), c }, { k: Math.abs(xs[0]) + Math.abs(xs[1]), c });
    return out.flatMap((u) => [u, { k: u.k + 1, c: u.c }, { k: u.k, c: u.c - 1 }, { k: u.k, c: u.c + 10 }]);
  };
  const check = (it, seen) => {
    const { k, c } = openSum(exprTerms(it));
    // the display is the answer the item checks
    expect([it.answer.k, it.answer.c], it.key).toEqual([k, c]);
    for (const u of tryPairs(it)) {
      if (isCorrect(it, u)) continue;
      const cat = it.diag(u);
      if (!cat) continue;
      seen[cat] = (seen[cat] || 0) + 1;
      expect(props[cat]?.(it, u), `${it.key}: ${JSON.stringify(u)} labelled ${cat}`).toBe(true);
      expect(catLabel('expr', 3, cat), cat).toBeTruthy();
    }
  };
  it('3 to 6 terms, a letter, x-terms that cancel: drop-minus on any negative term, conjoin and detach', () => {
    const seen = {}; const sizes = new Set(); let zero = 0; let letters = 0; let perTerm = 0; let practice = 0; let n = 0;
    try {
      Math.random = seeded(1121);
      while (n < N) {
        const it = { ...collectItem(), topic: 'expr', level: 3 };
        if (it.key.startsWith('ex3b:')) continue;
        n += 1;
        const terms = exprTerms(it);
        sizes.add(terms.length);
        if (it.answer.k === 0) zero += 1;
        if (it.var) { letters += 1; expect(it.display).toContain(it.var); }
        if (it.practiceOnly) { practice += 1; expect([it.answer.k, it.answer.c]).toEqual([0, 0]); }
        // one prediction per negative term: each term's minus dropped alone is named, unless it is a slip or shared
        terms.forEach((t, i) => {
          if (t.k >= 0) return;
          const { k, c } = openSum(terms.map((x, j) => (j === i ? { ...x, k: -x.k } : x)));
          if (it.diag({ k, c }) === 'drop-minus') perTerm += 1;
        });
        check(it, seen);
      }
    } finally { Math.random = real; }
    expect([...sizes].sort()).toEqual([3, 4, 5, 6]);
    expect(zero / N).toBeGreaterThan(0.07);
    expect(zero / N).toBeLessThan(0.13);
    expect(letters / N).toBeGreaterThan(0.3);
    expect(perTerm).toBeGreaterThan(N);
    expect(practice).toBeLessThan(N * 0.01);
    ['drop-minus', 'conjoin', 'detach'].forEach((id) => expect(seen[id] || 0, id).toBeGreaterThan(N * 0.04));
  }, 60_000);
  it('the notebook\'s slip on the spec\'s 6 terms: each negative term\'s minus dropped is its own drop-minus', () => {
    const it = { key: 'ex3:-11x - 2 + 4x - 5 + 3 + 9x', display: '-11x - 2 + 4x - 5 + 3 + 9x', form: 'lin', answer: { k: 2, c: -4 }, topic: 'expr', level: 3 };
    expect(minusDropped(exprTerms(it)).filter((u, i, a) => a.findIndex((w) => w.k === u.k && w.c === u.c) === i).length).toBe(7);
    [{ k: 24, c: -4 }, { k: 2, c: 0 }, { k: 2, c: 6 }].forEach((u) => expect(props['drop-minus'](it, u), JSON.stringify(u)).toBe(true));
    expect(props.detach(it, { k: -24, c: -4 })).toBe(true);
  });
  it('bracketed x-terms: drop-minus, abs-add with the larger term\'s sign, and sign', () => {
    const seen = {}; let one = 0;
    try {
      Math.random = seeded(1122);
      for (let i = 0; i < N; i += 1) {
        const it = { ...bracketCollect(), topic: 'expr', level: 3 };
        expect(it.display).toMatch(/^\([+-]\d*x?\)( \+ \([+-]\d*x?\)){3}$/);
        if (Math.abs(it.answer.k) === 1) one += 1;
        check(it, seen);
        // abs-add only when the larger x-term is negative
        const xs = exprTerms(it).filter((t) => t.v).map((t) => t.k);
        const big = Math.abs(xs[0]) > Math.abs(xs[1]) ? xs[0] : xs[1];
        if (big > 0) expect(it.diag({ k: -(Math.abs(xs[0]) + Math.abs(xs[1])), c: it.answer.c })).not.toBe('abs-add');
      }
    } finally { Math.random = real; }
    expect(one / N).toBeGreaterThan(0.28);
    expect(one / N).toBeLessThan(0.39);
    ['drop-minus', 'abs-add', 'sign'].forEach((id) => expect(seen[id] || 0, id).toBeGreaterThan(N * 0.04));
  }, 60_000);
  it('a constant-first answer is right on expr:3 and records no mistake', () => {
    const it = find('expr', 3, (x) => x.key.startsWith('ex3:') && x.answer.k !== x.answer.c && x.answer.k !== 0);
    const swapped = { k: it.answer.c, c: it.answer.k };
    expect(isCorrect(it, swapped)).toBe(true);
    expect(it.diag(swapped)).toBe(null);
    const r = recorded(it, swapped);
    expect(r.cat ?? null).toBe(null);
    expect(r.miscon).toEqual([]);
  });
});

// CLASSROOM-8: the class's word problems, 2,000 of each kind. Every label, on every whole and half answer up to 400 and on
// each prediction, is checked against the key (the numbers the student saw), and each mistake shows on its kind.
describe('the class\'s word problems name only what the answer shows', () => {
  const N = 2000;
  const real = Math.random;
  const props = PROPS.eq;
  const sweep = (it, seen) => {
    const us = new Set([...Array.from({ length: 801 }, (_, i) => i / 2), ...Object.values(it.bugsSeen || {})]);
    for (const u of us) {
      if (isCorrect(it, u)) continue;
      const cat = it.diag(u);
      if (!cat) continue;
      seen[cat] = (seen[cat] || 0) + 1;
      expect(props[cat]?.(it, u), `${it.key}: ${u} labelled ${cat}`).toBe(true);
      expect(catLabel('eq', 5, cat), cat).toBeTruthy();
    }
  };
  const kinds = [
    ['the rectangle', () => rectStory(), ['partial-dist', 'two-sides', 'wrong-unknown', 'add-sides'], 1131],
    ['the transfer, form 1', () => transferTable(1), ['wrong-unknown', 'divide-part'], 1132],
    ['the transfer, form 2', () => transferTable(2), ['wrong-unknown'], 1133],
    ['a triangle with x', () => angleEqStory(3), ['wrong-unknown', 'wrong-total', 'drop-minus'], 1134],
    ['a quadrilateral with x', () => angleEqStory(4), ['wrong-unknown', 'wrong-total', 'drop-minus'], 1135],
  ];
  it.each(kinds)('%s: every label holds, and each of its mistakes shows on more than 4%% of them', (_name, make, ids, seed) => {
    const shows = {};
    try {
      Math.random = seeded(seed);
      for (let i = 0; i < N; i += 1) {
        const it = { ...make(), topic: 'eq', level: 5 };
        const seen = {};
        sweep(it, seen);
        Object.keys(seen).forEach((id) => { shows[id] = (shows[id] || 0) + 1; });
      }
    } finally { Math.random = real; }
    expect(Object.keys(shows).sort()).toEqual([...ids].sort());
    ids.forEach((id) => expect(shows[id] / N, id).toBeGreaterThan(0.04));
  }, 120_000);
  it('the spec\'s examples: the rectangle x 11, d 5, P 54, and the angles with x', () => {
    const r = { key: 'eq5r:11:5:2', answer: 176, form: 'num' };
    expect(props['two-sides'](r, 24.5 * 29.5)).toBe(true); // x + (x + 5) = 54 gives 24.5, and its area 24.5 · 29.5
    expect(props['add-sides'](r, 27)).toBe(true);
    expect(props['partial-dist']({ key: 'eq5r:11:5:0', answer: 11, form: 'num' }, 12.25)).toBe(true);
    // 2x, 3x, 7x in a triangle: x = 15; with 360°, 30
    expect(props['wrong-total']({ key: 'eq5g:3:2,3,7:0,0,0:-1', answer: 15, form: 'num' }, 30)).toBe(true);
    // 2x, 4x − 15, 3x + 15, x in a quadrilateral: x = 36; with 180°, 18; the minus of −15 dropped, (360 − 30) : 10 = 33
    expect(props['wrong-total']({ key: 'eq5g:4:2,4,3,1:0,-15,15,0:-1', answer: 36, form: 'num' }, 18)).toBe(true);
    expect(props['drop-minus']({ key: 'eq5g:4:2,4,3,1:0,-15,15,0:-1', answer: 36, form: 'num' }, 33)).toBe(true);
  });
});

// CURRICULUM-10: the two-step angle questions, 2,000 of each. The key is the question (its numbers give the answer), every
// label is true of the answer it names, and each mistake of the kind shows on more than 4% of the questions.
describe('the two-step angle questions name only what the answer shows', () => {
  const real = Math.random;
  const props = PROPS.angles;
  const N = 2000;
  /** The answer from the key alone: the given angles, a difference, a halved angle. */
  const fromKey = (key) => {
    const [p, x, y] = key.split(':'); const a = Number(x); const b = Number(y);
    if (p === 'an1s' || p === 'an2t' || p === 'an4t') return 180 - a - b;
    if (p === 'an1d') return (180 - a) / 2;
    if (p === 'an2b') return y === 'v' ? a / 2 : (180 - a) / 2;
    if (p === 'an4b') return y === 'e' ? a / 2 : (180 - a) / 2;
    return NaN;
  };
  const kinds = [
    ['three angles on a straight line', straightThree, 1, ['one-angle', 'sum-360'], 1201],
    ['two adjacent angles and their difference', linearPairDiff, 1, ['took-larger', 'diff-not-halved'], 1202],
    ['three lines through one point', threeLines, 2, ['one-angle', 'sum-360'], 1203],
    ['a ray that halves an angle of a crossing', crossBisect, 2, ['no-half', 'supp-not-equal', 'equal-not-supp'], 1204],
    ['a triangle between parallel lines', parallelTriangle, 4, ['one-angle', 'supp-not-equal'], 1205],
    ['a ray that halves an angle after parallel lines', parallelBisect, 4, ['no-half', 'supp-not-equal', 'equal-not-supp'], 1206],
  ];
  it.each(kinds)('%s', (_name, make, level, ids, seed) => {
    const shows = {};
    try {
      Math.random = seeded(seed);
      for (let i = 0; i < N; i += 1) {
        const it = { ...make(), topic: 'angles', level };
        expect(it.answer, it.key).toBe(fromKey(it.key));
        const seen = new Set();
        for (let u = 1; u <= 360; u += 0.5) {
          if (isCorrect(it, u)) continue;
          const cat = it.diag(u);
          if (!cat) continue;
          expect(props[cat], cat).toBeTypeOf('function');
          expect(props[cat](it, u), `${it.key}: ${u} labelled ${cat}`).toBe(true);
          expect(catLabel('angles', level, cat), cat).toBeTruthy();
          seen.add(cat);
        }
        seen.forEach((id) => { shows[id] = (shows[id] || 0) + 1; });
      }
    } finally { Math.random = real; }
    expect(Object.keys(shows).sort()).toEqual([...ids].sort());
    ids.forEach((id) => expect(shows[id] / N, id).toBeGreaterThan(0.04));
  }, 120_000);
  it('the properties read the key: 180° minus one given angle, the difference not halved, the whole angle', () => {
    expect(props['one-angle']({ key: 'an1s:40:75:2:40:75', answer: 65, form: 'num' }, 140)).toBe(true);
    expect(props['one-angle']({ key: 'an1s:40:75:2:40:75', answer: 65, form: 'num' }, 105)).toBe(true);
    expect(props['took-larger']({ key: 'an1d:40:r', answer: 70, form: 'num' }, 110)).toBe(true);
    expect(props['diff-not-halved']({ key: 'an1d:40:r', answer: 70, form: 'num' }, 140)).toBe(true);
    expect(props['no-half']({ key: 'an2b:70:s:ul', answer: 55, form: 'num' }, 110)).toBe(true);
    expect(props['no-half']({ key: 'an4b:80:e:ur:ur:80', answer: 40, form: 'num' }, 80)).toBe(true);
    expect(props['equal-not-supp']({ key: 'an2b:70:s:ul', answer: 55, form: 'num' }, 35)).toBe(true);
    expect(props['supp-not-equal']({ key: 'an4t:65:55:0', answer: 60, form: 'num' }, 10)).toBe(true);
  });
});
