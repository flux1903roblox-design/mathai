// The daily reminder's offer after a lesson (STUDENT-11): the last screen of LessonDone, once ever, from the third
// learning day, where the browser and the server (or the iPhone app) can send one (lib/reminder.js reminderDue, then
// reminderState 'ready').
// A notification as it would arrive, one sentence on the rules, the hour, and two answers. "להפעיל" asks the browser
// (inside the tap) and turns it on: the button turns busy, then says "התזכורת פועלת" with a check (STUDENT-15 A1; so no
// toast says it again); "לא, תודה" goes on. Either way the student goes back to the map, and only Settings offers it
// again. Calm: no plan, no price, no streak, no timer.
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { m, useReducedMotion } from 'motion/react';
import { useApp } from '@/lib/store.js';
import { enable } from '@/lib/push.js';
import { errorText } from '@/lib/api.js';
import { count } from '@/lib/metrics.js';
import { SLOTS, DEFAULT_SLOT, REMINDER_TEXT as T } from '@/lib/reminder.js';
import { Button, Segmented } from '@/components/ui.jsx';
import { SPRING } from '@/lib/motion.js';

const focusQuietly = (el) => { if (el) el.focus({ preventScroll: true }); };
// a toast belongs to the screen that raised it (App.jsx Toasts clears them when the route changes): the answer is said
// on the screen the student goes back to, once it is there
const onNextScreen = (show) => setTimeout(show, 400);
const ICON = `${import.meta.env.BASE_URL}icons/192.png`;
// how long the button shows that the reminder is on before the map
const DONE_MS = 900;
const SLOT_OPTIONS = SLOTS.map((h) => [h, <span key={h} dir="ltr">{h}:00</span>]);

export default function ReminderCard({ onDone }) {
  const reduce = useReducedMotion();
  const [slot, setSlot] = useState(DEFAULT_SLOT);
  const [state, setState] = useState('idle'); // the turn-on button: idle | busy | done
  const shown = useRef(false);
  // shown once, ever: from now on only Settings offers it
  useEffect(() => {
    if (shown.current) return;
    shown.current = true;
    useApp.getState().setNudge({ pushOffered: true });
    count('push_offer');
  }, []);
  const turnOn = () => {
    setState('busy');
    // enable() asks the browser first, still inside this tap
    enable(slot)
      .then((r) => {
        if (r.ok) { setState('done'); setTimeout(onDone, DONE_MS); return; }
        if (r.state === 'denied' || r.state === 'denied-app') onNextScreen(() => toast(r.state === 'denied' ? T.denied : T.deniedApp));
        onDone();
      })
      .catch((e) => { onNextScreen(() => toast.error(e?.code ? errorText(e.code) : T.unsupported)); onDone(); });
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
          <Segmented value={slot} onValueChange={setSlot} busy={state !== 'idle'} options={SLOT_OPTIONS} labelledBy="remind-slot" />
        </div>
      </div>
      <div className="done-actions" data-region="footer">
        <Button className="btn-block btn-lg" onClick={turnOn} state={state} doneText={T.doneOn} ref={focusQuietly} aria-describedby="remind-title remind-text">{T.on}</Button>
        <Button variant="ghost" className="btn-block done-quiet" onClick={onDone} disabled={state !== 'idle'}>{T.no}</Button>
      </div>
    </div>
  );
}
