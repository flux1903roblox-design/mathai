import { NavLink, Outlet } from 'react-router-dom';
import { House, BookOpen, ClipboardCheck, Sparkles, User } from 'lucide-react';

const TABS = [
  { to: '/', label: 'היום', icon: House, end: true },
  { to: '/topics', label: 'נושאים', icon: BookOpen },
  { to: '/exams', label: 'מבחנים', icon: ClipboardCheck },
  { to: '/assistant', label: 'עוזר AI', icon: Sparkles },
  { to: '/me', label: 'אני', icon: User },
];

/** Student layout: content plus the tab bar (bottom on phones, top on wide screens). */
export default function Shell() {
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
        <Outlet />
      </main>
    </div>
  );
}
