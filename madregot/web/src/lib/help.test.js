// Help both ways on the device (lib/help.js, spec TEACHER-6): which requests wait for the teacher, when a student may
// answer, which replies are unread and which still need their notice, where the notice may not appear, the time words,
// and the calls that keep the thread on this device in step with the server.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

function fakeStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k),
    clear: () => m.clear(), key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; },
  };
}
beforeEach(() => { vi.stubGlobal('localStorage', fakeStorage()); vi.stubGlobal('sessionStorage', fakeStorage()); });
afterEach(() => { vi.unstubAllGlobals(); });
const load = async () => {
  vi.resetModules();
  return { ...(await import('./help.js')), store: await import('./store.js') };
};
const msg = (id, from, read = false) => ({ id, from, body: from === 'teacher' ? 'נעבור על זה מחר בכיתה' : 'תודה, הבנתי', at: '2026-11-05T08:00:00.000Z', read });

describe('the teacher\'s side', () => {
  it('a request waits for the teacher with no reply yet, or when the student wrote last; never once it is done', async () => {
    const { waitsForTeacher } = await load();
    expect(waitsForTeacher({ done_at: null, messages: [] })).toBe(true);
    expect(waitsForTeacher({ done_at: null, messages: [msg(1, 'teacher')] })).toBe(false);
    expect(waitsForTeacher({ done_at: null, messages: [msg(1, 'teacher'), msg(2, 'student')] })).toBe(true);
    expect(waitsForTeacher({ done_at: '2026-11-05', messages: [] })).toBe(false);
  });
});

describe('the student\'s side', () => {
  it('answers only a reply, three at most', async () => {
    const { canAnswer } = await load();
    expect(canAnswer({ messages: [] })).toBe(false);
    expect(canAnswer({ messages: [msg(1, 'teacher')] })).toBe(true);
    expect(canAnswer({ messages: [msg(1, 'teacher'), msg(2, 'student')] })).toBe(false);
    const three = [msg(1, 'teacher'), msg(2, 'student'), msg(3, 'teacher'), msg(4, 'student'), msg(5, 'teacher'), msg(6, 'student')];
    expect(canAnswer({ messages: [...three.slice(0, 5)] })).toBe(true);
    expect(canAnswer({ messages: [...three, msg(7, 'teacher')] })).toBe(false);
  });
  it('unread replies light the tab; a notice comes once per message', async () => {
    const { unreadReplies, hasUnreadReply, toAnnounce } = await load();
    const cw = { help: [{ id: 7, messages: [msg(1, 'teacher', true), msg(2, 'student'), msg(3, 'teacher')] }, { id: 8, messages: [] }], noticed: {} };
    expect(unreadReplies(cw).map((x) => [x.help.id, x.message.id])).toEqual([[7, 3]]);
    expect(hasUnreadReply(cw)).toBe(true);
    expect(toAnnounce(cw).map((x) => x.message.id)).toEqual([3]);
    expect(toAnnounce({ ...cw, noticed: { 3: true } })).toEqual([]);
    expect(hasUnreadReply({ help: [] })).toBe(false);
    expect(hasUnreadReply(undefined)).toBe(false);
  });
  it('no notice inside a lesson, a stage, practice, a check, a repair or a class exam', async () => {
    const { focusedRoute } = await load();
    for (const p of ['/lesson/signed/1', '/practice/signed', '/placement', '/repair/signed/1', '/learn/signed/1/B', '/class/exam/a000000000000001/run']) expect(focusedRoute(p)).toBe(true);
    for (const p of ['/', '/quests', '/me', '/learn/signed/1', '/class/exam/a000000000000001', '/topics']) expect(focusedRoute(p)).toBe(false);
  });
  it('opening a thread reads the replies here and on the server; an answer joins the thread with the server\'s status', async () => {
    const { openThread, sendStudentReply, markNoticed, store } = await load();
    const { useApp } = store;
    useApp.setState({
      profile: { role: 'student', name: 'דנה', grade: '7', token: 'stok-a1' },
      ai: { ...useApp.getState().ai, apiUrl: 'https://api.example.test' },
      classWork: { ...useApp.getState().classWork, help: [{ id: 7, status: 'done', messages: [msg(1, 'teacher')] }] },
    });
    const calls = [];
    vi.stubGlobal('fetch', async (url, init) => {
      calls.push([url, JSON.parse(init.body || '{}')]);
      const reply = url.endsWith('/reply') ? { message: { id: 2, from: 'student', body: 'עדיין לא ברור לי', at: '2026-11-05T09:00:00.000Z', read: false }, status: 'answered' } : { ok: true };
      return new Response(JSON.stringify(reply), { status: url.endsWith('/reply') ? 201 : 200, headers: { 'Content-Type': 'application/json' } });
    });
    await openThread(useApp.getState().classWork.help[0]);
    expect(calls[0]).toEqual(['https://api.example.test/api/help/7/read', {}]);
    expect(useApp.getState().classWork.help[0].messages[0].read).toBe(true);
    await openThread(useApp.getState().classWork.help[0]);
    expect(calls).toHaveLength(1);
    await sendStudentReply(useApp.getState().classWork.help[0], { quick: 'still', text: '' });
    expect(calls[1]).toEqual(['https://api.example.test/api/help/7/reply', { quick: 'still' }]);
    const h = useApp.getState().classWork.help[0];
    expect(h.status).toBe('answered');
    expect(h.messages.map((m) => m.from)).toEqual(['teacher', 'student']);
    markNoticed([1]);
    expect(useApp.getState().classWork.noticed).toEqual({ 1: true });
  });
  it('says when in short words', async () => {
    const { whenText } = await load();
    const now = new Date(2026, 10, 5, 12, 0);
    expect(whenText(new Date(2026, 10, 5, 9, 5).toISOString(), now)).toBe('היום, 9:05');
    expect(whenText(new Date(2026, 10, 4, 18, 30).toISOString(), now)).toBe('אתמול, 18:30');
    expect(whenText(new Date(2026, 10, 2, 7, 0).toISOString(), now)).toBe('2.11, 7:00');
    expect(whenText('nonsense', now)).toBe('');
  });
});
