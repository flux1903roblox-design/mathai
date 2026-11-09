import { m } from 'motion/react';
import clsx from 'clsx';
import PageScene from './PageScene.jsx';
import { DUR, enter } from '@/lib/motion.js';


/**
 * The top of a screen: a soft land in the screen's own colour, the title and one line about the screen,
 * and its scene: מדי on a stair beside the thing the screen is for (PageScene). tone: a chapter colour,
 * or brand / streak / ai.
 */
export default function PageHero({ tone = 'brand', title, sub, scene, mood = 'idle', children, id }) {
  return (
    <header className={clsx('page-hero', `ch-${tone}`)} data-region="header">
      <div className="page-hero-text">
        <m.h1 id={id} className="page-hero-title" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={enter()}>{title}</m.h1>
        {sub && <m.p className="page-hero-sub" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={enter(DUR.medium, 0.06)}>{sub}</m.p>}
        {children}
      </div>
      <m.div className="page-hero-art" aria-hidden="true" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={enter(DUR.slow, 0.08)}>
        <PageScene name={scene} mood={mood} />
      </m.div>
    </header>
  );
}
