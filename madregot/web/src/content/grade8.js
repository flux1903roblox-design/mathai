// Grade 8 (ח׳): the linear function (linear.js), Pythagoras, statistics, equations and systems (sys.js).
import { R, pick, shuffle, near, TRIPLES, listMath } from './util.js';
import { LINEAR } from './linear.js';
import { SYS } from './sys.js';

// ---------------------------------------------------------------- Pythagoras
const scaled = () => { const [a, b, c] = pick(TRIPLES); return Math.random() < 0.5 ? [a, b, c] : [b, a, c]; };

function hypotenuse() {
  const [a, b, c] = scaled();
  return {
    key: `py1:${a}:${b}`, text: 'במשולש ישר־זווית נתונים שני הניצבים. מה אורך היתר?', form: 'num', answer: c, unit: 'ס״מ',
    fig: { type: 'right', a, b, c: '?' },
    hint: 'במשולש ישר־זווית: $a^2 + b^2 = c^2$, כש־$c$ הוא היתר (מול הזווית הישרה).',
    solution: [`$c^2 = ${a}^2 + ${b}^2 = ${a * a} + ${b * b} = ${c * c}$`, `$c = \\sqrt{${c * c}} = ${c}$`],
    diag: (u) => (near(u, a + b) ? 'add-legs' : near(u, c * c) ? 'no-root' : null),
  };
}

// The theorem by building: change the legs until the square on the hypotenuse has area c².
function squaresHyp() {
  const [a, b, c] = pick([[3, 4, 5], [6, 8, 10], [5, 12, 13], [9, 12, 15], [8, 6, 10], [4, 3, 5]]);
  return {
    key: `py1s:${c}:${a}`, text: `שנו את הניצבים כך שהיתר יהיה $${c}$: הריבוע על היתר צריך שטח $${c * c}$.`, form: 'manip',
    manip: { kind: 'squares', start: { a: 2, b: 2 }, max: 12 }, answer: { c, a, b },
    hint: `במשולש ישר־זווית שטח הריבוע על היתר שווה לסכום שטחי הריבועים על הניצבים: $a^2 + b^2 = c^2$. מחפשים שני ריבועים שיחד הם $${c * c}$.`,
    solution: [`$${a}^2 + ${b}^2 = ${a * a} + ${b * b} = ${c * c} = ${c}^2$`, `לכן ניצבים $${a}$ ו־$${b}$ נותנים יתר $${c}$.`],
    diag: (u) => (u && u.a + u.b === c ? 'add-legs' : null),
  };
}

function leg() {
  const [a, b, c] = scaled();
  return {
    key: `py2:${a}:${c}`, text: 'במשולש ישר־זווית נתונים היתר וניצב אחד. מה אורך הניצב השני?', form: 'num', answer: b, unit: 'ס״מ',
    fig: { type: 'right', a, b: '?', c },
    hint: 'מחפשים ניצב, אז מחסרים: $b^2 = c^2 - a^2$.',
    solution: [`$b^2 = ${c}^2 - ${a}^2 = ${c * c} - ${a * a} = ${b * b}$`, `$b = \\sqrt{${b * b}} = ${b}$`],
    diag: (u) => (near(u, Math.sqrt(a * a + c * c)) || near(u, Math.round(Math.sqrt(a * a + c * c) * 100) / 100) ? 'add-not-sub' : near(u, c - a) ? 'subtract-sides' : near(u, b * b) ? 'no-root' : null),
  };
}

function isRight() {
  const yes = Math.random() < 0.5;
  let [a, b, c] = scaled();
  if (!yes) c += pick(a + b > c + 2 ? [-1, 1, 2] : [-1, 1]); // 3, 4, 7 is not a triangle
  const sides = shuffle([a, b, c]);
  const big = Math.max(...sides); const rest = sides.filter((s, i) => i !== sides.indexOf(big));
  const ok = rest[0] ** 2 + rest[1] ** 2 === big ** 2;
  return {
    key: `py3:${sides.join(':')}`, text: `האם משולש שאורכי צלעותיו ${listMath(sides)} הוא משולש ישר־זווית?`, form: 'mc',
    choices: [{ text: 'כן' }, { text: 'לא' }], answer: ok ? 0 : 1,
    hint: 'בודקים אם סכום ריבועי שתי הצלעות הקצרות שווה לריבוע הצלע הארוכה.',
    solution: [`$${rest[0]}^2 + ${rest[1]}^2 = ${rest[0] ** 2 + rest[1] ** 2}$`, `$${big}^2 = ${big ** 2}$`, ok ? 'שווים, לכן המשולש ישר־זווית.' : 'לא שווים, לכן המשולש אינו ישר־זווית.'],
    diag: () => null,
  };
}

function ladder() {
  const [a, b, c] = pick(TRIPLES.filter((t) => t[2] <= 26));
  const wall = Math.max(a, b); const foot = Math.min(a, b);
  const askHeight = Math.random() < 0.6;
  return {
    key: `py4:${a}:${b}:${askHeight}`,
    text: askHeight
      ? `סולם באורך ${c} דצ״מ נשען על קיר. רגל הסולם נמצאת ${foot} דצ״מ מהקיר. לאיזה גובה על הקיר מגיע הסולם?`
      : `סולם נשען על קיר ומגיע לגובה ${wall} דצ״מ. רגל הסולם נמצאת ${foot} דצ״מ מהקיר. מה אורך הסולם?`,
    form: 'num', answer: askHeight ? wall : c, unit: 'דצ״מ',
    fig: { type: 'ladder', wall: askHeight ? '?' : wall, foot, len: askHeight ? c : '?' },
    hint: 'הקיר, הרצפה והסולם יוצרים משולש ישר־זווית. הסולם הוא היתר.',
    solution: askHeight
      ? [`$h^2 = ${c}^2 - ${foot}^2 = ${c * c - foot * foot}$`, `$h = ${wall}$`]
      : [`$L^2 = ${wall}^2 + ${foot}^2 = ${c * c}$`, `$L = ${c}$`],
    diag: (u) => (askHeight && near(u, Math.round(Math.sqrt(c * c + foot * foot) * 100) / 100) ? 'add-not-sub' : !askHeight && near(u, wall + foot) ? 'add-legs' : null),
  };
}

function distance() {
  const [a, b, c] = pick(TRIPLES.filter((t) => t[1] <= 8));
  const sx = pick([1, -1]); const sy = pick([1, -1]);
  const x1 = R(-3, 0) * sx; const y1 = R(-2, 0) * sy;
  const x2 = x1 + sx * a; const y2 = y1 + sy * b;
  if (Math.abs(x2) > 6 || Math.abs(y2) > 6) return distance();
  return {
    key: `py5:${x1}:${y1}:${x2}:${y2}`, text: `מה המרחק בין $A(${x1}, ${y1})$ ל־$B(${x2}, ${y2})$?`, form: 'num', answer: c, unit: 'יחידות',
    fig: { type: 'coord', range: 6, points: [{ x: x1, y: y1, label: 'A' }, { x: x2, y: y2, label: 'B' }], segments: [[[x1, y1], [x2, y2]]], helper: [[x1, y1], [x2, y1], [x2, y2]] },
    hint: 'משלימים משולש ישר־זווית: הניצבים הם השינוי ב־$x$ והשינוי ב־$y$.',
    solution: [`$\\Delta x = ${a}$, $\\Delta y = ${b}$`, `$d = \\sqrt{${a}^2 + ${b}^2} = \\sqrt{${c * c}} = ${c}$`],
    diag: (u) => (near(u, a + b) ? 'add-legs' : near(u, c * c) ? 'no-root' : null),
  };
}

// ---------------------------------------------------------------- statistics
const sortNum = (arr) => [...arr].sort((x, y) => x - y);
const listTex = (arr) => arr.join(',\\ ');
// A list of numbers in a question: one expression per number inside a left-to-right isolate,
// so it keeps its order in a Hebrew line and a narrow screen can wrap it between numbers.

function mode() {
  for (;;) {
    const n = R(7, 9); const m = R(2, 12);
    const arr = [m, m, m];
    while (arr.length < n) { const v = R(1, 15); if (arr.filter((x) => x === v).length < 2 && v !== m) arr.push(v); }
    const counts = {}; arr.forEach((v) => { counts[v] = (counts[v] || 0) + 1; });
    if (Object.values(counts).filter((c) => c >= 3).length !== 1) continue;
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

export const GRADE8 = [
  LINEAR,
  {
    id: 'pyth', grade: '8', title: 'משפט פיתגורס', color: 'violet',
    desc: 'יתר, ניצב, בדיקת משולש ושאלות מילוליות',
    levels: [
      { title: 'מציאת היתר', gen: () => (Math.random() < 0.4 ? squaresHyp() : hypotenuse()) },
      { title: 'מציאת ניצב', gen: leg },
      { title: 'האם המשולש ישר־זווית?', gen: isRight },
      { title: 'שאלה מילולית', gen: ladder },
      { title: 'מרחק בין נקודות', gen: distance },
    ],
    cats: {
      'add-legs': 'חיברו את הצלעות בלי לרבע',
      'no-root': 'שכחו להוציא שורש',
      'add-not-sub': 'חיברו ריבועים במקום לחסר (כשמחפשים ניצב)',
      'subtract-sides': 'חיסרו צלעות בלי לרבע',
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
