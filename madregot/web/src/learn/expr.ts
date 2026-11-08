// A small, safe arithmetic evaluator (no eval): the content's worked examples and guided problems carry
// their maths as expressions, and the tests check every step's value against the answer.
//
// Numbers (3, 2.5), + - * / ^, unary minus, parentheses, and the functions
// sqrt, abs, mean(a, b, ...), median(a, b, ...), round(x), and min/max.
// The minus sign may be written − (U+2212) as well as -.

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

/** The value of an expression. Throws on anything it does not understand. */
export function evaluate(src: string): number {
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
