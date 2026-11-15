// "מתי דפדפן מוחק נתונים" (DURABLE-3): the info button beside "שמירה קבועה בדפדפן" opens it. What a browser may delete,
// when, and the safe way. The backup code joins the last line when it exists (DURABLE-5); today the file is the backup.
import { Button, Sheet } from '@/components/ui.jsx';

import { localized, t } from '@/lib/i18n.js';
export let PERSIST_INFO = localized(() => ([
  t('shell.persistinfosheet.1'),
  t('shell.persistinfosheet.2'),
  t('shell.persistinfosheet.3'),
]), (v) => { PERSIST_INFO = v; });

export default function PersistInfoSheet({ open, onOpenChange }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={t('shell.persistinfosheet.4')}>
      <div className="persist-info">
        {PERSIST_INFO.map((line) => <p key={line}>{line}</p>)}
        <Button className="btn-block" onClick={() => onOpenChange(false)}>{t('shell.persistinfosheet.5')}</Button>
      </div>
    </Sheet>
  );
}
