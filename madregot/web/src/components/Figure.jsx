// Textbook figures drawn from the generators' data: coordinate plane, angles,
// triangles and a frequency table. Drawn on the same 4px grid as the page.
const rad = (d) => (d * Math.PI) / 180;
const MATH_FONT = "KaTeX_Main, 'Times New Roman', serif";

function Coord({ fig }) {
  const r = fig.range || 6; const c = 22; const pad = 26;
  const size = 2 * r * c + 2 * pad; const o = size / 2;
  const X = (x) => o + x * c; const Y = (y) => o - y * c;
  const ticks = []; for (let i = -r; i <= r; i++) ticks.push(i);
  const label = (n) => (n < 0 ? `−${-n}` : `${n}`);
  let lineEl = null;
  if (fig.line) {
    const { m, b } = fig.line; const x1 = -r - 0.5; const x2 = r + 0.5;
    lineEl = <line x1={X(x1)} y1={Y(m * x1 + b)} x2={X(x2)} y2={Y(m * x2 + b)} className="fg-line" />;
  }
  const visible = (fig.points || []).filter((p) => !p.hidden);
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="figure coord" role="img" aria-label="מערכת צירים">
      <defs>
        <clipPath id="plane"><rect x={X(-r - 0.5)} y={Y(r + 0.5)} width={(2 * r + 1) * c} height={(2 * r + 1) * c} /></clipPath>
      </defs>
      {ticks.map((i) => <line key={`v${i}`} x1={X(i)} y1={Y(r + 0.5)} x2={X(i)} y2={Y(-r - 0.5)} className="fg-grid" />)}
      {ticks.map((i) => <line key={`h${i}`} x1={X(-r - 0.5)} y1={Y(i)} x2={X(r + 0.5)} y2={Y(i)} className="fg-grid" />)}
      <line x1={X(-r - 0.6)} y1={o} x2={X(r + 0.75)} y2={o} className="fg-axis" />
      <line x1={o} y1={Y(-r - 0.6)} x2={o} y2={Y(r + 0.75)} className="fg-axis" />
      <polygon points={`${X(r + 0.95)},${o} ${X(r + 0.6)},${o - 4} ${X(r + 0.6)},${o + 4}`} className="fg-axis-head" />
      <polygon points={`${o},${Y(r + 0.95)} ${o - 4},${Y(r + 0.6)} ${o + 4},${Y(r + 0.6)}`} className="fg-axis-head" />
      <text x={X(r + 0.75)} y={o + 16} className="fg-axis-name" style={{ fontFamily: MATH_FONT }}>x</text>
      <text x={o + 8} y={Y(r + 0.7)} className="fg-axis-name" style={{ fontFamily: MATH_FONT }}>y</text>
      {ticks.filter((i) => i && i % 2 === 0).map((i) => (
        <g key={`t${i}`}>
          <text x={X(i)} y={o + 15} textAnchor="middle" className="fg-tick">{label(i)}</text>
          <text x={o - 6} y={Y(i) + 4} textAnchor="end" className="fg-tick">{label(i)}</text>
        </g>
      ))}
      <g clipPath="url(#plane)">
        {fig.polygon && <polygon points={fig.polygon.map(([x, y]) => `${X(x)},${Y(y)}`).join(' ')} className="fg-poly" />}
        {lineEl}
        {fig.helper && <polyline points={fig.helper.map(([x, y]) => `${X(x)},${Y(y)}`).join(' ')} className="fg-helper" />}
        {(fig.segments || []).map(([[x1, y1], [x2, y2]], i) => <line key={i} x1={X(x1)} y1={Y(y1)} x2={X(x2)} y2={Y(y2)} className="fg-seg" />)}
      </g>
      {visible.map((p) => (
        <g key={p.label}>
          <circle cx={X(p.x)} cy={Y(p.y)} r="5" className="fg-pt" />
          <text x={X(p.x) + (p.x >= 0 ? 8 : -8)} y={Y(p.y) - 8} textAnchor={p.x >= 0 ? 'start' : 'end'} className="fg-pt-label" style={{ fontFamily: MATH_FONT }}>{p.label}</text>
        </g>
      ))}
    </svg>
  );
}

function arcPath(cx, cy, rr, a0, a1) {
  const p0 = [cx + rr * Math.cos(rad(a0)), cy - rr * Math.sin(rad(a0))];
  const p1 = [cx + rr * Math.cos(rad(a1)), cy - rr * Math.sin(rad(a1))];
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  return `M ${p0[0]} ${p0[1]} A ${rr} ${rr} 0 ${large} 0 ${p1[0]} ${p1[1]}`;
}
function AngleMark({ cx, cy, a0, a1, text, target, rr = 30 }) {
  const mid = (a0 + a1) / 2; const lr = rr + 16;
  return (
    <g>
      <path d={arcPath(cx, cy, rr, a0, a1)} className={target ? 'fg-arc target' : 'fg-arc'} />
      <text x={cx + lr * Math.cos(rad(mid))} y={cy - lr * Math.sin(rad(mid)) + 5} textAnchor="middle" className={target ? 'fg-angle target' : 'fg-angle'}>{text}</text>
    </g>
  );
}
const ray = (cx, cy, a, L) => [cx + L * Math.cos(rad(a)), cy - L * Math.sin(rad(a))];

function Linear({ fig }) {
  const O = [170, 150]; const [ex, ey] = ray(...O, fig.a, 120);
  return (
    <svg viewBox="0 0 340 190" className="figure" role="img" aria-label="זוויות צמודות">
      <line x1="20" y1={O[1]} x2="320" y2={O[1]} className="fg-ray" />
      <line x1={O[0]} y1={O[1]} x2={ex} y2={ey} className="fg-ray" />
      <AngleMark cx={O[0]} cy={O[1]} a0={0} a1={fig.a} text={`${fig.a}°`} />
      <AngleMark cx={O[0]} cy={O[1]} a0={fig.a} a1={180} text="?" target rr={24} />
      <circle cx={O[0]} cy={O[1]} r="3" className="fg-vertex" />
    </svg>
  );
}

function Cross({ fig }) {
  const O = [170, 110]; const a = fig.a;
  const [x1, y1] = ray(...O, a, 110); const [x2, y2] = ray(...O, a + 180, 110);
  const t = fig.target === 'vertical' ? [180, 180 + a] : [a, 180];
  return (
    <svg viewBox="0 0 340 220" className="figure" role="img" aria-label="ישרים נחתכים">
      <line x1="30" y1={O[1]} x2="310" y2={O[1]} className="fg-ray" />
      <line x1={x2} y1={y2} x2={x1} y2={y1} className="fg-ray" />
      <AngleMark cx={O[0]} cy={O[1]} a0={0} a1={a} text={`${a}°`} />
      <AngleMark cx={O[0]} cy={O[1]} a0={t[0]} a1={t[1]} text="?" target rr={24} />
      <circle cx={O[0]} cy={O[1]} r="3" className="fg-vertex" />
    </svg>
  );
}

function Parallel({ fig }) {
  const a = fig.a; const yU = 70; const yL = 160; const k = Math.cos(rad(a)) / Math.sin(rad(a));
  const U = [170 + ((yL - yU) / 2) * k, yU]; const Lw = [170 - ((yL - yU) / 2) * k, yL]; // up by Δy moves x by Δy·cot(a)
  const [tx1, ty1] = ray(...U, a, 60); const [tx2, ty2] = ray(...Lw, a + 180, 60);
  const pos = { ur: [0, a], ul: [a, 180], ll: [180, 180 + a], lr: [180 + a, 360] };
  const plan = { corresponding: [['U', 'ur'], ['L', 'ur']], alternate: [['U', 'll'], ['L', 'ur']], cointerior: [['L', 'ur'], ['U', 'lr']] }[fig.kind];
  const at = (w) => (w === 'U' ? U : Lw);
  const [known, target] = plan;
  return (
    <svg viewBox="0 0 340 230" className="figure" role="img" aria-label="ישרים מקבילים וחותך">
      <line x1="20" y1={yU} x2="320" y2={yU} className="fg-ray" />
      <line x1="20" y1={yL} x2="320" y2={yL} className="fg-ray" />
      <line x1={tx2} y1={ty2} x2={tx1} y2={ty1} className="fg-ray" />
      <path d={`M 300 ${yU - 5} l 8 5 l -8 5`} className="fg-par" />
      <path d={`M 300 ${yL - 5} l 8 5 l -8 5`} className="fg-par" />
      <AngleMark cx={at(known[0])[0]} cy={at(known[0])[1]} a0={pos[known[1]][0]} a1={pos[known[1]][1]} text={`${a}°`} rr={24} />
      <AngleMark cx={at(target[0])[0]} cy={at(target[0])[1]} a0={pos[target[1]][0]} a1={pos[target[1]][1]} text="?" target rr={20} />
    </svg>
  );
}

function Triangle({ fig }) {
  const [v0, v1, v2] = fig.angles;
  // geometry angles at base-left, base-right, apex
  const [A, B, C] = fig.exterior ? [v0, v2, v1] : [v0, v1, v2];
  const base = 1; const sideB = (base * Math.sin(rad(B))) / Math.sin(rad(C));
  const apex = [sideB * Math.cos(rad(A)), sideB * Math.sin(rad(A))];
  const pts = [[0, 0], [base, 0], apex];
  const ext = fig.exterior ? 0.45 : 0;
  const xs = [...pts.map((p) => p[0]), base + ext]; const ys = pts.map((p) => p[1]);
  const W = 280; const H = 170; const s = Math.min(W / (Math.max(...xs) - Math.min(...xs)), H / (Math.max(...ys) - Math.min(...ys)));
  const ox = 30 - Math.min(...xs) * s; const oy = 200;
  const P = pts.map(([x, y]) => [ox + x * s, oy - y * s]);
  const dirDeg = (from, to) => (Math.atan2(-(to[1] - from[1]), to[0] - from[0]) * 180) / Math.PI;
  const norm = (d) => ((d % 360) + 360) % 360;
  const labels = []; let hiddenSeen = false;
  const angleSpans = [
    [P[0], norm(dirDeg(P[0], P[1])), norm(dirDeg(P[0], P[2]))],
    [P[1], norm(dirDeg(P[1], P[2])), norm(dirDeg(P[1], P[0]))],
    [P[2], norm(dirDeg(P[2], P[0])), norm(dirDeg(P[2], P[1]))],
  ];
  const valueAt = fig.exterior ? [v0, null, v1] : [v0, v1, v2];
  const shownAt = fig.exterior ? [true, false, true] : fig.show;
  angleSpans.forEach(([pt, a0, a1], i) => {
    let b = a1; if (b < a0) b += 360;
    if (shownAt[i]) labels.push(<AngleMark key={i} cx={pt[0]} cy={pt[1]} a0={a0} a1={b} text={`${valueAt[i]}°`} rr={22} />);
    else if (!fig.exterior && !hiddenSeen) { hiddenSeen = true; labels.push(<AngleMark key={i} cx={pt[0]} cy={pt[1]} a0={a0} a1={b} text="?" target rr={20} />); }
  });
  let extEl = null;
  if (fig.exterior) {
    const end = [P[1][0] + ext * s, P[1][1]];
    const a1 = norm(dirDeg(P[1], P[2]));
    extEl = (
      <g>
        <line x1={P[1][0]} y1={P[1][1]} x2={end[0]} y2={end[1]} className="fg-ray dashed" />
        <AngleMark cx={P[1][0]} cy={P[1][1]} a0={0} a1={a1} text="?" target rr={20} />
      </g>
    );
  }
  const tick = (p, q) => { const m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; const d = Math.atan2(q[1] - p[1], q[0] - p[0]) + Math.PI / 2; return <line x1={m[0] - 6 * Math.cos(d)} y1={m[1] - 6 * Math.sin(d)} x2={m[0] + 6 * Math.cos(d)} y2={m[1] + 6 * Math.sin(d)} className="fg-ray" />; };
  return (
    <svg viewBox="0 0 340 230" className="figure" role="img" aria-label="משולש">
      <polygon points={P.map((p) => p.join(',')).join(' ')} className="fg-tri" />
      {fig.iso && <>{tick(P[0], P[2])}{tick(P[1], P[2])}</>}
      {labels}
      {extEl}
    </svg>
  );
}

function RightTri({ fig }) {
  const a = typeof fig.a === 'number' ? fig.a : null; const b = typeof fig.b === 'number' ? fig.b : null; const c = typeof fig.c === 'number' ? fig.c : null;
  const A = a ?? Math.sqrt(c * c - b * b); const B = b ?? Math.sqrt(c * c - a * a);
  const s = Math.min(240 / B, 160 / A);
  const P0 = [60, 190]; const P1 = [60 + B * s, 190]; const P2 = [60, 190 - A * s];
  const t = (v) => (typeof v === 'number' ? `${v}` : '?');
  return (
    <svg viewBox="0 0 340 230" className="figure" role="img" aria-label="משולש ישר־זווית">
      <polygon points={[P0, P1, P2].map((p) => p.join(',')).join(' ')} className="fg-tri" />
      <polyline points={`${P0[0] + 14},${P0[1]} ${P0[0] + 14},${P0[1] - 14} ${P0[0]},${P0[1] - 14}`} className="fg-ray thin" />
      <text x={P0[0] - 12} y={(P0[1] + P2[1]) / 2 + 5} textAnchor="end" className={fig.a === '?' ? 'fg-side target' : 'fg-side'}>{t(fig.a)}</text>
      <text x={(P0[0] + P1[0]) / 2} y={P0[1] + 24} textAnchor="middle" className={fig.b === '?' ? 'fg-side target' : 'fg-side'}>{t(fig.b)}</text>
      <text x={(P1[0] + P2[0]) / 2 + 12} y={(P1[1] + P2[1]) / 2 - 8} className={fig.c === '?' ? 'fg-side target' : 'fg-side'}>{t(fig.c)}</text>
    </svg>
  );
}

function Ladder({ fig }) {
  const wall = typeof fig.wall === 'number' ? fig.wall : Math.sqrt(fig.len ** 2 - fig.foot ** 2);
  const s = Math.min(170 / wall, 150 / fig.foot);
  const base = [250, 200]; const top = [250, 200 - wall * s]; const foot = [250 - fig.foot * s, 200];
  const t = (v) => (typeof v === 'number' ? `${v}` : '?');
  return (
    <svg viewBox="0 0 340 230" className="figure" role="img" aria-label="סולם נשען על קיר">
      <rect x="250" y="16" width="14" height="184" className="fg-wall" />
      <line x1="30" y1="200" x2="300" y2="200" className="fg-ray" />
      <line x1={foot[0]} y1={foot[1]} x2={top[0]} y2={top[1]} className="fg-ladder" />
      <polyline points={`${base[0] - 14},${base[1]} ${base[0] - 14},${base[1] - 14} ${base[0]},${base[1] - 14}`} className="fg-ray thin" />
      <text x={(foot[0] + base[0]) / 2} y="222" textAnchor="middle" className="fg-side">{t(fig.foot)}</text>
      <text x="276" y={(base[1] + top[1]) / 2 + 5} className={fig.wall === '?' ? 'fg-side target' : 'fg-side'}>{t(fig.wall)}</text>
      <text x={(foot[0] + top[0]) / 2 - 14} y={(foot[1] + top[1]) / 2} textAnchor="end" className={fig.len === '?' ? 'fg-side target' : 'fg-side'}>{t(fig.len)}</text>
    </svg>
  );
}

// Numbers stay left-to-right inside the RTL table, with a real minus sign.
const cell = (v) => String(v).replace(/^-/, '\u2212');

function Table({ fig }) {
  return (
    <table className="fg-table">
      <thead><tr>{fig.head.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
      <tbody>{fig.rows.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j}><bdi dir="ltr">{cell(v)}</bdi></td>)}</tr>)}</tbody>
    </table>
  );
}

export default function Figure({ fig }) {
  if (!fig) return null;
  const C = { coord: Coord, linear: Linear, cross: Cross, parallel: Parallel, triangle: Triangle, right: RightTri, ladder: Ladder, table: Table }[fig.type];
  return C ? <div className="figure-wrap"><C fig={fig} /></div> : null;
}
