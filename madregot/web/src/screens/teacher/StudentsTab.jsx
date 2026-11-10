// "תלמידים": the join lock, then a table of the class (last practice, today, days this week, first-try rate and the
// level on each topic of the grade) with resetting a student's PIN and removing a student.
import { useState } from 'react';
import { toast } from 'sonner';
import { KeyRound, UserMinus } from 'lucide-react';
import { api, teacherHeaders } from '@/lib/api.js';
import { topicsFor } from '@/content/index.js';
import { ChapterMark, LevelPips } from '@/components/ui.jsx';
import { ConfirmSheet } from '@/components/Screen.jsx';
import { fmtDay, pct, Rate } from './common.jsx';

export default function StudentsTab({ cls, data, students, onChanged }) {
  const [removing, setRemoving] = useState(null);
  const topics = topicsFor(cls.grade);
  const resetPin = async (s) => {
    try { await api(`/api/teacher/students/${s.id}/reset-pin`, { method: 'POST', body: {}, headers: teacherHeaders(cls) }); toast.success(`הקוד האישי של ${s.name} אופס. בכניסה הבאה הוא יבחר קוד חדש.`); onChanged(); } catch (e) { toast.error(e.message); }
  };
  const setLock = async (locked) => {
    try {
      await api('/api/teacher/class/lock', { method: 'POST', body: { locked }, headers: teacherHeaders(cls) });
      toast.success(locked ? 'הכיתה נעולה לתלמידים חדשים.' : 'הכיתה פתוחה לתלמידים חדשים.'); onChanged();
    } catch (e) { toast.error(e.message); }
  };
  const removeStudent = async () => {
    const st = removing; setRemoving(null);
    try { await api(`/api/teacher/students/${st.id}/remove`, { method: 'POST', body: {}, headers: teacherHeaders(cls) }); toast(`${st.name} הוסר/ה מהכיתה`); onChanged(); } catch (e) { toast.error(e.message); }
  };

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
      <ConfirmSheet open={!!removing} onOpenChange={(o) => !o && setRemoving(null)} title={removing ? `להסיר את ${removing.name} מהכיתה?` : ''} keep="לא להסיר" confirm="כן, להסיר" onConfirm={removeStudent}>
        <p>נמחק את ההתקדמות של {removing?.name} מלוח הכיתה, והכניסה לכיתה תיסגר. התרגול שנשמר במכשיר עצמו נשאר. כדי שלא תהיה הצטרפות מחדש באותו שם, נעלו את הכיתה.</p>
      </ConfirmSheet>
    </>
  );
}
