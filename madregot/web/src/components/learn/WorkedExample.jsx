// Stage B: a worked example, revealed one step at a time (a Brilliant-style step-by-step solution). Each step is the action, what it gives, and why.
// The steps already seen stay on the page (to look back at), "הקודם" hides the last one again, and the whole
// example can be replayed from the start. The full solution is never shown at once.
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, m } from 'motion/react';
import clsx from 'clsx';
import { ArrowLeft, ArrowRight, Check, RotateCcw } from 'lucide-react';
import { Tex, MathText, FitDisplay } from '@/components/MathText.jsx';
import { Button } from '@/components/ui.jsx';
import { Prompt, ResultWhy } from './StepPlayer.jsx';
import { Segments } from '@/components/ds.jsx';
import { enter } from '@/lib/motion.js';
import { T, plainNum } from '@/content/util.js';

export default function WorkedExample({ example, n, of, onDone, doneLabel = 'הבנתי, הלאה', decimal = false, renderHead }) {
  const [shown, setShown] = useState(0); // how many steps are shown
  const endRef = useRef(null);
  const total = example.steps.length;
  useEffect(() => { if (shown) endRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }); }, [shown]);
  const all = shown >= total;
  const bar = <Segments steps={total} done={shown} current={shown} size="thin" label={`דוגמה ${n} מתוך ${of}`} valueText={`${shown} מתוך ${total} צעדים`} />;
  return (
    <div className="worked lm">
      {renderHead ? renderHead(bar) : <div className="lm-progress">{bar}</div>}
      <section className="lm-card" data-region="content">
      <Prompt tag={`דוגמה ${n} מתוך ${of}`}>
          <p><MathText text={example.problem} /></p>
        </Prompt>
      <div className="lm-canvas big" data-region="visual">
      {example.display && <FitDisplay className="lm-expr" tex={example.display} />}
      <ol className="worked-steps" aria-live="polite">
        <AnimatePresence initial={false}>
          {example.steps.slice(0, shown).map((s, i) => (
            <m.li key={i} className="worked-step" style={{ '--i': i }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={enter(0.22)}>
              <span className="stair-n" aria-hidden="true">{i + 1}</span>
              <div className="worked-body">
                <p className="worked-action"><MathText text={s.action} /></p>
                {/* set smaller until it fits a 320 phone, never a sideways scroll inside the box */}
                <FitDisplay className="worked-result" tex={s.result} />
                <p className="worked-why"><span className="worked-why-tag">למה?</span> <MathText text={s.why} /></p>
              </div>
            </m.li>
          ))}
        </AnimatePresence>
      </ol>
      </div>
      <div ref={endRef} />
      {all && <button type="button" className="link-btn worked-again" onClick={() => setShown(0)}><RotateCcw size={16} aria-hidden="true" />שוב מההתחלה</button>}
      </section>
      <footer className={clsx('lm-actions', 'sp-nav', all && 'has-good')} data-region="footer">
        {all && (
          <div className="bl-result" role="status">
            <p className="lm-banner"><span className="lm-banner-icon" aria-hidden="true"><Check size={18} strokeWidth={3.4} /></span>זו כל הדרך</p>
            <ResultWhy tone="good"><p className="worked-answer">והתשובה: <Tex tex={example.answerTex || (decimal && !Number.isInteger(example.answer) ? plainNum(example.answer, { decimal: true }) : T(example.answer))} /></p></ResultWhy>
          </div>
        )}
        <div className="lm-actions-row">
          <Button variant="ghost" onClick={() => setShown(Math.max(0, shown - 1))} disabled={shown === 0} aria-label="להסתיר את הצעד האחרון"><ArrowRight size={18} aria-hidden="true" />הקודם</Button>
          {all
            ? <Button className="btn-lg" onClick={onDone}>{doneLabel}<ArrowLeft size={18} aria-hidden="true" /></Button>
            : <Button className="btn-lg" onClick={() => setShown(shown + 1)}>{shown === 0 ? 'מתחילים' : 'הצעד הבא'}<ArrowLeft size={18} aria-hidden="true" /></Button>}
        </div>
      </footer>
    </div>
  );
}
