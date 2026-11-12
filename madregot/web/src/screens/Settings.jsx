// Settings, laid out like Duolingo's settings screen: a bar with the way back and the title, then grouped sections,
// each a bordered group with a small heading (my details, class, the assistant, the look, sound, vibration, the daily
// reminder, the app, deleting data).
// A student sees nothing about servers or keys: those are for the adult who sets the app up, behind "מתקדם".
import { useState, useEffect } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { toast } from 'sonner';
import { ArrowRight, ChevronLeft, Download } from 'lucide-react';
import { useReducedMotion } from 'motion/react';
import { api, hasServer } from '@/lib/api.js';
import { Button, Field, Sheet, Segmented } from '@/components/ui.jsx';
import { GradeSwitch, joinClass, joinedProfile } from './Welcome.jsx';
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

export const SIGNOUT_VAULT = 'הגיבוי בשרת נשאר. כדי לחזור להתקדמות, פותחים את מדרגות ובוחרים "יש לי קוד גיבוי".';
/**
 * The device-unlink sheet and the wipe sheet on a linked device: the parents' summaries go with it (PARENTS-4). "Delete all"
 * deletes them in the server's one delete (POST /api/me/forget, worker forget.js familyDeviceDeleteStmts).
 */
export const UNLINK_SUMMARIES = 'העוזר החכם יחזור כאן ל־2 שאלות ביום, והסיכומים שנשלחו להורים מהמכשיר הזה יימחקו. ההורים יכולים לחבר אותו שוב.';
export const WIPE_SUMMARIES = 'גם הסיכומים שנשלחו להורים מהמכשיר הזה יימחקו.';
/** The unlink could not reach the server: the link stays and the summaries are not deleted. */
export const UNLINK_FAILED = 'לא הצלחנו לנתק את המכשיר, אז הוא עדיין מחובר והסיכומים לא נמחקו. נסו שוב כשיש חיבור.';
/**
 * Under the join form of Settings: the class keeps a copy (Welcome's CLASS_COPY_NOTE), and when this device already has a
 * backup code that nobody keeps, joining gives that code to the class's server too: said before the join, with the way out.
 */
export const JOIN_COPY_NOTE = WHERE_SAVED.classCopyClause;
export const JOIN_CODE_NOTE = 'קוד הגיבוי שכבר יש לכם יישמר גם בשרת הכיתה, כך שהשרת יוכל לפתוח את העותק הזה. אפשר לכבות את זה במתג "שמירת עותק בשרת הכיתה".';
/** How long a sign-out waits for the last push of the backup before it goes on anyway. */
const LAST_PUSH_MS = 4000;

function ClassSection() {
  const { profile, setProfile, leaveClass } = useApp();
  const backup = useApp((s) => s.backup);
  const escrowClass = useApp((s) => s.durable?.escrowClass !== false);
  const [code, setCode] = useState(''); const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [confirmLeave, setConfirmLeave] = useState(false);

  if (profile.classCode && profile.token) {
    return (
      <section className="section set-group" aria-labelledby="cls-title">
        <h2 id="cls-title" className="set-head">הכיתה שלי</h2>
        <p>כיתה <b>{profile.className}</b> <span className="muted mono" dir="ltr">({profile.classCode})</span></p>
        <p className="muted">ההתקדמות ובקשות העזרה שלכם נשלחות למורה.</p>
      </section>
    );
  }
  // Without the class server there is nothing to join: say so, instead of a form that can only fail.
  if (!hasServer()) {
    return (
      <section className="section set-group" aria-labelledby="cls-title">
        <h2 id="cls-title" className="set-head">הצטרפות לכיתה</h2>
        <p className="muted">בגרסה הזו אין שרת כיתה, אז ההתקדמות נשמרת רק במכשיר הזה. כדי שהמורה יראה את ההתקדמות, נכנסים מהכתובת של הכיתה שהמורה נותן, ושם מצטרפים עם קוד הכיתה.</p>
      </section>
    );
  }
  const join = async (e) => {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      const c = await joinClass({ code: code || profile.classCode, name: profile.name, pin });
      setProfile({ ...profile, ...joinedProfile(c), role: 'student' });
      useApp.getState().quietForClass(); // sounds start off in a class, unless the student already chose them
      // the class's copy comes back (merged with what is here), or this device's code is kept by the class (DURABLE-6)
      const hello = () => toast.success(c.returning ? `ברוכים השבים לכיתה ${c.className}` : `הצטרפתם לכיתה ${c.className}`);
      if (!c.vault) hello();
      const r = await afterClassJoin(c);
      if (r.restored) toast.success(r.toast);
      else if (c.vault) hello();
      if (r.toast && !r.restored) toast(r.toast);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return (
    <section className="section set-group" aria-labelledby="cls-title">
      <h2 id="cls-title" className="set-head">{profile.classCode ? 'התחברות מחדש לכיתה' : 'הצטרפות לכיתה'}</h2>
      <form className="stack" onSubmit={join} noValidate>
        {!profile.classCode && (
          <Field label="קוד כיתה" id="me-code"><input id="me-code" className="input mono" dir="ltr" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={6} /></Field>
        )}
        <Field label="קוד אישי של 4 ספרות" id="me-pin" hint="אם זו הפעם הראשונה, בחרו קוד ותזכרו אותו.">
          <input id="me-pin" className="input mono" dir="ltr" inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
        </Field>
        {escrowClass && (
          <p className="field-hint join-copy-note">
            {JOIN_COPY_NOTE}{backup?.on && !backup.escrow ? ` ${JOIN_CODE_NOTE}` : ''}
          </p>
        )}
        {error && <p className="form-error" role="alert">{error}</p>}
        <Button type="submit" disabled={busy}>{busy ? 'מצטרפים…' : 'הצטרפות'}</Button>
        {profile.classCode && <Button variant="ghost" className="btn-sm" onClick={() => setConfirmLeave(true)}>לא רוצים כיתה</Button>}
      </form>
      <ConfirmSheet open={confirmLeave} onOpenChange={setConfirmLeave} title="להמשיך בלי כיתה?" keep="להישאר בכיתה" mood="idle"
        confirm="כן, להמשיך לבד" onConfirm={() => { leaveClass(); setConfirmLeave(false); }}>
        <p>ההתקדמות נשארת במכשיר, אבל המורה לא יראה אותה. אפשר להצטרף שוב עם הקוד.</p>
      </ConfirmSheet>
    </section>
  );
}

/** "Is the assistant there?": asks the server. `detail` (for adults) adds which model it uses. */
function useConnectionTest(detail = false) {
  const [status, setStatus] = useState('');
  const test = async () => {
    setStatus('בודקים…');
    try {
      const h = await api('/api/health');
      setStatus(h.ai ? `העוזר מחובר ומוכן.${detail && h.model ? ` מודל: ${h.model}` : ''}` : 'השרת עונה, אבל העוזר עוד לא חובר אליו.');
    } catch (e) { setStatus(e.message); }
  };
  return [status, test];
}

/** One quiet row at the end of Settings that leads adults to the server address and the personal key. */
function AdvancedRow() {
  if (!PERSONAL_KEY) return null;
  return (
    <section className="section set-group" aria-labelledby="adv-title">
      <h2 id="adv-title" className="set-head">מתקדם</h2>
      <div className="set-rows-wrap"><div className="set-rows">
        <Link to="/settings/advanced" className="set-row"><span>חיבור העוזר לשרת או למפתח (להורים ולמורים)</span><ChevronLeft size={18} aria-hidden="true" /></Link>
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
        <button type="button" className="icon-btn" onClick={() => navigate(-1)} aria-label="חזרה"><ArrowRight size={24} aria-hidden="true" /></button>
        <h1 className="screen-bar-title">מתקדם</h1>
        <span className="icon-btn-spacer" aria-hidden="true" />
      </header>
      <p className="set-adult-note">ההגדרות כאן הן להורה או למורה שמכינים את האפליקציה. תלמידים לא צריכים לשנות כאן כלום.</p>
      {!inClass && (
        <section className="section set-group" aria-labelledby="adv-mode">
          <h2 id="adv-mode" className="set-head">איך העוזר מתחבר</h2>
          <div className="segmented" role="radiogroup" aria-labelledby="adv-mode">
            <button type="button" role="radio" aria-checked={ai.mode !== 'personal'} className={clsx('seg', ai.mode !== 'personal' && 'on')} onClick={() => setAI({ mode: 'server' })}>שרת הכיתה</button>
            <button type="button" role="radio" aria-checked={ai.mode === 'personal'} className={clsx('seg', ai.mode === 'personal' && 'on')} onClick={() => setAI({ mode: 'personal' })}>מפתח אישי</button>
          </div>
        </section>
      )}
      {(inClass || ai.mode !== 'personal') ? (
        <section className="section set-group" aria-labelledby="adv-server">
          <h2 id="adv-server" className="set-head">כתובת השרת</h2>
          <div className="stack">
            <Field label="כתובת השרת" id="ai-url" hint={served ? 'משאירים ריק כדי להשתמש בשרת שהאפליקציה הגיעה ממנו.' : 'הכתובת של שרת הכיתה, כמו שהמורה נתן.'}>
              <input id="ai-url" name="server-url" className="input mono" dir="ltr" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…workers.dev" autoComplete="off" spellCheck={false} />
            </Field>
            <Button variant="secondary" className="btn-sm" onClick={save}>שמירה ובדיקה</Button>
            {status && <p className="muted" role="status">{status}</p>}
          </div>
        </section>
      ) : (
        <section className="section set-group" aria-labelledby="adv-key">
          <h2 id="adv-key" className="set-head">מפתח Claude אישי</h2>
          <div className="stack">
            <Field label="מפתח Claude (Anthropic API)" id="ai-key" hint="חשבון Anthropic הוא של מבוגר. המפתח נשמר רק במכשיר הזה ונשלח ישירות ל־Anthropic, בלי המגבלות של שרת הכיתה. אל תשמרו מפתח במכשיר של תלמיד אחר.">
              <input id="ai-key" type="password" className="input mono" dir="ltr" value={key} onChange={(e) => setKey(e.target.value)} placeholder="sk-ant-…" autoComplete="off" />
            </Field>
            <Button variant="secondary" onClick={() => { setAI({ key: key.trim(), mode: 'personal' }); toast.success('המפתח נשמר במכשיר'); }}>שמירת המפתח</Button>
            {ai.key && <Button variant="ghost" className="btn-sm" onClick={() => { setAI({ key: '', mode: 'server' }); setKey(''); }}>מחיקת המפתח מהמכשיר</Button>}
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
    setChecking('בודקים…');
    try {
      const h = await api('/api/health');
      setChecking(h.ai ? 'העוזר מחובר ומוכן.' : 'השרת עונה, אבל העוזר עוד לא מחובר בו.');
    } catch (e) { setChecking(e.message); }
  };
  const tier = status?.tier;
  const paid = served && status?.paywall === true && tier && tier !== 'open';
  const sell = canSell();
  const linked = familyInApp() && !!ai.familyDevice;
  const rows = [];
  let text;
  if (paid && linked && tier === 'family') {
    text = 'העוזר החכם פתוח במכשיר הזה דרך המנוי המשפחתי.';
    rows.push(<button key="unlink" type="button" className="set-row" onClick={() => setUnlink(true)}>ניתוק המכשיר מהמנוי</button>);
  } else if (paid && ['class', 'teacher', 'trial'].includes(tier)) {
    text = 'העוזר החכם פתוח לכל הכיתה.';
  } else if (paid && tier === 'legacy') {
    text = 'העוזר פתוח דרך הכיתה.';
  } else if (paid) {
    text = `בכל יום אפשר לשאול את העוזר החכם ${status.groups?.tutor?.limit ?? 2} שאלות. מדי, השיעורים והתרגול פתוחים תמיד.`;
    if (linked) rows.push(<button key="unlink" type="button" className="set-row" onClick={() => setUnlink(true)}>ניתוק המכשיר מהמנוי</button>);
    else if (sell) rows.push(<Link key="link" to="/parents/info" className="set-row"><span>חיבור למנוי משפחתי</span><ChevronLeft size={18} aria-hidden="true" /></Link>);
    rows.push(<Link key="info" to="/parents/info" className="set-row"><span>מידע להורים</span><ChevronLeft size={18} aria-hidden="true" /></Link>);
  }
  if (paid && sell) rows.push(<Link key="cancel" to="/cancel" className="set-row"><span>ביטול מנוי</span><ChevronLeft size={18} aria-hidden="true" /></Link>);
  const shared = linked && !!status?.linked;
  if (shared) {
    rows.unshift(
      <button key="share" type="button" className="set-row set-row-value" onClick={() => setSharing(true)}>
        <span>שיתוף עם ההורים</span>
        <span className="set-row-state">{stateWord(status.linked.summary)}<ChevronLeft size={18} aria-hidden="true" /></span>
      </button>,
    );
  }
  // a child alone, on a device no parent has approved (trust spec TRUST-9): the one way on is the screen for the parents
  const waiting = served && status?.state === 'parent_ok_needed';
  if (waiting) {
    text = `${PARENT_OK_LINE} מדי, השיעורים והתרגול פתוחים תמיד.`;
    rows.push(<Link key="ok" to="/parents/info" className="set-row"><span>אישור של הורה</span><ChevronLeft size={18} aria-hidden="true" /></Link>);
  } else if (!paid) {
    text = inClass ? `העוזר מחובר דרך הכיתה${profile.teacherName ? ` של ${profile.teacherName}` : ''}. אין צורך להגדיר כלום.`
      : served ? 'העוזר עובד דרך השרת של האפליקציה.'
        : PERSONAL_KEY && ai.mode === 'personal' && ai.key ? 'העוזר מחובר במכשיר הזה, דרך ההגדרות המתקדמות.'
          : PERSONAL_KEY ? 'בגרסה הזו העוזר כבוי. השיעורים, המפה והמשימות עובדים גם בלעדיו. כשמצטרפים לכיתה מהכתובת שהמורה נותן, העוזר מגיע איתה.'
          : 'בגרסה הזו העוזר החכם לא מחובר. השיעורים, התרגול ומדי עובדים כרגיל.';
  }
  return (
    <section className="section set-group" aria-labelledby="ai-title">
      <h2 id="ai-title" className="set-head">העוזר החכם</h2>
      <div className="set-box stack">
        <p>{text}</p>
        {!paid && served && <Button variant="ghost" className="btn-sm" onClick={test}>בדיקת חיבור</Button>}
        {checking && <p className="muted" role="status">{checking}</p>}
      </div>
      {rows.length > 0 && <div className="set-rows-wrap"><div className="set-rows">{rows}</div></div>}
      <ConfirmSheet open={unlink} onOpenChange={setUnlink} title="לנתק את המכשיר מהמנוי?" keep="להשאיר מחובר" mood="idle"
        confirm="כן, לנתק" onConfirm={async () => {
          setUnlink(false);
          // a leave the server did not hear keeps the link (and the summaries are not left behind): say so
          try { await leaveFamily(); toast('המכשיר נותק מהמנוי'); } catch { toast.error(UNLINK_FAILED); }
        }}>
        <p>{shared ? UNLINK_SUMMARIES : 'העוזר החכם יחזור כאן ל־2 שאלות ביום. ההורים יכולים לחבר אותו שוב.'}</p>
      </ConfirmSheet>
      {shared && <SharingSheet open={sharing} onOpenChange={setSharing} />}
    </section>
  );
}

const LOOKS = [['system', 'כמו במכשיר'], ['light', 'בהיר'], ['dark', 'כהה']];

/** מראה: follow the phone (the default), or always light, or always dark (lib/theme.js). */
function ThemeSetting() {
  const theme = useApp((x) => x.prefs?.theme || 'system');
  const setTheme = useApp((x) => x.setTheme);
  return (
    <section className="section set-group" aria-labelledby="look-title">
      <h2 id="look-title" className="set-head">מראה</h2>
      <Segmented value={theme} onValueChange={setTheme} options={LOOKS} labelledBy="look-title" describedBy="look-hint" />
      <p className="field-hint" id="look-hint">"כמו במכשיר" עובר לכהה כשהטלפון במצב כהה.</p>
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

/**
 * Sound and vibration are two choices (STUDENT-7). Vibration is offered only where the browser can vibrate. Sounds off
 * is the app's quiet mode: the maths burst on a rare moment does not play either (lib/mathBurst.js), and the hint says so.
 */
function SoundSettings() {
  const sound = useApp((x) => x.sound);
  const setSound = useApp((x) => x.setSound);
  const haptics = useApp((x) => x.haptics ?? true);
  const setHaptics = useApp((x) => x.setHaptics);
  const reduce = useReducedMotion();
  const canVibrate = typeof navigator !== 'undefined' && 'vibrate' in navigator;
  return (
    <>
      <OnOff id="snd" title="צלילים" value={sound} onChange={setSound} on="פועלים" off="כבויים" hint="צליל קצר אחרי תשובה ובסוף שיעור, וסימנים שעפים על המסך ברגעים מיוחדים. למי שהצטרף לכיתה הם כבויים בהתחלה." />
      {canVibrate
        ? <OnOff id="vib" title="רטט" value={haptics} onChange={setHaptics} on="פועל" off="כבוי" hint={reduce ? 'רטט קצר אחרי תשובה, בטלפונים שתומכים בזה. בטלפון מופעלת הפחתת תנועה, ולכן עכשיו אין רטט.' : 'רטט קצר אחרי תשובה, בטלפונים שתומכים בזה.'} />
        : <OnOff id="vib" title="רטט"><p className="field-hint" id="vib-hint">בדפדפן הזה אין רטט.</p></OnOff>}
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
      <h2 id="app-title" className="set-head">האפליקציה</h2>
      <div className="set-rows-wrap"><div className="set-rows">
        <button type="button" className="set-row go" onClick={install}><span>להתקין את האפליקציה</span><Download size={18} aria-hidden="true" /></button>
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
      <h2 id="safe-title" className="set-head">פרטיות ובטיחות</h2>
      <div className="set-rows-wrap"><div className="set-rows">
        <button type="button" className="set-row" onClick={openSupport} aria-haspopup="dialog"><span>{SUPPORT_LINK}</span><ChevronLeft size={18} aria-hidden="true" /></button>
        <Link to="/privacy" className="set-row"><span>מדיניות הפרטיות</span><ChevronLeft size={18} aria-hidden="true" /></Link>
        <Link to="/safety" className="set-row"><span>בטיחות בעוזר החכם</span><ChevronLeft size={18} aria-hidden="true" /></Link>
        <Link to="/accessibility" className="set-row"><span>הצהרת נגישות</span><ChevronLeft size={18} aria-hidden="true" /></Link>
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
  const label = (text) => (busy ? 'מוחקים…' : text);
  let body; let primary; let quiet;
  if (view === 'failed') {
    body = <p role="alert">{failText || WIPE_FAILED}</p>;
    primary = <Button className="btn-block btn-lg" disabled={busy} onClick={() => run(wipeEverything)}>{label('לנסות שוב')}</Button>;
    quiet = <Button variant="ghost" className="btn-block exit-quit" disabled={busy} onClick={() => setView('local')}>למחוק רק מהמכשיר</Button>;
  } else if (view === 'local') {
    body = <p>{deviceOnlyText({ profile, ai })}</p>;
    primary = <Button className="btn-block btn-lg" disabled={busy} onClick={() => onOpenChange(false)}>לא למחוק</Button>;
    quiet = <Button variant="ghost" className="btn-block exit-quit" disabled={busy} onClick={() => run(wipeDeviceOnly)}>{label('כן, למחוק רק מהמכשיר')}</Button>;
  } else {
    body = <><p>{wipeText({ profile, ai, server, tier })}</p>{vaultLine && <p>{vaultLine}</p>}{summaryLine && <p>{summaryLine}</p>}</>;
    primary = <Button className="btn-block btn-lg" disabled={busy} onClick={() => onOpenChange(false)}>לא למחוק</Button>;
    quiet = <Button variant="ghost" className="btn-block exit-quit" disabled={busy} onClick={() => run(wipeEverything)}>{label('כן, למחוק הכול')}</Button>;
  }
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={view === 'local' ? 'למחוק רק מהמכשיר?' : 'למחוק הכול?'}>
      <div className="exit-sheet confirm-sheet wipe-sheet" aria-busy={busy || undefined}>
        <Mascot mood="oops" size={88} />
        <div className="lead confirm-text">{body}</div>
        {primary}
        {quiet}
        <p className="visually-hidden" role="status">{busy ? 'מוחקים…' : ''}</p>
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
        <button type="button" className="icon-btn" onClick={() => navigate(-1)} aria-label="חזרה"><ArrowRight size={24} aria-hidden="true" /></button>
        <h1 className="screen-bar-title">הגדרות</h1>
        <span className="icon-btn-spacer" aria-hidden="true" />
      </header>
      <section className="section set-group" aria-labelledby="prof-title">
        <h2 id="prof-title" className="set-head">הפרטים שלי</h2>
        <div className="set-box">
          <Field label="שם" id="me-name">
            <input id="me-name" className="input" value={name} maxLength={30} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && patchProfile({ name: name.trim() })} disabled={!!profile.token} />
          </Field>
          {!profile.token && (
            <div className="field"><span className="field-label" id="me-grade">כיתה</span><GradeSwitch value={profile.grade || '7'} onChange={(g) => patchProfile({ grade: g })} id="me-grade" /></div>
          )}
        </div>
      </section>
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
        <h2 id="dz-title" className="set-head">אזור מחיקה</h2>
        <div className="set-rows-wrap">
          <div className="set-rows">
            <button type="button" className="set-row danger" onClick={() => setDanger('reset')}>איפוס ההתקדמות</button>
            <button type="button" className="set-row danger" onClick={() => setDanger('wipe')}>מחיקת כל הנתונים</button>
            <button type="button" className="set-row danger" onClick={() => setDanger('out')}>התנתקות מהמכשיר</button>
          </div>
        </div>
      </section>
      <ConfirmSheet open={danger === 'reset'} onOpenChange={(o) => !o && setDanger(null)} title="לאפס את ההתקדמות?" keep="להשאיר את ההתקדמות"
        confirm="כן, לאפס" onConfirm={() => { resetProgress(); setDanger(null); toast('ההתקדמות אופסה'); }}>
        <p>כל המדרגות, הנקודות וההיסטוריה במכשיר הזה יימחקו.</p>
      </ConfirmSheet>
      <WipeSheet open={danger === 'wipe'} onClose={() => setDanger(null)} />
      <ConfirmSheet open={danger === 'out'} onOpenChange={(o) => !o && setDanger(null)} title="להתנתק מהמכשיר?" keep="להישאר מחוברים"
        confirm={leaving ? 'מתנתקים…' : 'כן, להתנתק'} onConfirm={signOutHere}>
        <p>המכשיר יחזור למסך הפתיחה, וההתקדמות שנשמרה בו תימחק.</p>
        {vaultOn && <p>{SIGNOUT_VAULT}</p>}
        <p>ההגדרות של העוזר במכשיר נשארות. כדי למחוק הכול, בחרו 'מחיקת כל הנתונים'.</p>
      </ConfirmSheet>
      <SupportInfo />
      {/* where the progress lives, in the words the whole app uses (lib/durable/copy.js) */}
      <p className="footnote">מדרגות. {whereSavedText({ profile, backup }, { summary: familyLinked && summaryOn })}</p>
    </div>
  );
}
