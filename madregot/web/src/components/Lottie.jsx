import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import clsx from 'clsx';

// Every animation in src/assets/lottie loads on demand, with the player, the first time it is shown.
const FILES = import.meta.glob('../assets/lottie/*.json');
const fileOf = (name) => FILES[`../assets/lottie/${name}.json`];
export const hasLottie = (name) => !!fileOf(name);

/**
 * A Lottie animation from src/assets/lottie (credits in ASSETS.md).
 * - decorative: under reduced motion it is left out (confetti); otherwise it holds a still frame.
 * - fallback: shown when the file or the player cannot load, so the moment never comes up empty.
 */
export default function Lottie({ name, loop = false, autoplay = true, speed = 1, className, fallback = null, decorative = false, still = 'end', frame, label, onComplete }) {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const [failed, setFailed] = useState(!hasLottie(name));
  useEffect(() => {
    if (failed || (reduce && decorative)) return undefined;
    let anim; let dead = false;
    (async () => {
      try {
        const [{ default: lottie }, data] = await Promise.all([import('lottie-web/build/player/lottie_light'), fileOf(name)()]);
        if (dead || !ref.current) return;
        anim = lottie.loadAnimation({
          container: ref.current, renderer: 'svg', loop: !reduce && loop && frame == null, autoplay: !reduce && autoplay && frame == null,
          animationData: data.default ?? data, rendererSettings: { preserveAspectRatio: 'xMidYMid meet', progressiveLoad: true },
        });
        anim.setSpeed(speed);
        if (frame != null) anim.addEventListener('DOMLoaded', () => anim.goToAndStop(frame === 'end' ? anim.totalFrames - 1 : frame === 'start' ? 0 : frame, true));
        else if (reduce) anim.addEventListener('DOMLoaded', () => anim.goToAndStop(still === 'end' ? anim.totalFrames - 1 : Math.floor(anim.totalFrames / 2), true));
        if (onComplete) anim.addEventListener('complete', onComplete);
      } catch {
        if (!dead) setFailed(true);
      }
    })();
    return () => { dead = true; anim?.destroy(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, failed, reduce, frame]);
  if (failed) return fallback;
  if (reduce && decorative) return null;
  return <div ref={ref} className={clsx('lottie', className)} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} />;
}
