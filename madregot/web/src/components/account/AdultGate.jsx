// The adult step before the parents' area on a child's device (trust spec TRUST-8): Parents.jsx shows it instead of the
// sign-in on /parents and /parents/link when this device has a student profile and no parent is signed in here. Never on
// /cancel: cancelling must stay easy (Consumer Protection Law s.14ט).
//
// A speed bump, not verification (Privacy Protection Authority draft on age assurance, June 2026: prefer low-impact
// methods). The checks that count are the code in the parent's mailbox, the 18+ box at checkout, the cardholder at the
// payment company, and the payer's welcome email. The year is checked here and forgotten: never sent, never stored. Its
// known error is up to one year (a child born in December 2008 passes in November 2026).
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adultYearOk, setAdultPassed, startWait, waitUntil } from '@/lib/parentGate.js';
import { Button, Field } from '@/components/ui.jsx';

export const ADULT_COPY = Object.freeze({
  title: 'המסך הזה בשביל ההורים',
  text: 'כאן מצטרפים למנוי, מאשרים את העוזר החכם ומנהלים את החשבון. אם אתם הילד או הילדה, אפשר להראות להורים את הקוד מהמסך הקודם, והם ימשיכו בטלפון שלהם.',
  field: 'שנת הלידה שלכם',
  go: 'המשך',
  back: 'חזרה',
  blocked: 'המסך הזה מיועד להורים. אפשר להראות להורים את הקוד מהמסך הקודם.',
});

export default function AdultGate({ onPass }) {
  const [year, setYear] = useState('');
  const [closedUntil, setClosedUntil] = useState(() => waitUntil());
  const closed = closedUntil > 0;
  // the field opens again by itself when the 10 minutes are over
  useEffect(() => {
    if (!closed) return undefined;
    const t = setTimeout(() => setClosedUntil(waitUntil()), Math.max(0, closedUntil - Date.now()) + 50);
    return () => clearTimeout(t);
  }, [closed, closedUntil]);

  const submit = (e) => {
    e.preventDefault();
    if (closed || year.length !== 4) return;
    const ok = adultYearOk(year);
    setYear(''); // not kept, not even in the field
    if (ok) { setAdultPassed(); onPass?.(); return; }
    startWait();
    setClosedUntil(waitUntil());
  };

  return (
    <section className="card parents-card adult-gate" aria-labelledby="adult-title">
      <h2 id="adult-title" className="card-title">{ADULT_COPY.title}</h2>
      <p>{ADULT_COPY.text}</p>
      <form className="adult-form" onSubmit={submit} noValidate>
        {/* no example year in the field: it would tell a child what to type */}
        <Field label={ADULT_COPY.field} id="adult-year">
          <input id="adult-year" className="input input-lg mono" dir="ltr" inputMode="numeric" pattern="\d{4}" maxLength={4} autoComplete="off"
            value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))} disabled={closed}
            aria-describedby={closed ? 'adult-closed' : undefined} />
        </Field>
        {closed && <p id="adult-closed" className="adult-closed" role="status">{ADULT_COPY.blocked}</p>}
        <Button type="submit" className="btn-block btn-lg" disabled={closed || year.length !== 4}>{ADULT_COPY.go}</Button>
      </form>
      <Link to="/parents/info" className="foot-link adult-back">{ADULT_COPY.back}</Link>
    </section>
  );
}
