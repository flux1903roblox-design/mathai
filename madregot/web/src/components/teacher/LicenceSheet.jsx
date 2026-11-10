// A teacher asks for a two-week trial or a school quote, or buys a class licence by card. Each needs the teacher's own
// email (a code, no password); the session stays in this tab only (sessionStorage, the device has a profile). A trial
// is never granted by itself: the owner approves it and answers by email.
import { useEffect, useState } from 'react';
import { api, teacherHeaders } from '@/lib/api.js';
import { useParent, startCheckout, plans as loadPlans } from '@/lib/parent.js';
import { formatAgorot, vatLine } from '@/lib/price.js';
import EmailCodeForm from '@/components/account/EmailCodeForm.jsx';
import { Button, Field, Sheet } from '@/components/ui.jsx';

const TITLE = { trial: 'ניסיון של שבועיים לכיתה', quote: 'הצעת מחיר לבית הספר', buy: 'רישיון כיתה בכרטיס אשראי' };
const DONE = { trial: 'קיבלנו. נאשר את הניסיון ונשלח מייל תוך יום עבודה.', quote: 'קיבלנו. נשלח הצעת מחיר וחשבונית למייל תוך יום עבודה.' };

function RequestForm({ cls, wants, students, onSent }) {
  const session = useParent((s) => s.session);
  const [f, setF] = useState({ school: '', classes: '1', students: students ? String(students) : '', note: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: k === 'classes' || k === 'students' ? e.target.value.replace(/\D/g, '').slice(0, 2) : e.target.value });
  const send = async (e) => {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      await api('/api/teacher/licence/request', {
        method: 'POST', auth: false, headers: { ...teacherHeaders(cls), 'X-Account-Token': session.token },
        body: { wants, school: f.school.trim(), classes: Number(f.classes) || 1, ...(f.students ? { students: Number(f.students) } : {}), ...(f.note.trim() ? { note: f.note.trim() } : {}) },
      });
      onSent();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return (
    <form className="stack" onSubmit={send} noValidate>
      <Field label="שם בית הספר" id="lr-school"><input id="lr-school" className="input" value={f.school} onChange={set('school')} maxLength={80} /></Field>
      <div className="grid2">
        <Field label="כמה כיתות" id="lr-classes"><input id="lr-classes" className="input" inputMode="numeric" dir="ltr" value={f.classes} onChange={set('classes')} /></Field>
        <Field label="כמה תלמידים בכיתה" id="lr-students"><input id="lr-students" className="input" inputMode="numeric" dir="ltr" value={f.students} onChange={set('students')} /></Field>
      </div>
      <Field label="הערה (לא חובה)" id="lr-note"><textarea id="lr-note" className="input" rows={3} value={f.note} onChange={set('note')} maxLength={500} /></Field>
      {error && <p className="form-error" role="alert">{error}</p>}
      <Button type="submit" className="btn-block btn-lg" disabled={busy || !f.school.trim()}>{busy ? 'שולחים…' : 'שליחה'}</Button>
    </form>
  );
}

function BuyForm({ cls, students, offer }) {
  const min = offer.minSeats || 10; const max = 45;
  const [seats, setSeats] = useState(String(Math.min(max, Math.max(min, students || min))));
  const [adult, setAdult] = useState(false); const [terms, setTerms] = useState(false);
  const [plans, setPlans] = useState(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  useEffect(() => { loadPlans().then(setPlans).catch(() => {}); }, []);
  const n = Number(seats);
  const ok = Number.isInteger(n) && n >= min && n <= max;
  const b = plans?.business || {};
  const go = async () => {
    if (!adult || !terms) { setError('כדי להמשיך צריך לאשר את שתי התיבות.'); return; }
    setError(''); setBusy(true);
    try { await startCheckout('class_year', { seats: n, classHeaders: teacherHeaders(cls) }); } catch (e) { setError(e.message); setBusy(false); }
  };
  return (
    <div className="stack">
      <Field label={`כמה מקומות (${min} עד ${max})`} id="lb-seats">
        <input id="lb-seats" className="input" inputMode="numeric" dir="ltr" value={seats} onChange={(e) => setSeats(e.target.value.replace(/\D/g, '').slice(0, 2))} />
      </Field>
      {ok && <p className="parents-sum">סה״כ לתשלום: {formatAgorot(n * offer.seatYearAgorot)} ({vatLine(offer.vatMode)}). תשלום אחד לשנה, בלי חידוש אוטומטי.</p>}
      <section className="parents-disclosure" aria-label="פרטי העסק">
        <p><b>{b.name || 'מדרגות'}</b>{b.id ? ` · ${b.id}` : ''}</p>
        {b.address && <p>{b.address}</p>}
        {b.email && <p><a href={`mailto:${b.email}`} dir="ltr">{b.email}</a></p>}
      </section>
      <label className="check-row parents-check"><input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} /><span>אני מעל גיל 18, ומוסמך או מוסמכת לרכוש עבור הכיתה</span></label>
      <label className="check-row parents-check"><input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} /><span>קראתי את התקנון ואת מדיניות הביטול</span></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <Button className="btn-block btn-lg" onClick={go} disabled={busy || !ok}>{busy ? 'פותחים את דף התשלום…' : 'למעבר לתשלום מאובטח'}</Button>
      <p className="footnote">התשלום נעשה בדף של חברת הסליקה. פרטי הכרטיס לא עוברים דרך מדרגות.</p>
    </div>
  );
}

export default function LicenceSheet({ cls, mode, students, offer = {}, onOpenChange, onSent }) {
  const session = useParent((s) => s.session);
  const [sent, setSent] = useState(false);
  useEffect(() => { if (mode) setSent(false); }, [mode]);
  return (
    <Sheet open={!!mode} onOpenChange={onOpenChange} title={TITLE[mode] || ''}>
      {sent ? (
        <div className="stack"><p className="lead" role="status">{DONE[mode]}</p><Button className="btn-block" onClick={() => onOpenChange(false)}>סגירה</Button></div>
      ) : !session ? (
        <div className="stack">
          <p className="muted">כדי שנוכל לחזור אליכם, נכנסים עם המייל של בית הספר או שלכם.</p>
          <EmailCodeForm idPrefix="lic" />
        </div>
      ) : mode === 'buy' ? <BuyForm cls={cls} students={students} offer={offer} />
        : mode ? <RequestForm cls={cls} wants={mode} students={students} onSent={() => { setSent(true); onSent?.(); }} /> : null}
    </Sheet>
  );
}
