// An exam question graded by the app against its own answer key (ai spec AI-8). On a practice exam the questions and
// the key are the app's: the exam check's model only reads the handwriting (q.studentAnswer is its transcription) and
// writes feedback; whether the final answer is right is decided here, in code, the way a lesson decides it. Where code
// cannot decide (nothing transcribed, a transcription it cannot read, an exercise that needs the screen), the question
// keeps the model's own status and says so: graded 'ai'.
//
//   num, pt     parseAnswer (shared/verify.js) on both sides, within 0.01 (0.05 when the exercise asks to round)
//   frac        (the curriculum lane's fractions) and a `precise` exercise: the value exactly, as a lesson compares it
//               (content/util.js numRight: a fraction, or a short decimal close enough for an answer with none)
//   mc          the letter the printed sheet shows (א, ב, ג …), or the text of a choice
//   line, lin   texToExpr and identical (learn/expr.ts): the two expressions agree at six probe values
import { parseAnswer } from '@shared/verify.js';
import { texToExpr, identical } from '@/learn/expr.ts';
import { numRight } from '@/content/util.js';

/** The letter the printed practice exam puts before choice k (PracticeExam.jsx, ExamResult.jsx: א = 0, ב = 1, ג = 2 …). */
export const choiceLetter = (k) => String.fromCharCode(1488 + k);

/** A transcription without its maths marks, direction marks and spacing. */
const bare = (s) => String(s ?? '').replace(/[$⁦-⁩‎‏]/g, '').replace(/\\[,;:! ]/g, ' ').replace(/[−–—]/g, '-').replace(/\s+/g, ' ').trim();

/** Same value: a number or a point [x, y], within tol. */
function sameAnswer(u, key, tol) {
  const near = (a, b) => Math.abs(a - b) <= tol + 1e-9;
  if (typeof key === 'number') return typeof u === 'number' && near(u, key);
  if (Array.isArray(key)) return Array.isArray(u) && near(u[0], key[0]) && near(u[1], key[1]);
  return false;
}

/** The choice a transcription names: its printed letter (with or without a dot or brackets), or its own text. null: neither. */
function choiceOf(said, choices) {
  const letter = bare(said).replace(/^(?:תשובה|אפשרות)\s*/, '').replace(/[.)(:׳'"\s]/g, '');
  const k = letter.length === 1 ? letter.charCodeAt(0) - 1488 : -1;
  if (k >= 0 && k < choices.length) return k;
  const flat = (s) => bare(s).replace(/\s+/g, '');
  const named = choices.findIndex((c) => flat(c.text || c.tex) === flat(said));
  return named >= 0 ? named : null;
}

/** An expression as written ("$12 + 3x$", "y = -3 + 2x"), right-hand side only when `rhs`; null when it cannot be read. */
function exprOf(s, rhs) {
  let t = bare(s);
  if (rhs && t.includes('=')) {
    const [lhs, ...rest] = t.split('=');
    if (rest.length !== 1 || !/^\s*y\s*$/i.test(lhs)) return null;
    t = rest[0];
  }
  try { return texToExpr(t.trim()); } catch { return null; }
}

/**
 * Grade one exam question against the practice exam's own item (lib/exam.js: answer is answerText(it), with form and
 * choices). → the question with graded 'key' and the code's status (overridden: true when it differs from the
 * model's), or the question as it was with graded 'ai'. A right final answer is 'correct'; a wrong one is 'wrong',
 * except that a model's 'partial' stays partial (the working earned part of the marks).
 */
export function gradeByKey(q, item) {
  const ai = { ...q, graded: 'ai' };
  const said = String(q?.studentAnswer ?? '').trim();
  if (!item || !said || item.answer == null) return ai;
  const tol = /עגלו/.test(String(item.text || '')) ? 0.05 : 0.01;
  let ok;
  if (item.form === 'num' || item.form === 'pt' || item.form === 'frac' || !item.form) {
    const u = parseAnswer(said); const key = parseAnswer(item.answer);
    if (u == null || key == null) return ai;
    ok = (item.form === 'frac' || item.precise === true) && typeof key === 'number' ? numRight(u, key, true) : sameAnswer(u, key, tol);
  } else if (item.form === 'mc') {
    const choices = Array.isArray(item.choices) ? item.choices : [];
    const key = choices.findIndex((c) => (c.text || c.tex) === item.answer);
    const u = choiceOf(said, choices);
    if (key < 0 || u == null) return ai;
    ok = u === key;
  } else if (item.form === 'line' || item.form === 'lin') {
    const line = item.form === 'line';
    const u = exprOf(said, line); const key = exprOf(item.answer, line);
    if (!u || !key) return ai;
    // the letter of the key (a stored practice item keeps the expression, not its var: "7n + 5"); another letter in the
    // transcription cannot be compared, so it stays the model's
    const names = line ? ['x'] : item.var ? [item.var] : [...new Set(String(item.answer).match(/[a-z]/gi) || ['x'])];
    try { ok = identical(u, key, names); } catch { return ai; }
  } else {
    // an exercise that needs the screen (manip) is never printed; if one is, the app cannot read it from a page
    return ai;
  }
  const status = ok ? 'correct' : q.status === 'partial' ? 'partial' : 'wrong';
  return { ...q, status, graded: 'key', overridden: status !== q.status };
}

/**
 * Every question of a checked exam, graded by key where the practice exam's items match the questions one for one;
 * otherwise (another number of questions, or an uploaded exam with no key) every question keeps the model's status,
 * graded 'ai'. `enrich(q, item)` adds what the screen keeps of the app's item before grading.
 */
export function gradeExam(questions, practice, enrich = (q) => q) {
  const qs = Array.isArray(questions) ? questions : [];
  if (!practice || qs.length !== practice.items.length) return qs.map((q) => ({ ...q, graded: 'ai' }));
  return qs.map((q, i) => gradeByKey(enrich(q, practice.items[i]), practice.items[i]));
}

/** How a stored question was graded; an exam stored before AI-8 has no mark, and its questions were graded by the AI. */
export const gradedBy = (q) => (q?.graded === 'key' ? 'key' : 'ai');
