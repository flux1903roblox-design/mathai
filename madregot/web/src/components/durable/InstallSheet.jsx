// The iPhone Home Screen guide (DURABLE-3). An app added to the Home Screen is not deleted after seven days of Safari
// use, but it keeps its data apart from Safari, so step 1 makes sure the progress can travel:
//   - with a server, the backup code (DURABLE-5): made now if there is none, and copied to the clipboard in the same tap
//     (Safari copies only inside a tap, so the clipboard is promised the code before the server answers); the new Home
//     Screen app takes it with "להדביק קוד גיבוי" on its front page. The code is also shown, in case the copy failed;
//   - without a server, the backup file, which the new app opens with "יש לי קובץ גיבוי".
// The menu labels are iOS 26's, where Share sits in the "⋯" menu; older iOS shows the Share button itself, which step 2
// also names.
//   InstallSheet  the guide; opening it notes the time (durable.installHintAt), so Learn does not offer it for 30 days
//   InstallCard   Learn's quiet card that offers it (lib/durable/install.js says when)
import { useEffect, useState } from 'react';
import { Smartphone, X } from 'lucide-react';
import { useApp } from '@/lib/store.js';
import { hasServer } from '@/lib/api.js';
import { exportBackup } from '@/lib/durable/file.js';
import { formatCode } from '@/lib/durable/code.js';
import { createBackup, vaultErrorText } from '@/lib/durable/vault.js';
import { copyWhenReady } from '@/lib/clipboard.js';
import { Button, Sheet } from '@/components/ui.jsx';

export const INSTALL_TITLE = 'להוסיף את מדרגות למסך הבית';
export const INSTALL_STEPS = [
  'קודם שומרים את ההתקדמות.',
  'לוחצים על שלוש הנקודות (⋯) ליד שורת הכתובת, ואז על "שיתוף". אם רואים כפתור של ריבוע עם חץ למעלה, לוחצים עליו.',
  'בוחרים "הוספה למסך הבית", משאירים דלוקה את האפשרות לפתוח כאפליקציה, ולוחצים "הוספה".',
  'פותחים את מדרגות מהסמל החדש, לוחצים "יש לי קובץ גיבוי" ובוחרים את הקובץ ששמרתם. ההתקדמות עוברת לשם.',
];
/** Step 4 and the note when the app has a server: the backup code carries the progress. */
export const INSTALL_STEP4_CODE = 'פותחים את מדרגות מהסמל החדש ומדביקים את קוד הגיבוי. ההתקדמות עוברת לשם.';
export const INSTALL_NOTE = 'באייפון, אפליקציה במסך הבית שומרת נתונים בנפרד מספארי, ולכן צריך את קובץ הגיבוי פעם אחת.';
export const INSTALL_NOTE_CODE = 'באייפון, אפליקציה במסך הבית שומרת נתונים בנפרד מספארי, ולכן צריך את הקוד פעם אחת.';
export const INSTALL_SAVED = 'שמרנו קובץ גיבוי.';
export const INSTALL_CODED = 'יצרנו קוד גיבוי והעתקנו אותו.';
export const INSTALL_COPIED = 'העתקנו את קוד הגיבוי.';
/** The code is there, but the clipboard said no: it is shown under the line. */
export const INSTALL_NOT_COPIED = 'הנה קוד הגיבוי. כדאי לכתוב אותו או לצלם מסך.';
export const CARD_TEXT = 'באייפון, מדרגות ממסך הבית שומרת את ההתקדמות בצורה בטוחה יותר מאשר בספארי.';

/** Note that the guide was offered now (Learn waits 30 days before offering it again). */
const noteHint = () => useApp.setState((s) => ({ durable: { ...s.durable, installHintAt: new Date().toISOString() } }));

export default function InstallSheet({ open, onOpenChange }) {
  const server = hasServer();
  const code = useApp((s) => (s.backup?.on ? s.backup.code : null));
  const [saved, setSaved] = useState(false);
  const [coded, setCoded] = useState(null); // { line, shown } once the code was made or copied
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => { if (open) noteHint(); else { setSaved(false); setCoded(null); setMsg(''); } }, [open]);
  // straight from the tap: the share sheet needs it
  const save = async () => {
    const r = await exportBackup(useApp.getState());
    if (r === 'shared' || r === 'downloaded') setSaved(true);
  };
  // with a server: the code there is, or a new one, copied in this same tap
  const copyCode = async () => {
    const had = code;
    setBusy(true); setMsg('');
    const making = had ? Promise.resolve(had) : createBackup();
    try {
      const copied = await copyWhenReady(making.then(formatCode));
      const made = await making;
      setCoded({ line: copied ? (had ? INSTALL_COPIED : INSTALL_CODED) : INSTALL_NOT_COPIED, shown: made });
    } catch (e) {
      setMsg(vaultErrorText(e));
    } finally { setBusy(false); }
  };
  const step1 = server ? (
    coded ? (
      <>
        <p className="install-saved" role="status">{coded.line}</p>
        <p className="install-code" dir="ltr">{formatCode(coded.shown)}</p>
      </>
    ) : (
      <>
        <Button variant="secondary" className="btn-block" onClick={copyCode} disabled={busy} aria-busy={busy || undefined}>
          {busy ? 'יוצרים קוד…' : code ? 'להעתיק את קוד הגיבוי' : 'ליצור קוד גיבוי'}
        </Button>
        {msg && <p className="form-error" role="alert">{msg}</p>}
        {/* the server could not make a code: the file still carries the progress */}
        {msg && (saved
          ? <p className="install-saved" role="status">{INSTALL_SAVED}</p>
          : <Button variant="ghost" className="btn-block" onClick={save}>לשמור קובץ גיבוי</Button>)}
      </>
    )
  ) : saved
    ? <p className="install-saved" role="status">{INSTALL_SAVED}</p>
    : <Button variant="secondary" className="btn-block" onClick={save}>לשמור קובץ גיבוי</Button>;
  const steps = server ? [...INSTALL_STEPS.slice(1, 3), INSTALL_STEP4_CODE] : INSTALL_STEPS.slice(1);
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={INSTALL_TITLE}>
      <div className="install-sheet">
        <ol className="install-steps">
          <li>
            <p>{INSTALL_STEPS[0]}</p>
            {step1}
          </li>
          {steps.map((s) => <li key={s}><p>{s}</p></li>)}
        </ol>
        <p className="install-note">{server ? INSTALL_NOTE_CODE : INSTALL_NOTE}</p>
        <div className="install-actions">
          <Button className="btn-block" onClick={() => onOpenChange(false)}>הבנתי</Button>
          <Button variant="ghost" className="btn-block" onClick={() => onOpenChange(false)}>לא עכשיו</Button>
        </div>
      </div>
    </Sheet>
  );
}

/**
 * Learn's card, once (then not for 30 days): what the Home Screen gives, the way to the guide, and "לא עכשיו", which
 * also counts as offered. `onOpen` opens the guide.
 */
export function InstallCard({ onOpen }) {
  return (
    <section className="install-card" aria-labelledby="install-card-title">
      <span className="install-card-icon" aria-hidden="true"><Smartphone size={22} /></span>
      <div className="install-card-text">
        <h2 id="install-card-title" className="install-card-title">{INSTALL_TITLE}</h2>
        <p>{CARD_TEXT}</p>
        <Button variant="secondary" className="btn-sm install-card-go" onClick={onOpen}>איך מוסיפים</Button>
      </div>
      <button type="button" className="icon-btn install-card-close" onClick={noteHint} aria-label="לא עכשיו"><X size={20} aria-hidden="true" /></button>
    </section>
  );
}
