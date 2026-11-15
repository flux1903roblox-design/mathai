// מדי on the path (PRODUCT2-37): he stands beside the stop the student is on, on the side toward the middle, so the map
// says "you are here". Coming back after a stair is done, he walks there from the stop just finished, with a few small
// hops, once; after a teaching stage he hops where he is. Under reduced motion he simply stands at the stop.
// The walk is the browser's own Web Animations API (no animation library), measured from the two stops on screen.
// Loaded on demand by Learn.jsx, after the map is drawn.
import { useLayoutEffect, useRef } from 'react';
import Mascot from '@/components/Mascot.jsx';

const still = () => typeof window === 'undefined' || !window.matchMedia || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** side: 'left' | 'right' of the stop; from: the key of the stop he walks from (data-stop), or null; hop: a hop in place. */
export default function Walker({ side, from = null, hop = false }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || still() || typeof el.animate !== 'function') return undefined;
    const start = from ? document.querySelector(`[data-stop="${CSS.escape(from)}"] .node`) : null;
    let frames;
    if (start) {
      const a = start.getBoundingClientRect(); const b = el.getBoundingClientRect();
      const dx = a.left + a.width / 2 - (b.left + b.width / 2); const dy = a.top + a.height / 2 - (b.top + b.height / 2);
      const at = (k, up) => `translate(${dx * (1 - k)}px, ${dy * (1 - k) - up}px)`;
      frames = [{ transform: at(0, 0) }, { transform: at(0.25, 12), offset: 0.2 }, { transform: at(0.5, 0), offset: 0.4 }, { transform: at(0.75, 12), offset: 0.6 }, { transform: at(1, 0), offset: 0.8 }, { transform: 'translate(0, -8px)', offset: 0.9 }, { transform: 'none' }];
    } else if (hop) {
      frames = [{ transform: 'none' }, { transform: 'translateY(-14px)', offset: 0.35 }, { transform: 'none', offset: 0.6 }, { transform: 'translateY(-6px)', offset: 0.8 }, { transform: 'none' }];
    }
    if (!frames) return undefined;
    const run = el.animate(frames, { duration: start ? 1100 : 700, delay: 250, easing: 'ease-in-out', fill: 'backwards' });
    return () => run.cancel();
  }, [from, hop]);
  return <span ref={ref} className={`path-walker is-${side}`} aria-hidden="true"><Mascot size={44} mood="idle" /></span>;
}
