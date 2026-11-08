// The treasure chest halfway along a unit. It stays shut until the stair before it is done; then its lid
// stands open with the light inside. Coming back from the lesson that reached it, the lid springs open.
import clsx from 'clsx';
import { m, useReducedMotion } from 'motion/react';

export default function Chest({ open, celebrate, expanded, label, onClick }) {
  const reduce = useReducedMotion();
  const pop = celebrate && !reduce;
  return (
    <button type="button" className={clsx('chest', open && 'is-open')} aria-label={label} aria-expanded={expanded} onClick={onClick}>
      <svg viewBox="0 0 96 84" aria-hidden="true">
        <ellipse cx="48" cy="78" rx="34" ry="5" className="ch-shadow" />
        {open && <m.path d="M20 40 L8 6 M48 34 V0 M76 40 L88 6" className="ch-rays" initial={pop ? { opacity: 0, pathLength: 0 } : false} animate={{ opacity: 1, pathLength: 1 }} transition={{ delay: 0.5, duration: 0.5 }} />}
        {open && <path d="M18 40 h60 v8 H18 Z" className="ch-glow" />}
        <path d="M14 42 h68 v28 a6 6 0 0 1 -6 6 H20 a6 6 0 0 1 -6 -6 Z" className="ch-body" />
        <path d="M14 52 h68 M30 42 v34 M66 42 v34" className="ch-band" />
        <rect x="42" y="46" width="12" height="14" rx="3" className="ch-lock" />
        {/* the lid turns back on its hinge (the far edge) when the chest opens */}
        <m.g style={{ transformOrigin: '48px 40px', transformBox: 'view-box' }}
          initial={pop ? { y: 0, scaleY: 1 } : false}
          animate={open ? { y: -14, scaleY: 0.55 } : { y: 0, scaleY: 1 }}
          transition={pop ? { type: 'spring', stiffness: 260, damping: 12, delay: 0.45 } : { duration: 0 }}>
          <path d="M14 42 v-12 a14 14 0 0 1 14 -14 h40 a14 14 0 0 1 14 14 v12 Z" className="ch-lid" />
          <path d="M30 16 v26 M66 16 v26" className="ch-band" />
        </m.g>
        {open && <m.g initial={pop ? { opacity: 0, y: 8 } : false} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7, duration: 0.35 }}>
          <circle cx="38" cy="38" r="6" className="ch-coin" /><circle cx="52" cy="35" r="6" className="ch-coin" /><circle cx="61" cy="40" r="5" className="ch-coin" />
        </m.g>}
      </svg>
    </button>
  );
}
