// The teaching stages of a stair, full screen: A (understand), B (worked examples), C (solve together).
// The place inside a stage is saved as the student goes, so closing never loses it (and needs no warning).
import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import clsx from 'clsx';
import { X, HelpCircle } from 'lucide-react';
import { useApp } from '@/lib/store.js';
import { TOPIC } from '@/content/index.js';
import { contentOf } from '@/learn/content/index.ts';
import { skillId } from '@/learn/skills.ts';
import StepPlayer from '@/components/learn/StepPlayer.jsx';
import WorkedExample from '@/components/learn/WorkedExample.jsx';
import Together from '@/components/learn/Together.jsx';
import TutorSheet from '@/components/learn/TutorSheet.jsx';

const TITLE = { A: 'מבינים את הרעיון', B: 'דוגמה פתורה', C: 'פותרים יחד' };

export default function Teach() {
  const { topic, level: L, stage } = useParams();
  const level = Number(L);
  const navigate = useNavigate();
  const skill = skillId(topic, level);
  const c = contentOf(skill);
  const t = TOPIC[topic];
  const pos = useApp((s) => s.learn.skills[skill]?.pos?.[stage]) || 0;
  const { markTaught, setStagePos, noteLearn, learnEvent } = useApp.getState();
  const [idx, setIdx] = useState(stage === 'A' ? 0 : pos); // B and C: which example / problem
  const [tutor, setTutor] = useState(false);
  useEffect(() => { if (c && stage === 'A') learnEvent({ e: 'teach-start', s: skill }); }, [skill, stage]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!c || !t || !TITLE[stage]) return <Navigate to={`/learn/${topic}/${level}`} replace />;

  const close = () => navigate(`/learn/${topic}/${level}`, { replace: true });
  const finish = () => {
    markTaught(skill, stage);
    useApp.getState().completeMission({ skill, kind: 'continue' });
    setStagePos(skill, stage, 0);
    if (stage === 'A') navigate(`/learn/${topic}/${level}/B`, { replace: true });
    else if (stage === 'B') navigate(`/learn/${topic}/${level}/C`, { replace: true });
    else navigate(`/learn/${topic}/${level}`, { replace: true, state: { after: 'C' } });
  };
  const nextOf = (list, ev) => () => {
    learnEvent({ e: ev, s: skill });
    if (idx + 1 < list.length) { setIdx(idx + 1); setStagePos(skill, stage, idx + 1); window.scrollTo({ top: 0 }); } else finish();
  };

  return (
    <div className={clsx('teach', `ch-${t.color}`)}>
      <header className="teach-head">
        <button type="button" className="icon-btn" onClick={close} aria-label="סגירה. המקום נשמר"><X size={22} aria-hidden="true" /></button>
        <div className="teach-titles">
          <p className="teach-topic">{t.levels[level - 1].title}</p>
          <h1 className="teach-stage">{TITLE[stage]}</h1>
        </div>
        <button type="button" className="icon-btn" onClick={() => setTutor(true)} aria-label="שאלה למדי"><HelpCircle size={22} aria-hidden="true" /></button>
      </header>
      <main className="teach-main">
        {stage === 'A' && <StepPlayer key="A" steps={c.discover} start={pos} onIndex={(i) => setStagePos(skill, 'A', i)} onDone={finish} label="ההסבר" doneLabel="לדוגמה הפתורה" />}
        {stage === 'B' && <WorkedExample key={`B${idx}`} example={c.examples[Math.min(idx, c.examples.length - 1)]} n={Math.min(idx, c.examples.length - 1) + 1} of={c.examples.length} decimal={c.topic === 'stats'} onDone={nextOf(c.examples, 'example-done')} doneLabel={idx + 1 < c.examples.length ? 'לדוגמה הבאה' : 'לפתור יחד'} />}
        {stage === 'C' && (
          <Together key={`C${idx}`} problem={c.together[Math.min(idx, c.together.length - 1)]} n={Math.min(idx, c.together.length - 1) + 1} of={c.together.length} decimal={c.topic === 'stats'}
            onAttempt={(ok) => noteLearn({ topic, level, ok, purpose: 'guided', key: `${skill}:together:${idx}`, at: new Date().toISOString() })}
            onDone={nextOf(c.together, 'together-done')} />
        )}
      </main>
      <TutorSheet open={tutor} onOpenChange={setTutor} content={c} />
    </div>
  );
}
