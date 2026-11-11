// Saved data from an older version, brought up to date one step at a time (DURABLE-1). Each step says which version it
// produces; migrate() runs every step newer than the saved version, in order. Every step is idempotent: run on data
// that already went through it, it changes nothing. That matters while two builds share one address for a while (an
// old tab and a new one): the older build may write the data back under its own, lower version number, and the newer
// one then runs those steps again.
//   v1 → v2 (Madregot 2.0): the learning model is added, seeded from the misconceptions already recorded (gaps).
//   v2 → v3 (the paid tutor): the parent's account never lives in the child's store (ai.account is dropped), and a
//           personal Claude key and a saved server address are dropped from builds that cannot use them: these builds
//           have no setting to change or clear the address (it lives in "מתקדם", compiled in only with
//           VITE_ALLOW_PERSONAL_KEY=1), so an old one would point the app at a server for good. Everything else is kept.
//   v3 → v4: a stair is done only after its mastery check. Every stair that was done before stays done ('kept', and its
//           mastery check is offered); stairs already mastered are marked so. Evidence a number-line exercise recorded
//           under the wrong name is moved to the mistake it really showed.
//   v4 → v5: XP becomes a per-device counter (xpBy, this device's tag), with room for a deliberate reset (resetAt), the
//           save prompts (durable) and the backup settings (backup).
//   v5 → v6 (class work from the teacher, TEACHER-5): the last class work fetched (classWork) and the reports waiting
//           for the server (workOutbox). A save that has them already keeps them.
// Fields this module does not know are kept as they are, so a field another part of the app adds survives.
import { emptyLearn, migrateLearn, relabelLegacyEvidence } from '@/learn/storeGlue.ts';
import { migratePath } from '../path.js';
import { newTag as makeNewTag, sumXp, TAG } from './xp.js';
import { validateState } from './validate.js';

export const CURRENT_VERSION = 6;

/**
 * The tutor on this device: the server (or a personal key, only in builds with VITE_ALLOW_PERSONAL_KEY=1), an anonymous
 * device id, the family-device token (AI only, never the parent's session), a link code waiting for a parent, and the
 * tier the server reported last (to say once that a plan ended). A new store adds introSeen (store.js), which no step
 * writes: it is read as `=== true`, so a state saved before it existed shows the introduction to the tutor once.
 */
export const AI_DEFAULTS = Object.freeze({ mode: 'server', apiUrl: '', key: '', device: '', familyDevice: null /* {token, label} */, pendingLink: null /* {code, secret, expiresAt, url} */, lastTier: null });
/** This device's save settings: its tag (xpBy), when the browser was asked to keep the data, and the save prompts. */
export const DURABLE_DEFAULTS = Object.freeze({ tag: null, persistAsked: null, installHintAt: null, nudgeAt: null, nudgeCount: 0, escrowClass: true });
/**
 * The backup of this student's progress: off until the student or a parent turns it on. With the backup code (DURABLE-5,
 * durable/vault.js): the code, its lookup token, the vault's rev and when it was last pushed, the hash of what was pushed,
 * the sync's state ('idle' | 'offline' | 'error' | 'unavailable' | 'too_big' | 'other_student' | 'gone') and a one-time
 * note for Settings ('recreated').
 */
export const BACKUP_DEFAULTS = Object.freeze({ on: false, code: null, lookup: null, rev: null, at: null, hash: null, escrow: null, undoUntil: null, forcePush: false, state: null, note: null });

/**
 * Nothing from a teacher yet (and after leaving the class): the last GET /api/class/work of a class student (lib/classWork.js).
 * A new object each time: the store keeps it and replaces it whole.
 */
export function emptyClassWork() {
  return { at: null /* iso of the last fetch */, today: null, teacherName: '', assignments: [], help: [], exams: {} /* assignmentId -> frozen items */, seenAt: null /* the last opening of /quests */, noticed: {} /* help messageId -> true */ };
}

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

export const MIGRATIONS = [
  {
    to: 2,
    // a save that has a learning model already keeps it (only its missing parts are added)
    up: (st) => ({ ...st, learn: isObj(st.learn) ? { ...emptyLearn(), ...st.learn } : migrateLearn(isObj(st.gaps) ? st.gaps : {}) }),
  },
  {
    to: 3,
    up: (st, { personal = false } = {}) => {
      const { account, ...ai } = isObj(st.ai) ? st.ai : {}; // eslint-disable-line no-unused-vars
      let next = { ...AI_DEFAULTS, ...ai };
      if (!personal) next = { ...next, key: '', mode: 'server', apiUrl: '' };
      return { ...st, ai: next };
    },
  },
  {
    to: 4,
    up: (st) => {
      const path = isObj(st.path) ? st.path : {};
      const progress = isObj(st.progress) ? st.progress : {};
      const learn = isObj(st.learn) ? st.learn : emptyLearn();
      const next = migratePath(path, progress, isObj(learn.skills) ? learn.skills : {});
      // A topic that has `done` already went through this step (an older build wrote the save back as v3): a stair its
      // mastery check reopened since must stay open, so only a mastery reached meanwhile is added.
      for (const [topic, u] of Object.entries(path)) {
        if (!isObj(u?.done)) continue;
        const done = { ...u.done };
        for (const [L, v] of Object.entries(next[topic]?.done || {})) if (v === 'mastered') done[L] = 'mastered';
        next[topic] = { ...u, done };
      }
      return { ...st, path: next, learn: relabelLegacyEvidence(learn) };
    },
  },
  {
    to: 5,
    up: (st, { newTag = makeNewTag } = {}) => {
      const durable = { ...DURABLE_DEFAULTS, ...(isObj(st.durable) ? st.durable : {}) };
      if (!(typeof durable.tag === 'string' && TAG.test(durable.tag))) durable.tag = newTag();
      const xp = Number.isFinite(st.xp) && st.xp > 0 ? st.xp : 0;
      let xpBy = {};
      if (isObj(st.xpBy)) for (const [t, v] of Object.entries(st.xpBy)) if (Number.isFinite(v) && v > 0) xpBy[t] = v;
      const diff = xp - sumXp(xpBy);
      // XP an older build added without the counter was earned here; an older build that lowered XP (a reset) starts it again
      if (diff > 0) xpBy = { ...xpBy, [durable.tag]: (xpBy[durable.tag] || 0) + diff };
      else if (diff < 0) xpBy = xp > 0 ? { [durable.tag]: xp } : {};
      return {
        ...st,
        xp,
        xpBy,
        resetAt: typeof st.resetAt === 'string' ? st.resetAt : null,
        durable,
        backup: { ...BACKUP_DEFAULTS, ...(isObj(st.backup) ? st.backup : {}) },
      };
    },
  },
  {
    to: 6,
    // the teacher's class work (TEACHER-5); what an older build wrote back under v5 is kept, its missing parts added
    up: (st) => ({
      ...st,
      classWork: { ...emptyClassWork(), ...(isObj(st.classWork) ? st.classWork : {}) },
      workOutbox: isObj(st.workOutbox) ? st.workOutbox : {},
    }),
  },
];

/**
 * `saved` (the store's state as it was saved at `fromVersion`) brought up to CURRENT_VERSION. `opts.personal`: the build
 * can use a personal Claude key; `opts.newTag`: makes the device tag (tests pass a fixed one). Broken or missing data
 * starts from nothing, and the store's defaults fill it. A save from a newer version runs no step and keeps every field.
 */
export function migrate(saved, fromVersion, opts = {}) {
  const from = Number.isFinite(fromVersion) ? fromVersion : 0;
  let st = isObj(saved) ? { ...saved } : {};
  // from v2 on the learning model is there: it gains any part a later build added, and a broken one starts empty
  if (from >= 2) st.learn = isObj(st.learn) ? { ...emptyLearn(), ...st.learn } : emptyLearn();
  for (const m of MIGRATIONS) if (m.to > from) st = m.up(st, opts);
  if (import.meta.env?.DEV) {
    const problems = validateState(st);
    // eslint-disable-next-line no-console
    if (problems.length) console.error(`Madregot: the saved data from v${from} has problems after migrating:\n  ${problems.join('\n  ')}`);
  }
  return st;
}
