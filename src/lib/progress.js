// Learning progress (XP, daily streak, completed lessons), kept per user in localStorage.
// Brilliant-style motivation loop: small XP for every solved step, a daily goal, a streak of active days.
import { useEffect, useState } from 'react';

export const DAILY_GOAL = 50;
const EVENT = 'mathai-progress';
const key = (uid) => `mathai_progress_${uid || 'anon'}`;
const EMPTY = { xp: 0, xpByDay: {}, lessons: {} };

// local calendar day (not UTC), so the streak follows the student's own midnight
export const dayKey = (d = new Date()) => {
  const z = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
};
const shiftDay = (k, delta) => {
  const [y, m, d] = k.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d + delta));
};

export function getProgress(uid) {
  try { return { ...EMPTY, ...(JSON.parse(localStorage.getItem(key(uid))) || {}) }; }
  catch { return { ...EMPTY }; }
}

function save(uid, p) {
  try { localStorage.setItem(key(uid), JSON.stringify(p)); } catch { /* storage full — progress is best-effort */ }
  window.dispatchEvent(new Event(EVENT));
  return p;
}

// Consecutive active days ending today — or ending yesterday (streak still alive until midnight).
export function streakOf(p) {
  const days = p.xpByDay || {};
  let k = dayKey();
  if (!days[k]) k = shiftDay(k, -1);
  let n = 0;
  while (days[k] > 0) { n += 1; k = shiftDay(k, -1); }
  return n;
}

export const todayXP = (p) => p.xpByDay?.[dayKey()] || 0;
export const isActiveToday = (p) => todayXP(p) > 0;

// Last 7 days (oldest → today) for the week strip.
export function weekActivity(p) {
  const today = dayKey();
  return Array.from({ length: 7 }, (_, i) => {
    const k = shiftDay(today, i - 6);
    return { key: k, xp: p.xpByDay?.[k] || 0, today: k === today };
  });
}

export function addXP(uid, amount) {
  if (!amount) return getProgress(uid);
  const p = getProgress(uid);
  const k = dayKey();
  return save(uid, { ...p, xp: p.xp + amount, xpByDay: { ...p.xpByDay, [k]: (p.xpByDay[k] || 0) + amount } });
}

export function completeLesson(uid, lessonId, { xp, accuracy }) {
  const before = getProgress(uid);
  const streakBefore = streakOf(before);
  const prev = before.lessons[lessonId];
  const p = addXP(uid, xp);
  const next = save(uid, {
    ...p,
    lessons: {
      ...p.lessons,
      [lessonId]: {
        done: true,
        best: Math.max(prev?.best || 0, accuracy),
        times: (prev?.times || 0) + 1,
        at: new Date().toISOString(),
      },
    },
  });
  return { progress: next, streakBefore, streak: streakOf(next) };
}

// Re-renders whenever progress changes anywhere in the app (or in another tab).
export function useProgress(uid) {
  const [p, setP] = useState(() => getProgress(uid));
  useEffect(() => {
    const sync = () => setP(getProgress(uid));
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener(EVENT, sync); window.removeEventListener('storage', sync); };
  }, [uid]);
  return p;
}
