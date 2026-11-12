// The first-run line (COUNCIL2-24). A solo student's backup is on by default once the app has a server: it starts right
// after the first questions (lib/durable/vault.js defaultBackup). Learn says once what it is: an encrypted copy on the
// server that only the backup code opens, and the code is kept only on this device, so it is worth sending to a parent.
// "להציג את הקוד" opens the code's sheet (send it, copy it, or "שמרתי"); "להגדרות" opens Settings › שמירת ההתקדמות,
// where the backup can be stopped. Either one, or the X ("הבנתי"), ends the line for good (clearBackupNote). Learn loads
// this file only while the line is due (showBackupLine), with its few rules.
import { lazy, Suspense, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, X } from 'lucide-react';
import { useApp } from '@/lib/store.js';
import { clearBackupNote } from '@/lib/durable/vault.js';
import { Button } from '@/components/ui.jsx';
import '@/styles/lazy/backupLine.css'; // this card's own rules, out of the first load (COUNCIL2-20)

// the code's sheet (and its QR code) loads only when the student asks to see the code
const BackupCodeSheet = lazy(() => import('./BackupCodeSheet.jsx'));

export const BACKUP_LINE = {
  title: 'ההתקדמות שלכם מגובה',
  text: 'עותק מוצפן נשמר בשרת, ורק קוד הגיבוי פותח אותו. הקוד נמצא רק במכשיר הזה, אז כדאי לשלוח אותו להורים. אפשר לכבות את הגיבוי בהגדרות.',
  code: 'להציג את הקוד',
  settings: 'להגדרות',
  close: 'הבנתי',
};

export default function BackupLine() {
  const navigate = useNavigate();
  const code = useApp((s) => s.backup?.code);
  const [sheet, setSheet] = useState(false);
  const done = () => clearBackupNote();
  return (
    <>
      <section className="install-card backup-line" aria-labelledby="backup-line-title">
        <span className="install-card-icon" aria-hidden="true"><ShieldCheck size={22} /></span>
        <div className="install-card-text">
          <h2 id="backup-line-title" className="install-card-title">{BACKUP_LINE.title}</h2>
          <p>{BACKUP_LINE.text}</p>
          <div className="backup-line-actions">
            <Button variant="secondary" className="btn-sm" onClick={() => setSheet(true)}>{BACKUP_LINE.code}</Button>
            <Button variant="ghost" className="btn-sm" onClick={() => { done(); navigate('/settings#save'); }}>{BACKUP_LINE.settings}</Button>
          </div>
        </div>
        <button type="button" className="icon-btn install-card-close" onClick={done} aria-label={BACKUP_LINE.close}><X size={20} aria-hidden="true" /></button>
      </section>
      {/* closing the sheet ("שמרתי", or the sheet's own close) ends the line: the student has seen the code */}
      {sheet && code && <Suspense fallback={null}><BackupCodeSheet code={code} open onOpenChange={(o) => { if (!o) { setSheet(false); done(); } }} /></Suspense>}
    </>
  );
}
