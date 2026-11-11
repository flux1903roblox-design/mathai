// Markdown with $...$ maths, for text written by the AI and for the legal pages. Its own file, loaded only when such
// text is shown (components/RichText.jsx), so the markdown libraries are not part of the app's first download
// (DURABLE-11). Raw HTML is never rendered.
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import './katex.js'; // KaTeX's stylesheet, for the maths rehype-katex draws

const INLINE = { p: 'span' };
const MATH = { remark: [remarkMath], rehype: [[rehypeKatex, { throwOnError: false, strict: 'ignore' }]] };

export default function Markdown({ children, className, inline = false, math = true, as }) {
  const Tag = as || (inline ? 'span' : 'div');
  return (
    <Tag className={className}>
      <ReactMarkdown remarkPlugins={math ? MATH.remark : []} rehypePlugins={math ? MATH.rehype : []} components={inline ? INLINE : undefined}>
        {String(children ?? '')}
      </ReactMarkdown>
    </Tag>
  );
}
