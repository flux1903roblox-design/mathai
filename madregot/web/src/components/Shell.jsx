import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { m } from 'motion/react';
import { House, Target, ClipboardCheck, Sparkles, User } from 'lucide-react';

const TABS = [
  { to: '/', label: 'לימוד', icon: House, end: true },
  { to: '/quests', label: 'משימות', icon: Target },
  { to: '/exams', label: 'מבחנים', icon: ClipboardCheck },
  { to: '/assistant', label: 'עוזר AI', icon: Sparkles },
  { to: '/me', label: 'אני', icon: User },
];

/** Student layout: content plus the tab bar (bottom on phones, top on wide screens). */
export default function Shell() {
  const { pathname } = useLocation();
  return (
    <div className="shell">
      <nav className="tabbar" aria-label="ניווט ראשי">
        <span className="tabbar-brand" aria-hidden="true">מדרגות</span>
        {TABS.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => `tab${isActive ? ' active' : ''}`}>
            <Icon size={22} aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <main className="shell-main">
        {/* each screen settles in as it opens: a short rise, from a visible start */}
        <m.div key={pathname} className="screen" initial={{ opacity: 0.4, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}>
          <Outlet />
        </m.div>
      </main>
    </div>
  );
}
