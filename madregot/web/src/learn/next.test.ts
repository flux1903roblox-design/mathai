// One "what next" (CURRICULUM-7): the bands of planNext for named synthetic learners, the rules every plan keeps, the
// mission's completion of the new kinds, and that planNext is pure.
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { LearnState, SkillId, SkillRecord } from './types';
import { planNext, examLosses, mapTopics, mapFocus, onMap, nodeRoute, cardRoute, missionNext } from './next';
import type { NextContext, CheckedExam } from './next';
import { nextActions } from './recommend';
import { buildMission, completeMissionItems, missionDone, missionFor } from './mission';
import { examPlan, newPlan, recordDiagnostic, isShabbatDay } from './examRescue';
import { ALL_SKILLS, STAIRS, TOPIC_ORDER, isBridgeSkill, parseSkill, skillId, prereqsOf } from './skills';
import { contentOf } from './content/index';
import { seeded } from './expr';
import { addDays } from './mastery';
import { LEARNERS, ctxOf, emptyLearn, checkedExam, ago, masteredRec, taughtRec, strugglingRec, pathOf, NOW } from './__fixtures__/learners';
// @ts-ignore: plain JS
import { isKept } from '@/lib/path.js';
// @ts-ignore: plain JS
import { topicsFor } from '@/content/index.js';

describe('planNext: the bands, highest first, for each learner', () => {
  it.each([
    ['newSeventh', [['new', 'signed:1']]],
    ['newSeventhSeptember', [['new', 'angles:1']]],
    ['midSigned3', [['continue', 'signed:3'], ['new', 'signed:4']]],
    ['misconception', [['repair', 'signed:1'], ['continue', 'signed:1'], ['new', 'signed:2']]],
    ['dueReview', [['review', 'coord:1'], ['new', 'signed:3']]],
    ['examIn3Days', [['exam', 'signed:1'], ['exam', 'signed:1'], ['exam', 'signed:1'], ['review', 'coord:1'], ['new', 'coord:2']]],
    ['examUndiagnosed', [['exam', ''], ['new', 'signed:1']]],
    ['examOnShabbat', [['new', 'signed:1']]],
    // ratio and scale is the first unit of ח׳ (September): taught by now, it is the first new stair, before line:2
    ['eighthNovemberLine', [['continue', 'line:1'], ['new', 'ratio:1']]],
    ['weakFloor', [['new', 'frac:1']]],
    ['hardFractionsNoFloor', [['floor', 'signed:6'], ['continue', 'signed:6'], ['new', 'coord:1']]],
    ['allSeventhMastered', [['review', 'signed:1']]],
    ['keptStairs', [['mastery', 'signed:1'], ['new', 'signed:3']]],
    ['examLossCoord4', [['exam-loss', 'coord:4'], ['new', 'signed:3']]],
    ['examLossRecovered', [['new', 'signed:3']]],
  ])('%s', (name, want) => {
    const p = planNext(LEARNERS[name]());
    expect(p.items.map((x) => [x.kind, x.skill])).toEqual(want);
    // ranks go up with the list, and the top is the first item
    expect(p.items.map((x) => x.rank)).toEqual([...p.items.map((x) => x.rank)].sort((a, b) => a - b));
    expect(p.top).toBe(p.items[0] || null);
  });

  it('says why, in one sentence or two, for every item', () => {
    Object.values(LEARNERS).forEach((f) => planNext(f()).items.forEach((x) => { expect(x.reason.length).toBeGreaterThan(10); expect(x.title).toBeTruthy(); expect(x.minutes).toBeGreaterThan(0); }));
  });

  it('the exam band is Exam Rescue\'s today, in its order, with the days to the exam', () => {
    const c = LEARNERS.examIn3Days();
    const p = planNext(c);
    const plan = examPlan(c.learn.exam!, c.learn, c.now, c.day);
    expect(p.examToday.map((x) => x.to)).toEqual(plan.today.map((t) => t.to));
    expect(p.examToday.map((x) => x.task)).toEqual(['learn', 'practice', 'mastery']);
    expect(p.items.filter((x) => x.kind === 'exam').map((x) => x.to)).toEqual(p.examToday.map((x) => x.to));
    expect(p.top!.reason).toBe('המבחן בעוד 3 ימים. זה הצעד של היום בתוכנית ההכנה.');
    // before the diagnostic: one item, the short check Rescue shows then
    expect(planNext(LEARNERS.examUndiagnosed()).top).toMatchObject({ kind: 'exam', task: 'diagnostic', title: 'בדיקה קצרה לפני התוכנית', to: '/rescue/check' });
    // a stair the exam works on today is not offered again below it
    expect(p.items.filter((x) => x.skill === 'signed:1').every((x) => x.kind === 'exam')).toBe(true);
  });

  it('an exam more than two weeks away has no band, while Rescue still has its today', () => {
    const c = LEARNERS.examIn3Days();
    c.learn.exam = { ...c.learn.exam!, date: '2026-12-04' };
    const p = planNext(c);
    expect(p.items.some((x) => x.kind === 'exam')).toBe(false);
    expect(p.examToday.length).toBeGreaterThan(0);
  });

  it('on Shabbat there is no exam step, and restDay says so', () => {
    const p = planNext(LEARNERS.examOnShabbat());
    expect(p.restDay).toBe(true);
    expect(p.examToday).toEqual([]);
    expect(p.items.some((x) => x.kind === 'exam')).toBe(false);
    // and the next day the band is back
    const sun = planNext(ctxOf(LEARNERS.examOnShabbat().learn, { day: '2026-11-13' }));
    expect(sun.restDay).toBe(false);
    expect(sun.top?.kind).toBe('exam');
  });

  it('a new stair follows the school calendar: taught by now first, then the rest, in school order', () => {
    expect(planNext(LEARNERS.newSeventh()).top).toMatchObject({ kind: 'new', skill: 'signed:1', to: '/learn/signed/1/A' });
    expect(planNext(LEARNERS.newSeventh()).top!.reason).toContain('לפי תוכנית הלימודים, זה נלמד בכיתה באוקטובר.');
    // September: signed starts in October, angles is taught now; the unit's own order is kept (no signed:2 before signed:1)
    expect(planNext(LEARNERS.newSeventhSeptember()).top).toMatchObject({ kind: 'new', skill: 'angles:1' });
    expect(planNext(LEARNERS.newSeventhSeptember()).top!.reason).toContain('בספטמבר');
    // a stair the calendar has not reached says nothing about the calendar
    const path = Object.fromEntries((['signed', 'coord', 'angles', 'expr'] as const).map((t) => [t, { parts: {}, reviews: 0, jumped: 6 }]));
    const eq = planNext(ctxOf(emptyLearn(), { path })).top!;
    expect(eq).toMatchObject({ kind: 'new', skill: 'eq:1' });
    expect(eq.reason).not.toContain('לפי תוכנית הלימודים');
  });

  it('offers the floor check for a hard stair that leans on fractions, only while there is no floor evidence', () => {
    const c = LEARNERS.hardFractionsNoFloor();
    expect(planNext(c).top).toMatchObject({ kind: 'floor', title: 'בדיקה קצרה של יסודות', minutes: 3, to: '/floor' });
    expect(planNext(c).top!.reason).toBe('שברים ועשרוניים מכוונים נשען על שברים. שש שאלות יראו אם כדאי לחזק אותם קודם.');
    // after a check that went well, it is not offered again
    const after = { ...c.learn, floor: { at: NOW, on: false, results: { 'frac:3': { asked: 1, right: 1 } }, facts: { asked: 2, right: 2 } } };
    expect(planNext({ ...c, learn: after }).items.some((x) => x.kind === 'floor')).toBe(false);
    // after a missed fractions question, the missing fractions stair itself is the prerequisite
    const missed = { ...c.learn, floor: { at: NOW, on: true, results: { 'frac:3': { asked: 1, right: 0 } }, facts: { asked: 2, right: 2 } } };
    expect(planNext({ ...c, learn: missed }).items.find((x) => x.kind === 'prereq')).toMatchObject({ skill: 'frac:3' });
  });

  it('points lost in a checked exam: mapped to the stair, named with the exam\'s date, gone once recovered', () => {
    const p = planNext(LEARNERS.examLossCoord4());
    const d = new Date(ago(5));
    expect(p.top).toMatchObject({ kind: 'exam-loss', skill: 'coord:4', source: 'exam-check', title: 'מהמבחן: שטח מלבן', minutes: 4, to: '/lesson/coord/4?part=2' });
    expect(p.top!.reason).toBe(`במבחן מ־${d.getDate()}.${d.getMonth() + 1} ירדו כאן נקודות. תרגול קצר ואז בדיקה.`);
    // a passed review of coord:4 after the exam
    expect(planNext(LEARNERS.examLossRecovered()).items.some((x) => x.kind === 'exam-loss')).toBe(false);
    // or three independent right answers after it
    const c = LEARNERS.examLossCoord4();
    c.learn.skills['coord:4'] = { ...c.learn.skills['coord:4'], attempts: [...c.learn.skills['coord:4'].attempts, ...[1, 2, 3].map(() => ({ at: ago(1), ok: true, independent: true, purpose: 'practice' as const }))] };
    expect(planNext(c).items.some((x) => x.kind === 'exam-loss')).toBe(false);
    // two right answers are not enough
    c.learn.skills['coord:4'].attempts.pop();
    expect(planNext(c).items.some((x) => x.kind === 'exam-loss')).toBe(true);
  });

  it('reads a question\'s stair from its level, else from the level the exam lost most at, else drops it', () => {
    const exam = checkedExam(3, [['coord', null, 'wrong'], ['coord', 3, 'wrong'], ['angles', null, 'wrong'], ['nope', 1, 'wrong']]);
    expect(examLosses(ctxOf(emptyLearn(), { exams: [exam] })).map((x) => x.skill)).toEqual(['coord:3']);
    // older than 45 days: nothing; a newer exam that got the stair right settles it
    expect(examLosses(ctxOf(emptyLearn(), { exams: [checkedExam(46, [['coord', 3, 'wrong']])] }))).toEqual([]);
    expect(examLosses(ctxOf(emptyLearn(), { exams: [checkedExam(2, [['coord', 3, 'correct']]), checkedExam(9, [['coord', 3, 'wrong']])] }))).toEqual([]);
    // a stair not yet learned is practised from its next stage
    const fresh = planNext(ctxOf(emptyLearn(), { exams: [exam] })).items.find((x) => x.kind === 'exam-loss')!;
    expect(fresh).toMatchObject({ skill: 'coord:3', stage: 'A', to: '/learn/coord/3/A' });
  });
});

/** Every rule a plan keeps, whatever the learner. */
export function checkRules(c: NextContext, p = planNext(c)) {
  const taught = (id: SkillId) => { const t = c.learn.skills[id]?.taught; return !!(t?.A && t?.B && t?.C); };
  const kept = (id: SkillId) => { const { topic, level } = parseSkill(id); return isKept(c.path || {}, topic, level); };
  const plan = c.learn.exam ? examPlan(c.learn.exam, c.learn, c.now, c.day) : null;
  const ready = (id: SkillId) => plan?.skills.find((s) => s.skill === id)?.standing === 'ready';
  p.items.forEach((x, i) => {
    // no mastery check before the stair's teaching stages, except a kept stair's check, Rescue's confirmation of a
    // ready stair, and a Rescue check that comes after that stair's lesson or practice step today (teaching first)
    if (x.to.includes('purpose=mastery') && !taught(x.skill)) {
      const earlier = p.items.slice(0, i).some((y) => y.kind === 'exam' && y.skill === x.skill && (y.task === 'learn' || y.task === 'practice'));
      expect(kept(x.skill) || (x.kind === 'exam' && (ready(x.skill) || earlier)), `${x.kind} ${x.skill}`).toBe(true);
    }
    // a bridge stair only with evidence or the floor on
    if (x.skill && isBridgeSkill(x.skill)) {
      const evidence = !!c.learn.skills[x.skill] || !!c.learn.floor?.results?.[x.skill] || Object.values(c.learn.miscon).some((m) => m.skill === x.skill) || !!c.learn.exam?.diagnostic?.[x.skill] || x.kind === 'exam-loss' || x.kind === 'exam';
      expect(evidence || !!c.learn.floor?.on, `${x.kind} ${x.skill}`).toBe(true);
    }
  });
  // nothing for the exam on Shabbat
  if (p.restDay) { expect(p.items.some((x) => x.kind === 'exam')).toBe(false); expect(p.examToday).toEqual([]); }
  // no item twice
  const keys = p.items.map((x) => `${x.kind}|${x.skill}|${x.stage || ''}|${x.misc || ''}`);
  expect(new Set(keys).size).toBe(keys.length);
  expect(new Set(p.items.map((x) => x.to)).size).toBe(p.items.length);
}

describe('planNext: the rules every plan keeps', () => {
  it.each(Object.keys(LEARNERS))('%s', (name) => checkRules(LEARNERS[name]()));
});

describe('the mission from the plan', () => {
  const done = (items: ReturnType<typeof buildMission>, d: Parameters<typeof completeMissionItems>[1]) => completeMissionItems(items, d, NOW);
  it('starts with the plan\'s top', () => {
    Object.values(LEARNERS).forEach((f) => { const p = planNext(f()); expect(buildMission(p.items)[0]?.to).toBe(p.top?.to); });
  });
  it('an exam-loss item is done by practice, a review or a mastery check on its stair, not by work elsewhere', () => {
    const items = buildMission(planNext(LEARNERS.examLossCoord4()).items);
    expect(items[0].kind).toBe('exam-loss');
    expect(done(items, { skill: 'coord:3', kind: 'continue', stage: 'D' })[0].done).toBeUndefined();
    expect(done(items, { skill: 'coord:4', kind: 'continue', stage: 'B' })[0].done).toBeUndefined();
    for (const d of [{ kind: 'continue', stage: 'D' }, { kind: 'continue' }, { kind: 'review' }, { kind: 'mastery', stage: 'E' }] as const) {
      expect(done(items, { skill: 'coord:4', ...d })[0].done).toBe(NOW);
    }
    // one that sends to a teaching stage is done by that stage too
    const fresh = buildMission(planNext(ctxOf(emptyLearn(), { exams: [checkedExam(3, [['coord', 3, 'wrong']])] })).items);
    expect(fresh[0]).toMatchObject({ kind: 'exam-loss', stage: 'A' });
    expect(done(fresh, { skill: 'coord:3', kind: 'continue', stage: 'A' })[0].done).toBe(NOW);
  });
  it('a floor item is done by the floor check, and only by it', () => {
    const items = buildMission(planNext(LEARNERS.hardFractionsNoFloor()).items);
    expect(items[0].kind).toBe('floor');
    expect(done(items, { skill: 'signed:6', kind: 'continue', stage: 'D' })[0].done).toBeUndefined();
    expect(done(items, { kind: 'floor' })[0].done).toBe(NOW);
  });
  it('an Exam Rescue step is done by that step: the lesson by learning, the check by the check, the diagnostic by Rescue work', () => {
    const c = LEARNERS.examIn3Days();
    const steps = planNext(c).items.filter((x) => x.kind === 'exam');
    const [learn, practice, mastery] = buildMission(steps.slice(0, 1)).concat(buildMission(steps.slice(1, 2)), buildMission(steps.slice(2, 3)));
    const all = [learn, practice, mastery];
    const after = (d: Parameters<typeof completeMissionItems>[1]) => done(all, d).map((x) => !!x.done);
    expect(after({ skill: 'signed:1', kind: 'continue', stage: 'A' })).toEqual([true, false, false]);
    expect(after({ skill: 'signed:1', kind: 'continue', stage: 'D' })).toEqual([true, true, false]);
    expect(after({ skill: 'signed:1', kind: 'mastery', stage: 'E' })).toEqual([true, true, true]);
    expect(after({ skill: 'signed:1', kind: 'exam' })).toEqual([false, false, false]);
    const diag = buildMission(planNext(LEARNERS.examUndiagnosed()).items);
    expect(diag[0].task).toBe('diagnostic');
    expect(done(diag, { skill: 'signed:2', kind: 'exam' })[0].done).toBe(NOW);
    // a Rescue item saved before steps were named is done by any Rescue work, as before
    expect(done([{ kind: 'exam', skill: 'signed:1', title: 'x', reason: 'x', minutes: 5, to: '/rescue' }], { skill: 'signed:2', kind: 'exam' })[0].done).toBe(NOW);
  });
  it('can be finished', () => {
    const items = buildMission(planNext(LEARNERS.dueReview()).items);
    let d = items;
    items.forEach((i) => { d = completeMissionItems(d, { skill: i.skill, kind: i.kind === 'new' ? 'continue' : i.kind, stage: i.stage }, NOW); });
    expect(missionDone(d)).toBe(true);
  });
});

describe('planNext is pure', () => {
  afterEach(() => { vi.useRealTimers(); });
  it('gives the same plan for the same context, whatever the clock says', () => {
    const once = Object.fromEntries(Object.entries(LEARNERS).map(([k, f]) => [k, planNext(f())]));
    vi.useFakeTimers(); vi.setSystemTime(new Date('2031-03-01T12:00:00Z'));
    Object.entries(LEARNERS).forEach(([k, f]) => expect(planNext(f())).toEqual(once[k]));
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
    Object.entries(LEARNERS).forEach(([k, f]) => expect(planNext(f())).toEqual(once[k]));
  });
  it('does not change its input', () => {
    const c = LEARNERS.examIn3Days();
    const copy = JSON.parse(JSON.stringify(c));
    planNext(c);
    expect(JSON.parse(JSON.stringify(c))).toEqual(copy);
  });
  it('nextActions is a thin wrapper over it', () => {
    const c = LEARNERS.misconception();
    expect(nextActions(c)).toEqual(planNext(c).items);
  });
});

// ------------------------------------------------------------------ one next: the surfaces agree

const DAYS = ['2026-09-08', '2026-10-13', '2026-11-10', '2026-11-14', '2026-12-15', '2027-02-09', '2027-03-20', '2027-05-11', '2027-07-13'];

/** A random learner over the fixtures' fields, as the app could have saved it, on a fresh day (no mission yet). */
function randomLearner(rnd: () => number): { ctx: NextContext; lastTopic: string | null } {
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)];
  const chance = (p: number) => rnd() < p;
  const day = pick(DAYS);
  const now = `${day}T09:00:00.000Z`;
  const before = (d: number) => addDays(now, -d);
  const grade = pick(['7', '8'] as const);
  const L: LearnState = emptyLearn();
  const keptPath: Record<string, any> = {};
  const density = rnd();
  // a learner with reviews due (a banner) or none, so the map's own cases get their share
  const reviewsDue = chance(0.3);
  ALL_SKILLS.forEach((id) => {
    if (!chance(density * 0.6)) return;
    const r = rnd();
    let rec: SkillRecord;
    if (r < 0.2) rec = taughtRec(before(2), pick([['A'], ['A', 'B'], ['A', 'B', 'C']] as const) as ('A' | 'B' | 'C')[]);
    else if (r < 0.4) rec = { ...taughtRec(before(3), ['A', 'B', 'C']), attempts: Array.from({ length: 1 + Math.floor(rnd() * 7) }, () => ({ at: before(1), ok: true, independent: true, purpose: 'practice' as const })) };
    else if (r < 0.45) rec = strugglingRec(before(1));
    else if (r < 0.48) rec = { ...strugglingRec(before(1)), failedChecks: 2 };
    else {
      // mostly not due yet: a due review is a banner, and the map's own cases need their share
      rec = masteredRec(before(2 + Math.floor(rnd() * 10)), reviewsDue && chance(0.3) ? 1 : 20 + Math.floor(rnd() * 30), 2);
      if (reviewsDue && chance(0.15)) rec = { ...rec, mastered: { ...rec.mastered!, lastReview: { at: before(1), ok: false } } };
    }
    L.skills[id] = rec;
  });
  // the map: mastered stairs are done; some units were climbed before mastery checks (kept) or passed over (jumped)
  TOPIC_ORDER.forEach((t) => {
    if (chance(0.15)) keptPath[t] = { done: Object.fromEntries(Array.from({ length: 1 + Math.floor(rnd() * 3) }, (_, i) => [i + 1, 'kept'])) };
    else if (chance(0.1)) keptPath[t] = { jumped: 1 + Math.floor(rnd() * 3) };
  });
  const path = pathOf(L.skills, keptPath);
  // a kept stair is never also mastered
  Object.entries(path).forEach(([t, u]: [string, any]) => Object.keys(u.done || {}).forEach((l) => { if (L.skills[skillId(t, Number(l))]?.mastered) u.done[l] = 'mastered'; }));
  // confirmed misconceptions, some already offered twice today
  if (chance(0.12)) {
    const withMisc = ALL_SKILLS.filter((id) => (contentOf(id)?.misconceptions.length || 0) > 0);
    const id = pick(withMisc); const m = pick(contentOf(id)!.misconceptions);
    L.miscon[`${id}|${m.id}`] = { skill: id, id: m.id, score: 2, seen: ['a', 'b'], state: 'confirmed', at: before(1), ...(chance(0.3) ? { offered: { day, n: 2 } } : {}) };
  }
  // an exam: none, before its diagnostic, or diagnosed; soon, far, or past; never on Shabbat
  if (chance(0.25)) {
    let date = addDays(now, pick([0, 1, 2, 3, 5, 9, 13, 20, -2])).slice(0, 10);
    if (isShabbatDay(date)) date = addDays(`${date}T09:00:00.000Z`, 1).slice(0, 10);
    const skills = ALL_SKILLS.filter(() => chance(0.08)).slice(0, 6);
    if (!skills.length) skills.push(pick(ALL_SKILLS));
    let plan = newPlan({ grade, date, skills, confidence: pick([1, 2, 3, 4] as const), minutes: pick([10, 15, 20, 30]) }, before(1));
    if (chance(0.7)) skills.forEach((sk) => { plan = recordDiagnostic(plan, sk, Math.floor(rnd() * 3), 2, before(1)); });
    L.exam = plan;
  }
  // the floor: no check yet, on with a miss, or off again
  if (chance(0.3)) L.floor = { at: before(5), on: chance(0.6), results: Object.fromEntries(['frac:1', 'frac:2', 'frac:3', 'frac:4'].map((f) => [f, { asked: 1, right: chance(0.5) ? 1 : 0 }])), facts: { asked: 2, right: 2 } };
  // checked exams with points lost
  const exams: CheckedExam[] = [];
  if (chance(0.15)) {
    const n = 1 + Math.floor(rnd() * 2);
    for (let k = 0; k < n; k += 1) {
      const qs = Array.from({ length: 3 + Math.floor(rnd() * 4) }, () => { const t = pick(TOPIC_ORDER); return [t, chance(0.8) ? 1 + Math.floor(rnd() * STAIRS[t]) : null, pick(['correct', 'wrong', 'partial', 'missing'])] as [string, number | null, string]; });
      exams.push(checkedExam(1 + Math.floor(rnd() * 60), qs, now));
    }
  }
  const lastTopic = chance(0.6) ? pick(TOPIC_ORDER) : null;
  return { ctx: { learn: L, grade, path, progress: {}, now, day, exams, month: 0 }, lastTopic };
}

describe('one next: every surface names the same step', () => {
  it('300 random learners: the mission\'s button, the map\'s focused stair and Rescue\'s start all lead to the plan\'s top', () => {
    const rnd = seeded(20261110);
    const seen = { stairOnMap: 0, lead: 0, banner: 0, exam: 0, restDay: 0, empty: 0 };
    for (let n = 0; n < 300; n += 1) {
      const { ctx: raw, lastTopic } = randomLearner(rnd);
      const ctx = ctxOf(raw.learn, { grade: raw.grade, day: raw.day, path: raw.path, exams: raw.exams });
      const p = planNext(ctx);
      checkRules(ctx, p);
      if (!p.top) { seen.empty += 1; continue; }
      // TodayCard: the primary button is the mission's first unfinished item (a fresh day: the mission is made now)
      const mission = missionFor({ ...ctx.learn, missions: {} }, ctx.day, p.items).items;
      expect(missionNext(mission)?.to, `mission ${n}`).toBe(p.top.to);
      // Learn: a stair of the map is the focused node, and its card's main button is the plan's step
      const topics = mapTopics(ctx.grade, !!ctx.learn.floor?.on);
      const ids = topics.map((t) => t.id);
      if (onMap(p.top, ids)) {
        seen.stairOnMap += 1;
        const { topic, level } = parseSkill(p.top.skill);
        const f = mapFocus({ from: null, top: p.top, lastTopic, topicIds: ids, firstId: topicsFor(ctx.grade)[0].id, path: ctx.path! });
        expect(f.key, `focus ${n}`).toBe(`${topic}:node:${level}`);
        const rec = ctx.learn.skills[p.top.skill];
        expect(cardRoute(f.node!, rec, f.next), `card ${n}`).toBe(p.top.to);
        // on the path's current stop the card's own button is already the step (no second button)
        if (f.node!.state === 'current') expect(nodeRoute(f.node!, rec), `own ${n} ${p.top.kind} ${p.top.skill}`).toBe(p.top.to);
        // elsewhere (a stair passed over, kept, or worked on out of the path's order) the step leads the card
        if (nodeRoute(f.node!, rec) !== p.top.to) seen.lead += 1;
      } else seen.banner += 1;
      // Exam Rescue: today's first step is the band's first item, and it is the step Rescue's own plan has today
      if (p.restDay) seen.restDay += 1;
      if (p.items.some((x) => x.kind === 'exam')) {
        seen.exam += 1;
        expect(p.top.kind).toBe('exam');
        expect(p.examToday[0].to).toBe(p.top.to);
        const plan = examPlan(ctx.learn.exam!, ctx.learn, ctx.now, ctx.day);
        if (plan.diagnosed) {
          expect(plan.days.some((d) => d.day === ctx.day)).toBe(true);
          expect(p.examToday.map((x) => x.to)).toEqual(plan.today.map((t) => t.to));
        } else expect(p.examToday[0].to).toBe('/rescue/check');
      }
    }
    // the generator reaches every case
    expect(seen.stairOnMap).toBeGreaterThan(60);
    expect(seen.banner).toBeGreaterThan(40);
    expect(seen.exam).toBeGreaterThan(20);
    expect(seen.restDay).toBeGreaterThan(10);
    expect(seen.lead).toBeGreaterThan(0);
    expect(seen.lead).toBeLessThan(seen.stairOnMap);
  });

  it('a ח׳ student is not offered sys:1 (equations with percents) as new while pct:5 is not done', () => {
    // February: sys:1 (December) is taught by now. Ratio, line, Pythagoras and statistics are done; percent is not started
    const day = '2027-02-09'; const now = `${day}T09:00:00.000Z`;
    const done = (L: LearnState, ids: SkillId[]) => ids.forEach((s) => { L.skills[s] = masteredRec(ago(5, now), 60); });
    const L = emptyLearn();
    done(L, ALL_SKILLS.filter((s) => ['ratio', 'line', 'pyth', 'stats'].includes(parseSkill(s).topic)));
    const news = () => planNext(ctxOf(L, { grade: '8', day })).items.filter((x) => x.kind === 'new').map((x) => x.skill);
    expect(prereqsOf('sys:1')).toContain('pct:5');
    expect(news()).toEqual(['pct:1']);
    for (const n of [1, 2, 3, 4]) {
      done(L, [`pct:${n}`]);
      expect(news(), `after pct:${n}`).not.toContain('sys:1');
    }
    expect(news()).toEqual(['pct:5']);
    // pct:3 hard again: pct:5 cannot be new, and without the edge sys:1 would be; with it, sys:1 waits too
    L.skills['pct:3'] = strugglingRec(ago(1, now));
    expect(news()).not.toContain('sys:1');
    expect(news()).not.toContain('pct:5');
    // percent done: now sys:1 is the next new stair
    done(L, ['pct:3', 'pct:5']);
    expect(news()).toEqual(['sys:1']);
  });

  it('a ח׳ student in November gets ratio:1 (taught in September) as the first new stair, and the map focuses it', () => {
    const c = ctxOf(emptyLearn(), { grade: '8' });
    const p = planNext(c);
    const first = p.items.find((x) => x.kind === 'new')!;
    expect(first.skill).toBe('ratio:1');
    expect(first.to).toBe('/learn/ratio/1/A');
    expect(first.reason).toContain('לפי תוכנית הלימודים, זה נלמד בכיתה בספטמבר.');
    expect(p.top).toBe(first);
    const ids = mapTopics('8', false).map((t) => t.id);
    expect(ids[0]).toBe('ratio');
    const f = mapFocus({ from: null, top: p.top, lastTopic: null, topicIds: ids, firstId: ids[0], path: {} });
    expect(f.key).toBe('ratio:node:1');
    // an existing ח׳ student in the middle of line keeps the map on line: the stair in progress comes before a new one,
    // and the unit numbers moving (line is now the second unit) moves no saved progress, which is keyed by topic
    const L = emptyLearn();
    L.skills = { 'line:1': masteredRec(ago(20), 60), 'line:2': masteredRec(ago(10), 60), 'line:3': taughtRec(ago(1), ['A']) };
    const mid = ctxOf(L, { grade: '8' });
    const pm = planNext(mid);
    expect(pm.top).toMatchObject({ kind: 'continue', skill: 'line:3' });
    expect(pm.items.find((x) => x.kind === 'new')?.skill).toBe('ratio:1');
    expect(mapFocus({ from: null, top: pm.top, lastTopic: 'line', topicIds: ids, firstId: ids[0], path: mid.path! })).toMatchObject({ topic: 'line', key: 'line:node:3' });
    // slope as steps leans on ratio: line:3 is not offered as new before ratio:1 is in place
    expect(p.items.some((x) => x.kind === 'new' && x.skill === 'line:3')).toBe(false);
  });

  it('a brand-new student\'s first step is the map\'s focused stair, the one Welcome opens in November', () => {
    for (const name of ['newSeventh', 'newSeventhSeptember'] as const) {
      const c = LEARNERS[name]();
      const p = planNext(c);
      const ids = mapTopics('7', false).map((t) => t.id);
      const f = mapFocus({ from: null, top: p.top, lastTopic: null, topicIds: ids, firstId: 'signed', path: {} });
      expect(f.key).toBe(name === 'newSeventh' ? 'signed:node:1' : 'angles:node:1');
      expect(f.node!.state).toBe('current');
      expect(nodeRoute(f.node!, undefined)).toBe(p.top!.to);
    }
  });

  it('back from a lesson the map stays on that unit; a step that is no stair of the map is the banner', () => {
    const c = LEARNERS.midSigned3();
    const p = planNext(c);
    const ids = mapTopics('7', false).map((t) => t.id);
    expect(mapFocus({ from: 'coord', top: p.top, lastTopic: null, topicIds: ids, firstId: 'signed', path: c.path! })).toMatchObject({ topic: 'coord', next: null });
    for (const name of ['dueReview', 'misconception', 'examIn3Days', 'examLossCoord4', 'hardFractionsNoFloor'] as const) expect(onMap(planNext(LEARNERS[name]()).top, ids)).toBe(false);
    // a prerequisite of the other grade is not on this grade's map either
    expect(onMap({ kind: 'prereq', skill: 'line:1', title: '', reason: '', minutes: 1, to: '' }, ids)).toBe(false);
  });
});
