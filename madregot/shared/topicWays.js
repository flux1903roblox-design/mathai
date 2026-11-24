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

/**
 * The tutor's ways for curriculum stage 4's geometry (stage4 spec GEOM-1 item 8, through AI-2's rules as above):
 * transformations (transf:1-4, web/src/learn/content/transf.ts), congruent triangles (congr:1-5,
 * web/src/learn/content/congr.ts) and isosceles triangles and similarity (sim:1-4, web/src/learn/content/sim.ts).
 * pedagogy.js takes them into TOPIC_WAYS in school order: the transformations after the angles, congruence after
 * statistics, similarity after congruence.
 */
export const TOPIC_WAYS_GEOM = Object.freeze({
  transf: {
    models: String.raw`A translation moves every point the same distance in the same direction (add the same to every $x$ and to every $y$; right and up add, left and down subtract), and is measured from a point to its image, never by the gap between the shapes. A reflection in a line sends each point to the same distance on the other side, along a perpendicular; in the $x$-axis $(x, y) \to (x, -y)$, in the $y$-axis $(x, y) \to (-x, y)$, in the line $x = k$ measure the distance to that line, not to the axis. A rotation needs a centre, an angle and a direction; every point keeps its distance from the centre (measure from the centre first, then turn the steps: counterclockwise "right" becomes "up"); a half turn about the origin is $(x, y) \to (-x, -y)$. All three keep lengths, angles and area, so the image is congruent; equal areas or equal perimeters alone do not make shapes congruent. Glued shapes lose the shared side from the perimeter; tiles meeting at a point fill $360°$.`,
    words: ['הזזה', 'שיקוף', 'ישר שיקוף', 'ציר סימטריה', 'סיבוב', 'מרכז הסיבוב', 'עם כיוון השעון', 'נגד כיוון השעון', 'תמונה', 'חופפות', 'ריצוף'],
    avoid: [
      '"swap x and y" as the rule for a rotation (a quarter turn also changes one sign, and its direction matters)',
      '"a reflection changes both signs" (that is a half turn)',
      '"shapes with the same area are congruent"',
    ],
    avoidRe: [
      // the swap said of a turn, either order (coord:c1 quotes "מחליפים בין $x$ ל־$y$" about a point, not a turn); the
      // tutor writes $x$, so the dollar signs are optional; a swap that also names the sign change is the whole rule
      re(String.raw`(?:(?:ו?ב|ה)?סיבוב|לסובב|מסובבים|מסובב)[^.\n]*?מחליפים\s+(?:בין\s+)?(?:(?:ה)?שיעורים|(?:ה־)?\$?x\$?\s*(?:ל|ו))${unless('סימן|סימנים')}`),
      re(String.raw`מחליפים\s+(?:בין\s+)?(?:ה־)?\$?x\$?\s*(?:ל|ו)[^.\n]*?(?:סיבוב|לסובב|מסתובבת|מסתובב)${unless('סימן|סימנים')}`),
      re(String.raw`(?:ב)?שיקוף\s+(?:\S+\s+){0,3}(?:מחליפים|מחליף|משנים|משנה|מתחלפים|מתהפכים)\s+(?:את\s+)?(?:ה)?סימנים\s+של\s+שני`),
      re(String.raw`(?:צורות|משולשים|מלבנים)\s+(?:עם|שלהם|שלהן)\s+(?:אותו|שטח\s+שווה)\s+(?:שטח\s+)?(?:הם|הן)\s+חופפ`),
    ],
  },
  congr: {
    models: String.raw`$\triangle ABC \cong \triangle KML$ is read in the order of its letters: $A \leftrightarrow K$, $B \leftrightarrow M$, $C \leftrightarrow L$, wherever the second triangle is drawn (turned or mirrored); corresponding sides join corresponding vertices, and equal sides face equal angles. Without a written congruence the correspondence comes from the equal parts: a vertex matches the point where the sides equal to its two sides meet. The theorems: צ.ז.צ (two sides and the angle between them), ז.צ.ז (two angles and the side between them; the third angle can be found first) and צ.צ.צ. Two sides with an angle not between them, three angles, or an equal perimeter or area are not enough. A proof is a two-column table, טענה and נימוק: the givens, what the drawing adds (a common side, vertical angles), the congruence with its theorem, and only then the conclusions, "corresponding sides (angles) in congruent triangles". A median goes to the middle of the opposite side: it halves the side and the area (equal bases, the same height), not the shape; the height is the perpendicular, not the median. The third side of a triangle is strictly between the difference and the sum of the other two (a sum equal to it lies flat), and the largest angle faces the longest side.`,
    words: ['צלעות מתאימות', 'זוויות מתאימות', 'משפט חפיפה', 'צ.ז.צ', 'ז.צ.ז', 'צ.צ.צ', 'טענה', 'נימוק', 'נתון', 'צ״ל', 'צלע משותפת', 'זוויות קודקודיות', 'תיכון', 'דלתון', 'אי־שוויון המשולש'],
    avoid: [
      '"two sides and an angle are enough" (the angle must be between them)',
      '"equal area means congruent" (a median makes two halves of equal area that are not congruent)',
      'matching vertices by where they are drawn or by the alphabet instead of the order of the congruence',
    ],
    avoidRe: [
      // two sides and an angle said to be enough, with nothing in the sentence about where the angle is
      re(String.raw`שתי\s+צלעות\s+וזווית\s+(?:אחת\s+)?(?:מספיקות|מספיק|זה\s+מספיק|הן\s+מספיקות)${unless('ביניהן|כלואה|בין שתי')}`),
      // equal areas (or perimeters) given as the reason for congruence: "שווי שטח, ולכן הם חופפים"
      re(String.raw`(?:שווי|שוות|שווים|אותו)\s+(?:שטח|היקף)[^.\n]*?(?:ולכן|לכן|אז)\s+(?:הם\s+|הן\s+|המשולשים\s+)?חופפ`),
    ],
  },
  sim: {
    models: String.raw`In an isosceles triangle the legs are equal and so are the base angles opposite them; the bisector of the apex angle cuts it into two congruent triangles (צ.ז.צ), so it is also the median and the altitude to the base. The converses are theorems of their own, each proved by congruence: a triangle with two equal angles is isosceles (the sides opposite the equal angles are equal, not the sides at them), and a triangle whose median to a side is also the altitude to it is isosceles. A theorem and its converse are checked separately (congruent triangles have equal areas; equal areas do not make triangles congruent). Similar shapes have every pair of corresponding angles equal and one ratio for every pair of corresponding sides: an enlargement multiplies every length by the same number $k$, never adds the same amount ($4 \to 6$ is $\times 1.5$, so $6 \to 9$). For quadrilaterals equal angles are not enough. Two equal angles make two triangles similar (ז.ז), written in the order of corresponding vertices. A line parallel to a side cuts off a similar triangle: compare its side with the whole side of the large triangle ($AD$ with $AB$, not with $DB$); in the "bowtie" (two parallel segments joined by two crossing segments) the correspondence crosses over ($A \leftrightarrow D$). Perimeters scale by $k$, areas by $k^2$, and $k$ is the square root of the ratio of the areas.`,
    words: ['שוקיים', 'בסיס', 'זווית הראש', 'משפט הפוך', 'דומים', 'יחס הדמיון', 'ז.ז'],
    avoid: [
      '"add the same to every side" (an enlargement multiplies every side by one number)',
      '"the area grows by the same factor" (areas grow by the square of the ratio)',
    ],
    avoidRe: [
      // the same number added to every side, stated as the way to enlarge (and not what not to do)
      re(String.raw`מוסיפים\s+(?:אותו\s+מספר|את\s+אותו\s+מספר|את\s+אותו)\s+לכל\s+(?:ה)?צלע${unless('במקום|לא נותנ|לא שומר|משנה את|משנים את')}`),
      // the area said to grow by the same factor as the lengths (by the ratio itself, and not its square)
      re(String.raw`(?:ה)?שטח\s+(?:גדל|קטן|גדלה|משתנה)\s+(?:גם\s+)?(?:פי\s+)?(?:אותו\s+(?:מספר|יחס)|יחס\s+הדמיון|באותו\s+יחס)${unless('בריבוע|ריבוע|\\^2')}`),
    ],
  },
});
