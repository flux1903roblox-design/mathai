// A challenge part that asks for a number: typed with the lesson's keypad, checked by code, two tries, then the solution.
import { useState } from 'react';
import { MathText } from '@/components/MathText.jsx';
import { play } from '@/lib/sound.js';
import { numCheck } from '@/learn/challenges/grade.ts';
import { useTries, resultOf, PartFooter, Lines, NumFields, CHECK, GO_ON } from './common.jsx';

export default function NumPart({ part, onDone, last }) {
  const [values, setValues] = useState({ v: '' });
  const t = useTries();
  const typed = values.v || '';
  const readable = !!numCheck(part.answer, typed);
  const check = () => {
    const r = numCheck(part.answer, typed);
    if (!r) return;
    if (r.ok) { t.right(); play('correct'); } else { t.miss(); play('wrong'); }
  };
  const result = resultOf(t.state, {
    good: <Lines lines={part.solution} />,
    retry: null,
    shown: <><p><MathText text={`התשובה: $${part.answer}$${part.unit ? ` ${part.unit}` : ''}.`} /></p><Lines lines={part.solution} /></>,
  });
  return (
    <>
      <div className="lm-prompt ch-prompt" data-region="question"><div className="lm-say"><p><MathText text={part.prompt} /></p></div></div>
      <NumFields fields={[{ name: 'v', label: 'התשובה', unit: part.unit }]} values={values} locked={t.done}
        state={t.state === 'good' ? 'good' : t.state === 'retry' ? 'bad' : null}
        onChange={(v) => { setValues(v); t.again(); }} onEnter={() => { if (!t.done && readable) check(); }} />
      <PartFooter result={result} label={t.done ? (last ? 'לסיום' : GO_ON) : CHECK} disabled={!t.done && !readable}
        onClick={t.done ? () => onDone(t.first) : check} />
    </>
  );
}
