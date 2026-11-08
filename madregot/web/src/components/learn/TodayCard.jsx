// The top of the home screen: one clear next action (today's mission), the way to exam preparation, and where
// the student stands. The mission is fixed for the day once shown; each part says why it was chosen.
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { m, useReducedMotion } from 'motion/react';
import { Play, CalendarClock, Check, Footprints, Target } from 'lucide-react';
import { useApp, today } from '@/lib/store.js';
import { useMission } from '@/lib/useLearn.js';
import { boardOf } from '@/lib/board.js';
import { missionDone, missionMinutes } from '@/learn/mission.ts';
import { daysBetween } from '@/learn/mastery.ts';
import { MathText } from '@/components/MathText.jsx';
import { Button } from '@/components/ui.jsx';
import Mascot from '@/components/Mascot.jsx';
import { enter } from '@/lib/motion.js';

export default function TodayCard({ grade, onBoard }) {
  const reduce = useReducedMotion();
  const navigate = useNavigate();
  const { profile, path, progress, gaps, placement, saveMission } = useApp();
  const exam = useApp((s) => s.learn.exam);
  const { items, fresh } = useMission();
  useEffect(() => { if (fresh && items.length) saveMission(today(), items); }, [fresh]); // eslint-disable-line react-hooks/exhaustive-deps
  const b = boardOf({ grade, path, progress, gaps, placement });
  const next = items.find((i) => !i.done);
  const done = missionDone(items);
  const started = items.some((i) => i.done);
  const examDays = exam ? Math.max(0, Math.ceil(daysBetween(new Date().toISOString(), `${exam.date}T23:59:59`)) - 1) : null;
  const name = profile?.name ? `שלום ${profile.name}!` : 'שלום!';
  return (
    <m.section className={clsx('continue', 'today', 'ch-brand')} aria-labelledby="continue-title"
      initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={enter()}>
      <div className="today-head">
        <Mascot mood={done ? 'achievement' : 'happy'} size={64} className="today-mascot" />
        <div className="today-text">
          <p className="today-hello">{name}</p>
          <h1 id="continue-title" className="continue-title">{done ? 'המשימה של היום הושלמה' : 'המשימה שלי להיום'}</h1>
          {next && <p className="continue-sub"><MathText text={next.reason} /></p>}
          {done && <p className="continue-sub">כל הכבוד. מחר תחכה משימה חדשה.</p>}
        </div>
      </div>
      {items.length > 0 && (
        <ol className="today-items" aria-label={`המשימה: ${items.length} חלקים, בערך ${missionMinutes(items)} דקות`}>
          {items.map((it) => (
            <li key={`${it.kind}-${it.skill}-${it.misc || ''}`} className={clsx(it.done && 'done', it === next && 'next')}>
              <span className="today-dot" aria-hidden="true">{it.done && <Check size={14} strokeWidth={3} />}</span>
              <span className="today-item-title"><MathText text={it.title} /></span>
              <span className="today-min">{it.minutes} דק׳</span>
            </li>
          ))}
        </ol>
      )}
      {next ? (
        <Button className="btn-block btn-lg continue-go" onClick={() => navigate(next.to)}><Play size={20} aria-hidden="true" fill="currentColor" />{started ? 'ממשיכים במשימה' : 'מתחילים את המשימה שלי'}</Button>
      ) : (
        <Button variant="secondary" className="btn-block continue-go" onClick={() => navigate('/mission')}>מה היה היום</Button>
      )}
      <Button variant="secondary" className="btn-block today-exam" onClick={() => navigate('/rescue')}>
        <CalendarClock size={18} aria-hidden="true" />{exam ? (examDays === 0 ? 'המבחן היום: ההכנה שלי' : `ההכנה למבחן: עוד ${examDays} ${examDays === 1 ? 'יום' : 'ימים'}`) : 'יש לי מבחן בקרוב'}
      </Button>
      <div className="continue-links">
        <button type="button" className="continue-chip" onClick={onBoard}><Footprints size={16} aria-hidden="true" />עליתם {b.done} מתוך {b.total}</button>
        {b.open > 0 && <button type="button" className="continue-chip work" onClick={onBoard}><Target size={16} aria-hidden="true" />{b.open === 1 ? 'דבר אחד לחזק' : `${b.open} דברים לחזק`}</button>}
      </div>
    </m.section>
  );
}
