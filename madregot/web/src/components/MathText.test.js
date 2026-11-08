import { describe, it, expect } from 'vitest';
import { texText } from './MathText.jsx';

describe('texText: maths as words for a screen reader', () => {
  it('says a lone comparison sign in Hebrew', () => {
    expect(texText('<')).toBe('קטן מ־');
    expect(texText('>')).toBe('גדול מ־');
    expect(texText('=')).toBe('שווה ל־');
    expect(texText('\\le')).toBe('קטן או שווה ל־');
  });
  it('turns common TeX into readable text', () => {
    expect(texText('\\frac{3}{4}')).toBe('3/4');
    expect(texText('-\\frac{1}{2} \\cdot 6')).toBe('-1/2 × 6');
    expect(texText('\\sqrt{25}')).toBe('√25');
    expect(texText('a^2 + b^{2}')).toBe('a² + b²');
    expect(texText('90^\\circ')).toBe('90°');
    expect(texText('x \\le 3')).toBe('x ≤ 3');
  });
});
