// A fixed week for the staging copy's screenshots of the weekly summary (?qa-report=week|empty, lib/qaFixtures.js):
// a student's saved days and learning, and a fixed clock (Thursday 12 November 2026), so the report, the share sheet
// and the profile's card look the same on every visit. Loaded only with the report screens. Synthetic data only.
import { emptyLearn } from '@/learn/storeGlue.ts';

const TODAY = '2026-11-12';
const NOW = '2026-11-12T15:00:00.000Z';
const ev = (t, e, extra = {}) => ({ t, e, ...extra });
const misc = (skill, id, score, state) => ({ skill, id, score, seen: [], state, at: '2026-11-11T14:00:00.000Z' });

const LAST_WEEK = {
  '2026-11-02': { lessons: 1, q: 8, ok: 7, secs: 300, tsecs: 600, xp: 15 },
  '2026-11-04': { lessons: 2, q: 16, ok: 13, secs: 640, tsecs: 1200, xp: 25 },
  '2026-11-05': { stages: 2, q: 4, ok: 4, secs: 120, tsecs: 900, xp: 10 },
};

function week() {
  return {
    days: {
      ...LAST_WEEK,
      '2026-11-08': { lessons: 1, stages: 2, q: 12, ok: 10, secs: 360, tsecs: 1080, xp: 20 },
      '2026-11-09': { lessons: 2, q: 18, ok: 15, secs: 700, tsecs: 1500, xp: 30 },
      '2026-11-11': { lessons: 1, stages: 1, q: 10, ok: 8, secs: 420, tsecs: 960, xp: 18 },
      '2026-11-12': { lessons: 1, q: 9, ok: 8, secs: 330, tsecs: 720, xp: 14 },
    },
    learn: {
      ...emptyLearn(),
      skills: {
        'signed:1': { attempts: [], mastered: { at: '2026-11-08T10:30:00.000Z', box: 0, due: '2026-11-22T00:00:00.000Z' } },
        'signed:2': { attempts: [], mastered: { at: '2026-11-11T14:30:00.000Z', box: 0, due: '2026-11-25T00:00:00.000Z' } },
      },
      miscon: {
        'signed:2|neg-compare': misc('signed:2', 'neg-compare', 2.5, 'confirmed'),
        'coord:1|swap': misc('coord:1', 'swap', 2, 'repairing'),
      },
      exam: { grade: '7', date: '2026-11-19', skills: ['signed:1', 'signed:2', 'signed:3', 'coord:1'], confidence: 2, minutes: 30, createdAt: '2026-11-02T10:00:00.000Z' },
      events: [
        ev('2026-11-04T15:00:00.000Z', 'lesson-done', { s: 'signed:1', p: 'practice', ok: true }),
        ev('2026-11-08T10:00:00.000Z', 'answer', { s: 'signed:1', ok: true }),
        ev('2026-11-08T10:10:00.000Z', 'lesson-done', { s: 'signed:1', p: 'practice', ok: true }),
        ev('2026-11-08T10:30:00.000Z', 'check-done', { s: 'signed:1', p: 'mastery', ok: true }),
        ev('2026-11-09T15:00:00.000Z', 'answer', { s: 'signed:2', ok: false }),
        ev('2026-11-09T15:20:00.000Z', 'lesson-done', { s: 'signed:2', p: 'practice', ok: true }),
        ev('2026-11-09T15:30:00.000Z', 'repair-done', { s: 'signed:1', m: 'minus-minus', ok: true }),
        ev('2026-11-11T14:00:00.000Z', 'stage-A', { s: 'signed:3' }),
        ev('2026-11-11T14:30:00.000Z', 'check-done', { s: 'signed:2', p: 'mastery', ok: true }),
        ev('2026-11-12T13:00:00.000Z', 'answer', { s: 'coord:1', ok: true }),
        ev('2026-11-12T13:20:00.000Z', 'lesson-done', { s: 'coord:1', p: 'practice', ok: true }),
      ],
    },
  };
}

/** The input and clock of a QA week: 'week' (a full week so far), 'empty' (nothing yet this week; last week has some). */
export function qaReportInput(state) {
  const input = state === 'empty' ? { days: { ...LAST_WEEK }, learn: emptyLearn() } : week();
  return { input, clock: { today: TODAY, now: NOW } };
}
