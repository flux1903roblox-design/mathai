// Exams: scoring a checked exam, building a printable practice exam from the built-in generators (with an exact answer
// key), the teacher's class exam, and reading where a checked exam lost points. What to strengthen after an exam is the
// ranked plan's exam-loss band (learn/next.ts), not a plan of its own.
import { TOPIC, makeItem, answerText, itemPlain, fairForCheck, gensReady } from '@/content/index.js';
import { itemFor } from '@/learn/items.ts';
import { parseSkill } from '@/learn/skills.ts';

export const STATUS = {
  correct: { label: 'נכון', tone: 'ok' },
  partial: { label: 'נכון בחלקו', tone: 'mid' },
  wrong: { label: 'טעות', tone: 'bad' },
  missing: { label: 'לא נענה', tone: 'bad' },
};

/** Partial answers count half. */
export function scoreOf(result) {
  const qs = result?.questions || [];
  const total = qs.length;
  const correct = qs.reduce((a, q) => a + (q.status === 'correct' ? 1 : q.status === 'partial' ? 0.5 : 0), 0);
  return { correct, total, pct: total ? Math.round((100 * correct) / total) : 0 };
}

/**
 * Words that ask for something only the screen can do: tap, drag, turn, place, move, take off the pans. A printed
 * question never says them (makePracticeExam, makeClassExam).
 */
export const SCREEN_WORDS = /הקישו|גררו|סובבו|שימו|הזיזו|הורידו מהכפות/;

/**
 * Can this question be printed and answered with pen and paper? Not an object moved on the screen (form 'manip': a
 * point plotted, a ray turned, a balance whose pans are emptied, a bar dragged), not a practice-only question (two or
 * three choices, or a target the question names), and nothing that asks to tap, drag or move. The student's practice
 * exam and the teacher's class exam both draw through it.
 */
export function printable(it) {
  return !!it && it.form !== 'manip' && !it.practiceOnly && !SCREEN_WORDS.test(String(it.text ?? ''));
}

/**
 * How a typed number is answered beside its label and unit (stage 2, MEASURE-1 item 4): `after`, maths drawn after the
 * slot ('\\pi': the number before π is typed, 25 for 25π), and `pk`, the multiple of π of an answer computed with
 * π ≈ 3.14 (right within half a tenth of 3.14·pk or of π·pk). Only what the item has.
 */
const answerForm = (it) => ({
  ...(it.form === 'num' && typeof it.after === 'string' && it.after ? { after: it.after } : {}),
  ...(it.form === 'num' && Number.isFinite(it.pk) ? { pk: it.pk } : {}),
});

/**
 * Draws a stair gets before it counts as unprintable (every exercise needs the screen, or is practice-only). The spec's 6 would skip a
 * stair that mixes forms now and then (coord:2 is about 60% dragging: seven in a row 3% of the time), so a stair is
 * given up only after 24 dragging draws in a row (under one in 100,000 for any stair the app has today).
 */
const MANIP_REDRAWS = 24;
/** Draws of one question before a key this exam (or the other version) already has is accepted again. */
const FRESH_TRIES = 60;

/**
 * One printable question from `draw`, whose key is not in `seen`. null when only unprintable questions came out
 * (MANIP_REDRAWS in a row), or, unless `repeat` allows it, when only keys already in `seen` did; with `repeat`, a
 * question already asked is the last resort (the generator has nothing else). `fair`: a further test a question must
 * pass (the practice exam asks only what a check would, content/index.js fairForCheck).
 */
function printableQuestion(draw, seen, { repeat = false, fair = null } = {}) {
  let unprintable = 0; let again = null;
  for (let i = 0; i < FRESH_TRIES; i += 1) {
    const it = draw();
    if (!printable(it) || (fair && !fair(it))) { unprintable += 1; if (unprintable >= MANIP_REDRAWS && !again) return null; continue; }
    unprintable = 0;
    if (!seen.has(examKey(it.key))) return it;
    again ||= it;
  }
  return repeat ? again : null;
}

/**
 * A practice exam drawn from the generators: questions spread over the chosen topics, around each student's current
 * level, every one printable (printable(): nothing dragged on the screen, no practice-only question). Each question is
 * kept as the class exam keeps it (freezeItem: the checking flags exact, precise, reduced and askDec, and an
 * expression's letter), with `answer` the key as printed (answerText) and `value` the answer the lesson checks, so a
 * photographed exam is graded by the lesson's own rule (lib/examGrade.js). A level with nothing printable left gives
 * its place to the nearest level of the topic that has.
 */
export function makePracticeExam(topicIds, count, progress = {}) {
  // a unit whose generators have not loaded (content/topics.js loadGens) is left out: the screen waits for ensureGens
  // first, so this happens only offline before the unit was ever kept
  const ids = [...new Set(topicIds)].filter((id) => TOPIC[id] && gensReady(id));
  if (!ids.length) return [];
  const items = []; const seen = new Set();
  let live = [...ids];
  while (items.length < count && live.length) {
    const id = live[items.length % live.length]; const t = TOPIC[id];
    const cur = progress[id]?.level || 1;
    const want = Math.min(t.levels.length, Math.max(1, cur + [0, 0, 1, -1][items.length % 4]));
    // the level asked for, then the others nearest to it
    const levels = t.levels.map((_, i) => i + 1).sort((a, b) => Math.abs(a - want) - Math.abs(b - want) || a - b);
    let it = null;
    // only what a check would ask (fairForCheck: no practice-only question, whose choices or named target give it away)
    for (const level of levels) { it = printableQuestion(() => makeItem(id, level), seen, { fair: fairForCheck }); if (it) break; }
    if (!it) { live = live.filter((x) => x !== id); continue; }
    const p = practiceItem(it);
    seen.add(p.key);
    items.push(p);
  }
  return items;
}

/**
 * A question as the practice exam keeps it: frozen as the class exam freezes it, with `answer` the key as printed
 * (answerText), `value` the answer the lesson checks (a number, a point, { k, c }, { m, b } or a choice's index) and
 * `plain` the question in words for the exam check.
 */
export function practiceItem(it) {
  const f = freezeItem(it);
  return { ...f, answer: answerText(it), value: f.answer, plain: itemPlain(it) };
}

// ---------------------------------------------------------------- the class exam (spec TEACHER-3)
/** Lengths a teacher picks. */
export const CLASS_EXAM_LENGTHS = [6, 10, 14];
const plainCopy = (v) => (v == null ? null : JSON.parse(JSON.stringify(v)));
/** FNV-1a, 32 bits, as 8 hex digits: a short, stable stand-in for the end of a long key. */
function fnv(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}
/** A question's key as the class exam keeps it: at most 80 characters (the server's limit); a longer one ends in its hash. */
export const examKey = (key) => { const k = String(key); return k.length <= 80 ? k : `${k.slice(0, 64)}~${fnv(k)}`; };

/**
 * A question as the class exam keeps it: plain JSON with every field the screens and isCorrect read (no diag, no
 * diagnosis, no functions). `exact` is the exact length behind a rounded Pythagoras answer, so 7.07 stays right for
 * √50; `var` is an expression's letter. The same shape is what the server stores (worker/src/assignments.js).
 */
export function freezeItem(it) {
  return {
    key: examKey(it.key), topic: it.topic, level: Number(it.level), levelTitle: it.levelTitle ?? null,
    text: it.text ?? '', display: it.display || null, form: it.form,
    choices: Array.isArray(it.choices) ? it.choices.map((c) => ({ ...(c.text != null ? { text: String(c.text) } : {}), ...(c.tex != null ? { tex: String(c.tex) } : {}) })) : null,
    fig: plainCopy(it.fig || null), label: it.label ?? null, unit: it.unit ?? null, ...answerForm(it),
    var: it.form === 'lin' ? it.var || 'x' : null,
    exact: it.form === 'num' && Number.isFinite(it.exact) ? it.exact : null,
    // how the answer is checked and written (the curriculum lane's flags: content/index.js isCorrect, readAnswer): a
    // fraction in lowest terms, a number compared exactly, a decimal asked for, a decimal shown
    ...(it.reduced === true ? { reduced: true } : {}), ...(it.precise === true ? { precise: true } : {}),
    ...(it.askDec === true ? { askDec: true } : {}), ...(it.fmt === 'dec' ? { fmt: 'dec' } : {}),
    answer: plainCopy(it.answer), answerText: answerText(it),
    solution: Array.isArray(it.solution) ? it.solution.map(String) : [], hint: it.hint ?? '',
  };
}

/** A frozen question back in the shape the lesson screen and isCorrect use (a class exam diagnoses nothing). */
export const thawItem = (frozen) => ({ ...frozen, diag: () => null });

/**
 * One question of a stair for a class exam: drawn as a mastery check draws (fairForCheck), and printable (never an
 * exercise that is dragged on the screen). A key in `seen` (this exam's, or the other version's) is drawn again, and
 * accepted only when the stair's generator has nothing else. null: only unprintable exercises came out.
 */
const classQuestion = (skill, seen) => printableQuestion(() => itemFor(skill, 'gen', Math.random, undefined, undefined, { test: true }), seen, { repeat: true });

/**
 * A class practice exam (spec TEACHER-3 §1): `count` questions spread round-robin over the chosen stairs, each at the
 * stair's own level (not a student's). A stair whose exercises are all dragged on the screen cannot be printed: it is
 * left out and named in `skipped`, as is one whose unit's generators could not load. `avoid`: keys not to repeat (version ב is built with version א's keys).
 * Returns { items: frozen questions, skipped: stairs left out }.
 */
export function makeClassExam(skills, count, { avoid = [] } = {}) {
  const stairs = [...new Set(skills)].filter((s) => { const { topic, level } = parseSkill(s); return !!TOPIC[topic]?.levels[level - 1]; });
  const seen = new Set(avoid);
  // a stair whose unit's generators have not loaded (content/topics.js loadGens; ExamNew waits for ensureGens) is named too
  const skipped = stairs.filter((s) => !gensReady(parseSkill(s).topic));
  const gave = new Set();
  let live = stairs.filter((s) => !skipped.includes(s));
  const items = [];
  while (items.length < count && live.length) {
    const skill = live[items.length % live.length];
    const it = classQuestion(skill, seen);
    if (!it) {
      // named only when it gave nothing printable at all
      if (!gave.has(skill)) skipped.push(skill);
      live = live.filter((s) => s !== skill);
      continue;
    }
    gave.add(skill);
    const f = freezeItem(it);
    seen.add(f.key);
    items.push(f);
  }
  return { items, skipped };
}

/** "מבחן תרגול: מספרים מכוונים, מערכת צירים" (the topics of the stairs, in order, at most 80 characters). */
export function classExamTitle(skills) {
  const topics = [...new Set(skills.map((s) => parseSkill(s).topic))].filter((t) => TOPIC[t]);
  return `מבחן תרגול: ${topics.map((t) => TOPIC[t].title).join(', ')}`.slice(0, 80);
}

// Reading checked exams (the level to practise, the weak topics) lives in lib/examFocus.js, which the map's next step
// reads without this file (the boot split: making an exam needs the exercise generators, which load with it).
export { focusLevel, lostCount, weakTopics } from './examFocus.js';
