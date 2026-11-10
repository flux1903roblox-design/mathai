// The final-answer guard (ai spec AI-3 Design 2): while a student is still solving an exercise of the app (policy
// WITHHOLD), a tutor reply must not state its final answer. The prompt asks for that; this code makes sure a slip of the
// model never reaches the screen. It finds the answer the app computed, in every way it can be written, only where a
// reply states it as a result, and puts "?" in its place:
//
//   answerForms(ctx)        every written form of ctx.item.answer, as regex sources, and whether "x = 3" is the answer
//   findLeaks(text, f)      where a reply states the answer: (i) after the last "=" of a $…$ run (or of a plain-text
//                           equation), (ii) right after a cue word ("התשובה היא", "יוצא", "שווה ל־", "זה" directly
//                           before it), (iii) before "היא התשובה"
//   maskLeaks(text, f)      → { text, masked }: each leaked form becomes "?", so $-4 + 6 = 2$ reads $-4 + 6 = ?$
//   streamGuard(f)          the same over a reply that arrives in pieces: whole sentences at a time, outside maths
//   withholdCheck(data, f)  a notebook photo check under WITHHOLD: comments and summary masked, no mark on the line
//                           that states the final value, final 'unknown', withheld: true
//   MASK_NOTE               the line a masked reply ends with
//
// Plain JS with no dependencies: the Worker, the browser's personal-key path and the tests use the same code. It ships to
// the browser, so there is no regex lookbehind anywhere (trust spec §0.3 rule 3): a start of a number or a word is a
// prefix the pattern consumes and the mask keeps, and every end is a lookahead.

export const MASK_NOTE = 'את הצעד האחרון משאירים לכם: כתבו את התשובה בתיבה, והאפליקציה תבדוק.';

/** The kinds the guard covers, and only under WITHHOLD with an answer the app knows. */
export const GUARDED_KINDS = Object.freeze(['chat', 'explain', 'check']);
/** Topics whose answer is itself "x = 3" (an equation solved, a system): there a single letter before "=" is the answer. */
const LETTER_TOPICS = ['eq', 'sys'];

const MINUS = '[-−–]';
// a number ends where no digit, decimal part or TeX decimal comma follows: 2 is never found in 12, 2.5, 2,5 or 2{,}5
const END = '(?!\\d|[.,]\\d|\\{,\\}\\d)';
const FRAC = '\\\\[dt]?frac\\s*';
const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
const alt = (list) => `(?:${list.join('|')})`;

// ---------------------------------------------------------------- numbers, exactly
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
/** An exact rational { n, d } (d > 0, reduced) from "−3", "2.5", "2,5", "3/4", "\frac{3}{4}", "40°"; else null. */
function parseRational(raw) {
  const t = String(raw ?? '').replace(/\$/g, '').replace(/[−–]/g, '-').replace(/\s+/g, '').replace(/\\left|\\right/g, '')
    .replace(/(?:°|\^\\circ|\^\{\\circ\})$/, '');
  let m = t.match(/^\(?([+-]?)\\[dt]?frac\{([+-]?)(\d+)\}\{(\d+)\}\)?$/);
  if (m) return make((m[1] === '-') !== (m[2] === '-') ? -Number(m[3]) : Number(m[3]), Number(m[4]));
  m = t.match(/^\(?([+-]?\d+)\/(\d+)\)?$/);
  if (m) return make(Number(m[1]), Number(m[2]));
  m = t.match(/^\(?([+-]?)(\d+)(?:[.,](\d{1,8}))?\)?$/);
  if (m) {
    const dec = m[3] || '';
    const d = 10 ** dec.length;
    return make((m[1] === '-' ? -1 : 1) * (Number(m[2]) * d + Number(dec || 0)), d);
  }
  return null;
}
function make(n, d) {
  if (!Number.isFinite(n) || !Number.isFinite(d) || d <= 0) return null;
  const g = gcd(n, d) || 1;
  return { n: n / g, d: d / g };
}

/** Forms of |r| without a sign: the integer; or a/b, \frac{a}{b}, a mixed number, and the decimal when it ends. */
function absForms({ n, d }) {
  const p = Math.abs(n);
  if (d === 1) return [`${p}${END}`];
  const out = [
    `${p}\\s*/\\s*${d}${END}`,
    `${FRAC}\\{\\s*${p}\\s*\\}\\s*\\{\\s*${d}\\s*\\}`,
  ];
  if (p < 10 && d < 10) out.push(`${FRAC}${p}\\s*${d}${END}`); // \frac34
  if (p > d) {
    const w = Math.floor(p / d);
    out.push(`${w}\\s*${FRAC}\\{\\s*${p - w * d}\\s*\\}\\s*\\{\\s*${d}\\s*\\}`);
  }
  // a decimal that ends: d has no prime factor but 2 and 5
  let k = 0; let q = d;
  while (q % 2 === 0) { q /= 2; k += 1; }
  let k5 = 0; while (q % 5 === 0) { q /= 5; k5 += 1; }
  if (q === 1) {
    const digits = Math.max(k, k5);
    if (digits <= 8) {
      const scaled = (p * 10 ** digits) / d;
      const whole = Math.floor(scaled / 10 ** digits);
      const frac = String(scaled - whole * 10 ** digits).padStart(digits, '0');
      out.push(`${whole === 0 ? '0?' : whole}(?:[.,]|\\{,\\})${frac}${END}`);
    }
  }
  return out;
}

/** A degree mark after a number (an angle): 40°, 40^\circ, 40^{\circ}. It is masked with the number. */
const DEGREE = '(?:\\s*(?:°|\\^\\s*\\\\circ|\\^\\s*\\{\\s*\\\\circ\\s*\\}))?';

/** Every written form of the signed number r: −2, -2, - 2, −3/4, -\frac{3}{4}, \frac{-3}{4}, -0.75, -0,75, 40°. */
function numberForms(r, { degree = true } = {}) {
  const abs = absForms(r);
  const out = r.n >= 0 ? abs : abs.map((a) => `${MINUS}\\s*${a}`);
  if (r.n < 0 && r.d !== 1) out.push(`${FRAC}\\{\\s*${MINUS}\\s*${Math.abs(r.n)}\\s*\\}\\s*\\{\\s*${r.d}\\s*\\}`);
  return degree ? out.map((x) => `${x}${DEGREE}`) : out;
}

/** A point (x, y) with any spaces, a comma or a semicolon, plain or \left( \right) brackets. */
function pointForms(x, y) {
  return [`(?:\\\\left\\s*)?\\(\\s*${alt(numberForms(x, { degree: false }))}\\s*[,;]\\s*${alt(numberForms(y, { degree: false }))}\\s*(?:\\\\right\\s*)?\\)`];
}

// ---------------------------------------------------------------- linear expressions: kx + c, and y = mx + b
/** "3x + 12", "x - 3", "-x", "(1/2)x + 4", "-(1/2)x", "12 + 3x", "7" → { letter, k, c } (rationals); else null. */
function parseLinear(raw) {
  const t = String(raw ?? '').replace(/\$/g, '').replace(/[−–]/g, '-').replace(/\s+/g, '').replace(/\\cdot|\*/g, '');
  if (!t || !/^[-+0-9./(),a-z]+$/.test(t)) return null;
  const re = /([+-]?)(?:\(([+-]?[\d.,]+(?:\/\d+)?)\)|([\d.,]+(?:\/\d+)?))?([a-z])?/y;
  let i = 0; let letter = null; let k = null; let c = { n: 0, d: 1 };
  while (i < t.length) {
    re.lastIndex = i;
    const m = re.exec(t);
    if (!m || !m[0] || (!m[2] && !m[3] && !m[4])) return null;
    i = re.lastIndex;
    let v = m[2] || m[3] ? parseRational(m[2] || m[3]) : { n: 1, d: 1 };
    if (!v) return null;
    if (m[1] === '-') v = { n: -v.n, d: v.d };
    if (m[4]) {
      if ((letter && letter !== m[4]) || k) return null;
      letter = m[4]; k = v;
    } else {
      if (c.n !== 0) return null;
      c = v;
    }
  }
  return { letter, k, c };
}

/** The forms of a term with a letter: 3x, 3 \cdot x, x (and 1x), \frac{1}{2}x, \frac{x}{2}, (1/2)x, 0.5x. No sign. */
function letterTermAbs(k, letter) {
  const L = `${esc(letter)}(?![A-Za-z])`;
  const p = Math.abs(k.n);
  if (p === 1 && k.d === 1) return [`(?:1\\s*)?${L}`];
  const coef = absForms({ n: p, d: k.d }).map((f) => f.replace(END, ''));
  const out = coef.map((f) => `${f}\\s*(?:\\\\cdot\\s*|\\*\\s*)?${L}`);
  if (k.d !== 1) {
    out.push(`\\(\\s*${p}\\s*/\\s*${k.d}\\s*\\)\\s*${L}`);
    out.push(`${FRAC}\\{\\s*${p === 1 ? '' : p}\\s*${L}\\s*\\}\\s*\\{\\s*${k.d}\\s*\\}`);
  }
  return out;
}

/** a + b in both orders, with every way of writing the sign between them ("- 3", "+ -3", "+ (-3)"). */
function sumForms(terms) {
  const first = (t) => (t.neg ? `${MINUS}\\s*${t.abs}` : t.abs);
  const next = (t) => (t.neg
    ? alt([`${MINUS}\\s*${t.abs}`, `\\+\\s*${MINUS}\\s*${t.abs}`, `\\+\\s*\\(\\s*${MINUS}\\s*${t.abs}\\s*\\)`])
    : `\\+\\s*${t.abs}`);
  const orders = terms.length === 2 ? [terms, [terms[1], terms[0]]] : [terms];
  return orders.map((o) => o.map((t, i) => (i ? `\\s*${next(t)}` : first(t))).join(''));
}

function linearForms({ letter, k, c }) {
  const terms = [];
  if (k && k.n !== 0) terms.push({ neg: k.n < 0, abs: alt(letterTermAbs(k, letter)) });
  if (c.n !== 0 || !terms.length) terms.push({ neg: c.n < 0, abs: alt(absForms(c)) });
  return sumForms(terms);
}

// ---------------------------------------------------------------- the forms of one answer
/** A literal answer (a choice's text): its words with any spacing, bounded by the kind of character at each end. */
function literalForm(s) {
  const text = String(s).replace(/\$/g, '').trim();
  if (!text || text.length > 60) return null;
  const body = text.split(/\s+/).map(esc).join('\\s+');
  const last = text.at(-1);
  const tail = /\d/.test(last) ? END : /[א-ת]/.test(last) ? '(?![א-ת])' : /[A-Za-z]/.test(last) ? '(?![A-Za-z])' : '';
  return `${body}${tail}`;
}

const POINT = /^\(?\s*([^,;()]+?)\s*[,;]\s*([^,;()]+?)\s*\)?$/;
/**
 * Every written form of the exercise's final answer, from ctx.item.answer (the app's text of it) and ctx.item.form:
 *   num             the number: sign as -, − or in brackets, a decimal with . or , (or {,}), a/b, \frac (sign in or
 *                   out), a mixed number, the decimal of a fraction that ends; and a degree mark may follow
 *   pt              (x, y) with any spaces
 *   line            y = mx + b and mx + b, in either order, 1x read as x and "+ -" as "-"
 *   lin             kx + c and c + kx
 *   mc              the correct choice as written (its text, or its TeX read as a number when it is one)
 *   manip           by the text of the answer: a number (a point on the number line, an angle, a bar), a point, a line,
 *                   or x = a number (the balance); any other object (pins, tiles, an area, a ray) has no forms, so the
 *                   guard is off for it and the prompt alone holds
 * → { forms: string[] (regex sources, every number digit-bounded), letterOk } or null when there is nothing to find.
 * letterOk: "x = 3" states the answer itself (the eq and sys topics, or an answer written that way).
 */
export function answerForms(ctx) {
  const it = ctx?.item;
  const raw = typeof it?.answer === 'string' ? it.answer.replace(/\$/g, '').trim() : '';
  if (!raw) return null;
  const form = it.form;
  let letterOk = LETTER_TOPICS.includes(ctx?.topicId);
  const forms = [];
  const s = raw.replace(/[−–]/g, '-');
  const num = parseRational(s);
  const pt = s.match(POINT);
  const ptx = pt && parseRational(pt[1]); const pty = pt && parseRational(pt[2]);
  const line = s.match(/^y\s*=\s*(.+)$/);
  const lineExpr = line && parseLinear(line[1]);
  const letterValue = s.match(/^([a-z])\s*=\s*(.+)$/);
  const lv = letterValue && letterValue[1] !== 'y' ? parseRational(letterValue[2]) : null;
  const lin = form === 'lin' || (!form && /[a-z]/.test(s) && !/=/.test(s)) ? parseLinear(s) : null;

  if (ptx && pty && /^\(.*[,;].*\)$/.test(s) && form !== 'lin') {
    forms.push(...pointForms(ptx, pty));
  } else if (num) {
    forms.push(...numberForms(num));
  } else if (lineExpr && (!lineExpr.letter || lineExpr.letter === 'x') && form !== 'lin') {
    const rhs = linearForms({ letter: 'x', k: lineExpr.k, c: lineExpr.c });
    forms.push(...rhs.map((r) => `y\\s*=\\s*${r}`), ...rhs);
  } else if (lv) {
    forms.push(...numberForms(lv));
    letterOk = true;
  } else if (lin && lin.letter) {
    forms.push(...linearForms(lin));
  } else if (form === 'mc' || !form) {
    const lit = literalForm(raw);
    if (lit) forms.push(lit);
  }
  if (!forms.length) return null;
  // the substitution letter: "x = 0" in a line or an expression is a value put in, not the answer (unless letterOk)
  const plain = lin?.letter || 'x';
  return { forms: [...new Set(forms)].sort((a, b) => b.length - a.length), letterOk, plain };
}

// ---------------------------------------------------------------- where a reply states the answer
/** The $…$ (and $$…$$) runs of a text: { start, end } of the content, closed or not. A \$ is not a delimiter. */
function mathRuns(text) {
  const runs = [];
  let i = 0; let open = -1; let width = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '\\') { i += 2; continue; }
    if (ch === '$') {
      const w = text[i + 1] === '$' ? 2 : 1;
      if (open < 0) { open = i + w; width = w; } else if (w >= width) { runs.push({ start: open, end: i, closed: true }); open = -1; i += width; continue; }
      i += w; continue;
    }
    i += 1;
  }
  if (open >= 0) runs.push({ start: open, end: text.length, closed: false });
  return runs;
}

/** Where the text is maths: true at index i when an odd number of unescaped $ comes before it. */
function outsideMathAt(text) {
  const runs = mathRuns(text);
  return (i) => !runs.some((r) => i >= r.start - 1 && i < r.end + 1);
}

/** Markers the server adds ([[care]], [[blocked]], [[refusal]], [[error:…]]): never touched. */
const MARKER = /\[\[[a-z_:]{1,40}\]\]/g;

/** The term just before an "=": a single letter there is a value put in ("x = 0") unless letterOk. */
function letterBlocks(lhs, f) {
  const parts = lhs.split(/\\q?quad|\\Rightarrow|\\implies|\\to\b|\\text\{[^}]*\}|[,;:]/);
  const term = parts[parts.length - 1].replace(/\\[,;:!]|\\left|\\right|\s/g, '');
  return /^[A-Za-zא-ת]$/.test(term) && !f.letterOk && term === f.plain;
}

const AFTER_RESULT = '(?=(?:\\s|\\\\[,;:!])*(?:\\\\right\\s*)?\\)?(?:\\s|\\\\[,;:!])*(?:$|[,.;]|\\\\q?quad|\\\\text))';
const OPERATOR_NEXT = /^\s*[+\-−–*/×÷·^=<>]/;
// cue words (ii): Hebrew word starts are a consumed prefix, never a lookbehind
const CUE = '(?:התשובה|התוצאה|הפתרון|יוצאת|יוצא|יצאה|יצא|שווים|שווה)';
const CUE_WORD = '(?:בסוף|הנכונה|הסופית|הנקודה|המספר|הערך|הביטוי|הישר|הזווית|האורך|בערך|בדיוק)';
const LINK = '(?:\\s+(?:היא|הוא))?(?:\\s*:)?';
const HEB_START = '(^|[^א-ת])';

/** The patterns of one answer, compiled once (a streamed reply is checked piece by piece). */
const CACHE = new WeakMap();
function compiled(f) {
  let c = CACHE.get(f);
  if (c) return c;
  const F = alt(f.forms);
  c = {
    tailRe: new RegExp(`^((?:\\s|\\\\[,;:!]|\\\\left)*\\(?\\s*)(${F})${AFTER_RESULT}`),
    proseRe: new RegExp(`([^\\s=]*)\\s*=\\s*(\\(?\\s*)(${F})(?=\\s*\\)?(?:$|[\\s,.;:!?]))`, 'g'),
    cueRe: new RegExp(`${HEB_START}((?:ו|ש|וש|כש)?${CUE}(?:\\s+${CUE_WORD})?${LINK}(?:\\s+${CUE_WORD})?${LINK}\\s*(?:ל[־-]?\\s*)?)(\\$\\s*)?(${F})`, 'g'),
    thisRe: new RegExp(`${HEB_START}((?:ו)?זה\\s+)(\\$\\s*)?(${F})`, 'g'),
    ownRe: new RegExp(`(^|[^\\dA-Za-zא-ת.,\\\\])(\\$\\s*)?(${F})(\\s*\\$)?(?=\\s*[,:]?\\s*(?:היא|הוא)\\s+(?:התשובה|התוצאה))`, 'g'),
  };
  CACHE.set(f, c);
  return c;
}

/**
 * Where `text` states the final answer, as { start, end } of the form itself (the cue, the "=" and the brackets stay).
 * f is what answerForms returned. Markers and anything inside them are never touched.
 */
export function findLeaks(text, f) {
  const s = String(text ?? '');
  if (!s || !f?.forms?.length) return [];
  const { tailRe, proseRe, cueRe, thisRe, ownRe } = compiled(f);
  const spans = [];
  const add = (start, len) => { if (len > 0) spans.push({ start, end: start + len }); };
  const runs = mathRuns(s);

  // (i) the right-hand side of the last "=" in a $…$ run, followed by the run's end, "," "." or \quad
  for (const run of runs) {
    if (!run.closed) continue;
    const body = s.slice(run.start, run.end);
    const eqs = [...body.matchAll(/=|\\approx|≈/g)];
    if (!eqs.length) continue;
    const last = eqs[eqs.length - 1];
    const prev = eqs.length > 1 ? eqs[eqs.length - 2] : null;
    const lhs = body.slice(prev ? prev.index + prev[0].length : 0, last.index);
    if (letterBlocks(lhs, f)) continue;
    const from = last.index + last[0].length;
    const m = body.slice(from).match(tailRe);
    if (m) add(run.start + from + m[1].length, m[2].length);
  }

  // (i) the same for an equation written in plain text, outside $…$ (maths blanked out, so the indices stay)
  let prose = s;
  for (const run of runs) prose = prose.slice(0, run.start) + ' '.repeat(run.end - run.start) + prose.slice(run.end);
  for (const m of prose.matchAll(proseRe)) {
    const at = m.index + m[0].length - m[3].length;
    if (letterBlocks(m[1], f) || /[<>!≤≥]$/.test(m[1])) continue;
    if (OPERATOR_NEXT.test(prose.slice(at + m[3].length))) continue;
    if (s.slice(m.index, at).includes('$')) continue; // across a run: (i) above decides
    add(at, m[3].length);
  }

  // (ii) right after a cue: "התשובה היא 2", "יוצאת הנקודה $(2,-1)$", "שווה ל־2", "התשובה הנכונה היא שלילית"
  // ("זה" counts only directly before the answer, "זה 8", "זה $8$": it starts many innocent sentences)
  for (const re of [cueRe, thisRe]) {
    for (const m of s.matchAll(re)) {
      const at = m.index + m[1].length + m[2].length + (m[3] || '').length;
      const after = s.slice(at + m[4].length);
      // in maths the form must be all of the run; in prose no operator may follow (then it is a step, not the result)
      if (m[3] ? !/^\s*(?:\\[,;!]\s*)*[.,]?\s*\$/.test(after) : OPERATOR_NEXT.test(after)) continue;
      add(at, m[4].length);
    }
  }

  // (iii) the form, then "היא התשובה" / "הוא התוצאה"
  for (const m of s.matchAll(ownRe)) add(m.index + m[1].length + (m[2] || '').length, m[3].length);

  // markers stay whole; overlapping finds count once
  const marks = [...s.matchAll(MARKER)].map((m) => [m.index, m.index + m[0].length]);
  const out = [];
  for (const sp of spans.sort((a, b) => a.start - b.start || b.end - a.end)) {
    if (marks.some(([a, b]) => sp.start < b && sp.end > a)) continue;
    if (out.length && sp.start < out[out.length - 1].end) continue;
    out.push(sp);
  }
  return out;
}

/** Each leaked form becomes "?". → { text, masked } (masked: how many). */
export function maskLeaks(text, f) {
  const s = String(text ?? '');
  const spans = findLeaks(s, f);
  let out = s;
  for (let i = spans.length - 1; i >= 0; i -= 1) out = `${out.slice(0, spans[i].start)}?${out.slice(spans[i].end)}`;
  return { text: out, masked: spans.length };
}

// ---------------------------------------------------------------- a reply in pieces
export const STREAM_FORCE = 400;
export const STREAM_CARRY = 40;
const CONTEXT = 80; // what is kept of the text already sent, so a cue before a cut is still seen

/** The last n characters (about) of a text, starting outside maths, so its $ runs stay whole. */
function balancedTail(text, n) {
  if (text.length <= n) return text;
  const outside = outsideMathAt(text);
  for (let i = text.length - n; i < text.length; i += 1) if (outside(i) && text[i] !== '$') return text.slice(i);
  return '';
}

/** The end of the last whole sentence outside maths: after ".", "?" or "!" and a space, or after a new line. 0: none. */
function sentenceEnd(text) {
  const outside = outsideMathAt(text);
  for (let i = text.length - 1; i >= 0; i -= 1) {
    const ch = text[i];
    if (ch === '\n' && outside(i)) return i + 1;
    // a "." between two digits is never followed by a space, so 2.5 is not an end
    if (/[.?!]/.test(ch) && i + 1 < text.length && /\s/.test(text[i + 1]) && outside(i)) return i + 2;
  }
  return 0;
}

/** A cut for a long sentence: at a space outside maths, at most `max`, after a word or a closed run; else `max`. */
function safeCut(text, max) {
  const outside = outsideMathAt(text);
  for (let i = max; i > 0; i -= 1) if (/\s/.test(text[i]) && outside(i) && /[א-תA-Za-z$.,:;!?)]/.test(text[i - 1])) return i + 1;
  return max;
}

/**
 * The guard over a streamed reply: push(delta) returns what may be shown now, end() the rest. Text is held back until a
 * sentence ends outside maths (a run is never cut), and each piece is masked with the text before it as context; a
 * sentence over 400 characters is cut at a space, keeping the last 40 characters for the next piece, and never inside a
 * form that was found. Markers pass untouched. With no forms (f null) every piece passes as it comes.
 */
export function streamGuard(f) {
  let buf = ''; let tail = ''; let masked = 0;
  const flush = (cut, final = false) => {
    if (cut <= 0) return '';
    const full = tail + buf;
    const from = tail.length;
    // a run still open at the very end is closed for the last piece
    const closing = final && mathRuns(full).some((r) => !r.closed) ? '$' : '';
    // what was already sent cannot change: only finds that start in this buffer count, and the cut never splits one
    const spans = findLeaks(full + closing, f).filter((sp) => sp.start >= from && sp.start < full.length);
    let at = cut;
    for (const sp of spans) if (sp.start - from < at && sp.end - from > at) at = sp.start - from;
    if (at <= 0) return '';
    let piece = buf.slice(0, at);
    const mine = spans.filter((sp) => sp.start >= from && sp.end - from <= at);
    for (let i = mine.length - 1; i >= 0; i -= 1) piece = `${piece.slice(0, mine[i].start - from)}?${piece.slice(mine[i].end - from)}`;
    masked += mine.length;
    buf = buf.slice(at);
    tail = balancedTail(tail + piece, CONTEXT);
    return piece;
  };
  return {
    push(delta) {
      if (!f) return String(delta ?? '');
      buf += String(delta ?? '');
      let out = flush(sentenceEnd(buf));
      while (buf.length >= STREAM_FORCE) {
        const piece = flush(safeCut(buf, buf.length - STREAM_CARRY));
        if (!piece) break;
        out += piece;
      }
      return out;
    },
    end() {
      if (!f) return '';
      const out = flush(buf.length, true);
      buf = '';
      return out;
    },
    get masked() { return masked; },
  };
}

// ---------------------------------------------------------------- whole replies
/** Is the guard on for this request? Only chat, explain and check, under WITHHOLD, with an answer the app knows. */
export function guardOn(kind, ctx) {
  return GUARDED_KINDS.includes(kind) && ctx?.policy?.answer === 'withhold' && !!ctx?.item?.answer;
}

/** A text reply with the note after it when something was masked. */
export const withMaskNote = (text, masked) => (masked ? `${text}\n\n${MASK_NOTE}` : text);

/** The step of a check that states the final value: the last whose text has "=" and then a number; else the last step. */
const STATES_VALUE = /=\s*\$?\s*(?:\\left\s*)?\(?\s*[-−–]?\s*(?:\d|\\[dt]?frac)/;

/**
 * A notebook photo check under WITHHOLD (AI-3 Design 3): every comment and the summary masked; the student's own steps
 * and the transcript as written (masking a child's own number would only confuse); the step that states the final value
 * gets neither ✓ nor ✗ (ok: null) and no comment; final 'unknown' and withheld: true. → { data, masked }.
 */
export function withholdCheck(data, f) {
  if (!data || typeof data !== 'object') return { data, masked: 0 };
  let masked = 0;
  const m = (s) => {
    if (typeof s !== 'string' || !f) return s;
    const r = maskLeaks(s, f);
    masked += r.masked;
    return r.text;
  };
  const given = Array.isArray(data.steps) ? data.steps : [];
  let at = -1;
  for (let i = given.length - 1; i >= 0 && at < 0; i -= 1) if (STATES_VALUE.test(String(given[i]?.text || ''))) at = i;
  if (at < 0) at = given.length - 1;
  const steps = given.map((st, i) => (i === at ? { ...st, ok: null, comment: '' } : { ...st, comment: m(st?.comment) }));
  return { data: { ...data, steps, summary: m(data.summary), final: 'unknown', withheld: true }, masked };
}

/**
 * A finished reply under the guard: explain and chat masked (with MASK_NOTE once when something was), a check withheld.
 * `g` is { on, forms } from guardFor; a care reply is never touched. → { result, masked }.
 */
export function guardResult(kind, result, g) {
  if (!g?.on || !result || typeof result !== 'object' || result.care === true) return { result, masked: 0 };
  if (kind === 'check') {
    const { data, masked } = withholdCheck(result, g.forms);
    return { result: data, masked };
  }
  if ((kind === 'explain' || kind === 'chat') && g.forms && typeof result.text === 'string') {
    const { text, masked } = maskLeaks(result.text, g.forms);
    return { result: { ...result, text: withMaskNote(text, masked) }, masked };
  }
  return { result, masked: 0 };
}

/** The guard for a request: { on, forms } (forms null when the answer has no written form, e.g. pins on a line). */
export function guardFor(kind, ctx) {
  const on = guardOn(kind, ctx);
  return { on, forms: on ? answerForms(ctx) : null };
}
