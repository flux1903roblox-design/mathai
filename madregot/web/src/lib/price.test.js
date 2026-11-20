import { describe, it, expect } from 'vitest';
import { formatAgorot, vatOf, vatLine, perMonth, dateNum, chargeDay } from './price.js';

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

describe('chargeDay: the day of the month a monthly plan is charged (trust spec TRUST-10 §4)', () => {
  it('the day in Jerusalem, in words that fit the monthly line', () => {
    expect(chargeDay('2026-11-10T10:00:00Z')).toBe('ב־10 לחודש');
    expect(chargeDay('2026-11-01T08:00:00Z')).toBe('ב־1 לחודש');
    expect(chargeDay('2026-11-28T10:00:00Z')).toBe('ב־28 לחודש');
    // 23:30 UTC on the 9th is already the 10th in Jerusalem
    expect(chargeDay('2026-11-09T23:30:00Z')).toBe('ב־10 לחודש');
  });
  it('a day not every month has: February takes its last day, and the 31st is the last day of every month', () => {
    expect(chargeDay('2026-10-29T10:00:00Z')).toBe('ב־29 לחודש (ובפברואר ביום האחרון שלו)');
    expect(chargeDay('2026-11-30T10:00:00Z')).toBe('ב־30 לחודש (ובפברואר ביום האחרון שלו)');
    expect(chargeDay('2026-12-31T10:00:00Z')).toBe('ביום האחרון של החודש');
    expect(chargeDay('not a date')).toBe('');
  });
});
