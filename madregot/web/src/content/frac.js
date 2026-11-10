// Fractions and decimals (שברים ועשרוניים): the bridge unit under the grade 7 programme (curriculum stage 1,
// CURRICULUM-3). The programme no longer teaches elementary fractions in grade 7 ("יש להתבסס על כך שהתלמידים שולטים
// בנושא זה"), so a weak student has nowhere else to repair them. The unit is a floor: it is in no "X of N" count, not
// on the map and never offered as new until the floor is switched on (learn/recommend.ts, `bridge: true` here).
//
// One picture carries it: a fraction is a place on the number line. Cut each unit into equal parts and count parts
// (gaps, not marks); equal fractions are the same place; decimals are compared digit by digit, after padding.
//
// The diagnostic models (FRAC1, FRAC1T, FRAC2, FRAC2T) are the plan's (finish/scratch/curriculum/plan/models.mjs),
// ported unchanged: their draws redraw any question where a misconception's prediction looks like a slip of the hand,
// lies within 0.06 of the right answer or of another prediction. The practice generators below use the same draws, so
// a question of a check and an exercise of practice read alike. Errors and their sources:
//   count-marks     the marks counted instead of the gaps (Pearn & Stephens 2004, MERGA 27; Bright et al. 1988, JRME 19)
//   whole-line      a line longer than one taken as the unit (Pearn & Stephens 2004, citing Hannula 2003)
//   add-same        the same number added on top and bottom (Hart 1984, NFER-Nelson; Karplus, Pulos & Stage 1983, ESM 14)
//   longer-larger   the decimal with more digits read as larger (Resnick, Nesher et al. 1989, JRME 20(1))
//   shorter-larger  the decimal with fewer digits read as larger (the "fraction rule", the same study)
//   bigger-den      a bigger denominator read as a bigger fraction (Ni & Zhou 2005, Educational Psychologist 40(1))
// and for frac:3-4 (stage 6) add-across, num-not-scaled, keep-den (Siegler & Pyke 2013), divide-flip, mult-bigger
// (Fischbein et al. 1985; Tirosh 2000).
import { shuffle, gcd, listMath } from './util.js';
import { diagOf } from './eq.js';
import { slipOf } from '@/learn/misconceptions.ts';

const rnd = () => Math.random();
const rint = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
export const r9 = (v) => Math.round(v * 1e9) / 1e9;
/** a/b as TeX. */
export const fracTex = (n, d) => (d === 1 ? `${n}` : `\\frac{${n}}{${d}}`);
/** A decimal as written: 0.125, 0.6 (never 0.6000000001). */
export const dec = (v) => String(r9(v));

// ---------------------------------------------------------------- the models' draws (plan/models.mjs, unchanged)

/** A draw is clean when no prediction can be taken for a slip, a rounded right answer, or another prediction. */
export function clean(model, p) {
  const ans = model.answer(p);
  const vals = [];
  for (const f of Object.values(model.bugs)) {
    const v = f(p);
    if (v == null) continue;
    if (!Number.isFinite(v)) return false;
    if (Math.abs(v - ans) < 1e-9) continue; // does not show here
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
const draw = (model, raw) => (r) => { for (;;) { const p = raw(r); if (p && clean(model, p)) return p; } };
function mk(m) { m.params = draw(m, m.raw); return m; }

/** frac:1 — which number is marked on a number line (0..L, each unit cut into d parts, A at the k-th mark). */
export const FRAC1 = mk({
  raw: (r) => { const d = pick(r, [3, 4, 5, 6]); const L = r() < 0.4 ? 1 : 2; const k = rint(r, 1, L * d - 1); if (k % d === 0 || (d >= 5 && k < 2)) return null; return { d, L, k }; },
  answer: ({ d, k }) => k / d,
  bugs: {
    'count-marks': ({ d, k }) => k / (d - 1), // d − 1 marks inside a unit read as d − 1 parts
    'whole-line': ({ d, L, k }) => (L === 2 ? k / (2 * d) : null), // the whole drawn line 0..2 taken as the unit
  },
});
/** frac:1 transfer — the same amount of pizza cut finer: a of b slices = ? of c = b·m slices. */
export const FRAC1T = mk({
  raw: (r) => { const b = pick(r, [2, 3, 4, 5, 6, 8]); const a = rint(r, 1, b - 1); if (gcd(a, b) !== 1) return null; const m = rint(r, 2, 4); return { a, b, m, c: b * m }; },
  answer: ({ a, m }) => a * m,
  bugs: { 'add-same': ({ a, b, c }) => a + (c - b) },
});
/** frac:2 — the largest of four numbers: decimals with 1, 2, 3 and 2 places, or four fractions with one numerator. */
export const FRAC2 = mk({
  raw: (r) => {
    if (r() < 0.92) { // decimals are redrawn more often, so 92% here gives about half of the questions
      const a = rint(r, 1, 9) / 10; const bi = rint(r, 11, 99); const ci = rint(r, 101, 999); const ei = rint(r, 11, 99);
      if (bi % 10 === 0 || ci % 10 === 0 || ei % 10 === 0) return null;
      const b = bi / 100; const c = ci / 1000; const e = ei / 100;
      if (b - a < 0.1 || b - c < 0.1 || b - e < 0.1 || Math.abs(e - a) < 0.01 || Math.abs(e - c) < 0.01) return null;
      return { k: 0, a, b, c, e };
    }
    const n = pick(r, [1, 1, 2, 3]); const ds = new Set(); while (ds.size < 4) ds.add(rint(r, n + 1, 12));
    const [x, y, w, z] = [...ds].sort((u, v) => u - v);
    if (n / x - n / z <= 0.06) return null;
    return { k: 1, n, x, y, w, z };
  },
  answer: (p) => (p.k === 0 ? p.b : p.n / p.x),
  bugs: {
    'longer-larger': (p) => (p.k === 0 ? p.c : null),
    'shorter-larger': (p) => (p.k === 0 ? p.a : null),
    'bigger-den': (p) => (p.k === 1 ? p.n / p.z : null),
  },
});
/** frac:2 transfer — the longest of four jumps: 1.p, 1.qr, 1.stu, 1.vw metres. */
export const FRAC2T = mk({
  raw: (r) => { const p = FRAC2.raw(r); if (!p || p.k !== 0) return null; return { a: 1 + p.a, b: r9(1 + p.b), c: r9(1 + p.c), e: r9(1 + p.e) }; },
  answer: (p) => p.b,
  bugs: { 'longer-larger': (p) => p.c, 'shorter-larger': (p) => p.a },
});

// ---------------------------------------------------------------- shared words

/** The number line of a frac:1 question: 0..L, each unit in d parts, A at the k-th mark. */
export const pointFig = ({ d, L, k }) => ({ type: 'numline', from: 0, to: L, den: d, marks: [{ x: k / d, label: 'A' }] });
export const pointText = (p) => `איזה מספר מסומן בנקודה $A$?${Number.isInteger(r9(p.k / p.d * 1000)) ? ' כתבו כשבר או כמספר עשרוני.' : ''}`;
/** k/d as written, then reduced, then as a mixed number: \frac{6}{4} = \frac{3}{2} = 1\frac{1}{2}. */
export function fracChain(k, d) {
  const out = [fracTex(k, d)];
  const g = gcd(k, d); if (g > 1) out.push(fracTex(k / g, d / g));
  if (k > d && k % d) { const w = Math.floor(k / d); const r = k % d; const h = gcd(r, d); out.push(`${w}${fracTex(r / h, d / h)}`); }
  return out.join(' = ');
}
export const pointSolution = ({ d, k }) => [
  `בין $0$ ל־$1$ יש $${d - 1}$ שנתות, והן מחלקות את היחידה ל־$${d}$ חלקים שווים.`,
  `כל חלק הוא $${fracTex(1, d)}$, ו־$A$ נמצאת $${k}$ חלקים מ־$0$.`,
  `$A = ${fracChain(k, d)}$`,
];
export const pointHint = () => 'ספרו את הרווחים בין $0$ ל־$1$, לא את הקווים.';

/** The four numbers of a frac:2 question, as shown (strings: 0.6, 0.125, 1/6), in the order `ord` (a permutation). */
export function biggestList(p, ord = [0, 1, 2, 3]) {
  const vals = p.k === 0 ? [dec(p.a), dec(p.b), dec(p.c), dec(p.e)] : [p.x, p.y, p.w, p.z].map((d) => `${p.n}/${d}`);
  return ord.map((i) => vals[i]);
}
export const shownTex = (s) => (s.includes('/') ? fracTex(...s.split('/').map(Number)) : s);
/** Places after the point of a written decimal: 0.125 has 3. */
export const places = (s) => (s.includes('.') ? s.split('.')[1].length : 0);
export const biggestText = (list) => `מה המספר הגדול ביותר: ${listMath(list.map(shownTex))}? כתבו אותו.`;
export function biggestSolution(p) {
  if (p.k === 0) {
    const pad = (v) => dec(v).padEnd(5, '0');
    const rows = [p.a, p.b, p.c, p.e].map(pad);
    return [
      `משלימים אפסים עד שלוש ספרות אחרי הנקודה: ${listMath(rows)}.`,
      `משווים אלפיות: $${Math.round(p.b * 1000)}$ הוא הגדול.`,
      `התשובה: $${dec(p.b)}$`,
    ];
  }
  return [
    `לכל השברים אותו מונה, $${p.n}$: כמה חלקים לוקחים.`,
    `המכנה הקטן ביותר, $${p.x}$, נותן את החלקים הגדולים ביותר.`,
    `התשובה: $${fracChain(p.n, p.x)}$`,
  ];
}
export const biggestHint = (p) => (p.k === 0 ? 'השלימו אפסים בסוף, עד שלכולם אותו מספר ספרות אחרי הנקודה, ואז השוו.' : 'לכולם אותו מונה. כשמחלקים לפחות חלקים, כל חלק גדול יותר.');

// ---------------------------------------------------------------- frac:1 generators

/** Which number is marked on the line (the model's own draw). */
function readPoint() {
  const p = FRAC1.params(rnd);
  return {
    key: `fr1r:${p.d}:${p.L}:${p.k}`, text: pointText(p), form: 'num', answer: p.k / p.d, precise: true,
    fig: pointFig(p), hint: pointHint(), solution: pointSolution(p),
    diag: diagOf(p.k / p.d, Object.fromEntries(Object.entries(FRAC1.bugs).map(([id, f]) => [id, f(p)]))),
  };
}

/** Put the marker on k/d: a line cut into thirds to sixths (the target is named, so practice only). */
function placePoint() {
  const d = rint(rnd, 3, 6); const max = Math.random() < 0.5 ? 1 : 2;
  let k; do { k = rint(rnd, 1, max * d - 1); } while (k % d === 0);
  return {
    key: `fr1p:${d}:${max}:${k}`, text: `שימו את הסמן על $${fracTex(k, d)}$.`, form: 'manip', practiceOnly: true,
    manip: { kind: 'numberline', min: 0, max, from: 0, start: 0, den: d }, answer: k / d,
    hint: `כל יחידה מחולקת ל־$${d}$ חלקים. ספרו $${k}$ חלקים מ־$0$.`,
    solution: [`המכנה $${d}$: כל יחידה מחולקת ל־$${d}$ חלקים שווים.`, `המונה $${k}$: סופרים $${k}$ חלקים מ־$0$${k > d ? `, כלומר יחידה שלמה ועוד $${k - d}$ חלקים` : ''}.`],
    diag: () => null,
  };
}

/** Complete an equal fraction: expanding (×m) or simplifying (÷m). key: the given fraction p/q and the new den r. */
function equiv() {
  for (;;) {
    const b = rint(rnd, 2, 9); const a = rint(rnd, 1, b - 1); if (gcd(a, b) !== 1) continue;
    const m = rint(rnd, 2, 5); const up = Math.random() < 0.6;
    const [p, q, r] = up ? [a, b, b * m] : [a * m, b * m, b];
    const ans = up ? a * m : a;
    const same = p + (r - q); // the same number added to the numerator as to the denominator
    // the answer is never a number printed in the question, and the "added" prediction never looks like a slip
    if ([p, q, r].includes(ans) || same <= 0 || same === ans || slipOf(same, ans)) continue;
    return {
      key: `fr1e:${p}:${q}:${r}`, text: 'השלימו את המונה החסר:', display: `${fracTex(p, q)} = \\frac{\\square}{${r}}`, form: 'num', answer: ans, checkDisplay: false,
      hint: up ? `פי כמה גדל המכנה? גם המונה גדל פי אותו מספר.` : `פי כמה קטן המכנה? גם המונה קטן פי אותו מספר.`,
      solution: up
        ? [`המכנה גדל פי $${m}$: $${q} \\cdot ${m} = ${r}$.`, `גם המונה פי $${m}$: $${p} \\cdot ${m} = ${ans}$.`, `$${fracTex(p, q)} = ${fracTex(ans, r)}$`]
        : [`המכנה קטן פי $${m}$: $${q} : ${m} = ${r}$.`, `גם המונה: $${p} : ${m} = ${ans}$.`, `$${fracTex(p, q)} = ${fracTex(ans, r)}$`],
      diag: diagOf(ans, { 'add-same': same }),
    };
  }
}

/** Reduce to lowest terms (answer form 'frac', reduced): p/q with a common divisor 2..9, q ≤ 60. */
function reduceFrac() {
  for (;;) {
    const g = rint(rnd, 2, 9); const b = rint(rnd, 2, Math.floor(60 / g)); const a = rint(rnd, 1, b - 1);
    if (gcd(a, b) !== 1 || b * g > 60) continue;
    const p = a * g; const q = b * g;
    return {
      key: `fr1s:${p}:${q}`, text: 'צמצמו עד הסוף:', display: fracTex(p, q), form: 'frac', reduced: true, answer: a / b, checkDisplay: false,
      hint: `מחפשים מספר שגם $${p}$ וגם $${q}$ מתחלקים בו, הגדול ביותר.`,
      solution: [`גם $${p}$ וגם $${q}$ מתחלקים ב־$${g}$, וזה המחלק המשותף הגדול ביותר.`, `$${p} : ${g} = ${a}$, $\\;${q} : ${g} = ${b}$`, `$${fracTex(p, q)} = ${fracTex(a, b)}$`],
      diag: () => null,
    };
  }
}

// ---------------------------------------------------------------- frac:2 generators

/** The largest of four numbers (the model's own draw), shown in a shuffled order. */
function biggest() {
  const p = FRAC2.params(rnd); const list = biggestList(p, shuffle([0, 1, 2, 3]));
  const ans = FRAC2.answer(p);
  return {
    key: `fr2b:${list.join(',')}`, text: biggestText(list), form: 'num', answer: ans, precise: true, ...(p.k === 0 ? { fmt: 'dec' } : {}),
    hint: biggestHint(p), solution: biggestSolution(p),
    diag: listDiag(list.map(shownValue), ans, Object.fromEntries(Object.entries(FRAC2.bugs).map(([id, f]) => [id, f(p)]))),
  };
}
/** A number as shown ('0.6', '1/6') as its value. */
export const shownValue = (s) => { const [a, b] = s.split('/'); return b === undefined ? Number(a) : Number(a) / Number(b); };
/**
 * A typed answer to "which is the largest" names the misconception whose number it is: the listed number typed
 * exactly, or rounded as a student types a fraction (1/12 as 0.08) when only one listed number rounds there. A number
 * that is exactly another listed number (0.1 when 1/10 is listed) is that number, not a rounding of the prediction.
 */
export function listDiag(vals, ans, bugs) {
  const round = (v, k) => Math.round(v * 10 ** k) / 10 ** k;
  return (u) => {
    if (typeof u !== 'number' || Math.abs(u - ans) < 1e-9) return null;
    let v = vals.find((x) => Math.abs(x - u) < 1e-9);
    if (v === undefined) {
      const near = vals.filter((x) => [1, 2].some((k) => Math.abs(round(x, k) - u) < 1e-9 && Math.abs(round(x, k) - x) > 1e-9));
      if (near.length !== 1) return null;
      [v] = near;
    }
    const hit = Object.entries(bugs).find(([, b]) => b != null && Math.abs(b - v) < 1e-9);
    return hit ? hit[0] : null;
  };
}

const PAIR_FRACS = [[3, 4, '0.75'], [1, 2, '0.5'], [1, 4, '0.25'], [2, 5, '0.4'], [1, 5, '0.2']];
/**
 * Which is larger: two decimals of different lengths, two unit fractions, or (a third of the time) an equal pair.
 * Three choices (A, B, equal), so practice only. A wrong choice is named by the rule that picks it.
 */
function pair() {
  const r = Math.random();
  let A; let B; let tagOf;
  if (r < 1 / 3) {
    // equal: 0.5 and 0.50, or 3/4 and 0.75
    if (Math.random() < 0.5) { const t = rint(rnd, 1, 9); A = `0.${t}`; B = `0.${t}0`; } else { const [n, d, s] = pick(rnd, PAIR_FRACS); A = `${n}/${d}`; B = s; }
  } else if (r < 2 / 3) {
    // two unit fractions: 1/6 and 1/8
    const x = rint(rnd, 2, 9); let y; do { y = rint(rnd, 2, 10); } while (y === x);
    A = `1/${x}`; B = `1/${y}`;
  } else {
    // decimals of different lengths, the longer one smaller or larger
    for (;;) {
      const s = String(rint(rnd, 1, 9)); const l = String(rint(rnd, 11, 99)).padStart(2, '0');
      if (l.endsWith('0') || Number(`0.${s}`) === Number(`0.${l}`)) continue;
      A = `0.${s}`; B = `0.${l}`; break;
    }
  }
  if (Math.random() < 0.5) [A, B] = [B, A];
  const va = r9(Number(A.includes('/') ? A.split('/')[0] / A.split('/')[1] : A)); const vb = r9(Number(B.includes('/') ? B.split('/')[0] / B.split('/')[1] : B));
  const ans = va > vb ? 0 : vb > va ? 1 : 2;
  // the rule a wrong choice follows: more digits, fewer digits, or a bigger denominator
  tagOf = (s, other) => {
    if (s.includes('/') && other.includes('/')) return Number(s.split('/')[1]) > Number(other.split('/')[1]) ? 'bigger-den' : undefined;
    if (s.includes('/') || other.includes('/')) return undefined;
    return places(s) > places(other) ? 'longer-larger' : places(s) < places(other) ? 'shorter-larger' : undefined;
  };
  const choices = [
    { tex: shownTex(A), ok: ans === 0, bug: ans === 0 ? undefined : tagOf(A, B) },
    { tex: shownTex(B), ok: ans === 1, bug: ans === 1 ? undefined : tagOf(B, A) },
    { text: 'שווים', ok: ans === 2 },
  ];
  const eqWhy = A.includes('/') || B.includes('/') ? `$${shownTex(A.includes('/') ? A : B)} = ${shownTex(A.includes('/') ? B : A)}$: אותו מקום על הציר.` : `אפס בסוף לא משנה את המספר: $${A.length < B.length ? A : B} = ${A.length < B.length ? B : A}$.`;
  return {
    key: `fr2p:${A},${B}`, text: `מה גדול יותר: $${shownTex(A)}$ או $${shownTex(B)}$?`, form: 'mc', choices, answer: ans, practiceOnly: true,
    hint: A.includes('/') && B.includes('/') ? 'באותו מונה: כמה גדול כל חלק? מכנה גדול יותר הוא חלקים קטנים יותר.' : 'השלימו אפסים בסוף עד שיש אותו מספר ספרות אחרי הנקודה, ואז השוו.',
    solution: [ans === 2 ? eqWhy : A.includes('/') && B.includes('/') ? `באותו מונה, המכנה הקטן נותן חלקים גדולים יותר: $${shownTex(ans === 0 ? A : B)}$.` : `משלימים לאותו מספר ספרות: $${(ans === 0 ? A : B).padEnd(Math.max(A.length, B.length), '0')} > ${(ans === 0 ? B : A).padEnd(Math.max(A.length, B.length), '0')}$.`],
    diag: (u) => choices[u]?.bug || null,
  };
}

/** A fraction written as a decimal: denominators 2, 4, 5, 10, 20, 25 (a short decimal every time). */
function toDec() {
  for (;;) {
    const b = pick(rnd, [2, 4, 5, 10, 20, 25]); const a = rint(rnd, 1, b - 1);
    if (gcd(a, b) !== 1) continue;
    const ans = a / b; const to = b === 2 || b === 5 ? 10 : 100; const m = to / b;
    return {
      key: `fr2d:${a}:${b}`, text: 'כתבו כמספר עשרוני:', display: fracTex(a, b), form: 'num', answer: ans, precise: true, fmt: 'dec', askDec: true, checkDisplay: false,
      hint: `הרחיבו למכנה $${to}$: כפלו את המונה ואת המכנה ב־$${m}$.`,
      solution: [...(m > 1 ? [`$${fracTex(a, b)} = ${fracTex(a * m, to)}$`] : []), `$${fracTex(a * m, to)} = ${dec(ans)}$`],
      diag: () => null,
    };
  }
}

const ORDER_FRACS = [[1, 4], [3, 4], [1, 2], [1, 5], [2, 5], [3, 5], [4, 5]];
/** Three numbers placed on 0..1 cut into twentieths: two decimals and a fraction (the targets are named: practice only). */
function orderPins() {
  for (;;) {
    const [fn, fd] = pick(rnd, ORDER_FRACS);
    const d1 = rint(rnd, 1, 19) * 5; const d2 = rint(rnd, 1, 19) * 5;
    const vals = [d1 / 100, d2 / 100, fn / fd];
    const sorted = [...vals].sort((x, y) => x - y);
    if (sorted[1] - sorted[0] < 0.1 - 1e-9 || sorted[2] - sorted[1] < 0.1 - 1e-9) continue;
    const labels = [dec(vals[0]), dec(vals[1]), `\\frac{${fn}}{${fd}}`];
    const order = shuffle([0, 1, 2]);
    const L = order.map((i) => labels[i]); const V = order.map((i) => vals[i]);
    // each marker starts on a free place apart from the others (the two ends first), never its own
    const free = [0, 1, 0.5, 0.95, 0.05, 0.45].filter((s) => !V.some((v) => Math.abs(v - s) < 1e-9));
    return {
      key: `fr2o:${V.join(',')}`, text: `שימו כל מספר במקום שלו על הציר: ${listMath(L)}.`, form: 'manip', practiceOnly: true,
      manip: { kind: 'pins', min: 0, max: 1, den: 20, fmt: 'dec', labels: L, start: free.slice(0, 3) }, answer: V,
      hint: 'כל שנתה היא $0.05$. רבע הוא $0.25$, חצי $0.5$, וחמישית $0.2$.',
      solution: [`מהקטן לגדול: $${[...V].sort((x, y) => x - y).map(dec).join(' < ')}$`, `$${fracTex(fn, fd)} = ${dec(fn / fd)}$`],
      diag: () => null,
    };
  }
}

// ---------------------------------------------------------------- the topic

export const FRAC = {
  id: 'frac', grade: '7', bridge: true, placement: false, alsoFor: ['8'], title: 'שברים ועשרוניים', color: 'violet',
  desc: 'יסודות: שבר על הציר, שברים שווים, השוואה, וארבע הפעולות',
  levels: [
    { title: 'שבר ושברים שווים', gen: () => { const r = Math.random(); return r < 0.35 ? readPoint() : r < 0.6 ? placePoint() : r < 0.85 ? equiv() : reduceFrac(); } },
    { title: 'השוואת שברים ועשרוניים', gen: () => { const r = Math.random(); return r < 0.35 ? biggest() : r < 0.65 ? pair() : r < 0.85 ? toDec() : orderPins(); } },
  ],
  cats: {
    'count-marks': 'ספרו את השנתות במקום את החלקים',
    'whole-line': 'התייחסו לכל הציר כאל יחידה אחת',
    'add-same': 'הוסיפו אותו מספר למונה ולמכנה במקום לכפול',
    'longer-larger': 'חשבו שמספר עשרוני עם יותר ספרות הוא גדול יותר',
    'shorter-larger': 'חשבו שמספר עשרוני עם פחות ספרות הוא גדול יותר',
    'bigger-den': 'חשבו שמכנה גדול יותר נותן שבר גדול יותר',
    'add-across': 'חיברו מונה עם מונה ומכנה עם מכנה',
    'num-not-scaled': 'הרחיבו את המכנים ושכחו להרחיב את המונים',
    'keep-den': 'כפלו או חילקו את המונים והשאירו את המכנה, כמו בחיבור',
    'divide-flip': 'חילקו הפוך: את המחלק במחולק',
    'mult-bigger': 'חשבו שכפל תמיד מגדיל ושחילוק תמיד מקטין',
  },
  lesson: {
    points: [
      'שבר הוא מקום על ציר המספרים: מחלקים את היחידה לחלקים שווים וסופרים.',
      '$\\frac{2}{3} = \\frac{8}{12}$: כופלים את המונה ואת המכנה באותו מספר.',
      '$0.4 > 0.25$, כי $0.40$ הם $40$ מאיות.',
      '$\\frac{1}{3} + \\frac{1}{4} = \\frac{4}{12} + \\frac{3}{12} = \\frac{7}{12}$.',
      '$\\frac{3}{4}$ מ־$20$ הם $15$, ו־$3 : \\frac{1}{4} = 12$.',
    ],
    words: ['שבר', 'מונה', 'מכנה', 'חלקים שווים', 'שנתה', 'הרחבה', 'צמצום', 'שבר מצומצם', 'שברים שווים', 'מכנה משותף', 'מספר מעורב', 'מספר עשרוני', 'עשיריות', 'מאיות', 'אלפיות', 'ההפכי', 'שבר שלילי'],
  },
};
