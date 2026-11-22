// An independent check of every grade 8 stair: hundreds of seeded questions per stair, each answer recomputed here
// from what the question shows (its text, its drawing, its table), with exact fractions (BigInt) and never with the
// generator's own answer function. Each question kind (the key's first part) has its own oracle below; a kind with no
// oracle fails the run, so a new kind cannot slip past unchecked. Beyond the answer, it checks that the right answer is
// accepted in the forms a student may type (a fraction or its decimal, π forms, the rounding the question asks for),
// that a drawing agrees with its numbers (a drawn line through its points, a right triangle's sides, an angle's size),
// and the edge cases of each stair (zero slopes, no solution and infinitely many, negative coordinates).
import { describe, it, expect, beforeAll } from 'vitest';
import { TOPIC, loadAllGens, makeItem, isCorrect, readAnswer, answerInput } from './index.js';
import { manipCorrect } from './manip.js';
import { seeded } from '@/learn/expr.ts';

// ---------------------------------------------------------------- exact fractions
const babs = (a) => (a < 0n ? -a : a);
const bgcd = (a, b) => { a = babs(a); b = babs(b); while (b) [a, b] = [b, a % b]; return a || 1n; };
class Q {
  constructor(n, d = 1n) {
    if (d === 0n) throw new Error('Q: zero denominator');
    if (d < 0n) { n = -n; d = -d; }
    const g = bgcd(n, d); this.n = n / g; this.d = d / g;
  }
  add(o) { o = q(o); return new Q(this.n * o.d + o.n * this.d, this.d * o.d); }
  sub(o) { o = q(o); return new Q(this.n * o.d - o.n * this.d, this.d * o.d); }
  mul(o) { o = q(o); return new Q(this.n * o.n, this.d * o.d); }
  div(o) { o = q(o); return new Q(this.n * o.d, this.d * o.n); }
  neg() { return new Q(-this.n, this.d); }
  cmp(o) { o = q(o); const l = this.n * o.d; const r = o.n * this.d; return l < r ? -1 : l > r ? 1 : 0; }
  eq(o) { return this.cmp(o) === 0; }
  isInt() { return this.d === 1n; }
  get v() { return Number(this.n) / Number(this.d); }
  toString() { return this.d === 1n ? String(this.n) : `${this.n}/${this.d}`; }
}
/** An exact value from a number, a decimal string ("2.5", "-0.15", "12{,}000") or a Q. */
function q(x) {
  if (x instanceof Q) return x;
  if (typeof x === 'bigint') return new Q(x);
  const s = String(x).replace(/\{,\}/g, '').replace(/,/g, '').replace(/−/g, '-').trim();
  const m = s.match(/^(-?)(\d*)(?:\.(\d+))?$/);
  if (!m) throw new Error(`q: not a number ${x}`);
  const frac = m[3] || '';
  const n = BigInt(`${m[2] || '0'}${frac}`) * (m[1] ? -1n : 1n);
  return new Q(n, 10n ** BigInt(frac.length));
}
const Z = (n) => q(n);
/** √n as an exact value when n is a perfect square (a Q), else null. */
function qsqrt(x) {
  x = q(x); if (x.n < 0n) return null;
  const r = (b) => { if (b < 2n) return b; let y = BigInt(Math.floor(Math.sqrt(Number(b)))); while (y * y > b) y -= 1n; while ((y + 1n) * (y + 1n) <= b) y += 1n; return y * y === b ? y : null; };
  const a = r(x.n); const b = r(x.d);
  return a == null || b == null ? null : new Q(a, b);
}
/** School rounding to p places of a positive or negative real. */
const roundP = (v, p) => { const k = 10 ** p; return (Math.sign(v) * Math.round(Math.abs(v) * k + 1e-9)) / k; };

// ---------------------------------------------------------------- reading a question
const strip = (s) => String(s ?? '').replace(/[⁦⁩]/g, '');
/** The maths segments of a text, in order. */
const maths = (s) => [...strip(s).matchAll(/\$([^$]*)\$/g)].map((m) => m[1]);
const NUM = /-?\d+(?:\{,\}\d{3})*(?:\.\d+)?/g;
/** Every number written in the maths of a text, in order, exact. A \frac{a}{b} is one number. */
function nums(s) {
  const out = [];
  for (const m of maths(s)) {
    const t = m.replace(/(-\s*)?\\frac\{(-?\d+)\}\{(-?\d+)\}/g, (_, s, a, b) => `§${s ? '-' : ''}${a}/${b}§`).replace(/§--/g, '§');
    for (const piece of t.split('§')) {
      const f = piece.match(/^(-?\d+)\/(-?\d+)$/);
      if (f) { out.push(new Q(BigInt(f[1]), BigInt(f[2]))); continue; }
      // a fraction written with a slash (25/2) is one number too
      for (const n of piece.match(/-?\d+\/\d+(?![\d.])|-?\d+(?:\{,\}\d{3})*(?:\.\d+)?/g) || []) out.push(n.includes('/') ? new Q(BigInt(n.split('/')[0]), BigInt(n.split('/')[1])) : q(n));
    }
  }
  return out;
}
/** Every number in a plain string (a table cell, a choice), exact. */
const numsPlain = (s) => (String(s ?? '').replace(/\\frac\{(-?\d+)\}\{(\d+)\}/g, '$1/$2').match(/-?\d+(?:\{,\}\d{3})*(?:\.\d+)?(?:\/\d+)?/g) || []).map((t) => (t.includes('/') ? new Q(BigInt(t.split('/')[0]), BigInt(t.split('/')[1])) : q(t)));
const keyParts = (it) => String(it.key).split(':');
/** A choice's shown text, TeX or words. */
const choiceText = (c) => strip(c.tex ?? c.text ?? '');
/** The index of the one choice whose text satisfies pred; fails when none or several do. */
function onlyChoice(it, pred, what) {
  const idx = it.choices.map((c, i) => (pred(choiceText(c), c) ? i : -1)).filter((i) => i >= 0);
  if (idx.length !== 1) throw new Error(`${it.key}: ${idx.length} choices are ${what}: ${it.choices.map(choiceText).join(' | ')}`);
  return idx[0];
}
/** A linear expression in TeX (5x - 3, -x, 0.8(5x + 5y), 12 + 6n) as coefficients by letter and a constant. */
function linear(tex) {
  let s = String(tex).replace(/\\frac\{(\d+)\}\{(\d+)\}/g, '$1/$2').replace(/\\cdot/g, '*').replace(/\\left|\\right/g, '').replace(/\s+/g, '').replace(/−/g, '-');
  // a product of two numbers (0.3 · 406): worked out first
  s = s.replace(/(\d+(?:\.\d+)?)\*(\d+(?:\.\d+)?)(?![\d.])/g, (_, a, b) => String(q(a).mul(q(b))));
  // a(…) with a number before brackets: expand once
  s = s.replace(/(-?\d*\.?\d+)\*?\(([^()]*)\)/g, (_, a, inner) => {
    const L = linear(inner); const k = q(a);
    return Object.entries(L.co).map(([v, c]) => `+${c.mul(k)}${v}`).join('') + `+${L.c.mul(k)}`;
  });
  s = s.replace(/\+-/g, '-').replace(/--/g, '+').replace(/\+\+/g, '+');
  const co = {}; let c = Z(0);
  for (const m of s.matchAll(/([+-]?)(\d+(?:\.\d+)?(?:\/\d+)?)?\*?([a-zA-Z]?)/g)) {
    if (!m[0]) continue;
    const sign = m[1] === '-' ? -1n : 1n;
    let k = m[2] ? (m[2].includes('/') ? new Q(BigInt(m[2].split('/')[0]), BigInt(m[2].split('/')[1])) : q(m[2])) : Z(1);
    k = k.mul(new Q(sign));
    if (m[3]) co[m[3]] = (co[m[3]] || Z(0)).add(k); else if (m[2]) c = c.add(k);
  }
  return { co, c };
}
/** An equation or inequality "lhs REL rhs" as (coefficients, constant) of lhs - rhs, with its relation. */
function relation(tex) {
  const s = String(tex).replace(/\\le(q)?\b/g, '<=').replace(/\\ge(q)?\b/g, '>=').replace(/&/g, '');
  const m = s.match(/^(.*?)(<=|>=|=|<|>)(.*)$/);
  if (!m) throw new Error(`relation: ${tex}`);
  const L = linear(m[1]); const R = linear(m[3]);
  const co = { ...L.co }; for (const [v, c] of Object.entries(R.co)) co[v] = (co[v] || Z(0)).sub(c);
  return { co, c: L.c.sub(R.c), rel: m[2] };
}
const holds = (r, vals) => {
  let v = r.c; for (const [x, c] of Object.entries(r.co)) v = v.add(c.mul(q(vals[x])));
  const s = v.cmp(0);
  return { '=': s === 0, '<': s < 0, '>': s > 0, '<=': s <= 0, '>=': s >= 0 }[r.rel];
};
/** Solve a 2x2 system a1x + b1y = c1, a2x + b2y = c2: { kind: 'one', x, y } | { kind: 'none' } | { kind: 'many' }. */
function solve2(r1, r2) {
  const g = (r, v) => r.co[v] || Z(0);
  const [a1, b1, c1] = [g(r1, 'x'), g(r1, 'y'), r1.c.neg()];
  const [a2, b2, c2] = [g(r2, 'x'), g(r2, 'y'), r2.c.neg()];
  const det = a1.mul(b2).sub(a2.mul(b1));
  if (!det.eq(0)) return { kind: 'one', x: c1.mul(b2).sub(c2.mul(b1)).div(det), y: a1.mul(c2).sub(a2.mul(c1)).div(det) };
  // parallel or the same line: the same line when every 2x2 minor with the constants vanishes too
  const same = a1.mul(c2).sub(a2.mul(c1)).eq(0) && b1.mul(c2).sub(b2.mul(c1)).eq(0);
  return { kind: same ? 'many' : 'none' };
}

// ---------------------------------------------------------------- the oracles
// Each takes a finished item and returns what it should be: { answer } (a Q for a number, [Q, Q] for a point, { m, b }
// for a line, an index for a choice, or any value for an object), and may throw with a message for a check of its own.
const O = {};
const want = (answer, more = {}) => ({ answer, ...more });

// ===== ratio
O.ra1 = (it) => {
  const [a, b, first] = nums(it.text); // a : b = first : □, the first term in lowest terms
  const g = bgcd(a.n, b.n);
  if (!first.eq(a.div(new Q(g)))) throw new Error(`${it.key}: first term ${first} is not ${a}/${g}`);
  return want(b.mul(first).div(a));
};
O.ra1m = (it) => {
  const [a, b] = nums(it.text); // "x: a, y: b. the ratio of y to x"
  const g = bgcd(a.n, b.n);
  const right = `${b.n / g} : ${a.n / g}`;
  return want(onlyChoice(it, (t) => t.replace(/\s+/g, ' ') === right, `the ratio ${right}`));
};
O.ra1a = (it) => {
  const [p, qq, k] = nums(it.text);
  const changes = !p.add(k).div(qq.add(k)).eq(p.div(qq));
  return want(onlyChoice(it, (t) => (changes ? /^כן/.test(t) : /^לא/.test(t)), 'the right yes/no'));
};
O.ra1b = (it) => {
  const [n, a, b] = nums(it.text);
  const red = n.mul(a).div(a.add(b));
  if (!red.isInt()) throw new Error(`${it.key}: ${n} beads cannot be split ${a} : ${b}`);
  if (it.manip.start.den !== Number(n.n)) throw new Error(`${it.key}: the bar has ${it.manip.start.den} parts, not ${n}`);
  return want({ mode: 'value', value: red.div(n).v });
};
O.ra2s = (it) => { const [T, m, n] = nums(it.text); return want(T.mul(m).div(m.add(n))); };
O.ra2r = (it) => {
  const [P, m, n] = nums(it.text); const half = P.div(2); const big = m.cmp(n) >= 0 ? m : n;
  return want(half.mul(big).div(m.add(n)));
};
O.ra2p = (it) => { const [X, Y, P] = nums(it.text); return want(P.mul(X).div(X.add(Y))); };
O.ra2t = (it) => {
  const [, m, n] = nums(it.text); const f = m.div(m.add(n));
  return want(onlyChoice(it, (t) => { const v = numsPlain(t); return v.length === 1 && v[0].eq(f); }, `the fraction ${f}`));
};
O.ra3m = (it) => { const [b, a, c] = nums(it.text.replace('כוס קמח אחת', '$1$ כוסות קמח')); return want(a.div(b).mul(c)); };
O.ra3t = (it) => {
  const rows = it.fig.rows; const known = rows.filter((r) => r[1] !== '?'); const miss = rows.find((r) => r[1] === '?');
  const k = q(known[0][1]).div(q(known[0][0]));
  for (const r of known) if (!q(r[1]).div(q(r[0])).eq(k)) throw new Error(`${it.key}: the table is not proportional`);
  return want(k.mul(q(miss[0])));
};
O.ra3p = (it) => {
  const rows = it.fig.rows; const r = rows.map((row) => q(row[2]).div(q(row[1])));
  const odd = r.map((x, i) => (r.filter((y) => y.eq(x)).length === 1 ? i : -1)).filter((i) => i >= 0);
  if (odd.length !== 1 || r.filter((x) => !x.eq(r[odd[0]])).some((x, _, arr) => !x.eq(arr[0]))) throw new Error(`${it.key}: not exactly one pack differs: ${r.join(', ')}`);
  return want(onlyChoice(it, (t) => t.endsWith(rows[odd[0]][0]), 'the odd pack'));
};
O.ra3l = (it) => {
  const n = nums(it.text.replace('כוס סוכר אחת', '$1$ כוסות סוכר').replace('לכל כוס סוכר', 'לכל $1$ כוסות סוכר'));
  const [w, s, sugar] = n; return want(w.div(s).mul(sugar));
};
O.ra4r = (it) => { const [, S, d] = nums(it.text); return want(S.mul(d).div(100)); };
O.ra4m = (it) => { const [D, , S] = nums(it.text); return want(D.mul(100).div(S)); };
O.ra4f = (it) => { const [d, D] = nums(it.text); return want(D.mul(100000).div(d)); };
O.ra4a = (it) => { const [, k] = nums(it.text); return want(k.mul(k)); };
O.ra4b = (it) => { const [cm, km, R] = nums(it.text); return want(R.mul(cm).div(km)); };

// ===== pct
O.pc1f = (it) => { const [f] = nums(it.text); return want(f.mul(100)); };
O.pc1d = (it) => { const [x] = nums(it.text); return want(x.mul(100)); };
O.pc1s = (it) => { const [den, p] = nums(it.text); const parts = p.mul(den).div(100); if (!parts.isInt()) throw new Error(`${it.key}: ${p}% of ${den} parts`); return want({ mode: 'value', value: p.div(100).v }); };
O.pc1e = (it) => {
  const [N, p] = nums(it.text); const yes = N.mul(p).div(100); const half = N.div(2);
  const t = yes.cmp(half) > 0 ? /^קצת יותר מחצי/ : yes.cmp(half) < 0 ? /^קצת פחות מחצי/ : /^בדיוק חצי/;
  if (p.sub(50).v > 10 || p.sub(50).v < -10) throw new Error(`${it.key}: ${p}% is not "a little" off half`);
  return want(onlyChoice(it, (s) => t.test(s), 'the right description'));
};
O.pc1o = (it) => { const [x] = nums(it.text); const p = x.mul(100); return want(onlyChoice(it, (t) => { const v = numsPlain(t); return v.length === 1 && v[0].eq(p); }, `${p}%`)); };
O.pc2 = (it) => { const [p, N] = nums(it.text); return want(p.mul(N).div(100)); };
O.pc2m = O.pc2;
O.pc2c = (it) => {
  const [n1, p1, n2, p2] = nums(it.text.replace(/ח׳[12]/g, ''));
  const a = n1.mul(p1); const b = n2.mul(p2);
  const t = a.cmp(b) > 0 ? 'בח׳1' : a.cmp(b) < 0 ? 'בח׳2' : 'באותו מספר';
  return want(onlyChoice(it, (s) => s === t, t));
};
O.pc3 = (it) => { const [A, B] = nums(it.text); return want(A.div(B).mul(100)); };
O.pc3g = O.pc3;
O.pc3t = (it) => {
  const [T] = nums(it.text); const place = strip(it.text).match(/מתנדבים ב(.+)\?$/)[1];
  const row = it.fig.rows.find((r) => r[0] === place);
  const sum = it.fig.rows.reduce((s, r) => s.add(q(r[1])), Z(0));
  if (!sum.eq(T)) throw new Error(`${it.key}: the table adds up to ${sum}, the text says ${T}`);
  return want(q(row[1]).div(T).mul(100));
};
O.pc4 = (it) => { const [p, A] = nums(it.text); return want(A.mul(100).div(p)); };
O.pc4d = O.pc4;
O.pc4s = O.pc4;
O.pc5 = (it) => {
  const [N, p] = nums(it.text); const up = /התייקר/.test(it.text);
  return want(N.mul(Z(100).add(up ? p : p.neg())).div(100));
};
O.pc5w = (it) => {
  const [N, p] = nums(it.text); return want(N.mul(Z(100).add(p)).div(100).mul(Z(100).sub(p)).div(100));
};
O.pc5b = (it) => {
  const [N, M] = nums(it.text); const up = M.cmp(N) > 0;
  if (up !== /התייקר\?/.test(it.text)) throw new Error(`${it.key}: asks the wrong direction`);
  const d = M.sub(N); return want((up ? d : d.neg()).div(N).mul(100));
};
O.pc5m = (it) => {
  const [m] = nums(it.text); const up = m.cmp(1) > 0; const p = (up ? m.sub(1) : Z(1).sub(m)).mul(100);
  return want(onlyChoice(it, (t) => (up ? /^התייקרות/ : /^הוזלה/).test(t) && numsPlain(t).length === 1 && numsPlain(t)[0].eq(p), `a change of ${p}%`));
};

// ===== func (read off the drawing: the answer must agree with the graph or table the student reads)
const ptsOf = (fig, i = 0) => fig.series[i].pts.map(([x, y]) => [q(x), q(y)]);
/** y at x on a broken line, exactly. */
function at(pts, x) {
  x = q(x);
  for (let i = 0; i + 1 < pts.length; i += 1) {
    const [[x0, y0], [x1, y1]] = [pts[i], pts[i + 1]];
    if (x.cmp(x0) >= 0 && x.cmp(x1) <= 0) return y0.add(y1.sub(y0).mul(x.sub(x0)).div(x1.sub(x0)));
  }
  throw new Error(`x = ${x} is off the graph`);
}
/** Total x-length of the segments going a way: 'up', 'down' or 'flat'. */
function lengthGoing(pts, way) {
  let s = Z(0);
  for (let i = 0; i + 1 < pts.length; i += 1) {
    const d = pts[i + 1][1].cmp(pts[i][1]); const w = d > 0 ? 'up' : d < 0 ? 'down' : 'flat';
    if (w === way) s = s.add(pts[i + 1][0].sub(pts[i][0]));
  }
  return s;
}
/** The rows of a TeX array table "x & 1 & 2 \\ y & 5 & 9" as numbers. */
const texTable = (tex) => strip(tex).replace(/\\begin\{array\}\{[^}]*\}|\\end\{array\}|\\hline/g, '').split('\\\\').map((r) => r.split('&').slice(1).map((c) => q(c.trim())));
const isFunctionTable = ([xs, ys]) => xs.every((x, i) => xs.every((x2, j) => !x.eq(x2) || ys[i].eq(ys[j])));
const evenSteps = ([xs, ys]) => { const r = ys[1].sub(ys[0]).div(xs[1].sub(xs[0])); return xs.every((x, i) => i === 0 || ys[i].sub(ys[i - 1]).div(x.sub(xs[i - 1])).eq(r)); };

O.fu1 = (it) => {
  const pts = ptsOf(it.fig); const t = strip(it.text);
  if (/אחרי \$/.test(t)) { const [T] = nums(t.split('אחרי')[1]); return want(at(pts, T)); }
  if (/במקום\?/.test(t)) {
    // the rest: the flat part away from home
    let s = Z(0); for (let i = 0; i + 1 < pts.length; i += 1) if (pts[i][1].eq(pts[i + 1][1]) && pts[i][1].cmp(0) > 0) s = s.add(pts[i + 1][0].sub(pts[i][0]));
    return want(s);
  }
  if (/הדרך חזרה/.test(t)) return want(lengthGoing(pts, 'down'));
  throw new Error('fu1: an unknown question');
};
O.fu1d = (it) => {
  const pts = ptsOf(it.fig); const t = strip(it.text);
  if (/פעמיים/.test(t)) {
    const [T] = nums(t.split('הייתה')[1]); const hits = pts.filter(([, y]) => y.eq(T));
    if (hits.length !== 2) throw new Error(`${T}° is on the graph ${hits.length} times, not twice`);
    return want(hits[1][0].sub(hits[0][0]));
  }
  const [h1, h2] = nums(t.split('עלתה')[1]); return want(at(pts, h2).sub(at(pts, h1)));
};
O.fu1f = (it) => {
  const pts = ptsOf(it.fig); const [a, b] = nums(it.text);
  const flat = at(pts, a).eq(at(pts, b)) && pts.filter(([x]) => x.cmp(a) > 0 && x.cmp(b) < 0).every(([, y]) => y.eq(at(pts, a)));
  if (!flat) throw new Error('the marked part is not flat');
  return want(onlyChoice(it, (s) => /עמד(ה)? במקום$/.test(s), 'standing still'));
};
O.fu1p = (it) => {
  const pts = ptsOf(it.fig); const A = it.fig.marks[0]; const ax = q(A.x);
  if (!at(pts, ax).eq(q(A.y))) throw new Error(`A(${A.x}, ${A.y}) is not on the graph`);
  // the part A is on, in order: out to the shop, at the shop, on to the friend, at the friend, back home
  let part = -1;
  for (let i = 0; i + 1 < pts.length; i += 1) if (ax.cmp(pts[i][0]) > 0 && ax.cmp(pts[i + 1][0]) < 0) part = i;
  if (part < 0) throw new Error('A is on a corner of the graph');
  const friend = strip(it.text).match(/אצל (\S+) ו/)[1];
  const re = [/בדרך לחנות$/, /בחנות$/, new RegExp(`בדרך מהחנות אל ${friend}$`), new RegExp(`אצל ${friend}$`), /בדרך חזרה הביתה$/][part];
  return want(onlyChoice(it, (s) => re.test(s), `part ${part}`));
};
O.fu1s = (it) => {
  const t = strip(it.text); const shape = [];
  for (const m of t.matchAll(/(התרחק|התרחקה|עמד|עמדה|התקרב|התקרבה)[^$]*\$(\d+)\$ דקות/g)) {
    const way = /^התרחק/.test(m[1]) ? 'up' : /^עמד/.test(m[1]) ? 'flat' : 'down';
    for (let k = 0; k < Number(m[2]) / 5; k += 1) shape.push(way);
  }
  if (shape.length !== 3) throw new Error(`the story tells ${shape.length * 5} minutes, the graph has 15`);
  return want({ mode: 'shape', shape });
};
O.fu2 = (it) => {
  const t = strip(it.text); const [eq] = maths(t).filter((m) => /y =/.test(m)); const L = linear(eq.split('=')[1]);
  const after = nums(t.split('הוא $y')[1].split('כש־')[1]);
  const v = after[after.length - 1];
  const asksX = /(עלתה|עלה|שילמו) \$/.test(t);
  return want(asksX ? v.sub(L.c).div(L.co.x) : L.co.x.mul(v).add(L.c));
};
O.fu2c = (it) => {
  const t = strip(it.text); const v = nums(t).at(-1);
  return want(/כמה מעלות צלזיוס/.test(t) ? v.sub(32).div(q('1.8')) : v.mul(q('1.8')).add(32));
};
O.fu2t = (it) => {
  const rows = it.fig.rows.map(([x, y]) => [q(x), q(y)]);
  const m = rows[1][1].sub(rows[0][1]).div(rows[1][0].sub(rows[0][0])); const b = rows[0][1].sub(m.mul(rows[0][0]));
  if (!rows.every(([x, y]) => m.mul(x).add(b).eq(y))) throw new Error('the table is not of y = mx + b');
  const n = nums(it.text).at(-1); return want(m.mul(n).add(b));
};
O.fu2i = (it) => want(onlyChoice(it, (s) => !isFunctionTable(texTable(s)), 'not a function'));
O.fu2d = (it) => want({ mode: 'values', values: texTable(it.display)[1].map((v) => v.v) });
O.fu3 = (it) => {
  const t = strip(it.text); const way = /עולה\?/.test(t) ? 'up' : /יורדת\?/.test(t) ? 'down' : /קבועה\?/.test(t) ? 'flat' : null;
  return want(lengthGoing(ptsOf(it.fig), way));
};
O.fu3t = (it) => {
  const rows = it.fig.rows.map(([h, v]) => [q(h), q(v)]); const up = /עלתה/.test(it.text);
  return want(lengthGoing(rows, up ? 'up' : 'down'));
};
O.fu3w = (it) => {
  const pts = ptsOf(it.fig); const [a, b] = nums(it.text);
  const inside = [a, ...pts.filter(([x]) => x.cmp(a) > 0 && x.cmp(b) < 0).map(([x]) => x), b].map((x) => at(pts, x));
  const ways = new Set(inside.slice(1).map((y, i) => y.cmp(inside[i])));
  if (ways.size !== 1) throw new Error('the function changes direction inside the band');
  const w = [...ways][0];
  return want(onlyChoice(it, (s) => s === (w > 0 ? 'עולה' : w < 0 ? 'יורדת' : 'קבועה'), 'the direction'));
};
O.fu3s = (it) => {
  const t = strip(it.text); const shape = []; let from = 0;
  for (const m of t.matchAll(/(עולה|יורד|קבוע) עד \$x = (\d+)\$/g)) {
    const to = Number(m[2]); const way = { עולה: 'up', יורד: 'down', קבוע: 'flat' }[m[1]];
    for (let x = from; x < to; x += 1) shape.push(way); from = to;
  }
  if (from !== it.manip.x.max) throw new Error(`the story ends at x = ${from}, the axis at ${it.manip.x.max}`);
  return want({ mode: 'shape', shape });
};
O.fu4 = (it) => {
  const t = strip(it.text).replace('דקה אחת', '$1$ דקות'); const [s, T, v] = nums(t); const r = v.sub(s).div(T);
  if (/בכל דקה\?/.test(t)) return want(r);
  const [tt] = nums(t.split('תהיה הטמפרטורה')[1]); return want(s.add(r.mul(tt)));
};
O.fu4c = (it) => {
  const t = strip(it.text).replace(/אחרי שעה /, 'אחרי $1$ שעות '); const [h0, T, h1] = nums(t);
  return want(h0.div(h0.sub(h1).div(T)));
};
O.fu4u = (it) => want(onlyChoice(it, (s) => evenSteps(texTable(s)), 'the even table'));
O.fu4f = (it) => {
  const slope = (i) => { const p = ptsOf(it.fig, i); return p[1][1].sub(p[0][1]).div(p[1][0].sub(p[0][0])); };
  const [sA, sB] = [0, 1].map(slope); const names = it.fig.series.map((s) => s.label);
  if (sA.eq(sB)) return want(onlyChoice(it, (s) => /^שניהם/.test(s), 'the same speed'));
  const fast = sA.cmp(sB) > 0 ? names[0] : names[1];
  return want(onlyChoice(it, (s) => s.startsWith(`הרץ ${fast}: הקו שלו תלול`), `runner ${fast}`));
};
O.fu4n = (it) => {
  const [m0, v0, m1, v1, end] = nums(it.text); if (!m1.eq(m0.add(1))) throw new Error('the two minutes are not one apart');
  const r = v1.sub(v0); const values = [];
  for (let m = m0; m.cmp(end) <= 0; m = m.add(1)) values.push(v0.add(r.mul(m.sub(m0))).v);
  if (it.manip.x.min !== m0.v || it.manip.x.max !== end.v) throw new Error('the graph does not span the minutes asked');
  return want({ mode: 'values', values });
};

// ===== line (the linear function)
/** "y = 3x + 2", "f(x) = -x + 8", "y = 8 + 5x" as { m, b }. */
const lineOf = (tex) => { const L = linear(String(tex).split('=').at(-1)); return { m: L.co.x || Z(0), b: L.c }; };
const linesIn = (s) => maths(s).filter((m) => /=/.test(m) && /x/.test(m) && /^(y|[fgh]\(x\))\s*=/.test(m.trim())).map(lineOf);
/** Points "(a, b)" written in the maths of a text. */
const pointsIn = (s) => maths(s).flatMap((m) => [...m.matchAll(/\((-?\d+(?:\.\d+)?(?:\/\d+)?),\s*(-?\d+(?:\.\d+)?(?:\/\d+)?)\)/g)].map((p) => [p[1], p[2]].map((v) => (v.includes('/') ? new Q(BigInt(v.split('/')[0]), BigInt(v.split('/')[1])) : q(v)))));
const onLine = (L, [x, y]) => L.m.mul(q(x)).add(L.b).eq(q(y));
/** Every point and polygon corner drawn on a coord figure lies on its drawn line where it should. */
function coordLineCheck(it) {
  const f = it.fig; if (!f?.line) return;
  const L = { m: q(f.line.m), b: q(f.line.b) };
  for (const p of f.points || []) if (!onLine(L, [p.x, p.y])) throw new Error(`the drawn point ${p.label}(${p.x}, ${p.y}) is not on the drawn line`);
  return L;
}
O.lf1 = (it) => {
  const [L] = linesIn(it.text); const x = nums(it.text).at(-1);
  for (const [rx, ry] of it.fig.rows) if (ry !== '?' && !onLine(L, [rx, ry])) throw new Error(`the table row (${rx}, ${ry}) is not on the line`);
  if (!it.fig.rows.some(([rx, ry]) => ry === '?' && q(rx).eq(x))) throw new Error('the table does not ask the x of the question');
  return want(L.m.mul(x).add(L.b));
};
O.lf1p = (it) => {
  const [L] = linesIn(it.text); const x = nums(it.text).at(-1);
  if (!q(it.manip.line.m).eq(L.m) || !q(it.manip.line.b).eq(L.b)) throw new Error('the drawn line is not the line in the question');
  return want([x.v, L.m.mul(x).add(L.b).v]);
};
// is the point on the line: its x substituted gives its y
O.lf1o = (it) => {
  const [L] = linesIn(it.text); const [P] = pointsIn(it.text);
  return want(onlyChoice(it, (t) => t === (onLine(L, P) ? 'כן' : 'לא'), 'the point on the line or not'));
};
// (p, k) or (k, q) on the line: the missing coordinate, substituted or solved
O.lf1k = (it) => {
  const [L] = linesIn(it.text);
  const m = strip(it.text).match(/\$\((k|-?\d+), (k|-?\d+)\)\$/); if (!m) throw new Error('no point with k');
  if (m[1] === 'k') { if (L.m.eq(0)) throw new Error('a flat line'); return want(q(m[2]).sub(L.b).div(L.m)); }
  return want(L.m.mul(q(m[1])).add(L.b));
};
// a line parallel to an axis, from two points (one coordinate the same) or from a point and the axis named
O.lf2a = (it) => {
  const P = pointsIn(it.text);
  let eq;
  if (P.length === 2) {
    const [[x1, y1], [x2, y2]] = P;
    if (x1.eq(x2) && y1.eq(y2)) throw new Error('one point twice');
    if (!x1.eq(x2) && !y1.eq(y2)) throw new Error('the line through the two points is parallel to no axis');
    eq = x1.eq(x2) ? `x = ${x1}` : `y = ${y1}`;
  } else {
    const axis = strip(it.text).match(/מקביל לציר \$([xy])\$/); if (!axis || P.length !== 1) throw new Error('no axis or no point');
    eq = axis[1] === 'x' ? `y = ${P[0][1]}` : `x = ${P[0][0]}`;
  }
  const drawn = it.fig.points.map((p) => [p.x, p.y].join(','));
  if (drawn.join(';') !== P.map((p) => p.map(String).join(',')).join(';')) throw new Error(`the drawn points ${drawn} are not the text's`);
  return want(onlyChoice(it, (t) => t.replace(/\s+/g, '') === eq.replace(/\s+/g, ''), eq));
};
O.lf2 = (it) => {
  const L = lineOf(maths(it.text)[0]);
  if (it.form === 'mc') { const s = L.m.cmp(0); return want(onlyChoice(it, (t) => t === (s > 0 ? 'עולה' : s < 0 ? 'יורדת' : 'קבועה'), 'the direction')); }
  return want(/השיפוע \$m\$/.test(it.text) ? L.m : L.b);
};
O.lf2b = (it) => { const [L] = linesIn(it.text); return want({ m: L.m.v, b: L.b.v }); };
O.lf2p = (it) => {
  const up = /עולה\?/.test(it.text);
  return want(onlyChoice(it, (t) => lineOf(t).m.cmp(0) === (up ? 1 : -1), up ? 'rising' : 'falling'));
};
O.lf3 = (it) => {
  const L = coordLineCheck(it); const [A, B] = it.fig.points;
  const m = q(B.y).sub(q(A.y)).div(q(B.x).sub(q(A.x)));
  if (!m.eq(L.m)) throw new Error('the slope between A and B is not the drawn line\'s');
  return want(m);
};
O.lf4 = (it) => {
  const [[x1, y1], [x2, y2]] = pointsIn(it.text);
  if (x1.eq(x2)) throw new Error('a vertical line has no slope');
  return want(y2.sub(y1).div(x2.sub(x1)));
};
O.lf5 = (it) => {
  const P = pointsIn(it.text);
  let m;
  if (P.length === 2) { if (P[0][0].eq(P[1][0])) throw new Error('vertical'); m = P[1][1].sub(P[0][1]).div(P[1][0].sub(P[0][0])); } else m = nums(it.text)[0];
  const b = P[0][1].sub(m.mul(P[0][0]));
  return want({ m, b });
};
// parallel to a given line through a point: the given line's slope, b from the point; a drawing has that line and point
O.lf5p = (it) => {
  const [G] = linesIn(it.text); const [[x1, y1]] = pointsIn(it.text);
  if (onLine(G, [x1, y1])) throw new Error('the point is on the given line: the same line');
  if (it.fig) {
    if (!q(it.fig.line.m).eq(G.m) || !q(it.fig.line.b).eq(G.b)) throw new Error('the drawn line is not the given one');
    const [p] = it.fig.points; if (!q(p.x).eq(x1) || !q(p.y).eq(y1)) throw new Error('the drawn point is not the text\'s');
  }
  return want({ m: G.m, b: y1.sub(G.m.mul(x1)) });
};
O.lf6 = (it) => {
  const L = lineOf(maths(it.text)[0]); const onX = /ציר \$x\$/.test(it.text);
  if (onX && L.m.eq(0)) throw new Error('a flat line meets the x axis nowhere or everywhere');
  return want(onX ? [L.b.neg().div(L.m), Z(0)] : [Z(0), L.b]);
};
O.lf7 = (it) => {
  const [L] = linesIn(it.text); coordLineCheck(it);
  const x0 = L.b.neg().div(L.m); const area = L.b.mul(x0).div(2); const A = area.cmp(0) < 0 ? area.neg() : area;
  const poly = it.fig.polygon.map(([x, y]) => [q(x), q(y)]);
  const shouldBe = [[Z(0), Z(0)], [x0, Z(0)], [Z(0), L.b]];
  if (!shouldBe.every(([x, y]) => poly.some(([px, py]) => px.eq(x) && py.eq(y)))) throw new Error(`the shaded triangle ${JSON.stringify(it.fig.polygon)} is not the one the line makes`);
  return want(A);
};
// a line and y = k or x = k
O.lf8a = (it) => {
  const [L] = linesIn(it.text);
  const ax = maths(it.text).map((m) => m.match(/^([xy]) = (-?\d+)$/)).find(Boolean); if (!ax) throw new Error('no line parallel to an axis');
  const k = q(ax[2]);
  if (ax[1] === 'x') return want([k, L.m.mul(k).add(L.b)]);
  if (L.m.eq(0)) throw new Error('two flat lines');
  return want([k.sub(L.b).div(L.m), k]);
};
O.lf8 = (it) => {
  const [L1, L2] = linesIn(it.text);
  if (L1.m.eq(L2.m)) throw new Error('parallel lines do not meet');
  const x = L2.b.sub(L1.b).div(L1.m.sub(L2.m)); return want([x, L1.m.mul(x).add(L1.b)]);
};

// ===== pyth
/** A length √n: exact when whole, else rounded to tenths as the question asks; the item's `exact` must be √n itself. */
function rootAnswer(it, n2) {
  n2 = q(n2); if (n2.cmp(0) <= 0) throw new Error(`a side squared is ${n2}`);
  const r = qsqrt(n2); const real = Math.sqrt(n2.v);
  if (r && !r.isInt() && it.exact == null) return r; // a whole-free exact root (2.4 for 5.76)
  if (it.exact != null && Math.abs(it.exact - real) > 1e-9) throw new Error(`exact is ${it.exact}, √${n2} is ${real}`);
  if (r) return r;
  if (!/עגלו לעשירית/.test(it.text)) throw new Error(`√${n2} is not whole and the question does not say to round`);
  return q(String(roundP(real, 1)));
}
const isRight = (s) => { const [a, b, c] = s.map(q).sort((x, y) => x.cmp(y)); return a.mul(a).add(b.mul(b)).eq(c.mul(c)); };
const isTriangle = (s) => { const [a, b, c] = s.map(q).sort((x, y) => x.cmp(y)); return a.add(b).cmp(c) > 0; };
/** A right triangle figure: its two given sides must make a real right triangle. */
function rightFig(f) {
  if (f.type !== 'right') throw new Error('not a right triangle figure');
  return { a: f.a === '?' ? null : q(f.a), b: f.b === '?' ? null : q(f.b), c: f.c === '?' ? null : q(f.c) };
}
O.py1 = (it) => { const { a, b, c } = rightFig(it.fig); if (c) throw new Error('the hypotenuse is given'); return want(rootAnswer(it, a.mul(a).add(b.mul(b)))); };
O.py1e = (it) => {
  const { a, b } = rightFig(it.fig); const n = a.mul(a).add(b.mul(b));
  if (!maths(it.text).some((m) => m === `\\sqrt{${n}}`)) throw new Error(`the text does not say √${n}`);
  if (qsqrt(n)) throw new Error(`√${n} is whole: it is not between two whole numbers`);
  return want(Z(Math.floor(Math.sqrt(n.v))));
};
O.py1s = (it) => {
  const [c, area] = nums(it.text); if (!c.mul(c).eq(area)) throw new Error(`the square on ${c} is not ${area}`);
  const a = it.answer;
  if (a.a * a.a + a.b * a.b !== a.c * a.c || a.c !== c.v || a.a > it.manip.max || a.b > it.manip.max) throw new Error('the legs given as the answer do not make the hypotenuse, or do not fit the object');
  return want(a);
};
O.py2 = (it) => { const { a, b, c } = rightFig(it.fig); if (b) throw new Error('both legs given'); if (c.cmp(a) <= 0) throw new Error('a leg is not shorter than the hypotenuse'); return want(rootAnswer(it, c.mul(c).sub(a.mul(a)))); };
O.py3w = (it) => {
  const sets = it.choices.slice(0, 4).map((c) => numsPlain(choiceText(c)));
  for (const s of sets) if (!isTriangle(s)) throw new Error(`${s.join(', ')} is not a triangle`);
  const right = sets.map((s, i) => (isRight(s) ? i : -1)).filter((i) => i >= 0);
  if (right.length > 1) throw new Error('two right triangles among the choices');
  return want(right.length ? right[0] : onlyChoice(it, (t) => t === 'אף אחד מהם', 'none'));
};
O.py3n = (it) => {
  const sets = it.fig.rows.map((r) => numsPlain(r[1]));
  for (const s of sets) if (!isTriangle(s)) throw new Error(`${s.join(', ')} is not a triangle`);
  return want(Z(sets.filter(isRight).length));
};
O.py4 = (it) => {
  const t = strip(it.text); const [x, y] = numsPlain(t.replace(/ROUND|אם יוצא.*$/, '')).slice(0, 2);
  const f = it.fig;
  if (/באורך/.test(t)) { // the ladder's length and its foot: the height
    if (!(q(f.len).eq(x) && q(f.foot).eq(y) && f.wall === '?')) throw new Error('the drawing does not match the story');
    return want(rootAnswer(it, x.mul(x).sub(y.mul(y))));
  }
  if (!(q(f.wall).eq(x) && q(f.foot).eq(y) && f.len === '?')) throw new Error('the drawing does not match the story');
  return want(rootAnswer(it, x.mul(x).add(y.mul(y))));
};
// the two-step figures (the council's round 3): each length from the numbers the text prints, through the right triangle
// the figure hides, and the lengths written on the drawing are the text's
const geoLabels = (it) => (it.fig?.segs || []).map((s) => s.label).filter((l) => l != null && l !== '').map(String);
function sameLabels(it, values) {
  const want = [...values.map(String), '?'].sort(); const got = geoLabels(it).sort();
  if (JSON.stringify(want) !== JSON.stringify(got)) throw new Error(`the drawing writes ${got}, the text gives ${want}`);
}
/** √n, whole: the two-step figures are built from Pythagorean triples, so every side the solution finds is whole. */
const wholeRoot = (n) => { const r = qsqrt(n); if (!r || !r.isInt()) throw new Error(`√${n} is not whole`); return r; };
O.py4a = (it) => {
  const [ab, bd, dc] = nums(it.text); sameLabels(it, [ab, bd, dc]);
  const ad = wholeRoot(ab.mul(ab).sub(bd.mul(bd)));
  return want(rootAnswer(it, ad.mul(ad).add(dc.mul(dc))));
};
O.py4i = (it) => {
  const n = nums(it.text); sameLabels(it, n);
  if (/מה אורך הגובה/.test(it.text)) { const [s, base] = n; return want(rootAnswer(it, s.mul(s).sub(base.div(2).mul(base.div(2))))); }
  const [base, h] = n; return want(rootAnswer(it, h.mul(h).add(base.div(2).mul(base.div(2)))));
};
O.py4r = (it) => {
  const n = nums(it.text); sameLabels(it, n);
  if (/מה אורך הצלע/.test(it.text)) { const [d1, d2] = n.map((v) => v.div(2)); return want(rootAnswer(it, d1.mul(d1).add(d2.mul(d2)))); }
  const [s, d1] = n; const half = wholeRoot(s.mul(s).sub(d1.div(2).mul(d1.div(2)))); return want(half.mul(2));
};
O.py4t = (it) => {
  const [a, b, h] = nums(it.text); sameLabels(it, [a, b, h]);
  const d = a.sub(b); return want(rootAnswer(it, h.mul(h).add(d.mul(d))));
};
O.py5 = (it) => {
  const [[x1, y1], [x2, y2]] = pointsIn(it.text);
  const [A, B] = it.fig.points;
  if (!(q(A.x).eq(x1) && q(A.y).eq(y1) && q(B.x).eq(x2) && q(B.y).eq(y2))) throw new Error('the drawn points are not the points in the text');
  const dx = x2.sub(x1); const dy = y2.sub(y1);
  if (it.fig.helper) { const [, C] = it.fig.helper; if (!((q(C[0]).eq(x2) && q(C[1]).eq(y1)) || (q(C[0]).eq(x1) && q(C[1]).eq(y2)))) throw new Error('the helper corner is not the right angle'); }
  return want(rootAnswer(it, dx.mul(dx).add(dy.mul(dy))));
};

// ===== circle (answers in π: the number before π; answers with π ≈ 3.14: pk is the multiple of π and the answer is
// 3.14·pk rounded to tenths)
const radiusOf = (it) => { const t = strip(it.text); const [v] = nums(t.split(/שרדיוסו|שקוטרו|ברדיוס/)[1]); return /שקוטרו/.test(t) ? v.div(2) : v; };
const piItem = (it, k) => { if (it.after !== '\\pi') throw new Error('asked in π, but the answer row has no π'); return want(k); };
function pkItem(it, k) {
  if (!/3\.14/.test(it.text) || !/לעשירית/.test(it.text)) throw new Error('a π ≈ 3.14 answer the question does not ask for');
  if (!q(it.pk).eq(k)) throw new Error(`pk ${it.pk}, should be ${k}`);
  return want(q(String(roundP(3.14 * k.v, 1))));
}
/** The circle drawn on a geo figure has the radius of the question. */
function circleFig(it, r) {
  const c = it.fig?.circles?.[0] || it.fig?.arcs?.[0];
  if (c && !q(c.r).eq(r)) throw new Error(`the drawn circle has r = ${c.r}, the question ${r}`);
}
/** A solid's drawing has the question's measures. */
function solidFig(it, m) {
  const f = it.fig; if (!f || f.type !== 'solid') throw new Error('no drawing of the solid');
  for (const [k, v] of Object.entries(m)) if (v != null && !q(f[k]).eq(v)) throw new Error(`the drawn ${k} is ${f[k]}, should be ${v}`);
}
O.ci1r = (it) => { const [C] = nums(it.text); return want(C.div(2)); };
O.ci1p = (it) => {
  if (/מה הרדיוס\?/.test(it.text)) return O.ci1r(it);
  const r = radiusOf(it); circleFig(it, r); return piItem(it, r.mul(2));
};
O.ci1n = (it) => { const r = radiusOf(it); circleFig(it, r); return pkItem(it, r.mul(2)); };
O.ci1w = (it) => { const [r, turns] = nums(it.text); circleFig(it, r); return pkItem(it, r.mul(2).mul(turns)); };
O.ci1m = (it) => {
  const [C] = nums(it.text); const r = it.answer.r;
  if (roundP(2 * Math.PI * r, 1) !== C.v) throw new Error(`2π·${r} = ${2 * Math.PI * r}, not about ${C}`);
  return want({ mode: 'r', r });
};
O.ci2p = (it) => { const r = radiusOf(it); circleFig(it, r); return piItem(it, r.mul(r)); };
O.ci2n = (it) => { const r = radiusOf(it); circleFig(it, r); return pkItem(it, r.mul(r)); };
O.ci2h = (it) => {
  const r = radiusOf(it); circleFig(it, r); const part = /חצי עיגול/.test(it.text) ? Z(2) : /רבע עיגול/.test(it.text) ? Z(4) : null;
  const arc = it.fig.arcs?.[0]; if (arc && !q(Math.abs(arc.to - arc.from)).eq(Z(360).div(part))) throw new Error(`the drawn arc is ${Math.abs(arc.to - arc.from)}°`);
  return piItem(it, r.mul(r).div(part));
};
O.ci2r = (it) => {
  const [R, w] = nums(it.text); const big = R.add(w);
  const [c1, c2] = it.fig.circles; if (!q(c1.r).eq(big) || !q(c2.r).eq(R)) throw new Error('the drawn circles are not the pool and the path');
  return piItem(it, big.mul(big).sub(R.mul(R)));
};
O.ci2m = (it) => {
  const [A] = nums(it.text); const r = it.answer.r;
  if (roundP(Math.PI * r * r, 1) !== A.v) throw new Error(`π·${r}² = ${Math.PI * r * r}, not about ${A}`);
  return want({ mode: 'r', r });
};
O.ci3f = (it) => { const [B, L] = nums(it.text); return want(L.mul(1000).div(B)); };
const rh = (it) => { const [r, h] = nums(it.text); solidFig(it, { r, h }); return [r, h]; };
O.ci3v = (it) => { const [r, h] = rh(it); return piItem(it, r.mul(r).mul(h)); };
O.ci3l = (it) => { const [r, h] = rh(it); return piItem(it, r.mul(2).mul(h)); };
O.ci3s = (it) => { const [r, h] = rh(it); return piItem(it, r.mul(r).mul(2).add(r.mul(2).mul(h))); };
O.ci3m = (it) => {
  const [a, b] = nums(it.text); // around × around × other / 4π: the side around the base counts twice
  const va = a.mul(a).mul(b); const vb = b.mul(b).mul(a);
  if (va.eq(vb)) return want(onlyChoice(it, (t) => /אותו נפח/.test(t), 'the same'));
  const longAround = (va.cmp(vb) > 0) === (a.cmp(b) > 0);
  return want(onlyChoice(it, (t) => (longAround ? /הארוכה/ : /הקצרה/).test(t), 'the larger'));
};
O.ci4c = (it) => { const [V] = nums(it.text); return piItem(it, V.div(3)); };
O.ci4h = (it) => {
  const [r, l] = nums(it.text); const h = qsqrt(l.mul(l).sub(r.mul(r)));
  if (!h) throw new Error('the height is not whole and the question does not say to round');
  solidFig(it, { r, l, h }); return want(h);
};
O.ci4v = (it) => {
  const [r, h, l] = nums(it.text); if (!r.mul(r).add(h.mul(h)).eq(l.mul(l))) throw new Error(`r² + h² = ${r.mul(r).add(h.mul(h))}, l² = ${l.mul(l)}: not a cone`);
  solidFig(it, { r, h, l }); return piItem(it, r.mul(r).mul(h).div(3));
};
O.ci4m = (it) => want(onlyChoice(it, (t) => t === '3', 'three'));
O.ci4a = (it) => {
  const r = radiusOf(it); const [h] = nums(strip(it.text).split('וגובהו')[1]);
  const p = it.fig.pts; const base = Math.abs(p._b[0] - p._a[0]); const top = p._t[1] - p._m[1];
  if (!q(base).eq(r.mul(2)) || !q(top).eq(h)) throw new Error('the drawn section is not the cone\'s');
  return want(r.mul(h));
};

// ===== stats
const sum = (a) => a.reduce((s, v) => s.add(v), Z(0));
const sorted = (a) => [...a].sort((x, y) => x.cmp(y));
const meanOf = (a) => sum(a).div(a.length);
const medianOf = (a) => { const s = sorted(a); const n = s.length; return n % 2 ? s[(n - 1) / 2] : s[n / 2 - 1].add(s[n / 2]).div(2); };
const modesOf = (a) => { const c = new Map(); for (const v of a) c.set(String(v), (c.get(String(v)) || 0) + 1); const top = Math.max(...c.values()); return [...c].filter(([, n]) => n === top).map(([v]) => v); };
const rangeOf = (a) => { const s = sorted(a); return s.at(-1).sub(s[0]); };
/** The list of numbers of a question ("הנתונים 3, 5, 7"): the longest run of numbers in one isolate. */
const listIn = (s) => { const m = String(s).match(/⁦([^⁩]*)⁩/); if (!m) throw new Error('no list'); return nums(m[1]); };
O.st1 = (it) => {
  const ms = modesOf(listIn(it.text)); if (ms.length !== 1) throw new Error(`the data have ${ms.length} modes: ${ms}`);
  return want(q(ms[0]));
};
O.st2 = (it) => want(medianOf(listIn(it.text)));
// the mode and the median from a frequency table or a bar chart (the council's round 3): the data are each value as many
// times as its frequency, read from the drawing
const freqRows = (it) => {
  const f = it.fig;
  if (f.type === 'table') return f.rows.map(([v, n]) => [q(v), q(n)]);
  if (f.type === 'chart' && f.mode === 'bar') { if (f.max < Math.max(...f.values)) throw new Error('a bar above the axis'); return f.cats.map((c, i) => [q(c), q(f.values[i])]); }
  throw new Error(`no table or bar chart: ${f.type}`);
};
const unfold = (rows) => rows.flatMap(([v, n]) => Array(Number(n.n)).fill(v));
O.st1t = (it) => { const ms = modesOf(unfold(freqRows(it))); if (ms.length !== 1) throw new Error(`the data have ${ms.length} modes`); return want(q(ms[0])); };
O.st2t = (it) => want(medianOf(unfold(freqRows(it))));
O.st2b = (it) => {
  const vals = it.manip.values.map(q); const t = q(it.manip.target);
  if (!nums(it.text).at(-1).eq(t)) throw new Error('the target in the text is not the object\'s');
  const ok = []; for (let v = 0; v <= it.manip.max; v += 1) if (medianOf([...vals, Z(v)]).eq(t)) ok.push(v);
  if (ok.length !== 1) throw new Error(`${ok.length} heights of the last bar give the median ${t}: ${ok}`);
  return want(ok[0]);
};
O.st3 = (it) => want(meanOf(listIn(it.text)));
O.st3b = (it) => {
  const vals = it.manip.values.map(q); const m = q(it.manip.mean);
  if (!nums(it.text).at(-1).eq(m)) throw new Error('the mean in the text is not the object\'s');
  const last = m.mul(vals.length + 1).sub(sum(vals));
  if (!last.isInt() || last.cmp(0) < 0 || last.cmp(it.manip.max) > 0) throw new Error(`the last bar would be ${last}, off the object`);
  return want(last.v);
};
O.st4 = (it) => {
  const rows = it.fig.rows.map(([v, f]) => [q(v), q(f)]);
  return want(sum(rows.map(([v, f]) => v.mul(f))).div(sum(rows.map(([, f]) => f))));
};
O.st5 = (it) => {
  const t = strip(it.text); const n = q(t.match(/הממוצע של (\d+) מספרים/)[1]); const [avg] = nums(t); const known = listIn(it.text);
  if (known.length !== n.v - 1) throw new Error(`${known.length} numbers given of ${n}`);
  return want(avg.mul(n).sub(sum(known)));
};
O.st6r = (it) => want(rangeOf(listIn(it.text)));
O.st6s = (it) => {
  const vals = listIn(it.text); const t = strip(it.text); const r = rangeOf(vals);
  if (/הוכפלו ב־\$2\$/.test(t)) return want(r.mul(2));
  if (/הוכפלו ב־\$1\.1\$/.test(t)) return want(r.mul(q('1.1')));
  if (/הוסיפה/.test(t)) return want(r);
  throw new Error('an unknown change');
};
O.st6m = (it) => {
  const [n, m, c] = nums(it.text);
  if (/הוכפל ב־\$2\$/.test(it.text)) return want(m.mul(2));
  if (/הוסיפו/.test(it.text)) { if (!n) throw new Error('no n'); return want(m.add(c)); }
  throw new Error('an unknown change');
};
O.st6t = (it) => {
  const [a, w1, b, w2, M, d] = nums(it.text);
  return want(a.mul(w1).add(b.mul(w2)).add(M).add(d).div(a.add(b).add(1)));
};
O.st6o = (it) => {
  const list = listIn(it.text); const X = nums(it.text).at(-1); const all = [...list, X];
  const dMean = meanOf(all).sub(meanOf(list)); const dMed = medianOf(all).sub(medianOf(list));
  const m1 = modesOf(list); const m2 = modesOf(all);
  const dMode = m1.length === 1 && m2.length === 1 ? q(m2[0]).sub(q(m1[0])) : null;
  const abs = (x) => (x.cmp(0) < 0 ? x.neg() : x);
  if (dMode == null) throw new Error('the mode is not one value');
  if (!(abs(dMean).cmp(abs(dMed)) > 0 && abs(dMean).cmp(abs(dMode)) > 0)) throw new Error('the mean is not the one that moves most');
  return want(onlyChoice(it, (t) => t === 'הממוצע', 'the mean'));
};
const pairItems = (f) => { if (f.type !== 'pair') throw new Error('not two sources'); return f.items; };
O.st7j = (it) => {
  const [chart, table] = pairItems(it.fig); const [limit] = nums(it.text);
  const counted = table.rows.filter((r, i) => q(chart.values[i]).cmp(limit) <= 0).map((r) => q(r[1]));
  if (!counted.length) throw new Error('no jump counts');
  return want(meanOf(counted));
};
O.st7b = (it) => {
  const [thisYear, lastYear] = pairItems(it.fig);
  const spring = ['מרץ', 'אפריל', 'מאי'].map((m) => q(thisYear.values[thisYear.cats.indexOf(m)]));
  const last = q(lastYear.values[lastYear.cats.indexOf('אביב')]);
  return want(meanOf(spring).sub(last));
};
O.st7p = (it) => {
  const [table, pie] = pairItems(it.fig); const N = sum(table.rows.map((r) => q(r[1])));
  if (!sum(pie.values.map(q)).eq(100)) throw new Error(`the pie adds up to ${sum(pie.values.map(q))}%`);
  const hobby = strip(it.text).match(/בחרו ב(\S+)\?$/)[1]; const i = pie.cats.indexOf(hobby);
  if (i < 0) throw new Error(`no ${hobby} in the pie`);
  return want(q(pie.values[i]).mul(N).div(100));
};
O.st7c = (it) => {
  const f = it.fig;
  if (f.type === 'chart') { // one pie: its parts must not add up to 100%
    const s = sum(f.values.map(q)); if (s.eq(100)) throw new Error('the pie adds up to 100%: nothing is wrong');
    return want(onlyChoice(it, (t) => t.startsWith(`סכום האחוזים בעוגה הוא ${s}%`), 'the sum'));
  }
  const [table, chart] = pairItems(f);
  const diff = table.rows.map((r, i) => (q(r[1]).eq(q(chart.values[i])) ? -1 : i)).filter((i) => i >= 0);
  if (diff.length !== 1) throw new Error(`${diff.length} sports differ`);
  const [name, v] = table.rows[diff[0]];
  return want(onlyChoice(it, (t) => t === `${name}: בטבלה ${v} ובדיאגרמה ${chart.values[diff[0]]}`, 'the sport that differs'));
};
O.st8i = (it) => {
  const [[y1, v1], [y2, v2]] = it.fig.rows.map((r) => r.map(q)); const [Y] = nums(it.text);
  if (Y.cmp(y1) <= 0 || Y.cmp(y2) >= 0) throw new Error('not between the two years');
  return want(v1.add(v2.sub(v1).div(y2.sub(y1)).mul(Y.sub(y1))));
};
O.st8e = (it) => {
  const hour = (s) => q(String(s).replace(/\{:\}/, ':').split(':')[0]);
  const xs = it.fig.xs.map(hour); const vs = it.fig.values.map(q);
  const step = vs[1].sub(vs[0]); const dx = xs[1].sub(xs[0]);
  vs.forEach((v, i) => { if (i && !v.sub(vs[i - 1]).eq(step)) throw new Error('the graph is not even'); });
  const [T] = maths(it.text).map((m) => hour(m)); return want(vs.at(-1).add(step.mul(T.sub(xs.at(-1)).div(dx))));
};
O.st8w = (it) => {
  const [y1, y2, Y] = nums(it.text);
  const inside = Y.cmp(y1) > 0 && Y.cmp(y2) < 0;
  return want(onlyChoice(it, (t) => (inside ? /^אינטרפולציה/ : /^אקסטרפולציה/).test(t), inside ? 'inter' : 'extra'));
};
O.st8l = (it) => {
  const [r, , t1, t1b, a, T] = nums(it.text); // rate, from, to, (to again), the value at "to", the far time
  if (!t1.eq(t1b)) throw new Error("the story names two last times");
  const far = a.add(r.mul(T.sub(t1)));
  const vals = it.fig?.values; if (vals && !q(vals.at(-1)).eq(far)) throw new Error(`the drawn far value ${vals.at(-1)} is not ${far}`);
  return want(onlyChoice(it, (t) => t.startsWith('לא הגיוני') && numsPlain(t)[0].eq(far), 'not sensible'));
};

// ===== congr (and the proofs shared with sim): congruence worked out from the correspondence the question states
const plain = (s) => strip(s).replace(/\$/g, '').replace(/\\sphericalangle\s*/g, '∢').replace(/\\triangle\s*/g, '△').replace(/\\cong/g, '≅').replace(/\\sim/g, '∼').replace(/\\perp/g, '⊥').replace(/\\parallel/g, '∥').replace(/°/g, '°').replace(/\s+/g, ' ').trim();
/** "△ABC ≅ △YZX": the map from the first triangle's letters to the second's, in vertex order. */
function congMap(s) {
  const m = plain(s).match(/△([A-Z]{3}) ≅ △([A-Z]{3})/); if (!m) throw new Error('no congruence in the text');
  return Object.fromEntries([...m[1]].map((c, i) => [c, m[2][i]]));
}
/** Angles given in a text: { letter (or three letters): { a, b } } for (a·x + b)°, a = 0 for a number. */
function anglesIn(s) {
  const out = {};
  for (const m of plain(s).matchAll(/∢([A-Z]{1,3}) = \(?([^°)]*)\)?°/g)) { const L = linear(m[2]); out[m[1]] = { a: L.co.x || Z(0), b: L.c }; }
  return out;
}
/** Fill a pair of triangles' angles from what is given, the correspondence and the angle sum; then the asked value. */
function solveAngles(given, map, tri1, tri2, ask) {
  const val = {}; let xEq = null;
  for (const [k, e] of Object.entries(given)) if (e.a.eq(0)) val[k] = e.b; else xEq = [k, e];
  const inv = Object.fromEntries(Object.entries(map).map(([a, b]) => [b, a]));
  for (let round = 0; round < 6; round += 1) {
    for (const [a, b] of Object.entries(map)) { if (val[a] && !val[b]) val[b] = val[a]; if (val[b] && !val[a]) val[a] = val[b]; }
    for (const t of [tri1, tri2]) { const miss = [...t].filter((c) => !val[c]); if (miss.length === 1) val[miss[0]] = Z(180).sub(sum([...t].filter((c) => val[c]).map((c) => val[c]))); }
  }
  for (const t of [tri1, tri2]) if ([...t].every((c) => val[c]) && !sum([...t].map((c) => val[c])).eq(180)) throw new Error(`the angles of ${t} add up to ${sum([...t].map((c) => val[c]))}`);
  if (ask === 'x') {
    const [k, e] = xEq; const v = val[k] || val[map[k] || inv[k]]; if (!v) throw new Error('the x angle cannot be found');
    return v.sub(e.b).div(e.a);
  }
  if (!val[ask]) throw new Error(`∢${ask} cannot be found`);
  return val[ask];
}
const asksX = (s) => /מה x\?/.test(plain(s));
const askedAngle = (s) => plain(s).match(/מה גודל ∢([A-Z]{1,3})\?/)?.[1];
/** The angle at a point of a drawing, in degrees. */
function drawnAngle(pts, at, from, to) {
  const [p, a, b] = [pts[at], pts[from], pts[to]];
  const u = [a[0] - p[0], a[1] - p[1]]; const v = [b[0] - p[0], b[1] - p[1]];
  return (Math.acos(Math.max(-1, Math.min(1, (u[0] * v[0] + u[1] * v[1]) / (Math.hypot(...u) * Math.hypot(...v))))) * 180) / Math.PI;
}
const segLen = (pts, a, b) => Math.hypot(pts[a][0] - pts[b][0], pts[a][1] - pts[b][1]);
/** A geo drawing agrees with its numbers: every angle written as a number of degrees is drawn that size (within 1°). */
function geoAnglesCheck(f) {
  if (f?.type !== 'geo') return;
  for (const g of f.angles || []) {
    if (g.right) { const d = drawnAngle(f.pts, g.at, g.from, g.to); if (Math.abs(d - 90) > 0.5) throw new Error(`the right angle at ${g.at} is drawn ${d.toFixed(1)}°`); }
    const m = String(g.text ?? '').match(/^(\d+(?:\.\d+)?)°$/);
    if (m) { const d = drawnAngle(f.pts, g.at, g.from, g.to); if (Math.abs(d - Number(m[1])) > 1) throw new Error(`the angle at ${g.at} says ${m[1]}° and is drawn ${d.toFixed(1)}°`); }
  }
}
/** A geo drawing's numbered sides are drawn to one scale (within 2%), and sides with the same ticks are drawn equal. */
function geoSidesCheck(f) {
  if (f?.type !== 'geo' || !f.pts) return;
  const ratios = (f.segs || []).filter((s) => /^\d+(\.\d+)?$/.test(String(s.label ?? ''))).map((s) => segLen(f.pts, s.a, s.b) / Number(s.label));
  if (ratios.length > 1 && Math.max(...ratios) / Math.min(...ratios) > 1.02) throw new Error(`the numbered sides are not drawn to one scale: ${(f.segs || []).filter((s) => s.label).map((s) => `${s.a}${s.b}=${s.label}`).join(', ')}`);
  const byTicks = {};
  for (const s of f.segs || []) if (s.ticks) (byTicks[s.ticks] ||= []).push(segLen(f.pts, s.a, s.b));
  for (const [t, ls] of Object.entries(byTicks)) if (Math.max(...ls) / Math.min(...ls) > 1.02) throw new Error(`sides with ${t} ticks are drawn ${ls.map((l) => l.toFixed(2)).join(' and ')}`);
}

O.cg1a = (it) => {
  const map = congMap(it.text); const [t1, t2] = [Object.keys(map).join(''), Object.values(map).join('')];
  geoAnglesCheck(it.fig);
  return want(solveAngles(anglesIn(it.text), map, t1, t2, asksX(it.text) ? 'x' : askedAngle(it.text)));
};
O.cg1t = (it) => {
  // the correspondence from the tick marks: a vertex matches the vertex of the other triangle opposite a side with as many ticks
  const f = it.fig; geoAnglesCheck(f); geoSidesCheck(f);
  const [P1, P2] = f.polys.map((p) => p.pts);
  const ticks = (a, b) => (f.segs.find((s) => (s.a === a && s.b === b) || (s.a === b && s.b === a)) || {}).ticks;
  const opp = (tri, v) => tri.filter((c) => c !== v);
  const map = {};
  for (const v of P1) { const t = ticks(...opp(P1, v)); const w = P2.find((u) => ticks(...opp(P2, u)) === t); map[v] = w; }
  if (new Set(Object.values(map)).size !== 3) throw new Error('the ticks do not give a correspondence');
  return want(solveAngles(anglesIn(it.text), map, P1.join(''), P2.join(''), askedAngle(it.text)));
};
O.cg1x = (it) => {
  const map = congMap(it.text); const t = plain(it.text);
  const m = t.match(/AB = ([^ס]*) ס״מ/); const L = linear(m[1]);
  const want2 = [map.A, map.B];
  const side = [...t.matchAll(/([A-Z])([A-Z]) = (\d+) ס״מ/g)].find((s) => new Set([s[1], s[2]]).size === 2 && want2.includes(s[1]) && want2.includes(s[2]));
  if (!side) throw new Error(`no side ${want2.join('')} given`);
  return want(q(side[3]).sub(L.c).div(L.co.x));
};
O.cg1p = (it) => {
  const map = congMap(it.text); const side = plain(it.text).match(/שווה ל־([A-Z]{2})\?/)[1];
  const right = new Set([map[side[0]], map[side[1]]]);
  return want(onlyChoice(it, (t) => t.length === 2 && right.has(t[0]) && right.has(t[1]), `the side ${[...right].join('')}`));
};
/** The equalities "AB = DE", "∢B = ∢E" between two named triangles as a correspondence and the kinds of parts given. */
function equalities(s) {
  const t = plain(s); const parts = [];
  for (const m of t.matchAll(/(∢?)([A-Z]{1,2}) = (∢?)([A-Z]{1,2})(?=[,.:]|$| )/g)) {
    if (m[1] && m[3] && m[2].length === 1 && m[4].length === 1) parts.push({ kind: 'A', a: m[2], b: m[4] });
    else if (!m[1] && !m[3] && m[2].length === 2 && m[4].length === 2) parts.push({ kind: 'S', a: m[2], b: m[4] });
  }
  return parts;
}
/** The correspondence the equalities imply (an angle pairs its vertices; two sides at a vertex pair their common letters). */
function corrOf(parts) {
  const map = {};
  for (const p of parts) if (p.kind === 'A') map[p.a] = p.b;
  const S = parts.filter((p) => p.kind === 'S');
  for (let i = 0; i < S.length; i += 1) for (let j = i + 1; j < S.length; j += 1) {
    const c1 = [...S[i].a].find((c) => S[j].a.includes(c)); const c2 = [...S[i].b].find((c) => S[j].b.includes(c));
    if (c1 && c2) { if (map[c1] && map[c1] !== c2) throw new Error('the givens disagree on the correspondence'); map[c1] = c2; }
  }
  // a side whose one end is matched matches its other end too
  for (const p of S) for (const [x, y] of [[0, 1], [1, 0]]) if (map[p.a[x]] && !map[p.a[y]]) { const other = [...p.b].find((c) => c !== map[p.a[x]]); if ([...p.b].includes(map[p.a[x]])) map[p.a[y]] = other; }
  return map;
}
/** Which theorem the three given equalities prove, or null (two sides and an angle not between them, three angles). */
function theoremOf(parts) {
  const S = parts.filter((p) => p.kind === 'S'); const A = parts.filter((p) => p.kind === 'A');
  if (S.length === 3) return 'צ.צ.צ';
  if (S.length === 2 && A.length === 1) return S.every((s) => s.a.includes(A[0].a)) ? 'צ.ז.צ' : null;
  if (S.length === 1 && A.length === 2) return 'ז.צ.ז';
  return null;
}
O.cg2w = (it) => {
  const parts = equalities(it.text.split('האם')[0]); const th = theoremOf(parts);
  return want(onlyChoice(it, (t) => (th ? t === `חופפים לפי ${th}` : t === 'אין מספיק נתונים'), th || 'not enough'));
};
O.cg2m = (it) => {
  const head = it.text.split('. ')[0]; const parts = equalities(head);
  if (!theoremOf(parts)) throw new Error('the givens do not prove the triangles congruent');
  const tris = plain(it.text).match(/במשולשים ([A-Z]{3}) ו־([A-Z]{3})/);
  const map = corrOf(parts); const left = [...tris[1]].filter((c) => !map[c]); const free = [...tris[2]].filter((c) => !Object.values(map).includes(c));
  if (left.length === 1 && free.length === 1) map[left[0]] = free[0];
  if (Object.keys(map).length !== 3) throw new Error('no full correspondence');
  const rest = plain(it.text).slice(plain(head).length);
  return want(solveAngles(anglesIn(rest), map, tris[1], tris[2], asksX(it.text) ? 'x' : askedAngle(it.text)));
};
O.cg2n = (it) => {
  const parts = equalities(it.text.split('מה עוד')[0]); const [s1, s2] = parts;
  const v1 = [...s1.a].find((c) => s2.a.includes(c)); const v2 = [...s1.b].find((c) => s2.b.includes(c));
  return want(onlyChoice(it, (t) => plain(t) === `∢${v1} = ∢${v2}`, `∢${v1} = ∢${v2}`));
};
O.cg2p = (it) => {
  const [P] = nums(it.text); const sets = String(it.fig.label).match(/צלעות (\d+), (\d+), (\d+) ומשולש עם צלעות (\d+), (\d+), (\d+)/).slice(1).map(Number);
  const [a, b] = [sets.slice(0, 3), sets.slice(3)];
  if (a.reduce((x, y) => x + y) !== P.v || b.reduce((x, y) => x + y) !== P.v) throw new Error('the perimeters are not the text\'s');
  if ([a, b].some((s) => !isTriangle(s))) throw new Error('not a triangle');
  const same = [...a].sort().join() === [...b].sort().join();
  return want(onlyChoice(it, (t) => (same ? t === 'כן' : t === 'לא בהכרח'), 'not necessarily'));
};

/** The reason a proof row needs, worked out from the givens, the row and the drawing (the proof templates' semantics). */
function reasonRule(steps, i, given, fig) {
  const c = plain(steps[i].text ?? steps[i].claim); const g = plain(given);
  const before = steps.slice(0, i).map((s) => plain(s.text ?? s.claim));
  const isCong = /≅|∼/.test(c);
  const cong = steps.findIndex((s) => /≅|∼/.test(plain(s.text ?? s.claim)));
  const segEq = /^[A-Z]{2} = [A-Z]{2}$/.test(c); const angEq = /^∢[A-Z]{1,3} = ∢[A-Z]{1,3}( = 90°)?$/.test(c);
  if (isCong) {
    if (/∼/.test(c)) return 'לפי ז.ז';
    const S = before.filter((b) => /^[A-Z]{2} = [A-Z]{2}$/.test(b)).length; const A = before.filter((b) => /^∢/.test(b)).length;
    if (S === 3) return 'לפי צ.צ.צ';
    if (S === 2 && A === 1) return 'לפי צ.ז.צ';
    if (S === 1 && A >= 2) return 'לפי ז.צ.ז'; // (T6: a third pair of angles from the angle sum, then ז.צ.ז)
    throw new Error(`the congruence row stands on ${S} sides and ${A} angles`);
  }
  if (cong >= 0 && i > cong) {
    if (/= 90°$/.test(c)) return 'סכום זוויות צמודות הוא $180°$';
    if (segEq) return /∼/.test(plain(steps[cong].text ?? steps[cong].claim)) ? 'צלעות מתאימות במשולשים דומים' : 'צלעות מתאימות במשולשים חופפים';
    if (angEq) return 'זוויות מתאימות במשולשים חופפים';
  }
  const [l, r] = c.replace(/ = 90°$/, '').split(' = ');
  if (l === r) return segEq ? 'צלע משותפת' : 'זווית משותפת';
  if (g.includes(c) || g.includes(`${r} = ${l}`)) return 'נתון';
  if (segEq && /אמצע/.test(g)) return 'הגדרת אמצע קטע';
  if (angEq && /= 90°$/.test(c) && /⊥/.test(g)) return 'ישרים מאונכים יוצרים זוויות ישרות';
  if (angEq && /חוצה את ∢([A-Z])/.test(g)) { const v = g.match(/חוצה את ∢([A-Z])/)[1]; if (l.length === 4 && r.length === 4 && l[2] === v && r[2] === v) return 'הגדרת חוצה זווית'; }
  if (angEq && fig?.pts) {
    // the rays of each angle: a three-letter angle names them; a one-letter angle takes them from the triangles named
    const tris = steps.map((s) => plain(s.text ?? s.claim).match(/△([A-Z]{3})/g) || []).flat().map((t) => t.slice(1));
    const rays = (a) => { const s = a.slice(1); if (s.length === 3) return [s[1], s[0], s[2]]; const t = tris.find((x) => x.includes(s)); return t ? [s, ...[...t].filter((ch) => ch !== s)] : null; };
    const [ra, rb] = [rays(l), rays(r)];
    if (ra && rb && ra.every((p) => fig.pts[p]) && rb.every((p) => fig.pts[p])) {
      const dir = (v, w) => { const d = [fig.pts[w][0] - fig.pts[v][0], fig.pts[w][1] - fig.pts[v][1]]; const n = Math.hypot(...d); return [d[0] / n, d[1] / n]; };
      const da = [dir(ra[0], ra[1]), dir(ra[0], ra[2])]; const db = [dir(rb[0], rb[1]), dir(rb[0], rb[2])];
      const same = (u, v) => Math.abs(u[0] - v[0]) < 1e-6 && Math.abs(u[1] - v[1]) < 1e-6; const opp = (u, v) => same(u, [-v[0], -v[1]]);
      const pairs = (f2) => (f2(da[0], db[0]) && f2(da[1], db[1])) || (f2(da[0], db[1]) && f2(da[1], db[0]));
      if (ra[0] === rb[0] && pairs(opp)) return 'זוויות קודקודיות';
      if (/∥/.test(g) && pairs(same)) return 'זוויות מתאימות בין ישרים מקבילים';
      if (/∥/.test(g) && pairs(opp)) return 'זוויות מתחלפות בין ישרים מקבילים';
      if (ra[0] === rb[0] && pairs(same)) return 'זווית משותפת';
    }
  }
  if (angEq && cong >= 0 && i < cong) return 'סכום הזוויות במשולש הוא $180°$';
  throw new Error(`no rule for the row "${c}"`);
}
/** A proof object's answer: every row's reason (asked or shown) is the one its claim needs, and the order is sound. */
function proofAnswer(it) {
  const m = it.manip; const steps = m.part.steps; const a = it.answer;
  steps.forEach((s, i) => {
    const shown = s.fixed ?? s.reason.choices[a.reasons[i]];
    const need = reasonRule(steps, i, m.given, m.fig);
    if (plain(shown) !== plain(need)) throw new Error(`row ${i + 1} "${plain(s.text)}" gives "${plain(shown)}", needs "${plain(need)}"`);
  });
  const cong = steps.findIndex((s) => /≅|∼/.test(plain(s.text)));
  const at = (i) => a.order.indexOf(i);
  steps.forEach((s, i) => { if (i < cong && at(i) > at(cong)) throw new Error('a row the congruence stands on comes after it'); if (i > cong && at(i) < at(cong)) throw new Error('a conclusion comes before the congruence'); });
  return want(a);
}
O.cg3o = proofAnswer;
O.cg3f = proofAnswer;
O.cg3e = (it) => {
  const rows = it.fig.rows; let bad = -1;
  rows.forEach((r, i) => { if (bad >= 0) return; let need; try { need = reasonRule(rows, i, it.fig.given, null); } catch { need = null; } if (need && plain(need) !== plain(r.reason)) bad = i; });
  // a conclusion from the congruence placed above it, or the congruence on two sides and an angle not between them
  const cong = rows.findIndex((r) => /≅/.test(plain(r.claim)));
  const early = rows.findIndex((r, i) => i < cong && /מתאימות במשולשים/.test(r.reason));
  if (early >= 0) bad = early;
  else {
    const parts = equalities(rows.slice(0, cong).map((r) => plain(r.claim)).join(', '));
    if (!theoremOf(parts) || `לפי ${theoremOf(parts)}` !== rows[cong].reason) bad = cong;
  }
  if (bad < 0) throw new Error('every row is right');
  return want(onlyChoice(it, (t) => t === `שורה ${bad + 1}`, `row ${bad + 1}`));
};
O.cg3u = (it) => {
  const t = plain(it.text); geoAnglesCheck(it.fig);
  const ang = (k) => { const m = t.match(new RegExp(`∢${k} = \\(?([^°)]*)\\)?°`)); return m ? linear(m[1]) : null; };
  const val = (k) => ang(k)?.c;
  if (/בדלתון/.test(t)) { // AB = AD, CB = CD: ABC ≅ ADC (SSS)
    const a = val('BAC'); const c = val('BCA');
    if (/∢BAD\?/.test(t)) return want(a.mul(2));
    if (/∢ADC\?/.test(t)) return want(Z(180).sub(a).sub(c));
  }
  if (/נחתכים בנקודה M/.test(t)) { // AM = MB, CM = MD: AMC ≅ BMD (SAS, vertical angles at M): A↔B, C↔D
    if (asksX(t)) { const e = ang('ACM'); return want(val('MDB').sub(e.c).div(e.co.x)); }
    if (/∢MDB\?/.test(t)) return want(Z(180).sub(val('CAM')).sub(val('AMC')));
  }
  if (/מאונך ל־AB/.test(t) && /אמצע AB/.test(t)) return want(Z(180).sub(val('CAD').mul(2))); // ADC ≅ BDC: ∢ACB = 2(90 − a)
  throw new Error('an unknown figure');
};
/** The foot of a segment from A on BC in a drawing: which kind it is. */
function footKind(f, X) {
  const P = f.pts; const [A, B, C, F] = [P.A, P.B, P.C, P[X]];
  const perp = Math.abs((F[0] - A[0]) * (C[0] - B[0]) + (F[1] - A[1]) * (C[1] - B[1])) < 1e-6;
  const mid = Math.abs(F[0] - (B[0] + C[0]) / 2) < 1e-6 && Math.abs(F[1] - (B[1] + C[1]) / 2) < 1e-6;
  const bis = Math.abs(drawnAngle(P, 'A', 'B', X) - drawnAngle(P, 'A', X, 'C')) < 1e-6;
  return { altitude: perp, median: mid, bisector: bis };
}
O.cg4s = (it) => {
  const kind = /הגובה/.test(it.text) ? 'altitude' : /התיכון/.test(it.text) ? 'median' : 'bisector';
  return want(onlyChoice(it, (t) => /^A[A-Z]$/.test(t) && footKind(it.fig, t[1])[kind], kind));
};
const givenLens = (s) => Object.fromEntries([...plain(s).matchAll(/([A-Z]{2}) = (\d+(?:\.\d+)?)/g)].map((m) => [m[1], q(m[2])]));
O.cg4p = (it) => {
  const L = givenLens(it.text); const P = it.fig.pts;
  for (const [k, v] of Object.entries(L)) if (Math.abs(segLen(P, k[0], k[1]) - v.v) > 1e-6) throw new Error(`${k} is ${v} and drawn ${segLen(P, k[0], k[1])}`);
  return want(L.AB.add(L.BC.div(2)).add(L.AD));
};
O.cg4c = (it) => {
  const t = strip(it.text); const always = /שווי שטח/.test(t) ? true : /חופפים|אותו היקף/.test(t) ? false : null;
  if (always == null) throw new Error('an unknown claim');
  return want(onlyChoice(it, (s) => s === (always ? 'נכון תמיד' : 'לא בהכרח'), 'the truth'));
};
O.cg4a = (it) => {
  const t = plain(it.text); const L = givenLens(it.text); const P = it.fig.pts;
  const area = t.match(/שטח △ABD הוא (\d+(?:\.\d+)?)/);
  for (const [k, v] of Object.entries(L)) if (Math.abs(segLen(P, k[0], k[1]) - v.v) > 1e-6) throw new Error(`${k} is ${v} and drawn ${segLen(P, k[0], k[1]).toFixed(3)}`);
  if (Math.abs(P.D[0] - (P.B[0] + P.C[0]) / 2) > 1e-9) throw new Error('D is not drawn in the middle of BC');
  if (/מה שטח △ABD\?/.test(t)) return want(L.BC.div(2).mul(L.AH).div(2));
  if (/מה אורך הגובה AH/.test(t)) { const h = q(area[1]).mul(2).div(L.BC.div(2)); if (Math.abs(P.A[1] - P.H[1] - h.v) > 1e-6) throw new Error(`AH is ${h} and drawn ${P.A[1] - P.H[1]}`); return want(h); }
  throw new Error('an unknown question');
};
O.cg4r = (it) => {
  const L = givenLens(it.text);
  if (!L.AB.mul(L.AB).add(L.BC.mul(L.BC)).eq(L.AC.mul(L.AC))) throw new Error('AB² + BC² ≠ AC² in a rectangle');
  return want(L.AB.mul(L.BC.div(2)).div(2));
};
O.cg5m = (it) => {
  const L = givenLens(it.text); const opp = { AB: 'C', BC: 'A', AC: 'B' };
  const longest = Object.entries(L).sort((x, y) => y[1].cmp(x[1]));
  if (longest[0][1].eq(longest[1][1])) throw new Error('two longest sides');
  if (!isTriangle(Object.values(L))) throw new Error('not a triangle');
  return want(onlyChoice(it, (t) => plain(t) === `∢${opp[longest[0][0]]}`, 'the largest angle'));
};
O.cg5n = (it) => { const [a, b] = nums(it.text); let n = 0; for (let c = 1; c < a.v + b.v; c += 1) if (isTriangle([a, b, Z(c)])) n += 1; return want(Z(n)); };
O.cg5i = (it) => {
  const [a, b] = nums(it.text); const ok = [[a, a, b], [a, b, b]].filter(isTriangle);
  if (ok.length !== 1) throw new Error(`${ok.length} isosceles triangles have sides ${a} and ${b}`);
  return want(sum(ok[0]));
};
O.cg5c = (it) => { const s = nums(it.text); return want(onlyChoice(it, (t) => (isTriangle(s) ? /^כן/ : /^לא/).test(t), 'the right answer')); };

// ===== sim (isosceles triangles and similarity)
/** Is a theorem's converse true? Judged here, statement by statement. */
const CONVERSE_TRUE = [
  [/משולש עם שתי זוויות שוות הוא שווה־שוקיים/, true],
  [/משולש שבו תיכון לצלע הוא גם הגובה לצלע הוא שווה־שוקיים/, true],
  [/משולשים שווים בשטח הם חופפים/, false],
  [/זוויות שוות הן זוויות קודקודיות/, false],
  [/משולש שווה־שוקיים הוא שווה־צלעות/, false],
];
O.sm1v = (it) => {
  const conv = strip(it.text).split('המשפט ההפוך')[1]; const hit = CONVERSE_TRUE.find(([re]) => re.test(conv));
  if (!hit) throw new Error('a converse this oracle does not know');
  return want(onlyChoice(it, (t) => t === (hit[1] ? 'נכון' : 'לא נכון בהכרח'), 'the truth'));
};
O.sm1x = (it) => {
  const t = plain(it.text); const side = (k) => linear(t.match(new RegExp(`${k} = ([^,(]*)`))[1]);
  if (!/∢B = ∢C/.test(t)) throw new Error('not the equal angles at B and C');
  const [AB, AC, BC] = ['AB', 'AC', 'BC'].map(side); // ∢B = ∢C: the sides opposite them, AC and AB, are equal
  const x = AC.c.sub(AB.c).div(AB.co.x.sub(AC.co.x));
  const val = (L) => L.co.x.mul(x).add(L.c);
  if (!isTriangle([val(AB), val(AC), val(BC)])) throw new Error(`the sides ${val(AB)}, ${val(AC)}, ${val(BC)} make no triangle`);
  const P = it.fig.pts; const r = segLen(P, 'A', 'B') / val(AB).v;
  if ([['A', 'C', AC], ['B', 'C', BC]].some(([a, b, L]) => Math.abs(segLen(P, a, b) / val(L).v / r - 1) > 0.02)) throw new Error('the drawing is not the triangle of the question');
  return want(val(AB));
};
O.sm1c = (it) => {
  const t = plain(it.text); const C = q(t.match(/∢C = (\d+)°/)[1]); const A = Z(180).sub(C.mul(2)); const B = C;
  // the angles of the three triangles of the drawing, from the line BD
  let small; let other;
  if (/BD חוצה את ∢B/.test(t)) { const h = B.div(2); small = [h, C, Z(180).sub(h).sub(C)]; other = [A, h, Z(180).sub(A).sub(h)]; } else if (/BD מאונך ל־AC/.test(t)) { small = [Z(90), C, Z(90).sub(C)]; other = [Z(90), A, Z(90).sub(A)]; } else throw new Error('an unknown line');
  const iso = (a) => new Set(a.map(String)).size < 3;
  return want(Z([[A, B, C], small, other].filter(iso).length));
};
O.sm1h = (it) => {
  const L = givenLens(it.text); const leg = q(plain(it.text).match(/AB = AC = (\d+)/)[1]); const half = L.BC.div(2);
  const ad = qsqrt(leg.mul(leg).sub(half.mul(half))); if (!ad) throw new Error('AD is not whole');
  geoSidesCheck(it.fig); return want(ad);
};
O.sm1p = proofAnswer;
O.sm2f = (it) => { const [a, b] = nums(it.text); const up = /בהגדלה/.test(it.text); if (up !== b.cmp(a) > 0) throw new Error('enlarged or reduced, the numbers say the other'); return want(b.div(a)); };
O.sm2m = (it) => {
  const [len, wid, len2] = nums(it.text); const k = len2.div(len);
  if ((k.cmp(1) > 0) !== /הוגדל/.test(it.text)) throw new Error('enlarged or reduced, the numbers say the other');
  geoSidesCheck({ ...it.fig, segs: it.fig.segs.filter((s) => s.label !== '?').slice(0, 2) });
  return want(wid.mul(k));
};
O.sm2s = (it) => {
  const t = strip(it.text); let yes;
  if (/כל שני ריבועים/.test(t)) yes = true; else if (/כל שני מלבנים/.test(t)) yes = false; else if (/ריבוע ומעוין/.test(t)) yes = false;
  else { const [a, b, c, d] = nums(t); yes = a.mul(d).eq(b.mul(c)) || a.mul(c).eq(b.mul(d)); }
  return want(onlyChoice(it, (s) => (yes ? /^כן/ : /^לא/).test(s), yes ? 'yes' : 'no'));
};
/** The similar triangle, in vertex order: the parallel lines pair the vertices whose angles are equal. */
O.sm3w = (it) => {
  const t = plain(it.text); let right;
  if (/AB ∥ CD/.test(t) && /נחתכים ב־M/.test(t)) right = 'DMC'; // ∢MAB = ∢MDC and ∢MBA = ∢MCD (alternate), ∢M vertical
  else if (/DE ∥ BC/.test(t)) right = 'ABC'; // ∢A common, ∢ADE = ∢ABC (corresponding)
  const asked = t.match(/דומה △([A-Z]{3})/)[1];
  if (!(asked === 'AMB' || asked === 'ADE')) throw new Error('an unknown triangle');
  return want(onlyChoice(it, (s) => plain(s) === `△${right}`, right));
};
O.sm3p = (it) => { const L = givenLens(it.text); geoSidesCheck(it.fig); return want(L.DE.mul(L.AD.add(L.DB)).div(L.AD)); };
O.sm3b = (it) => { const L = givenLens(it.text); geoSidesCheck(it.fig); return want(L.AB.mul(L.MD).div(L.AM)); };
O.sm3s = (it) => {
  const [h, s, S] = nums(it.text); const P = it.fig.pts;
  if (Math.abs((P._th[1] - P._t[1]) - h.mul(S).div(s).v) > 1e-9) throw new Error('the drawn tree is not the answer\'s height');
  return want(h.mul(S).div(s));
};
O.sm3a = (it) => {
  const [a, b, c, d] = nums(it.text); const t1 = [a, b, Z(180).sub(a).sub(b)].map(String).sort(); const t2 = [c, d, Z(180).sub(c).sub(d)].map(String).sort();
  const yes = t1.join() === t2.join(); geoAnglesCheck(it.fig);
  return want(onlyChoice(it, (s) => (yes ? /^כן/ : /^לא/).test(s), yes ? 'yes' : 'no'));
};
O.sm3o = proofAnswer;
O.sm4a = (it) => { const L = givenLens(it.text); const [A] = nums(it.text.split('שטח')[1]); const k = L.DE.div(L.AB); return want(A.mul(k).mul(k)); };
O.sm4p = (it) => { const L = givenLens(it.text); const [P] = nums(it.text.split('ההיקף של')[1]); return want(P.mul(L.DE.div(L.AB))); };
O.sm4k = (it) => {
  const [A1, A2, s] = nums(it.text); const k = qsqrt(A2.div(A1)); if (!k) throw new Error('the areas\' ratio is not a square');
  return want(s.mul(k));
};
O.sm4g = (it) => { const [k] = nums(it.text); return want(onlyChoice(it, (t) => q(t).eq(k.mul(k)), 'k²')); };

// ===== sys (equations with percent, systems, word problems, inequalities)
const casesOf = (tex) => { const m = String(tex).match(/\\begin\{cases\}([\s\S]*)\\end\{cases\}/); if (!m) throw new Error('no system'); return m[1].split('\\\\').map((r) => relation(r.trim())); };
const pct = (p) => p.div(100);
O.sy1 = (it) => {
  const [p, M] = nums(it.text); const up = /התייקר/.test(it.text);
  return want(M.div(Z(1).add(up ? pct(p) : pct(p).neg())));
};
O.sy1t = (it) => {
  const t = strip(it.text); const m = t.match(/^(\S+) (יקר|יקרה|זול|זולה) ב־\$(\d+)\\%\$ מ(\S+)\. יחד שילמו עליהם \$(\d+)\$/);
  const [, other, adj, p, base, T] = m; const f = Z(1).add(/יקר/.test(adj) ? pct(q(p)) : pct(q(p)).neg());
  const baseCost = q(T).div(Z(1).add(f)); const asked = t.match(/כמה (?:עלה|עלתה|עלו) (\S+)\?$/)[1];
  if (asked === base) return want(baseCost);
  if (asked === other) return want(baseCost.mul(f));
  throw new Error(`asks about ${asked}, neither ${other} nor ${base}`);
};
O.sy1h = (it) => {
  const [T, p] = nums(it.text); const A = T.div(Z(2).mul(Z(1).sub(pct(p))));
  if (!A.isInt()) throw new Error('not a whole number of people');
  return want(/באולם א׳\?$/.test(strip(it.text)) ? A : T.sub(A));
};
O.sy1e = (it) => {
  const [p, M] = nums(it.text); const up = /התייקר/.test(it.text); const old = M.div(Z(1).add(up ? pct(p) : pct(p).neg()));
  return want(onlyChoice(it, (t) => { const r = relation(t); const a = r.co.x || Z(0); return !a.eq(0) && r.c.neg().div(a).eq(old); }, `an equation solved by ${old}`));
};
function systemAnswer(it) {
  const [r1, r2] = casesOf(it.display); const s = solve2(r1, r2);
  if (s.kind !== 'one') throw new Error(`the system has ${s.kind === 'none' ? 'no solution' : 'infinitely many solutions'}, the item one`);
  return want([s.x, s.y]);
}
O.sy2 = systemAnswer; O.sy2h = systemAnswer; O.sy3 = systemAnswer;
O.sy2w = (it) => {
  const [r1, r2] = casesOf(it.display);
  return want(onlyChoice(it, (t) => { const [x, y] = numsPlain(t); return holds(r1, { x, y }) && holds(r2, { x, y }); }, 'the solution'));
};
O.sy2m = (it) => {
  const [l1, l2] = it.manip.lines.map((l) => ({ m: q(l.m), b: q(l.b) }));
  if (l1.m.eq(l2.m)) throw new Error('parallel lines');
  const x = l2.b.sub(l1.b).div(l1.m.sub(l2.m)); const y = l1.m.mul(x).add(l1.b);
  if (!x.isInt() || !y.isInt() || Math.abs(x.v) > it.manip.range || Math.abs(y.v) > it.manip.range) throw new Error(`the meeting point (${x}, ${y}) cannot be placed on the grid`);
  return want([x.v, y.v]);
};
O['sys-n'] = (it) => {
  const [r1, r2] = casesOf(it.display); const s = solve2(r1, r2);
  const t = { one: 'פתרון אחד', none: 'אין פתרון', many: 'אינסוף פתרונות' }[s.kind];
  return want(onlyChoice(it, (c) => c === t, t));
};
O.sy3m = (it) => {
  const [r1, r2] = casesOf(it.display); const v = /ש־\$y\$ ייעלם|y\$ ייעלם/.test(it.text) ? 'y' : 'x';
  const b1 = r1.co[v] || Z(0); const b2 = r2.co[v] || Z(0);
  const works = (t) => {
    const k = numsPlain(t)[0] ?? Z(1); const add = /מחברים/.test(t);
    const [u, w] = /השנייה ב/.test(t) ? [b1, b2.mul(k)] : /הראשונה ב/.test(t) ? [b1.mul(k), b2] : [b1, b2];
    return (add ? u.add(w) : u.sub(w)).eq(0);
  };
  return want(onlyChoice(it, works, `what makes ${v} vanish`));
};
O.sy4 = (it) => {
  const t = strip(it.text); const n = nums(t);
  let p; let qq; let N; let M; let askFirst;
  if (/ארנבים ותרנגולות/.test(t)) { [N, M] = n; p = Z(4); qq = Z(2); askFirst = /כמה ארנבים/.test(t); } else if (/מטבעות/.test(t)) { [N, p, qq, M] = n; askFirst = new RegExp(`מטבעות של \\$${p}\\$\\s₪ יש`).test(t); } else if (/כרטיסים/.test(t)) { [N, p, qq, M] = n; askFirst = /כרטיסים למבוגרים נמכרו\?/.test(t); } else throw new Error('an unknown story');
  const s = solve2(relation(`x + y = ${N}`), relation(`${p}x + ${qq}y = ${M}`));
  if (s.kind !== 'one' || !s.x.isInt() || !s.y.isInt() || s.x.cmp(0) < 0 || s.y.cmp(0) < 0) throw new Error('no whole answer');
  return want(askFirst ? s.x : s.y);
};
O.sy4p = (it) => {
  const t = strip(it.text); const n = nums(t); const [N, p, qq, M] = /מטבעות/.test(t) ? n : [n[0], n[1], n[2], n[3]];
  const target = [relation(`x + y = ${N}`), relation(`${p}x + ${qq}y = ${M}`)];
  const same = (a, b) => a.rel === b.rel && a.c.eq(b.c) && ['x', 'y'].every((v) => (a.co[v] || Z(0)).eq(b.co[v] || Z(0)));
  return want(onlyChoice(it, (c) => { const rs = casesOf(c); return rs.length === 2 && target.every((r) => rs.some((x) => same(x, r))); }, 'the system'));
};
O.sy4s = (it) => { const [S, D] = nums(it.text); const big = S.add(D).div(2); return want(/הגדול\?/.test(it.text) ? big : S.sub(big)); };
O.sy4l = (it) => {
  const [P1, a1, b1, d, P2, a2, b2] = nums(it.text); // a1 towels + b1 sheets = P1; (1 − d) (a2 towels + b2 sheets) = P2
  const s = solve2(relation(`${a1}x + ${b1}y = ${P1}`), relation(`${a2}x + ${b2}y = ${P2.div(Z(1).sub(pct(d)))}`));
  return want(/סדין\?/.test(it.text) ? s.y : s.x);
};
/** The solutions of a one-letter linear inequality as { bound, dir: 1 (x > bound or ≥) or −1, closed }. */
function solveIneq(tex) {
  const r = relation(tex); const [v] = Object.keys(r.co); const a = r.co[v]; const bound = r.c.neg().div(a);
  const flip = a.cmp(0) < 0; const rel = flip ? { '<': '>', '>': '<', '<=': '>=', '>=': '<=' }[r.rel] : r.rel;
  return { bound, dir: rel[0] === '>' ? 1 : -1, closed: rel.length === 2, rel };
}
const solves = (tex, x) => holds(relation(tex), { [Object.keys(relation(tex).co)[0]]: x });
O.sy5r = (it) => { const s = solveIneq(it.ineq); return want({ at: s.bound.v, dir: s.dir, closed: s.closed }); };
O.sy5g = (it) => {
  const s = solveIneq(it.display); const small = /הקטן ביותר/.test(it.text);
  if ((s.dir > 0) !== small) throw new Error('asks the smallest of a set bounded above, or the largest of one bounded below');
  let x = s.bound.isInt() ? s.bound : Z(Math.floor(s.bound.v));
  for (let i = 0; i < 4 && !solves(it.display, x); i += 1) x = x.add(s.dir);
  if (!solves(it.display, x) || solves(it.display, x.sub(s.dir))) throw new Error('no extreme whole solution found');
  return want(onlyChoice(it, (t) => q(t).eq(x), `${x}`));
};
O.sy5c = (it) => {
  const among = listIn(it.text); const yes = among.filter((x) => solves(it.display, x));
  return want(/סכום/.test(it.text) ? sum(yes) : Z(yes.length));
};
O.sy5t = (it) => {
  const rows = it.whole; let n = 0; for (let x = -200; x <= 200; x += 1) if (rows.every((r) => solves(r, Z(x)))) n += 1;
  const shown = String(it.display).replace(/\\begin\{aligned\}|\\end\{aligned\}/g, '').split('\\\\').map((r) => r.replace(/&/g, '').trim());
  if (shown.some((r, i) => relation(r).rel !== relation(rows[i]).rel)) throw new Error('the shown inequalities are not the counted ones');
  return want(Z(n));
};
O.sy5b = (it) => {
  const t = strip(it.text); const n = nums(t); let target;
  if (/מעלית/.test(t)) { const [W, P, w] = n; target = `${P} + ${w}n \\le ${W}`; } else if (/טיסן/.test(t)) { const [tA, tB, T0] = n; target = `${tA}a + ${tB}b \\le ${T0}`; } else if (/בונוס/.test(t)) { const [b0, w, G] = n; target = `${b0} + ${w}n \\ge ${G}`; } else throw new Error('an unknown story');
  const T = relation(target);
  const same = (a) => a.rel === T.rel && a.c.eq(T.c) && Object.keys({ ...a.co, ...T.co }).every((v) => (a.co[v] || Z(0)).eq(T.co[v] || Z(0)));
  return want(onlyChoice(it, (c) => same(relation(c)), target));
};
O.sy5m = (it) => want(onlyChoice(it, (t) => solves(it.display, q(t)), 'the one that solves it'));
O.sy5w = (it) => { const [W, P, w] = nums(it.text); return want(Z(Math.floor(W.sub(P).div(w).v + 1e-12))); };

// ===== prob (counted outcome by outcome)
const count = (lo, hi, pred) => { let n = 0; for (let v = lo; v <= hi; v += 1) if (pred(v)) n += 1; return n; };
/** The event of a question ("מספר זוגי", "גדול מ־4", "כפולה של 3", "4 או פחות", "לפחות 5", "קטן מ־3") as a test on a value. */
function eventOf(s) {
  const t = strip(s); const k = (re) => Number(t.match(re)[1]);
  if (/מספר זוגי/.test(t)) return (v) => v % 2 === 0;
  if (/אי־זוגי/.test(t)) return (v) => v % 2 === 1;
  if (/גדול מ־\$(\d+)\$/.test(t)) { const a = k(/גדול מ־\$(\d+)\$/); return (v) => v > a; }
  if (/קטן מ־\$(\d+)\$/.test(t)) { const a = k(/קטן מ־\$(\d+)\$/); return (v) => v < a; }
  if (/כפולה של \$(\d+)\$/.test(t)) { const a = k(/כפולה של \$(\d+)\$/); return (v) => v % a === 0; }
  if (/\$(\d+)\$ או פחות/.test(t)) { const a = k(/\$(\d+)\$ או פחות/); return (v) => v <= a; }
  if (/לפחות \$(\d+)\$/.test(t)) { const a = k(/לפחות \$(\d+)\$/); return (v) => v >= a; }
  throw new Error(`an unknown event: ${t}`);
}
/** How many equally likely outcomes, 1..n: a die, a wheel of n sectors, a box of n cards. */
const outcomesOf = (t) => (/קובייה/.test(t) ? 6 : Number(strip(t).match(/(?:גלגל של|בקופסה) \$(\d+)\$/)[1]));
O.pr1 = (it) => { const n = outcomesOf(it.text); const e = eventOf(it.text.split('ההסתברות')[1]); return want(new Q(BigInt(count(1, n, e)), BigInt(n))); };
O.pr1r = (it) => {
  const [N, , , , a, b, c] = nums(it.text); // N tickets, 1..N; winners 1..a and b..c (= N)
  if (!c.eq(N)) throw new Error('the second range does not end at the last ticket');
  return want(a.add(N.sub(b).add(1)).div(N));
};
O.pr1f = (it) => want(onlyChoice(it, (t) => /^לא/.test(t), 'no symmetry, no equal chances'));
O.pr1s = (it) => {
  const rows = it.fig.rows.map(([c, p]) => [c, q(p)]); const t = strip(it.text);
  const pick = /כמעט בטוח שירד/.test(t) ? (p) => p.cmp(q('0.8')) >= 0 && p.cmp(1) < 0
    : /לא סביר שירד גשם, אבל זה יכול לקרות/.test(t) ? (p) => p.cmp(0) > 0 && p.cmp(q('0.2')) <= 0
      : /בטוח שלא ירד/.test(t) ? (p) => p.eq(0) : /שווה לסיכוי שלא ירד/.test(t) ? (p) => p.eq(q('0.5')) : null;
  if (!pick) throw new Error('an unknown question');
  const hits = rows.filter(([, p]) => pick(p)); if (hits.length !== 1) throw new Error(`${hits.length} cities fit`);
  return want(onlyChoice(it, (s) => s === hits[0][0], hits[0][0]));
};
O.pr2 = (it) => {
  const [o, b, y] = nums(it.text); const rest = Z(1).sub(o).sub(b).sub(y); if (rest.cmp(0) <= 0) throw new Error('nothing left for purple');
  const pie = it.fig.values.map(q); if (!sum(pie).eq(1) || !pie[3].eq(rest)) throw new Error('the pie does not match the text');
  const not = { כתום: o, כחול: b, צהוב: y, סגול: rest }[strip(it.text).match(/לא לקבל (\S+)\?/)[1]];
  return want(Z(1).sub(not));
};
O.pr2a = (it) => { const n = outcomesOf(it.text); const e = eventOf(it.text.split('ההסתברות')[1]); return want(new Q(BigInt(count(1, n, e)), BigInt(n))); };
O.pr2p = (it) => {
  const [N, pBlue, k] = nums(it.text); const blue = N.mul(pBlue); const pink = blue.mul(k); const other = N.sub(blue).sub(pink);
  if (!blue.isInt() || other.cmp(0) < 0) throw new Error('not whole pens');
  return want(other.div(N));
};
O.pr2c = (it) => { const [p] = nums(it.text); return want(Z(100).sub(p)); };
O.pr2f = (it) => { const [p] = nums(it.text); return want(onlyChoice(it, (t) => t === `בימים כאלה יורד גשם בערך ב־${p}% מהם`, 'the frequency meaning')); };
O.pr2g = (it) => want(onlyChoice(it, (t) => /עדיין חצי/.test(t), 'still a half'));
const dicePairs = () => { const out = []; for (let a = 1; a <= 6; a += 1) for (let b = 1; b <= 6; b += 1) out.push([a, b]); return out; };
O.pr3 = (it) => {
  const t = strip(it.text); const [s] = nums(t);
  const ok = /או יותר/.test(t) ? (v) => v >= s.v : /או פחות/.test(t) ? (v) => v <= s.v : (v) => v === s.v;
  const cells = it.fig.cells.flat().map(Number); const pairs = dicePairs();
  if (!pairs.every(([a, b], i) => cells[i] === a + b)) throw new Error('the table of sums is wrong');
  return want(new Q(BigInt(pairs.filter(([a, b]) => ok(a + b)).length), 36n));
};
O.pr3t = (it) => {
  const t = strip(it.text); let n1; let n2; let k1; let k2;
  if (/מטילים מטבע, ואחר כך קובייה/.test(t)) { n1 = 2; n2 = 6; k1 = /לקבל עץ|לקבל פלי/.test(t) ? 1 : null; k2 = count(1, 6, eventOf(t.split('ואחר כך מספר')[1] ? `מספר${t.split('ואחר כך מספר')[1]}` : '')); } else if (/מטילים קובייה, ואחר כך מסובבים גלגל/.test(t)) {
    n1 = 6; n2 = 4; k1 = count(1, 6, eventOf(t.split('לקבל')[1].split('ואחר כך')[0]));
    k2 = ['אדום', 'כחול', 'ירוק', 'צהוב'].filter((c) => t.split('ואחר כך').at(-1).includes(c)).length;
  } else if (/בגלגל הראשון/.test(t)) {
    const [a, , , b] = nums(t); n1 = a.v; n2 = b.v;
    const [p1, p2] = t.split('ההסתברות')[1].split(', ובשני');
    k1 = count(1, n1, eventOf(p1)); k2 = count(1, n2, eventOf(p2));
  } else throw new Error('an unknown experiment');
  const f = it.fig; if (f.rows.length !== n1 || f.cols.length !== n2) throw new Error(`the table is ${f.rows.length} × ${f.cols.length}, not ${n1} × ${n2}`);
  return want(new Q(BigInt(k1 * k2), BigInt(n1 * n2)));
};
O.pr3d = (it) => {
  const w = it.manip.watch; const p = new Q(BigInt(dicePairs().filter(([a, b]) => a + b === w).length), 36n);
  const i = it.answer.choices.findIndex((c) => numsPlain(c.tex)[0]?.eq(p));
  if (i < 0 || it.answer.choices.filter((c) => numsPlain(c.tex)[0]?.eq(p)).length !== 1) throw new Error('not one right estimate');
  return want({ ...it.answer, answer: i });
};
O.pr3s = (it) => want(onlyChoice(it, (t) => /^שווה/.test(t), 'equally likely'));
O.pr3o = (it) => { const [a, b] = numsPlain(maths(it.text)[0]); return want(onlyChoice(it, (t) => (a.eq(b) ? /^תוצאה אחת/ : /^שתי תוצאות/).test(t), 'the count')); };

// ===== space (Pythagoras in solids)
const sq = (x) => x.mul(x);
/** The box of a question: base a × b, height c; its drawing must have the same edges. */
function boxOf(it) {
  const [a, b, c] = nums(it.text); const f = it.fig;
  if (f?.type !== 'solid' || f.shape !== 'box' || !q(f.a).eq(a) || !q(f.b).eq(b) || !q(f.c).eq(c)) throw new Error(`the drawn box ${f?.a}×${f?.b}×${f?.c} is not the question's`);
  return [a, b, c];
}
O.sp1s = (it) => { const [a, b, c] = boxOf(it); return want(rootAnswer(it, sq(a).add(sq(b)).add(sq(c)))); };
O.sp1c = (it) => { const [a] = nums(it.text); solidFig(it, { a }); return want(rootAnswer(it, sq(a).mul(3))); };
O.sp1f = (it) => { const [a, b] = boxOf(it); return want(rootAnswer(it, sq(a).add(sq(b)))); };
O.sp1m = (it) => {
  const [d, a, b] = nums(it.text); const h = rootAnswer(it, sq(d).sub(sq(a)).sub(sq(b)));
  solidFig(it, { a, b, c: h }); return want(h);
};
O.sp1w = (it) => {
  // the drawing's corners: 0 front bottom left, 1 front bottom right, 2 front top right, 3 front top left, 4–7 behind them
  const C = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]];
  const through = (s) => C[s.from].every((v, i) => v !== C[s.to][i]);
  const segs = it.fig.segs; if (segs.filter(through).length !== 1) throw new Error(`${segs.filter(through).length} space diagonals drawn`);
  const lab = segs.find(through).label;
  return want(onlyChoice(it, (t) => t === `קטע ${lab}`, `segment ${lab}`));
};
O.sp2r = (it) => {
  const t = strip(it.text); const [x, h] = nums(t); const d = /שקוטרו/.test(t) ? x : x.mul(2);
  solidFig(it, { r: d.div(2), h }); return want(rootAnswer(it, sq(d).add(sq(h))));
};
O.sp2t = (it) => {
  const [a, b, c] = boxOf(it); const base = qsqrt(sq(a).add(sq(b)));
  if (!base) throw new Error('the base diagonal is not whole: the area would not be either');
  return want(base.mul(c).div(2));
};
O.sp2v = (it) => {
  const [r, l] = nums(it.text); const h = qsqrt(sq(l).sub(sq(r))); if (!h) throw new Error('the height is not whole');
  solidFig(it, { r, l, h }); return piItem(it, sq(r).mul(h).div(3));
};
O.sp2p = (it) => {
  const [a, b, L] = nums(it.text); const c = qsqrt(sq(a).add(sq(b))); if (!c) throw new Error('the hypotenuse is not whole');
  solidFig(it, { p: a, q: b, L }); return want(c.mul(L));
};
O.sp2m = (it) => {
  const [r, h] = nums(it.text);
  // half the axial section is right-angled at the centre; the whole section is right-angled only when r = h (then the
  // vertex and the ends of a diameter would be a right answer too)
  if (r.eq(h)) throw new Error('r = h: two of the triangles are right-angled');
  if (r.cmp(h) > 0) throw new Error('r > h: some chord makes a right angle at the vertex');
  return want(onlyChoice(it, (t) => t === 'הקודקוד, מרכז הבסיס ונקודה על שפת הבסיס', 'half the axial section'));
};

// ===== eq:6 and eq:7: the grade 8 unit 8.9 (motion problems, x in a denominator, proportion), filed under eq
/** f(x) of an equation "lhs = rhs" shown in TeX, as lhs − rhs, at a number (x put in brackets). */
const atX = (tex, x) => {
  const v = `(${Number(x).toFixed(12)})`; // never 8.9e-16: TeX has no exponent
  const [l, r] = String(tex).split('='); const L = texValue(l.replace(/x/g, v)); const R = texValue(r.replace(/x/g, v));
  return L == null || R == null ? null : L - R;
};
/** The one root of an equation linear in x, from two values of lhs − rhs. */
function linearRoot(tex) {
  const f0 = atX(tex, 0); const f1 = atX(tex, 1);
  if (f0 == null || f1 == null) throw new Error(`cannot read ${tex}`);
  if (Math.abs(f1 - f0) < 1e-12) throw new Error(`${tex} has no single root`);
  const x = -f0 / (f1 - f0);
  if (Math.abs(atX(tex, x)) > 1e-9 || Math.abs(atX(tex, x + 7) - 7 * (f1 - f0)) > 1e-6) throw new Error(`${tex} is not linear in x`);
  return q(String(Math.round(x * 1e9) / 1e9));
}
const lcm = (a, b) => { const g = Number(bgcd(BigInt(a), BigInt(b))); return (a / g) * b; };
O.eq6u = (it) => { const [v, mins] = nums(it.text); return want(v.mul(mins).div(60)); };
O.eq6 = (it) => {
  const t = strip(it.text); const n = nums(t);
  if (/לקראת/.test(t)) { // d apart, v1 and v2 toward each other: they meet after d / (v1 + v2)
    const [d, v1, v2] = n; const time = d.div(v1.add(v2));
    return want(/כעבור כמה שעות/.test(t) ? time : v1.mul(time));
  }
  if (/וחזרו באותה דרך/.test(t)) { // there at v1 and back at v2, T hours in all: d/v1 + d/v2 = T
    const [v1, v2, T] = n; return want(T.mul(v1).mul(v2).div(v1.add(v2)));
  }
  // the first leaves at v1; `late` hours later the second follows at v2 on the same road: v2·t = v1·(t + late)
  const late = /כעבור שעה /.test(t) ? Z(1) : /כעבור שעתיים /.test(t) ? Z(2) : n[1];
  const v1 = n[0]; const v2 = n.at(-1); const tt = v1.mul(late).div(v2.sub(v1));
  return want(/במרחק כמה/.test(t) ? v2.mul(tt) : tt);
};
O.eq6g = (it) => {
  const [a, b] = [ptsOf(it.fig, 0), ptsOf(it.fig, 1)];
  const sa = a[1][1].sub(a[0][1]).div(a[1][0].sub(a[0][0])); const sb = b[1][1].sub(b[0][1]).div(b[1][0].sub(b[0][0]));
  return want(b[0][1].sub(a[0][1]).div(sa.sub(sb)));
};
O.eq6t = (it) => {
  const t = strip(it.text); const n = nums(t);
  if (/לקראת/.test(t)) { // the table's speeds, D apart: v1·x + v2·x = D, x = D / (v1 + v2)
    const [v1, v2] = it.fig.rows.map((r) => q(r[1])); const tt = n[0].div(v1.add(v2));
    return want(onlyChoice(it, (s) => { try { return linearRoot(s).eq(tt); } catch { return false; } }, 'the meeting equation'));
  }
  const late = /כעבור שעה /.test(t) ? Z(1) : /כעבור שעתיים /.test(t) ? Z(2) : n[1];
  const v1 = n[0]; const v2 = n.at(-1); const tt = v1.mul(late).div(v2.sub(v1));
  // the right equation is the one whose root is the car's time, and it says distance = distance: v2·x on one side
  return want(onlyChoice(it, (s) => { try { return linearRoot(s).eq(tt) && new RegExp(`^${v2}x = `).test(s.replace(/\s+/g, ' ')); } catch { return false; } }, `v2·x = v1·(x + ${late})`));
};
O.eq7 = (it) => want(linearRoot(it.display));
O.eq7p = O.eq7;
O.eq7x = (it) => {
  const m = String(it.display).match(/\\frac\{(\d+)\}\{x\} = \\frac\{(\d+)\}\{(\d+)\}/); if (!m) throw new Error('an unknown form');
  const [a, b, c] = m.slice(1).map((v) => q(v)); return want(a.mul(c).div(b)); // a/x = b/c: x = a·c/b
};
O.eq7l = (it) => { const [a, b] = nums(it.text); const l = lcm(Number(a.n), Number(b.n)); return want(onlyChoice(it, (t) => t === String(l), `${l}`)); };

// ---------------------------------------------------------------- the run
const TOPICS8 = ['ratio', 'pct', 'func', 'line', 'pyth', 'circle', 'stats', 'congr', 'sim', 'sys', 'prob', 'space'];
/** Stairs of grade 8's programme filed under a grade 7 topic: eq:6 and eq:7 teach unit 8.9 (shared/programme.js). */
const EXTRA8 = { eq: [6, 7] };
const N = Number(process.env.ORACLE_N || 400);

/** Does the item's answer equal the oracle's? */
function sameAnswer(it, w) {
  const a = it.answer;
  if (w instanceof Q) return typeof a === 'number' && Math.abs(a - w.v) <= 1e-9 * Math.max(1, Math.abs(w.v));
  if (Array.isArray(w)) return Array.isArray(a) && a.length === w.length && w.every((x, i) => (x instanceof Q ? Math.abs(a[i] - x.v) < 1e-9 : JSON.stringify(a[i]) === JSON.stringify(x)));
  if (w && typeof w === 'object' && w.m instanceof Q) return Math.abs(a.m - w.m.v) < 1e-9 && Math.abs(a.b - w.b.v) < 1e-9;
  return JSON.stringify(a) === JSON.stringify(w);
}

/** The right answer in the other forms a student may type: each must be accepted. */
function acceptedForms(it, w) {
  const out = [];
  if (it.form === 'num' && w instanceof Q) {
    if (Number.isFinite(it.pk)) {
      out.push(String(roundP(3.14 * it.pk, 1)), String(roundP(Math.PI * it.pk, 1)), String(roundP(Math.PI * it.pk, 2)));
    } else if (it.exact != null && Math.abs(it.exact - Math.round(it.exact)) > 1e-9) {
      out.push(String(roundP(it.exact, 1)), String(roundP(it.exact, 2)));
    } else {
      // the value as a fraction always; a decimal when it ends, else rounded to two and three places
      if (!w.isInt() && !it.askDec) out.push(`${w.n}/${w.d}`);
      const dec = w.v;
      if (Number.isInteger(Math.round(dec * 1e6)) && Math.abs(dec * 1e6 - Math.round(dec * 1e6)) < 1e-6 && Math.abs(Math.round(dec * 1e6) / 1e6 - dec) < 1e-12) out.push(String(Math.round(dec * 1e6) / 1e6));
      else out.push(String(roundP(dec, 2)), String(roundP(dec, 3)));
    }
  }
  if (it.form === 'pt' && Array.isArray(w)) out.push({ x: w[0] instanceof Q ? String(w[0]) : String(w[0]), y: w[1] instanceof Q ? String(w[1]) : String(w[1]) });
  if (it.form === 'line' && w?.m instanceof Q) out.push({ m: String(w.m), b: String(w.b) });
  // a fraction in lowest terms, and (when lowest terms are not asked) the same fraction unreduced
  if (it.form === 'frac' && w instanceof Q) { out.push({ n: String(w.n), d: String(w.d) }); if (!it.reduced) out.push({ n: String(w.n * 3n), d: String(w.d * 3n) }); }
  return out;
}
const slotsOf = (it, f) => (['pt', 'line', 'frac'].includes(it.form) ? f : { v: f });

let defects;
beforeAll(async () => { await loadAllGens(); defects = []; });

describe('grade 8: every stair, recomputed independently', () => {
  for (const topic of [...TOPICS8, ...Object.keys(EXTRA8)]) {
    it(`${topic}${EXTRA8[topic] ? ` (${EXTRA8[topic].join(', ')})` : ''}: answers, accepted forms and drawings`, () => {
      const t = TOPIC[topic];
      const bad = []; const missing = new Set(); const seen = {};
      const real = Math.random;
      try {
        t.levels.forEach((L, li) => {
          if (EXTRA8[topic] && !EXTRA8[topic].includes(li + 1)) return;
          for (let n = 0; n < N; n += 1) {
            const seed = 80000 + li * 10007 + n;
            Math.random = seeded(seed);
            const item = makeItem(topic, li + 1);
            const kind = keyParts(item)[0];
            seen[kind] = (seen[kind] || 0) + 1;
            const oracle = O[kind];
            if (!oracle) { missing.add(`${topic}:${li + 1} ${kind}`); continue; }
            const say = (msg) => bad.push(`${topic}:${li + 1} seed ${seed} ${item.key}: ${msg}`);
            let w;
            try { w = oracle(item); } catch (e) { say(e.message); continue; }
            if (!sameAnswer(item, w.answer)) { say(`answer ${JSON.stringify(item.answer)}, should be ${w.answer instanceof Q ? `${w.answer} (${w.answer.v})` : JSON.stringify(w.answer)}`); continue; }
            // the right answer is right as the checker reads it, in every form a student may type it
            if (!isCorrect(item, answerInput(item))) say('the checker rejects its own answer');
            if (item.form === 'manip' && !manipCorrect(item, answerInput(item))) say('the object cannot reach its answer');
            for (const f of acceptedForms(item, w.answer)) {
              const u = readAnswer(item, slotsOf(item, f));
              if (!isCorrect(item, u)) say(`the checker rejects ${JSON.stringify(f)}`);
            }
            // the worked solution ends on the answer: its last line writes the number the checker wants
            // (sm1c counts triangles and says the count in words: שלושה)
            if ((item.form === 'num' || item.form === 'frac') && kind !== 'sm1c' && w.answer instanceof Q && Array.isArray(item.solution) && item.solution.length) {
              const shown = item.solution.flatMap((l) => nums(l));
              const target = Number.isFinite(item.pk) ? q(String(roundP(3.14 * item.pk, 1))) : w.answer;
              const hit = shown.some((v) => v.eq(target)) || (!target.isInt() && shown.some((v) => Math.abs(v.v - target.v) < 0.005));
              if (!hit) say(`the solution never writes the answer ${target}: ${item.solution.join(' / ')}`);
            }
            if (item.form === 'pt' && Array.isArray(w.answer) && Array.isArray(item.solution)) {
              const last = item.solution.join(' ');
              const [x, y] = w.answer.map((v) => q(v));
              if (!pointsIn(last).some(([a, b]) => a.eq(x) && b.eq(y))) say(`the solution never writes the point (${x}, ${y})`);
            }
            if (item.form === 'mc') {
              const oks = item.choices.map((c, i) => (c.ok ? i : -1)).filter((i) => i >= 0);
              if (oks.length && (oks.length !== 1 || oks[0] !== item.answer)) say(`choices marked right ${oks}, answer ${item.answer}`);
              const texts = item.choices.map(choiceText);
              if (new Set(texts).size !== texts.length) say(`two choices read the same: ${texts.join(' | ')}`);
            }
          }
        });
      } finally { Math.random = real; }
      expect([...missing], `${topic}: kinds with no oracle`).toEqual([]);
      expect(bad.slice(0, 30), `${topic}: ${bad.length} defects`).toEqual([]);
    });
  }
});

// ---------------------------------------------------------------- the arithmetic written in the worked examples
// Every chain of equalities in the maths of a grade 8 text ("$c^2 = 9^2 + 11^2 = 81 + 121 = 202$", "$3.14 \cdot 70 =
// 219.8$", "$\sqrt{202} \approx 14.2$") is worked out here: the parts made only of numbers must be equal, and a part
// after ≈ must be the one before it rounded at its own number of places. A part with a letter in it (c^2, x, m) is not
// arithmetic and is left out; π counts as the number π.
/** A TeX arithmetic expression's value, or null when it is not pure arithmetic. */
function texValue(src) {
  const s = String(src).replace(/\\left|\\right|\\,|\\;|\\!|\\quad|\\qquad/g, ' ').replace(/\{,\}/g, '').replace(/−/g, '-')
    .replace(/\\cdot|\\times/g, '*').replace(/\\div|:/g, '/').replace(/\\pi(?![a-zA-Z])/g, ' π ').replace(/\\%/g, '%').replace(/°|\^\\circ/g, '')
    .replace(/\\(?:dfrac|tfrac)/g, '\\frac').trim();
  if (!s || /\\(?!frac|sqrt)[a-zA-Z]+|[a-zA-Zא-ת_]/.test(s.replace(/\\frac|\\sqrt/g, ''))) return null;
  let i = 0;
  const peek = () => { while (s[i] === ' ') i += 1; return s[i]; };
  let sumE;
  const group = () => { if (peek() !== '{') throw new Error('{'); i += 1; const v = sumE(); if (peek() !== '}') throw new Error('}'); i += 1; return v; };
  const atom = () => {
    const c = peek();
    if (c === '(' || c === '[') { i += 1; const v = sumE(); if (!/[)\]]/.test(peek() || '')) throw new Error(')'); i += 1; return v; }
    if (c === '{') return group();
    if (c === 'π') { i += 1; return Math.PI; }
    if (s.startsWith('\\frac', i)) { i += 5; const a = group(); const b = group(); return a / b; }
    if (s.startsWith('\\sqrt', i)) { i += 5; return Math.sqrt(group()); }
    const m = s.slice(i).match(/^\d+(?:\.\d+)?/); if (!m) throw new Error(`at ${s.slice(i)}`);
    i += m[0].length; return Number(m[0]);
  };
  const post = () => {
    let v = atom();
    for (;;) {
      if (peek() === '^') { i += 1; v **= peek() === '{' ? group() : atom(); continue; }
      if (peek() === '%') { i += 1; v /= 100; continue; }
      return v;
    }
  };
  const unary = () => { if (peek() === '-') { i += 1; return -unary(); } if (peek() === '+') { i += 1; return unary(); } return post(); };
  const prodE = () => {
    let v = unary();
    for (;;) {
      const c = peek();
      if (c === '*') { i += 1; v *= unary(); } else if (c === '/') { i += 1; v /= unary(); } else if (c === '(' || c === 'π' || (c === '\\' && /^\\(frac|sqrt)/.test(s.slice(i)))) { v *= post(); } else return v;
    }
  };
  sumE = () => {
    let v = prodE();
    for (;;) { const c = peek(); if (c === '+') { i += 1; v += prodE(); } else if (c === '-') { i += 1; v -= prodE(); } else return v; }
  };
  try { const v = sumE(); return peek() === undefined ? v : null; } catch { return null; }
}
const placesIn = (src) => { const m = String(src).replace(/\{,\}/g, '').match(/\d+\.(\d+)\s*(?:\\%|%|°)?\s*$/); return m ? m[1].length : 0; };
/** The broken equalities of one maths segment, as words. */
function chainErrors(seg) {
  const errs = [];
  if (/\\begin|\\text|\\square|\\ne\b|\\neq|[<>]|\\le|\\ge|\\pm|\\ldots|\\in\b|\?/.test(seg)) return errs;
  const parts = seg.split(/(=|\\approx)/);
  let prev = null; let prevSrc = '';
  for (let k = 0; k < parts.length; k += 2) {
    const src = parts[k]; const rel = k ? parts[k - 1] : null; const v = texValue(src);
    if (v == null || !Number.isFinite(v)) { prev = null; continue; }
    if (prev != null) {
      if (rel === '=' && Math.abs(v - prev) > 1e-9 * Math.max(1, Math.abs(v))) errs.push(`${prevSrc.trim()} = ${src.trim()} (${prev} ≠ ${v})`);
      if (rel === '\\approx') { const p = placesIn(src); const tol = 0.5 * 10 ** -p + 1e-9; if (Math.abs(v - prev) > tol) errs.push(`${prevSrc.trim()} ≈ ${src.trim()} (${prev} rounds to ${roundP(prev, p)}, not ${v})`); }
    }
    prev = v; prevSrc = src;
  }
  return errs;
}
/**
 * Every string inside a value (teaching content, a task, an item), with where it is. What is meant to be false is left
 * out: a wrong choice (ok: false) and its feedback, the wrong line of an "find the error" part, and a sentence that says
 * its own equality is false ("$0 = 5$, וזה לא נכון", "$1 = 4$. אין $x$ כזה").
 */
function* stringsOf(v, at = '') {
  if (typeof v === 'string') { if (!/לא נכון|אין \$x\$ כזה/.test(v)) yield [at, v]; return; }
  if (Array.isArray(v)) { for (let i = 0; i < v.length; i += 1) yield* stringsOf(v[i], `${at}[${i}]`); return; }
  if (!v || typeof v !== 'object' || v.ok === false) return;
  for (const [k, x] of Object.entries(v)) {
    if (typeof x === 'function') continue;
    if (k === 'lines' && v.type === 'error' && Array.isArray(x)) { for (let i = 0; i < x.length; i += 1) if (i !== v.wrong) yield* stringsOf(x[i], `${at}.lines[${i}]`); continue; }
    yield* stringsOf(x, `${at}.${k}`);
  }
}
function arithmeticErrors(where, value) {
  const out = [];
  for (const [at, s] of stringsOf(value)) for (const seg of maths(s)) for (const e of chainErrors(seg)) out.push(`${where}${at}: ${e}`);
  return out;
}

// ---------------------------------------------------------------- regressions found by the oracles above
describe('grade 8: defects the oracles found', () => {
  /** The first item of a stair whose key starts with `prefix` and that `pred` accepts, by seed. */
  const findItem = (topic, level, prefix, pred = () => true) => {
    const real = Math.random;
    try {
      for (let seed = 1; seed < 20000; seed += 1) {
        Math.random = seeded(seed);
        const it = makeItem(topic, level);
        if (String(it.key).startsWith(prefix) && pred(it)) return { it, seed };
      }
    } finally { Math.random = real; }
    throw new Error(`no ${prefix} item`);
  };
  it('line:4: a slope that needs rounding is right only rounded as the question says (two places, rounded, not cut)', () => {
    // lf4 (1, 2) to (4, 12): m = 10/3. The question says "a fraction, or a decimal rounded to two places".
    const { it: item, seed } = findItem('line', 4, 'lf4:', (x) => Math.abs(x.answer * 3 - Math.round(x.answer * 3)) < 1e-9 && Math.abs(x.answer - Math.round(x.answer * 100) / 100) > 1e-6);
    const m = item.answer; const up = Math.ceil(m * 100) / 100; const down = Math.floor(m * 100) / 100; const right = roundP(m, 2); const wrong = right === up ? down : up;
    const read = (v) => readAnswer(item, { v });
    expect(isCorrect(item, read(String(right))), `seed ${seed} ${item.key}: ${right}`).toBe(true);
    expect(isCorrect(item, read(String(roundP(m, 3)))), `seed ${seed} ${item.key}: ${roundP(m, 3)}`).toBe(true);
    const f = q(String(Math.round(m * 3))).div(3);
    expect(isCorrect(item, read(`${f.n}/${f.d}`)), `seed ${seed} ${item.key}: ${f}`).toBe(true);
    expect(isCorrect(item, read(String(wrong))), `seed ${seed} ${item.key}: ${wrong} is not ${m} rounded to two places`).toBe(false);
  });
  it('sim:2: the worked line that compares two rectangles\' ratios never writes a rounded quotient with "="', () => {
    const real = Math.random; let seen = 0;
    try {
      for (let seed = 1; seed < 6000 && seen < 60; seed += 1) {
        Math.random = seeded(seed);
        const it = makeItem('sim', 2);
        if (!String(it.key).startsWith('sm2s:add')) continue;
        seen += 1;
        expect(it.solution.flatMap((l) => maths(l)).flatMap(chainErrors), `seed ${seed} ${it.key}`).toEqual([]);
      }
    } finally { Math.random = real; }
    expect(seen).toBeGreaterThan(20);
  });
});

// ---------------------------------------------------------------- the challenge tasks of grade 8, worked out here
// Each number part (and each error part's fix) recomputed from its story and prompt, by hand, here: not from the
// task's own `check` expression. The key is "task:part" (1-based), the value the answer the story gives.
const r1 = (v) => Math.round(v * 10) / 10;
const CHALLENGE_ANSWERS = {
  'ratio:c1:1': (56 / (2 + 5)) * 2, 'ratio:c3:1': 4 + 6.5 + 3.5, 'ratio:c3:3': (14 * 25000) / 100000, 'ratio:c3:4': (3.5 / 4) * 60, 'ratio:c4:2': (20 / 12) * 3,
  'pct:c1:1': 250 * 0.03, 'pct:c1:2': 12 / 0.03, 'pct:c2:2': 200 * 1.1 * 0.9, 'pct:c3:1': 80 / (1 - 0.2), 'pct:c4:1': 0.3 * 100, 'pct:c4:3': 5 / 100, 'pct:c5:2': (25 * 16) / 100, 'pct:c5:3': (4 / 16) * 100,
  'func:c2:1': 3 - 0, 'func:c2:2': 8 - 3, 'func:c3:1': 35 - 20, 'func:c3:2': 6 / (20 / 60), 'func:c3:4': 11 / 1,
  'line:c1:1': 12 + 4 * 5, 'line:c1:2': (20 - 12) / (4 - 3), 'line:c1:3': 20 + 3 * 8, 'line:c2:2': 4 - 1, 'line:c3:1': (8 - 2) / (3 - 1), 'line:c4:2': 2 * -4 + 3,
  'line:c5:1': -3, 'line:c5:2': 4, 'line:c6:2': (-2 - 4) / (2 - 0), 'line:c7:2': (11 - 5) / (3 - 1), 'line:c7:3': 5 - 3, 'line:c8:2': 80 - 5 * (14 - 8), 'line:c8:3': 80 / 5,
  'line:c9:1': (3 * 6) / 2, 'line:c9:3': (8 * 4) / 2,
  'pyth:c1:1': Math.hypot(2, 1.5), 'pyth:c2:2': 7 * 7 - 4 * 6, 'pyth:c3:2': 25 + 36 - 49, 'pyth:c4:1': Math.sqrt(25 - 1.96), 'pyth:c4:2': Math.sqrt(25 - 9), 'pyth:c4:3': Math.sqrt(25 - 1.96) - 4,
  'pyth:c5:2': Math.hypot(3, 4), 'pyth:c5:3': (5 * 5) / 2,
  'circle:c1:1': 9, 'circle:c1:2': 36, 'circle:c2:1': (25 * Math.sqrt(169 - 25)) / 3, 'circle:c3:1': 16 * 10, 'circle:c3:2': 4 * 20,
  'stats:c1:1': (6 * 8000 + 50000) / 7, 'stats:c1:2': 8000, 'stats:c2:2': (4 * 80 + 90) / 5, 'stats:c3:1': 7, 'stats:c4:2': 2, 'stats:c4:4': 1,
  'stats:c5:1': 5 * 1 + 4 * 2 + 3 * 3 + 2 * 10, 'stats:c5:2': 42 / 20, 'stats:c5:3': 1, 'stats:c6:2': 5 * 84 - (80 + 90 + 75 + 88), 'stats:c6:3': 6 * 85 - 5 * 84,
  'congr:c2:2': 4 + 5 + 7, 'congr:c3:1': (40 * 30) / 2, 'congr:c3:3': (40 * 30) / 2 / 4,
  'sim:c2:2': (180 - 2 * 65) / 2, 'sim:c3:1': 5 / 2, 'sim:c3:2': 1.2 * 2.5, 'sim:c3:3': 1.2 * 0.9 * 2.5 * 2.5,
  'sys:c2:1': 15 / 5, 'sys:c2:2': 2 * 3 - 1, 'sys:c3:2': (45 * 120 - 4350) / 15, 'sys:c3:3': 120 - 70, 'sys:c4:2': 360 / 2.4, 'sys:c4:3': 360 - 150,
  'sys:c5:2': (19 - 7) / 4, 'sys:c5:3': (7 - 3) / 2, 'sys:c6:1': -5, 'sys:c6:3': 6,
  'prob:c2:1': 2, 'prob:c3:2': 1 - 0.9,
  'space:c1:1': Math.sqrt(4 + 9 + 36), 'space:c1:2': r1(Math.sqrt(45)), 'space:c2:1': Math.hypot(12, 16), 'space:c3:1': r1(Math.sqrt(70)), 'space:c3:2': Math.hypot(6, 3 + 5),
};
/** A choice part worked out here: the text the right choice must start with. */
const CHALLENGE_CHOICES = {
  'pct:c1:3': 'מסלול ב', // 600 · 3% = 18 > 12
  'pct:c4:2': '$0.4$', // 0.4 > 3/8 = 0.375 > 0.35
  'func:c3:3': 'בקטע הראשון', // 6 km in 20 min against 5 km in 25 min
  'line:c1:4': 'חברה ב', // 20 + 3·15 = 65 < 12 + 4·15 = 72
  'line:c6:3': '$y = -3x + 4$', // |−3| > |2| > |1|
  'pyth:c1:2': 'לא', // the floor's diagonal 2.5 < 2.6
  'pyth:c3:3': 'קהה', // 16 + 25 = 41 < 49
  'circle:c3:3': 'א', // 24/160 = 0.15 < 15/80 = 0.1875 (each per π cm³)
  'sys:c4:4': 'בערך $28.6\\%$', // 60/210
  'prob:c2:2': 'לסכום $11$ פי שניים', // 2/36 against 1/36
  'prob:c3:1': 'תל אביב', // 0
  'prob:c3:4': 'המרוץ יתקיים', // 0.05 ≤ 0.2
  'space:c3:3': 'דרך הדופן הקדמית', // √(6² + 8²) = 10 < √(5² + 9²) ≈ 10.3
};

describe('grade 8: the challenge tasks, worked out independently', () => {
  it('every number part and every error fix of the grade 8 tasks has the answer its story gives', async () => {
    const { CHALLENGE_TASKS } = await import('@/learn/challenges/all.ts');
    const tasks = CHALLENGE_TASKS.filter((t) => TOPICS8.includes(t.topic));
    const seen = new Set(); const bad = [];
    for (const t of tasks) {
      t.parts.forEach((p, i) => {
        const id = `${t.id}:${i + 1}`;
        const ans = p.type === 'num' ? p.answer : p.type === 'error' ? p.fix?.answer : undefined;
        if (ans !== undefined) {
          seen.add(id);
          if (!(id in CHALLENGE_ANSWERS)) bad.push(`${id}: no independent value here (answer ${ans})`);
          else if (Math.abs(CHALLENGE_ANSWERS[id] - ans) > 1e-9) bad.push(`${id}: the task says ${ans}, the story gives ${CHALLENGE_ANSWERS[id]}`);
        }
        if (p.type === 'mc' && id in CHALLENGE_CHOICES) {
          seen.add(id);
          const right = p.choices.filter((c) => c.ok).map((c) => c.text || c.tex);
          if (right.length !== 1 || !right[0].startsWith(CHALLENGE_CHOICES[id])) bad.push(`${id}: the right choice is ${right.join(' | ')}, should start ${CHALLENGE_CHOICES[id]}`);
        }
      });
    }
    for (const id of [...Object.keys(CHALLENGE_ANSWERS), ...Object.keys(CHALLENGE_CHOICES)]) if (!seen.has(id)) bad.push(`${id}: no such part any more`);
    expect(bad).toEqual([]);
  });
});

describe('grade 8: the arithmetic written in solutions, lessons and challenges', () => {
  it('the checker of this test reads TeX arithmetic right', () => {
    expect(texValue('9^2 + 11^2')).toBe(202);
    expect(texValue('\\frac{22 \\cdot 19}{2}')).toBe(209);
    expect(texValue('3.14 \\cdot 169')).toBeCloseTo(530.66, 9);
    expect(texValue('121\\pi - 64\\pi')).toBeCloseTo(57 * Math.PI, 9);
    expect(texValue('c^2')).toBe(null);
    expect(chainErrors('c^2 = 9^2 + 11^2 = 81 + 121 = 202')).toEqual([]);
    expect(chainErrors('\\sqrt{202} \\approx 14.2')).toEqual([]);
    expect(chainErrors('7 + 5 = 13')).toHaveLength(1);
    expect(chainErrors('\\sqrt{50} \\approx 7.2')).toHaveLength(1);
  });
  it('generated solutions and hints: every chain of numbers holds', () => {
    const bad = []; const real = Math.random;
    try {
      for (const topic of TOPICS8) {
        TOPIC[topic].levels.forEach((L, li) => {
          for (let n = 0; n < 150; n += 1) {
            Math.random = seeded(90000 + li * 1009 + n);
            const it = makeItem(topic, li + 1);
            bad.push(...arithmeticErrors(`${topic}:${li + 1} ${it.key}`, { text: it.text, solution: it.solution, hint: it.hint, choices: it.choices, fig: it.fig?.type === 'proof' ? it.fig : undefined }));
          }
        });
      }
    } finally { Math.random = real; }
    expect([...new Set(bad)].slice(0, 30)).toEqual([]);
  });
  it('teaching content and challenge tasks of the grade 8 topics: every chain of numbers holds', async () => {
    const { loadAllContent } = await import('@/learn/content/index.ts');
    const { CHALLENGE_TASKS } = await import('@/learn/challenges/all.ts');
    const all = await loadAllContent();
    const bad = [];
    for (const [skill, c] of Object.entries(all)) if (TOPICS8.includes(skill.split(':')[0])) bad.push(...arithmeticErrors(skill, c));
    for (const t of CHALLENGE_TASKS) if (TOPICS8.includes(t.topic)) bad.push(...arithmeticErrors(t.id, t));
    expect([...new Set(bad)].slice(0, 40)).toEqual([]);
  });
});
