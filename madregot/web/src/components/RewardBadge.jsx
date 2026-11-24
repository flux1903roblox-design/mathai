import { m, useReducedMotion } from 'motion/react';
import clsx from 'clsx';
import { SPRING } from '@/lib/motion.js';

/**
 * A medal for something the student really did in this lesson (a perfect run, a finished stair,
 * a finished unit, the daily goal). It pops in on a ribbon; the icon names the reason.
 * tone: gold | brand | good | streak | chapter (the unit's own colour).
 */
export default function RewardBadge({ icon: Icon, label, tone = 'gold', delay = 0 }) {
  const reduce = useReducedMotion();
  return (
    <m.figure className={clsx('badge', `badge-${tone}`)} initial={reduce ? false : { scale: 0, rotate: -25, y: 10 }} animate={{ scale: 1, rotate: 0, y: 0 }}
      transition={{ ...SPRING.pop, delay }}>
      <span className="badge-medal">
        <svg viewBox="0 0 80 92" className="badge-art" aria-hidden="true">
          <path d="M23 50 L12 88 L26 80 L34 92 L41 56 Z" className="badge-ribbon-a" />
          <path d="M57 50 L68 88 L54 80 L46 92 L39 56 Z" className="badge-ribbon-b" />
          <circle cx="40" cy="38" r="33" className="badge-rim" />
          <circle cx="40" cy="38" r="26" className="badge-face" />
          <path d="M20 30 A21 21 0 0 1 46 16" className="badge-shine" />
        </svg>
        <span className="badge-icon" aria-hidden="true"><Icon size={26} strokeWidth={2.6} /></span>
      </span>
      <figcaption>{label}</figcaption>
    </m.figure>
  );
}
