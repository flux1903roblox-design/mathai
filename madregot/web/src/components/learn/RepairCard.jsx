// The streak's repair, offered calmly on the home screen (STUDENT-5): when the last school day had no learning, two
// finished items today keep the streak, at most once in 30 days. No red, Madi at rest, and a close button that hides
// the card for the day. The words never put the missed day on the student: "אתמול לא יצא ללמוד", never "you missed".
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { useApp, useStreak, today } from '@/lib/store.js';
import { useNext } from '@/lib/useLearn.js';
import Mascot from '@/components/Mascot.jsx';
import { Button } from '@/components/ui.jsx';

import { localized, t } from '@/lib/i18n.js';
let DAY_NAME = localized(() => ([t('shell.repaircard.1'), t('shell.repaircard.2'), t('shell.repaircard.3'), t('shell.repaircard.4'), t('shell.repaircard.5'), t('shell.repaircard.6')]), (v) => { DAY_NAME = v; });

/** "אתמול לא יצא ללמוד. עוד שני שיעורים היום, והרצף של 5 ימים נשמר." (the gap is named by its day when it was not yesterday) */
export function repairText(r, todayKey) {
  const yesterday = new Date(`${todayKey}T12:00:00Z`); yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const when = r.gap === yesterday.toISOString().slice(0, 10) ? t('shell.repaircard.7') : t('shell.repaircard.8', { p0: DAY_NAME[new Date(`${r.gap}T12:00:00Z`).getUTCDay()] });
  const k = Math.max(1, r.left);
  return t('shell.repaircard.11', { when, p1: k === 1 ? t('shell.repaircard.9') : t('shell.repaircard.10'), streak: r.streak });
}

/** Today's repair, when there is one: the same answer the header's flame shows at risk (store.js useStreak). */
export const useRepair = () => useStreak().repair;

/** The repair card is up today: there is a repair, and the card was not closed today. */
export function useRepairOn() {
  const r = useRepair();
  const dismissed = useApp((s) => s.nudges?.repairDismissed);
  return !!r && dismissed !== today();
}

export default function RepairCard() {
  const r = useRepair();
  if (!useRepairOn()) return null;
  return <RepairCardView r={r} />;
}

function RepairCardView({ r }) {
  const navigate = useNavigate();
  // the one plan's next step (learn/next.ts planNext), the same one the home and the mission name
  const plan = useNext();
  const d = today();
  return (
    <section className="repair-card" aria-labelledby="repair-text">
      <Mascot mood="idle" size={52} className="repair-madi" />
      <div className="repair-main">
        <p id="repair-text" className="repair-text">{repairText(r, d)}</p>
        <Button className="btn-sm repair-go" onClick={() => navigate(plan.top?.to || '/quests')}>{t('shell.repaircard.12')}</Button>
      </div>
      <button type="button" className="icon-btn repair-close" aria-label={t('shell.repaircard.13')} onClick={() => useApp.getState().setNudge({ repairDismissed: d })}>
        <X size={20} aria-hidden="true" />
      </button>
    </section>
  );
}
