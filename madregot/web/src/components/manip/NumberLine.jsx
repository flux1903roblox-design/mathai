// Signed numbers on a number line: the marker starts at `from`; an arc above the line shows the jump
// (+4, −3) live, so the operation is something the student sees, not only computes.
// With `den` every unit is cut into den equal parts: the marker moves one part at a time, the labels stay on the whole
// numbers (the student counts parts), and the step label and the arc write the value as counted, \frac{5}{3} (or as a
// decimal with fmt: 'dec'). In a check (`test`) such a line shows no value at all: the step label and the arc's number
// are left out, and a screen reader hears the ticks counted ("5 שנתות ימינה מ־0"), so "put the marker on 5/3" is
// answered by counting thirds, never by reading a label.
import { clamp, useDrag, arrowKeys, Stepper, minus, SvgLabel, partsTex, partsOf, decText } from './core.jsx';
import { Tex } from '../MathText.jsx';
import { lineNum, ticksWords } from '@/content/manip.js';

const W = 360; const H = 224; const PAD = 20; const LINE = 166;

export default function NumberLine({ m, value, onChange, locked, reveal, good, answer, hint, test = false }) {
  const { min, max, from, den } = m;
  const parts = den || 1;
  const unit = (W - 2 * PAD) / (max - min); // px per whole unit
  const tick = unit / parts; // px per part
  const X = (v) => PAD + (v - min) * unit;
  // values are k/den: a move is a whole number of parts from min, and every value is rebuilt from that count
  const snap = (v) => clamp(min + Math.round((v - min) * parts) / parts, min, max);
  const toV = (x) => snap(min + (x - PAD) / unit);
  const set = (v) => { const n = snap(v); if (!locked && Math.abs(n - value) > 1e-9) onChange(n); };
  const [ref, drag] = useDrag((p) => set(toV(p.x)), locked);
  const jump = value - from;
  const moved = Math.abs(jump) > 1e-9;
  const arc = (a, b, lift) => `M ${X(a)} ${LINE - 8} Q ${(X(a) + X(b)) / 2} ${LINE - 8 - lift} ${X(b)} ${LINE - 8}`;
  // the arc rises with the jump's length on the drawing (a whole line keeps its old heights)
  const lift = (n) => (den ? Math.min(96, 24 + Math.abs(n) * unit * 0.32) : Math.min(112, 26 + Math.abs(n) * 8));
  const ticks = []; for (let i = 0; i <= Math.round((max - min) * parts); i += 1) ticks.push(min + i / parts);
  const whole = (v) => Math.abs(v - Math.round(v)) < 1e-9;
  // a whole line labels every other number (it runs −10..10); a cut line labels every whole number
  const labelled = (v) => whole(v) && (den ? true : Math.round(v) % 2 === 0);
  const asFrac = !!den && m.fmt !== 'dec';
  // the value as written in the step label, as counted from 0 (TeX for a fraction)
  const valueTex = !den ? minus(value) : asFrac ? partsTex(partsOf(value, parts), parts) : decText(value);
  const jumpLabel = !den ? `${jump > 0 ? '+' : ''}${minus(jump)}` : asFrac ? partsTex(partsOf(jump, parts), parts) : `${jump > 0 ? '+' : ''}${decText(jump)}`;
  const answerLabel = !den ? minus(answer) : asFrac ? partsTex(partsOf(answer, parts), parts) : decText(answer);
  const cold = !den || min < 0; // the frost and fire are for signed numbers; a cut line from 0 has a plain ground
  const hidden = test && !!den; // a cut line in a check shows no value
  const valuetext = den
    ? (hidden ? ticksWords(m, value, from) : `${lineNum(m, value)}, ${ticksWords(m, value, from)}`)
    : `${minus(value)}, קפיצה של ${jump > 0 ? '+' : ''}${minus(jump)} מ־${minus(from)}`;
  const missed = reveal && Math.abs(answer - value) > 1e-9;
  return (
    <div className={`manip manip-numberline ${den ? 'cut' : ''} ${good ? 'good' : ''}`}>
      <svg ref={ref} {...drag} viewBox={`0 0 ${W} ${H}`} className="manip-canvas" dir="ltr" tabIndex={locked ? -1 : 0}
        role="slider" aria-label="הסמן על ציר המספרים"
        aria-valuemin={den ? 0 : min} aria-valuemax={den ? Math.round((max - min) * parts) : max} aria-valuenow={den ? partsOf(value, parts, min) : value}
        aria-valuetext={valuetext}
        onKeyDown={arrowKeys({ left: () => set(value - 1 / parts), right: () => set(value + 1 / parts), home: () => set(min), end: () => set(max) })}>
        {/* the valley of frost and fire: below zero is cold, above zero is warm (like a thermometer) */}
        {cold && (
          <>
            <defs>
              <linearGradient id="nl-temp" x1="0" x2={W} y1="0" y2="0" gradientUnits="userSpaceOnUse">
                <stop offset="0" className="nl-cold" /><stop offset={X(0) / W} className="nl-zero" /><stop offset="1" className="nl-warm" />
              </linearGradient>
            </defs>
            <rect x="0" y="0" width={W} height={H} fill="url(#nl-temp)" />
            <g className="nl-frost" transform="translate(28 30)" aria-hidden="true"><path d="M0 -11 V11 M-9.5 -5.5 L9.5 5.5 M-9.5 5.5 L9.5 -5.5 M-3 -8 L0 -11 L3 -8 M-3 8 L0 11 L3 8" /></g>
            <g className="nl-fire" transform={`translate(${W - 28} 30)`} aria-hidden="true"><path d="M0 12 C-9 12 -11 4 -7 -3 C-5 1 -3 2 -2 1 C-4 -5 -1 -10 3 -13 C3 -7 10 -3 9 4 C8 9 5 12 0 12 Z" /></g>
          </>
        )}
        <rect x="0" y="0" width={W} height={H} className="mp-hit" />
        {/* the jump from the start to the marker */}
        {moved && <path d={arc(from, value, lift(jump))} className="mp-arc" />}
        {moved && !hidden && (asFrac
          ? <SvgLabel x={(X(from) + X(value)) / 2} y={LINE - 28 - lift(jump) / 2} text={jumpLabel} className="mp-jump" />
          : <text x={(X(from) + X(value)) / 2} y={LINE - 14 - lift(jump) / 2} textAnchor="middle" className="mp-jump">{jumpLabel}</text>)}
        {missed && <path d={arc(from, answer, lift(answer - from))} className="mp-arc ghost" />}
        <line x1={PAD - 12} y1={LINE} x2={W - PAD + 12} y2={LINE} className="mp-axis" />
        <path d={`M ${W - PAD + 14} ${LINE} l -8 -5 v 10 z`} className="mp-axis-head" />
        {ticks.map((v) => {
          const zero = Math.abs(v) < 1e-9; const big = whole(v);
          const h = zero || (den && big) ? 9 : 5;
          return (
            <g key={v.toFixed(6)}>
              <line x1={X(v)} y1={LINE - h} x2={X(v)} y2={LINE + h} className={zero ? 'mp-tick zero' : big || !den ? 'mp-tick' : 'mp-tick part'} />
              {labelled(v) && <text x={X(v)} y={LINE + (den ? 28 : 24)} textAnchor="middle" className={zero ? 'mp-num zero' : 'mp-num'}>{minus(Math.round(v))}</text>}
            </g>
          );
        })}
        {/* the hint, drawn on the line: which way the marker goes from the start (not how far) */}
        {hint && Math.abs(answer - from) > 1e-9 && (() => { const dir = answer > from ? 1 : -1; const x0 = X(from); const x1 = x0 + dir * Math.min(2.2 * tick, 64); return (
          <g className="mp-hint">
            <path d={`M ${x0} ${LINE + 34} H ${x1}`} /><path d={`M ${x1} ${LINE + 34} l ${-dir * 8} -6 v 12 z`} className="fill" />
            <text x={(x0 + x1) / 2} y={LINE + 54} textAnchor="middle">{dir > 0 ? 'ימינה' : 'שמאלה'}</text>
          </g>); })()}
        {/* where the jump starts */}
        <circle cx={X(from)} cy={LINE} r="6" className="mp-from" />
        {missed && (
          <g className="mp-ghost-pin" transform={`translate(${X(answer)} ${LINE})`}>
            <circle r="9" />
            {asFrac ? <SvgLabel x={0} y={36} text={answerLabel} className="mp-ghost-num" /> : <text y="44" textAnchor="middle">{answerLabel}</text>}
          </g>
        )}
        {/* the marker the student moves */}
        <g className="mp-pin" transform={`translate(${X(value)} ${LINE})`}>
          <path d="M 0 -6 C -12 -18 -12 -32 0 -34 C 12 -32 12 -18 0 -6 Z" />
          <circle r="7.5" className="mp-pin-dot" />
        </g>
      </svg>
      <div className="manip-controls">
        <Stepper label="הסמן" value={hidden ? null : asFrac ? <Tex tex={valueTex} /> : valueTex}
          onDec={() => set(value - 1 / parts)} onInc={() => set(value + 1 / parts)}
          decLabel={den ? 'הסמן חלק אחד שמאלה' : 'הסמן שמאלה'} incLabel={den ? 'הסמן חלק אחד ימינה' : 'הסמן ימינה'}
          disabled={locked} decDisabled={value <= min + 1e-9} incDisabled={value >= max - 1e-9} />
      </div>
    </div>
  );
}
