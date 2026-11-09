// Repairing one misconception: its own explanation and activity, then a short check where it would show again.
import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import clsx from 'clsx';
import { useApp } from '@/lib/store.js';
import { TOPIC } from '@/content/index.js';
import { contentOf } from '@/learn/content/index.ts';
import { skillId } from '@/learn/skills.ts';
import { VERIFY_N } from '@/learn/misconceptions.ts';
import { MathText } from '@/components/MathText.jsx';
import { Button } from '@/components/ui.jsx';
import Mascot from '@/components/Mascot.jsx';
import RemedyFlow from '@/components/learn/RemedyFlow.jsx';
import { LessonHeader } from '@/components/learn/StepPlayer.jsx';

export default function Repair() {
  const { topic, level: L, misc } = useParams();
  const level = Number(L);
  const navigate = useNavigate();
  const skill = skillId(topic, level);
  const c = contentOf(skill);
  const t = TOPIC[topic];
  const def = c?.misconceptions.find((m) => m.id === misc);
  const [ready, setReady] = useState(false);
  useEffect(() => { if (def) useApp.getState().startRepair(skill, misc); }, [skill, misc]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!c || !def || !t) return <Navigate to={`/learn/${topic}/${level}`} replace />;
  return (
    <div className={clsx('teach', `ch-${t.color}`)}>
      <main className="teach-main">
        {!ready ? (
          <RemedyFlow content={c} misc={misc} onDone={() => setReady(true)} doneLabel="עכשיו לבדיקה"
            title={<>מתקנים: <MathText text={def.title} /></>} kicker={t.levels[level - 1].title}
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
