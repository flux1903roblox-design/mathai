// Build a chart (DATA-2.2): a bar chart or a pie, from a table, on a 320px phone, with a keyboard and a screen reader.
//   bar  the still figure's drawing (ChartArt.jsx barGeom and BarChartArt: the first category on the right, the axis on
//        the right with a light grid line at every step and a number every `every` steps, at most 8; critique note 25).
//        A bar's height follows a drag anywhere in its column (it snaps to the step); a tap selects it; the Stepper
//        "העמודה של …" moves the selected one. Each bar is a slider: ←/→ choose a bar in reading order, ↑/↓ one step,
//        Home/End 0 and the top. `lock` bars are given and do not move (their values are written over them).
//   pie  a 200px circle cut into `parts` equal slices; each category takes slices clockwise from 12 o'clock, in order,
//        and what is left stays grey. The chips under it choose a category (each is a slider "אדום: 3 מתוך 12 חלקים"),
//        and the Stepper "חלקים ל…" is the main path (critique note 24): + takes the next grey slice, − gives the last
//        one back. A tap on a grey slice colours it too (its hit area is widened to at least 44px of arc on the rim),
//        a tap on a category's last slice gives it back, a tap on another colour chooses that category, and a press
//        dragged along the ring colours each grey slice it crosses. ←/→ choose a chip, ↑/↓ add or take a slice.
// The value is number[]: a bar's height (a multiple of bar.step, 0..bar.max), or a category's number of slices (their
// sum at most pie.parts). The readouts say the selected category; in a check (`test`) the pie's percent is not shown
// (turning parts into percent is the skill). Every chart item is practice-only.
import { useId, useRef, useState } from 'react';
import clsx from 'clsx';
import { useDrag, Stepper, clamp } from './core.jsx';
import { barGeom, BarChartArt, PatternDefs, Toned, slicePath, TONES, textW } from './ChartArt.jsx';
import { chartNum, chartPct, chartTone } from '@/content/manip.js';
import '@/styles/lazy/figure.css'; // the colour families (fig-tone-k), the patterns and the bar drawing's rules

// ---------------------------------------------------------------- the values (pure: the keyboard and the tests use them)

const near = (a, b) => Math.abs(a - b) < 1e-9;
const locked = (m, i) => (m.lock || []).includes(i);
const pieParts = (m) => m.pie?.parts || 12;
const sum = (vs) => vs.reduce((a, b) => a + b, 0);

/**
 * One category set to v: a bar snaps to the step within 0..max; a pie category takes at most the slices that are not
 * someone else's. A locked category, or a value that is not a number, leaves the values as they are.
 */
export function chartSet(m, values, i, v) {
  if (locked(m, i) || !Number.isFinite(v) || i < 0 || i >= values.length) return values;
  let c;
  if (m.mode === 'pie') c = clamp(Math.round(v), 0, pieParts(m) - (sum(values) - values[i]));
  else { const { max, step } = m.bar; c = clamp(Math.round(v / step) * step, 0, max); c = Math.round(c * 1e6) / 1e6; }
  if (near(c, values[i])) return values;
  const next = [...values]; next[i] = c; return next;
}

/** One step up or down: a bar's step, or one slice of a pie. */
const stepOf = (m) => (m.mode === 'pie' ? 1 : m.bar.step);

/**
 * A key on a category ({ sel, values } → the next): ←/→ the next or the previous category in reading order (right to
 * left: ← is the next one), ↑/↓ one step, Home 0, End the most it can be. Other keys return null (not handled).
 */
export function chartKey(m, { sel, values }, key) {
  const n = values.length;
  switch (key) {
    case 'ArrowLeft': return { sel: Math.min(n - 1, sel + 1), values };
    case 'ArrowRight': return { sel: Math.max(0, sel - 1), values };
    case 'ArrowUp': return { sel, values: chartSet(m, values, sel, values[sel] + stepOf(m)) };
    case 'ArrowDown': return { sel, values: chartSet(m, values, sel, values[sel] - stepOf(m)) };
    case 'Home': return { sel, values: chartSet(m, values, sel, 0) };
    case 'End': return { sel, values: chartSet(m, values, sel, m.mode === 'pie' ? pieParts(m) : m.bar.max) };
    default: return null;
  }
}

/** Who owns each slice of the pie, clockwise from 12 o'clock: the categories in order, then grey (−1). */
export function pieOwners(m, values) {
  const out = [];
  values.forEach((k, i) => { for (let j = 0; j < k; j += 1) out.push(i); });
  while (out.length < pieParts(m)) out.push(-1);
  return out.slice(0, pieParts(m));
}

const PR = 100; const PC = 112; const PW = 224; // the pie: radius 100 (200px across) in a 224-wide box
/** The slice under an angle (degrees clockwise from 12 o'clock). */
const sliceAt = (parts, a) => Math.floor((((a % 360) + 360) % 360) / (360 / parts)) % parts;
/**
 * The slice a tap means: the one under the finger, unless it is coloured and a grey neighbour's wedge, widened to at
 * least 44px of arc on the rim, holds the tap (at 20 parts a slice is about 31px of rim: a tap near its edge counts).
 */
export function pieHit(m, values, a) {
  const parts = pieParts(m); const w = 360 / parts; const owners = pieOwners(m, values);
  const k = sliceAt(parts, a);
  if (owners[k] === -1) return k;
  const arc = (w * Math.PI * PR) / 180; const tol = arc >= 44 ? 0 : (((44 - arc) / 2) / PR) * (180 / Math.PI);
  const at = ((a % 360) + 360) % 360;
  for (const j of [(k + parts - 1) % parts, (k + 1) % parts]) {
    if (owners[j] !== -1) continue;
    const lo = j * w; const hi = lo + w;
    const d = Math.min(...[lo, hi].map((e) => { const x = Math.abs(at - e); return Math.min(x, 360 - x); }));
    if (d <= tol) return j;
  }
  return k;
}

/** A tap on slice s of the pie: a grey slice is coloured for the selected category, the selected category's last slice
 * is given back, another colour chooses its category. */
export function pieTap(m, { sel, values }, s) {
  const owners = pieOwners(m, values); const o = owners[s];
  if (o === -1) return { sel, values: chartSet(m, values, sel, values[sel] + 1) };
  if (o !== sel) return { sel: o, values };
  const last = owners.lastIndexOf(sel);
  return { sel, values: s === last ? chartSet(m, values, sel, values[sel] - 1) : values };
}

// ---------------------------------------------------------------- words

const partsWord = (k) => (k === 1 ? 'חלק אחד' : `${k} חלקים`);
/** k slices of `parts` in percent: "25%", "בערך 41.7%" (a twelfth is not a whole tenth of a percent). */
const pctWords = (k, parts) => { const p = chartPct(k, parts); return `${near((100 * k) / parts, Number(p)) ? '' : 'בערך '}${p}%`; };
/** What a screen reader hears on a category's slider. */
export const chartValueText = (m, i, v) => (m.mode === 'pie' ? `${m.cats[i]}: ${v} מתוך ${pieParts(m)} חלקים` : `${m.cats[i]}: ${chartNum(v)}${m.bar.unit ? ` ${m.bar.unit}` : ''}`);

// ---------------------------------------------------------------- the object

export default function Chart({ m, value, onChange, locked: done, reveal, good, answer, hint, test = false }) {
  const pie = m.mode === 'pie';
  const vals = Array.isArray(value) && value.length === m.cats.length ? value : m.start;
  const cur = useRef(vals); cur.current = vals;
  const [sel, setSel] = useState(() => Math.max(0, m.cats.findIndex((_, i) => !locked(m, i))));
  const refs = useRef([]);
  const pid = `chart-${useId().replace(/[^\w-]/g, '')}`;
  const put = (next) => { if (!done && next !== cur.current) { cur.current = next; onChange(next); } };
  const choose = (i, focus) => { setSel(i); if (focus) refs.current[i]?.focus({ preventScroll: true }); };
  const onKey = (i) => (e) => {
    const r = chartKey(m, { sel: i, values: cur.current }, e.key);
    if (!r) return;
    e.preventDefault(); e.stopPropagation();
    if (r.sel !== i) choose(r.sel, true); else put(r.values);
  };
  const goal = reveal && answer?.values ? answer.values : null;
  return pie
    ? <PieChart {...{ m, vals, cur, sel, choose, put, onKey, refs, pid, done, good, goal, hint, test }} />
    : <BarChart {...{ m, vals, sel, choose, put, onKey, refs, done, good, goal, hint, test }} />;
}

function BarChart({ m, vals, sel, choose, put, onKey, refs, done, good, goal, hint }) {
  const { max, step, every, unit } = m.bar;
  const f = { mode: 'bar', cats: m.cats, values: vals, max, step, every, unit, labels: false, tones: m.tones };
  const g = barGeom(f);
  const slotAt = (x) => { const i = Math.floor((g.x1 - x) / g.slot); return i >= 0 && i < vals.length ? i : -1; };
  const valueAt = (y) => ((g.B - y) / (g.B - g.top)) * (g.ax.max - g.ax.from) + g.ax.from;
  const press = useRef(null);
  const [svgRef, drag] = useDrag((p, phase) => {
    if (phase === 'start') {
      const i = slotAt(p.x); press.current = i < 0 ? null : { i, y: p.y, moved: false };
      if (i >= 0) choose(i, false);
      return;
    }
    const t = press.current; if (!t) return;
    if (!t.moved && Math.abs(p.y - t.y) < 6) return;
    t.moved = true;
    put(chartSet(m, vals, t.i, valueAt(p.y)));
  }, done);
  const v = vals[sel]; const cat = m.cats[sel];
  return (
    <div className={clsx('manip manip-chart manip-chart-bar', good && 'good')}>
      <div className="manip-readout mp-chart-read" aria-live="polite"><span>{cat}:</span> <b dir="ltr">{chartNum(v)}</b></div>
      {hint && <p className="manip-hint-line">הציר קופץ ב־{chartNum(step)}: כל קו הוא עוד {chartNum(step)}. ספרו קווים מ־0.</p>}
      <svg ref={svgRef} {...drag} viewBox={`0 0 ${g.W} ${g.H}`} className="manip-canvas mp-chart-canvas" dir="ltr" role="group" aria-label={`דיאגרמת עמודות: ${m.cats.join(', ')}`}>
        <rect x="0" y="0" width={g.W} height={g.H} className="mp-hit" />
        <rect x={g.cx(sel) - g.slot / 2 + 2} y={g.top - 4} width={g.slot - 4} height={g.B - g.top + 8} rx="8" className="mp-chart-selbg" />
        {unit && <text x={g.W / 2} y="18" textAnchor="middle" direction="rtl" className="fg-word">{unit}</text>}
        <BarChartArt f={f} g={g} />
        {goal && goal.map((a, i) => !near(a, vals[i]) && <rect key={`gh${i}`} x={g.cx(i) - g.bw / 2} y={g.Y(a)} width={g.bw} height={Math.max(2, g.B - g.Y(a))} rx="3" className="mp-ghost-bar" />)}
        {vals.map((x, i) => (locked(m, i)
          ? <text key={`v${i}`} x={g.cx(i)} y={g.Y(x) - 7} textAnchor="middle" className="fig-ch-val">{chartNum(x)}</text>
          : <rect key={`h${i}`} x={g.cx(i) - g.bw / 2 - 4} y={g.Y(x) - 7} width={g.bw + 8} height="14" rx="7" className="mp-handle bar-grip" />))}
        {vals.map((x, i) => (
          <g key={`s${i}`} ref={(el) => { refs.current[i] = el; }} className={clsx('mp-chart-slot', i === sel && 'on')}
            role="slider" tabIndex={done ? -1 : i === sel ? 0 : -1} aria-label={`העמודה של ${m.cats[i]}`}
            aria-valuemin={0} aria-valuemax={max} aria-valuenow={x} aria-valuetext={chartValueText(m, i, x)} aria-readonly={locked(m, i) || undefined}
            onKeyDown={onKey(i)} onFocus={() => choose(i, false)}>
            <rect x={g.cx(i) - g.slot / 2 + 2} y={g.top - 4} width={g.slot - 4} height={g.B - g.top + 8} rx="8" className="mp-chart-focus" />
          </g>
        ))}
      </svg>
      <div className="manip-controls">
        <Stepper label={`העמודה של ${cat}`} value={chartNum(v)} onDec={() => put(chartSet(m, vals, sel, v - step))} onInc={() => put(chartSet(m, vals, sel, v + step))}
          decLabel={`להוריד את העמודה של ${cat}`} incLabel={`להרים את העמודה של ${cat}`} disabled={done || locked(m, sel)} decDisabled={v <= 0} incDisabled={v >= max} />
      </div>
    </div>
  );
}

function PieChart({ m, vals, cur, sel, choose, put, onKey, refs, pid, done, good, goal, hint, test }) {
  const parts = pieParts(m); const w = 360 / parts;
  const owners = pieOwners(m, vals);
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
      if (!t.moved) { const s = pieHit(m, vals, t.a); const next = pieTap(m, { sel, values: vals }, s); if (next.sel !== sel) choose(next.sel, false); put(next.values); }
      press.current = null; return;
    }
    if (!t.moved && Math.hypot(p.x - t.x, p.y - t.y) < 6) return;
    if (!t.moved) { t.moved = true; t.last = sliceAt(parts, t.a); paint(t.last); }
    if (!onRing(r)) return;
    const s = sliceAt(parts, a);
    if (s !== t.last) { t.last = s; paint(s); }
  }, done);
  // a slice crossed by a drag is coloured if it is grey now (the latest values, which a fast drag may be ahead of)
  function paint(s) { const now = cur.current; if (pieOwners(m, now)[s] === -1) put(chartSet(m, now, sel, now[sel] + 1)); }
  // the readout keeps one height whatever is chosen (it wraps for a long name): the pie under it never moves under a
  // finger that is painting along its ring
  const readLines = m.cats.some((c) => textW(`${c}: ${parts} חלקים מתוך ${parts}, כלומר בערך 41.7%`, 15) > 280) ? 3 : 2;
  // the selected category's slices, outlined on the rim
  const first = owners.indexOf(sel); const last = owners.lastIndexOf(sel);
  const arc = first >= 0 ? (() => {
    const R = PR + 5; const p = (deg) => [PC + R * Math.sin((deg * Math.PI) / 180), PC - R * Math.cos((deg * Math.PI) / 180)];
    const a0 = first * w; const a1 = (last + 1) * w; const [x0, y0] = p(a0); const [x1, y1] = p(Math.min(a1, a0 + 359.99));
    return `M ${x0} ${y0} A ${R} ${R} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}`;
  })() : null;
  return (
    <div className={clsx('manip manip-chart manip-chart-pie', good && 'good')}>
      <div className="manip-readout mp-chart-read" aria-live="polite" style={{ minHeight: `${readLines * 20}px` }}>
        <span className="mp-chart-line">{cat}: {partsWord(k)} מתוך {parts}{test ? '' : <>, <span className="mp-chart-nowrap">כלומר {pctWords(k, parts)}</span></>}</span>
        <span className="mp-chart-line sub">{rest ? `עוד לא צבועים: ${partsWord(rest)}` : 'כל החלקים צבועים'}</span>
      </div>
      {hint && <p className="manip-hint-line">{test ? `העוגה מחולקת ל־${parts} חלקים שווים.` : `כל חלק הוא ${pctWords(1, parts)} מהעוגה.`} כמה חלקים צריכה כל קטגוריה?</p>}
      <svg ref={svgRef} {...drag} viewBox={`0 0 ${PW} ${PW}`} className="manip-canvas mp-chart-canvas mp-chart-pie" dir="ltr" role="img"
        aria-label={`עוגה מחולקת ל־${parts} חלקים שווים: ${m.cats.map((c, i) => `${c} ${vals[i]}`).join(', ')}${rest ? `, ${rest} לא צבועים` : ''}`}>
        <PatternDefs id={pid} />
        <rect x="0" y="0" width={PW} height={PW} className="mp-hit" />
        {owners.map((o, s) => (o === -1
          ? <path key={s} d={slicePath(PC, PC, PR, s * w, (s + 1) * w)} className="mp-chart-grey" />
          : <Toned key={s} tone={tone(o)} pid={pid}>{(cls, fill) => <path d={slicePath(PC, PC, PR, s * w, (s + 1) * w)} className={cls} fill={fill} />}</Toned>))}
        {owners.map((o, s) => { const a = (s * w * Math.PI) / 180; return <line key={`e${s}`} x1={PC} y1={PC} x2={PC + PR * Math.sin(a)} y2={PC - PR * Math.cos(a)} className={clsx('mp-chart-cut', o === -1 && owners[(s + parts - 1) % parts] === -1 && 'grey')} />; })}
        <circle cx={PC} cy={PC} r={PR} className="fig-ch-rim" />
        {arc && <path d={arc} className="mp-chart-arc" />}
      </svg>
      <div className="mp-chart-chips">
        {m.cats.map((c, i) => (
          <div key={i} ref={(el) => { refs.current[i] = el; }} className={clsx('mp-chart-chip', i === sel && 'on', locked(m, i) && 'fixed')}
            role="slider" tabIndex={done ? -1 : i === sel ? 0 : -1} aria-label={c} aria-valuemin={0} aria-valuemax={parts} aria-valuenow={vals[i]}
            aria-valuetext={chartValueText(m, i, vals[i])} aria-readonly={locked(m, i) || undefined}
            onClick={() => !done && choose(i, false)} onKeyDown={onKey(i)} onFocus={() => choose(i, false)}>
            <svg viewBox="0 0 14 14" className="mp-chart-swatch" aria-hidden="true"><Toned tone={tone(i)} pid={pid}>{(cls, fill) => <rect x="0" y="0" width="14" height="14" rx="3" className={cls} fill={fill} />}</Toned></svg>
            <span className="mp-chart-chip-name">{c}</span>
            <b dir="ltr">{vals[i]}</b>
            {goal && goal[i] !== vals[i] && <span className="mp-chart-chip-goal">צריך {goal[i]}</span>}
          </div>
        ))}
      </div>
      <div className="manip-controls">
        <Stepper label={`חלקים ל${cat}`} value={k} onDec={() => put(chartSet(m, vals, sel, k - 1))} onInc={() => put(chartSet(m, vals, sel, k + 1))}
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
