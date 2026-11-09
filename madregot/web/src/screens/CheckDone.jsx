// The end of a check: what it showed, said honestly and kindly, and the next useful step.
// Layout: Duolingo's lesson-complete screen (character, title, stat tiles, one button at the bottom).
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { Award, RotateCcw, Check, ArrowLeft } from 'lucide-react';
import { useApp } from '@/lib/store.js';
import { skillId } from '@/learn/skills.ts';
import { MASTERY_N, MASTERY_NEED, REVIEW_DAYS } from '@/learn/mastery.ts';
import { titleOf } from '@/learn/recommend.ts';
import { contentOf } from '@/learn/content/index.ts';
import { useActions } from '@/lib/useLearn.js';
import { Button } from '@/components/ui.jsx';
import { MathText } from '@/components/MathText.jsx';
import Mascot from '@/components/Mascot.jsx';

function copy(r, rec, def) {
  const days = (box) => REVIEW_DAYS[box] ?? 1;
  switch (r.purpose) {
    case 'mastery':
      return r.passed
        ? { mood: 'achievement', title: 'שולטים לבד!', body: `${r.right} מתוך ${r.asked} נכונות, בלי רמזים. בעוד ${days(0)} ${days(0) === 1 ? 'יום' : 'ימים'} נבדוק בקצרה שזה נשאר.` }
        : { mood: 'encouraging', title: 'עוד לא, וזה בסדר', body: `${r.right} מתוך ${r.asked}. כדי לשלוט צריך ${MASTERY_NEED} מתוך ${MASTERY_N} בלי רמזים. עוד קצת תרגול, ואז מנסים שוב.` };
    case 'review':
      return r.passed
        ? { mood: 'happy', title: 'זה נשאר!', body: `הבדיקה הבאה בעוד ${days(rec?.mastered?.box ?? 1)} ימים. כל פעם המרווח גדל.` }
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

export default function CheckDone({ result: r, onExit }) {
  const navigate = useNavigate();
  const skill = r.skill || (r.topic && r.level ? skillId(r.topic, r.level) : null);
  const rec = useApp((s) => (skill ? s.learn.skills[skill] : null));
  const def = r.misc ? contentOf(skill)?.misconceptions.find((m) => m.id === r.misc) : null;
  const actions = useActions();
  const c = copy(r, rec, def);
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus({ preventScroll: true }); }, []);
  const rescue = r.purpose === 'diagnostic' || r.purpose === 'exam';
  const nextA = actions.find((a) => !(a.skill === skill && a.kind === (r.purpose === 'mastery' ? 'mastery' : r.purpose)));
  const weak = Object.entries(r.perSkill || {}).filter(([, x]) => x.right < x.asked).map(([s]) => s);
  return (
    <div className="page check-done" role="main">
      {/* laid out like Duolingo's lesson-complete screen: מדי, the title, what it showed, then the stat tiles */}
      <Mascot mood={c.mood} size={150} className="check-mascot" />
      <h1 ref={ref} tabIndex={-1} className={clsx('check-title', r.passed ? 'good' : 'warm')}>{c.title}</h1>
      <p className="lead">{c.body}</p>
      <div className="stats check-stats">
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
      {rescue && weak.length > 0 && (
        <div className="box box-note"><h2 className="box-tab">מה עוד לא יצא</h2><div className="box-body"><ul className="plain-list">{weak.map((s) => <li key={s}>{titleOf(s)}</li>)}</ul></div></div>
      )}
      <div className="form-actions">
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
