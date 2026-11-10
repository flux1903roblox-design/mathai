// The fraction bar (פס שברים): one bar is the whole. The student cuts it into equal parts (חלקים) and shades parts
// from the left (צבועים), so a fraction is something built and seen: 2/3 and 8/12 are the same length of bar.
// A tap on a part shades up to it (a tap on the last shaded part takes it back); a drag shades to the finger; the
// step buttons and the arrow keys do the same (↑/↓ shaded, ←/→ the number of parts).
// `marks` are reference fractions drawn as ticks above the bar ("cut so that 1/3 and 1/4 both fall on lines"), and
// `whole` names the whole bar (56 marbles): the readout then gives the shaded amount too. In a check (`test`) that
// amount is left out (the fraction stays: it is what the student built, not the answer), and מדי says nothing.
// The same drawing is the still figure `fbar` (Figure.jsx), with rows, a hatched part of a part and crossed-out parts.
import { useId, useRef } from 'react';
import clsx from 'clsx';
import { clamp, useDrag, arrowKeys, Stepper, SvgLabel } from './core.jsx';
import { Tex } from '../MathText.jsx';
import { fbarWords, fbarTex, manipSolution, FBAR_MAX_DEN, dlineNum } from '@/content/manip.js';
import { toFrac, exactTex } from '@/content/util.js';

const W = 360;
const X0 = 24; const X1 = 336; const BY = 54; const BH = 56;

/** A fraction value as the TeX of its label (\frac{1}{3}), in lowest terms. */
export const fracLabel = (v) => { const f = toFrac(v, 100); return !f ? String(v) : f.d === 1 ? `${f.n}` : `${f.n < 0 ? '-' : ''}\\frac{${Math.abs(f.n)}}{${f.d}}`; };
/** The shaded amount of a bar that stands for `whole` things: a number as TeX (12{,}500 from ten thousand). */
export const amountTex = (den, shaded, whole) => { const a = (shaded * whole) / den; return Number.isInteger(a) && Math.abs(a) >= 10000 ? dlineNum(a).replace(/,/g, '{,}') : exactTex(a); };

/**
 * One bar, drawn from x0 to x1 at y (h high): den equal parts, the first `shaded` filled; `hatch` hatches the first
 * shaded parts (a part of a part) and `cross` crosses out the last shaded ones (taken away). `ghost` draws it as the
 * dashed answer under a miss.
 */
export function BarArt({ den, shaded, x0 = X0, x1 = X1, y = BY, h = BH, hatch = 0, cross = 0, ghost = false, patternId }) {
  const w = (x1 - x0) / den;
  const parts = Array.from({ length: den }, (_, i) => i);
  return (
    <g className={clsx('mp-fbar', ghost && 'ghost')}>
      {parts.map((i) => (
        <rect key={`p${i}`} x={x0 + i * w} y={y} width={w} height={h} className={i < shaded ? 'mp-fbar-part on' : 'mp-fbar-part'} />
      ))}
      {patternId && parts.filter((i) => i < Math.min(hatch, shaded)).map((i) => (
        <rect key={`h${i}`} x={x0 + i * w} y={y} width={w} height={h} fill={`url(#${patternId})`} className="mp-fbar-hatch" />
      ))}
      {parts.filter((i) => i < shaded && i >= shaded - cross).map((i) => (
        <path key={`x${i}`} d={`M ${x0 + i * w + 5} ${y + 5} L ${x0 + (i + 1) * w - 5} ${y + h - 5} M ${x0 + (i + 1) * w - 5} ${y + 5} L ${x0 + i * w + 5} ${y + h - 5}`} className="mp-fbar-cross" />
      ))}
      {parts.slice(1).map((i) => <line key={`l${i}`} x1={x0 + i * w} x2={x0 + i * w} y1={y} y2={y + h} className="mp-fbar-cut" />)}
      <rect x={x0} y={y} width={x1 - x0} height={h} className="mp-fbar-edge" />
    </g>
  );
}

/** The hatching pattern of a part of a part (one per drawing, by id). */
export const HatchDef = ({ id }) => (
  <defs>
    <pattern id={id} patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="8" className="mp-fbar-hatch-line" />
    </pattern>
  </defs>
);

/** Reference marks above a bar: a tick and the fraction's label at each value (0..1 of the bar). */
export function MarksArt({ marks, x0 = X0, x1 = X1, y = BY, guides = false, h = BH }) {
  // labels of marks that stand close (1/4 and 1/3) are spread apart, each joined to its tick by a short slanted line
  const xs = marks.map((v) => x0 + v * (x1 - x0));
  const order = xs.map((x, i) => i).sort((a, b) => xs[a] - xs[b]);
  const lx = [...xs]; const GAP = 30;
  for (let pass = 0; pass < 4; pass += 1) {
    for (let k = 1; k < order.length; k += 1) {
      const a = order[k - 1]; const b = order[k]; const d = lx[b] - lx[a];
      if (d < GAP) { lx[a] -= (GAP - d) / 2; lx[b] += (GAP - d) / 2; }
    }
  }
  return (
    <g className="mp-fbar-marks">
      {marks.map((v, i) => (
        <g key={i}>
          {guides && <line x1={xs[i]} x2={xs[i]} y1={y} y2={y + h} className="mp-fbar-guide" />}
          <line x1={xs[i]} x2={xs[i]} y1={y - 10} y2={y} className="mp-fbar-mark" />
          {Math.abs(lx[i] - xs[i]) > 0.5 && <line x1={xs[i]} x2={lx[i]} y1={y - 10} y2={y - 14} className="mp-fbar-mark" />}
          <SvgLabel x={lx[i]} y={y - 32} text={fracLabel(v)} className="mp-fbar-mark-label" size="sm" />
        </g>
      ))}
    </g>
  );
}

/** 0 and the whole under a bar that stands for a number of things. */
export const WholeArt = ({ whole, x0 = X0, x1 = X1, y }) => (
  <g className="mp-fbar-whole">
    <text x={x0} y={y} textAnchor="middle" className="mp-num">0</text>
    <text x={x1} y={y} textAnchor="middle" className="mp-num strong">{dlineNum(whole)}</text>
  </g>
);

export default function FracBar({ m, value, onChange, locked, reveal, good, answer, hint, test = false }) {
  const maxDen = m.maxDen || FBAR_MAX_DEN;
  const { den, shaded } = value || m.start;
  const marks = m.marks || [];
  const pid = `fbar-${useId().replace(/[^\w-]/g, '')}`;
  const set = (d, s) => {
    const D = m.lockDen ? den : clamp(d, 1, maxDen); const S = clamp(s, 0, D);
    if (!locked && (D !== den || S !== shaded)) onChange({ den: D, shaded: S });
  };
  const w = (X1 - X0) / den;
  // a tap shades up to the part under the finger (or takes back the last shaded one); a drag shades to the finger
  const tap = useRef({ x: 0, drag: false });
  const [ref, drag] = useDrag((p, phase) => {
    if (phase === 'start') {
      tap.current = { x: p.x, drag: false };
      const i = clamp(Math.floor((p.x - X0) / w), 0, den - 1);
      set(den, shaded === i + 1 ? i : i + 1);
      return;
    }
    if (!tap.current.drag && Math.abs(p.x - tap.current.x) < 8) return;
    tap.current.drag = true;
    set(den, Math.round((p.x - X0) / w));
  }, locked);
  const sol = reveal ? manipSolution({ manip: m, answer }) : null;
  const showGhost = sol && (sol.den !== den || sol.shaded !== shaded);
  // the hint: dashed lines where every mark falls, or where the shading should end
  const goalAt = answer?.mode === 'value' ? [answer.value] : answer?.mode === 'exact' ? [answer.shaded / answer.den] : [];
  const amount = m.whole != null && !test ? amountTex(den, shaded, m.whole) : null;
  // the drawing is as tall as what it holds: the bar, 0 and the whole under it, and the answer's bar after a miss
  const H = BY + BH + (m.whole != null ? 34 : 14) + (showGhost ? 34 : 0);
  return (
    <div className={clsx('manip', 'manip-fbar', good && 'good')}>
      <div className="manip-readout" aria-live="polite"><Tex tex={`${fbarTex({ den, shaded }).replace('\\frac', '\\dfrac')}${amount != null ? ` = ${amount}` : ''}`} /></div>
      {hint && <p className="manip-hint-line">{marks.length ? 'כל סימון צריך ליפול על קו בין שני חלקים.' : 'הקו המקווקו מראה עד איפה צובעים.'}</p>}
      <svg ref={ref} {...drag} viewBox={`0 0 ${W} ${H}`} className="manip-canvas" dir="ltr" tabIndex={locked ? -1 : 0}
        role="slider" aria-roledescription="פס שברים" aria-label="פס שברים" aria-valuemin={0} aria-valuemax={den} aria-valuenow={shaded}
        aria-valuetext={`${fbarWords({ den, shaded })}${amount != null ? `, הכמות ${dlineNum((shaded * m.whole) / den)} מתוך ${dlineNum(m.whole)}` : ''}`}
        onKeyDown={arrowKeys({ up: () => set(den, shaded + 1), down: () => set(den, shaded - 1), right: () => set(den + 1, shaded), left: () => set(den - 1, shaded), home: () => set(den, 0), end: () => set(den, den) })}>
        <HatchDef id={pid} />
        <rect x="0" y="0" width={W} height={H} className="mp-hit" />
        <BarArt den={den} shaded={shaded} patternId={pid} />
        {marks.length > 0 && <MarksArt marks={marks} guides={hint} />}
        {hint && !marks.length && goalAt.map((v, i) => <line key={i} x1={X0 + v * (X1 - X0)} x2={X0 + v * (X1 - X0)} y1={BY - 10} y2={BY + BH + 10} className="mp-fbar-guide" />)}
        {m.whole != null && <WholeArt whole={m.whole} y={BY + BH + 22} />}
        {showGhost && <BarArt den={sol.den} shaded={sol.shaded} y={BY + BH + (m.whole != null ? 34 : 12)} h={24} ghost />}
      </svg>
      <div className="manip-controls">
        <Stepper label="חלקים" value={den} onDec={() => set(den - 1, shaded)} onInc={() => set(den + 1, shaded)} decLabel="פחות חלקים" incLabel="יותר חלקים" disabled={locked || m.lockDen} decDisabled={den <= 1} incDisabled={den >= maxDen} />
        <Stepper label="צבועים" value={shaded} onDec={() => set(den, shaded - 1)} onInc={() => set(den, shaded + 1)} decLabel="לצבוע חלק אחד פחות" incLabel="לצבוע עוד חלק" disabled={locked} decDisabled={shaded <= 0} incDisabled={shaded >= den} />
      </div>
    </div>
  );
}

/** What the bar shows, for מדי (Manip.jsx). */
export function fbarCoach(m, v, touched) {
  const u = v || m.start;
  if (!touched) return m.marks?.length ? 'נסו מספר חלקים שבו כל הסימונים נופלים על קווים.' : 'חלקו את הפס לחלקים שווים, וצבעו.';
  return `${fbarWords(u)}.`;
}
