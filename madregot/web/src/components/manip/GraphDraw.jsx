// The graph you draw (FUNC-1): a story told as a graph, one point above each x, each dragged to its height. The whole
// column is a point's hit area: a drag in it moves that point to the finger's height (snapped to a grid line), a tap
// only chooses it for the step buttons. Each point is a slider in the tab order: ↑ and ↓ move it one step, Home and End
// to the ends of the axis, ← and → move to the neighbouring point. Fixed points (the start of a story) are drawn solid
// and never move; `ref` is a second line drawn for comparison (the other mover of a meeting story).
// In a check (`test`) nothing gives the heights away: no readout, no number on the step buttons, and a screen reader
// counts squares above the axis instead of naming the value, as the eye reads the grid (CURRICULUM-2's rule).
import { useRef, useState } from 'react';
import clsx from 'clsx';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { useDrag, arrowKeys, Stepper } from './core.jsx';
import { GraphAxes, GraphLegend, graphFrame, graphFont, drawnScale, useDrawnBox, LEGEND_ROW } from './graphAxes.jsx';
import { graphXs, graphMove, graphKey, graphShape, graphSolution, graphCorrect, squaresWords, axisLo, axisSteps, figNum } from '@/content/manip.js';
import { near } from '@/content/util.js';

const DRAG_FROM = 4; // drawing units a finger travels before a press is a drag and not a tap

export default function GraphDraw({ m, value, onChange, locked, reveal, good, answer, hint, test = false, box: shown = null }) {
  const xs = graphXs(m);
  const n = xs.length;
  const fixed = new Set(m.fixed || []);
  const free = xs.map((_, i) => i).filter((i) => !fixed.has(i));
  const vals = Array.isArray(value) ? value : m.start;
  const [sel, setSel] = useState(free[0] ?? 0);
  const pts = useRef([]);
  const press = useRef(null);
  const name = (i) => `${figNum(xs[i])}${m.x.unit ? ` ${m.x.unit}` : ''}`;
  const said = (i) => (test ? squaresWords(m, vals[i]) : `${figNum(vals[i])}${m.y.unit ? ` ${m.y.unit}` : ''}`);

  // every move goes through graphMove (content/manip.js): snapped, on the axis, and never a fixed point
  const send = (next) => { if (!locked && next !== vals) onChange(next); };
  const set = (i, v) => send(graphMove(m, vals, i, v));
  const [ref, drag] = useDrag((p, phase) => {
    if (phase === 'start') {
      const i = columnAt(p.x);
      press.current = fixed.has(i) ? null : { i, y: p.y, moved: false };
      if (press.current) setSel(i);
      return;
    }
    const pr = press.current; if (!pr) return;
    if (phase === 'end') press.current = null;
    if (!pr.moved && Math.abs(p.y - pr.y) < DRAG_FROM) return; // a tap chooses the point; a drag moves it
    pr.moved = true;
    set(pr.i, fr.fromY(p.y));
  }, locked);
  // the frame, its text grown when the canvas is shown small (graphAxes.jsx graphFont); `box` is the size before it is
  // measured on the page (tests)
  const box = useDrawnBox(ref, shown);
  const opts = { head: m.ref?.label ? LEGEND_ROW : 0 };
  const plain = graphFrame(m.x, m.y, opts);
  const font = graphFont(drawnScale(box, plain.W, plain.H), m.x, m.y, opts);
  const fr = font.k > 1 ? graphFrame(m.x, m.y, { ...opts, font }) : plain;
  const { X, Y, W, H, TOP, BOT, PADL, plotW } = fr;
  const col = n > 1 ? plotW / (n - 1) : plotW;
  // the column a point of the canvas is in (the drag above reads it when a finger goes down)
  const columnAt = (px) => Math.max(0, Math.min(n - 1, Math.round((px - PADL) / col)));

  const focus = (i) => { const k = Math.max(0, Math.min(n - 1, i)); pts.current[k]?.focus(); };
  const keys = (i) => arrowKeys({
    up: () => send(graphKey(m, vals, i, 'ArrowUp')), down: () => send(graphKey(m, vals, i, 'ArrowDown')),
    home: () => send(graphKey(m, vals, i, 'Home')), end: () => send(graphKey(m, vals, i, 'End')),
    left: () => focus(i - 1), right: () => focus(i + 1),
  });

  const line = (ys) => ys.map((v, i) => `${X(xs[i])},${Y(v)}`).join(' ');
  const ghost = reveal && answer && !graphCorrect(m, answer, vals) ? graphSolution(m, answer) : null;
  // a hint marks where the graph is not yet right: the points (values) or the segments (shape) that are off
  const offPts = hint && answer?.mode === 'values' ? xs.map((_, i) => i).filter((i) => !near(vals[i], answer.values[i], 1e-9)) : [];
  const offSegs = hint && answer?.mode === 'shape' ? graphShape(vals).map((d, i) => (d === answer.shape[i] ? -1 : i)).filter((i) => i >= 0) : [];
  const hintLine = !hint ? null : answer?.mode === 'values' ? 'העמודות המסומנות עוד לא בגובה הנכון.'
    : answer?.mode === 'shape' ? 'בקטעים המסומנים הכיוון עוד לא כמו בסיפור.' : 'בקצב אחיד כל קטע עולה או יורד באותו מספר משבצות.';
  const at = vals[sel];
  return (
    <div className={clsx('manip', 'manip-graph', good && 'good')}>
      {!test && (
        <div className="manip-readout" aria-live="polite">
          <b dir="ltr">({figNum(xs[sel])}, {figNum(at)})</b>
          {(m.x.unit || m.y.unit) && <span className="mp-graph-units">{[m.x.unit && `x ב${m.x.unit}`, m.y.unit && `y ב${m.y.unit}`].filter(Boolean).join(', ')}</span>}
        </div>
      )}
      {hintLine && <p className="manip-hint-line">{hintLine}</p>}
      <svg ref={ref} {...drag} viewBox={`0 0 ${W} ${H}`} className="manip-canvas" dir="ltr" role="group" aria-label={`גרף: ${m.y.label} לפי ${m.x.label}`}>
        <rect x="0" y="0" width={W} height={H} className="mp-hit" />
        {/* the chosen point's column: what the step buttons move */}
        {!locked && (() => { const l = Math.max(4, X(xs[sel]) - col / 2); const r = Math.min(W - 4, X(xs[sel]) + col / 2); return <rect x={l} y={TOP} width={r - l} height={BOT - TOP} rx="6" className="mp-graph-col" />; })()}
        {offPts.map((i) => <rect key={`h${i}`} x={X(xs[i]) - Math.min(col, 40) / 2 + 3} y={TOP + 2} width={Math.min(col, 40) - 6} height={BOT - TOP - 4} rx="8" className="mp-graph-hint" />)}
        <GraphAxes fr={fr} x={m.x} y={m.y} cls="mp-graph" />
        {m.ref?.label && <GraphLegend fr={fr} items={[{ label: m.ref.label, tone: 'alt', dashed: true }]} cls="mp-graph" />}
        {m.ref && (
          <g className="mp-graph-ref">
            <polyline points={m.ref.pts.map(([x, y]) => `${X(x)},${Y(y)}`).join(' ')} />
          </g>
        )}
        {ghost && (
          <g className="mp-graph-ghost">
            <polyline points={line(ghost)} />
            {ghost.map((v, i) => <circle key={i} cx={X(xs[i])} cy={Y(v)} r="8" />)}
          </g>
        )}
        <polyline points={line(vals)} className="mp-graph-line" />
        {offSegs.map((i) => <line key={`s${i}`} x1={X(xs[i])} y1={Y(vals[i])} x2={X(xs[i + 1])} y2={Y(vals[i + 1])} className="mp-graph-hint-seg" />)}
        {xs.map((x, i) => {
          const still = fixed.has(i);
          const k = Math.round((vals[i] - axisLo(m.y)) / m.y.step);
          return (
            <g key={i} ref={(el) => { pts.current[i] = el; }} className={clsx('mp-graph-pt', still && 'fixed', i === sel && !locked && 'on')}
              tabIndex={locked ? -1 : 0} role="slider" aria-orientation="vertical" aria-label={`הנקודה ב־${name(i)}`}
              aria-readonly={still || undefined}
              aria-valuemin={test ? 0 : axisLo(m.y)} aria-valuemax={test ? axisSteps(m.y) : m.y.max} aria-valuenow={test ? k : vals[i]}
              aria-valuetext={`ב־${name(i)}: ${said(i)}`}
              onFocus={() => setSel(i)} onKeyDown={keys(i)}>
              <circle cx={X(x)} cy={Y(vals[i])} r="18" className="mp-graph-ring" />
              {still ? <circle cx={X(x)} cy={Y(vals[i])} r="7" className="mp-graph-fixed" /> : (
                <>
                  <circle cx={X(x)} cy={Y(vals[i])} r="15" className="mp-halo" />
                  <circle cx={X(x)} cy={Y(vals[i])} r="9" className="mp-handle" />
                </>
              )}
            </g>
          );
        })}
      </svg>
      <div className="manip-controls">
        <Stepper label={`הנקודה ב־${figNum(xs[sel])}`} value={test ? null : figNum(at)} icons={[ArrowDown, ArrowUp]}
          onDec={() => set(sel, at - m.y.step)} onInc={() => set(sel, at + m.y.step)}
          decLabel={`להוריד את הנקודה ב־${name(sel)}`} incLabel={`להרים את הנקודה ב־${name(sel)}`}
          disabled={locked || fixed.has(sel)} decDisabled={at <= axisLo(m.y) + 1e-9} incDisabled={at >= m.y.max - 1e-9} />
      </div>
    </div>
  );
}
