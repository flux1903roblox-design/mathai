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
    expect(useApp.getState().nudges).toEqual({ repairDismissed: '2026-11-11', pbWeek: '2026-11-08' });
    useApp.getState().resetProgress();
    expect(useApp.getState()).toMatchObject({ streak: { lastRepair: null }, nudges: { repairDismissed: null, pbWeek: null } });
  });
});
