// "קוד הגיבוי שלכם" (DURABLE-5): the backup code, large and left to right, a QR code of the bare code, and the ways to
// keep it outside this device: send it to a parent (the share sheet with the text, or a copy where there is none), copy
// it, or close with "שמרתי". Opened right after the code is made, and from Settings › "להציג את קוד הגיבוי".
import { toast } from 'sonner';
import { formatCode } from '@/lib/durable/code.js';
import { copyText } from '@/lib/clipboard.js';
import { Button, Sheet } from '@/components/ui.jsx';
import QrCode from '@/components/QrCode.jsx';

export const CODE_SHEET = {
  title: 'קוד הגיבוי שלכם',
  where: 'עם הקוד הזה אפשר להחזיר את ההתקדמות בכל מכשיר: פותחים את מדרגות ובוחרים "יש לי קוד גיבוי".',
  keep: 'שמרו אותו מחוץ למכשיר הזה: שלחו להורים, צלמו מסך או כתבו במחברת.',
  who: 'מי שיש לו את הקוד יכול לראות את ההתקדמות שלכם, אז תנו אותו רק למי שאתם סומכים עליו.',
  copied: 'הקוד הועתק.',
  notCopied: 'לא הצלחנו להעתיק. אפשר לסמן את הקוד ולהעתיק אותו.',
};

/** The message a parent gets. */
export const shareText = (code) => `קוד הגיבוי שלי במדרגות: ${formatCode(code)}\nאם הטלפון יתחלף: פותחים את מדרגות, בוחרים "יש לי קוד גיבוי" ומקלידים את הקוד.`;

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
          <div className="backup-qr"><QrCode text={code} size={168} label="קוד QR של קוד הגיבוי" /></div>
          <p>{CODE_SHEET.where}</p>
          <p>{CODE_SHEET.keep}</p>
          <p className="backup-who">{CODE_SHEET.who}</p>
          <div className="backup-actions">
            <Button className="btn-block" onClick={send}>לשלוח להורים</Button>
            <Button variant="secondary" className="btn-block" onClick={copy}>להעתיק</Button>
            <Button variant="ghost" className="btn-block" onClick={() => onOpenChange(false)}>שמרתי</Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
