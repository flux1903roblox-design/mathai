// The frame of every page in the parents' area: its own bar ("מדרגות · להורים"), no tab bar, and the footer with the
// cancel link, the legal pages, the AI safety statement and the business details (the same on every view, as the
// consumer law asks).
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useApp } from '@/lib/store.js';
import { NeedOnline } from '@/components/durable/OfflineChip.jsx';
import { canSell } from '@/lib/price.js';
import '@/styles/lazy/parents.css'; // the parents' area's rules, loaded with its pages (FOLLOWUP-23)

/** Back only where there is somewhere in the app to go back to: a profile on this device, or a page before this one. */
function useBack() {
  const role = useApp((s) => s.profile?.role);
  const navigate = useNavigate();
  const inApp = typeof window !== 'undefined' && window.history.state && window.history.state.idx > 0;
  if (!role && !inApp) return null;
  return () => (inApp ? navigate(-1) : navigate(role === 'teacher' ? '/teacher' : '/settings'));
}

export function ParentsFooter({ business }) {
  const b = business || {};
  const details = [b.name && b.id ? `${b.name}, ${b.id}` : b.name, b.address].filter(Boolean).join(', ');
  return (
    <footer className="parents-foot" aria-label={canSell() ? 'ביטול מנוי ומידע משפטי' : 'מידע משפטי'}>
      <nav className="parents-foot-links" aria-label="קישורים">
        {canSell() && <Link to="/cancel">ביטול מנוי</Link>}
        <Link to="/terms">תקנון</Link>
        <Link to="/privacy">פרטיות</Link>
        <Link to="/accessibility">הצהרת נגישות</Link>
        <Link to="/safety">בטיחות</Link>
      </nav>
      {(details || b.email) && (
        <p className="parents-foot-biz">{details}{details && b.email ? ' · ' : ''}{b.email && <a href={`mailto:${b.email}`} dir="ltr">{b.email}</a>}</p>
      )}
    </footer>
  );
}

/** `online`: the page needs the network (the account pages). A child's shared week (/r) does not: it reads its link only. */
export default function ParentsFrame({ title = 'מדרגות · להורים', business, children, className, online = true }) {
  const back = useBack();
  return (
    <div className={`page parents ${className || ''}`}>
      <header className="screen-bar parents-bar" data-region="header">
        {back ? <button type="button" className="icon-btn" onClick={back} aria-label="חזרה"><ArrowRight size={24} aria-hidden="true" /></button> : <span className="icon-btn-spacer" aria-hidden="true" />}
        <h1 className="screen-bar-title">{title}</h1>
        <span className="icon-btn-spacer" aria-hidden="true" />
      </header>
      {/* the parents' area works only online (sign-in, the plan, the devices): said once at its top (DURABLE-10) */}
      <main className="parents-main" data-region="content">{online && <NeedOnline />}{children}</main>
      <ParentsFooter business={business} />
    </div>
  );
}

/** The note for a copy of the app without a server: nothing to sign in to, nothing broken. No requests. */
export function NoServerNote() {
  return (
    <section className="card parents-card" aria-labelledby="nosrv-title">
      <h2 id="nosrv-title" className="card-title">אין כאן מנויים בגרסה הזו</h2>
      <p>בגרסה הזו אין שרת, ולכן אין כאן מנויים. התרגול עובד כרגיל. בגרסה המלאה נכנסים כאן עם קוד במייל.</p>
    </section>
  );
}
