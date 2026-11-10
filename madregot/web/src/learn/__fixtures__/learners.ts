// Named synthetic learners for the "what next" tests (learn/next.test.ts): each is a whole planNext context, built the
// way the app builds its state (a passed mastery check also marks the stair done on the map). No real student data.
import type { LearnState, SkillId, SkillRecord, MisconRecord } from '../types';
import type { NextContext, CheckedExam } from '../next';
import { gradeSkillsOf, parseSkill } from '../skills';
import { schoolMonth } from '../programme';
import { newPlan, recordDiagnostic } from '../examRescue';
import { addDays } from '../mastery';

/** A Tuesday in November, the default day. */
export const DAY = '2026-11-10';
export const NOW = `${DAY}T09:00:00.000Z`;
export const ago = (days: number, now = NOW) => addDays(now, -days);

export const emptyLearn = (): LearnState => ({ skills: {}, miscon: {}, exam: null, missions: {}, events: [], floor: null, challenges: {} });

const practiceRun = (at: string, n: number, ok = true) => Array.from({ length: n }, () => ({ at, ok, independent: true, purpose: 'practice' as const }));
/** A stair learned through all five stages, its mastery check passed at `at`; its first review is due `dueIn` days later. */
export const masteredRec = (at: string, dueIn = 1, box = 0): SkillRecord => ({
  taught: { A: at, B: at, C: at },
  attempts: [...practiceRun(at, 6), ...Array.from({ length: 5 }, () => ({ at, ok: true, independent: true, purpose: 'mastery' as const }))],
  mastered: { at, box, due: addDays(at, dueIn) },
});
/** A stair with its first teaching stages done (A, then B…). */
export const taughtRec = (at: string, stages: ('A' | 'B' | 'C')[]): SkillRecord => ({ taught: Object.fromEntries(stages.map((s) => [s, at])), attempts: [] });
/** A stair that is going badly: four independent wrong answers in practice. */
export const strugglingRec = (at: string): SkillRecord => ({ taught: { A: at, B: at, C: at }, attempts: practiceRun(at, 4, false) });

/** The map, as a passed mastery check leaves it: each mastered stair done on its unit's path. */
export function pathOf(skills: Record<SkillId, SkillRecord>, extra: Record<string, any> = {}) {
  const path: Record<string, any> = {};
  Object.entries(skills).forEach(([id, r]) => {
    if (!r.mastered) return;
    const { topic, level } = parseSkill(id);
    path[topic] ||= { parts: {}, reviews: 0, jumped: 0, done: {} };
    path[topic].done[level] = 'mastered';
    path[topic].parts[level] = 2;
  });
  Object.entries(extra).forEach(([t, u]) => { path[t] = { parts: {}, reviews: 0, jumped: 0, ...(path[t] || {}), ...u, done: { ...(path[t]?.done || {}), ...(u.done || {}) } }; });
  return path;
}

export function ctxOf(learn: LearnState, opts: { grade?: '7' | '8'; day?: string; now?: string; path?: Record<string, any>; exams?: CheckedExam[] } = {}): NextContext {
  const day = opts.day || DAY;
  const now = opts.now || `${day}T09:00:00.000Z`;
  return { learn, grade: opts.grade || '7', path: opts.path ?? pathOf(learn.skills), progress: {}, now, day, exams: opts.exams || [], month: schoolMonth(day) };
}

const confirmed = (skill: SkillId, id: string, at: string): Record<string, MisconRecord> => ({ [`${skill}|${id}`]: { skill, id, score: 2, seen: ['a', 'b'], state: 'confirmed', at } });

/** A checked exam (as ExamCheck saves it), `days` ago, with one question per [topic, level, status]. */
export const checkedExam = (days: number, qs: [string, number | null, string][], now = NOW): CheckedExam => ({
  id: `ex${days}`, at: ago(days, now), title: 'מבחן', result: { questions: qs.map(([topic, level, status]) => ({ topic, level, status, skill: '' })) },
});

/** An Exam Rescue plan on `date`, made today, diagnosed with [skill, right of 2] (or not at all). */
function rescue(date: string, diag: [SkillId, number][] | null, skills: SkillId[], day = DAY) {
  let plan = newPlan({ grade: '7', date, skills, confidence: 2, minutes: 15 }, `${day}T08:00:00.000Z`);
  (diag || []).forEach(([s, right]) => { plan = recordDiagnostic(plan, s, right, 2, `${day}T08:00:00.000Z`); });
  return plan;
}

export const LEARNERS: Record<string, () => NextContext> = {
  /** A new ז׳ student, nothing done yet, in November. */
  newSeventh: () => ctxOf(emptyLearn()),
  /** The same student at the start of the school year. */
  newSeventhSeptember: () => ctxOf(emptyLearn(), { day: '2026-09-08' }),
  /** A ז׳ student in the middle of signed:3: its first two stages done, the stairs before it mastered. */
  midSigned3: () => {
    const L = emptyLearn();
    L.skills['signed:1'] = masteredRec(ago(10), 30, 3); L.skills['signed:2'] = masteredRec(ago(8), 30, 3);
    L.skills['signed:3'] = taughtRec(ago(1), ['A', 'B']);
    return ctxOf(L);
  },
  /** A confirmed misconception on signed:1 (subtracting a negative), while learning it. */
  misconception: () => {
    const L = emptyLearn();
    L.skills['signed:1'] = { taught: { A: ago(2), B: ago(2), C: ago(2) }, attempts: practiceRun(ago(1), 3) };
    L.miscon = confirmed('signed:1', 'minus-minus', ago(1));
    return ctxOf(L);
  },
  /** coord:1 was mastered four days ago: its first review is due. */
  dueReview: () => {
    const L = emptyLearn();
    L.skills['signed:1'] = masteredRec(ago(20), 60, 4); L.skills['signed:2'] = masteredRec(ago(20), 60, 4);
    L.skills['coord:1'] = masteredRec(ago(4), 1);
    return ctxOf(L);
  },
  /** An exam on Friday (three days away), diagnosed: signed:1 a gap, signed:2 right twice; and coord:1's review is due. */
  examIn3Days: () => {
    const L = emptyLearn();
    L.skills['coord:1'] = masteredRec(ago(4), 1);
    L.exam = rescue('2026-11-13', [['signed:1', 0], ['signed:2', 2]], ['signed:1', 'signed:2']);
    return ctxOf(L);
  },
  /** The same exam before its diagnostic. */
  examUndiagnosed: () => {
    const L = emptyLearn();
    L.exam = rescue('2026-11-13', null, ['signed:1', 'signed:2']);
    return ctxOf(L);
  },
  /** An exam on Sunday, seen on Shabbat. */
  examOnShabbat: () => {
    const L = emptyLearn();
    L.exam = rescue('2026-11-15', [['signed:1', 0], ['signed:2', 1]], ['signed:1', 'signed:2'], '2026-11-12');
    return ctxOf(L, { day: '2026-11-14' });
  },
  /** A ח׳ student in November who has started line:1 (its first stage done). */
  eighthNovemberLine: () => {
    const L = emptyLearn();
    L.skills['line:1'] = taughtRec(ago(1), ['A']);
    return ctxOf(L, { grade: '8' });
  },
  /** A weak student whose floor check missed adding and the first fractions stair: the floor is on. */
  weakFloor: () => {
    const L = emptyLearn();
    L.floor = { at: ago(1), on: true, results: { 'frac:1': { asked: 1, right: 0 }, 'frac:2': { asked: 1, right: 1 }, 'frac:3': { asked: 1, right: 0 }, 'frac:4': { asked: 1, right: 1 } }, facts: { asked: 2, right: 2 } };
    return ctxOf(L);
  },
  /** signed:6 (signed fractions) is going badly, nothing below it is known to be missing, and there is no floor check yet. */
  hardFractionsNoFloor: () => {
    const L = emptyLearn();
    ['signed:1', 'signed:2', 'signed:3', 'signed:4', 'signed:5'].forEach((id) => { L.skills[id] = masteredRec(ago(12), 40, 4); });
    L.skills['signed:6'] = strugglingRec(ago(1));
    return ctxOf(L);
  },
  /** Every ז׳ stair mastered, no review due. */
  allSeventhMastered: () => {
    const L = emptyLearn();
    gradeSkillsOf('7').forEach((id) => { L.skills[id] = masteredRec(ago(6), 20, 3); });
    return ctxOf(L);
  },
  /** Two stairs kept from before mastery checks existed (done on the old map, never checked). */
  keptStairs: () => ctxOf(emptyLearn(), { path: { signed: { parts: { 1: 2, 2: 2 }, reviews: 0, jumped: 0, done: { 1: 'kept', 2: 'kept' } } } }),
  /** A photo-checked exam five days ago lost points on coord:4 (a stair mastered before it). */
  examLossCoord4: () => {
    const L = emptyLearn();
    ['signed:1', 'signed:2', 'coord:1', 'coord:2', 'coord:3', 'coord:4'].forEach((id) => { L.skills[id] = masteredRec(ago(20), 30, 3); });
    return ctxOf(L, { exams: [checkedExam(5, [['coord', 4, 'wrong'], ['coord', 4, 'partial'], ['signed', 1, 'correct']])] });
  },
  /** The same, after a review of coord:4 passed two days ago. */
  examLossRecovered: () => {
    const L = emptyLearn();
    ['signed:1', 'signed:2', 'coord:1', 'coord:2', 'coord:3', 'coord:4'].forEach((id) => { L.skills[id] = masteredRec(ago(20), 30, 3); });
    L.skills['coord:4'] = { ...L.skills['coord:4'], mastered: { ...L.skills['coord:4'].mastered!, box: 4, due: addDays(ago(2), 35), lastReview: { at: ago(2), ok: true } } };
    return ctxOf(L, { exams: [checkedExam(5, [['coord', 4, 'wrong'], ['coord', 4, 'partial'], ['signed', 1, 'correct']])] });
  },
};
