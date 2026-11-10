// "כדאי לבדוק איתם" (learn/attention.ts, TEACHER-8 §2): a short ranked list instead of everyone the old rule caught.
import { describe, it, expect } from 'vitest';
import { attentionOf, attentionList, rankAll, openHelpBy, reasonText, daysBetween, ATTENTION_TOP, type AttentionStudent } from './attention';

const TODAY = '2026-11-12';
/** 10:00 in Jerusalem, `days` days before today. */
const ago = (days: number) => new Date(Date.parse('2026-11-12T08:00:00Z') - days * 864e5).toISOString();
const st = (id: string, over: Partial<AttentionStudent> = {}): AttentionStudent => ({
  id, name: `תלמיד ${id}`, lastPractice: ago(0), joinedOn: '2026-09-01', week: { n: 20, first: 18 }, openHelp: 0, late: 0, ...over,
});
/** The rule the board used before: no practice for more than 3 days, or 5+ answers this week under 60% first try. */
const oldRule = (s: AttentionStudent) => !s.lastPractice || Date.parse('2026-11-12T08:00:00Z') - Date.parse(s.lastPractice) > 3 * 864e5
  || (s.week.n >= 5 && Math.round((100 * s.week.first) / s.week.n) < 60);

describe('attentionList', () => {
  it('a class of 24 where 22 meet the old rule: the list has 6, sorted by score, and says how many more', () => {
    const students: AttentionStudent[] = [
      st('a', { lastPractice: ago(20) }), // idle 20 → 3 + 14/2 = 10
      st('b', { week: { n: 10, first: 1 } }), // low: 10% → 4 × 0.5 × 10 = 20
      st('c', { lastPractice: ago(4), openHelp: 1 }), // idle 4 (5) + help 3 = 8
      st('d', { lastPractice: null, joinedOn: '2026-11-07' }), // never, joined 5 days ago: 3 + 2.5 = 5.5
      st('e', { week: { n: 8, first: 4 } }), // low: 50% → 4
      st('f', { lastPractice: ago(5), late: 2 }), // idle 5 (5.5) + late 4 = 9.5
      st('g', { week: { n: 6, first: 3 }, late: 1, openHelp: 2 }), // low 4 + help 6 + late 2 = 12
      ...Array.from({ length: 15 }, (_, i) => st(`h${i}`, { lastPractice: ago(4 + (i % 2)) })), // idle 4 or 5 days: 5 or 5.5
      st('ok1'), st('ok2'), // practising and doing well
    ];
    expect(students).toHaveLength(24);
    expect(students.filter(oldRule)).toHaveLength(22);
    const { top, more, all } = attentionList(students, TODAY);
    expect(top).toHaveLength(ATTENTION_TOP);
    expect(top.map((a) => a.student.id)).toEqual(['b', 'g', 'a', 'f', 'c', 'd']);
    expect(top.map((a) => a.score)).toEqual([20, 12, 10, 9.5, 8, 5.5]);
    const scores = all.map((a) => a.score);
    expect(scores).toEqual([...scores].sort((x, y) => y - x));
    expect(more).toBe(22 - 6);
    expect(all.some((a) => a.student.id.startsWith('ok'))).toBe(false);
    // the whole class for the students tab: the same order, those with nothing at the end
    expect(rankAll(students, TODAY).slice(-2).map((a) => a.score)).toEqual([0, 0]);
  });

  it('lists the reasons by their weight in the score, the largest first', () => {
    const g = attentionOf(st('g', { week: { n: 6, first: 3 }, late: 1, openHelp: 2 }), TODAY);
    expect(g.reasons.map((r) => [r.kind, r.weight])).toEqual([['help', 6], ['low', 4], ['late', 2]]);
    const all4 = attentionOf(st('x', { lastPractice: ago(9), week: { n: 5, first: 0 }, openHelp: 1, late: 1 }), TODAY);
    expect(all4.reasons.map((r) => r.kind)).toEqual(['low', 'idle', 'help', 'late']);
    expect(all4.score).toBe(24 + 7.5 + 3 + 2);
    const three = attentionOf(st('t', { lastPractice: ago(3), openHelp: 1, late: 1 }), TODAY);
    expect(three.reasons.map((r) => [r.kind, r.weight])).toEqual([['idle', 4.5], ['help', 3], ['late', 2]]);
    // equal weights keep the stated order: help (one request, 3) before late… and low before help at 3 each
    const tie = attentionOf(st('e', { week: { n: 20, first: 9 }, openHelp: 1 }), TODAY); // 45%: 4 × 0.15 × 10 = 6 vs help 3
    expect(tie.reasons.map((r) => r.kind)).toEqual(['low', 'help']);
    const even = attentionOf(st('v', { openHelp: 2, late: 3 }), TODAY); // 6 and 6
    expect(even.reasons.map((r) => [r.kind, r.weight])).toEqual([['help', 6], ['late', 6]]);
    expect(reasonText(three.reasons[0])).toBe('לא תרגל/ה 3 ימים');
    expect(reasonText({ kind: 'late', weight: 2, n: 1 })).toBe('משימה אחת באיחור');
    expect(reasonText({ kind: 'late', weight: 6, n: 3 })).toBe('3 משימות באיחור');
    expect(reasonText({ kind: 'low', weight: 4, p: 50 })).toBe('50% נכון בניסיון ראשון השבוע');
    expect(reasonText({ kind: 'help', weight: 3, n: 1 })).toBe('בקשת עזרה מחכה');
  });

  it('a student with an open help request and 2 late assignments outranks one idle for 3 days', () => {
    const waiting = st('w', { openHelp: 1, late: 2 });
    const idle = st('i', { lastPractice: ago(3) });
    const a = attentionOf(waiting, TODAY); const b = attentionOf(idle, TODAY);
    expect([a.score, b.score]).toEqual([7, 4.5]);
    expect(attentionList([idle, waiting], TODAY).top.map((x) => x.student.id)).toEqual(['w', 'i']);
    // two days without practice is not idle yet
    expect(attentionOf(st('y', { lastPractice: ago(2) }), TODAY).score).toBe(0);
  });

  it('a never-practised student who joined 5 days ago counts as idle for 5 days', () => {
    const a = attentionOf(st('n', { lastPractice: null, joinedOn: '2026-11-07' }), TODAY);
    expect(a.idleDays).toBe(5);
    expect(a.reasons).toEqual([{ kind: 'idle', weight: 5.5, n: 5, never: true }]);
    expect(reasonText(a.reasons[0])).toBe('עוד לא התחיל/ה לתרגל');
    // joined today: not idle yet; joined long ago: capped at 14 days
    expect(attentionOf(st('t', { lastPractice: null, joinedOn: TODAY }), TODAY).score).toBe(0);
    expect(attentionOf(st('o', { lastPractice: null, joinedOn: '2026-01-01' }), TODAY).score).toBe(10);
    expect(attentionOf(st('u', { lastPractice: null, joinedOn: null }), TODAY).score).toBe(10);
  });
});

describe('helpers', () => {
  it('counts open help requests per student, and days between two dates', () => {
    expect(openHelpBy([{ studentId: 'a', done_at: null }, { studentId: 'a' }, { studentId: 'a', done_at: '2026-11-11T10:00:00Z' }, { studentId: 'b' }, {}])).toEqual({ a: 2, b: 1 });
    expect(daysBetween('2026-11-07', '2026-11-12')).toBe(5);
    expect(daysBetween('2026-11-12', '2026-11-12')).toBe(0);
    expect(daysBetween('2026-11-13', '2026-11-12')).toBe(0);
    // last practice late in the evening in Jerusalem (after midnight UTC+2 is the next day) counts by the Jerusalem day
    expect(attentionOf(st('j', { lastPractice: '2026-11-08T22:30:00Z' }), TODAY).idleDays).toBe(3);
  });
});
