// How the tutor should teach the topics of curriculum stage 1 (curriculum spec CURRICULUM-3, -4, -5 for AI-2): the
// fractions floor (frac), percent (pct), ratio and scale (ratio), and one sentence for signed fractions and decimals
// (signed:6). Each entry has the shape of the AI lane's TOPIC_WAYS in shared/pedagogy.js: models (English, as the other
// entries), the words the app uses, the shortcuts never taught as a rule, and for each of those an avoidRe that catches
// the shortcut stated as a rule.
//
// pedagogy.js lives on the AI lane; when the two lanes meet, TOPIC_WAYS takes these three entries in teaching order and
// TOPIC_WAYS.signed.models gains SIGNED_FRACTIONS (one import, no rewording). The curriculum lane owns the words here,
// and worker/test/topicWays.test.js holds them to AI-2's rules now, against this lane's own content.
//
// The rules (ai spec AI-2, §0.3): an avoidRe matches the phrase stated as a rule, never the app's own naming of the
// mistake (the app writes "חשבו שמכנה גדול יותר…", so a pattern may not start right after a Hebrew letter or a quotation
// mark), and no pattern uses lookbehind (this file ships to the browser; Safari before 16.4 cannot load one).

/** A word start: not after a quotation mark or a Hebrew letter (so "שמכנה" and "״מכנה" never start a match). */
const Q = `(?:^|[^"״“”'׳א-ת])`;
const re = (body, flags = '') => new RegExp(`${Q}${body}`, flags);
/** The rest of the sentence does not say it (a negative lookahead, allowed: only lookbehind is not). */
const unless = (words) => `(?![^.\\n]*(?:${words}))`;
/** A word end. */
const END = '(?=$|[^א-ת])';

export const TOPIC_WAYS_STAGE1 = Object.freeze({
  frac: {
    models: String.raw`A fraction is a place on the number line: cut each unit into equal parts and count parts (the gaps, not the marks). Equal fractions are the same place; expanding multiplies the top and the bottom by the same number (the parts get smaller and there are more of them), and adding the same number changes the amount. Decimals are compared digit by digit after padding with zeros ($0.4 = 0.40$). Adding needs parts of one size, so a common denominator first. "Of" is multiplying, and multiplying by a number smaller than $1$ takes only part; dividing by a fraction counts how many times it fits, so multiply by the reciprocal. Negative fractions and decimals follow the signed-number rules on the same line (stair 6 of the signed numbers).`,
    words: ['מונה', 'מכנה', 'הרחבה', 'צמצום', 'מכנה משותף', 'ההפכי'],
    avoid: [
      '"a bigger denominator is a bigger fraction" (with the same numerator a bigger denominator means smaller parts)',
      'adding the numerators and adding the denominators ($\\frac{1}{2} + \\frac{1}{3}$ is not $\\frac{2}{5}$)',
      '"multiplying always makes bigger, dividing always makes smaller"',
      '"move the decimal point" without the place values (tenths, hundredths) that say why',
      'cross-multiplying to add fractions',
    ],
    avoidRe: [
      re(String.raw`(?:מכנה|המכנה)\s+(?:ה)?גדול(?:\s+יותר)?\s+(?:נותן|זה|הוא|אומר|פירושו)\s+(?:ש)?(?:ה)?שבר\s+(?:ה)?גדול`),
      re(String.raw`ככל\s+שהמכנה\s+(?:גדול|גדל)[^.\n]*?(?:ה)?שבר\s+(?:גדול|גדל)`),
      re(String.raw`(?:מחברים|לחבר|חברו)\s+(?:את\s+)?(?:ה)?מונ(?:ה|ים)\s+(?:עם\s+(?:ה)?מונה\s+)?(?:ו|ו־)(?:את\s+)?(?:ה)?מכנ(?:ה|ים)${END}${unless('משאיר|נשאר|לא משתנה|אותו מכנה')}`),
      re(String.raw`(?:כפל|כשכופלים)\s+(?:תמיד\s+(?:מגדיל|מגדילה|מגדילים)|(?:מגדיל|מגדילה|מגדילים)\s+תמיד)${END}`),
      re(String.raw`כפל\s+מגדיל\s+(?:ו|ו־)חילוק\s+מקטין${END}`),
      // the decimal point, not a point on the plane ("הזיזו את הנקודה אל $B$"): named as decimal, or moved by places
      re(String.raw`(?:מזיזים|להזיז|הזיזו)\s+(?:את\s+)?(?:ה)?נקודה\s+(?:(?:ה)?עשרונית|(?:\S+\s+)?(?:מקומות|ספרות|מקום|ספרה))(?=$|[^א-ת])${unless('ערך|עשיריות|מאיות|עשרות|מאות|אלפים|כי ')}`),
      re(String.raw`(?:(?:מחברים|לחבר|בחיבור)[^.\n]*?כפל\s+(?:ב)?הצלבה|כפל\s+(?:ב)?הצלבה[^.\n]*?(?:חיבור|לחבר|מחברים))`),
    ],
  },
  ratio: {
    models: String.raw`A ratio compares two quantities in the order the question asks ("שלוש לארבע"), and is also a quotient. Simplify or expand by multiplying or dividing both terms by the same number; adding the same number to both changes the ratio ($6 : 8$ is $3 : 4$, $8 : 10$ is $4 : 5$). $m : n$ is $m + n$ equal parts. A proportion is two equal ratios, solved through one unit ("ליחידה אחת") or "פי כמה", and shown on a double number line. A rectangle's two sides share half the perimeter. A scale $1 : S$ has both sides in the same unit, then converts; areas grow by the square of the scale factor ($S^2$).`,
    words: ['יחס', 'יחס מצומצם', 'חלוקה ביחס', 'פרופורציה', 'יחס ישר', 'ליחידה אחת', 'קנה מידה'],
    avoid: [
      'keeping the same difference instead of the same ratio ("adding the same number to both terms keeps the ratio")',
      'cross-multiplication taught as a trick before the unit method',
      'sharing the whole perimeter of a rectangle in the ratio of its sides',
      '"the area grows like the length"',
    ],
    avoidRe: [
      re(String.raw`(?:הוספה|מוסיפים|להוסיף)\s+(?:של\s+)?(?:את\s+)?אותו\s+(?:ה)?מספר\s+[^.\n]*?(?:שומר(?:ת|ים)?\s+על\s+(?:ה)?יחס|(?:ה)?יחס\s+(?:נשאר|לא\s+משתנה|נשמר))`),
      re(String.raw`כפל\s+(?:ב)?הצלבה${unless('ליחידה|יחידה אחת|פי כמה|זה אותו דבר|כמו ')}`),
      re(String.raw`(?:מחלקים|לחלק|חלקו)\s+(?:את\s+)?(?:כל\s+)?(?:ה)?היקף\s+ביחס`),
      re(String.raw`(?:ה)?שטח\s+(?:גדל|גדלה|קטן|קטנה|מוכפל)\s+(?:פי\s+)?(?:אותו\s+(?:ה)?(?:דבר|מספר)|כמו\s+(?:ה)?(?:אורך|אורכים|צלע|צלעות|קנה\s+(?:ה)?מידה))${unless('בריבוע|ריבוע|\\^2|²')}`),
    ],
  },
  pct: {
    models: String.raw`A percent is hundredths of a whole. The percent bar ($0$ to $100\%$ above, $0$ to the whole below) and the double number line; the benchmarks $50\%$, $25\%$, $10\%$, $5\%$, $1\%$. "$p\%$ of" is multiplying by $\frac{p}{100}$; "what percent" is part over whole, times $100$, and can be more than $100\%$. The whole is found through $1\%$ or a benchmark, then checked. A change multiplies by $1 \pm \frac{p}{100}$ of the amount before the change, and two changes multiply (a rise and a fall by the same percent do not cancel).`,
    words: ['אחוז', 'השלם', 'מאית', 'התייקרות', 'הוזלה', 'הנחה', 'פי'],
    avoid: [
      '"a percent cannot be more than 100"',
      'subtracting the percent number as if it were shekels ("20% off 80" is not $80 - 20$)',
      '"a rise of 10% and a fall of 10% give the price back"',
      '"divide by the percent"',
    ],
    avoidRe: [
      re(String.raw`(?:ה)?אחוז(?:ים)?\s+(?:לא|אף\s+פעם\s+לא)\s+(?:יכול(?:ים)?\s+(?:להיות|לעבור)|עובר(?:ים)?)\s+(?:יותר\s+מ|מעל\s+(?:ל)?)?\s*־?\s*\$?100`),
      re(String.raw`אין\s+(?:יותר\s+מ|מעל\s+(?:ל)?)\s*־?\s*\$?100\s*\\?%`),
      re(String.raw`(?:מורידים|מחסירים|להוריד|להחסיר)\s+(?:את\s+)?(?:מספר\s+)?(?:ה)?אחוזים?\s+(?:מ|מן\s+)(?:ה)?(?:מחיר|סכום|כמות)`),
      re(String.raw`(?:עלייה|התייקרות|הגדלה|העלאה)\s+(?:ו|ואז\s+|ואחריה\s+|ו־)(?:ירידה|הוזלה|הנחה|הקטנה)\s+(?:ב|של\s+)?אותו\s+(?:ה)?אחוז\s+(?:מבטלות|מבטלים|מחזירות|מחזירים|מתקזזות|מתקזזים)`),
      re(String.raw`(?:מחלקים|לחלק|חלקו)\s+(?:את\s+\S+\s+)?ב־?(?:ה)?אחוז(?:ים)?${END}`),
    ],
  },
});

/** The sentence TOPIC_WAYS.signed.models gains with stair 6 (signed fractions and decimals). */
export const SIGNED_FRACTIONS = String.raw`Fractions and decimals with a sign (stair 6) follow the same rules on the same number line: $-2.5 + 1.2 = -1.3$, because the signs differ, the distances are subtracted, and $-2.5$ is farther from zero.`;
