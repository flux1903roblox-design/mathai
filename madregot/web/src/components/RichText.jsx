// Markdown with $...$ maths (AI answers, the tutor sheets, an exam's result, the legal pages). The markdown libraries
// load the first time such text is shown (components/Markdown.jsx, its own file): until then the text is shown as it
// is, its $...$ maths already drawn, in the same box, so nothing waits on a loading screen (DURABLE-11).
import { lazy, Suspense } from 'react';
import { MathText } from './MathText.jsx';

const load = () => import('./Markdown.jsx');
const Markdown = lazy(load);

/** Fetch the markdown file ahead of time (a screen that is about to show AI text). */
export const preloadRichText = () => { load().catch(() => {}); };

/**
 * `inline` renders a short answer inside a line of text; `math={false}` leaves $ signs as they are (legal text); `as`
 * names the element that holds it (a div, or a span when inline); `fallback` replaces the plain text while the file loads;
 * `trusted` (the app's own text, never the AI's) keeps links and images as written instead of SafeLink/SafeImage.
 */
export function RichText({ children, className, inline = false, math = true, as, fallback, trusted = false }) {
  const cls = [inline ? 'md-inline' : 'md', className].filter(Boolean).join(' ');
  const Tag = as || (inline ? 'span' : 'div');
  const text = String(children ?? '');
  // the text as written, lines kept, while the file loads
  const plain = <Tag className={cls} style={{ whiteSpace: 'pre-line' }}>{math ? <MathText text={text} /> : text}</Tag>;
  return (
    <Suspense fallback={fallback === undefined ? plain : fallback}>
      <Markdown className={cls} inline={inline} math={math} as={Tag} trusted={trusted}>{text}</Markdown>
    </Suspense>
  );
}
