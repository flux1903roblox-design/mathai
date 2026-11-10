import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Undo2 } from 'lucide-react';
import { C, Tex, WidgetCard, colored } from './kit';

const sideTex = (nx, n1) => {
  const parts = [];
  if (nx) parts.push(colored(C.violet, nx === 1 ? 'x' : `${nx}x`));
  if (n1) parts.push(colored(C.cyan, String(n1)));
  return parts.join(' + ') || '0';
};
export const equationTex = (v) => `${sideTex(v.lx, v.l1)} = ${sideTex(v.rx, v.r1)}`;

export const isIsolated = (v) =>
  (v.lx === 1 && v.l1 === 0 && v.rx === 0) || (v.rx === 1 && v.r1 === 0 && v.lx === 0);

// Specific, encouraging feedback for a not-yet-solved scale.
export function balanceHint(v) {
  const xs = v.lx || v.rx;
  if (v.lx && v.rx) return 'יש קופסאות x בשני הצדדים — נסה להוריד x משני הצדדים.';
  if ((v.lx && v.l1) || (v.rx && v.r1)) return 'ליד ה-x עדיין יש משקולות. הורד אותן משני הצדדים.';
  if (xs > 1) return `נשארו ${xs} קופסאות x. חלק את שני הצדדים ל-${xs} קבוצות שוות.`;
  return 'עוד לא בודדת את x.';
}

const PITCH = 34;
const PER_ROW = 4;
const BASE_Y = 155;
const rowsOf = (nx, n1) => Math.max(1, Math.ceil((nx + n1) / PER_ROW));
function layout(nx, n1, cx) {
  const items = [...Array(nx).fill('x'), ...Array(n1).fill('1')];
  return items.map((kind, i) => {
    const row = Math.floor(i / PER_ROW);
    const inRow = Math.min(PER_ROW, items.length - row * PER_ROW);
    const col = i % PER_ROW;
    return { kind, key: kind === 'x' ? `x${i}` : `u${i - nx}`, x: cx + (col - (inRow - 1) / 2) * PITCH, y: BASE_Y - row * PITCH };
  });
}

function Block({ kind, x, y, glow }) {
  const isX = kind === 'x';
  return (
    <motion.g
      initial={{ x, y: y - 24, opacity: 0, scale: 0.5 }}
      animate={{ x, y, opacity: 1, scale: 1 }}
      exit={{ y: y - 36, opacity: 0, scale: 0.6 }}
      transition={{ type: 'spring', stiffness: 420, damping: 26 }}
    >
      {glow && <rect x="-19" y="-19" width="38" height="38" rx="10" fill="none" stroke={C.emerald} strokeWidth="2" className="ping-ring" />}
      <rect x="-15" y="-15" width="30" height="30" rx="8" fill={isX ? C.violet : C.cyan} />
      <rect x="-15" y="10" width="30" height="5" rx="2.5" fill="black" opacity="0.2" />
      <text y="5.5" textAnchor="middle" fontSize={isX ? 19 : 15} fontWeight="900" fontStyle={isX ? 'italic' : 'normal'} fontFamily={isX ? 'serif' : 'inherit'} fill={isX ? 'white' : '#083344'}>
        {isX ? 'x' : '1'}
      </text>
    </motion.g>
  );
}

// Equation as a balance: both sides always weigh the same; legal moves act on both sides at once.
export default function BalanceScale({ value, onChange, locked, config }) {
  const { ops = ['sub1', 'subx', 'div'] } = config;
  const v = value;
  const beamRef = useRef(null);
  const moves = v.hist?.length || 0;
  const done = isIsolated(v);

  // little wobble every time weights change — the scale "settles"
  useEffect(() => {
    if (!moves || !beamRef.current?.animate) return;
    beamRef.current.animate(
      [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-4deg)' }, { transform: 'rotate(2.5deg)' }, { transform: 'rotate(-1deg)' }, { transform: 'rotate(0deg)' }],
      { duration: 750, easing: 'ease-out' },
    );
  }, [moves]);

  const apply = (next) => onChange({ ...next, hist: [...(v.hist || []), { lx: v.lx, l1: v.l1, rx: v.rx, r1: v.r1 }], touched: true });
  const undo = () => {
    const hist = [...(v.hist || [])];
    const prev = hist.pop();
    if (prev) onChange({ ...v, ...prev, hist });
  };

  const divisors = [2, 3, 4, 5].filter(
    (d) => [v.lx, v.l1, v.rx, v.r1].every((n) => n % d === 0) && v.lx + v.rx >= d,
  );
  const buttons = [
    ops.includes('sub1') && { sym: '−1', label: 'משני הצדדים', ok: v.l1 > 0 && v.r1 > 0, run: () => apply({ ...v, l1: v.l1 - 1, r1: v.r1 - 1 }) },
    ops.includes('subx') && { sym: '−x', label: 'משני הצדדים', ok: v.lx > 0 && v.rx > 0, run: () => apply({ ...v, lx: v.lx - 1, rx: v.rx - 1 }) },
    ...(ops.includes('div')
      ? (divisors.length ? divisors : [2]).map((d) => ({
          sym: `÷${d}`,
          label: 'לשני הצדדים',
          ok: divisors.includes(d),
          run: () => apply({ lx: v.lx / d, l1: v.l1 / d, rx: v.rx / d, r1: v.r1 / d }),
        }))
      : []),
  ].filter(Boolean);

  const left = layout(v.lx, v.l1, 100);
  const right = layout(v.rx, v.r1, 300);
  const first = v.hist?.[0] || v;
  const rows = Math.max(rowsOf(first.lx, first.l1), rowsOf(first.rx, first.r1));
  const top = BASE_Y - (rows - 1) * PITCH - 30;

  return (
    <WidgetCard>
      <div className={`text-center text-2xl sm:text-3xl py-1 transition ${done ? 'scale-110' : ''}`}>
        <Tex>{equationTex(v)}</Tex>
      </div>

      <svg viewBox={`0 ${top} 400 ${245 - top}`} dir="ltr" className="w-full h-auto select-none">
        {/* ground + fulcrum */}
        <line x1="130" x2="270" y1="238" y2="238" stroke="rgba(255,255,255,0.18)" strokeWidth="3" strokeLinecap="round" />
        <path d="M200 192 L174 238 L226 238 Z" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinejoin="round" />
        <g ref={beamRef} style={{ transformBox: 'view-box', transformOrigin: '200px 186px' }}>
          <rect x="20" y="181" width="360" height="9" rx="4.5" fill="rgba(255,255,255,0.35)" />
          <rect x="22" y="172" width="156" height="9" rx="3" fill="rgba(255,255,255,0.18)" />
          <rect x="222" y="172" width="156" height="9" rx="3" fill="rgba(255,255,255,0.18)" />
          <circle cx="200" cy="186" r="6" fill="hsl(240 10% 6%)" stroke="rgba(255,255,255,0.5)" strokeWidth="2" />
          <AnimatePresence>
            {[...left.map((b) => ({ ...b, side: 'L' })), ...right.map((b) => ({ ...b, side: 'R' }))].map((b) => (
              <Block key={b.side + b.key} kind={b.kind} x={b.x} y={b.y} glow={done && b.kind === 'x'} />
            ))}
          </AnimatePresence>
        </g>
      </svg>

      <div className="flex flex-wrap gap-2 justify-center">
        {buttons.map((btn) => (
          <button
            key={btn.sym}
            type="button"
            disabled={locked || !btn.ok || done}
            onClick={btn.run}
            aria-label={`${btn.sym} ${btn.label}`}
            className="btn-chunky chunky-ghost px-3.5 py-2.5 text-sm flex items-center gap-1.5"
          >
            <bdi dir="ltr" className="font-extrabold text-base">{btn.sym}</bdi> {btn.label}
          </button>
        ))}
        <button
          type="button"
          disabled={locked || !moves}
          onClick={undo}
          aria-label="בטל צעד"
          className="btn-chunky chunky-ghost px-3 py-2.5 text-sm flex items-center gap-1.5"
        >
          <Undo2 className="w-4 h-4" /> בטל
        </button>
      </div>
    </WidgetCard>
  );
}
