// Settings, laid out like Duolingo's settings screen: a bar with the way back and the title, then grouped sections,
// each a bordered group with a small heading (my details, class, the assistant, sound, deleting data).
import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { toast } from 'sonner';
import { ArrowRight } from 'lucide-react';
import { useApp } from '@/lib/store.js';
import { api, hasServer } from '@/lib/api.js';
import { Button, Field } from '@/components/ui.jsx';
import { GradeSwitch, joinClass } from './Welcome.jsx';
import { ConfirmSheet } from '@/components/Screen.jsx';

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

function AISection() {
  const { ai, setAI, profile } = useApp();
  const inClass = !!profile?.classCode;
  const [url, setUrl] = useState(ai.apiUrl || '');
  const [key, setKey] = useState(ai.key || '');
  const [status, setStatus] = useState('');
  const served = hasServer();
  const test = async () => {
    setAI({ apiUrl: url.trim() }); setStatus('בודקים…');
    try {
      const h = await api('/api/health');
      setStatus(h.ai ? `השרת מחובר ומוכן. מודל: ${h.model}` : 'השרת עונה, אבל עוד לא חובר אליו מפתח Claude.');
    } catch (e) { setStatus(e.message); }
  };
  if (inClass) {
    return (
      <section className="section set-group" aria-labelledby="ai-title">
        <h2 id="ai-title" className="set-head">העוזר</h2>
        <p>העוזר מחובר דרך הכיתה{profile.teacherName ? ` של ${profile.teacherName}` : ''}. אין צורך להגדיר כלום.</p>
        <Button variant="ghost" className="btn-sm" onClick={test}>בדיקת חיבור</Button>
        {status && <p className="muted" role="status">{status}</p>}
      </section>
    );
  }
  return (
    <section className="section set-group" aria-labelledby="ai-title">
      <h2 id="ai-title" className="set-head">חיבור העוזר</h2>
      <div className="segmented" role="radiogroup" aria-label="איך העוזר מתחבר">
        <button type="button" role="radio" aria-checked={ai.mode !== 'personal'} className={clsx('seg', ai.mode !== 'personal' && 'on')} onClick={() => setAI({ mode: 'server' })}>שרת הכיתה</button>
        <button type="button" role="radio" aria-checked={ai.mode === 'personal'} className={clsx('seg', ai.mode === 'personal' && 'on')} onClick={() => setAI({ mode: 'personal' })}>מפתח אישי</button>
      </div>
      {ai.mode !== 'personal' ? (
        <div className="stack">
          {served ? (
            <>
              <p className="muted">העוזר עובד דרך השרת של האפליקציה.</p>
              <Button variant="ghost" className="btn-sm" onClick={test}>בדיקת חיבור</Button>
            </>
          ) : (
            <p className="muted">בגרסה הזו אין שרת מחובר. אפשר לכתוב כתובת של שרת כיתה בהגדרות המתקדמות, או לבחור &quot;מפתח אישי&quot; כדי לתרגל עם העוזר לבד.</p>
          )}
          {status && <p className="muted" role="status">{status}</p>}
          <details className="sol">
            <summary>הגדרות מתקדמות (למי שהתקין שרת משלו)</summary>
            <Field label="כתובת השרת" id="ai-url" hint={served ? 'משאירים ריק כדי להשתמש בשרת שהאפליקציה הגיעה ממנו.' : 'הכתובת של שרת הכיתה, כמו שהמורה נתן.'}>
              <input id="ai-url" name="server-url" className="input mono" dir="ltr" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…workers.dev" autoComplete="off" spellCheck={false} />
            </Field>
            <Button variant="secondary" className="btn-sm" onClick={test}>שמירה ובדיקה</Button>
          </details>
        </div>
      ) : (
        <div className="stack">
          <Field label="מפתח Claude (Anthropic API)" id="ai-key" hint="המפתח נשמר רק במכשיר הזה ונשלח ישירות ל־Anthropic. מתאים למי שמתרגל לבד. אל תשמרו מפתח במכשיר של תלמיד אחר.">
            <input id="ai-key" type="password" className="input mono" dir="ltr" value={key} onChange={(e) => setKey(e.target.value)} placeholder="sk-ant-…" autoComplete="off" />
          </Field>
          <Button variant="secondary" onClick={() => { setAI({ key: key.trim(), mode: 'personal' }); toast.success('המפתח נשמר במכשיר'); }}>שמירת המפתח</Button>
          {ai.key && <Button variant="ghost" className="btn-sm" onClick={() => { setAI({ key: '' }); setKey(''); }}>מחיקת המפתח מהמכשיר</Button>}
        </div>
      )}
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
      <ConfirmSheet open={danger === 'wipe'} onOpenChange={(o) => !o && setDanger(null)} title="למחוק הכול?" keep="לא למחוק"
        confirm="כן, למחוק הכול" onConfirm={() => { useApp.persist.clearStorage(); signOut(); }}>
        <p>כל מה שנשמר במכשיר הזה יימחק: השם, ההתקדמות, הטעויות שזוהו, תוכנית המבחן והמספרים. אי אפשר לבטל.</p>
      </ConfirmSheet>
      <ConfirmSheet open={danger === 'out'} onOpenChange={(o) => !o && setDanger(null)} title="להתנתק מהמכשיר?" keep="להישאר מחוברים"
        confirm="כן, להתנתק" onConfirm={() => signOut()}>
        <p>המכשיר יחזור למסך הפתיחה, וההתקדמות שנשמרה בו תימחק.</p>
      </ConfirmSheet>
      <p className="footnote">מדרגות{hasServer() ? '' : '. בלי שרת: ההתקדמות נשמרת רק במכשיר הזה.'}</p>
    </div>
  );
}
