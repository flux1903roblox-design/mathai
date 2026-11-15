// Every mistake label an exercise generator can give must describe the answer the student actually gave.
// For each category there is a property, written here from the question's own numbers (read from its key, the
// numbers the student saw), not from the generator's diag(). Every generator is sampled with many wrong answers;
// whenever diag() names a category, the answer must have that property. And a label is only recorded as evidence
// about the student when it is honest: the learning model gets exactly the category the answer shows.
import { describe, it, expect } from 'vitest';
import { TOPICS, makeItem, isCorrect, catLabel, swappedLin } from './index.js';
import { quadOf as quadOfPt } from './manip.js';
import { startLesson, answer } from '@/lib/lesson.js';
import { learnAfterAnswer, emptyLearn } from '@/learn/storeGlue.ts';
import { slipOf } from '@/learn/misconceptions.ts';
import { evaluate, texToExpr, texRelation, holds, seeded } from '@/learn/expr.ts';
import { roundsTo, EQ, diagOf, twoStepBugs, rectStory, transferTable, angleEqStory } from './eq.js';
import { EXPR, collectItem, bracketCollect } from './expr.js';
import { SYS, minusBracketValues } from './sys.js';
import { FRAC } from './frac.js';
import { candidates, nearCandidates } from './labels.sample.js';
import { RATIO } from './ratio.js';
import { PCT } from './pct.js';
import { FUNC } from './func.js';
import { DATA } from './data.js';
import { STATS2_CATS } from './stats2.js';
import { PROB } from './prob.js';
import { chainItem, regroupItem, absItem, oppItem, nestedItem, zeroOne } from './signedItems.js';
import { powItem } from './signed7.js';
import { straightThree, linearPairDiff, fanItem, threeLines, crossBisect, splitTriangleS1, splitTriangleS2, parallelTriangle, parallelBisect } from './angleItems.js';
import { bisItem, quadItem } from './angles67.js';
import { AREA } from './area.js';
import { SOLID, CUBE_OPPOSITE } from './solid.js';
import { CIRCLE } from './circle.js';
import { SPACE } from './space.js';
import { piNear } from './util.js';
// the grid object's and the nets' rules (they register with content/manip.js as the files load)
import './grid.js';
import './net.js';
import { PROOFS, LETTER_SETS, proofManip, proofDiag } from './proofs.js';
import { TRANSF } from './transf.js';
import { shiftPlain } from './transf.gen.js';
import { CONGR } from './congr.js';
import { SIM } from './sim.js';
import { CONVERSES } from './sim.gen.js';

const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;
const sgn = (x) => Math.sign(x);
const nums = (key) => key.split(':').slice(1).map(Number);
/** A data key's fields: numbers, and lists (the bars' values, a table's counts, '6,10,4') as arrays of numbers. */
const dataKey = (key) => key.split(':').slice(1).map((x) => (x.includes(',') ? x.split(',').map(Number) : Number(x)));
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
/** The numbers of an eq:6 or eq:7 key after its kind (eq6:toward:40:60:300:0 gives [40, 60, 300, 0], eq7:1:3:8 [3, 8]). */
const motionNums = (key) => key.split(':').slice(2).map(Number);
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
/** The text of the chosen choice of a practice question whose choices are words (transformations). */
const choiceText = (it, u) => it.choices?.[u]?.text || '';
/** The chosen choice, words or maths (a side, an angle, a segment of the congruence questions). */
const choiceAny = (it, u) => it.choices?.[u]?.tex || it.choices?.[u]?.text || '';
/** Twice the area of a polygon given as "x,y,x,y,…" (the shoelace formula). */
const area2Of = (flat) => {
  const v = flat.split(',').map(Number); const pts = [];
  for (let i = 0; i < v.length; i += 2) pts.push([v[i], v[i + 1]]);
  return Math.abs(pts.reduce((a, [x, y], i) => { const [x2, y2] = pts[(i + 1) % pts.length]; return a + x * y2 - x2 * y; }, 0));
};
/**
 * A transformations item's point and its move, from the key: tf1s B(x, y) and the shift; tf1v A, A′ and C (the shift
 * is A′ − A, the point C); tf2a A and the axis; tf2l the line (t 0: x = k, 1: y = k) and A; tf3h A and the centre;
 * tf3q A and the direction of the quarter turn.
 */
function tfMove(key) {
  const [p, ...r] = key.split(':'); const n = r.map(Number);
  if (p === 'tf1s') return { p, x: n[0], y: n[1], dx: n[2], dy: n[3] };
  if (p === 'tf1v') return { p, x: n[4], y: n[5], dx: n[2] - n[0], dy: n[3] - n[1] };
  if (p === 'tf2a') return { p, x: n[0], y: n[1], ax: r[2] };
  if (p === 'tf2l') return { p, t: n[0], k: n[1], x: n[2], y: n[3] };
  if (p === 'tf3h') return { p, x: n[0], y: n[1], c1: n[2], c2: n[3] };
  if (p === 'tf3q') return { p, x: n[0], y: n[1], cw: r[2] === 'cw' };
  return { p };
}
const isSlide = (m) => m.p === 'tf1s' || m.p === 'tf1v';

// ---------------------------------------------------------------- congruent triangles: read back from what is on screen
/** Every whole number the text prints alone in maths, in order: `$12$` (the lengths of the sides questions). */
const numsIn = (text) => [...text.matchAll(/\$(\d+)\$/g)].map((m) => Number(m[1]));
/** Every number the text prints alone in maths, decimals too, in order: `$1.6$` (the similarity questions). */
const decsIn = (text) => [...text.matchAll(/\$(\d+(?:\.\d+)?)\$/g)].map((m) => Number(m[1]));
/** The sides written as expressions, `$AB = 3x + 2$`, as { AB: [3, 2] }. */
// (a coefficient of 1 is not written: BC = x + 6)
const sideExprs = (text) => Object.fromEntries([...text.matchAll(/\$([A-C]{2}) = (\d?)x ([+-]) (\d+)\$/g)].map((m) => [m[1], [Number(m[2] || 1), (m[3] === '+' ? 1 : -1) * Number(m[4])]]));
/** Every angle the text prints in degrees, by its name: { A: 50, MBD: 70 }. */
const anglesIn = (text) => Object.fromEntries([...text.matchAll(/\\sphericalangle ([A-Z]+) = (\d+)°/g)].map((m) => [m[1], Number(m[2])]));
/** Every length the text prints: { BC: 14, AD: 6 } (a side with a number, `$XY = n$`). */
const lengthsIn = (text) => Object.fromEntries([...text.matchAll(/\$([A-Z]{2}) = (\d+(?:\.\d+)?)\$/g)].map((m) => [m[1], Number(m[2])]));
/** The angle written as an expression: ∢V = (px ± q)°, as { V, p, q }. */
const exprIn = (text) => { const m = /\\sphericalangle ([A-Z]+) = \((\d)x ([+-]) (\d+)\)°/.exec(text); return m && { V: m[1], p: Number(m[2]), q: (m[3] === '+' ? 1 : -1) * Number(m[4]) }; };
/** The vertex a question asks about: "מה גודל ∢X?" (the third form). */
const askedIn = (text) => (/מה גודל \$\\sphericalangle ([A-Z])\$/.exec(text) || [])[1];
/** The second triangle's letters, as the drawing pairs them with A, B, C (its `match`). */
const partnerOf = (it) => Object.fromEntries(it.fig.match);
/** The letter the alphabet pairs with a vertex of ABC: the second triangle's letters in alphabetical order. */
const alphaOf = (it, V) => Object.values(partnerOf(it)).sort()[['A', 'B', 'C'].indexOf(V)];
/** The vertex of ABC the alphabet pairs with a letter of the second triangle. */
const alphaBack = (it, X) => ['A', 'B', 'C'][Object.values(partnerOf(it)).sort().indexOf(X)];
/** Where a point of a two-triangle drawing is: 'top', or 'left' / 'right' at the base of its own triangle. */
function placeIn(f, X) {
  const own = ['A', 'B', 'C'].includes(X) ? ['A', 'B', 'C'] : Object.values(Object.fromEntries(f.match));
  const [x, y] = f.pts[X]; const ys = own.map((k) => f.pts[k][1]);
  if (y === Math.max(...ys)) return 'top';
  const other = own.find((k) => k !== X && f.pts[k][1] !== Math.max(...ys));
  return x > f.pts[other][0] ? 'right' : 'left';
}
/** The letters of a side choice, `$KM$`, as a sorted string. */
const sideSet = (t) => [...String(t).replace(/\$/g, '')].sort().join('');
/** The proof row a "which row is wrong?" question passes over: the congruence row (SSA data), or the conclusion above it. */
function wrongRowOf(it) {
  const rows = it.fig.rows; const thm = rows.findIndex((r) => /\\cong/.test(r.claim));
  if (it.key.startsWith('cg3e:ssa:')) return thm;
  return rows.findIndex((r, i) => i < thm && /מתאימות במשולשים/.test(r.reason));
}
/** In a triangle with segments from A to BC: is AX the median, the altitude or the bisector? */
function segKind(f, X) {
  const P = f.pts; const [A, B, C, Q] = [P.A, P.B, P.C, P[X]];
  const ang = (u, v) => Math.acos(((u[0] - A[0]) * (v[0] - A[0]) + (u[1] - A[1]) * (v[1] - A[1])) / (Math.hypot(u[0] - A[0], u[1] - A[1]) * Math.hypot(v[0] - A[0], v[1] - A[1])));
  if (near(Q[0], (B[0] + C[0]) / 2, 1e-6)) return 'median';
  if (near(Q[0], A[0], 1e-6)) return 'altitude';
  if (near(ang(B, Q), ang(Q, C), 1e-6)) return 'bisector';
  return null;
}

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
  // curriculum stage 4's transformations (content/transf.gen.js): the point typed, read against the move in the key;
  // a word choice read back from the chosen choice
  transf: {
    // moved the other way along one axis (a point), or the whole slide backwards (a choice of slides)
    'shift-sign': (it, u) => {
      const m = tfMove(it.key);
      if (isSlide(m)) return ptEq(u, [m.x - m.dx, m.y + m.dy]) || ptEq(u, [m.x + m.dx, m.y - m.dy]);
      if (it.key.startsWith('tf1w:')) { const [dx, dy] = nums(it.key); return choiceText(it, u) === shiftPlain(-dx, -dy); }
      return false;
    },
    // the shift along x added to y and the shift along y to x
    'shift-swap': (it, u) => {
      const m = tfMove(it.key);
      if (isSlide(m)) return m.dx !== m.dy && ptEq(u, [m.x + m.dy, m.y + m.dx]);
      if (it.key.startsWith('tf1w:')) { const [dx, dy] = nums(it.key); return dx !== dy && choiceText(it, u) === shiftPlain(dy, dx); }
      return false;
    },
    // moved along one axis only
    'one-axis': (it, u) => { const m = tfMove(it.key); return isSlide(m) && (ptEq(u, [m.x + m.dx, m.y]) || ptEq(u, [m.x, m.y + m.dy])); },
    // the gap between the triangles taken for the slide: each shift less the triangle's width or height
    gap: (it, u) => {
      if (!it.key.startsWith('tf1w:')) return false;
      const [dx, dy, w, h] = nums(it.key);
      return choiceText(it, u) === shiftPlain(Math.sign(dx) * (Math.abs(dx) - w), Math.sign(dy) * (Math.abs(dy) - h));
    },
    // reflected in the axis, not in the line x = k (or y = k)
    'axis-not-line': (it, u) => { const m = tfMove(it.key); return m.p === 'tf2l' && m.k !== 0 && ptEq(u, m.t === 0 ? [-m.x, m.y] : [m.x, -m.y]); },
    // reflected the other way: in the other axis, or across the other kind of line
    'wrong-axis': (it, u) => {
      const m = tfMove(it.key);
      if (m.p === 'tf2a') return ptEq(u, m.ax === 'x' ? [-m.x, m.y] : [m.x, -m.y]);
      if (m.p === 'tf2l') return ptEq(u, m.t === 0 ? [m.x, 2 * m.k - m.y] : [2 * m.k - m.x, m.y]);
      return false;
    },
    // both signs changed: a half turn about the origin instead of a reflection
    'both-signs': (it, u) => { const m = tfMove(it.key); return m.p === 'tf2a' && ptEq(u, [-m.x, -m.y]); },
    // the diagonals counted as axes: the shape's own axes and two more (a rectangle 4, a parallelogram 2)
    'diagonal-axis': (it, u) => {
      const id = it.key.split(':')[1];
      return ['rectangle', 'parallelogram'].includes(id) && u === it.answer + 2;
    },
    // turned about the origin, not about the given centre
    'wrong-centre': (it, u) => { const m = tfMove(it.key); return m.p === 'tf3h' && (m.c1 !== 0 || m.c2 !== 0) && ptEq(u, [-m.x, -m.y]); },
    // reflected instead of turned: one coordinate kept
    'reflect-not-turn': (it, u) => { const m = tfMove(it.key); return m.p === 'tf3h' && (ptEq(u, [m.x, 2 * m.c2 - m.y]) || ptEq(u, [2 * m.c1 - m.x, m.y])); },
    // a quarter turn the other way round
    'turn-direction': (it, u) => { const m = tfMove(it.key); return m.p === 'tf3q' && ptEq(u, m.cw ? [-m.y, m.x] : [m.y, -m.x]); },
    // the coordinates swapped with no sign changed (a reflection in y = x, never a turn)
    'rot-swap': (it, u) => { const m = tfMove(it.key); return (m.p === 'tf3q' || m.p === 'tf2a') && ptEq(u, [m.y, m.x]); },
    // both perimeters added: the glued side counted twice
    'double-perimeter': (it, u) => { const [a, b, h, s] = nums(it.key); return it.key.startsWith('tf4g:') && u === 2 * (a + b + h + s); },
    // shapes of equal area taken for congruent: a move chosen for two shapes that are not the same shape, or "yes"
    // for two rectangles with equal areas and different sides
    'equal-area': (it, u) => {
      if (it.key.startsWith('tf4m:')) {
        const [, type, , a, b] = it.key.split(':');
        return type === 'none' && area2Of(a) === area2Of(b) && choiceText(it, u) !== 'הצורות לא חופפות';
      }
      if (it.key.startsWith('tf4r:')) { const [a, b, c, d] = nums(it.key); return choiceText(it, u) === 'כן, הם חופפים' && !(a === d && b === c) && a * b === c * d; }
      return false;
    },
    // "yes" for two rectangles with equal perimeters and different sides
    'equal-perimeter': (it, u) => {
      const [a, b, c, d] = nums(it.key);
      return it.key.startsWith('tf4r:') && choiceText(it, u) === 'כן, הם חופפים' && !(a === d && b === c) && a + b === c + d;
    },
  },
  // curriculum stage 4's congruent triangles (content/congr.gen.js): every property reads what the student saw, the
  // question's text (its angles and lengths, the congruence in letters, the angle written as an expression) and the
  // drawing's letters (the second triangle's, as the drawing pairs them, and where each vertex is drawn); a choice is
  // read back from the chosen choice's text, a proof from the table the student left (PROOF_PROPS)
  congr: {
    // matched by the alphabet: the angle of the vertex the second triangle's letters, in alphabetical order, pair with
    // the asked one (the third form), or the expression set equal to that vertex's angle (the x form); for a side, AB
    // set equal to the side of the alphabet's first two letters
    'alpha-order': (it, u) => {
      const p = it.key.split(':')[0]; const A = anglesIn(it.text);
      if (p === 'cg1x') {
        const [a, b] = nums(it.key); const s = Object.values(partnerOf(it)).sort();
        const side = Object.entries(lengthsIn(it.text)).find(([n]) => sideSet(n) === [s[0], s[1]].sort().join(''));
        return !!side && near(a * u + b, side[1]);
      }
      if (p === 'cg1p') { const [, name, st] = it.key.split(':'); return sideSet(choiceAny(it, u)) === [...st].map((v) => [...name].sort()['ABC'.indexOf(v)]).sort().join(''); }
      if (!['cg1a', 'cg2m', 'cg1t'].includes(p)) return false;
      const e = exprIn(it.text);
      if (e) { const v = A[alphaOf(it, e.V)]; return v != null && near(e.p * u + e.q, v); }
      const back = alphaBack(it, askedIn(it.text));
      return A[back] != null && near(u, A[back]);
    },
    // matched by where the vertex is drawn: the printed angle of the vertex of ABC drawn where the asked one is
    'match-by-place': (it, u) => {
      if (!['cg1a', 'cg1t'].includes(it.key.split(':')[0]) || exprIn(it.text)) return false;
      const place = placeIn(it.fig, askedIn(it.text));
      const V = { top: 'A', right: 'B', left: 'C' }[place];
      const A = anglesIn(it.text);
      return A[V] != null && near(u, A[V]);
    },
    // only one printed angle taken from 180°
    'one-angle': (it, u) => Object.values(anglesIn(it.text)).some((n) => near(u, 180 - n)),
    // a part that does not match: the angle set equal to the third angle (180° minus both printed: the x form), a side
    // that is neither the matching one nor the alphabet's (a choice), the kite's ∢BCA taken for ∢ADC, the crossing's ∢CAM
    // for ∢MDB, or ∢ACM set equal to ∢MBD
    'wrong-pair': (it, u) => {
      const p = it.key.split(':')[0]; const A = anglesIn(it.text); const e = exprIn(it.text);
      if (p === 'cg1p') {
        const [, name, st] = it.key.split(':'); const partner = { A: name[0], B: name[1], C: name[2] };
        const right = sideSet(`${partner[st[0]]}${partner[st[1]]}`);
        const alpha = [...st].map((v) => [...name].sort()['ABC'.indexOf(v)]).sort().join('');
        const c = sideSet(choiceAny(it, u));
        return c.length === 2 && c !== right && c !== alpha;
      }
      if ((p === 'cg1a' || p === 'cg2m') && e) { const vals = Object.values(A); return vals.length === 2 && near(e.p * u + e.q, 180 - vals[0] - vals[1]); }
      if (p === 'cg3u') {
        if (e) return A.MBD != null && near(e.p * u + e.q, A.MBD);
        if (A.BCA != null && /ADC\$\?/.test(it.text)) return near(u, A.BCA);
        if (A.CAM != null && /MDB\$\?/.test(it.text)) return near(u, A.CAM);
      }
      return false;
    },
    // the angle of one of the two triangles only: half of ∢ACB (90° − ∢CAD), or the half ∢BAC when the whole ∢BAD is asked
    'half-only': (it, u) => {
      const A = anglesIn(it.text);
      if (A.CAD != null && /ACB\$\?/.test(it.text)) return near(u, 90 - A.CAD);
      if (A.BAC != null && /BAD\$\?/.test(it.text)) return near(u, A.BAC);
      return false;
    },
    // two sides and an angle that is not between them taken as a theorem: "congruent" on SSA data, an angle that is not
    // where the two equal sides meet, or a proof's rows read past the congruence row that says צ.ז.צ on SSA data
    ssa: (it, u) => {
      const p = it.key.split(':')[0];
      if (p === 'cg2w') return it.key.split(':')[1] === 'ssa' && choiceText(it, u).startsWith('חופפים');
      if (p === 'cg2n') {
        const sides = [...it.text.matchAll(/\$([A-C]{2}) = /g)].map((m) => m[1]);
        const meet = [...sides[0]].find((v) => sides[1].includes(v));
        const m = /\\sphericalangle ([A-C]) =/.exec(choiceAny(it, u));
        return !!m && m[1] !== meet;
      }
      if (p === 'cg3e' && it.key.startsWith('cg3e:ssa:')) return u !== wrongRowOf(it);
      return false;
    },
    // three equal angles taken for congruence
    aaa: (it, u) => it.key.startsWith('cg2w:aaa:') && choiceText(it, u).startsWith('חופפים'),
    // two triangles with the same perimeter (and different sides) taken for congruent
    'equal-perimeter': (it, u) => {
      if (!it.key.startsWith('cg2p:')) return false;
      const [s, t] = it.key.split(':').slice(1).map((x) => x.split(',').map(Number));
      return choiceText(it, u) === 'כן' && sum(s) === sum(t) && sortN(s).join() !== sortN(t).join();
    },
    // a conclusion before the congruence it follows from: in a table the student ordered, or a "which row is wrong?"
    // answered with another row than the conclusion placed above the congruence
    circular: (it, u) => {
      if (it.form === 'manip') return PROOF_PROPS.circular(it, u);
      return it.key.startsWith('cg3e:') && !it.key.startsWith('cg3e:ssa:') && wrongRowOf(it) >= 0 && u !== wrongRowOf(it);
    },
    'wrong-theorem': (it, u) => it.form === 'manip' && PROOF_PROPS['wrong-theorem'](it, u),
    // the whole side as the base of half the triangle: BC · AH / 2 (or AB · BC / 2 in the rectangle); in the height form
    // 2S / BC
    'full-base': (it, u) => {
      const L = lengthsIn(it.text);
      if (it.key.startsWith('cg4r:')) return near(u, (L.AB * L.BC) / 2);
      if (!it.key.startsWith('cg4a:')) return false;
      if (L.AH != null) return near(u, (L.BC * L.AH) / 2);
      const S = Number((/הוא \$(\d+(?:\.\d+)?)\$/.exec(it.text) || [])[1]);
      return near(u, (2 * S) / L.BC);
    },
    // the median taken for the height: BC · AD / 4, or AD itself when the height is asked
    'median-as-height': (it, u) => {
      if (!it.key.startsWith('cg4a:')) return false;
      const L = lengthsIn(it.text);
      return L.AH != null ? near(u, (L.BC * L.AD) / 4) : near(u, L.AD);
    },
    // the whole side added: AB + BC + AD
    'full-side': (it, u) => { const L = lengthsIn(it.text); return it.key.startsWith('cg4p:') && near(u, L.AB + L.BC + L.AD); },
    // "the median makes two congruent triangles" (or two of the same perimeter) said always true
    'median-congruent': (it, u) => it.key.startsWith('cg4c:') && choiceText(it, u) === 'נכון תמיד' && !/שווי שטח/.test(it.text),
    // the segment chosen is not the one asked: a median, an altitude or a bisector taken for another
    'median-altitude': (it, u) => {
      if (!it.key.startsWith('cg4s:')) return false;
      const X = (/^A([A-Z])$/.exec(choiceAny(it, u)) || [])[1];
      const asked = /התיכון/.test(it.text) ? 'median' : /הגובה/.test(it.text) ? 'altitude' : 'bisector';
      return !!X && segKind(it.fig, X) !== asked;
    },
    // congr:5, the sides of a triangle, read from the lengths the text prints: the count with both flat ends (2·min + 1),
    // or "a triangle" said of lengths whose two short ones add up to the long one
    'sum-equal': (it, u) => {
      const n = numsIn(it.text);
      if (it.key.startsWith('cg5n:')) return n.length === 2 && near(u, 2 * Math.min(...n) + 1);
      if (it.key.startsWith('cg5c:')) { const s = sortN(n); return choiceText(it, u).startsWith('כן') && s[0] + s[1] === s[2]; }
      return false;
    },
    // only "shorter than the sum" checked: every whole length from 1 to a + b − 1, or "a triangle" said of two short
    // lengths that do not reach the long one
    'no-lower-limit': (it, u) => {
      const n = numsIn(it.text);
      if (it.key.startsWith('cg5n:')) return n.length === 2 && near(u, n[0] + n[1] - 1);
      if (it.key.startsWith('cg5c:')) { const s = sortN(n); return choiceText(it, u).startsWith('כן') && s[0] + s[1] < s[2]; }
      return false;
    },
    // the isosceles triangle's legs taken as the short side, which do not meet over the long one: 2·short + long
    'ignore-inequality': (it, u) => {
      if (!it.key.startsWith('cg5i:')) return false;
      const [a, b] = sortN(numsIn(it.text));
      return 2 * a <= b && near(u, 2 * a + b);
    },
    // the largest angle looked for at an end of the longest side: the chosen vertex is on it
    'angle-at-side': (it, u) => {
      if (!it.key.startsWith('cg5m:')) return false;
      const L = lengthsIn(it.text); const longest = Object.keys(L).sort((x, y) => L[y] - L[x])[0];
      const X = (/\\sphericalangle ([A-C])/.exec(choiceAny(it, u)) || [])[1];
      return !!X && longest.includes(X);
    },
  },
  // curriculum stage 4's isosceles triangles and similarity (content/sim.gen.js): every property reads what the student
  // saw, the numbers and expressions the question prints, the chosen choice's words or maths, and a proof from the table
  // the student left (PROOF_PROPS)
  sim: {
    // AB set equal to BC, the sides at B (not opposite the equal angles): AB at the x where px + q = tx + u
    'side-at-angle': (it, u) => {
      const e = sideExprs(it.text); if (!e.AB || !e.BC || e.AB[0] === e.BC[0]) return false;
      const x2 = (e.BC[1] - e.AB[1]) / (e.AB[0] - e.BC[0]);
      return x2 > 0 && near(u, e.AB[0] * x2 + e.AB[1]);
    },
    // x itself, where AB = AC: the equation solved and the question left
    'stopped-at-x': (it, u) => { const e = sideExprs(it.text); return !!e.AB && !!e.AC && e.AB[0] !== e.AC[0] && near(u, (e.AC[1] - e.AB[1]) / (e.AB[0] - e.AC[0])); },
    // the whole base in Pythagoras: √(AB² − BC²), typed as it rounds to a tenth
    'whole-base': (it, u) => {
      const m = /\$AB = AC = (\d+)\$.*\$BC = (\d+)\$/.exec(it.text); if (!m) return false;
      const [ab, bc] = [Number(m[1]), Number(m[2])];
      return ab > bc && Math.abs(u - Math.sqrt(ab * ab - bc * bc)) < 0.051;
    },
    // "נכון" said of a converse that is not necessarily true
    'converse-equal': (it, u) => it.key.startsWith('sm1v:') && choiceText(it, u) === 'נכון' && CONVERSES[Number(it.key.split(':')[1])].ok === false,
    // the same added to every side: the image of a side plus the change of another, or the change itself for the factor,
    // or "similar" said of rectangles that gained the same on both sides
    additive: (it, u) => {
      const p = it.key.split(':')[0]; const n = decsIn(it.text); const L = lengthsIn(it.text);
      if (p === 'sm2m') return near(u, n[1] + n[2] - n[0]);
      if (p === 'sm2f') return near(u, n[1] - n[0]);
      if (p === 'sm3p') return near(u, L.DE + L.DB);
      if (p === 'sm3b') return near(u, L.AB + L.MD - L.AM);
      if (p === 'sm3s') return near(u, n[0] + n[2] - n[1]);
      if (p === 'sm2s') { const r = /\$(\d+) \\times (\d+)\$ ו־\$(\d+) \\times (\d+)\$/.exec(it.text); return !!r && choiceText(it, u).startsWith('כן') && Number(r[3]) - Number(r[1]) === Number(r[4]) - Number(r[2]) && Number(r[1]) !== Number(r[2]); }
      return false;
    },
    // the factor turned over: the image divided by the factor, the old side over the new, the area over k²
    'ratio-flip': (it, u) => {
      const p = it.key.split(':')[0]; const n = decsIn(it.text); const L = lengthsIn(it.text);
      if (p === 'sm2m') return near(u, n[1] / (n[2] / n[0]));
      if (p === 'sm2f') return near(u, n[0] / n[1]);
      if (p === 'sm3b') return near(u, (L.AB * L.AM) / L.MD);
      if (p === 'sm3s') return near(u, (n[0] * n[1]) / n[2]);
      if (p === 'sm4a') return near(u, n[n.length - 1] * (L.AB / L.DE) ** 2);
      return false;
    },
    // "similar" said of every two rectangles, whose angles are all equal
    'angles-enough': (it, u) => it.key === 'sm2s:rects' && choiceText(it, u).startsWith('כן'),
    // DB, a part of AB, compared with AD: DE · DB / AD
    'part-not-whole': (it, u) => { const L = lengthsIn(it.text); return it.key.startsWith('sm3p:') && near(u, (L.DE * L.DB) / L.AD); },
    // the similar triangle named in an order whose vertices do not match: ACB for ABC, CMD for DMC
    'order-mixed': (it, u) => it.key.startsWith('sm3w:') && ['\\triangle ACB', '\\triangle CMD'].includes(choiceAny(it, u)),
    // "not similar" said of two triangles whose third angles make the same three angles
    'third-angle': (it, u) => {
      if (!it.key.startsWith('sm3a:')) return false;
      const [a, b, b2, c2] = [...it.text.matchAll(/\$(\d+)°\$/g)].map((m) => Number(m[1]));
      return choiceText(it, u).startsWith('לא') && b === b2 && 180 - a - b === c2;
    },
    // the area scaled like a length: S · k, the area ratio applied to a side, or the side's factor for the area
    'linear-area': (it, u) => {
      const p = it.key.split(':')[0]; const n = decsIn(it.text); const L = lengthsIn(it.text);
      if (p === 'sm4a') return near(u, (n[n.length - 1] * L.DE) / L.AB);
      if (p === 'sm4k') return near(u, (n[2] * n[1]) / n[0]);
      if (p === 'sm4g') return choiceAny(it, u) === String(n[0]);
      return false;
    },
    // the perimeter scaled by k² too: P · (DE / AB)²
    'area-for-perimeter': (it, u) => { const L = lengthsIn(it.text); const n = decsIn(it.text); return it.key.startsWith('sm4p:') && near(u, n[n.length - 1] * (L.DE / L.AB) ** 2); },
    // the proofs of the unit (T5, T6, T7): a conclusion above the congruence or the similarity, another theorem on it
    circular: (it, u) => it.form === 'manip' && PROOF_PROPS.circular(it, u),
    'wrong-theorem': (it, u) => it.form === 'manip' && PROOF_PROPS['wrong-theorem'](it, u),
  },
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
  // func:1, each property from the numbers the student saw (the key): sx, sy, t1, d1, t2, t3, q of fu1 (the walk: the
  // axes' steps, out to (t1, d1), the rest until t2, home at t3; q asks the distance at t1/2, the rest or the way back);
  // q, the two hours and their temperatures of fu1d (a dot every 2 hours, so a square across is 2 hours)
  func: {
    // the squares counted, not multiplied by the step of the axis the answer is read on
    'count-squares': (it, u) => {
      const p = it.key.split(':')[0]; const n = nums(it.key);
      if (p === 'fu1') { const [sx, sy, t1, d1, t2, t3, q] = n; return fits(u, [d1 / 2 / sy, (t2 - t1) / sx, (t3 - t2) / sx][q]); }
      if (p === 'fu1d') { const [q, hi, hj] = n; return q === 1 && fits(u, (hj - hi) / 2); }
      return false;
    },
    // the moment it ended, not how long it lasted: the end of the rest, the arrival home, the later hour
    'end-for-duration': (it, u) => {
      const p = it.key.split(':')[0]; const n = nums(it.key);
      if (p === 'fu1') { const [, , , , t2, t3, q] = n; return (q === 1 && fits(u, t2)) || (q === 2 && fits(u, t3)); }
      if (p === 'fu1d') { const [q, , hj] = n; return q === 1 && fits(u, hj); }
      return false;
    },
    // the value at the later time, not the change: the temperature at the second hour
    'value-not-change': (it, u) => { const n = nums(it.key); return it.key.startsWith('fu1d:') && n[0] === 0 && fits(u, n[4]); },
    // the flat line read as flat ground: the choice that says so
    'graph-picture': (it, u) => it.key.startsWith('fu1f:') && /בדרך ישרה ושטוחה$/.test(it.choices[u]?.text || ''),
    // func:2, from m, b, x and q of fu2 (y = m·x + b; q asks y at x, or the x of y), C and q of fu2c (F = 1.8C + 32), and
    // m, b and n of fu2t (a table of y = m·x + b at x = 0..3, asked at n)
    // the fixed part left out: m·x, or y/m; 1.8C, or F/1.8; m·n
    'forgot-b': (it, u) => {
      const p = it.key.split(':')[0]; const n = nums(it.key);
      if (p === 'fu2') { const [m, b, x, q] = n; return fits(u, q === 0 ? m * x : (m * x + b) / m); }
      if (p === 'fu2c') { const [C, q] = n; return fits(u, q === 0 ? 1.8 * C : (1.8 * C + 32) / 1.8); }
      if (p === 'fu2t') { const [m, , k] = n; return fits(u, m * k); }
      // func:4's pot after t minutes: the start left out, r·t
      if (p === 'fu4') { const [, r, , t, q] = n; return q === 1 && fits(u, r * t); }
      return false;
    },
    // the value of the function put in for x: m·y + b, or 1.8F + 32
    forward: (it, u) => {
      const p = it.key.split(':')[0]; const n = nums(it.key);
      if (p === 'fu2') { const [m, b, x, q] = n; return q === 1 && fits(u, m * (m * x + b) + b); }
      if (p === 'fu2c') { const [C, q] = n; return q === 1 && fits(u, 1.8 * (1.8 * C + 32) + 32); }
      return false;
    },
    // added before multiplying: 1.8(C + 32)
    'order-ops': (it, u) => { const n = nums(it.key); return it.key.startsWith('fu2c:') && n[1] === 0 && fits(u, 1.8 * (n[0] + 32)); },
    // func:3, from s, x0..x3, y0..y2 and q of fu3 (up from (x0, y0) to (x1, y1), down to (x2, y2), flat to x3; q asks how
    // long it rises, falls or stays), the hours and temperatures at the start, the peak and the end and q of fu3t, and the
    // right direction of fu3w (which way between two x's)
    // the length of the other monotone interval, or (a choice) the direction swapped
    'rtl-read': (it, u) => {
      const p = it.key.split(':')[0]; const n = nums(it.key);
      if (p === 'fu3') { const [, x0, x1, x2, , , , , q] = n; return (q === 0 && fits(u, x2 - x1)) || (q === 1 && fits(u, x1 - x0)); }
      if (p === 'fu3t') { const [, h0, hk, he, , , , q] = n; return fits(u, q === 0 ? he - hk : hk - h0); }
      if (p === 'fu3w') { const d = it.key.split(':')[1]; const t = it.choices[u]?.text; return (d === 'up' && t === 'יורדת') || (d === 'down' && t === 'עולה'); }
      return false;
    },
    // the change in y over the interval, or the constant's height
    'y-not-x': (it, u) => {
      const p = it.key.split(':')[0]; const n = nums(it.key);
      if (p === 'fu3') { const [, , , , , y0, y1, y2, q] = n; return fits(u, [y1 - y0, y1 - y2, y2][q]); }
      if (p === 'fu3t') { const [, , , , T0, Tk, Te, q] = n; return fits(u, q === 0 ? Tk - T0 : Tk - Te); }
      return false;
    },
    // a constant table chosen as the one that is not a function: every y of the chosen table the same
    'const-not-function': (it, u) => {
      const tex = it.choices[u]?.tex || ''; const ys = (tex.split('\\hline y &')[1] || '').split('&').map((v) => Number(v.replace(/\\end\{array\}/, '').trim()));
      return it.key.startsWith('fu2i:') && ys.length === 4 && ys.every((v) => Number.isFinite(v) && v === ys[0]);
    },
    // func:4, from s, r, T, t and q of fu4 (s° at the start, r° a minute, so v = s + r·T after T minutes; q asks the rate,
    // or the value after t minutes), h0, T and h1 of fu4c (a candle, h0 cm and h1 cm after T hours), and the slow runner
    // of fu4f (who is faster: the one who starts ahead is the slower)
    // the rate as if it started at 0: v / T, or t·v / T; the candle's h0·T / h1
    'from-zero': (it, u) => {
      const p = it.key.split(':')[0]; const n = nums(it.key);
      if (p === 'fu4') { const [s, r, T, t, q] = n; const v = s + r * T; return fits(u, q === 0 ? v / T : (t * v) / T); }
      if (p === 'fu4c') { const [h0, T, h1] = n; return fits(u, (h0 * T) / h1); }
      return false;
    },
    // the whole change, not the change in one minute: v − s
    'whole-change': (it, u) => { const [, r, T, , q] = nums(it.key); return it.key.startsWith('fu4:') && q === 0 && fits(u, r * T); },
    // the candle's hours left from now, not from lighting: h1 / r, with r = (h0 − h1) / T
    'wrong-unknown': (it, u) => { const [h0, T, h1] = nums(it.key); return it.key.startsWith('fu4c:') && fits(u, h1 / ((h0 - h1) / T)); },
    // the higher line chosen for the faster runner: the choice names the slow runner, who starts ahead
    'height-for-slope': (it, u) => {
      const [p, , , , fast] = it.key.split(':'); const slow = fast === 'A' ? 'B' : 'A';
      return p === 'fu4f' && (it.choices[u]?.text || '').startsWith(`הרץ ${slow}:`);
    },
  },
  expr: {
    // (a + b)² with a negative sum, squared to a negative number (CLASSROOM-5): ex5s:square:s:m, u = −s²
    'pow-keep-sign': (it, u) => { const [kind, s] = it.key.split(':').slice(1); return kind === 'square' && Number(s) < 0 && near(u, -(Number(s) ** 2)); },
    // ax read as the digits a and x side by side: 3x at x = 4 is 34. Only a digit x from 1 to 9: −34 for 3x at x = −4
    // is no reading a student writes (the notebook's mistake there is 3 − 4, plus), so nothing may call it concat
    // (FOLLOWUP-36)
    concat: (it, u) => {
      const q = substOf(it);
      return q.x >= 1 && q.x <= 9 && near(substVal(it, u), withProd(q, 10 * q.a + q.x));
    },
    order: (it, u) => { const q = substOf(it); return q.f < 2 && near(u, (q.f === 0 ? q.b + q.a : q.b - q.a) * q.x); },
    'neg-sub': (it, u) => { const q = substOf(it); return q.x < 0 && near(substVal(it, u), withProd(q, q.a * -q.x)); },
    // ax read as a + x, and ax read as x alone (the number before the letter dropped)
    plus: (it, u) => { const q = substOf(it); return near(substVal(it, u), withProd(q, q.a + q.x)); },
    coef: (it, u) => { const q = substOf(it); return near(substVal(it, u), withProd(q, q.x)); },
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
      // the constant beside x moved over keeping its sign: x on the left (on both sides, the left one, as the lesson
      // moves it), or x only on the right (12 = x + 5); an equation with no constant beside x has none to move
      const vals = [];
      if (!near(L.k, 0) && !near(L.c, 0)) vals.push((R.c + L.c) / (L.k - R.k));
      else if (near(L.k, 0) && !near(R.c, 0)) vals.push(-(L.c + R.c) / (L.k - R.k));
      const xs = xSide(it.display); if (xs) vals.push((xs[1] - xs[0].c) * xs[0].k);
      return vals.some((v) => fits(u, v));
    },
    // the x-term moved to the other side keeping its sign
    'move-x-no-flip': (it, u) => { const [L, R] = sidesOf(it.display); return fits(u, (R.c - L.c) / (L.k + R.k)) || fits(u, (L.c - R.c) / (L.k + R.k)); },
    // the larger divided by the smaller: 12x = 3 gives 4
    'divide-flip': (it, u) => { const xs = xSide(it.display); return !!xs && Math.abs(xs[0].k) > Math.abs(xs[1] - xs[0].c) && fits(u, xs[0].k / (xs[1] - xs[0].c)); },
    // the coefficient subtracted instead of divided by
    'sub-coef': (it, u) => { const xs = xSide(it.display); return !!xs && Number.isInteger(xs[0].k) && fits(u, xs[1] - xs[0].c - xs[0].k); },
    // only some terms divided by the coefficient: 2x + 4 = 10 → x + 4 = 5; (x + 1)/3 = 7 read as x/3 + 1 = 7
    // (as the lesson diagnoses it: a coefficient other than ±1, whose division of the other side comes out whole, with
    // the x-term written first: in 14 − 7x = −42 the number before it is not "a part" the student keeps)
    'divide-part': (it, u) => {
      // the transfer, 2x + d = T divided as x + d = T : 2: box B at the start comes out T : 2
      if (it.key.startsWith('eq5x:')) { const [, T] = nums(it.key); return near(u, T / 2); }
      const fs = fracSum(it.display);
      if (fs) return fits(u, fs.a * (fs.c - fs.b));
      const xs = xSide(it.display);
      if (!xs || Math.abs(xs[0].k) === 1 || !Number.isInteger(xs[1] / xs[0].k)) return false;
      const xTex = (near(sidesOf(it.display)[1].k, 0) ? it.display.split('=')[0] : it.display.split('=')[1]).trim();
      if (/^-?\d+\s*[-+]/.test(xTex) && !it.key.startsWith('eq2c:')) return false;
      return fits(u, xs[1] / xs[0].k - xs[0].c);
    },
    // the opposite of the solution, where a minus could be lost: a negative coefficient, or the missing number
    sign: (it, u) => {
      if (it.key.startsWith('eq1m:')) return near(u, -nums(it.key)[3]);
      const xs = xSide(it.display); return !!xs && xs[0].k < 0 && near(u, -it.answer);
    },
    'partial-dist': (it, u) => {
      // eq:7, (x + p)/q − (x − s)/(2q) = r times 2q with 2(x + p) written 2x + p: x = 2qr − p − s; a proportion
      // (x + a)/b = (x − c)/d with only x multiplied, dx + a = bx − c: x = (a + c)/(b − d)
      if (it.key.startsWith('eq7:2:')) { const [p, q, s, r] = motionNums(it.key); return fits(u, 2 * q * r - p - s); }
      if (it.key.startsWith('eq7p:')) { const [a, b, c, d] = nums(it.key); return fits(u, (a + c) / (b - d)); }
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
    // eq:7, (x + p)/q − (x − s)/(2q) = r times 2q with −(x − s) opened as −x − s: x = 2qr − 2p + s
    'minus-bracket': (it, u) => {
      if (it.key.startsWith('eq7:2:')) { const [p, q, s, r] = motionNums(it.key); return fits(u, 2 * q * r - 2 * p + s); }
      return solvesOpened(it.display, u, 'minus');
    },
    // eq:7, from eq7:0:a:b:c (x/a + x/b = c) and eq7:1:a:c (x + x/a = c): times the common denominator L, but c not
    // multiplied, c / (L/a + L/b) or c / (a + 1)
    'lcd-partial': (it, u) => {
      if (it.key.startsWith('eq7:0:')) { const [a, b, c] = motionNums(it.key); const L = (a * b) / gcdOf(a, b); return fits(u, c / (L / a + L / b)); }
      if (it.key.startsWith('eq7:1:')) { const [a, c] = motionNums(it.key); return fits(u, c / (a + 1)); }
      return false;
    },
    // added across: x/a + x/b read as 2x/(a + b), x + x/a as 2x/(1 + a)
    'add-across': (it, u) => {
      if (it.key.startsWith('eq7:0:')) { const [a, b, c] = motionNums(it.key); return fits(u, (c * (a + b)) / 2); }
      if (it.key.startsWith('eq7:1:')) { const [a, c] = motionNums(it.key); return fits(u, (c * (a + 1)) / 2); }
      return false;
    },
    // a quantity of the story, but not the one asked; eq:6's catching up: the hours since the first one left, t + h,
    // when the car's hours were asked (t = v1·h / (v2 − v1), from eq6:catch:v1:h:v2:q)
    'wrong-unknown': (it, u) => {
      if (it.key.startsWith('eq6:catch:')) { const [v1, h, v2, q] = motionNums(it.key); return q === 0 && fits(u, (v1 * h) / (v2 - v1) + h); }
      return storyValues(it).some((v) => near(u, v)) && !near(u, it.answer);
    },
    // eq:6, from the keys eq6:toward:v1:v2:D:q (a meeting, q0 when, q1 how far the first one went), eq6:catch:v1:h:v2:q
    // (a car catches up h hours later; q0 when from its start, q1 how far), eq6:trip:v1:v2:T (there and back in T hours),
    // eq6u:v:t (a train for t minutes) and eq6t:… (which equation fits the table)
    // the speeds subtracted toward each other (D / |v1 − v2|), added catching up (v1·h / (v1 + v2)); in the table, the
    // equation of the gap closed at the difference (meeting) or at the sum (catching up)
    'rel-speed': (it, u) => {
      if (it.key.startsWith('eq6:toward:')) { const [v1, v2, D, q] = motionNums(it.key); const t = D / Math.abs(v1 - v2); return fits(u, q === 0 ? t : v1 * t); }
      if (it.key.startsWith('eq6:catch:')) { const [v1, h, v2, q] = motionNums(it.key); const t = (v1 * h) / (v1 + v2); return fits(u, q === 0 ? t : v2 * t); }
      if (it.key.startsWith('eq6t:toward:')) { const [v1, v2, D] = motionNums(it.key); return chosen(it, u) === `${Math.max(v1, v2)}x - ${Math.min(v1, v2)}x = ${D}`; }
      if (it.key.startsWith('eq6t:catch:')) { const [v1, h, v2] = motionNums(it.key); return chosen(it, u) === `${v1 + v2}x = ${v1 * h}`; }
      return false;
    },
    // the round trip at the mean of the two speeds: T·(v1 + v2) / 2 for both ways, half of it each way
    'mean-speed': (it, u) => { const [v1, v2, T] = motionNums(it.key); return it.key.startsWith('eq6:trip:') && fits(u, (T * (v1 + v2)) / 4); },
    // the minutes used as hours: v·t
    'minutes-as-hours': (it, u) => { const [v, t] = nums(it.key); return it.key.startsWith('eq6u:') && fits(u, v * t); },
    // the minutes written as a decimal of an hour, as if it had 100 minutes: v·t / 100
    'decimal-minutes': (it, u) => { const [v, t] = nums(it.key); return it.key.startsWith('eq6u:') && fits(u, (v * t) / 100); },
    // divided by the time (in hours) instead of multiplying: v / (t/60)
    'formula-flip': (it, u) => { const [v, t] = nums(it.key); return it.key.startsWith('eq6u:') && fits(u, v / (t / 60)); },
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
      // a prediction a slip of the hand also gives (one off) names nothing, as everywhere (eq.js diagOf)
      return Array.isArray(u) && Math.abs(kv) >= 2 && !slipOf(first, it.answer[i]) && fits(u[i], first);
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
        // after making those coefficients equal by multiplying one equation by a whole number, as the lesson does
        if (!Number.isInteger(mu) && !Number.isInteger(1 / mu)) return false;
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
    // the sign chosen is the reverse of the right one (the three signs stand in a new order each time)
    'neg-compare': (it, u) => { const [a, b] = nums(it.key); return a < 0 && b < 0 && a !== b && chosen(it, u) === (a < b ? '>' : '<'); },
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
    // CLASSROOM-9, the fan (an1f:T:a): two angles side by side taken to make 180° (180° − a), or added (T + a)
    'adjacent-not-line': (it, u) => { const [, a] = nums(it.key); return it.key.startsWith('an1f:') && near(u, 180 - a); },
    'sum-not-diff': (it, u) => { const [T, a] = nums(it.key); return it.key.startsWith('an1f:') && near(u, T + a); },
    // CLASSROOM-11, the split triangle (an3a:w:d:b|a, an3b:d:p): β paired with ∢ADC = d at another vertex (180° − d), or
    // ∢BAD = p taken for the whole angle at A in ABC (90° − p)
    'other-vertex': (it, u) => {
      const p = it.key.split(':')[0]; const n = nums(it.key);
      const d = p === 'an3a' ? n[1] : p === 'an3b' ? n[0] : NaN;
      return (p === 'an3b' || it.key.endsWith(':b')) && near(u, 180 - d);
    },
    // a part of an angle taken for the whole: ∢BAD for the angle at A (an3b: 90° − p); a half for the whole angle (an6w:h: h;
    // an6t:a:b, the two given parts once each: a + b)
    'part-for-whole': (it, u) => {
      const p = it.key.split(':')[0]; const n = nums(it.key);
      if (p === 'an3b') return near(u, 90 - n[1]);
      if (p === 'an6w') return near(u, n[0]);
      if (p === 'an6t') return near(u, n[0] + n[1]);
      return false;
    },
    // CLASSROOM-10: halved instead of doubled (an6w:h, h even: h : 2), or doubled instead of halved (an6h:w: 2w)
    'half-double-swap': (it, u) => {
      const p = it.key.split(':')[0]; const [x] = nums(it.key);
      return (p === 'an6w' && x % 2 === 0 && near(u, x / 2)) || (p === 'an6h' && near(u, 2 * x));
    },
    // CLASSROOM-12: one known angle left out of the 360° (the right angle too): the answer plus that angle
    'quad-missed': (it, u) => {
      const p = it.key.split(':')[0]; const n = nums(it.key);
      const known = p === 'an7a' ? n.slice(0, 3) : p === 'an7b' ? [n[0], n[1], 90] : [];
      return known.some((v) => near(u, it.answer + v));
    },
    // a bisector (an2b:a:v|s, an4b:g:e|s): the whole angle it halves, the given one (v, e) or 180° minus it (s)
    'no-half': (it, u) => {
      const [p, g, kind] = it.key.split(':');
      // CLASSROOM-10: the whole angle a bisector halves, given (an6h:w) or next to the given one on a line (an6l:a: 180° − a)
      if (p === 'an6h') return near(u, Number(g));
      if (p === 'an6l') return near(u, 180 - Number(g));
      return (p === 'an2b' || p === 'an4b') && near(u, kind === 'v' || kind === 'e' ? Number(g) : 180 - Number(g));
    },
    // CLASSROOM-12: two equal angles of a quadrilateral found with a triangle's 180° (an7c:a:b: (180° − a − b) : 2)
    'wrong-total': (it, u) => {
      if (it.key.startsWith('an7c:')) { const [a, b] = nums(it.key); return near(u, (180 - a - b) / 2); }
      const [a] = nums(it.key); return near(u, 90 - a) || near(u, 360 - a);
    },
    // a full turn instead of a straight line; CLASSROOM-10's bisector on a line (an6l:a): ∢BOC from 360°, halved
    'sum-360': (it, u) => { const [a, b] = nums(it.key); return it.key.startsWith('an6l:') ? near(u, (360 - a) / 2) : near(u, 360 - a - b); },
    'one-angle': (it, u) => { const [a, b] = nums(it.key); return near(u, 180 - a) || near(u, 180 - b); },
    // the base angles' share not halved (an5:iso:top: 180° − top); CLASSROOM-12's two equal angles of a quadrilateral
    // (an7c:a:b: 360° − a − b)
    'forgot-half': (it, u) => {
      if (it.key.startsWith('an7c:')) { const [a, b] = nums(it.key); return near(u, 360 - a - b); }
      const top = Number(it.key.split(':')[2]); return near(u, 180 - top);
    },
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
  // data:1-4 (curriculum stage 3), each property from the numbers the student saw (the key). A list in the key (the bars'
  // values, a table's counts) is read as an array. The P-rule predictions (a share, a probability) may be typed rounded:
  // they are compared through fits (the value or its rounding to tenths or hundredths), as diagOf reads them.
  data: {
    'scale-units': (it, u) => {
      const p = it.key.split(':')[0]; const k = dataKey(it.key);
      if (p === 'da1r') { const [s, vals, i] = k; return fits(u, vals[i] / s); }
      if (p === 'da1d') { const [s, vals, i, j] = k; return fits(u, (vals[i] - vals[j]) / s); }
      if (p === 'da1l') { const [step, vals, a, b] = k; return fits(u, (vals[b] - vals[a]) / step); }
      return false;
    },
    'one-value': (it, u) => { const [, vals, i] = dataKey(it.key); return it.key.startsWith('da1d:') && fits(u, vals[i]); },
    'icon-count': (it, u) => { const [, icons, x] = dataKey(it.key); return it.key.startsWith('da1p:') && fits(u, icons[x]); },
    'half-icon': (it, u) => { const [k, icons, x] = dataKey(it.key); return it.key.startsWith('da1p:') && icons[x] % 1 !== 0 && fits(u, Math.ceil(icons[x]) * k); },
    // the "yes, r times" choice, where the bars drawn from `from` look r times apart
    'truncated-axis': (it, u) => { const [from, a, b] = dataKey(it.key); return it.key.startsWith('da1a:') && it.choices[u]?.text === `כן, פי ${(a - from) / (b - from)}`; },
    'part-part': (it, u) => {
      const p = it.key.split(':')[0]; const k = dataKey(it.key);
      if (p === 'da2' || p === 'da4') { const [f, j] = k; const N = sum(f); return fits(u, f[j] / (N - f[j])); }
      if (p === 'da2b') { const [n1, k1, n2, k2] = k; const [n, c] = k1 / n1 > k2 / n2 ? [n1, k1] : [n2, k2]; return fits(u, c / (n - c)); }
      return false;
    },
    'inverse-ratio': (it, u) => {
      const p = it.key.split(':')[0]; const k = dataKey(it.key);
      if (p === 'da2') { const [f, j] = k; return fits(u, sum(f) / f[j]); }
      if (p === 'da3p') { const [rows, x] = k; return fits(u, (100 * sum(rows)) / rows[x]); }
      return false;
    },
    'freq-only': (it, u) => { const [f, j] = dataKey(it.key); return it.key.startsWith('da2:') && fits(u, f[j]); },
    // each row an equal part: a mistake only where 1/rows is not the answer itself (10 of 40 is 1/4 with four rows)
    'per-category': (it, u) => { const [f] = dataKey(it.key); return it.key.startsWith('da2:') && !near(1 / f.length, it.answer) && fits(u, 1 / f.length); },
    'pct-for-dec': (it, u) => { const [f, j] = dataKey(it.key); return it.key.startsWith('da2:') && fits(u, (100 * f[j]) / sum(f)); },
    'bigger-count': (it, u) => {
      const [n1, k1, n2, k2] = dataKey(it.key); const more = k1 > k2 ? 0 : 1;
      // the share of the class with more of them, which is not the larger share
      if (it.key.startsWith('da2b:')) return [k1 / n1, k2 / n2][more] < [k1 / n1, k2 / n2][1 - more] && fits(u, [k1 / n1, k2 / n2][more]);
      if (it.key.startsWith('da2c:')) return u === more && [k1 / n1, k2 / n2][more] <= [k1 / n1, k2 / n2][1 - more] + 1e-9;
      return false;
    },
    'div-by-rel': (it, u) => { const [N, rel] = dataKey(it.key); return it.key.startsWith('da2r:') && fits(u, N / rel); },
    'count-as-pct': (it, u) => {
      const p = it.key.split(':')[0]; const k = dataKey(it.key);
      if (p === 'da3') { const [, ps, x] = k; return fits(u, ps[x]); }
      if (p === 'da3p') { const [rows, x] = k; return fits(u, rows[x]); }
      return false;
    },
    'div-by-pct': (it, u) => { const [N, ps, x] = dataKey(it.key); return it.key.startsWith('da3:') && fits(u, N / ps[x]); },
    'pct-of-part': (it, u) => { const [p, c] = dataKey(it.key); return it.key.startsWith('da3w:') && fits(u, (c * p) / 100); },
    'stop-at-one': (it, u) => { const [p, c] = dataKey(it.key); return it.key.startsWith('da3w:') && fits(u, c / p); },
    // "yes" for three classes' percents that do not add up to one whole
    'pie-not-whole': (it, u) => { const [kind, ps] = dataKey(it.key); return it.key.startsWith('da3o:') && kind === 0 && sum(ps) !== 100 && it.choices[u]?.text === 'כן'; },
    // every kind equally likely: a mistake only where 1/kinds is not the answer itself
    equiprob: (it, u) => { const [c] = dataKey(it.key); return it.key.startsWith('da4:') && !near(1 / c.length, it.answer) && fits(u, 1 / c.length); },
    'old-total': (it, u) => { const [N, p, m] = dataKey(it.key); return it.key.startsWith('da4j:') && fits(u, ((p * N) / 100 + m) / N); },
    'new-not-counted': (it, u) => { const [N, p, m] = dataKey(it.key); return it.key.startsWith('da4j:') && fits(u, ((p * N) / 100) / (N + m)); },
    'old-rel': (it, u) => { const [, p] = dataKey(it.key); return it.key.startsWith('da4j:') && fits(u, p / 100); },
    'rel-not-scaled': (it, u) => {
      const p = it.key.split(':')[0]; const k = dataKey(it.key);
      if (p === 'da4e') { const [, n, w] = k; return fits(u, w / n); }
      if (p === 'da4x') { const [, a, b] = k; return fits(u, a / b); }
      return false;
    },
    'draws-as-count': (it, u) => { const [, , w] = dataKey(it.key); return it.key.startsWith('da4e:') && fits(u, w); },
    // a covered wheel picked wrong after fewer than 100 spins (the object's own counts)
    'small-sample': (it, u) => it.manip?.kind === 'simulate' && !!u && u.pick !== it.answer.answer && u.n < 100,
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
    // stats:6-8 (curriculum stage 3, DATA-5), each read from the question's own numbers (its key)
    // the largest value of the data the question asks about: as given (st6r), or after the change (st6s: M + c, 2M, 1.1M)
    'range-max': (it, u) => {
      if (it.key.startsWith('st6r:')) return fits(u, Math.max(...dataKey(it.key)[0]));
      const st = st6s(it); return !!st && fits(u, st.f(Math.max(...st.vals)));
    },
    // the last value minus the first, the list unsorted
    'first-last': (it, u) => { if (!it.key.startsWith('st6r:')) return false; const v = dataKey(it.key)[0]; return fits(u, Math.abs(v[v.length - 1] - v[0])); },
    // the number added to every value added to the range too
    'shift-range': (it, u) => { const st = st6s(it); return !!st && st.op === 'add' && fits(u, st.r + st.c); },
    // every value multiplied, the range left as it was
    'range-unchanged': (it, u) => { const st = st6s(it); return !!st && st.op !== 'add' && fits(u, st.r); },
    // the old mean: all the values changed (st6m), or one wage raised (st6t)
    'mean-unchanged': (it, u) => {
      if (it.key.startsWith('st6m:')) return fits(u, Number(it.key.split(':')[2]));
      const w = st6t(it); return !!w && fits(u, w.S / w.N);
    },
    // the whole raise added to the mean
    'whole-raise': (it, u) => { const w = st6t(it); return !!w && fits(u, w.S / w.N + w.d); },
    // the jumps' mean with the wind ignored: all five
    'ignore-source': (it, u) => it.key.startsWith('st7j:') && fits(u, sum(dataKey(it.key)[1]) / 5),
    // the legal jumps added (wind at most 2.0) and divided by all five
    'all-count': (it, u) => { if (!it.key.startsWith('st7j:')) return false; const [wind, d] = dataKey(it.key); return fits(u, sum(d.filter((_, i) => wind[i] <= 2)) / 5); },
    // this spring's total (March-May) against last spring's monthly mean
    'total-not-mean': (it, u) => { if (!it.key.startsWith('st7b:')) return false; const [m, seasons] = dataKey(it.key); return fits(u, sum(m.slice(2)) - seasons[1]); },
    // all five months averaged, against last spring's monthly mean
    'all-months': (it, u) => { if (!it.key.startsWith('st7b:')) return false; const [m, seasons] = dataKey(it.key); return fits(u, sum(m) / 5 - seasons[1]); },
    // the pie's percent of the chosen hobby written as the count
    'count-as-pct': (it, u) => { if (!it.key.startsWith('st7p:')) return false; const [, ps, x] = dataKey(it.key); return fits(u, ps[x]); },
    // interpolation: the middle of the two values, the whole difference each year, the steps counted from the other end,
    // the change without the start
    midpoint: (it, u) => { const q = st8i(it); return !!q && fits(u, (q.y1 + q.y2) / 2); },
    'steps-not-scaled': (it, u) => { const q = st8i(it); return !!q && fits(u, q.y1 + q.j * (q.y2 - q.y1)); },
    'wrong-end': (it, u) => { const q = st8i(it); return !!q && fits(u, q.y1 + (q.d - q.j) * q.rate); },
    'no-start': (it, u) => { const q = st8i(it); return !!q && fits(u, Math.abs(q.j * q.rate)); },
    // extrapolation of the tickets (t0 + i·a by 8, 10, 12, 14; s steps of two hours asked): stopped, one step, hours as steps
    'last-value': (it, u) => { const q = st8e(it); return !!q && fits(u, q.t0 + 3 * q.a); },
    'one-step': (it, u) => { const q = st8e(it); return !!q && q.s > 1 && fits(u, q.t0 + 4 * q.a); },
    'hours-as-steps': (it, u) => { const q = st8e(it); return !!q && fits(u, q.t0 + 3 * q.a + 2 * q.s * q.a); },
    // the choice that takes the trend far beyond the data as sure: the value carried on to the age asked, and nothing more
    'far-extrap': (it, u) => {
      if (!it.key.startsWith('st8l:')) return false;
      const [, a, r, t1, T] = it.key.split(':').slice(1).map(Number); const c = it.choices[u];
      return !!c && !c.ok && c.text.startsWith(`${a + r * (T - t1)} `) && !c.text.includes('הגיוני');
    },
  },
  // prob:1-3 (curriculum stage 3, DATA-6), each property from the numbers the student saw (the key). A fraction typed for
  // prob:3 ({ n, d }) is read by its value, which must be the prediction exactly (nothing is rounded in a fraction).
  prob: {
    'count-not-prob': (it, u) => {
      if (it.key.startsWith('pr1:')) { const { k } = pr1(it); return fits(u, k); }
      if (it.key.startsWith('pr1r:')) { const [N, a, b] = nums(it.key); return fits(u, a + N - b + 1); }
      if (it.key.startsWith('pr2p:')) { const [N, a, b, m] = nums(it.key); const blue = (a * N) / b; return fits(u, N - blue - m * blue); }
      return false;
    },
    'one-over-n': (it, u) => it.key.startsWith('pr1:') && fits(u, 1 / pr1(it).n),
    // "it happens or it does not": one half for an event that is not one half
    'equiprob-event': (it, u) => it.key.startsWith('pr1:') && pr1(it).k * 2 !== pr1(it).n && fits(u, 0.5),
    // b to N counted as N − b numbers
    fencepost: (it, u) => {
      if (it.key.startsWith('pr1r:')) { const [N, a, b] = nums(it.key); return fits(u, (a + N - b) / N); }
      // (at t = n/2 the model leaves it out: (n − t)/n is one half, no count of anything)
      if (it.key.startsWith('pr2a:')) { const [n, t] = nums(it.key); return 2 * (n - t) !== n && fits(u, (n - t) / n); }
      return false;
    },
    // the "yes, it still has n sides" choice for a die, a coin or a wheel that is not symmetric
    'no-symmetry': (it, u) => it.key.startsWith('pr1f:') && /^כן, יש/.test(it.choices[u]?.text || ''),
    'same-prob': (it, u) => {
      if (it.key.startsWith('pr2:')) { const { p, x } = pr2(it); return fits(u, p[x]); }
      if (it.key.startsWith('pr2c:')) return fits(u, nums(it.key)[0]);
      return false;
    },
    'hundred-minus': (it, u) => { if (!it.key.startsWith('pr2:')) return false; const { p, x } = pr2(it); return fits(u, 100 - p[x]); },
    'others-given': (it, u) => { if (!it.key.startsWith('pr2:')) return false; const { p, x } = pr2(it); return fits(u, sum(p.filter((_, i) => i !== x))); },
    // only blue taken away: 1 − a/b
    'one-part': (it, u) => { if (!it.key.startsWith('pr2p:')) return false; const [, a, b] = nums(it.key); return fits(u, 1 - a / b); },
    // "less than t" found and not taken from 1
    'complement-only': (it, u) => { if (!it.key.startsWith('pr2a:')) return false; const [n, t] = nums(it.key); return fits(u, (t - 1) / n); },
    // the "due" or the "hot" choice after a run of one side
    gambler: (it, u) => it.key.startsWith('pr2g:') && /תורו|"חם"/.test(it.choices[u]?.text || ''),
    // the forecast read as the part of tomorrow it rains, or as sure
    'outcome-approach': (it, u) => it.key.startsWith('pr2f:') && /מהיום|בטוח/.test(it.choices[u]?.text || ''),
    // two dice thrown many times (100 or more) and the share of a sum picked as one of eleven sums
    'equiprob-sums': (it, u) => (it.key.startsWith('pr3:') && fracIs(u, pr3(it).sums.length / 11))
      || (it.key.startsWith('pr3d:') && u?.n >= 100 && near(pickedValue(it, u), 1 / 11)),
    unordered: (it, u) => {
      if (it.key.startsWith('pr3:')) return fracIs(u, sum(pr3(it).sums.map(pairsOf)) / 36);
      if (it.key.startsWith('pr3o:')) return it.choices[u]?.text === 'תוצאה אחת';
      // the pairs of the sum watched counted without order, over 36, picked after 100 or more throws
      if (it.key.startsWith('pr3d:')) return u?.n >= 100 && near(pickedValue(it, u), pairsOf(it.manip.watch) / 36);
      return false;
    },
    'space-21': (it, u) => it.key.startsWith('pr3:') && fracIs(u, sum(pr3(it).sums.map(pairsOf)) / 21),
    'add-probs': (it, u) => { if (!it.key.startsWith('pr3t:')) return false; const [n1, n2, k1, k2] = it.key.split(':').slice(2).map(Number); return fracIs(u, k1 / n1 + k2 / n2); },
    'one-stage': (it, u) => { if (!it.key.startsWith('pr3t:')) return false; const [, n2, , k2] = it.key.split(':').slice(2).map(Number); return fracIs(u, k2 / n2); },
    // the mixed pair in order, picked over the double: each is one cell of 36
    representativeness: (it, u) => { if (!it.key.startsWith('pr3s:')) return false; const [, a, b] = nums(it.key); return a !== b && it.choices[u]?.text === `${a} ואחר כך ${b}`; },
    // two dice estimated wrong after fewer than 100 throws (the object's own counts)
    'small-sample': (it, u) => it.manip?.kind === 'simulate' && !!u && u.pick !== it.answer.answer && u.n < 100,
  },
  // stage 2's areas and perimeters (content/area.js), from the numbers in each key: ar1r:k:a:b (k 1 is a perimeter),
  // ar1m:k:a:X (X the area, or with k 1 the perimeter), ar1s:k:s, ar1u:k (k even asks an area), ar2l:a:b:at,
  // ar2t:a:b:c:at, ar2x:a:S:c:at (c 0 when no hypotenuse is written), ar2g:b:h:s:out, ar2q:b:h:t, ar2w:b:d:h:PMI (the
  // letters of the perpendicular, the midpoint and the slanted foot), ar3l:W:H:w:h, ar3t:W:H:p:q, ar3k:d1:d2:kite,
  // ar3u:a:b:t, ar3g:x1:y1:x2:y2:x3:y3, ar3m:W:H:w:h:form, ar4p:a:h:s, ar4t:a:b:h:s, ar4i:0:S:a and ar4i:1:S:a:b,
  // ar5l:W:H:w:h, ar5p:0:p:q and ar5p:1:a:b:h, ar5u:a:b, ar5c:w1:h1:w2:h2
  area: {
    perimeter: (it, u) => {
      const k = areaKind(it); const n = nums(it.key);
      if (k === 'ar1r') { const [q, a, b] = n; return q === 0 && near(u, 2 * (a + b)); }
      if (k === 'ar1s') { const [q, s] = n; return q === 0 && near(u, 4 * s); }
      return false;
    },
    'add-sides': (it, u) => {
      const k = areaKind(it); const n = nums(it.key);
      if (k === 'ar1r') { const [q, a, b] = n; return q === 0 && near(u, a + b); }
      if (k === 'ar2l') { const [a, b] = n; return near(u, a + b); }
      return false;
    },
    'area-for-perim': (it, u) => {
      const k = areaKind(it); const n = nums(it.key);
      if (k === 'ar1r') { const [q, a, b] = n; return q === 1 && near(u, a * b); }
      if (k === 'ar1s') { const [q, s] = n; return q === 1 && near(u, s * s); }
      if (k === 'ar5l') { const [W, H, w, h] = n; return near(u, W * H - w * h); }
      return false;
    },
    'two-sides': (it, u) => {
      const k = areaKind(it); const n = nums(it.key);
      if (k === 'ar1r') { const [q, a, b] = n; return q === 1 && near(u, a + b); }
      if (k === 'ar5u') { const [a, b] = n; return fits(u, 100 * a + b); }
      return false;
    },
    'one-side-perim': (it, u) => { const [q, a, X] = nums(it.key); return areaKind(it) === 'ar1m' && q === 1 && near(u, X - a); },
    'perim-as-area': (it, u) => { const [q, a, X] = nums(it.key); return areaKind(it) === 'ar1m' && q === 1 && fits(u, X / a); },
    'no-half': (it, u) => {
      const k = areaKind(it); const n = nums(it.key);
      if (k === 'ar2l' || k === 'ar2t' || k === 'ar2g' || k === 'ar2q') return near(u, n[0] * n[1]); // the legs, or base and height, not halved
      if (k === 'ar2x') { const [a, S] = n; return fits(u, S / a); }
      if (k === 'ar3t') { const [W, H, p, q] = n; return near(u, W * H - p * q); }
      if (k === 'ar4t') { const [a, b, h] = n; return near(u, (a + b) * h); }
      if (k === 'ar4i') { const [q, S, a, b] = n; return q === 1 && fits(u, S / (a + b)); }
      return false;
    },
    'diag-no-half': (it, u) => { const [d1, d2] = nums(it.key); return areaKind(it) === 'ar3k' && near(u, d1 * d2); },
    'div-by-side': (it, u) => { const [a, b, t] = nums(it.key); return areaKind(it) === 'ar3u' && fits(u, (100 * a * b) / t); },
    'half-twice': (it, u) => { const [a, S] = nums(it.key); return areaKind(it) === 'ar2x' && fits(u, S / (2 * a)); },
    'hyp-as-height': (it, u) => {
      const k = areaKind(it); const n = nums(it.key);
      if (k === 'ar2t') { const [a, b, c] = n; return a * a + b * b === c * c && (fits(u, (c * a) / 2) || fits(u, (c * b) / 2)); }
      if (k === 'ar2x') { const [a, S, c] = n; return c > 0 && a * a + ((2 * S) / a) ** 2 === c * c && fits(u, (2 * S) / c); }
      return false;
    },
    'slant-as-height': (it, u) => {
      const k = areaKind(it); const n = nums(it.key);
      if (k === 'ar2g') { const [b, h, s] = n; return s > h && fits(u, (b * s) / 2); }
      if (k === 'ar4p') { const [a, h, s] = n; return s > h && near(u, a * s); }
      if (k === 'ar4t') { const [a, b, h, s] = n; return s > h && fits(u, ((a + b) * s) / 2); }
      return false;
    },
    // a choice: the slanted segment inside the obtuse triangle, which is neither the height nor the median
    'inside-height': (it, u) => { const letters = it.key.split(':')[4] || ''; return areaKind(it) === 'ar2w' && chosen(it, u) === `A${letters[2]}`; },
    'no-subtract': (it, u) => {
      const k = areaKind(it); const n = nums(it.key);
      if (k === 'ar3l' || k === 'ar3t') return near(u, n[0] * n[1]);
      if (k === 'ar3g') { const xs = [n[0], n[2], n[4]]; const ys = [n[1], n[3], n[5]]; return near(u, (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys))); }
      return false;
    },
    'double-count': (it, u) => {
      const k = areaKind(it); const [W, H, w, h] = nums(it.key); const twice = W * (H - h) + (W - w) * H;
      if (k === 'ar3l') return near(u, twice);
      if (k === 'ar3m') { const t = chosen(it, u); return !!t && near(evaluate(texToExpr(t)), twice); }
      return false;
    },
    'one-base': (it, u) => { const [a, b, h] = nums(it.key); return areaKind(it) === 'ar4t' && a > b && near(u, a * h); },
    'half-para': (it, u) => {
      const k = areaKind(it); const n = nums(it.key);
      if (k === 'ar4p') { const [a, h] = n; return fits(u, (a * h) / 2); }
      if (k === 'ar4i') { const [q, S, a] = n; return q === 0 && fits(u, (2 * S) / a); }
      return false;
    },
    'missing-sides': (it, u) => {
      const k = areaKind(it); const n = nums(it.key);
      if (k === 'ar5l') return near(u, sum(n)); // W + H + w + h: only the sides with a number
      if (k === 'ar5p') return n[0] === 0 ? near(u, n[1] + n[2]) : near(u, n[1] + n[2] + n[3]);
      return false;
    },
    'add-legs': (it, u) => {
      const [q, a, b, h] = nums(it.key);
      if (areaKind(it) !== 'ar5p') return false;
      return q === 0 ? near(u, 2 * (a + b)) : near(u, a + b + h + (a - b) + h); // the hypotenuse taken as its two legs together
    },
    'no-convert': (it, u) => { const [a, b] = nums(it.key); return areaKind(it) === 'ar5u' && fits(u, 2 * (a + b)); },
    'same-perim-same-area': (it, u) => {
      const [w1, h1, w2, h2] = nums(it.key);
      return areaKind(it) === 'ar5c' && w1 + h1 === w2 + h2 && w1 * h1 !== w2 * h2 && it.choices[u]?.text === 'השטחים שווים';
    },
    'unit-mix': (it, u) => {
      if (areaKind(it) !== 'ar1u') return false;
      const [k] = nums(it.key); const t = it.choices[u]?.text;
      return k % 2 === 0 ? ['מ׳', 'ס״מ'].includes(t) : ['מ״ר', 'סמ״ר'].includes(t); // a length unit for an area, or the other way
    },
  },
};
/** The kind of an area item: its key's prefix. */
const areaKind = (it) => it.key.split(':')[0];
const surfOf = (a, b, c) => 2 * (a * b + b * c + a * c);
/**
 * Stage 2's boxes and prisms (content/solid.js, not on the path yet), from the numbers in each key: so1s:a:b:c,
 * so1c:k:s (k 1 asks the edge), so1e:a:b:c, so1o:a:b:c (the opening a by b), so1n:layout:shade, so2v:a:b:c, so2m:V:a:b,
 * so2c:k:s (k 1 asks the edge), so2l:0:a:b:c (litres) and so2l:1:a:b:L (the water's height), so2f:e:a:b:c, so3s:p:q:c:L,
 * so3h:p:q:L, so3i:b:h:s:L, so4v:p:q:c:L, so4a:b:h:s:L, so4m:V:p:q, so4h:a:b:c, so4k:k
 */
PROPS.solid = {
  'three-faces': (it, u) => { const [a, b, c] = nums(it.key); return areaKind(it) === 'so1s' && fits(u, a * b + b * c + a * c); },
  'vol-for-surf': (it, u) => {
    const k = areaKind(it); const n = nums(it.key);
    if (k === 'so1s' || k === 'so1o') { const [a, b, c] = n; return fits(u, a * b * c); }
    if (k === 'so1c') { const [q, s] = n; return q === 0 && fits(u, s ** 3); }
    return false;
  },
  'three-edges': (it, u) => { const [a, b, c] = nums(it.key); return areaKind(it) === 'so1e' && fits(u, a + b + c); },
  'lid-counted': (it, u) => { const [a, b, c] = nums(it.key); return areaKind(it) === 'so1o' && fits(u, surfOf(a, b, c)); },
  'no-root': (it, u) => { const [q, s] = nums(it.key); return areaKind(it) === 'so1c' && q === 1 && fits(u, s * s); },
  // a face beside the shaded one: not the face opposite it on the cube, and not the shaded one itself
  'opposite-adjacent': (it, u) => {
    const [, layout, shade] = it.key.split(':');
    return areaKind(it) === 'so1n' && !!u?.face && u.face !== shade && u.face !== CUBE_OPPOSITE[layout][shade];
  },
  'surf-for-vol': (it, u) => {
    const k = areaKind(it); const n = nums(it.key);
    if (k === 'so2v') { const [a, b, c] = n; return fits(u, surfOf(a, b, c)); }
    if (k === 'so2l') { const [q, a, b, c] = n; return q === 0 && fits(u, surfOf(a, b, c) / 1000); }
    return false;
  },
  'add-edges': (it, u) => { const [a, b, c] = nums(it.key); return areaKind(it) === 'so2v' && fits(u, a + b + c); },
  'one-divide': (it, u) => { const [V, a, b] = nums(it.key); return areaKind(it) === 'so2m' && (fits(u, V / a) || fits(u, V / b)); },
  'cube-times3': (it, u) => { const [q, s] = nums(it.key); return areaKind(it) === 'so2c' && fits(u, q === 0 ? 3 * s : s ** 3 / 3); },
  'square-not-cube': (it, u) => { const [q, s] = nums(it.key); return areaKind(it) === 'so2c' && q === 0 && fits(u, s * s); },
  'no-convert': (it, u) => {
    if (areaKind(it) !== 'so2l') return false;
    const [q, a, b, x] = nums(it.key); return q === 0 ? fits(u, a * b * x) : fits(u, x / (a * b));
  },
  'div-by-edge': (it, u) => { const [e, a, b, c] = nums(it.key); return areaKind(it) === 'so2f' && fits(u, (a * b * c) / e); },
  'one-base': (it, u) => {
    const k = areaKind(it); const n = nums(it.key);
    if (k === 'so3s') { const [p, q, c, L] = n; return fits(u, (p * q) / 2 + L * (p + q + c)); }
    if (k === 'so3i') { const [b, h, s, L] = n; return fits(u, (b * h) / 2 + L * (b + 2 * s)); }
    return false;
  },
  'missing-face': (it, u) => {
    const k = areaKind(it); const n = nums(it.key);
    if (k === 'so3s') { const [p, q, , L] = n; return fits(u, p * q + L * (p + q)); }
    if (k === 'so3h') { const [p, q, L] = n; return fits(u, p * q + L * (p + q)); }
    return false;
  },
  'slant-as-height': (it, u) => {
    const k = areaKind(it); const n = nums(it.key);
    if (k === 'so3i') { const [b, , s, L] = n; return fits(u, b * s + L * (b + 2 * s)); }
    if (k === 'so4a') { const [b, , s, L] = n; return fits(u, (b * s * L) / 2); }
    return false;
  },
  // the hypotenuse taken as the sum of the legs: the third face as wide as p + q
  'add-legs': (it, u) => { const [p, q, L] = nums(it.key); return areaKind(it) === 'so3h' && fits(u, p * q + L * (p + q + p + q)); },
  'no-half': (it, u) => {
    const k = areaKind(it); const n = nums(it.key);
    if (k === 'so4v') { const [p, q, , L] = n; return fits(u, p * q * L); }
    if (k === 'so4a') { const [b, h, , L] = n; return fits(u, b * h * L); }
    if (k === 'so4m') { const [V, p, q] = n; return fits(u, V / (p * q)); }
    if (k === 'so4h') { const [a, b, c] = n; return fits(u, a * b * c); }
    return false;
  },
  'hyp-as-height': (it, u) => { const [p, , c, L] = nums(it.key); return areaKind(it) === 'so4v' && fits(u, (p * c * L) / 2); },
  'linear-volume': (it, u) => { const [k] = nums(it.key); return areaKind(it) === 'so4k' && fits(u, k); },
  'square-scale': (it, u) => { const [k] = nums(it.key); return areaKind(it) === 'so4k' && fits(u, k * k); },
};
/**
 * Stage 2's circle, cylinder and cone (content/circle.js), from the numbers in each key: ci1p:k:r
 * (k 1 asks the radius from 2r·π), ci1n:g:v (g 0 the diameter v, g 1 the radius v; π ≈ 3.14), ci1r:c, ci1w:r:n,
 * ci2p:k:r (k 1 gives the diameter 2r), ci2n:r, ci2h:q:r (q 1 a quarter), ci2r:r:w, ci3v:r:h, ci3l:r:h, ci3s:r:h,
 * ci3f:B:L, ci3m:a:b, ci4v:r:h:l, ci4h:r:l, ci4a:g:r:h, ci4c:V, ci4m:r:h. A π ≈ 3.14 question's mistake is its multiple of
 * π computed with 3.14 or with the calculator's π, to tenths (piNear), the "3.14 and π versions".
 */
PROPS.circle = {
  'r-for-d': (it, u) => {
    const k = areaKind(it); const n = nums(it.key);
    if (k === 'ci1p') { const [q, r] = n; return q === 0 && fits(u, r); }
    if (k === 'ci1n') { const [g, v] = n; return g === 1 && piNear(u, v); }
    if (k === 'ci1w') { const [r, t] = n; return piNear(u, r * t); }
    if (k === 'ci3l') { const [r, h] = n; return fits(u, r * h); }
    if (k === 'ci4a') { const [, r, h] = n; return fits(u, (r * h) / 2); }
    return false;
  },
  'd-for-r': (it, u) => {
    const k = areaKind(it); const n = nums(it.key);
    if (k === 'ci1p') { const [q, r] = n; return q === 1 && fits(u, 2 * r); }
    if (k === 'ci1r') return fits(u, n[0]);
    if (k === 'ci1n') { const [g, v] = n; return g === 0 && piNear(u, 2 * v); }
    return false;
  },
  'area-for-circ': (it, u) => {
    const k = areaKind(it); const n = nums(it.key);
    if (k === 'ci1p') { const [q, r] = n; return q === 0 && fits(u, r * r); }
    if (k === 'ci1n') { const [g, v] = n; return piNear(u, g ? v * v : (v / 2) ** 2); }
    if (k === 'ci3l') { const [r, h] = n; return fits(u, r * r * h); }
    return false;
  },
  'circ-for-area': (it, u) => {
    const k = areaKind(it); const n = nums(it.key);
    if (k === 'ci2p') return fits(u, 2 * n[1]);
    if (k === 'ci2n') return piNear(u, 2 * n[0]);
    return false;
  },
  'd-in-area': (it, u) => {
    const k = areaKind(it); const n = nums(it.key);
    if (k === 'ci2p') { const [q, r] = n; return q === 1 && fits(u, 4 * r * r); }
    if (k === 'ci3v') { const [r, h] = n; return fits(u, 4 * r * r * h); }
    return false;
  },
  'whole-circle': (it, u) => { const [, r] = nums(it.key); return areaKind(it) === 'ci2h' && fits(u, r * r); },
  'ring-sub-radii': (it, u) => { const [, w] = nums(it.key); return areaKind(it) === 'ci2r' && fits(u, w * w); },
  'no-subtract': (it, u) => { const [r, w] = nums(it.key); return areaKind(it) === 'ci2r' && fits(u, (r + w) ** 2); },
  'lateral-for-vol': (it, u) => { const [r, h] = nums(it.key); return areaKind(it) === 'ci3v' && fits(u, 2 * r * h); },
  'one-base': (it, u) => { const [r, h] = nums(it.key); return areaKind(it) === 'ci3s' && fits(u, r * r + 2 * r * h); },
  'no-bases': (it, u) => { const [r, h] = nums(it.key); return areaKind(it) === 'ci3s' && fits(u, 2 * r * h); },
  'no-convert': (it, u) => { const [B, L] = nums(it.key); return areaKind(it) === 'ci3f' && fits(u, L / B); },
  'no-third': (it, u) => {
    const k = areaKind(it); const n = nums(it.key);
    if (k === 'ci4v') { const [r, h] = n; return fits(u, r * r * h); }
    if (k === 'ci4c') return fits(u, n[0]);
    if (k === 'ci4m') return it.choices[u]?.tex === '1';
    return false;
  },
  'slant-as-height': (it, u) => { const [r, , l] = nums(it.key); return areaKind(it) === 'ci4v' && fits(u, (r * r * l) / 3); },
  'add-not-sub': (it, u) => { const [r, l] = nums(it.key); return areaKind(it) === 'ci4h' && fits(u, Math.sqrt(l * l + r * r)); },
  'subtract-sides': (it, u) => { const [r, l] = nums(it.key); return areaKind(it) === 'ci4h' && fits(u, l - r); },
  'no-half': (it, u) => { const [, r, h] = nums(it.key); return areaKind(it) === 'ci4a' && fits(u, 2 * r * h); },
  'same-sheet': (it, u) => areaKind(it) === 'ci3m' && it.choices[u]?.text === 'לשניהם אותו נפח',
};
/**
 * Stage 2's Pythagoras in space (content/space.js), from the numbers in each key: sp1s:a:b:c, sp1f:a:b:c (the base a by
 * b), sp1c:s, sp1m:a:b:d (the height asked), sp1w (the segments' corners), sp2r:g:d:h (g 1 gives the diameter d, g 0 its
 * radius), sp2t:a:b:c, sp2v:r:l (the height not written), sp2p:a:b:L, sp2m:r:h. A length that is not whole is matched
 * to tenths (fits).
 */
const hyp = (...xs) => Math.sqrt(xs.reduce((s, x) => s + x * x, 0));
PROPS.space = {
  'face-for-space': (it, u) => {
    const k = areaKind(it); const n = nums(it.key);
    if (k === 'sp1s') { const [a, b] = n; return fits(u, hyp(a, b)); }
    if (k === 'sp1c') return fits(u, n[0] * Math.SQRT2);
    return false;
  },
  'add-edges3': (it, u) => {
    const k = areaKind(it); const n = nums(it.key);
    if (k === 'sp1s') { const [a, b, c] = n; return fits(u, a + b + c); }
    if (k === 'sp1c') return fits(u, 3 * n[0]);
    return false;
  },
  'no-root': (it, u) => {
    const k = areaKind(it); const [a, b, c] = nums(it.key);
    if (k === 'sp1s') return fits(u, a * a + b * b + c * c);
    if (k === 'sp1f') return fits(u, a * a + b * b);
    return false;
  },
  'add-not-sub': (it, u) => { const [a, b, d] = nums(it.key); return areaKind(it) === 'sp1m' && fits(u, hyp(d, a, b)); },
  'which-diagonal': (it, u) => areaKind(it) === 'sp1w' && !!it.choices[u] && !it.choices[u].ok,
  'add-legs': (it, u) => {
    const k = areaKind(it); const n = nums(it.key);
    if (k === 'sp1f') { const [a, b] = n; return fits(u, a + b); }
    if (k === 'sp2r') { const [, d, h] = n; return fits(u, d + h); }
    if (k === 'sp2t') { const [a, b, c] = n; return fits(u, ((a + b) * c) / 2); }
    if (k === 'sp2p') { const [a, b, L] = n; return fits(u, (a + b) * L); }
    return false;
  },
  'r-for-d': (it, u) => { const [, d, h] = nums(it.key); return areaKind(it) === 'sp2r' && fits(u, hyp(d / 2, h)); },
  'no-half': (it, u) => { const [a, b, c] = nums(it.key); return areaKind(it) === 'sp2t' && fits(u, hyp(a, b) * c); },
  'no-third': (it, u) => { const [r, l] = nums(it.key); return areaKind(it) === 'sp2v' && fits(u, (r * r * Math.sqrt(l * l - r * r))); },
  'slant-as-height': (it, u) => { const [r, l] = nums(it.key); return areaKind(it) === 'sp2v' && fits(u, (r * r * l) / 3); },
};

/** prob:1 eventK's numbers from its key: n outcomes, and k of them that fit the event (even, more than t, a multiple of t, t or less). */
function pr1(it) {
  const [, n, e, t] = it.key.split(':'); const N = Number(n); const T = Number(t);
  const ok = { even: (v) => v % 2 === 0, gt: (v) => v > T, mult: (v) => v % T === 0, le: (v) => v <= T }[e];
  return { n: N, k: Array.from({ length: N }, (_, i) => i + 1).filter(ok).length };
}
/** prob:2 notA's probabilities (red, blue, yellow) and the colour asked about. */
function pr2(it) { const [, ps, x] = it.key.split(':'); return { p: ps.split(',').map(Number), x: Number(x) }; }
/** prob:3 diceSum's sums asked about: one sum, t or more, or t or less. */
function pr3(it) {
  const [, e, t] = it.key.split(':'); const T = Number(t);
  return { sums: Array.from({ length: 11 }, (_, i) => i + 2).filter((s) => (e === 'sum' ? s === T : e === 'ge' ? s >= T : s <= T)) };
}
/** The pairs of two dice with sum s, order not counted ((5, 6) once). */
const pairsOf = (s) => { let c = 0; for (let x = 1; x <= 6; x += 1) for (let y = x; y <= 6; y += 1) if (x + y === s) c += 1; return c; };
/** The value of the choice picked in a simulate estimate ({ pick }): \frac{1}{11} is 1/11. */
const pickedValue = (it, u) => {
  const c = it.answer?.choices?.[u?.pick]; const m = String(typeof c === 'string' ? c : c?.tex || '').match(/\\frac\{(\d+)\}\{(\d+)\}/);
  return m ? Number(m[1]) / Number(m[2]) : NaN;
};
/** A typed fraction ({ n, d }) whose value is exactly v. */
const fracIs = (u, v) => !!u && typeof u === 'object' && u.d !== 0 && near(u.n / u.d, v, 1e-9);
/** stats:6 shiftRange's numbers from its key: the change, the values, the number added, the range, and the change as f. */
function st6s(it) {
  if (!it.key.startsWith('st6s:')) return null;
  const [op, list, c] = it.key.split(':').slice(1); const vals = list.split(',').map(Number);
  const f = op === 'add' ? (v) => v + Number(c) : op === 'x2' ? (v) => 2 * v : (v) => 1.1 * v;
  return { op, vals, c: Number(c), r: Math.max(...vals) - Math.min(...vals), f };
}
/** stats:6 raise's numbers: the sum of the wages and the number of workers, and the raise. */
function st6t(it) {
  if (!it.key.startsWith('st6t:')) return null;
  const [a, b, w1, w2, M, d] = nums(it.key); return { S: a * w1 + b * w2 + M, N: a + b + 1, d };
}
/** stats:8 interp's numbers: the years apart, the year asked, the change a year, the first value (and the second). */
function st8i(it) {
  if (!it.key.startsWith('st8i:')) return null;
  const [d, j, rate, y1] = nums(it.key); return { d, j, rate, y1, y2: y1 + d * rate };
}
/** stats:8 extrap's numbers: the tickets by 8:00, the rise every two hours, the steps asked. */
function st8e(it) {
  if (!it.key.startsWith('st8e:')) return null;
  const [t0, a, s] = nums(it.key); return { t0, a, s };
}

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

/**
 * Each stair's questions are drawn once and shared by the two properties below: DRAWS draws, at most SCAN_DISTINCT
 * different questions (a stair with few questions is covered whole), every wrong answer of the sample tried, and the
 * names its diagnosis gives kept with it (makeItem: one name, or several when their predictions are the same number).
 * The suite runs 300 different questions a stair. The deep run PRODUCT2-15 asks for, 2,000 different questions a stair
 * (out of up to 8,000 draws; a stair with fewer is covered whole), is
 *   LABELS_DISTINCT=2000 npx vitest run src/content/labels.test.js
 * It takes about three minutes, so it is a step of its own in CI (.github/workflows/ci.yml, job web), not part of every
 * local run. QA_STUDENT.md records what it found the first time (the three cases pinned at the end of this file).
 */
const DEEP = Number(process.env.LABELS_DISTINCT) || 0;
const SCAN_DISTINCT = DEEP || 300;
const DRAWS = DEEP ? Math.max(2000, 4 * DEEP) : 2000;
const SCAN_MS = DEEP ? 1_800_000 : 120_000;
const scans = new Map();
const sampleCache = new Map();
/** The wrong answers to try (labels.sample.js), kept once per form where they do not depend on the question. */
function triesOf(item) {
  const k = item.form === 'num' ? (item.topic === 'ratio' ? null : 'num') : ['pt', 'line', 'lin', 'frac'].includes(item.form) ? item.form : null;
  if (!k) return candidates(item);
  if (!sampleCache.has(k)) sampleCache.set(k, candidates(item));
  return sampleCache.get(k);
}
function scanOf(topic, level) {
  const key = `${topic}:${level}`;
  if (scans.has(key)) return scans.get(key);
  const seen = new Set(); const named = []; const kinds = {};
  // the same sample on every run (the generators draw with Math.random)
  const realRandom = Math.random; Math.random = seeded(20261111 + level);
  try { for (let k = 0; k < DRAWS && seen.size < SCAN_DISTINCT; k += 1) {
    const item = makeItem(topic, level);
    if (seen.has(item.key)) continue;
    seen.add(item.key);
    // a kind of question: its generator (the key's prefix) and its form (lf2 asks a choice or a number)
    const kind = `${item.key.split(':')[0]}|${item.form}`;
    kinds[kind] ||= new Set();
    for (const u of triesOf(item)) {
      const d = item.diagnosis(u);
      if (!d) continue;
      const ids = d.candidates.map((c) => c.id);
      ids.forEach((id) => kinds[kind].add(id));
      named.push({ item, u, ids, ambiguous: d.ambiguous, kind });
    }
  } } finally { Math.random = realRandom; }
  const out = { named, kinds };
  scans.set(key, out);
  return out;
}
const show = (x) => `${x.item.topic}:${x.item.level} ${x.item.key}: answer ${JSON.stringify(x.u)}`;
/** Does a property hold? One written for another shape of the same kind of question (a story the reader cannot parse) does not. */
const holdsFor = (prop, item, u) => { try { return prop?.(item, u) === true; } catch { return false; } };

describe('every mistake label describes the answer', () => {
  TOPICS.forEach((t) => {
    t.levels.forEach((L, i) => {
      const level = i + 1;
      it(`${t.id} level ${level}: ${L.title}`, () => {
        for (const x of scanOf(t.id, level).named) {
          // the first name is the one diag() gives (the lesson counts it), and every other name holds too
          expect(x.item.diag(x.u), show(x)).toBe(x.ids[0]);
          for (const cat of x.ids) {
            const prop = PROPS[t.id]?.[cat];
            expect(prop, `${t.id}:${level} returns '${cat}', which has no property here`).toBeTruthy();
            expect(prop(x.item, x.u), `${show(x)} labelled '${cat}' (${catLabel(t.id, level, cat)})`).toBe(true);
            // the words shown to the student exist for this stair
            expect(catLabel(t.id, level, cat), `${t.id}:${level} '${cat}' has no words`).toBeTruthy();
          }
        }
      }, SCAN_MS);
    });
  });
});

/**
 * PRODUCT2-15: two mistakes that predict the same answer are never named as one of them by chance. For every wrong
 * answer a question's diagnosis names, every other mistake the same kind of question can name (its key's prefix) and
 * whose property holds for that answer must be named too: the answer is then ambiguous, as a diagnostic model reports
 * it. The one exception is the stair's own mistake (its level's flagship), which names an answer it predicts alone.
 * signed:1 before this: −4 − (−11) answered −15 was named "adding the distances" only, though it is exactly
 * subtracting the negative as a positive.
 */
describe('an answer two mistakes explain is never named as one of them by chance', () => {
  TOPICS.forEach((t) => {
    t.levels.forEach((L, i) => {
      const level = i + 1;
      it(`${t.id} level ${level}: ${L.title}`, () => {
        const { named, kinds } = scanOf(t.id, level);
        const silent = [];
        for (const x of named) {
          if (L.flagship && x.ids.length === 1 && x.ids[0] === L.flagship) continue;
          const also = [...kinds[x.kind]].filter((c) => !x.ids.includes(c) && holdsFor(PROPS[t.id]?.[c], x.item, x.u));
          if (also.length) silent.push(`${show(x)} named ${x.ids.join(' + ')}, also ${also.join(' + ')}`);
        }
        expect(silent.slice(0, 5), `${silent.length} answers`).toEqual([]);
      }, SCAN_MS);
    });
  });
});

describe('the flagship mistake of signed:1 (PRODUCT2-12)', () => {
  it('−4 − (−11) answered −15 is recorded as minus-minus only, and the line names it', () => {
    // subtracting −11 as if it were 11; adding the distances (abs-add) gives −15 too, and the stair's own mistake names it
    const it = find('signed', 1, (x) => x.key === 'sn1:-4 - (-11)', 200000);
    expect(it.answer).toBe(7);
    expect(recorded(it, -15)).toEqual({ cat: 'minus-minus', miscon: ['signed:1|minus-minus'] });
    // where only adding the distances gives the number (3 + (−8) answered 11), it is still named
    const add = find('signed', 1, (x) => x.key === 'sn1:3 + (-8)', 200000);
    expect(recorded(add, 11)).toEqual({ cat: 'abs-add', miscon: ['signed:1|abs-add'] });
  });
  it('an answer two mistakes give in brackets is recorded as both, half each', () => {
    // 7 − (8 − 1) · (−1) = 14: 0 is the subtraction done first, (7 − 7) · (−1), and the product −7 subtracted as 7
    const it = find('signed', 5, (x) => x.key === 'sn5:7 - (8 - 1) \\cdot (-1)', 400000);
    expect(it.answer).toBe(14);
    const d = it.diagnosis(0);
    expect(d).toMatchObject({ kind: 'misconception', ambiguous: true });
    expect(d.candidates.map((c) => c.id).sort()).toEqual(['minus-minus', 'order']);
    expect(recorded(it, 0).miscon.sort()).toEqual(['signed:5|minus-minus', 'signed:5|order']);
  });
});

// The whole-content check of curriculum stage 3 (content/stage3.test.js reads the rest of each exercise): every label
// of 2,000 exercises of each of the ten new stairs against its property, with the wrong answers that reach every
// prediction as a student types it (labels.sample.js nearCandidates), not the wide sample above.
describe('curriculum stage 3: every label of 2,000 exercises a stair describes the answer', () => {
  const LEVELS = [['data', 1], ['data', 2], ['data', 3], ['data', 4], ['stats', 6], ['stats', 7], ['stats', 8], ['prob', 1], ['prob', 2], ['prob', 3]];
  it.each(LEVELS)('%s:%i', (topic, level) => {
    const seen = new Set(); const wrong = [];
    for (let k = 0; k < 2000 && wrong.length < 10; k += 1) {
      const item = makeItem(topic, level);
      for (const u of nearCandidates(item)) {
        if (isCorrect(item, u)) continue;
        const cat = item.diag(u);
        if (!cat) continue;
        seen.add(cat);
        const prop = PROPS[topic]?.[cat];
        if (!prop) wrong.push(`${topic}:${level} returns '${cat}', which has no property here`);
        else if (!prop(item, u)) wrong.push(`${topic}:${level} ${item.key}: answer ${JSON.stringify(u)} labelled '${cat}' (${catLabel(topic, level, cat)})`);
      }
    }
    expect(wrong).toEqual([]);
    // the stair's exercises name what its category list promises (none is unreachable from practice)
    expect(seen.size, `${topic}:${level} names ${[...seen].join(', ')}`).toBeGreaterThan(1);
  }, 120_000);
});

// Stage 2's topics are on the path (the loop above samples them through makeItem); here their generators are sampled
// once more straight from the topic objects, as makeItem would give them (an answer that is right is never a mistake),
// with the words from their own cats, and each level must name some mistake.
const ITEMS_PER_LEVEL = 60;
describe('every mistake label describes the answer: sampled from the topic objects of stage 2', () => {
  for (const T of [AREA, SOLID, CIRCLE, SPACE]) {
    T.levels.forEach((L, i) => {
      const level = i + 1;
      it(`${T.id} level ${level}: ${L.title}`, () => {
        const named = new Set();
        for (let k = 0; k < ITEMS_PER_LEVEL; k += 1) {
          const raw = L.gen(); const item = { ...raw, topic: T.id, level, diag: (u) => (isCorrect(raw, u) ? null : raw.diag(u)) };
          for (const u of candidates(item)) {
            if (isCorrect(item, u)) continue;
            const cats = item.diag(u);
            if (!cats) continue;
            // one mistake, or each of several whose predictions are the same number (PRODUCT2-15)
            for (const cat of [cats].flat()) {
              named.add(cat);
              const prop = PROPS[T.id][cat];
              expect(prop, `${T.id}:${level} returns '${cat}', which has no property here`).toBeTruthy();
              expect(prop(item, u), `${T.id}:${level} ${item.key}: answer ${JSON.stringify(u)} labelled '${cat}' (${T.cats[cat]})`).toBe(true);
              expect(T.cats[cat], `${T.id}:${level} '${cat}' has no words`).toBeTruthy();
            }
          }
        }
        expect(named.size, `${T.id}:${level} names some mistake`).toBeGreaterThan(0);
      });
    });
  }
});

describe('the algebra, fraction, ratio, percent, function, data, probability and measurement topics name only what a property can check', () => {
  it('every category of expressions, equations, systems, fractions, ratio, percent, functions, data, probability and the four measurement units has its property here', () => {
    for (const t of [EXPR, EQ, SYS, FRAC, RATIO, PCT, FUNC, DATA, PROB, AREA, SOLID, CIRCLE, SPACE]) for (const cat of Object.keys(t.cats)) expect(PROPS[t.id][cat], `${t.id} '${cat}'`).toBeTypeOf('function');
  });
  it('every category of statistics stairs 6-8 has its property here', () => {
    for (const cat of Object.keys(STATS2_CATS)) expect(PROPS.stats[cat], `stats '${cat}'`).toBeTypeOf('function');
  });
  it('every category of the geometry units (curriculum stage 4: transformations, congruence, similarity) has its property here', () => {
    for (const cat of Object.keys(TRANSF.cats)) expect(PROPS.transf[cat], `transf '${cat}'`).toBeTypeOf('function');
    expect(Object.keys(TRANSF.cats)).toHaveLength(15);
    // congruence: every category but 'no-half', which only the kite transfer model predicts (no exercise names it)
    for (const cat of Object.keys(CONGR.cats)) if (cat !== 'no-half') expect(PROPS.congr[cat], `congr '${cat}'`).toBeTypeOf('function');
    expect(Object.keys(CONGR.cats)).toHaveLength(20);
    // similarity: every category, the practice-choice tags (converse-equal, angles-enough, order-mixed, third-angle) too
    for (const cat of Object.keys(SIM.cats)) expect(PROPS.sim[cat], `sim '${cat}'`).toBeTypeOf('function');
    expect(Object.keys(SIM.cats)).toHaveLength(14);
  });
  it('a number near a prediction is not that mistake unless it is the prediction rounded', () => {
    // x : 2 = 9 moved over as a division gives 4.5: 4.5 is that mistake, 4.45 and 4.55 are not
    const it = find('eq', 1, (x) => x.key === 'eq1:\\frac{x}{2} = 9' || x.key === 'eq1:x : 2 = 9', 400000);
    expect(it.diag(4.5)).toBe('move-no-flip');
    expect(it.diag(4.45)).toBe(null);
    expect(it.diag(4.55)).toBe(null);
  });
});

/**
 * A stair's item drawn from a fixed list of Math.random values, in the order the generator asks for them (it throws when
 * the generator asks for more): the same item every run, however rare it is among random draws.
 */
function drawnFrom(values, topic, level) {
  const real = Math.random; const queue = [...values];
  Math.random = () => { if (!queue.length) throw new Error('the generator asked for more random numbers'); return queue.shift(); };
  try { return makeItem(topic, level); } finally { Math.random = real; }
}
/** The Math.random value that makes R(lo, hi) (content/util.js) give v. */
const drawOf = (v, lo, hi) => (v - lo + 0.5) / (hi - lo + 1);
/** signed:5's brackets question a − (b − c) · d, as makeItem gives it: the stair picks brackets() (a draw under 0.6). */
const signedBrackets = (a, b, c, d) => drawnFrom([0, drawOf(a, -10, 10), drawOf(b, -8, 8), drawOf(c, -8, 8), drawOf(d, -4, 4)], 'signed', 5);

// PRODUCT2-15 at its full depth: the first run over 2,000 questions a stair found three answers named as one mistake
// where another fits too. The 300-question sample of every run does not draw them, so each is pinned by its own numbers.
describe('coincidences found only at 2,000 questions a stair', () => {
  it('eq:2: the coefficient multiplied across is named (move-no-flip), also where "only x divided" gives the same number', () => {
    // −8 = −4x − 6 (x = 0.5): −4x = −2 "moved" as a multiplication gives 8; dividing only x gives 2 − (−6) = 8 as well
    const d = diagOf(0.5, twoStepBugs({ k: 1, a: -4, b: -6, c: -8, x: 0.5 }));
    expect(d(8)).toEqual(['move-no-flip', 'divide-part']);
    expect(d(3.5)).toBe('move-no-flip'); // the number moved keeping its sign: (−8 − 6) : (−4)
    // 3x + 4 = 10 (x = 2): 3x = 6 answered 18, as stair 1 names it for ax = b; 8 = 4x + 10: both again
    expect(diagOf(2, twoStepBugs({ k: 0, a: 3, b: 4, c: 10, x: 2 }))(18)).toBe('move-no-flip');
    expect(diagOf(-0.5, twoStepBugs({ k: 1, a: 4, b: 10, c: 8, x: -0.5 }))(-8)).toEqual(['move-no-flip', 'divide-part']);
    // x − 5 = 3: a coefficient of 1 has nothing to multiply by
    expect(diagOf(8, twoStepBugs({ k: 0, a: 1, b: -5, c: 3, x: 8 }))(8)).toBe(null);
  });
  it('eq:3: an answer that is one mistake\'s own number and another\'s rounding names both, the exact one first', () => {
    // −2x + 11 = −7x − 39 (x = −10): the number moved keeping its sign gives −28/5 = −5.6; the x-term moved keeping
    // its sign gives −50/9 = −5.55…, which a student types as −5.6
    const d = diagOf(-10, { 'move-no-flip': -28 / 5, 'move-x-no-flip': [50 / 9, -50 / 9] });
    expect(d(-5.6)).toEqual(['move-no-flip', 'move-x-no-flip']);
    expect(d(-5.56)).toBe('move-x-no-flip');
    expect(d(5.6)).toBe('move-x-no-flip');
    expect(d(-5.5)).toBe(null); // near, and not its rounding
  });
  it('sys:3: the constants added instead of subtracted is named whichever unknown the student made go', () => {
    // −4x + 2y = −20, −x − 2y = −10, solution (6, 2): the worked solution adds, and y goes. A student who makes x go
    // (the second equation times 4) and adds the constants gets 10y = ∓60. The swapped pair (2, 6) is that too
    expect(minusBracketValues([-4, 2, -20], [-1, -2, -10])).toEqual([[], [-6, 6]]);
    // equal coefficients of y, the worked solution's way: 5x + 2y = 19, 3x + 2y = 13 with the constants added, 2x = ±32
    expect(minusBracketValues([5, 2, 19], [3, 2, 13])).toEqual([[16, -16], []]);
    // opposite coefficients are added, and coefficients with no whole multiple are not made equal in one step
    expect(minusBracketValues([3, 2, 19], [2, -2, 13])).toEqual([[], []]);
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
    const it = signedBrackets(6, 2, 3, -3);
    expect(it.key).toBe('sn5:6 - (2 - 3) \\cdot (-3)');
    expect(it.answer).toBe(3);
    const r = recorded(it, 9);
    expect(r.cat).not.toBe('minus-minus');
    expect(r.miscon).not.toContain('signed:5|minus-minus');
  });

  it('a negative product subtracted as if positive is "minus-minus"', () => {
    // 6 − (2 − 3)·3 = 6 − (−3) = 9; typing 3 subtracts 3
    const it = signedBrackets(6, 2, 3, 3);
    expect(it.key).toBe('sn5:6 - (2 - 3) \\cdot 3');
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
    const it = find('expr', 3, (x) => x.key.startsWith('ex3:') && x.answer.k !== x.answer.c && x.answer.k !== 0 && x.answer.c !== 0);
    const swapped = { k: it.answer.c, c: it.answer.k };
    expect(isCorrect(it, swapped)).toBe(true);
    expect(it.diag(swapped)).toBe(null);
    const r = recorded(it, swapped);
    expect(r.cat ?? null).toBe(null);
    expect(r.miscon).toEqual([]);
  });
  it('with a 0 box the boxes keep their order: a missing or extra x is wrong, and x-terms that cancel typed as Cx are conjoin', () => {
    // 0x − 25 typed as −25 in the x box is −25x, an x the expression no longer has; 3x + 0 typed as 0 and 3 has lost
    // its x; the tiles' x typed as 0x + 1 too. None is the same expression in another order (swappedLin).
    let zeroX = 0; let zeroC = 0; let tiles = 0;
    try {
      Math.random = seeded(1123);
      for (let n = 0; n < 6000; n += 1) {
        const it = makeItem('expr', 3);
        if (it.form !== 'lin') continue;
        const { k, c } = it.answer;
        if ((k === 0) === (c === 0)) continue;
        const swapped = { k: c, c: k };
        expect(isCorrect(it, swapped), `${it.key}: ${JSON.stringify(swapped)}`).toBe(false);
        expect(swappedLin(it, swapped)).toBe(false);
        if (it.key.startsWith('ex3t:')) tiles += 1;
        if (k === 0 && it.key.startsWith('ex3:')) {
          zeroX += 1;
          expect(it.diag(swapped), it.key).toBe('conjoin');
          expect(props.conjoin(it, swapped), it.key).toBe(true);
          expect(recorded(it, swapped)).toEqual({ cat: 'conjoin', miscon: ['expr:3|conjoin'] });
        }
        if (c === 0) zeroC += 1;
      }
    } finally { Math.random = real; }
    expect(zeroX).toBeGreaterThan(50);
    expect(zeroC).toBeGreaterThan(20);
    expect(tiles).toBeGreaterThan(20);
  }, 60_000);
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
    if (p === 'an1f') return a - b;
    if (p === 'an3a') return key.endsWith(':b') ? 90 - a : 90 - b;
    if (p === 'an3b') return a - b;
    // CLASSROOM-10, the bisector; CLASSROOM-12, the quadrilateral
    if (p === 'an6w') return 2 * a;
    if (p === 'an6h') return a / 2;
    if (p === 'an6t') return 2 * (a + b);
    if (p === 'an6l') return (180 - a) / 2;
    const n = key.split(':').slice(1).map(Number);
    if (p === 'an7a') return 360 - n[0] - n[1] - n[2];
    if (p === 'an7b') return 270 - n[0] - n[1];
    if (p === 'an7c') return (360 - n[0] - n[1]) / 2;
    return NaN;
  };
  const kinds = [
    ['three angles on a straight line', straightThree, 1, ['one-angle', 'sum-360'], 1201],
    ['two adjacent angles and their difference', linearPairDiff, 1, ['took-larger', 'diff-not-halved'], 1202],
    ['three lines through one point', threeLines, 2, ['one-angle', 'sum-360'], 1203],
    ['a ray that halves an angle of a crossing', crossBisect, 2, ['no-half', 'supp-not-equal', 'equal-not-supp'], 1204],
    ['a triangle between parallel lines', parallelTriangle, 4, ['one-angle', 'supp-not-equal'], 1205],
    ['a ray that halves an angle after parallel lines', parallelBisect, 4, ['no-half', 'supp-not-equal', 'equal-not-supp'], 1206],
    // CLASSROOM-9 and -11: the fan, and the split triangle's S1 (practice only) and S2
    ['the fan: two angles side by side, not on a line', fanItem, 1, ['adjacent-not-line', 'sum-not-diff'], 1207],
    ['the split triangle, S1', splitTriangleS1, 3, ['one-angle', 'other-vertex'], 1208],
    ['the split triangle, S2', splitTriangleS2, 3, ['other-vertex', 'part-for-whole'], 1209],
    // CLASSROOM-10: the bisector's four typed kinds; CLASSROOM-12: the quadrilateral's three
    ['the whole angle from its half (bisWhole)', () => bisItem('w'), 6, ['part-for-whole', 'half-double-swap'], 1210],
    ['a half from the whole angle (bisHalf)', () => bisItem('h'), 6, ['no-half', 'half-double-swap'], 1211],
    ['two bisectors in a fan of five rays (bisTwo)', () => bisItem('t'), 6, ['part-for-whole'], 1212],
    ['a bisector next to a straight line (bisLine)', () => bisItem('l'), 6, ['no-half', 'sum-360'], 1213],
    ['a quadrilateral, three angles given (Q0)', () => quadItem(0), 7, ['quad-missed'], 1214],
    ['a quadrilateral, a right angle and two given (Q1)', () => quadItem(1), 7, ['quad-missed'], 1215],
    ['a quadrilateral, two equal angles and two given (Q2)', () => quadItem(2), 7, ['forgot-half', 'wrong-total'], 1216],
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
          const named = it.diag(u);
          if (!named) continue;
          // one mistake, or each of several whose predictions are the same number (PRODUCT2-15)
          for (const cat of [named].flat()) {
            expect(props[cat], cat).toBeTypeOf('function');
            expect(props[cat](it, u), `${it.key}: ${u} labelled ${cat}`).toBe(true);
            expect(catLabel('angles', level, cat), cat).toBeTruthy();
            seen.add(cat);
          }
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
    // the spec's examples: the fan 130° and 55° (75°; 125° is adjacent-not-line), and S2 with d 64°, p 19° (45°; the
    // notebook's β + 64° = 180° gives 116°, and 90° − 19° = 71°)
    expect(props['adjacent-not-line']({ key: 'an1f:130:55', answer: 75, form: 'num' }, 125)).toBe(true);
    expect(props['sum-not-diff']({ key: 'an1f:130:55', answer: 75, form: 'num' }, 185)).toBe(true);
    expect(props['other-vertex']({ key: 'an3b:64:19', answer: 45, form: 'num' }, 116)).toBe(true);
    expect(props['part-for-whole']({ key: 'an3b:64:19', answer: 45, form: 'num' }, 71)).toBe(true);
    expect(props['other-vertex']({ key: 'an3a:38:67:b', answer: 52, form: 'num' }, 113)).toBe(true);
    expect(props['one-angle']({ key: 'an3a:38:67:a', answer: 23, form: 'num' }, 113)).toBe(true);
  });
  it('the bisector and the quadrilateral, the spec\'s examples: the property reads the key', () => {
    // ∢AOC = 37°: 74°; the half itself 37 (part-for-whole); ∢AOB = 126°: 63°, the whole 126 (no-half), doubled 252
    expect(props['part-for-whole']({ key: 'an6w:37', answer: 74, form: 'num' }, 37)).toBe(true);
    expect(props['half-double-swap']({ key: 'an6w:36', answer: 72, form: 'num' }, 18)).toBe(true);
    expect(props['half-double-swap']({ key: 'an6w:37', answer: 74, form: 'num' }, 18.5)).toBe(false);
    expect(props['no-half']({ key: 'an6h:126', answer: 63, form: 'num' }, 126)).toBe(true);
    expect(props['half-double-swap']({ key: 'an6h:126', answer: 63, form: 'num' }, 252)).toBe(true);
    // the worksheet's two bisectors, 41° and 27°: 136°, the parts once each 68°; on a line, 58°: 61°, 122° and 151°
    expect(props['part-for-whole']({ key: 'an6t:41:27', answer: 136, form: 'num' }, 68)).toBe(true);
    expect(props['no-half']({ key: 'an6l:58', answer: 61, form: 'num' }, 122)).toBe(true);
    expect(props['sum-360']({ key: 'an6l:58', answer: 61, form: 'num' }, 151)).toBe(true);
    // 75°, 110°, 95°: 80°, one left out 155°; a right angle, 115°, 70°: 85°, the right angle forgotten 175°
    expect(props['quad-missed']({ key: 'an7a:75:110:95:3', answer: 80, form: 'num' }, 155)).toBe(true);
    expect(props['quad-missed']({ key: 'an7b:115:70:3:1', answer: 85, form: 'num' }, 175)).toBe(true);
    // two equal angles, 100° and 70° given: 95°; not halved 190°; with 180°: 5°
    expect(props['forgot-half']({ key: 'an7c:100:70:2:3', answer: 95, form: 'num' }, 190)).toBe(true);
    expect(props['wrong-total']({ key: 'an7c:100:70:2:3', answer: 95, form: 'num' }, 5)).toBe(true);
    expect(props['wrong-total']({ key: 'an7a:75:110:95:3', answer: 80, form: 'num' }, 5)).toBe(false);
  });
});

describe('the congruence choices name what the student chose (GEOM-5)', () => {
  const pick = (it, text) => it.choices.findIndex((c) => c.text === text || c.text.startsWith(text));
  it('"congruent" on two sides and an angle not between them is ssa; on three angles aaa; "not enough data" is right', () => {
    const ssa = find('congr', 2, (x) => x.key.startsWith('cg2w:ssa:'));
    expect(ssa.diag(pick(ssa, 'חופפים לפי צ.ז.צ'))).toBe('ssa');
    expect(PROPS.congr.ssa(ssa, pick(ssa, 'חופפים לפי צ.ז.צ'))).toBe(true);
    expect(isCorrect(ssa, pick(ssa, 'אין מספיק נתונים'))).toBe(true);
    const aaa = find('congr', 2, (x) => x.key.startsWith('cg2w:aaa:'));
    expect(aaa.diag(pick(aaa, 'חופפים לפי ז.צ.ז'))).toBe('aaa');
    expect(PROPS.congr.aaa(aaa, pick(aaa, 'חופפים לפי ז.צ.ז'))).toBe(true);
    // with the angle between the sides it is a theorem: no tag on "not enough data" there
    const sas = find('congr', 2, (x) => x.key.startsWith('cg2w:sas:'));
    expect(isCorrect(sas, pick(sas, 'חופפים לפי צ.ז.צ'))).toBe(true);
    expect(sas.diag(pick(sas, 'אין מספיק נתונים'))).toBe(null);
  });
  it('the same perimeter taken for congruence, the median taken for a cut into congruent halves, a segment for another', () => {
    const per = find('congr', 2, (x) => x.key.startsWith('cg2p:'));
    expect(per.diag(pick(per, 'כן'))).toBe('equal-perimeter');
    expect(PROPS.congr['equal-perimeter'](per, pick(per, 'כן'))).toBe(true);
    const cl = find('congr', 4, (x) => x.key === 'cg4c:0');
    expect(cl.diag(pick(cl, 'נכון תמיד'))).toBe('median-congruent');
    expect(PROPS.congr['median-congruent'](cl, pick(cl, 'נכון תמיד'))).toBe(true);
    const ok = find('congr', 4, (x) => x.key === 'cg4c:1');
    expect(isCorrect(ok, pick(ok, 'נכון תמיד'))).toBe(true); // the halves do have equal areas
    const seg = find('congr', 4, (x) => x.key.startsWith('cg4s:median:'));
    const wrong = seg.choices.findIndex((c) => !c.ok);
    expect(seg.diag(wrong)).toBe('median-altitude');
    expect(PROPS.congr['median-altitude'](seg, wrong)).toBe(true);
    expect(PROPS.congr['median-altitude'](seg, seg.answer)).toBe(false);
  });
});

describe('the wrong answers sampled for a transform object (GEOM-1 Tests, GEOM-2)', () => {
  it('are the answer, the answer one step each way, and its images under the item\'s flips and turns, all on the plane', () => {
    const shape = { pts: [[1, 1], [4, 1], [1, 3]], names: ['A', 'B', 'C'] };
    const item = { form: 'manip', manip: { kind: 'transform', shape, moves: { drag: true, flips: ['y'], turns: { centre: [0, 0], by: 90 } } }, answer: { pts: [[2, -3], [5, -3], [2, -1]] } };
    const got = candidates(item).map((p) => JSON.stringify(p));
    expect(got).toContain(JSON.stringify(item.answer.pts));
    expect(got).toContain(JSON.stringify([[3, -3], [6, -3], [3, -1]])); // one step right
    expect(got).toContain(JSON.stringify([[-2, -3], [-5, -3], [-2, -1]])); // the flip in the y-axis
    expect(got).toContain(JSON.stringify([[3, 2], [3, 5], [1, 2]])); // a quarter turn counterclockwise about O
    expect(got).toHaveLength(8); // the answer, four slides, a flip and two quarter turns (none off the plane here)
    // at the edge, a move that leaves the plane is not a candidate
    const edge = { ...item, answer: { pts: [[3, 0], [6, 0], [3, 2]] } };
    expect(candidates(edge).every((p) => p.every(([x, y]) => Math.abs(x) <= 6 && Math.abs(y) <= 6))).toBe(true);
    expect(candidates(edge).map((p) => JSON.stringify(p))).not.toContain(JSON.stringify([[4, 0], [7, 0], [4, 2]]));
  });
});

/**
 * The proof tags (GEOM-3.6), read back from the table the student left, not from proofDiag: the congruence row is the
 * one whose claim says ≅ (or ∼); 'circular' is a row whose own reason is "corresponding parts" placed above it, and
 * 'wrong-theorem' a theorem chosen on it that is not its own. The congruence and similarity topics plug these into their
 * properties (curriculum stage 4, GEOM-5 and GEOM-6).
 */
const PROOF_PROPS = {
  circular: (it, u) => {
    const steps = it.manip.part.steps;
    const thm = steps.findIndex((s) => /\\cong|\\sim/.test(s.text));
    const own = (s) => s.fixed ?? s.reason.choices[s.reason.answer];
    return thm >= 0 && steps.some((s, i) => /מתאימות במשולשים/.test(own(s)) && u.order.indexOf(i) < u.order.indexOf(thm));
  },
  'wrong-theorem': (it, u) => {
    const steps = it.manip.part.steps;
    const thm = steps.findIndex((s) => /\\cong|\\sim/.test(s.text));
    const s = steps[thm];
    const chosen = s?.reason && u.reasons[thm] != null ? s.reason.choices[u.reasons[thm]] : '';
    return /^לפי /.test(chosen) && u.reasons[thm] !== s.reason.answer;
  },
};

describe('the wrong tables sampled for a proof object, and the proof tags they show (GEOM-1 Tests, GEOM-3)', () => {
  it('are the right order with each asked reason varied, and each conclusion above the congruence; each tag has its property', () => {
    const seen = new Set();
    for (const T of PROOFS) {
      for (let set = 0; set < LETTER_SETS.length; set += 1) {
        for (const opts of [{ set }, { set, lockOrder: true }, { set, ask: 'theorem' }]) {
          const m = proofManip(T, opts);
          const item = { form: 'manip', manip: m, answer: null };
          item.answer = candidates(item)[0];
          const cands = candidates(item);
          const asked = m.part.steps.filter((s) => s.reason);
          const moved = opts.lockOrder ? 0 : m.part.steps.filter((s) => /מתאימות במשולשים/.test(s.fixed ?? s.reason.choices[s.reason.answer])).length;
          expect(cands, `${T.id} ${JSON.stringify(opts)}`).toHaveLength(1 + asked.reduce((n, s) => n + s.reason.choices.length - 1, 0) + moved);
          for (const u of cands) {
            if (isCorrect(item, u)) continue;
            const cat = proofDiag(m.part, u);
            if (!cat) continue;
            seen.add(cat);
            expect(PROOF_PROPS[cat](item, u), `${T.id}: ${JSON.stringify(u)} labelled ${cat}`).toBe(true);
          }
        }
      }
    }
    expect([...seen].sort()).toEqual(['circular', 'wrong-theorem']);
  });
});
