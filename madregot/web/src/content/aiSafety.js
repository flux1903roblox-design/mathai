// The words of two small safety pieces of the tutor (trust spec TRUST-4 §4.5, §4.6, Appendix E.3): the one-time
// introduction before the first AI action on a device, and "report this answer". Calm, short, plural; no pressure.

/** AIIntro: what the tutor is, what happens to what is written, and what not to write. */
export const AI_INTRO = Object.freeze({
  title: 'לפני שמתחילים עם העוזר החכם',
  lines: Object.freeze([
    'העוזר החכם הוא תוכנת בינה מלאכותית (Claude של Anthropic), לא אדם. הוא יכול לטעות, אז שווה לבדוק אותו.',
    'הוא כאן בשביל מתמטיקה. הוא לא פותר במקומכם, אלא עוזר להבין.',
    'מה שכותבים או מצלמים נשלח ל־Anthropic בארה״ב כדי לקבל תשובה. מדרגות לא שומרת את השיחות.',
    'אל תכתבו שם מלא, תעודת זהות, כתובת או טלפון, לא שלכם ולא של אחרים.',
    'אם קורה משהו שמדאיג אתכם, אפשר לכתוב גם על זה, או ללחוץ על ״צריכים לדבר עם מישהו?״.',
  ]),
  ok: 'הבנתי, אפשר להתחיל',
  // the public safety statement (trust spec TRUST-2, Appendix D): closes the introduction and sends nothing
  more: 'עוד על בטיחות ופרטיות',
});

/**
 * The Ministry's rule for what goes into a teacher's AI tool (trust Appendix E §E.8): the note above the teacher's
 * assistant (TeacherAINote.jsx) and the teacher's introduction both say it, in these words.
 */
export const TEACHER_AI_RULE = 'לפי ההנחיות של משרד החינוך: בלי שמות של תלמידים, ציונים או פרטים מזהים.';

/**
 * AIIntro on a teacher's device (FOLLOWUP-1): the same facts for an adult who prepares lessons with it (software that
 * can be wrong, so check before class; where what is written goes), the Ministry's rule with the photo it implies, and
 * nothing written for a child (no "talk to someone", no "it does not solve for you").
 */
export const AI_INTRO_TEACHER = Object.freeze({
  title: 'לפני שמתחילים: העוזר החכם למורים',
  lines: Object.freeze([
    'העוזר החכם הוא תוכנת בינה מלאכותית (Claude של Anthropic), לא אדם. הוא יכול לטעות, אז כדאי לבדוק כל תרגיל והסבר לפני שמביאים אותו לכיתה.',
    AI_INTRO.lines[2],
    `${TEACHER_AI_RULE} גם לא מצלמים דף שכתוב עליו שם.`,
  ]),
  ok: AI_INTRO.ok,
  more: AI_INTRO.more,
});

/** The introduction's words for the device's profile: a teacher's own, else the student's. */
export const introFor = (role) => (role === 'teacher' ? AI_INTRO_TEACHER : AI_INTRO);

/** ReportAnswer: the button under an AI answer, its sheet, and what is said after. */
export const REPORT = Object.freeze({
  button: 'דיווח על התשובה',
  sent: 'דיווחתם על התשובה הזו',
  title: 'מה לא היה בסדר בתשובה?',
  reasons: Object.freeze([
    Object.freeze({ id: 'wrong_math', label: 'יש בה טעות במתמטיקה' }),
    Object.freeze({ id: 'not_nice', label: 'היא לא נעימה' }),
    Object.freeze({ id: 'not_for_kids', label: 'היא לא מתאימה לילדים' }),
    Object.freeze({ id: 'other', label: 'משהו אחר' }),
  ]),
  note: 'נשלחת רק התשובה של העוזר, בלי מה שכתבתם ובלי השם שלכם.',
  send: 'שליחה',
  sending: 'שולחים…',
  thanks: 'תודה. נבדוק את התשובה.',
});
