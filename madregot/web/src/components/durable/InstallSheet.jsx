// The iPhone Home Screen guide (DURABLE-3). An app added to the Home Screen is not deleted after seven days of Safari
// use, but it keeps its data apart from Safari, so step 1 makes sure the progress can travel: it saves the backup file,
// which the new Home Screen app opens with "יש לי קובץ גיבוי". (Builds with a server switch step 1 to the backup code
// when it exists, DURABLE-5.) The menu labels are iOS 26's, where Share sits in the "⋯" menu; older iOS shows the Share
// button itself, which step 2 also names.
//   InstallSheet  the guide; opening it notes the time (durable.installHintAt), so Learn does not offer it for 30 days
//   InstallCard   Learn's quiet card that offers it (lib/durable/install.js says when)
import { useEffect, useState } from 'react';
import { Smartphone, X } from 'lucide-react';
import { useApp } from '@/lib/store.js';
import { exportBackup } from '@/lib/durable/file.js';
import { Button, Sheet } from '@/components/ui.jsx';

export const INSTALL_TITLE = 'להוסיף את מדרגות למסך הבית';
export const INSTALL_STEPS = [
  'קודם שומרים את ההתקדמות.',
  'לוחצים על שלוש הנקודות (⋯) ליד שורת הכתובת, ואז על "שיתוף". אם רואים כפתור של ריבוע עם חץ למעלה, לוחצים עליו.',
  'בוחרים "הוספה למסך הבית", משאירים דלוקה את האפשרות לפתוח כאפליקציה, ולוחצים "הוספה".',
  'פותחים את מדרגות מהסמל החדש, לוחצים "יש לי קובץ גיבוי" ובוחרים את הקובץ ששמרתם. ההתקדמות עוברת לשם.',
];
export const INSTALL_NOTE = 'באייפון, אפליקציה במסך הבית שומרת נתונים בנפרד מספארי, ולכן צריך את קובץ הגיבוי פעם אחת.';
export const INSTALL_SAVED = 'שמרנו קובץ גיבוי.';
export const CARD_TEXT = 'באייפון, מדרגות ממסך הבית שומרת את ההתקדמות בצורה בטוחה יותר מאשר בספארי.';

/** Note that the guide was offered now (Learn waits 30 days before offering it again). */
const noteHint = () => useApp.setState((s) => ({ durable: { ...s.durable, installHintAt: new Date().toISOString() } }));

export default function InstallSheet({ open, onOpenChange }) {
  const [saved, setSaved] = useState(false);
  useEffect(() => { if (open) noteHint(); else setSaved(false); }, [open]);
  // straight from the tap: the share sheet needs it
  const save = async () => {
    const r = await exportBackup(useApp.getState());
    if (r === 'shared' || r === 'downloaded') setSaved(true);
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={INSTALL_TITLE}>
      <div className="install-sheet">
        <ol className="install-steps">
          <li>
            <p>{INSTALL_STEPS[0]}</p>
            {saved
              ? <p className="install-saved" role="status">{INSTALL_SAVED}</p>
              : <Button variant="secondary" className="btn-block" onClick={save}>לשמור קובץ גיבוי</Button>}
          </li>
          {INSTALL_STEPS.slice(1).map((s) => <li key={s}><p>{s}</p></li>)}
        </ol>
        <p className="install-note">{INSTALL_NOTE}</p>
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
