// The install offer after a lesson (STUDENT-10): the last stage of LessonDone, from the second learning day, at most
// twice, 30 days apart, and only where the browser can install (lib/install.js installDue). A home screen with the app's
// icon on it, one sentence on what it gives, and two answers: "להתקין" opens the browser's own install prompt, "לא
// עכשיו" goes on. Either way the student goes back to the map. Calm: no badge, no timer, nothing to lose.
import { useEffect, useRef, useState } from 'react';
import { m, useReducedMotion } from 'motion/react';
import { useApp, today } from '@/lib/store.js';
import { offer } from '@/lib/install.js';
import { count } from '@/lib/metrics.js';
import { Button } from '@/components/ui.jsx';
import { SPRING } from '@/lib/motion.js';

const focusQuietly = (el) => { if (el) el.focus({ preventScroll: true }); };
const ICON = `${import.meta.env.BASE_URL}icons/maskable-512.png`;

export default function InstallCard({ onDone }) {
  const reduce = useReducedMotion();
  const [busy, setBusy] = useState(false);
  const shown = useRef(false);
  // shown: one of the two offers is used, and it counts as set aside from today unless the app gets installed
  useEffect(() => {
    if (shown.current) return;
    shown.current = true;
    const n = useApp.getState().nudges || {};
    useApp.getState().setNudge({ installOffers: (n.installOffers || 0) + 1, installDismissedAt: today() });
    count('install_offer');
  }, []);
  const install = async () => { setBusy(true); await offer(); onDone(); };
  return (
    <div className="done-screen install-stage">
      <div className="done-hero install-hero" aria-hidden="true">
        <div className="install-home">
          <span className="install-app"><i /><b /></span>
          <m.span className="install-app ours" initial={reduce ? false : { scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ ...SPRING.pop, delay: 0.2 }}>
            <img src={ICON} alt="" width="64" height="64" />
            <b>מדרגות</b>
          </m.span>
          <span className="install-app"><i /><b /></span>
        </div>
      </div>
      <div className="done-copy">
        <h1 className="done-title" id="install-title">מדרגות במסך הבית</h1>
        <p className="install-text" id="install-text">פותחים בלחיצה, עובד גם בלי אינטרנט, וההתקדמות נשמרת טוב יותר.</p>
      </div>
      <div className="done-actions" data-region="footer">
        <Button className="btn-block btn-lg" onClick={install} disabled={busy} ref={focusQuietly} aria-describedby="install-title install-text">להתקין</Button>
        <Button variant="ghost" className="btn-block done-quiet" onClick={onDone} disabled={busy}>לא עכשיו</Button>
      </div>
    </div>
  );
}
