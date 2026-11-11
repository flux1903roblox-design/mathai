// Introduction to functions (מבוא לפונקציות): unit 8.7 of grade 8 (ח׳), November in the Ministry's תשפ״ז schedule, in
// the order of the Ministry's updated ח׳ algebra curriculum (algebra_8): reading a graph of a situation first (its first
// subject, and all of ז׳ 7.9's "קריאת גרף שמתאר מצב"), then the function and its representations, increasing and
// decreasing, and rate (stage5.md FUNC-2). Its four stairs: func:1, reading a situation graph, func:2, the function and
// its representations, func:3, increasing, decreasing and constant, and func:4, uniform and non-uniform rate (the
// December row of the schedule, which shared/programme.js lists with slope in 8.8).
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

// ================================================================ func:3, increasing, decreasing and constant
// Increasing and decreasing are read left to right, as x grows (the Ministry: "על ידי התבוננות במהלך הגרף משמאל
// לימין", algebra_8 p. 13), and an interval is a piece of the x axis, not the change in y (the Ministry's pop page: "להבהיר
// את ההבדל בין 'הגרף בתחום העלייה' לבין 'תחום העלייה'"). The models are the spec's: func3 from models.mjs, ported
// unchanged, and func3T with the critique's fair table rule (critique/func3t.mjs): its answer, a number of hours, is never
// a number of its own table (the guessing test reads tables). Errors and their sources:
//   rtl-read  the length of the other monotone interval (falling for rising, or the other way round), as a reader who
//             goes right to left would find it. No study has measured this in Hebrew readers (Fuhrman & Boroditsky 2010
//             on right-to-left time; Tversky, Kugelmass & Winter 1991, confirm): the label names only what the answer
//             shows, and the cause is said as a hypothesis
//   y-not-x   the change in y over the interval, or the constant's height, given for a length on the x axis
//   graph-picture  (func:1's) a speed graph's flat part read as a flat road or a stop

/** A graph from (x0, y0): up to the peak (x1, y1), down to (x2, y2), flat to x3 (the spec's func3). */
export const FUNC3 = mk({
  raw: (r) => {
    const s = pick(r, [1, 2, 5, 10]); const n0 = rint(r, 0, 2); const n1 = rint(r, 1, 5); const n2 = rint(r, 1, 5); const n3 = rint(r, 1, 4);
    if (n0 + n1 + n2 + n3 > 12) return null;
    const x0 = s * n0; const x1 = x0 + s * n1; const x2 = x1 + s * n2; const x3 = x2 + s * n3;
    const y0 = rint(r, 1, 4); const y1 = y0 + rint(r, 2, 7); const y2 = y1 - rint(r, 1, 6); if (y2 < 0 || y1 > 12) return null;
    return { s, x0, x1, x2, x3, y0, y1, y2, q: rint(r, 0, 2) };
  },
  answer: (p) => [p.x1 - p.x0, p.x2 - p.x1, p.x3 - p.x2][p.q],
  bugs: {
    // read right to left: rising and falling swap places
    'rtl-read': (p) => [p.x2 - p.x1, p.x1 - p.x0, null][p.q],
    // the change in y (or the constant's height) given for a length on the x axis
    'y-not-x': (p) => [p.y1 - p.y0, p.y1 - p.y2, p.y2][p.q],
  },
});

/**
 * func:3 transfer: a day's temperatures in a table, every s hours (1, 2 or 3), rising to a peak and then falling: how
 * many hours it rose, or fell (the spec's func3T, with the critique's fair rule: no number of the table is the answer).
 */
export const FUNC3T = mk({
  raw: (r) => {
    const s = pick(r, [1, 2, 3]); const cols = rint(r, 6, 8); const k = rint(r, 2, cols - 3); const h0 = pick(r, [6, 7, 8, 9]);
    const t = [rint(r, 10, 18)];
    for (let i = 1; i < cols; i += 1) t.push(t[i - 1] + (i <= k ? rint(r, 1, 4) : -rint(r, 1, 4)));
    const hours = Array.from({ length: cols }, (_, i) => h0 + s * i);
    if (hours[cols - 1] > 22) return null;
    return { s, cols, k, temps: t, hours, q: r() < 0.5 ? 0 : 1 };
  },
  answer: (p) => (p.q === 0 ? p.hours[p.k] - p.hours[0] : p.hours[p.cols - 1] - p.hours[p.k]),
  bugs: {
    'rtl-read': (p) => (p.q === 0 ? p.hours[p.cols - 1] - p.hours[p.k] : p.hours[p.k] - p.hours[0]),
    'y-not-x': (p) => (p.q === 0 ? p.temps[p.k] - p.temps[0] : p.temps[p.k] - p.temps[p.cols - 1]),
  },
  // the fair rule for a table the student reads: the answer is none of its numbers
  textNums: (p) => [...p.hours, ...p.temps],
});

/** The words of a direction: the function (fem.), the graph (masc.), and the trend over an interval. */
const DIR = {
  up: { f: 'עולה', m: 'עולה' }, down: { f: 'יורדת', m: 'יורד' }, flat: { f: 'קבועה', m: 'קבוע' },
};
/**
 * The story of a func3 graph by its step: one unit a square names no story (x and y); a square of 2 hours is a day's
 * temperature, of 5 minutes a drone's height, of 10 days the water in a pond. The question names the axis's unit.
 */
export const GRAPH_STORIES = {
  1: { x: { label: 'x' }, y: { label: 'y' }, unit: 'יחידות על ציר $x$' },
  2: { x: { label: 'זמן', unit: 'שעות' }, y: { label: 'טמפרטורה', unit: 'מעלות' }, unit: 'שעות', intro: 'הגרף מראה את הטמפרטורה לפי הזמן.' },
  5: { x: { label: 'זמן', unit: 'דקות' }, y: { label: 'גובה הרחפן', unit: 'מטרים' }, unit: 'דקות', intro: 'הגרף מראה את הגובה של רחפן לפי הזמן.' },
  10: { x: { label: 'זמן', unit: 'ימים' }, y: { label: 'גובה המים', unit: 'ס״מ' }, unit: 'ימים', intro: 'הגרף מראה את גובה המים בבריכה לפי הזמן.' },
};
/** A number on every line when the numbers fit, else on every second line (the plot is about 280 wide and 172 high). */
const everyFor = (lines, widest) => ((280 / lines) >= widest * 8.6 + 4 ? 1 : 2);
/** The func3 graph: x from 0 to a numbered line at or after its end, y from 0 to one line above its peak. */
export function func3Fig(p, extra = {}) {
  const st = GRAPH_STORIES[p.s];
  const n = p.x3 / p.s; const ex = everyFor(n, String(p.x3).length);
  const ey = p.y1 + 1 > 10 ? 2 : 1; const ymax = ey * Math.ceil((p.y1 + 1) / ey);
  return {
    type: 'sgraph',
    x: { ...st.x, max: p.s * ex * Math.ceil(n / ex), step: p.s, ...(ex > 1 ? { every: ex } : {}) },
    y: { ...st.y, max: ymax, step: 1, ...(ey > 1 ? { every: ey } : {}) },
    series: [{ pts: [[p.x0, p.y0], [p.x1, p.y1], [p.x2, p.y2], [p.x3, p.y2]] }], ...extra,
  };
}
const Q3 = ['up', 'down', 'flat'];
export function func3Text(p) {
  const st = GRAPH_STORIES[p.s];
  return `${st.intro ? `${st.intro} ` : ''}כמה ${st.unit} הפונקציה ${DIR[Q3[p.q]].f}?`;
}
export function func3Solution(p) {
  const [a, b] = [[p.x0, p.x1], [p.x1, p.x2], [p.x2, p.x3]][p.q];
  const [ya, yb] = [[p.y0, p.y1], [p.y1, p.y2], [p.y2, p.y2]][p.q];
  const trend = p.q === 2 ? `$y$ נשאר $${ya}$` : `$y$ ${p.q === 0 ? 'גדל' : 'קטן'} מ־$${ya}$ ל־$${yb}$`;
  return [
    `קוראים משמאל לימין: מ־$x = ${a}$ עד $x = ${b}$ ${trend}, ולכן שם הפונקציה ${DIR[Q3[p.q]].f}.`,
    `את התחום מודדים על ציר $x$: $${b} - ${a} = ${b - a}$`,
  ];
}
export const func3Hint = (p) => (p.q === 2
  ? 'איפה הקו שטוח? את אורך הקטע מודדים על ציר $x$, לא על ציר $y$.'
  : 'שימו אצבע בקצה השמאלי של הגרף והזיזו ימינה. את אורך הקטע מודדים על ציר $x$.');

/** The day's temperatures as a table, hour by hour (read top to bottom, as x grows). */
export const func3TFig = (p) => ({ type: 'table', head: ['שעה', 'טמפרטורה (מעלות)'], rows: p.hours.map((h, i) => [h, p.temps[i]]) });
export const func3TText = (p) => `הטבלה מראה את הטמפרטורה ביום אחד. כמה שעות ${p.q === 0 ? 'עלתה' : 'ירדה'} הטמפרטורה?`;
export function func3TSolution(p) {
  const top = p.hours[p.k]; const first = p.hours[0]; const last = p.hours[p.cols - 1];
  return [
    `עוברים לפי השעות, מהקטנה לגדולה: הטמפרטורה עולה עד $${p.temps[p.k]}$ מעלות בשעה $${top}$, ואחר כך יורדת.`,
    p.q === 0 ? `היא עלתה משעה $${first}$ עד שעה $${top}$: $${top} - ${first} = ${top - first}$` : `היא ירדה משעה $${top}$ עד שעה $${last}$: $${last} - ${top} = ${last - top}$`,
  ];
}
export const func3THint = () => 'מצאו את השעה שבה הטמפרטורה הכי גבוהה. השאלה על שעות, כלומר על הטור של השעה.';

// ---------------------------------------------------------------- func:3 generators

/** The graph (the model's own draw): how long it rises, falls or stays. */
function intervalItem() {
  const p = FUNC3.params(rnd); const ans = FUNC3.answer(p);
  return {
    key: `fu3:${p.s}:${p.x0}:${p.x1}:${p.x2}:${p.x3}:${p.y0}:${p.y1}:${p.y2}:${p.q}`, text: func3Text(p), fig: func3Fig(p),
    form: 'num', answer: ans, ...(p.s > 1 ? { unit: GRAPH_STORIES[p.s].unit } : {}),
    hint: func3Hint(p), solution: func3Solution(p), diag: diagOf(ans, bugsAt(FUNC3, p)),
  };
}

/** The table of temperatures (the transfer model's own draw): how many hours it rose, or fell. */
function tableHoursItem() {
  const p = FUNC3T.params(rnd); const ans = FUNC3T.answer(p);
  return {
    key: `fu3t:${p.s}:${p.hours[0]}:${p.hours[p.k]}:${p.hours[p.cols - 1]}:${p.temps[0]}:${p.temps[p.k]}:${p.temps[p.cols - 1]}:${p.q}`,
    text: func3TText(p), fig: func3TFig(p),
    form: 'num', answer: ans, unit: 'שעות',
    hint: func3THint(p), solution: func3TSolution(p), diag: diagOf(ans, bugsAt(FUNC3T, p)),
  };
}

/** A graph of three pieces, one going up, one down and one flat, in any order, on x 0..9 and y 0..9. */
function threePieces() {
  for (;;) {
    const dirs = shuffle(['up', 'down', 'flat']); const lens = [rint(rnd, 2, 3), rint(rnd, 2, 3), rint(rnd, 2, 3)];
    const pts = [[0, rint(rnd, 1, 8)]];
    dirs.forEach((d, i) => { const [x, y] = pts[pts.length - 1]; pts.push([x + lens[i], d === 'flat' ? y : d === 'up' ? y + rint(rnd, 2, 5) : y - rint(rnd, 2, 5)]); });
    if (pts.every(([, y]) => y >= 0 && y <= 9)) return { dirs, pts };
  }
}
/**
 * Between x = a and x = b the function: rises, falls or stays? The interval is one piece of the graph, shaded on its
 * x axis; the direction read right to left is the swapped one (rtl-read). Three choices, so practice only.
 */
function whichMc() {
  const { dirs, pts } = threePieces(); const i = rint(rnd, 0, 2); const [a, b] = [pts[i][0], pts[i + 1][0]]; const d = dirs[i];
  const swapped = { up: 'down', down: 'up', flat: null }[d];
  const options = ['up', 'down', 'flat'].map((k) => ({ text: DIR[k].f, ok: k === d, ...(k === swapped ? { bug: 'rtl-read' } : {}) }));
  return {
    key: `fu3w:${d}:${a}:${b}:${pts.map(([x, y]) => `${x},${y}`).join(';')}`,
    text: `בין $x = ${a}$ ל־$x = ${b}$ הפונקציה:`,
    fig: { type: 'sgraph', x: { max: 9, step: 1, label: 'x' }, y: { max: 9, step: 1, label: 'y' }, series: [{ pts }], bands: [{ from: a, to: b }] },
    form: 'mc', choices: options, answer: options.findIndex((o) => o.ok), practiceOnly: true,
    hint: 'שימו אצבע על הגרף ב־$x = ' + a + '$ והזיזו ימינה עד $x = ' + b + '$. האצבע עולה, יורדת או נשארת?',
    solution: [
      `משמאל לימין, מ־$x = ${a}$ עד $x = ${b}$, $y$ ${d === 'flat' ? `נשאר $${pts[i][1]}$` : `${d === 'up' ? 'גדל' : 'קטן'} מ־$${pts[i][1]}$ ל־$${pts[i + 1][1]}$`}.`,
      `לכן שם הפונקציה ${DIR[d].f}.`,
    ],
    diag: (u) => options[u]?.bug || null,
  };
}

/**
 * Draw a graph of three parts on the graph object (shape mode): x 0..6, y 0..8, every point starting at 4; neighbouring
 * parts go different ways, and the shape fits the axis from the middle (the solution's start). The text names the shape,
 * so practice only.
 */
function drawShape() {
  for (;;) {
    const d1 = pick(rnd, ['up', 'down', 'flat']); const d2 = pick(rnd, ['up', 'down', 'flat'].filter((d) => d !== d1)); const d3 = pick(rnd, ['up', 'down', 'flat'].filter((d) => d !== d2));
    const a = rint(rnd, 1, 4); const b = rint(rnd, a + 1, 5);
    const shape = [...Array(a).fill(d1), ...Array(b - a).fill(d2), ...Array(6 - b).fill(d3)];
    let y = 4; let fits = true;
    for (const d of shape) { y += d === 'up' ? 1 : d === 'down' ? -1 : 0; if (y < 0 || y > 8) fits = false; }
    if (!fits) continue;
    return {
      key: `fu3s:${shape.join('-')}`,
      text: `ציירו גרף ש${DIR[d1].m} עד $x = ${a}$, ${DIR[d2].m} עד $x = ${b}$, ו${DIR[d3].m} עד $x = 6$.`,
      form: 'manip', practiceOnly: true,
      manip: { kind: 'graph', x: { max: 6, step: 1, label: 'x' }, y: { max: 8, step: 1, label: 'y' }, start: [4, 4, 4, 4, 4, 4, 4] },
      answer: { mode: 'shape', shape },
      hint: 'קטע עולה: כל נקודה גבוהה מזו שלפניה. קטע יורד: נמוכה ממנה. קטע קבוע: באותו גובה.',
      solution: [
        `משמאל לימין: מ־$x = 0$ עד $x = ${a}$ הגרף ${DIR[d1].m}, עד $x = ${b}$ ${DIR[d2].m}, ועד $x = 6$ ${DIR[d3].m}.`,
        'בכל קטע עולה כל נקודה גבוהה מזו שלפניה, בקטע יורד נמוכה ממנה, ובקטע קבוע באותו גובה.',
      ],
      diag: () => null,
    };
  }
}

// ================================================================ func:4, uniform and non-uniform rate
// A rate is the change in y for one unit of x: the change divided by the units it took, from two readings (the start
// need not be 0). A uniform rate gives a straight graph and equal differences in a table; steeper is faster, higher is
// not. The models are the critique's func4 (critique/models.mjs: water in a pot, every temperature named or asked at
// most 95°, the plan's draws went past boiling) and the spec's func4T (a candle), ported unchanged. Errors and their
// sources:
//   from-zero         the rate taken as if the start were 0: v / T, t·v / T, or h₀·T / h₁ (Van Dooren et al. 2005, the
//                     illusion of linearity; the Ministry's own heating item, algebra_8 p. 29)
//   whole-change      the whole change given for the change in one unit, v − s (the unit rate of ratio:3)
//   forgot-b          (func:2's) the start left out, r·t
//   wrong-unknown     the hours left from now, h₁ / r, for the hours from lighting (eq's id: an answer to another
//                     unknown of the story)
//   height-for-slope  the higher line taken for the faster one (Bell & Janvier 1981; Clement 1989): a choice in practice
//                     only

/** Water in a pot does not pass boiling: every temperature the question names or asks is at most 95°. */
const CAP = 95;
/** Uniform heating: s° at the start and v° after T minutes. q0 the rate per minute; q1 the value after t minutes. */
export const FUNC4 = mk({
  raw: (rnd) => {
    const s = 5 * rint(rnd, 1, 8); const r = rint(rnd, 2, 12); const T = rint(rnd, 2, 6); const v = s + r * T; const q = rnd() < 0.5 ? 0 : 1;
    if (v > CAP) return null;
    let t = 0; if (q === 1) { t = rint(rnd, 1, 9); if (t === T || s + r * t > CAP) return null; }
    return { s, r, T, v, t, q };
  },
  answer: (p) => (p.q === 0 ? p.r : p.s + p.r * p.t),
  bugs: {
    // as if it started at 0 (the illusion of linearity)
    'from-zero': (p) => (p.q === 0 ? p.v / p.T : (p.t * p.v) / p.T),
    // the whole change, not the change in one minute
    'whole-change': (p) => (p.q === 0 ? p.v - p.s : null),
    // the start left out
    'forgot-b': (p) => (p.q === 1 ? p.r * p.t : null),
  },
  textNums: (p) => [p.s, p.T, p.v, ...(p.q === 1 ? [p.t] : [])],
});

/** func:4 transfer: a candle burns down uniformly, h0 cm and h1 cm after T hours. After how many hours from lighting is it gone? */
export const FUNC4T = mk({
  raw: (rnd) => {
    const r = rint(rnd, 2, 5); const n = rint(rnd, 4, 10); const h0 = r * n; const T = rint(rnd, 1, 3); const h1 = h0 - r * T;
    if (h1 <= 0 || T >= n) return null; return { r, n, h0, T, h1 };
  },
  answer: (p) => p.h0 / p.r,
  bugs: {
    // the rate taken as h1 / T, as if the candle had grown from 0
    'from-zero': (p) => (p.h0 * p.T) / p.h1,
    // the hours left from now, not from lighting
    'wrong-unknown': (p) => p.h1 / p.r,
  },
  textNums: (p) => [p.h0, p.T, p.h1],
});

/** A number of minutes or hours in words: one is "דקה אחת" (never "$1$ דקות"). */
const minutes = (t) => (t === 1 ? 'דקה אחת' : `$${t}$ דקות`);
const hoursW = (t) => (t === 1 ? 'שעה' : `$${t}$ שעות`);

const POT = (p) => `מים בסיר מתחממים בקצב אחיד: בהתחלה $${p.s}^\\circ$, ואחרי $${p.T}$ דקות $${p.v}^\\circ$.`;
export const func4Text = (p) => (p.q === 0
  ? `${POT(p)} בכמה מעלות הם מתחממים בכל דקה?`
  : `${POT(p)} מה תהיה הטמפרטורה אחרי ${minutes(p.t)}?`);
export function func4Solution(p) {
  if (p.q === 0) return [`השינוי: $${p.v} - ${p.s} = ${p.v - p.s}$ מעלות ב־$${p.T}$ דקות.`, `בכל דקה: $${p.v - p.s} : ${p.T} = ${p.r}$`];
  return [
    `הקצב: $(${p.v} - ${p.s}) : ${p.T} = ${p.r}$ מעלות בכל דקה.`,
    `מתחילים מ־$${p.s}^\\circ$ ומוסיפים ${p.t === 1 ? 'דקה אחת' : `$${p.t}$ דקות`} של $${p.r}$: $${p.s} + ${p.t} \\cdot ${p.r} = ${p.s + p.r * p.t}$`,
  ];
}
export const func4Hint = (p) => (p.q === 0
  ? `בכמה מעלות השתנתה הטמפרטורה? מחלקים את השינוי במספר הדקות. ההתחלה היא $${p.s}^\\circ$, לא $0$.`
  : `מצאו קודם בכמה מעלות עולה הטמפרטורה בכל דקה. אחר כך מתחילים מ־$${p.s}^\\circ$.`);

export const func4TText = (p) => `נר בגובה $${p.h0}$ ס״מ נשרף בקצב אחיד. אחרי ${hoursW(p.T)} גובהו $${p.h1}$ ס״מ. כעבור כמה שעות מהדלקתו ייגמר?`;
export function func4TSolution(p) {
  const burnt = p.h0 - p.h1;
  return [
    `בכמה ס״מ הנר התקצר: $${p.h0} - ${p.h1} = ${burnt}$, ב־${hoursW(p.T)}.`,
    `בכל שעה: $${burnt} : ${p.T} = ${p.r}$ ס״מ.`,
    `כל הנר, $${p.h0}$ ס״מ, נשרף מההדלקה: $${p.h0} : ${p.r} = ${p.h0 / p.r}$ שעות.`,
  ];
}
export const func4THint = () => 'מצאו קודם כמה ס״מ נשרפים בכל שעה. השאלה היא כמה שעות נשרף כל הנר, מההדלקה.';

// ---------------------------------------------------------------- func:4 generators

/** The pot (the critique's model, its own draw): the rate per minute, or the temperature after t minutes. */
function heatItem() {
  const p = FUNC4.params(rnd); const ans = FUNC4.answer(p);
  return {
    key: `fu4:${p.s}:${p.r}:${p.T}:${p.t}:${p.q}`, text: func4Text(p),
    form: 'num', answer: ans, unit: 'מעלות',
    hint: func4Hint(p), solution: func4Solution(p), diag: diagOf(ans, bugsAt(FUNC4, p)),
  };
}

/** The candle (the transfer model's own draw): the hours from lighting until it is gone. */
function candleItem() {
  const p = FUNC4T.params(rnd); const ans = FUNC4T.answer(p);
  return {
    key: `fu4c:${p.h0}:${p.T}:${p.h1}`, text: func4TText(p),
    form: 'num', answer: ans, unit: 'שעות',
    hint: func4THint(), solution: func4TSolution(p), diag: diagOf(ans, bugsAt(FUNC4T, p)),
  };
}

/**
 * Which table has a uniform rate? Four tables at x = 0..3, each from its own start: one with equal differences (the
 * answer), one whose differences grow, one whose differences shrink, and one with a single difference off. The tables
 * are read off the screen and the odd one out can be spotted without the idea, so practice only.
 */
function uniformMc() {
  const d = rint(rnd, 2, 6); const e = rint(rnd, 1, 3); const k = rint(rnd, 0, 2);
  const run = (a, diffs) => diffs.reduce((ys, x) => [...ys, ys[ys.length - 1] + x], [a]);
  const starts = distinct(4, 1, 12);
  const tables = [
    { ys: run(starts[0], [d, d, d]), ok: true, kind: 'u' },
    { ys: run(starts[1], [d, d + e, d + 2 * e]), ok: false, kind: 'g' },
    { ys: run(starts[2], [d + 2 * e, d + e, d]), ok: false, kind: 's' },
    { ys: run(starts[3], [d, d, d].map((x, i) => (i === k ? x + e : x))), ok: false, kind: 'o' },
  ];
  const options = shuffle(tables);
  return {
    key: `fu4u:${starts[0]}:${d}:${e}:${k}:${options.map((o) => o.kind).join('')}`,
    text: 'באיזו טבלה הקצב אחיד?',
    form: 'mc', choices: options.map(({ ys, ok }) => ({ tex: tableTex([0, 1, 2, 3], ys), ok })), answer: options.findIndex((o) => o.ok),
    practiceOnly: true,
    hint: 'בכל טבלה $x$ עולה ב־$1$ בכל צעד. חשבו את ההפרשים בין ערכי $y$ שכנים: בקצב אחיד הם שווים.',
    solution: [
      `בטבלה שבה $y = ${tables[0].ys.join(', ')}$ הערך עולה ב־$${d}$ בכל צעד: הקצב אחיד.`,
      'בשאר הטבלאות ההפרשים בין ערכי $y$ שכנים לא שווים, ולכן הקצב שם לא אחיד.',
    ],
    diag: () => null,
  };
}

/**
 * Who runs faster? Two runners' distance from the start line by the second: the slow one starts ahead and stays higher,
 * the fast one starts at 0 and climbs more steeply. The higher line chosen is height-for-slope. Three choices, so practice
 * only.
 */
function fasterMc() {
  const ra = rint(rnd, 1, 3); const rb = ra + rint(rnd, 2, 3); const a0 = 10 * (rb - ra) + 10 * rint(rnd, 1, 2);
  const fast = pick(rnd, ['A', 'B']); const slow = fast === 'A' ? 'B' : 'A';
  const slowPts = [[0, a0], [10, a0 + 10 * ra]]; const fastPts = [[0, 0], [10, 10 * rb]];
  const series = [
    { pts: fast === 'A' ? fastPts : slowPts, label: 'A' },
    { pts: fast === 'B' ? fastPts : slowPts, label: 'B' },
  ];
  const options = shuffle([
    // a choice in words is plain text (no maths): the runner's letter is written as it is in the legend
    { text: `הרץ ${fast}: הקו שלו תלול יותר`, ok: true },
    { text: `הרץ ${slow}: הקו שלו גבוה יותר`, ok: false, bug: 'height-for-slope' },
    { text: 'שניהם רצים באותה מהירות', ok: false },
  ]);
  return {
    key: `fu4f:${ra}:${rb}:${a0}:${fast}`,
    text: 'הגרף מראה את המרחק של שני רצים מקו הזינוק לפי הזמן. מי רץ מהר יותר?',
    fig: {
      type: 'sgraph', x: { max: 10, step: 1, every: 2, label: 'זמן', unit: 'שניות' },
      y: { max: a0 + 10 * ra + 10, step: 10, label: 'מרחק', unit: 'מטרים' }, series,
    },
    form: 'mc', choices: options.map(({ text, ok, bug }) => ({ text, ok, ...(bug ? { bug } : {}) })), answer: options.findIndex((o) => o.ok),
    practiceOnly: true,
    hint: 'כמה מטרים עובר כל רץ ב־$10$ השניות? הקו התלול יותר הוא של מי שעובר יותר בכל שנייה.',
    solution: [
      `$${fast}$ עובר $${10 * rb}$ מטרים ב־$10$ שניות, כלומר $${rb}$ מטרים בשנייה. $${slow}$ עובר מ־$${a0}$ עד $${a0 + 10 * ra}$, כלומר $${ra}$ מטרים בשנייה.`,
      `לכן $${fast}$ מהיר יותר: הקו שלו תלול יותר. הגובה אומר רק איפה כל אחד נמצא.`,
    ],
    diag: (u) => options[u]?.bug || null,
  };
}

/**
 * Continue a uniform rate on the graph object (values mode): the water's first two minutes are given (fixed), and the
 * student marks the next four at the same rate. One square up a minute, on an axis of at most 9 heights, never above
 * 95°. The text names the rate's numbers, so practice only.
 */
function continueRate() {
  for (;;) {
    const r = pick(rnd, [2, 5, 10]); const x0 = rint(rnd, 1, 4); const below = rint(rnd, 0, 2); const above = rint(rnd, 0, 3 - below);
    const lo = 10 * rint(rnd, 1, 6); const v0 = lo + below * r; const values = Array.from({ length: 6 }, (_, i) => v0 + i * r);
    const max = values[5] + above * r;
    if (values[5] > CAP) continue;
    return {
      key: `fu4n:${x0}:${v0}:${r}:${lo}:${max}`,
      text: `מים בסיר מתחממים בקצב אחיד. בדקה ה־$${x0}$ הם $${v0}^\\circ$, ובדקה ה־$${x0 + 1}$ הם $${v0 + r}^\\circ$. סמנו את הטמפרטורה עד הדקה ה־$${x0 + 5}$.`,
      form: 'manip', practiceOnly: true,
      manip: {
        kind: 'graph', x: { min: x0, max: x0 + 5, step: 1, label: 'זמן', unit: 'דקות' },
        y: { min: lo, max, step: r, label: 'טמפרטורה', unit: 'מעלות' },
        start: [v0, v0 + r, v0 + r, v0 + r, v0 + r, v0 + r], fixed: [0, 1],
      },
      answer: { mode: 'values', values },
      hint: `בכל דקה עוד $${r}^\\circ$: כל נקודה משבצת אחת מעל הקודמת.`,
      solution: [`בכל דקה הטמפרטורה עולה ב־$${v0 + r} - ${v0} = ${r}$ מעלות.`, `לכן בדקות ה־$${x0 + 2}$ עד ה־$${x0 + 5}$: $${values.slice(2).join(', ')}$. הנקודות על קו ישר.`],
      diag: () => null,
    };
  }
}

// ---------------------------------------------------------------- the topic

export const FUNC = {
  // ז׳ meets its first stair, a graph that describes a situation, in May (7.9; learn/skills.ts GUEST): Exam Rescue and the
  // exam check offer that stair to ז׳ (alsoFor, read through content/index.js rescueTopicsFor's guest rule)
  id: 'func', grade: '8', title: 'מבוא לפונקציות', color: 'fuchsia', alsoFor: ['7'],
  // what the unit teaches: its four stairs
  desc: 'קריאת גרף של מצב, פונקציה וייצוגיה, עלייה וירידה, וקצב אחיד ולא אחיד',
  // taught in November of ח׳: the first-day placement test does not ask about it (the jump test does)
  placement: false,
  levels: [
    { title: 'קריאת גרף של מצב', gen: () => { const r = Math.random(); return r < 0.55 ? walkItem() : r < 0.75 ? dayItem() : r < 0.85 ? flatMc() : r < 0.95 ? pointMc() : drawStory(); } },
    // the spec's mix: the price rule 45%, Fahrenheit 15%, a table 15%, which table is a function 15%, a table drawn 10%
    { title: 'פונקציה וייצוגיה', gen: () => { const r = Math.random(); return r < 0.45 ? priceItem() : r < 0.6 ? fahrenheitItem() : r < 0.75 ? tableItem() : r < 0.9 ? isFunctionMc() : drawTable(); } },
    // the spec's mix: a graph 50%, a table of temperatures 20%, which way between two x's 15%, a shape drawn 15%
    { title: 'עלייה, ירידה וקבוע', gen: () => { const r = Math.random(); return r < 0.5 ? intervalItem() : r < 0.7 ? tableHoursItem() : r < 0.85 ? whichMc() : drawShape(); } },
    // the spec's mix: the pot 45%, the candle 25%, which table is uniform 15%, who is faster 10%, a rate continued 5%
    { title: 'קצב אחיד ולא אחיד', gen: () => { const r = Math.random(); return r < 0.45 ? heatItem() : r < 0.7 ? candleItem() : r < 0.85 ? uniformMc() : r < 0.95 ? fasterMc() : continueRate(); } },
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
    'rtl-read': 'ענו את אורך התחום השני (יורד במקום עולה, או להפך), כמו מי שקורא את הגרף מימין לשמאל',
    'y-not-x': 'ענו בערך של $y$ (השינוי או הגובה), אבל התחום נמדד על ציר $x$',
    'from-zero': 'חישבו את הקצב כאילו ההתחלה הייתה $0$',
    'whole-change': 'ענו את כל השינוי, ולא את השינוי ליחידה אחת',
    'wrong-unknown': 'ענו כמה זמן נשאר מעכשיו, ולא מתי זה נגמר מההתחלה',
    'height-for-slope': 'בחרו לפי הגובה של הקו ולא לפי התלילות שלו',
  },
  lesson: {
    // one point per stair, each landing with its stair
    points: [
      'גרף של מצב קוראים בשני כיוונים: מ־$x$ אל $y$ (מה היה ברגע הזה) ומ־$y$ אל $x$ (מתי זה היה).',
      'קו שטוח בגרף אומר שהערך לא השתנה, לא שהדרך שטוחה.',
      'פונקציה נותנת לכל $x$ ערך אחד בלבד של $y$: $y = 7x + 2$ נותן ל־$x = 5$ את $37$.',
      'עולה, יורדת או קבועה: קוראים משמאל לימין, כש־$x$ גדל. התחום הוא קטע על ציר $x$.',
      'קצב השינוי הוא השינוי ב־$y$ לכל יחידה של $x$: מ־$8^\\circ$ ל־$58^\\circ$ ב־$5$ דקות זה $10^\\circ$ בדקה.',
      'קצב אחיד נותן גרף ישר; גרף תלול יותר משתנה מהר יותר, גם אם הוא נמוך יותר.',
    ],
    words: ['גרף של מצב', 'ציר', 'משבצת', 'נקודה על גרף', 'קנה מידה של ציר', 'משך זמן', 'פונקציה', 'ערך הפונקציה', 'משתנה בלתי תלוי', 'ייצוג', 'טבלת ערכים', 'פונקציה קבועה', 'עולה', 'יורדת', 'קבועה', 'תחום', 'שיא', 'משמאל לימין', 'קצב שינוי', 'קצב אחיד', 'קצב לא אחיד', 'תלול', 'ליחידה אחת'],
  },
};
