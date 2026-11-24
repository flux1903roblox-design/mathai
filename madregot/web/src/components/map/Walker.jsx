// מדי on the path (PRODUCT2-37): he stands beside the stop the student is on, on the side toward the middle, so the map
// says "you are here". Coming back after a stair is done, he walks there from the stop just finished, with a few small
// hops, once; after a teaching stage he hops where he is. Under reduced motion he simply stands at the stop.
// The walk is the browser's own Web Animations API (no animation library), measured from the two stops on screen.
// The stops zig-zag, so he travels on a diagonal: the way there (translate) and the hops (transform) are two
// animations, each hop rising with ease-out and falling with ease-in, so every hop is an arc and not a straight line
// up and down (ux-motion 6). Loaded on demand by Learn.jsx, after the map is drawn.
import { useLayoutEffect, useRef } from 'react';
import Mascot from '@/components/Mascot.jsx';

const still = () => typeof window === 'undefined' || !window.matchMedia || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** The easings of a hop: up slowing to the top, down speeding to the ground; across, ease-in-out (lib/motion.js EASE). */
export const EASE = { up: 'cubic-bezier(0.16, 1, 0.3, 1)', down: 'cubic-bezier(0.7, 0, 0.84, 0)', inOut: 'cubic-bezier(0.65, 0, 0.35, 1)' };

/**
 * The hops, as keyframes of `transform`: [offset, height in px] after the start on the ground. A rise takes ease-out and
 * a fall ease-in (the easing on a keyframe runs to the next), so each hop is an arc.
 */
export function hops(points) {
  const frames = [{ transform: 'none', offset: 0, easing: points[0][1] > 0 ? EASE.up : EASE.down }];
  points.forEach(([offset, up], i) => {
    const next = points[i + 1]?.[1] ?? 0;
    frames.push({ transform: up ? `translateY(-${up}px)` : 'none', offset, easing: next > up ? EASE.up : EASE.down });
  });
  frames.push({ transform: 'none', offset: 1 });
  return frames;
}

/** side: 'left' | 'right' of the stop; from: the key of the stop he walks from (data-stop), or null; hop: a hop in place. */
export default function Walker({ side, from = null, hop = false }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || still() || typeof el.animate !== 'function') return undefined;
    const start = from ? document.querySelector(`[data-stop="${CSS.escape(from)}"] .node`) : null;
    const runs = [];
    const timing = (duration) => ({ duration, delay: 250, fill: 'backwards' });
    if (start) {
      const a = start.getBoundingClientRect(); const b = el.getBoundingClientRect();
      const dx = a.left + a.width / 2 - (b.left + b.width / 2); const dy = a.top + a.height / 2 - (b.top + b.height / 2);
      // the way there, from one stop to the next: ease-in-out, as anything moving across the screen (ux-motion 5)
      runs.push(el.animate([{ translate: `${dx}px ${dy}px` }, { translate: '0px 0px', offset: 0.8 }, { translate: '0px 0px' }], { ...timing(1100), easing: EASE.inOut }));
      runs.push(el.animate(hops([[0.2, 12], [0.4, 0], [0.6, 12], [0.8, 0], [0.9, 8]]), timing(1100)));
    } else if (hop) {
      runs.push(el.animate(hops([[0.35, 14], [0.6, 0], [0.8, 6]]), timing(700)));
    }
    return () => runs.forEach((r) => r.cancel());
  }, [from, hop]);
  return <span ref={ref} className={`path-walker is-${side}`} aria-hidden="true"><Mascot size={44} mood="idle" /></span>;
}
