// What a checked exam says about practice (lib/exam.js re-exports it): the level of a weak topic to practise, the lost
// questions, and the topics that need work. In a file of its own, so the map's next step (learn/next.ts) reads it
// without lib/exam.js, whose exam making needs the exercise generators (the boot split, QA_DURABLE.md).
import { TOPIC } from '@/content/topics.js';

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
