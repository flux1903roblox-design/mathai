// The protractor (FUNC-1.2, FUNC-1.3b): one drawing for the angle object's two protractor modes (AngleTurner.jsx) and
// the still figure (Figure.jsx Protractor). A half disc of radius 128 in a box 300 wide, ticks every 5° and longer every
// 10°, and two scales laid out as on the class's plastic protractor: the scale that starts on the right (its 0 at the
// right end of the baseline) is the inner ring of numbers, in the brand blue; the scale that starts on the left is the
// outer ring, in orange. Each scale's 0 has a dot of its colour at its end of the baseline, so "read the scale whose 0 is
// on the arm" is also "follow the colour". The text names a scale only by the side its 0 is on.
// The numbers are sized in the pixels a phone draws them at, not in drawing units: outer 11px, inner 10px, from the
// width the drawing is shown at (288px on a 320px phone). Below 360px the inner ring is numbered every 20°; both 0s and
// the numbers at each arm are always drawn (an arm between two tens keeps both tens). `base` turns the whole drawing; the
// numbers stay upright.
import { useEffect, useState } from 'react';

export const PROT = { W: 300, R: 128, tick5: 5, tick10: 9, strip: 10 };
/** The numbers' sizes in rendered pixels. */
export const PROT_PX = { outer: 11, inner: 10 };
const rad = (d) => (d * Math.PI) / 180;
const DIGIT = 0.57; const CAP = 0.78; // a digit's width and height in Rubik, as parts of the size


/** One number of a scale at direction phi (0..180 on the protractor): where it sits around the centre, its size and box. */
function labelAt(scale, phi, base, k) {
  const outer = scale === 'left';
  const text = String(outer ? 180 - phi : phi);
  const px = outer ? PROT_PX.outer : PROT_PX.inner;
  const size = px / k; // drawing units
  const w = text.length * DIGIT * size; const h = CAP * size;
  // the ring: just outside the rim for the outer scale, inside the ticks for the inner one; far enough that the number's
  // box clears them in its direction (upright text has its half width across a ray near the baseline, its half height up)
  const t = rad(phi + base);
  const support = (Math.abs(Math.cos(t)) * w) / 2 + (Math.abs(Math.sin(t)) * h) / 2;
  const r = outer ? PROT.R + 1.5 + support : PROT.R - PROT.tick10 - 2.5 - support;
  // on the protractor (unturned), an inner number at an end of the baseline stands above it (an outer one is past the
  // baseline's end already), then the drawing is turned
  const px0 = r * Math.cos(rad(phi)); const py0 = outer ? -r * Math.sin(rad(phi)) : Math.min(-r * Math.sin(rad(phi)), -h / 2 - 1.5);
  const c = Math.cos(rad(base)); const s = Math.sin(rad(base));
  let x = px0 * c + py0 * s; const y = -px0 * s + py0 * c;
  // never past the sides of the box
  x = Math.max(-PROT.W / 2 + 0.5 + w / 2, Math.min(PROT.W / 2 - 0.5 - w / 2, x));
  return { scale, phi, text, px, size, x, y, w, h, box: [(x - w / 2) * k, (y - h / 2) * k, (x + w / 2) * k, (y + h / 2) * k] };
}
const apart = (a, b, gap = 1) => a[2] + gap <= b[0] || b[2] + gap <= a[0] || a[3] + gap <= b[1] || b[3] + gap <= a[1];

/**
 * The numbers drawn on a protractor shown `drawn` px wide, turned by `base`, with arms at the directions `arms` (0..180):
 * first both 0s and the numbers at each arm, then the outer scale every 10° and the inner every 10° (every 20° below
 * 360px), each left out where it would touch one already placed. An arm on a ten has that ten on both scales; an arm
 * between two tens (65) has both of them on each scale where they fit, and always at least one (the second when the
 * first would touch another number). x, y are drawing units from the centre; box is in px.
 */
export function protractorLabels({ drawn = 288, base = 0, arms = [] } = {}) {
  const k = drawn / PROT.W; const step = drawn >= 360 ? 10 : 20;
  const want = [{ scale: 'right', phi: 0, must: true }, { scale: 'left', phi: 180, must: true }];
  arms.filter((a) => a >= -1e-9 && a <= 180 + 1e-9).forEach((a) => {
    const lo = Math.floor(a / 10 + 1e-9) * 10; const hi = Math.ceil(a / 10 - 1e-9) * 10;
    for (const scale of ['right', 'left']) {
      if (lo === hi) want.push({ scale, phi: lo, must: true });
      else want.push({ scale, phi: lo, near: true }, { scale, phi: hi, near: true, pair: `${scale}:${lo}` });
    }
  });
  for (let p = 0; p <= 180; p += 10) want.push({ scale: 'left', phi: p });
  for (let p = 0; p <= 180; p += step) want.push({ scale: 'right', phi: p });
  // the numbers that must be there first, then the tens around the arms, then the rest of the scales
  const rank = (c) => (c.must ? 0 : c.near ? 1 : 2);
  want.sort((a, b) => rank(a) - rank(b));
  const placed = []; const seen = new Set();
  for (const c of want) {
    const key = `${c.scale}:${c.phi}`;
    if (seen.has(key)) continue;
    const L = labelAt(c.scale, c.phi, base, k);
    const fits = placed.every((q) => apart(q.box, L.box));
    // a number that must be there is placed anyway; the second ten of an arm's pair when the first one could not be
    if (!fits && !c.must && !(c.pair && !seen.has(c.pair))) continue;
    seen.add(key); placed.push({ ...L, forced: !!(c.must || c.near) });
  }
  return placed;
}

/** A point at distance r in direction d (degrees counterclockwise from the right) from the centre O, screen y down. */
export const polar = (O, d, r) => [O[0] + r * Math.cos(rad(d)), O[1] - r * Math.sin(rad(d))];

/** How far the drawing reaches above and below its centre, for a protractor turned by base, with these numbers. */
export function protExtent(base, labels) {
  const ys = [];
  for (let d = 0; d <= 180; d += 5) ys.push(-PROT.R * Math.sin(rad(d + base)));
  [[-PROT.R, PROT.strip], [PROT.R, PROT.strip]].forEach(([px, py]) => { const c = Math.cos(rad(base)); const s = Math.sin(rad(base)); ys.push(-px * s + py * c); });
  labels.forEach((L) => ys.push(L.y - L.h / 2, L.y + L.h / 2));
  return [Math.min(...ys), Math.max(...ys)];
}

/** The width an element is drawn at, measured once it is on the page (288 before: the narrowest phone). */
export function useDrawnWidth(ref, fallback = 288) {
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([e]) => { const v = Math.round(e.contentRect.width); if (v > 0) setW(v); });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

/**
 * The protractor itself, centred at O and turned by base: the plastic, its baseline and centre mark, the ticks, both
 * scales' numbers (labels from protractorLabels) and the dot at each scale's 0. `cls` is the class prefix ('mp-prot' or
 * 'fig-prot'); `zero` draws the baseline as the line to put on an arm (the align mode's hint); children are drawn over the
 * plastic and under the numbers (the arms, which the numbers' halo keeps readable over).
 */
export function ProtractorArt({ O, base = 0, labels, cls, zero = false, children }) {
  const { R, tick5, tick10, strip } = PROT;
  const turn = `rotate(${-base} ${O[0]} ${O[1]})`;
  const ticks = [];
  for (let d = 0; d <= 180; d += 5) {
    const long = d % 10 === 0; const [x1, y1] = polar(O, d, R); const [x2, y2] = polar(O, d, R - (long ? tick10 : tick5));
    ticks.push(<line key={d} x1={x1} y1={y1} x2={x2} y2={y2} className={long ? `${cls}-tick long` : `${cls}-tick`} />);
  }
  return (
    <g className={`${cls}-body`}>
      <g transform={turn}>
        <path d={`M ${O[0] - R} ${O[1]} A ${R} ${R} 0 0 1 ${O[0] + R} ${O[1]} V ${O[1] + strip} H ${O[0] - R} Z`} className={`${cls}-plastic`} />
        {ticks}
        <line x1={O[0] - R} x2={O[0] + R} y1={O[1]} y2={O[1]} className={zero ? `${cls}-base zero` : `${cls}-base`} />
        <path d={`M ${O[0]} ${O[1] - 7} V ${O[1] + strip - 2} M ${O[0] - 6} ${O[1]} H ${O[0] + 6}`} className={`${cls}-centre`} />
        {/* each scale's 0 is at its own end of the baseline: the dot in its colour */}
        <circle cx={O[0] + R} cy={O[1]} r="4.5" className={`${cls}-zero right`} />
        <circle cx={O[0] - R} cy={O[1]} r="4.5" className={`${cls}-zero left`} />
      </g>
      {children}
      {labels.map((L) => (
        <text key={`${L.scale}${L.phi}`} x={(O[0] + L.x).toFixed(2)} y={(O[1] + L.y + 0.36 * L.size).toFixed(2)} textAnchor="middle" fontSize={L.size.toFixed(2)} className={`${cls}-num ${L.scale}`}>{L.text}</text>
      ))}
    </g>
  );
}
