// A lesson: a short, fixed run of exercises (about 3–5 minutes).
// Wrong once: try again with a hint. Wrong twice: see the answer and the steps,
// and a similar exercise comes back at the end of the lesson. The lesson ends
// when every slot has been answered correctly (each slot can come back twice at most).
import { TOPIC, makeItem, testItem, isCorrect } from '@/content/index.js';
import { startPlacement, placementAnswer, placementNext, placementProgress, placementResult } from './placement.js';
import { checkPlan, itemFor } from '@/learn/items.ts';
import { contentOf } from '@/learn/content/index.ts';
import { parseSkill, skillId } from '@/learn/skills.ts';
import { MASTERY_N, MASTERY_NEED, REVIEW_NEED } from '@/learn/mastery.ts';
import { VERIFY_NEED } from '@/learn/misconceptions.ts';

export const LESSON_LEN = 8;
export const REVIEW_LEN = 10;
export const JUMP_LEN = 5;
export const JUMP_MISTAKES = 1; // a jump test allows one mistake
export const PARTS = 2; // lessons that complete a node on the path
export const REDO_MAX = 2;
export const XP = { lesson: 10, review: 15, jump: 10, perfect: 5, fix: 2, mastery: 15, recall: 5, verify: 5, diagnostic: 5, exam: 10 }; // fix: each mistake corrected at the end of a lesson
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

/**
 * A check (Madregot 2.0): one try per question, no hints, the answer shown after a miss. Its purpose decides
 * what it is for: mastery (5 questions, 4 right), review (3), verify (after a repair), diagnostic (Exam Rescue),
 * exam (a practice exam over the exam's stairs). The questions mix the stair's generator with its diagnostic and
 * transfer questions (src/learn/items.ts).
 */
function startCheck(opts) {
  const plan = checkPlan({ purpose: opts.purpose, skill: opts.skill, skills: opts.skills, misc: opts.misc }, Math.random);
  if (!plan.length) return null;
  const first = plan[0];
  const { topic, level } = parseSkill(first.skill);
  return {
    kind: 'check', purpose: opts.purpose, skill: opts.skill || null, skills: opts.skills || null, misc: opts.misc || null,
    topic: opts.topic || topic, level: opts.level || level, part: 1, plan,
    levels: plan.map((q) => parseSkill(q.skill).level), slot: 0, total: plan.length, solved: 0, redo: [], redoing: false, probes: [],
    item: itemFor(first.skill, first.source, Math.random, undefined, first.candidates, { test: true }), attempt: 1, hint: false, phase: 'answer', wrong: [],
    combo: 0, bestCombo: 0, firstTry: 0, mistakes: 0, fixed: 0, missedSlots: [], cats: {}, lastCat: null,
    right: 0, perSkill: {}, showed: 0,
    finished: false, failed: false, startedAt: Date.now(), itemStartedAt: Date.now(),
  };
}

/** In a practice lesson on a stair with teaching content: a diagnostic question and a transfer question join in. */
function practiceItem(topic, level, slot, avoidKey) {
  const c = contentOf(skillId(topic, level));
  if (c && slot === 3) return itemFor(c.skill, 'diag', Math.random, avoidKey);
  if (c?.transfer && slot === 6) return itemFor(c.skill, 'transfer', Math.random, avoidKey);
  return makeItem(topic, level, avoidKey);
}

/** A jump test is a check: the stair's exercises, a diagnostic and a transfer question, each one able to show the skill. */
export const JUMP_SOURCES = ['gen', 'diag', 'gen', 'transfer', 'gen'];
function jumpItem(topic, level, slot, avoidKey) {
  const c = contentOf(skillId(topic, level));
  const source = JUMP_SOURCES[slot] || 'gen';
  if (c && source !== 'gen') return itemFor(c.skill, source === 'transfer' && !c.transfer ? 'diag' : source, Math.random, avoidKey, undefined, { test: true });
  return testItem(topic, level, avoidKey);
}

export function startLesson(opts) {
  if (opts.kind === 'placement') return startPlacement(opts);
  if (opts.kind === 'check') return startCheck(opts);
  const levels = planLevels(opts);
  return {
    kind: opts.kind || 'node', topic: opts.topic, level: opts.level, part: opts.part || 1,
    levels, slot: 0, total: levels.length, solved: 0, redo: [], redoing: false, probes: [],
    item: opts.kind === 'jump' ? jumpItem(opts.topic, levels[0], 0) : practiceItem(opts.topic, levels[0], 0), attempt: 1, hint: false, phase: 'answer', wrong: [],
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
  const purpose = s.kind === 'check' ? (s.purpose === 'exam' ? 'diagnostic' : s.purpose) : 'practice';
  // a question from a diagnostic model knows every misconception that predicts this answer, and which could have shown
  const diagnosis = !ok && it.diagnosis ? it.diagnosis(u) : null;
  const cands = diagnosis?.kind === 'misconception' ? diagnosis.candidates : undefined;
  const base = { topic: it.topic || s.topic, level: it.level, hint: s.hint, secs, at: new Date().toISOString(), purpose, key: it.key, cands, could: it.could };
  if (s.kind === 'check') {
    const sk = skillId(it.topic || s.topic, it.level);
    const cur = s.perSkill[sk] || { right: 0, asked: 0 };
    const perSkill = { ...s.perSkill, [sk]: { right: cur.right + (ok ? 1 : 0), asked: cur.asked + 1 } };
    const showed = s.showed + (!ok && s.misc && cands?.some((c) => c.id === s.misc) ? 1 : 0);
    const cat = ok ? null : (it.diag ? it.diag(u) : null);
    const common = { ...s, perSkill, showed, right: s.right + (ok ? 1 : 0), solved: s.solved + 1, wrong: ok ? s.wrong : [...s.wrong, u], firstTry: s.firstTry + (ok ? 1 : 0), mistakes: s.mistakes + (ok ? 0 : 1) };
    const event = { ...base, ok, first: true, cat };
    return ok
      ? { s: { ...common, phase: 'correct' }, result: { ok: true, first: true, combo: 0, comboMark: null, event } }
      : { s: { ...common, phase: 'reveal' }, result: { ok: false, reveal: true, cat, diagnosis, event } };
  }
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
  // an answer two misconceptions both explain: one more question, at the end, tells them apart (once a lesson)
  const probes = diagnosis?.kind === 'misconception' && diagnosis.ambiguous && !s.probes?.length && !it.probe
    ? [{ skill: skillId(it.topic || s.topic, it.level), candidates: cands.map((c) => c.id) }] : (s.probes || []);
  if (firstMiss) return { s: { ...common, probes, attempt: 2, hint: true, phase: 'retry' }, result: { ok: false, retry: true, cat, diagnosis, event: { ...base, ok: false, first: false, cat, retry: true } } };
  // Second miss: show the answer; a similar exercise returns at the end of the lesson.
  const tries = (it.tries || 0) + 1;
  const redo = tries <= REDO_MAX ? [...s.redo, { level: it.level, tries }] : s.redo;
  const solved = tries <= REDO_MAX ? s.solved : s.solved + 1; // after the last return, the slot counts as done
  return { s: { ...common, probes, phase: 'reveal', redo, solved }, result: { ok: false, reveal: true, cat, diagnosis, event: { ...base, ok: false, first: false, cat } } };
}

/** Move on after feedback. */
export function next(s) {
  if (s.kind === 'placement') return placementNext(s);
  if (s.kind === 'jump' && s.failed) return { ...s, finished: true };
  const slot = s.slot + 1;
  const fresh = { attempt: 1, hint: false, phase: 'answer', wrong: [], itemStartedAt: Date.now() };
  if (s.kind === 'check') {
    if (slot >= s.plan.length) return { ...s, finished: true };
    const q = s.plan[slot];
    return { ...s, ...fresh, slot, wrong: s.wrong, item: itemFor(q.skill, q.source, Math.random, s.item.key, q.candidates, { test: true }) };
  }
  if (slot < s.levels.length) return { ...s, ...fresh, slot, item: s.kind === 'jump' ? jumpItem(s.topic, s.levels[slot], slot, s.item.key) : practiceItem(s.topic, s.levels[slot], slot, s.item.key) };
  if (s.probes?.length) {
    // the question that tells two possible misconceptions apart
    const [pr, ...rest] = s.probes;
    const item = itemFor(pr.skill, 'probe', Math.random, s.item.key, pr.candidates);
    if (item.probe) return { ...s, ...fresh, slot, probes: rest, item: { ...item, extra: true } };
    s = { ...s, probes: rest };
  }
  if (s.redo.length) {
    const [r, ...rest] = s.redo;
    return { ...s, ...fresh, slot, redo: rest, redoing: true, item: { ...makeItem(s.topic, r.level, s.item.key), redo: true, tries: r.tries } };
  }
  return { ...s, finished: true };
}

/** What the lesson earned. */
export function resultOf(s) {
  if (s.kind === 'placement') return placementResult(s);
  if (s.kind === 'check') {
    const asked = s.total; const right = s.right;
    const passed = s.purpose === 'mastery' ? asked >= MASTERY_N && right >= MASTERY_NEED
      : s.purpose === 'review' ? right >= Math.min(REVIEW_NEED, asked)
        : s.purpose === 'verify' ? right >= VERIFY_NEED && s.showed === 0 : true;
    const xp = !passed ? 0 : { mastery: XP.mastery, review: XP.recall, verify: XP.verify, diagnostic: XP.diagnostic, exam: XP.exam }[s.purpose] || 0;
    return { kind: 'check', purpose: s.purpose, skill: s.skill, skills: s.skills, misc: s.misc, topic: s.topic, level: s.level, right, asked, perSkill: s.perSkill, showed: s.showed, passed, xp, accuracy: asked ? Math.round((100 * right) / asked) : 0, perfect: right === asked, mistakes: asked - right, fixed: 0, bestCombo: 0, secs: Math.round((Date.now() - s.startedAt) / 1000) };
  }
  const answered = s.total;
  const accuracy = answered ? Math.round((100 * s.firstTry) / answered) : 0;
  const perfect = s.mistakes === 0 && s.firstTry === answered;
  const passed = s.kind !== 'jump' || !s.failed;
  const xp = passed ? (XP[s.kind === 'review' ? 'review' : s.kind === 'jump' ? 'jump' : 'lesson'] + (perfect ? XP.perfect : 0) + XP.fix * (s.fixed || 0)) : 0;
  return { kind: s.kind, topic: s.topic, level: s.level, part: s.part, accuracy, perfect, passed, xp, fixed: s.fixed || 0, bestCombo: s.bestCombo, secs: Math.round((Date.now() - s.startedAt) / 1000), mistakes: s.mistakes };
}
