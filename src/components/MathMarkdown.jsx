import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

// Markdown + real math typesetting ($...$ / $$...$$ via KaTeX) for solutions and chat.
export default function MathMarkdown({ children }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath]}
      rehypePlugins={[[rehypeKatex, { throwOnError: false }]]}
    >
      {children}
    </ReactMarkdown>
  );
}
