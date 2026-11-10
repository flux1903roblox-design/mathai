import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { Check, Target } from 'lucide-react';
import { useApp } from '@/lib/store.js';
import { boardOf, gapTarget, GAP_CLEAR } from '@/lib/board.js';
import { placementMax } from '@/lib/placement.js';
import MasteryMap, { gradeTiles, tilesSummary } from './learn/MasteryMap.jsx';
import { MathText } from './MathText.jsx';
import { Button } from './ui.jsx';

const plain = (s) => String(s).replace(/\$/g, '');

/** What is not clear yet in one topic, with a way to practise each, and the mistakes already fixed there. */
function TopicGaps({ t, path, progress, onStart }) {
  return (
    <li className={clsx('board-topic', `ch-${t.color}`)}>
      {t.open.length > 0 && (
        <div className="board-gaps">
          <h3 className="board-gaps-title">מה עוד לא ברור: {t.title}</h3>
          <ul className="gap-list">
            {t.open.slice(0, 3).map((g) => (
              <li key={g.id} className="gap">
                <span className="gap-text">
                  <MathText text={g.text} />
                  <span className="gap-meta">
                    {g.exam ? 'מהמבחן שבדקתם' : g.n === 1 ? 'טעות אחת' : `${g.n} טעויות`}
                    {g.ok > 0 ? `, ${g.ok} מתוך ${GAP_CLEAR} תשובות נכונות מאז` : ''}
                  </span>
                </span>
                <Button variant="secondary" className="btn-sm" onClick={() => onStart(gapTarget(t.id, g.level, path, progress))} aria-label={`לתרגל: ${plain(g.text)}`}>לתרגל</Button>
              </li>
            ))}
          </ul>
          {t.open.length > 3 && <p className="gap-more">ועוד {t.open.length - 3} שכדאי לחזק בנושא הזה.</p>}
        </div>
      )}
      {t.cleared > 0 && <p className="board-cleared"><Check size={18} strokeWidth={3} aria-hidden="true" />{t.title}: {t.cleared === 1 ? 'טעות אחת שחזרה כבר תוקנה' : `${t.cleared} טעויות שחזרו כבר תוקנו`}</p>}
    </li>
  );
}

/**
 * The board under the units on the topics screen, one place instead of three stacked counters: the grade's stairs
 * as tiles (what the evidence says about each), one line that says it in words and moves from the first stage, what
 * is not clear yet with a way to practise it, and the placement test. The units' own progress is on their cards.
 */
export default function Board({ grade, placed, onStart }) {
  const { path, progress, gaps, placement, profile } = useApp();
  const skills = useApp((s) => s.learn.skills);
  const b = boardOf({ grade, path, progress, gaps, placement });
  const rows = gradeTiles(grade, skills, path);
  const tested = placement?.grade === String(grade);
  const withGaps = b.topics.filter((t) => t.open.length > 0 || t.cleared > 0);
  const started = rows.some((r) => r.tiles.some((x) => x.st !== 'not-started'));
  return (
    <section className="board" aria-labelledby="board-title">
      <div className="board-hero">
        <div className="board-hero-text">
          <h2 id="board-title" className="board-title">{placed ? 'זה הלוח שלכם' : profile?.name ? `הלוח של ${profile.name}` : 'הלוח שלי'}</h2>
          <p className="board-level">{tilesSummary(rows)}</p>
        </div>
      </div>
      <MasteryMap rows={rows} />
      {withGaps.length > 0 && (
        <ul className="board-topics">
          {withGaps.map((t) => <TopicGaps key={t.id} t={t} path={path} progress={progress} onStart={onStart} />)}
        </ul>
      )}
      {b.open === 0 && started && <p className="board-note">אין כרגע טעויות שחוזרות. כשמשהו לא יסתדר, הוא יופיע כאן עם תרגול מתאים.</p>}

      <div className="board-foot">
        <Link to={`/placement?grade=${grade}`} className="board-link"><Target size={18} aria-hidden="true" />{tested ? 'בדיקת רמה מחדש' : 'בדיקת רמה קצרה'}</Link>
        <span className="board-foot-note">{tested ? 'מדרגות שכבר עליתם נשארות פתוחות.' : `עד ${placementMax(grade)} שאלות. פותחת את המדרגות שכבר יודעים.`}</span>
      </div>
    </section>
  );
}
