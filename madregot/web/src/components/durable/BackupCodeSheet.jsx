// "קוד הגיבוי שלכם" (DURABLE-5): the backup code, large and left to right, a QR code of the bare code, and the ways to
// keep it outside this device: send it to a parent (the share sheet with the text, or a copy where there is none), copy
// it, or close with "שמרתי". Opened right after the code is made, and from Settings › "להציג את קוד הגיבוי".
import { toast } from 'sonner';
import { formatCode } from '@/lib/durable/code.js';
import { copyText } from '@/lib/clipboard.js';
import { Button, Sheet } from '@/components/ui.jsx';
import QrCode from '@/components/QrCode.jsx';
import { localized, t } from '@/lib/i18n.js';
import '@/styles/lazy/shared.css'; // the rules this screen shares with other screens loaded on demand, out of the first load (COUNCIL2-20)
import '@/styles/lazy/durable.css'; // the saving rules, loaded with this screen (FOLLOWUP-23)

export let CODE_SHEET = localized(() => ({
  title: t('shell.backupcodesheet.1'),
  where: t('shell.backupcodesheet.2'),
  keep: t('shell.backupcodesheet.3'),
  who: t('shell.backupcodesheet.4'),
  copied: t('shell.backupcodesheet.5'),
  notCopied: t('shell.backupcodesheet.6'),
}), (v) => { CODE_SHEET = v; });

/** The message a parent gets. */
export const shareText = (code) => t('shell.backupcodesheet.7', { p0: formatCode(code) });

/** The code letter by letter, so a screen reader spells it instead of reading it as a word. */
const spelled = (code) => formatCode(code).split('-').map((g) => [...g].join(' ')).join(', ');

export default function BackupCodeSheet({ code, open, onOpenChange }) {
  const copy = async () => {
    if (await copyText(formatCode(code))) toast.success(CODE_SHEET.copied);
    else toast(CODE_SHEET.notCopied);
  };
  // "לשלוח להורים": the share sheet with the text where the browser has one (call it straight from the tap), else a copy
  const send = async () => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try { await navigator.share({ text: shareText(code) }); return; } catch (e) { if (e?.name === 'AbortError') return; }
    }
    if (await copyText(shareText(code))) toast.success(CODE_SHEET.copied);
    else toast(CODE_SHEET.notCopied);
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={CODE_SHEET.title} className="backup-code-sheet">
      {code && (
        <div className="backup-code-body">
          <p className="backup-code" dir="ltr" aria-label={spelled(code)}>{formatCode(code)}</p>
          <div className="backup-qr"><QrCode text={code} size={168} label={t('shell.backupcodesheet.8')} /></div>
          <p>{CODE_SHEET.where}</p>
          <p>{CODE_SHEET.keep}</p>
          <p className="backup-who">{CODE_SHEET.who}</p>
          <div className="backup-actions">
            <Button className="btn-block" onClick={send}>{t('shell.backupcodesheet.9')}</Button>
            <Button variant="secondary" className="btn-block" onClick={copy}>{t('shell.backupcodesheet.10')}</Button>
            <Button variant="ghost" className="btn-block" onClick={() => onOpenChange(false)}>{t('shell.backupcodesheet.11')}</Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
