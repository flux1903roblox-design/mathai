import { Check, X, CircleDashed } from 'lucide-react';
import { Markdown } from './MathText.jsx';
import { Box } from './ui.jsx';

const FINAL = {
  correct: 'הדרך נכונה והתשובה נכונה.',
  wrong: 'יש טעות בדרך.',
  unfinished: 'הפתרון עוד לא גמור.',
  unknown: 'לא ברור מה התשובה הסופית.',
};

/** Under WITHHOLD (an exercise still open, ai spec AI-3): the final answer is checked in the box, not by the tutor. */
export const WITHHELD_LINE = 'את התשובה הסופית כותבים בתיבה, ושם היא נבדקת.';
const OPEN_LABEL = 'השורה עם התשובה הסופית נבדקת בתיבה';

/**
 * The AI's step-by-step check of handwritten work. A withheld check (an exercise still open) says where the final answer
 * is checked instead of a verdict, and the line that states the final value has neither ✓ nor ✗ (ok: null) nor a comment.
 */
export default function CheckResult({ r, title = 'בדיקת הדרך' }) {
  return (
    <Box tone="ai" title={title} live>
      {/* a care result (the page worried the tutor) speaks for itself, without "hard to read" */}
      {!r.readable ? <p>{!r.care && 'קשה לקרוא את הכתב. '}<Markdown>{r.summary}</Markdown></p> : (
        <>
          <p className="check-final">{r.withheld ? WITHHELD_LINE : FINAL[r.final] || ''}</p>
          <ol className="check-steps">
            {r.steps.map((st, i) => {
              const open = st.ok === null;
              return (
                <li key={i} className={open ? 'open' : st.ok ? 'ok' : 'bad'}>
                  <span className="check-icon" role="img" aria-label={open ? OPEN_LABEL : st.ok ? 'שורה נכונה' : 'שורה עם טעות'}>
                    {open ? <CircleDashed size={16} aria-hidden="true" /> : st.ok ? <Check size={16} /> : <X size={16} />}
                  </span>
                  <div><Markdown>{st.text}</Markdown>{!open && st.comment && <Markdown className="check-comment">{st.comment}</Markdown>}</div>
                </li>
              );
            })}
          </ol>
          <Markdown>{r.summary}</Markdown>
        </>
      )}
    </Box>
  );
}
