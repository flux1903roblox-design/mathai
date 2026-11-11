// The Sunday recap (STUDENT-6, FOLLOWUP-38): when its card shows, with a fixed clock, and the sheet's lines. The week is
// learn/report.ts weekLocal, the same call /report makes for "השבוע שעבר".
import { describe, it, expect, afterEach, vi } from 'vitest';
import { recapStart, recapDue, recapShown } from './recap.js';
import { today } from './store.js';
import { weekLocal } from '@/learn/report.ts';
import { emptyLearn } from '@/learn/storeGlue.ts';
import { bestLine, classLine, earnedIn } from '@/components/learn/RecapSheet.jsx';

/** Last week (Sunday 8 to Shabbat 14 November 2026): three days with lessons and a mastery check passed. Synthetic. */
const lastWeek = () => ({
  days: {
    '2026-11-08': { lessons: 1, q: 8, secs: 300 },
    '2026-11-10': { lessons: 2, stages: 1, mp: 1, q: 16, secs: 600 },
    '2026-11-12': { stages: 2, q: 4, secs: 120 },
  },
  learn: { ...emptyLearn(), events: [{ t: '2026-11-10T14:00:00.000Z', e: 'check-done', s: 'signed:1', p: 'mastery', ok: true }] },
});
const clockAt = (iso) => { vi.useFakeTimers(); vi.setSystemTime(new Date(iso)); return { today: today(), now: new Date().toISOString() }; };
const weekFor = (input, day) => weekLocal(input, recapStart(day), { today: day, now: `${day}T10:00:00.000Z` });

afterEach(() => { vi.useRealTimers(); });

describe('when the Sunday recap shows', () => {
  it('Sunday 2026-11-15, after a week with learning: shown, for the week of 8 November', () => {
    const { today: d } = clockAt('2026-11-15T10:00:00');
    expect(d).toBe('2026-11-15');
    const week = weekFor(lastWeek(), d);
    expect(week).toMatchObject({ start: '2026-11-08', end: '2026-11-14', activeDays: 3, mastered: ['signed:1'], empty: false });
    expect(recapDue({ today: d })).toBe('2026-11-08');
    expect(recapShown({ today: d }, week)).toBe(true);
  });

  it('Monday and Tuesday still show it; Wednesday to Shabbat never', () => {
    for (const [day, shown] of [['2026-11-16', true], ['2026-11-17', true], ['2026-11-18', false], ['2026-11-19', false], ['2026-11-20', false], ['2026-11-21', false]]) {
      const { today: d } = clockAt(`${day}T10:00:00`);
      expect(recapShown({ today: d }, weekFor(lastWeek(), d)), day).toBe(shown);
    }
  });

  it('an empty week: not shown (no guilt after a week off)', () => {
    const { today: d } = clockAt('2026-11-15T10:00:00');
    const week = weekFor({ days: { '2026-11-15': { lessons: 1 } }, learn: emptyLearn() }, d); // only this week has learning
    expect(week.empty).toBe(true);
    expect(recapShown({ today: d }, week)).toBe(false);
  });

  it('already seen (closed) this week: not shown again, and next Sunday it is due again', () => {
    const { today: d } = clockAt('2026-11-15T10:00:00');
    expect(recapShown({ today: d, seen: '2026-11-08' }, weekFor(lastWeek(), d))).toBe(false);
    expect(recapDue({ today: '2026-11-22', seen: '2026-11-08' })).toBe('2026-11-15');
  });

  it('never right after a lesson, never on a holiday, and never for another week than its own', () => {
    const { today: d } = clockAt('2026-11-15T10:00:00');
    expect(recapShown({ today: d, afterLesson: true }, weekFor(lastWeek(), d))).toBe(false);
    expect(recapDue({ today: '2026-09-21' })).toBeNull(); // Yom Kippur 2026, a Monday
    expect(recapShown({ today: d }, weekLocal(lastWeek(), '2026-11-01', { today: d, now: `${d}T10:00:00.000Z` }))).toBe(false);
    expect(recapShown({ today: d }, null)).toBe(false); // the engine has not loaded yet
  });
});

describe('the recap sheet\'s lines', () => {
  it('the personal best: a new best, the week against the best, nothing without steps', () => {
    expect(bestLine(9, { steps: 6, week: '2026-11-01' })).toBe('שיא שבועי חדש: 9 צעדים!');
    expect(bestLine(1, null)).toBe('שיא שבועי חדש: צעד אחד!');
    expect(bestLine(4, { steps: 9, week: '2026-11-01' })).toBe('4 צעדים. השיא שלכם: 9.');
    expect(bestLine(1, { steps: 1, week: '2026-11-01' })).toBe('צעד אחד. השיא שלכם: צעד אחד.');
    expect(bestLine(0, { steps: 9 })).toBe('');
  });

  it('the class: reached together, reached without this student\'s steps (calm), and not reached', () => {
    expect(classLine({ target: 55, have: 61, mine: 7, reached: true })).toBe('הכיתה: 61 מתוך 55. הגעתם למטרה יחד. החלק שלכם: 7 צעדים.');
    expect(classLine({ target: 55, have: 61, mine: 0, reached: true })).toBe('הכיתה: 61 מתוך 55. הכיתה הגיעה למטרה.');
    expect(classLine({ target: 60, have: 23, mine: 1, reached: false })).toBe('הכיתה: 23 מתוך 60. החלק שלכם: צעד אחד.');
    expect(classLine(undefined)).toBe('');
  });

  it('what Madi earned that week: by look.earnedAt, only what is owned, oldest first', () => {
    const look = { earned: ['thermo-scarf', 'gold', 'compass-cap'], earnedAt: { 'compass-cap': '2026-11-12', 'thermo-scarf': '2026-11-03', gold: '2026-11-09', 'x-cap': '2026-11-10' } };
    expect(earnedIn(look, '2026-11-08', '2026-11-14')).toEqual(['gold', 'compass-cap']);
    expect(earnedIn({}, '2026-11-08', '2026-11-14')).toEqual([]);
  });
});
