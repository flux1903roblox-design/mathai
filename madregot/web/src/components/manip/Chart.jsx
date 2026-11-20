// Build a chart (DATA-2.2): a bar chart or a pie, from a table, on a 320px phone, with a keyboard and a screen reader.
//   bar  the still figure's drawing (ChartArt.jsx barGeom and BarChartArt: the first category on the right, the axis on
//        the right with a light grid line at every step and a number every `every` steps, at most 8; critique note 25).
//        Its words are HTML at a fixed size around the drawing (the axis title over it, the numbers beside the axis, the
//        names under the bars, where they wrap), so they stay 14px on a 320px phone (review: the drawing at 60% made
//        them 10px). A bar's height follows a drag anywhere in its column (it snaps to the step); a tap selects it; the
//        Stepper "העמודה של …" moves the selected one. Each bar is a slider: ←/→ choose a bar in reading order, ↑/↓ one
//        step, Home/End 0 and the top. `lock` bars are given and do not move (their values are written over them).
//   pie  a circle of 200px (160px on a 320px phone) cut into `parts` equal slices, with the category chips beside it.
//        Each slice belongs to a category or is grey, and the slice a finger touches is the slice that changes (review:
//        counting alone redrew every category as a run, so a tap coloured another slice). A chip chooses a category
//        (each is a slider "אדום: 3 מתוך 12 חלקים"); the Stepper "חלקים ל…" is the main path (critique note 24): + colours
//        the next grey slice clockwise after the category's last one (marked on the rim), − gives its last one back. A
//        tap on a grey slice colours it (its hit area widened to at least 44px of arc on the rim, in screen pixels), a
//        tap on one of the chosen category's slices gives it back, a tap on another colour chooses that category, and a
//        press dragged along the ring colours each grey slice it crosses. ←/→ choose a chip, ↑/↓ add or take a slice.
// The value is number[]: a bar's height (a multiple of bar.step, 0..bar.max), or a category's number of slices (their
// sum at most pie.parts); which slices they are is the drawing's own state, kept while the counts match the value, and
// laid out again (each category's slices in order) when the value is set from outside. The readouts say the selected
// category; in a check (`test`) the pie's percent is not shown (turning parts into percent is the skill). Every chart
// item is practice-only.
import { useId, useRef, useState } from 'react';
import clsx from 'clsx';
import { useDrag, Stepper, clamp } from './core.jsx';
import { barGeom, BarChartArt, PatternDefs, Toned, slicePath, TONES, textW } from './ChartArt.jsx';
import { chartNum, chartPct, chartTone } from '@/content/manip.js';
import '@/styles/lazy/figure.css'; // the colour families (fig-tone-k), the patterns and the bar drawing's rules
import '@/styles/lazy/data.css'; // the object's own rules, loaded with it (moved out of the first load at the stage-3 merge)

// ---------------------------------------------------------------- the values (pure: the keyboard and the tests use them)

const near = (a, b) => Math.abs(a - b) < 1e-9;
const locked = (m, i) => (m.lock || []).includes(i);
const pieParts = (m) => m.pie?.parts || 12;
const sum = (vs) => vs.reduce((a, b) => a + b, 0);

/** A bar set to v: it snaps to the step within 0..max. A locked bar, or a value that is not a number, changes nothing. */
export function chartSet(m, values, i, v) {
  if (locked(m, i) || !Number.isFinite(v) || i < 0 || i >= values.length) return values;
  const { max, step } = m.bar;
  const c = Math.round(clamp(Math.round(v / step) * step, 0, max) * 1e6) / 1e6;
  if (near(c, values[i])) return values;
  const next = [...values]; next[i] = c; return next;
}

/**
 * A key on a bar ({ sel, values } → the next): ←/→ the next or the previous bar in reading order (right to left: ← is
 * the next one), ↑/↓ one step, Home 0, End the top. Other keys return null (not handled).
 */
export function chartKey(m, { sel, values }, key) {
  const n = values.length; const { step, max } = m.bar;
  switch (key) {
    case 'ArrowLeft': return { sel: Math.min(n - 1, sel + 1), values };
    case 'ArrowRight': return { sel: Math.max(0, sel - 1), values };
    case 'ArrowUp': return { sel, values: chartSet(m, values, sel, values[sel] + step) };
    case 'ArrowDown': return { sel, values: chartSet(m, values, sel, values[sel] - step) };
    case 'Home': return { sel, values: chartSet(m, values, sel, 0) };
    case 'End': return { sel, values: chartSet(m, values, sel, max) };
    default: return null;
  }
}

// ---------------------------------------------------------------- the pie's slices
// owners: one entry a slice, clockwise from 12 o'clock: the category that owns it, or −1 (grey, not coloured yet). Every
// move returns the same array when nothing changes, so a press that does nothing does not count as a move.

/** The pie laid out from counts: each category's slices in order, clockwise from 12 o'clock, then grey (−1). */
export function pieOwners(m, values) {
  const out = [];
  values.forEach((k, i) => { for (let j = 0; j < k; j += 1) out.push(i); });
  while (out.length < pieParts(m)) out.push(-1);
  return out.slice(0, pieParts(m));
}
/** How many slices each category owns: the value the object holds. */
export const pieCounts = (m, owners) => m.cats.map((_, i) => owners.filter((o) => o === i).length);
/** The slices as drawn: the drawing's own layout while it still says these counts, else the counts laid out in order. */
export function pieLayout(m, owners, values) {
  const ok = Array.isArray(owners) && owners.length === pieParts(m) && pieCounts(m, owners).every((k, i) => k === values[i]);
  return ok ? owners : pieOwners(m, values);
}
const paint = (m, owners, i, s) => (i < 0 || s < 0 || locked(m, i) || owners[s] !== -1 ? owners : owners.map((o, j) => (j === s ? i : o)));
const clear = (m, owners, s) => (s < 0 || owners[s] < 0 || locked(m, owners[s]) ? owners : owners.map((o, j) => (j === s ? -1 : o)));

/**
 * The grey slice the Stepper's + colours for category i: the first grey one clockwise after its last slice; for a
 * category with none yet, after the last coloured slice, so the pie fills clockwise from 12 o'clock in the order it is
 * coloured. −1 when no slice is grey.
 */
export function pieNext(owners, i) {
  const n = owners.length;
  let from = owners.lastIndexOf(i);
  if (from < 0) from = owners.reduce((last, o, j) => (o !== -1 ? j : last), -1);
  for (let k = 1; k <= n; k += 1) { const s = (from + k + n) % n; if (owners[s] === -1) return s; }
  return -1;
}

/** + or − for category i: the next grey slice coloured, or its last slice (clockwise from 12 o'clock) given back. */
export function pieStep(m, owners, i, d) {
  if (locked(m, i)) return owners;
  return d > 0 ? paint(m, owners, i, pieNext(owners, i)) : clear(m, owners, owners.lastIndexOf(i));
}

/** A key on a chip ({ sel, owners } → the next): ←/→ choose (reading order), ↑/↓ a slice more or less, Home none, End
 * every grey slice. Other keys return null (not handled). */
export function pieKey(m, { sel, owners }, key) {
  const fixed = locked(m, sel);
  switch (key) {
    case 'ArrowLeft': return { sel: Math.min(m.cats.length - 1, sel + 1), owners };
    case 'ArrowRight': return { sel: Math.max(0, sel - 1), owners };
    case 'ArrowUp': return { sel, owners: pieStep(m, owners, sel, 1) };
    case 'ArrowDown': return { sel, owners: pieStep(m, owners, sel, -1) };
    case 'Home': return { sel, owners: fixed || !owners.includes(sel) ? owners : owners.map((o) => (o === sel ? -1 : o)) };
    case 'End': return { sel, owners: fixed || !owners.includes(-1) ? owners : owners.map((o) => (o === -1 ? sel : o)) };
    default: return null;
  }
}

/** A tap on slice s: a grey slice is coloured for the selected category, one of its own is given back, another
 * colour chooses its category. */
export function pieTap(m, { sel, owners }, s) {
  const o = owners[s];
  if (o === -1) return { sel, owners: paint(m, owners, sel, s) };
  if (o !== sel) return { sel: o, owners };
  return { sel, owners: clear(m, owners, s) };
}

const PR = 100; const PC = 108; const PW = 216; // the pie: radius 100 in a 216-wide box (the rim's outline fits in it)
/** The slice under an angle (degrees clockwise from 12 o'clock). */
const sliceAt = (parts, a) => Math.floor((((a % 360) + 360) % 360) / (360 / parts)) % parts;
/**
 * The slice a tap means: the one under the finger, unless it is coloured and a grey neighbour's wedge, widened to at
 * least 44px of arc on the rim, holds the tap (at 20 parts a slice is about 31px of rim: a tap near its edge counts).
 * `px` is the screen pixels of one unit of the drawing (its rendered width over its viewBox width).
 */
export function pieHit(m, owners, a, px = 1) {
  const parts = owners.length; const w = 360 / parts; const R = PR * px;
  const k = sliceAt(parts, a);
  if (owners[k] === -1) return k;
  const arc = (w * Math.PI * R) / 180; const tol = arc >= 44 ? 0 : (((44 - arc) / 2) / R) * (180 / Math.PI);
  const at = ((a % 360) + 360) % 360;
  for (const j of [(k + parts - 1) % parts, (k + 1) % parts]) {
    if (owners[j] !== -1) continue;
    const lo = j * w; const hi = lo + w;
    const d = Math.min(...[lo, hi].map((e) => { const x = Math.abs(at - e); return Math.min(x, 360 - x); }));
    if (d <= tol) return j;
  }
  return k;
}

/** The runs of category i's slices, clockwise: [first slice, how many]. */
export function pieRuns(owners, i) {
  const n = owners.length;
  if (owners.every((o) => o === i)) return [[0, n]];
  const z = owners.findIndex((o) => o !== i);
  const out = []; let s = -1;
  for (let k = 1; k <= n; k += 1) {
    const j = (z + k) % n;
    if (owners[j] === i) { if (s < 0) s = j; } else if (s >= 0) { out.push([s, (j - s + n) % n]); s = -1; }
  }
  return out;
}

// ---------------------------------------------------------------- words

const partsWord = (k) => (k === 1 ? 'חלק אחד' : `${k} חלקים`);
/** k slices of `parts` in percent: "25%", "בערך 41.7%" (a twelfth is not a whole tenth of a percent). */
const pctWords = (k, parts) => { const p = chartPct(k, parts); return `${near((100 * k) / parts, Number(p)) ? '' : 'בערך '}${p}%`; };
/**
 * What a screen reader hears on a category's slider. A bar's value is said with `bar.unitWord` ("תפוח: 4 ילדים"), the
 * short noun, never the axis title (`unit`, "מספר ילדים", review); without one, or for 1, the number alone.
 */
export const chartValueText = (m, i, v) => {
  if (m.mode === 'pie') return `${m.cats[i]}: ${v} מתוך ${pieParts(m)} חלקים`;
  const word = m.bar.unitWord && !near(v, 1) ? ` ${m.bar.unitWord}` : '';
  return `${m.cats[i]}: ${chartNum(v)}${word}`;
};

// ---------------------------------------------------------------- the object

/** Bring the Stepper into view after a choice, when a short phone has it under the fold (the main path, note 24). */
function showStepper(root) {
  const el = root?.querySelector('.manip-controls');
  if (!el?.scrollIntoView) return;
  const r = el.getBoundingClientRect(); const box = el.closest('.lesson-main, .lm-card')?.getBoundingClientRect();
  if (!box || (r.top >= box.top && r.bottom <= box.bottom)) return;
  const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ block: 'nearest', behavior: still ? 'auto' : 'smooth' });
}

export default function Chart({ m, value, onChange, locked: done, reveal, good, answer, hint, test = false }) {
  const pie = m.mode === 'pie';
  const vals = Array.isArray(value) && value.length === m.cats.length ? value : m.start;
  const cur = useRef(vals); cur.current = vals;
  const [sel, setSel] = useState(() => Math.max(0, m.cats.findIndex((_, i) => !locked(m, i))));
  const refs = useRef([]);
  const root = useRef(null);
  const pid = `chart-${useId().replace(/[^\w-]/g, '')}`;
  const put = (next) => { if (!done && next !== cur.current) { cur.current = next; onChange(next); } };
  const choose = (i, focus, tapped) => {
    setSel(i);
    if (focus) refs.current[i]?.focus({ preventScroll: true });
    if (tapped) requestAnimationFrame(() => showStepper(root.current));
  };
  const goal = reveal && answer?.values ? answer.values : null;
  return pie
    ? <PieChart {...{ m, vals, sel, choose, put, refs, root, pid, done, good, goal, hint, test }} />
    : <BarChart {...{ m, vals, cur, sel, choose, put, refs, root, done, good, goal, hint }} />;
}

function BarChart({ m, vals, cur, sel, choose, put, refs, root, done, good, goal, hint }) {
  const { max, step, every, unit } = m.bar;
  const f = { mode: 'bar', cats: m.cats, values: vals, max, step, every, unit, labels: false, tones: m.tones };
  const g = barGeom(f, { bare: true });
  const slotAt = (x) => { const i = Math.floor((g.x1 - x) / g.slot); return i >= 0 && i < vals.length ? i : -1; };
  const valueAt = (y) => ((g.B - y) / (g.B - g.top)) * (g.ax.max - g.ax.from) + g.ax.from;
  const press = useRef(null);
  const [svgRef, drag] = useDrag((p, phase) => {
    if (phase === 'start') {
      const i = slotAt(p.x); press.current = i < 0 ? null : { i, y: p.y, moved: false };
      if (i >= 0) choose(i, false, false);
      return;
    }
    const t = press.current; if (!t) return;
    if (phase === 'end') { if (!t.moved) choose(t.i, false, true); press.current = null; return; }
    if (!t.moved && Math.abs(p.y - t.y) < 6) return;
    t.moved = true;
    put(chartSet(m, cur.current, t.i, valueAt(p.y)));
  }, done);
  const onKey = (i) => (e) => {
    const r = chartKey(m, { sel: i, values: cur.current }, e.key);
    if (!r) return;
    e.preventDefault(); e.stopPropagation();
    if (r.sel !== i) choose(r.sel, true, false); else put(r.values);
  };
  // the words, in HTML over the drawing: x and y as a share of the box, so they sit where the drawing puts them
  const at = (x, y) => ({ left: `${(100 * x) / g.W}%`, top: `${(100 * y) / g.H}%` });
  const v = vals[sel]; const cat = m.cats[sel];
  return (
    <div ref={root} className={clsx('manip manip-chart manip-chart-bar', good && 'good')}>
      <div className="manip-readout mp-chart-read" aria-live="polite"><span>{cat}:</span> <b dir="ltr">{chartNum(v)}</b></div>
      {hint && <p className="manip-hint-line">הציר קופץ ב־{chartNum(step)}: כל קו הוא עוד {chartNum(step)}. ספרו קווים מ־0.</p>}
      <div className="mp-chart-box">
        {unit && <p className="mp-chart-title" aria-hidden="true">{unit}</p>}
        <div className="mp-chart-plot">
          <svg ref={svgRef} {...drag} viewBox={`0 0 ${g.W} ${g.H}`} className="manip-canvas mp-chart-canvas" dir="ltr" role="group" aria-label={`דיאגרמת עמודות: ${m.cats.join(', ')}${unit ? ` (${unit})` : ''}`}>
            <rect x="0" y="0" width={g.W} height={g.H} className="mp-hit" />
            <rect x={g.cx(sel) - g.slot / 2 + 2} y={g.top - 4} width={g.slot - 4} height={g.B - g.top + 8} rx="8" className="mp-chart-selbg" />
            <BarChartArt f={f} g={g} text={false} />
            {goal && goal.map((a, i) => !near(a, vals[i]) && <rect key={`gh${i}`} x={g.cx(i) - g.bw / 2} y={g.Y(a)} width={g.bw} height={Math.max(2, g.B - g.Y(a))} rx="3" className="mp-ghost-bar" />)}
            {vals.map((x, i) => !locked(m, i) && <rect key={`h${i}`} x={g.cx(i) - g.bw / 2 - 4} y={g.Y(x) - 7} width={g.bw + 8} height="14" rx="7" className="mp-handle bar-grip" />)}
            {vals.map((x, i) => (
              <g key={`s${i}`} ref={(el) => { refs.current[i] = el; }} className={clsx('mp-chart-slot', i === sel && 'on')}
                role="slider" tabIndex={done ? -1 : i === sel ? 0 : -1} aria-label={`העמודה של ${m.cats[i]}`}
                aria-valuemin={0} aria-valuemax={max} aria-valuenow={x} aria-valuetext={chartValueText(m, i, x)} aria-readonly={locked(m, i) || undefined}
                onKeyDown={onKey(i)} onFocus={() => choose(i, false, false)}>
                <rect x={g.cx(i) - g.slot / 2 + 2} y={g.top - 4} width={g.slot - 4} height={g.B - g.top + 8} rx="8" className="mp-chart-focus" />
              </g>
            ))}
          </svg>
          <div className="mp-chart-words" aria-hidden="true">
            {g.ax.labelled.map((t) => <span key={`n${t}`} className="mp-chart-num" style={at(g.x1 + 8, g.Y(t))} dir="ltr">{chartNum(t)}</span>)}
            {vals.map((x, i) => locked(m, i) && <span key={`v${i}`} className="mp-chart-given" style={at(g.cx(i), g.Y(x) - 4)} dir="ltr">{chartNum(x)}</span>)}
          </div>
        </div>
        <div className="mp-chart-cats" aria-hidden="true">
          {m.cats.map((c, i) => <span key={c} className={clsx('mp-chart-cat', i === sel && 'on')} style={{ left: `${(100 * (g.cx(i) - g.slot / 2)) / g.W}%`, width: `${(100 * g.slot) / g.W}%` }}>{c}</span>)}
        </div>
      </div>
      <div className="manip-controls">
        <Stepper label={`העמודה של ${cat}`} value={chartNum(v)} onDec={() => put(chartSet(m, vals, sel, v - step))} onInc={() => put(chartSet(m, vals, sel, v + step))}
          decLabel={`להוריד את העמודה של ${cat}`} incLabel={`להרים את העמודה של ${cat}`} disabled={done || locked(m, sel)} decDisabled={v <= 0} incDisabled={v >= max} />
      </div>
    </div>
  );
}

/** A thin arc on the rim, outside the circle, over slices [s, s + k). */
function rimArc(s, k, w) {
  const R = PR + 5; const p = (deg) => [PC + R * Math.sin((deg * Math.PI) / 180), PC - R * Math.cos((deg * Math.PI) / 180)];
  const a0 = s * w; const a1 = Math.min((s + k) * w, a0 + 359.99); const [x0, y0] = p(a0); const [x1, y1] = p(a1);
  return `M ${x0} ${y0} A ${R} ${R} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}`;
}

function PieChart({ m, vals, sel, choose, put, refs, root, pid, done, good, goal, hint, test }) {
  const parts = pieParts(m); const w = 360 / parts;
  const [own, setOwn] = useState(null);
  const owners = pieLayout(m, own, vals);
  const now = useRef(owners); now.current = owners;
  const selRef = useRef(sel); selRef.current = sel;
  // every move goes through here: the drawing keeps its slices, the lesson gets the counts
  const apply = (next) => {
    if (done || next === now.current) return;
    now.current = next; setOwn(next); put(pieCounts(m, next));
  };
  const used = sum(vals); const rest = parts - used;
  const k = vals[sel]; const cat = m.cats[sel];
  const tone = (i) => chartTone(m, i) % TONES;
  // a press on the pie: where it is (an angle, a distance), a tap on release, or a paint along the ring
  const press = useRef(null);
  const polar = (p) => ({ a: (Math.atan2(p.x - PC, PC - p.y) * 180) / Math.PI, r: Math.hypot(p.x - PC, p.y - PC) });
  const onRing = (r) => r >= PR * 0.3 && r <= PR + 24;
  const [svgRef, drag] = useDrag((p, phase) => {
    const { a, r } = polar(p);
    if (phase === 'start') { press.current = r >= 14 && r <= PR + 24 ? { a, x: p.x, y: p.y, moved: false, last: -1 } : null; return; }
    const t = press.current; if (!t) return;
    if (phase === 'end') {
      if (!t.moved) {
        const s = pieHit(m, now.current, t.a, px()); const next = pieTap(m, { sel: selRef.current, owners: now.current }, s);
        if (next.sel !== selRef.current) choose(next.sel, false, true); else apply(next.owners);
      }
      press.current = null; return;
    }
    if (!t.moved && Math.hypot(p.x - t.x, p.y - t.y) < 6) return;
    if (!t.moved) { t.moved = true; t.last = sliceAt(parts, t.a); apply(paint(m, now.current, selRef.current, t.last)); }
    if (!onRing(r)) return;
    const s = sliceAt(parts, a);
    if (s !== t.last) { t.last = s; apply(paint(m, now.current, selRef.current, s)); }
  }, done);
  // one unit of the drawing in screen pixels, for the 44px a tap may miss by
  function px() { const b = svgRef.current?.getBoundingClientRect(); return b?.width ? b.width / PW : 1; }
  const onKey = (i) => (e) => {
    const r = pieKey(m, { sel: i, owners: now.current }, e.key);
    if (!r) return;
    e.preventDefault(); e.stopPropagation();
    if (r.sel !== i) choose(r.sel, true, false); else apply(r.owners);
  };
  // the readout keeps one height whatever is chosen (it wraps for a long name): the pie under it never moves under a
  // finger that is painting along its ring
  const readLines = m.cats.some((c) => textW(`${c}: ${parts} חלקים מתוך ${parts}, כלומר בערך 41.7%`, 15) > 280) ? 3 : 2;
  // where + goes next, marked on the rim (not in a check, and not once the object is locked)
  const next = done || locked(m, sel) ? -1 : pieNext(owners, sel);
  return (
    <div ref={root} className={clsx('manip manip-chart manip-chart-pie', good && 'good')}>
      <div className="manip-readout mp-chart-read" aria-live="polite" style={{ minHeight: `${readLines * 20}px` }}>
        <span className="mp-chart-line">{cat}: {partsWord(k)} מתוך {parts}{test ? '' : <>, <span className="mp-chart-nowrap">כלומר {pctWords(k, parts)}</span></>}</span>
        <span className="mp-chart-line sub">{rest ? `עוד לא צבועים: ${partsWord(rest)}` : 'כל החלקים צבועים'}</span>
      </div>
      {hint && <p className="manip-hint-line">{test ? `העוגה מחולקת ל־${parts} חלקים שווים.` : `כל חלק הוא ${pctWords(1, parts)} מהעוגה.`} כמה חלקים צריכה כל קטגוריה?</p>}
      <div className="mp-chart-pierow">
        <svg ref={svgRef} {...drag} viewBox={`0 0 ${PW} ${PW}`} className="manip-canvas mp-chart-canvas mp-chart-pie" dir="ltr" role="img"
          aria-label={`עוגה מחולקת ל־${parts} חלקים שווים: ${m.cats.map((c, i) => `${c} ${vals[i]}`).join(', ')}${rest ? `, ${rest} לא צבועים` : ''}`}>
          <PatternDefs id={pid} />
          <rect x="0" y="0" width={PW} height={PW} className="mp-hit" />
          {owners.map((o, s) => (o === -1
            ? <path key={s} data-slice={s} data-owner={o} d={slicePath(PC, PC, PR, s * w, (s + 1) * w)} className="mp-chart-grey" />
            : <g key={s} data-slice={s} data-owner={o}><Toned tone={tone(o)} pid={pid}>{(cls, fill) => <path d={slicePath(PC, PC, PR, s * w, (s + 1) * w)} className={cls} fill={fill} />}</Toned></g>))}
          {owners.map((o, s) => { const a = (s * w * Math.PI) / 180; return <line key={`e${s}`} x1={PC} y1={PC} x2={PC + PR * Math.sin(a)} y2={PC - PR * Math.cos(a)} className={clsx('mp-chart-cut', o === -1 && owners[(s + parts - 1) % parts] === -1 && 'grey')} />; })}
          {next >= 0 && <path d={slicePath(PC, PC, PR, next * w, (next + 1) * w)} className="mp-chart-next" />}
          <circle cx={PC} cy={PC} r={PR} className="fig-ch-rim" />
          {pieRuns(owners, sel).map(([s, n]) => <path key={`r${s}`} d={rimArc(s, n, w)} className="mp-chart-arc" />)}
        </svg>
        <div className="mp-chart-chips">
          {m.cats.map((c, i) => (
            <div key={i} ref={(el) => { refs.current[i] = el; }} className={clsx('mp-chart-chip', i === sel && 'on', locked(m, i) && 'fixed')}
              role="slider" tabIndex={done ? -1 : i === sel ? 0 : -1} aria-label={c} aria-valuemin={0} aria-valuemax={parts} aria-valuenow={vals[i]}
              aria-valuetext={chartValueText(m, i, vals[i])} aria-readonly={locked(m, i) || undefined}
              onClick={() => !done && choose(i, false, true)} onKeyDown={onKey(i)} onFocus={() => choose(i, false, false)}>
              <svg viewBox="0 0 14 14" className="mp-chart-swatch" aria-hidden="true"><Toned tone={tone(i)} pid={pid}>{(cls, fill) => <rect x="0" y="0" width="14" height="14" rx="3" className={cls} fill={fill} />}</Toned></svg>
              <span className="mp-chart-chip-name">{c}</span>
              <b dir="ltr">{vals[i]}</b>
              {goal && goal[i] !== vals[i] && <span className="mp-chart-chip-goal">צריך {goal[i]}</span>}
            </div>
          ))}
        </div>
      </div>
      <div className="manip-controls">
        <Stepper label={`חלקים ל${cat}`} value={k} onDec={() => apply(pieStep(m, now.current, sel, -1))} onInc={() => apply(pieStep(m, now.current, sel, 1))}
          decLabel={`להחזיר חלק אחד של ${cat}`} incLabel={`לצבוע עוד חלק ל${cat}`} disabled={done || locked(m, sel)} decDisabled={k <= 0} incDisabled={rest <= 0} />
      </div>
    </div>
  );
}

/** What מדי says (Manip.jsx): how to start, then what is on the chart; never whether it is right. */
export function chartCoach(m, v, touched) {
  const vals = Array.isArray(v) ? v : m.start;
  if (m.mode === 'pie') {
    const parts = pieParts(m);
    if (!touched) return `בחרו קטגוריה, וצבעו לה חלקים. כל חלק הוא ${pctWords(1, parts)} מהעוגה.`;
    const r = parts - sum(vals);
    return r ? `צבועים ${sum(vals)} חלקים מתוך ${parts}. עוד ${r === 1 ? 'חלק אחד לא צבוע' : `${r} לא צבועים`}.` : `כל ${parts} החלקים צבועים: יחד הם 100%.`;
  }
  if (!touched) return 'גררו כל עמודה עד הקו של המספר שלה. בדקו בכמה קופץ הציר.';
  return `עכשיו: ${m.cats.map((c, i) => `${c} ${chartNum(vals[i])}`).join(', ')}.`;
}
