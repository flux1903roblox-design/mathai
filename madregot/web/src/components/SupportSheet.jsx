// The sheet behind the quiet link "צריכים לדבר עם מישהו?" (trust spec TRUST-3 §3.5): the support card, opened from a
// link, so it does not speak of anything the child wrote. Mounted once in the app; any screen opens it with
// openSupport() (the limit sheet closes first, so two sheets never stack).
import { create } from 'zustand';
import clsx from 'clsx';
import { SUPPORT } from '@shared/safety.js';
import { supportLines, SUPPORT_LINK } from '@/content/support.js';
import { useApp } from '@/lib/store.js';
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

/**
 * Is the quiet link shown on this device? It is a child's: never on a teacher's own screens (the teacher's assistant,
 * its "not connected" state and the sign-in sheet of the limit sheet), which are an adult's and lead back to the board
 * (FOLLOWUP-1). A message that reads as distress still gets the support card there.
 */
export const supportLinkShown = (state) => state.profile?.role !== 'teacher';

/** The quiet link. `onOpen` runs first (the limit sheet closes itself there). */
export function SupportLink({ className, onOpen }) {
  const shown = useApp(supportLinkShown);
  if (!shown) return null;
  return (
    <button type="button" className={clsx('link-btn support-open', className)} onClick={() => { onOpen?.(); openSupport(); }} aria-haspopup="dialog">
      {SUPPORT_LINK}
    </button>
  );
}
