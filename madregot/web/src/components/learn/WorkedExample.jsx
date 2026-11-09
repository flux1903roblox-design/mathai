// Stage B: a worked example, revealed one step at a time (a Brilliant-style step-by-step solution). Each step is the action, what it gives, and why.
// The steps already seen stay on the page (to look back at), "הקודם" hides the last one again, and the whole
// example can be replayed from the start. The full solution is never shown at once.
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, m } from 'motion/react';
import clsx from 'clsx';
import { ArrowLeft, ArrowRight, Check, RotateCcw } from 'lucide-react';
import { Tex, MathText } from '@/components/MathText.jsx';
import { Button } from '@/components/ui.jsx';
import { Prompt } from './StepPlayer.jsx';
import { enter } from '@/lib/motion.js';
import { T, plainNum } from '@/content/util.js';

export default function WorkedExample({ example, n, of, onDone, doneLabel = 'הבנתי, הלאה', decimal = false }) {
  const [shown, setShown] = useState(0); // how many steps are shown
  const endRef = useRef(null);
  const total = example.steps.length;
  useEffect(() => { if (shown) endRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }); }, [shown]);
  const all = shown >= total;
  return (
    <div className="worked lm">
      <section className="lm-card">
      <Prompt mood={all ? 'happy' : 'thinking'} tag={`דוגמה ${n} מתוך ${of}`}>
          <p><MathText text={example.problem} /></p>
        </Prompt>
      <div className="lm-canvas big">
      {example.display && <div className="lm-expr"><Tex tex={example.display} display /></div>}
      <ol className="worked-steps" aria-live="polite">
        <AnimatePresence initial={false}>
          {example.steps.slice(0, shown).map((s, i) => (
            <m.li key={i} className="worked-step" style={{ '--i': i }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={enter(0.22)}>
              <span className="stair-n" aria-hidden="true">{i + 1}</span>
              <div className="worked-body">
                <p className="worked-action"><MathText text={s.action} /></p>
                <div className="worked-result"><Tex tex={s.result} /></div>
                <p className="worked-why"><span className="worked-why-tag">למה?</span> <MathText text={s.why} /></p>
              </div>
            </m.li>
          ))}
        </AnimatePresence>
      </ol>
      </div>
      <div ref={endRef} />
      {all && <p className="ls-why good" role="status">והתשובה: <Tex tex={decimal && !Number.isInteger(example.answer) ? plainNum(example.answer, { decimal: true }) : T(example.answer)} /></p>}
      {all && <button type="button" className="link-btn worked-again" onClick={() => setShown(0)}><RotateCcw size={16} aria-hidden="true" />שוב מההתחלה</button>}
      </section>
      <footer className={clsx('lm-actions', 'sp-nav', all && 'has-good')}>
        {all && <p className="lm-banner" role="status"><span className="lm-banner-icon" aria-hidden="true"><Check size={18} strokeWidth={3.4} /></span>זו כל הדרך</p>}
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
