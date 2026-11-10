import { describe, it, expect } from 'vitest';
import { limitVariant, allowanceText, lockedText } from './limitCopy.js';

const FORBIDDEN = ['₪', 'קנו', 'שדרגו', 'מנוי'];
const words = (v) => [v.title, ...(v.text || []), ...(v.lines || [])].join(' ');

describe('limitVariant: the calm sheet for each limit', () => {
  it('free daily limit: back tomorrow, Madi now, the parents link', () => {
    const v = limitVariant({ reason: 'daily_limit', tier: 'free' });
    expect(v.title).toBe('העוזר החכם חוזר מחר');
    expect(v.actions).toEqual(['madi', 'practice']);
    expect(v.parents).toBe(true);
  });
  it('a paid daily limit: done for today, no parents link', () => {
    for (const tier of ['family', 'class', 'open']) {
      const v = limitVariant({ reason: 'daily_limit', tier });
      expect(v.title).toBe('להיום סיימנו עם העוזר החכם');
      expect(v.actions).toEqual(['practice']);
      expect(v.parents).toBe(false);
    }
  });
  it('shared limits say it is not about the child', () => {
    expect(limitVariant({ reason: 'shared_limit', scope: 'network' }).text[0]).toContain('מאותה רשת אינטרנט');
    expect(limitVariant({ reason: 'shared_limit', scope: 'class' }).text[0]).toContain('הכיתה שלכם');
    expect(limitVariant({ reason: 'shared_limit', scope: 'class' }).text[0]).toContain('זה לא קשור לשאלות שלכם');
  });
  it('the free tutor resting, and the month\'s checks', () => {
    expect(limitVariant({ reason: 'free_paused' }).title).toBe('העוזר החכם נח היום');
    expect(limitVariant({ reason: 'monthly_fair_use' }).title).toBe('הבדיקות של החודש נגמרו');
  });
  it('a teacher on the free taste is pointed to the class licence', () => {
    const v = limitVariant({ reason: 'daily_limit', tier: 'free', role: 'teacher' });
    expect(v.title).toBe('השאלות של היום לעוזר החכם נגמרו');
    expect(v.actions).toEqual(['licence']);
  });
});

describe('no copy a child sees has a price or a push to buy', () => {
  const variants = [];
  for (const reason of ['daily_limit', 'shared_limit', 'free_paused', 'monthly_fair_use', 'paid_only']) {
    for (const tier of ['free', 'family', 'class', 'open']) for (const scope of ['network', 'class']) variants.push(limitVariant({ reason, tier, scope }));
  }
  for (const kind of ['check', 'generate', 'exam']) for (const state of ['locked', 'economy']) for (const inClass of [true, false]) variants.push(lockedText(kind, { state, inClass }));
  const lines = [];
  for (const tier of ['free', 'family', 'open']) for (const state of ['free', 'used', 'open']) for (const left of [0, 1, 2, 5]) lines.push(allowanceText({ state, left, tier }));
  lines.push(allowanceText({ state: 'free', left: 2, tier: 'free', ended: true }));
  it('limit sheets and tool states', () => {
    for (const v of variants) for (const w of FORBIDDEN) expect(words(v)).not.toContain(w);
  });
  it('the allowance line', () => {
    for (const l of lines.filter(Boolean)) for (const w of FORBIDDEN) expect(l).not.toContain(w);
  });
});

describe('allowanceText: the quiet line about today', () => {
  it('free: 2, 1, then back tomorrow', () => {
    expect(allowanceText({ state: 'free', left: 2, tier: 'free' })).toBe('היום אפשר לשאול את העוזר החכם עוד 2 שאלות.');
    expect(allowanceText({ state: 'free', left: 1, tier: 'free' })).toBe('היום אפשר לשאול את העוזר החכם עוד שאלה אחת.');
    expect(allowanceText({ state: 'used', left: 0, tier: 'free' })).toBe('העוזר החכם חוזר מחר. מדי כאן בינתיים.');
  });
  it('paid: only when 5 or fewer are left', () => {
    expect(allowanceText({ state: 'open', left: 12, tier: 'family' })).toBeNull();
    expect(allowanceText({ state: 'open', left: 5, tier: 'family' })).toBe('נשארו היום 5 שאלות לעוזר החכם.');
    expect(allowanceText({ state: 'open', left: 1, tier: 'class' })).toBe('נשארה היום שאלה אחת לעוזר החכם.');
  });
  it('a plan that ended is said once', () => {
    expect(allowanceText({ state: 'free', left: 2, tier: 'free', ended: true })).toBe('העוזר החכם עובד עכשיו עם 2 שאלות ביום.');
  });
});
