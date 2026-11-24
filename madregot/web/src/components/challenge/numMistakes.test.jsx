// A challenge's number part names a known mistake, as a lesson does (council round 3): eq:c4 "כמה דקות שחו?" answered
// 0.25 (the hours, not turned into minutes) got only "עוד לא. נסו שוב". A number part, and an error part's fix, may carry
// `wrongs`: the topic's misconception ids and the answer each gives. A wrong number that matches one is named under the
// result ("מה כנראה קרה: …"), by the one rule of every diagnosis (learn/misconceptions.ts matchesValue).
import { describe, it, expect } from 'vitest';
import { numMistakes, numCheck } from '@/learn/challenges/grade.ts';
import { CHALLENGE_TASKS, taskById } from '@/learn/challenges/all.ts';
import { slipLike, roundAway } from '@/learn/misconceptions.ts';
import { same } from '@/learn/expr.ts';
import { parseSkill } from '@/learn/skills.ts';
import { catLabel } from '@/content/topics.js';
import { mistakeLine } from './common.jsx';

/** Every typed-number question of the track with its wrong-answer map: a number part, or an error part's fix. */
const numbers = CHALLENGE_TASKS.flatMap((t) => t.parts.flatMap((p, i) => (p.type === 'num' ? [{ t, i, q: p }] : p.type === 'error' ? [{ t, i, q: p.fix }] : [])));
const partOf = (id, i) => { const p = taskById(id).parts[i]; return p.type === 'error' ? p.fix : p; };

describe('a challenge\'s number part names the mistake a wrong number shows', () => {
  it('the council\'s case: eq:c4, the swim answered 0.25 (hours) is named', () => {
    const t = taskById('eq:c4');
    const swim = partOf('eq:c4', 0);
    expect(swim.prompt).toBe('כמה דקות שחו?');
    expect(numMistakes(swim.answer, numCheck(swim.answer, '0.25').u, swim.wrongs)).toEqual(['no-convert']);
    expect(mistakeLine(t, ['no-convert'])).toBe('מה כנראה קרה: שכחו להמיר בין שעות לדקות.');
    // the right answer and a number no mistake gives name nothing; nor does 25, ten off 15, which a slip also gives,
    // even listed as a prediction (as practice: a slip is not a misconception)
    expect(numMistakes(swim.answer, 15, swim.wrongs)).toEqual([]);
    expect(numMistakes(swim.answer, 17, swim.wrongs)).toEqual([]);
    expect(numMistakes(swim.answer, 25, swim.wrongs)).toEqual([]);
    expect(numMistakes(swim.answer, 25, { 'decimal-minutes': 25 })).toEqual([]);
    expect(mistakeLine(t, [])).toBeNull();
  });

  it('the equations track (eq:c2 to eq:c6): every typed number a known mistake can give has a map', () => {
    // eq:c1 asks a claim and a choice, no number; eq:c3's first part (10 entries cost 270) has no mistake of the topic
    const want = { 'eq:c2': [0], 'eq:c3': [1], 'eq:c4': [0, 1, 2], 'eq:c5': [0, 1, 2], 'eq:c6': [2] };
    Object.entries(want).forEach(([id, parts]) => parts.forEach((i) => expect(Object.keys(partOf(id, i).wrongs || {}).length, `${id} part ${i + 1}`).toBeGreaterThan(0)));
    // a few by hand: the gym's x-term moved over without its sign (120 = 40x), the ride read as 0.67 hours or 67 minutes,
    // Alon's own move repeated in the fix (25/3), the bracket opened on its first term only
    expect(numMistakes(12, 3, partOf('eq:c3', 1).wrongs)).toEqual(['move-x-no-flip']);
    expect(numMistakes(40, 0.67, partOf('eq:c4', 1).wrongs)).toEqual(['no-convert']);
    expect(numMistakes(40, 67, partOf('eq:c4', 1).wrongs)).toEqual(['decimal-minutes']);
    expect(numMistakes(5, numCheck(5, '25/3').u, partOf('eq:c2', 0).wrongs)).toEqual(['move-no-flip']);
    expect(numMistakes(-9, -4.5, partOf('eq:c6', 2).wrongs)).toEqual(['partial-dist']);
    expect(numMistakes(-9, 9, partOf('eq:c6', 2).wrongs)).toEqual(['sign']);
  });

  it('every map: the topic names each mistake, no prediction is the answer or a slip, and each is named back', () => {
    const maps = numbers.filter(({ q }) => q.wrongs);
    // the nine of eq:c2-c6, and any a later task adds
    expect(maps.length).toBeGreaterThanOrEqual(9);
    maps.forEach(({ t, i, q }) => {
      const at = `${t.id} part ${i + 1}`;
      Object.entries(q.wrongs).forEach(([id, v]) => {
        expect(catLabel(t.topic, parseSkill(t.after).level, id), `${at}: ${id} has no name in ${t.topic}`).toBeTruthy();
        [v].flat().forEach((w) => {
          expect(same(w, q.answer), `${at}: ${id} predicts the answer`).toBe(false);
          expect(slipLike(w, q.answer), `${at}: ${id} predicts ${w}, a slip of the hand`).toBe(false);
          // typed as a student types it (a fraction rounded to hundredths, halves away from zero), it names its mistake
          const typed = Number.isInteger(w) ? w : roundAway(w, 2);
          expect(numMistakes(q.answer, typed, q.wrongs), `${at}: ${typed}`).toContain(id);
        });
      });
      expect(numMistakes(q.answer, q.answer, q.wrongs), `${at}: the right answer`).toEqual([]);
    });
  });

  it('two mistakes on one number are both said, as a lesson says them', () => {
    const t = taskById('eq:c4');
    expect(mistakeLine(t, ['no-convert', 'decimal-minutes'])).toBe(`מה כנראה קרה: אולי ${catLabel('eq', 6, 'no-convert')}, ואולי ${catLabel('eq', 6, 'decimal-minutes')}.`);
  });
});
