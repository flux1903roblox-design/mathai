// Putting a point on the plane: tap a grid crossing or drag the point. Dashed guides to both axes show
// how far right/left and up/down it is, without printing its coordinates (that is the student's job).
// With m.lines (two lines {m, b}) both are drawn with their equations, and the point to put is where they meet.
import { ArrowLeft, ArrowRight, ArrowDown, ArrowUp } from 'lucide-react';
import { clamp, useDrag, arrowKeys, Stepper, minus } from './core.jsx';
import { gridGeometry, Plane } from './grid.jsx';
import { lineTex } from './LineBuilder.jsx';
import { Tex } from '../MathText.jsx';

const QUAD_RECT = { 1: [1, 1], 2: [-1, 1], 3: [-1, -1], 4: [1, -1] };

export default function PlotPoint({ m, value, onChange, locked, reveal, good, answer, hint }) {
  const g = gridGeometry(m.range || 6);
  const { r, X, Y, o } = g;
  const set = (p) => { if (!locked && (!value || p[0] !== value[0] || p[1] !== value[1])) onChange([clamp(p[0], -r, r), clamp(p[1], -r, r)]); };
  const [ref, drag] = useDrag((p) => set([g.toX(p.x), g.toY(p.y)]), locked);
  const cur = value || [0, 0];
  const move = (dx, dy) => set([cur[0] + dx, cur[1] + dy]);
  const quad = m.quadrant && QUAD_RECT[m.quadrant];
  return (
    <div className={`manip manip-plot ${good ? 'good' : ''}`}>
      {/* two lines: their equations as a legend, each beside its own stroke (solid, dashed) */}
      {m.lines && (
        <div className="manip-legend mp-lines-legend" dir="ltr">
          {m.lines.map((L, i) => <span key={i} className={i === 0 ? 'lg line' : 'lg line two'}><Tex tex={lineTex(L)} /></span>)}
        </div>
      )}
      <svg ref={ref} {...drag} viewBox={`0 0 ${g.size} ${g.size}`} className="manip-canvas" dir="ltr" tabIndex={locked ? -1 : 0}
        role="application" aria-roledescription="מערכת צירים" aria-label={value ? `הנקודה${m.label ? ` ${m.label}` : ''} בשיעורים ${minus(value[0])}, ${minus(value[1])}` : `מערכת צירים. הקישו כדי לשים את הנקודה${m.label ? ` ${m.label}` : ''}, או השתמשו בחצים`}
        onKeyDown={arrowKeys({ left: () => move(-1, 0), right: () => move(1, 0), up: () => move(0, 1), down: () => move(0, -1) })}>
        <Plane g={g}>
          {/* a line to find a point on, or the given corners of a shape to complete */}
          {m.line && (() => {
            const e = (x) => [X(x), Y(m.line.m * x + m.line.b)];
            const [x1, y1] = e(-r - 0.5); const [x2, y2] = e(r + 0.5);
            return (<>
              <defs><clipPath id="pp-clip"><rect x={X(-r - 0.5)} y={Y(r + 0.5)} width={(2 * r + 1) * g.c} height={(2 * r + 1) * g.c} /></clipPath></defs>
              <line x1={x1} y1={y1} x2={x2} y2={y2} className="mp-line" clipPath="url(#pp-clip)" />
            </>);
          })()}
          {m.lines && (<>
            <defs><clipPath id="pp-clip2"><rect x={X(-r - 0.5)} y={Y(r + 0.5)} width={(2 * r + 1) * g.c} height={(2 * r + 1) * g.c} /></clipPath></defs>
            {m.lines.map((L, i) => (
              <line key={i} x1={X(-r - 0.5)} y1={Y(L.m * (-r - 0.5) + L.b)} x2={X(r + 0.5)} y2={Y(L.m * (r + 0.5) + L.b)} className={i === 0 ? 'mp-line' : 'mp-line two'} clipPath="url(#pp-clip2)" />
            ))}
          </>)}
          {m.shape && (
            <g className="mp-shape">
              <polyline points={m.shape.map((q) => `${X(q.at[0])},${Y(q.at[1])}`).join(' ')} className="mp-shape-edge" />
              {value && <polyline points={`${X(m.shape[m.shape.length - 1].at[0])},${Y(m.shape[m.shape.length - 1].at[1])} ${X(value[0])},${Y(value[1])} ${X(m.shape[0].at[0])},${Y(m.shape[0].at[1])}`} className="mp-shape-open" />}
              {m.shape.map((q) => (
                <g key={q.label}>
                  <circle cx={X(q.at[0])} cy={Y(q.at[1])} r="6" className="mp-shape-pt" />
                  <text x={X(q.at[0]) + (q.at[0] >= 0 ? 10 : -10)} y={Y(q.at[1]) + (q.at[1] >= 0 ? -10 : 20)} textAnchor={q.at[0] >= 0 ? 'start' : 'end'} className="mp-pt-label">{q.label}</text>
                </g>
              ))}
            </g>
          )}
          {hint && quad && (
            <g className="mp-hint">{[[1, 1, 'I'], [2, -1, 'II'], [3, -1, 'III'], [4, 1, 'IV']].map(([q, sx]) => {
              const sy = q <= 2 ? 1 : -1;
              return <text key={q} x={X(sx * r * 0.55)} y={Y(sy * r * 0.55) + 8} textAnchor="middle" className="big">{['', 'ראשון', 'שני', 'שלישי', 'רביעי'][q]}</text>;
            })}</g>
          )}
          {hint && !quad && (
            <g className="mp-hint">
              <rect x={X(-r - 0.5)} y={o - 9} width={(2 * r + 1) * g.c} height="18" rx="9" className="band" />
              <text x={X(-r)} y={o - 14} textAnchor="end" direction="rtl">קודם לאורך ציר x</text>
            </g>
          )}
          {reveal && quad && <rect x={quad[0] > 0 ? o : X(-r - 0.5)} y={quad[1] > 0 ? Y(r + 0.5) : o} width={(r + 0.5) * g.c} height={(r + 0.5) * g.c} className="mp-ghost-area" />}
          {reveal && !quad && answer && (!value || answer[0] !== value[0] || answer[1] !== value[1]) && (
            <g className="mp-ghost-pt"><circle cx={X(answer[0])} cy={Y(answer[1])} r="9" /><text x={X(answer[0]) + 12} y={Y(answer[1]) - 10}>{m.label}</text></g>
          )}
          {value && (
            <g className="mp-point">
              <line x1={X(value[0])} y1={Y(value[1])} x2={X(value[0])} y2={o} className="mp-guide" />
              <line x1={X(value[0])} y1={Y(value[1])} x2={o} y2={Y(value[1])} className="mp-guide" />
              <circle cx={X(value[0])} cy={Y(value[1])} r="13" className="mp-halo" />
              <circle cx={X(value[0])} cy={Y(value[1])} r="8" className="mp-handle" />
              <text x={X(value[0]) + (value[0] >= 0 ? 13 : -13)} y={value[1] >= 0 ? Y(value[1]) - 12 : Y(value[1]) + 24} textAnchor={value[0] >= 0 ? 'start' : 'end'} className="mp-pt-label">{m.label}</text>
            </g>
          )}
        </Plane>
      </svg>
      <div className="manip-controls">
        <Stepper label="x" sub="לאורך ציר" icons={[ArrowLeft, ArrowRight]} onDec={() => move(-1, 0)} onInc={() => move(1, 0)} decLabel="הנקודה שמאלה" incLabel="הנקודה ימינה" disabled={locked} decDisabled={cur[0] <= -r} incDisabled={cur[0] >= r} />
        <Stepper label="y" sub="לאורך ציר" icons={[ArrowDown, ArrowUp]} onDec={() => move(0, -1)} onInc={() => move(0, 1)} decLabel="הנקודה למטה" incLabel="הנקודה למעלה" disabled={locked} decDisabled={cur[1] <= -r} incDisabled={cur[1] >= r} />
      </div>
    </div>
  );
}
