import { m, useReducedMotion } from 'motion/react';

/** A smooth trail through the stops: each leg leaves one stop heading down and arrives at the next. */
function curve(pts) {
  if (pts.length < 2) return '';
  let d = `M${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i += 1) {
    const a = pts[i - 1]; const b = pts[i]; const dy = (b.y - a.y) * 0.55;
    d += ` C${a.x.toFixed(1)} ${(a.y + dy).toFixed(1)} ${b.x.toFixed(1)} ${(b.y - dy).toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
  }
  return d;
}

/**
 * The road a unit's stops sit on: a pale road with stepping dots, and the stretch already walked
 * (up to the current stop) in the unit's colour. Back from a lesson that moved the student on,
 * the walked stretch draws its new leg in front of them.
 */
export default function PathTrail({ points, reached, width, height, draw }) {
  const reduce = useReducedMotion();
  if (!points.length || !width) return null;
  const full = curve(points);
  const walked = reached > 0 ? curve(points.slice(0, reached + 1)) : '';
  const from = draw && !reduce && reached > 0 ? (reached - 1) / reached : 1;
  return (
    <svg className="trail" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path d={full} className="trail-edge" />
      <path d={full} className="trail-road" />
      {walked && (
        <m.path key={`${reached}-${draw}`} d={walked} className="trail-walked"
          initial={{ pathLength: from }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, delay: 0.2, ease: [0.22, 1, 0.36, 1] }} />
      )}
      <path d={full} className="trail-dots" />
    </svg>
  );
}
