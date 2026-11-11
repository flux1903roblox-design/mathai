// Settings › שמירת ההתקדמות (DURABLE-1, DURABLE-3, DURABLE-4): where the progress is kept, said plainly, and the backup file.
//   - the first row is this device: saved (in the browser's storage, or in the copy on the device when the storage is
//     full), or not, and why;
//   - "שמירה קבועה בדפדפן": whether the browser promised to keep the data (durable/persist.js), as it answered; the info
//     button says when browsers delete data (PersistInfoSheet), and while there is no promise "לבקש מהדפדפן לשמור" asks
//     (on Firefox only once: its prompt remembers the answer);
//   - on an iPhone or iPad in the browser, "להוסיף למסך הבית" opens the Home Screen guide (InstallSheet);
//   - "לשמור קובץ גיבוי" shares or downloads the backup file, "לשחזר מקובץ" reads one back (RestorePreview says what
//     it holds and what restoring it does), and a note says who can read the file. A teacher's file also holds the
//     class keys, so the teacher's note says so (role="teacher": the teacher's class settings place this section);
//   - for 30 days after a restore replaced another student's progress, "לבטל את השחזור האחרון" brings it back;
//   - with a server, "גיבוי" is the backup code (DURABLE-5, durable/vault.js): its state, and "ליצור קוד גיבוי" (make a
//     code, push the first sealed copy, show the code in BackupCodeSheet), or, while it is on, "להציג את קוד הגיבוי"
//     and "להפסיק את הגיבוי" (after a confirmation: the copy on the server is deleted). When the vault holds another
//     student's progress, a note says so and offers "ליצור קוד חדש" or "להשאיר כך" (both let go of that vault without
//     deleting it: it is the other student's). After the vault was made again (it expired), after it was deleted from
//     another device with the same code (the backup is off here then), and after a family let go of this device (the
//     backup moved to a new code), a one-time note says so.
//     "לשחזר מקוד או מקובץ" opens the restore screen (#/restore), which takes the code or the file. The file part keeps
//     its own "לשחזר מקובץ" (the file's share text names that button).
//   - a class student (DURABLE-6): the switch "שמירת עותק בשרת הכיתה" (on while the class keeps the code; turning it off
//     asks first, then POST /api/vault/escrow/delete and durable.escrowClass off; on again keeps the code again), and the
//     class note while it is on; a family device whose code the family keeps: the family note. Neither says "מוצפן":
//     the server could open those copies.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Info, ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from '@/lib/store.js';
import { useDurable, savedHealth, healthText } from '@/lib/durable/useDurable.js';
import { exportBackup } from '@/lib/durable/file.js';
import { canUndo, undoRestore, UNDO_TOAST, NO_UNDO } from '@/lib/durable/apply.js';
import { persistedText, canAsk, askFromSettings, PERSIST_TOAST } from '@/lib/durable/persist.js';
import { guideHere } from '@/lib/durable/install.js';
import { hasServer } from '@/lib/api.js';
import { createBackup, stopBackup, detachBackup, clearBackupNote, backupText, vaultErrorText, BACKUP_TEXT } from '@/lib/durable/vault.js';
import { escrowHas, setClassCopy, ESCROW_TEXT } from '@/lib/durable/escrow.js';
import { Button, Sheet } from '@/components/ui.jsx';
import { ConfirmSheet } from '@/components/Screen.jsx';
import BackupCodeSheet from './BackupCodeSheet.jsx';
import FileRestore from './FileRestore.jsx';
import RestorePreview from './RestorePreview.jsx';
import PersistInfoSheet from './PersistInfoSheet.jsx';
import InstallSheet from './InstallSheet.jsx';
import '@/styles/lazy/durable.css'; // the saving rules, loaded with this screen (FOLLOWUP-23)

/** Under "ליצור קוד גיבוי": what the code keeps, and who can read it. */
export const BACKUP_NOTE = 'קוד גיבוי שומר עותק מוצפן. בלי הקוד אף אחד לא יכול לקרוא אותו, גם לא אנחנו.';
export const STOPPED = 'הגיבוי הופסק, והעותק בשרת נמחק.';
/** Stopping the backup: the copy on the server goes (said without "מוצפן" when the class or the family kept its code). */
export const STOP_TEXT = {
  code: 'העותק המוצפן בשרת יימחק, וקוד הגיבוי יפסיק לעבוד. ההתקדמות במכשיר הזה נשארת.',
  kept: 'העותק בשרת יימחק, וקוד הגיבוי יפסיק לעבוד. ההתקדמות במכשיר הזה נשארת.',
};
/** The class and the family keep the code (DURABLE-6): what that copy is for, said plainly. */
export const KEPT_NOTE = {
  class: 'עותק של ההתקדמות נשמר בשרת של מדרגות. במכשיר חדש מתחברים לכיתה עם הקוד האישי, וההתקדמות חוזרת.',
  family: 'עותק של ההתקדמות נשמר בשרת דרך המנוי המשפחתי. כשמחליפים מכשיר, ההורים מחברים את החדש וההתקדמות עוברת אליו.',
};
/** The backup is working (or about to): the row shows the check. */
const backupOk = (b) => !!b?.on && (b.state == null || b.state === 'idle' || b.state === 'gone');

const NOTE = {
  student: 'בקובץ יש את כל ההתקדמות, כולל השם. מי שמקבל אותו יכול לקרוא אותו.',
  teacher: 'בקובץ יש גם את מפתח המורה של הכיתות. מי שמקבל אותו יכול להיכנס ללוח הכיתה, אז שמרו אותו רק אצלכם.',
};

export default function SaveSection({ role = 'student' }) {
  const health = useDurable((s) => s.health);
  const persisted = useDurable((s) => s.persisted);
  const undoUntil = useApp((s) => s.backup?.undoUntil);
  const persistAsked = useApp((s) => s.durable?.persistAsked);
  const saved = savedHealth(health);
  const [found, setFound] = useState(null);
  const [status, setStatus] = useState('');
  const [info, setInfo] = useState(false);
  const [install, setInstall] = useState(false);
  const backup = useApp((s) => s.backup);
  const server = hasServer();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(null); // 'create' | 'stop' while the server is asked
  const [backupMsg, setBackupMsg] = useState('');
  const [codeOpen, setCodeOpen] = useState(false);
  const [stopAsk, setStopAsk] = useState(false);
  const inClass = useApp((s) => s.profile?.role === 'student' && !!s.profile?.token);
  const classKept = escrowHas(backup, 'class');
  const familyKept = escrowHas(backup, 'family');
  const [copyAsk, setCopyAsk] = useState(false);
  // "שמירת עותק בשרת הכיתה": off asks first; on keeps the code with the class again (a backup is made when there is none)
  const classCopy = async (on) => {
    setBusy('copy'); setBackupMsg('');
    try {
      const r = await setClassCopy(on);
      if (r === 'escrow_off') setBackupMsg(ESCROW_TEXT.off);
      else if (r === 'error') setBackupMsg(vaultErrorText({ code: 'server_error' }));
    } catch (e) { setBackupMsg(vaultErrorText(e)); } finally { setBusy(null); setCopyAsk(false); }
  };
  const create = async () => {
    setBusy('create'); setBackupMsg('');
    try { await createBackup(); setCodeOpen(true); } catch (e) { setBackupMsg(vaultErrorText(e)); } finally { setBusy(null); }
  };
  const stop = async () => {
    setBusy('stop'); setBackupMsg('');
    try { await stopBackup(); toast(STOPPED); } catch (e) { setBackupMsg(vaultErrorText(e)); } finally { setBusy(null); setStopAsk(false); }
  };
  const fresh = async () => { detachBackup(); await create(); };
  const ask = async () => {
    const granted = await askFromSettings();
    if (granted === true) toast.success(PERSIST_TOAST.granted);
    else if (granted === false) toast(PERSIST_TOAST.refused);
  };
  const save = async () => {
    setStatus('');
    const r = await exportBackup(useApp.getState());
    if (r === 'downloaded') setStatus('קובץ הגיבוי נשמר בהורדות.');
  };
  const undo = async () => {
    const ok = await undoRestore();
    if (ok) toast.success(UNDO_TOAST); else toast(NO_UNDO);
  };
  return (
    <section id="save" className="section set-group save-section" aria-labelledby="save-title">
      <h2 id="save-title" className="set-head" tabIndex={-1}>שמירת ההתקדמות</h2>
      <dl className="save-rows">
        <div className="save-row">
          <dt>במכשיר הזה</dt>
          <dd className={saved ? 'save-ok' : 'save-not'}>
            {saved && <Check size={18} strokeWidth={3} aria-hidden="true" />}
            {healthText(health)}
          </dd>
        </div>
        <div className="save-row">
          <dt>
            שמירה קבועה בדפדפן
            <button type="button" className="icon-btn save-info" onClick={() => setInfo(true)} aria-label="מתי דפדפן מוחק נתונים"><Info size={20} aria-hidden="true" /></button>
          </dt>
          <dd className={persisted === true ? 'save-ok' : 'save-not'} data-persisted={String(persisted)}>
            {persisted === true && <Check size={18} strokeWidth={3} aria-hidden="true" />}
            {persistedText(persisted)}
          </dd>
        </div>
      </dl>
      {canAsk(persisted, persistAsked) && <Button variant="ghost" className="btn-sm save-ask" onClick={ask}>לבקש מהדפדפן לשמור</Button>}
      {guideHere() && (
        <div className="set-rows-wrap"><div className="set-rows">
          <button type="button" className="set-row save-install" onClick={() => setInstall(true)}><span>להוסיף למסך הבית</span><ChevronLeft size={18} aria-hidden="true" /></button>
        </div></div>
      )}
      {server && (
        <div className="save-backup">
          <dl className="save-rows">
            <div className="save-row">
              <dt>גיבוי</dt>
              <dd className={backupOk(backup) ? 'save-ok' : 'save-not'} data-backup={backup?.on ? backup.state || 'idle' : 'off'}>
                {backupOk(backup) && <Check size={18} strokeWidth={3} aria-hidden="true" />}
                {backupText(backup)}
              </dd>
            </div>
          </dl>
          {backup?.on && backup.state === 'other_student' && (
            <div className="save-backup-note">
              <p>{BACKUP_TEXT.otherStudent}</p>
              <Button variant="secondary" className="btn-block" onClick={fresh} disabled={!!busy}>ליצור קוד חדש</Button>
              <Button variant="ghost" className="btn-block" onClick={() => detachBackup()}>להשאיר כך</Button>
            </div>
          )}
          {server && inClass && (
            <label className="check-row save-switch">
              <span>שמירת עותק בשרת הכיתה</span>
              <input type="checkbox" role="switch" checked={classKept} disabled={busy === 'copy'} aria-busy={busy === 'copy'}
                onChange={(e) => (e.target.checked ? classCopy(true) : setCopyAsk(true))} />
            </label>
          )}
          {inClass && classKept && <p className="save-note save-kept">{KEPT_NOTE.class}</p>}
          {!inClass && familyKept && <p className="save-note save-kept">{KEPT_NOTE.family}</p>}
          {((backup?.on && (backup.note === 'recreated' || backup.note === 'moved')) || (!backup?.on && backup?.note === 'deleted')) && (
            <div className="save-backup-note" role="status">
              <p>{BACKUP_TEXT[backup.note]}</p>
              <Button variant="ghost" className="btn-block" onClick={() => clearBackupNote()}>הבנתי</Button>
            </div>
          )}
          {!backup?.on && (
            <>
              <Button variant="secondary" className="btn-block" onClick={create} disabled={!!busy} aria-busy={busy === 'create'}>
                {busy === 'create' ? 'יוצרים קוד…' : 'ליצור קוד גיבוי'}
              </Button>
              <p className="save-note">{BACKUP_NOTE}</p>
            </>
          )}
          {backup?.on && backup.state !== 'other_student' && (
            <Button variant="secondary" className="btn-block" onClick={() => setCodeOpen(true)}>להציג את קוד הגיבוי</Button>
          )}
          <Button variant="secondary" className="btn-block save-restore" onClick={() => navigate('/restore')}>לשחזר מקוד או מקובץ</Button>
          {backup?.on && backup.state !== 'other_student' && (
            <Button variant="ghost" className="btn-block save-stop" onClick={() => setStopAsk(true)}>להפסיק את הגיבוי</Button>
          )}
          <p className="save-status" role="status">{backupMsg}</p>
        </div>
      )}
      <div className="save-file">
        <Button variant="secondary" className="btn-block" onClick={save}>לשמור קובץ גיבוי</Button>
        <FileRestore onLoaded={setFound} />
        <p className="save-note">{NOTE[role] || NOTE.student}</p>
        <p className="save-status" role="status">{status}</p>
        {canUndo({ backup: { undoUntil } }) && (
          <Button variant="ghost" className="btn-block save-undo" onClick={undo}>לבטל את השחזור האחרון</Button>
        )}
      </div>
      <Sheet open={!!found} onOpenChange={(o) => { if (!o) setFound(null); }} title="מצאנו גיבוי">
        {found && <RestorePreview backup={found} onDone={() => setFound(null)} onCancel={() => setFound(null)} />}
      </Sheet>
      <BackupCodeSheet code={backup?.code} open={codeOpen && !!backup?.code} onOpenChange={setCodeOpen} />
      <ConfirmSheet open={stopAsk} onOpenChange={(o) => { if (!o && busy !== 'stop') setStopAsk(false); }} title="להפסיק את הגיבוי?" keep="להשאיר את הגיבוי"
        confirm={busy === 'stop' ? 'מפסיקים…' : 'כן, להפסיק'} onConfirm={stop}>
        <p>{backup?.escrow ? STOP_TEXT.kept : STOP_TEXT.code}</p>
      </ConfirmSheet>
      <ConfirmSheet open={copyAsk} onOpenChange={(o) => { if (!o && busy !== 'copy') setCopyAsk(false); }} title="להפסיק לשמור עותק בכיתה?" keep="להשאיר"
        confirm={busy === 'copy' ? 'מפסיקים…' : 'להפסיק'} onConfirm={() => classCopy(false)} mood="idle">
        <p>ההתקדמות תישאר במכשיר הזה ובקוד הגיבוי שלכם. בכיתה כבר לא יהיה עותק שאפשר להחזיר עם הקוד האישי.</p>
      </ConfirmSheet>
      <PersistInfoSheet open={info} onOpenChange={setInfo} />
      <InstallSheet open={install} onOpenChange={setInstall} />
    </section>
  );
}
