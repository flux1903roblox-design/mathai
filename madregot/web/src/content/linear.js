// Grade 8 (ח׳): the linear function, in the order the class learned it
// (the whiteboard lessons the user shared): table of values, the meaning of
// m and b, slope as "steps" on the graph, slope between two points, the line
// through two points, meeting the axes, the triangle with the axes, and the
// point where two lines meet.
import { R, NZ, pick, shuffle, T, ratioTex, reduce, near, plainNum, byWidth, drawPlace } from './util.js';

export const lineTex = (m, b, name = 'y') => {
  const mt = m === 1 ? '' : m === -1 ? '-' : ratioTex(Math.round(m * 1e6), 1e6);
  const bt = b === 0 ? '' : b > 0 ? ` + ${T(b)}` : ` - ${T(-b)}`;
  return `${name} = ${m === 0 ? T(b) : `${mt}x${bt}`}`;
};
const half = (v) => Math.round(v * 2) / 2 === v;
/** k·x as a textbook writes it: x, -x, 3x (never 1x). */
const kx = (k) => (k === 1 ? 'x' : k === -1 ? '-x' : `${T(k)}x`);
/** "+ 4", "- 4", or nothing for 0. */
const plusB = (b) => (b === 0 ? '' : ` ${b < 0 ? '-' : '+'} ${Math.abs(b)}`);

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
    hint: `מציבים את $x$ במשוואה, במקום $x$: $y = ${T(m)} \\cdot ${T(ask, true)}${plusB(b)}$. כפל לפני חיבור.`,
    solution: [`$y = ${T(m)} \\cdot ${T(ask, true)}${plusB(b)}$`, b === 0 ? `$y = ${T(y)}$` : `$y = ${T(m * ask)}${plusB(b)} = ${T(y)}$`],
    // every mistake that gives this number (several: an ambiguous answer, content/index.js makeItem)
    diag: (u) => [near(u, m * ask) && b !== 0 && 'forgot-b', near(u, m * Math.abs(ask) + b) && ask < 0 && 'neg-sub', near(u, m + ask + b) && 'added-m'].filter(Boolean),
  };
}

/**
 * 1b. Is the point on the line? (the teacher's "האם נקודה נמצאת על הישר?"): its x substituted gives its y, or not. A
 * yes-or-no choice, practice only (a guesser is right half the time: content/index.js fairForCheck). Some points are
 * on the line only read the other way round, their y substituted for x (swap-xy), or only with b left out (forgot-b):
 * "כן" for such a point names that mistake (key lf1o:m:b:p:q).
 */
function onLineAsk() {
  for (;;) {
    const m = NZ(-4, 4); const b = NZ(-6, 6);
    const kind = pick(['on', 'on', 'swap', 'nob', 'off']);
    let p; let q;
    if (kind === 'swap') { q = NZ(-4, 4); p = m * q + b; } else {
      p = NZ(-4, 4);
      q = kind === 'on' ? m * p + b : kind === 'nob' ? m * p : m * p + b + pick([-2, -1, 1, 2]);
    }
    if (Math.abs(p) > 9 || Math.abs(q) > 14) continue;
    const y = m * p + b; const on = q === y;
    const swapOn = !on && p === m * q + b; const nobOn = !on && q === m * p;
    // each point is what it was drawn to be, and a wrong "כן" has at most one reading
    if ((kind === 'on') !== on || (kind === 'swap' && !swapOn) || (kind === 'nob' && !nobOn) || (swapOn && nobOn)) continue;
    return {
      key: `lf1o:${m}:${b}:${p}:${q}`, text: `האם הנקודה $(${p}, ${q})$ נמצאת על הישר $${lineTex(m, b)}$?`, form: 'mc',
      choices: [{ text: 'כן' }, { text: 'לא' }], answer: on ? 0 : 1, practiceOnly: true,
      hint: 'מציבים במשוואה את שיעור ה־$x$ של הנקודה. אם יוצא שיעור ה־$y$ שלה, הנקודה על הישר. אם יוצא מספר אחר, היא לא עליו.',
      solution: [
        `מציבים $x = ${T(p)}$: $y = ${T(m)} \\cdot ${T(p, true)}${plusB(b)} = ${T(y)}$`,
        on ? `יצא $y = ${T(y)}$, כמו בנקודה: הנקודה נמצאת על הישר.` : `יצא $y = ${T(y)}$ ולא $y = ${T(q)}$: הנקודה לא נמצאת על הישר.`,
      ],
      diag: (u) => (u === 0 && !on ? (swapOn ? 'swap-xy' : nobOn ? 'forgot-b' : null) : null),
    };
  }
}

/**
 * 1c. The missing coordinate of a point on the line: (p, k) by substituting x, or (k, q) by solving for x (the
 * textbook's "for which k is the point on the line?"). Mistakes: the y substituted as if it were x (swap-xy), b moved
 * over with its sign kept (b-sign); for the y, those of the table of values (forgot-b, neg-sub, added-m). Each draw keeps
 * them apart, and the answer is no number printed in the question (key lf1k:x|y:m:b:p:q).
 */
function onLineFind() {
  for (;;) {
    const m = NZ(-4, 4); const b = NZ(-8, 8); const p = NZ(-5, 5); const q = m * p + b;
    if (Math.abs(q) > 15 || q === 0) continue;
    const askX = Math.random() < 0.6;
    const ans = askX ? p : q;
    const bugs = askX ? { 'swap-xy': m * q + b, 'b-sign': (q + b) / m } : { 'forgot-b': m * p, ...(p < 0 ? { 'neg-sub': -m * p + b } : {}), 'added-m': m + p + b };
    const vals = Object.values(bugs);
    const printed = [m, b, askX ? q : p];
    if (vals.some((v) => near(v, ans)) || new Set(vals.map((v) => v.toFixed(6))).size < vals.length || printed.some((v) => near(v, ans))) continue;
    const rhs = `${kx(m)}${plusB(b)}`;
    return {
      key: `lf1k:${askX ? 'x' : 'y'}:${m}:${b}:${p}:${q}`,
      text: `הנקודה $(${askX ? `k, ${q}` : `${p}, k`})$ נמצאת על הישר $${lineTex(m, b)}$. מצאו את $k$.`,
      form: 'num', answer: ans, label: 'k =',
      hint: askX
        ? 'הנקודה על הישר, ולכן השיעורים שלה מקיימים את המשוואה. מציבים את שיעור ה־$y$ שלה במקום $y$, ופותרים כדי למצוא את $x$.'
        : 'הנקודה על הישר: מציבים את שיעור ה־$x$ שלה במשוואה ומחשבים את $y$.',
      solution: askX
        ? [
          `מציבים $y = ${T(q)}$: $${T(q)} = ${rhs}$`,
          ...(b === 0 ? [] : [`$${kx(m)} = ${T(q - b)}$`]),
          Math.abs(m) === 1 ? `$x = ${T(p)}$` : `$x = \\frac{${T(q - b)}}{${T(m)}} = ${T(p)}$`,
          `לכן $k = ${T(p)}$`,
        ]
        : [`מציבים $x = ${T(p)}$: $y = ${T(m)} \\cdot ${T(p, true)}${plusB(b)} = ${T(q)}$`, `לכן $k = ${T(q)}$`],
      diag: (u) => Object.entries(bugs).filter(([, v]) => near(u, v)).map(([id]) => id),
    };
  }
}

/** y = b + mx, the constant first, as a textbook also writes it: y = 5 - 3x, y = -4 + x. */
const lineTexB = (m, b) => (m === 0 || b === 0 ? lineTex(m, b) : `y = ${T(b)} ${m < 0 ? '-' : '+'} ${Math.abs(m) === 1 ? '' : Math.abs(m)}x`);

// Which of four functions is increasing (or decreasing)? Two of the others have b with the asked sign and m with the
// other one: chosen by b, not by m (sign-from-b). Four choices, so a verification of that misconception, which asks
// these, is not a coin flip between "עולה" and "יורדת". Each line is written y = mx + b or y = b + mx, so the minus in
// front of a decreasing line does not make the right one the widest: it is the widest one time in four (PRODUCT2-8;
// the constant, y = 5, is always the narrowest).
function dirPick() {
  const place = drawPlace(4, Math.random, { narrowest: false });
  for (;;) {
    const up = Math.random() < 0.5; const s = up ? 1 : -1;
    const fs = [{ m: s * R(1, 5), b: NZ(-8, 8) }, { m: -s * R(1, 5), b: s * R(1, 8) }, { m: -s * R(1, 5), b: s * R(1, 8) }, { m: 0, b: NZ(-8, 8) }];
    if (new Set(fs.map((f) => `${f.m},${f.b}`)).size < 4) continue;
    const choices = byWidth(fs.map((f, i) => ({ forms: [...new Set([lineTex(f.m, f.b), lineTexB(f.m, f.b)])].map((t) => ({ tex: t })), ok: i === 0, bug: i === 1 || i === 2 ? 'sign-from-b' : undefined })), place);
    if (!choices) continue;
    const r = fs[0]; const shown = choices.find((c) => c.ok).tex;
    return {
      key: `lf2p:${up ? 'up' : 'down'}:${fs.map((f) => `${f.m},${f.b}`).join(';')}`, text: `איזו מהפונקציות ${up ? 'עולה' : 'יורדת'}?`, form: 'mc',
      choices, answer: choices.findIndex((c) => c.ok),
      hint: 'מסתכלים רק על $m$, המספר שלפני $x$: חיובי זה עולה, שלילי זה יורד, ואפס זה קו אופקי. $b$ לא משנה את הכיוון.',
      solution: [`ב־$${shown}$ השיפוע $m = ${T(r.m)}$, ${up ? 'חיובי, לכן היא עולה' : 'שלילי, לכן היא יורדת'}.`, `בשתיים אחרות $b$ ${up ? 'חיובי' : 'שלילי'}, אבל $m$ ${up ? 'שלילי' : 'חיובי'}: הן ${up ? 'יורדות' : 'עולות'}. ו־$m = 0$ הוא קו אופקי.`],
      diag: (u) => choices[u]?.bug || null,
    };
  }
}

// 2. reading the equation: m is the number before x, b is where it meets the y-axis, the sign of m
function meaning() {
  const kind = pick(['m', 'b', 'dir', 'dir', 'pick']);
  if (kind === 'pick') return dirPick();
  // rising, falling and constant one time in three each, so no place of the three choices is right more often than a
  // blind guess (learn/guessing.test.ts, PRODUCT2-8; at 15% constant, "יורדת" was right 43% of the time)
  const m = kind === 'dir' && Math.random() < 1 / 3 ? 0 : NZ(-5, 5); const b = NZ(-8, 8);
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
    diag: (u) => [near(u, kind === 'm' ? b : m) && m !== b && 'm-b', near(u, -ans) && 'sign'].filter(Boolean),
  };
}

/**
 * 2c. Lines parallel to the axes (the teacher's "ישרים מקבילים לצירים"): every point of a line parallel to the x-axis
 * has the same y (y = k, slope 0), every point of one parallel to the y-axis the same x (x = k, not a function's graph).
 * Its equation from two of its points, or from one point and the axis it is parallel to. Four choices: x and y, each
 * with the line's number and with the point's other number, set so that their width tells nothing (byWidth). The right
 * number with the other letter, or the line through the point parallel to the other axis, is axis-swap; the right letter
 * with the point's other number is swap (key lf2a:y|x:k:1|2:o:o2).
 */
function axisLine() {
  for (;;) {
    const flat = Math.random() < 0.5; // parallel to the x-axis: y = k
    const k = NZ(-5, 5); const o = NZ(-5, 5); // the line's number; the other coordinate of the point A on it
    if (k === o) continue;
    const two = Math.random() < 0.55;
    let o2 = o;
    while (two && o2 === o) o2 = R(-5, 5);
    const at = (c) => (flat ? [c, k] : [k, c]);
    const A = at(o); const B = at(o2);
    const L = flat ? 'y' : 'x'; const L2 = flat ? 'x' : 'y';
    // (the two choices with k are as wide as each other, and so are the two with o: k and o take their signs apart, so
    // the widest or the narrowest choice is the right one no more often than a blind guess, learn/guessing.test.ts)
    const opt = (letter, v, extra) => ({ tex: `${letter} = ${v}`, ...extra });
    const choices = shuffle([opt(L, k, { ok: true }), opt(L2, k, { bug: 'axis-swap' }), opt(L2, o, { bug: 'axis-swap' }), opt(L, o, { bug: 'swap' })]);
    const ptA = `A(${A[0]}, ${A[1]})`; const ptB = `B(${B[0]}, ${B[1]})`;
    const vertical = 'ישר כזה אינו גרף של פונקציה: לאותו $x$ יש בו הרבה ערכי $y$.';
    return {
      key: `lf2a:${L}:${k}:${two ? 2 : 1}:${o}:${o2}`,
      text: two ? `מהי משוואת הישר שעובר דרך הנקודות $${ptA}$ ו־$${ptB}$?` : `הישר מקביל לציר $${L2}$ ועובר דרך הנקודה $${ptA}$. מהי משוואת הישר?`,
      form: 'mc', choices, answer: choices.findIndex((c) => c.ok),
      fig: { type: 'coord', range: 6, points: [{ x: A[0], y: A[1], label: 'A' }, ...(two ? [{ x: B[0], y: B[1], label: 'B' }] : [])] },
      hint: 'בישר המקביל לציר $x$ לכל הנקודות אותו שיעור $y$, ולכן משוואתו $y = k$. בישר המקביל לציר $y$ לכל הנקודות אותו שיעור $x$, ומשוואתו $x = k$.',
      solution: two
        ? [`לשתי הנקודות אותו שיעור $${L}$, והוא $${k}$: הישר מקביל לציר $${L2}$.`, `לכל נקודה על הישר $${L} = ${k}$, ולכן משוואת הישר $${L} = ${k}$.`, ...(flat ? [] : [vertical])]
        : [`בישר המקביל לציר $${L2}$ לכל הנקודות אותו שיעור $${L}$, כמו לנקודה $A$.`, `שיעור ה־$${L}$ של $A$ הוא $${k}$, ולכן משוואת הישר $${L} = ${k}$.`, ...(flat ? [] : [vertical])],
      diag: (u) => choices[u]?.bug || null,
    };
  }
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
      diag: (u) => [near(u, run / rise) && !near(m, run / rise) && 'inverse', near(u, -m) && 'sign'].filter(Boolean),
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
      // precise: a slope like 10/3 is right as the fraction or rounded as the question's format line says (3.33,
      // 3.333), never as 3.34, which the default ±0.01 let through (as the probability stairs, content/prob.js)
      form: 'num', answer: m, label: 'm =', precise: true,
      hint: '$m = \\frac{y_2 - y_1}{x_2 - x_1}$. אסור לערבב את הסדר: הנקודה שמתחילים ממנה למעלה היא גם זו שמתחילים ממנה למטה. מספר שלילי כותבים בסוגריים.',
      solution: [`$m = \\frac{${T(y2)} - ${T(y1, true)}}{${T(x2)} - ${T(x1, true)}} = ${dx === 1 ? T(dy) : `\\frac{${dy}}{${dx}}`}$`, ...(dx === 1 ? [] : [`$m = ${ratioTex(p, q)}$`])],
      diag: (u) => [near(u, dx / dy) && !near(m, dx / dy) && 'inverse', near(u, -m) && 'mixed-order'].filter(Boolean),
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
      // b with the wrong sign and b read off the point can be the same number: then both
      diag: (v) => (v ? [near(v.m, m) && near(v.b, -b) && b !== 0 && 'b-sign', near(v.m, m) && near(v.b, y1) && y1 !== b && 'b-is-y', near(v.m, -m) && 'sign'].filter(Boolean) : null),
    };
  }
}

/**
 * 5b. The line through a point, parallel to a given line (the teacher's "באמצעות נקודה וישר המקביל"): parallel lines have
 * the same slope, so m is the given line's, and b comes from the point. Mistakes: the given line's b copied too (same-b),
 * b with the wrong sign (b-sign), the point's y taken for b (b-is-y), the slope's sign (sign); each draw keeps their
 * answers apart from each other and from the right one (key lf5p:m:x1:y1:b0). The given line and the point are drawn
 * when the point is on the plane.
 */
function parallelThrough() {
  for (;;) {
    const m = NZ(-3, 3); const b0 = R(-6, 6); const b = R(-6, 6); const x1 = NZ(-4, 4); const y1 = m * x1 + b;
    if (b === b0 || Math.abs(y1) > 10) continue;
    const slips = [b0, y1, ...(b ? [-b] : [])];
    if (new Set([b, ...slips]).size !== slips.length + 1 || b === x1 || b === m) continue;
    const given = Math.random() < 0.3 ? lineTexB(m, b0) : lineTex(m, b0);
    const drawn = Math.abs(y1) <= 6;
    return {
      key: `lf5p:${m}:${x1}:${y1}:${b0}`,
      text: `מצאו את משוואת הישר שמקביל לישר $${given}$ ועובר דרך הנקודה $A(${x1}, ${y1})$.`,
      form: 'line', answer: { m, b },
      ...(drawn ? { fig: { type: 'coord', range: 6, line: { m, b: b0 }, points: [{ x: x1, y: y1, label: 'A' }] } } : {}),
      hint: 'לישרים מקבילים יש אותו שיפוע: $m$ של הישר החדש הוא $m$ של הישר הנתון. אחר כך מציבים את הנקודה ב־$y = mx + b$ ומוצאים את $b$.',
      solution: [
        `ישרים מקבילים, ולכן אותו שיפוע: $m = ${T(m)}$`,
        `מציבים את $A$: $${y1} = ${T(m)} \\cdot ${T(x1, true)} + b$`,
        `$${y1} = ${T(m * x1)} + b \\Rightarrow b = ${T(b)}$`,
        `$${lineTex(m, b)}$`,
      ],
      diag: (v) => (v ? [
        near(v.m, m) && near(v.b, b0) && 'same-b', near(v.m, m) && near(v.b, -b) && b !== 0 && 'b-sign',
        near(v.m, m) && near(v.b, y1) && 'b-is-y', near(v.m, -m) && 'sign',
      ].filter(Boolean) : null),
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
    solution: [`$y = ${T(m)} \\cdot ${T(x0, true)}${plusB(b)} = ${T(y0)}$`, `הנקודה $(${T(x0)}, ${T(y0)})$`],
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
    diag: (u) => (u ? [u.m === b && u.b === m && m !== b && 'm-b', u.m === -m && u.b === b && 'sign'].filter(Boolean) : null),
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
        ? [`$0 = ${kx(m)}${plusB(b)}$`, `$${kx(m)} = ${T(-b)}$`, Math.abs(m) === 1 ? `$x = ${plainNum(x0)}$` : `$x = \\frac{${T(-b)}}{${T(m)}} = ${plainNum(x0)}$`, `הנקודה: $(${plainNum(x0)}, 0)$`]
        : [`$${name}(0) = ${T(m)} \\cdot 0 ${b < 0 ? '-' : '+'} ${Math.abs(b)} = ${T(b)}$`, `הנקודה: $(0, ${b})$`],
      // the pair the other way round can also be the other axis's point (y = −x + 3: (3, 0) and (0, 3)): then both
      diag: ([u, v]) => [
        near(u, ans[1]) && near(v, ans[0]) && ans[0] !== ans[1] && 'swap',
        onX && near(u, -x0) && near(v, 0) && 'sign',
        ((onX && near(u, 0) && near(v, b)) || (!onX && near(u, x0) && near(v, 0))) && 'axes-mixed',
      ].filter(Boolean),
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
      diag: (u) => [near(u, 2 * area) && 'no-half', near(u, Math.abs(b) + Math.abs(x0)) && 'added-sides'].filter(Boolean),
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
        `$${kx(m1 - m2)} = ${T(b2 - b1)} \\Rightarrow x = ${T(x)}$`,
        `$y = ${T(m1)} \\cdot ${T(x, true)}${plusB(b1)} = ${T(y)}$`, `הנקודה: $E(${x}, ${y})$`],
      // 'forgot-y' only when y clearly was not worked out: the x written again, or left at 0
      diag: ([u, v]) => [near(u, y) && near(v, x) && x !== y && 'swap', near(u, x) && !near(v, y) && (near(v, x) || near(v, 0)) && 'forgot-y'].filter(Boolean),
    };
  }
}

/**
 * 8b. Where a line meets a line parallel to an axis: on y = k every point is at height k, so the meeting point's x comes
 * from k = mx + b; on x = k its y comes from substituting k. The coordinate the student finds is no number printed in
 * the question (key lf8a:y|x:m:b:k).
 */
function meetAxis() {
  for (;;) {
    const m = NZ(-4, 4); const b = NZ(-8, 8); const flat = Math.random() < 0.6;
    const x = NZ(-5, 5); const y = m * x + b;
    if (Math.abs(y) > 12 || x === y) continue;
    const k = flat ? y : x; const found = flat ? x : y;
    if (found === 0 || [m, b, k].some((v) => Math.abs(v) === Math.abs(found))) continue;
    const L = flat ? 'y' : 'x';
    return {
      key: `lf8a:${L}:${m}:${b}:${k}`, text: `מצאו את נקודת המפגש $E$ של הישרים $${lineTex(m, b)}$ ו־$${L} = ${k}$.`,
      form: 'pt', answer: [x, y], label: 'E',
      hint: flat
        ? 'על הישר $y = k$ לכל הנקודות אותו שיעור $y$. גם בנקודת המפגש $y = k$: מציבים אותו במשוואת הישר השני ופותרים את $x$.'
        : 'על הישר $x = k$ לכל הנקודות אותו שיעור $x$. גם בנקודת המפגש $x = k$: מציבים אותו במשוואת הישר השני ומחשבים את $y$.',
      solution: flat
        ? [`בנקודת המפגש $y = ${T(k)}$`, `$${T(k)} = ${kx(m)}${plusB(b)}$`, `$${kx(m)} = ${T(k - b)} \\Rightarrow x = ${T(x)}$`, `הנקודה: $E(${x}, ${y})$`]
        : [`בנקודת המפגש $x = ${T(k)}$`, `$y = ${T(m)} \\cdot ${T(k, true)}${plusB(b)} = ${T(y)}$`, `הנקודה: $E(${x}, ${y})$`],
      // as at 8: the point the other way round, or y not worked out (the x written again, or left at 0)
      diag: ([u, v]) => [near(u, y) && near(v, x) && 'swap', near(u, x) && !near(v, y) && (near(v, x) || near(v, 0)) && 'forgot-y'].filter(Boolean),
    };
  }
}

const mixOf = (parts) => () => { let r = Math.random(); for (const [w, make] of parts) { if (r < w) return make(); r -= w; } return parts[parts.length - 1][1](); };

export const LINEAR = {
  id: 'line', grade: '8', title: 'פונקציה קווית', color: 'cobalt',
  desc: 'טבלת ערכים, שיפוע, משוואת ישר, חיתוך עם הצירים ונקודת מפגש',
  // ז׳ meets a table of values and its points in May (unit 7.9): the unit joins the ז׳ path from then (PRODUCT2-20)
  alsoFor: ['7'],
  levels: [
    // the teacher's "האם נקודה נמצאת על הישר?" (onLineAsk, a practice-only choice; onLineFind, typed) beside the table
    { title: 'טבלת ערכים', gen: mixOf([[0.3, predictPoint], [0.4, table], [0.12, onLineAsk], [0.18, onLineFind]]) },
    // lines parallel to the axes (axisLine): y = k is a line of slope 0, x = k is not a function
    { title: 'מה אומרים m ו־b', gen: mixOf([[0.4, buildLine], [0.4, meaning], [0.2, axisLine]]) },
    { title: 'שיפוע מהגרף: מדרגות', gen: stepsFromGraph },
    { title: 'שיפוע בין שתי נקודות', gen: slopeTwoPoints },
    // the line through a point and parallel to a given line (parallelThrough), beside two points and a point and a slope
    { title: 'משוואת ישר', gen: mixOf([[0.75, lineEquation], [0.25, parallelThrough]]) },
    { title: 'חיתוך עם הצירים', gen: axes },
    { title: 'משולש עם הצירים', gen: triangle },
    // a line meeting y = k or x = k (meetAxis), beside two lines y = mx + b
    { title: 'נקודת מפגש של שני ישרים', gen: mixOf([[0.7, meet], [0.3, meetAxis]]) },
  ],
  cats: {
    'forgot-b': 'שכחו להוסיף את $b$',
    'neg-sub': 'הציבו $x$ שלילי כאילו הוא חיובי (בלי סוגריים)',
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
    // a point on the line, lines parallel to the axes, a parallel line through a point
    'swap-xy': 'הציבו את שיעור ה־$y$ של הנקודה במקום $x$',
    'axis-swap': 'התבלבלו בין ישר המקביל לציר $x$ ($y = k$) לישר המקביל לציר $y$ ($x = k$)',
    'same-b': 'העתיקו גם את $b$ של הישר הנתון: לישר מקביל יש אותו שיפוע, אבל $b$ אחר',
  },
  lesson: {
    points: [
      'פונקציה קווית היא פונקציה שהגרף שלה קו ישר. כותבים אותה כך: $y = mx + b$.',
      '$b$ הוא המספר החופשי (עם הסימן): הישר חותך את ציר $y$ בנקודה $(0, b)$.',
      '$m$ הוא השיפוע, המספר שלפני $x$. הוא קצב השינוי: כמה עולים או יורדים כשזזים צעד אחד ימינה בציר $x$.',
      '$m > 0$: הפונקציה עולה. $m < 0$: היא יורדת. ככל ש־$m$ גדול יותר, עולים מהר יותר.',
      'שיפוע בין שתי נקודות: $m = \\frac{y_2 - y_1}{x_2 - x_1}$. אסור לערבב את הסדר בין המונה למכנה.',
      'נקודה נמצאת על הישר כשהשיעורים שלה מקיימים את המשוואה: מציבים את ה־$x$ שלה, ויוצא ה־$y$ שלה.',
      'ישר המקביל לציר $x$: $y = k$ (השיפוע $0$). ישר המקביל לציר $y$: $x = k$, והוא אינו גרף של פונקציה.',
      'משוואת ישר בשני שלבים: מוצאים את $m$, מציבים נקודה ב־$y = mx + b$ כדי למצוא את $b$, וכותבים את המשוואה.',
      'לישרים מקבילים יש אותו שיפוע: לישר שמקביל לישר נתון לוקחים את ה־$m$ שלו, ומוצאים את $b$ מנקודה.',
      'חיתוך עם ציר $y$: מציבים $x = 0$. חיתוך עם ציר $x$: מציבים $y = 0$ ופותרים.',
      'נקודת מפגש של שני ישרים: משווים $y = y$, פותרים את $x$, ומציבים כדי למצוא את $y$.',
    ],
    examples: [
      '$y = 2x + 1$: כש־$x = -2$ מקבלים $y = 2 \\cdot (-2) + 1 = -3$.',
      'הנקודות $(1, 2)$ ו־$(4, 11)$: $m = \\frac{11 - 2}{4 - 1} = \\frac{9}{3} = 3$, וגם $\\frac{2 - 11}{1 - 4} = \\frac{-9}{-3} = 3$.',
      'האם $(2, 5)$ על הישר $y = 3x - 1$? $3 \\cdot 2 - 1 = 5$: כן. ו־$(5, 2)$? $3 \\cdot 5 - 1 = 14$, לא $2$: לא.',
      'הנקודות $(1, 3)$ ו־$(4, 6)$: $m = 1$, ואז $3 = 1 \\cdot 1 + b$, לכן $b = 2$ ו־$y = x + 2$.',
      'הישר שמקביל ל־$y = 2x - 5$ ועובר דרך $(3, 4)$: $m = 2$, ואז $4 = 2 \\cdot 3 + b$, לכן $b = -2$ ו־$y = 2x - 2$.',
      '$y = -2x + 6$ חותך את הצירים ב־$(0, 6)$ וב־$(3, 0)$, ושטח המשולש $\\frac{6 \\cdot 3}{2} = 9$.',
      '$g(x) = 20 - 8x$: $0 = 20 - 8x$, לכן $x = 2.5$ והנקודה $(2.5, 0)$.',
      '$y = 3x - 2$ ו־$y = -2x + 8$: $3x - 2 = -2x + 8$, לכן $x = 2$, $y = 4$ והנקודה $E(2, 4)$.',
    ],
    explore: 'line',
  },
};
