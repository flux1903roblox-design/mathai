// An inequality's solutions on the number line (קרן): a point, a full or empty circle on it, and a ray to one side.
// Dragging only moves the point (a tap and a short drag look the same on a phone, so they never mean two things);
// the side and the circle are two segmented choices under the line, in a left-to-right group so that "שמאלה"
// really is on the left. The inequality the ray shows is written above it, live, except in a check or the placement
// test (`test`): there the student solves the inequality, and reading the ray back as "x ≤ 4" would let them match a
// line of text instead. The ray, its circle and its side stay; so does the spoken description of what is drawn.
import clsx from 'clsx';
import { ArrowLeft, ArrowRight, Circle } from 'lucide-react';
import { clamp, useDrag, arrowKeys, Stepper, minus } from './core.jsx';
import { Tex } from '../MathText.jsx';
import { rayTex, rayText } from '@/content/manip.js';

const W = 360; const H = 168; const PAD = 22; const LINE = 100;

/** The drawing of a ray on the number line, shared by the object and by the static figure. */
export function RayArt({ at, dir, closed, min = -10, max = 10, ghost = null }) {
  const step = (W - 2 * PAD) / (max - min);
  const X = (v) => PAD + (v - min) * step;
  const ticks = []; for (let v = min; v <= max; v += 1) ticks.push(v);
  const label = (v) => (max - min > 12 ? v % 2 === 0 : true);
  // the ray stands a little above the line, so the ticks and numbers under it stay readable; the ghost (the answer,
  // after a second miss) stands higher again
  const ray = (p, cls, lift = 18) => {
    const end = p.dir > 0 ? W - 6 : 6; const y = LINE - lift;
    return (
      <g className={cls}>
        <line x1={X(p.at)} x2={end - p.dir * 4} y1={y} y2={y} className="mp-iq-ray" />
        <path d={`M ${end} ${y} l ${-p.dir * 12} -8 v 16 z`} className="mp-iq-head" />
        <line x1={X(p.at)} x2={X(p.at)} y1={y} y2={LINE} className="mp-iq-drop" />
        <circle cx={X(p.at)} cy={y} r="8.5" className={clsx('mp-iq-dot', p.closed ? 'full' : 'empty')} />
      </g>
    );
  };
  return (
    <>
      <line x1={PAD - 14} y1={LINE} x2={W - PAD + 14} y2={LINE} className="mp-axis" />
      {ticks.map((v) => (
        <g key={v}>
          <line x1={X(v)} y1={LINE - (v === 0 ? 8 : 5)} x2={X(v)} y2={LINE + (v === 0 ? 8 : 5)} className={v === 0 ? 'mp-tick zero' : 'mp-tick'} />
          {label(v) && <text x={X(v)} y={LINE + 24} textAnchor="middle" className={v === 0 ? 'mp-num zero' : 'mp-num'}>{minus(v)}</text>}
        </g>
      ))}
      {ghost && ray(ghost, 'mp-iq-ghost', 44)}
      {ray({ at, dir, closed }, 'mp-iq')}
    </>
  );
}
export const RAY_VIEW = `0 0 ${W} ${H}`;

export default function Ray({ m, value, onChange, locked, reveal, good, answer, hint, test = false }) {
  const min = m.min ?? -10; const max = m.max ?? 10;
  const v = value || m.start;
  const step = (W - 2 * PAD) / (max - min);
  const toV = (x) => clamp(Math.round(min + (x - PAD) / step), min, max);
  const set = (patch) => { const n = { ...v, ...patch }; if (!locked && (n.at !== v.at || n.dir !== v.dir || n.closed !== v.closed)) onChange(n); };
  const move = (at) => set({ at: clamp(at, min, max) });
  const [ref, drag] = useDrag((p) => move(toV(p.x)), locked);
  const showGhost = reveal && answer && (answer.at !== v.at || answer.dir !== v.dir || !!answer.closed !== !!v.closed);
  return (
    <div className={clsx('manip', 'manip-ray', good && 'good')}>
      {!test && <div className="manip-readout" aria-live="polite"><Tex tex={rayTex(v)} /></div>}
      {hint && <p className="manip-hint-line">בדקו מספר אחד מכל צד של הנקודה, ואת הנקודה עצמה: מי מהם פותר?</p>}
      <svg ref={ref} {...drag} viewBox={RAY_VIEW} className="manip-canvas" dir="ltr" tabIndex={locked ? -1 : 0}
        role="slider" aria-label="הנקודה על ציר המספרים" aria-valuemin={min} aria-valuemax={max} aria-valuenow={v.at}
        aria-valuetext={`${test ? '' : `${rayText(v)}: `}עיגול ${v.closed ? 'מלא' : 'ריק'} ב־${minus(v.at)}, קרן ${v.dir > 0 ? 'ימינה' : 'שמאלה'}`}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); set({ closed: !v.closed }); return; }
          arrowKeys({ left: () => move(v.at - 1), right: () => move(v.at + 1), home: () => move(min), end: () => move(max) })(e);
        }}>
        <rect x="0" y="0" width={W} height={H} className="mp-hit" />
        <RayArt at={v.at} dir={v.dir} closed={v.closed} min={min} max={max} ghost={showGhost ? answer : null} />
      </svg>
      <div className="manip-controls mp-iq-controls">
        <Stepper label="הנקודה" value={minus(v.at)} onDec={() => move(v.at - 1)} onInc={() => move(v.at + 1)} decLabel="הנקודה שמאלה" incLabel="הנקודה ימינה" disabled={locked} decDisabled={v.at <= min} incDisabled={v.at >= max} />
        <div className="mp-iq-toggles" dir="ltr">
          <div className="mp-iq-seg" role="group" aria-label="לאיזה צד הקרן">
            <button type="button" className="seg" aria-pressed={v.dir < 0} onClick={() => set({ dir: -1 })} disabled={locked} aria-label="קרן שמאלה"><ArrowLeft size={18} strokeWidth={2.6} aria-hidden="true" /><span>שמאלה</span></button>
            <button type="button" className="seg" aria-pressed={v.dir > 0} onClick={() => set({ dir: 1 })} disabled={locked} aria-label="קרן ימינה"><span>ימינה</span><ArrowRight size={18} strokeWidth={2.6} aria-hidden="true" /></button>
          </div>
          <div className="mp-iq-seg" role="group" aria-label="העיגול בנקודה">
            <button type="button" className="seg" aria-pressed={!v.closed} onClick={() => set({ closed: false })} disabled={locked} aria-label="עיגול ריק: הנקודה לא בין הפתרונות"><Circle size={18} strokeWidth={2.6} aria-hidden="true" /><span>ריק</span></button>
            <button type="button" className="seg" aria-pressed={!!v.closed} onClick={() => set({ closed: true })} disabled={locked} aria-label="עיגול מלא: הנקודה בין הפתרונות"><Circle size={18} strokeWidth={2.6} fill="currentColor" aria-hidden="true" /><span>מלא</span></button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** What the ray shows, for מדי (Manip.jsx). */
export function rayCoach(m, v, touched) {
  const u = v || m.start;
  if (!touched) return 'גררו את הנקודה, ובחרו לאיזה צד הקרן ואם העיגול מלא או ריק.';
  const at = <bdi dir="ltr">{minus(u.at)}</bdi>;
  const side = u.dir > 0 ? 'מימין' : 'משמאל';
  return u.closed
    ? <>הקרן מסמנת את {at} עצמו ואת כל המספרים {side} לו.</>
    : <>הקרן מסמנת את כל המספרים {side} ל־{at}, אבל לא את {at} עצמו.</>;
}
