// The Ministry of Education's maths programme for grades 7 and 8 (ז׳ and ח׳), unit by unit, with the hours its
// teaching schedules give each unit and the months it is taught. Plain JS with no imports: the Worker, the AI prompts
// and the web app all read this one list, and coverage (shared/coverage.js) is computed from it, never typed by hand.
//
// Sources: the Ministry's תשפ״ז teaching schedules (`sources` below), read 10 November 2026. Unit titles keep the
// Ministry's wording. Hours: ז׳ 150, ח׳ 147, as listed in the schedules' month rows. Months are the months the
// schedule teaches the unit, in school order (9..12, then 1..6).
//
// A unit's hours are split into parts. A part counts as taught when every skill (stair id, 'topic:level') it lists
// exists in the app; a part with `skills: []` is not taught yet and names the build stage that will teach it in `later`
// ('S2' measurement, 'S3' data and probability, 'S4' grade-8 geometry, 'S5' functions and word problems). A `note` says,
// in a few Hebrew words, what the part is; the untaught notes are the "not yet" list (coverage.js `notYet`).
// One stair may serve several units (pyth:1 is squares and roots in 7.6 and Pythagoras in 7.14 and 8.3).
// Bridge stairs (frac:1-4, elementary fractions) are never listed: the programme no longer teaches them, so they add
// no hours.
//
// When a new stair lands, add its id to the part it teaches (and drop that part's `later`); the coverage numbers move
// by themselves.

/** The stage the next build round delivers: a missing part with this `later` may say it is coming next. */
export const ROADMAP_NEXT = 'S2';

const range = (topic, from, to) => Array.from({ length: to - from + 1 }, (_, i) => `${topic}:${from + i}`);

export const PROGRAMME = {
  year: 'תשפ״ז',
  sources: {
    '7': 'https://meyda.education.gov.il/files/Pop/0files/matmatika/Chativat-Beynayim/tashpaz/prisa_7.pdf',
    '8': 'https://meyda.education.gov.il/files/Pop/0files/matmatika/Chativat-Beynayim/tashpaz/prisa_8.pdf',
  },
  units: [
    // ---------------- ז׳ (150 hours)
    { id: '7.1', grade: '7', domain: 'numbers', title: 'מערכת צירים ברביע I', months: [9],
      parts: [{ hours: 5, skills: ['coord:1'] }] },
    { id: '7.2', grade: '7', domain: 'numbers', title: 'הכרת המספרים השליליים, מספרים נגדיים', months: [9, 10],
      parts: [{ hours: 4, skills: ['signed:2'] }, { hours: 1, skills: ['signed:6'], note: 'שברים ועשרוניים מכוונים' }] },
    { id: '7.3', grade: '7', domain: 'numbers', title: 'חיבור וחיסור מספרים מכוונים', months: [10],
      parts: [{ hours: 5, skills: ['signed:1'] }, { hours: 2, skills: ['signed:6'], note: 'שברים ועשרוניים מכוונים' }] },
    { id: '7.4', grade: '7', domain: 'numbers', title: 'הרחבת מערכת הצירים', months: [10, 11],
      parts: [{ hours: 5, skills: range('coord', 2, 5) }] },
    { id: '7.5', grade: '7', domain: 'numbers', title: 'כפל וחילוק מספרים מכוונים', months: [11],
      parts: [{ hours: 6, skills: range('signed', 3, 5) }, { hours: 2, skills: ['signed:6'], note: 'שברים ועשרוניים מכוונים' }] },
    { id: '7.6', grade: '7', domain: 'numbers', title: 'חזקות עם מעריך טבעי ושורש ריבועי חיובי', months: [12],
      parts: [
        { hours: 2, skills: ['pyth:1'] }, // squares and square roots, with estimating a root
        { hours: 4, skills: [], note: 'חזקות עם מעריך טבעי וסדר פעולות עם חזקות', later: 'S2' },
      ] },
    { id: '7.7', grade: '7', domain: 'algebra', title: 'משתנים וביטויים אלגבריים (כולל זהות, כינוס, חוק הפילוג)', months: [12, 1, 2, 3],
      parts: [{ hours: 25, skills: range('expr', 1, 5) }] },
    { id: '7.8', grade: '7', domain: 'algebra', title: 'משוואות ופתרונן, משוואות מיוחדות, שאלות בהקשרים', months: [3, 4, 5],
      parts: [{ hours: 21, skills: range('eq', 1, 5) }] },
    { id: '7.9', grade: '7', domain: 'algebra', title: 'נקודות על גרף ברביע I', months: [5],
      parts: [
        { hours: 1, skills: ['line:1'] }, // a table of values and its points on the grid
        { hours: 2, skills: [], note: 'קריאת גרף שמתאר מצב', later: 'S5' },
      ] },
    { id: '7.10', grade: '7', domain: 'geometry', title: 'זוויות (מדידה, חוצה זווית, צמודות, קודקודיות, במשולשים ובמרובע)', months: [9, 10, 11],
      parts: [
        { hours: 16, skills: range('angles', 1, 5) },
        { hours: 4, skills: [], note: 'מדידה ואומדן של זוויות, חוצה זווית וזוויות במרובע', later: 'S5' },
      ] },
    { id: '7.11', grade: '7', domain: 'geometry', title: 'צורות חופפות במישור וטרנספורמציות', months: [11, 12],
      parts: [{ hours: 5, skills: [], note: 'הזזה, שיקוף וסיבוב, וצורות חופפות', later: 'S4' }] },
    { id: '7.12', grade: '7', domain: 'geometry', title: 'שטחים א, שטחים ב, חישוב היקפים', months: [12, 1, 4, 5],
      parts: [
        { hours: 1, skills: ['coord:4'] }, // the area of a rectangle on the grid
        { hours: 9, skills: [], note: 'שטח משולש, מקבילית וטרפז, וחישוב היקפים', later: 'S2' },
      ] },
    { id: '7.13', grade: '7', domain: 'geometry', title: 'גופים במרחב: קובייה, תיבה, מנסרה משולשת', months: [1, 5],
      parts: [{ hours: 9, skills: [], note: 'קובייה, תיבה ומנסרה: פריסה, שטח פנים ונפח', later: 'S2' }] },
    { id: '7.14', grade: '7', domain: 'geometry', title: 'משפט פיתגורס ושימושיו', months: [3],
      parts: [{ hours: 6, skills: range('pyth', 1, 5) }] },
    { id: '7.15', grade: '7', domain: 'uncertainty', title: 'איסוף, ייצוג וקריאת מידע, שכיחות', months: [1, 2],
      parts: [
        { hours: 2, skills: ['stats:1'] }, // the mode
        { hours: 4, skills: ['data:1'] }, // charts, the pictogram and the frequency table
      ] },
    { id: '7.16', grade: '7', domain: 'uncertainty', title: 'שכיחות יחסית (בלי ועם אחוזים)', months: [2],
      parts: [{ hours: 5, skills: ['data:2', 'data:3'] }] }, // relative frequency; in percent and the pie
    { id: '7.17', grade: '7', domain: 'uncertainty', title: 'הסתברות בהקשר של שכיחות יחסית', months: [2],
      parts: [{ hours: 4, skills: ['data:4'] }] }, // probability from relative frequency

    // ---------------- ח׳ (147 hours)
    { id: '8.1', grade: '8', domain: 'numbers', title: 'יחס, פרופורציה וקנה מידה', months: [9, 10],
      parts: [{ hours: 8, skills: range('ratio', 1, 4) }] },
    { id: '8.2', grade: '8', domain: 'numbers', title: 'אחוזים (הגדלה והקטנה באחוזים)', months: [10],
      parts: [{ hours: 7, skills: range('pct', 1, 5) }] },
    { id: '8.3', grade: '8', domain: 'geometry', title: 'השלמת זוויות בין מקבילים; משפט פיתגורס', months: [9, 10],
      parts: [{ hours: 8, skills: ['angles:4', ...range('pyth', 1, 5)] }] },
    { id: '8.4', grade: '8', domain: 'geometry', title: 'גליל, חרוט (ולפניהם היקף מעגל ושטח עיגול)', months: [10, 11],
      parts: [{ hours: 6, skills: [], note: 'היקף מעגל, שטח עיגול, גליל וחרוט', later: 'S2' }] },
    { id: '8.5', grade: '8', domain: 'geometry', title: 'טרנספורמציות וצורות חופפות', months: [11],
      parts: [{ hours: 5, skills: [], note: 'הזזה, שיקוף וסיבוב, וצורות חופפות', later: 'S4' }] },
    { id: '8.6', grade: '8', domain: 'uncertainty', title: 'איסוף וקריאת מידע, שכיחות, שכיחות יחסית', months: [10, 11],
      parts: [
        { hours: 1, skills: ['stats:1'] }, // the mode
        // the ז׳ data unit, learnt in ח׳ in the transition year (on the ח׳ path through learn/skills.ts ALSO_ON_PATH)
        { hours: 7, skills: ['data:1', 'data:2', 'data:3'] },
      ] },
    { id: '8.7', grade: '8', domain: 'algebra', title: 'מבוא לפונקציות: ייצוגים, עלייה וירידה', months: [11],
      parts: [{ hours: 8, skills: [], note: 'פונקציה: גרף, טבלה וביטוי, עלייה וירידה', later: 'S5' }] },
    { id: '8.8', grade: '8', domain: 'algebra', title: 'גרפים לינאריים, קצב שינוי, שיפוע, ייצוג אלגברי', months: [11, 12],
      parts: [{ hours: 8, skills: range('line', 1, 8) }] },
    { id: '8.9', grade: '8', domain: 'algebra', title: 'משוואות מיוחדות ושאלות מילוליות (אחוזים, תנועה)', months: [12, 1, 2],
      parts: [
        { hours: 1, skills: ['line:8'] },
        { hours: 5, skills: ['eq:1', 'eq:2', 'eq:3', 'eq:4', 'eq:5', 'sys:1'] },
        { hours: 6, skills: [], note: 'שאלות תנועה, משתנה במכנה, משוואות בעזרת פרופורציה', later: 'S5' },
      ] },
    { id: '8.10', grade: '8', domain: 'uncertainty', title: 'טווח נתונים ומדדי מרכז, שני מקורות מידע', months: [12, 1],
      parts: [
        { hours: 8, skills: range('stats', 2, 5) },
        // curriculum stage 3 (DATA-5): the range and a change to every value, and two sources of data
        { hours: 4, skills: ['stats:6', 'stats:7'] },
      ] },
    { id: '8.11', grade: '8', domain: 'uncertainty', title: 'אינטרפולציה, אקסטרפולציה', months: [1],
      parts: [{ hours: 4, skills: ['stats:8'] }] },
    { id: '8.12', grade: '8', domain: 'geometry', title: 'חפיפת משולשים, צלעות במשולש, תיכון', months: [1, 2],
      parts: [{ hours: 16, skills: [], note: 'חפיפת משולשים, צלעות במשולש ותיכון', later: 'S4' }] },
    { id: '8.13', grade: '8', domain: 'geometry', title: 'זווית חיצונית, שווה־שוקיים ומשפטים הפוכים, דמיון משולשים', months: [3, 4],
      parts: [
        { hours: 3, skills: ['angles:5'] }, // isosceles and exterior angles
        { hours: 13, skills: [], note: 'משפטים הפוכים בשווה־שוקיים ודמיון משולשים', later: 'S4' },
      ] },
    { id: '8.14', grade: '8', domain: 'algebra', title: 'מערכות משוואות (בסיסית, המשך, שאלות מילוליות)', months: [2, 4, 5],
      parts: [{ hours: 1, skills: ['line:8'] }, { hours: 12, skills: range('sys', 2, 4) }] },
    { id: '8.15', grade: '8', domain: 'algebra', title: 'אי שוויונות', months: [5],
      parts: [{ hours: 4, skills: ['sys:5'] }] },
    { id: '8.16', grade: '8', domain: 'uncertainty', title: 'הסתברות א ו־ב', months: [3],
      parts: [
        // 8.16: "הסתברות א – בסיס" is data:4 (probability from relative frequency); "הסתברות ב" is prob:1-3 (equally
        // likely outcomes, the complement, a two-stage experiment counted in a table)
        { hours: 2, skills: ['data:4'] },
        { hours: 4, skills: ['prob:1', 'prob:2', 'prob:3'] },
      ] },
    { id: '8.17', grade: '8', domain: 'geometry', title: 'משפט פיתגורס במרחב', months: [5],
      parts: [{ hours: 6, skills: [], note: 'משפט פיתגורס בגופים במרחב', later: 'S2' }] },
  ],
};
