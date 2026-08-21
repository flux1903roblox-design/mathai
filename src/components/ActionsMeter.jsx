import { Zap } from 'lucide-react';
import { isPro, actionsDisplay } from '@/lib/mathActions';

export default function ActionsMeter({ user, className = '' }) {
  const pro = isPro(user);
  const remaining = actionsDisplay(user);
  const count = typeof remaining === 'number' ? remaining : 5;
  const pct = pro ? 100 : Math.max(0, Math.min(100, (count / 5) * 100));

  return (
    <div className={`glass rounded-2xl p-4 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-violet-400" />
          פעולות שנותרו
        </span>
        <span className={`text-sm font-bold ${pro ? 'text-cyan-300' : 'text-violet-200'}`}>
          {remaining}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className={`h-full rounded-full ${pro ? 'bg-gradient-to-l from-cyan-400 to-violet-400' : 'bg-gradient-to-l from-violet-500 to-fuchsia-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}