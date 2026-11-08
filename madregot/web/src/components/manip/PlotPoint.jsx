// Putting a point on the plane: tap a grid crossing or drag the point. Dashed guides to both axes show
// how far right/left and up/down it is, without printing its coordinates (that is the student's job).
import { ArrowLeft, ArrowRight, ArrowDown, ArrowUp } from 'lucide-react';
import { clamp, useDrag, arrowKeys, Stepper, minus } from './core.jsx';
import { gridGeometry, Plane } from './grid.jsx';

const QUAD_RECT = { 1: [1, 1], 2: [-1, 1], 3: [-1, -1], 4: [1, -1] };

export default function PlotPoint({ m, value, onChange, locked, reveal, good, answer }) {
  const g = gridGeometry(m.range || 6);
  const { r, X, Y, o } = g;
  const set = (p) => { if (!locked && (!value || p[0] !== value[0] || p[1] !== value[1])) onChange([clamp(p[0], -r, r), clamp(p[1], -r, r)]); };
  const [ref, drag] = useDrag((p) => set([g.toX(p.x), g.toY(p.y)]), locked);
  const cur = value || [0, 0];
  const move = (dx, dy) => set([cur[0] + dx, cur[1] + dy]);
  const quad = m.quadrant && QUAD_RECT[m.quadrant];
  return (
    <div className={`manip manip-plot ${good ? 'good' : ''}`}>
      <svg ref={ref} {...drag} viewBox={`0 0 ${g.size} ${g.size}`} className="manip-canvas" dir="ltr" tabIndex={locked ? -1 : 0}
        role="application" aria-roledescription="מערכת צירים" aria-label={value ? `הנקודה ${m.label} בשיעורים ${minus(value[0])}, ${minus(value[1])}` : `מערכת צירים. הקישו כדי לשים את הנקודה ${m.label}, או השתמשו בחצים`}
        onKeyDown={arrowKeys({ left: () => move(-1, 0), right: () => move(1, 0), up: () => move(0, 1), down: () => move(0, -1) })}>
        <Plane g={g}>
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
