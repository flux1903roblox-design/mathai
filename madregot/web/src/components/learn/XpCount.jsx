// The XP count-up (PRODUCT2-38): on a stage's end and a lesson's end the XP rolls up from 0 once it is on screen
// (`delay`, in seconds, after the screen opens), slows as it lands, and then pops once with a few gold sparks.
// A screen reader hears the final number at once (the moving digits are hidden from it). Under reduced motion, or with
// nothing to count, the final number is there from the first frame: no counting, no pop, nothing to wait for.
// Loaded with the screens that end a stage or a lesson, never with the first load.
import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { useReducedMotion } from 'motion/react';
import '@/styles/lazy/celebrate.css';

const easeOut = (t) => 1 - (1 - t) ** 3;
/** How long the count takes, in seconds: longer for more XP, never long (0.6 to 1.2). */
export const countSecs = (n) => Math.min(1.2, 0.6 + n / 50);
const SPARKS = 6;

/**
 * value: the XP; delay: seconds before it starts; plus: a "+" before it; unit: " XP" after it (left out in a tile whose
 * label says XP); className: e.g. the pill it sits in; secs: how long the count takes (countSecs by default; a stair
 * mastered counts its numbers faster, as a secondary action beside the moment); sparks: the gold sparks as it lands
 * (off for a count that is not XP).
 */
export default function XpCount({ value = 0, delay = 0, plus = true, unit = true, className, secs, sparks = true }) {
  const reduce = useReducedMotion();
  const still = !!reduce || !(value > 0);
  const [n, setN] = useState(still ? value : 0);
  const [done, setDone] = useState(still);
  useEffect(() => {
    if (still) { setN(value); setDone(true); return undefined; }
    setDone(false);
    let raf = 0; let start = null;
    const total = (secs ?? countSecs(value)) * 1000; const wait = delay * 1000;
    const tick = (t) => {
      if (start == null) start = t;
      const k = Math.min(1, Math.max(0, (t - start - wait) / total));
      setN(Math.round(easeOut(k) * value));
      if (k < 1) raf = requestAnimationFrame(tick); else setDone(true);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, still, delay, secs]);
  const sign = plus ? '+' : '';
  // the pop and the sparks only after a real count (never under reduced motion)
  const landed = done && !still;
  return (
    <bdi dir="ltr" className={clsx('xp-count', landed && 'xp-landed', className)} data-done={done}>
      <span className="xp-count-n" aria-hidden="true">{sign}{n}</span>
      {unit && <span className="xp-count-unit" aria-hidden="true"> XP</span>}
      <span className="visually-hidden">{sign}{value}{unit ? ' XP' : ''}</span>
      {landed && sparks && (
        <span className="xp-sparks" aria-hidden="true">
          {Array.from({ length: SPARKS }, (_, i) => <i key={i} style={{ '--a': `${(360 / SPARKS) * i + 15}deg` }} />)}
        </span>
      )}
    </bdi>
  );
}
