import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, Footprints, Target, Users, Repeat, Hand, ClipboardList } from 'lucide-react';
import clsx from 'clsx';
import { toast } from 'sonner';
import { useApp } from '@/lib/store.js';
import { api, hasServer } from '@/lib/api.js';
import { Button, Field } from '@/components/ui.jsx';
import Mascot from '@/components/Mascot.jsx';
import { artUrl } from '@/components/PageHero.jsx';
import Stairs from '@/components/Stairs.jsx';
import { topicsFor, TOPICS } from '@/content/index.js';
import Manip from '@/components/manip/Manip.jsx';
import { KNOW } from '@/lib/placement.js';
import { Tex } from '@/components/MathText.jsx';
import { GOALS } from '@/lib/quests.js';

// A taste of each level, so the choice is about real maths and not a feeling: grade 7 (signed numbers,
// coordinates, angles) and grade 8 (linear functions, Pythagoras, statistics), from the first stair to the last.
const KNOW_SAMPLE = {
  7: ['-3 + 5', '(-2)\\cdot(-4)', 'A(-3,\\,2)', '\\alpha + 2\\alpha = 180^\\circ'],
  8: ['y = 2x + 1', '3^2 + 4^2', '\\bar{x}:\\ 4, 6, 8', 'm = \\tfrac{8-2}{3-1}'],
};

// The first screen shows the product itself: a real exercise from the first stair, to move before signing up.
// Nothing is saved; it is the same number line and the same מדי as in a lesson.
const DEMO = { form: 'manip', manip: { kind: 'numberline', min: -10, max: 10, from: -2, start: -2 }, answer: 3 };
function TryIt() {
  const [v, setV] = useState(DEMO.manip.start);
  const [touched, setTouched] = useState(false);
  const good = v === DEMO.answer;
  return (
    <section className={clsx('try-it', good && 'is-good')} aria-labelledby="try-title">
      <h2 id="try-title" className="try-title">{good ? 'בדיוק! ככה נראה תרגול במדרגות.' : 'נסו עכשיו: כמה זה?'}</h2>
      <div className="qdisplay try-display"><Tex tex="-2 + 5 = ?" display /></div>
      <Manip item={DEMO} value={v} onChange={(x) => { setV(x); setTouched(true); }} good={good} touched={touched} mood={good ? 'happy' : touched ? 'thinking' : 'idle'} />
    </section>
  );
}

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

const GRADE_NAME = { 7: 'כיתה ז׳', 8: 'כיתה ח׳' };

/** One answer on an onboarding screen: a big pressable row. */
function Option({ on, onPick, title, sub, glyph, aside, badge }) {
  return (
    <button type="button" role="radio" aria-checked={on} className={clsx('ob-opt', on && 'on')} onClick={onPick}>
      {glyph && <span className="ob-opt-glyph" aria-hidden="true">{glyph}</span>}
      <span className="ob-opt-text"><b>{title}{badge && <span className="ob-badge">{badge}</span>}</b>{sub && <span>{sub}</span>}</span>
      {aside && <span className="ob-opt-aside">{aside}</span>}
    </button>
  );
}

/**
 * First time on the app: a few short questions, one per screen, then a choice
 * between a placement test and starting from the first stair.
 */
function Onboarding({ onTeacher }) {
  const navigate = useNavigate();
  const setProfile = useApp((s) => s.setProfile);
  const setGoalXp = useApp((s) => s.setGoalXp);
  const server = hasServer();
  const steps = ['name', 'grade', 'know', 'goal', ...(server ? ['class'] : []), 'start'];
  const [i, setI] = useState(-1); // -1: the hello screen
  const [f, setF] = useState({ name: '', grade: null, know: null, goal: 20, code: '', pin: '', start: null });
  const [joined, setJoined] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const step = steps[i];
  const set = (patch) => { setError(''); setF((v) => ({ ...v, ...patch })); };
  const grade = joined?.grade || f.grade || '7';
  const recommended = (f.know ?? 1) >= 1 ? 'test' : 'scratch';
  const start = f.start || recommended;

  const finish = () => {
    setGoalXp(f.goal);
    setProfile({ role: 'student', name: joined?.name || f.name.trim(), grade, know: f.know ?? 1, ...(joined || {}) });
    // "to the first lesson" opens it: the first stair of the grade's first topic
    navigate(start === 'test' ? '/placement' : `/lesson/${topicsFor(grade)[0].id}/1?part=1`, { replace: true });
  };
  // each question of the first visit opens at its top
  useEffect(() => { window.scrollTo(0, 0); }, [i]);

  const go = async () => {
    if (step === 'name' && !f.name.trim()) { setError('כתבו את השם שלכם.'); return; }
    if (step === 'class' && f.code.trim() && !joined) {
      if (!/^\d{4}$/.test(f.pin)) { setError('בחרו קוד אישי של 4 ספרות.'); return; }
      setBusy(true);
      try {
        const c = await joinClass({ code: f.code, name: f.name.trim(), pin: f.pin });
        setJoined(c);
        toast.success(c.returning ? `ברוכים השבים לכיתה ${c.className}` : `הצטרפתם לכיתה ${c.className}`);
      } catch (err) { setError(err.message); return; } finally { setBusy(false); }
    }
    if (step === 'start') { finish(); return; }
    setError(''); setI(i + 1);
  };
  const back = () => { setError(''); setI(i - 1); };

  if (i < 0) {
    return (
      <div className="ob ob-hello">
        <p className="hello-brand"><span className="wordmark sm">מדרגות</span></p>
        <h1 className="hello-title">תרגול מתמטיקה לכיתות ז׳ וח׳, מדרגה אחרי מדרגה</h1>
        <p className="hello-fact">{TOPICS.length} נושאים, {TOPICS.reduce((n, t) => n + t.levels.length, 0)} מדרגות, כמה דקות ביום. מתחילים מהמדרגה שמתאימה לכם.</p>
        <TryIt />
        <div className="form-actions">
          <Button className="btn-lg" onClick={() => setI(0)}>מתחילים</Button>
          <Button variant="secondary" onClick={onTeacher}>אני מורה</Button>
        </div>
      </div>
    );
  }

  const can = { name: !!f.name.trim(), grade: !!f.grade, know: f.know != null, goal: !!f.goal, class: true, start: true }[step];
  const ask = {
    name: 'היי, אני מדי! איך קוראים לך?',
    grade: `נעים מאוד, ${f.name.trim()}! באיזו כיתה אתם?`,
    know: `כמה מהחומר של ${GRADE_NAME[grade]} כבר מוכר לכם?`,
    goal: 'כמה זמן ביום מתאים לכם?',
    class: 'יש לכם קוד כיתה מהמורה?',
    start: 'מאיפה מתחילים?',
  }[step];
  const cta = step === 'class' ? (joined ? 'המשך' : f.code.trim() ? 'הצטרפות לכיתה' : 'המשך בלי קוד') : step === 'start' ? (start === 'test' ? 'לבדיקת הרמה' : 'לשיעור הראשון') : 'המשך';

  return (
    <form className="ob" onSubmit={(e) => { e.preventDefault(); if (can && !busy) go(); }} noValidate>
      <header className="ob-top">
        <button type="button" className="icon-btn" onClick={back} aria-label="חזרה"><ArrowRight size={26} aria-hidden="true" /></button>
        <div className="ob-bar" role="progressbar" aria-label="השאלות הראשונות" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={i + 1}>
          <i style={{ width: `${((i + 1) / steps.length) * 100}%` }} />
        </div>
      </header>
      <main className="ob-main">
        <div className="ob-ask">
          <Mascot mood={step === 'start' ? 'excited' : 'idle'} size={84} className="ob-mascot" />
          <p className="ob-bubble" id="ob-q">{ask}</p>
        </div>

        {step === 'name' && (
          <div className="ob-field">
            <label htmlFor="w-name" className="visually-hidden">השם שלכם</label>
            <input id="w-name" className="input input-lg" value={f.name} onChange={(e) => set({ name: e.target.value })} autoComplete="given-name" maxLength={30} placeholder="שם פרטי" autoFocus enterKeyHint="next" />
          </div>
        )}
        {step === 'grade' && (
          <div className="ob-opts" role="radiogroup" aria-labelledby="ob-q">
            {['7', '8'].map((g) => (
              <Option key={g} on={f.grade === g} onPick={() => set({ grade: g, start: null })} title={GRADE_NAME[g]} sub={topicsFor(g).map((t) => t.title).join(', ')}
                glyph={<span className="ob-grade">{g === '7' ? 'ז׳' : 'ח׳'}</span>} />
            ))}
          </div>
        )}
        {step === 'know' && (
          <div className="ob-opts" role="radiogroup" aria-labelledby="ob-q">
            {KNOW.map((k) => (
              <Option key={k.id} on={f.know === k.id} onPick={() => set({ know: k.id, start: null })} title={k.title} sub={k.sub}
                glyph={<Stairs steps={4} done={k.id + 1} />}
                aside={<span className="ob-sample" title="תרגיל לדוגמה ברמה הזאת"><Tex tex={(KNOW_SAMPLE[grade] || KNOW_SAMPLE[7])[k.id]} /></span>} />
            ))}
          </div>
        )}
        {step === 'goal' && (
          <div className="ob-opts" role="radiogroup" aria-labelledby="ob-q">
            {GOALS.map((g) => (
              <Option key={g.xp} on={f.goal === g.xp} onPick={() => set({ goal: g.xp })} title={`${g.mins} דקות ביום`} sub={g.label}
                aside={<bdi dir="ltr">{g.xp} XP</bdi>} badge={g.xp === 20 ? 'הכי נפוץ' : null} />
            ))}
            <p className="ob-note">אפשר לשנות את זה בכל יום במסך המשימות.</p>
          </div>
        )}
        {step === 'class' && (
          <div className="ob-field">
            {joined ? (
              <p className="ob-joined" role="status"><Check size={20} strokeWidth={3} aria-hidden="true" />אתם בכיתה {joined.className}{joined.teacherName ? ` של ${joined.teacherName}` : ''}.</p>
            ) : (
              <>
                <p className="ob-note">עם קוד, המורה יראה את ההתקדמות ויוכל לעזור כשמשהו לא ברור. אפשר להמשיך גם בלי, ולהצטרף אחר כך מהמסך "אני".</p>
                <Field label="קוד כיתה" id="w-code">
                  <input id="w-code" className="input mono" dir="ltr" value={f.code} onChange={(e) => set({ code: e.target.value.toUpperCase() })} maxLength={6} autoCapitalize="characters" autoComplete="off" placeholder="למשל K7Q2MD" />
                </Field>
                {f.code.trim() && (
                  <Field label="קוד אישי של 4 ספרות" id="w-pin" hint="בפעם הראשונה בוחרים קוד. בפעמים הבאות מקלידים את אותו קוד.">
                    <input id="w-pin" className="input mono" dir="ltr" inputMode="numeric" pattern="\d{4}" maxLength={4} value={f.pin} onChange={(e) => set({ pin: e.target.value.replace(/\D/g, '') })} autoComplete="off" />
                  </Field>
                )}
              </>
            )}
          </div>
        )}
        {step === 'start' && (
          <div className="ob-opts" role="radiogroup" aria-labelledby="ob-q">
            <Option on={start === 'test'} onPick={() => set({ start: 'test' })} title="בדיקת רמה קצרה" badge={recommended === 'test' ? 'מומלץ' : null}
              sub="עד 9 שאלות, בערך 5 דקות. כל נושא יתחיל מהמדרגה שלכם." glyph={<Target size={30} strokeWidth={2.4} />} />
            <Option on={start === 'scratch'} onPick={() => set({ start: 'scratch' })} title="מתחילים מההתחלה" badge={recommended === 'scratch' ? 'מומלץ' : null}
              sub="מהמדרגה הראשונה בכל נושא. אפשר לעשות את הבדיקה אחר כך." glyph={<Footprints size={30} strokeWidth={2.4} />} />
          </div>
        )}
        {error && <p className="form-error" role="alert">{error}</p>}
      </main>
      <footer className="ob-foot">
        <Button type="submit" className="btn-block btn-lg" disabled={!can || busy}>{busy ? 'מצטרפים…' : cta}</Button>
      </footer>
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
    // This copy of the app runs without a server (a demo or a student-only site). Say what the teacher view gives,
    // and how a school turns it on, instead of a dead end.
    return (
      <div className="teacher-off">
        <img src={artUrl('teacher')} alt="" className="teacher-off-art" />
        <h1 className="h-page">לוח המורה עובד עם שרת הכיתה</h1>
        <p className="lead">הכתובת הזו היא גרסת תרגול לתלמידים, בלי שרת. לוח המורה צריך שרת קטן של הכיתה (Cloudflare, בחינם), כדי שהתלמידים יוכלו להצטרף בקוד והמורה יראה את ההתקדמות.</p>
        <ul className="teacher-off-list">
          <li><Users size={20} aria-hidden="true" /><span><b>מי תרגל היום ובשבוע</b>וכמה תשובות נכונות בניסיון ראשון.</span></li>
          <li><Repeat size={20} aria-hidden="true" /><span><b>טעויות שחוזרות בכיתה</b>לפי נושא, עם שמות התלמידים.</span></li>
          <li><Hand size={20} aria-hidden="true" /><span><b>בקשות עזרה</b>עם התרגיל ודף המחברת של התלמיד.</span></li>
          <li><ClipboardList size={20} aria-hidden="true" /><span><b>מבחנים שנבדקו</b>ריבוע לכל שאלה, ונושאים לחיזוק.</span></li>
        </ul>
        <h2 className="h-section">איך מפעילים</h2>
        <ol className="teacher-off-steps">
          <li>פותחים חשבון חינמי ב־Cloudflare.</li>
          <li>במחשב, בתיקייה <span dir="ltr">madregot</span>, מריצים את <span dir="ltr">setup.ps1</span>. הוא יוצר את מסד הנתונים ומעלה את האפליקציה עם השרת.</li>
          <li>נכנסים מהכתובת שהסקריפט מדפיס, בוחרים "אני מורה" ופותחים כיתה. התלמידים מצטרפים עם הקוד.</li>
        </ol>
        <p className="muted">הפרטים המלאים, כולל חיבור עוזר ה־AI, נמצאים בקובץ README שבתיקייה.</p>
        <Button className="btn-block" variant="secondary" onClick={onBack}>חזרה</Button>
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
  const [teacher, setTeacher] = useState(false);
  if (!teacher) return <Onboarding onTeacher={() => setTeacher(true)} />;
  return <div className="welcome"><TeacherStart onBack={() => setTeacher(false)} /></div>;
}
