import { useRef } from 'react';
import { C, MathSlider, Tex, WidgetCard, svgPoint, colored, fmt } from './kit';

const S = 340;
const CX = S / 2;
const CY = S / 2;
const R = 125;
const rad = (d) => (d * Math.PI) / 180;

export const sinOf = (deg) => Math.round(Math.sin(rad(deg)) * 1e6) / 1e6;
export const cosOf = (deg) => Math.round(Math.cos(rad(deg)) * 1e6) / 1e6;

// Drag a point around the unit circle; cos is the horizontal leg, sin the vertical one.
export default function UnitCircle({ value, onChange, locked }) {
  const svgRef = useRef(null);
  const dragging = useRef(false);
  const deg = value.deg;
  const c = cosOf(deg);
  const s = sinOf(deg);
  const P = [CX + R * c, CY - R * s];
  const setDeg = (d) => onChange({ ...value, deg: ((Math.round(d / 5) * 5) % 360 + 360) % 360, touched: true });

  const onMove = (e) => {
    if (!dragging.current || locked) return;
    const p = svgPoint(svgRef.current, e);
    setDeg((Math.atan2(CY - p.y, p.x - CX) * 180) / Math.PI);
  };

  const ar = 30;
  const arcEnd = [CX + ar * c, CY - ar * s];
  const lab = [CX + (ar + 16) * cosOf(deg / 2), CY - (ar + 16) * sinOf(deg / 2) + 4];

  return (
    <WidgetCard>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${S} ${S}`}
        dir="ltr"
        className="w-full max-w-sm mx-auto h-auto select-none touch-none rounded-2xl bg-white/[0.025]"
        onPointerMove={onMove}
        onPointerUp={() => { dragging.current = false; }}
        onPointerCancel={() => { dragging.current = false; }}
      >
        {/* quadrants */}
        {[['I', 1, -1], ['II', -1, -1], ['III', -1, 1], ['IV', 1, 1]].map(([q, dx, dy]) => (
          <text key={q} x={CX + dx * 140} y={CY + dy * 140 + 5} textAnchor="middle" fontSize="13" fontWeight="800" fill="rgba(255,255,255,0.18)">{q}</text>
        ))}
        <line x1="8" x2={S - 8} y1={CY} y2={CY} stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
        <line y1="8" y2={S - 8} x1={CX} x2={CX} stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="2" />
        {[[1, 0], [-1, 0], [0, 1], [0, -1]].map(([x, y]) => (
          <text key={`${x}${y}`} x={CX + x * (R + 14) + (y ? 10 : 0)} y={CY - y * (R + 8) + (x ? -6 : y > 0 ? 0 : 12)} textAnchor="middle" fontSize="11" fontWeight="700" fill="rgba(255,255,255,0.45)">
            {x || y}
          </text>
        ))}

        {/* angle arc */}
        {deg > 0 && (
          <path d={`M${CX} ${CY} L${CX + ar} ${CY} A${ar} ${ar} 0 ${deg > 180 ? 1 : 0} 0 ${arcEnd[0]} ${arcEnd[1]} Z`} fill={C.amber} fillOpacity="0.25" stroke={C.amber} strokeWidth="2" />
        )}
        <text x={lab[0]} y={lab[1]} textAnchor="middle" fontSize="12" fontWeight="800" fill={C.amber}>θ</text>

        {/* cos (horizontal) and sin (vertical) legs */}
        <line x1={CX} y1={CY} x2={P[0]} y2={P[1]} stroke="white" strokeOpacity="0.85" strokeWidth="2.5" />
        <line x1={CX} y1={CY} x2={P[0]} y2={CY} stroke={C.cyan} strokeWidth="6" strokeLinecap="round" />
        <line x1={P[0]} y1={CY} x2={P[0]} y2={P[1]} stroke={C.pink} strokeWidth="6" strokeLinecap="round" />
        <text x={(CX + P[0]) / 2} y={CY + (s >= 0 ? 18 : -9)} textAnchor="middle" fontSize="12" fontWeight="800" fill={C.cyan}>cos</text>
        <text x={P[0] + (c >= 0 ? 10 : -10)} y={(CY + P[1]) / 2 + 4} textAnchor={c >= 0 ? 'start' : 'end'} fontSize="12" fontWeight="800" fill={C.pink}>sin</text>

        <g
          transform={`translate(${P[0]} ${P[1]})`}
          onPointerDown={(e) => {
            if (locked) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            dragging.current = true;
          }}
          style={{ cursor: locked ? 'default' : 'grab' }}
        >
          <circle r="24" fill="transparent" />
          {!value.touched && <circle r="12" fill="none" stroke="white" strokeWidth="2" className="ping-ring" />}
          <circle r="11" fill="white" stroke={C.amber} strokeWidth="4" />
        </g>
      </svg>

      <div className="grid grid-cols-3 gap-2 text-center" dir="ltr">
        {[
          ['\\theta', `${deg}^\\circ`, C.amber],
          ['\\cos\\theta', fmt(c), C.cyan],
          ['\\sin\\theta', fmt(s), C.pink],
        ].map(([k, v, col]) => (
          <div key={k} className="rounded-xl py-2" style={{ background: `${col}17`, border: `1px solid ${col}40` }}>
            <Tex>{`${colored(col, k)} = ${v}`}</Tex>
          </div>
        ))}
      </div>

      <MathSlider label="θ · זווית" value={deg} min={0} max={355} step={5} onChange={setDeg} color={C.amber} disabled={locked} format={(d) => `${d}°`} />
    </WidgetCard>
  );
}
