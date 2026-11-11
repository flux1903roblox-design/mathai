// The template test of the proof templates (GEOM-3 Tests), shared by content/congr.test.js and learn/content.test.ts
// (checkSteps on a proof explore). Only tests import this file.
//   templateFaults(T)  what is wrong with a template, as sentences ([] when nothing is): at least three rows; the free
//                      groups in range and contiguous; every reason (fixed or a choice) in the bank, every asked reason
//                      with three or four different choices and its answer among them; one theorem row, after every
//                      row its theorem uses (the theorem's own pattern of sides and angles) and before every
//                      "corresponding parts" row; every claim, given and goal rendering in KaTeX
//   figureFaults(T)    where the drawing is not true: every equality, ⊥ and ∥ a claim, the givens or the goal state
//                      holds in the drawing's points, and every letter they name is a point of it
import katex from 'katex';
import { REASONS, THEOREMS, R, proofRows } from './congr.js';

const tex = (s) => (String(s).match(/\$([^$]+)\$/g) || []).map((m) => m.slice(1, -1));
const isAngle = (claim) => /\\sphericalangle/.test(claim);
/** The sides and angles a theorem stands on. */
const PATTERN = { [R.sas]: { side: 2, angle: 1 }, [R.asa]: { side: 1, angle: 2 }, [R.sss]: { side: 3, angle: 0 }, [R.aa]: { side: 0, angle: 2 } };
const right = (s) => (s.fixed != null ? s.fixed : s.reason ? s.reason.choices[s.reason.answer] : '');

export function templateFaults(T) {
  const out = [];
  const part = { steps: T.steps, free: T.free };
  const n = T.steps.length;
  if (n < 3) out.push(`${T.id}: ${n} rows`);
  (T.free || []).forEach((g) => {
    if (!g.every((k) => Number.isInteger(k) && k >= 0 && k < n)) out.push(`${T.id}: free group ${g} out of range`);
    const s = [...g].sort((a, b) => a - b);
    if (s.some((k, i) => i && k !== s[i - 1] + 1)) out.push(`${T.id}: free group ${g} is not contiguous`);
  });
  T.steps.forEach((s, i) => {
    const at = `${T.id} row ${i + 1}`;
    if (!!s.reason === (s.fixed != null)) out.push(`${at}: a row either asks its reason or shows it`);
    const texts = s.fixed != null ? [s.fixed] : s.reason ? s.reason.choices : [];
    texts.forEach((t) => { if (!REASONS.includes(t)) out.push(`${at}: "${t}" is not in the reason bank`); });
    if (s.reason) {
      const { choices, answer } = s.reason;
      if (choices.length < 3 || choices.length > 4) out.push(`${at}: ${choices.length} choices`);
      if (new Set(choices).size !== choices.length) out.push(`${at}: a choice twice`);
      if (!(Number.isInteger(answer) && answer >= 0 && answer < choices.length)) out.push(`${at}: answer ${answer} out of range`);
    }
  });
  const { thm, parts } = proofRows(part);
  if (thm !== T.thm) out.push(`${T.id}: the theorem row is ${thm + 1}, not ${T.thm + 1}`);
  if (T.steps.filter((s) => THEOREMS.includes(right(s))).length !== 1) out.push(`${T.id}: not exactly one theorem row`);
  if (thm >= 0) {
    const want = PATTERN[right(T.steps[thm])];
    const used = T.uses.map((i) => T.steps[i]);
    if (T.uses.some((i) => i >= thm)) out.push(`${T.id}: the theorem uses a row below it`);
    const got = { side: used.filter((s) => !isAngle(s.text)).length, angle: used.filter((s) => isAngle(s.text)).length };
    if (!want || got.side !== want.side || got.angle !== want.angle) out.push(`${T.id}: ${right(T.steps[thm])} stands on ${got.side} sides and ${got.angle} angles`);
    parts.forEach((i) => { if (i < thm) out.push(`${T.id} row ${i + 1}: a corresponding part above the congruence`); });
    // a free group never takes the theorem row, nor a row the theorem stands on together with a row it does not
    (T.free || []).forEach((g) => { if (g.includes(thm)) out.push(`${T.id}: the theorem row in a free group`); });
  }
  [T.given, T.goal, ...T.steps.map((s) => s.text), ...T.steps.flatMap((s) => (s.reason ? s.reason.choices : [s.fixed]))].flatMap(tex).forEach((m) => {
    try { katex.renderToString(m, { throwOnError: true }); } catch (e) { out.push(`${T.id}: "${m}" does not render (${e.message})`); }
  });
  return out;
}

// ---------------------------------------------------------------- the drawing is true
const sub = (p, q) => [p[0] - q[0], p[1] - q[1]];
const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
/** The angle at b between a and c, in degrees. */
const angleAt = (a, b, c) => { const u = sub(a, b); const v = sub(c, b); return (Math.acos((u[0] * v[0] + u[1] * v[1]) / (Math.hypot(...u) * Math.hypot(...v))) * 180) / Math.PI; };

/** The value of one side of an equality: a length XY, an angle ∢XYZ (or ∢Y in its polygon), or a number of degrees. */
function valueOf(fig, term) {
  const P = fig.pts;
  const t = term.replace(/\s+/g, ' ').trim();
  const deg = t.match(/^(\d+(?:\.\d+)?)°$/);
  if (deg) return Number(deg[1]);
  const a3 = t.match(/^\\sphericalangle ([A-Z])([A-Z])([A-Z])$/);
  if (a3) return angleAt(P[a3[1]], P[a3[2]], P[a3[3]]);
  const a1 = t.match(/^\\sphericalangle ([A-Z])$/);
  if (a1) {
    // the angle at a vertex of the polygon that holds it, between its two neighbours there
    const pg = (fig.polys || []).find((g) => g.pts.includes(a1[1]));
    if (!pg) return NaN;
    const k = pg.pts.indexOf(a1[1]); const L = pg.pts.length;
    return angleAt(P[pg.pts[(k + L - 1) % L]], P[a1[1]], P[pg.pts[(k + 1) % L]]);
  }
  const seg = t.match(/^([A-Z])([A-Z])$/);
  if (seg) return dist(P[seg[1]], P[seg[2]]);
  return NaN;
}

/** Every fact a piece of maths states that a drawing can show, checked in its points (null: it states none). */
function factFaults(fig, m) {
  if (/\\cong|\\sim/.test(m)) return [];
  const P = fig.pts;
  const perp = m.match(/^([A-Z])([A-Z]) \\perp ([A-Z])([A-Z])$/);
  const par = m.match(/^([A-Z])([A-Z]) \\parallel ([A-Z])([A-Z])$/);
  if (perp || par) {
    const [, a, b, c, d] = perp || par;
    const u = sub(P[b], P[a]); const v = sub(P[d], P[c]);
    const val = perp ? u[0] * v[0] + u[1] * v[1] : u[0] * v[1] - u[1] * v[0];
    return Math.abs(val) < 1e-9 ? [] : [`"${m}" does not hold in the drawing`];
  }
  if (!m.includes('=')) return [];
  const vals = m.split('=').map((x) => valueOf(fig, x));
  if (vals.some((v) => !Number.isFinite(v))) return [`"${m}" cannot be read against the drawing`];
  return vals.every((v) => Math.abs(v - vals[0]) < 1e-6) ? [] : [`"${m}" does not hold in the drawing (${vals.map((v) => v.toFixed(3)).join(' ≠ ')})`];
}

export function figureFaults(T) {
  const out = [];
  const fig = T.fig;
  if (fig?.type !== 'geo') return [`${T.id}: no geo drawing`];
  const maths = [T.given, T.goal, ...T.steps.map((s) => s.text)].flatMap(tex);
  maths.forEach((m) => {
    (m.match(/[A-Z]/g) || []).forEach((c) => { if (!fig.pts[c]) out.push(`${T.id}: ${c} is not a point of the drawing`); });
    factFaults(fig, m).forEach((f) => out.push(`${T.id}: ${f}`));
  });
  return out;
}
