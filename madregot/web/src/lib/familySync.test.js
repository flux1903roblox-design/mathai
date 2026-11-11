// The parents' daily summary from a linked child device (PARENTS-4): nothing before "הבנתי", the right days, the
// 10 minutes, what each answer of the server does, the one header it carries, keepalive only on the same address and
// first on hidden, the child's switch, and a new profile on the device that is told again.
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { useApp } from './store.js';
import { useAIStatus } from './account.js';
import { keepaliveBudget, onMoment, emit, MOMENT_ORDER } from './durable/moments.js';
import {
  syncFamily, markSharingSeen, setChildSharing, rowsToSend, loadEngine, resetFamilySync, sharingReady, SEND_EVERY, MAX_DAYS, EARLIER_TEXT,
} from './familySync.js';

const API = 'https://api.madregot.test';
const FD = `fd1.${'f'.repeat(64)}`;
const T0 = new Date('2026-11-05T10:00:00'); // a Thursday, local time
const at = (ms) => () => new Date(T0.getTime() + ms);
const MIN = 60_000;
let calls; let answer; let engine; let serverState;

/**
 * A fake Worker: every call is recorded with its headers; `answer(path, body)` gives { status, body }. The status read
 * (GET /api/ai/status) answers with `serverState`, the summary's state on the server, which the child's switch sets.
 */
function server() {
  calls = [];
  serverState = 'on';
  answer = (path) => (path.endsWith('/sharing') ? { body: { sharing: 'child_off' } } : { body: { ok: true, saved: 1, sharing: 'on' } });
  vi.stubGlobal('fetch', vi.fn(async (url, init = {}) => {
    const path = new URL(url).pathname;
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ path, body, headers: { ...init.headers }, keepalive: !!init.keepalive });
    if (path === '/api/ai/status') return new Response(JSON.stringify({ paywall: true, tier: 'family', linked: { label: 'הטאבלט', summary: serverState } }), { status: 200 });
    const r = answer(path, body);
    if (path.endsWith('/sharing') && r.body?.sharing) serverState = r.body.sharing;
    return new Response(JSON.stringify(r.body ?? {}), { status: r.status || 200 });
  }));
}
const posts = () => calls.filter((c) => c.path === '/api/family/summary');
const sentDays = (i = -1) => posts().at(i).body.days.map((d) => d.d);

/** Days of learning: a lesson on each day given (and nothing on the others). */
const lessons = (...list) => Object.fromEntries(list.map((d) => [d, { lessons: 1, q: 8, ok: 7, secs: 300 }]));
const linked = (over = {}) => ({ token: FD, label: 'הטאבלט', sharingSeen: '2026-11-01T09:00:00.000Z', lastSent: null, ...over });
const statusOn = (summary = 'on') => useAIStatus.setState({ status: { paywall: true, tier: 'family', linked: { label: 'הטאבלט', summary } }, refreshed: useAIStatus.getState().refreshed + 1 });

beforeAll(async () => { engine = await loadEngine(); });
beforeEach(() => {
  server();
  vi.stubGlobal('location', { origin: 'https://app.madregot.test' });
  keepaliveBudget.reset();
  resetFamilySync();
  useApp.setState({
    profile: { role: 'student', name: 'נועה', grade: '7' },
    days: lessons('2026-11-05'),
    learn: { ...useApp.getState().learn, events: [], miscon: {}, skills: {}, exam: null },
    ai: { ...useApp.getState().ai, mode: 'server', apiUrl: API, familyDevice: linked() },
  });
  statusOn();
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('nothing is sent until every condition holds', () => {
  it('not before the child pressed "הבנתי", not unless the summary is on, not without the token or a server', async () => {
    useApp.getState().setAI({ familyDevice: linked({ sharingSeen: null }) });
    expect(await syncFamily({ moment: 'boot', now: at(0) })).toBe('not_seen');
    useApp.getState().setAI({ familyDevice: linked() });
    for (const s of ['child_off', 'parent_off', 'both_off', 'no_plan', 'off']) {
      statusOn(s);
      expect(await syncFamily({ moment: 'boot', now: at(0) })).toBe('off');
    }
    useAIStatus.setState({ status: { tier: 'family', linked: null } });
    expect(await syncFamily({ moment: 'boot', now: at(0) })).toBe('off');
    statusOn();
    useApp.getState().setAI({ familyDevice: { ...linked(), token: null } });
    expect(await syncFamily({ moment: 'boot', now: at(0) })).toBe('off');
    useApp.getState().setAI({ familyDevice: linked(), apiUrl: 'none' });
    expect(sharingReady()).toBe(false);
    expect(await syncFamily({ moment: 'boot', now: at(0) })).toBe('off');
    expect(calls).toEqual([]);
  });

  it('"הבנתי" records when, and sends at once', async () => {
    useApp.getState().setAI({ familyDevice: linked({ sharingSeen: null }) });
    expect(await markSharingSeen({ now: at(0) })).toBe('sent');
    expect(useApp.getState().ai.familyDevice.sharingSeen).toBe(T0.toISOString());
    expect(posts()).toHaveLength(1);
    expect(sentDays()).toEqual(['2026-11-05']);
  });
});

describe('which days go', () => {
  it('the days with activity from 7 days back to today, and today itself even when empty once this profile has sent, at most 8', async () => {
    // a lesson 9 and 8 days back (too old), 7 back (the first that goes), 3 back; nothing today
    useApp.setState({ days: lessons('2026-10-27', '2026-10-28', '2026-10-29', '2026-11-02') });
    expect(await syncFamily({ moment: 'boot', now: at(0) })).toBe('sent');
    expect(sentDays()).toEqual(['2026-10-29', '2026-11-02'], 'no empty today in a profile\'s first send');
    // once something was sent, today goes even while empty (the parent sees the device is in use)
    expect(await syncFamily({ moment: 'hidden', now: at(30 * MIN) })).toBe('sent');
    expect(sentDays()).toEqual(['2026-11-02', '2026-11-05']);
    const today = posts()[1].body.days.at(-1);
    expect(today).toMatchObject({ v: 1, d: '2026-11-05', m: 0, q: 0, ls: 0 });
    // a lesson every day: still 8 at most (7 back to today)
    useApp.getState().setAI({ familyDevice: linked() });
    useApp.setState({ days: lessons(...Array.from({ length: 12 }, (_, i) => `2026-10-${String(25 + i).padStart(2, '0')}`).filter((d) => d <= '2026-10-31'), '2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05') });
    const rows = rowsToSend(useApp.getState(), { day: '2026-11-05', now: T0, summary: engine.daySummary });
    expect(rows).toHaveLength(MAX_DAYS);
    expect(rows.map((r) => r.d)).toEqual(['2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05']);
  });

  it('after a send it starts from the last day sent, which goes again with its final numbers', () => {
    useApp.setState({ days: lessons('2026-11-01', '2026-11-03', '2026-11-04') });
    useApp.getState().setAI({ familyDevice: linked({ lastSent: { at: '2026-11-04T19:00:00.000Z', days: [{ v: 1, d: '2026-11-03' }, { v: 1, d: '2026-11-04' }] } }) });
    const rows = rowsToSend(useApp.getState(), { day: '2026-11-05', now: T0, summary: engine.daySummary });
    expect(rows.map((r) => r.d)).toEqual(['2026-11-04', '2026-11-05']);
  });

  it('time alone, an answer alone or a review counts as activity; a day with nothing does not', () => {
    useApp.setState({ days: { '2026-11-01': { tsecs: 120 }, '2026-11-02': { q: 3 }, '2026-11-03': {} } });
    const rows = rowsToSend(useApp.getState(), { day: '2026-11-05', now: T0, summary: engine.daySummary });
    expect(rows.map((r) => r.d)).toEqual(['2026-11-01', '2026-11-02']);
  });

  it('every row is the engine\'s whitelisted shape: codes and counts, no name', async () => {
    await syncFamily({ moment: 'boot', now: at(0) });
    const row = posts()[0].body.days[0];
    expect(Object.keys(row).sort()).toEqual(['d', 'ex', 'fx', 'm', 'ma', 'q', 'rv', 'sk', 'sr', 'ls', 'st', 'v'].sort());
    expect(JSON.stringify(posts()[0].body)).not.toContain('נועה');
    expect(JSON.stringify(posts()[0].body)).not.toContain('הטאבלט');
  });
});

describe('when', () => {
  it('at most once in 10 minutes; hidden goes when something changed; nothing goes when nothing changed', async () => {
    expect(await syncFamily({ moment: 'boot', now: at(0) })).toBe('sent');
    expect(useApp.getState().ai.familyDevice.lastSent).toEqual({ at: T0.toISOString(), days: posts()[0].body.days });
    // nothing changed: nothing goes, at any moment
    expect(await syncFamily({ moment: 'hidden', now: at(1 * MIN) })).toBe('unchanged');
    expect(await syncFamily({ moment: 'tick', now: at(30 * MIN) })).toBe('unchanged');
    // a lesson: within the 10 minutes it waits, except on hidden
    useApp.setState({ days: { '2026-11-05': { lessons: 2, q: 16, ok: 15, secs: 600 } } });
    expect(await syncFamily({ moment: 'lesson', now: at(5 * MIN) })).toBe('throttled');
    expect(await syncFamily({ moment: 'hidden', now: at(5 * MIN) })).toBe('sent');
    useApp.setState({ days: { '2026-11-05': { lessons: 3, q: 24, ok: 20, secs: 900 } } });
    expect(await syncFamily({ moment: 'tick', now: at(5 * MIN + SEND_EVERY - 1) })).toBe('throttled');
    expect(await syncFamily({ moment: 'tick', now: at(5 * MIN + SEND_EVERY) })).toBe('sent');
    expect(posts()).toHaveLength(3);
    expect(posts().map((p) => p.body.days.at(-1).ls)).toEqual([1, 2, 3]);
  });

  it('a failed send changes nothing here, and counts for the 10 minutes', async () => {
    answer = () => ({ status: 500, body: { error: 'server_error' } });
    expect(await syncFamily({ moment: 'boot', now: at(0) })).toBe('error');
    expect(useApp.getState().ai.familyDevice.lastSent).toBeNull();
    answer = () => ({ body: { ok: true } });
    expect(await syncFamily({ moment: 'tick', now: at(MIN) })).toBe('throttled');
    expect(await syncFamily({ moment: 'hidden', now: at(MIN) })).toBe('sent');
  });
});

describe('what the server says', () => {
  it('401 not_linked: the token is forgotten', async () => {
    answer = () => ({ status: 401, body: { error: 'not_linked' } });
    expect(await syncFamily({ moment: 'boot', now: at(0) })).toBe('unlinked');
    expect(useApp.getState().ai.familyDevice).toBeNull();
  });

  for (const [status, body, shown] of [
    [403, { error: 'sharing_off', sharing: 'parent_off' }, 'parent_off'],
    [429, { error: 'slow_down' }, 'on'],
    [402, { error: 'needs_subscription' }, 'no_plan'],
    [503, { error: 'report_off' }, 'off'],
  ]) {
    it(`${status}: nothing more until the next status read, and the state it gave is shown`, async () => {
      answer = () => ({ status, body });
      expect(await syncFamily({ moment: 'boot', now: at(0) })).toBe('stopped');
      expect(useAIStatus.getState().status.linked.summary).toBe(shown);
      expect(useApp.getState().ai.familyDevice.token).toBe(FD);
      // the summary shown "on" again (as the server may say), but no new status read: still nothing
      useAIStatus.setState({ status: { ...useAIStatus.getState().status, linked: { label: 'הטאבלט', summary: 'on' } } });
      expect(await syncFamily({ moment: 'hidden', now: at(20 * MIN) })).toBe('stopped');
      expect(posts()).toHaveLength(1);
      // the next status read: it may send again
      answer = () => ({ body: { ok: true } });
      statusOn();
      expect(await syncFamily({ moment: 'tick', now: at(20 * MIN) })).toBe('sent');
      expect(posts()).toHaveLength(2);
    });
  }
});

describe('what the request carries', () => {
  it('X-Family-Device only: never the parent\'s X-Account-Token, never the class token', async () => {
    useApp.setState({ profile: { role: 'student', name: 'נועה', grade: '7', classCode: 'K7Q2MD', token: 'stu_token_1', studentId: 's1' } });
    await syncFamily({ moment: 'boot', now: at(0) });
    const h = Object.fromEntries(Object.entries(posts()[0].headers).map(([k, v]) => [k.toLowerCase(), v]));
    expect(h['x-family-device']).toBe(FD);
    expect(h).not.toHaveProperty('x-account-token');
    expect(h).not.toHaveProperty('authorization');
    expect(h).not.toHaveProperty('x-device');
  });

  it('keepalive only on hidden, and only when the server is this page\'s own address', async () => {
    await syncFamily({ moment: 'hidden', now: at(0) });
    expect(posts()[0].keepalive).toBe(false); // another address (local dev): a plain fetch
    vi.stubGlobal('location', { origin: API });
    useApp.setState({ days: lessons('2026-11-04', '2026-11-05') });
    keepaliveBudget.reset();
    await syncFamily({ moment: 'hidden', now: at(MIN) });
    expect(posts()[1].keepalive).toBe(true);
    useApp.setState({ days: lessons('2026-11-03', '2026-11-04', '2026-11-05') });
    await syncFamily({ moment: 'tick', now: at(20 * MIN) });
    expect(posts()[2].keepalive).toBe(false); // not hidden
  });

  it('on hidden the summary claims its bytes before anything awaits, so it goes before the class outbox and the vault', async () => {
    vi.stubGlobal('location', { origin: API });
    const order = [];
    const unsubs = [
      onMoment('hidden', () => { order.push(`class:${keepaliveBudget.left()}`); }, { priority: MOMENT_ORDER.classOutbox }),
      onMoment('hidden', () => syncFamily({ moment: 'hidden', now: at(0) }).then((r) => order.push(`family:${r}`)), { priority: MOMENT_ORDER.family }),
    ];
    await emit('hidden');
    unsubs.forEach((u) => u());
    // the class outbox ran after the summary had taken its bytes from the 60,000
    expect(Number(order[0].split(':')[1])).toBeLessThan(60_000);
    expect(order).toContain('family:sent');
    expect(posts()[0].keepalive).toBe(true);
  });
});

describe('the child\'s own switch', () => {
  it('off with "delete what was sent": posts {on:false, forget:true}, forgets lastSent, shows child_off', async () => {
    await syncFamily({ moment: 'boot', now: at(0) });
    expect(useApp.getState().ai.familyDevice.lastSent).not.toBeNull();
    expect(await setChildSharing(false, { forget: true })).toBe('child_off');
    const sw = calls.find((c) => c.path === '/api/family/summary/sharing');
    expect(sw.body).toEqual({ on: false, forget: true });
    expect(sw.headers['X-Family-Device']).toBe(FD);
    expect(sw.headers).not.toHaveProperty('Authorization');
    expect(useApp.getState().ai.familyDevice.lastSent).toBeNull();
    expect(useAIStatus.getState().status.linked.summary).toBe('child_off');
  });
  it('off without deleting keeps the record of what was sent; on again sends at once', async () => {
    await syncFamily({ moment: 'boot', now: at(0) });
    await setChildSharing(false);
    expect(calls.find((c) => c.path === '/api/family/summary/sharing').body).toEqual({ on: false, forget: false });
    expect(useApp.getState().ai.familyDevice.lastSent).not.toBeNull();
    answer = (path) => (path.endsWith('/sharing') ? { body: { sharing: 'on' } } : { body: { ok: true } });
    useApp.setState({ days: lessons('2026-11-04', '2026-11-05') });
    expect(await setChildSharing(true)).toBe('on');
    await vi.waitFor(() => expect(posts()).toHaveLength(2));
    expect(useAIStatus.getState().status.linked.summary).toBe('on');
  });
});

describe('a new profile on a linked device', () => {
  it('signOut keeps the token and the label, and clears sharingSeen and lastSent: nothing goes until the notice is seen again', async () => {
    await syncFamily({ moment: 'boot', now: at(0) });
    useApp.getState().signOut();
    expect(useApp.getState().ai.familyDevice).toEqual({ token: FD, label: 'הטאבלט', sharingSeen: null, lastSent: null, earlier: true });
    useApp.getState().setProfile({ role: 'student', name: 'יואב', grade: '8' });
    expect(await syncFamily({ moment: 'hidden', now: at(30 * MIN) })).toBe('not_seen');
    expect(posts()).toHaveLength(1);
  });

  it('the new profile never sends an empty today over the day the first child sent; its own practice goes', async () => {
    expect(await syncFamily({ moment: 'boot', now: at(0) })).toBe('sent');
    expect(posts()[0].body.days.at(-1)).toMatchObject({ d: '2026-11-05', ls: 1 });
    useApp.getState().signOut();
    useApp.getState().setProfile({ role: 'student', name: 'יואב', grade: '8' });
    expect(await markSharingSeen({ now: at(20 * MIN) })).toBe('unchanged');
    expect(await syncFamily({ moment: 'lesson', now: at(40 * MIN) })).toBe('unchanged');
    expect(posts(), 'nothing replaced the first child\'s day').toHaveLength(1);
    useApp.setState({ days: { '2026-11-05': { lessons: 1, q: 6, ok: 5, secs: 200 } } });
    expect(await syncFamily({ moment: 'lesson', now: at(60 * MIN) })).toBe('sent');
    expect(posts()).toHaveLength(2);
  });

  it('the notice and the sharing sheet tell the new profile that the earlier summaries stay with the parents', () => {
    expect(EARLIER_TEXT).toBe('הסיכומים שנשלחו קודם מהמכשיר הזה נשארים אצל ההורים, והסיכומים שלכם יופיעו לידם.');
    useApp.getState().signOut();
    expect(useApp.getState().ai.familyDevice.earlier).toBe(false);
  });
});
