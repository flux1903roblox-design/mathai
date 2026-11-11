// Textbook figures drawn from the generators' data: coordinate plane, angles,
// triangles and a frequency table. Drawn on the same 4px grid as the page.
// Algebra's figures are still pictures of its interactive objects, drawn by the same code:
//   scale  { left: { x, n }, right: { x, n }, tilt? }  boxes x and weights on each pan; tilt −1 the left pan is down,
//                                                       1 the right one, 0 or none level (a one-sided change, shown)
//   area   { a, b, areas? }                             a rectangle a high and x + b long; areas: write each part's area
//   ray    { at, dir, closed, min?, max? }              an inequality's solutions on the number line
//   tiles  { px, nx, p1, n1 }                           algebra tiles: x, −x, 1 and −1
// Fractions, percent and ratio (curriculum stage 1):
//   numline { from, to, marks?: [{ x, label?, tone? }], jumps?: [{ from, to, label? }], step?, anim?, den? }
//          a number line; with den, small ticks every 1/den and labels on whole numbers only ("A at k" is a mark at k/den)
//   fbar   { den, shaded, marks?, whole?, labels?, hatch?, cross?, rows?: [{ den, shaded, label? }] }   the fraction bar;
//          rows stack bars of one length, hatch hatches the first shaded parts (a part of a part), cross crosses out the
//          last ones (taken away), labels writes each bar's fraction beside it, whole names the whole bar (0 … whole)
//   fgrid  { rows, cols, shadeRows, shadeCols, label? }   a rectangle cut both ways: columns shaded one way, rows the
//          other, the overlap darkest (3/4 of 1/2 as an area)
//   dline  { top, bottom, at?, show?: 'both' | 'top' | 'bottom', label? }   the double number line, its marker at `at`
//          on the top line; show which values are written at the marker; label writes one value under it ('1400', '?');
//          blank writes no number on the bottom line but 0 (the whole is what the picture asks)
//   groups { rows: [{ n, label }] }                     dots in fives, a Hebrew label at the start of each row
import { useId } from 'react';
import clsx from 'clsx';
import { ScaleArt, scaleView, scaleTop } from './manip/Balance.jsx';
import { AreaArt, areaView } from './manip/AreaModel.jsx';
import { RayArt, RAY_VIEW } from './manip/Ray.jsx';
import { TilesArt, TILES_VIEW } from './manip/Tiles.jsx';
import { BarArt, MarksArt, WholeArt, HatchDef } from './manip/FracBar.jsx';
import { DlineArt, DLINE_VIEW } from './manip/DoubleLine.jsx';
import { SvgLabel, minus } from './manip/core.jsx';
import { panWords, tilesWords, rayText, areaTex, withUnit, dlineAt, figWords } from '@/content/manip.js';
const rad = (d) => (d * Math.PI) / 180;
const MATH_FONT = "KaTeX_Main, 'Times New Roman', serif";

function Coord({ fig }) {
  const r = fig.range || 6; const c = 22; const pad = 26;
  const size = 2 * r * c + 2 * pad; const o = size / 2;
  const X = (x) => o + x * c; const Y = (y) => o - y * c;
  const ticks = []; for (let i = -r; i <= r; i++) ticks.push(i);
  const label = (n) => (n < 0 ? `−${-n}` : `${n}`);
  let lineEl = null;
  if (fig.line) {
    const { m, b } = fig.line; const x1 = -r - 0.5; const x2 = r + 0.5;
    lineEl = <line x1={X(x1)} y1={Y(m * x1 + b)} x2={X(x2)} y2={Y(m * x2 + b)} className="fg-line" />;
  }
  const visible = (fig.points || []).filter((p) => !p.hidden);
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="figure coord" role="img" aria-label="מערכת צירים">
      <defs>
        <clipPath id="plane"><rect x={X(-r - 0.5)} y={Y(r + 0.5)} width={(2 * r + 1) * c} height={(2 * r + 1) * c} /></clipPath>
      </defs>
      {ticks.map((i) => <line key={`v${i}`} x1={X(i)} y1={Y(r + 0.5)} x2={X(i)} y2={Y(-r - 0.5)} className="fg-grid" />)}
      {ticks.map((i) => <line key={`h${i}`} x1={X(-r - 0.5)} y1={Y(i)} x2={X(r + 0.5)} y2={Y(i)} className="fg-grid" />)}
      <line x1={X(-r - 0.6)} y1={o} x2={X(r + 0.75)} y2={o} className="fg-axis" />
      <line x1={o} y1={Y(-r - 0.6)} x2={o} y2={Y(r + 0.75)} className="fg-axis" />
      <polygon points={`${X(r + 0.95)},${o} ${X(r + 0.6)},${o - 4} ${X(r + 0.6)},${o + 4}`} className="fg-axis-head" />
      <polygon points={`${o},${Y(r + 0.95)} ${o - 4},${Y(r + 0.6)} ${o + 4},${Y(r + 0.6)}`} className="fg-axis-head" />
      <text x={X(r + 0.75)} y={o + 16} className="fg-axis-name" style={{ fontFamily: MATH_FONT }}>x</text>
      <text x={o + 8} y={Y(r + 0.7)} className="fg-axis-name" style={{ fontFamily: MATH_FONT }}>y</text>
      {ticks.filter((i) => i && i % 2 === 0).map((i) => (
        <g key={`t${i}`}>
          <text x={X(i)} y={o + 17} textAnchor="middle" className="fg-tick">{label(i)}</text>
          <text x={o - 6} y={Y(i) + 5} textAnchor="end" className="fg-tick">{label(i)}</text>
        </g>
      ))}
      <g clipPath="url(#plane)">
        {fig.polygon && <polygon points={fig.polygon.map(([x, y]) => `${X(x)},${Y(y)}`).join(' ')} className="fg-poly" />}
        {lineEl}
        {fig.helper && <polyline points={fig.helper.map(([x, y]) => `${X(x)},${Y(y)}`).join(' ')} className="fg-helper" />}
        {(fig.segments || []).map(([[x1, y1], [x2, y2]], i) => <line key={i} x1={X(x1)} y1={Y(y1)} x2={X(x2)} y2={Y(y2)} className="fg-seg" />)}
      </g>
      {visible.map((p) => (
        <g key={p.label}>
          <circle cx={X(p.x)} cy={Y(p.y)} r="5" className="fg-pt" />
          {/* the letter sits on the side away from both axes, so it never lands on their numbers */}
          <text x={X(p.x) + (p.x >= 0 ? 9 : -9)} y={p.y >= 0 ? Y(p.y) - 9 : Y(p.y) + 21} textAnchor={p.x >= 0 ? 'start' : 'end'} className="fg-pt-label" style={{ fontFamily: MATH_FONT }}>{p.label}</text>
        </g>
      ))}
    </svg>
  );
}

function arcPath(cx, cy, rr, a0, a1) {
  const p0 = [cx + rr * Math.cos(rad(a0)), cy - rr * Math.sin(rad(a0))];
  const p1 = [cx + rr * Math.cos(rad(a1)), cy - rr * Math.sin(rad(a1))];
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  return `M ${p0[0]} ${p0[1]} A ${rr} ${rr} 0 ${large} 0 ${p1[0]} ${p1[1]}`;
}
function AngleMark({ cx, cy, a0, a1, text, target, rr = 30, lr: far }) {
  const mid = (a0 + a1) / 2; const lr = far ?? rr + 16;
  return (
    <g>
      <path d={arcPath(cx, cy, rr, a0, a1)} className={target ? 'fg-arc target' : 'fg-arc'} />
      <text x={cx + lr * Math.cos(rad(mid))} y={cy - lr * Math.sin(rad(mid)) + 5} textAnchor="middle" className={target ? 'fg-angle target' : 'fg-angle'}>{text}</text>
    </g>
  );
}
const ray = (cx, cy, a, L) => [cx + L * Math.cos(rad(a)), cy - L * Math.sin(rad(a))];

function Linear({ fig }) {
  const O = [170, 150]; const [ex, ey] = ray(...O, fig.a, 120);
  return (
    <svg viewBox="0 0 340 190" className="figure" role="img" aria-label="זוויות צמודות">
      <line x1="20" y1={O[1]} x2="320" y2={O[1]} className="fg-ray" />
      <line x1={O[0]} y1={O[1]} x2={ex} y2={ey} className="fg-ray" />
      <AngleMark cx={O[0]} cy={O[1]} a0={0} a1={fig.a} text={`${fig.a}°`} />
      <AngleMark cx={O[0]} cy={O[1]} a0={fig.a} a1={180} text="?" target rr={24} />
      <circle cx={O[0]} cy={O[1]} r="3" className="fg-vertex" />
    </svg>
  );
}

function Cross({ fig }) {
  const O = [170, 110]; const a = fig.a;
  const [x1, y1] = ray(...O, a, 110); const [x2, y2] = ray(...O, a + 180, 110);
  const t = fig.target === 'vertical' ? [180, 180 + a] : [a, 180];
  return (
    <svg viewBox="0 0 340 220" className="figure" role="img" aria-label="ישרים נחתכים">
      <line x1="30" y1={O[1]} x2="310" y2={O[1]} className="fg-ray" />
      <line x1={x2} y1={y2} x2={x1} y2={y1} className="fg-ray" />
      <AngleMark cx={O[0]} cy={O[1]} a0={0} a1={a} text={`${a}°`} />
      <AngleMark cx={O[0]} cy={O[1]} a0={t[0]} a1={t[1]} text="?" target rr={24} />
      <circle cx={O[0]} cy={O[1]} r="3" className="fg-vertex" />
    </svg>
  );
}

function Parallel({ fig }) {
  const a = fig.a; const yU = 70; const yL = 160; const k = Math.cos(rad(a)) / Math.sin(rad(a));
  const U = [170 + ((yL - yU) / 2) * k, yU]; const Lw = [170 - ((yL - yU) / 2) * k, yL]; // up by Δy moves x by Δy·cot(a)
  const [tx1, ty1] = ray(...U, a, 60); const [tx2, ty2] = ray(...Lw, a + 180, 60);
  const pos = { ur: [0, a], ul: [a, 180], ll: [180, 180 + a], lr: [180 + a, 360] };
  const plan = { corresponding: [['U', 'ur'], ['L', 'ur']], alternate: [['U', 'll'], ['L', 'ur']], cointerior: [['L', 'ur'], ['U', 'lr']] }[fig.kind];
  const at = (w) => (w === 'U' ? U : Lw);
  const [known, target] = plan;
  return (
    <svg viewBox="0 0 340 230" className="figure" role="img" aria-label="ישרים מקבילים וחותך">
      <line x1="20" y1={yU} x2="320" y2={yU} className="fg-ray" />
      <line x1="20" y1={yL} x2="320" y2={yL} className="fg-ray" />
      <line x1={tx2} y1={ty2} x2={tx1} y2={ty1} className="fg-ray" />
      <path d={`M 300 ${yU - 5} l 8 5 l -8 5`} className="fg-par" />
      <path d={`M 300 ${yL - 5} l 8 5 l -8 5`} className="fg-par" />
      <AngleMark cx={at(known[0])[0]} cy={at(known[0])[1]} a0={pos[known[1]][0]} a1={pos[known[1]][1]} text={`${a}°`} rr={24} />
      <AngleMark cx={at(target[0])[0]} cy={at(target[0])[1]} a0={pos[target[1]][0]} a1={pos[target[1]][1]} text="?" target rr={20} />
    </svg>
  );
}

function Triangle({ fig }) {
  const [v0, v1, v2] = fig.angles;
  // geometry angles at base-left, base-right, apex
  const [A, B, C] = fig.exterior ? [v0, v2, v1] : [v0, v1, v2];
  const base = 1; const sideB = (base * Math.sin(rad(B))) / Math.sin(rad(C));
  const apex = [sideB * Math.cos(rad(A)), sideB * Math.sin(rad(A))];
  const pts = [[0, 0], [base, 0], apex];
  const ext = fig.exterior ? 0.45 : 0;
  const xs = [...pts.map((p) => p[0]), base + ext]; const ys = pts.map((p) => p[1]);
  const W = 280; const H = 170; const s = Math.min(W / (Math.max(...xs) - Math.min(...xs)), H / (Math.max(...ys) - Math.min(...ys)));
  const ox = 30 - Math.min(...xs) * s; const oy = 200;
  const P = pts.map(([x, y]) => [ox + x * s, oy - y * s]);
  const dirDeg = (from, to) => (Math.atan2(-(to[1] - from[1]), to[0] - from[0]) * 180) / Math.PI;
  const norm = (d) => ((d % 360) + 360) % 360;
  const labels = []; let hiddenSeen = false;
  const angleSpans = [
    [P[0], norm(dirDeg(P[0], P[1])), norm(dirDeg(P[0], P[2]))],
    [P[1], norm(dirDeg(P[1], P[2])), norm(dirDeg(P[1], P[0]))],
    [P[2], norm(dirDeg(P[2], P[0])), norm(dirDeg(P[2], P[1]))],
  ];
  const valueAt = fig.exterior ? [v0, null, v1] : [v0, v1, v2];
  const shownAt = fig.exterior ? [true, false, true] : fig.show;
  angleSpans.forEach(([pt, a0, a1], i) => {
    let b = a1; if (b < a0) b += 360;
    if (shownAt[i]) labels.push(<AngleMark key={i} cx={pt[0]} cy={pt[1]} a0={a0} a1={b} text={`${valueAt[i]}°`} rr={22} />);
    else if (!fig.exterior && !hiddenSeen) { hiddenSeen = true; labels.push(<AngleMark key={i} cx={pt[0]} cy={pt[1]} a0={a0} a1={b} text="?" target rr={20} />); }
  });
  let extEl = null;
  if (fig.exterior) {
    const end = [P[1][0] + ext * s, P[1][1]];
    const a1 = norm(dirDeg(P[1], P[2]));
    extEl = (
      <g>
        <line x1={P[1][0]} y1={P[1][1]} x2={end[0]} y2={end[1]} className="fg-ray dashed" />
        <AngleMark cx={P[1][0]} cy={P[1][1]} a0={0} a1={a1} text="?" target rr={20} />
      </g>
    );
  }
  const tick = (p, q) => { const m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; const d = Math.atan2(q[1] - p[1], q[0] - p[0]) + Math.PI / 2; return <line x1={m[0] - 6 * Math.cos(d)} y1={m[1] - 6 * Math.sin(d)} x2={m[0] + 6 * Math.cos(d)} y2={m[1] + 6 * Math.sin(d)} className="fg-ray" />; };
  return (
    <svg viewBox="0 0 340 230" className="figure" role="img" aria-label="משולש">
      <polygon points={P.map((p) => p.join(',')).join(' ')} className="fg-tri" />
      {fig.iso && <>{tick(P[0], P[2])}{tick(P[1], P[2])}</>}
      {labels}
      {extEl}
    </svg>
  );
}

function RightTri({ fig }) {
  const a = typeof fig.a === 'number' ? fig.a : null; const b = typeof fig.b === 'number' ? fig.b : null; const c = typeof fig.c === 'number' ? fig.c : null;
  const A = a ?? Math.sqrt(c * c - b * b); const B = b ?? Math.sqrt(c * c - a * a);
  const s = Math.min(240 / B, 160 / A);
  const P0 = [60, 190]; const P1 = [60 + B * s, 190]; const P2 = [60, 190 - A * s];
  const t = (v) => (typeof v === 'number' ? `${v}` : '?');
  return (
    <svg viewBox="0 0 340 230" className="figure" role="img" aria-label="משולש ישר־זווית">
      <polygon points={[P0, P1, P2].map((p) => p.join(',')).join(' ')} className="fg-tri" />
      <polyline points={`${P0[0] + 14},${P0[1]} ${P0[0] + 14},${P0[1] - 14} ${P0[0]},${P0[1] - 14}`} className="fg-ray thin" />
      <text x={P0[0] - 12} y={(P0[1] + P2[1]) / 2 + 5} textAnchor="end" className={fig.a === '?' ? 'fg-side target' : 'fg-side'}>{t(fig.a)}</text>
      <text x={(P0[0] + P1[0]) / 2} y={P0[1] + 24} textAnchor="middle" className={fig.b === '?' ? 'fg-side target' : 'fg-side'}>{t(fig.b)}</text>
      <text x={(P1[0] + P2[0]) / 2 + 12} y={(P1[1] + P2[1]) / 2 - 8} className={fig.c === '?' ? 'fg-side target' : 'fg-side'}>{t(fig.c)}</text>
    </svg>
  );
}

function Ladder({ fig }) {
  const wall = typeof fig.wall === 'number' ? fig.wall : Math.sqrt(fig.len ** 2 - fig.foot ** 2);
  const s = Math.min(170 / wall, 150 / fig.foot);
  const base = [250, 200]; const top = [250, 200 - wall * s]; const foot = [250 - fig.foot * s, 200];
  const t = (v) => (typeof v === 'number' ? `${v}` : '?');
  return (
    <svg viewBox="0 0 340 230" className="figure" role="img" aria-label="סולם נשען על קיר">
      <rect x="250" y="16" width="14" height="184" className="fg-wall" />
      <line x1="30" y1="200" x2="300" y2="200" className="fg-ray" />
      <line x1={foot[0]} y1={foot[1]} x2={top[0]} y2={top[1]} className="fg-ladder" />
      <polyline points={`${base[0] - 14},${base[1]} ${base[0] - 14},${base[1] - 14} ${base[0]},${base[1] - 14}`} className="fg-ray thin" />
      <text x={(foot[0] + base[0]) / 2} y="222" textAnchor="middle" className="fg-side">{t(fig.foot)}</text>
      <text x="276" y={(base[1] + top[1]) / 2 + 5} className={fig.wall === '?' ? 'fg-side target' : 'fg-side'}>{t(fig.wall)}</text>
      <text x={(foot[0] + top[0]) / 2 - 14} y={(foot[1] + top[1]) / 2} textAnchor="end" className={fig.len === '?' ? 'fg-side target' : 'fg-side'}>{t(fig.len)}</text>
    </svg>
  );
}

// Numbers stay left-to-right inside the RTL table, with a real minus sign.
const cell = (v) => String(v).replace(/^-/, '\u2212');

function Table({ fig }) {
  return (
    <table className="fg-table">
      <thead><tr>{fig.head.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
      <tbody>{fig.rows.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j}><bdi dir="ltr">{cell(v)}</bdi></td>)}</tr>)}</tbody>
    </table>
  );
}


// ---------------------------------------------------------------- geo: a teaching drawing from named points
// The figure of a teaching step that names a shape or a part of one (a ray, a vertex, a leg, the hypotenuse, a
// transversal, an exterior angle). Points are given in units with y up; the drawing is fitted to the box. Letters are
// the points' own names (a name that starts with "_" is drawn without a letter), so they match the step's text; the
// tests (learn/figures.test.ts) check the letters against the text and every number against the geometry.
//   pts      { A: [x, y], ... }
//   polys    [{ pts: ['A', 'B', 'C'] }]                         a filled shape (a triangle)
//   segs     [{ a, b, ext: [before, after], dash, thin, hi, label, side: 'in', t, ticks, arrows }]   t: where the label sits along ab
//            a segment, or a line or ray when extended past a or b (in units); label: a number, '?', a letter or a word
//   angles   [{ at, from, to, text, target, right, r, n }]       the angle swept counterclockwise from ray at→from to at→to;
//            n: 2 or 3 arcs for angles that are equal; right: the small square of a right angle
//   squares  [{ a, b, away, text, hi }]                          the square on segment ab, on the side away from point `away`
//   words    [{ at: [x, y] | name, text, dx, dy, anchor }]        a short Hebrew label
//   moves    [{ from: [x, y], to: [x, y] }]                      a dashed arrow: something slides or turns
//   dots     ['O']                                               a vertex dot;   lab: { A: [dx, dy] } moves a letter
const WORD = /[\u0590-\u05ff]/;
/** About half the width and half the height of a label, in drawing units (Hebrew words at 16px, numbers at 18px). */
const labelSize = (t) => [String(t).length * (WORD.test(t) ? 4.6 : 5.4) + 2, 9];
const unitDir = (p, q) => { const d = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1; return [(q[0] - p[0]) / d, (q[1] - p[1]) / d]; };
export function geoSquare(a, b, away) {
  const n = [-(b[1] - a[1]), b[0] - a[0]]; // a normal of ab, as long as ab
  const side = away ? Math.sign(n[0] * (away[0] - a[0]) + n[1] * (away[1] - a[1])) : -1;
  const k = side > 0 ? -1 : 1;
  return [a, b, [b[0] + k * n[0], b[1] + k * n[1]], [a[0] + k * n[0], a[1] + k * n[1]]];
}
const segEnds = (P, sg) => {
  const a = P[sg.a]; const b = P[sg.b]; const [ux, uy] = unitDir(a, b); const [e0, e1] = sg.ext || [0, 0];
  return [[a[0] - ux * e0, a[1] - uy * e0], [b[0] + ux * e1, b[1] + uy * e1]];
};
/** Degrees, counterclockwise, of the angle at `at` from ray at→from to ray at→to (units, y up): what a mark spans. */
export function geoSweep(P, g) {
  const v = P[g.at]; const f = P[g.from]; const t = P[g.to];
  const a0 = (Math.atan2(f[1] - v[1], f[0] - v[0]) * 180) / Math.PI; let a1 = (Math.atan2(t[1] - v[1], t[0] - v[0]) * 180) / Math.PI;
  while (a1 <= a0) a1 += 360;
  return { a0, a1, deg: a1 - a0 };
}

function Geo({ fig }) {
  const [W, H] = fig.view || [300, 200];
  const [padX, padY] = Array.isArray(fig.pad) ? fig.pad : [fig.pad ?? 30, fig.pad ?? 30];
  const P = fig.pts;
  const at = (k) => (Array.isArray(k) ? k : P[k]);
  const sqs = (fig.squares || []).map((q) => ({ ...q, c: geoSquare(P[q.a], P[q.b], q.away ? P[q.away] : null) }));
  const segs = (fig.segs || []).map((sg) => ({ ...sg, e: segEnds(P, sg) }));
  const all = [...Object.values(P), ...sqs.flatMap((q) => q.c), ...segs.flatMap((sg) => sg.e), ...(fig.words || []).filter((w) => Array.isArray(w.at)).map((w) => w.at), ...(fig.moves || []).flatMap((mv) => [mv.from, mv.to])];
  const xs = all.map((p) => p[0]); const ys = all.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const s = Math.min((W - 2 * padX) / Math.max(x1 - x0, 1e-9), (H - 2 * padY) / Math.max(y1 - y0, 1e-9));
  const ox = (W - (x1 - x0) * s) / 2 - x0 * s; const oy = (H + (y1 - y0) * s) / 2 + y0 * s;
  const X = (p) => [ox + p[0] * s, oy - p[1] * s];
  const named = Object.keys(P).filter((k) => !k.startsWith('_') && !(fig.hide || []).includes(k));
  // labels go out, away from the middle of the shape (the filled shape when there is one, else all the points)
  const core = fig.polys?.length ? fig.polys.flatMap((pg) => pg.pts.map((k) => P[k])) : Object.values(P);
  const centre = X([core.reduce((a, p) => a + p[0], 0) / core.length, core.reduce((a, p) => a + p[1], 0) / core.length]);
  const textCls = (t, target) => (WORD.test(t) ? 'fg-word' : /^[a-z]$/.test(t) ? 'fg-side fg-math' : t === '?' || target ? 'fg-side target' : 'fg-side');
  const markerId = `geo-arrow-${useId().replace(/[^\w-]/g, '')}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="figure geo" role="img" aria-label={fig.label || 'שרטוט'}>
      <defs><marker id={markerId} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 1 L 9 5 L 0 9 z" className="fg-move-head" /></marker></defs>
      {sqs.map((q, i) => {
        const c = q.c.map(X); const m = [c.reduce((a, p) => a + p[0], 0) / 4, c.reduce((a, p) => a + p[1], 0) / 4];
        return (
          <g key={`q${i}`}>
            <polygon points={c.map((p) => p.join(',')).join(' ')} className={q.hi ? 'fg-sq hi' : 'fg-sq'} />
            {q.text && <text x={m[0]} y={m[1] + 6} textAnchor="middle" className={q.text === '?' ? 'fg-side target' : 'fg-sq-text'}>{q.text}</text>}
          </g>
        );
      })}
      {(fig.polys || []).map((pg, i) => <polygon key={`p${i}`} points={pg.pts.map((k) => X(P[k]).join(',')).join(' ')} className="fg-tri" />)}
      {segs.map((sg, i) => {
        const [p, q] = sg.e.map(X);
        const cls = clsx('fg-ray', sg.dash && 'dashed', sg.thin && 'thin', sg.hi && 'hi');
        const A = X(P[sg.a]); const B = X(P[sg.b]); const t = sg.t ?? 0.5; const mid = [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t];
        const [ux, uy] = unitDir(A, B); let nx = -uy; let ny = ux;
        // a label goes on the side away from the middle of the figure, or inside with side: 'in'
        if ((mid[0] - centre[0]) * nx + (mid[1] - centre[1]) * ny < 0) { nx = -nx; ny = -ny; }
        if (sg.side === 'in') { nx = -nx; ny = -ny; }
        // far enough out that the whole label clears the line: half its width across, half its height up
        const half = sg.label ? labelSize(sg.label) : [0, 0];
        const off = (sg.off ?? 7) + Math.abs(nx) * half[0] + Math.abs(ny) * half[1];
        const ticks = Array.from({ length: sg.ticks || 0 }, (_, k) => { const t = (k - ((sg.ticks || 0) - 1) / 2) * 5; const c = [mid[0] + ux * t, mid[1] + uy * t]; return <line key={`t${k}`} x1={c[0] - nx * 6} y1={c[1] - ny * 6} x2={c[0] + nx * 6} y2={c[1] + ny * 6} className="fg-ray" />; });
        const arrows = Array.from({ length: sg.arrows || 0 }, (_, k) => { const c = [p[0] + (q[0] - p[0]) * 0.82 + ux * k * 7, p[1] + (q[1] - p[1]) * 0.82 + uy * k * 7]; return <path key={`a${k}`} d={`M ${c[0] - ux * 7 + nx * 5} ${c[1] - uy * 7 + ny * 5} L ${c[0]} ${c[1]} L ${c[0] - ux * 7 - nx * 5} ${c[1] - uy * 7 - ny * 5}`} className="fg-par" />; });
        return (
          <g key={`s${i}`}>
            <line x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} className={cls} />
            {ticks}{arrows}
            {sg.label && <text x={mid[0] + nx * off} y={mid[1] + ny * off + 6} textAnchor="middle" className={textCls(sg.label)}>{sg.label}</text>}
          </g>
        );
      })}
      {(fig.angles || []).map((g, i) => {
        const v = X(P[g.at]);
        if (g.right) {
          const u1 = unitDir(v, X(P[g.from])); const u2 = unitDir(v, X(P[g.to])); const k = 13;
          return <polyline key={`g${i}`} points={`${v[0] + u1[0] * k},${v[1] + u1[1] * k} ${v[0] + (u1[0] + u2[0]) * k},${v[1] + (u1[1] + u2[1]) * k} ${v[0] + u2[0] * k},${v[1] + u2[1] * k}`} className="fg-ray thin" />;
        }
        const { a0, a1, deg } = geoSweep(P, g);
        const rr = g.r ?? 24;
        // a narrow angle has its label further out, clear of its two arms
        const lr = rr + (deg < 40 ? 30 : deg < 60 ? 22 : 16);
        return (
          <g key={`g${i}`}>
            {/* two or three arcs mark angles that are equal to each other */}
            {Array.from({ length: Math.max(0, (g.n || 1) - 1) }, (_, k) => <path key={k} d={arcPath(v[0], v[1], rr - 5 * (k + 1), a0, a1)} className={g.target ? 'fg-arc target' : 'fg-arc'} />)}
            <AngleMark cx={v[0]} cy={v[1]} a0={a0} a1={a1} text={g.text || ''} target={g.target} rr={rr} lr={lr} />
          </g>
        );
      })}
      {(fig.moves || []).map((mv, i) => { const [p, q] = [X(mv.from), X(mv.to)]; return <line key={`m${i}`} x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} className="fg-move" markerEnd={`url(#${markerId})`} />; })}
      {(fig.dots || []).map((k) => { const p = X(P[k]); return <circle key={`d${k}`} cx={p[0]} cy={p[1]} r="3.5" className="fg-vertex" />; })}
      {named.map((k) => {
        const p = X(P[k]); const [dx, dy] = fig.lab?.[k] || (() => { const u = unitDir(centre, p); return Math.hypot(p[0] - centre[0], p[1] - centre[1]) < 1 ? [0, -16] : [u[0] * 16, u[1] * 16]; })();
        return <text key={`l${k}`} x={p[0] + dx} y={p[1] + dy + 6} textAnchor="middle" className="fg-pt-label" style={{ fontFamily: MATH_FONT }}>{k}</text>;
      })}
      {(fig.words || []).map((w, i) => { const p = X(at(w.at)); return <text key={`w${i}`} x={p[0] + (w.dx || 0)} y={p[1] + (w.dy || 0)} textAnchor={w.anchor || 'middle'} className={textCls(w.text)} direction={WORD.test(w.text) ? 'rtl' : undefined}>{w.text}</text>; })}
    </svg>
  );
}

function Scale({ fig }) {
  const u = { lx: fig.left.x, l1: fig.left.n, rx: fig.right.x, r1: fig.right.n };
  return (
    <svg viewBox={scaleView(u)} className="figure fg-obj fg-scale" role="img" aria-label={`מאזניים: בכף השמאלית ${panWords(u.lx, u.l1)}, בכף הימנית ${panWords(u.rx, u.r1)}`}>
      <ScaleArt u={u} tilt={fig.tilt || 0} top={scaleTop(u)} />
    </svg>
  );
}
function Area({ fig }) {
  return (
    <svg viewBox={areaView(fig)} className="figure fg-obj fg-area" role="img" aria-label={`מלבן בגובה ${fig.a} ובאורך x ועוד ${fig.b}${fig.areas ? `, השטח ${areaTex(fig)}` : ''}`}>
      <AreaArt a={fig.a} b={fig.b} areas={!!fig.areas} />
    </svg>
  );
}
function RayFig({ fig }) {
  return (
    <svg viewBox={RAY_VIEW} className="figure fg-obj fg-ray" role="img" aria-label={`ציר מספרים: ${rayText(fig)}`}>
      <RayArt at={fig.at} dir={fig.dir} closed={!!fig.closed} min={fig.min ?? -10} max={fig.max ?? 10} />
    </svg>
  );
}
// the still tiles keep room above the x row (on a phone the zoom button sits in that corner), and the box is tall
// enough that a 320px phone draws them at least 160px high
const TILES_FIG_VIEW = TILES_VIEW.split(' ').map(Number).map((v, i) => (i === 1 ? v - 30 : i === 3 ? v + 14 : v)).join(' ');
function TilesFig({ fig }) {
  return (
    <svg viewBox={TILES_FIG_VIEW} className="figure fg-obj fg-tiles" role="img" aria-label={`אריחים: ${tilesWords(fig)}`}>
      <TilesArt u={fig} />
    </svg>
  );
}

// ---------------------------------------------------------------- fractions, percent and ratio
const isWhole = (v) => Math.abs(v - Math.round(v)) < 1e-9;

/** A number line as a still picture: points named by letters, jumps as arcs, and with den the parts of every unit. */
function NumLine({ fig }) {
  const { from, to, den } = fig; const step = fig.step || 1;
  const marks = fig.marks || []; const jumps = fig.jumps || [];
  // drawn small (300 wide) so its numbers stay readable when the figure is scaled to a phone's width
  const W = 300; const PAD = 20;
  const unit = (W - 2 * PAD) / (to - from);
  const X = (v) => PAD + (v - from) * unit;
  // an arc rises with its length; its label (a stacked fraction at most) stands above it
  const liftOf = (j) => Math.min(64, 18 + Math.abs(X(j.to) - X(j.from)) * 0.3);
  const high = jumps.length ? Math.max(...jumps.map((j) => liftOf(j) + (j.label ? 40 : 14))) : 0;
  const top = Math.max(high + 8, marks.some((k) => k.label) ? 52 : 20);
  const LINE = top; const H = LINE + 42;
  // the ticks: every part with den (when they are at least 3px apart), else every `step`
  const per = den || 1 / step; const n = Math.round((to - from) * per);
  const ticks = Array.from({ length: n + 1 }, (_, i) => from + i / per);
  const dense = den && unit / den < 3;
  const tenth = (v) => den && den % 10 === 0 && den >= 20 && isWhole(v * 10);
  // labels on whole numbers, spaced at least 22px apart
  const every = Math.max(1, Math.ceil(22 / (unit * (den ? 1 : step))));
  const labelled = (v, i) => (den ? isWhole(v) : i % every === 0 || i === n);
  const tone = (t) => (t === 'good' ? 'good' : t === 'bad' ? 'bad' : 'brand');
  let order = 0;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={clsx('figure fg-numline', fig.anim && 'fg-anim')} role="img" aria-label={figWords(fig)}>
      <line x1={PAD - 12} y1={LINE} x2={W - PAD + 12} y2={LINE} className="fg-nl-axis" />
      <path d={`M ${W - PAD + 14} ${LINE} l -8 -5 v 10 z`} className="fg-nl-head" />
      {ticks.map((v, i) => {
        const whole = isWhole(v); const zero = Math.abs(v) < 1e-9;
        if (dense && !whole && !tenth(v)) return null;
        const h = whole ? 9 : tenth(v) ? 6 : 4;
        const anim = fig.anim && !whole ? { style: { '--i': order++ } } : {};
        return (
          <g key={v.toFixed(6)}>
            <line x1={X(v)} y1={LINE - h} x2={X(v)} y2={LINE + h} className={clsx('fg-nl-tick', zero && 'zero', !whole && 'part')} {...anim} />
            {labelled(v, i) && <text x={X(v)} y={LINE + 26} textAnchor="middle" className={clsx('fg-nl-num', zero && 'zero')}>{minus(Math.round(v * 1000) / 1000)}</text>}
          </g>
        );
      })}
      {jumps.map((j, i) => {
        const lift = liftOf(j);
        const mid = (X(j.from) + X(j.to)) / 2;
        return (
          <g key={`j${i}`} className="fg-nl-jumpg" style={fig.anim ? { '--i': order + i } : undefined}>
            <path d={`M ${X(j.from)} ${LINE - 6} Q ${mid} ${LINE - 6 - lift * 2} ${X(j.to)} ${LINE - 6}`} pathLength="1" className="fg-nl-jump" />
            <path d={`M ${X(j.to)} ${LINE - 6} l ${j.to > j.from ? -8 : 8} -6`} className="fg-nl-jump-head" />
            {j.label && <SvgLabel x={mid} y={LINE - 18 - lift} text={j.label} className="fg-nl-jump-label" size="sm" />}
          </g>
        );
      })}
      {marks.map((k, i) => (
        <g key={`m${i}`} className={clsx('fg-nl-mark', `tone-${tone(k.tone)}`)}>
          <circle cx={X(k.x)} cy={LINE} r="6" />
          {k.label && <SvgLabel x={X(k.x)} y={LINE - 24} text={k.label} className="fg-nl-mark-label" size="sm" />}
        </g>
      ))}
    </svg>
  );
}

/** The fraction bar, still: one bar or rows of bars of one length, with their marks, hatching and crossed parts. */
function FBar({ fig }) {
  const rows = fig.rows?.length ? fig.rows : [{ den: fig.den, shaded: fig.shaded, label: fig.label }];
  const pid = `fgbar-${useId().replace(/[^\w-]/g, '')}`;
  const labelOf = (r) => r.label ?? (fig.labels ? `\\frac{${r.shaded}}{${r.den}}` : null);
  const side = rows.some((r) => labelOf(r) != null);
  const W = 360; const x0 = 20; const x1 = side ? 282 : 340;
  const marks = fig.marks || [];
  const y0 = marks.length ? 52 : 10; const h = rows.length > 1 ? 40 : 52; const gap = 14;
  const H = y0 + rows.length * h + (rows.length - 1) * gap + (fig.whole != null ? 34 : 10);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="figure fg-obj fg-fbar" role="img" aria-label={figWords(fig)}>
      <HatchDef id={pid} />
      {rows.map((r, i) => {
        const y = y0 + i * (h + gap); const lab = labelOf(r);
        return (
          <g key={i}>
            <BarArt den={r.den} shaded={r.shaded} x0={x0} x1={x1} y={y} h={h} hatch={i === 0 ? fig.hatch || 0 : 0} cross={i === 0 ? fig.cross || 0 : 0} patternId={pid} />
            {lab != null && <SvgLabel x={(x1 + W) / 2} y={y + h / 2} text={lab} className="fg-fbar-label" />}
          </g>
        );
      })}
      {marks.length > 0 && <MarksArt marks={marks} x0={x0} x1={x1} y={y0} />}
      {fig.whole != null && <WholeArt whole={fig.whole} x0={x0} x1={x1} y={H - 10} />}
    </svg>
  );
}

/** A rectangle cut into rows and columns: shadeCols columns one way, shadeRows rows the other, the overlap darkest. */
function FGrid({ fig }) {
  const { rows, cols, shadeRows = 0, shadeCols = 0 } = fig;
  const c = Math.min(260 / cols, 150 / rows); const w = cols * c; const h = rows * c;
  const W = 300; const x0 = (W - w) / 2; const y0 = 12; const H = y0 + h + (fig.label ? 50 : 14);
  const cells = [];
  for (let r = 0; r < rows; r += 1) for (let k = 0; k < cols; k += 1) {
    const inCol = k < shadeCols; const inRow = r < shadeRows;
    cells.push(<rect key={`${r}-${k}`} x={x0 + k * c} y={y0 + r * c} width={c} height={c} className={clsx('fg-grid-cell', inCol && 'col', inRow && 'row', inCol && inRow && 'both')} />);
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="figure fg-obj fg-fgrid" role="img" aria-label={figWords(fig)}>
      {cells}
      <rect x={x0} y={y0} width={w} height={h} className="fg-grid-edge" />
      {fig.label && <SvgLabel x={W / 2} y={y0 + h + 26} text={fig.label} className="fg-grid-label" />}
    </svg>
  );
}

/** The double number line, still: the marker at `at` and the values the figure shows there. */
function DLine({ fig }) {
  const show = fig.show || 'both';
  const m = { top: fig.top, bottom: fig.bottom, move: 't' };
  const under = fig.at == null ? null : dlineAt(m, fig.at).under;
  const pills = {
    top: fig.at != null && show !== 'bottom' ? withUnit(fig.at, fig.top.unit) : null,
    bottom: fig.at == null ? null : fig.label != null ? String(fig.label) : show !== 'top' ? withUnit(under, fig.bottom.unit) : null,
  };
  return (
    <svg viewBox={DLINE_VIEW} className="figure fg-obj fg-dline" role="img" aria-label={figWords(fig)}>
      <DlineArt top={fig.top} bottom={fig.bottom} at={fig.at ?? null} pills={pills} hideBottom={fig.blank ? 'zero' : false} />
    </svg>
  );
}

/** Things counted in rows: dots in fives, a Hebrew label at the start (the right) of each row. */
function Groups({ fig }) {
  const W = 340; const lab = 92; const R = 7; const S = 19; const G = 9; const PER = 10; const LH = 28;
  const lines = fig.rows.map((r) => Math.max(1, Math.ceil(r.n / PER)));
  const H = 14 + lines.reduce((a, b) => a + b, 0) * LH + (fig.rows.length - 1) * 10;
  let y = 14 + LH / 2;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="figure fg-obj fg-groups" role="img" aria-label={figWords(fig)}>
      {fig.rows.map((r, i) => {
        const y1 = y; const dots = [];
        for (let k = 0; k < r.n; k += 1) {
          const line = Math.floor(k / PER); const j = k % PER;
          // right to left from the label, a small gap after every five
          const x = W - lab - 12 - R - j * S - Math.floor(j / 5) * G;
          dots.push(<circle key={k} cx={x} cy={y1 + line * LH} r={R} className={`fg-dot tone-${i % 4}`} />);
        }
        y += lines[i] * LH + 10;
        return (
          <g key={i}>
            <text x={W - 6} y={y1 + 5} textAnchor="end" className="fg-word">{r.label}</text>
            {dots}
          </g>
        );
      })}
    </svg>
  );
}

export default function Figure({ fig }) {
  if (!fig) return null;
  const C = { coord: Coord, linear: Linear, cross: Cross, parallel: Parallel, triangle: Triangle, right: RightTri, ladder: Ladder, table: Table, geo: Geo, scale: Scale, area: Area, ray: RayFig, tiles: TilesFig, numline: NumLine, fbar: FBar, fgrid: FGrid, dline: DLine, groups: Groups }[fig.type];
  return C ? <div className="figure-wrap"><C fig={fig} /></div> : null;
}
