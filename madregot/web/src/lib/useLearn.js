// The learning model as the screens need it: the context, and the one ranked plan of what is worth doing next
// (learn/next.ts planNext). Every surface that suggests a next step reads it, so they all name the same step. In a
// class, the plan also gets the teacher's work with this device's reports (band 1), read here so planNext stays pure.
import { useMemo } from 'react';
import { useApp, today } from './store.js';
import { planNext } from '@/learn/next.ts';
import { schoolMonth } from '@/learn/programme.ts';
import { classAssignments } from './classRows.js';

export function useLearnCtx() {
  const learn = useApp((s) => s.learn);
  const grade = useApp((s) => s.profile?.grade) || '7';
  const path = useApp((s) => s.path);
  const progress = useApp((s) => s.progress);
  return useMemo(() => ({ learn, grade, path, progress, now: new Date().toISOString(), day: today() }), [learn, grade, path, progress]);
}

/** The plan: its ranked items, the top one, Exam Rescue's steps for today, and whether today is a rest day. */
export function useNext() {
  const ctx = useLearnCtx();
  const exams = useApp((s) => s.exams);
  // the class's work (only with a class token: classWork stays empty otherwise) and the reports still waiting for the server
  const assignments = useApp((s) => (s.profile?.token ? s.classWork?.assignments : null));
  const box = useApp((s) => s.workOutbox);
  const classWork = useMemo(() => classAssignments(assignments, box), [assignments, box]);
  return useMemo(() => planNext({ ...ctx, exams: exams || [], month: schoolMonth(ctx.day), classWork }), [ctx, exams, classWork]);
}
