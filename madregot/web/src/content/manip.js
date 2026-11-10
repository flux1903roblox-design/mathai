// Interactive exercises ("manip"): the answer is the state of a maths object the student moves.
// This module checks that state and puts it into words; the drawing lives in components/manip.
//
// kinds and the value each one holds:
//   numberline  a whole number on a number line            answer: the number
//   plot        a point [x, y] on the grid                 answer: [x, y], or any point in manip.quadrant (with manip.fixX / fixY: on that line)
//   line        a line {m, b} built from two handles       answer: {m, b}
//   angle       the turning ray's angle ∠AOB in degrees    answer: degrees
//   squares     the legs {a, b} of a right triangle        answer: {c} (any whole a, b with a² + b² = c²)
//   bars        the height of the movable bar              answer: the value (manip.stat 'median': the median is the target)
//   pins        several labelled markers on a number line  answer: the position of each, in order
//   triangle    the free vertex C of triangle ABC           answer: an example C; right: any C with a right angle at C
//   plot        also with manip.line (a point of the line) or manip.shape (the vertex that completes it)
import { near, plainNum } from './util.js';

const QUAD_NAMES = ['', 'הרביע הראשון', 'הרביע השני', 'הרביע השלישי', 'הרביע הרביעי'];
export const quadOf = ([x, y]) => (x > 0 && y > 0 ? 1 : x < 0 && y > 0 ? 2 : x < 0 && y < 0 ? 3 : x > 0 && y < 0 ? 4 : 0);

export function manipCorrect(it, u) {
  if (u == null) return false;
  const m = it.manip; const a = it.answer;
  switch (m.kind) {
    case 'numberline': case 'angle': case 'bars': return u === a;
    case 'plot': return m.quadrant ? quadOf(u) === m.quadrant && (m.fixX == null || u[0] === m.fixX) && (m.fixY == null || u[1] === m.fixY) : u[0] === a[0] && u[1] === a[1];
    case 'line': return near(u.m, a.m, 1e-9) && near(u.b, a.b, 1e-9);
    case 'squares': return Number.isInteger(u.a) && Number.isInteger(u.b) && u.a * u.a + u.b * u.b === a.c * a.c;
    case 'pins': return Array.isArray(u) && u.length === a.length && u.every((v, i) => v === a[i]);
    case 'triangle': return rightAtC(m, u);
    default: return false;
  }
}

const num = (v) => plainNum(v);
/** Triangle ABC with A and B fixed: is the angle at C (strictly above the base) exactly a right angle? */
export const rightAtC = (m, c) => !!c && c[1] > 0 && (m.A[0] - c[0]) * (m.B[0] - c[0]) + (m.A[1] - c[1]) * (m.B[1] - c[1]) === 0;
/** The three angles of the triangle in degrees, A, B and C. */
export function triangleAngles(m, c) {
  const ang = (p, q, r) => { const u = [q[0] - p[0], q[1] - p[1]]; const v = [r[0] - p[0], r[1] - p[1]]; return (Math.acos((u[0] * v[0] + u[1] * v[1]) / (Math.hypot(...u) * Math.hypot(...v))) * 180) / Math.PI; };
  return [ang(m.A, m.B, c), ang(m.B, m.A, c), ang(c, m.A, m.B)];
}
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
    case 'pins': return m.labels.map((l, i) => `${l} ב־${ltr(num(u[i]))}`).join(', ');
    case 'triangle': return u === it.answer ? `למשל ${ltr(`C(${num(u[0])}, ${num(u[1])})`)}: הזווית C ישרה` : ltr(`C(${num(u[0])}, ${num(u[1])})`);
    default: return '';
  }
}

/** The interactive setup in words, for the AI tutor and the teacher. */
export function manipPlain(it) {
  const m = it.manip;
  switch (m.kind) {
    case 'numberline': return `[ציר מספרים מ־${m.min} עד ${m.max}; מזיזים סמן מהנקודה ${m.from}]`;
    case 'plot': return m.quadrant ? `[מערכת צירים; שמים נקודה ב${QUAD_NAMES[m.quadrant]}${m.fixX != null ? ` שה־x שלה ${m.fixX}` : m.fixY != null ? ` שה־y שלה ${m.fixY}` : ''}]` : m.line ? `[מערכת צירים עם הישר; שמים עליו את הנקודה שבה x = ${it.answer[0]}]` : m.shape ? `[מערכת צירים; הקודקודים ${m.shape.map((q) => `${q.label}(${q.at.join(', ')})`).join(', ')}; שמים את הקודקוד ${m.label}]` : `[מערכת צירים; שמים את הנקודה ${m.label || ''}]`;
    case 'line': return '[מערכת צירים; בונים ישר בעזרת שתי נקודות: החיתוך עם ציר y וצעד אחד ימינה]';
    case 'angle': return `[קו ישר וקרן מסתובבת; הזווית הצמודה צריכה להיות ${m.target}°]`;
    case 'squares': return `[משולש ישר־זווית עם ריבועים על הצלעות; שטח הריבוע על היתר צריך להיות ${it.answer.c * it.answer.c}]`;
    case 'bars': return m.stat === 'median' ? `[עמודות: ${m.values.join(', ')} ועוד עמודה אחת שמזיזים; החציון צריך להיות ${m.target}]` : `[עמודות: ${m.values.join(', ')} ועוד עמודה אחת שמזיזים; הממוצע צריך להיות ${m.mean}]`;
    case 'pins': return `[ציר מספרים מ־${m.min} עד ${m.max}; שמים עליו את המספרים ${m.labels.join(', ')}]`;
    case 'triangle': return `[משולש ABC עם A(${m.A.join(', ')}) ו־B(${m.B.join(', ')}); מזיזים את C עד שהזווית C ישרה]`;
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
    case 'plot': return m.quadrant ? (m.fixX != null ? [a[0], -a[1]] : [-a[0], a[1]]) : [a[0] < (m.range || 6) ? a[0] + 1 : a[0] - 1, a[1]];
    case 'line': { const r = m.range || 6; return Math.abs(a.b + a.m + 1) <= r && a.m + 1 !== 0 ? { m: a.m + 1, b: a.b } : { m: a.m - 1, b: a.b }; }
    case 'squares': return { a: a.a, b: a.b + 1 };
    case 'pins': return a.map((v, i) => (i === 0 ? (v < m.max ? v + 1 : v - 1) : v));
    case 'triangle': return [a[0] + 1 <= (m.range || 6) ? a[0] + 1 : a[0] - 1, a[1]];
    default: return null;
  }
}
