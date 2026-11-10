// The sheet behind the quiet link "צריכים לדבר עם מישהו?" (trust spec TRUST-3 §3.5): the support card, opened from a
// link, so it does not speak of anything the child wrote. Mounted once in the app; any screen opens it with
// openSupport() (the limit sheet closes first, so two sheets never stack).
import { create } from 'zustand';
import clsx from 'clsx';
import { SUPPORT } from '@shared/safety.js';
import { supportLines, SUPPORT_LINK } from '@/content/support.js';
import { Button, Sheet } from './ui.jsx';
import SupportCard from './SupportCard.jsx';

export const useSupportSheet = create(() => ({ open: false }));
export const openSupport = () => useSupportSheet.setState({ open: true });
export const closeSupport = () => useSupportSheet.setState({ open: false });

export default function SupportSheet() {
  const open = useSupportSheet((s) => s.open);
  const lines = supportLines(SUPPORT, 'opened');
  return (
    <Sheet open={open} onOpenChange={(o) => !o && closeSupport()} title={lines.title} className="support-sheet"
      footer={<Button variant="secondary" className="btn-block" onClick={closeSupport}>{lines.close}</Button>}>
      <SupportCard variant="opened" bare />
    </Sheet>
  );
}

/** The quiet link. `onOpen` runs first (the limit sheet closes itself there). */
export function SupportLink({ className, onOpen }) {
  return (
    <button type="button" className={clsx('link-btn support-open', className)} onClick={() => { onOpen?.(); openSupport(); }} aria-haspopup="dialog">
      {SUPPORT_LINK}
    </button>
  );
}
