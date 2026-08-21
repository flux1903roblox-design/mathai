import { Lightbulb, FileText, ListOrdered } from 'lucide-react';

const LEVELS = [
  { id: 'hint', label: 'רמז', desc: 'דחיפה קטנה לכיוון הנכון', icon: Lightbulb, color: 'from-amber-400 to-yellow-500' },
  { id: 'partial', label: 'פתרון חלקי', desc: 'בחר איזה סעיף לפתור', icon: ListOrdered, color: 'from-cyan-400 to-blue-500' },
  { id: 'full', label: 'פתרון מלא', desc: 'הסבר צעד-אחר-צעד', icon: FileText, color: 'from-violet-500 to-fuchsia-500' },
];

export default function HelpLevelSelector({ value, onChange, disabled }) {
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {LEVELS.map((l) => {
        const active = value === l.id;
        const Icon = l.icon;
        return (
          <button
            key={l.id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(l.id)}
            className={`relative rounded-2xl p-3.5 text-right transition-all border ${
              active
                ? 'border-transparent bg-white/[0.08] ring-glow'
                : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05]'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${l.color} grid place-items-center mb-2.5`}>
              <Icon className="w-4 h-4 text-white" />
            </div>
            <div className="text-sm font-bold">{l.label}</div>
            <div className="text-[11px] text-muted-foreground leading-snug mt-0.5">{l.desc}</div>
            {active && <div className="absolute top-2 left-2 w-2 h-2 rounded-full bg-violet-400 animate-pulse-soft" />}
          </button>
        );
      })}
    </div>
  );
}