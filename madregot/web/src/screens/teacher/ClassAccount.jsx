// The teacher's email on the board (spec TEACHER-1 §6): the first look at a new class, the card that binds a class
// that only its key opens, signing in again when the sign-in has ended, and more classes from the same email.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ChevronLeft, Copy, Printer } from 'lucide-react';
import { useApp } from '@/lib/store.js';
import { useParent } from '@/lib/parent.js';
import { bindClass, myClasses, restore, remindBindLater, boundElsewhere } from '@/lib/teacher.js';
import { dateNum } from '@/lib/price.js';
import { Button, Sheet } from '@/components/ui.jsx';
import { ConfirmSheet } from '@/components/Screen.jsx';
import Mascot from '@/components/Mascot.jsx';
import EmailCodeForm from '@/components/account/EmailCodeForm.jsx';
import { copy } from './common.jsx';

const GRADE = { 7: 'ז׳', 8: 'ח׳' };

/**
 * How students join, in the words they see: "מתחילים" on the first screen, then the question "יש לכם קוד כיתה
 * מהמורה?" (Welcome.jsx); a student who skipped it joins later from "אני". teacher.spec.js checks the quoted words
 * against the screens.
 */
export const JOIN_PATH = 'תנו לתלמידים את קוד הכיתה. הם לוחצים "מתחילים", כותבים שם פרטי ואות משם המשפחה, ובשאלה "יש לכם קוד כיתה מהמורה?" מקלידים את הקוד ובוחרים קוד אישי של 4 ספרות. מי שכבר משתמש באפליקציה מצטרף מהמסך "אני".';

/**
 * A new class: its code and how students join. A class bound to the email shows no key; one opened without email does.
 * Under the way on, a link to the parent letter (the pilot kit, TEACHER-10).
 */
export function FreshClass({ cls, onDone }) {
  const email = useParent((s) => s.session?.email);
  return (
    <section className="card t-fresh" aria-labelledby="fresh-title" data-region="card">
      <Mascot mood="achievement" size={96} />
      <h2 id="fresh-title" className="t-fresh-title">הכיתה מוכנה!</h2>
      <p className="t-fresh-how">{JOIN_PATH}</p>
      <div className="code-pair">
        <div><span className="field-label">קוד כיתה</span><button type="button" className="code-chip" onClick={() => copy(cls.code, 'קוד הכיתה')}><span dir="ltr">{cls.code}</span><Copy size={16} aria-hidden="true" /></button></div>
        {!cls.owned && cls.key && <div><span className="field-label">מפתח מורה (רק לכם)</span><button type="button" className="code-chip" onClick={() => copy(cls.key, 'מפתח המורה')}><span dir="ltr">{cls.key}</span><Copy size={16} aria-hidden="true" /></button></div>}
      </div>
      {cls.owned ? (
        <p className="muted">הכיתה שמורה בחשבון שלכם{email ? <> (<bdi dir="ltr">{email}</bdi>)</> : null}. מכל מכשיר אחר נכנסים עם המייל, בלי מפתח.</p>
      ) : <p className="muted">שמרו את מפתח המורה במקום בטוח. בעזרתו פותחים את הלוח ממחשב אחר.</p>}
      <Button className="btn-block btn-lg" onClick={onDone}>{cls.owned ? 'אפשר להמשיך' : 'שמרתי, אפשר להמשיך'}</Button>
      {/* the pilot kit's parent letter, filled in for this class (TEACHER-10 §3) */}
      <Link className="link-btn t-fresh-letter" to="/teacher/guide/parent-letter"><Printer size={18} aria-hidden="true" />מכתב להורים להדפסה</Link>
    </section>
  );
}

/**
 * Binding a class that only its key opens to the teacher's email: `start()` binds at once when signed in, otherwise it
 * opens a sheet that asks for the email code first. Used by the bind card and by the class settings.
 */
export function useBind(cls) {
  const session = useParent((s) => s.session);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const bind = async () => {
    setBusy(true); setError('');
    try {
      const r = await bindClass(cls);
      setOpen(false);
      toast.success(`הכיתה ${cls.className} מקושרת עכשיו ל־${r.email}.`);
    } catch (e) {
      setError(e.message);
      if (e.code === 'not_account') setOpen(true);
    } finally { setBusy(false); }
  };
  const sheet = (
    <Sheet open={open} onOpenChange={setOpen} title="קישור הכיתה למייל">
      <div className="stack">
        <p className="muted">אחרי הכניסה, הכיתה {cls.className} תיפתח עם המייל בכל מכשיר. מפתח המורה ממשיך לעבוד כרגיל.</p>
        <EmailCodeForm idPrefix="bind" purpose="teacherAccount" askShared onSignedIn={bind} />
        {error && <p className="form-error" role="alert">{error}</p>}
      </div>
    </Sheet>
  );
  return { start: () => (session ? bind() : setOpen(true)), busy, error: open ? '' : error, sheet };
}

/**
 * At the top of "מחר", for a class that only its key opens here: bind it to the teacher's email, so a lost device does
 * not lose it. Signed in already: one tap. Otherwise a sheet asks for the email code first. "לא עכשיו": a week.
 */
export function BindCard({ cls }) {
  const b = useBind(cls);
  return (
    <section className="card t-bind" role="region" aria-label="קישור הכיתה למייל">
      <p>הכיתה עוד לא מקושרת למייל. אם המכשיר הזה ילך לאיבוד, לא תוכלו לחזור אליה.</p>
      {b.error && <p className="form-error" role="alert">{b.error}</p>}
      <div className="t-bind-actions">
        <Button onClick={b.start} disabled={b.busy}>{b.busy ? 'מקשרים…' : 'לקשר למייל שלי'}</Button>
        <Button variant="ghost" onClick={() => remindBindLater(cls)}>לא עכשיו</Button>
      </div>
      {b.sheet}
    </section>
  );
}

/** Where a teacher writes to us: the address the build was given (VITE_CONTACT_EMAIL), else the words alone. */
const CONTACT = String(import.meta.env.VITE_CONTACT_EMAIL || '').trim();
export const WriteToUs = () => (CONTACT ? <>כתבו לנו אל <a href={`mailto:${CONTACT}`}><bdi dir="ltr">{CONTACT}</bdi></a></> : 'כתבו לנו');

/**
 * The class was bound to an email after it was opened, and not from this device (the dashboard's boundElsewhere, for a
 * device that opens it with its key). The settings page always says so; the board says it while a mistake can still be
 * undone (the 7 days in which nobody can replace the key).
 */
export function BoundElsewhere({ cls, board, where = 'settings' }) {
  const b = boundElsewhere(cls, board);
  if (!b) return null;
  const open = Date.now() < Date.parse(b.until);
  // this device cannot know whose email it is (the binder's own other device would also see this): the words say only what is known
  const head = `הכיתה קושרה למייל ב־${dateNum(b.at)}, לא מהמכשיר הזה.`;
  if (where === 'board') {
    if (!open) return null;
    return (
      <Link className="t-lic-line t-bound-line" to="/teacher/settings" state={{ focus: 'access' }}>
        <span>{head} לפרטים</span>
        <ChevronLeft size={18} aria-hidden="true" />
      </Link>
    );
  }
  return (
    <div className="t-set-bind t-bound" role="status">
      <p className="t-set-line">{head} מפתח המורה ממשיך לפתוח אותה כאן.</p>
      {open && <p className="t-set-line muted">אם זה לא נעשה בידיעתכם, <WriteToUs /> עד {dateNum(b.until)}, ונבטל את הקישור.</p>}
    </div>
  );
}

/**
 * On a device that did not open the class (its key was typed in): binding is for the teacher who opened it, so it is a
 * quiet link with a question first, never the card that asks every device.
 */
export function BindFromKeyDevice({ cls, emailOn }) {
  const b = useBind(cls);
  const [asking, setAsking] = useState(false);
  return (
    <div className="t-set-bind">
      <p className="t-set-line">את הכיתה מקשר למייל רק מי שפתח אותה. מורים נוספים נכנסים עם מפתח המורה.</p>
      {b.error && <p className="form-error" role="alert">{b.error}</p>}
      {emailOn && cls.key && <button type="button" className="link-btn t-set-act" onClick={() => setAsking(true)} disabled={b.busy}>{b.busy ? 'מקשרים…' : 'אני פתחתי את הכיתה הזו'}</button>}
      <ConfirmSheet open={asking} onOpenChange={setAsking} title="לקשר את הכיתה למייל שלכם?" mood="idle" keep="לא, חזרה" confirm="כן, אני פתחתי אותה"
        onConfirm={() => { setAsking(false); b.start(); }}>
        <p>רק מי שפתח את הכיתה מקשר אותה למייל שלו. אחרי הקישור, רק מי שנכנס עם המייל הזה יכול למחוק את הכיתה או להחליף את מפתח המורה.</p>
      </ConfirmSheet>
      {b.sheet}
    </div>
  );
}

/** The sign-in on this device has ended (or was on a shared computer), and the class opens only with the email. */
export function SignInAgain({ cls, onSignedIn }) {
  return (
    <section className="card t-signin" aria-labelledby="t-signin-title">
      <h2 id="t-signin-title" className="t-signin-title">כדי לפתוח את הלוח, נכנסים עם המייל</h2>
      <p className="muted">הכיתה {cls.className} מקושרת למייל של המורה. אחרי הכניסה הלוח ייפתח כאן.</p>
      <EmailCodeForm idPrefix="tsi" purpose="teacherAccount" askShared onSignedIn={onSignedIn} />
    </section>
  );
}

/** "עוד כיתות מהחשבון שלי…": the email's classes that are not on this device yet; adding one opens it. */
export function MoreClasses({ open, onOpenChange }) {
  const classes = useApp((s) => s.profile?.classes || []);
  const setActiveClass = useApp((s) => s.setActiveClass);
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!open) return undefined;
    let on = true;
    setList(null); setError('');
    myClasses().then((l) => on && setList(l), (e) => on && setError(e.message));
    return () => { on = false; };
  }, [open]);
  const here = new Set(classes.map((c) => c.code));
  const more = (list || []).filter((c) => !here.has(c.code));
  const add = (c) => {
    restore([c]); setActiveClass(c.code); onOpenChange(false);
    toast.success(`הכיתה ${c.name} נוספה ללוח`);
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="עוד כיתות מהחשבון שלי">
      {error ? <p className="form-error" role="alert">{error}</p>
        : !list ? <p className="muted" role="status">טוענים…</p>
          : !more.length ? <p className="muted">כל הכיתות שמקושרות למייל כבר בלוח הזה.</p> : (
            <ul className="t-more-list">
              {more.map((c) => (
                <li key={c.code} className="t-more-row">
                  <span><b>{c.name}</b> · כיתה {GRADE[c.grade] || c.grade}</span>
                  <Button variant="secondary" className="btn-sm" onClick={() => add(c)} aria-label={`הוספת ${c.name} ללוח`}>הוספה ללוח</Button>
                </li>
              ))}
            </ul>
          )}
    </Sheet>
  );
}
