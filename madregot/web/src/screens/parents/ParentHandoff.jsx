// /parents/info on the child's device: a screen to hand to a parent. No price and no plan here. It shows a QR code (made
// on this device) and the link code in large type; the parent scans it with their own phone, reads about the tutor
// there, and, if they choose to, links this device. This device then collects its AI-only token by itself.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import QrCode from '@/components/QrCode.jsx';
import { useApp } from '@/lib/store.js';
import { hasServer } from '@/lib/api.js';
import { startLink, pollLink, useAIStatus } from '@/lib/account.js';
import { Button } from '@/components/ui.jsx';
import Mascot from '@/components/Mascot.jsx';
import ParentsFrame, { NoServerNote } from './ParentsFrame.jsx';

const POLL_MS = 5000;
const POLL_FOR_MS = 15 * 60_000;

export default function ParentHandoff() {
  // linked, and the plan behind it still live (a plan that ended leaves the token on the free taste: link again)
  const device = useApp((s) => s.ai.familyDevice);
  const tier = useAIStatus((x) => x.status?.tier);
  const linked = !!device && (!tier || tier === 'family');
  const pending = useApp((s) => s.ai.pendingLink);
  const [state, setState] = useState(linked ? 'linked' : 'starting'); // starting | waiting | idle | expired | linked | error
  const [error, setError] = useState('');
  const since = useRef(Date.now());
  const server = hasServer();

  const begin = useCallback(async (fresh = false) => {
    setError(''); setState('starting');
    try { await startLink({ fresh }); since.current = Date.now(); setState('waiting'); } catch (e) { setError(e.message); setState('error'); }
  }, []);
  useEffect(() => { if (server && !linked) begin(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // the device asks every 5 seconds while this screen is in view (and when it comes back), for up to 15 minutes
  const check = useCallback(async () => {
    try {
      const r = await pollLink();
      if (r === 'linked') setState('linked');
      else if (r === 'expired') setState('expired');
    } catch (e) { setError(e.message); }
  }, []);
  useEffect(() => {
    if (state !== 'waiting') return undefined;
    const t = setInterval(() => {
      if (Date.now() - since.current > POLL_FOR_MS) { setState('idle'); return; }
      if (document.visibilityState === 'visible') check();
    }, POLL_MS);
    const onShow = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onShow);
    window.addEventListener('focus', onShow);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onShow); window.removeEventListener('focus', onShow); };
  }, [state, check]);
  useEffect(() => { if (linked) setState('linked'); }, [linked]);

  let body;
  if (!server) body = <NoServerNote />;
  else if (state === 'linked') {
    body = (
      <section className="card parents-card handoff-done" role="status">
        <Mascot mood="happy" size={96} />
        <h2 className="card-title">העוזר החכם פתוח! אפשר לשאול אותו על כל תרגיל.</h2>
        <Link to="/assistant" className="btn btn-primary btn-block btn-lg">לעוזר החכם</Link>
      </section>
    );
  } else {
    const url = pending?.url;
    body = (
      <>
        <section className="card parents-card handoff" aria-labelledby="handoff-title">
          <p id="handoff-title" className="handoff-lead">הורים, סרקו את הקוד במצלמה של הטלפון שלכם כדי לקרוא על העוזר החכם, ואם תרצו, לחבר אותו למכשיר הזה.</p>
          {state === 'starting' && <p className="muted" role="status">מכינים קוד…</p>}
          {state === 'error' && (
            <>
              <p className="form-error" role="alert">{error}</p>
              <Button variant="secondary" onClick={() => begin(true)}>לנסות שוב</Button>
            </>
          )}
          {state === 'expired' && (
            <>
              <p role="status">הקוד פג.</p>
              <Button onClick={() => begin(true)}>קוד חדש</Button>
            </>
          )}
          {(state === 'waiting' || state === 'idle') && pending && (
            <>
              <div className="handoff-qr"><QrCode text={url} label="קוד QR לטלפון של ההורים" /></div>
              <p className="handoff-code" aria-label={`הקוד: ${pending.code.split('').join(' ')}`}><bdi dir="ltr">{pending.code}</bdi></p>
              <p className="muted">הקוד תקף לשעה</p>
              {state === 'waiting' ? <p className="handoff-wait" role="status">מחכים להורים…</p>
                : <Button variant="secondary" onClick={() => { since.current = Date.now(); setState('waiting'); check(); }}>לבדוק שוב</Button>}
            </>
          )}
        </section>
        <Link to="/parents?here=1" className="btn btn-secondary btn-block handoff-here">להמשיך במכשיר הזה (להורים)</Link>
      </>
    );
  }
  return <ParentsFrame title="המסך הזה בשביל ההורים">{body}</ParentsFrame>;
}
