// The learning path: each topic is a unit, each level a stair, and a review closes the unit.
//
// "Done" means mastered. A stair is done (drawn as done, counted in "X מתוך 5 מדרגות") only after its mastery check
// is passed; practice fills its ring, and two practice lessons lead to that check, but never mark it done.
// Stairs a student already had as done before this rule (practice on the old ladder, a placement or jump test) were
// kept as they were (v3 migration in lib/store.js) and are offered their mastery check.
// The placement and jump tests let a student pass over stairs they seem to know: the path goes on after them, and
// they stay open (not done) until their mastery check.
//
// path[topic] = { parts: { level: practice lessons }, reviews, jumped: highest level passed over, done: { level: 'mastered' | 'kept' } }
import { TOPIC } from '@/content/index.js';
import { PARTS } from './lesson.js';

export const partsOf = (path, topic, level) => path?.[topic]?.parts?.[level] || 0;
/** Is this stair done: its mastery check passed (or kept from before checks existed)? */
export const isDone = (path, topic, level) => !!path?.[topic]?.done?.[level];
/** Done only because it was kept from before mastery checks: its mastery check is still to be offered. */
export const isKept = (path, topic, level) => path?.[topic]?.done?.[level] === 'kept';

/** How many stairs of a unit are done (mastered): the "X מתוך 5 מדרגות" counter. */
export function doneCount(topic, path = {}) {
  const top = TOPIC[topic].levels.length;
  let n = 0;
  for (let L = 1; L <= top; L += 1) if (isDone(path, topic, L)) n += 1;
  return n;
}

/** The unbroken run of done stairs from the first one. */
export function doneUpTo(topic, path = {}) {
  const top = TOPIC[topic].levels.length;
  let k = 0;
  while (k < top && isDone(path, topic, k + 1)) k += 1;
  return k;
}

/** How far along the path goes on: stairs done, or passed over by a placement or jump test, counted from the start. */
export function reachedUpTo(topic, path = {}) {
  const top = TOPIC[topic].levels.length;
  const jumped = path?.[topic]?.jumped || 0;
  let k = 0;
  while (k < top && (isDone(path, topic, k + 1) || k + 1 <= jumped)) k += 1;
  return k;
}

/**
 * Every stair of a unit with its state, plus the review: done (mastered) | open (passed over, its check waiting) |
 * current (the next stair to work on) | locked.
 */
export function unitNodes(topic, path = {}) {
  const t = TOPIC[topic];
  const reached = reachedUpTo(topic, path);
  const nodes = t.levels.map((L, i) => {
    const level = i + 1;
    const state = isDone(path, topic, level) ? 'done' : level <= reached ? 'open' : level === reached + 1 ? 'current' : 'locked';
    return { kind: 'node', topic, level, title: L.title, state, parts: Math.min(partsOf(path, topic, level), PARTS), kept: isKept(path, topic, level) };
  });
  const allPassed = reached >= t.levels.length;
  nodes.push({ kind: 'review', topic, level: t.levels.length, title: 'חזרה על כל היחידה', state: allPassed ? ((path?.[topic]?.reviews || 0) > 0 ? 'done' : 'current') : 'locked', parts: Math.min(path?.[topic]?.reviews || 0, 1) });
  return nodes;
}

/** The node to continue from: the first current node in grade order. */
export function nextNode(topics, path) {
  for (const t of topics) {
    const cur = unitNodes(t.id, path).find((n) => n.state === 'current');
    if (cur) return cur;
  }
  return null;
}

/**
 * Record a finished lesson on the path; returns the new path and what it completed. A practice lesson adds a part
 * (practiceDone when the stair's practice is complete and its mastery check is next); a passed review closes the unit.
 */
export function recordOnPath(path = {}, r) {
  const u = { parts: {}, reviews: 0, jumped: 0, done: {}, ...(path[r.topic] || {}) };
  let practiceDone = false;
  if (r.kind === 'review' && r.passed) u.reviews = (u.reviews || 0) + 1;
  else if (r.kind === 'jump' && r.passed) { u.jumped = Math.max(u.jumped || 0, r.level - 1); }
  else if (r.kind === 'node') {
    const before = u.parts[r.level] || 0;
    u.parts = { ...u.parts, [r.level]: Math.min(PARTS, before + 1) };
    practiceDone = before < PARTS && before + 1 >= PARTS && !isDone(path, r.topic, r.level);
  }
  const unitDone = r.kind === 'review' && r.passed && (path[r.topic]?.reviews || 0) === 0;
  return { path: { ...path, [r.topic]: u }, practiceDone, unitDone };
}

/** A passed mastery check: the stair is done. Returns the new path and whether it just became done. */
export function markMastered(path = {}, topic, level) {
  const u = { parts: {}, reviews: 0, jumped: 0, done: {}, ...(path[topic] || {}) };
  const stairDone = !isDone(path, topic, level);
  return { path: { ...path, [topic]: { ...u, done: { ...(u.done || {}), [level]: 'mastered' } } }, stairDone };
}

/**
 * v3: the stairs a student had as done under the old rule (two practice lessons, the older ladder, a placement or jump
 * test, counted from the start) stay done, marked 'kept'; stairs whose mastery check was passed are 'mastered'.
 */
export function migratePath(path = {}, progress = {}, skills = {}) {
  const out = { ...path };
  Object.keys(TOPIC).forEach((topic) => {
    const top = TOPIC[topic].levels.length;
    const u = path[topic] || {};
    const legacy = Math.max((progress[topic]?.max || 1) - 1, 0);
    const jumped = u.jumped || 0;
    const oldDone = (L) => L <= legacy || L <= jumped || (u.parts?.[L] || 0) >= PARTS;
    const done = { ...(u.done || {}) };
    for (let L = 1; L <= top && oldDone(L); L += 1) if (!done[L]) done[L] = 'kept';
    for (let L = 1; L <= top; L += 1) if (skills[`${topic}:${L}`]?.mastered) done[L] = 'mastered';
    if (Object.keys(done).length || path[topic]) out[topic] = { parts: {}, reviews: 0, jumped: 0, ...u, done };
  });
  return out;
}

/** How far a stair is along its five stages (understand, example, together, practice, mastery check), 0..1: its ring. */
export function stairProgress(rec, parts) {
  const taught = ['A', 'B', 'C'].filter((k) => rec?.taught?.[k]).length;
  return (taught + Math.min(1, (parts || 0) / PARTS) + (rec?.mastered ? 1 : 0)) / 5;
}

/** The treasure chest halfway along a unit: after this level, open once the stairs up to it are done. */
export const chestAfter = (topic) => Math.ceil(TOPIC[topic].levels.length / 2);
export const chestOpen = (topic, path = {}) => doneUpTo(topic, path) >= chestAfter(topic);
