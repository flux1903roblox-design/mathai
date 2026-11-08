// Interactive exercises ("manip"): the answer is the state of a maths object the student moves.
// This module checks that state and puts it into words; the drawing lives in components/manip.
//
// kinds and the value each one holds:
//   numberline  a whole number on a number line            answer: the number
//   plot        a point [x, y] on the grid                 answer: [x, y], or any point in manip.quadrant
//   line        a line {m, b} built from two handles       answer: {m, b}
//   angle       the turning ray's angle ∠AOB in degrees    answer: degrees
//   squares     the legs {a, b} of a right triangle        answer: {c} (any whole a, b with a² + b² = c²)
//   bars        the height of the movable bar              answer: the value
import { near, plainNum } from './util.js';

const QUAD_NAMES = ['', 'הרביע הראשון', 'הרביע השני', 'הרביע השלישי', 'הרביע הרביעי'];
export const quadOf = ([x, y]) => (x > 0 && y > 0 ? 1 : x < 0 && y > 0 ? 2 : x < 0 && y < 0 ? 3 : x > 0 && y < 0 ? 4 : 0);

export function manipCorrect(it, u) {
  if (u == null) return false;
  const m = it.manip; const a = it.answer;
  switch (m.kind) {
    case 'numberline': case 'angle': case 'bars': return u === a;
    case 'plot': return m.quadrant ? quadOf(u) === m.quadrant : u[0] === a[0] && u[1] === a[1];
    case 'line': return near(u.m, a.m, 1e-9) && near(u.b, a.b, 1e-9);
    case 'squares': return Number.isInteger(u.a) && Number.isInteger(u.b) && u.a * u.a + u.b * u.b === a.c * a.c;
    default: return false;
  }
}

const num = (v) => plainNum(v);
// maths inside a Hebrew sentence is isolated left to right, so it reads 6² + 8² = 10² and not backwards
const ltr = (t) => `\u2066${t}\u2069`;
const lineText = ({ m, b }) => `y = ${m === 1 ? '' : m === -1 ? '-' : num(m)}x${b === 0 ? '' : b > 0 ? ` + ${num(b)}` : ` - ${num(-b)}`}`;

/** The answer (or a student's state) as plain text. */
export function manipText(it, u = it.answer) {
  if (u == null) return '';
  const m = it.manip;
  switch (m.kind) {
    case 'numberline': case 'bars': return num(u);
    case 'angle': return `${num(u)}°`;
    case 'plot': return m.quadrant && u === it.answer ? `נקודה ב${QUAD_NAMES[m.quadrant]}, למשל ${ltr(`(${num(u[0])}, ${num(u[1])})`)}` : `(${num(u[0])}, ${num(u[1])})`;
    case 'line': return lineText(u);
    case 'squares': return u.c != null ? `ניצבים ${u.a} ו־${u.b}: ${ltr(`${u.a}² + ${u.b}² = ${u.c}²`)}` : `ניצבים ${u.a} ו־${u.b}`;
    default: return '';
  }
}

/** The interactive setup in words, for the AI tutor and the teacher. */
export function manipPlain(it) {
  const m = it.manip;
  switch (m.kind) {
    case 'numberline': return `[ציר מספרים מ־${m.min} עד ${m.max}; מזיזים סמן מהנקודה ${m.from}]`;
    case 'plot': return m.quadrant ? `[מערכת צירים; שמים נקודה ב${QUAD_NAMES[m.quadrant]}]` : `[מערכת צירים; שמים את הנקודה ${m.label || ''}]`;
    case 'line': return '[מערכת צירים; בונים ישר בעזרת שתי נקודות: החיתוך עם ציר y וצעד אחד ימינה]';
    case 'angle': return `[קו ישר וקרן מסתובבת; הזווית הצמודה צריכה להיות ${m.target}°]`;
    case 'squares': return `[משולש ישר־זווית עם ריבועים על הצלעות; שטח הריבוע על היתר צריך להיות ${it.answer.c * it.answer.c}]`;
    case 'bars': return `[עמודות: ${m.values.join(', ')} ועוד עמודה אחת שמזיזים; הממוצע צריך להיות ${m.mean}]`;
    default: return '';
  }
}

/** A state that answers the exercise (the shape the object holds, not the shape of `answer`). */
export function manipSolution(it) {
  const a = it.answer;
  return it.manip.kind === 'squares' ? { a: a.a, b: a.b } : a;
}

/** A state close to the answer that is wrong: for automated checks of the "not yet" path. */
export function manipWrong(it) {
  const m = it.manip; const a = it.answer;
  switch (m.kind) {
    case 'numberline': return a < m.max ? a + 1 : a - 1;
    case 'angle': return a < 175 ? a + 5 : a - 5;
    case 'bars': return a < m.max ? a + 1 : a - 1;
    case 'plot': return m.quadrant ? [-a[0], a[1]] : [a[0] < (m.range || 6) ? a[0] + 1 : a[0] - 1, a[1]];
    case 'line': { const r = m.range || 6; return Math.abs(a.b + a.m + 1) <= r && a.m + 1 !== 0 ? { m: a.m + 1, b: a.b } : { m: a.m - 1, b: a.b }; }
    case 'squares': return { a: a.a, b: a.b + 1 };
    default: return null;
  }
}
