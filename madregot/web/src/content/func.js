// Introduction to functions (מבוא לפונקציות): unit 8.7 of grade 8 (ח׳), November in the Ministry's תשפ״ז schedule, in
// the order of the Ministry's updated ח׳ algebra curriculum (algebra_8): reading a graph of a situation first (its first
// subject, and all of ז׳ 7.9's "קריאת גרף שמתאר מצב"), then the function and its representations, increasing and
// decreasing, and rate (stage5.md FUNC-2). This file holds the stairs built so far: func:1, reading a situation graph,
// and func:2, the function and its representations.
// Taught in November, so the first-day placement test skips it (placement: false); a ח׳ student who learned it in class
// uses the unit's jump test.
//
// One picture carries func:1: a graph of a situation is a story told point by point. Each point is a pair, a moment
// (x) and what was true then (y). It is read both ways (from x to y: what was it then; from y to x: when was it so),
// each square is worth the axis's step (the axes write a number on every second line, as the Ministry's own
// "מהו משך הזמן של כל משבצת?" asks), a flat part means the value did not change, and a duration is a difference.
//
// The diagnostic models (FUNC1, FUNC1T) are the spec's (scratchpad/lanes/stage5/spec/models.mjs), ported unchanged
// with its own draw rule: a draw is redrawn when a prediction looks like a slip of the hand, lies within 0.06 of the
// answer or of another prediction, or when the answer is a number of the question's text. Numbers that only the drawing
// shows are measured by the guessing test instead (§0.4 decision 5). Errors and their sources:
//   count-squares     counted the squares and did not multiply by the step of the axis (Kerslake 1981; the Ministry's
//                     own "מהו משך הזמן של כל משבצת?", algebra_8 p. 4-5)
//   end-for-duration  answered the moment it ended instead of how long it lasted (Leinhardt, Zaslavsky & Stein 1990,
//                     interval/point confusion; RAMA 2024 grade-8 item 5 asks "למשך כמה זמן")
//   value-not-change  answered the value at the end instead of how much it changed (Clement 1989, "height for
//                     difference in height")
//   graph-picture     read the graph as a picture of the way (Leinhardt et al. 1990; Bell & Janvier 1981; Clement 1989):
//                     a choice in practice only
import { shuffle } from './util.js';
import { diagOf } from './eq.js';
import { slipLike } from '@/learn/misconceptions.ts';

const rnd = () => Math.random();
const rint = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const same = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
/** Every prediction of a model for one draw. */
const bugsAt = (model, p) => Object.fromEntries(Object.entries(model.bugs).map(([id, f]) => [id, f(p)]));

// ---------------------------------------------------------------- the models' draws (spec models.mjs, unchanged)

/** The numbers a guesser can copy from the text (the answer must not be one of them). */
const guessable = (ans, printed) => printed.some((n) => same(ans, n));
/**
 * A draw is clean: no prediction looks like a slip, a rounded answer or another prediction, and the answer is not a
 * number of the question's text. Numbers that only a drawing shows (a graph's points) are not redrawn.
 */
export function clean(model, p) {
  const ans = model.answer(p);
  if (!Number.isFinite(ans)) return false;
  const vals = [];
  for (const f of Object.values(model.bugs)) {
    const v = f(p);
    if (v == null) continue;
    if (!Number.isFinite(v)) return false;
    if (same(v, ans)) continue;
    if (slipLike(v, ans)) return false;
    if (Math.abs(v - ans) <= 0.06) return false;
    vals.push(v);
  }
  for (let i = 0; i < vals.length; i += 1) for (let j = i + 1; j < vals.length; j += 1) {
    const d = Math.abs(vals[i] - vals[j]);
    if (d > 1e-9 && d <= 0.06) return false;
  }
  return !(model.textNums && guessable(ans, model.textNums(p)));
}
const mk = (m) => { m.params = (r) => { for (let g = 0; g < 100000; g += 1) { const p = m.raw(r); if (p && clean(m, p)) return p; } throw new Error('no clean draw'); }; return m; };

/**
 * func:1 — a walk: home → (t1, d1) → a rest until t2 → home at t3. q0 the distance halfway out (on a grid line); q1 how
 * long the rest lasted; q2 how long the way back took. Axis steps: x 2, 5 or 10 minutes a square, y 50, 100 or 200
 * metres. a, b, c, e are the walk in squares (out, up, the rest, back).
 */
const walk = (r) => {
  const sx = pick(r, [2, 5, 10]); const sy = pick(r, [50, 100, 200]);
  const a = pick(r, [2, 4, 6]); const b = pick(r, [2, 4, 6, 8]);
  const c = rint(r, 1, 6); const e = rint(r, 2, 7);
  const t1 = a * sx; const d1 = b * sy; const t2 = t1 + c * sx; const t3 = t2 + e * sx;
  if (t3 > 12 * sx || d1 > 8 * sy) return null;
  return { sx, sy, a, b, c, e, t1, d1, t2, t3, pts: [[0, 0], [t1, d1], [t2, d1], [t3, 0]] };
};
export const FUNC1 = mk({
  raw: (r) => { const w = walk(r); if (!w) return null; return { ...w, q: rint(r, 0, 2) }; },
  answer: (p) => [p.d1 / 2, p.t2 - p.t1, p.t3 - p.t2][p.q],
  bugs: {
    // counted the squares and did not multiply by the scale
    'count-squares': (p) => [p.d1 / 2 / p.sy, p.c, p.e][p.q],
    // answered the moment it ended instead of how long it lasted
    'end-for-duration': (p) => [null, p.t2, p.t3][p.q],
  },
  textNums: (p) => (p.q === 0 ? [p.t1 / 2] : []),
});

/** func:1 transfer: a day's temperature, a point every 2 hours from 6:00 to 20:00 (a dot graph, ז׳ 7.9). */
const dayTemps = (r) => {
  const k = rint(r, 3, 5); const t = [rint(r, 5, 8) * 2];
  for (let i = 1; i <= 7; i += 1) t.push(t[i - 1] + (i <= k ? rint(r, 1, 4) : -rint(r, 1, 4)));
  if (t.some((v) => v < 0 || v > 40)) return null;
  return { k, temps: t, hours: [6, 8, 10, 12, 14, 16, 18, 20] };
};
export const FUNC1T = mk({
  raw: (r) => {
    const d = dayTemps(r); if (!d) return null;
    if (r() < 0.5) { const i = rint(r, 0, d.k - 1); const j = rint(r, i + 1, d.k); return { ...d, q: 0, i, j }; }
    // a value reached once on the way up and once on the way down
    const pairs = []; for (let i = 0; i < d.k; i += 1) for (let j = d.k + 1; j < 8; j += 1) if (d.temps[i] === d.temps[j]) pairs.push([i, j]);
    if (!pairs.length) return null; const [i, j] = pick(r, pairs); return { ...d, q: 1, i, j };
  },
  answer: (p) => (p.q === 0 ? p.temps[p.j] - p.temps[p.i] : p.hours[p.j] - p.hours[p.i]),
  bugs: {
    'value-not-change': (p) => (p.q === 0 ? p.temps[p.j] : null), // the value at the end, not the change
    'count-squares': (p) => (p.q === 0 ? null : (p.hours[p.j] - p.hours[p.i]) / 2), // squares of 2 hours counted as hours
    'end-for-duration': (p) => (p.q === 1 ? p.hours[p.j] : null),
  },
  textNums: (p) => (p.q === 0 ? [p.hours[p.i], p.hours[p.j]] : [p.temps[p.i]]),
});

// ---------------------------------------------------------------- shared words and drawings

/** The people of the stories, each with the verb forms the sentence needs. */
export const WALKERS = [
  { name: 'נועה', f: true }, { name: 'דני', f: false }, { name: 'מאיה', f: true },
  { name: 'אורי', f: false }, { name: 'תמר', f: true }, { name: 'יואב', f: false },
];
/** The masculine or the feminine form, for the walker. */
const g = (w, m, f) => (w.f ? f : m);
/** The walker of a walk: the same draw always tells the story of the same person. */
export const walkerOf = (p) => WALKERS[(p.t1 + p.d1 + p.t3) % WALKERS.length];

const TIME = (max, step) => ({ max, step, label: 'זמן', unit: 'דקות', every: 2 });
const AWAY = (max, step) => ({ max, step, label: 'מרחק מהבית', unit: 'מטרים', every: 2 });
/**
 * The walk as a situation graph: x in minutes and y in metres from home, a number on every second grid line (so a value
 * on an unlabelled line is read by the scale, as the Ministry's "כמה שווה משבצת" asks). The x axis ends on a numbered
 * line at or after the walk's end, the y axis two squares above its farthest point.
 */
export function walkFig(p, extra = {}) {
  const M = 2 * Math.ceil(p.t3 / p.sx / 2);
  return { type: 'sgraph', x: TIME(M * p.sx, p.sx), y: AWAY((p.d1 / p.sy + 2) * p.sy, p.sy), series: [{ pts: p.pts }], ...extra };
}

/** func:1: the walk's story and the question. */
export function func1Text(p, w = walkerOf(p)) {
  // short, so the graph keeps its room on a 320×568 phone (the question sits above it)
  const story = `הגרף מראה את המרחק של ${w.name} מהבית בטיול: ${g(w, 'הלך', 'הלכה')}, ${g(w, 'עצר', 'עצרה')} לנוח ו${g(w, 'חזר', 'חזרה')}.`;
  const ask = [
    `כמה מטרים מהבית ${g(w, 'היה', 'הייתה')} ${w.name} אחרי $${p.t1 / 2}$ דקות?`,
    `כמה דקות ${g(w, 'עמד', 'עמדה')} ${w.name} במקום?`,
    'כמה דקות נמשכה הדרך חזרה?',
  ][p.q];
  return `${story} ${ask}`;
}
export function func1Solution(p, w = walkerOf(p)) {
  if (p.q === 0) {
    const k = p.d1 / 2 / p.sy;
    return [
      `עולים מ־$${p.t1 / 2}$ על ציר $x$ עד הגרף, ופונים לציר $y$.`,
      `כל משבצת לגובה היא $${p.sy}$ מטרים, והגרף שם $${k}$ ${k === 1 ? 'משבצת' : 'משבצות'} מעל הציר: $${k} \\cdot ${p.sy} = ${p.d1 / 2}$`,
    ];
  }
  if (p.q === 1) {
    return [
      `${w.name} ${g(w, 'עמד', 'עמדה')} במקום כשהקו שטוח: מהדקה ה־$${p.t1}$ עד הדקה ה־$${p.t2}$ (כל משבצת לרוחב היא $${p.sx}$ דקות).`,
      `משך זמן הוא הפרש: $${p.t2} - ${p.t1} = ${p.t2 - p.t1}$`,
    ];
  }
  return [
    `הדרך חזרה מתחילה כשהקו מתחיל לרדת, בדקה ה־$${p.t2}$, ונגמרת בבית, בדקה ה־$${p.t3}$ (כל משבצת לרוחב היא $${p.sx}$ דקות).`,
    `משך זמן הוא הפרש: $${p.t3} - ${p.t2} = ${p.t3 - p.t2}$`,
  ];
}
export const func1Hint = (p) => (p.q === 0
  ? `מצאו את $${p.t1 / 2}$ על ציר $x$ ועלו עד הגרף. כמה מטרים שווה כל משבצת לגובה?`
  : 'משך זמן הוא הפרש בין שני רגעים. כמה דקות שווה כל משבצת לרוחב?');

/** The day's temperatures as a dot graph: the hours every 2 (a number every 4), the degrees on lines a degree apart. */
export function dayFig(p) {
  const lo = 2 * Math.floor((Math.min(...p.temps) - 1) / 2); const hiT = 2 * Math.ceil((Math.max(...p.temps) + 1) / 2);
  const every = hiT - lo <= 20 ? 2 : 4;
  const hi = lo + every * Math.ceil((hiT - lo) / every);
  return {
    type: 'sgraph', x: { min: 6, max: 20, step: 2, label: 'שעה', every: 2 }, y: { min: lo, max: hi, step: 1, label: 'טמפרטורה', unit: 'מעלות', every },
    series: [{ pts: p.hours.map((h, i) => [h, p.temps[i]]), dots: true }],
  };
}
export function func1TText(p) {
  const intro = 'הגרף מראה את הטמפרטורה ביום אחד, נקודה בכל שעתיים.';
  return p.q === 0
    ? `${intro} בכמה מעלות היא עלתה מהשעה $${p.hours[p.i]}$ עד השעה $${p.hours[p.j]}$?`
    : `${intro} היא הייתה $${p.temps[p.i]}^\\circ$ פעמיים. כמה שעות עברו ביניהן?`;
}
export function func1TSolution(p) {
  const [hi, hj] = [p.hours[p.i], p.hours[p.j]]; const [Ti, Tj] = [p.temps[p.i], p.temps[p.j]];
  if (p.q === 0) return [`בשעה $${hi}$ היו $${Ti}^\\circ$, ובשעה $${hj}$ היו $${Tj}^\\circ$.`, `העלייה היא ההפרש: $${Tj} - ${Ti} = ${Tj - Ti}$`];
  return [`שתי הנקודות בגובה $${Ti}$ הן בשעה $${hi}$ ובשעה $${hj}$ (כל משבצת לרוחב היא שעתיים).`, `הזמן ביניהן הוא ההפרש: $${hj} - ${hi} = ${hj - hi}$`];
}
export const func1THint = (p) => (p.q === 0
  ? 'מצאו את שתי הנקודות וקראו את הגובה של כל אחת. העלייה היא ההפרש ביניהם.'
  : `מצאו את שתי הנקודות בגובה $${p.temps[p.i]}$, וקראו את השעה של כל אחת על ציר $x$.`);

// ---------------------------------------------------------------- func:1 generators

/** The walk (the model's own draw): the distance halfway out, the rest, or the way back. */
function walkItem() {
  const p = FUNC1.params(rnd); const ans = FUNC1.answer(p);
  return {
    key: `fu1:${p.sx}:${p.sy}:${p.t1}:${p.d1}:${p.t2}:${p.t3}:${p.q}`, text: func1Text(p), fig: walkFig(p),
    form: 'num', answer: ans, unit: p.q === 0 ? 'מטרים' : 'דקות',
    hint: func1Hint(p), solution: func1Solution(p), diag: diagOf(ans, bugsAt(FUNC1, p)),
  };
}

/** The day's temperatures (the transfer model's own draw): how much it rose, or the hours between two equal values. */
function dayItem() {
  const p = FUNC1T.params(rnd); const ans = FUNC1T.answer(p);
  return {
    key: `fu1d:${p.q}:${p.hours[p.i]}:${p.hours[p.j]}:${p.temps[p.i]}:${p.temps[p.j]}`, text: func1TText(p), fig: dayFig(p),
    form: 'num', answer: ans, unit: p.q === 0 ? 'מעלות' : 'שעות',
    hint: func1THint(p), solution: func1TSolution(p), diag: diagOf(ans, bugsAt(FUNC1T, p)),
  };
}

/** A walk drawn for a choice question (any walk of the model's shape). */
const anyWalk = () => { for (;;) { const w = walk(rnd); if (w) return w; } };

/**
 * What did the walker do while the line is flat? Stood still; the flat line read as flat ground is the graph read as a
 * picture of the way. Three choices, so practice only.
 */
function flatMc() {
  const p = anyWalk(); const w = walkerOf(p);
  const options = shuffle([
    { text: `${g(w, 'עמד', 'עמדה')} במקום`, ok: true },
    { text: `${g(w, 'הלך', 'הלכה')} בדרך ישרה ושטוחה`, ok: false, bug: 'graph-picture' },
    { text: `${g(w, 'הלך', 'הלכה')} מהר מאוד`, ok: false },
  ]);
  return {
    key: `fu1f:${p.sx}:${p.sy}:${p.t1}:${p.d1}:${p.t2}:${p.t3}`,
    text: `הגרף מראה את המרחק של ${w.name} מהבית לפי הזמן. מה ${g(w, 'עשה', 'עשתה')} ${w.name} בין הדקה ה־$${p.t1}$ לדקה ה־$${p.t2}$?`,
    fig: walkFig(p, { bands: [{ from: p.t1, to: p.t2 }] }),
    form: 'mc', choices: options, answer: options.findIndex((c) => c.ok), practiceOnly: true,
    hint: 'מה קורה למרחק מהבית בקטע המסומן: הוא גדל, קטן או נשאר?',
    solution: [`מהדקה ה־$${p.t1}$ עד הדקה ה־$${p.t2}$ המרחק מהבית נשאר $${p.d1}$ מטרים: הקו שטוח.`, `המרחק לא השתנה, ולכן ${w.name} ${g(w, 'עמד', 'עמדה')} במקום. הגרף אינו ציור של הדרך.`],
    diag: (u) => options[u]?.bug || null,
  };
}

const FRIENDS = ['רוני', 'שירה', 'עומר', 'ליה'];
/** The five moments of a walk with two stops, in order, as the choices name them. */
const MOMENTS = (w, friend) => [
  `${w.name} בדרך לחנות`, `${w.name} בחנות`, `${w.name} בדרך מהחנות אל ${friend}`, `${w.name} אצל ${friend}`, `${w.name} בדרך חזרה הביתה`,
];
/**
 * A walk with a stop at a shop and a visit to a friend farther away (the RAMA type): what does the point A describe?
 * A sits on a grid crossing of one of the five parts; four moments are offered, the right one among them. Practice only:
 * the parts can be told apart by their order alone.
 */
function pointMc() {
  const w = pick(rnd, WALKERS); const fi = rint(rnd, 0, FRIENDS.length - 1); const friend = FRIENDS[fi];
  const sx = pick(rnd, [2, 5]); const sy = pick(rnd, [50, 100]);
  // in squares: out a (even) and up b (even); the shop c; on e = 2 and up f (even); the visit v; home h (even)
  const a = pick(rnd, [2, 4]); const b = pick(rnd, [2, 4]); const c = pick(rnd, [2, 3]); const f = pick(rnd, [2, 4]);
  const v = pick(rnd, [2, 3]); const h = pick(rnd, [4, 6]); const e = 2;
  const X = [0, a, a + c, a + c + e, a + c + e + v, a + c + e + v + h]; const Y = [0, b, b, b + f, b + f, 0];
  const pts = X.map((x, i) => [x * sx, Y[i] * sy]);
  // one grid crossing on each part: the middle of each climb and of the way back, one square into each stop
  const at = [[a / 2, b / 2], [a + 1, b], [a + c + 1, b + f / 2], [a + c + e + 1, b + f], [a + c + e + v + h / 2, (b + f) / 2]];
  const k = rint(rnd, 0, 4);
  const names = MOMENTS(w, friend);
  const others = shuffle([0, 1, 2, 3, 4].filter((i) => i !== k)).slice(0, 3);
  const options = shuffle([k, ...others]).map((i) => ({ text: names[i], ok: i === k }));
  const [ax, ay] = at[k];
  const M = 2 * Math.ceil(X[5] / 2);
  return {
    key: `fu1p:${sx}:${sy}:${X.join(',')}:${Y.join(',')}:${k}:${fi}`,
    text: `${w.name} ${g(w, 'יצא', 'יצאה')} מהבית, ${g(w, 'קנה', 'קנתה')} משהו בחנות, ${g(w, 'ביקר', 'ביקרה')} אצל ${friend} ו${g(w, 'חזר', 'חזרה')} הביתה. מה מתארת הנקודה $A$ בגרף של המרחק ${g(w, 'שלו', 'שלה')} מהבית?`,
    fig: { type: 'sgraph', x: TIME(M * sx, sx), y: AWAY((b + f + 2) * sy, sy), series: [{ pts }], marks: [{ x: ax * sx, y: ay * sy, label: 'A' }] },
    form: 'mc', choices: options, answer: options.findIndex((o) => o.ok), practiceOnly: true,
    hint: 'קו שטוח הוא עצירה, והעצירה הראשונה היא החנות. קו עולה מתרחק מהבית, וקו יורד חוזר אליו.',
    solution: [
      ['$A$ על הקו העולה הראשון: המרחק מהבית גדל לפני העצירה הראשונה.', '$A$ על הקטע השטוח הראשון: העצירה הקרובה לבית, בחנות.', '$A$ על הקו העולה השני: אחרי החנות המרחק שוב גדל.', '$A$ על הקטע השטוח השני: העצירה השנייה, הביקור.', '$A$ על הקו היורד: המרחק מהבית קטן עד $0$.'][k],
      `לכן הנקודה מתארת: ${names[k]}.`,
    ],
    diag: () => null,
  };
}

const PART = {
  up: (w) => `${g(w, 'התרחק', 'התרחקה')} מהבית`,
  flat: (w) => `${g(w, 'עמד', 'עמדה')} במקום`,
  down: (w) => `${g(w, 'התקרב', 'התקרבה')} הביתה`,
};
/**
 * A three-part story drawn on the graph object (shape mode): the first point is home, fixed; each part of 5 minutes goes
 * up, stays or comes down, never below home. The text names the shape, so practice only.
 */
function drawStory() {
  const w = pick(rnd, WALKERS);
  let shape;
  do { shape = ['up', pick(rnd, ['up', 'flat', 'down']), pick(rnd, ['up', 'flat', 'down'])]; } while (shape[1] === 'down' && shape[2] === 'down');
  return {
    key: `fu1s:${shape.join('-')}:${WALKERS.indexOf(w)}`,
    // short, so the graph keeps its room on a phone: three parts of 5 minutes each, in order
    text: `${w.name}: $5$ דקות ${PART[shape[0]](w)}, $5$ דקות ${PART[shape[1]](w)}, ועוד $5$ דקות ${PART[shape[2]](w)}. סמנו את הגרף של המרחק ${g(w, 'שלו', 'שלה')} מהבית.`,
    form: 'manip', practiceOnly: true,
    manip: { kind: 'graph', x: { max: 15, step: 5, label: 'זמן', unit: 'דקות' }, y: { max: 400, step: 100, label: 'מרחק מהבית', unit: 'מטרים' }, start: [0, 0, 0, 0], fixed: [0] },
    answer: { mode: 'shape', shape },
    hint: 'בכל קטע שאלו: המרחק מהבית גדל, נשאר או קטן? גדל: הקו עולה. נשאר: שטוח. קטן: יורד.',
    solution: shape.map((d, i) => `${['ב־$5$ הדקות הראשונות', 'ב־$5$ הדקות הבאות', 'ב־$5$ הדקות האחרונות'][i]} המרחק ${{ up: 'גדל: הקו עולה', flat: 'נשאר: הקו שטוח', down: 'קטן: הקו יורד' }[d]}.`),
    diag: () => null,
  };
}

// ================================================================ func:2, the function and its representations
// A function gives every x exactly one y, and it is the same function in words, a table, a graph and a rule. The
// models are the spec's (models.mjs func2, func2T), ported unchanged; F = 1.8C + 32 is computed as 9C/5 + 32, the same
// number without a binary 1.8 (so 77 is 77, never 76.99999999999999). Errors and their sources:
//   forgot-b            the fixed part left out, y = m·x (Van Dooren, De Bock, Hessels, Janssens & Verschaffel 2005,
//                       the proportional model applied to y = mx + b: confirm pages)
//   forward             the value of the function put in for x, m·y + b (the Ministry: "ההבדל … בין המשתנה הבלתי תלוי
//                       לבין ערך הפונקציה", algebra_8 p. 11; Leinhardt, Zaslavsky & Stein 1990 on y → x tasks)
//   order-ops           added before multiplying, 1.8(C + 32) (Linchevski & Livneh 1999)
//   const-not-function  a constant taken for "not a function" (Markovits, Eylon & Bruckheimer 1986; Vinner & Dreyfus
//                       1989): a choice in practice only

/** A price rule y = m·x + b in a story: q0 the value at x; q1 the x of a value (the spec's func2). */
export const FUNC2 = mk({
  raw: (r) => {
    const m = rint(r, 3, 9); const b = pick(r, [5, 6, 8, 10, 12, 15, 20]); const x = rint(r, 2, 15); const q = r() < 0.5 ? 0 : 1;
    return { m, b, x, y: m * x + b, q };
  },
  answer: (p) => (p.q === 0 ? p.y : p.x),
  bugs: {
    // y = mx: the fixed part left out (the proportional assumption)
    'forgot-b': (p) => (p.q === 0 ? p.m * p.x : p.y / p.m),
    // the value of y put in for x
    forward: (p) => (p.q === 1 ? p.m * p.y + p.b : null),
  },
  textNums: (p) => [p.m, p.b, ...(p.q === 0 ? [p.x] : [p.y])],
});

/** 1.8·v, exactly (9v/5): the factor of F = 1.8C + 32. */
const f18 = (v) => (9 * v) / 5;
/** func:2 transfer: F = 1.8C + 32, the Ministry's example of a rule with no story of its own (the spec's func2T). */
export const FUNC2T = mk({
  raw: (r) => { const C = 5 * rint(r, 1, 8); return { C, F: f18(C) + 32, q: r() < 0.5 ? 0 : 1 }; },
  answer: (p) => (p.q === 0 ? p.F : p.C),
  bugs: {
    'forgot-b': (p) => (p.q === 0 ? f18(p.C) : (5 * p.F) / 9),
    // added before multiplying
    'order-ops': (p) => (p.q === 0 ? f18(p.C + 32) : null),
    forward: (p) => (p.q === 1 ? f18(p.F) + 32 : null),
  },
  textNums: (p) => [1.8, 32, p.q === 0 ? p.C : p.F],
});

/** The three price stories of func2: what is bought, what x counts, the unit of x, and the two questions. */
export const PRICE_STORIES = [
  { what: 'נסיעה במונית', x: 'מספר הק״מ', unit: 'ק״מ',
    ask: [(x) => `כמה עולה נסיעה של $${x}$ ק״מ?`, (y) => `נסיעה עלתה $${y}$ ש״ח. כמה ק״מ נסעו?`] },
  { what: 'תדלוק בלילה', x: 'מספר הליטרים', unit: 'ליטרים',
    ask: [(x) => `כמה עולים $${x}$ ליטרים?`, (y) => `שילמו $${y}$ ש״ח. כמה ליטרים תדלקו?`] },
  { what: 'משלוח', x: 'המשקל של החבילה בק״ג', unit: 'ק״ג',
    ask: [(x) => `כמה עולה משלוח של חבילה של $${x}$ ק״ג?`, (y) => `משלוח עלה $${y}$ ש״ח. כמה ק״ג שקלה החבילה?`] },
];
/** The story of a draw: the same draw always tells the same story. */
export const storyOf = (p) => PRICE_STORIES[(p.m + p.b + p.x) % PRICE_STORIES.length];

export function func2Text(p, s = storyOf(p)) {
  return `המחיר של ${s.what} בש״ח הוא $y = ${p.m}x + ${p.b}$, כש־$x$ הוא ${s.x}. ${s.ask[p.q](p.q === 0 ? p.x : p.y)}`;
}
export function func2Solution(p) {
  if (p.q === 0) return [`מציבים את $${p.x}$ במקום $x$: $y = ${p.m} \\cdot ${p.x} + ${p.b}$`, `קודם כופלים, ואז מוסיפים את $${p.b}$ פעם אחת: $${p.m * p.x} + ${p.b} = ${p.y}$`];
  return [
    `$${p.y}$ הוא המחיר, כלומר ערך הפונקציה $y$. מחפשים את $x$ שנותן אותו: $${p.m}x + ${p.b} = ${p.y}$`,
    `מחסירים $${p.b}$ משני האגפים: $${p.m}x = ${p.y - p.b}$`,
    `מחלקים ב־$${p.m}$: $x = ${p.x}$`,
  ];
}
export const func2Hint = (p) => (p.q === 0
  ? `הציבו $${p.x}$ במקום $x$. את $${p.b}$ משלמים פעם אחת.`
  : `$${p.y}$ הוא המחיר, כלומר $y$. איזה $x$ נותן $${p.m}x + ${p.b} = ${p.y}$?`);

const F_RULE = 'לפי הנוסחה $F = 1.8C + 32$ ממירים מעלות צלזיוס ($C$) למעלות פרנהייט ($F$).';
export const func2TText = (p) => (p.q === 0
  ? `${F_RULE} כמה מעלות פרנהייט הן $${p.C}$ מעלות צלזיוס?`
  : `${F_RULE} מד חום מראה $${p.F}$ מעלות פרנהייט. כמה מעלות צלזיוס זה?`);
export function func2TSolution(p) {
  if (p.q === 0) return [`קודם כופלים: $1.8 \\cdot ${p.C} = ${f18(p.C)}$`, `ואז מוסיפים $32$: $${f18(p.C)} + 32 = ${p.F}$`];
  return [
    `מחפשים את $C$ שנותן $F = ${p.F}$. קודם מבטלים את מה שנעשה אחרון, ההוספה: $${p.F} - 32 = ${p.F - 32}$`,
    `ואז את הכפל: $${p.F - 32} : 1.8 = ${p.C}$`,
  ];
}
export const func2THint = (p) => (p.q === 0
  ? `קודם כופלים את $${p.C}$ ב־$1.8$, ורק אחר כך מוסיפים $32$.`
  : 'הולכים בסדר הפוך: קודם מחסירים $32$, ואז מחלקים ב־$1.8$.');

// ---------------------------------------------------------------- func:2 generators

/** The price rule (the model's own draw): the price of x, or the x of a price. */
function priceItem() {
  const p = FUNC2.params(rnd); const ans = FUNC2.answer(p);
  return {
    key: `fu2:${p.m}:${p.b}:${p.x}:${p.q}`, text: func2Text(p),
    form: 'num', answer: ans, unit: p.q === 0 ? 'ש״ח' : storyOf(p).unit,
    hint: func2Hint(p), solution: func2Solution(p), diag: diagOf(ans, bugsAt(FUNC2, p)),
  };
}

/** Fahrenheit and Celsius (the transfer model's own draw). */
function fahrenheitItem() {
  const p = FUNC2T.params(rnd); const ans = FUNC2T.answer(p);
  return {
    key: `fu2c:${p.C}:${p.q}`, text: func2TText(p),
    form: 'num', answer: ans, unit: 'מעלות',
    hint: func2THint(p), solution: func2TSolution(p), diag: diagOf(ans, bugsAt(FUNC2T, p)),
  };
}

/**
 * A table of y = m·x + b at x = 0, 1, 2, 3, asked at x = n (5 to 12): the answer is never a number of the table or the
 * text, and the fixed part left out (m·n) is never a slip of the hand away from it (the models' draw rule).
 */
function tableItem() {
  for (;;) {
    const m = rint(rnd, 2, 9); const b = rint(rnd, 1, 12); const n = rint(rnd, 5, 12);
    const rows = [0, 1, 2, 3].map((x) => [x, m * x + b]); const ans = m * n + b;
    if (guessable(ans, [...rows.flat(), n]) || slipLike(m * n, ans)) continue;
    return {
      key: `fu2t:${m}:${b}:${n}`,
      text: `בטבלה ארבעה ערכים של פונקציה מהצורה $y = mx + b$. מה $y$ כש־$x = ${n}$?`,
      fig: { type: 'table', head: ['x', 'y'], rows },
      form: 'num', answer: ans,
      hint: 'בכמה גדל $y$ בכל צעד של $1$ ב־$x$? ומה $y$ כש־$x = 0$?',
      solution: [`כל צעד של $1$ ב־$x$ מוסיף ל־$y$ את $${m}$, וכש־$x = 0$ יש $${b}$. לכן $y = ${m}x + ${b}$`, `מציבים: $${m} \\cdot ${n} + ${b} = ${ans}$`],
      diag: diagOf(ans, { 'forgot-b': m * n }),
    };
  }
}

/** A table as the student writes it, x on top and y under it (TeX). */
export const tableTex = (xs, ys) => `\\begin{array}{c|${'c'.repeat(xs.length)}} x & ${xs.join(' & ')} \\\\ \\hline y & ${ys.join(' & ')} \\end{array}`;
/** n different whole numbers from lo to hi, in a random order. */
const distinct = (n, lo, hi) => shuffle(Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)).slice(0, n);
/**
 * Which table is not a function? Four tables: one with an x given two values (the answer); one constant (still one y for
 * each x: chosen, it is const-not-function); one with a y repeated at two x's (a function too); one of y = m·x + b. The
 * spec keeps it in practice: the tables are read off the screen, and the odd one can be spotted without the idea.
 */
function isFunctionMc() {
  const xs = [1, 2, 3, 4];
  const d = rint(rnd, 1, 3); // the x given two values
  const dupXs = [1, 2, 3].flatMap((x) => (x === d ? [x, x] : [x]));
  const dupYs = distinct(4, 1, 9);
  const c = rint(rnd, 2, 9);
  const m = rint(rnd, 2, 4); const b = rint(rnd, 0, 3);
  const [rep, o1, o2] = distinct(3, 1, 9);
  const options = shuffle([
    { tex: tableTex(dupXs, dupYs), ok: true, kind: 'd' },
    { tex: tableTex(xs, xs.map(() => c)), ok: false, bug: 'const-not-function', kind: 'c' },
    { tex: tableTex(xs, [rep, o1, rep, o2]), ok: false, kind: 'r' },
    { tex: tableTex(xs, xs.map((x) => m * x + b)), ok: false, kind: 'l' },
  ]);
  const i = dupXs.indexOf(d);
  return {
    key: `fu2i:${d}:${dupYs[i]}:${dupYs[i + 1]}:${c}:${options.map((o) => o.kind).join('')}`,
    text: 'איזו מהטבלאות אינה מתארת פונקציה?',
    form: 'mc', choices: options.map(({ tex, ok, bug }) => ({ tex, ok, ...(bug ? { bug } : {}) })), answer: options.findIndex((o) => o.ok),
    practiceOnly: true,
    hint: 'בפונקציה לכל $x$ יש ערך אחד של $y$. חפשו $x$ שמופיע פעמיים.',
    solution: [
      `בטבלה שבה $x = ${d}$ מופיע פעמיים, עם $y = ${dupYs[i]}$ ועם $y = ${dupYs[i + 1]}$, ל־$x$ אחד יש שני ערכים: זו לא פונקציה.`,
      `בטבלה שבה כל ערכי $y$ הם $${c}$ יש לכל $x$ ערך אחד, ולכן גם היא פונקציה: פונקציה קבועה.`,
    ],
    diag: (u) => options[u]?.bug || null,
  };
}

/**
 * A function given by a table, drawn point by point on the graph object (values mode): four points at x = 0..3 on a y
 * axis of 9 heights, every 1, 2 or 5 (a number on every second line when a square is more than 1). The table prints the
 * values, so practice only. The table is written across (display), so on a 320×568 phone the graph keeps its room.
 */
function drawTable() {
  const s = pick(rnd, [1, 2, 5]);
  let v;
  do { v = [0, 1, 2, 3].map(() => s * rint(rnd, 0, 8)); } while (new Set(v).size < 3);
  return {
    key: `fu2d:${s}:${v.join(',')}`,
    text: 'הטבלה מתארת פונקציה. סמנו בגרף את הנקודות שלה.',
    // the table written across, x over y, as in the class's notebook: short, so the graph keeps its room on a phone
    display: tableTex([0, 1, 2, 3], v),
    form: 'manip', practiceOnly: true,
    manip: { kind: 'graph', x: { max: 3, step: 1, label: 'x' }, y: { max: 8 * s, step: s, label: 'y', ...(s > 1 ? { every: 2 } : {}) }, start: [0, 0, 0, 0] },
    answer: { mode: 'values', values: v },
    hint: s === 1 ? 'כל שורה בטבלה היא נקודה: מעל כל $x$ גוררים לגובה של ה־$y$ שלו.' : `כל שורה בטבלה היא נקודה. כל משבצת לגובה היא $${s}$.`,
    solution: [`כל שורה בטבלה היא נקודה: ${v.map((y, x) => `$(${x}, ${y})$`).join(', ')}.`, 'מעל כל $x$ יש נקודה אחת בדיוק: זה גרף של פונקציה.'],
    diag: () => null,
  };
}

// ---------------------------------------------------------------- the topic

export const FUNC = {
  id: 'func', grade: '8', title: 'מבוא לפונקציות', color: 'fuchsia',
  // what the unit teaches today; its later stairs add their own words here as they land
  desc: 'קריאת גרף של מצב, ופונקציה וייצוגיה: מילים, טבלה, גרף וביטוי',
  // taught in November of ח׳: the first-day placement test does not ask about it (the jump test does)
  placement: false,
  levels: [
    { title: 'קריאת גרף של מצב', gen: () => { const r = Math.random(); return r < 0.55 ? walkItem() : r < 0.75 ? dayItem() : r < 0.85 ? flatMc() : r < 0.95 ? pointMc() : drawStory(); } },
    // the spec's mix: the price rule 45%, Fahrenheit 15%, a table 15%, which table is a function 15%, a table drawn 10%
    { title: 'פונקציה וייצוגיה', gen: () => { const r = Math.random(); return r < 0.45 ? priceItem() : r < 0.6 ? fahrenheitItem() : r < 0.75 ? tableItem() : r < 0.9 ? isFunctionMc() : drawTable(); } },
  ],
  cats: {
    'count-squares': 'ספרו משבצות ולא כפלו בגודל של כל משבצת',
    'end-for-duration': 'ענו את הרגע שבו זה נגמר, ולא כמה זמן זה נמשך',
    'value-not-change': 'ענו את הערך בסוף, ולא בכמה הוא השתנה',
    'graph-picture': 'קראו את הגרף כמו ציור של הדרך, ולא כקשר בין שני גדלים',
    'forgot-b': 'שכחו את החלק הקבוע (דמי פתיחה, עמלה, ערך ההתחלה)',
    forward: 'הציבו את ערך הפונקציה במקום $x$',
    'order-ops': 'חיברו לפני שכפלו',
    'const-not-function': 'חשבו שקבוע אינו פונקציה',
  },
  lesson: {
    // one point per stair, each landing with its stair
    points: [
      'גרף של מצב קוראים בשני כיוונים: מ־$x$ אל $y$ (מה היה ברגע הזה) ומ־$y$ אל $x$ (מתי זה היה).',
      'קו שטוח בגרף אומר שהערך לא השתנה, לא שהדרך שטוחה.',
      'פונקציה נותנת לכל $x$ ערך אחד בלבד של $y$: $y = 7x + 2$ נותן ל־$x = 5$ את $37$.',
    ],
    words: ['גרף של מצב', 'ציר', 'משבצת', 'נקודה על גרף', 'קנה מידה של ציר', 'משך זמן', 'פונקציה', 'ערך הפונקציה', 'משתנה בלתי תלוי', 'ייצוג', 'טבלת ערכים', 'פונקציה קבועה'],
  },
};
