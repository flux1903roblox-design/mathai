import { useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { Flame, Snowflake, Zap, Check, Target, Route, ChevronLeft, BookOpen, Star, Trophy, Footprints } from 'lucide-react';
import { m, useReducedMotion } from 'motion/react';
import { Progress } from '@base-ui/react/progress';
import { useApp, streakOf, today } from '@/lib/store.js';
import { learnDaysThisMonth, learnDaysTotal, weekStart, weekSteps, bestWeek } from '@/lib/streak.js';
import { useRepair, repairText } from '@/components/learn/RepairCard.jsx';
import { questProgress, GOALS } from '@/lib/quests.js';
import { usePlan } from '@/lib/usePlan.js';
import { Week } from './LessonDone.jsx';
import PageHero from '@/components/PageHero.jsx';
import Lottie from '@/components/Lottie.jsx';
import { EASE } from '@/lib/motion.js';
import TodayCard from '@/components/learn/TodayCard.jsx';
import { markSeen } from '@/lib/classWork.js';
import MyHelp from '@/components/learn/MyHelp.jsx';
import ClassGoalCard, { ClassGoalMoment } from '@/components/learn/ClassGoalCard.jsx';


const QUEST_ICON = { lessons: BookOpen, xp: Zap, combo: Flame, perfect: Star, correct: Target, review: Trophy };
const stepsText = (n) => (n === 1 ? 'צעד אחד' : `${n} צעדים`);

/**
 * השבוע שלי (STUDENT-5): this week's steps against the best earlier week, the solo student's own "league". A lesson, a
 * teaching stage or a check is one step; a passed mastery check is 3. The bar fills toward the best (at least 5).
 */
function WeekBestCard({ days }) {
  const week = weekStart(today());
  const steps = weekSteps(days, week);
  const best = bestWeek(days, week);
  const target = Math.max(best?.steps || 0, 5);
  return (
    <section className="card week-best-card" aria-labelledby="wk-h">
      <h2 id="wk-h" className="card-title"><Footprints size={22} aria-hidden="true" className="brand-icon" />השבוע שלי</h2>
      <p className="wk-line">{steps === 0 ? 'השבוע עוד לא התחיל. כל שיעור קצר הוא צעד.' : `השבוע: ${stepsText(steps)}`}</p>
      <Progress.Root className="wk-progress" value={Math.min(steps, target)} max={target} aria-labelledby="wk-h"
        getAriaValueText={() => (best ? `השבוע ${stepsText(steps)}, השיא ${stepsText(best.steps)}` : `השבוע ${stepsText(steps)}`)}>
        <Progress.Track className="bar wk-track"><Progress.Indicator className="wk-fill" /></Progress.Track>
      </Progress.Root>
      <p className="wk-best">{best ? `השיא שלכם: ${stepsText(best.steps)} בשבוע` : 'זה השבוע הראשון. מה שתעשו השבוע יהיה השיא.'}</p>
      <p className="field-hint">צעד הוא שיעור, שלב לימוד או בדיקה. בדיקת שליטה שעברתם שווה 3.</p>
    </section>
  );
}

export default function Quests() {
  const reduce = useReducedMotion();
  const navigate = useNavigate();
  const { days, goalXp, setGoalXp, freezes, profile } = useApp();
  const plan = usePlan();
  const d = today(); const day = days[d] || {};
  const quests = questProgress(d, day);
  const streak = streakOf(days);
  const monthDays = learnDaysThisMonth(days, d);
  const repair = useRepair();
  const todayXp = day.xp || 0;
  const allDone = quests.every((q) => q.done);
  // the teacher's work is seen here: the tab's dot goes (and stays gone for work that arrives while this tab is open)
  const workAt = useApp((s) => s.classWork.at);
  useEffect(() => { if (profile.token) markSeen(); }, [profile.token, workAt]);
  // the reply notice's "לקריאה" (App.jsx HelpNotice) opens that request's thread here, once
  const { state: nav } = useLocation();
  const openHelp = nav?.help ?? null;

  return (
    <div className="page wide quests">
      <PageHero tone="streak" scene="quests" mood="excited" title="משימות" sub="המשימה שלכם להיום, ועוד שלוש משימות קטנות שפותחות תיבה." />
      {/* the day's own mission first (chosen for this student), as the first quest card */}
      <TodayCard grade={profile.grade || '7'} onBoard={() => navigate('/topics')} />
      {/* the student's help requests to the teacher, with the replies (TEACHER-6 §4); only in a class */}
      {profile.token && <MyHelp openId={openHelp} onOpened={() => navigate('/quests', { replace: true, state: null })} />}
      {/* the class goal of the week, for a student in a class (STUDENT-4): the class total and the student's own share */}
      <ClassGoalCard />
      <ClassGoalMoment />

      <section className="card quest-card" aria-labelledby="q-h" data-region="card">
        <div className="card-row">
          <h2 id="q-h" className="card-title"><Target size={22} aria-hidden="true" className="brand-icon" />המשימות של היום</h2>
          <span className="card-num">{quests.filter((q) => q.done).length}/3</span>
        </div>
        <ul className="quest-list">
          {quests.map((q, i) => {
            const Icon = QUEST_ICON[q.id] || Target;
            return (
              <li key={q.id} className={clsx('quest', `quest-${q.id}`, q.done && 'done')}>
                <span className="quest-icon" aria-hidden="true"><Icon size={24} />{q.done && <span className="quest-tick"><Check size={14} strokeWidth={3.5} /></span>}</span>
                <div className="quest-main">
                  <span className="quest-title">{q.title}</span>
                  <div className="quest-bar" role="progressbar" aria-label={q.title} aria-valuemin={0} aria-valuemax={q.target} aria-valuenow={q.have}>
                    <m.i initial={reduce ? false : { width: 0 }} animate={{ width: `${Math.min(1, q.have / q.target) * 100}%` }} transition={{ duration: 0.7, delay: 0.15 + i * 0.12, ease: EASE.out }} />
                  </div>
                </div>
                <span className="quest-count"><bdi dir="ltr">{Math.min(q.have, q.target)}/{q.target}</bdi></span>
              </li>
            );
          })}
        </ul>
        {/* the day's chest: closed until all three missions are done; it says what it holds (a streak freeze, never a
            random reward), and says so honestly when two freezes are already waiting */}
        <div className={clsx('quest-chest', allDone && 'open')}>
          <Lottie name="chest" frame={allDone ? 'end' : 'start'} className="quest-chest-art" label={allDone ? 'תיבה פתוחה' : 'תיבה סגורה'} fallback={<Trophy size={48} aria-hidden="true" />} />
          <div className="quest-chest-text">
            <p className="quest-say">{allDone
              ? (day.questsRewarded && freezes > 0 ? 'פתחתם את התיבה של היום! יש בה הקפאת רצף.' : 'פתחתם את התיבה של היום! מחר יחכו משימות חדשות.')
              : `עוד ${3 - quests.filter((q) => q.done).length === 1 ? 'משימה אחת' : `${3 - quests.filter((q) => q.done).length} משימות`} והתיבה נפתחת. ${freezes >= 2 ? 'יש לכם כבר שתי הקפאות רצף, כמה שאפשר להחזיק. היום אין בה הקפאה חדשה.' : 'יש בה הקפאת רצף (אפשר להחזיק עד שתיים).'}`}</p>
          </div>
        </div>
      </section>

      <section className="card streak-card" aria-labelledby="streak-h">
        <div className="streak-card-top">
          <span className={clsx('streak-flame', streak > 0 && 'on')} aria-hidden="true"><Flame size={44} strokeWidth={2.2} /></span>
          <div>
            {/* after a day without learning the streak starts again, said forward-looking; never "lost" or "broken" */}
            <h2 id="streak-h" className="card-title">{streak === 0 ? (learnDaysTotal(days) > 0 ? 'רצף חדש מתחיל היום' : 'עוד אין רצף') : streak === 1 ? 'יום אחד ברצף' : `${streak} ימים ברצף`}</h2>
            <p className="muted">שיעור אחד ביום, או שלב אחד בלימוד מדרגה, שומר על הרצף. בשבת ובחג הרצף נשמר.</p>
            {monthDays > 0 && <p className="streak-month">החודש למדתם {monthDays === 1 ? 'יום אחד' : `${monthDays} ימים`}.</p>}
          </div>
        </div>
        {repair && <p className="streak-repair-line">{repairText(repair, d)}</p>}
        <Week days={days} />
        <p className="freeze-line"><Snowflake size={18} aria-hidden="true" />{freezes === 0 ? 'אין הקפאות רצף כרגע. מסיימים את שלוש המשימות של היום ומקבלים אחת.' : freezes === 1 ? 'הקפאת רצף אחת מוכנה ליום שלא יוצא ללמוד בו.' : `${freezes} הקפאות רצף מוכנות לימים שלא יוצא ללמוד בהם.`}</p>
      </section>

      {/* every student's own week; class students will see it below the class goal (STUDENT-4) */}
      <WeekBestCard days={days} />

      <section className="card goal-card" aria-labelledby="goal-h">
        <div className="card-row">
          <h2 id="goal-h" className="card-title">
            {todayXp >= goalXp ? <Lottie name="xp-star" className="goal-star" fallback={<Zap size={22} aria-hidden="true" className="gold-icon" />} /> : <Zap size={22} aria-hidden="true" className="gold-icon" />}
            {todayXp >= goalXp ? 'היעד היומי הושג' : 'היעד היומי'}
          </h2>
          <span className="card-num">{Math.min(todayXp, goalXp)}/{goalXp} XP</span>
        </div>
        <div className="bar" role="progressbar" aria-label="ההתקדמות ליעד היומי" aria-valuemin={0} aria-valuemax={goalXp} aria-valuenow={Math.min(todayXp, goalXp)}><i style={{ width: `${Math.min(1, todayXp / goalXp) * 100}%` }} /></div>
        <div className="segmented goal-pick" role="radiogroup" aria-label="גודל היעד היומי">
          {GOALS.map((g) => (
            <button key={g.xp} type="button" role="radio" aria-checked={goalXp === g.xp} className={clsx('seg', goalXp === g.xp && 'on')} onClick={() => setGoalXp(g.xp)}>
              <span className="seg-main">{g.xp}</span><span className="seg-sub">{g.label}</span>
            </button>
          ))}
        </div>
      </section>

      {plan.weak.length > 0 && (
        <Link to="/plan" className="card card-link">
          <Route size={24} aria-hidden="true" className="brand-icon" />
          <span className="card-link-text"><b>התוכנית שלי לשיפור</b><span className="muted">{plan.done} מתוך {plan.steps.length} צעדים הושלמו</span></span>
          <ChevronLeft size={22} aria-hidden="true" className="chev" />
        </Link>
      )}

      {profile.classCode && <p className="footnote">אתם בכיתה {profile.className}. המורה רואה את ההתקדמות שלכם, לא את הרצף או את ה-XP.</p>}
    </div>
  );
}
