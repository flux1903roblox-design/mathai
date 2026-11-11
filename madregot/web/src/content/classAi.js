// The teacher's words for student AI by the Ministry of Education's rules (TRUST-11), copied word for word from trust
// Appendix E §E.8, and the one pure function that picks them for a class's policy (the dashboard's aiPolicy:
// { students, canTurnOn, reason, teacherAi, setting, consentAt, fromGrade, rulesUrl, consentFormUrl, consentPdfUrl }).
// ClassAICard and LicenceCard render what it returns; classAi.test.js holds it to §E.8.

/** The question when a class is opened, and its two answers (the private one needs the attestation). */
export const SETTING_Q = 'איפה הכיתה הזו לומדת?';
export const SETTINGS = {
  school: { title: 'בבית ספר', sub: 'העוזר החכם לתלמידים פועל לפי ההנחיות של משרד החינוך' },
  private: { title: 'בשיעורים פרטיים, חוג או תגבור', sub: 'ההורים מחליטים על העוזר החכם' },
};
export const ATTEST = 'הקבוצה הזו לא פועלת במסגרת בית ספר.';

export const AI_CARD_TITLE = 'העוזר החכם לתלמידים';
export const AI_COPY = {
  off: 'כבוי',
  on: 'פתוח',
  notInCatalogue: 'לפי ההנחיות של משרד החינוך (ינואר 2026), תלמידים משתמשים בבית הספר רק בכלי בינה מלאכותית שאושרו בקטלוג החינוכי. מדרגות עוד לא בקטלוג, ולכן העוזר החכם כבוי לתלמידים בכיתה הזו. התרגול, ההסברים של מדי ולוח המורה פתוחים כרגיל.',
  prep: 'אתם יכולים להשתמש בעוזר החכם להכנת חומרים. לפי ההנחיות, לא מציגים אותו לתלמידים בכיתה ולא כותבים בו שמות או ציונים.',
  rulesLink: 'ההנחיות של משרד החינוך',
  grade: (n) => `העוזר החכם מאושר בקטלוג החל מכיתה ${n}. בכיתה הזו הוא כבוי לתלמידים.`,
  consentSchool: 'כדי להפעיל את העוזר החכם לתלמידים צריך אישור הורים לשימוש בכלי בינה מלאכותית, בטופס של משרד החינוך.',
  consentPortal: 'טופס אישור ההורים באתר ההורים',
  consentPdf: 'טופס להדפסה',
  consentSchoolBox: 'קיבלנו אישור הורים מכל התלמידים שישתמשו בעוזר. לתלמיד בלי אישור נכבה את העוזר ברשימת התלמידים.',
  consentPrivate: 'לפני שמפעילים, ודאו שההורים יודעים שהילדים ישתמשו בעוזר AI ומסכימים.',
  consentPrivateBox: 'ההורים של התלמידים בקבוצה יודעים ומסכימים.',
  save: 'שמירה',
  switch: 'העוזר החכם לתלמידים',
  turnedOn: 'העוזר החכם פתוח לתלמידים בכיתה.',
  turnedOff: 'העוזר החכם כבוי לתלמידים בכיתה.',
  consentAt: (date) => `אישור הורים נרשם ב־${date}.`,
  studentOff: 'כיבוי העוזר לתלמיד הזה',
  studentOn: 'הפעלת העוזר לתלמיד הזה',
  badge: 'העוזר כבוי',
  licenceTitle: 'רישיון כיתה',
  licenceBeforeApproval: 'העוזר החכם לתלמידים בבתי ספר יופעל אחרי שמדרגות תאושר בקטלוג החינוכי של משרד החינוך. אפשר כבר עכשיו לבקש הצעת מחיר, ונעדכן כשהאישור יגיע.',
  quote: 'הצעת מחיר לבית הספר',
};

const GRADE = { 7: 'ז׳', 8: 'ח׳', 9: 'ט׳' };
/** The grade the catalogue approval starts at, as a Hebrew class letter (ח׳), or the number when it has none. */
export const gradeLetter = (n) => GRADE[Number(n)] || String(n ?? '');

/** A school class whose students may not have the AI yet (not in the catalogue, or below the approved grade). */
export const beforeApproval = (policy) => !!policy && policy.setting !== 'private' && ['not_in_catalogue', 'grade'].includes(policy.reason);

/** The per-student switch and the "העוזר כבוי" badge matter only when the class's students can have the AI. */
export const perStudentAi = (policy) => !!policy && ['ok', 'teacher_off'].includes(policy.reason);

/**
 * What the card shows for a policy:
 *   { on, status, text: [paragraphs], rules: bool (the Ministry's link), consent: null | { links: bool, box }, toggle: bool }
 * Unknown or missing: off, the Ministry's link only (fail closed, as the server does).
 */
export function classAiView(policy) {
  const p = policy || {};
  const on = p.students === 'on';
  const view = { on, status: on ? AI_COPY.on : AI_COPY.off, text: [], rules: true, consent: null, toggle: false };
  const school = p.setting !== 'private';
  if (p.reason === 'not_in_catalogue') view.text = [AI_COPY.notInCatalogue, AI_COPY.prep];
  else if (p.reason === 'grade') view.text = [AI_COPY.grade(gradeLetter(p.fromGrade)), AI_COPY.prep];
  else if (p.reason === 'consent_needed') {
    view.text = [school ? AI_COPY.consentSchool : AI_COPY.consentPrivate];
    view.consent = { links: school, box: school ? AI_COPY.consentSchoolBox : AI_COPY.consentPrivateBox };
  } else if (p.reason === 'teacher_off' || p.reason === 'ok') view.toggle = !!p.canTurnOn;
  return view;
}
