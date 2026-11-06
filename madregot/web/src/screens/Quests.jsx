import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { Flame, Snowflake, Zap, Check, Target, Route, ChevronLeft } from 'lucide-react';
import { useApp, streakOf, today } from '@/lib/store.js';
import { questProgress, GOALS } from '@/lib/quests.js';
import { usePlan } from '@/lib/usePlan.js';
import Mascot from '@/components/Mascot.jsx';
import { Week } from './LessonDone.jsx';


export default function Quests() {
  const { days, goalXp, setGoalXp, freezes, profile } = useApp();
  const plan = usePlan();
  const d = today(); const day = days[d] || {};
  const quests = questProgress(d, day);
  const streak = streakOf(days);
  const todayXp = day.xp || 0;
  const allDone = quests.every((q) => q.done);

  return (
    <div className="page quests">
      <h1 className="h-page">משימות</h1>

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

      <section className="card" aria-labelledby="goal-h">
        <div className="card-row">
          <h2 id="goal-h" className="card-title"><Zap size={22} aria-hidden="true" className="gold-icon" />היעד היומי</h2>
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

      <section className="card" aria-labelledby="q-h">
        <div className="card-row">
          <h2 id="q-h" className="card-title"><Target size={22} aria-hidden="true" className="brand-icon" />המשימות של היום</h2>
          <span className="card-num">{quests.filter((q) => q.done).length}/3</span>
        </div>
        <ul className="quest-list">
          {quests.map((q) => (
            <li key={q.id} className={clsx('quest', q.done && 'done')}>
              <span className="quest-check" aria-hidden="true">{q.done ? <Check size={18} strokeWidth={3} /> : null}</span>
              <div className="quest-main">
                <span className="quest-title">{q.title}</span>
                <div className="bar thin" role="progressbar" aria-label={q.title} aria-valuemin={0} aria-valuemax={q.target} aria-valuenow={q.have}><i style={{ width: `${(q.have / q.target) * 100}%` }} /></div>
              </div>
              <span className="quest-count">{q.have}/{q.target}</span>
            </li>
          ))}
        </ul>
        {allDone
          ? <div className="quests-done"><Mascot mood="cheer" size={72} /><p>כל המשימות של היום הושלמו. מחר יחכו חדשות.</p></div>
          : <p className="muted">מסיימים את שלוש המשימות ומקבלים הקפאת רצף (אפשר להחזיק עד שתיים).</p>}
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
