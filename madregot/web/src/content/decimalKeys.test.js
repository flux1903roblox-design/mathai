// An answer key writes a measure as a decimal (council round 3, math): the printed practice exam's key, the class exam's
// key and the tutor's context all read answerText. A 19.5 cm width is 19.5, not 39/2; a 9.9 m tree is 9.9, not 99/10;
// a relative frequency of 0.2 is 0.2, as the table beside it writes 0.1 and 0.35. A value with no short decimal (1/6)
// stays a fraction.
import { describe, it, expect } from 'vitest';
import { answerText, isCorrect, readAnswer } from './index.js';
import { itemFor } from '@/learn/items.ts';
import { ALL_SKILLS, parseSkill } from '@/learn/skills.ts';
import { loadAllContent, contentOf } from '@/learn/content/index.ts';
import { seeded } from '@/learn/expr.ts';
import { freezeItem } from '@/lib/exam.js';

await loadAllContent();

const num = (topic, answer, extra = {}) => ({ form: 'num', topic, level: 1, key: 'k', text: 'כמה?', answer, ...extra });

describe('measures and relative frequencies are written as decimals in a key', () => {
  it('the council\'s cases', () => {
    expect(answerText(num('sim', 19.5))).toBe('19.5');
    expect(answerText(num('sim', 9.9))).toBe('9.9');
    expect(answerText(num('sim', 11.2))).toBe('11.2');
    expect(answerText(num('sim', 112.5))).toBe('112.5');
    expect(answerText(num('congr', 13.5))).toBe('13.5');
    expect(answerText(num('data', 0.2, { precise: true }))).toBe('0.2');
    expect(answerText(num('data', 0.35, { precise: true }))).toBe('0.35');
    expect(answerText(num('prob', 0.375, { precise: true }))).toBe('0.375');
    // a value with no short decimal is still exact
    expect(answerText(num('prob', 1 / 6, { precise: true }))).toBe('1/6');
    expect(answerText(num('data', 13 / 30, { precise: true }))).toBe('13/30');
    expect(answerText(num('sim', 2 / 3))).toBe('2/3');
    // the class exam's key is the same text
    expect(freezeItem(num('sim', 19.5)).answerText).toBe('19.5');
  });

  it('every typed decimal answer of these units, from every source a check or an exam draws, is keyed as a decimal', () => {
    const rnd = seeded(31);
    const bad = {};
    let seen = 0;
    for (const skill of ALL_SKILLS.filter((s) => ['sim', 'congr', 'data', 'prob'].includes(parseSkill(s).topic))) {
      const c = contentOf(skill);
      for (const source of ['gen', 'diag', 'transfer']) {
        if (source !== 'gen' && !c?.[source]) continue;
        for (let i = 0; i < 300; i += 1) {
          const it = itemFor(skill, source, rnd);
          if (it.form !== 'num' || typeof it.answer !== 'number' || Number.isInteger(it.answer)) continue;
          const places = it.precise || it.fmt === 'dec' ? 3 : 2;
          const k = 10 ** places;
          if (Math.abs(Math.round(it.answer * k) / k - it.answer) > 1e-9) continue; // no short decimal: a fraction is right
          seen += 1;
          const key = answerText(it);
          if (key.includes('/')) bad[`${skill} ${source}`] ||= `${it.key}: ${it.answer} keyed "${key}"`;
          // the key, typed back, is right
          expect(isCorrect(it, readAnswer(it, { v: key })), `${it.key} "${key}"`).toBe(true);
        }
      }
    }
    expect(seen).toBeGreaterThan(200);
    expect(bad).toEqual({});
  });
});
