// Adjacent angles by turning a ray: the right angle is measured live; the left one is the target, so the
// student has to think "they make a straight line together" to know where to stop.
// With `whole` (CLASSROOM-10, the angle bisector) it is a fixed angle ∢AOB of that many degrees with a ray OC turning
// inside it, in 5° steps: the value is ∢AOC, and the readout shows ∢AOC + ∢COB, so the student sees where the two halves
// meet. The same drag, arrow keys, step buttons and slider role; in a check nothing says the sizes.
import { clamp, useDrag, arrowKeys, Stepper } from './core.jsx';

const W = 360; const H = 212; const O = [180, 184]; const R = 150;
const rad = (d) => (d * Math.PI) / 180;
const at = (o) => (d, r) => [o[0] + r * Math.cos(rad(d)), o[1] - r * Math.sin(rad(d))];
const pt = at(O);
const arcAt = (p) => (a0, a1, r) => { const [x0, y0] = p(a0, r); const [x1, y1] = p(a1, r); return `M ${x0} ${y0} A ${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 0 ${x1} ${y1}`; };
const arcPath = arcAt(pt);

/** The letters drawn by default: the line's ends C and A, the vertex O. A step can name them after its own figure
 * (a triangle's vertex C and side BC, say), or leave any of them blank; `ray` names the end of the turning ray. */
const LABELS = { left: 'C', vertex: 'O', right: 'A', ray: '' };

export default function AngleTurner(props) {
  return props.m?.whole ? <WholeTurner {...props} /> : <LineTurner {...props} />;
}

function LineTurner({ m, value, onChange, locked, reveal, good, answer, hint }) {
  const L = { ...LABELS, ...(m?.labels || {}) };
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
        {L.right && <text x={O[0] + R + 4} y={O[1] + 22} textAnchor="end" className="mp-pt-label">{L.right}</text>}
        {L.left && <text x={O[0] - R - 4} y={O[1] + 22} className="mp-pt-label">{L.left}</text>}
        {L.vertex && <text x={O[0]} y={O[1] + 24} textAnchor="middle" className="mp-pt-label">{L.vertex}</text>}
        {L.ray && (() => { const [tx, ty] = pt(value, R + 22); return <text x={tx} y={ty + 6} textAnchor="middle" className="mp-pt-label">{L.ray}</text>; })()}
      </svg>
      <div className="manip-controls">
        <Stepper label="הזווית הימנית" value={`${value}°`} onDec={() => set(value - 5)} onInc={() => set(value + 5)} decLabel="להקטין את הזווית הימנית ב־5 מעלות" incLabel="להגדיל את הזווית הימנית ב־5 מעלות" disabled={locked} decDisabled={value <= 5} incDisabled={value >= 175} />
      </div>
    </div>
  );
}

// the whole angle opens upwards, symmetric about the vertical, its vertex low in the drawing
const OW = [180, 194]; const RW = 150;
const ptW = at(OW); const arcW = arcAt(ptW);

/** A fixed angle ∢AOB (`m.whole` degrees) and the ray OC turning inside it; the value is ∢AOC (5° to whole − 5°). */
function WholeTurner({ m, value, onChange, locked, reveal, good, answer, test }) {
  const w = m.whole; const d0 = 90 - w / 2; // the direction of OA; OB is at d0 + w
  const set = (d) => { const v = clamp(Math.round(d / 5) * 5, 5, w - 5); if (!locked && v !== value) onChange(v); };
  const [ref, drag] = useDrag((p) => {
    let d = (Math.atan2(OW[1] - p.y, p.x - OW[0]) * 180) / Math.PI;
    if (d < -90) d += 360; // below the vertex on the left: past OB
    set(d - d0);
  }, locked);
  const dir = d0 + value; const rest = w - value;
  const [cx, cy] = ptW(dir, RW);
  const [ax, ay] = ptW(d0, RW + 12); const [bx, by] = ptW(d0 + w, RW + 12);
  // a narrow part has its size further out, where its two arms are far enough apart for it
  const out = (deg, r) => Math.min(132, Math.max(r, 20 / Math.sin(rad(deg / 2))));
  const [l1x, l1y] = ptW(d0 + value / 2, out(value, 70)); const [l2x, l2y] = ptW(dir + rest / 2, out(rest, 58));
  const show = !test || reveal || good;
  const n = (v) => (show ? `${v}°` : '?');
  return (
    <div className={`manip manip-angle whole ${good ? 'good' : ''}`}>
      {/* the two parts always make ∢AOB together: the student sees where they are equal */}
      <div className="manip-readout" dir="ltr" aria-hidden="true">
        <span className="ang-names">∢AOC + ∢COB</span>
        <span className="ang-sum">= <span className="ang-right">{n(value)}</span> + <span className="ang-left">{n(rest)}</span> = {w}°</span>
      </div>
      <svg ref={ref} {...drag} viewBox={`0 0 ${W} ${H}`} className="manip-canvas" dir="ltr" tabIndex={locked ? -1 : 0}
        role="slider" aria-label="הקרן OC בתוך הזווית AOB" aria-valuemin={5} aria-valuemax={w - 5} aria-valuenow={value}
        aria-valuetext={show ? `הזווית AOC ${value} מעלות, הזווית COB ${rest} מעלות` : `הזווית AOC`}
        onKeyDown={arrowKeys({ left: () => set(value + 5), right: () => set(value - 5), up: () => set(value + 5), down: () => set(value - 5) })}>
        <rect x="0" y="0" width={W} height={H} className="mp-hit" />
        <path d={arcW(d0, dir, 46)} className="mp-angle-arc right" />
        <path d={arcW(dir, d0 + w, 34)} className="mp-angle-arc left" />
        <line x1={OW[0]} y1={OW[1]} x2={ax} y2={ay} className="mp-ray fixed" />
        <line x1={OW[0]} y1={OW[1]} x2={bx} y2={by} className="mp-ray fixed" />
        {reveal && answer !== value && (() => { const [gx, gy] = ptW(d0 + answer, RW); return <line x1={OW[0]} y1={OW[1]} x2={gx} y2={gy} className="mp-ghost-ray" />; })()}
        <line x1={OW[0]} y1={OW[1]} x2={cx} y2={cy} className="mp-ray" />
        <circle cx={OW[0]} cy={OW[1]} r="5" className="mp-vertex" />
        <g className="mp-point"><circle cx={cx} cy={cy} r="16" className="mp-halo" /><circle cx={cx} cy={cy} r="10" className="mp-handle" /></g>
        <text x={l1x} y={l1y + 6} textAnchor="middle" className="mp-angle-label right">{n(value)}</text>
        <text x={l2x} y={l2y + 6} textAnchor="middle" className="mp-angle-label left">{n(rest)}</text>
        {(() => { const [x, y] = ptW(d0, RW + 30); return <text x={x} y={y + 6} textAnchor="middle" className="mp-pt-label">A</text>; })()}
        {(() => { const [x, y] = ptW(d0 + w, RW + 30); return <text x={x} y={y + 6} textAnchor="middle" className="mp-pt-label">B</text>; })()}
        {(() => { const [x, y] = ptW(dir, RW + 26); return <text x={x} y={y + 6} textAnchor="middle" className="mp-pt-label">C</text>; })()}
        <text x={OW[0]} y={OW[1] + 16} textAnchor="middle" className="mp-pt-label">O</text>
      </svg>
      <div className="manip-controls">
        <Stepper label="הזווית AOC" value={show ? `${value}°` : '?'} onDec={() => set(value - 5)} onInc={() => set(value + 5)} decLabel="להקטין את הזווית AOC ב־5 מעלות" incLabel="להגדיל את הזווית AOC ב־5 מעלות" disabled={locked} decDisabled={value <= 5} incDisabled={value >= w - 5} />
      </div>
    </div>
  );
}
