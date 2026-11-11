// "יש לי קוד גיבוי" (DURABLE-5): getting the progress back on a new phone, at #/restore. Routed before the role gate,
// so it works on a device with no profile (from Welcome, or the banner of the Home Screen app) and on one with a
// profile (Settings › "לשחזר מקוד או מקובץ").
//   code    the code is typed or pasted (any case, dashes or none, the Hebrew keyboard, or the whole message sent to a
//           parent). It is checked here first: a typing mistake or a symbol that is not in a code is said at once and
//           never reaches the network. Then: derive, GET /api/vault, open (vault.js findVault).
//   preview what the copy holds and what restoring it here does (RestorePreview, the rule every restore follows).
//   done    the progress is back. After a restore from a code, this device keeps that code and syncs with it from now
//           on (adoptCode).
// "יש לי קובץ גיבוי" switches to the backup file on the same screen. Without a server there is only the file.
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { hasServer, errorText } from '@/lib/api.js';
import { normalise, findCode } from '@/lib/durable/code.js';
import { findVault, adoptCode, vaultErrorText } from '@/lib/durable/vault.js';
import { Button } from '@/components/ui.jsx';
import Mascot from '@/components/Mascot.jsx';
import FileRestore from '@/components/durable/FileRestore.jsx';
import RestorePreview from '@/components/durable/RestorePreview.jsx';
import { NeedOnline } from '@/components/durable/OfflineChip.jsx';
import '@/styles/lazy/durable.css'; // the saving rules, loaded with this screen (FOLLOWUP-23)

export const RESTORE = {
  title: 'יש לי קוד גיבוי',
  label: 'קוד הגיבוי',
  hint: '16 אותיות באנגלית ומספרים. אפשר להדביק את כל הקוד, עם מקפים או בלי. גם במקלדת בעברית זה עובד.',
  look: 'לחפש את הגיבוי',
  file: 'יש לי קובץ גיבוי',
  waiting: 'פותחים את הגיבוי…',
  done: 'ההתקדמות חזרה',
  doneLead: 'ממשיכים מאיפה שעצרתם.',
  doneVault: 'מעכשיו ההתקדמות במכשיר הזה נשמרת באותו קוד גיבוי.',
};

/** What a typed code that cannot be a code gets, before any network call ('typo' or 'chars'). */
const localError = (reason) => errorText(reason === 'chars' ? 'vault_chars' : 'vault_typo');

export default function Restore() {
  const navigate = useNavigate();
  const { state: nav, key } = useLocation();
  const server = hasServer();
  const [mode, setMode] = useState(server && nav?.mode !== 'file' ? 'code' : 'file');
  const [text, setText] = useState(() => (typeof nav?.paste === 'string' ? nav.paste : ''));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState(null); // { state, at, vault? }
  const [done, setDone] = useState(null); // { vault: boolean }
  const input = useRef(null);
  const doneHead = useRef(null);
  useEffect(() => { window.scrollTo(0, 0); }, [mode, found, done]);
  useEffect(() => { if (done) doneHead.current?.focus(); }, [done]);

  const leave = () => (key !== 'default' ? navigate(-1) : navigate('/', { replace: true }));
  const back = () => { if (found && !done) setFound(null); else leave(); };

  const look = async (e) => {
    e.preventDefault();
    if (busy) return;
    const n = normalise(text);
    const code = n.ok ? n.code : findCode(text);
    if (!code) { setError(localError(n.reason)); input.current?.focus(); return; }
    setError(''); setBusy(true);
    try {
      const v = await findVault(code);
      setFound({ state: v.state, at: v.at, vault: v });
    } catch (err) {
      setError(vaultErrorText(err));
      input.current?.focus();
    } finally { setBusy(false); }
  };

  const restored = () => {
    // the restore is in; the code is kept on this device and its vault synced (in the background: nothing to wait for)
    if (found.vault) adoptCode(found.vault).catch(() => {});
    setDone({ vault: !!found.vault });
  };

  const title = done ? null : found ? null : mode === 'code' ? RESTORE.title : RESTORE.file;
  return (
    <div className="ob ob-flow restore-screen">
      <header className="ob-top" data-region="header">
        <button type="button" className="icon-btn" onClick={back} aria-label="חזרה"><ArrowRight size={26} aria-hidden="true" /></button>
        {title ? <h1 className="ob-top-title">{title}</h1> : <span className="ob-top-title">שחזור</span>}
      </header>
      <main className="ob-main" data-region="content">
        {done ? (
          <div className="restore-done">
            <Mascot mood="happy" size={120} />
            <h1 className="restore-title" tabIndex={-1} ref={doneHead}>{RESTORE.done}</h1>
            <p className="restore-done-lead">{RESTORE.doneLead}</p>
            {done.vault && <p className="restore-done-note">{RESTORE.doneVault}</p>}
            <Button className="btn-block btn-lg" onClick={() => navigate('/', { replace: true })}>להמשיך</Button>
          </div>
        ) : found ? (
          <RestorePreview backup={found} source={found.vault ? 'vault' : 'file'} heading="h1" quiet onDone={restored} onCancel={() => setFound(null)} />
        ) : mode === 'code' ? (
          <form className="restore-form" onSubmit={look} noValidate>
            {/* the code is looked up on the server: offline, it says so (the file below works offline) */}
            <NeedOnline />
            <div className="field">
              <label htmlFor="restore-code" className="field-label">{RESTORE.label}</label>
              <input id="restore-code" ref={input} className="input input-lg mono restore-input" dir="ltr" value={text}
                onChange={(e) => { setText(e.target.value); if (error) setError(''); }}
                autoComplete="off" autoCapitalize="characters" autoCorrect="off" spellCheck={false} enterKeyHint="search" maxLength={200}
                aria-invalid={error ? true : undefined} aria-describedby={error ? 'restore-hint restore-error' : 'restore-hint'} />
              <p id="restore-hint" className="field-hint">{RESTORE.hint}</p>
            </div>
            {error && <p id="restore-error" className="form-error" role="alert">{error}</p>}
            <Button type="submit" className="btn-block btn-lg" disabled={!text.trim() || busy} aria-busy={busy || undefined}>{RESTORE.look}</Button>
            <p className="restore-wait" role="status">{busy ? RESTORE.waiting : ''}</p>
            <Button variant="ghost" className="btn-block restore-switch" onClick={() => { setError(''); setMode('file'); }}>{RESTORE.file}</Button>
          </form>
        ) : (
          <div className="restore-form">
            <p className="restore-hint">בחרו את קובץ הגיבוי ששמרתם. שם הקובץ מתחיל ב־<bdi>madregot</bdi>.</p>
            <FileRestore onLoaded={(r) => setFound({ state: r.state, at: r.at })} />
            {server && <Button variant="ghost" className="btn-block restore-switch" onClick={() => setMode('code')}>{RESTORE.title}</Button>}
          </div>
        )}
      </main>
    </div>
  );
}
