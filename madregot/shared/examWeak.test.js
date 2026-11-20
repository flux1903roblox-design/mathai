// The topics to strengthen after an exam (PRODUCT2-31, shared/examWeak.js): the one rule the Worker's dashboard and the
// demo class use for a class exam solved in the app.
import { describe, it, expect } from 'vitest';
import { examWeak, WEAK_MAX } from './examWeak.js';

const q = (topic, status) => ({ topic, level: 1, status });

describe('examWeak', () => {
  it('the topics with a question not right, the most missed first; a tie keeps the order the exam asked them', () => {
    expect(examWeak([q('signed', 'correct'), q('coord', 'wrong'), q('signed', 'partial'), q('line', 'missing'), q('coord', 'wrong'), q('signed', 'wrong')]))
      .toEqual(['coord', 'signed', 'line']);
    expect(examWeak([q('line', 'wrong'), q('coord', 'wrong')])).toEqual(['line', 'coord']);
  });
  it('an exam all right has none; anything that is not a question is passed over', () => {
    expect(examWeak([q('signed', 'correct'), q('coord', 'correct')])).toEqual([]);
    expect(examWeak(null)).toEqual([]);
    expect(examWeak([null, {}, { topic: '', status: 'wrong' }, q('eq', 'wrong')])).toEqual(['eq']);
  });
  it('at most six, as an exam checked from a photo keeps', () => {
    const many = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((t) => q(t, 'wrong'));
    expect(WEAK_MAX).toBe(6);
    expect(examWeak(many)).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  });
});
