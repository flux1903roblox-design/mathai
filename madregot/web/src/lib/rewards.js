// What comes next for מדי (PRODUCT2-36): the wardrobe's meter ("החלק הבא: עוד 2 שלבים"), the few pieces after it, and
// the daily quests' chest, which lets the student choose one of two pieces. Every rule is fixed and said out loud:
// no currency, no shop, no random draw. The catalogue and what is owned are lib/wardrobe.js; this module is loaded
// only with the screens that show it (the wardrobe, the quests tab, the end of a lesson), never at boot.
import { TOPICS, TOPIC, topicsFor } from '@/content/index.js';
import { isDone, isPlaced, partsOf, stagesDone, stagesWorked, chestAfter, STAIR_STAGES } from './path.js';
import { ITEMS, COLORS, TRACK_EVERY, colourForFamily, chestPieces } from './wardrobe.js';
import { dayBefore } from './days.js';

/** Stages still to do on a stair before it counts as done: none once done, one when only its check waits, else the rest of five. */
export function stairLeft(topic, level, path = {}, skills = {}) {
  if (isDone(path, topic, level)) return 0;
  if (isPlaced(path, topic, level)) return 1;
  return STAIR_STAGES - stagesDone(skills[`${topic}:${level}`], partsOf(path, topic, level), false);
}

/** Stages still to do on a unit's stairs 1 to `upTo` (its chest), or on all of them (its colour). */
export function unitLeft(topic, path = {}, skills = {}, upTo = TOPIC[topic].levels.length) {
  let n = 0;
  for (let L = 1; L <= upTo; L += 1) n += stairLeft(topic, L, path, skills);
  return n;
}

/** The units whose pieces a student is on the way to: their grade's own, and any other they have worked in. */
function unitsOnTheWay(grade, path, skills) {
  const own = new Set(topicsFor(grade || '7').map((t) => t.id));
  return TOPICS.filter((t) => own.has(t.id) || unitLeft(t.id, path, skills) < t.levels.length * STAIR_STAGES);
}

/**
 * The pieces learning still opens, nearest first: { id, kind: 'stages' | 'chest' | 'colour', topic, left, of }.
 * left: stages still to do; of: the stages from the last piece of its kind to it, so the meter's bar reads of − left of
 * of. The pieces for stages come first on a tie. owned: a Set of the ids the student has (lib/wardrobe.js ownedLook).
 */
export function upcoming({ path = {}, skills = {}, grade = '7', owned = new Set() } = {}) {
  const out = [];
  const done = stagesWorked(path, skills);
  for (const i of ITEMS) {
    const n = i.unlock.stages;
    if (!n || owned.has(i.id) || n <= done) continue;
    out.push({ id: i.id, kind: 'stages', topic: null, left: n - done, of: n === 1 ? 1 : TRACK_EVERY });
  }
  const units = unitsOnTheWay(grade, path, skills);
  for (const t of units) {
    const it = ITEMS.find((x) => x.unlock.chest === t.id);
    if (it && !owned.has(it.id)) out.push({ id: it.id, kind: 'chest', topic: t.id, left: unitLeft(t.id, path, skills, chestAfter(t.id)), of: chestAfter(t.id) * STAIR_STAGES });
  }
  // a colour comes with its family's nearest unit
  for (const c of COLORS) {
    if (!c.unlock || owned.has(c.id)) continue;
    const near = units.filter((t) => colourForFamily(t.color) === c.id).map((t) => ({ t, left: unitLeft(t.id, path, skills) })).sort((a, b) => a.left - b.left)[0];
    if (near) out.push({ id: c.id, kind: 'colour', topic: near.t.id, left: near.left, of: near.t.levels.length * STAIR_STAGES });
  }
  const rank = { stages: 0, chest: 1, colour: 2 };
  return out.filter((p) => p.left > 0).sort((a, b) => a.left - b.left || rank[a.kind] - rank[b.kind]);
}

/** "עוד שלב אחד", "עוד 2 שלבים". */
export const leftText = (n) => (n === 1 ? 'עוד שלב אחד' : `עוד ${n} שלבים`);

/** Where an upcoming piece comes from, in a few words: "ביחידת זוויות", or nothing for a piece for stages. */
export const whereText = (p) => (p.kind === 'stages' ? 'על כל שלב שתסיימו, בכל יחידה' : p.kind === 'chest' ? `בתיבה של ${TOPIC[p.topic].title}` : `בסוף ${TOPIC[p.topic].title}`);

/**
 * The day whose quest chest still waits for its choice: the latest day of the last week whose three quests were done,
 * when no piece was chosen for it yet (an earlier day waits no longer once a later chest opened). null when none waits.
 */
export function chestDay(days = {}, look = {}, todayKey) {
  let d = todayKey;
  for (let i = 0; i < 7; i += 1, d = dayBefore(d)) {
    if (days[d]?.questsRewarded) return look?.picks?.[d] ? null : d;
  }
  return null;
}

/** The quest chest's choice waiting now: { day, ids } or null (nothing waits, or every chest piece is owned). */
export function chestOffer({ days = {}, look = {}, today, owned = new Set() } = {}) {
  const day = chestDay(days, look, today);
  const ids = day ? chestPieces(owned) : [];
  return ids.length ? { day, ids } : null;
}
