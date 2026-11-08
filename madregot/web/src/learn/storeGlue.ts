// The learning model's side of the store: pure functions from (state, event) to state, so the store stays small
// and every rule here is tested without React. Called by lib/store.js.
import type { Attempt, LearnState, MisconRecord, Purpose } from './types';
import { addAttempt, recordMasteryCheck, recordReview, daysBetween, MASTERY_N, MASTERY_NEED } from './mastery';
import { addEvidence, addCounter, finishVerify, GENERATOR_WEIGHT, COUNTER_WEIGHT, misconKey } from './misconceptions';
import { recordDiagnostic } from './examRescue';
import { logEvent } from './analytics';
import { skillId } from './skills';

export const emptyLearn = (): LearnState => ({ skills: {}, miscon: {}, exam: null, missions: {}, events: [] });

/** One graded answer, as the lesson engine reports it (lib/lesson.js). */
export interface AnswerEvent {
  topic: string; level: number; ok: boolean; first?: boolean; hint?: boolean; at?: string;
  cat?: string | null; purpose?: Purpose; key?: string;
  /** Candidates from a diagnostic model: every misconception that predicts this answer, with its share. */
  cands?: { id: string; conf: number }[];
  /** Misconceptions that could have shown on this question (from a diagnostic model). */
  could?: string[];
  /** A first miss: the student gets another try. */
  retry?: boolean;
}

export function learnAfterAnswer(learn: LearnState, e: AnswerEvent): LearnState {
  if (!e?.topic || !e.level) return learn;
  const at = e.at || new Date().toISOString();
  const skill = skillId(e.topic, e.level);
  const purpose: Purpose = e.purpose || 'practice';
  // a check is one try without hints; in practice only a first try without a hint is independent
  const independent = purpose !== 'practice' && purpose !== 'guided' ? true : e.retry ? !e.hint : !!e.first && !e.hint;
  const attempt: Attempt = { at, ok: !!e.ok, independent, purpose };
  const skills = { ...learn.skills, [skill]: addAttempt(learn.skills[skill], attempt) };
  let miscon = learn.miscon;
  const key = e.key || `${skill}@${at}`;
  if (!e.ok) {
    const cands = e.cands?.length ? e.cands : e.cat ? [{ id: e.cat, conf: GENERATOR_WEIGHT }] : [];
    cands.forEach((c) => { miscon = addEvidence(miscon, skill, c.id, c.conf, key, at); });
  } else if (independent && e.could) {
    // a right answer counts against a misconception only where it could have shown (a diagnostic model knows where);
    // a right answer to 3 + 5 says nothing about subtracting a negative
    Object.values(miscon).filter((r) => r.skill === skill && e.could!.includes(r.id)).forEach((r) => { miscon = addCounter(miscon, skill, r.id, COUNTER_WEIGHT); });
  }
  const events = logEvent(learn.events, { e: 'answer', s: skill, ok: !!e.ok, ind: independent, p: purpose }, at);
  return { ...learn, skills, miscon, events };
}

/** A finished check (lib/lesson.js resultOf for kind 'check'). */
export interface CheckResult {
  purpose: 'mastery' | 'review' | 'verify' | 'diagnostic' | 'exam';
  skill?: string; misc?: string;
  right: number; asked: number;
  perSkill: Record<string, { right: number; asked: number }>;
  /** verify: how many answers showed the misconception again. */
  showed?: number;
}

export function learnAfterCheck(learn: LearnState, r: CheckResult, at: string, _day: string): LearnState {
  let { skills, miscon, exam, events } = learn;
  const share = (x: { right: number; asked: number }) => (x.asked ? x.right / x.asked : 0);
  if (r.purpose === 'mastery' && r.skill) {
    skills = { ...skills, [r.skill]: recordMasteryCheck(skills[r.skill], r.right, r.asked, at) };
    events = logEvent(events, { e: 'check-done', s: r.skill, p: 'mastery', ok: r.asked >= MASTERY_N && r.right >= MASTERY_NEED, n: share(r) }, at);
  } else if (r.purpose === 'review' && r.skill) {
    const before = skills[r.skill];
    skills = { ...skills, [r.skill]: recordReview(before, r.right, r.asked, at) };
    const d = before?.mastered ? Math.round(daysBetween(before.mastered.at, at)) : undefined;
    events = logEvent(events, { e: 'check-done', s: r.skill, p: 'review', ok: r.right >= Math.min(3, r.asked), n: share(r), d }, at);
  } else if (r.purpose === 'verify' && r.skill && r.misc) {
    miscon = finishVerify(miscon, r.skill, r.misc, r.right, r.showed || 0, at);
    const k = misconKey(r.skill, r.misc); const res: MisconRecord | undefined = miscon[k];
    events = logEvent(events, { e: 'repair-done', s: r.skill, m: r.misc, ok: res?.state === 'resolved' }, at);
  } else if (r.purpose === 'diagnostic') {
    Object.entries(r.perSkill).forEach(([s, x]) => {
      if (exam) exam = recordDiagnostic(exam, s, x.right, x.asked, at);
      events = logEvent(events, { e: 'check-done', s, p: 'diagnostic', n: share(x) }, at);
    });
  } else if (r.purpose === 'exam') {
    events = logEvent(events, { e: 'rescue-exam-done', n: share(r) }, at);
  }
  return { ...learn, skills, miscon, exam, events };
}

/** v1 → v2: the misconceptions the app already recorded (gaps 'topic:cat' → level, n, ok) become evidence. */
export function migrateLearn(gaps: Record<string, { level?: number; n?: number; ok?: number; at?: string; exam?: boolean }>): LearnState {
  const learn = emptyLearn();
  Object.entries(gaps || {}).forEach(([k, g]) => {
    const [topic, cat, extra] = k.split(':');
    if (!topic || !cat || extra !== undefined || g?.exam || !g?.level) return; // exam gaps stay on the board only
    if ((g.ok || 0) >= 3) return; // already cleared
    const skill = skillId(topic, g.level);
    const at = g.at || new Date(0).toISOString();
    const n = Math.min(g.n || 1, 2);
    for (let i = 1; i <= n; i += 1) learn.miscon = addEvidence(learn.miscon, skill, cat, i === 1 && n === 1 ? GENERATOR_WEIGHT : 0.75, `legacy:${i}`, at);
  });
  return learn;
}
