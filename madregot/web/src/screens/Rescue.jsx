// מציל המבחנים (Exam Rescue): the exam's date and stairs, a short diagnostic, then a day-by-day plan that follows
// the student's real answers. Never a promised grade. Choosing the topics by photo needs the server (AI); without it
// the topics are chosen by hand, and the screen says so.
// Today's steps and their start button are the plan's (learn/next.ts planNext().examToday), so Rescue, the mission's
// exam step and the home's next step always name the same step. On Shabbat there are none.
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { CalendarClock, Check, Trash2, ClipboardCheck, ArrowRight, Star, Trophy } from 'lucide-react';
import { useApp, today } from '@/lib/store.js';
import { useLearnCtx, useNext } from '@/lib/useLearn.js';
import { TOPIC, rescueTopicsFor } from '@/content/index.js';
import { examPlan, validInput, isShabbatDay, DIAG_PER_SKILL } from '@/learn/examRescue.ts';
import { skillId } from '@/learn/skills.ts';
import { titleOf } from '@/learn/recommend.ts';
import { ensureTopics } from '@/learn/content/index.ts';
import { aiReady } from '@/lib/ai.js';
import { MathText } from '@/components/MathText.jsx';
import { Button } from '@/components/ui.jsx';
import { ScreenBar, ConfirmSheet } from '@/components/Screen.jsx';
import { Segments } from '@/components/ds.jsx';

const CONF = [{ v: 1, label: 'לא בטוחים בכלל' }, { v: 2, label: 'קצת בטוחים' }, { v: 3, label: 'די בטוחים' }, { v: 4, label: 'בטוחים' }];
const MINUTES = [10, 15, 20, 30];
const ORDER = ['mastered', 'ready', 'shaky', 'gap', 'untested'];
// the day path winds like the map's path
const DAY_SWING = [0, 48, 72, 48, 0, -48, -72, -48];
const STANDING = { mastered: 'שולטים לבד', ready: 'עברו את הבדיקה הראשונה', shaky: 'כמעט', gap: 'צריך לעבוד', untested: 'עוד לא נבדק' };
const dayName = (d) => { const t = today(); if (d === t) return 'היום'; const x = new Date(`${d}T12:00:00`); return x.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'numeric' }); };

const ASK = ['מתי המבחן?', 'מה יהיה במבחן?', 'כמה אתם מרגישים בטוחים?', 'כמה דקות ביום יש לכם?'];

/**
 * The exam's details, asked like Duolingo's onboarding: one question per screen, a progress bar and the way back on
 * top, מדי asking in a speech bubble, the options under it, and one full-width button at the bottom that is off
 * until the question has an answer.
 */
function Setup({ onSave }) {
  const navigate = useNavigate();
  const grade0 = useApp((s) => s.profile?.grade) || '7';
  const [step, setStep] = useState(0);
  const [grade, setGrade] = useState(grade0);
  const [date, setDate] = useState('');
  const [skills, setSkills] = useState([]);
  const [confidence, setConfidence] = useState(2);
  const [minutes, setMinutes] = useState(15);
  const [error, setError] = useState(null);
  const topics = rescueTopicsFor(grade);
  const toggle = (id) => setSkills((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const toggleTopic = (t) => { const ids = t.levels.map((_, i) => skillId(t.id, i + 1)); const all = ids.every((x) => skills.includes(x)); setSkills((s) => (all ? s.filter((x) => !ids.includes(x)) : [...new Set([...s, ...ids])])); };
  const can = step === 0 ? !!date && date >= today() : step === 1 ? skills.length > 0 : true;
  const last = step === ASK.length - 1;
  const submit = (e) => {
    e.preventDefault();
    if (!can) return;
    // a date on Shabbat is a typo: said right away, on the date's own screen
    if (step === 0 && isShabbatDay(date)) { setError(validInput({ grade, date, skills: ['x'], minutes }, today())); return; }
    if (!last) { setStep(step + 1); setError(null); return; }
    const input = { grade, date, skills, confidence, minutes };
    const err = validInput(input, today());
    if (err) { setError(err); return; }
    onSave(input);
  };
  return (
    <form className="ob ob-flow rescue-flow" onSubmit={submit} noValidate>
      <header className="ob-top" data-region="header">
        <button type="button" className="icon-btn" onClick={() => (step ? setStep(step - 1) : navigate(-1))} aria-label="חזרה"><ArrowRight size={26} aria-hidden="true" /></button>
        <div className="ob-bar" role="progressbar" aria-label="פרטי המבחן" aria-valuemin={0} aria-valuemax={ASK.length} aria-valuenow={step + 1}><i style={{ width: `${((step + 1) / ASK.length) * 100}%` }} /></div>
      </header>
      <main className="ob-main" data-region="content">
        <div className="ob-ask" data-region="question">
          <p className="ob-bubble" id="rs-q">{ASK[step]}</p>
        </div>
        {step === 0 && (
          <>
            <div className="ob-opts ob-opts-row" role="radiogroup" aria-label="כיתה">
              {['7', '8'].map((g) => <button key={g} type="button" role="radio" aria-checked={grade === g} className={clsx('ob-opt', grade === g && 'on')} onClick={() => { setGrade(g); setSkills([]); }}><span className="ob-opt-text"><b>כיתה {g === '7' ? 'ז׳' : 'ח׳'}</b></span></button>)}
            </div>
            <div className="field">
              <label htmlFor="exam-date" className="field-label">תאריך המבחן</label>
              <input id="exam-date" type="date" className="input" min={today()} value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </>
        )}
        {step === 1 && (
          <div className="rescue-topics" data-region="answers">
            <p className="field-hint">{aiReady() ? 'בחרו את המדרגות שיהיו במבחן.' : 'בחרו את המדרגות שיהיו במבחן. צילום של רשימת הנושאים מהמורה יעבוד כשהעוזר החכם מחובר; בגרסה הזאת בוחרים ידנית.'}</p>
            {topics.map((t) => {
              const ids = t.levels.map((_, i) => skillId(t.id, i + 1));
              const all = ids.every((x) => skills.includes(x));
              const some = ids.filter((x) => skills.includes(x)).length;
              // a topic of an earlier grade is revision and says so ("מכיתה ז׳"); Pythagoras, filed under ח׳, is taught in
              // ז׳ too by this year's programme, so for ז׳ it is simply one of theirs
              const earlier = Number(t.grade) < Number(grade);
              return (
                <fieldset key={t.id} className={clsx('rescue-topic', `ch-${t.color}`)}>
                  <legend className="visually-hidden">{t.title}</legend>
                  <div className="rescue-topic-head">
                    <label className="check-row topic-row"><input type="checkbox" checked={all} onChange={() => toggleTopic(t)} /><span>{t.title}{earlier ? ` מכיתה ${t.grade === '7' ? 'ז׳' : 'ח׳'}` : ''} (כל הנושא)</span></label>
                    {some > 0 && <span className="rescue-topic-count">{some}/{ids.length}</span>}
                  </div>
                  <div className="stair-chips">
                    {t.levels.map((L, i) => { const id = skillId(t.id, i + 1); const on = skills.includes(id); return <label key={id} className={clsx('chip-toggle', on && 'on')}><input type="checkbox" checked={on} onChange={() => toggle(id)} />{on && <Check size={15} strokeWidth={3} aria-hidden="true" />}<span>{L.title}</span></label>; })}
                  </div>
                </fieldset>
              );
            })}
          </div>
        )}
        {step === 2 && (
          <div className="ob-opts" role="radiogroup" aria-labelledby="rs-q" data-region="answers">
            {CONF.map((c) => <button key={c.v} type="button" role="radio" aria-checked={confidence === c.v} className={clsx('ob-opt', confidence === c.v && 'on')} onClick={() => setConfidence(c.v)}><span className="ob-opt-text"><b>{c.label}</b></span></button>)}
          </div>
        )}
        {step === 3 && (
          <div className="ob-opts" role="radiogroup" aria-labelledby="rs-q" data-region="answers">
            {MINUTES.map((m) => <button key={m} type="button" role="radio" aria-checked={minutes === m} className={clsx('ob-opt', minutes === m && 'on')} onClick={() => setMinutes(m)}><span className="ob-opt-text"><b>{m} דקות ביום</b></span></button>)}
          </div>
        )}
        {error && <p className="form-error" role="alert">{error}</p>}
      </main>
      <footer className="ob-foot" data-region="footer">
        <Button type="submit" className="btn-block btn-lg" disabled={!can}>{last ? `לבניית התוכנית (${skills.length} מדרגות)` : 'המשך'}</Button>
      </footer>
    </form>
  );
}

function Plan({ plan }) {
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const setExam = useApp((s) => s.setExam);
  const ctx = useLearnCtx();
  const p = useMemo(() => examPlan(plan, ctx.learn, ctx.now, ctx.day), [plan, ctx]);
  // the diagnostic and the practice exam ask from the exam topics' teaching content: fetched while the plan is read, so
  // the check opens at once (the lesson screen waits for it too, lib/lesson.js lessonTopics)
  useEffect(() => { ensureTopics(plan.skills).catch(() => {}); }, [plan.skills]);
  const { examToday, restDay } = useNext();
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
        <>
          {/* on Shabbat the plan asks nothing: the short check waits, and can still be done by choice */}
          {restDay && <p className="rescue-rest" role="status">היום שבת, ואין בו משימות. ממשיכים אחריה.</p>}
          <Button variant={restDay ? 'secondary' : 'primary'} className="btn-block btn-lg" onClick={() => navigate(examToday[0]?.to || '/rescue/check')}><ClipboardCheck size={20} aria-hidden="true" />לבדיקה הקצרה ({plan.skills.length * DIAG_PER_SKILL} שאלות)</Button>
        </>
      ) : (
        <>
          <section className="card readiness" aria-labelledby="ready-title">
            <div className="mission-progress-top"><h2 id="ready-title" className="h-section">המוכנות שלכם</h2><span className="readiness-count">שולטים לבד ב־{p.mastered} מתוך {p.total}</span></div>
            <Segments size="thick" steps={[...p.skills].sort((x, y) => ORDER.indexOf(x.standing) - ORDER.indexOf(y.standing)).map((x) => x.standing)} label="המוכנות למבחן" valueText={`שולטים לבד ב־${p.mastered} מתוך ${p.total} מדרגות`} />
            <ul className="readiness-legend">
              {ORDER.filter((k) => p.skills.some((x) => x.standing === k)).map((k) => <li key={k}><i className={`rs-${k}`} aria-hidden="true" />{STANDING[k]}: {p.skills.filter((x) => x.standing === k).length}</li>)}
            </ul>
          </section>
          {/* the days as a path, as Duolingo draws a unit: one stop per day on a winding road, today's stop open
              with its tasks and its button, the exam a trophy at the end */}
          <section aria-labelledby="days-title" className="day-path-wrap">
            <h2 id="days-title" className="h-section">התוכנית יום אחרי יום</h2>
            <ol className="rescue-days day-path">
              {p.days.map((d, k) => {
                const isToday = d.day === today();
                // today's steps are the plan's, in its order; the other days are Rescue's calendar
                const tasks = isToday ? examToday : d.tasks;
                return (
                  <li key={d.day} className={clsx('rescue-day', isToday && 'today')} style={{ '--x': `${DAY_SWING[k % DAY_SWING.length]}px` }}>
                    {isToday && <span className="day-start" aria-hidden="true">היום</span>}
                    <span className="day-node" aria-hidden="true">{isToday ? <Star size={30} fill="currentColor" /> : k + 1}</span>
                    <p className="rescue-day-name">{dayName(d.day)}</p>
                    <ul className={clsx('plain-list', 'day-tasks', !isToday && 'visually-hidden')}>
                      {tasks.map((t, i) => (
                        <li key={i} className="rescue-task">
                          <span><MathText text={t.title} /></span>
                          {isToday && <Button variant={i === 0 ? 'primary' : 'ghost'} className="btn-sm" onClick={() => navigate(t.to)}>{i === 0 ? 'מתחילים' : 'פתיחה'}</Button>}
                        </li>
                      ))}
                    </ul>
                    {!isToday && <p className="day-count" aria-hidden="true">{tasks.length === 1 ? 'משימה אחת' : `${tasks.length} משימות`}</p>}
                  </li>
                );
              })}
              <li className="day-exam" style={{ '--x': `${DAY_SWING[p.days.length % DAY_SWING.length]}px` }}>
                <span className="day-node day-node-exam" aria-hidden="true"><Trophy size={30} /></span>
                <p className="rescue-day-name">המבחן: {dayName(plan.date)}</p>
              </li>
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
      <ConfirmSheet open={confirm} onOpenChange={setConfirm} title="למחוק את התוכנית?" keep="להשאיר" confirm="למחוק" onConfirm={() => { setExam(null); setConfirm(false); }}>
        <p>התשובות שלכם נשמרות בתרגול. רק התוכנית של המבחן הזה תימחק.</p>
      </ConfirmSheet>
    </div>
  );
}

export default function Rescue() {
  const exam = useApp((s) => s.learn.exam);
  const setExam = useApp((s) => s.setExam);
  // no plan yet: the question flow takes the whole screen (no tab bar), as an onboarding does
  if (!exam) return <Setup onSave={(input) => setExam(input)} />;
  return (
    <div className="page pushed rescue">
      <ScreenBar title="מציל המבחנים" back="/quests" />
      <Plan plan={exam} />
    </div>
  );
}
