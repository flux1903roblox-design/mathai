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
// False positives are the main risk: a word that is also maths ("לקפוץ" on a number line, "כדורים" in a word problem,
// "לא שווה" for ≠, "חותך" for a line that cuts an axis) flags only with a first person or an intent beside it.
// worker/test/safety.test.js holds 200+ phrases that must flag and the sentences that must not; web/src/learn/
// distress.test.ts runs every teaching step and a sample of every generator through the detector.
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
  { cat: 'self_harm', re: he(`${WANT}\\s+(?:ל)?(?:מות|למות|להתאבד|לגמור עם (?:ה)?חיים|לגמור עם עצמי|להיעלם(?: מהעולם)?)`), laugh: true },
  { cat: 'self_harm', re: he('להתאבד|התאבדות|אתאבד|מתאבד|מתאבדת|מתאבדים|התאבדתי|להתעבד|להתאבת') },
  // אובדני*: "מחשבות אובדניות", "אני אובדנית", "נטיות אובדניות", also "אבדניות"
  { cat: 'self_harm', re: he('או?בדנ(?:י|ית|יות|יים|ות)') },
  { cat: 'self_harm', re: he('(?:מחשבות|חושב|חושבת|חושבים|חושבות)\\s+על\\s+(?:ה)?(?:מוות|למות|התאבדות|לא להיות|לגמור עם (?:ה)?(?:חיים|הכל|הכול)|לסיים את (?:ה)?חיים)') },
  // "לישון ולא להתעורר", "להירדם ולא לקום יותר", "לישון לנצח"
  { cat: 'self_harm', re: he('(?:לישון|להירדם|לנמנם)\\s+ו?(?:לא|בלי)\\s+(?:להתעורר|לקום)|(?:לישון|לנוח)\\s+לנצח|ללכת לישון לתמיד') },
  // "אני לא רוצה להתעורר מחר", "הלוואי שלא אתעורר" (but "...להתעורר מחר מוקדם" is about an alarm clock)
  { cat: 'self_harm', re: `${he('לא\\s+(?:רוצה|רוצים|רוצות)\\s+להתעורר\\s+(?:מחר|יותר|אף פעם|לעולם|בכלל)')}(?!\\s+(?:מוקדם|ב[0-9א-ת]|ל(?:בית|מבחן|בחינה|טיול)))` },
  { cat: 'self_harm', re: he('ש(?:אני\\s+)?לא\\s+אתעורר') },
  // "אין לי בשביל מה לחיות", "אין לי למה לקום בבוקר"
  { cat: 'self_harm', re: he(`אין(?:\\s+לי)?\\s+(?:בשביל מה|בשביל מי|למה|סיבה|שום סיבה)\\s+(?:לחיות|להמשיך לחיות|לקום בבוקר|(?:להמשיך|לקום)${END})`) },
  { cat: 'self_harm', re: he('(?:למה|בשביל מה)\\s+(?:אני\\s+)?(?:בכלל\\s+)?(?:חי|חיה|קיים|קיימת)') + END },
  // "לגמור עם החיים", "לשים סוף לחיים", "לסיים את החיים"
  { cat: 'self_harm', re: he('(?:לגמור|לסיים)\\s+(?:עם|את)\\s+(?:ה)?חיים(?:\\s+שלי)?|לשים\\s+(?:קץ|סוף)\\s+ל(?:ה)?חיים') },
  // "בא לי לגמור עם הכל" (never "...עם הכל עד מחר", homework)
  { cat: 'self_harm', re: `${he(`${WANT}\\s+(?:ל)?(?:גמור|סיים)\\s+(?:עם|את)\\s+(?:הכל|הכול|כל זה|זה)`)}(?!\\s+(?:היום|עד|כבר|מהר|לפני|ואז|כדי|ו?ל(?:צאת|הגיש|לכת|נוח|שחק)|ב(?:שיעורי|זמן|בית)|של))` },
  // "אני לא שווה כלום", "...שאני לא שווה" (a first person: "x לא שווה 3" is ≠)
  { cat: 'self_harm', re: he(`אני\\s+(?:פשוט\\s+|בכלל\\s+|ממש\\s+|באמת\\s+|כבר\\s+)?לא\\s+(?:שווה|שווים|שוות)(?:\\s+(?:כלום|שום דבר|לחיות)|${END})`) },
  { cat: 'self_harm', re: he('(?:ה)?חיים\\s+שלי\\s+(?:לא\\s+(?:שווים|שווה)(?:\\s+כלום)?|חסרי\\s+(?:טעם|ערך))') },
  { cat: 'self_harm', re: he('(?:לא רוצה|לא רוצים)\\s+(?:לחיות|להמשיך לחיות)|אין לי (?:טעם|סיבה)\\s+(?:לחיות|להמשיך לחיות)') },
  // "אני לא רוצה להיות בחיים", "לא רוצה להיות פה יותר", "לא רוצה להיות קיימת"
  { cat: 'self_harm', re: he('(?:לא רוצה|לא רוצים)\\s+להיות\\s+(?:בחיים|פה|כאן|קיים|קיימת|בעולם)') },
  { cat: 'self_harm', re: he('אין לי (?:כוח|כח)\\s+(?:לחיות|לחיים|להמשיך לחיות)') },
  // "הלוואי שאמות", "הלוואי שהייתי מת/ה", "הלוואי שלא הייתי נולד/ת", "הלוואי שלא הייתי קיים/ת"
  { cat: 'self_harm', re: he('הלוואי\\s+(?:ו)?ש(?:אמות|הייתי\\s+(?:מת|מתה)|לא\\s+(?:הייתי\\s+(?:נולד|נולדת|קיים|קיימת)|נולדתי)|אני\\s+(?:אמות|מת|מתה))') },
  { cat: 'self_harm', re: he('נמאס לי (?:מהחיים|לחיות)|אין טעם (?:לחיות|לחיים)|עדיף (?:שאמות|שלא הייתי נולד|שלא הייתי נולדת)|כולם יהיו (?:בסדר|יותר טוב) (?:בלעדיי|בלעדי)|(?:טוב|עדיף) (?:להם|לכולם) בלעדיי') },
  { cat: 'self_harm', re: he('מכתב\\s+התאבדות|להיפרד\\s+מכולם\\s+לתמיד|מנת\\s+יתר') },
  // a plan: jumping from a roof, a window, a bridge, or in front of a train
  { cat: 'self_harm', re: he('(?:לקפוץ|אקפוץ|נקפוץ|קפצתי|לזרוק את עצמי|אזרוק את עצמי|ליפול)\\s+(?:מ(?:ה)?|מעל\\s+(?:ה)?|מן\\s+(?:ה)?)(?:גג|חלון|בניין|בנין|מרפסת|גשר|קומה|צוק)') },
  { cat: 'self_harm', re: he(`(?:על|ב)\\s*(?:ה)?(?:גג|מרפסת|גשר|חלון)${E}[^.?!]{0,30}?${WANT}\\s+לקפוץ`) },
  { cat: 'self_harm', re: he('אני\\s+(?:קופץ|קופצת)\\s+(?:מ(?:ה)?|מעל\\s+(?:ה)?)(?:גג|חלון|בניין|בנין|מרפסת|גשר|קומה|צוק)') },
  { cat: 'self_harm', re: he('(?:לקפוץ|לזרוק את עצמי|לשכב|לעמוד)\\s+(?:מתחת ל|לפני|מול)(?:ה)?(?:רכבת|אוטו|אוטובוס|מכונית|משאית)') },
  // pills: swallowing them, sleeping pills, or "all of them" with a first person ("כדורים" alone is a word problem)
  { cat: 'self_harm', re: he('(?:לבלוע|אבלע|בולע|בולעת|בלעתי)\\s+(?:את\\s+)?(?:כל|הרבה|קופסת|קופסה של|חבילת|חבילה של|בקבוק)\\s+(?:ה)?(?:כדורים|תרופות)') },
  { cat: 'self_harm', re: he('(?:לקחת|אקח|לקחתי|לוקח|לוקחת|לבלוע|בלעתי)\\s+(?:[^\\s]+\\s+){0,2}?(?:כדורי\\s+(?:שינה|הרגעה)|את כל (?:ה)?תרופות)') },
  { cat: 'self_harm', re: he('(?:לקחתי|אקח|בלעתי|אבלע)\\s+(?:[^\\s]+\\s+)?הרבה\\s+(?:כדורים|תרופות)') },
  { cat: 'self_harm', re: `${he('(?:אני\\s+' + WANT + '\\s+(?:ל)?קחת|(?:בא|מתחשק) לי לקחת|אקח|לקחתי)\\s+(?:את\\s+)?כל\\s+(?:ה)?(?:כדורים|תרופות)')}(?!\\s+(?:מ|ל|אל)[א-ת])` },
  { cat: 'self_harm', re: `${he('יש לי')}\\s+(?:[^\\s]+\\s+){0,2}?(?:ה)?(?:כדורים|תרופות|כדורי)[^.?!]{0,40}?${WANT}\\s+(?:ל)?(?:קחת|בלוע)\\s+(?:את\\s+)?(?:כולם|כולן|הכל|הכול)${E}(?!\\s+(?:ל|אל|מ)[א-ת])` },
  // cutting or hurting oneself
  { cat: 'self_harm', re: he('(?:לפגוע|פוגע|פוגעת|פגעתי|אפגע|פוגעים)\\s+ב?עצמי|פגיעה\\s+עצמית') },
  { cat: 'self_harm', re: he('(?:לחתוך|חותך|חותכת|חתכתי|חותכים)\\s+(?:את\\s+)?(?:עצמי|הידיים|היד|הרגליים|הרגל|הורידים|ורידים)') },
  // "חותכת לעצמי את היד", "חתכתי לעצמי"
  { cat: 'self_harm', re: he('(?:לחתוך|חותך|חותכת|חתכתי|אחתוך)\\s+לעצמי') },
  // "מתחשק לי לחתוך" alone, or "...שוב" (never "לחתוך את המשולש")
  { cat: 'self_harm', re: he(`(?:בא לי|מתחשק לי|אני\\s+${WANT}|${WANT}\\s+שוב)\\s+(?:שוב\\s+)?(?:לחתוך|להיחתך)(?:${END}|\\s+(?:שוב|עוד פעם|בסתר))`) },
  { cat: 'self_harm', re: he('אני\\s+(?:חותך|חותכת)(?:\\s+(?:שוב|כבר|לפעמים|בסתר))?') + END },
  // "יש לי חתכים על היד", "חתכים בידיים"
  { cat: 'self_harm', re: he('חתכים\\s+(?:על\\s+(?:ה)?|ב(?:ה)?)(?:יד|ידיים|רגל|רגליים|גוף|זרוע|זרועות|ירכיים|בטן)') },
  { cat: 'self_harm', re: he('(?:לשרוט|שורט|שורטת|שרטתי|לשרוף|שורף|שורפת|שרפתי|להכאיב|מכאיב|מכאיבה|הכאבתי|להעניש|מעניש|מענישה|להרביץ|מרביץ|מרביצה|הרבצתי|לחנוק|לתלות|לדקור|לירות)\\s+(?:את\\s+|ב)?(?:ל)?עצמי') },
  { cat: 'self_harm', re: '\\b(?:kill myself|killing myself|suicid\\w*|want to die|wanna die|self[- ]?harm|hurt myself|hurting myself|cut myself|cutting myself|wish i was dead|wish i were dead|unalive|end it all|end my life|no reason to live|better off dead|overdose)\\b' },
  { cat: 'self_harm', re: '(?:^|[^0-9\\s])\\s*\\bkms\\b' },
  { cat: 'self_harm', re: "\\b(?:don'?t|do not)\\s+want\\s+to\\s+(?:live|be alive|wake up)\\b" },
  // abuse
  { cat: 'abuse', re: he('(?:מרביץ|מרביצה|מרביצים|הרביץ|הרביצה|הרביצו)\\s+לי') },
  { cat: 'abuse', re: he('(?:מכה|מכים|היכה)\\s+אותי|(?:מרביץ|מרביצה|מכה|הרביץ|הרביצה|היכה)\\s+(?:ל|את\\s+)(?:אמא|אבא|אחי|אחותי|האחים שלי)') },
  { cat: 'abuse', re: he('(?:נוגע|נוגעת|נוגעים|נגע|נגעה)\\s+(?:בי|ב(?:גוף|מקומות))') },
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
  { cat: 'danger', re: he('(?:מאיים|מאיימת|מאיימים|איים|איימו|איימה)\\s+(?:עליי|עלי)') },
  // threats by message: "שולחים לי הודעות מאיימות", "קיבלתי איומים"
  { cat: 'danger', re: he('(?:הודעה|הודעות)\\s+(?:מאיימות|מאיימת|איום|איומים|עם איומים|מפחידות|מפחידה)|(?:קיבלתי|מקבל|מקבלת|מקבלים)\\s+(?:הודעות\\s+(?:עם\\s+)?)?(?:איום|איומים)') },
  // "שלחתי תמונה ועכשיו הוא מאיים", "הוא אומר שיפרסם את התמונות שלי"
  { cat: 'danger', re: he(`(?:הוא|היא|הם|מישהו|מישהי)\\s+(?:מאיים|מאיימת|מאיימים|איים|איימה|איימו)`) + `(?:${END}|\\s+(?:ש|לפרסם|להפיץ|לשלוח|להראות|לספר|לגלות|על))` },
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
  // "כולם בכיתה שונאים אותי", "אף אחד בכיתה לא מדבר איתי"
  { cat: 'bullying', re: he('כולם\\s+(?:ב|מ)(?:ה)?(?:כיתה|בית ספר|בית הספר|שכבה|קבוצה|חוג)(?:\\s+(?:שלי|שלנו))?\\s+(?:שונאים|שונאות|מתעלמים|מתעלמות|צוחקים|צוחקות|מקללים|מקללות|מחרימים|מחרימות|מציקים)\\s+(?:אותי|ממני|עליי|עלי|לי)'), maths: true },
  { cat: 'bullying', re: he('אף אחד\\s+(?:ב|מ)(?:ה)?(?:כיתה|בית ספר|בית הספר|שכבה)\\s+לא\\s+(?:מדבר|מדברת|רוצה|משחק|משחקת)\\s+(?:איתי|לשבת איתי|לשחק איתי)'), maths: true },
  { cat: 'bullying', re: he('(?:מפיצים|הפיצו|מפיצות)\\s+(?:עליי|עלי)\\s+(?:שמועות|דברים|שקרים)|(?:הוציאו|זרקו|העיפו)\\s+אותי\\s+מ(?:ה)?קבוצה') },
  { cat: 'bullying', re: '\\b(?:bullied|bullying me|kys)\\b', maths: true },
  // distress
  { cat: 'distress', re: he('אני\\s+(?:ב)?דיכאון|(?:מרגיש|מרגישה|מרגישים)\\s+(?:ב)?דיכאון|(?:יש לי|נכנסתי ל|נכנסת ל)דיכאון|(?:כל הזמן|כל יום|כל לילה)\\s+(?:אני\\s+)?בוכה|בוכה\\s+(?:כל הזמן|כל יום|כל לילה)|אין לי\\s+(?:אף אחד|חברים|עם מי לדבר)'), maths: true },
  { cat: 'distress', re: he('אני\\s+(?:שונא|שונאת)\\s+את עצמי|אני\\s+(?:(?:מרגיש|מרגישה)\\s+)?(?:חסר|חסרת)\\s+(?:ערך|תועלת)|אף אחד לא\\s+(?:אוהב|אכפת לו)|אני לבד בעולם'), maths: true },
  // "כולם שונאים אותי", "כולם מתעלמים ממני", "נמאס לי מהכל"
  { cat: 'distress', re: he('כולם\\s+(?:שונאים|מתעלמים|מתעלמות)\\s+(?:אותי|ממני)|נמאס לי\\s+(?:מהכל|מהכול|מכל|מכולם)'), maths: true },
  { cat: 'distress', re: he('אני\\s+לא\\s+(?:יכול|יכולה)\\s+יותר'), maths: true },
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

/** The categories, most serious first: a message that matches several gets the first. */
export const DISTRESS_CATEGORIES = Object.freeze(['self_harm', 'abuse', 'danger', 'bullying', 'distress']);

function firstMatch(rule, text) {
  rule.re.lastIndex = 0;
  for (let m = rule.re.exec(text); m; m = rule.re.exec(text)) {
    const end = m.index + m[0].length;
    const after = text.slice(end, end + AFTER_WINDOW);
    const dropped = (rule.maths && MATHS.test(after)) || (rule.mathsIn && MATHS_IN.test(after))
      || (rule.school && SCHOOL.test(after)) || (rule.laugh && LAUGHING.test(text.slice(end)));
    if (!dropped) return true;
    if (m[0].length === 0) rule.re.lastIndex += 1;
  }
  return false;
}

/**
 * Does this text read as a child in distress or danger? → { flag, category } with category one of
 * DISTRESS_CATEGORIES (the most serious one that matched) or null. Runs on the device and on the server, with no
 * network. A maths sentence ("הישר חותך את ציר ה-x", "התרגיל הזה הורג אותי", "הצפרדע קופצת 3 צעדים") does not flag.
 */
export function detectDistress(text) {
  const t = fold(normalize(text));
  if (!t) return { flag: false, category: null };
  // "בא לי למות מצחוק" is laughter, with its spaces or without them
  const squashed = t.replace(/(?:למות|מת|מתה|מתימ)\s*מ?צחוק/g, '').replace(/[^א-תa-z0-9]+/g, '');
  for (const cat of DISTRESS_CATEGORIES) {
    if (RULES.some((r) => r.cat === cat && firstMatch(r, t))) return { flag: true, category: cat };
    if (SQUASHED.some((s) => s.cat === cat && squashed.includes(s.stem) && !s.spaced.test(t) && (cat !== 'distress' || !MATHS_ANY.test(t)))) return { flag: true, category: cat };
  }
  return { flag: false, category: null };
}
