// Adjacent angles by turning a ray: the right angle is measured live; the left one is the target, so the
// student has to think "they make a straight line together" to know where to stop.
// With protractor: true (FUNC-1.2) the object is a protractor instead, in its own box 300 wide (protractor.jsx), in one
// of two modes:
//   build  { from?: 'right' | 'left', base?, start, letters? }: the fixed arm lies on the 0 of the scale that starts on
//          the side `from`; the student turns the ray (drag, the step buttons "הקרן", ← and → in 5° steps) until the
//          angle is the target. No number is shown: the protractor is the reading.
//   align  { arms: [θ1, θ2], start, letters? }: an angle drawn with its arms in those directions, the protractor's centre
//          on the vertex; the student turns the protractor (drag it round, the step buttons "מד הזווית", ← and →) until
//          its baseline lies on an arm with the angle under it.
// A check hides nothing more: there is no readout.
import { useRef } from 'react';
import clsx from 'clsx';
import { RotateCcw, RotateCw } from 'lucide-react';
import { clamp, useDrag, arrowKeys, Stepper } from './core.jsx';
import { PROT, protractorLabels, protExtent, polar, useDrawnWidth, ProtractorArt } from './protractor.jsx';
import { buildRay, buildWords, alignWords, mod360, armsAngle, manipSolution } from '@/content/manip.js';

const W = 360; const H = 212; const O = [180, 184]; const R = 150;
const rad = (d) => (d * Math.PI) / 180;
const pt = (d, r) => [O[0] + r * Math.cos(rad(d)), O[1] - r * Math.sin(rad(d))];
const arcPath = (a0, a1, r) => { const [x0, y0] = pt(a0, r); const [x1, y1] = pt(a1, r); return `M ${x0} ${y0} A ${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 0 ${x1} ${y1}`; };

/** The letters drawn by default: the line's ends C and A, the vertex O. A step can name them after its own figure
 * (a triangle's vertex C and side BC, say), or leave any of them blank; `ray` names the end of the turning ray. */
const LABELS = { left: 'C', vertex: 'O', right: 'A', ray: '' };

/** The angle object: two adjacent angles on a line, or a protractor (m.protractor) in its build or align mode. */
export default function AngleTurner(props) {
  return props.m?.protractor ? <ProtractorTurner {...props} /> : <TwoAngles {...props} />;
}

function TwoAngles({ m, value, onChange, locked, reveal, good, answer, hint }) {
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

// ---------------------------------------------------------------- the protractor modes (FUNC-1.2)
const PAD = 8;
const STEP = 5;
/** The angle between the arms in the build mode, from a direction on the protractor, kept to 5..175 in 5° steps. */
const buildValue = (m, phi) => clamp(Math.round((m.from === 'left' ? 180 - phi : phi) / STEP) * STEP, 5, 175);
const atan = (O, p) => (Math.atan2(O[1] - p.y, p.x - O[0]) * 180) / Math.PI;
/** The direction opposite the middle of the angle between two arms: where the vertex's letter stays clear of both. */
const vertexAway = (arms) => { const start = mod360(arms[1] - arms[0]) <= 180 ? arms[0] : arms[1]; return start + armsAngle(arms) / 2 + 180; };

function ProtractorTurner({ m, value, onChange, locked, reveal, good, answer, hint }) {
  const align = m.mode === 'align';
  const base = align ? mod360(value) : (m.base || 0);
  const grab = useRef(null);
  const set = (v) => { const n = align ? mod360(Math.round(v / STEP) * STEP) : clamp(Math.round(v / STEP) * STEP, 5, 175); if (!locked && n !== value) onChange(n); };
  const [ref, drag] = useDrag((p, phase) => {
    if (align) {
      // the protractor turns with the finger: by how much the finger has gone round the centre since it pressed
      const a = atan(O, p);
      if (phase === 'start') { grab.current = { a, from: value }; return; }
      if (grab.current) set(grab.current.from + a - grab.current.a);
      return;
    }
    // the ray points at the finger (below the baseline, it stays at the nearer end)
    let d = mod360(atan(O, p) - base); if (d > 180) d = d > 270 ? 0 : 180;
    set(buildValue(m, d));
  }, locked);
  const drawn = useDrawnWidth(ref);
  const ray = align ? null : buildRay(m, value);
  // the arms on the protractor (0..180 where they are under it): their numbers are always drawn
  const armsOn = align ? m.arms.map((t) => mod360(t - base)).filter((d) => d <= 180) : [m.from === 'left' ? 180 : 0, ray];
  const labels = protractorLabels({ drawn, base, arms: armsOn });
  // the box: 300 wide; the build mode as high as its drawing, the align mode square (the protractor goes all round)
  const [top, bottom] = align ? [-PROT.W / 2 + PAD, PROT.W / 2 - PAD] : protExtent(base, labels);
  const O = [PROT.W / 2, PAD - top];
  const H = Math.ceil(bottom - top + 2 * PAD + (m.letters && !align ? 18 : 0));
  const fixedDir = (m.from === 'left' ? 180 : 0) + base;
  const ARM = PROT.R + 4;
  const line = (d, r, cls) => { const [x, y] = polar(O, d, r); return <line x1={O[0]} y1={O[1]} x2={x} y2={y} className={cls} />; };
  const letter = (d, t, side) => { const [x, y] = polar(O, d + side * 9, PROT.R * 0.62); return <text x={x} y={y + 6} textAnchor="middle" fontSize="17" className="mp-prot-letter">{t}</text>; };
  // the scale whose 0 is on the fixed arm (the hint lights it up)
  const scale = m.from === 'left' ? 'left' : 'right';
  const keyTurn = align
    ? { left: () => set(value + STEP), right: () => set(value - STEP), up: () => set(value + STEP), down: () => set(value - STEP) }
    : { left: () => set(buildValue(m, ray + STEP)), right: () => set(buildValue(m, ray - STEP)), up: () => set(value + STEP), down: () => set(value - STEP) };
  return (
    <div className={clsx('manip', 'manip-prot', good && 'good')}>
      {hint && <p className="manip-hint-line">{align ? 'סובבו לאט: קו האפס צריך לכסות שוק לגמרי.' : 'סופרים מה־0 שעל השוק הקבועה, בסולם באותו צבע.'}</p>}
      <svg ref={ref} {...drag} viewBox={`0 0 ${PROT.W} ${H}`} className={clsx('manip-canvas', 'mp-prot', hint && !align && `hint-${scale}`)} dir="ltr" tabIndex={locked ? -1 : 0}
        role="slider" aria-label={align ? 'מד הזווית' : 'הקרן'}
        aria-valuemin={align ? 0 : 5} aria-valuemax={align ? 355 : 175} aria-valuenow={value}
        aria-valuetext={align ? alignWords(m, value) : buildWords(m, value)}
        onKeyDown={arrowKeys(keyTurn)}>
        <rect x="0" y="0" width={PROT.W} height={H} className="mp-hit" />
        {/* the angle's arms lie on the paper, under the protractor (align); the arms of the angle being built lie on it */}
        {align && m.arms.map((t, i) => <g key={`a${i}`}>{line(t, ARM + 8, 'mp-prot-arm')}</g>)}
        <ProtractorArt O={O} base={base} labels={labels} cls="mp-prot" zero={hint && align}>
          {!align && line(fixedDir, ARM, 'mp-prot-arm')}
          {!align && reveal && answer !== value && line(buildRay(m, answer) + base, ARM, 'mp-ghost-ray')}
          {!align && line(ray + base, ARM, 'mp-prot-arm ray')}
        </ProtractorArt>
        {/* the answer shown: where the baseline goes */}
        {align && reveal && !good && (() => { const r = manipSolution({ manip: m, answer }); return <g>{line(r, PROT.R + 6, 'mp-ghost-ray')}{line(r + 180, PROT.R + 6, 'mp-ghost-ray')}</g>; })()}
        {!align && (() => { const [x, y] = polar(O, ray + base, PROT.R * 0.45); return <g className="mp-point"><circle cx={x} cy={y} r="15" className="mp-halo" /><circle cx={x} cy={y} r="9" className="mp-handle" /></g>; })()}
        <circle cx={O[0]} cy={O[1]} r="4" className="mp-vertex" />
        {m.letters && (align
          ? (() => { const side = (i) => (mod360(m.arms[1 - i] - m.arms[i]) <= 180 ? -1 : 1); return <>{letter(m.arms[0], m.letters.a, side(0))}{letter(m.arms[1], m.letters.b, side(1))}</>; })()
          : <>{letter(fixedDir, m.letters.a, fixedDir === base ? -1 : 1)}{letter(ray + base, m.letters.b, ray + base > fixedDir ? 1 : -1)}</>)}
        {/* the vertex's letter: under the protractor's centre, or (align) on the far side of the angle */}
        {m.letters?.vertex && (() => { const [x, y] = polar(O, align ? vertexAway(m.arms) : base - 90, 26); return <text x={x} y={y + 6} textAnchor="middle" fontSize="17" className="mp-prot-letter">{m.letters.vertex}</text>; })()}
      </svg>
      <div className="manip-controls">
        {align ? (
          <Stepper label="מד הזווית" icons={[RotateCcw, RotateCw]} onDec={() => set(value + STEP)} onInc={() => set(value - STEP)}
            decLabel="לסובב את מד הזווית נגד כיוון השעון" incLabel="לסובב את מד הזווית עם כיוון השעון" disabled={locked} />
        ) : (
          <Stepper label="הקרן" icons={[RotateCcw, RotateCw]} onDec={() => set(buildValue(m, ray + STEP))} onInc={() => set(buildValue(m, ray - STEP))}
            decLabel="לסובב את הקרן נגד כיוון השעון" incLabel="לסובב את הקרן עם כיוון השעון" disabled={locked}
            decDisabled={buildValue(m, ray + STEP) === value} incDisabled={buildValue(m, ray - STEP) === value} />
        )}
      </div>
    </div>
  );
}
