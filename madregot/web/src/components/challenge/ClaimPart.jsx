// A claim to judge (CURRICULUM-6.1): always true, sometimes, or never (a segmented control). When it is not always
// true and the part has an example, the student then gives a counterexample in its slots; code evaluates the part's
// expression there (learn/expr.ts) and accepts the values when the relation holds and they are in the domain.
import { useState } from 'react';
import clsx from 'clsx';
import { MathText, mathPlain } from '@/components/MathText.jsx';
import { play } from '@/lib/sound.js';
import { parseNum } from '@/content/util.js';
import { exampleHolds } from '@/learn/challenges/grade.ts';
import { useTries, resultOf, PartFooter, NumFields, CHECK, GO_ON } from './common.jsx';

export const VERDICTS = [['always', 'תמיד נכון'], ['sometimes', 'לפעמים'], ['never', 'אף פעם']];
const verdictWord = (v) => VERDICTS.find(([k]) => k === v)?.[1] || '';

export default function ClaimPart({ part, onDone, last }) {
  const ex = part.verdict !== 'always' ? part.example : null;
  const [phase, setPhase] = useState('verdict'); // then 'example', when there is one
  const [sel, setSel] = useState(null);
  const [values, setValues] = useState({});
  const v = useTries();
  const e = useTries();
  const parsed = ex ? Object.fromEntries(ex.slots.map((s) => [s.name, parseNum(values[s.name])])) : {};
  const filled = ex ? ex.slots.every((s) => parsed[s.name] != null) : false;

  const checkVerdict = () => { if (sel == null) return; if (sel === part.verdict) { v.right(); play('correct'); } else { v.miss(); play('wrong'); } };
  const checkExample = () => { if (!filled) return; if (exampleHolds(ex, parsed)) { e.right(); play('correct'); } else { e.miss(); play('wrong'); } };

  const onVerdict = phase === 'verdict';
  const result = onVerdict
    ? resultOf(v.state, {
      good: <p><MathText text={part.why} /></p>,
      retry: null,
      shown: <><p>{`הטענה: ${verdictWord(part.verdict)}.`}</p><p><MathText text={part.why} /></p></>,
    })
    : resultOf(e.state, {
      good: <p><MathText text={part.why} /></p>,
      retry: <p><MathText text={ex.hint} /></p>,
      shown: <><p><MathText text={ex.hint} /></p><p><MathText text={part.why} /></p></>,
    });
  const t = onVerdict ? v : e;
  const go = () => {
    if (onVerdict && ex) { setPhase('example'); return; }
    onDone(v.first && (!ex || e.first));
  };
  const label = t.done ? (last && !(onVerdict && ex) ? 'לסיום' : GO_ON) : CHECK;
  return (
    <>
      <div className="lm-prompt ch-prompt" data-region="question"><div className="lm-say"><p><MathText text={part.prompt} /></p></div></div>
      <blockquote className="ch-claim"><MathText text={part.claim} /></blockquote>
      <div className="ch-seg" role="radiogroup" aria-label={mathPlain(part.prompt)}>
        {VERDICTS.map(([k, word]) => {
          const shown = v.done && k === part.verdict;
          const on = onVerdict && !v.done ? sel === k : (v.state === 'good' && k === part.verdict);
          return (
            <button key={k} type="button" role="radio" aria-checked={on || shown} disabled={v.done}
              className={clsx('ch-seg-opt', on && 'on', shown && 'good', v.state === 'retry' && sel === k && 'bad')}
              onClick={() => { setSel(k); v.again(); play('tap'); }}>{word}</button>
          );
        })}
      </div>
      {!onVerdict && ex && (
        <section className="ch-example" aria-labelledby="ch-example-title">
          <h3 id="ch-example-title" className="ch-sub">תנו דוגמה</h3>
          <p className="ch-ask"><MathText text={ex.ask} /></p>
          <NumFields fields={ex.slots.map((s) => ({ name: s.name, label: s.label }))} values={values} locked={e.done}
            state={e.state === 'good' ? 'good' : e.state === 'retry' ? 'bad' : null}
            onChange={(x) => { setValues(x); e.again(); }} onEnter={() => { if (!e.done && filled) checkExample(); }} />
        </section>
      )}
      <PartFooter result={result} label={label}
        disabled={!t.done && (onVerdict ? sel == null : !filled)}
        onClick={t.done ? go : onVerdict ? checkVerdict : checkExample} />
    </>
  );
}
