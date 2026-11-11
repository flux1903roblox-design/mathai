import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { m } from 'motion/react';
import { House, Target, ClipboardCheck, Sparkles, User } from 'lucide-react';
import { DUR, enter } from '@/lib/motion.js';
import { useApp } from '@/lib/store.js';
import { hasNewWork } from '@/lib/classWork.js';
import { hasUnreadReply } from '@/lib/help.js';

const TABS = [
  { to: '/', label: 'לימוד', icon: House, end: true },
  { to: '/quests', label: 'משימות', icon: Target },
  { to: '/exams', label: 'מבחנים', icon: ClipboardCheck },
  { to: '/assistant', label: 'עוזר AI', icon: Sparkles },
  { to: '/me', label: 'אני', icon: User },
];

/**
 * Student layout: content plus the tab bar (bottom on phones, top on wide screens). The missions tab carries a dot
 * when the teacher gave work since the student last opened it (TEACHER-5 §6), or replied to a help request and the
 * reply is not read yet (TEACHER-6 §4); only in a class.
 */
export default function Shell() {
  const { pathname } = useLocation();
  // new work from the teacher, or a reply from the teacher not read yet (TEACHER-6 §4)
  const newWork = useApp((s) => !!s.profile?.token && (hasNewWork(s.classWork, s.workOutbox) || hasUnreadReply(s.classWork)));
  return (
    <div className="shell">
      <nav className="tabbar" aria-label="ניווט ראשי" data-region="nav">
        <span className="tabbar-brand" aria-hidden="true">מדרגות</span>
        {TABS.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => `tab${isActive ? ' active' : ''}`}>
            <Icon size={22} aria-hidden="true" />
            {to === '/quests' && newWork && <i className="tab-dot" aria-hidden="true" />}
            <span>{label}{to === '/quests' && newWork && <span className="visually-hidden"> · יש משהו חדש מהמורה</span>}</span>
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
