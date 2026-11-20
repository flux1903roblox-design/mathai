// What the family plan gives the parent (PRODUCT2-30, PRODUCT2-33), in one place: the parents' page (Parents.jsx About),
// the card of a copy with no server (ParentsFrame.jsx NoServerNote) and the public pages' claims (content/claims.js,
// whose checks read the code behind each line) all say these words. In the order a parent gets them: the report that
// comes by itself on each day the child practises, while the child's sharing is on (the child can stop it: Parents.jsx
// CHECKOUT_REPORT), the Sunday email, the exam ahead, and the helper last. No alerts are promised: nothing in the app
// sends one. No price here: prices are the server's (lib/price.js), and this text also shows where no price may.

/** The heading of the plan's card on /parents. */
export const PLAN_TITLE = 'המנוי המשפחתי: מה מקבלים ההורים';

/** The plan's lines; each `id` is a claim of content/claims.js, and its `text` is that claim's words. */
export const PLAN_INCLUDES = Object.freeze([
  { id: 'synced-report', text: 'סיכום התרגול מגיע לבד מהמכשיר של הילד בכל יום שבו מתרגלים, כל עוד השיתוף פועל אצל הילד. אפשר לראות את 8 השבועות האחרונים.' },
  { id: 'sunday-email', text: 'סיכום שבועי במייל בכל יום ראשון, אם תבחרו.' },
  { id: 'exam-ready', text: 'לפני מבחן: כמה מהמדרגות של המבחן כבר בשליטה, בעמוד ההורים ובמייל של יום ראשון.' },
  { id: 'ai-helper', text: 'עוזר שמסביר לילד את הטעות בתרגיל שעל המסך ובודק דף פתרון מצולם.' },
]);
export const PLAN_TEXT = Object.freeze(Object.fromEntries(PLAN_INCLUDES.map((x) => [x.id, x.text])));

/** The free summary, said for what it is: the current week only, sent by the child when they choose. */
export const FREE_REPORT = 'בלי מנוי: הילד יכול לשלוח לכם מהאפליקציה סיכום של השבוע הנוכחי בלבד, בוואטסאפ, כשהילד בוחר. במנוי הסיכום מגיע לבד בכל יום שבו מתרגלים, עם השבועות שעברו.';

/** The card of a copy of the app with no server (the public site): what the plan holds, and that nothing is sold here. */
export const NO_SERVER = Object.freeze({
  title: 'מה כולל המנוי המשפחתי',
  body: 'בגרסה הזו אין שרת, ולכן אי אפשר לקנות כאן מנוי. כל השיעורים והתרגול חינם, ועובדים כרגיל.',
});
