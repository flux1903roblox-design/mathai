// Solid drawing (ux-motion 10): a card that leans a little toward the pointer, up to 8° each way with a 1000px
// perspective (the CSS .tilt), and comes back when the pointer leaves. Only where a mouse or a pen hovers: a finger
// scrolls the page and the card stays put. Never under reduced motion, and never on a lesson's working area.
import { useEffect } from 'react';

/** The most a card leans, in degrees. */
export const TILT_MAX = 8;
/** How long a card takes to come back (--duration-quick), before it drops its tilt layer. */
export const TILT_BACK_MS = 150;

/** The lean toward a point over a box: { rx, ry } in degrees (rx tips the top away as the point goes down). */
export function tiltAt(x, y, rect, max = TILT_MAX) {
  const px = Math.min(1, Math.max(0, (x - rect.left) / rect.width)) - 0.5;
  const py = Math.min(1, Math.max(0, (y - rect.top) / rect.height)) - 0.5;
  const round = (v) => Math.round(v * 100) / 100 || 0;
  return { rx: round(-py * 2 * max), ry: round(px * 2 * max) };
}

/**
 * Lean `ref`'s element toward a hovering pointer, by its --tilt-x and --tilt-y, while it wears .is-tilting: the class
 * comes with the pointer and goes once the card is back, so a card nobody hovers is drawn exactly as before (no layer).
 */
export function useTilt(ref) {
  useEffect(() => {
    const el = ref.current;
    const mq = (q) => typeof window !== 'undefined' && !!window.matchMedia?.(q).matches;
    if (!el || !mq('(hover: hover) and (pointer: fine)') || mq('(prefers-reduced-motion: reduce)')) return undefined;
    let back = 0;
    const move = (e) => {
      if (e.pointerType === 'touch') return;
      clearTimeout(back);
      const { rx, ry } = tiltAt(e.clientX, e.clientY, el.getBoundingClientRect());
      el.classList.add('is-tilting');
      el.style.setProperty('--tilt-x', `${rx}deg`); el.style.setProperty('--tilt-y', `${ry}deg`);
    };
    const leave = () => {
      el.style.removeProperty('--tilt-x'); el.style.removeProperty('--tilt-y');
      clearTimeout(back); back = setTimeout(() => el.classList.remove('is-tilting'), TILT_BACK_MS);
    };
    el.addEventListener('pointermove', move); el.addEventListener('pointerleave', leave);
    return () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerleave', leave); clearTimeout(back); el.classList.remove('is-tilting'); };
  }, [ref]);
}
