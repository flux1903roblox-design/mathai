// The pilot kit (spec TEACHER-10 §1): five Hebrew Markdown documents, the source of truth for the repo
// (madregot/docs/schools/README.md indexes them) and for the app (/teacher/guide). Their {{KEY}} placeholders are
// filled by lib/schoolDocs.js. The parent letter's short version for WhatsApp sits next to it as plain text.
import teacherGuide from './teacher-guide.md?raw';
import parentLetter from './parent-letter.md?raw';
import parentLetterShort from './parent-letter-short.txt?raw';
import principalApproval from './principal-approval.md?raw';
import pilotPlan from './pilot-plan.md?raw';
import productSheet from './product-sheet.md?raw';

/** In the order the list shows them: id (the address /teacher/guide/<id>), title, one line on what it is for, text. */
export const SCHOOL_DOCS = Object.freeze([
  { id: 'teacher-guide', title: 'מדריך למורה', line: 'פותחים כיתה, מצרפים תלמידים ומשתמשים בלוח. רבע שעה קריאה.', text: teacherGuide },
  { id: 'parent-letter', title: 'מכתב להורים ואישור השתתפות', line: 'עם הפרטים של הכיתה, ואישור לגזור ולהחזיר למורה.', text: parentLetter, short: parentLetterShort },
  { id: 'principal-approval', title: 'אישור מנהל/ת לשימוש בכלי דיגיטלי', line: 'הבדיקה וההחלטה של המנהל או המנהלת, לפי מכתב משרד החינוך.', text: principalApproval },
  { id: 'pilot-plan', title: 'תוכנית פיילוט לשבועיים', line: 'יום אחר יום: מה עושים, מה מודדים ומתי ממשיכים.', text: pilotPlan },
  { id: 'product-sheet', title: 'מדרגות בכיתה: דף מידע', line: 'עמוד אחד להנהלה ולעמיתים.', text: productSheet },
]);

export const schoolDoc = (id) => SCHOOL_DOCS.find((d) => d.id === id) || null;
