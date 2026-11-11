import { describe, it, expect, afterEach, vi } from 'vitest';
import { migrateState } from './store.js';

const v2 = (ai) => ({ profile: { role: 'student', name: 'נועה', grade: '7' }, xp: 40, days: { '2026-11-05': { q: 3 } }, learn: { skills: {} }, ai });

describe('saved data v3: the parent account never lives in the child store', () => {
  it('drops ai.account and keeps everything else', () => {
    const out = migrateState(v2({ mode: 'server', apiUrl: 'https://x.example', key: '', device: 'a'.repeat(32), account: { token: 't'.repeat(64), email: 'p@example.test' } }), 2, { personal: false });
    expect(out.ai.account).toBeUndefined();
    expect(out.ai.device).toBe('a'.repeat(32));
    expect(out.ai.familyDevice).toBeNull();
    expect(out.ai.pendingLink).toBeNull();
    expect(out.xp).toBe(40);
    expect(out.days['2026-11-05'].q).toBe(3);
    expect(out.profile.name).toBe('נועה');
  });
  it('drops a personal key and personal mode where the build cannot use one', () => {
    const out = migrateState(v2({ mode: 'personal', key: 'k-123', apiUrl: '', device: '' }), 2, { personal: false });
    expect(out.ai.key).toBe('');
    expect(out.ai.mode).toBe('server');
  });
  it('keeps the personal key and the server address in a build made with VITE_ALLOW_PERSONAL_KEY=1', () => {
    const out = migrateState(v2({ mode: 'personal', key: 'k-123', apiUrl: 'https://my-class.example.test', device: '' }), 2, { personal: true });
    expect(out.ai.key).toBe('k-123');
    expect(out.ai.mode).toBe('personal');
    expect(out.ai.apiUrl).toBe('https://my-class.example.test');
  });
  it('drops a saved server address where the build has no setting to change or clear it', () => {
    const out = migrateState(v2({ mode: 'server', apiUrl: 'https://old-class-server.example.test', key: '', device: 'c'.repeat(32) }), 2, { personal: false });
    expect(out.ai.apiUrl).toBe('');
    expect(out.ai.device).toBe('c'.repeat(32));
    const v1 = migrateState({ gaps: {}, ai: { mode: 'server', apiUrl: 'https://old-class-server.example.test', key: '' } }, 1, { personal: false });
    expect(v1.ai.apiUrl).toBe('');
  });
  it('a v1 save gets the learning model and the v3 ai shape', () => {
    const out = migrateState({ gaps: {}, ai: { mode: 'server', apiUrl: '', key: '' } }, 1, { personal: false });
    expect(out.learn).toBeTruthy();
    expect(out.ai).toMatchObject({ mode: 'server', device: '', familyDevice: null, pendingLink: null, lastTier: null });
  });
  it('broken saved data falls back to the defaults', () => {
    const out = migrateState(null, 2, { personal: false });
    expect(out.ai.mode).toBe('server');
    expect(out.learn).toBeTruthy();
  });
  it('a v3 save is left as it is', () => {
    const ai = { mode: 'server', apiUrl: '', key: '', device: 'b'.repeat(32), familyDevice: { token: 'fd1.x', label: 'הטאבלט' }, pendingLink: null, lastTier: 'family' };
    expect(migrateState(v2(ai), 3, { personal: false }).ai).toEqual(ai);
  });
});

describe('the look (STUDENT-2): prefs.theme', async () => {
  const { useApp } = await import('./store.js');
  it('follows the phone by default, and an old save without prefs keeps that default', () => {
    expect(useApp.getState().prefs).toEqual({ theme: 'system', soundSet: false });
    const migrated = migrateState({ profile: null, xp: 3 }, 4);
    expect(migrated.prefs).toBeUndefined(); // no transform: the store's defaults fill it in
  });
  it('setTheme keeps the choice, and signing out of the device keeps the look', () => {
    useApp.getState().setTheme('dark');
    expect(useApp.getState().prefs.theme).toBe('dark');
    useApp.getState().signOut();
    expect(useApp.getState().prefs.theme).toBe('dark');
    useApp.getState().setTheme('system');
    expect(useApp.getState().prefs.theme).toBe('system');
  });
});

describe('sound in a class (STUDENT-7): quiet from the start, unless the student chose', async () => {
  const { useApp } = await import('./store.js');
  const fresh = () => useApp.setState({ sound: true, haptics: true, prefs: { theme: 'system', soundSet: false } });
  it('sound and vibration are on by default, and vibration is its own setting', () => {
    fresh();
    expect(useApp.getState()).toMatchObject({ sound: true, haptics: true });
    useApp.getState().setHaptics(false);
    expect(useApp.getState()).toMatchObject({ sound: true, haptics: false });
    expect(useApp.getState().prefs.soundSet).toBe(false); // vibration says nothing about the sound choice
  });
  it('joining a class with prefs.soundSet === false turns sound off', () => {
    fresh();
    useApp.getState().quietForClass();
    expect(useApp.getState().sound).toBe(false);
  });
  it('a student who chose sound keeps it on joining (soundSet: true)', () => {
    fresh();
    useApp.getState().setSound(true);
    expect(useApp.getState().prefs.soundSet).toBe(true);
    useApp.getState().quietForClass();
    expect(useApp.getState().sound).toBe(true);
    useApp.getState().setSound(false); // and a choice of "off" stays off
    useApp.getState().quietForClass();
    expect(useApp.getState().sound).toBe(false);
  });
  it('an existing save keeps its value: no transform, and the theme stays', () => {
    const migrated = migrateState({ sound: true, prefs: { theme: 'dark' } }, 4);
    expect(migrated.sound).toBe(true);
    expect(migrated.prefs).toEqual({ theme: 'dark' });
  });
  it('signing out keeps the look; the next student\'s sound choice starts unset', () => {
    fresh();
    useApp.getState().setTheme('dark');
    useApp.getState().setSound(false);
    useApp.getState().signOut();
    expect(useApp.getState()).toMatchObject({ sound: true, prefs: { theme: 'dark', soundSet: false } });
    useApp.getState().setTheme('system');
  });
});

describe('the earned repair (STUDENT-5), through the store', async () => {
  const { useApp, streakOf } = await import('./store.js');
  const L = { kind: 'node', topic: 'signed', level: 1, part: 1, xp: 10, passed: true };
  // a streak of 5 ending Monday 9 Nov, nothing on Tuesday the 10th; today is Wednesday the 11th
  const five = { '2026-11-04': { lessons: 1 }, '2026-11-05': { lessons: 1 }, '2026-11-06': { lessons: 1 }, '2026-11-08': { lessons: 1 }, '2026-11-09': { lessons: 1 } };
  const start = (lastRepair = null) => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-11T12:00:00'));
    useApp.getState().resetProgress();
    useApp.setState({ days: structuredClone(five), streak: { lastRepair }, freezes: 0, goalXp: 20 });
  };
  afterEach(() => { vi.useRealTimers(); });

  it('completeLesson returns streakRepaired on the second item of the day only', () => {
    start();
    const first = useApp.getState().completeLesson(L);
    expect(first).toMatchObject({ streakRepaired: false, streakExtended: true, streak: 1 });
    const second = useApp.getState().completeLesson({ ...L, part: 2 });
    expect(second).toMatchObject({ streakRepaired: true, streakExtended: false, streak: 6 });
    const st = useApp.getState();
    expect(st.days['2026-11-10']).toEqual({ frozen: 'repair' });
    expect(st.streak.lastRepair).toBe('2026-11-11');
    expect(streakOf(st.days)).toBe(6);
    expect(useApp.getState().completeLesson({ ...L, part: 3 }).streakRepaired).toBe(false); // once
  });
  it('not when the last repair was less than 30 days ago', () => {
    start('2026-10-20');
    useApp.getState().completeLesson(L);
    expect(useApp.getState().completeLesson({ ...L, part: 2 })).toMatchObject({ streakRepaired: false, streak: 1 });
    expect(useApp.getState().days['2026-11-10']).toBeUndefined();
  });
  it('a teaching stage and a check count as items too, and a passed mastery check is saved in days[d].mp', () => {
    start();
    expect(useApp.getState().completeStage('signed:1', 'A').streakRepaired).toBe(false);
    const check = useApp.getState().completeCheck({ purpose: 'mastery', skill: 'signed:1', topic: 'signed', level: 1, right: 5, asked: 5, perSkill: {}, passed: true, xp: 15 });
    expect(check).toMatchObject({ streakRepaired: true, streak: 6 });
    expect(useApp.getState().days['2026-11-11']).toMatchObject({ stages: 1, lessons: 1, mp: 1 });
    const failed = useApp.getState().completeCheck({ purpose: 'mastery', skill: 'signed:2', topic: 'signed', level: 2, right: 1, asked: 5, perSkill: {}, passed: false, xp: 0 });
    expect(failed.streakRepaired).toBe(false);
    expect(useApp.getState().days['2026-11-11'].mp).toBe(1); // a check that did not pass is not a mastery pass
  });
  it('a freeze is spent first: settleStreak covers the gap, and then there is nothing to repair', () => {
    start();
    useApp.setState({ freezes: 1 });
    expect(useApp.getState().settleStreak()).toBe(1);
    useApp.getState().completeLesson(L);
    expect(useApp.getState().completeLesson({ ...L, part: 2 })).toMatchObject({ streakRepaired: false, streak: 6 });
    expect(useApp.getState().days['2026-11-10'].frozen).toBe(true);
  });
  it('settleStreak passes over Yom Tov like Shabbat', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-22T12:00:00')); // the day after Yom Kippur
    useApp.getState().resetProgress();
    useApp.setState({ days: { '2026-09-20': { lessons: 1 }, '2026-09-18': { lessons: 1 } }, freezes: 2 });
    expect(useApp.getState().settleStreak()).toBe(0); // nothing missed: no freeze spent
    expect(useApp.getState().freezes).toBe(2);
    expect(streakOf(useApp.getState().days)).toBe(2);
  });
  it('resetProgress clears the repair and the one-time notes', () => {
    start('2026-11-01');
    useApp.getState().setNudge({ repairDismissed: '2026-11-11', pbWeek: '2026-11-08' });
    expect(useApp.getState().nudges).toEqual({ repairDismissed: '2026-11-11', pbWeek: '2026-11-08', goalSeen: {}, installOffers: 0, installDismissedAt: null, pushOffered: false, storeOpenDay: null });
    useApp.getState().resetProgress();
    expect(useApp.getState()).toMatchObject({ streak: { lastRepair: null }, nudges: { repairDismissed: null, pbWeek: null, goalSeen: {} } });
  });
  it('resetProgress keeps the install offers, the store-open day and the reminder: they belong to the device, not to the progress', () => {
    start('2026-11-01');
    useApp.getState().setNudge({ installOffers: 1, installDismissedAt: '2026-11-01', pbWeek: '2026-11-01', pushOffered: true, storeOpenDay: '2026-11-01' });
    useApp.getState().setReminder({ on: true, slot: 18, id: 'a'.repeat(16), secret: 'b'.repeat(32), state: 'on', doneDay: '2026-11-01' });
    useApp.getState().resetProgress();
    expect(useApp.getState().nudges).toEqual({ repairDismissed: null, pbWeek: null, goalSeen: {}, installOffers: 1, installDismissedAt: '2026-11-01', pushOffered: true, storeOpenDay: '2026-11-01' });
    expect(useApp.getState().reminder).toMatchObject({ on: true, slot: 18, id: 'a'.repeat(16) });
    // signing out (Settings turns the reminder off on the server first) starts the device afresh
    useApp.getState().signOut();
    expect(useApp.getState().nudges).toMatchObject({ installOffers: 0, installDismissedAt: null, pushOffered: false });
    expect(useApp.getState().reminder).toEqual({ on: false, slot: 17, id: null, secret: null, state: null, seenDay: null, doneDay: null });
  });
});

describe('the class goal (STUDENT-4): steps for a class student, the weeks the server sent, the moment', async () => {
  const { useApp, STEPS_MAX, uuid } = await import('./store.js');
  const L = { kind: 'node', topic: 'signed', level: 1, part: 1, xp: 10, passed: true };
  const inClass = { role: 'student', name: 'נועה', grade: '7', classCode: 'K7Q2MD', className: 'ז׳3', token: 'stu_token_1', studentId: 's1' };
  const solo = { role: 'student', name: 'נועה', grade: '7' };
  const begin = (profile) => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-11T12:00:00'));
    useApp.getState().resetProgress();
    useApp.setState({ profile, stepsOut: [], classGoals: {} });
  };
  afterEach(() => { vi.useRealTimers(); });
  const SID = /^[0-9a-f-]{36}$/;
  const pts = () => useApp.getState().stepsOut.map((x) => x.pts);

  it('a finished lesson pushes one step of 1, with its own id and time', () => {
    begin(inClass);
    useApp.getState().completeLesson(L);
    const [st] = useApp.getState().stepsOut;
    expect(useApp.getState().stepsOut).toHaveLength(1);
    expect(st).toEqual({ sid: expect.stringMatching(SID), at: new Date('2026-11-11T12:00:00').toISOString(), pts: 1 });
    useApp.getState().completeLesson({ ...L, part: 2 });
    const [a, b] = useApp.getState().stepsOut;
    expect(a.sid).not.toBe(b.sid);
  });
  it('a passed mastery check pushes 3; a check that did not pass, a teaching stage and the placement push 1', () => {
    begin(inClass);
    useApp.getState().completeCheck({ purpose: 'mastery', skill: 'signed:1', topic: 'signed', level: 1, right: 5, asked: 5, perSkill: {}, passed: true, xp: 15 });
    useApp.getState().completeCheck({ purpose: 'mastery', skill: 'signed:2', topic: 'signed', level: 2, right: 1, asked: 5, perSkill: {}, passed: false, xp: 0 });
    useApp.getState().completeCheck({ purpose: 'review', skill: 'signed:1', right: 4, asked: 5, perSkill: {}, passed: true, xp: 5 });
    useApp.getState().completeStage('signed:3', 'A');
    useApp.getState().completePlacement({ grade: '7', xp: 10, bestCombo: 2, results: { signed: { level: 1, asked: 4, right: 3 } } });
    expect(pts()).toEqual([3, 1, 1, 1, 1]);
  });
  it('a student with no class keeps no steps at all', () => {
    begin(solo);
    useApp.getState().completeLesson(L);
    useApp.getState().completeCheck({ purpose: 'mastery', skill: 'signed:1', topic: 'signed', level: 1, right: 5, asked: 5, perSkill: {}, passed: true, xp: 15 });
    useApp.getState().completeStage('signed:2', 'A');
    expect(useApp.getState().stepsOut).toEqual([]);
  });
  it('at most 200 steps wait on the device; takeSteps sends the oldest 50 and returnSteps puts them back first', () => {
    begin(inClass);
    useApp.setState({ stepsOut: Array.from({ length: STEPS_MAX }, (_, i) => ({ sid: `old-${i}`, at: 'x', pts: 1 })) });
    useApp.getState().completeLesson(L);
    expect(useApp.getState().stepsOut).toHaveLength(STEPS_MAX);
    expect(useApp.getState().stepsOut[0].sid).toBe('old-1');
    const sent = useApp.getState().takeSteps(50);
    expect(sent.map((x) => x.sid)).toEqual(Array.from({ length: 50 }, (_, i) => `old-${i + 1}`));
    expect(useApp.getState().stepsOut).toHaveLength(STEPS_MAX - 50);
    useApp.getState().returnSteps(sent);
    expect(useApp.getState().stepsOut[0].sid).toBe('old-1'); // back at the front of the queue
    expect(useApp.getState().stepsOut).toHaveLength(STEPS_MAX);
    // a full queue keeps the newest 200: the oldest goes
    useApp.getState().completeLesson({ ...L, part: 2 });
    expect(useApp.getState().stepsOut).toHaveLength(STEPS_MAX);
    expect(useApp.getState().stepsOut[0].sid).toBe('old-2');
  });
  it('leaving the class drops the steps not sent yet', () => {
    begin(inClass);
    useApp.getState().completeLesson(L);
    useApp.getState().leaveClass();
    expect(useApp.getState().stepsOut).toEqual([]);
    expect(useApp.getState().profile.token).toBeUndefined();
  });
  it('setClassGoal keeps this week and last week, at most 8 weeks; a reached week with a share earns the class scarf, unseen', () => {
    begin(inClass);
    const old = Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`2026-0${1 + Math.floor(i / 4)}-0${1 + (i % 4)}`, { target: 10, have: 3, mine: 1, reached: false }]));
    useApp.setState({ classGoals: old });
    useApp.getState().setClassGoal({ on: true, week: '2026-11-08', target: 60, have: 23, mine: 4, reached: false, last: { week: '2026-11-01', target: 55, have: 61, reached: true, mine: 0 } });
    const cg = useApp.getState().classGoals;
    expect(Object.keys(cg)).toHaveLength(8);
    expect(cg['2026-11-08']).toEqual({ target: 60, have: 23, mine: 4, reached: false });
    expect(cg['2026-11-01']).toEqual({ target: 55, have: 61, mine: 0, reached: true });
    expect(useApp.getState().look.earned).not.toContain('class-scarf'); // reached, but without this student's part
    useApp.getState().setClassGoal({ on: true, week: '2026-11-08', target: 60, have: 64, mine: 9, reached: true, last: null });
    expect(useApp.getState().look.earned).toContain('class-scarf');
    expect(useApp.getState().look.seen).not.toContain('class-scarf');
    expect(useApp.getState().look.earnedAt['class-scarf']).toBe('2026-11-11');
    useApp.getState().setClassGoal({ on: false });
    expect(useApp.getState().classGoals['2026-11-08'].reached).toBe(true); // an answer with the goal off changes nothing
  });
  it('markGoalSeen remembers the week (8 weeks kept), and a reset forgets the class goal', () => {
    begin(inClass);
    for (let d = 1; d <= 9; d += 1) useApp.getState().markGoalSeen(`2026-10-0${d}`);
    const seen = useApp.getState().nudges.goalSeen;
    expect(Object.keys(seen)).toHaveLength(8);
    expect(seen['2026-10-09']).toBe('2026-11-11');
    expect(seen['2026-10-01']).toBeUndefined();
    useApp.getState().resetProgress();
    expect(useApp.getState()).toMatchObject({ stepsOut: [], classGoals: {}, nudges: { goalSeen: {} } });
  });
  it('uuid() has the server\'s shape, also where crypto.randomUUID is missing', () => {
    expect(uuid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    const real = globalThis.crypto.randomUUID;
    try {
      Object.defineProperty(globalThis.crypto, 'randomUUID', { value: undefined, configurable: true });
      expect(uuid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    } finally { Object.defineProperty(globalThis.crypto, 'randomUUID', { value: real, configurable: true }); }
  });
});
