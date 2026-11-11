// The child is told what the parents see (PARENTS-4): the notice names every field of a day's summary, it never opens
// in a lesson, a teaching stage, a repair or a check, and the sharing sheet's words for each state and for one day.
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { NoticeBody, NOTICE, noticeRoute } from './SharingNotice.jsx';
import { statusLine, stateWord, SHARING } from '../SharingSheet.jsx';
import { DayView } from '../report/ReportView.jsx';
import { SUMMARY_KEYS } from '@/learn/report.ts';

const text = (html) => html.replace(/<[^>]+>/g, ' ');

describe('the notice', () => {
  const html = renderToStaticMarkup(<NoticeBody onOk={() => {}} onSee={() => {}} />);
  it('names every field the summary holds: minutes, questions, stairs, mastery, mistakes, streak, exam', () => {
    for (const word of ['דקות', 'שאלות', 'מדרגות', 'בדיקת שליטה', 'טעויות', 'רצף', 'מבחן']) expect(text(html)).toContain(word);
    // if the summary gains a field, this list and the words above must grow with it (the engine's whitelist, PARENTS-1)
    expect([...SUMMARY_KEYS]).toEqual(['v', 'd', 'm', 'q', 'ls', 'st', 'sk', 'ma', 'rv', 'fx', 'sr', 'ex']);
  });
  it('says what is never sent and where to see it and stop it, with its two buttons', () => {
    expect(text(html)).toContain('לא נשלחים: התשובות עצמן, השיחות עם העוזר החכם, תמונות והשם שלכם.');
    expect(text(html)).toContain('בכל רגע אפשר לראות מה נשלח, ולהפסיק, בהגדרות ← שיתוף עם ההורים.');
    expect(html).toMatch(/<button[^>]*>הבנתי<\/button>/);
    expect(html).toMatch(/<button[^>]*>לראות מה נשלח<\/button>/);
    expect(NOTICE.title).toBe('ההורים יראו סיכום קצר של התרגול');
    expect(html).not.toContain('₪');
  });
  it('opens only on a calm screen of the child\'s own: never in a lesson, a teaching stage, a repair or a check', () => {
    for (const p of ['/', '/me', '/quests', '/topics', '/topic/signed', '/settings', '/report', '/assistant', '/exams', '/plan', '/learn/signed/2', '/rescue']) expect(noticeRoute(p), p).toBe(true);
    for (const p of ['/lesson/signed/1', '/practice/abc', '/placement', '/learn/signed/1/A', '/learn/eq/2/C', '/repair/signed/1/minus-minus', '/exams/check', '/exams/practice/x1', '/rescue/check', '/rescue/exam',
      '/parents', '/parents/info', '/cancel', '/privacy', '/terms', '/restore', '/r/1.abc']) expect(noticeRoute(p), p).toBe(false);
  });
});

describe('the sharing sheet', () => {
  const now = new Date('2026-11-05T15:00:00');
  it('one status line for every state', () => {
    expect(statusLine('on', new Date('2026-11-05T14:05:00').toISOString(), { now })).toBe('פועל. הסיכום התעדכן לאחרונה היום ב־14:05.');
    expect(statusLine('on', new Date('2026-11-04T20:10:00').toISOString(), { now })).toBe('פועל. הסיכום התעדכן לאחרונה אתמול ב־20:10.');
    expect(statusLine('on', new Date('2026-11-01T08:00:00').toISOString(), { now })).toBe('פועל. הסיכום התעדכן לאחרונה 1.11.');
    expect(statusLine('on', null)).toBe('פועל. עוד לא נשלח סיכום.');
    expect(statusLine('child_off')).toBe('כבוי. ההורים רואים שהשיתוף כבוי, בלי סיבה ובלי פרטים.');
    expect(statusLine('parent_off')).toBe('ההורים כיבו את הסיכום מהמכשיר הזה. כרגע לא נשלח כלום.');
    expect(statusLine('both_off')).toBe('כבוי. גם ההורים כיבו את הסיכום, אז לא נשלח כלום.');
    for (const s of ['no_plan', 'off', null]) expect(statusLine(s)).toBe('הסיכום להורים לא פעיל כרגע, אז לא נשלח כלום.');
    expect([stateWord('on'), stateWord('child_off'), stateWord('parent_off'), stateWord('off')]).toEqual(['פועל', 'כבוי', 'כבוי', 'כבוי']);
  });
  it('says nothing about a plan or a price (a child\'s screen)', () => {
    for (const s of [...Object.values(SHARING), ...['on', 'child_off', 'parent_off', 'both_off', 'off'].map((x) => statusLine(x))]) expect(s).not.toMatch(/מנוי|₪/);
  });
});

describe('one day in words (ReportView variant "day")', () => {
  const day = {
    v: 1, d: '2026-11-05', m: 18, q: 22, ls: 2, st: 1, sk: ['signed:2', 'coord:1'], ma: ['signed:1'], rv: 1,
    fx: [['signed:2', 'neg-compare', 'o'], ['signed:1', 'minus-minus', 'd']], sr: 3, ex: { d: '2026-11-12', n: 2, of: 3 },
  };
  it('every field of the row, and nothing else', () => {
    const t = text(renderToStaticMarkup(<DayView day={day} today="2026-11-05" />)).replace(/\s+/g, ' ');
    expect(t).toContain('היום, 5.11');
    for (const s of ['דקות על מסכי הלמידה 18', 'שאלות שנענו 22', 'שיעורים ובדיקות שהסתיימו 2', 'שלבי לימוד שהושלמו 1', 'חזרות קצרות שעברו 1', 'ימים ברצף 3',
      'מדרגות שתורגלו מספרים מכוונים: השוואת מספרים, מערכת צירים: קריאת נקודה', 'עברו בדיקת שליטה מספרים מכוונים: חיבור וחיסור',
      'מבחן קרוב ב־12.11, 2 מתוך 3 המדרגות שלו בשליטה', 'בתיקון', 'תוקנה']) expect(t).toContain(s);
    expect(t).not.toMatch(/%|מנוי|₪/);
  });
  it('an empty day says "אין", and a past day its name', () => {
    const empty = { v: 1, d: '2026-11-02', m: 0, q: 0, ls: 0, st: 0, sk: [], ma: [], rv: 0, fx: [], sr: 0, ex: null };
    const t = text(renderToStaticMarkup(<DayView day={empty} today="2026-11-05" />)).replace(/\s+/g, ' ');
    expect(t).toContain('יום שני 2.11');
    expect(t).toContain('מדרגות שתורגלו אין');
    expect(t).toContain('טעויות שחוזרות אין');
    expect(t).toContain('מבחן קרוב אין');
  });
});
