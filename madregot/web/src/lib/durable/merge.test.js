// The two merges (DURABLE-2): mergeDevices, the monotonic merge of two devices' copies (property tests on 300 seeded
// random pairs, and the named cases of the spec), and mergeTabs, the three-way merge of two tabs (a property test with
// the store's own actions, and the named cases). The grep that keeps every XP write in addXp is in xp.test.js.
import { describe, it, expect } from 'vitest';
import { createStore } from 'zustand/vanilla';
import { mergeDevices, mergeTabs, noteMerge, dataOf, DEVICE_ONLY } from './merge.js';
import { seeded, deepFreeze } from './testing.js';
import { sumXp } from './xp.js';
import { validateState } from './validate.js';
import { appState, today } from '../store.js';
import { emptyLearn } from '@/learn/storeGlue.ts';

// ------------------------------------------------------------------ a small generator of valid v5 states
const TAGS = ['a1b2c3d4', 'b2c3d4e5', 'c3d4e5f6', 'd4e5f6a7'];
const DAYS = ['2026-10-28', '2026-10-29', '2026-10-30', '2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05'];
const TOPICS = ['signed', 'coord', 'eq'];
const at = (n) => new Date(Date.UTC(2026, 9, 1) + n * 3_600_000).toISOString();
// one pool of attempts and events: the same moment is the same attempt on every copy, as it is for real
const ATTEMPTS = Array.from({ length: 30 }, (_, i) => ({ at: at(i), ok: i % 3 !== 0, independent: i % 2 === 0, purpose: i % 7 === 0 ? 'mastery' : 'practice' }));
const EVENTS = Array.from({ length: 50 }, (_, i) => ({ t: at(i), e: i % 4 === 0 ? 'lesson-done' : 'answer', s: `${TOPICS[i % 3]}:${1 + (i % 4)}`, ok: i % 3 !== 0 }));

function randomState(rnd, { resetAt = null } = {}) {
  const int = (n) => Math.floor(rnd() * n);
  const some = (list, p = 0.5) => list.filter(() => rnd() < p);
  const xpBy = Object.fromEntries(some(TAGS).map((t) => [t, 1 + int(200)]));
  const days = Object.fromEntries(some(DAYS, 0.6).map((d) => [d, {
    q: int(40), ok: int(30), secs: int(2000), lessons: int(4), stages: int(3), xp: int(60), combo: int(9), perfect: int(2),
    reviews: int(2), planLessons: int(2), tsecs: int(3000), ...(rnd() < 0.2 ? { frozen: true } : {}), ...(rnd() < 0.3 ? { questsRewarded: true } : {}),
  }]));
  const path = {}; const progress = {}; const skills = {};
  // each stair as it can really be: not started, practised, mastered (with its mastery record), kept from before
  // mastery checks (no record of a pass), or a kept stair reopened by a failed check (its newest mastery event)
  const record = (extra = {}) => ({ attempts: some(ATTEMPTS, 0.3), ...(rnd() < 0.5 ? { taught: { A: at(int(30)), ...(rnd() < 0.5 ? { B: at(int(30)) } : {}) } } : {}), failedChecks: 0, ...extra });
  for (const t of some(TOPICS, 0.8)) {
    const done = {}; let jumped = int(2);
    for (let L = 1; L <= 4; L += 1) {
      const s = `${t}:${L}`; const r = rnd();
      if (r < 0.25) {
        const m = int(30);
        done[L] = 'mastered';
        skills[s] = record({ failedChecks: int(2), mastered: { at: at(m), box: int(4), due: at(m + 48), ...(rnd() < 0.5 ? { lastReview: { at: at(m + int(20)), ok: rnd() < 0.6 } } : {}) } });
      } else if (r < 0.45) {
        done[L] = 'kept';
        if (rnd() < 0.5) skills[s] = record();
      } else if (r < 0.6) {
        jumped = Math.max(jumped, L);
        const check = { at: at(40 + int(20)), ok: false, independent: true, purpose: 'mastery' };
        skills[s] = record({ failedChecks: 1 + int(2) });
        skills[s].attempts = [...skills[s].attempts, check];
      } else if (r < 0.8) skills[s] = record();
    }
    path[t] = { parts: { 1: int(3), 2: int(3), 3: int(3) }, reviews: int(2), jumped, done };
    const level = 1 + int(5); progress[t] = { level, max: level + int(2) };
  }
  const mistakes = Object.fromEntries(some(['signed:sign', 'coord:swap', 'eq:move']).map((k) => [k, 1 + int(10)]));
  const wins = Object.fromEntries(some(['signed:1', 'signed:2', 'coord:3']).map((k) => [k, 1 + int(20)]));
  return {
    profile: { role: 'student', name: 'נועה', grade: '7' }, progress, days, xp: sumXp(xpBy), xpBy, resetAt, path,
    freezes: int(3), goalXp: 20, sound: rnd() < 0.5, mistakes, lastTopic: TOPICS[int(3)], outbox: [],
    ai: { mode: 'server', apiUrl: '', key: '', device: 'x'.repeat(8) }, durable: { tag: TAGS[int(4)] }, backup: { on: false },
    helpSent: 0, solveMode: 'answer', exams: [], practiceExams: [], planBase: {}, wins, gaps: {}, placement: null,
    learn: { ...emptyLearn(), skills, events: some(EVENTS, 0.4) },
  };
}

const failedOf = (st, t, L) => st.learn.skills[`${t}:${L}`]?.failedChecks || 0;
const attemptKey = (a) => `${a.at}|${a.purpose}|${a.ok}|${a.independent}`;
const eventKey = (e) => `${e.t}|${e.e}|${e.s}`;

/** merged ≥ a, field by field (a 'kept' stair the other side reopened excepted, as the rule says). */
function expectAtLeast(merged, a, b) {
  for (const [tag, n] of Object.entries(a.xpBy)) expect(merged.xpBy[tag]).toBeGreaterThanOrEqual(n);
  expect(merged.xp).toBeGreaterThanOrEqual(a.xp);
  for (const [d, day] of Object.entries(a.days)) {
    for (const [f, v] of Object.entries(day)) {
      if (typeof v === 'number') expect(merged.days[d][f], `days.${d}.${f}`).toBeGreaterThanOrEqual(v);
      else if (v === true) expect(merged.days[d][f]).toBe(true);
    }
  }
  for (const [t, u] of Object.entries(a.path)) {
    for (const [L, n] of Object.entries(u.parts)) expect(merged.path[t].parts[L]).toBeGreaterThanOrEqual(n);
    expect(merged.path[t].reviews).toBeGreaterThanOrEqual(u.reviews);
    expect(merged.path[t].jumped).toBeGreaterThanOrEqual(u.jumped);
    for (const [L, mark] of Object.entries(u.done)) {
      const got = merged.path[t].done[L];
      if (mark === 'mastered') expect(got, `path.${t}.done.${L}`).toBe('mastered');
      else if (!b.path[t]?.done?.[L] && failedOf(merged, t, L) > 0) expect(got).toBeUndefined(); // reopened on the other side
      else expect(['mastered', 'kept']).toContain(got);
    }
  }
  for (const [t, p] of Object.entries(a.progress)) {
    expect(merged.progress[t].level).toBeGreaterThanOrEqual(p.level);
    expect(merged.progress[t].max).toBeGreaterThanOrEqual(p.max);
  }
  for (const [k, n] of Object.entries(a.mistakes)) expect(merged.mistakes[k]).toBeGreaterThanOrEqual(n);
  for (const [k, n] of Object.entries(a.wins)) expect(merged.wins[k]).toBeGreaterThanOrEqual(n);
  for (const [s, rec] of Object.entries(a.learn.skills)) {
    if (rec.mastered) expect(merged.learn.skills[s].mastered, `${s} stays mastered`).toBeTruthy();
    const have = new Set(merged.learn.skills[s].attempts.map(attemptKey));
    for (const x of rec.attempts) expect(have.has(attemptKey(x)), `${s} keeps the attempt at ${x.at}`).toBe(true);
  }
  const events = new Set(merged.learn.events.map(eventKey));
  for (const e of a.learn.events) expect(events.has(eventKey(e))).toBe(true);
}

const progressOf = (st) => ({ xp: st.xp, xpBy: st.xpBy, days: st.days, path: st.path, progress: st.progress, mistakes: st.mistakes, wins: st.wins, skills: st.learn.skills, events: st.learn.events });

describe('mergeDevices: 300 seeded random pairs', () => {
  const rnd = seeded(2026);
  const pairs = Array.from({ length: 300 }, () => [deepFreeze(randomState(rnd)), deepFreeze(randomState(rnd))]);
  const A = '2026-11-04T10:00:00.000Z'; const B = '2026-11-05T10:00:00.000Z';

  it('never lowers a counter, a stair, a level, a mastery, an attempt or an event of either side', () => {
    for (const [a, b] of pairs) {
      const m = mergeDevices(a, b, { localAt: A, remoteAt: B });
      expectAtLeast(m, a, b);
      expectAtLeast(m, b, a);
      expect(m.xp).toBe(sumXp(m.xpBy));
      expect(validateState(m)).toEqual([]);
    }
  });

  it('is idempotent: a copy merged with itself is itself', () => {
    for (const [a] of pairs) expect(mergeDevices(a, a, { localAt: A, remoteAt: A })).toEqual(a);
  });

  it('is symmetric in the progress: the same result whichever side is local', () => {
    for (const [a, b] of pairs) {
      expect(progressOf(mergeDevices(a, b, { localAt: A, remoteAt: B }))).toEqual(progressOf(mergeDevices(b, a, { localAt: B, remoteAt: A })));
    }
  });

  it('a merge of merges changes nothing more (merging the result with either side again)', () => {
    for (const [a, b] of pairs.slice(0, 50)) {
      const m = mergeDevices(a, b, { localAt: A, remoteAt: B });
      expect(progressOf(mergeDevices(m, b, { localAt: B, remoteAt: B }))).toEqual(progressOf(m));
    }
  });
});

describe('mergeDevices: the named cases', () => {
  const base = (extra = {}) => ({ ...randomState(seeded(5)), xpBy: { a1b2c3d4: 100 }, xp: 100, resetAt: null, ...extra });

  it('two devices each earn XP: 100 → 110 on one and 100 → 105 on the other gives 115', () => {
    const a = base({ xpBy: { a1b2c3d4: 100, b2c3d4e5: 10 }, xp: 110 });
    const b = base({ xpBy: { a1b2c3d4: 100, c3d4e5f6: 5 }, xp: 105 });
    expect(mergeDevices(a, b)).toMatchObject({ xp: 115, xpBy: { a1b2c3d4: 100, b2c3d4e5: 10, c3d4e5f6: 5 } });
  });

  it('a reset on device B after a lesson on A: B\'s reset wins every progress field, A keeps its own settings', () => {
    const a = base({ xpBy: { a1b2c3d4: 130 }, xp: 130, sound: false, days: { '2026-11-05': { lessons: 1, xp: 30 } } });
    const b = base({ xpBy: {}, xp: 0, days: {}, path: {}, resetAt: '2026-11-05T12:00:00.000Z', learn: emptyLearn() });
    for (const m of [mergeDevices(a, b), mergeDevices(b, a)]) {
      expect(m).toMatchObject({ xp: 0, xpBy: {}, days: {}, path: {}, resetAt: '2026-11-05T12:00:00.000Z' });
      expect(m.learn).toEqual(emptyLearn());
    }
    expect(mergeDevices(a, b).sound).toBe(false);
  });

  it('the tutor, the class outbox, the save settings and the backup never come from the other side', () => {
    const a = base({ ai: { device: 'mine' }, outbox: [{ id: 'm1' }], durable: { tag: 'a1b2c3d4' }, backup: { on: false, code: null } });
    const b = base({ ai: { device: 'theirs', familyDevice: { token: 'x' } }, outbox: [{ id: 't1' }], durable: { tag: 'b2c3d4e5' }, backup: { on: true, code: 'secret' } });
    const m = mergeDevices(a, b, { localAt: A0, remoteAt: B0 });
    for (const k of DEVICE_ONLY) expect(m[k]).toEqual(a[k]);
  });

  it('settings stay local; the profile is local with only missing fields added, never a token, student id or class key', () => {
    const a = base({ sound: false, goalXp: 30, solveMode: 'notebook', profile: { role: 'teacher', name: 'רונית', classes: [{ code: 'K7Q2MD', key: 'local-key' }] } });
    const b = base({ sound: true, goalXp: 10, solveMode: 'answer', profile: { role: 'teacher', name: 'אחרת', school: 'בית ספר', token: 't', studentId: 's', classes: [{ code: 'ZZZZZZ', key: 'their-key' }] } });
    const m = mergeDevices(a, b, { localAt: A0, remoteAt: B0 });
    expect(m).toMatchObject({ sound: false, goalXp: 30, solveMode: 'notebook' });
    // the look and the vibration chosen on this device (STUDENT-2/7) are this device's too
    const looks = mergeDevices(base({ haptics: false, prefs: { theme: 'dark', soundSet: true } }), base({ haptics: true, prefs: { theme: 'light', soundSet: false } }), { localAt: A0, remoteAt: B0 });
    expect(looks).toMatchObject({ haptics: false, prefs: { theme: 'dark', soundSet: true } });
    expect(m.profile).toEqual({ role: 'teacher', name: 'רונית', school: 'בית ספר', classes: [{ code: 'K7Q2MD', key: 'local-key' }] });
    // a device with no profile takes the other's, still without the token, the id or any class key
    const fresh = mergeDevices({ ...a, profile: null }, b);
    expect(fresh.profile).toEqual({ role: 'teacher', name: 'אחרת', school: 'בית ספר', classes: [{ code: 'ZZZZZZ' }] });
  });

  it('a kept stair reopened on one device (failedChecks 1) stays open after merging with a device that still has it kept', () => {
    const skills = (failed) => ({ 'signed:2': { attempts: [], failedChecks: failed } });
    const reopened = base({ path: { signed: { parts: { 2: 2 }, reviews: 0, jumped: 2, done: { 1: 'mastered' } } }, learn: { ...emptyLearn(), skills: skills(1) } });
    const stale = base({ path: { signed: { parts: { 2: 2 }, reviews: 0, jumped: 0, done: { 1: 'mastered', 2: 'kept' } } }, learn: { ...emptyLearn(), skills: skills(0) } });
    for (const m of [mergeDevices(reopened, stale), mergeDevices(stale, reopened)]) {
      expect(m.path.signed.done).toEqual({ 1: 'mastered' });
      expect(m.path.signed.jumped).toBe(2);
    }
    // a stair both devices still have as kept stays kept, whatever old failed checks it has
    const both = base({ path: { signed: { parts: {}, reviews: 0, jumped: 0, done: { 2: 'kept' } } }, learn: { ...emptyLearn(), skills: skills(2) } });
    expect(mergeDevices(both, both).path.signed.done).toEqual({ 2: 'kept' });
    // mastered on either side stays mastered
    const mastered = base({ path: { signed: { parts: {}, reviews: 0, jumped: 0, done: { 2: 'mastered' } } }, learn: { ...emptyLearn(), skills: skills(0) } });
    expect(mergeDevices(reopened, mastered).path.signed.done[2]).toBe('mastered');
  });

  it('a failed review on B (later) beats an older passed review on A, and its failed checks come with it', () => {
    const rec = (lastReview, failedChecks) => ({ attempts: [], failedChecks, mastered: { at: '2026-10-01T10:00:00.000Z', box: 2, due: '2026-10-20T10:00:00.000Z', lastReview } });
    const a = base({ learn: { ...emptyLearn(), skills: { 'eq:1': rec({ at: '2026-10-10T10:00:00.000Z', ok: true }, 0) } } });
    const b = base({ learn: { ...emptyLearn(), skills: { 'eq:1': rec({ at: '2026-10-15T10:00:00.000Z', ok: false }, 1) } } });
    for (const m of [mergeDevices(a, b, { localAt: B0, remoteAt: A0 }), mergeDevices(b, a)]) {
      expect(m.learn.skills['eq:1'].mastered.lastReview).toEqual({ at: '2026-10-15T10:00:00.000Z', ok: false });
      expect(m.learn.skills['eq:1'].failedChecks).toBe(1);
    }
  });

  it('an unknown numeric day field (tsecs) takes the larger value across devices; an unknown other field the newer side', () => {
    const a = base({ days: { '2026-11-05': { lessons: 1, tsecs: 300, note: 'a' } } });
    const b = base({ days: { '2026-11-05': { lessons: 1, tsecs: 200, note: 'b' } } });
    expect(mergeDevices(a, b, { localAt: A0, remoteAt: B0 }).days['2026-11-05']).toEqual({ lessons: 1, tsecs: 300, note: 'b' });
    expect(mergeDevices(a, b, { localAt: B0, remoteAt: A0 }).days['2026-11-05'].note).toBe('a');
  });

  it('a lesson on each device on the same day counts once in that day (the honest limit); XP and the stairs are exact', () => {
    const a = base({ xpBy: { a1b2c3d4: 100, b2c3d4e5: 20 }, xp: 120, days: { '2026-11-05': { lessons: 1, xp: 20 } } });
    const b = base({ xpBy: { a1b2c3d4: 100, c3d4e5f6: 15 }, xp: 115, days: { '2026-11-05': { lessons: 1, xp: 15 } } });
    const m = mergeDevices(a, b);
    expect(m.xp).toBe(135);
    expect(m.days['2026-11-05']).toEqual({ lessons: 1, xp: 20 });
  });

  it('logs and lists: events and attempts are joined in time order, exams by id newest first and capped', () => {
    const exams = (ids) => ids.map((n) => ({ id: `e${n}`, at: at(n), title: `${n}` }));
    const a = base({ exams: exams([1, 3]).reverse() });
    const b = base({ exams: exams([2, 3]).reverse() });
    expect(mergeDevices(a, b).exams.map((e) => e.id)).toEqual(['e3', 'e2', 'e1']);
    const many = base({ exams: exams(Array.from({ length: 30 }, (_, i) => i)).reverse() });
    const more = base({ exams: exams(Array.from({ length: 30 }, (_, i) => i + 20)).reverse() });
    expect(mergeDevices(many, more).exams).toHaveLength(30);
  });
});
const A0 = '2026-11-04T10:00:00.000Z'; const B0 = '2026-11-05T10:00:00.000Z';

// ------------------------------------------------------------------ mergeTabs
/** Apply the store's own actions to a copy of `state`, stamping keyAt as the write path does (one clock for both tabs). */
function tab(state, clock) {
  const s = createStore(appState);
  s.setState(structuredClone(state));
  const keyAt = {};
  return {
    s, keyAt,
    run(fn) {
      const before = s.getState(); fn(s.getState()); const after = s.getState();
      const t = new Date(Date.parse('2026-11-05T08:00:00.000Z') + (clock.n += 1) * 1000).toISOString();
      for (const k of Object.keys(after)) if (typeof after[k] !== 'function' && after[k] !== before[k]) keyAt[k] = t;
    },
    data: () => dataOf(s.getState()),
  };
}

describe('mergeTabs', () => {
  it('property: two tabs from one base add their XP and their day counters, and a setting both changed is the last one set', () => {
    const rnd = seeded(77);
    const int = (n) => Math.floor(rnd() * n);
    for (let run = 0; run < 60; run += 1) {
      const start = { ...dataOf(createStore(appState).getState()), ...randomState(rnd), durable: { tag: 'a1b2c3d4' } };
      start.xpBy = { a1b2c3d4: 50, ...start.xpBy }; start.xp = sumXp(start.xpBy);
      const base = deepFreeze(structuredClone(start));
      const clock = { n: 0 };
      const A = tab(base, clock); const B = tab(base, clock);
      const lastSet = {};
      const actions = [
        (T, name) => T.run((st) => st.recordAnswer({ topic: 'signed', level: 1 + int(3), ok: rnd() < 0.7, first: true, cat: 'sign', secs: 5 + int(30), at: new Date(Date.UTC(2026, 10, 5, 9, 0, clock.n, int(1000))).toISOString() }, 1 + int(3))),
        (T) => T.run((st) => st.completeLesson({ topic: TOPICS[int(3)], level: 1 + int(3), xp: 5 + int(10), kind: 'practice', bestCombo: int(6), perfect: rnd() < 0.3 })),
        (T) => T.run((st) => st.completeStage(`${TOPICS[int(3)]}:${1 + int(4)}`, ['A', 'B', 'C'][int(3)])),
        (T, name) => { const v = rnd() < 0.5; T.run((st) => st.setSound(v)); lastSet.sound = { v, n: clock.n, name }; },
        (T, name) => { const v = { role: 'student', name: `שם ${clock.n}`, grade: '7', n: clock.n }; T.run((st) => st.setProfile(v)); lastSet.profile = { v, n: clock.n, name }; },
      ];
      // the two tabs take turns at random
      for (let i = 0, n = int(10); i < n; i += 1) { const [T, name] = rnd() < 0.5 ? [A, 'A'] : [B, 'B']; actions[int(actions.length)](T, name); }
      const a = A.data(); const b = B.data();
      const m = mergeTabs(base, a, b, { mineAt: A.keyAt, theirsAt: B.keyAt });
      expect(m.xp).toBe(base.xp + (a.xp - base.xp) + (b.xp - base.xp));
      expect(m.xp).toBe(sumXp(m.xpBy));
      const d = today();
      for (const f of ['q', 'ok', 'secs', 'lessons', 'stages', 'xp', 'perfect', 'reviews', 'planLessons']) {
        const v = (x) => x.days[d]?.[f] || 0;
        expect(m.days[d]?.[f] || 0, `days[today].${f}`).toBe(v(base) + (v(a) - v(base)) + (v(b) - v(base)));
      }
      // a setting changed on one side only is that side's; changed on both, the one set last (set back to the base's
      // value, a setting looks unchanged: the other side's change is kept)
      const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);
      for (const [k, { v }] of Object.entries(lastSet)) expect(m[k], k).toEqual(same(a[k], base[k]) ? b[k] : same(b[k], base[k]) ? a[k] : v);
      // every attempt each tab recorded is kept
      for (const side of [a, b]) for (const [s, rec] of Object.entries(side.learn.skills)) for (const x of rec.attempts) expect(m.learn.skills[s].attempts).toContainEqual(x);
      expect(validateState(m)).toEqual([]);
    }
  });

  it('a slice unchanged on one side is the other side\'s; the sound turned off in A survives a lesson in stale B', () => {
    const base = deepFreeze({ sound: true, xp: 10, xpBy: { a1b2c3d4: 10 }, days: {}, solveMode: 'answer' });
    const a = { ...base, sound: false };
    const b = { ...base, xp: 20, xpBy: { a1b2c3d4: 20 }, days: { '2026-11-05': { lessons: 1, xp: 10 } } };
    expect(mergeTabs(base, b, a, { mineAt: { xp: '2', xpBy: '2', days: '2' }, theirsAt: { sound: '1' } })).toEqual({ sound: false, xp: 20, xpBy: { a1b2c3d4: 20 }, days: { '2026-11-05': { lessons: 1, xp: 10 } }, solveMode: 'answer' });
  });

  it('a lesson in each tab: both lessons and the summed XP; the best combo is the larger', () => {
    const base = deepFreeze({ xp: 100, xpBy: { a1b2c3d4: 100 }, days: { '2026-11-05': { lessons: 1, xp: 10, combo: 3 } } });
    const a = { xp: 110, xpBy: { a1b2c3d4: 110 }, days: { '2026-11-05': { lessons: 2, xp: 20, combo: 5 } } };
    const b = { xp: 105, xpBy: { a1b2c3d4: 105 }, days: { '2026-11-05': { lessons: 2, xp: 15, combo: 4 } } };
    expect(mergeTabs(base, a, b)).toEqual({ xp: 115, xpBy: { a1b2c3d4: 115 }, days: { '2026-11-05': { lessons: 3, xp: 25, combo: 5 } } });
  });

  it('an unknown numeric day field (tsecs) adds across tabs', () => {
    const base = { days: { d: { tsecs: 100 } } };
    expect(mergeTabs(base, { days: { d: { tsecs: 160 } } }, { days: { d: { tsecs: 130 } } }).days.d.tsecs).toBe(190);
  });

  it('a setting changed in both tabs goes to the tab that changed it last', () => {
    const base = { sound: true, goalXp: 20 };
    expect(mergeTabs(base, { sound: false, goalXp: 30 }, { sound: true, goalXp: 10 }, { mineAt: { goalXp: '2026-11-05T10:00:01Z' }, theirsAt: { goalXp: '2026-11-05T10:00:02Z' } })).toEqual({ sound: false, goalXp: 10 });
  });

  it('a reset in one tab wins every progress field, whatever the other tab did meanwhile', () => {
    const base = deepFreeze({ xp: 100, xpBy: { a1b2c3d4: 100 }, days: { d: { lessons: 1 } }, resetAt: null, sound: true });
    const reset = { xp: 0, xpBy: {}, days: {}, resetAt: '2026-11-05T10:00:00.000Z', sound: true };
    const lesson = { xp: 110, xpBy: { a1b2c3d4: 110 }, days: { d: { lessons: 2 } }, resetAt: null, sound: false };
    expect(mergeTabs(base, lesson, reset)).toEqual({ xp: 0, xpBy: {}, days: {}, resetAt: '2026-11-05T10:00:00.000Z', sound: false });
  });

  it('a kept stair reopened in one tab stays open; one mastered in the other tab is mastered', () => {
    const skill = (failedChecks) => ({ learn: { ...emptyLearn(), skills: { 'signed:2': { attempts: [], failedChecks } } } });
    const base = deepFreeze({ path: { signed: { parts: {}, done: { 2: 'kept', 3: 'kept' } } }, ...skill(0) });
    const a = { path: { signed: { parts: {}, done: { 3: 'kept' } } }, ...skill(1) }; // A failed the check of stair 2
    const b = { path: { signed: { parts: { 1: 1 }, done: { 2: 'kept', 3: 'mastered' } } }, ...skill(0) }; // B passed stair 3
    expect(mergeTabs(base, a, b).path.signed).toEqual({ parts: { 1: 1 }, done: { 3: 'mastered' } });
  });

  it('a class joined in tab A survives a write from a stale tab B that changed the solve mode', () => {
    const base = deepFreeze({ profile: { role: 'student', name: 'נועה' }, solveMode: 'answer' });
    const a = { profile: { role: 'student', name: 'נועה', classCode: 'K7Q2MD', token: 'tok' }, solveMode: 'answer' };
    const b = { profile: { role: 'student', name: 'נועה' }, solveMode: 'notebook' };
    expect(mergeTabs(base, b, a, { mineAt: { solveMode: '2' }, theirsAt: { profile: '1' } })).toEqual({ profile: a.profile, solveMode: 'notebook' });
  });

  it('logs: events and the class outbox keep both tabs\' new items, and an item one tab removed stays removed', () => {
    const e = (n) => ({ t: at(n), e: 'answer', s: 'signed:1' });
    const base = deepFreeze({ learn: { ...emptyLearn(), events: [e(1), e(2)] }, outbox: [{ id: 'o1', at: at(1) }, { id: 'o2', at: at(2) }] });
    const a = { learn: { ...emptyLearn(), events: [e(1), e(2), e(3)] }, outbox: [{ id: 'o3', at: at(3) }] }; // A's server took o1, o2
    const b = { learn: { ...emptyLearn(), events: [e(1), e(2), e(4)] }, outbox: [{ id: 'o1', at: at(1) }, { id: 'o2', at: at(2) }, { id: 'o4', at: at(4) }] };
    const m = mergeTabs(base, a, b);
    expect(m.learn.events).toEqual([e(1), e(2), e(3), e(4)]);
    expect(m.outbox.map((x) => x.id)).toEqual(['o3', 'o4']);
  });

  it('is pure: it never changes its inputs', () => {
    const rnd = seeded(3);
    const [b, m, t] = [randomState(rnd), randomState(rnd), randomState(rnd)].map(deepFreeze);
    expect(() => mergeTabs(b, m, t)).not.toThrow();
    expect(() => mergeDevices(m, t)).not.toThrow();
  });
});

describe('the merge log', () => {
  it('a merge is one event with no content, ignored by the learning numbers', () => {
    const st = noteMerge({ learn: emptyLearn() }, 'tab', '2026-11-05T10:00:00.000Z');
    expect(st.learn.events).toEqual([{ t: '2026-11-05T10:00:00.000Z', e: 'merge', m: 'tab' }]);
    expect(noteMerge({ sound: true }, 'tab', 'x')).toEqual({ sound: true }); // a state with no log is left alone
  });
});
