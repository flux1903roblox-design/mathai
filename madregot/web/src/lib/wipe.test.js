// "Delete all" on the device (trust spec TRUST-6 §2): the server first, and a failure there leaves every byte where it
// was; after it, no key of the app is left in either storage, the store is a new device's (no personal key, no device
// id, no token), the parent's session is ended on the server, and the app reloads at the start page. Storage, fetch
// and the address are fakes; every value is synthetic.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

function fakeStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k),
    clear: () => m.clear(), key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; }, keys: () => [...m.keys()],
  };
}
const TOKEN = 'a'.repeat(64);
const STUDENT = 's'.repeat(40);
const FD = `fd1.${'b'.repeat(64)}`;
const DEVICE = 'c0ffee'.repeat(5) + 'c0';
const KEYS = ['madregot-parent', 'madregot-debug', 'madregot-seed', 'madregot-checkout-family_month', 'madregot-staging', 'madregot-theme', 'madregot-order'];
let local; let session; let calls; let replaced; let forgetStatus;

const saved = (over = {}) => JSON.stringify({
  state: {
    profile: { role: 'student', name: 'נועה', grade: '7', classCode: 'ABC234', className: 'ז׳3', token: STUDENT, studentId: 'st1' },
    xp: 120,
    ai: { mode: 'server', apiUrl: '', key: 'sk-ant-SYNTHETIC-TEST-KEY', device: DEVICE, familyDevice: { token: FD, label: 'הטאבלט' }, pendingLink: null, lastTier: 'family', introSeen: true },
    ...over,
  },
  version: 4,
});
function seed(over) {
  local.setItem('madregot', saved(over));
  for (const k of KEYS) local.setItem(k, 'x');
  local.setItem('madregot-parent', JSON.stringify({ token: TOKEN, email: 'parent@example.test' }));
  session.setItem('madregot-checkout-family_year', 'x');
  session.setItem('madregot-parent', JSON.stringify({ token: TOKEN, email: 'parent@example.test' }));
  local.setItem('other-app', 'kept');
}
async function load() {
  vi.resetModules();
  const { useApp } = await import('./store.js');
  const wipe = await import('./wipe.js');
  return { useApp, wipe };
}
const appKeys = () => [...local.keys(), ...session.keys()].filter((k) => k.startsWith('madregot'));
const urls = () => calls.map((c) => c.url.replace(/^https?:\/\/[^/]+/, ''));

beforeEach(() => {
  local = fakeStorage(); session = fakeStorage(); calls = []; replaced = []; forgetStatus = 200;
  vi.stubGlobal('localStorage', local);
  vi.stubGlobal('sessionStorage', session);
  vi.stubGlobal('window', { localStorage: local, sessionStorage: session, location: { origin: 'https://madregot.example.test', replace: (u) => replaced.push(u) } });
  vi.stubGlobal('fetch', vi.fn(async (url, init = {}) => {
    calls.push({ url: String(url), headers: init.headers || {}, body: init.body });
    if (String(url).endsWith('/api/me/forget')) {
      return new Response(JSON.stringify(forgetStatus === 200 ? { ok: true, student: true, familyDevice: true, device: true } : { error: 'server_error' }), { status: forgetStatus });
    }
    return new Response(JSON.stringify({ ok: true, revoked: 1 }), { status: 200 });
  }));
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('delete all', () => {
  it('asks the server first with every identity, then ends the parent session, removes every key of the app and reloads', async () => {
    seed();
    const { useApp, wipe } = await load();
    expect(useApp.getState().ai.key).toBe('sk-ant-SYNTHETIC-TEST-KEY'); // the council's repro: a dev build's key
    const order = [];
    wipe.onWipe('vault', async () => { order.push(`vault after ${urls().join(',')}`); });
    await wipe.wipeEverything();
    const forget = calls.find((c) => c.url.endsWith('/api/me/forget'));
    expect(forget.headers).toMatchObject({ Authorization: `Bearer ${STUDENT}`, 'X-Family-Device': FD, 'X-Device': DEVICE });
    expect(forget.body).toBe('{}');
    expect(order).toEqual(['vault after /api/me/forget'], 'a registered step runs after the server and before the device');
    const signout = calls.find((c) => c.url.endsWith('/api/account/signout'));
    expect(signout.headers['X-Account-Token']).toBe(TOKEN);
    expect(appKeys()).toEqual([]);
    expect(local.getItem('other-app')).toBe('kept');
    const st = useApp.getState();
    expect(st.ai.key).toBe('');
    expect(st.ai.device).toBe('');
    expect(st.ai.familyDevice).toBeNull();
    expect(st.profile).toBeNull();
    expect(st.xp).toBe(0);
    expect(replaced).toEqual(['/?wiped=1']);
  });

  it('when the server fails, nothing on the device is touched and the error reaches the screen', async () => {
    seed();
    forgetStatus = 500;
    const { useApp, wipe } = await load();
    const step = vi.fn();
    wipe.onWipe('vault', step);
    const before = { local: local.keys().map((k) => [k, local.getItem(k)]), session: session.keys().map((k) => [k, session.getItem(k)]) };
    await expect(wipe.wipeEverything()).rejects.toMatchObject({ code: 'server_error', status: 500 });
    expect(local.keys().map((k) => [k, local.getItem(k)])).toEqual(before.local);
    expect(session.keys().map((k) => [k, session.getItem(k)])).toEqual(before.session);
    expect(step).not.toHaveBeenCalled();
    expect(urls()).toEqual(['/api/me/forget'], 'the parent session is not ended either');
    expect(useApp.getState().profile?.token).toBe(STUDENT);
    expect(replaced).toEqual([]);
  });

  it('a registered step that fails stops the wipe the same way', async () => {
    seed();
    const { wipe } = await load();
    wipe.onWipe('vault', async () => { throw new Error('vault_unreachable'); });
    await expect(wipe.wipeEverything()).rejects.toThrow('vault_unreachable');
    expect(appKeys().sort()).toEqual(['madregot', ...KEYS, 'madregot-checkout-family_year', 'madregot-parent'].sort(), 'every key, in both storages');
    expect(replaced).toEqual([]);
  });

  it('the store is replaced, not merged: a field it never had is gone, its actions still work, and nothing is written again', async () => {
    seed();
    const { useApp, wipe } = await load();
    useApp.setState({ strayFromAnotherLane: { secret: 1 } });
    await wipe.wipeEverything();
    expect('strayFromAnotherLane' in useApp.getState()).toBe(false);
    useApp.getState().setGoalXp(30); // a late write from a screen that is still open
    expect(useApp.getState().goalXp).toBe(30);
    expect(appKeys()).toEqual([], 'the late write did not save anything');
  });

  it('with no server: nothing is sent, the device is cleared, and the start page says "this device"', async () => {
    seed({ ai: { mode: 'server', apiUrl: 'none', key: '', device: DEVICE, familyDevice: null, pendingLink: null, lastTier: null, introSeen: true } });
    const { wipe } = await load();
    await wipe.wipeEverything();
    expect(urls().filter((u) => u.endsWith('/api/me/forget'))).toEqual([]);
    expect(appKeys()).toEqual([]);
    expect(replaced).toEqual(['/?wiped=device']);
  });

  it('"delete from this device only" (after the second question) clears the device even when the server is down', async () => {
    seed();
    forgetStatus = 500;
    const { wipe } = await load();
    wipe.onWipe('vault', async () => { throw new Error('vault_unreachable'); });
    await wipe.wipeDeviceOnly();
    expect(urls().filter((u) => u.endsWith('/api/me/forget'))).toEqual([]);
    expect(appKeys()).toEqual([]);
    expect(replaced).toEqual(['/?wiped=device']);
  });

  it('a teacher: no student token is sent, and the class keys go with the store', async () => {
    seed({ profile: { role: 'teacher', name: 'המורה כהן', classes: [{ code: 'ABC234', key: 'k'.repeat(32), name: 'ז׳3' }], active: 'ABC234' } });
    const { useApp, wipe } = await load();
    expect(wipe.forgetHeaders()).toEqual({ 'X-Family-Device': FD, 'X-Device': DEVICE });
    await wipe.wipeEverything();
    expect(calls.find((c) => c.url.endsWith('/api/me/forget')).headers.Authorization).toBeUndefined();
    expect(useApp.getState().profile).toBeNull();
    expect(appKeys()).toEqual([]);
  });

  it('onWipe returns a way to take the step away', async () => {
    seed();
    const { wipe } = await load();
    const step = vi.fn();
    const off = wipe.onWipe('push', step);
    off();
    await wipe.wipeEverything();
    expect(step).not.toHaveBeenCalled();
  });
});

describe('the words of the sheet (Appendix E §E.5)', () => {
  const student = { role: 'student', name: 'נועה', token: STUDENT, classCode: 'ABC234' };
  const linked = { familyDevice: { token: FD, label: 'הטאבלט' } };
  it('says what will be deleted, for each kind of device', async () => {
    const { wipe } = await load();
    expect(wipe.wipeText({ profile: student, ai: {}, server: true })).toBe('נמחק את כל מה שנשמר במכשיר הזה, וגם את מה שנשמר עליכם בשרת של הכיתה: השם, ההתקדמות, הבקשות למורה והמבחנים. המורה כבר לא יראה אתכם ברשימה. אי אפשר לבטל.');
    expect(wipe.wipeText({ profile: student, ai: linked, server: true, tier: 'family' })).toContain('המורה כבר לא יראה אתכם ברשימה. המכשיר גם ינותק מהמנוי המשפחתי, וההורים יקבלו על זה מייל. אי אפשר לבטל.');
    expect(wipe.wipeText({ profile: { role: 'student', name: 'נועה' }, ai: linked, server: true, tier: 'free' }))
      .toBe('נמחק את כל מה שנשמר במכשיר הזה: השם, ההתקדמות, הטעויות שזוהו, תוכנית המבחן, המבחנים והמספרים, וגם את מספר המכשיר שהשרת מכיר. המכשיר גם ינותק מהחשבון של ההורים, וההורים יקבלו על זה מייל. אי אפשר לבטל.');
    expect(wipe.wipeText({ profile: { role: 'teacher', classes: [] }, ai: {}, server: true })).toBe('נמחק מהמכשיר הזה את הכיתות ואת מפתחות המורה. המידע של הכיתות בשרת נשאר: כדי למחוק אותו, מוחקים כל כיתה בלוח המורה לפני כן. אי אפשר לבטל.');
    expect(wipe.wipeText({ profile: student, ai: linked, server: false })).toBe('נמחק את כל מה שנשמר במכשיר הזה: השם, ההתקדמות, הטעויות שזוהו, תוכנית המבחן, המבחנים והמספרים. אי אפשר לבטל.');
  });
  it('before deleting from the device only, says what stays on the server and until when (shared/retention.js)', async () => {
    const { wipe } = await load();
    const { RETENTION } = await import('@shared/retention.js');
    expect(wipe.deviceOnlyText({ profile: student, ai: {} })).toBe(`המידע בשרת של הכיתה יישאר עד שהמורה ימחק אותו, או עד שיימחק מעצמו אחרי ${RETENTION.studentIdleDays} יום.`);
    expect(wipe.deviceOnlyText({ profile: { role: 'student' }, ai: linked })).toBe('מה שהשרת יודע על המכשיר הזה יימחק מעצמו בתוך כמה שבועות. ההורים יכולים לנתק את המכשיר בעמוד ההורים.');
    expect(wipe.WIPE_FAILED).toBe('לא הצלחנו למחוק מהשרת, ולכן עוד לא מחקנו כלום. בדקו את החיבור לאינטרנט ונסו שוב.');
  });
});
