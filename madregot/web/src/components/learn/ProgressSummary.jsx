// The top of the profile: what is mastered, what still needs work, and the one next step, in that order.
// Counts come from the same evidence as the map's tiles (mastery checks, not time in the app).
import { Link, useNavigate } from 'react-router-dom';
import { Award, Route, Target, ArrowLeft } from 'lucide-react';
import { useApp } from '@/lib/store.js';
import { useActions } from '@/lib/useLearn.js';
import { topicsFor } from '@/content/index.js';
import { skillId } from '@/learn/skills.ts';
import { masteryState, STATE_LABEL } from '@/learn/mastery.ts';
import { MathText } from '@/components/MathText.jsx';
import { Button } from '@/components/ui.jsx';
import { Badge, Stat } from '@/components/ds.jsx';

const TONE = { 'needs-support': 'support', 'needs-review': 'review' };

export default function ProgressSummary() {
  const navigate = useNavigate();
  const grade = useApp((s) => s.profile?.grade) || '7';
  const skills = useApp((s) => s.learn.skills);
  const actions = useActions();
  const now = new Date().toISOString();
  const all = topicsFor(grade).flatMap((t) => t.levels.map((L, i) => ({ t, level: i + 1, title: L.title, st: masteryState(skills[skillId(t.id, i + 1)], now) })));
  const mastered = all.filter((x) => x.st === 'mastered').length;
  const onWay = all.filter((x) => x.st === 'learning' || x.st === 'practicing').length;
  const work = all.filter((x) => x.st === 'needs-support' || x.st === 'needs-review');
  const next = actions[0];
  return (
    <section className="progress-summary" aria-labelledby="ps-title">
      <h2 id="ps-title" className="h-section">ההתקדמות שלי</h2>
      <div className="ps-stats">
        <Stat tone="good" icon={Award} value={mastered} label="שולטים לבד" />
        <Stat tone="brand" icon={Route} value={onWay} label="בדרך לשליטה" />
        <Stat tone="gold" icon={Target} value={work.length} label="צריכות חיזוק" />
      </div>
      {next && (
        <div className="ps-next">
          <div className="ps-next-text">
            <p className="ps-next-label">הצעד הבא</p>
            <p className="ps-next-title"><MathText text={next.title} /></p>
          </div>
          <Button className="btn-sm" onClick={() => navigate(next.to)}>מתחילים<ArrowLeft size={16} aria-hidden="true" /></Button>
        </div>
      )}
      {work.length > 0 && (
        <ul className="ps-work" aria-label="מה עוד צריך עבודה">
          {work.slice(0, 4).map((x) => (
            <li key={`${x.t.id}-${x.level}`}>
              <Link to={`/learn/${x.t.id}/${x.level}`} className="ps-work-row"><span>{x.title}</span><Badge tone={TONE[x.st]}>{STATE_LABEL[x.st]}</Badge></Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
