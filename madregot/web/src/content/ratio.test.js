// ratio:3, three packs (ra3p): the worked solution compares the price of 100 g in each. A price is money: it is written
// to the agora (two places), with ≈ when it is rounded, never as the raw float 8.666666667 (council round 3, math).
import { describe, it, expect } from 'vitest';
import { makeItem } from './index.js';

const packs = () => {
  const out = [];
  for (let i = 0; i < 6000 && out.length < 300; i += 1) { const it = makeItem('ratio', 3); if (it.key.startsWith('ra3p:')) out.push(it); }
  return out;
};

describe('ratio:3: the price of 100 g is written as money', () => {
  it('no price in the solution has more than two places, and a rounded one says ≈', () => {
    const items = packs();
    expect(items.length).toBeGreaterThan(50);
    let rounded = 0;
    for (const it of items) {
      const [, ws, ps] = it.key.split(':');
      const w = ws.split(',').map(Number); const p = ps.split(',').map(Number);
      const line = it.solution[0];
      expect(line, it.key).not.toMatch(/\d\.\d{3,}/);
      // each pack's price of 100 g, as the line writes it: exact, or ≈ its rounding to the agora
      for (let k = 0; k < 3; k += 1) {
        const v = (p[k] * 100) / w[k];
        const exact = Math.abs(Math.round(v * 100) - v * 100) < 1e-9;
        if (exact) expect(line, `${it.key} pack ${k}`).toContain(`$${Math.round(v * 100) / 100}$`);
        else { rounded += 1; expect(line, `${it.key} pack ${k}`).toContain(`$\\approx ${v.toFixed(2)}$`); }
      }
    }
    expect(rounded).toBeGreaterThan(0);
  });
});
