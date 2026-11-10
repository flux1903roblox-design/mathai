// Settings › שמירת ההתקדמות (DURABLE-1, DURABLE-4): where the progress is kept, said plainly, and the backup file.
//   - the first row is this device: saved (in the browser's storage, or in the copy on the device when the storage is
//     full), or not, and why;
//   - "לשמור קובץ גיבוי" shares or downloads the backup file, "לשחזר מקובץ" reads one back (RestorePreview says what
//     it holds and what restoring it does), and a note says who can read the file. A teacher's file also holds the
//     class keys, so the teacher's note says so (role="teacher": the teacher's class settings place this section);
//   - for 30 days after a restore replaced another student's progress, "לבטל את השחזור האחרון" brings it back.
import { useState } from 'react';
import { Check } from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from '@/lib/store.js';
import { useDurable, savedHealth } from '@/lib/durable/useDurable.js';
import { exportBackup } from '@/lib/durable/file.js';
import { canUndo, undoRestore, UNDO_TOAST, NO_UNDO } from '@/lib/durable/apply.js';
import { Button, Sheet } from '@/components/ui.jsx';
import FileRestore from './FileRestore.jsx';
import RestorePreview from './RestorePreview.jsx';

const NOT_SAVED = { full: 'לא נשמר: הדפדפן מלא', memory: 'לא נשמר: הדפדפן חוסם שמירה' };
const NOTE = {
  student: 'בקובץ יש את כל ההתקדמות, כולל השם. מי שמקבל אותו יכול לקרוא אותו.',
  teacher: 'בקובץ יש גם את מפתח המורה של הכיתות. מי שמקבל אותו יכול להיכנס ללוח הכיתה, אז שמרו אותו רק אצלכם.',
};

export default function SaveSection({ role = 'student' }) {
  const health = useDurable((s) => s.health);
  const undoUntil = useApp((s) => s.backup?.undoUntil);
  const saved = savedHealth(health);
  const [found, setFound] = useState(null);
  const [status, setStatus] = useState('');
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
      </dl>
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
    </section>
  );
}
