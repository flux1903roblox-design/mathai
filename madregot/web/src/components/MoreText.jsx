// A child reads two short lines; the rest waits behind "עוד" (PRODUCT2-41, the council's painful moment #3: mission
// reasons ran four lines and a wrong guess got a paragraph). The first sentence shows, cut at a word (outside the maths)
// when it is longer than two lines would hold on a 320px phone; "עוד", a button with aria-expanded, opens the rest in
// place, and "פחות" folds it again. A screen reader hears what is on screen: the rest is hidden until it is opened.
import { useId, useState } from 'react';
import clsx from 'clsx';
import { MathText, mathPlain, splitFirstSentence } from './MathText.jsx';

/**
 * How many characters two lines hold on a 320px phone: a mission row beside its icon (15px), and the result sheet beside
 * מדי (17px). A line longer than this is cut at a word.
 */
export const LEAD_MAX = { row: 44, sheet: 52 };

/**
 * The text split for two lines: { lead, rest, cut }. The lead is the first sentence, or, when that is longer than `max`
 * characters on screen, its words up to `max` (never inside $…$; cut is then true and the rest goes on from there).
 */
export function leadOf(text, max = LEAD_MAX.row) {
  const [first, after] = splitFirstSentence(text);
  if (mathPlain(first).length <= max) return { lead: first, rest: after, cut: false };
  let math = false; let at = -1;
  for (let k = 0; k < first.length; k += 1) {
    const c = first[k];
    if (c === '$') math = !math;
    else if (!math && c === ' ' && mathPlain(first.slice(0, k)).length <= max) at = k;
  }
  if (at < 0) return { lead: first, rest: after, cut: false };
  return { lead: first.slice(0, at), rest: [first.slice(at + 1), after].filter(Boolean).join(' '), cut: true };
}

export default function MoreText({ text, max = LEAD_MAX.row, className, as: As = 'span' }) {
  const { lead, rest, cut } = leadOf(text, max);
  const [open, setOpen] = useState(false);
  const id = useId();
  if (!rest) return <As className={clsx(className, 'more-text')}><MathText text={lead} className="more-lead" /></As>;
  return (
    <As className={clsx(className, 'more-text', open && 'open')}>
      {/* a line cut at a word ends in "…" (and not in its comma) while it is folded */}
      <MathText text={cut && !open ? lead.replace(/[,:;]$/, '') : lead} className="more-lead" />
      {cut && !open && <span className="more-dots" aria-hidden="true">…</span>}
      <span id={id} className="more-rest" hidden={!open}>{' '}<MathText text={rest} /></span>
      {' '}
      <button type="button" className="link-btn more-btn" data-inline aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>{open ? 'פחות' : 'עוד'}</button>
    </As>
  );
}
