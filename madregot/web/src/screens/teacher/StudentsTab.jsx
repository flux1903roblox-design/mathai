// "תלמידים": the join lock, then a table of the class (last practice, today, days this week, first-try rate and the
// level on each topic of the grade), sorted by name or by "מי צריך תשומת לב" (?sort=need: the score of
// learn/attention.ts, as on "מחר"), and a quiet last row that deletes the whole class (the same sheet as in the class
// settings). Each name, and the row's "פרטים", opens the student's page, where resetting a PIN and removing a student
// now live (TEACHER-8).
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Trash2, ChevronLeft } from 'lucide-react';
import { teacherApi } from '@/lib/teacher.js';
import { classTopicsFor, rowLevel, rowTitle } from '@/content/index.js';
import { rankAll, openHelpBy } from '@/learn/attention';
import { AI_COPY, perStudentAi } from '@/content/classAi.js';
import { useDemo, DEMO_COPY } from '@/lib/demo.js';
import { ChapterMark, LevelPips } from '@/components/ui.jsx';
import { fmtDay, pct, Rate, StudentName } from './common.jsx';
import DeleteClassSheet, { useClassDeleted } from './DeleteClass.jsx';

export const SORTS = [['name', 'לפי שם'], ['need', 'מי צריך תשומת לב']];

export default function StudentsTab({ cls, data, students, onChanged, onStudent }) {
  const [deleting, setDeleting] = useState(false);
  const demo = useDemo();
  const [params, setParams] = useSearchParams();
  const sort = params.get('sort') === 'need' ? 'need' : 'name';
  const setSort = (v) => setParams((p) => { const n = new URLSearchParams(p); n.set('tab', 'students'); if (v === 'need') n.set('sort', 'need'); else n.delete('sort'); return n; }, { replace: true });
  const gone = useClassDeleted();
  // the grade's units, then its guest rows (FUNC-6)
  const topics = classTopicsFor(cls.grade);
  const setLock = async (locked) => {
    try {
      await teacherApi('/api/teacher/class/lock', { method: 'POST', body: { locked } }, cls);
      toast.success(locked ? 'הכיתה נעולה לתלמידים חדשים.' : 'הכיתה פתוחה לתלמידים חדשים.'); onChanged();
    } catch (e) { toast.error(e.message); }
  };
  const day = data.today || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
  const helpBy = openHelpBy(data.help);
  // the student AI switched off for one student (TRUST-11): shown only where the class's students can have it
  const aiBadge = perStudentAi(data.aiPolicy);
  const rows = sort === 'need'
    ? rankAll(students.map((s) => ({ ...s, openHelp: helpBy[s.id] || 0 })), day).map((a) => a.student)
    : [...students].sort((a, b) => a.name.localeCompare(b.name, 'he'));

  return (
    <>
      <section className="set-group t-lock" aria-labelledby="t-lock-title">
        <h2 id="t-lock-title" className="visually-hidden">הצטרפות לכיתה</h2>
        <label className="check-row t-lock-row">
          <input type="checkbox" role="switch" checked={!!data.joinLocked} onChange={(e) => setLock(e.target.checked)} />
          <span>נעילת הכיתה לתלמידים חדשים</span>
        </label>
        <p className="field-hint">תלמידים שכבר בכיתה ממשיכים להיכנס עם הקוד האישי שלהם.</p>
      </section>
      {students.length > 0 && (
        <>
          <div className="field t-sort">
            <label htmlFor="t-sort" className="field-label">סדר הרשימה</label>
            <select id="t-sort" className="input t-sort-select" value={sort} onChange={(e) => setSort(e.target.value)}>
              {SORTS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </div>
          <div className="table-wrap" tabIndex={0} role="region" aria-label="טבלת התלמידים">
            <table className="t-table">
              <thead>
                <tr>
                  <th scope="col">שם</th><th scope="col">תרגול אחרון</th><th scope="col">היום</th><th scope="col">ימים השבוע</th><th scope="col">נכון בניסיון ראשון</th>
                  {topics.map((t, i) => <th key={t.id} scope="col"><span className="th-topic"><ChapterMark color={t.color} n={t.only ? '' : i + 1} size="sm" />{rowTitle(t)}</span></th>)}
                  <th scope="col"><span className="visually-hidden">פרטים</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id}>
                    <th scope="row"><StudentName id={s.id} name={s.name} onOpen={onStudent} /></th>
                    <td>{fmtDay(s.lastPractice)}</td>
                    <td>{s.today.n ? `${s.today.n} תרגילים` : '–'}</td>
                    <td>{s.week.days}</td>
                    <td><Rate value={pct(s.week.first, s.week.n)} /></td>
                    {topics.map((t) => { const r = rowLevel(t, s.levels); return <td key={t.id}>{r ? <LevelPips total={r.total} level={r.level} max={r.max} states={r.states} done={r.done} color={t.color} /> : <span className="muted">–</span>}</td>; })}
                    <td className="t-actions">
                      {s.pinReset && <span className="muted">קוד אופס</span>}
                      {aiBadge && s.aiOff && <span className="t-chip t-ai-off">{AI_COPY.badge}</span>}
                      {onStudent && (
                        <button type="button" className="link-btn" onClick={() => onStudent({ id: s.id, name: s.name })} aria-label={`פרטים על ${s.name}`}>
                          פרטים<ChevronLeft size={16} aria-hidden="true" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <div className="set-rows-wrap t-quiet-rows"><div className="set-rows">
        <button type="button" className="set-row t-quiet-row" onClick={() => setDeleting(true)} disabled={demo} aria-describedby={demo ? 't-demo-delete' : undefined}><Trash2 size={18} aria-hidden="true" />מחיקת הכיתה</button>
      </div></div>
      {demo && <p className="muted t-demo-line" id="t-demo-delete">{DEMO_COPY.noDelete}</p>}
      <DeleteClassSheet cls={cls} open={deleting && !demo} onOpenChange={setDeleting} onDeleted={() => { setDeleting(false); gone(cls); }} />
    </>
  );
}
