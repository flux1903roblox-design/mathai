// Settings, laid out like Duolingo's settings screen: a bar with the way back and the title, then grouped sections,
// each a bordered group with a small heading (my details, class, the assistant, the look, sound, vibration, the daily
// reminder, the app, deleting data).
// A student sees nothing about servers or keys: those are for the adult who sets the app up, behind "מתקדם".
import '@/locales/settings.js'; // this screen's words, before anything here uses them (COUNCIL2-34)
import { useState, useEffect } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { toast } from 'sonner';
import { ArrowRight, ChevronLeft, Download } from 'lucide-react';
import { useReducedMotion } from 'motion/react';
import { api, hasServer } from '@/lib/api.js';
import { Button, Field, Sheet } from '@/components/ui.jsx';
import { Segmented } from '@/components/choices.jsx';
import { GradeSwitch, joinClass, joinedProfile, ClaimField, CLAIM_COPY } from './Welcome.jsx';
import { ConfirmSheet } from '@/components/Screen.jsx';
import Mascot from '@/components/Mascot.jsx';
import { openSupport } from '@/components/SupportSheet.jsx';
import { SUPPORT_LINK } from '@/content/support.js';
import { useAIStatus, leaveFamily, familyInApp } from '@/lib/account.js';
import { canSell } from '@/lib/price.js';
import { PARENT_OK_LINE } from '@/components/limitCopy.js';
import { useApp, PERSONAL_KEY } from '@/lib/store.js';
import SaveSection from '@/components/durable/SaveSection.jsx';
import SupportInfo from '@/components/durable/SupportInfo.jsx';
import { whereSavedText, WHERE_SAVED } from '@/lib/durable/copy.js';
import { syncVault } from '@/lib/durable/vault.js';
import { afterClassJoin } from '@/lib/durable/escrow.js';
import { wipeEverything, wipeDeviceOnly, wipeText, deviceOnlyText, WIPE_FAILED } from '@/lib/wipe.js';
// the durable lane's parts of "delete all" (the backup on the server, the copy in the browser's database)
import { WIPE_VAULT, WIPE_KEPT } from '@/lib/durable/wipeSteps.js';
import { useInstall, isStoreApp, isStandalone } from '@/lib/install.js';
import { count } from '@/lib/metrics.js';
import SharingSheet, { stateWord } from '@/components/SharingSheet.jsx';
import { disable as disableReminder } from '@/lib/push.js';
import ReminderSettings from '@/components/learn/ReminderSettings.jsx';
import LangPick from '@/components/LangPick.jsx';
import { localized, t, useLocale } from '@/lib/i18n.js';
import '@/styles/lazy/shared.css'; // the rules this screen shares with other screens loaded on demand, out of the first load (COUNCIL2-20)
import '@/styles/lazy/settings.css'; // this screen's own rules, out of the first load (COUNCIL2-20)

export let SIGNOUT_VAULT = localized(() => t('settings.settings.1'), (v) => { SIGNOUT_VAULT = v; });
/**
 * The device-unlink sheet and the wipe sheet on a linked device: the parents' summaries go with it (PARENTS-4). "Delete all"
 * deletes them in the server's one delete (POST /api/me/forget, worker forget.js familyDeviceDeleteStmts).
 */
export let UNLINK_SUMMARIES = localized(() => t('settings.settings.2'), (v) => { UNLINK_SUMMARIES = v; });
export let WIPE_SUMMARIES = localized(() => t('settings.settings.3'), (v) => { WIPE_SUMMARIES = v; });
/** The unlink could not reach the server: the link stays and the summaries are not deleted. */
export let UNLINK_FAILED = localized(() => t('settings.settings.4'), (v) => { UNLINK_FAILED = v; });
/**
 * Under the join form of Settings: the class keeps a copy (Welcome's CLASS_COPY_NOTE), and when this device already has a
 * backup code that nobody keeps, joining gives that code to the class's server too: said before the join, with the way out.
 */
export const JOIN_COPY_NOTE = WHERE_SAVED.classCopyClause;
export let JOIN_CODE_NOTE = localized(() => t('settings.settings.5'), (v) => { JOIN_CODE_NOTE = v; });
/** How long a sign-out waits for the last push of the backup before it goes on anyway. */
const LAST_PUSH_MS = 4000;

function ClassSection() {
  const { profile, setProfile, leaveClass } = useApp();
  const backup = useApp((s) => s.backup);
  const escrowClass = useApp((s) => s.durable?.escrowClass !== false);
  const [code, setCode] = useState(''); const [pin, setPin] = useState('');
  // the teacher's one-time code, asked for once the server says this name's PIN was reset (COUNCIL2-25)
  const [claim, setClaim] = useState(''); const [needClaim, setNeedClaim] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [confirmLeave, setConfirmLeave] = useState(false);

  if (profile.classCode && profile.token) {
    return (
      <section className="section set-group" aria-labelledby="cls-title">
        <h2 id="cls-title" className="set-head">{t('settings.settings.6')}</h2>
        <p>{t('settings.settings.7')}<b>{profile.className}</b> <span className="muted mono" dir="ltr">({profile.classCode})</span></p>
        <p className="muted">{t('settings.settings.8')}</p>
      </section>
    );
  }
  // Without the class server there is nothing to join: say so, instead of a form that can only fail.
  if (!hasServer()) {
    return (
      <section className="section set-group" aria-labelledby="cls-title">
        <h2 id="cls-title" className="set-head">{t('settings.settings.9')}</h2>
        <p className="muted">{t('settings.settings.10')}</p>
      </section>
    );
  }
  const join = async (e) => {
    e.preventDefault(); setError('');
    if (needClaim && !claim) { setError(CLAIM_COPY.missing); return; }
    setBusy(true);
    try {
      const c = await joinClass({ code: code || profile.classCode, name: profile.name, pin, claim: needClaim ? claim : '' });
      setProfile({ ...profile, ...joinedProfile(c), role: 'student' });
      useApp.getState().quietForClass(); // sounds start off in a class, unless the student already chose them
      // the class's copy comes back (merged with what is here), or this device's code is kept by the class (DURABLE-6)
      const hello = () => toast.success(c.returning ? t('settings.settings.11', { className: c.className }) : t('settings.settings.12', { className: c.className }));
      if (!c.vault) hello();
      const r = await afterClassJoin(c);
      if (r.restored) toast.success(r.toast);
      else if (c.vault) hello();
      if (r.toast && !r.restored) toast(r.toast);
    } catch (err) {
      if (err.code === 'claim_code_needed') setNeedClaim(true);
      else setError(err.message);
    } finally { setBusy(false); }
  };
  return (
    <section className="section set-group" aria-labelledby="cls-title">
      <h2 id="cls-title" className="set-head">{profile.classCode ? t('settings.settings.13') : t('settings.settings.9')}</h2>
      <form className="stack" onSubmit={join} noValidate>
        {!profile.classCode && (
          <Field label={t('settings.settings.14')} id="me-code"><input id="me-code" className="input mono" dir="ltr" value={code} onChange={(e) => { setNeedClaim(false); setCode(e.target.value.toUpperCase()); }} maxLength={6} /></Field>
        )}
        {needClaim && <ClaimField id="me-claim" value={claim} onChange={(v) => { setError(''); setClaim(v); }} />}
        <Field label={needClaim ? CLAIM_COPY.pinLabel : t('settings.settings.15')} id="me-pin" hint={needClaim ? null : t('settings.settings.16')}>
          <input id="me-pin" className="input mono" dir="ltr" inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
        </Field>
        {escrowClass && (
          <p className="field-hint join-copy-note">
            {JOIN_COPY_NOTE}{backup?.on && !backup.escrow ? ` ${JOIN_CODE_NOTE}` : ''}
          </p>
        )}
        {error && <p className="form-error" role="alert">{error}</p>}
        <Button type="submit" disabled={busy}>{busy ? t('settings.settings.17') : t('settings.settings.18')}</Button>
        {profile.classCode && <Button variant="ghost" className="btn-sm" onClick={() => setConfirmLeave(true)}>{t('settings.settings.19')}</Button>}
      </form>
      <ConfirmSheet open={confirmLeave} onOpenChange={setConfirmLeave} title={t('settings.settings.20')} keep={t('settings.settings.21')} mood="idle"
        confirm={t('settings.settings.22')} onConfirm={() => { leaveClass(); setConfirmLeave(false); }}>
        <p>{t('settings.settings.23')}</p>
      </ConfirmSheet>
    </section>
  );
}

/** "Is the assistant there?": asks the server. `detail` (for adults) adds which model it uses. */
function useConnectionTest(detail = false) {
  const [status, setStatus] = useState('');
  const test = async () => {
    setStatus(t('settings.settings.24'));
    try {
      const h = await api('/api/health');
      setStatus(h.ai ? t('settings.settings.26', { p0: detail && h.model ? t('settings.settings.25', { model: h.model }) : '' }) : t('settings.settings.27'));
    } catch (e) { setStatus(e.message); }
  };
  return [status, test];
}

/** One quiet row at the end of Settings that leads adults to the server address and the personal key. */
function AdvancedRow() {
  if (!PERSONAL_KEY) return null;
  return (
    <section className="section set-group" aria-labelledby="adv-title">
      <h2 id="adv-title" className="set-head">{t('settings.settings.28')}</h2>
      <div className="set-rows-wrap"><div className="set-rows">
        <Link to="/settings/advanced" className="set-row"><span>{t('settings.settings.29')}</span><ChevronLeft size={18} aria-hidden="true" /></Link>
      </div></div>
    </section>
  );
}

/**
 * "מתקדם": the settings a student does not need, for the adult who sets the app up: the address of a class server, and
 * a personal Claude key on this device (an Anthropic account is an adult's, and a class always goes through its server).
 * Only the owner's own test builds have it (VITE_ALLOW_PERSONAL_KEY=1, never a public copy); elsewhere it leads back to Settings.
 */
export function AdvancedSettings() {
  const { ai, setAI, profile } = useApp();
  const navigate = useNavigate();
  const inClass = !!profile?.classCode;
  const [url, setUrl] = useState(ai.apiUrl || '');
  const [key, setKey] = useState(ai.key || '');
  const [status, test] = useConnectionTest(true);
  const served = hasServer();
  if (!PERSONAL_KEY) return <Navigate to="/settings" replace />;
  const save = () => { setAI({ apiUrl: url.trim() }); test(); };
  return (
    <div className="page pushed settings settings-advanced">
      <header className="screen-bar" data-region="header">
        <button type="button" className="icon-btn" onClick={() => navigate(-1)} aria-label={t('settings.settings.30')}><ArrowRight size={24} aria-hidden="true" /></button>
        <h1 className="screen-bar-title">{t('settings.settings.28')}</h1>
        <span className="icon-btn-spacer" aria-hidden="true" />
      </header>
      <p className="set-adult-note">{t('settings.settings.31')}</p>
      {!inClass && (
        <section className="section set-group" aria-labelledby="adv-mode">
          <h2 id="adv-mode" className="set-head">{t('settings.settings.32')}</h2>
          <div className="segmented" role="radiogroup" aria-labelledby="adv-mode">
            <button type="button" role="radio" aria-checked={ai.mode !== 'personal'} className={clsx('seg', ai.mode !== 'personal' && 'on')} onClick={() => setAI({ mode: 'server' })}>{t('settings.settings.33')}</button>
            <button type="button" role="radio" aria-checked={ai.mode === 'personal'} className={clsx('seg', ai.mode === 'personal' && 'on')} onClick={() => setAI({ mode: 'personal' })}>{t('settings.settings.34')}</button>
          </div>
        </section>
      )}
      {(inClass || ai.mode !== 'personal') ? (
        <section className="section set-group" aria-labelledby="adv-server">
          <h2 id="adv-server" className="set-head">{t('settings.settings.35')}</h2>
          <div className="stack">
            <Field label={t('settings.settings.35')} id="ai-url" hint={served ? t('settings.settings.36') : t('settings.settings.37')}>
              <input id="ai-url" name="server-url" className="input mono" dir="ltr" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…workers.dev" autoComplete="off" spellCheck={false} />
            </Field>
            <Button variant="secondary" className="btn-sm" onClick={save}>{t('settings.settings.38')}</Button>
            {status && <p className="muted" role="status">{status}</p>}
          </div>
        </section>
      ) : (
        <section className="section set-group" aria-labelledby="adv-key">
          <h2 id="adv-key" className="set-head">{t('settings.settings.39')}</h2>
          <div className="stack">
            <Field label={t('settings.settings.40')} id="ai-key" hint={t('settings.settings.41')}>
              <input id="ai-key" type="password" className="input mono" dir="ltr" value={key} onChange={(e) => setKey(e.target.value)} placeholder="sk-ant-…" autoComplete="off" />
            </Field>
            <Button variant="secondary" onClick={() => { setAI({ key: key.trim(), mode: 'personal' }); toast.success(t('settings.settings.42')); }}>{t('settings.settings.43')}</Button>
            {ai.key && <Button variant="ghost" className="btn-sm" onClick={() => { setAI({ key: '', mode: 'server' }); setKey(''); }}>{t('settings.settings.44')}</Button>}
          </div>
        </section>
      )}
    </div>
  );
}

/**
 * העוזר החכם: what the tutor is on this device and the ways a parent links or cancels. On the free taste: two
 * questions a day, with the rows for parents. On a linked device: the family plan, and unlinking. In a licensed class:
 * open for the class. With no parent's OK yet on a device alone: the screen for the parents. With the paywall off or
 * no server: as before. A linked device always has "שיתוף עם ההורים" (PARENTS-4), whatever the plan: the child can
 * see what is shared, and stop it, in every state the server reports.
 * A store app (STUDENT-12) has no row that leads to buying or cancelling a plan: only "מידע להורים". A Play Store app
 * already linked to a family plan keeps it (Play allows using a plan bought elsewhere) and can unlink; the iPhone build
 * uses no family plan at all (familyInApp), so it shows neither the plan nor unlinking.
 */
function AISection() {
  const { ai, profile } = useApp();
  const status = useAIStatus((x) => x.status);
  const inClass = !!profile?.classCode;
  const served = hasServer();
  const [checking, setChecking] = useState('');
  const [unlink, setUnlink] = useState(false);
  const [sharing, setSharing] = useState(false);
  const test = async () => {
    setChecking(t('settings.settings.24'));
    try {
      const h = await api('/api/health');
      setChecking(h.ai ? t('settings.settings.45') : t('settings.settings.46'));
    } catch (e) { setChecking(e.message); }
  };
  const tier = status?.tier;
  const paid = served && status?.paywall === true && tier && tier !== 'open';
  const sell = canSell();
  const linked = familyInApp() && !!ai.familyDevice;
  const rows = [];
  let text;
  if (paid && linked && tier === 'family') {
    text = t('settings.settings.47');
    rows.push(<button key="unlink" type="button" className="set-row" onClick={() => setUnlink(true)}>{t('settings.settings.48')}</button>);
  } else if (paid && ['class', 'teacher', 'trial'].includes(tier)) {
    text = t('settings.settings.49');
  } else if (paid && tier === 'legacy') {
    text = t('settings.settings.50');
  } else if (paid) {
    text = t('settings.settings.51', { p0: status.groups?.tutor?.limit ?? 2 });
    if (linked) rows.push(<button key="unlink" type="button" className="set-row" onClick={() => setUnlink(true)}>{t('settings.settings.48')}</button>);
    else if (sell) rows.push(<Link key="link" to="/parents/info" className="set-row"><span>{t('settings.settings.52')}</span><ChevronLeft size={18} aria-hidden="true" /></Link>);
    rows.push(<Link key="info" to="/parents/info" className="set-row"><span>{t('settings.settings.53')}</span><ChevronLeft size={18} aria-hidden="true" /></Link>);
  }
  if (paid && sell) rows.push(<Link key="cancel" to="/cancel" className="set-row"><span>{t('settings.settings.54')}</span><ChevronLeft size={18} aria-hidden="true" /></Link>);
  const shared = linked && !!status?.linked;
  if (shared) {
    rows.unshift(
      <button key="share" type="button" className="set-row set-row-value" onClick={() => setSharing(true)}>
        <span>{t('settings.settings.55')}</span>
        <span className="set-row-state">{stateWord(status.linked.summary)}<ChevronLeft size={18} aria-hidden="true" /></span>
      </button>,
    );
  }
  // a child alone, on a device no parent has approved (trust spec TRUST-9): the one way on is the screen for the parents
  const waiting = served && status?.state === 'parent_ok_needed';
  if (waiting) {
    text = t('settings.settings.56', { PARENT_OK_LINE });
    rows.push(<Link key="ok" to="/parents/info" className="set-row"><span>{t('settings.settings.57')}</span><ChevronLeft size={18} aria-hidden="true" /></Link>);
  } else if (!paid) {
    text = inClass ? t('settings.settings.59', { p0: profile.teacherName ? t('settings.settings.58', { teacherName: profile.teacherName }) : '' })
      : served ? t('settings.settings.60')
        : PERSONAL_KEY && ai.mode === 'personal' && ai.key ? t('settings.settings.61')
          : PERSONAL_KEY ? t('settings.settings.62')
          : t('settings.settings.63');
  }
  return (
    <section className="section set-group" aria-labelledby="ai-title">
      <h2 id="ai-title" className="set-head">{t('settings.settings.64')}</h2>
      <div className="set-box stack">
        <p>{text}</p>
        {!paid && served && <Button variant="ghost" className="btn-sm" onClick={test}>{t('settings.settings.65')}</Button>}
        {checking && <p className="muted" role="status">{checking}</p>}
      </div>
      {rows.length > 0 && <div className="set-rows-wrap"><div className="set-rows">{rows}</div></div>}
      <ConfirmSheet open={unlink} onOpenChange={setUnlink} title={t('settings.settings.66')} keep={t('settings.settings.67')} mood="idle"
        confirm={t('settings.settings.68')} onConfirm={async () => {
          setUnlink(false);
          // a leave the server did not hear keeps the link (and the summaries are not left behind): say so
          try { await leaveFamily(); toast(t('settings.settings.69')); } catch { toast.error(UNLINK_FAILED); }
        }}>
        <p>{shared ? UNLINK_SUMMARIES : t('settings.settings.70')}</p>
      </ConfirmSheet>
      {shared && <SharingSheet open={sharing} onOpenChange={setSharing} />}
    </section>
  );
}

let LOOKS = localized(() => ([['system', t('settings.settings.71')], ['light', t('settings.settings.72')], ['dark', t('settings.settings.73')]]), (v) => { LOOKS = v; });

/** מראה: follow the phone (the default), or always light, or always dark (lib/theme.js). */
function ThemeSetting() {
  const theme = useApp((x) => x.prefs?.theme || 'system');
  const setTheme = useApp((x) => x.setTheme);
  return (
    <section className="section set-group" aria-labelledby="look-title">
      <h2 id="look-title" className="set-head">{t('settings.settings.74')}</h2>
      <Segmented value={theme} onValueChange={setTheme} options={LOOKS} labelledBy="look-title" describedBy="look-hint" />
      <p className="field-hint" id="look-hint">{t('settings.settings.75')}</p>
    </section>
  );
}

/**
 * שפה / اللغة (COUNCIL2-34): the language of this device's screens. In Arabic it also says, calmly, that the translation
 * has started and some screens are still in Hebrew.
 */
function LanguageSetting() {
  const lang = useLocale();
  return (
    <section className="section set-group" aria-labelledby="lang-title">
      <h2 id="lang-title" className="set-head">{t('settings.locale.title')}</h2>
      <LangPick labelledBy="lang-title" />
      <p className="field-hint" id="lang-hint">{t('settings.locale.hint')}{lang !== 'he' && <> {t('settings.locale.partial')}</>}</p>
    </section>
  );
}

/** Two choices made the same way (the shared Segmented: one radio group of two segments), with a short line under them. */
function OnOff({ id, title, value, onChange, on, off, hint, children }) {
  return (
    <section className="section set-group" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="set-head">{title}</h2>
      {children ?? (
        <>
          <Segmented value={!!value} onValueChange={onChange} options={[[true, on], [false, off]]} labelledBy={`${id}-title`} describedBy={`${id}-hint`} />
          <p className="field-hint" id={`${id}-hint`}>{hint}</p>
        </>
      )}
    </section>
  );
}

/** Sound and vibration are two choices (STUDENT-7). Vibration is offered only where the browser can vibrate. */
function SoundSettings() {
  const sound = useApp((x) => x.sound);
  const setSound = useApp((x) => x.setSound);
  const haptics = useApp((x) => x.haptics ?? true);
  const setHaptics = useApp((x) => x.setHaptics);
  const reduce = useReducedMotion();
  const canVibrate = typeof navigator !== 'undefined' && 'vibrate' in navigator;
  return (
    <>
      <OnOff id="snd" title={t('settings.settings.76')} value={sound} onChange={setSound} on={t('settings.settings.77')} off={t('settings.settings.78')} hint={t('settings.settings.79')} />
      {canVibrate
        ? <OnOff id="vib" title={t('settings.settings.80')} value={haptics} onChange={setHaptics} on={t('settings.settings.81')} off={t('settings.settings.82')} hint={reduce ? t('settings.settings.83') : t('settings.settings.84')} />
        : <OnOff id="vib" title={t('settings.settings.80')}><p className="field-hint" id="vib-hint">{t('settings.settings.85')}</p></OnOff>}
    </>
  );
}

/**
 * Install the app (STUDENT-10): a row only where the browser offers an install (Chrome and Edge, not yet installed, not
 * a store app). It opens the browser's own prompt; once used, the browser gives no second one and the row goes.
 */
function InstallRow() {
  const { canOffer, offer } = useInstall();
  if (!canOffer || isStoreApp() || isStandalone()) return null;
  const install = () => { count('install_offer'); offer(); };
  return (
    <section className="section set-group" aria-labelledby="app-title">
      <h2 id="app-title" className="set-head">{t('settings.settings.86')}</h2>
      <div className="set-rows-wrap"><div className="set-rows">
        <button type="button" className="set-row go" onClick={install}><span>{t('settings.settings.87')}</span><Download size={18} aria-hidden="true" /></button>
      </div></div>
    </section>
  );
}

/**
 * Signing out turns the daily reminder off: the server deletes its row, the browser drops it (STUDENT-11). "Delete all"
 * does the same through its own step (lib/reminder.js, registered with lib/wipe.js).
 */
async function forgetReminder() {
  if (useApp.getState().reminder?.on) await disableReminder({ quiet: true }).catch(() => {});
}

/** A parent's session and the parents' pages' leftovers on this device go too (lib/parent.js, loaded on demand). */
async function forgetParent() {
  try { const { forgetParentHere } = await import('@/lib/parent.js'); await forgetParentHere(); } catch { /* nothing kept */ }
}

/**
 * Privacy and safety: a person to talk to, one tap away (trust spec TRUST-3 §3.5), then the privacy notice, the tutor's
 * safety statement and the accessibility statement (trust spec TRUST-1 §5), above the danger zone.
 */
function SafetySection() {
  return (
    <section className="section set-group" aria-labelledby="safe-title">
      <h2 id="safe-title" className="set-head">{t('settings.settings.88')}</h2>
      <div className="set-rows-wrap"><div className="set-rows">
        <button type="button" className="set-row" onClick={openSupport} aria-haspopup="dialog"><span>{SUPPORT_LINK}</span><ChevronLeft size={18} aria-hidden="true" /></button>
        <Link to="/privacy" className="set-row"><span>{t('settings.settings.89')}</span><ChevronLeft size={18} aria-hidden="true" /></Link>
        <Link to="/safety" className="set-row"><span>{t('settings.settings.90')}</span><ChevronLeft size={18} aria-hidden="true" /></Link>
        <Link to="/accessibility" className="set-row"><span>{t('settings.settings.91')}</span><ChevronLeft size={18} aria-hidden="true" /></Link>
      </div></div>
    </section>
  );
}

/**
 * "מחיקת כל הנתונים" (trust spec TRUST-6 §3): the server first (lib/wipe.js). While it works, "מוחקים…" and nothing can
 * be pressed or closed. If the server part fails nothing was deleted, and the sheet says so, with "לנסות שוב" and a
 * quiet "למחוק רק מהמכשיר", which asks once more and says what stays on the server. As every sheet that deletes: the
 * big button is the safe one, and the delete is the quiet one under it.
 */
function WipeSheet({ open, onClose }) {
  const profile = useApp((s) => s.profile);
  const ai = useApp((s) => s.ai);
  const tier = useAIStatus((x) => x.status?.tier);
  const server = hasServer();
  const backup = useApp((s) => s.backup);
  const [view, setView] = useState('ask'); // 'ask' | 'failed' | 'local'
  const [busy, setBusy] = useState(false);
  // a step that failed may say why in its own words (the backup on the server: lib/durable/wipeSteps.js)
  const [failText, setFailText] = useState(null);
  const onOpenChange = (o) => { if (o || busy) return; setView('ask'); setFailText(null); onClose(); };
  const run = async (fn) => {
    setBusy(true);
    try { await fn(); } catch (e) { setFailText(e?.wipeText || null); setView('failed'); setBusy(false); }
  };
  // with the backup code on, the sheet says that the backup goes too (DURABLE-5); a copy the class or the family keeps
  // is not called "מוצפן" (DURABLE-6)
  const vaultLine = server && backup?.on ? (backup.escrow ? WIPE_KEPT : WIPE_VAULT) : null;
  // a device linked to the parents' account: the summaries it sent them go too, in the same delete on the server (PARENTS-4)
  const summaryLine = server && ai?.familyDevice?.token ? WIPE_SUMMARIES : null;
  const label = (text) => (busy ? t('settings.settings.92') : text);
  let body; let primary; let quiet;
  if (view === 'failed') {
    body = <p role="alert">{failText || WIPE_FAILED}</p>;
    primary = <Button className="btn-block btn-lg" disabled={busy} onClick={() => run(wipeEverything)}>{label(t('settings.settings.93'))}</Button>;
    quiet = <Button variant="ghost" className="btn-block exit-quit" disabled={busy} onClick={() => setView('local')}>{t('settings.settings.94')}</Button>;
  } else if (view === 'local') {
    body = <p>{deviceOnlyText({ profile, ai })}</p>;
    primary = <Button className="btn-block btn-lg" disabled={busy} onClick={() => onOpenChange(false)}>{t('settings.settings.95')}</Button>;
    quiet = <Button variant="ghost" className="btn-block exit-quit" disabled={busy} onClick={() => run(wipeDeviceOnly)}>{label(t('settings.settings.96'))}</Button>;
  } else {
    body = <><p>{wipeText({ profile, ai, server, tier })}</p>{vaultLine && <p>{vaultLine}</p>}{summaryLine && <p>{summaryLine}</p>}</>;
    primary = <Button className="btn-block btn-lg" disabled={busy} onClick={() => onOpenChange(false)}>{t('settings.settings.95')}</Button>;
    quiet = <Button variant="ghost" className="btn-block exit-quit" disabled={busy} onClick={() => run(wipeEverything)}>{label(t('settings.settings.97'))}</Button>;
  }
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={view === 'local' ? t('settings.settings.98') : t('settings.settings.99')}>
      <div className="exit-sheet confirm-sheet wipe-sheet" aria-busy={busy || undefined}>
        <Mascot mood="oops" size={88} />
        <div className="lead confirm-text">{body}</div>
        {primary}
        {quiet}
        <p className="visually-hidden" role="status">{busy ? t('settings.settings.92') : ''}</p>
      </div>
    </Sheet>
  );
}

export default function Settings() {
  const { profile, backup, patchProfile, resetProgress, signOut } = useApp();
  const familyLinked = useApp((s) => !!s.ai.familyDevice?.token);
  const summaryOn = useAIStatus((x) => x.status?.linked?.summary === 'on');
  const { state: nav, hash } = useLocation();
  const navigate = useNavigate();
  useEffect(() => { if (nav?.focus === 'ai') document.getElementById('ai-title')?.scrollIntoView({ block: 'start' }); }, [nav]);
  // "מה עושים" on the storage banner opens Settings at the saving section
  useEffect(() => {
    if (hash !== '#save') return;
    const el = document.getElementById('save-title');
    el?.scrollIntoView({ block: 'start' }); el?.focus({ preventScroll: true });
  }, [hash]);
  const [name, setName] = useState(profile.name);
  // the name can change under this screen (a restore, another tab): the field follows it
  useEffect(() => { setName(profile.name); }, [profile.name]);
  const [danger, setDanger] = useState(null);
  const vaultOn = !!backup?.on;
  // "מחיקת כל הנתונים" is the WipeSheet above (lib/wipe.js): the server first, the durable lane's steps
  // (lib/durable/wipeSteps.js: the backup on the server, the copy in the browser's database), then the device.
  // "התנתקות מהמכשיר" keeps the backup on the server (the code brings the progress back); what was learned since its
  // last update is sent first, if the server answers within a few seconds
  const [leaving, setLeaving] = useState(false);
  const signOutHere = async () => {
    if (leaving) return;
    setLeaving(true);
    if (vaultOn) await Promise.race([syncVault({ moment: 'lesson' }).catch(() => {}), new Promise((r) => { setTimeout(r, LAST_PUSH_MS); })]);
    await forgetReminder(); await forgetParent(); signOut();
  };
  return (
    <div className="page pushed settings">
      <header className="screen-bar" data-region="header">
        <button type="button" className="icon-btn" onClick={() => navigate(-1)} aria-label={t('settings.settings.30')}><ArrowRight size={24} aria-hidden="true" /></button>
        <h1 className="screen-bar-title">{t('settings.settings.100')}</h1>
        <span className="icon-btn-spacer" aria-hidden="true" />
      </header>
      <section className="section set-group" aria-labelledby="prof-title">
        <h2 id="prof-title" className="set-head">{t('settings.settings.101')}</h2>
        <div className="set-box">
          <Field label={t('settings.settings.102')} id="me-name">
            <input id="me-name" className="input" value={name} maxLength={30} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && patchProfile({ name: name.trim() })} disabled={!!profile.token} />
          </Field>
          {!profile.token && (
            <div className="field"><span className="field-label" id="me-grade">{t('settings.settings.103')}</span><GradeSwitch value={profile.grade || '7'} onChange={(g) => patchProfile({ grade: g })} id="me-grade" /></div>
          )}
        </div>
      </section>
      <LanguageSetting />
      <SaveSection />
      <ClassSection />
      <AISection />
      <ThemeSetting />
      <SoundSettings />
      <ReminderSettings />
      <SafetySection />
      <InstallRow />
      <AdvancedRow />
      <section className="section set-group danger-zone" aria-labelledby="dz-title">
        <h2 id="dz-title" className="set-head">{t('settings.settings.104')}</h2>
        <div className="set-rows-wrap">
          <div className="set-rows">
            <button type="button" className="set-row danger" onClick={() => setDanger('reset')}>{t('settings.settings.105')}</button>
            <button type="button" className="set-row danger" onClick={() => setDanger('wipe')}>{t('settings.settings.106')}</button>
            <button type="button" className="set-row danger" onClick={() => setDanger('out')}>{t('settings.settings.107')}</button>
          </div>
        </div>
      </section>
      <ConfirmSheet open={danger === 'reset'} onOpenChange={(o) => !o && setDanger(null)} title={t('settings.settings.108')} keep={t('settings.settings.109')}
        confirm={t('settings.settings.110')} onConfirm={() => { resetProgress(); setDanger(null); toast(t('settings.settings.111')); }}>
        <p>{t('settings.settings.112')}</p>
      </ConfirmSheet>
      <WipeSheet open={danger === 'wipe'} onClose={() => setDanger(null)} />
      <ConfirmSheet open={danger === 'out'} onOpenChange={(o) => !o && setDanger(null)} title={t('settings.settings.113')} keep={t('settings.settings.114')}
        confirm={leaving ? t('settings.settings.115') : t('settings.settings.116')} onConfirm={signOutHere}>
        <p>{t('settings.settings.117')}</p>
        {vaultOn && <p>{SIGNOUT_VAULT}</p>}
        <p>{t('settings.settings.118')}</p>
      </ConfirmSheet>
      <SupportInfo />
      {/* where the progress lives, in the words the whole app uses (lib/durable/copy.js) */}
      <p className="footnote">{t('settings.settings.119')}{whereSavedText({ profile, backup }, { summary: familyLinked && summaryOn })}</p>
    </div>
  );
}
