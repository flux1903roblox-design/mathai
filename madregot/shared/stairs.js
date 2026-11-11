// The app's topic and stair names, for every place that cannot load the web content: the Worker (the parents' weekly
// report and email, PARENTS-7/8), the parent's report pages and the tutor's prompt (the stair map, ai spec AI-5). One
// list, written by hand and checked: web/src/learn/stairs.test.ts and report.test.ts fail the moment a topic or a stair
// is added to the app without its name here, or a name here differs from the one on screen. Plain JS, no imports; it
// ships to the browser too. The web imports it as @shared/stairs.js; the Worker as ../../shared/stairs.js.

/** Each topic's name, in teaching order (learn/skills.ts TOPIC_ORDER). */
export const TOPIC_NAMES = Object.freeze({
  frac: 'שברים ועשרוניים', // the curriculum lane's bridge unit, first in teaching order
  signed: 'מספרים מכוונים',
  coord: 'מערכת צירים',
  angles: 'זוויות',
  expr: 'ביטויים אלגבריים',
  eq: 'משוואות',
  line: 'פונקציה קווית',
  pyth: 'משפט פיתגורס',
  stats: 'סטטיסטיקה',
  sys: 'משוואות ומערכות',
});

/** Each stair's name, as its lesson and its teaching content call it. */
export const STAIR_NAMES = Object.freeze({
  // the curriculum lane's bridge unit (each stair the curriculum adds needs its name here: stairs.test.ts, report.test.ts)
  'frac:1': 'שבר ושברים שווים',
  'frac:2': 'השוואת שברים ועשרוניים',
  'signed:1': 'חיבור וחיסור',
  'signed:2': 'השוואת מספרים',
  'signed:3': 'כפל וחילוק',
  'signed:4': 'סדר פעולות',
  'signed:5': 'סוגריים',
  'coord:1': 'קריאת נקודה',
  'coord:2': 'רביעים',
  'coord:3': 'אורך קטע',
  'coord:4': 'שטח מלבן',
  'coord:5': 'קודקוד חסר',
  'angles:1': 'זוויות צמודות',
  'angles:2': 'זוויות קודקודיות',
  'angles:3': 'סכום זוויות במשולש',
  'angles:4': 'ישרים מקבילים',
  'angles:5': 'שווה־שוקיים וזווית חיצונית',
  'expr:1': 'הצבה בביטוי',
  'expr:2': 'כותבים ביטוי',
  'expr:3': 'כינוס איברים דומים',
  'expr:4': 'חוק הפילוג',
  'expr:5': 'פישוט ביטויים',
  'eq:1': 'משוואה ופתרון',
  'eq:2': 'משוואה בשני צעדים',
  'eq:3': 'נעלם בשני האגפים',
  'eq:4': 'משוואות עם סוגריים',
  'eq:5': 'בעיות מילוליות',
  'line:1': 'טבלת ערכים',
  'line:2': 'מה אומרים m ו־b',
  'line:3': 'שיפוע מהגרף: מדרגות',
  'line:4': 'שיפוע בין שתי נקודות',
  'line:5': 'משוואת ישר',
  'line:6': 'חיתוך עם הצירים',
  'line:7': 'משולש עם הצירים',
  'line:8': 'נקודת מפגש של שני ישרים',
  'pyth:1': 'מציאת היתר',
  'pyth:2': 'מציאת ניצב',
  'pyth:3': 'האם המשולש ישר־זווית?',
  'pyth:4': 'שאלה מילולית',
  'pyth:5': 'מרחק בין נקודות',
  'stats:1': 'שכיח',
  'stats:2': 'חציון',
  'stats:3': 'ממוצע',
  'stats:4': 'ממוצע מטבלה',
  'stats:5': 'נתון חסר',
  'sys:1': 'משוואות עם אחוזים',
  'sys:2': 'שיטת ההצבה',
  'sys:3': 'השוואת מקדמים',
  'sys:4': 'בעיות עם שני נעלמים',
  'sys:5': 'אי־שוויונות',
});

/**
 * A stair's full name, 'מספרים מכוונים: חיבור וחיסור', or null for an id this list does not know (a stair from
 * another version of the app; the report says so in its own words).
 * @param {string} id
 * @returns {string | null}
 */
export const stairName = (id) => {
  if (typeof id !== 'string' || !Object.hasOwn(STAIR_NAMES, id)) return null;
  const topic = id.split(':')[0];
  return Object.hasOwn(TOPIC_NAMES, topic) ? `${TOPIC_NAMES[topic]}: ${STAIR_NAMES[id]}` : null;
};

/**
 * The grade each topic is filed under in the app (learn/skills.ts GRADE_OF). Pythagoras stays under ח׳ as the app files
 * it today. (ai spec AI-5)
 */
export const TOPIC_GRADE = Object.freeze({ frac: '7', signed: '7', coord: '7', angles: '7', expr: '7', eq: '7', line: '8', pyth: '8', stats: '8', sys: '8' });

/**
 * Parts of the Ministry's programme for grades 7 and 8 that the app does not teach yet, as Hebrew titles (never topic
 * ids), so the tutor helps with them without inventing a stair. Systems of equations and inequalities are taught now
 * (sys:2-5) and are not listed. The curriculum lane owns this list and replaces it with notYet() from its coverage map
 * (CURRICULUM-1), so it shrinks with every new stage. (ai spec AI-5)
 */
export const NOT_YET = Object.freeze({
  '7': Object.freeze(['שברים ומספרים עשרוניים מכוונים', 'חזקות ושורשים', 'שטחים והיקפים', 'תיבה ומנסרה', 'טרנספורמציות', 'שכיחות והסתברות']),
  '8': Object.freeze(['פונקציות (כללי)', 'יחס ופרופורציה', 'קנה מידה', 'אחוזים (מעבר למשוואות עם אחוזים)', 'חפיפת משולשים', 'תיכון במשולש', 'דמיון משולשים', 'אומדן שורשים', 'הסתברות']),
});
