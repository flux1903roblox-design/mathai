// The line builder paints m and b in KaTeX with \color{hex}; the hex comes from the theme's tokens (STUDENT-2 §3).
import { describe, it, expect, afterEach, vi } from 'vitest';
import { lineInks } from './LineBuilder.jsx';

const tokens = (map) => vi.stubGlobal('getComputedStyle', () => ({ getPropertyValue: (n) => map[n] ?? '' }));
afterEach(() => vi.unstubAllGlobals());

describe('lineInks', () => {
  it('reads m from --streak-ink and b from --ch-violet-ink', () => {
    tokens({ '--streak-ink': ' #a84f00', '--ch-violet-ink': '#5232c2 ' });
    expect(lineInks({})).toEqual({ m: '#a84f00', b: '#5232c2' });
  });
  it('leaves the equation plain when a token is missing or is not a hex value KaTeX can take', () => {
    tokens({ '--streak-ink': 'var(--x)' });
    expect(lineInks({})).toEqual({ m: '', b: '' });
  });
  it('is plain without a document (a unit test or the server)', () => expect(lineInks(null)).toEqual({ m: '', b: '' }));
});
