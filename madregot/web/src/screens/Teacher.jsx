import { useSearchParams } from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';
import clsx from 'clsx';
import { toast } from 'sonner';
import { Copy, RefreshCw, Hand, TriangleAlert, CircleCheck, CircleAlert, LogOut, Plus, KeyRound, NotebookPen } from 'lucide-react';
import { useApp } from '@/lib/store.js';
import { api, teacherHeaders } from '@/lib/api.js';
import { TOPIC, topicsFor } from '@/content/index.js';
import { Box, Button, ChapterMark, Field, LevelPips } from '@/components/ui.jsx';
import { MathText } from '@/components/MathText.jsx';
import { GradeSwitch } from './Welcome.jsx';
import { artUrl } from '@/components/PageHero.jsx';

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
    <Box tone="ok" title="הכיתה מוכנה">
      <p>תנו לתלמידים את <b>קוד הכיתה</b>. הם בוחרים "אני תלמיד או תלמידה", כותבים שם, מקלידים את הקוד ובוחרים קוד אישי של 4 ספרות.</p>
      <div className="code-pair">
        <div><span className="field-label">קוד כיתה</span><button type="button" className="code-chip" onClick={() => copy(cls.code, 'קוד הכיתה')}><span dir="ltr">{cls.code}</span><Copy size={16} aria-hidden="true" /></button></div>
        <div><span className="field-label">מפתח מורה (רק לכם)</span><button type="button" className="code-chip" onClick={() => copy(cls.key, 'מפתח המורה')}><span dir="ltr">{cls.key}</span><Copy size={16} aria-hidden="true" /></button></div>
      </div>
      <p className="muted">שמרו את מפתח המורה במקום בטוח. בעזרתו פותחים את הלוח ממחשב אחר.</p>
      <Button variant="secondary" className="btn-sm" onClick={onDone}>שמרתי, אפשר להמשיך</Button>
    </Box>
  );
}

function AddClass({ onClose }) {
  const { profile, setProfile } = useApp();
  const [f, setF] = useState({ className: '', grade: '7' }); const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); if (!f.className.trim()) return; setBusy(true);
    try {
      const r = await api('/api/classes', { method: 'POST', body: { teacherName: profile.name, className: f.className, grade: f.grade } });
      const cls = { code: r.code, key: r.teacherKey, className: r.className, grade: r.grade, fresh: true };
      setProfile({ ...profile, classes: [...profile.classes, cls], active: cls.code }); onClose();
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };
  return (
    <form className="add-class" onSubmit={submit}>
      <Field label="שם הכיתה החדשה" id="ac-name"><input id="ac-name" className="input" value={f.className} onChange={(e) => setF({ ...f, className: e.target.value })} maxLength={30} /></Field>
      <div className="field"><span className="field-label" id="ac-grade">שכבה</span><GradeSwitch value={f.grade} onChange={(g) => setF({ ...f, grade: g })} id="ac-grade" /></div>
      <div className="form-actions row"><Button type="submit" disabled={busy}>פתיחה</Button><Button variant="ghost" onClick={onClose}>ביטול</Button></div>
    </form>
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

  return (
    <div className="teacher">
      <header className="t-head">
        <div className="t-brand"><img src={artUrl('teacher')} alt="" className="t-art" /><span><span className="wordmark sm">מדרגות</span><span className="muted">לוח המורה של {profile.name}</span></span></div>
        <div className="t-class">
          {profile.classes.length > 1 ? (
            <select className="input" aria-label="כיתה" value={cls.code} onChange={(e) => setProfile({ ...profile, active: e.target.value })}>
              {profile.classes.map((c) => <option key={c.code} value={c.code}>{c.className}</option>)}
            </select>
          ) : <h1 className="t-class-name">{cls.className}</h1>}
          <button type="button" className="code-chip" onClick={() => copy(cls.code, 'קוד הכיתה')} aria-label={`העתקת קוד הכיתה ${cls.code}`}><span className="muted">קוד</span><span dir="ltr">{cls.code}</span><Copy size={16} aria-hidden="true" /></button>
        </div>
        <div className="t-actions">
          <Button variant="secondary" className="btn-sm" onClick={load}><RefreshCw size={16} aria-hidden="true" />רענון</Button>
          <Button variant="secondary" className="btn-sm" onClick={() => setAdding(true)}><Plus size={16} aria-hidden="true" />כיתה נוספת</Button>
        </div>
      </header>

      <main className="t-main">
        {cls.fresh && <FreshClass cls={cls} onDone={dismissFresh} />}
        {adding && <AddClass onClose={() => setAdding(false)} />}
        {error && <p className="form-error" role="alert">{error}</p>}
        {!data && !error && <p className="muted" role="status">טוענים את נתוני הכיתה…</p>}

        {data && (
          <>
            <dl className="t-strip">
              <div><dt>תרגלו היום</dt><dd>{practicedToday} מתוך {students.length}</dd></div>
              <div><dt>תרגלו השבוע</dt><dd>{practicedWeek} מתוך {students.length}</dd></div>
              <div><dt>נכון בניסיון ראשון השבוע</dt><dd>{weekN ? `${pct(weekFirst, weekN)}%` : 'אין עדיין'}</dd></div>
              <div><dt>בקשות עזרה פתוחות</dt><dd>{openHelp.length}</dd></div>
            </dl>

            <div className="t-tabs" role="tablist" aria-label="תצוגה">
              {[['tomorrow', 'מה עושים מחר'], ['students', 'תלמידים'], ['exams', `מבחנים${data.exams?.length ? ` (${data.exams.length})` : ''}`], ['help', `בקשות עזרה${openHelp.length ? ` (${openHelp.length})` : ''}`]].map(([id, label]) => (
                <button key={id} type="button" role="tab" aria-selected={tab === id} className={clsx('t-tab', tab === id && 'on')} onClick={() => setTab(id)}>{label}</button>
              ))}
            </div>

            {students.length === 0 && (
              <div className="empty-state">
                <img src={artUrl('empty')} alt="" className="empty-art" />
                <h2 className="h-section">עוד אין תלמידים בכיתה</h2>
                <p className="muted">כשתלמידים יצטרפו עם הקוד <b dir="ltr">{cls.code}</b>, הם יופיעו כאן עם ההתקדמות שלהם.</p>
                <Button variant="secondary" className="btn-sm" onClick={() => copy(cls.code, 'קוד הכיתה')}><Copy size={16} aria-hidden="true" />העתקת הקוד</Button>
              </div>
            )}

            {tab === 'tomorrow' && students.length > 0 && (
              <div className="t-grid">
                <Box tone="attention" title="טעויות שחוזרות השבוע">
                  {data.mistakes.length === 0 ? <p className="muted">לא זוהו טעויות שחוזרות.</p> : (
                    <ul className="t-list">
                      {data.mistakes.map((m) => (
                        <li key={`${m.topic}:${m.cat}`}>
                          <span className="t-list-main"><b>{TOPIC[m.topic]?.title}</b>: <MathText text={TOPIC[m.topic]?.cats[m.cat] || m.cat} /></span>
                          <span className="muted">{m.students === 1 ? 'תלמיד אחד' : `${m.students} תלמידים`}: {m.names.slice(0, 6).join(', ')}{m.names.length > 6 ? '…' : ''}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Box>
                {examWeak.length > 0 && (
                  <Box tone="attention" title="נושאים חלשים במבחנים">
                    <ul className="t-list">
                      {examWeak.map((w) => (
                        <li key={w.topic}>
                          <span className="t-list-main"><b>{TOPIC[w.topic]?.title || 'נושא אחר'}</b>: {w.lost === 1 ? 'שאלה אחת עם טעות' : `${w.lost} שאלות עם טעות`}</span>
                          <span className="muted">{w.skills.slice(0, 3).join(', ')}{w.skills.length ? '. ' : ''}{w.names.length === 1 ? w.names[0] : `${w.names.length} תלמידים: ${w.names.slice(0, 6).join(', ')}`}</span>
                        </li>
                      ))}
                    </ul>
                  </Box>
                )}
                <Box tone="note" title="כדאי לבדוק איתם">
                  {attention.length === 0 ? <p className="muted">כולם מתרגלים ומצליחים.</p> : (
                    <ul className="t-list">
                      {attention.map((s) => (
                        <li key={s.id}>
                          <span className="t-list-main"><b>{s.name}</b></span>
                          <span className="muted">{idle(s) ? (s.lastPractice ? `תרגול אחרון ${fmtDay(s.lastPractice)}` : 'עוד לא תרגלו אף פעם') : `נכון בניסיון ראשון: ${pct(s.week.first, s.week.n)}%`}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Box>
                <Box tone="ai" title="בקשות עזרה חדשות">
                  {openHelp.length === 0 ? <p className="muted">אין בקשות פתוחות.</p> : (
                    <ul className="t-list">{openHelp.slice(0, 5).map((h) => <li key={h.id} className={clsx(!h.seen_at && 'unseen')}><span className="t-list-main"><b>{h.name}</b>, {TOPIC[h.topic]?.title || ''}</span><span className="muted">{h.note || <MathText text={h.question} />}</span></li>)}</ul>
                  )}
                  {openHelp.length > 0 && <Button variant="secondary" className="btn-sm" onClick={() => setTab('help')}>לכל הבקשות</Button>}
                </Box>
              </div>
            )}

            {tab === 'students' && students.length > 0 && (
              <div className="table-wrap">
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
                        <td>{s.pinReset ? <span className="muted">קוד אופס</span> : <button type="button" className="link-btn" onClick={() => resetPin(s)}><KeyRound size={14} aria-hidden="true" />איפוס קוד אישי</button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {tab === 'exams' && (
              (data.exams || []).length === 0 ? <p className="muted">עוד אין מבחנים שנבדקו בכיתה. כשתלמידים יבדקו מבחן באפליקציה, התוצאות יופיעו כאן.</p> : (
                <div className="table-wrap">
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
                    <div className="help-item-head"><Hand size={16} aria-hidden="true" /><b>{h.name}</b>{!h.seen_at && !h.done_at && <span className="new-tag">חדש</span>}<span className="muted">{TOPIC[h.topic]?.title}, {fmtDay(h.created_at)}</span></div>
                    <p className="help-q"><MathText text={h.question} /></p>
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

        <section className="section danger-zone t-out">
          {confirmOut ? (
            <div className="form-actions row">
              <span>לצאת מהלוח במכשיר הזה? בלי מפתח המורה לא תוכלו לחזור.</span>
              <Button variant="danger" className="btn-sm" onClick={() => signOut()}>כן, לצאת</Button>
              <Button variant="ghost" className="btn-sm" onClick={() => setConfirmOut(false)}>ביטול</Button>
            </div>
          ) : <Button variant="danger-outline" className="btn-sm" onClick={() => setConfirmOut(true)}><LogOut size={16} aria-hidden="true" />יציאה מהלוח</Button>}
        </section>
      </main>
    </div>
  );
}
