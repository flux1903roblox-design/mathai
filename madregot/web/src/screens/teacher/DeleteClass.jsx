// Deleting a class (spec TEACHER-9 §4, trust Appendix E §E.6): one sheet, opened from the class settings and from the
// last row of "תלמידים". The red button works only once the class's name is typed. A class bound to an email is
// deleted only by its owner with a fresh code (the step-up form); the server says so anyway (403 not_owner, 401
// reauth_needed), and the sheet then asks for the code. A licence that still runs keeps the class (409).
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useApp } from '@/lib/store.js';
import { useParent, signOut as endSession } from '@/lib/parent.js';
import { deleteClass, dropClassHere } from '@/lib/teacher.js';
import { Button, Sheet } from '@/components/ui.jsx';
import Mascot from '@/components/Mascot.jsx';
import EmailCodeForm from '@/components/account/EmailCodeForm.jsx';

export const DELETE_TEXT = 'נמחק את רשימת התלמידים, את ההתקדמות שלהם בלוח, את המשימות, את בקשות העזרה והתשובות עליהן ואת המבחנים. התרגול שנשמר במכשירים של התלמידים נשאר בהם. אי אפשר לבטל.';
export const LICENCE_TEXT = 'לכיתה יש רישיון פעיל. אפשר למחוק אותה אחרי שהרישיון מסתיים, או לכתוב לנו.';

/** A name as typed on a phone: the Hebrew geresh and gershayim may come as plain quotes, and spaces may differ. */
export const sameName = (a, b) => {
  const norm = (s) => String(s || '').replace(/[׳'`’]/g, "'").replace(/[״"”]/g, '"').replace(/\s+/g, ' ').trim();
  return !!norm(a) && norm(a) === norm(b);
};

/** `onDeleted({students})` runs after the server deleted the class; the page then takes it off the device. */
export default function DeleteClassSheet({ cls, open, onOpenChange, onDeleted }) {
  const session = useParent((s) => s.session);
  const [step, setStep] = useState('confirm'); // confirm | code
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (open) { setStep('confirm'); setTyped(''); setError(''); setBusy(false); } }, [open]);
  const ready = sameName(typed, cls.className);

  const remove = async () => {
    setBusy(true); setError('');
    try {
      const r = await deleteClass(cls);
      onDeleted(r);
    } catch (e) {
      if (e.code === 'class_has_licence') { setStep('confirm'); setError(LICENCE_TEXT); }
      else if (step !== 'code' && ['reauth_needed', 'not_owner', 'not_account'].includes(e.code)) setStep('code');
      else setError(e.message);
    } finally { setBusy(false); }
  };
  const confirm = (e) => {
    e?.preventDefault?.();
    if (!ready || busy) return;
    if (cls.owned) setStep('code'); else remove();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={`למחוק את הכיתה ${cls.className}?`} className="t-delete">
      {step === 'code' ? (
        <div className="stack">
          <p className="lead">
            {session?.email
              ? 'רק מי שהכיתה מקושרת למייל שלו יכול למחוק אותה. כדי לאשר, שלחנו קוד למייל.'
              : 'הכיתה מקושרת למייל. כדי למחוק אותה, נכנסים עם המייל שהיא מקושרת אליו.'}
          </p>
          <EmailCodeForm lockedEmail={session?.email || null} idPrefix="tdel" purpose="stepup" onSignedIn={remove} />
          {busy && <p className="muted" role="status">מוחקים…</p>}
          {error && <p className="form-error" role="alert">{error}</p>}
          <Button variant="ghost" className="btn-block" onClick={() => onOpenChange(false)}>לא למחוק</Button>
        </div>
      ) : (
        <form className="exit-sheet confirm-sheet t-delete-form" onSubmit={confirm} noValidate>
          <Mascot mood="oops" size={88} />
          <div className="lead confirm-text"><p>{DELETE_TEXT}</p></div>
          <div className="field t-delete-field">
            <label htmlFor="tdel-name" className="field-label">כדי לאשר, כתבו את שם הכיתה: <bdi>{cls.className}</bdi></label>
            <input id="tdel-name" className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" maxLength={40} />
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <Button className="btn-block btn-lg" onClick={() => onOpenChange(false)}>לא למחוק</Button>
          <Button type="submit" variant="danger" className="btn-block" disabled={!ready || busy}>{busy ? 'מוחקים…' : 'כן, למחוק את הכיתה'}</Button>
        </form>
      )}
    </Sheet>
  );
}

/** A toast for the board to show once it opens (a route change clears the toasts of the screen that raised them). */
let pending = null;
export const takePendingToast = () => { const t = pending; pending = null; return t; };

/**
 * After the server deleted a class: take it off this device. With another class left, it opens (from the settings
 * page, the board opens with it); with none left the board closes, as leaving does, and the first screen says so.
 */
export function useClassDeleted() {
  const signOut = useApp((s) => s.signOut);
  const navigate = useNavigate();
  return (cls, { toBoard = false } = {}) => {
    const next = dropClassHere(cls.code);
    if (!next) { endSession(); signOut(); toast('הכיתה נמחקה'); return; }
    if (toBoard) { pending = 'הכיתה נמחקה'; navigate('/teacher', { replace: true }); } else toast('הכיתה נמחקה');
  };
}
