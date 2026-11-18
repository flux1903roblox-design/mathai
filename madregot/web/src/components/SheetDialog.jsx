// The bottom sheet's dialog (Base UI: focus trap, escape, scroll lock), loaded the first time a sheet opens
// (components/ui.jsx Sheet, COUNCIL2-14). Every screen uses Sheet from ui.jsx, never this file.
import { useRef } from 'react';
import clsx from 'clsx';
import { Dialog } from '@base-ui/react/dialog';
import { X } from 'lucide-react';
import { t, dirOf } from '@/lib/i18n.js';
import '@/styles/lazy/shared.css'; // the rules this screen shares with other screens loaded on demand, out of the first load (COUNCIL2-20)
import '@/styles/lazy/sheetDialog.css'; // this screen's own rules, out of the first load (COUNCIL2-20)

/**
 * Where the focus goes when a sheet closes (Base UI's finalFocus): back to `opener`, the element that had the focus
 * when the sheet last opened. Base UI on its own returns it to the element focused when the popup was first put on
 * the page. One sheet often serves several buttons (the wardrobe's coming pieces), and a sheet opened again for
 * another button while it is still closing keeps its popup on the page, so Base UI gave the focus to the first
 * button, not to the one just used. When the focus has left the sheet for somewhere else (`active` outside `popup`:
 * a link the sheet followed, another sheet it opened), it stays there, as Base UI's own rule does; with no opener to
 * go back to (the page's body, or a button no longer on the page), Base UI decides.
 * @param {Element | null} opener
 * @param {Element | null} active the element that has the focus as the sheet closes
 * @param {Element | null} popup the sheet itself
 * @param {Document} doc
 * @returns {Element | boolean} the element to focus, true for Base UI's own choice, false to leave the focus alone
 */
export function finalFocusFor(opener, active, popup, doc = document) {
  if (active && active !== doc.body && !popup?.contains(active)) return false;
  return opener && opener !== doc.body && opener.isConnected ? opener : true;
}

/** The sheet as ui.jsx's Sheet draws it once it has opened. */
export default function SheetDialog({ open, onOpenChange, title, children, footer, wide, className, dismissible = true }) {
  // the element that had the focus when the sheet last opened, read as it opens (before the focus moves into it)
  const opener = useRef(null);
  const wasOpen = useRef(false);
  const popup = useRef(null);
  if (open && !wasOpen.current && typeof document !== 'undefined') opener.current = document.activeElement;
  wasOpen.current = open;
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange} disablePointerDismissal={!dismissible}>
      <Dialog.Portal>
        <Dialog.Backdrop className="sheet-backdrop" />
        <Dialog.Popup ref={popup} className={clsx('sheet', wide && 'wide', className)} dir={dirOf()} data-region="feedback"
          finalFocus={() => finalFocusFor(opener.current, document.activeElement, popup.current)}>
          <header className="sheet-head">
            <Dialog.Title className="sheet-title">{title}</Dialog.Title>
            <Dialog.Close className="icon-btn" aria-label={t('shell.sheetdialog.1')}><X size={22} aria-hidden="true" /></Dialog.Close>
          </header>
          {/* a region the keyboard can reach and scroll, even when it holds only text (axe: scrollable-region-focusable) */}
          <div className="sheet-body" tabIndex={0} role="region" aria-label={typeof title === 'string' ? title : undefined}>{children}</div>
          {footer && <div className="sheet-foot">{footer}</div>}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
