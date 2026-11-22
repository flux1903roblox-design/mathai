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
// or more, with one letter wrong, missing, extra or swapped, never the first or the last letter ("פיטגורס", "משואות";
// "השוואה" is not "משוואה"). A few everyday words (COMMON: "נתון", "שיעור", "השוואה") match only a key that is exactly
// them. The text is split into the keys that cover the most of it, exact words first ("חישוב אחוז מכמות" is "אחוז
// מכמות", not "חישוב אחוזים"). A key may read differently beside a topic (opts.near: "שאלות מילוליות על פיתגורס" is
// Pythagoras' word problem, "שטח מלבן" under "מערכת צירים" is the coordinate stair) or beside a word (opts.when:
// "קובייה" beside "מטבע" is a die, not a cube). Words after "בלי", "ללא", "חוץ מ", "מלבד", "לא כולל", "לא יכלול",
// "אבל לא על" (up to the end of the clause) are taken out, and "לא יהיו", "לא ייכללו", "לא יופיעו" take out what follows
// them in the clause, or what comes before them when nothing follows; even when another line names them. A topic named
// with a list after it ("אחוזים: …", "פונקציה קווית - …", or alone in a sentence followed by a sentence of its parts:
// "מבחן בסטטיסטיקה. ממוצע, חציון.") gives the parts, not the whole topic. What it cannot place is returned as the
// text's own words ("פרק 3", "עמ' 40-62"), only from sentences about the material (a topic or a word like "על",
// "נושאים" in them; the logistics, "בשעה השנייה, בחדר 23", are not listed): a chapter or a page number alone is never
// guessed. The text's exercises ("3x+5=20") are read in one linear pass, never by a backtracking pattern.
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
// what ends a sentence: a line, a full stop, an exclamation or a question mark
const SENTENCE = /[\n\r.!?]/;

/**
 * The text as tokens: { w (normalised), raw, start, end, clause, sent, line, head } in order. `clause`, `sent` and `line`
 * count the clause, sentence and line breaks before a token; `head` is true when a colon, a dash or an opening bracket
 * follows it on its line ("אחוזים: …", "פונקציה קווית - …"): what comes after it is a list under it.
 */
export function tokenize(text) {
  const s = String(text ?? '');
  const out = [];
  let clause = 0; let sent = 0; let line = 0; let last = 0;
  for (const m of s.matchAll(TOKEN)) {
    const between = s.slice(last, m.index);
    // a dot between two digits (12.11, 2.5) is part of a number, not the end of a clause
    const decimal = /^\.$/.test(between) && /\d$/.test(s.slice(0, last)) && /^\d/.test(m[0]);
    if (!decimal) for (const ch of between) { if (CLAUSE.test(ch)) clause += 1; if (SENTENCE.test(ch)) sent += 1; }
    for (const ch of between) if (ch === '\n') line += 1;
    // (a closing bracket before the colon or dash too: "תחום אי הוודאות (סטטיסטיקה)- ממוצע וחציון")
    if (out.length && /^[ \t]*(?:\)[ \t]*)?(?::|[-–—](?=\s)|\()/.test(between)) out[out.length - 1].head = true;
    const w = normWord(m[0]);
    if (w) out.push({ w, raw: m[0], start: m.index, end: m.index + m[0].length, clause, sent, line, head: false });
    last = m.index + m[0].length;
  }
  return out;
}

const PREFIX = /^(?:ו?(?:ש|כש|מש)?(?:ה|ב|ל|מ|כ)?)$/;
/**
 * A key word's stem and its forms: a feminine word (ending in ה or ת, or a plural in ות) also as ה, ת and ות; any other
 * word also with ים and ות. So "חזקה" is also "חזקות" but never "חזקים" (strong).
 */
const formCache = new Map();
function formsOf(key) {
  if (formCache.has(key)) return formCache.get(key);
  // (keys are normalised: a final ם is a plain מ; a form is normalised too, so "ביטוי" + ים is "ביטוימ")
  const fem = (stem) => [`${stem}ה`, `${stem}ת`, `${stem}ות`];
  const forms = (key.length >= 5 && key.endsWith('ות')) ? fem(key.slice(0, -2))
    : (key.length >= 5 && key.endsWith('ימ')) ? [key.slice(0, -2), `${key.slice(0, -2)}ימ`]
      : (key.length >= 4 && (key.endsWith('ה') || key.endsWith('ת'))) ? fem(key.slice(0, -1))
        : [`${key}ימ`, `${key}ות`];
  const out = forms.map(normWord);
  formCache.set(key, out);
  return out;
}
/**
 * Damerau–Levenshtein distance of at most one: one letter changed, missing, extra, or two swapped, never the first letter
 * (a first letter often makes another word: "השוואה" is comparing, "משוואה" an equation) and never at the end of the word
 * (a last letter is an ending: "רביעי" is Wednesday, not "רביעים").
 */
function nearby(a, b) {
  if (Math.abs(a.length - b.length) > 1 || a[0] !== b[0]) return false;
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
 * Everyday words that look like a form or a misspelling of a topic's word: they match only a key that is exactly them.
 * "נתון" (given) is not "נתונים" (data), "שיעור" (a lesson) is not "שיעורים" (coordinates), "השוואה" (comparing) is not
 * "משוואה". Normalised forms.
 */
export const COMMON = new Set(['נתון', 'שיעור', 'שיעורי', 'השוואה', 'השוואת', 'שווה', 'שווים', 'מספר', 'חלק', 'כמות', 'מחיר'].map(normWord));
/**
 * How well a key word fits a text word: 3 the same (after a prefix), 2 in another form of the word (formsOf), 1 with one
 * letter wrong (words of five letters or more, not the first or last letter, with no prefix), 0 not at all. An everyday word (COMMON)
 * fits only the same word.
 */
export function wordFit(key, word) {
  if (!key || !word) return 0;
  let best = 0;
  const heb = HEB.test(key);
  for (let p = 0; p <= 3 && p < word.length; p += 1) {
    const pre = word.slice(0, p); const rest = word.slice(p);
    if (p && (!heb || !PREFIX.test(pre) || !HEB.test(rest[0] || '') || rest.length < 2)) continue;
    if (rest === key) return 3;
    if (COMMON.has(rest)) continue;
    if (best < 2 && heb && key.length >= 3 && formsOf(key).includes(rest)) best = 2;
    // a misspelling, never with a prefix too ("ווקטורים" is not "ו" + "קטרים" with a letter more)
    if (best < 1 && !p && heb && key.length >= 5 && rest.length >= 5 && nearby(key, rest)) best = 1;
  }
  return best;
}

// ---------------------------------------------------------------- the words for each stair
const r = (topic, from, to) => Array.from({ length: to - from + 1 }, (_, i) => `${topic}:${from + i}`);
/**
 * The words a teacher uses, each with its stairs: a list, or { 7: [...], 8: [...] } where the grades differ. Several
 * spellings of one phrase are separated by "|". `[]` is a neutral phrase: recognised, and it adds nothing ("מד זווית"
 * is something to bring, not the angles unit; an equation's own numbers are not a topic). The third element, when there
 * is one: 'obj' (a shape: a measure beside it is read for it), or { obj, near, wide, when }:
 *   near: { topic: stairs } read instead when a topic of near is named beside it: its heading, the list under it, its
 *     clause (with `wide`, its sentence too): "שאלות מילוליות על פיתגורס" is pyth:4, "שטח מלבן" under "מערכת צירים" coord:4;
 *   when: [words, stairs] read instead when one of the words is in its sentence ("קובייה" beside "מטבע" is a die).
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
  ['מערכת צירים|מערכת הצירים|מערכות צירים|צירים|נקודות במערכת צירים', r('coord', 1, 5)],
  ['קריאת נקודה|קריאת נקודות|שיעורי נקודה|שיעורי הנקודה|שיעורי הנקודות|שיעורי נקודות|שיעור x|שיעור y|שיעור ה-x|שיעור ה-y|שיעורי x ו-y', ['coord:1']],
  // "שיעור" is a lesson: "בשיעור הבא", "שיעורי בית" say nothing about the topics (the coordinates are "שיעורי נקודה")
  ['שיעור|שיעורים|שיעורי|השיעור|שיעורי בית', []],
  // a point is a coordinate's word only beside the coordinate plane ("לפי שתי נקודות" is not a topic)
  ['נקודה|נקודות', [], { near: { coord: ['coord:1'] } }],
  ['נקודות ברביעים|נקודה ברביע|נקודות ברביע|נקודות בארבעת הרביעים', ['coord:1', 'coord:2']],
  ['רביע|רביעים|ארבעת הרביעים', ['coord:2']],
  ['אורך קטע|אורך של קטע', ['coord:3']],
  ['קודקוד חסר', ['coord:5']],
  // angles
  ['זוויות|זווית', r('angles', 1, 7)],
  ['זוויות צמודות|צמודות|זווית צמודה', ['angles:1']],
  ['זוויות קודקודיות|קודקודיות|קדקודיות|זוויות קדקודיות', ['angles:2']],
  ['סכום זוויות במשולש|זוויות במשולש|סכום הזוויות במשולש', ['angles:3']],
  ['זוויות בין מקבילים|זוויות בין ישרים מקבילים|זוויות מתאימות|זוויות מתחלפות|מתאימות ומתחלפות|זוויות חד צדדיות|זוויות מתחלפות ומתאימות|מתחלפות ומתאימות|זוויות מתאימות ומתחלפות', ['angles:4']],
  // "suitable" in everyday Hebrew: corresponding angles only beside the angles' words (the council's round 3, "ומתאימות")
  ['מתאימות|מתחלפות|חד צדדיות', [], { when: [['זוויות', 'זווית', 'מקבילים', 'מקביל', 'חותך', 'מתחלפות', 'מתאימות'], ['angles:4']] }],
  // parallel lines beside a slope are lines with the same slope, not the angles between them
  ['ישרים מקבילים|מקבילים|ישרים מקבילים ונחתכים', ['angles:4'], { near: { line: [] } }],
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
  ['הצבה בביטוי|הצבת מספרים|הצבה בביטויים', ['expr:1']],
  // under the systems ("מערכת משוואות (שיטת השוואה והצבה)") it is the substitution method
  ['הצבה|ההצבה', ['expr:1'], { near: { sys: ['sys:2'] } }],
  ['כתיבת ביטוי|כתיבת ביטויים|לכתוב ביטוי|בניית ביטוי', ['expr:2']],
  ['כינוס איברים|כינוס איברים דומים|כינוס|איברים דומים', ['expr:3']],
  ['חוק הפילוג|פילוג|פתיחת סוגריים|הפילוג', ['expr:4']],
  ['פישוט ביטויים|פישוט|פישוט ביטוי', ['expr:5']],
  // areas and perimeters
  ['שטחים|שטח|חישוב שטחים', { 7: r('area', 1, 4), 8: ['circle:2'] }],
  ['שטחים והיקפים', { 7: r('area', 1, 5), 8: [] }],
  ['היקפים|היקף|חישוב היקפים', { 7: ['area:1', 'area:5'], 8: ['circle:1'] }],
  ['שטח מלבן|היקף ושטח של מלבן|שטח של מלבן|היקף מלבן', ['area:1'], { near: { coord: ['coord:4'] } }],
  ['מלבן|מלבנים|ריבוע|ריבועים', ['area:1'], 'obj'],
  ['שטח מלבן במערכת צירים|שטח במערכת צירים', ['coord:4']],
  ['שטח משולש|שטח של משולש|שטחי משולשים', ['area:2']],
  ['צורות מורכבות|שטח צורה מורכבת', ['area:3']],
  ['שטח מקבילית|שטח טרפז|שטח של מקבילית|שטח של טרפז', ['area:4']],
  ['מקבילית|מקביליות|טרפז|טרפזים', ['area:4'], 'obj'],
  // solids
  // a die beside a coin or a probability is not a cube
  ['תיבה|תיבות|קובייה|קוביות', ['solid:1', 'solid:2'], { obj: true, when: [['מטבע', 'מטבעות', 'הסתברות', 'סיכוי', 'הטלה', 'הטלת', 'הטלות', 'פלי'], []] }],
  ['גופים|גופים במרחב', r('solid', 1, 4)],
  ['מנסרה|מנסרות|מנסרה משולשת|מנסרות משולשות', ['solid:3', 'solid:4'], 'obj'],
  ['משולשת|משולשות', []],
  ['פריסה|פריסות|שטח פנים|שטחי פנים', { 7: ['solid:1', 'solid:3'], 8: ['circle:3'] }],
  ['נפח|נפחים', ['solid:2', 'solid:4', 'circle:3', 'circle:4']],
  ['נפח תיבה|נפח של תיבה|נפח קובייה', ['solid:2']],
  ['נפח מנסרה|נפח של מנסרה|נפח של מנסרה משולשת|נפח מנסרה משולשת', ['solid:4']],
  // data
  ['נתונים|איסוף נתונים|ייצוג נתונים|קריאת נתונים|איסוף וארגון הנתונים|איסוף וארגון נתונים|ארגון נתונים|ארגון הנתונים', ['data:1', 'data:2']],
  // a frequency table under statistics is where a median or a mean is read from, not the data unit
  ['שכיחות|שכיחויות|טבלת שכיחויות|טבלת שכיחות', ['data:1', 'data:2'], { near: { stats: [] } }],
  ['דיאגרמה|דיאגרמות|דיאגרמת עמודות|גרף עמודות|דיאגרמת מקלות|פיקטוגרמה|קריאת דיאגרמות|קריאת דיאגרמה|קריאת טבלה|קריאת טבלאות', ['data:1']],
  ['שכיחות יחסית|שכיחויות יחסיות', ['data:2']],
  ['דיאגרמת עוגה|דיאגרמת עיגול|עוגה', ['data:3']],
  ['הסתברות|הסתברויות|סיכוי', ['data:4', 'prob:1', 'prob:2', 'prob:3']],
  ['מאורע משלים|מאורעות משלימים', ['prob:2']],
  ['ניסוי בשני שלבים|ניסוי דו שלבי|ניסוי דו־שלבי|טבלת זוגות|דיאגרמת עץ|עץ הסתברות|עץ מצבים', ['prob:3']],
  ['מאורעות שווי הסתברות|מאורעות שווי סיכוי|תוצאות שוות סיכוי|שוות סיכוי|שווי הסתברות|שווי סיכוי', { 7: ['data:4'], 8: ['prob:1'] }],
  // a coin and its faces ("עץ או פלי"), a throw: what a probability question is about, not a topic of its own
  ['מטבע|מטבעות|עץ|פלי|עץ או פלי|הטלה|הטלות|הטלת מטבע|הטלת קובייה|הטלת קוביות|זריקת קובייה', []],
  // equations
  ['משוואות|משוואה|פתרון משוואות|משוואות ופתרונן|פתרון משוואה', r('eq', 1, 4)],
  ['משוואה בשני צעדים|משוואות בשני צעדים|שני צעדים', ['eq:2']],
  ['נעלם בשני האגפים|נעלמים בשני האגפים|x בשני האגפים|בשני האגפים|איקס בשני האגפים', ['eq:3']],
  ['משוואות עם סוגריים|משוואה עם סוגריים', ['eq:4']],
  // a word problem is the word problem of the topic beside it: equations, Pythagoras, two unknowns
  ['בעיות מילוליות|שאלות מילוליות|שאלה מילולית|בעיה מילולית|בעיות מילוליות במשוואות|שאלות בהקשרים|בעיות בהקשרים|בעיות קנייה|שאלות קנייה', { 7: ['eq:5'], 8: ['eq:5', 'sys:4'] }, { near: { eq: ['eq:5'], pyth: ['pyth:4'], sys: ['sys:4'] }, wide: true }],
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
  ['אחוז מכמות|אחוז ממספר|חישוב אחוז מכמות', ['pct:2']],
  ['איזה אחוז', ['pct:3']],
  ['מציאת השלם|מציאת הכמות השלמה|מחיר מקורי|המחיר המקורי|מציאת המחיר המקורי|מציאת 100%|מציאת ה-100%|מציאת 100 אחוז', ['pct:4']],
  ['הנחה|הנחות|התייקרות|התייקרויות|הוזלה|הוזלות|הגדלה והקטנה באחוזים|הגדלה באחוזים|הקטנה באחוזים|שינוי באחוזים|עליית מחיר|ירידת מחיר', ['pct:5']],
  ['משוואות עם אחוזים|משוואה עם אחוזים', ['sys:1']],
  // functions
  ['פונקציה|פונקציות|מבוא לפונקציות|מושג הפונקציה', r('func', 1, 4)],
  ['קריאת גרף של מצב|גרפים של מצב|גרף המתאר מצב', ['func:1']],
  ['קצב שינוי אחיד ולא אחיד|אחיד ולא אחיד|קצב אחיד ולא אחיד', ['func:4']],
  ['גרף|גרפים|קריאת גרף|קריאת גרפים|גרף של מצב|גרף שמתאר מצב', ['func:1']],
  // (under the linear function, its representations are its own: line:1-8 name them)
  ['ייצוגים|ייצוגי פונקציה|ייצוגים של פונקציה|טבלה גרף וביטוי|מעבר בין ייצוגים|מעבר בין הייצוגים|מעבר בין ייצוגים שונים', ['func:2'], { near: { line: [] } }],
  ['עלייה וירידה|עלייה ירידה|תחומי עלייה|תחומי עלייה וירידה|עולה ויורדת|עלייה ירידה וקבוע', ['func:3']],
  ['קצב|קצב שינוי|קצב שינוי אחיד|קצב אחיד', ['func:4']],
  ['פונקציה קווית|פונקציות קוויות|פונקציה ליניארית|פונקציה לינארית|פונקציות ליניאריות|קו ישר|גרף של ישר|גרפים לינאריים|גרפים ליניאריים|פונקציה קוית', r('line', 1, 8)],
  ['טבלת ערכים', ['line:1']],
  ['מציאת m ו-b|m ו-b|m וb|מציאת m וb|מה אומרים m ו-b|המשמעות של m ו-b', ['line:2']],
  ['שיפוע|שיפועים|שיפוע של ישר|שיפוע שווה|שיפועים שווים', ['line:3', 'line:4']],
  ['שיפוע מגרף|שיפוע מהגרף|שיפוע מתוך גרף|שיפוע לפי גרף|שיפוע מתוך הגרף', ['line:3']],
  ['שיפוע בין שתי נקודות|שיפוע בין נקודות|שיפוע לפי שתי נקודות|שיפוע משתי נקודות', ['line:4']],
  ['משוואת ישר|משוואת הישר|משוואה של ישר', ['line:5']],
  ['משוואת ישר לפי שתי נקודות|משוואת ישר משתי נקודות|משוואת ישר דרך שתי נקודות', ['line:4', 'line:5']],
  // the sub-topics of a teacher's linear-function list (the council's round 3, the 17.11 exam), each on the stair that
  // practises it: a point on the line (line:1), lines parallel to the axes (line:2), the equation from a point and a
  // slope or a point and a parallel line (line:5), the line meeting the axes (line:6), two functions' graphs (line:8)
  ['האם נקודה נמצאת על הישר|נקודה נמצאת על הישר|האם הנקודה נמצאת על הישר|נקודה על הישר|האם נקודה על הישר|נקודה על ישר|נקודות על הישר', ['line:1']],
  ['ישרים מקבילים לצירים|ישר מקביל לציר|ישרים המקבילים לצירים|ישר המקביל לציר|מקבילים לצירים|מקביל לציר', ['line:2']],
  ['ייצוג אלגברי|הייצוג האלגברי|ייצוג אלגברי של ישר|הייצוג האלגברי של הקו הישר|הייצוג האלגברי של הישר', ['line:2', 'line:5']],
  ['נקודה ושיפוע|נקודה וישר המקביל|נקודה וישר מקביל|נקודה וישר המקביל לו|ישר המקביל לישר נתון|ישר מקביל לישר נתון', ['line:5']],
  // "two points" is the line's equation under the linear function, nothing alone (a point is the coordinate plane's)
  ['שתי נקודות|באמצעות שתי נקודות', [], { near: { line: ['line:4', 'line:5'] } }],
  ['נקודות חיתוך של הישר עם הצירים|נקודות החיתוך של הישר עם הצירים|חיתוך הישר עם הצירים|חיתוך של הישר עם הצירים|נקודות חיתוך של ישר עם הצירים', ['line:6']],
  ['גרפים של שתי פונקציות|גרפים של שני ישרים|שני ישרים|שני גרפים|הגרפים של שתי פונקציות', ['line:8']],
  // the linear function's properties (rising, falling, what m and b say); modelling with it (the rate stories of line:5)
  ['תכונות|תכונות הישר|תכונות של פונקציה קווית', [], { near: { line: ['line:2'] } }],
  ['ייצוג תופעות|תופעות', [], { near: { line: ['line:5'] } }],
  ['נקודת חיתוך|נקודות חיתוך|חיתוך עם הצירים|נקודות החיתוך עם הצירים|נקודות חיתוך עם הצירים|נקודת חיתוך עם הצירים|חיתוך עם ציר|נקודות חיתוך עם צירים', ['line:6']],
  ['משולש עם הצירים', ['line:7']],
  ['נקודת מפגש|נקודת מפגש של ישרים|נקודת מפגש של שני ישרים|נקודת המפגש של שני הישרים|חיתוך של שני ישרים|נקודת חיתוך של שני ישרים|חיתוך ישרים', ['line:8']],
  // Pythagoras
  ['פיתגורס|משפט פיתגורס|משפט פיתגורס ושימושיו', r('pyth', 1, 5)],
  ['מציאת היתר|חישוב היתר|אורך היתר|יתר|היתר|מציאת יתר', ['pyth:1']],
  ['ניצב|מציאת ניצב|ניצבים', ['pyth:2']],
  ['משולש ישר זווית|האם המשולש ישר זווית|ישר זווית', ['pyth:3']],
  ['מרחק בין נקודות|מרחק בין שתי נקודות|מרחק בין נקודות במערכת צירים', ['pyth:5']],
  ['פיתגורס במרחב|פיתגורס בגופים', ['space:1', 'space:2']],
  ['אלכסון|אלכסון בתיבה|אלכסון בקובייה|אלכסון של תיבה', ['space:1']],
  // circle, cylinder, cone
  ['מעגל|מעגלים|עיגול|עיגולים', ['circle:1', 'circle:2'], 'obj'],
  ['רדיוס|הרדיוס|קוטר|הקוטר|רדיוס וקוטר', ['circle:1', 'circle:2']],
  ['פאי|π', ['circle:1', 'circle:2']],
  ['היקף מעגל|היקף המעגל', ['circle:1']],
  ['שטח עיגול|שטח העיגול', ['circle:2']],
  ['גליל|גלילים', ['circle:3'], 'obj'],
  ['חרוט|חרוטים', ['circle:4'], 'obj'],
  // statistics
  ['סטטיסטיקה', r('stats', 1, 8)],
  // the programme's name for the domain ("תחום אי הוודאות (סטטיסטיקה)"): recognised, and the topic beside it says which
  ['תחום אי הוודאות|אי הוודאות|אי ודאות|תחום אי ודאות', []],
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
  ['משפטי דמיון|משפטי הדמיון|משפט דמיון', ['sim:3']],
  ['משפטים הפוכים', ['sim:1']],
  ['יחס שטחים|יחס הדמיון', ['sim:4']],
  // systems and inequalities
  ['מערכת משוואות|מערכות משוואות|מערכת של משוואות|שתי משוואות|שתי משוואות עם שני נעלמים|שני נעלמים|משוואות עם שני נעלמים|x ו y|x וy', ['sys:2', 'sys:3', 'sys:4']],
  ['שיטת ההצבה|הצבה במערכת|שיטת הצבה', ['sys:2']],
  ['השוואת מקדמים|שיטת השוואת המקדמים|שיטת השוואה|שיטת ההשוואה|שיטת השוואת מקדמים', ['sys:3']],
  // comparing, said alone, is the comparison method only under the systems
  ['השוואה|ההשוואה', [], { near: { sys: ['sys:3'] } }],
  ['בעיות עם שני נעלמים|בעיות עם שני משתנים|בעיות מילוליות עם שני נעלמים|שאלות מילוליות עם שני נעלמים|בעיות מילוליות עם שני משתנים', ['sys:4']],
  ['אי שוויונות|אי שוויון|אישוויונות|אי־שוויונות', ['sys:5']],
  // what is said about the test, not a topic: recognised, adds nothing
  ['שאלות פתוחות|שאלות אמריקאיות|שאלות בחירה|שאלת אתגר|שאלות אתגר|דפי עבודה|דף עבודה|דף סיכום|חוברת|ספר הלימוד|המחברת|כל הפעולות|ארבע הפעולות|ארבע פעולות החשבון|דף טיוטה|שעת שהייה', []],
];

/** A bare topic name means these stairs (default: all of the topic's): equations are solving them, the word problems, motion and denominators are named on their own. */
const CORE = { eq: r('eq', 1, 4), signed: r('signed', 1, 6) };

// Words that say nothing about the topics (never listed as not recognised): the test, the class and the day, and the
// logistics of a teacher's message ("בשעה השנייה", "יתקיים", "משך", "ניפגש בחדר", "מי שלא היה"). Normalised forms.
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
ראשונה הראשונה שנייה השנייה שלישית השלישית רביעית הרביעית חמישית אחרונה האחרונה האחרון האחרונים האחרונות אחרון אחרי לפני
תזכורת יתקיים תתקיים יתקיימו משך ניפגש נפגש נתראה חדר בחדר כיתת מי היה הייתה שלא שמי שיצלם לצלם תצלמו מחבר חבר חברה חברים
לקראת מחצית המחצית טיוטה צורך הפסקה שהייה עזרה שצריך נעשה נעשים נעבור בחצי חצי השעה הקרובה הבאה ושל במתמטיקה מתמטיקה
איך ואיך מוצאים מחשבים פותרים כותבים בונים לפי ולפי שתי שני שלוש בין כשנתון נתון החלק חלק כמה הכמה אם אז כך ככה
ציון ציונים ממוחשב בכתב פתוח סגור חוברות עמודים חישוב חישובי מציאת מציאה פתרון כתיבת קריאת שימוש שימושים שווה שווים טבלה טבלאות
למשל לדוגמה לדוגמא דוגמה דוגמא דוגמאות חשבו פתרו חשבי פתרי הפסקה בהפסקה חולה חולים שיבוא אליי אלי סיים שיסיים לסיים להגיש הגשה
ציוד עט עיפרון מחק כתיבה
באמצעות בעזרת עזרת המשך מכיתה ז
`.trim().split(/\s+/).map(normWord));
// Words that point into the book or the notebook: with a number beside them they are listed as not recognised ("פרק 3")
const REF = new Set(['פרק', 'פרקים', 'עמ', 'עמוד', 'עמודים', 'יחידה', 'יחידות', 'סעיף', 'סעיפים', 'דף', 'תרגיל', 'תרגילים', 'שאלה', 'מספר', 'מס', 'כרך', 'כרכים'].map(normWord));
// Words that say a sentence is about the material ("על", "נושאים", "כולל"): a word nothing places is listed from such a
// sentence, or from one that names a topic; never from a sentence of logistics ("ניפגש בשעה 8:10 בחדר 23").
const CUE = new Set(['על', 'נושא', 'נושאים', 'הנושאים', 'חומר', 'החומר', 'כולל', 'גם', 'וגם', 'חזרה', 'לחזור', 'לתרגל', 'תרגלו', 'יכלול', 'ללמוד', 'נלמד', 'בנושא'].map(normWord));
// Words that add to what came before or stress a part of it ("וגם שאלות תנועה", "בעיקר שיקופים"): a sentence with one is
// never a list under the sentence before it.
const ADDS = new Set(['גם', 'וגם', 'כולל', 'כוללת', 'בנוסף', 'עוד', 'ועוד', 'וכן', 'אפילו', 'בעיקר', 'במיוחד', 'בדגש', 'דגש', 'למשל', 'כמו'].map(normWord));
const NUM = /^[0-9]+%?$/;
// a piece of an exercise (2x, 3x+5, x², √9): neither a topic nor something to list
const MATHY = /^(?:[0-9]*[a-z][0-9a-z²]*|[0-9]+[²]?|√[0-9a-z]*|π)$/;

// formulas a message may write in symbols: the stairs they name, read before the words
const FORMULAS = [
  [/\by\s*=\s*m\s*x\s*\+\s*b\b|\bmx\s*\+\s*b\b/gi, ['line:2', 'line:5']],
  [/\ba\s*(?:\^\s*2|²)\s*\+\s*b\s*(?:\^\s*2|²)\s*=\s*c\s*(?:\^\s*2|²)/gi, ['pyth:1', 'pyth:2']],
];
// An exercise written out (3x + 5 = 20, 2(x - 1) = 8, x > 3): read as one, never as a topic. Found by one pass from each
// relation sign (never by a backtracking pattern: on a long line of Latin letters with no "=" it froze the screen).
const EXPR_CH = /[0-9a-z()+\-*/:^².\s]/i; // what an exercise is written with, beside the relation sign
const LEAD_CH = /[0-9a-z().\s]/i; // what may come before its first letter
const LETTER = /[a-z]/i;
const ENDS_OK = /[0-9a-z)]/i;
/** The exercises of a text, [{ from, to }] (to exclusive), in order: each has a Latin letter before its relation sign. */
export function exerciseSpans(src) {
  const out = [];
  let floor = 0; // the end of the last exercise: the next one starts after it
  for (let k = 0; k < src.length; k += 1) {
    if (!'=<>'.includes(src[k]) || k < floor) continue;
    // the left side: back over the exercise's characters (a relation sign stops it), then forward to where its first
    // letter may start (only digits, letters, brackets, dots and spaces before that letter)
    let a = k;
    while (a > floor && EXPR_CH.test(src[a - 1])) a -= 1;
    let start = -1;
    for (let i = a, from = a; i < k; i += 1) {
      if (LETTER.test(src[i])) { start = from; break; }
      if (!LEAD_CH.test(src[i])) from = i + 1;
    }
    if (start < 0) continue;
    // the right side: forward over the exercise's characters (and a minus), back to its last digit, letter or bracket
    let b = k + 1;
    while (b < src.length && (EXPR_CH.test(src[b]) || src[b] === '-')) b += 1;
    while (b > k + 1 && !ENDS_OK.test(src[b - 1])) b -= 1;
    if (b <= k + 1) continue;
    out.push({ from: start, to: b });
    floor = b;
    k = b - 1;
  }
  return out;
}

/** Exclusion words, normalised as the text's words are (so "חוץ", "לא ייכללו", "אין צורך" are read). */
const seqs = (list) => list.map((x) => x.split(' ').map(normWord));
/** After them, to the end of their clause: "בלי שאלות תנועה", "המבחן לא יכלול…", "אבל לא על…". */
export const EXCLUDE_AFTER = seqs(['בלי', 'ללא', 'חוץ', 'מלבד', 'פרט', 'לא כולל', 'לא כוללת', 'אין צורך', 'לא צריך', 'לא צריכים', 'לא נדרש',
  'לא יכלול', 'לא תכלול', 'לא יכללו', 'לא נכלול', 'לא על', 'לא נלמד']);
/**
 * Before or after them in their clause: what follows ("לא יהיו שאלות על…"), or, when nothing follows, what came before
 * ("שאלות תנועה לא ייכללו").
 */
export const EXCLUDE_ANY = seqs(['לא יהיה', 'לא יהיו', 'לא תהיה', 'לא תהיינה', 'לא ייכלל', 'לא ייכללו', 'לא תיכלל', 'לא נכלל', 'לא נכללים',
  'לא נכללות', 'לא יופיע', 'לא יופיעו', 'לא תופיע', 'לא יישאלו', 'לא במבחן', 'לא בחומר', 'ירד מהחומר', 'ירדו מהחומר', 'יורד מהחומר', 'יורדים מהחומר']);

// A number or an expression inside Hebrew text: a digit or a Latin letter, and what follows it of digits, letters, signs
// and spaces ("40 - 62", "3x+5=20", "8:15"). A sign before it ("-3", "(-4)") is its own unless it hangs on a Hebrew
// letter: "ו-4" is "ו" and a maqaf.
const LTR_CORE = /[0-9A-Za-zπ√][0-9A-Za-zπ√²%+\-−–=<>*/^().,:·× ]*/g;
const LTR_SIGN = /[-−–+(]/;
/**
 * A piece of plain text as runs [{ text, ltr }]: each number or expression is its own run, to be set left to right in its
 * own isolate (<bdi dir="ltr">), so "עמודים 40 - 62" never shows "62 - 40" and "למשל -3+5" never "3+5-" in a Hebrew line.
 */
export function ltrRuns(text) {
  const s = String(text ?? '');
  const out = [];
  let at = 0;
  for (const m of s.matchAll(LTR_CORE)) {
    if (m.index < at) continue;
    let from = m.index;
    while (from > at && LTR_SIGN.test(s[from - 1])) from -= 1;
    if (from < m.index && from > 0 && /[א-ת׳״'"]/.test(s[from - 1])) from = m.index;
    let to = m.index + m[0].length;
    while (to > from + 1 && /[\s.,:]/.test(s[to - 1])) to -= 1;
    if (from > at) out.push({ text: s.slice(at, from), ltr: false });
    out.push({ text: s.slice(from, to), ltr: true });
    at = to;
  }
  if (at < s.length) out.push({ text: s.slice(at), ltr: false });
  return out;
}

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
  const mine = (list) => list.filter((x) => ids.has(x));
  const add = (phrase, skills, rank, o = {}) => {
    const words = splitKey(phrase);
    if (!words.length) return;
    const near = o.near ? Object.fromEntries(Object.entries(o.near).map(([t, l]) => [t, mine(l)])) : null;
    const when = o.when ? { words: o.when[0].map(normWord), skills: mine(o.when[1]) } : null;
    keys.push({ words, skills: mine(skills), any: skills.length > 0, rank, phrase, obj: !!o.obj, near, wide: !!o.wide, when });
  };
  SYNONYMS.forEach(([phrases, skills, kind]) => {
    const list = Array.isArray(skills) ? skills : skills[grade] || [];
    const o = kind === 'obj' ? { obj: true } : kind || {};
    phrases.split('|').forEach((p) => add(p, list, 3, o));
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
  // by first word, for the scan: a key is tried only where its first word could fit
  keys.byFirst = new Map();
  keys.forEach((k) => { const f = k.words[0]; if (!keys.byFirst.has(f)) keys.byFirst.set(f, []); keys.byFirst.get(f).push(k); });
  keyCache.set(sig, keys);
  return keys;
}

/** The keys whose first word fits a text word (each first word is checked once per text word). */
function keysStartingAt(word, keys, memo) {
  if (memo.has(word)) return memo.get(word);
  const out = [];
  keys.byFirst.forEach((list, first) => { const f = wordFit(first, word); if (f) out.push({ f, list }); });
  memo.set(word, out);
  return out;
}

/** The best key of each length at token i: [{ key, n, score }]. A key never spans two clauses. */
function candidatesAt(tokens, i, keys, memo) {
  const best = new Map();
  for (const { f, list } of keysStartingAt(tokens[i].w, keys, memo)) {
    for (const key of list) {
      const n = key.words.length;
      if (i + n > tokens.length || tokens[i + n - 1].clause !== tokens[i].clause) continue;
      let score = f;
      for (let j = 1; j < n; j += 1) {
        const g = wordFit(key.words[j], tokens[i + j].w);
        if (!g) { score = -1; break; }
        score += g;
      }
      if (score < 0) continue;
      const cur = best.get(n);
      if (!cur || score > cur.score || (score === cur.score && key.rank > cur.key.rank)) best.set(n, { key, n, score });
    }
  }
  return [...best.values()];
}

/**
 * The keys that read the text: the split that covers the most words, then with the fewest keys (one long key over two
 * short ones: "סיבובים במערכת צירים" is the rotation stair, not a rotation and the coordinate unit), then the closer fits
 * ("חישוב אחוז מכמות" is "אחוז מכמות", an exact pair, not "חישוב אחוזים", a pair with a plural).
 */
function segment(tokens, keys) {
  const memo = new Map();
  const n = tokens.length;
  const val = new Array(n + 1).fill(0);
  const pick = new Array(n + 1).fill(null);
  for (let i = n - 1; i >= 0; i -= 1) {
    val[i] = val[i + 1];
    for (const c of candidatesAt(tokens, i, keys, memo)) {
      const v = c.n * 1000 - 20 + c.score + c.key.rank * 0.01 + val[i + c.n];
      if (v > val[i]) { val[i] = v; pick[i] = c; }
    }
  }
  const out = [];
  for (let i = 0; i < n;) { if (pick[i]) { out.push({ i, ...pick[i] }); i += pick[i].n; } else i += 1; }
  return out;
}

const seqAt = (tokens, i, seq) => seq.every((w, j) => tokens[i + j] && tokens[i + j].clause === tokens[i].clause && wordFit(w, tokens[i + j].w) === 3);

/** Is a word one of a set, as it is or after a prefix ("בפרק", "ולכולם")? → the prefix's length, or -1. */
function inSet(set, w) {
  if (set.has(w)) return 0;
  for (let p = 1; p <= 3 && p < w.length - 1; p += 1) if (PREFIX.test(w.slice(0, p)) && set.has(w.slice(p))) return p;
  return -1;
}
const topicsOf = (skills) => new Set(skills.map((x) => x.split(':')[0]));

/** How many characters of a raw word its first `n` normalised letters take ("וקובייה": the prefix ו is one). */
function rawPrefix(raw, rest) {
  for (let k = 1; k < raw.length; k += 1) if (normWord(raw.slice(k)) === rest) return k;
  return 0;
}

/**
 * Read a text against a grade's catalogue. → {
 *   skills: the stairs found, in the catalogue's order (what Rescue ticks);
 *   byTopic: [{ topic, title, skills }] in the catalogue's order;
 *   excluded: the stairs taken out ("בלי שאלות תנועה");
 *   unknown: the text's own words that it could not place (at most UNKNOWN_MAX);
 *   hits: [{ text, skills, out }] what each matched piece of text gave (for tests).
 * }
 * Readings that keep a list to what the teacher meant:
 *   a heading ("פונקציה קווית: שיפוע, משוואת ישר", or "מבחן בסטטיסטיקה. ממוצע, חציון."): the words after it are read
 *     inside its topics, and when they name only parts of it, those parts are the test, not the whole heading;
 *   a word beside a topic (near): "שאלות מילוליות על פיתגורס" is pyth:4, "שטח מלבן" under "מערכת צירים" is coord:4;
 *   a word beside a word (when): "קובייה" beside "מטבע" is a die, not a box;
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
      formulaSkills.push(...skills.filter((x) => ids.has(x))); hits.push({ text: m.trim(), skills, out: false });
      return m.replace(/[^\n]/g, ' ');
    });
  });
  // then the exercises written out, blanked the same way
  const spans = exerciseSpans(src);
  if (spans.length) {
    let out = ''; let at = 0;
    spans.forEach(({ from, to }) => { out += src.slice(at, from) + src.slice(from, to).replace(/[^\n]/g, ' '); at = to; });
    src = out + src.slice(at);
  }
  const tokens = tokenize(src);
  const keys = keysFor(g, catalogue);
  const used = new Array(tokens.length).fill(false);
  const found = segment(tokens, keys).map((c) => ({ i: c.i, n: c.n, key: c.key, skills: [...c.key.skills], out: false, head: tokens[c.i + c.n - 1].head }));
  found.forEach((f) => { for (let j = 0; j < f.n; j += 1) used[f.i + j] = true; });
  const clauseOf = (f) => tokens[f.i].clause;
  const sentOf = (f) => tokens[f.i].sent;
  const lineOf = (f) => tokens[f.i].line;
  // exclusions: "בלי", "לא כולל" take out what follows in the clause; "לא יהיו" what follows, or else what came before
  tokens.forEach((t, i) => {
    for (const seq of EXCLUDE_AFTER) {
      if (!seqAt(tokens, i, seq)) continue;
      found.forEach((f) => { if (f.i > i && clauseOf(f) === t.clause) f.out = true; });
      for (let j = 0; j < seq.length; j += 1) used[i + j] = true;
    }
    for (const seq of EXCLUDE_ANY) {
      if (!seqAt(tokens, i, seq)) continue;
      const mine = found.filter((f) => f.key.any && clauseOf(f) === t.clause);
      const after = mine.filter((f) => f.i > i);
      (after.length ? after : mine).forEach((f) => { f.out = true; });
      for (let j = 0; j < seq.length; j += 1) used[i + j] = true;
    }
  });
  // each word's heading: the last heading before it on its line; and a topic named alone in its sentence, when the next
  // sentence names only its parts ("מבחן בסטטיסטיקה ביום א'. ממוצע, חציון, שכיח.")
  const parent = new Map();
  found.forEach((f) => {
    let h = null;
    for (const x of found) { if (x === f || x.i >= f.i) break; if (x.head && lineOf(x) === lineOf(f)) h = x; }
    if (h && !f.head) parent.set(f, h);
  });
  const named = found.filter((f) => f.key.any && !f.out);
  named.forEach((f) => {
    if (f.head || f.key.skills.length < 2 || named.some((x) => x !== f && sentOf(x) === sentOf(f))) return;
    const next = named.filter((x) => sentOf(x) > sentOf(f)).map(sentOf).sort((a, b) => a - b)[0];
    const kids = named.filter((x) => sentOf(x) === next && !parent.has(x));
    const own = topicsOf(f.key.skills);
    const adds = tokens.some((t) => t.sent === next && inSet(ADDS, t.w) >= 0);
    if (kids.length && !adds && kids.every((x) => x.key.skills.length && x.key.skills.every((s) => own.has(s.split(':')[0])))) {
      f.head = true;
      kids.forEach((x) => parent.set(x, f));
    }
  });
  const headOf = (f) => parent.get(f) || null;
  const children = (h) => found.filter((x) => parent.get(x) === h);
  // a word beside a word: "קובייה" in a sentence with "מטבע"
  found.forEach((f) => {
    const w = f.key.when;
    if (w && tokens.some((t, i) => !(i >= f.i && i < f.i + f.n) && t.sent === sentOf(f) && w.words.some((x) => wordFit(x, t.w) >= 2))) f.skills = [...w.skills];
  });
  // a word beside a topic: its heading, the list under it, its clause (and, wide, its sentence)
  const plain = (x) => !x.key.near && x.key.any;
  found.forEach((f) => {
    const near = f.key.near;
    if (!near) return;
    const around = (pred) => found.filter((x) => x !== f && plain(x) && !x.out && pred(x)).flatMap((x) => x.key.skills);
    const h = headOf(f);
    let ctx = [...(h ? h.key.skills : []), ...children(f).filter(plain).flatMap((x) => x.key.skills), ...around((x) => clauseOf(x) === clauseOf(f))];
    let hit = [...topicsOf(ctx)].filter((t) => near[t]);
    if (!hit.length && f.key.wide) { ctx = around((x) => sentOf(x) === sentOf(f)); hit = [...topicsOf(ctx)].filter((t) => near[t]); }
    if (hit.length) f.skills = [...new Set(hit.flatMap((t) => near[t]))];
  });
  const keepTopics = (f, topics) => { const kept = f.skills.filter((x) => topics.has(x.split(':')[0])); if (kept.length) f.skills = kept; };
  // under a heading: read inside the heading's topics when it can be
  found.forEach((f) => { const h = headOf(f); if (h) keepTopics(f, topicsOf(h.key.skills)); });
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
    // a prefix the key does not have (ו, ה, ב…) is not shown: "ויחס" is listed as "יחס", "וקובייה" as "קובייה"
    const k0 = f.key.words[0];
    const lead = first.w.length > k0.length && first.w.endsWith(k0) && wordFit(k0, first.w) === 3 ? rawPrefix(first.raw, k0) : 0;
    const piece = pieceOf(f.i, f.i + f.n - 1, lead);
    hits.push({ text: piece, skills: f.skills, out: f.out });
    f.skills.forEach((x) => (f.out ? outSkills : inSkills).add(x));
    // a topic word the grade has no stair for ("חזקות" in ח׳): listed, so the student can choose by hand
    if (f.key.any && !f.key.skills.length && !f.out) unknown.push(piece);
  });
  // what could not be placed: runs of words that are neither found nor said about the test, in one clause; a chapter or
  // a page always ("פרק 3"), other words only from a sentence about the material (a topic or a CUE word in it), or when
  // nothing at all was found
  const topicSents = new Set(found.filter((f) => f.key.any).map(sentOf));
  tokens.forEach((t) => { if (inSet(CUE, t.w) >= 0) topicSents.add(t.sent); });
  const anyFound = found.some((f) => f.key.any) || formulaSkills.length > 0;
  let run = null;
  const flush = () => {
    if (run && ((run.ref && run.num) || (run.content && (!anyFound || topicSents.has(tokens[run.from].sent))))) unknown.push(pieceOf(run.from, run.to, run.skip));
    run = null;
  };
  tokens.forEach((t, i) => {
    const ref = inSet(REF, t.w);
    const kind = used[i] ? 'used' : ref >= 0 ? 'ref' : NUM.test(t.w) ? 'num' : inSet(STOP, t.w) >= 0 || MATHY.test(t.w) || t.w.length < 2 ? 'stop' : 'content';
    if (run && t.clause !== tokens[run.to].clause) flush();
    if (kind === 'used' || kind === 'stop') { flush(); return; }
    if (kind === 'num' && !run) return; // a number alone (a date, a score) is not listed
    if (kind === 'ref' && run?.num) flush(); // "פרק 5 ופרק 6": two pieces
    if (!run) run = { from: i, to: i, content: false, ref: false, num: false, skip: kind === 'ref' ? rawPrefix(t.raw, t.w.slice(ref)) : 0 };
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

// ---------------------------------------------------------------- the pictures' way (EXAM-MATERIAL 1b), on the device
/**
 * What the request says about the pictures' preparation (trust spec TRUST-5 §2): the top band cut only when it was cut
 * on EVERY picture (the server counts it as the material's), and the blacked-out boxes of all of them.
 */
export const prepOf = (pages) => ({ crop: pages.length > 0 && pages.every((p) => p.prep?.crop), boxes: pages.reduce((n, p) => n + (p.prep?.boxes || 0), 0) });
/**
 * The helper's reading as the confirm screen shows it: only stairs of the grade's catalogue (in its order, grouped by
 * topic), and an example's stair only when it is one of them (else the example is shown with no stair). The Worker
 * checks the same; this is the device's own check, whatever a reply carries.
 */
export function fromSyllabus(r, catalogue) {
  const known = new Set(catalogue.map((c) => c.id));
  const ids = catalogue.map((c) => c.id).filter((id) => (r.stairs || []).includes(id));
  const byTopic = [];
  catalogue.forEach((c) => { if (!ids.includes(c.id)) return; let row = byTopic.find((x) => x.topic === c.topic); if (!row) { row = { topic: c.topic, title: c.topicTitle, skills: [] }; byTopic.push(row); } row.skills.push(c.id); });
  const examples = (r.examples || []).map((x) => ({ text: x.text, stair: known.has(x.stair) ? x.stair : '' }));
  return { skills: ids, byTopic, excluded: [], unknown: r.unplaced || [], examples, source: 'photo' };
}
