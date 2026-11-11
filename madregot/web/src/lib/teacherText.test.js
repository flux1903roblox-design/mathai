// TEACHER-16: the teacher reads, for every mistake, the words the student saw on that stair's feedback line, with the
// stair named, and never a raw id. Every stair is checked with every id it can carry: its own misconceptions, its
// topic's categories, and every category its generators' diag() gives for wrong answers (sampled as
// content/labels.test.js samples them).
import { describe, it, expect } from 'vitest';
import { TOPICS, TOPIC, makeItem, isCorrect, catLabel } from '@/content/index.js';
import { CONTENT } from '@/learn/content/index.ts';
import { candidates } from '@/content/labels.sample.js';
import { mistakeText, stairName, stairShort, mistakeLine } from './teacherText.js';

const ITEMS_PER_STAIR = 40;
const HEBREW = /[א-ת]/;

/** The categories a stair's generators give for wrong answers. */
function sampled(topic, level) {
  const out = new Set();
  for (let k = 0; k < ITEMS_PER_STAIR; k += 1) {
    const item = makeItem(topic, level);
    for (const u of candidates(item)) {
      if (isCorrect(item, u)) continue;
      const cat = item.diag(u);
      if (cat) out.add(cat);
    }
  }
  return out;
}

describe('every stair: the teacher reads the student\'s words, with the stair named', () => {
  TOPICS.forEach((t) => {
    t.levels.forEach((L, i) => {
      const level = i + 1;
      it(`${t.id}:${level} ${L.title}`, () => {
        expect(stairName(t.id, level)).toBe(`${t.title}, מדרגה ${level}: ${L.title}`);
        const own = (CONTENT[`${t.id}:${level}`]?.misconceptions || []).map((m) => m.id);
        const fromGenerators = sampled(t.id, level);
        const ids = new Set([...own, ...Object.keys(t.cats || {}), ...fromGenerators]);
        for (const cat of ids) {
          const words = mistakeText(t.id, level, cat);
          expect(words, `${t.id}:${level} '${cat}'`).toBe(catLabel(t.id, level, cat));
          expect(words.trim(), `${t.id}:${level} '${cat}'`).not.toBe('');
          expect(words, `${t.id}:${level} '${cat}' is the raw id`).not.toBe(cat);
          expect(words, `${t.id}:${level} '${cat}' is not Hebrew`).toMatch(HEBREW);
        }
        // a stair's own misconception is told in its own words, as the student saw them
        for (const m of CONTENT[`${t.id}:${level}`]?.misconceptions || []) expect(mistakeText(t.id, level, m.id)).toBe(m.title);
      });
    });
  });
});

describe('the review\'s cases and the fallbacks', () => {
  it('one id, two meanings: coord:3 and line:3 say what the student was told, not the topic\'s wording', () => {
    for (const [topic, level] of [['coord', 3], ['line', 3]]) {
      const own = CONTENT[`${topic}:${level}`].misconceptions.find((m) => m.id === 'sign');
      expect(own, `${topic}:${level} has its own 'sign'`).toBeTruthy();
      expect(mistakeText(topic, level, 'sign')).toBe(own.title);
      expect(mistakeText(topic, level, 'sign')).not.toBe(TOPIC[topic].cats.sign);
    }
  });

  it('the stair\'s short name and a report cell; an unknown topic, stair or id never shows a raw id', () => {
    expect(stairShort('signed', 1)).toBe(`${TOPIC.signed.title}, מדרגה 1`);
    expect(stairName('signed', 1)).toBe(`${TOPIC.signed.title}, מדרגה 1: ${TOPIC.signed.levels[0].title}`);
    expect(mistakeLine('signed', 1, 'sign')).toBe(`${mistakeText('signed', 1, 'sign')} (${TOPIC.signed.title}, מדרגה 1)`);
    expect(stairName('signed', 99)).toBe(`${TOPIC.signed.title}, מדרגה 99`);
    expect(stairShort('signed', null)).toBe(TOPIC.signed.title);
    expect(stairName('bogus', 1)).toBe('נושא אחר');
    expect(mistakeText('signed', 1, 'no-such-id')).toBe('טעות שחוזרת');
    expect(mistakeText('bogus', 1, 'sign')).toBe('טעות שחוזרת');
  });
});
