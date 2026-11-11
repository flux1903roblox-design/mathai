// The frame of a graph on two named, scaled axes, shared by the graph you draw (GraphDraw.jsx) and the still situation
// graph (Figure.jsx SGraph), so a student and a screen reader meet one way of reading a graph (FUNC-1).
// The drawing is a dir="ltr" group with the lowest values at the bottom left: numbers grow to the right and up, as on
// every number line in the app. The Hebrew names sit outside the maths: the y axis's name above the axis, starting at
// it, and the x axis's name under the right end of its axis. A grid line stands at every step; a number is written on
// every `every`-th one (every: 2 leaves the scale to be read, as the Ministry's "כמה שווה משבצת" asks).
// Text sizes are attributes in drawing units (GRAPH_FONT), so a test can work out the size a phone draws them at.
import { axisLo, axisValues, axisName, figNum } from '@/content/manip.js';

/** Text sizes in drawing units: on a 320px phone the box is drawn 288px wide (scale 0.85), so 15 is about 12.7px. */
export const GRAPH_FONT = { num: 15, name: 15, tag: 16 };
/** The width of the drawing; the plot's height; the room above it for the y name and below it for numbers and the x name. */
export const GRAPH_BOX = { W: 340, plotH: 172, top: 42, below: 52 };
/** About the width of a number written at `size` (digits and a minus are about 0.57 of the size in Rubik). */
export const numWidth = (s, size = GRAPH_FONT.num) => String(s).length * size * 0.57;
/** About the width of a Hebrew name (letters about 0.55 of the size, a space or a bracket 0.3). */
export const nameWidth = (s, size = GRAPH_FONT.name) => [...String(s)].reduce((w, ch) => w + (/[\s()]/.test(ch) ? 0.3 : 0.55) * size, 0);

const HEB = /[\u0590-\u05ff]/;
/**
 * The text attributes that put a label's left edge (edge 'left') or right edge (edge 'right') at its x, for a word in
 * Hebrew (right to left: its start is its right edge) or a letter or number (left to right).
 */
export const edgeAt = (text, edge) => {
  const rtl = HEB.test(String(text));
  return { textAnchor: (edge === 'left') === rtl ? 'end' : 'start', direction: rtl ? 'rtl' : undefined };
};

/** The height of the row of line names over a graph whose lines have names (GraphLegend). */
export const LEGEND_ROW = 24;
/**
 * The names of a graph's lines, in a row of their own above it, each after a short piece of its line (its colour, solid
 * or dashed), the first on the right as a Hebrew reader starts. A name never lands on a line, a point or an axis number,
 * wherever the line ends. items: [{ label, tone, dashed }]; `cls` the class prefix, `${cls}-key` and its tone.
 */
export function GraphLegend({ fr, items, cls }) {
  let right = fr.W - 6;
  return (
    <g className={`${cls}-legend`}>
      {items.map((it, i) => {
        const w = nameWidth(it.label, GRAPH_FONT.tag); const x = right; right -= w + 8 + 24 + 14;
        return (
          <g key={i} className={`${cls}-key tone-${it.tone}`}>
            <text x={x} y={17} {...edgeAt(it.label, 'right')} fontSize={GRAPH_FONT.tag}>{it.label}</text>
            <line x1={x - w - 8 - 24} x2={x - w - 8} y1={11} y2={11} className={it.dashed ? 'dashed' : undefined} />
          </g>
        );
      })}
    </g>
  );
}

/** Which grid lines carry a number. */
export const numbered = (a) => axisValues(a).filter((_, i) => i % (a.every || 1) === 0);

/**
 * Where everything is: the plot from (PADL, TOP) to (W − PADR, BOT); X and Y map values to the drawing and fromX and
 * fromY back. The left margin fits the widest y number. `foot` adds room under the x name (the direction arrow), `head` a
 * row over the y name (the names of the lines, LEGEND_ROW).
 */
export function graphFrame(x, y, { foot = 0, head = 0 } = {}) {
  const { W, plotH, below } = GRAPH_BOX; const top = GRAPH_BOX.top + head;
  const widest = Math.max(...numbered(y).map((v) => numWidth(figNum(v))));
  const PADL = Math.max(34, Math.ceil(widest + 18)); const PADR = 24;
  const TOP = top; const BOT = TOP + plotH; const H = BOT + below + foot;
  const x0 = axisLo(x); const y0 = axisLo(y);
  const plotW = W - PADL - PADR;
  const r2 = (v) => Math.round(v * 100) / 100;
  const X = (v) => r2(PADL + ((v - x0) / (x.max - x0)) * plotW);
  const Y = (v) => r2(BOT - ((v - y0) / (y.max - y0)) * plotH);
  const fromX = (px) => x0 + ((px - PADL) / plotW) * (x.max - x0);
  const fromY = (py) => y0 + ((BOT - py) / plotH) * (y.max - y0);
  return { W, H, PADL, PADR, TOP, BOT, plotW, plotH, X, Y, fromX, fromY };
}

/**
 * The grid, the two axes with their arrows, the numbers and the two names. `cls` is the class prefix of the drawing
 * that uses it ('mp-graph' for the object, 'fig-sgraph' for the still figure): `${cls}-grid`, `-axis`, `-num`, `-name`.
 */
export function GraphAxes({ fr, x, y, cls }) {
  const { X, Y, PADL, TOP, BOT, W, plotW } = fr;
  const xs = axisValues(x); const ys = axisValues(y);
  const xn = new Set(numbered(x)); const yn = new Set(numbered(y));
  const right = PADL + plotW;
  return (
    <g className={`${cls}-axes`}>
      {xs.map((v) => <line key={`gx${v}`} x1={X(v)} x2={X(v)} y1={TOP} y2={BOT} className={`${cls}-grid`} />)}
      {ys.map((v) => <line key={`gy${v}`} x1={PADL} x2={right} y1={Y(v)} y2={Y(v)} className={`${cls}-grid`} />)}
      <line x1={PADL} y1={BOT} x2={W - 9} y2={BOT} className={`${cls}-axis`} />
      <path d={`M ${W - 6} ${BOT} l -10 -5.5 v 11 z`} className={`${cls}-axis-head`} />
      <line x1={PADL} y1={BOT} x2={PADL} y2={TOP - 11} className={`${cls}-axis`} />
      <path d={`M ${PADL} ${TOP - 14} l -5.5 10 h 11 z`} className={`${cls}-axis-head`} />
      {xs.filter((v) => xn.has(v)).map((v) => <text key={`nx${v}`} x={X(v)} y={BOT + 22} textAnchor="middle" fontSize={GRAPH_FONT.num} className={`${cls}-num`}>{figNum(v)}</text>)}
      {ys.filter((v) => yn.has(v)).map((v) => <text key={`ny${v}`} x={PADL - 8} y={Y(v) + 5} textAnchor="end" fontSize={GRAPH_FONT.num} className={`${cls}-num`}>{figNum(v)}</text>)}
      {/* the names read right to left: the y name starts at its axis (its end, on the left, at the axis); the x name
          ends under the right end of its axis */}
      <text x={PADL - 4} y={TOP - 22} {...edgeAt(axisName(y), 'left')} fontSize={GRAPH_FONT.name} className={`${cls}-name`}>{axisName(y)}</text>
      <text x={W - 6} y={BOT + 44} {...edgeAt(axisName(x), 'right')} fontSize={GRAPH_FONT.name} className={`${cls}-name`}>{axisName(x)}</text>
    </g>
  );
}
