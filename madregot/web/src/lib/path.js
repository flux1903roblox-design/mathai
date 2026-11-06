// The learning path: each topic is a unit, each level a node, and a review node
// closes the unit. A node is done after PARTS lessons; the next one opens then.
// Students who climbed levels before the path existed keep them (progress.max).
import { TOPIC } from '@/content/index.js';
import { PARTS } from './lesson.js';

export const partsOf = (path, topic, level) => path?.[topic]?.parts?.[level] || 0;

/** Highest level whose node is done. */
export function doneUpTo(topic, path = {}, progress = {}) {
  const top = TOPIC[topic].levels.length;
  const legacy = Math.max((progress[topic]?.max || 1) - 1, 0); // levels passed on the old ladder
  const jumped = path?.[topic]?.jumped || 0;
  const done = (L) => L <= legacy || L <= jumped || partsOf(path, topic, L) >= PARTS;
  // Count from the start: a node is done only when every node before it is done too.
  let k = 0;
  while (k < top && done(k + 1)) k += 1;
  return k;
}

/** Every node of a unit with its state: done | current | locked, plus the review node. */
export function unitNodes(topic, path = {}, progress = {}) {
  const t = TOPIC[topic];
  const done = doneUpTo(topic, path, progress);
  const nodes = t.levels.map((L, i) => {
    const level = i + 1;
    const state = level <= done ? 'done' : level === done + 1 ? 'current' : 'locked';
    return { kind: 'node', topic, level, title: L.title, state, parts: state === 'done' ? PARTS : partsOf(path, topic, level) };
  });
  const allDone = done >= t.levels.length;
  nodes.push({ kind: 'review', topic, level: t.levels.length, title: 'חזרה על כל היחידה', state: allDone ? ((path?.[topic]?.reviews || 0) > 0 ? 'done' : 'current') : 'locked', parts: Math.min(path?.[topic]?.reviews || 0, 1) });
  return nodes;
}

/** The node to continue from: the first current node in grade order, else the first unit's review. */
export function nextNode(topics, path, progress) {
  for (const t of topics) {
    const cur = unitNodes(t.id, path, progress).find((n) => n.state === 'current');
    if (cur) return cur;
  }
  return null;
}

/** Record a finished lesson on the path; returns the new path and what it completed. */
export function recordOnPath(path = {}, r) {
  const u = { parts: {}, reviews: 0, jumped: 0, ...(path[r.topic] || {}) };
  let nodeDone = false;
  if (r.kind === 'review' && r.passed) u.reviews = (u.reviews || 0) + 1;
  else if (r.kind === 'jump' && r.passed) { u.jumped = Math.max(u.jumped || 0, r.level - 1); }
  else if (r.kind === 'node') {
    const before = u.parts[r.level] || 0;
    u.parts = { ...u.parts, [r.level]: Math.min(PARTS, before + 1) };
    nodeDone = before < PARTS && before + 1 >= PARTS;
  }
  const unitDone = r.kind === 'review' && r.passed && (path[r.topic]?.reviews || 0) === 0;
  return { path: { ...path, [r.topic]: u }, nodeDone, unitDone };
}
