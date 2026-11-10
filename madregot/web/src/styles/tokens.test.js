// The unit colours (STUDENT-1): each unit has its own colour family in tokens.css. Text on them must pass WCAG AA, and
// they must never be mistaken for the colours that carry one meaning (green right, red "not yet", gold, the streak).
// The light theme only; the dark pairs join when the dark theme does.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { topicsFor } from '@/content/index.js';

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');
const root = css.slice(css.indexOf(':root {'), css.indexOf('\n}', css.indexOf(':root {')));
const token = (name) => {
  const m = root.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\b`));
  if (!m) throw new Error(`--${name} is not a hex colour in tokens.css :root`);
  return m[1].toLowerCase();
};

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const luminance = (hex) => { const [r, g, b] = rgb(hex).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
/** HSL hue in degrees. */
function hue(hex) {
  const [r, g, b] = rgb(hex); const max = Math.max(r, g, b); const min = Math.min(r, g, b); const d = max - min;
  if (d === 0) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}
const hueGap = (a, b) => { const d = Math.abs(hue(a) - hue(b)) % 360; return Math.min(d, 360 - d); };

const FAMILIES = ['sky', 'petrol', 'violet', 'fuchsia', 'cobalt'];

describe('unit colours (tokens.css)', () => {
  it('measures colours the WCAG way', () => {
    expect(ratio('#ffffff', '#000000')).toBeCloseTo(21, 5);
    expect(Math.round(hue('#2fbf4a'))).toBe(131);
    expect(Math.round(hue('#c4213b'))).toBe(350);
  });

  for (const f of FAMILIES) {
    it(`${f}: white text on the fill and the dark shade on the tint pass AA, and -ink is -d in light`, () => {
      expect(ratio('#ffffff', token(`ch-${f}`)), `white on --ch-${f}`).toBeGreaterThanOrEqual(4.5);
      expect(ratio(token(`ch-${f}-d`), token(`ch-${f}-tint`)), `--ch-${f}-d on --ch-${f}-tint`).toBeGreaterThanOrEqual(4.5);
      expect(token(`ch-${f}-ink`)).toBe(token(`ch-${f}-d`));
      expect(ratio(token(`ch-${f}-ink`), '#ffffff'), `--ch-${f}-ink on white`).toBeGreaterThanOrEqual(4.5);
    });

    it(`${f}: is none of the colours with one meaning, and is far in hue from right and "not yet"`, () => {
      const c = token(`ch-${f}`);
      for (const m of ['good', 'bad', 'gold', 'streak']) expect(c, `--ch-${f} equals --${m}`).not.toBe(token(m));
      expect(hueGap(c, token('good')), `--ch-${f} next to green`).toBeGreaterThanOrEqual(30);
      expect(hueGap(c, token('bad')), `--ch-${f} next to red`).toBeGreaterThanOrEqual(30);
    });
  }

  it('the five families are five different colours', () => {
    expect(new Set(FAMILIES.map((f) => token(`ch-${f}`))).size).toBe(5);
  });

  it('two units of the same grade differ clearly in lightness or in hue', () => {
    for (const grade of ['7', '8']) {
      const used = [...new Set(topicsFor(grade).map((t) => t.color))];
      for (let i = 0; i < used.length; i += 1) {
        for (let j = i + 1; j < used.length; j += 1) {
          const [a, b] = [token(`ch-${used[i]}`), token(`ch-${used[j]}`)];
          const ok = ratio(a, b) >= 1.4 || hueGap(a, b) >= 30;
          expect(ok, `grade ${grade}: ${used[i]} and ${used[j]} (ratio ${ratio(a, b).toFixed(2)}, hue gap ${hueGap(a, b).toFixed(0)})`).toBe(true);
        }
      }
    }
  });
});
