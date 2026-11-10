// /parents/info on the child's device: a screen to hand to a parent. No price and no plan here. It shows a QR code (made
// on this device) and the link code in large type; the parent scans it with their own phone, reads about the tutor
// there, and, if they choose to, approves it on this device: for free (the one-time parent's OK, trust spec TRUST-9) or
// with a plan. This device then collects its AI-only token by itself.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import qrcode from 'qrcode-generator';
import { useApp } from '@/lib/store.js';
import { hasServer } from '@/lib/api.js';
import { startLink, pollLink, useAIStatus } from '@/lib/account.js';
import { Button } from '@/components/ui.jsx';
import Mascot from '@/components/Mascot.jsx';
import ParentsFrame, { NoServerNote } from './ParentsFrame.jsx';

const POLL_MS = 5000;
const POLL_FOR_MS = 15 * 60_000;

/** A QR code drawn as SVG squares from the link itself: nothing is fetched, nothing is injected as HTML. */
export function QrCode({ text, size = 208, label }) {
  const path = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    const n = qr.getModuleCount();
    let d = '';
    for (let r = 0; r < n; r += 1) for (let c = 0; c < n; c += 1) if (qr.isDark(r, c)) d += `M${c + 4} ${r + 4}h1v1h-1z`;
    return { d, n: n + 8 };
  }, [text]);
  return (
    <svg className="qr" width={size} height={size} viewBox={`0 0 ${path.n} ${path.n}`} role="img" aria-label={label} shapeRendering="crispEdges">
      {/* a QR code must stay dark on light in both themes */}
      <rect width={path.n} height={path.n} fill="#fff" />{/* colour-ok: QR must stay dark on light */}
      <path d={path.d} fill="#14161a" />{/* colour-ok: QR must stay dark on light */}
    </svg>
  );
}

export default function ParentHandoff() {
  // a token means a parent approved this device (for free or with a plan): it stays approved when a plan ends, and a
  // plan later needs no new link
  const device = useApp((s) => s.ai.familyDevice);
  const tier = useAIStatus((x) => x.status?.tier);
  const linked = !!device;
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
        <h2 className="card-title">{tier === 'free' ? 'ההורים אישרו את העוזר החכם במכשיר הזה.' : 'העוזר החכם פתוח! אפשר לשאול אותו על כל תרגיל.'}</h2>
        <Link to="/assistant" className="btn btn-primary btn-block btn-lg">לעוזר החכם</Link>
      </section>
    );
  } else {
    const url = pending?.url;
    body = (
      <>
        <section className="card parents-card handoff" aria-labelledby="handoff-title">
          <p id="handoff-title" className="handoff-lead">הורים, סרקו את הקוד בטלפון שלכם. שם תקראו על העוזר החכם ותוכלו לאשר אותו במכשיר הזה, בחינם או עם מנוי.</p>
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
