// The class goal of the week (STUDENT-4): how far the class is toward one shared number of steps, and how much the
// student added. No names, no ranks and no other student's share: the server sends only the total and this student's
// part. It is reached by practice at home, so nothing here speaks of the classroom or the school day.
// - ClassGoalCard: on Quests (above today's missions); `compact` in Learn's wide side panel.
// - ClassGoalMoment: the first time the student opens Learn or Quests after the class reached a week's goal they took
//   part in, a short sheet; once a week (nudges.goalSeen), and the class scarf is Madi's.
// Neither renders for a student with no class, a build with no server, or a class whose teacher turned the goal off.
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { Users } from 'lucide-react';
import NumberFlow from '@number-flow/react';
import Mascot from '@/components/Mascot.jsx';
import Lottie from '@/components/Lottie.jsx';
import { Button, Sheet, Progress } from '@/components/ui.jsx';
import { useApp } from '@/lib/store.js';
import { useClassGoal, dayOfWeek } from '@/lib/classGoal.js';
import { useMadiLook } from '@/lib/madiLook.js';

const steps = (n) => (n === 1 ? 'צעד אחד' : `${n} צעדים`);
/** The student's own share of the week (only theirs; nobody else's is ever shown). */
export const shareText = (mine) => (mine > 0 ? `החלק שלכם השבוע: ${steps(mine)}` : 'עוד לא הוספתם צעדים השבוע. כל שיעור קצר נספר.');
const startText = (target) => `שבוע חדש. המטרה: ${target} צעדים, כולם יחד.`;
const REACHED_MINE = 'הכיתה הגיעה למטרה! מדי קיבל צעיף כיתה.';
// calm, with no "you didn't": the next week is open to everyone
const REACHED_NOT_MINE = 'הכיתה הגיעה למטרה של השבוע. בשבוע הבא כל צעד שלכם נספר, ומי שמוסיף צעד מקבל צעיף כיתה למדי.';

export default function ClassGoalCard({ compact = false }) {
  const g = useClassGoal();
  if (!g) return null;
  return compact ? <SideGoal g={g} /> : <FullGoal g={g} />;
}

function FullGoal({ g }) {
  const { have, target, mine, reached, last, week } = g;
  // last week's result, at the start of a new week only (Sunday to Tuesday)
  const showLast = !!last && dayOfWeek(week) <= 2;
  return (
    <section className={clsx('card class-goal-card', reached && 'is-reached')} aria-labelledby="cg-h" data-region="card">
      <h2 id="cg-h" className="card-title"><Users size={22} aria-hidden="true" className="brand-icon" />מטרת הכיתה השבוע</h2>
      <div className="cg-top">
        {have === 0 ? <p className="cg-count">{startText(target)}</p> : (
          <p className="cg-count">
            {/* the number rolls when it changes; the sentence is read once, as plain text */}
            <span aria-hidden="true"><bdi dir="ltr"><NumberFlow value={have} /></bdi> מתוך {target} צעדים</span>
            <span className="visually-hidden">{have} מתוך {target} צעדים</span>
          </p>
        )}
        {reached && <Mascot mood="happy" size={64} className="cg-madi" />}
      </div>
      <Progress className="cg-progress" trackClassName="cg-track" fillClassName="cg-fill" value={Math.min(have, target)} max={target} labelledBy="cg-h" valueText={`${have} מתוך ${target} צעדים`} />
      {reached && <p className="cg-reached">{mine > 0 ? REACHED_MINE : REACHED_NOT_MINE}</p>}
      {have > 0 && (!reached || mine > 0) && <p className="cg-mine">{shareText(mine)}</p>}
      {showLast && <p className="cg-last">בשבוע שעבר: {last.have} מתוך {last.target}{last.reached ? '. הגעתם למטרה.' : '.'}</p>}
      <p className="field-hint">כל שיעור, שלב לימוד או בדיקה הוא צעד. בדיקת שליטה שעברתם שווה 3 צעדים.</p>
    </section>
  );
}

/** The same numbers, small, beside the path on a wide screen; it leads to Quests. */
function SideGoal({ g }) {
  const { have, target, mine, reached } = g;
  return (
    <Link to="/quests" className={clsx('side-card side-goal', reached && 'is-reached')}>
      <b>מטרת הכיתה השבוע</b>
      <span className="side-goal-count">{have === 0 ? startText(target) : `${have} מתוך ${target} צעדים`}</span>
      <div className="bar cg-track" aria-hidden="true"><i className="cg-fill" style={{ width: `${Math.min(1, have / target) * 100}%` }} /></div>
      <span className="muted">{reached ? (mine > 0 ? REACHED_MINE : 'הכיתה הגיעה למטרה של השבוע.') : have > 0 ? shareText(mine) : 'כל שיעור קצר נספר.'}</span>
    </Link>
  );
}

/**
 * The shared moment: the class reached a week's goal and this student added to it. Shown once for that week (it is
 * marked seen as it opens, so a reload never brings it back), with Madi already wearing the class scarf. The confetti
 * is the one LessonDone plays, left out under reduced motion.
 */
export function ClassGoalMoment() {
  const g = useClassGoal();
  const seen = useApp((s) => s.nudges?.goalSeen);
  const look = useMadiLook();
  const navigate = useNavigate();
  const [moment, setMoment] = useState(null); // { week, mine, thisWeek }
  const [open, setOpen] = useState(false);
  const due = g ? [g, g.last].find((w) => w?.reached && w.mine > 0 && !seen?.[w.week]) : null;
  useEffect(() => {
    if (!due || moment) return;
    setMoment({ week: due.week, mine: due.mine, thisWeek: due.week === g.week });
    setOpen(true);
    const app = useApp.getState();
    app.markGoalSeen(due.week);
    app.markEarned(['class-scarf']);
  }, [due?.week]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!moment) return null;
  return (
    <Sheet open={open} onOpenChange={setOpen} title="עשינו את זה יחד" className="goal-moment"
      footer={<Button className="btn-block btn-lg" onClick={() => { setOpen(false); navigate('/me/madi?try=class-scarf'); }}>לראות את מדי</Button>}>
      <div className="done-hero goal-moment-hero">
        <Lottie name="confetti" className="done-confetti" decorative />
        <Mascot mood="excited" size={132} look={{ ...look, neck: 'class-scarf' }} />
      </div>
      <p className="goal-moment-text">
        הכיתה שלכם עברה את המטרה של {moment.thisWeek ? 'השבוע' : 'השבוע שעבר'}, ואתם הוספתם {steps(moment.mine)}. מדי קיבל צעיף כיתה.
      </p>
    </Sheet>
  );
}
