// The teacher's board: the header, the overview tiles, the switch between the views, the data loading, adding a class
// and the first look at a new class. Each view is its own file in screens/teacher/.
import { Link, useSearchParams } from 'react-router-dom';
import { useCallback, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { toast } from 'sonner';
import { Copy, RefreshCw, Hand, LogOut, Plus, Users, CalendarDays, Target, Settings as SettingsIcon, BookOpen, Sparkles, Printer, FileDown, LifeBuoy, ListChecks } from 'lucide-react';
import { useApp } from '@/lib/store.js';
import { api } from '@/lib/api.js';
import { teacherApi, useEmailSignIn, offerBind } from '@/lib/teacher.js';
import { useParent, accountCall, signOut as endSession } from '@/lib/parent.js';
import { DEMO_COPY, exitDemo } from '@/lib/demo.js';
import { Button, Field, Sheet } from '@/components/ui.jsx';
import { Stat } from '@/components/ds.jsx';
import { EmptyState, ConfirmSheet, LoadingState } from '@/components/Screen.jsx';
import { GradeSwitch } from '@/components/GradeSwitch.jsx';
import { copy, pct } from './teacher/common.jsx';
import { FreshClass, BindCard, SignInAgain, MoreClasses, BoundElsewhere } from './teacher/ClassAccount.jsx';
import TomorrowTab from './teacher/TomorrowTab.jsx';
import WorkTab from './teacher/WorkTab.jsx';
import StudentsTab from './teacher/StudentsTab.jsx';
import ExamsTab from './teacher/ExamsTab.jsx';
import HelpTab from './teacher/HelpTab.jsx';
import { takePendingToast } from './teacher/DeleteClass.jsx';
import AssignSheet from '@/components/teacher/AssignSheet.jsx';
import ClassSettingQuestion, { settingBody, settingReady } from '@/components/teacher/ClassSettingQuestion.jsx';
import StudentSheet from '@/components/teacher/StudentSheet.jsx';
import { rememberBoard } from '@/lib/teacherBoard.js';
import '@/styles/lazy/teacher.css'; // this screen's own rules, loaded with it (STUDENT-15)

const TABS = ['tomorrow', 'work', 'students', 'exams', 'help'];

const NEW_CLASS = { className: '', grade: '7', setting: 'school', attest: false };

function AddClass({ open, onClose }) {
  const { profile, setProfile } = useApp();
  const [f, setF] = useState(NEW_CLASS); const [busy, setBusy] = useState(false);
  const can = !!f.className.trim() && settingReady(f.setting, f.attest);
  const submit = async () => {
    if (!can) return; setBusy(true);
    try {
      // where the class learns (TRUST-11): a school class unless the teacher picks a private group and attests to it
      const body = { teacherName: profile.name, className: f.className, grade: f.grade, ...settingBody(f.setting, f.attest) };
      // signed in: the new class is bound to the email at once (owned), like the first one
      const session = useParent.getState().session;
      const r = session ? await accountCall('/api/classes', { method: 'POST', body }) : await api('/api/classes', { method: 'POST', body });
      const cls = { code: r.code, key: r.owned && session?.shared ? null : r.teacherKey, className: r.className, grade: r.grade, fresh: true, createdHere: true, ...(r.owned ? { owned: true } : {}) };
      setProfile({ ...profile, classes: [...profile.classes, cls], active: cls.code, grade: cls.grade }); setF(NEW_CLASS); onClose();
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };
  // a sheet like every other one: the title and the way out, the fields, its one action pinned at the bottom
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title="כיתה נוספת"
      footer={<Button className="btn-block btn-lg" onClick={submit} disabled={busy || !can}>{busy ? 'רגע…' : 'פתיחת הכיתה'}</Button>}>
      <form className="add-class ob-field" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <Field label="שם הכיתה החדשה" id="ac-name"><input id="ac-name" className="input input-lg" value={f.className} onChange={(e) => setF({ ...f, className: e.target.value })} maxLength={30} placeholder="למשל: ח׳2" /></Field>
        <div className="field"><span className="field-label" id="ac-grade">שכבה</span><GradeSwitch value={f.grade} onChange={(g) => setF({ ...f, grade: g })} id="ac-grade" /></div>
        <ClassSettingQuestion idPrefix="ac" setting={f.setting} attest={f.attest} onChange={({ setting, attest }) => setF({ ...f, setting, attest })} />
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
  // the demo class (TEACHER-15): no account, no other class to add, and leaving is leaving the demo
  const demo = profile.demo === true;
  const signedIn = useParent((s) => s.session);
  const session = demo ? null : signedIn;
  const emailOn = useEmailSignIn();
  const [moreOpen, setMoreOpen] = useState(false);
  const [params, setParams] = useSearchParams();
  const tab = TABS.includes(params.get('tab')) ? params.get('tab') : 'tomorrow';
  // a view, with its own parameters: the students tab's ?sort=need, the help view's ?student=<id> (TEACHER-8)
  const setTab = (t, extra = {}) => setParams(t === 'tomorrow' ? {} : { tab: t, ...extra }, { replace: true });
  const [adding, setAdding] = useState(false);
  // the assign sheet (TEACHER-4): opened from "משימות" or a repeated mistake on "מחר"; each opening starts fresh
  const [assign, setAssign] = useState(null); // { preset, n } while open
  const [workVersion, setWorkVersion] = useState(0);
  const opened = useRef(0);
  const openAssign = (preset = {}) => { opened.current += 1; setAssign({ preset, n: opened.current }); };
  // a student's page (TEACHER-8): any name on the board opens it; its actions lead to the assign sheet or the help view
  const [sheetFor, setSheetFor] = useState(null); // { id, name } while open
  const [sheetOpen, setSheetOpen] = useState(false);
  const openStudent = (s) => { setSheetFor(s); setSheetOpen(true); };
  const [confirmOut, setConfirmOut] = useState(false);
  // a class deleted from its settings page: the board opens on the next class and says so
  useEffect(() => { const t = takePendingToast(); if (t) toast(t); }, []);

  const load = useCallback(async () => {
    try {
      const d = await teacherApi('/api/teacher/dashboard', {}, cls);
      rememberBoard(cls.code, d);
      setData(d); setError(''); setErrorCode('');
    } catch (e) { setError(e.message); setErrorCode(e.code || ''); }
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
  // assignments still open (due today or later), for the tab's count
  const openWork = (data?.assignments || []).filter((a) => !data.today || a.dueOn >= data.today).length;
  const tabList = [['tomorrow', 'מחר'], ['work', `משימות${openWork ? ` (${openWork})` : ''}`], ['students', 'תלמידים'], ['exams', `מבחנים${data?.exams?.length ? ` (${data.exams.length})` : ''}`], ['help', `עזרה${openHelp.length ? ` (${openHelp.length})` : ''}`]];
  // the switch scrolls sideways on a narrow phone: the open view's tab is kept in sight
  const tabsRef = useRef(null);
  useEffect(() => { tabsRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }); }, [tab, !!data]);
  // the far edge fades only when there are more tabs to scroll to
  useEffect(() => {
    const el = tabsRef.current; if (!el) return undefined;
    const mark = () => { el.dataset.more = el.scrollWidth > el.clientWidth + 1 ? '1' : ''; };
    mark();
    window.addEventListener('resize', mark);
    return () => window.removeEventListener('resize', mark);
  }, [data, openWork, openHelp.length]);
  // arrow keys move between the views, in reading order (right to left)
  const onTabsKey = (e) => {
    const i = TABS.indexOf(tab); const step = e.key === 'ArrowLeft' ? 1 : e.key === 'ArrowRight' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = TABS[(i + step + TABS.length) % TABS.length];
    setTab(next);
    requestAnimationFrame(() => tabsRef.current?.querySelector(`[data-tab="${next}"]`)?.focus());
  };

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
            {!demo && <button type="button" className="icon-btn t-icon" onClick={() => setAdding(true)} aria-label="כיתה נוספת"><Plus size={22} aria-hidden="true" /></button>}
          </span>
        </div>
        <div className="t-class">
          {profile.classes.length > 1 ? (
            <select className="input t-class-select" aria-label="כיתה" value={cls.code} onChange={(e) => setActiveClass(e.target.value)}>
              {profile.classes.map((c) => <option key={c.code} value={c.code}>{c.className}</option>)}
            </select>
          ) : <h1 className="t-class-name">{cls.className}</h1>}
          <button type="button" className="code-chip t-code" onClick={() => copy(cls.code, 'קוד הכיתה')} aria-label={`העתקת קוד הכיתה ${cls.code}`}><span>קוד</span><span dir="ltr">{cls.code}</span><Copy size={16} aria-hidden="true" /></button>
          {/* the class goal of the week (STUDENT-4): the class total only, as the students see it; its settings are on the
              class settings page */}
          {data?.goal?.on && <span className="chip t-goal-chip">מטרת הכיתה: <bdi dir="ltr">{data.goal.have}/{data.goal.target}</bdi></span>}
        </div>
        {/* signed in: the email's other classes can be added to this device */}
        {session && <button type="button" className="link-btn t-more" onClick={() => setMoreOpen(true)}>עוד כיתות מהחשבון שלי…</button>}
      </header>
      {!demo && <AddClass open={adding} onClose={() => setAdding(false)} />}
      {assign && data && (
        <AssignSheet key={`${cls.code}-${assign.n}`} cls={cls} students={students} today={data.today} preset={assign.preset} open
          onOpenChange={(o) => { if (!o) setAssign(null); }} onSent={() => { setWorkVersion((v) => v + 1); load(); }} />
      )}
      {session && <MoreClasses open={moreOpen} onOpenChange={setMoreOpen} />}
      {sheetFor && data && (
        <StudentSheet cls={cls} student={sheetFor} today={data.today} aiPolicy={data.aiPolicy} open={sheetOpen} onOpenChange={setSheetOpen} onChanged={load}
          onAssign={(preset) => { setSheetOpen(false); openAssign(preset); }}
          onHelp={(id) => { setSheetOpen(false); setTab('help', { student: id }); }} />
      )}

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
                wraps; before the last, what the app teaches against the Ministry's programme, on the class's grade
                (CURRICULUM-1.6); the last is the pilot kit and its guides (TEACHER-10) */}
            <nav className="t-tools" aria-label="כלים">
              <ul>
                <li><Link className="t-tool" to="/teacher/lessons"><BookOpen size={18} aria-hidden="true" />השיעורים</Link></li>
                <li><Link className="t-tool" to="/teacher/exam/new"><Printer size={18} aria-hidden="true" />מבחן להדפסה</Link></li>
                <li><Link className="t-tool" to="/teacher/assistant"><Sparkles size={18} aria-hidden="true" />העוזר החכם</Link></li>
                <li><Link className="t-tool" to="/teacher/report"><FileDown size={18} aria-hidden="true" />דוח וייצוא</Link></li>
                <li><Link className="t-tool" to="/teacher/settings"><SettingsIcon size={18} aria-hidden="true" />הגדרות הכיתה</Link></li>
                <li><Link className="t-tool" to={`/programme?grade=${cls.grade === '8' ? '8' : '7'}`}><ListChecks size={18} aria-hidden="true" />מה לומדים במדרגות, לפי תוכנית משרד החינוך</Link></li>
                <li><Link className="t-tool" to="/teacher/guide"><LifeBuoy size={18} aria-hidden="true" />מדריך למורה</Link></li>
              </ul>
            </nav>

            <div className="segmented t-tabs" role="tablist" aria-label="תצוגה" ref={tabsRef} onKeyDown={onTabsKey}>
              {tabList.map(([id, label]) => (
                <button key={id} type="button" role="tab" data-tab={id} aria-selected={tab === id} className={clsx('seg', 't-tab', tab === id && 'on')} onClick={() => setTab(id)}>{label}</button>
              ))}
            </div>

            {tab === 'tomorrow' && emailOn && !cls.fresh && offerBind(cls, undefined, data) && <BindCard cls={cls} />}
            {tab === 'tomorrow' && !demo && <BoundElsewhere cls={cls} board={data} where="board" />}

            {students.length === 0 && (
              <EmptyState mood="idle" title="עוד אין תלמידים בכיתה">
                <p>כשתלמידים יצטרפו עם הקוד <b dir="ltr">{cls.code}</b>, הם יופיעו כאן עם ההתקדמות שלהם.</p>
                <Button variant="secondary" className="btn-sm" onClick={() => copy(cls.code, 'קוד הכיתה')}><Copy size={16} aria-hidden="true" />העתקת הקוד</Button>
              </EmptyState>
            )}

            {tab === 'tomorrow' && (
              <TomorrowTab cls={cls} data={data} students={students} openHelp={openHelp} onOpenHelp={() => setTab('help')} onAssign={openAssign}
                onStudent={openStudent} onAll={() => setTab('students', { sort: 'need' })} />
            )}
            {tab === 'work' && <WorkTab cls={cls} today={data.today} version={workVersion} onNew={() => openAssign()} onChanged={load} />}
            {tab === 'students' && <StudentsTab cls={cls} data={data} students={students} onChanged={load} onStudent={openStudent} />}
            {tab === 'exams' && <ExamsTab data={data} onStudent={openStudent} />}
            {tab === 'help' && <HelpTab key={params.get('student') || ''} cls={cls} data={data} onChanged={load} onStudent={openStudent} />}
          </>
        )}

        <section className="section set-group t-out">
          <div className="set-rows-wrap"><div className="set-rows">
            {demo
              ? <button type="button" className="set-row" onClick={exitDemo}><LogOut size={18} aria-hidden="true" />{DEMO_COPY.exit}</button>
              : <button type="button" className="set-row danger" onClick={() => setConfirmOut(true)}><LogOut size={18} aria-hidden="true" />יציאה מהלוח</button>}
          </div></div>
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
