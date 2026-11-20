// A challenge part with one right choice: each choice has its own feedback; two tries, then the right one is shown.
import { useState } from 'react';
import clsx from 'clsx';
import { Check, X } from 'lucide-react';
import { MathText, mathPlain } from '@/components/MathText.jsx';
import { play } from '@/lib/sound.js';
import { useTries, resultOf, PartFooter, CHECK, GO_ON } from './common.jsx';

/** One right choice among several, as a radio group of the lesson's choice cards. */
export function Choices({ label, choices, sel, onSelect, tried = [], right = null, locked = false }) {
  return (
    <div className="ls-choices long ch-choices" role="radiogroup" aria-label={mathPlain(label)}>
      {choices.map((text, i) => {
        const state = right === i ? 'good' : tried.includes(i) ? 'bad' : '';
        const on = sel === i;
        return (
          <button key={i} type="button" role="radio" aria-checked={on} aria-label={mathPlain(text)} disabled={locked || tried.includes(i)}
            className={clsx('choice', 'ls-choice', state, on && 'on')} onClick={() => { onSelect(i); play('tap'); }}>
            <span className="choice-key" aria-hidden="true">{state === 'good' ? <Check size={18} strokeWidth={3.4} /> : state === 'bad' ? <X size={18} strokeWidth={3.4} /> : i + 1}</span>
            <span className="choice-text"><MathText text={text} /></span>
          </button>
        );
      })}
    </div>
  );
}

export default function McPart({ part, onDone, last }) {
  const [sel, setSel] = useState(null);
  const [tried, setTried] = useState([]);
  const t = useTries();
  const ok = part.choices.findIndex((c) => c.ok);
  const check = () => {
    if (sel == null) return;
    if (part.choices[sel].ok) { t.right(); play('correct'); return; }
    setTried([...tried, sel]); setSel(null); t.miss(); play('wrong');
  };
  const lastWrong = tried[tried.length - 1];
  const result = resultOf(t.state, {
    good: <p><MathText text={part.choices[ok].feedback} /></p>,
    retry: lastWrong != null && <p><MathText text={part.choices[lastWrong].feedback} /></p>,
    shown: <>{lastWrong != null && <p><MathText text={part.choices[lastWrong].feedback} /></p>}<p><MathText text={part.choices[ok].feedback} /></p></>,
  });
  return (
    <>
      <div className="lm-prompt ch-prompt" data-region="question"><div className="lm-say"><p><MathText text={part.prompt} /></p></div></div>
      <div className="lm-response" data-region="answers">
        <Choices label={part.prompt} choices={part.choices.map((c) => c.text)} sel={t.done ? null : sel} tried={tried}
          right={t.done ? ok : null} locked={t.done} onSelect={(i) => { setSel(i); t.again(); }} />
      </div>
      <PartFooter result={result} label={t.done ? (last ? 'לסיום' : GO_ON) : CHECK} disabled={!t.done && sel == null}
        onClick={t.done ? () => onDone(t.first) : check} />
    </>
  );
}
