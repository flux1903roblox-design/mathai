import { Calculator } from 'lucide-react';

export default function Logo({ compact = false }) {
  return (
    <div className="flex items-center gap-2.5 select-none">
      <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-cyan-400 grid place-items-center btn-glow">
        <Calculator className="w-5 h-5 text-white" strokeWidth={2.4} />
      </div>
      {!compact && (
        <div className="leading-tight">
          <div className="text-[15px] font-extrabold tracking-tight">
            Math<span className="gradient-text">AI</span>
          </div>
          <div className="text-[10px] text-muted-foreground font-medium">המורה הפרטי למתמטיקה</div>
        </div>
      )}
    </div>
  );
}