// The words of the tutor's limits, in one place so a test can read every one of them. They speak to a child calmly:
// no price, no plan, no buy button, no countdown, no lock. Madi and practice are always the way on.
// In a store app (store: !canSell(), STUDENT-12) no variant has a way to the parents' pages, and the day's limit says
// only when the questions come back: nothing that points to a plan or to buying anything.

import { localized, t as tr } from '@/lib/i18n.js';
/** The free questions are over for today, in a store app. */
export let STORE_DAILY_TEXT = localized(() => tr('shell.limitcopy.1'), (v) => { STORE_DAILY_TEXT = v; });

/**
 * What the sheet says when the tutor says "not now". actions: 'madi' | 'practice' | 'licence' | 'parents' | 'bind';
 * parents: a small link. In a store app (store: true) the day's limit says only when the questions come back, and no
 * variant has the small link to the parents' pages.
 */
export function limitVariant({ reason, tier = null, scope = null, role = 'student', store = false } = {}) {
  const v = variant({ reason, tier, scope, role });
  if (!store) return v;
  if (reason === 'daily_limit' && role !== 'teacher') return { title: tr('shell.limitcopy.2'), text: [STORE_DAILY_TEXT], actions: ['madi', 'practice'], parents: false };
  return { ...v, parents: false };
}

function variant({ reason, tier, scope, role }) {
  const free = tier === 'free';
  const teacher = role === 'teacher';
  // the class's tutor is off under the Ministry's rules (trust spec TRUST-11 §6): a school context, so no price, no
  // parents' link and no Madi button that would read as a way round it; practice is the way on
  if (reason === 'class_ai_off') {
    return {
      title: tr('shell.limitcopy.3'),
      text: [tr('shell.limitcopy.4')],
      actions: ['practice'], parents: false,
    };
  }
  // a teacher of a class with no adult behind it (TRUST-9, the trust review): the way on is signing in with an email,
  // which binds the class to it; the board and the lessons stay open
  if (reason === 'parent_ok_needed' && teacher) {
    return {
      title: tr('shell.limitcopy.5'),
      text: [tr('shell.limitcopy.6')],
      actions: ['bind'], parents: false,
    };
  }
  // a child alone, on a device no parent has approved (trust spec TRUST-9 §4): the way on is the screen for the parents
  // (no price there either); practice stays open
  if (reason === 'parent_ok_needed') {
    return {
      title: tr('shell.limitcopy.7'),
      text: [tr('shell.limitcopy.8')],
      actions: ['parents', 'practice'], parents: false,
    };
  }
  if (reason === 'daily_limit' && free && teacher) {
    return {
      title: tr('shell.limitcopy.9'),
      text: [tr('shell.limitcopy.10')],
      actions: ['licence'], parents: false,
    };
  }
  if (reason === 'daily_limit' && free) {
    return {
      title: tr('shell.limitcopy.2'),
      text: [tr('shell.limitcopy.11')],
      actions: ['madi', 'practice'], parents: true,
    };
  }
  if (reason === 'daily_limit') {
    return { title: tr('shell.limitcopy.12'), text: [tr('shell.limitcopy.13')], actions: ['practice'], parents: false };
  }
  if (reason === 'shared_limit') {
    return {
      title: tr('shell.limitcopy.14'),
      text: [scope === 'class'
        ? tr('shell.limitcopy.15')
        : tr('shell.limitcopy.16')],
      actions: ['madi', 'practice'], parents: false,
    };
  }
  if (reason === 'free_paused') {
    return { title: tr('shell.limitcopy.17'), text: [tr('shell.limitcopy.18')], actions: ['madi', 'practice'], parents: false };
  }
  if (reason === 'monthly_fair_use') {
    return {
      title: tr('shell.limitcopy.19'),
      text: [tr('shell.limitcopy.20')],
      actions: ['practice'], parents: false,
    };
  }
  // paid_only (the screen thought the tool was open): what the full tutor does, and what is open now
  return {
    title: tr('shell.limitcopy.21'),
    text: [tr('shell.limitcopy.22')],
    actions: teacher ? ['licence'] : ['madi', 'practice'], parents: !teacher,
  };
}

/** The quiet line about today's questions (AIAllowance), or null for nothing to say. */
export function allowanceText({ state, left, tier, ended = false, role = 'student' }) {
  if (state === 'class_off') return CLASS_OFF_LINE;
  if (state === 'parent_ok_needed') return waitingLine(role);
  if (ended && tier === 'free') return tr('shell.limitcopy.23');
  if (tier === 'free') {
    if (state === 'used' || left === 0) return tr('shell.limitcopy.24');
    if (state !== 'free' || !Number.isFinite(left)) return null;
    if (left === 1) return tr('shell.limitcopy.25');
    return tr('shell.limitcopy.26', { left });
  }
  if (state === 'used') return tr('shell.limitcopy.27');
  if (state !== 'open' || !Number.isFinite(left) || left > 5) return null;
  if (left === 1) return tr('shell.limitcopy.28');
  return tr('shell.limitcopy.29', { left });
}

/** The one line wherever the tutor would be, in a class whose tutor is off (TRUST-11 §6). */
export let CLASS_OFF_LINE = localized(() => tr('shell.limitcopy.30'), (v) => { CLASS_OFF_LINE = v; });
/** The one line wherever the tutor would be, on a device that waits for a parent's OK (TRUST-9 §4). */
export let PARENT_OK_LINE = localized(() => tr('shell.limitcopy.31'), (v) => { PARENT_OK_LINE = v; });
/** The same place for a teacher whose class is not bound to an email yet (TRUST-9, the trust review). */
export let TEACHER_EMAIL_LINE = localized(() => tr('shell.limitcopy.32'), (v) => { TEACHER_EMAIL_LINE = v; });
/** A school class's teacher before the catalogue approval (teacherAi 'prep'): what the tutor does there, and what it does not. */
export let PREP_ONLY_LINE = localized(() => tr('shell.limitcopy.33'), (v) => { PREP_ONLY_LINE = v; });
/** The line for a device that waits: a parent's OK for a child, an email for a teacher. */
export const waitingLine = (role) => (role === 'teacher' ? TEACHER_EMAIL_LINE : PARENT_OK_LINE);

/**
 * What a tool says instead of opening the camera (ToolLocked). In a store app (store: true) there is no parents' link.
 */
export function lockedText(kind, { state = 'locked', inClass = false, role = 'student', store = false } = {}) {
  const t = lockedLines(kind, { state, inClass, role });
  return store ? { ...t, parents: false } : t;
}

function lockedLines(kind, { state, inClass, role }) {
  if (state === 'class_off') return { lines: [CLASS_OFF_LINE, tr('shell.limitcopy.34')], teacher: false, parents: false };
  if (state === 'parent_ok_needed' && role === 'teacher') return { lines: [TEACHER_EMAIL_LINE, tr('shell.limitcopy.35')], teacher: false, parents: false, bind: true };
  if (state === 'parent_ok_needed') return { lines: [PARENT_OK_LINE, tr('shell.limitcopy.34')], teacher: false, parents: true };
  if (state === 'economy') return { lines: [tr('shell.limitcopy.36')], teacher: false, parents: false };
  // a teacher of a school class before the Ministry's approval: the tutor prepares materials only (no price, no way round)
  if (state === 'prep_only') return { lines: [PREP_ONLY_LINE], teacher: false, parents: false };
  if (kind === 'check') {
    return inClass
      ? { lines: [tr('shell.limitcopy.37'), tr('shell.limitcopy.38')], teacher: true, parents: false }
      : { lines: [tr('shell.limitcopy.37'), tr('shell.limitcopy.39')], teacher: false, parents: true };
  }
  if (kind === 'generate') return { lines: [tr('shell.limitcopy.40')], teacher: false, parents: !inClass };
  return { lines: [tr('shell.limitcopy.41')], teacher: false, parents: !inClass };
}
