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
