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
import { applyTheme } from './theme.js';
import { today, dayBefore, learnedOn, isActiveDay, keptDay, streakAt, streakRepair, itemsOn } from './streak.js';
import { isRestDay } from '@shared/restDays.js';
import { emptyLook, earnIds, unlockedLook, unlockedIds } from './wardrobe.js';

export { today, dayBefore, learnedOn, isActiveDay };

const safeStorage = createJSONStorage(() => {
  try { localStorage.setItem('__t', '1'); localStorage.removeItem('__t'); return localStorage; } catch {
    const mem = new Map();
    return { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) };
  }
});

const empty = {
  profile: null, // { role: 'student', name, grade, classCode?, className?, teacherName?, token?, studentId? } | { role: 'teacher', name, classes: [], active }
  progress: {}, // topicId -> { level, max }
  // 'YYYY-MM-DD' -> { q, ok, secs, lessons, stages (teaching stages finished), mp (passed mastery checks), xp, combo,
  // perfect, reviews, planLessons, frozen (true: a freeze; 'repair': an earned repair), questsRewarded }
  days: {},
  xp: 0,
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
  // the tutor on this device: the server (or a personal key, only in builds with VITE_ALLOW_PERSONAL_KEY=1), an anonymous
  // device id, the family-device token (AI only, never the parent's session), a link code waiting for a parent, and the
  // tier the server reported last (to say once that a plan ended)
  ai: { mode: 'server', apiUrl: '', key: '', device: '', familyDevice: null /* {token, label} */, pendingLink: null /* {code, secret, expiresAt, url} */, lastTier: null, consentAt: '' /* the store build's AI permission (STUDENT-12), an ISO time */ },
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
  return st;
}

export const useApp = create(
  persist(
    (set, get) => ({
      ...empty,
      setProfile: (profile) => set({ profile }),
      patchProfile: (patch) => set({ profile: { ...get().profile, ...patch } }),
      setAI: (patch) => set({ ai: { ...get().ai, ...patch } }),
      setSolveMode: (solveMode) => set({ solveMode }),
      addExam: (exam) => set({ exams: [exam, ...get().exams].slice(0, 30), gaps: gapsFromExam(get().gaps, exam) }),
      removeExam: (id) => set({ exams: get().exams.filter((e) => e.id !== id) }),
      addPracticeExam: (pe) => set({ practiceExams: [pe, ...get().practiceExams].slice(0, 20) }),
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
        // passed mastery checks per day: the weekly best counts them as 3 steps (lib/streak.js weekSteps)
        if (r.purpose === 'mastery' && r.passed) day.mp = (cur.mp || 0) + 1;
        const { days, streak, streakRepaired } = withRepair(st, d, { ...st.days, [d]: day });
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
        // what the path unlocks for Madi is earned for good, before this check (a kept stair it reopens) and after it
        const look = earnIds(st.look, [...lookIds(st, st.path), ...lookIds(st, path)], d, { seen: false });
        const stepsOut = withStep(st, r.purpose === 'mastery' && r.passed ? 3 : 1);
        set({ learn, days, streak, xp: st.xp + (r.xp || 0), path, progress, lastTopic: r.topic || st.lastTopic, look, stepsOut });
        remindLearned(get());
        return { streakExtended: !learnedOn(cur), streakRepaired, streak: streakOf(days), goalReached: !goalBefore && day.xp >= st.goalXp, stairDone, chestOpened, reopened, done: r.topic && TOPIC[r.topic] ? doneCount(r.topic, path) : null };
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
        const { days, streak, streakRepaired } = withRepair(st, d, { ...st.days, [d]: day });
        const topic = skill.split(':')[0];
        set({
          days, streak, xp: st.xp + xp, freezes: Math.min(2, st.freezes + (freezeEarned ? 1 : 0)), lastTopic: TOPIC[topic] ? topic : st.lastTopic,
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
      completeMission: (done) => { const L = get().learn; const d = today(); const m = L.missions[d]; if (!m) return; set({ learn: { ...L, missions: { ...L.missions, [d]: { items: completeMissionItems(m.items, done, new Date().toISOString()) } } } }); },
      setExam: (input) => { const L = get().learn; const at = new Date().toISOString(); set({ learn: { ...L, exam: input ? newPlan(input, at) : null, events: input ? logEvent(L.events, { e: 'rescue-created' }, at) : L.events } }); },
      recordExamDiagnostic: (skill, right, asked) => { const L = get().learn; if (!L.exam) return; set({ learn: { ...L, exam: recordDiagnostic(L.exam, skill, right, asked, new Date().toISOString()) } }); },
      addXP: (n) => set({ xp: get().xp + n }),
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
        const { days, streak, streakRepaired } = withRepair(st, d, { ...st.days, [d]: day });
        set({
          days, streak, path, xp: st.xp + r.xp, freezes: Math.min(2, st.freezes + (freezeEarned ? 1 : 0)),
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
        set({ path, progress, days, xp: st.xp + r.xp, placement: { at: new Date().toISOString(), grade: r.grade, results: r.results }, stepsOut: withStep(st, 1) });
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
      takeOutbox: () => { const items = get().outbox; set({ outbox: [] }); return items; },
      returnOutbox: (items) => set({ outbox: [...items, ...get().outbox].slice(-500) }),
      /** The oldest n class-goal steps, taken out to send (lib/api.js syncNow); returnSteps puts them back after a failure. */
      takeSteps: (n = 50) => { const all = get().stepsOut || []; set({ stepsOut: all.slice(n) }); return all.slice(0, n); },
      returnSteps: (items) => { if (items?.length) set({ stepsOut: [...items, ...(get().stepsOut || [])].slice(-STEPS_MAX) }); },
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
        set({ profile: rest, outbox: [], stepsOut: [] });
      },
      resetProgress: () => set({ progress: {}, days: {}, xp: 0, mistakes: {}, lastTopic: null, outbox: [], stepsOut: [], classGoals: {}, exams: [], practiceExams: [], planBase: {}, wins: {}, path: {}, freezes: 0, streak: { lastRepair: null }, nudges: { ...empty.nudges, goalSeen: {}, installOffers: get().nudges?.installOffers || 0, installDismissedAt: get().nudges?.installDismissedAt || null, pushOffered: !!get().nudges?.pushOffered, storeOpenDay: get().nudges?.storeOpenDay || null }, gaps: {}, placement: null, learn: emptyLearn(), look: emptyLook() }),
      // the device keeps its id, its family-device link and its tutor settings; a waiting link code does not survive
      // the theme chosen for this device (prefs) stays too; Madi's look belongs to the student and goes back to the default
      // (sound goes back to its default, so the next student's own choice starts unset)
      signOut: () => set({ ...empty, learn: emptyLearn(), look: emptyLook(), prefs: { ...get().prefs, soundSet: false }, ai: { ...get().ai, pendingLink: null, lastTier: null } }),
    }),
    // VITE_STORE_KEY lets a staging copy on the same web address keep its own saved state (production: 'madregot')
    { name: STORE_KEY, storage: safeStorage, version: 4, migrate: (saved, version) => migrateState(saved, version) },
  ),
);

const active = isActiveDay;

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
/** A Saturday. Kept for old callers: the streak's rule is isRestDay (Shabbat and Yom Tov, shared/restDays.js). */
export const isShabbat = (key) => new Date(`${key}T12:00:00`).getDay() === 6;
export { keptDay };

/**
 * The finished item that makes today the second (or later) one may earn the streak's repair (lib/streak.js
 * streakRepair): the missed school day is saved as frozen: 'repair', and lastRepair is today.
 */
function withRepair(st, d, days) {
  const r = streakRepair(st.days, d, st.streak?.lastRepair);
  if (!r || itemsOn(days[d]) < 2) return { days, streak: st.streak, streakRepaired: false };
  return { days: { ...days, [r.gap]: { ...(days[r.gap] || {}), frozen: 'repair' } }, streak: { ...st.streak, lastRepair: d }, streakRepaired: true };
}

/** Consecutive active days ending today (or yesterday, if today has none yet). Rest days, freezes and repairs keep the chain without adding to it. */
export const streakOf = (days) => streakAt(days, today());
export const activeToday = (days) => active(days[today()]);

export const minutesToday = (days) => Math.floor((days[today()]?.secs || 0) / 60);
