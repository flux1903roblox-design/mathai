import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { m } from 'motion/react';
import { House, Target, ClipboardCheck, Sparkles, User } from 'lucide-react';
import { DUR, enter } from '@/lib/motion.js';

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
      <nav className="tabbar" aria-label="ניווט ראשי" data-region="nav">
        <span className="tabbar-brand" aria-hidden="true">מדרגות</span>
        {TABS.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => `tab${isActive ? ' active' : ''}`}>
            <Icon size={22} aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <main className="shell-main">
        {/* each screen fades in as it opens, from a visible start. Opacity only: a transform here would make
            every position: fixed element inside the screen (the jump-back button) scroll with the page. */}
        <m.div key={pathname} className="screen" initial={{ opacity: 0.4 }} animate={{ opacity: 1 }} transition={enter(DUR.fast)}>
          <Outlet />
        </m.div>
      </main>
    </div>
  );
}
