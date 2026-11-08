// A misconception's repair: what probably happened and why (its own explanation, not the stair's general one),
// then an activity built for it. Used on the repair screen, in the lesson's feedback and by the tutor.
import { useState } from 'react';
import { MathText } from '@/components/MathText.jsx';
import Mascot from '@/components/Mascot.jsx';
import { Button } from '@/components/ui.jsx';
import StepPlayer from './StepPlayer.jsx';

export default function RemedyFlow({ content, misc, onDone, compact = false, doneLabel = 'סיימתי' }) {
  const def = content?.misconceptions.find((m) => m.id === misc);
  const [doing, setDoing] = useState(false);
  if (!def) return null;
  return (
    <div className="remedy">
      {!doing ? (
        <>
          <div className="ls-say">
            <Mascot mood="encouraging" size={compact ? 52 : 72} className="ls-mascot" />
            <div className="ls-bubble">
              {def.explain.map((t, i) => <p key={i}><MathText text={t} /></p>)}
            </div>
          </div>
          <p className="remedy-cause"><span className="worked-why-tag">למה זה קורה?</span> <MathText text={def.cause} /></p>
          <Button className={compact ? 'btn-sm' : 'btn-block btn-lg'} onClick={() => setDoing(true)}>בואו נראה את זה</Button>
        </>
      ) : (
        <StepPlayer steps={def.remedy} label="התיקון" doneLabel={doneLabel} onDone={() => onDone?.()} />
      )}
    </div>
  );
}
