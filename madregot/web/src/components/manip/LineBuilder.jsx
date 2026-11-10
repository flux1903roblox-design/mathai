// Building y = mx + b with two handles, the way the class board does it: the point on the y-axis is b;
// one step right and m steps up (or down) is the second point. The equation above follows every move.
import { useRef } from 'react';
import { clamp, useDrag, Stepper, minus } from './core.jsx';
import { gridGeometry, Plane } from './grid.jsx';
import { Tex } from '../MathText.jsx';
import { useThemeName } from '@/lib/theme.js';

const fmt = (v) => `${v}`;
export const lineTex = ({ m, b }) => {
  const mt = m === 0 ? '' : m === 1 ? 'x' : m === -1 ? '-x' : `${fmt(m)}x`;
  if (!mt) return `y = ${fmt(b)}`;
  return `y = ${mt}${b === 0 ? '' : b > 0 ? ` + ${fmt(b)}` : ` - ${fmt(-b)}`}`;
};

// m and b keep one colour each across the equation, the drawing and the step buttons (m: the step, b: the intercept):
// m is the streak ink and b the violet unit ink. KaTeX's \color{} takes a name or a hex value, not var(), so the
// equation reads the two tokens when it is drawn, and draws again when the theme changes (useThemeName); a value that
// is not hex (or no stylesheet, in a unit test) leaves it plain.
const HEX = /^#[0-9a-f]{3,8}$/i;
export function lineInks(root = typeof document === 'undefined' ? null : document.documentElement) {
  if (!root) return { m: '', b: '' };
  const cs = getComputedStyle(root);
  const read = (name) => { const v = cs.getPropertyValue(name).trim(); return HEX.test(v) ? v : ''; };
  return { m: read('--streak-ink'), b: read('--ch-violet-ink') };
}
const paint = (ink, t) => (ink ? `\\color{${ink}}{${t}}` : t);
const lineTexColored = ({ m, b }, ink) => {
  const mm = m === 0 ? '' : m === 1 ? 'x' : m === -1 ? '-x' : `${paint(ink.m, fmt(m))}x`;
  const bb = (v) => paint(ink.b, fmt(v));
  if (!mm) return `y = ${bb(b)}`;
  return `y = ${mm}${b === 0 ? '' : b > 0 ? ` + ${bb(b)}` : ` - ${bb(-b)}`}`;
};

/** test: in a check, the equation of the line built so far (the target, once reached) is not written out. */
export default function LineBuilder({ m: spec, value, onChange, locked, reveal, good, answer, hint, test = false }) {
  const g = gridGeometry(spec.range || 6);
  const { r, X, Y } = g;
  const { m, b } = value;
  const which = useRef('b');
  const set = (nm, nb) => {
    const b2 = clamp(nb, -r, r); const m2 = clamp(nm, -r - b2, r - b2); // keep both handles on the grid
    if (!locked && (m2 !== m || b2 !== b)) onChange({ m: m2, b: b2 });
  };
  const [ref, drag] = useDrag((p, phase) => {
    if (phase === 'start') {
      // the handle nearer the touch moves; a touch on the y-axis column takes the intercept
      const dB = Math.hypot(p.x - X(0), p.y - Y(b)); const dS = Math.hypot(p.x - X(1), p.y - Y(b + m));
      which.current = dS < dB ? 's' : 'b';
    }
    const y = g.toY(p.y);
    if (which.current === 'b') set(m, y); else set(y - b, b);
  }, locked);
  const ends = (mm, bb) => [X(-r - 0.5), Y(mm * (-r - 0.5) + bb), X(r + 0.5), Y(mm * (r + 0.5) + bb)];
  const [x1, y1, x2, y2] = ends(m, b);
  const showGhost = reveal && answer && (answer.m !== m || answer.b !== b);
  useThemeName(); // the readout's two colours are read again when the theme changes
  return (
    <div className={`manip manip-line ${good ? 'good' : ''}`}>
      {!test && <div className="manip-readout" aria-live="polite"><Tex tex={lineTexColored(value, lineInks())} /></div>}
      <svg ref={ref} {...drag} viewBox={`0 0 ${g.size} ${g.size}`} className="manip-canvas" dir="ltr" role="img" aria-label={test ? 'ישר עם שתי נקודות לגרירה' : `הישר ${lineTex(value)}`}>
        <defs><clipPath id="lb-clip"><rect x={X(-r - 0.5)} y={Y(r + 0.5)} width={(2 * r + 1) * g.c} height={(2 * r + 1) * g.c} /></clipPath></defs>
        <Plane g={g}>
          {hint && (
            <g className="mp-hint">
              <rect x={X(0) - 9} y={Y(r + 0.5)} width="18" height={(2 * r + 1) * g.c} rx="9" className="band" />
              <text x={X(0) - 14} y={Y(r - 1) + 5} textAnchor="start" direction="rtl">b על ציר y</text>
              <path d={`M ${X(1)} ${Y(r + 0.5)} V ${Y(-r - 0.5)}`} />
              <text x={X(1) + 6} y={Y(-r) - 4}>x = 1</text>
            </g>
          )}
          {showGhost && (() => { const [a1, b1, a2, b2] = ends(answer.m, answer.b); return <line x1={a1} y1={b1} x2={a2} y2={b2} className="mp-ghost-line" clipPath="url(#lb-clip)" />; })()}
          <line x1={x1} y1={y1} x2={x2} y2={y2} className="mp-line" clipPath="url(#lb-clip)" />
          {/* the step: one to the right, m up or down */}
          <path d={`M ${X(0)} ${Y(b)} H ${X(1)} V ${Y(b + m)}`} className="mp-step" />
          <text x={(X(0) + X(1)) / 2} y={Y(b) + (m >= 0 ? 16 : -8)} textAnchor="middle" className="mp-step-label">1</text>
          {m !== 0 && <text x={X(1) + 8} y={(Y(b) + Y(b + m)) / 2 + 5} className="mp-step-label">{minus(m)}</text>}
          <g className="mp-point"><circle cx={X(0)} cy={Y(b)} r="13" className="mp-halo" /><circle cx={X(0)} cy={Y(b)} r="8" className="mp-handle alt" /></g>
          <g className="mp-point"><circle cx={X(1)} cy={Y(b + m)} r="13" className="mp-halo" /><circle cx={X(1)} cy={Y(b + m)} r="8" className="mp-handle" /></g>
        </Plane>
      </svg>
      <div className="manip-controls">
        <Stepper className="tone-b" label="b" sub="חיתוך" value={minus(b)} onDec={() => set(m, b - 1)} onInc={() => set(m, b + 1)} decLabel="להוריד את b" incLabel="להעלות את b" disabled={locked} decDisabled={b <= -r} incDisabled={b >= r} />
        <Stepper className="tone-m" label="m" sub="שיפוע" value={minus(m)} onDec={() => set(m - 1, b)} onInc={() => set(m + 1, b)} decLabel="להקטין את m" incLabel="להגדיל את m" disabled={locked} decDisabled={b + m <= -r} incDisabled={b + m >= r} />
      </div>
    </div>
  );
}
