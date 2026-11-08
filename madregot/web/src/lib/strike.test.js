import { describe, it, expect } from 'vitest';
import { afterStrike } from './strike.js';

describe('afterStrike: typing into a struck-out answer starts a new one', () => {
  it('keeps only the keys typed after the old answer', () => {
    expect(afterStrike('97', '979')).toBe('9');
    expect(afterStrike('97', '9716')).toBe('16');
  });
  it('keeps only the keys typed before or inside it', () => {
    expect(afterStrike('97', '597')).toBe('5');
    expect(afterStrike('97', '−97')).toBe('−');
    expect(afterStrike('97', '917')).toBe('1');
  });
  it('takes a pasted or replaced answer whole', () => {
    expect(afterStrike('97', '98')).toBe('98');
    expect(afterStrike('97', '160')).toBe('160');
    expect(afterStrike('97', '5')).toBe('5');
    expect(afterStrike('3/4', '0.75')).toBe('0.75');
  });
  it('clears it on a delete', () => {
    expect(afterStrike('97', '9')).toBe('');
    expect(afterStrike('97', '7')).toBe('');
    expect(afterStrike('97', '')).toBe('');
  });
  it('passes the keys through when there was no old answer', () => {
    expect(afterStrike('', '4')).toBe('4');
    expect(afterStrike(undefined, '4')).toBe('4');
  });
});
