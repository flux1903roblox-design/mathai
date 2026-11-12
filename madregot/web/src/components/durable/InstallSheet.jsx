// The iPhone Home Screen guide (DURABLE-3). An app added to the Home Screen is not deleted after seven days of Safari
// use, but it keeps its data apart from Safari, so step 1 makes sure the progress can travel:
//   - with a server, the backup code (DURABLE-5): made now if there is none, and copied to the clipboard in the same tap
//     (Safari copies only inside a tap, so the clipboard is promised the code before the server answers); the new Home
//     Screen app takes it with "להדביק קוד גיבוי" on its front page. The code is also shown, in case the copy failed;
//   - without a server, the backup file, which the new app opens with "יש לי קובץ גיבוי".
// The menu labels are iOS 26's, where Share sits in the "⋯" menu; older iOS shows the Share button itself, which step 2
// also names.
//   InstallSheet  the guide; opening it notes the time (durable.installHintAt), so Learn does not offer it for 30 days
//   InstallCard   Learn's quiet card that offers it (lib/durable/install.js says when)
import { useEffect, useState } from 'react';
import { Smartphone, X } from 'lucide-react';
import { useApp } from '@/lib/store.js';
import { hasServer } from '@/lib/api.js';
import { exportBackup } from '@/lib/durable/file.js';
import { formatCode } from '@/lib/durable/code.js';
import { createBackup, vaultErrorText } from '@/lib/durable/vault.js';
import { copyWhenReady } from '@/lib/clipboard.js';
import { Button, Sheet } from '@/components/ui.jsx';

import { localized, t } from '@/lib/i18n.js';
export let INSTALL_TITLE = localized(() => t('shell.installsheet.1'), (v) => { INSTALL_TITLE = v; });
export let INSTALL_STEPS = localized(() => ([
  t('shell.installsheet.2'),
  t('shell.installsheet.3'),
  t('shell.installsheet.4'),
  t('shell.installsheet.5'),
]), (v) => { INSTALL_STEPS = v; });
/** Step 4 and the note when the app has a server: the backup code carries the progress. */
export let INSTALL_STEP4_CODE = localized(() => t('shell.installsheet.6'), (v) => { INSTALL_STEP4_CODE = v; });
export let INSTALL_NOTE = localized(() => t('shell.installsheet.7'), (v) => { INSTALL_NOTE = v; });
export let INSTALL_NOTE_CODE = localized(() => t('shell.installsheet.8'), (v) => { INSTALL_NOTE_CODE = v; });
export let INSTALL_SAVED = localized(() => t('shell.installsheet.9'), (v) => { INSTALL_SAVED = v; });
export let INSTALL_CODED = localized(() => t('shell.installsheet.10'), (v) => { INSTALL_CODED = v; });
export let INSTALL_COPIED = localized(() => t('shell.installsheet.11'), (v) => { INSTALL_COPIED = v; });
/** The code is there, but the clipboard said no: it is shown under the line. */
export let INSTALL_NOT_COPIED = localized(() => t('shell.installsheet.12'), (v) => { INSTALL_NOT_COPIED = v; });
export let CARD_TEXT = localized(() => t('shell.installsheet.13'), (v) => { CARD_TEXT = v; });

/** Note that the guide was offered now (Learn waits 30 days before offering it again). */
const noteHint = () => useApp.setState((s) => ({ durable: { ...s.durable, installHintAt: new Date().toISOString() } }));

export default function InstallSheet({ open, onOpenChange }) {
  const server = hasServer();
  const code = useApp((s) => (s.backup?.on ? s.backup.code : null));
  const [saved, setSaved] = useState(false);
  const [coded, setCoded] = useState(null); // { line, shown } once the code was made or copied
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => { if (open) noteHint(); else { setSaved(false); setCoded(null); setMsg(''); } }, [open]);
  // straight from the tap: the share sheet needs it
  const save = async () => {
    const r = await exportBackup(useApp.getState());
    if (r === 'shared' || r === 'downloaded') setSaved(true);
  };
  // with a server: the code there is, or a new one, copied in this same tap
  const copyCode = async () => {
    const had = code;
    setBusy(true); setMsg('');
    const making = had ? Promise.resolve(had) : createBackup();
    try {
      const copied = await copyWhenReady(making.then(formatCode));
      const made = await making;
      setCoded({ line: copied ? (had ? INSTALL_COPIED : INSTALL_CODED) : INSTALL_NOT_COPIED, shown: made });
    } catch (e) {
      setMsg(vaultErrorText(e));
    } finally { setBusy(false); }
  };
  const step1 = server ? (
    coded ? (
      <>
        <p className="install-saved" role="status">{coded.line}</p>
        <p className="install-code" dir="ltr">{formatCode(coded.shown)}</p>
      </>
    ) : (
      <>
        <Button variant="secondary" className="btn-block" onClick={copyCode} disabled={busy} aria-busy={busy || undefined}>
          {busy ? t('shell.installsheet.14') : code ? t('shell.installsheet.15') : t('shell.installsheet.16')}
        </Button>
        {msg && <p className="form-error" role="alert">{msg}</p>}
        {/* the server could not make a code: the file still carries the progress */}
        {msg && (saved
          ? <p className="install-saved" role="status">{INSTALL_SAVED}</p>
          : <Button variant="ghost" className="btn-block" onClick={save}>{t('shell.installsheet.17')}</Button>)}
      </>
    )
  ) : saved
    ? <p className="install-saved" role="status">{INSTALL_SAVED}</p>
    : <Button variant="secondary" className="btn-block" onClick={save}>{t('shell.installsheet.17')}</Button>;
  const steps = server ? [...INSTALL_STEPS.slice(1, 3), INSTALL_STEP4_CODE] : INSTALL_STEPS.slice(1);
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={INSTALL_TITLE}>
      <div className="install-sheet">
        <ol className="install-steps">
          <li>
            <p>{INSTALL_STEPS[0]}</p>
            {step1}
          </li>
          {steps.map((s) => <li key={s}><p>{s}</p></li>)}
        </ol>
        <p className="install-note">{server ? INSTALL_NOTE_CODE : INSTALL_NOTE}</p>
        <div className="install-actions">
          <Button className="btn-block" onClick={() => onOpenChange(false)}>{t('shell.installsheet.18')}</Button>
          <Button variant="ghost" className="btn-block" onClick={() => onOpenChange(false)}>{t('shell.installsheet.19')}</Button>
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
        <Button variant="secondary" className="btn-sm install-card-go" onClick={onOpen}>{t('shell.installsheet.20')}</Button>
      </div>
      <button type="button" className="icon-btn install-card-close" onClick={noteHint} aria-label={t('shell.installsheet.19')}><X size={20} aria-hidden="true" /></button>
    </section>
  );
}
