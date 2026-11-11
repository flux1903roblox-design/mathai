// The double number line (ציר כפול): two number lines with 0 on the left, one above the other. The top counts in its
// units (%, ס״מ במפה, כוסות מים), the bottom in the other (₪, ק״מ, כוסות סוכר); the same place on both lines is the
// same part of the whole, so 30% of 240 ₪ is read straight down from 30 on the top line.
//   move 't'    the marker moves along the top line in top.step steps; the value under it is t · bottom.max / top.max
//   move 'max'  the marker stays at fixT on the top line, and the student stretches the bottom line (its end, in
//               bottom.step steps) until the right amount is under the marker: "find the whole"
// Unit words stay outside the maths. `every` writes a label on every n-th tick only, so a value is read by counting.
// In a check (`test`) only the givens stay: the top line's values, the bottom line's 0 and its end; the value under
// the marker (and the bottom line's other labels, which would give it away) is left out.
// The same drawing is the still figure `dline` (Figure.jsx).
import clsx from 'clsx';
import { ArrowLeftRight } from 'lucide-react';
import { clamp, useDrag, arrowKeys, Stepper } from './core.jsx';
import { Tex } from '../MathText.jsx';
import { dlineValue, dlineAt, dlineNum, withUnit } from '@/content/manip.js';

const W = 360; const H = 212; const PAD = 28; const L = W - 2 * PAD;
const TOP = 74; const BOT = 152;
const HEB = /[֐-׿]/;

/**
 * Ticks of one line: values 0..max every step, and which carry a label: every `every`-th one, and further apart when the
 * drawn line is too short for its labels (so they never touch); the end is always labelled. hideInner keeps 0 and the end.
 */
function ticksOf(line, max, len, hideInner = false) {
  // hideInner 'zero': only 0 is written (the whole is the question, so its end is not)
  const n = Math.round(max / line.step);
  const longest = Math.max(...[0, max, line.step * Math.max(1, n - 1)].map((v) => tickText(v, line.unit).length));
  const room = longest * 7.6 + 10; const gap = len / Math.max(n, 1);
  const every = Math.max(line.every || 1, Math.ceil(room / gap));
  // the last ordinary label before the end is dropped when it would touch the end's
  const lastK = Math.floor(n / every) * every; const tooClose = lastK !== n && (n - lastK) * gap < room;
  return Array.from({ length: n + 1 }, (_, i) => ({
    v: i * line.step,
    label: hideInner === 'zero' ? i === 0 : hideInner ? i === 0 || i === n : i === n || (i % every === 0 && !(tooClose && i === lastK && i !== 0)),
  }));
}
/** Units other than % and Latin letters (₪, ס״מ) read right to left after the number. */
export const rtlUnit = (unit) => !!unit && unit !== '%' && /[^\x00-\x7f]/.test(unit);
/** A label on a line: the number, with % written on it (other units are the line's name). */
const tickText = (v, unit) => (unit === '%' ? `${dlineNum(v)}%` : dlineNum(v));

/** A value in a pill between the lines, under or over the marker. */
function Pill({ x, y, text, cls, rtl }) {
  const w = Math.max(34, String(text).length * 8.6 + 18);
  const cx = clamp(x, w / 2 + 2, W - w / 2 - 2);
  return (
    <g className={clsx('mp-dline-pill', cls)}>
      <rect x={cx - w / 2} y={y - 13} width={w} height={26} rx="13" />
      <text x={cx} y={y + 5} textAnchor="middle" direction={rtl || HEB.test(text) ? 'rtl' : undefined}>{text}</text>
    </g>
  );
}

/**
 * The two lines. `end` is the bottom line's end value (its max); with `scale` (move 'max') the bottom line keeps a fixed
 * scale up to scale (its longest) and the drawing stretches with `end`, else both lines span the whole width.
 * `at` is the marker's place on the top line; pills: the texts over and under it (null: not shown). hideBottom keeps the
 * bottom line's 0 and end only (a check); 'zero' keeps its 0 only (a still picture whose whole is the question).
 */
export function DlineArt({ top, bottom, end = bottom.max, scale = null, at = null, pills = {}, hideBottom = false, handle = null, ghost = null }) {
  const len = scale ? (end / scale) * L : L;
  const XT = (v) => PAD + (v / top.max) * len; // a value of the top line
  const XB = (v) => PAD + (v / end) * len; // a value of the bottom line
  const tt = ticksOf(top, top.max, len); const bt = ticksOf(bottom, end, len, hideBottom);
  const minor = (count) => len / Math.max(count, 1) >= 5; // ticks closer than 5px are left to their labels
  const xm = at == null ? null : XT(at);
  return (
    <g className="mp-dline">
      {top.label && <text x={W - 8} y={22} textAnchor="end" className="mp-dline-name">{top.label}</text>}
      {bottom.label && <text x={W - 8} y={H - 8} textAnchor="end" className="mp-dline-name">{bottom.label}</text>}
      {scale && <line x1={PAD + len} x2={PAD + L} y1={BOT} y2={BOT} className="mp-dline-room" />}
      <line x1={PAD} x2={PAD + len} y1={TOP} y2={TOP} className="mp-dline-axis" />
      <line x1={PAD} x2={PAD + len} y1={BOT} y2={BOT} className="mp-dline-axis" />
      {tt.map(({ v, label }) => ((label || minor(tt.length - 1)) ? (
        <g key={`t${v}`}>
          <line x1={XT(v)} x2={XT(v)} y1={TOP - (label ? 8 : 5)} y2={TOP + (label ? 8 : 5)} className="mp-tick" />
          {label && <text x={XT(v)} y={TOP - 16} textAnchor="middle" className="mp-num">{tickText(v, top.unit)}</text>}
        </g>
      ) : null))}
      {bt.map(({ v, label }) => ((label || minor(bt.length - 1)) ? (
        <g key={`b${v}`}>
          <line x1={XB(v)} x2={XB(v)} y1={BOT - (label ? 8 : 5)} y2={BOT + (label ? 8 : 5)} className="mp-tick" />
          {label && <text x={XB(v)} y={BOT + 26} textAnchor="middle" className={v === end ? 'mp-num strong' : 'mp-num'}>{tickText(v, bottom.unit)}</text>}
        </g>
      ) : null))}
      {ghost != null && (scale
        ? <line x1={PAD + (ghost / scale) * L} x2={PAD + (ghost / scale) * L} y1={BOT - 16} y2={BOT + 16} className="mp-dline-ghost" />
        : <line x1={XT(ghost)} x2={XT(ghost)} y1={TOP - 10} y2={BOT + 10} className="mp-dline-ghost" />)}
      {xm != null && (
        <g className="mp-dline-marker">
          <line x1={xm} x2={xm} y1={TOP} y2={BOT} className="mp-dline-drop" />
          <circle cx={xm} cy={TOP} r={handle === 'marker' ? 9 : 6} className={handle === 'marker' ? 'mp-dline-handle' : 'mp-dline-dot'} />
          <circle cx={xm} cy={BOT} r="6" className="mp-dline-dot" />
        </g>
      )}
      {pills.top != null && xm != null && <Pill x={xm} y={TOP + 24} text={pills.top} rtl={rtlUnit(top.unit)} />}
      {pills.bottom != null && xm != null && <Pill x={xm} y={BOT - 24} text={pills.bottom} cls="under" rtl={rtlUnit(bottom.unit)} />}
      {handle === 'end' && (
        <g className="mp-point">
          <circle cx={PAD + len} cy={BOT} r="14" className="mp-halo" />
          <circle cx={PAD + len} cy={BOT} r="8" className="mp-handle" />
        </g>
      )}
    </g>
  );
}
export const DLINE_VIEW = `0 0 ${W} ${H}`;

/** A number and its unit as a readout chip: the number is maths, a unit word stays outside it. */
function Chip({ v, unit }) {
  const n = dlineNum(v).replace(/,/g, '{,}');
  return (
    <span className="mp-dline-chip" dir={rtlUnit(unit) ? 'rtl' : 'ltr'}>
      <bdi dir="ltr"><Tex tex={unit === '%' ? `${n}\\%` : n} /></bdi>{unit && unit !== '%' ? <span> {unit}</span> : null}
    </span>
  );
}

/** A number and its unit in a step label: a Hebrew unit word reads after the number, right to left. */
const UnitVal = ({ v, unit }) => (rtlUnit(unit) ? <span dir="rtl"><bdi dir="ltr">{dlineNum(v)}</bdi> {unit}</span> : withUnit(v, unit));

export default function DoubleLine({ m, value, onChange, locked, reveal, good, answer, hint, test = false }) {
  const isMax = m.move === 'max';
  const line = isMax ? m.bottom : m.top; // the line whose number the student changes
  const lo = isMax ? line.step : 0;
  const v0 = dlineValue(m, value);
  const v = v0 == null ? dlineValue(m, m.start) : v0;
  const { t, max, under } = dlineAt(m, v);
  const snap = (x) => clamp(Math.round(x / line.step) * line.step, lo, line.max);
  const set = (x) => { const n = snap(x); if (!locked && Math.abs(n - v) > 1e-9) onChange(n); };
  const toV = (px) => ((px - PAD) / L) * (isMax ? m.bottom.max : m.top.max);
  const [ref, drag] = useDrag((p) => set(toV(p.x)), locked);
  const missed = reveal && typeof answer === 'number' && Math.abs(answer - v) > 1e-9;
  const pills = { top: withUnit(t, m.top.unit), bottom: test ? null : withUnit(under, m.bottom.unit) };
  const said = `${withUnit(t, m.top.unit)} למעלה${test ? '' : `, ${withUnit(under, m.bottom.unit)} למטה`}${isMax ? `, הציר התחתון עד ${withUnit(max, m.bottom.unit)}` : ''}`;
  const hintText = isMax
    ? `הסמן קבוע על ${withUnit(m.fixT, m.top.unit)}. מותחים את הציר התחתון, ומסתכלים מה מתחת לסמן.`
    : `כל צעד של ${withUnit(m.top.step, m.top.unit)} למעלה הוא ${withUnit((m.bottom.max * m.top.step) / m.top.max, m.bottom.unit)} למטה.`;
  return (
    <div className={clsx('manip', 'manip-dline', good && 'good')}>
      <div className="manip-readout mp-dline-read" aria-live="polite">
        <Chip v={t} unit={m.top.unit} />
        {!test && <><ArrowLeftRight size={18} strokeWidth={2.4} aria-hidden="true" className="mp-dline-arrow" /><span className="visually-hidden">מול</span><Chip v={under} unit={m.bottom.unit} /></>}
      </div>
      {hint && !test && <p className="manip-hint-line">{hintText}</p>}
      <svg ref={ref} {...drag} viewBox={DLINE_VIEW} className="manip-canvas" dir="ltr" tabIndex={locked ? -1 : 0}
        role="slider" aria-roledescription="ציר כפול" aria-label={isMax ? 'הקצה של הציר התחתון' : 'הסמן על הציר הכפול'}
        aria-valuemin={lo} aria-valuemax={line.max} aria-valuenow={v} aria-valuetext={said}
        onKeyDown={arrowKeys({ left: () => set(v - line.step), right: () => set(v + line.step), home: () => set(lo), end: () => set(line.max) })}>
        <rect x="0" y="0" width={W} height={H} className="mp-hit" />
        <DlineArt top={m.top} bottom={m.bottom} end={max} scale={isMax ? m.bottom.max : null} at={t} pills={pills} hideBottom={test}
          handle={isMax ? 'end' : 'marker'} ghost={missed ? answer : null} />
      </svg>
      <div className="manip-controls">
        <Stepper label={isMax ? 'השלם' : 'הסמן'} value={isMax ? <UnitVal v={max} unit={m.bottom.unit} /> : <UnitVal v={t} unit={m.top.unit} />}
          onDec={() => set(v - line.step)} onInc={() => set(v + line.step)}
          decLabel={isMax ? 'לקצר את הציר התחתון' : 'הסמן שמאלה'} incLabel={isMax ? 'להאריך את הציר התחתון' : 'הסמן ימינה'}
          disabled={locked} decDisabled={v <= lo + 1e-9} incDisabled={v >= line.max - 1e-9} />
      </div>
    </div>
  );
}

/** What the double line shows, for מדי (Manip.jsx). */
export function dlineCoach(m, value, touched) {
  const v = dlineValue(m, value) ?? dlineValue(m, m.start);
  const { t, max, under } = dlineAt(m, v);
  if (!touched) return m.move === 'max' ? 'גררו את הקצה של הציר התחתון כדי למתוח אותו. הסמן נשאר במקום.' : 'גררו את הסמן על הציר העליון, וקראו מה מתחתיו.';
  return m.move === 'max'
    ? `הציר התחתון עכשיו עד ${withUnit(max, m.bottom.unit)}, ומתחת לסמן יש ${withUnit(under, m.bottom.unit)}.`
    : `הסמן על ${withUnit(t, m.top.unit)} למעלה, ומתחתיו ${withUnit(under, m.bottom.unit)}.`;
}
