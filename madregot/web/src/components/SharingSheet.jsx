// "שיתוף עם ההורים" (PARENTS-4): what this linked device sends its parents, shown to the child at any time. Opened from
// Settings (the AI section's row), from the profile's "משותף עם ההורים" chip and from the notice. It says whether the
// summary is on and when it last went; today's row in words (exactly what goes); the rows sent last, in words; what is
// never sent; how long it is kept; and the child's own switch, which the parent sees only as "off", with no reason.
// No plan and no price here: the child sees what is shared, never what it costs.
import { useId, useState } from 'react';
import { useApp, today as dayOf } from '@/lib/store.js';
import { useAIStatus } from '@/lib/account.js';
import { setChildSharing } from '@/lib/familySync.js';
import { whenText } from '@/lib/when.js';
import { useReportInput } from '@/components/report/useReportWeek.js';
import { DayView } from '@/components/report/ReportView.jsx';
import { daySummary } from '@/learn/report.ts';
import { Button, Sheet } from '@/components/ui.jsx';
import { ConfirmSheet } from '@/components/Screen.jsx';

export const SHARING = {
  title: 'שיתוף עם ההורים',
  today: 'מה נשלח היום',
  last: 'נשלח לאחרונה',
  see: 'לראות',
  hide: 'להסתיר',
  never: 'מה לא נשלח אף פעם: התשובות עצמן, השיחות עם העוזר החכם, תמונות והשם שלכם.',
  kept: 'הסיכומים נשמרים 90 יום ואז נמחקים.',
  stop: 'להפסיק לשתף',
  start: 'להפעיל שוב את השיתוף',
  bothHint: 'הסיכום יחזור להישלח רק אם גם ההורים יפעילו אותו.',
  confirmTitle: 'להפסיק לשלוח סיכום להורים?',
  confirmBody: 'ההורים יראו שהשיתוף כבוי במכשיר הזה, בלי סיבה ובלי פרטים. אפשר להפעיל שוב מתי שתרצו.',
  forget: 'למחוק גם את מה שכבר נשלח',
  confirm: 'כן, להפסיק',
  keep: 'להמשיך לשתף',
};

/** The status line for each state (`at`: when the summary last went, an ISO time, or null). */
export function statusLine(summary, at, { now = new Date() } = {}) {
  switch (summary) {
    case 'on': return at ? `פועל. הסיכום התעדכן לאחרונה ${whenText(at, { now })}.` : 'פועל. עוד לא נשלח סיכום.';
    case 'child_off': return 'כבוי. ההורים רואים שהשיתוף כבוי, בלי סיבה ובלי פרטים.';
    case 'parent_off': return 'ההורים כיבו את הסיכום מהמכשיר הזה. כרגע לא נשלח כלום.';
    case 'both_off': return 'כבוי. גם ההורים כיבו את הסיכום, אז לא נשלח כלום.';
    default: return 'הסיכום להורים לא פעיל כרגע, אז לא נשלח כלום.';
  }
}
/** The child's own switch is on in these states (only theirs counts for the button). */
const CHILD_ON = ['on', 'parent_off'];
const CHILD_OFF = ['child_off', 'both_off'];
/** The trailing word of the Settings row. */
export const stateWord = (summary) => (summary === 'on' ? 'פועל' : 'כבוי');

export default function SharingSheet({ open, onOpenChange }) {
  const fd = useApp((s) => s.ai.familyDevice);
  const summary = useAIStatus((x) => x.status?.linked?.summary ?? null);
  const { input, clock } = useReportInput();
  const [seeLast, setSeeLast] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [forget, setForget] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lastId = useId();
  const todayRow = summary === 'on' ? daySummary(input, dayOf(), clock) : null;
  const sent = fd?.lastSent?.days || [];
  const change = async (on) => {
    setBusy(true); setError('');
    try {
      await setChildSharing(on, { forget: !on && forget });
      // the status line at the top of the sheet says the new state (no toast over the sheet)
      setConfirm(false); setForget(false);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  return (
    <>
      <Sheet open={open && !confirm} onOpenChange={(o) => { if (!o) { setSeeLast(false); setError(''); } onOpenChange(o); }} title={SHARING.title} className="sharing-sheet">
        <div className="sharing-body">
          <p className="sharing-status" role="status">{statusLine(summary, fd?.lastSent?.at)}</p>
          {todayRow && (
            <section className="sharing-sec" aria-label={SHARING.today}>
              <h3 className="sharing-head">{SHARING.today}</h3>
              <DayView day={todayRow} today={clock.today} />
            </section>
          )}
          {fd?.lastSent?.at && sent.length > 0 && (
            <section className="sharing-sec" aria-labelledby={lastId}>
              <div className="sharing-last">
                <h3 id={lastId} className="sharing-head">{`${SHARING.last}: ${whenText(fd.lastSent.at)}`}</h3>
                <Button variant="ghost" className="btn-sm" aria-expanded={seeLast} onClick={() => setSeeLast(!seeLast)}>{seeLast ? SHARING.hide : SHARING.see}</Button>
              </div>
              {seeLast && <div className="sharing-rows">{[...sent].reverse().map((r) => <DayView key={r.d} day={r} today={clock.today} />)}</div>}
            </section>
          )}
          <p className="sharing-never">{SHARING.never}</p>
          <p className="sharing-kept">{SHARING.kept}</p>
          {error && <p className="form-error" role="alert">{error}</p>}
          {CHILD_ON.includes(summary) && <Button variant="secondary" className="btn-block" onClick={() => { setError(''); setConfirm(true); }}>{SHARING.stop}</Button>}
          {CHILD_OFF.includes(summary) && (
            <>
              <Button className="btn-block" onClick={() => change(true)} disabled={busy}>{busy ? 'רגע…' : SHARING.start}</Button>
              {summary === 'both_off' && <p className="field-hint sharing-hint">{SHARING.bothHint}</p>}
            </>
          )}
        </div>
      </Sheet>
      <ConfirmSheet open={open && confirm} onOpenChange={(o) => { if (!o && !busy) { setConfirm(false); setForget(false); } }} title={SHARING.confirmTitle}
        keep={SHARING.keep} confirm={busy ? 'רגע…' : SHARING.confirm} onConfirm={() => change(false)} mood="idle">
        <p>{SHARING.confirmBody}</p>
        <label className="share-check sharing-forget"><input type="checkbox" checked={forget} onChange={(e) => setForget(e.target.checked)} /><span>{SHARING.forget}</span></label>
        {error && <p className="form-error" role="alert">{error}</p>}
      </ConfirmSheet>
    </>
  );
}
