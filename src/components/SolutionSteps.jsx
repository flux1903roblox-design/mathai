import ReactMarkdown from 'react-markdown';
import { Check, Copy, Sparkles, Tag } from 'lucide-react';
import { useState } from 'react';

const LEVEL_LABEL = { hint: 'רמז', partial: 'פתרון חלקי', full: 'פתרון מלא' };

export default function SolutionSteps({ result, helpLevel }) {
  const [copied, setCopied] = useState(false);
  if (!result) return null;

  const copy = () => {
    navigator.clipboard?.writeText(`${result.solution || ''}${result.final_answer ? '\n\nתשובה: ' + result.final_answer : ''}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="card-base p-5 animate-slide-up">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-cyan-400 grid place-items-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-bold">{LEVEL_LABEL[helpLevel] || 'פתרון'}</div>
            {result.topic && (
              <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Tag className="w-3 h-3" /> {result.topic}
              </div>
            )}
          </div>
        </div>
        <button onClick={copy} className="text-xs glass rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 hover:bg-white/10 transition">
          {copied ? <Check className="w-3.5 h-3.5 text-cyan-300" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'הועתק' : 'העתק'}
        </button>
      </div>

      <div className="math-prose text-[15px] leading-relaxed text-foreground/90 whitespace-pre-wrap">
        <ReactMarkdown>{result.solution || ''}</ReactMarkdown>
      </div>

      {result.final_answer && (
        <div className="mt-4 rounded-xl bg-gradient-to-l from-violet-500/15 to-cyan-400/15 border border-white/15 px-4 py-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">תשובה סופית</span>
          <span className="text-base font-bold gradient-text" dir="ltr">{result.final_answer}</span>
        </div>
      )}
    </div>
  );
}