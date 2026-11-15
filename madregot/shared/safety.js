// Safety first, for the AI tutor (trust spec TRUST-3). Shared by the Worker and the browser, so the support details,
// the prompt's safety block, the personal-detail mask and the reply screen have one source. The distress detector is
// in shared/distress.js: only the screens with the tutor load it, so it stays out of the app's first download.
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
If the student writes about sex, or something hateful or violent, that is not about their own safety, decline kindly in one sentence, without a lecture, and offer to continue with mathematics.
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

// ---------------------------------------------------------------- personal details never reach the AI (TRUST-4 §4.1)
// the address itself, not a Hebrew word written right before it ("ל-noa@…" keeps its "ל-")
const EMAIL = /[a-z0-9._%+]+(?:-[a-z0-9._%+]+)*@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/gi;
// An Israeli phone: mobile, landline or 07x, with 0 or +972 / 972, dashes, dots or spaces anywhere a person puts them,
// and the prefix in brackets or not ("(054) 123-4567"). The leading group stands in for a lookbehind (Safari 16.0): no
// digit (and no opening bracket, which the number takes) right before the number, none right after.
const PHONE = /(^|[^\d(])(\(?(?:\+?972[-\s.]?\(?|0)(?:5\d|[2-4]|[89]|7\d)\)?[-\s.]?\d{3}[-\s.]?\d{4})(?!\d)/g;
const NINE = /(^|\D)(\d{9})(?!\d)/g;
// A phone with its digits spread out or cut in odd places (COUNCIL2-9): "0 5 4 1 2 3 4 5 6 7", "05412345 67". Spaces or
// dashes between any digits; the digits alone must then be an Israeli number (LOOSE_DIGITS). Never a dot (0.521234567 is
// a decimal), never right after another digit ("3 0 5 4 …" is a list), and never a chain of single digits joined by
// minus signs (a signed-numbers exercise).
const LOOSE_PHONE = /(^|[^\d])((?:\+\s?9\s?7\s?2|0)(?:[\s-]{0,2}\d){8,9})(?![\s-]{0,2}\d)/g;
const LOOSE_DIGITS = /^0(?:5\d{8}|7\d{8}|[2-489]\d{7})$/;
// A street address (COUNCIL2-9): a street word, one to three words of its name and the house number (with a letter, 5א),
// and the city after it when it is marked off: ", תל אביב" (one or two words, then the sentence ends or another comma
// follows, and never a question: ", מה ההפרש?" is the exercise) or "בחיפה". The name's first word is not one of the
// words a maths story puts after "רחוב" ("ברחוב יש 12 בתים"). Before the street word only a prefix letter (ב, ו, ל, מ,
// ש): "הרחוב" (the street) is no address.
const HE = String.raw`[א-ת"'׳״-]`;
const NOT_A_CITY = String.raw`(?!(?:מה|כמה|איזה|איזו|האם|מי|איך|למה|מתי|איפה|אז|ואז|אבל|כי|ו?אני|ו?הוא|ו?היא)(?![א-ת]))`;
const SENTENCE_END = String.raw`(?=\s*(?:[.!?,;:]|$))`;
const STREET_WORD = String.raw`(?:רחוב|רח['׳"]|שדרות|שד['׳"])`;
const NUMBER = String.raw`\d{1,4}[א-ת]?(?![\dא-ת])`;
const STREET = new RegExp(
  String.raw`((?:^|[^א-ת])[בולמש]{0,2})(${STREET_WORD}\s+(${HE}+)(?:\s+${HE}+){0,2}\s+${NUMBER}`
  + String.raw`(?:\s*,\s*${NOT_A_CITY}${HE}+(?:[\s-]${HE}+)?${SENTENCE_END}|\s+ב(?!${STREET_WORD})${HE}+(?:-${HE}+)?)?)`, 'g');
const NOT_A_STREET_NAME = new Set(['יש', 'אין', 'שלנו', 'שלי', 'שלו', 'שלה', 'שלהם', 'שלכם', 'הזה', 'הזאת', 'זה', 'זאת', 'אחד', 'אחת', 'ארוך', 'ארוכה', 'קצר', 'קצרה',
  'היו', 'היה', 'הייתה', 'גרים', 'גר', 'גרה', 'עם', 'של', 'עד', 'כל', 'בו', 'בה', 'רק', 'עוד', 'כמה', 'יותר', 'פחות', 'ישר', 'ראשי', 'צדדי', 'שני', 'הבא', 'אורך', 'באורך']);
// The same address said without a street word: "אני גרה בהרצל 15 דירה 4 רמת גן", "הכתובת שלי: ויצמן 12 כפר סבא". After
// "גר/גרה ב" or "הכתובת שלי:", a name of one to three words, the number, a flat when there is one, and what follows to
// the end of the sentence (one or two words: the city). Never a floor, a building or a distance ("גר בקומה 3", "גרה
// במרחק 2 ק״מ"), and never a number of years ("גרה בחיפה 5 שנים").
const NOT_A_UNIT = String.raw`(?!\s*(?:שנים|שנה|חודשים|ימים|שעות|דקות|ק"מ|ק״מ|קילומטר|קילומטרים|מטר|מטרים)(?![א-ת]))`;
const ADDRESS_REST = String.raw`(${HE}+)(?:\s+${HE}+){0,2}\s+${NUMBER}${NOT_A_UNIT}(?:\s+דירה\s+\d{1,3})?(?:\s*,?\s*${NOT_A_CITY}${HE}+(?:[\s-]${HE}+)?${SENTENCE_END})?`;
const LIVES_AT = new RegExp(String.raw`((?:^|[^א-ת])(?:גר|גרה|גרים|גרות|מתגורר|מתגוררת)\s+ב)(${ADDRESS_REST})`, 'g');
const MY_ADDRESS = new RegExp(String.raw`((?:^|[^א-ת])ה?כתובת(?:\s+(?:שלי|שלנו|שלו|שלה))?(?:\s+(?:היא|זה|זו))?\s*:?\s*)(${ADDRESS_REST})`, 'g');
const NOT_A_PLACE_NAME = new Set([...NOT_A_STREET_NAME, 'קומה', 'בניין', 'בנין', 'בית', 'דירה', 'מרחק', 'עיר', 'שכונה', 'כיתה', 'גיל', 'רחוב', 'שדרות', 'מספר']);
/**
 * A sentence that is an exercise about streets, not an address: it asks how much or what the difference is, or it
 * names two streets with their numbers ("דני גר ברחוב הרצל 15 ויוסי ברחוב הרצל 27, מה ההפרש?"). Its numbers stay.
 */
const STREET_MATHS = /(?:^|[^א-ת])(?:כמה|ה?הפרש|ה?סכום|ה?ממוצע|ה?מרחק|רחוק|רחוקה)(?![א-ת])/;
/** Beside a run of single digits: it is a list of numbers for statistics, not a phone. */
const STATS_WORD = /(?:^|[^א-ת])ה?(?:חציון|ממוצע|שכיח|טווח|סדרו|סדר|נתונים|ספרות|מספרים|רשימה|סדרה)(?![א-ת])/;
/** The sentence around a match (from the mark before it to the one after it). */
function sentenceOf(text, from, to) {
  let a = from; let b = to;
  while (a > 0 && !'.!?\n'.includes(text[a - 1])) a -= 1;
  while (b < text.length && !'.!?\n'.includes(text[b])) b += 1;
  return { text: text.slice(a, b), start: a, end: b };
}
// "ID number" up to 20 characters before nine digits: only then are they an ID (a maths answer of 9 digits is not).
const ID_WORD = /(?:ת["״']?\.?ז|תעודת (?:ה)?זהות|מספר (?:ה)?זהות|ת\.ז\.?|\bid\b|\bid number\b)/i;
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

export const PERSONAL_KINDS = Object.freeze(['email', 'phone', 'id', 'address']);

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
  t = t.replace(LOOSE_PHONE, (all, pre, run, offset, whole) => {
    const digits = run.replace(/^\+\s?9\s?7\s?2/, '0').replace(/[\s-]/g, '');
    const before = whole.slice(0, offset + pre.length);
    if (!LOOSE_DIGITS.test(digits) || /\d[\s-]{0,2}$/.test(before)) return all;
    if (/^\d(?:-\d)+$/.test(run.replace(/^\+972/, ''))) return all;
    // single digits one by one, with a statistics word beside them ("0 5 4 1 2 3 4 5 6 7 מה החציון?"): a list of numbers
    if (/^\d(?:\s\d)+$/.test(run)) {
      const s = sentenceOf(whole, offset, offset + all.length);
      if (STATS_WORD.test(s.text)) return all;
    }
    found.add('phone');
    return `${pre}[טלפון]`;
  });
  t = t.replace(NINE, (all, pre, digits, offset, whole) => {
    const start = offset + pre.length;
    const before = whole.slice(Math.max(0, start - ID_GAP), start);
    if (!validIsraeliId(digits) || !ID_WORD.test(before)) return all;
    found.add('id');
    return `${pre}[ת״ז]`;
  });
  // a sentence about streets that is an exercise keeps its numbers (STREET_MATHS, or two streets in one sentence)
  const bare = (name) => name.replace(/["'׳״-]/g, '');
  const streets = [...t.matchAll(STREET)].filter((m) => !NOT_A_STREET_NAME.has(bare(m[3])));
  const exercise = (offset, len) => {
    const s = sentenceOf(t, offset, offset + len);
    return STREET_MATHS.test(s.text) || streets.filter((m) => m.index >= s.start && m.index < s.end).length >= 2;
  };
  const before = t;
  const keep = new Set(streets.filter((m) => exercise(m.index, m[0].length)).map((m) => m.index));
  t = before.replace(STREET, (all, pre, addr, name, offset) => {
    if (NOT_A_STREET_NAME.has(bare(name)) || keep.has(offset)) return all;
    found.add('address');
    return `${pre}[כתובת]`;
  });
  for (const re of [LIVES_AT, MY_ADDRESS]) {
    t = t.replace(re, (all, pre, addr, name, offset, whole) => {
      if (NOT_A_PLACE_NAME.has(bare(name)) || STREET_MATHS.test(sentenceOf(whole, offset, offset + all.length).text)) return all;
      found.add('address');
      return `${pre}[כתובת]`;
    });
  }
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
const B = '(?:^|[^א-ת])'; // a Hebrew word starts here (no lookbehind: the group takes the character before it)
const E = '(?![א-ת])'; // a Hebrew word ends here
// English words that start with the stem of the list's first English word are caught whatever follows (written with a
// class, so this line does not hold the word itself: the app's own text is checked against the list)
const BLOCK_RE = new RegExp(
  `(?:${B}(?:${BLOCK_HE.map(esc).join('|')})${E})|(?:\\b(?:${BLOCK_EN.map(esc).join('|')}|por[n]\\w*)\\b)`, 'u',
);
const BLOCK_WORDS = [...BLOCK_HE, ...BLOCK_EN].filter((w) => !/\s/.test(w));
// Letters spelled out one at a time, with a space, a dot, a dash or an underscore between them (three or more letters).
const SPELLED = /(?:^|[\s(])((?:[א-תa-z][\s._-]){2,}[א-תa-z])(?=$|[\s).,!?])/gu;
// A word with "*" (or "#", "@") standing for one to three of its letters. Maths ("2*3", "x*y") never makes a listed word.
const STARRED = /[א-תa-z][א-תa-z*#@]*[*#@][א-תa-z*#@]*[א-תa-z]/gu;

/** The words of the text spelled out or starred, put back together, to check them against the list as well. */
function hiddenWords(t) {
  const out = [];
  for (const m of t.matchAll(SPELLED)) out.push(m[1].replace(/[\s._-]/g, ''));
  for (const m of t.matchAll(STARRED)) {
    const word = m[0];
    if (!/[a-zא-ת]/.test(word.replace(/[*#@]/g, ''))) continue;
    const re = new RegExp(`^${word.split(/[*#@]+/).map(esc).join('[א-תa-z]{1,3}')}$`, 'u');
    const hit = BLOCK_WORDS.find((w) => re.test(w));
    if (hit) out.push(hit);
  }
  return out;
}

/** Does this text hold a blocklist word (on normalize(text), whole words only, spelled out or starred too)? */
export function blockHit(text) {
  const t = normalize(text);
  if (BLOCK_RE.test(t)) return true;
  const hidden = hiddenWords(t);
  return hidden.length > 0 && BLOCK_RE.test(hidden.join(' '));
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
