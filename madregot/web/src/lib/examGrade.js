// An exam question graded by the app against its own answer key (ai spec AI-8). On a practice exam the questions and
// the key are the app's: the exam check's model only reads the handwriting (q.studentAnswer is its transcription) and
// writes feedback; whether the final answer is right is decided here, in code, by the rule a lesson uses (content/
// index.js isCorrect, with the flags the practice exam stored: exact, precise, reduced, askDec and the letter). Where
// the lesson's rule cannot decide (nothing transcribed, a transcription it cannot read, a fraction where the question
// asks for a decimal, an exercise that needs the screen), the question keeps the model's own status and says so:
// graded 'ai'.
//
//   num         parseAnswer (shared/verify.js) and isCorrect: within 0.01; exactly when `precise` (content/util.js
//               numRight); a length rounded to tenths against its exact value (`exact`), never the rounded key
//   frac        the fraction as written, { n, d }: its value exactly, and in lowest terms when `reduced`
//   pt          the point exactly
//   mc          the letter the printed sheet shows (א, ב, ג …), or the text of a choice
//   line, lin   texToExpr and identical (learn/expr.ts): the two expressions agree at six probe values
// A practice exam stored before it kept the lesson's answer (`value`) is graded as it was then: its printed key read
// back, within 0.01 (0.05 when the exercise asks to round).
import { parseAnswer } from '@shared/verify.js';
import { texToExpr, identical } from '@/learn/expr.ts';
import { numRight } from '@/content/util.js';
import { isCorrect } from '@/content/index.js';

/** The letter the printed practice exam puts before choice k (PracticeExam.jsx, ExamResult.jsx: א = 0, ב = 1, ג = 2 …). */
export const choiceLetter = (k) => String.fromCharCode(1488 + k);

/** A transcription without its maths marks, direction marks and spacing. */
const bare = (s) => String(s ?? '').replace(/[$⁦-⁩‎‏]/g, '').replace(/\\[,;:! ]/g, ' ').replace(/[−–—]/g, '-').replace(/\s+/g, ' ').trim();

/** "2,000" or "-1,250,000": groups of three digits after each comma, which an Israeli reader reads as thousands. */
const THOUSANDS = /^[+-]?\d{1,3}(,\d{3})+$/;

/** A unit written after a number on paper: "8.2 ס״מ", "1490 מגה־בייט", "35%", "120°", "12 ₪" (Hebrew words, %, °, ₪). */
const UNIT_AFTER = /(\d)\s*(?:\\%|%|°|\^\{?\\circ\}?|₪|[\u05D0-\u05EA][\u0590-\u05FF"'.\s-]*)\s*$/;

/**
 * Every number a transcription can mean, as a lesson reads a typed answer (content/util.js readNumCandidates): a unit
 * after it is left out (the question names it), a mixed number in TeX (5\frac{1}{3}) is read as "5 1/3", and "2,000"
 * is 2 (a decimal comma) or 2000 (thousands). A point, or nothing readable, gives [].
 */
function numbersOf(said) {
  const t = String(said ?? '').replace(/[$⁦-⁩‎‏]/g, '').trim().replace(UNIT_AFTER, '$1').replace(/(\d)\s*\\[dt]?frac\s*\{(\d+)\}\s*\{(\d+)\}/g, '$1 $2/$3');
  const one = parseAnswer(t);
  if (typeof one !== 'number') return [];
  const flat = bare(t).replace(/^[a-zA-Z]\s*=\s*/, '');
  return THOUSANDS.test(flat) ? [...new Set([one, Number(flat.replace(/,/g, ''))])] : [one];
}

/** A fraction as written, { n, d } with whole numbers ("-3/4", "\frac{3}{4}", "1 1/2", a whole number), else null. */
function fractionOf(said) {
  const t = bare(String(said ?? '').replace(/\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, ' $1/$2 ')).replace(/^[a-zA-Z]\s*=\s*/, '').replace(/\s*\/\s*/g, '/').replace(/^([+-])\s+/, '$1').trim();
  let m = t.match(/^([+-]?)(\d+)$/);
  if (m) return { n: (m[1] === '-' ? -1 : 1) * Number(m[2]), d: 1 };
  m = t.match(/^([+-]?)(\d+) (\d+)\/(\d+)$/);
  if (m) { const d = Number(m[4]); return d ? { n: (m[1] === '-' ? -1 : 1) * (Number(m[2]) * d + Number(m[3])), d } : null; }
  m = t.match(/^([+-]?)(-?\d+)\/(-?\d+)$/);
  if (!m) return null;
  let n = Number(m[2]); let d = Number(m[3]);
  if (!d) return null;
  if (m[1] === '-') n = -n;
  // a minus in the denominator moves up, as the lesson reads it
  return d < 0 ? { n: n === 0 ? 0 : -n, d: -d } : { n, d };
}

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
 * Grade one exam question against the practice exam's own item (lib/exam.js: answer is answerText(it), value the
 * answer a lesson checks, with form, choices and the checking flags). → the question with graded 'key' and the code's
 * status (overridden: true when it differs from the model's), or the question as it was with graded 'ai'. A right
 * final answer is 'correct'; a wrong one is 'wrong', except that a model's 'partial' stays partial (the working earned
 * part of the marks).
 */
export function gradeByKey(q, item) {
  const ai = { ...q, graded: 'ai' };
  const said = String(q?.studentAnswer ?? '').trim();
  if (!item || !said || item.answer == null) return ai;
  const ok = item.value !== undefined ? byLesson(said, item) : byPrintedKey(said, item);
  if (ok == null) return ai;
  const status = ok ? 'correct' : q.status === 'partial' ? 'partial' : 'wrong';
  return { ...q, status, graded: 'key', overridden: status !== q.status };
}

/** The choice a transcription names, against the key's index: true, false, or null (it names none). */
function byChoice(said, item, key) {
  const choices = Array.isArray(item.choices) ? item.choices : [];
  const u = choiceOf(said, choices);
  if (key < 0 || key >= choices.length || u == null) return null;
  return u === key;
}

/** An expression or a line against the key (the letter the question uses): true, false, or null (unreadable). */
function byExpression(said, item) {
  const line = item.form === 'line';
  const u = exprOf(said, line); const key = exprOf(item.answer, line);
  if (!u || !key) return null;
  // the letter of the key (a practice item stored before it kept its var has only the expression: "7n + 5"); another
  // letter in the transcription cannot be compared, so it stays the model's
  const names = line ? ['x'] : item.var ? [item.var] : [...new Set(String(item.answer).match(/[a-z]/gi) || ['x'])];
  try { return identical(u, key, names); } catch { return null; }
}

/** Graded as the lesson grades the stored question (isCorrect on its `value`): true, false, or null (the lesson cannot read it). */
function byLesson(said, item) {
  const lesson = { ...item, answer: item.value };
  switch (item.form) {
    case 'mc': return byChoice(said, item, Number.isInteger(item.value) ? item.value : -1);
    case 'line': case 'lin': return byExpression(said, item);
    case 'pt': { const u = parseAnswer(said); return Array.isArray(u) ? isCorrect(lesson, u) : null; }
    case 'frac': {
      // the question takes a fraction (two whole numbers): a decimal is not an answer the lesson can read
      const u = fractionOf(said);
      return u ? isCorrect(lesson, u) : null;
    }
    case 'num': {
      // a question that asks for a decimal does not read a fraction (content/index.js readAnswer)
      if (item.askDec && /\/|\\[dt]?frac/.test(said)) return null;
      const us = numbersOf(said);
      return us.length ? us.some((u) => isCorrect(lesson, u)) : null;
    }
    // an exercise that needs the screen (manip) is never printed; if one is, the app cannot read it from a page
    default: return null;
  }
}

/** A practice exam stored before it kept `value`: its printed key read back, as it was graded then. */
function byPrintedKey(said, item) {
  const tol = /עגלו/.test(String(item.text || '')) ? 0.05 : 0.01;
  if (item.form === 'num' || item.form === 'pt' || item.form === 'frac' || !item.form) {
    const u = parseAnswer(said); const key = parseAnswer(item.answer);
    if (u == null || key == null) return null;
    return (item.form === 'frac' || item.precise === true) && typeof key === 'number' ? numRight(u, key, true) : sameAnswer(u, key, tol);
  }
  if (item.form === 'mc') {
    const choices = Array.isArray(item.choices) ? item.choices : [];
    return byChoice(said, item, choices.findIndex((c) => (c.text || c.tex) === item.answer));
  }
  if (item.form === 'line' || item.form === 'lin') return byExpression(said, item);
  return null;
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
