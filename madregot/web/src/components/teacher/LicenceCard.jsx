// The smart tutor in this class, at the top of the teacher's "מחר" view: no licence (and the ways to get one), the
// legacy window, a request on its way, a trial or a licence and until when, or a licence that ended. Class totals only:
// no student's own AI use and no sign of which family pays for its own plan.
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api, teacherHeaders } from '@/lib/api.js';
import { formatAgorot, vatLine, dateNum } from '@/lib/price.js';
import { Button, Field } from '@/components/ui.jsx';
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
      const r = await api('/api/teacher/licence/claim', { method: 'POST', body: { code }, headers: teacherHeaders(cls), auth: false });
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

export default function LicenceCard({ cls }) {
  const [lic, setLic] = useState(null);
  const [error, setError] = useState('');
  const [sheet, setSheet] = useState(null); // 'trial' | 'quote' | 'buy'
  const [codeOpen, setCodeOpen] = useState(false);
  const load = useCallback(async () => {
    try { setLic(await api('/api/teacher/licence', { headers: teacherHeaders(cls), auth: false })); setError(''); } catch (e) { setError(e.message); }
  }, [cls]);
  useEffect(() => { setLic(null); load(); }, [load]);
  if (!lic) return error ? <section id="t-licence" className="card licence-card"><p className="form-error" role="alert">{error}</p></section> : null;

  const offer = lic.offer || {};
  const until = lic.until ? dateNum(lic.until) : '';
  const asks = !['trial', 'active'].includes(lic.status);
  const kinds = { trial: 'ניסיון', quote: 'הצעת מחיר' };
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
      <h2 id="lic-title" className="card-title">{title}</h2>
      {lines.map((l) => <p key={l} className={l.startsWith('בכיתה יש יותר') ? 'licence-warn' : 'muted'}>{l}</p>)}
      {lic.request && <p className="licence-req" role="status">ביקשתם {kinds[lic.request.wants] || 'רישיון'} ב־{dateNum(lic.request.at)}. נחזור אליכם במייל.</p>}
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
      {lic.status !== 'trial' && lic.status !== 'active' && (
        codeOpen ? <CodeForm cls={cls} onDone={() => { setCodeOpen(false); load(); }} />
          : <button type="button" className="link-btn" onClick={() => setCodeOpen(true)}>יש לי קוד רישיון מבית הספר</button>
      )}
      <LicenceSheet cls={cls} mode={sheet} students={lic.students} offer={offer} onOpenChange={(o) => { if (!o) setSheet(null); }} onSent={load} />
    </section>
  );
}
