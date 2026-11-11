// Settings, "תזכורת יומית" (STUDENT-11): on or off, the hour (16:00-20:00), and one line on the rules; or the one line
// that says why there is no reminder here (no server, the browser, iPhone in a tab, notifications blocked). Turning it
// on asks the browser inside the tap; a new hour subscribes again with `replaces`. Both choices are the shared Segmented
// (components/ui.jsx), as the other choices in Settings. In the iPhone app (STUDENT-12) the same choices schedule local
// notifications (lib/push.js hands over to lib/localReminder.js): iOS asks inside the tap, and when the app's
// notifications are off in the phone's settings the line says so. In iPhone Safari (a tab: 'ios-install') the line says
// the reminder works from the Home Screen, and "איך מוסיפים למסך הבית" opens the one Home Screen guide (DURABLE-3's
// InstallSheet, as Learn and Settings › שמירת ההתקדמות open it; opening it notes durable.installHintAt).
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ChevronLeft } from 'lucide-react';
import { useApp } from '@/lib/store.js';
import { reminderState, enable, disable } from '@/lib/push.js';
import { errorText } from '@/lib/api.js';
import { SLOTS, DEFAULT_SLOT, REMINDER_TEXT as T } from '@/lib/reminder.js';
import { Segmented } from '@/components/ui.jsx';
import InstallSheet from '@/components/durable/InstallSheet.jsx';

/** The hours as the shared Segmented's options: the hour read left to right, "16:00". */
const SLOT_OPTIONS = SLOTS.map((h) => [h, <span key={h} dir="ltr">{h}:00</span>]);

const LINE = {
  'no-server': T.noServer, 'off-server': T.noServer, unsupported: T.unsupported, 'ios-install': T.ios, denied: T.denied,
  'unsupported-app': T.noServer, 'denied-app': T.deniedApp,
};
const BLOCKED = new Set(['denied', 'denied-app']);

export default function ReminderSettings() {
  const r = useApp((x) => x.reminder) || {};
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [guide, setGuide] = useState(false); // the Home Screen guide, from iPhone Safari
  useEffect(() => {
    let live = true;
    reminderState().then((s) => {
      if (!live) return;
      setState(s);
      // notifications blocked after it was turned on: nothing can arrive, so the server (or the phone) forgets it
      if (BLOCKED.has(s) && useApp.getState().reminder?.on) disable({ quiet: true });
    });
    return () => { live = false; };
  }, []);
  if (!state) return null;
  const on = !!r.on;
  const slot = SLOTS.includes(r.slot) ? r.slot : DEFAULT_SLOT;
  const fail = (e) => toast.error(e?.code ? errorText(e.code) : T.unsupported);
  const turn = (want) => {
    if (busy || want === on) return;
    setBusy(true);
    // enable() asks the browser first, still inside this tap
    const job = want
      ? enable(slot).then((res) => {
        if (res.ok) { setState('on'); toast.success(T.toastOn(slot)); } else if (BLOCKED.has(res.state)) setState(res.state);
      })
      : disable().then(() => { setState('ready'); toast(T.toastOff); });
    job.catch(fail).finally(() => setBusy(false));
  };
  // while busy the choices stay focusable (Segmented's busy: aria-disabled, nothing chosen), so a keyboard user keeps their place
  const move = (h) => {
    if (busy || h === slot) return;
    setBusy(true);
    enable(h).then((res) => { if (res.ok) toast.success(T.toastOn(h)); }).catch(fail).finally(() => setBusy(false));
  };
  return (
    <section className="section set-group remind-set" aria-labelledby="rem-title" aria-busy={busy || undefined}>
      <h2 id="rem-title" className="set-head">{T.title}</h2>
      {LINE[state] && <p className="field-hint" id="rem-hint">{LINE[state]}</p>}
      {state === 'ios-install' && (
        <>
          <div className="set-rows-wrap"><div className="set-rows">
            <button type="button" className="set-row save-install remind-install" onClick={() => setGuide(true)} aria-describedby="rem-hint">
              <span>{T.iosHow}</span><ChevronLeft size={18} aria-hidden="true" />
            </button>
          </div></div>
          <InstallSheet open={guide} onOpenChange={setGuide} />
        </>
      )}
      {!LINE[state] && (
        <>
          <Segmented value={on} onValueChange={turn} busy={busy} options={[[true, T.optOn], [false, T.optOff]]} labelledBy="rem-title" describedBy="rem-hint" />
          {on && (
            <div className="remind-slots">
              <span className="field-label" id="rem-slot">{T.slotLabel}</span>
              <Segmented value={slot} onValueChange={move} busy={busy} options={SLOT_OPTIONS} labelledBy="rem-slot" />
            </div>
          )}
          {!on && r.state === 'paused' && <p className="remind-paused">{T.paused}</p>}
          <p className="field-hint" id="rem-hint">{T.hint}</p>
        </>
      )}
    </section>
  );
}
