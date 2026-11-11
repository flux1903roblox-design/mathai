// A stair's journey: understand, see an example, solve together, practise alone, prove it alone.
// Laid out like a Brilliant course page: the stair's header with the next step and its button, then the five stages
// as an outline, each a node on one line, done ones checked and the current one filled.
// The student sees where they are, what each stage is, what "mastered" means, and can go to any stage.
// A stair that has a challenge task shows a sixth card under the five stages, "אתגר · לבחירה" (CURRICULUM-6.3): locked
// until the mastery check is passed, then one tap opens the task. It is optional, so it is not one of the stages.
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { Check, Lightbulb, BookOpen, Users, PencilLine, Award, HelpCircle, School, Puzzle, Lock } from 'lucide-react';
import { useApp } from '@/lib/store.js';
import { TOPIC } from '@/content/index.js';
import { useStairContent } from '@/learn/useStairContent.js';
import { skillId } from '@/learn/skills.ts';
import { masteryState, nextStage, STATE_LABEL, MASTERY_RULES, MASTERY_N, daysBetween } from '@/learn/mastery.ts';
import { openMisconceptions } from '@/learn/misconceptions.ts';
import { routeOf } from '@/learn/recommend.ts';
import { challengesAfter, isSolved } from '@/learn/challenges/index.ts';
import { LESSON_LEN, PARTS } from '@/lib/lesson.js';
import { unitNodes } from '@/lib/path.js';
import { MathText } from '@/components/MathText.jsx';
import { inDays } from '@/content/util.js';
import { Button, ChapterMark } from '@/components/ui.jsx';
import TutorSheet from '@/components/learn/TutorSheet.jsx';
import { ScreenBar, ScreenFoot, EmptyState } from '@/components/Screen.jsx';
import { Segments } from '@/components/ds.jsx';
import { workBanner } from '@/lib/classWork.js';
import { Emblem } from '@/components/map/Scenery.jsx';
import '@/styles/lazy/journey.css'; // this screen's own rules, loaded with it (STUDENT-15)

export const CHALLENGE_CARD = 'אתגר · לבחירה';
export const CHALLENGE_LOCKED = 'נפתח אחרי בדיקת השליטה';

/** The stair's challenge tasks: one locked card until the mastery check is passed, then a card per task. */
function ChallengeCards({ skill, mastered }) {
  const navigate = useNavigate();
  const recs = useApp((s) => s.learn.challenges);
  const tasks = challengesAfter(skill);
  if (!tasks.length) return null;
  return (
    <ul className="journey-challenges" aria-label="אתגר לבחירה">
      {!mastered ? (
        <li className="jchallenge locked">
          <span className="jchallenge-icon" aria-hidden="true"><Lock size={20} /></span>
          <div className="jchallenge-text">
            <p className="jchallenge-title">{CHALLENGE_CARD}</p>
            <p className="jchallenge-sub">{CHALLENGE_LOCKED}</p>
          </div>
        </li>
      ) : tasks.map((task) => {
        const solved = isSolved(task, recs);
        const go = solved ? 'שוב' : 'לאתגר';
        return (
          <li key={task.id} className={clsx('jchallenge', solved && 'solved')}>
            <span className="jchallenge-icon" aria-hidden="true">{solved ? <Check size={20} strokeWidth={3} /> : <Puzzle size={20} />}</span>
            <div className="jchallenge-text">
              <p className="jchallenge-title">{CHALLENGE_CARD}</p>
              <p className="jchallenge-sub"><MathText text={task.title} /> · {solved ? 'פתרתם' : `${task.minutes} דק׳`}</p>
            </div>
            <Button variant={solved ? 'ghost' : 'secondary'} className="btn-sm" onClick={() => navigate(`/challenge/${task.id}`)} aria-label={`${go}: ${task.title.replace(/\$/g, '')}`}>{go}</Button>
          </li>
        );
      })}
    </ul>
  );
}

const STAGES = [
  { id: 'A', title: 'מבינים את הרעיון', icon: Lightbulb },
  { id: 'B', title: 'דוגמה פתורה', icon: BookOpen },
  { id: 'C', title: 'פותרים יחד', icon: Users },
  { id: 'D', title: 'מתרגלים לבד', icon: PencilLine },
  { id: 'E', title: 'בדיקת שליטה', icon: Award },
];

export default function Journey() {
  const { topic, level: L } = useParams();
  const navigate = useNavigate();
  const level = Number(L);
  const t = TOPIC[topic];
  const skill = skillId(topic, level);
  const rec = useApp((s) => s.learn.skills[skill]);
  const miscon = useApp((s) => s.learn.miscon);
  const path = useApp((s) => s.path);
  const [tutor, setTutor] = useState(false);
  // opened from the teacher's work (?assignment=): one line says so, with the due day (TEACHER-5 §5)
  const [params] = useSearchParams();
  const work = useApp((s) => (s.profile?.token ? s.classWork.assignments.find((a) => a.id === params.get('assignment') && a.skill === skill) : null));
  // the stair's teaching (its topic's file): the loading screen shows until it is here
  const c = useStairContent(skill);
  if (!t || !t.levels[level - 1]) return <div className="page pushed"><ScreenBar title="מדרגה" back="/" backLabel="למפה" /><EmptyState mood="encouraging" title="המדרגה לא נמצאה"><p>אולי הקישור ישן. המסלול שלכם מחכה במפה.</p></EmptyState><ScreenFoot><Link to="/" className="btn btn-primary btn-block btn-lg">חזרה למסלול</Link></ScreenFoot></div>;
  const now = new Date().toISOString();
  const state = masteryState(rec, now);
  const stage = c ? nextStage(rec) : (rec?.attempts?.some((a) => a.purpose === 'practice' && a.ok) ? 'E' : 'D');
  const practiced = (rec?.attempts || []).filter((a) => a.purpose === 'practice' && a.ok).length;
  const node = unitNodes(topic, path).find((n) => n.kind === 'node' && n.level === level);
  const part = node?.state === 'done' ? PARTS : Math.min(PARTS, (node?.parts || 0) + 1);
  const practiceTo = `/lesson/${topic}/${level}?part=${part}&from=journey`;
  const open = openMisconceptions(miscon).filter((m) => m.skill === skill);
  const due = rec?.mastered ? Math.max(0, Math.ceil(daysBetween(now, rec.mastered.due))) : null;

  const toStage = (id) => {
    if (id === 'D') navigate(practiceTo);
    else if (id === 'E') navigate(routeOf.check(skill, 'mastery'));
    else navigate(`/learn/${topic}/${level}/${id}`);
  };
  const status = (id) => {
    if (id === 'D') return practiced >= 6 ? 'done' : practiced ? 'going' : '';
    if (id === 'E') return rec?.mastered ? 'done' : '';
    return rec?.taught?.[id] ? 'done' : '';
  };
  const sub = {
    A: c ? `${c.discover.length} צעדים קצרים, עם דברים שאפשר להזיז` : 'השיעור המלא למדרגה הזאת עוד בהכנה',
    B: c ? `${c.examples.length} דוגמאות, צעד אחר צעד, עם הסיבה לכל צעד` : 'בהכנה',
    C: c ? 'אתם בוחרים את הצעד הבא, ומדי עוזר כשצריך' : 'בהכנה',
    D: `${LESSON_LEN} תרגילים, עם רמז כשצריך${practiced ? ` · ${Math.min(practiced, 6)} מתוך 6 נכונות` : ''}`,
    E: `${MASTERY_N} שאלות בלי רמזים. כך יודעים שזה שלכם.`,
  };
  const cta = { A: 'מתחילים ללמוד', B: 'לדוגמה הפתורה', C: 'פותרים יחד', D: 'לתרגול', E: 'לבדיקת השליטה' }[stage];

  return (
    <div className={clsx('page', 'pushed', 'journey', `ch-${t.color}`)}>
      <ScreenBar title={t.title} back="/" backLabel="למפה" />
      {work && (
        <p className="journey-work"><School size={18} aria-hidden="true" />{workBanner(work.dueOn)}</p>
      )}
      <header className={clsx('journey-head', `ch-${t.color}`)}>
        <ChapterMark color={t.color} n={level} size="lg" />
        <div className="journey-head-text">
          <h1 className="journey-title">{t.levels[level - 1].title}</h1>
          <p className="journey-topic">{t.title} · מדרגה {level}</p>
          <p className={clsx('mastery-chip', `ms-${state}`)}>{STATE_LABEL[state]}{state === 'mastered' && due != null ? ` · בדיקה חוזרת ${inDays(due || 1)}` : ''}</p>
        </div>
        <Emblem topic={t.id} />
      </header>

      <section className="jclimb" aria-labelledby="climb-title" data-region="card">
        <Segments steps={STAGES.map((x) => (status(x.id) === 'done' ? 'done' : stage === x.id ? 'current' : 'todo'))} size="thin" label="השלבים שהושלמו" valueText={`${STAGES.filter((x) => status(x.id) === 'done').length} מתוך 5 שלבים`} />
        <div className="jclimb-next">
          <p className="jclimb-label" id="climb-title">{state === 'mastered' ? 'המדרגה בידיים שלכם. אפשר לחזור לכל שלב' : `הצעד הבא: שלב ${STAGES.findIndex((x) => x.id === stage) + 1} מתוך 5`}</p>
          <Button className="btn-block btn-lg" onClick={() => toStage(stage)}>{cta}</Button>
          <Button variant="ghost" className="btn-block btn-sm" onClick={() => setTutor(true)}><HelpCircle size={18} aria-hidden="true" />שאלה למדי</Button>
        </div>
      </section>

      <h2 className="h-section journey-list-title">חמשת השלבים של המדרגה</h2>
      <ol className="journey-stages" aria-label="שלבי המדרגה" data-region="path">
        {STAGES.map((st) => {
          const s = status(st.id); const Icon = st.icon;
          const disabled = !c && ['A', 'B', 'C'].includes(st.id);
          return (
            <li key={st.id} className={clsx('jstage', s, stage === st.id && 'current', disabled && 'disabled')}>
              <span className="jstage-icon" aria-hidden="true">{s === 'done' ? <Check size={20} strokeWidth={3} /> : <Icon size={20} />}</span>
              <div className="jstage-text">
                <p className="jstage-title">{st.title}{stage === st.id && <span className="level-badge">הצעד הבא</span>}</p>
                <p className="jstage-sub"><MathText text={sub[st.id]} /></p>
              </div>
              {!disabled && <Button variant={stage === st.id ? 'secondary' : 'ghost'} className="btn-sm" onClick={() => toStage(st.id)} aria-label={`${st.title}: ${s === 'done' ? 'שוב' : 'פתיחה'}`}>{s === 'done' ? 'שוב' : 'פתיחה'}</Button>}
            </li>
          );
        })}
      </ol>
      <ChallengeCards skill={skill} mastered={!!rec?.mastered} />

      {c && (
        <section className="journey-goals" aria-labelledby="goals-title">
          <h2 id="goals-title" className="h-section">מה נלמד</h2>
          <ul className="plain-list">{c.objectives.map((o) => <li key={o}><MathText text={o} /></li>)}</ul>
          {c.words?.length > 0 && <p className="journey-words"><span className="journey-words-tag">מילים חדשות:</span> {c.words.join(' · ')}</p>}
        </section>
      )}

      {open.length > 0 && c && (
        <section className="journey-miscon box box-attention" aria-labelledby="mc-title">
          <h2 id="mc-title" className="box-tab">מה עוד מבלבל כאן</h2>
          <div className="box-body">
            {open.map((m) => {
              const def = c.misconceptions.find((x) => x.id === m.id);
              return def ? (
                <div key={m.id} className="mc-row">
                  <p><MathText text={def.title} /></p>
                  <Button variant="secondary" className="btn-sm" onClick={() => navigate(routeOf.repair(skill, m.id))}>לתקן</Button>
                </div>
              ) : null;
            })}
          </div>
        </section>
      )}

      <details className="journey-rules">
        <summary>איך יודעים ששולטים במדרגה?</summary>
        <ul className="plain-list">{MASTERY_RULES.map((r) => <li key={r}>{r}</li>)}</ul>
      </details>

      {!c && (
        <div className="journey-wip">
          <p>השיעור עם ההסבר והדוגמאות למדרגה הזאת עוד נכתב. בינתיים אפשר לתרגל עם רמזים ולעבור בדיקת שליטה.</p>
        </div>
      )}
      <TutorSheet open={tutor} onOpenChange={setTutor} content={c} />
    </div>
  );
}
