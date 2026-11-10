import { Check, X } from 'lucide-react';
import MathMarkdown from '@/components/MathMarkdown';

const LETTERS = ['א', 'ב', 'ג', 'ד', 'ה'];

// Multiple choice as big tactile cards. `result` colours the outcome after "בדיקה".
export default function Choice({ value, onChange, locked, config, result }) {
  const { options, answer } = config;
  return (
    <div className="space-y-2.5">
      {options.map((opt, i) => {
        const selected = value.selected === i;
        const showRight = (result === 'correct' || result === 'revealed') && i === answer;
        const showWrong = result === 'wrong' && selected;
        const tone = showRight
          ? 'border-emerald-400/70 bg-emerald-400/15 [--chunk:theme(colors.emerald.700)]'
          : showWrong
            ? 'border-rose-400/70 bg-rose-400/10 animate-shake [--chunk:theme(colors.rose.800)]'
            : selected
              ? 'border-violet-400/80 bg-violet-500/15 [--chunk:theme(colors.violet.800)]'
              : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.07] [--chunk:hsl(240_10%_3%)]';
        return (
          <button
            key={i}
            type="button"
            disabled={locked}
            onClick={() => onChange({ ...value, selected: i, touched: true })}
            className={`btn-chunky w-full text-right border-2 rounded-2xl px-4 py-3.5 flex items-center gap-3 font-semibold disabled:opacity-100 disabled:filter-none disabled:cursor-default ${tone}`}
          >
            <span className={`w-8 h-8 rounded-xl grid place-items-center text-sm font-black shrink-0 ${showRight ? 'bg-emerald-400 text-emerald-950' : showWrong ? 'bg-rose-400 text-rose-950' : selected ? 'bg-violet-400 text-violet-950' : 'bg-white/10'}`}>
              {showRight ? <Check className="w-4 h-4" /> : showWrong ? <X className="w-4 h-4" /> : LETTERS[i]}
            </span>
            <span className="math-prose flex-1 [&_p]:m-0 text-[15px] leading-snug">
              <MathMarkdown>{opt}</MathMarkdown>
            </span>
          </button>
        );
      })}
    </div>
  );
}
