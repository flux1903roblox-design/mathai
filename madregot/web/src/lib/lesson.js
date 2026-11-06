// A lesson: a short, fixed run of exercises (about 3–5 minutes).
// Wrong once: try again with a hint. Wrong twice: see the answer and the steps,
// and a similar exercise comes back at the end of the lesson. The lesson ends
// when every slot has been answered correctly (each slot can come back twice at most).
import { TOPIC, makeItem, isCorrect } from '@/content/index.js';
import { startPlacement, placementAnswer, placementNext, placementProgress, placementResult } from './placement.js';

export const LESSON_LEN = 8;
export const REVIEW_LEN = 10;
export const JUMP_LEN = 5;
export const JUMP_MISTAKES = 1; // a jump test allows one mistake
export const PARTS = 2; // lessons that complete a node on the path
export const REDO_MAX = 2;
export const XP = { lesson: 10, review: 15, jump: 10, perfect: 5, fix: 2 }; // fix: each mistake corrected at the end of a lesson
export const COMBO_MARKS = [5, 10];

const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

/** The level of each exercise in a lesson. */
export function planLevels({ kind, topic, level, part = 1, max = level }) {
  const top = TOPIC[topic].levels.length;
  const L = Math.min(Math.max(level, 1), top);
  if (kind === 'jump') return Array(JUMP_LEN).fill(L);
  if (kind === 'review') {
    // Mixed practice over every level reached so far: spaced and interleaved.
    const upTo = Math.min(Math.max(max, 1), top);
    const pool = Array.from({ length: upTo }, (_, i) => i + 1);
    const out = Array.from({ length: REVIEW_LEN }, (_, i) => pool[i % pool.length]);
    return shuffle(out);
  }
  const out = Array(LESSON_LEN).fill(L);
  // The second lesson of a node mixes in two exercises from earlier levels.
  if (part >= 2 && L > 1) { out[2] = Math.max(1, L - 1); out[5] = Math.max(1, L - 1 - Math.floor(Math.random() * Math.min(2, L - 1))); }
  return out;
}

export function startLesson(opts) {
  if (opts.kind === 'placement') return startPlacement(opts);
  const levels = planLevels(opts);
  return {
    kind: opts.kind || 'node', topic: opts.topic, level: opts.level, part: opts.part || 1,
    levels, slot: 0, total: levels.length, solved: 0, redo: [], redoing: false,
    item: makeItem(opts.topic, levels[0]), attempt: 1, hint: false, phase: 'answer', wrong: [],
    combo: 0, bestCombo: 0, firstTry: 0, mistakes: 0, fixed: 0, missedSlots: [], cats: {}, lastCat: null,
    finished: false, failed: false, startedAt: Date.now(), itemStartedAt: Date.now(),
  };
}

export const withHint = (s) => ({ ...s, hint: true });

/** Share of the lesson already solved, 0..1 (only a correct answer moves the bar). */
export const progressOf = (s) => (s.kind === 'placement' ? placementProgress(s) : s.total ? s.solved / s.total : 0);

/**
 * Grade an answer. Returns { s, result } where result is
 * { ok, first, retry, reveal, combo, comboMark, cat, event }.
 */
export function answer(s, u) {
  if (s.kind === 'placement') return placementAnswer(s, u);
  const it = s.item;
  const ok = isCorrect(it, u);
  const secs = Math.round((Date.now() - s.itemStartedAt) / 1000);
  const base = { topic: s.topic, level: it.level, hint: s.hint, secs, at: new Date().toISOString() };
  if (ok) {
    const first = s.attempt === 1 && !s.hint && !it.redo;
    const combo = first ? s.combo + 1 : 0;
    const comboMark = first && COMBO_MARKS.includes(combo) ? combo : null;
    return {
      s: { ...s, phase: 'correct', combo, bestCombo: Math.max(s.bestCombo, combo), firstTry: s.firstTry + (first ? 1 : 0), fixed: s.fixed + (it.redo ? 1 : 0), solved: s.solved + 1, lastCat: null },
      result: { ok: true, first, combo, comboMark, event: { ...base, ok: true, first, cat: s.lastCat } },
    };
  }
  const cat = it.diag ? it.diag(u) : null;
  const cats = cat ? { ...s.cats, [cat]: (s.cats[cat] || 0) + 1 } : s.cats;
  const firstMiss = s.attempt === 1;
  const mistakes = s.mistakes + (firstMiss && !it.redo ? 1 : 0);
  const missedSlots = firstMiss && !it.redo ? [...s.missedSlots, s.slot] : s.missedSlots;
  const common = { ...s, cats, mistakes, missedSlots, combo: 0, wrong: [...s.wrong, u], lastCat: cat || s.lastCat };
  if (s.kind === 'jump') {
    // A jump test is a check, not practice: one try per exercise.
    const failed = mistakes > JUMP_MISTAKES;
    return { s: { ...common, phase: 'reveal', failed, solved: s.solved + 1 }, result: { ok: false, reveal: true, cat, event: { ...base, ok: false, first: false, cat } } };
  }
  if (firstMiss) return { s: { ...common, attempt: 2, hint: true, phase: 'retry' }, result: { ok: false, retry: true, cat } };
  // Second miss: show the answer; a similar exercise returns at the end of the lesson.
  const tries = (it.tries || 0) + 1;
  const redo = tries <= REDO_MAX ? [...s.redo, { level: it.level, tries }] : s.redo;
  const solved = tries <= REDO_MAX ? s.solved : s.solved + 1; // after the last return, the slot counts as done
  return { s: { ...common, phase: 'reveal', redo, solved }, result: { ok: false, reveal: true, cat, event: { ...base, ok: false, first: false, cat } } };
}

/** Move on after feedback. */
export function next(s) {
  if (s.kind === 'placement') return placementNext(s);
  if (s.kind === 'jump' && s.failed) return { ...s, finished: true };
  const slot = s.slot + 1;
  const fresh = { attempt: 1, hint: false, phase: 'answer', wrong: [], itemStartedAt: Date.now() };
  if (slot < s.levels.length) return { ...s, ...fresh, slot, item: makeItem(s.topic, s.levels[slot], s.item.key) };
  if (s.redo.length) {
    const [r, ...rest] = s.redo;
    return { ...s, ...fresh, slot, redo: rest, redoing: true, item: { ...makeItem(s.topic, r.level, s.item.key), redo: true, tries: r.tries } };
  }
  return { ...s, finished: true };
}

/** What the lesson earned. */
export function resultOf(s) {
  if (s.kind === 'placement') return placementResult(s);
  const answered = s.total;
  const accuracy = answered ? Math.round((100 * s.firstTry) / answered) : 0;
  const perfect = s.mistakes === 0 && s.firstTry === answered;
  const passed = s.kind !== 'jump' || !s.failed;
  const xp = passed ? (XP[s.kind === 'review' ? 'review' : s.kind === 'jump' ? 'jump' : 'lesson'] + (perfect ? XP.perfect : 0) + XP.fix * (s.fixed || 0)) : 0;
  return { kind: s.kind, topic: s.topic, level: s.level, part: s.part, accuracy, perfect, passed, xp, fixed: s.fixed || 0, bestCombo: s.bestCombo, secs: Math.round((Date.now() - s.startedAt) / 1000), mistakes: s.mistakes };
}
