// An explanation in the student's own words (CURRICULUM-6.1). The text lives in this component's state only: it is not
// saved and not in analytics. "סיימתי" shows the sample answer and the rubric as a list the student ticks for themselves
// ("בדקו את התשובה שלכם"): a self-check, with no score. Where this device has the tutor's feedback tool, a secondary
// button then asks the tutor which rubric points the text already covers (FOLLOWUP-16, ai spec AI-10): the text is sent
// only on that press, and the reply is shown here and kept nowhere. The tutor marks points and quotes the student's
// words; it never rewrites the explanation and never gives a score.
import { useEffect, useId, useRef, useState } from 'react';
import clsx from 'clsx';
import { Lightbulb } from 'lucide-react';
import { MathText } from '@/components/MathText.jsx';
import { Button } from '@/components/ui.jsx';
import SupportCard from '@/components/SupportCard.jsx';
import { useApp } from '@/lib/store.js';
import { runAI } from '@/lib/ai.js';
import { errorText } from '@/lib/api.js';
import { gate, hasTool, useAIStatus } from '@/lib/account.js';
import { PartFooter, GO_ON } from './common.jsx';
import { FEEDBACK_COPY, feedbackRequest, quoteIn } from './feedback.js';
import '@/styles/lazy/challenge.css'; // the feedback's own rules, loaded with the challenge (not in the boot CSS)

/**
 * The tutor's reply: the intro line, each rubric point with its status, the student's words that cover it (marked in
 * their own text) and a tip; then the summary. A care reply (the text read as distress) shows only its summary and the
 * people to talk to, never the rubric.
 */
export function FeedbackResult({ result, rubric, text }) {
  if (result.care) {
    return (
      <div className="ch-fb-care">
        {result.summary && <p className="ch-fb-summary"><MathText text={result.summary} /></p>}
        <SupportCard variant="after-message" />
      </div>
    );
  }
  return (
    <div className="ch-fb-result">
      <p className="ch-fb-intro">{FEEDBACK_COPY.intro}</p>
      <ol className="ch-fb-points">
        {result.points.map((p) => {
          const q = p.status === 'no' ? null : quoteIn(text, p.quote);
          return (
            <li key={p.i} className={clsx('ch-fb-point', `is-${p.status}`)} data-status={p.status}>
              <div className="ch-fb-head">
                <span className="ch-fb-line"><MathText text={rubric[p.i]} /></span>
                <span className="ch-fb-status"><span className="visually-hidden">: </span>{FEEDBACK_COPY.status[p.status]}</span>
              </div>
              {q && (
                <p className="ch-fb-quote">
                  <span className="visually-hidden">{FEEDBACK_COPY.words} </span>
                  {q.before}<mark className="ch-fb-mark">{q.mark}</mark>{q.after}
                </p>
              )}
              {p.tip && (
                <p className="ch-fb-tip">
                  <Lightbulb size={18} aria-hidden="true" className="ch-fb-tip-icon" />
                  <span><span className="visually-hidden">{FEEDBACK_COPY.tip} </span><MathText text={p.tip} /></span>
                </p>
              )}
            </li>
          );
        })}
      </ol>
      {result.summary && <p className="ch-fb-summary"><MathText text={result.summary} /></p>}
    </div>
  );
}

/** The one request, on the student's press: runAI('feedback', { ctx, rubric, sample, text }) (feedback.js). */
export const sendFeedback = (args) => runAI('feedback', feedbackRequest(args));

/**
 * The button and what it brings back. Hidden where the device has no feedback tool (no tutor, or a tier without it) and
 * when there is no text to read. gate() opens the one-time introduction or the calm limit sheet first; a limit the
 * server reports opens the same sheet, and the button simply waits again.
 */
export function ExplainFeedback({ task, part, text }) {
  const status = useAIStatus((x) => x.status);
  const grade = useApp((s) => s.profile?.grade);
  const [fb, setFb] = useState({ phase: 'idle' }); // idle | busy | done | error
  const mounted = useRef(true);
  const shown = useRef(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  // the reply opens under the button, which can sit behind the pinned footer: bring its top into view (focus stays on
  // the button, and the live region reads the reply out)
  useEffect(() => { if (fb.phase === 'done') shown.current?.scrollIntoView?.({ block: 'nearest' }); }, [fb.phase]);
  if (!task || !text.trim() || !hasTool('feedback', status)) return null;

  const ask = async () => {
    if (gate('feedback', { then: ask })) return;
    setFb({ phase: 'busy' });
    try {
      const result = await sendFeedback({ task, part, text, grade });
      if (mounted.current) setFb({ phase: 'done', result });
    } catch (e) {
      if (!mounted.current) return;
      // a limit (or "not now" on the consent sheet) was already said calmly by its sheet: back to the button, no red line
      if (e.limit) setFb({ phase: 'idle' });
      else setFb({ phase: 'error', message: e.message || errorText(e.code) });
    }
  };
  const done = fb.phase === 'done';
  // asked once: the button stays where the focus is, as a quiet "ready" that does nothing more (the text is read-only)
  const state = fb.phase === 'busy' ? 'busy' : done ? 'done' : 'idle';
  return (
    <section className="ch-fb" aria-label={FEEDBACK_COPY.title}>
      <Button variant="secondary" className="btn-block ch-fb-ask" state={state} busyText={FEEDBACK_COPY.busy} doneText={FEEDBACK_COPY.ready} onClick={ask}>
        {FEEDBACK_COPY.button}
      </Button>
      {fb.phase === 'error' && <p className="form-error ch-fb-error" role="alert">{fb.message}</p>}
      <div className="ch-fb-live" aria-live="polite" ref={shown}>
        {fb.phase === 'busy' && <p className="visually-hidden">{FEEDBACK_COPY.busy}</p>}
        {done && <FeedbackResult result={fb.result} rubric={part.rubric} text={text} />}
      </div>
    </section>
  );
}

export default function ExplainPart({ part, onDone, last, task }) {
  const [text, setText] = useState('');
  const [shown, setShown] = useState(false);
  const [ticks, setTicks] = useState({});
  const id = useId();
  return (
    <>
      <div className="lm-prompt ch-prompt" data-region="question"><div className="lm-say"><p id={`${id}-q`}><MathText text={part.prompt} /></p></div></div>
      <textarea className="input ch-explain" rows={5} value={text} readOnly={shown} aria-labelledby={`${id}-q`}
        placeholder="כתבו כאן, במילים שלכם" onChange={(e) => setText(e.target.value)} />
      {shown && (
        <section className="ch-check" aria-labelledby={`${id}-c`}>
          <h3 className="ch-sub" id={`${id}-c`}>בדקו את התשובה שלכם</h3>
          <ul className="ch-rubric">
            {part.rubric.map((r, i) => (
              <li key={i}>
                <label className="ch-tick">
                  <input type="checkbox" checked={!!ticks[i]} onChange={(e) => setTicks({ ...ticks, [i]: e.target.checked })} />
                  <span><MathText text={r} /></span>
                </label>
              </li>
            ))}
          </ul>
          <div className="ch-sample"><p className="ch-sample-tag">תשובה לדוגמה</p><p><MathText text={part.sample} /></p></div>
        </section>
      )}
      {shown && <ExplainFeedback task={task} part={part} text={text} />}
      <PartFooter result={null} label={shown ? (last ? 'לסיום' : GO_ON) : 'סיימתי'} onClick={shown ? () => onDone(null) : () => setShown(true)} />
    </>
  );
}
