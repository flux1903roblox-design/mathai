// solid:4's transfer story, a skateboard ramp in concrete (council round 3, math): a ramp 15 m high on an 8 m base is no
// skateboard ramp. Its height is always below its base, so the slope is under 45°, as a real ramp's is.
import { describe, it, expect } from 'vitest';
import { SOLID4T, rampText } from './solid.js';
import { itemFor } from '@/learn/items.ts';
import { loadAllContent } from '@/learn/content/index.ts';
import { seeded } from '@/learn/expr.ts';

await loadAllContent();

describe('solid:4: the skateboard ramp is a ramp', () => {
  it('its height is below its base on every draw, and the three sides are a right triangle', () => {
    const rnd = seeded(78);
    const heights = new Set();
    for (let i = 0; i < 4000; i += 1) {
      const p = SOLID4T.params(rnd);
      expect(p.h < p.d, JSON.stringify(p)).toBe(true);
      expect(p.h * p.h + p.d * p.d, JSON.stringify(p)).toBe(p.s * p.s);
      heights.add(p.h);
    }
    // more than one ramp to practise on
    expect(heights.size).toBeGreaterThan(2);
  });
  it('the story the transfer question tells', () => {
    const rnd = seeded(79);
    for (let i = 0; i < 300; i += 1) {
      const it = itemFor('solid:4', 'transfer', rnd);
      const p = JSON.parse(String(it.key).replace(/^solid:4:transfer:/, ''));
      expect(it.text).toBe(rampText(p));
      expect(p.h < p.d, it.text).toBe(true);
    }
  });
});
