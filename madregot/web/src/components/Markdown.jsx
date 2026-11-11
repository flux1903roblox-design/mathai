// Markdown with $...$ maths, for text written by the AI and for the legal pages. Its own file, loaded only when such
// text is shown (components/RichText.jsx), so the markdown libraries are not part of the app's first download
// (DURABLE-11). Raw HTML is never rendered. In text the AI wrote, links and images go through SafeLink and SafeImage
// (trust spec TRUST-4 §4.2); the app's own text (the legal pages: `trusted`) keeps its links as written.
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { linkAllowed } from '@shared/safety.js';
import './katex.js'; // KaTeX's stylesheet, for the maths rehype-katex draws

/**
 * A link in text the AI wrote (trust spec TRUST-4 §4.2): an anchor only to the hosts every reply may link to (the
 * support services, WhatsApp, Israeli government sites, from the same list the server screens with) or to this app's
 * own address; it opens in a new tab with no opener. Any other link is shown as its text, so a child never follows an
 * address nobody checked. This covers a reply that is still streaming, before the server's screen has seen it all.
 */
export function SafeLink({ href, children }) {
  const own = typeof window !== 'undefined' && window.location?.hostname ? [window.location.hostname] : [];
  if (!linkAllowed(href, own)) return <span className="md-link-text">{children}</span>;
  const tel = /^tel:/i.test(String(href));
  return <a href={href} {...(tel ? {} : { target: '_blank', rel: 'noopener noreferrer' })}>{children}</a>;
}

/** An image in text the AI wrote is never loaded (an address nobody chose would load by itself): its words stay. */
export function SafeImage({ alt }) {
  return alt ? <span className="md-link-text">{alt}</span> : null;
}

const SAFE = { a: SafeLink, img: SafeImage };
const COMPONENTS = { safe: SAFE, safeInline: { ...SAFE, p: 'span' }, trusted: undefined, trustedInline: { p: 'span' } };
const MATH = { remark: [remarkMath], rehype: [[rehypeKatex, { throwOnError: false, strict: 'ignore' }]] };

export default function Markdown({ children, className, inline = false, math = true, as, trusted = false }) {
  const Tag = as || (inline ? 'span' : 'div');
  const components = COMPONENTS[`${trusted ? 'trusted' : 'safe'}${inline ? 'Inline' : ''}`];
  return (
    <Tag className={className}>
      <ReactMarkdown remarkPlugins={math ? MATH.remark : []} rehypePlugins={math ? MATH.rehype : []} components={components}>
        {String(children ?? '')}
      </ReactMarkdown>
    </Tag>
  );
}
