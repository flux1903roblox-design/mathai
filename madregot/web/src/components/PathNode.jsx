import { forwardRef, useEffect, useState } from 'react';
import clsx from 'clsx';
import { m, useReducedMotion } from 'motion/react';
import { EASE, SPRING } from '@/lib/motion.js';

// Solid, hand-drawn glyphs for the path: they read at a glance on a coloured coin.
const GLYPH = {
  star: <path d="M16 3.2c.5 0 .95.28 1.17.73l3.2 6.5 7.17 1.04c1.07.16 1.5 1.47.72 2.23l-5.19 5.06 1.23 7.14c.18 1.07-.94 1.88-1.9 1.38L16 23.9l-6.41 3.38c-.96.5-2.08-.31-1.9-1.38l1.23-7.14-5.2-5.06c-.77-.76-.34-2.07.73-2.23l7.17-1.04 3.2-6.5c.22-.45.67-.73 1.18-.73Z" />,
  check: <path d="M7 16.5l6 6L25.5 10" fill="none" stroke="currentColor" strokeWidth="4.6" strokeLinecap="round" strokeLinejoin="round" />,
  lock: <path d="M10.5 13v-2.8a5.5 5.5 0 0 1 11 0V13h.8A2.7 2.7 0 0 1 25 15.7v8.6A2.7 2.7 0 0 1 22.3 27H9.7A2.7 2.7 0 0 1 7 24.3v-8.6A2.7 2.7 0 0 1 9.7 13h.8Zm3 0h5v-2.8a2.5 2.5 0 0 0-5 0V13Z" />,
  crown: <path d="M6 24.5 4.6 10.8a1 1 0 0 1 1.66-.86l5.1 4.7 3.8-7.3a1 1 0 0 1 1.78 0l3.8 7.3 5.1-4.7a1 1 0 0 1 1.66.86L26 24.5Zm0 2.5h20v1.6a1.4 1.4 0 0 1-1.4 1.4H7.4A1.4 1.4 0 0 1 6 28.6Z" />,
  trophy: <path d="M9 4.5h14v2h3.3c.8 0 1.4.7 1.3 1.5-.4 3.8-2.6 6.4-5.6 7.1A7 7 0 0 1 17.5 19v3h3.5a1.5 1.5 0 0 1 0 3H11a1.5 1.5 0 0 1 0-3h3.5v-3A7 7 0 0 1 10 15.1C7 14.4 4.8 11.8 4.4 8c-.1-.8.5-1.5 1.3-1.5H9v-2Zm0 5H7.6A5 5 0 0 0 9.2 12V9.5Zm14 0V12a5 5 0 0 0 1.6-2.5H23Z" />,
};

/** Under the current stair: one mark per lesson in it, filled as lessons are done. */
function LessonMarks({ parts, of, fillLast }) {
  // Coming back from a lesson, the mark it earned fills in front of the student.
  const [shown, setShown] = useState(fillLast ? Math.max(0, parts - 1) : parts);
  useEffect(() => {
    if (shown === parts) return undefined;
    const t = setTimeout(() => setShown(parts), 260);
    return () => clearTimeout(t);
  }, [parts, shown]);
  return (
    <span className="node-marks" aria-hidden="true">
      {Array.from({ length: of }, (_, k) => <i key={k} className={clsx(k < shown && 'on')} />)}
    </span>
  );
}

/** Gold flecks that fly out of a stop the moment it is completed. */
function Burst() {
  return (
    <span className="node-burst" aria-hidden="true">
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return <m.i key={i} initial={{ x: 0, y: 0, scale: 0.4, opacity: 1 }} animate={{ x: Math.cos(a) * 58, y: Math.sin(a) * 58, scale: 1, opacity: 0 }} transition={{ duration: 0.7, delay: 0.25, ease: EASE.burst }} />;
      })}
    </span>
  );
}

/**
 * A stop on the path: a stair block with a solid riser that sinks when pressed (the app is named for stairs).
 * locked (grey stone), current (the unit's colour, floating, with a mark per lesson), done (gold, a check),
 * mastered (gold with a crown once the unit's review is passed), and the trophy that closes a unit.
 */
const PathNode = forwardRef(function PathNode({ state, kind, parts, of, fillLast, label, expanded, onClick, mastered, celebrate }, ref) {
  const reduce = useReducedMotion();
  const glyph = kind === 'review' ? 'trophy' : state === 'done' ? (mastered ? 'crown' : 'check') : state === 'locked' ? 'lock' : 'star';
  return (
    <m.div
      className={clsx('node-slot', state === 'current' && 'has-ring', kind === 'review' && 'is-review', `slot-${state}`, mastered && state === 'done' && 'is-mastered')}
      initial={celebrate && !reduce ? { scale: 0.7 } : false} animate={{ scale: 1 }} transition={{ ...SPRING.bounce, delay: 0.2 }}
    >
      {state === 'current' && <span className="node-halo" aria-hidden="true" />}
      {state === 'current' && kind === 'node' && <LessonMarks parts={parts} of={of} fillLast={fillLast} />}
      {celebrate && !reduce && <Burst />}
      <button type="button" ref={ref} className={clsx('node', `node-${state}`, mastered && state === 'done' && 'node-mastered')} aria-expanded={expanded} aria-label={label} onClick={onClick}>
        <svg viewBox="0 0 32 32" className="node-glyph" aria-hidden="true" fill="currentColor">{GLYPH[glyph]}</svg>
      </button>
    </m.div>
  );
});

export default PathNode;
