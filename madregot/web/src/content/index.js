import { parseNum, near, plainNum, linText, readNumCandidates, numRight, roundsTo, toFrac, gcd, withFormatNote, piNear, piRow, afterPlain } from './util.js';
import { manipCorrect, manipText, manipPlain, manipSolution, panWords, tilesWords, rayText, areaTex, figWords, lineText, sgraphWords, protractorWords, clockText, chartWords, outcomesWords, coordWords } from './manip.js';
import { GENERATOR_WEIGHT } from '@/learn/misconceptions.ts';
// The first-load side of the content (content/topics.js: every topic's names, stairs, colours and misconception names,
// the rows the screens list, the paths (pathTopicsFor) and the generators' loading) is re-exported here, so code that
// makes or checks a question imports everything from this file. A screen of the first load imports content/topics.js
// instead: this file carries the checkers and the figures' words (content/manip.js), which load with the exercise
// screens (the boot split).
import { TOPIC } from './topics.js';
// the rules of the measurement objects and the words of their drawings (stage 2: the grid shapes, the nets and the
// solids, the circle) register themselves with content/manip.js as they load; a question, a check, an exam's key and
// the tutor's text all come through this file, so they always have them (net.js brings roll.js). Stage 4's transform
// object (with the words of its still twin on the coord figure) and its proof table register the same way.
import './grid.js';
import './net.js';
import './transform.js';
import { proofCheckable } from './proof.js';

export * from './topics.js';

/**
 * Generate one item for a topic level, with bookkeeping fields attached. A check (`opts.test`) draws from the level's
 * testGen when it has one (CURRICULUM-10: the angle stairs mix two-step questions into their checks); practice keeps gen.
 */
/**
 * The mistakes a generator's diag() names for a wrong answer, as a list. A diag may return one category, or several
 * when their predictions are the same number for this question (sn5: the order mistake and the sign mistake can both
 * give one number). The level's `flagship`, the stair's own mistake, names an answer it predicts alone (signed:1:
 * −4 − (−11) answered −15 is subtracting the negative as a positive, though adding the distances gives −15 too), as
 * the stair's diagnostic model does (learn/misconceptions.ts diagnose). `full` is the finished item (wrong as it reads
 * the answer), `raw` the generator's own with its diag.
 */
const NONE = Object.freeze([]);
function namedBy(full, raw, L, u) {
  if (isCorrect(full, u)) return NONE;
  const c = raw.diag(u);
  if (!c) return NONE;
  if (!Array.isArray(c)) return [c];
  const all = [...new Set(c.filter(Boolean))];
  return L.flagship && all.includes(L.flagship) ? [L.flagship] : all;
}

/** Generate one item for a topic level, with bookkeeping fields attached. */
export function makeItem(topicId, level, avoidKey, opts = {}) {
  const t = TOPIC[topicId];
  const L = t.levels[Math.min(Math.max(level, 1), t.levels.length) - 1];
  // the code that makes a question waits for its topic first (ensureTopics, loadGens): a missing generator is a bug there
  if (!L.gen) throw new Error(`makeItem('${topicId}', ${level}): its generators have not loaded. Wait for ensureTopics(['${topicId}']) or loadGens('${topicId}') first.`);
  // a proof stair's check asks whole proofs from the level's proofGen (`opts.proof`, learn/items.ts source 'proof')
  const gen = opts.proof && L.proofGen ? L.proofGen : opts.test && L.testGen ? L.testGen : L.gen;
  let it; let guard = 0;
  do { it = gen(); } while (avoidKey && it.key === avoidKey && guard++ < 10);
  // a typed answer that has no exact two-place decimal (7/12, a slope of -5/6, a mean of 13/3) says once how to write it
  if (it.form === 'num') it = withFormatNote(it);
  // A misconception can only be diagnosed for an answer that is actually wrong: wrong as the finished item reads it, on
  // its own stair (expr:3 takes an expression's two boxes in either order, swappedLin). diag() gives the first name (the
  // one a lesson counts and shows when there is one); diagnosis() gives them all in the diagnostic models' contract, so
  // an answer two mistakes explain is ambiguous wherever it is shown or recorded, never named as one of them by chance.
  // Each name weighs GENERATOR_WEIGHT, shared between the names when there are several.
  const full = { ...it, topic: topicId, level, levelTitle: L.title };
  full.diag = (u) => namedBy(full, it, L, u)[0] || null;
  full.diagnosis = (u) => {
    const ids = namedBy(full, it, L, u);
    if (!ids.length) return null;
    return { kind: 'misconception', candidates: ids.map((id) => ({ id, conf: GENERATOR_WEIGHT / ids.length })), ambiguous: ids.length > 1 };
  };
  // the answers diag() names, when the generator lists them (content/data.js; namesOf reads them)
  if (it.diag?.wrongs) full.diag.wrongs = it.diag.wrongs;
  return full;
}

/**
 * Can this question show the skill in a check? A question marked practiceOnly (a choice among two or three, or an
 * object whose target the question names) is guessed too easily, and a question that is always the same (`fixed`: the
 * curriculum's own equations, the laundry story) can be remembered from practice, where its solution is shown: checks,
 * jump tests and the placement test skip both. A signed-number question with no negative number in it ("6 · 1",
 * "5 + 3") says nothing about signs: they skip it too. Practice keeps them all.
 */
export function fairForCheck(it) {
  // a proof: only a whole one, made for a check (content/proof.js proofCheckable: its rows shuffled, three reasons or
  // more asked, each of three choices), with no hint and not marked practice only (content/proofs.js checkProofItem). The
  // practice proofs (one or two reasons to fill in, the theorem alone, which row is wrong) are guessed too easily, flagged
  // or not (GEOM-3.10; the council's round 3 let the proof stairs' checks ask whole proofs)
  if (it.manip?.kind === 'proof') return !it.practiceOnly && !it.hint && proofCheckable(it.manip);
  if (it.practiceOnly) return false;
  if (it.fixed) return false;
  if (it.topic !== 'signed') return true;
  const shown = [it.display, it.text, ...(it.manip?.labels || []), ...(it.choices || []).map((c) => c.tex || c.text)].join(' ');
  // a minus at the start of a number: after a space, a bracket (round or square: "30 - 4\left[-3 - …\right]"), a $ or a
  // TeX brace ("12 \;\square\; {-12}"), before a digit or a fraction ("-\frac{1}{4} - \left(-\frac{3}{4}\right)" has a
  // positive answer and two negative numbers)
  return /(^|[\s($\{[])[-−](\d|\\frac)/.test(shown) || (typeof it.answer === 'number' && it.answer < 0 && it.form !== 'mc');
}

/**
 * Wrong answers to try on an exercise, in its form: wide enough to reach what its diag() names (a chosen choice, a pair
 * written the other way round, an expression's coefficient and constant, a number in the question). Objects (manip)
 * have none.
 */
function* tryAnswers(it) {
  const range = function* (a, b, step = 1) { for (let v = a; v <= b + 1e-9; v += step) yield Math.round(v * 100) / 100; };
  // whole numbers from zero outwards (0, 1, −1, 2, −2, …): a prediction near zero is met first
  const out = function* (n) { yield 0; for (let v = 1; v <= n; v += 1) { yield v; yield -v; } };
  if (it.form === 'mc') { for (let i = 0; i < it.choices.length; i += 1) yield i; return; }
  if (it.form === 'pt') {
    const [x, y] = it.answer; yield [y, x];
    for (const a of range(-20, 20)) for (const b of range(-20, 20)) yield [a, b];
    return;
  }
  if (it.form === 'line') { for (const m of range(-8, 8, 0.5)) for (const b of range(-20, 20)) yield { m, b }; return; }
  if (it.form === 'lin') { for (const c of out(100)) for (const k of out(100)) yield { k, c }; return; }
  // an object whose answer is one number (a bar's height, a point on the number line): every place it can be put
  if (it.form === 'manip') { if (typeof it.answer === 'number') yield* range(it.manip.min ?? 0, it.manip.max ?? 20); return; }
  if (it.form !== 'num') return;
  // the numbers of the question (a mean, a total) and their neighbours, then whole numbers and tenths
  for (const v of String(it.key).split(/[:,]/).map(Number).filter(Number.isFinite)) { yield v; yield -v; }
  yield* range(-200, 1000);
  yield* range(-100, 100, 0.1);
  yield* range(-20, 20, 0.05);
}

/**
 * The misconceptions an exercise's own diag() can name, for some wrong answer: where a misconception can show. A
 * verification after a repair asks such exercises when no diagnostic model of the stair predicts that misconception
 * (learn/items.ts). `want`: stop as soon as all of these are found. An item whose diag() names only the answers it
 * lists in `tries` (the class's collecting questions, content/expr.js) is asked those, not the whole grid of its form.
 */
export function namesOf(it, want = [], alone = false) {
  const found = new Set();
  // a diag() that lists the answers it names (its predictions, content/data.js) is asked only those: every name the
  // search below finds, and a prediction off its grid too (0.36), without trying thousands of typed numbers; an item
  // that lists its `tries` (content/expr.js) is asked those
  for (const u of it.diag?.wrongs || (Array.isArray(it.tries) ? it.tries : tryAnswers(it))) {
    // (diagnosis and diag name nothing for a right answer)
    if (!it.diagnosis && isCorrect(it, u)) continue;
    // every name of an answer, an ambiguous one's too (makeItem diagnosis); `alone`: only names an answer has by itself,
    // so a question can tell them apart (a probe after an ambiguous answer, lib/lesson.js)
    let cats;
    if (it.diagnosis) { const d = it.diagnosis(u); cats = d?.kind !== 'misconception' || (alone && d.ambiguous) ? NONE : d.candidates.map((c) => c.id); } else { const c = it.diag(u); cats = c ? [c].flat() : NONE; } // a diag may name a list (one number, two mistakes)
    cats.forEach((cat) => found.add(cat));
    if (cats.length && want.length && want.every((w) => found.has(w))) break;
  }
  return [...found];
}

/** An exercise of a stair for a check or the placement test (see fairForCheck). */
export function testItem(topicId, level, avoidKey) {
  let it;
  for (let i = 0; i < 40; i += 1) { it = makeItem(topicId, level, avoidKey, { test: true }); if (fairForCheck(it)) return it; }
  return it;
}

// Answer forms: 'num' (one number), 'pt' (a point), 'line' (y = mx + b), 'lin' (an expression kx + c: two typed
// slots, the coefficient and the constant; item.var is the letter, x by default), 'frac' (a fraction: two typed
// slots, the numerator and the denominator, whole numbers; item.answer is the value, and with item.reduced the
// fraction must be in lowest terms), 'mc' (a choice), 'manip' (an object).
// Flags a typed number may carry: precise (compared exactly, see numRight in util.js), fmt: 'dec' (the answer is shown
// as a decimal, -1.3 and not -13/10), askDec (the question asks for a decimal: a fraction typed is not read).
// A topic may carry bridge: true (the fractions floor): it is in no grade's topicsFor.
/** Which answer slots an item needs. */
export const slotsFor = (it) => (it.form === 'pt' ? ['x', 'y'] : it.form === 'line' ? ['m', 'b'] : it.form === 'lin' ? ['k', 'c'] : it.form === 'frac' ? ['n', 'd'] : it.form === 'mc' || it.form === 'manip' ? [] : ['v']);

/** A whole number typed in a slot, or null. */
const wholeOf = (s) => { const v = parseNum(s); return v != null && Number.isInteger(v) ? v : null; };

/** Read the typed slots into a value; null when something is missing or unreadable. */
export function readAnswer(it, slots) {
  if (it.form === 'mc') return Number.isInteger(slots.choice) ? slots.choice : null;
  if (it.form === 'pt') { const x = parseNum(slots.x); const y = parseNum(slots.y); return x == null || y == null ? null : [x, y]; }
  if (it.form === 'line') { const m = parseNum(slots.m); const b = parseNum(slots.b); return m == null || b == null ? null : { m, b }; }
  if (it.form === 'lin') { const k = parseNum(slots.k); const c = parseNum(slots.c); return k == null || c == null ? null : { k, c }; }
  if (it.form === 'frac') {
    const n = wholeOf(slots.n); const d = wholeOf(slots.d);
    if (n == null || d == null || d === 0) return null;
    // a minus in the denominator moves up: 7/(-12) is -7/12, the same fraction
    return d < 0 ? { n: n === 0 ? 0 : -n, d: -d } : { n, d };
  }
  // a question that asks for a decimal takes a decimal: the fraction typed back ("3/4" for "write 3/4 as a decimal")
  // is not an answer to it (screens/Lesson.jsx says so)
  if (it.askDec && /\//.test(String(slots.v ?? ''))) return null;
  // a whole number and then the space key is a mixed number not yet typed ("5 " on the way to 5 1/3): not an answer yet
  // (screens/Lesson.jsx says how a mixed number is written)
  if (/\d\s+$/.test(String(slots.v ?? ''))) return null;
  // a number: "2,000" can be 2 (a decimal comma) or 2000 (thousands); keep the reading the question accepts, else
  // the one nearest its answer, which the diagnosis then sees
  const cands = readNumCandidates(slots.v);
  if (cands.length < 2) return cands.length ? cands[0] : null;
  const right = cands.find((v) => isCorrect(it, v));
  if (right !== undefined) return right;
  return typeof it.answer === 'number' ? cands.reduce((a, b) => (Math.abs(b - it.answer) < Math.abs(a - it.answer) ? b : a)) : cands[0];
}

/**
 * A right answer in the shape the item's input takes, for tests and test hooks: a fraction answer as its numerator and
 * denominator in lowest terms ({ n, d }, which every fraction question accepts), an object's solving state, else the
 * answer itself.
 */
export const answerInput = (it) => (it.form === 'frac' ? toFrac(it.answer) : it.form === 'manip' ? manipSolution(it) : it.answer);

/** Is the answer a length that is not whole, asked rounded to tenths (its exact value is on the item)? */
export const roundedLength = (it) => it.exact != null && Math.abs(it.exact - Math.round(it.exact)) > 1e-9;

/**
 * The class writes an expression constant-first ("−31 − 2x", CLASSROOM-6): on expr:3 only, an expression typed with
 * the constant in the coefficient's box and the coefficient in the constant's box is right, when both numbers are the
 * right ones, they differ, and neither is 0. With a 0 the two boxes are not the same expression in another order: when
 * the x-terms cancel (0x − 25), −25 in the x box is −25x, an x the expression no longer has (conjoin), and when the
 * numbers cancel (3x + 0), 3 in the number box has lost the x. It earns a guesser nothing (the swapped pair is right only
 * when both numbers are), and the lesson shows a note on the boxes (swapNote), not a cross; nothing reaches the
 * misconception record. In eq and sys the boxes are a solution, not an expression, and keep their order.
 */
export function swappedLin(it, u) {
  if (it?.form !== 'lin' || it.topic !== 'expr' || Number(it.level) !== 3 || !u || typeof u !== 'object') return false;
  const { k, c } = it.answer;
  return !near(k, 0, 0.01) && !near(c, 0, 0.01) && !near(k, c, 0.01) && near(u.k, c, 0.01) && near(u.c, k, 0.01);
}
/** The note under a constant-first answer: which box holds the coefficient, and the two orders as one expression. */
export function swapNote(it) {
  const v = it.var || 'x'; const { k, c } = it.answer;
  const term = k === 1 ? v : k === -1 ? `-${v}` : `${k}${v}`;
  const join = (a, b) => `${a} ${String(b).startsWith('-') ? `- ${String(b).slice(1)}` : `+ ${b}`}`;
  return `המקדם של $${v}$ נכתב בתיבה הראשונה: $${join(c, term)} = ${join(term, c)}$`;
}

export function isCorrect(it, u) {
  if (u == null) return false;
  if (it.form === 'manip') return manipCorrect(it, u);
  if (it.form === 'mc') return u === it.answer;
  if (it.form === 'pt') return near(u[0], it.answer[0]) && near(u[1], it.answer[1]);
  if (it.form === 'line') return near(u.m, it.answer.m, 0.01) && near(u.b, it.answer.b, 0.01);
  if (it.form === 'lin') return typeof u === 'object' && ((near(u.k, it.answer.k, 0.01) && near(u.c, it.answer.c, 0.01)) || swappedLin(it, u));
  // a fraction is compared exactly; with `reduced` it must be in lowest terms, with a positive denominator
  if (it.form === 'frac') {
    return typeof u === 'object' && Number.isInteger(u.n) && Number.isInteger(u.d) && u.d !== 0 && near(u.n / u.d, it.answer, 1e-9)
      && (!it.reduced || (u.d > 0 && gcd(u.n, u.d) === 1));
  }
  // a value with π ≈ 3.14 (`pk`, the multiple of π): right within half a tenth of 3.14·k or of the calculator's π·k
  if (Number.isFinite(it.pk)) return piNear(u, it.pk);
  // a length rounded to tenths (a root that is not whole): the exact value correctly rounded at the places typed, tenths
  // or finer, so 7.1, 7.07 and 7.071 are right for √50 and 7, 7.0, 7.12 and 7.05 are not. The exact value decides, not
  // the rounded answer: √288 = 16.97… rounds to 17.0, a whole number, and 16.97 is right too
  if (roundedLength(it)) return roundsTo(u, it.exact, 1);
  // within ±0.01, or exactly when the item is marked precise (util.js numRight)
  return numRight(u, it.answer, !!it.precise);
}

/** Does a misconception of the item (its model's bugs, or its generator's diag) predict this wrong answer? */
function predicted(it, u) {
  const d = typeof it.diagnosis === 'function' ? it.diagnosis(u) : null;
  if (d?.kind === 'misconception') return true;
  return typeof it.diag === 'function' && !!it.diag(u);
}

/**
 * A right value in a form the question does not take yet. It is a note on the form, not a mistake: the lesson says so
 * and keeps the question open, records no attempt and no answer event, and nothing reaches the misconception record.
 *   'not-reduced'  a fraction has the right value but the question asks for lowest terms;
 *   'pi-value'     the answer row ends with π (□π) and the number typed is the whole value, 31.4 for 10π: within half a
 *                  tenth of 3.14 · answer or of π · answer, and no misconception of the item predicts it.
 * Otherwise null.
 */
export function partialOf(it, u) {
  if (piRow(it) && it.form === 'num' && typeof u === 'number' && typeof it.answer === 'number' && it.answer !== 0) {
    return !isCorrect(it, u) && piNear(u, it.answer) && !predicted(it, u) ? 'pi-value' : null;
  }
  if (it?.form !== 'frac' || !it.reduced || u == null || typeof u !== 'object') return null;
  return near(u.n / u.d, it.answer, 1e-9) && !isCorrect(it, u) ? 'not-reduced' : null;
}

/**
 * Topics whose answers are measures written as decimals (a 3.14 value 62.8, a rounded length, a grid triangle's 6.5),
 * never as 314/5 or 13/2: statistics, Pythagoras and the measurement topics of stage 2 (§0.5).
 */
const DECIMAL_TOPICS = new Set(['stats', 'pyth', 'area', 'solid', 'circle', 'space']);
/** How a typed number is written back: decimals for those topics, a π ≈ 3.14 value and fmt: 'dec'; exact fractions up to /100 when precise. */
const numFormat = (it) => ({ decimal: DECIMAL_TOPICS.has(it.topic) || Number.isFinite(it.pk) || it.fmt === 'dec', maxDen: it.precise ? 100 : 12, places: it.precise || it.fmt === 'dec' ? 3 : 2 });

/** A number in a □π row as written: 25π, π for 1, −π for −1, 0 for 0. */
function withAfter(it, text) {
  const after = afterPlain(it.after);
  if (piRow(it) && (text === '1' || text === '-1')) return text === '1' ? after : `-${after}`;
  return text === '0' ? text : `${text}${after}`;
}

/** Answers as plain text, for the screen and for the AI. */
export function answerText(it, u = it.answer) {
  if (u == null) return '';
  if (it.form === 'manip') return manipText(it, u);
  if (it.form === 'mc') { const c = it.choices[u]; return c ? (c.text || c.tex) : ''; }
  if (it.form === 'pt') return `(${plainNum(u[0])}, ${plainNum(u[1])})`;
  // Statistics answers are means and medians, Pythagoras answers lengths: they read as decimals, as in the solution.
  // a line as a student writes it: y = x + 1, y = -x, y = 3 (never "1x" or "0x")
  if (it.form === 'line') return `y = ${linText({ k: u.m, c: u.b })}`;
  // an expression as a student writes it: 5x + 4, x - 3, -x, 7
  if (it.form === 'lin') return linText(u, it.var || 'x');
  // a fraction as written: the student's own n/d, or the answer in lowest terms
  if (it.form === 'frac') { const f = typeof u === 'object' ? u : toFrac(u); return f ? (typeof u !== 'object' && f.d === 1 ? String(f.n) : `${f.n}/${f.d}`) : plainNum(u, { maxDen: 100, places: 3 }); }
  const text = plainNum(u, numFormat(it));
  // a number typed before π (□π) is that many π: 25π
  return it.after && it.form === 'num' ? withAfter(it, text) : text;
}

/**
 * A display that states something itself is shown as it is: an equation, an inequality or a system, givens that
 * already say what is missing ("c = ?"), a list of numbers, a pair to compare or a table.
 */
const STATES = /\?|=|<|>|,|\\(?:le|ge|ne|leq|geq|neq|begin|quad|qquad)\b/;
/** The question's maths as shown: "3 + (-5) = ?" asks for a value; "3x + 5 = x + 11" and choices stand alone. */
export const displayTex = (it) => (!it.display ? '' : it.form === 'mc' || STATES.test(it.display) ? it.display : `${it.display} = \\,?`);

/** The exercise as one line of text for the AI and the teacher. */
/** The drawing in words, so the AI (and an answer key) sees every number the student saw. */
export function figPlain(f) {
  if (!f) return '';
  const pt = (p) => `${p.label || ''}(${p.x}, ${p.y})`;
  const kinds = { corresponding: 'מתאימות', alternate: 'מתחלפות', cointerior: 'חד־צדדיות' };
  switch (f.type) {
    case 'table': {
      // a highlighted row or cell ("the 4 shaded") and a row struck through are said after the rows
      const hl = (f.highlight || []).map((h) => (Array.isArray(h) ? String(f.rows[h[0]]?.[h[1]] ?? '') : f.rows[h]?.join(' → ') ?? '')).filter(Boolean);
      const crossed = (f.cross || []).map((i) => f.rows[i]?.join(' → ')).filter(Boolean);
      return `טבלה: ${f.rows.map((r) => r.join(' → ')).join('; ')}${hl.length ? `; מסומן: ${hl.join('; ')}` : ''}${crossed.length ? `; מחוק: ${crossed.join('; ')}` : ''}`;
    }
    // the data figures (curriculum stage 3, DATA-3): every number drawn, the axis, the marked and crossed things
    case 'chart': return chartWords(f);
    case 'outcomes': return outcomesWords(f);
    case 'pair': return (f.items || []).slice(0, 2).map((x, i) => `${f.titles?.[i] || `מקור ${i + 1}`}: ${figPlain(x)}`).join('; ');
    case 'coord': return [
      f.points?.length ? `נקודות: ${f.points.map(pt).join(', ')}` : '',
      f.line ? `ישר y = ${linText({ k: f.line.m, c: f.line.b })}` : '',
      f.lines?.length ? `ישרים: ${f.lines.map(lineText).join(', ')}` : '',
      f.polygon ? `מצולע: ${f.polygon.map(([x, y]) => `(${x}, ${y})`).join(' ')}` : '',
      // more of the plane in words from the kinds that register them (content/transform.js: shapes, arrows, a mirror, a turn)
      ...coordWords(f, 'plain'),
    ].filter(Boolean).join('; ');
    case 'linear': return `זוויות צמודות: זווית נתונה ${f.a}°`;
    case 'cross': return `ישרים נחתכים: זווית נתונה ${f.a}°, הזווית המבוקשת ${f.target === 'vertical' ? 'קודקודית לה' : 'צמודה לה'}`;
    case 'parallel': return `ישרים מקבילים וחותך: זווית נתונה ${f.a}°, הזווית המבוקשת ${kinds[f.kind] || ''} לה`;
    case 'triangle': return `משולש${f.iso ? ' שווה־שוקיים' : ''}: ${f.angles.map((x, i) => (f.show[i] ? `${x}°` : '?')).join(', ')}${f.exterior ? '; מבקשים זווית חיצונית ליד הזווית החסרה' : ''}`;
    case 'right': return `משולש ישר־זווית: ניצב ${f.a}, ניצב ${f.b}, יתר ${f.c}`;
    case 'ladder': return `סולם: גובה על הקיר ${f.wall}, מרחק מהקיר ${f.foot}, אורך הסולם ${f.len}`;
    case 'scale': return `מאזניים: בכף השמאלית ${panWords(f.left.x, f.left.n)}, בכף הימנית ${panWords(f.right.x, f.right.n)}; ${!f.tilt ? 'המאזניים מאוזנים' : f.tilt < 0 ? 'הכף השמאלית למטה' : 'הכף הימנית למטה'}`;
    case 'area': return `מלבן: גובה ${f.a}, אורך ${f.b ? `x ועוד ${f.b}` : 'x'}${f.areas ? `; שטחי החלקים ${plainNum(f.a)}x ו־${plainNum(f.a * f.b)}, השטח כולו ${areaTex(f)}` : ''}`;
    case 'ray': return `ציר מספרים: עיגול ${f.closed ? 'מלא' : 'ריק'} ב־${plainNum(f.at)} וקרן ${f.dir > 0 ? 'ימינה' : 'שמאלה'} (${rayText(f)})`;
    case 'tiles': return `אריחים: ${tilesWords(f)}`;
    // a situation graph (FUNC-1): its axes with their names, units and steps, each series' points in order, and what it
    // marks (points, bands on the x axis, guides, rise and run, where two lines meet): every number a sighted student reads
    case 'sgraph': return sgraphWords(f);
    // a protractor (FUNC-1.3b): arm by arm, the arm on a 0 first, each arm's two readings named by its scale, as a sighted
    // student sees them; a clock: its time (its hands drawn at their true angles)
    case 'protractor': return protractorWords(f);
    case 'clock': return `שעון: השעה ${clockText(f.h, f.m)}`;
    // a teaching drawing from named points (GEOM-1.5): what it marks, so the tutor and an answer key read it too: an
    // angle's text, a right angle, a labelled side, equal-side ticks ("_" starts a helper point's name: read without it).
    // A drawing that writes no angle's size is a measurement drawing (stage 2, MEASURE-1.5) when content/grid.js has
    // words for it: the grid and the shape's corners, circles and arcs, the parts taken away or added, the lengths
    // written on it, a right angle, its name. The angle stairs' drawings (CURRICULUM-10) always write an angle, so
    // they keep the reading angle by angle, each with its vertex.
    case 'geo': {
      const measured = (f.angles || []).some((g) => g.text) ? '' : figWords(f);
      if (measured) return measured;
      const nm = (k) => String(k).replace(/^_/, '');
      const marks = [
        ...(f.angles || []).filter((g) => g.text).map((g) => `∢${nm(g.at)} ${g.text}`),
        ...(f.angles || []).filter((g) => g.right).map((g) => `∢${nm(g.at)} ישרה`),
        ...(f.segs || []).filter((sg) => sg.label != null && sg.label !== '').map((sg) => `${nm(sg.a)}${nm(sg.b)} = ${sg.label}`),
        ...(f.segs || []).filter((sg) => sg.ticks).map((sg) => `${nm(sg.a)}${nm(sg.b)}: ${sg.ticks} סימונים`),
      ];
      return marks.length ? `שרטוט: ${marks.join(', ')}` : 'שרטוט';
    }
    // a proof as a still table (GEOM-3.9): the givens, what to prove, and each row's claim and reason ("?" where asked)
    case 'proof': {
      const strip = (t) => String(t ?? '').replace(/\$/g, '');
      const head = [f.given && `נתון: ${strip(f.given)}`, f.goal && `צ״ל: ${strip(f.goal)}`].filter(Boolean);
      const rows = f.rows.map((r, i) => `${i + 1}. ${strip(r.claim)} — ${i === f.ask ? '?' : strip(r.reason)}`);
      return `הוכחה. ${[...head, ...rows].join('; ')}`;
    }
    // the fraction figures (numline with parts, fbar, fgrid, dline, groups) and the teaching figures (STUDENT-8: numline,
    // thermo, machine, dots, bars) say in words what they draw
    default: return figWords(f);
  }
}

/** The question as the app shows it, for people: text with $...$ math, the expression, the drawing in words. */
export function itemMath(it) {
  const desc = figPlain(it.fig);
  return `${it.text || ''}${it.display ? ` $${it.display}$` : ''}${desc ? ` [${desc}]` : ''}`.trim();
}

export function itemPlain(it) {
  // π is read as π (25\pi is 25π), as answerText writes the answer
  const strip = (s) => String(s || '').replace(/[$\u2066\u2069]/g, '').replace(/\\pi(?![a-zA-Z])/g, 'π');
  const desc = figPlain(it.fig);
  const fig = desc ? ` [${desc}]` : '';
  // a choice that is a drawing (a net of a cube) is read by its name and the drawing's words
  const choices = it.form === 'mc' ? ` אפשרויות: ${it.choices.map((c) => (c.fig ? `${strip(c.text)} (${figPlain(c.fig)})` : c.text ? strip(c.text) : c.tex)).join(' / ')}` : '';
  const manip = it.form === 'manip' ? ` ${manipPlain(it)}` : '';
  // the answer row's form when something is drawn after the slot: the student types the number before π
  const row = it.form === 'num' && it.after ? ` [התשובה בצורה □${afterPlain(it.after)}]` : '';
  return `${strip(it.text)}${it.display ? ` ${strip(it.display)}` : ''}${fig}${choices}${manip}${row}`.trim();
}
