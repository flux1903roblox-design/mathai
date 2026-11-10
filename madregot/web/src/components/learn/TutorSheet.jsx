// "שאלה למדי": the six questions a student asks, answered from the stair's own content (src/learn/tutor.ts).
// What it shows is what was written and checked for this stair: an explanation, another way, why it works,
// a worked example, the diagnosis of the last mistake with its repair, or the solution one step at a time with
// the last step left to the student. It says plainly that it is not an AI; with a server, the AI is a separate button.
// When the tutor is done for today (aiState used, paused or resting), the class has it off (class_off), or the device
// waits for a parent's OK (parent_ok_needed), that button gives way to one plain line: Madi is the way on, and asking needs no request. startIntent opens the sheet with that question already asked.
import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { Sparkles } from 'lucide-react';
import { Sheet, Button } from '@/components/ui.jsx';
import { MathText } from '@/components/MathText.jsx';
import { INTENTS, tutorReply } from '@/learn/tutor.ts';
import { useApp } from '@/lib/store.js';
import AIAllowance from '@/components/AIAllowance.jsx';
import { CLASS_OFF_LINE, PARENT_OK_LINE } from '@/components/limitCopy.js';
import StepPlayer from './StepPlayer.jsx';
import Mascot from '@/components/Mascot.jsx';
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

export default function TutorSheet({ open, onOpenChange, content, item = null, wrong = null, onAskAI = null, aiState = null, startIntent = null }) {
  const [log, setLog] = useState([]); // { intent, reply }
  const [asked, setAsked] = useState({});
  const learnEvent = useApp((s) => s.learnEvent);
  const end = useRef(null);
  useEffect(() => { if (log.length) end.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, [log.length]);
  const ask = (intent) => {
    const reply = tutorReply(intent, { content, item, wrong, asked });
    setAsked({ ...asked, [intent]: (asked[intent] || 0) + 1 });
    setLog((l) => [...l, { intent, reply, id: l.length }]);
    learnEvent({ e: 'tutor', s: content?.skill, p: intent });
  };
  // opened from "שאלה למדי" after a mistake: the question about the mistake is asked at once
  const started = useRef(null);
  useEffect(() => {
    if (open && startIntent && started.current !== startIntent) { started.current = startIntent; ask(startIntent); }
    if (!open) started.current = null;
  }, [open, startIntent]); // eslint-disable-line react-hooks/exhaustive-deps
  const resting = aiState === 'used' ? 'העוזר החכם חוזר מחר' : aiState === 'paused' || aiState === 'resting' ? 'העוזר החכם נח היום'
    : aiState === 'class_off' ? CLASS_OFF_LINE : aiState === 'parent_ok_needed' ? PARENT_OK_LINE : null;
  // A conversation (LAYOUT_SPEC B3, the same layout as the assistant): מדי's messages as bubbles at the start side,
  // the question asked as the student's bubble, and the questions to ask docked at the bottom, where a chat's input is.
  const footer = (
    <>
      <div className="tutor-intents chat-chips" role="group" aria-label="שאלות למדי">
        {INTENTS.map((x) => (
          <button key={x.id} type="button" className={clsx('chip', 'tutor-chip', x.id === 'mistake' && !wrong && 'dim')} onClick={() => ask(x.id)}>{x.label}</button>
        ))}
      </div>
      {onAskAI && resting ? <p className="tutor-note">{resting}</p> : onAskAI ? (
        <div className="tutor-note">
          <Button variant="ai" className="btn-sm" onClick={onAskAI}><Sparkles size={16} aria-hidden="true" />לשאול את העוזר החכם</Button>
          <AIAllowance kind="chat" />
        </div>
      ) : <p className="tutor-note">התשובות כאן נכתבו מראש לכל מדרגה ונבדקו. העוזר החכם (Claude) לא מחובר בגרסה הזאת.</p>}
    </>
  );
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="שאלה למדי" footer={footer}>
      <div className="tutor chat-thread" aria-live="polite">
        <div className="msg-row assistant">
          <Mascot mood="thinking" size={34} className="msg-avatar" />
          <div className="msg assistant"><p>מה לא ברור? בחרו שאלה למטה, ואענה מתוך מה שלמדנו במדרגה הזאת.</p></div>
        </div>
        {log.map(({ intent, reply, id }, n) => (
          <div key={id} className="tutor-turn" ref={n === log.length - 1 ? end : undefined}>
            <div className="msg-row user"><div className="msg user tutor-q"><p>{INTENTS.find((x) => x.id === intent)?.label}</p></div></div>
            <div className="msg-row assistant">
              <Mascot mood="idle" size={34} className="msg-avatar" />
              <div className="msg assistant tutor-a">{reply.say.map((t, i) => <p key={i}><MathText text={t} /></p>)}</div>
            </div>
            {reply.action && content && (
              <div className="tutor-action">
                {reply.action.kind === 'example' && <WorkedExample example={content.examples[reply.action.index]} n={reply.action.index + 1} of={content.examples.length} onDone={() => {}} doneLabel="סיימתי לראות" />}
                {reply.action.kind === 'steps' && <StepsReveal steps={reply.action.steps} />}
                {reply.action.kind === 'remedy' && <RemedyFlow content={content} misc={reply.action.misc} compact />}
                {reply.action.kind === 'discover' && <StepPlayer steps={content.discover} label="ההסבר" doneLabel="סיימתי" onDone={() => {}} />}
              </div>
            )}
            {reply.action?.kind === 'steps' && !content && <div className="tutor-action"><StepsReveal steps={reply.action.steps} /></div>}
          </div>
        ))}
      </div>
    </Sheet>
  );
}
