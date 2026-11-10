// "מה כבר למדתי": one tile per stair of the grade, coloured by what the evidence says (mastered alone,
// practising, worth a review, needs help, not started). Each tile opens its stair. A picture, not a dashboard.
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { useApp } from '@/lib/store.js';
import { topicsFor } from '@/content/index.js';
import { skillId } from '@/learn/skills.ts';
import { masteryState, STATE_LABEL } from '@/learn/mastery.ts';
import { isDone } from '@/lib/path.js';
import { Stat } from '@/components/ds.jsx';

const LEGEND = ['mastered', 'practicing', 'needs-review', 'needs-support'];

export default function MasteryMap({ grade }) {
  const skills = useApp((s) => s.learn.skills);
  const path = useApp((s) => s.path);
  const now = new Date().toISOString();
  const topics = topicsFor(grade);
  let mastered = 0; let total = 0; const n = { on: 0, back: 0, new: 0 };
  const rows = topics.map((t) => {
    const tiles = t.levels.map((L, i) => {
      const id = skillId(t.id, i + 1);
      let st = masteryState(skills[id], now);
      // a stair finished on the map before 2.0 is at least practised
      if (st === 'not-started' && isDone(path, t.id, i + 1)) st = 'practicing';
      total += 1; if (st === 'mastered') mastered += 1;
      else if (st === 'learning' || st === 'practicing') n.on += 1;
      else if (st === 'needs-review' || st === 'needs-support') n.back += 1;
      else n.new += 1;
      return { id, level: i + 1, title: L.title, st };
    });
    return { t, tiles };
  });
  return (
    <section className="mastery-map" aria-labelledby="mm-title">
      <div className="mm-head">
        <h2 id="mm-title" className="h-section">מה כבר למדתי</h2>
        <span className="mm-count">שולטים לבד ב־{mastered} מתוך {total}</span>
      </div>
      <div className="mm-stats">
        <Stat tone="brand" value={n.on} label="בדרך לשליטה" />
        <Stat tone="gold" value={n.back} label="כדאי לחזור אליהן" />
        <Stat tone="neutral" value={n.new} label="עוד לא התחלנו" />
      </div>
      {rows.map(({ t, tiles }) => (
        <div key={t.id} className={clsx('mm-row', `ch-${t.color}`)}>
          <span className="mm-topic">{t.title}</span>
          <ol className="mm-tiles">
            {tiles.map((x) => (
              <li key={x.id}>
                <Link to={`/learn/${t.id}/${x.level}`} className={clsx('mm-tile', `ms-${x.st}`)} aria-label={`${x.title}: ${STATE_LABEL[x.st]}`} title={`${x.title}: ${STATE_LABEL[x.st]}`}>{x.level}</Link>
              </li>
            ))}
          </ol>
        </div>
      ))}
      <ul className="mm-legend" aria-label="מקרא">
        {LEGEND.map((k) => <li key={k}><i className={clsx('mm-swatch', `ms-${k}`)} aria-hidden="true" />{STATE_LABEL[k]}</li>)}
      </ul>
    </section>
  );
}
