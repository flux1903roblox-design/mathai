// The class and the family keep the backup code (DURABLE-6, escrow.js), against a fake server in fetch with the
// Worker's vault and escrow routes: a class join with no kept code makes a backup and gives its code to the class (with
// the class Bearer, never the family header); a rejoin with a kept code merges that copy here and adopts the code; a
// copy that cannot be opened lets the join go on and keeps a new one; another student's copy is never merged by a
// class rejoin, but a parent's family move replaces (with the undo); no VAULT_SECRET says escrow_off and never throws;
// the switch deletes and keeps the class's copy; backup.escrow says who keeps the code.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useApp } from '../store.js';
import { keepaliveBudget } from './moments.js';
import { snapshotForBackup } from './payload.js';
import { BACKUP_DEFAULTS, CURRENT_VERSION } from './migrations.js';
import { derive, seal, open } from './crypto.js';
import { makeCode } from './code.js';
import { report } from '../monitor.js';
import { afterClassJoin, afterFamilyLink, keepCode, setClassCopy, escrowHas, escrowWith, ESCROW_TEXT } from './escrow.js';

vi.mock('../monitor.js', () => ({ report: vi.fn() }));

const API = 'https://api.madregot.test';
const AT = '2026-11-05T10:00:00.000Z';
const initial = useApp.getState();
const FD = `fd1.${'a'.repeat(64)}`;

function fakeServer() {
  const vaults = new Map();
  const escrows = [];
  const calls = [];
  const hooks = {};
  const reply = (status, data) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
  const fetch = vi.fn(async (url, init = {}) => {
    const path = new URL(url).pathname;
    const method = init.method || 'GET';
    const h = Object.fromEntries(Object.entries(init.headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ path, method, body, headers: h });
    const v = vaults.get(h['x-vault']);
    if (path === '/api/vault' && method === 'GET') return v ? reply(200, { rev: v.rev, blob: v.blob, updatedAt: v.updatedAt }) : reply(404, { error: 'vault_not_found' });
    if (path === '/api/vault/rev') return v ? reply(200, { rev: v.rev, updatedAt: v.updatedAt }) : reply(404, { error: 'vault_not_found' });
    if (path === '/api/vault' && method === 'POST') {
      if (body.ifRev === null) { if (v) return reply(409, { error: 'vault_conflict', rev: v.rev }); vaults.set(h['x-vault'], { rev: 1, blob: body.blob, updatedAt: AT }); return reply(200, { rev: 1, updatedAt: AT }); }
      if (!v) return reply(404, { error: 'vault_gone' });
      if (v.rev !== body.ifRev) return reply(409, { error: 'vault_conflict', rev: v.rev });
      vaults.set(h['x-vault'], { rev: v.rev + 1, blob: body.blob, updatedAt: AT });
      return reply(200, { rev: v.rev + 1, updatedAt: AT });
    }
    const who = h.authorization ? `class:${h.authorization}` : h['x-family-device'] ? `family:${h['x-family-device']}` : null;
    if (path === '/api/vault/escrow') {
      if (hooks.off) return reply(503, { error: 'server_config' });
      if (!who) return reply(401, { error: 'not_signed_in' });
      if (!vaults.has(body.lookup)) return reply(404, { error: 'vault_not_found' });
      const i = escrows.findIndex((e) => e.who === who);
      if (i >= 0) escrows.splice(i, 1);
      escrows.push({ who, code: body.code, lookup: body.lookup });
      return reply(200, { escrow: who.startsWith('class') ? 'class' : 'family' });
    }
    if (path === '/api/vault/escrow/delete') {
      if (hooks.down) throw new TypeError('Failed to fetch');
      const before = escrows.length;
      for (let i = escrows.length - 1; i >= 0; i -= 1) if (escrows[i].who === who) escrows.splice(i, 1);
      return reply(200, { deleted: before - escrows.length });
    }
    return reply(404, { error: 'not_found' });
  });
  return { vaults, escrows, calls, hooks, fetch };
}

let server;
const progress = (name, tag, days) => {
  const xp = Object.values(days).reduce((n, d) => n + d.xp, 0);
  return { profile: { role: 'student', name, grade: '7' }, days, xp, xpBy: { [tag]: xp }, resetAt: null };
};
const KEPT = progress('נועה', 'b2c3d4e5', { '2026-11-04': { lessons: 2, xp: 30, q: 16, ok: 14 } });
/** A copy in the server's vault for `code`, as the student's other device left it. */
async function remote(code, state) {
  const { lookup } = await derive(code);
  const { key } = await derive(code);
  server.vaults.set(lookup, { rev: 3, blob: await seal({ v: 1, at: AT, schema: CURRENT_VERSION, rev: 3, state: snapshotForBackup(state) }, key), updatedAt: AT });
  return lookup;
}
const classProfile = (extra = {}) => ({ role: 'student', name: 'נועה', grade: '7', classCode: 'K7Q2MD', className: 'ז׳3', token: 'stu_1', studentId: 's1', ...extra });
const joined = (extra = {}) => ({ classCode: 'K7Q2MD', className: 'ז׳3', grade: '7', token: 'stu_1', studentId: 's1', name: 'נועה', returning: true, ...extra });

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

describe('backup.escrow', () => {
  it('says who keeps the code, and only while the backup is on', () => {
    expect(escrowWith(null, 'class', true)).toBe('class');
    expect(escrowWith('class', 'family', true)).toBe('both');
    expect(escrowWith('both', 'class', false)).toBe('family');
    expect(escrowWith('class', 'class', false)).toBeNull();
    expect(escrowHas({ on: true, escrow: 'both' }, 'class')).toBe(true);
    expect(escrowHas({ on: false, escrow: 'class' }, 'class')).toBe(false);
    expect(escrowHas({ on: true, escrow: 'family' }, 'class')).toBe(false);
  });
});

describe('the class keeps the code', () => {
  it('a join with no kept code: a backup is made, and its code goes to the class with the class Bearer only', async () => {
    useApp.setState({ profile: classProfile(), ai: { ...useApp.getState().ai, familyDevice: { token: FD, label: 'הטאבלט' } } });
    const r = await afterClassJoin(joined({ returning: false }));
    expect(r).toEqual({ restored: false, toast: null });
    const b = useApp.getState().backup;
    expect(b).toMatchObject({ on: true, escrow: 'class' });
    expect(server.escrows).toEqual([{ who: 'class:Bearer stu_1', code: b.code, lookup: b.lookup }]);
    const post = server.calls.find((c) => c.path === '/api/vault/escrow');
    expect(post.headers['x-family-device']).toBeUndefined();
    expect(post.body).toEqual({ code: b.code, lookup: b.lookup });
    // the vault was made first (ifRev null), then the code given
    expect(server.calls.map((c) => `${c.method} ${c.path}`)).toEqual(['POST /api/vault', 'POST /api/vault/escrow']);
  });

  it('a device with a backup code already: that code is the one the class keeps, nothing new is made', async () => {
    const code = makeCode();
    const { lookup } = await derive(code);
    await remote(code, KEPT);
    useApp.setState({ profile: classProfile(), backup: { ...BACKUP_DEFAULTS, on: true, code, lookup, rev: 3, state: 'idle' } });
    expect((await afterClassJoin(joined())).toast).toBeNull();
    expect(server.calls.map((c) => c.path)).toEqual(['/api/vault/escrow']);
    expect(server.escrows[0].code).toBe(code);
    expect(useApp.getState().backup.escrow).toBe('class');
  });

  it('the switch off: nothing is kept, and the class keeps nothing', async () => {
    useApp.setState({ profile: classProfile(), durable: { ...useApp.getState().durable, escrowClass: false } });
    expect(await keepCode('class')).toBe('off');
    await afterClassJoin(joined());
    expect(server.calls).toEqual([]);
    expect(useApp.getState().backup.on).toBe(false);
  });

  it('a rejoin with the code the class kept: an empty device gets the copy, adopts the code and says "חזרה"', async () => {
    const code = makeCode();
    await remote(code, KEPT);
    let before = null;
    const r = await afterClassJoin(joined({ vault: { code } }), { before: () => { before = useApp.getState().xp; useApp.setState({ profile: classProfile() }); } });
    expect(before).toBe(0);
    expect(r).toEqual({ restored: true, toast: ESCROW_TEXT.back('ז׳3') });
    expect(r.toast).toBe('ברוכים השבים לכיתה ז׳3. ההתקדמות שלכם חזרה.');
    const st = useApp.getState();
    expect(st.xp).toBe(30);
    expect(st.days['2026-11-04'].lessons).toBe(2);
    expect(st.profile.token).toBe('stu_1'); // the class identity stays
    expect(st.learn.events.at(-1)).toMatchObject({ e: 'merge', m: 'class' });
    expect(st.backup).toMatchObject({ on: true, code, escrow: 'class' });
    // the GET carried the new class token; nothing was escrowed again (the class has it)
    const get = server.calls.find((c) => c.method === 'GET' && c.path === '/api/vault');
    expect(get.headers.authorization).toBe('Bearer stu_1');
    expect(server.calls.some((c) => c.path === '/api/vault/escrow')).toBe(false);
  });

  it('a rejoin on a device with progress of its own: merged, with the merged words', async () => {
    const code = makeCode();
    await remote(code, KEPT);
    useApp.setState({ ...progress('נועה', 'a1b2c3d4', { '2026-11-05': { lessons: 1, xp: 15, q: 8, ok: 8 } }), profile: classProfile() });
    const r = await afterClassJoin(joined({ vault: { code } }));
    expect(r.toast).toBe('ברוכים השבים לכיתה ז׳3. איחדנו את ההתקדמות מהכיתה עם מה שיש במכשיר הזה.');
    expect(useApp.getState().xp).toBe(45);
    expect(Object.keys(useApp.getState().days).sort()).toEqual(['2026-11-04', '2026-11-05']);
  });

  it('another student\'s progress here: the class\'s copy is not merged, and the code it keeps is left alone', async () => {
    const code = makeCode();
    await remote(code, KEPT);
    useApp.setState({ ...progress('יואב', 'a1b2c3d4', { '2026-11-05': { lessons: 1, xp: 15, q: 8, ok: 8 } }), profile: classProfile({ name: 'יואב' }) });
    const r = await afterClassJoin(joined({ vault: { code } }));
    expect(r).toEqual({ restored: false, toast: null });
    expect(useApp.getState().xp).toBe(15);
    expect(useApp.getState().backup.on).toBe(false);
    expect(server.calls.some((c) => c.path === '/api/vault/escrow')).toBe(false);
  });

  it('a kept code whose copy is gone: the join goes on, and a new copy is kept (unless the caller keeps it later)', async () => {
    useApp.setState({ profile: classProfile() });
    const gone = makeCode();
    expect(await afterClassJoin(joined({ vault: { code: gone } }), { keep: false })).toEqual({ restored: false, toast: null });
    expect(server.calls.map((c) => c.path)).toEqual(['/api/vault']);
    const r = await afterClassJoin(joined({ vault: { code: gone } }));
    expect(r.restored).toBe(false);
    expect(useApp.getState().backup).toMatchObject({ on: true, escrow: 'class' });
    expect(useApp.getState().backup.code).not.toBe(gone);
    expect(report).toHaveBeenCalledWith('vault', expect.objectContaining({ name: 'escrow_open' }));
  });

  it('no VAULT_SECRET: escrow_off is said, the backup stays, and nothing throws', async () => {
    server.hooks.off = true;
    useApp.setState({ profile: classProfile() });
    const r = await afterClassJoin(joined({ returning: false }));
    expect(r.toast).toBe('שמירת עותק בשרת עוד לא הוגדרה. שמרו את קוד הגיבוי.');
    expect(useApp.getState().backup).toMatchObject({ on: true, escrow: null });
  });

  it('the switch: off deletes the class\'s copy and remembers; on keeps it again; a failed delete changes nothing', async () => {
    useApp.setState({ profile: classProfile() });
    await afterClassJoin(joined({ returning: false }));
    expect(server.escrows).toHaveLength(1);
    expect(await setClassCopy(false)).toBe('off');
    expect(server.escrows).toEqual([]);
    expect(useApp.getState().durable.escrowClass).toBe(false);
    expect(useApp.getState().backup).toMatchObject({ on: true, escrow: null }); // the backup code itself stays
    expect(await setClassCopy(true)).toBe('kept');
    expect(server.escrows).toHaveLength(1);
    expect(useApp.getState().durable.escrowClass).toBe(true);
    server.hooks.down = true;
    await expect(setClassCopy(false)).rejects.toMatchObject({ code: 'network' });
    expect(useApp.getState().durable.escrowClass).toBe(true);
    expect(useApp.getState().backup.escrow).toBe('class');
  });

  it('another student\'s copy on this device\'s code is never handed to the class', async () => {
    const code = makeCode();
    const { lookup } = await derive(code);
    useApp.setState({ profile: classProfile(), backup: { ...BACKUP_DEFAULTS, on: true, code, lookup, rev: 1, state: 'other_student' } });
    expect(await keepCode('class')).toBe('off');
    expect(server.calls).toEqual([]);
  });
});

describe('the family keeps the code', () => {
  const linked = () => useApp.setState({ profile: { role: 'student', name: 'נועה', grade: '7' }, ai: { ...useApp.getState().ai, familyDevice: { token: FD, label: 'הטאבלט' } } });

  it('a link with nothing kept: a backup is made and the family keeps its code (X-Family-Device, never a Bearer)', async () => {
    linked();
    useApp.setState({ profile: classProfile() }); // a class student on a family device too
    expect(await afterFamilyLink({ deviceToken: FD })).toEqual({ restored: false, toast: null });
    const post = server.calls.find((c) => c.path === '/api/vault/escrow');
    expect(post.headers['x-family-device']).toBe(FD);
    expect(post.headers.authorization).toBeUndefined();
    expect(useApp.getState().backup.escrow).toBe('family');
    await afterClassJoin(joined({ returning: false }));
    expect(useApp.getState().backup.escrow).toBe('both');
  });

  it('a link that continues from kept progress: it comes here, the code is adopted, "ההתקדמות עברה למכשיר הזה."', async () => {
    const code = makeCode();
    await remote(code, KEPT);
    linked();
    const r = await afterFamilyLink({ deviceToken: FD, vault: { code } });
    expect(r).toEqual({ restored: true, toast: 'ההתקדמות עברה למכשיר הזה.' });
    expect(useApp.getState().xp).toBe(30);
    expect(useApp.getState().backup).toMatchObject({ on: true, code, escrow: 'family' });
    expect(useApp.getState().learn.events.at(-1)).toMatchObject({ e: 'merge', m: 'family' });
  });

  it('the parent chose another child\'s name\'s progress for a device with its own: it replaces, with the undo', async () => {
    const code = makeCode();
    await remote(code, KEPT);
    useApp.setState(progress('דנה', 'a1b2c3d4', { '2026-11-05': { lessons: 1, xp: 15, q: 8, ok: 8 } }));
    linked();
    useApp.setState({ profile: { role: 'student', name: 'דנה', grade: '7' } });
    const quarantine = [];
    const { durableQuarantine } = await import('./storage.js');
    const keep = vi.spyOn(durableQuarantine, 'keep').mockImplementation(async (raw, why) => { quarantine.push(why); return true; });
    const r = await afterFamilyLink({ deviceToken: FD, vault: { code } });
    keep.mockRestore();
    expect(r.restored).toBe(true);
    expect(quarantine).toEqual(['before-restore']);
    expect(useApp.getState().profile.name).toBe('נועה');
    expect(useApp.getState().xp).toBe(30);
    expect(Date.parse(useApp.getState().backup.undoUntil)).toBeGreaterThan(Date.now());
    expect(useApp.getState().backup).toMatchObject({ on: true, code, escrow: 'family' });
  });

  it('no family token: nothing to keep', async () => {
    expect(await keepCode('family')).toBe('off');
    expect(server.calls).toEqual([]);
  });

  it('the code reaches only the escrow route (never a header or another body)', async () => {
    linked();
    await afterFamilyLink({ deviceToken: FD });
    const { code } = useApp.getState().backup;
    for (const c of server.calls) {
      if (c.path === '/api/vault/escrow') continue;
      expect(JSON.stringify([c.headers, c.body])).not.toContain(code);
    }
    const { key, lookup } = await derive(code);
    expect((await open(server.vaults.get(lookup).blob, key)).state.profile.name).toBe('נועה');
  });
});
