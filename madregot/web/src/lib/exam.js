// Exams: scoring a checked exam, building a printable practice exam from the built-in generators (with an exact answer
// key), and reading where a checked exam lost points. What to strengthen after an exam is the ranked plan's exam-loss
// band (learn/next.ts), not a plan of its own.
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
