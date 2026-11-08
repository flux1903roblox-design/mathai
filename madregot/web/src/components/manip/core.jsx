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
