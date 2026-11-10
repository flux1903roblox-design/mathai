// "מה כבר למדתי": one tile per stair of the grade, coloured by what the evidence says (mastered alone,
// practising, worth a review, needs help, not started). Each tile opens its stair. A picture, not a dashboard:
// it sits inside the board (Board.jsx), which says in words what the picture shows.
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { topicsFor } from '@/content/index.js';
import { skillId } from '@/learn/skills.ts';
import { masteryState, STATE_LABEL } from '@/learn/mastery.ts';
import { isDone } from '@/lib/path.js';

const LEGEND = ['mastered', 'practicing', 'needs-review', 'needs-support'];

/** Every stair of a grade with its state now (a stair finished on the map before 2.0 is at least practised). */
export function gradeTiles(grade, skills, path, now = new Date().toISOString()) {
  return topicsFor(grade).map((t) => ({
    t,
    tiles: t.levels.map((L, i) => {
      const id = skillId(t.id, i + 1);
      let st = masteryState(skills[id], now);
      if (st === 'not-started' && isDone(path, t.id, i + 1)) st = 'practicing';
      return { id, level: i + 1, title: L.title, st };
    }),
  }));
}

/** The board's line about the tiles, in words that move from the first stage: no row of zeros. */
export function tilesSummary(rows) {
  const all = rows.flatMap((r) => r.tiles);
  const mastered = all.filter((x) => x.st === 'mastered').length;
  const onWay = all.filter((x) => x.st === 'learning' || x.st === 'practicing').length;
  const back = all.filter((x) => x.st === 'needs-review' || x.st === 'needs-support').length;
  const parts = [];
  if (mastered) parts.push(`שולטים לבד ב־${mastered} מתוך ${all.length} מדרגות`);
  if (onWay) parts.push(onWay === 1 ? 'מדרגה אחת בדרך לשליטה' : `${onWay} מדרגות בדרך לשליטה`);
  if (back) parts.push(back === 1 ? 'מדרגה אחת שכדאי לחזור אליה' : `${back} מדרגות שכדאי לחזור אליהן`);
  return parts.length ? parts.join(' · ') : 'כל משבצת היא מדרגה. היא נצבעת כשמתחילים ללמוד אותה.';
}

export default function MasteryMap({ rows }) {
  return (
    <div className="mastery-map" role="group" aria-label="מה כבר למדתי">
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
    </div>
  );
}
