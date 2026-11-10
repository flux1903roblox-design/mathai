// Daily quests: three small goals a day, picked by the date so everyone in a class
// gets the same three. Progress comes from today's record in the store.
export const QUESTS = {
  lessons: { title: (n) => `השלימו ${n} שיעורים`, target: 2, of: (d) => d.lessons || 0 },
  xp: { title: (n) => `צברו ${n} נקודות XP`, target: 30, of: (d) => d.xp || 0 },
  combo: { title: (n) => `ענו נכון ${n} פעמים ברצף`, target: 5, of: (d) => d.combo || 0 },
  perfect: { title: () => 'שיעור אחד בלי אף טעות', target: 1, of: (d) => d.perfect || 0 },
  correct: { title: (n) => `${n} תשובות נכונות`, target: 15, of: (d) => d.ok || 0 },
  // the quests are a habit layer: they suggest no work of their own, and this one reinforces the day's one mission
  mission: { title: () => 'השלימו את "המשימה שלי להיום"', target: 1, of: (d) => (d.missionDone ? 1 : 0) },
};
// six ids, in the order the old list had them ('mission' took the place of the retired plan's 'review')
const ORDER = ['lessons', 'combo', 'correct', 'xp', 'perfect', 'mission'];

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

/** The daily goal in XP, with roughly how many minutes a day it takes. */
export const GOALS = [{ xp: 10, label: 'קליל', mins: 5 }, { xp: 20, label: 'רגיל', mins: 10 }, { xp: 30, label: 'רציני', mins: 15 }, { xp: 50, label: 'אינטנסיבי', mins: 20 }];
