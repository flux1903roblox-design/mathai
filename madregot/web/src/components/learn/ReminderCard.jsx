// The daily reminder's offer after a lesson (STUDENT-11): the last screen of LessonDone, once ever, from the third
// learning day, where the browser and the server can send one (lib/reminder.js reminderDue, then pushState 'ready').
// A notification as it would arrive, one sentence on the rules, the hour, and two answers. "להפעיל" asks the browser
// (inside the tap) and turns it on; "לא, תודה" goes on. Either way the student goes back to the map, and only Settings
// offers it again. Calm: no plan, no price, no streak, no timer.
import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { toast } from 'sonner';
import { m, useReducedMotion } from 'motion/react';
import { useApp } from '@/lib/store.js';
import { enable } from '@/lib/push.js';
import { errorText } from '@/lib/api.js';
import { count } from '@/lib/metrics.js';
import { SLOTS, DEFAULT_SLOT, REMINDER_TEXT as T } from '@/lib/reminder.js';
import { Button } from '@/components/ui.jsx';
import { SPRING } from '@/lib/motion.js';

const focusQuietly = (el) => { if (el) el.focus({ preventScroll: true }); };
// a toast belongs to the screen that raised it (App.jsx Toasts clears them when the route changes): the answer is said
// on the screen the student goes back to, once it is there
const onNextScreen = (show) => setTimeout(show, 400);
const ICON = `${import.meta.env.BASE_URL}icons/192.png`;

export default function ReminderCard({ onDone }) {
  const reduce = useReducedMotion();
  const [slot, setSlot] = useState(DEFAULT_SLOT);
  const [busy, setBusy] = useState(false);
  const shown = useRef(false);
  // shown once, ever: from now on only Settings offers it
  useEffect(() => {
    if (shown.current) return;
    shown.current = true;
    useApp.getState().setNudge({ pushOffered: true });
    count('push_offer');
  }, []);
  const turnOn = () => {
    setBusy(true);
    // enable() asks the browser first, still inside this tap
    enable(slot)
      .then((r) => {
        if (r.ok) onNextScreen(() => toast.success(T.toastOn(slot)));
        else if (r.state === 'denied') onNextScreen(() => toast(T.denied));
      })
      .catch((e) => onNextScreen(() => toast.error(e?.code ? errorText(e.code) : T.unsupported)))
      .finally(onDone);
  };
  return (
    <div className="done-screen remind-stage">
      <div className="done-hero remind-hero" aria-hidden="true">
        <m.div className="remind-note" initial={reduce ? false : { y: -16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ ...SPRING.soft, delay: 0.15 }}>
          <img src={ICON} alt="" width="40" height="40" />
          <span className="remind-note-text"><b>מדרגות</b><span>{T.sample}</span></span>
          <span className="remind-note-time" dir="ltr">{slot}:00</span>
        </m.div>
      </div>
      <div className="done-copy">
        <h1 className="done-title" id="remind-title">{T.cardTitle}</h1>
        <p className="install-text" id="remind-text">{T.cardBody}</p>
        <div className="remind-slots">
          <span className="field-label" id="remind-slot">{T.slotLabel}</span>
          <div className="segmented" role="radiogroup" aria-labelledby="remind-slot">
            {SLOTS.map((h) => (
              <button key={h} type="button" role="radio" aria-checked={slot === h} className={clsx('seg', slot === h && 'on')} onClick={() => setSlot(h)} disabled={busy}>
                <span dir="ltr">{h}:00</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="done-actions" data-region="footer">
        <Button className="btn-block btn-lg" onClick={turnOn} disabled={busy} ref={focusQuietly} aria-describedby="remind-title remind-text">{T.on}</Button>
        <Button variant="ghost" className="btn-block done-quiet" onClick={onDone} disabled={busy}>{T.no}</Button>
      </div>
    </div>
  );
}
