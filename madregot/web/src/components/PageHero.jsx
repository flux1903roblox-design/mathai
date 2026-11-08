import { m } from 'motion/react';
import clsx from 'clsx';
import Mascot from './Mascot.jsx';
import { DUR, enter } from '@/lib/motion.js';

// unDraw illustrations shipped in src/assets/illustrations (credits in ASSETS.md).
const ART = import.meta.glob('../assets/illustrations/*.svg', { eager: true, query: '?url', import: 'default' });
export const artUrl = (name) => ART[`../assets/illustrations/${name}.svg`] || null;

/**
 * The top of a screen: a soft land in the screen's own colour, the title and one line about the screen,
 * and an illustration (or מדי when there is none). tone: a chapter colour, or brand / streak / ai.
 */
export default function PageHero({ tone = 'brand', title, sub, art, mood = 'idle', children, id }) {
  const src = art ? artUrl(art) : null;
  return (
    <header className={clsx('page-hero', `ch-${tone}`)}>
      <div className="page-hero-text">
        <m.h1 id={id} className="page-hero-title" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={enter()}>{title}</m.h1>
        {sub && <m.p className="page-hero-sub" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={enter(DUR.medium, 0.06)}>{sub}</m.p>}
        {children}
      </div>
      <m.div className="page-hero-art" aria-hidden="true" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={enter(DUR.slow, 0.08)}>
        {src ? <img src={src} alt="" /> : <Mascot mood={mood} size={104} />}
      </m.div>
    </header>
  );
}
