import { useId, useMemo } from 'react';
import katex from 'katex';

// Palette shared by all interactive widgets (SVG strokes + KaTeX \textcolor)
export const C = {
  violet: '#a78bfa',
  cyan: '#22d3ee',
  pink: '#f472b6',
  amber: '#fbbf24',
  emerald: '#34d399',
  rose: '#fb7185',
};

export const fmt = (n) => {
  const r = Math.round(n * 100) / 100;
  return Object.is(r, -0) ? '0' : String(r);
};
export const colored = (color, s) => `\\textcolor{${color}}{${s}}`;

// Inline/display KaTeX, isolated as LTR inside the RTL page.
export function Tex({ children, display = false, className = '' }) {
  const html = useMemo(
    () => katex.renderToString(String(children), { throwOnError: false, displayMode: display }),
    [children, display],
  );
  return <span dir="ltr" className={`inline-block ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function MathSlider({ label, value, min, max, step = 1, onChange, color = C.violet, disabled, format = fmt }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <label className="block" dir="ltr">
      <div className="flex items-center justify-between mb-1 text-sm">
        <span className="font-bold" style={{ color }}>{label}</span>
        <span className="tabular-nums font-extrabold font-mono text-base rounded-lg px-2 py-0.5" style={{ color, background: `${color}1f` }}>
          {format(value)}
        </span>
      </div>
      <input
        type="range"
        className="math-range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ '--fill': `${pct}%`, '--c': color }}
      />
    </label>
  );
}

// Client (pointer) coordinates → SVG viewBox coordinates.
export function svgPoint(svg, e) {
  const pt = svg.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
}

const ints = (a, b) => Array.from({ length: Math.floor(b) - Math.ceil(a) + 1 }, (_, i) => Math.ceil(a) + i);

// Cartesian plane with grid + axes. `children({ sx, sy })` draws in math coordinates.
export function Plane({ xMin = -6, xMax = 6, yMin = -6, yMax = 6, width = 360, labelEvery = 2, svgRef, children, ...rest }) {
  const clip = 'clip' + useId().replace(/:/g, '');
  const H = (width * (yMax - yMin)) / (xMax - xMin);
  const sx = (x) => ((x - xMin) / (xMax - xMin)) * width;
  const sy = (y) => H - ((y - yMin) / (yMax - yMin)) * H;
  const label = { fontSize: 10, fill: 'rgba(255,255,255,0.4)', fontWeight: 600 };
  return (
    <svg ref={svgRef} viewBox={`0 0 ${width} ${H}`} dir="ltr" className="w-full h-auto select-none touch-none" {...rest}>
      <defs>
        <clipPath id={clip}><rect width={width} height={H} rx="16" /></clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <rect width={width} height={H} fill="rgba(255,255,255,0.025)" />
        {ints(xMin, xMax).map((x) => (
          <line key={'gx' + x} x1={sx(x)} x2={sx(x)} y1={0} y2={H} stroke="rgba(255,255,255,0.06)" />
        ))}
        {ints(yMin, yMax).map((y) => (
          <line key={'gy' + y} y1={sy(y)} y2={sy(y)} x1={0} x2={width} stroke="rgba(255,255,255,0.06)" />
        ))}
        <line x1={0} x2={width} y1={sy(0)} y2={sy(0)} stroke="rgba(255,255,255,0.32)" strokeWidth="1.5" />
        <line y1={0} y2={H} x1={sx(0)} x2={sx(0)} stroke="rgba(255,255,255,0.32)" strokeWidth="1.5" />
        {ints(xMin + 1, xMax - 1).filter((x) => x !== 0 && x % labelEvery === 0).map((x) => (
          <text key={'lx' + x} x={sx(x)} y={sy(0) + 14} textAnchor="middle" {...label}>{x}</text>
        ))}
        {ints(yMin + 1, yMax - 1).filter((y) => y !== 0 && y % labelEvery === 0).map((y) => (
          <text key={'ly' + y} x={sx(0) - 6} y={sy(y) + 3.5} textAnchor="end" {...label}>{y}</text>
        ))}
        {children?.({ sx, sy, W: width, H })}
      </g>
    </svg>
  );
}

// SVG path for y = f(x) sampled across [x0, x1] (values clamped so the path stays finite).
export function fnPath(f, sx, sy, x0, x1, steps = 240) {
  let d = '';
  for (let i = 0; i <= steps; i++) {
    const x = x0 + ((x1 - x0) * i) / steps;
    const y = f(x);
    if (!Number.isFinite(y)) continue;
    const Y = Math.max(-5000, Math.min(5000, sy(y)));
    d += `${d ? 'L' : 'M'}${sx(x).toFixed(2)} ${Y.toFixed(2)}`;
  }
  return d;
}

// Glowing curve: soft wide stroke under a crisp one.
export function Curve({ d, color, width = 3.5, dashed = false, opacity = 1 }) {
  return (
    <g opacity={opacity}>
      {!dashed && <path d={d} fill="none" stroke={color} strokeWidth={width * 3.2} strokeOpacity="0.16" strokeLinecap="round" />}
      <path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={dashed ? '7 7' : undefined} />
    </g>
  );
}

// Target point that pulses until it is hit, then turns green.
export function TargetDot({ x, y, hit, label }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {!hit && <circle r="9" fill="none" stroke="white" strokeWidth="2" className="ping-ring" />}
      <circle r={hit ? 8 : 7} fill={hit ? C.emerald : 'hsl(240 10% 6%)'} stroke={hit ? C.emerald : 'white'} strokeWidth="2.5" style={{ transition: 'all .25s' }} />
      {hit && <path d="M-3.5 0.5 L-1 3 L3.8 -2.6" fill="none" stroke="#052e16" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />}
      {label && (
        <text x="11" y="-10" fontSize="11" fontWeight="700" fill={hit ? C.emerald : 'rgba(255,255,255,0.85)'}>{label}</text>
      )}
    </g>
  );
}

// Card shell every interactive sits in.
export function WidgetCard({ children, className = '' }) {
  return <div className={`card-base p-4 sm:p-5 space-y-4 ${className}`}>{children}</div>;
}
