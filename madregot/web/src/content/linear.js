// Grade 8 (ח׳): the linear function, in the order the class learned it
// (the whiteboard lessons the user shared): table of values, the meaning of
// m and b, slope as "steps" on the graph, slope between two points, the line
// through two points, meeting the axes, the triangle with the axes, and the
// point where two lines meet.
import { R, NZ, pick, T, ratioTex, reduce, near, plainNum } from './util.js';

export const lineTex = (m, b, name = 'y') => {
  const mt = m === 1 ? '' : m === -1 ? '-' : ratioTex(Math.round(m * 1e6), 1e6);
  const bt = b === 0 ? '' : b > 0 ? ` + ${T(b)}` : ` - ${T(-b)}`;
  return `${name} = ${m === 0 ? T(b) : `${mt}x${bt}`}`;
};
const half = (v) => Math.round(v * 2) / 2 === v;

// 1. table of values: y = mx + b, find y for a given x (the board: y = 2x + 1, x = -2, 0, 1, 2)
function table() {
  const m = NZ(-4, 4); const b = R(-6, 6);
  const xs = [-2, -1, 0, 1, 2, 3].sort(() => Math.random() - 0.5).slice(0, 4).sort((p, q) => p - q);
  const ask = pick(xs);
  const rows = xs.map((x) => [x, x === ask ? '?' : m * x + b]);
  const y = m * ask + b;
  return {
    key: `lf1:${m}:${b}:${ask}`, text: `השלימו את טבלת הערכים של $${lineTex(m, b)}$. מה הערך של $y$ כש־$x = ${T(ask)}$?`,
    form: 'num', answer: y, label: 'y =',
    fig: { type: 'table', head: ['x', 'y'], rows },
    hint: `מציבים את $x$ במשוואה, במקום $x$: $y = ${T(m)} \\cdot ${T(ask, true)} ${b < 0 ? '-' : '+'} ${Math.abs(b)}$. כפל לפני חיבור.`,
    solution: [`$y = ${T(m)} \\cdot ${T(ask, true)} ${b < 0 ? '-' : '+'} ${Math.abs(b)}$`, `$y = ${T(m * ask)} ${b < 0 ? '-' : '+'} ${Math.abs(b)} = ${T(y)}$`],
    diag: (u) => (near(u, m * ask) && b !== 0 ? 'forgot-b' : near(u, m * Math.abs(ask) + b) && ask < 0 ? 'neg-sub' : near(u, m + ask + b) ? 'added-m' : null),
  };
}

// 2. reading the equation: m is the number before x, b is where it meets the y-axis, the sign of m
function meaning() {
  const kind = pick(['m', 'b', 'dir', 'dir']);
  const m = kind === 'dir' && Math.random() < 0.15 ? 0 : NZ(-5, 5); const b = NZ(-8, 8);
  const written = Math.random() < 0.35 && m !== 0 ? `y = ${T(b)} ${m < 0 ? '-' : '+'} ${Math.abs(m) === 1 ? '' : Math.abs(m)}x` : lineTex(m, b);
  if (kind === 'dir') {
    const ans = m > 0 ? 0 : m < 0 ? 1 : 2;
    return {
      key: `lf2:dir:${m}:${b}`, text: `הפונקציה $${written}$ היא:`, form: 'mc',
      choices: [{ text: 'עולה' }, { text: 'יורדת' }, { text: 'קבועה' }], answer: ans,
      hint: 'מסתכלים רק על $m$, המספר שלפני $x$: חיובי זה עולה, שלילי זה יורד, ואפס זה קו אופקי.',
      solution: [`$m = ${T(m)}$`, ans === 0 ? 'השיפוע חיובי, לכן הפונקציה עולה.' : ans === 1 ? 'השיפוע שלילי, לכן הפונקציה יורדת.' : 'השיפוע אפס, לכן הפונקציה קבועה (קו אופקי).'],
      diag: (u) => (ans !== 2 && u !== 2 && u !== ans && Math.sign(b) !== Math.sign(m) ? 'sign-from-b' : null),
    };
  }
  const ans = kind === 'm' ? m : b;
  return {
    key: `lf2:${kind}:${m}:${b}:${written}`, text: `נתונה הפונקציה $${written}$. ${kind === 'm' ? 'מה השיפוע $m$?' : 'מה $b$? (הנקודה שבה הגרף חותך את ציר $y$ היא $(0, b)$)'}`,
    form: 'num', answer: ans, label: kind === 'm' ? 'm =' : 'b =',
    hint: '$m$ הוא המקדם, המספר שלפני $x$ (כולל הסימן שלו). $b$ הוא המספר החופשי, גם הוא עם הסימן.',
    solution: [`$m = ${T(m)}$, $b = ${T(b)}$`, kind === 'b' ? `החיתוך עם ציר $y$: $(0, ${b})$` : `השיפוע: $${T(m)}$`],
    diag: (u) => (near(u, kind === 'm' ? b : m) && m !== b ? 'm-b' : near(u, -ans) ? 'sign' : null),
  };
}

// 3. slope from the graph: one step right, how many steps up or down ("כל מדרגה עולה ב־2")
function stepsFromGraph() {
  for (;;) {
    const frac = Math.random() < 0.25;
    const run = frac ? 2 : 1; const rise = frac ? pick([-1, 1, -3, 3]) : NZ(-3, 3);
    const m = rise / run; const x1 = R(-4, 0); const y1 = R(-4, 3);
    const x2 = x1 + 2 * run; const y2 = y1 + 2 * rise;
    if (Math.abs(y2) > 6 || Math.abs(x2) > 6) continue;
    const b = y1 - m * x1;
    return {
      key: `lf3:${x1}:${y1}:${rise}:${run}`, text: 'מה השיפוע של הישר? בדקו כמה עולים או יורדים כשזזים ימינה.',
      form: 'num', answer: m, label: 'm =',
      fig: { type: 'coord', range: 6, line: { m, b }, points: [{ x: x1, y: y1, label: 'A' }, { x: x2, y: y2, label: 'B' }] },
      hint: frac
        ? 'כאן "המדרגה" לא נגמרת אחרי צעד אחד: בדקו כמה עולים אחרי שני צעדים ימינה, וחלקו ב־2.'
        : 'מתחילים בנקודה $A$, זזים צעד אחד ימינה, וסופרים כמה משבצות צריך לעלות (או לרדת) כדי לחזור לישר.',
      solution: [`מ־$A$ ל־$B$: ימינה $${2 * run}$, ${rise > 0 ? 'למעלה' : 'למטה'} $${2 * Math.abs(rise)}$`, `$m = \\frac{${2 * rise}}{${2 * run}} = ${ratioTex(rise, run)}$`],
      diag: (u) => (near(u, run / rise) && !near(m, run / rise) ? 'inverse' : near(u, -m) ? 'sign' : null),
    };
  }
}

// 4. slope between two points, keeping one order on top and bottom
function slopeTwoPoints() {
  for (;;) {
    const x1 = R(-6, 4); const x2 = R(-5, 6); const y1 = R(-7, 7); const y2 = R(-7, 12);
    if (x1 === x2 || y1 === y2) continue;
    const dy = y2 - y1; const dx = x2 - x1; const m = dy / dx;
    const [p, q] = reduce(dy, dx);
    if (Math.abs(q) > 6) continue;
    return {
      key: `lf4:${x1}:${y1}:${x2}:${y2}`, text: `מה השיפוע של הישר שעובר דרך הנקודות $(${x1}, ${y1})$ ו־$(${x2}, ${y2})$?`,
      form: 'num', answer: m, label: 'm =',
      hint: '$m = \\frac{y_2 - y_1}{x_2 - x_1}$. אסור לערבב את הסדר: הנקודה שמתחילים ממנה למעלה היא גם זו שמתחילים ממנה למטה. מספר שלילי כותבים בסוגריים.',
      solution: [`$m = \\frac{${T(y2)} - ${T(y1, true)}}{${T(x2)} - ${T(x1, true)}} = \\frac{${dy}}{${dx}}$`, `$m = ${ratioTex(p, q)}$`],
      diag: (u) => {
        if (near(u, dx / dy) && !near(m, dx / dy)) return 'inverse';
        if (near(u, -m)) return 'mixed-order';
        return null;
      },
    };
  }
}

// 5. the line through two points (or a point and a slope): first m, then b, then write it
function lineEquation() {
  for (;;) {
    const m = NZ(-3, 3); const b = R(-6, 6); const x1 = R(-4, 3); const x2 = x1 + R(1, 4);
    const y1 = m * x1 + b; const y2 = m * x2 + b;
    if (Math.abs(y1) > 12 || Math.abs(y2) > 12) continue;
    const withSlope = Math.random() < 0.35;
    return {
      key: `lf5:${withSlope}:${x1}:${y1}:${x2}:${y2}`,
      text: withSlope ? `מצאו את משוואת הישר שהשיפוע שלו $${T(m)}$ והוא עובר דרך $(${x1}, ${y1})$.` : `מצאו את משוואת הישר שעובר דרך $(${x1}, ${y1})$ ו־$(${x2}, ${y2})$.`,
      form: 'line', answer: { m, b },
      hint: withSlope ? 'מציבים את הנקודה ב־$y = mx + b$: במקום $x$ ובמקום $y$, ומוצאים את $b$.' : 'שלב 1: מוצאים את $m$ משתי הנקודות. שלב 2: מציבים נקודה אחת ב־$y = mx + b$ ומוצאים את $b$.',
      solution: [
        ...(withSlope ? [] : [`$m = \\frac{${y2} - ${T(y1, true)}}{${x2} - ${T(x1, true)}} = ${T(m)}$`]),
        `$${y1} = ${T(m)} \\cdot ${T(x1, true)} + b$`, `$${y1} = ${T(m * x1)} + b \\Rightarrow b = ${T(b)}$`, `$${lineTex(m, b)}$`],
      diag: (v) => (v && near(v.m, m) && near(v.b, -b) && b !== 0 ? 'b-sign' : v && near(v.m, m) && near(v.b, y1) && y1 !== b ? 'b-is-y' : v && near(v.m, -m) ? 'sign' : null),
    };
  }
}

// 2b. m and b by building: drag the point on the y-axis to b, the step point one to the right to b + m.
// Prediction: the line is drawn with its equation; the student puts the line's point at a given x.
function predictPoint() {
  let m; let b; let x0; let y0;
  do { m = NZ(-2, 2); b = R(-3, 3); x0 = NZ(-3, 3); y0 = m * x0 + b; } while (Math.abs(y0) > 6);
  return {
    key: `lf1p:${m}:${b}:${x0}`, text: `על הישר $${lineTex(m, b)}$ שימו את הנקודה שבה $x = ${T(x0)}$.`, form: 'manip',
    manip: { kind: 'plot', range: 6, label: 'P', start: null, line: { m, b } }, answer: [x0, y0],
    hint: 'מציבים את $x$ במשוואה ומחשבים את $y$. אפשר גם ללכת על הישר עד $x$ המבוקש.',
    solution: [`$y = ${m} \\cdot (${T(x0)}) ${b < 0 ? '-' : '+'} ${Math.abs(b)} = ${T(y0)}$`, `הנקודה $(${T(x0)}, ${T(y0)})$`],
    diag: (u) => (u && u[0] === x0 && u[1] === m * x0 ? 'forgot-b' : null),
  };
}

function buildLine() {
  let m; let b; do { m = NZ(-3, 3); b = R(-4, 4); } while (Math.abs(m + b) > 6 || (m === 1 && b === 0));
  return {
    key: `lf2b:${m}:${b}`, text: `בנו את הישר $${lineTex(m, b)}$: גררו את שתי הנקודות.`, form: 'manip',
    manip: { kind: 'line', range: 6, start: { m: 1, b: 0 } }, answer: { m, b },
    hint: '$b$ הוא המקום שבו הישר חותך את ציר $y$. השיפוע $m$: צעד אחד ימינה, ו־$m$ צעדים למעלה (או למטה כשהוא שלילי).',
    solution: [`חיתוך עם ציר $y$: $b = ${b}$, הנקודה $(0, ${b})$.`, `שיפוע $m = ${m}$: מ־$(0, ${b})$ צעד אחד ימינה ו־$${Math.abs(m)}$ ${m > 0 ? 'למעלה' : 'למטה'}, אל $(1, ${m + b})$.`],
    diag: (u) => (u && u.m === b && u.b === m && m !== b ? 'm-b' : u && u.m === -m && u.b === b ? 'sign' : null),
  };
}

// 6. where the graph meets the axes: x = 0 for the y-axis, y = 0 (f(x) = 0) for the x-axis
function axes() {
  for (;;) {
    const m = NZ(-8, 8); const b = NZ(-20, 20); const x0 = -b / m;
    if (!half(x0) || Math.abs(x0) > 12) continue;
    const name = pick(['f', 'g', 'h']);
    const onX = Math.random() < 0.65;
    const ans = onX ? [x0, 0] : [0, b];
    return {
      key: `lf6:${m}:${b}:${onX}`, text: `נתונה הפונקציה $${lineTex(m, b, `${name}(x)`)}$. מצאו את נקודת החיתוך ${onX ? '$B$' : '$A$'} של הגרף עם ציר ${onX ? '$x$' : '$y$'}.`,
      form: 'pt', answer: ans, label: onX ? 'B' : 'A',
      hint: onX ? `על ציר $x$ מתקיים $y = 0$: פותרים $0 = ${lineTex(m, b, '').replace(/^ = /, '')}$.` : `על ציר $y$ מתקיים $x = 0$: מחשבים $${name}(0)$.`,
      solution: onX
        ? [`$0 = ${T(m)}x ${b < 0 ? '-' : '+'} ${Math.abs(b)}$`, `$${T(m)}x = ${T(-b)}$`, `$x = \\frac{${T(-b)}}{${T(m)}} = ${plainNum(x0)}$`, `הנקודה: $(${plainNum(x0)}, 0)$`]
        : [`$${name}(0) = ${T(m)} \\cdot 0 ${b < 0 ? '-' : '+'} ${Math.abs(b)} = ${T(b)}$`, `הנקודה: $(0, ${b})$`],
      diag: ([u, v]) => {
        if (near(u, ans[1]) && near(v, ans[0]) && ans[0] !== ans[1]) return 'swap';
        if (onX && near(u, -x0) && near(v, 0)) return 'sign';
        if (onX && near(u, 0) && near(v, b)) return 'axes-mixed';
        if (!onX && near(u, x0) && near(v, 0)) return 'axes-mixed';
        return null;
      },
    };
  }
}

// 7. the triangle the line makes with the axes (the board: y = -2x + 6, area 9)
function triangle() {
  for (;;) {
    const m = NZ(-4, 4); const b = NZ(-6, 6); const x0 = -b / m;
    if (!Number.isInteger(x0) || Math.abs(x0) > 6 || x0 === 0) continue;
    const area = Math.abs(b * x0) / 2;
    return {
      key: `lf7:${m}:${b}`, text: `הישר $${lineTex(m, b)}$ יוצר משולש עם הצירים. מה שטח המשולש?`,
      form: 'num', answer: area, unit: 'יחידות ריבועיות',
      fig: { type: 'coord', range: 6, line: { m, b }, polygon: [[0, 0], [x0, 0], [0, b]], points: [{ x: 0, y: b, label: 'A' }, { x: x0, y: 0, label: 'B' }] },
      hint: 'מוצאים את שתי נקודות החיתוך עם הצירים. הצלעות של המשולש הן המרחקים שלהן מהראשית, והשטח הוא מכפלתן חלקי 2.',
      solution: [`חיתוך עם ציר $y$: $A(0, ${b})$`, `חיתוך עם ציר $x$: $0 = ${lineTex(m, b, '').replace(/^ = /, '')} \\Rightarrow B(${x0}, 0)$`, `שטח: $\\frac{${Math.abs(b)} \\cdot ${Math.abs(x0)}}{2} = ${plainNum(area)}$`],
      diag: (u) => (near(u, 2 * area) ? 'no-half' : near(u, Math.abs(b) + Math.abs(x0)) ? 'added-sides' : null),
    };
  }
}

// 8. the point where two lines meet: y = y (the board: y = 3x - 2, y = -2x + 8, E(2, 4))
function meet() {
  for (;;) {
    const m1 = NZ(-4, 4); let m2 = NZ(-4, 4); if (m1 === m2) continue;
    const x = R(-4, 4); const y = R(-6, 6);
    const b1 = y - m1 * x; const b2 = y - m2 * x;
    if (Math.abs(b1) > 12 || Math.abs(b2) > 12) continue;
    return {
      key: `lf8:${m1}:${b1}:${m2}:${b2}`, text: `מצאו את נקודת המפגש $E$ של הישרים $${lineTex(m1, b1)}$ ו־$${lineTex(m2, b2)}$.`,
      form: 'pt', answer: [x, y], label: 'E',
      hint: 'בנקודת המפגש ה־$y$ של שני הישרים שווה: משווים $y = y$, מוצאים את $x$, ואז מציבים כדי למצוא את $y$.',
      solution: [
        `$${lineTex(m1, b1, '').replace(/^ = /, '')} = ${lineTex(m2, b2, '').replace(/^ = /, '')}$`,
        `$${T(m1 - m2)}x = ${T(b2 - b1)} \\Rightarrow x = ${T(x)}$`,
        `$y = ${T(m1)} \\cdot ${T(x, true)} ${b1 < 0 ? '-' : '+'} ${Math.abs(b1)} = ${T(y)}$`, `הנקודה: $E(${x}, ${y})$`],
      diag: ([u, v]) => (near(u, y) && near(v, x) && x !== y ? 'swap' : near(u, x) && !near(v, y) ? 'forgot-y' : null),
    };
  }
}

export const LINEAR = {
  id: 'line', grade: '8', title: 'פונקציה קווית', color: 'cobalt',
  desc: 'טבלת ערכים, שיפוע, משוואת ישר, חיתוך עם הצירים ונקודת מפגש',
  levels: [
    { title: 'טבלת ערכים', gen: () => (Math.random() < 0.4 ? predictPoint() : (table)()) },
    { title: 'מה אומרים m ו־b', gen: () => (Math.random() < 0.5 ? buildLine() : meaning()) },
    { title: 'שיפוע מהגרף: מדרגות', gen: stepsFromGraph },
    { title: 'שיפוע בין שתי נקודות', gen: slopeTwoPoints },
    { title: 'משוואת ישר', gen: lineEquation },
    { title: 'חיתוך עם הצירים', gen: axes },
    { title: 'משולש עם הצירים', gen: triangle },
    { title: 'נקודת מפגש של שני ישרים', gen: meet },
  ],
  cats: {
    'forgot-b': 'שכחו להוסיף את $b$',
    'neg-sub': 'הציבו $x$ שלילי בלי הסוגריים',
    'added-m': 'חיברו את $m$ ואת $x$ במקום לכפול',
    'm-b': 'התבלבלו בין $m$ ל־$b$',
    sign: 'טעות בסימן',
    'sign-from-b': 'קבעו עולה או יורדת לפי $b$ ולא לפי $m$',
    inverse: 'חילקו את הצעדים ימינה בצעדים למעלה (הפוך)',
    'mixed-order': 'ערבבו את סדר הנקודות בין המונה למכנה',
    'b-sign': 'טעות בסימן של $b$',
    'b-is-y': 'כתבו את ה־$y$ של הנקודה בתור $b$',
    swap: 'החליפו בין $x$ ל־$y$ בנקודה',
    'axes-mixed': 'התבלבלו בין ציר $x$ לציר $y$ (מציבים $y = 0$ לציר $x$)',
    'no-half': 'שכחו לחלק ב־2 בשטח המשולש',
    'added-sides': 'חיברו את הצלעות במקום לכפול',
    'forgot-y': 'מצאו את $x$ אבל לא הציבו כדי למצוא את $y$',
  },
  lesson: {
    points: [
      'פונקציה קווית היא פונקציה שהגרף שלה קו ישר. כותבים אותה כך: $y = mx + b$.',
      '$b$ הוא המספר החופשי (עם הסימן): הישר חותך את ציר $y$ בנקודה $(0, b)$.',
      '$m$ הוא השיפוע, המספר שלפני $x$. הוא קצב השינוי: כמה עולים או יורדים כשזזים צעד אחד ימינה בציר $x$.',
      '$m > 0$: הפונקציה עולה. $m < 0$: היא יורדת. ככל ש־$m$ גדול יותר, עולים מהר יותר.',
      'שיפוע בין שתי נקודות: $m = \\frac{y_2 - y_1}{x_2 - x_1}$. אסור לערבב את הסדר בין המונה למכנה.',
      'משוואת ישר בשני שלבים: מוצאים את $m$, מציבים נקודה ב־$y = mx + b$ כדי למצוא את $b$, וכותבים את המשוואה.',
      'חיתוך עם ציר $y$: מציבים $x = 0$. חיתוך עם ציר $x$: מציבים $y = 0$ ופותרים.',
      'נקודת מפגש של שני ישרים: משווים $y = y$, פותרים את $x$, ומציבים כדי למצוא את $y$.',
    ],
    examples: [
      '$y = 2x + 1$: כש־$x = -2$ מקבלים $y = 2 \\cdot (-2) + 1 = -3$.',
      'הנקודות $(1, 2)$ ו־$(4, 11)$: $m = \\frac{11 - 2}{4 - 1} = \\frac{9}{3} = 3$, וגם $\\frac{2 - 11}{1 - 4} = \\frac{-9}{-3} = 3$.',
      'הנקודות $(1, 3)$ ו־$(4, 6)$: $m = 1$, ואז $3 = 1 \\cdot 1 + b$, לכן $b = 2$ ו־$y = x + 2$.',
      '$y = -2x + 6$ חותך את הצירים ב־$(0, 6)$ וב־$(3, 0)$, ושטח המשולש $\\frac{6 \\cdot 3}{2} = 9$.',
      '$g(x) = 20 - 8x$: $0 = 20 - 8x$, לכן $x = 2.5$ והנקודה $(2.5, 0)$.',
      '$y = 3x - 2$ ו־$y = -2x + 8$: $3x - 2 = -2x + 8$, לכן $x = 2$, $y = 4$ והנקודה $E(2, 4)$.',
    ],
    explore: 'line',
  },
};
