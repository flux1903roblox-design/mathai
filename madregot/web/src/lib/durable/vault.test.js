// The vault's sync engine on the device (DURABLE-5, vault.js), against a fake server in fetch that keeps vaults as the
// Worker does (compare-and-swap revisions, 409 with the current rev, 404 vault_gone for an expired vault, 410
// vault_deleted for one its owner deleted, 401 not_linked for a write with a family token the server let go): pull then
// push, a 409 merged and retried, an expired vault made again, a deleted one never made again, an unchanged copy not
// sent, offline, a conflict loop that stops, another student's copy never merged, two devices that settle instead of
// sending each other the same progress, a device the family let go moving to a new code, and turning the backup on and off.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createStore } from 'zustand/vanilla';
import { useApp, appState } from '../store.js';
import { keepaliveBudget } from './moments.js';
import { snapshotForBackup } from './payload.js';
import { BACKUP_DEFAULTS, CURRENT_VERSION } from './migrations.js';
import { derive, seal, open } from './crypto.js';
import { makeCode, isCode } from './code.js';
import { report } from '../monitor.js';
import {
  syncVault, createBackup, stopBackup, detachBackup, backupText, agoText, vaultErrorText, openCopy, CONFLICT_LOOPS, BACKUP_TEXT,
  findVault, adoptCode, familyGone,
} from './vault.js';
import { applyRestored } from './apply.js';
import { VaultOpenError } from './crypto.js';

vi.mock('../monitor.js', () => ({ report: vi.fn() }));

const API = 'https://api.madregot.test';
const AT = '2026-11-05T10:00:00.000Z';
const initial = useApp.getState();

/** A fake vault server: `vaults` by X-Vault, every call logged. `hooks.post(body, h)` may answer a POST instead. */
function fakeServer() {
  const vaults = new Map();
  const deleted = new Set();
  const calls = [];
  const hooks = { unlinked: new Set() };
  let clock = 0;
  const reply = (status, data) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
  const fetch = vi.fn(async (url, init = {}) => {
    const path = new URL(url).pathname;
    const method = init.method || 'GET';
    const h = Object.fromEntries(Object.entries(init.headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ path, method, body, headers: h, keepalive: !!init.keepalive });
    if (hooks.down) throw new TypeError('Failed to fetch');
    const id = h['x-vault'];
    const v = vaults.get(id);
    const missing = () => (deleted.has(id) ? reply(410, { error: 'vault_deleted' }) : reply(404, { error: 'vault_not_found' }));
    if (path === '/api/vault/rev' && method === 'GET') return v ? reply(200, { rev: v.rev, updatedAt: v.updatedAt }) : missing();
    if (path === '/api/vault' && method === 'GET') return v ? reply(200, { rev: v.rev, blob: v.blob, updatedAt: v.updatedAt }) : missing();
    if (path === '/api/vault/escrow' && method === 'POST') return reply(200, { escrow: h.authorization ? 'class' : 'family' });
    if (path === '/api/vault' && method === 'POST') {
      if (hooks.unlinked.has(h['x-family-device'])) return new Response(JSON.stringify({ error: 'not_linked' }), { status: 401, headers: { 'Content-Type': 'application/json', 'X-AI-Linked': '0' } });
      if (hooks.post) { const r = await hooks.post(body, h); if (r) return r; }
      if (deleted.has(id)) return reply(410, { error: 'vault_deleted' });
      const updatedAt = new Date(Date.parse(AT) + (clock += 1000)).toISOString();
      if (body.ifRev === null) {
        if (v) return reply(409, { error: 'vault_conflict', rev: v.rev });
        vaults.set(id, { rev: 1, blob: body.blob, updatedAt });
        return reply(200, { rev: 1, updatedAt });
      }
      if (!v) return reply(404, { error: 'vault_gone' });
      if (v.rev !== body.ifRev) return reply(409, { error: 'vault_conflict', rev: v.rev });
      vaults.set(id, { rev: v.rev + 1, blob: body.blob, updatedAt });
      return reply(200, { rev: v.rev + 1, updatedAt });
    }
    if (path === '/api/vault/delete' && method === 'POST') { const had = vaults.delete(id); deleted.add(id); return reply(200, { deleted: had ? 1 : 0 }); }
    return reply(404, { error: 'not_found' });
  });
  return { vaults, deleted, calls, hooks, fetch, posts: () => calls.filter((c) => c.method === 'POST' && c.path === '/api/vault') };
}

let server;
/** A student's progress: days and XP counted on one device tag. */
const progress = (name, tag, days) => {
  const xp = Object.values(days).reduce((n, d) => n + d.xp, 0);
  return { profile: { role: 'student', name, grade: '7' }, days, xp, xpBy: { [tag]: xp }, resetAt: null };
};
const HERE = progress('נועה', 'a1b2c3d4', { '2026-11-04': { lessons: 2, xp: 30, q: 16, ok: 14 } });
/** The other device's copy of the same student: a lesson on the 5th. */
const THERE = progress('נועה', 'b2c3d4e5', { '2026-11-05': { lessons: 1, xp: 15, q: 8, ok: 8 } });

/** This device: the store with `state` and the backup on for `code` at `rev`. */
async function device(state, code, { rev = 1, store = useApp, ...backup } = {}) {
  const { lookup } = await derive(code);
  store.setState({ ...state, durable: { ...store.getState().durable, tag: 'a1b2c3d4' }, backup: { ...BACKUP_DEFAULTS, on: true, code, lookup, rev, ...backup } });
  return store;
}
/** Put a copy in the fake server's vault, as another device would. */
async function remote(code, state, rev) {
  const { key, lookup } = await derive(code);
  const blob = await seal({ v: 1, at: AT, schema: CURRENT_VERSION, rev, state: snapshotForBackup(state) }, key);
  server.vaults.set(lookup, { rev, blob, updatedAt: AT });
  return lookup;
}
/** What the server holds for a code, opened. */
async function held(code) {
  const { key, lookup } = await derive(code);
  return open(server.vaults.get(lookup).blob, key);
}

beforeEach(() => {
  server = fakeServer();
  vi.stubGlobal('fetch', server.fetch);
  vi.stubGlobal('location', { origin: 'https://app.madregot.test' });
  keepaliveBudget.reset();
  report.mockClear();
  useApp.setState(initial, true);
  useApp.setState({ ai: { ...initial.ai, apiUrl: API } });
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('sync', () => {
  it('pull then push: the other device\'s lesson is merged here, logged, and the merged copy is sent with ifRev', async () => {
    const code = makeCode();
    await device(HERE, code, { rev: 1, hash: 'old' });
    await remote(code, THERE, 2);
    expect(await syncVault({ moment: 'boot' })).toBe('pushed');
    expect(server.calls.map((c) => `${c.method} ${c.path}`)).toEqual(['GET /api/vault/rev', 'GET /api/vault', 'POST /api/vault']);
    const st = useApp.getState();
    expect(Object.keys(st.days).sort()).toEqual(['2026-11-04', '2026-11-05']);
    expect(st.xp).toBe(45);
    expect(st.learn.events.at(-1)).toMatchObject({ e: 'merge', m: 'vault' });
    expect(server.posts()[0].body.ifRev).toBe(2);
    expect(st.backup).toMatchObject({ on: true, rev: 3, state: 'idle' });
    expect(st.backup.hash).toMatch(/^[0-9a-f]{64}$/);
    const copy = await held(code);
    expect(copy).toMatchObject({ v: 1, schema: CURRENT_VERSION });
    expect(copy.state.xp).toBe(45);
    for (const k of ['ai', 'outbox', 'durable', 'backup']) expect(copy.state[k]).toBeUndefined();
  });

  it('an unchanged copy is not sent again; a change is', async () => {
    const code = makeCode();
    await device(HERE, code, { rev: null });
    await syncVault({ moment: 'boot' });
    expect(server.posts()).toHaveLength(1);
    await syncVault({ moment: 'tick' });
    await syncVault({ moment: 'lesson' });
    expect(server.posts()).toHaveLength(1);
    expect(server.calls.filter((c) => c.path === '/api/vault' && c.method === 'GET')).toHaveLength(0);
    useApp.setState({ days: { ...useApp.getState().days, '2026-11-05': { lessons: 1, xp: 10, q: 8, ok: 7 } } });
    expect(await syncVault({ moment: 'lesson' })).toBe('pushed');
    expect(server.posts()).toHaveLength(2);
    expect(server.posts()[1].body.ifRev).toBe(1);
  });

  it('a 409 on a push: the newer copy is pulled and merged, and the push is tried again', async () => {
    const code = makeCode();
    await device(HERE, code, { rev: 1 });
    await remote(code, THERE, 2); // another device pushed meanwhile
    expect(await syncVault({ moment: 'lesson' })).toBe('pushed'); // push first: no pull
    expect(server.calls.map((c) => `${c.method} ${c.path} ${c.body?.ifRev ?? ''}`.trim())).toEqual([
      'POST /api/vault 1', 'GET /api/vault/rev', 'GET /api/vault', 'POST /api/vault 2',
    ]);
    expect(useApp.getState().backup.rev).toBe(3);
    expect((await held(code)).state.xp).toBe(45);
  });

  it('a vault that was deleted or expired (404 vault_gone) is made again with the same code, and Settings says so once', async () => {
    const code = makeCode();
    await device(HERE, code, { rev: 4 });
    expect(await syncVault({ moment: 'lesson' })).toBe('pushed');
    expect(server.posts().map((c) => c.body.ifRev)).toEqual([4, null]);
    expect(useApp.getState().backup).toMatchObject({ rev: 1, note: 'recreated', state: 'idle' });
    // the pull finds it gone too (boot): made again
    server.vaults.clear();
    useApp.setState({ backup: { ...useApp.getState().backup, note: null } });
    useApp.setState({ days: { ...useApp.getState().days, '2026-11-05': { lessons: 1, xp: 5, q: 3, ok: 3 } } });
    expect(await syncVault({ moment: 'boot' })).toBe('pushed');
    expect(server.posts().at(-1).body.ifRev).toBeNull();
    expect(useApp.getState().backup.note).toBe('recreated');
  });

  it('a stop on one device is never undone by another: device B, same code, turns its backup off (410 vault_deleted)', async () => {
    const code = makeCode();
    await remote(code, THERE, 2);
    // device A: "להפסיק את הגיבוי"
    const a = createStore(() => ({ ...appState(), ai: { ...initial.ai, apiUrl: API } }));
    await device(HERE, code, { rev: 2, store: a });
    await stopBackup({ store: a });
    expect(server.vaults.size).toBe(0);
    // device B, every moment: the boot pull and a lesson's push
    for (const moment of ['boot', 'lesson']) {
      await device(HERE, code, { rev: 2 });
      useApp.setState({ days: { ...useApp.getState().days, '2026-11-06': { lessons: 1, xp: 5, q: 3, ok: 3 } } });
      expect(await syncVault({ moment })).toBe('deleted');
      expect(server.vaults.size, moment).toBe(0);
      expect(server.posts().every((c) => c.body.ifRev !== null), 'never made again').toBe(true);
      expect(useApp.getState().backup).toMatchObject({ on: false, code: null, note: 'deleted' });
      expect(await syncVault({ moment: 'boot' })).toBe('off');
    }
    // a fresh phone with the stopped code gets nothing back
    await expect(findVault(code)).rejects.toMatchObject({ code: 'vault_deleted' });
    expect(vaultErrorText({ code: 'vault_deleted' })).toBe('הגיבוי של הקוד הזה נמחק, ולכן אי אפשר לשחזר ממנו.');
    expect(BACKUP_TEXT.deleted).toContain('נמחק ממכשיר אחר');
  });

  it('the family let go of this device (401 not_linked on a write): the token is forgotten and the backup moves to a new code', async () => {
    const code = makeCode();
    const old = await remote(code, HERE, 3);
    await device(HERE, code, { rev: 3, escrow: 'family' });
    useApp.setState({ ai: { ...useApp.getState().ai, familyDevice: { token: 'fd1.old', label: 'הטאבלט' } } });
    server.hooks.unlinked.add('fd1.old');
    useApp.setState({ days: { ...useApp.getState().days, '2026-11-06': { lessons: 1, xp: 5, q: 3, ok: 3 } } });
    expect(await syncVault({ moment: 'lesson' })).toBe('moved');
    const b = useApp.getState().backup;
    expect(useApp.getState().ai.familyDevice).toBeNull();
    expect(b).toMatchObject({ on: true, escrow: null, note: 'moved', moveCode: false, rev: 1 });
    expect(isCode(b.code) && b.code !== code).toBe(true);
    expect(b.lookup).not.toBe(old);
    // the kept copy got nothing new: still rev 3, and nothing more is sent to it
    expect(server.vaults.get(old).rev).toBe(3);
    expect(await syncVault({ moment: 'lesson' })).toBe('unchanged');
    expect(server.calls.filter((c) => c.headers['x-vault'] === old && c.method === 'POST').length).toBe(1);
    expect(BACKUP_TEXT.moved).toContain('עבר לקוד חדש');
  });

  it('familyGone (X-AI-Linked: 0 seen elsewhere): the next sync moves first, the class keeps the new code when it kept the old one', async () => {
    const code = makeCode();
    const old = await remote(code, HERE, 1);
    await device(HERE, code, { rev: 1, escrow: 'both' });
    useApp.setState({ ai: { ...useApp.getState().ai, familyDevice: { token: 'fd1.old', label: 'הטאבלט' } } });
    familyGone(useApp);
    expect(useApp.getState().ai.familyDevice).toBeNull();
    expect(useApp.getState().backup).toMatchObject({ moveCode: true, escrow: 'class' });
    server.calls.length = 0;
    expect(await syncVault({ moment: 'boot' })).toBe('moved');
    expect(server.calls.some((c) => c.headers['x-vault'] === old), 'the old copy is not pulled or pushed').toBe(false);
    const b = useApp.getState().backup;
    const esc = server.calls.find((c) => c.path === '/api/vault/escrow');
    expect(esc.body).toEqual({ code: b.code, lookup: b.lookup });
    expect(b).toMatchObject({ escrow: 'class', note: 'moved' });
    // a device whose code the family never kept only forgets the token
    await device(HERE, code, { rev: 1, escrow: null });
    useApp.setState({ ai: { ...useApp.getState().ai, familyDevice: { token: 'fd1.x' } } });
    familyGone(useApp);
    expect(useApp.getState().backup.moveCode).toBe(false);
  });

  it('offline: nothing is sent and the backup waits for the internet; a failed request is the same', async () => {
    const code = makeCode();
    await device(HERE, code, { rev: 1 });
    expect(await syncVault({ moment: 'boot', online: () => false })).toBe('offline');
    expect(server.calls).toEqual([]);
    expect(useApp.getState().backup.state).toBe('offline');
    expect(backupText(useApp.getState().backup)).toBe('פועל · מחכה לאינטרנט');
    server.hooks.down = true;
    expect(await syncVault({ moment: 'boot' })).toBe('offline');
    expect(report).not.toHaveBeenCalled();
    // back online with nothing new to send: the state is well again
    server.hooks.down = false;
    useApp.setState({ backup: { ...useApp.getState().backup, hash: null, rev: null } });
    await syncVault({ moment: 'online' });
    expect(await syncVault({ moment: 'online' })).toBe('unchanged');
    expect(useApp.getState().backup.state).toBe('idle');
  });

  it('a conflict that keeps coming back stops after 3 merges, as an error that is reported', async () => {
    const code = makeCode();
    await device(HERE, code, { rev: 1 });
    await remote(code, THERE, 2);
    // every push loses the race to another device
    server.hooks.post = async () => {
      const lookup = (await derive(code)).lookup;
      const v = server.vaults.get(lookup);
      server.vaults.set(lookup, { ...v, rev: v.rev + 1 });
      return new Response(JSON.stringify({ error: 'vault_conflict', rev: v.rev + 1 }), { status: 409 });
    };
    expect(await syncVault({ moment: 'lesson' })).toBe('error');
    expect(server.posts()).toHaveLength(CONFLICT_LOOPS + 1);
    expect(useApp.getState().backup.state).toBe('error');
    expect(report).toHaveBeenCalledWith('vault', expect.objectContaining({ name: 'conflict_loop' }));
    expect(backupText(useApp.getState().backup)).toBe(BACKUP_TEXT.retry);
  });

  it('another student\'s copy is never merged or overwritten: the backup stops and says so', async () => {
    const code = makeCode();
    await device(HERE, code, { rev: 1 });
    await remote(code, progress('יואב', 'c3d4e5f6', { '2026-11-03': { lessons: 5, xp: 90, q: 40, ok: 30 } }), 2);
    const before = JSON.stringify(snapshotForBackup(useApp.getState()));
    expect(await syncVault({ moment: 'boot' })).toBe('other_student');
    expect(JSON.stringify(snapshotForBackup(useApp.getState()))).toBe(before);
    expect(server.posts()).toHaveLength(0);
    expect(useApp.getState().backup.state).toBe('other_student');
    expect(report).toHaveBeenCalledWith('vault', expect.objectContaining({ name: 'other_student' }));
    // and it stays stopped until the student chooses
    expect(await syncVault({ moment: 'tick' })).toBe('other_student');
    expect(server.calls).toHaveLength(2);
    expect((await held(code)).state.profile.name).toBe('יואב');
  });

  it('429 (slow down, or no tries left on this network) goes back to idle quietly', async () => {
    const code = makeCode();
    await device(HERE, code, { rev: 1 });
    server.hooks.post = async () => new Response(JSON.stringify({ error: 'slow_down' }), { status: 429 });
    expect(await syncVault({ moment: 'lesson' })).toBe('idle');
    expect(useApp.getState().backup.state).toBe('idle');
    expect(report).not.toHaveBeenCalled();
  });

  it('a copy that cannot be opened is an error, reported without the code or the copy', async () => {
    const code = makeCode();
    await device(HERE, code, { rev: 1 });
    const { lookup } = await derive(code);
    server.vaults.set(lookup, { rev: 2, blob: 'A'.repeat(80), updatedAt: AT });
    expect(await syncVault({ moment: 'boot' })).toBe('error');
    expect(report).toHaveBeenCalledWith('vault', { name: 'open', message: 'the vault could not be opened with this code' });
    expect(JSON.stringify(report.mock.calls)).not.toContain(code);
  });

  it('after an undone restore (forcePush) the server\'s copy is pushed over, never pulled', async () => {
    const code = makeCode();
    await device(HERE, code, { rev: 1, forcePush: true, hash: 'x' });
    await remote(code, progress('נועה', 'b2c3d4e5', { '2026-11-01': { lessons: 9, xp: 200, q: 9, ok: 9 } }), 5);
    expect(await syncVault({ moment: 'boot' })).toBe('pushed');
    expect(server.calls.map((c) => `${c.method} ${c.path}`)).toEqual(['GET /api/vault/rev', 'POST /api/vault']);
    expect(server.posts()[0].body.ifRev).toBe(5);
    expect(useApp.getState().days['2026-11-01']).toBeUndefined();
    expect(useApp.getState().backup).toMatchObject({ forcePush: false, rev: 6 });
  });

  it('visible pulls only; every call carries X-Vault and the identity the device has', async () => {
    const code = makeCode();
    await device({ ...HERE, profile: { ...HERE.profile, token: 'stu_token_1', classCode: 'K7Q2MD', studentId: 's1' } }, code, { rev: 1 });
    useApp.setState({ ai: { ...useApp.getState().ai, familyDevice: { token: `fd1.${'f'.repeat(64)}`, label: 'הטאבלט' } } });
    await remote(code, THERE, 2);
    expect(await syncVault({ moment: 'visible' })).toBe('pulled');
    expect(server.posts()).toHaveLength(0);
    const { lookup } = await derive(code);
    for (const c of server.calls) {
      expect(c.headers['x-vault']).toBe(lookup);
      expect(c.headers.authorization).toBe('Bearer stu_token_1');
      expect(c.headers['x-family-device']).toBe(`fd1.${'f'.repeat(64)}`);
    }
    expect(useApp.getState().days['2026-11-05']).toBeTruthy();
  });

  it('hidden pushes with keepalive only on the same address and within the budget', async () => {
    const code = makeCode();
    await device(HERE, code, { rev: null });
    await syncVault({ moment: 'hidden' });
    expect(server.posts()[0].keepalive).toBe(false); // the server is another address here
    vi.stubGlobal('location', { origin: API });
    useApp.setState({ days: { ...useApp.getState().days, '2026-11-05': { lessons: 1, xp: 5, q: 3, ok: 3 } } });
    keepaliveBudget.reset();
    await syncVault({ moment: 'hidden' });
    expect(server.posts()[1].keepalive).toBe(true);
    expect(keepaliveBudget.left()).toBeLessThan(60_000);
    keepaliveBudget.claim(keepaliveBudget.left()); // the summary and the outbox took it all
    useApp.setState({ days: { ...useApp.getState().days, '2026-11-06': { lessons: 1, xp: 5, q: 3, ok: 3 } } });
    await syncVault({ moment: 'hidden' });
    expect(server.posts()[2].keepalive).toBe(false);
  });

  it('two devices settle: after one pulls what the other pushed, neither sends it back', async () => {
    const code = makeCode();
    const a = await device(HERE, code, { rev: null, store: createStore(appState) });
    const b = await device({ ...THERE }, code, { rev: null, store: createStore(appState) });
    b.setState({ durable: { ...b.getState().durable, tag: 'b2c3d4e5' } });
    await syncVault({ moment: 'boot', store: a });
    await syncVault({ moment: 'boot', store: b }); // b merges a's copy and pushes the merge
    await syncVault({ moment: 'boot', store: a }); // a takes the merge: nothing new to send
    const n = server.posts().length;
    for (let i = 0; i < 3; i += 1) {
      await syncVault({ moment: 'tick', store: a });
      await syncVault({ moment: 'tick', store: b });
    }
    expect(server.posts()).toHaveLength(n);
    expect(a.getState().xp).toBe(45);
    expect(b.getState().xp).toBe(45);
    expect(Object.keys(a.getState().days).sort()).toEqual(Object.keys(b.getState().days).sort());
  });

  it('nothing runs with the backup off, without a server, or with a broken code', async () => {
    useApp.setState({ ...HERE });
    expect(await syncVault({ moment: 'boot' })).toBe('off');
    await device(HERE, 'NOTACODE');
    expect(await syncVault({ moment: 'boot' })).toBe('off');
    expect(server.calls).toEqual([]);
  });
});

describe('turning it on and off', () => {
  it('createBackup: a sound code, the first copy created with ifRev null, the backup on', async () => {
    useApp.setState({ ...HERE, backup: { ...BACKUP_DEFAULTS, undoUntil: '2026-12-01T00:00:00.000Z' } });
    const code = await createBackup();
    expect(isCode(code)).toBe(true);
    expect(server.posts()[0].body.ifRev).toBeNull();
    const b = useApp.getState().backup;
    expect(b).toMatchObject({ on: true, code, rev: 1, state: 'idle', undoUntil: '2026-12-01T00:00:00.000Z' });
    expect(b.lookup).toBe((await derive(code)).lookup);
    expect((await held(code)).state.profile.name).toBe('נועה');
    // the first sync after it has nothing to send
    await syncVault({ moment: 'tick' });
    expect(server.posts()).toHaveLength(1);
  });

  it('a teacher\'s backup code (FOLLOWUP-10, the class settings\' save section): the sealed copy keeps the class keys, never a token', async () => {
    const classes = [{ code: 'K7Q2MD', key: 'teacher-key-example', className: 'ז׳3', grade: '7' }, { code: 'AAA222', key: null, className: 'ח׳1', grade: '8', owned: true }];
    useApp.setState({ ...HERE, profile: { role: 'teacher', name: 'רונית', grade: '7', classes, active: 'K7Q2MD' } });
    const code = await createBackup();
    const back = (await held(code)).state.profile;
    expect(back.role).toBe('teacher');
    expect(back.classes).toEqual(classes);
    expect(JSON.stringify(server.posts()[0].body)).not.toContain('teacher-key-example'); // sealed: the server sees no key
  });

  it('a code that is taken already gets another; a server that refuses keeps the backup off', async () => {
    useApp.setState({ ...HERE });
    let first = true;
    server.hooks.post = async () => { if (first) { first = false; return new Response(JSON.stringify({ error: 'vault_conflict', rev: 3 }), { status: 409 }); } return null; };
    expect(isCode(await createBackup())).toBe(true);
    expect(server.posts()).toHaveLength(2);
    expect(server.posts()[0].headers['x-vault']).not.toBe(server.posts()[1].headers['x-vault']);
    useApp.setState({ backup: { ...BACKUP_DEFAULTS } });
    server.hooks.post = async () => new Response(JSON.stringify({ error: 'too_many_vaults' }), { status: 429 });
    await expect(createBackup()).rejects.toMatchObject({ code: 'too_many_vaults' });
    expect(useApp.getState().backup.on).toBe(false);
  });

  it('a copy too big even after compacting is not sent: the file is the way', async () => {
    useApp.setState({ ...HERE, junk: Array.from({ length: 30_000 }, (_, i) => (i * 2654435761 >>> 0).toString(36).repeat(2) + Math.random().toString(36)).join('') });
    await expect(createBackup()).rejects.toMatchObject({ code: 'vault_too_big' });
    expect(server.posts()).toHaveLength(0);
    const code = makeCode();
    await device({}, code, { rev: 1 });
    expect(await syncVault({ moment: 'lesson' })).toBe('too_big');
    expect(backupText(useApp.getState().backup)).toBe('הגיבוי גדול מדי. שמרו קובץ במקום.');
  }, 20_000);

  it('stopBackup deletes the copy on the server and turns the backup off; detachBackup deletes nothing', async () => {
    useApp.setState({ ...HERE });
    const code = await createBackup();
    await stopBackup();
    expect(server.calls.at(-1)).toMatchObject({ method: 'POST', path: '/api/vault/delete' });
    expect(server.calls.at(-1).headers['x-vault']).toBe((await derive(code)).lookup);
    expect(server.vaults.size).toBe(0);
    expect(useApp.getState().backup).toEqual({ ...BACKUP_DEFAULTS });
    const again = await createBackup();
    const n = server.calls.length;
    detachBackup();
    expect(server.calls).toHaveLength(n);
    expect(server.vaults.size).toBe(1);
    expect(useApp.getState().backup.on).toBe(false);
    expect(isCode(again)).toBe(true);
  });

  it('openCopy refuses a sealed copy that is not a backup, and migrates an older one', async () => {
    const { key } = await derive(makeCode());
    await expect(openCopy(await seal({ hello: 1 }, key), key)).rejects.toBeInstanceOf(VaultOpenError);
    const old = await seal({ v: 1, at: AT, schema: 4, rev: 1, state: { profile: { role: 'student', name: 'נועה' }, xp: 30, days: {} } }, key);
    const r = await openCopy(old, key);
    expect(r.state.xp).toBe(30);
    expect(Object.values(r.state.xpBy).reduce((a, b) => a + b, 0)).toBe(30);
  });
});

describe('restoring from a code (the Restore screen)', () => {
  it('findVault reads and opens the copy with one GET, and changes nothing here', async () => {
    const code = makeCode();
    const lookup = await remote(code, THERE, 3);
    useApp.setState({ ...HERE });
    const before = JSON.stringify(useApp.getState());
    const v = await findVault(code);
    expect(v).toMatchObject({ code, lookup, rev: 3, at: AT });
    expect(v.state.profile.name).toBe('נועה');
    expect(v.state.days['2026-11-05'].lessons).toBe(1);
    expect(server.calls).toEqual([expect.objectContaining({ method: 'GET', path: '/api/vault' })]);
    expect(server.calls[0].headers['x-vault']).toBe(lookup);
    expect(JSON.stringify(useApp.getState())).toBe(before);
  });

  it('no copy for the code is vault_not_found; a copy this code does not open is a VaultOpenError', async () => {
    const code = makeCode();
    await expect(findVault(code)).rejects.toMatchObject({ code: 'vault_not_found' });
    const { lookup } = await derive(code);
    const { key: other } = await derive(makeCode());
    server.vaults.set(lookup, { rev: 1, blob: await seal({ v: 1, at: AT, schema: CURRENT_VERSION, rev: 1, state: snapshotForBackup(THERE) }, other), updatedAt: AT });
    await expect(findVault(code)).rejects.toBeInstanceOf(VaultOpenError);
    expect(vaultErrorText(await findVault(code).catch((e) => e))).toBe('הגיבוי נמצא, אבל לא הצלחנו לפתוח אותו. בדקו שהקוד נכון עד הסוף.');
  });

  it('adoptCode after the restore: the backup is on with that code and rev, and the merged progress is sent at once, once', async () => {
    const code = makeCode();
    await remote(code, THERE, 3);
    // this device had its own code: it is let go (nothing is deleted on the server)
    const old = makeCode();
    const oldLookup = await remote(old, HERE, 1);
    await device(HERE, old, { rev: 1, undoUntil: '2026-12-01T00:00:00.000Z' });
    const v = await findVault(code);
    const r = await applyRestored(v.state, 'vault', { at: v.at });
    expect(r).toMatchObject({ kind: 'same', applied: true });
    expect(await adoptCode(v)).toBe('pushed');
    expect(useApp.getState().backup).toMatchObject({ on: true, code, lookup: v.lookup, rev: 4, state: 'idle', undoUntil: '2026-12-01T00:00:00.000Z' });
    expect(server.posts()).toHaveLength(1);
    expect(server.posts()[0].body.ifRev).toBe(3);
    const got = (await held(code)).state;
    expect(got.days['2026-11-04'].lessons).toBe(2); // this device's lessons reached the vault
    expect(got.days['2026-11-05'].lessons).toBe(1);
    expect(server.vaults.has(oldLookup)).toBe(true);
    expect(await syncVault({ moment: 'tick' })).toBe('unchanged');
    expect(server.posts()).toHaveLength(1);
  });
});

describe('what Settings says', () => {
  const now = Date.parse(AT);
  it('the status line', () => {
    expect(backupText({ on: false })).toBe('כבוי');
    expect(backupText({ on: true, state: 'idle', at: new Date(now - 3 * 60_000).toISOString() }, now)).toBe('פועל · עודכן לפני 3 דקות');
    expect(backupText({ on: true, state: 'idle', at: new Date(now - 20_000).toISOString() }, now)).toBe('פועל · עודכן עכשיו');
    expect(backupText({ on: true, state: 'offline' }, now)).toBe('פועל · מחכה לאינטרנט');
    expect(backupText({ on: true, state: 'too_big' }, now)).toBe('הגיבוי גדול מדי. שמרו קובץ במקום.');
    const ago = (ms) => agoText(new Date(now - ms).toISOString(), now);
    expect([ago(60_000), ago(5 * 60_000), ago(3600_000), ago(2 * 3600_000), ago(5 * 3600_000)]).toEqual(['לפני דקה', 'לפני 5 דקות', 'לפני שעה', 'לפני שעתיים', 'לפני 5 שעות']);
    expect([ago(864e5), ago(2 * 864e5), ago(4 * 864e5)]).toEqual(['אתמול', 'לפני יומיים', 'לפני 4 ימים']);
    expect(agoText('not a date', now)).toBe('');
  });
  it('the vault\'s own words for its errors', () => {
    expect(vaultErrorText({ code: 'too_many_tries' })).toBe('היו הרבה ניסיונות מהרשת הזו היום. נסו שוב מחר.');
    expect(vaultErrorText({ code: 'vault_full' })).toBe('אי אפשר ליצור גיבוי בשרת כרגע. אפשר לשמור קובץ גיבוי במקום.');
    expect(vaultErrorText({ code: 'too_many_vaults' })).toBe('נוצרו היום הרבה גיבויים מהמכשיר או מהרשת הזו. נסו שוב מחר, או שמרו קובץ.');
    expect(vaultErrorText(new VaultOpenError())).toBe('הגיבוי נמצא, אבל לא הצלחנו לפתוח אותו. בדקו שהקוד נכון עד הסוף.');
  });
});
