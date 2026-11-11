// Words that tell the truth (PARENTS-9): the privacy notice and the parents' page say what the parents' report keeps,
// where, for how long and how to stop it, in the same words as the code. The notice (privacy.md, the trust lane's
// Appendix A text) names the family exception in the progress paragraph ("מה נשמר בשרת שלנו"), the WhatsApp summary in
// "מה נשמר במכשיר עצמו", the family device's subsection with every field the child is told about, Resend and the Sunday
// email, the 90 days, and the rights; the page's About paragraph is one merged text that no longer says "only your
// email" and says the summary goes after 90 days. worker/test/notice.test.js pins the 90 to the Worker's
// REPORT_KEEP_DAYS. (The family lane named this file Legal.test.js; on the main branch the trust lane's legal.test.js
// sits beside it, a name that differs only in case, so it is reportCopy.test.js here.)
import { describe, it, expect } from 'vitest';
import privacy from '@/content/legal/privacy.md?raw';
import parentsSource from './Parents.jsx?raw';
import { NOTICE } from '@/components/learn/SharingNotice.jsx';

const section = (title) => privacy.split(/^## /m).find((p) => p.startsWith(title)) || '';
const sub = (title) => (privacy.split(/^### /m).find((p) => p.startsWith(title)) || '').split(/^## /m)[0];
/** The fields a day's summary holds, in the words the child's notice uses (SharingNotice.test.jsx pins the notice). */
const FIELD_WORDS = ['דקות', 'שאלות', 'מדרגות', 'בדיקת שליטה', 'טעויות', 'רצף', 'מבחן'];
const NEVER_WORDS = ['התשובות עצמן', 'שיחות עם העוזר החכם', 'תמונות'];

describe('privacy.md: the parents\' report', () => {
  it('has the family device\'s subsection, the 90 days and the Sunday email for those who asked', () => {
    expect(privacy).toContain('מכשיר של ילד שמחובר למנוי המשפחתי');
    expect(privacy).toContain('90 יום');
    expect(privacy).toContain('הסיכום השבועי למי שביקש אותו');
  });

  it('no longer says the progress is kept on the device only', () => {
    expect(privacy).not.toContain('ההתקדמות בתרגול נשמרת במכשיר עצמו.');
  });

  it('the progress paragraph names the family exception, and the WhatsApp summary is made on the device and kept nowhere', () => {
    const progress = section('מה נשמר בשרת שלנו').split('\n').find((l) => l.includes('**ההתקדמות בתרגול**')) || '';
    expect(progress).toContain('(חוץ מהסיכום הקצר, כשהמכשיר מחובר למנוי המשפחתי)');
    expect(section('מה נשמר במכשיר עצמו')).toContain('הסיכום השבועי שאפשר לשלוח להורים בוואטסאפ או בקישור נוצר במכשיר ונשלח ממנו. הוא לא עובר דרכנו ולא נשמר אצלנו.');
  });

  it('every field the child\'s notice names is in the server\'s subsection, and so is what is never sent', () => {
    const server = sub('מכשיר של ילד שמחובר למנוי המשפחתי');
    expect(server).toBeTruthy();
    const told = `${NOTICE.what} ${NOTICE.never}`;
    for (const w of FIELD_WORDS) {
      expect(told, `the notice names ${w}`).toContain(w);
      expect(server, `the notice names ${w}, so the privacy text does too`).toContain(w);
    }
    for (const w of NEVER_WORDS) expect(server).toContain(w);
    expect(server).toContain('ושם הילד');
    expect(server).toContain('רק ההורה שחיבר את המכשיר רואה את הסיכום');
    expect(server).toContain('ובכל רגע הוא יכול לראות מה נשלח ולהפסיק');
  });

  it('Resend sends the Sunday email, with stair names and counts only; the summaries are kept 90 days and go earlier on request', () => {
    const resend = section('למי המידע עובר').split('\n').find((l) => l.startsWith('- Resend')) || '';
    expect(resend).toContain('Resend: שולחת את המיילים (קוד כניסה, אישורים, קבלות, הודעות על המנוי, והסיכום השבועי למי שביקש אותו). בארה״ב.');
    expect(resend).toContain('בלי פרטי הטעויות שחוזרות');
    const days = section('כמה זמן שומרים').split('\n').find((l) => l.includes('**סיכומי ההתקדמות מהמכשיר של הילד:**')) || '';
    expect(days).toContain('90 יום');
    for (const when of ['כשמנתקים את המכשיר', 'כשמוחקים את החשבון', 'כשההורה מוחק את ההיסטוריה בעמוד ההורים', 'כשהילד מבקש במכשיר למחוק את מה שנשלח']) expect(days).toContain(when);
  });

  it('the rights: the export holds the summaries, and the Sunday email stops from its link or the mail program\'s button', () => {
    const rights = section('הזכויות שלכם');
    expect(rights).toContain('הורדת הנתונים בעמוד ההורים כוללת גם את סיכומי ההתקדמות.');
    // the link opens a page with one button (report.js unsubscribeGet), so the notice never promises one click
    expect(rights).toContain('את הסיכום השבועי במייל אפשר להפסיק מהקישור שבתחתית כל מייל, או מכפתור הביטול של תוכנת המייל.');
    expect(rights).not.toContain('בלחיצה אחת');
    expect(rights).toContain('ובמכשיר שמחובר למנוי המשפחתי גם את הסיכומים שנשלחו ממנו להורים.');
  });
});

describe('Parents.jsx: what is kept, in one merged text', () => {
  it('no longer says only the email is kept, and says the summary goes after 90 days', () => {
    expect(parentsSource).not.toContain('שומרים רק את כתובת המייל שלכם');
    expect(parentsSource).toContain('נמחק אחרי 90 יום');
  });

  it('names the progress copy a linked device keeps, and never calls it encrypted', () => {
    expect(parentsSource).toContain('נשמר גם עותק של ההתקדמות בכל מכשיר מחובר, כדי שאפשר יהיה להעביר אותה למכשיר חדש.');
    const data = parentsSource.slice(parentsSource.indexOf('export const ABOUT_DATA'), parentsSource.indexOf('export const ABOUT_DATA_LINK'));
    expect(data).not.toMatch(/מוצפן|הצפנ/);
    expect(data).toContain('מה שהוא כותב לעוזר נשלח ל־Anthropic בארה״ב כדי לקבל תשובה.');
  });
});
