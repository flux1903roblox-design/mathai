// Textbook figures drawn from the generators' data: coordinate plane, angles,
// triangles and a frequency table. Drawn on the same 4px grid as the page.
// Algebra's figures are still pictures of its interactive objects, drawn by the same code:
//   scale  { left: { x, n }, right: { x, n }, tilt? }  boxes x and weights on each pan; tilt −1 the left pan is down,
//                                                       1 the right one, 0 or none level (a one-sided change, shown)
//   area   { a, b, areas? }                             a rectangle a high and x + b long; areas: write each part's area
//   ray    { at, dir, closed, min?, max?, v? }          an inequality's solutions on the number line (v: its letter, x)
//   tiles  { px, nx, p1, n1 }                           algebra tiles: x, −x, 1 and −1
// The teaching figures (STUDENT-8), so every teaching step can draw what its text names (learn/types.ts has their shapes):
//   numline { from, to, step?, marks?: [{ x, label?, tone? }], jumps?: [{ from, to, label? }], anim? }
//          a number line: points, and moves as arcs; a point labelled with its own number lights that number up
//          (a numline with den is the fraction lane's: PartsLine, below)
//   thermo  { value, min, max, label?, also?: { value, label }, anim? }   a thermometer at value, its scale from min to max;
//          also: a second one on the same scale to its left (two days, two cities), each named under it
//   machine { inX?, rule, outY?, anim? }                 a function machine: inX goes in, rule (TeX) inside, outY comes out
//                                                       (x and y when not given; '?' when the step asks for it)
//   dots    { values, axis: [min, max], mark?: { mode?, median?, mean? }, unit?, anim? }   a dot plot: equal values stack;
//          the mode's column or the middle dot(s) are marked, the mean is a fulcrum under the axis (a balance point);
//          unit: a short line written over it, as on a bar chart (what is counted, or "n = 7")
//   bars    { labels, values, highlight?, unit?, level?, ltr?, anim? }   a bar chart, the first bar on the right, each value
//          over its bar; ltr: the first bar on the left, in the order of a list written in maths and of the bars object; a
//          value null is a missing one (its place and a question mark); level: a dashed line at that height (the mean, the
//          fair share), its number at its left end; a label may be '' (columns with no names, as in the bars object)
//   table   also { anim?, ltr? }                         with anim, its rows come in one after another; ltr: its columns run
//          left to right, for a table whose columns are the terms of an equation (x, y, the right side), as it is written
//   coord   also { quadrants?, path?, lines?: [{ m, b, label?, tone? }], meet?, riseRun?: { x, run }, words?, anim? }
//          (see Coord). Never draw a function's graph with 'linear': that one is a linear pair of angles.
// With anim, a figure draws itself once as its step comes in (useDraw); under reduced motion it is there at once.
// Fractions, percent and ratio (curriculum stage 1):
//   numline { from, to, den, marks?: [{ x, label?, tone? }], jumps?: [{ from, to, label? }], step?, anim? }
//          a number line cut into parts: small ticks every 1/den and labels on whole numbers only ("A at k" is a mark at
//          k/den); its labels may be TeX (\frac{3}{4}); anim draws the parts in, one after another (PartsLine)
//   fbar   { den, shaded, marks?, whole?, labels?, hatch?, cross?, rows?: [{ den, shaded, label? }] }   the fraction bar;
//          rows stack bars of one length, hatch hatches the first shaded parts (a part of a part), cross crosses out the
//          last ones (taken away), labels writes each bar's fraction beside it, whole names the whole bar (0 … whole)
//   fgrid  { rows, cols, shadeRows, shadeCols, label? }   a rectangle cut both ways: columns shaded one way, rows the
//          other, the overlap darkest (3/4 of 1/2 as an area)
//   dline  { top, bottom, at?, show?: 'both' | 'top' | 'bottom', label? }   the double number line, its marker at `at`
//          on the top line; show which values are written at the marker; label writes one value under it ('1400', '?');
//          blank writes no number on the bottom line but 0 (the whole is what the picture asks)
//   groups { rows: [{ n, label }] }                     dots in fives, a Hebrew label at the start of each row
// Functions and motion (stage 5, FUNC-1):
//   sgraph { x: Axis, y: Axis, series: [{ pts: [x, y][], dots?, smooth?, dashed?, label?, tone? }], marks?: [{ x, y, label }],
//          bands?: [{ from, to, tone? }], guide?: { x?, y? }, riseRun?: { from, to }, meet?, dirArrow?, anim? }
//          Axis = { min?, max, step, label, unit, every? }: a situation graph on two named, scaled axes (graphAxes.jsx, the
//          frame the graph object draws on too). A series is a polyline through its points, or its points alone (dots), or
//          a Catmull-Rom curve through them (smooth, never overshooting a point); the second series is orange, and named
//          series are named in a row above the graph, each after a piece of its line (graphAxes.jsx GraphLegend). marks are
//          lettered points; bands shade intervals of the x axis (the Ministry's "סמנו במרקר"); guide draws dashed lines
//          from x to the first series and across to the y axis, and from y across to it (each time it is there) and down;
//          riseRun the change in x and in y between two x values of the first series, with their numbers; meet a dot where
//          the first two series cross; dirArrow an arrow under the x axis, "משמאל לימין".
//   protractor { arms: [θ1, θ2], base?, letters?: { vertex, a, b } }   a protractor laid on an angle (manip/protractor.jsx,
//          the same drawing as the angle object's protractor): θ is an arm's direction counterclockwise from the right end
//          of the baseline, which is its reading on the scale that starts on the right; base turns the whole drawing
//          (multiples of 15), the numbers upright; letters name the vertex and the arms (θ1 is a, θ2 is b)
//   clock  { h, m, marks? }   a clock at h:m, its hands at their true angles (the hour hand at 30h + m/2, the minute
//          hand at 6m, from 12, clockwise); marks adds the 60 minute ticks
import { useEffect, useId, useRef, useState } from 'react';
import clsx from 'clsx';
import { m, useReducedMotion } from 'motion/react';
import { DUR, EASE } from '@/lib/motion.js';
import { ScaleArt, scaleView, scaleTop } from './manip/Balance.jsx';
import { AreaArt, areaView } from './manip/AreaModel.jsx';
import { RayArt, RAY_VIEW } from './manip/Ray.jsx';
import { TilesArt, TILES_VIEW } from './manip/Tiles.jsx';
import { BarArt, MarksArt, WholeArt, HatchDef } from './manip/FracBar.jsx';
import { DlineArt, DLINE_VIEW } from './manip/DoubleLine.jsx';
import { SvgLabel, minus } from './manip/core.jsx';
import { GraphAxes, GraphLegend, graphFrame, GRAPH_FONT, LEGEND_ROW } from './manip/graphAxes.jsx';
import { PROT, protractorLabels, protExtent, polar, useDrawnWidth, ProtractorArt } from './manip/protractor.jsx';
import { panWords, tilesWords, rayText, areaTex, withUnit, dlineAt, figWords, figNum, ruleText, linesMeet, machineIO, seriesAt, seriesCrossings, seriesMeet, sgraphRiseRun, clockHands } from '@/content/manip.js';
import '@/styles/lazy/figure.css'; // this screen's own rules, loaded with it (STUDENT-15)
const rad = (d) => (d * Math.PI) / 180;
const MATH_FONT = "KaTeX_Main, 'Times New Roman', serif";

// ---------------------------------------------------------------- drawing in, once (STUDENT-8)
// With anim, each part of a figure is drawn in turn: a path from nothing to its full length in DUR.medium, the next one
// DUR.stagger × 4 later; what sits at a path's end (its head, its label) appears when the path is there, and a dot fades
// in at its turn. It starts after the step's own slide-in and plays once, as the step comes in (a step is a new element
// each time). Under reduced motion, or without anim, the figure is there at once. A dashed line only fades: drawing its
// length would replace its dashes.
// The parts start hidden and are told to show once the figure is on the page (an effect), not through `initial`: the
// first step of a lesson sits in an AnimatePresence with initial={false}, which would skip every entrance inside it.
const LEAD = 0.2; const STEP = DUR.stagger * 4;
function useDraw(on) {
  const still = useReducedMotion() || !on;
  const [go, setGo] = useState(false);
  useEffect(() => { if (!still) setGo(true); }, [still]);
  return (k, kind = 'path') => {
    if (still) return {};
    const delay = LEAD + k * STEP + (kind === 'end' ? DUR.medium : 0);
    const path = kind === 'path';
    const hidden = path ? { pathLength: 0, opacity: 0 } : { opacity: 0 };
    if (!go) return { initial: hidden, animate: hidden };
    return path
      ? { initial: hidden, animate: { pathLength: 1, opacity: 1 }, transition: { delay, duration: DUR.medium, ease: EASE.out, opacity: { delay, duration: 0.01 } } }
      : { initial: hidden, animate: { opacity: 1 }, transition: { delay, duration: DUR.quick } };
  };
}
const toneOf = (t) => `tone-${t === 'good' || t === 'bad' || t === 'alt' ? t : 'brand'}`;
/** An arrow's head at (x, y), pointing along the angle th (radians, screen axes). */
const head = (x, y, th, n = 9) => `M ${x - n * Math.cos(th + 0.5)} ${y - n * Math.sin(th + 0.5)} L ${x} ${y} L ${x - n * Math.cos(th - 0.5)} ${y - n * Math.sin(th - 0.5)}`;
/** Text with its single letters in the maths font (2x + 1, x and y on a machine). */
const withVars = (t) => String(t).split(/([a-zA-Z])/).map((p, i) => (i % 2 ? <tspan key={i} className="fig-var">{p}</tspan> : p));

// The coordinate plane: points, a polygon, segments and one line { m, b } (the generators' figures), and for teaching
// (STUDENT-8): quadrants (רביע 1…4), path (a walk from the origin, one arrow a leg), lines (more than one line, each with
// an optional label and tone), meet (a dot and the coordinates where lines[0] and lines[1] cross) and riseRun { x, run }
// (on the first line: a dashed run of `run` from x, then the rise, each with its number), and words: [{ at: [x, y], text,
// tone? }] (a side's letter, a shape's name, or a line's equation in its line's colour), written centred at that place.
function Coord({ fig }) {
  const r = fig.range || 6; const c = 22; const pad = 26;
  const size = 2 * r * c + 2 * pad; const o = size / 2;
  const X = (x) => o + x * c; const Y = (y) => o - y * c;
  const ticks = []; for (let i = -r; i <= r; i++) ticks.push(i);
  const label = (n) => (n < 0 ? `−${-n}` : `${n}`);
  const draw = useDraw(fig.anim);
  // its own clip id: an exam page holds several planes (and a printed copy of each), and an id must be unique
  const clip = `plane-${useId().replace(/[^\w-]/g, '')}`;
  const ends = (l) => { const x1 = -r - 0.5; const x2 = r + 0.5; return [X(x1), Y(l.m * x1 + l.b), X(x2), Y(l.m * x2 + l.b)]; };
  let lineEl = null;
  if (fig.line) {
    const [x1, y1, x2, y2] = ends(fig.line);
    lineEl = <line x1={x1} y1={y1} x2={x2} y2={y2} className="fg-line" />;
  }
  const lines = fig.lines || [];
  // a line's label sits near where it leaves the plane on the right (or at the top or bottom, when it is steep)
  const tagAt = (l) => { const e = r - 0.7; let x = e; let y = l.m * x + l.b; if (Math.abs(y) > e && l.m) { y = Math.sign(y) * e; x = (y - l.b) / l.m; } return [X(x) - 6, Y(y) + (l.m > 0 ? -10 : 22)]; };
  const meet = fig.meet && lines.length > 1 ? linesMeet(lines[0], lines[1]) : null;
  const first = fig.line || lines[0];
  const rr = fig.riseRun && first ? (() => { const { x, run } = fig.riseRun; const y0 = first.m * x + first.b; return { x, x1: x + run, y0, y1: first.m * (x + run) + first.b, run }; })() : null;
  const walk = fig.path?.length ? (fig.path[0][0] === 0 && fig.path[0][1] === 0 ? fig.path : [[0, 0], ...fig.path]) : [];
  const visible = (fig.points || []).filter((p) => !p.hidden);
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="figure coord" role="img" aria-label={figWords(fig)}>
      <defs>
        <clipPath id={clip}><rect x={X(-r - 0.5)} y={Y(r + 0.5)} width={(2 * r + 1) * c} height={(2 * r + 1) * c} /></clipPath>
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
      {/* each quadrant's name in its outer corner, clear of the axes' numbers and of most points */}
      {fig.quadrants && [[1, 1, 1], [2, -1, 1], [3, -1, -1], [4, 1, -1]].map(([q, sx, sy]) => (
        <text key={`q${q}`} x={X(sx * (r - 1.3))} y={Y(sy * (r - 0.45)) + 6} textAnchor="middle" direction="rtl" className="fig-cd-quad">{`רביע ${q}`}</text>
      ))}
      <g clipPath={`url(#${clip})`}>
        {fig.polygon && <polygon points={fig.polygon.map(([x, y]) => `${X(x)},${Y(y)}`).join(' ')} className="fg-poly" />}
        {lineEl}
        {lines.map((l, i) => { const [x1, y1, x2, y2] = ends(l); return <m.path key={`l${i}`} d={`M ${x1} ${y1} L ${x2} ${y2}`} className={clsx('fig-cd-line', toneOf(l.tone || (i ? 'alt' : 'brand')))} {...draw(i)} />; })}
        {fig.helper && <polyline points={fig.helper.map(([x, y]) => `${X(x)},${Y(y)}`).join(' ')} className="fg-helper" />}
        {(fig.segments || []).map(([[x1, y1], [x2, y2]], i) => <m.path key={i} d={`M ${X(x1)} ${Y(y1)} L ${X(x2)} ${Y(y2)}`} className="fg-seg" {...draw(lines.length + Math.max(0, walk.length - 1) + i)} />)}
      </g>
      {lines.map((l, i) => l.label && (
        <m.text key={`lt${i}`} x={tagAt(l)[0]} y={tagAt(l)[1]} textAnchor="end" className={clsx('fig-cd-tag', toneOf(l.tone || (i ? 'alt' : 'brand')))} style={{ fontFamily: MATH_FONT }} {...draw(i, 'end')}>{l.label}</m.text>
      ))}
      {rr && (
        <g className="fig-cd-rr">
          <m.path d={`M ${X(rr.x)} ${Y(rr.y0)} H ${X(rr.x1)}`} {...draw(lines.length, 'fade')} />
          <m.path d={`M ${X(rr.x1)} ${Y(rr.y0)} V ${Y(rr.y1)}`} {...draw(lines.length + 1, 'fade')} />
          <m.text x={(X(rr.x) + X(rr.x1)) / 2} y={Y(rr.y0) + (rr.y1 > rr.y0 ? 22 : -10)} textAnchor="middle" className="fig-cd-rr-num" {...draw(lines.length, 'fade')}>{figNum(rr.run)}</m.text>
          <m.text x={X(rr.x1) + (rr.run > 0 ? 9 : -9)} y={(Y(rr.y0) + Y(rr.y1)) / 2 + 6} textAnchor={rr.run > 0 ? 'start' : 'end'} className="fig-cd-rr-num" {...draw(lines.length + 1, 'fade')}>{figNum(rr.y1 - rr.y0)}</m.text>
        </g>
      )}
      {walk.slice(1).map(([x, y], i) => {
        const a = [X(walk[i][0]), Y(walk[i][1])]; const b = [X(x), Y(y)]; const k = lines.length + i;
        return (
          <g key={`w${i}`} className="fig-cd-walk">
            <m.path d={`M ${a[0]} ${a[1]} L ${b[0]} ${b[1]}`} {...draw(k)} />
            <m.path d={head(b[0], b[1], Math.atan2(b[1] - a[1], b[0] - a[0]), 10)} {...draw(k, 'end')} />
          </g>
        );
      })}
      {(fig.words || []).map((w, i) => (
        <text key={`wd${i}`} x={X(w.at[0])} y={Y(w.at[1]) + 6} textAnchor="middle" direction={WORD.test(w.text) ? 'rtl' : undefined}
          className={w.tone ? clsx('fig-cd-tag', toneOf(w.tone)) : clsx('fig-cd-word', /^[a-z]$/.test(w.text) && 'fig-var')} style={w.tone ? { fontFamily: MATH_FONT } : undefined}>{w.text}</text>
      ))}
      {visible.map((p) => {
        // the letter sits on the side away from both axes, so it never lands on their numbers; a long name, like
        // (7, 0), near the edge goes to the other side so it stays on the drawing
        const w = String(p.label).length * 10; const out = X(p.x) + 9 + w > size; const back = X(p.x) - 9 - w < 0;
        const right = p.x >= 0 ? !out || back : back && !out;
        return (
          <g key={p.label}>
            <circle cx={X(p.x)} cy={Y(p.y)} r="5" className="fg-pt" />
            <text x={X(p.x) + (right ? 9 : -9)} y={p.y >= 0 ? Y(p.y) - 9 : Y(p.y) + 21} textAnchor={right ? 'start' : 'end'} className="fg-pt-label" style={{ fontFamily: MATH_FONT }}>{p.label}</text>
          </g>
        );
      })}
      {meet && (
        <m.g className="fig-cd-meet" {...draw(lines.length, 'end')}>
          <circle cx={X(meet[0])} cy={Y(meet[1])} r="6" />
          <text x={X(meet[0]) + 10} y={Y(meet[1]) + 24} className="fig-cd-meet-num">{`(${figNum(meet[0])}, ${figNum(meet[1])})`}</text>
        </m.g>
      )}
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

// Numbers stay left-to-right inside the RTL table, with a real minus sign; so does a heading that is maths (9 − x, which
// the right-to-left table would turn into x − 9). A cell with Hebrew in it reads right to left ("פי 2", "עוד 20%").
// A letter in maths is in the maths font, as in the text.
const cell = (v) => String(v).replace(/^-/, '\u2212');
const vars = (t) => String(t).split(/([a-zA-Z])/).map((p, i) => (i % 2 ? <span key={i} className="fig-var">{p}</span> : p));

function Table({ fig }) {
  const draw = useDraw(fig.anim);
  return (
    <table className={clsx('fg-table', fig.head.length >= 4 && 'cols4')} dir={fig.ltr ? 'ltr' : undefined}>
      <thead><tr>{fig.head.map((h, j) => <th key={j} scope="col">{WORD.test(h) ? vars(h) : <bdi dir="ltr">{vars(h)}</bdi>}</th>)}</tr></thead>
      <tbody>{fig.rows.map((r, i) => <m.tr key={i} {...draw(i, 'fade')}>{r.map((v, j) => <td key={j}>{WORD.test(String(v)) ? <bdi dir="rtl">{v}</bdi> : <bdi dir="ltr">{vars(cell(v))}</bdi>}</td>)}</m.tr>)}</tbody>
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
    <svg viewBox={RAY_VIEW} className="figure fg-obj fg-ray" role="img" aria-label={`ציר מספרים: ${rayText(fig, fig.v || 'x')}`}>
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

// ---------------------------------------------------------------- the teaching figures (STUDENT-8)
const whole = (v) => Math.abs(v - Math.round(v)) < 1e-9;

/** A number line: ticks every step (or every 1/den), points, and moves as arcs over the line. */
function NumLine({ fig }) {
  const { from, to, den } = fig; const step = fig.step || 1;
  const marks = fig.marks || []; const jumps = fig.jumps || [];
  const draw = useDraw(fig.anim);
  const W = 320; const PAD = 22; const u = (W - 2 * PAD) / (to - from);
  const X = (v) => PAD + (v - from) * u;
  const num = (v) => figNum(Math.round(v * 1000) / 1000);
  // a point labelled with its own number lights that number up instead of writing it twice
  const lit = new Map(marks.filter((k) => k.label === num(k.x)).map((k) => [num(k.x), k]));
  const named = marks.filter((k) => k.label && !lit.has(num(k.x)));
  // an arc rises with its length; one that goes back over an earlier arc (10 − 4 + 3) rises above it, so the two arcs
  // and their labels never cross; with arcs over the line, the points' letters go under the numbers
  const span = (j) => [Math.min(j.from, j.to), Math.max(j.from, j.to)];
  const lifts = []; const arch = [];
  jumps.forEach((j, i) => {
    const [lo, hi] = span(j); const own = Math.min(56, 14 + (hi - lo) * u * 0.28); let h = own;
    for (let k = 0; k < i; k += 1) { const [a, b] = span(jumps[k]); if (lo < b - 1e-9 && hi > a + 1e-9) h = Math.max(h, lifts[k] + 36); }
    lifts.push(h); arch.push(h > own); // a raised jump is an arch (straight up, across, straight down), not a spike
  });
  const under = jumps.length > 0;
  const L = under ? Math.max(...lifts) + 40 : named.length ? 46 : 22;
  const H = L + (under && named.length ? 62 : 38);
  const per = den || 1 / step; const n = Math.round((to - from) * per);
  // numbers on round values, as many as fit side by side (a minus sign and two digits need about 32px, with room for a
  // small phone that draws the line smaller); a lit number and where a jump starts and lands always show, and an
  // ordinary number too close to one of them gives way
  const wide = Math.max(num(from).length, num(to).length) * 8.5 + 6;
  const every = [1, 2, 5, 10, 20, 50, 100].find((e) => e * (u / per) >= wide) || 200;
  const ends = new Set(jumps.flatMap((j) => [num(j.from), num(j.to)]));
  const keepX = [...marks.filter((k) => lit.has(num(k.x))).map((k) => X(k.x)), ...jumps.flatMap((j) => [X(j.from), X(j.to)])];
  const shown = (v) => ends.has(num(v)) || (Math.abs(Math.round(v * per) % every) === 0 && keepX.every((x) => Math.abs(x - X(v)) < 1e-6 || Math.abs(x - X(v)) >= wide));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="figure fig-obj fig-numline" role="img" aria-label={figWords(fig)}>
      <line x1={PAD - 12} y1={L} x2={W - PAD + 12} y2={L} className="fig-nl-axis" />
      <path d={`M ${W - PAD + 15} ${L} l -9 -5.5 v 11 z`} className="fig-nl-head" />
      {Array.from({ length: n + 1 }, (_, i) => {
        const v = from + i / per; const w = !den || whole(v); const z = Math.abs(v) < 1e-9; const k = lit.get(num(v));
        if (!w && u / den < 3) return null; // parts too close to tell apart
        const t = w ? (z ? 9 : 6) : 4;
        return (
          <g key={i}>
            <line x1={X(v)} y1={L - t} x2={X(v)} y2={L + t} className={clsx('fig-nl-tick', z && 'zero', !w && 'part')} />
            {(k || (den ? w : shown(v))) && <text x={X(v)} y={L + 26} textAnchor="middle" className={clsx('fig-nl-num', z && 'zero', k && `on ${toneOf(k.tone)}`)}>{num(v)}</text>}
          </g>
        );
      })}
      {marks.map((k, i) => (
        <m.g key={`m${i}`} className={clsx('fig-nl-mark', toneOf(k.tone))} {...draw(i, 'fade')}>
          <circle cx={X(k.x)} cy={L} r="6.5" />
          {k.label && !lit.has(num(k.x)) && <text x={X(k.x)} y={under ? L + 52 : L - 17} textAnchor="middle" className={clsx('fig-nl-name', /^[A-Z]$/.test(k.label) && 'fig-var')}>{k.label}</text>}
        </m.g>
      ))}
      {jumps.map((j, i) => {
        const a = X(j.from); const b = X(j.to); const h = lifts[i]; const y = L - 7; const mid = (a + b) / 2; const k = marks.length + i;
        return (
          <g key={`j${i}`} className="fig-nl-jump">
            <m.path d={arch[i] ? `M ${a} ${y} C ${a} ${y - (4 / 3) * h} ${b} ${y - (4 / 3) * h} ${b} ${y}` : `M ${a} ${y} Q ${mid} ${y - 2 * h} ${b} ${y}`} {...draw(k)} />
            <m.path d={head(b, y, arch[i] ? Math.PI / 2 : Math.atan2(2 * h, b - mid))} {...draw(k, 'end')} />
            {j.label && <m.text x={mid} y={y - h - 9} textAnchor="middle" className="fig-nl-move" {...draw(k, 'end')}>{String(j.label).replace(/^-/, '−')}</m.text>}
          </g>
        );
      })}
    </svg>
  );
}

/** A thermometer: the scale from min to max, the red column up to value, and the reading beside it. With `also`, a second
 * thermometer on the same scale stands to its left (the first one on the right, as a Hebrew reader starts), each named
 * under it. With anim, the column rises from the bulb to the reading, once. */
function Thermo({ fig }) {
  const { min, max } = fig;
  const draw = useDraw(fig.anim);
  const two = fig.also != null;
  // two side by side are drawn shorter, so on a phone their numbers stay as large as one thermometer's
  const T = two ? 26 : 30; const B = two ? 148 : 212; const BC = B + 38; const Y = (v) => B - ((v - min) / (max - min)) * (B - T);
  // numbers every k degrees (at most 8 of them), a small tick for each degree between (or every k/5)
  const k = [1, 2, 5, 10, 20].find((s) => (max - min) / s <= 8) || 50;
  const sub = k >= 5 ? k / 5 : 1;
  const ticks = []; for (let v = Math.ceil(min / sub) * sub; v <= max + 1e-9; v += sub) ticks.push(Math.round(v * 1e6) / 1e6);
  // each thermometer spans 85 units left of its glass's middle (the reading) and 67 right of it (the scale's numbers)
  const one = [{ value: fig.value, label: fig.label, cx: two ? 267 : 120 }, ...(two ? [{ ...fig.also, cx: 97 }] : [])];
  const W = two ? 344 : 240; const capY = BC + 44;
  return (
    <svg viewBox={`0 0 ${W} ${one.some((t) => t.label) ? capY + 6 : BC + 30}`} className={clsx('figure fig-obj fig-thermo', two && 'two')} role="img" aria-label={figWords(fig)}>
      {one.map(({ value, label, cx }, i) => {
        const y = Y(value);
        return (
          <g key={i}>
            <path d={`M ${cx - 14} ${T - 12} a 14 14 0 0 1 28 0 V ${BC - 17} A 22 22 0 1 1 ${cx - 14} ${BC - 17} Z`} className="fig-th-glass" />
            <circle cx={cx} cy={BC} r="15" className="fig-th-fill" />
            <m.path d={`M ${cx} ${BC} V ${y}`} className="fig-th-col" {...draw(i)} />
            {ticks.map((v) => {
              const big = Math.abs(v / k - Math.round(v / k)) < 1e-9;
              return (
                <g key={v}>
                  <line x1={cx + 14} x2={cx + (v === 0 ? 32 : big ? 26 : 20)} y1={Y(v)} y2={Y(v)} className={clsx('fig-th-tick', v === 0 && 'zero', !big && 'sub')} />
                  {big && <text x={cx + 37} y={Y(v) + 5} className={clsx('fig-th-num', v === 0 && 'zero')}>{figNum(v)}</text>}
                </g>
              );
            })}
            <m.g {...draw(i, 'end')}>
              <line x1={cx - 36} x2={cx - 9} y1={y} y2={y} className="fig-th-pointer" />
              <text x={cx - 40} y={y + 7} textAnchor="end" className="fig-th-read">{`${figNum(value)}°`}</text>
            </m.g>
            {label && <text x={cx} y={capY} textAnchor="middle" direction="rtl" className="fg-word">{label}</text>}
          </g>
        );
      })}
    </svg>
  );
}

/** A function machine, top to bottom so it reads the same in Hebrew: what goes in, the rule, what comes out. */
function Machine({ fig }) {
  const draw = useDraw(fig.anim);
  const io = [machineIO(fig.inX, 'x'), machineIO(fig.outY, 'y')];
  const pill = (t, y, cls) => {
    const w = Math.max(60, t.length * 14 + 30);
    return (
      <g className={cls}>
        <rect x={150 - w / 2} y={y - 22} width={w} height="44" rx="22" />
        <text x="150" y={y + 8} textAnchor="middle">{withVars(t)}</text>
      </g>
    );
  };
  return (
    <svg viewBox="0 0 300 266" className="figure fig-obj fig-machine" role="img" aria-label={figWords(fig)}>
      {pill(io[0], 26, 'fig-mc-io')}
      <m.path d="M 150 52 V 84" className="fig-mc-arrow" {...draw(0)} />
      <m.path d={head(150, 85, Math.PI / 2)} className="fig-mc-arrow" {...draw(0, 'end')} />
      <rect x="36" y="92" width="228" height="82" rx="18" className="fig-mc-box" />
      <text x="150" y="142" textAnchor="middle" className="fig-mc-rule">{withVars(ruleText(fig.rule))}</text>
      <m.path d="M 150 182 V 212" className="fig-mc-arrow" {...draw(1)} />
      <m.path d={head(150, 213, Math.PI / 2)} className="fig-mc-arrow" {...draw(1, 'end')} />
      <m.g {...draw(1, 'end')}>{pill(io[1], 240, clsx('fig-mc-io', io[1] === '?' && 'target'))}</m.g>
    </svg>
  );
}

/** A dot plot: one dot a value, equal values stacked; the mode's column or the middle dot(s) marked, the mean a fulcrum. */
function Dots({ fig }) {
  const { values } = fig; const [lo, hi] = fig.axis; const k = fig.mark || {};
  const draw = useDraw(fig.anim);
  const W = 320; const PAD = 24; const u = (W - 2 * PAD) / (hi - lo); const X = (v) => PAD + (v - lo) * u;
  // a dot is as large as the smallest gap between two different values allows (two values 1 apart on a long axis stay apart)
  const distinct = [...new Set(values)].sort((a, b) => a - b);
  const gap = Math.min(hi - lo, ...distinct.slice(1).map((v, i) => v - distinct[i]));
  const r = Math.max(4, Math.min(9, gap * u * 0.4)); const g = 2 * r + 3;
  const high = new Map(); const row = values.map((v) => { const n = high.get(v) || 0; high.set(v, n + 1); return n; });
  const L = (fig.unit ? 30 : 0) + 14 + Math.max(1, ...high.values()) * g;
  // the median's dot(s): the middle of the values in order (equal values in the order given, as they stack)
  const order = values.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map((p) => p[1]);
  const n = values.length;
  const mids = k.median == null || !n ? [] : n % 2 ? [order[(n - 1) / 2]] : [order[n / 2 - 1], order[n / 2]];
  const lit = (i) => (k.mode != null && values[i] === k.mode) || mids.includes(i);
  const every = [1, 2, 5, 10, 20, 50].find((s) => s * u >= 22) || 100;
  const ticks = []; for (let v = Math.ceil(lo); v <= hi; v += 1) ticks.push(v);
  const numY = L + (k.mean != null ? 38 : 24);
  return (
    <svg viewBox={`0 0 ${W} ${numY + 10}`} className="figure fig-obj fig-dots" role="img" aria-label={figWords(fig)}>
      {fig.unit && <text x={W / 2} y="18" textAnchor="middle" direction="rtl" className="fg-word">{fig.unit}</text>}
      <line x1={PAD - 12} y1={L} x2={W - PAD + 12} y2={L} className="fig-nl-axis" />
      {ticks.map((v) => (
        <g key={v}>
          {u >= 6 || v % every === 0 ? <line x1={X(v)} y1={L} x2={X(v)} y2={L + 6} className="fig-nl-tick" /> : null}
          {v % every === 0 && <text x={X(v)} y={numY} textAnchor="middle" className="fig-nl-num">{figNum(v)}</text>}
        </g>
      ))}
      {k.mean != null && <path d={`M ${X(k.mean)} ${L + 2} l -9 16 h 18 z`} className="fig-dt-fulcrum" />}
      {values.map((v, i) => (
        <m.circle key={i} cx={X(v)} cy={L - 3 - r - row[i] * g} r={r} className={clsx('fig-dt-dot', lit(i) && 'hi')} {...draw(i * Math.min(1, 12 / n), 'fade')} />
      ))}
    </svg>
  );
}

/** A bar chart: the first bar on the right, as a Hebrew reader starts (on the left with ltr, as a list in maths and the bars
 * object run); each value over its bar, its name under it. A missing
 * value (null) keeps its place, with a question mark on a dashed outline; `level` is a dashed line across at that height. */
function Bars({ fig }) {
  const { labels, values, level } = fig; const n = values.length;
  const draw = useDraw(fig.anim);
  const W = 320; const PAD = 14; const B = 188; const top = fig.unit ? 46 : 30; const max = Math.max(1, level ?? 0, ...values.filter((v) => v != null));
  // with a level, its number stands on the left, outside the bars
  const x0 = PAD + (level != null ? 30 : 0);
  const slot = (W - PAD - x0) / n; const bw = Math.min(56, slot * 0.62);
  const cx = (i) => (fig.ltr ? x0 + slot * (i + 0.5) : W - PAD - slot * (i + 0.5));
  const size = Math.min(15, (slot - 4) / (0.56 * Math.max(1, ...labels.map((l) => l.length))));
  const Y = (v) => B - (v / max) * (B - top);
  const gone = Math.min(56, (B - top) * 0.45); // the height of a missing value's outline: clearly not a reading
  return (
    <svg viewBox={`0 0 ${W} 220`} className="figure fig-obj fig-bars" role="img" aria-label={figWords(fig)}>
      {fig.unit && <text x={W / 2} y="18" textAnchor="middle" direction="rtl" className="fg-word">{fig.unit}</text>}
      {values.map((v, i) => (
        <m.g key={i} className={clsx('fig-bar', fig.highlight === i && 'hi', v == null && 'gone')} {...draw(i, 'fade')}>
          {v == null ? (
            <>
              <rect x={cx(i) - bw / 2} y={B - gone} width={bw} height={gone} rx="4" />
              <text x={cx(i)} y={B - gone / 2 + 8} textAnchor="middle" className="fig-bar-num">?</text>
            </>
          ) : (
            <>
              <rect x={cx(i) - bw / 2} y={Y(v)} width={bw} height={B - Y(v)} rx="4" />
              <text x={cx(i)} y={Y(v) - 8} textAnchor="middle" className="fig-bar-num">{figNum(v)}</text>
            </>
          )}
          {labels[i] && <text x={cx(i)} y={B + 22} textAnchor="middle" direction="rtl" className="fig-bar-name" style={{ fontSize: `${size}px` }}>{labels[i]}</text>}
        </m.g>
      ))}
      <line x1={x0} x2={W - PAD} y1={B} y2={B} className="fig-bar-base" />
      {level != null && (
        <m.g className="fig-bar-level" {...draw(n, 'fade')}>
          <line x1={x0 - 4} x2={W - PAD} y1={Y(level)} y2={Y(level)} />
          <text x={x0 - 9} y={Y(level) + 6} textAnchor="end" className="fig-bar-level-num">{figNum(level)}</text>
        </m.g>
      )}
    </svg>
  );
}

// ---------------------------------------------------------------- fractions, percent and ratio
const isWhole = (v) => Math.abs(v - Math.round(v)) < 1e-9;

/**
 * A number line cut into parts (den), as a still picture: points named by letters or TeX, jumps as arcs with TeX labels,
 * the parts of every unit (and tenths on a line in hundredths). The fraction lane's number line; a numline with no den is
 * the teaching figure NumLine above (STUDENT-8).
 */
function PartsLine({ fig }) {
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

// ---------------------------------------------------------------- functions and motion (FUNC-1)
/**
 * A Catmull-Rom curve through points (drawing units), as cubic Béziers. Each piece's two control points are kept
 * between its ends' heights, so the curve never rises above or dips below a point it passes through: a graph of a rate
 * that only grows is drawn only growing.
 */
export function smoothPath(P) {
  if (P.length < 3) return `M ${P.map((p) => p.join(' ')).join(' L ')}`;
  const cl = (v, a, b) => Math.min(Math.max(v, Math.min(a, b)), Math.max(a, b));
  let d = `M ${P[0][0]} ${P[0][1]}`;
  for (let i = 0; i < P.length - 1; i += 1) {
    const p0 = P[i - 1] || P[i]; const p1 = P[i]; const p2 = P[i + 1]; const p3 = P[i + 2] || P[i + 1];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, cl(p1[1] + (p2[1] - p0[1]) / 6, p1[1], p2[1])];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, cl(p2[1] - (p3[1] - p1[1]) / 6, p1[1], p2[1])];
    d += ` C ${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${p2[0]} ${p2[1]}`;
  }
  return d;
}

const BAND_TONES = ['gold', 'brand', 'alt'];
/** A situation graph: axes with names and scales, its series, and what it marks on them (see the list at the top). */
function SGraph({ fig }) {
  const { x, y } = fig;
  const draw = useDraw(fig.anim);
  const series = fig.series || [];
  const toneOfSeries = (s, i) => (s.tone === 'alt' || (!s.tone && i > 0) ? 'alt' : 'brand');
  const named = series.map((s, i) => ({ label: s.label, tone: toneOfSeries(s, i), dashed: !!s.dashed })).filter((s) => s.label);
  const fr = graphFrame(x, y, { foot: fig.dirArrow ? 30 : 0, head: named.length ? LEGEND_ROW : 0 });
  const { X, Y, W, H, TOP, BOT, PADL, plotW } = fr;
  const first = series[0]?.pts || [];
  const at = (pts) => pts.map(([a, b]) => [X(a), Y(b)]);
  const g = fig.guide || {};
  const gx = g.x != null ? seriesAt(first, g.x) : null;
  const gys = g.y != null ? seriesCrossings(first, g.y) : [];
  const rr = sgraphRiseRun(fig);
  const meet = fig.meet && series.length > 1 ? seriesMeet(series[0].pts, series[1].pts) : null;
  const k0 = series.length; // the parts drawn after the series, in turn
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="figure fig-obj fig-sgraph" role="img" aria-label={figWords(fig)}>
      {(fig.bands || []).map((b, i) => (
        <m.g key={`b${i}`} className={`fig-sgraph-band tone-${b.tone || BAND_TONES[i % BAND_TONES.length]}`} {...draw(k0 + i, 'fade')}>
          <rect x={X(b.from)} y={TOP} width={X(b.to) - X(b.from)} height={BOT - TOP} />
          <line x1={X(b.from)} x2={X(b.to)} y1={BOT} y2={BOT} />
        </m.g>
      ))}
      <GraphAxes fr={fr} x={x} y={y} cls="fig-sgraph" />
      {named.length > 0 && <GraphLegend fr={fr} items={named} cls="fig-sgraph" />}
      {(gx != null || gys.length > 0) && (
        <m.g className="fig-sgraph-guide" {...draw(k0, 'fade')}>
          {gx != null && <path d={`M ${X(g.x)} ${BOT} V ${Y(gx)} H ${PADL}`} />}
          {gys.length > 0 && <path d={`M ${PADL} ${Y(g.y)} H ${X(Math.max(...gys))} ${gys.map((c) => `M ${X(c)} ${Y(g.y)} V ${BOT}`).join(' ')}`} />}
          {gx != null && <circle cx={X(g.x)} cy={Y(gx)} r="5" />}
          {gys.map((c) => <circle key={c} cx={X(c)} cy={Y(g.y)} r="5" />)}
        </m.g>
      )}
      {series.map((s, i) => {
        const P = at(s.pts); const tone = toneOfSeries(s, i);
        return (
          <g key={`s${i}`} className={clsx('fig-sgraph-series', `tone-${tone}`)}>
            {!s.dots && <m.path d={s.smooth ? smoothPath(P) : `M ${P.map((p) => p.join(' ')).join(' L ')}`} className={clsx('fig-sgraph-line', s.dashed && 'dashed')} {...draw(i, s.dashed ? 'fade' : 'path')} />}
            {s.dots && P.map(([px, py], j) => <m.circle key={j} cx={px} cy={py} r="5.5" className="fig-sgraph-dot" {...draw(i, 'fade')} />)}
          </g>
        );
      })}
      {rr && (
        <m.g className="fig-sgraph-rr" {...draw(k0 + 1, 'fade')}>
          <path d={`M ${X(rr.from)} ${Y(rr.y0)} H ${X(rr.to)}`} />
          <path d={`M ${X(rr.to)} ${Y(rr.y0)} V ${Y(rr.y1)}`} />
          <text x={(X(rr.from) + X(rr.to)) / 2} y={Y(rr.y0) + (rr.y1 > rr.y0 ? 21 : -9)} textAnchor="middle" fontSize={GRAPH_FONT.tag} className="fig-sgraph-rr-num">{figNum(rr.run)}</text>
          <text x={X(rr.to) + 8} y={(Y(rr.y0) + Y(rr.y1)) / 2 + 6} textAnchor="start" fontSize={GRAPH_FONT.tag} className="fig-sgraph-rr-num">{figNum(rr.rise)}</text>
        </m.g>
      )}
      {meet && <m.circle cx={X(meet[0])} cy={Y(meet[1])} r="7" className="fig-sgraph-meet" {...draw(k0 + 1, 'end')} />}
      {(fig.marks || []).map((k, i) => (
        <m.g key={`k${i}`} className="fig-sgraph-mark" {...draw(k0 + 1 + i, 'fade')}>
          <circle cx={X(k.x)} cy={Y(k.y)} r="6" />
          <text x={X(k.x) + (X(k.x) > W - 40 ? -10 : 10)} y={Y(k.y) - 9} textAnchor={X(k.x) > W - 40 ? 'end' : 'start'} fontSize={GRAPH_FONT.tag} className="fig-sgraph-mark-label" style={{ fontFamily: MATH_FONT }}>{k.label}</text>
        </m.g>
      ))}
      {fig.dirArrow && (
        <g className="fig-sgraph-dir">
          <text x={PADL + plotW / 2} y={BOT + 66} textAnchor="middle" direction="rtl" fontSize={GRAPH_FONT.name}>משמאל לימין</text>
          <path d={`M ${PADL} ${BOT + 76} H ${PADL + plotW}`} />
          <path d={head(PADL + plotW + 2, BOT + 76, 0, 9)} />
        </g>
      )}
    </svg>
  );
}

/**
 * A protractor laid on an angle: its centre on the vertex, the arms from the vertex to the rim, a small arc for the angle
 * measured, the letters; the numbers sized for the width it is shown at (protractorLabels).
 */
function ProtractorFigure({ fig }) {
  const ref = useRef(null);
  const drawn = useDrawnWidth(ref);
  const base = fig.base || 0; const L = fig.letters; const [a1, a2] = fig.arms;
  const labels = protractorLabels({ drawn, base, arms: fig.arms });
  const [top0, bottom0] = protExtent(base, labels);
  // the vertex's letter stands under the centre (turned with the drawing)
  const vy = 26 * Math.cos((base * Math.PI) / 180);
  const top = Math.min(top0, L ? vy - 10 : top0); const bottom = Math.max(bottom0, L ? vy + 10 : bottom0);
  const PAD = 8; const O = [PROT.W / 2, PAD - top]; const H = Math.ceil(bottom - top + 2 * PAD);
  const arm = (d) => { const [x, y] = polar(O, d + base, PROT.R); return <line x1={O[0]} y1={O[1]} x2={x} y2={y} className="fig-prot-arm" />; };
  const letter = (d, t, side) => { const [x, y] = polar(O, d + base + side * 9, PROT.R * 0.62); return <text x={x} y={y + 6} textAnchor="middle" fontSize="17" className="fig-prot-letter" style={{ fontFamily: MATH_FONT }}>{t}</text>; };
  return (
    <svg ref={ref} viewBox={`0 0 ${PROT.W} ${H}`} className="figure fig-obj fig-prot" role="img" aria-label={figWords(fig)}>
      <ProtractorArt O={O} base={base} labels={labels} cls="fig-prot">
        <path d={arcPath(O[0], O[1], 22, Math.min(a1, a2) + base, Math.max(a1, a2) + base)} className="fig-prot-arc" />
        {arm(a1)}{arm(a2)}
      </ProtractorArt>
      <circle cx={O[0]} cy={O[1]} r="3.5" className="fg-vertex" />
      {L && (
        <>
          {letter(a1, L.a, a1 <= a2 ? -1 : 1)}{letter(a2, L.b, a2 < a1 ? -1 : 1)}
          {(() => { const [x, y] = polar(O, base - 90, 26); return <text x={x} y={y + 6} textAnchor="middle" fontSize="17" className="fig-prot-letter" style={{ fontFamily: MATH_FONT }}>{L.vertex}</text>; })()}
        </>
      )}
    </svg>
  );
}

/** A clock: the twelve hours, the hands at their true angles (clockHands), and with `marks` the minute ticks. */
function Clock({ fig }) {
  const S = 240; const C = [S / 2, S / 2]; const R = 106;
  const at = (deg, r) => [C[0] + r * Math.sin((deg * Math.PI) / 180), C[1] - r * Math.cos((deg * Math.PI) / 180)]; // clockwise from 12
  const { hour, minute } = clockHands(fig.h, fig.m);
  const hand = (deg, len, cls) => { const [x, y] = at(deg, len); return <line x1={C[0]} y1={C[1]} x2={x.toFixed(2)} y2={y.toFixed(2)} className={cls} data-deg={deg} />; };
  return (
    <svg viewBox={`0 0 ${S} ${S}`} className="figure fig-obj fig-clock" role="img" aria-label={figWords(fig)}>
      <circle cx={C[0]} cy={C[1]} r={R} className="fig-clock-face" />
      {Array.from({ length: fig.marks ? 60 : 12 }, (_, i) => {
        const deg = i * (fig.marks ? 6 : 30); const big = deg % 30 === 0;
        const [x1, y1] = at(deg, R - 3); const [x2, y2] = at(deg, R - (big ? 13 : 7));
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} className={big ? 'fig-clock-tick big' : 'fig-clock-tick'} />;
      })}
      {Array.from({ length: 12 }, (_, i) => { const [x, y] = at((i + 1) * 30, R - 30); return <text key={i} x={x} y={y + 6.5} textAnchor="middle" fontSize="18" className="fig-clock-num">{i + 1}</text>; })}
      {/* both hands end inside the ring of numbers, so none is hidden */}
      {hand(hour, 46, 'fig-clock-hand hour')}
      {hand(minute, 64, 'fig-clock-hand minute')}
      <circle cx={C[0]} cy={C[1]} r="6" className="fig-clock-pin" />
    </svg>
  );
}

/** One numline type: a line cut into parts (den) is the fraction lane's PartsLine, any other the teaching NumLine. */
const NumberLine = ({ fig }) => (fig.den ? <PartsLine fig={fig} /> : <NumLine fig={fig} />);

export default function Figure({ fig }) {
  if (!fig) return null;
  const C = { coord: Coord, linear: Linear, cross: Cross, parallel: Parallel, triangle: Triangle, right: RightTri, ladder: Ladder, table: Table, geo: Geo, scale: Scale, area: Area, ray: RayFig, tiles: TilesFig, numline: NumberLine, thermo: Thermo, machine: Machine, dots: Dots, bars: Bars, fbar: FBar, fgrid: FGrid, dline: DLine, groups: Groups, sgraph: SGraph, protractor: ProtractorFigure, clock: Clock }[fig.type];
  return C ? <div className="figure-wrap"><C fig={fig} /></div> : null;
}
