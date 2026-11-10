// The reward stop halfway along a unit: a round stop like the others, with a gift. Grey and shut until the stair
// before it is done; then gold, open. Coming back from the lesson that reached it, it pops once.
import clsx from 'clsx';
import { m, useReducedMotion } from 'motion/react';
import { Gift } from 'lucide-react';
import { SPRING } from '@/lib/motion.js';

export default function Chest({ open, celebrate, expanded, label, onClick }) {
  const reduce = useReducedMotion();
  const pop = celebrate && !reduce;
  return (
    <m.button type="button" className={clsx('chest', open && 'is-open')} aria-label={label} aria-expanded={expanded} onClick={onClick}
      initial={pop ? { scale: 0.7 } : false} animate={{ scale: 1 }} transition={{ ...SPRING.bounce, delay: 0.45 }}>
      <Gift size={30} strokeWidth={2.2} aria-hidden="true" />
    </m.button>
  );
}
