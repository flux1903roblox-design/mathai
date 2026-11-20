// "שאלה למדי" → "מה הטעות שלי?" answers about the question on screen (the external review of 16.11: after a wrong answer
// in "מבינים את הרעיון" Madi said there was no wrong answer, because the teaching screen gave the sheet the stair's
// content only). Every surface that opens the sheet now tells it, in the lesson's shape ({ item, wrong }), about the
// question on screen: StepPlayer (stage A) through stepAsk, Together (stage C) through togetherAsk, the lesson through
// lessonWrong. Three cases each: a wrong answer standing (Madi explains it in the content's own words), a wrong answer
// corrected since (Madi says it was fixed, and does not explain it as current), and no wrong answer (the honest "none
// yet", nothing guessed). A wrong answer on a step or move already left is not passed at all.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { loadAllContent } from '@/learn/content/index.ts';
import { tutorReply, lessonWrong } from '@/learn/tutor.ts';
import { seeded } from '@/learn/expr.ts';
import { startLesson, answer } from '@/lib/lesson.js';
import { stepAsk, exploreMiss } from './StepPlayer.jsx';
import { togetherAsk } from './Together.jsx';

const NONE = 'עוד לא הייתה כאן תשובה שגויה';
const FIXED = 'כבר תיקנתם את הטעות';
let C;
let c;
const real = Math.random;
beforeAll(async () => { C = await loadAllContent(); c = C['signed:1']; });
afterAll(() => { Math.random = real; });
const mistake = (ask, content = c) => tutorReply('mistake', { content, item: ask.item, wrong: ask.wrong });
const minusMinus = () => c.misconceptions.find((m) => m.id === 'minus-minus');

describe('stage A (מבינים את הרעיון): a predict step', () => {
  const predict = () => c.discover.find((s) => s.kind === 'predict' && s.wrongWhy && Object.keys(s.wrongWhy).length);

  it('a wrong guess, then ask: the guess is explained in the step\'s own words, not "no wrong answer"', () => {
    const st = predict();
    const wrong = Number(Object.keys(st.wrongWhy)[0]);
    const r = mistake(stepAsk(st, wrong));
    expect(r.say.join(' ')).not.toContain(NONE);
    expect(r.say).toEqual([st.wrongWhy[wrong], st.why]);
  });

  it('no guess yet, or a right one, then ask: none yet, and nothing is invented', () => {
    const st = predict();
    expect(stepAsk(st, undefined).wrong).toBeNull();
    expect(stepAsk(st, st.answer).wrong).toBeNull();
    expect(mistake(stepAsk(st, undefined)).say[0]).toContain(NONE);
    expect(mistake(stepAsk(st, st.answer)).say).toHaveLength(1);
  });

  it('every wrong guess of every stair has something checked to say (its why, at least)', () => {
    let n = 0;
    for (const [skill, sc] of Object.entries(C)) {
      for (const st of sc?.discover || []) {
        if (st.kind !== 'predict') continue;
        st.choices.forEach((_, k) => {
          if (k === st.answer) return;
          const r = mistake(stepAsk(st, k), sc);
          expect(r.say.join(' '), `${skill}`).not.toContain(NONE);
          expect(r.say, `${skill}`).toContain(st.why);
          n += 1;
        });
      }
    }
    expect(n).toBeGreaterThan(300);
  });
});

describe('stage A: an explore step (the number line)', () => {
  const explore = () => c.discover.find((s) => s.kind === 'explore' && s.display === '2 - (-3)');

  it('a named miss, then ask: the misconception the screen named, with its repair', () => {
    const st = explore();
    const miss = exploreMiss('signed:1', st, -1); // 2 + (-3): the minus of −3 kept as a minus
    expect(miss.cat).toBe('minus-minus');
    const r = mistake(stepAsk(st, undefined, miss));
    expect(r.say[0]).toBe(minusMinus().cause);
    expect(r.action).toEqual({ kind: 'remedy', misc: 'minus-minus' });
  });

  it('a miss with no name, then ask: the step\'s hint, and no guess at a misconception', () => {
    const st = explore();
    const miss = exploreMiss('signed:1', st, 3);
    expect(miss.cat).toBeNull();
    const r = mistake(stepAsk(st, undefined, miss));
    expect(r.say).toEqual([st.hint]);
    expect(r.action).toBeUndefined();
  });

  it('a miss, then the step done right, then ask: fixed, not explained as the answer standing', () => {
    const st = explore();
    const ask = stepAsk(st, true, exploreMiss('signed:1', st, -1));
    expect(ask.wrong.fixed).toBe(true);
    const r = mistake(ask);
    expect(r.say[0]).toContain(FIXED);
    expect(r.say.join(' ')).not.toContain(minusMinus().cause);
    expect(r.action).toBeUndefined();
  });

  it('no attempt, then ask: none yet; and the next step after a miss starts clean', () => {
    const st = explore();
    expect(mistake(stepAsk(st, undefined, undefined)).say[0]).toContain(NONE);
    const next = c.discover[c.discover.indexOf(st) + 1];
    expect(stepAsk(next, undefined, undefined).wrong).toBeNull();
  });
});

describe('stage C (פותרים יחד)', () => {
  const problem = () => c.together[0];
  const wrongWith = (misc) => problem().steps[0].choices.findIndex((x) => !x.ok && JSON.stringify(x.misc) === JSON.stringify(misc));

  it('a wrong next step, then ask: the misconception that move is', () => {
    const k = wrongWith('minus-minus');
    const r = mistake(togetherAsk(problem(), 0, { tried: [k] }));
    expect(r.say[0]).toBe(minusMinus().cause);
    expect(r.action).toEqual({ kind: 'remedy', misc: 'minus-minus' });
  });

  it('a wrong move that fits two misconceptions: its own feedback, without picking one', () => {
    const k = wrongWith(['drop-sign', 'neg-neg-plus']);
    expect(mistake(togetherAsk(problem(), 0, { tried: [k] })).say).toEqual([problem().steps[0].choices[k].feedback]);
  });

  it('a wrong move, then the right one, then ask: fixed', () => {
    const right = problem().steps[0].choices.findIndex((x) => x.ok);
    const r = mistake(togetherAsk(problem(), 0, { tried: [wrongWith('minus-minus'), right] }));
    expect(r.say[0]).toContain(FIXED);
  });

  it('no attempt, then ask: none yet; and a move already left is not the one on screen', () => {
    expect(mistake(togetherAsk(problem(), 0, {})).say[0]).toContain(NONE);
    // step 0 had a miss; the student is on step 1 now with nothing checked
    expect(togetherAsk(problem(), 1, { tried: [] }).wrong).toBeNull();
  });

  it('the typed last move: a named miss, two candidates (no promise of a later question), unnamed (the hint is not given away), then fixed', () => {
    const last = problem().steps.length;
    expect(mistake(togetherAsk(problem(), last, { finalMiss: 1, missIds: ['minus-minus'] })).say[0]).toBe(minusMinus().cause);
    const two = mistake(togetherAsk(problem(), last, { finalMiss: 1, missIds: ['minus-minus', 'abs-add'] }));
    expect(two.say[0]).toContain('ועוד לא ברור איזו מהן');
    expect(two.say[0]).not.toContain('שאלה אחת נוספת');
    const unnamed = mistake(togetherAsk(problem(), last, { finalMiss: 1, missIds: [] }));
    expect(unnamed.say[0]).toContain('לא אנחש');
    expect(unnamed.say.join(' ')).not.toContain('בואו נעבור על הפתרון'); // no solution to walk through: no promise of one
    expect(unnamed.say.join(' ')).not.toContain(problem().final.hints[0]);
    expect(mistake(togetherAsk(problem(), last, { finalMiss: 1, missIds: ['minus-minus'], solved: true })).say[0]).toContain(FIXED);
    expect(togetherAsk(problem(), last, {}).wrong).toBeNull();
  });
});

describe('a lesson (practice)', () => {
  // a typed signed:1 exercise and a wrong number its diag() names minus-minus
  const lessonWithMiss = () => {
    for (let seed = 1; seed < 200; seed += 1) {
      Math.random = seeded(seed);
      const s = startLesson({ kind: 'node', topic: 'signed', level: 1 });
      const it = s.item;
      if (it.form !== 'num' || typeof it.diag !== 'function') continue;
      for (let u = -40; u <= 40; u += 1) if (u !== it.answer && it.diag(u) === 'minus-minus') return { s, u };
    }
    throw new Error('no seed gives a minus-minus miss');
  };

  it('a named miss, then "נסו שוב" (the feedback cleared), then ask: still the named mistake', () => {
    const { s, u } = lessonWithMiss();
    const { s: after, result } = answer(s, u);
    expect(after.phase).toBe('retry');
    // the lesson keeps the miss's diagnosis apart from its feedback panel
    const miss = { cat: result.cat ?? null, diagnosis: result.diagnosis ?? null };
    const r = tutorReply('mistake', { content: c, item: after.item, wrong: lessonWrong(after, miss) });
    expect(r.say[0]).toBe(minusMinus().cause);
    expect(r.say.join(' ')).not.toContain('לא אנחש');
  });

  it('a miss, then right, then ask: fixed, and no walk through the solution as if it were still wrong', () => {
    const { s, u } = lessonWithMiss();
    const first = answer(s, u);
    const { s: done } = answer(first.s, s.item.answer);
    expect(done.phase).toBe('correct');
    const w = lessonWrong(done, { cat: first.result.cat, diagnosis: first.result.diagnosis });
    expect(w.fixed).toBe(true);
    const r = tutorReply('mistake', { content: c, item: done.item, wrong: w });
    expect(r.say[0]).toContain(FIXED);
    expect(r.action).toBeUndefined();
  });

  it('no attempt, then ask: none yet', () => {
    const { s } = lessonWithMiss();
    expect(lessonWrong(s, null)).toBeNull();
    expect(tutorReply('mistake', { content: c, item: s.item, wrong: lessonWrong(s, null) }).say[0]).toContain(NONE);
  });
});
