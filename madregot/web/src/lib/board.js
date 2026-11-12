// The level board: where the student stands in each topic of the grade, and what
// is not clear yet. A gap is a misconception the app diagnosed (or a question an
// exam marked wrong); it clears after GAP_CLEAR right first-try answers at its level.
import { TOPIC, topicsFor } from '@/content/topics.js';
import { unitNodes, doneCount, reachedUpTo } from './path.js';
import { PARTS } from './lessonRules.js';

export const GAP_CLEAR = 3;

/** Update the gaps with one graded answer. */
export function noteGap(gaps = {}, e) {
  if (!e?.topic) return gaps;
  if (!e.ok && e.cat) {
    const k = `${e.topic}:${e.cat}`;
    return { ...gaps, [k]: { ...(gaps[k] || {}), level: e.level, n: (gaps[k]?.n || 0) + 1, ok: 0, at: e.at || new Date().toISOString() } };
  }
  if (!e.ok || !e.first) return gaps;
  let out = gaps;
  Object.entries(gaps).forEach(([k, g]) => {
    if (k.startsWith(`${e.topic}:`) && g.level === e.level && g.ok < GAP_CLEAR) out = { ...out, [k]: { ...g, ok: g.ok + 1 } };
  });
  return out;
}

/** A checked exam: every question that lost points becomes a gap at its level. */
export function gapsFromExam(gaps = {}, exam) {
  let out = gaps;
  (exam?.result?.questions || []).forEach((q) => {
    const t = TOPIC[q.topic];
    if (!t || q.status === 'correct') return;
    const level = Math.min(t.levels.length, Math.max(1, Number(q.level) || 1));
    // A skill that only repeats the topic's name says nothing: name the level instead.
    const skill = q.skill && q.skill !== t.title ? q.skill : t.levels[level - 1].title;
    const text = String(skill).slice(0, 80);
    const k = `${q.topic}:exam:${text}`;
    out = { ...out, [k]: { level, n: (out[k]?.n || 0) + 1, ok: 0, at: exam.at || new Date().toISOString(), text, exam: true } };
  });
  return out;
}

/** The open gaps of a topic, most frequent first, and how many already cleared. */
export function gapsOf(topic, gaps = {}) {
  const t = TOPIC[topic];
  const open = []; let cleared = 0;
  Object.entries(gaps).forEach(([k, g]) => {
    if (!k.startsWith(`${topic}:`)) return;
    const cat = k.slice(topic.length + 1);
    const text = g.exam ? g.text : t.cats?.[cat];
    if (!text) return;
    if (g.ok >= GAP_CLEAR) { cleared += 1; return; }
    open.push({ id: k, text, level: g.level, n: g.n, ok: g.ok, exam: !!g.exam, at: g.at });
  });
  open.sort((a, b) => b.n - a.n || String(b.at).localeCompare(String(a.at)));
  return { open, cleared };
}

/** Where to practise a gap: its own level when it is open on the path, else the next node. */
export function gapTarget(topic, level, path = {}, progress = {}) {
  const done = reachedUpTo(topic, path);
  const top = TOPIC[topic].levels.length;
  if (level <= done) return `/lesson/${topic}/${level}?part=${PARTS}`;
  const cur = unitNodes(topic, path).find((n) => n.kind === 'node' && n.state === 'current');
  const L = cur?.level ?? Math.min(top, done + 1);
  return `/lesson/${topic}/${L}?part=${Math.min(PARTS, (cur?.parts || 0) + 1)}`;
}

/** The whole board for one grade. */
export function boardOf({ grade, path = {}, progress = {}, gaps = {}, placement = null }) {
  const topics = topicsFor(grade).map((t) => {
    const top = t.levels.length;
    const done = doneCount(t.id, path);
    const nodes = unitNodes(t.id, path);
    const current = nodes.find((n) => n.kind === 'node' && n.state === 'current') || null;
    const { open, cleared } = gapsOf(t.id, gaps);
    const status = done >= top ? 'done' : open.length ? 'work' : done === 0 && !current?.parts ? 'new' : 'going';
    const placed = placement?.grade === String(grade) ? placement.results?.[t.id]?.level ?? null : null;
    return { id: t.id, title: t.title, color: t.color, top, done, current, parts: current?.parts || 0, open, cleared, status, placed };
  });
  const done = topics.reduce((a, t) => a + t.done, 0);
  const total = topics.reduce((a, t) => a + t.top, 0);
  return { topics, done, total, open: topics.reduce((a, t) => a + t.open.length, 0) };
}
