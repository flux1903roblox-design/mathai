// The tutor's subscription, for whoever pays: a parent (the family plan, signed in with a code sent by email) or a
// school (a class licence, by invoice). The student reaches it from the tutor ("פרטים על המנוי, להורים") and shows it
// to a parent. One card says where things stand today; then what the free taste and the subscription each include;
// then the parent's sign-in and plan; then the school's licence. Cancelling is online, on this screen, and the plan
// runs to the end of the paid period. Nothing here holds a secret: the Claude key and the payment stay on the server
// and with the payment company.
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import clsx from 'clsx';
import { Check, Minus } from 'lucide-react';
import { useApp } from '@/lib/store.js';
import { hasServer } from '@/lib/api.js';
import {
  useAIStatus, refreshStatus, sendCode, verifyCode, signOutAccount, deleteAccount, startCheckout, cancelPlan, teacherClass,
} from '@/lib/account.js';
import { ScreenBar, ConfirmSheet, LoadingState } from '@/components/Screen.jsx';
import { Button, Field } from '@/components/ui.jsx';
import { leftText } from '@/components/AIAllowance.jsx';

const dateText = (iso) => {
  try { return new Date(iso).toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jerusalem' }); } catch { return ''; }
};

/** Where things stand today: one card. */
function StatusCard({ status, teacher }) {
  const plan = status.plan;
  if (status.tier === 'paid') {
    const family = plan?.kind === 'family';
    const ends = plan?.endsAt ? dateText(plan.endsAt) : '';
    return (
      <section className="card sub-status is-paid" aria-labelledby="sub-now">
        <h2 id="sub-now" className="card-title">{family ? 'המנוי המשפחתי פעיל' : teacher ? 'לכיתה יש רישיון לעוזר' : 'העוזר כלול ברישיון של הכיתה'}</h2>
        {ends && <p className="muted">{plan.cancelAtPeriodEnd ? `המנוי בוטל, והעוזר פתוח עד ${ends}.` : family ? `מתחדש ב־${ends}.` : `הרישיון בתוקף עד ${ends}.`}</p>}
        {plan?.status === 'past_due' && <p className="form-error">התשלום האחרון לא עבר. כדאי לעדכן את אמצעי התשלום אצל חברת הסליקה.</p>}
        <Meter used={status.used} limit={status.limit} label={teacher ? 'שאלות של המורה היום' : 'שאלתם היום'} />
      </section>
    );
  }
  return (
    <section className="card sub-status" aria-labelledby="sub-now">
      <h2 id="sub-now" className="card-title">העוזר בחינם</h2>
      <p className="muted">{leftText(status.left)} {teacher ? 'בלי רישיון, כל תלמיד בכיתה מקבל אותן שאלות חינם.' : ''}</p>
      <Meter used={status.used} limit={status.limit} label="שאלתם היום" />
    </section>
  );
}

function Meter({ used, limit, label }) {
  const u = Math.min(used || 0, limit || 0);
  return (
    <div className="sub-meter">
      <div className="sub-meter-row"><span>{label}</span><span>{u} מתוך {limit}</span></div>
      <div className="sub-meter-bar" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={limit} aria-valuenow={u}><i style={{ width: `${limit ? (u / limit) * 100 : 0}%` }} /></div>
    </div>
  );
}

/** What each way includes. The numbers come from the server, so the page never promises what the server does not do. */
function Compare({ status, teacher }) {
  const free = status?.offer?.daily?.free ?? 2;
  const paidLimit = status?.offer?.daily?.paid ?? 40;
  const rows = [
    ['שאלות ביום', `${free}`, teacher ? `${paidLimit} לתלמיד` : `${paidLimit}`],
    ['הסבר טעות ושיחה', true, true],
    ['אורך ההסבר', 'קצר', 'מלא'],
    ['בדיקת פתרון מצולם', false, true],
    ['בדיקת מבחן מצולם', false, true],
    ['תרגילים חדשים', false, true],
  ];
  const price = status?.offer?.family?.price;
  const cell = (v) => (v === true ? <Check size={20} aria-label="כלול" className="sub-yes" /> : v === false ? <Minus size={20} aria-label="לא כלול" className="sub-no" /> : v);
  return (
    <section className="section" aria-labelledby="sub-compare">
      <h2 id="sub-compare" className="set-head">מה כלול</h2>
      <table className="sub-table">
        <thead><tr><th scope="col"><span className="visually-hidden">מה</span></th><th scope="col">חינם</th><th scope="col">{teacher ? 'רישיון כיתה' : 'מנוי'}</th></tr></thead>
        <tbody>
          {rows.map(([name, a, b]) => <tr key={name}><th scope="row">{name}</th><td>{cell(a)}</td><td>{cell(b)}</td></tr>)}
          {!teacher && <tr><th scope="row">מחיר</th><td>חינם</td><td>{price || 'יפורסם בקרוב'}</td></tr>}
        </tbody>
      </table>
      <p className="footnote">השיעורים, המפה, המשימות והבדיקות של מדרגות עצמן נשארים חינם, עם מנוי ובלעדיו.</p>
    </section>
  );
}

/** A parent signs in with a 6-digit code sent to their email: no password to remember. */
function ParentSignIn() {
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState(''); const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [resendAt, setResendAt] = useState(0); const [now, setNow] = useState(Date.now());
  useEffect(() => { if (step !== 'code') return undefined; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [step]);
  const wait = Math.max(0, Math.ceil((resendAt - now) / 1000));

  const ask = async (e) => {
    e?.preventDefault(); setError(''); setBusy(true);
    try {
      await sendCode(email.trim());
      setStep('code'); setCode(''); setResendAt(Date.now() + 60_000); setNow(Date.now());
      setTimeout(() => document.getElementById('sub-code')?.focus(), 50);
    } catch (err) {
      if (err.code === 'wait_to_resend' && err.data?.retryAfter) { setStep('code'); setResendAt(Date.now() + err.data.retryAfter * 1000); setNow(Date.now()); }
      setError(err.message);
    } finally { setBusy(false); }
  };
  const verify = async (e) => {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      await verifyCode(email.trim(), code);
      toast.success('נכנסתם לחשבון');
    } catch (err) {
      setError(err.code === 'wrong_code' && Number.isFinite(err.data?.left) ? `${err.message} נשארו עוד ${err.data.left} ניסיונות.` : err.message);
    } finally { setBusy(false); }
  };

  return (
    <section className="section set-group" aria-labelledby="sub-parent">
      <h2 id="sub-parent" className="set-head">להורים: כניסה עם מייל</h2>
      {step === 'email' ? (
        <form className="stack" onSubmit={ask} noValidate>
          <Field label="כתובת המייל שלכם" id="sub-email" hint="נשלח אליה קוד של 6 ספרות. אין סיסמה.">
            <input id="sub-email" type="email" inputMode="email" autoComplete="email" dir="ltr" className="input" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} />
          </Field>
          {error && <p className="form-error" role="alert">{error}</p>}
          <Button type="submit" disabled={busy || !email.includes('@')}>{busy ? 'שולחים…' : 'שליחת קוד'}</Button>
        </form>
      ) : (
        <form className="stack" onSubmit={verify} noValidate>
          <Field label="הקוד מהמייל" id="sub-code" hint={<>שלחנו קוד אל <bdi dir="ltr">{email}</bdi>. הוא בתוקף 10 דקות.</>}>
            <input id="sub-code" className="input mono sub-code" dir="ltr" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
          </Field>
          {error && <p className="form-error" role="alert">{error}</p>}
          <Button type="submit" disabled={busy || code.length !== 6}>{busy ? 'בודקים…' : 'כניסה'}</Button>
          <div className="sub-links">
            <Button variant="ghost" className="btn-sm" disabled={busy || wait > 0} onClick={ask}>{wait > 0 ? `קוד חדש בעוד ${wait} שניות` : 'שליחת קוד חדש'}</Button>
            <Button variant="ghost" className="btn-sm" onClick={() => { setStep('email'); setError(''); }}>לשנות כתובת</Button>
          </div>
        </form>
      )}
    </section>
  );
}

/** Signed in: the plan, joining, cancelling online, signing out and deleting the account. */
function ParentAccount({ status }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [sheet, setSheet] = useState(null);
  const plan = status.plan?.kind === 'family' ? status.plan : null;
  const online = !!status.offer?.family?.online;
  const contact = status.offer?.school?.contact;
  const run = async (fn) => { setError(''); setBusy(true); try { await fn(); } catch (e) { setError(e.message); } finally { setBusy(false); } };

  const join = () => run(async () => { const url = await startCheckout(); if (url) window.location.assign(url); });
  const cancel = () => run(async () => {
    const r = await cancelPlan(); setSheet(null);
    toast.success(r.endsAt ? `המנוי בוטל. העוזר פתוח עד ${dateText(r.endsAt)}.` : 'המנוי בוטל.');
  });
  const remove = () => run(async () => { await deleteAccount(); setSheet(null); toast('החשבון נמחק'); });

  return (
    <section className="section set-group" aria-labelledby="sub-account">
      <h2 id="sub-account" className="set-head">החשבון שלכם</h2>
      <div className="set-box stack">
        <p>מחוברים בתור <bdi dir="ltr" className="mono">{status.email}</bdi></p>
        {!plan && (online
          ? <Button className="btn-block" disabled={busy} onClick={join}>{busy ? 'פותחים את התשלום…' : 'הצטרפות למנוי המשפחתי'}</Button>
          : <p className="muted">ההצטרפות באתר עוד לא פתוחה. {contact ? <>כתבו אל <a href={`mailto:${contact}?subject=${encodeURIComponent('מנוי משפחתי לעוזר של מדרגות')}`} dir="ltr">{contact}</a> ונפעיל את המנוי לחשבון הזה.</> : 'נעדכן כאן כשהיא תיפתח.'}</p>)}
        {online && !plan && <p className="footnote">התשלום נעשה בדף של חברת הסליקה. פרטי הכרטיס לא עוברים דרך מדרגות.</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
      </div>
      <div className="set-rows-wrap">
        <div className="set-rows">
          {plan && !plan.cancelAtPeriodEnd && <button type="button" className="set-row" onClick={() => setSheet('cancel')}>ביטול המנוי</button>}
          <button type="button" className="set-row" onClick={() => run(signOutAccount)}>יציאה מהחשבון במכשיר הזה</button>
          <button type="button" className="set-row danger" onClick={() => setSheet('delete')}>מחיקת החשבון</button>
        </div>
      </div>
      <ConfirmSheet open={sheet === 'cancel'} onOpenChange={(o) => !o && setSheet(null)} title="לבטל את המנוי?" keep="להשאיר את המנוי" mood="idle"
        confirm={busy ? 'מבטלים…' : 'כן, לבטל'} onConfirm={cancel}>
        <p>המנוי לא יתחדש. העוזר נשאר פתוח עד {plan?.endsAt ? dateText(plan.endsAt) : 'סוף התקופה ששולמה'}, ואחר כך חוזרות 2 השאלות החינמיות ביום.</p>
      </ConfirmSheet>
      <ConfirmSheet open={sheet === 'delete'} onOpenChange={(o) => !o && setSheet(null)} title="למחוק את החשבון?" keep="לא למחוק"
        confirm={busy ? 'מוחקים…' : 'כן, למחוק'} onConfirm={remove}>
        <p>נמחק את כתובת המייל ואת הכניסות מכל המכשירים. {plan && !plan.cancelAtPeriodEnd ? 'קודם צריך לבטל את המנוי.' : ''} ההתקדמות של התלמיד נשארת במכשיר.</p>
      </ConfirmSheet>
    </section>
  );
}

function SchoolSection({ status, teacher }) {
  const contact = status?.offer?.school?.contact;
  return (
    <section className="section set-group" aria-labelledby="sub-school">
      <h2 id="sub-school" className="set-head">{teacher ? 'רישיון לכיתה' : 'לבית ספר או למורה'}</h2>
      <div className="set-box stack">
        <p>רישיון כיתה פותח את העוזר לכל התלמידים בכיתה ולמורה, בלי שההורים צריכים להירשם. מתאים לבית ספר, עם חשבונית.</p>
        {contact
          ? <p>לפרטים: <a href={`mailto:${contact}?subject=${encodeURIComponent('רישיון כיתה לעוזר של מדרגות')}`} dir="ltr">{contact}</a>{teacher ? <>. כתבו את קוד הכיתה <bdi dir="ltr" className="mono">{teacherClass()?.code}</bdi>.</> : ''}</p>
          : <p className="muted">הפרטים יפורסמו כאן בקרוב.</p>}
      </div>
    </section>
  );
}

export default function Subscription() {
  const role = useApp((s) => s.profile?.role);
  const signedIn = useApp((s) => !!s.ai.account);
  const { status, loading, error } = useAIStatus();
  const teacher = role === 'teacher';
  useEffect(() => {
    refreshStatus();
    // back from the payment page, or from another app: what the server says now
    const onShow = () => { if (document.visibilityState === 'visible') refreshStatus(); };
    document.addEventListener('visibilitychange', onShow);
    return () => document.removeEventListener('visibilitychange', onShow);
  }, []);

  let body;
  if (!hasServer()) {
    body = (
      <>
        <section className="card sub-status" aria-labelledby="sub-now">
          <h2 id="sub-now" className="card-title">בגרסה הזו אין מנוי</h2>
          <p className="muted">המנוי לעוזר עובד דרך השרת של מדרגות, ובגרסה הזו אין שרת מחובר. השיעורים, המפה והמשימות עובדים כרגיל.</p>
        </section>
        <Compare status={null} teacher={teacher} />
      </>
    );
  } else if (!status && loading) {
    body = <LoadingState text="בודקים את המנוי…" />;
  } else if (!status) {
    body = (
      <section className="card sub-status" aria-labelledby="sub-now">
        <h2 id="sub-now" className="card-title">לא הצלחנו לבדוק את המנוי</h2>
        <p className="form-error" role="alert">{error === 'network' ? 'אין חיבור לשרת. בדקו את האינטרנט ונסו שוב.' : 'השרת לא ענה כמו שצריך. נסו שוב בעוד רגע.'}</p>
        <Button variant="secondary" onClick={() => refreshStatus()}>לנסות שוב</Button>
      </section>
    );
  } else {
    body = (
      <>
        {!status.aiReady && <p className="form-error sub-note" role="status">העוזר עוד לא מחובר בשרת, אז כרגע הוא לא עונה, גם במנוי.</p>}
        <StatusCard status={status} teacher={teacher} />
        <Compare status={status} teacher={teacher} />
        {!teacher && (signedIn && status.signedIn ? <ParentAccount status={status} /> : <ParentSignIn />)}
        <SchoolSection status={status} teacher={teacher} />
        <p className="footnote sub-privacy">שומרים רק את כתובת המייל של מי שנכנס לחשבון, כדי לזהות את המנוי. אפשר למחוק אותה מהמסך הזה בכל זמן.</p>
      </>
    );
  }

  return (
    <div className={clsx('page pushed subscription')}>
      <ScreenBar title="העוזר והמנוי" back={teacher ? '/teacher' : undefined} />
      {body}
    </div>
  );
}
