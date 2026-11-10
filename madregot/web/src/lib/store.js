import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { TOPIC } from '@/content/index.js';
import { recordOnPath, markMastered, reopenKept, reachedUpTo, doneCount, chestOpen } from './path.js';
import { questProgress } from './quests.js';
import { STAGE_XP } from './lesson.js';
import { noteGap, gapsFromExam } from './board.js';
import { learnAfterAnswer, learnAfterCheck, emptyLearn } from '@/learn/storeGlue.ts';
import { markTaught as markTaughtRec } from '@/learn/mastery.ts';
import { logEvent } from '@/learn/analytics.ts';
import { startRepair as startRepairRec } from '@/learn/misconceptions.ts';
import { completeMissionItems } from '@/learn/mission.ts';
import { newPlan, recordDiagnostic } from '@/learn/examRescue.ts';
import { randomHex } from './random.js';
import { migrate, CURRENT_VERSION, AI_DEFAULTS, BACKUP_DEFAULTS, DURABLE_DEFAULTS } from './durable/migrations.js';
import { addXp, newTag } from './durable/xp.js';
import { durableStorage, bindDurableStore, STORE_KEY } from './durable/storage.js';
import { EXAMS_KEEP, PRACTICE_EXAMS_KEEP, OUTBOX_KEEP } from './durable/merge.js';

export const today = (d = new Date()) => d.toLocaleDateString('en-CA');
export const dayBefore = (key) => { const d = new Date(`${key}T12:00:00`); d.setDate(d.getDate() - 1); return today(d); };

const empty = {
  profile: null, // { role: 'student', name, grade, classCode?, className?, teacherName?, token?, studentId? } | { role: 'teacher', name, classes: [], active }
  progress: {}, // topicId -> { level, max }
  days: {}, // 'YYYY-MM-DD' -> { q, ok, secs, lessons, stages (teaching stages finished), xp, combo, perfect, reviews, planLessons, frozen, questsRewarded }
  xp: 0, // always the sum of xpBy: every XP write goes through addXp (lib/durable/xp.js)
  xpBy: {}, // device tag -> XP earned on that device
  resetAt: null, // when the progress was last reset on purpose (ISO)
  path: {}, // topicId -> { parts: { level: practice lessons }, reviews, jumped, done: { level: 'mastered' | 'kept' } } (lib/path.js)
  freezes: 0, // streak freezes ready to use (at most 2), earned by finishing the daily quests
  goalXp: 20, // daily goal in XP
  sound: true,
  mistakes: {}, // 'topic:cat' -> count
  lastTopic: null,
  outbox: [],
  ai: { ...AI_DEFAULTS }, // the tutor on this device (lib/durable/migrations.js says what each field is)
  // this device's tag and save prompts; the tag is made by the v5 migration, on sign-out, or with a new device's first XP
  durable: { ...DURABLE_DEFAULTS },
  backup: { ...BACKUP_DEFAULTS }, // the backup of this student's progress, off until it is turned on
  helpSent: 0,
  solveMode: 'answer', // 'answer' (keypad) or 'notebook' (write the working on a squared page)
  exams: [], // checked exams, newest first: { id, at, title, source, practiceId, result, score, levels }
  practiceExams: [], // printable practice exams with their answer key
  planBase: {}, // topic -> { level, wins, at }: the focus level and wins counted there when the plan step started
  wins: {}, // 'topic:level' -> correct answers at that level
  gaps: {}, // 'topic:cat' (or 'topic:exam:skill') -> { level, n, ok, at, text? }: what is not clear yet; clears after GAP_CLEAR right answers at that level
  placement: null, // { at, grade, results: { topic: { level, asked, right } } }
  learn: emptyLearn(), // Madregot 2.0: skills (evidence, mastery, reviews), misconceptions, exam plan, missions, events (src/learn/types.ts)
};

/** A class student's answers waiting for the server, at most (the oldest give way first). */
export const OUTBOX_MAX = OUTBOX_KEEP;
/** What the class server stores of an answer (worker saveProgress), and all the outbox keeps of it. */
export const toWire = (e) => ({ id: e.id, topic: e.topic, level: e.level, ok: e.ok, first: e.first, hint: e.hint, cat: e.cat, secs: e.secs, at: e.at });

/** The saved-state key (a staging copy on the same address keeps its own); the parent session lives beside it. */
export { STORE_KEY };
/** A personal Claude key is compiled in only for the no-server copies (VITE_ALLOW_PERSONAL_KEY=1). */
export const PERSONAL_KEY = import.meta.env.VITE_ALLOW_PERSONAL_KEY === '1';

/**
 * Saved data from an older version, brought up to date (the steps and why each exists: lib/durable/migrations.js).
 * Unknown or broken saved data falls back to the defaults. `personal`: this build can use a personal Claude key.
 */
export function migrateState(saved, version, { personal = PERSONAL_KEY } = {}) {
  return migrate(saved, version, { personal });
}

/**
 * The store's state and actions, without the saving around them: useApp below wraps it in persist; the tests of the
 * merges between tabs make two stores of it on one storage (durable/tabs.test.js).
 */
export const appState = (set, get) => ({
      ...empty,
      setProfile: (profile) => set({ profile }),
      patchProfile: (patch) => set({ profile: { ...get().profile, ...patch } }),
      setAI: (patch) => set({ ai: { ...get().ai, ...patch } }),
      setSolveMode: (solveMode) => set({ solveMode }),
      addExam: (exam) => set({ exams: [exam, ...get().exams].slice(0, EXAMS_KEEP), gaps: gapsFromExam(get().gaps, exam) }),
      removeExam: (id) => set({ exams: get().exams.filter((e) => e.id !== id) }),
      addPracticeExam: (pe) => set({ practiceExams: [pe, ...get().practiceExams].slice(0, PRACTICE_EXAMS_KEEP) }),
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
          ...addXp(get(), xpGain),
          mistakes,
          wins,
          gaps: noteGap(get().gaps, event),
          // a class student's answer waits here until the server has it; its id makes a resent answer count once
          outbox: get().profile?.token ? [...get().outbox, toWire({ ...event, id: randomHex(6) })].slice(-OUTBOX_MAX) : get().outbox,
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
        set({ learn, days, ...addXp(st, r.xp || 0), path, progress, lastTopic: r.topic || st.lastTopic });
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
          days, ...addXp(st, xp), freezes: Math.min(2, st.freezes + (freezeEarned ? 1 : 0)), lastTopic: TOPIC[topic] ? topic : st.lastTopic,
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
      addXP: (n) => set(addXp(get(), n)),
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
          days, path, ...addXp(st, r.xp), freezes: Math.min(2, st.freezes + (freezeEarned ? 1 : 0)),
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
        set({ path, progress, days, ...addXp(st, r.xp), placement: { at: new Date().toISOString(), grade: r.grade, results: r.results } });
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
      /** The server has these answers (by id): they leave the outbox. Answers recorded meanwhile stay. */
      ackOutbox: (ids) => {
        const done = new Set(ids);
        if (done.size) set({ outbox: get().outbox.filter((e) => !done.has(e.id)) });
      },
      leaveClass: () => {
        const p = get().profile; if (!p) return;
        const { classCode, className, teacherName, token, studentId, ...rest } = p;
        set({ profile: rest, outbox: [] });
      },
      // a reset on purpose: its time travels with the progress, so a later merge cannot bring the old progress back
      resetProgress: () => set({ progress: {}, days: {}, xp: 0, xpBy: {}, resetAt: new Date().toISOString(), mistakes: {}, lastTopic: null, outbox: [], exams: [], practiceExams: [], planBase: {}, wins: {}, path: {}, freezes: 0, gaps: {}, placement: null, learn: emptyLearn() }),
      // the device keeps its id, its family-device link and its tutor settings; a waiting link code does not survive.
      // The next student here gets a new device tag (their XP is counted apart) and no backup; what the browser was
      // asked, and the install hint, belong to the device and stay.
      signOut: () => {
        const { persistAsked, installHintAt } = get().durable || {};
        set({
          ...empty, xpBy: {}, learn: emptyLearn(), ai: { ...get().ai, pendingLink: null, lastTier: null },
          durable: { ...DURABLE_DEFAULTS, persistAsked: persistAsked ?? null, installHintAt: installHintAt ?? null, tag: newTag() }, backup: { ...BACKUP_DEFAULTS },
          // a sign-out clears the progress on purpose, like a reset: another tab still open cannot bring it back
          resetAt: new Date().toISOString(),
        });
      },
});

/** How the store is saved: under STORE_KEY, at CURRENT_VERSION, migrated from older saves. */
export const persistOptions = (storage) => ({ name: STORE_KEY, storage, version: CURRENT_VERSION, migrate: (saved, version) => migrateState(saved, version) });

// VITE_STORE_KEY lets a staging copy on the same web address keep its own saved state (production: 'madregot').
// Saved through the safe write path (lib/durable/storage.js): one write per tick, the copy on the device, quarantine,
// and the merge with another tab's writes (durable/tabs.js).
export const useApp = create(persist(appState, persistOptions(durableStorage)));
// a restore from the copy on the device loads into this store
bindDurableStore(useApp);

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
