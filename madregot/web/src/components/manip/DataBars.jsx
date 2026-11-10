// The mean by moving one value: four fixed bars and one the student drags. The mean line follows the bar
// (it moves a fifth as far), and the target line shows where it has to land.
import { clamp, useDrag, arrowKeys, Stepper } from './core.jsx';

const W = 360; const H = 232; const L = 34; const RGT = 344; const TOP = 32; const BOT = 204;

/** test: in a check, the live mean or median (the result being reached) is not shown; the bars and the target are. */
export default function DataBars({ m, value, onChange, locked, reveal, good, answer, hint, test = false }) {
  const { values, max } = m;
  const byMedian = m.stat === 'median';
  const target = byMedian ? m.target : m.mean;
  const all = [...values, value];
  const n = all.length; const mean = all.reduce((t, v) => t + v, 0) / n;
  const sorted = [...all].sort((x, y) => x - y);
  // an even count has two middle values: the median is halfway between them
  const median = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
  const slot = (RGT - L) / n; const bw = slot * 0.56;
  const Y = (v) => BOT - (v / max) * (BOT - TOP);
  const toV = (sy) => clamp(Math.round(((BOT - sy) / (BOT - TOP)) * max), 0, max);
  const set = (v) => { const c = clamp(v, 0, max); if (!locked && c !== value) onChange(c); };
  const [ref, drag] = useDrag((p) => set(toV(p.y)), locked);
  const bx = (i) => L + slot * i + (slot - bw) / 2;
  const meanText = Number.isInteger(mean) ? `${mean}` : mean.toFixed(1);
  const ticks = []; for (let v = 0; v <= max; v += 2) ticks.push(v);
  return (
    <div className={`manip manip-bars ${good ? 'good' : ''}`}>
      {test ? (
        <div className="manip-readout"><span className="manip-target">יעד {target}</span></div>
      ) : byMedian ? (
        <div className="manip-readout" aria-live="polite">החציון עכשיו: <b dir="ltr">{median}</b><span className="manip-sub">הממוצע: <bdi dir="ltr">{meanText}</bdi></span><span className="manip-target">יעד {target}</span></div>
      ) : (
        <div className="manip-readout" aria-live="polite">הממוצע עכשיו: <b dir="ltr">{meanText}</b><span className="manip-target">יעד {target}</span></div>
      )}
      {hint && (byMedian
        ? <p className="manip-hint-line">מסדרים את חמש העמודות מהנמוכה לגבוהה. החציון הוא השלישית.</p>
        : <p className="manip-hint-line">כל העמודות יחד צריכות להגיע ל־<bdi dir="ltr">{target} · {n} = {target * n}</bdi></p>)}
      <svg ref={ref} {...drag} viewBox={`0 0 ${W} ${H}`} className="manip-canvas" dir="ltr" tabIndex={locked ? -1 : 0}
        role="slider" aria-label="העמודה האחרונה" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-valuetext={test ? `העמודה האחרונה ${value}` : byMedian ? `העמודה האחרונה ${value}, החציון ${median}, הממוצע ${meanText}` : `העמודה האחרונה ${value}, הממוצע ${meanText}`}
        onKeyDown={arrowKeys({ up: () => set(value + 1), down: () => set(value - 1), right: () => set(value + 1), left: () => set(value - 1) })}>
        <rect x="0" y="0" width={W} height={H} className="mp-hit" />
        {ticks.map((v) => <g key={v}><line x1={L} y1={Y(v)} x2={RGT} y2={Y(v)} className="mp-grid" /><text x={L - 8} y={Y(v) + 5} textAnchor="end" className="mp-num">{v}</text></g>)}
        <line x1={L} y1={BOT} x2={RGT} y2={BOT} className="mp-axis" />
        {values.map((v, i) => (
          <g key={i}>
            <rect x={bx(i)} y={Y(v)} width={bw} height={BOT - Y(v)} rx="6" className="mp-bar" />
            <text x={bx(i) + bw / 2} y={Y(v) - 7} textAnchor="middle" className="mp-bar-value">{v}</text>
          </g>
        ))}
        {reveal && answer !== value && <rect x={bx(n - 1)} y={Y(answer)} width={bw} height={BOT - Y(answer)} rx="6" className="mp-ghost-bar" />}
        <rect x={bx(n - 1)} y={Y(value)} width={bw} height={Math.max(2, BOT - Y(value))} rx="6" className="mp-bar movable" />
        <g className="mp-point"><rect x={bx(n - 1) - 4} y={Y(value) - 9} width={bw + 8} height="18" rx="9" className="mp-handle bar-grip" /></g>
        <text x={bx(n - 1) + bw / 2} y={Y(value) - 14} textAnchor="middle" className="mp-bar-value movable">{value}</text>
        {/* the target and the live mean */}
        <line x1={L} y1={Y(target)} x2={RGT} y2={Y(target)} className="mp-target-line" />
        {test ? null : byMedian ? (<>
          <line x1={L} y1={Y(mean)} x2={RGT} y2={Y(mean)} className="mp-mean-line soft" />
          <line x1={L} y1={Y(median)} x2={RGT} y2={Y(median)} className="mp-median-line" />
        </>) : <line x1={L} y1={Y(mean)} x2={RGT} y2={Y(mean)} className="mp-mean-line" />}
      </svg>
      <div className="manip-legend">{!test && byMedian && <span className="lg median">חציון</span>}{!test && <span className={byMedian ? 'lg mean soft' : 'lg mean'}>ממוצע</span>}<span className="lg target">יעד</span></div>
      <div className="manip-controls">
        <Stepper label="העמודה האחרונה" value={value} onDec={() => set(value - 1)} onInc={() => set(value + 1)} decLabel="להוריד את העמודה" incLabel="להרים את העמודה" disabled={locked} decDisabled={value <= 0} incDisabled={value >= max} />
      </div>
    </div>
  );
}
