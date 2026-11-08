// A triangle with one free vertex: A and B stay on the x-axis, C is dragged from one grid crossing to the next.
// The three angles follow C live, and so does their sum, which never changes: 180°.
import { clamp, useDrag, arrowKeys, Stepper, minus } from './core.jsx';
import { gridGeometry, Plane } from './grid.jsx';
import { triangleAngles, rightAtC } from '@/content/manip.js';

const deg = (d) => `${Math.round(d)}°`;

export default function TriangleDrag({ m, value, onChange, locked, reveal, good, answer, hint }) {
  const g = gridGeometry(m.range || 6);
  const { r, X, Y } = g;
  const set = (c) => { const n = [clamp(c[0], -r, r), clamp(c[1], 1, r)]; if (!locked && (n[0] !== value[0] || n[1] !== value[1])) onChange(n); };
  const [ref, drag] = useDrag((p) => set([g.toX(p.x), g.toY(p.y)]), locked);
  const [a, b, c] = triangleAngles(m, value);
  const right = rightAtC(m, value);
  const P = (q) => `${X(q[0])},${Y(q[1])}`;
  // the angle marks: an arc at A and at B, a square at C when it is right
  const arcAt = (p, q1, q2, rad) => {
    const a1 = Math.atan2(-(q1[1] - p[1]), q1[0] - p[0]); const a2 = Math.atan2(-(q2[1] - p[1]), q2[0] - p[0]);
    const [x1, y1] = [X(p[0]) + rad * Math.cos(a1), Y(p[1]) + rad * Math.sin(a1)]; const [x2, y2] = [X(p[0]) + rad * Math.cos(a2), Y(p[1]) + rad * Math.sin(a2)];
    let sweep = a2 - a1; while (sweep < 0) sweep += 2 * Math.PI;
    return `M ${x1} ${y1} A ${rad} ${rad} 0 0 ${sweep > Math.PI ? 0 : 1} ${x2} ${y2}`;
  };
  return (
    <div className={`manip manip-triangle ${good ? 'good' : ''}`}>
      <div className="manip-readout" dir="ltr" aria-live="polite">
        <span className="tri-a">∠A {deg(a)}</span> + <span className="tri-b">∠B {deg(b)}</span> + <span className={right ? 'tri-c hit' : 'tri-c'}>∠C {deg(c)}</span> = <b>180°</b>
      </div>
      <svg ref={ref} {...drag} viewBox={`0 0 ${g.size} ${g.size}`} className="manip-canvas" dir="ltr" tabIndex={locked ? -1 : 0}
        role="application" aria-roledescription="משולש" aria-label={`הקודקוד C בשיעורים ${minus(value[0])}, ${minus(value[1])}. הזווית C ${deg(c)}`}
        onKeyDown={arrowKeys({ left: () => set([value[0] - 1, value[1]]), right: () => set([value[0] + 1, value[1]]), up: () => set([value[0], value[1] + 1]), down: () => set([value[0], value[1] - 1]) })}>
        <Plane g={g}>
          {hint && <circle cx={X(0)} cy={Y(0)} r={5 * g.c} className="mp-hint-circle" />}
          {reveal && answer && (answer[0] !== value[0] || answer[1] !== value[1]) && <polygon points={`${P(m.A)} ${P(m.B)} ${P(answer)}`} className="mp-ghost-tri" />}
          <polygon points={`${P(m.A)} ${P(m.B)} ${P(value)}`} className={right ? 'mp-tri-fill hit' : 'mp-tri-fill'} />
          <path d={arcAt(m.A, m.B, value, 26)} className="mp-angle-arc tri-a" />
          <path d={arcAt(m.B, value, m.A, 26)} className="mp-angle-arc tri-b" />
          {right ? (() => {
            // the right-angle square at C
            const u = [m.A[0] - value[0], m.A[1] - value[1]]; const v = [m.B[0] - value[0], m.B[1] - value[1]];
            const lu = Math.hypot(...u); const lv = Math.hypot(...v); const s = 0.7;
            const p1 = [value[0] + (u[0] / lu) * s, value[1] + (u[1] / lu) * s]; const p3 = [value[0] + (v[0] / lv) * s, value[1] + (v[1] / lv) * s];
            const p2 = [p1[0] + (v[0] / lv) * s, p1[1] + (v[1] / lv) * s];
            return <polyline points={`${P(p1)} ${P(p2)} ${P(p3)}`} className="mp-right-mark" />;
          })() : <path d={arcAt(value, m.A, m.B, 22)} className="mp-angle-arc tri-c" />}
          {[['A', m.A, 'end', -10, -10], ['B', m.B, 'start', 10, -10]].map(([l, q, anchor, dx, dy]) => (
            <g key={l}><circle cx={X(q[0])} cy={Y(q[1])} r="5" className="mp-vertex" /><text x={X(q[0]) + dx} y={Y(q[1]) + dy} textAnchor={anchor} className="mp-pt-label">{l}</text></g>
          ))}
          <g className="mp-point">
            <circle cx={X(value[0])} cy={Y(value[1])} r="14" className="mp-halo" />
            <circle cx={X(value[0])} cy={Y(value[1])} r="8" className="mp-handle" />
            <text x={X(value[0])} y={Y(value[1]) - 18} textAnchor="middle" className="mp-pt-label">C</text>
          </g>
        </Plane>
      </svg>
      <div className="manip-controls">
        <Stepper label="x" sub="הקודקוד C לאורך ציר" icons={undefined} onDec={() => set([value[0] - 1, value[1]])} onInc={() => set([value[0] + 1, value[1]])} decLabel="C שמאלה" incLabel="C ימינה" disabled={locked} decDisabled={value[0] <= -r} incDisabled={value[0] >= r} />
        <Stepper label="y" sub="הקודקוד C לאורך ציר" onDec={() => set([value[0], value[1] - 1])} onInc={() => set([value[0], value[1] + 1])} decLabel="C למטה" incLabel="C למעלה" disabled={locked} decDisabled={value[1] <= 1} incDisabled={value[1] >= r} />
      </div>
    </div>
  );
}
