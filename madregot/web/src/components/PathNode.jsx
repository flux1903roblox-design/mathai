import { forwardRef, useEffect, useState } from 'react';
import clsx from 'clsx';

// Solid, hand-drawn glyphs for the path: they read at a glance on a coloured coin.
const GLYPH = {
  star: <path d="M16 3.2c.5 0 .95.28 1.17.73l3.2 6.5 7.17 1.04c1.07.16 1.5 1.47.72 2.23l-5.19 5.06 1.23 7.14c.18 1.07-.94 1.88-1.9 1.38L16 23.9l-6.41 3.38c-.96.5-2.08-.31-1.9-1.38l1.23-7.14-5.2-5.06c-.77-.76-.34-2.07.73-2.23l7.17-1.04 3.2-6.5c.22-.45.67-.73 1.18-.73Z" />,
  check: <path d="M7 16.5l6 6L25.5 10" fill="none" stroke="currentColor" strokeWidth="4.6" strokeLinecap="round" strokeLinejoin="round" />,
  lock: <path d="M10.5 13v-2.8a5.5 5.5 0 0 1 11 0V13h.8A2.7 2.7 0 0 1 25 15.7v8.6A2.7 2.7 0 0 1 22.3 27H9.7A2.7 2.7 0 0 1 7 24.3v-8.6A2.7 2.7 0 0 1 9.7 13h.8Zm3 0h5v-2.8a2.5 2.5 0 0 0-5 0V13Z" />,
  trophy: <path d="M9 4.5h14v2h3.3c.8 0 1.4.7 1.3 1.5-.4 3.8-2.6 6.4-5.6 7.1A7 7 0 0 1 17.5 19v3h3.5a1.5 1.5 0 0 1 0 3H11a1.5 1.5 0 0 1 0-3h3.5v-3A7 7 0 0 1 10 15.1C7 14.4 4.8 11.8 4.4 8c-.1-.8.5-1.5 1.3-1.5H9v-2Zm0 5H7.6A5 5 0 0 0 9.2 12V9.5Zm14 0V12a5 5 0 0 0 1.6-2.5H23Z" />,
};

/**
 * One even-gapped ring sector with rounded corners (transitions.dev #35, Donut chart):
 * angles run clockwise from the top; both gap edges stay parallel.
 */
function ringPath(c, ro, ri, a0, a1, gap, cr) {
  const Ro = ro - cr; const Ri = ri + cr; const h = gap / 2 + cr;
  const dO = Math.asin(Math.min(1, h / Ro)); const dI = Math.asin(Math.min(1, h / Ri));
  const o0 = a0 + dO; const o1 = a1 - dO; const i0 = a0 + dI; const i1 = a1 - dI;
  const pt = (r, a) => `${(c + r * Math.sin(a)).toFixed(2)} ${(c - r * Math.cos(a)).toFixed(2)}`;
  const lo = o1 - o0 > Math.PI ? 1 : 0; const li = i1 - i0 > Math.PI ? 1 : 0;
  return `M${pt(Ro, o0)}A${Ro} ${Ro} 0 ${lo} 1 ${pt(Ro, o1)}L${pt(Ri, i1)}A${Ri} ${Ri} 0 ${li} 0 ${pt(Ri, i0)}Z`;
}

const SIZE = 112; const RO = 56; const RI = 48; const GAP = 6; const CORNER = 2;

/** The ring around the current node: one segment per lesson, filled as lessons are done. */
function LessonRing({ parts, of, fillLast }) {
  // Coming back from a lesson, the segment it earned fills in front of the student.
  const [shown, setShown] = useState(fillLast ? Math.max(0, parts - 1) : parts);
  useEffect(() => {
    if (shown === parts) return undefined;
    const t = setTimeout(() => setShown(parts), 260);
    return () => clearTimeout(t);
  }, [parts, shown]);
  const span = (Math.PI * 2) / of;
  return (
    <svg className="node-ring" viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
      {Array.from({ length: of }, (_, k) => (
        <path key={k} className={clsx('node-ring-seg', k < shown && 'on')} d={ringPath(SIZE / 2, RO, RI, k * span, (k + 1) * span, GAP, CORNER)} strokeWidth={CORNER * 2} strokeLinejoin="round" />
      ))}
    </svg>
  );
}

/** A coin on the path: a true circle with a solid lip that collapses when pressed. */
const PathNode = forwardRef(function PathNode({ state, kind, parts, of, fillLast, label, expanded, onClick }, ref) {
  const glyph = kind === 'review' ? 'trophy' : state === 'done' ? 'check' : state === 'locked' ? 'lock' : 'star';
  return (
    <div className={clsx('node-slot', state === 'current' && 'has-ring', kind === 'review' && 'is-review')}>
      {state === 'current' && kind === 'node' && <LessonRing parts={parts} of={of} fillLast={fillLast} />}
      <button type="button" ref={ref} className={clsx('node', `node-${state}`)} aria-expanded={expanded} aria-label={label} onClick={onClick}>
        <svg viewBox="0 0 32 32" className="node-glyph" aria-hidden="true" fill="currentColor">{GLYPH[glyph]}</svg>
      </button>
    </div>
  );
});

export default PathNode;
