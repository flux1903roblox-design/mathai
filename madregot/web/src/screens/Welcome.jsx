import { useState } from 'react';
import clsx from 'clsx';
import { toast } from 'sonner';
import { useApp } from '@/lib/store.js';
import { api, hasServer } from '@/lib/api.js';
import { Button, Field } from '@/components/ui.jsx';
import StepsMark from '@/components/StepsMark.jsx';

export function GradeSwitch({ value, onChange, id }) {
  return (
    <div className="segmented" role="radiogroup" aria-labelledby={id}>
      {[['7', 'כיתה ז׳'], ['8', 'כיתה ח׳']].map(([v, label]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} className={clsx('seg', value === v && 'on')} onClick={() => onChange(v)}>{label}</button>
      ))}
    </div>
  );
}

export async function joinClass({ code, name, pin }) {
  const r = await api(`/api/classes/${code.trim().toUpperCase()}/join`, { method: 'POST', body: { name, pin } });
  return { classCode: r.classCode, className: r.className, grade: r.grade, token: r.token, studentId: r.studentId, name: r.name, returning: r.returning };
}

function Student({ onBack }) {
  const setProfile = useApp((s) => s.setProfile);
  const [name, setName] = useState('');
  const [grade, setGrade] = useState('7');
  const [code, setCode] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const server = hasServer();

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('כתבו את השם שלכם.'); return; }
    if (code.trim()) {
      setBusy(true);
      try {
        const c = await joinClass({ code, name: name.trim(), pin });
        setProfile({ role: 'student', ...c });
        toast.success(c.returning ? `ברוכים השבים לכיתה ${c.className}` : `הצטרפתם לכיתה ${c.className}`);
      } catch (err) { setError(err.message); } finally { setBusy(false); }
      return;
    }
    setProfile({ role: 'student', name: name.trim(), grade });
  };

  return (
    <form className="welcome-form" onSubmit={submit} noValidate>
      <h1 className="h-page">נעים להכיר</h1>
      <Field label="איך קוראים לך?" id="w-name">
        <input id="w-name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" maxLength={30} placeholder="שם פרטי" />
      </Field>
      {!code.trim() && (
        <div className="field">
          <span className="field-label" id="w-grade">באיזו כיתה?</span>
          <GradeSwitch value={grade} onChange={setGrade} id="w-grade" />
        </div>
      )}
      {server && (
        <fieldset className="fieldset">
          <legend>הצטרפות לכיתה (לא חובה)</legend>
          <p className="field-hint">אם המורה נתן לכם קוד כיתה, הוא יראה את ההתקדמות שלכם ואת הבקשות לעזרה.</p>
          <Field label="קוד כיתה" id="w-code">
            <input id="w-code" className="input mono" dir="ltr" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={6} autoCapitalize="characters" autoComplete="off" placeholder="למשל K7Q2MD" />
          </Field>
          {code.trim() && (
            <Field label="קוד אישי של 4 ספרות" id="w-pin" hint="בפעם הראשונה בוחרים קוד. בפעמים הבאות מקלידים את אותו קוד.">
              <input id="w-pin" className="input mono" dir="ltr" inputMode="numeric" pattern="\d{4}" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} autoComplete="off" />
            </Field>
          )}
        </fieldset>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions">
        <Button type="submit" disabled={busy}>{busy ? 'מצטרפים…' : 'מתחילים'}</Button>
        <Button variant="ghost" onClick={onBack}>חזרה</Button>
      </div>
    </form>
  );
}

function TeacherStart({ onBack }) {
  const setProfile = useApp((s) => s.setProfile);
  const [mode, setMode] = useState('new');
  const [f, setF] = useState({ teacherName: '', className: '', grade: '7', code: '', key: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  if (!hasServer()) {
    return (
      <div className="welcome-form">
        <h1 className="h-page">לוח המורה צריך שרת</h1>
        <p className="lead">כדי לראות את התלמידים, האפליקציה צריכה להיות מחוברת לשרת של הכיתה. ההוראות להקמת השרת נמצאות בקובץ README שבתיקייה madregot.</p>
        <Button variant="ghost" onClick={onBack}>חזרה</Button>
      </div>
    );
  }

  const submit = async (e) => {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      if (mode === 'new') {
        if (!f.teacherName.trim() || !f.className.trim()) throw new Error('מלאו את השם שלכם ואת שם הכיתה.');
        const r = await api('/api/classes', { method: 'POST', body: { teacherName: f.teacherName, className: f.className, grade: f.grade } });
        const cls = { code: r.code, key: r.teacherKey, className: r.className, grade: r.grade, fresh: true };
        setProfile({ role: 'teacher', name: r.teacherName, classes: [cls], active: cls.code });
      } else {
        const code = f.code.trim().toUpperCase();
        const d = await api('/api/teacher/dashboard', { headers: { 'X-Class-Code': code, 'X-Teacher-Key': f.key.trim() } });
        const cls = { code, key: f.key.trim(), className: d.class.name, grade: d.class.grade };
        setProfile({ role: 'teacher', name: d.class.teacherName, classes: [cls], active: code });
      }
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <form className="welcome-form" onSubmit={submit} noValidate>
      <h1 className="h-page">לוח המורה</h1>
      <div className="segmented" role="radiogroup" aria-label="כיתה חדשה או קיימת">
        <button type="button" role="radio" aria-checked={mode === 'new'} className={clsx('seg', mode === 'new' && 'on')} onClick={() => setMode('new')}>כיתה חדשה</button>
        <button type="button" role="radio" aria-checked={mode === 'open'} className={clsx('seg', mode === 'open' && 'on')} onClick={() => setMode('open')}>כבר יש לי כיתה</button>
      </div>
      {mode === 'new' ? (
        <>
          <Field label="השם שלכם (כך התלמידים יראו אותו)" id="t-name"><input id="t-name" className="input" value={f.teacherName} onChange={set('teacherName')} maxLength={30} placeholder="למשל: רונית כהן" /></Field>
          <Field label="שם הכיתה" id="t-class"><input id="t-class" className="input" value={f.className} onChange={set('className')} maxLength={30} placeholder="למשל: ז׳3" /></Field>
          <div className="field"><span className="field-label" id="t-grade">שכבה</span><GradeSwitch value={f.grade} onChange={(g) => setF({ ...f, grade: g })} id="t-grade" /></div>
        </>
      ) : (
        <>
          <Field label="קוד כיתה" id="t-code"><input id="t-code" className="input mono" dir="ltr" value={f.code} onChange={set('code')} maxLength={6} /></Field>
          <Field label="מפתח מורה" id="t-key" hint="קיבלתם אותו כשפתחתם את הכיתה."><input id="t-key" className="input mono" dir="ltr" value={f.key} onChange={set('key')} autoComplete="off" /></Field>
        </>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions">
        <Button type="submit" disabled={busy}>{busy ? 'רגע…' : mode === 'new' ? 'פתיחת הכיתה' : 'כניסה ללוח'}</Button>
        <Button variant="ghost" onClick={onBack}>חזרה</Button>
      </div>
    </form>
  );
}

export default function Welcome() {
  const [step, setStep] = useState('choose');
  return (
    <div className="welcome">
      {step === 'choose' && (
        <div className="welcome-intro">
          <StepsMark />
          <h1 className="wordmark">מדרגות</h1>
          <p className="lead">תרגול מתמטיקה יומי לכיתות ז׳ וח׳. כל תרגיל מעלה אתכם מדרגה, ועוזר AI מסביר כל טעות.</p>
          <div className="form-actions">
            <Button onClick={() => setStep('student')}>אני תלמיד או תלמידה</Button>
            <Button variant="secondary" onClick={() => setStep('teacher')}>אני מורה</Button>
          </div>
        </div>
      )}
      {step === 'student' && <Student onBack={() => setStep('choose')} />}
      {step === 'teacher' && <TeacherStart onBack={() => setStep('choose')} />}
    </div>
  );
}
