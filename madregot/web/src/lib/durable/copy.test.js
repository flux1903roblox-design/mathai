// Where the progress lives, in one sentence (DURABLE-3): each case that is true at this build, and its exact words.
// A family device hears the family sentence once the family keeps its code (DURABLE-6), and the solo one before; only
// the backup code's own copy is "מוצפן", never one the class or the family keeps.
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
  it('the backup code on: an encrypted copy only the code opens (alone, or after the class sentence)', () => {
    const code = { on: true, code: 'ABCDEFGHJKMNPQRS', escrow: null };
    expect(whereSavedText({ ...solo, backup: code }, { server: true })).toBe('ההתקדמות נשמרת במכשיר, ועותק מוצפן שרק הקוד שלכם פותח נשמר בגיבוי.');
    expect(whereSavedText({ ...family, backup: code }, { server: true })).toBe(WHERE_SAVED.backup);
    expect(whereSavedText({ ...cls, backup: code }, { server: true })).toBe('ההתקדמות נשמרת במכשיר הזה. אתם בכיתה, ולכן כל תשובה בתרגול נשלחת גם ללוח של המורה. עותק מוצפן שרק הקוד שלכם פותח נשמר גם בגיבוי.');
    expect(whereSavedText({ ...cls, backup: code }, { server: true, about: 'numbers' })).toBe(`${WHERE_SAVED.classNumbers} ${WHERE_SAVED.backupClause}`);
    // off, without a code, a copy the server could open (escrow, DURABLE-6), or no server: never "מוצפן"
    expect(whereSavedText({ ...solo, backup: { ...code, on: false } }, { server: true })).toBe(WHERE_SAVED.solo);
    expect(whereSavedText({ ...solo, backup: { ...code, code: null } }, { server: true })).toBe(WHERE_SAVED.solo);
    expect(whereSavedText({ ...solo, backup: code }, { server: false })).toBe(WHERE_SAVED.noServer);
  });

  it('the class keeps the code (DURABLE-6): the trust lane\'s sentence, then the class copy clause, never "מוצפן"', () => {
    const kept = { on: true, code: 'ABCDEFGHJKMNPQRS', escrow: 'class' };
    expect(whereSavedText({ ...cls, backup: kept }, { server: true })).toBe('ההתקדמות נשמרת במכשיר הזה. אתם בכיתה, ולכן כל תשובה בתרגול נשלחת גם ללוח של המורה. עותק של ההתקדמות נשמר גם בשרת, כדי שתוכלו להמשיך מכל מכשיר עם הקוד האישי.');
    expect(whereSavedText({ ...cls, backup: kept }, { server: true, about: 'numbers' })).toBe(`${WHERE_SAVED.classNumbers} ${WHERE_SAVED.classCopyClause}`);
    // a class student whose family keeps the code too, or only the family: the class sentence and its copy clause
    expect(whereSavedText({ ...cls, backup: { ...kept, escrow: 'both' } }, { server: true })).toBe(`${WHERE_SAVED.classProgress} ${WHERE_SAVED.classCopyClause}`);
    // the backup off: nothing is kept, so the clause goes
    expect(whereSavedText({ ...cls, backup: { ...kept, on: false } }, { server: true })).toBe(WHERE_SAVED.classProgress);
    // a student who left the class: a copy the server could open is still kept, said plainly
    expect(whereSavedText({ ...solo, backup: kept }, { server: true })).toBe('ההתקדמות נשמרת במכשיר, ועותק שלה נשמר בשרת.');
  });

  it('the family keeps the code (DURABLE-6): the family sentence, never "מוצפן"', () => {
    const kept = { on: true, code: 'ABCDEFGHJKMNPQRS', escrow: 'family' };
    expect(whereSavedText({ ...family, backup: kept }, { server: true })).toBe('ההתקדמות נשמרת במכשיר, ועותק שלה נשמר בשרת דרך המנוי המשפחתי, כדי שאפשר יהיה להעביר אותה למכשיר חדש.');
    expect(whereSavedText({ ...solo, backup: kept }, { server: true })).toBe(WHERE_SAVED.family);
    expect(whereSavedText({ ...family, backup: kept }, { server: false })).toBe(WHERE_SAVED.noServer);
  });

  it('a linked device whose parents\' summary is on: the summary clause follows every sentence, and "רק" goes (PARENTS-4)', () => {
    const clause = 'סיכום קצר של התרגול נשלח להורים. בהגדרות אפשר לראות מה בדיוק.';
    expect(whereSavedText(family, { server: true, summary: true })).toBe(`ההתקדמות נשמרת במכשיר הזה. ${clause}`);
    expect(whereSavedText(family, { server: true, summary: true, about: 'numbers' })).toBe(`${WHERE_SAVED.device} ${clause}`);
    const kept = { on: true, code: 'ABCDEFGHJKMNPQRS', escrow: 'family' };
    expect(whereSavedText({ ...family, backup: kept }, { server: true, summary: true })).toBe(`${WHERE_SAVED.family} ${clause}`);
    expect(whereSavedText({ ...family, backup: { ...kept, escrow: null } }, { server: true, summary: true })).toBe(`${WHERE_SAVED.backup} ${clause}`);
    expect(whereSavedText({ ...cls, ...family, profile: cls.profile }, { server: true, summary: true, about: 'numbers' })).toBe(`${WHERE_SAVED.classNumbers} ${clause}`);
    // the summary off (or no summary): the sentence as before; no server: nothing is sent at all
    expect(whereSavedText(family, { server: true, summary: false })).toBe(WHERE_SAVED.solo);
    expect(whereSavedText(family, { server: false, summary: true })).toBe(WHERE_SAVED.noServer);
  });

  it('only the backup code\'s sentences promise encryption, and no sentence says the numbers are sent nowhere', () => {
    for (const [k, s] of Object.entries(WHERE_SAVED)) {
      if (k === 'backup' || k === 'backupClause') expect(s).toContain('עותק מוצפן שרק הקוד שלכם פותח');
      else expect(s).not.toContain('מוצפן');
      expect(s).not.toContain('לשום מקום');
    }
  });
});
