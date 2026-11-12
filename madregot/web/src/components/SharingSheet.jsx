// "שיתוף עם ההורים" (PARENTS-4): what this linked device sends its parents, shown to the child at any time. Opened from
// Settings (the AI section's row), from the profile's "משותף עם ההורים" chip and from the notice. It says whether the
// summary is on and when it last went; today's row in words (exactly what goes); the rows sent last, in words; what is
// never sent; how long it is kept; and the child's own switch, which the parent sees only as "off", with no reason.
// No plan and no price here: the child sees what is shared, never what it costs.
import { useId, useState } from 'react';
import { useApp, today as dayOf } from '@/lib/store.js';
import { useAIStatus } from '@/lib/account.js';
import { setChildSharing, EARLIER_TEXT } from '@/lib/familySync.js';
import { whenText } from '@/lib/when.js';
import { useReportInput } from '@/components/report/useReportWeek.js';
import { DayView } from '@/components/report/ReportView.jsx';
import { daySummary } from '@/learn/report.ts';
import { Button, Sheet } from '@/components/ui.jsx';
import { ConfirmSheet } from '@/components/Screen.jsx';
import { localized, t } from '@/lib/i18n.js';
import '@/styles/lazy/shared.css'; // the rules this screen shares with other screens loaded on demand, out of the first load (COUNCIL2-20)

export let SHARING = localized(() => ({
  title: t('shell.sharingsheet.1'),
  today: t('shell.sharingsheet.2'),
  last: t('shell.sharingsheet.3'),
  see: t('shell.sharingsheet.4'),
  hide: t('shell.sharingsheet.5'),
  never: t('shell.sharingsheet.6'),
  kept: t('shell.sharingsheet.7'),
  stop: t('shell.sharingsheet.8'),
  start: t('shell.sharingsheet.9'),
  bothHint: t('shell.sharingsheet.10'),
  confirmTitle: t('shell.sharingsheet.11'),
  confirmBody: t('shell.sharingsheet.12'),
  forget: t('shell.sharingsheet.13'),
  confirm: t('shell.sharingsheet.14'),
  keep: t('shell.sharingsheet.15'),
}), (v) => { SHARING = v; });

/** The status line for each state (`at`: when the summary last went, an ISO time, or null). */
export function statusLine(summary, at, { now = new Date() } = {}) {
  switch (summary) {
    case 'on': return at ? t('shell.sharingsheet.16', { p0: whenText(at, { now }) }) : t('shell.sharingsheet.17');
    case 'child_off': return t('shell.sharingsheet.18');
    case 'parent_off': return t('shell.sharingsheet.19');
    case 'both_off': return t('shell.sharingsheet.20');
    default: return t('shell.sharingsheet.21');
  }
}
/** The child's own switch is on in these states (only theirs counts for the button). */
const CHILD_ON = ['on', 'parent_off'];
const CHILD_OFF = ['child_off', 'both_off'];
/** The trailing word of the Settings row. */
export const stateWord = (summary) => (summary === 'on' ? t('shell.sharingsheet.22') : t('shell.sharingsheet.23'));

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
          {fd?.earlier && <p className="sharing-earlier">{EARLIER_TEXT}</p>}
          {error && <p className="form-error" role="alert">{error}</p>}
          {CHILD_ON.includes(summary) && <Button variant="secondary" className="btn-block" onClick={() => { setError(''); setConfirm(true); }}>{SHARING.stop}</Button>}
          {CHILD_OFF.includes(summary) && (
            <>
              <Button className="btn-block" onClick={() => change(true)} disabled={busy}>{busy ? t('shell.sharingsheet.24') : SHARING.start}</Button>
              {summary === 'both_off' && <p className="field-hint sharing-hint">{SHARING.bothHint}</p>}
            </>
          )}
        </div>
      </Sheet>
      <ConfirmSheet open={open && confirm} onOpenChange={(o) => { if (!o && !busy) { setConfirm(false); setForget(false); } }} title={SHARING.confirmTitle}
        keep={SHARING.keep} confirm={busy ? t('shell.sharingsheet.24') : SHARING.confirm} onConfirm={() => change(false)} mood="idle">
        <p>{SHARING.confirmBody}</p>
        <label className="share-check sharing-forget"><input type="checkbox" checked={forget} onChange={(e) => setForget(e.target.checked)} /><span>{SHARING.forget}</span></label>
        {error && <p className="form-error" role="alert">{error}</p>}
      </ConfirmSheet>
    </>
  );
}
