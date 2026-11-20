// The one selector every screen reads a stair's label from (learn/stairStatus.ts), on synthetic records: it tells apart
// not started, a lesson left in the middle, a finished teaching stage, practising, mastered, a memory check that came
// due and one that was missed, and it reads mastery.ts's state as it is (the review policy does not move).
import { describe, it, expect } from 'vitest';
import { stairStatus, savedPlace, STATUS_LABEL, STATUS_TONE, countStatuses, gradeCounts, gradeStatuses, type StairStatus } from './stairStatus';
import { masteryState, recordMasteryCheck, recordReview, addAttempt, markTaught, MASTERY_N, REVIEW_N, REVIEW_DAYS } from './mastery';
import type { SkillRecord } from './types';

const NOW = '2026-11-20T10:00:00.000Z';
const DAY = 86_400_000;
const at = (days: number) => new Date(Date.parse(NOW) + days * DAY).toISOString();
const practice = (ok: boolean, when = at(-1)) => ({ at: when, ok, independent: true, purpose: 'practice' as const });

// each record is built with the engine's own functions, as the app writes it
const fresh = undefined;
const partial: SkillRecord = { attempts: [], pos: { A: 3 } }; // left the first stage at step 4
const taughtA = markTaught(undefined, 'A', at(-2)); // the first stage finished
const partialB: SkillRecord = { ...taughtA, pos: { B: 1 } }; // the first stage done, the second left at example 2
const practising = addAttempt(taughtA, practice(true));
const mastered = recordMasteryCheck(practising, MASTERY_N, MASTERY_N, at(-REVIEW_DAYS[0] + 0.5)); // due in half a day
const due = recordMasteryCheck(practising, MASTERY_N, MASTERY_N, at(-REVIEW_DAYS[0] - 1)); // due yesterday
const missed = recordReview(due, 1, REVIEW_N, at(-0.5)); // the memory check missed
const kept = recordReview(due, REVIEW_N, REVIEW_N, at(-0.5)); // the memory check passed: the next is further away
const failedCheck = recordMasteryCheck(practising, 2, MASTERY_N, at(-0.5)); // the mastery check not passed (yet)
const struggling = [false, false, false, true].reduce((r, ok) => addAttempt(r, practice(ok)), taughtA);

describe('a stair\'s status', () => {
  it('the engine reads these records as the app writes them (the cases below are real states)', () => {
    expect(masteryState(partial, NOW)).toBe('not-started'); // the root of finding 2: a half-done first stage
    expect(masteryState(due, NOW)).toBe('needs-review');
    expect(masteryState(missed, NOW)).toBe('needs-review');
    expect(missed.mastered?.lastReview?.ok).toBe(false);
    expect(masteryState(kept, NOW)).toBe('mastered');
  });

  it.each<[string, SkillRecord | undefined, StairStatus, string]>([
    ['never opened', fresh, 'not-started', 'עוד לא התחלנו'],
    ['left at step 4 of the first stage', partial, 'in-lesson', 'באמצע שיעור'],
    ['the first stage finished', taughtA, 'learning', 'לומדים'],
    ['the first stage finished, the second left in the middle', partialB, 'in-lesson', 'באמצע שיעור'],
    ['the first stage finished, opened again and left: the stair is past it', { ...taughtA, pos: { A: 5 } }, 'learning', 'לומדים'],
    ['practising, a right answer given', practising, 'practicing', 'מתרגלים'],
    ['a mastery check not passed yet: still practising', failedCheck, 'practicing', 'מתרגלים'],
    ['most answers lately not right', struggling, 'needs-support', 'צריך עוד עזרה'],
    ['mastered, its memory check not due yet', mastered, 'mastered', 'שולטים לבד'],
    ['mastered, its memory check due', due, 'review-due', 'זמן לבדיקת זיכרון'],
    ['mastered, its memory check missed', missed, 'review-missed', 'כדאי לחזק'],
    ['mastered, its memory check passed', kept, 'mastered', 'שולטים לבד'],
  ])('%s', (_, rec, status, label) => {
    expect(stairStatus(rec, NOW)).toBe(status);
    expect(STATUS_LABEL[status]).toBe(label);
  });

  it('a stair done on the map before mastery checks, with no answers on record, is practised; a started one still says so', () => {
    expect(stairStatus(undefined, NOW, true)).toBe('practicing');
    expect(stairStatus(partial, NOW, true)).toBe('in-lesson');
    expect(stairStatus(due, NOW, true)).toBe('review-due');
  });

  it('a place kept at the first step (index 0) or cleared when the stage finished is no lesson in the middle', () => {
    expect(savedPlace({ attempts: [], pos: { A: 0 } })).toBe(false);
    expect(savedPlace({ attempts: [], pos: {} })).toBe(false);
    expect(savedPlace(undefined)).toBe(false);
    expect(savedPlace(partial)).toBe(true);
    expect(stairStatus({ attempts: [], pos: { A: 0 } }, NOW)).toBe('not-started');
  });

  it('every status has its own words, and each is drawn in its engine state\'s colour', () => {
    const all = Object.keys(STATUS_TONE) as StairStatus[];
    expect(new Set(all.map((s) => STATUS_LABEL[s])).size).toBe(all.length);
    expect(STATUS_TONE).toMatchObject({ 'in-lesson': 'learning', 'review-due': 'needs-review', 'review-missed': 'needs-review', mastered: 'mastered', 'not-started': 'not-started' });
  });
});

describe('counting stairs', () => {
  it('a memory check due keeps the stair learned; due and worth strengthening are counted apart', () => {
    const c = countStatuses(['mastered', 'review-due', 'review-missed', 'needs-support', 'in-lesson', 'learning', 'practicing', 'not-started']);
    expect(c).toEqual({ learned: 2, onWay: 3, due: 1, strengthen: 2, of: 8 });
  });

  it("a grade's stairs, as the profile counts them", () => {
    const skills = { 'signed:1': mastered, 'signed:2': due, 'signed:3': missed, 'signed:4': partial, 'signed:5': failedCheck } as Record<string, SkillRecord>;
    const c = gradeCounts('7', skills, {}, NOW);
    expect(c).toMatchObject({ learned: 2, due: 1, strengthen: 1, onWay: 2 });
    expect(c.of).toBe(gradeStatuses('7', {}, {}, NOW).length);
    // a stair done on the path only (kept from before mastery checks) is on the way, not learned
    expect(gradeCounts('7', {}, { signed: { parts: {}, reviews: 0, jumped: 0, done: { 1: 'kept' } } }, NOW)).toMatchObject({ learned: 0, onWay: 1 });
  });
});
