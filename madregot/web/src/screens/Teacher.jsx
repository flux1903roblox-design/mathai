// The teacher's board: the header, the overview tiles, the switch between the views, the data loading, adding a class
// and the first look at a new class. Each view is its own file in screens/teacher/.
import { Link, useSearchParams, useLocation } from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';
import clsx from 'clsx';
import { toast } from 'sonner';
import { Copy, RefreshCw, Hand, LogOut, Plus, Users, CalendarDays, Target, Settings as SettingsIcon, BookOpen, Sparkles } from 'lucide-react';
import { useApp } from '@/lib/store.js';
import { api } from '@/lib/api.js';
import { teacherApi, useEmailSignIn, offerBind } from '@/lib/teacher.js';
import { useParent, accountCall, signOut as endSession } from '@/lib/parent.js';
import { Button, Field, Sheet } from '@/components/ui.jsx';
import { Stat } from '@/components/ds.jsx';
import { EmptyState, ConfirmSheet, LoadingState } from '@/components/Screen.jsx';
import { GradeSwitch } from '@/components/GradeSwitch.jsx';
import { copy, pct } from './teacher/common.jsx';
import { FreshClass, BindCard, SignInAgain, MoreClasses } from './teacher/ClassAccount.jsx';
import TomorrowTab from './teacher/TomorrowTab.jsx';
import StudentsTab from './teacher/StudentsTab.jsx';
import ExamsTab from './teacher/ExamsTab.jsx';
import HelpTab from './teacher/HelpTab.jsx';
import { takePendingToast } from './teacher/DeleteClass.jsx';

function AddClass({ open, onClose }) {
  const { profile, setProfile } = useApp();
  const [f, setF] = useState({ className: '', grade: '7' }); const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!f.className.trim()) return; setBusy(true);
    try {
      const body = { teacherName: profile.name, className: f.className, grade: f.grade };
      // signed in: the new class is bound to the email at once (owned), like the first one
      const session = useParent.getState().session;
      const r = session ? await accountCall('/api/classes', { method: 'POST', body }) : await api('/api/classes', { method: 'POST', body });
      const cls = { code: r.code, key: r.owned && session?.shared ? null : r.teacherKey, className: r.className, grade: r.grade, fresh: true, ...(r.owned ? { owned: true } : {}) };
      setProfile({ ...profile, classes: [...profile.classes, cls], active: cls.code, grade: cls.grade }); setF({ className: '', grade: '7' }); onClose();
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };
  // a sheet like every other one: the title and the way out, the fields, its one action pinned at the bottom
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title="כיתה נוספת"
      footer={<Button className="btn-block btn-lg" onClick={submit} disabled={busy || !f.className.trim()}>{busy ? 'רגע…' : 'פתיחת הכיתה'}</Button>}>
      <form className="add-class ob-field" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <Field label="שם הכיתה החדשה" id="ac-name"><input id="ac-name" className="input input-lg" value={f.className} onChange={(e) => setF({ ...f, className: e.target.value })} maxLength={30} placeholder="למשל: ח׳2" /></Field>
        <div className="field"><span className="field-label" id="ac-grade">שכבה</span><GradeSwitch value={f.grade} onChange={(g) => setF({ ...f, grade: g })} id="ac-grade" /></div>
      </form>
    </Sheet>
  );
}

export default function Teacher() {
  const { profile, setProfile, setActiveClass, signOut } = useApp();
  const cls = profile.classes.find((c) => c.code === profile.active) || profile.classes[0];
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const session = useParent((s) => s.session);
  const emailOn = useEmailSignIn();
  const [moreOpen, setMoreOpen] = useState(false);
  const [params, setParams] = useSearchParams();
  const tab = ['tomorrow', 'students', 'exams', 'help'].includes(params.get('tab')) ? params.get('tab') : 'tomorrow';
  const setTab = (t) => setParams(t === 'tomorrow' ? {} : { tab: t }, { replace: true });
  const [adding, setAdding] = useState(false);
  const [confirmOut, setConfirmOut] = useState(false);
  const { state: nav } = useLocation();
  // a class deleted from its settings page: the board opens on the next class and says so
  useEffect(() => { const t = takePendingToast(); if (t) toast(t); }, []);
  // "על רישיון כיתה" from the tutor's sheet: the licence card, at the top of the "מחר" view
  useEffect(() => {
    if (nav?.focus !== 'licence') return undefined;
    if (tab !== 'tomorrow') setTab('tomorrow');
    const t = setTimeout(() => document.getElementById('t-licence')?.scrollIntoView({ block: 'start' }), 300);
    return () => clearTimeout(t);
  }, [nav]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async () => {
    try { setData(await teacherApi('/api/teacher/dashboard', {}, cls)); setError(''); setErrorCode(''); } catch (e) { setError(e.message); setErrorCode(e.code || ''); }
  }, [cls]);
  useEffect(() => { setData(null); load(); const t = setInterval(load, 120_000); return () => clearInterval(t); }, [load]);

  // leaving the board also ends the teacher's email session, on this device and on the server
  const leave = () => { endSession(); signOut(); };
  const dismissFresh = () => setProfile({ ...profile, classes: profile.classes.map((c) => (c.code === cls.code ? { ...c, fresh: false } : c)) });

  const students = data?.students || [];
  const openHelp = (data?.help || []).filter((h) => !h.done_at);
  const practicedToday = students.filter((s) => s.today.n > 0).length;
  const practicedWeek = students.filter((s) => s.week.n > 0).length;
  const weekN = students.reduce((a, s) => a + s.week.n, 0); const weekFirst = students.reduce((a, s) => a + s.week.first, 0);

  // The teacher's board in the app's own grammar (LAYOUT_SPEC E5): the solid header block with the class, its code and
  // two icon actions (as the profile has its gear), a 2×2 overview of tiles, a segmented switch between four views,
  // groups of plain rows, and leaving as a red row at the end. Adding a class opens a sheet.
  return (
    <div className="teacher">
      <header className="t-head" data-region="header">
        <div className="t-head-row">
          <span className="t-head-who"><span className="wordmark sm">מדרגות</span><span className="t-head-sub">לוח המורה של {profile.name}</span></span>
          <span className="t-head-actions">
            <button type="button" className="icon-btn t-icon" onClick={load} aria-label="רענון הנתונים"><RefreshCw size={20} aria-hidden="true" /></button>
            <button type="button" className="icon-btn t-icon" onClick={() => setAdding(true)} aria-label="כיתה נוספת"><Plus size={22} aria-hidden="true" /></button>
          </span>
        </div>
        <div className="t-class">
          {profile.classes.length > 1 ? (
            <select className="input t-class-select" aria-label="כיתה" value={cls.code} onChange={(e) => setActiveClass(e.target.value)}>
              {profile.classes.map((c) => <option key={c.code} value={c.code}>{c.className}</option>)}
            </select>
          ) : <h1 className="t-class-name">{cls.className}</h1>}
          <button type="button" className="code-chip t-code" onClick={() => copy(cls.code, 'קוד הכיתה')} aria-label={`העתקת קוד הכיתה ${cls.code}`}><span>קוד</span><span dir="ltr">{cls.code}</span><Copy size={16} aria-hidden="true" /></button>
        </div>
        {/* signed in: the email's other classes can be added to this device */}
        {session && <button type="button" className="link-btn t-more" onClick={() => setMoreOpen(true)}>עוד כיתות מהחשבון שלי…</button>}
      </header>
      <AddClass open={adding} onClose={() => setAdding(false)} />
      {session && <MoreClasses open={moreOpen} onOpenChange={setMoreOpen} />}

      <main className="t-main">
        {cls.fresh && <FreshClass cls={cls} onDone={dismissFresh} />}
        {error && !data && errorCode === 'not_account' && <SignInAgain cls={cls} onSignedIn={load} />}
        {error && !data && errorCode !== 'not_account' && (
          <EmptyState mood="oops" title="לא הצלחנו לטעון את הכיתה">
            <p role="alert">{error}</p>
            <p>הנתונים של הכיתה שמורים בשרת. בדקו את החיבור לאינטרנט ונסו שוב.</p>
            <Button className="btn-lg" onClick={load}><RefreshCw size={18} aria-hidden="true" />לנסות שוב</Button>
          </EmptyState>
        )}
        {error && data && <p className="form-error" role="alert">{error}</p>}
        {!data && !error && <LoadingState text="טוענים את נתוני הכיתה…" />}

        {data && (
          <>
            <div className="t-kpis" data-region="answers">
              <Stat icon={Users} tone="brand" value={<bdi>{practicedToday}/{students.length}</bdi>} label="תרגלו היום" />
              <Stat icon={CalendarDays} tone="sky" value={<bdi>{practicedWeek}/{students.length}</bdi>} label="תרגלו השבוע" />
              <Stat icon={Target} tone="good" value={weekN ? <bdi>{pct(weekFirst, weekN)}%</bdi> : '–'} label="נכון בניסיון ראשון" />
              <Stat icon={Hand} tone="gold" value={openHelp.length} label="בקשות עזרה פתוחות" />
            </div>

            {/* the class's tools (TEACHER-2 §7): chips in one row that scrolls sideways on a narrow screen and never
                wraps; the exam, the report and the guide add theirs between these as they land */}
            <nav className="t-tools" aria-label="כלים">
              <ul>
                <li><Link className="t-tool" to="/teacher/lessons"><BookOpen size={18} aria-hidden="true" />השיעורים</Link></li>
                <li><Link className="t-tool" to="/teacher/assistant"><Sparkles size={18} aria-hidden="true" />העוזר החכם</Link></li>
                <li><Link className="t-tool" to="/teacher/settings"><SettingsIcon size={18} aria-hidden="true" />הגדרות הכיתה</Link></li>
              </ul>
            </nav>

            <div className="segmented t-tabs" role="tablist" aria-label="תצוגה">
              {[['tomorrow', 'מחר'], ['students', 'תלמידים'], ['exams', `מבחנים${data.exams?.length ? ` (${data.exams.length})` : ''}`], ['help', `עזרה${openHelp.length ? ` (${openHelp.length})` : ''}`]].map(([id, label]) => (
                <button key={id} type="button" role="tab" aria-selected={tab === id} className={clsx('seg', 't-tab', tab === id && 'on')} onClick={() => setTab(id)}>{label}</button>
              ))}
            </div>

            {tab === 'tomorrow' && emailOn && !cls.fresh && offerBind(cls) && <BindCard cls={cls} />}

            {students.length === 0 && (
              <EmptyState mood="idle" title="עוד אין תלמידים בכיתה">
                <p>כשתלמידים יצטרפו עם הקוד <b dir="ltr">{cls.code}</b>, הם יופיעו כאן עם ההתקדמות שלהם.</p>
                <Button variant="secondary" className="btn-sm" onClick={() => copy(cls.code, 'קוד הכיתה')}><Copy size={16} aria-hidden="true" />העתקת הקוד</Button>
              </EmptyState>
            )}

            {tab === 'tomorrow' && <TomorrowTab cls={cls} data={data} students={students} openHelp={openHelp} onOpenHelp={() => setTab('help')} />}
            {tab === 'students' && <StudentsTab cls={cls} data={data} students={students} onChanged={load} />}
            {tab === 'exams' && <ExamsTab data={data} />}
            {tab === 'help' && <HelpTab cls={cls} data={data} onChanged={load} />}
          </>
        )}

        <section className="section set-group t-out">
          <div className="set-rows-wrap"><div className="set-rows"><button type="button" className="set-row danger" onClick={() => setConfirmOut(true)}><LogOut size={18} aria-hidden="true" />יציאה מהלוח</button></div></div>
          <ConfirmSheet open={confirmOut} onOpenChange={setConfirmOut} title="לצאת מהלוח?" keep="להישאר בלוח" confirm="כן, לצאת" onConfirm={leave}>
            {profile.classes.every((c) => c.owned)
              ? <p>הלוח ייסגר במכשיר הזה. כדי לחזור, נכנסים עם המייל {session?.email ? <bdi dir="ltr">{session.email}</bdi> : 'שלכם'}.</p>
              : (
                <>
                  <p>הלוח ייסגר במכשיר הזה. כדי לחזור צריך את קוד הכיתה ואת מפתח המורה.</p>
                  <p className="t-leave-more">נמחק מהמכשיר הזה את הכיתות ואת מפתחות המורה. המידע של הכיתות בשרת נשאר: כדי למחוק אותו, מוחקים כל כיתה בלוח המורה לפני כן. אי אפשר לבטל.</p>
                </>
              )}
          </ConfirmSheet>
        </section>
      </main>
    </div>
  );
}
