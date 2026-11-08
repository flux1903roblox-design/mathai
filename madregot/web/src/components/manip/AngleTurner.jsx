// Adjacent angles by turning a ray: the right angle is measured live; the left one is the target, so the
// student has to think "they make a straight line together" to know where to stop.
import { clamp, useDrag, arrowKeys, Stepper } from './core.jsx';

const W = 360; const H = 212; const O = [180, 184]; const R = 150;
const rad = (d) => (d * Math.PI) / 180;
const pt = (d, r) => [O[0] + r * Math.cos(rad(d)), O[1] - r * Math.sin(rad(d))];
const arcPath = (a0, a1, r) => { const [x0, y0] = pt(a0, r); const [x1, y1] = pt(a1, r); return `M ${x0} ${y0} A ${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 0 ${x1} ${y1}`; };

export default function AngleTurner({ m, value, onChange, locked, reveal, good, answer, hint }) {
  const set = (d) => { const v = clamp(Math.round(d / 5) * 5, 5, 175); if (!locked && v !== value) onChange(v); };
  const [ref, drag] = useDrag((p) => {
    const d = (Math.atan2(O[1] - p.y, p.x - O[0]) * 180) / Math.PI;
    set(d < 0 ? (d < -90 ? 175 : 5) : d);
  }, locked);
  const [bx, by] = pt(value, R);
  const mid = (a, b, r) => pt((a + b) / 2, r);
  const [rx, ry] = mid(0, value, 66); const [lx, ly] = mid(value, 180, 52);
  return (
    <div className={`manip manip-angle ${good ? 'good' : ''}`}>
      {/* the two angles always make a straight line together */}
      <div className="manip-readout" dir="ltr" aria-hidden="true"><span className="ang-right">{value}°</span> + <span className="ang-left">{reveal || good ? `${180 - value}°` : '?'}</span> = 180°</div>
      <svg ref={ref} {...drag} viewBox={`0 0 ${W} ${H}`} className="manip-canvas" dir="ltr" tabIndex={locked ? -1 : 0}
        role="slider" aria-label="הזווית הימנית" aria-valuemin={5} aria-valuemax={175} aria-valuenow={value} aria-valuetext={`הזווית הימנית ${value} מעלות`}
        onKeyDown={arrowKeys({ left: () => set(value + 5), right: () => set(value - 5), up: () => set(value + 5), down: () => set(value - 5) })}>
        <rect x="0" y="0" width={W} height={H} className="mp-hit" />
        {hint && <g className="mp-hint"><path d={arcPath(0, 180, 92)} /><text x={pt(160, 104)[0]} y={pt(160, 104)[1] - 6} textAnchor="middle" direction="rtl">180° יחד</text></g>}
        <path d={arcPath(0, value, 46)} className="mp-angle-arc right" />
        <path d={arcPath(value, 180, 34)} className="mp-angle-arc left" />
        <line x1={O[0] - R - 14} y1={O[1]} x2={O[0] + R + 14} y2={O[1]} className="mp-ray fixed" />
        {reveal && answer !== value && (() => { const [gx, gy] = pt(answer, R); return <line x1={O[0]} y1={O[1]} x2={gx} y2={gy} className="mp-ghost-ray" />; })()}
        <line x1={O[0]} y1={O[1]} x2={bx} y2={by} className="mp-ray" />
        <circle cx={O[0]} cy={O[1]} r="5" className="mp-vertex" />
        <g className="mp-point"><circle cx={bx} cy={by} r="16" className="mp-halo" /><circle cx={bx} cy={by} r="10" className="mp-handle" /></g>
        <text x={rx} y={ry + 6} textAnchor="middle" className="mp-angle-label right">{value}°</text>
        <text x={lx} y={ly + 6} textAnchor="middle" className="mp-angle-label left">{reveal || good ? `${180 - value}°` : '?'}</text>
        <text x={O[0] + R + 4} y={O[1] + 22} textAnchor="end" className="mp-pt-label">A</text>
        <text x={O[0] - R - 4} y={O[1] + 22} className="mp-pt-label">C</text>
        <text x={O[0]} y={O[1] + 24} textAnchor="middle" className="mp-pt-label">O</text>
      </svg>
      <div className="manip-controls">
        <Stepper label="הזווית הימנית" value={`${value}°`} onDec={() => set(value - 5)} onInc={() => set(value + 5)} decLabel="להקטין את הזווית הימנית ב־5 מעלות" incLabel="להגדיל את הזווית הימנית ב־5 מעלות" disabled={locked} decDisabled={value <= 5} incDisabled={value >= 175} />
      </div>
    </div>
  );
}
