// מציל המבחנים (Exam Rescue): the exam's date and stairs, a short diagnostic, then a day-by-day plan that follows
// the student's real answers. Never a promised grade. Choosing the topics by photo needs the server (AI); without it
// the topics are chosen by hand, and the screen says so.
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { CalendarClock, Check, Trash2, ClipboardCheck } from 'lucide-react';
import { useApp, today } from '@/lib/store.js';
import { useLearnCtx } from '@/lib/useLearn.js';
import { TOPIC, topicsFor } from '@/content/index.js';
import { examPlan, validInput, DIAG_PER_SKILL } from '@/learn/examRescue.ts';
import { skillId } from '@/learn/skills.ts';
import { titleOf } from '@/learn/recommend.ts';
import { aiReady } from '@/lib/ai.js';
import { MathText } from '@/components/MathText.jsx';
import { Button, Sheet } from '@/components/ui.jsx';
import PageHero from '@/components/PageHero.jsx';

const CONF = [{ v: 1, label: 'לא בטוחים בכלל' }, { v: 2, label: 'קצת בטוחים' }, { v: 3, label: 'די בטוחים' }, { v: 4, label: 'בטוחים' }];
const MINUTES = [10, 15, 20, 30];
const STANDING = { mastered: 'שולטים לבד', ready: 'עברו את הבדיקה הראשונה', shaky: 'כמעט', gap: 'צריך לעבוד', untested: 'עוד לא נבדק' };
const dayName = (d) => { const t = today(); if (d === t) return 'היום'; const x = new Date(`${d}T12:00:00`); return x.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'numeric' }); };

function Setup({ onSave }) {
  const grade0 = useApp((s) => s.profile?.grade) || '7';
  const [grade, setGrade] = useState(grade0);
  const [date, setDate] = useState('');
  const [skills, setSkills] = useState([]);
  const [confidence, setConfidence] = useState(2);
  const [minutes, setMinutes] = useState(15);
  const [error, setError] = useState(null);
  const topics = topicsFor(grade);
  const toggle = (id) => setSkills((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const toggleTopic = (t) => { const ids = t.levels.map((_, i) => skillId(t.id, i + 1)); const all = ids.every((x) => skills.includes(x)); setSkills((s) => (all ? s.filter((x) => !ids.includes(x)) : [...new Set([...s, ...ids])])); };
  const submit = (e) => {
    e.preventDefault();
    const input = { grade, date, skills, confidence, minutes };
    const err = validInput(input, today());
    if (err) { setError(err); return; }
    onSave(input);
  };
  return (
    <form className="rescue-form" onSubmit={submit} noValidate>
      <fieldset className="field"><legend className="field-label">כיתה</legend>
        <div className="opt-row" role="radiogroup">{['7', '8'].map((g) => <label key={g} className={clsx('opt', grade === g && 'on')}><input type="radio" name="grade" value={g} checked={grade === g} onChange={() => { setGrade(g); setSkills([]); }} />כיתה {g === '7' ? 'ז׳' : 'ח׳'}</label>)}</div>
      </fieldset>
      <div className="field">
        <label htmlFor="exam-date" className="field-label">מתי המבחן?</label>
        <input id="exam-date" type="date" className="input" min={today()} value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <fieldset className="field"><legend className="field-label">מה יהיה במבחן?</legend>
        <p className="field-hint">{aiReady() ? 'בחרו את המדרגות שיהיו במבחן.' : 'בחרו את המדרגות שיהיו במבחן. צילום של רשימת הנושאים מהמורה יעבוד כשהעוזר החכם מחובר; בגרסה הזאת בוחרים ידנית.'}</p>
        {topics.map((t) => {
          const ids = t.levels.map((_, i) => skillId(t.id, i + 1));
          const all = ids.every((x) => skills.includes(x));
          return (
            <div key={t.id} className={clsx('rescue-topic', `ch-${t.color}`)}>
              <label className="check-row topic-row"><input type="checkbox" checked={all} onChange={() => toggleTopic(t)} /><span>{t.title} (כל הנושא)</span></label>
              <div className="rescue-stairs">
                {t.levels.map((L, i) => { const id = skillId(t.id, i + 1); return <label key={id} className="check-row"><input type="checkbox" checked={skills.includes(id)} onChange={() => toggle(id)} /><span>{L.title}</span></label>; })}
              </div>
            </div>
          );
        })}
      </fieldset>
      <fieldset className="field"><legend className="field-label">כמה אתם מרגישים בטוחים?</legend>
        <div className="opt-row" role="radiogroup">{CONF.map((c) => <label key={c.v} className={clsx('opt', confidence === c.v && 'on')}><input type="radio" name="conf" checked={confidence === c.v} onChange={() => setConfidence(c.v)} />{c.label}</label>)}</div>
      </fieldset>
      <fieldset className="field"><legend className="field-label">כמה דקות ביום יש לכם?</legend>
        <div className="opt-row" role="radiogroup">{MINUTES.map((m) => <label key={m} className={clsx('opt', minutes === m && 'on')}><input type="radio" name="min" checked={minutes === m} onChange={() => setMinutes(m)} />{m}</label>)}</div>
      </fieldset>
      {error && <p className="form-error" role="alert">{error}</p>}
      <Button type="submit" className="btn-block btn-lg">לבניית התוכנית</Button>
    </form>
  );
}

function Plan({ plan }) {
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const setExam = useApp((s) => s.setExam);
  const ctx = useLearnCtx();
  const p = useMemo(() => examPlan(plan, ctx.learn, ctx.now, ctx.day), [plan, ctx]);
  return (
    <div className="rescue-plan">
      <div className="rescue-msg" role="status"><CalendarClock size={22} aria-hidden="true" /><p>{p.message}</p></div>
      {!p.diagnosed ? (
        <Button className="btn-block btn-lg" onClick={() => navigate('/rescue/check')}><ClipboardCheck size={20} aria-hidden="true" />לבדיקה הקצרה ({plan.skills.length * DIAG_PER_SKILL} שאלות)</Button>
      ) : (
        <>
          <section aria-labelledby="days-title">
            <h2 id="days-title" className="h-section">התוכנית</h2>
            <ol className="rescue-days">
              {p.days.map((d) => (
                <li key={d.day} className={clsx('rescue-day', d.day === today() && 'today')}>
                  <p className="rescue-day-name">{dayName(d.day)}</p>
                  <ul className="plain-list">
                    {d.tasks.map((t, i) => (
                      <li key={i} className="rescue-task">
                        <span><MathText text={t.title} /></span>
                        {d.day === today() && <Button variant={i === 0 ? 'primary' : 'ghost'} className="btn-sm" onClick={() => navigate(t.to)}>{i === 0 ? 'מתחילים' : 'פתיחה'}</Button>}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </section>
          <section aria-labelledby="standing-title">
            <h2 id="standing-title" className="h-section">איפה אתם עומדים</h2>
            <ul className="rescue-standing">
              {p.skills.map((s) => (
                <li key={s.skill} className={clsx('standing-row', `st-${s.standing}`)}>
                  <span className="standing-badge">{s.standing === 'mastered' && <Check size={14} strokeWidth={3} aria-hidden="true" />}{STANDING[s.standing]}</span>
                  <span className="standing-name">{TOPIC[s.skill.split(':')[0]].title}: {titleOf(s.skill)}</span>
                  <span className="standing-why">{s.why}</span>
                </li>
              ))}
            </ul>
            <dl className="standing-legend">
              <div><dt>שולטים לבד</dt><dd>עברתם בדיקת שליטה: 5 שאלות בלי רמזים, ו־4 לפחות נכונות.</dd></div>
              <div><dt>עברו את הבדיקה הראשונה</dt><dd>ענו נכון על שתי שאלות הבדיקה. סימן טוב שאתם כנראה מוכנים, אבל זו עוד לא שליטה: בדיקת שליטה קצרה תאשר.</dd></div>
            </dl>
          </section>
          <Button variant="secondary" className="btn-block" onClick={() => navigate('/rescue/exam')}>מבחן תרגול על כל הנושאים</Button>
        </>
      )}
      <p className="field-hint rescue-honest">התוכנית לא מבטיחה ציון. היא מראה מה כבר יודעים, על מה כדאי לעבוד, ומתעדכנת לפי התשובות שלכם.</p>
      <Button variant="danger-outline" className="btn-block btn-sm" onClick={() => setConfirm(true)}><Trash2 size={16} aria-hidden="true" />מבחן אחר / מחיקת התוכנית</Button>
      <Sheet open={confirm} onOpenChange={setConfirm} title="למחוק את התוכנית?">
        <p className="lead">התשובות שלכם נשמרות בתרגול. רק התוכנית של המבחן הזה תימחק.</p>
        <Button className="btn-block" onClick={() => setConfirm(false)}>להשאיר</Button>
        <Button variant="danger-outline" className="btn-block" onClick={() => { setExam(null); setConfirm(false); }}>למחוק</Button>
      </Sheet>
    </div>
  );
}

export default function Rescue() {
  const exam = useApp((s) => s.learn.exam);
  const setExam = useApp((s) => s.setExam);
  return (
    <div className="page rescue">
      <PageHero tone="exams" title="מציל המבחנים" sub={exam ? 'התוכנית שלכם עד המבחן. היא מתעדכנת אחרי כל תרגול.' : 'תאריך, נושאים ובדיקה קצרה, ואז תוכנית יום אחרי יום.'} scene="sheet" mood="happy" />
      {exam ? <Plan plan={exam} /> : <Setup onSave={(input) => setExam(input)} />}
    </div>
  );
}
