// "שאלה למדי": the six questions a student asks, answered from the stair's own content (src/learn/tutor.ts).
// What it shows is what was written and checked for this stair: an explanation, another way, why it works,
// a worked example, the diagnosis of the last mistake with its repair, or the solution one step at a time with
// the last step left to the student. It says plainly that it is not an AI; with a server, the AI is a separate button.
import { useState } from 'react';
import clsx from 'clsx';
import { Sparkles } from 'lucide-react';
import { Sheet, Button } from '@/components/ui.jsx';
import { MathText } from '@/components/MathText.jsx';
import Mascot from '@/components/Mascot.jsx';
import { INTENTS, tutorReply } from '@/learn/tutor.ts';
import { useApp } from '@/lib/store.js';
import StepPlayer from './StepPlayer.jsx';
import WorkedExample from './WorkedExample.jsx';
import RemedyFlow from './RemedyFlow.jsx';

function StepsReveal({ steps }) {
  const [n, setN] = useState(1);
  return (
    <div className="tutor-steps">
      <ol className="stair-list">
        {steps.slice(0, n).map((s, i) => <li key={i} className="stair-step" style={{ '--i': i }}><span className="stair-n" aria-hidden="true">{i + 1}</span><span className="stair-text"><MathText text={s} /></span></li>)}
      </ol>
      {n < steps.length ? <Button variant="secondary" className="btn-sm" onClick={() => setN(n + 1)}>הצעד הבא</Button> : <p className="ls-why warm">את הצעד האחרון עושים לבד. נסו עכשיו.</p>}
    </div>
  );
}

export default function TutorSheet({ open, onOpenChange, content, item = null, wrong = null, onAskAI = null }) {
  const [log, setLog] = useState([]); // { intent, reply }
  const [asked, setAsked] = useState({});
  const learnEvent = useApp((s) => s.learnEvent);
  const ask = (intent) => {
    const reply = tutorReply(intent, { content, item, wrong, asked });
    setAsked({ ...asked, [intent]: (asked[intent] || 0) + 1 });
    setLog((l) => [...l, { intent, reply, id: l.length }]);
    learnEvent({ e: 'tutor', s: content?.skill, p: intent });
  };
  const footer = (
    <p className="tutor-note">
      {onAskAI ? <Button variant="ai" className="btn-sm" onClick={onAskAI}><Sparkles size={16} aria-hidden="true" />לשאול את העוזר החכם</Button> : 'התשובות כאן נכתבו מראש לכל מדרגה ונבדקו. העוזר החכם (Claude) לא מחובר בגרסה הזאת.'}
    </p>
  );
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="שאלה למדי" footer={footer}>
      <div className="tutor">
        {!log.length && (
          <div className="ls-say"><Mascot mood="thinking" size={56} className="ls-mascot" /><div className="ls-bubble"><p>מה לא ברור? בחרו שאלה.</p></div></div>
        )}
        <div className="tutor-log" aria-live="polite">
          {log.map(({ intent, reply, id }) => (
            <div key={id} className="tutor-turn">
              <p className="tutor-q">{INTENTS.find((x) => x.id === intent)?.label}</p>
              <div className="tutor-a">{reply.say.map((t, i) => <p key={i}><MathText text={t} /></p>)}</div>
              {reply.action?.kind === 'example' && content && <WorkedExample example={content.examples[reply.action.index]} n={reply.action.index + 1} of={content.examples.length} onDone={() => {}} doneLabel="סיימתי לראות" />}
              {reply.action?.kind === 'steps' && <StepsReveal steps={reply.action.steps} />}
              {reply.action?.kind === 'remedy' && content && <RemedyFlow content={content} misc={reply.action.misc} compact />}
              {reply.action?.kind === 'discover' && content && <StepPlayer steps={content.discover} label="ההסבר" doneLabel="סיימתי" onDone={() => {}} />}
            </div>
          ))}
        </div>
        <div className="tutor-intents" role="group" aria-label="שאלות">
          {INTENTS.map((x) => (
            <button key={x.id} type="button" className={clsx('chip', 'tutor-chip', x.id === 'mistake' && !wrong && 'dim')} onClick={() => ask(x.id)}>{x.label}</button>
          ))}
        </div>
      </div>
    </Sheet>
  );
}
