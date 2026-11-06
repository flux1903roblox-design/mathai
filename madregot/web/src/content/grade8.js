// Grade 8 (ח׳): slope and the equation of a line, Pythagoras, statistics.
import { R, NZ, pick, shuffle, T, ratioTex, reduce, near, TRIPLES } from './util.js';

const lineTex = (m, b) => {
  const mt = m === 1 ? '' : m === -1 ? '-' : ratioTex(Math.round(m * 1e6), 1e6);
  const bt = b === 0 ? '' : b > 0 ? ` + ${T(b)}` : ` - ${T(-b)}`;
  return `y = ${m === 0 ? '' : `${mt}x`}${m === 0 ? T(b) : bt}`;
};
const mFrac = (dy, dx) => ratioTex(dy, dx);

// ---------------------------------------------------------------- slope & line
function slopeTwoPoints() {
  for (;;) {
    const x1 = R(-5, 4); const x2 = R(-5, 5); const y1 = R(-5, 5); const y2 = R(-5, 5);
    if (x1 === x2 || y1 === y2) continue;
    const dy = y2 - y1; const dx = x2 - x1; const m = dy / dx;
    const [p, q] = reduce(dy, dx);
    if (Math.abs(q) > 6) continue;
    return {
      key: `ln1:${x1}:${y1}:${x2}:${y2}`, text: `מה השיפוע של הישר שעובר דרך $A(${x1}, ${y1})$ ו־$B(${x2}, ${y2})$?`,
      form: 'num', answer: m, label: 'm =',
      fig: { type: 'coord', range: 6, points: [{ x: x1, y: y1, label: 'A' }, { x: x2, y: y2, label: 'B' }], line: { m, b: y1 - m * x1 } },
      hint: 'שיפוע = השינוי ב־$y$ חלקי השינוי ב־$x$: $m = \\frac{y_2 - y_1}{x_2 - x_1}$. אפשר לכתוב שבר, למשל 3/4.',
      solution: [`$m = \\frac{${T(y2)} - ${T(y1, true)}}{${T(x2)} - ${T(x1, true)}} = \\frac{${dy}}{${dx}}$`, `$m = ${ratioTex(p, q)}$`],
      diag: (u) => {
        if (near(u, dx / dy) && !near(m, dx / dy)) return 'inverse';
        if (near(u, -m)) return 'sign';
        return null;
      },
    };
  }
}

function readEquation() {
  const m = NZ(-5, 5); const b = NZ(-8, 8); const askM = Math.random() < 0.5;
  const style = R(0, 2);
  const eq = style === 0 ? lineTex(m, b) : style === 1 ? `y = ${T(b)} ${m < 0 ? '-' : '+'} ${Math.abs(m) === 1 ? '' : Math.abs(m)}x` : lineTex(m, b);
  const ans = askM ? m : b;
  return {
    key: `ln2:${m}:${b}:${askM}:${style}`, text: `נתון הישר $${eq}$. ${askM ? 'מה השיפוע שלו?' : 'באיזו נקודה על ציר $y$ הוא חותך? כתבו את ערך $y$.'}`,
    form: 'num', answer: ans, label: askM ? 'm =' : 'b =',
    hint: 'בצורה $y = mx + b$: המספר שכופל את $x$ הוא השיפוע $m$, והמספר הבודד הוא $b$, נקודת החיתוך עם ציר $y$.',
    solution: [`$m = ${T(m)}$, $b = ${T(b)}$`, askM ? `השיפוע: $${T(m)}$` : `החיתוך עם ציר $y$: $(0, ${b})$`],
    diag: (u) => (near(u, askM ? b : m) && m !== b ? 'm-b' : near(u, -ans) ? 'sign' : null),
  };
}

function slopePoint() {
  const m = NZ(-4, 4); const x0 = NZ(-4, 4); const y0 = R(-6, 6); const b = y0 - m * x0;
  return {
    key: `ln3:${m}:${x0}:${y0}`, text: `מצאו את משוואת הישר שהשיפוע שלו $${T(m)}$ והוא עובר דרך הנקודה $P(${x0}, ${y0})$.`,
    form: 'line', answer: { m, b },
    hint: 'מציבים את הנקודה ב־$y = mx + b$ ומוצאים את $b$.',
    solution: [`$${y0} = ${T(m)} \\cdot ${T(x0, true)} + b$`, `$${y0} = ${m * x0} + b \\Rightarrow b = ${b}$`, `$${lineTex(m, b)}$`],
    diag: (v) => (v && near(v.m, m) && near(v.b, -b) && b !== 0 ? 'b-sign' : v && near(v.m, m) && near(v.b, y0) ? 'b-is-y' : null),
  };
}

function twoPoints() {
  for (;;) {
    const m = NZ(-3, 3); const x1 = R(-4, 3); const x2 = x1 + R(1, 3); const b = R(-5, 5);
    const y1 = m * x1 + b; const y2 = m * x2 + b;
    if (Math.abs(y1) > 9 || Math.abs(y2) > 9) continue;
    return {
      key: `ln4:${x1}:${y1}:${x2}:${y2}`, text: `מצאו את משוואת הישר שעובר דרך $A(${x1}, ${y1})$ ו־$B(${x2}, ${y2})$.`,
      form: 'line', answer: { m, b },
      hint: 'שני שלבים: קודם השיפוע מהשינויים, אחר כך מציבים נקודה אחת ומוצאים את $b$.',
      solution: [`$m = \\frac{${y2} - ${T(y1, true)}}{${x2} - ${T(x1, true)}} = ${T(m)}$`, `$${y1} = ${T(m)} \\cdot ${T(x1, true)} + b \\Rightarrow b = ${b}$`, `$${lineTex(m, b)}$`],
      diag: (v) => (v && near(v.m, 1 / m) && Math.abs(m) !== 1 ? 'inverse' : v && near(v.m, -m) ? 'sign' : null),
    };
  }
}

function parallelThrough() {
  const m = NZ(-4, 4); const c = NZ(-6, 6); const x0 = NZ(-4, 4); const y0 = R(-6, 6); const b = y0 - m * x0;
  if (b === c) return parallelThrough(); // P on the given line would make it the same line
  return {
    key: `ln5:${m}:${c}:${x0}:${y0}`, text: `מצאו את משוואת הישר שמקביל ל־$${lineTex(m, c)}$ ועובר דרך $P(${x0}, ${y0})$.`,
    form: 'line', answer: { m, b },
    hint: 'ישרים מקבילים הם בעלי אותו שיפוע. השיפוע ידוע, נשאר למצוא את $b$.',
    solution: [`השיפוע זהה: $m = ${T(m)}$`, `$${y0} = ${T(m)} \\cdot ${T(x0, true)} + b \\Rightarrow b = ${b}$`, `$${lineTex(m, b)}$`],
    diag: (v) => (v && near(v.m, -1 / m) ? 'perpendicular' : v && near(v.m, m) && near(v.b, c) ? 'same-line' : null),
  };
}

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
  if (!yes) c += pick([-1, 1, 2]);
  const sides = shuffle([a, b, c]);
  const big = Math.max(...sides); const rest = sides.filter((s, i) => i !== sides.indexOf(big));
  const ok = rest[0] ** 2 + rest[1] ** 2 === big ** 2;
  return {
    key: `py3:${sides.join(':')}`, text: `האם משולש שאורכי צלעותיו $${sides.join(',\\ ')}$ הוא משולש ישר־זווית?`, form: 'mc',
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
      key: `st1:${list.join(',')}`, text: `מה השכיח של הנתונים $${listTex(list)}$?`, form: 'num', answer: m,
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
      key: `st2:${list.join(',')}`, text: `מה החציון של הנתונים $${listTex(list)}$?`, form: 'num', answer: med,
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
      key: `st3:${arr.join(',')}`, text: `מה הממוצע של הנתונים $${listTex(arr)}$?`, form: 'num', answer: avg,
      hint: 'מחברים את כל הנתונים ומחלקים במספר הנתונים.',
      solution: [`סכום: $${arr.join(' + ')} = ${sum}$`, `$${sum} : ${n} = ${avg}$`],
      diag: (u) => (near(u, med) ? 'median-not-mean' : near(u, sum) ? 'no-divide' : null),
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
      key: `st5:${known.join(',')}:${avg}`, text: `הממוצע של ${n} מספרים הוא $${avg}$. ${n - 1} מהם הם $${listTex(known)}$. מה המספר החסר?`,
      form: 'num', answer: x,
      hint: 'ממוצע כפול מספר הנתונים נותן את הסכום של כולם. מה חסר כדי להגיע לסכום הזה?',
      solution: [`סכום כולם: $${avg} \\cdot ${n} = ${avg * n}$`, `סכום הידועים: $${known.reduce((a, b) => a + b, 0)}$`, `החסר: $${avg * n} - ${known.reduce((a, b) => a + b, 0)} = ${x}$`],
      diag: (u) => (near(u, avg) ? 'mean-as-answer' : null),
    };
  }
}

export const GRADE8 = [
  {
    id: 'line', grade: '8', title: 'שיפוע ומשוואת ישר', color: 'green',
    desc: 'שיפוע, משוואה לפי נקודה, שתי נקודות וישר מקביל',
    levels: [
      { title: 'שיפוע בין שתי נקודות', gen: slopeTwoPoints },
      { title: 'קריאת משוואה', gen: readEquation },
      { title: 'משוואה לפי שיפוע ונקודה', gen: slopePoint },
      { title: 'משוואה לפי שתי נקודות', gen: twoPoints },
      { title: 'ישר מקביל', gen: parallelThrough },
    ],
    cats: {
      inverse: 'חילקו את השינוי ב־$x$ בשינוי ב־$y$ (הפוך)',
      sign: 'טעות בסימן של השיפוע',
      'm-b': 'התבלבלו בין השיפוע לנקודת החיתוך',
      'b-sign': 'טעות בסימן של $b$',
      'b-is-y': 'הציבו את $y$ של הנקודה בתור $b$',
      perpendicular: 'בחרו שיפוע של ישר מאונך, לא מקביל',
      'same-line': 'כתבו את הישר הנתון עצמו',
    },
  },
  {
    id: 'pyth', grade: '8', title: 'משפט פיתגורס', color: 'violet',
    desc: 'יתר, ניצב, בדיקת משולש ושאלות מילוליות',
    levels: [
      { title: 'מציאת היתר', gen: hypotenuse },
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
    id: 'stats', grade: '8', title: 'סטטיסטיקה', color: 'ochre',
    desc: 'שכיח, חציון, ממוצע וטבלת שכיחויות',
    levels: [
      { title: 'שכיח', gen: mode },
      { title: 'חציון', gen: median },
      { title: 'ממוצע', gen: mean },
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
];
