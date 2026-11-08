// Stage B: a worked example, revealed one step at a time. Each step is the action, what it gives, and why.
// The steps already seen stay on the page (to look back at), "הקודם" hides the last one again, and the whole
// example can be replayed from the start. The full solution is never shown at once.
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { ArrowLeft, ArrowRight, RotateCcw } from 'lucide-react';
import { Tex, MathText } from '@/components/MathText.jsx';
import { Button } from '@/components/ui.jsx';
import Mascot from '@/components/Mascot.jsx';
import { enter } from '@/lib/motion.js';
import { T, plainNum } from '@/content/util.js';

export default function WorkedExample({ example, n, of, onDone, doneLabel = 'הבנתי, הלאה', decimal = false }) {
  const [shown, setShown] = useState(0); // how many steps are shown
  const endRef = useRef(null);
  const total = example.steps.length;
  useEffect(() => { if (shown) endRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }); }, [shown]);
  const all = shown >= total;
  return (
    <div className="worked">
      <div className="ls-say">
        <Mascot mood={all ? 'happy' : 'thinking'} size={64} className="ls-mascot" />
        <div className="ls-bubble">
          <p className="worked-of">דוגמה {n} מתוך {of}</p>
          <p><MathText text={example.problem} /></p>
        </div>
      </div>
      {example.display && <div className="ls-display big"><Tex tex={example.display} display /></div>}
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
      <div ref={endRef} />
      {all && <p className="ls-why good" role="status">והתשובה: <Tex tex={decimal && !Number.isInteger(example.answer) ? plainNum(example.answer, { decimal: true }) : T(example.answer)} /></p>}
      <div className="sp-nav">
        <Button variant="ghost" onClick={() => setShown(Math.max(0, shown - 1))} disabled={shown === 0} aria-label="להסתיר את הצעד האחרון"><ArrowRight size={18} aria-hidden="true" />הקודם</Button>
        {all
          ? <Button className="btn-lg" onClick={onDone}>{doneLabel}<ArrowLeft size={18} aria-hidden="true" /></Button>
          : <Button className="btn-lg" onClick={() => setShown(shown + 1)}>{shown === 0 ? 'מתחילים' : 'הצעד הבא'}<ArrowLeft size={18} aria-hidden="true" /></Button>}
      </div>
      {all && <button type="button" className="link-btn worked-again" onClick={() => setShown(0)}><RotateCcw size={16} aria-hidden="true" />שוב מההתחלה</button>}
    </div>
  );
}
