// Move, flip and turn a shape on the grid (GEOM-2). The original stays where it is, in a light fill with its letters;
// the student moves a copy, in the unit's colour, with the moves the item lists: slides (drag it, arrow keys on the
// focused drawing, four arrow buttons), a flip in each mirror line (always drawn dashed with its equation) and turns
// about the marked centre O. The copy's letters A′, B′, C′ sit at its own vertices, so after a flip they run the other
// way round. A flip or a turn that would carry a vertex off the plane is refused, with a shake and a sentence.
// In practice a row of chips under the drawing reads the copy's vertices; in a check (`test`) there is no readout, and
// the drawing's name counts the moves instead of giving coordinates (the grid's numbers stay: the student counts).
// Manip.jsx loads this file on demand (it is not part of the first screen) and says מדי's lines (transformCoach).
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { useReducedMotion } from 'motion/react';
import { ArrowLeft, ArrowRight, ArrowUp, ArrowDown, RotateCcw, TrianglesCenterlineDashedVertical, TrianglesCenterlineDashedHorizontal } from 'lucide-react';
import { useDrag, arrowKeys, clamp, minus } from './core.jsx';
import { gridGeometry, Plane } from './grid.jsx';
import { Tex } from '../MathText.jsx';
import {
  TF_RANGE, tfSlide, tfInside, tfMoves, tfStart, tfSame, tfSameSet, tfPt, tfShapeName, tfSlideWords, mirrorTo, turnWords,
} from '@/content/transform.js';
import '@/styles/lazy/transform.css'; // the object's own rules, loaded with it (STUDENT-15)

const GLIDE = 200; // ms: a slide glides, a flip folds, a turn sweeps; under reduced motion the copy jumps
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'; // --ease-smooth-out
const SLIDE_WORDS = { left: 'שמאלה', right: 'ימינה', up: 'למעלה', down: 'למטה' };

/** Is a point (in grid units) inside a polygon? */
function inside([px, py], pts) {
  let on = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i, i += 1) {
    const [xi, yi] = pts[i]; const [xj, yj] = pts[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) on = !on;
  }
  return on;
}
const centroid = (pts) => [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length];

/** What a move did, in a sentence for the live region. */
function moveSentence(mv) {
  if (mv.kind === 'slide') return `העותק זז ${SLIDE_WORDS[mv.id]}`;
  if (mv.kind === 'flip') return `העותק שוקף ${mirrorTo(mv.mirror)}`;
  return `העותק הסתובב ${Math.abs(mv.by) === 180 ? 'חצי סיבוב' : turnWords(mv.by)} סביב O`;
}
/** In a check the drawing's name counts the moves made, never where the copy is. */
function movesWords(made) {
  const parts = [];
  const slid = tfSlideWords(made.dx, made.dy);
  if (slid) parts.push(`זז ${slid} מההתחלה`);
  if (made.flips) parts.push(made.flips === 1 ? 'שוקף פעם אחת' : `שוקף ${made.flips} פעמים`);
  if (made.turns) parts.push(made.turns === 1 ? `הסתובב ${made.half ? 'חצי סיבוב' : 'רבע סיבוב'}` : `הסתובב ${made.turns} פעמים`);
  return parts.length ? `העותק ${parts.join(' ו')}` : 'העותק במקום שבו התחיל';
}
const NONE = { dx: 0, dy: 0, flips: 0, turns: 0, half: false };

/**
 * A quarter turn's arrow, drawn (not a font's ↶ ↷, which phones draw differently): half a circle over the top from the
 * right to the left, its head pointing down, for counterclockwise; the same mirrored for clockwise.
 */
function TurnIcon({ by }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" className="mp-tf-turn-icon" style={by < 0 ? { transform: 'scaleX(-1)' } : undefined}>
      <path d="M 19 14 A 7 7 0 0 0 5 14" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M 1.8 10.8 L 5 15 L 8.2 10.8" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A move's button: a short visible label, the full name for a screen reader. */
function moveButton(mv) {
  if (mv.kind === 'flip') {
    const axis = typeof mv.mirror === 'string';
    const vertical = mv.mirror === 'y' || mv.mirror.x != null; // a vertical mirror: two triangles left and right of it
    const Icon = vertical ? TrianglesCenterlineDashedVertical : TrianglesCenterlineDashedHorizontal;
    return {
      aria: `שיקוף ${mirrorTo(mv.mirror)}`,
      body: (<><Icon size={18} strokeWidth={2.4} aria-hidden="true" /><span className="mp-tf-word">{axis ? 'שיקוף בציר' : 'שיקוף בישר'}</span>{' '}
        <bdi dir="ltr"><Tex tex={axis ? mv.mirror : `${mv.mirror.x != null ? 'x' : 'y'} = ${mv.mirror.x ?? mv.mirror.y}`} /></bdi></>),
    };
  }
  if (Math.abs(mv.by) === 180) return { aria: 'חצי סיבוב סביב O', body: <span>חצי סיבוב</span> };
  return { aria: `סיבוב של 90° ${mv.by > 0 ? 'נגד' : 'עם'} כיוון השעון סביב O`, body: (<><TurnIcon by={mv.by} /><bdi dir="ltr">90°</bdi></>) };
}

export default function Transform({ m, value, onChange, locked, reveal, good, answer, hint, test = false, onSay }) {
  const range = m.range || TF_RANGE;
  const g = gridGeometry(range);
  const { X, Y, c, o } = g;
  const start = tfStart(m);
  const cur = value || start;
  const names = m.shape.names;
  const moves = tfMoves(m);
  const canDrag = !!m.moves?.drag;
  const reduce = useReducedMotion();
  const copyRef = useRef(null);
  const pending = useRef(null); // the move just made, for its motion once the new copy is drawn
  const grab = useRef(null); // a drag: where it started (grid units) and the copy then
  const [say, setSay] = useState(''); // the live sentence after a move
  const [refused, setRefused] = useState(null); // why the last move was not done, until the next one
  const [made, setMade] = useState(NONE); // the moves made since the start (a check's drawing counts them)

  // a new exercise, or the copy back at its start (התחלה מחדש, or set from outside): nothing made yet
  useEffect(() => { setMade(NONE); setRefused(null); setSay(''); }, [m]);
  useEffect(() => { if (tfSame(cur, start)) setMade(NONE); }, [cur]); // eslint-disable-line react-hooks/exhaustive-deps

  // the motion of the move just made: the new copy is drawn, and played from where it was (WAAPI, 200 ms)
  useLayoutEffect(() => {
    const p = pending.current; const el = copyRef.current;
    if (!p || !el || !tfSame(p.to, cur)) return;
    pending.current = null;
    if (reduce || typeof el.animate !== 'function') return;
    const { mv } = p;
    let from; let origin = '0px 0px';
    if (mv.kind === 'slide') from = `translate(${-mv.d[0] * c}px, ${mv.d[1] * c}px)`;
    else if (mv.kind === 'flip') {
      // a fold across the line: the copy shrinks to the line along its normal and opens on the other side
      const vertical = mv.mirror === 'y' || mv.mirror.x != null;
      origin = vertical ? `${X(mv.mirror.x ?? 0)}px ${o}px` : `${o}px ${Y(mv.mirror.y ?? 0)}px`;
      from = vertical ? 'scaleX(-1)' : 'scaleY(-1)';
    } else {
      // a sweep about O: on the screen y runs down, so a counterclockwise turn starts at a clockwise CSS angle
      origin = `${X(mv.centre[0])}px ${Y(mv.centre[1])}px`;
      from = `rotate(${mv.by}deg)`;
    }
    el.style.transformOrigin = origin;
    el.animate([{ transform: from }, { transform: 'none' }], { duration: GLIDE, easing: EASE });
  }, [cur]); // eslint-disable-line react-hooks/exhaustive-deps

  const shake = () => {
    const el = copyRef.current;
    if (reduce || !el || typeof el.animate !== 'function') return;
    el.animate([{ transform: 'none' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(-3px)' }, { transform: 'none' }], { duration: 280, easing: 'ease-out' });
  };
  const refuse = (mv) => {
    const text = !canDrag ? 'העותק ייצא מהרשת. נסו תנועה אחרת, או התחילו מחדש.'
      : mv.kind === 'flip' ? 'העותק ייצא מהרשת. הזיזו אותו קודם קרוב יותר לישר השיקוף.'
        : 'העותק ייצא מהרשת. הזיזו אותו קודם קרוב יותר למרכז הסיבוב.';
    setRefused(text); setSay(text); onSay?.({ move: 'refuse', text });
    shake();
  };
  const act = (mv) => {
    if (locked) return;
    const next = mv.apply(cur);
    if (!tfInside(next, range)) {
      if (mv.kind === 'slide') { setSay('העותק בקצה הרשת.'); return; } // the arrow buttons are off there already
      refuse(mv); return;
    }
    pending.current = { mv, to: next };
    setRefused(null); setSay(moveSentence(mv));
    setMade((d) => (mv.kind === 'slide' ? { ...d, dx: d.dx + mv.d[0], dy: d.dy + mv.d[1] }
      : mv.kind === 'flip' ? { ...d, flips: d.flips + 1 } : { ...d, turns: d.turns + 1, half: Math.abs(mv.by) === 180 }));
    onSay?.({ move: mv.kind });
    onChange(next);
  };
  const reset = () => {
    if (locked || tfSame(cur, start)) return;
    pending.current = null; setRefused(null); setSay('העותק חזר להתחלה.'); setMade(NONE);
    onSay?.({ move: 'reset' });
    onChange(start.map((p) => [...p]));
  };
  const byId = Object.fromEntries(moves.map((mv) => [mv.id, mv]));

  // dragging: from anywhere inside the copy or on a vertex, in whole steps, never off the plane
  const toGrid = (p) => [(p.x - o) / c, (o - p.y) / c];
  const [ref, drag] = useDrag((p, phase) => {
    const q = toGrid(p);
    if (phase === 'start') {
      const onIt = inside(q, cur) || cur.some(([x, y]) => Math.hypot(x - q[0], y - q[1]) < 0.7);
      grab.current = onIt ? { at: q, base: cur } : null;
      return;
    }
    const gr = grab.current; if (!gr) return;
    const xs = gr.base.map((v) => v[0]); const ys = gr.base.map((v) => v[1]);
    const dx = clamp(Math.round(q[0] - gr.at[0]), -range - Math.min(...xs), range - Math.max(...xs));
    const dy = clamp(Math.round(q[1] - gr.at[1]), -range - Math.min(...ys), range - Math.max(...ys));
    const next = tfSlide(gr.base, dx, dy);
    if (!tfSame(next, cur)) { setRefused(null); onChange(next); }
    if (phase === 'end') {
      grab.current = null;
      if (dx || dy) { setSay(`העותק זז ${tfSlideWords(dx, dy)}`); setMade((d) => ({ ...d, dx: d.dx + dx, dy: d.dy + dy })); onSay?.({ move: 'slide' }); }
    }
  }, locked || !canDrag);

  const name = `${tfShapeName(names.length)} ${names.join('')}`;
  const label = test ? `${name}. ${movesWords(made)}` : `${name}. העותק: ${names.map((n, i) => `${n}′ ב־${tfPt(cur[i])}`).join(', ')}`;
  const ok = answer && (answer.match === 'set' ? tfSameSet(cur, answer.pts) : tfSame(cur, answer.pts));

  // letters sit outside the shape, away from its middle; a letter is left out where the copy has a vertex (two letters
  // on one vertex cannot be read): the original's come back when the copy moves off it
  const taken = new Set(cur.map((p) => p.join(',')));
  const letters = (pts, labels, cls, skip) => {
    const mid = centroid(pts);
    return pts.map((p, i) => {
      if (!labels?.[i] || (skip && taken.has(p.join(',')))) return null;
      const vx = p[0] - mid[0]; const vy = p[1] - mid[1]; const len = Math.hypot(vx, vy) || 1;
      return <text key={`${cls}${i}`} x={X(p[0]) + (vx / len) * 15} y={Y(p[1]) - (vy / len) * 15 + 5} textAnchor="middle" className={clsx('mp-tf-letter', cls)}>{labels[i]}</text>;
    });
  };
  const poly = (pts) => pts.map(([x, y]) => `${X(x)},${Y(y)}`).join(' ');
  const primed = names.map((n) => `${n}′`);
  const turns = m.moves?.turns;
  const lineEnd = range + 0.5;

  const slides = canDrag ? ['left', 'up', 'down', 'right'].map((id) => byId[id]) : [];
  const others = moves.filter((mv) => mv.kind !== 'slide');
  const resetBtn = (
    <button key="reset" type="button" className="step-btn mp-tf-reset" onClick={reset} disabled={locked || tfSame(cur, start)} aria-label="התחלה מחדש" title="התחלה מחדש">
      <RotateCcw size={20} strokeWidth={2.6} aria-hidden="true" />
    </button>
  );
  const ICONS = { left: ArrowLeft, right: ArrowRight, up: ArrowUp, down: ArrowDown };
  const arrowRow = slides.map((mv) => {
    const Icon = ICONS[mv.id];
    return (
      <button key={mv.id} type="button" className="step-btn" onClick={() => act(mv)} disabled={locked || !tfInside(mv.apply(cur), range)} aria-label={`הזיזו ${SLIDE_WORDS[mv.id]}`}>
        <Icon size={20} strokeWidth={3} aria-hidden="true" />
      </button>
    );
  });
  const otherRow = others.map((mv) => {
    const b = moveButton(mv);
    return <button key={mv.id} type="button" className="step-btn mp-tf-btn" onClick={() => act(mv)} disabled={locked} aria-label={b.aria}>{b.body}</button>;
  });
  // at most two rows: the arrows with התחלה מחדש at the row's end, then the flips and the turns
  const rows = canDrag ? [[...arrowRow, resetBtn], otherRow] : otherRow.length <= 3 ? [[...otherRow, resetBtn]] : [otherRow, [resetBtn]];

  return (
    <div className={clsx('manip', 'manip-transform', good && 'good')}>
      <svg ref={ref} {...drag} viewBox={`0 0 ${g.size} ${g.size}`} className={clsx('manip-canvas', canDrag && !locked && 'can-drag')} dir="ltr"
        tabIndex={locked ? -1 : 0} role="application" aria-roledescription="מערכת צירים" aria-label={label}
        onKeyDown={canDrag ? arrowKeys({ left: () => act(byId.left), right: () => act(byId.right), up: () => act(byId.up), down: () => act(byId.down) }) : undefined}>
        <Plane g={g}>
          {/* every mirror line, dashed, with its equation (an axis is named on the plane already) */}
          {(m.moves?.flips || []).map((mr) => {
            const vertical = mr === 'y' || mr.x != null; const k = mr.x ?? mr.y ?? 0;
            return (
              <g key={`mr${JSON.stringify(mr)}`} className="mp-tf-mirror">
                {vertical ? <line x1={X(k)} y1={Y(lineEnd)} x2={X(k)} y2={Y(-lineEnd)} /> : <line x1={X(-lineEnd)} y1={Y(k)} x2={X(lineEnd)} y2={Y(k)} />}
                {typeof mr !== 'string' && (vertical
                  ? <text x={X(k) + 6} y={Y(range) + 4} className="mp-tf-eq"><tspan className="mp-tf-var">x</tspan>{` = ${minus(k)}`}</text>
                  : <text x={X(range)} y={Y(k) - 7} textAnchor="end" className="mp-tf-eq"><tspan className="mp-tf-var">y</tspan>{` = ${minus(k)}`}</text>)}
              </g>
            );
          })}
          {m.target && (
            <g className="mp-tf-target">
              <polygon points={poly(m.target.pts)} />
              {letters(m.target.pts, m.target.names, 'target', true)}
            </g>
          )}
          <g className="mp-tf-orig">
            <polygon points={poly(m.shape.pts)} />
            {letters(m.shape.pts, names, 'orig', true)}
          </g>
          {/* the hint: which vertex went where (the letters match, the answer is not shown) */}
          {hint && !tfSame(cur, m.shape.pts) && m.shape.pts.map((p, i) => <line key={`h${i}`} x1={X(p[0])} y1={Y(p[1])} x2={X(cur[i][0])} y2={Y(cur[i][1])} className="mp-tf-link" />)}
          {reveal && answer && !ok && (
            <g className="mp-tf-ghost">
              <polygon points={poly(answer.pts)} />
              {letters(answer.pts, answer.match === 'set' ? null : primed, 'ghost')}
            </g>
          )}
          {turns && (
            <g className="mp-tf-centre">
              <circle cx={X(turns.centre[0])} cy={Y(turns.centre[1])} r="4.5" />
              <text x={X(turns.centre[0]) + 8} y={Y(turns.centre[1]) + 19} textAnchor="start" className="mp-tf-letter">O</text>
            </g>
          )}
          <g ref={copyRef} className="mp-tf-copy">
            <polygon points={poly(cur)} />
            {cur.map(([x, y], i) => <circle key={`v${i}`} cx={X(x)} cy={Y(y)} r="5" />)}
            {letters(cur, primed, 'copy')}
          </g>
        </Plane>
      </svg>
      {(!test || refused) && (
        <div className="manip-readout mp-tf-read" aria-live="polite">
          {refused ? <span className="mp-tf-refuse" aria-hidden="true">{refused}</span>
            : names.map((n, i) => <bdi key={n} dir="ltr" className="mp-tf-chip">{`${n}′(${minus(cur[i][0])}, ${minus(cur[i][1])})`}</bdi>)}
        </div>
      )}
      <span className="visually-hidden" aria-live="polite">{say}</span>
      <div className="manip-controls mp-tf-controls">
        {rows.map((row, i) => <div key={i} className={clsx('mp-tf-row', i === 0 && canDrag && 'arrows', row.length > 3 && 'many')} dir={i === 0 && canDrag ? 'ltr' : undefined}>{row}</div>)}
      </div>
    </div>
  );
}
