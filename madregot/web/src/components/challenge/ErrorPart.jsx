// Someone's solution with a mistake in it (CURRICULUM-6.1): its lines are a radio group ("איזו שורה שגויה?"); after the
// wrong line is found (or shown), the student types the right value. Two tries for each.
import { useState } from 'react';
import clsx from 'clsx';
import { Check, X } from 'lucide-react';
import { MathText, mathPlain } from '@/components/MathText.jsx';
import { play } from '@/lib/sound.js';
import { numCheck } from '@/learn/challenges/grade.ts';
import { useTries, resultOf, PartFooter, NumFields, CHECK, GO_ON } from './common.jsx';

export const WHICH_LINE = 'איזו שורה שגויה?';

export default function ErrorPart({ part, onDone, last }) {
  const [phase, setPhase] = useState('line'); // then 'fix'
  const [sel, setSel] = useState(null);
  const [tried, setTried] = useState([]);
  const [values, setValues] = useState({ v: '' });
  const line = useTries();
  const fix = useTries();
  const onLine = phase === 'line';
  const readable = !!numCheck(part.fix.answer, values.v || '');

  const checkLine = () => {
    if (sel == null) return;
    if (sel === part.wrong) { line.right(); play('correct'); return; }
    setTried([...tried, sel]); setSel(null); line.miss(); play('wrong');
  };
  const checkFix = () => {
    const r = numCheck(part.fix.answer, values.v || '');
    if (!r) return;
    if (r.ok) { fix.right(); play('correct'); } else { fix.miss(); play('wrong'); }
  };
  const result = onLine
    ? resultOf(line.state, { good: <p><MathText text={part.why} /></p>, retry: null, shown: <><p>{`השורה השגויה היא שורה ${part.wrong + 1}.`}</p><p><MathText text={part.why} /></p></> })
    : resultOf(fix.state, { good: null, retry: null, shown: <p><MathText text={`התשובה: $${part.fix.answer}$.`} /></p> });
  const t = onLine ? line : fix;
  return (
    <>
      <div className="lm-prompt ch-prompt" data-region="question"><div className="lm-say"><p><MathText text={part.prompt} /></p></div></div>
      <p className="ch-sub" id="ch-which">{WHICH_LINE}</p>
      <div className="ch-lines" role="radiogroup" aria-labelledby="ch-which">
        {part.lines.map((text, i) => {
          const state = line.done && i === part.wrong ? 'found' : tried.includes(i) ? 'tried' : '';
          const on = !line.done && sel === i;
          return (
            <button key={i} type="button" role="radio" aria-checked={on || (line.done && i === part.wrong)} aria-label={`שורה ${i + 1}: ${mathPlain(text)}`}
              disabled={line.done || tried.includes(i)} className={clsx('ch-line', state, on && 'on')}
              onClick={() => { setSel(i); line.again(); play('tap'); }}>
              <span className="ch-line-n" aria-hidden="true">{state === 'found' ? <Check size={16} strokeWidth={3.4} /> : state === 'tried' ? <X size={16} strokeWidth={3.4} /> : i + 1}</span>
              <span className="ch-line-text"><MathText text={text} /></span>
            </button>
          );
        })}
      </div>
      {!onLine && (
        <section className="ch-fix" aria-labelledby="ch-fix-title">
          <p className="ch-ask" id="ch-fix-title"><MathText text={part.fix.prompt} /></p>
          <NumFields fields={[{ name: 'v', label: mathPlain(part.fix.prompt) }]} values={values} locked={fix.done}
            state={fix.state === 'good' ? 'good' : fix.state === 'retry' ? 'bad' : null}
            onChange={(v) => { setValues(v); fix.again(); }} onEnter={() => { if (!fix.done && readable) checkFix(); }} />
        </section>
      )}
      <PartFooter result={result} label={t.done ? (last && !onLine ? 'לסיום' : GO_ON) : CHECK}
        disabled={!t.done && (onLine ? sel == null : !readable)}
        onClick={t.done ? (onLine ? () => setPhase('fix') : () => onDone(line.first && fix.first)) : onLine ? checkLine : checkFix} />
    </>
  );
}
