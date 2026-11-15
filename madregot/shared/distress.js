// The distress detector (trust spec TRUST-3 §3.1, Appendix G; widened in COUNCIL2-1/4). Shared by the Worker and the
// browser. It is its own file so that only the screens with the tutor (the assistant, a lesson, an exam's result) load
// it: shared/safety.js is in the app's first download, and this list is not needed there.
//
// This file ships to the browser. Vite targets Safari 16.0, which has no regex lookbehind, and a lookbehind literal
// stops the whole chunk from loading there: a Hebrew word start is written (?:^|[^א-ת]) and a word end (?![א-ת]).
// worker/test/safety.test.js fails on a lookbehind anywhere in shared/.
import { normalize } from './safety.js';
import { TOPIC_NAMES, STAIR_NAMES, NOT_YET } from './stairs.js';

// ---------------------------------------------------------------- the distress detector (trust spec Appendix G)
// Widened in COUNCIL2-1/4: suicidal thoughts, plans, self-harm, fear of an adult at home, threats and sextortion,
// running away, not eating, loneliness. Every family below names the category it is counted under (the safety log's
// `category`); each one opens the same support card, with ער״ן 1201, סה״ר, 105, 100 and 101:
//   self_harm  suicidal thoughts (אובדני*, "לישון ולא להתעורר", "אין לי בשביל מה לחיות", "לגמור עם הכל", "אני לא שווה
//              כלום"), a plan (jumping from a roof or a window, taking all the pills), cutting or hurting oneself
//   abuse      someone hits or touches the child, fear of a parent or of an adult at home, not wanting to go home
//   danger     requests for pictures, threats by message, sextortion ("שלחתי תמונה ועכשיו הוא מאיים", "יפרסם את
//              התמונות"), secrets with an adult, meeting someone from the internet
//   bullying   boycott, mockery, "כולם בכיתה שונאים אותי"
//   distress   sadness, crying, loneliness, emptiness, running away from home, not eating
// False positives are the main risk: a word that is also maths ("לקפוץ" on a number line or in a lift, "ליפול" for a
// falling stone, "כדורים" in a bag, "לא שווה" for ≠, "חותך" for a line that cuts an axis, "נוגע" for a tangent) flags
// only with a first person or an intent beside it, and never in a sentence that reads as a word problem (CTX below).
// worker/test/safety.test.js holds 280 phrases that must flag and the sentences that must not; web/src/learn/
// distress.test.ts runs every teaching step, a sample of every generator and a child's question about every word-problem
// setting through the detector.
//
// Three more things the detector says (distressDetail), for the adult's alert (worker/src/alerts.js):
//   categories  every category the message matched, not only the most serious one
//   home        the message is about home: an abuse rule matched, or it names a parent or the home. Then a parent is
//               never the one who is told.
//   sure        a rule marked `sure` matched: a plain statement of suicide or self-harm, never a word that is also
//               maths or slang. Only then is anyone alerted.
// A word list is never complete: readsPersonal(text) says that a message is not about maths at all (no digit, no maths
// or study word), so a screen that cannot send it to the tutor shows the support card all the same.
const B = '(?:^|[^א-ת])'; // a Hebrew word starts here (no lookbehind: the group takes the character before it)
const P = `${B}[ושהלבכמ]?`; // ... and may carry one prefix letter (ו ש ה ל ב כ מ)
const E = '(?![א-ת])'; // a Hebrew word ends here
const he = (x) => `${P}(?:${x})${E}`;
/** The sentence ends here: nothing but punctuation follows. */
const END = '(?=\\s*[.!?,;:)]|\\s*$)';
/** Someone wants or plans to (I, he, she, they): "רוצה", "בא לי", "חושבת", "הולך", "מתכננים". */
const WANT = '(?:רוצה|רוצים|רוצות|בא לי|מתחשק לי|חושב|חושבת|חושבים|מתכנן|מתכננת|מתכננים|הולך|הולכת|הולכים|עומד|עומדת|מתכוון|מתכוונת)';

/**
 * Final letters (ךםןףץ) as their ordinary form: a phone keyboard, or a child in a hurry, types "חיימ" for "חיים". The
 * text and every pattern are folded the same way before they meet, so a pattern is written in ordinary spelling.
 */
const FINALS = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };
const fold = (s) => s.replace(/[ךםןףץ]/g, (c) => FINALS[c]);

/**
 * Maths frustration: a distress or bullying match whose complaint is about maths ("אני לא יכול יותר עם השברים", "...
 * מהשאלה הזאת", "..., התרגיל הזה") is not distress. The maths word must be the object of the complaint: right after the
 * match, alone or after "עם", "על" or "מ". A maths word that only says where or since when it happens ("צוחקים עליי
 * בשיעור מתמטיקה", "עושים לי חרם מאז המבחן", "... בגלל המבחן") never drops the match. The words: the app's own topic
 * and stair names (shared/stairs.js, also the ones not taught yet), whole, and the maths nouns below in the singular
 * and the plural. A word with an everyday meaning ("בעיות", "מערכת", "נקודה") is not on the list: there it is not maths.
 */
const MATHS_NOUNS = [
  'תרגיל', 'תרגילים', 'שאלה', 'שאלות', 'מבחן', 'מבחנים', 'בוחן', 'בחנים', 'שיעורי בית', 'שיעורי הבית', 'מתמטיקה', 'חשבון',
  'שבר', 'שברים', 'אחוז', 'אחוזים', 'חזקה', 'חזקות', 'שורש', 'שורשים', 'משוואה', 'משוואות', 'נוסחה', 'נוסחאות', 'נעלם',
  'נעלמים', 'גאומטריה', 'גיאומטריה', 'אלגברה', 'הנדסה', 'זווית', 'זוויות', 'משולש', 'משולשים', 'גרף', 'גרפים', 'ביטוי',
  'ביטויים', 'פונקציה', 'פונקציות', 'שיפוע', 'ממוצע', 'חציון', 'שכיח', 'סטטיסטיקה', 'הסתברות', 'פיתגורס', 'מספרים מכוונים',
  'מכוונים', 'מספרים שליליים', 'שליליים', 'סוגריים', 'כפל', 'חילוק', 'חיבור', 'חיסור', 'מכנה', 'מונה', 'עשרוני', 'עשרוניים',
  'אי-שוויון', 'אי-שוויונים', 'טבלה', 'צירים', 'מלבן', 'יחס', 'פרופורציה', 'ציון', 'ציונים',
];
const MATHS_PHRASES = [
  ...MATHS_NOUNS,
  ...Object.values(TOPIC_NAMES), ...Object.values(STAIR_NAMES), ...Object.values(NOT_YET).flat(),
].map((w) => fold(normalize(w)).replace(/[?()]/g, '').trim()).filter((w) => w.length >= 2);
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const MATHS_ALT = [...new Set(MATHS_PHRASES)].sort((a, b) => b.length - a.length).map(escRe).join('|');
/** Right after the match: the maths word itself, or "עם", "על" or "מ" and then it (one more word may stand between). */
const MATHS = new RegExp(fold(`^[\\s,.:;!-]*(?:(?:עם|על)\\s+(?:[^\\s]+\\s+)?|מ)?(?:ה)?(?:${MATHS_ALT})(?![א-ת])`));
/** ... and for loneliness and sadness also "ב": "אני ממש לבד בתרגיל הזה" is about the exercise. */
const MATHS_IN = new RegExp(fold(`^[\\s,.:;!-]*(?:(?:עם|על)\\s+(?:[^\\s]+\\s+)?|[מב])?(?:ה)?(?:${MATHS_ALT})(?![א-ת])`));
/** How far the "killing me" rule looks for a word about home. */
const MATHS_WINDOW = 25;
/** What firstMatch reads after a match: enough for "עם כל" and a two-word maths name. */
const AFTER_WINDOW = 40;
/** "Dying of laughter" is not a wish to die. */
const LAUGHING = /^\s*מ?צחוק/;
/** "הוא איים עליי בצחוק": said as a joke (rules marked joke: true). */
const JOKE = new RegExp(fold('^[^.?!\\n]{0,14}?(?:^|[^א-ת])(?:ב?צחוק|בצחוקים|בקטע של צחוק)(?![א-ת])'));
/** "אני לא יכול יותר, זה קשה מדי": the complaint is about the task in front of the child (rules marked hard: true). */
const HARD = new RegExp(fold('^[\\s,.:;!-]*(?:זה|זו|זאת|התרגיל|השאלה)\\s+(?:ממש\\s+|כל כך\\s+|נורא\\s+|פשוט\\s+)?(?:קשה|מסובך|מסובכת|ארוך|ארוכה|מבלבל|מבלבלת)(?:\\s+(?:לי\\s+)?(?:מדי|מידי))?\\s*(?:[.!?]|$)'));
/** "אמא אמרה שתהרוג אותי אם אכשל במבחן": a way of speaking about a grade, not a threat (rules marked ifSchool: true). */
const IF_SCHOOL = new RegExp(fold(`^[^.?!\\n]{0,20}?(?:^|[^א-ת])אם[^.?!\\n]{0,40}?(?:^|[^א-ת])[בהלמ]?(?:ה)?(?:${MATHS_ALT}|אכשל|איכשל|נכשל|נכשלתי|שיעורים)(?![א-ת])`));
/**
 * Words that say the sentence is a word problem: a lift between floors, a falling ball, a bag of coloured balls, a line
 * and an axis, a question that asks how many. Rules marked ctx: true never match in a sentence with one of them (or
 * with one of the maths words above); ctxDigit: true also never in a sentence with a digit.
 */
const CTX_WORDS = [
  'כמה', 'מעלית', 'מעליות', 'לקומה', 'קומות', 'ציר', 'צירים', 'נקודה', 'נקודת', 'נקודות', 'הסתברות', 'סיכוי', 'סיכויים', 'שניות', 'שנייה',
  'מטר', 'מטרים', 'ס"מ', 'ק"מ', 'מהירות', 'גובה', 'משיק', 'מעגל', 'בשק', 'בשקית', 'בסל', 'בכד', 'אדומים', 'כחולים', 'ירוקים', 'צהובים', 'לבנים',
  'שחורים', 'חשבו', 'מצאו', 'פתרו', 'ההפרש', 'לחלק',
];
const CTX = new RegExp(fold(`(?:^|[^א-ת])[ובהלמשכ]?(?:ה)?(?:${CTX_WORDS.map(escRe).join('|')}|${MATHS_ALT})(?![א-ת])`));
/** The sentence around a match: from the sentence mark before it to the one after it. */
function sentenceAt(text, from, to) {
  let a = from; let b = to;
  while (a > 0 && !'.!?\n'.includes(text[a - 1])) a -= 1;
  while (b < text.length && !'.!?\n'.includes(text[b])) b += 1;
  return text.slice(a, b);
}
/** The sentence starts here (rules that need "אני" as the subject of its own sentence). */
const START = '(?:^|[.!?,;:\\n])\\s*(?:ו|אז\\s+|כי\\s+|גם\\s+|וגם\\s+)?';

/** Someone asks (he, she, they; past and present), as the danger rules start. */
const ASK = `${P}(?:ביקש|ביקשה|מבקש|מבקשת|מבקשים|ביקשו|דורש|דורשת)`;
/** ... or wants the child to ("רוצה שאשלח לו תמונה": a child who wants to send a picture is not in danger). */
const ASK_THAT = `${P}(?:ביקש|ביקשה|מבקש|מבקשת|מבקשים|ביקשו|דורש|דורשת|רוצה|רוצים)`;
/** School work a picture can be of: a picture of these is about maths, not about the child. */
const SCHOOL_NOUNS = '(?:מחברת|מחברות|דף|דפים|תרגיל|תרגילים|פתרון|פתרונות|גרף|גרפים|משולש|משולשים|נקודה|נקודות|צורה|צורות|שאלה|לוח|מבחן)';
/**
 * Right after a photo request: a piece of school work or a transformation ("תמונה של הדף", "...של המשולש אחרי שיקוף").
 * Then the request is about maths, not about the child (danger rules marked school: true).
 */
const SCHOOL = new RegExp(fold(`^[^\\s.,!?]*\\s*(?:[^\\s.,!?]+\\s+)?(?:של\\s+(?:ה)?${SCHOOL_NOUNS}(?![א-ת])|.{0,30}?(?:^|[^א-ת])[בלו]?(?:שיקוף|הזזה|סיבוב)(?![א-ת]))`));
/** People at home, as "מפחדת מ..." names them. */
const HOME = '(?:אבא|אמא|אבי|אמי|הורים|הוריי|אח|אחי|אחות|אחותי|אחים|דוד|דודה|סבא|סבתא|השכן|שכן|מבוגר|מטפל|מטפלת|בייביסיטר|בייביסיטרית|בעל של אמא|חבר של אמא|חברה של אבא|אבא החורג|אמא החורגת|אב חורג|אם חורגת|אבא חורג|אמא חורגת)';
/** A person does it (he, she, someone, a relative, an adult the child knows): the subject of some abuse rules. */
const PERSON = `(?:הוא|היא|הם|מישהו|מישהי|המורה|המאמן|המדריך|${HOME}(?:\\s+שלי)?)`;
/**
 * The message names a parent, another adult at home or the home itself (distressDetail's `home`). "אחי" alone is not
 * on it: it is also how children say "bro".
 */
const HOME_NAMED = '(?:אבא|אמא|אבי|אמי|הורים|הוריי|אבא החורג|אמא החורגת|אב חורג|אם חורגת|אבא חורג|אמא חורגת|חבר של אמא|בעל של אמא|חברה של אבא|אשתו של אבא|דוד|דודה|סבא|סבתא|אח שלי|אחות שלי|אחי הגדול|אחותי|בבית|הביתה|מהבית|בית שלי)';
/** Parts of the body someone touches: "נוגע לי ב..." (never "נוגע לי בלב"). */
const BODY = '(?:גוף|מקומות|מקום פרטי|חזה|ישבן|תחת|רגל|רגליים|ירך|ירכיים|איבר|איברים|בטן|שדיים)';
/** Where a stranger is met online. */
const ONLINE = "(?:אינטרנט|אינסטגרם|אינסטה|טיקטוק|רשת|וואטסאפ|ווטסאפ|סנאפ|סנאפצ'ט|דיסקורד|רובלוקס|פורטנייט|מיינקראפט|צ'אט|טלגרם|פייסבוק|יוטיוב|אפליקציה)";
/** A picture of the child. */
const PICS = '(?:תמונה|תמונות|סרטון|סרטונים)';
/** A threat to spread it, or a demand ("publish" alone is not one: a teacher publishes the trip's photos). */
const THREAT = '(?:מאיים|מאיימת|מאיימים|איים|איימה|איימו|יפיץ|תפיץ|יפיצו|ישלח לכולם|תשלח לכולם|יראה לכולם|תראה לכולם|סוחט|סוחטת|סוחטים|רוצה כסף|דורש כסף|רוצה עוד תמונות|מבקש עוד תמונות|מבקשת עוד תמונות)';

/**
 * Each rule: a category, a pattern over the folded text, and `maths: true` when maths frustration right after the
 * match drops it (the categories distress and bullying, and the slang patterns; `mathsIn: true` also takes "ב").
 * Self-harm, abuse and danger are never dropped for maths words: "בא לי למות מהמבחן הזה" still gets the card, by
 * design. The one exception is `school: true` on the photo-request rules: a request for a picture of a page, an
 * exercise or a shape is about school work.
 */
const RULES = [
  // self_harm: a wish to die
  { cat: 'self_harm', re: he(`${WANT}\\s+(?:ל)?(?:מות|למות|לימות|למוות|להתאבד|לגמור עם (?:ה)?חיים|לגמור עם עצמי)`), laugh: true, sure: 'plain' },
  { cat: 'self_harm', re: he(`${WANT}\\s+להיעלם(?: מהעולם)?`), laugh: true },
  { cat: 'self_harm', re: he('להתאבד|התאבדות|אתאבד|מתאבד|מתאבדת|מתאבדים|התאבדתי|להתעבד|להתאבת'), sure: true },
  // "אני רוצה להרוג את עצמי", "אני אהרוג את עצמי" (never "התרגיל הזה הורג אותי")
  { cat: 'self_harm', re: he('(?:להרוג|אהרוג|הורג|הורגת|נהרוג|הרגתי|לרצוח)\\s+את\\s+עצמי'), sure: true },
  // אובדני*: "מחשבות אובדניות", "אני אובדנית", "נטיות אובדניות", also "אבדניות"
  { cat: 'self_harm', re: he('או?בדנ(?:י|ית|יות|יים|ות)'), sure: true },
  { cat: 'self_harm', re: he('(?:מחשבות|חושב|חושבת|חושבים|חושבות)\\s+על\\s+(?:ה)?(?:מוות|למות|התאבדות|לא להיות|לגמור עם (?:ה)?(?:חיים|הכל|הכול)|לסיים את (?:ה)?חיים)'), sure: true },
  // "לישון ולא להתעורר", "להירדם ולא לקום יותר", "לישון לנצח"
  { cat: 'self_harm', re: he('(?:לישון|להירדם|לנמנם)\\s+ו?(?:לא|בלי)\\s+(?:להתעורר|לקום)|(?:לישון|לנוח)\\s+לנצח|ללכת לישון לתמיד'), sure: true },
  // "אני לא רוצה להתעורר מחר", "הלוואי שלא אתעורר" (but "...להתעורר מחר מוקדם" is about an alarm clock)
  { cat: 'self_harm', re: `${he('לא\\s+(?:רוצה|רוצים|רוצות)\\s+להתעורר\\s+(?:מחר|יותר|אף פעם|לעולם|בכלל)')}(?!\\s+(?:מוקדם|ב[0-9א-ת]|ל(?:בית|מבחן|בחינה|טיול)))` },
  { cat: 'self_harm', re: he('ש(?:אני\\s+)?לא\\s+אתעורר') },
  // "אני מקווה שלא אקום מחר" (never "...שלא אקום מאוחר")
  { cat: 'self_harm', re: `${he('ש(?:אני\\s+)?לא\\s+אקום\\s+(?:מחר|בבוקר|יותר|בכלל|אף פעם|לעולם)')}(?!\\s+(?:מאוחר|מוקדם|ב[0-9א-ת]))` },
  // "אין לי בשביל מה לחיות", "אין לי למה לקום בבוקר"
  { cat: 'self_harm', re: he(`אין(?:\\s+לי)?\\s+(?:בשביל מה|בשביל מי|למה|סיבה|שום סיבה)\\s+(?:לחיות|להמשיך לחיות|לקום בבוקר|(?:להמשיך|לקום)${END})`), sure: true },
  { cat: 'self_harm', re: he('(?:למה|בשביל מה)\\s+(?:אני\\s+)?(?:בכלל\\s+)?(?:חי|חיה|קיים|קיימת)') + END },
  // "לגמור עם החיים", "לשים סוף לחיים", "לסיים את החיים"
  { cat: 'self_harm', re: he('(?:לגמור|לסיים)\\s+(?:עם|את)\\s+(?:ה)?חיים(?:\\s+שלי)?|לשים\\s+(?:קץ|סוף)\\s+ל(?:ה)?חיים'), sure: true },
  // "בא לי לגמור עם הכל" (never "...עם הכל עד מחר", homework)
  { cat: 'self_harm', re: `${he(`${WANT}\\s+(?:ל)?(?:גמור|סיים)\\s+(?:עם|את)\\s+(?:הכל|הכול|כל זה|זה)`)}(?!\\s+(?:היום|עד|כבר|מהר|לפני|ואז|כדי|ו?ל(?:צאת|הגיש|לכת|נוח|שחק)|ב(?:שיעורי|זמן|בית)|של))` },
  // "אני לא שווה כלום", "...שאני לא שווה" (a first person: "x לא שווה 3" is ≠)
  { cat: 'self_harm', re: he(`אני\\s+(?:פשוט\\s+|בכלל\\s+|ממש\\s+|באמת\\s+|כבר\\s+)?לא\\s+(?:שווה|שווים|שוות)(?:\\s+(?:כלום|שום דבר|לחיות)|${END})`) },
  { cat: 'self_harm', re: he('(?:ה)?חיים\\s+שלי\\s+(?:לא\\s+(?:שווים|שווה)(?:\\s+כלום)?|חסרי\\s+(?:טעם|ערך))') },
  { cat: 'self_harm', re: he('(?:לא רוצה|לא רוצים)\\s+(?:לחיות|להמשיך לחיות)|אין לי (?:טעם|סיבה)\\s+(?:לחיות|להמשיך לחיות)'), sure: true },
  // "אני לא רוצה להיות בחיים", "לא רוצה להיות פה יותר", "לא רוצה להיות קיימת"
  { cat: 'self_harm', re: he('(?:לא רוצה|לא רוצים)\\s+להיות\\s+(?:בחיים|פה|כאן|קיים|קיימת|בעולם)') },
  // "אני רוצה לא להיות", "אני מתה לא להיות פה"
  { cat: 'self_harm', re: he(`(?:${WANT}|מעדיף|מעדיפה|מת|מתה)\\s+(?:פשוט\\s+)?לא\\s+להיות(?:\\s+(?:פה|כאן|יותר|בעולם|קיים|קיימת)(?:\\s+יותר)?)?${END}`) },
  { cat: 'self_harm', re: he('אין לי (?:כוח|כח)\\s+(?:יותר\\s+)?(?:לחיות|לחיים|להמשיך לחיות)') },
  // "הלוואי שאמות", "הלוואי שהייתי מת/ה", "הלוואי שלא הייתי נולד/ת", "הלוואי שלא הייתי קיים/ת"
  { cat: 'self_harm', re: he('הלוואי\\s+(?:ו)?ש(?:אמות|הייתי\\s+(?:מת|מתה)|לא\\s+(?:הייתי\\s+(?:נולד|נולדת|קיים|קיימת)|נולדתי)|אני\\s+(?:אמות|מת|מתה))'), sure: true },
  { cat: 'self_harm', re: he('נמאס לי (?:מהחיים|לחיות)|אין טעם (?:לחיות|לחיים)|עדיף (?:שאמות|שאני אמות|לי למות|שלא הייתי נולד|שלא הייתי נולדת)|כולם יהיו (?:בסדר|יותר טוב) (?:בלעדיי|בלעדי)|(?:טוב|עדיף) (?:להם|לכולם) בלעדיי') },
  // "מתי אני כבר אמות"
  { cat: 'self_harm', re: he('מתי\\s+(?:אני\\s+)?(?:כבר\\s+)?(?:אמות|אני מת|אני מתה)') },
  { cat: 'self_harm', re: he('מכתב\\s+התאבדות|להיפרד\\s+מכולם\\s+לתמיד|מנת\\s+יתר'), sure: true },
  // "אני אעשה לעצמי משהו", "בא לי לעשות לעצמי משהו רע" (never "אעשה לעצמי משהו לאכול")
  { cat: 'self_harm', re: `${he('(?:לעשות|אעשה|עושה|עשיתי)\\s+לעצמי\\s+משהו(?:\\s+רע)?')}(?!\\s+(?:לאכול|לשתות|טעים|קטן|חם|קר|טוב|יפה|נחמד|חדש))` },
  // a plan: jumping from a roof, a window, a bridge, or in front of a train. "לקפוץ" and "ליפול" are also a lift and a
  // falling stone, so they need a person who wants it ("אני", "בא לי", "הולכת"), a first-person verb ("אקפוץ"), or to
  // be the whole message ("לקפוץ מהגג"); a floor ("קומה") only outside a word problem.
  { cat: 'self_harm', re: he(`(?:אני|אנחנו|${WANT})\\s+(?:פשוט\\s+|כבר\\s+|עכשיו\\s+)?(?:לקפוץ|ליפול|לזרוק את עצמי)\\s+(?:מ(?:ה)?|מעל\\s+(?:ה)?|מן\\s+(?:ה)?)(?:גג|חלון|בניין|בנין|מרפסת|גשר|צוק)`), sure: true },
  { cat: 'self_harm', re: he(`(?:אני|אנחנו|${WANT})\\s+(?:פשוט\\s+|כבר\\s+|עכשיו\\s+)?(?:לקפוץ|ליפול|לזרוק את עצמי)\\s+מ(?:ה)?קומה`), ctx: true },
  { cat: 'self_harm', re: he('(?:אקפוץ|נקפוץ|קפצתי|אזרוק את עצמי|זרקתי את עצמי|אפול)\\s+(?:מ(?:ה)?|מעל\\s+(?:ה)?|מן\\s+(?:ה)?)(?:גג|חלון|בניין|בנין|מרפסת|גשר|קומה|צוק)'), ctx: true },
  { cat: 'self_harm', re: fold('^\\s*(?:פשוט\\s+)?(?:לקפוץ|לזרוק את עצמי)\\s+מ(?:ה)?(?:גג|חלון|בניין|בנין|מרפסת|גשר|צוק)\\s*[.!]*\\s*$') },
  { cat: 'self_harm', re: he(`(?:על|ב)\\s*(?:ה)?(?:גג|מרפסת|גשר|חלון)${E}[^.?!]{0,30}?${WANT}\\s+לקפוץ`) },
  { cat: 'self_harm', re: he('אני\\s+(?:קופץ|קופצת)\\s+(?:מ(?:ה)?|מעל\\s+(?:ה)?)(?:גג|חלון|בניין|בנין|מרפסת|גשר|צוק)') },
  { cat: 'self_harm', re: he('(?:לקפוץ|לזרוק את עצמי|אקפוץ|אזרוק את עצמי)\\s+(?:מתחת ל|לפני|מול)(?:ה)?(?:רכבת|אוטו|אוטובוס|מכונית|משאית)'), ctx: true },
  { cat: 'self_harm', re: he(`(?:אני|${WANT})\\s+(?:לשכב|לעמוד)\\s+(?:מתחת ל|לפני|מול|על\\s+(?:ה)?(?:פסים|מסילה|כביש))(?:ה)?(?:רכבת|אוטו|אוטובוס|מכונית|משאית)?`), ctx: true },
  // pills: swallowing them, sleeping pills, or "all of them" with a first person ("כדורים" alone is a word problem)
  { cat: 'self_harm', re: he('(?:לבלוע|אבלע|בולע|בולעת|בלעתי)\\s+(?:את\\s+)?(?:כל|הרבה|קופסת|קופסה של|חבילת|חבילה של|בקבוק)\\s+(?:ה)?(?:כדורים|תרופות)'), sure: true },
  { cat: 'self_harm', re: he('(?:לקחת|אקח|לקחתי|לוקח|לוקחת|לבלוע|בלעתי)\\s+(?:[^\\s]+\\s+){0,2}?(?:כדורי\\s+(?:שינה|הרגעה)|את כל (?:ה)?תרופות)') },
  { cat: 'self_harm', re: he('(?:לקחתי|אקח|בלעתי|אבלע)\\s+(?:[^\\s]+\\s+)?הרבה\\s+(?:כדורים|תרופות)') },
  // "בלעתי 20 כדורים" (swallowing is never a word problem; "לקחתי 20 כדורים מהשק" is one)
  { cat: 'self_harm', re: he('(?:בלעתי|אבלע|לבלוע|בולע|בולעת)\\s+(?:[0-9]+|עשרה|עשרים|שלושים|ארבעים|חמישים|מלא|המון|חופן)\\s+(?:כדורים|תרופות|אקמול|אקמולים|אופטלגין|נורופן)'), sure: true },
  { cat: 'self_harm', re: he('(?:לקחתי|אקח)\\s+(?:[0-9]+|עשרה|עשרים|שלושים|מלא|המון)\\s+(?:כדורי\\s+(?:שינה|הרגעה)|אקמול|אקמולים|אופטלגין|נורופן)') },
  // "שתיתי אקונומיקה", "לשתות רעל"
  { cat: 'self_harm', re: he('(?:שתיתי|אשתה|לשתות|שותה|בלעתי|אבלע|לבלוע)\\s+(?:[^\\s]+\\s+)?(?:אקונומיקה|רעל|חומר ניקוי|חומרי ניקוי|מלבין|נפט|חומצה)'), sure: true },
  { cat: 'self_harm', re: `${he('(?:אני\\s+' + WANT + '\\s+(?:ל)?קחת|(?:בא|מתחשק) לי לקחת|אקח|לקחתי)\\s+(?:את\\s+)?כל\\s+(?:ה)?(?:כדורים|תרופות)')}(?!\\s+(?:מ|ל|אל)[א-ת])`, ctx: true },
  { cat: 'self_harm', re: `${he('יש לי')}\\s+(?:[^\\s]+\\s+){0,2}?(?:ה)?(?:כדורים|תרופות|כדורי)[^.?!]{0,40}?${WANT}\\s+(?:ל)?(?:קחת|בלוע)\\s+(?:את\\s+)?(?:כולם|כולן|הכל|הכול)${E}(?!\\s+(?:ל|אל|מ)[א-ת])`, ctx: true },
  // cutting or hurting oneself
  { cat: 'self_harm', re: he('(?:לפגוע|פוגע|פוגעת|פגעתי|אפגע|פוגעים)\\s+ב?עצמי|פגיעה\\s+עצמית'), sure: true },
  { cat: 'self_harm', re: he('(?:לחתוך|חותך|חותכת|חתכתי|חותכים)\\s+(?:את\\s+)?(?:עצמי|הידיים|היד|הרגליים|הרגל|הורידים|ורידים)'), sure: true },
  // "חותכת לעצמי את היד", "חתכתי לעצמי"
  { cat: 'self_harm', re: he('(?:לחתוך|חותך|חותכת|חתכתי|אחתוך)\\s+לעצמי'), sure: true },
  // "אני עושה לעצמי חתכים"
  { cat: 'self_harm', re: he('(?:עושה|עשיתי|לעשות|אעשה)\\s+(?:לעצמי\\s+)?חתכים|חתכים\\s+לעצמי') },
  // "מתחשק לי לחתוך" alone, or "...שוב" (never "לחתוך את המשולש", and never in a sentence about a line or a shape)
  { cat: 'self_harm', re: he(`(?:בא לי|מתחשק לי|אני\\s+${WANT}|${WANT}\\s+שוב)\\s+(?:שוב\\s+)?(?:לחתוך|להיחתך)(?:${END}|\\s+(?:שוב|עוד פעם|בסתר))`), ctx: true },
  // "אני חותכת" as a sentence of its own (never "איפה אני חותך?", "באיזו נקודה אני חותכת?": a line that cuts an axis)
  { cat: 'self_harm', re: `${fold(START)}אני\\s+(?:חותכ|חותכת)(?:\\s+(?:שוב|כבר|לפעמים|בסתר))?${END}`, ctx: true },
  // "יש לי חתכים על היד", "חתכים בידיים"
  { cat: 'self_harm', re: he('חתכים\\s+(?:על\\s+(?:ה)?|ב(?:ה)?)(?:יד|ידיים|רגל|רגליים|גוף|זרוע|זרועות|ירכיים|בטן)') },
  { cat: 'self_harm', re: he('(?:לשרוט|שורט|שורטת|שרטתי|לשרוף|שורף|שורפת|שרפתי|להכאיב|מכאיב|מכאיבה|הכאבתי|להעניש|מעניש|מענישה|להרביץ|מרביץ|מרביצה|הרבצתי|לחנוק|לתלות|אתלה|לדקור|לירות|להזיק|מזיק|מזיקה|אזיק)\\s+(?:את\\s+|ב)?(?:ל)?עצמי'), sure: true },
  { cat: 'self_harm', re: '\\b(?:kill myself|killing myself|suicid\\w*|want to die|wanna die|self[- ]?harm|hurt myself|hurting myself|cut myself|cutting myself|wish i was dead|wish i were dead|unalive|end it all|end my life|no reason to live|better off dead|overdose)\\b', sure: true },
  { cat: 'self_harm', re: '(?:^|[^0-9\\s])\\s*\\bkms\\b' },
  { cat: 'self_harm', re: "\\b(?:don'?t|do not)\\s+want\\s+to\\s+(?:live|be alive|wake up)\\b" },
  // abuse
  { cat: 'abuse', re: he('(?:מרביץ|מרביצה|מרביצים|הרביץ|הרביצה|הרביצו)\\s+לי') },
  { cat: 'abuse', re: he('(?:מכה|מכים|היכה)\\s+אותי|(?:מרביץ|מרביצה|מכה|הרביץ|הרביצה|היכה)\\s+(?:ל|את\\s+)(?:אמא|אבא|אחי|אחותי|האחים שלי)') },
  // "נוגע בי", "נוגע לי בגוף", "נוגע לי במקומות פרטיים", "הוא נגע בגוף שלי" (never "המשיק נוגע בגוף בנקודה אחת")
  { cat: 'abuse', re: he(`(?:נוגע|נוגעת|נוגעים|נגע|נגעה|נגעו)\\s+(?:בי|לי\\s+ב(?:ה)?${BODY}|ב(?:ה)?(?:גוף|מקומות)\\s+(?:שלי|(?:ה)?פרטיים|(?:ה)?אינטימיים))`) },
  { cat: 'abuse', re: he(`${PERSON}\\s+(?:[^\\s.?!,]+\\s+)?(?:נוגע|נוגעת|נוגעים|נגע|נגעה|נגעו)\\s+ב(?:ה)?(?:גוף|מקומות)`) },
  { cat: 'abuse', re: he('(?:הכריח|הכריחה|הכריחו|מכריח|מכריחה|מכריחים|ביקש|ביקשה|מבקש|מבקשת)\\s+(?:אותי|ממני)\\s+לגעת\\s+(?:בו|בה|בהם|לו|לה)') },
  // the gravest assault: the verb and the noun in every form. Two of them are on the blocklist (shared/blocklist.js),
  // and no line the app ships may hold a blocklist word whole, so the pattern is written in parts.
  { cat: 'abuse', re: he('נ?אנס(?:ה|ו|תי)?|[לי]אנו[ס]|א[וי]נו?[ס]') },
  // "נותן לי מכות", "חוטף מכות", "מקבלת מכות"
  { cat: 'abuse', re: he('(?:נותן|נותנת|נותנים|נתן|נתנה|נתנו)\\s+לי\\s+מכות|(?:חוטף|חוטפת|חוטפים|חטפתי|מקבל|מקבלת|מקבלים|קיבלתי)\\s+מכות') },
  // "אבא שלי שותה ומרביץ", "אבא מרביץ" (with no object: the person at home is the subject)
  { cat: 'abuse', re: he(`${HOME}\\s+(?:שלי\\s+)?(?:[^\\s.?!,]+\\s+ו)?(?:מרביץ|מרביצה|מרביצים)`) },
  // "אבא שלי חונק אותי", "הוא בעט בי"
  { cat: 'abuse', re: he(`${PERSON}\\s+(?:[^\\s.?!,]+\\s+)?(?:חונק|חונקת|חונקים|חנק|חנקה)\\s+אותי|(?:בועט|בועטת|בועטים|בעט|בעטה|בעטו|סוטר|סוטרת|סטר|סטרה)\\s+(?:בי|לי)`) },
  // a threat to kill: "אמא אמרה שהיא תהרוג אותי", "אבא מאיים שיהרוג אותי" (never "...אם אכשל במבחן", a way of speaking)
  { cat: 'abuse', re: he('(?:מאיים|מאיימת|מאיימים|איים|איימה|איימו|אמר|אמרה|אמרו|אומר|אומרת|אומרים|נשבע|נשבעה)\\s+(?:לי\\s+)?ש(?:הוא\\s+|היא\\s+|הם\\s+)?(?:יהרוג|תהרוג|יהרגו|ירצח|תרצח|ירצחו)\\s+אותי'), ifSchool: true },
  { cat: 'abuse', re: he('התעלל|מתעלל|מתעללת|התעללות|התעללו') },
  { cat: 'abuse', re: he('(?:פגע|פוגע|פגעה)\\s+בי\\s+מינית|(?:הטריד|מטריד|הטרידה)\\s+אותי|הטרדה מינית') },
  { cat: 'abuse', re: he('(?:פוגעים|פגעו)\\s+בי|(?:הוא|היא|מישהו|מישהי|אבא|אמא|אחי|אחותי|הדוד)\\s+(?:[^\\s]+\\s+)?(?:פוגע|פוגעת|פגע|פגעה)\\s+בי') },
  { cat: 'abuse', re: he('(?:מפחד|מפחדת|מפחדים|פוחד|פוחדת)\\s+(?:ללכת|לחזור|להיות|לישון|להישאר|להשאר)\\s+(?:ב)?(?:הביתה|בית|הבית|בבית)') },
  // fear of a parent or an adult at home: "אני פוחדת מאבא שלי", "מפחד מהחבר של אמא"
  { cat: 'abuse', re: he(`(?:פוחד|פוחדת|פוחדים|מפחד|מפחדת|מפחדים|חושש|חוששת|מפוחד|מפוחדת|נבהל|נבהלת)\\s+(?:(?:מאוד|נורא|ממש|כל כך|כל הזמן)\\s+)?מ(?:ה)?${HOME}`) },
  { cat: 'abuse', re: he('(?:פוחד|פוחדת|מפחד|מפחדת)\\s+(?:ש|כש)(?:אבא|אמא|הוא|היא|הם)\\s+(?:ירביץ|תרביץ|ירביצו|יכה|תכה|יכו|יפגע|תפגע|יפגעו)') },
  { cat: 'abuse', re: he('(?:צועק|צועקת|צועקים|צורח|צורחת|צורחים)\\s+(?:עליי|עלי)') + '[^.?!]{0,40}?' + he('(?:פוחד|פוחדת|מפחד|מפחדת|מפחדים|רועד|רועדת)') },
  { cat: 'abuse', re: he(`${HOME}\\s+(?:שלי\\s+)?(?:צועק|צועקת|צועקים|צורח|צורחת|צורחים)\\s+(?:עליי|עלי)\\s+(?:כל הזמן|כל יום|כל היום|כל ערב|כל לילה|כל פעם|בלי סוף)`) },
  { cat: 'abuse', re: he('(?:נועל|נועלת|נועלים|נעל|נעלה|סוגר|סוגרת|סוגרים)\\s+אותי\\s+(?:ב)?(?:חדר|בחדר|ארון|בארון|בחוץ|מחוץ|בבית|במקלחת)|(?:לא\\s+נותנים|לא\\s+נותן|לא\\s+נותנת)\\s+לי\\s+(?:לאכול|אוכל)|(?:זורק|זורקת|זורקים)\\s+(?:עליי|עלי)\\s+(?:דברים|חפצים)|(?:מאיים|מאיימת|מאיימים)\\s+להרביץ\\s+לי') },
  { cat: 'abuse', re: he('לא\\s+(?:רוצה|רוצים)\\s+לחזור\\s+(?:הביתה|לבית)(?:\\s+(?:אף פעם|יותר|לעולם))?') + '(?!\\s+(?:עדיין|עכשיו|כבר|מוקדם))' },
  { cat: 'abuse', re: '\\b(?:abus\\w*|molest\\w*|(?:hits|beats) me|(?:scared|afraid) of my (?:dad|mom|mum|father|mother|stepdad|stepfather|stepmom|brother|uncle|parents))\\b' },
  // danger: someone asks the child for pictures. Only a request aimed at the child counts ("ממני", "שאשלח", "לשלוח",
  // "להצטלם", "תמונה שלי"): "השאלה מבקשת תמונה של המשולש אחרי שיקוף" is the image of a shape under a transformation, and
  // a request for a picture of school work ("ביקשו ממני תמונה של הדף") is dropped (school: true).
  { cat: 'danger', re: `${ASK}\\s+(?:ממני|ממך|מאיתנו)\\s+(?:[^\\s]+\\s+)?(?:תמונה|תמונות|תמונ|סרטון|סרטונים|להצטלם|לשלוח)`, school: true },
  { cat: 'danger', re: `${ASK}\\s+לשלוח\\s+(?:לו\\s+|לה\\s+|להם\\s+)?(?:[^\\s]+\\s+)?(?:תמונ|סרטון)`, school: true },
  { cat: 'danger', re: `${ASK_THAT}\\s+ש(?:אשלח|נשלח)\\s+(?:לו\\s+|לה\\s+|להם\\s+)?(?:[^\\s]+\\s+)?(?:תמונ|סרטון)`, school: true },
  { cat: 'danger', re: `${ASK_THAT}\\s+(?:ש(?:אצטלם|אצלם את עצמי|אתפשט|אוריד|אפתח (?:את )?(?:ה)?מצלמה|אדליק (?:את )?(?:ה)?מצלמה)|להצטלם|לצלם את עצמי)` },
  { cat: 'danger', re: `${ASK}\\s+(?:[^\\s]+\\s+)?(?:תמונה|תמונות|סרטון|סרטונים)\\s+(?:שלי|ממני|שלך)(?![א-ת])` },
  { cat: 'danger', re: `${P}(?:תמונה|תמונות|סרטון|סרטונים)\\s+(?:עירום|בלי בגדים|לא צנועות|לא צנועה|גסות|גסה)` },
  // extortion: "מישהו סוחט אותי", "זו סחיטה" (never a juicer: "המכונה סוחטת 3 תפוזים")
  { cat: 'danger', re: he('(?:סוחט|סוחטת|סוחטים|סחט|סחטה|סחטו)\\s+(?:אותי|אותנו)|סחיטה') + '(?!\\s+(?:של\\s+)?(?:ה)?(?:לימונ|תפוז|מיצ|פירות))' },
  { cat: 'danger', re: he('(?:מאיים|מאיימת|מאיימים|איים|איימו|איימה)\\s+(?:עליי|עלי)'), joke: true },
  // "אמרו שירביצו לי אחרי בית ספר", "הוא אמר שאם אספר הוא יפגע במשפחה שלי"
  { cat: 'danger', re: he('(?:אמר|אמרה|אמרו|אומר|אומרת|אומרים|מאיים|מאיימת|מאיימים|איים|איימה|איימו|הבטיח|הבטיחו)\\s+(?:לי\\s+)?ש(?:הוא\\s+|היא\\s+|הם\\s+)?(?:ירביץ|תרביץ|ירביצו|יכה|תכה|יכו|יפוצץ|יפוצצו|ישבור|ישברו)\\s+(?:לי|אותי)'), joke: true },
  { cat: 'danger', re: he('אם\\s+(?:אני\\s+)?(?:אספר|אגיד|אגלה|אדבר)') + '[^.?!]{0,30}?' + he('(?:יפגע|תפגע|יפגעו|יהרוג|תהרוג|יהרגו|ירביץ|תרביץ|ירביצו|יעשה לי|יקרה משהו)') },
  // "מישהו מבוגר כותב לי באינסטגרם דברים מגעילים", "הוא שלח לי תמונה של איבר המין שלו"
  { cat: 'danger', re: he(`(?:כותב|כותבת|כותבים|שולח|שולחת|שולחים|שלח|שלחה|שלחו|אומר|אומרת)\\s+לי\\s+(?:ב(?:ה)?${ONLINE}\\s+)?(?:דברים|הודעות|תמונות|סרטונים)\\s+(?:מגעילים|מגעילות|מיניים|מיניות|גסים|גסות|לא יפים|לא נעימים|לא נעימות|מפחידים|מפחידות)`) },
  { cat: 'danger', re: he('איבר(?:י)?\\s+(?:ה)?מין|של\\s+(?:ה)?איבר\\s+שלו') },
  // threats by message: "שולחים לי הודעות מאיימות", "קיבלתי איומים"
  { cat: 'danger', re: he('(?:הודעה|הודעות)\\s+(?:מאיימות|מאיימת|איום|איומים|עם איומים|מפחידות|מפחידה)|(?:קיבלתי|מקבל|מקבלת|מקבלים)\\s+(?:הודעות\\s+(?:עם\\s+)?)?(?:איום|איומים)') },
  // "שלחתי תמונה ועכשיו הוא מאיים", "הוא אומר שיפרסם את התמונות שלי"
  { cat: 'danger', re: he(`(?:הוא|היא|הם|מישהו|מישהי)\\s+(?:מאיים|מאיימת|מאיימים|איים|איימה|איימו)`) + `(?:${END}|\\s+(?:ש|לפרסם|להפיץ|לשלוח|להראות|לספר|לגלות|על))`, joke: true },
  { cat: 'danger', re: `${he('שלחתי')}\\s+(?:לו\\s+|לה\\s+|להם\\s+)?(?:[^\\s]+\\s+)?${PICS}(?!\\s+(?:של\\s+(?:ה)?${SCHOOL_NOUNS}|למורה|למורים))[^.?!]{0,50}?${he(THREAT)}` },
  // the child's own pictures spread: "הוא אומר שיפרסם את התמונות שלי", "...ישלח את התמונות שלי לכל הכיתה"
  { cat: 'danger', re: he(`(?:יפרסם|תפרסם|יפרסמו|יפיץ|תפיץ|יפיצו|להפיץ|לפרסם|ישלח|תשלח|ישלחו|יראה|תראה|יראו|יעלה|תעלה|יעלו|פרסם|פרסמה|פרסמו|הפיץ|הפיצה|הפיצו|מפיץ|מפיצה|מפיצים)\\s+(?:את\\s+)?(?:ה)?${PICS}\\s+(?:שלי|ממני|ששלחתי)`) },
  // a threat to spread pictures: "הבחור מאיים לפרסם את התמונות", "...אחרת יפרסם את התמונות"
  { cat: 'danger', re: he(`(?:(?:מאיים|מאיימת|מאיימים|איים|איימה|איימו)\\s+(?:ש)?|אחרת\\s+(?:הוא\\s+|היא\\s+)?)(?:יפרסם|תפרסם|יפרסמו|יפיץ|תפיץ|יפיצו|להפיץ|לפרסם|לשלוח|ישלח|תשלח|להראות|יראה|תראה)\\s+(?:את\\s+)?(?:ה)?${PICS}`) },
  { cat: 'danger', re: he(`(?:שלח|שלחה|שולח|שולחת|שולחים|שלחו)\\s+לי\\s+(?:[^\\s]+\\s+)?${PICS}\\s+(?:עירום|לא צנועות|לא צנועה|מגעילות|מגעילה|של איברים|לא נעימות|גסות)`) },
  { cat: 'danger', re: he('(?:אמר|אמרה|ביקש|ביקשה|מבקש|מבקשת)\\s+(?:לי\\s+)?לא לספר\\s+(?:להורים|לאף אחד|לאמא|לאבא)') },
  // a secret with someone: "הוא אמר לי לשמור סוד" (but "...לשמור סוד על ההפתעה")
  { cat: 'danger', re: `${he('(?:אמר|אמרה|ביקש|ביקשה|מבקש|מבקשת|אומר|אומרת)\\s+(?:לי|ממני)\\s+(?:ש?לשמור\\s+(?:את זה\\s+|על זה\\s+)?(?:ב)?סוד|שזה\\s+(?:ה)?סוד\\s+(?:שלנו|בינינו)|שזה\\s+(?:רק\\s+)?בינינו)')}(?!\\s+(?:על|לגבי)\\s+(?:ה)?(?:הפתעה|מתנה|יום|מסיבה|תוכנית))` },
  { cat: 'danger', re: he('(?:רוצה|רוצים)\\s+(?:להיפגש|לפגוש|להפגש)\\s+(?:איתי|אותי)\\s+(?:בסוד|בלי)') },
  // "ילד מהכיתה הציע להיפגש איתי בסוד", "מישהו מהאינטרנט הציע להיפגש"
  { cat: 'danger', re: he('(?:הציע|הציעה|הציעו|מציע|מציעה|מציעים)\\s+(?:לי\\s+)?(?:להיפגש|שניפגש|להפגש)') },
  // someone met online wants to meet: "מבוגר באינסטגרם רוצה לפגוש אותי"
  { cat: 'danger', re: `${he('(?:מבוגר|מבוגרת|מישהו|מישהי|גבר|בחור|בחורה|ילד|ילדה|נער|נערה|חבר|חברה|אחד|אחת|הכרתי|מכירה|מכיר)')}\\s+(?:[^\\s.?!]+\\s+){0,3}?(?:מ|ב)(?:ה)?${ONLINE}[^.?!]{0,40}?${he('(?:לפגוש|להיפגש|להפגש|שניפגש|שנפגש|שאבוא|שאגיע|לבוא אליי|לבוא אליו|לבוא אליה|לקחת אותי|יאסוף אותי|לאסוף אותי)')}` },
  { cat: 'danger', re: '\\b(?:sextortion|blackmail\\w*|threatening me|threatens? to (?:post|share|send|leak))\\b' },
  // bullying
  { cat: 'bullying', re: he('(?:עושים|עשו)\\s+(?:לי\\s+)?חרם|מחרימים אותי|(?:כולם\\s+)?צוחקים (?:עליי|עלי)|(?:מציקים|מקללים|מכים|משפילים)\\s+(?:לי|אותי)'), maths: true },
  // "עושים עליי חרם", "כל הכיתה עושה עליי חרם", "יש עליי חרם", "החרימו אותי"
  { cat: 'bullying', re: he('(?:עושים|עושות|עושה|עשו|יש|שמו|הכריזו)\\s+(?:עליי|עלי|נגדי)\\s+חרם|חרם\\s+(?:עליי|עלי|נגדי)|(?:החרימו|מחרימות)\\s+אותי'), maths: true },
  // "פתחו עליי קבוצת שנאה"
  { cat: 'bullying', re: he('קבוצת\\s+שנאה|(?:פתחו|פתח|פתחה|עשו)\\s+(?:עליי|עלי|נגדי)\\s+קבוצ(?:ה|ת)') },
  // "קוראים לי בשמות", "מעליבים אותי כל יום"
  { cat: 'bullying', re: he('(?:קוראים|קוראות|קורא|קוראת)\\s+לי\\s+(?:ב)?שמות(?:\\s+גנאי)?|שמות\\s+גנאי|(?:מעליבים|מעליבות|מעליב|מעליבה|מקניטים|יורדים)\\s+(?:אותי|עליי|עלי)\\s+(?:כל יום|כל הזמן|כל היום|תמיד|בלי הפסקה|מול כולם)|(?:כל יום|כל הזמן)\\s+(?:מעליבים|יורדים)\\s+(?:אותי|עליי|עלי)'), maths: true },
  // "כולם בכיתה שונאים אותי", "אף אחד בכיתה לא מדבר איתי"
  { cat: 'bullying', re: he('כולם\\s+(?:ב|מ)(?:ה)?(?:כיתה|בית ספר|בית הספר|שכבה|קבוצה|חוג)(?:\\s+(?:שלי|שלנו))?\\s+(?:שונאים|שונאות|מתעלמים|מתעלמות|צוחקים|צוחקות|מקללים|מקללות|מחרימים|מחרימות|מציקים)\\s+(?:אותי|ממני|עליי|עלי|לי)'), maths: true },
  { cat: 'bullying', re: he('אף אחד\\s+(?:ב|מ)(?:ה)?(?:כיתה|בית ספר|בית הספר|שכבה)\\s+לא\\s+(?:מדבר|מדברת|רוצה|משחק|משחקת)\\s+(?:איתי|לשבת איתי|לשחק איתי)'), maths: true },
  { cat: 'bullying', re: he('(?:מפיצים|הפיצו|מפיצות)\\s+(?:עליי|עלי)\\s+(?:שמועות|דברים|שקרים)|(?:הוציאו|זרקו|העיפו)\\s+אותי\\s+מ(?:ה)?קבוצה') },
  { cat: 'bullying', re: '\\b(?:bullied|bullying me|kys)\\b', maths: true },
  // distress
  { cat: 'distress', re: he('אני\\s+(?:ב)?דיכאון|(?:מרגיש|מרגישה|מרגישים)\\s+(?:ב)?דיכאון|(?:יש לי|נכנסתי ל|נכנסת ל)דיכאון|(?:כל הזמן|כל יום|כל לילה)\\s+(?:אני\\s+)?בוכה|בוכה\\s+(?:כל הזמן|כל יום|כל לילה)|אין לי\\s+(?:אף אחד|חברים|עם מי לדבר)'), maths: true },
  // "אף אחד לא אוהב אותי" (never "אף אחד לא אוהב את המורה למתמטיקה")
  { cat: 'distress', re: he(`אני\\s+(?:שונא|שונאת)\\s+את עצמי|אני\\s+(?:(?:מרגיש|מרגישה)\\s+)?(?:חסר|חסרת)\\s+(?:ערך|תועלת)|אף אחד לא\\s+(?:אוהב\\s+אותי|אכפת לו\\s+ממני|(?:אוהב|אכפת לו)${END})|אני לבד בעולם`), maths: true },
  // "אני מדוכאת", "אני בדיכי", "יש לי התקפי חרדה"
  { cat: 'distress', re: he('אני\\s+(?:כל כך\\s+|ממש\\s+|נורא\\s+|מאוד\\s+|די\\s+)?(?:מדוכא|מדוכאת|מדוכדך|מדוכדכת|בדיכי|בדאון)|התקפ(?:י|ים)?\\s+(?:ה)?(?:חרדה|פאניקה)|התקף\\s+(?:חרדה|פאניקה)'), maths: true },
  // "אני רוצה שהכל ייגמר", "אני רוצה שזה ייגמר כבר", "אני לא רוצה להמשיך יותר" (never "...עם התרגיל")
  { cat: 'distress', re: he(`${WANT}\\s+ש(?:הכל|הכול|זה|כל זה)\\s+(?:כבר\\s+)?(?:ייגמר|יגמר|יסתיים|ייפסק)(?:\\s+כבר)?`), maths: true },
  { cat: 'distress', re: he(`לא\\s+(?:רוצה|רוצים|יכול|יכולה)\\s+להמשיך\\s+(?:יותר|ככה|כך)${END}`), maths: true, hard: true },
  // "אני לבד" as the whole message (never "אני לבד בבית ורוצה לתרגל")
  { cat: 'distress', re: fold('^\\s*אני\\s+לבד\\s*[.!]*\\s*$') },
  // "כולם שונאים אותי", "כולם מתעלמים ממני", "נמאס לי מהכל"
  { cat: 'distress', re: he('כולם\\s+(?:שונאים|מתעלמים|מתעלמות)\\s+(?:אותי|ממני)|נמאס לי\\s+(?:מהכל|מהכול|מכל|מכולם)'), maths: true },
  { cat: 'distress', re: he('אני\\s+לא\\s+(?:יכול|יכולה)\\s+יותר'), maths: true, hard: true },
  // (s) "killing me" counts only about home: "הורג אותי בבית", never "התרגיל הזה הורג אותי"
  { cat: 'distress', re: `${he('(?:הורג|הורגת)\\s+אותי')}.{0,${MATHS_WINDOW}}?${he('הבית|בבית|אבא|אמא')}`, maths: true },
  { cat: 'distress', re: he('(?:אני\\s+)?(?:שונא|שונאת|שונאים)\\s+את\\s+(?:ה)?חיים(?:\\s+שלי)?|(?:ריק|ריקה|ריקים)\\s+מבפנים|(?:מת|מתה)\\s+מבפנים|(?:תחושת|מרגיש|מרגישה)\\s+ריקנות|אין לי\\s+(?:שום\\s+)?תקווה|(?:מרגיש|מרגישה|אני)\\s+(?:חסר|חסרת)\\s+תקווה'), maths: true },
  { cat: 'distress', re: he('אני\\s+(?:מיותר|מיותרת|נטל|מעמסה)(?:\\s+(?:על|לכולם|בבית))?') + END, maths: true },
  // sadness and loneliness: "אני כל כך עצובה", "אני עצוב כל הזמן", "אני מרגישה לבד" (never "אני לבד בתרגיל")
  { cat: 'distress', re: he('אני\\s+(?:כל כך|ממש|נורא|מאוד|סתם|תמיד|כבר)\\s+(?:עצוב|עצובה|עצובים|עצובות)|(?:עצוב|עצובה|עצובים|עצובות)\\s+(?:לי\\s+)?(?:כל הזמן|כל יום|כל היום|כל הימים|תמיד|כבר הרבה זמן|כבר שבועות|כבר חודשים)'), mathsIn: true },
  { cat: 'distress', re: he('(?:אני|מרגיש|מרגישה|מרגישים)\\s+(?:עצוב|עצובה|עצובים)') + END, mathsIn: true },
  { cat: 'distress', re: he('(?:מרגיש|מרגישה|מרגישים|מרגישות)\\s+(?:(?:כל כך|ממש|נורא|מאוד|תמיד|כל הזמן|לגמרי)\\s+)?(?:לבד|בודד|בודדה|בודדים)'), mathsIn: true },
  { cat: 'distress', re: he('אני\\s+(?:(?:כל כך|ממש|נורא|מאוד|תמיד|לגמרי|כל הזמן)\\s+(?:לבד|בודד|בודדה)|(?:בודד|בודדה))|אני\\s+לבד\\s+(?:כל הזמן|תמיד|כל יום|בהפסקות|בהפסקה)'), mathsIn: true },
  { cat: 'distress', re: he('אף אחד לא\\s+(?:מבין|שם לב|רואה|מקשיב|מדבר)\\s+(?:אותי|אליי|אלי|לי|איתי)'), maths: true },
  { cat: 'distress', re: he('בא לי לבכות|אני בוכה בלי סיבה'), maths: true, laugh: true },
  // running away: "אני רוצה לברוח מהבית", "ברחתי מהבית"
  { cat: 'distress', re: he(`(?:${WANT}|אני|אנחנו)\\s+(?:ל)?(?:ברוח|בורח|בורחת|בורחים)\\s+מ(?:ה)?(?:בית|בבית)|(?:ברחתי|אברח|נברח|ברחנו)\\s+מ(?:ה)?בית|לעזוב את הבית ולא לחזור`) },
  // not eating: "אני לא אוכלת כבר כמה ימים", "אני מקיאה אחרי שאני אוכלת", "אין אוכל בבית"
  { cat: 'distress', re: he('לא\\s+(?:אוכל|אוכלת|אוכלים|אכלתי|אכלנו)\\s+(?:כבר\\s+)?(?:(?:כלום|שום דבר)\\s+(?:כבר\\s+)?)?(?:כמה ימים|יומיים|שלושה ימים|ימים|שבוע|שבועיים|מאתמול|הרבה זמן|[0-9]+ ימים)') },
  { cat: 'distress', re: he('(?:כמה ימים|יומיים|שבוע|[0-9]+ ימים)\\s+(?:ש)?(?:אני\\s+)?לא\\s+(?:אוכל|אוכלת|אכלתי|אכלנו)') },
  { cat: 'distress', re: he('(?:מרעיב|מרעיבה|להרעיב|הרעבתי)\\s+את\\s+עצמי|(?:מקיא|מקיאה|הקאתי|להקיא)\\s+(?:אחרי|אחר)\\s+(?:ש)?(?:אני\\s+)?(?:אוכל|אוכלת|אכלתי|ארוחה|כל ארוחה|האוכל)|(?:גורם|גורמת)\\s+לעצמי\\s+להקיא|להקיא\\s+בכוונה|אנורקסיה|בולימיה') },
  { cat: 'distress', re: he('אין\\s+(?:לנו\\s+|לי\\s+)?(?:אוכל|מה לאכול)\\s+(?:ב)?(?:בית|הבית|בבית)|אין לנו מה לאכול') },
  { cat: 'distress', re: '\\b(?:starving myself|run(?:ning)? away from home|so lonely|i feel (?:so )?(?:alone|empty|worthless)|nobody loves me)\\b' },
].map((r) => ({ ...r, re: new RegExp(fold(r.re), 'gu') }));

/**
 * The same phrases with the spaces left out ("רוצהלמות", "באלי למות", "מחשבותאובדניות"): the text with no spaces
 * holds one of them, and the text does not hold it as whole words (then the rules above decided, maths frustration
 * included).
 * Only phrases long enough that no maths sentence written without spaces holds them; distress phrases count only in a
 * message with no maths word in it ("אנימרגישה לבד עם השברים" is about fractions).
 */
const SQUASHED = [
  ['self_harm', ['רוצה למות', 'רוצים למות', 'בא לי למות', 'רוצה להתאבד', 'בא לי להתאבד', 'חושב להתאבד', 'חושבת להתאבד', 'מחשבות אובדניות', 'מחשבות התאבדות',
    'לא רוצה לחיות', 'לישון ולא להתעורר', 'אין לי בשביל מה לחיות', 'לגמור עם החיים', 'לקפוץ מהגג', 'לקפוץ מהחלון',
    'אני לא שווה כלום', 'רוצה להיעלם', 'אין טעם לחיות']],
  ['abuse', ['פוחד מאבא', 'פוחדת מאבא', 'מפחד מאבא', 'מפחדת מאבא', 'פוחד מאמא', 'פוחדת מאמא', 'מפחד מאמא', 'מפחדת מאמא']],
  ['danger', ['מאיים עליי', 'מאיימים עליי', 'תמונות עירום']],
  ['distress', ['אני בדיכאון', 'שונאת את עצמי', 'שונא את עצמי', 'אין לי חברים', 'אני מרגישה לבד', 'אני מרגיש לבד']],
].flatMap(([cat, list]) => list.map((p) => ({ cat, spaced: new RegExp(he(escRe(fold(p)))), stem: fold(p).replace(/\s+/g, '') })));
/** A maths word anywhere in the message (for the squashed distress phrases). */
const MATHS_ANY = new RegExp(fold(`(?:^|[^א-ת])[ובהלמש]?(?:ה)?(?:${MATHS_ALT})(?![א-ת])`));

// ---------------------------------------------------------------- Arabic (COUNCIL2-34)
// A child who uses the app in Arabic writes in Arabic: Modern Standard or the spoken Arabic of Israel ("بدي", "ما بدي",
// "بيضربني"). The text is folded first (arFold: no vowel marks or tatweel, one alef, ة as ه, ى as ي), and the patterns
// are written folded. As in Hebrew, a word that is also maths flags only with a person beside it: "يضرب" is "multiplies",
// so only "يضربني" (hits me) counts; "اقفز" is a jump on the line, so only a jump from a roof or a window does.
// A first set, to be widened with a counsellor's review (docs/ARABIC.md); worker/test/arabic.test.js holds it.
export const arFold = (s) => String(s)
  .replace(/[ً-ْٰـ]/g, '')
  .replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي');
const AB = '(?:^|[^\\u0600-\\u06FF])'; // an Arabic word starts here (no lookbehind)
const AE = '(?![\\u0600-\\u06FF])'; // an Arabic word ends here
const ar = (x) => `${AB}(?:و|ف)?(?:${x})${AE}`;
const AR_WANT = '(?:بدي|اريد|نفسي|حابب|حابه|بفكر|افكر|راح|رح|ناوي|ناويه|قررت)';
/** People at home, as a child names them in Arabic (distressDetail's `home`). */
const AR_HOME = '(?:ابوي|ابي|بابا|امي|ماما|اهلي|اخوي|اخي|اختي|عمي|خالي|جدي|ستي|زوج\\s+امي|مرت\\s+ابوي|بالبيت|عالبيت|البيت|الدار|بالدار|عالدار)';
/** Words that say an Arabic sentence is a word problem ("ما الاحتمال؟", "كم ..."). */
const AR_CTX = new RegExp(`${'(?:^|[^\\u0600-\\u06FF])'}(?:ال)?(?:احتمال|احتمالات|كم|كيس|سله|علبه|صندوق|محور|نقطه|معادله|حمراء|زرقاء|خضراء)(?![\\u0600-\\u06FF])`);
const AR_RULES = [
  { cat: 'self_harm', re: ar('(?:ان|ب|ر|ا)?نتحر|انتحار|انتحاريه|بالانتحار|الانتحار'), sure: true },
  { cat: 'self_harm', re: `${ar(AR_WANT)}\\s+(?:ان\\s+)?(?:اموت|موت|اقتل\\s+(?:نفسي|حالي)|انهي\\s+حياتي|اخلص\\s+من\\s+حياتي)(?!\\s+(?:من\\s+)?(?:الضحك|ضحك))`, sure: true },
  // the spoken Arabic of the Negev: "ودي اموت", "ابي اموت"
  { cat: 'self_harm', re: `${ar('(?:ودي|ابي|ابغي|ابغى)')}\\s+اموت(?!\\s+(?:من\\s+)?(?:الضحك|ضحك))` },
  { cat: 'self_harm', re: ar('(?:ب|ا|ن)?(?:قتل|اذي|جرح|اوذي)\\s+(?:نفسي|حالي)'), sure: true },
  { cat: 'self_harm', re: `${ar('(?:ما|مش|لا)')}\\s+(?:بدي|اريد|حابب|حابه)\\s+(?:ان\\s+)?(?:اعيش|عيش|(?:اضل|اظل)\\s+(?:عايش|عايشه))`, sure: true },
  // "تعبت من الحياة", "زهقت من حياتي"
  { cat: 'self_harm', re: ar('(?:تعبت|زهقت|مليت|طفشت|كرهت)\\s+(?:من\\s+)?(?:ال)?(?:حياه|حياتي|عيشه|عيشتي|دنيا)') },
  { cat: 'self_harm', re: `${ar('(?:ما|لا)')}\\s+(?:في|يوجد|عندي)\\s+(?:اشي|شي|شيء)\\s+(?:اعيش|يستاهل\\s+اعيش)` },
  { cat: 'self_harm', re: `${ar('(?:بدي|اريد)')}\\s+(?:ان\\s+)?انام\\s+(?:وما|ولا)\\s+(?:اصحى|اصحي|افيق|استيقظ)` },
  { cat: 'self_harm', re: `${ar(AR_WANT)}\\s+(?:انط|اقفز|انزل)\\s+(?:من\\s+)?(?:ال)?(?:سطح|شباك|نافذه|بنايه|عماره)` },
  // pills: never the tablets of a word problem ("... كل الحبوب من الكيس، ما الاحتمال؟")
  { cat: 'self_harm', re: `${ar(AR_WANT)}\\s+(?:اوخذ|اخذ|ابلع|اشرب)\\s+كل\\s+(?:ال)?(?:حبوب|دوا|دواء|ادويه)(?!\\s+من\\s+(?:ال)?(?:كيس|سله|علبه|صندوق))`, ctx: true },
  // someone hits me: he, she, they; past and present ("بيضربني", "بتضربني", "ضربتني", "بيضربوني")
  { cat: 'abuse', re: ar('(?:ب|بي|بت|ي|ت)?ضرب(?:ت)?(?:ني|وني)|(?:ب|بي|ي)?ضربونني') },
  { cat: 'abuse', re: `${ar('(?:بخاف|اخاف|خايف|خايفه)')}\\s+(?:كثير\\s+|كتير\\s+)?من\\s+(?:ابوي|ابي|بابا|امي|ماما|اخوي|اخي|زوج\\s+(?:امي|ماما)|مرت\\s+(?:ابوي|بابا))` },
  // "بخاف ارجع عالبيت"
  { cat: 'abuse', re: `${ar('(?:بخاف|اخاف|خايف|خايفه)')}\\s+(?:ارجع|اروح|ارد|اضل|انام)\\s+(?:ع|على\\s+|الى\\s+|ل|في\\s+|ب)?\\s*(?:ال)?(?:بيت|دار)` },
  // someone touches me: "لمسني", "بلمسني", "بتلمسني", "بيتحرش فيي"
  { cat: 'abuse', re: ar('(?:ب|بي|بت|ي|ت)?تحرش(?:وا)?|(?:ب|بي|بت|ي|ت)?لمس(?:ت)?(?:ني|وني)|اغتصب(?:ني|وني)?|اغتصاب') },
  { cat: 'abuse', re: `${ar('(?:ما|مش|لا)')}\\s+(?:بدي|اريد)\\s+(?:ارجع|اروح)\\s+(?:ع|على|الى|ل)?\\s*(?:ال)?(?:بيت|دار)` },
  { cat: 'danger', re: `${ar('(?:بدو|بدها|يريد|تريد|طلب\\s+مني|طلبت\\s+مني|بطلب\\s+مني|بيطلب\\s+مني)')}\\s+(?:اني\\s+ابعث\\s+|ابعثله\\s+|ابعتله\\s+)?(?:صور|صوره|صوري)` },
  { cat: 'danger', re: ar('(?:بي|ي|ب)?هددني|هددني|تهديد|تهديدات|(?:بي|ي)?بتزني|ابتزاز') },
  { cat: 'danger', re: `${ar('(?:راح|رح|بدو|سوف)')}\\s+(?:ي)?نشر\\s+(?:صوري|الصور)` },
  { cat: 'danger', re: `${ar('(?:بدو|بدها|يريد)')}\\s+(?:يقابلني|نلتقي|نتقابل)` },
  { cat: 'bullying', re: ar('(?:كلهم|كل\\s+الصف|الكل)\\s+(?:بيكرهوني|يكرهوني|يكرهونني)') },
  { cat: 'bullying', re: ar('(?:بي|ي|ب)?تنمروا|يتنمرون|تنمر|التنمر|مقاطعيني|مقاطعينني') },
  // sadness: "وحيد" is also "unique" ("للمعادلة حل وحيد"), so it needs a person beside it
  { cat: 'distress', re: ar('(?:انا\\s+)?(?:كثير\\s+|جدا\\s+)?(?:حزين|حزينه|مكتئب|مكتئبه)') },
  { cat: 'distress', re: ar('(?:انا|اني|حاسس|حاسه|بحس|اشعر)\\s+(?:اني\\s+|حالي\\s+|نفسي\\s+)?(?:كثير\\s+|جدا\\s+)?(?:وحيد|وحيده)') },
  { cat: 'distress', re: ar('(?:ما\\s+(?:الي|لي|عندي)\\s+حدا|ما\\s+حدا\\s+بحبني|لا\\s+احد\\s+يحبني)') },
  { cat: 'distress', re: `${ar(AR_WANT)}\\s+(?:اهرب|اشرد)\\s+(?:من\\s+)?(?:ال)?(?:بيت|دار)` },
  // not eating: only as the child's own state ("ما باكل اشي", "ما باكل من يومين"), never "احمد ما باكل تفاح"
  { cat: 'distress', re: `${ar('(?:ما\\s+بوكل|ما\\s+باكل|بطلت\\s+اكل|لا\\s+اكل)')}(?:\\s+(?:اشي|شي|ولا\\s+اشي|شيئا|من\\s+(?:يومين|ايام|اسبوع|امبارح|مبارح)|صارلي)|\\s*[.!،]*\\s*$)` },
  { cat: 'distress', re: `${ar('(?:بعيط|ببكي|ابكي)')}\\s+كل\\s+(?:يوم|الوقت|ليله)` },
].map((r) => ({ ...r, re: new RegExp(r.re) }));
const AR_HOME_RE = new RegExp(ar(AR_HOME));
const ARABIC_LETTER = /[؀-ۿ]/;

/** The categories, most serious first: a message that matches several gets the first. */
export const DISTRESS_CATEGORIES = Object.freeze(['self_harm', 'abuse', 'danger', 'bullying', 'distress']);

/**
 * Does this rule match the text? → false, or { sure }: `sure` when the rule is marked so (a rule marked 'plain' is sure
 * only when no maths word follows: "בא לי למות מהמבחן הזה" still flags, and alerts no one).
 */
function firstMatch(rule, text) {
  rule.re.lastIndex = 0;
  for (let m = rule.re.exec(text); m; m = rule.re.exec(text)) {
    const end = m.index + m[0].length;
    const after = text.slice(end, end + AFTER_WINDOW);
    let dropped = (rule.maths && MATHS.test(after)) || (rule.mathsIn && MATHS_IN.test(after))
      || (rule.school && SCHOOL.test(after)) || (rule.laugh && LAUGHING.test(text.slice(end)))
      || (rule.joke && JOKE.test(after)) || (rule.hard && HARD.test(after)) || (rule.ifSchool && IF_SCHOOL.test(after));
    if (!dropped && (rule.ctx || rule.ctxDigit)) {
      const sentence = sentenceAt(text, m.index, end);
      dropped = CTX.test(sentence) || (!!rule.ctxDigit && /[0-9]/.test(sentence));
    }
    if (!dropped) return { sure: rule.sure === true || (rule.sure === 'plain' && !MATHS.test(after)) };
    if (m[0].length === 0) rule.re.lastIndex += 1;
  }
  return false;
}

const HOME_RE = new RegExp(fold(he(HOME_NAMED)));

/**
 * Everything the detector reads in a text → { flag, category, categories, home, sure }:
 *   category    the most serious category that matched (DISTRESS_CATEGORIES), or null
 *   categories  every category that matched, most serious first
 *   home        an abuse rule matched, or the text names a parent, an adult at home or the home
 *   sure        a rule marked as an unambiguous statement of suicide or self-harm matched
 * Runs on the device and on the server, with no network.
 */
export function distressDetail(text) {
  const t = fold(normalize(text));
  if (!t) return { flag: false, category: null, categories: [], home: false, sure: false };
  // "בא לי למות מצחוק" is laughter, with its spaces or without them
  const squashed = t.replace(/(?:למות|מת|מתה|מתימ)\s*מ?צחוק/g, '').replace(/[^א-תa-z0-9]+/g, '');
  const a = ARABIC_LETTER.test(t) ? arFold(t) : '';
  // read whether or not a rule matches: the optional classifier (worker/src/moderation.js) may flag what no rule does
  const named = HOME_RE.test(t) || (!!a && AR_HOME_RE.test(a));
  const cats = new Set();
  let sure = false;
  for (const r of RULES) {
    if (cats.has(r.cat) && !r.sure) continue;
    const hit = firstMatch(r, t);
    if (hit) { cats.add(r.cat); if (hit.sure) sure = true; }
  }
  if (a) {
    const arCtx = AR_CTX.test(a);
    for (const r of AR_RULES) {
      if ((cats.has(r.cat) && !r.sure) || (r.ctx && arCtx)) continue;
      if (r.re.test(a)) { cats.add(r.cat); if (r.sure) sure = true; }
    }
  }
  for (const q of SQUASHED) {
    if (!cats.has(q.cat) && squashed.includes(q.stem) && !q.spaced.test(t) && (q.cat !== 'distress' || !MATHS_ANY.test(t))) cats.add(q.cat);
  }
  const categories = DISTRESS_CATEGORIES.filter((c) => cats.has(c));
  return { flag: cats.size > 0, category: categories[0] ?? null, categories, home: named || cats.has('abuse'), sure };
}

/**
 * Does this text read as a child in distress or danger? → { flag, category } with category one of
 * DISTRESS_CATEGORIES (the most serious one that matched) or null. Runs on the device and on the server, with no
 * network. A maths sentence ("הישר חותך את ציר ה-x", "התרגיל הזה הורג אותי", "הצפרדע קופצת 3 צעדים") does not flag.
 */
export function detectDistress(text) {
  const d = distressDetail(text);
  return { flag: d.flag, category: d.category };
}

// ---------------------------------------------------------------- a message that is not about maths at all
/**
 * Words of the lesson itself: a message with one of them is about the exercise (a hint, an answer, a mistake, a number
 * said in words), not about the child.
 */
const STUDY_WORDS = [
  'רמז', 'רמזים', 'תשובה', 'תשובות', 'טעות', 'טעויות', 'טעיתי', 'פתרון', 'פתרונות', 'לפתור', 'פותרים', 'פתרתי', 'הסבר', 'הסברים', 'להסביר',
  'תסביר', 'תסבירו', 'מסבירים', 'מתחילים', 'להתחיל', 'דוגמה', 'דוגמא', 'דוגמאות', 'בדיקה', 'לבדוק', 'תבדוק', 'נכון', 'נכונה', 'הבנתי', 'מבין',
  'מבינה', 'להבין', 'שיעור', 'שיעורים', 'שלב', 'מדרגה', 'מדרגות', 'נושא', 'נושאים', 'כלל', 'חוק', 'חוקים', 'לחשב', 'מחשבים', 'חישוב', 'מספר',
  'מספרים', 'שווה', 'סימן', 'מינוס', 'פלוס', 'כפול', 'חלקי', 'פחות', 'ועוד', 'אפס', 'אחת', 'שתיים', 'שלוש', 'ארבע', 'חמש', 'שש', 'שבע', 'שמונה',
  'תשע', 'עשר', 'חצי', 'רבע', 'שליש', 'תרגול', 'לתרגל', 'ללמוד', 'לומדים', 'למדנו', 'מדי', 'עוזר',
  // a motion problem asked with no number in it ("מתי הם נפגשים?")
  'נפגשים', 'נפגשות', 'ייפגשו', 'מהירות', 'מרחק',
  'سوال', 'تمرين', 'حل', 'جواب', 'شرح', 'مثال', 'تلميح', 'عدد', 'معادله', 'درس',
];
const STUDY = new RegExp(`(?:^|[^א-ת\\u0600-\\u06FF])[ובהלמשכ]?(?:ה)?(?:${STUDY_WORDS.map((w) => escRe(fold(w))).join('|')})(?![א-ת\\u0600-\\u06FF])`);

/**
 * Is this message about something other than maths? True for three words or more with no digit, no maths sign, no
 * letter standing alone (x, y), and no maths or study word. A word list is never complete (the reviews keep finding
 * disclosures it misses), so a screen that holds such a message back, because the tutor cannot answer now, shows the
 * support card with it (web/src/components/AIChat.jsx). It decides nothing on the server.
 */
export function readsPersonal(text) {
  const t = fold(normalize(text));
  if (!t || /[0-9=+×÷*/^√%<>]/.test(t) || /(?:^|[^a-z])[a-z](?![a-z])/.test(t)) return false;
  const words = t.split(/\s+/).filter((w) => /[א-ת؀-ۿa-z]{2,}/.test(w));
  if (words.length < 3) return false;
  return !MATHS_ANY.test(t) && !CTX.test(t) && !STUDY.test(ARABIC_LETTER.test(t) ? arFold(t) : t);
}
