import { C, Plane, fnPath, Curve, MathSlider, Tex, WidgetCard, colored, fmt } from './kit';

export function parabolaTex(a, h, k) {
  const A = a === 1 ? '' : a === -1 ? colored(C.amber, '-') : colored(C.amber, fmt(a));
  const inner = h === 0 ? 'x' : `(x ${h > 0 ? '-' : '+'} ${colored(C.pink, fmt(Math.abs(h)))})`;
  const K = k === 0 ? '' : ` ${k > 0 ? '+' : '-'} ${colored(C.cyan, fmt(Math.abs(k)))}`;
  if (a === 0) return `y = ${colored(C.cyan, fmt(k))}`;
  return `y = ${A}${inner}^2${K}`;
}

export const sameParabola = (v, t) => v.a === t.a && v.h === t.h && v.k === t.k;

// y = a(x-h)^2 + k explorer with an optional dashed "ghost" target to match.
export default function ParabolaPlayground({ value, onChange, locked, config = {} }) {
  const { a, h, k } = value;
  const { fixed = [], target } = config;
  const set = (patch) => onChange({ ...value, ...patch, touched: true });
  const matched = target && sameParabola(value, target);

  return (
    <WidgetCard>
      <div className="text-center text-xl sm:text-2xl py-1">
        <Tex>{parabolaTex(a, h, k)}</Tex>
      </div>

      <Plane>
        {({ sx, sy }) => (
          <>
            {target && (
              <>
                <Curve d={fnPath((x) => target.a * (x - target.h) ** 2 + target.k, sx, sy, -6, 6)} color="white" width={2.5} dashed opacity={0.55} />
                <circle cx={sx(target.h)} cy={sy(target.k)} r="7" fill="none" stroke="white" strokeOpacity="0.7" strokeWidth="2" strokeDasharray="3 3" />
              </>
            )}
            <line x1={sx(h)} x2={sx(h)} y1={0} y2={1000} stroke={C.pink} strokeOpacity="0.35" strokeWidth="1.5" strokeDasharray="5 5" />
            <Curve d={fnPath((x) => a * (x - h) ** 2 + k, sx, sy, -6, 6)} color={matched ? C.emerald : C.amber} />
            <circle cx={sx(h)} cy={sy(k)} r="7" fill={matched ? C.emerald : C.pink} stroke="hsl(240 10% 4%)" strokeWidth="2.5" />
            <text x={sx(h) + 10} y={sy(k) + (a >= 0 ? 18 : -10)} fontSize="12" fontWeight="800" fill="white">
              ({fmt(h)}, {fmt(k)})
            </text>
          </>
        )}
      </Plane>

      <div className="grid sm:grid-cols-3 gap-4">
        {!fixed.includes('a') && (
          <MathSlider label="a · צורה" value={a} min={-3} max={3} step={0.5} onChange={(v) => set({ a: v })} color={C.amber} disabled={locked} />
        )}
        {!fixed.includes('h') && (
          <MathSlider label="h · ימינה/שמאלה" value={h} min={-4} max={4} step={1} onChange={(v) => set({ h: v })} color={C.pink} disabled={locked} />
        )}
        {!fixed.includes('k') && (
          <MathSlider label="k · למעלה/למטה" value={k} min={-4} max={4} step={1} onChange={(v) => set({ k: v })} color={C.cyan} disabled={locked} />
        )}
      </div>
    </WidgetCard>
  );
}
