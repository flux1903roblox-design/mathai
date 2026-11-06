// The level ladder: two correct in a row move up; after a mistake or a hint,
// four are needed. A question answered wrong returns three questions later.
import { TOPIC, makeItem, isCorrect } from '@/content/index.js';

export const FAST = 2;
export const NEED = 4;
export const RETURN_AFTER = 3;
export const GOAL_MINUTES = 10;

const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
export const needFor = (s) => (s.miss ? NEED : FAST);

export function startSession(topicId, saved = {}) {
  const top = TOPIC[topicId].levels.length;
  const level = clamp(saved.level || 1, 1, top);
  return {
    topicId, top, level, startLevel: level, max: Math.max(saved.max || 1, level),
    cnt: 0, miss: false, queue: [], served: 0,
    n: 0, correct: 0, firstTry: 0, levelUps: 0, cats: {},
    item: null, attempt: 1, hint: false, phase: 'answer', wrong: [], startedAt: Date.now(), itemStartedAt: Date.now(),
  };
}

export function nextQuestion(s) {
  const served = s.served + 1;
  const dueIdx = s.queue.findIndex((q) => served >= q.due);
  let item; let queue = s.queue;
  if (dueIdx >= 0) {
    item = { ...queue[dueIdx].item, returning: true, tries: queue[dueIdx].tries };
    queue = queue.filter((_, i) => i !== dueIdx);
  } else {
    let lv = s.level;
    // At the top level, one question in five reviews an earlier level.
    if (s.level === s.top && s.top > 1 && Math.random() < 0.2) lv = clamp(s.level - 1 - Math.floor(Math.random() * 3), 1, s.top - 1);
    item = makeItem(s.topicId, lv, s.item?.key);
  }
  return { ...s, served, queue, item, attempt: 1, hint: false, phase: 'answer', wrong: [], itemStartedAt: Date.now() };
}

export function withHint(s) {
  return { ...s, hint: true, miss: s.item.level === s.level ? true : s.miss };
}

/**
 * Grade an answer. Returns the next state and what happened:
 * { ok, first, retry, reveal, levelUp, cat, event }
 */
export function submit(s, u, display) {
  const it = s.item;
  const ok = isCorrect(it, u);
  const atLevel = it.level === s.level && !it.returning;
  const secs = Math.round((Date.now() - s.itemStartedAt) / 1000);
  if (ok) {
    const first = s.attempt === 1 && !s.hint;
    let { level, cnt, miss, max, levelUps } = s;
    let levelUp = false;
    if (atLevel) {
      cnt += 1;
      if (cnt >= (miss ? NEED : FAST) && level < s.top) {
        level += 1; cnt = 0; miss = false; levelUp = true; levelUps += 1; max = Math.max(max, level);
      }
    }
    const event = { topic: s.topicId, level: it.level, ok: true, first, hint: s.hint, cat: s.lastCat || null, secs, at: new Date().toISOString() };
    return {
      s: { ...s, level, cnt, miss, max, levelUps, n: s.n + 1, correct: s.correct + 1, firstTry: s.firstTry + (first ? 1 : 0), phase: 'done', lastCat: null },
      result: { ok: true, first, levelUp, event },
    };
  }
  const cat = it.diag ? it.diag(u) : null;
  const wrong = [...s.wrong, display];
  const cats = cat ? { ...s.cats, [cat]: (s.cats[cat] || 0) + 1 } : s.cats;
  // Bring the question back later, at most three times.
  const tries = (it.tries || 0) + 1;
  const queue = s.attempt === 1 && tries <= 3 ? [...s.queue, { item: { ...it, returning: false }, due: s.served + RETURN_AFTER, tries }] : s.queue;
  const base = { ...s, wrong, cats, queue, miss: atLevel ? true : s.miss, cnt: atLevel ? 0 : s.cnt, lastCat: cat || s.lastCat };
  if (s.attempt === 1) return { s: { ...base, attempt: 2, hint: true, phase: 'retry' }, result: { ok: false, retry: true, cat } };
  const event = { topic: s.topicId, level: it.level, ok: false, first: false, hint: s.hint, cat: cat || s.lastCat || null, secs, at: new Date().toISOString() };
  return { s: { ...base, n: s.n + 1, phase: 'revealed', lastCat: null }, result: { ok: false, reveal: true, cat, event } };
}
