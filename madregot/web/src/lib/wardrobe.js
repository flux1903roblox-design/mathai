// "מדי שלי" (STUDENT-3): Madi's colours and accessories, earned by learning. There is no currency, shop, random draw
// or anything paid: each piece says exactly what earned it.
//  - Colours: a completed unit (every stair done) gives its colour family. Madi's default is the brand blue, which is
//    also the `sky` family's colour, so a completed `sky` unit gives gold instead (gold already means mastery on the path).
//  - Accessories: one per unit, given when the unit's chest opens (stairs 1 to chestAfter all done, in order), plus the
//    class scarf for a class that reaches its goal of the week (STUDENT-4).
// Unlocks are derived from progress, so they need no migration. The first time an id is derived it is remembered in
// look.earned (earnIds), and from then on it stays earned, even if a stair later falls back to needs-review.
// Pure functions only; the store keeps `look` (lib/store.js), Mascot draws it (components/mascot/Accessories.jsx).
import { TOPICS, TOPIC, topicsFor } from '@/content/index.js';
import { doneCount, chestOpen, chestAfter } from './path.js';

export const SLOTS = ['head', 'face', 'neck', 'body'];
export const SLOT_NAME = { head: 'על הראש', face: 'על הפנים', neck: 'על הצוואר', body: 'על המדרגה' };

/** The colours, in the wardrobe's order. `unlock.family`: a completed unit of that colour family gives it. */
export const COLORS = [
  { id: 'sky', name: 'כחול', unlock: null },
  { id: 'gold', name: 'זהב', unlock: { family: 'sky' } },
  { id: 'petrol', name: 'טורקיז', unlock: { family: 'petrol' } },
  { id: 'violet', name: 'סגול', unlock: { family: 'violet' } },
  { id: 'fuchsia', name: 'מג׳נטה', unlock: { family: 'fuchsia' } },
  { id: 'cobalt', name: 'כחול כהה', unlock: { family: 'cobalt' } },
];

/** The accessories: one per unit (its chest), plus the class scarf. A test fails if a unit in TOPICS has none. */
export const ITEMS = [
  { id: 'thermo-scarf', slot: 'neck', topic: 'signed', name: 'צעיף מדחום', unlock: { chest: 'signed' } },
  { id: 'compass-cap', slot: 'head', topic: 'coord', name: 'כובע מצפן', unlock: { chest: 'coord' } },
  { id: 'protractor-crown', slot: 'head', topic: 'angles', name: 'כתר מד־זווית', unlock: { chest: 'angles' } },
  { id: 'slope-tie', slot: 'neck', topic: 'line', name: 'עניבת שיפוע', unlock: { chest: 'line' } },
  { id: 'triangle-glasses', slot: 'face', topic: 'pyth', name: 'משקפי משולש', unlock: { chest: 'pyth' } },
  { id: 'bars-pin', slot: 'body', topic: 'stats', name: 'סיכת עמודות', unlock: { chest: 'stats' } },
  { id: 'x-cap', slot: 'head', topic: 'expr', name: 'כובע איקס', unlock: { chest: 'expr' } },
  { id: 'balance-pin', slot: 'body', topic: 'eq', name: 'סיכת מאזניים', unlock: { chest: 'eq' } },
  { id: 'cross-pin', slot: 'body', topic: 'sys', name: 'סיכת שני ישרים', unlock: { chest: 'sys' } },
  // the curriculum lane's bridge unit (fractions and decimals): drawn at the merge, so every unit in TOPICS has its piece
  { id: 'fraction-pin', slot: 'body', topic: 'frac', name: 'סיכת שבר', unlock: { chest: 'frac' } },
  // the curriculum lane's grade 8 units (ratio and scale, percent): drawn at the merge, for the same reason
  { id: 'scale-pin', slot: 'body', topic: 'ratio', name: 'סיכת קנה מידה', unlock: { chest: 'ratio' } },
  { id: 'percent-pin', slot: 'body', topic: 'pct', name: 'סיכת אחוז', unlock: { chest: 'pct' } },
  // curriculum stage 3's data unit: a tally pin, so every unit in TOPICS has its piece
  { id: 'tally-pin', slot: 'body', topic: 'data', name: 'סיכת ספירה', unlock: { chest: 'data' } },
  { id: 'class-scarf', slot: 'neck', topic: null, name: 'צעיף הכיתה', unlock: { classGoal: true } },
];

const COLOR = Object.fromEntries(COLORS.map((c) => [c.id, c]));
const ITEM = Object.fromEntries(ITEMS.map((i) => [i.id, i]));
export const colorOf = (id) => COLOR[id] || null;
export const itemOf = (id) => ITEM[id] || null;
/** The name of a colour or an accessory. */
export const nameOf = (id) => (COLOR[id] || ITEM[id])?.name || '';
/** The colour a unit's family gives when the unit is completed. */
export const colourForFamily = (family) => (family === 'sky' ? 'gold' : family);

/**
 * Madi's colours (the --madi-* tokens) for each wardrobe colour. `sky` is the default, the same values as tokens.css.
 * Face ink #001526 on gold #f2b400 is 9.96:1.
 */
export const MADI_PALETTE = { sky: { hi: '#5b8cff', lo: '#1a5cf5', edge: '#1246c4', tread: '#c9d9ff', limb: '#1246c4' }, gold: { hi: '#ffd666', lo: '#f2b400', edge: '#b38200', tread: '#fff1c2', limb: '#8a5c00' }, petrol: { hi: '#3aa7b9', lo: '#0b7285', edge: '#085566', tread: '#bfe6ec', limb: '#085566' }, violet: { hi: '#9a7bff', lo: '#7048e8', edge: '#5232c2', tread: '#ddd2fd', limb: '#5232c2' }, fuchsia: { hi: '#d45cc0', lo: '#a3218f', edge: '#7a1869', tread: '#f3cdea', limb: '#7a1869' }, cobalt: { hi: '#5560c4', lo: '#283593', edge: '#1a237e', tread: '#c5cae9', limb: '#1a237e' } }; // colour-ok: Madi palette

/** What a student wears before choosing anything, and what a saved look falls back to. */
export const DEFAULT_LOOK = Object.freeze({ color: 'sky', head: null, face: null, neck: null, body: null });
/** The saved look in the store: what is worn, what was earned (for good), what the student was shown, and when each was earned. */
export const emptyLook = () => ({ ...DEFAULT_LOOK, earned: [], seen: [], earnedAt: {} });

/** A saved look made safe to draw: an unknown colour is the default, and an item only goes in its own slot. */
export function cleanLook(look) {
  const l = look && typeof look === 'object' ? look : {};
  const out = { color: COLOR[l.color] ? l.color : 'sky' };
  for (const s of SLOTS) out[s] = ITEM[l[s]]?.slot === s ? l[s] : null;
  return out;
}

/** The units in the order a student meets them: their own path first (topicsFor), then the rest (the floor, the other grade's). */
const unitsFor = (grade) => { const path = topicsFor(grade || '7'); return [...path, ...TOPICS.filter((t) => !path.includes(t))]; };
const unitComplete = (topic, path) => doneCount(topic, path) === TOPIC[topic].levels.length;

/** The unit a colour is named for: the first completed one of its family, else the first of its family the student meets. */
function colourUnit(id, path, grade) {
  const family = COLOR[id]?.unlock?.family;
  if (!family) return null;
  const units = unitsFor(grade).filter((t) => t.color === family);
  return (units.find((t) => unitComplete(t.id, path)) || units[0] || null)?.id || null;
}

/** Why a piece is the student's: "מיחידת זוויות", or "מהמטרה של הכיתה". */
function whyOwned(id, path, grade) {
  if (ITEM[id]?.unlock.classGoal) return 'מהמטרה של הכיתה';
  const topic = ITEM[id]?.topic || colourUnit(id, path, grade);
  return topic ? `מיחידת ${TOPIC[topic].title}` : '';
}

/**
 * What the student's progress has unlocked, derived (no saved state needed):
 * { colors: Set (always with 'sky'), items: Set, why: Map id → "מיחידת …" }.
 * classGoals: { [week]: { reached, mine } } (STUDENT-4); the class scarf needs a reached goal the student added to.
 */
export function unlockedLook({ path = {}, classGoals = {}, grade = '7' } = {}) {
  const colors = new Set(['sky']); const items = new Set();
  for (const t of TOPICS) {
    if (unitComplete(t.id, path)) colors.add(colourForFamily(t.color));
    const it = ITEMS.find((i) => i.unlock.chest === t.id);
    if (it && chestOpen(t.id, path)) items.add(it.id);
  }
  if (Object.values(classGoals || {}).some((g) => g?.reached && (g.mine || 0) > 0)) items.add('class-scarf');
  return { colors, items, why: new Map([...colors, ...items].filter((id) => id !== 'sky').map((id) => [id, whyOwned(id, path, grade)])) };
}

/** Everything the student owns: what progress unlocks now, plus what was earned before (look.earned) and stays. */
export function ownedLook({ path = {}, classGoals = {}, grade = '7', earned = [] } = {}) {
  const u = unlockedLook({ path, classGoals, grade });
  for (const id of earned || []) {
    if (COLOR[id] && !u.colors.has(id)) { u.colors.add(id); u.why.set(id, whyOwned(id, path, grade)); }
    if (ITEM[id] && !u.items.has(id)) { u.items.add(id); u.why.set(id, whyOwned(id, path, grade)); }
  }
  return u;
}

/** The ids of the pieces unlocked (never the default colour), colours first, in catalogue order. */
export const unlockedIds = (unlocked) => [...COLORS.filter((c) => c.unlock && unlocked.colors.has(c.id)), ...ITEMS.filter((i) => unlocked.items.has(i.id))].map((p) => p.id);

/** Pieces the student has not been shown yet (seen: string[]). */
export function newUnlocks(unlocked, seen = []) {
  const shown = new Set(seen || []);
  return unlockedIds(unlocked).filter((id) => !shown.has(id));
}

/**
 * The look with these ids earned for good (and, unless seen is false, marked as shown). A newly earned id gets
 * earnedAt[id] = day, for the Sunday recap. Returns the same object when nothing changes.
 */
export function earnIds(look, ids, day, { seen = true } = {}) {
  const l = { ...emptyLook(), ...(look || {}) };
  const valid = (ids || []).filter((id) => (COLOR[id]?.unlock || ITEM[id]));
  const earned = new Set(l.earned || []); const shown = new Set(l.seen || []); const at = { ...(l.earnedAt || {}) };
  let changed = false;
  for (const id of valid) {
    if (!earned.has(id)) { earned.add(id); changed = true; }
    if (!at[id]) { at[id] = day; changed = true; }
    if (seen && !shown.has(id)) { shown.add(id); changed = true; }
  }
  return changed ? { ...l, earned: [...earned], seen: [...shown], earnedAt: at } : look;
}

/** Put a piece on: a colour, or an accessory in its slot. */
export const wearing = (id) => (COLOR[id] ? { color: id } : ITEM[id] ? { [ITEM[id].slot]: id } : {});

/** Is this piece what the look wears now? */
export const isWorn = (look, id) => (COLOR[id] ? look?.color === id : !!ITEM[id] && look?.[ITEM[id].slot] === id);

/** A locked piece: the sentence that says how it opens, and the unit that opens it (null for the class scarf). */
export function lockedReason(id, grade = '7') {
  const it = ITEM[id];
  if (it?.unlock.classGoal) return { text: 'נפתח כשהכיתה מגיעה למטרה של השבוע.', topic: null };
  if (it) return { text: `נפתח כשתשלטו במדרגות 1 עד ${chestAfter(it.topic)} ביחידת ${TOPIC[it.topic].title}.`, topic: it.topic };
  const topic = colourUnit(id, {}, grade);
  return topic ? { text: `נפתח כשתשלטו בכל המדרגות ביחידת ${TOPIC[topic].title}.`, topic } : { text: '', topic: null };
}

/** The unlock moment's sentence for a piece just earned. */
export function unlockReason(id, path = {}, grade = '7') {
  const it = ITEM[id];
  if (it?.unlock.classGoal) return `הכיתה הגיעה למטרה של השבוע, ומדי קיבל ${it.name}.`;
  if (it) return `שלטתם בחצי הראשון של ${TOPIC[it.topic].title}, ומדי קיבל ${it.name}.`;
  const topic = colourUnit(id, path, grade);
  return topic ? `סיימתם את כל המדרגות של ${TOPIC[topic].title}. מדי יכול להיות עכשיו ${COLOR[id].name}.` : '';
}

/** New pieces in the order the unlock moment shows them: the result's own unit first (its colour, then its chest's item). */
export function orderUnlocks(ids, topic) {
  const t = TOPIC[topic];
  const mine = (id) => !!t && (ITEM[id]?.topic === topic || (!!COLOR[id] && colourForFamily(t.color) === id));
  return [...ids.filter(mine), ...ids.filter((id) => !mine(id))];
}

/** The accessory a unit's chest holds. */
export const chestItem = (topic) => ITEMS.find((i) => i.unlock.chest === topic) || null;
