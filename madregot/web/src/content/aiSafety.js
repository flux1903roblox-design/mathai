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
});

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
