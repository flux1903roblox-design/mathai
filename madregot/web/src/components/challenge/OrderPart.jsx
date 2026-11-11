// A proof to put in order (CURRICULUM-6.1): its steps are shown shuffled (a seeded shuffle that is never a right order),
// and the student moves them with ↑/↓ buttons, 44px and labelled, so a keyboard and a screen reader do it all (there is
// no drag: the buttons are the whole method). "בדיקה" marks the first step out of place. Then each step that has a
// reason asks for it, as a choice.
import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { MathText, mathPlain } from '@/components/MathText.jsx';
import { play } from '@/lib/sound.js';
import { firstOutOfPlace, shuffledOrder, moveStep } from '@/learn/challenges/grade.ts';
import { useTries, resultOf, PartFooter, CHECK, GO_ON } from './common.jsx';
import { Choices } from './McPart.jsx';

/** One reason to choose: two tries, then the right one. */
function Reason({ step, n, onDone, last }) {
  const [sel, setSel] = useState(null);
  const [tried, setTried] = useState([]);
  const t = useTries();
  const { choices, answer } = step.reason;
  const check = () => { if (sel == null) return; if (sel === answer) { t.right(); play('correct'); } else { setTried([...tried, sel]); setSel(null); t.miss(); play('wrong'); } };
  const result = resultOf(t.state, { good: null, retry: null, shown: <p><MathText text={`הנימוק: ${choices[answer]}.`} /></p> });
  return (
    <>
      <div className="ch-reason">
        <p className="ch-sub">{`למה? (שלב ${n})`}</p>
        <p className="ch-reason-step"><MathText text={step.text} /></p>
        <Choices label={`למה? ${mathPlain(step.text)}`} choices={choices} sel={t.done ? null : sel} tried={tried} right={t.done ? answer : null}
          locked={t.done} onSelect={(i) => { setSel(i); t.again(); }} />
      </div>
      <PartFooter result={result} label={t.done ? (last ? 'לסיום' : GO_ON) : CHECK} disabled={!t.done && sel == null}
        onClick={t.done ? () => onDone(t.first) : check} />
    </>
  );
}

export default function OrderPart({ part, seed, onDone, last }) {
  const [order, setOrder] = useState(() => shuffledOrder(part, seed));
  const [mark, setMark] = useState(-1); // the place "בדיקה" found out of order
  const [focus, setFocus] = useState(null); // after a move: the button to keep the focus on
  const [said, setSaid] = useState(''); // what a screen reader hears after a move: the step and its new place
  const [phase, setPhase] = useState('order');
  const [reasonAt, setReasonAt] = useState(0);
  const [firsts, setFirsts] = useState([]);
  const t = useTries();
  const btns = useRef({});
  const withReason = part.steps.map((s, i) => (s.reason ? i : -1)).filter((i) => i >= 0);
  const marked = useRef(null);
  useEffect(() => { if (focus) btns.current[focus]?.focus(); }, [order, focus]);
  // the step "בדיקה" marked comes into view (the list can be taller than the screen)
  useEffect(() => { if (mark >= 0) marked.current?.scrollIntoView?.({ block: 'nearest' }); }, [mark]);

  const move = (place, dir) => {
    const next = moveStep(order, place, dir);
    if (next === order) return;
    setOrder(next); setMark(-1); t.again(); play('tap');
    const step = order[place]; const to = place + dir;
    setSaid(`${mathPlain(part.steps[step].text)} עכשיו במקום ${to + 1} מתוך ${order.length}.`);
    // keep the focus on the moved step: the same button, or the other one at the end of the list
    const edge = (dir < 0 && to === 0) || (dir > 0 && to === order.length - 1);
    setFocus(`${step}-${edge ? (dir < 0 ? 'down' : 'up') : dir < 0 ? 'up' : 'down'}`);
  };
  const check = () => {
    const wrong = firstOutOfPlace(part, order);
    if (wrong === -1) { t.right(); setMark(-1); play('correct'); return; }
    setMark(wrong); t.miss(); play('wrong');
    if (t.misses + 1 >= 2) { setOrder(part.steps.map((_, i) => i)); setMark(-1); }
  };
  const afterOrder = () => { if (withReason.length) setPhase('reasons'); else onDone(t.first); };
  const afterReason = (first) => {
    const f = [...firsts, first];
    if (reasonAt + 1 < withReason.length) { setFirsts(f); setReasonAt(reasonAt + 1); } else onDone(t.first && f.every(Boolean));
  };

  if (phase === 'reasons') {
    const at = withReason[reasonAt];
    return (
      <>
        <div className="lm-prompt ch-prompt" data-region="question"><div className="lm-say"><p>ועכשיו הנימוקים.</p></div></div>
        <ol className="ch-order done" aria-label="ההוכחה">
          {part.steps.map((s, i) => <li key={i} className={clsx('ch-step', i === at && 'now')}><span className="ch-step-n" aria-hidden="true">{i + 1}</span><span className="ch-step-text"><MathText text={s.text} /></span></li>)}
        </ol>
        <Reason key={at} step={part.steps[at]} n={at + 1} onDone={afterReason} last={last && reasonAt === withReason.length - 1} />
      </>
    );
  }

  const result = resultOf(t.state, { good: null, retry: <p>השלב המסומן עוד לא במקום. הזיזו ובדקו שוב.</p>, shown: <p>כך נראית ההוכחה, שלב אחרי שלב.</p> });
  return (
    <>
      <div className="lm-prompt ch-prompt" data-region="question"><div className="lm-say"><p><MathText text={part.prompt} /></p></div></div>
      <ol className="ch-order" aria-label="שלבי ההוכחה">
        {order.map((step, place) => {
          const text = part.steps[step].text; const id = `ch-step-${step}`;
          return (
            <li key={step} ref={mark === place ? marked : undefined} className={clsx('ch-step', mark === place && 'off', t.done && 'set')} aria-current={mark === place ? 'step' : undefined}>
              <span className="ch-step-n" aria-hidden="true">{place + 1}</span>
              <span className="ch-step-text" id={id}><MathText text={text} /></span>
              {!t.done && (
                <span className="ch-step-moves">
                  <button type="button" className="icon-btn ch-move" aria-label="הזיזו למעלה" aria-describedby={id} disabled={place === 0}
                    ref={(el) => { btns.current[`${step}-up`] = el; }} onClick={() => move(place, -1)}><ArrowUp size={20} aria-hidden="true" /></button>
                  <button type="button" className="icon-btn ch-move" aria-label="הזיזו למטה" aria-describedby={id} disabled={place === order.length - 1}
                    ref={(el) => { btns.current[`${step}-down`] = el; }} onClick={() => move(place, 1)}><ArrowDown size={20} aria-hidden="true" /></button>
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <p className="visually-hidden" aria-live="polite">{said}</p>
      <PartFooter result={result} label={t.done ? (last && !withReason.length ? 'לסיום' : GO_ON) : CHECK}
        onClick={t.done ? afterOrder : check} />
    </>
  );
}
