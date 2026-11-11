import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { TOPIC } from '@/content/index.js';
import { guestSkillsOf } from '@/learn/skills.ts';
import { recordOnPath, markMastered, reopenKept, reachedUpTo, doneCount, chestOpen } from './path.js';
import { questProgress } from './quests.js';
import { STAGE_XP } from './lesson.js';
import { noteGap, gapsFromExam } from './board.js';
import { learnAfterAnswer, learnAfterCheck, emptyLearn } from '@/learn/storeGlue.ts';
import { markTaught as markTaughtRec } from '@/learn/mastery.ts';
import { logEvent } from '@/learn/analytics.ts';
import { startRepair as startRepairRec } from '@/learn/misconceptions.ts';
import { completeMissionItems, missionDone } from '@/learn/mission.ts';
import { newPlan, recordDiagnostic } from '@/learn/examRescue.ts';
import { randomHex } from './random.js';
import { migrate, CURRENT_VERSION, AI_DEFAULTS, BACKUP_DEFAULTS, DURABLE_DEFAULTS, emptyClassWork } from './durable/migrations.js';
import { addXp, newTag } from './durable/xp.js';
import { durableStorage, bindDurableStore, STORE_KEY } from './durable/storage.js';
import { EXAMS_KEEP, PRACTICE_EXAMS_KEEP, OUTBOX_KEEP, TEACHER_EXAMS_KEEP } from './durable/merge.js';
import { applyTheme } from './theme.js';
import { streakRepair, itemsOn } from './streak.js';
import { isRestDay } from '@shared/restDays.js';
import { emptyLook, earnIds, unlockedLook, unlockedIds } from './wardrobe.js';
import { challengeXP } from '@/learn/challenges/grade.ts';
import { challengeById } from '@/learn/challenges/index.ts';

import { today, dayBefore, learnedOn, isActiveDay, isShabbat, keptDay, streakOf } from './days.js';

// the calendar of the saved days lives in lib/days.js (the report engine reads it without the store); the student
// lane's streak helpers (repairs, the weekly best) build on it in lib/streak.js
export { today, dayBefore, learnedOn, isActiveDay, isShabbat, keptDay, streakOf };
const active = isActiveDay;

/** Nothing from a teacher yet (and after leaving the class): the class work slice (its shape: durable/migrations.js). */
export { emptyClassWork };

/**
 * Saving can be held (the demo class, TEACHER-15): while it is, nothing is written to the device's saved state, so a
 * demo opened on a device someone uses never touches their profile or progress, and leaving the demo reads the saved
 * state back as it was (lib/demo.js). The hold wraps the family lane's durable storage (durable/storage.js): while it
 * is on, writes and removals are skipped and a read finds nothing, so neither a save another tab makes (its `storage`
 * event rehydrates this store) nor the copy on the device read at boot replaces the demo in this tab.
 */
let saving = true;
export const holdSaving = (hold) => { saving = !hold; };
export const savingHeld = () => !saving;
const heldStorage = {
  getItem: (name) => (saving ? durableStorage.getItem(name) : null),
  setItem: (name, value) => (saving ? durableStorage.setItem(name, value) : undefined),
  removeItem: (name) => (saving ? durableStorage.removeItem(name) : undefined),
};

/** A new device's saved state ("delete all" puts it back whole: lib/wipe.js). */
export const empty = {
  // { role: 'student', name, grade, classCode?, className?, teacherName?, token?, studentId? }
  // | { role: 'teacher', name, grade, classes: [{ code, key: string|null, className, grade, owned?: boolean, fresh?: boolean, createdHere?: boolean, bindLater?: 'YYYY-MM-DD', pilot?: {...} }], active, demo?: true }
  // A teacher's email is never kept here: it is read from the signed-in session (lib/parent.js).
  profile: null,
  progress: {}, // topicId -> { level, max }
  // 'YYYY-MM-DD' -> { q, ok, secs (answer time), tsecs (time on learning screens, lib/learnClock.js: never makes a day
  // active), lessons, stages (teaching stages finished), mp (passed mastery checks), xp, combo, perfect, reviews,
  // missionDone (today's mission finished: the daily quest), frozen (true: a freeze; 'repair': an earned repair),
  // questsRewarded } (planLessons: written by the retired improvement plan, read by nothing any more)
  days: {},
  xp: 0, // always the sum of xpBy: every XP write goes through addXp (lib/durable/xp.js)
  xpBy: {}, // device tag -> XP earned on that device
  resetAt: null, // when the progress was last reset on purpose (ISO)
  path: {}, // topicId -> { parts: { level: practice lessons }, reviews, jumped, done: { level: 'mastered' | 'kept' } } (lib/path.js)
  freezes: 0, // streak freezes ready to use (at most 2), earned by finishing the daily quests
  streak: { lastRepair: null }, // the day of the last earned repair ('YYYY-MM-DD'), at most one in 30 days (lib/streak.js)
  // one-time notes already seen: the repair card closed today (repairDismissed: day), the week a new best was shown
  // (pbWeek: its Sunday). Later items add their own keys here; a missing key reads as not seen.
  // goalSeen: { [week]: day } the class goal's moment was shown for that week (STUDENT-4), at most 8 weeks kept
  // installOffers / installDismissedAt: how often the install was offered after a lesson, and the day of the last offer,
  // which counts as set aside unless the app got installed (STUDENT-10, lib/install.js). They belong to the device: a
  // progress reset keeps them.
  // pushOffered: the daily reminder's card after a lesson was shown (STUDENT-11, once ever; a progress reset keeps it)
  nudges: { repairDismissed: null, pbWeek: null, goalSeen: {}, installOffers: 0, installDismissedAt: null, pushOffered: false, storeOpenDay: null },
  // the opt-in daily reminder (STUDENT-11, lib/push.js): on, the hour (16-20), the id and secret the server gave once,
  // 'paused' when the server stopped it because it did not help, and the days already told to the server (opened,
  // learned). It belongs to the device: a progress reset keeps it; deleting everything or signing out turns it off.
  reminder: { on: false, slot: 17, id: null, secret: null, state: null, seenDay: null, doneDay: null },
  goalXp: 20, // daily goal in XP
  sound: true, // short sounds; off from the start for a student who joins a class and never chose (quietForClass)
  haptics: true, // short vibrations where the phone can (lib/sound.js haptic), never under reduced motion
  // theme: 'system' (follow the phone) | 'light' | 'dark' (lib/theme.js); soundSet: the student chose sound themselves.
  // New fields come with defaults (an old save without one reads it as missing, which code treats as the default).
  prefs: { theme: 'system', soundSet: false },
  // Madi's look (STUDENT-3, lib/wardrobe.js): his colour and one item per slot; the pieces earned for good, the ones
  // the student was shown, and the day each was earned (for the Sunday recap)
  look: emptyLook(),
  mistakes: {}, // 'topic:cat' -> count
  lastTopic: null,
  outbox: [],
  // the class goal of the week (STUDENT-4), for a student in a class only: the steps not sent yet ({ sid, at, pts },
  // at most 200; lib/api.js syncNow sends them), and the weeks the server reported ({ [week]: { target, have, mine,
  // reached } }, at most 8), which the wardrobe's class scarf and the Sunday recap read
  stepsOut: [],
  classGoals: {},
  // the tutor on this device (lib/durable/migrations.js says what each field is), and whether the introduction to the
  // tutor was read here (introSeen: read as `=== true`, so a state saved before it existed shows the introduction once;
  // trust spec TRUST-4 §4.6, no version of its own)
  // consentAt: the store build's AI permission (STUDENT-12, lib/aiConsent.js), an ISO time; '' until it is given. Like
  // introSeen, a default only (no version of its own)
  ai: { ...AI_DEFAULTS, introSeen: false, consentAt: '' },
  // this device's tag and save prompts; the tag is made by the v5 migration, on sign-out, or with a new device's first XP
  durable: { ...DURABLE_DEFAULTS },
  backup: { ...BACKUP_DEFAULTS }, // the backup of this student's progress, off until it is turned on
  helpSent: 0,
  solveMode: 'answer', // 'answer' (keypad) or 'notebook' (write the working on a squared page)
  exams: [], // checked exams, newest first: { id, at, title, source, practiceId, result, score, levels }
  practiceExams: [], // printable practice exams with their answer key
  // the retired improvement plan's baselines and counts (CURRICULUM-7): nothing writes them any more. Older saves keep
  // theirs until a DURABLE migration drops the fields; a reset or a sign-out clears them.
  planBase: {},
  wins: {},
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
/** Class exams a teacher keeps on a device (the merge between tabs and devices keeps as many: durable/merge.js). */
export const TEACHER_EXAMS = TEACHER_EXAMS_KEEP;

/** A class student's answers waiting for the server, at most (the oldest give way first). */
export const OUTBOX_MAX = OUTBOX_KEEP;
/** Time on learning screens counted for one day, at most (4 hours). */
export const LEARN_SECS_MAX = 4 * 3600;
/** What the class server stores of an answer (worker saveProgress), and all the outbox keeps of it. */
export const toWire = (e) => ({ id: e.id, topic: e.topic, level: e.level, ok: e.ok, first: e.first, hint: e.hint, cat: e.cat, secs: e.secs, at: e.at });

/** How many class-goal steps wait on the device, and how many weeks of the class goal (and of its moment) are kept. */
export const STEPS_MAX = 200;
export const GOAL_WEEKS = 8;

/** A random UUID (v4): the id of a class-goal step, so the server counts each step once (crypto.randomUUID where there is one). */
export function uuid() {
  const c = globalThis.crypto;
  if (typeof c?.randomUUID === 'function') return c.randomUUID();
  const b = c.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/**
 * A finished item's step for the class goal (STUDENT-4): a lesson, a teaching stage, a check or the placement is 1, a
 * passed mastery check 3. Queued only for a student in a class (profile.token); a solo student's device keeps none.
 */
function withStep(st, pts) {
  const out = st.stepsOut || [];
  if (!st.profile?.token) return out;
  return [...out, { sid: uuid(), at: new Date().toISOString(), pts }].slice(-STEPS_MAX);
}
/** The newest n weeks of a { [week]: … } map. */
const lastWeeks = (map, n = GOAL_WEEKS) => Object.fromEntries(Object.entries(map || {}).sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0)).slice(0, n));

/** The saved-state key (a staging copy on the same address keeps its own); the parent session lives beside it. */
export { STORE_KEY };
/** A personal Claude key is compiled in only for the owner's own local testing (VITE_ALLOW_PERSONAL_KEY=1); no public build has it. */
export const PERSONAL_KEY = import.meta.env.VITE_ALLOW_PERSONAL_KEY === '1';

/**
 * Saved data from an older version, brought up to date (the steps and why each exists: lib/durable/migrations.js).
 * Unknown or broken saved data falls back to the defaults. `personal`: this build can use a personal Claude key.
 */
export function migrateState(saved, version, { personal = PERSONAL_KEY } = {}) {
  return migrate(saved, version, { personal });
}

/**
 * Saved state over the defaults. zustand's own merge is shallow: a saved `learn` would replace emptyLearn() whole, so a
 * save from before a new learn field (floor, challenges: curriculum stage 1) would come back without it, and migrate
 * does not run for a save already at this version. The learn fields are merged one level deeper instead. With nothing
 * read (a first visit, or saving held by the demo class: heldStorage reads nothing) the learn in memory stays, with any
 * missing part added.
 */
export const mergeSaved = (saved, cur) => {
  const s = saved && typeof saved === 'object' ? saved : {};
  const learn = s.learn && typeof s.learn === 'object' ? s.learn : cur?.learn;
  return { ...cur, ...s, learn: { ...emptyLearn(), ...(learn && typeof learn === 'object' ? learn : {}) } };
};

/**
 * The store's state and actions, without the saving around them: useApp below wraps it in persist; the tests of the
 * merges between tabs make two stores of it on one storage (durable/tabs.test.js).
 */
export const appState = (set, get) => ({
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
      addExam: (exam) => set({ exams: [exam, ...get().exams].slice(0, EXAMS_KEEP), gaps: gapsFromExam(get().gaps, exam) }),
      removeExam: (id) => set({ exams: get().exams.filter((e) => e.id !== id) }),
      addPracticeExam: (pe) => set({ practiceExams: [pe, ...get().practiceExams].slice(0, PRACTICE_EXAMS_KEEP) }),
      /** A new class exam (TEACHER-3): first in the list, and the oldest beyond TEACHER_EXAMS goes. */
      addTeacherExam: (te) => set({ teacherExams: [te, ...(get().teacherExams || []).filter((x) => x.id !== te.id)].slice(0, TEACHER_EXAMS) }),
      updateTeacherExam: (id, patch) => set({ teacherExams: (get().teacherExams || []).map((x) => (x.id === id ? { ...x, ...patch } : x)) }),
      setLevel: (topicId, level, max) => set({
        progress: { ...get().progress, [topicId]: { level, max: Math.max(max, get().progress[topicId]?.max || 1) } },
        lastTopic: topicId,
      }),
      recordAnswer: (event, xpGain) => {
        const d = today(); const cur = get().days[d] || { q: 0, ok: 0, secs: 0 };
        const mistakes = { ...get().mistakes };
        if (event.cat && !event.ok) mistakes[`${event.topic}:${event.cat}`] = (mistakes[`${event.topic}:${event.cat}`] || 0) + 1;
        set({
          // lessons: 0 marks a day of this version: answers alone do not keep the streak, a finished lesson does
          days: { ...get().days, [d]: { ...cur, lessons: cur.lessons ?? 0, q: (cur.q || 0) + 1, ok: (cur.ok || 0) + (event.ok ? 1 : 0), secs: (cur.secs || 0) + Math.min(event.secs || 0, 300) } },
          ...addXp(get(), xpGain),
          mistakes,
          gaps: noteGap(get().gaps, event),
          // a class student's answer waits here until the server has it; its id makes a resent answer count once
          outbox: get().profile?.token ? [...get().outbox, toWire({ ...event, id: randomHex(6) })].slice(-OUTBOX_MAX) : get().outbox,
          learn: learnAfterAnswer(get().learn, event),
        });
      },
      /**
       * Time on learning screens (lib/learnClock.js flushes it): added to days[day].tsecs, at most LEARN_SECS_MAX a day.
       * Only the report reads it (learn/report.ts: minutes on learning screens); it never makes a day active.
       */
      addLearnTime: (day, secs) => {
        const add = Math.floor(Number(secs) || 0);
        if (add <= 0 || typeof day !== 'string') return;
        const cur = get().days[day] || {};
        const tsecs = Math.min(LEARN_SECS_MAX, (cur.tsecs || 0) + add);
        if (tsecs === (cur.tsecs || 0)) return;
        set({ days: { ...get().days, [day]: { ...cur, tsecs } } });
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
        // passed mastery checks per day: the weekly best counts them as 3 steps (lib/streak.js weekSteps)
        if (r.purpose === 'mastery' && r.passed) day.mp = (cur.mp || 0) + 1;
        const { days, streak, streakRepaired } = withRepair(st, d, { ...st.days, [d]: day });
        const learn = learnAfterCheck(st.learn, r, new Date().toISOString(), d);
        let { path, progress } = st; let stairDone = false; let chestOpened = false; let reopened = false;
        if (r.purpose === 'mastery' && r.passed && r.topic && r.level && TOPIC[r.topic]) {
          const chestBefore = chestOpen(r.topic, path);
          ({ path, stairDone } = markMastered(path, r.topic, r.level));
          chestOpened = !chestBefore && chestOpen(r.topic, path);
          // the topic's level is the next stair the path leads to; a guest stair of the student's grade (learn/skills.ts
          // GUEST, eq:6 for ח׳) is climbed without the unit's first stairs, so its unit's level is the stair after it:
          // the level the class sync sends, and the teacher's guest row moves (content/index.js rowLevel)
          const top = TOPIC[r.topic].levels.length; const p = progress[r.topic] || { level: 1, max: 1 };
          const guestNext = guestSkillsOf(st.profile?.grade).includes(`${r.topic}:${r.level}`) ? r.level + 1 : 0;
          const level = Math.min(top, Math.max(p.level, reachedUpTo(r.topic, path) + 1, guestNext));
          progress = { ...progress, [r.topic]: { level, max: Math.max(p.max, level) } };
        } else if (r.purpose === 'mastery' && !r.passed && r.topic && r.level && TOPIC[r.topic]) {
          // a stair kept from before mastery checks stays done only until its check says otherwise
          const before = path;
          path = reopenKept(path, r.topic, r.level);
          reopened = path !== before;
        }
        // what the path unlocks for Madi is earned for good, before this check (a kept stair it reopens) and after it
        const look = earnIds(st.look, [...lookIds(st, st.path), ...lookIds(st, path)], d, { seen: false });
        const stepsOut = withStep(st, r.purpose === 'mastery' && r.passed ? 3 : 1);
        // the floor check is about the fractions floor, not practice in it: the map's "where I am" stays where it was
        set({ learn, days, streak, ...addXp(st, r.xp || 0), path, progress, lastTopic: r.purpose === 'floor' ? st.lastTopic : r.topic || st.lastTopic, look, stepsOut });
        remindLearned(get());
        return { streakExtended: !learnedOn(cur), streakRepaired, streak: streakOf(days), goalReached: !goalBefore && day.xp >= st.goalXp, stairDone, chestOpened, reopened, done: r.topic && TOPIC[r.topic] ? doneCount(r.topic, path) : null };
      },
      learnEvent: (e) => set({ learn: { ...get().learn, events: logEvent(get().learn.events, e, new Date().toISOString()) } }),
      /**
       * The student's own say over the floor (Topics → יסודות לחיזוק): { on: false } takes the bridge unit off the map.
       * The evidence of the floor check stays; a later check that misses a fractions question puts the unit back.
       * Only an existing record changes: with no floor check there is nothing to switch.
       */
      setFloor: (patch) => {
        const L = get().learn; const floor = L.floor ?? null;
        if (!floor) return;
        set({ learn: { ...L, floor: { ...floor, ...patch } } });
      },
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
        const { days, streak, streakRepaired } = withRepair(st, d, { ...st.days, [d]: day });
        const topic = skill.split(':')[0];
        set({
          days, streak, ...addXp(st, xp), freezes: Math.min(2, st.freezes + (freezeEarned ? 1 : 0)), lastTopic: TOPIC[topic] ? topic : st.lastTopic,
          learn: { ...L, skills: { ...L.skills, [skill]: markTaughtRec(L.skills[skill], stage, at) }, events: logEvent(L.events, { e: `stage-${stage}`, s: skill }, at) },
          stepsOut: withStep(st, 1),
        });
        remindLearned(get());
        return { xp, first, streakExtended: !learnedOn(cur), streakRepaired, streak: streakOf(days), goalReached: !goalBefore && day.xp >= st.goalXp, questsDone, freezeEarned };
      },
      /** Where the student is inside a teaching stage, so leaving keeps the place. */
      setStagePos: (skill, stage, i) => { const L = get().learn; const r = L.skills[skill] || { attempts: [] }; set({ learn: { ...L, skills: { ...L.skills, [skill]: { ...r, pos: { ...(r.pos || {}), [stage]: i } } } } }); },
      startRepair: (skill, misc) => { const L = get().learn; const at = new Date().toISOString(); set({ learn: { ...L, miscon: startRepairRec(L.miscon, skill, misc, today(), at), events: logEvent(L.events, { e: 'repair-start', s: skill, m: misc }, at) } }); },
      saveMission: (day, items) => { const L = get().learn; const keep = Object.fromEntries(Object.entries(L.missions).filter(([d]) => d >= dayBefore(dayBefore(day)))); set({ learn: { ...L, missions: { ...keep, [day]: { items } } } }); },
      /**
       * A finished activity ticks its item of today's mission. When that finishes the mission, the day records it
       * (days[d].missionDone: the daily quest "השלימו את המשימה שלי להיום"), and when that quest is the day's last, the
       * chest opens here (a streak freeze, as completeLesson does). Returns what to celebrate: { questsDone, freezeEarned }.
       */
      completeMission: (done) => {
        const st = get(); const L = st.learn; const d = today(); const m = L.missions[d];
        if (!m) return { questsDone: false, freezeEarned: false };
        const items = completeMissionItems(m.items, done, new Date().toISOString());
        const patch = { learn: { ...L, missions: { ...L.missions, [d]: { items } } } };
        const cur = st.days[d] || {};
        let questsDone = false; let freezeEarned = false;
        if (missionDone(items) && !cur.missionDone) {
          const questsBefore = questProgress(d, cur).every((q) => q.done);
          const day = { ...cur, missionDone: 1 };
          questsDone = !questsBefore && questProgress(d, day).every((q) => q.done);
          freezeEarned = questsDone && !cur.questsRewarded && st.freezes < 2;
          if (questsDone) day.questsRewarded = true;
          patch.days = { ...st.days, [d]: day };
          patch.freezes = Math.min(2, st.freezes + (freezeEarned ? 1 : 0));
        }
        set(patch);
        return { questsDone, freezeEarned };
      },
      /**
       * A challenge task opened (CURRICULUM-6): its record starts once (a second visit keeps the first start), and the
       * analytics event says which task, never any text.
       */
      startChallenge: (id) => {
        const L = get().learn; const at = new Date().toISOString(); const all = L.challenges ?? {};
        set({ learn: { ...L, challenges: all[id] ? all : { ...all, [id]: { startedAt: at, firstTry: 0, parts: 0 } }, events: logEvent(L.events, { e: 'challenge-start', m: id }, at) } });
      },
      /**
       * A challenge task finished: { firstTry, parts } counts the scored parts and those right on the first try (explain
       * parts are not among them). The first finish earns 20 XP and 5 per first-try part (at most 40), and counts for the
       * day like a lesson (days[d].lessons and its XP, for the streak, the daily goal and the quests); a second finish earns
       * nothing. It never touches mastery: learn.skills and the checks are left as they are. The analytics event carries
       * the share right on the first try (n), and no text. The finish is reported to today's mission (Done.kind
       * 'challenge'): it ticks that task's item, and when that finishes the mission, its quest (and maybe the chest).
       * Returns what to celebrate.
       */
      finishChallenge: (id, result) => {
        const st = get(); const L = st.learn; const at = new Date().toISOString(); const all = L.challenges ?? {};
        const task = challengeById(id);
        const toMission = (out) => {
          const m = get().completeMission({ kind: 'challenge', challengeId: id, ...(task ? { skill: task.after } : {}) });
          return { ...out, questsDone: out.questsDone || m.questsDone, freezeEarned: out.freezeEarned || m.freezeEarned };
        };
        const firstTry = Math.max(0, result?.firstTry || 0); const parts = Math.max(0, result?.parts || 0);
        const n = parts ? firstTry / parts : 0;
        if (all[id]?.doneAt) {
          set({ learn: { ...L, events: logEvent(L.events, { e: 'challenge-done', m: id, n }, at) } });
          return toMission({ xp: 0, again: true, streakExtended: false, streak: streakOf(st.days), goalReached: false, questsDone: false, freezeEarned: false });
        }
        const xp = challengeXP(firstTry);
        const d = today(); const cur = st.days[d] || {};
        const questsBefore = questProgress(d, cur).every((q) => q.done);
        const goalBefore = (cur.xp || 0) >= st.goalXp;
        const day = { ...cur, lessons: (cur.lessons || 0) + 1, xp: (cur.xp || 0) + xp };
        const questsDone = !questsBefore && questProgress(d, day).every((q) => q.done);
        const freezeEarned = questsDone && !cur.questsRewarded && st.freezes < 2;
        if (questsDone) day.questsRewarded = true;
        // like a lesson: the streak's repair (main's lib/streak.js), every XP write through addXp, a class goal step, and
        // the daily reminder is told that today was learned (STUDENT-11)
        const { days, streak, streakRepaired } = withRepair(st, d, { ...st.days, [d]: day });
        const rec = { startedAt: all[id]?.startedAt || at, doneAt: at, firstTry, parts };
        set({
          days, streak, ...addXp(st, xp), freezes: Math.min(2, st.freezes + (freezeEarned ? 1 : 0)), stepsOut: withStep(st, 1),
          learn: { ...L, challenges: { ...all, [id]: rec }, events: logEvent(L.events, { e: 'challenge-done', m: id, n }, at) },
        });
        remindLearned(get());
        return toMission({ xp, again: false, streakExtended: !learnedOn(cur), streakRepaired, streak: streakOf(days), goalReached: !goalBefore && day.xp >= st.goalXp, questsDone, freezeEarned });
      },
      setExam: (input) => { const L = get().learn; const at = new Date().toISOString(); set({ learn: { ...L, exam: input ? newPlan(input, at) : null, events: input ? logEvent(L.events, { e: 'rescue-created' }, at) : L.events } }); },
      recordExamDiagnostic: (skill, right, asked) => { const L = get().learn; if (!L.exam) return; set({ learn: { ...L, exam: recordDiagnostic(L.exam, skill, right, asked, new Date().toISOString()) } }); },
      addXP: (n) => set(addXp(get(), n)),
      setGoalXp: (goalXp) => set({ goalXp }),
      setSound: (sound) => set({ sound, prefs: { ...get().prefs, soundSet: true } }),
      setHaptics: (haptics) => set({ haptics }),
      /** Joining a class: sounds start off (a classroom is quiet), unless the student already chose them. */
      quietForClass: () => { if (!get().prefs?.soundSet) set({ sound: false }); },
      setTheme: (theme) => { set({ prefs: { ...get().prefs, theme } }); applyTheme(theme); },
      /** Madi's look: { color } or { head | face | neck | body: id | null }. Saved at once (the wardrobe has no save button). */
      setLook: (patch) => set({ look: { ...emptyLook(), ...get().look, ...patch } }),
      /** Pieces earned for good and shown to the student (the unlock moment); { seen: false } only remembers them. */
      markEarned: (ids, opts) => set({ look: earnIds(get().look, ids, today(), opts) }),
      /** A one-time note was seen: e.g. { repairDismissed: today() } or { pbWeek: '2026-11-01' }. */
      setNudge: (patch) => set({ nudges: { ...get().nudges, ...patch } }),
      /** The daily reminder's state (lib/push.js writes it). */
      setReminder: (patch) => set({ reminder: { ...empty.reminder, ...get().reminder, ...patch } }),
      /**
       * A finished lesson: XP, today's counters, the path, the topic level, and the daily quests.
       * Returns what to celebrate: { streakExtended, streakRepaired, streak, practiceDone, unitDone, questsDone, freezeEarned, goalReached }.
       * Practice never marks a stair done (only its mastery check does): practiceDone says the check is next.
       */
      completeLesson: (r) => {
        const st = get(); const d = today(); const cur = st.days[d] || {};
        const questsBefore = questProgress(d, cur).every((q) => q.done);
        const goalBefore = (cur.xp || 0) >= st.goalXp;
        const day = {
          ...cur, lessons: (cur.lessons || 0) + 1, xp: (cur.xp || 0) + r.xp, combo: Math.max(cur.combo || 0, r.bestCombo || 0),
          perfect: (cur.perfect || 0) + (r.perfect ? 1 : 0), reviews: (cur.reviews || 0) + (r.kind === 'review' ? 1 : 0),
        };
        const questsDone = !questsBefore && questProgress(d, day).every((q) => q.done);
        const freezeEarned = questsDone && !cur.questsRewarded && st.freezes < 2;
        if (questsDone) day.questsRewarded = true;
        // multiplication facts (/facts) are a lesson of the day (XP, streak, quests) on no stair: no path, no topic level
        if (r.kind === 'facts') {
          const { days, streak, streakRepaired } = withRepair(st, d, { ...st.days, [d]: day });
          set({ days, streak, ...addXp(st, r.xp), freezes: Math.min(2, st.freezes + (freezeEarned ? 1 : 0)), stepsOut: withStep(st, 1) });
          remindLearned(get());
          return { streakExtended: !learnedOn(cur), streakRepaired, streak: streakOf(days), practiceDone: false, unitDone: false, questsDone, freezeEarned, goalReached: !goalBefore && day.xp >= st.goalXp };
        }
        const { path, practiceDone, unitDone } = recordOnPath(st.path, r);
        // The topic level follows the path: a passed jump test moves it on (a stair's own move is its mastery check).
        const p = st.progress[r.topic] || { level: 1, max: 1 };
        let level = p.level; let max = p.max;
        if (r.kind === 'jump' && r.passed) { level = Math.max(level, r.level); max = Math.max(max, r.level); }
        const { days, streak, streakRepaired } = withRepair(st, d, { ...st.days, [d]: day });
        set({
          days, streak, path, ...addXp(st, r.xp), freezes: Math.min(2, st.freezes + (freezeEarned ? 1 : 0)),
          progress: { ...st.progress, [r.topic]: { level, max } }, lastTopic: r.topic, stepsOut: withStep(st, 1),
        });
        remindLearned(get());
        return { streakExtended: !learnedOn(cur), streakRepaired, streak: streakOf(days), practiceDone, unitDone, questsDone, freezeEarned, goalReached: !goalBefore && day.xp >= st.goalXp };
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
        set({ path, progress, days, ...addXp(st, r.xp), placement: { at: new Date().toISOString(), grade: r.grade, results: r.results }, stepsOut: withStep(st, 1) });
        return { streakExtended: !learnedOn(cur), streak: streakOf(days), goalReached: !goalBefore && day.xp >= st.goalXp };
      },
      /** On opening the app: spend freezes on missed days so the streak survives (at most two). */
      settleStreak: () => {
        const st = get(); if (!st.freezes) return 0;
        const days = { ...st.days }; let key = dayBefore(today()); const missed = [];
        while (missed.length <= st.freezes && !active(days[key]) && !days[key]?.frozen) { if (!isRestDay(key)) missed.push(key); key = dayBefore(key); }
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
      /**
       * The server has these class-goal steps (by sid, STUDENT-4): they leave the queue. Like the answers' outbox
       * (DURABLE-7), a step leaves only once a sync that carried it got its answer, so a closed page loses none; the
       * server counts each sid once, so sending one again is harmless.
       */
      ackSteps: (sids) => {
        const done = new Set(sids);
        if (done.size) set({ stepsOut: (get().stepsOut || []).filter((x) => !done.has(x.sid)) });
      },
      /**
       * The class goal as the server sent it (GET /api/class/goal): this week and the one before go into classGoals (8
       * weeks kept). A week the class reached with this student's part earns the class scarf for good (look.earned
       * outlives the cache); it stays unseen until the goal's moment, or the unlock moment, shows it.
       */
      setClassGoal: (g) => {
        if (!g?.on || !g.week) return;
        const st = get();
        const weeks = { ...(st.classGoals || {}) };
        for (const w of [g.last, g]) if (w?.week) weeks[w.week] = { target: w.target, have: w.have, mine: w.mine, reached: !!w.reached };
        const classGoals = lastWeeks(weeks);
        const earned = Object.values(classGoals).some((w) => w.reached && w.mine > 0);
        const look = earned ? earnIds(st.look, ['class-scarf'], today(), { seen: false }) : st.look;
        if (look === st.look && JSON.stringify(classGoals) === JSON.stringify(lastWeeks(st.classGoals))) return;
        set({ classGoals, look });
      },
      /** The class goal's moment was shown for this week: it never comes again for it. */
      markGoalSeen: (week) => {
        const n = get().nudges || {};
        set({ nudges: { ...n, goalSeen: lastWeeks({ ...(n.goalSeen || {}), [week]: today() }) } });
      },
      leaveClass: () => {
        const p = get().profile; if (!p) return;
        const { classCode, className, teacherName, token, studentId, ...rest } = p;
        set({ profile: rest, outbox: [], stepsOut: [], classWork: emptyClassWork(), workOutbox: {} });
      },
      // a reset on purpose: its time travels with the progress, so a later merge cannot bring the old progress back
      // Madi's look, the streak's repair and the class goal go with the progress; the install offers, the store-open day and
      // the daily reminder stay (the device's)
      resetProgress: () => set({
        progress: {}, days: {}, xp: 0, xpBy: {}, resetAt: new Date().toISOString(), mistakes: {}, lastTopic: null, outbox: [], stepsOut: [], classGoals: {},
        exams: [], practiceExams: [], planBase: {}, wins: {}, path: {}, freezes: 0, streak: { lastRepair: null },
        nudges: {
          ...empty.nudges, goalSeen: {}, installOffers: get().nudges?.installOffers || 0, installDismissedAt: get().nudges?.installDismissedAt || null,
          pushOffered: !!get().nudges?.pushOffered, storeOpenDay: get().nudges?.storeOpenDay || null,
        },
        gaps: {}, placement: null, learn: emptyLearn(), look: emptyLook(),
      }),
      // the device keeps its id, its family-device link and its tutor settings; a waiting link code does not survive
      // ("delete all" is lib/wipe.js: the server first, then every key of the app).
      // The next student here gets a new device tag (their XP is counted apart) and no backup; what the browser was
      // asked, and the install hint, belong to the device and stay. The theme chosen for this device (prefs) stays too;
      // Madi's look belongs to the student and goes back to the default; sound goes back to its default, so the next
      // student's own choice starts unset (soundSet). The family link stays, but the parents' summary notice was seen by
      // the last student, not the next one: it shows again before anything is sent, and what was sent is forgotten here
      // (PARENTS-4). `earlier` remembers that summaries went from this device before, so the next student is told they
      // stay with the parents.
      signOut: () => {
        const { persistAsked, installHintAt } = get().durable || {};
        const fd = get().ai?.familyDevice;
        set({
          ...empty, xpBy: {}, learn: emptyLearn(), look: emptyLook(), classWork: emptyClassWork(), workOutbox: {}, ai: { ...get().ai, pendingLink: null, lastTier: null, familyDevice: fd ? { ...fd, sharingSeen: null, lastSent: null, earlier: !!(fd.lastSent || fd.earlier) } : null },
          prefs: { ...get().prefs, soundSet: false },
          durable: { ...DURABLE_DEFAULTS, persistAsked: persistAsked ?? null, installHintAt: installHintAt ?? null, tag: newTag() }, backup: { ...BACKUP_DEFAULTS },
          // a sign-out clears the progress on purpose, like a reset: another tab still open cannot bring it back
          resetAt: new Date().toISOString(),
        });
      },
});

/** How the store is saved: under STORE_KEY, at CURRENT_VERSION, migrated from older saves, learn merged a level deeper. */
export const persistOptions = (storage) => ({ name: STORE_KEY, storage, version: CURRENT_VERSION, migrate: (saved, version) => migrateState(saved, version), merge: mergeSaved });

// VITE_STORE_KEY lets a staging copy on the same web address keep its own saved state (production: 'madregot').
// Saved through the safe write path (lib/durable/storage.js): one write per tick, the copy on the device, quarantine,
// and the merge with another tab's writes (durable/tabs.js).
export const useApp = create(persist(appState, persistOptions(heldStorage)));
// a restore from the copy on the device loads into this store
bindDurableStore(useApp);

/**
 * A finished lesson, check or teaching stage tells the daily reminder's server that today was learned, so no reminder
 * comes today (STUDENT-11): once a day, only while the reminder is on, and lib/push.js loads only then.
 */
function remindLearned(st) {
  const r = st.reminder;
  if (!r?.on || r.doneDay === today()) return;
  import('./push.js').then((mod) => mod.markDone()).catch(() => { /* told on the next finished item */ });
}
/** The pieces a path unlocks for Madi (lib/wardrobe.js). */
const lookIds = (st, path) => unlockedIds(unlockedLook({ path, classGoals: st.classGoals, grade: st.profile?.grade }));

/**
 * The finished item that makes today the second (or later) one may earn the streak's repair (lib/streak.js
 * streakRepair): the missed school day is saved as frozen: 'repair', and lastRepair is today.
 */
function withRepair(st, d, days) {
  const r = streakRepair(st.days, d, st.streak?.lastRepair);
  if (!r || itemsOn(days[d]) < 2) return { days, streak: st.streak, streakRepaired: false };
  return { days: { ...days, [r.gap]: { ...(days[r.gap] || {}), frozen: 'repair' } }, streak: { ...st.streak, lastRepair: d }, streakRepaired: true };
}

export const activeToday = (days) => active(days[today()]);

export const minutesToday = (days) => Math.floor((days[today()]?.secs || 0) / 60);
