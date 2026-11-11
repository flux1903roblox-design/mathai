// The Sunday recap's card on Learn, above the path (STUDENT-6, FOLLOWUP-38): "איך היה השבוע שעבר?", Sunday to Tuesday,
// after a week with learning, once a week (lib/recap.js says when). It is the one Sunday card: the week's numbers, and
// the way to send them to a parent, are inside it. The week is learn/report.ts weekLocal of last week's Sunday, the same
// call /report makes for "השבוע שעבר", made once here and handed to the sheet, which never counts again. Learn loads
// this card only on a day it is due, and the engine and the sheet load after it, so the home screen's first download
// carries none of it.
import { lazy, Suspense, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useApp, today } from '@/lib/store.js';
import { recapDue, recapShown } from '@/lib/recap.js';
import { count } from '@/lib/metrics.js';
import { qaReport } from '@/lib/qaFixtures.js';
import '@/styles/lazy/recap.css'; // the card's and the sheet's rules, loaded with the card (not in the boot CSS)

const RecapSheet = lazy(() => import('./RecapSheet.jsx'));

export default function RecapCard({ afterLesson = false }) {
  const seen = useApp((s) => s.nudges?.recapWeek ?? null);
  const day = today();
  // the staging copy's fixed report week (?qa-report) is a made-up week: no recap is drawn from it
  const due = qaReport() ? null : recapDue({ today: day, seen, afterLesson });
  const [week, setWeek] = useState(null);
  const [open, setOpen] = useState(null); // null | 'recap' | 'share'
  useEffect(() => {
    if (!due) return undefined;
    let live = true;
    import('@/learn/report.ts').then(({ weekLocal }) => {
      const { days, learn } = useApp.getState();
      if (live) setWeek(weekLocal({ days, learn }, due, { today: day, now: new Date().toISOString() }));
    }).catch(() => { /* no engine (offline, first visit): no card this time */ });
    return () => { live = false; };
  }, [due, day]);

  const start = week?.start;
  const close = () => { if (start) useApp.getState().setNudge({ recapWeek: start }); setOpen(null); };
  const show = () => { count('recap_open'); setOpen('recap'); };
  return (
    <>
      {recapShown({ today: day, seen, afterLesson }, week) && !qaReport() && (
        <section className="recap-card" aria-labelledby="recap-card-title">
          <div className="recap-card-text">
            <h2 id="recap-card-title" className="recap-card-title">איך היה השבוע שעבר?</h2>
            <p>ימים, צעדים ומה שלמדתם. לוקח חצי דקה.</p>
          </div>
          <button type="button" className="btn btn-primary btn-sm recap-card-go" onClick={show}>לראות</button>
          <button type="button" className="icon-btn recap-card-close" aria-label="סגירה" onClick={close}><X size={20} aria-hidden="true" /></button>
        </section>
      )}
      {open && week && (
        <Suspense fallback={null}>
          <RecapSheet view={open} week={week} onClose={close} onShare={() => { close(); setOpen('share'); }} onShareClose={() => setOpen(null)} />
        </Suspense>
      )}
    </>
  );
}
