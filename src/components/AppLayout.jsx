import { NavLink, useLocation, Outlet } from 'react-router-dom';
import { useEffect } from 'react';
import {
  LayoutDashboard, ScanLine, PencilRuler, ClipboardList, MessageCircle,
  History as HistoryIcon, Crown, Settings, LogOut,
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import Logo from './Logo';
import GradeBadge from './GradeBadge';
import ActionsMeter from './ActionsMeter';
import { isPro } from '@/lib/mathActions';

const NAV = [
  { to: '/', label: 'בית', icon: LayoutDashboard, end: true },
  { to: '/scan', label: 'סריקת שאלה', icon: ScanLine },
  { to: '/practice', label: 'תרגול חכם', icon: PencilRuler },
  { to: '/exam', label: 'בניית מבחן', icon: ClipboardList },
  { to: '/chat', label: 'צ׳אט עם המורה', icon: MessageCircle },
  { to: '/history', label: 'היסטוריה', icon: HistoryIcon },
];

const MOBILE_NAV = [
  { to: '/', label: 'בית', icon: LayoutDashboard, end: true },
  { to: '/scan', label: 'סריקה', icon: ScanLine },
  { to: '/practice', label: 'תרגול', icon: PencilRuler },
  { to: '/chat', label: 'צ׳אט', icon: MessageCircle },
  { to: '/history', label: 'היסטוריה', icon: HistoryIcon },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();

  useEffect(() => {
    document.documentElement.classList.add('dark');
    document.documentElement.setAttribute('dir', 'rtl');
    document.documentElement.setAttribute('lang', 'he');
  }, []);

  return (
    <div className="min-h-screen flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0 border-l border-white/10 bg-sidebar/60 backdrop-blur-xl sticky top-0 h-screen">
        <div className="p-5 border-b border-white/10">
          <Logo />
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto no-scrollbar">
          {NAV.map((item) => (
            <SideLink key={item.to} {...item} />
          ))}
        </nav>
        <div className="p-3 space-y-2 border-t border-white/10">
          <ActionsMeter user={user} />
          <NavLink to="/paywall" className="block">
            <div className={`rounded-xl px-3 py-2.5 flex items-center gap-2.5 text-sm font-semibold transition ${isPro(user) ? 'bg-gradient-to-l from-amber-400/20 to-violet-500/20 border border-amber-400/30' : 'glass hover:bg-white/10'}`}>
              <Crown className="w-4 h-4 text-amber-300" />
              {isPro(user) ? 'MathAI Pro · פעיל' : 'שדרוג ל-Pro'}
            </div>
          </NavLink>
          <NavLink to="/settings" className="block">
            <div className="rounded-xl px-3 py-2.5 flex items-center gap-2.5 text-sm font-medium glass hover:bg-white/10 transition">
              <Settings className="w-4 h-4" /> הגדרות
            </div>
          </NavLink>
          <button onClick={() => logout()} className="w-full rounded-xl px-3 py-2.5 flex items-center gap-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-white/5 transition">
            <LogOut className="w-4 h-4" /> התנתקות
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile top bar */}
        <header className="lg:hidden sticky top-0 z-30 glass-strong px-4 py-3 flex items-center justify-between">
          <Logo compact />
          <GradeBadge user={user} />
        </header>

        <main className="flex-1 pb-24 lg:pb-0 max-w-5xl w-full mx-auto px-4 sm:px-6 py-5 lg:py-8" key={location.pathname}>
          <div className="animate-fade-in">
            <OutletWrapper />
          </div>
        </main>

        {/* Mobile bottom nav */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 glass-strong border-t border-white/10 px-2 py-1.5 flex items-center justify-around safe-area">
          {MOBILE_NAV.map((item) => (
            <BottomLink key={item.to} {...item} />
          ))}
        </nav>
      </div>
    </div>
  );
}

function OutletWrapper() {
  return <Outlet />;
}

function SideLink({ to, label, icon: Icon, end }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) =>
      `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
        isActive ? 'bg-gradient-to-l from-violet-500/20 to-cyan-400/10 text-white border border-white/10' : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
      }`
    }>
      <Icon className="w-4 h-4" />
      {label}
    </NavLink>
  );
}

function BottomLink({ to, label, icon: Icon, end }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) =>
      `flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition ${isActive ? 'text-violet-300' : 'text-muted-foreground'}`
    }>
      <Icon className="w-5 h-5" />
      <span className="text-[10px] font-medium">{label}</span>
    </NavLink>
  );
}