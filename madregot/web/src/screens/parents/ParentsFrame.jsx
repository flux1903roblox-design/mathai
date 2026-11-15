// The frame of every page in the parents' area: its own bar ("מדרגות · להורים"), no tab bar, and the footer with the
// cancel link, the legal pages, the AI safety statement and the business details (the same on every view, as the
// consumer law asks).
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useApp } from '@/lib/store.js';
import { NeedOnline } from '@/components/durable/OfflineChip.jsx';
import { canSell } from '@/lib/price.js';
import '@/styles/lazy/parents.css'; // the parents' area's rules, loaded with its pages (FOLLOWUP-23)
import { PLAN_INCLUDES, NO_SERVER } from '@/content/familyPlan.js';

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

/**
 * The card of a copy of the app without a server (PRODUCT2-33): what the family plan includes, in the words of
 * content/familyPlan.js that the parents' page and the public pages say, then that nothing can be bought here and that
 * every lesson is free. No price, no checkout, no requests. It also shows on /parents/info, which a child may open.
 */
export function NoServerNote() {
  return (
    <section className="card parents-card parents-nosrv" aria-labelledby="nosrv-title">
      <h2 id="nosrv-title" className="card-title">{NO_SERVER.title}</h2>
      <ul className="plain-list">{PLAN_INCLUDES.map((x) => <li key={x.id}>{x.text}</li>)}</ul>
      <p className="parents-nosrv-body">{NO_SERVER.body}</p>
    </section>
  );
}
