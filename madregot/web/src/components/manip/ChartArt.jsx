// The drawing of the data figures (curriculum stage 3, DATA-3): a bar chart, a pie, a line chart and a pictogram, each
// as SVG parts in a 320-wide box, so a still figure (components/Figure.jsx 'chart') and the objects that build a chart
// (DATA-2) draw them the same way. Every number comes from content/manip.js (chartAxis, chartNum), which also says them
// in words (chartWords), so what is drawn and what is read never differ.
//   bar    the first category on the right, its name under it (wrapped to two lines in its slot); the value axis on the
//          right, a light grid line at every step and a number every `every` steps (at most 8, critique note 25)
//   pie    slices clockwise from 12 o'clock, each in its own colour and pattern; the names and values in a legend of
//          chips under the circle, in the slices' order, never inside a slice (colour is never the only cue)
//   line   the horizontal axis left to right (years, hours), the value axis on the left; numbers as xs are placed to
//          scale (2010 and 2016, with 2014 marked between), words evenly
//   picto  a row of icons a category, its name on the right; a half icon is drawn as its right half (the row runs
//          right to left); the key under the rows
import clsx from 'clsx';
import { m } from 'motion/react';
import { chartAxis, chartNum, pictoIcons, AXIS_LABELS, AXIS_LABELS_COMPACT } from '@/content/manip.js';

export const CHART_W = 320;
/**
 * The colour families a pie's slices take, in order (figure.css .fig-tone-k), each with its own pattern too; bars and
 * icons are all the brand colour unless `tones` gives each category a family.
 */
export const TONES = 8;
const toneOf = (f, i) => (f.tones?.[i] ?? i) % TONES;

/** About how wide a short label is at this font size: Hebrew letters and digits are wide, spaces and marks narrow. */
export const textW = (s, size) => [...String(s)].reduce((a, ch) => a + (ch === ' ' ? 0.3 : /[.,:()'"׳״\-–−]/.test(ch) ? 0.34 : 0.6), 0) * size;
/** A label wrapped into at most `lines` lines of at most maxW; a word that is still too wide makes the font smaller. */
export function wrapText(s, maxW, size = 14, lines = 2) {
  const words = String(s ?? '').split(/\s+/).filter(Boolean);
  const out = []; let cur = '';
  for (const w of words) { const t = cur ? `${cur} ${w}` : w; if (!cur || textW(t, size) <= maxW) cur = t; else { out.push(cur); cur = w; } }
  if (cur) out.push(cur);
  if (out.length > lines) out.splice(lines - 1, out.length, out.slice(lines - 1).join(' '));
  const widest = Math.max(0, ...out.map((l) => textW(l, size)));
  return { lines: out, size: widest > maxW ? Math.max(10, (size * maxW) / widest) : size };
}
const none = () => ({});
const val = (f, i, v) => `${chartNum(v, f.dp)}${f.mode === 'pie' && f.pct ? '%' : ''}`;

// ---------------------------------------------------------------- the value axis (bar and line)

/** A value axis in a box: Y(v) and the axis itself, for a plot from yTop to yBase. */
const yScale = (ax, yTop, yBase) => (v) => yBase - ((Math.max(ax.from, Math.min(ax.max, v)) - ax.from) / (ax.max - ax.from)) * (yBase - yTop);

/** The grid (a light line at every step, the base heavier), the axis line with its small ticks, and its numbers. */
export function AxisArt({ ax, Y, x0, x1, side, numbers = true }) {
  const axX = side === 'left' ? x0 : x1; const out = side === 'left' ? -1 : 1;
  return (
    <g className="fig-ch-axisg">
      {ax.ticks.map((t) => <line key={`g${t}`} x1={x0} x2={x1} y1={Y(t)} y2={Y(t)} className={t === ax.from ? 'fig-ch-base' : 'fig-ch-grid'} />)}
      <line x1={axX} x2={axX} y1={Y(ax.max) - 6} y2={Y(ax.from)} className="fig-ch-axis" />
      {ax.ticks.map((t) => <line key={`t${t}`} x1={axX} x2={axX + out * 5} y1={Y(t)} y2={Y(t)} className="fig-ch-axis" />)}
      {numbers && ax.labelled.map((t) => (
        <text key={`n${t}`} x={axX + out * 9} y={Y(t) + 5} textAnchor={side === 'left' ? 'end' : 'start'} className="fig-ch-tick">{chartNum(t)}</text>
      ))}
    </g>
  );
}

/** A dashed line across the plot at `level` (the 2.0 m/s wind, a fair share), its number outside the plot. */
function LevelArt({ f, Y, x0, x1, side }) {
  if (f.level == null) return null;
  const y = Y(f.level);
  return (
    <g className="fig-ch-level">
      <line x1={x0} x2={x1} y1={y} y2={y} />
      <text x={side === 'left' ? x0 - 6 : x1 + 6} y={y + 5} textAnchor={side === 'left' ? 'end' : 'start'} className="fig-ch-level-num">{chartNum(f.level, f.dp)}</text>
    </g>
  );
}

/** A cross over a drawn thing (a jump that does not count): two thick strokes, so it reads without colour. */
const Cross = ({ x, y, w, h }) => <path d={`M ${x} ${y} L ${x + w} ${y + h} M ${x + w} ${y} L ${x} ${y + h}`} className="fig-ch-cross" />;

/** A label wrapped under its place: lines of text centred at x, from y down. */
function Wrapped({ x, y, wrap, className, lh }) {
  return (
    <text x={x} y={y} textAnchor="middle" direction="rtl" className={className} style={{ fontSize: `${wrap.size}px` }}>
      {wrap.lines.map((l, k) => <tspan key={k} x={x} dy={k ? lh : 0}>{l}</tspan>)}
    </text>
  );
}

// ---------------------------------------------------------------- bar

/**
 * Where everything of a bar chart is: the axis, the slots right to left, the bars' width, the labels' lines. `bare`
 * (the chart a student builds, Chart.jsx): the box holds the plot only, and its words are HTML around it at a fixed
 * size (the axis title over it, the numbers beside it, the names under it), so a narrow phone does not shrink them.
 */
export function barGeom(f, { compact = false, bare = false } = {}) {
  const ax = chartAxis(f, compact ? AXIS_LABELS_COMPACT : AXIS_LABELS);
  const cats = f.cats || f.values.map(() => '');
  const n = Math.max(1, cats.length);
  const W = CHART_W;
  const tickW = Math.max(...ax.labelled.map((v) => textW(chartNum(v), bare ? 16 : 14))) + 14;
  const valueRow = f.labels !== false || f.hide != null ? 22 : bare ? 18 : 10;
  const top = (f.unit && !bare ? 30 : 6) + valueRow;
  const PH = compact ? 88 : 150;
  const B = top + PH;
  const x1 = W - tickW - 4; const x0 = f.level != null ? 40 : 8;
  const slot = (x1 - x0) / n;
  const cx = (i) => x1 - slot * (i + 0.5);
  const bw = Math.min(compact ? 40 : 48, slot * 0.62);
  const size = compact ? 13 : 14; const lh = size + 3;
  const wraps = cats.map((c) => wrapText(c, slot - 6, size));
  const lines = Math.max(1, ...wraps.map((w) => w.lines.length));
  const H = bare ? B + 8 : B + 10 + size + (lines - 1) * lh + 6;
  return { W, H, ax, n, top, B, PH, x0, x1, slot, cx, bw, Y: yScale(ax, top, B), wraps, lh, cats };
}

/**
 * The bars over the axis, their values, the '?' of a hidden one, crossed ones, the level line and the names. With
 * `text` false only the shapes are drawn (Chart.jsx writes the words in HTML, barGeom's `bare`).
 */
export function BarChartArt({ f, g, draw = none, values = f.values, text = true }) {
  const crossed = new Set(f.cross || []);
  return (
    <g>
      <AxisArt ax={g.ax} Y={g.Y} x0={g.x0} x1={g.x1} side="right" numbers={text} />
      {values.map((v, i) => {
        const x = g.cx(i) - g.bw / 2; const hidden = f.hide === i;
        if (v == null) {
          // a missing value keeps its place: a dashed outline and a question mark
          const h = g.PH * 0.4;
          return (
            <m.g key={i} className="fig-ch-bar gone" {...draw(i, 'fade')}>
              <rect x={x} y={g.B - h} width={g.bw} height={h} rx="3" />
              <text x={g.cx(i)} y={g.B - h - 7} textAnchor="middle" className="fig-ch-val">?</text>
            </m.g>
          );
        }
        const y = g.Y(v);
        return (
          <m.g key={i} className={clsx('fig-ch-bar', `fig-tone-${f.tones ? toneOf(f, i) : 0}`, crossed.has(i) && 'crossed')} {...draw(i, 'fade')}>
            <rect x={x} y={y} width={g.bw} height={Math.max(0, g.B - y)} rx="3" />
            {text && (hidden || f.labels !== false) && <text x={g.cx(i)} y={y - 7} textAnchor="middle" className="fig-ch-val">{hidden ? '?' : val(f, i, v)}</text>}
            {crossed.has(i) && <Cross x={x - 3} y={Math.min(y, g.B - 24)} w={g.bw + 6} h={Math.max(24, g.B - y)} />}
          </m.g>
        );
      })}
      <LevelArt f={f} Y={g.Y} x0={g.x0} x1={g.x1} side="left" />
      {text && g.wraps.map((w, i) => w.lines.length > 0 && <Wrapped key={`c${i}`} x={g.cx(i)} y={g.B + 10 + w.size} wrap={w} lh={g.lh} className="fig-ch-cat" />)}
    </g>
  );
}

// ---------------------------------------------------------------- line

/** Where everything of a line chart is: the value axis on the left, x to scale (numbers) or evenly (words). */
export function lineGeom(f, { compact = false } = {}) {
  const ax = chartAxis(f, compact ? AXIS_LABELS_COMPACT : AXIS_LABELS);
  const xs = f.xs || f.values.map((_, i) => i + 1);
  const W = CHART_W;
  const tickW = Math.max(...ax.labelled.map((v) => textW(chartNum(v), 14))) + 14;
  const top = (f.unit ? 30 : 6) + (f.labels !== false ? 24 : 10);
  const PH = compact ? 88 : 140;
  const B = top + PH;
  const x0 = tickW + 4; const x1 = W - (f.level != null ? 40 : 14);
  const numeric = xs.every((x) => typeof x === 'number') && (f.mark == null || typeof f.mark === 'number');
  const lo = numeric ? Math.min(...xs, f.mark ?? Infinity) : 0; const hi = numeric ? Math.max(...xs, f.mark ?? -Infinity) : xs.length - 1;
  const inner = 18;
  const XofV = (v) => (hi === lo ? (x0 + x1) / 2 : x0 + inner + ((v - lo) / (hi - lo)) * (x1 - x0 - 2 * inner));
  const X = (i) => XofV(numeric ? xs[i] : i);
  // the mark: a number on a numeric axis is placed to scale; a word is the point with that name
  const markI = f.mark == null ? -1 : xs.findIndex((x) => x === f.mark);
  const markX = f.mark == null ? null : numeric ? XofV(f.mark) : markI >= 0 ? X(markI) : null;
  const H = B + (compact ? 26 : 30);
  return { W, H, ax, xs, top, B, PH, x0, x1, X, numeric, markX, markI, Y: yScale(ax, top, B), compact };
}

/** The y of the line at an x between two drawn points (the mark), or null outside them. */
function lineAt(g, values, x) {
  const pts = values.map((v, i) => (v == null ? null : [g.X(i), g.Y(v)])).filter(Boolean).sort((a, b) => a[0] - b[0]);
  for (let k = 1; k < pts.length; k += 1) {
    const [a, b] = [pts[k - 1], pts[k]];
    if (x >= a[0] - 1e-6 && x <= b[0] + 1e-6) return a[1] + ((x - a[0]) / (b[0] - a[0] || 1)) * (b[1] - a[1]);
  }
  return pts.find((p) => Math.abs(p[0] - x) < 1e-6)?.[1] ?? null;
}

/** The x labels under the axis, left to right; a label that would touch the one before it gives way (never the first,
 * the last or the mark). */
function xLabels(g, f) {
  const text = (x) => (typeof x === 'number' ? chartNum(x) : String(x));
  const items = g.xs.map((x, i) => ({ x: g.X(i), t: text(x), keep: i === 0 || i === g.xs.length - 1 || i === g.markI }));
  if (g.markX != null && g.markI < 0) items.push({ x: g.markX, t: text(f.mark), keep: true, mark: true });
  items.sort((a, b) => a.x - b.x);
  const kept = [];
  for (const it of items) {
    const w = textW(it.t, 13) / 2 + 4;
    const prev = kept[kept.length - 1];
    if (prev && it.x - w < prev.x + prev.w) { if (it.keep && !prev.keep) kept.pop(); else if (!it.keep) continue; }
    kept.push({ ...it, w });
  }
  return kept;
}

/** The line, its points and values, the dashed continuation, the marked x, crossed points and the level line. */
export function LineChartArt({ f, g, draw = none, values = f.values }) {
  const n = values.length; const dashFrom = f.dashed ? n - f.dashed : n;
  const crossed = new Set(f.cross || []);
  const pts = values.map((v, i) => (v == null ? null : { i, x: g.X(i), y: g.Y(v), v }));
  const segs = [];
  for (let i = 1; i < n; i += 1) if (pts[i - 1] && pts[i]) segs.push({ a: pts[i - 1], b: pts[i], dashed: i >= dashFrom });
  const my = g.markX != null ? lineAt(g, values, g.markX) : null;
  // a point's value goes over it, or under it when over it would leave the chart or sit on the level line; a crossed
  // point's value clears its cross
  const levelY = f.level != null ? g.Y(f.level) : null;
  const labelY = (p) => {
    const x = crossed.has(p.i) ? 8 : 0;
    const under = p.y - g.top < 22 || (levelY != null && Math.abs(levelY - (p.y - 15 - x)) < 10);
    return under ? p.y + 21 + x : p.y - 10 - x;
  };
  return (
    <g direction="ltr">
      <AxisArt ax={g.ax} Y={g.Y} x0={g.x0} x1={g.x1} side="left" />
      <LevelArt f={f} Y={g.Y} x0={g.x0} x1={g.x1} side="right" />
      {g.markX != null && (
        <g className="fig-ch-mark">
          <line x1={g.markX} x2={g.markX} y1={g.B} y2={my ?? g.top} />
          {my != null && <circle cx={g.markX} cy={my} r="7" />}
        </g>
      )}
      {segs.map((s, k) => <m.path key={`s${k}`} d={`M ${s.a.x} ${s.a.y} L ${s.b.x} ${s.b.y}`} className={clsx('fig-ch-line', s.dashed && 'dashed')} {...draw(k, s.dashed ? 'fade' : 'path')} />)}
      {pts.map((p) => p && (
        <m.g key={`p${p.i}`} className={clsx('fig-ch-pt', p.i >= dashFrom && 'est', crossed.has(p.i) && 'crossed')} {...draw(p.i, 'end')}>
          <circle cx={p.x} cy={p.y} r="5" />
          {(f.labels !== false || f.hide === p.i) && (
            <text x={p.x} y={labelY(p)} textAnchor="middle" className="fig-ch-val">{f.hide === p.i ? '?' : val(f, p.i, p.v)}</text>
          )}
          {crossed.has(p.i) && <Cross x={p.x - 9} y={p.y - 9} w={18} h={18} />}
        </m.g>
      ))}
      {xLabels(g, f).map((l, k) => <text key={`x${k}`} x={l.x} y={g.B + 20} textAnchor="middle" className={clsx('fig-ch-x', l.mark || (g.markI >= 0 && l.t === String(f.mark)) ? 'on' : null)}>{l.t}</text>)}
    </g>
  );
}

// ---------------------------------------------------------------- pie

/** The pie's circle and the legend's chips, in rows under it (right to left, each row centred). */
export function pieGeom(f, { compact = false } = {}) {
  const W = CHART_W; const R = compact ? 40 : 64; const cx = W / 2; const cy = (f.unit ? 28 : 0) + R + 6;
  const size = compact ? 13 : 14; const ch = compact ? 24 : 28; const gap = 6;
  const cats = f.cats || f.values.map(() => '');
  const chips = cats.map((c, i) => {
    const said = f.hide === i ? '?' : f.labels === false ? '' : val(f, i, f.values[i]);
    const text = [c, said].filter(Boolean).join(' ');
    return { i, text, w: Math.min(W - 16, 12 + 12 + 6 + textW(text, size) + 10) };
  });
  const rows = []; let row = []; let used = 0;
  for (const c of chips) { if (row.length && used + gap + c.w > W - 16) { rows.push(row); row = []; used = 0; } row.push(c); used += (row.length > 1 ? gap : 0) + c.w; }
  if (row.length) rows.push(row);
  const top = cy + R + 12;
  const placed = rows.flatMap((r, k) => {
    const width = r.reduce((a, c) => a + c.w, 0) + gap * (r.length - 1);
    let x = (W + width) / 2; // right to left from the row's right edge
    return r.map((c) => { x -= c.w; const at = { ...c, x, y: top + k * (ch + gap) }; x -= gap; return at; });
  });
  const H = top + rows.length * (ch + gap) + 2;
  return { W, H, R, cx, cy, chips: placed, ch, size };
}

/** A slice from angle a0 to a1 (degrees clockwise from 12 o'clock). */
export function slicePath(cx, cy, R, a0, a1) {
  const p = (a) => [cx + R * Math.sin((a * Math.PI) / 180), cy - R * Math.cos((a * Math.PI) / 180)];
  const [x0, y0] = p(a0); const [x1, y1] = p(a1);
  return `M ${cx} ${cy} L ${x0} ${y0} A ${R} ${R} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1} Z`;
}

/** The patterns that tell the slices (and their chips) apart without colour: one per tone, in this figure's ids. */
export function PatternDefs({ id }) {
  return (
    <defs>
      <pattern id={`${id}-1`} patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="7" className="fig-ch-pat" /></pattern>
      <pattern id={`${id}-2`} patternUnits="userSpaceOnUse" width="7" height="7"><circle cx="3.5" cy="3.5" r="1.4" className="fig-ch-pat dot" /></pattern>
      <pattern id={`${id}-3`} patternUnits="userSpaceOnUse" width="7" height="7"><line x1="0" y1="3.5" x2="7" y2="3.5" className="fig-ch-pat" /></pattern>
      <pattern id={`${id}-4`} patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)"><path d="M 0 4 H 8 M 4 0 V 8" className="fig-ch-pat" /></pattern>
      <pattern id={`${id}-5`} patternUnits="userSpaceOnUse" width="7" height="7"><line x1="3.5" y1="0" x2="3.5" y2="7" className="fig-ch-pat" /></pattern>
      <pattern id={`${id}-6`} patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(-45)"><line x1="0" y1="0" x2="0" y2="8" className="fig-ch-pat" /></pattern>
      <pattern id={`${id}-7`} patternUnits="userSpaceOnUse" width="9" height="9"><circle cx="4.5" cy="4.5" r="2.2" className="fig-ch-pat ring" /></pattern>
    </defs>
  );
}
/** A shape in a category's colour, with its pattern over it (tone 0 is plain). */
export const Toned = ({ tone, pid, children }) => (
  <g className={`fig-tone-${tone}`}>
    {children('fig-ch-fill')}
    {tone > 0 && children('fig-ch-patfill', `url(#${pid}-${tone})`)}
  </g>
);

/** The slices clockwise from 12 o'clock, a white edge between them, and the legend's chips under the circle. */
export function PieArt({ f, g, pid, draw = none, values = f.values }) {
  const total = values.reduce((a, v) => a + (v > 0 ? v : 0), 0);
  let at = 0;
  const slices = values.map((v, i) => {
    const sweep = total > 0 && v > 0 ? (v / total) * 360 : 0; const s = { i, a0: at, a1: at + sweep }; at += sweep; return s;
  }).filter((s) => s.a1 > s.a0);
  return (
    <g>
      <circle cx={g.cx} cy={g.cy} r={g.R} className="fig-ch-pie-bg" />
      {slices.map((s) => {
        const tone = toneOf(f, s.i); const whole = s.a1 - s.a0 >= 359.999;
        const shape = (cls, fill) => (whole ? <circle cx={g.cx} cy={g.cy} r={g.R} className={cls} fill={fill} /> : <path d={slicePath(g.cx, g.cy, g.R, s.a0, s.a1)} className={cls} fill={fill} />);
        return <m.g key={s.i} {...draw(s.i, 'fade')}><Toned tone={tone} pid={pid}>{shape}</Toned></m.g>;
      })}
      {slices.length > 1 && slices.map((s) => {
        const a = (s.a0 * Math.PI) / 180;
        return <line key={`e${s.i}`} x1={g.cx} y1={g.cy} x2={g.cx + g.R * Math.sin(a)} y2={g.cy - g.R * Math.cos(a)} className="fig-ch-edge" />;
      })}
      <circle cx={g.cx} cy={g.cy} r={g.R} className="fig-ch-rim" />
      {g.chips.map((c) => {
        const tone = toneOf(f, c.i); const sw = 12; const sx = c.x + c.w - 10 - sw; const sy = c.y + (g.ch - sw) / 2;
        return (
          <g key={`k${c.i}`} className="fig-ch-chip">
            <rect x={c.x} y={c.y} width={c.w} height={g.ch} rx={g.ch / 2} className="fig-ch-chip-bg" />
            <Toned tone={tone} pid={pid}>{(cls, fill) => <rect x={sx} y={sy} width={sw} height={sw} rx="3" className={cls} fill={fill} />}</Toned>
            <text x={(c.x + 10 + sx - 6) / 2} y={c.y + g.ch / 2 + g.size * 0.36} textAnchor="middle" direction="rtl" className="fig-ch-chip-text" style={{ fontSize: `${g.size}px` }}>{c.text}</text>
          </g>
        );
      })}
    </g>
  );
}

// ---------------------------------------------------------------- pictogram

/** An icon in a s × s box at (x, y): a person, a book or a ball, drawn plainly in the category's colour. */
function Icon({ kind, x, y, s }) {
  const k = s / 24;
  const t = (d) => `translate(${x} ${y}) scale(${k})`;
  if (kind === 'book') return <g transform={t()}><path d="M 4 3 h 13 a 3 3 0 0 1 3 3 v 15 h -13 a 3 3 0 0 1 -3 -3 z" className="fig-ch-ico" /><path d="M 7 21 v -3 h 13 M 9 7 h 8 M 9 10.5 h 8" className="fig-ch-ico-line" /></g>;
  if (kind === 'ball') return <g transform={t()}><circle cx="12" cy="12" r="10" className="fig-ch-ico" /><path d="M 12 7.5 l 4.3 3.1 -1.6 5 h -5.4 l -1.6 -5 z M 12 2 v 5.5 M 16.3 10.6 l 5.2 -1.7 M 14.7 15.6 l 3.2 4.4 M 9.3 15.6 l -3.2 4.4 M 7.7 10.6 l -5.2 -1.7" className="fig-ch-ico-line" /></g>;
  // a person: a head and shoulders
  return <g transform={t()}><circle cx="12" cy="7" r="4.6" className="fig-ch-ico" /><path d="M 3.5 22 v -2.5 a 6.5 6.5 0 0 1 6.5 -6.5 h 4 a 6.5 6.5 0 0 1 6.5 6.5 v 2.5 z" className="fig-ch-ico" /></g>;
}

/** Where everything of a pictogram is: the names on the right, the icons right to left, the key under the rows. */
export function pictoGeom(f, { compact = false } = {}) {
  const W = CHART_W; const s = compact ? 22 : 26; const gap = 4; const rh = s + (compact ? 8 : 12);
  const cats = f.cats || [];
  const size = compact ? 13 : 15;
  const nameW = Math.min(110, Math.max(40, ...cats.map((c) => textW(c, size))) + 6);
  const xStart = W - 8 - nameW - 10; // the right edge of the first icon
  const top = 6; const keyY = top + cats.length * rh + 8;
  return { W, H: keyY + s + 10, s, gap, rh, nameW, xStart, top, keyY, size, cats };
}

/** The rows of icons (whole ones, then the half as its right half), the names, and the key "[icon] = 4 ילדים". */
export function PictoArt({ f, g, pid, draw = none }) {
  const icon = f.icon || 'person';
  const keyText = `${chartNum(f.key)}${f.unit ? ` ${f.unit}` : ''}`;
  return (
    <g>
      <defs><clipPath id={`${pid}-half`} clipPathUnits="objectBoundingBox"><rect x="0.5" y="0" width="0.5" height="1" /></clipPath></defs>
      {g.cats.map((c, i) => {
        const n = f.hide === i ? 0 : pictoIcons(f.values[i], f.key); const whole = Math.floor(n); const half = n - whole >= 0.5;
        const y = g.top + i * g.rh;
        const xOf = (k) => g.xStart - (k + 1) * g.s - k * g.gap;
        return (
          <m.g key={i} className={clsx('fig-ch-prow', `fig-tone-${f.tones ? toneOf(f, i) : 0}`)} {...draw(i, 'fade')}>
            <text x={g.W - 8} y={y + g.s / 2 + g.size * 0.36} textAnchor="start" direction="rtl" className="fig-ch-cat" style={{ fontSize: `${g.size}px` }}>{c}</text>
            {Array.from({ length: whole }, (_, k) => <Icon key={k} kind={icon} x={xOf(k)} y={y} s={g.s} />)}
            {half && <g clipPath={`url(#${pid}-half)`}><Icon kind={icon} x={xOf(whole)} y={y} s={g.s} /></g>}
            {f.hide === i && <text x={xOf(0) + g.s / 2} y={y + g.s / 2 + 6} textAnchor="middle" className="fig-ch-val">?</text>}
          </m.g>
        );
      })}
      <line x1={8} x2={g.W - 8} y1={g.keyY - 5} y2={g.keyY - 5} className="fig-ch-grid" />
      <g className="fig-ch-key fig-tone-0">
        <text x={g.W - 8} y={g.keyY + g.s / 2 + 5} textAnchor="start" direction="rtl" className="fig-ch-cat">מקרא:</text>
        <Icon kind={icon} x={g.W - 8 - 52 - g.s} y={g.keyY} s={g.s} />
        <text x={g.W - 8 - 52 - g.s - 8} y={g.keyY + g.s / 2 + 5} textAnchor="end" className="fig-ch-key-eq">=</text>
        <text x={g.W - 8 - 52 - g.s - 24} y={g.keyY + g.s / 2 + 5} textAnchor="start" direction="rtl" className="fig-ch-key-text">{keyText}</text>
      </g>
    </g>
  );
}
