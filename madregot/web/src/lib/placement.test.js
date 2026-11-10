import { describe, it, expect, beforeEach } from 'vitest';
import { startLesson, answer, next, resultOf, progressOf } from './lesson.js';
import { nextProbe, startLevel, startPlacement, placementMax, PER_TOPIC, PROBE_LEN, PLACEMENT_XP } from './placement.js';
import { noteGap, gapsFromExam, gapsOf, gapTarget, boardOf, GAP_CLEAR } from './board.js';
import { unitNodes, doneCount, reachedUpTo } from './path.js';
import { useApp, today, streakOf } from './store.js';
import { TOPIC, topicsFor, placementTopicsFor, rescueTopicsFor } from '@/content/index.js';

const right = (s) => s.item.answer;
const wrongOf = (s) => (s.item.form === 'mc' ? (s.item.answer + 1) % s.item.choices.length : s.item.form === 'pt' ? [999, 999] : s.item.form === 'line' ? { m: 999, b: 999 } : s.item.form === 'lin' ? { k: 999, c: 999 } : 99999);
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
  it('the probe searches between the last right and the last wrong level (halfway, rounded up)', () => {
    expect(nextProbe({ lo: 3, hi: 6, asked: 1 })).toBe(5);
    expect(nextProbe({ lo: 0, hi: 3, asked: 1 })).toBe(2);
    expect(nextProbe({ lo: 0, hi: 2, asked: 1 })).toBe(1);
    expect(nextProbe({ lo: 2, hi: 3, asked: 2 })).toBe(null); // settled
    expect(nextProbe({ lo: 1, hi: 6, asked: PER_TOPIC })).toBe(null); // out of questions
  });
  it('a student who knows everything is placed at the top of every topic, in two probes of three questions each', () => {
    const s = take(startLesson({ kind: 'placement', grade: '7', know: 2 }), () => true);
    expect(s.finished).toBe(true);
    expect(progressOf(s)).toBe(1);
    placementTopicsFor('7').forEach((t) => expect(s.results[t.id]).toMatchObject({ level: t.levels.length }));
    expect(s.answered).toBeLessThanOrEqual(placementMax('7'));
    // algebra is taught from December (equations from March): the first-day test never asks it
    expect(s.results.expr).toBeUndefined();
    expect(s.results.eq).toBeUndefined();
  });
  it('a level counts only when all three questions of its probe are right: one miss, even the last, does not pass it', () => {
    let s = startLesson({ kind: 'placement', grade: '7', know: 1 }); // the first probe: signed numbers, level 2
    expect(s.item.level).toBe(2);
    for (let k = 0; k < PROBE_LEN - 1; k += 1) { s = answer(s, right(s)).s; s = next(s); expect(s.item.level).toBe(2); }
    s = next(answer(s, wrongOf(s)).s); // the third question missed
    expect(s.probe).toMatchObject({ lo: 0, hi: 2, asked: 1 });
    // and the three questions of a probe are of different kinds: an exercise, a diagnostic one, one on a new surface
    const kinds = []; let t = startLesson({ kind: 'placement', grade: '8', know: 1 });
    for (let k = 0; k < PROBE_LEN; k += 1) { kinds.push(t.item.source || 'gen'); t = next(answer(t, right(t)).s); }
    expect(kinds).toEqual(['gen', 'diag', 'transfer']);
  });
  it('a student who knows up to level 2 is placed at level 2', () => {
    const s = take(startLesson({ kind: 'placement', grade: '7', know: 1 }), (L) => L <= 2);
    placementTopicsFor('7').forEach((t) => expect(s.results[t.id].level).toBe(2));
  });
  it('new material: one wrong answer settles a topic at the start', () => {
    const s = take(startLesson({ kind: 'placement', grade: '8', know: 0 }), () => false);
    expect(s.answered).toBe(placementTopicsFor('8').length);
    // equations and systems are taught from December: the first-day test never asks them
    expect(s.results.sys).toBeUndefined();
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
  it('placed levels are passed over (open, not done), the next node is current, and the day counts for the streak', () => {
    const r = { kind: 'placement', grade: '7', xp: PLACEMENT_XP, bestCombo: 3, results: { signed: { level: 3 }, coord: { level: 0 }, angles: { level: 5 } } };
    const award = useApp.getState().completePlacement(r);
    const { path, days, placement } = useApp.getState();
    // a placement is a few questions, not a mastery check: the stairs it passes over stay open and offer their check
    expect(reachedUpTo('signed', path)).toBe(3);
    expect(doneCount('signed', path)).toBe(0);
    expect(unitNodes('signed', path).slice(0, 3).map((n) => n.state)).toEqual(['open', 'open', 'open']);
    expect(unitNodes('signed', path).find((n) => n.state === 'current').level).toBe(4);
    expect(reachedUpTo('coord', path)).toBe(0);
    expect(unitNodes('angles', path).find((n) => n.state === 'current').kind).toBe('review');
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
    // a stair counts once it is done: mastered, or kept from before mastery checks
    const done = { 1: 'mastered', 2: 'mastered', 3: 'kept', 4: 'mastered', 5: 'mastered' };
    const path = { signed: { parts: {}, reviews: 0, jumped: 5, done }, coord: { parts: { 1: 1 }, reviews: 0, jumped: 0 } };
    const gaps = { 'angles:sum-360': { level: 3, n: 1, ok: 0, at: '2026-01-01' } };
    const b = boardOf({ grade: '7', path, progress: {}, gaps });
    const total = topicsFor('7').reduce((a, t) => a + t.levels.length, 0);
    expect(b).toMatchObject({ done: 5, total, open: 1 });
    expect(['signed', 'coord', 'angles'].map((id) => b.topics.find((t) => t.id === id).status)).toEqual(['done', 'going', 'work']);
    expect(TOPIC.angles.cats['sum-360']).toBe(b.topics[2].open[0].text);
    // stairs only passed over by a placement are not counted as done
    expect(boardOf({ grade: '7', path: { signed: { parts: {}, reviews: 0, jumped: 5 } }, progress: {}, gaps: {} }).done).toBe(0);
  });
});

// A topic taught later in the year (algebra starts in December) carries placement: false; one revised in another
// grade's tests carries alsoFor. Shown here on an existing topic, flagged for the test only.
describe('topic flags', () => {
  it('placement: false keeps a topic out of the first-day test and its result list', () => {
    TOPIC.angles.placement = false;
    try {
      expect(placementTopicsFor('7').map((t) => t.id)).toEqual(['signed', 'coord']);
      const s = startPlacement({ grade: '7', know: 1 });
      expect(s.topics).toEqual(['signed', 'coord']);
      expect(s.total).toBe(2 * PER_TOPIC * PROBE_LEN);
      expect(s.total).toBe(placementMax('7'));
    } finally { delete TOPIC.angles.placement; }
    // grade 7 algebra (expressions, equations) is taught later in the year, so it carries the flag itself
    expect(TOPIC.expr.placement).toBe(false);
    expect(TOPIC.eq.placement).toBe(false);
    expect(startPlacement({ grade: '7' }).topics).toEqual(['signed', 'coord', 'angles']);
    // grade 8's equations and systems too (December to May)
    expect(TOPIC.sys.placement).toBe(false);
    expect(startPlacement({ grade: '8' }).topics).toEqual(['line', 'pyth', 'stats']);
  });
  it('alsoFor offers a topic to another grade in Exam Rescue, after that grade\'s own', () => {
    // grade 8 tests revise equations with brackets, so grade 7 expressions and equations are offered to grade 8 already
    expect(rescueTopicsFor('8').map((t) => t.id)).toEqual([...topicsFor('8').map((t) => t.id), 'expr', 'eq']);
    TOPIC.signed.alsoFor = ['8'];
    try {
      expect(rescueTopicsFor('8').map((t) => t.id)).toEqual([...topicsFor('8').map((t) => t.id), 'signed', 'expr', 'eq']);
      expect(rescueTopicsFor('7').map((t) => t.id)).toEqual(topicsFor('7').map((t) => t.id));
    } finally { delete TOPIC.signed.alsoFor; }
  });
});
