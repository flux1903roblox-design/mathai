// What a test covers, read from the material the student pastes or types (EXAM-MATERIAL 1a): the teacher's message, the
// list of topics, a line from a summary sheet. On the device, with no server and no AI: a word matcher over the stairs
// of the student's grade (Exam Rescue's rows, content/topics.js rescueTopicsFor, and the bridge unit under them), their
// names, the topics' names, the programme's unit titles and part notes (shared/programme.js), and the words a Hebrew-
// speaking maths teacher uses for them (SYNONYMS). It never decides anything: Rescue shows what it found as ticked
// chips, and the student confirms or edits before the plan is built.
//
// How a word is read: niqqud, geresh and gershayim are dropped, final letters become plain, a doubled ו or י becomes one
// (כתיב מלא and חסר), and a word may carry the prefixes ו, ה, ב, ל, מ, ש, כ (up to three: "ובחזקות"). A key word
// matches a word of the text exactly, with a plural or feminine ending (ים, ות, ה, ת), or, for words of five letters
// or more, with one letter wrong, missing, extra or swapped ("פיטגורס", "משואות"). At each place the longest key wins,
// then the closest. Words after "בלי", "ללא", "חוץ מ", "מלבד", "לא כולל" (up to the end of the clause), and words
// before "לא יהיה", "לא ייכלל" in a clause, are taken out, even when another line names them. What it cannot place is
// returned as the text's own words ("פרק 3", "עמ' 40-62"): a chapter or a page number alone is never guessed.
// This module is on the lazy side of the boot split (only screens/Rescue.jsx imports it; budget.json lazyOnly).
import { PROGRAMME } from '@shared/programme.js';
import { TOPIC, rescueTopicsFor, bridgeTopicsFor, rowStairs } from '@/content/topics.js';

/** The longest text the matcher reads (a long WhatsApp message is about 1,000 characters). */
export const MATERIAL_MAX = 4000;
/** At most this many pieces of text are listed as not recognised. */
export const UNKNOWN_MAX = 6;

const FINALS = { ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ' };
/** A word as the matcher compares it: no niqqud or geresh, plain final letters, one ו or י for a doubled one. */
export function normWord(w) {
  return String(w).toLowerCase()
    .replace(/[֑-ֽֿ-ׇ]/g, '')
    .replace(/[׳״'"`’‘]/g, '')
    .replace(/[ךםןףץ]/g, (c) => FINALS[c])
    .replace(/וו+/g, 'ו').replace(/יי+/g, 'י');
}

const HEB = /[א-ת]/;
// a token: letters (Hebrew with its marks, Latin), digits, and the marks that sit inside a Hebrew word (עמ', סמ"ר)
const TOKEN = /[א-ת֑-ֽֿ-ׇA-Za-z0-9π²√%]+(?:[׳״'"`’‘][א-ת]+)*[׳״'`’‘]?/g;
// what ends a clause: a line, a full stop, a comma, a semicolon, a colon, a bullet
const CLAUSE = /[\n\r.,;:!?•·|()[\]{}]/;

/**
 * The text as tokens: { w (normalised), raw, start, end, clause, line, head } in order. `clause` and `line` count the
 * clause and line breaks before a token; `head` is true when a colon, a dash or an opening bracket follows it on its line
 * ("אחוזים: …", "פונקציה קווית - …"): what comes after it is a list under it.
 */
export function tokenize(text) {
  const s = String(text ?? '');
  const out = [];
  let clause = 0; let line = 0; let last = 0;
  for (const m of s.matchAll(TOKEN)) {
    const between = s.slice(last, m.index);
    // a dot between two digits (12.11, 2.5) is part of a number, not the end of a clause
    const decimal = /^\.$/.test(between) && /\d$/.test(s.slice(0, last)) && /^\d/.test(m[0]);
    if (!decimal) for (const ch of between) if (CLAUSE.test(ch)) clause += 1;
    for (const ch of between) if (ch === '\n') line += 1;
    if (out.length && /^[ \t]*(?::|[-–—](?=\s)|\()/.test(between)) out[out.length - 1].head = true;
    const w = normWord(m[0]);
    if (w) out.push({ w, raw: m[0], start: m.index, end: m.index + m[0].length, clause, line, head: false });
    last = m.index + m[0].length;
  }
  return out;
}

const PREFIX = /^(?:ו?(?:ש|כש|מש)?(?:ה|ב|ל|מ|כ)?)$/;
/**
 * A key word's stem and its forms: a feminine word (ending in ה or ת, or a plural in ות) also as ה, ת and ות; any other
 * word also with ים and ות. So "חזקה" is also "חזקות" but never "חזקים" (strong).
 */
function formsOf(key) {
  // (keys are normalised: a final ם is a plain מ)
  const fem = (stem) => [`${stem}ה`, `${stem}ת`, `${stem}ות`];
  if (key.length >= 5 && key.endsWith('ות')) return fem(key.slice(0, -2));
  if (key.length >= 5 && key.endsWith('ימ')) { const stem = key.slice(0, -2); return [stem, `${stem}ימ`]; }
  if (key.length >= 4 && (key.endsWith('ה') || key.endsWith('ת'))) return fem(key.slice(0, -1));
  return [`${key}ימ`, `${key}ות`];
}
/**
 * Damerau–Levenshtein distance of at most one: one letter changed, missing, extra, or two swapped, never at the end of
 * the word (a last letter is an ending: "רביעי" is Wednesday, not "רביעים").
 */
function nearby(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
  if (i === a.length && i === b.length) return true;
  if (i >= Math.min(a.length, b.length) - 1) return false;
  const ra = a.slice(i); const rb = b.slice(i);
  return ra.slice(1) === rb.slice(1) // one changed
    || ra.slice(1) === rb || ra === rb.slice(1) // one missing or extra
    || (ra.length > 1 && ra[0] === rb[1] && ra[1] === rb[0] && ra.slice(2) === rb.slice(2)); // two swapped
}
/**
 * How well a key word fits a text word: 3 the same (after a prefix), 2 in another form of the word (formsOf), 1 with one
 * letter wrong (words of five letters or more), 0 not at all.
 */
export function wordFit(key, word) {
  if (!key || !word) return 0;
  let best = 0;
  const heb = HEB.test(key);
  for (let p = 0; p <= 3 && p < word.length; p += 1) {
    const pre = word.slice(0, p); const rest = word.slice(p);
    if (p && (!heb || !PREFIX.test(pre) || !HEB.test(rest[0] || '') || rest.length < 2)) continue;
    if (rest === key) return 3;
    if (best < 2 && heb && key.length >= 3 && formsOf(key).includes(rest)) best = 2;
    if (best < 1 && heb && key.length >= 5 && rest.length >= 5 && nearby(key, rest)) best = 1;
  }
  return best;
}

// ---------------------------------------------------------------- the words for each stair
const r = (topic, from, to) => Array.from({ length: to - from + 1 }, (_, i) => `${topic}:${from + i}`);
/**
 * The words a teacher uses, each with its stairs: a list, or { 7: [...], 8: [...] } where the grades differ. Several
 * spellings of one phrase are separated by "|". `[]` is a neutral phrase: recognised, and it adds nothing ("מד זווית"
 * is something to bring, not the angles unit; an equation's own numbers are not a topic).
 */
export const SYNONYMS = [
  // directed numbers
  ['מספרים מכוונים|המספרים המכוונים|מכוונים|מספרים שליליים|שליליים|המספרים השליליים|מספרים חיוביים ושליליים', r('signed', 1, 6)],
  ['חיבור|חיסור|חיבור וחיסור|חיבור וחיסור מספרים מכוונים|חיבור וחיסור של מספרים מכוונים|חיבור מספרים מכוונים|חיסור מספרים מכוונים|חיסור מספרים שליליים|חיבור וחיסור מכוונים', ['signed:1']],
  ['ערך מוחלט|השוואת מספרים|השוואת מספרים מכוונים|ציר המספרים|ישר המספרים|מספרים נגדיים', ['signed:2']],
  ['כפל|חילוק|כפל וחילוק|כפל וחילוק מספרים מכוונים|כפל וחילוק של מספרים מכוונים|כפל מספרים מכוונים|חילוק מספרים מכוונים|כללי הסימנים|חוקי הסימנים', ['signed:3']],
  ['סדר פעולות|סדר פעולות חשבון|סדר הפעולות', ['signed:4']],
  ['סוגריים|סוגריים בתוך סוגריים', ['signed:5']],
  ['שברים מכוונים|עשרוניים מכוונים|שברים ועשרוניים מכוונים|שברים שליליים|שברים עשרוניים מכוונים', ['signed:6']],
  ['חזקות|חזקה|חזקות של מספרים מכוונים|חזקות של מספרים שליליים|חזקות עם בסיס שלילי|חזקות עם מעריך טבעי|מעריך', ['signed:7']],
  ['שורשים|שורש|שורש ריבועי|ריבועים ושורשים|העלאה בריבוע|ריבוע של מספר', ['pyth:1']],
  // the coordinate plane
  ['מערכת צירים|מערכת הצירים|מערכות צירים|צירים|נקודות במערכת צירים|שיעורי נקודה|שיעורים', r('coord', 1, 5)],
  ['קריאת נקודה|קריאת נקודות', ['coord:1']],
  ['רביע|רביעים|ארבעת הרביעים', ['coord:2']],
  ['אורך קטע|אורך של קטע', ['coord:3']],
  ['קודקוד חסר', ['coord:5']],
  // angles
  ['זוויות|זווית', r('angles', 1, 7)],
  ['זוויות צמודות|צמודות|זווית צמודה', ['angles:1']],
  ['זוויות קודקודיות|קודקודיות|קדקודיות|זוויות קדקודיות', ['angles:2']],
  ['סכום זוויות במשולש|זוויות במשולש|סכום הזוויות במשולש', ['angles:3']],
  ['ישרים מקבילים|זוויות בין מקבילים|זוויות בין ישרים מקבילים|מקבילים|זוויות מתאימות|זוויות מתחלפות|מתאימות ומתחלפות|זוויות חד צדדיות', ['angles:4']],
  ['זווית חיצונית|זוויות חיצוניות', ['angles:5']],
  ['שווה שוקיים|משולש שווה שוקיים|שוות שוקיים|משולשים שווי שוקיים|שווי שוקיים', { 7: ['angles:5'], 8: ['angles:5', 'sim:1'] }],
  ['חוצה זווית|חוצי זוויות|חוצה הזווית', ['angles:6']],
  ['סכום זוויות במרובע|זוויות במרובע|זוויות במרובעים', ['angles:7']],
  ['משולשים|משולש', ['angles:3', 'angles:5', 'area:2', 'congr:5'], 'obj'],
  ['מרובעים|מרובע', ['angles:7'], 'obj'],
  ['מדידת זוויות|מדידה של זוויות|מד זווית|מד זוויות|מחוגה|סרגל|מחשבון|דף נוסחאות|זוויות משלימות', []],
  // transformations
  ['טרנספורמציות|טרנספורמציה|טרנספורמציות במישור', r('transf', 1, 4)],
  ['הזזה|הזזות|הזזה במערכת צירים', ['transf:1']],
  ['שיקוף|שיקופים|שיקוף בציר|שיקוף במערכת צירים|שיקוף בצירים', ['transf:2']],
  ['סיבוב|סיבובים|סיבוב במערכת צירים', ['transf:3']],
  ['ריצוף|צורות חופפות', ['transf:4']],
  ['חפיפה|חופפים', { 7: ['transf:4'], 8: ['congr:1', 'congr:2', 'congr:3'] }],
  // expressions
  ['ביטויים אלגבריים|ביטויים|ביטוי אלגברי|משתנים וביטויים', r('expr', 1, 5)],
  ['הצבה|הצבה בביטוי|הצבת מספרים', ['expr:1']],
  ['כתיבת ביטוי|כתיבת ביטויים|לכתוב ביטוי|בניית ביטוי', ['expr:2']],
  ['כינוס איברים|כינוס איברים דומים|כינוס|איברים דומים', ['expr:3']],
  ['חוק הפילוג|פילוג|פתיחת סוגריים|הפילוג', ['expr:4']],
  ['פישוט ביטויים|פישוט|פישוט ביטוי', ['expr:5']],
  // areas and perimeters
  ['שטחים|שטח|חישוב שטחים', { 7: r('area', 1, 4), 8: ['circle:2'] }],
  ['שטחים והיקפים', { 7: r('area', 1, 5), 8: [] }],
  ['היקפים|היקף|חישוב היקפים', { 7: ['area:1', 'area:5'], 8: ['circle:1'] }],
  ['שטח מלבן|היקף ושטח של מלבן|שטח של מלבן|היקף מלבן', ['area:1']],
  ['מלבן|מלבנים|ריבוע|ריבועים', ['area:1'], 'obj'],
  ['שטח מלבן במערכת צירים|שטח במערכת צירים', ['coord:4']],
  ['שטח משולש|שטח של משולש|שטחי משולשים', ['area:2']],
  ['צורות מורכבות|שטח צורה מורכבת', ['area:3']],
  ['שטח מקבילית|שטח טרפז|שטח של מקבילית|שטח של טרפז', ['area:4']],
  ['מקבילית|מקביליות|טרפז|טרפזים', ['area:4'], 'obj'],
  // solids
  ['תיבה|תיבות|קובייה|קוביות', ['solid:1', 'solid:2'], 'obj'],
  ['גופים|גופים במרחב', r('solid', 1, 4)],
  ['מנסרה|מנסרות|מנסרה משולשת|מנסרות משולשות', ['solid:3', 'solid:4'], 'obj'],
  ['משולשת|משולשות', []],
  ['פריסה|פריסות|שטח פנים|שטחי פנים', { 7: ['solid:1', 'solid:3'], 8: ['circle:3'] }],
  ['נפח|נפחים', ['solid:2', 'solid:4', 'circle:3', 'circle:4']],
  ['נפח תיבה|נפח של תיבה|נפח קובייה', ['solid:2']],
  ['נפח מנסרה|נפח של מנסרה|נפח של מנסרה משולשת|נפח מנסרה משולשת', ['solid:4']],
  // data
  ['נתונים|איסוף נתונים|ייצוג נתונים|קריאת נתונים|שכיחות|שכיחויות|טבלת שכיחויות|טבלת שכיחות', ['data:1', 'data:2']],
  ['דיאגרמה|דיאגרמות|דיאגרמת עמודות|גרף עמודות|דיאגרמת מקלות|פיקטוגרמה', ['data:1']],
  ['שכיחות יחסית|שכיחויות יחסיות', ['data:2']],
  ['דיאגרמת עוגה|דיאגרמת עיגול|עוגה', ['data:3']],
  ['הסתברות|הסתברויות|סיכוי', ['data:4', 'prob:1', 'prob:2', 'prob:3']],
  ['מאורע משלים|מאורעות משלימים', ['prob:2']],
  ['ניסוי בשני שלבים|ניסוי דו שלבי|ניסוי דו־שלבי|טבלת זוגות', ['prob:3']],
  // equations
  ['משוואות|משוואה|פתרון משוואות|משוואות ופתרונן|פתרון משוואה', r('eq', 1, 4)],
  ['משוואה בשני צעדים|משוואות בשני צעדים|שני צעדים', ['eq:2']],
  ['נעלם בשני האגפים|נעלמים בשני האגפים|x בשני האגפים|בשני האגפים|איקס בשני האגפים', ['eq:3']],
  ['משוואות עם סוגריים|משוואה עם סוגריים', ['eq:4']],
  ['בעיות מילוליות|שאלות מילוליות|בעיות מילוליות במשוואות|שאלות בהקשרים|בעיות בהקשרים|בעיות קנייה|שאלות קנייה', { 7: ['eq:5'], 8: ['eq:5', 'sys:4'] }],
  ['משוואות עם x בשני האגפים|משוואות עם נעלם בשני האגפים|משוואה עם x בשני האגפים', ['eq:3']],
  ['ממעלה ראשונה|ממעלה שנייה|ממעלה אחת', []],
  ['שאלות תנועה|בעיות תנועה|תנועה|דרך מהירות זמן|מהירות', ['eq:6']],
  ['משוואות עם מכנים|מכנים|משתנה במכנה|נעלם במכנה|משוואות עם שברים', ['eq:7']],
  // fractions and decimals (the bridge unit)
  ['שברים|שבר|שברים פשוטים|שברים עשרוניים|עשרוניים|מספרים עשרוניים|שברים ועשרוניים', r('frac', 1, 4)],
  ['שברים שווים|צמצום שברים|הרחבת שברים|צמצום והרחבה', ['frac:1']],
  ['השוואת שברים|השוואת שברים ועשרוניים', ['frac:2']],
  ['חיבור שברים|חיסור שברים|חיבור וחיסור שברים|מכנה משותף', ['frac:3']],
  ['כפל שברים|חילוק שברים|כפל וחילוק שברים', ['frac:4']],
  // ratio and scale
  ['יחס|יחסים', ['ratio:1', 'ratio:2']],
  ['חלוקה ביחס|חלוקה לפי יחס', ['ratio:2']],
  ['פרופורציה|פרופורציות|פרופורציה ישרה', ['ratio:3']],
  ['קנה מידה|קנה המידה|מפה|מפות', ['ratio:4']],
  // percent
  ['אחוזים|אחוז|חישוב אחוזים', r('pct', 1, 5)],
  ['אחוז מכמות|אחוז ממספר', ['pct:2']],
  ['איזה אחוז', ['pct:3']],
  ['מציאת השלם|מציאת הכמות השלמה', ['pct:4']],
  ['הנחה|הנחות|התייקרות|התייקרויות|הוזלה|הוזלות|הגדלה והקטנה באחוזים|הגדלה באחוזים|הקטנה באחוזים|שינוי באחוזים|עליית מחיר|ירידת מחיר', ['pct:5']],
  ['משוואות עם אחוזים|משוואה עם אחוזים', ['sys:1']],
  // functions
  ['פונקציה|פונקציות|מבוא לפונקציות|מושג הפונקציה', r('func', 1, 4)],
  ['קריאת גרף של מצב|גרפים של מצב|גרף המתאר מצב', ['func:1']],
  ['קצב שינוי אחיד ולא אחיד|אחיד ולא אחיד|קצב אחיד ולא אחיד', ['func:4']],
  ['גרף|גרפים|קריאת גרף|קריאת גרפים|גרף של מצב|גרף שמתאר מצב', ['func:1']],
  ['ייצוגים|ייצוגי פונקציה|ייצוגים של פונקציה|טבלה גרף וביטוי', ['func:2']],
  ['עלייה וירידה|עלייה ירידה|תחומי עלייה|תחומי עלייה וירידה|עולה ויורדת|עלייה ירידה וקבוע', ['func:3']],
  ['קצב|קצב שינוי|קצב שינוי אחיד|קצב אחיד', ['func:4']],
  ['פונקציה קווית|פונקציות קוויות|פונקציה ליניארית|פונקציה לינארית|פונקציות ליניאריות|קו ישר|גרף של ישר|גרפים לינאריים|גרפים ליניאריים|פונקציה קוית', r('line', 1, 8)],
  ['טבלת ערכים', ['line:1']],
  ['שיפוע|שיפועים|שיפוע של ישר', ['line:3', 'line:4']],
  ['משוואת ישר|משוואת הישר|משוואה של ישר', ['line:5']],
  ['נקודת חיתוך|נקודות חיתוך|חיתוך עם הצירים|נקודות החיתוך עם הצירים|נקודות חיתוך עם הצירים|נקודת חיתוך עם הצירים|חיתוך עם ציר|נקודות חיתוך עם צירים', ['line:6']],
  ['משולש עם הצירים', ['line:7']],
  ['נקודת מפגש|נקודת מפגש של ישרים|נקודת מפגש של שני ישרים|נקודת המפגש של שני הישרים|חיתוך של שני ישרים|נקודת חיתוך של שני ישרים|חיתוך ישרים', ['line:8']],
  // Pythagoras
  ['פיתגורס|משפט פיתגורס|משפט פיתגורס ושימושיו', r('pyth', 1, 5)],
  ['מציאת היתר|חישוב היתר|אורך היתר', ['pyth:1']],
  ['ניצב|מציאת ניצב|ניצבים', ['pyth:2']],
  ['משולש ישר זווית|האם המשולש ישר זווית|ישר זווית', ['pyth:3']],
  ['מרחק בין נקודות|מרחק בין שתי נקודות|מרחק בין נקודות במערכת צירים', ['pyth:5']],
  ['פיתגורס במרחב|פיתגורס בגופים', ['space:1', 'space:2']],
  ['אלכסון|אלכסון בתיבה|אלכסון בקובייה|אלכסון של תיבה', ['space:1']],
  // circle, cylinder, cone
  ['מעגל|מעגלים|עיגול|עיגולים', ['circle:1', 'circle:2'], 'obj'],
  ['פאי|π', ['circle:1', 'circle:2']],
  ['היקף מעגל|היקף המעגל', ['circle:1']],
  ['שטח עיגול|שטח העיגול', ['circle:2']],
  ['גליל|גלילים', ['circle:3'], 'obj'],
  ['חרוט|חרוטים', ['circle:4'], 'obj'],
  // statistics
  ['סטטיסטיקה', r('stats', 1, 8)],
  ['מדדי מרכז|מדד מרכזי|מדדים מרכזיים', ['stats:1', 'stats:2', 'stats:3']],
  ['שכיח|השכיח', ['stats:1']],
  ['חציון|החציון', ['stats:2']],
  ['ממוצע|ממוצעים|הממוצע|ממוצא', ['stats:3']],
  ['ממוצע מטבלה|ממוצע משוקלל|ממוצע מטבלת שכיחויות', ['stats:4']],
  ['נתון חסר|ערך חסר', ['stats:5']],
  ['טווח|טווח נתונים|טווח הנתונים|שינוי של כל הנתונים|הוספה לכל הנתונים|שינוי בכל הנתונים', ['stats:6']],
  ['שני מקורות מידע|שני מקורות', ['stats:7']],
  ['אינטרפולציה|אקסטרפולציה|אינטרפולציה ואקסטרפולציה', ['stats:8']],
  // congruence, isosceles triangles and similarity
  ['חפיפת משולשים|משפטי חפיפה|משפטי החפיפה|משולשים חופפים', r('congr', 1, 5)],
  ['הוכחה|הוכחות|הוכחה בחפיפה', ['congr:3']],
  ['תיכונים|תיכון במשולש|תיכון לצלע', ['congr:4']],
  ['צלעות במשולש|אי שוויון המשולש', ['congr:5']],
  ['דמיון|דמיון משולשים|משולשים דומים|צורות דומות', ['sim:2', 'sim:3', 'sim:4']],
  ['משפטים הפוכים', ['sim:1']],
  ['יחס שטחים|יחס הדמיון', ['sim:4']],
  // systems and inequalities
  ['מערכת משוואות|מערכות משוואות|מערכת של משוואות|שתי משוואות|שתי משוואות עם שני נעלמים|שני נעלמים|משוואות עם שני נעלמים|x ו y|x וy', ['sys:2', 'sys:3', 'sys:4']],
  ['שיטת ההצבה|הצבה במערכת', ['sys:2']],
  ['השוואת מקדמים|שיטת השוואת המקדמים', ['sys:3']],
  ['בעיות עם שני נעלמים|בעיות עם שני משתנים', ['sys:4']],
  ['אי שוויונות|אי שוויון|אישוויונות|אי־שוויונות', ['sys:5']],
  // what is said about the test, not a topic: recognised, adds nothing
  ['שאלות פתוחות|שאלות אמריקאיות|שאלות בחירה|שאלת אתגר|שאלות אתגר|דפי עבודה|דף עבודה|דף סיכום|חוברת|ספר הלימוד|המחברת', []],
];

/** A bare topic name means these stairs (default: all of the topic's): equations are solving them, the word problems, motion and denominators are named on their own. */
const CORE = { eq: r('eq', 1, 4), signed: r('signed', 1, 6) };

// Words that say nothing about the topics (never listed as not recognised). Normalised forms.
const STOP = new Set(`
המבחן מבחן מבחנים בוחן הבוחן בחינה הבחינה בגרות יהיה יהיו תהיה יהיה יכלול יכלול כולל כוללים יכלול ייכלל על של את עם גם וגם או אבל
כל כולם הכל הנושאים נושאים נושא הנושא חומר החומר החומרים למבחן חזרה לחזור חזרו תחזרו לתרגל תרגול תרגלו ללמוד למדו לומדים לימדנו למדנו
שלום היי הי בוקר ערב טוב תלמידים תלמידות תלמידי יקרים יקרות ילדים הורים בהצלחה מחר היום השבוע שבוע הבא הקרוב ביום יום ראשון שני שלישי
רביעי חמישי שישי שבת בשעה שעה שעות שיעור שיעורים כיתה הכיתה ז ח שכבה המורה מורה הספר ספר בספר מחברת דף דפים דפי עבודה תרגילים תרגיל
שאלות שאלה בעיות בעיה כמו שכבר כבר אנחנו אתם אתן לכם לכן להביא להכין הכנה ההכנה צריך צריכים חשוב מאוד בבקשה תודה יש אין זה זו זאת
הזה הזאת אלה האלה עד שם כן לא רק בעיקר וכן הבאים הבאות הבא נלמד שלמדנו שלמדנו שנלמד שעשינו עשינו בנושא בנושאים פרקים תכנית התכנית
סיכום הסיכום מסכם לסכם דגש בדגש להתכונן התכוננו מוכנים זמן דקות דקה תאריך מועד מועד ב מועד א מצורף מצורפת להלן הנה רשימת רשימה
ס סמ סמר סמק מר מק קמ קמש מטר מטרים ליטר ליטרים מעלות גרם קג שח אגורות מ ב ל ה ו ש כ x y
גאומטריה גיאומטריה אלגברה חשבון מתמטיקה דרך מתוך סיפור סיפורים שימו לב גיליון גליון מתכונת השנה שנה כולם לכולם שאלו
ישרים מה שלמדנו לגבי בנוגע עוד נוסף נוספים נוספות ראו מטלה מטלות בוחן
`.trim().split(/\s+/).map(normWord));
// Words that point into the book or the notebook: with a number beside them they are listed as not recognised ("פרק 3")
const REF = new Set(['פרק', 'פרקים', 'עמ', 'עמוד', 'עמודים', 'יחידה', 'יחידות', 'סעיף', 'סעיפים', 'דף', 'תרגיל', 'שאלה', 'מספר', 'מס'].map(normWord));
const NUM = /^[0-9]+%?$/;
// a piece of an exercise (2x, 3x+5, x², √9): neither a topic nor something to list
const MATHY = /^(?:[0-9]*[a-z][0-9a-z²]*|[0-9]+[²]?|√[0-9a-z]*|π)$/;

// formulas a message may write in symbols: the stairs they name, read before the words
const FORMULAS = [
  [/\by\s*=\s*m\s*x\s*\+\s*b\b|\bmx\s*\+\s*b\b/gi, ['line:2', 'line:5']],
  [/\ba\s*(?:\^\s*2|²)\s*\+\s*b\s*(?:\^\s*2|²)\s*=\s*c\s*(?:\^\s*2|²)/gi, ['pyth:1', 'pyth:2']],
  // an exercise written out (3x + 5 = 20, 2(x - 1) = 8): read as one, never as a topic
  [/[0-9a-z().\s]*[a-z][0-9a-z()+\-*/:^².\s]*[=<>][0-9a-z()+\-*/:^².\s-]*[0-9a-z)]/gi, []],
];

/** Exclusion words: after them in a clause ("בלי", "לא כולל"), or anywhere in their clause ("לא יהיו שאלות על…"). */
const EXCLUDE_AFTER = [['בלי'], ['ללא'], ['חוץ'], ['מלבד'], ['לא', 'כולל'], ['אין', 'צורך'], ['לא', 'צריך'], ['לא', 'נדרש'], ['פרט']];
const EXCLUDE_ANY = [['לא', 'יהיה'], ['לא', 'יהיו'], ['לא', 'תהיה'], ['לא', 'ייכלל'], ['לא', 'ייכללו'], ['לא', 'נכלל'], ['לא', 'נכללים'], ['לא', 'נכללות'], ['לא', 'במבחן'], ['לא', 'בחומר'], ['ירד', 'מהחומר'], ['ירדו', 'מהחומר']];

/** The stairs a student of a grade may have on a test: Exam Rescue's rows (rescueTopicsFor) and the bridge unit. */
export function materialCatalogue(grade) {
  const g = String(grade || '7');
  const rows = [...rescueTopicsFor(g), ...bridgeTopicsFor(g).filter((t) => !rescueTopicsFor(g).some((x) => x.id === t.id))];
  return rows.flatMap((t) => rowStairs(t).map((s) => ({ id: s.id, topic: t.id, title: s.title, topicTitle: t.title })));
}

const splitKey = (phrase) => tokenize(phrase).map((t) => t.w);
const keyCache = new Map();
/** Every key of a grade: the synonyms, then the topics' and stairs' names, then the programme's unit titles and notes. */
function keysFor(grade, catalogue) {
  const ids = new Set(catalogue.map((s) => s.id));
  const sig = `${grade}|${catalogue.length}|${catalogue[0]?.id}|${catalogue.at(-1)?.id}`;
  if (keyCache.has(sig)) return keyCache.get(sig);
  const keys = [];
  const add = (phrase, skills, rank, obj = false) => {
    const words = splitKey(phrase);
    if (words.length) keys.push({ words, skills: skills.filter((x) => ids.has(x)), any: skills.length > 0, rank, phrase, obj });
  };
  SYNONYMS.forEach(([phrases, skills, kind]) => {
    const list = Array.isArray(skills) ? skills : skills[grade] || [];
    phrases.split('|').forEach((p) => add(p, list, 3, kind === 'obj'));
  });
  const topics = [...new Set(catalogue.map((s) => s.topic))];
  topics.forEach((t) => {
    const own = catalogue.filter((s) => s.topic === t).map((s) => s.id);
    add(TOPIC[t]?.title || t, CORE[t] ? CORE[t] : own, 2);
  });
  catalogue.forEach((s) => add(s.title, [s.id], 2));
  PROGRAMME.units.filter((u) => u.grade === String(grade)).forEach((u) => {
    add(u.title, u.parts.flatMap((p) => p.skills), 1);
    u.parts.forEach((p) => { if (p.note && p.skills.length) add(p.note, p.skills, 1); });
  });
  keyCache.set(sig, keys);
  return keys;
}

/** The best key at token i: { key, n, score } or null. Longer first, then the closer fit, then the key's rank. */
function bestAt(tokens, i, keys) {
  let best = null;
  for (const key of keys) {
    const n = key.words.length;
    if (i + n > tokens.length) continue;
    // a key never spans two clauses
    if (tokens[i + n - 1].clause !== tokens[i].clause) continue;
    let score = 0;
    for (let j = 0; j < n; j += 1) {
      const f = wordFit(key.words[j], tokens[i + j].w);
      if (!f) { score = -1; break; }
      score += f;
    }
    if (score < 0) continue;
    const better = !best || n > best.n || (n === best.n && (score > best.score || (score === best.score && key.rank > best.key.rank)));
    if (better) best = { key, n, score };
  }
  return best;
}

const seqAt = (tokens, i, seq) => seq.every((w, j) => tokens[i + j] && tokens[i + j].clause === tokens[i].clause && wordFit(w, tokens[i + j].w) === 3);

/** Is a word one of a set, as it is or after a prefix ("בפרק", "ולכולם")? → the prefix's length, or -1. */
function inSet(set, w) {
  if (set.has(w)) return 0;
  for (let p = 1; p <= 3 && p < w.length - 1; p += 1) if (PREFIX.test(w.slice(0, p)) && set.has(w.slice(p))) return p;
  return -1;
}
const topicsOf = (skills) => new Set(skills.map((x) => x.split(':')[0]));

/**
 * Read a text against a grade's catalogue. → {
 *   skills: the stairs found, in the catalogue's order (what Rescue ticks);
 *   byTopic: [{ topic, title, skills }] in the catalogue's order;
 *   excluded: the stairs taken out ("בלי שאלות תנועה");
 *   unknown: the text's own words that it could not place (at most UNKNOWN_MAX);
 *   hits: [{ text, skills, out }] what each matched piece of text gave (for tests).
 * }
 * Three readings of a list keep it to what the teacher meant:
 *   a heading ("פונקציה קווית: שיפוע, משוואת ישר"): the words after it on its line are read inside its topics, and when
 *     they name only parts of it, those parts are the test, not the whole heading;
 *   a shape ("נפח ושטח פנים של תיבה"): a measure beside it is read for that shape (נפח of a box, not of a prism), and a
 *     shape of several topics keeps the topic the words beside it name ("שטחים: משולש" is a triangle's area);
 *   a topic's name with its parts beside it ("משוואות ובעיות מילוליות") keeps both: nothing is taken away without a word
 *     that says so.
 * catalogue: materialCatalogue(grade), or another list of { id, topic, title, topicTitle } (tests).
 */
export function matchMaterial(text, grade = '7', catalogue = materialCatalogue(grade)) {
  const g = String(grade);
  const ids = new Set(catalogue.map((c) => c.id));
  let src = String(text ?? '').slice(0, MATERIAL_MAX);
  const hits = []; const formulaSkills = [];
  // formulas first; their characters are blanked so their letters are not read again
  FORMULAS.forEach(([re, skills]) => {
    src = src.replace(re, (m) => {
      if (skills.length) { formulaSkills.push(...skills.filter((x) => ids.has(x))); hits.push({ text: m.trim(), skills, out: false }); }
      return m.replace(/[^\n]/g, ' ');
    });
  });
  const tokens = tokenize(src);
  const keys = keysFor(g, catalogue);
  const used = new Array(tokens.length).fill(false);
  const found = []; // { i, n, key, skills, out, head }
  for (let i = 0; i < tokens.length;) {
    const b = bestAt(tokens, i, keys);
    if (!b) { i += 1; continue; }
    found.push({ i, n: b.n, key: b.key, skills: [...b.key.skills], out: false, head: tokens[i + b.n - 1].head });
    for (let j = 0; j < b.n; j += 1) used[i + j] = true;
    i += b.n;
  }
  // exclusions: "בלי", "לא כולל" take out what follows in the clause; "לא יהיו" anything in its clause
  tokens.forEach((t, i) => {
    for (const seq of EXCLUDE_AFTER) {
      if (!seqAt(tokens, i, seq)) continue;
      found.forEach((f) => { if (f.i > i && tokens[f.i].clause === t.clause) f.out = true; });
      for (let j = 0; j < seq.length; j += 1) used[i + j] = true;
    }
    for (const seq of EXCLUDE_ANY) {
      if (!seqAt(tokens, i, seq)) continue;
      found.forEach((f) => { if (tokens[f.i].clause === t.clause) f.out = true; });
      for (let j = 0; j < seq.length; j += 1) used[i + j] = true;
    }
  });
  const clauseOf = (f) => tokens[f.i].clause;
  const lineOf = (f) => tokens[f.i].line;
  // each word's heading: the last heading before it on its line
  const headOf = (f) => {
    let h = null;
    for (const x of found) { if (x === f || x.i >= f.i) break; if (x.head && lineOf(x) === lineOf(f)) h = x; }
    return h;
  };
  const keepTopics = (f, topics) => { const kept = f.skills.filter((x) => topics.has(x.split(':')[0])); if (kept.length) f.skills = kept; };
  // under a heading: read inside the heading's topics when it can be
  found.forEach((f) => { const h = headOf(f); if (h && !f.head) keepTopics(f, topicsOf(h.key.skills)); });
  // a shape of several topics: the topics the other words of its clause name
  found.forEach((f) => {
    if (!f.key.obj || topicsOf(f.skills).size < 2) return;
    const near = found.filter((x) => x !== f && !x.key.obj && !x.out && clauseOf(x) === clauseOf(f)).flatMap((x) => x.skills);
    if (near.length) keepTopics(f, topicsOf(near));
  });
  // a measure beside a shape: the measure of that shape
  found.forEach((f) => {
    if (f.key.obj) return;
    const shapes = found.filter((x) => x.key.obj && !x.out && clauseOf(x) === clauseOf(f)).flatMap((x) => x.skills);
    const kept = f.skills.filter((x) => shapes.includes(x));
    const topics = topicsOf(shapes);
    // only the measure's stairs of a shape's topic change; a topic no shape names stays whole
    if (kept.length) f.skills = [...f.skills.filter((x) => !topics.has(x.split(':')[0])), ...kept];
  });
  // a shape beside measures gives what they measure of it ("פריסה של קובייה" is a cube's net, not its volume)
  found.forEach((f) => {
    if (!f.key.obj || f.out) return;
    const measured = found.filter((x) => !x.key.obj && !x.out && clauseOf(x) === clauseOf(f)).flatMap((x) => x.skills);
    const kept = f.skills.filter((x) => measured.includes(x));
    if (kept.length) f.skills = kept;
  });
  // a heading whose list names only its own parts gives those parts, not the whole heading
  found.forEach((h) => {
    if (!h.head) return;
    const under = found.filter((f) => f !== h && !f.out && headOf(f) === h && f.skills.some((x) => topicsOf(h.skills).has(x.split(':')[0])));
    if (under.length && under.every((f) => f.skills.every((x) => !topicsOf(h.skills).has(x.split(':')[0]) || h.skills.includes(x)))) h.skills = [];
  });
  const inSkills = new Set(formulaSkills);
  const outSkills = new Set();
  const unknown = [];
  const pieceOf = (from, to, skip = 0) => src.slice(tokens[from].start + skip, tokens[to].end).trim();
  found.forEach((f) => {
    const first = tokens[f.i];
    // a prefix the key does not have (ו, ה, ב…) is not shown: "ויחס" is listed as "יחס"
    const lead = first.w.length > f.key.words[0].length && wordFit(f.key.words[0], first.w) === 3 ? first.raw.length - f.key.words[0].length : 0;
    const piece = pieceOf(f.i, f.i + f.n - 1, Math.max(0, Math.min(lead, 3)));
    hits.push({ text: piece, skills: f.skills, out: f.out });
    f.skills.forEach((x) => (f.out ? outSkills : inSkills).add(x));
    // a topic word the grade has no stair for ("חזקות" in ח׳): listed, so the student can choose by hand
    if (f.key.any && !f.key.skills.length && !f.out) unknown.push(piece);
  });
  // what could not be placed: runs of words that are neither found nor said about the test, in one clause
  let run = null;
  const flush = () => {
    if (run && (run.content || (run.ref && run.num))) unknown.push(pieceOf(run.from, run.to, run.skip));
    run = null;
  };
  tokens.forEach((t, i) => {
    const ref = inSet(REF, t.w);
    const kind = used[i] ? 'used' : ref >= 0 ? 'ref' : NUM.test(t.w) ? 'num' : inSet(STOP, t.w) >= 0 || MATHY.test(t.w) || t.w.length < 2 ? 'stop' : 'content';
    if (run && t.clause !== tokens[run.to].clause) flush();
    if (kind === 'used' || kind === 'stop') { flush(); return; }
    if (kind === 'num' && !run) return; // a number alone (a date, a score) is not listed
    if (kind === 'ref' && run?.num) flush(); // "פרק 5 ופרק 6": two pieces
    if (!run) run = { from: i, to: i, content: false, ref: false, num: false, skip: kind === 'ref' ? ref : 0 };
    run.to = i;
    run[kind] = true;
  });
  flush();
  const excluded = catalogue.map((c) => c.id).filter((id) => outSkills.has(id));
  const skills = catalogue.map((c) => c.id).filter((id) => inSkills.has(id) && !outSkills.has(id));
  const byTopic = [];
  catalogue.forEach((c) => {
    if (!skills.includes(c.id)) return;
    let row = byTopic.find((x) => x.topic === c.topic);
    if (!row) { row = { topic: c.topic, title: c.topicTitle, skills: [] }; byTopic.push(row); }
    row.skills.push(c.id);
  });
  const seen = new Set();
  const list = unknown.map((u) => u.replace(/\s+/g, ' ').slice(0, 40)).filter((u) => u && !seen.has(u) && seen.add(u)).slice(0, UNKNOWN_MAX);
  return { skills, byTopic, excluded, unknown: list, hits };
}
