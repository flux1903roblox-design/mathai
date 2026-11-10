// Making a save smaller when the storage is full (DURABLE-1): only the old half of the analytics log, the written
// feedback of old exams and old practice exams go; everything the app teaches or counts stays whole.
import { describe, it, expect } from 'vitest';
import { compactForQuota, KEEP_EVENTS, KEEP_EXAM_FEEDBACK, KEEP_PRACTICE_EXAMS } from './compact.js';
import { migrate } from './migrations.js';
import { deepFreeze, heavyYear } from './testing.js';

const heavy = deepFreeze(migrate(heavyYear().state, 4));

describe('compactForQuota', () => {
  const out = compactForQuota(heavy);

  it('keeps the newest 1,500 events of the log', () => {
    expect(KEEP_EVENTS).toBe(1500);
    expect(out.learn.events).toEqual(heavy.learn.events.slice(-1500));
  });
  it('old exams lose their written feedback and worked solution, and keep the rest', () => {
    expect(out.exams).toHaveLength(30);
    out.exams.slice(0, KEEP_EXAM_FEEDBACK).forEach((ex, i) => expect(ex).toBe(heavy.exams[i]));
    out.exams.slice(KEEP_EXAM_FEEDBACK).forEach((ex, i) => {
      const was = heavy.exams[KEEP_EXAM_FEEDBACK + i];
      expect(ex.result.questions.every((q) => q.feedback === null && q.solution === null)).toBe(true);
      expect(ex.result.questions.map(({ feedback, solution, ...q }) => q)).toEqual(was.result.questions.map(({ feedback, solution, ...q }) => q)); // eslint-disable-line no-unused-vars
      expect({ ...ex, result: { ...ex.result, questions: null } }).toEqual({ ...was, result: { ...was.result, questions: null } });
    });
  });
  it('keeps the newest 5 practice exams', () => {
    expect(out.practiceExams).toEqual(heavy.practiceExams.slice(0, KEEP_PRACTICE_EXAMS));
  });
  it('everything that drives learning stays whole', () => {
    for (const k of ['days', 'path', 'progress', 'xp', 'xpBy', 'mistakes', 'wins', 'gaps', 'outbox', 'profile', 'durable', 'backup']) expect(out[k], k).toBe(heavy[k]);
    for (const k of ['skills', 'miscon', 'missions', 'exam']) expect(out.learn[k], k).toBe(heavy.learn[k]);
  });
  it('makes the heavy year smaller than 300 KB, from over 400 KB', () => {
    expect(JSON.stringify(heavy).length).toBeGreaterThan(400_000);
    expect(JSON.stringify(out).length).toBeLessThan(300_000);
  });
  it('a small save is left as it is (a copy with the same content)', () => {
    const small = deepFreeze({ xp: 3, learn: { events: [{ t: 'x', e: 'answer' }] }, exams: [], practiceExams: [] });
    expect(compactForQuota(small)).toEqual(small);
    expect(compactForQuota(null)).toBeNull();
  });
});
