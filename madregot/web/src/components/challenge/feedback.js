// The tutor's feedback on a challenge's written explanation (FOLLOWUP-16, ai spec AI-10): what the request carries, and
// where a quote sits in the student's own words. The screen is ExplainPart.jsx; the kind, its checks and its reply are
// shared/ai.js (feedbackInput, readResult('feedback')).
import { buildTutorContext } from '@/lib/tutorContext.js';

/** The Hebrew on the screen (ai spec AI-10, "Hebrew copy"). */
export const FEEDBACK_COPY = Object.freeze({
  button: 'בקשו מהעוזר משוב על ההסבר',
  busy: 'העוזר קורא את ההסבר…',
  ready: 'המשוב מהעוזר כאן למטה',
  intro: 'העוזר סימן אילו נקודות כבר יש בהסבר שלכם. את ההסבר עצמו הוא לא משנה, וזה לא ציון.',
  status: Object.freeze({ yes: 'יש', partly: 'יש חלק', no: 'עוד חסר' }),
  words: 'במילים שלכם:',
  tip: 'רעיון:',
  title: 'משוב מהעוזר',
});

/**
 * The feedback request: exactly the challenge's context for the tutor (its stair, story, question and grade), the
 * part's rubric and model answer, and the student's text as typed (the server masks personal details and reads it for
 * distress before anything else). Built only when the student presses the button.
 */
export function feedbackRequest({ task, part, text, grade }) {
  return {
    ctx: buildTutorContext({ surface: 'challenge', skill: task.after, story: task.story, prompt: part.prompt, grade }),
    rubric: part.rubric,
    sample: part.sample,
    text,
  };
}

/**
 * A quote in the student's own text, with a little of what comes before and after it (cut at a space, "…" where cut):
 * { before, mark, after }. A quote that is not in the text (the server matched it after masking a personal detail) is
 * shown alone; no quote gives null.
 */
export function quoteIn(text, quote, room = 40) {
  const q = String(quote ?? '');
  if (!q.trim()) return null;
  const t = String(text ?? '');
  const k = t.indexOf(q);
  if (k < 0) return { before: '', mark: q, after: '' };
  let before = t.slice(0, k);
  let after = t.slice(k + q.length);
  if (before.length > room) {
    const cut = before.slice(-room);
    const sp = cut.indexOf(' ');
    before = `…${sp >= 0 ? cut.slice(sp + 1) : cut}`;
  }
  if (after.length > room) {
    const cut = after.slice(0, room);
    const sp = cut.lastIndexOf(' ');
    after = `${(sp > 0 ? cut.slice(0, sp) : cut).replace(/[\s,;:]+$/, '')}…`;
  }
  return { before, mark: q, after };
}
