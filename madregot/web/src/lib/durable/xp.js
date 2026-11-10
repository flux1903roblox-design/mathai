// XP as a per-device counter (DURABLE-2). `xpBy` keeps one entry per device tag and `xp` is always their sum. A device
// only ever adds to its own entry, so two copies of one student's progress (two phones, a backup and this phone) can
// later be merged by taking each device's larger entry: no XP is lost and none is counted twice. Every XP write in the
// store goes through addXp; xp.test.js fails if store.js raises `xp` any other way.
import { randomHex } from '../random.js';

/** A device tag: 8 lowercase hex characters. */
export const TAG = /^[0-9a-f]{8}$/;

/** A new device tag (the v5 migration, sign-out, or the first XP on a device that has never saved). */
export const newTag = () => randomHex(4);

/** The total of a per-device counter. Anything that is not a finite, non-negative entry counts 0. */
export function sumXp(xpBy) {
  if (!xpBy || typeof xpBy !== 'object') return 0;
  let n = 0;
  for (const v of Object.values(xpBy)) if (Number.isFinite(v) && v > 0) n += v;
  return n;
}

/**
 * `n` more XP earned on this device: the store patch `{ xp, xpBy }`. XP never goes down, so a gain that is not a
 * positive number changes nothing. A device that has no tag yet (it never saved before) gets one here, and the patch
 * then carries `durable` too.
 */
export function addXp(st, n) {
  const xpBy = st.xpBy && typeof st.xpBy === 'object' ? st.xpBy : {};
  const xp = Number.isFinite(st.xp) ? st.xp : 0;
  if (!(Number.isFinite(n) && n > 0)) return { xp, xpBy };
  const has = typeof st.durable?.tag === 'string' && TAG.test(st.durable.tag);
  const tag = has ? st.durable.tag : newTag();
  const patch = { xp: xp + n, xpBy: { ...xpBy, [tag]: (Number.isFinite(xpBy[tag]) ? xpBy[tag] : 0) + n } };
  if (!has) patch.durable = { ...st.durable, tag };
  return patch;
}
