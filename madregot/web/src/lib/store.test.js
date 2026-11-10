import { describe, it, expect } from 'vitest';
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

describe('the introduction to the tutor is remembered without a new store version (trust spec TRUST-4 §4.6)', () => {
  it('migrateState keeps ai.introSeen from any older save, and a save without it shows the introduction once', async () => {
    const seen = { mode: 'server', apiUrl: '', key: '', device: 'b'.repeat(32), familyDevice: null, pendingLink: null, lastTier: null, introSeen: true };
    expect(migrateState(v2(seen), 3, { personal: false }).ai.introSeen).toBe(true);
    expect(migrateState(v2(seen), 2, { personal: false }).ai.introSeen).toBe(true);
    expect(migrateState(v2({ mode: 'server', apiUrl: '', key: '', device: '' }), 2, { personal: false }).ai.introSeen).not.toBe(true);
    const { useApp } = await import('./store.js');
    expect(useApp.persist.getOptions().version).toBe(4);
  });
  it('introSeen() is true only for true: a v4 state saved before the field existed still shows it', async () => {
    const { useApp } = await import('./store.js');
    const { introSeen } = await import('./account.js');
    const { introSeen: _drop, ...old } = useApp.getState().ai; // eslint-disable-line no-unused-vars
    useApp.setState({ ai: old });
    expect(introSeen()).toBe(false);
    useApp.setState({ ai: { ...old, introSeen: 'yes' } });
    expect(introSeen()).toBe(false);
    useApp.setState({ ai: { ...old, introSeen: true } });
    expect(introSeen()).toBe(true);
  });
});
