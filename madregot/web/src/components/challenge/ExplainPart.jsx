// An explanation in the student's own words (CURRICULUM-6.1). The text lives in this component's state only: it is not
// saved, not in analytics and never sent anywhere. "סיימתי" shows the sample answer and the rubric as a list the student
// ticks for themselves ("בדקו את התשובה שלכם"): a self-check, with no score.
import { useId, useState } from 'react';
import { MathText } from '@/components/MathText.jsx';
import { PartFooter, GO_ON } from './common.jsx';

export default function ExplainPart({ part, onDone, last }) {
  const [text, setText] = useState('');
  const [shown, setShown] = useState(false);
  const [ticks, setTicks] = useState({});
  const id = useId();
  return (
    <>
      <div className="lm-prompt ch-prompt" data-region="question"><div className="lm-say"><p id={`${id}-q`}><MathText text={part.prompt} /></p></div></div>
      <textarea className="input ch-explain" rows={5} value={text} readOnly={shown} aria-labelledby={`${id}-q`}
        placeholder="כתבו כאן, במילים שלכם" onChange={(e) => setText(e.target.value)} />
      {shown && (
        <section className="ch-check" aria-labelledby={`${id}-c`}>
          <h3 className="ch-sub" id={`${id}-c`}>בדקו את התשובה שלכם</h3>
          <ul className="ch-rubric">
            {part.rubric.map((r, i) => (
              <li key={i}>
                <label className="ch-tick">
                  <input type="checkbox" checked={!!ticks[i]} onChange={(e) => setTicks({ ...ticks, [i]: e.target.checked })} />
                  <span><MathText text={r} /></span>
                </label>
              </li>
            ))}
          </ul>
          <div className="ch-sample"><p className="ch-sample-tag">תשובה לדוגמה</p><p><MathText text={part.sample} /></p></div>
        </section>
      )}
      <PartFooter result={null} label={shown ? (last ? 'לסיום' : GO_ON) : 'סיימתי'} onClick={shown ? () => onDone(null) : () => setShown(true)} />
    </>
  );
}
