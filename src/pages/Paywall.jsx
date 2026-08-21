import { useState } from 'react';
import { Check, Crown, Zap, Check as CheckIcon, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { isPro, activateSubscription, grantActions } from '@/lib/mathActions';

const PLANS = [
  { id: 'weekly', label: 'שבועי', price: '₪29', per: '/ שבוע', desc: 'מושלם לחזרה לפני מבחן', featured: false },
  { id: 'monthly', label: 'חודשי', price: '₪79', per: '/ חודש', desc: 'הבחירה הפופולרית', featured: true },
  { id: 'halfyear', label: 'חצי שנתי', price: '₪199', per: '/ חצי שנה', desc: 'שווה ערך לשיעור פרטי אחד', featured: false },
];

const PACKS = [
  { count: 10, price: '₪15', per: '₪1.5 לפעולה' },
  { count: 25, price: '₪29', per: '₪1.16 לפעולה' },
  { count: 50, price: '₪49', per: '₪0.98 לפעולה' },
];

const PERKS = ['פעולות ללא הגבלה', 'סריקה ופתרון אינסופי', 'תרגול ומבחנים ללא הגבלה', 'צ׳אט עם המורה ללא הגבלה'];

export default function Paywall() {
  const { user, checkUserAuth } = useAuth();
  const [busy, setBusy] = useState(null);

  const buy = async (type, id) => {
    setBusy(`${type}:${id}`);
    try {
      if (type === 'plan') await activateSubscription(id);
      else await grantActions(id);
      await checkUserAuth();
    } finally {
      setBusy(null);
    }
  };

  if (isPro(user)) {
    return (
      <div className="space-y-5">
        <Header />
        <div className="card-base p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-violet-500 grid place-items-center mx-auto mb-4 btn-glow">
            <Crown className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-extrabold gradient-text">MathAI Pro פעיל</h2>
          <p className="text-sm text-muted-foreground mt-1">יש לך גישה מלאה לכל הפיצ׳רים ללא הגבלה. תודה שאתה Pro!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Header />

      <div className="card-base p-6 text-center relative overflow-hidden">
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="relative">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-violet-500 grid place-items-center mx-auto mb-3 btn-glow">
            <Crown className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-2xl font-extrabold">MathAI Pro</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">פתח את כל הפיצ׳רים ופתור מתמטיקה ללא הגבלה</p>
          <div className="grid grid-cols-2 gap-2 mt-5 text-right max-w-sm mx-auto">
            {PERKS.map((p) => (
              <div key={p} className="flex items-center gap-2 text-sm"><CheckIcon className="w-4 h-4 text-emerald-400 shrink-0" /> {p}</div>
            ))}
          </div>
        </div>
      </div>

      {/* plans */}
      <div>
        <div className="text-sm font-bold mb-3">מנויים</div>
        <div className="grid sm:grid-cols-3 gap-3">
          {PLANS.map((p) => (
            <div key={p.id} className={`card-base p-5 flex flex-col ${p.featured ? 'ring-glow border-transparent' : ''}`}>
              {p.featured && <div className="text-[10px] font-bold text-amber-300 bg-amber-400/15 rounded-full px-2 py-0.5 self-start mb-2">הפופולרי</div>}
              <div className="font-bold">{p.label}</div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-3xl font-extrabold">{p.price}</span>
                <span className="text-xs text-muted-foreground">{p.per}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1 mb-4 flex-1">{p.desc}</div>
              <button onClick={() => buy('plan', p.id)} disabled={busy === `plan:${p.id}`}
                className="w-full bg-gradient-to-l from-violet-500 to-cyan-400 text-white font-bold py-2.5 rounded-xl btn-glow disabled:opacity-50 flex items-center justify-center gap-1.5 transition">
                {busy === `plan:${p.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Crown className="w-4 h-4" /> התחילו עכשיו</>}
              </button>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground mt-2 text-center">המנוי מתחדש אוטומטית. ניתן לבטל בכל עת.</p>
      </div>

      {/* packs */}
      <div>
        <div className="text-sm font-bold mb-3 flex items-center gap-2"><Zap className="w-4 h-4 text-cyan-300" /> חבילות פעולות חד-פעמיות</div>
        <div className="grid sm:grid-cols-3 gap-3">
          {PACKS.map((p) => (
            <div key={p.count} className="card-base p-5 flex flex-col">
              <div className="font-bold">{p.count} פעולות</div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-extrabold">{p.price}</span>
                <span className="text-[11px] text-muted-foreground">{p.per}</span>
              </div>
              <div className="flex-1" />
              <button onClick={() => buy('pack', p.count)} disabled={busy === `pack:${p.count}`}
                className="w-full glass font-bold py-2.5 rounded-xl hover:bg-white/10 disabled:opacity-50 flex items-center justify-center gap-1.5 mt-3 transition">
                {busy === `pack:${p.count}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <>רכוש</>}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Header() {
  return (
    <header className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-violet-500 grid place-items-center btn-glow">
        <Crown className="w-5 h-5 text-white" />
      </div>
      <div>
        <h1 className="text-xl font-display">MathAI Pro</h1>
        <p className="text-xs text-muted-foreground">מנוי או חבילת פעולות</p>
      </div>
    </header>
  );
}