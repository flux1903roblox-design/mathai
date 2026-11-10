// The teacher's board: the header, the overview tiles, the switch between the views, the data loading, adding a class
// and the first look at a new class. Each view is its own file in screens/teacher/.
import { useSearchParams, useLocation } from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';
import clsx from 'clsx';
import { toast } from 'sonner';
import { Copy, RefreshCw, Hand, LogOut, Plus, Users, CalendarDays, Target } from 'lucide-react';
import { useApp } from '@/lib/store.js';
import { api, teacherHeaders } from '@/lib/api.js';
import { Button, Field, Sheet } from '@/components/ui.jsx';
import { Stat } from '@/components/ds.jsx';
import Mascot from '@/components/Mascot.jsx';
import { EmptyState, ConfirmSheet, LoadingState } from '@/components/Screen.jsx';
import { GradeSwitch } from './Welcome.jsx';
import { copy, pct } from './teacher/common.jsx';
import TomorrowTab from './teacher/TomorrowTab.jsx';
import StudentsTab from './teacher/StudentsTab.jsx';
import ExamsTab from './teacher/ExamsTab.jsx';
import HelpTab from './teacher/HelpTab.jsx';

function FreshClass({ cls, onDone }) {
  return (
    <section className="card t-fresh" aria-labelledby="fresh-title" data-region="card">
      <Mascot mood="achievement" size={96} />
      <h2 id="fresh-title" className="t-fresh-title">הכיתה מוכנה!</h2>
      <p>תנו לתלמידים את <b>קוד הכיתה</b>. הם בוחרים "אני תלמיד או תלמידה", כותבים שם, מקלידים את הקוד ובוחרים קוד אישי של 4 ספרות.</p>
      <div className="code-pair">
        <div><span className="field-label">קוד כיתה</span><button type="button" className="code-chip" onClick={() => copy(cls.code, 'קוד הכיתה')}><span dir="ltr">{cls.code}</span><Copy size={16} aria-hidden="true" /></button></div>
        <div><span className="field-label">מפתח מורה (רק לכם)</span><button type="button" className="code-chip" onClick={() => copy(cls.key, 'מפתח המורה')}><span dir="ltr">{cls.key}</span><Copy size={16} aria-hidden="true" /></button></div>
      </div>
      <p className="muted">שמרו את מפתח המורה במקום בטוח. בעזרתו פותחים את הלוח ממחשב אחר.</p>
      <Button className="btn-block btn-lg" onClick={onDone}>שמרתי, אפשר להמשיך</Button>
    </section>
  );
}

function AddClass({ open, onClose }) {
  const { profile, setProfile } = useApp();
  const [f, setF] = useState({ className: '', grade: '7' }); const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!f.className.trim()) return; setBusy(true);
    try {
      const r = await api('/api/classes', { method: 'POST', body: { teacherName: profile.name, className: f.className, grade: f.grade } });
      const cls = { code: r.code, key: r.teacherKey, className: r.className, grade: r.grade, fresh: true };
      setProfile({ ...profile, classes: [...profile.classes, cls], active: cls.code }); setF({ className: '', grade: '7' }); onClose();
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
  const { profile, setProfile, signOut } = useApp();
  const cls = profile.classes.find((c) => c.code === profile.active) || profile.classes[0];
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [params, setParams] = useSearchParams();
  const tab = ['tomorrow', 'students', 'exams', 'help'].includes(params.get('tab')) ? params.get('tab') : 'tomorrow';
  const setTab = (t) => setParams(t === 'tomorrow' ? {} : { tab: t }, { replace: true });
  const [adding, setAdding] = useState(false);
  const [confirmOut, setConfirmOut] = useState(false);
  const { state: nav } = useLocation();
  // "על רישיון כיתה" from the tutor's sheet: the licence card, at the top of the "מחר" view
  useEffect(() => {
    if (nav?.focus !== 'licence') return undefined;
    if (tab !== 'tomorrow') setTab('tomorrow');
    const t = setTimeout(() => document.getElementById('t-licence')?.scrollIntoView({ block: 'start' }), 300);
    return () => clearTimeout(t);
  }, [nav]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async () => {
    try { setData(await api('/api/teacher/dashboard', { headers: teacherHeaders(cls) })); setError(''); } catch (e) { setError(e.message); }
  }, [cls]);
  useEffect(() => { setData(null); load(); const t = setInterval(load, 120_000); return () => clearInterval(t); }, [load]);

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
            <select className="input t-class-select" aria-label="כיתה" value={cls.code} onChange={(e) => setProfile({ ...profile, active: e.target.value })}>
              {profile.classes.map((c) => <option key={c.code} value={c.code}>{c.className}</option>)}
            </select>
          ) : <h1 className="t-class-name">{cls.className}</h1>}
          <button type="button" className="code-chip t-code" onClick={() => copy(cls.code, 'קוד הכיתה')} aria-label={`העתקת קוד הכיתה ${cls.code}`}><span>קוד</span><span dir="ltr">{cls.code}</span><Copy size={16} aria-hidden="true" /></button>
        </div>
      </header>
      <AddClass open={adding} onClose={() => setAdding(false)} />

      <main className="t-main">
        {cls.fresh && <FreshClass cls={cls} onDone={dismissFresh} />}
        {error && !data && (
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

            <div className="segmented t-tabs" role="tablist" aria-label="תצוגה">
              {[['tomorrow', 'מחר'], ['students', 'תלמידים'], ['exams', `מבחנים${data.exams?.length ? ` (${data.exams.length})` : ''}`], ['help', `עזרה${openHelp.length ? ` (${openHelp.length})` : ''}`]].map(([id, label]) => (
                <button key={id} type="button" role="tab" aria-selected={tab === id} className={clsx('seg', 't-tab', tab === id && 'on')} onClick={() => setTab(id)}>{label}</button>
              ))}
            </div>

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
          <ConfirmSheet open={confirmOut} onOpenChange={setConfirmOut} title="לצאת מהלוח?" keep="להישאר בלוח" confirm="כן, לצאת" onConfirm={() => signOut()}>
            <p>הלוח ייסגר במכשיר הזה. כדי לחזור צריך את קוד הכיתה ואת מפתח המורה.</p>
          </ConfirmSheet>
        </section>
      </main>
    </div>
  );
}
