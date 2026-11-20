// "אתגר משפחתי" on the missions tab (PRODUCT2-39): the weekly goal a parent sent and the child accepted on this device
// (lib/familyChallenge.js), with the week's progress as dots, counted from the child's own days (lib/streak.js
// weekTotals: the same numbers the weekly summary sends). Calm: no countdown to the week's end, no loss words, no price,
// and the child can take it off at any time. A goal for next week (accepted from Thursday on) waits for its Sunday; a
// week that ended is not shown here (its summary keeps it).
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import clsx from 'clsx';
import { HeartHandshake } from 'lucide-react';
import { useApp, today } from '@/lib/store.js';
import { weekTotals } from '@/lib/streak.js';
import { currentChallenge, challengeProgress, goalText, unitHint, dm } from '@/lib/familyChallenge.js';
import '@/styles/lazy/quests.css'; // the card's rules, loaded with it (moved out of the first load at the product2 merge)

export const DROPPED = 'האתגר הוסר. אם תרצו, אפשר לפתוח שוב את הקישור מההורים.';

export default function FamilyChallengeCard() {
  const family = useApp((s) => s.family);
  const days = useApp((s) => s.days);
  const ch = currentChallenge(family, today());
  if (!ch) return null;
  const p = challengeProgress(ch, weekTotals(days, ch.w));
  const drop = () => { useApp.getState().dropChallenge(ch.w); toast(DROPPED); };
  return (
    <section className="card family-card" aria-labelledby="fc-h">
      <h2 id="fc-h" className="card-title"><HeartHandshake size={22} aria-hidden="true" className="brand-icon" />אתגר משפחתי</h2>
      {ch.upcoming ? (
        <p className="fc-goal">{`האתגר מתחיל ביום ראשון, ${dm(ch.w)}: ${goalText(ch)} בשבוע.`}</p>
      ) : (
        <>
          <p className="fc-goal">{`${goalText(ch)} השבוע`}</p>
          <ol className="fc-dots" aria-hidden="true">
            {Array.from({ length: ch.n }, (_, i) => <li key={i} className={clsx('fc-dot', i < p.have && 'is-on')} />)}
          </ol>
          <p className="fc-line">{p.done ? `עשיתם את זה! ${p.n} מתוך ${p.n}.` : `עד עכשיו: ${p.have} מתוך ${p.n}.`}</p>
          {p.done && (
            <>
              <p className="fc-tell">אפשר לספר להורים בסיכום השבועי.</p>
              <Link to="/report" className="btn btn-secondary fc-report">לסיכום השבועי</Link>
            </>
          )}
          <p className="field-hint">{unitHint(ch.k)}</p>
        </>
      )}
      <button type="button" className="link-btn fc-drop" onClick={drop}>להסיר את האתגר</button>
    </section>
  );
}
