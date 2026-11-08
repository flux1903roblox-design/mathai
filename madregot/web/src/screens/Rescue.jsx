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
import { Riser } from '@/components/ds.jsx';

const CONF = [{ v: 1, label: 'לא בטוחים בכלל' }, { v: 2, label: 'קצת בטוחים' }, { v: 3, label: 'די בטוחים' }, { v: 4, label: 'בטוחים' }];
const MINUTES = [10, 15, 20, 30];
const ORDER = ['mastered', 'ready', 'shaky', 'gap', 'untested'];
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
      <section className="card rescue-step" aria-labelledby="rs-1">
        <h2 id="rs-1" className="rescue-step-head"><span className="rescue-step-n" aria-hidden="true">1</span>מתי המבחן?</h2>
        <fieldset className="field"><legend className="field-label">כיתה</legend>
          <div className="opt-row" role="radiogroup">{['7', '8'].map((g) => <label key={g} className={clsx('opt', grade === g && 'on')}><input type="radio" name="grade" value={g} checked={grade === g} onChange={() => { setGrade(g); setSkills([]); }} />כיתה {g === '7' ? 'ז׳' : 'ח׳'}</label>)}</div>
        </fieldset>
        <div className="field">
          <label htmlFor="exam-date" className="field-label">תאריך המבחן</label>
          <input id="exam-date" type="date" className="input" min={today()} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </section>
      <section className="card rescue-step" aria-labelledby="rs-2">
        <h2 id="rs-2" className="rescue-step-head"><span className="rescue-step-n" aria-hidden="true">2</span>מה יהיה במבחן?</h2>
        <p className="field-hint">{aiReady() ? 'בחרו את המדרגות שיהיו במבחן.' : 'בחרו את המדרגות שיהיו במבחן. צילום של רשימת הנושאים מהמורה יעבוד כשהעוזר החכם מחובר; בגרסה הזאת בוחרים ידנית.'}</p>
        {topics.map((t) => {
          const ids = t.levels.map((_, i) => skillId(t.id, i + 1));
          const all = ids.every((x) => skills.includes(x));
          const some = ids.filter((x) => skills.includes(x)).length;
          return (
            <fieldset key={t.id} className={clsx('rescue-topic', `ch-${t.color}`)}>
              <legend className="visually-hidden">{t.title}</legend>
              <div className="rescue-topic-head">
                <label className="check-row topic-row"><input type="checkbox" checked={all} onChange={() => toggleTopic(t)} /><span>{t.title} (כל הנושא)</span></label>
                {some > 0 && <span className="rescue-topic-count">{some}/{ids.length}</span>}
              </div>
              <div className="stair-chips">
                {t.levels.map((L, i) => { const id = skillId(t.id, i + 1); const on = skills.includes(id); return <label key={id} className={clsx('chip-toggle', on && 'on')}><input type="checkbox" checked={on} onChange={() => toggle(id)} />{on && <Check size={15} strokeWidth={3} aria-hidden="true" />}<span>{L.title}</span></label>; })}
              </div>
            </fieldset>
          );
        })}
      </section>
      <section className="card rescue-step" aria-labelledby="rs-3">
        <h2 id="rs-3" className="rescue-step-head"><span className="rescue-step-n" aria-hidden="true">3</span>כמה זמן ובאיזו הרגשה?</h2>
        <fieldset className="field"><legend className="field-label">כמה אתם מרגישים בטוחים?</legend>
          <div className="opt-row" role="radiogroup">{CONF.map((c) => <label key={c.v} className={clsx('opt', confidence === c.v && 'on')}><input type="radio" name="conf" checked={confidence === c.v} onChange={() => setConfidence(c.v)} />{c.label}</label>)}</div>
        </fieldset>
        <fieldset className="field"><legend className="field-label">כמה דקות ביום יש לכם?</legend>
          <div className="opt-row" role="radiogroup">{MINUTES.map((m) => <label key={m} className={clsx('opt', minutes === m && 'on')}><input type="radio" name="min" checked={minutes === m} onChange={() => setMinutes(m)} />{m}</label>)}</div>
        </fieldset>
      </section>
      <div className="rescue-submit">
        {error && <p className="form-error" role="alert">{error}</p>}
        <Button type="submit" className="btn-block btn-lg">לבניית התוכנית{skills.length > 0 && ` (${skills.length} מדרגות)`}</Button>
      </div>
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
      <section className="rescue-hero" aria-label="הזמן עד המבחן">
        <div className="rescue-count" aria-hidden="true"><b>{p.daysLeft}</b><span>{p.daysLeft === 1 ? 'יום' : 'ימים'}</span></div>
        <div className="rescue-hero-text">
          <p className="rescue-hero-title"><CalendarClock size={18} aria-hidden="true" /> {p.daysLeft === 0 ? 'המבחן היום' : `המבחן: ${dayName(plan.date)}`}</p>
          <div className="rescue-msg rescue-hero-msg" role="status"><p>{p.message}</p></div>
        </div>
      </section>
      {!p.diagnosed ? (
        <Button className="btn-block btn-lg" onClick={() => navigate('/rescue/check')}><ClipboardCheck size={20} aria-hidden="true" />לבדיקה הקצרה ({plan.skills.length * DIAG_PER_SKILL} שאלות)</Button>
      ) : (
        <>
          <section className="card readiness" aria-labelledby="ready-title">
            <div className="mission-progress-top"><h2 id="ready-title" className="h-section">המוכנות שלכם</h2><span className="readiness-count">שולטים לבד ב־{p.mastered} מתוך {p.total}</span></div>
            <Riser size="lg" steps={[...p.skills].sort((x, y) => ORDER.indexOf(x.standing) - ORDER.indexOf(y.standing)).map((x) => x.standing)} label="המוכנות למבחן" valueText={`שולטים לבד ב־${p.mastered} מתוך ${p.total} מדרגות`} />
            <ul className="readiness-legend">
              {ORDER.filter((k) => p.skills.some((x) => x.standing === k)).map((k) => <li key={k}><i className={`rs-${k}`} aria-hidden="true" />{STANDING[k]}: {p.skills.filter((x) => x.standing === k).length}</li>)}
            </ul>
          </section>
          <section aria-labelledby="days-title">
            <h2 id="days-title" className="h-section">התוכנית יום אחרי יום</h2>
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
      <PageHero tone="streak" title="מציל המבחנים" sub={exam ? 'התוכנית שלכם עד המבחן. היא מתעדכנת אחרי כל תרגול.' : 'תאריך, נושאים ובדיקה קצרה, ואז תוכנית יום אחרי יום.'} scene="sheet" mood="happy" />
      {exam ? <Plan plan={exam} /> : <Setup onSave={(input) => setExam(input)} />}
    </div>
  );
}
