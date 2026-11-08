// The end of a lesson as a climb: the unit's staircase (one step per level, rising in the reading direction),
// with מדי hopping up to the step the lesson completed, or bouncing on the step he is working on.
// The steps are the same blocks as the stops on the map. Under reduced motion he is simply there.
import { m, useReducedMotion } from 'motion/react';
import Mascot from './Mascot.jsx';

const W = 360; const H = 210; const PAD = 14; const BASE = 30; const TOP = 132;

export default function Climb({ steps, from, to, part = 0, mood, trophy }) {
  const reduce = useReducedMotion();
  const sw = (W - 2 * PAD) / steps;
  const h = (i) => BASE + ((TOP - BASE) * i) / Math.max(1, steps - 1);
  // step i stands at the right for i = 0 and climbs leftwards (Hebrew reads right to left)
  const x = (i) => W - PAD - (i + 1) * sw;
  // where מדי stands: on top of step k - 1 (k steps done), or on the ground before the first step
  const spot = (k) => (k <= 0 ? { cx: W - PAD / 2 - 6, top: H - 6 } : { cx: x(k - 1) + sw / 2, top: H - h(k - 1) - 6 });
  const a = spot(from); const b = spot(to);
  const pct = (v, of) => `${(v / of) * 100}%`;
  const moved = from !== to;
  const peak = Math.min(a.top, b.top) - 40;
  const anim = reduce ? false : moved
    ? { left: [pct(a.cx, W), pct((a.cx + b.cx) / 2, W), pct(b.cx, W)], top: [pct(a.top, H), pct(peak, H), pct(b.top, H)] }
    : { top: [pct(b.top, H), pct(b.top - 22, H), pct(b.top, H)] };
  return (
    <div className="climb" aria-hidden="true">
      <svg viewBox={`0 0 ${W} ${H}`} className="climb-steps">
        {Array.from({ length: steps }, (_, i) => {
          const state = i < to ? 'on' : i === to ? 'cur' : 'off';
          const fresh = moved && i >= from && i < to;
          // touching blocks with rounded front corners: a staircase, not a row of bars
          const top = H - h(i); const r = 9;
          const block = `M${x(i)} ${H} V${top + r} q0 -${r} ${r} -${r} H${x(i) + sw - r} q${r} 0 ${r} ${r} V${H} Z`;
          return (
            <g key={i} className={`climb-step ${state}`}>
              <m.path d={block} className="climb-face" initial={fresh && !reduce ? { fillOpacity: 0.35 } : false} animate={{ fillOpacity: 1 }} transition={{ delay: 0.75, duration: 0.4 }} />
              {state === 'cur' && part > 0 && <rect x={x(i)} y={H - (h(i) - 10) * part} width={sw} height={(h(i) - 10) * part} className="climb-part" />}
              <path d={`M${x(i) + r} ${top + 3} H${x(i) + sw - r}`} className="climb-tread" />
              <text x={x(i) + sw / 2} y={H - 12} textAnchor="middle" className="climb-num">{i + 1}</text>
            </g>
          );
        })}
        {trophy && <g transform={`translate(${x(steps - 1) + sw / 2 - 14} ${H - h(steps - 1) - 40})`} className="climb-flag"><path d="M4 0 v34 M4 2 h22 l-6 7 l6 7 h-22" /></g>}
      </svg>
      <m.div className="climb-mascot" style={{ left: pct(b.cx, W), top: pct(b.top, H) }}
        initial={reduce ? false : { left: pct(a.cx, W), top: pct(a.top, H) }} animate={anim || undefined}
        transition={{ duration: moved ? 0.7 : 0.5, delay: 0.35, ease: [0.22, 1, 0.36, 1], times: [0, 0.45, 1] }}>
        <Mascot mood={mood} size={84} />
      </m.div>
    </div>
  );
}
