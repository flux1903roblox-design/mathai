// The class settings (spec TEACHER-9, TEACHER-1 §6), at /teacher/settings, for the class open on the board, in the
// spec's order: its name, grade, code and join lock; how the teacher gets in (the email it is bound to, the teacher key
// for a co-teacher, a new key); student AI by the Ministry's rules (ClassAICard, TRUST-11); the class licence (when the
// paid tutor is on; "מחר" keeps a one-line link to it while it ends); the daily help email (its owner only); how long
// the server keeps the class's data; and, at the end of the year, the year's report (its CSV) and deleting the class.
import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowRight, Copy, Trash2, FileDown } from 'lucide-react';
import { useApp } from '@/lib/store.js';
import { useParent } from '@/lib/parent.js';
import { teacherApi, renameClass, rekey, useEmailSignIn } from '@/lib/teacher.js';
import { useAIStatus } from '@/lib/account.js';
import { rememberBoard, boardOf } from '@/lib/teacherBoard.js';
import { DEMO_COPY } from '@/lib/demo.js';
import { retentionLines } from '@/content/retention.js';
import { Button, Field, Sheet } from '@/components/ui.jsx';
import EmailCodeForm from '@/components/account/EmailCodeForm.jsx';
import ClassAICard from '@/components/teacher/ClassAICard.jsx';
import LicenceCard from '@/components/teacher/LicenceCard.jsx';
import { copy } from './common.jsx';
import { useBind } from './ClassAccount.jsx';
import DeleteClassSheet, { useClassDeleted } from './DeleteClass.jsx';

const GRADE = { 7: 'ז׳', 8: 'ח׳' };
export const YEAR_END_TEXT = 'בסוף השנה כדאי להוריד את הדוח ולמחוק את הכיתה. בשנה הבאה פותחים כיתה חדשה, והתלמידים מצטרפים עם קוד חדש.';
const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();

/** הכיתה: the name, the grade, the code and the join lock. */
function ClassSection({ cls, locked, onLock }) {
  const [name, setName] = useState(cls.className);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setName(cls.className); }, [cls.code, cls.className]);
  const changed = !!clean(name) && clean(name) !== clean(cls.className);
  const save = async (e) => {
    e.preventDefault();
    if (!changed || busy) return;
    setBusy(true);
    try { await renameClass(cls, clean(name)); toast.success('שם הכיתה עודכן.'); } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };
  return (
    <section className="section set-group t-set" aria-labelledby="ts-class">
      <h2 id="ts-class" className="set-head">הכיתה</h2>
      <div className="set-box">
        <form className="t-set-rename" onSubmit={save} noValidate>
          <Field label="שם הכיתה" id="ts-name">
            <input id="ts-name" className="input" value={name} maxLength={30} onChange={(e) => setName(e.target.value)} autoComplete="off" />
          </Field>
          <Button type="submit" variant="secondary" className="btn-sm" disabled={!changed || busy}>{busy ? 'שומרים…' : 'שמירה'}</Button>
        </form>
        <div className="field">
          <span className="field-label" id="ts-grade">שכבה</span>
          <p className="t-set-value" aria-labelledby="ts-grade">כיתה {GRADE[cls.grade] || cls.grade}</p>
          <p className="field-hint">שכבה חדשה? פותחים כיתה חדשה בתחילת השנה.</p>
        </div>
        <div className="field">
          <span className="field-label">קוד הכיתה</span>
          <button type="button" className="code-chip t-set-chip" onClick={() => copy(cls.code, 'קוד הכיתה')} aria-label={`העתקת קוד הכיתה ${cls.code}`}>
            <span dir="ltr">{cls.code}</span><Copy size={16} aria-hidden="true" />
          </button>
        </div>
        <div className="t-lock">
          <label className="check-row t-lock-row">
            <input type="checkbox" role="switch" checked={!!locked} disabled={locked === null} onChange={(e) => onLock(e.target.checked)} />
            <span>נעילת הכיתה לתלמידים חדשים</span>
          </label>
          <p className="field-hint">תלמידים שכבר בכיתה ממשיכים להיכנס עם הקוד האישי שלהם.</p>
        </div>
      </div>
    </section>
  );
}

/** A new teacher key: what it does, then a fresh code to the email, then the key to copy (TEACHER-1 §6). */
function RekeySheet({ cls, email, open, onOpenChange }) {
  const [step, setStep] = useState('ask'); // ask | code | done
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { if (open) { setStep('ask'); setKey(''); setError(''); } }, [open]);
  const make = async () => {
    setError('');
    try { const r = await rekey(cls); setKey(r.teacherKey); setStep('done'); } catch (e) { setError(e.message); }
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={step === 'done' ? 'מפתח מורה חדש' : 'ליצור מפתח מורה חדש?'}>
      {step === 'ask' && (
        <div className="stack">
          <p className="lead">המפתח הישן יפסיק לעבוד בכל מכשיר שנכנס איתו. מי שנכנס עם המייל ממשיך כרגיל. כדי לאשר, נשלח קוד למייל.</p>
          <Button className="btn-block btn-lg" onClick={() => setStep('code')}>ליצור מפתח חדש</Button>
          <Button variant="ghost" className="btn-block" onClick={() => onOpenChange(false)}>לא עכשיו</Button>
        </div>
      )}
      {step === 'code' && (
        <div className="stack">
          <EmailCodeForm lockedEmail={email} idPrefix="rk" purpose="rekey" onSignedIn={make} />
          {error && <p className="form-error" role="alert">{error}</p>}
        </div>
      )}
      {step === 'done' && (
        <div className="stack">
          <p className="lead">המפתח החדש מוכן. אפשר להעתיק אותו למורה נוסף.</p>
          <button type="button" className="code-chip t-set-chip" onClick={() => copy(key, 'מפתח המורה')} aria-label={`העתקת המפתח החדש ${key}`}>
            <span dir="ltr">{key}</span><Copy size={16} aria-hidden="true" />
          </button>
          <Button className="btn-block btn-lg" onClick={() => onOpenChange(false)}>סיום</Button>
        </div>
      )}
    </Sheet>
  );
}

/** הכניסה לכיתה: the email the class is bound to (or binding it), the teacher key, a new key. */
function AccessSection({ cls, demo }) {
  const session = useParent((s) => s.session);
  const emailOn = useEmailSignIn();
  const bind = useBind(cls);
  const [rekeying, setRekeying] = useState(false);
  // the demo class has no email and no key to give
  if (demo) {
    return (
      <section className="section set-group t-set" aria-labelledby="ts-access">
        <h2 id="ts-access" className="set-head">הכניסה לכיתה</h2>
        <div className="set-box"><p className="t-set-line muted" id="ts-demo-access">{DEMO_COPY.noDelete}</p></div>
      </section>
    );
  }
  return (
    <section className="section set-group t-set" aria-labelledby="ts-access">
      <h2 id="ts-access" className="set-head">הכניסה לכיתה</h2>
      <div className="set-box">
        {cls.owned ? (
          <p className="t-set-line">{session?.email ? <>מקושרת ל־<bdi dir="ltr">{session.email}</bdi>.</> : 'הכיתה מקושרת למייל.'}</p>
        ) : (
          <div className="t-set-bind">
            <p className="t-set-line">הכיתה עוד לא מקושרת למייל. אם המכשיר הזה ילך לאיבוד, לא תוכלו לחזור אליה.</p>
            {bind.error && <p className="form-error" role="alert">{bind.error}</p>}
            {emailOn && cls.key && <Button variant="secondary" className="btn-sm" onClick={bind.start} disabled={bind.busy}>{bind.busy ? 'מקשרים…' : 'לקשר למייל שלי'}</Button>}
            {bind.sheet}
          </div>
        )}
        <div className="field">
          <span className="field-label">מפתח מורה (למורה נוסף או למכשיר בלי מייל)</span>
          {cls.key ? (
            <button type="button" className="code-chip t-set-chip" onClick={() => copy(cls.key, 'מפתח המורה')} aria-label={`העתקת מפתח המורה ${cls.key}`}>
              <span dir="ltr">{cls.key}</span><Copy size={16} aria-hidden="true" />
            </button>
          ) : <p className="muted t-set-line">המפתח לא שמור במכשיר הזה.</p>}
        </div>
        {cls.owned && session?.email && (
          <>
            <Button variant="secondary" className="btn-sm t-set-act" onClick={() => setRekeying(true)}>החלפת מפתח המורה</Button>
            <RekeySheet cls={cls} email={session.email} open={rekeying} onOpenChange={setRekeying} />
          </>
        )}
      </div>
    </section>
  );
}

/**
 * התראות (TEACHER-6 §5, owner only): one email a day when there are new help requests, with the count only. `on` is
 * the server's setting (null: this device does not open the class as its owner, and the section is not shown).
 */
function NoticesSection({ cls, on, onChange }) {
  const [busy, setBusy] = useState(false);
  if (on === null || on === undefined) return null;
  const set = async (next) => {
    setBusy(true);
    try {
      const r = await teacherApi('/api/teacher/class/digest', { method: 'POST', body: { on: next } }, cls);
      onChange(!!r.helpDigest);
      toast.success(next ? 'המייל היומי פועל.' : 'המייל היומי כבוי.');
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  return (
    <section className="section set-group t-set" aria-labelledby="ts-notices">
      <h2 id="ts-notices" className="set-head">התראות</h2>
      <div className="set-box">
        <div className="t-lock">
          <label className="check-row t-lock-row">
            <input type="checkbox" role="switch" checked={on} disabled={busy} onChange={(e) => set(e.target.checked)} aria-describedby="ts-digest-hint" />
            <span>מייל אחד ביום כשיש בקשות עזרה חדשות</span>
          </label>
          <p className="field-hint" id="ts-digest-hint">במייל יש רק את מספר הבקשות, בלי שמות. נשלח בסביבות 16:00.</p>
        </div>
      </div>
    </section>
  );
}

export default function ClassSettings() {
  const profile = useApp((s) => s.profile);
  const navigate = useNavigate();
  const cls = profile.classes.find((c) => c.code === profile.active) || profile.classes[0];
  const demo = profile.demo === true;
  const [locked, setLocked] = useState(null);
  const [digest, setDigest] = useState(null);
  const [aiPolicy, setAiPolicy] = useState(null);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const gone = useClassDeleted();
  const paywall = useAIStatus((x) => x.status?.paywall === true);
  const { state: nav } = useLocation();

  const load = useCallback(async () => {
    try {
      const d = await teacherApi('/api/teacher/dashboard', {}, cls);
      rememberBoard(cls.code, d);
      setLocked(!!d.joinLocked); setDigest(typeof d.helpDigest === 'boolean' ? d.helpDigest : null); setAiPolicy(d.aiPolicy || null); setError('');
    } catch (e) { setError(e.message); }
  }, [cls]);
  useEffect(() => { setLocked(null); setDigest(null); setAiPolicy(null); load(); }, [load]);
  // a new policy: this page, and the board's copy the other teacher screens read (the assistant's note)
  const onPolicy = (p) => { setAiPolicy(p); const b = boardOf(cls.code); if (b) rememberBoard(cls.code, { ...b, aiPolicy: p }); };
  // "על רישיון כיתה" (the tutor's sheet) and the line on "מחר" open this page at the licence
  useEffect(() => {
    if (nav?.focus !== 'licence' || !aiPolicy) return undefined;
    const t = setTimeout(() => document.getElementById('ts-licence')?.scrollIntoView({ block: 'start' }), 200);
    return () => clearTimeout(t);
  }, [nav, aiPolicy]);
  const lock = async (on) => {
    try {
      const r = await teacherApi('/api/teacher/class/lock', { method: 'POST', body: { locked: on } }, cls);
      setLocked(!!r.joinLocked);
      toast.success(on ? 'הכיתה נעולה לתלמידים חדשים.' : 'הכיתה פתוחה לתלמידים חדשים.');
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="page pushed settings t-settings">
      <header className="screen-bar" data-region="header">
        <button type="button" className="icon-btn" onClick={() => navigate('/teacher')} aria-label="חזרה ללוח"><ArrowRight size={24} aria-hidden="true" /></button>
        <h1 className="screen-bar-title">הגדרות הכיתה <bdi>{cls.className}</bdi></h1>
        <span className="icon-btn-spacer" aria-hidden="true" />
      </header>
      {error && <p className="form-error t-set-error" role="alert">{error}</p>}
      <ClassSection cls={cls} locked={locked} onLock={lock} />
      <AccessSection cls={cls} demo={demo} />
      <ClassAICard cls={cls} policy={aiPolicy} onPolicy={onPolicy} />
      {paywall && aiPolicy && (
        <section className="section set-group t-set" aria-labelledby="ts-licence">
          <h2 id="ts-licence" className="set-head">רישיון כיתה</h2>
          <LicenceCard cls={cls} aiPolicy={aiPolicy} />
        </section>
      )}
      <NoticesSection cls={cls} on={digest} onChange={setDigest} />
      <section className="section set-group t-set" aria-labelledby="ts-keep">
        <h2 id="ts-keep" className="set-head">כמה זמן נשמר המידע</h2>
        <ul className="set-box t-keep">{retentionLines().map((line) => <li key={line}>{line}</li>)}</ul>
      </section>
      <section className="section set-group t-set" aria-labelledby="ts-year">
        <h2 id="ts-year" className="set-head">סוף שנת הלימודים</h2>
        <p className="t-set-line">{YEAR_END_TEXT}</p>
        <div className="set-rows-wrap"><div className="set-rows">
          {/* the year's report opens, and its CSV starts once (TEACHER-7) */}
          <Link className="set-row t-set-year" to="/teacher/report?range=year&csv=1"><FileDown size={18} aria-hidden="true" />הורדת הדוח של כל השנה</Link>
          <button type="button" className="set-row danger" onClick={() => setDeleting(true)} disabled={demo} aria-describedby={demo ? 'ts-demo-delete' : undefined}><Trash2 size={18} aria-hidden="true" />מחיקת הכיתה</button>
        </div></div>
        {demo && <p className="t-set-line muted t-demo-line" id="ts-demo-delete">{DEMO_COPY.noDelete}</p>}
      </section>
      <DeleteClassSheet cls={cls} open={deleting && !demo} onOpenChange={setDeleting} onDeleted={() => { setDeleting(false); gone(cls, { toBoard: true }); }} />
    </div>
  );
}
