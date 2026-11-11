// The privacy notice says what the durable lane stores (DURABLE-5, 6, 9), in the words the code keeps true: the
// code-only vault (end to end, 400 days, deleted by "delete all" and by stopping the backup), the class and family copy
// of the code (the operator can open the copy while it exists, and when it is deleted), error reports (30 days, no name,
// device id or address), and Cloudflare as processor. The trust lane's Appendix A text (stage 29) holds these blocks
// now: in "מה נשמר בשרת שלנו, ולמה" (its "עותק של ההתקדמות" and "תקלות וספירות" parts), "כמה זמן שומרים" and "למי
// המידע עובר". worker/test/notice.test.js pins the numbers to the Worker's own retention constants.
import { describe, it, expect } from 'vitest';
import privacy from './privacy.md?raw';

const section = (title) => {
  const parts = privacy.split(/^## /m);
  return parts.find((p) => p.startsWith(title)) || '';
};
const SERVER = 'מה נשמר בשרת שלנו';
const bullet = (text, lead) => text.split('\n').find((l) => l.includes(`**${lead}`)) || '';

describe('privacy notice: what the progress copies and the error reports are', () => {
  it('no longer says the progress is kept only on the device', () => {
    expect(privacy).not.toContain('ההתקדמות בתרגול** נשמרת במכשיר עצמו. תלמיד בכיתה שולח את ההתקדמות למורה שלו.');
    expect(section(SERVER)).toContain('נשמרת קודם כול במכשיר עצמו');
  });

  it('the code-only vault: encrypted, only the code opens it, 400 days, deleted by stopping the backup and by "delete all"', () => {
    const vault = bullet(section(SERVER), 'קוד גיבוי.');
    expect(vault).toContain('עותק מוצפן');
    expect(vault).toContain('רק הקוד פותח אותו');
    const keep = bullet(section('כמה זמן שומרים'), 'עותק הגיבוי בשרת');
    expect(keep).toContain('400 יום');
    expect(keep).toContain('להפסיק את הגיבוי');
    expect(keep).toContain('מחיקת כל הנתונים');
  });

  it('the class and family copy of the code: the operator can open the copy while it is kept, never called encrypted', () => {
    const escrow = bullet(section(SERVER), 'תלמיד בכיתה');
    expect(escrow).toContain('כל עוד הקוד הזה שמור אצלנו, אנחנו יכולים לפתוח את העותק');
    expect(escrow).toContain('שמירת עותק בשרת הכיתה');
    expect(escrow).not.toContain('מוצפן');
    const gone = bullet(section('כמה זמן שומרים'), 'קוד הגיבוי שהכיתה');
    for (const when of ['מוציא את התלמיד מהכיתה', 'שמירת עותק בשרת הכיתה', 'בעמוד ההורים', 'מוחקים את החשבון', 'מחיקת כל הנתונים']) expect(gone).toContain(when);
    expect(gone).not.toContain('מוצפן');
  });

  it('error reports: the monitoring lane\'s sentence, 30 days', () => {
    expect(section(SERVER)).toContain('כשמשהו לא עובד באפליקציה, נשלח לשרת דיווח תקלה קצר: איזה מסך, איזו שגיאה ואיזה סוג דפדפן. בלי שם, בלי מזהה מכשיר ובלי כתובת רשת. הדיווחים נשמרים 30 יום.');
    expect(bullet(section('כמה זמן שומרים'), 'דיווחי תקלות')).toContain('30 יום');
  });

  it('Cloudflare keeps the copies and the reports as a processor', () => {
    const cf = section('למי המידע עובר').split('\n').find((l) => l.startsWith('- Cloudflare')) || '';
    expect(cf).toContain('עותקי הגיבוי ודיווחי התקלות');
    expect(cf).toContain('כמעבד מידע');
  });

  it('a deleted backup leaves only a mark with no content, kept 400 days; the family copy goes when the device leaves', () => {
    const vault = bullet(privacy, 'עותק הגיבוי בשרת');
    expect(vault).toContain('נשאר רק סימון שהעותק נמחק, בלי שום תוכן, כדי שמכשיר אחר עם אותו קוד לא ייצור אותו מחדש. הסימון נמחק אחרי 400 יום.');
    const kept = bullet(privacy, 'קוד הגיבוי שהכיתה או המנוי המשפחתי שומרים');
    expect(kept).toContain('כשהמכשיר מתנתק מהמנוי בעצמו');
    expect(kept).toContain('כשההורה מנתק מכשיר שהשיתוף עם ההורים כבוי בו');
  });
});
