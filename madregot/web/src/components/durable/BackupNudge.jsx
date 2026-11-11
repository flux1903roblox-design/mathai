// "שומרים את ההתקדמות?" (DURABLE-5): once in a while, a calm question whether to keep a backup. lib/durable/nudge.js
// says when (a server, no backup or kept copy, two days of learning, a calm screen, at most twice, 14 days apart). It
// opens a moment after the screen settles, never over another sheet and never in a lesson, and asking counts when it
// opens. Its three answers: "לקבל קוד גיבוי" (makes the code and shows it, BackupCodeSheet), "לשמור קובץ במקום" (the
// backup file, straight from the tap), "לא עכשיו". App.jsx mounts it for students.
import { lazy, Suspense, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { useApp } from '@/lib/store.js';
import { hasServer } from '@/lib/api.js';
import { shouldNudge, noteNudge, calmRoute } from '@/lib/durable/nudge.js';
import { createBackup, vaultErrorText } from '@/lib/durable/vault.js';
import { exportBackup } from '@/lib/durable/file.js';
import { Button, Sheet } from '@/components/ui.jsx';
import Mascot from '@/components/Mascot.jsx';
// the code's sheet (and its QR code) loads only when a code was made here: the nudge itself is on every student's screen
const BackupCodeSheet = lazy(() => import('./BackupCodeSheet.jsx'));

export const NUDGE = {
  title: 'שומרים את ההתקדמות?',
  now: 'כרגע ההתקדמות שמורה רק במכשיר הזה. עם קוד גיבוי אפשר להחזיר אותה גם אם המכשיר יתחלף.',
  how: 'קוד גיבוי שומר עותק מוצפן. בלי הקוד אף אחד לא יכול לקרוא אותו, גם לא אנחנו.',
  code: 'לקבל קוד גיבוי',
  file: 'לשמור קובץ במקום',
  later: 'לא עכשיו',
  downloaded: 'קובץ הגיבוי נשמר בהורדות.',
};
/** How long the screen settles before the question opens. */
export const NUDGE_DELAY = 1500;

export default function BackupNudge() {
  const { pathname } = useLocation();
  const server = hasServer();
  const due = useApp((s) => shouldNudge(s, { pathname, server }));
  const code = useApp((s) => s.backup?.code);
  const [open, setOpen] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!due || open) return undefined;
    const t = setTimeout(() => {
      // another sheet is open (the iPhone guide, the tutor's limit…): not now; a later calm screen asks
      if (document.querySelector('[role="dialog"]')) return;
      noteNudge(useApp);
      setMsg('');
      setOpen(true);
    }, NUDGE_DELAY);
    return () => clearTimeout(t);
  }, [due, open]);
  // leaving for a screen that is not calm (back, a link) closes it
  useEffect(() => { if (!calmRoute(pathname)) setOpen(false); }, [pathname]);

  const getCode = async () => {
    setBusy(true); setMsg('');
    try {
      await createBackup();
      setOpen(false);
      setCodeOpen(true);
    } catch (e) { setMsg(vaultErrorText(e)); } finally { setBusy(false); }
  };
  // straight from the tap: the share sheet needs it
  const saveFile = async () => {
    const r = await exportBackup(useApp.getState());
    if (r === 'downloaded') toast(NUDGE.downloaded);
    if (r === 'shared' || r === 'downloaded') setOpen(false);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => { if (!busy) setOpen(o); }} title={NUDGE.title} className="nudge-sheet">
        <div className="nudge-body">
          <Mascot mood="idle" size={88} />
          <p>{NUDGE.now}</p>
          <p className="nudge-how">{NUDGE.how}</p>
          <p className="nudge-status" role="status">{busy ? 'יוצרים קוד…' : msg}</p>
          <div className="nudge-actions">
            <Button className="btn-block btn-lg" onClick={getCode} disabled={busy} aria-busy={busy || undefined}>{NUDGE.code}</Button>
            <Button variant="secondary" className="btn-block" onClick={saveFile} disabled={busy}>{NUDGE.file}</Button>
            <Button variant="ghost" className="btn-block" onClick={() => setOpen(false)} disabled={busy}>{NUDGE.later}</Button>
          </div>
        </div>
      </Sheet>
      {codeOpen && code && <Suspense fallback={null}><BackupCodeSheet code={code} open onOpenChange={setCodeOpen} /></Suspense>}
    </>
  );
}
