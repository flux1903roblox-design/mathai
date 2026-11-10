// Ordering by placing: several labelled markers, each dragged to its own number on the line. The order of the
// numbers is then something the student sees (smaller to the left). A drag moves the marker nearest the finger;
// the chips under the line choose which marker the step buttons and the arrow keys move.
// With `den` every unit is cut into den equal parts (labels on whole numbers only), a marker moves one part at a time,
// and a label may be a fraction (\frac{1}{4}): the chips write it as maths, the marker's head as 1/4. In a check
// (`test`) such a line shows no value: the step label is left out and a screen reader hears the ticks counted.
import { useRef, useState } from 'react';
import clsx from 'clsx';
import { clamp, useDrag, arrowKeys, Stepper, minus, labelText, partsTex, partsOf, decText } from './core.jsx';
import { Tex } from '../MathText.jsx';
import { lineNum, ticksWords } from '@/content/manip.js';

const W = 360; const H = 196; const PAD = 20; const LINE = 150;
const TONES = ['a', 'b', 'c', 'd'];
/** A marker's label as written on a chip: maths when it is TeX. */
const Label = ({ l }) => (/\\/.test(l) ? <Tex tex={l} /> : <bdi dir="ltr">{l}</bdi>);

export default function NumberPins({ m, value, onChange, locked, reveal, good, answer, hint, test = false }) {
  const { min, max, labels, den } = m;
  const parts = den || 1;
  const [sel, setSel] = useState(0);
  const grab = useRef(0);
  const step = (W - 2 * PAD) / (max - min); // px per whole unit
  const X = (v) => PAD + (v - min) * step;
  const snap = (v) => clamp(min + Math.round((v - min) * parts) / parts, min, max);
  const toV = (x) => snap(min + (x - PAD) / step);
  const setAt = (i, v) => {
    if (locked) return;
    const next = value.map((p, k) => (k === i ? snap(v) : p));
    if (Math.abs(next[i] - value[i]) > 1e-9) onChange(next);
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
  const ticks = []; for (let i = 0; i <= Math.round((max - min) * parts); i += 1) ticks.push(min + i / parts);
  const whole = (v) => Math.abs(v - Math.round(v)) < 1e-9;
  const labelled = (v) => whole(v) && (den ? true : Math.round(v) % 2 === 0);
  // markers on the same or neighbouring places (their heads are wider than one step) stack upwards
  const lift = value.map((v, i) => value.slice(0, i).filter((w) => Math.abs(w - v) * step < 48).length);
  const hidden = test && !!den;
  const shown = (v) => (!den ? minus(v) : m.fmt === 'dec' ? decText(v) : <Tex tex={partsTex(partsOf(v, parts), parts)} />);
  const name = labelText(labels[sel]);
  return (
    <div className={clsx('manip', 'manip-pins', den && 'cut', good && 'good')}>
      <svg ref={ref} {...drag} viewBox={`0 0 ${W} ${H}`} className="manip-canvas" dir="ltr" tabIndex={locked ? -1 : 0}
        role="slider" aria-label={`הסמן ${name} על ציר המספרים`}
        aria-valuemin={den ? 0 : min} aria-valuemax={den ? Math.round((max - min) * parts) : max} aria-valuenow={den ? partsOf(value[sel], parts, min) : value[sel]}
        aria-valuetext={den ? `הסמן ${name}: ${hidden ? '' : `${lineNum(m, value[sel])}, `}${ticksWords(m, value[sel], min)}` : `הסמן ${name} על ${minus(value[sel])}`}
        onKeyDown={arrowKeys({ left: () => setAt(sel, value[sel] - 1 / parts), right: () => setAt(sel, value[sel] + 1 / parts), up: () => setSel((sel + 1) % labels.length), down: () => setSel((sel + labels.length - 1) % labels.length) })}>
        {(!den || min < 0) && (
          <>
            <defs>
              <linearGradient id="np-temp" x1="0" x2={W} y1="0" y2="0" gradientUnits="userSpaceOnUse">
                <stop offset="0" className="nl-cold" /><stop offset={X(0) / W} className="nl-zero" /><stop offset="1" className="nl-warm" />
              </linearGradient>
            </defs>
            <rect x="0" y="0" width={W} height={H} fill="url(#np-temp)" />
          </>
        )}
        <rect x="0" y="0" width={W} height={H} className="mp-hit" />
        {hint && <g className="mp-hint"><path d={`M ${X(min < 0 ? 0 : (min + max) / 2)} ${LINE + 40} H ${X(min) + 6}`} /><path d={`M ${X(min) + 6} ${LINE + 40} l 8 -6 v 12 z`} className="fill" /><text x={X(min < 0 ? 0 : (min + max) / 2) - 8} y={LINE + 34} textAnchor="end" direction="rtl">קטן יותר</text></g>}
        <line x1={PAD - 12} y1={LINE} x2={W - PAD + 12} y2={LINE} className="mp-axis" />
        <path d={`M ${W - PAD + 14} ${LINE} l -8 -5 v 10 z`} className="mp-axis-head" />
        {ticks.map((v) => {
          const zero = Math.abs(v) < 1e-9; const big = whole(v);
          const h = zero || (den && big) ? 9 : 5;
          return (
            <g key={v.toFixed(6)}>
              <line x1={X(v)} y1={LINE - h} x2={X(v)} y2={LINE + h} className={zero ? 'mp-tick zero' : big || !den ? 'mp-tick' : 'mp-tick part'} />
              {labelled(v) && <text x={X(v)} y={LINE + 24} textAnchor="middle" className={zero ? 'mp-num zero' : 'mp-num'}>{minus(Math.round(v))}</text>}
            </g>
          );
        })}
        {reveal && answer.map((a, i) => (Math.abs(a - value[i]) > 1e-9 ? <g key={`g${i}`} className="mp-ghost-pin" transform={`translate(${X(a)} ${LINE})`}><circle r="9" /></g> : null))}
        {value.map((v, i) => (
          <g key={i} className={clsx('np-pin', `tone-${TONES[i]}`, i === sel && !locked && 'on')} transform={`translate(${X(v)} ${LINE - lift[i] * 30})`}>
            <path d="M 0 -6 L -7 -16 H -17 a 6 6 0 0 1 -6 -6 V -36 a 6 6 0 0 1 6 -6 H 17 a 6 6 0 0 1 6 6 V -22 a 6 6 0 0 1 -6 6 H 7 Z" />
            <text y="-24" textAnchor="middle">{labelText(labels[i])}</text>
            <circle r="5" className="np-dot" />
          </g>
        ))}
      </svg>
      <div className="manip-controls">
        <div className="np-chips" role="radiogroup" aria-label="איזה סמן מזיזים">
          {labels.map((l, i) => (
            <button key={i} type="button" role="radio" aria-checked={i === sel} aria-label={labelText(l)} className={clsx('np-chip', `tone-${TONES[i]}`, i === sel && 'on')} onClick={() => setSel(i)} disabled={locked}><Label l={l} /></button>
          ))}
        </div>
        <Stepper label={`הסמן ${name}`} value={hidden ? null : shown(value[sel])}
          onDec={() => setAt(sel, value[sel] - 1 / parts)} onInc={() => setAt(sel, value[sel] + 1 / parts)}
          decLabel={`הסמן ${name} שמאלה`} incLabel={`הסמן ${name} ימינה`} disabled={locked} decDisabled={value[sel] <= min + 1e-9} incDisabled={value[sel] >= max - 1e-9} />
      </div>
    </div>
  );
}
