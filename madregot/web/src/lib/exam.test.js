import { describe, it, expect } from 'vitest';
import { scoreOf, makePracticeExam, weakTopics, focusLevel } from './exam.js';
import { TOPIC } from '@/content/index.js';
import { startSession, nextQuestion, submit, withHint, FAST, NEED } from './ladder.js';
import { readAnswer } from '@/content/index.js';

describe('exam', () => {
  it('scores partial answers as half', () => {
    expect(scoreOf({ questions: [{ status: 'correct' }, { status: 'partial' }, { status: 'wrong' }, { status: 'missing' }] })).toEqual({ correct: 1.5, total: 4, pct: 38 });
    expect(scoreOf({ questions: [] }).pct).toBe(0);
  });
  it('builds a practice exam with exact answers, spread over the topics', () => {
    const items = makePracticeExam(['line', 'pyth'], 8, { line: { level: 6 } });
    expect(items).toHaveLength(8);
    expect(new Set(items.map((i) => i.key)).size).toBe(8);
    expect(items.filter((i) => i.topic === 'line')).toHaveLength(4);
    for (const i of items) {
      expect(i.answer).toBeTruthy();
      expect(i.level).toBeGreaterThanOrEqual(1);
      expect(i.level).toBeLessThanOrEqual(TOPIC[i.topic].levels.length);
      expect(() => JSON.stringify(i)).not.toThrow();
    }
    expect(makePracticeExam(['nope'], 5)).toEqual([]);
  });
  it('ranks weak topics from exams and practice mistakes', () => {
    const exams = [{ result: { questions: [
      { topic: 'line', status: 'wrong', skill: 'שיפוע' }, { topic: 'line', status: 'partial', skill: 'חיתוך עם ציר x' },
      { topic: 'pyth', status: 'correct' }, { topic: 'other', status: 'wrong' },
    ] } }];
    const w = weakTopics({ exams, mistakes: { 'stats:mode-max': 2, 'line:sign': 1 } });
    expect(w.map((x) => x.topic)).toEqual(['line', 'stats']);
    expect(w[0].examLost).toBe(1.5);
    expect(w[0].skills).toContain('שיפוע');
  });
  it('reads the level where the exam lost points', () => {
    const exams = [{ at: '2026-11-01T10:00:00.000Z', result: { questions: [
      { topic: 'line', status: 'wrong', level: 6, skill: 'חיתוך עם הצירים' },
      { topic: 'line', status: 'partial', level: 4 },
      { topic: 'line', status: 'correct', level: 2 },
    ] } }];
    expect(focusLevel('line', exams)).toBe(6);
    expect(focusLevel('pyth', exams)).toBe(null);
    expect(focusLevel('nope', exams)).toBe(null);
  });
});

describe('ladder', () => {
  const solve = (s) => submit(s, s.item.answer, String(s.item.answer));
  it('moves up after two in a row', () => {
    let s = nextQuestion(startSession('signed', { level: 1 }));
    while (s.item.form !== 'num') s = nextQuestion(s);
    for (let i = 0; i < FAST; i++) { s = solve(s).s; if (s.level > 1) break; s = nextQuestion(s); while (s.item.form !== 'num' || s.item.level !== s.level) s = nextQuestion(s); }
    expect(s.level).toBe(2);
  });
  it('needs four after a mistake, and brings the wrong question back', () => {
    let s = nextQuestion(startSession('line', { level: 1 }));
    const first = s.item;
    let r = submit(s, first.answer + 100, 'x'); s = r.s;
    expect(r.result.retry).toBe(true);
    expect(s.miss).toBe(true);
    r = submit(s, first.answer + 100, 'x'); s = r.s;
    expect(r.result.reveal).toBe(true);
    let back = false; let level = s.level; let correct = 0;
    for (let i = 0; i < 12 && level === 1; i++) {
      s = nextQuestion(s);
      if (s.item.key === first.key && s.item.returning) back = true;
      const u = s.item.form === 'line' ? s.item.answer : s.item.answer;
      r = submit(s, u, 'ok'); s = r.s; level = s.level;
      if (!s.item.returning) correct += 1;
    }
    expect(back).toBe(true);
    expect(correct).toBeGreaterThanOrEqual(NEED);
  });
  it('a hint switches the level to the slow lane', () => {
    const s = withHint(nextQuestion(startSession('pyth', { level: 1 })));
    expect(s.hint).toBe(true);
    expect(s.miss).toBe(true);
  });
  it('reads typed answers', () => {
    const it2 = { form: 'pt' };
    expect(readAnswer(it2, { x: '−2.5', y: '0' })).toEqual([-2.5, 0]);
    expect(readAnswer({ form: 'line' }, { m: '3/4', b: '-2' })).toEqual({ m: 0.75, b: -2 });
    expect(readAnswer({ form: 'num' }, { v: '' })).toBeNull();
  });
});
