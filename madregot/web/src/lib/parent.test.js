// The parent's session on a device: kept in localStorage only on a device with no profile (the parent's own phone) or a
// teacher's device (unless signed in as a shared computer), never left behind for a child once a student profile exists,
// and gone (on the server too) with "delete all data".
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

function fakeStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k),
    clear: () => m.clear(), key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; }, keys: () => [...m.keys()],
  };
}
const TOKEN = 'a'.repeat(64);
let local; let session; let calls;

async function load() {
  vi.resetModules();
  const { useApp } = await import('./store.js');
  const parent = await import('./parent.js');
  return { useApp, parent };
}
const signouts = () => calls.filter((c) => c.url.endsWith('/api/account/signout'));

beforeEach(() => {
  local = fakeStorage(); session = fakeStorage(); calls = [];
  vi.stubGlobal('localStorage', local);
  vi.stubGlobal('sessionStorage', session);
  vi.stubGlobal('window', { localStorage: local, sessionStorage: session, location: { origin: 'https://madregot.example.test' } });
  vi.stubGlobal('fetch', vi.fn(async (url, init = {}) => {
    calls.push({ url, headers: init.headers || {} });
    if (String(url).endsWith('/api/account/verify')) return new Response(JSON.stringify({ token: TOKEN, email: 'parent@example.test' }), { status: 200 });
    return new Response(JSON.stringify({ ok: true, revoked: 1 }), { status: 200 });
  }));
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('the parent session on a shared device', () => {
  it('a session saved before any profile is ended, here and on the server, once a child profile is created', async () => {
    const { useApp, parent } = await load();
    await parent.verifyCode('parent@example.test', '123456');
    expect(local.keys()).toContain('madregot-parent'); // the parent's own phone (so far): kept across visits
    useApp.getState().setProfile({ role: 'student', name: 'נועה', grade: '7' });
    expect(local.getItem('madregot-parent')).toBeNull();
    expect(session.getItem('madregot-parent')).toBeNull();
    expect(parent.useParent.getState().session).toBeNull();
    await vi.waitFor(() => expect(signouts()).toHaveLength(1));
    expect(signouts()[0].headers['X-Account-Token']).toBe(TOKEN);
  });

  it('a page opened on a device with a profile never picks up a session left in localStorage', async () => {
    local.setItem('madregot', JSON.stringify({ state: { profile: { role: 'student', name: 'נועה', grade: '7' } }, version: 3 }));
    local.setItem('madregot-parent', JSON.stringify({ token: TOKEN, email: 'parent@example.test' }));
    const { parent } = await load();
    expect(parent.useParent.getState().session).toBeNull();
    expect(local.getItem('madregot-parent')).toBeNull();
    await vi.waitFor(() => expect(signouts()).toHaveLength(1));
  });

  it('on a device with a profile, a parent who signs in keeps the session for this tab only', async () => {
    local.setItem('madregot', JSON.stringify({ state: { profile: { role: 'student', name: 'נועה', grade: '7' } }, version: 3 }));
    const { parent } = await load();
    await parent.verifyCode('parent@example.test', '123456');
    expect(session.getItem('madregot-parent')).toContain(TOKEN);
    expect(local.getItem('madregot-parent')).toBeNull();
  });

  it('the parent\'s own phone with no profile keeps its session across visits', async () => {
    local.setItem('madregot-parent', JSON.stringify({ token: TOKEN, email: 'parent@example.test' }));
    const { parent } = await load();
    expect(parent.useParent.getState().session?.token).toBe(TOKEN);
    expect(signouts()).toHaveLength(0);
  });

  it('a teacher who signs in and then opens the board keeps the session: nothing is revoked, and it stays in localStorage', async () => {
    const { useApp, parent } = await load();
    await parent.verifyCode('teacher@example.test', '123456');
    useApp.getState().setProfile({ role: 'teacher', name: 'רונית', grade: '7', classes: [{ code: 'K7Q2MD', key: null, className: 'ז׳3', grade: '7', owned: true }], active: 'K7Q2MD' });
    await new Promise((r) => setTimeout(r, 20));
    expect(signouts()).toHaveLength(0);
    expect(parent.useParent.getState().session?.token).toBe(TOKEN);
    expect(JSON.parse(local.getItem('madregot-parent'))).toEqual({ token: TOKEN, email: 'parent@example.test', shared: false });
  });

  it('on a teacher\'s device a sign-in is kept in localStorage, and survives a reload', async () => {
    local.setItem('madregot', JSON.stringify({ state: { profile: { role: 'teacher', name: 'רונית', grade: '7', classes: [], active: null } }, version: 4 }));
    const { parent } = await load();
    await parent.verifyCode('teacher@example.test', '123456');
    expect(local.getItem('madregot-parent')).toContain(TOKEN);
    expect(session.getItem('madregot-parent')).toBeNull();
    const again = await load();
    expect(again.parent.useParent.getState().session?.token).toBe(TOKEN);
    expect(local.getItem('madregot-parent')).toContain(TOKEN);
    expect(signouts()).toHaveLength(0);
  });

  it('"shared computer" keeps the session in this tab only, on any device, and a step-up keeps that choice', async () => {
    local.setItem('madregot', JSON.stringify({ state: { profile: { role: 'teacher', name: 'רונית', grade: '7', classes: [], active: null } }, version: 4 }));
    const { parent } = await load();
    await parent.verifyCode('teacher@example.test', '123456', { shared: true });
    expect(session.getItem('madregot-parent')).toContain(TOKEN);
    expect(local.getItem('madregot-parent')).toBeNull();
    // a fresh code while signed in (before replacing the teacher key): still this tab only
    await parent.verifyCode('teacher@example.test', '654321');
    expect(parent.useParent.getState().session.shared).toBe(true);
    expect(calls.filter((c) => c.url.endsWith('/api/account/verify')).at(-1).headers['X-Account-Token']).toBe(TOKEN);
    expect(session.getItem('madregot-parent')).toContain(TOKEN);
    expect(local.getItem('madregot-parent')).toBeNull();
    // and with no profile at all (signed in before the board was opened)
    local.clear(); session.clear();
    const fresh = await load();
    await fresh.parent.verifyCode('teacher@example.test', '123456', { shared: true });
    expect(session.getItem('madregot-parent')).toContain(TOKEN);
    expect(local.getItem('madregot-parent')).toBeNull();
  });

  it('a student profile still gets the session in this tab only, and creating one still revokes a kept session', async () => {
    local.setItem('madregot', JSON.stringify({ state: { profile: { role: 'student', name: 'נועה', grade: '7' } }, version: 4 }));
    const { parent } = await load();
    await parent.verifyCode('parent@example.test', '123456');
    expect(session.getItem('madregot-parent')).toContain(TOKEN);
    expect(local.getItem('madregot-parent')).toBeNull();
  });

  it('"delete all data" ends the parent session on the server and leaves none of the parents\' keys in either storage', async () => {
    const { useApp, parent } = await load();
    await parent.verifyCode('parent@example.test', '123456');
    for (const s of [local, session]) {
      for (const k of ['madregot-link-code', 'madregot-order', 'madregot-here', 'madregot-checkout-family_month', 'madregot-checkout-family_year']) s.setItem(k, 'x');
    }
    session.setItem('madregot-parent', JSON.stringify({ token: TOKEN, email: 'parent@example.test' }));
    await parent.forgetParentHere();
    useApp.persist.clearStorage(); useApp.getState().signOut();
    expect(signouts()).toHaveLength(1);
    expect(local.keys().filter((k) => k.startsWith('madregot-') && k !== 'madregot')).toEqual([]);
    expect(session.keys().filter((k) => k.startsWith('madregot-'))).toEqual([]);
    // a fresh page load finds no parent here
    const again = await load();
    expect(again.parent.useParent.getState().session).toBeNull();
  });
});
