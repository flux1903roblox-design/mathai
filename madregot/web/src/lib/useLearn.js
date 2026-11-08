// The learning model as the screens need it: the context for recommendations, the actions, today's mission.
import { useMemo } from 'react';
import { useApp, today } from './store.js';
import { nextActions } from '@/learn/recommend.ts';
import { missionFor } from '@/learn/mission.ts';

export function useLearnCtx() {
  const learn = useApp((s) => s.learn);
  const grade = useApp((s) => s.profile?.grade) || '7';
  const path = useApp((s) => s.path);
  const progress = useApp((s) => s.progress);
  return useMemo(() => ({ learn, grade, path, progress, now: new Date().toISOString(), day: today() }), [learn, grade, path, progress]);
}

export function useActions() {
  const ctx = useLearnCtx();
  return useMemo(() => nextActions(ctx), [ctx]);
}

/** Today's mission: the saved one, or a new one built now (saved by the screen that shows it). */
export function useMission() {
  const ctx = useLearnCtx();
  const actions = useActions();
  return useMemo(() => missionFor(ctx.learn, ctx.day, actions), [ctx, actions]);
}
