import { useEffect } from 'react';
import { useApp, streakOf } from './store.js';
import { buildPlan, baseEntry } from './exam.js';

/**
 * The improvement plan for the current student. A practice step starts counting
 * wins the first time it appears, so the baseline is saved as soon as it shows.
 */
export function usePlan() {
  const { exams, mistakes, progress, days, planBase, wins, resetPlanBase } = useApp();
  const plan = buildPlan({ exams, mistakes, progress, streak: streakOf(days), base: planBase, wins });
  const sig = plan.steps.filter((s) => s.kind === 'practice').map((s) => `${s.topic}:${s.level}`).join(',');
  useEffect(() => {
    const patch = {};
    plan.steps.forEach((s) => {
      if (s.kind !== 'practice') return;
      const b = planBase[s.topic];
      if (!b || typeof b !== 'object' || b.level !== s.level) patch[s.topic] = baseEntry(s.topic, s.level, wins);
    });
    if (Object.keys(patch).length) resetPlanBase(patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);
  return plan;
}
