// A calm streak (STUDENT-5): rest days on Shabbat and Yom Tov, an earned repair at most once in 30 days, counters that
// never reset, and the student's own weeks (PRODUCT2-39): each week's stages and practice days, this week against last
// week (the ghost race), and the personal best. Pure functions, on fixed dates.
import { describe, it, expect } from 'vitest';
import { streakAt, streakRepair, streakNow, lastSchoolDay, learnDaysThisMonth, learnDaysTotal, weekStart, weekTotals, personalBest, ghostRace, daysBetween, STREAK_MILESTONES, streakMilestone } from './streak.js';
import { useApp } from './store.js';

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

describe('the student\'s own weeks: totals, the ghost race and the personal best (PRODUCT2-39)', () => {
  it('5. weekTotals: stages are finished lessons, checks and teaching stages (1 each); days are days with one of them', () => {
    expect(weekStart('2026-11-05')).toBe('2026-11-01');
    expect(weekStart('2026-11-01')).toBe('2026-11-01');
    expect(weekStart('2026-11-07')).toBe('2026-11-01');
    const days = {
      '2026-11-01': { lessons: 1, mp: 1 }, // a passed mastery check is one stage, like any other
      '2026-11-02': { lessons: 2 },
      '2026-11-03': { stages: 2 },
      '2026-11-04': { q: 9, ok: 7, lessons: 0 }, // answers alone: no stage and no practice day
      '2026-11-05': { frozen: true }, // a freeze keeps the streak, but it is not a practice day
      '2026-11-08': L(5), // Sunday the 8th is next week
    };
    expect(weekTotals(days, '2026-11-01')).toEqual({ stages: 5, days: 3 });
    expect(weekTotals(days, '2026-11-08')).toEqual({ stages: 5, days: 1 });
    expect(weekTotals({}, '2026-11-01')).toEqual({ stages: 0, days: 0 });
  });
  it('6. personalBest looks only at weeks before this one: the most stages in a week and the most practice days', () => {
    const days = {
      '2026-10-19': L(2), '2026-10-20': L(2), '2026-10-21': L(2), // 6 stages over 3 days, week of 18.10
      '2026-10-26': L(7), // 7 stages on one day, week of 25.10
      '2026-11-02': L(10), '2026-11-03': L(1), '2026-11-04': L(1), '2026-11-05': L(1), // this week: not a "before"
    };
    expect(personalBest(days, '2026-11-01')).toEqual({ stages: { n: 7, week: '2026-10-25' }, days: { n: 3, week: '2026-10-18' } });
    expect(personalBest({ '2026-11-02': L(10) }, '2026-11-01')).toEqual({ stages: null, days: null }); // the first week: no best yet
    // a tie keeps the earlier week
    expect(personalBest({ '2026-10-19': L(3), '2026-10-26': L(3) }, '2026-11-01').stages).toEqual({ n: 3, week: '2026-10-18' });
  });
  it('7. ghostRace: this week against last week (the week just before, even an empty one), and the best before this week', () => {
    const days = {
      '2026-10-19': L(8), // the best: 8 stages, week of 18.10
      '2026-10-26': L(2), '2026-10-28': { stages: 3 }, // last week: 5 stages over 2 days
      '2026-11-01': L(1), '2026-11-03': { stages: 2 }, // this week so far: 3 stages over 2 days
    };
    expect(ghostRace(days, '2026-11-05')).toEqual({
      week: '2026-11-01', lastWeek: '2026-10-25',
      now: { stages: 3, days: 2 }, last: { stages: 5, days: 2 },
      best: { stages: { n: 8, week: '2026-10-18' }, days: { n: 2, week: '2026-10-25' } },
    });
    // on Sunday the race starts again: this week 0, last week what was this week until Shabbat
    expect(ghostRace(days, '2026-11-08')).toMatchObject({ week: '2026-11-08', lastWeek: '2026-11-01', now: { stages: 0, days: 0 }, last: { stages: 3, days: 2 } });
    // a week with no learning before this one is a last week of 0, never skipped over
    expect(ghostRace({ '2026-10-19': L(4) }, '2026-11-05')).toMatchObject({ last: { stages: 0, days: 0 }, best: { stages: { n: 4, week: '2026-10-18' } } });
  });
});

describe('the streak every screen shows today (PRODUCT2-40)', () => {
  // the council's returning student: learned Thu 5, Fri 6, Sun 8 and Mon 9; nothing on Tue 10; today Wed 11
  const back = () => ({ '2026-11-05': L(), '2026-11-06': L(), '2026-11-08': L(), '2026-11-09': L() });
  it('while the missed day can still be repaired, it is the kept streak, at risk, with the repair (never 0)', () => {
    const days = back();
    expect(streakAt(days, '2026-11-11')).toBe(0);
    expect(streakNow(days, '2026-11-11', null)).toEqual({ n: 4, atRisk: true, repair: { gap: '2026-11-10', streak: 4, left: 2 } });
    // one lesson today: still at risk, one item left, and the number does not drop to today's 1
    days['2026-11-11'] = L(1);
    expect(streakNow(days, '2026-11-11', null)).toEqual({ n: 4, atRisk: true, repair: { gap: '2026-11-10', streak: 4, left: 1 } });
  });
  it('once repaired, or on an ordinary day, it is the streak itself and not at risk', () => {
    const days = { ...back(), '2026-11-10': { frozen: 'repair' }, '2026-11-11': L(2) };
    expect(streakNow(days, '2026-11-11', '2026-11-11')).toEqual({ n: 5, atRisk: false, repair: null });
    expect(streakNow(five(), '2026-11-10', null)).toEqual({ n: 5, atRisk: false, repair: null }); // nothing yet today: yesterday counts
  });
  it('a gap that cannot be repaired (a repair used this month, or a streak of 1) is a plain 0', () => {
    expect(streakNow(back(), '2026-11-11', '2026-11-01')).toEqual({ n: 0, atRisk: false, repair: null });
    expect(streakNow({ '2026-11-09': L() }, '2026-11-11', null)).toEqual({ n: 0, atRisk: false, repair: null });
  });
});

// Streak milestones (PRODUCT2-38): 3, 7 and 30 days in a row each get their own moment, once. Never a countdown to the
// next one: the function only answers whether the result in hand reached one.
describe('streak milestones at 3, 7 and 30 days, each shown once', () => {
  const kept = (streak, extra = {}) => ({ streakExtended: true, streak, ...extra });
  it('are 3, 7 and 30', () => {
    expect(STREAK_MILESTONES).toEqual([3, 7, 30]);
  });
  it('a result that brings the streak to 3, 7 or 30 reaches that milestone', () => {
    expect(streakMilestone(kept(3), {})).toBe(3);
    expect(streakMilestone(kept(7), {})).toBe(7);
    expect(streakMilestone(kept(30), undefined)).toBe(30);
    // a repaired streak counts too (the moment the repair keeps it)
    expect(streakMilestone({ streakRepaired: true, streak: 7 }, {})).toBe(7);
  });
  it('other days are not milestones, and a result that did not move the streak brings none', () => {
    for (const n of [1, 2, 4, 6, 8, 29, 31, 60]) expect(streakMilestone(kept(n), {})).toBe(null);
    expect(streakMilestone({ streak: 3 }, {})).toBe(null); // the second lesson of the day: the streak was already 3
    expect(streakMilestone(null, {})).toBe(null);
  });
  it('a milestone already shown is not shown again', () => {
    expect(streakMilestone(kept(3), { 3: '2026-11-05' })).toBe(null);
    expect(streakMilestone(kept(7), { 3: '2026-11-05' })).toBe(7);
  });
  it('the store remembers each milestone once it is shown (nudges.streakSeen), and a progress reset forgets them', () => {
    useApp.setState({ nudges: { ...useApp.getInitialState().nudges } });
    expect(useApp.getState().nudges.streakSeen).toEqual({});
    for (const m of [3, 7, 30]) {
      expect(streakMilestone(kept(m), useApp.getState().nudges.streakSeen)).toBe(m);
      useApp.getState().markMilestone(m);
      expect(streakMilestone(kept(m), useApp.getState().nudges.streakSeen)).toBe(null);
    }
    expect(Object.keys(useApp.getState().nudges.streakSeen)).toEqual(['3', '7', '30']);
    useApp.getState().resetProgress();
    expect(useApp.getState().nudges.streakSeen).toEqual({});
  });
});
