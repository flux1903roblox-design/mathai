// Stage A (and every remedy): a short run of teaching steps, one at a time, laid out like a Brilliant lesson:
//   one header row (close, a thin segmented progress bar, help), the lesson's title on its first screen only,
//   the text, then one large visual (the expression, the drawing or the object to move) with its controls under it,
//   answer cards across the width, and one button at the bottom: "בדיקה" while there is something to check, then a
//   result sheet that opens above it ("נכון!" in green, "כמעט" in yellow) with the explanation and מדי, and "המשך".
// Step kinds: say, predict (a guess, then why: any choice moves on), explore (move it until it is right), rule.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { AnimatePresence, m } from 'motion/react';
import { ArrowLeft, ArrowRight, Check, Lightbulb, X, Sparkles, HelpCircle } from 'lucide-react';
import Mascot from '@/components/Mascot.jsx';
import { Tex, MathText, mathPlain, FitDisplay, splitFirstSentence } from '@/components/MathText.jsx';
import { Button } from '@/components/ui.jsx';
import { Segments } from '@/components/ds.jsx';
import { KINDS } from '@/components/manip/Manip.jsx';
import Figure from '@/components/Figure.jsx';
import { manipCorrect, manipSolution } from '@/content/manip.js';
import { qaOn } from '@/lib/qa.js';
import { enter } from '@/lib/motion.js';
import { play } from '@/lib/sound.js';

/** The text of a step: plain, first on the screen (מדי speaks in the result sheet, not beside every text). */
export function Prompt({ children, tag }) {
  return (
    <header className="lm-prompt" data-region="question">
      <div className="lm-say">{children}</div>
    </header>
  );
}

/** The lesson's one header row: close, the progress bar, help. */
export function LessonHeader({ bar, onClose, closeLabel = 'סגירה', onHelp }) {
  return (
    <header className="bl-head" data-region="header">
      {onClose ? <button type="button" className="icon-btn bl-x" onClick={onClose} aria-label={closeLabel}><X size={24} aria-hidden="true" /></button> : <span className="icon-btn-spacer" aria-hidden="true" />}
      <div className="bl-bar">{bar}</div>
      {onHelp ? <button type="button" className="icon-btn" onClick={onHelp} aria-label="שאלה למדי"><HelpCircle size={24} aria-hidden="true" /></button> : <span className="icon-btn-spacer" aria-hidden="true" />}
    </header>
  );
}

/** The result sheet's body: מדי beside the explanation, as a tutor would say it. */
export function ResultWhy({ tone, children }) {
  return (
    <div className={clsx('ls-why', 'bl-why', tone)}>
      <Mascot mood={tone === 'good' ? 'happy' : 'encouraging'} size={40} className="bl-why-madi" />
      <div className="bl-why-text">{children}</div>
    </div>
  );
}

/**
 * The "not yet" help of an explore step: its first sentence, and the rest behind "עוד", so the sheet stays short and
 * the object above it stays in view (STUDENT-9 §2).
 */
function ShortHint({ text }) {
  const [first, rest] = splitFirstSentence(text);
  const [more, setMore] = useState(false);
  const restRef = useRef(null);
  // the button goes away once pressed: the focus moves to the text it opened, so a keyboard keeps its place
  useEffect(() => { if (more) restRef.current?.focus({ preventScroll: true }); }, [more]);
  return (
    <>
      <p>
        <MathText text={first} />
        {rest && !more && <>{' '}<button type="button" className="link-btn" data-inline onClick={() => setMore(true)}>עוד</button></>}
      </p>
      {rest && more && <p ref={restRef} tabIndex={-1} className="bl-why-more"><MathText text={rest} /></p>}
    </>
  );
}

/** The canvas: where the maths is. Shown only when there is something to see. */
export function Canvas({ display, fig, big = true, children, label }) {
  if (!display && !fig && !children) return null;
  return (
    <div className={clsx('lm-canvas', big && 'big')} aria-label={label} data-region="visual">
      {display && <FitDisplay className="lm-expr" tex={display} />}
      {fig && <div className="lm-fig"><Figure fig={fig} /></div>}
      {children}
    </div>
  );
}

function Say({ step }) {
  return (
    <>
      <Prompt><p><MathText text={step.text} /></p></Prompt>
      <Canvas display={step.display} fig={step.fig} />
    </>
  );
}

/** An answer that is a sentence ("המאזניים יישארו מאוזנים") gets the full width: in half a row it wraps to three lines. */
const LONG_CHOICE = 16;
function Predict({ step, chosen, sel, onSelect }) {
  const locked = chosen != null;
  const long = step.choices.some((c) => mathPlain(c).length > LONG_CHOICE);
  return (
    <>
      <Prompt tag="מה לדעתכם?"><p><MathText text={step.text} /></p></Prompt>
      <Canvas display={step.display} fig={step.fig} />
      <div className="lm-response" data-region="answers">
        <div className={clsx('ls-choices', long && 'long')} role="radiogroup" aria-label="מה לדעתכם?">
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
      <Prompt tag="נסו בעצמכם"><p><MathText text={step.text} /></p></Prompt>
      <Canvas display={step.display ? `${step.display}${step.manip.kind === 'numberline' ? ' = \\,?' : ''}` : null}>
        {C ? <C m={step.manip} value={v} onChange={(x) => { setV(x); setTouched(true); if (miss > 0) setMiss(0); }} locked={ok} reveal={false} good={ok} answer={step.answer} hint={miss > 0} /> : <p className="form-error">האובייקט הזה לא זמין.</p>}
      </Canvas>
    </div>
  );
}

function Rule({ step }) {
  return (
    <>
      <Prompt tag="הכלל"><p className="lm-rule-text"><MathText text={step.text} /></p></Prompt>
      <Canvas display={step.display} fig={step.fig} />
      <div className="lm-response"><div className="lm-why"><p className="lm-why-title"><Sparkles size={16} aria-hidden="true" />למה זה עובד?</p><p><MathText text={step.why} /></p></div></div>
    </>
  );
}

/**
 * steps: DiscoverStep[]; start: the step to open on; onIndex(i): where the student is (saved, so leaving keeps it);
 * onDone(): after the last step. label: what this run is (for the progress). renderHead(bar): the screen's header
 * row with this run's progress bar in it (without it, the bar stands on its own). title/kicker: the lesson's name,
 * shown on its first screen.
 */
export default function StepPlayer({ steps, start = 0, onIndex, onDone, label = 'שלב', doneLabel = 'סיימתי', renderHead, title, kicker }) {
  const [i, setI] = useState(Math.min(start, steps.length - 1));
  const [answers, setAnswers] = useState({}); // step index → chosen (predict) or true (explore done)
  const [sel, setSel] = useState({}); // predict: the card picked, before it is checked
  const [ctl, setCtl] = useState(null); // explore: what the bottom button checks
  const [why, setWhy] = useState(null); // the step whose explanation is open ("למה?")
  const ref = useRef(null);
  const rootRef = useRef(null);
  const footRef = useRef(null);
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
  // the result sheet: green when right, yellow (not red) when not yet, with the explanation in מדי's words
  const result = step.kind === 'predict' && answers[i] != null
    ? (answers[i] === step.answer
      ? { tone: 'good', title: 'נכון!', body: <p><MathText text={step.why} /></p> }
      : { tone: 'warm', title: 'ניחוש טוב לבדוק. הנה מה שקורה', body: <>{step.wrongWhy?.[answers[i]] && <p><MathText text={step.wrongWhy[answers[i]]} /></p>}<p><MathText text={step.why} /></p></> })
    : step.kind === 'explore' && answers[i] ? { tone: 'good', title: 'יפה! בדיוק כך', body: <p><MathText text={step.success} /></p> }
      : step.kind === 'explore' && exp?.miss > 0 ? { tone: 'warm', title: 'עוד לא. הזיזו ונסו שוב', body: <ShortHint key={`${i}-${exp.miss}`} text={step.hint} /> } : null;
  // The bottom (the button and the result sheet) stays on screen over the step; its height is kept in --foot-h, so a
  // step's object can be scrolled to sit above it (STUDENT-9 §2: the number line's buttons were under the sheet).
  useLayoutEffect(() => {
    const root = rootRef.current; const foot = footRef.current;
    if (!root || !foot) return undefined;
    const set = () => root.style.setProperty('--foot-h', `${foot.offsetHeight}px`);
    set();
    if (typeof ResizeObserver !== 'function') return undefined;
    const ro = new ResizeObserver(set);
    ro.observe(foot);
    return () => ro.disconnect();
  }, []);
  // "not yet" on an explore step: bring the object up above the sheet, to be moved again. Its bottom (where the
  // buttons are) is what must show: on a small phone the whole panel may not fit, and its top then goes under the header.
  const missed = step.kind === 'explore' && !answers[i] ? exp?.miss || 0 : 0;
  useEffect(() => {
    if (!missed) return undefined;
    const raf = requestAnimationFrame(() => rootRef.current?.querySelector('.ls-explore .lm-canvas')?.scrollIntoView({ block: 'end' }));
    return () => cancelAnimationFrame(raf);
  }, [missed, i]);
  const bar = <Segments steps={steps.length} done={i} current={i} size="thin" className="sp-progress" label={label} valueText={`צעד ${i + 1} מתוך ${steps.length}`} />;
  return (
    <div className="step-player lm" ref={rootRef}>
      {renderHead ? renderHead(bar) : (
        <div className="lm-progress">{bar}<span className="lm-count" aria-hidden="true">{i + 1}/{steps.length}</span></div>
      )}
      <AnimatePresence mode="wait" initial={false}>
        <m.section key={i} ref={ref} tabIndex={-1} className={clsx('sp-step', 'lm-card', `sp-${step.kind}`)} aria-label={`צעד ${i + 1} מתוך ${steps.length}`} data-region="content"
          initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }} transition={enter(0.22)}>
          {i === 0 && title && <div className="bl-intro"><h1 className="bl-title">{title}</h1>{kicker && <p className="bl-kicker">{kicker}</p>}</div>}
          {step.kind === 'say' && <Say step={step} />}
          {step.kind === 'predict' && <Predict step={step} chosen={answers[i]} sel={sel[i]} onSelect={(c) => setSel((x) => ({ ...x, [i]: c }))} />}
          {step.kind === 'explore' && <Explore step={step} done={!!answers[i]} onDone={() => setAnswers((a) => ({ ...a, [i]: true }))} onCtl={setCtl} />}
          {step.kind === 'rule' && <Rule step={step} />}
        </m.section>
      </AnimatePresence>
      <footer ref={footRef} className={clsx('lm-actions', 'sp-nav', result && `has-${result.tone}`)} data-region="footer">
        {result && (
          <m.div key={`${i}-${result.tone}`} className="bl-result" role="status" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={enter(0.22)}>
            <p className="lm-banner"><span className="lm-banner-icon" aria-hidden="true">{result.tone === 'good' ? <Check size={18} strokeWidth={3.4} /> : <Lightbulb size={18} />}</span>{result.title}</p>
            {/* as in Brilliant: when right, the explanation waits behind "למה?"; when not yet, it is the help itself */}
            {(result.tone !== 'good' || why === i) && <ResultWhy tone={result.tone}>{result.body}</ResultWhy>}
          </m.div>
        )}
        <div className="lm-actions-row">
          {result?.tone === 'good' && why !== i
            ? <Button variant="secondary" className="bl-why-btn" onClick={() => setWhy(i)}>למה?</Button>
            : i === 0
              ? <span className="icon-btn-spacer" aria-hidden="true" /> /* nothing before the first step: no button that only looks active */
              : <Button variant="ghost" className="sp-back" onClick={() => setI(i - 1)} aria-label="הצעד הקודם"><ArrowRight size={18} aria-hidden="true" />הקודם</Button>}
          {checking
            ? <Button className="lm-check btn-lg" onClick={check} disabled={!canCheck} data-region="primary">בדיקה</Button>
            : <Button className="sp-next btn-lg" onClick={go} data-region="primary">{last ? doneLabel : step.kind === 'say' ? 'הבנתי' : 'המשך'}{!last && <ArrowLeft size={18} aria-hidden="true" />}</Button>}
        </div>
      </footer>
    </div>
  );
}
