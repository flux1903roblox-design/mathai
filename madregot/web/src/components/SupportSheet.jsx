// The sheet behind the quiet link "צריכים לדבר עם מישהו?" (trust spec TRUST-3 §3.5): the support card, opened from a
// link, so it does not speak of anything the child wrote. Mounted once in the app; any screen opens it with
// openSupport() (the limit sheet closes first, so two sheets never stack). HelpLine is that link with ער״ן's number
// beside it, in every place where the tutor says "not now" (COUNCIL2-4).
import { create } from 'zustand';
import clsx from 'clsx';
import { Phone } from 'lucide-react';
import { SUPPORT } from '@shared/helpLines.js';
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

/**
 * The link and ער״ן's number as a call button, side by side (COUNCIL2-4): inside every refusal (the limit sheet, the
 * resting chat, a tool this device does not have today, the chat with no server). A tel: link, so it works with no
 * network; free and anonymous, and nothing about a price. `onOpen` runs before the sheet opens (as SupportLink).
 */
export function HelpLine({ className, onOpen }) {
  const { quick } = supportLines(SUPPORT, 'after-message');
  const { eran } = SUPPORT;
  // short enough that the link and the button share one row on a 320 phone; the name says "call" in full
  return (
    <div className={clsx('help-line', className)}>
      <SupportLink className="help-line-open" onOpen={onOpen} />
      <a className="support-link is-phone help-line-call" href={quick.href} aria-label={quick.aria}>
        <Phone size={18} aria-hidden="true" /><span>{eran.name} {eran.phone}</span>
      </a>
    </div>
  );
}
