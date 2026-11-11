// "הסיכום השבועי" (PARENTS-2): the child's own week, computed on this device, previewed exactly as a parent will see it,
// and sent from here if the child wants to. A pushed page like Settings (from the profile's card). This week or last
// week (last week by default on a Sunday, when this week has only just begun). Nothing here talks to a server.
import { useState } from 'react';
import { Send } from 'lucide-react';
import { ScreenBar, ScreenFoot, EmptyState } from '@/components/Screen.jsx';
import ReportView from '@/components/report/ReportView.jsx';
import { ShareSheet, EMPTY_HINT } from '@/components/report/ShareSheet.jsx';
import { useReportInput, useReportWeek } from '@/components/report/useReportWeek.js';
import { weekStart } from '@/learn/report.ts';

/** The Sunday of the week before the week of `day`. */
const lastWeekOf = (day) => { const s = weekStart(day); const t = new Date(`${s}T00:00:00Z`); t.setUTCDate(t.getUTCDate() - 7); return t.toISOString().slice(0, 10); };

export default function Report() {
  const { clock } = useReportInput();
  const thisWeek = weekStart(clock.today);
  const [which, setWhich] = useState(() => (thisWeek === clock.today ? 'last' : 'this'));
  const start = which === 'this' ? thisWeek : lastWeekOf(clock.today);
  const { week } = useReportWeek(start);
  const [sharing, setSharing] = useState(false);
  const inApp = typeof window !== 'undefined' && window.history.state?.idx > 0;
  return (
    <div className="page pushed report-page">
      <ScreenBar title="הסיכום השבועי" back={inApp ? undefined : '/me'} />
      <p className="lead report-intro">זה הסיכום של השבוע שלכם. אם תשלחו אותו להורים, זה בדיוק מה שהם יראו.</p>
      <div className="segmented report-switch" role="radiogroup" aria-label="איזה שבוע להציג">
        <button type="button" role="radio" aria-checked={which === 'this'} className={`seg${which === 'this' ? ' on' : ''}`} onClick={() => setWhich('this')}>השבוע</button>
        <button type="button" role="radio" aria-checked={which === 'last'} className={`seg${which === 'last' ? ' on' : ''}`} onClick={() => setWhich('last')}>השבוע שעבר</button>
      </div>
      {week.empty
        ? (
          <EmptyState mood="idle" className="report-empty" title={which === 'this' ? 'עוד אין מה לסכם השבוע.' : 'בשבוע שעבר לא היה תרגול.'}>
            {which === 'this' && <p>אחרי השיעור הבא יופיע כאן.</p>}
          </EmptyState>
        )
        : <ReportView week={week} audience="child" source="local" today={clock.today} />}
      <p className="footnote report-foot-note">הסיכום נשלח מהמכשיר שלכם, בוואטסאפ או בקישור, ולא נשמר אצלנו.</p>
      <ScreenFoot>
        <button type="button" className="btn btn-primary btn-lg" disabled={week.empty} aria-describedby={week.empty ? 'report-send-hint' : undefined} onClick={() => setSharing(true)}>
          <Send size={20} aria-hidden="true" />לשלוח להורים
        </button>
        {week.empty && <p id="report-send-hint" className="footnote report-send-hint">{EMPTY_HINT}</p>}
      </ScreenFoot>
      <ShareSheet open={sharing} onOpenChange={setSharing} start={start} />
    </div>
  );
}
