// The daily quests' chest lets the student choose one of two pieces for מדי (PRODUCT2-36), next to the chest's streak
// freeze. Both pieces are shown by name and picture before the choice (no surprise, no draw), the choice is kept at once
// (store.pickChest: one piece a chest), and the piece not chosen stays first in line for the next chest.
// Used by the end of a lesson (LessonDone), the quests tab and the wardrobe; loaded with them, never at boot.
import { useId } from 'react';
import clsx from 'clsx';
import { Check } from 'lucide-react';
import Mascot from '@/components/Mascot.jsx';
import { nameOf, SLOT_NAME, itemOf, DEFAULT_LOOK, wearing } from '@/lib/wardrobe.js';
import { useApp, today } from '@/lib/store.js';
import { chestOffer } from '@/lib/rewards.js';
import { ownedLook } from '@/lib/wardrobe.js';
import '@/styles/lazy/chest.css';

/** The quest chest's offer now: { day, ids } or null. */
export function useChestOffer() {
  const days = useApp((s) => s.days);
  const look = useApp((s) => s.look);
  const path = useApp((s) => s.path);
  const skills = useApp((s) => s.learn.skills);
  const classGoals = useApp((s) => s.classGoals);
  const grade = useApp((s) => s.profile?.grade);
  const o = ownedLook({ path, classGoals, grade, earned: look?.earned, skills });
  return chestOffer({ days, look, today: today(), owned: new Set([...o.colors, ...o.items]) });
}

/**
 * Two big buttons, one per piece. `picked`: the id chosen (then the other says it waits for the next chest);
 * onPick(id) chooses. `title` is the group's visible name.
 */
export default function ChestChoice({ ids, picked = null, onPick, title = 'בחרו חלק אחד למדי' }) {
  const uid = useId();
  const other = picked ? ids.find((id) => id !== picked) : null;
  return (
    <div className="chest-choice" role="group" aria-labelledby={`${uid}-t`}>
      <p id={`${uid}-t`} className="chest-choice-title">{title}</p>
      <div className="chest-choice-row">
        {ids.map((id) => {
          const on = picked === id;
          return (
            <button key={id} type="button" className={clsx('chest-opt', on && 'is-picked')} aria-pressed={on} disabled={!!picked && !on}
              onClick={() => !picked && onPick(id)}>
              <span className="chest-opt-pic"><Mascot size={64} still look={{ ...DEFAULT_LOOK, ...wearing(id) }} className="chest-opt-madi" /></span>
              <span className="chest-opt-name">{nameOf(id)}</span>
              <span className="chest-opt-slot">{SLOT_NAME[itemOf(id)?.slot]}</span>
              {on && <span className="chest-opt-mark" aria-hidden="true"><Check size={16} strokeWidth={3} /></span>}
            </button>
          );
        })}
      </div>
      <p className="chest-choice-note" aria-live="polite">{picked
        ? `${nameOf(picked)} אצל מדי.${other ? ` ${nameOf(other)} יחכה בתיבה הבאה.` : ''}`
        : ids.length > 1 ? 'החלק שלא תבחרו יחכה בתיבה הבאה.' : 'זה החלק האחרון שבתיבה.'}</p>
    </div>
  );
}
