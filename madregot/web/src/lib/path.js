// The learning path: each topic is a unit, each level a stair, and a review closes the unit.
//
// "Done" means mastered. A stair is done (drawn as done, counted in "X מתוך 5 מדרגות") only after its mastery check
// is passed; practice fills its ring, and two practice lessons lead to that check, but never mark it done.
// Stairs a student already had as done before this rule (practice on the old ladder, a placement or jump test) were
// kept as they were (v3 migration in lib/store.js) and are offered their mastery check; a kept stair whose mastery
// check is then failed is done no longer: it goes back to open, with its practice kept (reopenKept).
// The placement and jump tests let a student pass over stairs they seem to know: the path goes on after them, and
// they stay open (not done) until their mastery check. A stair mastered out of order (Exam Rescue sends a stair
// straight to its check) leaves the stairs before it open, not locked; the path still continues from the first one.
//
// path[topic] = { parts: { level: practice lessons }, reviews, jumped: highest level passed over, done: { level: 'mastered' | 'kept' } }
import { TOPIC, GUEST_STATE } from '@/content/index.js';
import { GUEST, parseSkill } from '@/learn/skills.ts';
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

/** The highest stair of a unit that is done (0 when none is). */
function highestDone(topic, path = {}) {
  for (let L = TOPIC[topic].levels.length; L >= 1; L -= 1) if (isDone(path, topic, L)) return L;
  return 0;
}

/**
 * Every stair of a unit with its state, plus the review: done (mastered) | open (passed over, its check waiting) |
 * current (the next stair to work on) | locked. A stair below one done out of order is open, never locked: a locked
 * stair always lies ahead of everything done.
 */
export function unitNodes(topic, path = {}) {
  const t = TOPIC[topic];
  const reached = reachedUpTo(topic, path);
  const top = highestDone(topic, path);
  const nodes = t.levels.map((L, i) => {
    const level = i + 1;
    const state = isDone(path, topic, level) ? 'done' : level <= reached ? 'open' : level === reached + 1 ? 'current' : level < top ? 'open' : 'locked';
    return { kind: 'node', topic, level, title: L.title, state, parts: Math.min(partsOf(path, topic, level), PARTS), kept: isKept(path, topic, level) };
  });
  const allPassed = reached >= t.levels.length;
  nodes.push({ kind: 'review', topic, level: t.levels.length, title: 'חזרה על כל היחידה', state: allPassed ? ((path?.[topic]?.reviews || 0) > 0 ? 'done' : 'current') : 'locked', parts: Math.min(path?.[topic]?.reviews || 0, 1) });
  return nodes;
}

/**
 * Stairs added to a unit after students had climbed it: saved progress is kept by topic and level, so the stairs before
 * keep their state and the new one becomes the current stair after them. Its card says why it is there.
 */
const ADDED_STAIRS = {
  'signed:6': 'נוספה מדרגה חדשה ליחידה: שברים ועשרוניים מכוונים.',
  'eq:6': 'נוספה מדרגה חדשה ליחידה: שאלות תנועה.',
  'eq:7': 'נוספה מדרגה חדשה ליחידה: משוואות עם מכנים ופרופורציה.',
};
/** The line a stair's card adds while it is the current stair and the stair before it is done; computed, never stored. */
export const addedStairNote = (n, path = {}) => (n?.kind === 'node' && n.state === 'current' && n.level > 1 && isDone(path, n.topic, n.level - 1)
  ? ADDED_STAIRS[`${n.topic}:${n.level}`] || null : null);

/**
 * What the class sync says about each guest stair (learn/skills.ts GUEST: eq:6 and eq:7 for ח׳, func:1 for ז׳): under the
 * stair's own id, { level, max } of GUEST_STATE, mastered when its mastery check is passed (done on the path), practised
 * when it has a practice lesson, a teaching stage or an answer; a stair not yet touched is not sent. Every guest stair is
 * sent, whatever the student's grade, so a teacher's guest row (content/index.js rowLevel) reads the stair itself and
 * never its unit's level.
 */
export function guestStairLevels(path = {}, learn = {}) {
  const out = {};
  for (const id of [...new Set(Object.values(GUEST).flat())]) {
    const { topic, level } = parseSkill(id);
    const rec = learn?.skills?.[id];
    const touched = partsOf(path, topic, level) > 0 || Object.keys(rec?.taught || {}).length > 0 || (rec?.attempts?.length || 0) > 0;
    const n = isDone(path, topic, level) ? GUEST_STATE.mastered : touched ? GUEST_STATE.practised : 0;
    if (n) out[id] = { level: n, max: n };
  }
  return out;
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

/**
 * A failed mastery check on a stair kept from before mastery checks: it is not done any more. It goes back to open
 * (reached, its check waiting), with its practice kept, and the path after it stays where it was.
 */
export function reopenKept(path = {}, topic, level) {
  if (!isKept(path, topic, level)) return path;
  const u = path[topic];
  const done = { ...u.done };
  delete done[level];
  return { ...path, [topic]: { ...u, done, jumped: Math.max(u.jumped || 0, level) } };
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

/** Right practice answers that complete a stair's practice stage, as its page counts them (and as nextStage reads them). */
export const PRACTICE_OK = 6;
const practiceShare = (rec, parts) => {
  const ok = (rec?.attempts || []).filter((a) => a.purpose === 'practice' && a.ok).length;
  return Math.min(1, Math.max((parts || 0) / PARTS, ok / PRACTICE_OK));
};

/** How far a stair is along its five stages (understand, example, together, practice, mastery check), 0..1: its ring. */
export function stairProgress(rec, parts) {
  const taught = ['A', 'B', 'C'].filter((k) => rec?.taught?.[k]).length;
  return (taught + practiceShare(rec, parts) + (rec?.mastered ? 1 : 0)) / 5;
}

/** Is a stair's practice stage done: its practice lessons, or enough right practice answers (its mastery check is next)? */
export const practiceComplete = (rec, parts) => practiceShare(rec, parts) >= 1;

export const STAIR_STAGES = 5;
/**
 * How many of a stair's five stages are done, a whole number: understanding, the worked examples and solving together
 * once finished, practice once its lessons are done, the mastery check once passed. A done stair (mastered, or kept
 * from before mastery checks) has all five. This is the counter that moves from the first stage of the first session.
 */
export function stagesDone(rec, parts, done = false) {
  if (done) return STAIR_STAGES;
  const taught = ['A', 'B', 'C'].filter((k) => rec?.taught?.[k]).length;
  return Math.min(STAIR_STAGES, taught + (practiceShare(rec, parts) >= 1 ? 1 : 0) + (rec?.mastered ? 1 : 0));
}

/**
 * A unit's progress for its counters: stairs done (mastered), and stages done across its stairs out of five per stair.
 * `skills` is learn.skills (the teaching stages and the mastery check live there).
 */
export function unitProgress(topic, path = {}, skills = {}) {
  const top = TOPIC[topic].levels.length;
  let stages = 0;
  for (let L = 1; L <= top; L += 1) stages += stagesDone(skills[`${topic}:${L}`], partsOf(path, topic, L), isDone(path, topic, L));
  return { done: doneCount(topic, path), stairs: top, stages, of: top * STAIR_STAGES };
}

/**
 * The count line of a unit, in words that move from the first stage: stairs done once there is one, before that the
 * stages done, and before anything the size of the unit.
 */
export function unitCountText({ done, stairs, stages, of }) {
  // a unit of one stair (a unit whose later stairs have not landed yet) says it in the singular
  if (done > 0) return stairs === 1 ? 'מדרגה אחת, שולטים בה' : `${done} מתוך ${stairs} מדרגות`;
  if (stages > 0) return `${stages} מתוך ${of} שלבים`;
  return stairs === 1 ? 'מדרגה אחת' : `${stairs} מדרגות`;
}

/** The treasure chest halfway along a unit: after this level, open once the stairs up to it are done. */
export const chestAfter = (topic) => Math.ceil(TOPIC[topic].levels.length / 2);
export const chestOpen = (topic, path = {}) => doneUpTo(topic, path) >= chestAfter(topic);
