// Exams: scoring a checked exam, building a printable practice exam from the
// built-in generators (with an exact answer key), the teacher's class exam, and the improvement plan.
import { TOPIC, makeItem, answerText, itemPlain } from '@/content/index.js';
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
 * A practice exam drawn from the generators: questions spread over the chosen
 * topics, around each student's current level, stored with the exact answers.
 */
export function makePracticeExam(topicIds, count, progress = {}) {
  const ids = topicIds.filter((id) => TOPIC[id]);
  if (!ids.length) return [];
  const items = []; const seen = new Set();
  for (let i = 0; items.length < count && i < count * 6; i++) {
    const id = ids[items.length % ids.length]; const t = TOPIC[id];
    const cur = progress[id]?.level || 1;
    const level = Math.min(t.levels.length, Math.max(1, cur + [0, 0, 1, -1][items.length % 4]));
    const it = makeItem(id, level);
    if (seen.has(it.key)) continue;
    seen.add(it.key);
    items.push({
      key: it.key, topic: id, level, levelTitle: it.levelTitle, text: it.text, display: it.display || null, form: it.form,
      choices: it.choices || null, fig: it.fig || null, label: it.label || null, unit: it.unit || null,
      answer: answerText(it), plain: itemPlain(it), solution: it.solution, hint: it.hint,
    });
  }
  return items;
}

// ---------------------------------------------------------------- the class exam (spec TEACHER-3)
/** Lengths a teacher picks. */
export const CLASS_EXAM_LENGTHS = [6, 10, 14];
/**
 * Draws a stair gets before it counts as unprintable (every exercise dragged on the screen). The spec's 6 would skip a
 * stair that mixes forms now and then (coord:2 is about 60% dragging: seven in a row 3% of the time), so a stair is
 * given up only after 24 dragging draws in a row (under one in 100,000 for any stair the app has today).
 */
const MANIP_REDRAWS = 24;
/** Draws of one question before a key this exam (or the other version) already has is accepted again. */
const FRESH_TRIES = 60;

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
    fig: plainCopy(it.fig || null), label: it.label ?? null, unit: it.unit ?? null,
    var: it.form === 'lin' ? it.var || 'x' : null,
    exact: it.form === 'num' && Number.isFinite(it.exact) ? it.exact : null,
    answer: plainCopy(it.answer), answerText: answerText(it),
    solution: Array.isArray(it.solution) ? it.solution.map(String) : [], hint: it.hint ?? '',
  };
}

/** A frozen question back in the shape the lesson screen and isCorrect use (a class exam diagnoses nothing). */
export const thawItem = (frozen) => ({ ...frozen, diag: () => null });

/**
 * One question of a stair for a class exam: drawn as a mastery check draws (fairForCheck), never an exercise that is
 * dragged on the screen. A key in `seen` (this exam's, or the other version's) is drawn again, and accepted only when
 * the stair's generator has nothing else. null: only dragging exercises came out.
 */
function classQuestion(skill, seen) {
  let manip = 0; let repeat = null;
  for (let i = 0; i < FRESH_TRIES; i += 1) {
    const it = itemFor(skill, 'gen', Math.random, undefined, undefined, { test: true });
    if (it.form === 'manip') { manip += 1; if (manip >= MANIP_REDRAWS && !repeat) return null; continue; }
    manip = 0;
    if (!seen.has(examKey(it.key))) return it;
    repeat ||= it;
  }
  return repeat;
}

/**
 * A class practice exam (spec TEACHER-3 §1): `count` questions spread round-robin over the chosen stairs, each at the
 * stair's own level (not a student's). A stair whose exercises are all dragged on the screen cannot be printed: it is
 * left out and named in `skipped`. `avoid`: keys not to repeat (version ב is built with version א's keys).
 * Returns { items: frozen questions, skipped: stairs left out }.
 */
export function makeClassExam(skills, count, { avoid = [] } = {}) {
  const stairs = [...new Set(skills)].filter((s) => { const { topic, level } = parseSkill(s); return !!TOPIC[topic]?.levels[level - 1]; });
  const seen = new Set(avoid);
  const skipped = [];
  const gave = new Set();
  let live = [...stairs];
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

/** How many correct answers at the focus level complete a plan step (the ladder's slow lane). */
export const PLAN_WINS = 4;
const lost = (q) => (q.status === 'partial' ? 0.5 : q.status === 'correct' ? 0 : 1);

/**
 * The level a weak topic should be practised at: the level of the exam questions
 * that lost points (most points lost, then the lower level); null when no exam says.
 */
export function focusLevel(topic, exams = []) {
  const t = TOPIC[topic]; if (!t) return null;
  const by = {};
  exams.slice(0, 3).forEach((ex) => (ex.result?.questions || []).forEach((q) => {
    const lv = Number(q.level);
    if (q.topic === topic && lost(q) && lv >= 1 && lv <= t.levels.length) by[lv] = (by[lv] || 0) + lost(q);
  }));
  const best = Object.entries(by).sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
  return best ? Number(best[0]) : null;
}

/** Questions that lost points, for wording ("one question", "two questions"). */
export const lostCount = (qs) => qs.filter((q) => q.status !== 'correct').length;

/** Topics that need work: lost exam points weigh three times a practice mistake. */
export function weakTopics({ exams = [], mistakes = {} }) {
  const by = {};
  const add = (topic) => (by[topic] ||= { topic, examLost: 0, practice: 0, skills: new Set(), examQuestions: 0 });
  exams.slice(0, 3).forEach((ex) => (ex.result?.questions || []).forEach((q) => {
    if (!TOPIC[q.topic]) return;
    const w = add(q.topic); w.examQuestions += 1;
    if (lost(q)) { w.examLost += lost(q); w.examMissed = (w.examMissed || 0) + 1; if (q.skill) w.skills.add(q.skill); }
  }));
  Object.entries(mistakes).forEach(([k, v]) => { const topic = k.split(':')[0]; if (TOPIC[topic]) add(topic).practice += v; });
  return Object.values(by)
    .map((w) => ({ ...w, skills: [...w.skills], score: w.examLost * 3 + w.practice }))
    .filter((w) => w.score > 0)
    .sort((a, b) => b.score - a.score);
}

/** Correct answers in a topic at this level or above (climbing past the focus level counts too). */
export const winsFrom = (topic, level, wins = {}) => Object.entries(wins)
  .reduce((a, [k, v]) => { const [t, l] = k.split(':'); return t === topic && Number(l) >= level ? a + v : a; }, 0);

/** A plan baseline for one topic: its focus level and the wins already counted from there up. */
export const baseEntry = (topic, level, wins = {}, at = new Date().toISOString()) => ({ level, wins: winsFrom(topic, level, wins), at });

/**
 * The improvement plan: ordered, checkable steps built from the student's own data.
 * Each weak topic is practised from the level where the points were lost; the step is
 * done after PLAN_WINS correct answers at that level or above since it started (`base`).
 * The retest is done once an exam is checked after the plan last changed.
 */
export function buildPlan({ exams = [], mistakes = {}, progress = {}, streak = 0, base = {}, wins = {} }) {
  const weak = weakTopics({ exams, mistakes }).slice(0, 3);
  const steps = weak.map((w) => {
    const t = TOPIC[w.topic];
    const b = typeof base[w.topic] === 'object' ? base[w.topic] : null;
    const level = Math.min(t.levels.length, focusLevel(w.topic, exams) ?? b?.level ?? progress[w.topic]?.level ?? 1);
    const fresh = b?.level === level;
    const now = winsFrom(w.topic, level, wins);
    const have = Math.max(0, now - (fresh ? b.wins : now));
    const extra = w.skills.filter((k) => k !== t.levels[level - 1].title && k !== t.title).slice(0, 2);
    const why = w.examLost
      ? `ירדו נקודות ב${w.examMissed === 1 ? 'שאלה אחת' : `־${w.examMissed} שאלות`} במבחן${extra.length ? ` (${extra.join(', ')})` : ''}.`
      : `${w.practice === 1 ? 'טעות אחת' : `${w.practice} טעויות`} בתרגול בנושא הזה.`;
    return {
      id: `p-${w.topic}`, kind: 'practice', topic: w.topic, level, levelTitle: t.levels[level - 1].title,
      title: `${t.title}: ${t.levels[level - 1].title}`, why, have: Math.min(have, PLAN_WINS), need: PLAN_WINS,
      done: have >= PLAN_WINS, to: `/practice/${w.topic}?level=${level}&from=plan`,
    };
  });
  if (weak.length) {
    const ids = weak.map((w) => w.topic).join(',');
    const since = Math.max(0, ...weak.map((w) => Date.parse(base[w.topic]?.at || 0) || 0));
    const retested = since > 0 && exams.some((e) => Date.parse(e.at) > since);
    steps.push({ id: 'exam', kind: 'exam', title: 'מבחן תרגול חוזר על הנושאים האלה', why: 'כדי לראות שהשיפור נשאר. כדאי אחרי הצעדים הקודמים.', done: retested, to: `/exams/new?topics=${ids}` });
  }
  steps.push({ id: 'habit', kind: 'habit', title: '10 דקות תרגול ביום, 5 ימים ברצף', why: `עכשיו: ${streak} ${streak === 1 ? 'יום' : 'ימים'} ברצף.`, done: streak >= 5, to: '/' });
  return { steps, weak, done: steps.filter((s) => s.done).length };
}
