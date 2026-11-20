// "מה כבר למדתי": one tile per stair of the grade, coloured by what the evidence says (mastered alone,
// practising, worth a review, needs help, not started). Each tile opens its stair. A picture, not a dashboard:
// it sits inside the board (Board.jsx), which says in words what the picture shows. Each tile's name says its state
// as the stair page says it (learn/stairStatus.ts): a lesson left in the middle is started, and a memory check that
// came due is told apart from one that was missed; the colour is its engine state's.
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { topicsFor } from '@/content/topics.js';
import { skillId } from '@/learn/skills.ts';
import { STATE_LABEL } from '@/learn/mastery.ts';
import { stairStatus, STATUS_LABEL, STATUS_TONE, countStatuses } from '@/learn/stairStatus.ts';
import { isDone } from '@/lib/path.js';

const LEGEND = ['mastered', 'practicing', 'needs-review', 'needs-support'];

/**
 * Every stair of a grade with its status now (a stair finished on the map before 2.0 is at least practised): `status`
 * for its words, `st` for its colour (the engine state's).
 */
export function gradeTiles(grade, skills, path, now = new Date().toISOString()) {
  return topicsFor(grade).map((t) => ({
    t,
    tiles: t.levels.map((L, i) => {
      const id = skillId(t.id, i + 1);
      const status = stairStatus(skills[id], now, isDone(path, t.id, i + 1));
      return { id, level: i + 1, title: L.title, status, st: STATUS_TONE[status] };
    }),
  }));
}

/** The words for "several stairs" or "one stair": מדרגה אחת ש… / N מדרגות ש… */
const stairs = (n, one, many) => (n === 1 ? one : `${n} ${many}`);

/**
 * The board's line about the tiles, in words that move from the first stage: no row of zeros. Counted as the profile
 * counts (learn/stairStatus.ts countStatuses): a stair whose memory check came due is still mastered.
 */
export function tilesSummary(rows) {
  const all = rows.flatMap((r) => r.tiles);
  const c = countStatuses(all.map((x) => x.status));
  const parts = [];
  if (c.learned) parts.push(`שולטים לבד ב־${c.learned} מתוך ${c.of} מדרגות`);
  if (c.onWay) parts.push(stairs(c.onWay, 'מדרגה אחת בדרך לשליטה', 'מדרגות בדרך לשליטה'));
  if (c.due) parts.push(stairs(c.due, 'מדרגה אחת מחכה לבדיקת זיכרון', 'מדרגות מחכות לבדיקת זיכרון'));
  if (c.strengthen) parts.push(stairs(c.strengthen, 'מדרגה אחת שכדאי לחזק', 'מדרגות שכדאי לחזק'));
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
                <Link to={`/learn/${t.id}/${x.level}`} className={clsx('mm-tile', `ms-${x.st}`)} aria-label={`${x.title}: ${STATUS_LABEL[x.status]}`} title={`${x.title}: ${STATUS_LABEL[x.status]}`}>{x.level}</Link>
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
