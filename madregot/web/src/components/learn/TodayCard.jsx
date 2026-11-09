// The top of the home screen, laid out like Duolingo's daily quests card: a header with the time it takes, one row
// per part (an icon, the title, and a thick bar with its progress written inside), and one big button. Under it
// the exam entry as its own card. The mission is fixed for the day once shown; each part says why it was chosen.
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { m, useReducedMotion } from 'motion/react';
import { Play, CalendarClock, Footprints, Target, ChevronLeft, Sparkles } from 'lucide-react';
import { useApp, today } from '@/lib/store.js';
import { useMission } from '@/lib/useLearn.js';
import { boardOf } from '@/lib/board.js';
import { missionDone, missionMinutes, partialStairNote } from '@/learn/mission.ts';
import { STAGE_N } from '@/learn/recommend.ts';
import { daysBetween } from '@/learn/mastery.ts';
import { MathText } from '@/components/MathText.jsx';
import { Button } from '@/components/ui.jsx';
import { Bar } from '@/components/ds.jsx';
import Mascot from '@/components/Mascot.jsx';
import { KIND_ICON } from '@/screens/Mission.jsx';
import { enter } from '@/lib/motion.js';

/** A part's bar: a stage of a stair shows how far the stair is (stage n of 5); anything else is done or not yet. */
function partBar(it) {
  if (it.stage && it.kind !== 'mastery') {
    const n = STAGE_N[it.stage];
    return { value: it.done ? n : n - 1, max: 5, text: it.done ? `שלב ${n} מתוך 5 ✓` : `שלב ${n} מתוך 5` };
  }
  return { value: it.done ? 1 : 0, max: 1, text: it.done ? 'בוצע' : `${it.minutes} דק׳` };
}

export default function TodayCard({ grade, onBoard }) {
  const reduce = useReducedMotion();
  const navigate = useNavigate();
  const { path, progress, gaps, placement, saveMission } = useApp();
  const exam = useApp((s) => s.learn.exam);
  const { items, fresh } = useMission();
  useEffect(() => { if (fresh && items.length) saveMission(today(), items); }, [fresh]); // eslint-disable-line react-hooks/exhaustive-deps
  const b = boardOf({ grade, path, progress, gaps, placement });
  const next = items.find((i) => !i.done);
  const done = missionDone(items);
  const started = items.some((i) => i.done);
  // days counted as Exam Rescue counts them: from today to the exam's date
  const examDays = exam ? Math.max(0, Math.round(daysBetween(`${today()}T00:00:00`, `${exam.date}T00:00:00`))) : null;
  return (
    <m.section className={clsx('continue', 'today', 'ch-brand')} aria-labelledby="continue-title"
      initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={enter()}>
      <div className="quest-card">
        <div className="today-head quest-head">
          <div className="quest-head-row">
            <h1 id="continue-title" className="continue-title">{done ? 'המשימה של היום הושלמה' : 'המשימה שלי להיום'}</h1>
            {items.length > 0 && <span className="quest-time">{done ? 'מחר תחכה חדשה' : `בערך ${missionMinutes(items)} דק׳`}</span>}
          </div>
          {next && <p className="continue-sub"><MathText text={next.reason} /></p>}
          {done && <p className="continue-sub">{partialStairNote(items) || 'כל החלקים של המשימה בוצעו.'} מחר תחכה משימה חדשה.</p>}
        </div>
        {items.length > 0 && (
          <ol className="today-items quest-rows" aria-label={`המשימה: ${items.length} חלקים, בערך ${missionMinutes(items)} דקות`}>
            {items.map((it) => {
              const Icon = KIND_ICON[it.kind] || Sparkles;
              const bar = partBar(it);
              return (
                <li key={`${it.kind}-${it.skill}-${it.misc || ''}`} className={clsx(it.done && 'done', it === next && 'next')}>
                  <span className={clsx('quest-icon', `qk-${it.kind}`)} aria-hidden="true"><Icon size={22} /></span>
                  <span className="quest-body">
                    <span className="today-item-title"><MathText text={it.title} /></span>
                    <Bar value={bar.value} max={bar.max} text={bar.text} label={it.title.replace(/\$/g, '')} tone={it.done ? 'good' : 'brand'} />
                  </span>
                </li>
              );
            })}
          </ol>
        )}
        {next ? (
          <Button className="btn-block btn-lg continue-go" onClick={() => navigate(next.to)}><Play size={20} aria-hidden="true" fill="currentColor" />{started ? 'ממשיכים במשימה' : 'מתחילים את המשימה שלי'}</Button>
        ) : (
          <Button variant="secondary" className="btn-block continue-go" onClick={() => navigate('/mission')}>מה היה היום</Button>
        )}
        {done && <Mascot mood="achievement" size={72} className="quest-mascot" />}
      </div>
      <button type="button" className="exam-cta today-exam" onClick={() => navigate('/rescue')}>
        <span className="exam-cta-icon" aria-hidden="true"><CalendarClock size={24} /></span>
        <span className="exam-cta-text">
          <span className="exam-cta-title">{exam ? (examDays === 0 ? 'המבחן היום: ההכנה שלי' : `ההכנה למבחן: עוד ${examDays} ${examDays === 1 ? 'יום' : 'ימים'}`) : 'יש לי מבחן בקרוב'}</span>
          <span className="exam-cta-sub">{exam ? 'התוכנית של היום מחכה' : 'תוכנית הכנה לפי הימים שנשארו והנושאים במבחן'}</span>
        </span>
        <ChevronLeft size={22} aria-hidden="true" className="exam-cta-go" />
      </button>
      <div className="continue-links">
        <button type="button" className="continue-chip" onClick={onBoard}><Footprints size={16} aria-hidden="true" />עליתם {b.done} מתוך {b.total}</button>
        {b.open > 0 && <button type="button" className="continue-chip work" onClick={onBoard}><Target size={16} aria-hidden="true" />{b.open === 1 ? 'דבר אחד לחזק' : `${b.open} דברים לחזק`}</button>}
      </div>
    </m.section>
  );
}
