import { describe, it, expect, beforeEach } from 'vitest';
import { startLesson, answer, next, resultOf, progressOf } from './lesson.js';
import { nextProbe, startLevel, PER_TOPIC, PLACEMENT_XP } from './placement.js';
import { noteGap, gapsFromExam, gapsOf, gapTarget, boardOf, GAP_CLEAR } from './board.js';
import { unitNodes, doneUpTo } from './path.js';
import { useApp, today, streakOf } from './store.js';
import { TOPIC, topicsFor } from '@/content/index.js';

const right = (s) => s.item.answer;
const wrongOf = (s) => (s.item.form === 'mc' ? (s.item.answer + 1) % s.item.choices.length : s.item.form === 'pt' ? [999, 999] : s.item.form === 'line' ? { m: 999, b: 999 } : 99999);
/** Answer by a rule: ok(level, topic) says whether this student gets a question right. */
const take = (s, ok) => {
  let st = s; let guard = 0;
  while (!st.finished && guard++ < 50) {
    st = answer(st, ok(st.item.level, st.topics[st.ti]) ? right(st) : wrongOf(st)).s;
    st = next(st);
  }
  return st;
};

describe('placement', () => {
  it('starts where the onboarding answer points', () => {
    expect(startLevel(5, 0)).toBe(1);
    expect(startLevel(5, 1)).toBe(2);
    expect(startLevel(5, 2)).toBe(3);
    expect(startLevel(8, 3)).toBe(7);
  });
  it('the probe searches between the last right and the last wrong level', () => {
    expect(nextProbe({ lo: 3, hi: 6, asked: 1 })).toBe(4);
    expect(nextProbe({ lo: 0, hi: 3, asked: 1 })).toBe(1);
    expect(nextProbe({ lo: 2, hi: 3, asked: 2 })).toBe(null); // settled
    expect(nextProbe({ lo: 1, hi: 6, asked: PER_TOPIC })).toBe(null); // out of questions
  });
  it('a student who knows everything is placed at the top of every topic in at most three questions each', () => {
    const s = take(startLesson({ kind: 'placement', grade: '7', know: 2 }), () => true);
    expect(s.finished).toBe(true);
    expect(progressOf(s)).toBe(1);
    topicsFor('7').forEach((t) => expect(s.results[t.id]).toMatchObject({ level: t.levels.length }));
    expect(s.answered).toBeLessThanOrEqual(PER_TOPIC * 3);
  });
  it('a student who knows up to level 2 is placed at level 2', () => {
    const s = take(startLesson({ kind: 'placement', grade: '7', know: 1 }), (L) => L <= 2);
    topicsFor('7').forEach((t) => expect(s.results[t.id].level).toBe(2));
  });
  it('new material: one wrong answer settles a topic at the start', () => {
    const s = take(startLesson({ kind: 'placement', grade: '8', know: 0 }), () => false);
    expect(s.answered).toBe(topicsFor('8').length);
    Object.values(s.results).forEach((r) => expect(r.level).toBe(0));
  });
  it('a wrong answer is shown, never retried, and the result earns the placement XP', () => {
    let s = startLesson({ kind: 'placement', grade: '7', know: 1 });
    const r = answer(s, wrongOf(s));
    expect(r.result).toMatchObject({ ok: false, reveal: true });
    expect(r.s.phase).toBe('reveal');
    s = take(s, () => true);
    expect(resultOf(s)).toMatchObject({ kind: 'placement', xp: PLACEMENT_XP, passed: true });
  });
});

describe('store: placement sets the path', () => {
  beforeEach(() => { useApp.getState().resetProgress(); useApp.setState({ goalXp: 20 }); });
  it('placed levels count as done, the next node is current, and the day counts for the streak', () => {
    const r = { kind: 'placement', grade: '7', xp: PLACEMENT_XP, bestCombo: 3, results: { signed: { level: 3 }, coord: { level: 0 }, angles: { level: 5 } } };
    const award = useApp.getState().completePlacement(r);
    const { path, progress, days, placement } = useApp.getState();
    expect(doneUpTo('signed', path, progress)).toBe(3);
    expect(unitNodes('signed', path, progress).find((n) => n.state === 'current').level).toBe(4);
    expect(doneUpTo('coord', path, progress)).toBe(0);
    expect(unitNodes('angles', path, progress).find((n) => n.state === 'current').kind).toBe('review');
    expect(days[today()]).toMatchObject({ lessons: 1, xp: PLACEMENT_XP });
    expect(streakOf(days)).toBe(1);
    expect(award.streakExtended).toBe(true);
    expect(placement.grade).toBe('7');
  });
});

describe('board', () => {
  it('a diagnosed mistake opens a gap that clears after right first-try answers at its level', () => {
    const at = new Date().toISOString();
    let g = noteGap({}, { topic: 'signed', level: 1, ok: false, cat: 'abs-add', at });
    g = noteGap(g, { topic: 'signed', level: 1, ok: false, cat: 'abs-add', at });
    expect(gapsOf('signed', g).open).toMatchObject([{ id: 'signed:abs-add', n: 2, level: 1 }]);
    g = noteGap(g, { topic: 'signed', level: 2, ok: true, first: true }); // another level does not count
    g = noteGap(g, { topic: 'signed', level: 1, ok: true, first: false }); // after a retry does not count
    expect(g['signed:abs-add'].ok).toBe(0);
    for (let i = 0; i < GAP_CLEAR; i += 1) g = noteGap(g, { topic: 'signed', level: 1, ok: true, first: true });
    expect(gapsOf('signed', g)).toMatchObject({ open: [], cleared: 1 });
    // A new slip reopens it.
    g = noteGap(g, { topic: 'signed', level: 1, ok: false, cat: 'abs-add', at });
    expect(gapsOf('signed', g).open).toHaveLength(1);
  });
  it('an exam question that lost points becomes a gap with its skill', () => {
    const exam = { at: new Date().toISOString(), result: { questions: [
      { topic: 'line', level: 4, status: 'wrong', skill: 'שיפוע בין שתי נקודות' },
      { topic: 'line', level: 2, status: 'correct', skill: 'x' },
      { topic: 'nope', level: 1, status: 'wrong' },
    ] } };
    const g = gapsFromExam({}, exam);
    expect(gapsOf('line', g).open).toMatchObject([{ text: 'שיפוע בין שתי נקודות', level: 4, exam: true }]);
  });
  it('practising a gap goes to its level when open, else to the current node', () => {
    const path = { signed: { parts: {}, reviews: 0, jumped: 2 } };
    expect(gapTarget('signed', 1, path, {})).toBe('/lesson/signed/1?part=2');
    expect(gapTarget('signed', 5, path, {})).toBe('/lesson/signed/3?part=1');
  });
  it('the board sums the stairs of the grade and marks each topic', () => {
    const path = { signed: { parts: {}, reviews: 0, jumped: 5 }, coord: { parts: { 1: 1 }, reviews: 0, jumped: 0 } };
    const gaps = { 'angles:sum-360': { level: 3, n: 1, ok: 0, at: '2026-01-01' } };
    const b = boardOf({ grade: '7', path, progress: {}, gaps });
    const total = topicsFor('7').reduce((a, t) => a + t.levels.length, 0);
    expect(b).toMatchObject({ done: 5, total, open: 1 });
    expect(b.topics.map((t) => t.status)).toEqual(['done', 'going', 'work']);
    expect(TOPIC.angles.cats['sum-360']).toBe(b.topics[2].open[0].text);
  });
});
