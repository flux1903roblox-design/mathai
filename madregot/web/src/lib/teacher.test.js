// The teacher's credentials (lib/teacher.js): a class bound to the teacher's email opens with the session, any other
// class with its key; a refused key falls back to the session once (and the stale key is dropped), an ended session
// falls back to the key; the account's classes rebuild the board on a new device. Synthetic data only.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

function fakeStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k),
    clear: () => m.clear(), key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; },
  };
}
const TOKEN = 'b'.repeat(64);
const KEY = 'c'.repeat(24);
let local; let session; let calls; let answer;

const json = (data, status = 200) => new Response(JSON.stringify(data), { status });
beforeEach(() => {
  local = fakeStorage(); session = fakeStorage(); calls = [];
  answer = () => json({ ok: true });
  vi.stubGlobal('localStorage', local);
  vi.stubGlobal('sessionStorage', session);
  vi.stubGlobal('window', { localStorage: local, sessionStorage: session, location: { origin: 'https://madregot.example.test' } });
  vi.stubGlobal('fetch', vi.fn(async (url, init = {}) => {
    const call = { path: String(url).replace('https://madregot.example.test', ''), headers: init.headers || {}, body: init.body ? JSON.parse(init.body) : null };
    calls.push(call);
    return answer(call);
  }));
});
afterEach(() => { vi.unstubAllGlobals(); });

/** A fresh app: a teacher profile, and a signed-in session when `signedIn`. */
async function load({ classes = [], signedIn = false } = {}) {
  if (classes.length) local.setItem('madregot', JSON.stringify({ state: { profile: { role: 'teacher', name: 'רונית', grade: classes[0].grade, classes, active: classes[0].code } }, version: 4 }));
  if (signedIn) local.setItem('madregot-parent', JSON.stringify({ token: TOKEN, email: 'teacher@example.test' }));
  vi.resetModules();
  const { useApp } = await import('./store.js');
  useApp.getState().setAI({ apiUrl: 'https://madregot.example.test' });
  const parent = await import('./parent.js');
  const teacher = await import('./teacher.js');
  return { useApp, parent, teacher };
}
const owned = { code: 'K7Q2MD', key: KEY, className: 'ז׳3', grade: '7', owned: true };
const keyOnly = { code: 'K7Q2MD', key: KEY, className: 'ז׳3', grade: '7' };
const classOf = (useApp, code = 'K7Q2MD') => useApp.getState().profile.classes.find((c) => c.code === code);

describe('teacherHeaders', () => {
  it('an owned class with a session goes with the session; otherwise with the key', async () => {
    const { teacher } = await load({ classes: [owned], signedIn: true });
    expect(teacher.teacherHeaders(owned)).toEqual({ 'X-Class-Code': 'K7Q2MD', 'X-Account-Token': TOKEN });
    expect(teacher.teacherHeaders(keyOnly)).toEqual({ 'X-Class-Code': 'K7Q2MD', 'X-Teacher-Key': KEY });
    local.removeItem('madregot-parent');
    const signedOut = await load({ classes: [owned] });
    expect(signedOut.teacher.teacherHeaders(owned)).toEqual({ 'X-Class-Code': 'K7Q2MD', 'X-Teacher-Key': KEY });
  });

  it('with neither a session for an owned class nor a key, it throws not_account', async () => {
    const { teacher } = await load();
    expect(() => teacher.teacherHeaders({ ...owned, key: null })).toThrow(expect.objectContaining({ code: 'not_account', status: 401 }));
    expect(() => teacher.teacherHeaders({ code: 'K7Q2MD', key: null })).toThrow(expect.objectContaining({ code: 'not_account' }));
  });
});

describe('teacherApi', () => {
  it('a refused key (replaced on another device) is retried once with the session, and the stale key is dropped', async () => {
    const { teacher, useApp } = await load({ classes: [keyOnly], signedIn: true });
    answer = (c) => (c.headers['X-Teacher-Key'] ? json({ error: 'not_teacher' }, 401) : json({ class: { code: 'K7Q2MD' } }));
    const r = await teacher.teacherApi('/api/teacher/dashboard', {}, keyOnly);
    expect(r.class.code).toBe('K7Q2MD');
    expect(calls.map((c) => [c.headers['X-Teacher-Key'] || null, c.headers['X-Account-Token'] || null])).toEqual([[KEY, null], [null, TOKEN]]);
    expect(classOf(useApp)).toMatchObject({ key: null, owned: true });
  });

  it('a refused key with no session is the error, with no second call', async () => {
    const { teacher, useApp } = await load({ classes: [keyOnly] });
    answer = () => json({ error: 'not_teacher' }, 401);
    await expect(teacher.teacherApi('/api/teacher/dashboard', {}, keyOnly)).rejects.toMatchObject({ code: 'not_teacher', status: 401 });
    expect(calls).toHaveLength(1);
    expect(classOf(useApp).key).toBe(KEY);
  });

  it('an ended session is forgotten here, and the key on this device still opens the class', async () => {
    const { teacher, parent } = await load({ classes: [owned], signedIn: true });
    answer = (c) => (c.headers['X-Account-Token'] ? json({ error: 'not_account' }, 401) : json({ ok: true }));
    await teacher.teacherApi('/api/teacher/class/lock', { method: 'POST', body: { locked: true } }, owned);
    expect(calls.map((c) => [c.path, !!c.headers['X-Account-Token'], !!c.headers['X-Teacher-Key']])).toEqual([
      ['/api/teacher/class/lock', true, false], ['/api/teacher/class/lock', false, true]]);
    expect(calls[1].body).toEqual({ locked: true });
    expect(parent.useParent.getState().session).toBeNull();
    expect(local.getItem('madregot-parent')).toBeNull();
  });

  it('an owned class with no key and an ended session asks for the email (not_account)', async () => {
    const { teacher } = await load({ classes: [{ ...owned, key: null }], signedIn: true });
    answer = () => json({ error: 'not_account' }, 401);
    await expect(teacher.teacherApi('/api/teacher/dashboard', {}, { ...owned, key: null })).rejects.toMatchObject({ code: 'not_account' });
    expect(calls).toHaveLength(1);
  });

  it('other errors are passed on as they are, and the call never carries a student token', async () => {
    const { teacher } = await load({ classes: [owned], signedIn: true });
    answer = () => json({ error: 'bad_action' }, 400);
    await expect(teacher.teacherApi('/api/teacher/help/3', { method: 'POST', body: { action: 'x' } }, owned)).rejects.toMatchObject({ code: 'bad_action', status: 400 });
    expect(calls).toHaveLength(1);
    expect(calls[0].headers.Authorization).toBeUndefined();
  });
});

describe('the account\'s classes', () => {
  it('myClasses, bindClass and rekey go with the session; bind marks the class owned, rekey keeps the new key here', async () => {
    const { teacher, useApp } = await load({ classes: [keyOnly], signedIn: true });
    answer = (c) => {
      if (c.path === '/api/teacher/classes') return json({ classes: [{ code: 'K7Q2MD', name: 'ז׳3', grade: '7' }] });
      if (c.path === '/api/teacher/class/owner') return json({ owner: 'you', email: 'teacher@example.test' });
      if (c.path === '/api/teacher/class/rekey') return json({ teacherKey: 'd'.repeat(24) });
      return json({});
    };
    expect(await teacher.myClasses()).toHaveLength(1);
    expect(calls[0].headers['X-Account-Token']).toBe(TOKEN);
    await teacher.bindClass(keyOnly);
    expect(calls[1].headers).toMatchObject({ 'X-Class-Code': 'K7Q2MD', 'X-Teacher-Key': KEY, 'X-Account-Token': TOKEN });
    expect(classOf(useApp).owned).toBe(true);
    await teacher.rekey(classOf(useApp));
    expect(calls[2].headers).toMatchObject({ 'X-Class-Code': 'K7Q2MD', 'X-Account-Token': TOKEN });
    expect(calls[2].headers['X-Teacher-Key']).toBeUndefined();
    expect(classOf(useApp)).toMatchObject({ key: 'd'.repeat(24), owned: true });
  });

  it('restore opens the board from the account\'s classes on a new device, with no key', async () => {
    const { teacher, useApp } = await load({ signedIn: true });
    teacher.restore([
      { code: 'AAA222', name: 'ח׳1', grade: '8', teacherName: 'רונית', students: 3 },
      { code: 'BBB333', name: 'ז׳3', grade: '7', teacherName: 'רונית', students: 24 },
    ]);
    expect(useApp.getState().profile).toEqual({
      role: 'teacher', name: 'רונית', active: 'AAA222', grade: '8',
      classes: [{ code: 'AAA222', key: null, className: 'ח׳1', grade: '8', owned: true }, { code: 'BBB333', key: null, className: 'ז׳3', grade: '7', owned: true }],
    });
    expect(JSON.stringify(useApp.getState().profile)).not.toContain('@'); // the email stays in the session only
  });

  it('restore on a device that already has the board keeps its classes, keys and open class', async () => {
    const { teacher, useApp } = await load({ classes: [keyOnly, { code: 'CCC444', key: 'e'.repeat(24), className: 'ח׳4', grade: '8' }], signedIn: true });
    teacher.restore([{ code: 'K7Q2MD', name: 'ז׳3', grade: '7', teacherName: 'רונית' }, { code: 'AAA222', name: 'ח׳1', grade: '8', teacherName: 'רונית' }]);
    const p = useApp.getState().profile;
    expect(p.active).toBe('K7Q2MD');
    expect(p.classes.map((c) => [c.code, c.key, !!c.owned])).toEqual([['K7Q2MD', KEY, true], ['CCC444', 'e'.repeat(24), false], ['AAA222', null, true]]);
  });

  it('setActiveClass opens another class and takes its grade', async () => {
    const { useApp } = await load({ classes: [keyOnly, { code: 'AAA222', key: null, className: 'ח׳1', grade: '8', owned: true }] });
    useApp.getState().setActiveClass('AAA222');
    expect(useApp.getState().profile).toMatchObject({ active: 'AAA222', grade: '8' });
    useApp.getState().setActiveClass('NOPE00');
    expect(useApp.getState().profile).toMatchObject({ active: 'AAA222', grade: '8' });
  });
});

describe('the bind card and the public site\'s link', () => {
  it('the card is offered for a class that only its key opens here, and "לא עכשיו" hides it for a week', async () => {
    const { teacher, useApp } = await load({ classes: [keyOnly] });
    expect(teacher.offerBind(keyOnly, '2026-11-10')).toBe(true);
    expect(teacher.offerBind(owned, '2026-11-10')).toBe(false); // bound already
    expect(teacher.offerBind({ ...keyOnly, key: null }, '2026-11-10')).toBe(false); // nothing to bind with
    teacher.remindBindLater(keyOnly, '2026-11-10');
    const later = classOf(useApp);
    expect(later.bindLater).toBe('2026-11-17');
    expect(teacher.offerBind(later, '2026-11-16')).toBe(false);
    expect(teacher.offerBind(later, '2026-11-17')).toBe(true);
    // a week across a month end
    expect(teacher.dayPlus('2026-11-28', 7)).toBe('2026-12-05');
  });

  it('teacherSiteLink opens the hosted app on the teacher\'s way in, and refuses anything but an http(s) address', async () => {
    const { teacher } = await load();
    expect(teacher.teacherSiteLink('https://example.test/')).toBe('https://example.test/#/?start=teacher');
    expect(teacher.teacherSiteLink(' https://madregot.example.test/#/old ')).toBe('https://madregot.example.test/#/?start=teacher');
    expect(teacher.teacherSiteLink('')).toBe('');
    expect(teacher.teacherSiteLink(undefined)).toBe('');
    expect(teacher.teacherSiteLink('javascript:alert(1)')).toBe('');
  });
});

describe('the class itself: rename, delete, and taking it off this device (TEACHER-9)', () => {
  it('a rename goes with the class headers, and this device takes the name the server kept', async () => {
    const { useApp, teacher } = await load({ classes: [keyOnly] });
    answer = () => json({ ok: true, className: 'ז׳3 מורחבת' });
    await teacher.renameClass(keyOnly, '  ז׳3   מורחבת ');
    expect(calls[0]).toMatchObject({ path: '/api/teacher/class/rename', body: { className: '  ז׳3   מורחבת ' }, headers: { 'X-Class-Code': 'K7Q2MD', 'X-Teacher-Key': KEY } });
    expect(classOf(useApp).className).toBe('ז׳3 מורחבת');
  });

  it('a delete always asks with the word DELETE, and the session goes with the key so the owner is known', async () => {
    const { teacher } = await load({ classes: [keyOnly], signedIn: true });
    await teacher.deleteClass(keyOnly);
    expect(calls[0]).toMatchObject({ path: '/api/teacher/class/delete', body: { confirm: 'DELETE' }, headers: { 'X-Class-Code': 'K7Q2MD', 'X-Teacher-Key': KEY, 'X-Account-Token': TOKEN } });
    await teacher.deleteClass(owned);
    expect(calls[1].headers).toEqual(expect.objectContaining({ 'X-Class-Code': 'K7Q2MD', 'X-Account-Token': TOKEN }));
    expect(calls[1].headers['X-Teacher-Key']).toBeUndefined();
    local.removeItem('madregot-parent');
    const signedOut = await load({ classes: [keyOnly] });
    await signedOut.teacher.deleteClass(keyOnly);
    expect(calls[2].headers['X-Account-Token']).toBeUndefined();
  });

  it('a refused delete is the server\'s answer, unchanged (the page shows the step-up or the licence words)', async () => {
    const { teacher } = await load({ classes: [owned], signedIn: true });
    answer = () => json({ error: 'reauth_needed' }, 401);
    await expect(teacher.deleteClass(owned)).rejects.toMatchObject({ code: 'reauth_needed', status: 401 });
    answer = () => json({ error: 'class_has_licence' }, 409);
    await expect(teacher.deleteClass(owned)).rejects.toMatchObject({ code: 'class_has_licence', status: 409 });
  });

  it('after a delete the next class opens with its grade; with none left there is nothing to open', async () => {
    const other = { code: 'AAA222', key: null, className: 'ח׳1', grade: '8', owned: true };
    const { useApp, teacher } = await load({ classes: [keyOnly, other] });
    expect(teacher.dropClassHere('K7Q2MD')).toMatchObject({ code: 'AAA222' });
    expect(useApp.getState().profile).toMatchObject({ active: 'AAA222', grade: '8', classes: [other] });
    expect(teacher.dropClassHere('AAA222')).toBe(null);
    expect(useApp.getState().profile.classes).toEqual([other]);
  });
});

describe('the student view (TEACHER-2)', () => {
  it('previewMode: a teacher on a student screen, never on the board or another teacher screen, and never a student', async () => {
    const { useApp, teacher } = await load({ classes: [keyOnly] });
    expect(teacher.previewMode('/learn/signed/1')).toBe(true);
    expect(teacher.previewMode('/learn/pyth/2/C')).toBe(true);
    expect(teacher.previewMode('/lesson/signed/1')).toBe(true);
    expect(teacher.previewMode('/repair/signed/1/sign')).toBe(true);
    expect(teacher.previewMode('/teacher')).toBe(false);
    expect(teacher.previewMode('/teacher/assistant')).toBe(false);
    expect(teacher.previewMode('/teacher/lessons')).toBe(false);
    expect(teacher.previewMode('/')).toBe(false);
    // without an argument it reads the address bar (a hash router)
    vi.stubGlobal('location', { hash: '#/lesson/signed/1?kind=check&purpose=mastery', origin: 'https://madregot.example.test' });
    expect(teacher.previewMode()).toBe(true);
    vi.stubGlobal('location', { hash: '#/teacher/lessons?grade=8', origin: 'https://madregot.example.test' });
    expect(teacher.previewMode()).toBe(false);
    useApp.getState().setProfile({ role: 'student', name: 'נועה', grade: '7' });
    expect(teacher.previewMode('/learn/signed/1')).toBe(false);
  });

  it('autoAskAllowed is false in the student view, even on the teacher\'s paid tier, and true again on the board', async () => {
    const { teacher } = await load({ classes: [keyOnly] });
    const acc = await import('./account.js');
    acc.useAIStatus.setState({ status: { paywall: true, tier: 'teacher', kinds: ['explain', 'chat'], groups: { tutor: { left: 20, limit: 20 } } } });
    vi.stubGlobal('location', { hash: '#/lesson/signed/1', origin: 'https://madregot.example.test' });
    expect(teacher.previewMode()).toBe(true);
    expect(acc.autoAskAllowed()).toBe(false);
    vi.stubGlobal('location', { hash: '#/teacher/assistant', origin: 'https://madregot.example.test' });
    expect(acc.autoAskAllowed()).toBe(true);
  });

  it('the way back is kept for this tab only while a preview is open, and only to a teacher screen', async () => {
    const { teacher } = await load({ classes: [keyOnly] });
    expect(teacher.previewBack.get()).toBe(null);
    teacher.previewBack.set('/teacher/lessons?grade=8');
    expect(session.getItem('madregot-preview-back')).toBe('/teacher/lessons?grade=8');
    expect(teacher.previewBack.get()).toBe('/teacher/lessons?grade=8');
    teacher.previewBack.set('https://evil.example.test/');
    teacher.previewBack.set('/quests');
    expect(teacher.previewBack.get()).toBe('/teacher/lessons?grade=8');
    session.setItem('madregot-preview-back', '//evil.example.test');
    expect(teacher.previewBack.get()).toBe(null);
    teacher.previewBack.clear();
    expect(session.getItem('madregot-preview-back')).toBe(null);
  });
});
