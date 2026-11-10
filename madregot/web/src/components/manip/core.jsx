// Shared parts of the interactive maths objects: pointer dragging on an SVG, keyboard steps, step buttons.
import { useRef } from 'react';
import { Minus, Plus } from 'lucide-react';

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** A pointer event in the SVG's own coordinates (its viewBox units). */
export function svgPoint(svg, e) {
  const m = svg?.getScreenCTM?.();
  if (!m) return { x: 0, y: 0 };
  const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
  return p.matrixTransform(m.inverse());
}

/**
 * Tap or drag on an SVG. `onPoint(point, phase)` gets SVG coordinates for 'start', 'move' and 'end'.
 * The pointer is captured, so a drag keeps working outside the drawing; nothing happens while disabled.
 */
export function useDrag(onPoint, disabled) {
  const ref = useRef(null);
  const on = useRef(false);
  const at = (e) => svgPoint(ref.current, e);
  return [ref, {
    onPointerDown: (e) => {
      if (disabled || (e.button != null && e.button > 0)) return;
      e.preventDefault();
      try { ref.current?.setPointerCapture?.(e.pointerId); } catch { /* not supported */ }
      on.current = true; onPoint(at(e), 'start');
    },
    onPointerMove: (e) => { if (on.current && !disabled) onPoint(at(e), 'move'); },
    onPointerUp: (e) => { if (!on.current) return; on.current = false; onPoint(at(e), 'end'); },
    onPointerCancel: () => { on.current = false; },
  }];
}

/** Arrow keys on a focused drawing: calls the matching handler and stops the page from scrolling. */
export function arrowKeys(map) {
  return (e) => {
    const f = { ArrowLeft: map.left, ArrowRight: map.right, ArrowUp: map.up, ArrowDown: map.down, Home: map.home, End: map.end }[e.key];
    if (!f) return;
    e.preventDefault(); e.stopPropagation(); f();
  };
}

/**
 * A pair of step buttons around a label: the way to move the object without dragging. `sub` is a longer
 * name shown beside the label where there is room ("חיתוך" for b); `icons` replaces the minus and plus.
 */
export function Stepper({ label, sub, value, onDec, onInc, decLabel, incLabel, disabled, decDisabled, incDisabled, icons, className }) {
  const [Dec, Inc] = icons || [Minus, Plus];
  return (
    <div className={className ? `stepper ${className}` : 'stepper'} role="group" aria-label={sub ? `${sub} ${label}` : label} dir="ltr">
      <button type="button" className="step-btn" onClick={onDec} disabled={disabled || decDisabled} aria-label={decLabel}><Dec size={20} strokeWidth={3} aria-hidden="true" /></button>
      <span className="step-label" dir="rtl" aria-hidden="true">
        <span className="step-name">{sub && <span className="step-sub">{sub} </span>}<span dir="auto">{label}</span></span>
        {value != null && <b dir="ltr">{value}</b>}
      </span>
      <button type="button" className="step-btn" onClick={onInc} disabled={disabled || incDisabled} aria-label={incLabel}><Inc size={20} strokeWidth={3} aria-hidden="true" /></button>
    </div>
  );
}

/** Numbers drawn in SVG text keep a real minus sign. */
export const minus = (v) => (v < 0 ? `−${-v}` : `${v}`);

// ---------------------------------------------------------------- numbers and fractions drawn in SVG
const FRAC_TEX = /^([-−])?\\[dt]?frac\{(\d+)\}\{(\d+)\}$/;
const HEB = /[֐-׿]/;
/** A label as plain text: \frac{3}{4} is 3/4, −2 keeps its real minus. */
export const labelText = (s) => String(s ?? '').replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, '$1/$2').replace(/\\%/g, '%').replace(/\{,\}/g, ',').replace(/^-/, '−');

/**
 * A short label drawn in SVG at (x, y), y being its middle: a fraction (\frac{3}{4}, or a value with `den`) is stacked,
 * numerator over a bar over denominator, as in a textbook; one capital letter is a point's name (italic); a Hebrew
 * word reads right to left; anything else is plain text. SVG text cannot hold TeX, so this is the one way the drawings
 * write a fraction.
 */
export function SvgLabel({ x, y, text, className = 'mp-num', anchor = 'middle', size = 'md' }) {
  const s = String(text ?? '');
  const f = s.match(FRAC_TEX);
  if (f) {
    const [, sign, n, d] = f; const w = Math.max(n.length, d.length) * (size === 'sm' ? 7.5 : 9) + 6;
    const dx = anchor === 'start' ? w / 2 + (sign ? 10 : 0) : anchor === 'end' ? -w / 2 : (sign ? 5 : 0);
    const cx = x + dx; const g = size === 'sm' ? 8 : 10;
    return (
      <g className={`svg-frac ${className}`} aria-hidden="true">
        {sign && <text x={cx - w / 2 - 3} y={y + 5} textAnchor="end" className={className}>−</text>}
        <text x={cx} y={y - 3} textAnchor="middle" className={className}>{n}</text>
        <line x1={cx - w / 2} x2={cx + w / 2} y1={y + 1} y2={y + 1} className="svg-frac-bar" />
        <text x={cx} y={y + g + 6} textAnchor="middle" className={className}>{d}</text>
      </g>
    );
  }
  const letter = /^[A-Z]$/.test(s);
  return (
    <text x={x} y={y + 5} textAnchor={anchor} className={letter ? `${className} svg-letter` : className} direction={HEB.test(s) ? 'rtl' : undefined}>{labelText(s)}</text>
  );
}

/** k/den as TeX, written as counted (5/3 stays \frac{5}{3}); 0 is 0, a whole number of parts over 1 stays a fraction. */
export const partsTex = (k, den) => (k === 0 ? '0' : den === 1 ? `${k}` : `${k < 0 ? '-' : ''}\\frac{${Math.abs(k)}}{${den}}`);
/** A value on a line cut into `den` parts a unit: its number of parts from `base` (rounded to a whole part). */
export const partsOf = (v, den, base = 0) => Math.round((v - base) * den);
/** A decimal for a value of a line with `fmt: 'dec'`: at most three places, a real minus. */
export const decText = (v) => minus(Math.round(v * 1000) / 1000);
