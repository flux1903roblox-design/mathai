import { Link, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { Flame, Snowflake, Zap, Check, Target, Route, ChevronLeft, BookOpen, Star, Trophy } from 'lucide-react';
import { m, useReducedMotion } from 'motion/react';
import { useApp, streakOf, today } from '@/lib/store.js';
import { questProgress, GOALS } from '@/lib/quests.js';
import { usePlan } from '@/lib/usePlan.js';
import { Week } from './LessonDone.jsx';
import PageHero from '@/components/PageHero.jsx';
import Lottie from '@/components/Lottie.jsx';
import { EASE } from '@/lib/motion.js';
import TodayCard from '@/components/learn/TodayCard.jsx';


const QUEST_ICON = { lessons: BookOpen, xp: Zap, combo: Flame, perfect: Star, correct: Target, review: Trophy };

export default function Quests() {
  const reduce = useReducedMotion();
  const navigate = useNavigate();
  const { days, goalXp, setGoalXp, freezes, profile } = useApp();
  const plan = usePlan();
  const d = today(); const day = days[d] || {};
  const quests = questProgress(d, day);
  const streak = streakOf(days);
  const todayXp = day.xp || 0;
  const allDone = quests.every((q) => q.done);

  return (
    <div className="page wide quests">
      <PageHero tone="streak" scene="quests" mood="excited" title="משימות" sub="המשימה שלכם להיום, ועוד שלוש משימות קטנות שפותחות תיבה." />
      {/* the day's own mission first (chosen for this student), as the first quest card */}
      <TodayCard grade={profile.grade || '7'} onBoard={() => navigate('/topics')} />

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
        {/* the day's chest: closed until all three missions are done; it holds a streak freeze */}
        <div className={clsx('quest-chest', allDone && 'open')}>
          <Lottie name="chest" frame={allDone ? 'end' : 'start'} className="quest-chest-art" label={allDone ? 'תיבה פתוחה' : 'תיבה סגורה'} fallback={<Trophy size={48} aria-hidden="true" />} />
          <div className="quest-chest-text">
            <p className="quest-say">{allDone
              ? (day.questsRewarded && freezes > 0 ? 'פתחתם את התיבה של היום! יש בה הקפאת רצף.' : 'פתחתם את התיבה של היום! מחר יחכו משימות חדשות.')
              : `עוד ${3 - quests.filter((q) => q.done).length === 1 ? 'משימה אחת' : `${3 - quests.filter((q) => q.done).length} משימות`} והתיבה נפתחת. יש בה הקפאת רצף (אפשר להחזיק עד שתיים).`}</p>
          </div>
        </div>
      </section>

      <section className="card streak-card" aria-labelledby="streak-h">
        <div className="streak-card-top">
          <span className={clsx('streak-flame', streak > 0 && 'on')} aria-hidden="true"><Flame size={44} strokeWidth={2.2} /></span>
          <div>
            <h2 id="streak-h" className="card-title">{streak === 0 ? 'עוד אין רצף' : streak === 1 ? 'יום אחד ברצף' : `${streak} ימים ברצף`}</h2>
            <p className="muted">שיעור אחד ביום שומר על הרצף. בשבת הרצף לא נשבר.</p>
          </div>
        </div>
        <Week days={days} />
        <p className="freeze-line"><Snowflake size={18} aria-hidden="true" />{freezes === 0 ? 'אין הקפאות רצף כרגע. מסיימים את שלוש המשימות של היום ומקבלים אחת.' : `${freezes === 1 ? 'הקפאת רצף אחת מוכנה' : `${freezes} הקפאות רצף מוכנות`}. אם תפספסו יום, היא תשמור על הרצף.`}</p>
      </section>

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
