// The teacher's words about retention say what the server does (spec TEACHER-9 §1.6, TRUST-7): the copy builder is
// rendered with the numbers the night purge reads, and again with other numbers, so a number written into the words by
// hand (or a screen that skips the builder) is caught. Run by the web unit suite (web/vite.config.js includes it).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { RETENTION } from './retention.js';
import { retentionLines, helpRetentionNote, daysText } from '../web/src/content/retention.js';

describe('the retention words follow shared/retention.js', () => {
  it('with the real numbers: the sentences the teacher reads, word for word', () => {
    expect(retentionLines()).toEqual([
      'דפי מחברת שנשלחו עם בקשת עזרה: חודש אחרי שסוגרים את הבקשה, ולכל היותר חודשיים.',
      'בקשות עזרה והתשובות עליהן: חצי שנה אחרי שסוגרים אותן, ולכל היותר שנה.',
      'תשובות בתרגול, מבחנים ומשימות: 400 יום.',
      'תלמיד שלא נכנס 400 יום נמחק, עם כל המידע שלו. כיתה שאף אחד לא נכנס אליה 400 יום נמחקת.',
      'במכשירים של התלמידים נשמר התרגול שלהם, וכל תלמיד יכול למחוק אותו בעצמו.',
    ]);
    expect(helpRetentionNote()).toBe('דפי מחברת נמחקים חודש אחרי שסוגרים בקשה, ובקשות נמחקות אחרי חצי שנה.');
  });

  it('each number in the words is the constant it names', () => {
    const [pages, help, kept, idle] = retentionLines();
    expect(pages).toContain(`${daysText(RETENTION.helpImageAfterDone)} אחרי שסוגרים`);
    expect(pages).toContain(`ולכל היותר ${daysText(RETENTION.helpImageMax)}.`);
    expect(help).toContain(`${daysText(RETENTION.helpAfterDone)} אחרי שסוגרים`);
    expect(help).toContain(`ולכל היותר ${daysText(RETENTION.helpMax)}.`);
    expect(kept).toContain(daysText(RETENTION.attempts));
    expect(RETENTION.exams).toBe(RETENTION.attempts);
    expect(idle).toContain(`שלא נכנס ${daysText(RETENTION.idleStudent)} נמחק`);
    expect(idle).toContain(`אליה ${daysText(RETENTION.idleClass)} נמחקת`);
    expect(daysText(30)).toBe('חודש'); expect(daysText(60)).toBe('חודשיים'); expect(daysText(180)).toBe('חצי שנה'); expect(daysText(365)).toBe('שנה');
  });

  it('other numbers give other words: nothing is fixed in the copy', () => {
    const R = { helpImageAfterDone: 14, helpImageMax: 45, helpAfterDone: 90, helpMax: 200, attempts: 300, exams: 250, idleStudent: 500, idleClass: 600 };
    const lines = retentionLines(R);
    expect(lines[0]).toBe('דפי מחברת שנשלחו עם בקשת עזרה: 14 יום אחרי שסוגרים את הבקשה, ולכל היותר 45 יום.');
    expect(lines[1]).toBe('בקשות עזרה והתשובות עליהן: 90 יום אחרי שסוגרים אותן, ולכל היותר 200 יום.');
    expect(lines[2]).toBe('תשובות בתרגול: 300 יום. מבחנים ומשימות: 250 יום.');
    expect(lines[3]).toBe('תלמיד שלא נכנס 500 יום נמחק, עם כל המידע שלו. כיתה שאף אחד לא נכנס אליה 600 יום נמחקת.');
    expect(helpRetentionNote(R)).toBe('דפי מחברת נמחקים 14 יום אחרי שסוגרים בקשה, ובקשות נמחקות אחרי 90 יום.');
  });

  it('the screens that show these words take them from the builder, with no number of days of their own', () => {
    for (const file of ['../web/src/screens/teacher/Settings.jsx', '../web/src/screens/teacher/HelpTab.jsx']) {
      const src = readFileSync(new URL(file, import.meta.url), 'utf8');
      expect(src, file).toMatch(/retentionLines\(\)|helpRetentionNote\(\)/);
      expect(src, file).not.toMatch(/\b(30|60|180|365|400)\s*(יום|ימים)|חצי שנה|חודשיים/);
    }
  });
});
