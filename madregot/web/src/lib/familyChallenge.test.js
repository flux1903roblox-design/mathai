// The family challenge (PRODUCT2-39): a parent picks a small goal for a week on /parents and sends it as a link; the
// goal rides in the link's # fragment (as the weekly summary's /r link does), the child accepts it on their own device,
// and its progress is counted from the child's own week. Synthetic weeks only.
import { describe, it, expect } from 'vitest';
import {
  GOALS, goalText, isGoal, challengeWeek, goalsFor, encodeChallenge, decodeChallenge, challengeLink, challengeText,
  challengeProgress, keepWeeks, CHALLENGE_PREFIX, PRESSURE,
} from './familyChallenge.js';
import { encodeShare, decodeShare, shareOf, shareText, weekFromShare } from './share.js';
import { weekDays } from '@/learn/report.ts';

const BASE = 'https://madregot.example.test/';
const raw = (o) => CHALLENGE_PREFIX + btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

describe('the goals a parent can pick', () => {
  it('a short list of small weekly goals, in plain Hebrew', () => {
    expect(GOALS.map(goalText)).toEqual(['3 ימי תרגול', '4 ימי תרגול', '5 ימי תרגול', '5 שלבים', '10 שלבים']);
    expect(isGoal('d', 4)).toBe(true);
    expect(isGoal('d', 7)).toBe(false); // not on the list: a link with it does not decode
    expect(isGoal('x', 4)).toBe(false);
  });
  it('Sunday to Wednesday the goal is for this week; from Thursday it is for the next one', () => {
    expect(challengeWeek('2026-11-08')).toBe('2026-11-08'); // Sunday
    expect(challengeWeek('2026-11-11')).toBe('2026-11-08'); // Wednesday
    expect(challengeWeek('2026-11-12')).toBe('2026-11-15'); // Thursday
    expect(challengeWeek('2026-11-14')).toBe('2026-11-15'); // Shabbat
  });
  it('a goal of days is offered only when there are that many school days left in its week (never a goal that cannot be met)', () => {
    const days = (today) => goalsFor(today).filter((g) => g.k === 'd').map((g) => g.n);
    expect(days('2026-11-08')).toEqual([3, 4, 5]); // Sunday: Sunday to Friday, 6 school days
    expect(days('2026-11-10')).toEqual([3, 4]); // Tuesday: Tuesday to Friday, 4
    expect(days('2026-11-11')).toEqual([3]); // Wednesday: 3
    expect(days('2026-11-12')).toEqual([3, 4, 5]); // Thursday: the next week, all of it
    // the stages' goals are always offered
    expect(goalsFor('2026-11-11').filter((g) => g.k === 's').map((g) => g.n)).toEqual([5, 10]);
  });
});

describe('the link: a round trip, and nothing else decodes', () => {
  it('what is encoded decodes to the same goal and week; the link is the app\'s address and #/f/', () => {
    const ch = { w: '2026-11-08', k: 'd', n: 4 };
    const payload = encodeChallenge(ch);
    expect(payload.startsWith('1.')).toBe(true);
    expect(decodeChallenge(payload)).toEqual(ch);
    expect(challengeLink(payload, BASE)).toBe(`${BASE}#/f/${payload}`);
    // ASCII only: no name, no free text, nothing a stranger could write to a child
    expect(atob(payload.slice(2).replace(/-/g, '+').replace(/_/g, '/'))).toMatch(/^[\x20-\x7e]*$/);
    for (const g of GOALS) expect(decodeChallenge(encodeChallenge({ w: '2026-11-15', ...g }))).toEqual({ w: '2026-11-15', ...g });
  });
  it('decodeChallenge returns null on any deviation', () => {
    const good = { v: 1, w: '2026-11-08', k: 'd', n: 4 };
    const bad = {
      'no prefix': encodeChallenge(good).slice(2),
      'another version': raw({ ...good, v: 2 }),
      'not base64': '1.@@@',
      'not JSON': '1.bm90IGpzb24',
      'cut short': encodeChallenge(good).slice(0, 12),
      'an extra key (a message)': raw({ ...good, t: 'hello' }),
      'a missing key': raw({ v: 1, w: '2026-11-08', k: 'd' }),
      'a week that is not a Sunday': raw({ ...good, w: '2026-11-10' }),
      'not a day': raw({ ...good, w: '2026-02-30' }),
      'a goal not on the list': raw({ ...good, n: 7 }),
      'an unknown kind': raw({ ...good, k: 'q' }),
      'a number as text': raw({ ...good, n: '4' }),
    };
    for (const [why, s] of Object.entries(bad)) expect(decodeChallenge(s), why).toBeNull();
    expect(decodeChallenge(undefined)).toBeNull();
    expect(decodeChallenge('1.' + 'A'.repeat(400))).toBeNull();
  });
  it('the message the parent sends: the goal, its week and the link, calm and with no price', () => {
    const ch = { w: '2026-11-08', k: 'd', n: 4 };
    const link = challengeLink(encodeChallenge(ch), BASE);
    expect(challengeText(ch, link).split('\n')).toEqual([
      'אתגר משפחתי במדרגות לשבוע 8.11–14.11: 4 ימי תרגול.',
      'פותחים את הקישור בטלפון שבו מתרגלים, ומקבלים את האתגר:',
      link,
    ]);
    expect(challengeText(ch, link)).not.toMatch(/₪|מנוי|מחיר/);
  });
});

describe('progress, from the child\'s own week', () => {
  it('days count practice days; stages count lessons, checks and teaching stages', () => {
    expect(challengeProgress({ k: 'd', n: 4 }, { days: 3, stages: 9 })).toEqual({ have: 3, n: 4, done: false });
    expect(challengeProgress({ k: 's', n: 5 }, { days: 1, stages: 7 })).toEqual({ have: 7, n: 5, done: true });
  });
  it('the words never press: no countdown, no loss', () => {
    expect(PRESSURE.test('עוד 2 ימים')).toBe(true);
    expect(PRESSURE.test('עד עכשיו: 3 מתוך 4')).toBe(false);
  });
  it('the device keeps the newest 4 weeks of challenges', () => {
    const all = Object.fromEntries(['2026-10-11', '2026-10-18', '2026-10-25', '2026-11-01', '2026-11-08'].map((w) => [w, { k: 'd', n: 3 }]));
    expect(Object.keys(keepWeeks(all)).sort()).toEqual(['2026-10-18', '2026-10-25', '2026-11-01', '2026-11-08']);
  });
});

describe('the weekly summary carries the accepted challenge to the parent (fc in the /r link)', () => {
  const week = (over = {}) => ({
    start: '2026-11-08', end: '2026-11-14', days: weekDays('2026-11-08').map((d, i) => ({ d, on: i < 3, rest: i === 6, future: i > 4, m: 10 })),
    activeDays: 3, minutes: 40, questions: 30, lessons: 4, stages: 2, reviews: 0, worked: ['signed:1'], mastered: [], open: [], openAt: null,
    fixed: [], streak: 3, exam: null, empty: false, ...over,
  });
  it('round trip: the goal goes as [kind, n], and comes back as the week\'s challenge', () => {
    const w = week({ challenge: { k: 'd', n: 4 } });
    const s = decodeShare(encodeShare(w));
    expect(s.fc).toEqual(['d', 4]);
    expect(s).toEqual(shareOf(w));
    expect(weekFromShare(s).challenge).toEqual({ k: 'd', n: 4 });
    // a week with no challenge has no fc, and its report none
    const plain = decodeShare(encodeShare(week()));
    expect(Object.hasOwn(plain, 'fc')).toBe(false);
    expect(weekFromShare(plain).challenge).toBeNull();
  });
  it('a challenge that is not on the list makes the link not decode', () => {
    const s = shareOf(week({ challenge: { k: 'd', n: 4 } }));
    const enc = (o) => '1.' + btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    expect(decodeShare(enc({ ...s, fc: ['d', 7] }))).toBeNull();
    expect(decodeShare(enc({ ...s, fc: ['d'] }))).toBeNull();
    expect(decodeShare(enc({ ...s, fc: 'd4' }))).toBeNull();
  });
  it('the message says how the challenge is going, in one line', () => {
    const text = shareText(week({ challenge: { k: 'd', n: 4 } }), { link: 'L' });
    expect(text.split('\n')).toContain('• האתגר המשפחתי: 3 מתוך 4 ימי תרגול');
    const done = shareText(week({ challenge: { k: 's', n: 5 } }), { link: 'L' });
    expect(done.split('\n')).toContain('• האתגר המשפחתי: 5 מתוך 5 שלבים, הושלם');
  });
});
