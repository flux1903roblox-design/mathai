import { C, MathSlider, Tex, WidgetCard, colored, fmt } from './kit';

const VIEW = 25; // world units visible (legs go up to 8; figure spans at most 24)
const U = 15; // px per unit

export const hyp = ({ a, b }) => Math.sqrt(a * a + b * b);

// Right triangle with a square built on every side — the areas show a² + b² = c².
export default function PythagorasSquares({ value, onChange, locked }) {
  const { a, b } = value;
  const c = hyp(value);
  const set = (patch) => onChange({ ...value, ...patch, touched: true });

  // keep the figure centred while it grows
  const ox = (VIEW - (a + 2 * b)) / 2 + b;
  const oy = (VIEW - (2 * a + b)) / 2 + a;
  const P = (x, y) => [(x + ox) * U, VIEW * U - (y + oy) * U];
  const poly = (pts) => pts.map((p) => P(...p).join(',')).join(' ');
  const mid = (pts) => P(pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length);

  const sqA = [[0, 0], [a, 0], [a, -a], [0, -a]];
  const sqB = [[0, 0], [0, b], [-b, b], [-b, 0]];
  const sqC = [[a, 0], [0, b], [b, b + a], [a + b, a]];

  const gridA = Array.from({ length: a - 1 }, (_, i) => i + 1);
  const gridB = Array.from({ length: b - 1 }, (_, i) => i + 1);
  const gridC = Array.from({ length: Math.ceil(c) - 1 }, (_, i) => i + 1);
  const n = [b / c, a / c]; // outward unit normal of the hypotenuse
  const t = [-a / c, b / c]; // unit vector along the hypotenuse (A → B)

  const cExact = Number.isInteger(Math.round(c * 1e9) / 1e9);
  const cTex = cExact ? fmt(c) : `\\sqrt{${a * a + b * b}} \\approx ${fmt(c)}`;
  const label = (pts, color, area, size) => {
    const [x, y] = mid(pts);
    const fs = Math.max(11, Math.min(26, size * U * 0.32));
    return <text x={x} y={y + fs * 0.35} textAnchor="middle" fontSize={fs} fontWeight="900" fill={color}>{area}</text>;
  };

  return (
    <WidgetCard>
      <div className="text-center space-y-1 py-1">
        <div className="text-xl sm:text-2xl">
          <Tex>{`${colored(C.amber, `${a}^2`)} + ${colored(C.pink, `${b}^2`)} = ${colored(C.violet, 'c^2')}`}</Tex>
        </div>
        <div className="text-base sm:text-lg text-foreground/80">
          <Tex>{`${colored(C.amber, a * a)} + ${colored(C.pink, b * b)} = ${colored(C.violet, a * a + b * b)} \\;\\Rightarrow\\; c = ${colored(C.violet, cTex)}`}</Tex>
        </div>
      </div>

      <svg viewBox={`0 0 ${VIEW * U} ${VIEW * U}`} dir="ltr" className="w-full max-w-sm mx-auto h-auto select-none rounded-2xl bg-white/[0.025]">
        {/* squares */}
        <polygon points={poly(sqA)} fill={C.amber} fillOpacity="0.22" stroke={C.amber} strokeWidth="2" />
        <polygon points={poly(sqB)} fill={C.pink} fillOpacity="0.22" stroke={C.pink} strokeWidth="2" />
        <polygon points={poly(sqC)} fill={C.violet} fillOpacity="0.22" stroke={C.violet} strokeWidth="2" />
        {/* unit grids so the areas can be counted */}
        <g strokeOpacity="0.35" strokeWidth="1">
          {gridA.map((i) => (
            <g key={'ga' + i} stroke={C.amber}>
              <line x1={P(i, 0)[0]} y1={P(i, 0)[1]} x2={P(i, -a)[0]} y2={P(i, -a)[1]} />
              <line x1={P(0, -i)[0]} y1={P(0, -i)[1]} x2={P(a, -i)[0]} y2={P(a, -i)[1]} />
            </g>
          ))}
          {gridB.map((i) => (
            <g key={'gb' + i} stroke={C.pink}>
              <line x1={P(-i, 0)[0]} y1={P(-i, 0)[1]} x2={P(-i, b)[0]} y2={P(-i, b)[1]} />
              <line x1={P(0, i)[0]} y1={P(0, i)[1]} x2={P(-b, i)[0]} y2={P(-b, i)[1]} />
            </g>
          ))}
          {gridC.map((i) => {
            const s = [a + t[0] * i, t[1] * i];
            const r = [a + n[0] * i, n[1] * i];
            return (
              <g key={'gc' + i} stroke={C.violet}>
                <line x1={P(...s)[0]} y1={P(...s)[1]} x2={P(s[0] + b, s[1] + a)[0]} y2={P(s[0] + b, s[1] + a)[1]} />
                <line x1={P(...r)[0]} y1={P(...r)[1]} x2={P(r[0] - a, r[1] + b)[0]} y2={P(r[0] - a, r[1] + b)[1]} />
              </g>
            );
          })}
        </g>
        {/* the triangle */}
        <polygon points={poly([[0, 0], [a, 0], [0, b]])} fill="hsl(240 10% 8%)" stroke="white" strokeWidth="3" strokeLinejoin="round" />
        <path d={`M${P(0.7, 0).join(' ')} L${P(0.7, 0.7).join(' ')} L${P(0, 0.7).join(' ')}`} fill="none" stroke="white" strokeOpacity="0.7" strokeWidth="1.5" />
        {label(sqA, C.amber, a * a, a)}
        {label(sqB, C.pink, b * b, b)}
        {label(sqC, C.violet, a * a + b * b, c)}
      </svg>

      <div className="grid sm:grid-cols-2 gap-4">
        <MathSlider label="a · ניצב" value={a} min={1} max={8} onChange={(v) => set({ a: v })} color={C.amber} disabled={locked} />
        <MathSlider label="b · ניצב" value={b} min={1} max={8} onChange={(v) => set({ b: v })} color={C.pink} disabled={locked} />
      </div>
    </WidgetCard>
  );
}
