// The end of a check names a mistake that came back (PRODUCT2-18): when one named misconception showed up twice or more
// in the check's own answers, or once and it had shown before (a suspicion or more on the stair), one calm line names it and a
// button opens its repair. Counted from this check's results, never from older practice, so "3 מתוך 5" is not all the
// student hears when two of the misses were the same mistake (the council's pct:4 case: two "stop at 1%" answers).
import { Wrench } from 'lucide-react';
import { catLabel } from '@/content/index.js';
import { parseSkill } from '@/learn/skills.ts';
import { metaOf } from '@/learn/content/index.ts';
import { Button } from '@/components/ui.jsx';
import { MathText } from '@/components/MathText.jsx';

const TIMES = { 2: 'פעמיים', 3: 'שלוש פעמים', 4: 'ארבע פעמים', 5: 'חמש פעמים' };

/**
 * The mistake to name on a check's end screen, or null. `r.named` counts each named misconception of the check
 * ({ 'pct:4|stop-at-one': 2 }, lib/lesson.js); `miscon` is the learner's record after the check (a suspicion, confirmed,
 * in repair). The most frequent one wins, then the first named. A misconception the stair can repair gets its link.
 */
export function repeatedMistake(r, miscon = {}) {
  const counts = Object.entries(r?.named || {});
  if (!counts.length) return null;
  // once in this check, and seen before it too: the record holds it (suspected or more) on two questions or more
  const live = (k) => ['suspected', 'confirmed', 'repairing'].includes(miscon[k]?.state) && (miscon[k]?.seen?.length || 0) >= 2;
  const pick = counts.filter(([k, n]) => n >= 2 || live(k)).sort((a, b) => b[1] - a[1])[0];
  if (!pick) return null;
  const [key, n] = pick;
  const [skill, misc] = key.split('|');
  const { topic, level } = parseSkill(skill);
  const label = catLabel(topic, level, misc);
  if (!label) return null;
  const line = n >= 2 ? `אותה טעות חזרה ${TIMES[n] || `${n} פעמים`}: ${label}.` : `זו טעות שכבר ראינו: ${label}.`;
  const repair = metaOf(skill)?.misconceptions.some((m) => m.id === misc);
  return { skill, misc, times: n, line, to: repair ? `/repair/${topic}/${level}/${misc}` : null };
}

/** The line, and the way to its repair. */
export default function RepeatNote({ mistake, onRepair }) {
  if (!mistake) return null;
  return (
    <section className="check-repeat" aria-label="טעות שחזרה">
      <p className="check-repeat-line"><MathText text={mistake.line} /></p>
      {mistake.to && onRepair && (
        <Button variant="secondary" className="check-repeat-btn" onClick={() => onRepair(mistake.to)}><Wrench size={18} aria-hidden="true" />לתיקון הטעות</Button>
      )}
    </section>
  );
}
