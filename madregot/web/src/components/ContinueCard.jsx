import { m, useReducedMotion } from 'motion/react';
import { Play, Target, Footprints } from 'lucide-react';
import { TOPIC, topicsFor } from '@/content/index.js';
import { boardOf } from '@/lib/board.js';
import { PARTS } from '@/lib/lesson.js';
import { useApp } from '@/lib/store.js';
import { Emblem } from './map/Scenery.jsx';
import { Button } from './ui.jsx';
import { enter } from '@/lib/motion.js';

/**
 * The top of the learn screen: where to continue, in one card, so the map starts right below it.
 * Shows the unit's emblem and colour, the next stair, the unit's progress, and two short links
 * to the board (stairs climbed in the grade, what is not clear yet).
 */
export default function ContinueCard({ grade, next, onStart, onBoard }) {
  const reduce = useReducedMotion();
  const { path, progress, gaps, placement } = useApp();
  const b = boardOf({ grade, path, progress, gaps, placement });
  const t = next ? TOPIC[next.topic] : null;
  const n = t ? topicsFor(grade).findIndex((x) => x.id === t.id) + 1 : 0;
  const done = t ? b.topics.find((x) => x.id === t.id)?.done ?? 0 : 0;
  const go = () => onStart(next.kind === 'review' ? `/lesson/${next.topic}/${next.level}?kind=review` : `/lesson/${next.topic}/${next.level}?part=${Math.min(next.parts + 1, PARTS)}`);
  return (
    <m.section className={`continue ch-${t?.color || 'brand'}`} aria-labelledby="continue-title"
      initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={enter()}>
      {t ? (
        <>
          <div className="continue-head">
            <Emblem topic={t.id} />
            <div className="continue-text">
              <h1 id="continue-title" className="continue-title">{next.kind === 'review' ? 'חזרה על היחידה' : next.title}</h1>
              <p className="continue-sub">יחידה {n}, {t.title}: {Math.min(done + 1, t.levels.length)} מתוך {t.levels.length} מדרגות</p>
              <span className="continue-bar" aria-hidden="true"><i style={{ width: `${(done / t.levels.length) * 100}%` }} /></span>
            </div>
          </div>
          <Button className="btn-block btn-lg continue-go" onClick={go}><Play size={20} aria-hidden="true" fill="currentColor" />{next.kind === 'review' ? 'לחזרה' : next.parts ? 'המשך' : 'התחלה'}</Button>
        </>
      ) : (
        <h1 id="continue-title" className="continue-title">כל המדרגות בכיתה הזו הושלמו</h1>
      )}
      <div className="continue-links">
        <button type="button" className="continue-chip" onClick={onBoard}><Footprints size={16} aria-hidden="true" />עליתם {b.done} מתוך {b.total}</button>
        {b.open > 0 && <button type="button" className="continue-chip work" onClick={onBoard}><Target size={16} aria-hidden="true" />{b.open === 1 ? 'דבר אחד לחזק' : `${b.open} דברים לחזק`}</button>}
      </div>
    </m.section>
  );
}
