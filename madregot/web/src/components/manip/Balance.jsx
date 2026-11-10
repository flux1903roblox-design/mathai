// The balance (מאזניים): boxes that each weigh x and unit weights on two pans. A tap (or a drag) on the boxes or the
// weights of one pan takes one away from that pan only, so the beam leans as soon as the pans differ: keeping it level
// is the student's own decision, "the same on both sides". A level scale whose counts share a divisor can be divided
// into equal parts, both pans together. Nothing can be added, only undone; the goal is one box alone on a pan.
// The weights are drawn in bars of five and singles, so twelve reads at a glance.
import { useEffect, useRef } from 'react';
import clsx from 'clsx';
import { Undo2, RotateCcw, Divide } from 'lucide-react';
import { useDrag } from './core.jsx';
import { Tex } from '../MathText.jsx';
import { balanceTilt, balanceSolved, balanceDivisor, balanceDivide, balanceRemove, balanceTex, balanceWords } from '@/content/manip.js';

const W = 360; const H = 236;
const PIVOT = [180, 168]; const ARM = 94; const TILT = 6; // degrees, when the pans differ
const PLATE_Y = 150; const PLATE_W = 140;
const BOX = 27; const UNIT = 13; const GAP = 3;

/** Where a pan's things sit: the boxes on its left part, the weights on its right part (as in 3x + 5). */
function panLayout(cx) {
  const left = cx - PLATE_W / 2 + 6; const right = cx + PLATE_W / 2 - 6;
  return { boxes: { x0: left, x1: cx - 4 }, weights: { x0: cx + 2, x1: right } };
}

/** Boxes in columns of two, from the plate up. */
function Boxes({ n, x0, y0 }) {
  return Array.from({ length: n }, (_, i) => {
    const col = i % 2; const row = Math.floor(i / 2);
    const x = x0 + col * (BOX + GAP); const y = y0 - (row + 1) * BOX - row * GAP;
    return (
      <g key={i} className="mp-bal-box">
        <rect x={x} y={y} width={BOX} height={BOX} rx="5" />
        <text x={x + BOX / 2} y={y + BOX / 2 + 6} textAnchor="middle">x</text>
      </g>
    );
  });
}

/** Weights: full bars of five, then the singles stacked. */
function Weights({ n, x0, y0 }) {
  const bars = Math.floor(n / 5); const singles = n % 5;
  const out = [];
  for (let b = 0; b < bars; b += 1) {
    const x = x0 + b * (UNIT + 3);
    out.push(
      <g key={`b${b}`} className="mp-bal-w">
        <rect x={x} y={y0 - 5 * UNIT} width={UNIT} height={5 * UNIT} rx="3" />
        {[1, 2, 3, 4].map((k) => <line key={k} x1={x + 2} x2={x + UNIT - 2} y1={y0 - k * UNIT} y2={y0 - k * UNIT} />)}
      </g>,
    );
  }
  const sx = x0 + bars * (UNIT + 3);
  for (let s = 0; s < singles; s += 1) out.push(<g key={`s${s}`} className="mp-bal-w"><rect x={sx} y={y0 - (s + 1) * UNIT} width={UNIT} height={UNIT - 1} rx="3" /></g>);
  return out;
}

/**
 * The drawing of a scale: shared by the object and by the static figure. `targets` makes the four groups
 * pressable ({ onKey, label, disabled } by group), `hl` marks one group.
 */
export function ScaleArt({ u, tilt = 0, targets = null, top = 18 }) {
  const angle = TILT * tilt;
  const targetTop = top + 4;
  const dy = (side) => side * ARM * Math.sin((angle * Math.PI) / 180);
  const pan = (side, n, w, gx, gw) => {
    const cx = PIVOT[0] + side * ARM;
    const L = panLayout(cx);
    const group = (g, x0, x1, children, kind) => {
      const t = targets?.[g];
      return (
        <g className={clsx('mp-bal-grp', `mp-bal-${kind}`, t?.disabled && 'empty')} data-group={g}
          {...(t ? { role: 'button', tabIndex: t.disabled ? -1 : 0, 'aria-label': t.label, 'aria-disabled': t.disabled || undefined, onKeyDown: t.onKey } : {})}>
          {t && <rect x={x0 - 4} y={targetTop} width={x1 - x0 + 8} height={PLATE_Y + 4 - targetTop} rx="12" className="mp-bal-target" />}
          {children}
        </g>
      );
    };
    return (
      <g className="mp-bal-pan" style={{ transform: `translateY(${dy(side)}px)` }}>
        <line x1={cx} y1={PLATE_Y + 6} x2={cx} y2={PIVOT[1]} className="mp-bal-post" />
        <rect x={cx - PLATE_W / 2} y={PLATE_Y} width={PLATE_W} height="7" rx="3.5" className="mp-bal-plate" />
        {group(gx, L.boxes.x0, L.boxes.x1, <Boxes n={n} x0={L.boxes.x0 + 1} y0={PLATE_Y - 1} />, 'boxes')}
        {group(gw, L.weights.x0, L.weights.x1, <Weights n={w} x0={L.weights.x0 + 2} y0={PLATE_Y - 1} />, 'weights')}
      </g>
    );
  };
  return (
    <>
      <path d={`M ${PIVOT[0]} ${PIVOT[1]} L ${PIVOT[0] - 26} ${H - 18} H ${PIVOT[0] + 26} Z`} className="mp-bal-stand" />
      <rect x={PIVOT[0] - 48} y={H - 20} width="96" height="10" rx="5" className="mp-bal-stand" />
      <g className="mp-bal-beam" style={{ transform: `rotate(${angle}deg)`, transformOrigin: `${PIVOT[0]}px ${PIVOT[1]}px` }}>
        <rect x={PIVOT[0] - ARM - 18} y={PIVOT[1] - 4} width={2 * ARM + 36} height="8" rx="4" />
      </g>
      <circle cx={PIVOT[0]} cy={PIVOT[1]} r="6" className="mp-bal-pivot" />
      {pan(-1, u.lx, u.l1, 'lx', 'l1')}
      {pan(1, u.rx, u.r1, 'rx', 'r1')}
    </>
  );
}
/**
 * The part of the drawing worth showing: from a little above the tallest stack (and the lean) to the stand. The
 * viewBox follows the start, which is the fullest the scale will be, so the drawing is as large as the room allows
 * and never changes size while the student works; at least 160 high, so the canvas stays at least 120px tall.
 */
export function scaleTop(u) {
  const stack = (n, w) => Math.max(n ? Math.ceil(n / 2) * (BOX + GAP) : 0, w >= 5 ? 5 * UNIT : w * UNIT);
  const tallest = Math.max(stack(u.lx, u.l1), stack(u.rx, u.r1));
  return Math.max(0, Math.min(H - 160, PLATE_Y - tallest - 14 - ARM * Math.sin((TILT * Math.PI) / 180)));
}
export const scaleView = (u) => { const t = scaleTop(u); return `0 ${t} ${W} ${H - t}`; };

const same = (a, b) => !!a && !!b && a.lx === b.lx && a.l1 === b.l1 && a.rx === b.rx && a.r1 === b.r1;
const GROUP_NAME = { lx: ['קופסה', 'השמאלית'], l1: ['משקולת', 'השמאלית'], rx: ['קופסה', 'הימנית'], r1: ['משקולת', 'הימנית'] };

export default function Balance({ m, value, onChange, locked, reveal, good, answer, hint }) {
  const x = answer;
  const u = value || m.start;
  // undo: the states before each move, for this exercise only (a state set from outside starts a new history)
  const past = useRef([]); const mine = useRef(u);
  useEffect(() => { if (!same(value, mine.current)) { past.current = []; mine.current = value; } }, [value]);
  useEffect(() => { past.current = []; }, [m]);
  const go = (next) => { if (locked || !next) return; past.current = [...past.current, u]; mine.current = next; onChange(next); };
  const undo = () => { if (locked || !past.current.length) return; const prev = past.current[past.current.length - 1]; past.current = past.current.slice(0, -1); mine.current = prev; onChange(prev); };
  const reset = () => { if (locked || same(u, m.start)) return; past.current = []; mine.current = m.start; onChange(m.start); };
  const tilt = balanceTilt(u, x);
  const div = balanceDivisor(u, x);
  // a tap or a drag that starts on a group takes one item off that pan
  const grabbed = useRef(null);
  const groupAt = (p) => {
    for (const [g, side] of [['lx', -1], ['l1', -1], ['rx', 1], ['r1', 1]]) {
      const cx = PIVOT[0] + side * ARM; const L = panLayout(cx); const part = g[1] === 'x' ? L.boxes : L.weights;
      if (p.x >= part.x0 - 6 && p.x <= part.x1 + 6 && p.y >= scaleTop(m.start) && p.y <= PLATE_Y + 24) return g;
    }
    return null;
  };
  const [ref, drag] = useDrag((p, phase) => {
    if (phase === 'start') grabbed.current = groupAt(p);
    if (phase === 'end' && grabbed.current) { const g = grabbed.current; grabbed.current = null; go(balanceRemove(u, g)); }
  }, locked);
  const targets = Object.fromEntries(Object.entries(GROUP_NAME).map(([g, [what, side]]) => [g, {
    disabled: locked || !u[g],
    label: `להוריד ${what} מהכף ה${side}${u[g] ? ` (יש ${u[g]})` : ''}`,
    onKey: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); go(balanceRemove(u, g)); } },
  }]));
  const state = tilt === 0 ? 'המאזניים מאוזנים' : tilt < 0 ? 'הכף השמאלית למטה' : 'הכף הימנית למטה';
  const hintText = tilt !== 0 ? 'מה שמורידים מכף אחת, מורידים גם מהשנייה. אפשר גם לבטל.'
    : u.lx && u.rx ? 'יש קופסאות בשתי הכפות. הורידו קופסה מכל כף.'
      : u.l1 && u.r1 ? 'יש משקולות בשתי הכפות. הורידו משקולת מכל כף.'
        : div ? 'אפשר לחלק את שתי הכפות לקבוצות שוות.' : 'המטרה: קופסה אחת לבד בכף אחת.';
  return (
    <div className={clsx('manip', 'manip-balance', good && 'good', tilt !== 0 && 'leaning')}>
      <div className="manip-readout" aria-hidden="true"><Tex tex={balanceTex(u, x)} /></div>
      {hint && <p className="manip-hint-line">{hintText}</p>}
      <svg ref={ref} {...drag} viewBox={scaleView(m.start)} className="manip-canvas" dir="ltr" role="group"
        aria-roledescription="מאזניים" aria-label={`${balanceWords(u)}. ${state}`}>
        <rect x="0" y={scaleTop(m.start)} width={W} height={H - scaleTop(m.start)} className="mp-hit" />
        <ScaleArt u={u} tilt={tilt} targets={targets} top={scaleTop(m.start)} />
      </svg>
      <span className="visually-hidden" aria-live="polite">{`${balanceWords(u)}. ${state}.`}</span>
      {reveal && !balanceSolved(u, x) && <p className="manip-note">כל קופסה שוקלת <bdi dir="ltr">{x}</bdi> משקולות: <bdi dir="ltr">x = {x}</bdi></p>}
      <div className="manip-controls mp-bal-controls">
        <button type="button" className="step-btn mp-bal-btn" onClick={undo} disabled={locked || !past.current.length} aria-label="ביטול: להחזיר את הצעד האחרון"><Undo2 size={20} strokeWidth={2.6} aria-hidden="true" /><span>ביטול</span></button>
        <button type="button" className="step-btn mp-bal-btn" onClick={reset} disabled={locked || same(u, m.start)} aria-label="מההתחלה: להחזיר את המאזניים למצב הראשון"><RotateCcw size={20} strokeWidth={2.6} aria-hidden="true" /><span>מההתחלה</span></button>
        {div && <button type="button" className="step-btn mp-bal-btn div" onClick={() => go(balanceDivide(u, div))} disabled={locked} aria-label={`לחלק את שתי הכפות ב־${div}: להשאיר חלק אחד מתוך ${div} בכל כף`}><Divide size={20} strokeWidth={2.6} aria-hidden="true" /><span>לחלק ב־<bdi dir="ltr">{div}</bdi></span></button>}
      </div>
    </div>
  );
}

/** What is on the scale, for מדי (Manip.jsx). */
export function balanceCoach(m, v, x, touched) {
  const u = v || m.start;
  if (!touched) return 'הקישו על הקופסאות או על המשקולות של כף, ואחת מהן יורדת. המטרה: קופסה אחת לבד.';
  if (balanceSolved(u, x)) return 'קופסה אחת לבד, והמאזניים מאוזנים. כמה היא שוקלת?';
  if (balanceTilt(u, x) !== 0) return 'המאזניים נטו. מה שהורדתם מכף אחת, הורידו גם מהשנייה.';
  const d = balanceDivisor(u, x);
  const alone = (u.lx && !u.l1 && !u.rx) || (u.rx && !u.r1 && !u.lx);
  if (d && alone) return `נשארו רק קופסאות בכף אחת. אפשר לחלק את שתי הכפות ב־${d}.`;
  return `המאזניים מאוזנים: ${balanceWords(u)}.`;
}
