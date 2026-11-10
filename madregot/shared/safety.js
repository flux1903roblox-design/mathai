// Safety first, for the AI tutor (trust spec TRUST-3). Shared by the Worker and the browser, so the support details,
// the prompt's safety block and the distress detector have one source.
//
// This file ships to the browser. Vite targets Safari 16.0, which has no regex lookbehind, and a lookbehind literal
// stops the whole chunk from loading there: a Hebrew word start is written (?:^|[^א-ת]) and a word end (?![א-ת]).
// worker/test/safety.test.js fails on a lookbehind anywhere in shared/.
import { BLOCK_HE, BLOCK_EN } from './blocklist.js';

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

// ---------------------------------------------------------------- personal details never reach the AI (TRUST-4 §4.1)
// the address itself, not a Hebrew word written right before it ("ל-noa@…" keeps its "ל-")
const EMAIL = /[a-z0-9._%+]+(?:-[a-z0-9._%+]+)*@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/gi;
// An Israeli phone: mobile, landline or 07x, with 0 or +972 / 972, dashes or spaces anywhere a person puts them. The
// leading group stands in for a lookbehind (Safari 16.0): no digit right before the number, none right after.
const PHONE = /(^|\D)((?:\+?972[-\s]?|0)(?:5\d|[2-4]|[89]|7\d)[-\s]?\d{3}[-\s]?\d{4})(?!\d)/g;
const NINE = /(^|\D)(\d{9})(?!\d)/g;
// "ID number" up to 20 characters before nine digits: only then are they an ID (a maths answer of 9 digits is not).
const ID_WORD = /(?:ת["״']?\.?ז|תעודת זהות|מספר זהות|ת\.ז\.?)/;
const ID_GAP = 20;

/** The Israeli ID check digit: the 9 digits, weighted 1,2,1,2,…, with each product's digits added, sum to a multiple of 10. */
export function validIsraeliId(digits) {
  const d = String(digits);
  if (!/^\d{9}$/.test(d)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    const v = Number(d[i]) * (i % 2 === 0 ? 1 : 2);
    sum += v > 9 ? v - 9 : v;
  }
  return sum % 10 === 0;
}

export const PERSONAL_KINDS = Object.freeze(['email', 'phone', 'id']);

/**
 * Personal details in a text written by a child, masked before it goes to the AI: an email → [מייל], an Israeli phone
 * → [טלפון], and nine digits that pass the ID check digit with an ID word just before them → [ת״ז]. Names cannot be
 * masked reliably: the prompt tells the tutor never to repeat one. → { text, found } with found ⊆ PERSONAL_KINDS, in
 * that order. A phone number is a phone number even inside a maths question ("x = 0521234567").
 */
export function maskPersonal(text) {
  const found = new Set();
  let t = String(text ?? '');
  t = t.replace(EMAIL, () => { found.add('email'); return '[מייל]'; });
  t = t.replace(PHONE, (_, pre) => { found.add('phone'); return `${pre}[טלפון]`; });
  t = t.replace(NINE, (all, pre, digits, offset, whole) => {
    const start = offset + pre.length;
    const before = whole.slice(Math.max(0, start - ID_GAP), start);
    if (!validIsraeliId(digits) || !ID_WORD.test(before)) return all;
    found.add('id');
    return `${pre}[ת״ז]`;
  });
  return { text: t, found: PERSONAL_KINDS.filter((k) => found.has(k)) };
}

/** What maskPersonal would find in these texts, together (for counting only: the masking itself is in buildFull). */
export function scanPersonal(texts) {
  const found = new Set();
  for (const t of (Array.isArray(texts) ? texts : [texts])) for (const k of maskPersonal(t).found) found.add(k);
  return PERSONAL_KINDS.filter((k) => found.has(k));
}

/**
 * A saved exam title (TRUST-5 §6): no personal details, and no run of 7 or more digits (an ID or a phone in any form
 * becomes '#'). The title is the subject; the AI is told so, and this is the backstop on the device and the server.
 */
export function scrubTitle(title) {
  return maskPersonal(String(title ?? '')).text.replace(/\d{7,}/g, '#');
}

// ---------------------------------------------------------------- every reply screened (TRUST-4 §4.2)
/**
 * Hosts a tutor reply may link to: the support services, WhatsApp and Israeli government sites (the Ministry of
 * Education, the police, the 105 centre). A host is allowed when it is one of these or ends with "." and one of them:
 * "parents.education.gov.il" is allowed, "evil-gov.il" and "gov.il.evil.example" are not. The app's own address is
 * added by the caller (screenOutput's `hosts`, SafeLink's own origin) and is matched exactly.
 */
export const ALLOWED_LINK_HOSTS = Object.freeze(['eran.org.il', 'sahar.org.il', 'wa.me', 'gov.il']);
const SUPPORT_TEL = new Set([SUPPORT.eran.phone, SUPPORT.online.phone, SUPPORT.police, SUPPORT.mda]);

/**
 * May a reply link here? https (or http) to an allowed host, or a tel: link to one of the support numbers. `hosts`: more
 * hosts allowed exactly as written (the app's own).
 */
export function linkAllowed(href, hosts = []) {
  const raw = String(href ?? '').trim();
  if (/^tel:/i.test(raw)) return SUPPORT_TEL.has(raw.slice(4).replace(/[-\s]/g, ''));
  let u;
  try { u = new URL(raw); } catch { return false; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
  if (u.username || u.password) return false;
  const host = u.hostname.toLowerCase().replace(/\.$/, '');
  if (hosts.some((h) => h && String(h).toLowerCase() === host)) return true;
  return ALLOWED_LINK_HOSTS.some((a) => host === a || host.endsWith(`.${a}`));
}

/** The calm sentence a child sees instead of a reply that was not fit to show. */
export const BLOCKED_TEXT = 'לא הצלחתי לענות על זה כמו שצריך. אפשר לנסח את השאלה אחרת?';

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const BLOCK_RE = new RegExp(
  `(?:${B}(?:${BLOCK_HE.map(esc).join('|')})${E})|(?:\\b(?:${BLOCK_EN.map(esc).join('|')})\\b)`, 'u',
);

/** Does this text hold a blocklist word (on normalize(text), whole words only)? */
export function blockHit(text) {
  return BLOCK_RE.test(normalize(text));
}

// Images in a reply are never shown (an address the child did not choose would load by itself): their alt text stays.
const MD_IMAGE = /!\[([^\]]*)\]\(\s*<?[^)\s>]*>?(?:\s+"[^"]*")?\s*\)/g;
const MD_LINK = /\[([^\]]*)\]\(\s*<?([^)\s>]*)>?(?:\s+"[^"]*")?\s*\)/g;
const AUTOLINK = /<((?:https?|ftp|mailto|tel|data|javascript):[^>\s]*)>/gi;
const MD_DEF = /^[ \t]*\[[^\]]+\]:[ \t]*<?(\S+?)>?(?:[ \t]+(?:"[^"]*"|'[^']*'|\([^)]*\)))?[ \t]*$/gm;
const BARE = /\b(?:https?:\/\/|www\.)[^\s<>()[\]"']+/gi;

/**
 * Screen a reply before a child sees it. Links: a link to a host that is not allowed keeps only its text, a bare
 * address or a link definition is removed, an image keeps only its alt text. Words: a reply with a blocklist word is
 * blocked (text '' and blocked: true), unless `care` (a reply about the child's own safety, which must be able to name
 * what happened; its links are still screened). `hosts`: more hosts allowed exactly (the app's own).
 * → { text, blocked, linksRemoved }.
 */
export function screenOutput(text, { care = false, hosts = [] } = {}) {
  const src = String(text ?? '');
  if (!care && blockHit(src)) return { text: '', blocked: true, linksRemoved: 0 };
  let removed = 0;
  const ok = (href) => linkAllowed(href, hosts);
  let t = src.replace(MD_IMAGE, (_, alt) => { removed += 1; return alt; });
  t = t.replace(MD_DEF, (line, href) => (ok(href) ? line : ((removed += 1), '')));
  t = t.replace(AUTOLINK, (all, href) => (ok(href) ? all : ((removed += 1), '')));
  // links first, kept aside so the bare-address pass never looks inside an allowed one
  const kept = [];
  t = t.replace(MD_LINK, (all, label, href) => {
    if (ok(href)) { kept.push(all); return `\u0000${kept.length - 1}\u0000`; }
    removed += 1;
    return label;
  });
  t = t.replace(BARE, (url) => {
    const href = /^www\./i.test(url) ? `https://${url}` : url;
    const clean = href.replace(/[.,;:!?]+$/, '');
    if (ok(clean)) return url;
    removed += 1;
    return url.slice(clean.length - (href.length - url.length));
  });
  t = t.replace(/\u0000(\d+)\u0000/g, (_, i) => kept[Number(i)]);
  return { text: t, blocked: false, linksRemoved: removed };
}
