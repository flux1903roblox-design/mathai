// Algebra tiles (אריחים): an x tile and a −x tile together are zero, and so are a 1 and a −1. The student removes
// zero pairs until none is left; what remains is the expression collected. The tiles are too small to be targets
// on a phone, so a whole row is: a tap (or a drag) on the x row removes one x pair, on the unit row one unit pair.
// The step buttons remove a pair or add one back (adding zero changes nothing, which is the point). After a wrong
// check the hint rings one zero pair in each row that still has one.
// A negative tile has a dashed outline and a minus sign, never a colour of its own.
import { useRef } from 'react';
import clsx from 'clsx';
import { useDrag, arrowKeys, Stepper } from './core.jsx';
import { Tex } from '../MathText.jsx';
import { TILES_MAX, tilesTex, tilesPairs, tilesWords } from '@/content/manip.js';

const W = 360; const H = 196;
const XT = { w: 58, h: 42 }; const UT = { w: 38, h: 36 }; const GAP = 5; const SPLIT = 16;
const ROW_X = 34; const ROW_U = 124; // the top of each row's tiles

/** One row: the positive tiles, a little space, then the negative ones; centred. */
function rowLayout(pos, neg, t) {
  const n = pos + neg;
  const width = n * t.w + Math.max(0, n - 1) * GAP + (pos && neg ? SPLIT - GAP : 0);
  const x0 = (W - width) / 2;
  return Array.from({ length: n }, (_, i) => ({ x: x0 + i * (t.w + GAP) + (i >= pos && pos ? SPLIT - GAP : 0), neg: i >= pos }));
}

/** The drawing of the tiles, shared by the object and by the static figure. `hl` rings one zero pair per row. */
export function TilesArt({ u, hl = false }) {
  const row = (pos, neg, t, y, label) => {
    const L = rowLayout(pos, neg, t);
    return (
      <g>
        {L.map((p, i) => (
          <g key={i} className={clsx('mp-tile', p.neg ? 'neg' : 'pos')}>
            <rect x={p.x} y={y} width={t.w} height={t.h} rx="7" />
            <text x={p.x + t.w / 2} y={y + t.h / 2 + 7} textAnchor="middle" className={label === 'x' ? 'var' : 'unit'}>{p.neg ? `−${label}` : label}</text>
          </g>
        ))}
        {hl && pos > 0 && neg > 0 && (
          <rect x={L[pos - 1].x - 5} y={y - 5} width={L[pos].x + t.w - L[pos - 1].x + 10} height={t.h + 10} rx="11" className="mp-tile-pair" />
        )}
      </g>
    );
  };
  return (
    <>
      {row(u.px, u.nx, XT, ROW_X, 'x')}
      <line x1="24" x2={W - 24} y1={(ROW_X + XT.h + ROW_U) / 2} y2={(ROW_X + XT.h + ROW_U) / 2} className="mp-tile-rule" />
      {row(u.p1, u.n1, UT, ROW_U, '1')}
    </>
  );
}
export const TILES_VIEW = `0 0 ${W} ${H}`;

export default function Tiles({ m, value, onChange, locked, good, hint }) {
  const u = value || m.start;
  const pairs = tilesPairs(u);
  const set = (next) => { if (!locked && next && (next.px !== u.px || next.nx !== u.nx || next.p1 !== u.p1 || next.n1 !== u.n1)) onChange(next); };
  const xPair = (d) => set(d < 0 ? (pairs.x ? { ...u, px: u.px - 1, nx: u.nx - 1 } : null) : (u.px + u.nx + 2 <= TILES_MAX.x ? { ...u, px: u.px + 1, nx: u.nx + 1 } : null));
  const uPair = (d) => set(d < 0 ? (pairs.unit ? { ...u, p1: u.p1 - 1, n1: u.n1 - 1 } : null) : (u.p1 + u.n1 + 2 <= TILES_MAX.unit ? { ...u, p1: u.p1 + 1, n1: u.n1 + 1 } : null));
  // a tap or a drag on a row removes one zero pair from it
  const row = useRef(null);
  const rowAt = (p) => (p.y < (ROW_X + XT.h + ROW_U) / 2 ? 'x' : 'u');
  const [ref, drag] = useDrag((p, phase) => {
    if (phase === 'start') row.current = rowAt(p);
    if (phase === 'end' && row.current) { const r = row.current; row.current = null; if (r === 'x') xPair(-1); else uPair(-1); }
  }, locked);
  return (
    <div className={clsx('manip', 'manip-tiles', good && 'good')}>
      <div className="manip-readout" aria-live="polite"><Tex tex={tilesTex(u)} /></div>
      <svg ref={ref} {...drag} viewBox={TILES_VIEW} className="manip-canvas" dir="ltr" tabIndex={locked ? -1 : 0}
        role="application" aria-roledescription="אריחים" aria-label={`${tilesWords(u)}. ${pairs.x || pairs.unit ? `זוגות אפס: ${pairs.x} בשורת ה־x ו־${pairs.unit} בשורת ה־1` : 'אין זוגות אפס'}`}
        onKeyDown={arrowKeys({ down: () => xPair(-1), up: () => xPair(1), left: () => uPair(-1), right: () => uPair(1) })}>
        <rect x="0" y="0" width={W} height={H} className="mp-hit" />
        <TilesArt u={u} hl={hint} />
      </svg>
      <div className="manip-controls">
        <Stepper label="זוג x" value={pairs.x} onDec={() => xPair(-1)} onInc={() => xPair(1)} decLabel="להוריד זוג אפס של x" incLabel="להוסיף זוג אפס של x" disabled={locked} decDisabled={!pairs.x} incDisabled={u.px + u.nx + 2 > TILES_MAX.x} />
        <Stepper label="זוג 1" value={pairs.unit} onDec={() => uPair(-1)} onInc={() => uPair(1)} decLabel="להוריד זוג אפס של 1" incLabel="להוסיף זוג אפס של 1" disabled={locked} decDisabled={!pairs.unit} incDisabled={u.p1 + u.n1 + 2 > TILES_MAX.unit} />
      </div>
    </div>
  );
}

/** What the tiles show, for מדי (Manip.jsx). */
export function tilesCoach(m, v, touched) {
  const u = v || m.start;
  const p = tilesPairs(u);
  if (!touched) return 'הקישו על שורה כדי להוריד ממנה זוג אפס: אריח ואריח נגדי.';
  if (!p.x && !p.unit) return 'אין יותר זוגות אפס. מה שנשאר הוא הביטוי המכונס.';
  const n = p.x + p.unit;
  return n === 1 ? 'נשאר זוג אפס אחד. הוא שווה אפס, ולכן הורדתו לא משנה את הביטוי.' : `נשארו ${n} זוגות אפס. כל זוג שווה אפס, ולכן הורדתו לא משנה את הביטוי.`;
}
