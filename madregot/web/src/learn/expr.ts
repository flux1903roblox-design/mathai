// A small, safe arithmetic evaluator (no eval): the content's worked examples and guided problems carry
// their maths as expressions, and the tests check every step's value against the answer.
//
// Numbers (3, 2.5), + - * / ^, unary minus, parentheses, and the functions
// sqrt, abs, mean(a, b, ...), median(a, b, ...), round(x), and min/max.
// The minus sign may be written − (U+2212) as well as -.
// Algebra: a name that is not a function call is a variable, read from `vars` (evaluate('3*x + 1', { x: 2 })).
// There is no implicit multiplication here: write 3*x. A TeX display (3x + 5, \frac{x + 1}{3}) is turned into
// such an expression by texToExpr, and identical() tells whether two expressions are equal for every value.

type Tok = { t: 'n'; v: number } | { t: 'op'; v: string } | { t: 'id'; v: string };

function tokens(src: string): Tok[] {
  const s = src.replace(/−/g, '-').replace(/·|×/g, '*').replace(/:/g, '/');
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === ' ') { i += 1; continue; }
    if (/[0-9.]/.test(c)) {
      let j = i; while (j < s.length && /[0-9.]/.test(s[j])) j += 1;
      const v = Number(s.slice(i, j));
      if (Number.isNaN(v)) throw new Error(`bad number in ${src}`);
      out.push({ t: 'n', v }); i = j; continue;
    }
    if (/[a-z]/i.test(c)) {
      let j = i; while (j < s.length && /[a-z]/i.test(s[j])) j += 1;
      out.push({ t: 'id', v: s.slice(i, j) }); i = j; continue;
    }
    if ('+-*/^(),'.includes(c)) { out.push({ t: 'op', v: c }); i += 1; continue; }
    throw new Error(`unexpected "${c}" in ${src}`);
  }
  return out;
}

const FN: Record<string, (...a: number[]) => number> = {
  sqrt: (x) => Math.sqrt(x),
  abs: (x) => Math.abs(x),
  round: (x) => Math.round(x),
  min: (...a) => Math.min(...a),
  max: (...a) => Math.max(...a),
  mean: (...a) => a.reduce((t, x) => t + x, 0) / a.length,
  median: (...a) => { const s = [...a].sort((x, y) => x - y); const n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; },
};

/** The value of an expression. Throws on anything it does not understand, and on a variable that `vars` does not give. */
export function evaluate(src: string, vars: Record<string, number> = {}): number {
  const ts = tokens(src);
  let k = 0;
  const peek = () => ts[k];
  const take = (v?: string) => {
    const t = ts[k];
    if (!t || (v && !(t.t === 'op' && t.v === v))) throw new Error(`expected ${v || 'more'} in ${src}`);
    k += 1; return t;
  };
  // sum := product (('+'|'-') product)*
  function sum(): number {
    let v = product();
    for (;;) {
      const t = peek();
      if (t?.t === 'op' && (t.v === '+' || t.v === '-')) { k += 1; const r = product(); v = t.v === '+' ? v + r : v - r; } else return v;
    }
  }
  // product := unary (('*'|'/') unary)*
  function product(): number {
    let v = unary();
    for (;;) {
      const t = peek();
      if (t?.t === 'op' && (t.v === '*' || t.v === '/')) { k += 1; const r = unary(); v = t.v === '*' ? v * r : v / r; } else return v;
    }
  }
  // unary := '-' unary | power
  function unary(): number {
    const t = peek();
    if (t?.t === 'op' && t.v === '-') { k += 1; return -unary(); }
    if (t?.t === 'op' && t.v === '+') { k += 1; return unary(); }
    return power();
  }
  // power := atom ('^' unary)?   (right-associative; -2^2 is -(2^2))
  function power(): number {
    const base = atom();
    const t = peek();
    if (t?.t === 'op' && t.v === '^') { k += 1; return base ** unary(); }
    return base;
  }
  function atom(): number {
    const t = take();
    if (t.t === 'n') return t.v;
    if (t.t === 'op' && t.v === '(') { const v = sum(); take(')'); return v; }
    if (t.t === 'id') {
      // a name not followed by "(" is a variable
      if (!(peek()?.t === 'op' && peek()!.v === '(')) {
        if (!Object.prototype.hasOwnProperty.call(vars, t.v) || typeof vars[t.v] !== 'number') throw new Error(`unknown name ${t.v} in ${src}`);
        return vars[t.v];
      }
      const f = FN[t.v]; if (!f) throw new Error(`unknown function ${t.v} in ${src}`);
      take('('); const args = [sum()];
      while (peek()?.t === 'op' && peek()!.v === ',') { k += 1; args.push(sum()); }
      take(')');
      return f(...args);
    }
    throw new Error(`unexpected token in ${src}`);
  }
  const v = sum();
  if (k !== ts.length) throw new Error(`trailing tokens in ${src}`);
  return v;
}

export const same = (a: number, b: number, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));

/** The values two expressions are compared at: negative, zero, fractional and larger, so no accident makes them agree. */
export const PROBES = [-3, -1.5, 0, 1, 2.5, 7] as const;

/**
 * Are two expressions equal for every value of their variables? Checked at every combination of PROBES (a linear
 * or quadratic expression in one variable is fixed by three values; six leave no room for a coincidence).
 * Example: identical('3*(x+4)', '3*x+12') is true, identical('3*(x+4)', '3*x+4') is false.
 */
export function identical(a: string, b: string, names: string[] = ['x'], at: readonly number[] = PROBES): boolean {
  const points: Record<string, number>[] = names.reduce<Record<string, number>[]>((acc, n) => acc.flatMap((p) => at.map((v) => ({ ...p, [n]: v }))), [{}]);
  return points.every((p) => {
    const u = evaluate(a, p); const v = evaluate(b, p);
    if (!Number.isFinite(u) || !Number.isFinite(v)) return Number.isNaN(u) === Number.isNaN(v) && u === v;
    return same(u, v, 1e-9);
  });
}

// ------------------------------------------------------------------ TeX displays as expressions

/**
 * A TeX display as an expression evaluate() reads, so a test can check the maths a student actually sees.
 * Understands numbers, one-letter variables, + - − · \cdot \times : \div, ( ) \left( \right), { }, ^,
 * \frac{a}{b} (also \dfrac, \tfrac) and \sqrt{a}, and writes out the multiplication school algebra leaves
 * implicit: 3x, 2(x + 1), x(x - 3), (x + 1)(x - 1), \frac{1}{3}x, 3\sqrt{2}.
 * A whole number written straight before a numeric fraction is a mixed number, as in school: 2\frac{1}{3} = 7/3.
 * Spacing commands (\, \; \! \quad) are ignored. Anything else throws, so a display it cannot read is never
 * checked by accident.
 */
export function texToExpr(tex: string): string {
  type T = { k: 'num' | 'var' | 'op' | 'open' | 'close' | 'frac' | 'sqrt'; v: string };
  const src = tex;
  let s = tex.replace(/\\left|\\right/g, '').replace(/\\(?:,|;|!|:|quad|qquad)|~/g, ' ').replace(/−/g, '-').replace(/·|×/g, '*');
  s = s.replace(/\\cdot|\\times/g, '*').replace(/\\div/g, '/').replace(/\\[dt]frac/g, '\\frac');
  // read the TeX into tokens; a group {..} is a bracket for our purposes
  const out: T[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === ' ') { i += 1; continue; }
    if (/[0-9.]/.test(c)) { let j = i; while (j < s.length && /[0-9.]/.test(s[j])) j += 1; out.push({ k: 'num', v: s.slice(i, j) }); i = j; continue; }
    if (/[a-z]/i.test(c)) { out.push({ k: 'var', v: c }); i += 1; continue; }
    if (c === '\\') {
      const m = /^\\([a-zA-Z]+)/.exec(s.slice(i));
      if (m && m[1] === 'frac') { out.push({ k: 'frac', v: '' }); i += m[0].length; continue; }
      if (m && m[1] === 'sqrt') { out.push({ k: 'sqrt', v: '' }); i += m[0].length; continue; }
      throw new Error(`texToExpr: unknown command in ${src}`);
    }
    if (c === '(' || c === '{' || c === '[') { out.push({ k: 'open', v: c }); i += 1; continue; }
    if (c === ')' || c === '}' || c === ']') { out.push({ k: 'close', v: c }); i += 1; continue; }
    if ('+-*/^:'.includes(c)) { out.push({ k: 'op', v: c === ':' ? '/' : c }); i += 1; continue; }
    throw new Error(`texToExpr: unexpected "${c}" in ${src}`);
  }
  // write it back with explicit operations: \frac{a}{b} → ((a)/(b)), \sqrt{a} → sqrt(a), a ^ {b} → a^(b)
  let k = 0;
  const group = (): string => {
    // one argument: a {..} group, or a single token
    const t = out[k];
    if (!t) throw new Error(`texToExpr: missing argument in ${src}`);
    if (t.k === 'open' && t.v === '{') { k += 1; const inner = seq('}'); return `(${inner})`; }
    k += 1;
    if (t.k === 'num' || t.k === 'var') return t.v;
    throw new Error(`texToExpr: bad argument in ${src}`);
  };
  // the pieces of a sequence, each a factor; then joined with * where school algebra multiplies silently
  const seq = (close?: string): string => {
    const parts: { s: string; kind: 'factor' | 'op' }[] = [];
    while (k < out.length) {
      const t = out[k];
      if (t.k === 'close') {
        if (!close) throw new Error(`texToExpr: unbalanced ${t.v} in ${src}`);
        k += 1; return join(parts);
      }
      if (t.k === 'op') {
        k += 1;
        if (t.v === '^') { const prev = parts.pop(); if (!prev || prev.kind !== 'factor') throw new Error(`texToExpr: bad power in ${src}`); parts.push({ s: `${prev.s}^${group()}`, kind: 'factor' }); continue; }
        parts.push({ s: t.v, kind: 'op' }); continue;
      }
      if (t.k === 'open') { k += 1; const inner = seq(t.v === '(' ? ')' : t.v === '[' ? ']' : '}'); parts.push({ s: `(${inner})`, kind: 'factor' }); continue; }
      if (t.k === 'frac') {
        k += 1; const a = group(); const b = group();
        const f = `(${a}/${b})`;
        const prev = parts[parts.length - 1];
        // 2\frac{1}{3}: a mixed number (a whole number straight before a fraction of numbers)
        if (prev && prev.kind === 'factor' && /^\d+$/.test(prev.s) && /^\(?[\d.]+\)?$/.test(a) && /^\(?[\d.]+\)?$/.test(b)) { parts.pop(); parts.push({ s: `(${prev.s}+${f})`, kind: 'factor' }); continue; }
        parts.push({ s: f, kind: 'factor' }); continue;
      }
      if (t.k === 'sqrt') { k += 1; parts.push({ s: `sqrt${group()}`, kind: 'factor' }); continue; }
      k += 1; parts.push({ s: t.v, kind: 'factor' });
    }
    if (close) throw new Error(`texToExpr: missing ${close} in ${src}`);
    return join(parts);
  };
  const join = (parts: { s: string; kind: 'factor' | 'op' }[]) => parts.map((p, n) => (n > 0 && p.kind === 'factor' && parts[n - 1].kind === 'factor' ? `*${p.s}` : p.s)).join('');
  const expr = seq();
  if (!expr) throw new Error(`texToExpr: empty display ${src}`);
  return expr;
}

/** The relations a display may state, as they are written in TeX or in text. */
const RELATIONS: [RegExp, Rel][] = [[/\\(?:le|leq)\b|≤/, '<='], [/\\(?:ge|geq)\b|≥/, '>='], [/</, '<'], [/>/, '>'], [/=/, '=']];
export type Rel = '=' | '<' | '>' | '<=' | '>=';

/**
 * An equation or inequality in TeX, split into its two sides as expressions: '3x + 5 = x + 11' gives
 * { left: '3*x+5', rel: '=', right: 'x+11' }. Exactly one relation is allowed.
 */
export function texRelation(tex: string): { left: string; rel: Rel; right: string } {
  const s = tex.replace(/\\(?:le|leq|ge|geq)\b/g, (m) => (m.startsWith('\\l') ? '≤' : '≥'));
  const found = [...s].map((ch, i) => ({ ch, i })).filter(({ ch }) => '=<>≤≥'.includes(ch));
  if (found.length !== 1) throw new Error(`texRelation: one relation expected in ${tex}`);
  const { ch, i } = found[0];
  const rel = RELATIONS.find(([re]) => re.test(ch))![1];
  return { left: texToExpr(s.slice(0, i)), rel, right: texToExpr(s.slice(i + 1)) };
}

/** Does a value (or several, for two unknowns) make a TeX equation or inequality true? */
export function holds(tex: string, vars: Record<string, number>): boolean {
  const { left, rel, right } = texRelation(tex);
  const l = evaluate(left, vars); const r = evaluate(right, vars);
  switch (rel) {
    case '=': return same(l, r);
    case '<': return l < r && !same(l, r);
    case '>': return l > r && !same(l, r);
    case '<=': return l < r || same(l, r);
    default: return l > r || same(l, r);
  }
}

/** A seeded random source (mulberry32): the same seed gives the same items. */
export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Helpers for the content's parameter generators. */
export const rint = (rnd: () => number, a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
export const rnz = (rnd: () => number, a: number, b: number) => { let v = 0; while (v === 0) v = rint(rnd, a, b); return v; };
export const rpick = <T>(rnd: () => number, arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)];
