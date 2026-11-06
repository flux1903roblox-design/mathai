import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { TOPIC } from '@/content/index.js';
import { recordOnPath } from './path.js';
import { questProgress } from './quests.js';

export const today = (d = new Date()) => d.toLocaleDateString('en-CA');
export const dayBefore = (key) => { const d = new Date(`${key}T12:00:00`); d.setDate(d.getDate() - 1); return today(d); };

const safeStorage = createJSONStorage(() => {
  try { localStorage.setItem('__t', '1'); localStorage.removeItem('__t'); return localStorage; } catch {
    const mem = new Map();
    return { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) };
  }
});

const empty = {
  profile: null, // { role: 'student', name, grade, classCode?, className?, teacherName?, token?, studentId? } | { role: 'teacher', name, classes: [], active }
  progress: {}, // topicId -> { level, max }
  days: {}, // 'YYYY-MM-DD' -> { q, ok, secs, lessons, xp, combo, perfect, reviews, planLessons, frozen, questsRewarded }
  xp: 0,
  path: {}, // topicId -> { parts: { level: lessonsDone }, reviews, jumped }
  freezes: 0, // streak freezes ready to use (at most 2), earned by finishing the daily quests
  goalXp: 20, // daily goal in XP
  sound: true,
  mistakes: {}, // 'topic:cat' -> count
  lastTopic: null,
  outbox: [],
  ai: { mode: 'server', apiUrl: '', key: '' },
  helpSent: 0,
  solveMode: 'answer', // 'answer' (keypad) or 'notebook' (write the working on a squared page)
  exams: [], // checked exams, newest first: { id, at, title, source, practiceId, result, score, levels }
  practiceExams: [], // printable practice exams with their answer key
  planBase: {}, // topic -> { level, wins, at }: the focus level and wins counted there when the plan step started
  wins: {}, // 'topic:level' -> correct answers at that level
};

export const useApp = create(
  persist(
    (set, get) => ({
      ...empty,
      setProfile: (profile) => set({ profile }),
      patchProfile: (patch) => set({ profile: { ...get().profile, ...patch } }),
      setAI: (patch) => set({ ai: { ...get().ai, ...patch } }),
      setSolveMode: (solveMode) => set({ solveMode }),
      addExam: (exam) => set({ exams: [exam, ...get().exams].slice(0, 30) }),
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
          days: { ...get().days, [d]: { ...cur, q: (cur.q || 0) + 1, ok: (cur.ok || 0) + (event.ok ? 1 : 0), secs: (cur.secs || 0) + Math.min(event.secs || 0, 300) } },
          xp: get().xp + xpGain,
          mistakes,
          wins,
          outbox: get().profile?.token ? [...get().outbox, event].slice(-500) : get().outbox,
        });
      },
      addXP: (n) => set({ xp: get().xp + n }),
      setGoalXp: (goalXp) => set({ goalXp }),
      setSound: (sound) => set({ sound }),
      /**
       * A finished lesson: XP, today's counters, the path, the topic level, and the daily quests.
       * Returns what to celebrate: { streakExtended, streak, nodeDone, unitDone, questsDone, freezeEarned, goalReached }.
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
        const { path, nodeDone, unitDone } = recordOnPath(st.path, r);
        // The topic level follows the path: a finished node opens the next level.
        const t = TOPIC[r.topic]; const top = t.levels.length; const p = st.progress[r.topic] || { level: 1, max: 1 };
        let level = p.level; let max = p.max;
        if (nodeDone) { level = Math.min(top, Math.max(level, r.level + 1)); max = Math.max(max, level); }
        if (r.kind === 'jump' && r.passed) { level = Math.max(level, r.level); max = Math.max(max, r.level); }
        const days = { ...st.days, [d]: day };
        set({
          days, path, xp: st.xp + r.xp, freezes: Math.min(2, st.freezes + (freezeEarned ? 1 : 0)),
          progress: { ...st.progress, [r.topic]: { level, max } }, lastTopic: r.topic,
        });
        return { streakExtended: !(cur.lessons > 0), streak: streakOf(days), nodeDone, unitDone, questsDone, freezeEarned, goalReached: !goalBefore && day.xp >= st.goalXp };
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
        set({ profile: rest, outbox: [] });
      },
      resetProgress: () => set({ progress: {}, days: {}, xp: 0, mistakes: {}, lastTopic: null, outbox: [], exams: [], practiceExams: [], planBase: {}, wins: {}, path: {}, freezes: 0 }),
      signOut: () => set({ ...empty, ai: get().ai }),
    }),
    { name: 'madregot', storage: safeStorage, version: 1 },
  ),
);

/** A day counts for the streak with one finished lesson (or answers saved before lessons existed). */
const active = (d) => !!d && ((d.lessons || 0) > 0 || (d.lessons == null && (d.q || 0) > 0));
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
