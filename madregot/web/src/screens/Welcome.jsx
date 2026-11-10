import { hasContent } from '@/learn/content/index.ts';
import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Check, Footprints, Target } from 'lucide-react';
import clsx from 'clsx';
import { toast } from 'sonner';
import { useApp, STORE_KEY } from '@/lib/store.js';
import { api, hasServer } from '@/lib/api.js';
import { useAIStatus, refreshStatus } from '@/lib/account.js';
import { Button, Field } from '@/components/ui.jsx';
import Mascot from '@/components/Mascot.jsx';
import { LoadingState } from '@/components/Screen.jsx';
import Stairs from '@/components/Stairs.jsx';
import { topicsFor } from '@/content/index.js';
import { KNOW, placementMax } from '@/lib/placement.js';
import { Tex } from '@/components/MathText.jsx';
import { GOALS } from '@/lib/quests.js';
import FileRestore from '@/components/durable/FileRestore.jsx';
import RestorePreview from '@/components/durable/RestorePreview.jsx';

/** The grade's topics in one short line: up to three names, then how many more (it stays on two lines at 320px). */
const topicLine = (g) => { const ts = topicsFor(g).map((t) => t.title); return ts.length <= 3 ? ts.join(', ') : `${ts.slice(0, 3).join(', ')} ועוד ${ts.length - 3}`; };

// A taste of each level, so the choice is about real maths and not a feeling: grade 7 (signed numbers,
// coordinates, angles) and grade 8 (linear functions, Pythagoras, statistics), from the first stair to the last.
const KNOW_SAMPLE = {
  7: ['-3 + 5', '(-2)\\cdot(-4)', 'A(-3,\\,2)', '\\alpha + 2\\alpha = 180^\\circ'],
  8: ['y = 2x + 1', '3^2 + 4^2', '\\bar{x}:\\ 4, 6, 8', 'm = \\tfrac{8-2}{3-1}'],
};

export { GradeSwitch } from '@/components/GradeSwitch.jsx';

export async function joinClass({ code, name, pin }) {
  const r = await api(`/api/classes/${code.trim().toUpperCase()}/join`, { method: 'POST', body: { name, pin } });
  return { classCode: r.classCode, className: r.className, grade: r.grade, token: r.token, studentId: r.studentId, name: r.name, returning: r.returning };
}

const GRADE_NAME = { 7: 'כיתה ז׳', 8: 'כיתה ח׳' };

/**
 * Under the PIN field once a class code is typed (trust spec TRUST-12 §3). The first to join a class takes a name, so
 * the step says which name the teacher will see, and how to tell two children with the same name apart.
 */
export const nameClaimHint = (name) => `המורה יראה את השם ${String(name || '').replace(/\s+/g, ' ').trim().slice(0, 30)}. אם יש בכיתה עוד מישהו עם אותו שם, חזרו אחורה והוסיפו אות משם המשפחה, למשל: נועה כ.`;

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
function Onboarding({ onTeacher, onRestore }) {
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
    // from the first stair: it starts by understanding (the stair's first teaching stage), not with exercises
    const first = topicsFor(grade)[0].id;
    navigate(start === 'test' ? '/placement' : hasContent(`${first}:1`) ? `/learn/${first}/1/A` : `/lesson/${first}/1?part=1`, { replace: true });
  };
  // each question of the first visit opens at its top
  useEffect(() => { window.scrollTo(0, 0); }, [i]);
  // The parents' links (and the cancel link) are for a server that sells the tutor: they show once the server says
  // the switch is on, or when a parent already signed in on this device. With AI_PAYWALL off there is nothing to
  // join or cancel.
  const status = useAIStatus((x) => x.status);
  useEffect(() => { if (server && !useAIStatus.getState().status) refreshStatus(); }, [server]);
  const parentHere = (() => { try { return !!(localStorage.getItem(`${STORE_KEY}-parent`) || sessionStorage.getItem(`${STORE_KEY}-parent`)); } catch { return false; } })();
  const billing = server && (status?.paywall === true || parentHere);

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
    // the first screen, laid out like Duolingo's: the character large in the middle, the name and one line under
    // him, and the two ways in as full-width buttons pinned to the bottom
    return (
      <div className="ob ob-hello hello-duo">
        <main className="hello-center" data-region="content">
          <Mascot mood="excited" size={168} className="hello-madi" />
          <p className="hello-brand"><span className="wordmark">מדרגות</span></p>
          <h1 className="hello-title">מתמטיקה שמבינים.<br />ומתקדמים.</h1>
          <p className="hello-fact">כל יום מדרגה אחת קדימה.</p>
        </main>
        <footer className="hello-foot" data-region="footer">
          <Button className="btn-block btn-lg" onClick={() => setI(0)}>מתחילים</Button>
          <Button variant="secondary" className="btn-block" onClick={onTeacher}>אני מורה</Button>
          {/* a backup file works with no server and no account, so this is on every build */}
          <Button variant="ghost" className="btn-block hello-restore" onClick={onRestore}>יש לי קובץ גיבוי</Button>
          {/* the site's front page carries the dedicated cancel link and the parents' page while the tutor is sold,
              and the legal pages (with a server) */}
          {server && (
            <nav className="hello-legal" aria-label={billing ? 'להורים ומידע משפטי' : 'מידע משפטי'}>
              {billing && <Link to="/parents">להורים</Link>}
              {billing && <Link to="/cancel">ביטול מנוי</Link>}
              <Link to="/terms">תקנון</Link>
              <Link to="/privacy">פרטיות</Link>
              <Link to="/accessibility">נגישות</Link>
            </nav>
          )}
        </footer>
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
      <header className="ob-top" data-region="header">
        <button type="button" className="icon-btn" onClick={back} aria-label="חזרה"><ArrowRight size={26} aria-hidden="true" /></button>
        <div className="ob-bar" role="progressbar" aria-label="השאלות הראשונות" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={i + 1}>
          <i style={{ width: `${((i + 1) / steps.length) * 100}%` }} />
        </div>
      </header>
      <main className="ob-main" data-region="content">
        <div className="ob-ask" data-region="question">
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
              <Option key={g} on={f.grade === g} onPick={() => set({ grade: g, start: null })} title={GRADE_NAME[g]} sub={topicLine(g)}
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
                  <>
                    <Field label="קוד אישי של 4 ספרות" id="w-pin" hint="בפעם הראשונה בוחרים קוד. בפעמים הבאות מקלידים את אותו קוד.">
                      <input id="w-pin" className="input mono" dir="ltr" inputMode="numeric" pattern="\d{4}" maxLength={4} value={f.pin} onChange={(e) => set({ pin: e.target.value.replace(/\D/g, '') })} autoComplete="off" />
                    </Field>
                    {/* the first to join takes a name (trust spec TRUST-12 §3): say which name the teacher will see */}
                    <p className="ob-note ob-name-claim">{nameClaimHint(f.name)}</p>
                  </>
                )}
              </>
            )}
          </div>
        )}
        {step === 'start' && (
          <div className="ob-opts" role="radiogroup" aria-labelledby="ob-q">
            <Option on={start === 'test'} onPick={() => set({ start: 'test' })} title="בדיקת רמה קצרה" badge={recommended === 'test' ? 'מומלץ' : null}
              sub={`עד ${placementMax(grade)} שאלות, ולרוב פחות. כל נושא יתחיל מהמדרגה שלכם.`} glyph={<Target size={30} strokeWidth={2.4} />} />
            <Option on={start === 'scratch'} onPick={() => set({ start: 'scratch' })} title="מתחילים מההתחלה" badge={recommended === 'scratch' ? 'מומלץ' : null}
              sub="מהמדרגה הראשונה בכל נושא. אפשר לעשות את הבדיקה אחר כך." glyph={<Footprints size={30} strokeWidth={2.4} />} />
          </div>
        )}
        {error && <p className="form-error" role="alert">{error}</p>}
      </main>
      <footer className="ob-foot" data-region="footer">
        <Button type="submit" className="btn-block btn-lg" disabled={!can || busy}>{busy ? 'מצטרפים…' : cta}</Button>
      </footer>
    </form>
  );
}

// The teacher's way in (sign-in by email, the classes on any device, the key flow, and the public site's page) is its
// own screen: screens/teacher/TeacherStart.jsx, loaded when a teacher asks for it.
const TeacherStart = lazy(() => import('./teacher/TeacherStart.jsx'));

/**
 * "יש לי קובץ גיבוי" on a new device (DURABLE-4): choose the file, see what it holds, continue from it. Once the
 * progress is in, the app shows the map (the profile came with it). It needs no server.
 */
function RestoreStart({ onBack }) {
  const [found, setFound] = useState(null);
  useEffect(() => { window.scrollTo(0, 0); }, [found]);
  return (
    <div className="ob ob-flow restore-start">
      <header className="ob-top" data-region="header">
        <button type="button" className="icon-btn" onClick={found ? () => setFound(null) : onBack} aria-label="חזרה"><ArrowRight size={26} aria-hidden="true" /></button>
        <span className="ob-top-title">שחזור מקובץ</span>
      </header>
      <main className="ob-main" data-region="content">
        {found ? (
          <RestorePreview backup={found} heading="h1" onCancel={() => setFound(null)} />
        ) : (
          <>
            <div className="ob-ask" data-region="question">
              <div className="ob-bubble"><h1 className="ob-bubble-title">בחרו את קובץ הגיבוי ששמרתם.</h1></div>
            </div>
            <p className="restore-hint">שם הקובץ מתחיל ב־<bdi>madregot</bdi>.</p>
            <FileRestore onLoaded={setFound} />
          </>
        )}
      </main>
    </div>
  );
}

/**
 * The first screen with no profile: the student's onboarding, the teacher's way in, or a restore from a backup file. A
 * link to the app with ?start=teacher (the public site's "ללוח המורה") or ?role=teacher (the landing pages) opens the
 * teacher's way in.
 */
export default function Welcome() {
  const [params, setParams] = useSearchParams();
  const asked = params.get('start') === 'teacher' || params.get('role') === 'teacher';
  const [mode, setMode] = useState(asked ? 'teacher' : null); // null: the first visit; 'teacher'; 'restore'
  const back = () => { setMode(null); if (asked) setParams({}, { replace: true }); };
  if (mode === 'restore') return <RestoreStart onBack={() => setMode(null)} />;
  if (mode !== 'teacher' && !asked) return <Onboarding onTeacher={() => setMode('teacher')} onRestore={() => setMode('restore')} />;
  return <Suspense fallback={<LoadingState />}><TeacherStart onBack={back} /></Suspense>;
}
