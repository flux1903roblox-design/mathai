import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { Flame, Snowflake, Zap, Check, Target, BookOpen, Star, Trophy, Footprints, ListChecks } from 'lucide-react';
import { m, useReducedMotion } from 'motion/react';
import { useApp, useStreak, today } from '@/lib/store.js';
import { learnDaysThisMonth, learnDaysTotal, ghostRace } from '@/lib/streak.js';
import { repairText } from '@/components/learn/RepairCard.jsx';
import { questProgress, goalProgress, GOALS } from '@/lib/quests.js';
import { Week } from '@/components/learn/StreakStage.jsx';
import PageHero from '@/components/PageHero.jsx';
import Lottie from '@/components/Lottie.jsx';
import { DUR, EASE, cascade } from '@/lib/motion.js';
import TodayCard from '@/components/learn/TodayCard.jsx';
import { markSeen } from '@/lib/classWork.js';
import MyHelp from '@/components/learn/MyHelp.jsx';
import ClassGoalCard, { ClassGoalMoment } from '@/components/learn/ClassGoalCard.jsx';
import ExamLoss from '@/components/learn/ExamLoss.jsx';
import ChestChoice, { useChestOffer } from '@/components/learn/ChestChoice.jsx';
import { nameOf, chestPieces } from '@/lib/wardrobe.js';
import FamilyChallengeCard from '@/components/learn/FamilyChallengeCard.jsx';
import '@/styles/lazy/shared.css'; // the rules this screen shares with other screens loaded on demand, out of the first load (COUNCIL2-20)
import '@/styles/lazy/quests.css'; // this screen's own rules (COUNCIL2-20) and the ghost race's (the product2 merge), out of the first load


/** The two pieces the next chest would offer (none once every chest piece is owned). */
function useChestPiecesLeft() {
  const earned = useApp((s) => s.look?.earned);
  return chestPieces(new Set(earned || []));
}

const QUEST_ICON = { lessons: BookOpen, xp: Zap, combo: Flame, perfect: Star, correct: Target, mission: ListChecks };
const stagesText = (n) => (n === 1 ? 'שלב אחד' : `${n} שלבים`);
/** A bar's length on the card's one scale (the larger week, at least 5 stages), in whole percent. */
const barOf = (n, scale) => `${Math.round((Math.min(n, scale) / scale) * 100)}%`;

/**
 * השבוע שלי (PRODUCT2-39): the ghost race. This week against the student's own last week, as two calm bars on one scale,
 * with the practice days of both and the personal best. Only the student's own weeks: no other student, no countdown to
 * the week's end, and a week behind the last one is shown without a word about it (a week ahead says so).
 */
function GhostRaceCard({ days }) {
  const { now, last, best } = ghostRace(days, today());
  const scale = Math.max(now.stages, last.stages, 5);
  const say = now.stages === 0 && last.stages === 0 ? 'השבוע עוד לא התחיל. כל שלב קטן נספר כאן.'
    : now.stages > last.stages && last.stages > 0 ? 'עברתם את השבוע שעבר.'
      : now.stages === last.stages ? 'בדיוק כמו בשבוע שעבר.' : null;
  const top = best.stages;
  const bestLine = !top ? 'זה השבוע הראשון. מה שתעשו השבוע יהיה השיא.'
    : now.stages > top.n ? `שיא שבועי חדש! השיא הקודם: ${stagesText(top.n)}.` : `השיא שלכם: ${stagesText(top.n)} בשבוע`;
  const rows = [['is-last', 'השבוע שעבר:', last.stages], ['is-now', 'השבוע:', now.stages]];
  return (
    <section className="card ghost-card" aria-labelledby="wk-h">
      <h2 id="wk-h" className="card-title"><Footprints size={22} aria-hidden="true" className="brand-icon" />השבוע שלי</h2>
      <ul className="ghost-rows">
        {rows.map(([cls, label, n]) => (
          <li key={cls} className={`ghost-row ${cls}`}>
            <span className="ghost-label">{label}</span>
            <span className="ghost-bar" aria-hidden="true"><i style={{ inlineSize: barOf(n, scale) }} /></span>
            <span className="ghost-num">{stagesText(n)}</span>
          </li>
        ))}
      </ul>
      {say && <p className="ghost-say">{say}</p>}
      <p className="ghost-days">{`ימי תרגול: השבוע ${now.days}, בשבוע שעבר ${last.days}`}</p>
      <p className="ghost-best">{bestLine}</p>
      <p className="field-hint">שלב הוא שלב לימוד, שיעור או בדיקה.</p>
    </section>
  );
}

export default function Quests() {
  const reduce = useReducedMotion();
  const navigate = useNavigate();
  const { days, goalXp, setGoalXp, freezes, profile } = useApp();
  const d = today(); const day = days[d] || {};
  const quests = questProgress(d, day);
  // the same streak as the header and the repair card (store.js useStreak): kept and at risk while it can be repaired
  const { n: streak, atRisk, repair } = useStreak();
  const monthDays = learnDaysThisMonth(days, d);
  const todayXp = day.xp || 0;
  // the daily goal by the one rule the header's XP pill uses (lib/quests.js goalProgress)
  const goal = goalProgress(todayXp, goalXp);
  const allDone = quests.every((q) => q.done);
  // the chest's choice of a piece for מדי (PRODUCT2-36): today's, or an earlier chest of this week still waiting; once
  // chosen here, the choice stays on screen until the tab is left
  const live = useChestOffer();
  const [chosen, setChosen] = useState(null);
  const offer = chosen?.offer || live;
  const pick = (id) => { if (useApp.getState().pickChest(offer.day, id)) setChosen({ offer, id }); };
  const pieces = useChestPiecesLeft();
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
      {/* a weekly goal a parent sent and the child accepted (PRODUCT2-39); nothing when there is none */}
      <FamilyChallengeCard />

      <section className="card quest-card" aria-labelledby="q-h" data-region="card">
        <div className="card-row">
          <h2 id="q-h" className="card-title"><Target size={22} aria-hidden="true" className="brand-icon" />המשימות של היום</h2>
          <span className="card-num">{quests.filter((q) => q.done).length}/3</span>
        </div>
        <ul className="quest-list cascade">
          {quests.map((q, i) => {
            const Icon = QUEST_ICON[q.id] || Target;
            return (
              <li key={q.id} className={clsx('quest', `quest-${q.id}`, q.done && 'done')}>
                <span className="quest-icon" aria-hidden="true"><Icon size={24} />{q.done && <span className="quest-tick"><Check size={14} strokeWidth={3.5} /></span>}</span>
                <div className="quest-main">
                  <span className="quest-title">{q.title}</span>
                  <div className="quest-bar" role="progressbar" aria-label={q.title} aria-valuemin={0} aria-valuemax={q.target} aria-valuenow={q.have}>
                    <m.i initial={reduce ? false : { width: 0 }} animate={{ width: `${Math.min(1, q.have / q.target) * 100}%` }} transition={{ duration: DUR.slow, delay: 0.15 + cascade(i), ease: EASE.out }} />
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
              : `עוד ${3 - quests.filter((q) => q.done).length === 1 ? 'משימה אחת' : `${3 - quests.filter((q) => q.done).length} משימות`} והתיבה נפתחת. ${freezes >= 2 ? 'יש לכם כבר שתי הקפאות רצף, כמה שאפשר להחזיק. היום אין בה הקפאה חדשה.' : 'יש בה הקפאת רצף (אפשר להחזיק עד שתיים).'}${pieces.length ? ` וגם חלק למדי לבחירה: ${pieces.map(nameOf).join(' או ')}.` : ''}`}</p>
          </div>
        </div>
        {offer && (
          <div className="quest-chest-choice">
            <ChestChoice ids={offer.ids} picked={chosen?.id || null} onPick={pick} title={offer.day === d ? 'בחרו חלק אחד למדי' : 'התיבה עוד מחכה: בחרו חלק'} />
          </div>
        )}
      </section>

      <section className="card streak-card" aria-labelledby="streak-h">
        <div className="streak-card-top">
          <span className={clsx('streak-flame', streak > 0 && !atRisk && 'on', atRisk && 'at-risk')} aria-hidden="true"><Flame size={44} strokeWidth={2.2} /></span>
          <div>
            {/* after a day without learning the streak starts again, said forward-looking; never "lost" or "broken"; while
                the missed day can be repaired, the streak waits for today, as the header and the repair card say */}
            <h2 id="streak-h" className="card-title">{atRisk ? `הרצף של ${streak} ימים מחכה לכם` : streak === 0 ? (learnDaysTotal(days) > 0 ? 'רצף חדש מתחיל היום' : 'עוד אין רצף') : streak === 1 ? 'יום אחד ברצף' : `${streak} ימים ברצף`}</h2>
            <p className="muted">שיעור אחד ביום, או שלב אחד בלימוד מדרגה, שומר על הרצף. בשבת ובחג הרצף נשמר.</p>
            {monthDays > 0 && <p className="streak-month">החודש למדתם {monthDays === 1 ? 'יום אחד' : `${monthDays} ימים`}.</p>}
          </div>
        </div>
        {repair && <p className="streak-repair-line">{repairText(repair, d)}</p>}
        <Week days={days} />
        <p className="freeze-line"><Snowflake size={18} aria-hidden="true" />{freezes === 0 ? 'אין הקפאות רצף כרגע. מסיימים את שלוש המשימות של היום ומקבלים אחת.' : freezes === 1 ? 'הקפאת רצף אחת מוכנה ליום שלא יוצא ללמוד בו.' : `${freezes} הקפאות רצף מוכנות לימים שלא יוצא ללמוד בהם.`}</p>
      </section>

      {/* every student's own week against their own last week: the ghost race (PRODUCT2-39) */}
      <GhostRaceCard days={days} />

      <section className="card goal-card" aria-labelledby="goal-h">
        <div className="card-row">
          <h2 id="goal-h" className="card-title">
            {goal.reached ? <Lottie name="xp-star" className="goal-star" fallback={<Zap size={22} aria-hidden="true" className="gold-icon" />} /> : <Zap size={22} aria-hidden="true" className="gold-icon" />}
            {goal.reached ? 'היעד היומי הושג' : 'היעד היומי'}
          </h2>
          <span className="card-num">{goal.have}/{goal.of} XP</span>
        </div>
        <div className="bar" role="progressbar" aria-label="ההתקדמות ליעד היומי" aria-valuemin={0} aria-valuemax={goal.of} aria-valuenow={goal.have}><i style={{ width: `${goal.share * 100}%` }} /></div>
        <div className="segmented goal-pick" role="radiogroup" aria-label="גודל היעד היומי">
          {GOALS.map((g) => (
            <button key={g.xp} type="button" role="radio" aria-checked={goalXp === g.xp} className={clsx('seg', goalXp === g.xp && 'on')} onClick={() => setGoalXp(g.xp)}>
              <span className="seg-main">{g.xp}</span><span className="seg-sub">{g.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* what a checked exam lost and is not recovered yet: the plan's exam-loss items (nothing when there are none) */}
      <ExamLoss id="q-exam-loss" />

      {profile.classCode && <p className="footnote">אתם בכיתה {profile.className}. המורה רואה את ההתקדמות שלכם, לא את הרצף או את ה-XP.</p>}
    </div>
  );
}
