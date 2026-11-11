// Settings, "תזכורת יומית" (STUDENT-11): on or off, the hour (16:00-20:00), and one line on the rules; or the one line
// that says why there is no reminder here (no server, the browser, iPhone in a tab, notifications blocked). Turning it
// on asks the browser inside the tap; a new hour subscribes again with `replaces`. Same segmented pattern as the other
// choices in Settings.
import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { toast } from 'sonner';
import { useApp } from '@/lib/store.js';
import { pushState, enable, disable } from '@/lib/push.js';
import { errorText } from '@/lib/api.js';
import { SLOTS, DEFAULT_SLOT, REMINDER_TEXT as T } from '@/lib/reminder.js';

const LINE = { 'no-server': T.noServer, 'off-server': T.noServer, unsupported: T.unsupported, 'ios-install': T.ios, denied: T.denied };

export default function ReminderSettings() {
  const r = useApp((x) => x.reminder) || {};
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    pushState().then((s) => {
      if (!live) return;
      setState(s);
      // notifications blocked in the browser after it was turned on: nothing can arrive, so the server forgets it
      if (s === 'denied' && useApp.getState().reminder?.on) disable({ quiet: true });
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
        if (res.ok) { setState('on'); toast.success(T.toastOn(slot)); } else if (res.state === 'denied') setState('denied');
      })
      : disable().then(() => { setState('ready'); toast(T.toastOff); });
    job.catch(fail).finally(() => setBusy(false));
  };
  // while busy the choices stay focusable (aria-disabled), so a keyboard user keeps their place
  const move = (h) => {
    if (busy || h === slot) return;
    setBusy(true);
    enable(h).then((res) => { if (res.ok) toast.success(T.toastOn(h)); }).catch(fail).finally(() => setBusy(false));
  };
  return (
    <section className="section set-group remind-set" aria-labelledby="rem-title" aria-busy={busy || undefined}>
      <h2 id="rem-title" className="set-head">{T.title}</h2>
      {LINE[state] ? <p className="field-hint" id="rem-hint">{LINE[state]}</p> : (
        <>
          <div className="segmented" role="radiogroup" aria-labelledby="rem-title" aria-describedby="rem-hint">
            <button type="button" role="radio" aria-checked={on} className={clsx('seg', on && 'on')} onClick={() => turn(true)} aria-disabled={busy || undefined}>{T.optOn}</button>
            <button type="button" role="radio" aria-checked={!on} className={clsx('seg', !on && 'on')} onClick={() => turn(false)} aria-disabled={busy || undefined}>{T.optOff}</button>
          </div>
          {on && (
            <div className="remind-slots">
              <span className="field-label" id="rem-slot">{T.slotLabel}</span>
              <div className="segmented" role="radiogroup" aria-labelledby="rem-slot">
                {SLOTS.map((h) => (
                  <button key={h} type="button" role="radio" aria-checked={slot === h} className={clsx('seg', slot === h && 'on')} onClick={() => move(h)} aria-disabled={busy || undefined}>
                    <span dir="ltr">{h}:00</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {!on && r.state === 'paused' && <p className="remind-paused">{T.paused}</p>}
          <p className="field-hint" id="rem-hint">{T.hint}</p>
        </>
      )}
    </section>
  );
}
