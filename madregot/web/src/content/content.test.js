import { describe, it, expect } from 'vitest';
import katex from 'katex';
import { TOPICS, makeItem, isCorrect, answerText, itemPlain } from './index.js';
import { parseNum } from './util.js';

const RUNS = 300;

// Collect every $...$ chunk and the display expression so KaTeX can check them.
const texChunks = (it) => {
  const out = [];
  const grab = (s) => String(s || '').replace(/\$([^$]+)\$/g, (_, t) => { out.push(t); return ''; });
  grab(it.text); grab(it.hint); (it.solution || []).forEach(grab);
  if (it.display) out.push(it.display);
  (it.choices || []).forEach((c) => c.tex && out.push(c.tex));
  return out;
};

describe('generators', () => {
  for (const t of TOPICS) {
    t.levels.forEach((L, i) => {
      it(`${t.id} level ${i + 1}: ${L.title}`, () => {
        for (let r = 0; r < RUNS; r++) {
          const item = makeItem(t.id, i + 1);
          expect(item.key).toBeTruthy();
          expect(item.hint).toBeTruthy();
          expect(item.solution?.length).toBeGreaterThan(0);
          // The exact answer must be accepted and must not be diagnosed as a mistake.
          expect(isCorrect(item, item.answer)).toBe(true);
          expect(item.diag(item.answer)).toBeNull();
          if (item.form === 'num') {
            expect(Number.isFinite(item.answer)).toBe(true);
            // What we print as the answer parses back to the same value.
            expect(Math.abs(parseNum(answerText(item)) - item.answer)).toBeLessThan(0.01);
          }
          if (item.form === 'mc') expect(item.choices[item.answer]).toBeTruthy();
          for (const tex of texChunks(item)) {
            expect(() => katex.renderToString(tex, { throwOnError: true })).not.toThrow();
          }
          expect(itemPlain(item).length).toBeGreaterThan(3);
          // Every diagnosis category the generator can return has Hebrew text.
          const wrong = item.form === 'num' ? item.answer + 1 : null;
          if (wrong != null) { const c = item.diag(wrong); if (c) expect(t.cats[c]).toBeTruthy(); }
        }
      });
    });
  }
});

describe('math checks', () => {
  it('pythagoras answers satisfy a^2 + b^2 = c^2', () => {
    for (let r = 0; r < RUNS; r++) {
      const h = makeItem('pyth', 1); const { a, b } = h.fig;
      expect(a * a + b * b).toBe(h.answer * h.answer);
      const l = makeItem('pyth', 2); expect(l.fig.a ** 2 + l.answer ** 2).toBe(l.fig.c ** 2);
    }
  });
  it('slope matches the two points', () => {
    for (let r = 0; r < RUNS; r++) {
      const s = makeItem('line', 1); const [A, B] = s.fig.points;
      expect(Math.abs((B.y - A.y) / (B.x - A.x) - s.answer)).toBeLessThan(1e-9);
    }
  });
  it('line through two points passes through both', () => {
    for (let r = 0; r < RUNS; r++) {
      const it2 = makeItem('line', 4);
      const pts = [...it2.text.matchAll(/\((-?\d+), (-?\d+)\)/g)].map((m) => [Number(m[1]), Number(m[2])]);
      for (const [x, y] of pts) expect(it2.answer.m * x + it2.answer.b).toBe(y);
    }
  });
  it('triangle angles sum to 180', () => {
    for (let r = 0; r < RUNS; r++) {
      const t = makeItem('angles', 3);
      expect(t.fig.angles.reduce((x, y) => x + y, 0)).toBe(180);
    }
  });
  it('parses student input', () => {
    expect(parseNum('−3')).toBe(-3);
    expect(parseNum('3/4')).toBe(0.75);
    expect(parseNum('-3/4')).toBe(-0.75);
    expect(parseNum('2,5')).toBe(2.5);
    expect(parseNum('1/0')).toBeNull();
    expect(parseNum('abc')).toBeNull();
  });
});
