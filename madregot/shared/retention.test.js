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
    expect(pages).toContain(`${daysText(RETENTION.helpImageAfterDoneDays)} אחרי שסוגרים`);
    expect(pages).toContain(`ולכל היותר ${daysText(RETENTION.helpImageMaxDays)}.`);
    expect(help).toContain(`${daysText(RETENTION.helpAfterDoneDays)} אחרי שסוגרים`);
    expect(help).toContain(`ולכל היותר ${daysText(RETENTION.helpMaxDays)}.`);
    expect(kept).toContain(daysText(RETENTION.attemptsDays));
    expect(RETENTION.examsDays).toBe(RETENTION.attemptsDays);
    expect(RETENTION.assignmentsDays).toBe(RETENTION.attemptsDays);
    expect(idle).toContain(`שלא נכנס ${daysText(RETENTION.studentIdleDays)} נמחק`);
    expect(idle).toContain(`אליה ${daysText(RETENTION.classIdleDays)} נמחקת`);
    expect(daysText(30)).toBe('חודש'); expect(daysText(60)).toBe('חודשיים'); expect(daysText(180)).toBe('חצי שנה'); expect(daysText(365)).toBe('שנה');
  });

  it('other numbers give other words: nothing is fixed in the copy', () => {
    const R = { helpImageAfterDoneDays: 14, helpImageMaxDays: 45, helpAfterDoneDays: 90, helpMaxDays: 200, attemptsDays: 300, examsDays: 250, studentIdleDays: 500, classIdleDays: 600 };
    const lines = retentionLines(R);
    expect(lines[0]).toBe('דפי מחברת שנשלחו עם בקשת עזרה: 14 יום אחרי שסוגרים את הבקשה, ולכל היותר 45 יום.');
    expect(lines[1]).toBe('בקשות עזרה והתשובות עליהן: 90 יום אחרי שסוגרים אותן, ולכל היותר 200 יום.');
    expect(lines[2]).toBe('תשובות בתרגול: 300 יום. מבחנים ומשימות: 250 יום.');
    expect(lines[3]).toBe('תלמיד שלא נכנס 500 יום נמחק, עם כל המידע שלו. כיתה שאף אחד לא נכנס אליה 600 יום נמחקת.');
    expect(helpRetentionNote(R)).toBe('דפי מחברת נמחקים 14 יום אחרי שסוגרים בקשה, ובקשות נמחקות אחרי 90 יום.');
    // assignments kept for their own time get their own sentence; kept as long as practice, they join it
    expect(retentionLines({ ...R, assignmentsDays: 500 })[2]).toBe('תשובות בתרגול: 300 יום. מבחנים: 250 יום. משימות: 500 יום.');
    expect(retentionLines({ ...R, assignmentsDays: 300 })[2]).toBe('תשובות בתרגול ומשימות: 300 יום. מבחנים: 250 יום.');
  });

  it('the screens that show these words take them from the builder, with no number of days of their own', () => {
    for (const file of ['../web/src/screens/teacher/Settings.jsx', '../web/src/screens/teacher/HelpTab.jsx']) {
      const src = readFileSync(new URL(file, import.meta.url), 'utf8');
      expect(src, file).toMatch(/retentionLines\(\)|helpRetentionNote\(\)/);
      expect(src, file).not.toMatch(/\b(30|60|180|365|400)\s*(יום|ימים)|חצי שנה|חודשיים/);
    }
  });
});

// FOLLOWUP-24: the periods the family, durable and student lanes kept beside their routes (errors.js, report.js,
// vault.js, push.js, quality.js, family.js, account.js) now live here, and every purge reads them
// (worker/test/retention.test.js checks each cutoff). The words the parents read about their summaries come from the
// same number.
describe('the periods the other lanes kept on their own', () => {
  it('have their keys here, with the numbers their purges and the privacy notice use', () => {
    expect({
      clientErrorsDays: RETENTION.clientErrorsDays, familyDailyDays: RETENTION.familyDailyDays, vaultIdleDays: RETENTION.vaultIdleDays,
      studentTokenIdleDays: RETENTION.studentTokenIdleDays, pushIdleDays: RETENTION.pushIdleDays, aiQualityDays: RETENTION.aiQualityDays,
      familyDeviceIdleDays: RETENTION.familyDeviceIdleDays, familyLinkDays: RETENTION.familyLinkDays, sessionIdleDays: RETENTION.sessionIdleDays,
    }).toEqual({
      clientErrorsDays: 30, familyDailyDays: 90, vaultIdleDays: 400, studentTokenIdleDays: 400, pushIdleDays: 45, aiQualityDays: 400,
      familyDeviceIdleDays: 365, familyLinkDays: 1, sessionIdleDays: 180,
    });
    for (const [k, v] of Object.entries(RETENTION)) expect(Number.isInteger(v) && v > 0, k).toBe(true);
    expect(Object.isFrozen(RETENTION)).toBe(true);
  });

  it('no Worker module keeps a period of its own any more', () => {
    for (const [file, name] of [['errors.js', 'KEEP_DAYS'], ['report.js', 'REPORT_KEEP_DAYS'], ['vault.js', 'VAULT_KEEP_DAYS'], ['push.js', 'PUSH_KEEP_DAYS'],
      ['quality.js', 'QUALITY_KEEP_DAYS'], ['account.js', 'SESSION_IDLE_DAYS']]) {
      const src = readFileSync(new URL(`../worker/src/${file}`, import.meta.url), 'utf8');
      expect(src, file).not.toMatch(new RegExp(`\\b${name}\\b`));
      expect(src, file).toContain('RETENTION.');
    }
  });

  it("the parents' words about their summaries say familyDailyDays, read from here", async () => {
    const days = `${RETENTION.familyDailyDays} יום`;
    const { SOURCE_NOTE } = await import('../web/src/components/report/ReportView.jsx');
    const { SHARING } = await import('../web/src/components/SharingSheet.jsx');
    const { REPORT } = await import('../web/src/screens/parents/FamilyReport.jsx');
    expect(SOURCE_NOTE.synced).toContain(`ונשמר ${days}.`);
    expect(SHARING.kept).toBe(`הסיכומים נשמרים ${days} ואז נמחקים.`);
    expect(REPORT.ended).toContain(`נשמרים עד ${days} ואז נמחקים.`);
    for (const file of ['../web/src/components/report/ReportView.jsx', '../web/src/components/SharingSheet.jsx', '../web/src/screens/parents/FamilyReport.jsx',
      '../web/src/screens/parents/Parents.jsx']) {
      const src = readFileSync(new URL(file, import.meta.url), 'utf8');
      expect(src, file).toContain('RETENTION.familyDailyDays');
      expect(src, file).not.toMatch(/\b90 יום/);
    }
  });
});
