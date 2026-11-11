// Nets of solids (kind 'net', פריסה; stage 3, MEASURE-1.2). Four tasks:
//   fold   the Stepper קיפול turns every face about its hinge, a quarter at a time (and ←/→, Home/End on the drawing).
//          There is no drag on the drawing: the net fills most of a small screen, and a finger on it must still scroll
//          the page. Each step turns the faces in 300 ms, and at once under reduced motion.
//   face   tap a face, or Tab to it and press Enter (each face a button, "פאה C")
//   fix    put the loose face on a dashed slot: tap the slot, drag the face there, or Tab to the slot and press Enter
//   build  the Steppers אורך, רוחב, גובה (a box of unit cubes) or ניצב א׳, ניצב ב׳, אורך (a prism, its base shaded)
// The geometry (the faces, their hinges and the fold, the oblique view, the slots and which close the net) is in
// content/net.js, which also checks the value and puts it into words. In a check (`test`) a build's readout keeps only
// the sizes the student set, and nothing marks a right state.
import { useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { useReducedMotion } from 'motion/react';
import { Stepper, useTween } from './core.jsx';
import { manipCorrect, manipSolution } from '@/content/manip.js';
import {
  netModel, netView, foldFaces, obliqueDepth, oblique, VIEW_DIR, centroid, netStep, foldWords, faceName, slotWords, looseName,
  buildMeasures, buildWords, buildKeys, buildFixed, BUILD_MAX, OBLIQUE,
} from '@/content/net.js';

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const num = (v) => String(Math.round(v * 100) / 100);
const LIGHT = (() => { const l = [-0.3, 0.8, -0.5]; const n = Math.hypot(...l); return l.map((x) => x / n); })();
const VIEW = (() => { const n = Math.hypot(...VIEW_DIR); return VIEW_DIR.map((x) => x / n); })();
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** How a face is lit: its outer side toward the viewer in three tones (the top lightest), or its inside. */
export function toneOf(n) {
  if (dot(n, VIEW) >= -1e-9) return 'in';
  const lit = dot(n, LIGHT);
  return lit > 0.65 ? 'l1' : lit > 0.3 ? 'l2' : 'l3';
}

const SOLID_NAME = { cube: 'קובייה', box: 'תיבה', prism: 'מנסרה משולשת', cylinder: 'גליל' };
const pts2 = (v, ps) => ps.map((p) => `${v.X(p)},${v.Y(p)}`).join(' ');
const area2d = (P) => Math.abs(P.reduce((a, [x, y], i) => { const [u, w] = P[(i + 1) % P.length]; return a + x * w - u * y; }, 0)) / 2;
const perimeter = (P) => P.reduce((a, p, i) => { const q = P[(i + 1) % P.length]; return a + Math.hypot(q[0] - p[0], q[1] - p[1]); }, 0);

/** The faces at fold t, farthest first, each a polygon in its tone (a cylinder's slats with only their top and bottom edges). */
function Faces({ tree, t, v, shade, pick, picked, onPick, locked, hit, letters = true }) {
  const faces = foldFaces(tree, t).map((f) => ({ ...f, depth: obliqueDepth(centroid(f.p3)) })).sort((a, b) => b.depth - a.depth);
  return faces.map((f, i) => {
    const tone = toneOf(f.n);
    const poly = <polygon points={pts2(v, f.p3)} className={clsx('mp-net-face', tone, f.kind === 'slat' && 'slat', shade && f.id === shade && 'shade', picked && f.id === picked && 'picked', hit && f.id === hit && 'hit')} />;
    if (f.kind === 'slat') {
      const [a, b, c, d] = f.p3; const first = f.slat === 0; const last = f.slat === tree.filter((x) => x.kind === 'slat').length - 1;
      return (
        <g key={`s${f.slat}`}>
          {poly}
          <line x1={v.X(a)} y1={v.Y(a)} x2={v.X(b)} y2={v.Y(b)} className="mp-net-edge" />
          <line x1={v.X(c)} y1={v.Y(c)} x2={v.X(d)} y2={v.Y(d)} className="mp-net-edge" />
          {first && <line x1={v.X(a)} y1={v.Y(a)} x2={v.X(d)} y2={v.Y(d)} className="mp-net-edge" />}
          {last && <line x1={v.X(b)} y1={v.Y(b)} x2={v.X(c)} y2={v.Y(c)} className="mp-net-edge" />}
        </g>
      );
    }
    // a letter only where the face, as drawn, is wide enough to hold it (not on a face seen almost edge-on)
    const c = centroid(f.p3); const sc = f.p3.map((p) => [v.X(p), v.Y(p)]);
    const room = sc.length > 2 && (2 * area2d(sc)) / perimeter(sc) >= 11;
    const label = letters && f.kind !== 'disc' && tone !== 'in' && room && <text x={v.X(c)} y={v.Y(c) + 6} textAnchor="middle" className="mp-net-letter">{f.id}</text>;
    if (!onPick) return <g key={`${f.id}${i}`}>{poly}{label}</g>;
    const press = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(f.id); } };
    return (
      <g key={f.id} role="button" tabIndex={locked ? -1 : 0} aria-label={faceName(pick, f.id)} aria-pressed={picked === f.id}
        className="mp-net-pick" onClick={() => !locked && onPick(f.id)} onKeyDown={locked ? undefined : press}>
        {poly}{label}
      </g>
    );
  });
}

/** What the object says for a value: `text` (aria-valuetext or the drawing's name), `line` its readout, `more` a second line. */
export function netSaid(m, v, { test = false, answer } = {}) {
  switch (m.task) {
    case 'fold': { const w = foldWords(m, v.t ?? 0); return { text: w, line: w }; }
    case 'face': { const w = v.face ? `בחרתם ${faceName(m, v.face)}` : 'עוד לא בחרתם פאה'; return { text: w, line: w }; }
    case 'fix': { const w = v.slot ? `${looseName(m)} ${slotWords(m, v.slot)}` : `${looseName(m)} מחכה בצד`; return { text: w, line: w }; }
    case 'build': {
      const w = buildWords(m, v);
      if (test) return { text: w, line: w, two: true };
      const q = buildMeasures(m, v);
      const more = m.solid === 'prism' ? `שטח הבסיס ${num(q.base)} סמ״ר · נפח ${num(q.V)} סמ״ק`
        : answer?.d2 != null ? `אלכסון בריבוע ${q.d2}` : `נפח ${q.V} סמ״ק · שטח פנים ${q.S} סמ״ר`;
      return { text: `${w}, ${more.replace(/ · /g, ', ')}`, line: w, more, two: true };
    }
    default: return { text: '', line: '' };
  }
}

// ---------------------------------------------------------------- build: a box of unit cubes, a prism with its base shaded
const BW = 300; const BH = 220; const BPAD = 18; const FRAME = 5;
const CA = OBLIQUE.k * Math.cos((OBLIQUE.angle * Math.PI) / 180); const SA = OBLIQUE.k * Math.sin((OBLIQUE.angle * Math.PI) / 180);
/**
 * Where a build is drawn: fitted to a frame at least FRAME a side (the box itself once it is larger), the frame
 * centred and the solid standing in its front lower left corner, so the solid grows right, up and back as the student
 * adds to it, and the view widens only when a side passes FRAME.
 */
function buildView(sizes) {
  const [x, y, z] = sizes.map((n) => Math.max(FRAME, Math.min(BUILD_MAX, n)));
  const w = x + z * CA; const h = y + z * SA;
  const s = Math.min((BW - 2 * BPAD) / w, (BH - 2 * BPAD) / h);
  const ox = (BW - w * s) / 2; const oy = (BH + h * s) / 2;
  return { X: (p) => ox + oblique(p)[0] * s, Y: (p) => oy - oblique(p)[1] * s };
}
const line3 = (v, p, q, cls, key) => <line key={key} x1={v.X(p)} y1={v.Y(p)} x2={v.X(q)} y2={v.Y(q)} className={cls} />;
const poly3 = (v, ps, cls) => <polygon points={pts2(v, ps)} className={cls} />;
function BoxArt({ u, v, cls }) {
  const { a, b, c } = u; const lines = [];
  for (let i = 1; i < a; i += 1) lines.push(line3(v, [i, 0, 0], [i, c, 0], 'mp-net-unit', `fx${i}`), line3(v, [i, c, 0], [i, c, b], 'mp-net-unit', `tx${i}`));
  for (let j = 1; j < c; j += 1) lines.push(line3(v, [0, j, 0], [a, j, 0], 'mp-net-unit', `fy${j}`), line3(v, [a, j, 0], [a, j, b], 'mp-net-unit', `ry${j}`));
  for (let k = 1; k < b; k += 1) lines.push(line3(v, [0, c, k], [a, c, k], 'mp-net-unit', `tz${k}`), line3(v, [a, 0, k], [a, c, k], 'mp-net-unit', `rz${k}`));
  return (
    <g className={cls}>
      {poly3(v, [[a, 0, 0], [a, 0, b], [a, c, b], [a, c, 0]], 'mp-net-face l3')}
      {poly3(v, [[0, c, 0], [a, c, 0], [a, c, b], [0, c, b]], 'mp-net-face l1')}
      {poly3(v, [[0, 0, 0], [a, 0, 0], [a, c, 0], [0, c, 0]], 'mp-net-face l2')}
      {lines}
    </g>
  );
}
function PrismArt({ u, v, cls }) {
  const { p, q, L } = u;
  return (
    <g className={cls}>
      {line3(v, [0, 0, 0], [0, 0, L], 'mp-net-hidden', 'h1')}{line3(v, [0, 0, L], [p, 0, L], 'mp-net-hidden', 'h2')}{line3(v, [0, 0, L], [0, q, L], 'mp-net-hidden', 'h3')}
      {poly3(v, [[p, 0, 0], [p, 0, L], [0, q, L], [0, q, 0]], 'mp-net-face l1')}
      {poly3(v, [[0, 0, 0], [p, 0, 0], [0, q, 0]], 'mp-net-face mp-net-base')}
    </g>
  );
}

export default function NetFold({ m, value, onChange, locked, reveal, good, answer, hint, test = false }) {
  const v = value || m.start;
  const still = useReducedMotion();
  const emit = (n) => { if (!locked && !same(n, v)) onChange(n); };
  const step = (key, dir) => emit(netStep(m, v, key, dir, answer));
  const stuck = (key, dir) => same(netStep(m, v, key, dir, answer), v);
  const right = !test && !!answer && manipCorrect({ manip: m, answer }, v);
  const sol = reveal && answer ? manipSolution({ manip: m, answer }) : null;
  const said = netSaid(m, v, { test, answer });
  const nm = useMemo(() => (m.task === 'build' ? null : netModel(m)), [m]);
  const shownT = useTween(m.task === 'fold' ? v.t ?? 0 : 0, still);
  const ghostT = m.task === 'fold' && sol && sol.t !== (v.t ?? 0) ? sol.t : null;
  // a fold is fitted to the moment it shows (content/net.js netView); the other tasks to the open net
  const view = useMemo(() => (nm ? netView(m, nm, { t: shownT, also: ghostT }) : null), [m, nm, shownT, ghostT]);
  const svg = useRef(null);
  const [drag, setDrag] = useState(null); // fix: the loose face under a finger, { start: [x, y], at: [x, y], from }
  const name = `פריסה של ${SOLID_NAME[m.solid]}`;
  const hints = { fold: 'כל פאה מתקפלת סביב הקו שמחבר אותה לשכנה.', face: 'פאה נגדית לא נוגעת בפאה הצבועה, גם אחרי הקיפול.', fix: 'נסו מקום שבו הפאה תסגור את החור שנשאר.', build: m.solid === 'prism' ? 'שטח הבסיס כפול האורך.' : 'כל שכבה היא אורך כפול רוחב קוביות.' };

  let canvas = null; let controls = null;
  if (m.task === 'fold') {
    const keys = { ArrowLeft: () => step('t', -1), ArrowRight: () => step('t', 1), Home: () => emit({ t: 0 }), End: () => emit({ t: 1 }) };
    const onKeyDown = (e) => { const f = keys[e.key]; if (!f || locked) return; e.preventDefault(); e.stopPropagation(); f(); };
    canvas = (
      <svg viewBox={`0 0 ${view.W} ${view.H}`} className="manip-canvas mp-net-canvas" dir="ltr" tabIndex={locked ? -1 : 0}
        role="slider" aria-roledescription="פריסה" aria-label={name} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((v.t ?? 0) * 100)}
        aria-valuetext={said.text} onKeyDown={onKeyDown}>
        <Faces tree={nm.tree} t={shownT} v={view} shade={m.shade} />
        {ghostT != null && <g className="mp-net-ghost">{foldFaces(nm.tree, ghostT).map((f, i) => <polygon key={i} points={pts2(view, f.p3)} />)}</g>}
      </svg>
    );
    controls = (
      <Stepper label="קיפול" value={`${Math.round((v.t ?? 0) * 100)}%`} onDec={() => step('t', -1)} onInc={() => step('t', 1)}
        decLabel="לפתוח רבע" incLabel="לקפל עוד רבע" disabled={locked} decDisabled={stuck('t', -1)} incDisabled={stuck('t', 1)} />
    );
  } else if (m.task === 'face') {
    const hit = (right || good) && v.face;
    canvas = (
      <svg viewBox={`0 0 ${view.W} ${view.H}`} className="manip-canvas mp-net-canvas" dir="ltr" role="group" aria-label={`${name}${m.shade ? `, ${faceName(m, m.shade)} צבועה` : ''}`}>
        <Faces tree={nm.tree} t={0} v={view} shade={m.shade} pick={m} picked={v.face} hit={hit ? v.face : null} onPick={(face) => emit({ face })} locked={locked} />
        {sol && sol.face !== v.face && nm.tree.filter((f) => f.id === sol.face).map((f) => <polygon key="ghost" points={pts2(view, f.pts)} className="mp-net-ghost-face" />)}
      </svg>
    );
  } else if (m.task === 'fix') {
    const tray = view.tray; const lp = nm.loose.pts;
    const placed = nm.slots.find((x) => x.id === v.slot);
    const at = (dx, dy) => lp.map(([x, y]) => [x + dx, y + dy]);
    // where the loose face is drawn: on its slot, in the tray beside the net, or under the finger
    let loosePts = placed ? placed.pts : at(...tray);
    if (drag) { const d = [(drag.at[0] - drag.start[0]) / view.s, -(drag.at[1] - drag.start[1]) / view.s]; loosePts = drag.from.map(([x, y]) => [x + d[0], y + d[1]]); }
    const toSvg = (e) => { const g = svg.current?.getScreenCTM?.(); if (!g) return [0, 0]; const p = svg.current.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; const q = p.matrixTransform(g.inverse()); return [q.x, q.y]; };
    const down = (e) => {
      if (locked || (e.button != null && e.button > 0)) return;
      e.preventDefault(); try { svg.current?.setPointerCapture?.(e.pointerId); } catch { /* not supported */ }
      const p = toSvg(e); setDrag({ start: p, at: p, from: placed ? placed.pts : at(...tray) });
    };
    const move = (e) => { if (drag) setDrag({ ...drag, at: toSvg(e) }); };
    const up = () => {
      if (!drag) return;
      const moved = Math.hypot(drag.at[0] - drag.start[0], drag.at[1] - drag.start[1]);
      if (moved > 6) {
        // the slot nearest where the face was let go, if it is close enough; else back beside the net
        const c = centroid(loosePts); const size = Math.max(...lp.map((p) => Math.hypot(p[0] - centroid(lp)[0], p[1] - centroid(lp)[1])));
        const near = nm.slots.map((x) => ({ id: x.id, d: Math.hypot(centroid(x.pts)[0] - c[0], centroid(x.pts)[1] - c[1]) })).sort((a, b) => a.d - b.d)[0];
        emit({ slot: near && near.d < size ? near.id : null });
      }
      setDrag(null);
    };
    const press = (id) => (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); emit({ slot: id }); } };
    const R = 23; // a slot's target: at least 46 drawing units (44 px at 320) around its middle
    canvas = (
      <svg ref={svg} viewBox={`0 0 ${view.W} ${view.H}`} className="manip-canvas mp-net-canvas" dir="ltr" role="group" aria-label={`${name} ש${looseName(m).replace(/^ה/, '')} שלה בצד`}
        onPointerMove={move} onPointerUp={up} onPointerCancel={() => setDrag(null)}>
        <Faces tree={nm.tree} t={0} v={view} letters />
        {nm.slots.map((x) => {
          const c = centroid(x.pts); const on = v.slot === x.id;
          return (
            <g key={x.id} role="button" tabIndex={locked ? -1 : 0} aria-label={`לשים את ${looseName(m)} ${slotWords(m, x.id)}`} aria-pressed={on}
              className={clsx('mp-net-slot', on && 'on')} onClick={() => !locked && emit({ slot: x.id })} onKeyDown={locked ? undefined : press(x.id)}>
              <circle cx={view.X(c)} cy={view.Y(c)} r={R} className="mp-hit" />
              <polygon points={pts2(view, x.pts)} />
            </g>
          );
        })}
        {sol && sol.slot !== v.slot && nm.slots.filter((x) => x.id === sol.slot).map((x) => <polygon key="ghost" points={pts2(view, x.pts)} className="mp-net-ghost-face" />)}
        {(placed || drag) && <polygon points={pts2(view, at(...tray))} className="mp-net-tray" />}
        <g className={clsx('mp-net-loose', drag && 'dragging', right && 'hit')} onPointerDown={down}>
          <polygon points={pts2(view, loosePts)} className={clsx('mp-net-face', 'l1', right && 'hit')} />
          {m.solid !== 'cylinder' && <text x={view.X(centroid(loosePts))} y={view.Y(centroid(loosePts)) + 6} textAnchor="middle" className="mp-net-letter">{nm.loose.id}</text>}
        </g>
      </svg>
    );
  } else if (m.task === 'build') {
    const Art = m.solid === 'prism' ? PrismArt : BoxArt;
    const size = (u) => (m.solid === 'prism' ? [u.p, u.q, u.L] : [u.a, u.c, u.b]);
    const bv = buildView(size(v).map((n, i) => Math.max(n, sol ? size(sol)[i] : 0)));
    canvas = (
      <svg viewBox={`0 0 ${BW} ${BH}`} className="manip-canvas mp-net-canvas" dir="ltr" role="img" aria-label={said.text}>
        {sol && !same(sol, v) && <Art u={sol} v={bv} cls="mp-net-ghost-solid" />}
        <Art u={v} v={bv} cls={clsx('mp-net-solid', right && 'hit')} />
      </svg>
    );
    const NAMES = m.solid === 'prism' ? { p: 'ניצב א׳', q: 'ניצב ב׳', L: 'אורך' } : { a: 'אורך', b: 'רוחב', c: 'גובה' };
    controls = buildKeys(m).map((k) => (
      <Stepper key={k} label={NAMES[k]} value={v[k]} onDec={() => step(k, -1)} onInc={() => step(k, 1)} decLabel={`${NAMES[k]} קטן ב־1`} incLabel={`${NAMES[k]} גדול ב־1`}
        disabled={locked || buildFixed(m, answer, k)} decDisabled={stuck(k, -1)} incDisabled={stuck(k, 1)} />
    ));
  }

  return (
    <div className={clsx('manip', 'manip-net', `manip-net-${m.task}`, good && 'good')}>
      <div className={clsx('manip-readout', 'mp-net-readout', said.two && 'two')} aria-live="polite">
        <span>{said.line}</span>
        {said.more && <span>{said.more}</span>}
      </div>
      {hint && <p className="manip-hint-line">{hints[m.task]}</p>}
      {canvas}
      {controls && <div className="manip-controls mp-net-controls">{controls}</div>}
    </div>
  );
}

/** What מדי says about the net object (Manip.jsx): what the student just did, never whether it is right. */
export function netCoach(m, value, touched) {
  const v = value || m.start;
  switch (m.task) {
    case 'fold':
      if (!touched) return 'לחצו על "קיפול", רבע בכל פעם. שימו לב איזו פאה נפגשת עם איזו.';
      return v.t >= 1 ? `${foldWords(m, 1)}. כל צלע של הפריסה פוגשת צלע אחרת.` : v.t <= 0 ? 'הפריסה פתוחה על השולחן. כל הפאות במישור אחד.' : `${foldWords(m, v.t)}. איזו פאה תיפגש עם איזו?`;
    case 'face':
      if (!touched || !v.face) return 'הקישו על הפאה שתהיה מול הפאה הצבועה.';
      return `בחרתם ${faceName(m, v.face)}. דמיינו את הפריסה מתקפלת: איפה היא תהיה?`;
    case 'fix':
      if (!touched || !v.slot) return `גררו את ${looseName(m)} למקום מקווקו, או הקישו על המקום.`;
      return `${looseName(m)} ${slotWords(m, v.slot)}. דמיינו את הקיפול: האם הפריסה נסגרת?`;
    case 'build': {
      if (m.solid === 'prism') return !touched ? 'הבסיס הוא משולש ישר־זווית. כמה פעמים הוא חוזר לאורך המנסרה?' : `שטח הבסיס ${num((v.p * v.q) / 2)}, והוא חוזר ${v.L} פעמים לאורך המנסרה.`;
      if (!touched) return 'כל שכבה היא אורך כפול רוחב קוביות. כמה שכבות?';
      return `שכבה של ${v.a} על ${v.b} היא ${v.a * v.b} קוביות, ויש ${v.c === 1 ? 'שכבה אחת' : `${v.c} שכבות`}.`;
    }
    default: return null;
  }
}

