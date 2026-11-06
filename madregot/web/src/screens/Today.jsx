import { Link, useNavigate } from 'react-router-dom';
import NumberFlow from '@number-flow/react';
import { Flame, Star, ChevronLeft, Route } from 'lucide-react';
import { usePlan } from '@/lib/usePlan.js';
import { useApp, streakOf, minutesToday } from '@/lib/store.js';
import { TOPIC, topicsFor, TOPICS } from '@/content/index.js';
import { GOAL_MINUTES } from '@/lib/ladder.js';
import { Box, Button, ChapterMark, LevelPips } from '@/components/ui.jsx';
import { MathText } from '@/components/MathText.jsx';

export function TopicRow({ t, n, to }) {
  const p = useApp((s) => s.progress[t.id]);
  const level = p?.level || 1;
  return (
    <li>
      <Link to={to || `/topic/${t.id}`} className="topic-row">
        <ChapterMark color={t.color} n={n} />
        <span className="topic-row-text">
          <span className="topic-row-title">{t.title}</span>
          <span className="topic-row-desc">{t.desc}</span>
        </span>
        <span className="topic-row-level">
          <LevelPips total={t.levels.length} level={level} max={p?.max} color={t.color} />
          <span className="topic-row-level-text">מדרגה {level}</span>
        </span>
        <ChevronLeft className="chev" size={20} aria-hidden="true" />
      </Link>
    </li>
  );
}

export default function Today() {
  const navigate = useNavigate();
  const { profile, progress, days, xp, lastTopic, mistakes } = useApp();
  const grade = profile.grade || '7';
  const list = topicsFor(grade);
  const current = TOPIC[lastTopic] && TOPIC[lastTopic].grade === grade ? TOPIC[lastTopic] : list[0];
  const p = progress[current.id] || { level: 1, max: 1 };
  const streak = streakOf(days);
  const minutes = Math.min(minutesToday(days), GOAL_MINUTES);
  const n = TOPICS.filter((t) => t.grade === grade).indexOf(current) + 1;

  const plan = usePlan();
  const nextStep = plan.weak.length ? plan.steps.find((s) => !s.done) : null;

  const top = Object.entries(mistakes)
    .map(([k, v]) => { const [topic, cat] = k.split(':'); return { topic, cat, v }; })
    .filter((m) => m.v >= 2 && TOPIC[m.topic]?.cats[m.cat])
    .sort((a, b) => b.v - a.v)[0];

  return (
    <div className="page">
      <header className="today-head">
        <h1 className="h-page">היי, {profile.name}</h1>
        <div className="chips">
          <span className="chip" title="ימים ברצף"><Flame size={18} aria-hidden="true" /><span>{streak === 0 ? 'מתחילים רצף היום' : streak === 1 ? 'יום אחד ברצף' : `${streak} ימים ברצף`}</span></span>
          <span className="chip"><Star size={18} aria-hidden="true" /><NumberFlow value={xp} /><span className="visually-hidden">נקודות</span></span>
        </div>
      </header>

      <section className={`continue ch-${current.color}`} aria-labelledby="cont-title">
        <div className="continue-top">
          <ChapterMark color={current.color} n={n} />
          <div>
            <h2 id="cont-title" className="continue-title">{current.title}</h2>
            <p className="continue-sub">מדרגה {p.level} מתוך {current.levels.length}: {current.levels[p.level - 1].title}</p>
          </div>
        </div>
        <LevelPips total={current.levels.length} level={p.level} max={p.max} color={current.color} />
        <div className="goal">
          <div className="goal-text"><span>היעד היומי</span><span>{minutes} מתוך {GOAL_MINUTES} דקות</span></div>
          <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={GOAL_MINUTES} aria-valuenow={minutes} aria-label="דקות תרגול היום">
            <i style={{ width: `${(minutes / GOAL_MINUTES) * 100}%` }} />
          </div>
        </div>
        <Button className="btn-block btn-lg" onClick={() => navigate(`/practice/${current.id}`)}>ממשיכים לתרגל</Button>
      </section>

      {nextStep && (
        <Link to="/plan" className="plan-card">
          <Route size={22} aria-hidden="true" />
          <span className="topic-row-text"><span className="topic-row-desc">הצעד הבא בתוכנית לשיפור</span><span className="topic-row-title">{nextStep.title}</span><span className="topic-row-desc">{nextStep.kind === 'practice' ? `${nextStep.have} מתוך ${nextStep.need} תשובות נכונות` : `${plan.done} מתוך ${plan.steps.length} צעדים הושלמו`}</span></span>
          <ChevronLeft className="chev" size={20} aria-hidden="true" />
        </Link>
      )}

      {!nextStep && top && (
        <Box tone="attention" title="שימו לב">
          <p><MathText text={`טעות שחוזרת אצלכם ב${TOPIC[top.topic].title}: ${TOPIC[top.topic].cats[top.cat]}.`} /></p>
          <Button variant="secondary" className="btn-sm" onClick={() => navigate(`/practice/${top.topic}`)}>לתרגל את זה עכשיו</Button>
        </Box>
      )}

      <section aria-labelledby="all-title" className="section">
        <h2 id="all-title" className="h-section">כל הנושאים של כיתה {grade === '8' ? 'ח׳' : 'ז׳'}</h2>
        <ul className="topic-list">
          {list.map((t, i) => <TopicRow key={t.id} t={t} n={i + 1} />)}
        </ul>
      </section>

      {profile.className && <p className="footnote">כיתה {profile.className} · ההתקדמות נשלחת למורה</p>}
    </div>
  );
}
