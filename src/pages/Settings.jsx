import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Settings as SettingsIcon, User, Crown, LogOut, Mail, GraduationCap, Sparkles, Check } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { isPro, actionsDisplay } from '@/lib/mathActions';
import { profileLabel } from '@/lib/curriculum';
import { aiConfig } from '@/lib/localdb';
import GradeBadge from '@/components/GradeBadge';

export default function Settings() {
  const { user, logout } = useAuth();
  const pro = isPro(user);
  const [ai, setAi] = useState(aiConfig.get());
  const [saved, setSaved] = useState(false);

  const saveAi = () => {
    aiConfig.set(ai);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-5 max-w-lg">
      <header className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400 grid place-items-center btn-glow">
          <SettingsIcon className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-display">הגדרות</h1>
          <p className="text-xs text-muted-foreground">החשבון והמנוי שלך</p>
        </div>
      </header>

      <div className="card-base p-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-cyan-400 grid place-items-center text-white font-bold text-lg">
            {(user?.full_name || user?.email || '?').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="font-bold truncate">{user?.full_name || 'תלמיד'}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-1.5"><Mail className="w-3 h-3" /> {user?.email}</div>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <GradeBadge user={user} />
          <div className="text-xs text-muted-foreground flex items-center gap-1.5"><GraduationCap className="w-3.5 h-3.5" /> {profileLabel(user?.grade, user?.track)}</div>
        </div>
      </div>

      <div className="card-base p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl grid place-items-center ${pro ? 'bg-gradient-to-br from-amber-400 to-violet-500' : 'bg-white/5'}`}>
            <Crown className={`w-5 h-5 ${pro ? 'text-white' : 'text-muted-foreground'}`} />
          </div>
          <div>
            <div className="font-bold text-sm">{pro ? 'MathAI Pro · פעיל' : 'מצב חינמי'}</div>
            <div className="text-xs text-muted-foreground">פעולות נותרו: {actionsDisplay(user)}</div>
          </div>
        </div>
        {!pro && (
          <Link to="/paywall" className="bg-gradient-to-l from-violet-500 to-cyan-400 text-white text-sm font-bold px-4 py-2 rounded-xl btn-glow">
            שדרג
          </Link>
        )}
      </div>

      <div className="card-base p-5 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-violet-500 grid place-items-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-bold text-sm">מנוע AI</div>
            <div className="text-xs text-muted-foreground">
              {ai.apiKey ? 'מפתח אישי (Groq)' : 'שרת משותף של האפליקציה'}
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          אופציונלי: מפתח Groq אישי (חינמי ב-console.groq.com) — נשמר רק בדפדפן שלך.
        </p>
        <input
          type="password"
          dir="ltr"
          placeholder="gsk_..."
          value={ai.apiKey}
          onChange={(e) => setAi({ ...ai, apiKey: e.target.value.trim() })}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-violet-400/50"
        />
        <button onClick={saveAi} className="w-full bg-gradient-to-l from-violet-500 to-cyan-400 text-white text-sm font-bold py-2.5 rounded-xl btn-glow flex items-center justify-center gap-2">
          {saved ? (<><Check className="w-4 h-4" /> נשמר</>) : 'שמירה'}
        </button>
      </div>

      <button onClick={() => logout()} className="w-full card-base p-4 flex items-center justify-center gap-2 text-sm font-semibold text-red-400 hover:bg-red-500/5 transition">
        <LogOut className="w-4 h-4" /> התנתקות
      </button>

      <div className="text-center text-[11px] text-muted-foreground pt-2">
        MathAI · המורה הפרטי למתמטיקה
      </div>
    </div>
  );
}