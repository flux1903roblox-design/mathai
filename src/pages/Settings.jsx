import { Link } from 'react-router-dom';
import { Settings as SettingsIcon, User, Crown, LogOut, Mail, GraduationCap } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { isPro, actionsDisplay } from '@/lib/mathActions';
import { profileLabel } from '@/lib/curriculum';
import GradeBadge from '@/components/GradeBadge';

export default function Settings() {
  const { user, logout } = useAuth();
  const pro = isPro(user);

  return (
    <div className="space-y-5 max-w-lg">
      <header className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400 grid place-items-center btn-glow">
          <SettingsIcon className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold">הגדרות</h1>
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

      <button onClick={() => logout()} className="w-full card-base p-4 flex items-center justify-center gap-2 text-sm font-semibold text-red-400 hover:bg-red-500/5 transition">
        <LogOut className="w-4 h-4" /> התנתקות
      </button>

      <div className="text-center text-[11px] text-muted-foreground pt-2">
        MathAI · המורה הפרטי למתמטיקה
      </div>
    </div>
  );
}