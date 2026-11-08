import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { Check, Target } from 'lucide-react';
import { useApp } from '@/lib/store.js';
import { boardOf, gapTarget, GAP_CLEAR } from '@/lib/board.js';
import { PARTS } from '@/lib/lesson.js';
import Mascot from './Mascot.jsx';
import Stairs from './Stairs.jsx';
import { MathText } from './MathText.jsx';
import { Button } from './ui.jsx';

const STATUS = { done: 'הושלם', going: 'בדרך', work: 'כדאי לחזק', new: 'עוד לא התחלנו' };
const GRADE_NAME = { 7: 'כיתה ז׳', 8: 'כיתה ח׳' };
const plain = (s) => String(s).replace(/\$/g, '');

function TopicRow({ t, path, progress, onStart, onJump }) {
  const now = t.done >= t.top ? 'כל המדרגות הושלמו' : `עכשיו: ${t.current?.title || ''}`;
  return (
    <li className={clsx('board-topic', `ch-${t.color}`)}>
      <button type="button" className="board-topic-head" onClick={() => onJump(t.id)} aria-label={`${t.title}: ${t.done} מתוך ${t.top} מדרגות. ${STATUS[t.status]}. ${now}. מעבר ליחידה במפה`}>
        <span className="board-meter">
          <Stairs steps={t.top} done={t.done} part={t.done < t.top ? t.parts / PARTS : 0} />
          <bdi dir="ltr" className="board-meter-num">{t.done}/{t.top}</bdi>
        </span>
        <span className="board-topic-text"><b>{t.title}</b><span>{now}</span></span>
        <span className={clsx('board-pill', `pill-${t.status}`)}>{STATUS[t.status]}</span>
      </button>
      {t.open.length > 0 && (
        <div className="board-gaps">
          <h3 className="board-gaps-title">מה עוד לא ברור</h3>
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
      {t.cleared > 0 && <p className="board-cleared"><Check size={18} strokeWidth={3} aria-hidden="true" />{t.cleared === 1 ? 'טעות אחת שחזרה כבר תוקנה' : `${t.cleared} טעויות שחזרו כבר תוקנו`}</p>}
    </li>
  );
}

/**
 * The level board at the top of the learn screen: the stairs climbed in the grade,
 * each topic's stair and status, and what is not clear yet, with a way to practise it.
 */
export default function Board({ grade, next, placed, onStart, onJump }) {
  const { path, progress, gaps, placement, profile } = useApp();
  const b = boardOf({ grade, path, progress, gaps, placement });
  const tested = placement?.grade === String(grade);
  const startNext = () => onStart(next.kind === 'review' ? `/lesson/${next.topic}/${next.level}?kind=review` : `/lesson/${next.topic}/${next.level}?part=${Math.min(next.parts + 1, PARTS)}`);
  return (
    <section className="board" aria-labelledby="board-title">
      <div className="board-hero">
        <Mascot mood={placed ? 'achievement' : 'idle'} size={72} className="board-mascot" />
        <div className="board-hero-text">
          <h2 id="board-title" className="board-title">{placed ? 'זה הלוח שלכם' : profile?.name ? `הלוח של ${profile.name}` : 'הלוח שלי'}</h2>
          <p className="board-level">עליתם <b>{b.done}</b> מתוך {b.total} מדרגות ב{GRADE_NAME[grade]}</p>
        </div>
      </div>
      <div className="board-track" aria-hidden="true">
        {b.topics.map((t) => <span key={t.id} className={`ch-${t.color}`} style={{ flexGrow: t.top }}><i style={{ width: `${(t.done / t.top) * 100}%` }} /></span>)}
      </div>
      {next && <Button className="btn-block btn-lg board-go" onClick={startNext}>{next.kind === 'review' ? 'חזרה על היחידה' : `${next.parts ? 'המשך' : 'התחלה'}: ${next.title}`}</Button>}

      <ul className="board-topics">
        {b.topics.map((t) => <TopicRow key={t.id} t={t} path={path} progress={progress} onStart={onStart} onJump={onJump} />)}
      </ul>
      {b.open === 0 && b.done > 0 && <p className="board-note">אין כרגע טעויות שחוזרות. כשמשהו לא יסתדר, הוא יופיע כאן עם תרגול מתאים.</p>}

      <div className="board-foot">
        <Link to={`/placement?grade=${grade}`} className="board-link"><Target size={18} aria-hidden="true" />{tested ? 'בדיקת רמה מחדש' : 'בדיקת רמה קצרה'}</Link>
        <span className="board-foot-note">{tested ? 'מדרגות שכבר עליתם נשארות פתוחות.' : 'עד 9 שאלות. פותחת את המדרגות שכבר יודעים.'}</span>
      </div>
    </section>
  );
}
