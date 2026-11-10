// Today's mission, the first card of the missions tab, laid out like Duolingo's daily quests card: a header with the
// time it takes, one row per part (an icon, the title, why it was chosen, and a thick bar with its progress written
// inside), and ONE big button that starts the next part. A row can be tapped to open that part (it is a link, not a
// second button). This card is the whole mission: the old separate mission page (/mission) now opens this tab.
// Under it the exam entry as its own card. The mission is fixed for the day once shown.
// A student in a class sees the teacher's work first, inside the card (ClassWork, TEACHER-5 §5): the big button starts
// the earliest unfinished work from the teacher, and the minutes count it too. The stairs the teacher gave report how
// far they are whenever this card opens or the learning record changes (lib/classWork.js).
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { m, useReducedMotion } from 'motion/react';
import { Link } from 'react-router-dom';
import { Play, CalendarClock, Footprints, Target, ChevronLeft, Sparkles, Check, Wrench, RotateCcw, Award, ArrowLeft } from 'lucide-react';
import { useApp, today } from '@/lib/store.js';
import { useMission } from '@/lib/useLearn.js';
import { boardOf } from '@/lib/board.js';
import { missionDone, missionMinutes, partialStairNote } from '@/learn/mission.ts';
import { STAGE_N } from '@/learn/recommend.ts';
import { daysBetween } from '@/learn/mastery.ts';
import { MathText } from '@/components/MathText.jsx';
import { classRows, reportStairs } from '@/lib/classWork.js';
import ClassWork from './ClassWork.jsx';
import { Button } from '@/components/ui.jsx';
import { Bar } from '@/components/ds.jsx';
import Mascot from '@/components/Mascot.jsx';
import { enter } from '@/lib/motion.js';

export const KIND_ICON = { repair: Wrench, review: RotateCcw, prereq: Footprints, continue: ArrowLeft, new: Sparkles, mastery: Award, exam: CalendarClock };
export const KIND_LABEL = { repair: 'תיקון', review: 'בדיקת זיכרון', prereq: 'מדרגה קודמת', continue: 'ממשיכים', new: 'חדש', mastery: 'בדיקת שליטה', exam: 'הכנה למבחן' };

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
  const { path, progress, gaps, placement, saveMission, learnEvent } = useApp();
  const exam = useApp((s) => s.learn.exam);
  const { items, fresh } = useMission();
  // the teacher's work (only in a class, with a server: classWork stays empty otherwise)
  const inClass = useApp((s) => !!s.profile?.token);
  const classWork = useApp((s) => s.classWork);
  const workOutbox = useApp((s) => s.workOutbox);
  const skills = useApp((s) => s.learn.skills);
  const work = inClass ? classRows(classWork, workOutbox, today()) : null;
  useEffect(() => { if (inClass) reportStairs(); }, [inClass, classWork.at, skills]);
  useEffect(() => { if (fresh && items.length) { saveMission(today(), items); learnEvent({ e: 'mission-start' }); } }, [fresh]); // eslint-disable-line react-hooks/exhaustive-deps
  const b = boardOf({ grade, path, progress, gaps, placement });
  const next = items.find((i) => !i.done);
  const done = missionDone(items);
  useEffect(() => { if (done) learnEvent({ e: 'mission-done' }); }, [done]); // eslint-disable-line react-hooks/exhaustive-deps
  const started = items.some((i) => i.done);
  // days counted as Exam Rescue counts them: from today to the exam's date
  const examDays = exam ? Math.max(0, Math.round(daysBetween(`${today()}T00:00:00`, `${exam.date}T00:00:00`))) : null;
  return (
    <m.section className={clsx('continue', 'today', 'ch-brand')} aria-labelledby="continue-title"
      initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={enter()}>
      <div className="quest-card" data-region="card">
        <div className="today-head quest-head">
          <div className="quest-head-row">
            <h1 id="continue-title" className="continue-title">{done ? 'המשימה של היום הושלמה' : 'המשימה שלי להיום'}</h1>
            {(items.length > 0 || work?.minutes > 0) && <span className="quest-time">{done && !work?.minutes ? 'מחר תחכה חדשה' : `בערך ${(done ? 0 : missionMinutes(items)) + (work?.minutes || 0)} דק׳`}</span>}
          </div>
          {done && <p className="continue-sub">{partialStairNote(items) || 'כל החלקים של המשימה בוצעו.'} מחר תחכה משימה חדשה.</p>}
          {!items.length && !work?.show.length && <p className="continue-sub">הכול מעודכן להיום. אפשר לבחור מדרגה במסלול ולהמשיך משם.</p>}
        </div>
        {work && <ClassWork rows={work} teacherName={classWork.teacherName} />}
        {items.length > 0 && (
          <ol className="today-items quest-rows" aria-label={`המשימה: ${items.length} חלקים, בערך ${missionMinutes(items)} דקות`}>
            {items.map((it) => {
              const Icon = it.done ? Check : KIND_ICON[it.kind] || Sparkles;
              const bar = partBar(it);
              const plain = it.title.replace(/\$/g, '');
              return (
                <li key={`${it.kind}-${it.skill}-${it.misc || ''}`} className={clsx('today-row', it.done && 'done', it === next && 'next')}>
                  <span className={clsx('quest-icon', `qk-${it.kind}`)} aria-hidden="true"><Icon size={22} strokeWidth={it.done ? 3 : 2} /></span>
                  <span className="quest-body">
                    <Link to={it.to} className="today-item-title today-link"><MathText text={it.title} /></Link>
                    <span className="today-kind">{KIND_LABEL[it.kind]} · {it.minutes} דק׳</span>
                    <span className="today-why"><MathText text={it.reason} /></span>
                    <Bar value={bar.value} max={bar.max} text={bar.text} label={plain} tone={it.done ? 'good' : 'brand'} />
                  </span>
                  <ChevronLeft size={20} aria-hidden="true" className="chev" />
                </li>
              );
            })}
          </ol>
        )}
        {work?.next
          ? <Button className="btn-block btn-lg continue-go" onClick={() => navigate(work.next.to)} data-region="primary"><Play size={20} aria-hidden="true" fill="currentColor" />{work.next.started ? 'ממשיכים במשימה מהמורה' : 'מתחילים במשימה מהמורה'}</Button>
          : next && <Button className="btn-block btn-lg continue-go" onClick={() => navigate(next.to)} data-region="primary"><Play size={20} aria-hidden="true" fill="currentColor" />{started ? 'ממשיכים במשימה' : 'מתחילים את המשימה שלי'}</Button>}
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
