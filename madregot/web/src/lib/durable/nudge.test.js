// When the app asks whether to keep a backup (nudge.js): every condition on its own, and the 14 days. Since COUNCIL2-24 it
// keeps reminding, 14 days apart, until a backup or an install exists.
import { describe, it, expect, vi } from 'vitest';
import { createStore } from 'zustand/vanilla';
import { shouldNudge, noteNudge, calmRoute, installedHere, NUDGE_GAP_DAYS } from './nudge.js';
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

  it('keeps reminding, 14 days apart, however many times it asked; asking counts when it opens', () => {
    const store = createStore(() => base());
    noteNudge(store, NOW);
    expect(store.getState().durable).toMatchObject({ nudgeCount: 1, nudgeAt: NOW.toISOString() });
    expect(ask(store.getState())).toBe(false);
    const day13 = new Date(NOW.getTime() + 13 * 864e5);
    const day15 = new Date(NOW.getTime() + 15 * 864e5);
    expect(ask(store.getState(), { now: day13 })).toBe(false);
    expect(ask(store.getState(), { now: day15 })).toBe(true);
    // the third, the tenth: each one 14 days after the last (it used to stop after two)
    let t = day15;
    for (let n = 2; n <= 10; n += 1) {
      noteNudge(store, t);
      expect(store.getState().durable.nudgeCount).toBe(n);
      expect(ask(store.getState(), { now: new Date(t.getTime() + (NUDGE_GAP_DAYS - 1) * 864e5) })).toBe(false);
      t = new Date(t.getTime() + NUDGE_GAP_DAYS * 864e5);
      expect(ask(store.getState(), { now: t }), `ask ${n + 1}`).toBe(true);
    }
  });

  it('stops once a backup exists (made here, restored, or kept by the class or the family)', () => {
    const st = base({ durable: { ...DURABLE_DEFAULTS, nudgeCount: 6, nudgeAt: '2026-09-01T10:00:00.000Z' } });
    expect(ask(st)).toBe(true);
    expect(ask({ ...st, backup: { ...BACKUP_DEFAULTS, on: true, code: 'ABCDEFGHJKMNPQRS', note: 'auto' } })).toBe(false);
    expect(ask({ ...st, backup: { ...BACKUP_DEFAULTS, on: true, escrow: 'class' } })).toBe(false);
  });

  it('stops once the app is installed here (the Home Screen app, or the store app)', () => {
    const st = base({ durable: { ...DURABLE_DEFAULTS, nudgeCount: 3, nudgeAt: '2026-09-01T10:00:00.000Z' } });
    expect(ask(st, { installed: true })).toBe(false);
    expect(ask(st, { installed: false })).toBe(true);
  });

  it('reads the install from the browser: its own window, or the store app\'s shell', () => {
    try {
      vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
      vi.stubGlobal('navigator', { userAgent: 'test' });
      expect(installedHere()).toBe(false);
      vi.stubGlobal('window', { matchMedia: (q) => ({ matches: q === '(display-mode: standalone)' }) });
      expect(installedHere()).toBe(true);
      vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
      vi.stubGlobal('navigator', { userAgent: 'iPhone', standalone: true }); // an older iPhone says it this way
      expect(installedHere()).toBe(true);
      vi.stubGlobal('navigator', { userAgent: 'test' });
      vi.stubGlobal('Capacitor', { isNativePlatform: () => true });
      expect(installedHere()).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
