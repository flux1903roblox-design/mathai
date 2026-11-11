// The circle (kind 'circle', עיגול; stage 4, MEASURE-1.3). Two shows:
//   circumference  a circle above a line marked at one, two, three and four diameters. Its radius changes by dragging
//                  the handle at the end of the radius (left and right) or by the Stepper רדיוס, half a unit at a time;
//                  the circle keeps its size on the screen (four diameters always fill the line) and the numbers change
//                  with it, because the ratio never does. The Stepper גלגול rolls it one turn along the line, a quarter
//                  at a time, leaving the length of its rim behind as a coloured segment: a little more than three
//                  diameters.
//   area           the disc cut into sectors (the Stepper פרוסות: 4 … 32), laid alternately up and down into a shape
//                  whose base is half the circumference and whose height is the radius: nearly a rectangle.
// Keys: ←/→ the roll (or the sectors), ↑/↓ the radius, Home/End the roll's ends. Each step moves in 300 ms, at once under
// reduced motion. In a check (`test`) the readout keeps the radius and the diameter only: no circumference, base or
// area, and nothing marks a right state. The rules are content/circle.js.
import { useRef, useState } from 'react';
import clsx from 'clsx';
import { useReducedMotion } from 'motion/react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Stepper, useTween, svgPoint } from './core.jsx';
import { manipCorrect, manipSolution } from '@/content/manip.js';
import { circleStep, circleRange, circleWords, circNum, SECTORS } from '@/content/circle.js';

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// circumference: the circle is RHO units in radius whatever r is, so four diameters (8 RHO) span the line from X0
const W = 300; const RHO = 30; const X0 = 40; const LINE_Y = 132; const H_ROLL = 172;
// area: the disc above, the sectors laid out under it
const H_AREA = 222; const RA = 50; const DISC = [150, 60]; const STRIP_Y = 136;
const DRAG_STEP = 14; // drawing units of drag for one step of the radius

/** What the object says: `text` (aria-valuetext), `line` the readout. A check keeps the radius and the diameter. */
export function circleSaid(m, v, { test = false } = {}) {
  const rd = `רדיוס ${circNum(v.r)} · קוטר ${circNum(2 * v.r)}`;
  const text = circleWords(m, v);
  if (test) return { text, line: rd };
  if (m.show === 'area') return { text, line: `${v.n} פרוסות · בסיס ≈ ${circNum(Math.PI * v.r)} · גובה ${circNum(v.r)} · שטח ≈ ${circNum(Math.PI * v.r * v.r)}` };
  return { text, line: `${rd} · היקף ≈ ${circNum(2 * Math.PI * v.r)}` };
}

/** A sector of radius R from angle a0 to a1 (radians, screen y down) about c, or laid with its apex at `apex` opening `dir`. */
const sectorPath = (c, R, a0, a1) => `M ${c[0]} ${c[1]} L ${c[0] + R * Math.cos(a0)} ${c[1] + R * Math.sin(a0)} A ${R} ${R} 0 0 1 ${c[0] + R * Math.cos(a1)} ${c[1] + R * Math.sin(a1)} Z`;
/** The n sectors laid alternately apex up and apex down: their apexes and the way each opens. */
export function sectorStrip(n, R = RA, y0 = STRIP_Y) {
  const th = (2 * Math.PI) / n; const w = 2 * R * Math.sin(th / 2); const a0 = W / 2 - ((n - 1) * w) / 4;
  return Array.from({ length: n }, (_, k) => {
    const up = k % 2 === 0; const i = Math.floor(k / 2);
    const apex = up ? [a0 + i * w, y0] : [a0 + i * w + w / 2, y0 + R * Math.cos(th / 2)];
    // up: opens downward (screen +y), from the left edge to the right one; down: opens upward
    const ang = up ? [Math.PI / 2 + th / 2, Math.PI / 2 - th / 2] : [-Math.PI / 2 - th / 2, -Math.PI / 2 + th / 2];
    return { k, up, apex, a: ang[0], b: ang[1] };
  });
}

export default function CircleRoll({ m, value, onChange, locked, reveal, good, answer, hint, test = false }) {
  const v = value || m.start;
  const still = useReducedMotion();
  const { step } = circleRange(m);
  const emit = (n) => { if (!locked && !same(n, v)) onChange(n); };
  const press = (key, dir) => emit(circleStep(m, v, key, dir));
  const stuck = (key, dir) => same(circleStep(m, v, key, dir), v);
  const right = !test && !!answer && manipCorrect({ manip: m, answer }, v);
  const sol = reveal && answer ? manipSolution({ manip: m, answer }) : null;
  const said = circleSaid(m, v, { test });
  const area = m.show === 'area';
  const t = useTween(area ? 0 : v.t ?? 0, still);
  const svg = useRef(null);
  const [grab, setGrab] = useState(null);

  const keys = area
    ? { ArrowLeft: () => press('n', -1), ArrowRight: () => press('n', 1), Home: () => emit({ ...v, n: SECTORS[0] }), End: () => emit({ ...v, n: SECTORS[SECTORS.length - 1] }) }
    : { ArrowLeft: () => press('t', -1), ArrowRight: () => press('t', 1), ArrowDown: () => press('r', -1), ArrowUp: () => press('r', 1), Home: () => emit({ ...v, t: 0 }), End: () => emit({ ...v, t: 1 }) };
  const onKeyDown = (e) => { const f = keys[e.key]; if (!f || locked) return; e.preventDefault(); e.stopPropagation(); f(); };

  // the radius handle: a drag left or right changes r by a step every DRAG_STEP units (the pointer is captured by the
  // drawing, so its moves arrive there)
  const grabMove = (e) => {
    if (!grab) return;
    const k = Math.round((svgPoint(svg.current, e).x - grab.x) / DRAG_STEP);
    const { max } = circleRange(m);
    emit({ ...v, r: Math.min(max, Math.max(step, grab.r + k * step)) });
  };
  let art; let controls;
  if (!area) {
    const s = t * Math.PI * 2 * RHO; const c = [X0 + s, LINE_Y - RHO]; const phi = t * 2 * Math.PI;
    const mark = [c[0] - RHO * Math.sin(phi), c[1] + RHO * Math.cos(phi)];
    const handle = [c[0] + RHO, c[1]];
    const down = (e) => {
      if (locked || (e.button != null && e.button > 0)) return;
      e.preventDefault(); e.stopPropagation(); try { svg.current?.setPointerCapture?.(e.pointerId); } catch { /* not supported */ }
      setGrab({ x: svgPoint(svg.current, e).x, r: v.r });
    };
    const end = 2 * Math.PI * RHO + X0; // where one turn ends: π diameters along the line
    art = (
      <g>
        <line x1={X0 - 14} x2={W - 10} y1={LINE_Y} y2={LINE_Y} className="mp-circ-line" />
        {[0, 1, 2, 3, 4].map((j) => (
          <g key={j}>
            <line x1={X0 + j * 2 * RHO} x2={X0 + j * 2 * RHO} y1={LINE_Y - 6} y2={LINE_Y + 6} className="mp-circ-tick" />
            <text x={X0 + j * 2 * RHO} y={LINE_Y + 24} textAnchor="middle" className="mp-num">{circNum(j * 2 * v.r)}</text>
          </g>
        ))}
        {sol && sol.t === 1 && t < 1 && <line x1={X0} x2={end} y1={LINE_Y} y2={LINE_Y} className="mp-circ-ghost" />}
        {s > 0.5 && <line x1={X0} x2={X0 + s} y1={LINE_Y} y2={LINE_Y} className={clsx('mp-circ-unrolled', right && 'hit')} />}
        {t >= 1 - 1e-6 && <line x1={end} x2={end} y1={LINE_Y - 9} y2={LINE_Y + 9} className="mp-circ-end" />}
        {t >= 1 - 1e-6 && !test && <text x={end} y={c[1] - RHO - 10} textAnchor="middle" direction="rtl" className="mp-circ-note">≈ 3.14 קטרים</text>}
        <circle cx={c[0]} cy={c[1]} r={RHO} className={clsx('mp-circ-disc', right && 'hit')} />
        <line x1={c[0]} y1={c[1]} x2={mark[0]} y2={mark[1]} className="mp-circ-spoke" />
        <circle cx={mark[0]} cy={mark[1]} r="4.5" className="mp-circ-mark" />
        <line x1={c[0]} y1={c[1]} x2={handle[0]} y2={handle[1]} className="mp-circ-radius" />
        <text x={c[0] + RHO / 2} y={c[1] - 7} textAnchor="middle" className="mp-circ-r">{circNum(v.r)}</text>
        {sol && sol.r !== v.r && <text x={c[0] + RHO / 2} y={c[1] + 20} textAnchor="middle" className="mp-circ-ghost-text">{circNum(sol.r)}</text>}
        <g className={clsx('mp-point', 'mp-circ-handle', grab && 'held')} onPointerDown={down}>
          <circle cx={handle[0]} cy={handle[1]} r="22" className="mp-halo" />
          <circle cx={handle[0]} cy={handle[1]} r="8" className="mp-handle" />
        </g>
      </g>
    );
    controls = (
      <>
        <Stepper label="רדיוס" value={circNum(v.r)} onDec={() => press('r', -1)} onInc={() => press('r', 1)} decLabel={`רדיוס קטן ב־${circNum(step)}`} incLabel={`רדיוס גדול ב־${circNum(step)}`}
          disabled={locked} decDisabled={stuck('r', -1)} incDisabled={stuck('r', 1)} />
        <Stepper label="גלגול" value={`${Math.round((v.t ?? 0) * 100)}%`} icons={[ArrowLeft, ArrowRight]} onDec={() => press('t', -1)} onInc={() => press('t', 1)}
          decLabel="לגלגל אחורה רבע סיבוב" incLabel="לגלגל קדימה רבע סיבוב" disabled={locked} decDisabled={stuck('t', -1)} incDisabled={stuck('t', 1)} />
      </>
    );
  } else {
    const n = v.n; const th = (2 * Math.PI) / n; const strip = sectorStrip(n);
    const left = strip[0].apex[0] - RA * Math.sin(th / 2); const right2 = strip[strip.length - 1].apex[0] + RA * Math.sin(th / 2);
    const base = Math.PI * RA; // the ideal rectangle under the strip: half the circumference, the radius high
    art = (
      <g>
        {Array.from({ length: n }, (_, k) => <path key={k} d={sectorPath(DISC, RA, -Math.PI / 2 + k * th, -Math.PI / 2 + (k + 1) * th)} className={clsx('mp-circ-sector', k % 2 ? 'b' : 'a')} />)}
        {sol && <rect x={W / 2 - base / 2} y={STRIP_Y} width={base} height={RA} className="mp-circ-ghost-shape" />}
        {strip.map((p) => {
          const P = (a) => [p.apex[0] + RA * Math.cos(a), p.apex[1] + RA * Math.sin(a)];
          const [s0, s1] = [P(p.a), P(p.b)];
          return <path key={p.k} d={`M ${p.apex[0]} ${p.apex[1]} L ${s0[0]} ${s0[1]} A ${RA} ${RA} 0 0 ${p.up ? 0 : 1} ${s1[0]} ${s1[1]} Z`} className={clsx('mp-circ-sector', p.k % 2 ? 'b' : 'a', right && 'hit')} />;
        })}
        {/* the height: the radius, beside the shape */}
        <line x1={left - 10} x2={left - 10} y1={STRIP_Y} y2={STRIP_Y + RA} className="mp-circ-dim" />
        <text x={left - 16} y={STRIP_Y + RA / 2 + 5} textAnchor="end" className="mp-num">{circNum(v.r)}</text>
        {!test && <text x={(left + right2) / 2} y={STRIP_Y + RA + 22} textAnchor="middle" className="mp-num">≈ {circNum(Math.PI * v.r)}</text>}
      </g>
    );
    controls = (
      <Stepper label="פרוסות" value={n} onDec={() => press('n', -1)} onInc={() => press('n', 1)} decLabel="פחות פרוסות" incLabel="יותר פרוסות"
        disabled={locked} decDisabled={stuck('n', -1)} incDisabled={stuck('n', 1)} />
    );
  }

  const H = area ? H_AREA : H_ROLL;
  const range = area ? [SECTORS[0], SECTORS[SECTORS.length - 1], v.n] : [0, 100, Math.round((v.t ?? 0) * 100)];
  return (
    <div className={clsx('manip', 'manip-circ', `manip-circ-${m.show}`, good && 'good')}>
      {/* each "name value" pair stays on one line; a narrow screen wraps between the pairs */}
      <div className="manip-readout mp-circ-readout" aria-live="polite">
        {said.line.split(' · ').map((part, i) => <span key={i} className="mp-circ-part">{i > 0 && <span className="mp-circ-sep"> · </span>}{part}</span>)}
      </div>
      {hint && <p className="manip-hint-line">{area ? 'הצורה היא כמעט מלבן: הבסיס חצי ההיקף, והגובה הרדיוס.' : 'סיבוב אחד שווה להיקף. כמה קטרים נכנסים בו?'}</p>}
      <svg ref={svg} viewBox={`0 0 ${W} ${H}`} className="manip-canvas mp-circ-canvas" dir="ltr" tabIndex={locked ? -1 : 0}
        role="slider" aria-roledescription="עיגול" aria-label={area ? 'עיגול חתוך לפרוסות' : 'עיגול שמתגלגל על קו'}
        aria-valuemin={range[0]} aria-valuemax={range[1]} aria-valuenow={range[2]} aria-valuetext={said.text} onKeyDown={onKeyDown}
        onPointerMove={grabMove} onPointerUp={() => setGrab(null)} onPointerCancel={() => setGrab(null)}>
        {art}
      </svg>
      <div className="manip-controls mp-circ-controls">{controls}</div>
    </div>
  );
}

/** What מדי says about the circle (Manip.jsx): what the student just did, never whether it is right. */
export function circleCoach(m, value, touched) {
  const v = value || m.start;
  if (m.show === 'area') {
    if (!touched) return 'הגדילו את מספר הפרוסות, ותראו מלבן.';
    return `${v.n} פרוסות. ככל שיש יותר פרוסות, הצורה דומה יותר למלבן: הבסיס חצי ההיקף, והגובה הרדיוס.`;
  }
  if (!touched) return 'גלגלו את העיגול סיבוב אחד. כמה קטרים יוצא ההיקף?';
  const t = v.t ?? 0;
  if (t >= 1) return 'סיבוב שלם: הקו הצבוע הוא ההיקף, קצת יותר משלושה קטרים.';
  if (t > 0) return 'הקו הצבוע הוא החלק של ההיקף שכבר נגע בקו.';
  return `רדיוס ${circNum(v.r)}, קוטר ${circNum(2 * v.r)}. העיגול נשאר באותו גודל, והמספרים על הקו משתנים איתו.`;
}
