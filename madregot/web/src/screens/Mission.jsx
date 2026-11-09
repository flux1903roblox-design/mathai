// "המשימה שלי להיום": about five minutes, chosen for this student today, each part with the reason for it.
// Layout: Duolingo's quests screen (a progress card with a thick bar, then one card per quest).
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { Check, Wrench, RotateCcw, Footprints, Sparkles, Award, CalendarClock, ArrowLeft } from 'lucide-react';
import { useApp, today } from '@/lib/store.js';
import { useMission } from '@/lib/useLearn.js';
import { missionDone, missionMinutes, partialStairNote } from '@/learn/mission.ts';
import { STAGE_N } from '@/learn/recommend.ts';
import { MathText } from '@/components/MathText.jsx';
import { Button } from '@/components/ui.jsx';
import PageHero from '@/components/PageHero.jsx';
import { Bar, StateCard } from '@/components/ds.jsx';

export const KIND_ICON = { repair: Wrench, review: RotateCcw, prereq: Footprints, continue: ArrowLeft, new: Sparkles, mastery: Award, exam: CalendarClock };
export const KIND_LABEL = { repair: 'תיקון', review: 'בדיקת זיכרון', prereq: 'מדרגה קודמת', continue: 'ממשיכים', new: 'חדש', mastery: 'בדיקת שליטה', exam: 'הכנה למבחן' };

export default function Mission() {
  const navigate = useNavigate();
  const { items, fresh } = useMission();
  const saveMission = useApp((s) => s.saveMission);
  const learnEvent = useApp((s) => s.learnEvent);
  useEffect(() => { if (fresh && items.length) { saveMission(today(), items); learnEvent({ e: 'mission-start' }); } }, [fresh]); // eslint-disable-line react-hooks/exhaustive-deps
  const done = missionDone(items);
  useEffect(() => { if (done) learnEvent({ e: 'mission-done' }); }, [done]); // eslint-disable-line react-hooks/exhaustive-deps
  const nextItem = items.find((i) => !i.done);
  return (
    <div className="page mission">
      <PageHero tone="brand" title="המשימה שלי להיום" sub={items.length ? `בערך ${missionMinutes(items)} דקות. כל חלק נבחר בשבילכם, והסיבה כתובה לידו.` : 'אין כרגע משימה.'} scene="climb" mood={done ? 'achievement' : 'happy'} />
      {items.length > 0 && (
        <section className="mission-progress" aria-label="ההתקדמות במשימה">
          <div className="mission-progress-top"><b>המשימה היומית</b><span className="readiness-count">בערך {missionMinutes(items)} דק׳</span></div>
          <Bar value={items.filter((i) => i.done).length} max={items.length} label="ההתקדמות במשימה" text={done ? 'הושלמה' : `${items.filter((i) => i.done).length} / ${items.length}`} />
        </section>
      )}
      {done && (
        <div className="mission-done" role="status">
          <StateCard kind="celebrate" title="המשימה של היום הושלמה">
            <p>{partialStairNote(items) || 'מה שעשיתם היום נשמר.'} מחר תחכה משימה חדשה.</p>
          </StateCard>
        </div>
      )}
      {!items.length && (
        <StateCard kind="empty" mood="happy" title="הכול מעודכן להיום" action={<Button className="btn-block" onClick={() => navigate('/')}>למפה</Button>}>
          <p>אפשר לבחור מדרגה במפה ולהמשיך משם.</p>
        </StateCard>
      )}
      <ol className="mission-list">
        {items.map((it, i) => {
          const Icon = KIND_ICON[it.kind] || Sparkles;
          return (
            <li key={`${it.kind}-${it.skill}-${it.misc || ''}`} className={clsx('mission-item', it.done && 'done', it === nextItem && 'next')}>
              <span className="mission-icon" aria-hidden="true">{it.done ? <Check size={20} strokeWidth={3} /> : <Icon size={20} />}</span>
              <div className="mission-text">
                <p className="mission-kind">{KIND_LABEL[it.kind]}{it.stage && it.kind !== 'mastery' ? ` · שלב ${STAGE_N[it.stage]} מתוך 5` : ''} · {it.minutes} דק׳</p>
                <p className="mission-title"><MathText text={it.title} /></p>
                <p className="mission-why"><MathText text={it.reason} /></p>
              </div>
              <Button variant={it === nextItem ? 'secondary' : 'ghost'} className="btn-sm" onClick={() => navigate(it.to)} aria-label={`${it.done ? 'שוב' : 'מתחילים'}: ${it.title.replace(/\$/g, '')}`}>{it.done ? 'שוב' : i === 0 || it === nextItem ? 'מתחילים' : 'פתיחה'}</Button>
            </li>
          );
        })}
      </ol>
      {nextItem && <Button className="btn-block btn-lg" onClick={() => navigate(nextItem.to)}>{items[0] === nextItem ? 'מתחילים את המשימה שלי' : 'ממשיכים במשימה'}</Button>}
    </div>
  );
}
