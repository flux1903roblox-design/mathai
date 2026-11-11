// The app's topic and stair names, for every place that cannot load the web content: the Worker (the weekly email,
// PARENTS-7), the parent's report pages and the tutor's stair map (AI-5 adds TOPIC_GRADE and NOT_YET here). One list,
// written by hand, kept exactly equal to the content by web/src/learn/report.test.ts: a stair added without its name
// here (or a title changed in one place only) fails the web tests. Plain JS, no imports.
// The web imports it as @shared/stairs.js; the Worker as ../../shared/stairs.js.

/** Topic id → the topic's title, as the app shows it. */
export const TOPIC_NAMES = {
  signed: 'מספרים מכוונים',
  coord: 'מערכת צירים',
  angles: 'זוויות',
  expr: 'ביטויים אלגבריים',
  eq: 'משוואות',
  line: 'פונקציה קווית',
  pyth: 'משפט פיתגורס',
  stats: 'סטטיסטיקה',
  sys: 'משוואות ומערכות',
};

/** Stair id ('topic:level') → the stair's title, as the app shows it. */
export const STAIR_NAMES = {
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
};

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
