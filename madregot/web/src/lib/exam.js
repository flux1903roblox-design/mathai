// Exams: scoring a checked exam, building a printable practice exam from the
// built-in generators (with an exact answer key), and the improvement plan.
import { TOPIC, makeItem, answerText, itemPlain } from '@/content/index.js';

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
