import { useEffect, useState } from 'react';
import NumberFlow from '@number-flow/react';
import clsx from 'clsx';
import { Zap, Target, Timer, Flame, Snowflake, Moon, Check, ChevronsUp } from 'lucide-react';
import { useApp, today, dayBefore, isShabbat } from '@/lib/store.js';
import Mascot from '@/components/Mascot.jsx';
import Stairs from '@/components/Stairs.jsx';
import { topicsFor } from '@/content/index.js';
import { Button } from '@/components/ui.jsx';

const DAY = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
const fmtTime = (secs) => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;

/** Counts up from 0 once the card is on screen (a still number under reduced motion). */
function useCount(target) {
  const [v, setV] = useState(0);
  useEffect(() => { const id = requestAnimationFrame(() => setV(target)); return () => cancelAnimationFrame(id); }, [target]);
  return v;
}

function Stat({ tone, icon: Icon, label, value, prefix = '', suffix = '', text }) {
  const v = useCount(value ?? 0);
  return (
    <div className={clsx('stat', `stat-${tone}`)}>
      <span className="stat-label">{label}</span>
      <span className="stat-value"><Icon size={20} aria-hidden="true" /><span>{text ?? <>{prefix}<NumberFlow value={v} />{suffix}</>}</span></span>
    </div>
  );
}

export function Week({ days }) {
  const keys = []; let k = today();
  for (let i = 0; i < 7; i++) { keys.unshift(k); k = dayBefore(k); }
  return (
    <ol className="week" aria-label="השבוע האחרון">
      {keys.map((key) => {
        const d = days[key]; const on = (d?.lessons || 0) > 0 || (d && d.lessons == null && d.q > 0);
        const state = on ? 'on' : d?.frozen ? 'frozen' : isShabbat(key) ? 'rest' : 'off';
        const label = { on: 'תרגלתם', frozen: 'הקפאת רצף', rest: 'שבת', off: 'לא תרגלתם' }[state];
        return (
          <li key={key} className={clsx('week-day', state, key === today() && 'today')}>
            <span className="week-dot" aria-hidden="true">{state === 'on' ? <Flame size={16} /> : state === 'frozen' ? <Snowflake size={16} /> : state === 'rest' ? <Moon size={14} /> : null}</span>
            <span className="week-name">{DAY[new Date(`${key}T12:00:00`).getDay()]}</span>
            <span className="visually-hidden">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

export default function LessonDone({ result, award, topic, onExit, onAgain }) {
  const days = useApp((s) => s.days);
  const freezes = useApp((s) => s.freezes);
  const stages = ['summary', award.streakExtended && result.passed && 'streak', award.questsDone && 'quests'].filter(Boolean);
  const [i, setI] = useState(0);
  const stage = stages[i];
  const nextStage = () => (i + 1 < stages.length ? setI(i + 1) : onExit());
  const levelTitle = topic.levels[result.level - 1]?.title;

  if (!result.passed) {
    return (
      <div className="done-screen">
        <Mascot mood="oops" size={140} />
        <h1 className="done-title">כמעט! עוד קצת תרגול</h1>
        <p className="lead">במבחן הקפיצה מותרת טעות אחת. אפשר לנסות שוב, או להמשיך במסלול מהמקום שלכם.</p>
        <div className="done-actions">
          <Button className="btn-block btn-lg" onClick={onExit}>חזרה למפה</Button>
          <Button variant="secondary" className="btn-block" onClick={onAgain}>לנסות שוב</Button>
        </div>
      </div>
    );
  }

  if (stage === 'streak') return <StreakStage streak={award.streak} days={days} freezes={freezes} onNext={nextStage} />;

  if (stage === 'quests') {
    return (
      <div className="done-screen">
        <Mascot mood="cheer" size={140} />
        <h1 className="done-title">סיימתם את המשימות של היום!</h1>
        {award.freezeEarned
          ? <p className="reward"><Snowflake size={22} aria-hidden="true" />קיבלתם הקפאת רצף. היא שומרת על הרצף ביום שתפספסו.</p>
          : <p className="lead">כל הכבוד. מחר יחכו משימות חדשות.</p>}
        <div className="done-actions"><Button className="btn-block btn-lg" onClick={nextStage}>המשך</Button></div>
      </div>
    );
  }

  const title = result.kind === 'review' ? 'סיימתם חזרה על היחידה!' : result.kind === 'jump' ? 'קפצתם קדימה!' : result.perfect ? 'שיעור מושלם!' : 'השיעור הושלם!';
  return (
    <div className="done-screen">
      <Mascot mood="cheer" size={150} />
      <h1 className="done-title">{title}</h1>
      {award.unitDone && <p className="reward"><Check size={20} aria-hidden="true" />השלמתם את כל היחידה {topic.title}.</p>}
      {!award.unitDone && award.nodeDone && <p className="reward"><Check size={20} aria-hidden="true" />השלמתם את {levelTitle}. המדרגה הבאה פתוחה.</p>}
      {result.kind === 'jump' && <p className="reward"><Check size={20} aria-hidden="true" />{topic.title}: עכשיו אתם ב{levelTitle}.</p>}
      <div className="stats">
        <Stat tone="gold" icon={Zap} label="XP" value={result.xp} prefix="+" />
        <Stat tone="good" icon={Target} label="דיוק" value={result.accuracy} suffix="%" />
        <Stat tone="brand" icon={Timer} label="זמן" text={fmtTime(result.secs)} />
      </div>
      {result.fixed > 0 && <p className="muted">כולל {result.fixed * 2} XP על תיקון {result.fixed === 1 ? 'טעות' : `${result.fixed} טעויות`}.</p>}
      {award.goalReached && <p className="reward gold"><Zap size={20} aria-hidden="true" />הגעתם ליעד היומי!</p>}
      <div className="done-actions"><Button className="btn-block btn-lg" onClick={nextStage} autoFocus>המשך</Button></div>
    </div>
  );
}

/** After the placement test: where each topic starts, then the first day of the streak. */
export function PlacementDone({ result, award, onExit }) {
  const days = useApp((s) => s.days);
  const freezes = useApp((s) => s.freezes);
  const stages = ['result', award.streakExtended && 'streak'].filter(Boolean);
  const [i, setI] = useState(0);
  const last = i + 1 >= stages.length;
  const nextStage = () => (last ? onExit() : setI(i + 1));
  if (stages[i] === 'streak') return <StreakStage streak={award.streak} days={days} freezes={freezes} onNext={nextStage} />;
  return (
    <div className="done-screen place-done">
      <Mascot mood="cheer" size={130} />
      <h1 className="done-title">מצאנו את המדרגה שלכם!</h1>
      <ol className="place-list">
        {topicsFor(result.grade).map((t) => {
          const L = result.results[t.id]?.level ?? 0; const top = t.levels.length;
          return (
            <li key={t.id} className={clsx('place-row', `ch-${t.color}`)}>
              <Stairs steps={top} done={L} label={`${L} מתוך ${top} מדרגות`} />
              <span className="place-text">
                <b>{t.title}</b>
                <span>{L >= top ? 'כל המדרגות פתוחות. נשארה החזרה על היחידה.' : `${L === 0 ? 'המדרגה הראשונה' : 'המדרגה הבאה'}: ${t.levels[L].title}`}</span>
              </span>
            </li>
          );
        })}
      </ol>
      <div className="stats">
        <Stat tone="gold" icon={Zap} label="XP" value={result.xp} prefix="+" />
        <Stat tone="good" icon={ChevronsUp} label="מדרגות" value={Object.values(result.results).reduce((a, r) => a + r.level, 0)} />
        <Stat tone="brand" icon={Timer} label="זמן" text={fmtTime(result.secs)} />
      </div>
      <div className="done-actions"><Button className="btn-block btn-lg" onClick={nextStage} autoFocus>{last ? 'ללוח שלי' : 'המשך'}</Button></div>
    </div>
  );
}

/** The streak number ticks up from yesterday's value to today's. */
function StreakStage({ streak, days, freezes, onNext }) {
  const [v, setV] = useState(Math.max(0, streak - 1));
  useEffect(() => { const t = setTimeout(() => setV(streak), 350); return () => clearTimeout(t); }, [streak]);
  return (
    <div className="done-screen streak-screen">
      <div className="streak-big" aria-hidden="true"><Flame size={120} strokeWidth={1.6} /></div>
      <p className="streak-num"><NumberFlow value={v} /></p>
      <h1 className="done-title">{streak === 1 ? 'התחלתם רצף!' : `${streak} ימים ברצף!`}</h1>
      <Week days={days} />
      <p className="lead">שיעור אחד ביום שומר על הרצף, ובשבת הרצף לא נשבר.{freezes > 0 ? ` יש לכם ${freezes === 1 ? 'הקפאה אחת' : `${freezes} הקפאות`} למקרה שתפספסו יום.` : ''}</p>
      <div className="done-actions"><Button className="btn-block btn-lg" onClick={onNext} autoFocus>המשך</Button></div>
    </div>
  );
}
