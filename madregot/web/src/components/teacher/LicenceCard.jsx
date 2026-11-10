// The smart tutor in this class, in the class settings (section "רישיון כיתה", TEACHER-9 §1.4): no licence (and the ways
// to get one), the legacy window, a request on its way, a trial or a licence and until when, or a licence that ended.
// A school class whose students may not have the AI yet (TRUST-11: not in the Ministry's catalogue, or below the
// approved grade) gets trust §E.8's school-before-approval text and only the quote; the server refuses the rest anyway.
// Class totals only: no student's own AI use and no sign of which family pays for its own plan.
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { teacherApi } from '@/lib/teacher.js';
import { formatAgorot, vatLine, dateNum } from '@/lib/price.js';
import { Button, Field } from '@/components/ui.jsx';
import { AI_COPY, beforeApproval } from '@/content/classAi.js';
import LicenceSheet from './LicenceSheet.jsx';

/** XXXX-XXXX-XXXX as it is typed: letters and digits, dashes added. */
const codeShape = (v) => v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12).replace(/(.{4})(?=.)/g, '$1-');

function CodeForm({ cls, onDone }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const go = async (e) => {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      const r = await teacherApi('/api/teacher/licence/claim', { method: 'POST', body: { code } }, cls);
      toast.success(`הרישיון הופעל עד ${dateNum(r.until)}`); setCode(''); onDone();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return (
    <form className="stack licence-code" onSubmit={go} noValidate>
      <Field label="קוד רישיון מבית הספר" id="lic-code">
        <input id="lic-code" className="input mono" dir="ltr" value={code} onChange={(e) => setCode(codeShape(e.target.value))} autoComplete="off" autoCapitalize="characters" placeholder="XXXX-XXXX-XXXX" />
      </Field>
      {error && <p className="form-error" role="alert">{error}</p>}
      <Button type="submit" variant="secondary" className="btn-block" disabled={busy || code.replace(/-/g, '').length !== 12}>{busy ? 'מפעילים…' : 'הפעלה'}</Button>
    </form>
  );
}

/** The class's licence (GET /api/teacher/licence) while `on`: { lic, error, load }. */
export function useLicence(cls, on = true) {
  const [lic, setLic] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    if (!on) return;
    try { setLic(await teacherApi('/api/teacher/licence', {}, cls)); setError(''); } catch (e) { setError(e.message); }
  }, [cls, on]);
  useEffect(() => { setLic(null); load(); }, [load]);
  return { lic, error, load };
}

/** Props: `cls`; `aiPolicy` (the dashboard's, TRUST-11): a school class before approval gets only the quote. */
export default function LicenceCard({ cls, aiPolicy }) {
  const { lic, error, load } = useLicence(cls);
  const [sheet, setSheet] = useState(null); // 'trial' | 'quote' | 'buy'
  const [codeOpen, setCodeOpen] = useState(false);
  if (!lic) return error ? <section id="t-licence" className="card licence-card"><p className="form-error" role="alert">{error}</p></section> : null;
  const kinds = { trial: 'ניסיון', quote: 'הצעת מחיר' };
  const requested = lic.request && <p className="licence-req" role="status">ביקשתם {kinds[lic.request.wants] || 'רישיון'} ב־{dateNum(lic.request.at)}. נחזור אליכם במייל.</p>;
  if (beforeApproval(aiPolicy)) {
    // the section's own heading is §E.8's title ("רישיון כיתה"): the card under it holds the text and the one button
    return (
      <div id="t-licence" className="card licence-card licence-before" data-region="card">
        <p className="muted">{AI_COPY.licenceBeforeApproval}</p>
        {requested}
        {lic.request?.wants !== 'quote' && <Button variant="secondary" className="btn-block" onClick={() => setSheet('quote')}>{AI_COPY.quote}</Button>}
        <LicenceSheet cls={cls} mode={sheet} students={lic.students} offer={lic.offer || {}} onOpenChange={(o) => { if (!o) setSheet(null); }} onSent={load} />
      </div>
    );
  }

  const offer = lic.offer || {};
  const until = lic.until ? dateNum(lic.until) : '';
  // a running licence (also one that is ending: its renewal is a quote) offers no trial, card purchase or code; the
  // server refuses those while a licence runs. A trial gives way to a school's licence code.
  const asks = !['trial', 'active', 'ending'].includes(lic.status);
  const codeAllowed = !['active', 'ending'].includes(lic.status);
  let title = 'העוזר החכם בכיתה';
  let lines = [];
  if (lic.status === 'none') lines = ['בלי רישיון, כל תלמיד יכול לשאול את העוזר החכם 2 שאלות ביום. עם רישיון כיתה: עד 20 שאלות ביום לתלמיד, בדיקת פתרון מצולם ובדיקת מבחן.'];
  if (lic.status === 'legacy') lines = [`העוזר פתוח בכיתה הזו כמו קודם עד ${dateNum(lic.legacyUntil)}. אחר כך: 2 שאלות ביום לכל תלמיד, או רישיון כיתה.`];
  if (lic.status === 'trial' || lic.status === 'active') {
    title = `${lic.status === 'trial' ? 'ניסיון' : 'רישיון כיתה'} פעיל עד ${until}`;
    lines = [`${lic.seats} מקומות · ${lic.students} תלמידים בכיתה · השבוע: ${lic.aiWeek} שאלות לעוזר`];
    if (lic.students > lic.seats) lines.push('בכיתה יש יותר תלמידים ממקומות ברישיון. אפשר להסיר מי שלא שייך לכיתה, או לבקש עוד מקומות.');
  }
  if (lic.status === 'ending') {
    title = `הרישיון מסתיים ב־${until}`;
    lines = [`${lic.seats} מקומות · ${lic.students} תלמידים בכיתה · השבוע: ${lic.aiWeek} שאלות לעוזר`];
  }
  if (lic.status === 'ended') lines = [`הרישיון הסתיים ב־${until}. התלמידים חזרו ל־2 שאלות ביום.`];
  return (
    <section id="t-licence" className="card licence-card" aria-labelledby="lic-title" data-region="card">
      <h3 id="lic-title" className="card-title">{title}</h3>
      {lines.map((l) => <p key={l} className={l.startsWith('בכיתה יש יותר') ? 'licence-warn' : 'muted'}>{l}</p>)}
      {requested}
      {lic.status === 'ending' && <Button variant="secondary" className="btn-block" onClick={() => setSheet('quote')}>לחידוש: הצעת מחיר</Button>}
      {asks && (
        <div className="licence-actions">
          {lic.request?.wants !== 'trial' && <Button className="btn-block" onClick={() => setSheet('trial')}>ניסיון של שבועיים לכיתה</Button>}
          {lic.request?.wants !== 'quote' && <Button variant="secondary" className="btn-block" onClick={() => setSheet('quote')}>הצעת מחיר לבית הספר</Button>}
          {offer.online && (
            <>
              <Button variant="secondary" className="btn-block" onClick={() => setSheet('buy')}>רכישה בכרטיס אשראי</Button>
              <p className="footnote licence-price">{formatAgorot(offer.seatYearAgorot)} לתלמיד לשנה, {vatLine(offer.vatMode)}, לפחות {offer.minSeats || 10} תלמידים</p>
            </>
          )}
        </div>
      )}
      {codeAllowed && (
        codeOpen ? <CodeForm cls={cls} onDone={() => { setCodeOpen(false); load(); }} />
          : <button type="button" className="link-btn" onClick={() => setCodeOpen(true)}>יש לי קוד רישיון מבית הספר</button>
      )}
      <LicenceSheet cls={cls} mode={sheet} students={lic.students} offer={offer} onOpenChange={(o) => { if (!o) setSheet(null); }} onSent={load} />
    </section>
  );
}
