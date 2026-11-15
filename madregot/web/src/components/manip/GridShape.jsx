// Shapes on a grid of unit squares (kind 'polygon', רשת משבצות; stage 2, MEASURE-1.1). Four tasks:
//   rect   build a rectangle from the grid's corner: drag its far corner, or the steppers רוחב and גובה
//   move   slide a coloured piece (a triangle cut off a parallelogram) until the hole closes: drag it, or הזזה (and
//          למעלה when the answer moves it up or down)
//   cut    cut an L into two rectangles along one grid line: tap the line (or drag the cut), across or along
//   apex   slide a triangle's top vertex along a dashed line parallel to its base: drag it, or קודקוד
// Every point snaps to the grid, and every task can be done without dragging: the steppers and the arrow keys move the
// object through content/grid.js gridStep, which the tests walk too. content/grid.js also checks the value and puts it
// into words (through content/manip.js, like every object). In a check (`test`) the readout keeps only what the student set (the sides, the line, the move), never an
// area or a perimeter, and nothing marks a right state.
import { useRef } from 'react';
import clsx from 'clsx';
import { ArrowLeft, ArrowRight, ArrowDown, ArrowUp } from 'lucide-react';
import { clamp, useDrag, Stepper } from './core.jsx';
import { manipCorrect, manipSolution } from '@/content/manip.js';
import '@/styles/lazy/measure.css'; // the object's own rules, loaded with it (moved out of the first load at the stage-2 merge)
import { boundsOf, cutAreas, cutAt, cutRange, moveRange, movedPts, apexPts, gridStep } from '@/content/grid.js';

export const GRID_W = 300; export const GRID_H = 220; export const CELL = 26;
/** Where the grid sits in the drawing: a lattice point (x, y), y up, to drawing units and back. */
export function gridGeom([cols, rows]) {
  const ox = (GRID_W - cols * CELL) / 2; const oy = (GRID_H + rows * CELL) / 2;
  return { cols, rows, X: (x) => ox + x * CELL, Y: (y) => oy - y * CELL, toX: (sx) => (sx - ox) / CELL, toY: (sy) => (oy - sy) / CELL };
}
const ptsAttr = (g, pts) => pts.map(([x, y]) => `${g.X(x)},${g.Y(y)}`).join(' ');
/** "3 משבצות", "משבצת אחת". */
const cells = (n) => (Math.abs(n) === 1 ? 'משבצת אחת' : `${Math.abs(n)} משבצות`);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/** A cut across is on a line y = …, a cut along on a line x = …. */
const cutName = (axis) => (axis === 'y' ? 'חיתוך לרוחב' : 'חיתוך לאורך');

/**
 * What the object says for a value: `text` its spoken state (aria-valuetext), `line` its readout and `more` a second
 * readout line. Outside a check the rectangle adds its area and perimeter, and a right cut the area of each part;
 * `two` keeps room for that second line, so the drawing never moves under a finger while it drags.
 */
export function gridSaid(m, v, { test = false, right = false } = {}) {
  switch (m.task) {
    case 'rect': return test
      ? { text: `מלבן ברוחב ${v.w} ובגובה ${v.h} משבצות`, line: `רוחב ${v.w} · גובה ${v.h}` }
      : { text: `מלבן ברוחב ${v.w} ובגובה ${v.h} משבצות, שטח ${v.w * v.h}, היקף ${2 * (v.w + v.h)}`, line: `רוחב ${v.w} · גובה ${v.h}`, more: `שטח ${v.w * v.h} משבצות · היקף ${2 * (v.w + v.h)}`, two: true };
    case 'move': {
      const dx = v.dx || 0; const dy = v.dy || 0;
      const parts = [dx && `${cells(dx)} ${dx > 0 ? 'ימינה' : 'שמאלה'}`, dy && `${cells(dy)} ${dy > 0 ? 'למעלה' : 'למטה'}`].filter(Boolean);
      const text = parts.length ? `החלק הצבוע הוזז ${parts.join(' ו־')}` : 'החלק הצבוע במקומו';
      return { text, line: text };
    }
    case 'cut': {
      const where = `${cutName(v.axis)}, בקו ${v.axis} = ${v.at}`;
      if (test) return { text: where, line: where };
      if (!right) return { text: where, line: where, two: true };
      const [a, b] = cutAreas(m.shape, v);
      return { text: `${where}. שני מלבנים: ${a} ו־${b} משבצות`, line: where, more: `שני מלבנים: ${a} ו־${b} משבצות`, parts: true, two: true };
    }
    case 'apex': {
      const { x0, x1, h } = m.base;
      const line = `בסיס ${x1 - x0} · גובה ${h} · שטח ${((x1 - x0) * h) / 2} משבצות`;
      return { text: `הקודקוד העליון מעל x = ${v.x}. בסיס ${x1 - x0}, גובה ${h}, שטח ${((x1 - x0) * h) / 2} משבצות`, line };
    }
    default: return { text: '', line: '' };
  }
}

/**
 * The grid: thin lines on every lattice line, the outer edge a little stronger. `numbers`: each line's number under the
 * grid and beside it (the cut is named by its line, x = 5), where the drawing has room for them.
 */
function GridLines({ g, numbers = false }) {
  const xs = Array.from({ length: g.cols + 1 }, (_, i) => i); const ys = Array.from({ length: g.rows + 1 }, (_, i) => i);
  const below = numbers && GRID_H - g.Y(0) >= 18; const beside = numbers && g.X(0) >= 18;
  return (
    <g aria-hidden="true">
      {xs.map((i) => <line key={`v${i}`} x1={g.X(i)} x2={g.X(i)} y1={g.Y(0)} y2={g.Y(g.rows)} className={i === 0 || i === g.cols ? 'mp-grid-line edge' : 'mp-grid-line'} />)}
      {ys.map((i) => <line key={`h${i}`} x1={g.X(0)} x2={g.X(g.cols)} y1={g.Y(i)} y2={g.Y(i)} className={i === 0 || i === g.rows ? 'mp-grid-line edge' : 'mp-grid-line'} />)}
      {below && xs.map((i) => <text key={`nx${i}`} x={g.X(i)} y={g.Y(0) + 15} textAnchor="middle" className="mp-num mp-grid-num">{i}</text>)}
      {beside && ys.map((i) => <text key={`ny${i}`} x={g.X(0) - 7} y={g.Y(i) + 4} textAnchor="end" className="mp-num mp-grid-num">{i}</text>)}
    </g>
  );
}
/** A draggable point: a halo for the finger (44 px across) and the handle itself. */
const Handle = ({ x, y }) => (
  <g className="mp-point"><circle cx={x} cy={y} r="22" className="mp-halo" /><circle cx={x} cy={y} r="9" className="mp-handle" /></g>
);
/** What a screen reader calls each task's drawing. */
const GRID_LABEL = { rect: 'מלבן על רשת משבצות', move: 'צורה וחלק צבוע על רשת משבצות', cut: 'צורה וקו חיתוך על רשת משבצות', apex: 'משולש על רשת משבצות' };

export default function GridShape({ m, value, onChange, locked, reveal, good, answer, hint, test = false }) {
  const g = gridGeom(m.grid);
  const v = value || m.start;
  const emit = (n) => { if (!locked && !same(n, v)) onChange(n); };
  const step = (key, dir) => emit(gridStep(m, v, key, dir, answer));
  const stuck = (key, dir) => same(gridStep(m, v, key, dir, answer), v);
  const grab = useRef(null);
  const right = !test && !!answer && manipCorrect({ manip: m, answer }, v);
  const sol = reveal && answer ? manipSolution({ manip: m, answer }) : null;
  const showGhost = !!sol && !same(sol, v);
  const said = gridSaid(m, v, { test, right });
  const stepper = (key, label, [decLabel, incLabel], icons, shown = v[key] ?? 0) => (
    <Stepper key={key} label={label} value={shown} icons={icons} onDec={() => step(key, -1)} onInc={() => step(key, 1)}
      decLabel={decLabel} incLabel={incLabel} disabled={locked} decDisabled={stuck(key, -1)} incDisabled={stuck(key, 1)} />
  );

  // ---------------------------------------------------------------- each task: how a drag moves it, what it draws
  let move = null; let keys = {}; let art = null; let ghost = null; let controls = null; let hintLine = null;
  let range = [0, g.cols]; let now = 0;
  if (m.task === 'rect') {
    move = (p) => emit({ w: clamp(Math.round(g.toX(p.x)), 1, g.cols), h: clamp(Math.round(g.toY(p.y)), 1, g.rows) });
    keys = { ArrowLeft: () => step('w', -1), ArrowRight: () => step('w', 1), ArrowDown: () => step('h', -1), ArrowUp: () => step('h', 1) };
    const rect = (r, cls) => <rect x={g.X(0)} y={g.Y(r.h)} width={r.w * CELL} height={r.h * CELL} className={cls} />;
    art = <>{rect(v, clsx('mp-grid-shape', right && 'hit'))}<Handle x={g.X(v.w)} y={g.Y(v.h)} /></>;
    if (showGhost) ghost = rect(sol, 'mp-grid-ghost');
    hintLine = 'השטח: כמה משבצות בפנים. ההיקף: כמה צעדים מסביב, על הקווים.';
    controls = <>{stepper('w', 'רוחב', ['רוחב קטן במשבצת', 'רוחב גדול במשבצת'])}{stepper('h', 'גובה', ['גובה קטן במשבצת', 'גובה גדול במשבצת'])}</>;
    range = [1, g.cols]; now = v.w;
  } else if (m.task === 'move') {
    const r = moveRange(m); const vertical = !!answer?.dy;
    const dx = v.dx || 0; const dy = v.dy || 0;
    move = (p, phase) => {
      const at = [g.toX(p.x), g.toY(p.y)];
      if (phase === 'start' || !grab.current) grab.current = { at, dx, dy };
      const s = grab.current;
      emit({ dx: clamp(s.dx + Math.round(at[0] - s.at[0]), r.dx[0], r.dx[1]), dy: vertical ? clamp(s.dy + Math.round(at[1] - s.at[1]), r.dy[0], r.dy[1]) : 0 });
    };
    keys = { ArrowLeft: () => step('dx', -1), ArrowRight: () => step('dx', 1), ...(vertical ? { ArrowDown: () => step('dy', -1), ArrowUp: () => step('dy', 1) } : {}) };
    const piece = movedPts(m, { dx, dy }); const b = boundsOf(piece);
    art = (
      <>
        <polygon points={ptsAttr(g, m.shape)} className="mp-grid-shape" />
        {(dx || dy) ? <polygon points={ptsAttr(g, m.piece.pts)} className="mp-grid-was" /> : null}
        <polygon points={ptsAttr(g, piece)} className={clsx('mp-grid-piece', right && 'hit')} />
        <Handle x={g.X((b.x0 + b.x1) / 2)} y={g.Y((b.y0 + b.y1) / 2)} />
      </>
    );
    if (showGhost) ghost = <polygon points={ptsAttr(g, movedPts(m, sol))} className="mp-grid-ghost" />;
    hintLine = 'החור נסגר כשהחלק זז בדיוק עד הצד השני.';
    controls = (
      <>
        {stepper('dx', 'הזזה', ['להזיז משבצת שמאלה', 'להזיז משבצת ימינה'], [ArrowLeft, ArrowRight], dx)}
        {vertical && stepper('dy', 'למעלה', ['להזיז משבצת למטה', 'להזיז משבצת למעלה'], [ArrowDown, ArrowUp], dy)}
      </>
    );
    range = r.dx; now = dx;
  } else if (m.task === 'cut') {
    const sb = boundsOf(m.shape);
    // a tap anywhere picks the grid line nearest the finger (each line's band is a cell wide); a drag follows the finger
    move = (p) => emit(cutAt(m, v.axis, v.axis === 'x' ? g.toX(p.x) : g.toY(p.y)));
    keys = v.axis === 'x'
      ? { ArrowLeft: () => step('at', -1), ArrowRight: () => step('at', 1), Enter: () => step('axis', 1), ' ': () => step('axis', 1) }
      : { ArrowDown: () => step('at', -1), ArrowUp: () => step('at', 1), Enter: () => step('axis', 1), ' ': () => step('axis', 1) };
    // the cut runs across the shape and on to its handle, past the edge away from the grid's numbers
    const line = (c, cls) => (c.axis === 'x'
      ? <line x1={g.X(c.at)} x2={g.X(c.at)} y1={g.Y(sb.y0)} y2={g.Y(sb.y1) - 12} className={cls} />
      : <line x1={g.X(sb.x0)} x2={g.X(sb.x1) + 12} y1={g.Y(c.at)} y2={g.Y(c.at)} className={cls} />);
    art = (
      <>
        <polygon points={ptsAttr(g, m.shape)} className="mp-grid-shape" />
        {line(v, clsx('mp-grid-cut', right && 'hit'))}
        {v.axis === 'x' ? <Handle x={g.X(v.at)} y={g.Y(sb.y1) - 12} /> : <Handle x={g.X(sb.x1) + 12} y={g.Y(v.at)} />}
      </>
    );
    if (showGhost) ghost = line(sol, 'mp-grid-ghost-line');
    hintLine = 'נסו קו שממשיך את אחת הצלעות של הפינה החסרה.';
    const turn = (axis) => { if (v.axis !== axis) step('axis', 1); };
    controls = (
      <>
        <div className="mp-iq-seg mp-grid-seg" role="group" aria-label="כיוון החיתוך">
          <button type="button" className="seg" aria-pressed={v.axis === 'y'} onClick={() => turn('y')} disabled={locked}>לחתוך לרוחב</button>
          <button type="button" className="seg" aria-pressed={v.axis === 'x'} onClick={() => turn('x')} disabled={locked}>לחתוך לאורך</button>
        </div>
        {stepper('at', 'קו', v.axis === 'x' ? ['הקו משבצת שמאלה', 'הקו משבצת ימינה'] : ['הקו משבצת למטה', 'הקו משבצת למעלה'], v.axis === 'x' ? [ArrowLeft, ArrowRight] : [ArrowDown, ArrowUp])}
      </>
    );
    range = cutRange(m, v.axis); now = v.at;
  } else if (m.task === 'apex') {
    const { x0, x1, h } = m.base; const y = m.base.y || 0;
    move = (p) => emit({ x: clamp(Math.round(g.toX(p.x)), 0, g.cols) });
    keys = { ArrowLeft: () => step('x', -1), ArrowRight: () => step('x', 1), Home: () => emit({ x: 0 }), End: () => emit({ x: g.cols }) };
    const atEnd = right && (v.x === x0 || v.x === x1);
    const k = v.x === x0 ? 1 : -1;
    art = (
      <>
        <line x1={g.X(0)} x2={g.X(g.cols)} y1={g.Y(y + h)} y2={g.Y(y + h)} className="mp-grid-par" />
        <polygon points={ptsAttr(g, apexPts(m, v.x))} className={clsx('mp-grid-shape', right && 'hit')} />
        {/* the height: from the vertex straight down to the base's line */}
        {!atEnd && <line x1={g.X(v.x)} x2={g.X(v.x)} y1={g.Y(y + h)} y2={g.Y(y)} className="mp-grid-height" />}
        {atEnd && <polyline points={`${g.X(v.x) + k * 11},${g.Y(y)} ${g.X(v.x) + k * 11},${g.Y(y) - 11} ${g.X(v.x)},${g.Y(y) - 11}`} className="mp-grid-right" />}
        <Handle x={g.X(v.x)} y={g.Y(y + h)} />
      </>
    );
    if (showGhost) ghost = <polygon points={ptsAttr(g, apexPts(m, sol.x))} className="mp-grid-ghost" />;
    hintLine = 'הזווית הישרה תהיה כשהקודקוד ממש מעל קצה הבסיס.';
    controls = stepper('x', 'קודקוד', ['הקודקוד משבצת שמאלה', 'הקודקוד משבצת ימינה'], [ArrowLeft, ArrowRight]);
    range = [0, g.cols]; now = v.x;
  }

  const [ref, drag] = useDrag((p, phase) => { if (move) move(p, phase); if (phase === 'end') grab.current = null; }, locked);
  const onKeyDown = (e) => {
    const f = keys[e.key];
    if (!f || locked) return;
    e.preventDefault(); e.stopPropagation(); f();
  };
  return (
    <div className={clsx('manip', 'manip-grid', `manip-grid-${m.task}`, good && 'good')}>
      <div className={clsx('manip-readout', 'mp-grid-readout', said.two && 'two')} aria-live="polite">
        <span>{said.line}</span>
        {said.more && <span className={said.parts ? 'mp-grid-parts' : undefined}>{said.more}</span>}
      </div>
      {hint && hintLine && <p className="manip-hint-line">{hintLine}</p>}
      <svg ref={ref} {...drag} viewBox={`0 0 ${GRID_W} ${GRID_H}`} className="manip-canvas mp-grid-canvas" dir="ltr" tabIndex={locked ? -1 : 0}
        role="slider" aria-roledescription="רשת משבצות" aria-label={GRID_LABEL[m.task] || 'רשת משבצות'}
        aria-valuemin={range[0]} aria-valuemax={range[1]} aria-valuenow={now} aria-valuetext={said.text} onKeyDown={onKeyDown}>
        <rect x="0" y="0" width={GRID_W} height={GRID_H} className="mp-hit" />
        <GridLines g={g} numbers={m.task === 'cut'} />
        {ghost}
        {art}
      </svg>
      <div className="manip-controls mp-grid-controls">{controls}</div>
    </div>
  );
}

/** What מדי says about the grid object (Manip.jsx): what the student just did, never whether it is right. */
export function gridCoach(m, value, touched) {
  const v = value || m.start;
  switch (m.task) {
    case 'rect':
      if (!touched) return 'גררו את הפינה. השטח הוא כמה משבצות בפנים, וההיקף הוא כמה צעדים מסביב.';
      return <>מלבן <bdi dir="ltr">{v.w}</bdi> על <bdi dir="ltr">{v.h}</bdi>. ספרו את המשבצות בפנים ואת הצעדים מסביב.</>;
    case 'move':
      if (!touched) return 'גררו את החלק הצבוע עד שהחור נסגר.';
      return `${gridSaid(m, v).text}. כשהוא זז, השטח שלו לא משתנה.`;
    case 'cut':
      if (!touched) return 'חתכו כך ששני החלקים יהיו מלבנים.';
      return <>{cutName(v.axis)}, בקו <bdi dir="ltr">{`${v.axis} = ${v.at}`}</bdi>. האם שני החלקים מלבנים?</>;
    case 'apex':
      if (!touched) return 'גררו את הקודקוד העליון. מה קורה לשטח?';
      return <>הקודקוד מעל <bdi dir="ltr">x = {v.x}</bdi>. הבסיס והגובה לא השתנו.</>;
    default: return null;
  }
}
