// shared/safety.js: the support details, the prompt's safety block, the fixed care reply, and the distress detector
// (trust spec TRUST-3 §3.1, Appendix E.1a, F and G). Every Appendix G phrase is here, with real Hebrew teen phrasing and
// the maths sentences (algebra included) that must not trigger.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  SUPPORT, CARE_MARK, CARE_STATIC, ANTHROPIC_CHILD_PROMPT, safetyPrompt, normalize, detectDistress, DISTRESS_CATEGORIES,
} from '../../shared/safety.js';

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
  'כולם צוחקים עליי כי לא הבנתי את התרגיל',
  'אני הולכת למות מצחוק',
  'הישר נוגע בנקודה (2,3)',
  'מה זה שבר?',
  '',
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
