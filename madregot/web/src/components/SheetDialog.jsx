// The bottom sheet's dialog (Base UI: focus trap, escape, scroll lock), loaded the first time a sheet opens
// (components/ui.jsx Sheet, COUNCIL2-14). Every screen uses Sheet from ui.jsx, never this file.
import clsx from 'clsx';
import { Dialog } from '@base-ui/react/dialog';
import { X } from 'lucide-react';
import '@/styles/lazy/shared.css'; // the rules this screen shares with other screens loaded on demand, out of the first load (COUNCIL2-20)
import '@/styles/lazy/sheetDialog.css'; // this screen's own rules, out of the first load (COUNCIL2-20)

/** The sheet as ui.jsx's Sheet draws it once it has opened. */
export default function SheetDialog({ open, onOpenChange, title, children, footer, wide, className, dismissible = true }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange} disablePointerDismissal={!dismissible}>
      <Dialog.Portal>
        <Dialog.Backdrop className="sheet-backdrop" />
        <Dialog.Popup className={clsx('sheet', wide && 'wide', className)} dir="rtl" data-region="feedback">
          <header className="sheet-head">
            <Dialog.Title className="sheet-title">{title}</Dialog.Title>
            <Dialog.Close className="icon-btn" aria-label="סגירה"><X size={22} aria-hidden="true" /></Dialog.Close>
          </header>
          {/* a region the keyboard can reach and scroll, even when it holds only text (axe: scrollable-region-focusable) */}
          <div className="sheet-body" tabIndex={0} role="region" aria-label={typeof title === 'string' ? title : undefined}>{children}</div>
          {footer && <div className="sheet-foot">{footer}</div>}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
