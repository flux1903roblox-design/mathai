// The streak's repair, offered calmly on the home screen (STUDENT-5): when the last school day had no learning, two
// finished items today keep the streak, at most once in 30 days. No red, Madi at rest, and a close button that hides
// the card for the day. The words never put the missed day on the student: "אתמול לא יצא ללמוד", never "you missed".
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { useApp, today } from '@/lib/store.js';
import { streakRepair } from '@/lib/streak.js';
import { useActions } from '@/lib/useLearn.js';
import Mascot from '@/components/Mascot.jsx';
import { Button } from '@/components/ui.jsx';

const DAY_NAME = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי'];

/** "אתמול לא יצא ללמוד. עוד שני שיעורים היום, והרצף של 5 ימים נשמר." (the gap is named by its day when it was not yesterday) */
export function repairText(r, todayKey) {
  const yesterday = new Date(`${todayKey}T12:00:00Z`); yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const when = r.gap === yesterday.toISOString().slice(0, 10) ? 'אתמול' : `ביום ${DAY_NAME[new Date(`${r.gap}T12:00:00Z`).getUTCDay()]}`;
  const k = Math.max(1, r.left);
  return `${when} לא יצא ללמוד. עוד ${k === 1 ? 'שיעור אחד' : 'שני שיעורים'} היום, והרצף של ${r.streak} ימים נשמר.`;
}

/** The repair, when there is one for today and the card was not closed today. */
export function useRepair() {
  const days = useApp((s) => s.days);
  const lastRepair = useApp((s) => s.streak?.lastRepair ?? null);
  return streakRepair(days, today(), lastRepair);
}

export default function RepairCard() {
  const r = useRepair();
  const dismissed = useApp((s) => s.nudges?.repairDismissed);
  if (!r || dismissed === today()) return null;
  return <RepairCardView r={r} />;
}

function RepairCardView({ r }) {
  const navigate = useNavigate();
  const actions = useActions();
  const d = today();
  return (
    <section className="repair-card" aria-labelledby="repair-text">
      <Mascot mood="idle" size={52} className="repair-madi" />
      <div className="repair-main">
        <p id="repair-text" className="repair-text">{repairText(r, d)}</p>
        <Button className="btn-sm repair-go" onClick={() => navigate(actions[0]?.to || '/quests')}>לשיעור</Button>
      </div>
      <button type="button" className="icon-btn repair-close" aria-label="סגירה" onClick={() => useApp.getState().setNudge({ repairDismissed: d })}>
        <X size={20} aria-hidden="true" />
      </button>
    </section>
  );
}
