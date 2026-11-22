// area:4, the parallelogram (council round 3, math): its side and the height to it were always the first two numbers of
// the question, so "multiply the first two numbers" passed the mastery check 14.5% of the time. The three numbers now
// come in every order, each one time in six, in the exercises and in the transfer model's story.
// (learn/guessing.test.ts measures the guess itself: the first two, the last two or two at random, multiplied.)
import { describe, it, expect } from 'vitest';
import { makeItem } from './index.js';
import { AREA4T, PARA_ORDERS, paraText, paraPlotText } from './area.js';
import { seeded } from '@/learn/expr.ts';

/** The question's numbers, in the order it writes them. */
const numbers = (text) => [...String(text).matchAll(/\$[^$]*?(\d+)[^$]*\$/g)].map((m) => Number(m[1]));

function orderShares(texts) {
  const where = { first: 0, last: 0, n: 0 };
  const seen = new Set();
  for (const { text, a, h, s } of texts) {
    const ns = numbers(text);
    expect(ns.sort((x, y) => x - y), text).toEqual([a, h, s].sort((x, y) => x - y));
    const order = numbers(text);
    seen.add(order.map((v) => (v === a ? 'a' : v === h ? 'h' : 's')).join(''));
    const isAH = (x, y) => (x === a && y === h) || (x === h && y === a);
    where.n += 1;
    if (isAH(order[0], order[1])) where.first += 1;
    if (isAH(order[1], order[2])) where.last += 1;
  }
  return { first: where.first / where.n, last: where.last / where.n, seen };
}

describe('area:4: the parallelogram\'s numbers come in every order', () => {
  it('the exercises (ar4p): base and height are the first two, or the last two, about one time in three', () => {
    const texts = [];
    for (let i = 0; i < 8000 && texts.length < 1200; i += 1) {
      const it = makeItem('area', 4);
      if (!it.key.startsWith('ar4p:')) continue;
      const [a, h, s] = it.key.split(':').slice(1).map(Number);
      // a, h and s differ (a printed number is never the answer, and the height is shorter than the slanted side)
      if (new Set([a, h, s]).size < 3) continue;
      texts.push({ text: it.text, a, h, s });
    }
    expect(texts.length).toBeGreaterThan(300);
    const r = orderShares(texts);
    expect(r.seen.size).toBe(6);
    expect(r.first).toBeLessThan(0.42);
    expect(r.last).toBeLessThan(0.42);
  });

  it('the transfer model\'s plot: the same', () => {
    const rnd = seeded(404);
    const texts = [];
    for (let i = 0; i < 3000; i += 1) {
      const p = AREA4T.params(rnd);
      if (new Set([p.a, p.h, p.s]).size < 3) continue;
      texts.push({ text: paraPlotText(p), ...p });
    }
    const r = orderShares(texts);
    expect(r.seen.size).toBe(6);
    expect(r.first).toBeLessThan(0.42);
    expect(r.last).toBeLessThan(0.42);
  });

  it('each order says which number is the height, and to which side', () => {
    const p = { a: 9, h: 6, s: 10 };
    expect(PARA_ORDERS).toHaveLength(6);
    PARA_ORDERS.forEach((_, o) => {
      const t = paraText({ ...p, o });
      expect(t, t).toContain('הגובה לצלע $AB$ הוא $6$ ס״מ');
      expect(t, t).toContain('$AB = 9$ ס״מ');
      expect(t, t).toContain('$AD = 10$ ס״מ');
      expect(t.startsWith('במקבילית $ABCD$'), t).toBe(true);
      expect(t.endsWith('מה שטחה?'), t).toBe(true);
      const plot = paraPlotText({ ...p, o });
      expect(plot.startsWith('חלקת קרקע בצורת מקבילית: '), plot).toBe(true);
      expect(plot, plot).toMatch(/הגובה (אליה|לצלע הראשונה|לצלע השנייה|לאחת הצלעות) \$6\$ מ׳/);
    });
    // the first order is the question as it was
    expect(paraText({ ...p, o: 0 })).toBe('במקבילית $ABCD$: $AB = 9$ ס״מ, הגובה לצלע $AB$ הוא $6$ ס״מ, ו־$AD = 10$ ס״מ. מה שטחה?');
    expect(paraPlotText({ ...p, o: 0 })).toBe('חלקת קרקע בצורת מקבילית: צלע $9$ מ׳, הגובה אליה $6$ מ׳, והצלע השנייה $10$ מ׳. מה שטחה?');
  });
});
