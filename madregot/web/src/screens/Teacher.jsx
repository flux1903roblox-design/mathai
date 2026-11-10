import { useSearchParams, useLocation } from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';
import clsx from 'clsx';
import { toast } from 'sonner';
import { Copy, RefreshCw, Hand, TriangleAlert, CircleCheck, CircleAlert, LogOut, Plus, KeyRound, NotebookPen, Users, CalendarDays, Target, ChevronLeft, UserMinus } from 'lucide-react';
import { useApp } from '@/lib/store.js';
import { api, teacherHeaders } from '@/lib/api.js';
import { TOPIC, topicsFor } from '@/content/index.js';
import { Button, ChapterMark, Field, LevelPips, Sheet } from '@/components/ui.jsx';
import { Stat } from '@/components/ds.jsx';
import Mascot from '@/components/Mascot.jsx';
import { EmptyState, ConfirmSheet, LoadingState } from '@/components/Screen.jsx';
import { MathText } from '@/components/MathText.jsx';
import { GradeSwitch } from './Welcome.jsx';
import { useAIStatus } from '@/lib/account.js';
import LicenceCard from '@/components/teacher/LicenceCard.jsx';

// A student asked the teacher to talk (trust spec TRUST-3 §3.5); the teacher lane gives these requests their full design.
const TALK = 'ביקש/ה לדבר איתך';

const fmtDay = (iso) => {
  if (!iso) return 'אף פעם';
  const d = new Date(iso); const days = Math.floor((Date.now() - d.getTime()) / 864e5);
  if (days <= 0) return 'היום'; if (days === 1) return 'אתמול';
  return `לפני ${days} ימים`;
};
const pct = (a, b) => (b ? Math.round((100 * a) / b) : null);

function copy(text, label) {
  navigator.clipboard?.writeText(text).then(() => toast.success(`${label} הועתק`), () => toast(`${label}: ${text}`));
}

function Rate({ value }) {
  if (value == null) return <span className="muted">אין עדיין</span>;
  const tone = value < 60 ? 'low' : value < 80 ? 'mid' : 'high';
  const Icon = tone === 'low' ? TriangleAlert : tone === 'mid' ? CircleAlert : CircleCheck;
  return <span className={`rate ${tone}`}><Icon size={15} aria-hidden="true" />{value}%</span>;
}

function NotebookPage({ cls, id }) {
  const [src, setSrc] = useState(null); const [busy, setBusy] = useState(false);
  const [big, setBig] = useState(false);
  if (src) {
    return (
      <button type="button" className={clsx('help-page-btn', big && 'big')} onClick={() => setBig(!big)} aria-expanded={big} aria-label={big ? 'הקטנת הדף' : 'הגדלת הדף מהמחברת'}>
        <img className="help-page" src={src} alt="הדף מהמחברת של התלמיד" />
      </button>
    );
  }
  return (
    <Button variant="secondary" className="btn-sm" disabled={busy} onClick={async () => {
      setBusy(true);
      try { const r = await api(`/api/teacher/help/${id}/image`, { headers: teacherHeaders(cls) }); setSrc(r.image); } catch (e) { toast.error(e.message); } finally { setBusy(false); }
    }}><NotebookPen size={16} aria-hidden="true" />{busy ? 'טוענים…' : 'הדף מהמחברת'}</Button>
  );
}

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

/** A group in the "what to do tomorrow" view: a small heading over plain rows (the settings grammar). */
function Group({ title, tone, children, more }) {
  return (
    <section className={clsx('set-group', 't-group', tone && `t-group-${tone}`)} aria-label={title}>
      <h2 className="set-head">{title}</h2>
      <div className="t-group-box">{children}</div>
      {more}
    </section>
  );
}

const Q_TONE = { correct: 'ok', partial: 'mid', wrong: 'bad', missing: 'bad' };
const Q_LABEL = { correct: 'נכון', partial: 'נכון בחלקו', wrong: 'טעות', missing: 'לא נענה' };

/** One small square per question, coloured by result; the skill shows on hover. */
function QuestionStrip({ questions = [] }) {
  const missed = questions.map((q, i) => (q.status === 'correct' ? null : i + 1)).filter(Boolean);
  return (
    <span className="qstrip" role="img" aria-label={missed.length ? `טעויות בשאלות ${missed.join(', ')}` : 'כל השאלות נכונות'}>
      {questions.map((q, i) => (
        <i key={i} className={Q_TONE[q.status] || 'bad'} title={`שאלה ${i + 1}: ${Q_LABEL[q.status] || ''}${q.skill ? `, ${q.skill}` : ''}`}>{i + 1}</i>
      ))}
    </span>
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
  const [removing, setRemoving] = useState(null);
  const { state: nav } = useLocation();
  const paywall = useAIStatus((x) => x.status?.paywall === true);
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

  const markHelp = async (id, action) => {
    try { await api(`/api/teacher/help/${id}`, { method: 'POST', body: { action }, headers: teacherHeaders(cls) }); load(); } catch (e) { toast.error(e.message); }
  };
  const resetPin = async (s) => {
    try { await api(`/api/teacher/students/${s.id}/reset-pin`, { method: 'POST', body: {}, headers: teacherHeaders(cls) }); toast.success(`הקוד האישי של ${s.name} אופס. בכניסה הבאה הוא יבחר קוד חדש.`); load(); } catch (e) { toast.error(e.message); }
  };
  const setLock = async (locked) => {
    try {
      await api('/api/teacher/class/lock', { method: 'POST', body: { locked }, headers: teacherHeaders(cls) });
      toast.success(locked ? 'הכיתה נעולה לתלמידים חדשים.' : 'הכיתה פתוחה לתלמידים חדשים.'); load();
    } catch (e) { toast.error(e.message); }
  };
  const removeStudent = async () => {
    const st = removing; setRemoving(null);
    try { await api(`/api/teacher/students/${st.id}/remove`, { method: 'POST', body: {}, headers: teacherHeaders(cls) }); toast(`${st.name} הוסר/ה מהכיתה`); load(); } catch (e) { toast.error(e.message); }
  };
  const dismissFresh = () => setProfile({ ...profile, classes: profile.classes.map((c) => (c.code === cls.code ? { ...c, fresh: false } : c)) });

  const students = data?.students || [];
  const openHelp = (data?.help || []).filter((h) => !h.done_at);
  const practicedToday = students.filter((s) => s.today.n > 0).length;
  const practicedWeek = students.filter((s) => s.week.n > 0).length;
  const weekN = students.reduce((a, s) => a + s.week.n, 0); const weekFirst = students.reduce((a, s) => a + s.week.first, 0);
  const idle = (s) => !s.lastPractice || (Date.now() - new Date(s.lastPractice)) > 3 * 864e5;
  const attention = students.filter((s) => idle(s) || (s.week.n >= 5 && pct(s.week.first, s.week.n) < 60));
  const topics = topicsFor(cls.grade);
  // Topics where the class lost points in checked exams (last two weeks).
  const examWeak = Object.values((data?.exams || []).filter((e) => Date.now() - new Date(e.at) < 14 * 864e5).reduce((acc, e) => {
    e.questions.forEach((q) => {
      if (q.status === 'correct') return;
      const w = (acc[q.topic] ||= { topic: q.topic, lost: 0, skills: new Set(), names: new Set() });
      w.lost += 1; if (q.skill) w.skills.add(q.skill); w.names.add(e.name);
    });
    return acc;
  }, {})).map((w) => ({ ...w, skills: [...w.skills], names: [...w.names] })).sort((a, b) => b.names.length - a.names.length || b.lost - a.lost).slice(0, 5);

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

            {tab === 'tomorrow' && paywall && <LicenceCard cls={cls} />}
            {tab === 'tomorrow' && students.length > 0 && (
              <div className="t-grid">
                <Group title="טעויות שחוזרות השבוע" tone="warm">
                  {data.mistakes.length === 0 ? <p className="t-row muted">לא זוהו טעויות שחוזרות.</p> : (
                    <ul className="t-list">
                      {data.mistakes.map((m) => (
                        <li key={`${m.topic}:${m.cat}`} className="t-row">
                          <span className="t-list-main"><b>{TOPIC[m.topic]?.title}</b>: <MathText text={TOPIC[m.topic]?.cats[m.cat] || m.cat} /></span>
                          <span className="muted">{m.students === 1 ? 'תלמיד אחד' : `${m.students} תלמידים`}: {m.names.slice(0, 6).join(', ')}{m.names.length > 6 ? '…' : ''}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Group>
                {examWeak.length > 0 && (
                  <Group title="נושאים חלשים במבחנים" tone="warm">
                    <ul className="t-list">
                      {examWeak.map((w) => (
                        <li key={w.topic} className="t-row">
                          <span className="t-list-main"><b>{TOPIC[w.topic]?.title || 'נושא אחר'}</b>: {w.lost === 1 ? 'שאלה אחת עם טעות' : `${w.lost} שאלות עם טעות`}</span>
                          <span className="muted">{w.skills.slice(0, 3).join(', ')}{w.skills.length ? '. ' : ''}{w.names.length === 1 ? w.names[0] : `${w.names.length} תלמידים: ${w.names.slice(0, 6).join(', ')}`}</span>
                        </li>
                      ))}
                    </ul>
                  </Group>
                )}
                <Group title="כדאי לבדוק איתם">
                  {attention.length === 0 ? <p className="t-row muted">{openHelp.length ? 'כולם מתרגלים ומצליחים. יש בקשות עזרה שמחכות לכם.' : 'כולם מתרגלים ומצליחים.'}</p> : (
                    <ul className="t-list">
                      {attention.map((s) => (
                        <li key={s.id} className="t-row">
                          <span className="t-list-main"><b>{s.name}</b></span>
                          <span className="muted">{idle(s) ? (s.lastPractice ? `תרגול אחרון ${fmtDay(s.lastPractice)}` : 'עוד לא תרגלו אף פעם') : `נכון בניסיון ראשון: ${pct(s.week.first, s.week.n)}%`}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Group>
                <Group title="בקשות עזרה חדשות" more={openHelp.length > 0 && <button type="button" className="t-more" onClick={() => setTab('help')}>לכל הבקשות<ChevronLeft size={18} aria-hidden="true" /></button>}>
                  {openHelp.length === 0 ? <p className="t-row muted">אין בקשות פתוחות.</p> : (
                    <ul className="t-list">{openHelp.slice(0, 5).map((h) => <li key={h.id} className={clsx('t-row', !h.seen_at && 'unseen')}><span className="t-list-main"><b>{h.name}</b>{h.kind === 'talk' ? '' : `, ${TOPIC[h.topic]?.title || ''}`}</span><span className="muted">{h.kind === 'talk' ? TALK : h.note || <MathText text={h.question} />}</span></li>)}</ul>
                  )}
                </Group>
              </div>
            )}

            {tab === 'students' && (
              <section className="set-group t-lock" aria-labelledby="t-lock-title">
                <h2 id="t-lock-title" className="visually-hidden">הצטרפות לכיתה</h2>
                <label className="check-row t-lock-row">
                  <input type="checkbox" role="switch" checked={!!data.joinLocked} onChange={(e) => setLock(e.target.checked)} />
                  <span>נעילת הכיתה לתלמידים חדשים</span>
                </label>
                <p className="field-hint">תלמידים שכבר בכיתה ממשיכים להיכנס עם הקוד האישי שלהם.</p>
              </section>
            )}
            {tab === 'students' && students.length > 0 && (
              <div className="table-wrap" tabIndex={0} role="region" aria-label="טבלת התלמידים">
                <table className="t-table">
                  <thead>
                    <tr>
                      <th scope="col">שם</th><th scope="col">תרגול אחרון</th><th scope="col">היום</th><th scope="col">ימים השבוע</th><th scope="col">נכון בניסיון ראשון</th>
                      {topics.map((t, i) => <th key={t.id} scope="col"><span className="th-topic"><ChapterMark color={t.color} n={i + 1} size="sm" />{t.title}</span></th>)}
                      <th scope="col"><span className="visually-hidden">פעולות</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s) => (
                      <tr key={s.id}>
                        <th scope="row">{s.name}</th>
                        <td>{fmtDay(s.lastPractice)}</td>
                        <td>{s.today.n ? `${s.today.n} תרגילים` : '–'}</td>
                        <td>{s.week.days}</td>
                        <td><Rate value={pct(s.week.first, s.week.n)} /></td>
                        {topics.map((t) => { const l = s.levels[t.id]; return <td key={t.id}>{l ? <LevelPips total={t.levels.length} level={l.level} max={l.max} color={t.color} /> : <span className="muted">–</span>}</td>; })}
                        <td className="t-actions">
                          {s.pinReset ? <span className="muted">קוד אופס</span> : <button type="button" className="link-btn" onClick={() => resetPin(s)}><KeyRound size={14} aria-hidden="true" />איפוס קוד אישי</button>}
                          <button type="button" className="link-btn" onClick={() => setRemoving(s)}><UserMinus size={14} aria-hidden="true" />הסרה מהכיתה</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {tab === 'exams' && (
              (data.exams || []).length === 0 ? <p className="muted">עוד אין מבחנים שנבדקו בכיתה. כשתלמידים יבדקו מבחן באפליקציה, התוצאות יופיעו כאן.</p> : (
                <div className="table-wrap" tabIndex={0} role="region" aria-label="טבלת המבחנים">
                  <table className="t-table">
                    <thead><tr><th scope="col">תלמיד</th><th scope="col">מבחן</th><th scope="col">תאריך</th><th scope="col">ציון</th><th scope="col">לפי שאלה</th><th scope="col">נושאים לחיזוק</th></tr></thead>
                    <tbody>
                      {data.exams.map((e) => (
                        <tr key={e.id}>
                          <th scope="row">{e.name}</th>
                          <td>{e.title}</td>
                          <td>{fmtDay(e.at)}</td>
                          <td><Rate value={e.total ? Math.round((100 * e.correct) / e.total) : null} /> <span className="muted">{e.correct}/{e.total}</span></td>
                          <td><QuestionStrip questions={e.questions} /></td>
                          <td className="wrap">{e.weak.map((w) => TOPIC[w]?.title || 'אחר').join(', ') || '–'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {tab === 'help' && (
              <ul className="help-list">
                {(data.help || []).length === 0 && <li className="muted">אין בקשות עזרה בשבוע האחרון.</li>}
                {(data.help || []).map((h) => (
                  <li key={h.id} className={clsx('help-item', !h.seen_at && !h.done_at && 'unseen', h.done_at && 'done')}>
                    <div className="help-item-head"><Hand size={16} aria-hidden="true" /><b>{h.name}</b>{!h.seen_at && !h.done_at && <span className="new-tag">חדש</span>}<span className="muted">{h.kind === 'talk' ? fmtDay(h.created_at) : `${TOPIC[h.topic]?.title || ''}, ${fmtDay(h.created_at)}`}</span></div>
                    {!!h.care && <p className="help-care">כדאי לבדוק מה שלום התלמיד/ה</p>}
                    {h.kind === 'talk' ? <p className="help-q">{h.name} {TALK}</p> : <p className="help-q"><MathText text={h.question} /></p>}
                    {h.answer && <p className="muted">מה כתב/ה: <span dir="ltr">{h.answer}</span></p>}
                    {h.note && <p><span className="hl">“{h.note}”</span></p>}
                    {!!h.has_image && <NotebookPage cls={cls} id={h.id} />}
                    <div className="form-actions row">
                      {!h.done_at && !h.seen_at && <Button variant="secondary" className="btn-sm" onClick={() => markHelp(h.id, 'seen')}>ראיתי</Button>}
                      {!h.done_at ? <Button variant="secondary" className="btn-sm" onClick={() => markHelp(h.id, 'done')}>טופל</Button> : <Button variant="ghost" className="btn-sm" onClick={() => markHelp(h.id, 'reopen')}>לפתוח שוב</Button>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        <section className="section set-group t-out">
          <div className="set-rows-wrap"><div className="set-rows"><button type="button" className="set-row danger" onClick={() => setConfirmOut(true)}><LogOut size={18} aria-hidden="true" />יציאה מהלוח</button></div></div>
          <ConfirmSheet open={!!removing} onOpenChange={(o) => !o && setRemoving(null)} title={removing ? `להסיר את ${removing.name} מהכיתה?` : ''} keep="לא להסיר" confirm="כן, להסיר" onConfirm={removeStudent}>
            <p>נמחק את ההתקדמות של {removing?.name} מלוח הכיתה, והכניסה לכיתה תיסגר. התרגול שנשמר במכשיר עצמו נשאר. כדי שלא תהיה הצטרפות מחדש באותו שם, נעלו את הכיתה.</p>
          </ConfirmSheet>
          <ConfirmSheet open={confirmOut} onOpenChange={setConfirmOut} title="לצאת מהלוח?" keep="להישאר בלוח" confirm="כן, לצאת" onConfirm={() => signOut()}>
            <p>הלוח ייסגר במכשיר הזה. כדי לחזור צריך את קוד הכיתה ואת מפתח המורה.</p>
          </ConfirmSheet>
        </section>
      </main>
    </div>
  );
}
