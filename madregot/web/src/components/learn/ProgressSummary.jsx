// The top of the profile: what is mastered, what still needs work, and the one next step, in that order.
// Counts come from the same evidence as the map's tiles (mastery checks, not time in the app), and each stair is named
// as its page names it (learn/stairStatus.ts): a memory check that came due is told apart from one that was missed.
import { Link, useNavigate } from 'react-router-dom';
import { Award, Route, Target, ArrowLeft } from 'lucide-react';
import { useApp } from '@/lib/store.js';
import { useNext } from '@/lib/useLearn.js';
import { topicsFor } from '@/content/topics.js';
import { gradeStatuses, countStatuses, STATUS_LABEL } from '@/learn/stairStatus.ts';
import { MathText } from '@/components/MathText.jsx';
import { Button } from '@/components/ui.jsx';
import { Badge, Stat } from '@/components/ds.jsx';
import '@/styles/lazy/progressSummary.css'; // this screen's own rules, loaded with it (STUDENT-15)

const TONE = { 'needs-support': 'support', 'review-due': 'review', 'review-missed': 'review' };

export default function ProgressSummary({ tiles = true }) {
  const navigate = useNavigate();
  const grade = useApp((s) => s.profile?.grade) || '7';
  const skills = useApp((s) => s.learn.skills);
  const path = useApp((s) => s.path);
  // the one next step of the plan, the same the home and the mission name
  const { top: next } = useNext();
  const now = new Date().toISOString();
  const status = gradeStatuses(grade, skills, path, now);
  const all = topicsFor(grade).flatMap((t) => t.levels.map((L, i) => ({ t, level: i + 1, title: L.title }))).map((x, i) => ({ ...x, st: status[i].status }));
  const c = countStatuses(status.map((x) => x.status));
  const work = all.filter((x) => x.st in TONE);
  return (
    <section className="progress-summary" aria-labelledby="ps-title">
      <h2 id="ps-title" className="h-section">ההתקדמות שלי</h2>
      {tiles && <div className="ps-stats">
        <Stat tone="good" icon={Award} value={c.learned} label="שולטים לבד" />
        <Stat tone="brand" icon={Route} value={c.onWay} label="בדרך לשליטה" />
        <Stat tone="gold" icon={Target} value={c.strengthen} label="צריכות חיזוק" />
      </div>}
      {next && (
        <div className="ps-next">
          <div className="ps-next-text">
            <p className="ps-next-title"><MathText text={next.title} /></p>
            <p className="ps-next-label">{next.kind === 'teacher' ? 'הצעד הבא: משימה מהמורה' : 'הצעד הבא'}</p>
          </div>
          <Button className="btn-sm" onClick={() => navigate(next.to)}>מתחילים<ArrowLeft size={16} aria-hidden="true" /></Button>
        </div>
      )}
      {work.length > 0 && (
        <ul className="ps-work" aria-label="מה עוד צריך עבודה">
          {work.slice(0, 4).map((x) => (
            <li key={`${x.t.id}-${x.level}`}>
              <Link to={`/learn/${x.t.id}/${x.level}`} className="ps-work-row"><span>{x.title}</span><Badge tone={TONE[x.st]}>{STATUS_LABEL[x.st]}</Badge></Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
