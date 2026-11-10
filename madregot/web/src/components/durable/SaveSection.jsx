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
//   - for 30 days after a restore replaced another student's progress, "לבטל את השחזור האחרון" brings it back.
import { useState } from 'react';
import { Check, Info, ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from '@/lib/store.js';
import { useDurable, savedHealth } from '@/lib/durable/useDurable.js';
import { exportBackup } from '@/lib/durable/file.js';
import { canUndo, undoRestore, UNDO_TOAST, NO_UNDO } from '@/lib/durable/apply.js';
import { persistedText, canAsk, askFromSettings, PERSIST_TOAST } from '@/lib/durable/persist.js';
import { guideHere } from '@/lib/durable/install.js';
import { Button, Sheet } from '@/components/ui.jsx';
import FileRestore from './FileRestore.jsx';
import RestorePreview from './RestorePreview.jsx';
import PersistInfoSheet from './PersistInfoSheet.jsx';
import InstallSheet from './InstallSheet.jsx';

const NOT_SAVED = { full: 'לא נשמר: הדפדפן מלא', memory: 'לא נשמר: הדפדפן חוסם שמירה' };
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
            {saved ? 'נשמר' : NOT_SAVED[health]}
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
      <PersistInfoSheet open={info} onOpenChange={setInfo} />
      <InstallSheet open={install} onOpenChange={setInstall} />
    </section>
  );
}
