// The week report of this device (learn/report.ts weekLocal over the saved days and learning), for the weekly summary
// page, its share sheet and the profile's card. On the staging copy, ?qa-report=week|empty shows a fixed week instead.
import { useMemo } from 'react';
import { useApp, today } from '@/lib/store.js';
import { weekLocal } from '@/learn/report.ts';
import { qaReport } from '@/lib/qaFixtures.js';
import { qaReportInput } from './qaWeek.js';

/** { input: { days, learn }, clock: { today, now } }: what the report is computed from. */
export function useReportInput() {
  const days = useApp((s) => s.days);
  const learn = useApp((s) => s.learn);
  const qa = qaReport();
  return useMemo(() => (qa ? qaReportInput(qa) : { input: { days, learn }, clock: { today: today(), now: new Date().toISOString() } }), [qa, days, learn]);
}

/** The week that starts on `start` (its Sunday), and the clock it was computed with. */
export function useReportWeek(start) {
  const { input, clock } = useReportInput();
  const week = useMemo(() => weekLocal(input, start || clock.today, clock), [input, clock, start]);
  return { week, clock };
}
