// Pythagoras by building: squares stand on the two legs and on the hypotenuse, each showing its area.
// The big square's area is always the sum of the other two: changing the legs makes that visible.
import { useRef, useState } from 'react';
import { clamp, useDrag, Stepper } from './core.jsx';

// Unit geometry: right angle at (0, 0), leg a along x, leg b along y (y up); the squares stand outside.
function shapes(a, b) {
  const sqA = [[0, 0], [a, 0], [a, -a], [0, -a]];
  const sqB = [[0, 0], [0, b], [-b, b], [-b, 0]];
  const sqC = [[a, 0], [0, b], [b, a + b], [a + b, a]];
  return { sqA, sqB, sqC, box: { x0: -b, x1: a + b, y0: -a, y1: a + b } };
}

/** test: in a check, the square on the hypotenuse shows "?" and nothing marks the target as reached. */
export default function PythSquares({ m, value, onChange, locked, reveal, good, answer, hint, test = false }) {
  const { a, b } = value; const max = m.max || 12;
  const [frozen, setFrozen] = useState(null); // the frame stays still while dragging
  const which = useRef('a');
  const set = (na, nb) => { const A = clamp(na, 1, max); const B = clamp(nb, 1, max); if (!locked && (A !== a || B !== b)) onChange({ a: A, b: B }); };
  const { sqA, sqB, sqC, box } = shapes(a, b);
  const pad = 1.2;
  const vb = frozen || { x: box.x0 - pad, y: -(box.y1 + pad), w: box.x1 - box.x0 + 2 * pad, h: box.y1 - box.y0 + 2 * pad };
  const [ref, drag] = useDrag((p, phase) => {
    if (phase === 'start') { setFrozen(vb); which.current = Math.hypot(p.x - a, p.y) < Math.hypot(p.x, p.y + b) ? 'a' : 'b'; }
    if (which.current === 'a') set(Math.round(p.x), b); else set(a, Math.round(-p.y));
    if (phase === 'end') setFrozen(null);
  }, locked);
  const poly = (pts) => pts.map(([x, y]) => `${x},${-y}`).join(' ');
  const centre = (pts) => [pts.reduce((s, q) => s + q[0], 0) / 4, -pts.reduce((s, q) => s + q[1], 0) / 4];
  const unit = Math.max(vb.w, vb.h) / 22; // text and handles scale with the drawing
  const area = (sq, label, cls) => { const [cx, cy] = centre(sq); return <text x={cx} y={cy + unit * 0.4} textAnchor="middle" className={`mp-area ${cls}`} style={{ fontSize: unit * 1.15 }}>{label}</text>; };
  const target = answer.c * answer.c; const sum = a * a + b * b;
  return (
    <div className={`manip manip-squares ${good ? 'good' : ''}`}>
      {test ? (
        <div className="manip-readout" dir="ltr"><span className="sq-a">{a}²</span> + <span className="sq-b">{b}²</span> = <b className="sq-c">?</b><span className="manip-target" dir="rtl">יעד {target}</span></div>
      ) : (
        <div className="manip-readout" aria-live="polite" dir="ltr">
          <span className="sq-a">{a}²</span> + <span className="sq-b">{b}²</span> = <span className="sq-a">{a * a}</span> + <span className="sq-b">{b * b}</span> = <b className="sq-c">{sum}</b>
          <span className="manip-target" dir="rtl">יעד {target}</span>
        </div>
      )}
      <svg ref={ref} {...drag} viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} className="manip-canvas" dir="ltr" role="img"
        aria-label={test ? `משולש ישר־זווית עם ניצבים ${a} ו־${b}` : `משולש ישר־זווית עם ניצבים ${a} ו־${b}. ריבוע על היתר בשטח ${sum}`}>
        <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} className="mp-hit" />
        <polygon points={poly(sqA)} className="mp-sq a" vectorEffect="non-scaling-stroke" />
        <polygon points={poly(sqB)} className="mp-sq b" vectorEffect="non-scaling-stroke" />
        <polygon points={poly(sqC)} className={`mp-sq c ${sum === target && !test ? 'hit' : ''}`} vectorEffect="non-scaling-stroke" />
        {hint && <polygon points={poly(sqC)} className="mp-hint-sq" vectorEffect="non-scaling-stroke" />}
        <polygon points={poly([[0, 0], [a, 0], [0, b]])} className="mp-tri" vectorEffect="non-scaling-stroke" />
        <polyline points={poly([[0.7, 0], [0.7, 0.7], [0, 0.7]])} className="mp-right" vectorEffect="non-scaling-stroke" />
        {area(sqA, `${a * a}`, 'a')}
        {area(sqB, `${b * b}`, 'b')}
        {area(sqC, test ? '?' : `${sum}`, 'c')}
        <g className="mp-point"><circle cx={a} cy={0} r={unit * 0.9} className="mp-handle" /></g>
        <g className="mp-point"><circle cx={0} cy={-b} r={unit * 0.9} className="mp-handle alt" /></g>
      </svg>
      {reveal && <p className="manip-note">למשל ניצבים {answer.a} ו־{answer.b}: <bdi dir="ltr">{answer.a * answer.a} + {answer.b * answer.b} = {target}</bdi></p>}
      <div className="manip-controls">
        <Stepper label="a" sub="ניצב" value={a} onDec={() => set(a - 1, b)} onInc={() => set(a + 1, b)} decLabel="לקצר את הניצב a" incLabel="להאריך את הניצב a" disabled={locked} decDisabled={a <= 1} incDisabled={a >= max} />
        <Stepper label="b" sub="ניצב" value={b} onDec={() => set(a, b - 1)} onInc={() => set(a, b + 1)} decLabel="לקצר את הניצב b" incLabel="להאריך את הניצב b" disabled={locked} decDisabled={b <= 1} incDisabled={b >= max} />
      </div>
    </div>
  );
}
