// The angle bisector (angles:6, CLASSROOM-10) and the sum of the angles of a quadrilateral (angles:7, CLASSROOM-12), as
// the class meets them: the printed bisector worksheet (a fan of rays, two bisectors, "האם … הוא חוצה זווית? הסבירו")
// and exercise 189's "סכום זוויות במרובע שווה 360°".
//
// One source for the exercises (content/grade7.js, with Math.random) and the stairs' diagnostic models
// (learn/content/angles67.ts, with a seeded source). Every draw is fair (angleItems.js fairAngle, the redraw rule of
// finish/specs/classroom.md §0.3): the answer is no number printed in the question or its drawing, nor 180°, 90° or
// 360° minus one; no mistake predicts the answer or a slip of it; no two mistakes predict one value. Every drawing is to
// size, from named points, and every number sits inside its own angle, clear of every line, arc and other number
// (learn/figures.test.ts). The ranges below stop where that still holds; each is the spec's range or inside it.
//
// angles:6, a question p = { k, … }:
//   k 'w'  bisWhole  OC halves ∢AOB, ∢AOC = h given; ∢AOB = 2h       h 17..84 (spec 13..84)          key an6w:h
//   k 'h'  bisHalf   OC halves ∢AOB = w (even); ∢BOC = w/2            w 28..168                       key an6h:w
//   k 't'  bisTwo    rays OA, OB, OD, OE, OC; OB halves ∢AOD, OE halves ∢DOC; ∢AOB = a, ∢DOE = b; ∢AOC = 2(a + b) < 175
//                    a ≠ b, 20..60 (spec 12..60)                                                     key an6t:a:b
//   k 'l'  bisLine   A, O, C on one line, ray OB, OD halves ∢BOC; ∢AOB = a (even, not 90); ∢DOC = (180 − a)/2
//                    a 20..150                                                                       key an6l:a
//   bisCheck (practice only, a choice): is OC the bisector of ∢BOD? yes or no, each with its reason   key an6c:aod:aob:cod
// Mistakes: part-for-whole (a half taken for the whole: w h, t a + b), no-half (the whole angle answered: h w,
// l 180 − a), half-double-swap (halved instead of doubled, or doubled instead of halved: w h/2 when h is even, h 2w),
// sum-360 (l: a full turn instead of the straight line, (360 − a)/2).
//
// angles:7, a question p = { k, g, q, … } with g the four angles at A, B, C, D and q the asked corner:
//   k 0  three angles given; the fourth is 360° − the three (a, b, c 60..150, the fourth 45..170)   key an7a:a:b:c:q
//   k 1  a right angle (its square, at corner s) and two given; the fourth is 270° − the two
//        (a 70..150, b 60..150, neither 90, the fourth 45..170)                                     key an7b:a:b:q:s
//   k 2  two marked equal angles (q and its partner j) and two given; each is (360° − a − b)/2
//        (a 70..170, b 50..150, the equal angles 40..170)                                           key an7c:a:b:q:j
// The exercises and the model draw k 0 30%, k 1 30% and k 2 40%, so wrong-total (about 15% of k 2's fair draws) is over
// 4% of all of them.
// Mistakes: quad-missed (one known angle left out of the 360°, the right angle too: the answer plus that angle),
// forgot-half (k 2: the two equal angles' share not halved, 360° − a − b), wrong-total (k 2 only: 180° as in a
// triangle, (180° − a − b)/2, when that is an angle at all; with three or two plus a right angle it is never positive).
import { fan, quad } from '@/learn/content/geo.ts';
import { fairAngle } from './angleItems.js';
import { diagOf, triesOf } from './eq.js';

const rint = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const DEG = 'מעלות';
const given = (v) => ({ text: `${v}°` });
const asked = { text: '?', target: true };
const sa = (name) => `\\sphericalangle ${name}`;
/** The item's diagnosis: the mistake whose prediction the answer is, without the value's number (one-angle#1). */
// (one mistake, or several whose predictions are the same number: eq.js diagOf names them all, PRODUCT2-15)
const diagFor = (ans, bugs) => {
  const d = diagOf(ans, bugs);
  return (u) => { const ids = [...new Set([d(u) || []].flat().map((id) => id.replace(/#\d+$/, '')))]; return ids.length > 1 ? ids : ids[0] || null; };
};
/** A list of maths in a sentence: "$x$, $y$ ו־$z$". */
const andList = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} ו־${xs[xs.length - 1]}` : xs[0]);

// ---------------------------------------------------------------- angles:6, the bisector

/** The kinds of angles:6's typed questions and their shares of practice (bisCheck, a choice, is the other 10%). */
export const BIS_KINDS = [['w', 0.2], ['h', 0.2], ['t', 0.25], ['l', 0.25]];
/**
 * bisTwo's fan has four parts, a, a, b and b, and the whole ∢AOC over them, 2(a + b) < 175°. A part under 20° cannot
 * hold its number clear of its rays once the fan is wide (a 300 by 230 drawing is about 120px from O to a ray's end at
 * 174°), so a and b are 20° to 60° (the spec's 12°: learn/figures.test.ts draws every pair).
 */
export const twoFits = (a, b) => a >= 20 && b >= 20 && a <= 60 && b <= 60 && a !== b && 2 * (a + b) < 175;

export const bisAnswer = (p) => (p.k === 'w' ? 2 * p.h : p.k === 'h' ? p.w / 2 : p.k === 't' ? 2 * (p.a + p.b) : (180 - p.a) / 2);
/** What each mistake gives for a bisector question (null where it does not apply). */
export function bisBugs(p) {
  if (p.k === 'w') return { 'part-for-whole': p.h, 'half-double-swap': p.h % 2 ? null : p.h / 2 };
  if (p.k === 'h') return { 'no-half': p.w, 'half-double-swap': 2 * p.w < 360 ? 2 * p.w : null };
  if (p.k === 't') return { 'part-for-whole': p.a + p.b };
  return { 'no-half': 180 - p.a, 'sum-360': (360 - p.a) / 2 };
}
const bisPrinted = (p) => (p.k === 'w' ? [p.h] : p.k === 'h' ? [p.w] : p.k === 't' ? [p.a, p.b] : [p.a]);

/** A fair bisector question of kind k ('w', 'h', 't', 'l'), drawn with the source r. */
export function drawBis(r, k) {
  for (;;) {
    let p;
    if (k === 'w') p = { k, h: rint(r, 17, 84) };
    else if (k === 'h') p = { k, w: 2 * rint(r, 14, 84) };
    else if (k === 't') { const a = rint(r, 20, 60); const b = rint(r, 20, 60); if (!twoFits(a, b)) continue; p = { k, a, b }; }
    else { const a = 2 * rint(r, 10, 75); if (a === 90) continue; p = { k, a }; }
    if (fairAngle(bisAnswer(p), bisBugs(p), bisPrinted(p))) return p;
  }
}
/** Draws the kind by its share, then a fair question of it. */
export const drawBisAny = (r) => { let x = r() / 0.9; for (const [k, w] of BIS_KINDS) { if (x < w / 0.9) return drawBis(r, k); x -= w / 0.9; } return drawBis(r, 'l'); };

/** The drawing of a bisector question, to size: rays from O ending in dots, each bisected pair with equal arcs. */
export function bisFig(p) {
  if (p.k === 'w') {
    const f = fan({ A: 90 - p.h, C: 90, B: 90 + p.h }, { AOC: { ...given(p.h), n: 2 }, COB: { n: 2 }, AOB: asked });
    return { ...f, label: `קרניים OA, OC ו־OB; OC חוצה את ∢AOB: ∢AOC = ${p.h}°, ∢COB שווה לה, ו־∢AOB מסומנת ב־?` };
  }
  if (p.k === 'h') {
    const f = fan({ A: 90 - p.w / 2, C: 90, B: 90 + p.w / 2 }, { AOB: given(p.w), AOC: { n: 2 }, COB: { n: 2, ...asked } });
    return { ...f, label: `קרניים OA, OC ו־OB; ∢AOB = ${p.w}°, OC חוצה אותה, ו־∢BOC מסומנת ב־?` };
  }
  if (p.k === 't') {
    const T = 2 * (p.a + p.b); const A = 90 - T / 2;
    const f = fan({ A, B: A + p.a, D: A + 2 * p.a, E: A + 2 * p.a + p.b, C: A + T }, { AOB: { ...given(p.a), n: 2 }, BOD: { n: 2 }, DOE: { ...given(p.b), n: 3 }, EOC: { n: 3 }, AOC: asked });
    return { ...f, label: `חמש קרניים OA, OB, OD, OE ו־OC; OB חוצה את ∢AOD ו־OE חוצה את ∢DOC: ∢AOB = ${p.a}°, ∢DOE = ${p.b}°, ו־∢AOC מסומנת ב־?` };
  }
  const d = (180 - p.a) / 2;
  const f = fan({ C: 0, D: d, B: 180 - p.a, A: 180 }, { AOB: given(p.a), BOD: { n: 2 }, DOC: { n: 2, ...asked } });
  return { ...f, label: `ישר AC והנקודה O עליו, קרניים OB ו־OD; ∢AOB = ${p.a}°, OD חוצה את ∢BOC, ו־∢DOC מסומנת ב־?` };
}

export function bisText(p) {
  if (p.k === 'w') return `$OC$ חוצה את $${sa('AOB')}$, ו־$${sa('AOC')} = ${p.h}^\\circ$. מה גודל $${sa('AOB')}$?`;
  if (p.k === 'h') return `$OC$ חוצה את $${sa('AOB')}$, ו־$${sa('AOB')} = ${p.w}^\\circ$. מה גודל $${sa('BOC')}$?`;
  if (p.k === 't') return `$OB$ חוצה את $${sa('AOD')}$, ו־$OE$ חוצה את $${sa('DOC')}$. $${sa('AOB')} = ${p.a}^\\circ$ ו־$${sa('DOE')} = ${p.b}^\\circ$. מה גודל $${sa('AOC')}$?`;
  return `הנקודות $A$, $O$ ו־$C$ על ישר אחד. $OD$ חוצה את $${sa('BOC')}$, ו־$${sa('AOB')} = ${p.a}^\\circ$. מה גודל $${sa('DOC')}$?`;
}
export function bisHint(p) {
  if (p.k === 'w') return `חוצה זווית מחלק אותה לשתי זוויות שוות. $${sa('AOC')}$ היא אחת מהן.`;
  if (p.k === 'h') return `חוצה זווית מחלק אותה לשתי זוויות שוות. $${sa('BOC')}$ היא אחת מהן.`;
  if (p.k === 't') return `כל חוצה זווית נותן שתי זוויות שוות. $${sa('AOC')}$ בנויה מארבעה חלקים: מה גודל כל אחד?`;
  return `קודם מוצאים את $${sa('BOC')}$: היא צמודה ל־$${sa('AOB')}$. אחר כך לוקחים חצי ממנה.`;
}
export function bisSolution(p) {
  const ans = bisAnswer(p);
  if (p.k === 'w') return ['חוצה זווית מחלק אותה לשתי זוויות שוות.', `$${sa('COB')} = ${sa('AOC')} = ${p.h}^\\circ$`, `$${sa('AOB')} = 2 \\cdot ${p.h}^\\circ = ${ans}^\\circ$`];
  if (p.k === 'h') return ['חוצה זווית מחלק אותה לשתי זוויות שוות, וכל אחת היא חצי מהזווית כולה.', `$${sa('BOC')} = ${p.w}^\\circ : 2 = ${ans}^\\circ$`];
  if (p.k === 't') {
    return [`$OB$ חוצה את $${sa('AOD')}$: $${sa('BOD')} = ${sa('AOB')} = ${p.a}^\\circ$`, `$OE$ חוצה את $${sa('DOC')}$: $${sa('EOC')} = ${sa('DOE')} = ${p.b}^\\circ$`,
      // each half twice, then their sum on its own line: the four angles in one line are wider than a phone
      `$${sa('AOC')} = 2 \\cdot ${p.a}^\\circ + 2 \\cdot ${p.b}^\\circ$`, `$= ${2 * p.a}^\\circ + ${2 * p.b}^\\circ = ${ans}^\\circ$`];
  }
  return [`$${sa('BOC')}$ צמודה ל־$${sa('AOB')}$: $180^\\circ - ${p.a}^\\circ = ${180 - p.a}^\\circ$`, `$OD$ חוצה אותה: $${sa('DOC')} = ${180 - p.a}^\\circ : 2 = ${ans}^\\circ$`];
}
const BIS_KEY = { w: (p) => `an6w:${p.h}`, h: (p) => `an6h:${p.w}`, t: (p) => `an6t:${p.a}:${p.b}`, l: (p) => `an6l:${p.a}` };

/** A typed bisector question (kind k, or by the kinds' shares). */
export function bisItem(k) {
  const p = k ? drawBis(Math.random, k) : drawBisAny(Math.random);
  const ans = bisAnswer(p); const bugs = bisBugs(p);
  return {
    key: BIS_KEY[p.k](p), form: 'num', answer: ans, unit: DEG, fig: bisFig(p),
    text: bisText(p), hint: bisHint(p), solution: bisSolution(p),
    diag: diagFor(ans, bugs), tries: triesOf(bugs),
  };
}

/**
 * Is OC the bisector of ∢BOD? (the worksheet's "האם … הוא חוצה זווית? הסבירו", practice only: a choice). Rays OA, OB, OC,
 * OD, drawn to size; ∢AOD, ∢AOB and ∢COD given. Half the time OC halves ∢BOD; otherwise ∢COD is 2° off, so the two
 * parts differ by 4° and OC still looks like the middle: the choices give a reason, and "it looks like the middle" is one
 * of the wrong ones. Key an6c:aod:aob:cod.
 */
export function bisCheckItem() {
  let half; let aob; let cod; let yes;
  // ∢AOB is never the size of ∢COD, so the wrong reason "∢BOC is ∢AOB" never reads like the right one
  do {
    half = rint(Math.random, 30, 52); aob = rint(Math.random, 34, 56); yes = Math.random() < 0.5;
    cod = yes ? half : half + (Math.random() < 0.5 ? 2 : -2);
  } while (aob === cod || aob === 2 * half - cod);
  const aod = aob + 2 * half; const boc = 2 * half - cod;
  const lri = (t) => `⁦${t}⁩`;
  const choices = [
    yes ? { text: `כן: ${lri(`∢BOC = ∢COD = ${cod}°`)}`, ok: true } : { text: `לא: ${lri(`∢BOC = ${boc}°`)}, ו־${lri(`∢COD = ${cod}°`)}`, ok: true },
    yes ? { text: `לא: ${lri(`∢BOC = ${aob}°`)}, ו־${lri(`∢COD = ${cod}°`)}` } : { text: `כן: ${lri(`∢BOC = ∢COD = ${cod}°`)}` },
    { text: 'כן: OC נראית בדיוק באמצע השרטוט' },
  ];
  // the order is mixed, so the right reason is not always first
  const order = [0, 1, 2].sort(() => Math.random() - 0.5);
  const shown = order.map((i) => ({ text: choices[i].text }));
  const f = fan({ A: 90 - aod / 2, B: 90 - aod / 2 + aob, C: 90 - aod / 2 + aob + boc, D: 90 + aod / 2 }, { AOD: given(aod), AOB: given(aob), COD: given(cod) });
  return {
    key: `an6c:${aod}:${aob}:${cod}`, form: 'mc', practiceOnly: true, choices: shown, answer: order.indexOf(0),
    fig: { ...f, label: `קרניים OA, OB, OC ו־OD: ∢AOD = ${aod}°, ∢AOB = ${aob}°, ∢COD = ${cod}°` },
    text: `$${sa('AOD')} = ${aod}^\\circ$, $${sa('AOB')} = ${aob}^\\circ$ ו־$${sa('COD')} = ${cod}^\\circ$. האם $OC$ חוצה את $${sa('BOD')}$? בחרו את התשובה עם ההסבר הנכון.`,
    hint: `חשבו את $${sa('BOC')}$ מהזוויות הנתונות, ובדקו אם היא שווה ל־$${sa('COD')}$. בשרטוט קשה לראות הבדל של כמה מעלות.`,
    solution: [
      `$${sa('BOD')} = ${aod}^\\circ - ${aob}^\\circ = ${2 * half}^\\circ$`,
      `$${sa('BOC')} = ${2 * half}^\\circ - ${cod}^\\circ = ${boc}^\\circ$`,
      yes ? `$${sa('BOC')} = ${sa('COD')} = ${cod}^\\circ$, ולכן $OC$ חוצה את $${sa('BOD')}$.` : `$${boc}^\\circ \\ne ${cod}^\\circ$, ולכן $OC$ לא חוצה את $${sa('BOD')}$, גם אם בשרטוט היא נראית כמעט באמצע.`,
    ],
    diag: () => null,
  };
}

// ---------------------------------------------------------------- angles:7, the quadrilateral

const CORNER = ['A', 'B', 'C', 'D'];
/** The four angles with the asked corner q filled in, and the givens at the other corners in order. */
const place = (q, f, givens) => { const g = [...givens]; return [0, 1, 2, 3].map((i) => (i === q ? f : g.shift())); };

export const quadAnswer = (p) => p.g[p.q];
/** What each mistake gives for a quadrilateral question (null where it does not apply; one id may give several values). */
export function quadBugs(p) {
  const ans = quadAnswer(p);
  if (p.k === 0) return Object.fromEntries(p.given.map((v, i) => [`quad-missed#${i}`, ans + v]));
  if (p.k === 1) return { 'quad-missed#0': ans + 90, 'quad-missed#1': ans + p.given[0], 'quad-missed#2': ans + p.given[1] };
  const [a, b] = p.given;
  return { 'forgot-half': 360 - a - b, 'wrong-total': 180 - a - b > 0 ? (180 - a - b) / 2 : null };
}
const quadPrinted = (p) => (p.k === 1 ? [...p.given, 90] : p.given);

/** A fair quadrilateral question of kind k (0, 1, 2), drawn with the source r. */
export function drawQuad(r, k) {
  for (;;) {
    const q = rint(r, 0, 3); let p;
    if (k === 0) {
      const given = [5 * rint(r, 12, 30), 5 * rint(r, 12, 30), 5 * rint(r, 12, 30)]; const f = 360 - given[0] - given[1] - given[2];
      if (f < 45 || f > 170) continue;
      p = { k, q, given, g: place(q, f, given) };
    } else if (k === 1) {
      const s = (q + rint(r, 1, 3)) % 4; const given = [5 * rint(r, 14, 30), 5 * rint(r, 12, 30)]; const f = 270 - given[0] - given[1];
      if (f < 45 || f > 170 || given.includes(90)) continue;
      const rest = [...given]; const g = [0, 1, 2, 3].map((i) => (i === q ? f : i === s ? 90 : rest.shift()));
      p = { k, q, s, given, g };
    } else {
      const j = (q + rint(r, 1, 3)) % 4; const given = [5 * rint(r, 14, 34), 5 * rint(r, 10, 30)];
      if ((360 - given[0] - given[1]) % 2) continue;
      const f = (360 - given[0] - given[1]) / 2;
      if (f < 40 || f > 170) continue;
      const rest = [...given]; const g = [0, 1, 2, 3].map((i) => (i === q || i === j ? f : rest.shift()));
      p = { k, q, j, given, g };
    }
    if (fairAngle(quadAnswer(p), quadBugs(p), quadPrinted(p))) return p;
  }
}
/** One of the three kinds: three given 30%, a right angle and two 30%, two equal angles 40% (wrong-total shows only there). */
export const drawQuadAny = (r) => { const x = r(); return drawQuad(r, x < 0.3 ? 0 : x < 0.6 ? 1 : 2); };

/** The corners other than the asked one (and the right angle or the equal partner), in order: where the givens are. */
const givenAt = (p) => [0, 1, 2, 3].filter((i) => i !== p.q && i !== p.s && i !== p.j);
/**
 * The drawing of a quadrilateral question, to size, with the asked corner's '?'; with `found`, the answer written there
 * instead (and at its equal partner), as the class writes the found value back on the figure.
 */
export function quadFig(p, found) {
  const marks = {};
  givenAt(p).forEach((i) => { marks[CORNER[i]] = given(p.g[i]); });
  marks[CORNER[p.q]] = found != null ? { text: `${found}°` } : asked;
  if (p.k === 1) marks[CORNER[p.s]] = { right: true };
  if (p.k === 2) { marks[CORNER[p.q]] = { ...marks[CORNER[p.q]], n: 2 }; marks[CORNER[p.j]] = { n: 2, ...(found != null ? { text: `${found}°` } : {}) }; }
  const f = quad(p.g, marks);
  const said = givenAt(p).map((i) => `∢${CORNER[i]} = ${p.g[i]}°`);
  const extra = p.k === 1 ? `, הזווית ב־${CORNER[p.s]} ישרה` : p.k === 2 ? `, ∢${CORNER[p.q]} = ∢${CORNER[p.j]} (מסומנות)` : '';
  return { ...f, label: `מרובע ABCD: ${said.join(', ')}${extra}, ו־∢${CORNER[p.q]} ${found != null ? `= ${found}°` : 'מסומנת ב־?'}` };
}

export function quadText(p) {
  const list = andList(givenAt(p).map((i) => `$${sa(CORNER[i])} = ${p.g[i]}^\\circ$`));
  const X = CORNER[p.q];
  if (p.k === 0) return `במרובע $ABCD$: ${list}. מה גודל $${sa(X)}$?`;
  if (p.k === 1) return `במרובע $ABCD$ הזווית $${CORNER[p.s]}$ ישרה, ${list}. מה גודל $${sa(X)}$?`;
  return `במרובע $ABCD$: ${list}. שתי הזוויות המסומנות שוות: $${sa(X)} = ${sa(CORNER[p.j])}$. מה גודל $${sa(X)}$?`;
}
export function quadHint(p) {
  if (p.k === 0) return 'סכום זוויות במרובע שווה $360^\\circ$. כמה מזה תופסות שלוש הזוויות הידועות?';
  if (p.k === 1) return 'סכום זוויות במרובע שווה $360^\\circ$. גם הזווית הישרה היא אחת מהן: $90^\\circ$, גם אם לא כתוב לידה מספר.';
  return 'סכום זוויות במרובע שווה $360^\\circ$. מה שנשאר אחרי שתי הזוויות הידועות מתחלק בין שתי הזוויות השוות.';
}
export function quadSolution(p) {
  const ans = quadAnswer(p); const X = sa(CORNER[p.q]); const gs = givenAt(p).map((i) => p.g[i]);
  // the known angles added first, then taken from 360°: 360° less three angles in one line is wider than a phone
  const plus = (vs) => vs.map((v) => `${v}^\\circ`).join(' + ');
  if (p.k === 0) return ['סכום זוויות במרובע שווה $360^\\circ$.', `שלוש הזוויות הידועות יחד: $${plus(gs)} = ${360 - ans}^\\circ$`, `$${X} = 360^\\circ - ${360 - ans}^\\circ = ${ans}^\\circ$`];
  if (p.k === 1) return ['סכום זוויות במרובע שווה $360^\\circ$, והזווית הישרה היא $90^\\circ$ מתוכן.', `שלוש הזוויות הידועות יחד, עם הישרה: $${plus([90, ...gs])} = ${360 - ans}^\\circ$`, `$${X} = 360^\\circ - ${360 - ans}^\\circ = ${ans}^\\circ$`];
  const s = 360 - gs[0] - gs[1];
  return [`סכום זוויות במרובע שווה $360^\\circ$. לשתי הזוויות השוות נשאר: $360^\\circ - ${gs[0]}^\\circ - ${gs[1]}^\\circ = ${s}^\\circ$`, `כל אחת מהן חצי: $${X} = ${s}^\\circ : 2 = ${ans}^\\circ$`];
}
const quadKey = (p) => (p.k === 0 ? `an7a:${p.given.join(':')}:${p.q}` : p.k === 1 ? `an7b:${p.given.join(':')}:${p.q}:${p.s}` : `an7c:${p.given.join(':')}:${p.q}:${p.j}`);

/** A quadrilateral question (kind k, or one of the three by their shares). */
export function quadItem(k) {
  const p = k == null ? drawQuadAny(Math.random) : drawQuad(Math.random, k);
  const ans = quadAnswer(p); const bugs = quadBugs(p);
  return {
    key: quadKey(p), form: 'num', answer: ans, unit: DEG, fig: quadFig(p),
    text: quadText(p), hint: quadHint(p), solution: quadSolution(p),
    diag: diagFor(ans, bugs), tries: triesOf(bugs),
  };
}
