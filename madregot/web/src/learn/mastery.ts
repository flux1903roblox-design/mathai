// Mastery: what the evidence says a student can do on a stair, and when to check again.
//
// The rules, also shown to the student (MASTERY_RULES):
//  - Watching an explanation or a solved example is learning, never mastery.
//  - Answers with a hint, on a second try or inside "solve together" count as learning with help.
//  - Mastery is a short check without hints: MASTERY_N questions, one try each, at least MASTERY_NEED right.
//  - Mastery is checked again later (spaced reviews: REVIEW_DAYS); a missed review marks it "needs review".
//  - After a failed check the stair goes back to practice: the check returns after RETRY_PRACTICE right answers given
//    alone (first try, no hint) since then, not at once (a ~60% student would pass a quick retake about half the time).
import type { Attempt, MasteryState, Purpose, SkillRecord } from './types';

import { localized, t } from '@/lib/i18n.js';
export const MASTERY_N = 5;
export const MASTERY_NEED = 4;
export const REVIEW_N = 3;
export const REVIEW_NEED = 3;
/** Days until the next review, by box: the box grows by one with every passed review. */
export const REVIEW_DAYS = [1, 3, 7, 16, 35, 60];
/** Right practice answers that finish the practice stage, the first time (lib/path.js and assignments.ts count the same). */
export const PRACTICE_NEED = 6;
/** Right practice answers given alone (first try, no hint) since a failed mastery check before it is offered again. */
export const RETRY_PRACTICE = 3;
/** What the result screen and the plan say after a failed mastery check (CheckDone.jsx, next.ts): one sentence, one place. */
export let PRACTICE_AGAIN = localized(() => t('shell.mastery.practiceAgain'), (v) => { PRACTICE_AGAIN = v; });
/** "Needs support": at least this many independent answers lately, and fewer than half right. */
export const SUPPORT_WINDOW = 6;
export const SUPPORT_MIN = 4;
export const KEEP_ATTEMPTS = 40;

export let MASTERY_RULES = localized(() => ([
  t('shell.mastery.1'),
  t('shell.mastery.2'),
  t('shell.mastery.3', { MASTERY_N, MASTERY_NEED }),
  t('shell.mastery.retry', { RETRY_PRACTICE }),
  t('shell.mastery.4'),
]), (v) => { MASTERY_RULES = v; });

export let STATE_LABEL: Record<MasteryState, string> = localized(() => ({
  'not-started': t('shell.mastery.5'),
  learning: t('shell.mastery.6'),
  'needs-support': t('shell.mastery.7'),
  practicing: t('shell.mastery.8'),
  mastered: t('shell.mastery.9'),
  'needs-review': t('shell.mastery.10'),
}), (v) => { STATE_LABEL = v; });

const DAY = 86_400_000;
export const addDays = (iso: string, days: number) => new Date(new Date(iso).getTime() + days * DAY).toISOString();
export const daysBetween = (a: string, b: string) => (new Date(b).getTime() - new Date(a).getTime()) / DAY;

export const emptyRecord = (): SkillRecord => ({ attempts: [] });

/** Add one answer to a skill's record (the newest KEEP_ATTEMPTS are kept). */
export function addAttempt(rec: SkillRecord | undefined, a: Attempt): SkillRecord {
  const r = rec || emptyRecord();
  return { ...r, attempts: [...r.attempts, a].slice(-KEEP_ATTEMPTS) };
}

/**
 * A finished mastery check: passed opens the review schedule; failed is counted and dated (lastFailAt: the check waits
 * for fresh practice), nothing is taken away.
 */
export function recordMasteryCheck(rec: SkillRecord | undefined, right: number, asked: number, at: string): SkillRecord {
  const r = rec || emptyRecord();
  const passed = asked >= MASTERY_N && right >= MASTERY_NEED;
  if (!passed) return { ...r, failedChecks: (r.failedChecks || 0) + 1, lastFailAt: at };
  const { lastFailAt: _done, ...rest } = r;
  return { ...rest, failedChecks: 0, mastered: { at, box: 0, due: addDays(at, REVIEW_DAYS[0]) } };
}

/** Right practice answers given alone (first try, no hint) since the last failed mastery check (0 with none). */
export function practiceSinceFail(rec: SkillRecord | undefined): number {
  if (!rec?.lastFailAt) return 0;
  const t = Date.parse(rec.lastFailAt);
  return rec.attempts.filter((a) => a.purpose === 'practice' && a.ok && a.independent && Date.parse(a.at) > t).length;
}

/** A failed mastery check waits: not yet RETRY_PRACTICE right answers given alone since it (never for a mastered stair). */
export const checkWaits = (rec: SkillRecord | undefined): boolean => !!rec?.lastFailAt && !rec.mastered && practiceSinceFail(rec) < RETRY_PRACTICE;

/**
 * Is the practice stage done, so the mastery check comes next? Before any failed check: `need` right practice answers
 * in all (PRACTICE_NEED; a stair with no teaching content asks one). After one: RETRY_PRACTICE given alone since it.
 */
export function practiceDone(rec: SkillRecord | undefined, need = PRACTICE_NEED): boolean {
  if (rec?.lastFailAt) return practiceSinceFail(rec) >= RETRY_PRACTICE;
  return (rec?.attempts || []).filter((a) => a.purpose === 'practice' && a.ok).length >= need;
}

/** A finished review: passed moves to a longer interval; missed brings the next review to tomorrow. */
export function recordReview(rec: SkillRecord | undefined, right: number, asked: number, at: string): SkillRecord {
  const r = rec || emptyRecord();
  if (!r.mastered) return r; // a review of a skill that was never mastered is practice
  const ok = right >= Math.min(REVIEW_NEED, asked);
  const box = ok ? Math.min(r.mastered.box + 1, REVIEW_DAYS.length - 1) : 0;
  return { ...r, mastered: { ...r.mastered, box, due: addDays(at, REVIEW_DAYS[box]), lastReview: { at, ok } } };
}

export const markTaught = (rec: SkillRecord | undefined, stage: 'A' | 'B' | 'C', at: string): SkillRecord => {
  const r = rec || emptyRecord();
  return { ...r, taught: { ...(r.taught || {}), [stage]: r.taught?.[stage] || at } };
};

const PRACTICE: Purpose[] = ['practice', 'mastery', 'review', 'verify', 'diagnostic'];

/** The state of a skill now. */
export function masteryState(rec: SkillRecord | undefined, now: string): MasteryState {
  if (!rec) return 'not-started';
  const tried = rec.attempts.filter((a) => PRACTICE.includes(a.purpose));
  if (rec.mastered) {
    if (rec.mastered.lastReview && !rec.mastered.lastReview.ok) return 'needs-review';
    return new Date(now) >= new Date(rec.mastered.due) ? 'needs-review' : 'mastered';
  }
  const recent = tried.filter((a) => a.independent).slice(-SUPPORT_WINDOW);
  if (recent.length >= SUPPORT_MIN && recent.filter((a) => a.ok).length * 2 < recent.length) return 'needs-support';
  if (tried.some((a) => a.ok)) return 'practicing';
  if (rec.taught?.A || rec.attempts.length) return 'learning';
  return 'not-started';
}

/** Independent accuracy on the last answers (null when there are none). */
export function independentAccuracy(rec: SkillRecord | undefined, last = 10): number | null {
  const a = (rec?.attempts || []).filter((x) => x.independent && x.purpose !== 'guided').slice(-last);
  return a.length ? a.filter((x) => x.ok).length / a.length : null;
}

/**
 * The stage to continue from on a stair: A, B, C (teaching), D (practice) or E (the mastery check). A stair passed in
 * placement or a jump test (`placed`, lib/path.js isPlaced) goes to its mastery check, whatever was taught: the student
 * has already shown it (PRODUCT2-19). After a failed check it practises first, as any stair does (checkWaits).
 */
export function nextStage(rec: SkillRecord | undefined, placed = false): 'A' | 'B' | 'C' | 'D' | 'E' {
  if (placed && !rec?.mastered) return checkWaits(rec) ? 'D' : 'E';
  if (!rec?.taught?.A) return 'A';
  if (!rec.taught.B) return 'B';
  if (!rec.taught.C) return 'C';
  return practiceDone(rec) ? 'E' : 'D';
}

/** The skills whose review is due now, most overdue first. */
export function dueReviews(skills: Record<string, SkillRecord>, now: string): string[] {
  return Object.entries(skills)
    .filter(([, r]) => r.mastered && (new Date(now) >= new Date(r.mastered.due) || (r.mastered.lastReview && !r.mastered.lastReview.ok)))
    .sort(([, a], [, b]) => a.mastered!.due.localeCompare(b.mastered!.due))
    .map(([id]) => id);
}
