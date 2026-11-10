// Where the progress lives, in one sentence (DURABLE-3): each case that is true at this build, and its exact words.
// A family device has no server copy yet, so it hears the solo sentence; nothing here says "מוצפן".
import { describe, it, expect } from 'vitest';
import { whereSavedText, WHERE_SAVED } from './copy.js';

const solo = { profile: { role: 'student', name: 'נועה', grade: '7' } };
const cls = { profile: { role: 'student', name: 'נועה', grade: '7', classCode: 'K7Q2MD', className: 'ז׳3', token: 'stu_1', studentId: 's1' } };
const family = { ...solo, ai: { familyDevice: { token: 'f'.repeat(64), label: 'הטאבלט' } } };
// a class code saved without a sign-in (the student has to join again): nothing is sent until they do
const notSignedIn = { profile: { ...cls.profile, token: null } };

describe('whereSavedText', () => {
  it('no server: kept on this device, and a backup file now and then', () => {
    expect(whereSavedText(solo, { server: false })).toBe('ההתקדמות נשמרת במכשיר הזה. כדאי לשמור קובץ גיבוי מדי פעם.');
    // with no server nothing is sent, also for a class student
    expect(whereSavedText(cls, { server: false })).toBe(WHERE_SAVED.noServer);
  });
  it('solo with a server: only on this device', () => {
    expect(whereSavedText(solo, { server: true })).toBe('ההתקדמות נשמרת רק במכשיר הזה.');
    expect(whereSavedText(notSignedIn, { server: true })).toBe(WHERE_SAVED.solo);
    expect(whereSavedText(null, { server: true })).toBe(WHERE_SAVED.solo);
  });
  it('a family device: the solo sentence until its progress has a server copy', () => {
    expect(whereSavedText(family, { server: true })).toBe(WHERE_SAVED.solo);
  });
  it('a class student: the answers go to the teacher too (the trust lane\'s sentence under the numbers)', () => {
    expect(whereSavedText(cls, { server: true, about: 'numbers' })).toBe('המספרים האלה מחושבים במכשיר הזה. אתם בכיתה, ולכן כל תשובה בתרגול נשלחת גם ללוח של המורה.');
    expect(whereSavedText(cls, { server: true })).toBe('ההתקדמות נשמרת במכשיר הזה. אתם בכיתה, ולכן כל תשובה בתרגול נשלחת גם ללוח של המורה.');
  });
  it('no sentence promises encryption, and no sentence says the numbers are sent nowhere', () => {
    for (const s of Object.values(WHERE_SAVED)) {
      expect(s).not.toContain('מוצפן');
      expect(s).not.toContain('לשום מקום');
    }
  });
});
