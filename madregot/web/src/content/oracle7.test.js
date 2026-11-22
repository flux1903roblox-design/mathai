// Independent answer oracles for every grade 7 stair and the fractions floor (frac:1-4).
//
// Nothing here calls a generator's own answer code. Each question is drawn on a fixed seed, and its answer is worked out
// again from what the student SEES: the TeX on screen (parsed and evaluated here with exact BigInt fractions), the
// numbers in the question's text, the figure's numbers. Then:
//   - the item's answer must be that value (exactly, or as the question's own rounding rule says);
//   - the answer the screen shows (answerText) must read back as it;
//   - the worked example (solution) must reach it;
//   - the checker (readAnswer + isCorrect) must take every way a student may write it: an unreduced fraction, a
//     decimal, a mixed number, −/–/- minus signs, spaces, −0 for 0 — and refuse a near miss.
// A choice question must have exactly one right choice, the one marked. A defect found here was fixed in the generator
// or the checker, and a regression line for it is at the end of this file.
import { describe, it, expect, beforeAll } from 'vitest';
import { TOPIC, makeItem, testItem, loadAllGens, isCorrect, readAnswer, answerText, partialOf } from './index.js';
import { manipCorrect, manipSolution } from './manip.js';
import fs from 'node:fs';
import { seeded } from '@/learn/expr.ts';
import { CHALLENGE_TASKS } from '@/learn/challenges/all.ts';
import { numCheck } from '@/learn/challenges/grade.ts';

// ------------------------------------------------------------------ exact fractions (BigInt)
const babs = (a) => (a < 0n ? -a : a);
const bgcd = (a, b) => { a = babs(a); b = babs(b); while (b) [a, b] = [b, a % b]; return a || 1n; };
class Q {
  constructor(n, d = 1n) {
    if (d === 0n) throw new Error('division by zero');
    if (d < 0n) { n = -n; d = -d; }
    const g = bgcd(n, d); this.n = n / g; this.d = d / g;
  }
  static of(x) {
    if (x instanceof Q) return x;
    if (typeof x === 'bigint') return new Q(x);
    if (typeof x === 'number') {
      if (Number.isInteger(x)) return new Q(BigInt(x));
      return Q.dec(String(x));
    }
    return Q.dec(String(x));
  }
  /** "2.5", "-0.125", "3" exactly. */
  static dec(s) {
    const m = String(s).trim().match(/^([+-]?)(\d*)(?:\.(\d+))?$/);
    if (!m) throw new Error(`not a decimal: ${s}`);
    const frac = m[3] || '';
    const n = BigInt((m[2] || '0') + frac) * (m[1] === '-' ? -1n : 1n);
    return new Q(n, 10n ** BigInt(frac.length));
  }
  add(o) { o = Q.of(o); return new Q(this.n * o.d + o.n * this.d, this.d * o.d); }
  sub(o) { o = Q.of(o); return new Q(this.n * o.d - o.n * this.d, this.d * o.d); }
  mul(o) { o = Q.of(o); return new Q(this.n * o.n, this.d * o.d); }
  div(o) { o = Q.of(o); if (o.n === 0n) throw new Error('division by zero'); return new Q(this.n * o.d, this.d * o.n); }
  neg() { return new Q(-this.n, this.d); }
  abs() { return new Q(babs(this.n), this.d); }
  pow(k) { let r = new Q(1n); for (let i = 0; i < k; i += 1) r = r.mul(this); return r; }
  eq(o) { o = Q.of(o); return this.n === o.n && this.d === o.d; }
  cmp(o) { o = Q.of(o); const l = this.n * o.d; const r = o.n * this.d; return l < r ? -1 : l > r ? 1 : 0; }
  isInt() { return this.d === 1n; }
  isZero() { return this.n === 0n; }
  num() { return Number(this.n) / Number(this.d); }
  /** Is this a decimal with at most p places? */
  places(p) { return (10n ** BigInt(p)) % this.d === 0n; }
  /** Rounded to p places, half away from zero, as a Q. */
  round(p) {
    const k = 10n ** BigInt(p); const s = this.n < 0n ? -1n : 1n; const a = babs(this.n) * k;
    const q = a / this.d; const r = a % this.d;
    return new Q(s * (2n * r >= this.d ? q + 1n : q), k);
  }
  /** Cut (not rounded) to p places. */
  trunc(p) { const k = 10n ** BigInt(p); return new Q((this.n * k) / this.d, k); }
  /** As a finite decimal string (only for a decimal). */
  decStr() {
    let p = 0; while (!this.places(p)) { p += 1; if (p > 12) throw new Error('not a finite decimal'); }
    const k = 10n ** BigInt(p); const s = this.n < 0n ? '-' : ''; const a = babs(this.n) * (k / this.d);
    const w = a / k; const f = a % k;
    return p === 0 ? `${s}${w}` : `${s}${w}.${String(f).padStart(p, '0')}`;
  }
  toString() { return this.d === 1n ? String(this.n) : `${this.n}/${this.d}`; }
}
const q = (n, d = 1) => new Q(BigInt(n), BigInt(d));

// ------------------------------------------------------------------ TeX arithmetic, evaluated exactly
const SKIP = /^\\(left|right|big|Big|bigl|bigr|displaystyle|textstyle|,|;|:|!|quad|qquad| )(?![a-zA-Z])/;
function tokenize(tex) {
  const s = String(tex).replace(/\\text\{[^}]*\}/g, ' ').replace(/[−–]/g, '-').replace(/⁦|⁩/g, '');
  const out = []; let i = 0;
  while (i < s.length) {
    const c = s[i]; const rest = s.slice(i);
    if (/\s/.test(c)) { i += 1; continue; }
    let m;
    if ((m = rest.match(SKIP))) { i += m[0].length; continue; }
    if ((m = rest.match(/^\d+(?:\.\d+)?/))) { out.push({ t: 'num', v: m[0], at: i, end: i + m[0].length }); i += m[0].length; continue; }
    if ((m = rest.match(/^\\[dt]?frac(?![a-zA-Z])/))) { out.push({ t: 'frac', at: i }); i += m[0].length; continue; }
    if ((m = rest.match(/^\\(cdot|times)(?![a-zA-Z])/))) { out.push({ t: 'op', v: '*' }); i += m[0].length; continue; }
    if ((m = rest.match(/^\\div(?![a-zA-Z])/))) { out.push({ t: 'op', v: '/' }); i += m[0].length; continue; }
    if ((m = rest.match(/^\\lvert(?![a-zA-Z])/))) { out.push({ t: 'absL' }); i += m[0].length; continue; }
    if ((m = rest.match(/^\\rvert(?![a-zA-Z])/))) { out.push({ t: 'absR' }); i += m[0].length; continue; }
    if ((m = rest.match(/^\\square(?![a-zA-Z])/))) { out.push({ t: 'var', v: '□' }); i += m[0].length; continue; }
    if ((m = rest.match(/^\\(le|leq)(?![a-zA-Z])/))) { out.push({ t: 'rel', v: '<=' }); i += m[0].length; continue; }
    if ((m = rest.match(/^\\(ge|geq)(?![a-zA-Z])/))) { out.push({ t: 'rel', v: '>=' }); i += m[0].length; continue; }
    if ((m = rest.match(/^\\(ne|neq)(?![a-zA-Z])/))) { out.push({ t: 'rel', v: '!=' }); i += m[0].length; continue; }
    if (rest.startsWith('\\{') || rest.startsWith('\\}')) throw new Error(`set braces in ${tex}`);
    if (c === '\\') throw new Error(`unknown TeX ${rest.slice(0, 12)} in ${tex}`);
    if ('+-'.includes(c)) { out.push({ t: 'op', v: c }); i += 1; continue; }
    if (c === ':' || c === '/') { out.push({ t: 'op', v: '/' }); i += 1; continue; }
    if (c === '*') { out.push({ t: 'op', v: '*' }); i += 1; continue; }
    if (c === '^') { out.push({ t: 'op', v: '^' }); i += 1; continue; }
    if ('([{'.includes(c)) { out.push({ t: 'L', v: c }); i += 1; continue; }
    if (')]}'.includes(c)) { out.push({ t: 'R', v: c }); i += 1; continue; }
    if (c === '|') { out.push({ t: 'bar' }); i += 1; continue; }
    if (c === '=') { out.push({ t: 'rel', v: '=' }); i += 1; continue; }
    if (c === '<' || c === '>') { out.push({ t: 'rel', v: c }); i += 1; continue; }
    if (/[a-zA-Z]/.test(c)) { out.push({ t: 'var', v: c }); i += 1; continue; }
    if (c === '?') { out.push({ t: 'var', v: '?' }); i += 1; continue; }
    throw new Error(`unknown sign "${c}" in ${tex}`);
  }
  return out;
}
const CLOSE = { '(': ')', '[': ']', '{': '}' };
/** Evaluate a TeX expression (no relation) with exact fractions; `env` gives the letters' values. */
function evalTex(tex, env = {}) {
  const toks = Array.isArray(tex) ? tex : tokenize(tex);
  let p = 0;
  const peek = () => toks[p];
  const startsAtom = (t) => t && (t.t === 'num' || t.t === 'var' || t.t === 'frac' || t.t === 'L' || t.t === 'absL' || (t.t === 'bar'));
  function expr(absDepth) {
    let v = term(absDepth);
    while (peek() && peek().t === 'op' && (peek().v === '+' || peek().v === '-')) {
      const o = toks[p++].v; const r = term(absDepth); v = o === '+' ? v.add(r) : v.sub(r);
    }
    return v;
  }
  function term(absDepth) {
    let v = unary(absDepth);
    for (;;) {
      const t = peek();
      if (t && t.t === 'op' && (t.v === '*' || t.v === '/')) { p += 1; const r = unary(absDepth); v = t.v === '*' ? v.mul(r) : v.div(r); continue; }
      // a bar closes an absolute value when one is open: never an implicit product there
      if (startsAtom(t) && !(t.t === 'bar' && absDepth > 0)) { v = v.mul(power(absDepth)); continue; }
      return v;
    }
  }
  function unary(absDepth) {
    const t = peek();
    if (t && t.t === 'op' && t.v === '-') { p += 1; return unary(absDepth).neg(); }
    if (t && t.t === 'op' && t.v === '+') { p += 1; return unary(absDepth); }
    return power(absDepth);
  }
  function power(absDepth) {
    const b = atom(absDepth);
    if (peek() && peek().t === 'op' && peek().v === '^') {
      p += 1; const e = atom(0);
      if (!e.isInt() || e.n < 0n) throw new Error('exponent');
      return b.pow(Number(e.n));
    }
    return b;
  }
  function group() {
    const t = toks[p++];
    if (!t || t.t !== 'L' || t.v !== '{') throw new Error('expected {');
    const v = expr(0); const c = toks[p++];
    if (!c || c.t !== 'R' || c.v !== '}') throw new Error('expected }');
    return v;
  }
  function atom(absDepth) {
    const t = toks[p++];
    if (!t) throw new Error('unexpected end');
    if (t.t === 'num') {
      const v = Q.dec(t.v);
      // a mixed number: digits written right against \frac (1\frac{3}{4} is 1 and three quarters)
      const n = peek();
      if (n && n.t === 'frac' && n.at === t.end) { p += 1; const a = group(); const b = group(); return v.add(a.div(b)); }
      return v;
    }
    if (t.t === 'var') { if (!(t.v in env)) throw new Error(`no value for ${t.v}`); return Q.of(env[t.v]); }
    if (t.t === 'frac') { const a = group(); const b = group(); return a.div(b); }
    if (t.t === 'L') {
      const v = expr(0); const c = toks[p++];
      if (!c || c.t !== 'R' || c.v !== CLOSE[t.v]) throw new Error(`unbalanced ${t.v}`);
      return v;
    }
    if (t.t === 'absL') { const v = expr(absDepth + 1); const c = toks[p++]; if (!c || c.t !== 'absR') throw new Error('abs'); return v.abs(); }
    if (t.t === 'bar') { const v = expr(absDepth + 1); const c = toks[p++]; if (!c || c.t !== 'bar') throw new Error('abs'); return v.abs(); }
    throw new Error(`unexpected ${t.t} ${t.v ?? ''}`);
  }
  const v = expr(0);
  if (p !== toks.length) throw new Error(`left over in ${typeof tex === 'string' ? tex : '…'}: ${JSON.stringify(toks.slice(p, p + 3))}`);
  return v;
}
/** Split TeX at its top-level relation signs: { sides: [tex tokens…], rels: ['=', …] }. */
function relSplit(tex) {
  const toks = tokenize(tex); const sides = [[]]; const rels = [];
  for (const t of toks) { if (t.t === 'rel') { rels.push(t.v); sides.push([]); } else sides[sides.length - 1].push(t); }
  return { sides, rels };
}
/** f(v) = left − right of an equation in the letter v, as a function of a Q. */
const diffFn = (tex, v, env = {}) => { const { sides, rels } = relSplit(tex); if (rels.length !== 1 || rels[0] !== '=') throw new Error(`not one equation: ${tex}`); return (x) => evalTex(sides[0], { ...env, [v]: x }).sub(evalTex(sides[1], { ...env, [v]: x })); };
/** Solve a linear equation in v exactly: { kind: 'one', x } | { kind: 'all' } | { kind: 'none' }; throws when not linear. */
function solveLinear(tex, v, env = {}) {
  const f = diffFn(tex, v, env);
  const f0 = f(q(0)); const f1 = f(q(1)); const a = f1.sub(f0);
  for (const t of [2, -1, 5, -7]) { if (!f(q(t)).eq(f0.add(a.mul(q(t))))) throw new Error(`not linear in ${v}: ${tex}`); }
  if (a.isZero()) return { kind: f0.isZero() ? 'all' : 'none' };
  return { kind: 'one', x: f0.neg().div(a) };
}
/** A linear expression in v as { k, c } exactly; throws when not linear. */
function linOf(tex, v = 'x') {
  const f = (x) => evalTex(tex, { [v]: x });
  const c = f(q(0)); const k = f(q(1)).sub(c);
  for (const t of [2, -3, 7]) if (!f(q(t)).eq(c.add(k.mul(q(t))))) throw new Error(`not linear: ${tex}`);
  return { k, c };
}
/** Is a TeX string the same linear expression as {k, c}? */
const sameLin = (tex, v, { k, c }) => { try { const l = linOf(tex, v); return l.k.eq(k) && l.c.eq(c); } catch { return false; } };

// ------------------------------------------------------------------ reading the question's own numbers
/** The maths segments of a text ($…$), in order. */
const mathOf = (text) => [...String(text || '').matchAll(/\$([^$]*)\$/g)].map((m) => m[1]);
/** The numbers written in a text's maths, in order (a \frac is one number; a degree sign or a percent is dropped). */
function numsOf(text) {
  const out = [];
  // the format line's example fraction ("למשל $7/12$") is not a number of the question
  for (const seg of mathOf(String(text || '').replace(/אפשר לכתוב כשבר[^.]*\./g, ''))) {
    const clean = seg.replace(/\^\\circ|\^\{\\circ\}|\\%|°/g, ' ').replace(/[−–]/g, '-');
    for (const m of clean.matchAll(/(-?)\\[dt]?frac\{(\d+)\}\{(\d+)\}|(-?)(\d+(?:\.\d+)?)/g)) {
      if (m[2]) out.push(q(Number(m[2]), Number(m[3])).mul(m[1] ? -1 : 1));
      else out.push(Q.dec(m[4] + m[5]));
    }
  }
  return out;
}
/** The numbers of a text as JS numbers. */
const nums = (text) => numsOf(text).map((x) => x.num());

// ------------------------------------------------------------------ checking one item against an oracle value
const MINUS = ['-', '−', '–'];
/** Ways a student may type a number V (a Q): every one must be read as right. */
function writings(V) {
  const out = new Set();
  const neg = V.n < 0n; const A = V.abs();
  const signs = neg ? MINUS : [''];
  for (const s of signs) {
    out.add(`${s}${A.toString()}`);
    if (!A.isInt()) out.add(`${s}${A.n * 3n}/${A.d * 3n}`); // not in lowest terms
    if (A.places(6)) out.add(`${s}${A.decStr()}`);
    if (!A.isInt() && A.n > A.d) { const w = A.n / A.d; const r = A.sub(new Q(w)); out.add(`${s}${w} ${r.n}/${r.d}`); }
  }
  if (V.isInt()) { out.add(`${V.toString()}.0`); if (V.isZero()) { out.add('-0'); out.add('−0'); } }
  if (!neg && !V.isZero()) out.add(`+${V.toString()}`);
  if (neg) { out.add(`- ${A.toString()}`); if (!A.isInt()) out.add(`${A.n}/-${A.d}`); }
  if (A.places(6) && A.decStr().includes('.')) out.add(`${neg ? '-' : ''}${A.decStr().replace('.', ',')}`);
  return [...out];
}
/** Near misses that must be refused: V ± 1, V ± 0.1 for a decimal, the sign flipped. */
function nearMisses(V) {
  const out = [V.add(1), V.sub(1)];
  if (!V.isZero()) out.push(V.neg());
  if (!V.isInt() && V.places(1)) out.push(V.add(q(1, 10)), V.sub(q(1, 10)));
  return out;
}
const read = (it, s) => readAnswer(it, { v: s });

/**
 * The checks for an item whose right answer is the number V (a Q). Returns a list of problems.
 * `rounding`: the question asks for a rounded value (places) — V is exact, and the answer is V rounded.
 */
function checkNum(it, V, { allowAnswerApprox = false } = {}) {
  const probs = [];
  const a = it.answer;
  if (it.form !== 'num' && it.form !== 'frac' && it.form !== 'manip') { probs.push(`form ${it.form}, oracle has a number`); return probs; }
  if (typeof a !== 'number') { probs.push(`answer is not a number: ${JSON.stringify(a)}`); return probs; }
  const exact = Math.abs(a - V.num()) <= 1e-9 * Math.max(1, Math.abs(V.num()));
  if (!exact && !allowAnswerApprox) probs.push(`answer ${a}, oracle ${V} (${V.num()})`);
  if (it.form === 'manip') return probs;
  // the answer shown reads back as V
  const shown = answerText(it);
  const back = it.form === 'frac' ? (() => { const m = shown.match(/^(-?\d+)(?:\/(\d+))?$/); return m ? q(Number(m[1]), Number(m[2] || 1)) : null; })() : (() => { try { return Q.dec(shown); } catch { const m = shown.match(/^(-?\d+)\/(\d+)$/); return m ? q(Number(m[1]), Number(m[2])) : null; } })();
  if (!back) probs.push(`shown answer "${shown}" is not a number`);
  else if (!back.eq(V)) {
    // a value with no short decimal may be shown rounded, but only correctly
    const p = shown.includes('.') ? shown.split('.')[1].length : -1;
    if (!(p >= 2 && back.eq(V.round(p)))) probs.push(`shown answer "${shown}" is not ${V}`);
  }
  if (it.form === 'frac') {
    const r = { n: Number(V.n), d: Number(V.d) };
    if (!isCorrect(it, r)) probs.push(`checker refuses ${V} in lowest terms`);
    const un = { n: r.n * 2, d: r.d * 2 };
    if (it.reduced) { if (isCorrect(it, un) || partialOf(it, un) !== 'not-reduced') probs.push(`${un.n}/${un.d} should be "not reduced", not right or wrong`); } else if (!isCorrect(it, un)) probs.push(`checker refuses ${un.n}/${un.d}`);
    const neg = readAnswer(it, { n: String(-r.n), d: String(-r.d) });
    if (!isCorrect(it, neg)) probs.push(`checker refuses ${-r.n}/${-r.d}`);
    return probs;
  }
  // every way of writing V is right (a question that asks for a decimal refuses a typed fraction, on purpose)
  for (const w of writings(V)) {
    if (it.askDec && w.includes('/')) continue;
    const u = read(it, w);
    if (!isCorrect(it, u)) probs.push(`checker refuses "${w}" (read ${u}) for ${V}`);
  }
  // a decimal asked as it is ((−0.4)³ = −0.064, exactDec; council round 3): an exact decimal of at most three places, the
  // question says nothing about rounding, and its two-place rounding (−0.06) is another number, refused
  if (it.exactDec && !V.places(2)) {
    if (!V.places(3)) probs.push(`answer ${V} is asked exactly but is not a decimal of three places`);
    if (/מעוגל|עגלו/.test(String(it.text || ''))) probs.push(`answer ${V} is asked exactly, yet the question says to round`);
    const r2 = V.round(2);
    if (isCorrect(it, read(it, r2.decStr()))) probs.push(`checker accepts ${r2.decStr()}, ${V} rounded, for a decimal asked exactly`);
    if (isCorrect(it, read(it, V.trunc(2).decStr()))) probs.push(`checker accepts ${V.trunc(2).decStr()}, ${V} cut, for a decimal asked exactly`);
  } else if (!V.places(2)) {
    // a value with no exact two-place decimal: the question says how to write it, and its rounding is the rule
    const says = /מעוגל לשתי ספרות|כשבר/.test(String(it.text || '')) || it.exact != null;
    if (!says && !it.askDec) probs.push(`answer ${V} has no two-place decimal and the question does not say how to write it`);
    const r2 = V.round(2);
    if (!isCorrect(it, read(it, r2.decStr()))) probs.push(`checker refuses ${r2.decStr()}, ${V} rounded to two places`);
    // the question says "rounded": a decimal cut instead of rounded, or rounded the wrong way, is not right
    for (const bad of [V.trunc(2), r2.add(q(1, 100)), r2.sub(q(1, 100))]) {
      if (bad.eq(r2)) continue;
      if (isCorrect(it, read(it, bad.decStr()))) probs.push(`checker accepts ${bad.decStr()}, not ${V} rounded to two places (${r2.decStr()})`);
    }
  }
  for (const m of nearMisses(V)) {
    if (m.eq(V)) continue;
    const s = m.places(6) ? m.decStr() : m.toString();
    if (isCorrect(it, read(it, s))) probs.push(`checker accepts the wrong "${s}" for ${V}`);
  }
  return probs;
}

/** The worked example reaches the answer: some "= value" or "≈ value" in its maths is V (or V correctly rounded). */
function solutionReaches(it, V) {
  const lines = Array.isArray(it.solution) ? it.solution : [];
  if (!lines.length) return ['no worked example'];
  const vals = [];
  for (const l of lines) {
    for (const seg of mathOf(l)) {
      for (const piece of seg.split(/=|\\approx|\\Rightarrow|\\to|\\quad|\\qquad/)) {
        try { vals.push({ v: evalTex(piece.replace(/\^\\circ|°|\\%|\\text\{[^}]*\}/g, '').replace(/[a-zA-Z]+\s*$/, '')), approx: false }); } catch { /* words or letters */ }
      }
      const ap = seg.match(/\\approx\s*(-?\d+(?:\.\d+)?)/);
      if (ap) vals.push({ v: Q.dec(ap[1]), approx: true });
    }
    // a number after a colon in words: "התשובה: 45"
    const tail = l.match(/:\s*\$?(-?\d+(?:\.\d+)?)\$?\s*\.?$/);
    if (tail) vals.push({ v: Q.dec(tail[1]), approx: false });
  }
  const hit = vals.some(({ v, approx }) => v.eq(V) || (approx && [1, 2, 3].some((p) => V.round(p).eq(v))));
  return hit ? [] : [`worked example never reaches ${V}: ${lines.join(' | ')}`];
}

/** A choice question: exactly the marked choice is right by the oracle `ok(choice, i)`. */
function checkChoices(it, ok) {
  const right = it.choices.map((c, i) => !!ok(c, i));
  const n = right.filter(Boolean).length;
  if (n !== 1) return [`${n} right choices by the oracle: ${it.choices.map((c, i) => `${right[i] ? '*' : ''}${c.tex ?? c.text}`).join(' / ')}`];
  if (!right[it.answer]) return [`marked choice ${it.answer} (${it.choices[it.answer].tex ?? it.choices[it.answer].text}), oracle ${right.indexOf(true)}`];
  return [];
}
/** The value of a choice written in TeX (or text that is a number). */
const choiceVal = (c) => evalTex(String(c.tex ?? c.text).replace(/\\;|\\,/g, ' '));

// ------------------------------------------------------------------ drawing items on fixed seeds
const ORACLES = {};
/** Register an oracle for a family (the key's prefix) of a stair. */
const fam = (prefix, fn) => { ORACLES[prefix] = fn; };
const familyOf = (it) => String(it.key).split(':')[0];

function draw(topic, level, seed, test) {
  const real = Math.random;
  Math.random = seeded(seed * 7919 + level * 104729 + topic.length * 15485863 + (test ? 1 : 0));
  try { return test ? testItem(topic, level) : makeItem(topic, level); } finally { Math.random = real; }
}

const SEEDS = Number(process.env.ORACLE_SEEDS || 1000);
const STAIRS7 = ['frac', 'signed', 'coord', 'angles', 'transf', 'expr', 'area', 'solid', 'data', 'eq'];

/** Run every oracle on a stair; returns { problems, counts } (counts: items checked per family). */
/**
 * Every chain of numbers a text writes in its maths holds: "$155^\circ - 90^\circ = 65^\circ$", "$-7 < 2 < 8$",
 * "$46^\circ \ne 50^\circ$", "$\frac{13}{15} \approx 0.87$" (the right side is the left rounded at its own places,
 * and, where the question asks for two places, at two). A piece with a letter (x = 4) is skipped, not judged.
 */
function mathHolds(texts, twoPlaces = false) {
  const pr = [];
  // a line that shows a false statement on purpose ("$-1 = 1$. זה לא נכון לאף $x$") is not judged
  for (const raw of texts.filter((t) => t && !/לא נכון|לא שווים|טעות|שגוי|אין פתרון/.test(t))) {
    // "$-\frac{8}{27}$, בערך $-0.3$" in words is "≈" in maths
    const text = String(raw).replace(/\$([^$]+)\$,?\s*בערך\s*\$([^$]+)\$/g, '$$$1 \\approx $2$$');
    for (const seg of mathOf(text)) {
      const s = seg.replace(/(\d+(?:\.\d+)?)\s*\\%/g, '\\frac{$1}{100}').replace(/\^\\circ|\^\{\\circ\}|°|\\text\{[^}]*\}|\\boxed|\\,|\\;|\\!/g, ' ').replace(/\\(?:qquad|quad)\s*\/.*$/, '');
      if (/\\(?:underbrace|underline|sphericalangle|Delta|alpha|beta|ldots|cdots|dots|pi|sqrt|times(?=\s*\\)|to|Rightarrow)/.test(s) && !/\\sphericalangle/.test(s)) continue;
      const parts = s.split(/(\\approx|\\neq?|\\leq?|\\geq?|=|<|>)/);
      const vals = []; const rels = [];
      for (let i = 0; i < parts.length; i += 1) {
        if (i % 2) { rels.push(parts[i]); continue; }
        let v = null; let places = null;
        try { v = evalTex(parts[i].replace(/\\sphericalangle\s*[A-Z]+/g, 'LETTER')); const m = parts[i].trim().match(/^-?\d+\.(\d+)$/); places = m ? m[1].length : /^-?\d+$/.test(parts[i].trim()) ? 0 : null; } catch { v = null; }
        vals.push({ v, places, raw: parts[i].trim() });
      }
      for (let i = 0; i < rels.length; i += 1) {
        const a = vals[i]; const b = vals[i + 1]; const r = rels[i];
        if (!a?.v || !b?.v) continue;
        const c = a.v.cmp(b.v);
        let ok = true;
        if (r === '=') ok = c === 0;
        else if (r === '<') ok = c < 0;
        else if (r === '>') ok = c > 0;
        else if (/\\le/.test(r)) ok = c <= 0;
        else if (/\\ge/.test(r)) ok = c >= 0;
        else if (/\\ne/.test(r)) ok = c !== 0;
        else if (r === '\\approx') {
          ok = b.places != null && a.v.round(b.places).eq(b.v);
          if (ok && twoPlaces && !a.v.places(2) && b.places !== 2) pr.push(`"${a.raw} ≈ ${b.raw}": the question says two places after the point, the worked example writes ${b.places}`);
        }
        if (!ok) pr.push(`"${a.raw} ${r} ${b.raw}" is false (${a.v} vs ${b.v}) in: ${text}`);
      }
    }
  }
  return pr;
}
const twoPlacesRule = (it) => /מעוגל לשתי ספרות/.test(String(it.text || ''));

function runStair(topic, level, seeds = SEEDS) {
  const problems = []; const counts = {}; const missing = new Set();
  const L = TOPIC[topic].levels[level - 1];
  for (let s = 1; s <= seeds; s += 1) {
    for (const test of L.testGen ? [false, true] : [false]) {
      const it = draw(topic, level, s, test);
      const f = familyOf(it);
      const fn = ORACLES[f];
      if (!fn) { missing.add(f); continue; }
      counts[f] = (counts[f] || 0) + 1;
      let probs;
      try { probs = [...(fn(it) || []), ...mathHolds([...(it.solution || []), it.hint], twoPlacesRule(it))]; } catch (e) { probs = [`oracle error: ${e.message}`]; }
      for (const p of probs) problems.push(`${topic}:${level} seed ${s}${test ? ' (check)' : ''} ${it.key}: ${p}`);
    }
  }
  return { problems, counts, missing: [...missing] };
}


// ================================================================== the oracles, stair by stair
// (each returns its problems; checkNum covers the checker, solutionReaches the worked example)
const numItem = (it, V) => [...checkNum(it, V), ...solutionReaches(it, V)];

// ---- signed numbers: the display is the whole question
fam('sn1', (it) => numItem(it, evalTex(it.display)));
fam('sn1c', (it) => numItem(it, evalTex(it.display)));
fam('sn1n', (it) => { const V = evalTex(it.display); const pr = checkNum(it, V); if (!manipCorrect(it, manipSolution(it))) pr.push('the object\'s own solution is not right'); if (!q(it.manip.from).eq(numsOf(it.text)[0])) pr.push(`starts at ${it.manip.from}, the text says ${numsOf(it.text)[0]}`); return pr; });
fam('sn1r', (it) => checkChoices(it, (c) => { try { return choiceVal(c).eq(evalTex(it.display)) && /^-/.test(String(c.tex ?? c.text).trim()); } catch { return false; } }));
fam('sn2a', (it) => numItem(it, evalTex(it.display)));
fam('sn2o', (it) => {
  if (it.display && /=/.test(it.display)) { const r = solveLinear(it.display, '□'); return r.kind === 'one' ? numItem(it, r.x) : [`□ has ${r.kind} solutions`]; }
  if (it.display) return numItem(it, evalTex(it.display));
  const [n] = numsOf(it.text); return numItem(it, n.neg());
});
fam('sn2', (it) => {
  const [l, r] = it.display.split(/\\;\s*\\square\s*\\;/).map((x) => evalTex(x));
  const want = l.cmp(r) < 0 ? '<' : l.cmp(r) > 0 ? '>' : '=';
  return checkChoices(it, (c) => String(c.tex ?? c.text).trim() === want);
});
fam('sn2m', (it) => { const [n] = numsOf(it.text); return checkChoices(it, (c) => { const vs = numsOf(`$${String(c.tex ?? c.text).replace(/ו־/g, '$,$').replace(/‎/g, '')}$`); const want = n.isZero() ? [q(0)] : n.cmp(0) < 0 ? [] : [n, n.neg()]; return vs.length === want.length && want.every((w) => vs.some((v) => v.eq(w))); }); });
fam('sn2p', (it) => { const want = it.manip.labels.map((l) => Q.dec(String(l).replace('−', '-'))); const pr = []; if (!want.every((w, i) => w.eq(Q.of(it.answer[i])))) pr.push(`pins ${it.answer} for ${it.manip.labels}`); if (!manipCorrect(it, manipSolution(it))) pr.push('object solution'); return pr; });
fam('sn3', (it) => numItem(it, evalTex(it.display)));
fam('sn3z', (it) => { let V = null; try { V = evalTex(it.display); } catch { V = null; } return checkChoices(it, (c) => (V == null ? /לא מוגדר/.test(c.text || '') : c.tex != null && choiceVal(c).eq(V))); });
fam('sn4', (it) => numItem(it, evalTex(it.display)));
fam('sn5', (it) => numItem(it, evalTex(it.display)));
fam('sn5n', (it) => numItem(it, evalTex(it.display)));
fam('sn5d', (it) => numItem(it, evalTex(it.display)));
fam('sn6s', (it) => numItem(it, evalTex(it.display)));
fam('sn6a', (it) => numItem(it, evalTex(it.display)));
fam('sn6m', (it) => numItem(it, evalTex(it.display)));
fam('sn6p', (it) => { const [V] = numsOf(it.text); const pr = checkNum(it, V); if (!manipCorrect(it, manipSolution(it))) pr.push('object solution'); return pr; });
fam('sn6b', (it) => { const [V] = numsOf(it.text); const lo = V.n < 0n ? -((-V.n + V.d - 1n) / V.d) : V.n / V.d; return checkChoices(it, (c) => { const vs = numsOf(`$${c.tex ?? c.text}$`); return vs.length === 2 && vs[0].eq(new Q(lo)) && vs[1].eq(new Q(lo + 1n)); }); });
fam('sn7', (it) => numItem(it, evalTex(it.display)));

// ---- fractions floor (frac:1-4)
const lcm = (a, b) => { let x = a; while (x % b) x += a; return x; };
fam('fr1s', (it) => [...checkNum(it, evalTex(it.display))]);
fam('fr1r', (it) => {
  // the point is k parts of 1/den from 0: read off the drawing
  const { den, marks, from } = it.fig; const k = Math.round((marks[0].x - from) * den);
  if (Math.abs((marks[0].x - from) * den - k) > 1e-9) return [`the point ${marks[0].x} is not on a mark of ${den}ths`];
  return numItem(it, q(k, den).add(q(from)));
});
fam('fr1e', (it) => { const r = solveLinear(it.display, '□'); return r.kind === 'one' ? numItem(it, r.x) : [`□ has ${r.kind} solutions`]; });
fam('fr1p', (it) => { const [V] = numsOf(it.text); const pr = checkNum(it, V); if (Math.abs(it.manip.den * V.num() - Math.round(it.manip.den * V.num())) > 1e-9) pr.push(`den ${it.manip.den} has no mark at ${V}`); if (!manipCorrect(it, manipSolution(it))) pr.push('object solution'); return pr; });
fam('fr2b', (it) => { const vs = numsOf(it.text); const max = vs.reduce((a, b) => (b.cmp(a) > 0 ? b : a)); return numItem(it, max); });
fam('fr2d', (it) => numItem(it, evalTex(it.display)));
fam('fr2o', (it) => { const vs = numsOf(it.text); const pr = []; if (!vs.every((v, i) => Math.abs(v.num() - it.answer[i]) < 1e-9)) pr.push(`pins ${it.answer} for ${vs}`); if (!manipCorrect(it, manipSolution(it))) pr.push('object solution'); return pr; });
fam('fr2p', (it) => { const [A, B] = numsOf(it.text); const c = A.cmp(B); return checkChoices(it, (ch) => (ch.text === 'שווים' ? c === 0 : c !== 0 && choiceVal(ch).eq(c > 0 ? A : B))); });
fam('fr3a', (it) => numItem(it, evalTex(it.display)));
fam('fr3m', (it) => numItem(it, evalTex(it.display)));
fam('fr3d', (it) => numItem(it, evalTex(it.display)));
fam('fr3c', (it) => {
  const ds = numsOf(it.text).map((v) => Number(v.d)); const pr = [];
  if (JSON.stringify(it.answer.of) !== JSON.stringify(ds)) pr.push(`object asks for ${it.answer.of}, text marks 1/${ds.join(', 1/')}`);
  if (!manipCorrect(it, manipSolution(it))) pr.push('object solution');
  if (!new RegExp(`\\$${lcm(ds[0], ds[1])}\\$`).test(it.solution.join(' '))) pr.push(`worked example does not name ${lcm(ds[0], ds[1])}`);
  return pr;
});
fam('fr4m', (it) => numItem(it, evalTex(it.display)));
fam('fr4v', (it) => numItem(it, evalTex(it.display)));
fam('fr4q', (it) => { const [f, N] = numsOf(it.text); return numItem(it, f.mul(N)); });
fam('fr4g', (it) => {
  const [ex] = mathOf(it.text); const N = numsOf(it.text)[0]; const v = evalTex(ex); const up = v.cmp(N) > 0;
  const pr = checkChoices(it, (c) => (up ? /^גדולה/.test(c.text) : /^קטנה/.test(c.text)));
  // "= 26.66…": the digits before the dots are the value's own first digits (cut, not rounded: 80/3 is 26.666…)
  const dots = it.solution.join(' ').match(/=\s*(-?\d+\.\d+)\\ldots/);
  if (dots && !Q.dec(dots[1]).eq(v.trunc(dots[1].split('.')[1].length))) pr.push(`"${dots[1]}…" is not how ${v} = ${v.num()} begins`);
  return pr;
});

// ---- the coordinate plane: points as the text names them
/** Named points in a text: "A(4, -4)", "B′(1, 2)" → { A: [4, -4], "B'": [1, 2] }. */
function ptsOf(text) {
  const out = {};
  for (const m of String(text || '').replace(/[−–]/g, '-').matchAll(/([A-Z])(['′]?)\((-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\)/g)) out[`${m[1]}${m[2] ? "'" : ''}`] = [Number(m[3]), Number(m[4])];
  return out;
}
/** A point answer: the item's answer is p, the checker takes it (with a typographic minus too) and refuses it swapped. */
function checkPt(it, p) {
  const pr = [];
  if (!Array.isArray(it.answer) || it.answer[0] !== p[0] || it.answer[1] !== p[1]) pr.push(`answer (${it.answer}), oracle (${p})`);
  if (it.form === 'pt') {
    const u = readAnswer(it, { x: String(p[0]).replace('-', '−'), y: String(p[1]).replace('-', '–') });
    if (!isCorrect(it, u)) pr.push(`checker refuses (${p}) typed with − and –`);
    if (p[0] !== p[1] && isCorrect(it, [p[1], p[0]])) pr.push(`checker accepts the swapped (${p[1]}, ${p[0]})`);
    const shown = answerText(it).replace(/[−–]/g, '-');
    if (shown !== `(${p[0]}, ${p[1]})`) pr.push(`shown answer ${shown}, oracle (${p})`);
  }
  if (it.form === 'manip' && !manipCorrect(it, manipSolution(it))) pr.push('the object\'s own solution is not right');
  return pr;
}
const quadOf = ([x, y]) => (x > 0 && y > 0 ? 1 : x < 0 && y > 0 ? 2 : x < 0 && y < 0 ? 3 : x > 0 && y < 0 ? 4 : 0);
const QUAD_WORD = { ראשון: 1, הראשון: 1, שני: 2, השני: 2, שלישי: 3, השלישי: 3, רביעי: 4, הרביעי: 4 };
const quadIn = (text) => { const m = String(text).match(/רביע\s+(ה?(?:ראשון|שני|שלישי|רביעי))/); return m ? QUAD_WORD[m[1]] : 0; };
fam('cp1', (it) => { const lab = mathOf(it.text)[0]; const p = it.fig.points.find((pt) => pt.label === lab); return p ? checkPt(it, [p.x, p.y]) : [`no point ${lab} drawn`]; });
fam('cp1p', (it) => checkPt(it, Object.values(ptsOf(it.text))[0]));
fam('cp2', (it) => { const p = Object.values(ptsOf(it.text))[0]; const qd = quadOf(p); if (!qd) return [`(${p}) is on an axis: no quadrant`]; return checkChoices(it, (c) => quadIn(c.text) === qd); });
fam('cp2p', (it) => {
  const qd = quadIn(it.text); const [V] = numsOf(it.text); const axis = /שיעור ה־\$x\$/.test(it.text) ? 0 : 1; const pr = [];
  const R = it.manip.range || 6;
  for (let x = -R; x <= R; x += 1) for (let y = -R; y <= R; y += 1) {
    const want = quadOf([x, y]) === qd && (!V || [x, y][axis] === V.num());
    if (manipCorrect(it, [x, y]) !== want) pr.push(`(${x}, ${y}) is ${want ? '' : 'not '}a right point, the checker says otherwise`);
  }
  if (!manipCorrect(it, manipSolution(it))) pr.push('object solution');
  return pr.slice(0, 3);
});
fam('cp3', (it) => {
  const ps = Object.values(ptsOf(it.text)); const [a, b] = ps;
  if (a[0] !== b[0] && a[1] !== b[1]) return ['segment not parallel to an axis'];
  return numItem(it, q(Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1])));
});
fam('cp4', (it) => {
  const P = ptsOf(it.text); const [A, B, C, D] = ['A', 'B', 'C', 'D'].map((k) => P[k]);
  const rect = A[0] + C[0] === B[0] + D[0] && A[1] + C[1] === B[1] + D[1] && (A[0] === B[0] || A[1] === B[1]) && (B[0] === C[0] || B[1] === C[1]);
  if (!rect) return [`ABCD is not an axis-parallel rectangle: ${JSON.stringify(P)}`];
  const xs = [A, B, C, D].map((p) => p[0]); const ys = [A, B, C, D].map((p) => p[1]);
  return numItem(it, q((Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys))));
});
/** The fourth vertex of rectangle ABCD from the other three (A + C = B + D). */
function fourth(P, want) {
  const opp = { A: 'C', B: 'D', C: 'A', D: 'B' }; const next = { A: 'B', B: 'C', C: 'D', D: 'A' }; const prev = { A: 'D', B: 'A', C: 'B', D: 'C' };
  const n = P[next[want]]; const p = P[prev[want]]; const o = P[opp[want]];
  return [n[0] + p[0] - o[0], n[1] + p[1] - o[1]];
}
const axisRect = (P) => { const L = ['A', 'B', 'C', 'D']; return L.every((k, i) => { const a = P[k]; const b = P[L[(i + 1) % 4]]; return a[0] === b[0] || a[1] === b[1]; }); };
fam('cp5r', (it) => {
  const P = Object.fromEntries(it.manip.shape.map((s) => [s.label, s.at])); const want = it.manip.label;
  const p = fourth(P, want); P[want] = p; const pr = checkPt(it, p);
  if (!axisRect(P)) pr.push(`ABCD is not an axis-parallel rectangle: ${JSON.stringify(P)}`);
  return pr;
});
fam('cp5', (it) => { const P = ptsOf(it.text); const want = it.label; const p = fourth(P, want); P[want] = p; const pr = checkPt(it, p); if (!axisRect(P)) pr.push(`ABCD is not an axis-parallel rectangle: ${JSON.stringify(P)}`); return pr; });

// ---- angles: what the text says, and the drawing measured (every drawing here is to scale)
/** The size of a drawn angle (degrees, 0..180) from the figure's points. */
function measure(fig, a) {
  const O = fig.pts[a.at]; const A = fig.pts[a.from]; const B = fig.pts[a.to];
  const u = [A[0] - O[0], A[1] - O[1]]; const v = [B[0] - O[0], B[1] - O[1]];
  const c = (u[0] * v[0] + u[1] * v[1]) / Math.hypot(...u) / Math.hypot(...v);
  return (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI;
}
const degOf = (t) => { const m = String(t ?? '').match(/^(\d+(?:\.\d+)?)°$/); return m ? Number(m[1]) : null; };
/**
 * A drawing agrees with itself and with the answer: every angle written on it is its drawn size, a right-angle mark is
 * 90°, arcs with the same number of strokes are equal, parallel marks are parallel, and the asked angle measures the
 * answer.
 */
function drawingAgrees(it, ans = it.answer) {
  const f = it.fig; const pr = []; const TOL = 0.6;
  if (!f || f.type !== 'geo' || !f.angles) return pr;
  const byN = {};
  for (const a of f.angles) {
    const m = measure(f, a); const d = degOf(a.text);
    if (d != null && Math.abs(m - d) > TOL) pr.push(`drawn ∢${a.at} is ${m.toFixed(1)}°, written ${d}°`);
    if (a.right && Math.abs(m - 90) > TOL) pr.push(`right-angle mark at ${a.at} measures ${m.toFixed(1)}°`);
    if (a.n) (byN[a.n] = byN[a.n] || []).push(m);
    if (a.target && typeof ans === 'number' && Math.abs(m - ans) > TOL) pr.push(`asked ∢${a.at} is drawn ${m.toFixed(1)}°, answer ${ans}`);
  }
  for (const [n, ms] of Object.entries(byN)) if (Math.max(...ms) - Math.min(...ms) > TOL) pr.push(`arcs marked ${n} are not equal: ${ms.map((m) => m.toFixed(1)).join(', ')}`);
  const par = (f.segs || []).filter((s) => s.arrows);
  if (par.length === 2) {
    const dir = (s) => { const a = f.pts[s.a]; const b = f.pts[s.b]; return Math.atan2(b[1] - a[1], b[0] - a[0]); };
    const d = Math.abs(Math.sin(dir(par[0]) - dir(par[1])));
    if (d > 0.01) pr.push('lines marked parallel are not');
  }
  return pr;
}
const deg = (it) => numsOf(it.text);
const angleItem = (it, V) => [...numItem(it, V), ...drawingAgrees(it)];
const given = (it) => it.fig.angles.filter((a) => degOf(a.text) != null).map((a) => q(degOf(a.text)));
const sum = (xs) => xs.reduce((a, b) => a.add(b), q(0));
fam('an1', (it) => numItem(it, q(180).sub(q(it.fig.a))));
fam('an1f', (it) => { const [aoc, aob] = deg(it); return angleItem(it, aoc.sub(aob)); });
fam('an1d', (it) => { const [d] = deg(it); return angleItem(it, q(180).sub(d).div(2)); });
fam('an1s', (it) => angleItem(it, q(180).sub(sum(given(it)))));
fam('an1t', (it) => { const [t] = deg(it); const pr = checkNum(it, q(180).sub(t)); if (!manipCorrect(it, manipSolution(it))) pr.push('object solution'); return pr; });
fam('an2', (it) => numItem(it, it.fig.target === 'vertical' ? q(it.fig.a) : q(180).sub(q(it.fig.a))));
fam('an2t', (it) => angleItem(it, q(180).sub(sum(given(it)))));
fam('an2b', (it) => { const pr = drawingAgrees(it); const t = it.fig.angles.find((a) => a.target); return [...pr, ...checkNum(it, q(Math.round(measure(it.fig, t))))]; });
fam('an3', (it) => {
  const { angles, show } = it.fig; const pr = [];
  if (angles.reduce((a, b) => a + b, 0) !== 180) pr.push(`triangle angles ${angles} do not sum to 180`);
  const shown = angles.filter((_, i) => show[i]).map((x) => q(x));
  return [...pr, ...numItem(it, q(180).sub(sum(shown)))];
});
fam('an3d', (it) => {
  const { A, B } = it.manip; const C = it.answer;
  const dot = (A[0] - C[0]) * (B[0] - C[0]) + (A[1] - C[1]) * (B[1] - C[1]);
  const pr = dot === 0 ? [] : [`C(${C}) does not make a right angle at C`];
  if (!manipCorrect(it, manipSolution(it))) pr.push('object solution');
  return pr;
});
// α = ∢DAC (in ADC: 90° − ∢ADC) or β at B (in ABC: 90° − ∢BAC), as the question asks
fam('an3a', (it) => { const [, bac, adc] = deg(it); return angleItem(it, /DAC\$?\?/.test(it.text) ? q(90).sub(adc) : q(90).sub(bac)); });
fam('an3b', (it) => { const [, adc, bad] = deg(it); return angleItem(it, adc.sub(bad)); });
fam('an4', (it) => numItem(it, it.fig.kind === 'cointerior' ? q(180).sub(q(it.fig.a)) : q(it.fig.a)));
fam('an4t', (it) => { const t = it.fig.angles.find((a) => a.target); return [...drawingAgrees(it), ...checkNum(it, q(Math.round(measure(it.fig, t))))]; });
fam('an4b', (it) => { const t = it.fig.angles.find((a) => a.target); return [...drawingAgrees(it), ...checkNum(it, q(Math.round(measure(it.fig, t))))]; });
fam('an5', (it) => {
  const { angles, show, iso } = it.fig; const pr = [];
  if (angles.reduce((a, b) => a + b, 0) !== 180) pr.push(`triangle angles ${angles} do not sum to 180`);
  if (iso && angles[0] !== angles[1]) pr.push(`isosceles with base angles ${angles[0]}, ${angles[1]}`);
  const shown = angles.map((x, i) => (show[i] ? x : null));
  // an exterior angle beside the hidden one is the sum of the two shown (remote) angles
  if (it.fig.exterior) return [...pr, ...numItem(it, q(shown.filter((x) => x != null).reduce((a, b) => a + b, 0)))];
  // the base angles are equal: one shown base angle gives the other, the head is what is left
  const V = show[2] ? q(180 - angles[2]).div(2) : q(180 - 2 * (shown[0] ?? shown[1]));
  return [...pr, ...numItem(it, V)];
});
fam('an6w', (it) => { const [h] = deg(it); return angleItem(it, h.mul(2)); });
fam('an6h', (it) => { const [w] = deg(it); return angleItem(it, w.div(2)); });
fam('an6l', (it) => { const [aob] = deg(it); return angleItem(it, q(180).sub(aob).div(2)); });
fam('an6t', (it) => { const [a, b] = deg(it); return angleItem(it, a.add(b).mul(2)); });
fam('an6c', (it) => {
  const [aod, aob, cod] = deg(it); const boc = aod.sub(aob).sub(cod); const yes = boc.eq(cod);
  const pr = drawingAgrees(it, null);
  return [...pr, ...checkChoices(it, (c) => { const t = String(c.text); if (/נראית/.test(t)) return false; if (yes) return /^כן/.test(t) && numsOf(`$${t.replace(/[⁦⁩∢A-Z=]/g, ' ').replace(/°/g, '')}$`).some((v) => v.eq(cod)); return /^לא/.test(t) && t.includes(`${boc}°`); })];
});
fam('an7a', (it) => { const g = deg(it); return angleItem(it, q(360).sub(sum(g))); });
fam('an7b', (it) => { const g = deg(it); return angleItem(it, q(270).sub(sum(g))); });
fam('an7c', (it) => { const [a, b] = deg(it); return angleItem(it, q(360).sub(a).sub(b).div(2)); });

// ---- algebraic expressions
/** An expression answer {k, c}: the item's, the checker's, and the screen's. */
function checkLin(it, { k, c }) {
  const pr = []; const a = it.answer;
  if (!a || !k.eq(Q.of(a.k)) || !c.eq(Q.of(a.c))) pr.push(`answer ${JSON.stringify(a)}, oracle ${k}${it.var || 'x'} + ${c}`);
  if (!isCorrect(it, readAnswer(it, { k: String(k.num()).replace('-', '−'), c: String(c.num()).replace('-', '–') }))) pr.push(`checker refuses ${k}, ${c}`);
  if (isCorrect(it, { k: k.num() + 1, c: c.num() }) || isCorrect(it, { k: k.num(), c: c.num() - 1 })) pr.push('checker accepts a near miss');
  const shown = answerText(it);
  if (!sameLin(shown.replace(/[−–]/g, '-').replace(/\((-?\d+)\/(\d+)\)/g, '\\frac{$1}{$2}'), it.var || 'x', { k, c })) pr.push(`shown "${shown}" is not ${k}x + ${c}`);
  return pr;
}
const linItem = (it, l) => [...checkLin(it, l), ...linSolution(it, l)];
/** The worked example's last line holds the answer expression. */
function linSolution(it, l) {
  const v = it.var || 'x';
  const ok = (it.solution || []).some((line) => mathOf(line).some((seg) => seg.split(/=/).some((p) => sameLin(p.replace(/\\underbrace\{[^}]*\}_\{[^}]*\}/g, ''), v, l))));
  return ok ? [] : [`worked example never reaches ${l.k}${v} + ${l.c}`];
}
/** The value x = … given in a text ("כש־$x = -3$"). */
const givenVar = (text) => { for (const seg of mathOf(text)) { const m = seg.match(/^\s*([a-z])\s*=\s*(.+)$/); if (m) return { v: m[1], val: evalTex(m[2]) }; } return null; };
fam('ex1', (it) => { const g = givenVar(it.text); return numItem(it, evalTex(it.display, { [g.v]: g.val })); });
fam('ex1m', (it) => { const g = givenVar(it.text); const V = evalTex(it.display, { [g.v]: g.val }); return checkChoices(it, (c) => choiceVal(c).eq(V)); });
fam('ex1t', (it) => {
  const ex = mathOf(it.text)[0]; const v = 'x'; const pr = [];
  for (const [x, y] of it.fig.rows) if (y !== '?' && !evalTex(ex, { [v]: Q.of(x) }).eq(Q.of(y))) pr.push(`table row ${x} → ${y} is not ${ex}`);
  const row = it.fig.rows.find((r) => r[1] === '?');
  return [...pr, ...numItem(it, evalTex(ex, { [v]: Q.of(row[0]) }))];
});
/** First term and step of a pattern question, and the table drawn with it. */
function pattern(it) {
  const [a, d] = numsOf(it.text); const pr = [];
  for (const [n, y] of it.fig?.rows || []) if (!a.add(d.mul(Q.of(n) .sub(1))).eq(Q.of(y))) pr.push(`table row ${n} → ${y} is not ${a} + ${d}(n − 1)`);
  return { a, d, pr };
}
fam('ex2l', (it) => { const { a, d, pr } = pattern(it); return [...pr, ...linItem(it, { k: d, c: a.sub(d) })]; });
fam('ex2n', (it) => { const { a, d, pr } = pattern(it); const n = numsOf(it.text)[2]; return [...pr, ...numItem(it, a.add(d.mul(n.sub(1))))]; });
fam('ex2m', (it) => { const { a, d, pr } = pattern(it); return [...pr, ...checkChoices(it, (c) => sameLin(c.tex, 'n', { k: d, c: a.sub(d) }))]; });
fam('ex2w', (it) => {
  const t = it.text; const v = mathOf(t).find((s) => /^[a-z]$/.test(s.trim())).trim(); const [n] = numsOf(t);
  const want = /גדול פי|יש פי/.test(t) ? { k: n, c: q(0) } : /פחות מ/.test(t) ? { k: q(1), c: n.neg() } : /יותר מ|מבוגר/.test(t) ? { k: q(1), c: n } : null;
  if (!want) return [`unknown story: ${t}`];
  return checkChoices(it, (c) => sameLin(c.tex, v, want));
});
fam('ex3t', (it) => { const { px, nx, p1, n1 } = it.fig; return linItem(it, { k: q(px - nx), c: q(p1 - n1) }); });
fam('ex3', (it) => linItem(it, linOf(it.display, it.var || 'x')));
fam('ex3z', (it) => linItem(it, linOf(it.display, it.var || 'x')));
fam('ex3b', (it) => linItem(it, linOf(it.display, it.var || 'x')));
fam('ex3i', (it) => { const l = linOf(it.display, it.var || 'x'); return checkChoices(it, (c) => sameLin(c.tex, it.var || 'x', l)); });
fam('ex3r', (it) => {
  const v = it.var || 'x'; const l = linOf(it.display, v);
  // the right row is the same expression, its letter terms first
  const sorted = (tex) => { const parts = String(tex).replace(/\s+/g, '').split(/(?=[+-])/); const firstNum = parts.findIndex((p) => !p.includes(v)); return firstNum < 0 || parts.slice(firstNum).every((p) => !p.includes(v)); };
  return checkChoices(it, (c) => sameLin(c.tex, v, l) && sorted(c.tex));
});
fam('ex4', (it) => linItem(it, linOf(it.display, it.var || 'x')));
fam('ex4t', (it) => linItem(it, linOf(it.display, it.var || 'x')));
fam('ex4m', (it) => numItem(it, evalTex(it.display)));
fam('ex4a', (it) => { const [h, len] = mathOf(it.text); return linItem(it, linOf(`${h}(${len})`)); });
fam('ex5', (it) => linItem(it, linOf(it.display, it.var || 'x')));
fam('ex5e', (it) => { const l = linOf(it.display, it.var || 'x'); return checkChoices(it, (c) => sameLin(c.tex, it.var || 'x', l)); });
fam('ex5s', (it) => {
  // the given relation (a + b = −4) fixes the expression's value: try three pairs that keep it
  const rel = mathOf(it.text).find((s) => /=/.test(s)); const letters = [...new Set(rel.match(/[a-z]/g))];
  const vals = [0, 1, 7].map((t) => { const r = solveLinear(rel, letters[1], { [letters[0]]: q(t) }); return evalTex(it.display, { [letters[0]]: q(t), [letters[1]]: r.x }); });
  if (!vals.every((x) => x.eq(vals[0]))) return [`the expression is not fixed by ${rel}: ${vals.join(', ')}`];
  return numItem(it, vals[0]);
});

// ---- equations
/** Solve the shown equation in its letter: linear, or linear once both sides are multiplied by the letter (8/x = 4/7). */
function solveShown(tex, v) {
  try { return solveLinear(tex, v); } catch (e) {
    const f = diffFn(tex, v); const g = (x) => f(x).mul(x);
    const g1 = g(q(1)); const g2 = g(q(2)); const a = g2.sub(g1); const b = g1.sub(a);
    for (const t of [3, -1, 5]) if (!g(q(t)).eq(b.add(a.mul(q(t))))) throw e;
    if (a.isZero()) return { kind: b.isZero() ? 'all' : 'none' };
    const x = b.neg().div(a);
    return x.isZero() ? { kind: 'none' } : { kind: 'one', x };
  }
}
const eqItem = (it) => { const r = solveShown(it.display, it.var || 'x'); return r.kind === 'one' ? numItem(it, r.x) : [`the equation has ${r.kind} solutions`]; };
for (const f of ['eq1', 'eq2', 'eq2c', 'eq2f', 'eq3', 'eq4', 'eq4e', 'eq4f', 'eq7', 'eq7p', 'eq7x']) fam(f, eqItem);
fam('eqs', (it) => { const r = solveShown(it.display, it.var || 'x'); const word = { all: 'כל מספר הוא פתרון', one: 'פתרון אחד', none: 'אין פתרון' }[r.kind]; return checkChoices(it, (c) => c.text === word); });
fam('eq1m', (it) => { const g = givenVar(it.text); const r = solveLinear(it.display, '□', { [g.v]: g.val }); return r.kind === 'one' ? numItem(it, r.x) : [`□ has ${r.kind} values`]; });
fam('eq1w', (it) => checkChoices(it, (c) => diffFn(it.display, 'x')(choiceVal(c)).isZero()));
const balance = (it) => { const { lx, l1, rx, r1 } = it.manip.start; const x = q(r1 - l1, lx - rx); const pr = checkNum(it, x); if (!manipCorrect(it, manipSolution(it))) pr.push('object solution'); return [...pr, ...solutionReaches(it, x)]; };
for (const f of ['eq1b', 'eq2b', 'eq3b']) fam(f, balance);
fam('eq2s', (it) => { const [A, B, T] = numsOf(it.text); return numItem(it, T.sub(A).div(B)); });
fam('eq5c', (it) => { const [S] = numsOf(it.text); const m = S.div(3); return numItem(it, /הקטן/.test(it.text) ? m.sub(1) : /האמצעי/.test(it.text) ? m : m.add(1)); });
fam('eq5t', (it) => { const [d] = numsOf(it.text); return numItem(it, /הקטנה מבין/.test(it.text) ? q(90).sub(d).div(2) : q(90).add(d).div(2)); });
fam('eq5w', (it) => { const [W, k] = numsOf(it.text); const light = W.div(k.add(1)); return numItem(it, /הקלה\?/.test(it.text) ? light : light.mul(k)); });
fam('eq5x', (it) => { const [d, T] = numsOf(it.text).filter((_, i) => i < 2 ? true : true).slice(0, 2); const x = T.sub(d).div(2); return numItem(it, x.add(d)); });
fam('eq5y', (it) => { const [d, m, k] = numsOf(it.text); const x = d.add(m).add(k.mul(m)).div(k.sub(1)); return numItem(it, /בתיבה א׳ בהתחלה/.test(it.text) ? x : x.add(d)); });
fam('eq5s', (it) => {
  const [k, g] = numsOf(it.text); const x = g.mul(2).div(k.sub(1)); const t = it.text.split('.').pop();
  const giver = it.text.match(/^ל(\S+) יש פי/)[1];
  const V = /לשניהם יחד/.test(t) ? x.mul(k.add(1)) : t.includes(`ל${giver} בהתחלה`) ? x.mul(k) : x;
  return numItem(it, V);
});
fam('eq5a', (it) => {
  const [d, f, k] = numsOf(it.text); const x = d.add(k.sub(1).mul(f)).div(k.sub(1));
  const older = it.text.match(/^(\S+) מבוגר/)[1];
  return numItem(it, new RegExp(`בן כמה ${older} היום`).test(it.text) ? x.add(d) : x);
});
fam('eq5b', (it) => {
  const [n1, n2, p] = numsOf(it.text); const x = n2.mul(p).div(n1.sub(n2)); const first = it.text.match(/^(\S+) קנה/)[1];
  return numItem(it, new RegExp(`כדור של ${first}\\?`).test(it.text) ? x : x.add(p));
});
fam('eq5r', (it) => {
  // sides x and kx + c (x + 6, 2x), perimeter P: 2(x + kx + c) = P
  const segs = mathOf(it.text); const s2 = linOf(segs[1]); const [P] = numsOf(`$${segs[2]}$`);
  const x = P.div(2).sub(s2.c).div(s2.k.add(1)); const other = s2.k.mul(x).add(s2.c);
  const V = /שטח המלבן/.test(it.text) ? x.mul(other) : /אורך הצלע/.test(it.text) ? other : x;
  return numItem(it, V);
});
fam('eq5g', (it) => {
  // the angle expressions as written, their sum is 180° or 360°
  const exprs = Object.fromEntries(mathOf(it.text).map((s) => s.match(/^\\sphericalangle\s*([A-Z])\s*=\s*(.+)$/)).filter(Boolean).map((m) => [m[1], m[2].replace(/\^\\circ/g, '')]));
  const total = /במרובע/.test(it.text) ? 360 : 180;
  const r = solveLinear(`${Object.values(exprs).join(' + ')} = ${total}`, 'x');
  if (r.kind !== 'one') return [`angles have ${r.kind} solutions`];
  const pr = [];
  for (const a of it.fig.angles || []) { const e = exprs[a.at]; if (e && Math.abs(measure(it.fig, a) - evalTex(e, { x: r.x }).num()) > 0.6) pr.push(`∢${a.at} drawn ${measure(it.fig, a).toFixed(1)}°, is ${evalTex(e, { x: r.x })}°`); }
  const ask = it.text.match(/מה גודל \$\\sphericalangle\s*([A-Z])\$/);
  return [...pr, ...numItem(it, ask ? evalTex(exprs[ask[1]], { x: r.x }) : r.x)];
});
/** Two linear expressions are the same equation: one difference is a multiple of the other. */
function sameEq(tex, canon, v = 'x') {
  try {
    const f = diffFn(tex, v); const g = diffFn(canon, v);
    const fa = f(q(1)).sub(f(q(0))); const ga = g(q(1)).sub(g(q(0)));
    for (const t of [2, -3]) if (!f(q(t)).eq(f(q(0)).add(fa.mul(q(t))))) return false;
    if (ga.isZero()) return false;
    const r = fa.div(ga);
    return !r.isZero() && [0, 1, 5, -2].every((t) => f(q(t)).eq(g(q(t)).mul(r)));
  } catch { return false; }
}
fam('eq5p', (it) => {
  const t = it.text; const n = numsOf(t);
  let canon;
  if (/בולים/.test(t)) canon = `${n[0]}x - ${n[1]} = x + ${n[1]}`;
  else if (/בעוד/.test(t)) canon = `x + ${n[0]} + ${n[1]} = ${n[2]}(x + ${n[1]})`;
  else if (/בנות/.test(t)) canon = `x + ${n[1]}x = ${n[0]}`;
  else if (/מלבן/.test(t)) canon = `2(${n[0]}x + x) = ${n[1]}`;
  else return [`unknown story: ${t}`];
  return checkChoices(it, (c) => sameEq(c.tex, canon));
});
/** The hours a text writes in words or as a number ("כעבור שעה", "שעתיים", "$3$ שעות"). */
const laterBy = (t) => (/כעבור שעה /.test(t) ? q(1) : /כעבור שעתיים/.test(t) ? q(2) : null);
fam('eq6', (it) => {
  const t = it.text; const n = numsOf(t);
  if (/זה לקראת זה|זו לקראת זו/.test(t)) { const [D, v1, v2] = n; const time = D.div(v1.add(v2)); return numItem(it, /במרחק כמה/.test(t) ? v1.mul(time) : time); }
  if (/וחזרו/.test(t)) { const [v1, v2, T] = n; return numItem(it, T.mul(v1).mul(v2).div(v1.add(v2))); }
  if (/יצאה אחרי/.test(t)) {
    const h = laterBy(t); const [v1, a, b] = n; const lag = h ?? a; const v2 = h ? a : b;
    const time = v1.mul(lag).div(v2.sub(v1));
    return numItem(it, /במרחק כמה/.test(t) ? v2.mul(time) : time);
  }
  return [`unknown story: ${t}`];
});
fam('eq6u', (it) => { const [v, min] = numsOf(it.text); return numItem(it, v.mul(min).div(60)); });
fam('eq6t', (it) => {
  const t = it.text; const n = numsOf(t); let canon;
  if (/לקראת/.test(t)) { const row = it.fig.rows; canon = `${row[0][1]}x + ${row[1][1]}x = ${n[0]}`; } else { const h = laterBy(t); const [v1, a, b] = n; const lag = h ?? a; const v2 = h ? a : b; canon = `${v2}x = ${v1}(x + ${lag})`; }
  return checkChoices(it, (c) => sameEq(c.tex, canon));
});
fam('eq6g', (it) => {
  const [A, B] = it.fig.series.map((s) => s.pts.map(([x, y]) => [Q.of(x), Q.of(y)]));
  const line = ([[x0, y0], [x1, y1]]) => ({ m: y1.sub(y0).div(x1.sub(x0)), b: y0.sub(y1.sub(y0).div(x1.sub(x0)).mul(x0)) });
  const a = line(A); const b = line(B);
  return numItem(it, b.b.sub(a.b).div(a.m.sub(b.m)));
});
fam('eq7l', (it) => { const [a, b] = numsOf(it.text).map((x) => Number(x.n)); return checkChoices(it, (c) => Number(c.tex) === lcm(a, b)); });

// ---- transformations
/** A shift in words: "3 ימינה ו־4 למעלה", "$2$ יחידות שמאלה" → [dx, dy]. */
function shiftOf(t) {
  let dx = 0; let dy = 0;
  for (const m of String(t).replace(/\$/g, '').matchAll(/(\d+)\s*(?:יחידות\s*)?(ימינה|שמאלה|למעלה|למטה)/g)) {
    const n = Number(m[1]); if (m[2] === 'ימינה') dx += n; else if (m[2] === 'שמאלה') dx -= n; else if (m[2] === 'למעלה') dy += n; else dy -= n;
  }
  return [dx, dy];
}
const samePts = (a, b) => a.length === b.length && a.every((p, i) => p[0] === b[i][0] && p[1] === b[i][1]);
const reflect = ([x, y], m) => (m === 'x' ? [x, -y] : m === 'y' ? [-x, y] : m.y != null ? [x, 2 * m.y - y] : [2 * m.x - x, y]);
const turn = ([x, y], [cx, cy], by) => { const dx = x - cx; const dy = y - cy; return by === 180 ? [cx - dx, cy - dy] : by === 90 ? [cx - dy, cy + dx] : [cx + dy, cy - dx]; };
function checkShape(it, want) {
  const pr = [];
  if (!samePts(it.answer.pts, want)) pr.push(`answer ${JSON.stringify(it.answer.pts)}, oracle ${JSON.stringify(want)}`);
  if (!manipCorrect(it, manipSolution(it))) pr.push('object solution');
  return pr;
}
fam('tf1w', (it) => { const [A, B] = it.fig.shapes; const d = [B.pts[0][0] - A.pts[0][0], B.pts[0][1] - A.pts[0][1]]; const pr = A.pts.every((p, i) => B.pts[i][0] - p[0] === d[0] && B.pts[i][1] - p[1] === d[1]) ? [] : ['the image is not a shift']; return [...pr, ...checkChoices(it, (c) => { const s = shiftOf(c.text); return s[0] === d[0] && s[1] === d[1]; })]; });
fam('tf1s', (it) => { const [dx, dy] = shiftOf(it.text); const sh = it.fig.shapes[0]; const lab = it.label.replace(/['′]/, ''); const p = sh.pts[sh.names.indexOf(lab)]; return checkPt(it, [p[0] + dx, p[1] + dy]); });
fam('tf1c', (it) => { const [dx, dy] = shiftOf(it.text); return checkShape(it, it.manip.shape.pts.map(([x, y]) => [x + dx, y + dy])); });
fam('tf1v', (it) => { const P = ptsOf(it.text); const d = [P["A'"][0] - P.A[0], P["A'"][1] - P.A[1]]; return checkPt(it, [P.C[0] + d[0], P.C[1] + d[1]]); });
fam('tf2a', (it) => { const P = ptsOf(it.text); const axis = /ציר ה־\$x\$/.test(it.text) ? 'x' : /ציר ה־\$y\$/.test(it.text) ? 'y' : null; return axis ? checkPt(it, reflect(P.A, axis)) : ['no axis named']; });
fam('tf2l', (it) => { const P = ptsOf(it.text); const m = it.text.match(/לישר \$([xy])\s*=\s*(-?\d+)\$/); return m ? checkPt(it, reflect(P.A, { [m[1]]: Number(m[2]) })) : ['no line named']; });
fam('tf2c', (it) => { const [m] = it.manip.moves.flips; return checkShape(it, it.manip.shape.pts.map((p) => reflect(p, typeof m === 'string' ? m : m))); });
const SYM_AXES = [[/משולש שווה־צלעות/, 3], [/משולש שווה־שוקיים שאינו/, 1], [/משושה משוכלל/, 6], [/מלבן שאינו ריבוע/, 2], [/מעוין שאינו ריבוע/, 2], [/דלתון שאינו מעוין/, 1], [/מקבילית שאינה/, 0], [/ל?ריבוע\?/, 4]];
fam('tf2s', (it) => { const hit = SYM_AXES.find(([re]) => re.test(it.text)); return hit ? checkNum(it, q(hit[1])) : [`unknown shape: ${it.text}`]; });
const TURN_MIN = [[/משולש שווה צלעות/, 120], [/משושה משוכלל/, 60], [/ריבוע/, 90], [/מלבן/, 180]];
fam('tf3r', (it) => { const hit = TURN_MIN.find(([re]) => re.test(it.text)); return hit ? numItem(it, q(hit[1])) : [`unknown shape: ${it.text}`]; });
fam('tf3q', (it) => { const P = ptsOf(it.text); return checkPt(it, turn(P.A, [0, 0], /עם כיוון השעון/.test(it.text) ? -90 : 90)); });
fam('tf3h', (it) => { const P = ptsOf(it.text); return checkPt(it, turn(P.A, P.O, 180)); });
fam('tf3c', (it) => {
  const P = ptsOf(it.text); const by = /חצי סיבוב/.test(it.text) ? 180 : /נגד כיוון השעון/.test(it.text) ? 90 : -90;
  return checkShape(it, it.manip.shape.pts.map((p) => turn(p, P.O, by)));
});
fam('tf4g', (it) => {
  const [a, b, h, s] = numsOf(it.text); const pr = [];
  if (!s.mul(s).eq(b.sub(a).mul(b.sub(a)).add(h.mul(h)))) pr.push(`a right trapezoid with bases ${a}, ${b} and height ${h} has no slanted leg ${s}`);
  // mirrored along the height: an isosceles trapezoid (bases 2a, 2b, two legs s); turned along s: a rectangle (a + b) × h
  const P = /לאורך הגובה/.test(it.text) ? a.add(b).add(s).mul(2) : a.add(b).add(h).mul(2);
  return [...pr, ...numItem(it, P)];
});
fam('tf4r', (it) => { const [a, b, c, d] = numsOf(it.text); const same = (a.eq(c) && b.eq(d)) || (a.eq(d) && b.eq(c)); return checkChoices(it, (ch) => (same ? /^כן/.test(ch.text) : /^לא/.test(ch.text))); });
fam('tf4t', (it) => { const [a] = numsOf(it.text); return numItem(it, q(360).div(a)); });
/** Which motions take one set of grid points onto another (as sets). */
function motions(A, B) {
  const key = (ps) => ps.map((p) => p.join(',')).sort().join(';');
  const kb = key(B); const out = new Set();
  if (A.length !== B.length) return out;
  for (const p of B) { const d = [p[0] - A[0][0], p[1] - A[0][1]]; if ((d[0] || d[1]) && key(A.map(([x, y]) => [x + d[0], y + d[1]])) === kb) out.add('הזזה'); }
  for (let c = -16; c <= 16; c += 1) {
    const h = c / 2;
    if (key(A.map(([x, y]) => [x, 2 * h - y])) === kb || key(A.map(([x, y]) => [2 * h - x, y])) === kb || key(A.map(([x, y]) => [y - h, x + h])) === kb || key(A.map(([x, y]) => [-y + h, -x + h])) === kb) out.add('שיקוף');
  }
  for (let cx = -16; cx <= 16; cx += 1) for (let cy = -16; cy <= 16; cy += 1) for (const by of [90, 180, -90]) if (key(A.map((p) => turn(p, [cx / 2, cy / 2], by))) === kb) out.add('סיבוב');
  return out;
}
fam('tf4m', (it) => {
  const [A, B] = it.fig.shapes.map((s) => s.pts); const ms = motions(A, B);
  if (ms.size > 1) return [`more than one motion fits: ${[...ms].join(', ')}`];
  return checkChoices(it, (c) => (ms.size ? ms.has(c.text) : /לא חופפות/.test(c.text)));
});

// ---- areas and perimeters
/** "AC = 11" in a text → { AC: 11 }; the right angle "∢C = 90°". */
function sidesOf(t) {
  const out = {};
  for (const seg of mathOf(t)) { const m = seg.match(/^([A-Z]{2})\s*=\s*(\d+(?:\.\d+)?|[a-z])$/); if (m) out[m[1]] = /\d/.test(m[2]) ? Q.dec(m[2]) : m[2]; }
  return out;
}
const rightAt = (t) => (String(t).match(/\\sphericalangle\s*([A-Z])\s*=\s*90/) || [])[1];
const shoelace = (ps) => { let s = q(0); for (let i = 0; i < ps.length; i += 1) { const [x1, y1] = ps[i]; const [x2, y2] = ps[(i + 1) % ps.length]; s = s.add(Q.of(x1).mul(Q.of(y2)).sub(Q.of(x2).mul(Q.of(y1)))); } return s.abs().div(2); };
const isqrt = (v) => { const n = v.num(); const r = Math.round(Math.sqrt(n)); return q(r).mul(q(r)).eq(v) ? q(r) : null; };
const legsAt = (S, v) => Object.entries(S).filter(([k]) => k.includes(v)).map(([, x]) => x);
fam('ar1r', (it) => { const [a, b] = numsOf(it.text); return numItem(it, /היקף/.test(it.text) ? a.add(b).mul(2) : a.mul(b)); });
fam('ar1m', (it) => { const [S, a] = numsOf(it.text); return numItem(it, /^היקף/.test(it.text) ? S.sub(a.mul(2)).div(2) : S.div(a)); });
fam('ar1s', (it) => {
  const [n] = numsOf(it.text); const t = it.text;
  if (/^היקף ריבוע/.test(t)) return numItem(it, n.div(4));
  if (/^שטח ריבוע/.test(t)) { const r = isqrt(n); return r ? numItem(it, r) : [`area ${n} has no whole side`]; }
  return numItem(it, /היקף/.test(t) ? n.mul(4) : n.mul(n));
});
fam('ar1u', (it) => { const area = /השטח/.test(it.text); return checkChoices(it, (c) => (area ? /^(סמ״ר|מ״ר)$/.test(c.text) : /^(ס״מ|מ׳|מ״מ|ק״מ)$/.test(c.text))); });
fam('ar2l', (it) => { const S = sidesOf(it.text); const v = rightAt(it.text); const [a, b] = legsAt(S, v); return numItem(it, a.mul(b).div(2)); });
fam('ar2t', (it) => {
  const S = sidesOf(it.text); const v = rightAt(it.text); const [a, b] = legsAt(S, v); const hyp = Object.entries(S).find(([k]) => !k.includes(v))[1];
  const pr = a.mul(a).add(b.mul(b)).eq(hyp.mul(hyp)) ? [] : [`legs ${a}, ${b} and hypotenuse ${hyp} are not a right triangle`];
  return [...pr, ...numItem(it, a.mul(b).div(2))];
});
fam('ar2g', (it) => { const [base, h, other] = numsOf(it.text); const pr = other.cmp(h) >= 0 ? [] : [`side ${other} is shorter than the height ${h}`]; return [...pr, ...numItem(it, base.mul(h).div(2))]; });
fam('ar2x', (it) => {
  const S = sidesOf(it.text); const v = rightAt(it.text); const area = numsOf(it.text).pop();
  const legs = Object.entries(S).filter(([k]) => k.includes(v)); const known = legs.find(([, x]) => x instanceof Q)[1];
  const x = area.mul(2).div(known); const pr = [];
  const hyp = Object.entries(S).find(([k]) => !k.includes(v));
  if (hyp && !known.mul(known).add(x.mul(x)).eq(hyp[1].mul(hyp[1]))) pr.push(`legs ${known}, ${x} do not fit the hypotenuse ${hyp[1]}`);
  return [...pr, ...numItem(it, x)];
});
const gridTri = (it) => numItem(it, shoelace(Object.values(it.fig.pts)));
fam('ar2q', gridTri);
fam('ar3g', gridTri);
fam('ar2w', (it) => {
  const P = it.fig.pts; const [B, C] = [P.B, P.C]; const bc = [C[0] - B[0], C[1] - B[1]];
  return checkChoices(it, (c) => { const [a, e] = String(c.tex); const u = [P[e][0] - P[a][0], P[e][1] - P[a][1]]; const onLine = Math.abs((P[e][0] - B[0]) * bc[1] - (P[e][1] - B[1]) * bc[0]) < 1e-9; return onLine && Math.abs(u[0] * bc[0] + u[1] * bc[1]) < 1e-9; });
});
fam('ar3k', (it) => { const [a, b] = numsOf(it.text); return numItem(it, a.mul(b).div(2)); });
fam('ar3l', (it) => { const [, a, b, c, d] = [null, ...numsOf(it.text)]; const pr = c.cmp(a) < 0 && d.cmp(b) < 0 ? [] : ['the corner cut is not inside the rectangle']; return [...pr, ...numItem(it, a.mul(b).sub(c.mul(d)))]; });
fam('ar3m', (it) => { const [a, b, c, d] = numsOf(it.text); const A = a.mul(b).sub(c.mul(d)); return checkChoices(it, (ch) => choiceVal(ch).eq(A)); });
fam('ar3t', (it) => { const [a, b, c, d] = numsOf(it.text); return numItem(it, a.mul(b).sub(c.mul(d).div(2))); });
fam('ar3u', (it) => { const [a, b, s] = numsOf(it.text); const n1 = a.mul(100).div(s); const n2 = b.mul(100).div(s); const pr = n1.isInt() && n2.isInt() ? [] : ['the tiles do not fit whole']; return [...pr, ...numItem(it, n1.mul(n2))]; });
fam('ar4p', (it) => { const [base, h, other] = numsOf(it.text); const pr = other.cmp(h) >= 0 ? [] : [`side ${other} is shorter than the height ${h}`]; return [...pr, ...numItem(it, base.mul(h))]; });
fam('ar4t', (it) => { const [a, b, h, s] = numsOf(it.text); const pr = s.mul(s).eq(a.sub(b).mul(a.sub(b)).add(h.mul(h))) ? [] : [`slanted leg ${s} does not fit bases ${a}, ${b}, height ${h}`]; return [...pr, ...numItem(it, a.add(b).mul(h).div(2))]; });
fam('ar4i', (it) => { const n = numsOf(it.text); return numItem(it, /טרפז/.test(it.text) ? n[0].mul(2).div(n[1].add(n[2])) : n[0].div(n[1])); });
fam('ar5p', (it) => {
  const n = numsOf(it.text);
  if (/טרפז/.test(it.text)) { const [a, b, h] = n; const s = isqrt(a.sub(b).mul(a.sub(b)).add(h.mul(h))); return s ? numItem(it, a.add(b).add(h).add(s)) : ['the slanted leg is not whole']; }
  const [a, b] = n; const c = isqrt(a.mul(a).add(b.mul(b))); return c ? numItem(it, a.add(b).add(c)) : ['the hypotenuse is not whole'];
});
fam('ar5l', (it) => { const [a, b, c, d] = numsOf(it.text); const pr = c.cmp(a) < 0 && d.cmp(b) < 0 ? [] : ['the corner cut is not inside']; return [...pr, ...numItem(it, a.add(b).mul(2))]; });
fam('ar5u', (it) => { const [m, cm] = numsOf(it.text); return numItem(it, m.mul(100).add(cm).mul(2)); });
fam('ar5x', (it) => { const [P] = numsOf(it.text); return numItem(it, P.div(4).mul(P.div(4))); });
fam('ar5c', (it) => { const [a, b, c, d] = numsOf(it.text); const pr = a.add(b).eq(c.add(d)) ? [] : ['the perimeters differ']; const s = a.mul(b).cmp(c.mul(d)); return [...pr, ...checkChoices(it, (ch) => (s > 0 ? ch.text === 'לראשון' : s < 0 ? ch.text === 'לשני' : /שווים/.test(ch.text)))]; });
const objectOnly = (it) => (manipCorrect(it, manipSolution(it)) ? [] : ['the object\'s own solution is not right']);
fam('ar1b', (it) => { const { area, perim } = it.answer; let ok = false; for (let w = 1; w <= 30; w += 1) if (area % w === 0 && 2 * (w + area / w) === perim) ok = true; return [...(ok ? [] : [`no rectangle has area ${area} and perimeter ${perim}`]), ...objectOnly(it)]; });
fam('ar4c', objectOnly);
fam('ar5b', objectOnly);

// ---- boxes and prisms
fam('so1s', (it) => { const [a, b, c] = numsOf(it.text); return numItem(it, a.mul(b).add(b.mul(c)).add(c.mul(a)).mul(2)); });
fam('so1c', (it) => { const [n] = numsOf(it.text); if (/^שטח הפנים/.test(it.text)) { const r = isqrt(n.div(6)); return r ? numItem(it, r) : ['no whole edge']; } return numItem(it, n.mul(n).mul(6)); });
fam('so1e', (it) => { const [a, b, c] = numsOf(it.text); return numItem(it, a.add(b).add(c).mul(4)); });
fam('so1o', (it) => { const [a, b, c, o1, o2] = numsOf(it.text); const all = a.mul(b).add(b.mul(c)).add(c.mul(a)).mul(2); const pr = [a, b, c].filter((x) => x.eq(o1) || x.eq(o2)).length >= 2 ? [] : ['the opening is not a face']; return [...pr, ...numItem(it, all.sub(o1.mul(o2)))]; });
fam('so2v', (it) => { const [a, b, c] = numsOf(it.text); return numItem(it, a.mul(b).mul(c)); });
fam('so2c', (it) => { const [n] = numsOf(it.text); if (/^נפח קובייה/.test(it.text)) { const r = Math.round(Math.cbrt(n.num())); return q(r).pow(3).eq(n) ? numItem(it, q(r)) : ['no whole edge']; } return numItem(it, n.pow(3)); });
fam('so2m', (it) => { const [V, a, b] = numsOf(it.text); return numItem(it, V.div(a.mul(b))); });
fam('so2l', (it) => { const n = numsOf(it.text); if (/לאיזה גובה/.test(it.text)) { const [a, b, L] = n; return numItem(it, L.mul(1000).div(a.mul(b))); } const [a, b, c] = n; return numItem(it, a.mul(b).mul(c).div(1000)); });
fam('so2f', (it) => { const [s, a, b, c] = numsOf(it.text); const ks = [a, b, c].map((x) => x.div(s)); const pr = ks.every((k) => k.isInt()) ? [] : ['the cubes do not fit whole']; return [...pr, ...numItem(it, ks[0].mul(ks[1]).mul(ks[2]))]; });
fam('so3s', (it) => { const [a, b, c, L] = numsOf(it.text); const pr = a.mul(a).add(b.mul(b)).eq(c.mul(c)) ? [] : ['not a right triangle']; return [...pr, ...numItem(it, a.mul(b).add(a.add(b).add(c).mul(L)))]; });
fam('so3h', (it) => { const [a, b, L] = numsOf(it.text); const c = isqrt(a.mul(a).add(b.mul(b))); return c ? numItem(it, a.mul(b).add(a.add(b).add(c).mul(L))) : ['the hypotenuse is not whole']; });
fam('so3i', (it) => { const [base, h, s, L] = numsOf(it.text); const pr = s.mul(s).eq(base.div(2).mul(base.div(2)).add(h.mul(h))) ? [] : [`legs ${s} do not fit base ${base}, height ${h}`]; return [...pr, ...numItem(it, base.mul(h).add(base.add(s.mul(2)).mul(L)))]; });
fam('so3l', (it) => { const [a, b, c, L] = numsOf(it.text); const pr = a.add(b).cmp(c) > 0 && a.add(c).cmp(b) > 0 && b.add(c).cmp(a) > 0 ? [] : ['no such triangle']; return [...pr, ...numItem(it, a.add(b).add(c).mul(L))]; });
fam('so4v', (it) => { const [a, b, c, L] = numsOf(it.text); const pr = a.mul(a).add(b.mul(b)).eq(c.mul(c)) ? [] : ['not a right triangle']; return [...pr, ...numItem(it, a.mul(b).div(2).mul(L))]; });
fam('so4a', (it) => { const [b, h, c, L] = numsOf(it.text); const pr = c.cmp(h) >= 0 ? [] : [`side ${c} is shorter than the height ${h}`]; return [...pr, ...numItem(it, b.mul(h).div(2).mul(L))]; });
fam('so4h', (it) => { const [a, b, c] = numsOf(it.text); return numItem(it, a.mul(b).mul(c).div(2)); });
fam('so4k', (it) => { const [k] = numsOf(it.text); return numItem(it, k.pow(3)); });
fam('so4m', (it) => { const [V, a, b] = numsOf(it.text); return numItem(it, V.div(a.mul(b).div(2))); });
for (const f of ['so1n', 'so1m', 'so2b', 'so3n', 'so4b']) fam(f, (it) => (it.form === 'manip' ? objectOnly(it) : []));

// ---- data and frequency
/** The category a text asks about: the longest name of the list that the text writes. */
const catIn = (t, cats) => cats.map((c, i) => [c, i]).filter(([c]) => String(t).includes(c)).sort((a, b) => b[0].length - a[0].length)[0]?.[1];
const tableCounts = (it) => it.fig.rows.map((r) => r[1]);
fam('da1p', (it) => { const { cats, values, key } = it.fig; const i = catIn(it.text, cats); const pr = values.every((v) => (2 * v) % key === 0) ? [] : ['a value is not whole or half symbols']; return [...pr, ...numItem(it, q(values[i]))]; });
fam('da1r', (it) => { const { cats, values } = it.fig; return numItem(it, q(values[catIn(it.text, cats)])); });
fam('da1d', (it) => {
  const { cats, values, step } = it.fig; const t = it.text.split('יותר בחרו')[1]; const [x, y] = t.split('מאשר').map((p) => catIn(p, cats));
  const d = values[x] - values[y]; const pr = d > 0 ? [] : [`"how many more" is ${d}`];
  if (!values.every((v) => v % (step / 2) === 0)) pr.push('a bar ends between grid lines');
  return [...pr, ...numItem(it, q(d))];
});
fam('da1l', (it) => {
  const { xs, values } = it.fig; const m = it.text.match(/מיום (\S+) ליום (\S+?)\?/); const d = values[xs.indexOf(m[2])] - values[xs.indexOf(m[1])];
  return [...(d > 0 ? [] : [`"by how much did it rise" is ${d}`]), ...numItem(it, q(d))];
});
fam('da1t', (it) => numItem(it, q(tableCounts(it).reduce((a, b) => a + b, 0))));
fam('da1c', (it) => { const n = numsOf(it.text); const want = n.pop(); return numItem(it, q(n.filter((v) => v.eq(want)).length)); });
fam('da1g', () => []);
fam('da1a', (it) => { const [a, b, k] = numsOf(it.text); const yes = a.eq(b.mul(k)); return checkChoices(it, (c) => (yes ? /^כן/.test(c.text) : /^לא/.test(c.text))); });
const relOf = (it) => { const c = tableCounts(it); const tot = c.reduce((a, b) => a + b, 0); return q(c[catIn(it.text, it.fig.rows.map((r) => r[0]))], tot); };
fam('da2', (it) => numItem(it, relOf(it)));
fam('da2s', (it) => { const vals = it.fig.rows.map((r) => r[1]).filter((v) => v !== '?').map((v) => Q.dec(v)); return numItem(it, q(1).sub(sum(vals))); });
fam('da2r', (it) => { const [N, f] = numsOf(it.text); const V = N.mul(f); return [...(V.isInt() ? [] : ['not a whole number of students']), ...numItem(it, V)]; });
fam('da2c', (it) => { const [n1, k1, n2, k2] = numsOf(it.text); const c = k1.div(n1).cmp(k2.div(n2)); return checkChoices(it, (ch) => (c > 0 ? ch.text === `בכיתה של ${n1}` : c < 0 ? ch.text === `בכיתה של ${n2}` : ch.text === 'שווה')); });
fam('da2b', (it) => { const [n1, k1, n2, k2] = numsOf(it.text); const a = k1.div(n1); const b = k2.div(n2); return numItem(it, a.cmp(b) >= 0 ? a : b); });
fam('da3', (it) => { const [N] = numsOf(it.text); const { cats, values } = it.fig; const V = N.mul(values[catIn(it.text, cats)]).div(100); return [...(V.isInt() ? [] : ['not whole']), ...numItem(it, V)]; });
fam('da3w', (it) => { const [k, p] = numsOf(it.text); return numItem(it, k.mul(100).div(p)); });
fam('da3m', (it) => { const { cats, values, hide } = it.fig; const i = catIn(it.text, cats); const pr = [values.reduce((a, b) => a + b, 0) === 100 ? null : 'the pie is not 100%', hide === i ? null : 'the asked slice is not the hidden one'].filter(Boolean); return [...pr, ...numItem(it, q(100 - values.filter((_, j) => j !== hide).reduce((a, b) => a + b, 0)))]; });
fam('da3p', (it) => numItem(it, relOf(it).mul(100)));
fam('da3o', (it) => { const one = /^בכיתה אחת/.test(it.text); return checkChoices(it, (c) => (one ? /^כן/.test(c.text) : /^לא/.test(c.text))); });
fam('da3b', objectOnly);
fam('da1b', objectOnly);
fam('da4', (it) => numItem(it, relOf(it)));
fam('da4e', (it) => { const [N, T, k] = numsOf(it.text); return numItem(it, N.mul(k).div(T).round(0)); });
fam('da4x', (it) => { const [f, N] = numsOf(it.text); return numItem(it, f.mul(N)); });
fam('da4j', (it) => { const [N, p, m] = numsOf(it.text); return numItem(it, N.mul(p).div(100).add(m).div(N.add(m))); });
fam('da4s', (it) => { const t = it.text; const n = numsOf(t); const p = /וכולם אדומים/.test(t) ? 1 : /וכולם/.test(t) ? 0 : n[0].eq(n[1]) ? 0.5 : null; return checkChoices(it, (c) => (p === 1 ? /^ודאי/.test(c.text) : p === 0 ? /^בלתי/.test(c.text) : /^סיכוי שווה/.test(c.text))); });
fam('da4w', objectOnly);

describe('grade 7 and fractions-floor answers, recomputed independently (exact fractions)', () => {
  beforeAll(async () => { await loadAllGens(); });
  for (const topic of STAIRS7) {
    it(`${topic}: every stair, ${SEEDS} seeds`, () => {
      const all = []; const report = [];
      for (let l = 1; l <= TOPIC[topic].levels.length; l += 1) {
        const { problems, counts, missing } = runStair(topic, l);
        all.push(...problems);
        if (missing.length) all.push(`${topic}:${l}: no oracle for ${missing.join(', ')}`);
        report.push(`${topic}:${l} ${JSON.stringify(counts)}`);
      }
      if (process.env.ORACLE_REPORT) console.log(report.join('\n'));
      if (process.env.ORACLE_OUT) fs.appendFileSync(process.env.ORACLE_OUT, `${all.join('\n')}\n`);
      expect(all.slice(0, 40), `${all.length} problems`).toEqual([]);
    });
  }
});

// ------------------------------------------------------------------ the challenge tasks of these units
/** Problems of one challenge task: every number part's answer, its own check and its typed forms; every worked line. */
function challengeProblems(t) {
  const pr = [];
  const numPart = (where, p) => {
    const V = Q.of(p.answer);
    let c = null; try { c = evalTex(String(p.check)); } catch (e) { pr.push(`${where}: check "${p.check}" does not evaluate (${e.message})`); }
    if (c && !c.eq(V)) pr.push(`${where}: check ${p.check} = ${c}, answer ${p.answer}`);
    // a prompt that is a bare calculation ("כמה זה $(-7) + (-6)$?") is recomputed from what it shows
    const segs = mathOf(p.prompt); const m = String(p.prompt).match(/^כמה זה \$([^$]+)\$\?$/);
    if (m && segs.length === 1) { try { const v = evalTex(m[1]); if (!v.eq(V)) pr.push(`${where}: ${m[1]} = ${v}, answer ${p.answer}`); } catch { /* letters */ } }
    for (const w of writings(V)) if (!numCheck(p.answer, w)?.ok) pr.push(`${where}: "${w}" is refused for ${V}`);
    for (const miss of nearMisses(V)) { const s = miss.places(6) ? miss.decStr() : miss.toString(); if (!miss.eq(V) && numCheck(p.answer, s)?.ok) pr.push(`${where}: the wrong "${s}" is accepted`); }
  };
  t.parts.forEach((p, i) => {
    const where = `${t.id} part ${i + 1}`;
    const texts = [...(p.solution || []), p.why, ...(p.choices || []).map((c) => c.feedback), ...Object.values(p.lineWhy || {})];
    pr.push(...mathHolds(texts).map((x) => `${where}: ${x}`));
    if (p.type === 'num') numPart(where, p);
    if (p.type === 'error') {
      numPart(`${where} (fix)`, p.fix);
      // the lines before the marked one are right
      pr.push(...mathHolds(p.lines.slice(0, p.wrong)).map((x) => `${where} (a line before the mistake): ${x}`));
    }
    if (p.type === 'mc' && p.choices.filter((c) => c.ok).length !== 1) pr.push(`${where}: ${p.choices.filter((c) => c.ok).length} right choices`);
  });
  return pr;
}

describe('grade 7 and fractions-floor challenge tasks', () => {
  it('every number, check, typed form and worked line holds', () => {
    const tasks = CHALLENGE_TASKS.filter((t) => STAIRS7.includes(t.topic));
    expect(tasks.length).toBeGreaterThan(20);
    const all = tasks.flatMap(challengeProblems);
    if (process.env.ORACLE_OUT) fs.appendFileSync(process.env.ORACLE_OUT, `${all.join('\n')}\n`);
    expect(all, `${all.length} problems`).toEqual([]);
  });
});

// ------------------------------------------------------------------ regressions the oracle found (math7 audit)
describe('regressions: an answer whose two-place rounding ends in 0', () => {
  beforeAll(async () => { await loadAllGens(); });
  const typed = (item, s) => isCorrect(item, readAnswer(item, { v: s }));
  // frac:3 seed 22: 4/7 + 1/3 = 19/21 = 0.9047…, "rounded to two places" is 0.90
  it('frac:3 4/7 + 1/3: 0.90 and 0.9 are right, and the worked example writes 0.90', () => {
    const item = draw('frac', 3, 22, false);
    expect(item.key).toBe('fr3a:4:7:1:3:add');
    expect([typed(item, '0.90'), typed(item, '0.9'), typed(item, '19/21'), typed(item, '0.91')]).toEqual([true, true, true, false]);
    expect(item.solution.join(' ')).toContain('\\approx 0.90');
  });
  // signed:7 seed 106: (−2/3)³ = −8/27 = −0.296…, rounded to two places −0.30
  it('signed:7 (−2/3)³: −0.30 and −0.3 are right, and the worked example writes −0.30', () => {
    const item = draw('signed', 7, 106, false);
    expect(item.key).toBe('sn7:5:2/3:3');
    expect([typed(item, '-0.30'), typed(item, '−0.3'), typed(item, '-8/27'), typed(item, '-0.29')]).toEqual([true, true, true, false]);
    expect(item.solution.join(' ')).toContain('בערך $-0.30$');
  });
  // signed:7 seed 114 (council round 3): (−0.4)³ = −0.064 exactly; the question says nothing about rounding, so −0.06 is
  // another number, not the answer
  it('signed:7 (−0.4)³: −0.064 and −8/125 are right, −0.06 is not, and nothing says to round', () => {
    const item = draw('signed', 7, 114, false);
    expect(item.key).toBe('sn7:5:0.4:3');
    expect([typed(item, '-0.064'), typed(item, '−8/125'), typed(item, '-0.06'), typed(item, '-0.07')]).toEqual([true, true, false, false]);
    expect(item.text).toBe('חשבו:');
    expect(answerText(item)).toBe('-0.064');
  });
  // data:4 seed 1023: (20% of 400 + 60) / 460 = 7/23 = 0.304…, rounded to two places 0.30
  it('data:4 7/23: 0.30 is right, and the worked example writes 0.30', () => {
    const item = draw('data', 4, 1023, false);
    expect(item.key).toBe('da4j:400:20:60');
    expect([typed(item, '0.30'), typed(item, '0.3'), typed(item, '0.31')]).toEqual([true, true, false]);
    expect(item.solution.join(' ')).toContain('\\approx 0.30');
  });
  it('a challenge answer is checked by the same rule', () => {
    expect(numCheck(19 / 21, '0.90')?.ok).toBe(true);
    expect(numCheck(-8 / 27, '-0.3')?.ok).toBe(true);
    expect(numCheck(19 / 21, '0.91')?.ok).toBe(false);
  });
  // frac:4 seed 190: 24 : 0.9 = 26.666…; the dots follow the value's own digits (26.66…), not a rounding (26.67…)
  it('frac:4 24 : 0.9 is written 26.66…', () => {
    const item = draw('frac', 4, 190, false);
    expect(item.key).toBe('fr4g:24:0.9:div');
    expect(item.solution.join(' ')).toContain('26.66\\ldots');
  });
});
