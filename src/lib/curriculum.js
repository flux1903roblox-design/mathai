export const GRADES = [
  { id: '7', label: 'ז' },
  { id: '8', label: 'ח' },
  { id: '9', label: 'ט' },
  { id: '10', label: 'י' },
  { id: '11', label: 'יא' },
  { id: '12', label: 'יב' },
];

export const UNITS = [
  { id: '3', label: '3 יחידות', desc: 'בסיסי' },
  { id: '4', label: '4 יחידות', desc: 'מורחב' },
  { id: '5', label: '5 יחידות', desc: 'גבוה' },
];

export const MIDDLE_GRADES = ['7', '8', '9'];

const MIDDLE = [
  { id: 'algebra_ms', label: 'אלגברה: חזקות ושברים' },
  { id: 'equations_ms', label: 'משוואות ממעלה ראשונה' },
  { id: 'systems_ms', label: 'מערכות משוואות' },
  { id: 'functions_ms', label: 'פונקציות וקואורדינטות' },
  { id: 'ratio_ms', label: 'יחס, פרופורציה ואחוזים' },
  { id: 'geometry_ms', label: 'גאומטריה: זוויות ומשולשים' },
  { id: 'pythagoras_ms', label: 'משפט פיתגורס' },
  { id: 'circles_ms', label: 'מעגל ושטחים' },
];

const HIGH3 = [
  { id: 'algebra3', label: 'אלגברה: פולינומים ומשוואות' },
  { id: 'functions3', label: 'פונקציות ליניאריות וריבועיות' },
  { id: 'geometry3', label: 'גאומטריה אנליטית' },
  { id: 'trig3', label: 'טריגונומטריה בסיסית' },
  { id: 'sequences3', label: 'סדרות חשבוניות' },
  { id: 'stats3', label: 'סטטיסטיקה' },
];

const HIGH4_ADD = [
  { id: 'functions4', label: 'חקירת פונקציות' },
  { id: 'trig4', label: 'טריגונומטריה מורחבת' },
  { id: 'geometry4', label: 'גאומטריה אנליטית מורחבת' },
  { id: 'sequences4', label: 'סדרות הנדסיות' },
  { id: 'logs4', label: 'לוגריתמים' },
];

const HIGH5_ADD = [
  { id: 'calculus5', label: 'חדו"א: גבולות, נגזרות ואינטגרלים' },
  { id: 'vectors5', label: 'וקטורים' },
  { id: 'complex5', label: 'מספרים מרוכבים' },
  { id: 'prob5', label: 'הסתברות וקומבינטוריקה' },
  { id: 'stats5', label: 'סטטיסטיקה מתקדמת' },
];

export function getTopics(grade, unit) {
  if (MIDDLE_GRADES.includes(String(grade))) return MIDDLE;
  const u = Number(unit) || 3;
  let list = [...HIGH3];
  if (u >= 4) list = [...list, ...HIGH4_ADD];
  if (u >= 5) list = [...list, ...HIGH5_ADD];
  return list;
}

export function gradeLabel(grade) {
  return GRADES.find((g) => g.id === String(grade))?.label || '';
}

export function isHighSchool(grade) {
  return !MIDDLE_GRADES.includes(String(grade));
}

export function profileLabel(grade, unit) {
  if (MIDDLE_GRADES.includes(String(grade))) return `חטיבת ביניים · כיתה ${gradeLabel(grade)}`;
  return `תיכון · כיתה ${gradeLabel(grade)} · ${unit || 3} יחידות`;
}