// The exam pass (COUNCIL2-29, COUNCIL2-33): the family plan for 30 days, paid once, never renewed. It is offered on the
// parents' pages only: no child's screen names it or prices it. Its words before the purchase say until when, that it
// never charges again and the 14 days; cancelling it is offered only while it gives money back.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { PASS_DAYS, addDaysIso, passPrice, formatAgorot } from '@/lib/price.js';
import { PLAN_DAYS } from '@shared/sold.js';
import { passLine, passCancels, PASS_NAME } from './Parents.jsx';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const walk = (dir) => readdirSync(dir).flatMap((f) => {
  const p = path.join(dir, f);
  return statSync(p).isDirectory() ? walk(p) : [p];
});

describe('the exam pass on the parents\' pages', () => {
  it('lasts the days the server counts, and is priced in those days', () => {
    expect(PASS_DAYS).toBe(30);
    expect(PASS_DAYS).toBe(PLAN_DAYS.exam_pass);
    expect(addDaysIso('2027-01-31T10:00:00.000Z', PASS_DAYS)).toBe('2027-03-02T10:00:00.000Z');
    expect(passPrice(3900)).toBe('₪39 ל־30 יום');
    expect(passPrice(4490)).toBe(`${formatAgorot(4490)} ל־30 יום`);
  });

  it('says before the purchase until when, that it never charges again, and the 14 days', () => {
    expect(passLine('11.12.2026')).toBe('החבילה ל־30 יום, עד 11.12.2026. היא לא מתחדשת מעצמה ולא נחייב אתכם שוב. ב־14 הימים הראשונים אפשר לבטל ולקבל את כל הכסף בחזרה.');
    expect(PASS_NAME).toBe('חבילת מבחן');
  });

  it('is cancelled only for money back: the whole price in the 14 days, then the unused days, then nothing to cancel', () => {
    const pass = { plan: 'exam_pass', canRefundNow: true, canProrata: false, prorataAgorot: null };
    expect(passCancels(pass)).toEqual(['refund_now']);
    expect(passCancels({ ...pass, canRefundNow: false, canProrata: true, prorataAgorot: 1170 })).toEqual(['prorata']);
    expect(passCancels({ ...pass, canRefundNow: false, canProrata: true, prorataAgorot: 0 })).toEqual([]);
    // every other plan keeps its own sheet (null: not a pass)
    expect(passCancels({ plan: 'family_month', canRefundNow: true })).toBe(null);
    expect(passCancels(null)).toBe(null);
  });

  it('is never named or priced on a child\'s screen: only the parents\' pages, the terms and the QA fixtures know it', () => {
    const ALLOWED = ['screens/parents/Parents.jsx', 'screens/parents/Legal.jsx', 'content/legal/terms.md', 'lib/qaViews.js', 'lib/price.js'];
    const found = walk(SRC)
      .filter((p) => /\.(jsx?|tsx?|md|css)$/.test(p) && !/\.test\./.test(p))
      .filter((p) => /exam_pass|חבילת מבחן|חבילת המבחן|PASS_NAME|passPrice\(/.test(readFileSync(p, 'utf8')))
      .map((p) => path.relative(SRC, p).split(path.sep).join('/'));
    expect(found.sort()).toEqual([...ALLOWED].sort());
  });
});
