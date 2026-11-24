import clsx from 'clsx';

const LOW = 14; const HIGH = 32;

/**
 * A staircase, one step per level, climbing toward the reading direction (right to left).
 * Steps up to `done` are filled; the next one fills by `part` (0..1) from its foot.
 * Colour comes from the surrounding --c (a chapter, or the brand).
 */
export default function Stairs({ steps, done = 0, part = 0, className, label }) {
  // Long topics get narrower steps, so every meter stays about the same width.
  const W = steps > 6 ? 9 : 11; const GAP = steps > 6 ? 2 : 3;
  const width = steps * W + (steps - 1) * GAP;
  const h = (i) => (steps === 1 ? HIGH : LOW + ((HIGH - LOW) * i) / (steps - 1));
  return (
    <svg
      className={clsx('stairs', className)} viewBox={`0 0 ${width} ${HIGH}`} width={width} height={HIGH}
      role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}
    >
      {Array.from({ length: steps }, (_, i) => {
        const x = width - (i + 1) * W - i * GAP; const y = HIGH - h(i);
        const state = i < done ? 'on' : i === done ? 'cur' : 'off';
        return (
          <g key={i}>
            <rect x={x} y={y} width={W} height={h(i)} rx={3} className={`stair stair-${state}`} />
            {state === 'cur' && part > 0 && <rect x={x} y={HIGH - h(i) * part} width={W} height={h(i) * part} rx={3} className="stair stair-on" />}
          </g>
        );
      })}
    </svg>
  );
}
