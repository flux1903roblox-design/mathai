// Grade 8 (ח׳): ratio (ratio.js), percent (pct.js), functions (func.js), the linear function (linear.js), Pythagoras,
// statistics, equations and systems (sys.js).
import { R, pick, shuffle, near, TRIPLES, listMath } from './util.js';
import { LINEAR } from './linear.js';
import { SYS } from './sys.js';
import { RATIO } from './ratio.js';
import { PCT } from './pct.js';
import { FUNC } from './func.js';

// ---------------------------------------------------------------- Pythagoras
// About half the questions come from whole-number triangles (Pythagorean triples), the rest need a root that is not
// whole, rounded to tenths, as the grade-8 programme asks (roots of numbers that are not perfect squares, and
// estimating a root). A rounded answer is right when it is within half a tenth of the exact length (`exact`).
const scaled = () => { const [a, b, c] = pick(TRIPLES); return Math.random() < 0.5 ? [a, b, c] : [b, a, c]; };
const r1 = (x) => Math.round(x * 10) / 10;
const isSquare = (n) => Number.isInteger(Math.sqrt(n));
const ROUND = 'אם יוצא מספר לא שלם, עגלו לעשירית.';
/** "= 13" for a whole root, "≈ 7.1" for one that is not. */
const eqRoot = (n) => (isSquare(n) ? `= ${Math.sqrt(n)}` : `\\approx ${r1(Math.sqrt(n))}`);
/** Two legs (each up to max) whose hypotenuse is not whole. */
function rootLegs(max = 12) { for (;;) { const a = R(2, max); const b = R(2, max); if (!isSquare(a * a + b * b)) return [a, b]; } }
/** A hypotenuse and a leg (whole) whose other leg is not whole. */
function rootLeg() { for (;;) { const c = R(5, 20); const a = R(Math.ceil(c / 3), c - 1); if (!isSquare(c * c - a * a)) return [a, c]; } }

function hypotenuse() {
  const whole = Math.random() < 0.5;
  const [a, b] = whole ? scaled() : rootLegs();
  const n = a * a + b * b; const c = Math.sqrt(n);
  return {
    key: `py1:${a}:${b}`, text: `במשולש ישר־זווית נתונים שני הניצבים. מה אורך היתר? ${ROUND}`, form: 'num', answer: whole ? c : r1(c), exact: c, unit: 'ס״מ',
    fig: { type: 'right', a, b, c: '?' },
    hint: 'במשולש ישר־זווית: $a^2 + b^2 = c^2$, כש־$c$ הוא היתר (מול הזווית הישרה).',
    solution: [`$c^2 = ${a}^2 + ${b}^2 = ${a * a} + ${b * b} = ${n}$`, `$c = \\sqrt{${n}} ${eqRoot(n)}$`],
    diag: (u) => (near(u, a + b) ? 'add-legs' : near(u, n) ? 'no-root' : null),
  };
}

// Estimating a root without a calculator: between which two whole numbers is it?
function estimateRoot() {
  const [a, b] = rootLegs(9);
  const n = a * a + b * b; const lo = Math.floor(Math.sqrt(n));
  return {
    key: `py1e:${a}:${b}`, text: `בלי מחשבון: הניצבים $${a}$ ו־$${b}$, ולכן היתר הוא $\\sqrt{${n}}$. הוא נמצא בין שני מספרים שלמים עוקבים. כתבו את הקטן מהשניים.`,
    form: 'num', answer: lo,
    fig: { type: 'right', a, b, c: '?' },
    hint: `מחפשים את הריבוע השלם הגדול ביותר שעדיין קטן מ־$${n}$: $1, 4, 9, 16, 25, 36, 49, 64, 81, 100, \\ldots$`,
    solution: [`$${lo}^2 = ${lo * lo}$ ו־$${lo + 1}^2 = ${(lo + 1) ** 2}$`, `$${lo * lo} < ${n} < ${(lo + 1) ** 2}$, ולכן $${lo} < \\sqrt{${n}} < ${lo + 1}$`, `הקטן מהשניים: $${lo}$`],
    diag: (u) => (near(u, n) ? 'no-root' : null),
  };
}

// The theorem by building: change the legs until the square on the hypotenuse has area c².
const SQUARES = [[3, 4, 5], [6, 8, 10], [5, 12, 13], [9, 12, 15], [8, 15, 17], [12, 16, 20]];
function squaresHyp() {
  const [x, y, c] = pick(SQUARES); const [a, b] = Math.random() < 0.5 ? [x, y] : [y, x];
  return {
    key: `py1s:${c}:${a}`, text: `שנו את הניצבים כך שהיתר יהיה $${c}$: הריבוע על היתר צריך שטח $${c * c}$.`, form: 'manip',
    manip: { kind: 'squares', start: { a: 2, b: 2 }, max: 16 }, answer: { c, a, b },
    hint: `במשולש ישר־זווית שטח הריבוע על היתר שווה לסכום שטחי הריבועים על הניצבים: $a^2 + b^2 = c^2$. מחפשים שני ריבועים שיחד הם $${c * c}$.`,
    solution: [`$${a}^2 + ${b}^2 = ${a * a} + ${b * b} = ${c * c} = ${c}^2$`, `לכן ניצבים $${a}$ ו־$${b}$ נותנים יתר $${c}$.`],
    diag: (u) => (u && u.a + u.b === c ? 'add-legs' : null),
  };
}

function leg() {
  const whole = Math.random() < 0.5;
  let a; let c; let n;
  if (whole) { const t = scaled(); [a, , c] = t; n = t[1] * t[1]; } else { [a, c] = rootLeg(); n = c * c - a * a; }
  const b = Math.sqrt(n);
  return {
    key: `py2:${a}:${c}`, text: `במשולש ישר־זווית נתונים היתר וניצב אחד. מה אורך הניצב השני? ${ROUND}`, form: 'num', answer: whole ? b : r1(b), exact: b, unit: 'ס״מ',
    fig: { type: 'right', a, b: '?', c },
    hint: 'מחפשים ניצב, אז מחסרים: $b^2 = c^2 - a^2$.',
    solution: [`$b^2 = ${c}^2 - ${a}^2 = ${c * c} - ${a * a} = ${n}$`, `$b = \\sqrt{${n}} ${eqRoot(n)}$`],
    diag: (u) => (near(u, Math.sqrt(a * a + c * c), 0.06) ? 'add-not-sub' : near(u, c - a) ? 'subtract-sides' : near(u, n) ? 'no-root' : null),
  };
}

/** Three sides of a real triangle that just miss being right-angled (a triple with one side moved by one). */
function nearMiss() {
  for (;;) {
    const [a, b, c] = pick(TRIPLES);
    const s = pick([[a, b, c + 1], [a, b, c - 1], [a + 1, b, c], [a, b + 1, c], [a, b, c + 2]]);
    const [u, v, w] = [...s].sort((x, y) => x - y);
    if (u + v > w && v < w && u * u + v * v !== w * w) return shuffle(s);
  }
}
const isRightSet = (s) => { const [u, v, w] = [...s].sort((x, y) => x - y); return u * u + v * v === w * w; };
const setTex = (s) => s.join(',\\ ');
const checkLine = (s) => { const [u, v, w] = [...s].sort((x, y) => x - y); return `$${setTex(s)}$: $${u}^2 + ${v}^2 = ${u * u + v * v}$, $${w}^2 = ${w * w}$, ${u * u + v * v === w * w ? 'שווים: ישר־זווית' : 'לא שווים'}.`; };
/** Four triangles: each one right-angled (a triple, its sides in any order) or a near miss. */
function fourSets(right) { return Array.from({ length: 4 }, (_, i) => (right(i) ? shuffle(scaled()) : nearMiss())); }

// Which of four triangles is right-angled (or none): five answers, each as likely, so testing is the only way.
function whichRight() {
  const k = R(0, 4); // 4: none of them
  const sets = fourSets((i) => i === k);
  const rightSet = sets[k];
  return {
    key: `py3w:${sets.map((s) => s.join(',')).join(';')}`, text: 'איזה מהמשולשים האלה ישר־זווית? (אורכי הצלעות בס״מ)', form: 'mc',
    choices: [...sets.map((s) => ({ tex: setTex(s) })), { text: 'אף אחד מהם' }], answer: k,
    hint: 'בכל משולש: הצלע הארוכה היא המועמדת להיות היתר. בודקים אם הריבוע שלה שווה לסכום הריבועים של שתי האחרות.',
    solution: sets.map(checkLine),
    // the side written last taken as the hypotenuse: a right triangle whose hypotenuse is not last is missed
    diag: (u) => (u === 4 && k < 4 && rightSet[2] !== Math.max(...rightSet) ? 'wrong-hyp' : null),
  };
}

// How many of four triangles are right-angled: 0 to 4, each as likely.
function howManyRight() {
  const n = R(0, 4);
  const pickRight = shuffle([0, 1, 2, 3]).slice(0, n);
  const sets = fourSets((i) => pickRight.includes(i));
  const lastHyp = sets.filter((s) => isRightSet(s) && s[2] === Math.max(...s)).length;
  return {
    key: `py3n:${sets.map((s) => s.join(',')).join(';')}`, text: 'כמה מהמשולשים בטבלה ישרי־זווית?', form: 'num', answer: n,
    fig: { type: 'table', head: ['משולש', 'אורכי הצלעות (ס״מ)'], rows: sets.map((s, i) => [['א', 'ב', 'ג', 'ד'][i], s.join(', ')]) },
    hint: 'בודקים כל משולש לבד: האם הריבוע של הצלע הארוכה שווה לסכום הריבועים של שתי האחרות?',
    solution: [...sets.map(checkLine), `ישרי־זווית: $${n}$`],
    diag: (u) => (u === 4 && n < 4 ? 'assume-right' : u === lastHyp && lastHyp !== n ? 'wrong-hyp' : null),
  };
}

function ladder() {
  const askHeight = Math.random() < 0.6;
  const whole = Math.random() < 0.5;
  let wall; let foot; let len;
  if (whole) { const [a, b, c] = pick(TRIPLES.filter((t) => t[2] <= 26)); wall = Math.max(a, b); foot = Math.min(a, b); len = c; } else if (askHeight) {
    for (;;) { len = R(8, 26); foot = R(2, Math.floor(len / 2)); if (!isSquare(len * len - foot * foot)) break; }
    wall = Math.sqrt(len * len - foot * foot);
  } else {
    for (;;) { wall = R(6, 24); foot = R(2, Math.min(12, wall - 1)); if (!isSquare(wall * wall + foot * foot)) break; }
    len = Math.sqrt(wall * wall + foot * foot);
  }
  const exact = askHeight ? wall : len;
  const n = askHeight ? len * len - foot * foot : wall * wall + foot * foot;
  return {
    key: `py4:${askHeight ? 'h' : 'L'}:${foot}:${askHeight ? len : wall}`,
    // short enough to stay three lines on a 320px phone, so the drawing below keeps its room (e2e/layout.spec.js)
    text: askHeight
      ? `סולם באורך ${len} דצ״מ נשען על קיר, ורגלו ${foot} דצ״מ מהקיר. לאיזה גובה הוא מגיע? ${ROUND}`
      : `סולם נשען על קיר ומגיע לגובה ${wall} דצ״מ, ורגלו ${foot} דצ״מ מהקיר. מה אורך הסולם? ${ROUND}`,
    form: 'num', answer: isSquare(n) ? exact : r1(exact), exact, unit: 'דצ״מ',
    fig: { type: 'ladder', wall: askHeight ? '?' : wall, foot, len: askHeight ? len : '?' },
    hint: 'הקיר, הרצפה והסולם יוצרים משולש ישר־זווית. הסולם הוא היתר.',
    solution: askHeight
      ? [`$h^2 = ${len}^2 - ${foot}^2 = ${n}$`, `$h = \\sqrt{${n}} ${eqRoot(n)}$`]
      : [`$L^2 = ${wall}^2 + ${foot}^2 = ${n}$`, `$L = \\sqrt{${n}} ${eqRoot(n)}$`],
    diag: (u) => (askHeight && near(u, Math.sqrt(len * len + foot * foot), 0.06) ? 'add-not-sub' : !askHeight && near(u, wall + foot) ? 'add-legs' : null),
  };
}

function distance() {
  for (;;) {
    const whole = Math.random() < 0.35;
    const [a, b] = whole ? scaled() : [R(1, 8), R(1, 8)];
    if (a > 12 || b > 12 || (!whole && isSquare(a * a + b * b))) continue;
    const sx = pick([1, -1]); const sy = pick([1, -1]);
    const x1 = R(-6, 6); const y1 = R(-6, 6);
    const x2 = x1 + sx * a; const y2 = y1 + sy * b;
    if (Math.abs(x2) > 6 || Math.abs(y2) > 6) continue;
    const n = a * a + b * b; const d = Math.sqrt(n);
    return {
      key: `py5:${x1}:${y1}:${x2}:${y2}`, text: `מה המרחק בין $A(${x1}, ${y1})$ ל־$B(${x2}, ${y2})$? ${ROUND}`, form: 'num', answer: whole ? d : r1(d), exact: d, unit: 'יחידות',
      fig: { type: 'coord', range: 6, points: [{ x: x1, y: y1, label: 'A' }, { x: x2, y: y2, label: 'B' }], segments: [[[x1, y1], [x2, y2]]], helper: [[x1, y1], [x2, y1], [x2, y2]] },
      hint: 'משלימים משולש ישר־זווית: הניצבים הם השינוי ב־$x$ והשינוי ב־$y$.',
      solution: [`$\\Delta x = ${a}$, $\\Delta y = ${b}$`, `$d = \\sqrt{${a}^2 + ${b}^2} = \\sqrt{${n}} ${eqRoot(n)}$`],
      diag: (u) => (near(u, a + b) ? 'add-legs' : near(u, n) ? 'no-root' : null),
    };
  }
}

// ---------------------------------------------------------------- statistics
const sortNum = (arr) => [...arr].sort((x, y) => x - y);
const listTex = (arr) => arr.join(',\\ ');
// A list of numbers in a question: one expression per number inside a left-to-right isolate,
// so it keeps its order in a Hebrew line and a narrow screen can wrap it between numbers.

// The mode is a value that repeats three times among 13 or 15, with at least two others close behind (twice each):
// a value picked from the list at random is the mode only about one time in five (src/learn/guessing.test.ts).
function mode() {
  for (;;) {
    const n = pick([13, 15]); const m = R(2, 12);
    const arr = [m, m, m];
    while (arr.length < n) { const v = R(1, 15); if (arr.filter((x) => x === v).length < 2 && v !== m) arr.push(v); }
    const counts = {}; arr.forEach((v) => { counts[v] = (counts[v] || 0) + 1; });
    if (Object.values(counts).filter((c) => c >= 3).length !== 1 || Object.values(counts).filter((c) => c === 2).length < 2) continue;
    const list = shuffle(arr); const max = Math.max(...arr);
    if (max === m) continue;
    return {
      key: `st1:${list.join(',')}`, text: `מה השכיח של הנתונים ${listMath(list)}?`, form: 'num', answer: m,
      hint: 'השכיח הוא הערך שמופיע הכי הרבה פעמים.',
      solution: [`$${m}$ מופיע ${counts[m]} פעמים, יותר מכל ערך אחר.`],
      diag: (u) => (near(u, max) ? 'mode-max' : near(u, sortNum(list)[Math.floor(n / 2)]) ? 'mode-median' : near(u, counts[m]) ? 'mode-count' : null),
    };
  }
}

function median() {
  for (;;) {
    const n = pick([7, 9, 6, 8]); const arr = Array.from({ length: n }, () => R(1, 20));
    const s = sortNum(arr);
    const med = n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
    if (!Number.isInteger(med * 2)) continue;
    const list = shuffle(arr);
    const unsortedMid = n % 2 ? list[(n - 1) / 2] : (list[n / 2 - 1] + list[n / 2]) / 2;
    if (near(unsortedMid, med)) continue;
    return {
      key: `st2:${list.join(',')}`, text: `מה החציון של הנתונים ${listMath(list)}?`, form: 'num', answer: med,
      hint: n % 2 ? 'מסדרים את הנתונים מהקטן לגדול. החציון הוא הערך שבאמצע.' : 'מסדרים מהקטן לגדול. במספר זוגי של נתונים, החציון הוא הממוצע של שני האמצעיים.',
      solution: [`מסודר: $${listTex(s)}$`, n % 2 ? `האמצעי: $${med}$` : `$\\frac{${s[n / 2 - 1]} + ${s[n / 2]}}{2} = ${med}$`],
      diag: (u) => (near(u, unsortedMid) ? 'unsorted' : near(u, arr.reduce((x, y) => x + y, 0) / n) ? 'mean-not-median' : null),
    };
  }
}

function mean() {
  for (;;) {
    const n = R(4, 6); const arr = Array.from({ length: n }, () => R(2, 20));
    const sum = arr.reduce((x, y) => x + y, 0);
    if (sum % n) continue;
    const avg = sum / n; const s = sortNum(arr);
    const med = n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
    if (near(med, avg)) continue;
    return {
      key: `st3:${arr.join(',')}`, text: `מה הממוצע של הנתונים ${listMath(arr)}?`, form: 'num', answer: avg,
      hint: 'מחברים את כל הנתונים ומחלקים במספר הנתונים.',
      solution: [`סכום: $${arr.join(' + ')} = ${sum}$`, `$${sum} : ${n} = ${avg}$`],
      diag: (u) => (near(u, med) ? 'median-not-mean' : near(u, sum) ? 'no-divide' : null),
    };
  }
}

// The mean by moving one value: the mean line follows the bar.
// The median by moving one value: the last bar decides which value is in the middle, and the mean line shows
// how far an outlier pulls the mean while the median hardly moves.
function medianBars() {
  const a = R(1, 3); const b = R(a + 1, 5); const c = R(b + 3, 9); const d = R(c + 1, 12);
  const t = R(b + 1, c - 1);
  const vals = shuffle([a, b, c, d]);
  const start = t === 12 ? 11 : 12;
  const sorted = [a, b, t, c, d];
  return {
    key: `st2b:${vals.join(',')}:${t}`, text: `גררו את העמודה האחרונה כך שהחציון של כל העמודות יהיה $${t}$.`, form: 'manip',
    manip: { kind: 'bars', stat: 'median', values: vals, target: t, max: 12, start }, answer: t,
    hint: 'מסדרים את חמשת המספרים מהקטן לגדול. החציון הוא המספר האמצעי, השלישי.',
    solution: [`בסדר עולה: $${sorted.join(',\\ ')}$`, `כדי שהמספר האמצעי יהיה $${t}$, העמודה האחרונה צריכה להיות $${t}$.`],
    diag: (u) => ((vals.reduce((s, v) => s + v, 0) + u) / 5 === t ? 'mean-not-median' : null),
  };
}

function meanBars() {
  for (;;) {
    const n = 5; const mean = R(3, 8);
    const vals = Array.from({ length: n - 1 }, () => R(1, 10));
    const sum = vals.reduce((t, v) => t + v, 0);
    const last = mean * n - sum;
    if (last < 0 || last > 12 || vals.includes(last)) continue;
    let start; do { start = R(0, 12); } while (start === last);
    return {
      key: `st3b:${vals.join(',')}:${mean}`, text: `גררו את העמודה האחרונה כך שהממוצע של כל העמודות יהיה $${mean}$.`, form: 'manip',
      manip: { kind: 'bars', values: vals, mean, max: 12, start }, answer: last,
      hint: `ממוצע $${mean}$ של $${n}$ מספרים פירושו שהסכום שלהם הוא $${mean} \\cdot ${n} = ${mean * n}$.`,
      solution: [`הסכום צריך להיות $${mean} \\cdot ${n} = ${mean * n}$.`, `סכום ארבע העמודות: $${vals.join(' + ')} = ${sum}$.`, `העמודה האחרונה: $${mean * n} - ${sum} = ${last}$.`],
      diag: (u) => (u === mean ? 'mean-as-answer' : null),
    };
  }
}

function freqMean() {
  for (;;) {
    const vals = sortNum(shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]).slice(0, R(3, 4)));
    const freqs = vals.map(() => R(1, 6));
    const n = freqs.reduce((x, y) => x + y, 0);
    const sum = vals.reduce((acc, v, i) => acc + v * freqs[i], 0);
    const avg = sum / n;
    if (Math.round(avg * 100) / 100 !== avg) continue; // terminating, at most two decimals
    const naive = vals.reduce((x, y) => x + y, 0) / vals.length;
    if (near(naive, avg)) continue;
    return {
      key: `st4:${vals.join(',')}:${freqs.join(',')}`, text: 'בטבלה ציונים של שאלון קצר ומספר התלמידים שקיבלו כל ציון. מה הציון הממוצע?',
      form: 'num', answer: avg,
      fig: { type: 'table', head: ['ציון', 'מספר תלמידים'], rows: vals.map((v, i) => [v, freqs[i]]) },
      hint: 'כופלים כל ציון במספר התלמידים שקיבלו אותו, מחברים, ומחלקים במספר התלמידים הכולל.',
      solution: [`$${vals.map((v, i) => `${v} \\cdot ${freqs[i]}`).join(' + ')} = ${sum}$`, `מספר התלמידים: $${n}$`, `$${sum} : ${n} = ${avg}$`],
      diag: (u) => (near(u, naive) ? 'ignore-freq' : near(u, sum / vals.length) ? 'wrong-count' : null),
    };
  }
}

function missingValue() {
  for (;;) {
    const n = R(4, 6); const avg = R(5, 15); const known = Array.from({ length: n - 1 }, () => R(2, 20));
    const x = avg * n - known.reduce((a, b) => a + b, 0);
    if (x < 0 || x > 30) continue;
    return {
      key: `st5:${known.join(',')}:${avg}`, text: `הממוצע של ${n} מספרים הוא $${avg}$. ${n - 1} מהם הם ${listMath(known)}. מה המספר החסר?`,
      form: 'num', answer: x,
      hint: 'ממוצע כפול מספר הנתונים נותן את הסכום של כולם. מה חסר כדי להגיע לסכום הזה?',
      solution: [`סכום כולם: $${avg} \\cdot ${n} = ${avg * n}$`, `סכום הידועים: $${known.reduce((a, b) => a + b, 0)}$`, `החסר: $${avg * n} - ${known.reduce((a, b) => a + b, 0)} = ${x}$`],
      diag: (u) => (near(u, avg) ? 'mean-as-answer' : null),
    };
  }
}

// in the order of the Ministry's תשפ״ז schedule: ratio and scale is the first unit of the year (September), percent
// the second (October), the introduction to functions the third (November, before December's rate and slope)
export const GRADE8 = [
  RATIO,
  PCT,
  FUNC,
  LINEAR,
  {
    id: 'pyth', grade: '8', title: 'משפט פיתגורס', color: 'violet',
    desc: 'יתר, ניצב, בדיקת משולש ושאלות מילוליות',
    // The updated ז׳ programme teaches Pythagoras in March (unit 7.14), so Exam Rescue offers it to ז׳ too. It stays
    // filed under ח׳ (unit 8.3, September), where the map and the placement test have it.
    alsoFor: ['7'],
    levels: [
      { title: 'מציאת היתר', gen: () => { const r = Math.random(); return r < 0.3 ? squaresHyp() : r < 0.5 ? estimateRoot() : hypotenuse(); } },
      { title: 'מציאת ניצב', gen: leg },
      { title: 'האם המשולש ישר־זווית?', gen: () => (Math.random() < 0.5 ? whichRight() : howManyRight()) },
      { title: 'שאלה מילולית', gen: ladder },
      { title: 'מרחק בין נקודות', gen: distance },
    ],
    cats: {
      'add-legs': 'חיברו את הצלעות בלי לרבע',
      'no-root': 'שכחו להוציא שורש',
      'add-not-sub': 'חיברו ריבועים במקום לחסר (כשמחפשים ניצב)',
      'subtract-sides': 'חיסרו צלעות בלי לרבע',
      'wrong-hyp': 'בדקו את הצלע שכתובה אחרונה כאילו היא היתר',
      'assume-right': 'קבעו שהמשולש ישר־זווית בלי לבדוק',
    },
  },
  {
    id: 'stats', grade: '8', title: 'סטטיסטיקה', color: 'fuchsia',
    desc: 'שכיח, חציון, ממוצע וטבלת שכיחויות',
    levels: [
      { title: 'שכיח', gen: mode },
      { title: 'חציון', gen: () => (Math.random() < 0.4 ? medianBars() : (median)()) },
      { title: 'ממוצע', gen: () => (Math.random() < 0.5 ? meanBars() : mean()) },
      { title: 'ממוצע מטבלה', gen: freqMean },
      { title: 'נתון חסר', gen: missingValue },
    ],
    cats: {
      'mode-max': 'בחרו את הערך הגדול ביותר במקום השכיח',
      'mode-median': 'בחרו את האמצעי במקום השכיח',
      'mode-count': 'כתבו כמה פעמים הערך מופיע, ולא את הערך',
      unsorted: 'לקחו את האמצעי בלי לסדר קודם',
      'mean-not-median': 'חישבו ממוצע במקום חציון',
      'median-not-mean': 'חישבו חציון במקום ממוצע',
      'no-divide': 'שכחו לחלק במספר הנתונים',
      'ignore-freq': 'התעלמו ממספר התלמידים בכל ציון',
      'wrong-count': 'חילקו במספר השורות ולא במספר התלמידים',
      'mean-as-answer': 'כתבו את הממוצע במקום המספר החסר',
    },
  },
  SYS,
];
