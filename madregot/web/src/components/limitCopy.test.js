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

describe('a class whose tutor is off (trust spec TRUST-11 §6)', () => {
  it('the calm sheet: says it is the class\'s choice under the Ministry\'s rules, practice is the way on, no parents link', () => {
    for (const tier of [null, 'free', 'class']) {
      const v = limitVariant({ reason: 'class_ai_off', tier });
      expect(v.title).toBe('בכיתה הזו העוזר החכם כבוי');
      expect(v.text).toEqual(['כך החליטו בכיתה, לפי ההנחיות של משרד החינוך. מדי, השיעורים והתרגול פתוחים כמו תמיד.']);
      expect(v.actions).toEqual(['practice']);
      expect(v.parents).toBe(false);
    }
  });
  it('the allowance line and the tools say the same in one line', () => {
    expect(allowanceText({ state: 'class_off', left: null, tier: null })).toBe('בכיתה הזו העוזר החכם כבוי.');
    for (const kind of ['check', 'generate', 'exam']) {
      const t = lockedText(kind, { state: 'class_off', inClass: true });
      expect(t.lines[0]).toBe('בכיתה הזו העוזר החכם כבוי.');
      expect(t.parents).toBe(false); expect(t.teacher).toBe(false);
    }
  });
});

describe('a device waiting for a parent\'s OK (trust spec TRUST-9 §4)', () => {
  it('the sheet: one OK from a parent, free, a minute; the screen for the parents first, then practice', () => {
    for (const tier of [null, 'free']) {
      const v = limitVariant({ reason: 'parent_ok_needed', tier });
      expect(v.title).toBe('קודם, אישור של הורה');
      expect(v.text).toEqual(['כדי לשאול את העוזר החכם, אחד ההורים צריך לאשר את זה פעם אחת. זה בחינם ולוקח דקה. בינתיים מדי, השיעורים והתרגול פתוחים כמו תמיד.']);
      expect(v.actions).toEqual(['parents', 'practice']);
      expect(v.parents).toBe(false); // the button is the way to the parents: no second link
    }
  });
  it('the allowance line and the tools say it in one line; the tools link to the screen for the parents', () => {
    expect(allowanceText({ state: 'parent_ok_needed', left: null, tier: null })).toBe('העוזר החכם מחכה לאישור של הורה.');
    for (const kind of ['check', 'generate', 'exam']) {
      const t = lockedText(kind, { state: 'parent_ok_needed', inClass: false });
      expect(t.lines[0]).toBe('העוזר החכם מחכה לאישור של הורה.');
      expect(t.parents).toBe(true); expect(t.teacher).toBe(false);
    }
  });
});

describe('a teacher whose class is not bound to an email (TRUST-9, the trust review)', () => {
  it('the sheet asks for an email, never a parent, and offers the sign-in in place', () => {
    const v = limitVariant({ reason: 'parent_ok_needed', role: 'teacher' });
    expect(v.title).toBe('קודם, כניסה עם מייל');
    expect(v.actions).toEqual(['bind']);
    expect(v.parents).toBe(false);
    expect(v.text.join(' ')).not.toContain('הורה');
  });
  it('the allowance line and the tools say it in teacher words, with a sign-in and no parents\' link', () => {
    expect(allowanceText({ state: 'parent_ok_needed', left: null, tier: null, role: 'teacher' })).toBe('העוזר החכם נפתח למורים אחרי כניסה עם המייל.');
    const t = lockedText('check', { state: 'parent_ok_needed', role: 'teacher' });
    expect(t.lines[0]).toBe('העוזר החכם נפתח למורים אחרי כניסה עם המייל.');
    expect(t.bind).toBe(true); expect(t.parents).toBe(false);
    // a child still sees the parents' line
    expect(allowanceText({ state: 'parent_ok_needed', left: null, tier: null, role: 'student' })).toBe('העוזר החכם מחכה לאישור של הורה.');
  });
});

describe('no copy a child sees has a price or a push to buy', () => {
  const variants = [];
  for (const reason of ['daily_limit', 'shared_limit', 'free_paused', 'monthly_fair_use', 'paid_only', 'class_ai_off', 'parent_ok_needed']) {
    for (const tier of ['free', 'family', 'class', 'open']) for (const scope of ['network', 'class']) variants.push(limitVariant({ reason, tier, scope }));
  }
  for (const kind of ['check', 'generate', 'exam']) for (const state of ['locked', 'economy', 'class_off', 'parent_ok_needed']) for (const inClass of [true, false]) variants.push(lockedText(kind, { state, inClass }));
  const lines = [];
  for (const tier of ['free', 'family', 'open']) for (const state of ['free', 'used', 'open']) for (const left of [0, 1, 2, 5]) lines.push(allowanceText({ state, left, tier }));
  lines.push(allowanceText({ state: 'free', left: 2, tier: 'free', ended: true }));
  lines.push(allowanceText({ state: 'class_off', left: null, tier: null }));
  lines.push(allowanceText({ state: 'parent_ok_needed', left: null, tier: null }));
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

describe('the class\'s AI is off (TRUST-11 §6): calm, the class rules, no price and no parents link', () => {
  it('the sheet, the quiet line and a tool', () => {
    for (const role of ['student', 'teacher']) {
      const v = limitVariant({ reason: 'class_ai_off', tier: 'class_off', role });
      expect(v.title).toBe('בכיתה הזו העוזר החכם כבוי');
      expect(v.text).toEqual(['כך החליטו בכיתה, לפי ההנחיות של משרד החינוך. מדי, השיעורים והתרגול פתוחים כמו תמיד.']);
      expect(v.actions).toEqual(['practice']);
      expect(v.parents).toBe(false);
    }
    expect(allowanceText({ state: 'class_off', left: null, tier: 'class_off' })).toBe('בכיתה הזו העוזר החכם כבוי.');
    const t = lockedText('check', { state: 'class_off', inClass: true });
    expect(t.lines[0]).toBe('בכיתה הזו העוזר החכם כבוי.');
    expect([t.teacher, t.parents]).toEqual([false, false]);
  });
});

describe('in a store app (STUDENT-12): when the questions come back, and no way to the parents\' pages', () => {
  const REASONS = ['daily_limit', 'shared_limit', 'free_paused', 'monthly_fair_use', 'paid_only'];
  it('the day\'s limit says only that the questions come back tomorrow', () => {
    for (const tier of ['free', 'family', 'class', null]) {
      const v = limitVariant({ reason: 'daily_limit', tier, store: true });
      expect(v.text).toEqual(['סיימתם את השאלות לעוזר החכם להיום. מחר יש עוד. השיעורים, התרגול ומדי פתוחים תמיד.']);
      expect(v.actions).toEqual(['madi', 'practice']);
      expect(v.parents).toBe(false);
    }
  });
  it('no variant and no locked tool links to the parents, or names a price, a plan or the website', () => {
    for (const reason of REASONS) {
      for (const tier of ['free', 'family', null]) {
        const v = limitVariant({ reason, tier, store: true });
        expect(v.parents, reason).toBe(false);
        expect(words(v)).not.toMatch(/₪|מנוי|תוכנית|באתר|לקנות|קנו|שדרגו/);
      }
    }
    for (const kind of ['check', 'generate', 'exam']) {
      for (const inClass of [false, true]) {
        const t = lockedText(kind, { inClass, store: true });
        expect(t.parents, kind).toBe(false);
        expect(words(t)).not.toMatch(/₪|מנוי|באתר|לקנות/);
      }
    }
  });
  it('a teacher keeps the class licence (sold to schools by invoice)', () => {
    expect(limitVariant({ reason: 'daily_limit', tier: 'free', role: 'teacher', store: true }).actions).toEqual(['licence']);
  });
  it('the web keeps its own words', () => {
    expect(limitVariant({ reason: 'daily_limit', tier: 'free' }).parents).toBe(true);
    expect(lockedText('check', {}).parents).toBe(true);
  });
});
