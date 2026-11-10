import { describe, it, expect, vi, afterEach } from 'vitest';
import { migrateState, mergeSaved } from './store.js';

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

// A save already at version 4 is not migrated: zustand only merges it over the defaults, and its own merge is shallow.
// learn.floor and learn.challenges (curriculum stage 1) came after v4, so the persist merge fills them in.
describe('saved data v4 without the new learn fields', () => {
  const v4 = { profile: { role: 'student', name: 'נועה', grade: '7' }, xp: 120, learn: { skills: { 'signed:1': { attempts: [] } }, miscon: {}, exam: null, missions: {}, events: [] } };
  afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

  it('rehydrates with floor === null and challenges equal to {}, and keeps what was saved', async () => {
    const mem = new Map([['madregot', JSON.stringify({ state: v4, version: 4 })]]);
    vi.stubGlobal('localStorage', { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) });
    vi.resetModules();
    const { useApp } = await import('./store.js');
    await useApp.persist.rehydrate();
    const { learn, xp, profile } = useApp.getState();
    expect(learn.floor).toBeNull();
    expect(learn.challenges).toEqual({});
    expect(learn.skills['signed:1']).toEqual({ attempts: [] });
    expect(xp).toBe(120);
    expect(profile.name).toBe('נועה');
  });
  it('keeps a saved floor record and saved challenges as they are', () => {
    const floor = { at: '2026-11-05T10:00:00.000Z', on: true, results: { 'frac:3': { asked: 1, right: 0 } }, facts: { asked: 2, right: 2 } };
    const out = mergeSaved({ ...v4, learn: { ...v4.learn, floor, challenges: { 'eq:c1': { startedAt: 'x', firstTry: 1, parts: 3 } } } }, { xp: 0, learn: {} });
    expect(out.learn.floor).toEqual(floor);
    expect(out.learn.challenges).toEqual({ 'eq:c1': { startedAt: 'x', firstTry: 1, parts: 3 } });
  });
  it('a first visit (nothing saved) starts from the defaults', () => {
    const cur = { xp: 0, learn: { skills: {} }, setFloor: () => {} };
    const out = mergeSaved(undefined, cur);
    expect(out.xp).toBe(0);
    expect(out.setFloor).toBe(cur.setFloor);
    expect(out.learn).toMatchObject({ skills: {}, floor: null, challenges: {} });
  });
});
