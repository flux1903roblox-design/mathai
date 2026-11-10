// Safety first, for the AI tutor (trust spec TRUST-3). Shared by the Worker and the browser, so the support details,
// the prompt's safety block and the distress detector have one source.
//
// This file ships to the browser. Vite targets Safari 16.0, which has no regex lookbehind, and a lookbehind literal
// stops the whole chunk from loading there: a Hebrew word start is written (?:^|[^א-ת]) and a word end (?![א-ת]).
// worker/test/safety.test.js fails on a lookbehind anywhere in shared/.

/**
 * Free services for a child who needs a person. Checked against each service's own site on the date in `checked`;
 * dailySummary (worker/src/cron.js) reminds the owner to check them again once that date is more than 330 days old.
 * ער״ן answers the phone at any hour, but its WhatsApp and chat only 08:00–02:00.
 */
export const SUPPORT = Object.freeze({
  checked: '2026-11-10',
  eran: Object.freeze({
    name: 'ער״ן', phone: '1201', phoneHours: 'בכל שעה', whatsapp: '052-845-1201', wa: 'https://wa.me/972528451201',
    web: 'https://www.eran.org.il/online-emotional-help/', textHours: '08:00–02:00',
  }),
  sahar: Object.freeze({
    name: 'סה״ר', whatsapp: '055-957-1399', wa: 'https://wa.me/972559571399', web: 'https://sahar.org.il',
    hours: 'א׳–ה׳ 16:00–03:00, שישי, שבת וערבי חג 18:00–00:00',
  }),
  online: Object.freeze({ name: 'המוקד הלאומי להגנה על ילדים ברשת', phone: '105', hours: 'בכל שעה' }),
  police: '100',
  mda: '101',
});

/** The model starts a care reply with this line; the app removes it and shows the support card instead. */
export const CARE_MARK = '[[care]]';

/**
 * Anthropic's child-safety system prompt, if Anthropic provides one for this organisation. The owner pastes it here
 * (trust spec TRUST-15 step 3) and deploys; safetyPrompt() then puts it first, before everything else.
 */
export const ANTHROPIC_CHILD_PROMPT = '';

/** The safety block at the top of every tutor prompt, in every kind and every shape (trust spec Appendix F). */
export function safetyPrompt({ childPrompt = ANTHROPIC_CHILD_PROMPT } = {}) {
  const { eran, sahar, online, police, mda } = SUPPORT;
  const block = `Safety comes before mathematics, always.
If the student writes, or a photographed page shows, that they are very sad, scared, hopeless or alone; that someone is hurting, hitting, threatening, bullying, blackmailing or touching them; that someone online asked them for photos, to meet, or to keep a secret from their parents; that they think about hurting themselves or about dying; or that they are in any danger:
- Stop the mathematics. In this reply do not mention the exercise, marks, the exam, or getting back to work.
- Answer in warm, simple Hebrew, 3 to 5 short sentences, in the plural or gender-neutral form. Say that you are glad they wrote, that what they feel matters, that it is not their fault, and that they deserve help from a person now.
- Encourage them to tell an adult they trust today: a parent, the school counsellor (היועצת או היועץ), or a teacher.
- Give these free services exactly as written: ער״ן: חיוג ${eran.phone} בכל שעה, או וואטסאפ ${eran.whatsapp} (${eran.textHours}), בלי לומר שם. סה״ר: צ׳אט באתר sahar.org.il או וואטסאפ ${sahar.whatsapp}, בערב ובלילה. פגיעה ברשת (הצקות, איומים, מישהו שמבקש תמונות): ${online.phone}. בסכנה מיידית: משטרה ${police}, מד״א ${mda}.
- If they say they are in danger right now (a plan or a way to hurt themselves now, or someone hurting them now), put משטרה ${police}, מד״א ${mda} and ער״ן ${eran.phone} first, before anything else.
- Do not ask for their name, school, address, phone or photos. Do not ask questions about what happened or try to find out details; listen and point to people. Do not promise to keep a secret. Do not diagnose. Never describe methods of self-harm. Do not pretend to be a friend, a parent or a therapist; you may say you are an AI tutor and that a person can help more.
- Start this reply with the line ${CARE_MARK} (the app removes it and shows the same numbers on screen). In a JSON answer, set "care" to true instead.
If the student then asks a mathematics question, help as usual.
If the student writes something sexual, hateful or violent that is not about their own safety, decline kindly in one sentence, without a lecture, and offer to continue with mathematics.
Never ask the student for personal details. If they share a full name, an ID number, a phone number or an address, do not repeat it.`;
  const first = String(childPrompt || '').trim();
  return first ? `${first}\n\n${block}` : block;
}

/**
 * The fixed care reply (trust spec Appendix E.1a): no AI. Used past the care caps, when the server has no AI key, and
 * (in later stages) with no parent OK or in a class whose AI is off.
 */
export const CARE_STATIC = `תודה שכתבתם. מה שאתם מרגישים חשוב, וזה לא באשמתכם. מגיע לכם שמישהו ידבר איתכם עכשיו: הורה, היועצת או היועץ בבית הספר, או מורה. אפשר גם להתקשר בחינם ובלי לומר שם ל${SUPPORT.eran.name}, ${SUPPORT.eran.phone}, בכל שעה. אם אתם בסכנה עכשיו: משטרה ${SUPPORT.police}, מד״א ${SUPPORT.mda}.`;

/**
 * Text as the detector reads it: NFKC; niqqud and cantillation removed; the maqaf as '-'; gershayim and quotes as '"',
 * geresh and apostrophes as "'"; Latin lower-cased; a letter typed 3 or more times in a row kept once ("רוצההה" →
 * "רוצה"); spaces collapsed. Final letters (ךםןףץ) stay as they are: the patterns are written in ordinary spelling.
 */
export function normalize(text) {
  return String(text ?? '')
    .normalize('NFKC')
    .replace(/־/g, '-')
    .replace(/[֑-ׇ]/g, '')
    .replace(/[״“”„]/g, '"')
    .replace(/[׳‘’‚`]/g, "'")
    .toLowerCase()
    .replace(/(\p{L})\1{2,}/gu, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------- the distress detector (trust spec Appendix G)
const B = '(?:^|[^א-ת])'; // a Hebrew word starts here (no lookbehind: the group takes the character before it)
const P = `${B}[ושהלבכמ]?`; // ... and may carry one prefix letter (ו ש ה ל ב כ מ)
const E = '(?![א-ת])'; // a Hebrew word ends here
const he = (x) => `${P}(?:${x})${E}`;

/** Maths frustration: a slang or low-level match followed within 25 characters by one of these is not distress. */
const MATHS = /(תרגיל|השאלה|השאלות|מבחן|בוחן|שיעורי (?:ה)?בית|מתמטיקה|השברים|המשוואה|המשוואות|הנוסחה|הנעלם)/;
const MATHS_WINDOW = 25;
/** "Dying of laughter" is not a wish to die. */
const LAUGHING = /^\s*מ?צחוק/;

/**
 * Each rule: a category, a pattern over normalize(text), and `maths: true` when maths frustration right after the
 * match drops it (the categories distress and bullying, and the slang patterns). Self-harm, abuse and danger are never
 * dropped for maths words: "בא לי למות מהמבחן הזה" still gets the card, by design.
 */
const RULES = [
  // self_harm
  { cat: 'self_harm', re: he('(?:רוצה|רוצים|בא לי|מתחשק לי|חושב|חושבת|מתכנן|מתכננת|הולך|הולכת)\\s+(?:ל)?(?:מות|למות|להתאבד|לגמור עם (?:ה)?חיים|לגמור עם עצמי|להיעלם(?: מהעולם)?)'), laugh: true },
  { cat: 'self_harm', re: he('להתאבד|התאבדות|אתאבד|מתאבד|מתאבדת') },
  { cat: 'self_harm', re: he('(?:לפגוע|פוגע|פוגעת|פגעתי|אפגע)\\s+ב?עצמי') },
  { cat: 'self_harm', re: he('(?:לחתוך|חותך|חותכת|חתכתי)\\s+(?:את\\s+)?(?:עצמי|הידיים|היד|הרגליים)') },
  { cat: 'self_harm', re: he('(?:לא רוצה|לא רוצים|אין לי (?:טעם|סיבה))\\s+(?:לחיות|להמשיך לחיות)') },
  { cat: 'self_harm', re: he('נמאס לי (?:מהחיים|לחיות)|אין טעם (?:לחיות|לחיים)|עדיף (?:שאמות|שלא הייתי נולד|שלא הייתי נולדת)|כולם יהיו (?:בסדר|יותר טוב) (?:בלעדיי|בלעדי)') },
  { cat: 'self_harm', re: '\\b(?:kill myself|killing myself|suicid\\w*|want to die|wanna die|self[- ]?harm|hurt myself|cut myself)\\b' },
  // abuse
  { cat: 'abuse', re: he('(?:מרביץ|מרביצה|מרביצים|הרביץ|הרביצה|הרביצו)\\s+לי') },
  { cat: 'abuse', re: he('(?:מכה|מכים|היכה)\\s+אותי') },
  { cat: 'abuse', re: he('(?:נוגע|נוגעת|נוגעים|נגע|נגעה)\\s+(?:בי|ב(?:גוף|מקומות))') },
  { cat: 'abuse', re: he('התעלל|מתעלל|מתעללת|התעללות|התעללו') },
  { cat: 'abuse', re: he('(?:פגע|פוגע|פגעה)\\s+בי\\s+מינית|(?:הטריד|מטריד|הטרידה)\\s+אותי|הטרדה מינית') },
  { cat: 'abuse', re: he('(?:מפחד|מפחדת)\\s+(?:ללכת|לחזור)\\s+הביתה') },
  { cat: 'abuse', re: '\\b(?:abus\\w*|molest\\w*)\\b' },
  // danger
  { cat: 'danger', re: `${P}(?:ביקש|ביקשה|מבקש|מבקשת|מבקשים|ביקשו)\\s+(?:ממני\\s+)?(?:תמונה|תמונות|לשלוח תמונ|סרטון|להצטלם)` },
  { cat: 'danger', re: `${P}(?:תמונה|תמונות)\\s+(?:עירום|בלי בגדים)` },
  { cat: 'danger', re: he('סוחט|סוחטת|סחיטה|סוחטים') },
  { cat: 'danger', re: he('(?:מאיים|מאיימת|מאיימים|איים|איימו)\\s+(?:עליי|עלי)') },
  { cat: 'danger', re: he('(?:אמר|אמרה|ביקש|ביקשה)\\s+(?:לי\\s+)?לא לספר\\s+(?:להורים|לאף אחד|לאמא|לאבא)') },
  { cat: 'danger', re: he('(?:רוצה|רוצים)\\s+להיפגש\\s+איתי\\s+(?:בסוד|בלי)') },
  // bullying
  { cat: 'bullying', re: he('(?:עושים|עשו)\\s+(?:לי\\s+)?חרם|מחרימים אותי|(?:כולם\\s+)?צוחקים (?:עליי|עלי)|(?:מציקים|מקללים|מכים|משפילים)\\s+(?:לי|אותי)'), maths: true },
  { cat: 'bullying', re: '\\b(?:bullied|bullying me)\\b', maths: true },
  // distress
  { cat: 'distress', re: he('אני\\s+(?:ב)?דיכאון|(?:כל הזמן|כל יום|כל לילה)\\s+(?:אני\\s+)?בוכה|בוכה\\s+(?:כל הזמן|כל יום|כל לילה)|אין לי\\s+(?:אף אחד|חברים|עם מי לדבר)'), maths: true },
  { cat: 'distress', re: he('אני\\s+(?:שונא|שונאת)\\s+את עצמי|אני\\s+(?:(?:מרגיש|מרגישה)\\s+)?(?:חסר|חסרת)\\s+ערך|אף אחד לא\\s+(?:אוהב|אכפת לו)|אני לבד בעולם'), maths: true },
  { cat: 'distress', re: he('אני\\s+לא\\s+(?:יכול|יכולה)\\s+יותר'), maths: true },
  // (s) "killing me" counts only about home: "הורג אותי בבית", never "התרגיל הזה הורג אותי"
  { cat: 'distress', re: `${he('(?:הורג|הורגת)\\s+אותי')}.{0,${MATHS_WINDOW}}?${he('הבית|בבית|אבא|אמא')}`, maths: true },
].map((r) => ({ ...r, re: new RegExp(r.re, 'gu') }));

/** The categories, most serious first: a message that matches several gets the first. */
export const DISTRESS_CATEGORIES = Object.freeze(['self_harm', 'abuse', 'danger', 'bullying', 'distress']);

function firstMatch(rule, text) {
  rule.re.lastIndex = 0;
  for (let m = rule.re.exec(text); m; m = rule.re.exec(text)) {
    const end = m.index + m[0].length;
    const after = text.slice(end, end + MATHS_WINDOW);
    const dropped = (rule.maths && MATHS.test(after)) || (rule.laugh && LAUGHING.test(text.slice(end)));
    if (!dropped) return true;
    if (m[0].length === 0) rule.re.lastIndex += 1;
  }
  return false;
}

/**
 * Does this text read as a child in distress or danger? → { flag, category } with category one of
 * DISTRESS_CATEGORIES (the most serious one that matched) or null. Runs on the device and on the server, with no
 * network. A maths sentence ("הישר חותך את ציר ה-x", "התרגיל הזה הורג אותי") does not flag.
 */
export function detectDistress(text) {
  const t = normalize(text);
  if (!t) return { flag: false, category: null };
  for (const cat of DISTRESS_CATEGORIES) {
    if (RULES.some((r) => r.cat === cat && firstMatch(r, t))) return { flag: true, category: cat };
  }
  return { flag: false, category: null };
}
