// The parents' area (/parents, /parents/link, /cancel): what the smart tutor does and costs, sign-in by an emailed
// code, the parent's free one-time OK for the tutor on a child's device (trust spec TRUST-9), joining through the
// payment company's page, the plan with its devices, and an online cancellation that always stands. It works on the parent's own phone with no profile, and on the child's device only when a parent chose to
// continue there. A child never lands here by accident: the child's screens lead to /parents/info, which has no prices.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import clsx from 'clsx';
import { useApp, STORE_KEY } from '@/lib/store.js';
import { hasServer, errorText } from '@/lib/api.js';
import {
  useParent, overview, plans as loadPlans, startCheckout, pollOrder, cancelPlan, resumePlan, portal, claimLink, unlinkDevice,
  linkThisDevice, signOut, exportData, deleteAccount, keepLinkCode, keptLinkCode, dropLinkCode, endAttempt, dropOrder, openInvoice,
} from '@/lib/parent.js';
import { qaParentView } from '@/lib/qaFixtures.js';
import { formatAgorot, vatLine, perMonth, dateNum, chargeDay } from '@/lib/price.js';
import EmailCodeForm from '@/components/account/EmailCodeForm.jsx';
import AdultGate from '@/components/account/AdultGate.jsx';
import { needsAdultStep } from '@/lib/parentGate.js';
import { Button, Field, Sheet } from '@/components/ui.jsx';
import { ConfirmSheet, LoadingState } from '@/components/Screen.jsx';
import Mascot from '@/components/Mascot.jsx';
import ParentsFrame, { NoServerNote } from './ParentsFrame.jsx';

const RUNNING = ['active', 'past_due', 'canceled'];
const HERE_KEY = `${STORE_KEY}-here`;
const flag = { get: () => { try { return sessionStorage.getItem(HERE_KEY) === '1'; } catch { return false; } }, set: (on) => { try { if (on) sessionStorage.setItem(HERE_KEY, '1'); else sessionStorage.removeItem(HERE_KEY); } catch { /* blocked */ } } };
const addMonths = (d, n) => { const x = new Date(d); const day = x.getDate(); x.setMonth(x.getMonth() + n); if (x.getDate() < day) x.setDate(0); return x; };
const planOf = (plans, id) => plans?.plans?.find((p) => p.id === id) || null;

// ---------------------------------------------------------------- what the tutor is, for a parent who is not signed in
function About({ plans }) {
  const f = plans?.limits?.family;
  const month = planOf(plans, 'family_month'); const year = planOf(plans, 'family_year');
  const vat = vatLine(plans?.vatMode);
  return (
    <section className="card parents-card parents-about" aria-labelledby="about-title">
      <h2 id="about-title" className="card-title">העוזר החכם של מדרגות · להורים</h2>
      <ul className="parents-list">
        <li>מסביר לילד את הטעות שלו, בתרגיל שעל המסך</li>
        <li>בודק דף פתרון מצולם ומראה איפה הטעות</li>
        <li>בודק מבחן שנפתר בבית</li>
        <li>מכין תרגילים חדשים ברמה המתאימה</li>
      </ul>
      <p>חינם תמיד: כל השיעורים והתרגול, ההסברים הכתובים של מדי, ו־{plans?.limits?.free?.tutor ?? 2} שאלות לעוזר החכם ביום. בחינם העוזר עונה בקצרה.</p>
      {f && <p>במנוי: עד {f.tutor} שאלות ביום, {f.check} בדיקות דף, {f.exam} בדיקות מבחן ביום (עד {f.examMonthly} בחודש), {f.generate} סדרות תרגילים, עד {f.devices} מכשירים. בחודש עם שימוש גבוה במיוחד השיחה ממשיכה, ובדיקות הצילום והמבחן נחות עד ה־1 בחודש (שימוש הוגן, מפורט בתקנון).</p>}
      {month && year && <p className="parents-price">{formatAgorot(month.amountAgorot)} לחודש, {vat}<br />או {formatAgorot(year.amountAgorot)} לשנה, {vat}</p>}
      <p>בלי התחייבות. מבטלים כאן באתר בשתי לחיצות. ב־14 הימים הראשונים אפשר לבטל ולקבל את כל הכסף בחזרה.</p>
      {/* what is kept, as the data map says it (trust spec TRUST-1 §5); the parents lane's summary sentence (PARENTS-9) joins this line */}
      <p className="muted">מה נשמר אצלנו: כתובת המייל שלכם, פרטי המנוי והתשלומים (בלי פרטי כרטיס) והמכשירים שחיברתם. לא מבקשים את שם הילד, ולא שומרים את השיחות עם העוזר. מה שכותבים לעוזר נשלח ל־Anthropic בארה״ב כדי לקבל תשובה. <Link to="/privacy">כל הפרטים במדיניות הפרטיות</Link></p>
    </section>
  );
}

// ---------------------------------------------------------------- joining: the plan, the disclosure, two boxes
/** The business behind the plan and the legal pages, shown before any payment (Consumer Protection Law s.14ג). */
function Disclosure({ plans }) {
  const b = plans?.business || {};
  return (
    <section className="parents-disclosure" aria-label="פרטי העסק">
      <p><b>{b.name || 'מדרגות'}</b>{b.id ? ` · ${b.id}` : ''}</p>
      {b.address && <p>{b.address}</p>}
      <p>{b.email && <a href={`mailto:${b.email}`} dir="ltr">{b.email}</a>}{b.email && b.phone ? ' · ' : ''}{b.phone && <a href={`tel:${b.phone}`} dir="ltr">{b.phone}</a>}</p>
      <p><Link to="/terms">התקנון</Link> · <Link to="/privacy">מדיניות הפרטיות</Link> · <Link to="/terms#cancel">מדיניות הביטול</Link></p>
    </section>
  );
}
/** The two boxes every payment asks for, a renewal too (a new consent, trust spec TRUST-10 §3). */
function ConsentBoxes({ adult, setAdult, terms, setTerms }) {
  return (
    <>
      <label className="check-row parents-check"><input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} required /><span>אני מעל גיל 18, ואני ההורה או האפוטרופוס של הילד/ה</span></label>
      <label className="check-row parents-check"><input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} required /><span>קראתי את התקנון ואת מדיניות הביטול</span></label>
    </>
  );
}
const consentError = (adult) => (!adult ? 'כדי להמשיך צריך לאשר שאתם מעל גיל 18 וההורים או האפוטרופוס.' : 'כדי להמשיך צריך לאשר את התקנון ואת מדיניות הביטול.');
/** The one-year plan's line before purchase (TRUST-10 §4): until when, and that it never charges again by itself. */
const yearLine = (until) => `המנוי לשנה אחת, עד ${until}. הוא לא מתחדש מעצמו ולא נחייב אתכם שוב. 45 ימים לפני הסוף נשלח מייל, ואם תרצו, תחדשו בלחיצה.`;

function Checkout({ plans, linkCode, onError, initial = 'family_month' }) {
  const [choice, setChoice] = useState(initial);
  const [adult, setAdult] = useState(false);
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const month = planOf(plans, 'family_month'); const year = planOf(plans, 'family_year');
  const vat = vatLine(plans?.vatMode);
  const exempt = plans?.vatMode === 'exempt';
  const picked = choice === 'family_year' ? year : month;
  const now = new Date().toISOString();
  const next = dateNum(addMonths(new Date(), choice === 'family_year' ? 12 : 1).toISOString());
  if (!plans?.online) {
    return (
      <p className="parents-note">ההצטרפות באתר עוד לא פתוחה. כתבו אל {plans?.contact ? <a href={`mailto:${plans.contact}`} dir="ltr">{plans.contact}</a> : 'מדרגות'} ונפעיל את המנוי לחשבון הזה.</p>
    );
  }
  const go = async () => {
    if (!adult || !terms) { setError(consentError(adult)); return; }
    setError(''); setBusy(true);
    try { await startCheckout(choice, { terms: plans.termsVersion }); } catch (e) { setError(e.message); onError?.(e); setBusy(false); }
  };
  return (
    <div className="parents-checkout stack">
      <div className="ob-opts" role="radiogroup" aria-label="מסלול">
        {month && (
          <button type="button" role="radio" aria-checked={choice === 'family_month'} className={clsx('ob-opt', choice === 'family_month' && 'on')} onClick={() => setChoice('family_month')}>
            <span className="ob-opt-text"><b>חודשי</b><span>{formatAgorot(month.amountAgorot)} לחודש, {vat} · מתחדש כל חודש</span></span>
          </button>
        )}
        {year && (
          <button type="button" role="radio" aria-checked={choice === 'family_year'} className={clsx('ob-opt', choice === 'family_year' && 'on')} onClick={() => setChoice('family_year')}>
            <span className="ob-opt-text"><b>שנתי</b><span>{formatAgorot(year.amountAgorot)} לשנה, {vat} ({perMonth(year.amountAgorot)} לחודש) · לשנה אחת, לא מתחדש מעצמו</span></span>
          </button>
        )}
      </div>
      {picked && (
        <p className="parents-sum">סה״כ לתשלום היום: {formatAgorot(picked.amountAgorot)} ({exempt ? 'המחיר סופי' : 'כולל מע״מ 18%'}).{choice === 'family_month' ? ` החיוב הבא: ${next}.` : ''}</p>
      )}
      {/* how the plan goes on, next to the button (trust spec TRUST-10 §4): the monthly plan renews until cancelled, the
          yearly one is one payment for one year */}
      {picked && choice === 'family_month' && (
        <p className="parents-terms-line">המנוי מתחדש אוטומטית בכל חודש, {chargeDay(now)}, ב־{formatAgorot(month.amountAgorot)} {vat}, עד שמבטלים. מבטלים בכל רגע באתר, במייל או בטלפון, בלי קנס.</p>
      )}
      {picked && choice === 'family_year' && <p className="parents-terms-line">{yearLine(next)}</p>}
      {linkCode && <p className="muted">אחרי התשלום אפשר יהיה לחבר את המכשיר של הילד עם הקוד <bdi dir="ltr" className="mono">{linkCode}</bdi>.</p>}
      <Disclosure plans={plans} />
      <ConsentBoxes adult={adult} setAdult={setAdult} terms={terms} setTerms={setTerms} />
      {error && <p className="form-error" role="alert">{error}</p>}
      <Button className="btn-block btn-lg" onClick={go} disabled={busy}>{busy ? 'פותחים את דף התשלום…' : 'למעבר לתשלום מאובטח'}</Button>
      <p className="footnote">התשלום נעשה בדף של חברת הסליקה. פרטי הכרטיס לא עוברים דרך מדרגות.</p>
    </div>
  );
}

// ---------------------------------------------------------------- renewing a one-year plan (trust spec TRUST-10 §3)
// The year_ending emails link here (/parents?renew=year). A renewal is a new consent: the price, the new year's end,
// the disclosure and the two boxes again, then the payment page. It opens 45 days before the end (renewFrom); earlier,
// the card says from when. The parents lane restyles this card; its rules are the server's (canRenew).
function RenewYear({ plan, plans }) {
  const [adult, setAdult] = useState(false);
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const year = planOf(plans, 'family_year');
  const vat = vatLine(plans?.vatMode);
  const ends = dateNum(plan.periodEnd);
  if (!plan.canRenew || !year) {
    return (
      <section className="card parents-card parents-renew" aria-labelledby="renew-title">
        <h2 id="renew-title" className="card-title">חידוש לשנה נוספת</h2>
        <p>{plan.renewFrom && Date.parse(plan.renewFrom) > Date.now()
          ? `אפשר לחדש את המנוי לשנה נוספת מ־${dateNum(plan.renewFrom)}. נשלח לכם מייל לפני כן.`
          : `השנה הזו כבר חודשה פעם אחת. אחרי ${ends} אפשר להצטרף שוב כאן.`}</p>
      </section>
    );
  }
  const newEnd = dateNum(addMonths(new Date(plan.periodEnd), 12).toISOString());
  const go = async () => {
    if (!adult || !terms) { setError(consentError(adult)); return; }
    setError(''); setBusy(true);
    try { await startCheckout('family_year', { terms: plans.termsVersion }); } catch (e) { setError(e.message); setBusy(false); }
  };
  return (
    <section className="card parents-card parents-renew" aria-labelledby="renew-title">
      <h2 id="renew-title" className="card-title">המנוי לשנה מסתיים ב־{ends}</h2>
      <div className="stack">
        <p>הוא לא מתחדש מעצמו. אם תרצו להמשיך, אפשר לחדש עכשיו לשנה נוספת.</p>
        <p className="parents-sum">שנה נוספת: {formatAgorot(year.amountAgorot)} ({plans?.vatMode === 'exempt' ? 'המחיר סופי' : 'כולל מע״מ 18%'}), מ־{ends} עד {newEnd}.</p>
        <p className="parents-terms-line">גם השנה הנוספת לא מתחדשת מעצמה. ב־14 הימים אחרי התשלום אפשר לבטל אותה ולקבל החזר מלא, והמנוי הנוכחי ממשיך עד {ends}.</p>
        <Disclosure plans={plans} />
        <ConsentBoxes adult={adult} setAdult={setAdult} terms={terms} setTerms={setTerms} />
        {error && <p className="form-error" role="alert">{error}</p>}
        <Button className="btn-block btn-lg" onClick={go} disabled={busy}>{busy ? 'פותחים את דף התשלום…' : `חידוש לשנה נוספת (${formatAgorot(year.amountAgorot)}, ${vat})`}</Button>
        <p className="muted">אחרי {ends} אפשר להצטרף גם למנוי חודשי.</p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- back from the payment page: the order, until it is paid
// The URL is never proof of payment: the order is asked for every 3 s, for up to 90 s. A payment that did not go
// through (the order expired) or has not arrived yet hands the page back (onClosed): the plans and the pay button show
// again, with a line that promises nothing.
function OrderWait({ id, onDone, onClosed }) {
  const [planId, setPlanId] = useState(null);
  useEffect(() => {
    let stop = false; const started = Date.now();
    const tick = async () => {
      if (stop) return;
      try {
        const o = await pollOrder(id);
        setPlanId(o.plan);
        if (o.status === 'paid' && o.subscription) { dropOrder(); endAttempt(o.plan); onDone?.(o); return; }
        if (o.status === 'expired') { dropOrder(); endAttempt(o.plan); onClosed?.('expired'); return; }
      } catch { /* try again */ }
      if (Date.now() - started >= 90_000) { onClosed?.('late'); return; }
      setTimeout(tick, 3000);
    };
    tick();
    return () => { stop = true; };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <section className="card parents-card parents-order" role="status" aria-live="polite">
      <p className="parents-order-line">{planId === 'class_year' ? 'מאשרים את התשלום על הרישיון…' : 'מאשרים את התשלום…'}</p>
    </section>
  );
}

// ---------------------------------------------------------------- cancelling: at most two taps from the plan card
function CancelSheet({ open, onOpenChange, plan, onCancelled, qa }) {
  const [mode, setMode] = useState('period_end');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (open) { setMode('period_end'); setError(''); } }, [open]);
  if (!plan) return null;
  const ends = dateNum(plan.periodEnd);
  // a failed payment: the grace days end with the cancellation, so the tutor works only to the period end, which may
  // already have passed
  const endsNow = plan.status === 'past_due' && Date.parse(plan.periodEnd) <= Date.now();
  const go = async () => {
    setBusy(true); setError('');
    try {
      const r = qa ? { ok: true, status: 'canceled', endsAt: plan.periodEnd, refundAgorot: 0, reference: 'C-7F3A' } : await cancelPlan(plan.id, mode);
      onCancelled(r);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  // the latest payment renewed a one-year plan whose new year has not started: a refund takes only the new year back
  const keeps = plan.renewalUndoEnd ? dateNum(plan.renewalUndoEnd) : null;
  const options = [
    { id: 'period_end', text: endsNow ? 'לבטל עכשיו, בלי חיובים נוספים' : `לבטל בסוף התקופה (העוזר החכם פתוח עד ${ends})` },
    plan.canRefundNow && { id: 'refund_now', text: keeps ? `לבטל את החידוש ולקבל החזר מלא של ${formatAgorot(plan.priceAgorot)} (המנוי ממשיך עד ${keeps})` : `לבטל עכשיו ולקבל החזר מלא של ${formatAgorot(plan.priceAgorot)} (העוזר החכם ייסגר מיד)` },
    plan.canProrata && plan.prorataAgorot > 0 && { id: 'prorata', text: keeps ? `לבטל את החידוש ולקבל החזר של ${formatAgorot(plan.prorataAgorot)} (המנוי ממשיך עד ${keeps})` : `לבטל עכשיו ולקבל החזר יחסי של ${formatAgorot(plan.prorataAgorot)} (העוזר החכם ייסגר מיד)` },
  ].filter(Boolean);
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="לבטל את המנוי?">
      <div className="cancel-sheet stack">
        <p className="lead">{endsNow
          ? 'לא יהיו חיובים נוספים. התשלום האחרון לא עבר, אז העוזר החכם יחזור עכשיו ל־2 שאלות ביום. התרגול, ההתקדמות ומדי נשארים כמו שהם.'
          : `לא יהיו חיובים נוספים. העוזר החכם ימשיך לעבוד עד ${ends}, ואז יחזור ל־2 שאלות ביום. התרגול, ההתקדמות ומדי נשארים כמו שהם.`}</p>
        {options.length > 1 && (
          <div className="ob-opts" role="radiogroup" aria-label="איך לבטל">
            {options.map((o) => (
              <button key={o.id} type="button" role="radio" aria-checked={mode === o.id} className={clsx('ob-opt', mode === o.id && 'on')} onClick={() => setMode(o.id)}>
                <span className="ob-opt-text"><span className="cancel-opt">{o.text}</span></span>
              </button>
            ))}
          </div>
        )}
        {error && <p className="form-error" role="alert">{error}</p>}
        <Button className="btn-block btn-lg" onClick={go} disabled={busy}>{busy ? 'מבטלים…' : 'כן, לבטל'}</Button>
        <Button variant="secondary" className="btn-block" onClick={() => onOpenChange(false)}>להשאיר את המנוי</Button>
      </div>
    </Sheet>
  );
}

// ---------------------------------------------------------------- linking a child's device by its code
const LINK_HOW = 'במכשיר של הילד פותחים אני ← הגדרות ← העוזר החכם ← חיבור למנוי משפחתי, ומקלידים כאן את הקוד שמופיע שם.';
// A claimed code: the child's device takes its token when the screen with the code is open on it (it asks every few seconds)
const LINKED_TEXT = 'קיבלנו את הקוד. המכשיר של הילד יתחבר ברגע שהמסך עם הקוד פתוח בו.';
const OK_TEXT = 'אישרתם את העוזר החכם, ושלחנו לכם מייל עם הפרטים. המכשיר של הילד יתחבר ברגע שהמסך עם הקוד פתוח בו.';
function LinkForm({ onLinked, onFailed, qa, initial = '', notice = null, intro = `חיבור המכשיר של הילד: ${LINK_HOW.replace('במכשיר של הילד', 'במכשיר שלו')}` }) {
  const [code, setCode] = useState(initial);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const go = async (e) => {
    e.preventDefault(); setError(''); setBusy(true);
    try { const r = qa ? { device: { label } } : await claimLink(code, label.trim()); setCode(''); setLabel(''); onLinked(r); } catch (err) { setError(err.message); onFailed?.(err); } finally { setBusy(false); }
  };
  return (
    <form className="stack parents-link" onSubmit={go} noValidate>
      <p>{intro}</p>
      {notice && <p className="parents-note">{notice}</p>}
      <Field label="הקוד מהמכשיר של הילד" id="pl-code">
        <input id="pl-code" className="input mono sub-code" dir="ltr" value={code} maxLength={6} autoCapitalize="characters" autoComplete="off"
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} />
      </Field>
      <Field label="איך לקרוא למכשיר? (לא חובה. בלי שם הילד, למשל: הטאבלט)" id="pl-label">
        <input id="pl-label" className="input" value={label} maxLength={30} onChange={(e) => setLabel(e.target.value)} />
      </Field>
      {error && <p className="form-error" role="alert">{error}</p>}
      <Button type="submit" variant="secondary" className="btn-block" disabled={busy || code.length !== 6}>{busy ? 'מחברים…' : 'חיבור המכשיר'}</Button>
    </form>
  );
}

// ---------------------------------------------------------------- the plan card with its rows
function PlanCard({ acct, plans, qa, onChanged, onCancel, onRenew, renewing }) {
  const p = acct.plan;
  const [open, setOpen] = useState(null); // 'devices' | 'link' | 'payments' | 'card'
  const [unlink, setUnlink] = useState(null);
  const [busy, setBusy] = useState(false);
  const canceled = p.status === 'canceled' || p.cancelAtPeriodEnd;
  const pastDue = p.status === 'past_due' && !canceled;
  const devices = acct.devices || [];
  // receipts of the family's plans (a class licence the same account bought has its own card)
  const payments = (acct.payments || []).filter((x) => x.planKind !== 'class');
  const resume = async () => {
    if (!p.canResume) { onRenew(); return; }
    setBusy(true);
    try { if (!qa) await resumePlan(p.id); toast.success('המנוי חודש'); onChanged(); } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  const doUnlink = async () => {
    const d = unlink; setUnlink(null);
    try { if (!qa) await unlinkDevice(d.id); toast('המכשיר נותק'); onChanged(); } catch (e) { toast.error(e.message); }
  };
  // no payment page for the card at this provider: say who updates it, and how to reach us
  const openPortal = async () => {
    if (!p.portal) { setOpen(open === 'card' ? null : 'card'); return; }
    try { if (!qa) await portal(); } catch (e) { toast.error(e.message); }
  };
  const u = acct.usageWeek || {};
  let status;
  if (canceled) status = `המנוי בוטל. העוזר החכם פתוח עד ${dateNum(p.periodEnd)}, ולא יהיו חיובים נוספים.`;
  else if (pastDue) status = 'התשלום האחרון לא עבר';
  // a one-year plan has no next charge (TRUST-10 §1): only its end
  else if (p.plan === 'family_year') status = `המנוי לשנה פעיל עד ${dateNum(p.periodEnd)}`;
  else if (p.priceAgorot) status = `המנוי פעיל · החיוב הבא: ${formatAgorot(p.priceAgorot)} ב־${dateNum(p.periodEnd)}`;
  else status = `המנוי פעיל עד ${dateNum(p.periodEnd)}`;
  const unlinkName = unlink?.label ? `במכשיר "${unlink.label}"` : 'במכשיר של הילד';
  return (
    <section className={clsx('card parents-card parents-plan', !canceled && 'is-on')} aria-labelledby="plan-title">
      <h2 id="plan-title" className="card-title">{status}</h2>
      {pastDue && <p className="parents-warn">חברת הסליקה תנסה שוב בימים הקרובים, והעוזר החכם ממשיך לעבוד עד {dateNum(p.accessUntil || p.periodEnd)}.</p>}
      {p.plan === 'family_year' && !canceled && <p className="muted">הוא לא מתחדש מעצמו, ולא נחייב אתכם שוב בלי שתבקשו.</p>}
      {p.economy && <p className="parents-note">החודש השימוש גבוה במיוחד, אז עד ה־1 בחודש העוזר עונה בשיחה בגרסה קצרה, ובדיקות הצילום והמבחן נחות. כך כתוב בתקנון, בסעיף שימוש הוגן.</p>}
      {canceled && !renewing && <Button className="btn-block" onClick={resume} disabled={busy}>לחדש את המנוי</Button>}
      <p className="parents-usage">השבוע: {u.tutor || 0} שאלות לעוזר, {u.check || 0} בדיקות דף</p>
      <div className="parents-rows">
        <button type="button" className="set-row" aria-expanded={open === 'devices'} onClick={() => setOpen(open === 'devices' ? null : 'devices')}>מכשירים מחוברים ({devices.length})</button>
        {open === 'devices' && (
          <ul className="parents-devices">
            {devices.length === 0 && <li className="muted">עוד לא חובר מכשיר.</li>}
            {devices.map((d) => (
              <li key={d.id}>
                {/* a claimed code the child's device has yet to collect: it joins once the screen with the code is open on it */}
                <span>{d.label || 'מכשיר'} · {d.pending ? 'ממתין לחיבור: פותחים במכשיר את המסך עם הקוד' : `חובר ב־${dateNum(d.linkedAt)} · שימוש אחרון ${dateNum(d.lastSeen)}`}</span>
                <Button variant="ghost" className="btn-sm" onClick={() => setUnlink(d)}>ניתוק</Button>
              </li>
            ))}
          </ul>
        )}
        {devices.length < (acct.maxDevices || 3) && <button type="button" className="set-row" aria-expanded={open === 'link'} onClick={() => setOpen(open === 'link' ? null : 'link')}>חיבור מכשיר נוסף</button>}
        {open === 'link' && <LinkForm qa={qa} onLinked={() => { toast.success(LINKED_TEXT); setOpen('devices'); onChanged(); }} />}
        {(p.portal || pastDue) && <button type="button" className="set-row" aria-expanded={p.portal ? undefined : open === 'card'} onClick={openPortal}>עדכון אמצעי תשלום</button>}
        {open === 'card' && (
          <p className="parents-note">עדכון אמצעי תשלום נעשה מול חברת הסליקה. כתבו לנו{plans?.contact ? <> אל <a href={`mailto:${plans.contact}`} dir="ltr">{plans.contact}</a></> : ''} ונעזור.</p>
        )}
        {!canceled && <button type="button" className="set-row" onClick={onCancel}>ביטול המנוי</button>}
        <button type="button" className="set-row" aria-expanded={open === 'payments'} onClick={() => setOpen(open === 'payments' ? null : 'payments')}>קבלות וחשבוניות</button>
        {open === 'payments' && <Receipts payments={payments} qa={qa} />}
      </div>
      <ConfirmSheet open={!!unlink} onOpenChange={(o) => !o && setUnlink(null)} title="לנתק את המכשיר?" keep="להשאיר מחובר" confirm="כן, לנתק" onConfirm={doUnlink} mood="idle">
        <p>{plans?.parentOk === false ? `העוזר החכם יחזור ${unlinkName} ל־${plans?.limits?.free?.tutor ?? 2} שאלות ביום.` : `העוזר החכם ${unlinkName} יחכה שוב לאישור שלכם.`} אפשר לחבר אותו שוב בכל זמן.</p>
      </ConfirmSheet>
    </section>
  );
}

// ---------------------------------------------------------------- the parent's free OK for the tutor (TRUST-9)
// A signed-in parent with no plan approves the tutor on a child's device once, for free: the code from the child's
// screen (or this device, when the parent holds it), what the approval means, and a box the parent ticks. The server
// records it (an audit row) and emails the AI and privacy summary. No price here; the plan offer stays below.
function ConsentCard({ plans, linkCode, here, qa, onDone, onFailed }) {
  const [code, setCode] = useState(linkCode || '');
  const [label, setLabel] = useState('');
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const free = plans?.limits?.free?.tutor ?? 2;
  const ask = plans?.paywall === false ? 'כרגע העוזר החכם פתוח בחינם.' : `בחינם, העוזר עונה על ${free === 1 ? 'שאלה קצרה אחת' : `${free} שאלות קצרות`} ביום.`;
  const go = async (e) => {
    e.preventDefault();
    if (!ok) { setError(errorText('consent_required')); return; }
    setError(''); setBusy(true);
    const consent = { purpose: 'consent', consent: true };
    try {
      if (!qa) await (here ? linkThisDevice(label.trim(), consent) : claimLink(code, label.trim(), consent));
      onDone({ here });
    } catch (err) { setError(err.message); onFailed?.(err); setBusy(false); }
  };
  return (
    <section className="card parents-card parents-consent" aria-labelledby="consent-title">
      <h2 id="consent-title" className="card-title">אישור העוזר החכם במכשיר של הילד</h2>
      <form className="stack" onSubmit={go} noValidate>
        <p>{ask} מה שהילד כותב לעוזר נשלח ל־Anthropic בארה״ב כדי לקבל תשובה, ולא נשמר אצלנו. אפשר לבטל את האישור בכל רגע כאן.</p>
        {!here && (
          <Field label="הקוד מהמכשיר של הילד" id="pc-code">
            <input id="pc-code" className="input mono sub-code" dir="ltr" value={code} maxLength={6} autoCapitalize="characters" autoComplete="off"
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} />
          </Field>
        )}
        {!here && !linkCode && <p className="muted">{LINK_HOW}</p>}
        <Field label="איך לקרוא למכשיר? (לא חובה. בלי שם הילד, למשל: הטאבלט)" id="pc-label">
          <input id="pc-label" className="input" value={label} maxLength={30} onChange={(e) => setLabel(e.target.value)} />
        </Field>
        <label className="check-row parents-check"><input type="checkbox" checked={ok} onChange={(e) => { setOk(e.target.checked); if (e.target.checked) setError(''); }} required aria-describedby={error ? 'pc-error' : undefined} /><span>אני ההורה או האפוטרופוס, ואני מאשר/ת לילד/ה להשתמש בעוזר החכם</span></label>
        {error && <p id="pc-error" className="form-error" role="alert">{error}</p>}
        <Button type="submit" className="btn-block btn-lg" disabled={busy || (!here && code.length !== 6)}>{busy ? 'מאשרים…' : 'אישור וחיבור המכשיר'}</Button>
      </form>
    </section>
  );
}

// The devices a parent approved with no plan: each can be taken back here (the email says so).
function ApprovedDevices({ acct, plans, qa, onChanged }) {
  const [unlink, setUnlink] = useState(null);
  const devices = acct.devices || [];
  const doUnlink = async () => {
    const d = unlink; setUnlink(null);
    try { if (!qa) await unlinkDevice(d.id); toast('האישור בוטל'); onChanged(); } catch (e) { toast.error(e.message); }
  };
  const name = unlink?.label ? `במכשיר "${unlink.label}"` : 'במכשיר של הילד';
  return (
    <section className="card parents-card" aria-labelledby="approved-title">
      <h2 id="approved-title" className="card-title">{devices.length === 1 ? 'העוזר החכם מאושר במכשיר אחד' : `העוזר החכם מאושר ב־${devices.length} מכשירים`}</h2>
      <ul className="parents-devices">
        {devices.map((d) => (
          <li key={d.id}>
            <span>{d.label || 'מכשיר'} · {d.pending ? 'ממתין לחיבור: פותחים במכשיר את המסך עם הקוד' : `אושר ב־${dateNum(d.linkedAt)} · שימוש אחרון ${dateNum(d.lastSeen)}`}</span>
            <Button variant="ghost" className="btn-sm" onClick={() => setUnlink(d)}>ביטול האישור</Button>
          </li>
        ))}
      </ul>
      <ConfirmSheet open={!!unlink} onOpenChange={(o) => !o && setUnlink(null)} title="לבטל את האישור?" keep="להשאיר" confirm="כן, לבטל" onConfirm={doUnlink} mood="idle">
        <p>{plans?.parentOk === false ? `העוזר החכם יחזור ${name} ל־${plans?.limits?.free?.tutor ?? 2} שאלות ביום.` : `העוזר החכם לא יענה ${name} עד שתאשרו אותו שוב.`} מדי, השיעורים והתרגול נשארים פתוחים.</p>
      </ConfirmSheet>
    </section>
  );
}

// ---------------------------------------------------------------- class licences this account bought by card
// A teacher sees each licence with its end date, its receipts and, while the licence can be refunded (14 days in
// full, later pro rata), a cancel sheet. A licence does not renew, so there is nothing to stop at the period end.
function ClassLicenceCard({ c, payments, plans, qa, onCancelled }) {
  const p = c.plan;
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [mode, setMode] = useState(p.canRefundNow ? 'refund_now' : 'prorata');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const options = [
    p.canRefundNow && { id: 'refund_now', text: `לבטל עכשיו ולקבל החזר מלא של ${formatAgorot(p.priceAgorot)}` },
    p.canProrata && p.prorataAgorot > 0 && { id: 'prorata', text: `לבטל עכשיו ולקבל החזר יחסי של ${formatAgorot(p.prorataAgorot)}` },
  ].filter(Boolean);
  const mine = payments.filter((x) => x.subscriptionId === p.id);
  const go = async () => {
    setBusy(true); setError('');
    try {
      const r = qa ? { ok: true, status: 'ended', refundAgorot: p.priceAgorot, reference: 'C-7F3A' } : await cancelPlan(p.id, mode);
      setSheet(false); onCancelled(r);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  return (
    <section className="card parents-card parents-plan is-on" aria-labelledby={`lic-${p.id}`}>
      <h2 id={`lic-${p.id}`} className="card-title">רישיון הכיתה <bdi dir="ltr" className="mono">{c.classCode}</bdi> פעיל עד {dateNum(p.periodEnd)}</h2>
      <p className="muted">{p.seats} מקומות · {formatAgorot(p.priceAgorot)} לשנה, {vatLine(plans?.vatMode)} · הרישיון לא מתחדש מעצמו</p>
      <div className="parents-rows">
        <button type="button" className="set-row" aria-expanded={open} onClick={() => setOpen(!open)}>קבלות וחשבוניות</button>
        {open && <Receipts payments={mine} qa={qa} />}
        {options.length > 0 && <button type="button" className="set-row" onClick={() => { setMode(options[0].id); setError(''); setSheet(true); }}>ביטול הרישיון</button>}
      </div>
      <Sheet open={sheet} onOpenChange={setSheet} title="לבטל את רישיון הכיתה?">
        <div className="cancel-sheet stack">
          <p className="lead">התלמידים בכיתה יחזרו ל־2 שאלות ביום לעוזר החכם. התרגול וההתקדמות שלהם נשארים כמו שהם.</p>
          <div className="ob-opts" role="radiogroup" aria-label="איך לבטל">
            {options.map((o) => (
              <button key={o.id} type="button" role="radio" aria-checked={mode === o.id} className={clsx('ob-opt', mode === o.id && 'on')} onClick={() => setMode(o.id)}>
                <span className="ob-opt-text"><span className="cancel-opt">{o.text}</span></span>
              </button>
            ))}
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <Button className="btn-block btn-lg" onClick={go} disabled={busy}>{busy ? 'מבטלים…' : 'כן, לבטל'}</Button>
          <Button variant="secondary" className="btn-block" onClick={() => setSheet(false)}>להשאיר את הרישיון</Button>
        </div>
      </Sheet>
    </section>
  );
}

/** Receipts and invoices: each charge or refund, with the payment company's invoice where there is one. */
function Receipts({ payments, qa }) {
  return (
    <div className="parents-payments">
      {payments.length === 0 ? <p className="muted">עוד אין תשלומים.</p> : (
        <ul>
          {payments.map((x) => (
            <li key={x.id}>
              <span>{dateNum(x.at)} · {formatAgorot(Math.abs(x.amountAgorot))} · {x.kind === 'charge' ? 'חיוב' : x.kind === 'refund' ? 'החזר' : 'ביטול עסקה'}</span>
              {x.hasInvoice && <Button variant="ghost" className="btn-sm" onClick={() => (qa ? null : openInvoice(x.id).catch((e) => toast.error(e.message)))}>חשבונית</Button>}
            </li>
          ))}
        </ul>
      )}
      <p className="footnote">חברת הסליקה שולחת קבלה או חשבונית על כל חיוב והחזר גם במייל.</p>
    </div>
  );
}

/** The cancellation number in an RTL line: isolated, left to right, never broken at its hyphen. */
const Reference = ({ value }) => <bdi dir="ltr" className="mono" style={{ whiteSpace: 'nowrap' }}>{value}</bdi>;

// ---------------------------------------------------------------- the account: sign out, the data, deleting
function AccountRows({ email, qa, onGone }) {
  const [del, setDel] = useState(null); // null | 'confirm' | 'code'
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const out = async (all) => { if (!qa) await signOut({ all }); toast(all ? 'יצאתם מהחשבון בכל המכשירים' : 'יצאתם מהחשבון'); onGone(); };
  const remove = async () => {
    setBusy(true); setError('');
    try {
      if (!qa) await deleteAccount();
      setDel(null); toast('החשבון נמחק'); onGone();
    } catch (e) {
      if (e.code === 'reauth_needed') setDel('code'); else setError(e.message);
    } finally { setBusy(false); }
  };
  return (
    <section className="section set-group parents-account" aria-labelledby="acc-title">
      <h2 id="acc-title" className="set-head">החשבון</h2>
      <p className="muted">מחוברים בתור <bdi dir="ltr" className="mono">{email}</bdi></p>
      <div className="set-rows-wrap"><div className="set-rows">
        <button type="button" className="set-row" onClick={() => (qa ? null : exportData().catch((e) => toast.error(e.message)))}>הורדת הנתונים שלי</button>
        <button type="button" className="set-row" onClick={() => out(false)}>יציאה מהחשבון</button>
        <button type="button" className="set-row" onClick={() => out(true)}>יציאה מכל המכשירים</button>
        <button type="button" className="set-row danger" onClick={() => setDel('confirm')}>מחיקת החשבון</button>
      </div></div>
      <Sheet open={!!del} onOpenChange={(o) => !o && setDel(null)} title="למחוק את החשבון?">
        <div className="stack delete-sheet">
          {del === 'code' ? (
            <>
              <p className="lead">כדי למחוק, שלחנו קוד חדש למייל.</p>
              <EmailCodeForm lockedEmail={email} idPrefix="del" purpose="stepup" onSignedIn={remove} />
            </>
          ) : (
            <>
              <p className="lead">נמחק את כתובת המייל, את הכניסות ואת המכשירים המחוברים. אם יש מנוי, הוא יבוטל והעוזר החכם ייסגר מיד בכל המכשירים. בתוך 14 יום מהתשלום הראשון, בקשו קודם החזר בביטול המנוי.</p>
              {error && <p className="form-error" role="alert">{error}</p>}
              <Button className="btn-block btn-lg" onClick={() => setDel(null)}>לא למחוק</Button>
              <Button variant="ghost" className="btn-block exit-quit" onClick={remove} disabled={busy}>{busy ? 'מוחקים…' : 'כן, למחוק'}</Button>
            </>
          )}
        </div>
      </Sheet>
    </section>
  );
}

// ---------------------------------------------------------------- the page
export default function Parents({ mode = 'home' }) {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const qa = qaParentView();
  const liveSession = useParent((s) => s.session);
  const [qaSession, setQaSession] = useState(qa?.session ?? null);
  const session = qa ? qaSession : liveSession;
  const role = useApp((s) => s.profile?.role);
  const [plans, setPlans] = useState(qa?.plans || null);
  const [acct, setAcct] = useState(qa?.account ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // What just happened, one line at a time (a newer one replaces it, so old news never contradicts the plan card):
  // { tone, text, node? }. It is focused and scrolled into view, so the result of an action is never off-screen.
  const [banner, setBanner] = useState(null);
  const bannerRef = useRef(null);
  const say = (b) => setBanner({ ...b, at: Date.now() });
  useEffect(() => {
    const el = bannerRef.current;
    if (!banner || !el) return;
    el.focus?.({ preventScroll: true });
    el.scrollIntoView?.({ block: 'center', behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, [banner]);
  const [claimed, setClaimed] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [renewing, setRenewing] = useState(false);
  const [linkedHere, setLinkedHere] = useState(false);
  const autoCancel = useRef(false);
  const pendingPolls = useRef(0);
  // On a child's device, an adult step comes before signing in (trust spec TRUST-8): not on /cancel, not with a parent
  // already signed in here, not on a device with no student profile. Passed once per tab.
  const [adultOk, setAdultOk] = useState(false);
  const adultStep = !qa && !adultOk && needsAdultStep({ mode, role, session });
  const server = !qa?.nosrv && (qa || hasServer());
  const orderId = params.get('order');
  // the one-year plan's end-date emails link here with ?renew=year (trust spec TRUST-10 §2)
  const renewAsked = params.get('renew') === 'year';

  // a code from the QR (?c=) and "continue on this device" (?here=1) survive sign-in and the payment page
  useEffect(() => {
    const c = params.get('c');
    if (c && /^[A-Za-z0-9]{6}$/.test(c)) keepLinkCode(c);
    if (params.get('here') === '1') flag.set(true);
  }, [params]);
  const linkCode = qa ? null : keptLinkCode();
  const here = !qa && flag.get();
  // the parent's free OK for the tutor (TRUST-9): offered to a parent with no plan who came to approve a device (the QR
  // code, /parents/link, or "continue on this device"), whether or not the paywall is on
  const wantsOk = plans?.parentOk !== false && role !== 'teacher' && (mode === 'link' || !!linkCode || here);

  const loadAccount = useCallback(async () => {
    if (qa || !server) return;
    if (!useParent.getState().session) { setAcct(null); return; }
    setLoading(true);
    try { setAcct(await overview()); setError(''); } catch (e) { setAcct(null); if (e.code !== 'not_account') setError(e.message); } finally { setLoading(false); }
  }, [qa, server]);

  useEffect(() => {
    if (qa || !server) return;
    loadPlans().then(setPlans).catch((e) => setError(e.message));
  }, [qa, server]);
  useEffect(() => { loadAccount(); }, [liveSession?.token]); // eslint-disable-line react-hooks/exhaustive-deps
  // signing in, or out, changes the whole page: start reading it from the top
  useEffect(() => { window.scrollTo?.(0, 0); }, [liveSession?.token, qaSession?.token, linkedHere]);

  const plan = acct?.plan && RUNNING.includes(acct.plan.status) ? acct.plan : null;
  const classLicences = (acct?.classes || []).filter((c) => c.plan && RUNNING.includes(c.plan.status));

  // A device whose code was claimed shows as waiting until it collects its token: look again for a minute.
  useEffect(() => {
    if (qa || !acct?.devices?.some((d) => d.pending)) { pendingPolls.current = 0; return undefined; }
    if (pendingPolls.current >= 12) return undefined;
    const t = setTimeout(() => { pendingPolls.current += 1; loadAccount(); }, 5000);
    return () => clearTimeout(t);
  }, [acct, qa, loadAccount]);

  // A code from the child's device (the QR) is never claimed by itself: a link someone else sent would otherwise attach
  // their device to this plan at a tap. The code waits, filled in, for the parent to press "חיבור המכשיר".
  const linked = () => {
    dropLinkCode(); setClaimed(true);
    if (params.get('c')) { const next = new URLSearchParams(params); next.delete('c'); setParams(next, { replace: true }); }
    say({ tone: 'good', text: LINKED_TEXT }); loadAccount();
  };
  const linkFailed = (e) => { if (['link_expired', 'link_not_found', 'link_used'].includes(e.code)) dropLinkCode(); };
  // /cancel after sign-in: the cancel sheet opens by itself
  useEffect(() => {
    if (mode === 'cancel' && plan && !plan.cancelAtPeriodEnd && plan.status !== 'canceled' && !autoCancel.current) { autoCancel.current = true; setCancelOpen(true); }
  }, [mode, plan]);

  const signedIn = (r) => { if (qa) setQaSession({ token: 'qa', email: r?.email || 'parent@example.test' }); };
  const gone = () => { if (qa) setQaSession(null); setAcct(null); setBanner(null); };
  const cancelled = (r, { licence = false } = {}) => {
    setCancelOpen(false);
    const refund = r.refundAgorot > 0 ? ' ההחזר יגיע לאמצעי התשלום תוך 14 ימים לכל היותר.' : '';
    const lead = licence ? 'ביטלתם את רישיון הכיתה.' : r.status === 'active' ? 'ביטלתם את החידוש.' : 'ביטלתם.';
    say({ tone: 'good', text: `${lead} שלחנו אישור למייל. מספר אישור: ${r.reference}.${refund}`, node: <>{lead} שלחנו אישור למייל. מספר אישור: <Reference value={r.reference} />.{refund}</> });
    if (qa) { if (!licence) setAcct({ ...acct, plan: { ...acct.plan, status: r.status, cancelAtPeriodEnd: true } }); } else loadAccount();
  };
  const thisDevice = async () => {
    try { await linkThisDevice(''); flag.set(false); setLinkedHere('plan'); setAcct(null); } catch (e) { say({ tone: 'note', text: e.message }); }
  };
  // the free OK went through: on this device the session is already gone (as with the plan); a code waits for the
  // child's device to collect it
  const consented = ({ here: onThis }) => {
    if (onThis) { flag.set(false); setLinkedHere('consent'); setAcct(null); return; }
    dropLinkCode(); setClaimed(true);
    if (params.get('c')) { const next = new URLSearchParams(params); next.delete('c'); setParams(next, { replace: true }); }
    say({ tone: 'good', text: OK_TEXT }); loadAccount();
  };
  const dropOrderParam = () => { const next = new URLSearchParams(params); next.delete('order'); setParams(next, { replace: true }); };
  const orderDone = (o) => {
    say({ tone: 'good', text: o?.plan === 'class_year' ? 'רישיון הכיתה פעיל' : 'המנוי פעיל' });
    dropOrderParam(); loadAccount();
  };
  // a payment that did not go through, or has not arrived after 90 s: the plans and the pay button come back
  const orderClosed = (why) => {
    say({ tone: 'note', text: why === 'expired' ? 'התשלום לא הושלם. אפשר לנסות שוב.' : 'אם התשלום עבר, יגיע מייל ברגע שהמנוי פעיל. אם לא, אפשר לנסות שוב.' });
    dropOrderParam(); loadAccount();
  };

  let body;
  if (!server) body = <NoServerNote />;
  else if (!plans && !error) body = <LoadingState text="טוענים…" />;
  else if (!plans) {
    body = (
      <section className="card parents-card" role="alert">
        <p>{error}</p>
        <Button variant="secondary" onClick={() => { setError(''); loadPlans({ fresh: true }).then(setPlans).catch((e) => setError(e.message)); }}>לנסות שוב</Button>
      </section>
    );
  } else if (!session && adultStep) {
    // in place of the sign-in, and of the prices above it: this screen is for the parent
    body = <AdultGate onPass={() => setAdultOk(true)} />;
  } else if (!session) {
    body = (
      <>
        {linkedHere && (
          <section className="card parents-card is-good" role="status">
            <Mascot mood="happy" size={72} />
            <p>{linkedHere === 'consent' ? 'אישרתם את העוזר החכם במכשיר הזה, ושלחנו לכם מייל עם הפרטים. כדי ששום דבר לא ישתנה מהמכשיר הזה, יצאנו מהחשבון שלכם בו.' : 'המכשיר חובר. כדי שאי אפשר יהיה לשנות את המנוי מהמכשיר הזה, יצאנו מהחשבון שלכם בו.'}</p>
            {role && <Button className="btn-block" onClick={() => navigate(role === 'teacher' ? '/teacher' : '/assistant')}>חזרה לאפליקציה</Button>}
          </section>
        )}
        {plans.paywall === false && <section className="card parents-card"><p className="card-title">כרגע העוזר החכם פתוח בלי מנוי.</p></section>}
        {mode === 'cancel' ? (
          <section className="card parents-card" aria-labelledby="cancel-title">
            <h2 id="cancel-title" className="card-title">ביטול מנוי</h2>
            <p>כדי לבטל, נכנסים עם המייל שאיתו נרשמתם. אחרי הכניסה הביטול לוקח שתי לחיצות. אפשר לבטל גם במייל אל {plans.contact ? <a href={`mailto:${plans.contact}`} dir="ltr">{plans.contact}</a> : 'מדרגות'}{plans.business?.phone ? <> או בטלפון <a href={`tel:${plans.business.phone}`} dir="ltr">{plans.business.phone}</a></> : ''}.</p>
          </section>
        ) : plans.paywall !== false && <About plans={plans} />}
        {(plans.paywall !== false || mode === 'cancel' || wantsOk) && (
          <section className="card parents-card" aria-labelledby="signin-title">
            <h2 id="signin-title" className="card-title">כניסה עם המייל</h2>
            <EmailCodeForm onSignedIn={signedIn} idPrefix="pa" purpose={mode === 'cancel' ? 'cancel' : 'join'} startStep={qa?.step === 'code' ? 'code' : 'email'} presetEmail={qa?.step === 'code' ? 'parent@example.test' : ''} />
          </section>
        )}
      </>
    );
  } else if (!acct && (loading || !error)) body = <LoadingState text="טוענים את החשבון…" />;
  else if (!acct) {
    body = (
      <section className="card parents-card" role="alert">
        <p>{error}</p>
        <Button variant="secondary" onClick={loadAccount}>לנסות שוב</Button>
      </section>
    );
  } else {
    body = (
      <>
        {orderId && <OrderWait id={orderId} onDone={orderDone} onClosed={orderClosed} />}
        {qa?.confirming && <section className="card parents-card parents-order" role="status"><p className="parents-order-line">מאשרים את התשלום…</p></section>}
        {banner && (
          <section key={banner.at} ref={bannerRef} tabIndex={-1} className={clsx('card parents-card parents-banner', banner.tone === 'good' && 'is-good')} role="status">
            <p>{banner.node || banner.text}</p>
          </section>
        )}
        {banner?.text === 'רישיון הכיתה פעיל' && role === 'teacher' && <Link to="/teacher" className="btn btn-primary btn-block">חזרה ללוח המורה</Link>}
        {acct.billingHold && <p className="parents-warn">יש בירור פתוח על תשלום קודם. כתבו אלינו אל {plans.contact ? <a href={`mailto:${plans.contact}`} dir="ltr">{plans.contact}</a> : 'מדרגות'}.</p>}
        {plans.paywall === false && <section className="card parents-card"><p className="card-title">כרגע העוזר החכם פתוח בלי מנוי.</p></section>}
        {plan && <PlanCard acct={acct} plans={plans} qa={!!qa} onChanged={loadAccount} onCancel={() => setCancelOpen(true)} onRenew={() => setRenewing(true)} renewing={renewing} />}
        {plan?.plan === 'family_year' && plan.status === 'active' && (plan.canRenew || renewAsked) && !orderId && !acct.billingHold && plans.paywall !== false && (
          <RenewYear plan={plan} plans={plans} />
        )}
        {plan && here && (
          <section className="card parents-card" aria-labelledby="here-title">
            <h2 id="here-title" className="card-title">המכשיר הזה</h2>
            <Button className="btn-block btn-lg" onClick={thisDevice}>להפעיל את העוזר החכם במכשיר הזה</Button>
          </section>
        )}
        {plan && !here && linkCode && !claimed && (
          <section className="card parents-card" aria-labelledby="qr-link">
            <h2 id="qr-link" className="card-title">חיבור המכשיר של הילד</h2>
            <LinkForm qa={!!qa} initial={linkCode} intro="הקוד מהמכשיר של הילד כבר כאן. אפשר לתת למכשיר שם, ואז ללחוץ על חיבור המכשיר."
              notice="המכשיר שמציג את הקוד הזה יקבל את העוזר החכם דרך המנוי שלכם. חברו רק מכשיר של הילד שלכם." onLinked={linked} onFailed={linkFailed} />
          </section>
        )}
        {plan && !here && !linkCode && !claimed && (acct.devices?.length || 0) === 0 && (
          <section className="card parents-card" aria-labelledby="first-link">
            <h2 id="first-link" className="card-title">חיבור המכשיר של הילד</h2>
            <LinkForm qa={!!qa} intro={LINK_HOW} onLinked={linked} />
          </section>
        )}
        {!plan && wantsOk && !claimed && (
          <ConsentCard plans={plans} linkCode={linkCode} here={here} qa={!!qa} onDone={consented} onFailed={linkFailed} />
        )}
        {!plan && (acct.devices?.length || 0) > 0 && <ApprovedDevices acct={acct} plans={plans} qa={!!qa} onChanged={loadAccount} />}
        {classLicences.map((c) => (
          <ClassLicenceCard key={c.plan.id} c={c} payments={acct.payments || []} plans={plans} qa={!!qa} onCancelled={(r) => cancelled(r, { licence: true })} />
        ))}
        {(!plan || renewing) && !acct.billingHold && plans.paywall !== false && !orderId && role !== 'teacher' && (
          <section className="card parents-card" aria-labelledby="join-title">
            <h2 id="join-title" className="card-title">{plan ? 'מנוי חדש' : 'אין מנוי פעיל'}</h2>
            <Checkout plans={plans} linkCode={linkCode} initial={renewAsked ? 'family_year' : 'family_month'} />
          </section>
        )}
        <CancelSheet open={cancelOpen} onOpenChange={setCancelOpen} plan={plan} onCancelled={cancelled} qa={!!qa} />
        <AccountRows email={qa ? qaSession?.email : session.email} qa={!!qa} onGone={gone} />
      </>
    );
  }
  return <ParentsFrame business={plans?.business}>{body}</ParentsFrame>;
}
