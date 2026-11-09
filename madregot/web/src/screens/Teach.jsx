// The teaching stages of a stair, full screen: A (understand), B (worked examples), C (solve together), each laid out
// like a Brilliant lesson (see StepPlayer).
// The place inside a stage is saved as the student goes, so closing never loses it (and needs no warning).
import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import clsx from 'clsx';
import { useApp } from '@/lib/store.js';
import { TOPIC } from '@/content/index.js';
import { contentOf } from '@/learn/content/index.ts';
import { skillId } from '@/learn/skills.ts';
import StepPlayer, { LessonHeader } from '@/components/learn/StepPlayer.jsx';
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
    useApp.getState().completeMission({ skill, kind: 'continue', stage });
    setStagePos(skill, stage, 0);
    if (stage === 'A') navigate(`/learn/${topic}/${level}/B`, { replace: true });
    else if (stage === 'B') navigate(`/learn/${topic}/${level}/C`, { replace: true });
    else navigate(`/learn/${topic}/${level}`, { replace: true, state: { after: 'C' } });
  };
  const nextOf = (list, ev) => () => {
    learnEvent({ e: ev, s: skill });
    if (idx + 1 < list.length) { setIdx(idx + 1); setStagePos(skill, stage, idx + 1); window.scrollTo({ top: 0 }); } else finish();
  };

  // one header row for every stage, as in a Brilliant lesson: close (the place is kept), the progress bar, help
  const head = (bar) => <LessonHeader bar={bar} onClose={close} closeLabel="סגירה. המקום נשמר" onHelp={() => setTutor(true)} />;
  const kicker = t.levels[level - 1].title;
  return (
    <div className={clsx('teach', `ch-${t.color}`)}>
      <main className="teach-main">
        {stage === 'A' && <StepPlayer key="A" steps={c.discover} start={pos} onIndex={(i) => setStagePos(skill, 'A', i)} onDone={finish} label="ההסבר" doneLabel="לדוגמה הפתורה" renderHead={head} title={TITLE[stage]} kicker={kicker} />}
        {stage === 'B' && <WorkedExample key={`B${idx}`} example={c.examples[Math.min(idx, c.examples.length - 1)]} n={Math.min(idx, c.examples.length - 1) + 1} of={c.examples.length} decimal={c.topic === 'stats'} onDone={nextOf(c.examples, 'example-done')} doneLabel={idx + 1 < c.examples.length ? 'לדוגמה הבאה' : 'לפתור יחד'} renderHead={head} />}
        {stage === 'C' && (
          <Together key={`C${idx}`} problem={c.together[Math.min(idx, c.together.length - 1)]} n={Math.min(idx, c.together.length - 1) + 1} of={c.together.length} decimal={c.topic === 'stats'}
            onAttempt={(ok) => noteLearn({ topic, level, ok, purpose: 'guided', key: `${skill}:together:${idx}`, at: new Date().toISOString() })}
            onDone={nextOf(c.together, 'together-done')} renderHead={head} />
        )}
      </main>
      <TutorSheet open={tutor} onOpenChange={setTutor} content={c} />
    </div>
  );
}
