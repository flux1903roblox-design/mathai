// Repairing one misconception: its own explanation and activity, then a short check where it would show again.
// The teacher can give this very repair as class work (SK-BUYERS-2, ?assignment=): the kicker says it is from the
// teacher, and opening it reports the work started; its check, once passed, reports it done (lib/classWork.js
// reportStairs, from the learning record, so the same repair opened from the mission counts too).
import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { useApp } from '@/lib/store.js';
import { TOPIC } from '@/content/topics.js';
import { useStairContent } from '@/learn/useStairContent.js';
import { skillId } from '@/learn/skills.ts';
import { VERIFY_N } from '@/learn/misconceptions.ts';
import { MathText } from '@/components/MathText.jsx';
import { Button } from '@/components/ui.jsx';
import Mascot from '@/components/Mascot.jsx';
import RemedyFlow from '@/components/learn/RemedyFlow.jsx';
import { LessonHeader } from '@/components/learn/StepPlayer.jsx';
import { repairAssignment, reportStairs } from '@/lib/classWork.js';

export default function Repair() {
  const { topic, level: L, misc } = useParams();
  const level = Number(L);
  const navigate = useNavigate();
  const skill = skillId(topic, level);
  const c = useStairContent(skill);
  const t = TOPIC[topic];
  const def = c?.misconceptions.find((m) => m.id === misc);
  const [ready, setReady] = useState(false);
  const [params] = useSearchParams();
  // the teacher's repair of this mistake, while it is open (named by the address, or found by its stair and mistake)
  const fromTeacher = useApp((s) => !!s.profile?.token && !!s.classWork?.assignments && !!repairAssignment(skill, misc, params.get('assignment')));
  useEffect(() => {
    if (!def) return;
    useApp.getState().startRepair(skill, misc);
    reportStairs(); // a repair the teacher gave: started
  }, [skill, misc]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!c || !def || !t) return <Navigate to={`/learn/${topic}/${level}`} replace />;
  return (
    <div className={clsx('teach', `ch-${t.color}`)}>
      <main className="teach-main">
        {!ready ? (
          <RemedyFlow content={c} misc={misc} onDone={() => setReady(true)} doneLabel="עכשיו לבדיקה"
            title={<>מתקנים: <MathText text={def.title} /></>} kicker={fromTeacher ? `${t.levels[level - 1].title} · משימה מהמורה` : t.levels[level - 1].title}
            renderHead={(bar) => <LessonHeader bar={bar} onClose={() => navigate(-1)} closeLabel="סגירה" />} />
        ) : (
          <div className="repair-next">
            <Mascot mood="happy" size={88} />
            <p className="lead">עכשיו {VERIFY_N} שאלות קצרות, בלי רמזים, כדי לראות שזה מסתדר.</p>
            <Button className="btn-block btn-lg" onClick={() => navigate(`/lesson/${topic}/${level}?kind=check&purpose=verify&misc=${encodeURIComponent(misc)}`, { replace: true })}>לבדיקה</Button>
            <Button variant="ghost" className="btn-block" onClick={() => navigate('/', { replace: true })}>לא עכשיו</Button>
          </div>
        )}
      </main>
    </div>
  );
}
