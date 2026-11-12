// Data and frequency (נתונים ושכיחות): the Ministry's ז׳ unit "איסוף, ייצוג וקריאת מידע, שכיחות" with its three
// sub-topics (January–February), and in the תשפ״ז transition year also ח׳'s unit 8.6 (October–November) and the base of
// ח׳'s "הסתברות א – בסיס" (March) (curriculum stage 3, DATA-4). Four stairs: reading charts and a frequency table,
// relative frequency, relative frequency in percent and the pie chart, and probability from relative frequency.
// Taught from January in ז׳ (and October in ח׳ this year), so the first-day placement test skips it (placement: false).
// It has no alsoFor: the ח׳ path draws it through learn/skills.ts ALSO_ON_PATH, and Exam Rescue reads that path.
//
// The diagnostic models (DATA1 to DATA4J) are the stage-3 spec's (scratchpad/lanes/stage3/spec/models.mjs, with the
// critique's data2, data4T and data4J), ported unchanged. Two redraw rules: `clean` for counts and percents (stage 1's:
// no prediction is a slip of the hand, within 0.06 of the answer or of another prediction) and `cleanP` for relative
// frequencies and probabilities (no typed form of a prediction is marked right by the precise rule, no typed right answer
// reads as a prediction, no prediction is a slip, no two predictions have the same value). A generator built on a model
// diagnoses with the model's predictions (diagOf). Every relative frequency and probability is `precise`.
// The numbers and situations of the Ministry's examples (the sports survey, the headache ad, the two classes, the busy
// junction, the 500 calls, the colour survey, the spinner turned 1000 times, the bag of 24 marbles) and the structure
// of RAMA's joining survey (retold: 300, 10%, 60) are facts; every sentence here is the app's own. Errors and sources:
//   scale-units      grid squares counted as ones, the axis's step not read (Friel, Curcio & Bright 2001, JRME 32(2))
//   one-value        "how many more" answered as "how many" (Hudson 1983, Child Development 54(1))
//   icon-count       a pictogram's icons counted and the key forgotten (teacher-reported; the Ministry's key items)
//   half-icon        half an icon counted as a whole one (teacher-reported)
//   truncated-axis   bars compared on an axis that does not start at 0 (Pandey et al. 2015, CHI; the Ministry's ad)
//   part-part        the part over the rest, not over all (the part–whole confusion of ratio work, Lamon 2012)
//   freq-only        the frequency written for the relative frequency (teacher-reported)
//   per-category     every row taken as an equal share (Weizmann unit 18: Gila's 1/7)
//   bigger-count     groups of different sizes compared by counts (Watson & Moritz 1999, ESM)
//   pct-for-dec      the share written in percent where a fraction or a decimal is asked (critique; ח׳ after pct)
//   div-by-rel       the total divided by the relative frequency instead of multiplied (critique)
//   pie-not-whole    a pie of numbers that are not parts of one whole (Weizmann unit 18, task 5)
//   equiprob         every kind taken as equally likely (Lecoutre 1992, ESM 23(6))
//   old-total, new-not-counted, old-rel   a share over the wrong total after a group grew (RAMA's structure)
//   rel-not-scaled   stopped at the share of the draws (teacher-reported; the Ministry's bag)
//   draws-as-count   the times a colour came out taken as the number of balls (critique)
//   small-sample     a few trials taken as the probability (Tversky & Kahneman 1971)
//   count-as-pct, div-by-pct, pct-of-part, stop-at-one, inverse-ratio   pct's ids and meanings (content/pct.js)
import { shuffle, listMath } from './util.js';
import { diagOf } from './eq.js';
import { r9 } from './frac.js';
import { simDiag } from './manip.js';
import { slipOf, matchesValue, roundAway } from '@/learn/misconceptions.ts';

const rnd = () => Math.random();
const rint = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const shuf = (r, a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i -= 1) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const sum = (a) => a.reduce((x, y) => x + y, 0);
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; };
const same = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
const whole = (v) => Math.abs(v - Math.round(v)) <= 1e-9;
/** Every prediction of a model for one draw. */
export const bugsAt = (model, p) => Object.fromEntries(Object.entries(model.bugs).map(([id, f]) => [id, f(p)]));
/**
 * diagOf, carrying the answers it can name (its predictions): content/index.js namesOf reads them instead of trying
 * thousands of typed numbers, so the probe of a verification after a repair (a misconception only some of these
 * exercises show, learn/items.ts genProbe) is found at once and not after seconds of search
 */
export function diagWith(ans, bugs) {
  const d = diagOf(ans, bugs);
  d.wrongs = Object.values(bugs).filter((v) => v != null && Number.isFinite(v));
  return d;
}
/** A number as written: 0.45, 2.5 (never 0.45000000001). */
export const num = (v) => String(r9(v));
/** At most three decimal places (content/util.js shortDec). */
const shortDec = (x) => Math.abs(Math.round(x * 1000) - x * 1000) < 1e-6;
/** content/util.js numRight(u, a, true), the precise rule. */
const numRightP = (u, a) => Math.abs(u - a) <= 1e-6 || (!shortDec(a) && shortDec(u) && Math.abs(u - a) < 0.005 + 1e-9);

// ---------------------------------------------------------------- the two redraw rules (models.mjs, unchanged)

/** Stage 1's rule: no prediction a slip, within 0.06 of the answer, or within 0.06 of another prediction. */
export function clean(model, p) {
  const ans = model.answer(p);
  const vals = [];
  for (const f of Object.values(model.bugs)) {
    const v = f(p);
    if (v == null) continue;
    if (!Number.isFinite(v)) return false;
    if (Math.abs(v - ans) < 1e-9) continue;
    if (slipOf(v, ans)) return false;
    if (Math.abs(v - ans) <= 0.06) return false;
    vals.push(v);
  }
  for (let i = 0; i < vals.length; i += 1) for (let j = i + 1; j < vals.length; j += 1) {
    const d = Math.abs(vals[i] - vals[j]);
    if (d > 1e-9 && d <= 0.06) return false;
  }
  return true;
}
/** How a student may type a value: exactly, or as a decimal to tenths, hundredths or thousandths. */
const typed = (v) => [v, roundAway(v, 1), roundAway(v, 2), roundAway(v, 3)];
/** The exact-typing rule for answers in [0, 1] (relative frequencies and probabilities). */
export function cleanP(model, p) {
  const ans = model.answer(p);
  const vals = [];
  for (const f of Object.values(model.bugs)) {
    const v = f(p);
    if (v == null) continue;
    if (!Number.isFinite(v)) return false;
    if (same(v, ans)) continue;
    if (slipOf(v, ans)) return false;
    if (typed(v).some((t) => numRightP(t, ans))) return false; // a prediction typed as a decimal would be marked right
    if ([ans, roundAway(ans, 2), roundAway(ans, 3)].some((t) => matchesValue(v, t, ans))) return false; // a right answer read as it
    if (vals.some((w) => same(w, v))) return false; // two predictions, one value
    vals.push(v);
  }
  return true;
}
const draw = (model, raw, rule) => (r) => { for (;;) { const p = raw(r); if (p && rule(model, p)) return p; } };
export function mk(m, rule = clean) { m.params = draw(m, m.raw, rule); m.rule = rule === cleanP ? 'P' : '0.06'; return m; }

// ---------------------------------------------------------------- the models' draws (spec/models.mjs, unchanged)

/** data:1 — a bar chart (four categories, the axis every step s, no numbers on the bars): how many more chose A than B? */
export const DATA1 = mk({
  raw: (r) => {
    const s = pick(r, [2, 5, 10]); const ks = shuf(r, [1, 2, 3, 4, 5, 6, 7, 8]).slice(0, 4);
    const i = rint(r, 0, 3); const j = rint(r, 0, 3); if (j === i) return null;
    if (ks[i] <= ks[j]) return null;
    return { s, vals: ks.map((k) => k * s), i, j, max: 9 * s };
  },
  answer: ({ vals, i, j }) => vals[i] - vals[j],
  bugs: {
    'scale-units': ({ vals, i, j, s }) => (vals[i] - vals[j]) / s, // grid squares counted, the scale not read
    'one-value': ({ vals, i }) => vals[i], // "how many more" answered as "how many"
  },
});
/** data:1 transfer — a pictogram: one icon is k children, half an icon k/2; how many chose X? */
export const DATA1T = mk({
  raw: (r) => {
    const k = pick(r, [2, 4, 6, 10]); const icons = Array.from({ length: 4 }, () => rint(r, 2, 12) / 2);
    const x = rint(r, 0, 3); if (icons[x] < 1.5) return null;
    return { k, icons, x };
  },
  answer: ({ k, icons, x }) => icons[x] * k,
  bugs: {
    'icon-count': ({ icons, x }) => icons[x], // the icons counted, the key forgotten
    'half-icon': ({ k, icons, x }) => (icons[x] % 1 ? Math.ceil(icons[x]) * k : null), // half an icon taken as a whole
  },
});

/** data:2 — a frequency table of four answers (total 20, 25, 40 or 50, not printed): the relative frequency of one. */
export const DATA2 = mk({
  raw: (r) => {
    const f = Array.from({ length: 4 }, () => rint(r, 2, 16)); const N = sum(f);
    if (![20, 25, 40, 50].includes(N)) return null;
    const j = rint(r, 0, 3); return { f, N, j };
  },
  answer: ({ f, N, j }) => f[j] / N,
  bugs: {
    'part-part': ({ f, N, j }) => f[j] / (N - f[j]), // the part against the rest, not the whole
    'inverse-ratio': ({ f, N, j }) => N / f[j], // the whole divided by the part
    'freq-only': ({ f, j }) => f[j], // the frequency itself, not its share
    'per-category': () => 1 / 4, // each of the 4 rows taken as an equal part (Gila's 1/7)
    'pct-for-dec': ({ f, N, j }) => (100 * f[j]) / N, // the share written in percent, 45 for 0.45
  },
}, cleanP);
/**
 * data:2 transfer — two classes of different sizes (the Ministry's 20 of 40 and 15 of 25): the class with more of them has
 * the smaller share. The larger relative frequency.
 */
export const DATA2T = mk({
  raw: (r) => {
    const n1 = pick(r, [20, 25, 40, 50]); const n2 = pick(r, [20, 25, 40, 50]); if (n1 === n2) return null;
    const k1 = rint(r, 2, n1 - 2); const k2 = rint(r, 2, n2 - 2);
    if (!(k1 > k2 && k1 / n1 < k2 / n2)) return null;
    return { n1, k1, n2, k2 };
  },
  answer: ({ n2, k2 }) => k2 / n2,
  bugs: {
    'bigger-count': ({ n1, k1 }) => k1 / n1, // the class with more of them taken as the one with the larger share
    'part-part': ({ n2, k2 }) => k2 / (n2 - k2),
  },
}, cleanP);

/** data:3 — a pie in percents (multiples of 5, three or four slices) of N pupils: how many chose X? */
export const DATA3 = mk({
  raw: (r) => {
    const N = pick(r, [40, 60, 80, 120, 200, 240, 300, 400]);
    const k = pick(r, [3, 4]); const ps = [];
    let left = 100;
    for (let i = 0; i < k - 1; i += 1) { const p = 5 * rint(r, 2, Math.min(12, left / 5 - 2 * (k - 1 - i))); ps.push(p); left -= p; }
    ps.push(left); if (left < 10) return null;
    if (new Set(ps).size !== ps.length) return null;
    const x = rint(r, 0, k - 1); if (!whole((ps[x] * N) / 100)) return null;
    return { N, ps, x };
  },
  answer: ({ N, ps, x }) => (ps[x] * N) / 100,
  bugs: {
    'count-as-pct': ({ ps, x }) => ps[x], // the percent read as the count
    'div-by-pct': ({ N, ps, x }) => N / ps[x], // the total divided by the percent
  },
});
/** data:3 transfer — "75 chose blue, 30% of the grade": the whole from a count and its percent. */
export const DATA3T = mk({
  raw: (r) => {
    const p = pick(r, [10, 20, 25, 30, 40, 50, 60, 75]); const N = 10 * rint(r, 4, 40);
    const c = (p * N) / 100; if (!whole(c)) return null;
    return { p, N, c };
  },
  answer: ({ N }) => N,
  bugs: {
    'pct-of-part': ({ c, p }) => (c * p) / 100, // p% of the count, not the whole
    'stop-at-one': ({ c, p }) => c / p, // found 1% and stopped
  },
});

/** data:4 — picking at random from a table (three or four kinds, 8 to 30 items): the probability of kind j is c/N. */
export const DATA4 = mk({
  raw: (r) => {
    const k = pick(r, [3, 4]); const c = Array.from({ length: k }, () => rint(r, 1, 9)); const N = sum(c);
    if (N < 8 || N > 30) return null; const j = rint(r, 0, k - 1);
    return { c, N, j, k };
  },
  answer: ({ c, N, j }) => c[j] / N,
  bugs: {
    equiprob: ({ k }) => 1 / k, // every kind taken as equally likely
    'part-part': ({ c, N, j }) => c[j] / (N - c[j]),
  },
}, cleanP);
/**
 * data:4 transfer — the Ministry's ז׳ bag: B balls, n draws with return, w of one colour; about how many of that colour
 * are in the bag? c = B·w/n.
 */
export const DATA4T = mk({
  raw: (r) => {
    const B = pick(r, [20, 24, 30, 40]); const n = pick(r, [100, 120, 150, 200]);
    const c = rint(r, 2, B - 2); const w = (c * n) / B; if (!whole(w)) return null;
    return { B, n, w, c };
  },
  answer: ({ c }) => c,
  bugs: {
    'rel-not-scaled': ({ w, n }) => w / n, // the share of the draws, not of the bag
    'draws-as-count': ({ w }) => w, // the times the colour came out, as the number of balls
  },
});
/**
 * data:4 joinTotal (RAMA's structure, retold): a survey of N in percents; then m more pupils, all of kind X, join.
 * The probability of X is (pN/100 + m)/(N + m).
 */
export const DATA4J = mk({
  raw: (r) => {
    const N = pick(r, [100, 200, 300, 400]); const p = pick(r, [10, 15, 20, 25, 30, 40]); const m = 10 * rint(r, 1, 6);
    return { N, p, m, x: (p * N) / 100 };
  },
  answer: ({ N, m, x }) => (x + m) / (N + m),
  bugs: {
    'old-total': ({ N, m, x }) => (x + m) / N, // the newcomers added on top, the total left as it was
    'new-not-counted': ({ N, m, x }) => x / (N + m), // the total grew, the count did not
    'old-rel': ({ p }) => p / 100, // the old share, as if nothing changed
  },
}, cleanP);

// ---------------------------------------------------------------- names, colours and figures

export const SPORTS = ['כדורגל', 'כדורסל', 'שחייה', 'טניס', 'ריקוד', 'ג׳ודו'];
/** Four sports for a chart, chosen by its numbers (the same draw always shows the same names). */
export const sportsOf = (vals, s) => { const o = (vals[0] / s + vals[1] / s) % 3; return SPORTS.slice(o, o + 4); };
export const GENRES = ['מתח', 'הרפתקאות', 'קומיקס', 'מדע בדיוני'];
export const WAYS = ['ברגל', 'באוטובוס', 'באופניים', 'ברכב'];
export const HOBBIES = ['ספורט', 'קריאה', 'מוזיקה', 'מחשב'];
/** Colours of pencils and balls in words (a table or a sentence; nothing drawn: a drawn colour is named by TONE_WORDS). */
export const COLOURS = [
  { one: 'אדום', many: 'אדומים' }, { one: 'כחול', many: 'כחולים' },
  { one: 'ירוק', many: 'ירוקים' }, { one: 'צהוב', many: 'צהובים' },
];
/** A colour by the numbers of a draw. */
const colourOf = (...vals) => COLOURS[Math.abs(Math.round(sum(vals))) % COLOURS.length];

/** A bar chart: categories right to left, no number on a bar unless `labels`. */
export const barFig = (cats, values, { step, max, every, from, unit, labels = false } = {}) => ({
  type: 'chart', mode: 'bar', cats, values, ...(step ? { step } : {}), ...(max != null ? { max } : {}), ...(every ? { every } : {}),
  ...(from != null ? { from } : {}), ...(unit ? { unit } : {}), ...(labels ? {} : { labels: false }),
});
export const pieFig = (cats, values, extra = {}) => ({ type: 'chart', mode: 'pie', cats, values, ...extra });
export const pictoFig = (cats, values, key, unit = 'ילדים') => ({ type: 'chart', mode: 'picto', cats, values, key, unit, icon: 'person' });
export const tableFig = (head, rows) => ({ type: 'table', head, rows });

/**
 * A share as exact TeX: a over N, in lowest terms when it reduces, then its decimal (= 0.45, or ≈ 0.29 when it has no
 * short one). The worked solutions end with it, so they reach the answer the checker accepts.
 */
export function relTex(a, N) {
  const g = gcd(a, N); const v = a / N;
  const parts = [`\\frac{${a}}{${N}}`];
  if (g > 1 && N / g !== 1) parts.push(`\\frac{${a / g}}{${N / g}}`);
  const tail = shortDec(v) ? `= ${num(v)}` : `\\approx ${String(Math.round(v * 100) / 100)}`;
  return `${parts.join(' = ')} ${tail}`;
}

// ---------------------------------------------------------------- shared words (the models' texts and solutions)

/** data:1: how many more chose A than B. */
export const data1Names = (p) => sportsOf(p.vals, p.s);
export const data1Fig = (p) => barFig(data1Names(p), p.vals, { step: p.s, max: p.max, unit: 'מספר תלמידים' });
export const data1Text = (p) => { const n = data1Names(p); return `לפי הדיאגרמה, כמה תלמידים יותר בחרו ב${n[p.i]} מאשר ב${n[p.j]}?`; };
export function data1Solution(p) {
  const n = data1Names(p); const a = p.vals[p.i]; const b = p.vals[p.j];
  return [`הציר קופץ ב־$${p.s}$.`, `העמודה של ${n[p.i]} מגיעה ל־$${a}$, והעמודה של ${n[p.j]} ל־$${b}$.`, `$${a} - ${b} = ${a - b}$`];
}
export const data1Hint = () => 'קודם בודקים בכמה קופץ הציר, ואז קוראים את המספר שליד ראש כל עמודה.';

/** data:1 transfer: a pictogram row. */
export const data1TFig = (p) => pictoFig(GENRES, p.icons.map((n) => n * p.k), p.k);
export const data1TText = (p) => `כל סמל הוא $${p.k}$ ילדים. כמה ילדים בחרו בספרי ${GENRES[p.x]}?`;
export function data1TSolution({ k, icons, x }) {
  const n = icons[x]; const full = Math.floor(n); const ans = n * k;
  const fullWords = full === 1 ? `סמל שלם אחד הוא $${k}$ ילדים.` : `$${full}$ סמלים שלמים הם $${full} \\cdot ${k} = ${full * k}$ ילדים.`;
  if (n === full) return [fullWords, `בספרי ${GENRES[x]}: $${ans}$ ילדים.`];
  return [fullWords, `חצי סמל הוא חצי מ־$${k}$, כלומר $${k / 2}$.`, `$${full * k} + ${k / 2} = ${ans}$`];
}
export const data1THint = () => 'בודקים במקרא כמה ילדים הם סמל אחד. חצי סמל הוא חצי מזה.';

/** data:2: the relative frequency of one answer. */
export const data2Fig = (p) => tableFig(['איך מגיעים לבית הספר', 'מספר תלמידים'], WAYS.map((w, i) => [w, p.f[i]]));
export const data2Text = (p) => `מה השכיחות היחסית של מי שמגיעים ${WAYS[p.j]}? כתבו כשבר או כמספר עשרוני.`;
export const data2Solution = (p) => [`סך הכול: $${p.f.join(' + ')} = ${p.N}$ תלמידים.`, `השכיחות חלקי סך הכול: $${relTex(p.f[p.j], p.N)}$`];
export const data2Hint = () => 'מחלקים את השכיחות במספר כל הנתונים. כמה תלמידים יש בטבלה כולה?';

/** data:2 transfer: two classes; which class is told first is chosen by the numbers. */
const firstIsOne = (p) => (p.k1 + p.k2) % 2 === 0;
export function data2TText(p) {
  const [a, b] = firstIsOne(p) ? [[p.n1, p.k1], [p.n2, p.k2]] : [[p.n2, p.k2], [p.n1, p.k1]];
  return `בכיתה אחת $${a[0]}$ תלמידים, ו־$${a[1]}$ מהם מנגנים. בכיתה אחרת $${b[0]}$ תלמידים, ו־$${b[1]}$ מהם מנגנים. מה השכיחות היחסית של המנגנים בכיתה שבה היא גדולה יותר?`;
}
export function data2TSolution(p) {
  const rows = firstIsOne(p) ? [[p.n1, p.k1], [p.n2, p.k2]] : [[p.n2, p.k2], [p.n1, p.k1]];
  return [
    ...rows.map(([n, k]) => `בכיתה של $${n}$ תלמידים: $${relTex(k, n)}$`),
    `הגדולה מבין השתיים: $${num(p.k2 / p.n2)}$, בכיתה שבה יש פחות מנגנים.`,
  ];
}
export const data2THint = () => 'מחשבים בכל כיתה את החלק: המנגנים חלקי כל התלמידים בכיתה. משווים חלקים, לא כמויות.';

/** data:3: a pie in percents of N pupils. */
export const data3Fig = (p) => pieFig(HOBBIES.slice(0, p.ps.length), p.ps, { pct: true });
export const data3Text = (p) => `בסקר השתתפו $${p.N}$ תלמידים, וכל אחד בחר את התחביב האהוב עליו. כמה תלמידים בחרו ב${HOBBIES[p.x]}?`;
export function data3Solution({ N, ps, x }) {
  const q = ps[x]; const ans = (q * N) / 100;
  return [`בעוגה, ל${HOBBIES[x]} $${q}\\%$.`, `$${q}\\% = ${num(q / 100)}$, ולכן $${num(q / 100)} \\cdot ${N} = ${num(ans)}$`];
}
export const data3Hint = ({ N }) => `אפשר להתחיל מ־$10\\%$ מ־$${N}$, שהם $${num(N / 10)}$.`;

/** data:3 transfer: the whole from a count and its percent. */
const hobbyOf = (p) => HOBBIES[(p.p / 5 + p.c) % HOBBIES.length];
export const data3TFig = (p) => pieFig([hobbyOf(p), 'אחר'], [p.p, 100 - p.p], { pct: true });
export const data3TText = (p) => `$${p.c}$ תלמידים בחרו ב${hobbyOf(p)}, והם $${p.p}\\%$ מהשכבה. כמה תלמידים בשכבה?`;
export const data3TSolution = ({ p, c, N }) => [`$1\\%$ הוא $${c} : ${p} = ${num(c / p)}$.`, `$100\\%$ הם $${num(c / p)} \\cdot 100 = ${N}$`, `בדיקה: $${p}\\%$ מ־$${N}$ הם $${c}$.`];
export const data3THint = ({ p, c }) => `$${c}$ תלמידים הם רק $${p}\\%$ מהשכבה. כמה הם $1\\%$? וכמה $100\\%$?`;

/** data:4: picking a pencil at random from a box. */
export const data4Fig = (p) => tableFig(['צבע', 'מספר עפרונות'], p.c.map((n, i) => [COLOURS[i].one, n]));
export const data4Text = (p) => `בקופסה עפרונות בכמה צבעים, כמו בטבלה. מוציאים עיפרון אחד באקראי. מה ההסתברות שהוא ${COLOURS[p.j].one}?`;
export const data4Solution = (p) => [`בקופסה $${p.c.join(' + ')} = ${p.N}$ עפרונות.`, `$${p.c[p.j]}$ מהם ${COLOURS[p.j].many}: $${relTex(p.c[p.j], p.N)}$`];
export const data4Hint = () => 'ההסתברות היא השכיחות היחסית: כמה עפרונות בצבע הזה, מתוך כל העפרונות.';

/** data:4 transfer: about how many balls of a colour are in the bag. */
export const data4TColour = (p) => colourOf(p.B, p.n, p.w);
export function data4TText(p) {
  const col = data4TColour(p);
  return `בשקית $${p.B}$ כדורים. $${p.n}$ פעמים הוציאו כדור, רשמו את הצבע והחזירו, ו־$${p.w}$ פעמים יצא כדור ${col.one}. כמה כדורים ${col.many} יש בשקית, בערך?`;
}
export const data4TSolution = (p) => [`הכדור ה${data4TColour(p).one} יצא ב־$\\frac{${p.w}}{${p.n}}$ מההוצאות.`, `בערך אותו חלק מ־$${p.B}$ הכדורים: $\\frac{${p.w}}{${p.n}} \\cdot ${p.B} = ${p.c}$`];
export const data4THint = () => 'קודם השכיחות היחסית של הצבע בהוצאות. בערך אותו חלק מהשקית הם הכדורים בצבע הזה.';

/** data:4 joinTotal: a survey that grew. */
export const data4JText = (p) => `בסקר השתתפו $${p.N}$ תלמידים, ו־$${p.p}\\%$ מהם לא חברים באף חוג. אחר כך הצטרפו עוד $${p.m}$ תלמידים, וכולם לא חברים באף חוג. בוחרים באקראי תלמיד מכל המשתתפים. מה ההסתברות שהוא לא חבר באף חוג?`;
export const data4JSolution = (p) => [
  `$${p.p}\\%$ מ־$${p.N}$ הם $${p.x}$ תלמידים.`,
  `עכשיו יש $${p.x} + ${p.m} = ${p.x + p.m}$ תלמידים בלי חוג, מתוך $${p.N} + ${p.m} = ${p.N + p.m}$.`,
  `$${relTex(p.x + p.m, p.N + p.m)}$`,
];
export const data4JHint = () => 'גם החלק וגם השלם גדלו: מוסיפים את החדשים לשניהם.';

// ---------------------------------------------------------------- data:1 generators

/** One bar read off the axis (the first reading level): practice only, the answer is an axis label. */
function barRead() {
  const p = DATA1.params(rnd); const n = data1Names(p); const v = p.vals[p.i];
  return {
    key: `da1r:${p.s}:${p.vals.join(',')}:${p.i}`, text: `לפי הדיאגרמה, כמה תלמידים בחרו ב${n[p.i]}?`, fig: data1Fig(p),
    form: 'num', answer: v, practiceOnly: true,
    hint: 'מסתכלים על ראש העמודה, ומשם ישר אל המספר שעל הציר. בכמה קופץ הציר?',
    solution: [`הציר קופץ ב־$${p.s}$.`, `העמודה של ${n[p.i]} מגיעה ל־$${v}$.`],
    diag: diagWith(v, { 'scale-units': v / p.s }),
  };
}
/** How many more chose A than B (the model's own draw). */
function barDiff() {
  const p = DATA1.params(rnd); const ans = DATA1.answer(p);
  return {
    key: `da1d:${p.s}:${p.vals.join(',')}:${p.i}:${p.j}`, text: data1Text(p), fig: data1Fig(p), form: 'num', answer: ans,
    hint: data1Hint(), solution: data1Solution(p), diag: diagWith(ans, bugsAt(DATA1, p)),
  };
}
/** A pictogram row (the transfer model's own draw). */
function picto() {
  const p = DATA1T.params(rnd); const ans = DATA1T.answer(p);
  return {
    key: `da1p:${p.k}:${p.icons.join(',')}:${p.x}`, text: data1TText(p), fig: data1TFig(p), form: 'num', answer: ans,
    hint: data1THint(), solution: data1TSolution(p), diag: diagWith(ans, bugsAt(DATA1T, p)),
  };
}
const PETS = ['כלב', 'חתול', 'דגים', 'ציפור', 'ארנב', 'אוגר'];
/** The total of a frequency table: how many answered (the sum is never one of the counts). */
function tableTotal() {
  for (;;) {
    const k = rint(rnd, 4, 6); const counts = Array.from({ length: k }, () => rint(rnd, 2, 15)); const N = sum(counts);
    if (counts.includes(N)) continue;
    return {
      key: `da1t:${counts.join(',')}`, text: 'שאלנו ילדים איזו חיית מחמד הם הכי אוהבים. כמה ילדים ענו על הסקר?',
      fig: tableFig(['חיה', 'מספר ילדים'], counts.map((c, i) => [PETS[i], c])), form: 'num', answer: N,
      hint: 'כל ילד ענה פעם אחת, ולכן מחברים את מספרי הילדים בכל השורות.',
      solution: [`מחברים את השכיחויות: $${counts.join(' + ')} = ${N}$`, `$${N}$ ילדים ענו על הסקר.`],
      diag: () => null,
    };
  }
}
const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי'];
/** The bottle drive (the Ministry's): bottles a day on a line chart, the axis every step; by how much it rose. */
export const LINE = mk({
  raw: (r) => {
    const step = pick(r, [5, 10]); const ks = Array.from({ length: 5 }, () => rint(r, 1, 9));
    const a = rint(r, 0, 3); const b = rint(r, a + 1, 4); if (ks[b] <= ks[a]) return null;
    return { step, vals: ks.map((k) => k * step), a, b };
  },
  answer: ({ vals, a, b }) => vals[b] - vals[a],
  bugs: { 'scale-units': ({ vals, a, b, step }) => (vals[b] - vals[a]) / step },
});
function lineRead() {
  const p = LINE.params(rnd); const ans = LINE.answer(p);
  return {
    key: `da1l:${p.step}:${p.vals.join(',')}:${p.a}:${p.b}`,
    text: `בגרף: כמה בקבוקים אספה הכיתה בכל יום. בכמה עלה מספר הבקבוקים מיום ${DAYS[p.a]} ליום ${DAYS[p.b]}?`,
    fig: { type: 'chart', mode: 'line', xs: DAYS, values: p.vals, step: p.step, max: 10 * p.step, labels: false, unit: 'מספר בקבוקים' },
    form: 'num', answer: ans,
    hint: 'קוראים על הציר את הערך של כל אחד משני הימים, ואז מחסרים.',
    solution: [`הציר קופץ ב־$${p.step}$.`, `ביום ${DAYS[p.a]} $${p.vals[p.a]}$ בקבוקים, וביום ${DAYS[p.b]} $${p.vals[p.b]}$.`, `$${p.vals[p.b]} - ${p.vals[p.a]} = ${ans}$`],
    diag: diagWith(ans, bugsAt(LINE, p)),
  };
}
/** How often a value appears in a list (practice only: the answer can be a number printed in the list). */
function listCount() {
  const n = rint(rnd, 12, 20); const list = Array.from({ length: n }, () => rint(rnd, 0, 5)); const v = pick(rnd, list);
  const c = list.filter((x) => x === v).length;
  return {
    key: `da1c:${list.join(',')}:${v}`, text: `שאלנו ילדים כמה אחים ואחיות יש להם, ואלה התשובות: ${listMath(list)}. כמה ילדים ענו $${v}$?`,
    form: 'num', answer: c, practiceOnly: true,
    hint: 'עוברים על הרשימה לפי הסדר, ומסמנים קו בכל פעם שמופיע המספר.',
    solution: [`סופרים את המספר $${v}$ ברשימה: הוא מופיע $${c}$ פעמים.`, `השכיחות של $${v}$ היא $${c}$.`],
    diag: () => null,
  };
}
/** Groups for a frequency table: disjoint and covering every answer (the curriculum's "זרות וממצות"). Practice only. */
const GROUPINGS = [
  { q: 'כמה דקות אתם הולכים לבית הספר?', ok: '0 עד 9, 10 עד 19, 20 ומעלה', overlap: '0 עד 10, 10 עד 20, 20 עד 30', gap: 'פחות מ־10, יותר מ־20',
    why: ['מי שהולך $10$ דקות נכנס בחלוקה השנייה לשתי קבוצות, ומי שהולך $35$ לאף אחת.', 'בחלוקה השלישית מי שהולך $15$ דקות לא נכנס לאף קבוצה.'] },
  { q: 'כמה עמודים קראתם השבוע?', ok: '0 עד 49, 50 עד 99, 100 ומעלה', overlap: '0 עד 50, 50 עד 100, 100 עד 150', gap: 'פחות מ־50, יותר מ־100',
    why: ['מי שקרא $50$ עמודים נכנס בחלוקה השנייה לשתי קבוצות, ומי שקרא $160$ לאף אחת.', 'בחלוקה השלישית מי שקרא $70$ עמודים לא נכנס לאף קבוצה.'] },
  { q: 'כמה שעות ישנתם בלילה?', ok: 'פחות מ־7, 7 עד 8, 9 ומעלה', overlap: '6 עד 8, 8 עד 10, 10 עד 12', gap: 'פחות מ־7, יותר מ־9',
    why: ['מי שישן $8$ שעות נכנס בחלוקה השנייה לשתי קבוצות, ומי שישן $5$ לאף אחת.', 'בחלוקה השלישית מי שישן $8$ שעות לא נכנס לאף קבוצה.'] },
];
function groupsMc() {
  const g = pick(rnd, GROUPINGS);
  const choices = shuffle([{ text: g.ok, ok: true }, { text: g.overlap, ok: false }, { text: g.gap, ok: false }]);
  return {
    key: `da1g:${GROUPINGS.indexOf(g)}`, text: `שאלנו "${g.q}". איזו חלוקה לקבוצות מתאימה לטבלת שכיחויות?`,
    form: 'mc', choices, answer: choices.findIndex((c) => c.ok), practiceOnly: true,
    hint: 'כל תשובה צריכה להיכנס לקבוצה אחת בדיוק: לא לשתיים, ולא לאף אחת.',
    solution: ['בחלוקה טובה כל תשובה נכנסת לקבוצה אחת בדיוק: הקבוצות לא נוגעות זו בזו ולא משאירות חורים.', ...g.why],
    diag: () => null,
  };
}
const FRUITS = ['תפוח', 'בננה', 'ענבים', 'אבטיח'];
/** Build a bar chart from a table (practice only: the object shows each value as it is set). */
function buildBar() {
  const step = pick(rnd, [2, 5]); const counts = Array.from({ length: 4 }, () => step * rint(rnd, 1, 7));
  const max = 8 * step;
  return {
    key: `da1b:${step}:${counts.join(',')}`, text: 'בנו את הדיאגרמה לפי הטבלה.',
    fig: tableFig(['פרי', 'מספר ילדים'], counts.map((c, i) => [FRUITS[i], c])),
    form: 'manip', practiceOnly: true,
    manip: { kind: 'chart', mode: 'bar', cats: FRUITS, start: [0, 0, 0, 0], bar: { max, step, every: 2, unit: 'מספר ילדים', unitWord: 'ילדים' } },
    answer: { values: counts },
    hint: `גררו כל עמודה עד הקו של המספר שלה. הציר קופץ ב־$${step}$.`,
    solution: [`הציר קופץ ב־$${step}$: כל משבצת היא $${step}$ ילדים.`, `${FRUITS.map((f, i) => `${f} $${counts[i]}$`).join(', ')}.`],
    diag: () => null,
  };
}
const CANDIDATES = ['נועה', 'עומר', 'מאיה', 'דניאל'];
/** An axis that does not start at 0 (the Ministry's headache ad): the bars look r times apart. Practice only. */
function axisMc() {
  const from = pick(rnd, [40, 50, 60, 70, 80]); const d = rint(rnd, 1, 4); const r = rint(rnd, 2, 4);
  const b = from + d; const a = from + r * d; const step = a - from > 10 ? 5 : 2;
  const o = rint(rnd, 0, 2); const A = CANDIDATES[o]; const B = CANDIDATES[o + 1];
  const choices = shuffle([{ text: `לא: ${a} לעומת ${b}, הפרש של ${a - b} בלבד`, ok: true }, { text: `כן, פי ${r}`, ok: false, bug: 'truncated-axis' }]);
  return {
    key: `da1a:${from}:${a}:${b}:${o}`,
    text: `בבחירות לנציג השכבה קיבלו ${A} $${a}$ קולות ו${B} $${b}$ קולות. בדיאגרמה, העמודה של ${A} נראית גבוהה פי $${r}$ מזו של ${B}. זה נכון?`,
    fig: barFig([A, B], [a, b], { from, step, max: from + (Math.ceil((a - from) / step) + 1) * step, unit: 'מספר קולות', labels: true }),
    form: 'mc', choices, answer: choices.findIndex((c) => c.ok), practiceOnly: true,
    hint: 'מאיפה מתחיל הציר?',
    solution: [`הציר מתחיל ב־$${from}$, ולכן רואים רק את מה שמעל $${from}$: $${a - from}$ מול $${b - from}$.`, `במציאות $${a}$ ו־$${b}$ קרובים: ההפרש רק $${a - b}$.`],
    diag: (u) => choices[u]?.bug || null,
  };
}

// ---------------------------------------------------------------- data:2 generators

/** The relative frequency of one answer in a table (the model's own draw). */
function relFreq() {
  const p = DATA2.params(rnd); const ans = DATA2.answer(p);
  return {
    key: `da2:${p.f.join(',')}:${p.j}`, text: data2Text(p), fig: data2Fig(p), form: 'num', answer: ans, precise: true,
    hint: data2Hint(), solution: data2Solution(p), diag: diagWith(ans, bugsAt(DATA2, p)),
  };
}
/** The larger relative frequency of two classes (the transfer model's own draw). */
function bigger() {
  const p = DATA2T.params(rnd); const ans = DATA2T.answer(p);
  return {
    key: `da2b:${p.n1}:${p.k1}:${p.n2}:${p.k2}`, text: data2TText(p), form: 'num', answer: ans, precise: true,
    hint: data2THint(), solution: data2TSolution(p), diag: diagWith(ans, bugsAt(DATA2T, p)),
  };
}
/** From a relative frequency back to a count: N·r (the total divided by r is div-by-rel). */
export const FROM_REL = mk({
  raw: (r) => {
    const N = pick(r, [20, 25, 40, 50]); const rel = pick(r, [0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.6, 0.65, 0.7, 0.75, 0.8, 0.84, 0.36, 0.12, 0.28]);
    const c = r9(N * rel); if (!whole(c) || c < 2) return null;
    return { N, rel };
  },
  answer: ({ N, rel }) => r9(N * rel),
  bugs: { 'div-by-rel': ({ N, rel }) => N / rel },
});
function fromRel() {
  const p = FROM_REL.params(rnd); const ans = FROM_REL.answer(p); const w = pick(rnd, WAYS);
  return {
    key: `da2r:${p.N}:${num(p.rel)}:${WAYS.indexOf(w)}`,
    text: `בכיתה $${p.N}$ תלמידים, והשכיחות היחסית של מי שמגיעים ${w} היא $${num(p.rel)}$. כמה תלמידים מגיעים ${w}?`,
    form: 'num', answer: ans,
    hint: `השכיחות היחסית היא החלק מכל הכיתה. כמה הם $${num(p.rel)}$ מ־$${p.N}$?`,
    solution: [`החלק כפול כל התלמידים: $${num(p.rel)} \\cdot ${p.N} = ${ans}$`, `בדיקה: $\\frac{${ans}}{${p.N}} = ${num(p.rel)}$.`],
    diag: diagWith(ans, bugsAt(FROM_REL, p)),
  };
}
/** Three relative frequencies of four given: the fourth, as all of them make 1 (no diag). */
function sumOne() {
  for (;;) {
    const s = [rint(rnd, 1, 8), rint(rnd, 1, 8), rint(rnd, 1, 8)]; const rest = 20 - sum(s);
    if (rest < 1) continue;
    const shares = [...s, rest].map((k) => r9(k / 20)); const x = rint(rnd, 0, 3);
    if (shares.some((v, i) => i !== x && same(v, shares[x]))) continue;
    return {
      key: `da2s:${shares.map(num).join(',')}:${x}`,
      text: `בטבלה השכיחויות היחסיות של כל הדרכים להגיע לבית הספר, ואחת חסרה. מה השכיחות היחסית של מי שמגיעים ${WAYS[x]}?`,
      fig: tableFig(['איך מגיעים לבית הספר', 'שכיחות יחסית'], WAYS.map((w, i) => [w, i === x ? '?' : num(shares[i])])),
      form: 'num', answer: shares[x], precise: true,
      hint: 'כל השכיחויות היחסיות יחד הן $1$.',
      solution: [`כל השכיחויות היחסיות יחד הן $1$.`, `$1 - ${shares.filter((_, i) => i !== x).map(num).join(' - ')} = ${num(shares[x])}$`],
      diag: () => null,
    };
  }
}
/** In which of two classes is the share bigger? Three choices, so practice only; the class with more of them is tagged. */
function compareMc() {
  for (;;) {
    const n1 = pick(rnd, [20, 25, 30, 40, 50]); const n2 = pick(rnd, [20, 25, 30, 40, 50]); if (n1 === n2) continue;
    const k1 = rint(rnd, 2, n1 - 2); const k2 = rint(rnd, 2, n2 - 2); if (k1 === k2) continue;
    const s1 = k1 / n1; const s2 = k2 / n2; const kind = rint(rnd, 0, 2);
    // a third of them with equal shares, a third the class with more of them smaller, a third larger
    if (kind === 0 ? !same(s1, s2) : same(s1, s2) || (kind === 1) !== ((k1 > k2) !== (s1 > s2))) continue;
    const answer = same(s1, s2) ? 2 : s1 > s2 ? 0 : 1; const more = k1 > k2 ? 0 : 1;
    const choices = [{ text: `בכיתה של ${n1}` }, { text: `בכיתה של ${n2}` }, { text: 'שווה' }];
    if (more !== answer) choices[more].bug = 'bigger-count';
    return {
      key: `da2c:${n1}:${k1}:${n2}:${k2}`,
      text: `בכיתה אחת $${n1}$ תלמידים, ו־$${k1}$ מהם מנגנים. בכיתה אחרת $${n2}$ תלמידים, ו־$${k2}$ מהם מנגנים. באיזו כיתה החלק של המנגנים גדול יותר?`,
      form: 'mc', choices, answer, practiceOnly: true,
      hint: 'מחשבים בכל כיתה את החלק של המנגנים, ומשווים את החלקים.',
      solution: [`בכיתה של $${n1}$: $${relTex(k1, n1)}$`, `בכיתה של $${n2}$: $${relTex(k2, n2)}$`, answer === 2 ? 'החלקים שווים, גם אם מספרי המנגנים שונים.' : `החלק גדול יותר בכיתה של $${answer === 0 ? n1 : n2}$.`],
      diag: (u) => choices[u]?.bug || null,
    };
  }
}

// ---------------------------------------------------------------- data:3 generators

/** How many chose X on a pie in percents (the model's own draw). */
function pieCount() {
  const p = DATA3.params(rnd); const ans = DATA3.answer(p);
  return {
    key: `da3:${p.N}:${p.ps.join(',')}:${p.x}`, text: data3Text(p), fig: data3Fig(p), form: 'num', answer: ans,
    hint: data3Hint(p), solution: data3Solution(p), diag: diagWith(ans, bugsAt(DATA3, p)),
  };
}
/**
 * A table's row as a percent of all (the critique's toPct, check.mjs G): totals 20, 40, 50, 200 or 400, each row's
 * percent a multiple of 5 and at least 10%, redrawn when the percent is a printed count or a prediction looks like a slip.
 */
export const TO_PCT = mk({
  raw: (r) => {
    const N = pick(r, [20, 40, 50, 200, 400]); const k = pick(r, [3, 4]);
    const ps = []; let left = 100;
    for (let i = 0; i < k - 1; i += 1) { const q = 5 * rint(r, 2, Math.min(12, left / 5 - 2 * (k - 1 - i))); ps.push(q); left -= q; }
    ps.push(left); const rows = ps.map((q) => (q * N) / 100);
    if (rows.some((x) => x < N / 10 || !whole(x))) return null;
    const x = rint(r, 0, k - 1); if (rows.includes(ps[x])) return null;
    return { N, rows, x };
  },
  answer: ({ N, rows, x }) => (100 * rows[x]) / N,
  bugs: {
    'count-as-pct': ({ rows, x }) => rows[x], // the count written as the percent
    'inverse-ratio': ({ N, rows, x }) => (100 * N) / rows[x], // all over the part, not the part over all
  },
});
function toPct() {
  const p = TO_PCT.params(rnd); const ans = TO_PCT.answer(p);
  return {
    key: `da3p:${p.rows.join(',')}:${p.x}`, text: `איזה אחוז מהתלמידים בחרו ב${HOBBIES[p.x]}?`,
    fig: tableFig(['תחביב', 'מספר תלמידים'], p.rows.map((c, i) => [HOBBIES[i], c])),
    form: 'num', answer: ans, unit: '%',
    hint: 'קודם כמה תלמידים בטבלה כולה. האחוז הוא החלק מכולם, כפול $100$.',
    solution: [`סך הכול: $${p.rows.join(' + ')} = ${p.N}$ תלמידים.`, `$\\frac{${p.rows[p.x]}}{${p.N}} \\cdot 100 = ${num(ans)}$, כלומר $${num(ans)}\\%$`],
    diag: diagWith(ans, bugsAt(TO_PCT, p)),
  };
}
/** The whole from a count and its percent (the transfer model's own draw). */
function pieWhole() {
  const p = DATA3T.params(rnd); const ans = DATA3T.answer(p);
  return {
    key: `da3w:${p.p}:${p.c}`, text: data3TText(p), fig: data3TFig(p), form: 'num', answer: ans,
    hint: data3THint(p), solution: data3TSolution(p), diag: diagWith(ans, bugsAt(DATA3T, p)),
  };
}
/** A slice whose percent is hidden: 100 minus the others (never equal to another slice). */
function pieMissing() {
  for (;;) {
    const n = rint(rnd, 3, 4); const ps = []; let left = 100;
    for (let i = 0; i < n - 1; i += 1) { const q = 5 * rint(rnd, 2, Math.min(12, left / 5 - 2 * (n - 1 - i))); ps.push(q); left -= q; }
    ps.push(left); if (left < 10 || new Set(ps).size !== ps.length) continue;
    const x = rint(rnd, 0, n - 1); const others = ps.filter((_, i) => i !== x);
    return {
      key: `da3m:${ps.join(',')}:${x}`, text: `בסקר תחביבים, איזה אחוז מהתלמידים בחרו ב${HOBBIES[x]}?`,
      fig: pieFig(HOBBIES.slice(0, n), ps, { pct: true, hide: x }), form: 'num', answer: ps[x], unit: '%',
      hint: 'כל הגזרות של העוגה יחד הן $100\\%$.',
      solution: ['כל הגזרות יחד הן $100\\%$.', `$100 - ${others.join(' - ')} = ${ps[x]}$, כלומר $${ps[x]}\\%$`],
      diag: () => null,
    };
  }
}
/** Colour a pie of 10 or 20 equal parts from a table (practice only). */
function buildPie() {
  for (;;) {
    const parts = pick(rnd, [10, 20]); const per = pick(rnd, parts === 10 ? [2, 3, 4, 5] : [2, 3]); const n = rint(rnd, 3, 4);
    const ks = []; let left = parts;
    for (let i = 0; i < n - 1; i += 1) { const kk = rint(rnd, 1, left - (n - 1 - i)); ks.push(kk); left -= kk; }
    ks.push(left); if (left < 1) continue;
    const counts = ks.map((kk) => kk * per); const N = parts * per;
    return {
      key: `da3b:${parts}:${counts.join(',')}`, text: `צבעו את העוגה לפי הטבלה. בעוגה $${parts}$ חלקים שווים, ובסקר $${N}$ תלמידים.`,
      fig: tableFig(['תחביב', 'מספר תלמידים'], counts.map((c, i) => [HOBBIES[i], c])),
      form: 'manip', practiceOnly: true,
      manip: { kind: 'chart', mode: 'pie', cats: HOBBIES.slice(0, n), start: ks.map(() => 0), pie: { parts } },
      answer: { values: ks },
      hint: `כל חלק בעוגה הוא $${per}$ תלמידים מתוך $${N}$.`,
      solution: [`$${N} : ${parts} = ${per}$: כל חלק הוא $${per}$ תלמידים.`, `${HOBBIES.slice(0, n).map((h, i) => `${h} $${ks[i]}$`).join(', ')} חלקים.`],
      diag: () => null,
    };
  }
}
const CLASSES = ['ז׳1', 'ז׳2', 'ז׳3'];
/** May these data be drawn as one pie? Only parts of one whole (two choices, so practice only). */
function pieOk() {
  if (Math.random() < 0.5) {
    let ps; do { ps = [5 * rint(rnd, 6, 16), 5 * rint(rnd, 6, 16), 5 * rint(rnd, 6, 16)]; } while (sum(ps) === 100);
    const choices = shuffle([{ text: 'לא: הם לא חלקים של שלם אחד', ok: true }, { text: 'כן', ok: false, bug: 'pie-not-whole' }]);
    return {
      key: `da3o:0:${ps.join(',')}`, text: 'בכל כיתה בדקו איזה אחוז מהתלמידים משתתפים בחוג. אפשר להציג את שלושת האחוזים בדיאגרמת עוגה אחת?',
      fig: barFig(CLASSES, ps, { step: 10, max: 100, every: 2, unit: 'אחוז המשתתפים בכל כיתה', labels: true }),
      form: 'mc', choices, answer: choices.findIndex((c) => c.ok), practiceOnly: true,
      hint: 'בעוגה כל הגזרות יחד הן שלם אחד, $100\\%$. כמה הם האחוזים כאן יחד?',
      solution: [`$${ps.join(' + ')} = ${sum(ps)}$, ולא $100$.`, 'כל אחוז הוא מכיתה אחרת: אלה לא חלקים של שלם אחד, ולכן אין עוגה כזאת.'],
      diag: (u) => choices[u]?.bug || null,
    };
  }
  let ps; do { ps = [5 * rint(rnd, 2, 12), 5 * rint(rnd, 2, 12)]; } while (sum(ps) >= 90);
  ps.push(100 - sum(ps));
  const ways = WAYS.slice(0, 3);
  const choices = shuffle([{ text: 'כן: יחד הם 100% של כיתה אחת', ok: true }, { text: 'לא', ok: false }]);
  return {
    key: `da3o:1:${ps.join(',')}`, text: 'בכיתה אחת בדקו איזה אחוז מהתלמידים מגיעים בכל דרך. אפשר להציג את האחוזים בדיאגרמת עוגה?',
    fig: barFig(ways, ps, { step: 10, max: 100, every: 2, unit: 'אחוז מהכיתה', labels: true }),
    form: 'mc', choices, answer: choices.findIndex((c) => c.ok), practiceOnly: true,
    hint: 'בעוגה כל הגזרות יחד הן שלם אחד, $100\\%$. כמה הם האחוזים כאן יחד?',
    solution: [`$${ps.join(' + ')} = 100$`, 'כל התלמידים של כיתה אחת, וכל אחד בדרך אחת: חלקים של שלם אחד, ולכן אפשר.'],
    diag: () => null,
  };
}

// ---------------------------------------------------------------- data:4 generators

/** Picking a pencil at random (the model's own draw). */
function pickTable() {
  const p = DATA4.params(rnd); const ans = DATA4.answer(p);
  return {
    key: `da4:${p.c.join(',')}:${p.j}`, text: data4Text(p), fig: data4Fig(p), form: 'num', answer: ans, precise: true,
    hint: data4Hint(), solution: data4Solution(p), diag: diagWith(ans, bugsAt(DATA4, p)),
  };
}
/** About how many balls of a colour, from draws with return (the transfer model's own draw). */
function estimate() {
  const p = DATA4T.params(rnd); const ans = DATA4T.answer(p);
  return {
    key: `da4e:${p.B}:${p.n}:${p.w}`, text: data4TText(p), form: 'num', answer: ans,
    hint: data4THint(), solution: data4TSolution(p), diag: diagWith(ans, bugsAt(DATA4T, p)),
  };
}
/** A survey that grew (the joinTotal model's own draw). */
function joinTotal() {
  const p = DATA4J.params(rnd); const ans = DATA4J.answer(p);
  return {
    key: `da4j:${p.N}:${p.p}:${p.m}`, text: data4JText(p), form: 'num', answer: ans, precise: true,
    hint: data4JHint(), solution: data4JSolution(p), diag: diagWith(ans, bugsAt(DATA4J, p)),
  };
}
/** How often a sector comes out, about: n spins times its share (stopping at the share is rel-not-scaled). */
const SHARES = [[1, 4], [1, 5], [1, 8], [1, 10], [3, 10]];
export const EXPECTED = mk({
  raw: (r) => { const n = pick(r, [120, 200, 240, 400, 600]); const [a, b] = pick(r, SHARES); if (!whole((n * a) / b)) return null; return { n, a, b }; },
  answer: ({ n, a, b }) => (n * a) / b,
  bugs: { 'rel-not-scaled': ({ a, b }) => a / b },
});
function expected() {
  const p = EXPECTED.params(rnd); const ans = EXPECTED.answer(p); const col = colourOf(p.n, p.a, p.b);
  return {
    key: `da4x:${p.n}:${p.a}:${p.b}`,
    text: `בגלגל, החלק ה${col.one} הוא $\\frac{${p.a}}{${p.b}}$ מהגלגל. מסובבים אותו $${p.n}$ פעמים. בכמה סיבובים בערך ייצא ${col.one}?`,
    form: 'num', answer: ans,
    hint: `בערך $\\frac{${p.a}}{${p.b}}$ מכל הסיבובים.`,
    solution: [`$\\frac{${p.a}}{${p.b}}$ מ־$${p.n}$: $${p.n} \\cdot \\frac{${p.a}}{${p.b}} = ${ans}$`, `בערך $${ans}$ פעמים, לא בדיוק.`],
    diag: diagWith(ans, bugsAt(EXPECTED, p)),
  };
}
/** Certain, impossible or an even chance (two-word choices, so practice only). */
function scaleMc() {
  const kind = rint(rnd, 0, 2); const n = rint(rnd, 3, 9);
  const text = [
    `בשקית $${n}$ כדורים, וכולם אדומים. מוציאים כדור בלי להסתכל. מה הסיכוי שהוא אדום?`,
    `בשקית $${n}$ כדורים, וכולם כחולים. מוציאים כדור בלי להסתכל. מה הסיכוי שהוא אדום?`,
    `בשקית $${n}$ כדורים אדומים ו־$${n}$ כדורים כחולים. מוציאים כדור בלי להסתכל. מה הסיכוי שהוא אדום?`,
  ][kind];
  return {
    key: `da4s:${kind}:${n}`, text,
    form: 'mc', choices: [{ text: 'ודאי (הסתברות 1)' }, { text: 'בלתי אפשרי (הסתברות 0)' }, { text: 'סיכוי שווה (חצי)' }], answer: kind, practiceOnly: true,
    hint: 'כמה מהכדורים בשקית אדומים, מתוך כולם?',
    solution: [[`כל $${n}$ הכדורים אדומים: $\\frac{${n}}{${n}} = 1$, ודאי.`, `אף כדור לא אדום: $\\frac{0}{${n}} = 0$, בלתי אפשרי.`, `$${n}$ אדומים מתוך $${2 * n}$: חצי, סיכוי שווה לאדום ולכחול.`][kind]],
    diag: () => null,
  };
}
const QUARTERS = [[1, 10], [1, 4], [1, 2], [3, 4]];
/**
 * A covered wheel (the simulate object's estimate mode): spin, then choose about what part of it is orange, among three of
 * 1/10, 1/4, 1/2 and 3/4 (at least 0.15 apart). Practice only; a wrong pick under 100 spins is the small sample.
 */
function simRun() {
  const qi = rint(rnd, 0, 3); const [a, b] = QUARTERS[qi];
  const parts = b === 10 ? 10 : b === 4 ? 12 : pick(rnd, [10, 12]);
  const red = (parts * a) / b; const rest = parts - red;
  // named as drawn (TONE_WORDS): orange, blue, purple
  const sectors = [{ label: 'כתום', parts: red, tone: 1 }, { label: 'כחול', parts: Math.ceil(rest / 2), tone: 0 }];
  if (Math.floor(rest / 2) > 0) sectors.push({ label: 'סגול', parts: Math.floor(rest / 2), tone: 6 });
  const drop = pick(rnd, [0, 1, 2, 3].filter((i) => i !== qi));
  const picks = [0, 1, 2, 3].filter((i) => i !== drop);
  const choices = picks.map((i) => `\\frac{${QUARTERS[i][0]}}{${QUARTERS[i][1]}}`);
  const item = {
    key: `da4w:${parts}:${red}:${picks.join(',')}`, text: 'הגלגל מכוסה. סובבו אותו, ובחרו: בערך איזה חלק מהגלגל כתום?',
    form: 'manip', practiceOnly: true,
    manip: { kind: 'simulate', device: 'spinner', sectors, watch: 0, hidden: true },
    answer: { mode: 'estimate', choices, answer: picks.indexOf(qi) },
    hint: 'סובבו הרבה פעמים: אחרי $100$ ויותר, השכיחות היחסית של כתום קרובה לחלק שלו בגלגל.',
    solution: [`הכתום הוא $${red}$ מתוך $${parts}$ חלקים: $\\frac{${a}}{${b}}$ מהגלגל.`, 'אחרי הרבה סיבובים השכיחות היחסית של כתום קרובה לזה.'],
  };
  return { ...item, diag: (u) => simDiag(item, u) };
}

// ---------------------------------------------------------------- the topic

export const DATA = {
  id: 'data', grade: '7', title: 'נתונים ושכיחות', color: 'sky',
  desc: 'דיאגרמות וטבלת שכיחויות, שכיחות יחסית, אחוזים ודיאגרמת עוגה, והסתברות מתוך שכיחות',
  // taught from January in ז׳ (and October in ח׳ this year): the first-day placement test does not ask about it
  placement: false,
  levels: [
    { title: 'דיאגרמות וטבלת שכיחויות', gen: () => { const r = Math.random(); return r < 0.1 ? barRead() : r < 0.4 ? barDiff() : r < 0.6 ? picto() : r < 0.7 ? tableTotal() : r < 0.8 ? lineRead() : r < 0.85 ? listCount() : r < 0.9 ? groupsMc() : r < 0.95 ? buildBar() : axisMc(); } },
    { title: 'שכיחות יחסית', gen: () => { const r = Math.random(); return r < 0.4 ? relFreq() : r < 0.55 ? bigger() : r < 0.7 ? fromRel() : r < 0.8 ? sumOne() : compareMc(); } },
    { title: 'אחוזים ודיאגרמת עוגה', gen: () => { const r = Math.random(); return r < 0.35 ? pieCount() : r < 0.55 ? toPct() : r < 0.75 ? pieWhole() : r < 0.85 ? pieMissing() : r < 0.95 ? buildPie() : pieOk(); } },
    { title: 'הסתברות מתוך שכיחות', gen: () => { const r = Math.random(); return r < 0.4 ? pickTable() : r < 0.6 ? estimate() : r < 0.7 ? joinTotal() : r < 0.8 ? expected() : r < 0.9 ? scaleMc() : simRun(); } },
  ],
  cats: {
    'scale-units': 'ספרו משבצות בציר במקום לקרוא את המספרים שעליו',
    'one-value': 'ענו כמה יש בקבוצה אחת במקום את ההפרש',
    'icon-count': 'ספרו סמלים ושכחו כמה שווה כל סמל',
    'half-icon': 'ספרו חצי סמל כסמל שלם',
    'truncated-axis': 'השוו גובה של עמודות בציר שלא מתחיל ב־$0$',
    'part-part': 'חילקו בשאר הנתונים במקום בכל הנתונים',
    'freq-only': 'כתבו את השכיחות במקום את השכיחות היחסית',
    'per-category': 'חשבו שכל שורה בטבלה היא חלק שווה מהשלם',
    'bigger-count': 'השוו לפי מספר הפריטים בלי להתחשב בגודל הקבוצה',
    // pct's id and words (content/pct.js)
    'inverse-ratio': 'חילקו את השלם בחלק במקום את החלק בשלם',
    'pct-for-dec': 'כתבו את החלק באחוזים, במקום כשבר או כמספר עשרוני',
    'div-by-rel': 'חילקו את מספר כל הנתונים בשכיחות היחסית במקום לכפול בה',
    'draws-as-count': 'כתבו כמה פעמים יצא הצבע, במקום כמה כדורים כאלה יש בשקית',
    // pct's ids and words
    'count-as-pct': 'כתבו את מספר החלקים או את האחוז עצמו כאילו הוא הכמות',
    'div-by-pct': 'חילקו את הכמות במספר האחוזים',
    'pct-of-part': 'חישבו אחוז מהחלק הנתון במקום למצוא את השלם',
    'stop-at-one': 'מצאו כמה הם $1\\%$ ועצרו שם',
    'pie-not-whole': 'הציגו בעוגה נתונים שאינם חלקים של שלם אחד',
    equiprob: 'הניחו שלכל סוג אותו סיכוי, בלי להתחשב בכמה יש מכל סוג',
    'old-total': 'חילקו בסך הכול הישן, לפני שנוספו פריטים',
    'new-not-counted': 'הוסיפו את החדשים לסך הכול ולא לחלק',
    'old-rel': 'השתמשו בשכיחות היחסית מלפני השינוי',
    'rel-not-scaled': 'עצרו בשכיחות היחסית ולא כפלו במספר הכולל',
    'small-sample': 'סמכו על מעט ניסויים כאילו הם נותנים את ההסתברות',
  },
  lesson: {
    points: [
      'השכיחות היא כמה פעמים מופיע ערך. בדיאגרמת עמודות, הגובה של העמודה הוא השכיחות.',
      'שכיחות יחסית: השכיחות חלקי מספר כל הנתונים. $9$ מתוך $20$: $\\frac{9}{20} = 0.45 = 45\\%$.',
      'בעוגה כל הגזרות יחד הן $100\\%$. $30\\%$ מ־$240$ הם $72$.',
      'כשבוחרים באקראי, ההסתברות לסוג היא השכיחות היחסית שלו. הרבה ניסויים נותנים אומדן טוב, מעט ניסויים לא.',
    ],
    words: ['נתונים', 'משתנה', 'שכיחות', 'טבלת שכיחויות', 'דיאגרמת עמודות', 'פיקטוגרמה', 'מקרא', 'ציר', 'שכיחות יחסית', 'אחוז', 'דיאגרמת עוגה', 'גזרה', 'הסתברות', 'ניסוי', 'באקראי', 'אומדן'],
  },
};
