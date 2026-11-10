// Sign-in for a parent or a teacher: an email address, then the 6-digit code sent to it. No password. Signing up and
// signing in are one flow. `lockedEmail` asks for a fresh code to the signed-in address (a step-up before deleting).
import { useEffect, useRef, useState } from 'react';
import { requestCode, verifyCode } from '@/lib/parent.js';
import { Button, Field } from '@/components/ui.jsx';

export default function EmailCodeForm({ onSignedIn, lockedEmail = null, autoSend = false, idPrefix = 'ec', note = true, startStep = 'email', presetEmail = '' }) {
  const [step, setStep] = useState(lockedEmail ? 'sending' : startStep);
  const [email, setEmail] = useState(lockedEmail || presetEmail);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const sent = useRef(false);
  useEffect(() => { if (step !== 'code') return undefined; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [step]);
  const wait = Math.max(0, Math.ceil((resendAt - now) / 1000));

  const ask = async (e) => {
    e?.preventDefault?.(); setError(''); setBusy(true);
    try {
      const r = await requestCode(email.trim());
      setStep('code'); setCode(''); setResendAt(Date.now() + (r.resendAfter || 60) * 1000); setNow(Date.now());
      setTimeout(() => document.getElementById(`${idPrefix}-code`)?.focus(), 50);
    } catch (err) {
      if (err.code === 'wait_to_resend') { setStep('code'); setResendAt(Date.now() + (err.data?.retryAfter || 60) * 1000); setNow(Date.now()); }
      else if (lockedEmail) setStep('code');
      setError(err.message);
    } finally { setBusy(false); }
  };
  // a step-up sends the code at once
  useEffect(() => { if ((lockedEmail || autoSend) && !sent.current) { sent.current = true; ask(); } }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const verify = async (value = code) => {
    if (busy || value.length !== 6) return;
    setError(''); setBusy(true);
    try {
      const r = await verifyCode(email.trim(), value);
      onSignedIn?.(r);
    } catch (err) {
      setError(err.code === 'wrong_code' && Number.isFinite(err.data?.left) ? `הקוד לא נכון. נשארו עוד ${err.data.left} ניסיונות.` : err.message);
      setCode('');
    } finally { setBusy(false); }
  };

  if (step === 'email' || step === 'sending') {
    return (
      <form className="stack email-code" onSubmit={ask} noValidate>
        <Field label="כתובת המייל שלכם" id={`${idPrefix}-email`} hint="נשלח אליה קוד של 6 ספרות. אין סיסמה.">
          <input id={`${idPrefix}-email`} type="email" inputMode="email" autoComplete="email" dir="ltr" className="input" value={email}
            onChange={(e) => setEmail(e.target.value)} maxLength={254} readOnly={!!lockedEmail} />
        </Field>
        {note && <p className="footnote">המייל משמש לכניסה, לקבלות ולהודעות על המנוי. צריך אותו רק כדי להצטרף. הוא עובר לשירות שליחת המיילים (Resend) ולחברת הסליקה.</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <Button type="submit" className="btn-block" disabled={busy || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())}>{busy ? 'שולחים…' : 'שליחת קוד'}</Button>
      </form>
    );
  }
  return (
    <form className="stack email-code" onSubmit={(e) => { e.preventDefault(); verify(); }} noValidate>
      <p className="email-code-sent">שלחנו קוד בן 6 ספרות אל <bdi dir="ltr" className="mono">{email.trim()}</bdi>. הקוד בתוקף 10 דקות.</p>
      <Field label="הקוד מהמייל" id={`${idPrefix}-code`}>
        <input id={`${idPrefix}-code`} className="input mono sub-code" dir="ltr" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code}
          onChange={(e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 6); setCode(v); if (v.length === 6) verify(v); }} />
      </Field>
      {error && <p className="form-error" role="alert">{error}</p>}
      <Button type="submit" className="btn-block" disabled={busy || code.length !== 6}>{busy ? 'בודקים…' : 'כניסה'}</Button>
      <p className="footnote">לא הגיע? בדקו בתיקיית הספאם.</p>
      <div className="sub-links">
        <Button variant="ghost" className="btn-sm" disabled={busy || wait > 0} onClick={ask}>{wait > 0 ? `קוד חדש בעוד ${wait} שניות` : 'שליחת קוד חדש'}</Button>
        {!lockedEmail && <Button variant="ghost" className="btn-sm" onClick={() => { setStep('email'); setError(''); setCode(''); }}>שינוי כתובת</Button>}
      </div>
    </form>
  );
}
