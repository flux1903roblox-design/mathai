// Ratio, proportion and scale (יחס, פרופורציה וקנה מידה): the first unit of grade 8 (ח׳) in the Ministry's תשפ״ז
// schedule, September to October (curriculum stage 1, CURRICULUM-5). It is the base that percent, slope, similarity
// and probability lean on. Taught from the first week of the school year, so the first-day placement test skips it
// (placement: false): a ח׳ student who learned it in class uses the unit's jump test, and the plan offers ratio:1 as
// the first new stair of a ח׳ student in November (learn/next.ts, taught by now in school order).
//
// One picture carries it: a ratio compares two amounts in the order the question names them, and is kept by
// multiplying (never by adding). m : n is m + n equal parts; a proportion is found through one unit or "פי כמה", on a
// double number line; a scale 1 : S has both sides in the same unit, then converts, and areas grow by S².
//
// The diagnostic models (RATIO1 to RATIO4T) are the plan's (finish/scratch/curriculum/plan/models.mjs), ported
// unchanged: their draws redraw any question where a misconception's prediction looks like a slip of the hand, lies
// within 0.06 of the right answer or of another prediction. The practice generators below use the same draws. The
// numbers and situations of the Ministry's examples (56 marbles, the partners, the pitcher, the pastry, the cereals,
// the museum earth) are facts; every sentence here is the app's own. Errors and their sources:
//   reversed-ratio   the ratio read in the other order (the curriculum's own emphasis on reading a ratio in order;
//                    teacher-reported)
//   part-whole       a part compared with the whole instead of with the other part (Tourniaire & Pulos 1985, ESM 16(2))
//   whole-perimeter  a rectangle's whole perimeter shared in the ratio of its sides (teacher-reported; the perimeter task)
//   additive         the same difference kept instead of the same ratio (Hart 1984; Karplus, Pulos & Stage 1983, ESM 14)
//   divide-flip      the unit rate taken per the other unit (Fischbein et al. 1985)
//   no-convert       a scale used right but the answer left in centimetres, or the metres never turned into centimetres
//   cm-km            the distance converted to kilometres and then written as if it were metres
//   linear-area      an area scaled like a length (De Bock, Verschaffel & Janssens 1998, ESM 35)
//   add-same         the same number added to both terms, as if that kept the ratio (a choice in practice only)
import { shuffle, gcd } from './util.js';
import { diagOf } from './eq.js';
import { mk, r9, fracTex } from './frac.js';

const rnd = () => Math.random();
const rint = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
/** Every prediction of a model for one draw. */
const bugsAt = (model, p) => Object.fromEntries(Object.entries(model.bugs).map(([id, f]) => [id, f(p)]));
/** A number as written in TeX: thousands grouped from 10,000 (50{,}000), decimals as they are (2.5). */
export const big = (v) => (Math.abs(v) >= 10000 && Number.isInteger(v) ? v.toLocaleString('en-US').replace(/,/g, '{,}') : String(r9(v)));
/** A ratio as TeX: 2 : 5. */
export const ratioTex = (a, b) => `${big(a)} : ${big(b)}`;

// ---------------------------------------------------------------- the models' draws (plan/models.mjs, unchanged)

/** ratio:1 — the ratio a : b written as p : □ with p = a / gcd. */
export const RATIO1 = mk({
  raw: (r) => { const a = rint(r, 2, 12); const b = rint(r, 2, 30); const g = gcd(a, b); if (a === b || g < 2 || a / g < 2) return null; return { a, b, g, p: a / g }; },
  answer: ({ b, g }) => b / g,
  bugs: {
    'reversed-ratio': ({ a, b, p }) => (p * a) / b, // the ratio read in the other order (b : a)
    'part-whole': ({ a, b, g }) => (a + b) / g, // a part compared with the total, not with the other part
  },
});
export const RATIO1T = mk({ raw: RATIO1.raw, answer: RATIO1.answer, bugs: RATIO1.bugs });

/** ratio:2 — T shared in the ratio m : n; the first share. */
export const RATIO2 = mk({
  raw: (r) => { const m = rint(r, 1, 9); const n = rint(r, 1, 9); if (m === n || gcd(m, n) !== 1) return null; const k = rint(r, 2, 12); if (k * (m + n) > 200) return null; return { m, n, k, T: k * (m + n) }; },
  answer: ({ m, k }) => k * m,
  bugs: {
    'reversed-ratio': ({ n, k }) => k * n,
    'part-whole': ({ m, n, T }) => (T * m) / n, // m/n of the total, as if the ratio were part to whole
  },
});
/** ratio:2 transfer — a rectangle's perimeter P and sides in the ratio m : n; the long side. */
export const RATIO2T = mk({
  raw: (r) => { const q = RATIO2.raw(r); if (!q) return null; return { ...q, P: 2 * q.T, hi: Math.max(q.m, q.n), lo: Math.min(q.m, q.n) }; },
  answer: ({ k, hi }) => k * hi,
  bugs: {
    'whole-perimeter': ({ k, hi }) => 2 * k * hi, // the perimeter shared, as if it were one long and one short side
    'reversed-ratio': ({ k, lo }) => k * lo,
  },
});

/** ratio:3 — a missing value: b units need a, how much for c units. */
export const RATIO3 = mk({
  raw: (r) => {
    const u = pick(r, [0.25, 0.5, 0.75, 1.2, 1.25, 1.5, 2, 2.5, 3, 4]); const b = rint(r, 2, 12); const c = rint(r, 2, 20);
    if (b === c) return null; const a = u * b; const ans = u * c;
    if (Math.round(a * 2) !== a * 2 || Math.round(ans * 2) !== ans * 2) return null; // whole or a half
    return { u, a, b, c };
  },
  answer: ({ u, c }) => u * c,
  bugs: {
    additive: ({ a, b, c }) => a + (c - b), // the same difference kept instead of the same ratio
    'divide-flip': ({ u, c }) => c / u, // the rate taken per the other unit (b : a instead of a : b)
  },
});
export const RATIO3T = mk({ raw: RATIO3.raw, answer: RATIO3.answer, bugs: RATIO3.bugs });

/** ratio:4 — scale 1 : S: real distance (m) from the map (cm), or map (cm) from the real distance (m). */
export const RATIO4 = mk({
  raw: (r) => {
    const S = pick(r, [1000, 2000, 5000, 10000, 20000, 25000, 50000]); const d = rint(r, 2, 15);
    return r() < 0.6 ? { k: 0, S, d } : { k: 1, S, d, D: (d * S) / 100 };
  },
  answer: (q) => (q.k === 0 ? (q.d * q.S) / 100 : q.d),
  bugs: {
    'no-convert': (q) => (q.k === 0 ? q.d * q.S : q.D / q.S), // centimetres never turned into metres (or back)
    'cm-km': (q) => (q.k === 0 ? (q.d * q.S) / 100000 : null), // the distance in kilometres given as metres
  },
});
/** ratio:4 transfer — a model at 1 : k: how many times larger is an area in reality. */
export const RATIO4T = mk({
  raw: (r) => ({ k: rint(r, 2, 10) }),
  answer: ({ k }) => k * k,
  bugs: { 'linear-area': ({ k }) => k }, // areas scaled like lengths
});

// ---------------------------------------------------------------- shared words (the models' texts and solutions)

/** ratio:1: pencils in a box, or beads on a necklace (the transfer). */
export const ratio1Text = (p, beads = false) => (beads
  ? `במחרוזת $${p.a}$ חרוזים כחולים ו־$${p.b}$ חרוזים אדומים. השלימו: היחס בין מספר הכחולים למספר האדומים הוא $${p.p} : \\square$.`
  : `בקופסה $${p.a}$ עפרונות כחולים ו־$${p.b}$ עפרונות אדומים. השלימו: היחס בין מספר הכחולים למספר האדומים הוא $${p.p} : \\square$.`);
export const ratio1Solution = ({ a, b, g, p }) => [
  `קודם הכחולים, אחר כך האדומים: $${ratioTex(a, b)}$.`,
  `המחלק המשותף הגדול של $${a}$ ו־$${b}$ הוא $${g}$. מחלקים את שני המספרים ב־$${g}$.`,
  `$${ratioTex(a, b)} = ${ratioTex(p, b / g)}$`,
];
export const ratio1Hint = () => 'כתבו את היחס לפי הסדר שבשאלה, ואז חלקו את שני המספרים באותו מספר.';

/** ratio:2: marbles shared between Uri and Dan, the first share. */
export const ratio2Text = ({ m, n, T }) => `חילקו $${T}$ גולות בין אורי לדן ביחס $${ratioTex(m, n)}$ (אורי : דן). כמה גולות קיבל אורי?`;
export const shareSolution = ({ m, n, k, T }, who = 'אורי', what = 'גולות') => [
  `ביחס $${ratioTex(m, n)}$ יש $${m} + ${n} = ${m + n}$ חלקים שווים.`,
  `חלק אחד: $${T} : ${m + n} = ${k}$ ${what}.`,
  `ל${who} $${m}$ חלקים: $${m} \\cdot ${k} = ${m * k}$`,
];
export const shareHint = ({ m, n }) => `כמה חלקים יש ביחס $${ratioTex(m, n)}$? מחלקים את הכמות למספר החלקים, וכופלים.`;
/** ratio:2 transfer: the long side of a rectangle from its perimeter. */
export const rectText = ({ m, n, P }) => `היקף מלבן $${P}$ ס״מ, והיחס בין צלעותיו $${ratioTex(m, n)}$. מה אורך הצלע הארוכה?`;
export const rectSolution = ({ m, n, k, T, hi }) => [
  `צלע ארוכה וצלע קצרה יחד הן חצי היקף: $${2 * T} : 2 = ${T}$.`,
  `ביחס $${ratioTex(m, n)}$ יש $${m + n}$ חלקים, וכל חלק $${T} : ${m + n} = ${k}$ ס״מ.`,
  `הצלע הארוכה $${hi}$ חלקים: $${hi} \\cdot ${k} = ${hi * k}$`,
];
export const rectHint = () => 'בהיקף כל צלע מופיעה פעמיים. מחלקים ביחס את חצי ההיקף.';

/** ratio:3: a recipe (b cakes need a cups of flour), or notebooks and their price (the transfer). */
export const ratio3Text = ({ a, b, c }, price = false) => (price
  ? `$${b}$ מחברות עולות $${big(a)}$ ש״ח. כמה עולות $${c}$ מחברות?`
  : `במתכון, ל־$${b}$ עוגות צריך $${big(a)}$ כוסות קמח. כמה כוסות קמח צריך ל־$${c}$ עוגות?`);
export const ratio3Solution = ({ u, a, b, c }, price = false) => [
  `${price ? 'מחיר מחברת אחת' : 'קמח לעוגה אחת'}: $${big(a)} : ${b} = ${big(u)}$.`,
  `ל־$${c}$ ${price ? 'מחברות' : 'עוגות'}: $${big(u)} \\cdot ${c} = ${big(u * c)}$`,
];
export const ratio3Hint = (_, price = false) => (price ? 'כמה עולה מחברת אחת? אחר כך כופלים במספר המחברות.' : 'כמה קמח לעוגה אחת? אחר כך כופלים במספר העוגות.');

/** ratio:4: a distance on a map and in reality. */
export const ratio4Text = (q) => (q.k === 0
  ? `במפה בקנה מידה $1 : ${big(q.S)}$ המרחק בין שני בתים הוא $${q.d}$ ס״מ. מה המרחק במציאות, במטרים?`
  : `המרחק בין שני בתים הוא $${big(q.D)}$ מטר. מה המרחק במפה בקנה מידה $1 : ${big(q.S)}$, בס״מ?`);
export function ratio4Solution(q) {
  if (q.k === 0) {
    return [
      `כל ס״מ במפה הוא $${big(q.S)}$ ס״מ במציאות: $${q.d} \\cdot ${big(q.S)} = ${big(q.d * q.S)}$ ס״מ.`,
      `במטר $100$ ס״מ: $${big(q.d * q.S)} : 100 = ${big((q.d * q.S) / 100)}$`,
    ];
  }
  return [
    `קודם לסנטימטרים, כמו שני הצדדים של קנה המידה: $${big(q.D)} \\cdot 100 = ${big(q.D * 100)}$ ס״מ.`,
    `כל ס״מ במפה הוא $${big(q.S)}$ ס״מ במציאות: $${big(q.D * 100)} : ${big(q.S)} = ${q.d}$`,
  ];
}
export const ratio4Hint = (q) => (q.k === 0 ? 'כפלו בקנה המידה כדי לקבל סנטימטרים במציאות, ואז המירו למטרים.' : 'המירו קודם את המטרים לסנטימטרים, ואז חלקו בקנה המידה.');
/** ratio:4 transfer: the area of a model and of the real thing. */
export const areaText = ({ k }, what = 'דגם של בית', inIt = 'בדגם') => `${what} בקנה מידה $1 : ${k}$. פי כמה גדול שטח במציאות משטח ${inIt}?`;
export const areaSolution = ({ k }) => [
  `כל אורך במציאות גדול פי $${k}$: גם האורך וגם הרוחב.`,
  `שטח הוא אורך כפול רוחב, ולכן הוא גדל פי $${k} \\cdot ${k} = ${k * k}$`,
];
export const areaHint = () => 'כמה פעמים גדל האורך? וכמה פעמים הרוחב? השטח הוא המכפלה שלהם.';

// ---------------------------------------------------------------- ratio:1 generators

/** The ratio of two amounts completed in lowest terms (the model's own draw): pencils, or beads (as the transfer). */
function ratioOf() {
  const p = RATIO1.params(rnd); const beads = Math.random() < 0.4; const ans = RATIO1.answer(p);
  return {
    key: `ra1:${p.a}:${p.b}`, text: ratio1Text(p, beads), form: 'num', answer: ans,
    hint: ratio1Hint(), solution: ratio1Solution(p), diag: diagOf(ans, bugsAt(RATIO1, p)),
  };
}

const PAIRS = [
  { where: 'בכיתה', x: 'בנות', y: 'בנים', xs: 'הבנות', ys: 'הבנים' },
  { where: 'בשבט', x: 'מדריכים', y: 'חניכים', xs: 'המדריכים', ys: 'החניכים' },
  { where: 'בגינה', x: 'עצים', y: 'שיחים', xs: 'העצים', ys: 'השיחים' },
  { where: 'בחניון', x: 'אופנועים', y: 'מכוניות', xs: 'האופנועים', ys: 'המכוניות' },
];
/**
 * Which ratio is it, the other order from the story: a′ : b′ is the order of the story (reversed-ratio), b′ : (a′ + b′)
 * a part against everyone (part-whole). Three choices, so practice only.
 */
function ratioMc() {
  for (;;) {
    const a = rint(rnd, 2, 15); const b = rint(rnd, 2, 30); if (a === b) continue;
    const g = gcd(a, b); const x = a / g; const y = b / g;
    const P = pick(rnd, PAIRS);
    const right = ratioTex(y, x);
    const options = shuffle([
      { tex: right, ok: true },
      { tex: ratioTex(x, y), ok: false, bug: 'reversed-ratio' },
      { tex: ratioTex(y, x + y), ok: false, bug: 'part-whole' },
    ]);
    return {
      key: `ra1m:${a}:${b}:${PAIRS.indexOf(P)}`, text: `${P.where} $${a}$ ${P.x} ו־$${b}$ ${P.y}. מה היחס בין מספר ${P.ys} למספר ${P.xs}?`,
      form: 'mc', choices: options, answer: options.findIndex((c) => c.ok), practiceOnly: true,
      hint: `השאלה מתחילה ב${P.ys}: הם הראשונים ביחס. אחר כך מצמצמים.`,
      solution: [`קודם ${P.ys}, אחר כך ${P.xs}: $${ratioTex(b, a)}$.`, ...(g > 1 ? [`מצמצמים ב־$${g}$: $${ratioTex(b, a)} = ${right}$`] : [`$${a}$ ו־$${b}$ לא מתחלקים יחד, והיחס כבר מצומצם.`])],
      diag: (u) => options[u]?.bug || null,
    };
  }
}

/**
 * The legs p and q of a right triangle both grow by k: does their ratio change? Always yes, because p ≠ q (with equal
 * legs the ratio stays 1 : 1, the curriculum's own exception). Two choices, so practice only.
 */
function addSame() {
  for (;;) {
    const p = rint(rnd, 2, 12); const q = rint(rnd, 2, 12); const k = rint(rnd, 1, 6);
    if (p === q) continue;
    const g1 = gcd(p, q); const g2 = gcd(p + k, q + k);
    const options = shuffle([{ text: 'כן, היחס משתנה', ok: true }, { text: 'לא, הוספנו לשניהם אותו דבר', ok: false, bug: 'add-same' }]);
    return {
      key: `ra1a:${p}:${q}:${k}`, text: `במשולש ישר־זווית הניצבים $${p}$ ו־$${q}$. מאריכים כל ניצב ב־$${k}$. היחס בין הניצבים משתנה?`,
      form: 'mc', choices: options, answer: options.findIndex((c) => c.ok), practiceOnly: true,
      hint: 'כתבו את היחס לפני ואחרי, וצמצמו את שניהם.',
      solution: [`לפני: $${ratioTex(p, q)}${g1 > 1 ? ` = ${ratioTex(p / g1, q / g1)}` : ''}$. אחרי: $${ratioTex(p + k, q + k)}${g2 > 1 ? ` = ${ratioTex((p + k) / g2, (q + k) / g2)}` : ''}$.`, 'שני יחסים שונים: הוספה שומרת על ההפרש, לא על היחס.'],
      diag: (u) => options[u]?.bug || null,
    };
  }
}

/** Colour beads red so that red : blue is a : b, on a necklace of n beads (the bar's parts are locked): practice only. */
function beads() {
  for (;;) {
    const a = rint(rnd, 1, 5); const b = rint(rnd, 1, 6); if (a === b || gcd(a, b) !== 1) continue;
    const m = rint(rnd, 2, 4); const n = (a + b) * m; if (n > 24) continue;
    return {
      key: `ra1b:${n}:${a}:${b}`, text: `במחרוזת $${n}$ חרוזים. צבעו אדומים כך שהיחס בין האדומים לכחולים יהיה $${ratioTex(a, b)}$.`,
      form: 'manip', practiceOnly: true,
      manip: { kind: 'fbar', start: { den: n, shaded: 0 }, lockDen: true }, answer: { mode: 'value', value: a / (a + b) },
      hint: `$${ratioTex(a, b)}$: מכל $${a + b}$ חרוזים, $${a}$ אדומים. כמה קבוצות של $${a + b}$ יש ב־$${n}$?`,
      solution: [`$${n} : ${a + b} = ${m}$ קבוצות של $${a + b}$ חרוזים.`, `בכל קבוצה $${a}$ אדומים: $${a} \\cdot ${m} = ${a * m}$ אדומים ו־$${b * m}$ כחולים.`, `$${ratioTex(a * m, b * m)} = ${ratioTex(a, b)}$`],
      diag: () => null,
    };
  }
}

// ---------------------------------------------------------------- ratio:2 generators

const SHARES = [
  { who: ['אורי', 'דן'], what: 'גולות', verb: 'קיבל' },
  { who: ['נועה', 'תמר'], what: 'מדבקות', verb: 'קיבלה' },
  { who: ['מאיה', 'עידו'], what: 'קלפים', verb: 'קיבלה' },
];
/** T shared in the ratio m : n (the model's own draw): the first one's share. */
function share() {
  const p = RATIO2.params(rnd); const s = pick(rnd, SHARES); const ans = RATIO2.answer(p);
  const [A, B] = s.who;
  return {
    key: `ra2s:${p.m}:${p.n}:${p.T}`, text: `חילקו $${p.T}$ ${s.what} בין ${A} ל${B} ביחס $${ratioTex(p.m, p.n)}$ (${A} : ${B}). כמה ${s.what} ${s.verb} ${A}?`,
    form: 'num', answer: ans, hint: shareHint(p), solution: shareSolution(p, A, s.what), diag: diagOf(ans, bugsAt(RATIO2, p)),
  };
}

/** A rectangle's perimeter shared by the ratio of its sides (the transfer model's own draw): the long side. */
function rect() {
  const p = RATIO2T.params(rnd); const ans = RATIO2T.answer(p);
  return {
    key: `ra2r:${p.m}:${p.n}:${p.P}`, text: rectText(p), form: 'num', answer: ans,
    hint: rectHint(), solution: rectSolution(p), diag: diagOf(ans, bugsAt(RATIO2T, p)),
  };
}

/** Two partners share a profit by what each invested (x·m and x·n thousand ₪); the first one's share. */
const PROFIT = mk({
  raw: (r) => {
    const m = rint(r, 1, 5); const n = rint(r, 1, 5); if (m === n || gcd(m, n) !== 1) return null;
    const x = rint(r, 1, 4); const u = 100 * rint(r, 1, 12);
    return { m, n, X: 1000 * x * m, Y: 1000 * x * n, P: u * (m + n), u };
  },
  answer: ({ m, u }) => m * u,
  bugs: {
    'reversed-ratio': ({ n, u }) => n * u,
    'part-whole': ({ m, n, P }) => (P * m) / n,
  },
});
function profit() {
  const p = PROFIT.params(rnd); const ans = PROFIT.answer(p); const g = gcd(p.X, p.Y);
  return {
    key: `ra2p:${p.X}:${p.Y}:${p.P}`, text: `שני שותפים פתחו עסק. הראשון השקיע $${big(p.X)}$ ש״ח והשני $${big(p.Y)}$ ש״ח. רווח של $${big(p.P)}$ ש״ח מתחלק לפי ההשקעות. כמה מקבל הראשון?`,
    form: 'num', answer: ans,
    hint: 'כתבו את יחס ההשקעות וצמצמו. אחר כך מחלקים את הרווח לפי החלקים.',
    solution: [`יחס ההשקעות: $${ratioTex(p.X, p.Y)} = ${ratioTex(p.X / g, p.Y / g)}$, כלומר $${p.m + p.n}$ חלקים.`, `חלק אחד: $${big(p.P)} : ${p.m + p.n} = ${big(p.u)}$ ש״ח.`, `לראשון $${p.m}$ חלקים: $${p.m} \\cdot ${big(p.u)} = ${big(ans)}$`],
    diag: diagOf(ans, bugsAt(PROFIT, p)),
  };
}

/**
 * Marbles shared in the ratio m : n: what part of all of them is Uri's? m/(m + n); m/n is Uri against Dan (part-whole),
 * n/(m + n) is Dan's part (reversed-ratio). Three choices, so practice only.
 */
function statements() {
  for (;;) {
    // m < n, so the wrong m/n is a part smaller than the whole too (as in the 56 marbles, 2 : 5), never a whole number
    const m = rint(rnd, 1, 6); const n = rint(rnd, m + 1, 9); if (gcd(m, n) !== 1) continue;
    const k = rint(rnd, 2, 8);
    const options = shuffle([
      { tex: fracTex(m, m + n), ok: true },
      { tex: fracTex(m, n), ok: false, bug: 'part-whole' },
      { tex: fracTex(n, m + n), ok: false, bug: 'reversed-ratio' },
    ]);
    return {
      key: `ra2t:${m}:${n}:${k * (m + n)}`, text: `אורי ודן חילקו ביניהם $${k * (m + n)}$ גולות ביחס $${ratioTex(m, n)}$ (אורי : דן). איזה חלק מכל הגולות קיבל אורי?`,
      form: 'mc', choices: options, answer: options.findIndex((c) => c.ok), practiceOnly: true,
      hint: `ביחס $${ratioTex(m, n)}$ יש $${m + n}$ חלקים שווים. כמה מהם של אורי?`,
      solution: [`$${m} + ${n} = ${m + n}$ חלקים, ומהם $${m}$ של אורי: $${fracTex(m, m + n)}$ מכל הגולות.`, `$${fracTex(m, n)}$ משווה את אורי לדן, לא לכל הגולות.`],
      diag: (u) => options[u]?.bug || null,
    };
  }
}

// ---------------------------------------------------------------- ratio:3 generators

/** A missing value (the model's own draw): a recipe, or notebooks and their price (as the transfer). */
function missing() {
  const p = RATIO3.params(rnd); const price = Math.random() < 0.5; const ans = RATIO3.answer(p);
  return {
    key: `ra3m:${p.b}:${p.a}:${p.c}`, text: ratio3Text(p, price), form: 'num', answer: ans, ...(Number.isInteger(ans) ? {} : { precise: true, fmt: 'dec' }),
    hint: ratio3Hint(p, price), solution: ratio3Solution(p, price), diag: diagOf(ans, bugsAt(RATIO3, p)),
  };
}

/**
 * "y is proportional to x": a table of three rows with the last y missing. The additive mistake keeps the difference
 * from the row above (y₂ + (x₃ − x₂)); its draw is redrawn when that looks like a slip or lies near the answer.
 */
const TABLE = mk({
  raw: (r) => {
    const u = pick(r, [0.5, 1.5, 2, 2.5, 3, 4, 5]); const x1 = rint(r, 1, 4); const x2 = x1 + rint(r, 1, 4); const x3 = x2 + rint(r, 2, 6);
    const ys = [x1, x2, x3].map((x) => u * x);
    if (ys.some((y) => Math.round(y * 2) !== y * 2)) return null;
    if ([x1, x2, x3, ys[0], ys[1]].includes(ys[2])) return null; // the answer is never a number of the table
    return { u, x1, x2, x3, y1: ys[0], y2: ys[1] };
  },
  answer: ({ u, x3 }) => u * x3,
  bugs: { additive: ({ x2, x3, y2 }) => y2 + (x3 - x2) },
});
function table() {
  const p = TABLE.params(rnd); const ans = TABLE.answer(p);
  return {
    key: `ra3t:${p.x1},${p.y1};${p.x2},${p.y2};${p.x3}`, text: 'בטבלה, $y$ פרופורציונלי ל־$x$. מה הערך החסר?',
    fig: { type: 'table', head: ['x', 'y'], rows: [[p.x1, p.y1], [p.x2, p.y2], [p.x3, '?']] },
    form: 'num', answer: ans, ...(Number.isInteger(ans) ? {} : { precise: true, fmt: 'dec' }),
    hint: 'בפרופורציה $y$ הוא $x$ כפול מספר קבוע. מה המספר הזה בשורה הראשונה?',
    solution: [`$y : x$ קבוע: $${big(p.y1)} : ${p.x1} = ${big(p.u)}$.`, `ולכן $y = ${big(p.u)} \\cdot ${p.x3} = ${big(ans)}$`],
    diag: diagOf(ans, bugsAt(TABLE, p)),
  };
}

const GOODS = [['דגנים', 'גרם'], ['אורז', 'גרם'], ['גבינה', 'גרם']];
/**
 * Three packs of one food, weight and price: two at one price per 100 g, one off (its price rose by the same amount as
 * the weight, the additive way). Which is not in the same ratio? Three choices, so practice only.
 */
function isProp() {
  for (;;) {
    const r100 = pick(rnd, [2, 3, 4, 5, 6, 8]); // ₪ per 100 g
    const ws = shuffle([100, 200, 250, 300, 400, 500]).slice(0, 3).sort((x, y) => x - y);
    const odd = rint(rnd, 0, 2); const dp = pick(rnd, [1, 2, 3]);
    const prices = ws.map((w, i) => (w * r100) / 100 + (i === odd ? dp : 0));
    if (prices.some((v) => !Number.isInteger(v))) continue;
    const [food, unit] = pick(rnd, GOODS); const names = ['א', 'ב', 'ג'];
    const choices = names.map((n, i) => ({ text: `אריזה ${n}`, ok: i === odd }));
    return {
      key: `ra3p:${ws.join(',')}:${prices.join(',')}`, text: `שלוש אריזות של ${food}. באיזו אריזה היחס בין המחיר למשקל שונה משתי האחרות?`,
      fig: { type: 'table', head: ['אריזה', `משקל (${unit})`, 'מחיר (ש״ח)'], rows: names.map((n, i) => [n, ws[i], prices[i]]) },
      form: 'mc', choices, answer: odd, practiceOnly: true,
      hint: 'חשבו לכל אריזה כמה עולים $100$ גרם, והשוו.',
      solution: [`ב־$100$ גרם: ${names.map((n, i) => `${n}: $${big((prices[i] * 100) / ws[i])}$`).join(', ')} ש״ח.`, `באריזה ${names[odd]} המנה שונה: היא לא באותו יחס.`],
      diag: () => null,
    };
  }
}

const MIXES = [{ w: 4, s: 1, top: 8, every: 4 }, { w: 2, s: 1, top: 8, every: 2 }, { w: 5, s: 2, top: 10, every: 5 }];
/**
 * The pitcher on a double number line: water cups above, sugar below. How much water goes with s cups of sugar? The
 * student moves the marker until the sugar is s (the target is named on the bottom line): practice only.
 */
function dlineMix() {
  for (;;) {
    const { w, s, top, every } = pick(rnd, MIXES); const bottom = (top * s) / w;
    const t = rint(rnd, 1, top - 1); const sugar = r9((t * s) / w);
    if (Math.abs(Math.round(sugar * 100) - sugar * 100) > 1e-9) continue;
    return {
      key: `ra3l:${w}:${s}:${t}`, text: `במשקה $${w}$ כוסות מים לכל $${s}$ ${s === 1 ? 'כוס' : 'כוסות'} סוכר. כמה כוסות מים צריך עם $${big(sugar)}$ כוסות סוכר? הזיזו את הסמן.`,
      form: 'manip', practiceOnly: true,
      manip: { kind: 'dline', top: { max: top, step: 1, label: 'מים (כוסות)' }, bottom: { max: bottom, step: s / w, label: 'סוכר (כוסות)', every }, move: 't', start: { t: 0 } },
      answer: t,
      hint: `כל כוס מים היא $${big(s / w)}$ כוס סוכר. מזיזים עד שמתחת לסמן יש $${big(sugar)}$.`,
      solution: [`לכל כוס מים $${big(s / w)}$ כוס סוכר.`, `$${big(sugar)} : ${big(s / w)} = ${t}$ כוסות מים.`],
      diag: () => null,
    };
  }
}

// ---------------------------------------------------------------- ratio:4 generators

/** A distance from the map to reality (k 0) or back (k 1): the model's own draw of that direction. */
function mapItem(k) {
  let q; do { q = RATIO4.params(rnd); } while (q.k !== k);
  const ans = RATIO4.answer(q);
  return {
    key: k === 0 ? `ra4r:${q.S}:${q.d}` : `ra4m:${q.S}:${q.D}`, text: ratio4Text(q), form: 'num', answer: ans,
    hint: ratio4Hint(q), solution: ratio4Solution(q), diag: diagOf(ans, bugsAt(RATIO4, q)),
  };
}

/** The scale from a distance on the map (cm) and in reality (km): 1 : □. Left in km per cm it is no-convert. */
function findScale() {
  for (;;) {
    const S = pick(rnd, [10000, 20000, 25000, 50000, 100000, 200000]); const D = rint(rnd, 1, 30);
    const d = (D * 100000) / S;
    if (!Number.isInteger(d) || d < 2 || d > 15) continue;
    return {
      key: `ra4f:${d}:${D}`, text: `$${d}$ ס״מ במפה הם $${D}$ ק״מ במציאות. השלימו: קנה המידה הוא $1 : \\square$.`, form: 'num', answer: S,
      hint: 'בקנה מידה שני הצדדים באותה יחידה: המירו את הקילומטרים לסנטימטרים.',
      solution: [`$${D}$ ק״מ הם $${big(D * 1000)}$ מטר, כלומר $${big(D * 100000)}$ ס״מ.`, `$${big(D * 100000)} : ${d} = ${big(S)}$: כל ס״מ במפה הוא $${big(S)}$ ס״מ במציאות.`, `קנה המידה $1 : ${big(S)}$`],
      diag: diagOf(S, { 'no-convert': D / d }),
    };
  }
}

const MODELS_OF = [['דגם של בית', 'בדגם'], ['תוכנית של דירה', 'בתוכנית'], ['דגם של גשר', 'בדגם']];
/** The area of the real thing against its model at 1 : k (the transfer model's own draw). */
function area() {
  const p = RATIO4T.params(rnd); const [what, inIt] = pick(rnd, MODELS_OF); const ans = RATIO4T.answer(p);
  return {
    key: `ra4a:${p.k}`, text: areaText(p, what, inIt),
    form: 'num', answer: ans, hint: areaHint(), solution: areaSolution(p), diag: diagOf(ans, bugsAt(RATIO4T, p)),
  };
}

/**
 * A scale bar on a double number line: centimetres on the map above, kilometres below. How many centimetres are R km?
 * The student moves the marker until R is under it (the target is named): practice only.
 */
function scaleBar() {
  const B = pick(rnd, [5, 10, 20]); const t = rint(rnd, 1, 9); const R = (t * B) / 10;
  return {
    key: `ra4b:${B}:${t}`, text: `על המפה סרגל קנה מידה: $10$ ס״מ במפה הם $${B}$ ק״מ במציאות. כמה ס״מ במפה הם $${big(R)}$ ק״מ? הזיזו את הסמן.`,
    form: 'manip', practiceOnly: true,
    manip: { kind: 'dline', top: { max: 10, step: 1, unit: 'ס״מ', label: 'במפה (ס״מ)' }, bottom: { max: B, step: B / 10, unit: 'ק״מ', label: 'במציאות (ק״מ)', every: 2 }, move: 't', start: { t: 0 } },
    answer: t,
    hint: `כל ס״מ במפה הוא $${big(B / 10)}$ ק״מ.`,
    solution: [`ס״מ אחד במפה: $${B} : 10 = ${big(B / 10)}$ ק״מ.`, `$${big(R)} : ${big(B / 10)} = ${t}$ ס״מ.`],
    diag: () => null,
  };
}

// ---------------------------------------------------------------- the topic

export const RATIO = {
  id: 'ratio', grade: '8', title: 'יחס וקנה מידה', color: 'sky',
  desc: 'יחס בין כמויות, חלוקה ביחס, פרופורציה וקנה מידה',
  // taught from the first week of ח׳: the first-day placement test does not ask about it (the jump test does)
  placement: false,
  levels: [
    { title: 'יחס', gen: () => { const r = Math.random(); return r < 0.45 ? ratioOf() : r < 0.7 ? ratioMc() : r < 0.85 ? addSame() : beads(); } },
    { title: 'חלוקה ביחס', gen: () => { const r = Math.random(); return r < 0.5 ? share() : r < 0.75 ? rect() : r < 0.9 ? profit() : statements(); } },
    { title: 'פרופורציה', gen: () => { const r = Math.random(); return r < 0.5 ? missing() : r < 0.75 ? table() : r < 0.9 ? isProp() : dlineMix(); } },
    { title: 'קנה מידה', gen: () => { const r = Math.random(); return r < 0.4 ? mapItem(0) : r < 0.6 ? mapItem(1) : r < 0.75 ? findScale() : r < 0.9 ? area() : scaleBar(); } },
  ],
  cats: {
    'reversed-ratio': 'קראו את היחס בסדר ההפוך',
    'part-whole': 'השוו חלק לכל הכמות במקום לחלק השני',
    'whole-perimeter': 'חילקו את כל ההיקף ביחס, כאילו הוא צלע ארוכה וצלע קצרה',
    additive: 'שמרו על אותו הפרש במקום על אותו יחס',
    'divide-flip': 'חילקו הפוך כשמצאו כמה ליחידה',
    'no-convert': 'שכחו להמיר בין סנטימטרים למטרים',
    'cm-km': 'המירו לקילומטרים וכתבו כאילו אלה מטרים',
    'linear-area': 'חשבו שהשטח גדל פי אותו מספר כמו האורכים',
    'add-same': 'חשבו שהוספה של אותו מספר לשני חלקי היחס שומרת עליו',
  },
  lesson: {
    points: [
      'יחס נקרא משמאל לימין: $2 : 5$ הוא "שתיים לחמש".',
      'צמצום לא משנה יחס: $2 : 10 = 1 : 5$.',
      'חלוקה ביחס $2 : 5$: שבעה חלקים שווים. מ־$56$ כל חלק $8$, ולכן $16$ ו־$40$.',
      'פרופורציה: $4$ כוסות מים ל־$1$ סוכר, ולכן ל־$3$ כוסות מים $\\frac{3}{4}$ סוכר.',
      'קנה מידה $1 : 50{,}000$: כל ס״מ במפה הוא $500$ מטר.',
      'כשהאורכים גדלים פי $3$, השטח גדל פי $9$.',
    ],
    words: ['יחס', '"a ל־b"', 'יחס מצומצם', 'הרחבה וצמצום של יחס', 'חלוקה ביחס', 'פרופורציה', 'יחס ישר', 'ליחידה אחת', 'קנה מידה', 'הגדלה והקטנה', 'המרת יחידות'],
  },
};
