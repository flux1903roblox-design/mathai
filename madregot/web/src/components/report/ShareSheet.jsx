// "לשלוח להורים" (PARENTS-2): the child sees the exact message first, chooses whether the repairs go with it, and sends
// it from their own phone: WhatsApp, the phone's share sheet, or a copied link. Nothing is sent to us: the week rides in
// the link's # fragment (lib/share.js). The child's name may be in the message's first line, never in the link.
// Exported for the student lane's Sunday card (STUDENT-6 RecapSheet), which passes only the week's Sunday: the sheet
// computes the week itself.
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { MessageCircle, Share2, Link2 } from 'lucide-react';
import { Sheet } from '@/components/ui.jsx';
import { useApp } from '@/lib/store.js';
import { copyText } from '@/lib/clipboard.js';
import { encodeShare, shareLink, shareText, appBase, waHref } from '@/lib/share.js';
import { useReportWeek } from './useReportWeek.js';
import '@/styles/report.css';

export const EMPTY_HINT = 'אחרי השיעור הבא יהיה כאן מה לשלוח.';

/** The message as the sheet shows it: its lines, the link last, on one line that the eye can skip. */
function Quote({ text, link }) {
  const lines = text.split('\n');
  const last = lines.pop();
  const lead = last.endsWith(link) ? last.slice(0, last.length - link.length) : last;
  return (
    <blockquote className="share-quote" data-testid="share-text">
      {lines.map((l, i) => <p key={i}>{l}</p>)}
      <p className="share-quote-link"><span>{lead}</span><bdi dir="ltr" className="share-link">{link}</bdi></p>
    </blockquote>
  );
}

export function ShareSheet({ open, onOpenChange, start }) {
  const { week } = useReportWeek(start);
  const name = useApp((s) => s.profile?.name);
  const [withFixes, setWithFixes] = useState(true);
  const hasFixes = week.open.length + week.fixed.length > 0;
  const includeFixes = withFixes || !hasFixes;
  const { link, text } = useMemo(() => {
    if (week.empty) return { link: '', text: '' };
    const l = shareLink(encodeShare(week, { includeFixes }), appBase());
    return { link: l, text: shareText(week, { name, link: l, includeFixes }) };
  }, [week, name, includeFixes]);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const shareOther = async () => {
    try { await navigator.share({ text }); } catch (e) { if (e?.name !== 'AbortError') toast('השיתוף לא נפתח. אפשר לשלוח בוואטסאפ או להעתיק את הקישור.'); }
  };
  const copy = async () => {
    toast(await copyText(link) ? 'הקישור הועתק' : 'ההעתקה לא הצליחה. אפשר לנסות שוב.');
  };

  const actions = week.empty ? (
    <div className="share-actions">
      <button type="button" className="btn btn-primary" disabled aria-describedby="share-empty"><MessageCircle size={20} aria-hidden="true" />וואטסאפ</button>
      <button type="button" className="btn btn-secondary" disabled aria-describedby="share-empty"><Link2 size={20} aria-hidden="true" />העתקת הקישור</button>
    </div>
  ) : (
    <div className="share-actions">
      <a className="btn btn-primary share-wa" href={waHref(text)} target="_blank" rel="noopener noreferrer"><MessageCircle size={20} aria-hidden="true" />וואטסאפ</a>
      {canShare && <button type="button" className="btn btn-secondary" onClick={shareOther}><Share2 size={20} aria-hidden="true" />שיתוף בדרך אחרת</button>}
      <button type="button" className="btn btn-secondary" onClick={copy}><Link2 size={20} aria-hidden="true" />העתקת הקישור</button>
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="לשלוח להורים" className="share-sheet" footer={actions}>
      {week.empty ? <p id="share-empty" className="share-empty">{EMPTY_HINT}</p> : (
        <div className="share-body">
          {/* the one choice comes first, so it is in view on the smallest phone; the message below follows it */}
          {hasFixes && (
            <label className="share-check">
              <input type="checkbox" checked={withFixes} onChange={(e) => setWithFixes(e.target.checked)} />
              <span>לכלול את מה שמתקנים עכשיו</span>
            </label>
          )}
          <p className="share-lead">זה מה שיישלח:</p>
          <Quote text={text} link={link} />
        </div>
      )}
    </Sheet>
  );
}

export default ShareSheet;
