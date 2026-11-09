// Stage C: solve together. The student chooses each next step; a wrong choice gets its own feedback and the hints
// grow stronger (first a question, then a stronger pointer). The last move is the student's: a typed answer.
// After two hints and a third miss the answer is shown with the reason, so nobody is stuck in a loop.
import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { m } from 'motion/react';
import { ArrowLeft, Check, Lightbulb, X } from 'lucide-react';
import { Tex, MathText, mathPlain } from '@/components/MathText.jsx';
import { Button } from '@/components/ui.jsx';
import { Prompt } from './StepPlayer.jsx';
import { parseNum, near, T, plainNum } from '@/content/util.js';
import { enter } from '@/lib/motion.js';
import { play } from '@/lib/sound.js';
import { qaOn } from '@/lib/qa.js';

function Hints({ hints, level }) {
  if (!level) return null;
  return (
    <div className="tg-hints" aria-live="polite">
      {hints.slice(0, level).map((h, i) => <p key={i} className="ls-why warm"><Lightbulb size={16} aria-hidden="true" /> <span className="tg-hint-n">{i === 0 ? 'רמז' : 'רמז חזק יותר'}:</span> <MathText text={h} /></p>)}
    </div>
  );
}

/** onAttempt(ok, independent): each move, for the learning record (all moves here count as learning with help). */
export default function Together({ problem, n, of, onDone, onAttempt, decimal = false }) {
  const [k, setK] = useState(0); // the step; problem.steps.length = the final answer
  const [picked, setPicked] = useState({}); // step → chosen indexes so far
  const [hint, setHint] = useState(0);
  const [built, setBuilt] = useState([]); // what the solved steps gave
  const [typed, setTyped] = useState('');
  const [finalMiss, setFinalMiss] = useState(0);
  const [solved, setSolved] = useState(false);
  const ref = useRef(null);
  useEffect(() => { setHint(0); ref.current?.focus({ preventScroll: true }); }, [k]);
  const onFinal = k >= problem.steps.length;
  const step = problem.steps[k];
  // test hook: the move being asked for now
  useEffect(() => { if (qaOn()) window.__madregotGuided = onFinal ? { final: problem.final } : { step }; }, [k, problem]); // eslint-disable-line react-hooks/exhaustive-deps

  const choose = (i) => {
    const c = step.choices[i];
    const tried = [...(picked[k] || []), i];
    setPicked({ ...picked, [k]: tried });
    onAttempt?.(c.ok);
    if (c.ok) { play('correct'); setBuilt([...built, step.done]); setTimeout(() => setK(k + 1), 900); } else { play('wrong'); setHint((h) => Math.min(2, h + 1)); }
  };
  const submit = () => {
    const u = parseNum(typed);
    if (u == null) return;
    const ok = near(u, problem.final.answer, 1e-6);
    onAttempt?.(ok);
    if (ok) { play('correct'); setSolved(true); } else { play('wrong'); setFinalMiss((x) => x + 1); setHint((h) => Math.min(2, h + 1)); }
  };
  const giveUp = finalMiss >= 3;
  return (
    <div className="together lm">
      <section className="lm-card">
      <Prompt mood={solved ? 'happy' : hint ? 'encouraging' : 'thinking'} tag={`פותרים יחד ${n} מתוך ${of}`}><p><MathText text={problem.problem} /></p></Prompt>
      {(problem.display || built.length > 0) && (
        <div className="lm-canvas big">
          {problem.display && <div className="lm-expr"><Tex tex={problem.display} display /></div>}
          {built.length > 0 && (
            <ol className="tg-built" aria-label="מה עשינו עד עכשיו">
              {built.map((b, i) => <li key={i}><Check size={16} aria-hidden="true" /> <MathText text={b} /></li>)}
            </ol>
          )}
        </div>
      )}
      <m.section key={k} ref={ref} tabIndex={-1} className="tg-step lm-response" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={enter(0.22)} aria-label={onFinal ? 'הצעד האחרון' : `צעד ${k + 1}`}>
        {!onFinal ? (
          <>
            <p className="tg-prompt"><MathText text={step.prompt} /></p>
            {step.display && <div className="ls-display"><Tex tex={step.display} display /></div>}
            <div className="ls-choices" role="group" aria-label="הצעד הבא">
              {step.choices.map((c, i) => {
                const was = (picked[k] || []).includes(i);
                const state = was ? (c.ok ? 'good' : 'bad') : '';
                return (
                  <button key={i} type="button" aria-label={mathPlain(c.text)} className={clsx('choice', 'ls-choice', state)} disabled={was || (picked[k] || []).some((j) => step.choices[j].ok)} onClick={() => choose(i)}>
                    <span className="choice-key" aria-hidden="true">{state === 'good' ? <Check size={18} strokeWidth={3.4} /> : state === 'bad' ? <X size={18} strokeWidth={3.4} /> : i + 1}</span>
                    <span className="choice-text"><MathText text={c.text} /></span>
                  </button>
                );
              })}
            </div>
            <div aria-live="polite">
              {(picked[k] || []).map((i) => <p key={i} className={clsx('ls-why', step.choices[i].ok ? 'good' : 'bad')}><MathText text={step.choices[i].feedback} /></p>)}
            </div>
            <Hints hints={step.hints} level={hint} />
            {hint < 2 && !(picked[k] || []).some((j) => step.choices[j].ok) && <button type="button" className="link-btn" onClick={() => setHint(hint + 1)}><Lightbulb size={16} aria-hidden="true" />{hint ? 'עוד רמז' : 'רמז'}</button>}
          </>
        ) : (
          <>
            <p className="tg-prompt"><MathText text={problem.final.prompt} /></p>
            {!solved && !giveUp && (
              <form className="tg-final" onSubmit={(e) => { e.preventDefault(); submit(); }}>
                <label htmlFor={`tg-${n}`} className="visually-hidden">התשובה</label>
                <input id={`tg-${n}`} className="input tg-input" dir="ltr" inputMode="text" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value.replace(/[^\d\-−./,]/g, '').slice(0, 9))} placeholder="?" />
                <Button type="submit" disabled={parseNum(typed) == null}>בדיקה</Button>
              </form>
            )}
            {finalMiss > 0 && !solved && !giveUp && <p className="ls-why bad" role="status">עוד לא. נסו שוב.</p>}
            <Hints hints={problem.final.hints} level={solved ? 0 : hint} />
            {!solved && !giveUp && hint < 2 && <button type="button" className="link-btn" onClick={() => setHint(hint + 1)}><Lightbulb size={16} aria-hidden="true" />{hint ? 'עוד רמז' : 'רמז'}</button>}
            {(solved || giveUp) && (
              <p className={clsx('ls-why', solved ? 'good' : 'warm')} role="status">
                {solved ? 'בדיוק! פתרתם את הצעד האחרון לבד.' : 'התשובה היא'} {!solved && <Tex tex={decimal && !Number.isInteger(problem.final.answer) ? plainNum(problem.final.answer, { decimal: true }) : T(problem.final.answer)} />}{!solved && '. נעבור על זה שוב בתרגול.'}
              </p>
            )}
          </>
        )}
      </m.section>
      </section>
      {(solved || giveUp) && (
        <footer className={clsx('lm-actions', solved ? 'has-good' : 'has-warm')}>
          <p className="lm-banner"><span className="lm-banner-icon" aria-hidden="true">{solved ? <Check size={18} strokeWidth={3.4} /> : <Lightbulb size={18} />}</span>{solved ? 'פתרתם לבד!' : 'נחזור על זה בתרגול'}</p>
          <div className="lm-actions-row"><Button className="btn-block btn-lg" onClick={onDone}>המשך<ArrowLeft size={18} aria-hidden="true" /></Button></div>
        </footer>
      )}
    </div>
  );
}
