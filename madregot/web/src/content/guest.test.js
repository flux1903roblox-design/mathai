// Guest stairs on the teacher's screens and in Exam Rescue (stage5.md FUNC-6 item 6): the guest rows, the stairs each
// shows, a student's place on them, Rescue's rule for a later grade's unit, class exams drawn from guest stairs, and the
// report's CSV column.
import { describe, it, expect } from 'vitest';
import { TOPIC, topicsFor, guestTopicsFor, classTopicsFor, rowStairs, rowTitle, rowLevel, rescueTopicsFor } from './index.js';
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

  it('a student\'s place on a guest row comes from the unit\'s level, among the row\'s own stairs', () => {
    const eq = guestTopicsFor('8')[0];
    expect(rowLevel(eq, null)).toBeNull();
    // nothing of it yet (level 1), or eq:1-5 done in ז׳ (level 6): eq:6 is the current stair
    expect(rowLevel(eq, { level: 1, max: 1 })).toEqual({ total: 2, level: 1, max: 1, title: 'שאלות תנועה' });
    expect(rowLevel(eq, { level: 6, max: 6 })).toEqual({ total: 2, level: 1, max: 1, title: 'שאלות תנועה' });
    // eq:6 mastered: eq:7 is current
    expect(rowLevel(eq, { level: 7, max: 7 })).toEqual({ total: 2, level: 2, max: 2, title: 'משוואות עם מכנים ופרופורציה' });
    // a whole unit, as before
    expect(rowLevel(TOPIC.signed, { level: 2, max: 3 })).toEqual({ total: TOPIC.signed.levels.length, level: 2, max: 3, title: TOPIC.signed.levels[1].title });
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
    const report = {
      assignments: [],
      students: [
        { name: 'דנה', activeDays: 1, exercises: 4, firstTry: 3, minutes: 5, lastPractice: null, levels: { eq: { level: 7, max: 7 } }, topMistakes: [] },
        { name: 'יואב', activeDays: 0, exercises: 0, firstTry: 0, minutes: 0, lastPractice: null, levels: {}, topMistakes: [] },
      ],
    };
    const [head, dana, yoav] = reportToCsv(report, { topics, mistakeText: () => '' }).replace(/^\uFEFF/, '').split('\r\n');
    expect(head).toContain(',משוואות: מדרגות 6–7,');
    expect(dana).toContain(',2/2 – משוואות עם מכנים ופרופורציה,');
    expect(yoav.split(',')).toHaveLength(head.split(',').length);
  });
});
