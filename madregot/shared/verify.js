// Code checks of maths an AI wrote (ai spec AI-4 Design 5, AI-7 Design 3). The same kind of check the math judge ran
// over the app's own worked solutions (53,694 equation pairs, 0 mismatches), applied to what the tutor writes.
//
//   checkEquations(text)            every all-numeric equation in the $…$ runs of a text: is it true?
//   numbersIn(text)                 the numbers a Hebrew + TeX text states
//   parseAnswer(s)                  an answer as written ("x = -3", "$\frac{3}{4}$", "2,5", "(2, -1)") → a number, [x, y] or null
//   verifyRewrite(seed, item, b)    one AI-written exercise against the app's seed: the checks of AI-4, in order
//   finishRewrite(seeds, data, b)   every exercise of a reply: the ones that pass, in seed order, and why the others did not
//
// The eval grader mathEquations runs checkEquations on every tutor reply. For generated exercises (AI-4) the app makes
// the numbers and the answer (the seed); the AI only writes a story, a hint and a solution, and these functions decide
// whether that text may be shown. No number the AI wrote is ever used to grade.
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

// ---------------------------------------------------------------- numbers in a text
const SIGN_BEFORE = /[\s($=[{,:;־]/;
/** A point written "(a,b)" is two numbers, never the decimal "a,b". */
const POINT_COMMA = /\(\s*([-−–]?\d+(?:\.\d+)?)\s*,\s*([-−–]?\d+(?:\.\d+)?)\s*\)/g;
const FRACTION = /([-−–]?)\\[dt]?frac\s*\{\s*([-−–]?\d+(?:\.\d+)?)\s*\}\s*\{\s*([-−–]?\d+(?:\.\d+)?)\s*\}/g;
const SLASH = /(^|[^\d.,])([-−–]?)(\d+)\s*\/\s*(\d+)(?![\d.])/g;
// thousands (1,500), a decimal comma (2,5), a decimal point, a whole number; a minus right before it is kept apart
const NUMBER = /(-?)(\d{1,3}(?:,\d{3})+(?![\d,])|\d+,\d{1,2}(?!\d)|\d+(?:\.\d+)?)/g;

/**
 * The numbers a text states (fractions first): TeX and Hebrew as the app and the tutor write them. \frac{a}{b} (and a/b) gives
 * a/b and also a and b; "1,500" is 1500 and "2,5" is 2.5; a degree mark is dropped; a minus is a sign only right
 * before a digit at the start or after a space, "(", "$", "=" and the like (in "3-5" or "x - 5" it subtracts).
 * A number said below zero in words ("6 מעלות מתחת לאפס") is just 6: callers compare by absolute value, and the
 * blind solve checks the sign.
 */
export function numbersIn(text) {
  const out = [];
  const num = (v) => Number(String(v).replace(/[−–]/g, '-').replace(/\s+/g, ''));
  let s = ` ${String(text ?? '')} `
    .replace(/[⁦-⁩‎‏]/g, '')
    .replace(/\^\s*\{?\s*\\circ\s*\}?|°/g, ' ')
    .replace(POINT_COMMA, '($1; $2)');
  const signAt = (str, at) => at === 0 || SIGN_BEFORE.test(str[at - 1]);
  s = s.replace(FRACTION, (m, sign, a, b, at, str) => {
    const v = num(a) / num(b);
    if (Number.isFinite(v)) out.push(sign && signAt(str, at) ? -v : v);
    return `${sign} ${a} ; ${b} `;
  });
  s = s.replace(SLASH, (m, before, sign, a, b) => {
    const v = Number(a) / Number(b);
    if (Number.isFinite(v)) out.push(sign ? -v : v);
    return `${before} ${sign}${a} ; ${b} `;
  });
  s = s.replace(/[−–]/g, '-');
  for (const m of s.matchAll(NUMBER)) {
    const raw = m[2];
    const v = /^\d{1,3}(?:,\d{3})+$/.test(raw) ? Number(raw.replace(/,/g, '')) : Number(raw.replace(',', '.'));
    // a minus is a sign only where a number starts: the start, a space, a bracket, "$", "=" …
    const signed = m[1] === '-' && (m.index === 0 || SIGN_BEFORE.test(s[m.index - 1]));
    out.push(signed ? -v : v);
  }
  return out;
}

// ---------------------------------------------------------------- an answer as written
const parseNumLike = (s) => {
  // the app's own reading of a typed answer (web/src/content/util.js parseNum), so both read every answer alike: a
  // mixed number first ("1 2/5", the curriculum lane's fractions), then a/b, then a decimal
  const raw = String(s ?? '').trim().replace(/[−–—]/g, '-');
  const mixed = raw.match(/^([+-]?)(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) {
    const d = Number(mixed[4]);
    if (d === 0) return null;
    const v = Number(mixed[2]) + Number(mixed[3]) / d;
    return mixed[1] === '-' ? -v : v;
  }
  const t = raw.replace(/\s+/g, '').replace(',', '.');
  if (!t) return null;
  let m = t.match(/^([+-]?\d+)\/([+-]?\d+)$/);
  if (m) { const d = Number(m[2]); return d === 0 ? null : Number(m[1]) / d; }
  m = t.match(/^[+-]?(\d+\.?\d*|\.\d+)$/);
  return m ? Number(t) : null;
};

/**
 * An answer as a person or a model writes it → a number, [x, y], or null. Reads "$…$", "x = …", \frac and \dfrac, a
 * Unicode minus, a decimal comma, a/b and (x, y); "unclear" and anything else is null. On every string the app's
 * parseNum reads, it gives the same value (a test holds it to that).
 */
export function parseAnswer(s) {
  let t = String(s ?? '')
    .replace(/[⁦-⁩‎‏]/g, '')
    .replace(/\$/g, '')
    .replace(/\\left|\\right|\\[,;:! ]/g, '')
    .replace(/[−–—]/g, '-')
    .trim();
  if (!t || /^unclear$/i.test(t)) return null;
  t = t.replace(/^[a-zA-Z]\s*=\s*/, '');
  const frac = t.replace(/\s+/g, '').match(/^([+-]?)\\[dt]?frac\{([+-]?\d+(?:[.,]\d+)?)\}\{([+-]?\d+(?:[.,]\d+)?)\}$/);
  if (frac) {
    const a = parseNumLike(frac[2]); const b = parseNumLike(frac[3]);
    if (a == null || !b) return null;
    return (frac[1] === '-' ? -1 : 1) * (a / b);
  }
  const pt = t.match(/^\((.*)\)$/);
  if (pt) {
    const parts = pt[1].includes(';') ? pt[1].split(';') : pt[1].split(',');
    if (parts.length !== 2) return null;
    const x = parseNumLike(parts[0]); const y = parseNumLike(parts[1]);
    return x == null || y == null ? null : [x, y];
  }
  return parseNumLike(t);
}

// ---------------------------------------------------------------- one AI-written exercise against its seed
/** Why an exercise is not shown, in the order the checks run (finishRewrite counts each). */
export const DROP_REASONS = Object.freeze(['kept', 'latex', 'numbers', 'leak', 'solution', 'equations', 'blind']);

const dollars = (text) => {
  let n = 0;
  const t = String(text ?? '');
  for (let i = 0; i < t.length; i += 1) { if (t[i] === '\\') i += 1; else if (t[i] === '$') n += 1; }
  return n;
};
const evenDollars = (text) => dollars(text) % 2 === 0;
/** The wording of an exercise without its maths marks and spacing: what "kept the seed's wording" compares. */
const wording = (text) => String(text ?? '').replace(/[⁦-⁩‎‏$]/g, '').replace(/\s+/g, ' ').trim();
const absHas = (list, v) => list.some((x) => Math.abs(Math.abs(x) - Math.abs(v)) < 1e-9);

/**
 * The value at the end of a solution: the right-hand side of the last "=" (or "≈") of the $…$ run that ends its last
 * step. After the run only a short word or two without digits may follow (a unit: "ס״מ", "מעלות"), never more maths.
 */
function finalValue(step) {
  const t = String(step ?? '').trim();
  const runs = mathRuns(t);
  const last = runs.at(-1);
  if (!last) return null;
  if (!/^[^\d$]{0,24}$/.test(t.slice(last.end).replace(/^\$+/, ''))) return null;
  const parts = last.body.split(/=|≈|\\approx(?![A-Za-z])/);
  if (parts.length < 2) return null;
  const rhs = parts.at(-1).trim();
  const read = parseAnswer(rhs);
  if (typeof read === 'number') return read;
  return valueOf(rhs);
}

/**
 * One exercise the AI wrote for a seed. seed: { i, text, answer, round, fig } as the request carried it. item: { seed,
 * prompt, hint, solution, kept } from the reply. blindAnswer: the blind solve's answer for this story, undefined when the
 * blind solve did not run (the item is then 'skipped' on that check only). → { ok, reason, fixed, blind, item }.
 * The checks, in order: a seed with a drawing keeps its wording (kept); an even number of "$" in the prompt and in every
 * step (latex); every number of the seed is in the story (numbers); the answer's value is not in the story unless the
 * seed had it (leak); the last step ends "= answer" with its sign (solution); every numeric equation of the solution is
 * true (equations); the blind solve gives the answer (blind). Only the hint is ever repaired: a hint with the answer or
 * an odd "$" becomes '' and fixed is 'hint' (the client shows the seed's own hint). A value is never repaired.
 */
export function verifyRewrite(seed, item, blindAnswer) {
  const fail = (reason) => ({ ok: false, reason, fixed: null, blind: null, item: null });
  const answer = parseAnswer(seed?.answer);
  const tol = seed?.round ? 0.05 : 0.01;
  const prompt = String(item?.prompt ?? '');
  const solution = Array.isArray(item?.solution) ? item.solution.map((x) => String(x ?? '')) : [];
  const kept = item?.kept === true;
  // a seed with a drawing is never re-storied, and a kept seed is the app's own wording
  if ((seed?.fig && !kept) || (kept && wording(prompt) !== wording(seed?.text))) return fail('kept');
  if (!evenDollars(prompt) || !solution.every(evenDollars)) return fail('latex');
  const seedNums = numbersIn(seed?.text);
  const storyNums = numbersIn(prompt);
  if (!seedNums.every((v) => absHas(storyNums, v))) return fail('numbers');
  if (typeof answer !== 'number') return fail('solution');
  if (!kept && absHas(storyNums, answer) && !absHas(seedNums, answer)) return fail('leak');
  const end = finalValue(solution.at(-1));
  if (end == null || Math.abs(end - answer) > tol + 1e-9) return fail('solution');
  if (!checkEquations(solution.join('\n')).ok) return fail('equations');
  let blind = 'skipped';
  if (!kept && blindAnswer !== undefined) {
    const b = parseAnswer(blindAnswer);
    if (typeof b !== 'number' || Math.abs(b - answer) > tol + 1e-9) return fail('blind');
    blind = 'ok';
  }
  const hint = String(item?.hint ?? '');
  const badHint = !evenDollars(hint) || (absHas(numbersIn(hint), answer) && !absHas(seedNums, answer));
  return {
    ok: true, reason: null, fixed: badHint ? 'hint' : null, blind,
    item: { seed: seed.i, prompt, hint: badHint ? '' : hint, solution, kept, blind, ...(badHint ? { fixed: 'hint' } : {}) },
  };
}

/**
 * Every exercise of a rewrite reply. seeds: the request's seeds; data: the reply ({ items }); blind: the blind solve's
 * reply ({ answers: [{ seed, answer }] }), or null when it did not run. One exercise per seed (the first), in seed order.
 * → { items, dropped: { kept, latex, numbers, leak, solution, equations, blind } }.
 */
export function finishRewrite(seeds, data, blind) {
  const dropped = Object.fromEntries(DROP_REASONS.map((r) => [r, 0]));
  const bySeed = new Map();
  for (const it of Array.isArray(data?.items) ? data.items : []) {
    if (it && Number.isInteger(it.seed) && !bySeed.has(it.seed)) bySeed.set(it.seed, it);
  }
  const answers = blind && Array.isArray(blind.answers) ? blind.answers : null;
  const items = [];
  for (const seed of Array.isArray(seeds) ? seeds : []) {
    const it = bySeed.get(seed.i);
    if (!it) continue;
    // undefined: the blind solve did not run; null: it ran and gave nothing for this story (a fail)
    const b = answers ? (answers.find((a) => a && a.seed === seed.i)?.answer ?? null) : undefined;
    const r = verifyRewrite(seed, it, b);
    if (r.ok) items.push(r.item); else dropped[r.reason] += 1;
  }
  return { items, dropped };
}
