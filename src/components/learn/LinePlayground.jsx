import { C, Plane, fnPath, Curve, TargetDot, MathSlider, Tex, WidgetCard, colored, fmt } from './kit';

export const onLine = (m, b, [x, y]) => Math.abs(m * x + b - y) < 1e-9;

export function lineTex(m, b) {
  const bPart = b < 0 ? `- ${colored(C.cyan, fmt(-b))}` : `+ ${colored(C.cyan, fmt(b))}`;
  return `y = ${colored(C.violet, fmt(m))}x ${bPart}`;
}

// y = mx + b explorer: sliders for m (slope) and b (intercept), optional slope triangle and target points.
export default function LinePlayground({ value, onChange, locked, config = {} }) {
  const { m, b } = value;
  const { fixed = [], targets = [], showTriangle = false } = config;
  const set = (patch) => onChange({ ...value, ...patch, touched: true });

  return (
    <WidgetCard>
      <div className="text-center text-xl sm:text-2xl py-1">
        <Tex>{lineTex(m, b)}</Tex>
      </div>

      <Plane>
        {({ sx, sy }) => (
          <>
            <Curve d={fnPath((x) => m * x + b, sx, sy, -6, 6, 2)} color={C.violet} />
            {showTriangle && m !== 0 && (
              <g>
                <line x1={sx(0)} y1={sy(b)} x2={sx(1)} y2={sy(b)} stroke="white" strokeOpacity="0.7" strokeWidth="2" strokeDasharray="4 4" />
                <line x1={sx(1)} y1={sy(b)} x2={sx(1)} y2={sy(b + m)} stroke={C.violet} strokeWidth="3.5" strokeLinecap="round" />
                <text x={(sx(0) + sx(1)) / 2} y={sy(b) + (m > 0 ? 15 : -7)} textAnchor="middle" fontSize="12" fontWeight="800" fill="white">1</text>
                <text x={sx(1) + 7} y={(sy(b) + sy(b + m)) / 2 + 4} fontSize="13" fontWeight="800" fill={C.violet}>{fmt(m)}</text>
              </g>
            )}
            {/* y-intercept */}
            <circle cx={sx(0)} cy={sy(b)} r="6" fill={C.cyan} stroke="hsl(240 10% 4%)" strokeWidth="2" />
            {targets.map((p) => (
              <TargetDot key={p.join()} x={sx(p[0])} y={sy(p[1])} hit={onLine(m, b, p)} label={`(${p[0]}, ${p[1]})`} />
            ))}
          </>
        )}
      </Plane>

      <div className="grid sm:grid-cols-2 gap-4">
        {!fixed.includes('m') && (
          <MathSlider label="m · שיפוע" value={m} min={-4} max={4} step={0.5} onChange={(v) => set({ m: v })} color={C.violet} disabled={locked} />
        )}
        {!fixed.includes('b') && (
          <MathSlider label="b · חיתוך עם ציר y" value={b} min={-5} max={5} step={1} onChange={(v) => set({ b: v })} color={C.cyan} disabled={locked} />
        )}
      </div>
    </WidgetCard>
  );
}
