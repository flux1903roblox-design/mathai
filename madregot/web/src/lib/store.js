import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { TOPIC } from '@/content/index.js';
import { recordOnPath, markMastered, reopenKept, migratePath, reachedUpTo, doneCount, chestOpen } from './path.js';
import { questProgress } from './quests.js';
import { STAGE_XP } from './lesson.js';
import { noteGap, gapsFromExam } from './board.js';
import { learnAfterAnswer, learnAfterCheck, emptyLearn, migrateLearn, relabelLegacyEvidence } from '@/learn/storeGlue.ts';
import { markTaught as markTaughtRec } from '@/learn/mastery.ts';
import { logEvent } from '@/learn/analytics.ts';
import { startRepair as startRepairRec } from '@/learn/misconceptions.ts';
import { completeMissionItems } from '@/learn/mission.ts';
import { newPlan, recordDiagnostic } from '@/learn/examRescue.ts';

export const today = (d = new Date()) => d.toLocaleDateString('en-CA');
export const dayBefore = (key) => { const d = new Date(`${key}T12:00:00`); d.setDate(d.getDate() - 1); return today(d); };

/** Nothing from a teacher yet (and after leaving the class). */
export function emptyClassWork() {
  return { at: null /* iso of the last fetch */, today: null, teacherName: '', assignments: [], help: [], exams: {} /* assignmentId -> frozen items */, seenAt: null /* the last opening of /quests */, noticed: {} /* help messageId -> true */ };
}

const safeStorage = createJSONStorage(() => {
  try { localStorage.setItem('__t', '1'); localStorage.removeItem('__t'); return localStorage; } catch {
    const mem = new Map();
    return { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) };
  }
});

const empty = {
  // { role: 'student', name, grade, classCode?, className?, teacherName?, token?, studentId? }
  // | { role: 'teacher', name, grade, classes: [{ code, key: string|null, className, grade, owned?: boolean, fresh?: boolean, bindLater?: 'YYYY-MM-DD', pilot?: {...} }], active, demo?: true }
  // A teacher's email is never kept here: it is read from the signed-in session (lib/parent.js).
  profile: null,
  progress: {}, // topicId -> { level, max }
  days: {}, // 'YYYY-MM-DD' -> { q, ok, secs, lessons, stages (teaching stages finished), xp, combo, perfect, reviews, planLessons, frozen, questsRewarded }
  xp: 0,
  path: {}, // topicId -> { parts: { level: practice lessons }, reviews, jumped, done: { level: 'mastered' | 'kept' } } (lib/path.js)
  freezes: 0, // streak freezes ready to use (at most 2), earned by finishing the daily quests
  goalXp: 20, // daily goal in XP
  sound: true,
  mistakes: {}, // 'topic:cat' -> count
  lastTopic: null,
  outbox: [],
  // the tutor on this device: the server (or a personal key, only in builds with VITE_ALLOW_PERSONAL_KEY=1), an anonymous
  // device id, the family-device token (AI only, never the parent's session), a link code waiting for a parent, and the
  // tier the server reported last (to say once that a plan ended)
  ai: { mode: 'server', apiUrl: '', key: '', device: '', familyDevice: null /* {token, label} */, pendingLink: null /* {code, secret, expiresAt, url} */, lastTier: null },
  helpSent: 0,
  solveMode: 'answer', // 'answer' (keypad) or 'notebook' (write the working on a squared page)
  exams: [], // checked exams, newest first: { id, at, title, source, practiceId, result, score, levels }
  practiceExams: [], // printable practice exams with their answer key
  planBase: {}, // topic -> { level, wins, at }: the focus level and wins counted there when the plan step started
  wins: {}, // 'topic:level' -> correct answers at that level
  gaps: {}, // 'topic:cat' (or 'topic:exam:skill') -> { level, n, ok, at, text? }: what is not clear yet; clears after GAP_CLEAR right answers at that level
  placement: null, // { at, grade, results: { topic: { level, asked, right } } }
  learn: emptyLearn(), // Madregot 2.0: skills (evidence, mastery, reviews), misconceptions, exam plan, missions, events (src/learn/types.ts)
  // the teacher's work for a student in a class (TEACHER-5, lib/classWork.js): the last GET /api/class/work, kept so it
  // shows offline too; when the student last opened the missions tab; and the reports not yet confirmed by the server
  classWork: emptyClassWork(),
  workOutbox: {}, // assignmentId -> the newest report waiting for the server (merged with learn/assignments.ts mergeWork)
  // the teacher's printable class exams on this device (TEACHER-3), newest first, at most TEACHER_EXAMS:
  // { id (12 hex), classCode, at, title, skills: ['signed:2', ...], count, versions: [{ label: 'א', items }, { label: 'ב', items }?],
  //   skipped: stairs left out (dragging only), assignmentId: null }
  teacherExams: [],
};
/** Class exams a teacher keeps on a device. */
export const TEACHER_EXAMS = 8;

/** The saved-state key (a staging copy on the same address keeps its own); the parent session lives beside it. */
export const STORE_KEY = import.meta.env.VITE_STORE_KEY || 'madregot';
/** A personal Claude key is compiled in only for the no-server copies (VITE_ALLOW_PERSONAL_KEY=1). */
export const PERSONAL_KEY = import.meta.env.VITE_ALLOW_PERSONAL_KEY === '1';

/**
 * Saved data from an older version, brought up to date. Unknown or broken saved data falls back to the defaults.
 * v1 → v2 (Madregot 2.0): the learning model is added, seeded from the misconceptions already recorded (gaps).
 * v2 → v3 (the paid tutor): the parent's account never lives in the child's store (ai.account is dropped), and a
 * personal Claude key and a saved server address are dropped from builds that cannot use them: these builds have no
 * setting to change or clear the address (it lives in "מתקדם", compiled in only with
 * VITE_ALLOW_PERSONAL_KEY=1), so an old one would point the app at a server for good. Everything else is kept.
 * v3 → v4: a stair is done only after its mastery check. Every stair that was done before stays done ('kept', and its
 * mastery check is offered); stairs already mastered are marked so. Evidence a number-line exercise recorded under the
 * wrong name is moved to the mistake it really showed.
 * v4 → v5 (class work from the teacher): an empty classWork and workOutbox.
 */
export function migrateState(saved, version, { personal = PERSONAL_KEY } = {}) {
  let st = saved && typeof saved === 'object' ? { ...saved } : {};
  if (version < 2) st = { ...st, learn: migrateLearn(st.gaps || {}) };
  else st = { ...st, learn: st.learn && typeof st.learn === 'object' ? { ...emptyLearn(), ...st.learn } : emptyLearn() };
  if (version < 3) {
    const { account, ...ai } = st.ai && typeof st.ai === 'object' ? st.ai : {}; // eslint-disable-line no-unused-vars
    st.ai = { ...empty.ai, ...ai };
    if (!personal) st.ai = { ...st.ai, key: '', mode: 'server', apiUrl: '' };
  }
  if (version < 4) {
    const path = st.path && typeof st.path === 'object' ? st.path : {};
    const progress = st.progress && typeof st.progress === 'object' ? st.progress : {};
    st = { ...st, path: migratePath(path, progress, st.learn.skills || {}), learn: relabelLegacyEvidence(st.learn) };
  }
  if (version < 5) st = { ...st, classWork: emptyClassWork(), workOutbox: {} };
  return st;
}

export const useApp = create(
  persist(
    (set, get) => ({
      ...empty,
      setProfile: (profile) => set({ profile }),
      patchProfile: (patch) => set({ profile: { ...get().profile, ...patch } }),
      /** The teacher opens another of their classes: the board and the student screens follow its grade. */
      setActiveClass: (code) => {
        const p = get().profile;
        const cls = p?.role === 'teacher' ? p.classes?.find((c) => c.code === code) : null;
        if (cls) set({ profile: { ...p, active: cls.code, ...(cls.grade ? { grade: cls.grade } : {}) } });
      },
      setAI: (patch) => set({ ai: { ...get().ai, ...patch } }),
      setSolveMode: (solveMode) => set({ solveMode }),
      addExam: (exam) => set({ exams: [exam, ...get().exams].slice(0, 30), gaps: gapsFromExam(get().gaps, exam) }),
      removeExam: (id) => set({ exams: get().exams.filter((e) => e.id !== id) }),
      addPracticeExam: (pe) => set({ practiceExams: [pe, ...get().practiceExams].slice(0, 20) }),
      /** A new class exam (TEACHER-3): first in the list, and the oldest beyond TEACHER_EXAMS goes. */
      addTeacherExam: (te) => set({ teacherExams: [te, ...(get().teacherExams || []).filter((x) => x.id !== te.id)].slice(0, TEACHER_EXAMS) }),
      updateTeacherExam: (id, patch) => set({ teacherExams: (get().teacherExams || []).map((x) => (x.id === id ? { ...x, ...patch } : x)) }),
      resetPlanBase: (patch) => set({ planBase: { ...get().planBase, ...patch } }),
      setLevel: (topicId, level, max) => set({
        progress: { ...get().progress, [topicId]: { level, max: Math.max(max, get().progress[topicId]?.max || 1) } },
        lastTopic: topicId,
      }),
      recordAnswer: (event, xpGain) => {
        const d = today(); const cur = get().days[d] || { q: 0, ok: 0, secs: 0 };
        const mistakes = { ...get().mistakes };
        const wins = event.ok && event.level ? { ...get().wins, [`${event.topic}:${event.level}`]: (get().wins[`${event.topic}:${event.level}`] || 0) + 1 } : get().wins;
        if (event.cat && !event.ok) mistakes[`${event.topic}:${event.cat}`] = (mistakes[`${event.topic}:${event.cat}`] || 0) + 1;
        set({
          // lessons: 0 marks a day of this version: answers alone do not keep the streak, a finished lesson does
          days: { ...get().days, [d]: { ...cur, lessons: cur.lessons ?? 0, q: (cur.q || 0) + 1, ok: (cur.ok || 0) + (event.ok ? 1 : 0), secs: (cur.secs || 0) + Math.min(event.secs || 0, 300) } },
          xp: get().xp + xpGain,
          mistakes,
          wins,
          gaps: noteGap(get().gaps, event),
          outbox: get().profile?.token ? [...get().outbox, event].slice(-500) : get().outbox,
          learn: learnAfterAnswer(get().learn, event),
        });
      },
      /** Evidence for the learning model only (a first miss before another try, a move in solve-together): not a finished question. */
      noteLearn: (event) => set({ learn: learnAfterAnswer(get().learn, event) }),
      /**
       * A finished check (mastery, review, verify, diagnostic, practice exam): mastery, reviews, misconceptions, the exam
       * plan. A passed mastery check is what marks a stair done on the path, and moves the path on.
       */
      completeCheck: (r) => {
        // a check is a finished learning activity: it keeps the streak and earns XP when it passed
        const st = get(); const d = today(); const cur = st.days[d] || {};
        const goalBefore = (cur.xp || 0) >= st.goalXp;
        const day = { ...cur, lessons: (cur.lessons || 0) + 1, xp: (cur.xp || 0) + (r.xp || 0) };
        const days = { ...st.days, [d]: day };
        const learn = learnAfterCheck(st.learn, r, new Date().toISOString(), d);
        let { path, progress } = st; let stairDone = false; let chestOpened = false; let reopened = false;
        if (r.purpose === 'mastery' && r.passed && r.topic && r.level && TOPIC[r.topic]) {
          const chestBefore = chestOpen(r.topic, path);
          ({ path, stairDone } = markMastered(path, r.topic, r.level));
          chestOpened = !chestBefore && chestOpen(r.topic, path);
          // the topic's level is the next stair the path leads to
          const top = TOPIC[r.topic].levels.length; const p = progress[r.topic] || { level: 1, max: 1 };
          const level = Math.min(top, Math.max(p.level, reachedUpTo(r.topic, path) + 1));
          progress = { ...progress, [r.topic]: { level, max: Math.max(p.max, level) } };
        } else if (r.purpose === 'mastery' && !r.passed && r.topic && r.level && TOPIC[r.topic]) {
          // a stair kept from before mastery checks stays done only until its check says otherwise
          const before = path;
          path = reopenKept(path, r.topic, r.level);
          reopened = path !== before;
        }
        set({ learn, days, xp: st.xp + (r.xp || 0), path, progress, lastTopic: r.topic || st.lastTopic });
        return { streakExtended: !learnedOn(cur), streak: streakOf(days), goalReached: !goalBefore && day.xp >= st.goalXp, stairDone, chestOpened, reopened, done: r.topic && TOPIC[r.topic] ? doneCount(r.topic, path) : null };
      },
      learnEvent: (e) => set({ learn: { ...get().learn, events: logEvent(get().learn.events, e, new Date().toISOString()) } }),
      /**
       * A teaching stage finished, as the student lives it: the stage is recorded as learning (never mastery), the
       * first time it earns XP towards the daily goal (STAGE_XP), and the day counts for the streak like a lesson.
       * Returns what to show in the stage's short completion moment.
       */
      completeStage: (skill, stage) => {
        const st = get(); const d = today(); const cur = st.days[d] || {}; const at = new Date().toISOString();
        const L = st.learn; const first = !L.skills[skill]?.taught?.[stage];
        const xp = first ? STAGE_XP[stage] || 0 : 0;
        const goalBefore = (cur.xp || 0) >= st.goalXp;
        const questsBefore = questProgress(d, cur).every((q) => q.done);
        const day = { ...cur, stages: (cur.stages || 0) + 1, xp: (cur.xp || 0) + xp };
        const questsDone = !questsBefore && questProgress(d, day).every((q) => q.done);
        const freezeEarned = questsDone && !cur.questsRewarded && st.freezes < 2;
        if (questsDone) day.questsRewarded = true;
        const days = { ...st.days, [d]: day };
        const topic = skill.split(':')[0];
        set({
          days, xp: st.xp + xp, freezes: Math.min(2, st.freezes + (freezeEarned ? 1 : 0)), lastTopic: TOPIC[topic] ? topic : st.lastTopic,
          learn: { ...L, skills: { ...L.skills, [skill]: markTaughtRec(L.skills[skill], stage, at) }, events: logEvent(L.events, { e: `stage-${stage}`, s: skill }, at) },
        });
        return { xp, first, streakExtended: !learnedOn(cur), streak: streakOf(days), goalReached: !goalBefore && day.xp >= st.goalXp, questsDone, freezeEarned };
      },
      /** Where the student is inside a teaching stage, so leaving keeps the place. */
      setStagePos: (skill, stage, i) => { const L = get().learn; const r = L.skills[skill] || { attempts: [] }; set({ learn: { ...L, skills: { ...L.skills, [skill]: { ...r, pos: { ...(r.pos || {}), [stage]: i } } } } }); },
      startRepair: (skill, misc) => { const L = get().learn; const at = new Date().toISOString(); set({ learn: { ...L, miscon: startRepairRec(L.miscon, skill, misc, today(), at), events: logEvent(L.events, { e: 'repair-start', s: skill, m: misc }, at) } }); },
      saveMission: (day, items) => { const L = get().learn; const keep = Object.fromEntries(Object.entries(L.missions).filter(([d]) => d >= dayBefore(dayBefore(day)))); set({ learn: { ...L, missions: { ...keep, [day]: { items } } } }); },
      completeMission: (done) => { const L = get().learn; const d = today(); const m = L.missions[d]; if (!m) return; set({ learn: { ...L, missions: { ...L.missions, [d]: { items: completeMissionItems(m.items, done, new Date().toISOString()) } } } }); },
      setExam: (input) => { const L = get().learn; const at = new Date().toISOString(); set({ learn: { ...L, exam: input ? newPlan(input, at) : null, events: input ? logEvent(L.events, { e: 'rescue-created' }, at) : L.events } }); },
      recordExamDiagnostic: (skill, right, asked) => { const L = get().learn; if (!L.exam) return; set({ learn: { ...L, exam: recordDiagnostic(L.exam, skill, right, asked, new Date().toISOString()) } }); },
      addXP: (n) => set({ xp: get().xp + n }),
      setGoalXp: (goalXp) => set({ goalXp }),
      setSound: (sound) => set({ sound }),
      /**
       * A finished lesson: XP, today's counters, the path, the topic level, and the daily quests.
       * Returns what to celebrate: { streakExtended, streak, practiceDone, unitDone, questsDone, freezeEarned, goalReached }.
       * Practice never marks a stair done (only its mastery check does): practiceDone says the check is next.
       */
      completeLesson: (r, { fromPlan = false } = {}) => {
        const st = get(); const d = today(); const cur = st.days[d] || {};
        const questsBefore = questProgress(d, cur).every((q) => q.done);
        const goalBefore = (cur.xp || 0) >= st.goalXp;
        const day = {
          ...cur, lessons: (cur.lessons || 0) + 1, xp: (cur.xp || 0) + r.xp, combo: Math.max(cur.combo || 0, r.bestCombo || 0),
          perfect: (cur.perfect || 0) + (r.perfect ? 1 : 0), reviews: (cur.reviews || 0) + (r.kind === 'review' ? 1 : 0),
          planLessons: (cur.planLessons || 0) + (fromPlan ? 1 : 0),
        };
        const questsDone = !questsBefore && questProgress(d, day).every((q) => q.done);
        const freezeEarned = questsDone && !cur.questsRewarded && st.freezes < 2;
        if (questsDone) day.questsRewarded = true;
        const { path, practiceDone, unitDone } = recordOnPath(st.path, r);
        // The topic level follows the path: a passed jump test moves it on (a stair's own move is its mastery check).
        const p = st.progress[r.topic] || { level: 1, max: 1 };
        let level = p.level; let max = p.max;
        if (r.kind === 'jump' && r.passed) { level = Math.max(level, r.level); max = Math.max(max, r.level); }
        const days = { ...st.days, [d]: day };
        set({
          days, path, xp: st.xp + r.xp, freezes: Math.min(2, st.freezes + (freezeEarned ? 1 : 0)),
          progress: { ...st.progress, [r.topic]: { level, max } }, lastTopic: r.topic,
        });
        return { streakExtended: !learnedOn(cur), streak: streakOf(days), practiceDone, unitDone, questsDone, freezeEarned, goalReached: !goalBefore && day.xp >= st.goalXp };
      },
      /** The placement test settles where each topic starts (the stairs before it are passed over, not done); it counts as the day's first lesson. */
      completePlacement: (r) => {
        const st = get(); const d = today(); const cur = st.days[d] || {};
        const goalBefore = (cur.xp || 0) >= st.goalXp;
        const path = { ...st.path }; const progress = { ...st.progress };
        Object.entries(r.results).forEach(([topic, res]) => {
          const t = TOPIC[topic]; if (!t) return;
          const u = { parts: {}, reviews: 0, jumped: 0, done: {}, ...(path[topic] || {}) };
          path[topic] = { ...u, jumped: Math.max(u.jumped || 0, res.level) };
          const p = progress[topic] || { level: 1, max: 1 };
          const level = Math.min(t.levels.length, Math.max(p.level, res.level + 1));
          progress[topic] = { level, max: Math.max(p.max, level) };
        });
        const day = { ...cur, lessons: (cur.lessons || 0) + 1, xp: (cur.xp || 0) + r.xp, combo: Math.max(cur.combo || 0, r.bestCombo || 0) };
        const days = { ...st.days, [d]: day };
        set({ path, progress, days, xp: st.xp + r.xp, placement: { at: new Date().toISOString(), grade: r.grade, results: r.results } });
        return { streakExtended: !learnedOn(cur), streak: streakOf(days), goalReached: !goalBefore && day.xp >= st.goalXp };
      },
      /** On opening the app: spend freezes on missed days so the streak survives (at most two). */
      settleStreak: () => {
        const st = get(); if (!st.freezes) return 0;
        const days = { ...st.days }; let key = dayBefore(today()); const missed = [];
        while (missed.length <= st.freezes && !active(days[key]) && !days[key]?.frozen) { if (!isShabbat(key)) missed.push(key); key = dayBefore(key); }
        if (!missed.length || missed.length > st.freezes || !active(days[key])) return 0;
        missed.forEach((k) => { days[k] = { ...(days[k] || {}), frozen: true }; });
        set({ days, freezes: st.freezes - missed.length });
        return missed.length;
      },
      takeOutbox: () => { const items = get().outbox; set({ outbox: [] }); return items; },
      returnOutbox: (items) => set({ outbox: [...items, ...get().outbox].slice(-500) }),
      leaveClass: () => {
        const p = get().profile; if (!p) return;
        const { classCode, className, teacherName, token, studentId, ...rest } = p;
        set({ profile: rest, outbox: [], classWork: emptyClassWork(), workOutbox: {} });
      },
      resetProgress: () => set({ progress: {}, days: {}, xp: 0, mistakes: {}, lastTopic: null, outbox: [], exams: [], practiceExams: [], planBase: {}, wins: {}, path: {}, freezes: 0, gaps: {}, placement: null, learn: emptyLearn() }),
      // the device keeps its id, its family-device link and its tutor settings; a waiting link code does not survive
      signOut: () => set({ ...empty, learn: emptyLearn(), classWork: emptyClassWork(), workOutbox: {}, ai: { ...get().ai, pendingLink: null, lastTier: null } }),
    }),
    // VITE_STORE_KEY lets a staging copy on the same web address keep its own saved state (production: 'madregot')
    { name: STORE_KEY, storage: safeStorage, version: 5, migrate: (saved, version) => migrateState(saved, version) },
  ),
);

/** Something was finished that day: a lesson or check, or a teaching stage (understand, worked examples, solve together). */
export const learnedOn = (d) => !!d && ((d.lessons || 0) > 0 || (d.stages || 0) > 0);
/** A day counts for the streak with one finished lesson or teaching stage (or answers saved before lessons existed). */
export const isActiveDay = (d) => learnedOn(d) || (!!d && d.lessons == null && (d.q || 0) > 0);
const active = isActiveDay;
/** Shabbat never breaks a streak: a Saturday without practice is skipped, not missed. */
export const isShabbat = (key) => new Date(`${key}T12:00:00`).getDay() === 6;
const kept = (days, key) => days[key]?.frozen || isShabbat(key);

/** Consecutive active days ending today (or yesterday, if today has none yet). A frozen day keeps the chain without adding to it. */
export function streakOf(days) {
  let key = today();
  if (!active(days[key])) key = dayBefore(key);
  let n = 0;
  // Walk back: an active day adds one; a frozen day or a Shabbat is passed over; any other day ends the streak.
  for (;;) {
    if (active(days[key])) n += 1;
    else if (!kept(days, key)) break;
    key = dayBefore(key);
  }
  return n;
}
export const activeToday = (days) => active(days[today()]);

export const minutesToday = (days) => Math.floor((days[today()]?.secs || 0) / 60);
