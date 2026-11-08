// Ordering by placing: several labelled markers, each dragged to its own number on the line. The order of the
// numbers is then something the student sees (smaller to the left). A drag moves the marker nearest the finger;
// the chips under the line choose which marker the step buttons and the arrow keys move.
import { useRef, useState } from 'react';
import clsx from 'clsx';
import { clamp, useDrag, arrowKeys, Stepper, minus } from './core.jsx';

const W = 360; const H = 196; const PAD = 20; const LINE = 150;
const TONES = ['a', 'b', 'c', 'd'];

export default function NumberPins({ m, value, onChange, locked, reveal, good, answer, hint }) {
  const { min, max, labels } = m;
  const [sel, setSel] = useState(0);
  const grab = useRef(0);
  const step = (W - 2 * PAD) / (max - min);
  const X = (v) => PAD + (v - min) * step;
  const toV = (x) => clamp(Math.round(min + (x - PAD) / step), min, max);
  const setAt = (i, v) => {
    if (locked) return;
    const next = value.map((p, k) => (k === i ? clamp(v, min, max) : p));
    if (next[i] !== value[i]) onChange(next);
  };
  const [ref, drag] = useDrag((p, phase) => {
    if (phase === 'start') {
      // the marker nearest the touch (by its head, which stands above the line)
      let best = 0; let d = Infinity;
      value.forEach((v, i) => { const dd = Math.hypot(p.x - X(v), (p.y - (LINE - 24)) * 0.6); if (dd < d) { d = dd; best = i; } });
      grab.current = best; setSel(best);
    }
    setAt(grab.current, toV(p.x));
  }, locked);
  const ticks = []; for (let v = min; v <= max; v += 1) ticks.push(v);
  // markers on the same or neighbouring places (their heads are wider than one step) stack upwards
  const lift = value.map((v, i) => value.slice(0, i).filter((w) => Math.abs(w - v) * step < 48).length);
  return (
    <div className={clsx('manip', 'manip-pins', good && 'good')}>
      <svg ref={ref} {...drag} viewBox={`0 0 ${W} ${H}`} className="manip-canvas" dir="ltr" tabIndex={locked ? -1 : 0}
        role="slider" aria-label={`הסמן ${labels[sel]} על ציר המספרים`} aria-valuemin={min} aria-valuemax={max} aria-valuenow={value[sel]}
        aria-valuetext={`הסמן ${labels[sel]} על ${minus(value[sel])}`}
        onKeyDown={arrowKeys({ left: () => setAt(sel, value[sel] - 1), right: () => setAt(sel, value[sel] + 1), up: () => setSel((sel + 1) % labels.length), down: () => setSel((sel + labels.length - 1) % labels.length) })}>
        <defs>
          <linearGradient id="np-temp" x1="0" x2={W} y1="0" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0" className="nl-cold" /><stop offset={X(0) / W} className="nl-zero" /><stop offset="1" className="nl-warm" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width={W} height={H} fill="url(#np-temp)" />
        <rect x="0" y="0" width={W} height={H} className="mp-hit" />
        {hint && <g className="mp-hint"><path d={`M ${X(0)} ${LINE + 40} H ${X(min) + 6}`} /><path d={`M ${X(min) + 6} ${LINE + 40} l 8 -6 v 12 z`} className="fill" /><text x={X(0) - 8} y={LINE + 34} textAnchor="end" direction="rtl">קטן יותר</text></g>}
        <line x1={PAD - 12} y1={LINE} x2={W - PAD + 12} y2={LINE} className="mp-axis" />
        <path d={`M ${W - PAD + 14} ${LINE} l -8 -5 v 10 z`} className="mp-axis-head" />
        {ticks.map((v) => (
          <g key={v}>
            <line x1={X(v)} y1={LINE - (v === 0 ? 9 : 5)} x2={X(v)} y2={LINE + (v === 0 ? 9 : 5)} className={v === 0 ? 'mp-tick zero' : 'mp-tick'} />
            {v % 2 === 0 && <text x={X(v)} y={LINE + 24} textAnchor="middle" className={v === 0 ? 'mp-num zero' : 'mp-num'}>{minus(v)}</text>}
          </g>
        ))}
        {reveal && answer.map((a, i) => (a !== value[i] ? <g key={`g${i}`} className="mp-ghost-pin" transform={`translate(${X(a)} ${LINE})`}><circle r="9" /></g> : null))}
        {value.map((v, i) => (
          <g key={i} className={clsx('np-pin', `tone-${TONES[i]}`, i === sel && !locked && 'on')} transform={`translate(${X(v)} ${LINE - lift[i] * 30})`}>
            <path d="M 0 -6 L -7 -16 H -17 a 6 6 0 0 1 -6 -6 V -36 a 6 6 0 0 1 6 -6 H 17 a 6 6 0 0 1 6 6 V -22 a 6 6 0 0 1 -6 6 H 7 Z" />
            <text y="-24" textAnchor="middle">{labels[i]}</text>
            <circle r="5" className="np-dot" />
          </g>
        ))}
      </svg>
      <div className="manip-controls">
        <div className="np-chips" role="radiogroup" aria-label="איזה סמן מזיזים">
          {labels.map((l, i) => (
            <button key={i} type="button" role="radio" aria-checked={i === sel} className={clsx('np-chip', `tone-${TONES[i]}`, i === sel && 'on')} onClick={() => setSel(i)} disabled={locked}><bdi dir="ltr">{l}</bdi></button>
          ))}
        </div>
        <Stepper label={`הסמן ${labels[sel]}`} value={minus(value[sel])} onDec={() => setAt(sel, value[sel] - 1)} onInc={() => setAt(sel, value[sel] + 1)} decLabel={`הסמן ${labels[sel]} שמאלה`} incLabel={`הסמן ${labels[sel]} ימינה`} disabled={locked} decDisabled={value[sel] <= min} incDisabled={value[sel] >= max} />
      </div>
    </div>
  );
}
