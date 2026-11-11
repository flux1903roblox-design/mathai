// A misconception's repair: what probably happened and why (its own explanation, not the stair's general one),
// then an activity built for it. Used on the repair screen, in the lesson's feedback and by the tutor.
import { useState } from 'react';
import { MathText } from '@/components/MathText.jsx';
import { Button } from '@/components/ui.jsx';
import StepPlayer, { Prompt } from './StepPlayer.jsx';

export default function RemedyFlow({ content, misc, onDone, compact = false, doneLabel = 'סיימתי', renderHead, title, kicker }) {
  const def = content?.misconceptions.find((m) => m.id === misc);
  const [doing, setDoing] = useState(false);
  if (!def) return null;
  return (
    <div className="remedy">
      {!doing ? (
        <>
          {renderHead && renderHead(null)}
          <section className="lm-card remedy-card" data-region="content">
            {title && <div className="bl-intro"><h1 className="bl-title">{title}</h1>{kicker && <p className="bl-kicker">{kicker}</p>}</div>}
            <Prompt tag="מה כנראה קרה">
              {def.explain.map((t, i) => <p key={i}><MathText text={t} /></p>)}
            </Prompt>
            <div className="lm-why"><p className="lm-why-title">למה זה קורה?</p><p><MathText text={def.cause} /></p></div>
          </section>
          {compact ? <Button className="btn-sm" onClick={() => setDoing(true)}>בואו נראה את זה</Button> : (
            <footer className="lm-actions" data-region="footer"><div className="lm-actions-row"><Button className="btn-block btn-lg" onClick={() => setDoing(true)} data-region="primary">בואו נראה את זה</Button></div></footer>
          )}
        </>
      ) : (
        <StepPlayer steps={def.remedy} label="התיקון" doneLabel={doneLabel} onDone={() => onDone?.()} renderHead={renderHead} title={title} quietTitle />
      )}
    </div>
  );
}
