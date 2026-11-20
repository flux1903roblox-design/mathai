// The protractor's numbers (FUNC-1.2, Critique note 8): sized in the pixels a phone draws them at, laid out so that on a
// 320px phone (the drawing 288px wide) no two numbers touch, none is under 10px, both 0s are there and so are the
// numbers at each arm of the item, however the protractor is turned. Below 360px the inner scale is numbered every 20°.
import { describe, it, expect } from 'vitest';
import { protractorLabels, PROT, PROT_PX } from './protractor.jsx';

const apart = (a, b) => a[2] <= b[0] || b[2] <= a[0] || a[3] <= b[1] || b[3] <= a[1];
const has = (labels, scale, phi) => labels.some((L) => L.scale === scale && L.phi === phi);
const tens = (p) => (p % 10 === 0 ? [p] : [Math.floor(p / 10) * 10, Math.ceil(p / 10) * 10]);

/** Everything the layout promises at one width, turn and pair of arms. */
function problems(drawn, base, arms) {
  const k = drawn / PROT.W; const labels = protractorLabels({ drawn, base, arms }); const bad = [];
  labels.forEach((a, i) => labels.slice(i + 1).forEach((b) => { if (!apart(a.box, b.box)) bad.push(`${a.text} (${a.scale}) touches ${b.text} (${b.scale})`); }));
  labels.forEach((L) => {
    if (L.size * k < 10 - 1e-9) bad.push(`${L.text} is ${(L.size * k).toFixed(2)}px`);
    if (L.box[0] < -PROT.W / 2 * k - 1e-6 || L.box[2] > PROT.W / 2 * k + 1e-6) bad.push(`${L.text} leaves the box`);
  });
  if (!has(labels, 'right', 0) || !has(labels, 'left', 180)) bad.push('a 0 is missing');
  // an arm on a ten has that ten on both scales; between two tens, at least one of them on each scale
  arms.forEach((a) => ['right', 'left'].forEach((sc) => { if (!tens(a).some((p) => has(labels, sc, p))) bad.push(`no number at the arm ${a} on the scale that starts on the ${sc}`); }));
  return bad;
}

describe('the protractor\'s numbers on a 320px phone (288px drawn)', () => {
  it('are 11px outside and 10px inside, whatever the width they are drawn at', () => {
    for (const drawn of [288, 300, 358, 420]) {
      const k = drawn / PROT.W;
      for (const L of protractorLabels({ drawn })) expect(L.size * k).toBeCloseTo(L.scale === 'left' ? PROT_PX.outer : PROT_PX.inner, 9);
    }
  });
  it('outer every 10°, inner every 20° below 360px and every 10° from 360px; both 0s always', () => {
    const at288 = protractorLabels({ drawn: 288 });
    expect(at288.filter((L) => L.scale === 'left').map((L) => L.phi).sort((a, b) => a - b)).toEqual(Array.from({ length: 19 }, (_, i) => i * 10));
    expect(at288.filter((L) => L.scale === 'right').map((L) => L.phi).sort((a, b) => a - b)).toEqual(Array.from({ length: 10 }, (_, i) => i * 20));
    const at360 = protractorLabels({ drawn: 360 });
    expect(at360.filter((L) => L.scale === 'right')).toHaveLength(19);
    // the scale that starts on the right reads phi, the one that starts on the left 180 − phi
    expect(at288.find((L) => L.scale === 'right' && L.phi === 0).text).toBe('0');
    expect(at288.find((L) => L.scale === 'left' && L.phi === 180).text).toBe('0');
    expect(at288.find((L) => L.scale === 'left' && L.phi === 40).text).toBe('140');
  });
  it('no two numbers touch, none is under 10px, and each arm\'s numbers are there: every pair of arms, every turn', () => {
    const bad = [];
    for (let base = 0; base < 360; base += 15) {
      for (let a = 0; a <= 180; a += 5) {
        for (let b = a + 15; b <= 180; b += 5) problems(288, base, [a, b]).forEach((p) => bad.push(`base ${base}, arms ${a}, ${b}: ${p}`));
      }
    }
    expect(bad.slice(0, 10)).toEqual([]);
  });
  it('an arm between two tens keeps both tens on both scales where they fit, even where the inner scale is thinned', () => {
    const labels = protractorLabels({ drawn: 288, arms: [0, 65] });
    for (const p of [60, 70]) { expect(has(labels, 'right', p)).toBe(true); expect(has(labels, 'left', p)).toBe(true); }
    expect(labels.some((L) => L.text === '65')).toBe(false); // a protractor prints tens: 65 is read between them
  });
  it('the numbers stay upright and on their ring when the protractor is turned', () => {
    const flat = protractorLabels({ drawn: 288 }); const turned = protractorLabels({ drawn: 288, base: 90 });
    const r = (L) => Math.hypot(L.x, L.y);
    // turned a quarter, the 0 of the scale that starts on the right is at the top
    const z = turned.find((L) => L.scale === 'right' && L.phi === 0);
    expect(z.y).toBeLessThan(-100); expect(Math.abs(z.x)).toBeLessThan(10);
    // the outer ring outside the rim, the inner one inside the ticks, as the size of each number allows
    for (const L of [...flat, ...turned]) {
      if (L.scale === 'left') expect(r(L)).toBeGreaterThan(PROT.R); else expect(r(L)).toBeLessThan(PROT.R - PROT.tick10);
    }
  });
});
