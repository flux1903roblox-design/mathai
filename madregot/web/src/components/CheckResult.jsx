import { Check, X, CircleDashed } from 'lucide-react';
import { RichText } from './RichText.jsx';
import { Box } from './ui.jsx';

export const FINAL = {
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
 * The lesson's notebook check and the assistant's photo check both show it; the assistant names its own box, its own
 * "hard to read" and its own verdict lines (`title`, `unreadable`, `finals`).
 */
export default function CheckResult({ r, title = 'בדיקת הדרך', unreadable = 'קשה לקרוא את הכתב.', finals = FINAL }) {
  return (
    <Box tone="ai" title={title} live>
      {/* a care result (the page worried the tutor) speaks for itself, without "hard to read". A block, not a <p>: the
          summary is a RichText, which is a <div> (FOLLOWUP-26) */}
      {!r.readable ? <div className="check-unreadable">{!r.care && `${unreadable} `}<RichText>{r.summary}</RichText></div> : (
        <>
          <p className="check-final">{r.withheld ? WITHHELD_LINE : finals[r.final] || ''}</p>
          <ol className="check-steps">
            {r.steps.map((st, i) => {
              const open = st.ok === null;
              return (
                <li key={i} className={open ? 'open' : st.ok ? 'ok' : 'bad'}>
                  <span className="check-icon" role="img" aria-label={open ? OPEN_LABEL : st.ok ? 'שורה נכונה' : 'שורה עם טעות'}>
                    {open ? <CircleDashed size={16} aria-hidden="true" /> : st.ok ? <Check size={16} /> : <X size={16} />}
                  </span>
                  <div><RichText>{st.text}</RichText>{!open && st.comment && <RichText className="check-comment">{st.comment}</RichText>}</div>
                </li>
              );
            })}
          </ol>
          <RichText>{r.summary}</RichText>
        </>
      )}
    </Box>
  );
}
