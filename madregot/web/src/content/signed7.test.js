// signed:7, a power of a decimal (−0.4)³ = −0.064 (council round 3, math): the value is an exact decimal of three places.
// The question asks it as it is, so it has no line about rounding to two places, and the check takes the exact value
// only: −0.06 is another number, not the answer. A fraction's power (−3/4)³ = −27/64 has no short decimal: it keeps
// the line, and on the screen that line comes after the expression ("חשבו:" introduces the expression).
import { describe, it, expect } from 'vitest';
import { makeItem, isCorrect, readAnswer, answerText, itemPlain } from './index.js';
import { FORMAT_LINE, roundTo, questionWords } from './util.js';
import { itemFor } from '@/learn/items.ts';
import { loadAllContent } from '@/learn/content/index.ts';
import { seeded } from '@/learn/expr.ts';
import { freezeItem, thawItem } from '@/lib/exam.js';

await loadAllContent();

const typed = (it, v) => isCorrect(it, readAnswer(it, { v }));
const isDecimalPower = (it) => /^sn7:5:\d\.\d:/.test(it.key) || /"k":1/.test(it.key);
const isFractionPower = (it) => /^sn7:5:\d+\/\d+:/.test(it.key) || (/"f":5/.test(it.key) && /"k":0/.test(it.key));

/** The powers of form 5 from the exercises and from the stair's diagnostic model (the checks draw both). */
function draws(pred, n = 120) {
  const out = [];
  const rnd = seeded(7007);
  for (let i = 0; i < 20000 && out.length < n; i += 1) {
    const it = i % 2 ? makeItem('signed', 7) : itemFor('signed:7', 'diag', rnd);
    if (pred(it)) out.push(it);
  }
  return out;
}

describe('signed:7: a power of a decimal is asked and checked exactly', () => {
  const decs = draws(isDecimalPower);
  it('finds the decimal powers, three places among them', () => {
    expect(decs.length).toBeGreaterThan(50);
    expect(decs.some((it) => Math.abs(roundTo(it.answer, 2) - it.answer) > 1e-9)).toBe(true);
  });

  it('says nothing about rounding to two places', () => {
    decs.forEach((it) => expect(FORMAT_LINE.test(it.text), `${it.key}: ${it.text}`).toBe(false));
    decs.forEach((it) => expect(it.text, it.key).not.toContain('מעוגל'));
  });

  it('takes the exact value, as a decimal or as a fraction, and never its two-place rounding', () => {
    for (const it of decs) {
      const exact = answerText(it);
      expect(exact, it.key).toBe(String(it.answer));
      expect(typed(it, exact), `${it.key} ${exact}`).toBe(true);
      // −0.064 is −64/1000 = −8/125
      const den = 10 ** String(exact).split('.')[1].length;
      expect(typed(it, `${Math.round(it.answer * den)}/${den}`), `${it.key} as a fraction`).toBe(true);
      const r2 = roundTo(it.answer, 2);
      if (Math.abs(r2 - it.answer) > 1e-9) {
        expect(typed(it, r2.toFixed(2)), `${it.key}: ${r2.toFixed(2)} for ${it.answer}`).toBe(false);
        expect(typed(it, String(roundTo(it.answer, 1))), `${it.key}: one place`).toBe(false);
      }
    }
  });

  it('the council\'s cases: (−0.4)³, (−0.2)³, (−0.3)³ and (−0.5)³', () => {
    const cases = [['sn7:5:0.4:3', '-0.06', '-0.064'], ['sn7:5:0.2:3', '-0.01', '-0.008'], ['sn7:5:0.3:3', '-0.03', '-0.027'], ['sn7:5:0.5:3', '-0.13', '-0.125']];
    for (const [key, rounded, exact] of cases) {
      const it = draws((x) => x.key === key, 1)[0];
      expect(it, key).toBeTruthy();
      expect(typed(it, rounded), `${key} ${rounded}`).toBe(false);
      expect(typed(it, exact), `${key} ${exact}`).toBe(true);
    }
  });

  it('a class exam keeps the rule: the frozen question is checked exactly too', () => {
    const it = decs.find((x) => Math.abs(roundTo(x.answer, 2) - x.answer) > 1e-9);
    const back = thawItem(freezeItem(it));
    expect(isCorrect(back, it.answer)).toBe(true);
    expect(isCorrect(back, roundTo(it.answer, 2))).toBe(false);
    expect(back.answerText).toBe(String(it.answer));
  });
});

describe('signed:7: a fraction\'s power keeps its format line, after the expression', () => {
  const fracs = draws((it) => isFractionPower(it) && FORMAT_LINE.test(it.text), 40);
  it('the line follows the expression, and "חשבו:" stands right before it', () => {
    expect(fracs.length).toBeGreaterThan(10);
    for (const it of fracs) {
      const { lead, after } = questionWords(it);
      expect(lead, it.key).toBe('חשבו:');
      expect(FORMAT_LINE.test(after), it.key).toBe(true);
      // the words for the tutor and the answer key read in the same order: the expression, then how to write the answer
      const plain = itemPlain(it);
      expect(plain.indexOf('חשבו:'), it.key).toBe(0);
      expect(plain.indexOf('אפשר לכתוב'), it.key).toBeGreaterThan(plain.indexOf('^'));
    }
  });
  it('a fraction power is still right rounded to two places, as its line says', () => {
    for (const it of fracs) {
      expect(isCorrect(it, it.answer), it.key).toBe(true);
      expect(isCorrect(it, roundTo(it.answer, 2)), it.key).toBe(true);
    }
  });
});
