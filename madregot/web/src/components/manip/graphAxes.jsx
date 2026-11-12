// The frame of a graph on two named, scaled axes, shared by the graph you draw (GraphDraw.jsx) and the still situation
// graph (Figure.jsx SGraph), so a student and a screen reader meet one way of reading a graph (FUNC-1).
// The drawing is a dir="ltr" group with the lowest values at the bottom left: numbers grow to the right and up, as on
// every number line in the app. The Hebrew names sit outside the maths: the y axis's name above the axis, starting at
// it, and the x axis's name under the right end of its axis. A grid line stands at every step; a number is written on
// every `every`-th one (every: 2 leaves the scale to be read, as the Ministry's "כמה שווה משבצת" asks).
// Text sizes are attributes in drawing units, so a test can work out the size a phone draws them at. A drawing shown
// small (a lesson on a 320×568 phone fits it into the height the screen leaves, about 155px for 266 units) would draw
// them under 12px: there the text grows (graphFont) and the plot gives up the room, inside the same box, so the box and
// the page around it never move.
import { useEffect, useState } from 'react';
import { axisLo, axisValues, axisName, figNum } from '@/content/manip.js';

/** Text sizes in drawing units: on a 320px phone the box is drawn 288px wide (scale 0.85), so 15 is about 12.7px. */
export const GRAPH_FONT = { num: 15, name: 15, tag: 16 };
/** The smallest size a graph's numbers and names are drawn at on a phone, in pixels (DESIGN.md's small text). */
export const GRAPH_MIN_PX = 12;
/** How far the text may grow on a drawing shown small: past it the plot would get too short to read. */
export const GRAPH_MAX_GROW = 1.5;
/** The scale of a drawing W×H units wide shown in a box of w×h pixels, as an SVG fits its viewBox (meet). */
export const drawnScale = (box, W, H) => (box ? Math.min(box.w / W, box.h > 0 ? box.h / H : Infinity) : 288 / W);
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
 * wherever the line ends. items: [{ label, tone, dashed }]; `cls` the class prefix, `${cls}-key` and its tone. `inset`
 * keeps the row's right end clear (in drawing units): a still figure in an exercise has its zoom button in that corner.
 */
export function GraphLegend({ fr, items, cls, inset = 0 }) {
  let right = fr.W - 6 - inset;
  return (
    <g className={`${cls}-legend`}>
      {items.map((it, i) => {
        const w = nameWidth(it.label, fr.font.tag); const x = right; right -= w + 8 + 24 + 14;
        return (
          <g key={i} className={`${cls}-key tone-${it.tone}`}>
            <text x={x} y={fr.legendY} {...edgeAt(it.label, 'right')} fontSize={fr.font.tag}>{it.label}</text>
            <line x1={x - w - 8 - 24} x2={x - w - 8} y1={fr.legendLineY} y2={fr.legendLineY} className={it.dashed ? 'dashed' : undefined} />
          </g>
        );
      })}
    </g>
  );
}

/** Which grid lines carry a number. */
export const numbered = (a) => axisValues(a).filter((_, i) => i % (a.every || 1) === 0);

/** The text sizes for a growth k (1: GRAPH_FONT), rounded up to a tenth so a grown size never lands under its pixels. */
const up = (v) => Math.ceil(v * 10 - 1e-9) / 10;
const fontAt = (k) => ({ num: up(GRAPH_FONT.num * k), name: up(GRAPH_FONT.name * k), tag: up(GRAPH_FONT.tag * k), k });

/**
 * Where everything is: the plot from (PADL, TOP) to (W − PADR, BOT); X and Y map values to the drawing and fromX and
 * fromY back. The left margin fits the widest y number. `foot` adds room under the x name (the direction arrow), `head` a
 * row over the y name (the names of the lines, LEGEND_ROW). `font` (graphFont): larger text takes its room from the plot,
 * so W and H stay those of GRAPH_FONT; `font` and the text's places (numY, nameY, legendY, footY) come back with the frame.
 */
export function graphFrame(x, y, { foot = 0, head = 0, font = fontAt(1) } = {}) {
  const { W, plotH: plot0, below: below0 } = GRAPH_BOX;
  const gn = font.num - GRAPH_FONT.num; const gm = font.name - GRAPH_FONT.name; const gt = font.tag - GRAPH_FONT.tag;
  const H = GRAPH_BOX.top + head + plot0 + below0 + foot; // the box of the drawing at GRAPH_FONT, whatever the text
  const headRoom = head ? head + gt : 0; const footRoom = foot ? foot + gm : 0;
  const TOP = GRAPH_BOX.top + gm + headRoom; const below = below0 + gn + gm;
  const plotH = H - TOP - below - footRoom; const BOT = TOP + plotH;
  const widest = Math.max(...numbered(y).map((v) => numWidth(figNum(v), font.num)));
  const PADL = Math.max(34, Math.ceil(widest + 18)); const PADR = 24;
  const x0 = axisLo(x); const y0 = axisLo(y);
  const plotW = W - PADL - PADR;
  const r2 = (v) => Math.round(v * 100) / 100;
  const X = (v) => r2(PADL + ((v - x0) / (x.max - x0)) * plotW);
  const Y = (v) => r2(BOT - ((v - y0) / (y.max - y0)) * plotH);
  const fromX = (px) => x0 + ((px - PADL) / plotW) * (x.max - x0);
  const fromY = (py) => y0 + ((BOT - py) / plotH) * (y.max - y0);
  return {
    W, H, PADL, PADR, TOP, BOT, plotW, plotH, X, Y, fromX, fromY, font,
    numY: BOT + 22 + gn, nameY: BOT + 44 + gn + gm, footY: BOT + 66 + gn + gm, legendY: 17 + 0.75 * gt, legendLineY: 11 + 0.5 * gt,
  };
}

/** How tall a row of digits is, as a part of the text size (Rubik's figures stand about 0.7 of it). */
export const DIGIT_HEIGHT = 0.7;
/**
 * Do a frame's numbers stand apart: along the x axis each its width and half a digit more (at 12px, about 6px between
 * "12" and "16", so they never read as "1216"), up the y axis the digits' height, a tenth of the size and 2 units more
 * (about 3px between two rows)?
 */
export function numbersApart(fr, x, y) {
  const xs = numbered(x); const ys = numbered(y);
  const xGap = xs.length > 1 ? fr.X(xs[1]) - fr.X(xs[0]) : Infinity;
  const xWide = Math.max(...xs.map((v) => numWidth(figNum(v), fr.font.num)));
  const yGap = ys.length > 1 ? fr.Y(ys[0]) - fr.Y(ys[1]) : Infinity;
  return xGap >= xWide + 0.5 * fr.font.num && yGap >= (DIGIT_HEIGHT + 0.1) * fr.font.num + 2;
}

/**
 * The text sizes for a graph shown at `scale` px per drawing unit: GRAPH_FONT, grown (up to GRAPH_MAX_GROW) until the
 * numbers are drawn GRAPH_MIN_PX, but never so far that the numbers of an axis would touch (then as far as they stay
 * apart). On a 320px phone with the whole width (scale 0.85) nothing grows.
 */
export function graphFont(scale, x, y, opts = {}) {
  const want = Math.min(GRAPH_MAX_GROW, Math.max(1, GRAPH_MIN_PX / (GRAPH_FONT.num * scale)));
  for (let k = want; k > 1; k = Math.round((k - 0.02) * 100) / 100) {
    const font = fontAt(k);
    if (numbersApart(graphFrame(x, y, { ...opts, font }), x, y)) return font;
  }
  return fontAt(1);
}

/** The width and height an element is drawn at, measured once it is on the page (null before: the default size). */
export function useDrawnBox(ref, initial = null) {
  const [box, setBox] = useState(initial);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([e]) => {
      const w = Math.round(e.contentRect.width); const h = Math.round(e.contentRect.height);
      if (w > 0 && h > 0) setBox((b) => (b && b.w === w && b.h === h ? b : { w, h }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return box;
}

/**
 * The grid, the two axes with their arrows, the numbers and the two names. `cls` is the class prefix of the drawing
 * that uses it ('mp-graph' for the object, 'fig-sgraph' for the still figure): `${cls}-grid`, `-axis`, `-num`, `-name`.
 */
export function GraphAxes({ fr, x, y, cls }) {
  const { X, Y, PADL, TOP, BOT, W, plotW, font } = fr;
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
      {xs.filter((v) => xn.has(v)).map((v) => <text key={`nx${v}`} x={X(v)} y={fr.numY} textAnchor="middle" fontSize={font.num} className={`${cls}-num`}>{figNum(v)}</text>)}
      {ys.filter((v) => yn.has(v)).map((v) => <text key={`ny${v}`} x={PADL - 8} y={Y(v) + font.num / 3} textAnchor="end" fontSize={font.num} className={`${cls}-num`}>{figNum(v)}</text>)}
      {/* the names read right to left: the y name starts at its axis (its end, on the left, at the axis); the x name
          ends under the right end of its axis */}
      <text x={PADL - 4} y={TOP - 22} {...edgeAt(axisName(y), 'left')} fontSize={font.name} className={`${cls}-name`}>{axisName(y)}</text>
      <text x={W - 6} y={fr.nameY} {...edgeAt(axisName(x), 'right')} fontSize={font.name} className={`${cls}-name`}>{axisName(x)}</text>
    </g>
  );
}
