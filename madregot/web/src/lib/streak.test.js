// A calm streak (STUDENT-5): rest days on Shabbat and Yom Tov, an earned repair at most once in 30 days, counters that
// never reset, and a weekly personal best in steps. Pure functions, on fixed dates.
import { describe, it, expect } from 'vitest';
import { streakAt, streakRepair, lastSchoolDay, learnDaysThisMonth, learnDaysTotal, weekStart, weekSteps, bestWeek, stepsOn, daysBetween } from './streak.js';

const L = (n = 1, extra = {}) => ({ lessons: n, ...extra });
// Wed 4, Thu 5, Fri 6, (Shabbat 7), Sun 8, Mon 9 November 2026: a streak of 5 ending on Monday the 9th
const five = () => ({ '2026-11-04': L(), '2026-11-05': L(), '2026-11-06': L(), '2026-11-08': L(), '2026-11-09': L() });

describe('the streak and its repair', () => {
  it('1. streak 5 ending 2026-11-09, nothing on the 10th, two lessons on the 11th: repaired, streak 6', () => {
    const days = five();
    expect(streakAt(days, '2026-11-09')).toBe(5);
    expect(streakAt(days, '2026-11-11')).toBe(0); // Tuesday the 10th had no learning
    expect(streakRepair(days, '2026-11-11', null)).toEqual({ gap: '2026-11-10', streak: 5, left: 2 });
    days['2026-11-11'] = L(1);
    expect(streakRepair(days, '2026-11-11', null)).toEqual({ gap: '2026-11-10', streak: 5, left: 1 });
    days['2026-11-11'] = L(2);
    days['2026-11-10'] = { frozen: 'repair' }; // what the store saves when the second item is finished
    expect(streakAt(days, '2026-11-11')).toBe(6);
    expect(streakRepair(days, '2026-11-11', '2026-11-11')).toBeNull();
  });
  it('2. a second miss within 30 days is not repairable; after 30 days it is again', () => {
    const days = { ...five(), '2026-11-10': { frozen: 'repair' }, '2026-11-11': L(2) };
    ['2026-11-12', '2026-11-13', '2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19'].forEach((k) => { days[k] = L(); });
    // nothing on Friday the 20th; Saturday the 21st is Shabbat; Sunday the 22nd
    expect(streakRepair(days, '2026-11-22', '2026-11-11')).toBeNull();
    expect(daysBetween('2026-11-11', '2026-12-11')).toBe(30);
    const later = { '2026-12-08': L(), '2026-12-09': L() }; // nothing on Thursday the 10th
    expect(streakRepair(later, '2026-12-11', '2026-11-11')).toMatchObject({ gap: '2026-12-10', streak: 2 });
    expect(streakRepair(later, '2026-12-10', '2026-11-11')).toBeNull(); // 29 days: not yet (and the 9th was not missed)
  });
  it('3. Yom Kippur (Monday 2026-09-21) without learning keeps the streak', () => {
    const days = { '2026-09-17': L(), '2026-09-18': L(), '2026-09-20': L(), '2026-09-22': L() };
    expect(streakAt(days, '2026-09-22')).toBe(4); // Thu, Fri, (Shabbat), Sun, (Yom Kippur), Tue
    expect(streakRepair(days, '2026-09-22', null)).toBeNull(); // nothing was missed
    expect(streakRepair(days, '2026-09-21', null)).toBeNull(); // and never on a rest day
  });
  it('4. a Saturday with learning still adds a day', () => {
    const days = { '2026-11-13': L(), '2026-11-14': L(), '2026-11-15': L() };
    expect(streakAt(days, '2026-11-15')).toBe(3);
  });
  it('a missed Friday is repaired on Sunday: Shabbat in between is not a missed day', () => {
    const days = { '2026-11-03': L(), '2026-11-04': L(), '2026-11-05': L() }; // nothing on Friday the 6th
    expect(lastSchoolDay('2026-11-08')).toBe('2026-11-06');
    expect(streakAt(days, '2026-11-08')).toBe(0);
    expect(streakRepair(days, '2026-11-08', null)).toEqual({ gap: '2026-11-06', streak: 3, left: 2 });
    days['2026-11-08'] = L(2); days['2026-11-06'] = { frozen: 'repair' };
    expect(streakAt(days, '2026-11-08')).toBe(4);
  });
  it('nothing to repair: two missed days, a streak of one, a day a freeze covered, or a streak never started', () => {
    expect(streakRepair({ '2026-11-04': L(), '2026-11-05': L() }, '2026-11-09', null)).toBeNull(); // Fri 6 and Sun 8 missed
    expect(streakRepair({ '2026-11-09': L() }, '2026-11-11', null)).toBeNull(); // the streak before the gap was 1
    expect(streakRepair({ ...five(), '2026-11-10': { frozen: true } }, '2026-11-11', null)).toBeNull();
    expect(streakRepair({}, '2026-11-11', null)).toBeNull();
    expect(streakRepair({ ...five(), '2026-11-10': L() }, '2026-11-11', null)).toBeNull(); // yesterday was learned
  });
});

describe('counters that never reset', () => {
  it('7. the month\'s days start again on the 1st; the total does not', () => {
    const days = { '2026-10-30': L(), '2026-10-31': { stages: 1 }, '2026-11-01': L(), '2026-10-29': { q: 0, lessons: 0 } };
    expect(learnDaysThisMonth(days, '2026-10-31')).toBe(2);
    expect(learnDaysThisMonth(days, '2026-11-01')).toBe(1);
    expect(learnDaysTotal(days)).toBe(3);
  });
});

describe('the weekly personal best', () => {
  it('5. weekSteps counts a passed mastery check as 3, and a day without mp counts its lessons as 1 each', () => {
    expect(stepsOn({ lessons: 1, mp: 1 })).toBe(3);
    expect(weekStart('2026-11-05')).toBe('2026-11-01');
    expect(weekStart('2026-11-01')).toBe('2026-11-01');
    expect(weekStart('2026-11-07')).toBe('2026-11-01');
    const days = { '2026-11-01': { lessons: 1, mp: 1 }, '2026-11-02': { lessons: 2 }, '2026-11-03': { stages: 2 }, '2026-11-08': L(5) };
    expect(weekSteps(days, '2026-11-01')).toBe(7); // 3 + 2 + 2; Sunday the 8th is next week
  });
  it('6. bestWeek ignores the current week', () => {
    const days = { '2026-10-26': L(4), '2026-10-19': L(2), '2026-11-02': L(10) };
    expect(bestWeek(days, '2026-11-01')).toEqual({ steps: 4, week: '2026-10-25' });
    expect(bestWeek({ '2026-11-02': L(10) }, '2026-11-01')).toBeNull(); // the first week: no best yet
  });
});
