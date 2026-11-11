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
//   plot        also with manip.line (a point of the line), manip.shape (the vertex that completes it)
//               or manip.lines (two lines [{m, b}, {m, b}]: their meeting point)
//   balance     a scale {lx, l1, rx, r1}: boxes x and unit weights on the left and right pans
//               answer: the value of x (one box alone on a pan, that many weights on the other, the beam level)
//   tiles       algebra tiles {px, nx, p1, n1}: x, −x, 1 and −1 tiles     answer: {k, c} for kx + c, no zero pair left
//   area        a rectangle {a, b}: a high, x + b long                  answer: {a, b}
//   ray         an inequality on the number line {at, dir, closed}      answer: {at, dir, closed}; dir 1 right, −1 left
import { near, plainNum, gcd, linText } from './util.js';

const QUAD_NAMES = ['', 'הרביע הראשון', 'הרביע השני', 'הרביע השלישי', 'הרביע הרביעי'];
export const quadOf = ([x, y]) => (x > 0 && y > 0 ? 1 : x < 0 && y > 0 ? 2 : x < 0 && y < 0 ? 3 : x > 0 && y < 0 ? 4 : 0);

// ---------------------------------------------------------------- the balance (מאזניים)
// The student removes one box or one weight at a time from one pan; the beam tilts when the pans differ, and a level
// scale whose four counts share a divisor can be divided into that many equal parts (both pans together). Nothing is
// ever added, except by undoing. So the rule "the same on both sides" is the student's choice, never the tool's.

/** Most of a kind a pan can hold (the drawing is made for these; generators keep weights to 12 a pan). */
export const BALANCE_MAX = { boxes: 6, weights: 20 };
/** How the beam leans: −1 the left pan is heavier (it goes down), 1 the right one, 0 level. x is a box's weight. */
export const balanceTilt = (u, x) => Math.sign((u.rx * x + u.r1) - (u.lx * x + u.l1));
/** One box alone on a pan, the box's weight in weights on the other: x is found. */
export const balanceSolved = (u, x) => !!u && ((u.lx === 1 && u.l1 === 0 && u.rx === 0 && u.r1 === x) || (u.rx === 1 && u.r1 === 0 && u.lx === 0 && u.l1 === x));
/** The largest number every count on the scale divides by (2 or more), whether or not it is level; or null. */
export function countsDivisor(u) {
  const g = [u.lx, u.l1, u.rx, u.r1].reduce((a, b) => (b ? (a ? gcd(a, b) : b) : a), 0);
  return g > 1 ? g : null;
}
/** The number both pans can be divided by now (level, and every count divisible by it), or null. */
export function balanceDivisor(u, x) {
  if (balanceTilt(u, x) !== 0) return null;
  return countsDivisor(u);
}
export const balanceDivide = (u, g) => ({ lx: u.lx / g, l1: u.l1 / g, rx: u.rx / g, r1: u.r1 / g });
export const BALANCE_GROUPS = ['lx', 'l1', 'rx', 'r1'];
/** One item less in a group ('lx' a box on the left, 'r1' a weight on the right...), or null when it is empty. */
export const balanceRemove = (u, g) => (u[g] > 0 ? { ...u, [g]: u[g] - 1 } : null);

/**
 * Can the scale reach "x found" from `start` with the student's moves? `pans` limits the removals to some pans
 * ('l', 'r' or 'lr'): with one pan alone a level start can never be solved, which is what makes the tool honest.
 */
export function balanceReachable(start, x, pans = 'lr') {
  const key = (u) => `${u.lx},${u.l1},${u.rx},${u.r1}`;
  const seen = new Set([key(start)]); const queue = [start];
  while (queue.length) {
    const u = queue.shift();
    if (balanceSolved(u, x)) return true;
    const next = BALANCE_GROUPS.filter((g) => pans.includes(g[0])).map((g) => balanceRemove(u, g)).filter(Boolean);
    const d = balanceDivisor(u, x); if (d) next.push(balanceDivide(u, d));
    next.forEach((v) => { const k = key(v); if (!seen.has(k)) { seen.add(k); queue.push(v); } });
  }
  return false;
}
/** One pan as maths: 3x + 5, x, 11, 0. */
export const panTex = (n, w) => linText({ k: n, c: w });
/** The scale as an equation, or with ≠ while it leans. */
export const balanceTex = (u, x) => `${panTex(u.lx, u.l1)} ${x == null || balanceTilt(u, x) === 0 ? '=' : '\\ne'} ${panTex(u.rx, u.r1)}`;
const boxes = (n) => (n === 1 ? 'קופסה אחת' : `${n} קופסאות`);
const weights = (n) => (n === 1 ? 'משקולת אחת' : `${n} משקולות`);
/** What is on one pan, in words: "3 קופסאות ו־5 משקולות", "קופסה אחת", "כף ריקה". */
export function panWords(n, w) {
  if (!n && !w) return 'כף ריקה';
  if (!w) return boxes(n);
  if (!n) return weights(w);
  return `${boxes(n)} ו־${weights(w)}`;
}
export const balanceWords = (u) => `בכף השמאלית ${panWords(u.lx, u.l1)}, בכף הימנית ${panWords(u.rx, u.r1)}`;

// ---------------------------------------------------------------- algebra tiles (אריחים)

/** Most tiles a row holds: x tiles (x and −x together) and unit tiles (1 and −1 together). */
export const TILES_MAX = { x: 5, unit: 8 };
/** The tiles as they lie, term by term: 3x - x + 2 - 5. Nothing at all is 0. */
export function tilesTex(u) {
  const terms = [];
  const push = (n, sign, unit) => { if (n) terms.push({ sign, body: unit ? String(n) : n === 1 ? 'x' : `${n}x` }); };
  push(u.px, '+', false); push(u.nx, '-', false); push(u.p1, '+', true); push(u.n1, '-', true);
  if (!terms.length) return '0';
  return terms.map((t, i) => (i === 0 ? (t.sign === '-' ? `-${t.body}` : t.body) : `${t.sign} ${t.body}`)).join(' ');
}
/** How many zero pairs each row still has. */
export const tilesPairs = (u) => ({ x: Math.min(u.px, u.nx), unit: Math.min(u.p1, u.n1) });
const tileCount = (n, one, many) => (n === 1 ? one : `${n} ${many}`);
export const tilesWords = (u) => [
  u.px && tileCount(u.px, 'אריח x אחד', 'אריחי x'), u.nx && tileCount(u.nx, 'אריח −x אחד', 'אריחי −x'),
  u.p1 && tileCount(u.p1, 'אריח 1 אחד', 'אריחי 1'), u.n1 && tileCount(u.n1, 'אריח −1 אחד', 'אריחי −1'),
].filter(Boolean).join(', ') || 'אין אריחים';

// ---------------------------------------------------------------- the area model (מלבן)

/** a(x + b) as maths: 3(x + 4), x + 4 (a = 1), 3x (b = 0). */
export const areaTex = ({ a, b }) => (b === 0 ? linText({ k: a, c: 0 }) : a === 1 ? `x + ${b}` : `${a}(x + ${b})`);
/** Its two parts' areas added: 3x + 12. */
export const areaSumTex = ({ a, b }) => linText({ k: a, c: a * b });

// ---------------------------------------------------------------- an inequality on the number line (קרן)

/** The inequality a ray shows: x ≥ 4 (closed circle, to the right), x < −3 (open, to the left). */
export const rayText = ({ at, dir, closed }, v = 'x') => `${v} ${dir > 0 ? (closed ? '≥' : '>') : (closed ? '≤' : '<')} ${plainNum(at)}`;
export const rayTex = ({ at, dir, closed }, v = 'x') => `${v} ${dir > 0 ? (closed ? '\\ge' : '>') : (closed ? '\\le' : '<')} ${plainNum(at)}`;
/** Is a number on the ray? */
export const rayHas = ({ at, dir, closed }, n) => (n === at ? !!closed : dir > 0 ? n > at : n < at);

// ---------------------------------------------------------------- the teaching figures in words (STUDENT-8)
// The spoken name of each drawing (components/Figure.jsx puts it in aria-label): what a sighted student sees, never
// more. A coordinate plane names its points but not where they are, because an exercise may ask exactly that.

/** A number as the drawings write it: a real minus sign, a half as 2.5 (as 1/2 with decimal false: a line cut in parts). */
export const figNum = (v, decimal = true) => plainNum(v, { decimal }).replace(/^-/, '−');
/** A rule written in TeX (2x + 1, x \cdot 3 - 2) as the text a drawing can hold. */
export const ruleText = (tex) => String(tex ?? '').replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, '$1/$2').replace(/\\(cdot|times)/g, '×')
  .replace(/\\div/g, ':').replace(/\\[a-zA-Z]+|[{}\\]/g, '').replace(/-/g, '−').replace(/\s+/g, ' ').trim();
/** Where two lines y = mx + b cross, or null when they are parallel (or one line). */
export const linesMeet = (p, q) => (p.m === q.m ? null : [(q.b - p.b) / (p.m - q.m), (p.m * (q.b - p.b)) / (p.m - q.m) + p.b]);
/** What a machine takes in or gives out, as drawn: x and y when nothing is given. */
export const machineIO = (v, letter) => (v == null ? letter : typeof v === 'number' ? figNum(v) : String(v));

export function figWords(f) {
  switch (f.type) {
    case 'numline': {
      const at = (v) => figNum(v, !f.den);
      return `ציר מספרים מ־${at(f.from)} עד ${at(f.to)}${f.den ? `, כל יחידה מחולקת ל־${f.den} חלקים` : ''}${(f.marks || []).map((k) => `, נקודה${/^[A-Z]$/.test(k.label || '') ? ` ${k.label}` : ''} ב־${at(k.x)}`).join('')}${(f.jumps || []).map((j) => `, קפיצה מ־${at(j.from)} ל־${at(j.to)}`).join('')}`;
    }
    case 'thermo': return f.also
      ? `שני מדחומים: ${[f, f.also].map((t) => `${t.label ? `${t.label} ` : ''}${figNum(t.value)} מעלות`).join(', ')}`
      : `מדחום שמראה ${figNum(f.value)} מעלות${f.label ? `, ${f.label}` : ''}`;
    case 'machine': {
      const out = machineIO(f.outY, 'y');
      return `מכונה: נכנס ${machineIO(f.inX, 'x')}, הכלל ${ruleText(f.rule)}, יוצא ${out === '?' ? 'סימן שאלה' : out}`;
    }
    case 'dots': {
      const k = f.mark || {};
      return `תרשים נקודות של ${f.values.length} ערכים בין ${figNum(f.axis[0])} ל־${figNum(f.axis[1])}${k.mode != null ? ', השכיח מסומן' : ''}${k.median != null ? ', החציון מסומן' : ''}${k.mean != null ? ', הממוצע מסומן' : ''}${f.unit ? `: ${f.unit}` : ''}`;
    }
    case 'bars': {
      // a bar with no name is read by its value; a missing one says so; the level line is read last
      const bar = (l, v) => [l, v == null ? 'חסר' : figNum(v)].filter(Boolean).join(' ');
      return `תרשים עמודות: ${f.labels.map((l, i) => bar(l, f.values[i])).join(', ')}${f.unit ? ` (${f.unit})` : ''}${f.level != null ? `, קו בגובה ${figNum(f.level)}` : ''}`;
    }
    case 'coord': {
      const names = (f.points || []).filter((p) => !p.hidden).map((p) => p.label);
      const lines = [...(f.line ? [f.line] : []), ...(f.lines || [])];
      const meet = f.meet && f.lines?.length > 1 ? linesMeet(f.lines[0], f.lines[1]) : null;
      const rr = f.riseRun && lines[0] ? { run: f.riseRun.run, rise: lines[0].m * f.riseRun.run } : null;
      const said = lines.map((l) => l.label).filter(Boolean);
      // a rectangle with sides along the grid is named so; a shape's sides and the words on the plane are read out
      const rect = f.polygon?.length === 4 && f.polygon.every(([x, y], i) => { const [u, v] = f.polygon[(i + 1) % 4]; return x === u || y === v; });
      const segs = f.segments?.length || 0;
      return ['מערכת צירים', f.quadrants && 'ארבעה רביעים', f.polygon && (rect ? 'מלבן' : 'מצולע'), segs && (segs === 1 ? 'קטע' : `${segs} קטעים`),
        names.length && `${names.length === 1 ? 'הנקודה' : 'הנקודות'} ${names.join(', ')}`,
        lines.length && (lines.length === 1 ? `ישר${said.length ? ` ${said[0]}` : ''}` : `${lines.length} ישרים${said.length ? `: ${said.join(', ')}` : ''}`),
        meet && `הישרים נפגשים ב־(${figNum(meet[0])}, ${figNum(meet[1])})`,
        f.path?.length && 'מסלול מראשית הצירים',
        rr && `צעד של ${figNum(Math.abs(rr.run))} ${rr.run > 0 ? 'ימינה' : 'שמאלה'} ו־${figNum(Math.abs(rr.rise))} ${rr.rise >= 0 ? 'למעלה' : 'למטה'}`,
        f.words?.length && `כתוב: ${f.words.map((w) => w.text).join(', ')}`].filter(Boolean).join(', ');
    }
    default: return '';
  }
}

// ---------------------------------------------------------------- checking, words and test states

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
    // the answer is x's value: the value itself counts (as answerText shows it), and a scale must show one box alone
    case 'balance': return typeof u === 'number' ? u === a : balanceSolved(u, a);
    case 'tiles': return u.px - u.nx === a.k && u.p1 - u.n1 === a.c && Math.min(u.px, u.nx) === 0 && Math.min(u.p1, u.n1) === 0;
    case 'area': return u.a === a.a && u.b === a.b;
    case 'ray': return u.at === a.at && u.dir === a.dir && !!u.closed === !!a.closed;
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
const ltr = (t) => `⁦${t}⁩`;
export const lineText = ({ m, b }) => `y = ${m === 1 ? '' : m === -1 ? '-' : num(m)}x${b === 0 ? '' : b > 0 ? ` + ${num(b)}` : ` - ${num(-b)}`}`;

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
    // the answer is x's value; a student's state is the scale as an equation (≠ while it leans)
    case 'balance': return typeof u === 'number' ? `x = ${num(u)}` : balanceTex(u, it.answer).replace('\\ne', '≠');
    case 'tiles': return u.px != null ? tilesTex(u) : linText(u);
    case 'area': return areaTex(u);
    case 'ray': return rayText(u);
    default: return '';
  }
}

/** The interactive setup in words, for the AI tutor and the teacher. */
export function manipPlain(it) {
  const m = it.manip;
  switch (m.kind) {
    case 'numberline': return `[ציר מספרים מ־${m.min} עד ${m.max}; מזיזים סמן מהנקודה ${m.from}]`;
    case 'plot': return m.quadrant ? `[מערכת צירים; שמים נקודה ב${QUAD_NAMES[m.quadrant]}${m.fixX != null ? ` שה־x שלה ${m.fixX}` : m.fixY != null ? ` שה־y שלה ${m.fixY}` : ''}]`
      : m.line ? `[מערכת צירים עם הישר; שמים עליו את הנקודה שבה x = ${it.answer[0]}]`
        : m.lines ? `[מערכת צירים עם שני ישרים, ${m.lines.map(lineText).join(' ו־')}; שמים את נקודת המפגש שלהם]`
          : m.shape ? `[מערכת צירים; הקודקודים ${m.shape.map((q) => `${q.label}(${q.at.join(', ')})`).join(', ')}; שמים את הקודקוד ${m.label}]` : `[מערכת צירים; שמים את הנקודה ${m.label || ''}]`;
    case 'line': return '[מערכת צירים; בונים ישר בעזרת שתי נקודות: החיתוך עם ציר y וצעד אחד ימינה]';
    case 'angle': return `[קו ישר וקרן מסתובבת; הזווית הצמודה צריכה להיות ${m.target}°]`;
    case 'squares': return `[משולש ישר־זווית עם ריבועים על הצלעות; שטח הריבוע על היתר צריך להיות ${it.answer.c * it.answer.c}]`;
    case 'bars': return m.stat === 'median' ? `[עמודות: ${m.values.join(', ')} ועוד עמודה אחת שמזיזים; החציון צריך להיות ${m.target}]` : `[עמודות: ${m.values.join(', ')} ועוד עמודה אחת שמזיזים; הממוצע צריך להיות ${m.mean}]`;
    case 'pins': return `[ציר מספרים מ־${m.min} עד ${m.max}; שמים עליו את המספרים ${m.labels.join(', ')}]`;
    case 'triangle': return `[משולש ABC עם A(${m.A.join(', ')}) ו־B(${m.B.join(', ')}); מזיזים את C עד שהזווית C ישרה]`;
    case 'balance': return `[מאזניים מאוזנים: ${balanceWords(m.start)}. כל קופסה שוקלת x משקולות. מורידים קופסאות ומשקולות מהכפות עד שנשארת קופסה אחת לבד]`;
    case 'tiles': return `[אריחים: ${tilesWords(m.start)}; מורידים זוגות אפס (x עם −x, 1 עם −1)]`;
    case 'area': return `[מלבן שבונים: גובה (עד ${m.maxA || 6}) ואורך x ועוד יחידות (עד ${m.maxB || 9})]`;
    case 'ray': return `[ציר מספרים מ־${m.min ?? -10} עד ${m.max ?? 10}; מסמנים את הפתרונות: נקודה, עיגול מלא או ריק, וקרן ימינה או שמאלה]`;
    default: return '';
  }
}

/** A state that answers the exercise (the shape the object holds, not the shape of `answer`). */
export function manipSolution(it) {
  const a = it.answer; const m = it.manip;
  switch (m.kind) {
    case 'squares': return { a: a.a, b: a.b };
    // the box stays on the pan that had more boxes
    case 'balance': return m.start.lx >= m.start.rx ? { lx: 1, l1: 0, rx: 0, r1: a } : { lx: 0, l1: a, rx: 1, r1: 0 };
    case 'tiles': return { px: Math.max(a.k, 0), nx: Math.max(-a.k, 0), p1: Math.max(a.c, 0), n1: Math.max(-a.c, 0) };
    default: return a;
  }
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
    // one step short: level, but a weight left beside the box
    case 'balance': { const s = manipSolution(it); return s.lx ? { ...s, l1: 1, r1: s.r1 + 1 } : { ...s, r1: 1, l1: s.l1 + 1 }; }
    // one zero pair left
    case 'tiles': { const s = manipSolution(it); return s.p1 + s.n1 + 2 <= TILES_MAX.unit ? { ...s, p1: s.p1 + 1, n1: s.n1 + 1 } : { ...s, px: s.px + 1, nx: s.nx + 1 }; }
    case 'area': return { a: a.a, b: a.b < (m.maxB || 9) ? a.b + 1 : a.b - 1 };
    // the boundary: the circle full instead of empty, or the other way
    case 'ray': return { ...a, closed: !a.closed };
    default: return null;
  }
}
