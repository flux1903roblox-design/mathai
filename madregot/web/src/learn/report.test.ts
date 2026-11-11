// The report engine (PARENTS-1) and the names it shows (PARENTS-8), on synthetic state only. The time zone is fixed to
// Asia/Jerusalem here, so "an answer at 01:30 in Israel" is the same instant on every machine.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
// @ts-ignore: no Node types in this project
import { env } from 'node:process';
import {
  daySummary, weekLocal, weekFrom, weekStart, weekDays, localDay, misconName, stairName, he, withPrefix, REPORT_V,
  SUMMARY_KEYS, UNKNOWN_STAIR, UNKNOWN_MISTAKE, MAX_MINUTES,
} from './report';
import type { DaySummary, ReportInput } from './report';
import type { LearnEvent, LearnState, MisconRecord } from './types';
import { emptyLearn } from './storeGlue';
import { META } from './content/index';
import { TOPICS } from '@/content/index.js';
import { STAIR_NAMES, TOPIC_NAMES, stairName as sharedStairName } from '@shared/stairs.js';
import { texToPlain } from '@shared/plain.js';
import fixture from '@shared/week.fixture.json';

/** The shared fixture week's rows (JSON numbers are wider than the wire type's literals). */
const ROWS = fixture.rows as unknown as DaySummary[];
const TZ = env.TZ;
beforeAll(() => { env.TZ = 'Asia/Jerusalem'; });
afterAll(() => { if (TZ === undefined) delete env.TZ; else env.TZ = TZ; });

// ------------------------------------------------------------------ a synthetic week (Sunday 8 to Shabbat 14 November)
const TODAY = '2026-11-13';
const CTX = { today: TODAY, now: '2026-11-13T15:00:00.000Z' };
const ev = (t: string, e: string, extra: Partial<LearnEvent> = {}): LearnEvent => ({ t, e, ...extra });
const misc = (skill: string, id: string, score: number, state: MisconRecord['state']): MisconRecord => ({ skill, id, score, seen: [], state, at: '2026-11-12T10:00:00.000Z' });

function state(): ReportInput {
  const learn: LearnState = {
    ...emptyLearn(),
    skills: {
      'signed:1': { attempts: [], mastered: { at: '2026-11-08T09:00:00.000Z', box: 0, due: '2026-11-30T00:00:00.000Z' } },
      'signed:2': { attempts: [{ at: '2026-11-08T08:20:00.000Z', ok: true, independent: true, purpose: 'practice' }] },
    },
    miscon: {
      'eq:1|move-sign': misc('eq:1', 'move-sign', 3, 'confirmed'),
      'signed:3|mul-sign': misc('signed:3', 'mul-sign', 2.5, 'repairing'),
      'coord:1|swap': misc('coord:1', 'swap', 2.2, 'confirmed'),
      'angles:1|sum-360': misc('angles:1', 'sum-360', 2.1, 'confirmed'),
      'pyth:1|add-legs': misc('pyth:1', 'add-legs', 2, 'confirmed'),
      'stats:1|mean': misc('stats:1', 'mean', 1.9, 'confirmed'),
      'expr:1|weak': misc('expr:1', 'weak', 0.8, 'suspected'),
      'signed:1|sign-flip': { ...misc('signed:1', 'sign-flip', 2, 'resolved'), resolvedAt: '2026-11-08T09:30:00.000Z' },
    },
    exam: { grade: '7', date: '2026-11-20', skills: ['signed:1', 'signed:2', 'eq:1'], confidence: 2, minutes: 30, createdAt: '2026-11-05T10:00:00.000Z' },
    events: [
      ev('2026-11-06T09:00:00.000Z', 'lesson-done', { s: 'coord:1', p: 'practice', ok: true }),
      ev('2026-11-08T08:00:00.000Z', 'answer', { s: 'signed:1', ok: true }),
      ev('2026-11-08T08:05:00.000Z', 'answer', { s: 'signed:2', ok: false }),
      ev('2026-11-08T08:06:00.000Z', 'answer', { s: 'signed:1', ok: true }),
      ev('2026-11-08T08:10:00.000Z', 'lesson-done', { s: 'signed:1', p: 'practice', ok: true }),
      ev('2026-11-08T08:20:00.000Z', 'check-done', { s: 'signed:2', p: 'mastery', ok: false }),
      ev('2026-11-08T09:00:00.000Z', 'check-done', { s: 'signed:1', p: 'mastery', ok: true }),
      ev('2026-11-08T09:10:00.000Z', 'check-done', { s: 'coord:1', p: 'review', ok: true }),
      ev('2026-11-08T09:20:00.000Z', 'check-done', { s: 'coord:2', p: 'review', ok: false }),
      ev('2026-11-08T09:30:00.000Z', 'repair-done', { s: 'signed:1', m: 'sign-flip', ok: true }),
      ev('2026-11-08T09:31:00.000Z', 'repair-done', { s: 'signed:2', m: 'flip', ok: false }),
      ev('2026-11-08T09:40:00.000Z', 'tutor', { s: 'pyth:1', p: 'explain' }),
      ev('2026-11-08T09:41:00.000Z', 'rescue-created'),
      ev('2026-11-08T09:42:00.000Z', 'merge', { m: 'vault' }),
      ev('2026-11-09T10:00:00.000Z', 'stage-A', { s: 'expr:1' }),
      // 23:30 UTC on the 9th is 01:30 on the 10th in Israel
      ev('2026-11-09T23:30:00.000Z', 'answer', { s: 'eq:1', ok: true }),
      // the 11th: 14 different stairs (at most 12 are listed, the newest)
      ...Array.from({ length: 14 }, (_, i) => ev(`2026-11-11T10:${String(i).padStart(2, '0')}:00.000Z`, 'answer', { s: `line:${(i % 8) + 1}${i >= 8 ? 'x' : ''}`, ok: true })),
      ev('2026-11-13T08:00:00.000Z', 'answer', { s: 'zz:9', ok: true }),
      ev('2026-11-13T08:10:00.000Z', 'repair-start', { s: 'eq:1', m: 'move-sign' }),
    ],
  };
  return {
    learn,
    days: {
      '2026-11-06': { lessons: 1, q: 8, secs: 240 }, // Friday
      // Shabbat the 7th: nothing, and the streak goes on through it
      '2026-11-08': { q: 16, ok: 14, secs: 420, tsecs: 900, lessons: 2, xp: 30 },
      '2026-11-09': { q: 6, secs: 200, lessons: 0, stages: 1 },
      '2026-11-10': { q: 1, secs: 600, tsecs: 120, lessons: 1 },
      '2026-11-11': { q: 14, secs: 300, tsecs: 400, lessons: 0 }, // answers and time only: not a practice day
      '2026-11-13': { q: 8, secs: 100, lessons: 1, name: 'נועה' }, // a name planted in the saved day
    },
  };
}

describe('daySummary', () => {
  it('minutes: time on learning screens, else answer time; always the larger of the two', () => {
    const s = state();
    expect(daySummary(s, '2026-11-08', CTX).m).toBe(15); // tsecs 900
    expect(daySummary(s, '2026-11-09', CTX).m).toBe(3); // no tsecs: secs 200
    expect(daySummary(s, '2026-11-10', CTX).m).toBe(10); // { secs: 600, tsecs: 120 } → 10
    expect(daySummary({ ...s, days: { '2026-11-12': { tsecs: 99_999 } } }, '2026-11-12', CTX).m).toBe(MAX_MINUTES);
    expect(daySummary(s, '2026-11-12', CTX)).toMatchObject({ m: 0, q: 0, ls: 0, st: 0, sk: [], ma: [], rv: 0, fx: [] });
  });

  it('counts the day\'s questions, lessons and teaching stages as saved', () => {
    const s = state();
    expect(daySummary(s, '2026-11-08', CTX)).toMatchObject({ v: REPORT_V, d: '2026-11-08', q: 16, ls: 2, st: 0 });
    expect(daySummary(s, '2026-11-09', CTX)).toMatchObject({ q: 6, ls: 0, st: 1 });
  });

  it('stairs worked on: the events that touch a stair, once each, newest first, at most 12', () => {
    const s = state();
    // the tutor, a rescue plan and a merge are not stairs worked on
    expect(daySummary(s, '2026-11-08', CTX).sk).toEqual(['signed:2', 'signed:1', 'coord:2', 'coord:1']);
    const eleventh = daySummary(s, '2026-11-11', CTX).sk;
    expect(eleventh).toHaveLength(12);
    expect(new Set(eleventh).size).toBe(12);
    expect(eleventh[0]).toBe('line:6x'); // the newest answer of the day
  });

  it('mastered: only a passed mastery check (a finished practice lesson or a failed check is not)', () => {
    const s = state();
    expect(daySummary(s, '2026-11-08', CTX).ma).toEqual(['signed:1']);
    const practiceOnly = { ...s, learn: { ...s.learn, events: [ev('2026-11-08T08:10:00.000Z', 'lesson-done', { s: 'signed:3', p: 'practice', ok: true })] } };
    expect(daySummary(practiceOnly, '2026-11-08', CTX).ma).toEqual([]);
  });

  it('reviews: passed review checks that day', () => {
    expect(daySummary(state(), '2026-11-08', CTX).rv).toBe(1);
  });

  it('mistakes: open ones (top 5 by score) only on today\'s own summary; resolved ones from that day\'s repairs', () => {
    const s = state();
    expect(daySummary(s, TODAY, CTX).fx).toEqual([
      ['eq:1', 'move-sign', 'o'], ['signed:3', 'mul-sign', 'o'], ['coord:1', 'swap', 'o'], ['angles:1', 'sum-360', 'o'], ['pyth:1', 'add-legs', 'o'],
    ]);
    // a past day never invents an open state; a repair that resolved is 'd', one that did not is nothing
    expect(daySummary(s, '2026-11-08', CTX).fx).toEqual([['signed:1', 'sign-flip', 'd']]);
  });

  it('the streak at the end of each day, through Shabbat', () => {
    const s = state();
    expect(daySummary(s, '2026-11-08', CTX).sr).toBe(2); // Friday, Shabbat passed over, Sunday
    expect(daySummary(s, '2026-11-09', CTX).sr).toBe(3);
    expect(daySummary(s, '2026-11-10', CTX).sr).toBe(4);
    expect(daySummary(s, '2026-11-11', CTX).sr).toBe(4); // answers and time alone do not count
    expect(daySummary(s, TODAY, CTX).sr).toBe(1); // the 12th had nothing
  });

  it('an answer at 01:30 in Israel counts on that day, not on the UTC day before', () => {
    expect(localDay('2026-11-09T23:30:00.000Z')).toBe('2026-11-10');
    const s = state();
    expect(daySummary(s, '2026-11-10', CTX).sk).toEqual(['eq:1']);
    expect(daySummary(s, '2026-11-09', CTX).sk).toEqual(['expr:1']);
  });

  it('an exam ahead: its date, its stairs mastered now, its stairs; none once the date has passed', () => {
    const s = state();
    expect(daySummary(s, TODAY, CTX).ex).toEqual({ d: '2026-11-20', n: 1, of: 3 });
    expect(daySummary(s, TODAY, { today: '2026-11-21', now: '2026-11-21T10:00:00.000Z' }).ex).toBeNull();
  });

  it('a stair from another version of the app still counts', () => {
    expect(daySummary(state(), TODAY, CTX).sk).toEqual(['eq:1', 'zz:9']);
    expect(stairName('zz:9')).toBe(UNKNOWN_STAIR);
  });

  it('whitelist: only the wire keys, and nothing of the profile (a name planted in the saved day stays out)', () => {
    const s = state();
    for (const d of weekDays('2026-11-08')) {
      const sum = daySummary(s, d, CTX);
      expect(Object.keys(sum).every((k) => (SUMMARY_KEYS as readonly string[]).includes(k)), d).toBe(true);
      expect(JSON.stringify(sum)).not.toContain('נועה');
    }
    expect([...SUMMARY_KEYS]).toEqual(['v', 'd', 'm', 'q', 'ls', 'st', 'sk', 'ma', 'rv', 'fx', 'sr', 'ex']);
  });
});

describe('weekFrom (shared/week.js)', () => {
  it('the shared fixture week gives the shared answer (the Worker\'s test reads the same file)', () => {
    expect(weekFrom(ROWS, fixture.start, fixture.today)).toEqual(fixture.expected);
    // any day of the week finds the same Sunday
    expect(weekFrom(ROWS, '2026-11-12', fixture.today)).toEqual(fixture.expected);
  });

  it('7 days; Saturday is rest, never a missed day; a holiday passed in as isRest is rest too', () => {
    const w = weekFrom(ROWS, fixture.start, fixture.today);
    expect(w.days.map((d) => d.d)).toEqual(weekDays('2026-11-08'));
    expect(w.days[6]).toMatchObject({ d: '2026-11-14', rest: true, on: false });
    expect(w.activeDays).toBe(4);
    const rest = new Set<string>(fixture.restDays);
    const h = weekFrom(ROWS, fixture.start, fixture.today, (d: string) => rest.has(d));
    expect(h.days.map((d) => d.rest)).toEqual(fixture.expectedRest);
    expect(h.activeDays).toBe(4);
  });

  it('open comes from the newest summary even when its list is empty (an older open list is stale)', () => {
    const rows: DaySummary[] = [
      { v: 1, d: '2026-11-09', m: 5, q: 4, ls: 1, st: 0, sk: [], ma: [], rv: 0, fx: [['eq:1', 'move-sign', 'o']], sr: 1, ex: null },
      { v: 1, d: '2026-11-10', m: 5, q: 4, ls: 1, st: 0, sk: [], ma: [], rv: 0, fx: [['eq:1', 'move-sign', 'd']], sr: 2, ex: null },
    ];
    const w = weekFrom(rows, '2026-11-08', '2026-11-10');
    expect(w.open).toEqual([]);
    expect(w.openAt).toBe('2026-11-10');
    expect(w.fixed).toEqual([['eq:1', 'move-sign']]);
    expect(w.streak).toBe(2);
  });

  it('fixed is the union of the week\'s resolved mistakes, once each', () => {
    const w = weekFrom(ROWS, fixture.start, fixture.today);
    expect(w.fixed).toEqual([['signed:2', 'mul-sign']]); // resolved on the 11th, listed again on the 13th
  });

  it('empty: no questions, lessons, stages or minutes; no rows at all is empty too', () => {
    const zero: DaySummary = { v: 1, d: '2026-11-09', m: 0, q: 0, ls: 0, st: 0, sk: [], ma: [], rv: 0, fx: [], sr: 0, ex: null };
    expect(weekFrom([zero], '2026-11-08', '2026-11-13').empty).toBe(true);
    const none = weekFrom([], '2026-11-08', '2026-11-13');
    expect(none).toMatchObject({ empty: true, activeDays: 0, open: [], openAt: null, streak: 0, exam: null });
    expect(none.days.filter((d) => d.future).map((d) => d.d)).toEqual(['2026-11-14']);
  });

  it('weekStart and weekDays: Sunday to Saturday, in any time zone', () => {
    expect(weekStart('2026-11-14')).toBe('2026-11-08');
    expect(weekStart('2026-11-08')).toBe('2026-11-08');
    expect(weekStart('2026-11-01')).toBe('2026-11-01');
    expect(weekStart('2027-01-01')).toBe('2026-12-27');
    expect(weekDays('2026-11-11')).toEqual(['2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14']);
  });

  it('weekLocal: this device\'s week, through the same function', () => {
    const w = weekLocal(state(), '2026-11-08', CTX);
    expect(w.days.map((d) => d.on)).toEqual([true, true, true, false, false, true, false]);
    expect(w.minutes).toBe(15 + 3 + 10 + 6 + 0 + 1);
    expect(w.questions).toBe(16 + 6 + 1 + 14 + 8);
    expect(w.mastered).toEqual(['signed:1']);
    expect(w.open[0]).toEqual(['eq:1', 'move-sign']);
    expect(w.openAt).toBe(TODAY);
    expect(w.fixed).toEqual([['signed:1', 'sign-flip']]);
    expect(w.streak).toBe(1);
    expect(w.exam).toEqual({ d: '2026-11-20', n: 1, of: 3 });
  });
});

describe('names: shared/stairs.js equals the content, and misconception titles read as plain text', () => {
  it('every topic and every stair of TOPICS has its name, word for word, and STAIR_NAMES holds nothing else', () => {
    const fromContent: Record<string, string> = {};
    for (const t of TOPICS) {
      expect(TOPIC_NAMES[t.id as keyof typeof TOPIC_NAMES], t.id).toBe(t.title);
      t.levels.forEach((l: { title: string }, i: number) => { fromContent[`${t.id}:${i + 1}`] = l.title; });
    }
    expect(STAIR_NAMES).toEqual(fromContent);
    expect(Object.keys(TOPIC_NAMES).sort()).toEqual(TOPICS.map((t: { id: string }) => t.id).sort());
    expect(sharedStairName('signed:1')).toBe('מספרים מכוונים: חיבור וחיסור');
    expect(sharedStairName('zz:1')).toBeNull();
    expect(sharedStairName('constructor')).toBeNull();
  });

  it('every misconception title of the content is clean plain text (no $, no \\, no braces), with and without isolates', () => {
    let n = 0;
    for (const [skill, meta] of Object.entries(META)) {
      for (const m of meta.misconceptions) {
        n += 1;
        const plain = texToPlain(m.title);
        expect(plain, `${skill} ${m.id}`).not.toMatch(/[$\\{}]/);
        const flat = texToPlain(m.title, { isolate: false });
        expect(flat, `${skill} ${m.id}`).not.toMatch(/[$\\{}⁦⁩]/);
        expect(misconName(skill, m.id)).toBe(plain);
      }
    }
    expect(n).toBeGreaterThan(150);
  });

  it('the three examples', () => {
    const a = texToPlain('השלימו ל־$360^\\circ$ במקום ל־$180^\\circ$');
    expect(a).toContain('360°');
    expect(a).toContain('180°');
    expect(texToPlain('$(-3) \\cdot (-4) = -12$')).toBe('⁦(−3) · (−4) = −12⁩');
    expect(texToPlain('$m x_1$')).toBe('⁦m x₁⁩');
    expect(texToPlain('$m x_1$', { isolate: false })).toBe('m x₁');
  });

  it('the rest of the rules: fractions, roots, signs, powers, spaces; text outside maths is left alone', () => {
    expect(texToPlain('$\\frac{1}{2} \\le x \\ne 3$', { isolate: false })).toBe('1/2 ≤ x ≠ 3');
    expect(texToPlain('$\\sqrt{25} \\ge 4 \\times 1$', { isolate: false })).toBe('√25 ≥ 4 × 1');
    expect(texToPlain('$a^2 + b^{2} = c^3$, $y_2 - y_1$', { isolate: false })).toBe('a² + b² = c³, y₂ - y₁');
    expect(texToPlain('$n - 1$ ו־$-(x)$', { isolate: false })).toBe('n - 1 ו־−(x)');
    expect(texToPlain('$3\\;\\square\\;{-12}$', { isolate: false })).toBe('3 \\square −12'); // an unknown command stays visible
    expect(texToPlain('בלי מתמטיקה')).toBe('בלי מתמטיקה');
    expect(texToPlain('')).toBe('');
  });

  it('misconName: the content\'s title, else the topic\'s older name, else a calm fallback', () => {
    const own = META['angles:1'].misconceptions.find((m) => m.id === 'sum-360')!;
    expect(misconName('angles:1', 'sum-360')).toBe(texToPlain(own.title));
    const topicCats = TOPICS.find((t: { id: string }) => t.id === 'signed')!.cats as Record<string, string>;
    const [catId, catName] = Object.entries(topicCats).find(([id]) => !META['signed:1'].misconceptions.some((m) => m.id === id))!;
    expect(misconName('signed:1', catId)).toBe(texToPlain(catName));
    expect(misconName('signed:1', 'no-such-id')).toBe(UNKNOWN_MISTAKE);
    expect(misconName('zz:1', 'x')).toBe(UNKNOWN_MISTAKE);
  });
});

describe('Hebrew numbers', () => {
  it('every form', () => {
    expect([1, 2, 3, 11].map(he.days)).toEqual(['יום אחד', 'יומיים', '3 ימים', '11 ימים']);
    expect([1, 2, 5].map(he.minutes)).toEqual(['דקה אחת', 'שתי דקות', '5 דקות']);
    expect([1, 2, 7].map(he.stairs)).toEqual(['מדרגה אחת', 'שתי מדרגות', '7 מדרגות']);
    expect([1, 2, 4].map(he.mistakes)).toEqual(['טעות אחת', 'שתי טעויות', '4 טעויות']);
    expect([0, 1, 2, 5].map(he.practiceWeek)).toEqual(['השבוע עוד לא היה תרגול', 'יום תרגול אחד השבוע', 'יומיים של תרגול השבוע', '5 ימי תרגול השבוע']);
  });

  it('withPrefix: a maqaf before a digit, straight onto a Hebrew word', () => {
    expect(withPrefix('ב', '3 מדרגות')).toBe('ב־3 מדרגות');
    expect(withPrefix('ב', 'שתי מדרגות')).toBe('בשתי מדרגות');
    expect(withPrefix('מ', he.minutes(12))).toBe('מ־12 דקות');
    expect(withPrefix('ל', he.days(1))).toBe('ליום אחד');
  });
});
