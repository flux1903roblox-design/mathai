// The contact guard for help replies (spec TEACHER-6), shared by the Worker (worker/src/help.js, both directions) and
// the demo class's fake server (web/src/lib/teacherDemo.js), so the two refuse the same messages.
//
// A message may not carry a link, an email address, a social handle or a phone number. The text is normalised first, so
// the same number written another way is the same number: NFKC (full-width digits and letters become plain ones),
// invisible format characters removed, and every decimal digit of any script (Arabic-Indic, Persian, …) read as its
// ASCII digit. Maths must keep passing: "3 + 4 = 7", "(-3)·(-4)", "1234 + 5678", "2.5 + 3.75 = 6.25", a date, a list
// of exercise numbers.

// Top-level domains a link to the outside would use. A word with a dot and one of these after it ("abc.com",
// "x.co.il") counts as a link; maths ("3.5", "x.y") does not.
const TLDS = 'com|net|org|info|biz|io|co|il|me|app|dev|ai|ly|gl|gg|tv|to|cc|us|uk|de|fr|ru|edu|gov|link|site|online|xyz|page|club|live|chat|social|test';
const END = '(?![\\p{L}\\p{N}])';
const LINK = new RegExp(`https?:\\/\\/|www\\.|[\\p{L}\\p{N}_-]\\.(${TLDS})${END}`, 'iu');
/** "instagram . com", "gmail (dot) com", "gmail נקודה com": a domain with its dot spaced out or spelled. */
const SPACED_LINK = new RegExp(`[a-z0-9-]{2,}\\s*(?:[\\[(]\\s*(?:\\.|dot)\\s*[\\])]|\\s\\.|\\.\\s|(?<![a-z])dot(?![a-z])|נקודה)\\s*(${TLDS})${END}`, 'iu');
const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;
/** "@dana_k12", "dana@gmail": an @ before three Latin letters, digits or underscores is a handle or an address. */
const HANDLE = /@\s?[a-z0-9_.]{3,}/i;
/** "dana [at] gmail", "dana (at) gmail", "dana שטרודל gmail": an address with its @ in brackets or in Hebrew. */
const AT_WORD = /[a-z0-9._-]{2,}\s*(?:[[(]\s*at\s*[\])]|שטרודל)\s*[a-z0-9-]{2,}/iu;
/** "dana at gmail dot com", "dana at gmail נקודה com": a bare "at" counts only with the dot after it. */
const AT_DOT = /[a-z0-9._-]{2,}\s+at\s+[a-z0-9-]{2,}\s*(?:\.|(?<![a-z])dot(?![a-z])|נקודה|[[(]\s*(?:\.|dot)\s*[\])])\s*[a-z]{2,}/iu;

/** Each decimal digit of any script as its ASCII digit (Unicode keeps each script's 0..9 together and in order). */
function asciiDigits(s) {
  return s.replace(/\p{Nd}/gu, (c) => {
    const cp = c.codePointAt(0);
    if (cp < 128) return c;
    let n = 0;
    while (n < 60 && /\p{Nd}/u.test(String.fromCodePoint(cp - n - 1))) n += 1;
    return String(n % 10);
  });
}

/** The text as the guard reads it: NFKC, no invisible format characters, ASCII digits. */
export function contactText(text) {
  return asciiDigits(String(text ?? '').normalize('NFKC').replace(/\p{Cf}/gu, ''));
}

// Numbers that are not phone numbers although they have 7 digits: a date (12.11.2026, 1/9/26) and a number written with
// thousands separators (1,000,000). Each is taken out before the digits are counted.
const DATE = /(?<!\d)(?:0?[1-9]|[12]\d|3[01])[./](?:0?[1-9]|1[0-2])[./](?:(?:19|20)\d{2}|\d{2})(?!\d)/g;
const THOUSANDS = /(?<![\d,.])[1-9]\d{0,2}(?:,\d{3})+(?:\.\d+)?(?![\d,])/g;
/**
 * Whether the gap between two groups of digits joins them into one number: up to three characters on one line, with
 * no "=", and either a single letter alone ("050ש123") or no letter at all. Spaces around an operator or after a comma
 * part maths and lists ("1234 + 5678", "1, 2, 3"); a separator with nothing around it ("050+123", "050_123",
 * "050,123", "050 123") does not.
 */
function joins(gap) {
  if (gap.length > 3 || /[\n=]/.test(gap)) return false;
  const letters = (gap.match(/\p{L}/gu) || []).length;
  if (letters) return letters === 1 && gap.length === 1;
  if (/\s/.test(gap) && /[+\-−–—×·*/:÷^<>,;]/.test(gap)) return false;
  return true;
}
/** Seven digits or more in one number, however its groups are separated (a phone number). */
export function hasPhone(text) {
  const t = contactText(text).replace(DATE, ' ').replace(THOUSANDS, ' ');
  const re = /\d+/g;
  let m; let run = 0; let end = -1;
  while ((m = re.exec(t))) {
    run = end >= 0 && joins(t.slice(end, m.index)) ? run + m[0].length : m[0].length;
    if (run >= 7) return true;
    end = m.index + m[0].length;
  }
  return false;
}

/**
 * The contact guard: a link (http(s)://, www., or a word with a dot and a known top-level domain, also with the dot
 * spaced out or spelled), an email address (also with the @ spelled out), a handle (@ and three Latin characters), or
 * a phone number (seven digits or more in one number, see hasPhone).
 */
export function hasContact(text) {
  const s = contactText(text);
  return LINK.test(s) || SPACED_LINK.test(s) || EMAIL.test(s) || HANDLE.test(s) || AT_WORD.test(s) || AT_DOT.test(s) || hasPhone(s);
}
