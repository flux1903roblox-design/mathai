// מציל המבחנים (Exam Rescue): the exam's date and stairs, a short diagnostic, then a day-by-day plan that follows
// the student's real answers. Never a promised grade. What the test covers can come from its material (EXAM-MATERIAL 1,
// components/rescue/MaterialStep.jsx): the teacher's message pasted (read on the device, with or without a server) or,
// where the smart helper is connected, photographed; either way the student confirms the stairs before the plan is built.
// The evening before the exam (and its morning) the plan is the evening's (learn/examRescue.ts): a rule card and a quick
// check of each stair, practice where the check failed, then the practice exam, within the minutes chosen.
// Today's steps and their start button are the plan's (learn/next.ts planNext().examToday), so Rescue, the mission's
// exam step and the home's next step always name the same step. On Shabbat there are none.
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { CalendarClock, Check, Trash2, ClipboardCheck, ArrowRight, Star, Trophy } from 'lucide-react';
import { useApp, today } from '@/lib/store.js';
import { useLearnCtx, useNext } from '@/lib/useLearn.js';
import { TOPIC, rescueTopicsFor, bridgeTopicsFor, rowStairs } from '@/content/topics.js';
import { examPlan, validInput, isPlanRestDay, REST_DAY_LINE, DIAG_PER_SKILL } from '@/learn/examRescue.ts';
import { matchMaterial, materialCatalogue, fromSyllabus, prepOf } from '@/lib/examMaterial.js';
import { runAI } from '@/lib/ai.js';
import { aiAccess, gate, useAIStatus } from '@/lib/account.js';
import { MaterialCard, PasteMaterial, PhotoMaterial, FoundMaterial, TopicRow, MATERIAL_COPY } from '@/components/rescue/MaterialStep.jsx';
import { skillId } from '@/learn/skills.ts';
import { titleOf } from '@/learn/recommend.ts';
import { ensureTopics } from '@/learn/content/index.ts';
import { aiReady } from '@/lib/ai.js';
import { MathText } from '@/components/MathText.jsx';
import { Button } from '@/components/ui.jsx';
import { ScreenBar, ConfirmSheet } from '@/components/Screen.jsx';
import { Segments } from '@/components/ds.jsx';
import '@/styles/lazy/rescue.css'; // this screen's own rules, loaded with it (STUDENT-15)

const CONF = [{ v: 1, label: 'לא בטוחים בכלל' }, { v: 2, label: 'קצת בטוחים' }, { v: 3, label: 'די בטוחים' }, { v: 4, label: 'בטוחים' }];
const MINUTES = [10, 15, 20, 30];
const ORDER = ['mastered', 'ready', 'shaky', 'gap', 'untested'];
// the day path winds like the map's path
const DAY_SWING = [0, 48, 72, 48, 0, -48, -72, -48];
const STANDING = { mastered: 'שולטים לבד', ready: 'עברו את הבדיקה הראשונה', shaky: 'כמעט', gap: 'צריך לעבוד', untested: 'עוד לא נבדק' };
/** About how long a day of the plan takes (examRescue.ts taskMinutes): an estimate, never a timer. */
const minutesText = (m) => (m === 1 ? 'כדקה' : `כ־${m} דקות`);
const dayName = (d) => { const t = today(); if (d === t) return 'היום'; const x = new Date(`${d}T12:00:00`); return x.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'numeric' }); };

const ASK = ['מתי המבחן?', 'מה יהיה במבחן?', 'כמה אתם מרגישים בטוחים?', 'כמה דקות ביום יש לכם?'];

/** The access states where the photo way is not offered: the helper is not there, or not for this kind here. */
const NO_PHOTO = ['offline', 'locked', 'economy', 'class_off', 'prep_only', 'parent_ok_needed'];

/**
 * The exam's details, asked like Duolingo's onboarding: one question per screen, a progress bar and the way back on
 * top, מדי asking in a speech bubble, the options under it, and one full-width button at the bottom that is off
 * until the question has an answer. "מה יהיה במבחן?" opens with the material (MaterialStep.jsx): pasted, or
 * photographed where the smart helper can read it; what it found is shown ticked, to confirm or edit, and the whole
 * list stays below for choosing by hand.
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
  // the material (EXAM-MATERIAL 1): 'list' the card and the whole list; 'paste' the message; 'photo' the pictures;
  // 'found' what was found, to confirm
  const [mode, setMode] = useState('list');
  const [text, setText] = useState('');
  const [pages, setPages] = useState([]);
  const [reading, setReading] = useState({ phase: 'idle' });
  const [found, setFound] = useState(null);
  const status = useAIStatus((x) => x.status);
  const photoOk = aiReady() && !NO_PHOTO.includes(aiAccess('syllabus', status).state);
  // the bridge unit (fractions) is listed only once the material named it or one of its stairs is chosen
  const bridge = found?.byTopic.some((r) => TOPIC[r.topic]?.bridge) || skills.some((x) => TOPIC[x.split(':')[0]]?.bridge);
  const topics = [...rescueTopicsFor(grade), ...(bridge ? bridgeTopicsFor(grade) : [])];
  const toggle = (id) => setSkills((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  // a row's stairs: the whole unit, or a guest row's own (ז׳'s "מבוא לפונקציות" is func:1 alone, FUNC-6)
  const toggleTopic = (t) => { const ids = rowStairs(t).map((s) => s.id); const all = ids.every((x) => skills.includes(x)); setSkills((s) => (all ? s.filter((x) => !ids.includes(x)) : [...new Set([...s, ...ids])])); };
  const showFound = (f) => { setSkills(f.skills); setFound(f); setMode('found'); };
  const readText = () => showFound({ ...matchMaterial(text, grade), examples: [], source: 'paste' });
  const readPhotos = async () => {
    // the helper is done for today (the calm sheet says so), or this is its first use here (the introduction opens,
    // and the reading runs after it): nothing is sent yet
    if (gate('syllabus', { then: readPhotos })) return;
    setReading({ phase: 'loading' });
    try {
      const catalogue = materialCatalogue(grade);
      const r = await runAI('syllabus', { grade, pages: pages.map(({ data, mediaType }) => ({ data, mediaType })), stairs: catalogue.map((c) => c.id), prep: prepOf(pages) });
      // the helper stopped because a picture worries it: the support card, never "try again"
      if (r.care) { setReading({ phase: 'care' }); return; }
      if (!r.readable) { setReading({ phase: 'error', message: MATERIAL_COPY.unreadable }); return; }
      setReading({ phase: 'idle' });
      showFound(fromSyllabus(r, catalogue));
    } catch (e) {
      setReading(e.limit ? { phase: 'idle' } : { phase: 'error', message: e.message });
    }
  };
  const material = step === 1 && (mode === 'paste' || mode === 'photo');
  const can = step === 0 ? !!date && date >= today()
    : step === 1 ? (mode === 'paste' ? !!text.trim() : mode === 'photo' ? pages.length > 0 && reading.phase !== 'loading' : skills.length > 0) : true;
  const last = step === ASK.length - 1;
  const back = () => {
    if (step === 1 && mode !== 'list') { setMode(mode === 'found' && found?.source === 'photo' ? 'photo' : mode === 'found' ? 'paste' : 'list'); return; }
    if (step) setStep(step - 1); else navigate(-1);
  };
  const submit = (e) => {
    e.preventDefault();
    if (!can) return;
    if (step === 1 && mode === 'paste') { readText(); return; }
    if (step === 1 && mode === 'photo') { readPhotos(); return; }
    // a date on Shabbat or Yom Tov is likely a typo: said right away, calmly, on the date's own screen
    if (step === 0 && isPlanRestDay(date)) { setError(validInput({ grade, date, skills: ['x'], minutes }, today())); return; }
    if (!last) { setStep(step + 1); setError(null); return; }
    const input = { grade, date, skills, confidence, minutes };
    const err = validInput(input, today());
    if (err) { setError(err); return; }
    onSave(input);
  };
  const label = material ? (mode === 'paste' ? MATERIAL_COPY.find : MATERIAL_COPY.read)
    : last ? `לבניית התוכנית (${skills.length} מדרגות)` : 'המשך';
  return (
    <form className="ob ob-flow rescue-flow" onSubmit={submit} noValidate>
      <header className="ob-top" data-region="header">
        <button type="button" className="icon-btn" onClick={back} aria-label="חזרה"><ArrowRight size={26} aria-hidden="true" /></button>
        <div className="ob-bar" role="progressbar" aria-label="פרטי המבחן" aria-valuemin={0} aria-valuemax={ASK.length} aria-valuenow={step + 1}><i style={{ width: `${((step + 1) / ASK.length) * 100}%` }} /></div>
      </header>
      <main className="ob-main" data-region="content">
        <div className="ob-ask" data-region="question">
          <h1 className="ob-bubble" id="rs-q">{ASK[step]}</h1>
        </div>
        {step === 0 && (
          <>
            <div className="ob-opts ob-opts-row" role="radiogroup" aria-label="כיתה">
              {['7', '8'].map((g) => <button key={g} type="button" role="radio" aria-checked={grade === g} className={clsx('ob-opt', grade === g && 'on')} onClick={() => { setGrade(g); setSkills([]); setFound(null); setMode('list'); }}><span className="ob-opt-text"><b>כיתה {g === '7' ? 'ז׳' : 'ח׳'}</b></span></button>)}
            </div>
            <div className="field">
              <label htmlFor="exam-date" className="field-label">תאריך המבחן</label>
              <input id="exam-date" type="date" className="input" min={today()} value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </>
        )}
        {step === 1 && mode === 'list' && (
          <div className="rescue-topics" data-region="answers">
            <MaterialCard onPaste={() => setMode('paste')} onPhoto={photoOk ? () => setMode('photo') : null} />
            <h2 className="material-or">{MATERIAL_COPY.manual}</h2>
            {topics.map((t) => <TopicRow key={t.id} t={t} grade={grade} skills={skills} onToggle={toggle} onToggleTopic={toggleTopic} />)}
          </div>
        )}
        {step === 1 && mode === 'paste' && <PasteMaterial text={text} onText={setText} />}
        {step === 1 && mode === 'photo' && <PhotoMaterial pages={pages} onPages={setPages} state={reading} />}
        {step === 1 && mode === 'found' && found && (
          <div className="rescue-topics">
            <FoundMaterial found={found} rows={topics} grade={grade} skills={skills} onToggle={toggle} onToggleTopic={toggleTopic} titleOf={titleOf} />
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
      {!(step === 1 && mode === 'photo' && reading.phase === 'loading') && (
        <footer className="ob-foot" data-region="footer">
          <Button type="submit" className="btn-block btn-lg" disabled={!can}>{label}</Button>
        </footer>
      )}
    </form>
  );
}

/** One step of the evening: its name, its minutes and its button, whose name says which step it opens (not ten "פתיחה"). */
function EveningStep({ t, i, first, calm }) {
  const navigate = useNavigate();
  const id = `evening-step-${i}`;
  return (
    <li className="rescue-task evening-task">
      <span className="evening-step"><span id={id}><MathText text={t.title} /></span><span className="evening-min">{minutesText(t.minutes)}</span></span>
      <Button id={`${id}-go`} variant={first && !calm ? 'primary' : 'ghost'} className="btn-sm" aria-labelledby={`${id}-go ${id}`} onClick={() => navigate(t.to)}>{first ? 'מתחילים' : 'פתיחה'}</Button>
    </li>
  );
}

/**
 * The evening before the exam, or its morning (EXAM-MATERIAL 2): what is left for today, in order, each with its button
 * and minutes, and an honest total: with what was already done today, within the minutes chosen or past them (said
 * calmly, never hidden); then what does not fit the minutes chosen, apart, ending with the exam on every stair when
 * tonight's covers only tonight's. The steps are the plan's (examToday), the same the home and the mission name. On
 * Shabbat or Yom Tov the same list is shown for after it or the exam's morning (the plan puts nothing on the day itself,
 * and the hero's line says so once).
 */
function Evening({ p, plan, tasks }) {
  const ev = p.evening;
  const list = ev.rest ? p.days[0]?.tasks || [] : tasks;
  const within = `בתוך ${plan.minutes} הדקות שבחרתם`;
  const past = `זה יותר מ־${plan.minutes} הדקות שבחרתם. אפשר לעצור כשהזמן נגמר.`;
  const time = ev.spent > 0
    ? `עוד ${minutesText(ev.minutes)}. ${ev.over ? `עם מה שכבר עשיתם היום, ${past}` : `עם מה שכבר עשיתם היום, זה ${within}.`}`
    : `${minutesText(ev.minutes)}, ${ev.over ? past : `${within}.`}`;
  const doneLine = ev.spent > 0 ? 'עשיתם את כל מה שתכננו להיום. אפשר לנוח.' : 'עשיתם את כל מה שתכננו. אפשר לנוח.';
  const allLater = ev.later.some((t) => t.kind === 'exam');
  return (
    <>
      <section className="card rescue-evening" aria-labelledby="evening-title">
        <h2 id="evening-title" className="h-section">{ev.rest ? 'מה נשאר לפני המבחן' : 'מה נשאר להיום'}</h2>
        {list.length ? (
          <>
            <p className="evening-time">{time}</p>
            {ev.rest && <p className="evening-time">אפשר במוצאי השבת או החג, או מחר בבוקר.</p>}
            <ol className="plain-list evening-tasks">
              {list.map((t, i) => <EveningStep key={`${t.to}-${i}`} t={t} i={i} first={i === 0} calm={ev.rest} />)}
            </ol>
          </>
        ) : <p className="evening-time">{doneLine}</p>}
      </section>
      {ev.later.length > 0 && (
        <section className="card rescue-evening evening-later" aria-labelledby="later-title">
          <h2 id="later-title" className="h-section">אם יש עוד זמן</h2>
          <p className="evening-time">עוד {minutesText(ev.laterMinutes)}, במדרגות שלא נכנסו לזמן שבחרתם{allLater ? ', ובסוף מבחן תרגול על כל הנושאים' : ''}.</p>
          <ul className="plain-list evening-tasks">
            {ev.later.map((t, i) => <EveningStep key={`${t.to}-${i}`} t={t} i={list.length + i} first={false} />)}
          </ul>
        </section>
      )}
    </>
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
      {/* the evening's rest-day line is the hero's (p.message): said once */}
      {p.evening ? <Evening p={p} plan={plan} tasks={examToday} /> : !p.diagnosed ? (
        <>
          {/* on Shabbat and Yom Tov the plan asks nothing: the short check waits, and can still be done by choice */}
          {restDay && <p className="rescue-rest" role="status">{REST_DAY_LINE}</p>}
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
                    <p className="rescue-day-name">{dayName(d.day)}<span className="visually-hidden">{`, ${minutesText(d.minutes)}`}</span></p>
                    <ul className={clsx('plain-list', 'day-tasks', !isToday && 'visually-hidden')}>
                      {tasks.map((t, i) => (
                        <li key={i} className="rescue-task">
                          <span><MathText text={t.title} /></span>
                          {isToday && <Button variant={i === 0 ? 'primary' : 'ghost'} className="btn-sm" onClick={() => navigate(t.to)}>{i === 0 ? 'מתחילים' : 'פתיחה'}</Button>}
                        </li>
                      ))}
                    </ul>
                    {isToday && <p className="day-min" aria-hidden="true">{minutesText(d.minutes)}</p>}
                    {!isToday && <p className="day-count" aria-hidden="true">{tasks.length === 1 ? 'משימה אחת' : `${tasks.length} משימות`} · {minutesText(d.minutes)}</p>}
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
