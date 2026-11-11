// The still figures of solids (MEASURE-1.5), drawn by components/Figure.jsx:
//   netfig { solid: 'cube' | 'box' | 'prism' | 'cylinder', dims, layout?, letters?, shade?, labels? }
//          a net, flat, with the same geometry as the net object (content/net.js): letters writes the face names (A–F,
//          a prism's A–E), shade colours a face (or a list of faces), labels: true writes each length once on its edge
//          (a cylinder's radius on its top disc and 2πr under its side), labels: 'area' each face's area in its middle.
// Their words (figWords, the drawing's aria-label) are content/net.js's and read every number drawn.
import clsx from 'clsx';
import { figWords } from '@/content/manip.js';
import { netModel, netView, netfigMarks, centroid } from '@/content/net.js';

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
