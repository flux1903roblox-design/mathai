// Settings, laid out like Duolingo's settings screen: a bar with the way back and the title, then grouped sections,
// each a bordered group with a small heading (my details, class, the assistant, the look, sound, vibration, deleting data).
// A student sees nothing about servers or keys: those are for the adult who sets the app up, behind "מתקדם".
import { useState, useEffect } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { toast } from 'sonner';
import { ArrowRight, ChevronLeft } from 'lucide-react';
import { useReducedMotion } from 'motion/react';
import { api, hasServer } from '@/lib/api.js';
import { Button, Field } from '@/components/ui.jsx';
import { GradeSwitch, joinClass, joinedProfile } from './Welcome.jsx';
import { ConfirmSheet } from '@/components/Screen.jsx';
import { openSupport } from '@/components/SupportSheet.jsx';
import { SUPPORT_LINK } from '@/content/support.js';
import { useAIStatus, leaveFamily } from '@/lib/account.js';
import { PARENT_OK_LINE } from '@/components/limitCopy.js';
import { useApp, PERSONAL_KEY } from '@/lib/store.js';
import { durableWipe } from '@/lib/durable/storage.js';
import SaveSection from '@/components/durable/SaveSection.jsx';
import SupportInfo from '@/components/durable/SupportInfo.jsx';
import { whereSavedText } from '@/lib/durable/copy.js';
import { stopBackup, syncVault, vaultErrorText } from '@/lib/durable/vault.js';
import { afterClassJoin } from '@/lib/durable/escrow.js';

/** The danger zone's lines about the backup code (DURABLE-5), added while it is on. */
export const WIPE_VAULT = 'גם הגיבוי המוצפן בשרת יימחק, וקוד הגיבוי יפסיק לעבוד.';
/** The same, when the class or the family keeps the code (DURABLE-6): that copy is not called "מוצפן". */
export const WIPE_KEPT = 'גם הגיבוי בשרת יימחק, וקוד הגיבוי יפסיק לעבוד.';
export const SIGNOUT_VAULT = 'הגיבוי בשרת נשאר. כדי לחזור להתקדמות, פותחים את מדרגות ובוחרים "יש לי קוד גיבוי".';
/** "Delete all" could not delete the backup on the server, so it deleted nothing (the reason follows). */
export const WIPE_FAILED = 'לא הצלחנו למחוק את הגיבוי בשרת, ולכן לא מחקנו כלום.';
/** How long a sign-out waits for the last push of the backup before it goes on anyway. */
const LAST_PUSH_MS = 4000;

function ClassSection() {
  const { profile, setProfile, leaveClass } = useApp();
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
 * no server: as before.
 */
function AISection() {
  const { ai, profile } = useApp();
  const status = useAIStatus((x) => x.status);
  const inClass = !!profile?.classCode;
  const served = hasServer();
  const [checking, setChecking] = useState('');
  const [unlink, setUnlink] = useState(false);
  const test = async () => {
    setChecking('בודקים…');
    try {
      const h = await api('/api/health');
      setChecking(h.ai ? 'העוזר מחובר ומוכן.' : 'השרת עונה, אבל העוזר עוד לא מחובר בו.');
    } catch (e) { setChecking(e.message); }
  };
  const tier = status?.tier;
  const paid = served && status?.paywall === true && tier && tier !== 'open';
  const linked = !!ai.familyDevice;
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
    else rows.push(<Link key="link" to="/parents/info" className="set-row"><span>חיבור למנוי משפחתי</span><ChevronLeft size={18} aria-hidden="true" /></Link>);
    rows.push(<Link key="info" to="/parents/info" className="set-row"><span>מידע להורים</span><ChevronLeft size={18} aria-hidden="true" /></Link>);
  }
  if (paid) rows.push(<Link key="cancel" to="/cancel" className="set-row"><span>ביטול מנוי</span><ChevronLeft size={18} aria-hidden="true" /></Link>);
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
        confirm="כן, לנתק" onConfirm={async () => { setUnlink(false); await leaveFamily(); toast('המכשיר נותק מהמנוי'); }}>
        <p>העוזר החכם יחזור כאן ל־2 שאלות ביום. ההורים יכולים לחבר אותו שוב.</p>
      </ConfirmSheet>
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
      <div className="segmented" role="radiogroup" aria-labelledby="look-title" aria-describedby="look-hint">
        {LOOKS.map(([v, label]) => (
          <button key={v} type="button" role="radio" aria-checked={theme === v} className={clsx('seg', theme === v && 'on')} onClick={() => setTheme(v)}>{label}</button>
        ))}
      </div>
      <p className="field-hint" id="look-hint">"כמו במכשיר" עובר לכהה כשהטלפון במצב כהה.</p>
    </section>
  );
}

/** Two choices made the same way (a radio group of two segments), with a short line under them. */
function OnOff({ id, title, value, onChange, on, off, hint, children }) {
  return (
    <section className="section set-group" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="set-head">{title}</h2>
      {children ?? (
        <>
          <div className="segmented" role="radiogroup" aria-labelledby={`${id}-title`} aria-describedby={`${id}-hint`}>
            <button type="button" role="radio" aria-checked={value} className={clsx('seg', value && 'on')} onClick={() => onChange(true)}>{on}</button>
            <button type="button" role="radio" aria-checked={!value} className={clsx('seg', !value && 'on')} onClick={() => onChange(false)}>{off}</button>
          </div>
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
      <OnOff id="snd" title="צלילים" value={sound} onChange={setSound} on="פועלים" off="כבויים" hint="צליל קצר אחרי תשובה ובסוף שיעור. למי שהצטרף לכיתה הם כבויים בהתחלה." />
      {canVibrate
        ? <OnOff id="vib" title="רטט" value={haptics} onChange={setHaptics} on="פועל" off="כבוי" hint={reduce ? 'רטט קצר אחרי תשובה, בטלפונים שתומכים בזה. בטלפון מופעלת הפחתת תנועה, ולכן עכשיו אין רטט.' : 'רטט קצר אחרי תשובה, בטלפונים שתומכים בזה.'} />
        : <OnOff id="vib" title="רטט"><p className="field-hint" id="vib-hint">בדפדפן הזה אין רטט.</p></OnOff>}
    </>
  );
}

/** A parent's session and the parents' pages' leftovers on this device go too (lib/parent.js, loaded on demand). */
async function forgetParent() {
  try { const { forgetParentHere } = await import('@/lib/parent.js'); await forgetParentHere(); } catch { /* nothing kept */ }
}

/**
 * Privacy and safety: a person to talk to, one tap away (trust spec TRUST-3 §3.5). The legal pages join this group
 * later (TRUST-2).
 */
function SafetySection() {
  return (
    <section className="section set-group" aria-labelledby="safe-title">
      <h2 id="safe-title" className="set-head">פרטיות ובטיחות</h2>
      <div className="set-rows-wrap"><div className="set-rows">
        <button type="button" className="set-row" onClick={openSupport} aria-haspopup="dialog"><span>{SUPPORT_LINK}</span><ChevronLeft size={18} aria-hidden="true" /></button>
      </div></div>
    </section>
  );
}

export default function Settings() {
  const { profile, backup, patchProfile, resetProgress, signOut } = useApp();
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
  const [wiping, setWiping] = useState(false);
  const [wipeError, setWipeError] = useState('');
  const vaultOn = !!backup?.on;
  // "מחיקת כל הנתונים": with the backup code on, the copy on the server goes first; if that fails nothing is deleted
  // here either, and the sheet says why. Then the family link and a parent's session, the saved progress, its copy on
  // the device and the quarantine; this page writes nothing again, so it reloads.
  const wipe = async () => {
    if (wiping) return;
    setWiping(true); setWipeError('');
    if (vaultOn) {
      try { await stopBackup(); } catch (e) { setWipeError(`${WIPE_FAILED} ${vaultErrorText(e)}`); setWiping(false); return; }
    }
    await leaveFamily(); await forgetParent();
    // the saved progress, its copy on the device and the quarantine go; this page writes nothing again, so it reloads
    await durableWipe(); signOut();
    // the look goes back to following the phone (its mirror for public/theme-boot.js is removed too)
    useApp.getState().setTheme('system');
    window.location.hash = '#/'; window.location.reload();
  };
  // "התנתקות מהמכשיר" keeps the backup on the server (the code brings the progress back); what was learned since its
  // last update is sent first, if the server answers within a few seconds
  const [leaving, setLeaving] = useState(false);
  const signOutHere = async () => {
    if (leaving) return;
    setLeaving(true);
    if (vaultOn) await Promise.race([syncVault({ moment: 'lesson' }).catch(() => {}), new Promise((r) => { setTimeout(r, LAST_PUSH_MS); })]);
    await forgetParent(); signOut();
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
      <SafetySection />
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
      <ConfirmSheet open={danger === 'wipe'} onOpenChange={(o) => { if (!o && !wiping) { setDanger(null); setWipeError(''); } }} title="למחוק הכול?" keep="לא למחוק"
        confirm={wiping ? 'מוחקים…' : 'כן, למחוק הכול'} onConfirm={wipe}>
        <p>כל מה שנשמר במכשיר הזה יימחק: השם, ההתקדמות, הטעויות שזוהו, תוכנית המבחן והמספרים. {vaultOn && `${backup?.escrow ? WIPE_KEPT : WIPE_VAULT} `}אי אפשר לבטל.</p>
        {wipeError && <p className="form-error" role="alert">{wipeError}</p>}
      </ConfirmSheet>
      <ConfirmSheet open={danger === 'out'} onOpenChange={(o) => !o && setDanger(null)} title="להתנתק מהמכשיר?" keep="להישאר מחוברים"
        confirm={leaving ? 'מתנתקים…' : 'כן, להתנתק'} onConfirm={signOutHere}>
        <p>המכשיר יחזור למסך הפתיחה, וההתקדמות שנשמרה בו תימחק.</p>
        {vaultOn && <p>{SIGNOUT_VAULT}</p>}
      </ConfirmSheet>
      <SupportInfo />
      {/* where the progress lives, in the words the whole app uses (lib/durable/copy.js) */}
      <p className="footnote">מדרגות. {whereSavedText({ profile, backup })}</p>
    </div>
  );
}
