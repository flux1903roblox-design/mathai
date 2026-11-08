// The coordinate plane the interactive objects are drawn on (the same look as the lesson drawings).
import { minus } from './core.jsx';

export function gridGeometry(r = 6) {
  const c = 22; const pad = 26; const size = 2 * r * c + 2 * pad; const o = size / 2;
  const X = (x) => o + x * c; const Y = (y) => o - y * c;
  const toX = (sx) => Math.round((sx - o) / c); const toY = (sy) => Math.round((o - sy) / c);
  return { r, c, pad, size, o, X, Y, toX, toY };
}

export function Plane({ g, children }) {
  const { r, X, Y, o } = g;
  const ticks = []; for (let i = -r; i <= r; i += 1) ticks.push(i);
  return (
    <>
      <rect x="0" y="0" width={g.size} height={g.size} className="mp-hit" />
      {ticks.map((i) => <line key={`v${i}`} x1={X(i)} y1={Y(r + 0.5)} x2={X(i)} y2={Y(-r - 0.5)} className="mp-grid" />)}
      {ticks.map((i) => <line key={`h${i}`} x1={X(-r - 0.5)} y1={Y(i)} x2={X(r + 0.5)} y2={Y(i)} className="mp-grid" />)}
      <line x1={X(-r - 0.6)} y1={o} x2={X(r + 0.75)} y2={o} className="mp-axis" />
      <line x1={o} y1={Y(-r - 0.6)} x2={o} y2={Y(r + 0.75)} className="mp-axis" />
      <path d={`M ${X(r + 0.95)} ${o} l -9 -5 v 10 z`} className="mp-axis-head" />
      <path d={`M ${o} ${Y(r + 0.95)} l -5 9 h 10 z`} className="mp-axis-head" />
      <text x={X(r + 0.7)} y={o + 18} className="mp-axis-name">x</text>
      <text x={o + 9} y={Y(r + 0.6)} className="mp-axis-name">y</text>
      {ticks.filter((i) => i && i % 2 === 0).map((i) => (
        <g key={`t${i}`}>
          <text x={X(i)} y={o + 18} textAnchor="middle" className="mp-num">{minus(i)}</text>
          <text x={o - 7} y={Y(i) + 5} textAnchor="end" className="mp-num">{minus(i)}</text>
        </g>
      ))}
      {children}
    </>
  );
}
