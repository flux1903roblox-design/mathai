// Code checks of maths an AI wrote (ai spec AI-4 Design 5, AI-7 Design 3). The same kind of check the math judge ran
// over the app's own worked solutions (53,694 equation pairs, 0 mismatches), applied to what the tutor writes.
//
//   checkEquations(text)   every all-numeric equation in the $…$ runs of a text: is it true?
//
// The eval grader mathEquations runs it on every tutor reply; AI-4's verifyRewrite will run it on every AI-written
// solution and add numbersIn, parseAnswer and verifyRewrite to this file.
//
// Plain JS with no dependencies. It ships to the browser (shared/ai.js will import it), so there is no regex lookbehind
// (trust spec §0.3 rule 3), and nothing is ever evaluated as code: no eval, no Function. A small recursive-descent parser
// reads the TeX the tutor writes and computes it.

/** A side of an equation that cannot be computed: a letter, a "?", an unknown command, a point, an ambiguous form. */
class Skip extends Error {}
const skip = (why) => { throw new Skip(why); };

/** Tolerance for "≈" (a value rounded to tenths is within 0.05) and for "=" with a rounded decimal (half its last place). */
export const APPROX_TOLERANCE = 0.05;

// ---------------------------------------------------------------- $…$ runs
/** The closed $…$ and $$…$$ runs of a text: { body, start, end } (start and end of the body). A \$ is not a delimiter. */
function mathRuns(text) {
  const runs = [];
  let i = 0; let open = -1; let width = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '\\') { i += 2; continue; }
    if (ch === '$') {
      const w = text[i + 1] === '$' ? 2 : 1;
      if (open < 0) { open = i + w; width = w; i += w; continue; }
      if (w >= width) { runs.push({ body: text.slice(open, i), start: open, end: i }); open = -1; i += width; continue; }
      i += w; continue;
    }
    i += 1;
  }
  return runs;
}

/** Words that say an equation is false on purpose ("נשאר $8 = 10$, וזה לא נכון: אין פתרון"), within 40 characters of it. */
const DECLARED_FALSE = /לא נכון|לא נכונה|לא ייתכן|לא יכול|סתירה|אין פתרון|לא מתקיים|לא שווה/;
const NEAR = 40;

// ---------------------------------------------------------------- tokens
const COMMANDS = { frac: 'frac', dfrac: 'frac', tfrac: 'frac', sqrt: 'sqrt', cdot: '*', times: '*', div: '/' };

/** TeX of one side → tokens. Spacing, \left \right and a degree mark are dropped; anything unknown makes the side a skip. */
function tokens(src) {
  const s = src
    .replace(/\\[,;:! ]|~/g, ' ')
    .replace(/[−–]/g, '-').replace(/[·×⋅]/g, '*').replace(/÷/g, '/').replace(/:/g, '/')
    .replace(/\^\s*\{?\s*\\circ\s*\}?|°/g, '')
    .replace(/\\left|\\right|\\displaystyle/g, '');
  const out = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) { i += 1; continue; }
    const num = s.slice(i).match(/^(?:\d+(?:\.\d+)?|\.\d+)/);
    if (num) { out.push({ t: 'num', v: Number(num[0]), raw: num[0] }); i += num[0].length; continue; }
    if (ch === '\\') {
      const cmd = s.slice(i + 1).match(/^[A-Za-z]+/);
      if (!cmd || !COMMANDS[cmd[0]]) skip(`command ${cmd ? cmd[0] : s[i + 1]}`);
      const c = COMMANDS[cmd[0]];
      out.push(c === '*' || c === '/' ? { t: 'op', v: c } : { t: c });
      i += 1 + cmd[0].length; continue;
    }
    if ('+-*/^'.includes(ch)) { out.push({ t: 'op', v: ch }); i += 1; continue; }
    if ('([{'.includes(ch)) { out.push({ t: 'open', v: ch }); i += 1; continue; }
    if (')]}'.includes(ch)) { out.push({ t: 'close', v: ch }); i += 1; continue; }
    if (ch === '|') { out.push({ t: 'bar' }); i += 1; continue; }
    skip(`character ${ch}`); // a letter, "?", ",", "%", "<" …
  }
  return out;
}

// ---------------------------------------------------------------- the parser
const CLOSE = { '(': ')', '[': ']', '{': '}' };

/** The value of one side, or a Skip. */
function evaluate(src) {
  const ts = tokens(src);
  if (!ts.length) skip('empty');
  let p = 0;
  const peek = () => ts[p];
  const take = () => ts[p++];
  const isOp = (v) => peek()?.t === 'op' && peek().v === v;
  const group = () => {
    const o = take();
    if (o?.t !== 'open') skip('expected a group');
    const v = expr();
    const c = take();
    if (c?.t !== 'close' || c.v !== CLOSE[o.v]) skip('unbalanced');
    return v;
  };
  const div = (a, b) => (b === 0 ? skip('division by zero') : a / b);

  function primary() {
    const tk = peek();
    if (!tk) skip('ended early');
    if (tk.t === 'num') { take(); return tk.v; }
    if (tk.t === 'open') return group();
    if (tk.t === 'frac') {
      take();
      if (peek()?.t !== 'open' || peek().v !== '{') skip('\\frac without braces');
      const a = group();
      if (peek()?.t !== 'open' || peek().v !== '{') skip('\\frac without braces');
      return div(a, group());
    }
    if (tk.t === 'sqrt') {
      take();
      if (peek()?.t !== 'open' || peek().v !== '{') skip('\\sqrt without braces'); // \sqrt[3]{…} too
      const a = group();
      return a < 0 ? skip('root of a negative') : Math.sqrt(a);
    }
    if (tk.t === 'bar') {
      take();
      const v = expr();
      if (take()?.t !== 'bar') skip('unclosed |');
      return Math.abs(v);
    }
    return skip('unexpected token');
  }
  function power() {
    const base = primary();
    if (!isOp('^')) return base;
    take();
    // the exponent: a braced group, a bracketed group, or one number (2^10 is written 2^{10})
    const tk = peek();
    let e;
    if (tk?.t === 'open') e = group();
    else if (tk?.t === 'num') { take(); e = tk.raw.length === 1 ? tk.v : skip('a long bare exponent'); }
    else skip('exponent');
    return base ** e;
  }
  function unary() {
    if (isOp('-')) { take(); return -unary(); }
    if (isOp('+')) { take(); return unary(); }
    return power();
  }
  function term() {
    let v = unary();
    for (;;) {
      if (isOp('*')) { take(); v *= unary(); continue; }
      if (isOp('/')) { take(); v = div(v, unary()); continue; }
      const tk = peek();
      // a factor right after another: 2(3 + 1), 2\sqrt{9}, (2)(3). A number before \frac would be a mixed number, and
      // two numbers side by side are not a product: both are skipped rather than guessed.
      if (tk && (tk.t === 'open' || tk.t === 'sqrt')) { v *= unary(); continue; }
      if (tk && (tk.t === 'frac' || tk.t === 'num')) skip('two factors side by side');
      return v;
    }
  }
  function expr() {
    let v = term();
    for (;;) {
      if (isOp('+')) { take(); v += term(); continue; }
      if (isOp('-')) { take(); v -= term(); continue; }
      return v;
    }
  }
  const v = expr();
  if (p !== ts.length) skip('left over');
  if (!Number.isFinite(v)) skip('not a finite number');
  return v;
}

/** The value of a side, or null when it is not all numbers. A unit in \text at its end is dropped ("5 \text{ ס״מ}"). */
function valueOf(side) {
  try { return evaluate(side.replace(/\\(?:text|mathrm)\s*\{[^}]*\}\s*$/, '')); } catch (e) { if (e instanceof Skip) return null; throw e; }
}

// ---------------------------------------------------------------- equations
// statements inside one run: "$a = 1 \quad b = 2$", "$… \Rightarrow …$", "$x = 2,\ y = 3$", a TeX line break
// (a \text{…} is never a separator: inside a side it makes the side a skip, at its end it is a unit)
const STATEMENT = /\\q?quad|\\(?:Right|Left|Longright|right|long)arrow|\\Leftrightarrow|\\implies|\\iff|\\to(?![A-Za-z])|\\\\|;|,\s*\\[ ,;]|&/;
// the relations a statement is split on: "=" and "≈" are checked; any other relation only ends a chain
const RELATION = /(\\approx(?![A-Za-z])|≈|=|\\neq?(?![A-Za-z])|≠|\\leq?(?![A-Za-z])|\\geq?(?![A-Za-z])|≤|≥|<|>)/;

/** A side written as a plain decimal (6.4, -0.25) was rounded to its last place: half of that place is allowed. */
function roundedTolerance(side) {
  const m = side.replace(/\s+/g, '').replace(/[−–]/g, '-').match(/^\(?-?\d+\.(\d+)\)?$/);
  return m ? 0.5 * 10 ** -m[1].length : 0;
}

/**
 * Every all-numeric equation in the $…$ runs of a text. A run with "?" is skipped whole (a blank the student fills), a
 * side with a letter, a point or an unknown command is skipped, and a chain "a = b = c" is checked pair by pair.
 * "=" must hold exactly (a written decimal may be rounded to its last place); "≈" within 0.05. A false equation the text
 * itself calls false ("$8 = 10$, וזה לא נכון") is counted in declaredFalse, not in wrong.
 * → { ok, checked, skipped, declaredFalse, wrong: [{ left, right, rel, a, b }] }
 */
export function checkEquations(text) {
  const out = { ok: true, checked: 0, skipped: 0, declaredFalse: 0, wrong: [] };
  const src = String(text ?? '');
  for (const { body: run, start, end } of mathRuns(src)) {
    if (!/=|≈|\\approx/.test(run)) continue;
    if (/\?/.test(run) || /\\begin/.test(run)) { out.skipped += 1; continue; }
    const saysFalse = DECLARED_FALSE.test(src.slice(Math.max(0, start - 1 - NEAR), start - 1) + src.slice(end + 1, end + 1 + NEAR));
    for (const statement of run.split(STATEMENT)) {
      const parts = statement.split(RELATION);
      // parts: side, rel, side, rel, side …
      for (let i = 1; i + 1 < parts.length; i += 2) {
        const rel = parts[i];
        if (rel !== '=' && rel !== '≈' && !/^\\approx/.test(rel)) continue;
        const left = parts[i - 1].trim(); const right = parts[i + 1].trim();
        const a = valueOf(left); const b = valueOf(right);
        if (a == null || b == null) { out.skipped += 1; continue; }
        out.checked += 1;
        const tol = rel === '=' ? Math.max(roundedTolerance(left), roundedTolerance(right)) : APPROX_TOLERANCE;
        const scale = Math.max(1, Math.abs(a), Math.abs(b));
        if (Math.abs(a - b) <= tol + 1e-9 * scale) continue;
        if (saysFalse) { out.declaredFalse += 1; continue; }
        out.wrong.push({ left, right, rel: rel === '=' ? '=' : '≈', a, b });
      }
    }
  }
  out.ok = out.wrong.length === 0;
  return out;
}
