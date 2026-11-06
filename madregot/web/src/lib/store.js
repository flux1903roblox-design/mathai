import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export const today = (d = new Date()) => d.toLocaleDateString('en-CA');
const dayBefore = (key) => { const d = new Date(`${key}T12:00:00`); d.setDate(d.getDate() - 1); return today(d); };

const safeStorage = createJSONStorage(() => {
  try { localStorage.setItem('__t', '1'); localStorage.removeItem('__t'); return localStorage; } catch {
    const mem = new Map();
    return { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) };
  }
});

const empty = {
  profile: null, // { role: 'student', name, grade, classCode?, className?, teacherName?, token?, studentId? } | { role: 'teacher', name, classes: [], active }
  progress: {}, // topicId -> { level, max }
  days: {}, // 'YYYY-MM-DD' -> { q, ok, secs }
  xp: 0,
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
          days: { ...get().days, [d]: { q: cur.q + 1, ok: cur.ok + (event.ok ? 1 : 0), secs: cur.secs + Math.min(event.secs || 0, 300) } },
          xp: get().xp + xpGain,
          mistakes,
          wins,
          outbox: get().profile?.token ? [...get().outbox, event].slice(-500) : get().outbox,
        });
      },
      addXP: (n) => set({ xp: get().xp + n }),
      takeOutbox: () => { const items = get().outbox; set({ outbox: [] }); return items; },
      returnOutbox: (items) => set({ outbox: [...items, ...get().outbox].slice(-500) }),
      leaveClass: () => {
        const p = get().profile; if (!p) return;
        const { classCode, className, teacherName, token, studentId, ...rest } = p;
        set({ profile: rest, outbox: [] });
      },
      resetProgress: () => set({ progress: {}, days: {}, xp: 0, mistakes: {}, lastTopic: null, outbox: [], exams: [], practiceExams: [], planBase: {}, wins: {} }),
      signOut: () => set({ ...empty, ai: get().ai }),
    }),
    { name: 'madregot', storage: safeStorage, version: 1 },
  ),
);

/** Consecutive practice days ending today (or yesterday, if today has none yet). */
export function streakOf(days) {
  let key = today();
  if (!days[key]?.q) key = dayBefore(key);
  let n = 0;
  while (days[key]?.q) { n += 1; key = dayBefore(key); }
  return n;
}

export const minutesToday = (days) => Math.floor((days[today()]?.secs || 0) / 60);
