// The area model of the distributive law (מלבן): a rectangle a units high whose length is x (a long part of a length
// we do not know, marked with a break) and b units. Each part shows its own area, ax and ab, so a(x + b) = ax + ab is
// read off the drawing. The student builds it by dragging the top edge (the height) and the right edge (the units).
// Lengths are positive whole numbers: negative brackets are taught with the sign rules, not with areas.
// In a check (`test`) the rectangle keeps its lengths but not its areas: the line a(x + b) = ax + ab and the areas
// written in the parts are what the student is asked for, so they are left out.
import { useRef } from 'react';
import clsx from 'clsx';
import { clamp, useDrag, arrowKeys, Stepper } from './core.jsx';
import { Tex } from '../MathText.jsx';
import { areaTex, areaSumTex } from '@/content/manip.js';
import { linText } from '@/content/util.js';

const W = 360; const H = 236;
const OX = 40; const BOT = 206; const U = 23; const XW = 92; // the x part is drawn this long

/** The drawing of the rectangle, shared by the object and by the static figure. `areas` writes each part's area. */
export function AreaArt({ a, b, areas = true, ghost = null }) {
  const top = BOT - a * U; const right = OX + XW + b * U;
  const rows = []; for (let r = 1; r < a; r += 1) rows.push(BOT - r * U);
  const cols = []; for (let c = 1; c < b; c += 1) cols.push(OX + XW + c * U);
  const brk = (x, y) => <path d={`M ${x - 5} ${y + 7} L ${x + 1} ${y - 7} M ${x + 3} ${y + 7} L ${x + 9} ${y - 7}`} className="mp-area-break" />;
  return (
    <>
      {ghost && <rect x={OX} y={BOT - ghost.a * U} width={XW + ghost.b * U} height={ghost.a * U} className="mp-area-ghost" />}
      <rect x={OX} y={top} width={XW} height={a * U} className="mp-area-x" />
      {b > 0 && <rect x={OX + XW} y={top} width={b * U} height={a * U} className="mp-area-u" />}
      {rows.map((y) => <line key={`r${y}`} x1={OX} x2={right} y1={y} y2={y} className="mp-area-grid" />)}
      {cols.map((x) => <line key={`c${x}`} x1={x} x2={x} y1={top} y2={BOT} className="mp-area-grid" />)}
      <rect x={OX} y={top} width={right - OX} height={a * U} className="mp-area-edge" />
      {b > 0 && <line x1={OX + XW} x2={OX + XW} y1={top} y2={BOT} className="mp-area-split" />}
      {/* the x part's length is unknown: a break on its edges */}
      {brk(OX + XW / 2, top)}{brk(OX + XW / 2, BOT)}
      {/* the lengths: x and b on top, a on the left */}
      <text x={OX + XW / 2} y={top - 12} textAnchor="middle" className="mp-area-len var">x</text>
      {b > 0 && <text x={OX + XW + (b * U) / 2} y={top - 12} textAnchor="middle" className="mp-area-len">{b}</text>}
      <text x={OX - 12} y={(top + BOT) / 2 + 7} textAnchor="end" className="mp-area-len">{a}</text>
      {areas && <text x={OX + XW / 2} y={(top + BOT) / 2 + 8} textAnchor="middle" className="mp-area-val">{a === 1 ? '' : a}<tspan className="var">x</tspan></text>}
      {areas && b > 0 && <text x={OX + XW + (b * U) / 2} y={(top + BOT) / 2 + 8} textAnchor="middle" className="mp-area-val">{a * b}</text>}
    </>
  );
}
export const AREA_VIEW = `0 0 ${W} ${H}`;
/** A still figure frames only its rectangle and labels (the object keeps room to grow). */
export const areaView = ({ a, b }) => { const x0 = OX - 34; const y0 = BOT - a * U - 38; return `${x0} ${y0} ${XW + b * U + 34 + 14} ${a * U + 38 + 26}`; };
export const AREA_GEOM = { OX, BOT, U, XW };

export default function AreaModel({ m, value, onChange, locked, reveal, good, answer, hint, test = false }) {
  const maxA = m.maxA || 6; const maxB = m.maxB || 9;
  const { a, b } = value || m.start;
  const set = (na, nb) => { const A = clamp(na, 1, maxA); const B = clamp(nb, 0, maxB); if (!locked && (A !== a || B !== b)) onChange({ a: A, b: B }); };
  const which = useRef('a');
  const top = BOT - a * U; const right = OX + XW + b * U;
  const [ref, drag] = useDrag((p, phase) => {
    if (phase === 'start') {
      // the handle nearer the touch: the top edge sets the height, the right edge the units
      const dTop = Math.hypot(p.x - (OX + (right - OX) / 2), p.y - top); const dRight = Math.hypot(p.x - right, p.y - (top + BOT) / 2);
      which.current = dRight < dTop ? 'b' : 'a';
    }
    if (which.current === 'a') set(Math.round((BOT - p.y) / U), b); else set(a, Math.round((p.x - OX - XW) / U));
  }, locked);
  const showGhost = reveal && answer && (answer.a !== a || answer.b !== b);
  return (
    <div className={clsx('manip', 'manip-area', good && 'good')}>
      {!test && <div className="manip-readout" aria-live="polite"><Tex tex={`${areaTex({ a, b })} = ${areaSumTex({ a, b })}`} /></div>}
      {hint && <p className="manip-hint-line">הגובה כופל את כל האורך: גם את x וגם את היחידות.</p>}
      <svg ref={ref} {...drag} viewBox={AREA_VIEW} className="manip-canvas" dir="ltr" tabIndex={locked ? -1 : 0}
        role="application" aria-roledescription="מלבן" aria-label={test ? `מלבן בגובה ${a} ובאורך x ועוד ${b}` : `מלבן בגובה ${a} ובאורך x ועוד ${b}. השטח ${areaSumTex({ a, b })}`}
        onKeyDown={arrowKeys({ up: () => set(a + 1, b), down: () => set(a - 1, b), right: () => set(a, b + 1), left: () => set(a, b - 1) })}>
        <rect x="0" y="0" width={W} height={H} className="mp-hit" />
        <AreaArt a={a} b={b} areas={!test} ghost={showGhost ? answer : null} />
        {hint && <path d={`M ${OX - 22} ${BOT} V ${top}`} className="mp-area-hint" />}
        <g className="mp-point"><circle cx={OX + (right - OX) / 2} cy={top} r="13" className="mp-halo" /><circle cx={OX + (right - OX) / 2} cy={top} r="8" className="mp-handle" /></g>
        <g className="mp-point"><circle cx={right} cy={(top + BOT) / 2} r="13" className="mp-halo" /><circle cx={right} cy={(top + BOT) / 2} r="8" className="mp-handle alt" /></g>
      </svg>
      <div className="manip-controls">
        <Stepper label="גובה" value={a} onDec={() => set(a - 1, b)} onInc={() => set(a + 1, b)} decLabel="להנמיך את המלבן" incLabel="להגביה את המלבן" disabled={locked} decDisabled={a <= 1} incDisabled={a >= maxA} />
        <Stepper label="יחידות" value={b} onDec={() => set(a, b - 1)} onInc={() => set(a, b + 1)} decLabel="להוריד יחידה מהאורך" incLabel="להוסיף יחידה לאורך" disabled={locked} decDisabled={b <= 0} incDisabled={b >= maxB} />
      </div>
    </div>
  );
}

/** What the rectangle shows, for מדי (Manip.jsx). */
export function areaCoach(m, v, touched) {
  const { a, b } = v || m.start;
  if (!touched) return 'גררו את הקצה העליון כדי לשנות את הגובה, ואת הקצה הימני כדי לשנות את היחידות.';
  if (!b) return <>מלבן בגובה <bdi dir="ltr">{a}</bdi> ובאורך <bdi dir="ltr">x</bdi>: השטח <bdi dir="ltr">{linText({ k: a, c: 0 })}</bdi>.</>;
  return <>שני חלקים: <bdi dir="ltr">{linText({ k: a, c: 0 })}</bdi> ועוד <bdi dir="ltr">{a} · {b} = {a * b}</bdi>. יחד <bdi dir="ltr">{areaSumTex({ a, b })}</bdi>.</>;
}
