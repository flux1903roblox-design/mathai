import { Check, X } from 'lucide-react';
import { RichText } from './RichText.jsx';
import { Box } from './ui.jsx';

const FINAL = {
  correct: 'הדרך נכונה והתשובה נכונה.',
  wrong: 'יש טעות בדרך.',
  unfinished: 'הפתרון עוד לא גמור.',
  unknown: 'לא ברור מה התשובה הסופית.',
};

/** The AI's step-by-step check of handwritten work. */
export default function CheckResult({ r, title = 'בדיקת הדרך' }) {
  return (
    <Box tone="ai" title={title} live>
      {/* a care result (the page worried the tutor) speaks for itself, without "hard to read" */}
      {!r.readable ? <p>{!r.care && 'קשה לקרוא את הכתב. '}<RichText>{r.summary}</RichText></p> : (
        <>
          <p className="check-final">{FINAL[r.final] || ''}</p>
          <ol className="check-steps">
            {r.steps.map((st, i) => (
              <li key={i} className={st.ok ? 'ok' : 'bad'}>
                <span className="check-icon" role="img" aria-label={st.ok ? 'שורה נכונה' : 'שורה עם טעות'}>{st.ok ? <Check size={16} /> : <X size={16} />}</span>
                <div><RichText>{st.text}</RichText>{st.comment && <RichText className="check-comment">{st.comment}</RichText>}</div>
              </li>
            ))}
          </ol>
          <RichText>{r.summary}</RichText>
        </>
      )}
    </Box>
  );
}
