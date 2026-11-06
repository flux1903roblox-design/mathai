// Daily quests: three small goals a day, picked by the date so everyone in a class
// gets the same three. Progress comes from today's record in the store.
export const QUESTS = {
  lessons: { title: (n) => `השלימו ${n} שיעורים`, target: 2, of: (d) => d.lessons || 0 },
  xp: { title: (n) => `צברו ${n} נקודות XP`, target: 30, of: (d) => d.xp || 0 },
  combo: { title: (n) => `ענו נכון ${n} פעמים ברצף`, target: 5, of: (d) => d.combo || 0 },
  perfect: { title: () => 'שיעור אחד בלי אף טעות', target: 1, of: (d) => d.perfect || 0 },
  correct: { title: (n) => `${n} תשובות נכונות`, target: 15, of: (d) => d.ok || 0 },
  review: { title: () => 'שיעור חזרה או שיעור מהתוכנית', target: 1, of: (d) => (d.reviews || 0) + (d.planLessons || 0) },
};
const ORDER = ['lessons', 'combo', 'correct', 'xp', 'perfect', 'review'];

/** Three quests for a date key (YYYY-MM-DD): one about lessons, two that rotate. */
export function questsFor(dayKey) {
  const n = [...dayKey].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 9973, 7);
  const rest = ORDER.slice(1);
  const a = rest[n % rest.length]; const b = rest[(n + 2) % rest.length];
  return ['lessons', a, b === a ? rest[(n + 3) % rest.length] : b];
}

export function questProgress(dayKey, day = {}) {
  return questsFor(dayKey).map((id) => {
    const q = QUESTS[id]; const have = Math.min(q.of(day), q.target);
    return { id, title: q.title(q.target), have, target: q.target, done: have >= q.target };
  });
}
