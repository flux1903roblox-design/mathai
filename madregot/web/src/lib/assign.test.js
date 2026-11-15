// Class work on the teacher's side (lib/assign.js, lib/workDates.js) and the error words of api.js: the automatic
// title, each student's state and result (§7), the class message with no names, the Classroom link and the dates.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

function fakeStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k),
    clear: () => m.clear(), key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; },
  };
}
beforeEach(() => { vi.stubGlobal('localStorage', fakeStorage()); vi.stubGlobal('sessionStorage', fakeStorage()); });
afterEach(() => { vi.unstubAllGlobals(); });

const load = async () => {
  vi.resetModules();
  return { ...(await import('./assign.js')), ...(await import('./workDates.js')), api: await import('./api.js') };
};
const loc = (href) => { const u = new URL(href); return { protocol: u.protocol, hostname: u.hostname, origin: u.origin, pathname: u.pathname }; };

describe('the automatic title', () => {
  it('names the topic and the stair, or the check', async () => {
    const { assignTitle, isStair } = await load();
    expect(assignTitle('stair', 'signed:1')).toBe('מספרים מכוונים: חיבור וחיסור');
    expect(assignTitle('check', 'signed:1')).toBe('בדיקת שליטה: חיבור וחיסור');
    expect(assignTitle('stair', 'signed:99')).toBe('');
    expect(isStair('signed:1')).toBe(true);
    expect(isStair('signed:null')).toBe(false);
    expect(isStair('nope:1')).toBe(false);
  });
});

describe("a student's state and result (§7)", () => {
  it('a stair: done with or without mastery, on the way with its stage, not started', async () => {
    const { workStatus } = await load();
    expect(workStatus('stair', { state: 'done', passed: true })).toEqual({ state: 'הושלם', result: 'שולט/ת' });
    expect(workStatus('stair', { state: 'done', passed: false })).toEqual({ state: 'הושלם', result: 'עוד לא שולט/ת' });
    expect(workStatus('stair', { state: 'started', stage: 2 })).toEqual({ state: 'בדרך', result: 'שלב 2 מתוך 5' });
    expect(workStatus('stair', { state: 'none' })).toEqual({ state: 'עוד לא התחיל/ה', result: '–' });
  });
  it('a stair passed before it was given and not done again since (SK-BUYERS-1): the teacher sees "עבר/ה בעבר", not "הושלם"', async () => {
    const { workStatus } = await load();
    expect(workStatus('stair', { state: 'started', stage: 5, passed: true })).toEqual({ state: 'עוד לא חזר/ה', result: 'עבר/ה בעבר' });
    expect(workStatus('stair', { state: 'started', stage: 3, passed: false })).toEqual({ state: 'בדרך', result: 'שלב 3 מתוך 5' });
  });
  it('a check: the first finished try, marked when there were more', async () => {
    const { workStatus } = await load();
    expect(workStatus('check', { state: 'done', right: 4, asked: 5, passed: true, tries: 1 })).toEqual({ state: 'הושלם', result: '4/5 · עבר/ה' });
    expect(workStatus('check', { state: 'done', right: 2, asked: 5, passed: false, tries: 3 })).toEqual({ state: 'הושלם', result: '2/5 · עוד לא (ניסיון ראשון)' });
    expect(workStatus('check', { state: 'started' })).toEqual({ state: 'התחיל/ה', result: '–' });
    expect(workStatus('check', null)).toEqual({ state: 'עוד לא התחיל/ה', result: '–' });
  });
});

describe('telling the class', () => {
  it("the app's address, but none on a development copy", async () => {
    const { publicUrl } = await load();
    expect(publicUrl(loc('https://madregot.example.test/'), false)).toBe('https://madregot.example.test/');
    expect(publicUrl(loc('http://localhost:5173/'), false)).toBe('');
    expect(publicUrl(loc('https://madregot.example.test/'), true)).toBe('');
  });
  it("the Classroom link is Google's documented share address, for the student's missions", async () => {
    const { classroomLink } = await load();
    expect(classroomLink('https://madregot.example.test/')).toBe(`https://classroom.google.com/share?url=${encodeURIComponent('https://madregot.example.test/#/quests')}`);
    expect(classroomLink('')).toBe('');
  });
  it('the message says the title and the day, and no student name', async () => {
    const { classMessage } = await load();
    const msg = classMessage({ title: 'מספרים מכוונים: חיבור וחיסור', dueOn: '2026-11-12' }, 'https://madregot.example.test/');
    expect(msg).toBe('משימה חדשה במדרגות: מספרים מכוונים: חיבור וחיסור, עד יום חמישי 12.11. פותחים את האפליקציה, והמשימה מחכה בראש "המשימה שלי להיום". https://madregot.example.test/');
    expect(classMessage({ title: 'x', dueOn: '2026-11-12' }, '')).not.toMatch(/https?:/);
  });
  it('work given to a group (SK-BUYERS-4): the message is for the students who got it, never "the class has new work"', async () => {
    const { classMessage, classroomLink, shareFor } = await load();
    const group = { title: 'מספרים מכוונים: חיבור וחיסור', dueOn: '2026-11-12', forAll: false, targets: ['a1', 'b2'] };
    const msg = classMessage(group, 'https://madregot.example.test/');
    expect(msg).toBe('יש לכם משימה חדשה במדרגות: מספרים מכוונים: חיבור וחיסור, עד יום חמישי 12.11. פותחים את האפליקציה, והמשימה מחכה בראש "המשימה שלי להיום". https://madregot.example.test/');
    expect(msg).not.toMatch(/^משימה חדשה במדרגות|לכל הכיתה|לכיתה/);
    // the step for a group: tell those students, with their names for the teacher only, and no Classroom post (it goes to the whole class)
    const names = { a1: 'דנה', b2: 'יואב', c3: 'נועה' };
    expect(shareFor(group, names, 'https://madregot.example.test/')).toEqual({
      title: 'לספר לתלמידים?', group: true, names: ['דנה', 'יואב'],
      lead: 'המשימה נשלחה רק לדנה וליואב. הודעה בערוץ של כל הכיתה תגיע גם למי שלא קיבל אותה, ולכן כדאי לשלוח אותה ישירות למי שקיבל את המשימה. אין בה שמות.',
      classroom: '',
    });
    const one = shareFor({ ...group, targets: ['c3'] }, names, 'https://madregot.example.test/');
    expect(one.lead).toBe('המשימה נשלחה רק לנועה. הודעה בערוץ של כל הכיתה תגיע גם למי שלא קיבל אותה, ולכן כדאי לשלוח אותה ישירות למי שקיבל את המשימה. אין בה שמות.');
    // more than three: the number in the line, the names in the list under it
    const many = shareFor({ ...group, targets: ['a1', 'b2', 'c3', 'd4'] }, { ...names, d4: 'Lior' }, '');
    expect(many.lead.startsWith('המשימה נשלחה רק ל־4 תלמידים.')).toBe(true);
    expect(many.names).toEqual(['דנה', 'יואב', 'נועה', 'Lior']);
    // for the whole class: as before, with the Classroom link
    const all = shareFor({ title: 'x', dueOn: '2026-11-12', forAll: true, targets: [] }, names, 'https://madregot.example.test/');
    expect(all).toMatchObject({ title: 'לספר לכיתה?', group: false, names: [], classroom: classroomLink('https://madregot.example.test/') });
    expect(all.lead).toBe('אפשר לשלוח לתלמידים הודעה בערוץ של הכיתה. אין בה שמות של תלמידים.');
  });
});

describe('due dates', () => {
  it('a Saturday moves to Sunday; other days stay', async () => {
    const { schoolDay, dueShort, dayLong, plusDays, daysFrom } = await load();
    expect(schoolDay('2026-11-14')).toEqual({ day: '2026-11-15', moved: true });
    expect(schoolDay('2026-11-12')).toEqual({ day: '2026-11-12', moved: false });
    expect(dueShort('2026-11-12')).toBe('עד יום ה׳, 12.11');
    expect(dayLong('2026-11-15')).toBe('יום ראשון, 15.11');
    expect(plusDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(daysFrom('2026-11-05', '2026-11-12')).toBe(7);
  });
});

describe('error words', () => {
  it('too_many_open is the help limit at 429 and the open-assignments cap at 409', async () => {
    const { api } = await load();
    expect(api.errorText('too_many_open', 429)).toBe('יש כבר הרבה בקשות פתוחות למורה. חכו שהמורה יענה.');
    expect(api.errorText('too_many_open', 409)).toBe('יש כבר 20 משימות פתוחות בכיתה. אפשר למחוק משימות ישנות ולנסות שוב.');
    expect(new api.ApiError('too_many_open', 409).message).toMatch(/20 משימות פתוחות/);
    expect(api.errorText('bad_assignment')).toBe('משהו בפרטי המשימה לא תקין. בדקו את התאריך ואת המדרגה.');
    expect(api.errorText('too_many_assignments')).toBe('נוצרו היום הרבה משימות בכיתה הזו. אפשר להמשיך מחר.');
  });
});
