// The weekly summary's link and message (PARENTS-2): the WeekShare whitelist and its per-week ranges, the size of a
// maximal week, the wa.me length limit, the Hebrew of the message, and the consumer rule that no child-facing report
// string mentions a plan or a price (Consumer Protection Regulations, minors, reg. 3(5)). Synthetic weeks only.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  encodeShare, decodeShare, shareOf, shareText, shareLink, waHref, weekFromShare, validShare, isDay, dm, WA_MAX, SHARE_PREFIX,
} from './share.js';
import { weekDays, weekFrom, stairName } from '@/learn/report.ts';
import { STAIR_NAMES } from '@shared/stairs.js';
import ReportView, { SOURCE_NOTE } from '@/components/report/ReportView.jsx';

const START = '2026-11-08'; // a Sunday
const BASE = 'https://madregot.example.test/';
const ALL_STAIRS = Object.keys(STAIR_NAMES);

/** A week report, as learn/report.ts weekLocal makes it (lists in the order they first appeared). */
function week(over = {}) {
  const days = weekDays(START).map((d, i) => ({ d, on: [0, 1, 3, 4].includes(i), rest: i === 6, future: i >= 5, m: 10 }));
  return {
    start: START, end: '2026-11-14', days, activeDays: 4, minutes: 52, questions: 61, lessons: 5, stages: 4, reviews: 2,
    worked: ['signed:1', 'signed:2'], mastered: ['signed:1'], open: [['signed:2', 'neg-compare']], openAt: '2026-11-12',
    fixed: [['signed:1', 'minus-minus']], streak: 6, exam: { d: '2026-11-20', n: 3, of: 5 }, empty: false, ...over,
  };
}

/** The biggest week the link can carry: 12 + 12 stairs, 8 repairs with 30-character ids, an exam, every range at its top. */
function maximal() {
  const id = (i) => `mistake-${String(i).padStart(2, '0')}-xxxxxxxxxxxxxxxxxxx`.slice(0, 30);
  return week({
    days: weekDays(START).map((d) => ({ d, on: true, rest: false, future: false, m: 600 })),
    activeDays: 7, minutes: 4200, questions: 14000, lessons: 1400, stages: 1400, reviews: 1400, streak: 3650,
    // the longest stair names, so the message is as long as it can be
    worked: [...ALL_STAIRS].sort((a, b) => STAIR_NAMES[b].length - STAIR_NAMES[a].length).slice(0, 12),
    mastered: [...ALL_STAIRS].sort((a, b) => STAIR_NAMES[b].length - STAIR_NAMES[a].length).slice(0, 12),
    open: Array.from({ length: 5 }, (_, i) => ['angles:5', id(i)]),
    fixed: Array.from({ length: 3 }, (_, i) => ['angles:4', id(i + 5)]),
    exam: { d: '2026-11-20', n: 60, of: 60 },
  });
}

/** A payload made by hand (to break one rule at a time). */
const raw = (o) => SHARE_PREFIX + btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const good = () => shareOf(week());
const payloadOf = (text) => /#\/r\/(1\.[A-Za-z0-9_-]+)/.exec(text)?.[1];

describe('WeekShare: the link', () => {
  it('round trip: what is encoded decodes to the same WeekShare, and back to the same week', () => {
    const w = week();
    const s = decodeShare(encodeShare(w));
    expect(s).toEqual(shareOf(w));
    expect(s).toEqual({
      v: 1, w: '2026-11-08', e: '2026-11-14', dd: [1, 1, 0, 1, 1, 3, 3], m: 52, q: 61, ls: 5, st: 4, rv: 2, sr: 6,
      sk: ['signed:2', 'signed:1'], ma: ['signed:1'], fx: [['signed:2', 'neg-compare', 'o'], ['signed:1', 'minus-minus', 'd']],
      ex: { d: '2026-11-20', n: 3, of: 5 },
    });
    const back = weekFromShare(s);
    for (const k of ['start', 'end', 'activeDays', 'minutes', 'questions', 'lessons', 'stages', 'reviews', 'worked', 'mastered', 'open', 'fixed', 'streak', 'exam', 'empty']) expect(back[k], k).toEqual(w[k]);
    // the repairs are as of the day it was sent: the last day before "not yet" (Thursday 12.11)
    expect(back.openAt).toBe('2026-11-12');
    // a Shabbat after the sending day is still rest, never a missed day
    expect(back.days[6]).toMatchObject({ d: '2026-11-14', rest: true, future: true, on: false });
  });

  it('decodeShare returns null on any deviation', () => {
    const bad = {
      'a non-"1." prefix': `2.${encodeShare(week()).slice(2)}`,
      'no prefix at all': encodeShare(week()).slice(2),
      'invalid base64': '1.@@@@',
      'base64 that is not JSON': '1.bm90IGpzb24',
      'a truncated link': encodeShare(week()).slice(0, 40),
      'an extra key': raw({ ...good(), name: 'x' }),
      'a missing key': raw((({ sr, ...rest }) => rest)(good())),
      'a 13th skill': raw({ ...good(), sk: ALL_STAIRS.slice(0, 13) }),
      'a 13th mastered skill': raw({ ...good(), ma: ALL_STAIRS.slice(0, 13) }),
      'a skill twice': raw({ ...good(), sk: ['signed:1', 'signed:1'] }),
      'm: 4201': raw({ ...good(), m: 4201 }),
      'q: 14001': raw({ ...good(), q: 14001 }),
      'a negative count': raw({ ...good(), ls: -1 }),
      'a fraction': raw({ ...good(), st: 1.5 }),
      'a count as text': raw({ ...good(), rv: '2' }),
      'dd of 6 entries': raw({ ...good(), dd: [1, 1, 0, 1, 1, 0] }),
      'dd with a 4': raw({ ...good(), dd: [1, 1, 0, 1, 1, 0, 4] }),
      'skill "SIGNED:1"': raw({ ...good(), sk: ['SIGNED:1'] }),
      'skill "signed:1;"': raw({ ...good(), ma: ['signed:1;'] }),
      'fx state "x"': raw({ ...good(), fx: [['signed:1', 'minus-minus', 'x']] }),
      'a mistake id with a space': raw({ ...good(), fx: [['signed:1', 'minus minus', 'o']] }),
      '9 fixes': raw({ ...good(), fx: Array.from({ length: 9 }, (_, i) => ['signed:1', `m${i}`, 'o']) }),
      'w not a Sunday': raw({ ...good(), w: '2026-11-09', e: '2026-11-15' }),
      'e not w + 6': raw({ ...good(), e: '2026-11-15' }),
      'not a real day': raw({ ...good(), ex: { d: '2026-02-30', n: 1, of: 2 } }),
      'an exam with n > of': raw({ ...good(), ex: { d: '2026-11-20', n: 6, of: 5 } }),
      'an exam with a fourth key': raw({ ...good(), ex: { d: '2026-11-20', n: 1, of: 5, x: 1 } }),
      'v: 2': raw({ ...good(), v: 2 }),
      'an array': raw([good()]),
    };
    for (const [why, s] of Object.entries(bad)) expect(decodeShare(s), why).toBeNull();
    expect(decodeShare(undefined)).toBeNull();
    expect(decodeShare('')).toBeNull();
  });

  it('accepts a legitimate long week (ranges are per week: 700 minutes is fine) and a week without fixes or exam', () => {
    expect(decodeShare(raw({ ...good(), m: 700 }))).not.toBeNull();
    const { fx, ex, ...plain } = good();
    expect(decodeShare(raw(plain))).toEqual(plain);
    expect(validShare(plain)).toBe(true);
  });

  it('the payload is "1." and URL-safe base64 only: nothing a link could break on', () => {
    for (const w of [week(), maximal(), week({ worked: [], mastered: [], open: [], fixed: [], exam: null })]) {
      const p = encodeShare(w);
      expect(p.startsWith('1.')).toBe(true);
      expect(p.slice(2)).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it('a maximal week (12 + 12 stairs, 8 fixes, an exam) encodes to at most 1,500 characters, and decodes', () => {
    const p = encodeShare(maximal());
    expect(p.length).toBeLessThanOrEqual(1500);
    const s = decodeShare(p);
    expect(s.sk).toHaveLength(12);
    expect(s.fx).toHaveLength(8);
  });

  it('a week with more than 12 stairs keeps the 12 newest', () => {
    const many = ALL_STAIRS.slice(0, 15);
    expect(shareOf(week({ worked: many })).sk).toEqual([...many].reverse().slice(0, 12));
  });

  it('the strip: practised, rest, not yet and nothing each have their digit', () => {
    const days = weekDays(START).map((d, i) => ({ d, on: i === 0, rest: i === 6, future: i === 6, m: 0 }));
    days[2].rest = true; // a holiday in the past (STUDENT-5's rest days): rest, not missed
    expect(shareOf(week({ days })).dd).toEqual([1, 0, 2, 0, 0, 0, 3]);
  });
});

describe('the message the child sends', () => {
  const link = (w, includeFixes = true) => shareLink(encodeShare(w, { includeFixes }), BASE);

  it('reads as the spec writes it, in the first person', () => {
    const w = week();
    const text = shareText(w, { link: link(w) });
    expect(text.split('\n')).toEqual([
      'הסיכום השבועי שלי במדרגות (8.11–14.11):',
      '• תרגלתי 4 ימים, בערך 52 דקות',
      '• עברתי בדיקת שליטה במדרגה אחת: מספרים מכוונים: חיבור וחיסור',
      '• תרגלתי: מספרים מכוונים: השוואת מספרים, מספרים מכוונים: חיבור וחיסור',
      '• בתיקון עכשיו: טעות אחת שחוזרת',
      '• רצף: 6 ימים',
      `לסיכום המלא: ${link(w)}`,
    ]);
  });

  it('the name is in the first line only when the profile has one, and never in the link', () => {
    const w = week();
    const text = shareText(w, { name: ' נועה ', link: link(w) });
    expect(text.split('\n')[0]).toBe('הסיכום השבועי של נועה במדרגות (8.11–14.11):');
    const p = payloadOf(text);
    expect(p).toBeTruthy();
    const json = atob(p.slice(2).replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - ((p.length - 2) % 4)) % 4));
    expect(json).not.toContain('נועה');
    expect(json).toMatch(/^[\x20-\x7e]*$/);
  });

  it('without the repairs: no "בתיקון" line, and the link carries no fx', () => {
    const w = week();
    const text = shareText(w, { link: link(w, false), includeFixes: false });
    expect(text).not.toContain('בתיקון');
    const s = decodeShare(payloadOf(text));
    expect(s).not.toBeNull();
    expect(Object.hasOwn(s, 'fx')).toBe(false);
  });

  it('no "בערך" without minutes, no streak line at 0, and the week before any mastery check says so', () => {
    const w = week({ minutes: 0, streak: 0, mastered: [] });
    const text = shareText(w, { link: link(w) });
    expect(text).toContain('• תרגלתי 4 ימים\n');
    expect(text).not.toContain('בערך');
    expect(text).not.toContain('רצף');
    expect(text).toContain('• השבוע עוד לא הייתה בדיקת שליטה');
  });

  it('the prefix ב before a number takes a maqaf, before a word it does not', () => {
    const three = week({ mastered: ['signed:1', 'signed:2', 'coord:1'] });
    expect(shareText(three, { link: link(three) })).toContain('בדיקת שליטה ב־3 מדרגות:');
    const two = week({ mastered: ['signed:1', 'signed:2'] });
    expect(shareText(two, { link: link(two) })).toContain('בדיקת שליטה בשתי מדרגות:');
  });

  it('at most 3 stairs on the "תרגלתי" line, then "ועוד k"', () => {
    const w = week({ worked: ['signed:1', 'signed:2', 'signed:3', 'coord:1', 'coord:2'] });
    expect(shareText(w, { link: link(w) })).toContain('• תרגלתי: מערכת צירים: רביעים, מערכת צירים: קריאת נקודה, מספרים מכוונים: כפל וחילוק ועוד 2');
  });

  it('plain text only: no TeX ($ or a backslash) in any message', () => {
    for (const w of [week(), maximal()]) expect(shareText(w, { link: link(w) })).not.toMatch(/[$\\]/);
  });

  it('a maximal week: the wa.me address stays within 4,096 characters, the "תרגלתי" line shows 2 names, the link is whole', () => {
    const w = maximal();
    const l = link(w);
    const text = shareText(w, { link: l });
    expect(waHref(text).length).toBeLessThanOrEqual(WA_MAX);
    expect(text.endsWith(l)).toBe(true);
    expect(decodeShare(payloadOf(text))).not.toBeNull();
    const lines = text.split('\n');
    const names = [...w.worked].reverse().map((s) => stairName(s));
    const masteredNames = [...w.mastered].reverse().map((s) => stairName(s));
    const worked = lines.find((x) => x.startsWith('• תרגלתי:'));
    const mastered = lines.find((x) => x.startsWith('• עברתי בדיקת שליטה'));
    expect(worked).toBe(`• תרגלתי: ${names.slice(0, 2).join(', ')} ועוד 10`);
    // this week's longest names need more room: the mastered line names the newest 6 and counts the rest
    expect(mastered).toBe(`• עברתי בדיקת שליטה ב־12 מדרגות: ${masteredNames.slice(0, 6).join(', ')} ועוד 6`);
    // with three names and every mastered name, the address would pass the limit
    const full = text.replace(worked, `• תרגלתי: ${names.slice(0, 3).join(', ')} ועוד 9`)
      .replace(mastered, `• עברתי בדיקת שליטה ב־12 מדרגות: ${masteredNames.join(', ')}`);
    expect(waHref(full).length).toBeGreaterThan(WA_MAX);
  });

  it('when only the third practised name is too much, the line shows 2 and every mastered name stays', () => {
    const shortest = [...ALL_STAIRS].sort((a, b) => STAIR_NAMES[a].length - STAIR_NAMES[b].length);
    const w = { ...maximal(), worked: [...shortest].reverse().slice(0, 12), mastered: shortest.slice(0, 12) };
    // a copy of the app at a longer address: the link (never cut) takes more of the message
    const l = shareLink(encodeShare(w), `${BASE}${'copy/'.repeat(30)}`);
    const text = shareText(w, { link: l });
    expect(waHref(text).length).toBeLessThanOrEqual(WA_MAX);
    expect(text.endsWith(l)).toBe(true);
    const names = [...w.worked].reverse().map((s) => stairName(s));
    const worked = text.split('\n').find((x) => x.startsWith('• תרגלתי:'));
    expect(worked).toBe(`• תרגלתי: ${names.slice(0, 2).join(', ')} ועוד 10`);
    expect(waHref(text.replace(worked, `• תרגלתי: ${names.slice(0, 3).join(', ')} ועוד 9`)).length).toBeGreaterThan(WA_MAX);
    const masteredNames = [...w.mastered].reverse().map((s) => stairName(s));
    expect(text).toContain(`• עברתי בדיקת שליטה ב־12 מדרגות: ${masteredNames.join(', ')}\n`);
  });

  it('dates are written day.month', () => {
    expect(dm('2026-11-08')).toBe('8.11');
    expect(dm('2026-01-31')).toBe('31.1');
    expect(isDay('2026-11-31')).toBe(false);
  });
});

describe('the report renderer', () => {
  const html = (w, props = {}) => renderToStaticMarkup(createElement(ReportView, { week: w, today: '2026-11-12', ...props }));

  it('shows every section with its numbers, Shabbat as rest, and no percentage anywhere', () => {
    const out = html(week());
    for (const t of ['השבוע במדרגות', 'א׳ 8.11 – ש׳ 14.11', 'ימי תרגול השבוע: 4', 'שבת, מנוחה', 'ימי תרגול', 'דקות', 'שאלות', 'ימים ברצף',
      'חדש בשליטה', 'עברו בדיקת שליטה: 5 שאלות בלי רמזים, ולפחות 4 נכונות.', 'מה תורגל', 'שלבי לימוד שהושלמו: 4 · שיעורים ובדיקות: 5',
      'חזרות קצרות שעברו בהצלחה: 2', 'טעויות שחוזרות, ומה מתקנים', 'בתיקון', 'תוקן השבוע', 'מבחן קרוב', 'מבחן ב־20.11. 3 מתוך 5 המדרגות של המבחן כבר בשליטה.',
      'איך אפשר לעזור', 'ובקשו שיסבירו לכם דוגמה אחת מ&quot;מספרים מכוונים: השוואת מספרים&quot;.', SOURCE_NOTE.local]) expect(out, t).toContain(t);
    expect(out).not.toContain('%');
    // the repairs are today's, so no "as of" line
    expect(out).not.toContain('נכון ל־');
  });

  it('repairs from another day say their day; an exam with nothing mastered avoids a bare "0 מתוך"', () => {
    const out = html(week({ openAt: '2026-11-10', exam: { d: '2026-11-20', n: 0, of: 4 } }));
    expect(out).toContain('נכון ל־10.11');
    expect(out).toContain('מבחן ב־20.11. בתוכנית ההכנה 4 מדרגות, ובדיקות השליטה עליהן עוד לא נעשו.');
    expect(out).not.toContain('0 מתוך');
  });

  it('a week before any check and with nothing to repair: the calm empty lines, no repairs section, the other tip', () => {
    const out = html(week({ mastered: [], open: [], fixed: [], worked: [], exam: null, reviews: 0 }));
    expect(out).toContain('השבוע לא הייתה בדיקת שליטה. היא מגיעה בסוף כל מדרגה, אחרי ההסבר והתרגול.');
    expect(out).not.toContain('טעויות שחוזרות');
    expect(out).not.toContain('מבחן קרוב');
    expect(out).not.toContain('חזרות קצרות');
    expect(out).toContain('ובקשו שיראו לכם איך נראה שיעור במדרגות.');
  });

  it('at most 6 stairs under "מה תורגל", then "ועוד k"', () => {
    expect(html(week({ worked: ALL_STAIRS.slice(0, 9) }))).toContain('ועוד 3');
  });

  it('the link and the synced report each say where they came from', () => {
    expect(html(week(), { audience: 'parent', source: 'link' })).toContain('הסיכום נוצר במכשיר של הילד ונשלח ממנו. מדרגות לא שומרת אותו.');
    expect(html(week(), { audience: 'parent', source: 'synced' })).toContain('ונשמר 90 יום');
  });

  it('the parent sees, from the link, what the child saw on the device', () => {
    const w = week();
    const fromLink = weekFromShare(decodeShare(encodeShare(w)));
    const strip = (s) => s.replace(/ id="[^"]*"| aria-labelledby="[^"]*"| data-(audience|source)="[^"]*"/g, '');
    expect(strip(html(fromLink, { source: 'local' }))).toBe(strip(html(w, { source: 'local' })));
  });

  it('weekFrom and the link agree on an empty week', () => {
    const empty = weekFrom([], START, '2026-11-12');
    expect(empty.empty).toBe(true);
    expect(weekFromShare(decodeShare(encodeShare(empty))).empty).toBe(true);
  });
});

describe('reg. 3(5): nothing a child sees in the report mentions a plan or a price', () => {
  const FILES = ['../screens/Report.jsx', '../components/report/ShareSheet.jsx', '../components/report/ReportView.jsx', './share.js'];
  it('no "מנוי" and no "₪" in the source of the child report, its sheet, its renderer or its message', () => {
    for (const f of FILES) {
      const src = readFileSync(new URL(f, import.meta.url), 'utf8');
      expect(src, f).not.toMatch(/מנוי|₪/);
    }
  });
  it('nor in what they render or write', () => {
    for (const w of [week(), maximal(), week({ mastered: [], open: [], fixed: [], exam: null })]) {
      const text = shareText(w, { name: 'נועה', link: shareLink(encodeShare(w), BASE) });
      const out = renderToStaticMarkup(createElement(ReportView, { week: w, today: '2026-11-12' }));
      for (const s of [text, out]) expect(s).not.toMatch(/מנוי|₪/);
    }
  });
});
