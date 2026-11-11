// The exam check decided by code when an answer key exists (ai spec AI-8, Tests): the table of the spec, the question
// counts that do not match, and every exercise a practice exam can print: its own key, transcribed, is graded right by
// code (so the "graded by the key" label is never on a question code cannot read). Synthetic data only.
import { describe, it, expect } from 'vitest';
import { gradeByKey, gradeExam, gradedBy, choiceLetter } from './examGrade.js';
import { makePracticeExam } from './exam.js';
import { TOPICS } from '@/content/index.js';
import { loadAllContent } from '@/learn/content/index.ts';

// every topic's teaching content, loaded once (the durable lane's split, DURABLE-11: topics load on demand)
await loadAllContent();

const q = (studentAnswer, status = 'correct', extra = {}) => ({ number: '1', prompt: 'שאלה', studentAnswer, status, correctAnswer: '', feedback: '', solution: [], topic: 'signed', level: 1, skill: '', ...extra });
const num = (answer, extra = {}) => ({ form: 'num', answer, text: 'חשבו:', ...extra });

describe('gradeByKey: the spec\'s table', () => {
  it('a number: 3/4 against 0.75 is right; -5 against 5 is wrong whatever the model said, and says it changed', () => {
    expect(gradeByKey(q('0.75', 'wrong'), num('3/4'))).toMatchObject({ status: 'correct', graded: 'key', overridden: true });
    expect(gradeByKey(q('$\\frac{3}{4}$', 'correct'), num('3/4'))).toMatchObject({ status: 'correct', graded: 'key', overridden: false });
    expect(gradeByKey(q('5', 'correct'), num('-5'))).toMatchObject({ status: 'wrong', graded: 'key', overridden: true });
    expect(gradeByKey(q('$x = -5$', 'wrong'), num('-5'))).toMatchObject({ status: 'correct', overridden: true });
    expect(gradeByKey(q('−5', 'correct'), num('-5')).status).toBe('correct');
  });

  it('a model\'s partial with a wrong final answer stays partial; with the right one it is correct', () => {
    expect(gradeByKey(q('7', 'partial'), num('8'))).toMatchObject({ status: 'partial', graded: 'key', overridden: false });
    expect(gradeByKey(q('8', 'partial'), num('8'))).toMatchObject({ status: 'correct', overridden: true });
  });

  it('nothing transcribed, or a transcription code cannot read, keeps the model\'s status: graded by the AI', () => {
    expect(gradeByKey(q('', 'missing'), num('8'))).toEqual({ ...q('', 'missing'), graded: 'ai' });
    expect(gradeByKey(q('   ', 'wrong'), num('8')).graded).toBe('ai');
    expect(gradeByKey(q('בערך שמונה', 'correct'), num('8'))).toMatchObject({ status: 'correct', graded: 'ai' });
    expect(gradeByKey(q('8', 'correct'), null).graded).toBe('ai');
    expect(gradeByKey(q('8', 'correct'), { form: 'manip', answer: '8' }).graded).toBe('ai');
  });

  it('a choice: the printed letter or the choice\'s text', () => {
    const choices = [{ text: 'חדה' }, { text: 'ישרה' }, { text: 'קהה' }, { text: 'שטוחה' }];
    const mc = { form: 'mc', choices, answer: choices[2].text };
    expect(gradeByKey(q('ג', 'wrong'), mc)).toMatchObject({ status: 'correct', graded: 'key' });
    expect(gradeByKey(q('(ג)', 'wrong'), mc).status).toBe('correct');
    expect(gradeByKey(q('קהה', 'wrong'), mc).status).toBe('correct');
    expect(gradeByKey(q('ב', 'correct'), mc)).toMatchObject({ status: 'wrong', graded: 'key', overridden: true });
    expect(gradeByKey(q('ה', 'correct'), mc).graded).toBe('ai'); // no fifth choice
    expect([0, 1, 2, 3, 4].map(choiceLetter)).toEqual(['א', 'ב', 'ג', 'ד', 'ה']);
    // a fifth choice ("none of them") is printed ה
    const five = { form: 'mc', choices: [...choices, { text: 'אף אחד מהם' }], answer: 'אף אחד מהם' };
    expect(gradeByKey(q('ה', 'wrong'), five).status).toBe('correct');
    // choices written in TeX: the student may copy the maths
    const tex = { form: 'mc', choices: [{ tex: '-3' }, { tex: '\\frac{1}{2}' }], answer: '\\frac{1}{2}' };
    expect(gradeByKey(q('$\\frac{1}{2}$', 'wrong'), tex).status).toBe('correct');
  });

  it('a point: (2, -1) against (2,-1)', () => {
    expect(gradeByKey(q('(2,-1)', 'wrong'), { form: 'pt', answer: '(2, -1)' })).toMatchObject({ status: 'correct', graded: 'key' });
    expect(gradeByKey(q('(-1, 2)', 'correct'), { form: 'pt', answer: '(2, -1)' }).status).toBe('wrong');
    expect(gradeByKey(q('2', 'correct'), { form: 'pt', answer: '(2, -1)' }).status).toBe('wrong');
  });

  it('an expression: 3x + 12 against $12 + 3x$ (right) and $3x + 21$ (wrong); a line compares what follows "y ="', () => {
    expect(gradeByKey(q('$12 + 3x$', 'wrong'), { form: 'lin', answer: '3x + 12' })).toMatchObject({ status: 'correct', graded: 'key' });
    expect(gradeByKey(q('$3(x + 4)$', 'wrong'), { form: 'lin', answer: '3x + 12' }).status).toBe('correct');
    expect(gradeByKey(q('$3x + 21$', 'correct'), { form: 'lin', answer: '3x + 12' })).toMatchObject({ status: 'wrong', overridden: true });
    expect(gradeByKey(q('$2a - 1$', 'correct'), { form: 'lin', answer: '2a - 1', var: 'a' }).status).toBe('correct');
    expect(gradeByKey(q('$5 + 7n$', 'wrong'), { form: 'lin', answer: '7n + 5' }).status).toBe('correct');
    expect(gradeByKey(q('$7x + 5$', 'correct'), { form: 'lin', answer: '7n + 5' }).graded).toBe('ai');
    expect(gradeByKey(q('$y=-3+2x$', 'wrong'), { form: 'line', answer: 'y = 2x - 3' })).toMatchObject({ status: 'correct', graded: 'key' });
    expect(gradeByKey(q('$y = 2x + 3$', 'correct'), { form: 'line', answer: 'y = 2x - 3' }).status).toBe('wrong');
    expect(gradeByKey(q('$x = 2y - 3$', 'correct'), { form: 'line', answer: 'y = 2x - 3' }).graded).toBe('ai');
    expect(gradeByKey(q('שיפוע 2', 'correct'), { form: 'line', answer: 'y = 2x - 3' }).graded).toBe('ai');
  });

  it('an exercise that asks to round allows 0.05', () => {
    const it = num('7.1', { text: 'מה אורך היתר? עגלו לעשירית.' });
    expect(gradeByKey(q('7.07', 'wrong'), it).status).toBe('correct');
    expect(gradeByKey(q('7', 'correct'), it).status).toBe('wrong');
    expect(gradeByKey(q('7.07', 'wrong'), num('7.1')).status).toBe('wrong');
  });
});

describe('gradeExam: a key only when the questions match it one for one', () => {
  const practice = { items: [num('8'), num('-5'), { form: 'pt', answer: '(2, -1)' }] };
  it('three questions for three items: each graded by the key', () => {
    const out = gradeExam([q('8', 'wrong'), q('5', 'correct'), q('(2,-1)', 'correct')], practice);
    expect(out.map((x) => [x.status, x.graded])).toEqual([['correct', 'key'], ['wrong', 'key'], ['correct', 'key']]);
  });
  it('a result whose question count differs from the practice exam: every question graded by the AI, as the model said', () => {
    const out = gradeExam([q('8', 'wrong'), q('5', 'correct')], practice);
    expect(out.map((x) => [x.status, x.graded])).toEqual([['wrong', 'ai'], ['correct', 'ai']]);
    expect(gradeExam([q('8', 'wrong')], null)[0].graded).toBe('ai');
  });
  it('an older stored question without a mark reads as graded by the AI', () => {
    expect(gradedBy(q('8'))).toBe('ai');
    expect(gradedBy({ graded: 'key' })).toBe('key');
  });
});

describe('every exercise a practice exam prints: its own key, transcribed, is graded right by code', () => {
  it('all topics and stairs, every answer form a sheet can show', () => {
    const forms = new Set();
    for (const t of TOPICS) {
      for (let level = 1; level <= t.levels.length; level += 1) {
        const items = makePracticeExam([t.id], 6, { [t.id]: { level } });
        for (const it of items) {
          const said = it.form === 'mc' ? choiceLetter(it.choices.findIndex((c) => (c.text || c.tex) === it.answer)) : it.answer;
          const out = gradeByKey(q(said, 'wrong'), it);
          if (it.form === 'manip') { expect(out.graded).toBe('ai'); continue; }
          forms.add(it.form);
          expect(out, `${t.id}:${level} ${it.form} ${it.answer}`).toMatchObject({ graded: 'key', status: 'correct' });
          // and another value is wrong (a number one more, or another choice)
          if (it.form === 'num' && typeof Number(it.answer) === 'number' && Number.isFinite(Number(it.answer))) {
            expect(gradeByKey(q(String(Number(it.answer) + 1), 'correct'), it).status, `${t.id}:${level} ${it.answer}`).toBe('wrong');
          }
        }
      }
    }
    for (const f of ['num', 'mc', 'pt']) expect(forms.has(f), f).toBe(true);
  });
});
