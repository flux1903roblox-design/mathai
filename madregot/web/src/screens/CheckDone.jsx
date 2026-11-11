// The end of a check: what it showed, said honestly and kindly, and the next useful step.
// Layout: Duolingo's lesson-complete screen (character, title, stat tiles, one button at the bottom).
// After a passed mastery check of a stair that has a challenge task (CURRICULUM-6.3), a quiet card offers it: optional,
// one tap to try, one tap to put it off. The main button stays the plan's next step.
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { Award, RotateCcw, Check, ArrowLeft, Gift, Puzzle } from 'lucide-react';
import { TOPIC } from '@/content/index.js';
import { useApp } from '@/lib/store.js';
import { skillId, parseSkill } from '@/learn/skills.ts';
import { MASTERY_N, MASTERY_NEED, REVIEW_DAYS } from '@/learn/mastery.ts';
import { titleOf } from '@/learn/recommend.ts';
import { contentOf } from '@/learn/content/index.ts';
import { useNext } from '@/lib/useLearn.js';
import { nextAfter } from '@/learn/challenges/index.ts';
import { Button } from '@/components/ui.jsx';
import { MathText } from '@/components/MathText.jsx';
import Mascot from '@/components/Mascot.jsx';
import { inDays } from '@/content/util.js';

function copy(r, rec, def, award) {
  const days = (box) => REVIEW_DAYS[box] ?? 1;
  switch (r.purpose) {
    case 'mastery':
      return r.passed
        ? { mood: 'achievement', title: 'שולטים לבד!', body: `${r.right} מתוך ${r.asked} נכונות, בלי רמזים. ${inDays(days(0))} נבדוק בקצרה שזה נשאר.` }
        : { mood: 'encouraging', title: 'עוד לא, וזה בסדר', body: `${r.right} מתוך ${r.asked}. כדי לשלוט צריך ${MASTERY_NEED} מתוך ${MASTERY_N} בלי רמזים. ${award?.reopened ? 'המדרגה חוזרת להיות פתוחה במפה, והתרגול שכבר עשיתם נשמר. ' : ''}עוד קצת תרגול, ואז מנסים שוב.` };
    case 'review':
      return r.passed
        ? { mood: 'happy', title: 'זה נשאר!', body: `הבדיקה הבאה ${inDays(days(rec?.mastered?.box ?? 1))}. כל פעם המרווח גדל.` }
        : { mood: 'encouraging', title: 'שכחנו קצת', body: 'זה קורה, וזה לא מוחק את מה שלמדתם. חזרה קצרה תחזיר את זה, ומחר בודקים שוב.' };
    case 'verify':
      return r.passed
        ? { mood: 'achievement', title: 'תוקן!', body: def ? `"${def.title}" לא הופיע שוב. כל הכבוד.` : 'הטעות לא הופיעה שוב.' }
        : { mood: 'encouraging', title: 'עוד לא לגמרי', body: 'הטעות עוד הופיעה. ננסה דרך אחרת: דוגמה פתורה, הסבר אחר, או מדרגה קודמת שהמדרגה הזאת נשענת עליה.' };
    case 'diagnostic':
      return { mood: 'happy', title: 'הבדיקה הסתיימה', body: `${r.right} מתוך ${r.asked} נכונות. עכשיו אפשר לבנות תוכנית שמתאימה בדיוק למה שצריך.` };
    case 'exam':
      return { mood: r.accuracy >= 80 ? 'achievement' : 'happy', title: 'מבחן התרגול הסתיים', body: `${r.right} מתוך ${r.asked} נכונות. בתוכנית רואים מה עוד כדאי לחזק לפני המבחן.` };
    default:
      return { mood: 'happy', title: 'סיימתם', body: '' };
  }
}

/** The floor check's facts line: the same words on its end screen and in Topics → יסודות לחיזוק. */
export const FACTS_LINE = 'לוח הכפל הוא בסיס לשברים. תרגול קצר עוזר לכל השאר.';

/**
 * The end of the floor check (בדיקת יסודות), in one of three forms: a fractions stair missed (the unit is now on the
 * map, at the top, and the first missed stair is one tap away), nothing missed (back to where the student was), or
 * only the multiplication facts missed (a short practice of them). Calm and short: it is a check of the basics, and a
 * miss is a place to start, not a grade.
 */
export function floorEnd(r) {
  const missed = Object.entries(r.perSkill || {}).filter(([s, x]) => s.startsWith('frac:') && x.right < x.asked)
    .map(([s]) => s).sort((a, b) => parseSkill(a).level - parseSkill(b).level);
  const facts = r.perSkill?.['facts:0'];
  const factsMissed = !!facts && facts.right < facts.asked;
  if (missed.length) {
    return {
      variant: 'frac', mood: 'encouraging', title: 'בדיקת היסודות הסתיימה',
      lines: [`כדאי לחזק: ${missed.map(titleOf).join(', ')}. הוספנו את "שברים ועשרוניים" למפה, בראש הדרך.`, ...(factsMissed ? [FACTS_LINE] : [])],
      primary: { label: 'ליסודות', to: `/learn/${missed[0].replace(':', '/')}` },
    };
  }
  if (factsMissed) return { variant: 'facts', mood: 'encouraging', title: 'בדיקת היסודות הסתיימה', lines: [FACTS_LINE], primary: { label: 'לתרגול לוח הכפל', to: '/facts' } };
  return { variant: 'none', mood: 'achievement', title: 'היסודות במקום', lines: ['שברים ולוח הכפל עובדים לכם. ממשיכים מאיפה שהייתם.'], primary: null };
}

function FloorDone({ r, onExit }) {
  const navigate = useNavigate();
  const end = floorEnd(r);
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus({ preventScroll: true }); }, []);
  return (
    <div className={clsx('page check-done floor-done', `floor-${end.variant}`)} role="main">
      <div className="check-hero" data-region="content"><Mascot mood={end.mood} size={150} className="check-mascot" /></div>
      <h1 ref={ref} tabIndex={-1} className={clsx('check-title', end.variant === 'none' && 'good')}>{end.title}</h1>
      {end.lines.map((line) => <p key={line} className="lead">{line}</p>)}
      <div className="stats check-stats" data-region="answers">
        <div className={clsx('stat', r.right === r.asked ? 'stat-good' : 'stat-brand')}>
          <span className="stat-label">נכונות</span>
          <span className="stat-value" aria-label={`${r.right} נכונות מתוך ${r.asked}`}><Check size={20} aria-hidden="true" /><bdi dir="ltr">{r.right}/{r.asked}</bdi></span>
        </div>
        {r.xp > 0 && (
          <div className="stat stat-gold">
            <span className="stat-label">XP</span>
            <span className="stat-value check-xp"><Award size={20} aria-hidden="true" /><span>+{r.xp}</span></span>
          </div>
        )}
      </div>
      <div className="form-actions" data-region="footer">
        {end.primary && (
          <Button className="btn-block btn-lg" onClick={() => navigate(end.primary.to, { replace: true })}>{end.primary.label}<ArrowLeft size={18} aria-hidden="true" /></Button>
        )}
        <Button variant={end.primary ? 'ghost' : 'primary'} className={clsx('btn-block', !end.primary && 'btn-lg')} onClick={onExit}>חזרה למפה</Button>
      </div>
    </div>
  );
}

export default function CheckDone({ result: r, award, onExit }) {
  if (r.purpose === 'floor') return <FloorDone r={r} onExit={onExit} />;
  return <StairCheckDone result={r} award={award} onExit={onExit} />;
}

/** The challenge offer after a passed mastery check: the stair's first task not solved yet. */
export const CHALLENGE_ASK = 'יש אתגר למדרגה הזאת. רוצים לנסות?';
function ChallengeOffer({ task, onGo, onLater }) {
  return (
    <section className="check-challenge" aria-labelledby="cc-title">
      <div className="check-challenge-row">
        <span className="check-challenge-icon" aria-hidden="true"><Puzzle size={22} /></span>
        <div className="check-challenge-text">
          <h2 id="cc-title" className="check-challenge-title">{CHALLENGE_ASK}</h2>
          <p className="check-challenge-sub"><MathText text={task.title} /> · {task.minutes} דק׳</p>
        </div>
      </div>
      <div className="check-challenge-actions">
        <Button variant="secondary" className="btn-sm" onClick={onGo}>לאתגר</Button>
        <Button variant="ghost" className="btn-sm" onClick={onLater}>לא עכשיו</Button>
      </div>
    </section>
  );
}

function StairCheckDone({ result: r, award, onExit }) {
  const navigate = useNavigate();
  const skill = r.skill || (r.topic && r.level ? skillId(r.topic, r.level) : null);
  const rec = useApp((s) => (skill ? s.learn.skills[skill] : null));
  const solved = useApp((s) => s.learn.challenges);
  // what it offers is fixed when the screen opens: solving it elsewhere later does not swap the card
  const [offer] = useState(() => (r.purpose === 'mastery' && r.passed && skill ? nextAfter(skill, solved) : null));
  const [later, setLater] = useState(false);
  const def = r.misc ? contentOf(skill)?.misconceptions.find((m) => m.id === r.misc) : null;
  const { items: actions } = useNext();
  const c = copy(r, rec, def, award);
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus({ preventScroll: true }); }, []);
  const rescue = r.purpose === 'diagnostic' || r.purpose === 'exam';
  // the next step of the plan, never this check again, and never this stair's challenge while the card offers it
  const nextA = actions.find((a) => !(a.skill === skill && (a.kind === (r.purpose === 'mastery' ? 'mastery' : r.purpose) || (offer && a.kind === 'challenge'))));
  const putOff = () => { setLater(true); ref.current?.focus({ preventScroll: true }); };
  const weak = Object.entries(r.perSkill || {}).filter(([, x]) => x.right < x.asked).map(([s]) => s);
  return (
    <div className="page check-done" role="main">
      {/* laid out like Duolingo's lesson-complete screen: מדי, the title, what it showed, then the stat tiles */}
      <div className="check-hero" data-region="content"><Mascot mood={c.mood} size={150} className="check-mascot" /></div>
      <h1 ref={ref} tabIndex={-1} className={clsx('check-title', r.passed ? 'good' : 'warm')}>{c.title}</h1>
      <p className="lead">{c.body}</p>
      {/* a passed mastery check is what moves the path: the stair is done, and the unit's count goes up */}
      {r.purpose === 'mastery' && r.passed && award?.done != null && TOPIC[r.topic] && (
        <p className="climb-caption">{TOPIC[r.topic].title}: <bdi>{award.done}</bdi> מתוך <bdi>{TOPIC[r.topic].levels.length}</bdi> מדרגות</p>
      )}
      {award?.chestOpened && <div className="badges"><span className="done-earned tone-streak"><Gift size={16} aria-hidden="true" />פתחתם תיבת אוצר</span></div>}
      <div className="stats check-stats" data-region="answers">
        <div className={clsx('stat', r.right === r.asked ? 'stat-good' : 'stat-brand')}>
          <span className="stat-label">נכונות</span>
          <span className="stat-value" aria-label={`${r.right} נכונות מתוך ${r.asked}`}><Check size={20} aria-hidden="true" /><bdi dir="ltr">{r.right}/{r.asked}</bdi></span>
        </div>
        {r.xp > 0 && (
          <div className="stat stat-gold">
            <span className="stat-label">XP</span>
            <span className="stat-value check-xp"><Award size={20} aria-hidden="true" /><span>+{r.xp}</span></span>
          </div>
        )}
      </div>
      {offer && !later && <ChallengeOffer task={offer} onGo={() => navigate(`/challenge/${offer.id}`, { replace: true })} onLater={putOff} />}
      {rescue && weak.length > 0 && (
        <div className="box box-note"><h2 className="box-tab">מה עוד לא יצא</h2><div className="box-body"><ul className="plain-list">{weak.map((s) => <li key={s}>{titleOf(s)}</li>)}</ul></div></div>
      )}
      <div className="form-actions" data-region="footer">
        {rescue ? (
          <Button className="btn-block btn-lg" onClick={() => navigate('/rescue', { replace: true })}>לתוכנית ההכנה<ArrowLeft size={18} aria-hidden="true" /></Button>
        ) : !r.passed && skill ? (
          <>
            <Button className="btn-block btn-lg" onClick={() => navigate(`/learn/${skill.replace(':', '/')}`, { replace: true })}><RotateCcw size={18} aria-hidden="true" />בחזרה למדרגה</Button>
            {nextA && nextA.kind === 'prereq' && <Button variant="secondary" className="btn-block" onClick={() => navigate(nextA.to, { replace: true })}><MathText text={nextA.title} /></Button>}
          </>
        ) : nextA ? (
          <Button className="btn-block btn-lg" onClick={() => navigate(nextA.to, { replace: true })}>הלאה: <MathText text={nextA.title} /></Button>
        ) : null}
        <Button variant="ghost" className="btn-block" onClick={onExit}>למפה</Button>
      </div>
    </div>
  );
}
