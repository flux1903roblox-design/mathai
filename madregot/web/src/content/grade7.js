// Grade 7 (ז׳): signed numbers, the coordinate plane, angles.
import { R, NZ, pick, shuffle, T, near } from './util.js';
import { quadOf as quadOfPt, triangleAngles } from './manip.js';

const sgn = (x) => (x > 0 ? 1 : x < 0 ? -1 : 0);

// ---------------------------------------------------------------- signed numbers
function addSub() {
  const a = NZ(-12, 12); const b = NZ(-12, 12); const op = pick(['+', '-']);
  const ans = op === '+' ? a + b : a - b;
  const display = `${T(a)} ${op} ${T(b, true)}`;
  const bb = op === '-' ? -b : b; // what is really being added
  let hint;
  if (op === '-') hint = `חיסור הוא חיבור של הנגדי: $${T(a)} - ${T(b, true)} = ${T(a)} + ${T(-b, true)}$.`;
  else if (sgn(a) === sgn(b)) hint = 'שני המספרים באותו סימן: מחברים את המרחקים מאפס ושומרים על הסימן.';
  else hint = 'סימנים שונים: מחסרים את המרחקים מאפס, והסימן הוא של המספר הרחוק יותר מאפס.';
  const steps = [];
  if (op === '-') steps.push(`$${display} = ${T(a)} + ${T(bb, true)}$`);
  if (sgn(a) === sgn(bb)) steps.push(`אותו סימן: $${Math.abs(a)} + ${Math.abs(bb)} = ${Math.abs(ans)}$, והסימן ${a < 0 ? 'שלילי' : 'חיובי'}.`);
  else if (ans === 0) steps.push(`סימנים שונים ושני המספרים באותו מרחק מאפס: $${Math.abs(a)} - ${Math.abs(bb)} = 0$. מספר ועוד הנגדי שלו הם אפס.`);
  else steps.push(`סימנים שונים: $${Math.max(Math.abs(a), Math.abs(bb))} - ${Math.min(Math.abs(a), Math.abs(bb))} = ${Math.abs(ans)}$, והסימן של המספר הרחוק יותר מאפס.`);
  steps.push(`התשובה: $${T(ans)}$`);
  return {
    key: `sn1:${display}`, text: 'חשבו:', display, form: 'num', answer: ans, hint, solution: steps,
    diag: (u) => {
      if (ans !== 0 && near(u, -ans)) return 'sign';
      if (sgn(a) !== sgn(bb) && near(u, sgn(a) * (Math.abs(a) + Math.abs(bb)))) return 'abs-add';
      if (op === '-' && b < 0 && near(u, a + b)) return 'minus-minus';
      return null;
    },
  };
}

// Comparing by placing: three numbers go to their places on the line, so the order is something you see.
function orderPins() {
  let vals;
  do { vals = shuffle([R(-9, -1), R(-9, -1), R(1, 9), R(-9, 9)]).slice(0, 3); } while (new Set(vals).size < 3 || !vals.some((v) => v < 0) || !vals.some((v) => v > 0));
  const labels = vals.map((v) => (v < 0 ? `−${-v}` : `${v}`));
  // each marker starts on a free place that is not its own
  const free = [10, -10, 0, 9, -9, 1, -1].filter((p) => !vals.includes(p));
  const start = vals.map((v, i) => free[i]);
  const sorted = [...vals].sort((a, b) => a - b);
  return {
    key: `sn2p:${vals.join(',')}`, text: `שימו כל מספר במקום שלו על ציר המספרים: ${vals.map((v) => `$${T(v)}$`).join(', ')}.`, form: 'manip',
    manip: { kind: 'pins', min: -10, max: 10, labels, start }, answer: vals,
    hint: 'מספר שלילי נמצא משמאל לאפס. ככל שהוא רחוק יותר שמאלה, הוא קטן יותר.',
    solution: [`מהקטן לגדול: $${sorted.map(T).join(' < ')}$`, 'על הציר, הקטן ביותר הוא השמאלי ביותר.'],
    // a negative number put where its distance from zero is, on the positive side: the minus was ignored
    diag: (u) => (Array.isArray(u) && u.some((p, i) => vals[i] < 0 && p === -vals[i]) ? 'ignore-sign' : null),
  };
}

// The same skill on a number line: start at a, move the marker to the result.
function addSubLine() {
  let a; let b; let op; let ans;
  do { a = NZ(-8, 8); b = NZ(-7, 7); op = pick(['+', '-']); ans = op === '+' ? a + b : a - b; } while (ans < -10 || ans > 10 || ans === a);
  const display = `${T(a)} ${op} ${T(b, true)}`;
  const move = ans - a; // how far, and which way, the marker travels from a
  const way = (n) => (n > 0 ? `ימינה ${n}` : `שמאלה ${-n}`);
  const hint = op === '+'
    ? (b > 0 ? 'חיבור של מספר חיובי: זזים ימינה.' : 'חיבור של מספר שלילי: זזים שמאלה.')
    : (b > 0 ? 'חיסור של מספר חיובי: זזים שמאלה.' : 'חיסור של מספר שלילי הוא כמו חיבור של חיובי: זזים ימינה.');
  return {
    key: `sn1n:${display}`, text: `מתחילים ב־$${T(a)}$. הזיזו את הסמן לתוצאה:`, display, form: 'manip',
    manip: { kind: 'numberline', min: -10, max: 10, from: a, start: a },
    answer: ans, hint,
    solution: [`מ־$${T(a)}$ זזים ${way(move)}.`, `התשובה: $${T(ans)}$`],
    diag: (u) => {
      // a − (−b) moved like a − b: the subtraction of a negative number went left
      if (op === '-' && b < 0 && u === a + b) return 'minus-minus';
      // the right distance, the wrong way: a move, not the sign of the answer
      if (u === a - move) return 'direction';
      // only an answer that really is the negative of the right one is a sign error
      if (ans !== 0 && u === -ans) return 'sign';
      return null;
    },
  };
}

function compare() {
  let a = R(-15, 15); let b = R(-15, 15);
  if (Math.random() < 0.6 && a > -2) a = -R(2, 15); // most items compare negatives
  if (Math.random() < 0.1) b = a;
  const ans = a < b ? 0 : a === b ? 1 : 2;
  const choices = ['<', '=', '>'];
  return {
    key: `sn2:${a}:${b}`, text: 'איזה סימן מתאים במקום הריבוע?', display: `${T(a)} \\;\\square\\; {${T(b)}}`,
    form: 'mc', choices: choices.map((c) => ({ tex: c })), answer: ans,
    hint: 'על ציר המספרים, מספר שנמצא יותר ימינה הוא גדול יותר. בין שני מספרים שליליים, הקרוב יותר לאפס גדול יותר.',
    solution: [
      a === b ? `שני המספרים שווים: $${T(a)}$ ו־$${T(b)}$ הם אותה נקודה על ציר המספרים.` : `על ציר המספרים $${T(Math.min(a, b))}$ נמצא משמאל ל־$${T(Math.max(a, b))}$.`,
      `לכן $${T(a)} ${choices[ans]} ${T(b)}$`,
    ],
    diag: (u) => (a < 0 && b < 0 && a !== b && u !== ans && u !== 1 ? 'neg-compare' : null),
  };
}

function mulDiv() {
  const op = pick(['*', ':']);
  let a; let b; let ans;
  if (op === '*') { a = NZ(-12, 12); b = NZ(-9, 9); ans = a * b; } else { b = NZ(-9, 9); ans = NZ(-10, 10); a = ans * b; }
  const display = `${T(a)} ${op === '*' ? '\\cdot' : ':'} ${T(b, true)}`;
  return {
    key: `sn3:${display}`, text: 'חשבו:', display, form: 'num', answer: ans,
    hint: 'קודם קובעים את הסימן: סימנים זהים נותנים תוצאה חיובית, סימנים שונים נותנים תוצאה שלילית. אחר כך מחשבים בלי הסימנים.',
    solution: [
      `הסימנים ${sgn(a) === sgn(b) ? 'זהים, לכן התוצאה חיובית' : 'שונים, לכן התוצאה שלילית'}.`,
      `$${Math.abs(a)} ${op === '*' ? '\\cdot' : ':'} ${Math.abs(b)} = ${Math.abs(ans)}$`,
      `התשובה: $${T(ans)}$`,
    ],
    diag: (u) => (ans !== 0 && near(u, -ans) ? 'sign' : null),
  };
}

function order() {
  // a ± b·c  or  a·b ± c
  for (;;) {
    const a = NZ(-10, 10); const b = NZ(-6, 6); const c = NZ(-6, 6); const op = pick(['+', '-']);
    const first = Math.random() < 0.5;
    const display = first ? `${T(a)} ${op} ${T(b, true)} \\cdot ${T(c, true)}` : `${T(a)} \\cdot ${T(b, true)} ${op} ${T(c, true)}`;
    const prod = first ? b * c : a * b;
    const ans = first ? (op === '+' ? a + prod : a - prod) : (op === '+' ? prod + c : prod - c);
    const leftToRight = first ? (op === '+' ? (a + b) * c : (a - b) * c) : ans;
    if (first && leftToRight === ans) continue;
    return {
      key: `sn4:${display}`, text: 'חשבו:', display, form: 'num', answer: ans,
      hint: 'כפל וחילוק לפני חיבור וחיסור. התחילו מהכפל.',
      solution: [
        `קודם הכפל: $${first ? `${T(b, true)} \\cdot ${T(c, true)}` : `${T(a)} \\cdot ${T(b, true)}`} = ${T(prod)}$`,
        `עכשיו: $${first ? `${T(a)} ${op} ${T(prod, true)}` : `${T(prod)} ${op} ${T(c, true)}`} = ${T(ans)}$`,
      ],
      diag: (u) => {
        if (first && near(u, leftToRight)) return 'order';
        if (ans !== 0 && near(u, -ans)) return 'sign';
        return null;
      },
    };
  }
}

function brackets() {
  for (;;) {
    const a = NZ(-10, 10); const b = NZ(-8, 8); const c = NZ(-8, 8); const d = NZ(-4, 4);
    const inner = b - c; if (inner === 0) continue;
    const ans = a - inner * d;
    const display = `${T(a)} - (${T(b)} - ${T(c, true)}) \\cdot ${T(d, true)}`;
    const wrong = (a - inner) * d;
    if (wrong === ans) continue;
    return {
      key: `sn5:${display}`, text: 'חשבו:', display, form: 'num', answer: ans,
      hint: 'סדר הפעולות: סוגריים, אחר כך כפל, ובסוף החיסור.',
      solution: [
        `סוגריים: $${T(b)} - ${T(c, true)} = ${T(inner)}$`,
        `כפל: $${T(inner, true)} \\cdot ${T(d, true)} = ${T(inner * d)}$`,
        `חיסור: $${T(a)} - ${T(inner * d, true)} = ${T(ans)}$`,
      ],
      diag: (u) => {
        if (near(u, wrong)) return 'order';
        // subtracting a negative product as if it were positive: only when the product really is negative
        if (inner * d < 0 && near(u, a + inner * d)) return 'minus-minus';
        if (ans !== 0 && near(u, -ans)) return 'sign';
        return null;
      },
    };
  }
}

// ---------------------------------------------------------------- coordinate plane
const QUAD = ['רביע ראשון', 'רביע שני', 'רביע שלישי', 'רביע רביעי'];
const quadOf = (x, y) => (x > 0 ? (y > 0 ? 0 : 3) : y > 0 ? 1 : 2);

function readPoint() {
  const x = NZ(-6, 6); const y = NZ(-6, 6);
  return {
    key: `cp1:${x}:${y}`, text: 'מה השיעורים של הנקודה $A$?', form: 'pt', answer: [x, y], label: 'A',
    fig: { type: 'coord', range: 6, points: [{ x, y, label: 'A' }] },
    hint: 'קודם $x$: כמה צעדים ימינה (חיובי) או שמאלה (שלילי) מהראשית. אחר כך $y$: כמה צעדים למעלה או למטה.',
    solution: [`$x = ${T(x)}$ (${x > 0 ? 'ימינה' : 'שמאלה'} ${Math.abs(x)})`, `$y = ${T(y)}$ (${y > 0 ? 'למעלה' : 'למטה'} ${Math.abs(y)})`, `$A(${x}, ${y})$`],
    diag: ([u, v]) => {
      if (near(u, y) && near(v, x) && x !== y) return 'swap';
      if ((near(u, -x) && near(v, y)) || (near(u, x) && near(v, -y))) return 'sign';
      return null;
    },
  };
}

// Reading a point, the other way round: put A where its coordinates say.
function plotPoint() {
  const x = NZ(-6, 6); const y = NZ(-6, 6);
  return {
    key: `cp1p:${x}:${y}`, text: `הקישו או גררו כדי לשים את הנקודה $A(${x}, ${y})$ במקום שלה.`, form: 'manip',
    manip: { kind: 'plot', range: 6, label: 'A', start: null }, answer: [x, y],
    hint: 'קודם $x$: כמה צעדים ימינה (חיובי) או שמאלה (שלילי) מהראשית. אחר כך $y$: כמה צעדים למעלה או למטה.',
    solution: [`$x = ${T(x)}$: ${x > 0 ? 'ימינה' : 'שמאלה'} ${Math.abs(x)} מהראשית.`, `$y = ${T(y)}$: ${y > 0 ? 'למעלה' : 'למטה'} ${Math.abs(y)}.`],
    diag: (u) => {
      if (!u) return null;
      if (u[0] === y && u[1] === x && x !== y) return 'swap';
      if ((u[0] === -x && u[1] === y) || (u[0] === x && u[1] === -y)) return 'sign';
      return null;
    },
  };
}

// Quadrants by placing: any point in the quadrant is right. Most of the time one coordinate is given too ("whose x
// is −4"), so the sign of the other one is what the student decides, and no one point answers every question.
function plotQuadrant() {
  const q = R(1, 4);
  const sx = [1, -1, -1, 1][q - 1]; const sy = [1, 1, -1, -1][q - 1];
  const signs = [['חיובי', 'חיובי'], ['שלילי', 'חיובי'], ['שלילי', 'שלילי'], ['חיובי', 'שלילי']][q - 1];
  const fix = Math.random() < 0.7 ? pick(['x', 'y']) : null;
  const v = R(1, 5);
  const example = fix === 'x' ? [sx * v, sy * 2] : fix === 'y' ? [sx * 2, sy * v] : [sx * 3, sy * 2];
  const what = fix === 'x' ? ` ששיעור ה־$x$ שלה הוא $${T(sx * v)}$` : fix === 'y' ? ` ששיעור ה־$y$ שלה הוא $${T(sy * v)}$` : ' כלשהי';
  // e.g. שימו ברביע השלישי נקודה ששיעור ה־x שלה הוא −4
  return {
    key: `cp2p:${q}:${fix || '-'}:${fix ? (fix === 'x' ? sx * v : sy * v) : ''}`, text: `שימו ב${QUAD[q - 1].replace('רביע ', 'רביע ה')} נקודה${what}.`, form: 'manip',
    manip: { kind: 'plot', range: 6, label: 'P', start: null, quadrant: q, ...(fix === 'x' ? { fixX: sx * v } : fix === 'y' ? { fixY: sy * v } : {}) }, answer: example,
    hint: 'רביע ראשון: $x$ ו־$y$ חיוביים. אחר כך ממשיכים נגד כיוון השעון: שני, שלישי, רביעי.',
    solution: [`ב${QUAD[q - 1]} $x$ ${signs[0]} ו־$y$ ${signs[1]}.`, `למשל $(${example[0]}, ${example[1]})$.`],
    diag: (u) => (u && quadOfPt([u[1], u[0]]) === q && quadOfPt(u) !== q ? 'swap' : null),
  };
}

function quadrant() {
  const x = NZ(-9, 9); const y = NZ(-9, 9); const ans = quadOf(x, y);
  return {
    key: `cp2:${x}:${y}`, text: `באיזה רביע נמצאת הנקודה $B(${x}, ${y})$?`, form: 'mc',
    choices: QUAD.map((t) => ({ text: t })), answer: ans,
    hint: 'רביע ראשון: $x$ ו־$y$ חיוביים. אחר כך ממשיכים נגד כיוון השעון: שני, שלישי, רביעי.',
    solution: [`$x = ${x}$ ${x > 0 ? 'חיובי' : 'שלילי'}, $y = ${y}$ ${y > 0 ? 'חיובי' : 'שלילי'}.`, `לכן הנקודה ב${QUAD[ans]}.`],
    diag: (u) => (u === quadOf(y, x) && quadOf(y, x) !== ans ? 'swap' : null),
  };
}

function segmentLength() {
  const horizontal = Math.random() < 0.5;
  const fixed = R(-5, 5); let p = R(-6, 5); let q = R(-6, 6);
  while (q === p) q = R(-6, 6);
  const [x1, y1, x2, y2] = horizontal ? [p, fixed, q, fixed] : [fixed, p, fixed, q];
  const ans = Math.abs(q - p);
  return {
    key: `cp3:${x1}:${y1}:${x2}:${y2}`, text: `מה האורך של הקטע $CD$, כש־$C(${x1}, ${y1})$ ו־$D(${x2}, ${y2})$?`,
    form: 'num', answer: ans, unit: 'יחידות',
    fig: { type: 'coord', range: 6, points: [{ x: x1, y: y1, label: 'C' }, { x: x2, y: y2, label: 'D' }], segments: [[[x1, y1], [x2, y2]]] },
    hint: `הקטע ${horizontal ? 'אופקי, אז רק $x$ משתנה' : 'אנכי, אז רק $y$ משתנה'}. האורך הוא המרחק בין שני הערכים.`,
    solution: [`$${T(Math.max(p, q))} - ${T(Math.min(p, q), true)} = ${ans}$`, `האורך: ${ans === 1 ? 'יחידה אחת' : `${ans} יחידות`}`],
    diag: (u) => {
      if (near(u, Math.abs(Math.abs(q) - Math.abs(p))) && Math.sign(p) !== Math.sign(q)) return 'add-coords';
      if (near(u, -ans)) return 'sign';
      return null;
    },
  };
}

function rectArea() {
  const x1 = R(-6, 1); const x2 = x1 + R(2, 5); const y1 = R(-6, 2); const y2 = y1 + R(2, 4);
  const w = x2 - x1; const h = y2 - y1; const ans = w * h;
  const pts = [[x1, y1], [x2, y1], [x2, y2], [x1, y2]];
  const names = ['A', 'B', 'C', 'D'];
  return {
    key: `cp4:${x1}:${x2}:${y1}:${y2}`,
    text: `מה השטח של המלבן $ABCD$? ${pts.map((p, i) => `$${names[i]}(${p[0]}, ${p[1]})$`).join(', ')}`, // one expression per point: a narrow screen wraps between them
    form: 'num', answer: ans, unit: 'יחידות ריבועיות',
    fig: { type: 'coord', range: 6, polygon: pts, points: pts.map((p, i) => ({ x: p[0], y: p[1], label: names[i] })) },
    hint: 'מוצאים את אורך הצלע האופקית (לפי $x$) ואת אורך הצלע האנכית (לפי $y$), וכופלים.',
    solution: [`רוחב: $${T(x2)} - ${T(x1, true)} = ${w}$`, `גובה: $${T(y2)} - ${T(y1, true)} = ${h}$`, `שטח: $${w} \\cdot ${h} = ${ans}$`],
    diag: (u) => (near(u, 2 * (w + h)) ? 'perimeter' : near(u, w + h) ? 'add-sides' : null),
  };
}

// The missing vertex, placed on the grid: three corners of rectangle ABCD are there; the student puts D.
function rectVertexPlot() {
  const x1 = R(-5, 3); const x2 = R(x1 + 2, 5); const y1 = R(-5, 3); const y2 = R(y1 + 2, 5);
  const shape = [{ label: 'A', at: [x1, y1] }, { label: 'B', at: [x2, y1] }, { label: 'C', at: [x2, y2] }];
  return {
    key: `cp5r:${x1}:${x2}:${y1}:${y2}`, text: 'שלושה קודקודים של המלבן $ABCD$ כבר על הרשת. שימו את הקודקוד $D$.', form: 'manip',
    manip: { kind: 'plot', range: 6, label: 'D', start: null, shape }, answer: [x1, y2],
    hint: 'הצלעות של המלבן מקבילות לצירים: ל־$D$ אותו $x$ כמו ל־$A$, ואותו $y$ כמו ל־$C$.',
    solution: [`$D$ מעל $A$, באותו $x$: $${T(x1)}$`, `ובגובה של $C$, באותו $y$: $${T(y2)}$`, `$D(${T(x1)}, ${T(y2)})$`],
    diag: (u) => (u && u[0] === y2 && u[1] === x1 && x1 !== y2 ? 'swap' : null),
  };
}

function missingVertex() {
  const x1 = R(-6, 1); const x2 = x1 + R(2, 5); const y1 = R(-6, 2); const y2 = y1 + R(2, 4);
  const pts = [[x1, y1], [x2, y1], [x2, y2], [x1, y2]];
  const miss = R(0, 3); const names = ['A', 'B', 'C', 'D'];
  const shown = pts.map((p, i) => ({ x: p[0], y: p[1], label: names[i], hidden: i === miss }));
  const [ax, ay] = pts[miss];
  return {
    key: `cp5:${x1}:${x2}:${y1}:${y2}:${miss}`,
    text: `$ABCD$ הוא מלבן. נתון: ${shown.filter((p) => !p.hidden).map((p) => `$${p.label}(${p.x}, ${p.y})$`).join(', ')}. מה השיעורים של $${names[miss]}$?`,
    form: 'pt', answer: [ax, ay], label: names[miss],
    fig: { type: 'coord', range: 6, points: shown.filter((p) => !p.hidden) },
    hint: `במלבן הצלעות מקבילות לצירים: ל־$${names[miss]}$ יש אותו $x$ כמו לשכנה אחת שלו, ואותו $y$ כמו לשכנה השנייה.`,
    solution: [`השכנות של $${names[miss]}$: $${names[(miss + 1) % 4]}$ ו־$${names[(miss + 3) % 4]}$.`, `לכן $${names[miss]}(${ax}, ${ay})$`],
    diag: ([u, v]) => (near(u, ay) && near(v, ax) && ax !== ay ? 'swap' : null),
  };
}

// ---------------------------------------------------------------- angles
const deg = (n) => `${n}^\\circ`;

function linearPair() {
  let a; do { a = R(4, 32) * 5; } while (a === 90);
  const ans = 180 - a;
  return {
    key: `an1:${a}`, text: 'שתי זוויות צמודות. מה גודל הזווית המסומנת ב־$?$', form: 'num', answer: ans, unit: 'מעלות',
    fig: { type: 'linear', a },
    hint: 'זוויות צמודות משלימות זו את זו ל־$180^\\circ$, כי יחד הן יוצרות קו ישר.',
    solution: [`$180^\\circ - ${deg(a)} = ${deg(ans)}$`],
    diag: (u) => (near(u, a) ? 'equal-not-supp' : near(u, 90 - a) || near(u, 360 - a) ? 'wrong-total' : null),
  };
}

// Adjacent angles by turning: the left angle must be t, so the right one is 180 - t.
function linearPairTurn() {
  let t; do { t = R(5, 31) * 5; } while (Math.abs(t - 90) < 15);
  const ans = 180 - t;
  return {
    key: `an1t:${t}`, text: `סובבו את הקרן כך שהזווית השמאלית תהיה $${deg(t)}$.`, form: 'manip',
    manip: { kind: 'angle', target: t, start: 90 }, answer: ans, unit: 'מעלות',
    hint: 'שתי הזוויות יחד יוצרות קו ישר, כלומר $180^\\circ$. כמה צריכה להיות הזווית הימנית?',
    solution: [`$180^\\circ - ${deg(t)} = ${deg(ans)}$`, `כשהזווית הימנית היא $${deg(ans)}$, השמאלית היא $${deg(t)}$.`],
    diag: (u) => (u === t ? 'equal-not-supp' : null),
  };
}

function vertical() {
  let a; do { a = R(4, 32) * 5; } while (a === 90);
  const askVertical = Math.random() < 0.6;
  const ans = askVertical ? a : 180 - a;
  return {
    key: `an2:${a}:${askVertical}`, text: 'שני ישרים נחתכים. מה גודל הזווית המסומנת ב־$?$', form: 'num', answer: ans, unit: 'מעלות',
    fig: { type: 'cross', a, target: askVertical ? 'vertical' : 'adjacent' },
    hint: askVertical ? 'זוויות קודקודיות (אחת מול השנייה) שוות זו לזו.' : 'הזווית המסומנת צמודה לזווית הנתונה: יחד הן $180^\\circ$.',
    solution: askVertical ? [`זוויות קודקודיות שוות: $${deg(a)}$`] : [`זוויות צמודות: $180^\\circ - ${deg(a)} = ${deg(ans)}$`],
    diag: (u) => (askVertical && near(u, 180 - a) ? 'supp-not-equal' : !askVertical && near(u, a) ? 'equal-not-supp' : null),
  };
}

// Dragging a vertex: A and B stay, C moves on the grid; the three angles and their sum follow it live.
/** Bases A(a, 0), B(b, 0) on the grid with the grid points C above them where the angle C is right (C on the circle on AB). */
const RIGHT_BASES = (() => {
  const out = [];
  for (let a = -6; a <= 4; a += 1) for (let b = a + 2; b <= 6; b += 1) {
    const cs = [];
    for (let x = -6; x <= 6; x += 1) for (let y = 1; y <= 6; y += 1) if ((a - x) * (b - x) + y * y === 0) cs.push([x, y]);
    if (cs.length) out.push({ A: [a, 0], B: [b, 0], cs });
  }
  return out;
})();
function rightTriangleDrag() {
  const base = pick(RIGHT_BASES);
  const free = [[-2, 3], [2, 3], [0, 1], [-1, 6], [1, 6]].filter((c) => !base.cs.some((r) => r[0] === c[0] && r[1] === c[1]));
  const m = { kind: 'triangle', A: base.A, B: base.B, range: 6, start: free[0] };
  const ans = pick(base.cs);
  const [a, b] = triangleAngles(m, ans).map((d) => Math.round(d * 10) / 10);
  return {
    key: `an3d:${base.A[0]}:${base.B[0]}:${ans.join(',')}`, text: 'גררו את הקודקוד $C$ עד שהזווית $C$ תהיה ישרה ($90^\\circ$). שימו לב לסכום הזוויות.', form: 'manip',
    manip: m, answer: ans,
    hint: 'סכום הזוויות במשולש הוא תמיד $180^\\circ$. כשהזווית $C$ ישרה, $A$ ו־$B$ יחד הן $90^\\circ$.',
    solution: [`למשל $C(${T(ans[0])}, ${T(ans[1])})$: הזוויות הן $${a}^\\circ$, $${b}^\\circ$ ו־$90^\\circ$.`, `$${a}^\\circ + ${b}^\\circ + 90^\\circ = 180^\\circ$`],
    diag: () => null,
  };
}

function triangleSum() {
  const a = R(5, 16) * 5; const b = R(4, 16) * 5; const c = 180 - a - b;
  if (c < 15) return triangleSum();
  return {
    key: `an3:${a}:${b}`, text: 'במשולש נתונות שתי זוויות. מה גודל הזווית השלישית?', form: 'num', answer: c, unit: 'מעלות',
    fig: { type: 'triangle', angles: [a, b, c], show: [true, true, false] },
    hint: 'סכום הזוויות במשולש הוא $180^\\circ$.',
    solution: [`$180^\\circ - ${deg(a)} - ${deg(b)} = ${deg(c)}$`],
    diag: (u) => (near(u, 360 - a - b) ? 'sum-360' : near(u, 180 - a) || near(u, 180 - b) ? 'one-angle' : null),
  };
}

function parallel() {
  let a; do { a = R(7, 29) * 5; } while (a === 90); // angle of the transversal
  const kind = pick(['corresponding', 'alternate', 'cointerior']);
  const ans = kind === 'cointerior' ? 180 - a : a;
  const names = { corresponding: 'מתאימות', alternate: 'מתחלפות', cointerior: 'חד־צדדיות' };
  return {
    key: `an4:${a}:${kind}`, text: 'שני ישרים מקבילים נחתכים על ידי ישר שלישי. מה גודל הזווית המסומנת ב־$?$', form: 'num', answer: ans, unit: 'מעלות',
    fig: { type: 'parallel', a, kind },
    hint: 'בין ישרים מקבילים: זוויות מתאימות ומתחלפות שוות, וזוויות חד־צדדיות משלימות ל־$180^\\circ$.',
    solution: [`הזוויות ${names[kind]}.`, kind === 'cointerior' ? `$180^\\circ - ${deg(a)} = ${deg(ans)}$` : `לכן הן שוות: $${deg(ans)}$`],
    diag: (u) => (kind === 'cointerior' && near(u, a) ? 'equal-not-supp' : kind !== 'cointerior' && near(u, 180 - a) ? 'supp-not-equal' : null),
  };
}

function isosceles() {
  if (Math.random() < 0.5) {
    const top = R(2, 15) * 10; const base = (180 - top) / 2;
    return {
      key: `an5:iso:${top}`, text: 'משולש שווה־שוקיים. זווית הראש נתונה. מה גודל זווית הבסיס?', form: 'num', answer: base, unit: 'מעלות',
      fig: { type: 'triangle', angles: [base, base, top], show: [false, false, true], iso: true },
      hint: 'במשולש שווה־שוקיים זוויות הבסיס שוות. מה נשאר מ־$180^\\circ$ אחרי זווית הראש? מחלקים לשתיים.',
      solution: [`$180^\\circ - ${deg(top)} = ${deg(180 - top)}$`, `$${180 - top} : 2 = ${deg(base)}$`],
      diag: (u) => (near(u, 180 - top) ? 'forgot-half' : null),
    };
  }
  const a = R(4, 14) * 5; const b = R(4, 14) * 5;
  const ext = a + b;
  return {
    key: `an5:ext:${a}:${b}`, text: 'מה גודל הזווית החיצונית המסומנת ב־$?$', form: 'num', answer: ext, unit: 'מעלות',
    fig: { type: 'triangle', angles: [a, b, 180 - a - b], show: [true, true, false], exterior: true },
    hint: 'זווית חיצונית שווה לסכום שתי הזוויות הפנימיות שלא צמודות לה.',
    solution: [`$${deg(a)} + ${deg(b)} = ${deg(ext)}$`],
    diag: (u) => (near(u, 180 - a - b) ? 'interior-not-exterior' : null),
  };
}

export const GRADE7 = [
  {
    id: 'signed', grade: '7', title: 'מספרים מכוונים', color: 'sky',
    desc: 'חיבור, חיסור, כפל וחילוק, וסדר פעולות',
    levels: [
      { title: 'חיבור וחיסור', gen: () => (Math.random() < 0.5 ? addSubLine() : addSub()) },
      { title: 'השוואת מספרים', gen: () => (Math.random() < 0.4 ? orderPins() : compare()) },
      { title: 'כפל וחילוק', gen: mulDiv },
      { title: 'סדר פעולות', gen: order },
      { title: 'סוגריים', gen: brackets },
    ],
    cats: {
      sign: 'התשובה יצאה עם הסימן ההפוך',
      'abs-add': 'חיברו מרחקים כשהסימנים שונים, במקום לחסר',
      'minus-minus': 'חיסור של מספר שלילי חושב כמו חיסור של חיובי',
      'neg-compare': 'חשבו שמספר שלילי רחוק יותר מאפס הוא גדול יותר (בין שליליים, הגדול הוא הקרוב לאפס)',
      order: 'חישבו משמאל לימין בלי לתת קדימות לכפל',
      'drop-sign': 'התעלמו מהמינוס של המספר הראשון',
      'neg-neg-plus': 'הפכו גם את המספר הראשון לחיובי ("מינוס ומינוס זה פלוס")',
      direction: 'זזו לכיוון ההפוך על ציר המספרים',
    },
  },
  {
    id: 'coord', grade: '7', title: 'מערכת צירים', color: 'fuchsia',
    desc: 'קריאת נקודות, רביעים, אורכים ושטחים',
    levels: [
      { title: 'קריאת נקודה', gen: () => (Math.random() < 0.5 ? plotPoint() : readPoint()) },
      { title: 'רביעים', gen: () => (Math.random() < 0.6 ? plotQuadrant() : quadrant()) },
      { title: 'אורך קטע', gen: segmentLength },
      { title: 'שטח מלבן', gen: rectArea },
      { title: 'קודקוד חסר', gen: () => (Math.random() < 0.5 ? rectVertexPlot() : missingVertex()) },
    ],
    cats: {
      swap: 'החליפו בין $x$ ל־$y$',
      sign: 'טעות בסימן של אחד השיעורים',
      'add-coords': 'לא חישבו מרחק כשהקטע עובר דרך הציר',
      perimeter: 'חישבו היקף במקום שטח',
      'add-sides': 'חיברו את הצלעות במקום לכפול',
    },
  },
  {
    id: 'angles', grade: '7', title: 'זוויות', color: 'petrol',
    desc: 'צמודות, קודקודיות, משולש וישרים מקבילים',
    levels: [
      { title: 'זוויות צמודות', gen: () => (Math.random() < 0.5 ? linearPairTurn() : linearPair()) },
      { title: 'זוויות קודקודיות', gen: vertical },
      { title: 'סכום זוויות במשולש', gen: () => (Math.random() < 0.4 ? rightTriangleDrag() : triangleSum()) },
      { title: 'ישרים מקבילים', gen: parallel },
      { title: 'שווה־שוקיים וזווית חיצונית', gen: isosceles },
    ],
    cats: {
      'equal-not-supp': 'ענו שהזוויות שוות, אבל הן משלימות ל־180°',
      'supp-not-equal': 'השלימו ל־180°, אבל הזוויות שוות',
      'wrong-total': 'השלימו לסכום הלא נכון',
      'sum-360': 'השתמשו ב־360° במקום ב־180°',
      'one-angle': 'החסירו רק זווית אחת',
      'forgot-half': 'שכחו לחלק לשתי זוויות הבסיס',
      'interior-not-exterior': 'חישבו את הזווית הפנימית במקום החיצונית',
    },
  },
];

export { shuffle };
