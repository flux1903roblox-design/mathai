// The top of a celebration (PRODUCT2-38): מדי jumps in from below and lands with a bounce, a soft ring of light opens
// and turns slowly behind him, and a handful of small shapes in the app's colours (stars, dots, little stairs) fly out
// once and fall away. He then does his own dance (Mascot's mood). Used by the end of a teaching stage, the daily goal,
// the unlock moment, the end of a lesson and the streak milestones.
// Under reduced motion nothing moves: he simply stands there, and the light is still and faint. The buttons below are
// live from the first frame, so the moment never holds anyone. Decorative: hidden from screen readers (the screen's
// title says what happened). Loaded with those screens, never with the first load.
import clsx from 'clsx';
import { m, useReducedMotion } from 'motion/react';
import { SPRING } from '@/lib/motion.js';
import '@/styles/lazy/celebrate.css';

// the pieces that fly out: an angle (0 is up, clockwise), how far, a shape, a colour and a small extra delay
const BITS = [
  [-80, 112, 'star', 'gold', 0], [-55, 128, 'dot', 'brand', 0.04], [-30, 120, 'step', 'good', 0.02], [-8, 132, 'dot', 'streak', 0.06],
  [15, 124, 'star', 'brand', 0.01], [38, 130, 'dot', 'gold', 0.05], [62, 116, 'step', 'brand', 0.03], [84, 120, 'dot', 'good', 0.07],
  [-110, 96, 'dot', 'gold', 0.08], [110, 100, 'star', 'streak', 0.02], [-140, 84, 'step', 'brand', 0.05], [140, 88, 'dot', 'gold', 0.04],
];
const rad = (deg) => (deg * Math.PI) / 180;

/**
 * tone: 'brand' | 'gold' | 'streak' (the light's colour); rays: the turning ring of light; burst: the shapes that fly
 * out; delay: seconds before he jumps in; burstAt: seconds before the shapes fly (a little after he lands, unless
 * given: the daily goal sends them when its ring closes); children: מדי (or what stands in the middle).
 */
export default function Celebrate({ tone = 'brand', rays = true, burst = true, delay = 0, burstAt, className, children }) {
  const reduce = useReducedMotion();
  const fly = burstAt ?? delay + 0.22;
  return (
    <div className={clsx('celebrate', `celebrate-${tone}`, className)}>
      {rays && <span className="celebrate-rays" aria-hidden="true" />}
      {burst && !reduce && (
        <span className="celebrate-burst" aria-hidden="true">
          {BITS.map(([a, d, shape, c, extra], i) => {
            const x = Math.sin(rad(a)) * d; const y = -Math.cos(rad(a)) * d;
            return (
              <m.i key={i} className={`cb cb-${shape} cb-${c}`}
                initial={{ x: 0, y: 0, scale: 0.2, opacity: 0, rotate: 0 }}
                animate={{ x: [0, x, x * 1.08], y: [0, y, y + 46], scale: [0.2, 1, 0.7], opacity: [0, 1, 0], rotate: [0, a > 0 ? 160 : -160, a > 0 ? 220 : -220] }}
                transition={{ duration: 1.5, delay: fly + extra, times: [0, 0.32, 1], ease: 'easeOut' }} />
            );
          })}
        </span>
      )}
      <m.div className="celebrate-madi"
        initial={reduce ? false : { y: 40, scale: 0.6, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }}
        transition={reduce ? { duration: 0 } : { ...SPRING.bounce, delay }}>
        {children}
      </m.div>
    </div>
  );
}
