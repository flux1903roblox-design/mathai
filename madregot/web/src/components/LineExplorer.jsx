import { useId, useState } from 'react';
import { Tex } from './MathText.jsx';

// Move m and b and watch y = mx + b: the "staircase" from (0, b) shows one
// step right and m steps up or down, exactly as on the class whiteboard.
const fmt = (v) => (Number.isInteger(v) ? `${v}` : v.toFixed(1));
const num = (v) => fmt(v).replace(/^-/, '\u2212'); // for text outside KaTeX
const lineTex = (m, b) => {
  const mt = m === 0 ? '' : m === 1 ? 'x' : m === -1 ? '-x' : `${fmt(m)}x`;
  if (!mt) return `y = ${fmt(b)}`;
  return `y = ${mt}${b === 0 ? '' : b > 0 ? ` + ${fmt(b)}` : ` - ${fmt(-b)}`}`;
};

export default function LineExplorer() {
  const [m, setM] = useState(2); const [b, setB] = useState(1);
  const id = useId();
  const r = 6; const c = 22; const pad = 26; const size = 2 * r * c + 2 * pad; const o = size / 2;
  const X = (x) => o + x * c; const Y = (y) => o - y * c;
  const ticks = []; for (let i = -r; i <= r; i++) ticks.push(i);
  const xs = [-2, -1, 0, 1, 2];
  const dir = m > 0 ? 'עולה' : m < 0 ? 'יורדת' : 'קבועה';
  return (
    <div className="explorer">
      <div className="explorer-eq"><Tex tex={lineTex(m, b)} display /></div>
      <svg viewBox={`0 0 ${size} ${size}`} className="figure coord explorer-graph" role="img" aria-label={`הגרף של ${lineTex(m, b)}`}>
        <defs><clipPath id={`${id}-clip`}><rect x={X(-r - 0.5)} y={Y(r + 0.5)} width={(2 * r + 1) * c} height={(2 * r + 1) * c} /></clipPath></defs>
        {ticks.map((i) => <line key={`v${i}`} x1={X(i)} y1={Y(r + 0.5)} x2={X(i)} y2={Y(-r - 0.5)} className="fg-grid" />)}
        {ticks.map((i) => <line key={`h${i}`} x1={X(-r - 0.5)} y1={Y(i)} x2={X(r + 0.5)} y2={Y(i)} className="fg-grid" />)}
        <line x1={X(-r - 0.6)} y1={o} x2={X(r + 0.6)} y2={o} className="fg-axis" />
        <line x1={o} y1={Y(-r - 0.6)} x2={o} y2={Y(r + 0.6)} className="fg-axis" />
        {ticks.filter((i) => i && i % 2 === 0).map((i) => (
          <g key={`t${i}`}><text x={X(i)} y={o + 15} textAnchor="middle" className="fg-tick">{i < 0 ? `−${-i}` : i}</text><text x={o - 6} y={Y(i) + 4} textAnchor="end" className="fg-tick">{i < 0 ? `−${-i}` : i}</text></g>
        ))}
        <g clipPath={`url(#${id}-clip)`}>
          <line x1={X(-r - 1)} y1={Y(m * (-r - 1) + b)} x2={X(r + 1)} y2={Y(m * (r + 1) + b)} className="fg-line explorer-line" />
          {/* the step: one right from (0, b), then m up or down */}
          <line x1={X(0)} y1={Y(b)} x2={X(1)} y2={Y(b)} className="step-run" />
          <line x1={X(1)} y1={Y(b)} x2={X(1)} y2={Y(b + m)} className="step-rise" />
          <line x1={X(1)} y1={Y(b + m)} x2={X(2)} y2={Y(b + m)} className="step-run" />
          <line x1={X(2)} y1={Y(b + m)} x2={X(2)} y2={Y(b + 2 * m)} className="step-rise" />
        </g>
        <text x={X(1) + 6} y={Y(b + m / 2) + 4} className="step-label" direction="ltr">{m > 0 ? `+${num(m)}` : num(m)}</text>
        <circle cx={X(0)} cy={Y(b)} r="5" className="fg-pt" />
        {/* the label sits right of the y-axis, on the side the line and the staircase leave free */}
        <text x={X(0) + 10} y={m < 0 ? Y(b) - 10 : Y(b) + 20} textAnchor="start" className="fg-pt-label" direction="ltr" style={{ fontStyle: 'normal', fontSize: 13 }}>{`(0, ${num(b)})`}</text>
      </svg>
      <div className="explorer-controls">
        <label htmlFor={`${id}-m`} className="field-label">השיפוע <Tex tex={`m = ${fmt(m)}`} /></label>
        <input id={`${id}-m`} type="range" min={-4} max={4} step={0.5} value={m} onChange={(e) => setM(Number(e.target.value))} dir="ltr" />
        <label htmlFor={`${id}-b`} className="field-label">החיתוך עם ציר y <Tex tex={`b = ${fmt(b)}`} /></label>
        <input id={`${id}-b`} type="range" min={-5} max={5} step={1} value={b} onChange={(e) => setB(Number(e.target.value))} dir="ltr" />
      </div>
      <p className="explorer-read">
        הפונקציה <b>{dir}</b>. {m !== 0 ? `בכל צעד ימינה ${m > 0 ? 'עולים' : 'יורדים'} ${fmt(Math.abs(m))}.` : 'הישר אופקי, בלי שינוי.'} הגרף חותך את ציר <Tex tex="y" /> ב־<Tex tex={`(0, ${fmt(b)})`} />.
      </p>
      <table className="fg-table explorer-table" dir="ltr">
        <tbody>
          <tr><th scope="row">x</th>{xs.map((x) => <td key={x}>{num(x)}</td>)}</tr>
          <tr><th scope="row">y</th>{xs.map((x) => <td key={x}>{num(m * x + b)}</td>)}</tr>
        </tbody>
      </table>
    </div>
  );
}
