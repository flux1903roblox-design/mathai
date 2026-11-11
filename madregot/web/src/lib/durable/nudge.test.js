// When the app asks whether to keep a backup (nudge.js): every condition on its own, and the count and the 14 days.
import { describe, it, expect } from 'vitest';
import { createStore } from 'zustand/vanilla';
import { shouldNudge, noteNudge, calmRoute, NUDGE_MAX } from './nudge.js';
import { BACKUP_DEFAULTS, DURABLE_DEFAULTS } from './migrations.js';

const NOW = new Date('2026-11-05T10:00:00Z');
const TWO_DAYS = { '2026-11-04': { lessons: 1, xp: 12, q: 8, ok: 7 }, '2026-11-05': { lessons: 1, xp: 15, q: 8, ok: 8 } };
const base = (over = {}) => ({
  profile: { role: 'student', name: 'נועה', grade: '7' }, days: TWO_DAYS, xp: 27,
  backup: { ...BACKUP_DEFAULTS }, durable: { ...DURABLE_DEFAULTS }, ...over,
});
const ask = (st, over = {}) => shouldNudge(st, { pathname: '/', server: true, now: NOW, ...over });

describe('the backup question', () => {
  it('asks a solo student with a server, no backup, two days of learning, on the map', () => {
    expect(ask(base())).toBe(true);
  });

  it('never without a server, with a backup code, or with a copy kept by the class or the family', () => {
    expect(ask(base(), { server: false })).toBe(false);
    expect(ask(base({ backup: { ...BACKUP_DEFAULTS, on: true } }))).toBe(false);
    expect(ask(base({ backup: { ...BACKUP_DEFAULTS, escrow: 'class' } }))).toBe(false);
    expect(ask(base({ backup: { ...BACKUP_DEFAULTS, escrow: 'family' } }))).toBe(false);
  });

  it('not before two different days of learning (two lessons on one day are one day; an opened lesson is none)', () => {
    expect(ask(base({ days: { '2026-11-05': { lessons: 2, xp: 30, q: 16, ok: 15 } } }))).toBe(false);
    expect(ask(base({ days: { '2026-11-04': { lessons: 0, q: 0 }, '2026-11-05': { lessons: 1, xp: 15, q: 8, ok: 8 } } }))).toBe(false);
  });

  it('only on a calm screen: never in a lesson, a teaching stage, a repair, a check, Settings or the restore screen', () => {
    for (const p of ['/', '/quests', '/topics', '/me']) expect(calmRoute(p), p).toBe(true);
    for (const p of ['/lesson/signed/1', '/practice/x', '/placement', '/learn/signed/1/A', '/learn/signed/1', '/repair/signed/1/m',
      '/rescue/check', '/rescue/exam', '/exams/check', '/settings', '/restore', '/parents', '/assistant']) {
      expect(ask(base(), { pathname: p }), p).toBe(false);
    }
  });

  it('a teacher, or no profile, is never asked', () => {
    expect(ask(base({ profile: { role: 'teacher', name: 'רונית', classes: [] } }))).toBe(false);
    expect(ask(base({ profile: null }))).toBe(false);
  });

  it('twice at most, 14 days apart; asking counts when it opens', () => {
    const store = createStore(() => base());
    noteNudge(store, NOW);
    expect(store.getState().durable).toMatchObject({ nudgeCount: 1, nudgeAt: NOW.toISOString() });
    expect(ask(store.getState())).toBe(false);
    const day13 = new Date(NOW.getTime() + 13 * 864e5);
    const day15 = new Date(NOW.getTime() + 15 * 864e5);
    expect(ask(store.getState(), { now: day13 })).toBe(false);
    expect(ask(store.getState(), { now: day15 })).toBe(true);
    noteNudge(store, day15);
    expect(store.getState().durable.nudgeCount).toBe(NUDGE_MAX);
    expect(ask(store.getState(), { now: new Date(day15.getTime() + 60 * 864e5) })).toBe(false);
  });
});
