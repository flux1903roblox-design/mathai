// Words the tutor never says to a child in an ordinary reply (trust spec TRUST-4 §4.2): explicit sexual terms, severe
// slurs and graphic violence, in Hebrew and English. screenOutput() in shared/safety.js reads this list; a reply that
// contains one is not shown, and the child gets a calm sentence instead. A care reply (one about the child's own safety)
// is never checked against this list: a warm answer to "someone touched me" must be able to name what happened.
//
// Matching is on whole words of normalize(text) (niqqud removed, Latin lower-cased): a Hebrew term must not have a
// Hebrew letter right before or after it, so "מזינים" never matches "זין" and "סקאלה" never matches "סקס"; an English
// term must stand alone (\b), so "sextant", "Essex" and "analysis" are safe. Hebrew terms take no prefix letters, which
// keeps short words from matching inside ordinary ones; where a prefixed form matters, it is listed on its own.
// Words with an everyday or a maths meaning are left out on purpose: כוס (a cup in word problems), תחת, בולבול, טבח,
// ריטוש, erection (of a perpendicular), cock, dick, gore.
//
// This file ships to the browser: no regex lookbehind (Safari 16.0); worker/test/safety.test.js checks every file in shared/.

/** Hebrew terms, written in ordinary spelling (final letters as they are). */
export const BLOCK_HE = Object.freeze([
  // explicit sexual terms
  'סקס', 'סקסי', 'פורנו', 'זין', 'זיון', 'לזיין', 'מזדיין', 'להזדיין', 'כוסית', 'אוננות', 'אורגזמה', 'חרמן', 'חרמנית',
  'ציצים', 'פדופיל', 'אונס', 'לאנוס',
  // severe slurs and curses
  'זונה', 'זונות', 'שרמוטה', 'כושי', 'כושים', 'ערבוש', 'ערבושים', 'מפגר', 'מפגרת', 'מפגרים', 'קוקסינל', 'מניאק',
  // graphic violence
  'לערוף', 'עריפת ראש', 'לשחוט', 'ביתור', 'לבתר', 'לשסף',
]);

/** English terms, lower case. */
export const BLOCK_EN = Object.freeze([
  // explicit sexual terms
  'porn', 'porno', 'pornography', 'hentai', 'blowjob', 'handjob', 'masturbate', 'masturbation', 'orgasm', 'orgy', 'dildo',
  'nudes', 'sexting', 'sexy', 'rape', 'rapist', 'pedophile',
  // severe slurs and curses
  'fuck', 'fucking', 'motherfucker', 'cunt', 'whore', 'slut', 'nigger', 'nigga', 'faggot', 'retard', 'retarded', 'kike',
  'spic', 'chink', 'tranny',
  // graphic violence
  'behead', 'beheading', 'decapitate', 'dismember', 'disembowel', 'mutilate',
]);
