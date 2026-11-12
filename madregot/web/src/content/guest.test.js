// Guest stairs on the teacher's screens and in Exam Rescue (stage5.md FUNC-6 item 6): the guest rows, the stairs each
// shows, a student's place on them, Rescue's rule for a later grade's unit, class exams drawn from guest stairs, and the
// report's CSV column.
import { describe, it, expect } from 'vitest';
import { TOPIC, topicsFor, guestTopicsFor, classTopicsFor, rowStairs, rowTitle, rowLevel, rowLevelText, rescueTopicsFor, GUEST_STATE } from './index.js';
import { guestStairLevels } from '@/lib/path.js';
import { syncLevels } from '@/lib/api.js';
import { GUEST, gradeSkillsOf } from '@/learn/skills.ts';
import { makeClassExam } from '@/lib/exam.js';
import { reportToCsv, csvTopics } from '@/lib/teacherCsv.js';

const ids = (t) => rowStairs(t).map((s) => s.id);

describe('the guest rows of a grade', () => {
  it('ח׳: the equations unit with eq:6 and eq:7 only; ז׳: the functions unit with func:1 only', () => {
    expect(guestTopicsFor('8').map((t) => [t.id, t.only])).toEqual([['eq', ['eq:6', 'eq:7']]]);
    expect(guestTopicsFor('7').map((t) => [t.id, t.only])).toEqual([['func', ['func:1']]]);
    expect(ids(guestTopicsFor('8')[0])).toEqual(['eq:6', 'eq:7']);
    expect(ids(guestTopicsFor('7')[0])).toEqual(['func:1']);
    // a copy: the unit itself keeps every stair
    expect(TOPIC.eq.only).toBeUndefined();
    expect(ids(TOPIC.eq)).toHaveLength(7);
  });

  it('every guest stair of GUEST is on exactly one row, after the grade\'s own units', () => {
    for (const g of ['7', '8']) {
      const list = classTopicsFor(g);
      expect(list.slice(0, topicsFor(g).length)).toEqual(topicsFor(g));
      const guest = list.slice(topicsFor(g).length);
      expect(guest.flatMap(ids)).toEqual(GUEST[g]);
      guest.forEach((t) => expect(t.grade).not.toBe(g));
      // no stair twice on a teacher's screen
      const all = list.flatMap(ids);
      expect(new Set(all).size).toBe(all.length);
      expect(all.filter((id) => !GUEST[g].includes(id))).toEqual(gradeSkillsOf(g));
    }
  });

  it('a row is named with its stairs when it is a guest row', () => {
    expect(rowTitle(guestTopicsFor('8')[0])).toBe('משוואות: מדרגות 6–7');
    expect(rowTitle(guestTopicsFor('7')[0])).toBe('מבוא לפונקציות: מדרגה 1');
    expect(rowTitle(TOPIC.eq)).toBe('משוואות');
    expect(rowTitle({ ...TOPIC.eq, only: ['eq:2', 'eq:6'] })).toBe('משוואות: מדרגות 2, 6');
  });

  it('a student\'s place on a guest row comes from each of its own stairs, never from the unit\'s level', () => {
    const eq = guestTopicsFor('8')[0]; const func = guestTopicsFor('7')[0];
    const P = { level: GUEST_STATE.practised, max: GUEST_STATE.practised }; const M = { level: GUEST_STATE.mastered, max: GUEST_STATE.mastered };
    expect(rowLevel(eq, null)).toBeNull();
    expect(rowLevel(eq, {})).toBeNull();
    // a ח׳ student who only revised a ז׳ eq stair (eq:3, or an eq:1 repair): the unit has a level, the row has nothing
    expect(rowLevel(eq, { eq: { level: 1, max: 1 } })).toBeNull();
    expect(rowLevel(eq, { eq: { level: 7, max: 7 } })).toBeNull();
    // eq:6 opened: eq:6 is the current stair; mastered: eq:7 is; both mastered: the row is done
    expect(rowLevel(eq, { 'eq:6': P })).toMatchObject({ total: 2, level: 1, title: 'שאלות תנועה', states: ['cur', 'todo'], done: false });
    expect(rowLevel(eq, { 'eq:6': M })).toMatchObject({ total: 2, level: 2, title: 'משוואות עם מכנים ופרופורציה', states: ['done', 'cur'], done: false });
    expect(rowLevel(eq, { 'eq:6': M, 'eq:7': P })).toMatchObject({ level: 2, states: ['done', 'cur'], done: false });
    expect(rowLevel(eq, { 'eq:6': M, 'eq:7': M })).toMatchObject({ level: 2, max: 2, states: ['done', 'done'], done: true });
    // eq:7 practised first (sent there by the teacher): eq:7 is the stair worked on, eq:6 still ahead
    expect(rowLevel(eq, { 'eq:7': P })).toMatchObject({ level: 2, states: ['todo', 'cur'], done: false });
    // a mastered stair that a failed check reopened (now practised, max kept): practised again
    expect(rowLevel(eq, { 'eq:6': { level: 1, max: 2 } })).toMatchObject({ level: 1, states: ['cur', 'todo'] });
    // ז׳: func:1 opened and func:1 mastered are two different cells (the unit's func level is not read)
    expect(rowLevel(func, { 'func:1': P })).toMatchObject({ total: 1, level: 1, states: ['cur'], done: false, title: 'קריאת גרף של מצב' });
    expect(rowLevel(func, { 'func:1': M })).toMatchObject({ total: 1, level: 1, states: ['done'], done: true });
    expect(rowLevel(func, { func: { level: 2, max: 2 } })).toBeNull();
    expect([rowLevelText(rowLevel(func, { 'func:1': P })), rowLevelText(rowLevel(func, { 'func:1': M })), rowLevelText(null)]).toEqual(['1/1', 'הושלם', '–']);
    // a whole unit, as before
    expect(rowLevel(TOPIC.signed, { signed: { level: 2, max: 3 } })).toEqual({ total: TOPIC.signed.levels.length, level: 2, max: 3, title: TOPIC.signed.levels[1].title });
    expect(rowLevel(TOPIC.signed, { 'signed:2': M })).toBeNull();
  });

  it('the levels a class sync sends carry each guest stair the student touched, under its own id', () => {
    const P = { level: GUEST_STATE.practised, max: GUEST_STATE.practised }; const M = { level: GUEST_STATE.mastered, max: GUEST_STATE.mastered };
    expect(guestStairLevels({}, { skills: {} })).toEqual({});
    // eq:6 practised (a practice lesson), eq:7 taught (a teaching stage), func:1 mastered (its check passed)
    const path = { eq: { parts: { 6: 1 }, done: {} }, func: { parts: { 1: 2 }, done: { 1: 'mastered' } } };
    const learn = { skills: { 'eq:7': { taught: { A: '2026-12-01' }, attempts: [] } } };
    expect(guestStairLevels(path, learn)).toEqual({ 'eq:6': P, 'eq:7': P, 'func:1': M });
    // a ז׳ eq stair or another stair of the unit is never sent under its own id
    expect(guestStairLevels({ eq: { parts: { 3: 2 }, done: { 3: 'mastered' } } }, { skills: { 'func:2': { attempts: [{}] } } })).toEqual({});
    // and the sync's levels are the units' progress with them, which rowLevel reads back
    const app = { progress: { eq: { level: 1, max: 1 }, func: { level: 2, max: 2 } }, path, learn };
    const sent = syncLevels(app);
    expect(sent).toEqual({ eq: { level: 1, max: 1 }, func: { level: 2, max: 2 }, 'eq:6': P, 'eq:7': P, 'func:1': M });
    expect(rowLevel(guestTopicsFor('7')[0], sent)).toMatchObject({ done: true });
    expect(rowLevel(guestTopicsFor('8')[0], sent)).toMatchObject({ level: 1, states: ['cur', 'todo'] });
  });
});

describe('Exam Rescue and the exam check (rescueTopicsFor)', () => {
  it('a ז׳ student\'s "מבוא לפונקציות" row is func:1 alone; func carries alsoFor ז׳', () => {
    expect(TOPIC.func.alsoFor).toEqual(['7']);
    const func = rescueTopicsFor('7').find((t) => t.id === 'func');
    expect(func.only).toEqual(['func:1']);
    expect(ids(func)).toEqual(['func:1']);
  });

  it('a ח׳ student\'s equations row is the whole unit, as before: a ח׳ test revises the ז׳ unit', () => {
    const eq = rescueTopicsFor('8').find((t) => t.id === 'eq');
    expect(eq.only).toBeUndefined();
    expect(ids(eq)).toEqual(['eq:1', 'eq:2', 'eq:3', 'eq:4', 'eq:5', 'eq:6', 'eq:7']);
    // the other rows are unchanged: own units first, then the other grade's revised whole
    expect(rescueTopicsFor('8').filter((t) => t.only)).toEqual([]);
    expect(rescueTopicsFor('7').filter((t) => t.only).map((t) => t.id)).toEqual(['func']);
    expect(rescueTopicsFor('7').slice(0, topicsFor('7').length)).toEqual(topicsFor('7'));
  });
});

describe('a class exam on guest stairs', () => {
  it('draws eq:6 and eq:7 through makeItem, at their own levels, and leaves the practice-only items out', () => {
    for (let n = 0; n < 12; n += 1) {
      const { items, skipped } = makeClassExam(['eq:6', 'eq:7'], 14);
      expect(skipped).toEqual([]);
      expect(items).toHaveLength(14);
      items.forEach((it) => {
        expect(it.topic).toBe('eq');
        expect([6, 7]).toContain(it.level);
        // eq6t (the table choice) and eq7l (the common denominator choice) are practice only
        expect(it.key).not.toMatch(/^eq6t:|^eq7l:/);
      });
      expect(items.filter((it) => it.level === 6)).toHaveLength(7);
    }
  });
});

describe('the report\'s CSV', () => {
  it('has the guest row\'s column after the grade\'s, with the place among its own stairs', () => {
    const topics = csvTopics('8');
    expect(topics.at(-1)).toMatchObject({ id: 'eq', title: 'משוואות: מדרגות 6–7', only: ['eq:6', 'eq:7'] });
    const M = { level: GUEST_STATE.mastered, max: GUEST_STATE.mastered };
    const row = (name, levels) => ({ name, activeDays: 1, exercises: 4, firstTry: 3, minutes: 5, lastPractice: null, levels, topMistakes: [] });
    const report = {
      assignments: [],
      students: [
        row('דנה', { eq: { level: 1, max: 1 }, 'eq:6': M }),
        row('יואב', {}),
        // only a ז׳ stair revised: the unit has a level, the guest column stays empty
        row('נועה', { eq: { level: 3, max: 3 } }),
        row('תמר', { 'eq:6': M, 'eq:7': M }),
      ],
    };
    const [head, dana, yoav, noa, tamar] = reportToCsv(report, { topics, mistakeText: () => '' }).replace(/^\uFEFF/, '').split('\r\n');
    expect(head).toContain(',משוואות: מדרגות 6–7,');
    const col = head.split(',').indexOf('משוואות: מדרגות 6–7');
    expect([dana, yoav, noa, tamar].map((l) => l.split(',')[col])).toEqual(['2/2 – משוואות עם מכנים ופרופורציה', '', '', '2/2 – הושלם']);
    expect(yoav.split(',')).toHaveLength(head.split(',').length);
  });

  it('ז׳: a student who opened func:1 and one who mastered it are two different cells', () => {
    const topics = csvTopics('7');
    const row = (name, levels) => ({ name, activeDays: 1, exercises: 3, firstTry: 2, minutes: 5, lastPractice: null, levels, topMistakes: [] });
    const report = { assignments: [], students: [
      row('א', { func: { level: 1, max: 1 }, 'func:1': { level: GUEST_STATE.practised, max: GUEST_STATE.practised } }),
      row('ב', { func: { level: 1, max: 1 }, 'func:1': { level: GUEST_STATE.mastered, max: GUEST_STATE.mastered } }),
    ] };
    const [head, a, b] = reportToCsv(report, { topics, mistakeText: () => '' }).replace(/^\uFEFF/, '').split('\r\n');
    const col = head.split(',').indexOf('מבוא לפונקציות: מדרגה 1');
    expect(col).toBeGreaterThan(0);
    expect([a.split(',')[col], b.split(',')[col]]).toEqual(['1/1 – קריאת גרף של מצב', '1/1 – הושלם']);
  });
});
