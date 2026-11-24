import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { m } from 'motion/react';
import { House, Target, ClipboardCheck, Sparkles, User } from 'lucide-react';
import { DUR, enter, entrance } from '@/lib/motion.js';
import { useApp, today } from '@/lib/store.js';
import { chestWaits } from '@/lib/wardrobe.js';
import { hasNewWork } from '@/lib/classWork.js';
import { hasUnreadReply } from '@/lib/help.js';

import { localized, t } from '@/lib/i18n.js';
let TABS = localized(() => ([
  { to: '/', label: t('shell.shell.1'), icon: House, end: true },
  { to: '/quests', label: t('shell.shell.2'), icon: Target },
  { to: '/exams', label: t('shell.shell.3'), icon: ClipboardCheck },
  { to: '/assistant', label: t('shell.shell.4'), icon: Sparkles },
  { to: '/me', label: t('shell.shell.5'), icon: User },
]), (v) => { TABS = v; });

/**
 * Student layout: content plus the tab bar (bottom on phones, top on wide screens). The missions tab carries a dot
 * when the teacher gave work since the student last opened it (TEACHER-5 §6), or replied to a help request and the
 * reply is not read yet (TEACHER-6 §4); only in a class. And for every student, while a piece for מדי waits in the
 * day's quest chest, not chosen yet (PRODUCT2-36: the end of a lesson or of a teaching stage says it waits there).
 */
export default function Shell() {
  const { pathname } = useLocation();
  // new work from the teacher, or a reply from the teacher not read yet (TEACHER-6 §4)
  const newWork = useApp((s) => !!s.profile?.token && (hasNewWork(s.classWork, s.workOutbox) || hasUnreadReply(s.classWork)));
  const chest = useApp((s) => chestWaits(s.days, s.look, today()));
  return (
    <div className="shell">
      <nav className="tabbar" aria-label={t('shell.shell.6')} data-region="nav">
        <span className="tabbar-brand" aria-hidden="true">{t('shell.shell.7')}</span>
        {TABS.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => `tab${isActive ? ' active' : ''}`}>
            <Icon size={22} aria-hidden="true" />
            {to === '/quests' && (newWork || chest) && <i className="tab-dot" aria-hidden="true" />}
            <span>{label}{to === '/quests' && newWork && <span className="visually-hidden">{t('shell.shell.8')}</span>}{to === '/quests' && chest && <span className="visually-hidden">{t('shell.shell.9')}</span>}</span>
          </NavLink>
        ))}
      </nav>
      <main className="shell-main">
        {/* each screen fades in as it opens, from a visible start (the first screen, drawn before motion's features
            have loaded, at once: entrance). Opacity only: a transform here would make every position: fixed element
            inside the screen (the jump-back button) scroll with the page. */}
        <m.div key={pathname} className="screen" initial={entrance({ opacity: 0.4 })} animate={{ opacity: 1 }} transition={enter(DUR.fast)}>
          <Outlet />
        </m.div>
      </main>
    </div>
  );
}
