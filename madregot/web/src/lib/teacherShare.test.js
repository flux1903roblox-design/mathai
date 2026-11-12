// The teacher's privacy-safe shares (COUNCIL2-35, COUNCIL2-36): the assignment's own link, its message, Classroom's
// share address and the Moodle activity, the colleague's demo link, and the class-goal card. The texts carry no name.
import { describe, it, expect } from 'vitest';
import { workLink, isWorkId, classroomLink, classMessage, moodleActivity } from './assign.js';
import { demoLink, colleagueText, goalShare } from './teacherShare.js';

const URL0 = 'https://madregot.example.test/';
const ID = '0123456789abcdef';
// every name the app could know: students, a teacher, a class (synthetic)
const NAMES = ['דנה', 'יואב', 'רונית', 'ז׳3'];
const noNames = (text) => { for (const n of NAMES) expect(text).not.toContain(n); };

describe('an assignment\'s own link (COUNCIL2-35)', () => {
  it('is the app\'s address and #/a/<id>, and nothing else', () => {
    expect(workLink(ID, URL0)).toBe(`${URL0}#/a/${ID}`);
    expect(workLink(ID, '')).toBe('');
    expect(workLink('../teacher', URL0)).toBe('');
    expect(workLink('0123456789ABCDEF', URL0)).toBe('');
    expect(isWorkId(ID)).toBe(true);
    expect(isWorkId(null)).toBe(false);
  });
  it('Classroom\'s documented share address carries the link and the title, no key and no account', () => {
    const link = workLink(ID, URL0);
    const href = classroomLink(link, 'מספרים מכוונים: חיבור וחיסור');
    const u = new URL(href);
    expect(u.origin + u.pathname).toBe('https://classroom.google.com/share');
    expect(u.searchParams.get('url')).toBe(link);
    expect(u.searchParams.get('title')).toBe('מספרים מכוונים: חיבור וחיסור');
    expect([...u.searchParams.keys()]).toEqual(['url', 'title']);
    expect(classroomLink('')).toBe('');
  });
  it('the class message and the Moodle activity: the title, the day and the link, with no student\'s name', () => {
    const a = { title: 'מספרים מכוונים: חיבור וחיסור', dueOn: '2026-11-12' };
    const link = workLink(ID, URL0);
    const msg = classMessage(a, link);
    expect(msg).toBe(`משימה חדשה במדרגות: מספרים מכוונים: חיבור וחיסור, עד יום חמישי 12.11. פותחים את הקישור, והמשימה נפתחת. ${link}`);
    expect(classMessage(a, '')).toBe('משימה חדשה במדרגות: מספרים מכוונים: חיבור וחיסור, עד יום חמישי 12.11. פותחים את האפליקציה, והמשימה מחכה בראש "המשימה שלי להיום".');
    const m = moodleActivity(a, link);
    expect(m.name).toBe('מספרים מכוונים: חיבור וחיסור · מדרגות');
    expect(m.url).toBe(link);
    expect(m.description).toContain('עד יום חמישי 12.11');
    expect(m.text.split('\n')).toEqual([`שם: ${m.name}`, `כתובת: ${link}`, `תיאור: ${m.description}`]);
    for (const t of [msg, m.text]) noNames(t);
  });
});

describe('to a colleague and the class goal (COUNCIL2-36)', () => {
  it('the colleague gets the demo class, never this class', () => {
    expect(demoLink(URL0)).toBe(`${URL0}#/?start=demo`);
    expect(demoLink('')).toBe('');
    const text = colleagueText(demoLink(URL0));
    expect(text).toContain(`${URL0}#/?start=demo`);
    expect(text).toContain('בלי הרשמה ובלי פרטים של תלמידים');
    noNames(text);
    expect(text).not.toMatch(/K7Q2MD|DEMO01/);
    expect(colleagueText('')).not.toMatch(/https?:/);
  });
  it('the goal card: the class total against its own target, no names and no one student\'s share', () => {
    const g = goalShare({ on: true, week: '2026-11-08', target: 100, have: 74, reached: false, custom: null }, URL0);
    expect(g).toMatchObject({ have: 74, target: 100, reached: false, pct: 74 });
    expect(g.text).toBe(`השבוע הכיתה שלנו במדרגות: 74 צעדים מתוך 100, במטרה שהציבה לעצמה. כל שיעור, שלב לימוד או בדיקה שמסיימים הם צעד של הכיתה כולה. ${URL0}`);
    noNames(g.text);
    const done = goalShare({ on: true, target: 60, have: 75, reached: true }, '');
    expect(done).toMatchObject({ reached: true, pct: 100 });
    expect(done.text).toBe('השבוע הכיתה שלנו הגיעה במדרגות למטרה שהציבה לעצמה: 75 צעדים מתוך 60. כל שיעור, שלב לימוד או בדיקה שמסיימים הם צעד של הכיתה כולה.');
    expect(goalShare({ on: false, target: 100, have: 3 })).toBeNull();
    expect(goalShare(null)).toBeNull();
  });
});
