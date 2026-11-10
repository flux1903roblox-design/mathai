// The teacher's words for student AI (TRUST-11) are trust Appendix E §E.8's, word for word, and the card picks the
// right ones for every answer of the rule (shared/schoolRules.js), failing closed when the policy is missing.
import { describe, it, expect } from 'vitest';
import { classAiPolicy } from '../../../shared/schoolRules.js';
import { AI_COPY, SETTING_Q, SETTINGS, ATTEST, classAiView, beforeApproval, perStudentAi, gradeLetter } from './classAi.js';

const env = (approval = 'none', approvedFromGrade = 7) => ({ approval, approvedFromGrade });
const cls = (over = {}) => ({ setting: 'school', grade: '7', studentAi: 'off', consentAt: null, ...over });
const view = (c, e) => { const p = classAiPolicy(c, e); return { p, v: classAiView({ ...p, setting: c.setting, consentAt: c.consentAt, fromGrade: e.approvedFromGrade }) }; };

describe('§E.8, word for word', () => {
  it('the setting question and its answers', () => {
    expect(SETTING_Q).toBe('איפה הכיתה הזו לומדת?');
    expect(SETTINGS.school).toEqual({ title: 'בבית ספר', sub: 'העוזר החכם לתלמידים פועל לפי ההנחיות של משרד החינוך' });
    expect(SETTINGS.private).toEqual({ title: 'בשיעורים פרטיים, חוג או תגבור', sub: 'ההורים מחליטים על העוזר החכם' });
    expect(ATTEST).toBe('הקבוצה הזו לא פועלת במסגרת בית ספר.');
  });
  it('the card, the switch, the student rows and the licence', () => {
    expect(AI_COPY.notInCatalogue).toBe('לפי ההנחיות של משרד החינוך (ינואר 2026), תלמידים משתמשים בבית הספר רק בכלי בינה מלאכותית שאושרו בקטלוג החינוכי. מדרגות עוד לא בקטלוג, ולכן העוזר החכם כבוי לתלמידים בכיתה הזו. התרגול, ההסברים של מדי ולוח המורה פתוחים כרגיל.');
    expect(AI_COPY.prep).toBe('אתם יכולים להשתמש בעוזר החכם להכנת חומרים. לפי ההנחיות, לא מציגים אותו לתלמידים בכיתה ולא כותבים בו שמות או ציונים.');
    expect(AI_COPY.grade('ח׳')).toBe('העוזר החכם מאושר בקטלוג החל מכיתה ח׳. בכיתה הזו הוא כבוי לתלמידים.');
    expect(AI_COPY.consentSchool).toBe('כדי להפעיל את העוזר החכם לתלמידים צריך אישור הורים לשימוש בכלי בינה מלאכותית, בטופס של משרד החינוך.');
    expect(AI_COPY.consentSchoolBox).toBe('קיבלנו אישור הורים מכל התלמידים שישתמשו בעוזר. לתלמיד בלי אישור נכבה את העוזר ברשימת התלמידים.');
    expect(AI_COPY.consentPrivate).toBe('לפני שמפעילים, ודאו שההורים יודעים שהילדים ישתמשו בעוזר AI ומסכימים.');
    expect(AI_COPY.consentPrivateBox).toBe('ההורים של התלמידים בקבוצה יודעים ומסכימים.');
    expect([AI_COPY.consentPortal, AI_COPY.consentPdf, AI_COPY.save, AI_COPY.switch]).toEqual(['טופס אישור ההורים באתר ההורים', 'טופס להדפסה', 'שמירה', 'העוזר החכם לתלמידים']);
    expect([AI_COPY.turnedOn, AI_COPY.turnedOff, AI_COPY.consentAt('05.11.2026')]).toEqual(['העוזר החכם פתוח לתלמידים בכיתה.', 'העוזר החכם כבוי לתלמידים בכיתה.', 'אישור הורים נרשם ב־05.11.2026.']);
    expect([AI_COPY.studentOff, AI_COPY.studentOn, AI_COPY.badge]).toEqual(['כיבוי העוזר לתלמיד הזה', 'הפעלת העוזר לתלמיד הזה', 'העוזר כבוי']);
    expect(AI_COPY.licenceTitle).toBe('רישיון כיתה');
    expect(AI_COPY.licenceBeforeApproval).toBe('העוזר החכם לתלמידים בבתי ספר יופעל אחרי שמדרגות תאושר בקטלוג החינוכי של משרד החינוך. אפשר כבר עכשיו לבקש הצעת מחיר, ונעדכן כשהאישור יגיע.');
    expect(AI_COPY.quote).toBe('הצעת מחיר לבית הספר');
  });
  it('no price, no countdown, no pressure words in any of it', () => {
    const all = JSON.stringify({ AI_COPY: Object.values(AI_COPY).map((v) => (typeof v === 'function' ? v('X') : v)), SETTINGS, SETTING_Q, ATTEST });
    expect(all).not.toMatch(/₪|מהר|נשארו|רק עוד|אחרון/);
  });
});

describe('the card for each answer of the rule', () => {
  it('a school class while not in the catalogue: off, the reason and the teacher\'s own use, no consent, no switch', () => {
    for (const c of [cls(), cls({ consentAt: '2026-11-01T10:00:00Z', studentAi: 'on' })]) {
      const { p, v } = view(c, env());
      expect(p.reason).toBe('not_in_catalogue');
      expect(v).toEqual({ on: false, status: 'כבוי', text: [AI_COPY.notInCatalogue, AI_COPY.prep], rules: true, consent: null, toggle: false });
      expect(beforeApproval({ ...p, setting: 'school' })).toBe(true);
      expect(perStudentAi(p)).toBe(false);
    }
  });
  it('approved from grade 8: a grade 7 school class is off, and names ח׳', () => {
    const { p, v } = view(cls(), env('approved', 8));
    expect(p.reason).toBe('grade');
    expect(v.text).toEqual([AI_COPY.grade('ח׳'), AI_COPY.prep]);
    expect([v.toggle, v.consent, beforeApproval({ ...p, setting: 'school' })]).toEqual([false, null, true]);
  });
  it('consent needed: the Ministry\'s form in a school class, the parents\' agreement in a private group', () => {
    const school = view(cls(), env('approved')).v;
    expect(school.text).toEqual([AI_COPY.consentSchool]);
    expect(school.consent).toEqual({ links: true, box: AI_COPY.consentSchoolBox });
    const priv = view(cls({ setting: 'private' }), env()).v;
    expect(priv.text).toEqual([AI_COPY.consentPrivate]);
    expect(priv.consent).toEqual({ links: false, box: AI_COPY.consentPrivateBox });
    expect([school.toggle, priv.toggle]).toEqual([false, false]);
  });
  it('after consent: the switch, off or on; the per-student switch shows; the licence is not held back', () => {
    const off = view(cls({ setting: 'private', consentAt: '2026-11-01T10:00:00Z' }), env());
    expect(off.v).toMatchObject({ on: false, status: 'כבוי', text: [], toggle: true, consent: null });
    const on = view(cls({ consentAt: '2026-11-01T10:00:00Z', studentAi: 'on' }), env('approved'));
    expect(on.v).toMatchObject({ on: true, status: 'פתוח', toggle: true });
    expect([perStudentAi(off.p), perStudentAi(on.p)]).toEqual([true, true]);
    expect(beforeApproval({ ...on.p, setting: 'school' })).toBe(false);
    expect(beforeApproval({ ...off.p, setting: 'private' })).toBe(false);
  });
  it('a missing or unknown policy fails closed: off, the Ministry\'s link only', () => {
    expect(classAiView(null)).toEqual({ on: false, status: 'כבוי', text: [], rules: true, consent: null, toggle: false });
    expect(classAiView({ reason: 'whatever', students: 'on' }).toggle).toBe(false);
    expect([beforeApproval(null), perStudentAi(undefined)]).toEqual([false, false]);
  });
  it('grade letters', () => {
    expect([gradeLetter(7), gradeLetter('8'), gradeLetter(9), gradeLetter(10)]).toEqual(['ז׳', 'ח׳', 'ט׳', '10']);
  });
});
