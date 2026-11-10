import { describe, it, expect } from 'vitest';
import { formatAgorot, vatOf, vatLine, perMonth, dateNum } from './price.js';

describe('prices on the parents page', () => {
  it('writes agorot as shekels: two decimals, none for a whole amount', () => {
    expect(formatAgorot(2990)).toBe('₪29.90');
    expect(formatAgorot(24900)).toBe('₪249');
    expect(formatAgorot(4905)).toBe('₪49.05');
    expect(formatAgorot(0)).toBe('₪0');
  });
  it('the VAT inside a VAT-included price, in whole agorot', () => {
    expect(vatOf(2990)).toBe(456);
    expect(vatOf(24900)).toBe(3798);
    expect(vatOf(2990, 'exempt')).toBe(0);
  });
  it('says "כולל מע״מ", or "המחיר סופי" for an exempt dealer', () => {
    expect(`${formatAgorot(2990)} ${vatLine('included')}`).toBe('₪29.90 כולל מע״מ');
    expect(vatLine('exempt')).toBe('המחיר סופי');
  });
  it('a yearly price per month floors to whole agorot', () => {
    expect(perMonth(24900)).toBe('₪20.75');
    expect(perMonth(24910)).toBe('₪20.75'); // 2075.83 agorot
  });
  it('dates as dd.mm.yyyy in Jerusalem', () => {
    expect(dateNum('2026-12-10T10:00:00Z')).toBe('10.12.2026');
    expect(dateNum('2026-12-31T23:30:00Z')).toBe('01.01.2027'); // already the next day in Jerusalem
  });
});
