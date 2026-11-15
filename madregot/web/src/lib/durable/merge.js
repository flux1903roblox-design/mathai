// @ts-check
// The two merges of the student's saved progress (DURABLE-2). Both are pure and total: they never throw, never change
// their inputs, and always return a whole state.
//
// mergeTabs(base, mine, theirs): two tabs of this device. Both tabs grew from one saved copy (`base`, found by the write
// path, storage.js), so their increments can be added: one lesson in each tab is two lessons, and XP is the sum. A
// slice only one side changed is taken from that side; a slice both changed is merged by kind (counters add, a few
// fields take the maximum, logs are joined), and anything else goes to the side that changed it last (meta.keyAt).
//
// mergeDevices(local, remote): two devices of one student (a restore from a file now; the vault and class restores
// later). They share no base this device keeps, so nothing is added: every counter takes the larger value and every
// log is joined, so a merge never lowers anything and merging the same copy twice changes nothing. This device's
// settings and its device-only slices (the tutor, the class outbox, the save settings, the backup, the class work)
// always stay.
//
// In both, a reset on purpose (resetAt) wins every progress field whole: a sync must not bring old progress back. And
// in both, the fields the v7 migration retired (RETIRED: planBase, wins) are dropped, so neither side brings them back.
import { sumXp } from './xp.js';
import { logEvent, MAX_EVENTS } from '@/learn/analytics.ts';
import { KEEP_ATTEMPTS } from '@/learn/mastery.ts';
import { mergeWork } from '@/learn/assignments.ts';
import { isRecord as isObj } from '@shared/obj.js';
import { RETIRED } from './migrations.js';

/** @typedef {import('./types').Json} Json */
/** @typedef {import('./types').Saved} Saved */
/** @typedef {(x: Json) => string} KeyFn */

/** Checked exams and practice exams kept (newest first), as the store keeps them. */
export const EXAMS_KEEP = 30;
export const PRACTICE_EXAMS_KEEP = 20;
/** A teacher's printable class exams kept on a device (the teacher lane's TEACHER-3; store.js TEACHER_EXAMS). */
export const TEACHER_EXAMS_KEEP = 8;
/** A class student's answers waiting for the server, at most (the oldest give way first). */
export const OUTBOX_KEEP = 1000;

/**
 * Never taken from another device: they describe this device, not the student's progress. The teacher's class work
 * (classWork, the last copy fetched with this device's class token) and its reports waiting for the server (workOutbox)
 * are this device's like the answers' outbox: the class server has the truth, and the app fetches it again. So are the
 * student lane's class-goal steps waiting for the server (stepsOut) and the weeks it last reported (classGoals,
 * STUDENT-4), this device's one-time notes and install offers (nudges, STUDENT-5/10), and its daily reminder
 * (reminder, STUDENT-11: the id and secret of this browser's push subscription; another device's would remind the wrong
 * phone), and the family challenge (family, PRODUCT2-39: a weekly goal accepted from a parent's link on this device, and
 * the one a parent sent from it). Between two tabs of this device the work outbox is merged per assignment (FOLLOWUP-2:
 * workJoin), never taken whole from the tab that wrote last.
 */
export const DEVICE_ONLY = ['ai', 'outbox', 'durable', 'backup', 'classWork', 'workOutbox', 'stepsOut', 'classGoals', 'nudges', 'reminder', 'family'];
/** This device's settings: a restore never changes them (haptics and prefs, the look and the sound choice: STUDENT-2/7). */
export const SETTINGS = ['sound', 'goalXp', 'solveMode', 'helpSent', 'haptics', 'prefs'];
/**
 * What a reset on purpose clears (store.js resetProgress): the side with the later reset gives all of it. Madi's look
 * (STUDENT-3) and the streak's last repair (STUDENT-5) go with the progress.
 */
export const PROGRESS = ['progress', 'days', 'xp', 'xpBy', 'resetAt', 'path', 'mistakes', 'gaps', 'placement', 'learn', 'exams', 'practiceExams', 'freezes', 'lastTopic', 'streak', 'look'];
/** Class-goal steps waiting for the server, at most (store.js STEPS_MAX; the oldest give way first). */
export const STEPS_KEEP = 200;
/** Per-day counters that take the larger value even between tabs (the best combo of the day). */
const DAY_MAX = new Set(['combo']);
/** Per-day flags: set on either side, set in the merge. */
const DAY_OR = new Set(['frozen', 'questsRewarded']);
/** A flag set on either side; a day the streak's repair kept stays frozen: 'repair' (STUDENT-5: "הרצף נשמר"). */
/** @type {(x: Json, y: Json) => boolean | 'repair'} */
const orJoin = (x, y) => (x === 'repair' || y === 'repair' ? 'repair' : !!(x || y));

/**
 * @param {unknown} v
 * @returns {v is number}
 */
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
/**
 * @param {unknown} v
 * @returns {v is Function}
 */
const isFn = (v) => typeof v === 'function';
/** The same value: the same reference, or the same JSON (parsed copies of one value). */
/** @type {(a: unknown, b: unknown) => boolean} */
const same = (a, b) => a === b || (a !== undefined && b !== undefined && !isFn(a) && !isFn(b) && JSON.stringify(a) === JSON.stringify(b));
/**
 * The keys of all the objects given, once each, in order of appearance.
 * @param {...unknown} objs
 * @returns {string[]}
 */
function keysOf(...objs) {
  /** @type {Set<string>} */
  const out = new Set();
  for (const o of objs) if (isObj(o)) for (const [k, v] of Object.entries(o)) if (!isFn(v)) out.add(k);
  return [...out];
}
/** @type {(v: unknown) => string} */
const str = (v) => (typeof v === 'string' ? v : '');
/** @type {(a: Json, b: Json) => Json} */
const max2 = (a, b) => (isNum(a) ? (isNum(b) ? Math.max(a, b) : a) : isNum(b) ? b : a ?? b);

/**
 * A state without its functions (a live store's actions), as it is saved.
 * @param {unknown} state
 * @returns {Saved}
 */
export function dataOf(state) {
  /** @type {Saved} */
  const out = {};
  if (isObj(state)) for (const [k, v] of Object.entries(state)) if (!isFn(v)) out[k] = v;
  return out;
}

// ------------------------------------------------------------------ three-way helpers (tabs)

/** Unchanged on one side: the other side. Changed on both: `both(base, mine, theirs)`. */
/** @type {(b: Json, m: Json, t: Json, both: (b: Json, m: Json, t: Json) => Json) => Json} */
const three = (b, m, t, both) => (same(m, b) ? t : same(t, b) ? m : both(b, m, t));

/**
 * An additive counter: what theirs has plus what mine added since the base, never below either side.
 * @param {Json} b
 * @param {Json} m
 * @param {Json} t
 * @returns {Json}
 */
function add3(b, m, t) {
  if (!isNum(m) && !isNum(t)) return m !== undefined ? m : t;
  const mm = isNum(m) ? m : 0; const tt = isNum(t) ? t : 0; const bb = isNum(b) ? b : 0;
  return Math.max(tt + (mm - bb), mm, tt);
}

/**
 * Per key of an object: `fn(base, mine, theirs, key)`; a key whose result is undefined is left out.
 * @param {Json} b
 * @param {Json} m
 * @param {Json} t
 * @param {(b: Json, m: Json, t: Json, key: string) => Json} fn
 * @returns {Saved}
 */
function perKey3(b, m, t, fn) {
  /** @type {Saved} */
  const out = {};
  for (const k of keysOf(b, m, t)) {
    const v = fn(isObj(b) ? b[k] : undefined, isObj(m) ? m[k] : undefined, isObj(t) ? t[k] : undefined, k);
    if (v !== undefined) out[k] = v;
  }
  return out;
}
/** @type {(b: Json, m: Json, t: Json) => Saved} */
const addMap3 = (b, m, t) => perKey3(b, m, t, (x, y, z) => three(x, y, z, add3));

/**
 * Anything else: unchanged on one side → the other; two objects → key by key; otherwise the side that changed last.
 * @param {Json} b
 * @param {Json} m
 * @param {Json} t
 * @param {boolean} mineWins
 * @returns {Json}
 */
function generic3(b, m, t, mineWins) {
  if (same(m, b)) return t;
  if (same(t, b)) return m;
  if (isObj(m) && isObj(t)) return perKey3(b, m, t, (x, y, z) => generic3(x, y, z, mineWins));
  return mineWins ? m : t;
}

/**
 * A log or a set as a multiset by key, three-way: each item counts as often as the base has it, plus what each side added or removed.
 * @param {Json} b
 * @param {Json} m
 * @param {Json} t
 * @param {KeyFn} keyFn
 * @returns {Json[]}
 */
function set3(b, m, t, keyFn) {
  /** @param {Json} list */
  const count = (list) => { /** @type {Map<string, number>} */ const c = new Map(); for (const x of Array.isArray(list) ? list : []) { const k = keyFn(x); c.set(k, (c.get(k) || 0) + 1); } return c; };
  const cb = count(b); const cm = count(m); const ct = count(t);
  /** @type {Json[]} */ const out = []; /** @type {Map<string, number>} */ const used = new Map();
  for (const x of [...(Array.isArray(m) ? m : []), ...(Array.isArray(t) ? t : [])]) {
    const k = keyFn(x);
    const want = Math.max(0, (cm.get(k) || 0) + (ct.get(k) || 0) - (cb.get(k) || 0));
    if ((used.get(k) || 0) < want) { out.push(x); used.set(k, (used.get(k) || 0) + 1); }
  }
  return out;
}

/**
 * Two copies of a log, joined: each item as often as the side that has it most (a merge with itself changes nothing).
 * @param {Json} a
 * @param {Json} b
 * @param {KeyFn} keyFn
 * @returns {Json[]}
 */
function union(a, b, keyFn) {
  /** @type {Json[]} */ const out = []; /** @type {Map<string, number>} */ const ca = new Map();
  for (const x of Array.isArray(a) ? a : []) { const k = keyFn(x); ca.set(k, (ca.get(k) || 0) + 1); out.push(x); }
  /** @type {Map<string, number>} */
  const cb = new Map();
  for (const x of Array.isArray(b) ? b : []) {
    const k = keyFn(x); const n = (cb.get(k) || 0) + 1; cb.set(k, n);
    if (n > (ca.get(k) || 0)) out.push(x);
  }
  return out;
}

/** @type {(f: (x: Json) => unknown) => (x: Json, y: Json) => number} */
const byAsc = (f) => (x, y) => (str(f(x)) < str(f(y)) ? -1 : str(f(x)) > str(f(y)) ? 1 : 0);
/** @type {KeyFn} */
const eventKey = (e) => (isObj(e) ? `${str(e.t)}|${str(e.e)}|${str(e.s)}|${str(e.p)}|${str(e.m)}|${e.ok}` : JSON.stringify(e));
/** @type {KeyFn} */
const attemptKey = (a) => (isObj(a) ? `${str(a.at)}|${str(a.purpose)}|${a.ok}|${a.independent}` : JSON.stringify(a));
/** @type {KeyFn} */
const idKey = (x) => (isObj(x) && x.id != null ? `id:${x.id}` : JSON.stringify(x));
/** @type {KeyFn} */
const sidKey = (x) => (isObj(x) && x.sid != null ? `sid:${x.sid}` : JSON.stringify(x));
/** The newest `n` of a log kept in time order (its end). */
/** @type {(list: Json[], n: number) => Json[]} */
const lastN = (list, n) => (list.length > n ? list.slice(-n) : list);
/** @type {(list: Json[]) => Json[]} */
const sortEvents = (list) => lastN([...list].sort(byAsc((e) => e?.t)), MAX_EVENTS);
/** @type {(list: Json[]) => Json[]} */
const sortAttempts = (list) => lastN([...list].sort(byAsc((a) => a?.at)), KEEP_ATTEMPTS);
/** @type {(list: Json[], n: number) => Json[]} */
const newestFirst = (list, n) => [...list].sort((x, y) => -byAsc((e) => e?.at)(x, y)).slice(0, n);

// ------------------------------------------------------------------ records shared by both merges

/** When a mastery record last changed: its last review, or when it was mastered. */
/** @type {(ms: Json) => string} */
const lastMastery = (ms) => (isObj(ms) ? (str(ms.lastReview?.at) > str(ms.at) ? str(ms.lastReview.at) : str(ms.at)) : '');
/** @type {(rec: Json) => string} */
const lastMasteryAttempt = (rec) => (Array.isArray(rec?.attempts) ? rec.attempts.filter((/** @type {Json} */ a) => a?.purpose === 'mastery').reduce((/** @type {string} */ t, /** @type {Json} */ a) => (str(a.at) > t ? str(a.at) : t), '') : '');
/**
 * The side whose mastery is newer: the record that has `mastered` (a pass is never lost), else the one whose latest
 * mastery event (a review, or the pass) is later, so a failed review on one device is not hidden by an older pass on
 * the other. With no mastery on either side: the one with the later mastery check. Ties are settled the same way
 * whichever side is local, so the merge is symmetric.
 * @param {Saved} a
 * @param {Saved} b
 * @returns {Saved}
 */
function masterySide(a, b) {
  if (a.mastered && !b.mastered) return a;
  if (b.mastered && !a.mastered) return b;
  const ka = a.mastered ? lastMastery(a.mastered) : lastMasteryAttempt(a);
  const kb = b.mastered ? lastMastery(b.mastered) : lastMasteryAttempt(b);
  if (ka !== kb) return ka > kb ? a : b;
  const fa = isNum(a.failedChecks) ? a.failedChecks : 0; const fb = isNum(b.failedChecks) ? b.failedChecks : 0;
  if (fa !== fb) return fa > fb ? a : b;
  return JSON.stringify(a.mastered ?? null) >= JSON.stringify(b.mastered ?? null) ? a : b;
}

/**
 * Teaching stages: the earliest time each was finished.
 * @param {Json} a
 * @param {Json} b
 * @returns {Json}
 */
function taughtJoin(a, b) {
  if (!isObj(a)) return b; if (!isObj(b)) return a;
  /** @type {Saved} */
  const out = {};
  for (const k of keysOf(a, b)) { const x = a[k]; const y = b[k]; out[k] = x && y ? (str(x) <= str(y) ? x : y) : x || y; }
  return out;
}

/**
 * A stair's "done" mark when the two sides disagree. 'mastered' on either side stays. 'kept' (done before mastery
 * checks existed) stays when both sides keep it; when only one does, the other side reopened it if its failed check
 * is the newer mastery event: a failed check reopens a kept stair (reopenKept, lib/path.js), and the merge must not
 * undo that. `failed` is the merged skill's failed checks, which come from the side with the newer mastery event
 * (masterySide), so a merge of the result with either side again decides the same way.
 * @param {Json} x
 * @param {Json} y
 * @param {number} failed
 * @returns {Json}
 */
function doneJoin(x, y, failed) {
  if (x === 'mastered' || y === 'mastered') return 'mastered';
  if (x === 'kept' && y === 'kept') return 'kept';
  if (x === 'kept' || y === 'kept') return failed > 0 ? undefined : 'kept';
  return x ?? y;
}
/** The merged failed checks of a stair (the learning model is merged before the path). */
/** @type {(learn: Json, topic: string, level: string) => number} */
const failedOf = (learn, topic, level) => {
  const n = learn?.skills?.[`${topic}:${level}`]?.failedChecks;
  return isNum(n) ? n : 0;
};
/** The keys in the order they are merged: the learning model before the path, which reads its failed checks. */
/** @type {(keys: string[]) => string[]} */
const learnFirst = (keys) => [...keys.filter((k) => k !== 'path'), ...(keys.includes('path') ? ['path'] : [])];

/**
 * A day's mission when both sides have it: the chosen side's items, done when either side did them.
 * @param {Json} chosen
 * @param {Json} other
 * @returns {Json}
 */
function missionJoin(chosen, other) {
  if (!isObj(chosen) || !Array.isArray(chosen.items)) return chosen ?? other;
  // an item is its kind, stair and stage, and for a challenge its task (the curriculum lane's challenge items)
  /** @type {KeyFn} */
  const itemKey = (it) => `${it.kind}|${it.skill}|${it.stage ?? ''}|${it.task ?? ''}`;
  /** @type {Map<string, Json>} */
  const doneOther = new Map();
  for (const it of Array.isArray(other?.items) ? other.items : []) if (it?.done) doneOther.set(itemKey(it), it.done);
  return { ...chosen, items: chosen.items.map((/** @type {Json} */ it) => (it && !it.done && doneOther.has(itemKey(it)) ? { ...it, done: doneOther.get(itemKey(it)) } : it)) };
}

/**
 * One challenge task's record (learn.challenges[id], CURRICULUM-6): the finished one wins (it carries the first-try
 * counts its XP was earned with; of two finished, the earlier finish); of two started only, the newer start.
 * @param {Json} a
 * @param {Json} b
 * @returns {Json}
 */
function challengeJoin(a, b) {
  if (!isObj(a)) return b ?? a; if (!isObj(b)) return a;
  const da = str(a.doneAt); const db = str(b.doneAt);
  if (da || db) return !db ? a : !da ? b : db < da ? b : a;
  return str(b.startedAt) > str(a.startedAt) ? b : a;
}

/** The floor check's record (learn.floor, CURRICULUM-3): the newer check, or the newer switch of the unit on or off. */
/** @type {(a: Json, b: Json, newerB: boolean) => Json} */
const floorJoin = (a, b, newerB) => (!isObj(a) ? b ?? a : !isObj(b) ? a : str(b.at) > str(a.at) ? b : str(a.at) > str(b.at) ? a : newerB ? b : a);

/**
 * The exam plan: the one made later; the same plan joins its diagnostics (each skill's later result).
 * @param {Json} a
 * @param {Json} b
 * @param {boolean} newerB
 * @returns {Json}
 */
function examJoin(a, b, newerB) {
  if (!isObj(a)) return b ?? a; if (!isObj(b)) return a;
  if (str(a.createdAt) !== str(b.createdAt)) return str(a.createdAt) > str(b.createdAt) ? a : b;
  const base = newerB ? b : a;
  /** @type {Saved} */
  const diag = {};
  for (const s of keysOf(a.diagnostic, b.diagnostic)) {
    const x = a.diagnostic?.[s]; const y = b.diagnostic?.[s];
    diag[s] = !x ? y : !y ? x : str(y.at) > str(x.at) ? y : str(x.at) > str(y.at) ? x : newerB ? y : x;
  }
  return isObj(a.diagnostic) || isObj(b.diagnostic) ? { ...base, diagnostic: diag } : base;
}

/**
 * Madi's look (STUDENT-3): what is worn and the colour from `chosen` (the side that changed it last, or the newer copy),
 * and what was earned or shown from both sides, since a piece once earned stays earned (each with its earliest day).
 * @param {Json} chosen
 * @param {Json} x
 * @param {Json} y
 * @returns {Json}
 */
function lookJoin(chosen, x, y) {
  if (!isObj(chosen)) return chosen;
  /** @param {string} f */
  const both = (f) => [...new Set([...(Array.isArray(x?.[f]) ? x[f] : []), ...(Array.isArray(y?.[f]) ? y[f] : [])])];
  /** @type {Saved} */
  const earnedAt = {};
  for (const k of keysOf(x?.earnedAt, y?.earnedAt)) {
    const a = x?.earnedAt?.[k]; const b = y?.earnedAt?.[k];
    earnedAt[k] = a && b ? (str(a) <= str(b) ? a : b) : a || b;
  }
  // the quest chest's choices (PRODUCT2-36): a day chosen on either side stays chosen (one piece per chest)
  const picks = { ...(isObj(y?.picks) ? y.picks : {}), ...(isObj(x?.picks) ? x.picks : {}) };
  return { ...chosen, earned: both('earned'), seen: both('seen'), earnedAt, ...(Object.keys(picks).length || isObj(chosen.picks) ? { picks } : {}) };
}

// ------------------------------------------------------------------ mergeTabs

/**
 * Two tabs of this device: `base` is the saved copy both grew from, `mine` this tab's state, `theirs` the other tab's.
 * `mineAt`/`theirsAt`: each side's meta.keyAt (when it last changed each top-level slice). Returns the merged state
 * (without functions).
 * @param {unknown} base
 * @param {unknown} mine
 * @param {unknown} theirs
 * @param {{ mineAt?: Record<string, string> | null, theirsAt?: Record<string, string> | null }} [at]
 * @returns {Saved}
 */
export function mergeTabs(base, mine, theirs, { mineAt = {}, theirsAt = {} } = {}) {
  const b = dataOf(base); const m = dataOf(mine); const t = dataOf(theirs);
  /** @param {string} k */
  const mineWins = (k) => str(mineAt?.[k]) >= str(theirsAt?.[k]);
  // a reset on one side (or a later one): that side's progress, whole
  const reset = same(m.resetAt, t.resetAt) ? null : str(m.resetAt) >= str(t.resetAt) ? m : t;
  const progress = new Set([...PROGRESS, 'outbox', 'stepsOut', 'classGoals']);
  /** @type {Saved} */
  const out = {};
  for (const k of learnFirst(keysOf(m, t))) {
    if (RETIRED.includes(k)) continue; // an older tab's leftovers (migrations.js v7)
    if (reset && progress.has(k)) { if (reset[k] !== undefined) out[k] = reset[k]; continue; }
    if (t[k] === undefined) { out[k] = m[k]; continue; }
    if (m[k] === undefined) { out[k] = t[k]; continue; }
    const v = three(b[k], m[k], t[k], (x, y, z) => tabSlice(k, x, y, z, { out, wins: mineWins(k) }));
    if (v !== undefined) out[k] = v;
  }
  // xp is always the sum of the per-device counter
  if (isObj(out.xpBy) && sumXp(m.xpBy) === m.xp && sumXp(t.xpBy) === t.xp) out.xp = sumXp(out.xpBy);
  return out;
}

/** @typedef {{ out: Saved, wins: boolean }} TabCtx */
/**
 * @param {string} k
 * @param {Json} b
 * @param {Json} m
 * @param {Json} t
 * @param {TabCtx} c
 * @returns {Json}
 */
function tabSlice(k, b, m, t, c) {
  switch (k) {
    case 'xp': return add3(b, m, t);
    case 'xpBy': case 'mistakes': return addMap3(b, m, t);
    case 'days': return perKey3(b, m, t, (x, y, z) => three(x, y, z, (bd, md, td) => tabDay(bd, md, td, c.wins)));
    case 'path': return perKey3(b, m, t, (x, y, z, topic) => three(x, y, z, (bu, mu, tu) => tabUnit(bu, mu, tu, topic, c)));
    case 'progress': return perKey3(b, m, t, (x, y, z) => three(x, y, z, (bp, mp, tp) => (isObj(mp) && isObj(tp) ? { ...generic3(bp, mp, tp, c.wins), level: max2(mp.level, tp.level), max: max2(mp.max, tp.max) } : generic3(bp, mp, tp, c.wins))));
    case 'learn': return isObj(m) && isObj(t) ? tabLearn(b, m, t, c) : generic3(b, m, t, c.wins);
    case 'exams': return newestFirst(set3(b, m, t, idKey), EXAMS_KEEP);
    case 'practiceExams': return newestFirst(set3(b, m, t, idKey), PRACTICE_EXAMS_KEEP);
    case 'teacherExams': return newestFirst(set3(b, m, t, idKey), TEACHER_EXAMS_KEEP);
    case 'outbox': return lastN(set3(b, m, t, idKey).sort(byAsc((e) => e?.at)), OUTBOX_KEEP);
    case 'stepsOut': return lastN(set3(b, m, t, sidKey).sort(byAsc((e) => e?.at)), STEPS_KEEP);
    case 'look': return lookJoin(generic3(b, m, t, c.wins), m, t);
    // the teacher's work waiting for the server: per assignment, as the server merges reports (FOLLOWUP-2)
    case 'workOutbox': return perKey3(b, m, t, (x, y, z) => three(x, y, z, (bw, mw, tw) => workJoin(mw, tw)));
    default: return generic3(b, m, t, c.wins);
  }
}

/**
 * Two tabs' reports of one assignment: learn/assignments.ts mergeWork, the same monotonic rules as the server and
 * lib/classWork.js (done stays done, stage and passed only go up, the first finished result is kept). The report that
 * finished first goes in as the older one, so its result is the one kept whichever tab wrote last; a report one tab
 * sent and the other did not touch stays sent (three).
 */
/** @type {(x: Json, y: Json) => Json} */
const workJoin = (x, y) => (x?.doneAt && y?.doneAt && str(y.doneAt) < str(x.doneAt) ? mergeWork(y, x) : mergeWork(x, y));

/**
 * @param {Json} b
 * @param {Json} m
 * @param {Json} t
 * @param {boolean} wins
 * @returns {Json}
 */
function tabDay(b, m, t, wins) {
  if (!isObj(m)) return t; if (!isObj(t)) return m;
  /** @type {Saved} */
  const out = {};
  for (const f of keysOf(m, t)) {
    const x = m[f]; const y = t[f]; const z = isObj(b) ? b[f] : undefined;
    if (DAY_MAX.has(f)) out[f] = max2(x, y);
    else if (DAY_OR.has(f)) out[f] = orJoin(x, y);
    else if (isNum(x) || isNum(y)) out[f] = add3(z, x, y); // every counter of the day adds, the unknown ones too (tsecs)
    else { const v = generic3(z, x, y, wins); if (v !== undefined) out[f] = v; }
  }
  return out;
}

/**
 * @param {Json} b
 * @param {Json} m
 * @param {Json} t
 * @param {string} topic
 * @param {TabCtx} c
 * @returns {Json}
 */
function tabUnit(b, m, t, topic, c) {
  if (!isObj(m)) return t; if (!isObj(t)) return m;
  /** @type {Saved} */
  const out = {};
  for (const f of keysOf(b, m, t)) {
    const x = m[f]; const y = t[f]; const z = isObj(b) ? b[f] : undefined;
    let v;
    if (f === 'parts') v = three(z, x, y, addMap3);
    else if (f === 'reviews') v = three(z, x, y, add3);
    else if (f === 'jumped') v = max2(x, y);
    else if (f === 'done') {
      v = perKey3(z, x, y, (bv, mv, tv, level) => three(bv, mv, tv, () => doneJoin(mv, tv, failedOf(c.out.learn, topic, level))));
    } else v = generic3(z, x, y, c.wins);
    if (v !== undefined) out[f] = v;
  }
  return out;
}

/**
 * @param {Json} b
 * @param {Saved} m
 * @param {Saved} t
 * @param {TabCtx} c
 * @returns {Saved}
 */
function tabLearn(b, m, t, c) {
  /** @type {Saved} */
  const out = {};
  for (const f of keysOf(m, t)) {
    const x = m[f]; const y = t[f]; const z = isObj(b) ? b[f] : undefined;
    let v;
    if (f === 'skills') v = perKey3(z, x, y, (bs, ms, ts) => three(bs, ms, ts, (bb, mm, tt) => tabSkill(bb, mm, tt, c)));
    else if (f === 'miscon') v = perKey3(z, x, y, (bm, mm, tm) => three(bm, mm, tm, () => (!isObj(mm) ? tm : !isObj(tm) ? mm : str(tm.at) > str(mm.at) ? tm : str(mm.at) > str(tm.at) ? mm : c.wins ? mm : tm)));
    else if (f === 'missions') v = perKey3(z, x, y, (bd, md, td) => three(bd, md, td, () => (c.wins ? missionJoin(md, td) : missionJoin(td, md))));
    else if (f === 'events') v = three(z, x, y, (bb, mm, tt) => sortEvents(set3(bb, mm, tt, eventKey)));
    else if (f === 'exam') v = three(z, x, y, (bb, mm, tt) => examJoin(mm, tt, !c.wins));
    else if (f === 'challenges') v = perKey3(z, x, y, (bc, mc, tc) => three(bc, mc, tc, () => challengeJoin(mc, tc)));
    else if (f === 'floor') v = three(z, x, y, (bb, mm, tt) => floorJoin(mm, tt, !c.wins));
    else v = three(z, x, y, (bb, mm, tt) => generic3(bb, mm, tt, c.wins));
    if (v !== undefined) out[f] = v;
  }
  return out;
}

/**
 * @param {Json} b
 * @param {Json} m
 * @param {Json} t
 * @param {TabCtx} c
 * @returns {Json}
 */
function tabSkill(b, m, t, c) {
  if (!isObj(m)) return t; if (!isObj(t)) return m;
  /** @type {Saved} */
  const bb = isObj(b) ? b : {};
  /** @type {Saved} */
  const out = {};
  for (const f of keysOf(m, t)) {
    if (f === 'attempts' || f === 'taught' || f === 'mastered' || f === 'failedChecks') continue;
    const v = generic3(bb[f], m[f], t[f], c.wins);
    if (v !== undefined) out[f] = v;
  }
  out.attempts = three(bb.attempts, m.attempts, t.attempts, (x, y, z) => sortAttempts(set3(x, y, z, attemptKey)));
  if (!Array.isArray(out.attempts)) out.attempts = [];
  const taught = three(bb.taught, m.taught, t.taught, (x, y, z) => taughtJoin(y, z));
  if (taught !== undefined) out.taught = taught;
  // mastery: a change on one side only is taken as it is; on both, the side whose mastery is newer
  const mUnchanged = same(m.mastered, bb.mastered); const tUnchanged = same(t.mastered, bb.mastered);
  const side = mUnchanged && !tUnchanged ? t : tUnchanged && !mUnchanged ? m : masterySide(m, t);
  if (side.mastered !== undefined) out.mastered = side.mastered;
  // failed checks: added when no mastery changed (two failed checks are two), else from the side whose mastery won
  const failed = mUnchanged && tUnchanged ? three(bb.failedChecks, m.failedChecks, t.failedChecks, add3) : side.failedChecks;
  if (failed !== undefined) out.failedChecks = failed;
  return out;
}

// ------------------------------------------------------------------ mergeDevices

/**
 * Two devices of one student. `local` is this device's state, `remote` the other copy (a backup file, the vault).
 * `localAt`/`remoteAt`: when each was saved (this device's meta.at, the payload's at): "the newer side" for the few
 * fields that are not counters. Returns the merged state (without functions). Monotonic: no counter goes down, no
 * mastery or attempt is lost (except a 'kept' stair the other side reopened, see doneJoin), and merging a copy with
 * itself returns it.
 * @param {unknown} local
 * @param {unknown} remote
 * @param {{ localAt?: string | null, remoteAt?: string | null }} [at]
 * @returns {Saved}
 */
export function mergeDevices(local, remote, { localAt = null, remoteAt = null } = {}) {
  const l = dataOf(local); const r = dataOf(remote);
  const newerRemote = str(remoteAt) > str(localAt);
  /** @type {(x: Json, y: Json) => Json} */
  const newer = (x, y) => (x === undefined ? y : y === undefined ? x : newerRemote ? y : x);
  const lr = str(l.resetAt); const rr = str(r.resetAt);
  const reset = lr === rr ? null : rr > lr ? r : l;
  /** @type {Saved} */
  const out = {};
  /** @type {DevCtx} */
  const ctx = { out, newerRemote, newer };
  for (const k of learnFirst(keysOf(l, r))) {
    if (RETIRED.includes(k)) continue; // an older device's leftovers (migrations.js v7)
    let v;
    if (DEVICE_ONLY.includes(k)) v = l[k];
    else if (SETTINGS.includes(k)) v = l[k] !== undefined ? l[k] : r[k];
    else if (k === 'profile') v = profileJoin(l.profile, r.profile);
    else if (reset && PROGRESS.includes(k)) v = reset[k];
    else v = deviceSlice(k, l[k], r[k], ctx);
    if (v !== undefined) out[k] = v;
  }
  if (isObj(out.xpBy)) out.xp = sumXp(out.xpBy);
  return out;
}

/** @typedef {{ out: Saved, newerRemote: boolean, newer: (x: Json, y: Json) => Json }} DevCtx */
/** @type {(a: Json, b: Json) => Json} */
const maxMap = (a, b) => {
  if (!isObj(a)) return isObj(b) ? { ...b } : a ?? b;
  if (!isObj(b)) return { ...a };
  /** @type {Saved} */
  const out = {};
  for (const k of keysOf(a, b)) out[k] = max2(a[k], b[k]);
  return out;
};

/**
 * @param {string} k
 * @param {Json} x
 * @param {Json} y
 * @param {DevCtx} c
 * @returns {Json}
 */
function deviceSlice(k, x, y, c) {
  if (x === undefined) return y;
  if (y === undefined) return x;
  switch (k) {
    case 'xp': return max2(x, y); // replaced by the sum of xpBy
    case 'xpBy': case 'mistakes': return maxMap(x, y);
    case 'resetAt': return str(x) >= str(y) ? x : y;
    case 'days': return perKeyJoin(x, y, (a, b) => deviceDay(a, b, c));
    case 'path': return perKeyJoin(x, y, (a, b, topic) => deviceUnit(a, b, topic, c));
    case 'progress': return perKeyJoin(x, y, (a, b) => (isObj(a) && isObj(b) ? { ...c.newer(a, b), level: max2(a.level, b.level), max: max2(a.max, b.max) } : c.newer(a, b)));
    case 'gaps': return perKeyJoin(x, y, (a, b) => {
      if (!isObj(a) || !isObj(b)) return c.newer(a, b);
      const later = str(b.at) > str(a.at) ? b : str(a.at) > str(b.at) ? a : c.newer(a, b);
      return { ...later, n: max2(a.n, b.n), ok: max2(a.ok, b.ok) };
    });
    case 'learn': return isObj(x) && isObj(y) ? deviceLearn(x, y, c) : c.newer(x, y);
    case 'exams': return newestFirst(unionById(x, y, c), EXAMS_KEEP);
    case 'practiceExams': return newestFirst(unionById(x, y, c), PRACTICE_EXAMS_KEEP);
    case 'teacherExams': return newestFirst(unionById(x, y, c), TEACHER_EXAMS_KEEP);
    case 'placement': case 'lastTopic': case 'freezes': return c.newer(x, y);
    case 'look': return lookJoin(c.newer(x, y), x, y);
    // the streak's last repair: the later one, so a repair on either device waits its 30 days (lib/streak.js)
    case 'streak': return isObj(x) && isObj(y) ? { ...c.newer(x, y), lastRepair: str(x.lastRepair) >= str(y.lastRepair) ? x.lastRepair ?? null : y.lastRepair ?? null } : c.newer(x, y);
    default: return isNum(x) && isNum(y) ? Math.max(x, y) : c.newer(x, y); // a field this merge does not know
  }
}

/**
 * Per key: a key on one side only is taken; on both, `fn(a, b, key)`.
 * @param {Json} a
 * @param {Json} b
 * @param {(a: Json, b: Json, key: string) => Json} fn
 * @returns {Json}
 */
function perKeyJoin(a, b, fn) {
  if (!isObj(a)) return isObj(b) ? b : a ?? b;
  if (!isObj(b)) return a;
  /** @type {Saved} */
  const out = {};
  for (const k of keysOf(a, b)) {
    const v = a[k] === undefined ? b[k] : b[k] === undefined ? a[k] : fn(a[k], b[k], k);
    if (v !== undefined) out[k] = v;
  }
  return out;
}

/**
 * @param {Json} a
 * @param {Json} b
 * @param {DevCtx} c
 * @returns {Json[]}
 */
function unionById(a, b, c) {
  if (!Array.isArray(a)) return Array.isArray(b) ? b : [];
  if (!Array.isArray(b)) return a;
  /** @type {Map<string, number>} */ const byId = new Map(); /** @type {Json[]} */ const out = [];
  for (const x of a) { const k = idKey(x); if (!byId.has(k)) { byId.set(k, out.length); out.push(x); } }
  for (const y of b) {
    const k = idKey(y);
    const at = byId.get(k);
    if (at === undefined) { byId.set(k, out.length); out.push(y); } else if (c.newerRemote) out[at] = y;
  }
  return out;
}

/**
 * @param {Json} a
 * @param {Json} b
 * @param {DevCtx} c
 * @returns {Json}
 */
function deviceDay(a, b, c) {
  if (!isObj(a) || !isObj(b)) return c.newer(a, b);
  /** @type {Saved} */
  const out = {};
  for (const f of keysOf(a, b)) {
    const x = a[f]; const y = b[f];
    if (DAY_OR.has(f)) out[f] = orJoin(x, y);
    else if (isNum(x) || isNum(y)) out[f] = max2(x, y); // every counter of the day, the unknown ones too
    else { const v = c.newer(x, y); if (v !== undefined) out[f] = v; }
  }
  return out;
}

/**
 * @param {Json} a
 * @param {Json} b
 * @param {string} topic
 * @param {DevCtx} c
 * @returns {Json}
 */
function deviceUnit(a, b, topic, c) {
  if (!isObj(a) || !isObj(b)) return c.newer(a, b);
  /** @type {Saved} */
  const out = {};
  for (const f of keysOf(a, b)) {
    const x = a[f]; const y = b[f];
    let v;
    if (f === 'parts') v = maxMap(x, y);
    else if (f === 'reviews' || f === 'jumped') v = max2(x, y);
    else if (f === 'done') {
      /** @type {Saved} */
      const done = {};
      v = done;
      for (const level of keysOf(x, y)) {
        const d = doneJoin(x?.[level], y?.[level], failedOf(c.out.learn, topic, level));
        if (d !== undefined) done[level] = d;
      }
    } else v = c.newer(x, y);
    if (v !== undefined) out[f] = v;
  }
  return out;
}

/**
 * @param {Saved} x
 * @param {Saved} y
 * @param {DevCtx} c
 * @returns {Saved}
 */
function deviceLearn(x, y, c) {
  /** @type {Saved} */
  const out = {};
  for (const f of keysOf(x, y)) {
    const a = x[f]; const b = y[f];
    let v;
    if (a === undefined || b === undefined) v = a ?? b;
    else if (f === 'skills') v = perKeyJoin(a, b, (p, q) => deviceSkill(p, q, c));
    else if (f === 'miscon') v = perKeyJoin(a, b, (p, q) => (!isObj(p) || !isObj(q) ? c.newer(p, q) : str(q.at) > str(p.at) ? q : str(p.at) > str(q.at) ? p : c.newer(p, q)));
    else if (f === 'missions') v = perKeyJoin(a, b, (p, q) => (c.newerRemote ? missionJoin(q, p) : missionJoin(p, q)));
    else if (f === 'events') v = sortEvents(union(a, b, eventKey));
    else if (f === 'exam') v = examJoin(a, b, c.newerRemote);
    else if (f === 'challenges') v = isObj(a) && isObj(b) ? perKeyJoin(a, b, challengeJoin) : c.newer(a, b);
    else if (f === 'floor') v = floorJoin(a, b, c.newerRemote);
    else v = isNum(a) && isNum(b) ? Math.max(a, b) : c.newer(a, b);
    if (v !== undefined) out[f] = v;
  }
  return out;
}

/**
 * @param {Json} a
 * @param {Json} b
 * @param {DevCtx} c
 * @returns {Json}
 */
function deviceSkill(a, b, c) {
  if (!isObj(a) || !isObj(b)) return c.newer(a, b);
  /** @type {Saved} */
  const out = {};
  for (const f of keysOf(a, b)) {
    if (f === 'attempts' || f === 'taught' || f === 'mastered' || f === 'failedChecks') continue;
    const v = isNum(a[f]) && isNum(b[f]) ? Math.max(a[f], b[f]) : c.newer(a[f], b[f]);
    if (v !== undefined) out[f] = v;
  }
  out.attempts = sortAttempts(union(a.attempts, b.attempts, attemptKey));
  const taught = taughtJoin(a.taught, b.taught);
  if (taught !== undefined) out.taught = taught;
  const side = masterySide(a, b);
  if (side.mastered !== undefined) out.mastered = side.mastered;
  if (side.failedChecks !== undefined) out.failedChecks = side.failedChecks;
  return out;
}

/**
 * The profile: this device's, with any field it lacks taken from the other copy, except what lets someone act as the
 * student or the teacher: the class token, the student id and a teacher's class keys never come in through a merge.
 * @param {Json} local
 * @param {Json} remote
 * @returns {Json}
 */
function profileJoin(local, remote) {
  if (!isObj(remote)) return local ?? remote;
  const { token, studentId, ...rest } = remote; // eslint-disable-line no-unused-vars
  /** @type {(v: unknown) => unknown} */
  const strip = (v) => (Array.isArray(v) ? v.map((cls) => { if (!isObj(cls)) return cls; const { key, ...keep } = cls; return keep; }) : v); // eslint-disable-line no-unused-vars
  if (!isObj(local)) {
    if (local !== null && local !== undefined) return local;
    return { ...rest, ...(rest.classes !== undefined ? { classes: strip(rest.classes) } : {}) };
  }
  /** @type {Saved} */
  const out = { ...local };
  for (const [k, v] of Object.entries(rest)) if (out[k] === undefined) out[k] = k === 'classes' ? strip(v) : v;
  return out;
}

// ------------------------------------------------------------------ the merge log

/**
 * A merge is logged among the learning events, with no content: { e: 'merge', m: 'tab' | 'vault' | 'file' | ... }.
 * @template T
 * @param {T} state
 * @param {string} m
 * @param {string} at
 * @returns {T}
 */
export function noteMerge(state, m, at) {
  if (!isObj(state) || !isObj(state.learn) || !Array.isArray(state.learn.events)) return state;
  return { ...state, learn: { ...state.learn, events: logEvent(state.learn.events, { e: 'merge', m }, at) } };
}
