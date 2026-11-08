import MyNumbers from '@/components/learn/MyNumbers.jsx';
import { useState } from 'react';
import clsx from 'clsx';
import { toast } from 'sonner';
import { useApp } from '@/lib/store.js';
import { api, hasServer } from '@/lib/api.js';
import { Box, Button, Field } from '@/components/ui.jsx';
import { GradeSwitch, joinClass } from './Welcome.jsx';
import PageHero from '@/components/PageHero.jsx';
import { useLocation } from 'react-router-dom';
import { useEffect as useMeEffect } from 'react';
import Achievements from '@/components/Achievements.jsx';
import ProgressSummary from '@/components/learn/ProgressSummary.jsx';

function ClassSection() {
  const { profile, setProfile, leaveClass } = useApp();
  const [code, setCode] = useState(''); const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [confirmLeave, setConfirmLeave] = useState(false);

  if (profile.classCode && profile.token) {
    return (
      <section className="section" aria-labelledby="cls-title">
        <h2 id="cls-title" className="h-section">הכיתה שלי</h2>
        <p>כיתה <b>{profile.className}</b> <span className="muted mono" dir="ltr">({profile.classCode})</span></p>
        <p className="muted">ההתקדמות ובקשות העזרה שלכם נשלחות למורה.</p>
      </section>
    );
  }
  // Without the class server there is nothing to join: say so, instead of a form that can only fail.
  if (!hasServer()) {
    return (
      <section className="section" aria-labelledby="cls-title">
        <h2 id="cls-title" className="h-section">הצטרפות לכיתה</h2>
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
    <section className="section" aria-labelledby="cls-title">
      <h2 id="cls-title" className="h-section">{profile.classCode ? 'התחברות מחדש לכיתה' : 'הצטרפות לכיתה'}</h2>
      <form className="stack" onSubmit={join} noValidate>
        {!profile.classCode && (
          <Field label="קוד כיתה" id="me-code"><input id="me-code" className="input mono" dir="ltr" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={6} /></Field>
        )}
        <Field label="קוד אישי של 4 ספרות" id="me-pin" hint="אם זו הפעם הראשונה, בחרו קוד ותזכרו אותו.">
          <input id="me-pin" className="input mono" dir="ltr" inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
        </Field>
        {error && <p className="form-error" role="alert">{error}</p>}
        <Button type="submit" disabled={busy}>{busy ? 'מצטרפים…' : 'הצטרפות'}</Button>
        {profile.classCode && !confirmLeave && <Button variant="ghost" className="btn-sm" onClick={() => setConfirmLeave(true)}>לא רוצים כיתה</Button>}
        {confirmLeave && <Button variant="ghost" className="btn-sm" onClick={() => { leaveClass(); setConfirmLeave(false); }}>אישור: להמשיך לבד</Button>}
      </form>
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
      <section className="section" aria-labelledby="ai-title">
        <h2 id="ai-title" className="h-section">העוזר</h2>
        <p>העוזר מחובר דרך הכיתה{profile.teacherName ? ` של ${profile.teacherName}` : ''}. אין צורך להגדיר כלום.</p>
        <Button variant="ghost" className="btn-sm" onClick={test}>בדיקת חיבור</Button>
        {status && <p className="muted" role="status">{status}</p>}
      </section>
    );
  }
  return (
    <section className="section" aria-labelledby="ai-title">
      <h2 id="ai-title" className="h-section">חיבור העוזר</h2>
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
    <section className="section" aria-labelledby="snd-title">
      <h2 id="snd-title" className="h-section">צלילים ורטט</h2>
      <div className="segmented" role="radiogroup" aria-labelledby="snd-title">
        <button type="button" role="radio" aria-checked={sound} className={clsx('seg', sound && 'on')} onClick={() => setSound(true)}>פועלים</button>
        <button type="button" role="radio" aria-checked={!sound} className={clsx('seg', !sound && 'on')} onClick={() => setSound(false)}>כבויים</button>
      </div>
      <p className="field-hint">צליל קצר אחרי כל תשובה ובסוף שיעור. בטלפון אנדרואיד יש גם רטט קל אחרי טעות.</p>
    </section>
  );
}

export default function Me() {
  const { profile, patchProfile, resetProgress, signOut } = useApp();
  const { state: nav } = useLocation();
  useMeEffect(() => { if (nav?.focus === 'ai') document.getElementById('ai-title')?.scrollIntoView({ block: 'start' }); }, [nav]);
  const [name, setName] = useState(profile.name);
  const [danger, setDanger] = useState(null);
  return (
    <div className="page wide me-page">
      <PageHero tone="brand" title={profile.name || 'אני'} sub={profile.className ? `כיתה ${profile.className}` : profile.grade === '8' ? 'כיתה ח׳' : 'כיתה ז׳'} mood="happy" />
      <ProgressSummary />
      <Achievements />
      <div className="me-settings">
      <section className="section" aria-labelledby="prof-title">
        <h2 id="prof-title" className="h-section">הפרטים שלי</h2>
        <Field label="שם" id="me-name">
          <input id="me-name" className="input" value={name} maxLength={30} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && patchProfile({ name: name.trim() })} disabled={!!profile.token} />
        </Field>
        {!profile.token && (
          <div className="field"><span className="field-label" id="me-grade">כיתה</span><GradeSwitch value={profile.grade || '7'} onChange={(g) => patchProfile({ grade: g })} id="me-grade" /></div>
        )}
      </section>
      <ClassSection />
      <AISection />
      <SoundSetting />
      <MyNumbers />
      <section className="section danger-zone" aria-labelledby="dz-title">
        <h2 id="dz-title" className="h-section">אזור מחיקה</h2>
        {danger === 'reset' ? (
          <Box tone="attention" title="בטוחים?">
            <p>כל המדרגות, הנקודות וההיסטוריה במכשיר הזה יימחקו.</p>
            <div className="form-actions row">
              <Button variant="danger" onClick={() => { resetProgress(); setDanger(null); toast('ההתקדמות אופסה'); }}>כן, לאפס</Button>
              <Button variant="ghost" onClick={() => setDanger(null)}>ביטול</Button>
            </div>
          </Box>
        ) : danger === 'out' ? (
          <Box tone="attention" title="בטוחים?">
            <p>המכשיר יחזור למסך הפתיחה, וההתקדמות שנשמרה בו תימחק.</p>
            <div className="form-actions row">
              <Button variant="danger" onClick={() => signOut()}>כן, להתנתק</Button>
              <Button variant="ghost" onClick={() => setDanger(null)}>ביטול</Button>
            </div>
          </Box>
        ) : danger === 'wipe' ? (
          <Box tone="attention" title="למחוק הכול?">
            <p>כל מה שנשמר במכשיר הזה יימחק: השם, ההתקדמות, הטעויות שזוהו, תוכנית המבחן והמספרים. אי אפשר לבטל.</p>
            <div className="form-actions row">
              <Button variant="danger" onClick={() => { useApp.persist.clearStorage(); signOut(); }}>כן, למחוק הכול</Button>
              <Button variant="ghost" onClick={() => setDanger(null)}>ביטול</Button>
            </div>
          </Box>
        ) : (
          <div className="form-actions row">
            <Button variant="danger-outline" className="btn-sm" onClick={() => setDanger('reset')}>איפוס ההתקדמות</Button>
            <Button variant="danger-outline" className="btn-sm" onClick={() => setDanger('wipe')}>מחיקת כל הנתונים</Button>
            <Button variant="danger-outline" className="btn-sm" onClick={() => setDanger('out')}>התנתקות מהמכשיר</Button>
          </div>
        )}
      </section>
      </div>
      <p className="footnote">מדרגות{hasServer() ? '' : '. בלי שרת: ההתקדמות נשמרת רק במכשיר הזה.'}</p>
    </div>
  );
}
