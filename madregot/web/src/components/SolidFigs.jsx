// The still figures of solids (MEASURE-1.5), drawn by components/Figure.jsx:
//   netfig { solid: 'cube' | 'box' | 'prism' | 'cylinder', dims, layout?, letters?, shade?, labels? }
//          a net, flat, with the same geometry as the net object (content/net.js): letters writes the face names (A–F,
//          a prism's A–E), shade colours a face (or a list of faces), labels: true writes each length once on its edge
//          (a cylinder's radius on its top disc and 2πr under its side), labels: 'area' each face's area in its middle.
//   solid  { shape: 'box' | 'cube' | 'prism' | 'cylinder' | 'cone', a?, b?, c?, p?, q?, r?, L?, h?, l?, labels?, diag?,
//          cubes?, cut?, open?, label? }   a solid, still: a box, a cube or a prism in the oblique view (depth at 30°, half
//          its length, content/net.js oblique), hidden edges dashed; a cylinder or a cone on ellipses a third as high as
//          wide; diag 'face' | 'space' | 'tri' | 'axial' | 'rod' (or a list), cubes, cut 'diagonal' | 'half', open, label
//          (content/net.js solidWords has the details)
// Their words (figWords, the drawing's aria-label) are content/net.js's and read every number drawn.
import clsx from 'clsx';
import { figWords } from '@/content/manip.js';
import { netModel, netView, netfigMarks, centroid, oblique, bounds, VIEW_DIR, solidLabels, prismBase } from '@/content/net.js';

const pts2 = (v, ps) => ps.map((p) => `${v.X(p)},${v.Y(p)}`).join(' ');
const LABEL_OFF = 13; // drawing units between an edge and its label

/** A net, flat: its faces, the shaded ones, the letters, and the lengths or areas. */
export function NetFig({ fig }) {
  const m = { solid: fig.solid, dims: fig.dims, layout: fig.layout, task: 'face' };
  const nm = netModel(m);
  const v = netView(m, nm, { W: 300, H: 230, pad: 26, fit: true });
  const marks = netfigMarks(fig); const shade = [].concat(fig.shade || []);
  const slats = nm.tree.filter((f) => f.kind === 'slat').sort((a, b) => a.slat - b.slat);
  const flat = slats.length
    ? [{ id: 'side', pts: [slats[0].pts[0], slats[slats.length - 1].pts[1], slats[slats.length - 1].pts[2], slats[0].pts[3]] }, ...nm.tree.filter((f) => f.kind !== 'slat')]
    : nm.tree;
  const areaAt = Object.fromEntries(marks.faces.map((x) => [x.id, x]));
  return (
    <svg viewBox={`0 0 ${v.W} ${v.H}`} className="figure fg-net" role="img" aria-label={figWords(fig)}>
      {flat.map((f) => <polygon key={f.id} points={pts2(v, f.pts)} className={clsx('fg-net-face', shade.includes(f.id) && 'shade')} />)}
      {flat.map((f) => {
        if (!(fig.letters && fig.solid !== 'cylinder') && !areaAt[f.id]) return null;
        // a letter and an area: one above the other on a tall face, side by side on a short one
        const c = centroid(f.pts); const tall = v.s * (Math.max(...f.pts.map((p) => p[1])) - Math.min(...f.pts.map((p) => p[1]))) >= 56;
        const letter = fig.letters && fig.solid !== 'cylinder'; const area = areaAt[f.id];
        const lx = letter && area && !tall ? -13 : 0; const ly = letter && area && tall ? -10 : 0;
        return (
          <g key={`l${f.id}`}>
            {letter && <text x={v.X(c) + lx} y={v.Y(c) + 6 + ly} textAnchor="middle" className="fg-net-letter">{f.id}</text>}
            {area && <text x={v.X(c) - lx} y={v.Y(c) + 6 - ly} textAnchor="middle" className="fg-side">{area.text}</text>}
          </g>
        );
      })}
      {marks.edges.map((e) => {
        const off = LABEL_OFF + (Math.abs(e.out[0]) > 0.5 ? 6 : 0);
        return <text key={`e${e.key}`} x={v.X(e.at) + e.out[0] * off} y={v.Y(e.at) - e.out[1] * off + 6} textAnchor="middle" className="fg-side">{e.text}</text>;
      })}
      {marks.radius && (() => {
        const { c, r, text } = marks.radius; const end = [c[0] + r, c[1]];
        return (
          <g>
            <line x1={v.X(c)} y1={v.Y(c)} x2={v.X(end)} y2={v.Y(end)} className="fg-radius" />
            <circle cx={v.X(c)} cy={v.Y(c)} r="3" className="fg-vertex" />
            <text x={(v.X(c) + v.X(end)) / 2} y={v.Y(c) - 8} textAnchor="middle" className="fg-side">{text}</text>
          </g>
        );
      })()}
      {marks.width && <text x={v.X(marks.width.at)} y={v.Y(marks.width.at) - 9} textAnchor="middle" className="fg-side fg-math">{marks.width.text}</text>}
    </svg>
  );
}

// ---------------------------------------------------------------- the solid, still (stage 4)
// A box, a cube or a prism is drawn in the oblique view of the net object (content/net.js oblique): its faces turned to
// the viewer lightly filled, its hidden edges dashed. A cylinder and a cone stand on an ellipse whose height is a third
// of its width, the back half of the base dashed. The texts written are content/net.js solidLabels, the words solidWords.
const SOLID_PAD = 30;
const TONE = { face: 'fg-solid-diag face', space: 'fg-solid-diag space', edge: 'fg-solid-diag edge' };
const pts3 = (v, ps) => ps.map((p) => `${v.X(p)},${v.Y(p)}`).join(' ');
/** One scale and place for points given as [x, y] (or [x, y, z], drawn oblique), fitted into W by up to H. */
function fitView(points, { W = 300, H = 220, pad = SOLID_PAD, below = 0 } = {}) {
  const flat = points.map((p) => (p.length === 3 ? oblique(p) : p));
  const b = bounds(flat); const bw = Math.max(b.x1 - b.x0, 1e-9); const bh = Math.max(b.y1 - b.y0, 1e-9);
  const s = Math.min((W - 2 * pad) / bw, (H - 2 * pad - below) / bh);
  const h = Math.ceil(bh * s + 2 * pad + below);
  const ox = (W - bw * s) / 2 - b.x0 * s; const oy = pad + bh * s + b.y0 * s;
  const at = (p) => (p.length === 3 ? oblique(p) : p);
  return { W, H: h, s, X: (p) => ox + at(p)[0] * s, Y: (p) => oy - at(p)[1] * s };
}
/** A label beside a point of the drawing, pushed (dx, dy) screen units away. */
const Lab = ({ v, at, dx = 0, dy = 0, text, anchor = 'middle' }) => (text == null ? null : <text x={v.X(at) + dx} y={v.Y(at) + dy + 6} textAnchor={anchor} className="fg-side">{text}</text>);
/** A small right-angle mark at corner P between the directions u and w (unit vectors in space or the plane). */
function RightMark({ v, P, u, w, k }) {
  const q = (a, b) => P.map((x, i) => x + (a * u[i] + b * w[i]) * k);
  return <polyline points={pts3(v, [q(1, 0), q(1, 1), q(0, 1)])} className="fg-ray thin" />;
}

/** A box, a cube or a prism: its faces (outward), the visible ones filled, the hidden edges dashed. */
function Polyhedron({ fig, L }) {
  const diags = [].concat(fig.diag || []);
  let V; let faces; let tri = null;
  if (fig.shape === 'prism') {
    const t = prismBase(fig); const len = fig.L;
    V = [...t.map(([x, y]) => [x, y, 0]), ...t.map(([x, y]) => [x, y, len])];
    faces = [[0, 2, 1], [3, 4, 5], [0, 1, 4, 3], [1, 2, 5, 4], [2, 0, 3, 5]];
    tri = t;
  } else {
    const a = fig.a; const b = fig.shape === 'cube' ? fig.a : fig.b; const c = fig.shape === 'cube' ? fig.a : fig.c;
    V = [[0, 0, 0], [a, 0, 0], [a, c, 0], [0, c, 0], [0, 0, b], [a, 0, b], [a, c, b], [0, c, b]];
    // front, back, bottom, top, left, right, each wound with its outer side toward the viewer of that side
    faces = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [3, 7, 6, 2], [0, 4, 7, 3], [1, 2, 6, 5]];
  }
  const normal = (f) => { const [p, q, r] = f.map((i) => V[i]); const u = [q[0] - p[0], q[1] - p[1], q[2] - p[2]]; const w = [r[0] - p[0], r[1] - p[1], r[2] - p[2]]; return [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]; };
  const seen = (f) => { const n = normal(f); return n[0] * VIEW_DIR[0] + n[1] * VIEW_DIR[1] + n[2] * VIEW_DIR[2] < 0; };
  const open = fig.open && fig.shape !== 'prism';
  const shown = faces.filter((f, i) => seen(f) && !(open && i === 3));
  const edges = []; faces.forEach((f) => f.forEach((p, k) => { const q = f[(k + 1) % f.length]; if (!edges.some(([x, y]) => (x === p && y === q) || (x === q && y === p))) edges.push([p, q]); }));
  const visible = ([p, q]) => shown.some((f) => f.includes(p) && f.includes(q)) || (open && faces[3].includes(p) && faces[3].includes(q));
  const below = fig.label ? 22 : 0;
  const v = fitView(V, { below });
  const box = fig.shape !== 'prism' && { a: V[1][0], b: V[4][2], c: V[3][1] };
  const units = fig.cubes && box && [box.a, box.b, box.c].every((x) => Number.isInteger(x) && x <= 12) ? (() => {
    const { a, b, c } = box; const out = [];
    for (let i = 1; i < a; i += 1) out.push([[i, 0, 0], [i, c, 0]], [[i, c, 0], [i, c, b]]);
    for (let j = 1; j < c; j += 1) out.push([[0, j, 0], [a, j, 0]], [[a, j, 0], [a, j, b]]);
    for (let k = 1; k < b; k += 1) out.push([[0, c, k], [a, c, k]], [[a, 0, k], [a, c, k]]);
    return out;
  })() : [];
  const line = (p, q, cls, key) => <line key={key} x1={v.X(p)} y1={v.Y(p)} x2={v.X(q)} y2={v.Y(q)} className={cls} />;
  const mid = (p, q) => p.map((x, i) => (x + q[i]) / 2);
  return (
    <svg viewBox={`0 0 ${v.W} ${v.H}`} className="figure fg-solid" role="img" aria-label={figWords(fig)}>
      {open && <polygon points={pts3(v, faces[1].map((i) => V[i]))} className="fg-solid-inside" />}
      {shown.map((f, i) => <polygon key={`f${i}`} points={pts3(v, f.map((k) => V[k]))} className="fg-solid-face" />)}
      {units.map(([p, q], i) => line(p, q, 'fg-solid-unit', `u${i}`))}
      {edges.filter((e) => !visible(e)).map(([p, q], i) => line(V[p], V[q], 'fg-solid-hidden', `h${i}`))}
      {box && fig.cut === 'half' && <polygon points={pts3(v, [[box.a / 2, 0, 0], [box.a / 2, box.c, 0], [box.a / 2, box.c, box.b], [box.a / 2, 0, box.b]])} className="fg-solid-cut" />}
      {box && fig.cut === 'diagonal' && <polygon points={pts3(v, [V[0], V[5], V[6], V[3]])} className="fg-solid-cut" />}
      {box && diags.includes('tri') && <polygon points={pts3(v, [V[0], V[5], V[6]])} className="fg-solid-tri" />}
      {box && (diags.includes('face') || diags.includes('tri')) && line(V[0], V[5], TONE.face, 'df')}
      {box && diags.includes('tri') && line(V[5], V[6], TONE.edge, 'de')}
      {box && (diags.includes('space') || diags.includes('tri')) && line(V[0], V[6], TONE.space, 'ds')}
      {box && diags.includes('tri') && (() => { const d = Math.hypot(box.a, box.b); return <RightMark v={v} P={V[5]} u={[-box.a / d, 0, -box.b / d]} w={[0, 1, 0]} k={Math.min(box.a, box.b, box.c) * 0.18} />; })()}
      {edges.filter(visible).map(([p, q], i) => line(V[p], V[q], 'fg-solid-edge', `e${i}`))}
      {tri && fig.h != null && !fig.r && (() => { const C = [tri[2][0], tri[2][1], 0]; const F = [tri[2][0], 0, 0]; return <>{line(C, F, 'fg-solid-hidden', 'ht')}<RightMark v={v} P={F} u={[1, 0, 0]} w={[0, 1, 0]} k={fig.h * 0.16} /></>; })()}
      {/* a right angle at the base's left corner (legs p and q, or three sides that make one) is marked */}
      {tri && fig.h == null && Math.abs(tri[2][0]) < 1e-9 && <RightMark v={v} P={[0, 0, 0]} u={[1, 0, 0]} w={[0, 1, 0]} k={Math.min(fig.p, tri[2][1]) * 0.16} />}
      {box && <>
        <Lab v={v} at={mid(V[0], V[1])} dy={16} text={L.a} />
        {fig.shape === 'box' && <Lab v={v} at={mid(V[1], V[5])} dx={14} dy={10} text={L.b} anchor="start" />}
        {fig.shape === 'box' && <Lab v={v} at={mid(V[0], V[3])} dx={-10} text={L.c} anchor="end" />}
      </>}
      {tri && <>
        <Lab v={v} at={mid(V[0], V[1])} dy={16} text={L.p} />
        <Lab v={v} at={mid(V[0], V[2])} dx={-10} text={L.q} anchor="end" />
        {/* the third side's length inside the triangle, beside its middle (outside it lies on the slanted face) */}
        <Lab v={v} at={mid(V[1], V[2]).map((x, i) => x + ((V[0][i] + V[1][i] + V[2][i]) / 3 - mid(V[1], V[2])[i]) * 0.45)} text={L.r} />
        {L.h != null && <Lab v={v} at={[tri[2][0], tri[2][1] / 2, 0]} dx={6} text={L.h} anchor="start" />}
        <Lab v={v} at={mid(V[1], V[4])} dx={14} dy={10} text={L.L} anchor="start" />
      </>}
      {fig.label && <text x={v.W / 2} y={v.H - 10} textAnchor="middle" className="fg-word" direction="rtl">{fig.label}</text>}
    </svg>
  );
}

/** A cylinder or a cone, standing: ellipses a third as high as wide, the back half of the base dashed. */
function Round({ fig, L }) {
  const { r, h } = fig; const ry = r / 3; const cone = fig.shape === 'cone';
  const below = fig.label ? 22 : 0;
  const v = fitView([[-r, -ry], [r, h + (cone ? 0 : ry)], [r, -ry], [-r, h]], { below, pad: 34 });
  const sx = v.s; const E = (y) => [v.X([0, y]), v.Y([0, y])];
  const [bx, by] = E(0); const [tx, ty] = E(h);
  const half = (cy, front) => `M ${bx - r * sx} ${cy} A ${r * sx} ${ry * sx} 0 0 ${front ? 0 : 1} ${bx + r * sx} ${cy}`;
  const diags = [].concat(fig.diag || []);
  const P = (x, y) => [v.X([x, y]), v.Y([x, y])];
  const seg = (a, b, cls, key) => <line key={key} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} className={cls} />;
  return (
    <svg viewBox={`0 0 ${v.W} ${v.H}`} className="figure fg-solid" role="img" aria-label={figWords(fig)}>
      {cone
        ? <path d={`M ${bx - r * sx} ${by} A ${r * sx} ${ry * sx} 0 0 0 ${bx + r * sx} ${by} L ${tx} ${ty} Z`} className="fg-solid-face" />
        : <path d={`M ${bx - r * sx} ${by} A ${r * sx} ${ry * sx} 0 0 0 ${bx + r * sx} ${by} L ${bx + r * sx} ${ty} A ${r * sx} ${ry * sx} 0 0 1 ${bx - r * sx} ${ty} Z`} className="fg-solid-face" />}
      {diags.includes('axial') && (cone
        ? <polygon points={`${P(-r, 0)} ${P(r, 0)} ${P(0, h)}`} className="fg-solid-tri" />
        : <polygon points={`${P(-r, 0)} ${P(r, 0)} ${P(r, h)} ${P(-r, h)}`} className="fg-solid-tri" />)}
      {diags.includes('rod') && !cone && <><polygon points={`${P(-r, 0)} ${P(r, 0)} ${P(r, h)} ${P(-r, h)}`} className="fg-solid-axial" />{seg(P(-r, 0), P(r, h), TONE.space, 'rod')}</>}
      <path d={half(by, false)} className="fg-solid-hidden" fill="none" />
      <path d={half(by, true)} className="fg-solid-edge" fill="none" />
      {!cone && <ellipse cx={tx} cy={ty} rx={r * sx} ry={ry * sx} className="fg-solid-edge top" />}
      {cone
        ? <>{seg(P(-r, 0), P(0, h), 'fg-solid-edge', 'l1')}{seg(P(r, 0), P(0, h), 'fg-solid-edge', 'l2')}{seg(P(0, h), P(0, 0), 'fg-solid-hidden', 'hh')}<circle cx={tx} cy={ty} r="3" className="fg-vertex" /></>
        : <>{seg(P(-r, 0), P(-r, h), 'fg-solid-edge', 's1')}{seg(P(r, 0), P(r, h), 'fg-solid-edge', 's2')}</>}
      {/* the radius: on the top for a cylinder, on the base for a cone */}
      {cone ? seg(P(0, 0), P(r, 0), 'fg-radius', 'rad') : seg(P(0, h), P(r, h), 'fg-radius', 'rad')}
      <circle cx={cone ? bx : tx} cy={cone ? by : ty} r="3" className="fg-vertex" />
      {cone && <RightMark v={v} P={[0, 0]} u={[1, 0]} w={[0, 1]} k={Math.min(r, h) * 0.14} />}
      {/* a cone's radius under its line, a cylinder's above its top ellipse (clear of the rim) */}
      <Lab v={v} at={[r / 2, cone ? 0 : h]} dy={cone ? 14 : -(ry * sx) - 10} text={L.r} />
      <Lab v={v} at={cone ? [0, h * 0.45] : [r, h / 2]} dx={cone ? -8 : 10} text={L.h} anchor={cone ? 'end' : 'start'} />
      {cone && <Lab v={v} at={[r / 2, h / 2]} dx={12} text={L.l} anchor="start" />}
      {fig.label && <text x={v.W / 2} y={v.H - 10} textAnchor="middle" className="fg-word" direction="rtl">{fig.label}</text>}
    </svg>
  );
}

/** The solid figure: a box, a cube, a prism, a cylinder or a cone. */
export function SolidFig({ fig }) {
  const L = solidLabels(fig);
  return fig.shape === 'cylinder' || fig.shape === 'cone' ? <Round fig={fig} L={L} /> : <Polyhedron fig={fig} L={L} />;
}
