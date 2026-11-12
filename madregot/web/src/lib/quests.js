// Daily quests: three small goals a day, picked by the date so everyone in a class
// gets the same three. Progress comes from today's record in the store.
import { localized, t } from '@/lib/i18n.js';
export const QUESTS = {
  lessons: { title: (n) => t('shell.quests.1', { n }), target: 2, of: (d) => d.lessons || 0 },
  xp: { title: (n) => t('shell.quests.2', { n }), target: 30, of: (d) => d.xp || 0 },
  combo: { title: (n) => t('shell.quests.3', { n }), target: 5, of: (d) => d.combo || 0 },
  perfect: { title: () => t('shell.quests.4'), target: 1, of: (d) => d.perfect || 0 },
  correct: { title: (n) => t('shell.quests.5', { n }), target: 15, of: (d) => d.ok || 0 },
  // the quests are a habit layer: they suggest no work of their own, and this one reinforces the day's one mission
  mission: { title: () => t('shell.quests.6'), target: 1, of: (d) => (d.missionDone ? 1 : 0) },
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
export let GOALS = localized(() => ([{ xp: 10, label: t('shell.quests.7'), mins: 5 }, { xp: 20, label: t('shell.quests.8'), mins: 10 }, { xp: 30, label: t('shell.quests.9'), mins: 15 }, { xp: 50, label: t('shell.quests.10'), mins: 20 }]), (v) => { GOALS = v; });
