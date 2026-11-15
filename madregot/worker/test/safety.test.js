// shared/safety.js and shared/distress.js: the support details, the prompt's safety block, the fixed care reply, and the
// distress detector (trust spec TRUST-3 §3.1, Appendix E.1a, F and G). Every Appendix G phrase is here, with real Hebrew
// teen phrasing and the maths sentences (algebra included) that must not trigger.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  SUPPORT, CARE_MARK, CARE_STATIC, ANTHROPIC_CHILD_PROMPT, safetyPrompt, normalize,
  maskPersonal, scanPersonal, validIsraeliId, scrubTitle, screenOutput, linkAllowed, blockHit, ALLOWED_LINK_HOSTS, BLOCKED_TEXT,
} from '../../shared/safety.js';
import { detectDistress, distressDetail, readsPersonal, DISTRESS_CATEGORIES } from '../../shared/distress.js';
import { BLOCK_HE, BLOCK_EN } from '../../shared/blocklist.js';
import { CORPUS_FLAG, CORPUS_CLEAR } from './fixtures/distress-corpus.js';

const shared = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'shared');

const MUST_FLAG = [
  // Appendix G
  ['אני רוצה למות', 'self_harm'],
  ['בא לי להיעלם מהעולם', 'self_harm'],
  ['חתכתי את היד אתמול', 'self_harm'],
  ['אני לא רוצה לחיות יותר', 'self_harm'],
  ['רוצההה למותתת', 'self_harm'],
  ['i want to die', 'self_harm'],
  ['אבא שלי מרביץ לי', 'abuse'],
  ['מישהו נוגע בי ואני לא רוצה', 'abuse'],
  ['אני מפחדת לחזור הביתה', 'abuse'],
  ['מישהו באינסטגרם ביקש ממני תמונות', 'danger'],
  ['הוא אמר לי לא לספר להורים', 'danger'],
  ['מאיימים עליי שיפיצו תמונה', 'danger'],
  ['עושים לי חרם בכיתה', 'bullying'],
  ['כל יום צוחקים עליי', 'bullying'],
  ['אני כל הזמן בוכה', 'distress'],
  ['אין לי עם מי לדבר', 'distress'],
  ['אני שונאת את עצמי', 'distress'],
  ['אני לא יכול יותר, הכול רע', 'distress'],
  // hyperbole about death still gets the card, by design
  ['בא לי למות מהמבחן הזה', 'self_harm'],
  // one test for every other pattern
  ['אני רוצה להיעלם', 'self_harm'],
  ['אני חושבת לגמור עם החיים', 'self_harm'],
  ['ולפעמים בא לי להתאבד', 'self_harm'],
  ['קראתי על התאבדות ואני מפחד', 'self_harm'],
  ['אני רוצה לפגוע בעצמי', 'self_harm'],
  ['אני חותכת את עצמי', 'self_harm'],
  ['אין לי סיבה להמשיך לחיות', 'self_harm'],
  ['נמאס לי מהחיים', 'self_harm'],
  ['אין טעם לחיות', 'self_harm'],
  ['עדיף שלא הייתי נולדת', 'self_harm'],
  ['כולם יהיו יותר טוב בלעדיי', 'self_harm'],
  ['sometimes I think about suicide', 'self_harm'],
  ['I KEEP WANTING TO HURT MYSELF', 'self_harm'],
  ['הם מרביצים לי בהפסקה', 'abuse'],
  ['אמא שלי מכה אותי', 'abuse'],
  ['הוא נוגע בגוף שלי', 'abuse'],
  ['הדוד מתעלל בי', 'abuse'],
  ['מישהו הטריד אותי', 'abuse'],
  ['זו הטרדה מינית', 'abuse'],
  ['he abused me', 'abuse'],
  ['מישהו מבקש לשלוח תמונות', 'danger'],
  ['הוא רוצה תמונות בלי בגדים', 'danger'],
  ['מישהו סוחט אותי', 'danger'],
  ['ביקשה לא לספר לאף אחד', 'danger'],
  ['הוא רוצה להיפגש איתי בסוד', 'danger'],
  ['מחרימים אותי', 'bullying'],
  ['מקללים אותי כל הזמן', 'bullying'],
  ['i am being bullied', 'bullying'],
  ['אני בדיכאון', 'distress'],
  ['אני בוכה כל לילה', 'distress'],
  ['אין לי חברים', 'distress'],
  ['אני חסרת ערך', 'distress'],
  ['אני מרגיש חסר ערך', 'distress'],
  ['אף אחד לא אכפת לו ממני', 'distress'],
  ['אני לבד בעולם', 'distress'],
  ['זה הורג אותי בבית', 'distress'],
  // niqqud, gershayim and geresh do not hide a phrase
  ['אֲנִי רוֹצֶה לָמוּת', 'self_harm'],
  // common teen phrasings the first build missed (the trust review's battery)
  ['הלוואי שהייתי מת', 'self_harm'],
  ['הלוואי שהייתי מתה', 'self_harm'],
  ['הלוואי שאמות', 'self_harm'],
  ['הלוואי שלא הייתי נולדת', 'self_harm'],
  ['אין לי כוח לחיות', 'self_harm'],
  ['אני לא רוצה להיות בחיים', 'self_harm'],
  ['לא רוצה להיות פה יותר', 'self_harm'],
  ['אני חותכת לעצמי את היד', 'self_harm'],
  ['חתכתי לעצמי', 'self_harm'],
  ['i wish i was dead', 'self_harm'],
  ['מישהו ביקש שאשלח לו תמונה', 'danger'],
  ['הוא רוצה שאשלח לו תמונות', 'danger'],
  ['מישהו בטיקטוק ביקש תמונה שלי', 'danger'],
  ['ביקש שאצטלם בלי חולצה', 'danger'],
  ['ילד מהכיתה הציע להיפגש איתי בסוד', 'danger'],
  ['מישהו מהאינטרנט הציע לי להיפגש', 'danger'],
  ['כולם שונאים אותי', 'distress'],
  ['כולם מתעלמים ממני', 'distress'],
  ['אני מרגישה בדיכאון', 'distress'],
  ['נמאס לי מהכל', 'distress'],
  // a maths word that says where or since when, or why, never hides bullying
  ['כל יום צוחקים עליי בשיעור מתמטיקה', 'bullying'],
  ['עושים לי חרם מאז המבחן', 'bullying'],
  ['עושים לי חרם בגלל המבחן', 'bullying'],
  ['כולם צוחקים עליי כי לא הבנתי את התרגיל', 'bullying'],
];

const MUST_NOT_FLAG = [
  // Appendix G
  'הישר חותך את ציר ה־x בנקודה 3',
  'נקודת החיתוך של שני הישרים',
  'התרגיל הזה הורג אותי',
  'אני מת מצחוק',
  'מתתי על השאלה הזאת',
  'אני לא יכול יותר עם השברים האלה',
  'המורה מציקה לי עם שיעורי הבית',
  'המורה מציקה לי עם שיעורי בית',
  'x פוגע בציר',
  'הנקודה נוגעת במעגל',
  'המעגל נוגע בישר',
  'הזווית מכה 90 מעלות',
  '2x + 3 = 0',
  'מה הנעלם במשוואה?',
  'פתרון המשוואה הוא 4',
  'מערכת משוואות עם שני נעלמים',
  'מערכת משוואות',
  'פתרון אי־השוויון',
  'אי־שוויון',
  'פתיחת סוגריים וכינוס איברים דומים',
  'כינוס איברים דומים',
  'אין לי מושג',
  'אין לי כוח לשיעורי בית',
  'אני לבד בתרגיל הזה',
  'the line cuts the axis',
  // more maths frustration and slang
  'אני לא יכולה יותר עם המשוואות',
  'אני הולכת למות מצחוק',
  'הישר נוגע בנקודה (2,3)',
  'מה זה שבר?',
  '',
  // "תמונה" is the image of a point or a shape under a transformation, and a request for a picture of school work is
  // about maths (the trust review's false positives)
  'השאלה מבקשת תמונה של המשולש אחרי שיקוף',
  'מבקשים תמונה של הנקודה A בהזזה',
  'ביקשו תמונה של הגרף אחרי הזזה ב-3',
  'המורה ביקשה תמונה של המחברת, איך עושים את תרגיל 3?',
  'ביקשו ממני תמונה של הדף',
  'המורה ביקשה לשלוח תמונות של המחברת',
  'המורה ביקש סרטון של הפתרון',
  'אני רוצה לשלוח תמונה של המחברת',
  // the app's own topics, in the singular and the plural, are maths frustration
  'אני לא יכול יותר עם האחוזים',
  'אני לא יכול יותר עם החזקות',
  'אני לא יכולה יותר עם השבר הזה',
  'אני לא יכול יותר עם הגאומטריה',
  'אני לא יכול יותר עם הזוויות',
  'אני לא יכול יותר עם מספרים מכוונים',
  'אני לא יכולה יותר עם כל השברים האלה',
  'אני לא יכול יותר מהשאלה הזאת',
  'אני לא יכולה יותר עם משפט פיתגורס',
  'אני לא יכול יותר עם שיטת ההצבה',
];

// ---------------------------------------------------------------- the regression corpus (COUNCIL2-1/4)
// CORPUS_FLAG and CORPUS_CLEAR live in test/fixtures/distress-corpus.js: the phrase set a school counsellor is to
// review (an owner step; scripts/distress-sheet.mjs writes it as a sheet).

// The council's two probes, word for word: trust/distress-probe.mjs (31 phrases) and trust-verify/probe2.mjs (56).
const PROBE_FLAG = [
  'בא לי למות', 'אני רוצה להיעלם', 'אין לי בשביל מה לחיות', 'אני שונא את החיים שלי', 'אבא שלי מרביץ לי', 'מישהו בטיקטוק ביקש שאשלח לו תמונה',
  'אני לא רוצה לחיות יותר', 'חושבת לחתוך את עצמי', 'בא לי למות מהמבחן הזה', 'יש לי מחשבות אובדניות', 'אני בדיכאון', 'אני מרגיש ריק מבפנים',
  'אני פוחדת מאבא שלי', 'שולחים לי הודעות מאיימות', 'אני רוצה לברוח מהבית', 'i want to kill myself', 'נמאס לי מהחיים', 'בא לי להתאבד',
  'אני רוצה לישון ולא להתעורר', 'אמא שלי צועקת עליי כל יום ואני פוחדת', 'אני לא אוכלת כבר כמה ימים', 'חבר של אחי נגע בי', 'אף אחד לא אוהב אותי',
  'אני מרגישה שאני לא שווה כלום', 'אני רוצה למות', 'רוצה למות',
  'אני חושב על התאבדות', 'חושבת להתאבד', 'בא לי לגמור עם הכל', 'רוצה למותתתת', 'אני רוצה למות בגלל המבחן', 'אני רוצה למות מהמבחן',
  'אני לא רוצה לחיות', 'אין לי טעם לחיות', 'אני פוגעת בעצמי', 'אני חותכת את עצמי', 'אבא שלי מכה אותי', 'אמא שלי מרביצה לי',
  'מישהו ביקש ממני תמונות', 'מישהו ביקש ממני תמונה בלי בגדים', 'מישהו מאיים עליי', 'כולם צוחקים עליי', 'עושים לי חרם', 'אני בוכה כל יום',
  'אין לי חברים', 'אני שונאת את עצמי', 'אני לא יכולה יותר', 'אני לא יכולה יותר עם החיים', 'בא לי למות.', 'אני רוצה למות!!!',
  'אני רוצה להתאבד', 'לגמור עם החיים', 'אני רוצה לגמור עם הכל', 'אני רוצה לפגוע בעצמי', 'מתחשק לי לחתוך', 'חתכתי את היד',
  'יש לי חתכים על היד', 'אני מקיאה אחרי שאני אוכלת', 'אני רעבה כל הזמן ואין אוכל בבית', 'הוא אמר לי לשמור סוד', 'מבוגר באינסטגרם רוצה לפגוש אותי',
  'שלחתי תמונה ועכשיו הוא מאיים', 'הוא אומר שיפרסם את התמונות שלי', 'מקללים אותי בקבוצה', 'כולם בכיתה שונאים אותי', 'אני מרגישה לבד',
  'אני כל כך עצובה', 'אני עצוב כל הזמן', 'אני לא רוצה להתעורר מחר', 'הלוואי שאמות', 'מתאבדת', 'בא לי להיעלם', 'אני הולכת לקפוץ מהגג',
  'יש לי כדורים ואני רוצה לקחת את כולם', 'i want to die', 'im going to kill myself', 'kms',
  // probe2 listed this one among the sentences that must not flag; being laughed at for not understanding is still
  // bullying here, as "כולם צוחקים עליי כי לא הבנתי את התרגיל" above: a reason never hides it
  'צוחקים עליי כי אני לא מבין שברים',
];
const PROBE_CLEAR = [
  'המשוואה הזאת הורגת אותי', 'הישר חותך את ציר ה-x', 'אני לא יכול יותר עם השברים', 'תמות מצחוק', 'כמה זה 3 כפול 4?',
  'התרגיל הזה הורג אותי', 'בא לי למות מצחוק', 'הגרף נחתך בנקודה 3',
];

test('every Appendix G phrase that must flag flags, with its category', () => {
  for (const [text, category] of MUST_FLAG) {
    assert.deepEqual(detectDistress(text), { flag: true, category }, text);
  }
});

test('maths sentences, algebra vocabulary and maths frustration do not flag', () => {
  for (const text of MUST_NOT_FLAG) assert.deepEqual(detectDistress(text), { flag: false, category: null }, text);
  assert.deepEqual(detectDistress(null), { flag: false, category: null });
  assert.deepEqual(detectDistress(undefined), { flag: false, category: null });
});

test('the regression corpus: 200+ disclosures flag, each with the category of its family', () => {
  assert.ok(CORPUS_FLAG.length >= 200, `${CORPUS_FLAG.length} phrases`);
  for (const [text, category] of CORPUS_FLAG) assert.deepEqual(detectDistress(text), { flag: true, category }, text);
  // every family is there: suicidal thoughts, a plan, self-harm, fear at home, threats, bullying, running away, eating
  const n = (cat) => CORPUS_FLAG.filter(([, c]) => c === cat).length;
  for (const cat of DISTRESS_CATEGORIES) assert.ok(n(cat) >= 8, `${cat}: ${n(cat)}`);
});

test('the council\'s probes: every disclosure flags (31 + 56), and their maths sentences do not', () => {
  const missed = PROBE_FLAG.filter((t) => !detectDistress(t).flag);
  assert.deepEqual(missed, []);
  for (const t of PROBE_CLEAR) assert.deepEqual(detectDistress(t), { flag: false, category: null }, t);
});

test('the regression corpus: maths words that are also distress words, and everyday school sentences, never flag', () => {
  assert.ok(CORPUS_CLEAR.length >= 120, `${CORPUS_CLEAR.length} sentences`);
  const flagged = CORPUS_CLEAR.map((t) => [t, detectDistress(t)]).filter(([, r]) => r.flag).map(([t, r]) => `${r.category}: ${t}`);
  assert.deepEqual(flagged, []);
});

test('a first person or an intent decides: the same maths word flags only beside one', () => {
  const pairs = [
    ['הצפרדע קופצת מהנקודה 3', 'אני הולכת לקפוץ מהגג'],
    ['בשקית 12 כדורים ונועה רוצה לקחת את כולם לגינה', 'יש לי כדורים ואני רוצה לקחת את כולם'],
    ['x לא שווה 3', 'אני לא שווה כלום'],
    ['הישר הולך לחתוך את הציר', 'מתחשק לי לחתוך'],
    ['המורה פרסמה את התמונות מהטיול', 'הוא אומר שיפרסם את התמונות שלי'],
    ['שלחתי תמונה של המחברת למורה', 'שלחתי תמונה ועכשיו הוא מאיים'],
    ['אני רוצה לגמור עם הכל עד מחר', 'בא לי לגמור עם הכל'],
    ['אני לא רוצה להתעורר מחר מוקדם', 'אני לא רוצה להתעורר מחר'],
    ['אמא אמרה לי לשמור סוד על המתנה', 'הוא אמר לי לשמור סוד'],
    ['המכונה סוחטת 3 תפוזים בדקה', 'מישהו סוחט אותי'],
    ['אני מפחד מהמבחן', 'אני מפחד מאבא'],
    ['אני ממש לבד בתרגיל הזה', 'אני ממש לבד'],
  ];
  for (const [maths, child] of pairs) {
    assert.equal(detectDistress(maths).flag, false, maths);
    assert.equal(detectDistress(child).flag, true, child);
  }
});

test('final letters typed as ordinary ones, and a missing space, still flag; spaces kept as words keep the maths rule', () => {
  assert.equal(detectDistress('אני רוצה לגמור עם החיימ').category, 'self_harm');
  assert.equal(detectDistress('אין לי חברימ').category, 'distress');
  assert.equal(detectDistress('רוצהלמות').category, 'self_harm');
  assert.equal(detectDistress('מחשבותאובדניות').category, 'self_harm');
  assert.equal(detectDistress('אניפוחדת מאבא שלי').category, 'abuse');
  // "בא לי למות מצחוק" is laughter with its spaces or without them
  assert.equal(detectDistress('באלילמותמצחוק').flag, false);
  // a squashed distress phrase in a message about maths is about the maths
  assert.equal(detectDistress('אנימרגישה לבד עם השברים').flag, false);
  assert.equal(detectDistress('אני מרגישה לבד עם השברים').flag, false);
  // "אובדן" (a loss) is not "אובדני"
  assert.equal(detectDistress('אחוז האובדן בייצור הוא 5').flag, false);
});

test('the maths words are the app\'s own topics and stairs: each name after "עם" is maths frustration', async () => {
  const { TOPIC_NAMES, STAIR_NAMES } = await import('../../shared/stairs.js');
  for (const name of [...Object.values(TOPIC_NAMES), ...Object.values(STAIR_NAMES)]) {
    assert.equal(detectDistress(`אני לא יכול יותר עם ${name}`).flag, false, name);
  }
  // ... but only as the object of the complaint: where it happens is not maths frustration
  assert.equal(detectDistress('אני לא יכול יותר עם מה שקורה בבית').flag, true);
  assert.equal(detectDistress('אני לא יכול יותר, בבית צועקים כל הזמן').flag, true);
});

test('maths frustration drops only distress and bullying: self-harm, abuse and danger near a maths word still flag', () => {
  assert.equal(detectDistress('אני לא יכול יותר עם התרגיל').flag, false);
  assert.equal(detectDistress('אני לא יכול יותר').flag, true);
  assert.equal(detectDistress('אני רוצה למות בגלל המבחן').category, 'self_harm');
  assert.equal(detectDistress('אבא מרביץ לי בגלל המבחן').category, 'abuse');
  assert.equal(detectDistress('מישהו ביקש ממני תמונות של שיעורי הבית').category, 'danger');
  // "killing me" counts only about home, never about an exercise
  assert.equal(detectDistress('השאלה הזאת הורגת אותי').flag, false);
  assert.equal(detectDistress('אמא הורגת אותי').flag, false);
});

test('a message with several categories gets the most serious one', () => {
  assert.deepEqual([...DISTRESS_CATEGORIES], ['self_harm', 'abuse', 'danger', 'bullying', 'distress']);
  assert.equal(detectDistress('עושים לי חרם ואני רוצה למות').category, 'self_harm');
  assert.equal(detectDistress('אין לי חברים ואבא מרביץ לי').category, 'abuse');
});

test('the corpus has grown to 280 disclosures, and one sentence the review listed as maths still flags, by design', () => {
  assert.ok(CORPUS_FLAG.length >= 280, `${CORPUS_FLAG.length} phrases`);
  // "בא לי לחתוך" with nothing to cut reads as an urge to cut, as "מתחשק לי לחתוך" does (the council's own probe); with
  // something to cut, or in a sentence about a line or a shape, it does not. It is never `sure`: no adult is alerted.
  assert.deepEqual(distressDetail('בא לי לחתוך'), { flag: true, category: 'self_harm', categories: ['self_harm'], home: false, sure: false });
  for (const maths of ['בא לי לחתוך את המשולש', 'בנקודה הזאת בא לי לחתוך', 'אני הולך לחתוך את המשולש לשניים']) assert.equal(detectDistress(maths).flag, false, maths);
});

test('distressDetail: every category that matched, whether the message is about home, and whether it is unambiguous', () => {
  const d = (t) => distressDetail(t);
  // a message with two categories names both, the most serious first
  assert.deepEqual(d('אבא שלי מרביץ לי כל יום ואני רוצה למות'), { flag: true, category: 'self_harm', categories: ['self_harm', 'abuse'], home: true, sure: true });
  assert.deepEqual(d('אני פוחדת מאבא שלי ויש לי מחשבות אובדניות').categories, ['self_harm', 'abuse']);
  assert.deepEqual(d('עושים עליי חרם ואין לי אף אחד').categories, ['bullying', 'distress']);
  // home: an abuse rule, or a parent or the home named beside anything else
  for (const t of ['אבא שלי מרביץ לי', 'קשה לי בבית ואני רוצה להתאבד', 'אמא שלי לא יודעת שאני חותכת את עצמי', 'אני רוצה למות, ההורים שלי רבים כל הזמן', 'ابوي بيضربني وبدي اموت']) assert.equal(d(t).home, true, t);
  for (const t of ['אני רוצה למות', 'אחי אני רוצה למות', 'עושים עליי חרם', 'بدي اموت']) assert.equal(d(t).home, false, t);
  // ... also when no rule matches (the optional classifier may flag what the list does not)
  assert.deepEqual(d('אמא שלי אומרת שאני סתם נטל על כולם'), { flag: false, category: null, categories: [], home: true, sure: false });
  // sure: a plain statement of suicide or self-harm
  for (const t of ['אני רוצה למות', 'אני רוצה להרוג את עצמי', 'יש לי מחשבות אובדניות', 'אני חותכת את עצמי', 'בלעתי 20 כדורים', 'שתיתי אקונומיקה',
    'אני הולכת לקפוץ מהגג', 'אני רוצה לישון ולא להתעורר', 'i want to kill myself', 'بدي انتحر']) assert.equal(d(t).sure, true, t);
  // never sure: a word that is also maths or slang, the softer rules, and every other category
  for (const t of ['בא לי למות מהמבחן הזה', 'אני חותכת', 'מתחשק לי לחתוך', 'אני לא שווה כלום', 'בא לי להיעלם', 'נמאס לי מהחיים', 'אני רוצה לא להיות',
    'יש לי כדורים ואני רוצה לקחת את כולם', 'רוצהלמות', 'אבא שלי מרביץ לי', 'עושים עליי חרם', 'אני בדיכאון']) {
    assert.equal(d(t).flag, true, t); assert.equal(d(t).sure, false, t);
  }
  assert.deepEqual(d(''), { flag: false, category: null, categories: [], home: false, sure: false });
  assert.deepEqual(d(null), { flag: false, category: null, categories: [], home: false, sure: false });
});

test('readsPersonal: a message that is not about maths at all (no digit, no maths or study word, three words or more)', () => {
  // what the review typed with no parent's OK: with or without a rule for it, the screen shows the support card
  for (const t of ['אני רוצה להרוג את עצמי', 'הוא אנס אותי', 'עושים עליי חרם', 'קשה לי מאוד בזמן האחרון', 'אף אחד לא מדבר איתי בבית', 'ההורים שלי מתגרשים ואני לא ישנה',
    'انا تعبان من كل شي']) assert.equal(readsPersonal(t), true, t);
  // maths, the lesson's own words, a number said in words, one or two words
  for (const t of ['בלעתי 20 כדורים', 'אפשר רמז קטן?', 'כמה זה 3 ועוד 5', 'x שווה כמה', 'איך פותרים את זה', 'אני לא מבין כלום', 'איך מתחילים?', 'מה הטעות שלי?',
    'למה התשובה שלילית', 'שלוש פחות חמש זה כמה', 'היי', 'תודה רבה', 'לא הבנתי', '', 'מה ההבדל בין חציון לממוצע?', 'אני רוצה לתרגל עוד שברים',
    'איך מחשבים שטח של משולש', 'לא ברור לי השלב השני']) assert.equal(readsPersonal(t), false, t);
});

test('maskPersonal: an exercise about streets keeps its numbers, a list of digits for statistics is no phone, and an address with no street word is one (the review)', () => {
  const same = (t) => assert.deepEqual(maskPersonal(t), { text: t, found: [] }, t);
  // the mask ate the question: the two house numbers and ", מה ההפרש"
  same('דני גר ברחוב הרצל 15 ויוסי ברחוב הרצל 27, מה ההפרש?');
  same('נועה גרה ברחוב הגפן 8, כמה בתים בינה לבין בית מספר 20?');
  same('0 5 4 1 2 3 4 5 6 7 מה החציון?');
  same('סדרו את הספרות 0 5 2 1 2 3 4 5 6 7 מהקטנה לגדולה');
  same('דני גר בקומה 3 ויוסי בקומה 7');
  same('היא גרה בחיפה 5 שנים');
  // a city after a comma is taken only when the sentence ends there
  assert.deepEqual(maskPersonal('אני גר ברחוב הרצל 15, ואני לא מבין את התרגיל'), { text: 'אני גר ב[כתובת], ואני לא מבין את התרגיל', found: ['address'] });
  assert.deepEqual(maskPersonal('אני גרה ברחוב הרצל 12, תל אביב. מה התשובה?'), { text: 'אני גרה ב[כתובת]. מה התשובה?', found: ['address'] });
  // the same address said without a street word
  assert.deepEqual(maskPersonal('אני גרה בהרצל 15 דירה 4 רמת גן'), { text: 'אני גרה ב[כתובת]', found: ['address'] });
  assert.deepEqual(maskPersonal('הכתובת שלי: ויצמן 12 כפר סבא'), { text: 'הכתובת שלי: [כתובת]', found: ['address'] });
  assert.deepEqual(maskPersonal('הכתובת שלנו היא בן גוריון 7, חולון'), { text: 'הכתובת שלנו היא [כתובת]', found: ['address'] });
  // a spread-out phone with no statistics word beside it is still a phone
  assert.deepEqual(maskPersonal('הטלפון שלי 0 5 4 1 2 3 4 5 6 7'), { text: 'הטלפון שלי [טלפון]', found: ['phone'] });
});

test('normalize: niqqud and cantillation, maqaf, geresh and gershayim, repeated letters, case and spaces; final letters stay', () => {
  assert.equal(normalize('שָׁלוֹם'), 'שלום');
  assert.equal(normalize('בְּרֵאשִׁ֖ית'), 'בראשית', 'cantillation marks go too');
  assert.equal(normalize('ה־x'), 'ה-x');
  assert.equal(normalize('ער״ן'), 'ער"ן');
  assert.equal(normalize('ער"ן'), 'ער"ן');
  assert.equal(normalize('צ׳אט'), "צ'אט");
  assert.equal(normalize('צ’אט'), "צ'אט");
  assert.equal(normalize('רוצההה למותתת'), 'רוצה למות');
  assert.equal(normalize('ממש'), 'ממש', 'a letter twice stays');
  assert.equal(normalize('  I   WANT\n\tto DIE '), 'i want to die');
  assert.equal(normalize('ךםןףץ'), 'ךםןףץ', 'final letters are not changed');
  assert.equal(normalize('ﬁ'), 'fi', 'NFKC');
  assert.equal(normalize(null), '');
});

test('SUPPORT holds the numbers checked on 2026-11-10, with ער״ן WhatsApp and chat at 08:00–02:00 (not 24/7)', () => {
  assert.equal(SUPPORT.checked, '2026-11-10');
  assert.equal(SUPPORT.eran.phone, '1201');
  assert.equal(SUPPORT.eran.phoneHours, 'בכל שעה');
  assert.equal(SUPPORT.eran.whatsapp, '052-845-1201');
  assert.equal(SUPPORT.eran.wa, 'https://wa.me/972528451201');
  assert.equal(SUPPORT.eran.web, 'https://www.eran.org.il/online-emotional-help/');
  assert.equal(SUPPORT.eran.textHours, '08:00–02:00');
  assert.equal(SUPPORT.sahar.whatsapp, '055-957-1399');
  assert.equal(SUPPORT.sahar.wa, 'https://wa.me/972559571399');
  assert.equal(SUPPORT.sahar.web, 'https://sahar.org.il');
  assert.equal(SUPPORT.sahar.hours, 'א׳–ה׳ 16:00–03:00, שישי, שבת וערבי חג 18:00–00:00');
  assert.equal(SUPPORT.online.phone, '105');
  assert.equal(SUPPORT.police, '100');
  assert.equal(SUPPORT.mda, '101');
  // each wa.me link is the WhatsApp number in international form
  for (const s of [SUPPORT.eran, SUPPORT.sahar]) assert.equal(s.wa, `https://wa.me/972${s.whatsapp.replace(/-/g, '').slice(1)}`);
  assert.ok(Object.isFrozen(SUPPORT) && Object.isFrozen(SUPPORT.eran));
  assert.equal(CARE_MARK, '[[care]]');
});

test('the safety block (Appendix F) carries every number and the care line; the child-safety prompt goes first when set', () => {
  const p = safetyPrompt();
  assert.ok(p.startsWith('Safety comes before mathematics, always.'));
  for (const s of ['1201', '052-845-1201', '08:00–02:00', '055-957-1399', 'sahar.org.il', '105', 'משטרה 100', 'מד״א 101', '[[care]]']) {
    assert.ok(p.includes(s), s);
  }
  assert.match(p, /In a JSON answer, set "care" to true instead\./);
  assert.match(p, /Do not promise to keep a secret\./);
  assert.match(p, /Never describe methods of self-harm\./);
  assert.ok(!/only help with math/.test(p));
  assert.equal(ANTHROPIC_CHILD_PROMPT, '', 'empty until the owner pastes Anthropic\'s prompt (TRUST-15)');
  const withChild = safetyPrompt({ childPrompt: '  CHILD SAFETY PROMPT  ' });
  assert.ok(withChild.startsWith('CHILD SAFETY PROMPT\n\nSafety comes before mathematics, always.'));
  assert.equal(safetyPrompt({ childPrompt: '' }), p);
});

test('the fixed care reply is Appendix E.1a word for word', () => {
  assert.equal(CARE_STATIC, 'תודה שכתבתם. מה שאתם מרגישים חשוב, וזה לא באשמתכם. מגיע לכם שמישהו ידבר איתכם עכשיו: הורה, היועצת או היועץ בבית הספר, או מורה. אפשר גם להתקשר בחינם ובלי לומר שם לער״ן, 1201, בכל שעה. אם אתם בסכנה עכשיו: משטרה 100, מד״א 101.');
});

test('no file in shared/ uses a regex lookbehind or named group "(?<" (Safari 16.0 cannot parse it)', () => {
  const files = readdirSync(shared).filter((f) => f.endsWith('.js'));
  assert.ok(files.includes('safety.js'));
  for (const f of files) assert.ok(!readFileSync(path.join(shared, f), 'utf8').includes('(?<'), f);
});

// ---------------------------------------------------------------- personal details (trust spec TRUST-4 §4.1)
test('maskPersonal: an ID is masked only when it passes the check digit and an ID word is just before it', () => {
  assert.equal(validIsraeliId('123456782'), true);
  assert.equal(validIsraeliId('123456789'), false);
  assert.deepEqual(maskPersonal('תעודת זהות 123456782'), { text: 'תעודת זהות [ת״ז]', found: ['id'] });
  for (const word of ['ת״ז', 'ת"ז', 'תז', 'ת.ז', 'מספר זהות', 'מספר הזהות', 'תעודת הזהות', 'id', 'ID', 'id number']) assert.equal(maskPersonal(`${word}: 123456782`).text, `${word}: [ת״ז]`, word);
  assert.deepEqual(maskPersonal('מספר הזהות שלי הוא 123456782'), { text: 'מספר הזהות שלי הוא [ת״ז]', found: ['id'] });
  assert.deepEqual(maskPersonal('my id is 123456782'), { text: 'my id is [ת״ז]', found: ['id'] });
  assert.equal(maskPersonal('the idea is 123456782').found.length, 0, '"id" only as a whole word');
  assert.deepEqual(maskPersonal('123456782 + 1'), { text: '123456782 + 1', found: [] }, 'a maths number with no ID word');
  assert.deepEqual(maskPersonal('ת״ז 123456789'), { text: 'ת״ז 123456789', found: [] }, 'a bad check digit');
  assert.equal(maskPersonal(`תעודת זהות ${'ש'.repeat(25)} 123456782`).text.includes('123456782'), true, 'the ID word is more than 20 characters away');
  assert.equal(maskPersonal('ת״ז 1234567820').found.length, 0, 'ten digits are not an ID');
});

test('maskPersonal: Israeli phones in six formats, and a phone is a phone even in a maths question', () => {
  for (const p of ['0521234567', '052-1234567', '052-123-4567', '052 123 4567', '+972-52-1234567', '+972521234567', '03-1234567', '972 52 123 4567', '077-1234567',
    '(054) 123-4567', '054.123.4567', '(03) 123 4567', '+972 (54) 123 4567']) {
    assert.deepEqual(maskPersonal(`תתקשרו ${p} בערב`), { text: 'תתקשרו [טלפון] בערב', found: ['phone'] }, p);
  }
  assert.equal(maskPersonal('x = 0521234567').text, 'x = [טלפון]', 'documented: a phone is a phone');
  assert.equal(maskPersonal('1234567890').found.length, 0, 'not a phone: no 0 or 972 in front');
  assert.equal(maskPersonal('3 + 052').found.length, 0);
  assert.equal(maskPersonal('105201234567').found.length, 0, 'digits right before the number: not a phone');
  for (const m of ['0.5 + 0.25', '3.1234567', '(0.5)', '0.125 * 8']) assert.equal(maskPersonal(m).found.length, 0, `${m}: a decimal is not a phone`);
});

test('maskPersonal: a phone with its digits spread out or split oddly (COUNCIL2-9)', () => {
  // the trust skeptic's two: every digit apart, and a group cut in the wrong place
  for (const p of ['0 5 4 1 2 3 4 5 6 7', '05412345 67', '054 12 34 567', '0 3 1 2 3 4 5 6 7', '+972 5 4 1 2 3 4 5 6 7', '054-12-34-567']) {
    assert.deepEqual(maskPersonal(`המספר שלי ${p} תתקשרו`), { text: 'המספר שלי [טלפון] תתקשרו', found: ['phone'] }, p);
  }
  // maths stays: a decimal, a list that is longer than a phone, digits that come after other digits, a chain of minus signs
  for (const m of ['0.521234567', '3 0 5 4 1 2 3 4 5 6 7', '1 2 3 4 5 6 7 8 9 0', '0 5 4 1 2', '0-5-4-1-2-3-4-5-6-7', '0 5 4 1 2 3 4 5 6 7 8']) {
    assert.equal(maskPersonal(m).found.length, 0, m);
  }
});

test('maskPersonal: a street address with its number, and the city after it (COUNCIL2-9)', () => {
  assert.deepEqual(maskPersonal('אני גרה ברחוב הרצל 12, תל אביב'), { text: 'אני גרה ב[כתובת]', found: ['address'] });
  assert.deepEqual(maskPersonal('הכתובת: רח׳ בן יהודה 5א בחיפה. מה התשובה?'), { text: 'הכתובת: [כתובת]. מה התשובה?', found: ['address'] });
  assert.deepEqual(maskPersonal('שדרות רוטשילד 40 תל אביב'), { text: '[כתובת] תל אביב', found: ['address'] }, 'the street and number go even when the city is not marked off');
  assert.equal(maskPersonal('ברחוב שלנו 12 בתים, בכל בית 3 חלונות').found.length, 0, 'a word problem about a street');
  assert.equal(maskPersonal('ברחוב יש 12 בתים').found.length, 0);
  assert.equal(maskPersonal('הרחוב ארוך 300 מטר').found.length, 0, 'no street word right before a name');
  assert.deepEqual(maskPersonal('0521234567, רחוב הגפן 3, רמת גן, a@b.co').found, ['email', 'phone', 'address'], 'the fixed order, address last');
  assert.deepEqual(scanPersonal(['רחוב הגפן 3, רמת גן']), ['address']);
});

test('maskPersonal: emails; several kinds at once in a fixed order; scanPersonal counts them together', () => {
  assert.deepEqual(maskPersonal('כתבו לי ל-noa.k@example.test'), { text: 'כתבו לי ל-[מייל]', found: ['email'] });
  assert.deepEqual(maskPersonal('ת״ז 123456782, 0521234567, a@b.co').found, ['email', 'phone', 'id']);
  assert.deepEqual(scanPersonal(['0521234567', 'a@b.co', 'שלום']), ['email', 'phone']);
  assert.deepEqual(scanPersonal([undefined, '', 'כמה זה 3 + 4?']), []);
});

test('scrubTitle: an exam title keeps no ID, phone or run of 7 digits', () => {
  assert.equal(scrubTitle('מבחן של נועה כהן ת״ז 123456782'), 'מבחן של נועה כהן ת״ז [ת״ז]');
  assert.equal(scrubTitle('מבחן 0521234567'), 'מבחן [טלפון]');
  assert.equal(scrubTitle('מבחן 1234567 ו-123456789012'), 'מבחן # ו-#');
  assert.equal(scrubTitle('מבחן בשברים 2026'), 'מבחן בשברים 2026');
  assert.doesNotMatch(scrubTitle('ת״ז 123456789 טלפון 5551234'), /\d{7,}/);
});

// ---------------------------------------------------------------- every reply screened (trust spec TRUST-4 §4.2)
test('screenOutput: links to hosts that are not allowed keep only their text; look-alike hosts are rejected', () => {
  assert.deepEqual(screenOutput('ראו [קישור](https://evil.example)'), { text: 'ראו קישור', blocked: false, linksRemoved: 1 });
  const keep = 'ער״ן: https://www.eran.org.il/online-emotional-help/ והטופס: https://parents.education.gov.il/prhnet/x';
  assert.deepEqual(screenOutput(keep), { text: keep, blocked: false, linksRemoved: 0 });
  assert.deepEqual(screenOutput('[ער״ן](https://www.eran.org.il/online-emotional-help/)').linksRemoved, 0);
  assert.deepEqual(screenOutput('א https://gov.il.evil.example/ ב https://evil-gov.il/x. ג'), { text: 'א  ב . ג', blocked: false, linksRemoved: 2 });
  assert.equal(screenOutput('www.evil.example/page').text, '');
  assert.equal(screenOutput('<https://evil.example> שלום').text, ' שלום', 'an autolink');
  assert.equal(screenOutput('![תמונה](https://wa.me/x.png)').text, 'תמונה', 'an image is never shown, whatever its host');
  assert.equal(screenOutput('[a][1]\n\n[1]: https://evil.example').text, '[a][1]\n\n', 'a link definition');
  assert.equal(screenOutput('[a](https://user@wa.me/x)').text, 'a', 'a user name in the address');
  assert.equal(screenOutput('[a](javascript:alert(1))').linksRemoved, 1);
  // the app's own address, exactly
  assert.equal(screenOutput('[האפליקציה](https://madregot.example.test/#/safety)', { hosts: ['madregot.example.test'] }).linksRemoved, 0);
  assert.equal(screenOutput('[x](https://evil.madregot.example.test/)', { hosts: ['madregot.example.test'] }).linksRemoved, 1);
});

test('linkAllowed: the allowed hosts and their subdomains, https or http, and tel: only to the support numbers', () => {
  assert.deepEqual([...ALLOWED_LINK_HOSTS], ['eran.org.il', 'sahar.org.il', 'wa.me', 'gov.il']);
  for (const ok of ['https://wa.me/972528451201', 'https://sahar.org.il', 'https://www.police.gov.il/', 'https://gov.il', 'https://ERAN.org.il/', 'tel:1201', 'tel:105', 'tel:100', 'tel:101']) assert.equal(linkAllowed(ok), true, ok);
  for (const bad of ['https://evil-gov.il/', 'https://gov.il.evil.example/', 'https://notwa.me/', 'https://wa.me.evil.example/', 'ftp://gov.il/', 'tel:0521234567', '/relative', '#/safety', '', 'javascript:alert(1)', 'data:text/html,x']) assert.equal(linkAllowed(bad), false, bad);
  for (const s of [SUPPORT.eran.wa, SUPPORT.sahar.wa, SUPPORT.eran.web, SUPPORT.sahar.web]) assert.equal(linkAllowed(s), true, s);
});

test('the blocklist: 40-80 terms that block a reply; a care reply that names what happened is never blocked', () => {
  const n = BLOCK_HE.length + BLOCK_EN.length;
  assert.ok(n >= 40 && n <= 80, `${n} terms`);
  for (const t of [...BLOCK_HE, ...BLOCK_EN]) {
    assert.equal(blockHit(`זה ${t}.`), true, t);
    assert.deepEqual(screenOutput(`בתשובה: ${t}`), { text: '', blocked: true, linksRemoved: 0 }, t);
  }
  assert.equal(blockHit('WHAT THE FUUUCK'), true, 'case and repeated letters do not hide a word');
  // the long and brand forms, and words spelled out or starred (the trust review's battery)
  for (const w of ['פורנוגרפיה', 'אתר פורנוגרפי', 'pornhub', 'xvideos', 'pornstars', 'sexual', 'ס ק ס', 'ס.ק.ס', 'f*ck', 'f**k', 'p*rn', 'ז*ן', 'f-u-c-k']) {
    assert.equal(blockHit(w), true, w);
    assert.equal(screenOutput(`בתשובה: ${w}`).blocked, true, w);
  }
  // a care reply (a child wrote that someone hurt them) must be able to name it; its links are still screened
  const care = 'פגיעה מינית היא אף פעם לא באשמתכם. אם מישהו ניסה לאנוס אתכם, ספרו למבוגר. [עוד](https://evil.example)';
  assert.deepEqual(screenOutput(care, { care: true }), { text: care.replace('[עוד](https://evil.example)', 'עוד'), blocked: false, linksRemoved: 1 });
  assert.equal(screenOutput('פגיעה מינית היא אף פעם לא באשמתכם.').blocked, false, '"פגיעה מינית" is not on the list');
  assert.equal(screenOutput(care).blocked, true, 'the same reply outside care follows the blocklist rule');
  assert.equal(BLOCKED_TEXT, 'לא הצלחתי לענות על זה כמו שצריך. אפשר לנסח את השאלה אחרת?');
});

test('maths and teaching words are never blocked, nor any text the app itself shows', () => {
  for (const w of ['sextant', 'Essex', 'analysis', 'therapist', 'sussex', 'spice', 'scunthorpe', 'סקאלה', 'מכפלה', 'חזקה', 'שורש', 'ציר',
    'מזינים את המספר', 'זינוק', 'מקסימום', 'אנליזה', 'כוס מים', 'מזין', 'המפגש', 'שחיטת', 'אונסקו', 'זינה', 'זיונית',
    // maths with stars, spaced letters and markdown is never read as a hidden word
    'a * b', '2*3 = 6', 'x*y', '3*4=12', 'x y z', 'a b c d', 'ש ל ו ם', 'ס ק א ל ה', '**התשובה: 8**', 'x_1 + x_2', 'כ ו ס', '***', 'f***']) {
    assert.equal(blockHit(w), false, w);
  }
  // every string in the app's content (lessons, generators, copy) and the prompts
  const root = path.join(shared, '..', 'web', 'src');
  const files = [];
  const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.(js|jsx|ts|md)$/.test(e.name) && !/\.test\./.test(e.name)) files.push(p); } };
  walk(path.join(root, 'content')); walk(path.join(root, 'screens'));
  files.push(path.join(shared, 'ai.js'), path.join(shared, 'safety.js'), path.join(shared, 'distress.js'));
  assert.ok(files.length > 20);
  for (const f of files) {
    readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      // the blocklist is defined only in shared/blocklist.js; nothing the app says may hit it
      assert.equal(blockHit(line), false, `${path.relative(root, f)}:${i + 1}`);
    });
  }
});

test('blocklist.js, safety.js and distress.js hold no regex lookbehind', () => {
  for (const f of ['blocklist.js', 'safety.js', 'distress.js']) assert.ok(!readFileSync(path.join(shared, f), 'utf8').includes('(?<'), f);
});

test('the counsellor\'s sheet (scripts/distress-sheet.mjs): every phrase of both lists, Hebrew and Arabic, with its family and two empty columns', async () => {
  const { sheetRows, sheetCsv, FAMILY, LISTS, HEAD } = await import('../scripts/distress-sheet.mjs');
  const { AR_FLAG, AR_CLEAR } = await import('./fixtures/distress-corpus.js');
  const rows = sheetRows();
  const arabic = Object.values(AR_FLAG).flat();
  assert.equal(rows.length, CORPUS_FLAG.length + CORPUS_CLEAR.length + arabic.length + AR_CLEAR.length);
  // each family has a name the counsellor can read, and every phrase that must flag carries one
  assert.deepEqual(Object.keys(FAMILY), [...DISTRESS_CATEGORIES]);
  for (const r of rows.filter((x) => x[0] === LISTS.flag)) assert.ok(Object.values(FAMILY).includes(r[2]), r[3]);
  for (const r of rows.filter((x) => x[0] === LISTS.clear)) assert.equal(r[2], '');
  // the sheet says what the detector does: a row of the first list flags, a row of the second does not
  for (const r of rows) assert.equal(detectDistress(r[3]).flag, r[0] === LISTS.flag, r[3]);
  for (const text of ['אני רוצה להרוג את עצמי', 'עושים עליי חרם', 'הצפרדע קופצת 3 צעדים ימינה על ציר המספרים', 'امي بتضربني كل يوم', 'للمعادلة حل وحيد']) assert.ok(rows.some((r) => r[3] === text), text);
  // the file: a byte order mark (Excel reads Hebrew), the heading, every cell quoted, one line per phrase
  const csv = sheetCsv();
  assert.ok(csv.startsWith('\uFEFF"רשימה","שפה","סוג","ניסוח","נכון? (כן / לא)","הערה"\r\n'));
  const lines = csv.trimEnd().split('\r\n');
  assert.equal(lines.length, rows.length + 1);
  assert.equal(HEAD.length, 6);
  for (const line of lines.slice(1)) assert.match(line, /^"[^"]+","(עברית|ערבית)","[^"]*","(?:[^"]|"")+","",""$/);
});
