import { memo, useMemo } from 'react';
import katex from 'katex';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

const render = (tex, displayMode) => {
  try { return katex.renderToString(tex, { displayMode, throwOnError: false, strict: 'ignore' }); } catch { return tex; }
};

/** One TeX expression. */
export const Tex = memo(function Tex({ tex, display = false, className }) {
  const html = useMemo(() => render(tex, display), [tex, display]);
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
});

/** Hebrew text with inline math between $...$ (generator output only). */
export const MathText = memo(function MathText({ text, as: As = 'span', className }) {
  const parts = String(text ?? '').split(/(\$[^$]+\$)/g).filter(Boolean);
  return (
    <As className={className}>
      {parts.map((p, i) => (p.startsWith('$') && p.endsWith('$') && p.length > 2
        ? <Tex key={i} tex={p.slice(1, -1)} />
        : <span key={i}>{p}</span>))}
    </As>
  );
});

/** Markdown with math, for text written by the AI. Raw HTML is not rendered. */
const INLINE = { p: 'span' };

/** Markdown with $...$ math. `inline` renders a short answer inside a line of text. */
export function Markdown({ children, className, inline = false }) {
  const Tag = inline ? 'span' : 'div';
  return (
    <Tag className={[inline ? 'md-inline' : 'md', className].filter(Boolean).join(' ')}>
      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: 'ignore' }]]} components={inline ? INLINE : undefined}>
        {String(children ?? '')}
      </ReactMarkdown>
    </Tag>
  );
}
