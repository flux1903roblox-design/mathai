import { describe, it, expect, beforeEach, vi } from 'vitest';
import { startLesson, answer, next, resultOf, progressOf, planLevels, withHelp, withHint, LESSON_LEN, REVIEW_LEN, PARTS, XP, lessonTopics } from './lesson.js';
import { unitNodes, recordOnPath, nextNode, markMastered, doneCount, reachedUpTo, stairProgress, migratePath, isKept, chestOpen, reopenKept } from './path.js';
import { questsFor, questProgress } from './quests.js';
import { useApp, streakOf, today, dayBefore } from './store.js';
import { TOPIC, topicsFor, makeItem } from '@/content/index.js';
import { freezeItem, thawItem } from './exam.js';
import { loadAllContent } from '@/learn/content/index.ts';

// the screen waits for the lesson's topics before it starts one (DURABLE-11, lessonTopics): so do these tests
await loadAllContent();

const right = (s) => s.item.answer;
const wrongOf = (s) => (s.item.form === 'mc' ? (s.item.answer + 1) % s.item.choices.length : s.item.form === 'pt' ? [999, 999] : s.item.form === 'line' ? { m: 999, b: 999 } : s.item.form === 'lin' ? { k: 999, c: 999 } : 99999);
const run = (s, plan) => { // plan: per answer, true = right, false = wrong
  let st = s;
  for (const ok of plan) {
    st = answer(st, ok ? right(st) : wrongOf(st)).s;
    if (st.phase !== 'retry') st = next(st);
    if (st.finished) break;
  }
  return st;
};

describe('lesson', () => {
  it('a clean lesson is 8 exercises, all first try, with the perfect bonus', () => {
    let s = startLesson({ kind: 'node', topic: 'signed', level: 1 });
    expect(s.total).toBe(LESSON_LEN);
    s = run(s, Array(LESSON_LEN).fill(true));
    expect(s.finished).toBe(true);
    expect(progressOf(s)).toBe(1);
    const r = resultOf(s);
    expect(r).toMatchObject({ accuracy: 100, perfect: true, xp: XP.lesson + XP.perfect, bestCombo: LESSON_LEN });
  });
  it('wrong once gives a retry with a hint; wrong twice reveals and brings a similar exercise back at the end', () => {
    let s = startLesson({ kind: 'node', topic: 'signed', level: 2 });
    let r = answer(s, wrongOf(s)); s = r.s;
    expect(r.result.retry).toBe(true); expect(s.phase).toBe('retry'); expect(s.hint).toBe(true);
    r = answer(s, wrongOf(s)); s = r.s;
    expect(r.result.reveal).toBe(true); expect(s.redo).toHaveLength(1); expect(progressOf(s)).toBe(0);
    s = next(s);
    s = run(s, Array(LESSON_LEN - 1).fill(true));
    expect(s.finished).toBe(false); // the missed exercise is still owed
    expect(s.redoing).toBe(true); expect(s.item.redo).toBe(true);
    s = run(s, [true]);
    expect(s.finished).toBe(true);
    const res = resultOf(s);
    expect(res.perfect).toBe(false); expect(res.xp).toBe(XP.lesson + XP.fix); expect(res.accuracy).toBe(Math.round((100 * (LESSON_LEN - 1)) / LESSON_LEN));
  });
  it('a combo of 5 first-try answers is marked once', () => {
    let s = startLesson({ kind: 'node', topic: 'coord', level: 1 }); const marks = [];
    for (let i = 0; i < 6; i++) { const r = answer(s, right(s)); if (r.result.comboMark) marks.push(r.result.comboMark); s = next(r.s); }
    expect(marks).toEqual([5]);
  });
  it('the second lesson of a node mixes in earlier levels; a review spreads over all levels reached', () => {
    const two = planLevels({ kind: 'node', topic: 'line', level: 5, part: 2 });
    expect(two.filter((l) => l < 5).length).toBe(2);
    const rev = planLevels({ kind: 'review', topic: 'line', level: 8, max: 8 });
    expect(rev).toHaveLength(REVIEW_LEN); expect(new Set(rev).size).toBe(8);
  });
  it('a jump test fails on the second mistake', () => {
    let s = startLesson({ kind: 'jump', topic: 'pyth', level: 3 });
    s = run(s, [false, true, false]);
    expect(s.finished).toBe(true); expect(resultOf(s).passed).toBe(false); expect(resultOf(s).xp).toBe(0);
  });
});

describe('help from the tutor counts as help (ai spec AI-3 Design 4)', () => {
  it('asking before answering: a right answer is not a first try, earns no combo, and is recorded as with help', () => {
    let s = startLesson({ kind: 'node', topic: 'signed', level: 1 });
    // two clean first tries build a combo of 2
    for (let i = 0; i < 2; i++) { const r = answer(s, right(s)); expect(r.result.first).toBe(true); expect(r.result.assisted).toBe(false); s = next(r.s); }
    expect(s.combo).toBe(2);
    s = withHelp(s);
    expect(s.helped).toBe(true);
    expect(s.hint).toBe(false); // the app's hint box keys on the hint, not on the tutor
    const r = answer(s, right(s));
    expect(r.result).toMatchObject({ ok: true, first: false, assisted: true, combo: 0, comboMark: null });
    expect(r.result.event.hint).toBe(true);
    expect(r.s.combo).toBe(0);
    expect(r.s.firstTry).toBe(2);
  });
  it('the hint button alone is help too: "נכון! פתרתם עם קצת עזרה."', () => {
    const s = withHint(startLesson({ kind: 'node', topic: 'signed', level: 1 }));
    expect(answer(s, right(s)).result).toMatchObject({ first: false, assisted: true });
  });
  it('a right second try after a first miss is fixed, not assisted ("יפה, תיקנתם!")', () => {
    let s = startLesson({ kind: 'node', topic: 'signed', level: 2 });
    s = answer(s, wrongOf(s)).s;
    const r = answer(withHelp(s), right(s));
    expect(r.result).toMatchObject({ ok: true, first: false, assisted: false });
    expect(r.result.event.hint).toBe(true);
  });
  it('help asked after a miss marks the next try as with help (a wrong answer then is not independent either)', () => {
    let s = startLesson({ kind: 'node', topic: 'signed', level: 2 });
    s = withHelp(s);
    const r = answer(s, wrongOf(s));
    expect(r.result.event).toMatchObject({ hint: true, retry: true });
  });
  it('once the answer is shown, or found, asking changes nothing; a check has no tutor', () => {
    let s = startLesson({ kind: 'node', topic: 'signed', level: 2 });
    s = answer(s, wrongOf(s)).s; s = answer(s, wrongOf(s)).s;
    expect(s.phase).toBe('reveal');
    expect(withHelp(s)).toBe(s);
    const solved = answer(startLesson({ kind: 'node', topic: 'signed', level: 1 }), 0).s;
    if (solved.phase === 'correct') expect(withHelp(solved)).toBe(solved);
    const jump = startLesson({ kind: 'jump', topic: 'signed', level: 1 });
    expect(withHelp(jump)).toBe(jump);
  });
  it('next() clears it: the next exercise starts without help', () => {
    let s = withHelp(startLesson({ kind: 'node', topic: 'signed', level: 1 }));
    s = next(answer(s, right(s)).s);
    expect(s.helped).toBe(false);
    const r = answer(s, right(s));
    expect(r.result).toMatchObject({ first: true, assisted: false });
  });
});

describe('path: done means mastered', () => {
  it('practice fills a stair\'s ring but never marks it done; its passed mastery check does, and the path moves on', () => {
    let path = {};
    let nodes = unitNodes('stats', path);
    expect(nodes.map((n) => n.state)).toEqual(['current', 'locked', 'locked', 'locked', 'locked', 'locked']);
    let r;
    for (let i = 0; i < PARTS; i++) { r = recordOnPath(path, { kind: 'node', topic: 'stats', level: 1, passed: true }); path = r.path; }
    expect(r.practiceDone).toBe(true); // the mastery check is next
    nodes = unitNodes('stats', path);
    expect(nodes[0]).toMatchObject({ state: 'current', parts: PARTS });
    expect(nodes[1].state).toBe('locked');
    expect(doneCount('stats', path)).toBe(0);
    // the mastery check passed: done, counted, and the next stair is current
    const m = markMastered(path, 'stats', 1);
    expect(m.stairDone).toBe(true);
    nodes = unitNodes('stats', m.path);
    expect(nodes[0].state).toBe('done'); expect(nodes[1].state).toBe('current');
    expect(doneCount('stats', m.path)).toBe(1);
    expect(markMastered(m.path, 'stats', 1).stairDone).toBe(false); // a second pass is not a new stair
  });
  it('the same on an algebra stair: practice is not done, its mastery check is (eq:1, then eq:2 is current)', () => {
    let path = {}; let r;
    for (let i = 0; i < PARTS; i++) { r = recordOnPath(path, { kind: 'node', topic: 'eq', level: 1, passed: true }); path = r.path; }
    expect(r.practiceDone).toBe(true);
    expect(unitNodes('eq', path)[0]).toMatchObject({ state: 'current', parts: PARTS });
    expect(doneCount('eq', path)).toBe(0);
    const m = markMastered(path, 'eq', 1);
    expect(m.stairDone).toBe(true);
    expect(unitNodes('eq', m.path).slice(0, 2).map((n) => n.state)).toEqual(['done', 'current']);
    expect(doneCount('eq', m.path)).toBe(1);
  });
  it('a stair passed over by a test stays open, not done, and the path goes on after it', () => {
    const jump = recordOnPath({}, { kind: 'jump', topic: 'stats', level: 5, passed: true });
    const nodes = unitNodes('stats', jump.path);
    expect(nodes.slice(0, 5).map((n) => n.state)).toEqual(['open', 'open', 'open', 'open', 'current']);
    expect(doneCount('stats', jump.path)).toBe(0);
    expect(reachedUpTo('stats', jump.path)).toBe(4);
    // its mastery check makes it done
    expect(unitNodes('stats', markMastered(jump.path, 'stats', 2).path)[1].state).toBe('done');
  });
  it('a stair mastered out of order is done; the path still continues from the first one not passed', () => {
    const p = markMastered({}, 'signed', 3).path;
    // the stair between is open (its lesson and check wait), not locked behind a stair already done
    expect(unitNodes('signed', p).slice(0, 4).map((n) => n.state)).toEqual(['current', 'open', 'done', 'locked']);
    expect(doneCount('signed', p)).toBe(1);
    expect(nextNode(topicsFor('7'), p)).toMatchObject({ topic: 'signed', level: 1 });
    // the halfway chest is the store's: it opens with every stair up to it done, not with the halfway stair alone
    expect(chestOpen('signed', p)).toBe(false);
    expect(chestOpen('signed', markMastered(markMastered(p, 'signed', 1).path, 'signed', 2).path)).toBe(true);
  });
  it('the ring shows how far the five stages went, and is full only with the mastery check', () => {
    expect(stairProgress(undefined, 0)).toBe(0);
    expect(stairProgress({ taught: { A: 'x' }, attempts: [] }, 0)).toBeCloseTo(1 / 5);
    expect(stairProgress({ taught: { A: 'x', B: 'x', C: 'x' }, attempts: [] }, PARTS)).toBeCloseTo(4 / 5);
    expect(stairProgress({ taught: { A: 'x', B: 'x', C: 'x' }, attempts: [], mastered: { at: 'x', box: 0, due: 'x' } }, PARTS)).toBe(1);
  });
});

describe('v3 migration: nobody loses a stair they earned', () => {
  it('stairs done under the old rule stay done and are offered their mastery check; mastered stairs are marked mastered', () => {
    const path = migratePath(
      { coord: { parts: { 1: 2, 2: 2, 3: 1 }, reviews: 0, jumped: 0 }, angles: { parts: {}, reviews: 0, jumped: 3 } },
      { signed: { level: 3, max: 3 } },
      { 'coord:3': { attempts: [], mastered: { at: 'x', box: 0, due: 'x' } } },
    );
    // the older ladder: two stairs; two practice lessons: coord 1 and 2; a placement: angles 1 to 3
    expect(unitNodes('signed', path).slice(0, 3).map((n) => [n.state, n.kept])).toEqual([['done', true], ['done', true], ['current', false]]);
    expect(unitNodes('coord', path).slice(0, 4).map((n) => n.state)).toEqual(['done', 'done', 'done', 'current']);
    expect(isKept(path, 'coord', 1)).toBe(true);
    expect(isKept(path, 'coord', 3)).toBe(false); // its mastery check was passed
    expect(doneCount('angles', path)).toBe(3);
    // the practice already done on a stair is kept too
    expect(path.coord.parts).toEqual({ 1: 2, 2: 2, 3: 1 });
  });
  it('a saved v2 state is migrated: green stays green, and mislabelled evidence moves to the mistake it showed', () => {
    const { migrate } = useApp.persist.getOptions();
    const miscon = {
      'signed:1|sign': { skill: 'signed:1', id: 'sign', score: 1.5, seen: ['sn1n:2 + 4', 'sn1n:-4 - (-6)'], state: 'confirmed', at: 'x' },
      'signed:5|minus-minus': { skill: 'signed:5', id: 'minus-minus', score: 1.5, seen: ['sn5:6 - (2 - 3) \\cdot (-3)', 'sn5:6 - (2 - 3) \\cdot 3'], state: 'confirmed', at: 'x' },
    };
    const st = migrate({ path: { coord: { parts: { 1: 2 }, reviews: 0, jumped: 0 } }, progress: {}, learn: { skills: {}, miscon, exam: null, missions: {}, events: [] } }, 2);
    expect(st.path.coord.done).toEqual({ 1: 'kept' });
    expect(unitNodes('coord', st.path)[0].state).toBe('done');
    // the number line's wrong-direction moves were never sign mistakes
    expect(st.learn.miscon['signed:1|sign']).toBeUndefined();
    expect(st.learn.miscon['signed:1|direction'].seen).toEqual(['sn1n:2 + 4']);
    expect(st.learn.miscon['signed:1|minus-minus'].seen).toEqual(['sn1n:-4 - (-6)']);
    // adding a positive product is no "minus-minus": that evidence goes, the real one stays (now only a suspicion)
    expect(st.learn.miscon['signed:5|minus-minus']).toMatchObject({ seen: ['sn5:6 - (2 - 3) \\cdot 3'], state: 'suspected' });
  });
  it('a kept stair stays done only until its mastery check is failed: then it is open again, its practice kept', () => {
    const path = { coord: { parts: { 1: 2, 2: 2 }, reviews: 0, jumped: 0, done: { 1: 'kept', 2: 'kept' } } };
    const p = reopenKept(path, 'coord', 2);
    expect(isKept(p, 'coord', 2)).toBe(false);
    expect(doneCount('coord', p)).toBe(1);
    expect(unitNodes('coord', p).slice(0, 3).map((n) => n.state)).toEqual(['done', 'open', 'current']);
    expect(p.coord.parts).toEqual({ 1: 2, 2: 2 });
    // a mastered stair is never reopened by this
    const m = markMastered(path, 'coord', 1).path;
    expect(reopenKept(m, 'coord', 1)).toBe(m);
  });
});

describe('quests', () => {
  it('three quests a day, the first about lessons, the same for everyone on that date', () => {
    const q = questsFor('2026-11-06');
    expect(q).toHaveLength(3); expect(q[0]).toBe('lessons'); expect(new Set(q).size).toBe(3);
    expect(questsFor('2026-11-06')).toEqual(q);
    expect(questProgress('2026-11-06', { lessons: 2 })[0].done).toBe(true);
  });
});

describe('store: lessons, streak and freezes', () => {
  beforeEach(() => { useApp.getState().resetProgress(); useApp.setState({ goalXp: 20 }); });
  it('answers in a lesson that was left unfinished do not count as a streak day', () => {
    for (let k = 0; k < 5; k += 1) useApp.getState().recordAnswer({ ok: true, secs: 10 }, 0);
    const st = useApp.getState();
    expect(st.days[today()]).toMatchObject({ q: 5, ok: 5, lessons: 0 });
    expect(streakOf(st.days)).toBe(0);
    // a day saved by an old version (answers, no lesson count) still counts, as before
    expect(streakOf({ [today()]: { q: 8, ok: 8 } })).toBe(1);
  });
  it('a finished lesson adds XP and counts for the streak; a second one completes the practice, not the stair', () => {
    const r = { kind: 'node', topic: 'signed', level: 1, part: 1, xp: 15, perfect: true, passed: true, bestCombo: 8 };
    const a = useApp.getState().completeLesson(r);
    expect(a).toMatchObject({ streakExtended: true, streak: 1, practiceDone: false });
    const b = useApp.getState().completeLesson({ ...r, part: 2 });
    expect(b).toMatchObject({ streakExtended: false, practiceDone: true, goalReached: true });
    const st = useApp.getState();
    expect(st.xp).toBe(30);
    expect(doneCount('signed', st.path)).toBe(0);
    expect(unitNodes('signed', st.path)[0].state).toBe('current');
    expect(st.days[today()]).toMatchObject({ lessons: 2, xp: 30, perfect: 2, combo: 8 });
  });
  it('a passed mastery check marks the stair done and moves the path and its counter (the council\'s 0 of 5)', () => {
    // a stair mastered with one practice lesson behind it
    useApp.getState().completeLesson({ kind: 'node', topic: 'signed', level: 1, part: 1, xp: 10, passed: true });
    const failed = useApp.getState().completeCheck({ purpose: 'mastery', skill: 'signed:1', topic: 'signed', level: 1, right: 3, asked: 5, perSkill: {}, passed: false, xp: 0 });
    expect(failed).toMatchObject({ stairDone: false, done: 0 });
    expect(unitNodes('signed', useApp.getState().path)[0].state).toBe('current');
    const passed = useApp.getState().completeCheck({ purpose: 'mastery', skill: 'signed:1', topic: 'signed', level: 1, right: 5, asked: 5, perSkill: {}, passed: true, xp: 15 });
    expect(passed).toMatchObject({ stairDone: true, done: 1 });
    const st = useApp.getState();
    expect(st.learn.skills['signed:1'].mastered).toBeTruthy();
    expect(unitNodes('signed', st.path).slice(0, 2).map((n) => n.state)).toEqual(['done', 'current']);
    expect(st.progress.signed).toEqual({ level: 2, max: 2 });
    // mastering the halfway stair opens the unit's chest
    ['signed:2', 'signed:3'].forEach((sk, i) => { const out = useApp.getState().completeCheck({ purpose: 'mastery', skill: sk, topic: 'signed', level: i + 2, right: 4, asked: 5, perSkill: {}, passed: true, xp: 15 }); expect(out.chestOpened).toBe(i === 1); });
  });
  it('a passed mastery check of an algebra stair moves its own unit (sys:1)', () => {
    useApp.getState().completeLesson({ kind: 'node', topic: 'sys', level: 1, part: 1, xp: 10, passed: true });
    expect(doneCount('sys', useApp.getState().path)).toBe(0);
    const passed = useApp.getState().completeCheck({ purpose: 'mastery', skill: 'sys:1', topic: 'sys', level: 1, right: 4, asked: 5, perSkill: {}, passed: true, xp: 15 });
    expect(passed).toMatchObject({ stairDone: true, done: 1 });
    const st = useApp.getState();
    expect(st.learn.skills['sys:1'].mastered).toBeTruthy();
    expect(unitNodes('sys', st.path).slice(0, 2).map((n) => n.state)).toEqual(['done', 'current']);
    expect(st.progress.sys).toEqual({ level: 2, max: 2 });
  });
  it('a failed mastery check on a kept stair takes it out of the done count; a passed one makes it mastered', () => {
    useApp.setState({ path: { signed: { parts: { 1: 2, 2: 2 }, reviews: 0, jumped: 0, done: { 1: 'kept', 2: 'kept' } } } });
    const failed = useApp.getState().completeCheck({ purpose: 'mastery', skill: 'signed:2', topic: 'signed', level: 2, right: 2, asked: 5, perSkill: {}, passed: false, xp: 0 });
    expect(failed).toMatchObject({ reopened: true, done: 1 });
    expect(unitNodes('signed', useApp.getState().path).slice(0, 3).map((n) => n.state)).toEqual(['done', 'open', 'current']);
    const passed = useApp.getState().completeCheck({ purpose: 'mastery', skill: 'signed:1', topic: 'signed', level: 1, right: 5, asked: 5, perSkill: {}, passed: true, xp: 15 });
    expect(passed).toMatchObject({ reopened: false, done: 1 });
    expect(useApp.getState().path.signed.done).toEqual({ 1: 'mastered' });
  });
  it('a freeze saves the streak over one missed day', () => {
    // On a fixed Thursday, so the missed day (Wednesday) is never a Shabbat, which would not count as missed.
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-05T12:00:00'));
    const y2 = dayBefore(dayBefore(today())); const y3 = dayBefore(y2);
    useApp.setState({ days: { [y3]: { lessons: 1 }, [y2]: { lessons: 1 } }, freezes: 1 });
    expect(streakOf(useApp.getState().days)).toBe(0); // yesterday was missed
    expect(useApp.getState().settleStreak()).toBe(1);
    expect(streakOf(useApp.getState().days)).toBe(2);
    expect(useApp.getState().freezes).toBe(0);
    vi.useRealTimers();
  });
});

describe('streak rules', () => {
  it('Shabbat is passed over, a fixed mistake earns XP', () => {
    // Find the most recent Saturday before today and build Thu-Fri-(Sat off)-Sun... up to yesterday.
    const keys = []; let k = dayBefore(today());
    for (let i = 0; i < 10; i++) { keys.push(k); k = dayBefore(k); }
    const days = Object.fromEntries(keys.filter((key) => new Date(`${key}T12:00:00`).getDay() !== 6).map((key) => [key, { lessons: 1 }]));
    expect(streakOf(days)).toBe(Object.keys(days).length);
    let s = startLesson({ kind: 'node', topic: 'signed', level: 1 });
    s = run(s, [false, false, ...Array(LESSON_LEN - 1).fill(true), true]);
    expect(s.finished).toBe(true);
    expect(resultOf(s)).toMatchObject({ fixed: 1, xp: XP.lesson + XP.fix });
  });
});

describe('a class exam: the teacher\'s fixed questions (TEACHER-5 §4)', () => {
  const frozenExam = () => [
    freezeItem(makeItem('signed', 3)), freezeItem(makeItem('pyth', 2)), freezeItem({ key: 'cmp:1', topic: 'signed', level: 2, levelTitle: 'השוואת מספרים', text: 'מה נכון?', form: 'mc', choices: [{ tex: '<' }, { tex: '=' }, { tex: '>' }], answer: 2, solution: [], hint: '' }),
  ];
  const start = (items) => startLesson({ kind: 'check', purpose: 'class', fixedItems: items.map(thawItem), assignmentId: 'a000000000000001', topic: items[0].topic, level: items[0].level });

  it('serves exactly the fixed questions in order, with no probe and no redo; the numeric `fixed` stays 0', () => {
    const items = frozenExam();
    let s = start(items);
    expect(s).toMatchObject({ kind: 'check', purpose: 'class', total: 3, fixed: 0, slot: 0 });
    expect(s.plan.map((q) => q.source)).toEqual(['fixed', 'fixed', 'fixed']);
    const seen = [];
    // wrong, right, wrong: every miss is shown once and the exam goes on
    for (const ok of [false, true, false]) {
      seen.push(s.item.key);
      s = answer(s, ok ? right(s) : wrongOf(s)).s;
      expect(s.phase).toBe(ok ? 'correct' : 'reveal');
      s = next(s);
    }
    expect(seen).toEqual(items.map((x) => x.key));
    expect(s.finished).toBe(true);
    expect(s.fixed).toBe(0);
    expect(s.redo).toEqual([]); expect(s.probes).toEqual([]);
  });

  it('every answer is diagnostic evidence (it moves no stair\'s stages)', () => {
    let s = start(frozenExam());
    const purposes = [];
    while (!s.finished) { const r = answer(s, right(s)); purposes.push(r.result.event.purpose); s = next(r.s); }
    expect(purposes).toEqual(['diagnostic', 'diagnostic', 'diagnostic']);
  });

  it('the result says how each question went, and earns a practice exam\'s XP', () => {
    const s = run(start(frozenExam()), [true, false, true]);
    const r = resultOf(s);
    expect(r).toMatchObject({ purpose: 'class', right: 2, asked: 3, passed: true, xp: XP.exam });
    expect(XP.exam).toBe(10);
    expect(r.questions).toEqual([
      { topic: 'signed', level: 3, status: 'correct' }, { topic: 'pyth', level: 2, status: 'wrong' }, { topic: 'signed', level: 2, status: 'correct' },
    ]);
    // a check of another purpose has no per-question list
    expect(resultOf(run(startLesson({ kind: 'check', purpose: 'mastery', skill: 'signed:3' }), [true, true, true, true, true])).questions).toBeUndefined();
  });

  it('7.07 for √50 is right: the frozen exact length reaches the grading', () => {
    const root = freezeItem({ key: 'py1:5:5', topic: 'pyth', level: 1, levelTitle: 'יתר', text: 'מה אורך היתר?', form: 'num', answer: 7.1, exact: Math.sqrt(50), unit: 'ס״מ', solution: ['a'], hint: 'h' });
    const s = startLesson({ kind: 'check', purpose: 'class', fixedItems: [thawItem(JSON.parse(JSON.stringify(root)))] });
    const r = answer(s, 7.07);
    expect(r.result.ok).toBe(true);
    expect(resultOf(next(r.s)).questions).toEqual([{ topic: 'pyth', level: 1, status: 'correct' }]);
    expect(answer(startLesson({ kind: 'check', purpose: 'class', fixedItems: [thawItem(root)] }), 7).result.ok).toBe(false);
  });

  it('in any check, a choice missed on one question is not marked or locked on the next', () => {
    const mc = (key) => ({ key, topic: 'signed', level: 2, levelTitle: '', text: 'מה נכון?', form: 'mc', choices: [{ tex: '<' }, { tex: '=' }, { tex: '>' }], answer: 2, solution: [], hint: '' });
    let s = startLesson({ kind: 'check', purpose: 'class', fixedItems: [thawItem(freezeItem(mc('m1'))), thawItem(freezeItem(mc('m2')))] });
    s = answer(s, 0).s;
    expect(s.wrong).toEqual([0]);
    s = next(s);
    expect(s.item.key).toBe('m2');
    expect(s.wrong).toEqual([]);
    let m = startLesson({ kind: 'check', purpose: 'mastery', skill: 'signed:3' });
    m = next(answer(m, wrongOf(m)).s);
    expect(m.wrong).toEqual([]);
  });

  it('a finished class exam is logged on the device and changes no stair', () => {
    useApp.getState().signOut();
    const before = useApp.getState().learn.skills;
    const r = resultOf(run(start(frozenExam()), [true, true, false]));
    useApp.getState().completeCheck(r);
    const L = useApp.getState().learn;
    expect(L.skills).toEqual(before);
    expect(L.events.at(-1)).toMatchObject({ e: 'class-exam-done', n: 2 / 3 });
  });
});

describe('lessonTopics: the teaching content a lesson waits for (DURABLE-11)', () => {
  it('a class exam (TEACHER-5) waits for the topics of all its frozen questions', () => {
    expect(lessonTopics({ kind: 'check', purpose: 'class', topic: 'signed', level: 1, fixedItems: [{ topic: 'signed' }, { topic: 'eq' }, { topic: 'signed' }] }))
      .toEqual(['signed', 'eq']);
    expect(lessonTopics({ kind: 'node', topic: 'eq', level: 2 })).toEqual(['eq']);
    expect(lessonTopics(null)).toEqual([]);
  });
});

// The floor check (/floor) and multiplication facts (/facts): curriculum stage 1, CURRICULUM-3.
describe('the floor check', () => {
  const FLOOR = { kind: 'check', purpose: 'floor', skills: ['frac:1', 'frac:2', 'frac:3', 'frac:4'], topic: 'frac', level: 1 };
  /** Play a floor check: `wrong(item)` says which questions to miss. Returns the finished state and every answer event. */
  const play = (wrong) => {
    let s = startLesson(FLOOR); const events = [];
    for (let k = 0; k < 10 && !s.finished; k += 1) {
      const r = answer(s, wrong(s.item) ? wrongOf(s) : right(s));
      events.push(r.result.event);
      s = next(r.s);
    }
    return { s, events };
  };
  beforeEach(() => { useApp.getState().resetProgress(); useApp.setState({ goalXp: 20, lastTopic: 'coord' }); });

  it('runs 6 questions: one of each fractions stair and two multiplication facts, one try each', () => {
    const { s, events } = play(() => false);
    expect(s.total).toBe(6);
    expect(events).toHaveLength(6);
    expect(events.map((e) => `${e.topic}:${e.level}`).sort()).toEqual(['facts:0', 'facts:0', 'frac:1', 'frac:2', 'frac:3', 'frac:4']);
    // the fractions answers are diagnostic evidence (as an Exam Rescue diagnostic), never practice
    expect(new Set(events.map((e) => e.purpose))).toEqual(new Set(['diagnostic']));
    const r = resultOf(s);
    expect(r).toMatchObject({ kind: 'check', purpose: 'floor', right: 6, asked: 6, passed: true, xp: XP.diagnostic });
    expect(r.perSkill).toEqual({ 'frac:1': { right: 1, asked: 1 }, 'frac:2': { right: 1, asked: 1 }, 'frac:3': { right: 1, asked: 1 }, 'frac:4': { right: 1, asked: 1 }, 'facts:0': { right: 2, asked: 2 } });
  });
  it('a missed fractions question writes learn.floor with the unit on; the day counts a lesson; the map stays where it was', () => {
    const { s, events } = play((it) => it.topic === 'frac' && it.level === 3);
    events.forEach((e) => useApp.getState().recordAnswer(e, 0));
    const award = useApp.getState().completeCheck(resultOf(s));
    const st = useApp.getState();
    expect(st.learn.floor).toMatchObject({ on: true, results: { 'frac:3': { asked: 1, right: 0 }, 'frac:1': { asked: 1, right: 1 } }, facts: { asked: 2, right: 2 } });
    expect(st.learn.skills['frac:3'].attempts).toHaveLength(1);
    expect(st.learn.skills['facts:0']).toBeUndefined(); // facts are on no stair
    expect(st.days[today()]).toMatchObject({ lessons: 1, q: 6, ok: 5, xp: XP.diagnostic });
    expect(award.streakExtended).toBe(true);
    expect(st.lastTopic).toBe('coord'); // a check of the basics is not practice in them
    expect(st.path).toEqual({}); // nothing on the path is done or started by it
  });
  it('nothing missed: the floor is recorded and stays off the map', () => {
    const { s } = play(() => false);
    useApp.getState().completeCheck(resultOf(s));
    expect(useApp.getState().learn.floor).toMatchObject({ on: false, facts: { asked: 2, right: 2 } });
  });
  it('facts missed only: recorded, and the fractions unit stays off', () => {
    const { s } = play((it) => it.topic === 'facts');
    const r = resultOf(s);
    expect(r).toMatchObject({ right: 4, asked: 6, passed: true });
    useApp.getState().completeCheck(r);
    expect(useApp.getState().learn.floor).toMatchObject({ on: false, facts: { asked: 2, right: 0 } });
  });
  it('the student hides the unit again (setFloor): the evidence stays', () => {
    const { s } = play((it) => it.topic === 'frac' && it.level === 1);
    useApp.getState().completeCheck(resultOf(s));
    const before = useApp.getState().learn.floor;
    useApp.getState().setFloor({ on: false });
    expect(useApp.getState().learn.floor).toEqual({ ...before, on: false });
  });
  it('with no floor check yet there is nothing to switch', () => {
    useApp.getState().setFloor({ on: true });
    expect(useApp.getState().learn.floor).toBeNull();
  });
});

describe('multiplication facts (/facts)', () => {
  beforeEach(() => { useApp.getState().resetProgress(); useApp.setState({ goalXp: 20, lastTopic: 'signed' }); });

  it('is 8 facts with practice rules, on no stair', () => {
    let s = startLesson({ kind: 'facts', n: 8 });
    expect(s.total).toBe(8);
    expect(s.item).toMatchObject({ topic: 'facts', level: 0 });
    // a first miss gets a hint and a second try; a second miss shows the answer and a fact comes back at the end
    let r = answer(s, wrongOf(s)); s = r.s;
    expect(r.result.retry).toBe(true); expect(s.hint).toBe(true);
    expect(r.result.event).toMatchObject({ topic: 'facts', level: 0, purpose: 'practice', cat: null });
    r = answer(s, wrongOf(s)); s = next(r.s);
    s = run(s, Array(7).fill(true));
    expect(s.redoing).toBe(true); expect(s.item).toMatchObject({ topic: 'facts', redo: true });
    s = run(s, [true]);
    expect(s.finished).toBe(true);
    expect(resultOf(s)).toMatchObject({ kind: 'facts', topic: 'facts', level: 0, passed: true, xp: XP.lesson + XP.fix });
  });
  it('a finished facts lesson is a lesson of the day with practice XP, and records nothing in learn.skills, the path or the topic levels', () => {
    let s = startLesson({ kind: 'facts', n: 8 }); const events = [];
    for (let k = 0; k < 8; k += 1) { const r = answer(s, right(s)); events.push(r.result.event); s = next(r.s); }
    events.forEach((e) => useApp.getState().recordAnswer(e, 0));
    const learnBefore = useApp.getState().learn;
    const award = useApp.getState().completeLesson(resultOf(s));
    const st = useApp.getState();
    expect(st.learn).toBe(learnBefore); // the facts answers changed nothing in the learning record
    expect(st.learn.skills).toEqual({});
    expect(st.path).toEqual({});
    expect(st.progress).toEqual({});
    expect(st.lastTopic).toBe('signed');
    expect(st.days[today()]).toMatchObject({ lessons: 1, q: 8, ok: 8, xp: XP.lesson + XP.perfect, perfect: 1 });
    expect(st.xp).toBe(XP.lesson + XP.perfect);
    expect(award).toMatchObject({ streakExtended: true, streak: 1, practiceDone: false, unitDone: false });
  });
});
