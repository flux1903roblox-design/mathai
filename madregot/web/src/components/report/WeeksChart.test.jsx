// The parents' report (PARENTS-5, PARENTS-6): the example a parent sees before the first summary says it is one, the
// 8 weeks have a table with the same numbers, and each first-day state has its words.
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ReportView, { EXAMPLE_RIBBON, SOURCE_NOTE } from './ReportView.jsx';
import WeeksChart, { weeksOf, WEEKS } from './WeeksChart.jsx';
import { EXAMPLE_WEEK, EXAMPLE_TODAY, EXAMPLE_ROWS } from './exampleWeek.js';
import { qaFamilySummary } from './qaFamily.js';
import FamilyReport, { REPORT, PARENT_SWITCH, ExamBanner, examSoon, EXAM_SOON_DAYS } from '@/screens/parents/FamilyReport.jsx';
import { weekFrom } from '@/learn/report.ts';
import { today as dayOf } from '@/lib/store.js';

const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&quot;/g, '"').replace(/\s+/g, ' ');
const PLAN = { id: 'qa00000000000001', status: 'active' };

describe('the example week', () => {
  it('is flagged, and the report draws the ribbon on it (and only on it)', () => {
    expect(EXAMPLE_WEEK.example).toBe(true);
    expect(Object.isFrozen(EXAMPLE_WEEK)).toBe(true);
    const html = renderToStaticMarkup(<ReportView week={EXAMPLE_WEEK} audience="parent" source="synced" today={EXAMPLE_TODAY} />);
    expect(html).toContain(`<p class="report-ribbon">${EXAMPLE_RIBBON}</p>`);
    expect(EXAMPLE_RIBBON).toBe('דוגמה. אלה לא נתונים של הילד שלכם.');
    expect(html).toContain('class="report is-example"');
    // an example is not "kept 90 days": the synced note is for real summaries
    expect(html).not.toContain(SOURCE_NOTE.synced);
    const real = renderToStaticMarkup(<ReportView week={weekFrom(EXAMPLE_ROWS, '2026-11-08', EXAMPLE_TODAY)} audience="parent" source="synced" today={EXAMPLE_TODAY} />);
    expect(real).not.toContain(EXAMPLE_RIBBON);
    expect(real).toContain(SOURCE_NOTE.synced);
  });
  it('holds a believable week: practice days, mastery, a repair done and one open, an exam', () => {
    expect(EXAMPLE_WEEK).toMatchObject({ activeDays: 4, minutes: 71, questions: 49, mastered: ['signed:1', 'signed:2'], fixed: [['signed:1', 'minus-minus']], open: [['coord:1', 'swap']] });
    expect(EXAMPLE_WEEK.exam).toEqual({ d: '2026-11-19', n: 2, of: 4 });
  });
});

describe('the worked list', () => {
  it('counts the stairs it does not name in words: "ועוד מדרגה אחת", "ועוד שתי מדרגות", never a bare digit', () => {
    const ids = ['signed:1', 'signed:2', 'signed:3', 'coord:1', 'coord:2', 'eq:1', 'eq:2', 'expr:1'];
    const html = (n) => text(renderToStaticMarkup(<ReportView week={{ ...EXAMPLE_WEEK, example: false, worked: ids.slice(0, n) }} audience="parent" source="synced" today={EXAMPLE_TODAY} />));
    expect(html(7)).toContain('ועוד מדרגה אחת');
    expect(html(8)).toContain('ועוד שתי מדרגות');
    expect(html(8)).not.toMatch(/ועוד \d/);
  });
});

describe('8 weeks', () => {
  const rows = [
    { v: 1, d: '2026-11-04', m: 20, q: 8, ls: 1, st: 0, sk: [], ma: [], rv: 0, fx: [], sr: 1 },
    { v: 1, d: '2026-11-02', m: 15, q: 4, ls: 0, st: 1, sk: [], ma: [], rv: 0, fx: [], sr: 1 },
    { v: 1, d: '2026-10-27', m: 30, q: 0, ls: 0, st: 0, sk: [], ma: [], rv: 0, fx: [], sr: 0 },
    { v: 1, d: '2026-09-01', m: 99, q: 9, ls: 1, st: 0, sk: [], ma: [], rv: 0, fx: [], sr: 1 }, // older than 8 weeks
  ];
  it('newest week first: its minutes and its practice days (time alone is not a practice day)', () => {
    const w = weeksOf(rows, '2026-11-05');
    expect(w).toHaveLength(WEEKS);
    expect(w[0]).toEqual({ start: '2026-11-01', end: '2026-11-07', minutes: 35, days: 2 });
    expect(w[1]).toEqual({ start: '2026-10-25', end: '2026-10-31', minutes: 30, days: 0 });
    expect(w.at(-1).start).toBe('2026-09-13');
    expect(w.slice(2).every((x) => x.minutes === 0)).toBe(true);
  });
  it('a hidden table with the same 8 rows (שבוע · דקות · ימי תרגול); the bars are hidden from a screen reader', () => {
    const html = renderToStaticMarkup(<WeeksChart rows={rows} today="2026-11-05" id="w" />);
    expect(html).toMatch(/<ol class="weeks-bars" aria-hidden="true">/);
    expect(html).toContain('<table class="visually-hidden">');
    expect(html).toContain('<th scope="col">שבוע</th><th scope="col">דקות</th><th scope="col">ימי תרגול</th>');
    expect(html.match(/<tr><th scope="row">/g)).toHaveLength(8);
    expect(html).toContain('<tr><th scope="row">1.11–7.11</th><td>35</td><td>2</td></tr>');
    expect(text(html)).toContain('יומיים'); // the bar's label: practice days, in words
    expect(text(html)).not.toMatch(/%/); // no percentage in what it says (the bar's width is a style)
  });
});

describe('/parents: the first-day states', () => {
  it('linked, nothing sent yet: what will come, what never comes, and the example behind "איך זה ייראה (דוגמה)"', () => {
    const html = renderToStaticMarkup(<FamilyReport plan={PLAN} devices={[{ id: 'qa00000000000002', label: 'הטאבלט' }]} qa="report-empty" />);
    const t = text(html);
    expect(t).toContain('ההתקדמות');
    expect(t).toContain('סיכום יומי מכל מכשיר מחובר.');
    expect(t).toContain('הטאבלט: עוד אין סיכום');
    expect(t).toContain(REPORT.first);
    for (const x of REPORT.willSeeList) expect(t).toContain(x);
    expect(t).toContain('התשובות עצמן, שיחות עם העוזר החכם, תמונות ושם הילד.');
    expect(html).toMatch(/<details class="report-example"><summary>איך זה ייראה \(דוגמה\)<\/summary>/);
    expect(html).toContain(EXAMPLE_RIBBON);
    expect(t).toContain('הסיכום מהמכשיר הזה: פועל');
    expect(t).not.toContain('מחיקת ההיסטוריה של המכשיר'); // nothing to delete yet
  });
  it('sharing paused on the device: said calmly with its date and what the parent can do, never explained; the history stays readable and deletable', () => {
    const today = dayOf();
    const html = renderToStaticMarkup(<FamilyReport plan={PLAN} devices={[{ id: 'qa00000000000002', label: 'הטאבלט' }]} qa="report-off" />);
    const t = text(html);
    expect(t).toContain(REPORT.paused.title);
    expect(t).toMatch(/השיתוף הופסק במכשיר עצמו ב־\d{1,2}\.\d{1,2}, ומאז לא מגיעים ממנו סיכומים חדשים\. זו בחירה של הילד, והיא נשמרת\. לא נשלחת אלינו סיבה\./);
    expect(t).toContain(REPORT.paused.what);
    for (const x of REPORT.paused.steps) expect(t).toContain(x);
    expect(t).toContain(PARENT_SWITCH.child_off.text);
    expect(t).toContain('מחיקת ההיסטוריה של המכשיר');
    expect(qaFamilySummary('report-off', today).devices[0].days.length).toBeGreaterThan(0);
  });
  it('a device whose only summaries are older than the 8 weeks: dated, deletable, never the first-day card', () => {
    const today = dayOf();
    const data = qaFamilySummary('report-old', today);
    const t = text(renderToStaticMarkup(<FamilyReport plan={PLAN} devices={[{ id: 'qa00000000000002', label: 'הטאבלט' }]} qa="report-old" />));
    expect(t).toContain(REPORT.olderOnly(data.devices[0].kept.to));
    expect(t).toContain('מחיקת ההיסטוריה של המכשיר');
    expect(t).not.toContain('עוד אין סיכום');
    expect(t).not.toContain(REPORT.first);
    // the same device after its plan ended: still deletable
    const ended = text(renderToStaticMarkup(<FamilyReport plan={null} devices={[{ id: 'qa00000000000002', label: 'הטאבלט' }]} qa="report-old" />));
    expect(ended).toContain(REPORT.ended);
    expect(ended).toContain('מחיקת ההיסטוריה של המכשיר');
    expect(ended).not.toContain('הסיכום היומי כלול במנוי המשפחתי');
  });
  it('a plan that ended with summaries kept, and a device the plan does not cover', () => {
    const data = qaFamilySummary('report', dayOf());
    expect(data.devices).toHaveLength(2);
    const ended = text(renderToStaticMarkup(<FamilyReport plan={null} devices={[{ id: 'qa00000000000002' }, { id: 'qa00000000000004' }]} qa="report" />));
    expect(ended).toContain(REPORT.ended);
    expect(ended).not.toContain('לכבות'); // no switch without a plan
    const consent = text(renderToStaticMarkup(<FamilyReport plan={null} devices={[{ id: 'qa00000000000002', label: 'הטאבלט' }]} qa="report-empty" />));
    expect(consent).toContain('הטאבלט: הסיכום היומי כלול במנוי המשפחתי.');
    expect(consent).not.toMatch(/₪/);
  });
  it('the parent\'s switch: four states, each with its words and the button it leads to', () => {
    expect(PARENT_SWITCH).toEqual({
      on: { text: 'הסיכום מהמכשיר הזה: פועל', button: 'לכבות', to: false },
      parent_off: { text: 'כיביתם את הסיכום מהמכשיר הזה.', button: 'להפעיל', to: true },
      child_off: { text: 'אצלכם הסיכום מהמכשיר הזה פועל.', button: 'לכבות', to: false },
      both_off: { text: 'כיביתם את הסיכום, והשיתוף כבוי גם במכשיר עצמו.', button: 'להפעיל', to: true, hint: 'הסיכום יחזור רק כשהשיתוף יופעל גם במכשיר.' },
    });
  });
});

// PRODUCT2-30: an exam within a week on a linked device shows above the cards, in the words the report and the Sunday
// email use; an exam further off, or one that has passed, does not.
describe('/parents: the exam ahead', () => {
  const T = '2026-11-12';
  const shift = (n) => new Date(Date.parse(`${T}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
  const dev = (ex, label = 'הטאבלט') => ({ id: 'qa00000000000002', label, days: [{ v: 1, d: T, m: 10, q: 5, ls: 1, st: 0, sk: [], ma: [], rv: 0, fx: [], sr: 1, ex }] });
  it('within 7 days, today and tomorrow named; further off or passed, nothing', () => {
    expect(EXAM_SOON_DAYS).toBe(7);
    expect(examSoon(dev({ d: shift(7), n: 2, of: 4 }), T)).toEqual({ d: shift(7), n: 2, of: 4, days: 7 });
    expect(examSoon(dev({ d: shift(8), n: 2, of: 4 }), T)).toBeNull();
    expect(examSoon(dev({ d: shift(-1), n: 2, of: 4 }), T)).toBeNull();
    expect(examSoon(dev(null), T)).toBeNull();
    expect(REPORT.examWhen('הטאבלט', examSoon(dev({ d: shift(0), n: 0, of: 3 }), T))).toBe('הטאבלט: מבחן היום.');
    expect(REPORT.examWhen('הטאבלט', examSoon(dev({ d: shift(1), n: 0, of: 3 }), T))).toBe('הטאבלט: מבחן מחר, 13.11.');
    expect(REPORT.examWhen('הטאבלט', examSoon(dev({ d: shift(5), n: 0, of: 3 }), T))).toBe('הטאבלט: מבחן ב־17.11.');
  });
  it('the banner says when and how far the exam\'s stairs are, for each device with one', () => {
    const t = text(renderToStaticMarkup(<ExamBanner devices={[dev({ d: shift(5), n: 2, of: 4 }), dev({ d: shift(3), n: 0, of: 3 }, 'הטלפון'), dev(null, 'המחשב')]} today={T} />));
    expect(t).toContain('לקראת המבחן');
    expect(t).toContain('הטאבלט: מבחן ב־17.11. 2 מתוך 4 המדרגות של המבחן כבר בשליטה.');
    expect(t).toContain('הטלפון: מבחן ב־15.11. בתוכנית ההכנה 3 מדרגות, ובדיקות השליטה עליהן עוד לא נעשו.');
    expect(t).not.toContain('המחשב');
    expect(renderToStaticMarkup(<ExamBanner devices={[dev(null)]} today={T} />)).toBe('');
  });
  it('shows on /parents with a plan (the QA report has an exam a week ahead), never without one', () => {
    const devices = [{ id: 'qa00000000000002', label: 'הטאבלט' }];
    expect(text(renderToStaticMarkup(<FamilyReport plan={PLAN} devices={devices} qa="report" />))).toMatch(/לקראת המבחן הטאבלט: מבחן ב־\d{1,2}\.\d{1,2}\. 2 מתוך 4 המדרגות של המבחן כבר בשליטה\./);
    expect(text(renderToStaticMarkup(<FamilyReport plan={null} devices={devices} qa="report" />))).not.toContain('לקראת המבחן');
  });
  it('the example keeps its exam ahead on every weekday (it rode on today\'s row, which a Tuesday or a Saturday does not have)', () => {
    for (let i = 0; i < 7; i++) {
      const day = new Date(Date.UTC(2026, 10, 15 + i)).toISOString().slice(0, 10);
      expect(examSoon(qaFamilySummary('report', day).devices[0], day), day).toMatchObject({ n: 2, of: 4, days: 7 });
    }
  });
});
