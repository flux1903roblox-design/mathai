// Stage A (and every remedy): a short run of teaching steps, one at a time, laid out like a Brilliant lesson:
//   a thin segmented bar on top, the text (with מדי beside it), the maths on a light board in the middle, answer
//   cards across the width, and at the bottom one button: "בדיקה" while there is something to check, then a result
//   strip ("נכון!" in green, "כמעט" in yellow) with "המשך".
// Step kinds: say, predict (a guess, then why: any choice moves on), explore (move it until it is right), rule.
import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { AnimatePresence, m } from 'motion/react';
import { ArrowLeft, ArrowRight, Check, Lightbulb, X, Sparkles } from 'lucide-react';
import Mascot from '@/components/Mascot.jsx';
import { Tex, MathText, mathPlain } from '@/components/MathText.jsx';
import { Button } from '@/components/ui.jsx';
import { Segments } from '@/components/ds.jsx';
import { KINDS } from '@/components/manip/Manip.jsx';
import Figure from '@/components/Figure.jsx';
import { manipCorrect, manipSolution } from '@/content/manip.js';
import { qaOn } from '@/lib/qa.js';
import { enter } from '@/lib/motion.js';
import { play } from '@/lib/sound.js';

/** The prompt: מדי and what he says. Shared by every lesson module. */
export function Prompt({ mood = 'idle', children, tag }) {
  return (
    <header className="lm-prompt">
      <Mascot mood={mood} size={52} className="lm-madi" />
      <div className="lm-say">{tag && <p className="lm-tag">{tag}</p>}{children}</div>
    </header>
  );
}

/** The canvas: where the maths is. Shown only when there is something to see. */
export function Canvas({ display, fig, big = true, children, label }) {
  if (!display && !fig && !children) return null;
  return (
    <div className={clsx('lm-canvas', big && 'big')} aria-label={label}>
      {display && <div className="lm-expr"><Tex tex={display} display /></div>}
      {fig && <div className="lm-fig"><Figure fig={fig} /></div>}
      {children}
    </div>
  );
}

function Say({ step }) {
  return (
    <>
      <Prompt mood={step.mood || 'idle'}><p><MathText text={step.text} /></p></Prompt>
      <Canvas display={step.display} fig={step.fig} />
    </>
  );
}

function Predict({ step, chosen, sel, onSelect }) {
  const locked = chosen != null;
  return (
    <>
      <Prompt mood={locked ? (chosen === step.answer ? 'happy' : 'encouraging') : 'thinking'} tag="מה לדעתכם?"><p><MathText text={step.text} /></p></Prompt>
      <Canvas display={step.display} fig={step.fig} />
      <div className="lm-response">
        <div className="ls-choices" role="radiogroup" aria-label="מה לדעתכם?">
          {step.choices.map((c, i) => {
            const state = locked ? (i === step.answer ? 'good' : i === chosen ? 'bad' : '') : '';
            const on = locked ? chosen === i : sel === i;
            return (
              <button key={c} type="button" role="radio" aria-checked={on} aria-label={mathPlain(c)} className={clsx('choice', 'ls-choice', state, on && 'on')} disabled={locked} onClick={() => { onSelect(i); play('tap'); }}>
                <span className="choice-key" aria-hidden="true">{state === 'good' ? <Check size={18} strokeWidth={3.4} /> : state === 'bad' ? <X size={18} strokeWidth={3.4} /> : i + 1}</span>
                <span className="choice-text"><MathText text={c} /></span>
              </button>
            );
          })}
        </div>
        {locked && (
          <m.div className={clsx('ls-why', chosen === step.answer ? 'good' : 'warm')} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={enter(0.25)}>
            {chosen !== step.answer && step.wrongWhy?.[chosen] && <p><MathText text={step.wrongWhy[chosen]} /></p>}
            <p><MathText text={step.why} /></p>
          </m.div>
        )}
      </div>
    </>
  );
}

function Explore({ step, done, onDone, onCtl }) {
  const C = KINDS[step.manip.kind];
  const [v, setV] = useState(step.manip.start ?? null);
  const [touched, setTouched] = useState(false);
  const [miss, setMiss] = useState(0);
  const ok = done || (touched && miss === -1);
  const it = { form: 'manip', manip: step.manip, answer: step.answer };
  // test hook: put the object in its right state, as a student would by moving it
  useEffect(() => {
    if (!qaOn()) return undefined;
    const solve = () => { setV(manipSolution(it)); setTouched(true); setMiss(0); };
    solve.forStep = step; // which step it solves: the one leaving the screen keeps its own until it is gone
    window.__madregotSolveStep = solve;
    return () => { if (window.__madregotSolveStep === solve) delete window.__madregotSolveStep; };
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps
  const check = () => {
    if (manipCorrect(it, v)) { setMiss(-1); play('correct'); onDone(); } else { setMiss((n) => n + 1); play('wrong'); }
  };
  // the bottom button checks this step: tell it whether there is something to check, and how
  useEffect(() => { onCtl({ step, can: !ok && touched && v != null, miss: ok ? 0 : Math.max(0, miss), check }); }, [v, touched, miss, ok]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="ls-explore">
      <Prompt mood={ok ? 'happy' : miss > 0 ? 'encouraging' : 'thinking'} tag="נסו בעצמכם"><p><MathText text={step.text} /></p></Prompt>
      <Canvas display={step.display ? `${step.display}${step.manip.kind === 'numberline' ? ' = \\,?' : ''}` : null}>
        {C ? <C m={step.manip} value={v} onChange={(x) => { setV(x); setTouched(true); if (miss > 0) setMiss(0); }} locked={ok} reveal={false} good={ok} answer={step.answer} hint={miss > 0} /> : <p className="form-error">האובייקט הזה לא זמין.</p>}
      </Canvas>
      <div className="lm-response" aria-live="polite">
        {ok && <p className="ls-why good"><Check size={16} strokeWidth={3} aria-hidden="true" /> <MathText text={step.success} /></p>}
        {!ok && miss > 0 && <p className="ls-why warm"><Lightbulb size={16} aria-hidden="true" /> <MathText text={step.hint} /></p>}
      </div>
    </div>
  );
}

function Rule({ step }) {
  return (
    <>
      <Prompt mood="happy" tag="הכלל"><p className="lm-rule-text"><MathText text={step.text} /></p></Prompt>
      <Canvas display={step.display} fig={step.fig} />
      <div className="lm-response"><div className="lm-why"><p className="lm-why-title"><Sparkles size={16} aria-hidden="true" />למה זה עובד?</p><p><MathText text={step.why} /></p></div></div>
    </>
  );
}

/**
 * steps: DiscoverStep[]; start: the step to open on; onIndex(i): where the student is (saved, so leaving keeps it);
 * onDone(): after the last step. label: what this run is (for the progress).
 */
export default function StepPlayer({ steps, start = 0, onIndex, onDone, label = 'שלב', doneLabel = 'סיימתי' }) {
  const [i, setI] = useState(Math.min(start, steps.length - 1));
  const [answers, setAnswers] = useState({}); // step index → chosen (predict) or true (explore done)
  const [sel, setSel] = useState({}); // predict: the card picked, before it is checked
  const [ctl, setCtl] = useState(null); // explore: what the bottom button checks
  const ref = useRef(null);
  const step = steps[i];
  useEffect(() => { onIndex?.(i); ref.current?.focus({ preventScroll: true }); window.scrollTo?.({ top: 0, behavior: 'smooth' }); }, [i]); // eslint-disable-line react-hooks/exhaustive-deps
  // Test hook, as for exercises: the current teaching step (with its goal) on a QA build or with 'madregot-debug' set.
  useEffect(() => {
    if (!qaOn()) return undefined;
    window.__madregotStep = step;
    return () => { if (window.__madregotStep === step) window.__madregotStep = null; };
  }, [step]);
  const answered = step.kind === 'predict' ? answers[i] != null : step.kind === 'explore' ? !!answers[i] : true;
  const last = i === steps.length - 1;
  const go = () => { if (last) onDone?.(); else setI(i + 1); };
  const exp = ctl && ctl.step === step ? ctl : null;
  // the bottom button: "בדיקה" while there is something to check, then the way on
  const checking = !answered;
  const canCheck = step.kind === 'predict' ? sel[i] != null : !!exp?.can;
  const check = () => {
    if (step.kind === 'predict') { setAnswers((a) => ({ ...a, [i]: sel[i] })); play(sel[i] === step.answer ? 'correct' : 'wrong'); } else exp?.check();
  };
  // the result strip, as both reference apps show it: green when right, yellow (not red) when not yet
  const banner = step.kind === 'predict' && answers[i] != null
    ? (answers[i] === step.answer ? { tone: 'good', text: 'נכון!' } : { tone: 'warm', text: 'ניחוש טוב לבדוק. הנה מה שקורה' })
    : step.kind === 'explore' && answers[i] ? { tone: 'good', text: 'יפה! בדיוק כך' }
      : step.kind === 'explore' && exp?.miss > 0 ? { tone: 'warm', text: 'עוד לא. הזיזו ונסו שוב' } : null;
  return (
    <div className="step-player lm">
      <div className="lm-progress">
        <Segments steps={steps.length} done={i} current={i} size="thin" className="sp-progress" label={label} valueText={`צעד ${i + 1} מתוך ${steps.length}`} />
        <span className="lm-count" aria-hidden="true">{i + 1}/{steps.length}</span>
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <m.section key={i} ref={ref} tabIndex={-1} className={clsx('sp-step', 'lm-card', `sp-${step.kind}`)} aria-label={`צעד ${i + 1} מתוך ${steps.length}`}
          initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }} transition={enter(0.22)}>
          {step.kind === 'say' && <Say step={step} />}
          {step.kind === 'predict' && <Predict step={step} chosen={answers[i]} sel={sel[i]} onSelect={(c) => setSel((x) => ({ ...x, [i]: c }))} />}
          {step.kind === 'explore' && <Explore step={step} done={!!answers[i]} onDone={() => setAnswers((a) => ({ ...a, [i]: true }))} onCtl={setCtl} />}
          {step.kind === 'rule' && <Rule step={step} />}
        </m.section>
      </AnimatePresence>
      <footer className={clsx('lm-actions', 'sp-nav', banner && `has-${banner.tone}`)}>
        {banner && (
          <p className="lm-banner" role="status">
            <span className="lm-banner-icon" aria-hidden="true">{banner.tone === 'good' ? <Check size={18} strokeWidth={3.4} /> : <Lightbulb size={18} />}</span>{banner.text}
          </p>
        )}
        <div className="lm-actions-row">
          <Button variant="ghost" className="sp-back" onClick={() => setI(i - 1)} disabled={i === 0} aria-label="הצעד הקודם"><ArrowRight size={18} aria-hidden="true" />הקודם</Button>
          {checking
            ? <Button className="lm-check btn-lg" onClick={check} disabled={!canCheck}>בדיקה</Button>
            : <Button className="sp-next btn-lg" onClick={go}>{last ? doneLabel : step.kind === 'say' ? 'הבנתי' : 'המשך'}{!last && <ArrowLeft size={18} aria-hidden="true" />}</Button>}
        </div>
      </footer>
    </div>
  );
}
