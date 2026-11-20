// The reward stop halfway along a unit: a round stop like the others, with a gift. Shut, in the unit's tint like the
// stops still ahead, until the stair before it is done; then gold, open. Coming back from the lesson that reached it, it
// opens once: it crouches first (a little wider and shorter: the wind-up, ux-motion 2), springs up past its size and
// settles (squash and stretch, 1). Its press is the CSS one (translate and scale), which motion's transform leaves alone.
import clsx from 'clsx';
import { m, useReducedMotion } from 'motion/react';
import { Gift } from 'lucide-react';
import { EASE } from '@/lib/motion.js';

/** The chest's opening, as shares of its 500ms: the crouch (the wind-up), the spring up, the settle. */
export const CHEST_OPEN = [0, 0.24, 0.6, 1];

export default function Chest({ open, celebrate, expanded, label, onClick }) {
  const reduce = useReducedMotion();
  const pop = celebrate && !reduce;
  return (
    <m.button type="button" className={clsx('chest', open && 'is-open')} aria-label={label} aria-expanded={expanded} onClick={onClick}
      animate={pop ? { scaleX: [1, 1.08, 0.94, 1], scaleY: [1, 0.86, 1.12, 1] } : undefined}
      transition={{ duration: 0.5, delay: 0.45, times: CHEST_OPEN, ease: [EASE.out, EASE.in, EASE.out] }} style={{ originY: 1 }}>
      <Gift size={30} strokeWidth={2.2} aria-hidden="true" />
    </m.button>
  );
}
