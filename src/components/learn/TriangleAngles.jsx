import { useRef } from 'react';
import { C, Tex, WidgetCard, svgPoint, colored } from './kit';

const W = 360;
const H = 250;
const COLORS = [C.amber, C.pink, C.cyan];
const NAMES = ['\\alpha', '\\beta', '\\gamma'];

const sub = (p, q) => [p[0] - q[0], p[1] - q[1]];
const len = (v) => Math.hypot(v[0], v[1]);
const area2 = ([a, b, c]) => Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]));

export function rawAngles(pts) {
  return pts.map((p, i) => {
    const u = sub(pts[(i + 1) % 3], p);
    const v = sub(pts[(i + 2) % 3], p);
    const cos = (u[0] * v[0] + u[1] * v[1]) / (len(u) * len(v));
    return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
  });
}

// Whole-degree angles that always add up to exactly 180 (largest-remainder rounding),
// with gentle "magnets" so a right angle / equilateral shape is reachable by finger.
export function shownAngles(pts) {
  const raw = rawAngles(pts);
  if (raw.every((a) => Math.abs(a - 60) < 2.5)) return [60, 60, 60];
  const right = raw.findIndex((a) => Math.abs(a - 90) < 1.2);
  const fixed = right >= 0 ? { [right]: 90 } : {};
  const free = [0, 1, 2].filter((i) => !(i in fixed));
  const target = 180 - (right >= 0 ? 90 : 0);
  const rawFree = free.map((i) => raw[i]);
  const scale = target / rawFree.reduce((s, a) => s + a, 0);
  const scaled = rawFree.map((a) => a * scale);
  const floors = scaled.map(Math.floor);
  let left = target - floors.reduce((s, a) => s + a, 0);
  const order = scaled.map((a, j) => [a - floors[j], j]).sort((x, y) => y[0] - x[0]);
  for (const [, j] of order) { if (left <= 0) break; floors[j] += 1; left -= 1; }
  const out = [0, 0, 0];
  free.forEach((i, j) => { out[i] = floors[j]; });
  Object.entries(fixed).forEach(([i, a]) => { out[i] = a; });
  return out;
}

function arcPath(p, q, r, radius) {
  const u = sub(q, p);
  const v = sub(r, p);
  const lu = len(u);
  const lv = len(v);
  const s = [p[0] + (u[0] / lu) * radius, p[1] + (u[1] / lu) * radius];
  const e = [p[0] + (v[0] / lv) * radius, p[1] + (v[1] / lv) * radius];
  const sweep = u[0] * v[1] - u[1] * v[0] > 0 ? 1 : 0;
  return `M${p[0]} ${p[1]} L${s[0]} ${s[1]} A${radius} ${radius} 0 0 ${sweep} ${e[0]} ${e[1]} Z`;
}

function rightMark(p, q, r, size) {
  const u = sub(q, p);
  const v = sub(r, p);
  const a = [(u[0] / len(u)) * size, (u[1] / len(u)) * size];
  const b = [(v[0] / len(v)) * size, (v[1] / len(v)) * size];
  return `M${p[0] + a[0]} ${p[1] + a[1]} L${p[0] + a[0] + b[0]} ${p[1] + a[1] + b[1]} L${p[0] + b[0]} ${p[1] + b[1]}`;
}

// Semicircle "fan": the three angles laid side by side always fill a straight line.
function Fan({ angles }) {
  const R = 44;
  const cx = 52;
  const cy = 50;
  let acc = 0;
  return (
    <svg viewBox="0 0 104 58" className="w-28 h-auto shrink-0" dir="ltr" aria-hidden="true">
      <line x1="2" x2="102" y1={cy} y2={cy} stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" />
      {angles.map((a, i) => {
        const t0 = Math.PI - (acc * Math.PI) / 180;
        acc += a;
        const t1 = Math.PI - (acc * Math.PI) / 180;
        const p0 = [cx + R * Math.cos(t0), cy - R * Math.sin(t0)];
        const p1 = [cx + R * Math.cos(t1), cy - R * Math.sin(t1)];
        return (
          <path
            key={i}
            d={`M${cx} ${cy} L${p0[0]} ${p0[1]} A${R} ${R} 0 0 1 ${p1[0]} ${p1[1]} Z`}
            fill={COLORS[i]}
            fillOpacity="0.85"
            stroke="hsl(240 10% 6%)"
            strokeWidth="1.5"
          />
        );
      })}
    </svg>
  );
}

// Drag the corners of a triangle; the angles update live and always sum to 180°.
export default function TriangleAngles({ value, onChange, locked }) {
  const svgRef = useRef(null);
  const dragging = useRef(null);
  const { pts } = value;
  const shown = shownAngles(pts);

  const moveTo = (i, p) => {
    const next = pts.map((q, j) => (j === i ? [Math.max(18, Math.min(W - 18, p[0])), Math.max(18, Math.min(H - 18, p[1]))] : q));
    if (area2(next) < 2400) return; // keep a real triangle (no collapsing to a line)
    onChange({ ...value, pts: next, touched: true });
  };

  const onMove = (e) => {
    if (dragging.current == null || locked) return;
    const p = svgPoint(svgRef.current, e);
    moveTo(dragging.current, [p.x, p.y]);
  };

  const onKey = (i) => (e) => {
    const d = { ArrowLeft: [-4, 0], ArrowRight: [4, 0], ArrowUp: [0, -4], ArrowDown: [0, 4] }[e.key];
    if (!d || locked) return;
    e.preventDefault();
    moveTo(i, [pts[i][0] + d[0], pts[i][1] + d[1]]);
  };

  const sumTex = shown.map((a, i) => colored(COLORS[i], `${a}^\\circ`)).join(' + ') + ' = 180^\\circ';

  return (
    <WidgetCard>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        dir="ltr"
        className="w-full h-auto select-none touch-none rounded-2xl bg-white/[0.025]"
        onPointerMove={onMove}
        onPointerUp={() => { dragging.current = null; }}
        onPointerCancel={() => { dragging.current = null; }}
      >
        <polygon points={pts.map((p) => p.join(',')).join(' ')} fill={C.violet} fillOpacity="0.1" stroke={C.violet} strokeWidth="3" strokeLinejoin="round" />
        {pts.map((p, i) => {
          const q = pts[(i + 1) % 3];
          const r = pts[(i + 2) % 3];
          const radius = Math.min(30, 0.38 * Math.min(len(sub(q, p)), len(sub(r, p))));
          const u = sub(q, p);
          const v = sub(r, p);
          const bis = [u[0] / len(u) + v[0] / len(v), u[1] / len(u) + v[1] / len(v)];
          const lb = len(bis) || 1;
          const lp = [p[0] + (bis[0] / lb) * (radius + 17), p[1] + (bis[1] / lb) * (radius + 17) + 4];
          return (
            <g key={'a' + i}>
              {shown[i] === 90 ? (
                <path d={rightMark(p, q, r, 16)} fill="none" stroke={COLORS[i]} strokeWidth="2.5" />
              ) : (
                <path d={arcPath(p, q, r, radius)} fill={COLORS[i]} fillOpacity="0.28" stroke={COLORS[i]} strokeWidth="2" />
              )}
              <text x={lp[0]} y={lp[1]} textAnchor="middle" fontSize="13" fontWeight="800" fill={COLORS[i]}>{shown[i]}°</text>
            </g>
          );
        })}
        {pts.map((p, i) => (
          <g
            key={'h' + i}
            transform={`translate(${p[0]} ${p[1]})`}
            tabIndex={locked ? -1 : 0}
            role="slider"
            aria-label={`קודקוד ${i + 1}, זווית ${shown[i]} מעלות`}
            aria-valuenow={shown[i]}
            onKeyDown={onKey(i)}
            onPointerDown={(e) => {
              if (locked) return;
              e.currentTarget.setPointerCapture(e.pointerId);
              dragging.current = i;
            }}
            style={{ cursor: locked ? 'default' : 'grab', outline: 'none' }}
          >
            <circle r="22" fill="transparent" />
            {!value.touched && i === 2 && <circle r="11" fill="none" stroke="white" strokeWidth="2" className="ping-ring" />}
            <circle r="10" fill="white" stroke={COLORS[i]} strokeWidth="4" />
          </g>
        ))}
      </svg>

      <div className="flex items-center justify-center gap-3">
        <Fan angles={shown} />
        <div className="text-lg sm:text-xl">
          <Tex>{sumTex}</Tex>
        </div>
      </div>
      <div className="text-center text-[11px] text-muted-foreground -mt-2">
        <Tex>{NAMES.map((n, i) => colored(COLORS[i], n)).join(',\\ ')}</Tex> · גרור את הנקודות הלבנות
      </div>
    </WidgetCard>
  );
}
