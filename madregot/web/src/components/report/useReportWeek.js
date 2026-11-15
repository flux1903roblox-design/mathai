// The week report of this device (learn/report.ts weekLocal over the saved days and learning), for the weekly summary
// page, its share sheet and the profile's card. On the staging copy, ?qa-report=week|empty shows a fixed week instead.
import { useMemo } from 'react';
import { useApp, today } from '@/lib/store.js';
import { weekLocal } from '@/learn/report.ts';
import { qaReport } from '@/lib/qaFixtures.js';
import { qaReportInput } from './qaWeek.js';
import { challengeFor, withChallenge } from '@/lib/familyChallenge.js';

/** { input: { days, learn }, clock: { today, now } }: what the report is computed from. */
export function useReportInput() {
  const days = useApp((s) => s.days);
  const learn = useApp((s) => s.learn);
  const qa = qaReport();
  return useMemo(() => (qa ? qaReportInput(qa) : { input: { days, learn }, clock: { today: today(), now: new Date().toISOString() } }), [qa, days, learn]);
}

/**
 * The week that starts on `start` (its Sunday), and the clock it was computed with. A family challenge the child accepted
 * for that week (PRODUCT2-39) goes with it, so the summary shows it and its link carries it to the parents.
 */
export function useReportWeek(start) {
  const { input, clock } = useReportInput();
  const family = useApp((s) => s.family);
  const week = useMemo(() => {
    const w = weekLocal(input, start || clock.today, clock);
    return withChallenge(w, challengeFor(family, w.start));
  }, [input, clock, start, family]);
  return { week, clock };
}
