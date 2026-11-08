// Signed numbers on a number line: the marker starts at `from`; an arc above the line shows the jump
// (+4, −3) live, so the operation is something the student sees, not only computes.
import { clamp, useDrag, arrowKeys, Stepper, minus } from './core.jsx';

const W = 360; const H = 224; const PAD = 20; const LINE = 166;

export default function NumberLine({ m, value, onChange, locked, reveal, good, answer, hint }) {
  const { min, max, from } = m;
  const step = (W - 2 * PAD) / (max - min);
  const X = (v) => PAD + (v - min) * step;
  const toV = (x) => clamp(Math.round(min + (x - PAD) / step), min, max);
  const set = (v) => { if (!locked && v !== value) onChange(clamp(v, min, max)); };
  const [ref, drag] = useDrag((p) => set(toV(p.x)), locked);
  const jump = value - from;
  const arc = (a, b, lift) => `M ${X(a)} ${LINE - 8} Q ${(X(a) + X(b)) / 2} ${LINE - 8 - lift} ${X(b)} ${LINE - 8}`;
  const lift = (n) => Math.min(112, 26 + Math.abs(n) * 8);
  const ticks = []; for (let v = min; v <= max; v += 1) ticks.push(v);
  const state = good ? 'good' : '';
  return (
    <div className={`manip manip-numberline ${state}`}>
      <svg ref={ref} {...drag} viewBox={`0 0 ${W} ${H}`} className="manip-canvas" dir="ltr" tabIndex={locked ? -1 : 0}
        role="slider" aria-label="הסמן על ציר המספרים" aria-valuemin={min} aria-valuemax={max} aria-valuenow={value}
        aria-valuetext={`${minus(value)}, קפיצה של ${jump > 0 ? '+' : ''}${minus(jump)} מ־${minus(from)}`}
        onKeyDown={arrowKeys({ left: () => set(value - 1), right: () => set(value + 1), home: () => set(min), end: () => set(max) })}>
        {/* the valley of frost and fire: below zero is cold, above zero is warm (like a thermometer) */}
        <defs>
          <linearGradient id="nl-temp" x1="0" x2={W} y1="0" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0" className="nl-cold" /><stop offset={X(0) / W} className="nl-zero" /><stop offset="1" className="nl-warm" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width={W} height={H} fill="url(#nl-temp)" />
        <g className="nl-frost" transform="translate(28 30)" aria-hidden="true"><path d="M0 -11 V11 M-9.5 -5.5 L9.5 5.5 M-9.5 5.5 L9.5 -5.5 M-3 -8 L0 -11 L3 -8 M-3 8 L0 11 L3 8" /></g>
        <g className="nl-fire" transform={`translate(${W - 28} 30)`} aria-hidden="true"><path d="M0 12 C-9 12 -11 4 -7 -3 C-5 1 -3 2 -2 1 C-4 -5 -1 -10 3 -13 C3 -7 10 -3 9 4 C8 9 5 12 0 12 Z" /></g>
        <rect x="0" y="0" width={W} height={H} className="mp-hit" />
        {/* the jump from the start to the marker */}
        {jump !== 0 && <path d={arc(from, value, lift(jump))} className="mp-arc" />}
        {jump !== 0 && <text x={(X(from) + X(value)) / 2} y={LINE - 14 - lift(jump) / 2} textAnchor="middle" className="mp-jump">{jump > 0 ? '+' : ''}{minus(jump)}</text>}
        {reveal && answer !== value && <path d={arc(from, answer, lift(answer - from))} className="mp-arc ghost" />}
        <line x1={PAD - 12} y1={LINE} x2={W - PAD + 12} y2={LINE} className="mp-axis" />
        <path d={`M ${W - PAD + 14} ${LINE} l -8 -5 v 10 z`} className="mp-axis-head" />
        {ticks.map((v) => (
          <g key={v}>
            <line x1={X(v)} y1={LINE - (v === 0 ? 9 : 5)} x2={X(v)} y2={LINE + (v === 0 ? 9 : 5)} className={v === 0 ? 'mp-tick zero' : 'mp-tick'} />
            {(v % 2 === 0) && <text x={X(v)} y={LINE + 24} textAnchor="middle" className={v === 0 ? 'mp-num zero' : 'mp-num'}>{minus(v)}</text>}
          </g>
        ))}
        {/* the hint, drawn on the line: which way the marker goes from the start (not how far) */}
        {hint && answer !== from && (() => { const dir = answer > from ? 1 : -1; const x0 = X(from); const x1 = x0 + dir * 2.2 * step; return (
          <g className="mp-hint">
            <path d={`M ${x0} ${LINE + 34} H ${x1}`} /><path d={`M ${x1} ${LINE + 34} l ${-dir * 8} -6 v 12 z`} className="fill" />
            <text x={(x0 + x1) / 2} y={LINE + 54} textAnchor="middle">{dir > 0 ? 'ימינה' : 'שמאלה'}</text>
          </g>); })()}
        {/* where the jump starts */}
        <circle cx={X(from)} cy={LINE} r="6" className="mp-from" />
        {reveal && answer !== value && <g className="mp-ghost-pin" transform={`translate(${X(answer)} ${LINE})`}><circle r="9" /><text y="44" textAnchor="middle">{minus(answer)}</text></g>}
        {/* the marker the student moves */}
        <g className="mp-pin" transform={`translate(${X(value)} ${LINE})`}>
          <path d="M 0 -6 C -12 -18 -12 -32 0 -34 C 12 -32 12 -18 0 -6 Z" />
          <circle r="7.5" className="mp-pin-dot" />
        </g>
      </svg>
      <div className="manip-controls">
        <Stepper label="הסמן" value={minus(value)} onDec={() => set(value - 1)} onInc={() => set(value + 1)} decLabel="הסמן שמאלה" incLabel="הסמן ימינה" disabled={locked} decDisabled={value <= min} incDisabled={value >= max} />
      </div>
    </div>
  );
}
