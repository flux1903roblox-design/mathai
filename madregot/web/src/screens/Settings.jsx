// Settings, laid out like Duolingo's settings screen: a bar with the way back and the title, then grouped sections,
// each a bordered group with a small heading (my details, class, the assistant, sound, deleting data).
// A student sees nothing about servers or keys: those are for the adult who sets the app up, behind "מתקדם".
import { useState, useEffect } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { toast } from 'sonner';
import { ArrowRight, ChevronLeft } from 'lucide-react';
import { api, hasServer } from '@/lib/api.js';
import { Button, Field, Sheet } from '@/components/ui.jsx';
import { GradeSwitch, joinClass } from './Welcome.jsx';
import { ConfirmSheet } from '@/components/Screen.jsx';
import Mascot from '@/components/Mascot.jsx';
import { openSupport } from '@/components/SupportSheet.jsx';
import { SUPPORT_LINK } from '@/content/support.js';
import { useAIStatus, leaveFamily } from '@/lib/account.js';
import { PARENT_OK_LINE } from '@/components/limitCopy.js';
import { useApp, PERSONAL_KEY } from '@/lib/store.js';
import { wipeEverything, wipeDeviceOnly, wipeText, deviceOnlyText, WIPE_FAILED } from '@/lib/wipe.js';

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
      setProfile({ ...profile, ...c, role: 'student' });
      toast.success(`הצטרפתם לכיתה ${c.className}`);
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

function SoundSetting() {
  const sound = useApp((x) => x.sound);
  const setSound = useApp((x) => x.setSound);
  return (
    <section className="section set-group" aria-labelledby="snd-title">
      <h2 id="snd-title" className="set-head">צלילים ורטט</h2>
      <div className="segmented" role="radiogroup" aria-labelledby="snd-title">
        <button type="button" role="radio" aria-checked={sound} className={clsx('seg', sound && 'on')} onClick={() => setSound(true)}>פועלים</button>
        <button type="button" role="radio" aria-checked={!sound} className={clsx('seg', !sound && 'on')} onClick={() => setSound(false)}>כבויים</button>
      </div>
      <p className="field-hint">צליל קצר אחרי כל תשובה ובסוף שיעור. בטלפון אנדרואיד יש גם רטט קל אחרי טעות.</p>
    </section>
  );
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
  const [view, setView] = useState('ask'); // 'ask' | 'failed' | 'local'
  const [busy, setBusy] = useState(false);
  const onOpenChange = (o) => { if (o || busy) return; setView('ask'); onClose(); };
  const run = async (fn) => {
    setBusy(true);
    try { await fn(); } catch { setView('failed'); setBusy(false); }
  };
  const label = (text) => (busy ? 'מוחקים…' : text);
  let body; let primary; let quiet;
  if (view === 'failed') {
    body = <p role="alert">{WIPE_FAILED}</p>;
    primary = <Button className="btn-block btn-lg" disabled={busy} onClick={() => run(wipeEverything)}>{label('לנסות שוב')}</Button>;
    quiet = <Button variant="ghost" className="btn-block exit-quit" disabled={busy} onClick={() => setView('local')}>למחוק רק מהמכשיר</Button>;
  } else if (view === 'local') {
    body = <p>{deviceOnlyText({ profile, ai })}</p>;
    primary = <Button className="btn-block btn-lg" disabled={busy} onClick={() => onOpenChange(false)}>לא למחוק</Button>;
    quiet = <Button variant="ghost" className="btn-block exit-quit" disabled={busy} onClick={() => run(wipeDeviceOnly)}>{label('כן, למחוק רק מהמכשיר')}</Button>;
  } else {
    body = <p>{wipeText({ profile, ai, server, tier })}</p>;
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
  const { profile, patchProfile, resetProgress, signOut } = useApp();
  const { state: nav } = useLocation();
  const navigate = useNavigate();
  useEffect(() => { if (nav?.focus === 'ai') document.getElementById('ai-title')?.scrollIntoView({ block: 'start' }); }, [nav]);
  const [name, setName] = useState(profile.name);
  const [danger, setDanger] = useState(null);
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
      <ClassSection />
      <AISection />
      <SoundSetting />
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
      <WipeSheet open={danger === 'wipe'} onClose={() => setDanger(null)} />
      <ConfirmSheet open={danger === 'out'} onOpenChange={(o) => !o && setDanger(null)} title="להתנתק מהמכשיר?" keep="להישאר מחוברים"
        confirm="כן, להתנתק" onConfirm={async () => { await forgetParent(); signOut(); }}>
        <p>המכשיר יחזור למסך הפתיחה, וההתקדמות שנשמרה בו תימחק.</p>
        <p>ההגדרות של העוזר במכשיר נשארות. כדי למחוק הכול, בחרו 'מחיקת כל הנתונים'.</p>
      </ConfirmSheet>
      <p className="footnote">מדרגות{hasServer() ? '' : '. בלי שרת: ההתקדמות נשמרת רק במכשיר הזה.'}</p>
    </div>
  );
}
