// The class goal on the device (STUDENT-4): syncNow sends the steps 50 at a time and keeps them after a failure, and
// loadClassGoal sends them before it asks for the goal, then keeps the answer. fetch is a stub: nothing leaves.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useApp } from './store.js';
import { syncNow, STEPS_PER_SYNC } from './api.js';
import { loadClassGoal, resetClassGoal, dayOfWeek } from './classGoal.js';

const API = 'https://api.madregot.test';
const inClass = { role: 'student', name: 'נועה', grade: '7', classCode: 'K7Q2MD', className: 'ז׳3', token: 'stu_token_1', studentId: 's1' };
const step = (i) => ({ sid: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, at: '2026-11-05T10:00:00.000Z', pts: 1 });
const GOAL = { on: true, week: '2026-11-01', target: 60, have: 64, mine: 4, reached: true, last: null };

let calls;
function stubFetch(answer) {
  calls = [];
  globalThis.fetch = vi.fn(async (url, init = {}) => {
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ url: String(url).replace(API, ''), method: init.method || 'GET', body, auth: init.headers?.Authorization });
    const r = answer(String(url).replace(API, ''), body, calls.length);
    return new Response(JSON.stringify(r.body ?? {}), { status: r.status ?? 200, headers: { 'Content-Type': 'application/json' } });
  });
}

describe('the class goal on the device (STUDENT-4)', () => {
  const realFetch = globalThis.fetch;
  beforeEach(() => {
    useApp.getState().resetProgress();
    useApp.setState({ profile: inClass, ai: { ...useApp.getState().ai, apiUrl: API }, stepsOut: [], classGoals: {} });
    resetClassGoal();
  });
  afterEach(() => { globalThis.fetch = realFetch; });

  it('syncNow sends the steps with the answers, 50 at a time, until none are left', async () => {
    useApp.setState({ stepsOut: Array.from({ length: 120 }, (_, i) => step(i)) });
    stubFetch(() => ({ body: { saved: 0, steps: 50 } }));
    await syncNow();
    const posts = calls.filter((c) => c.url === '/api/progress');
    expect(posts.map((c) => c.body.steps.length)).toEqual([STEPS_PER_SYNC, STEPS_PER_SYNC, 20]);
    expect(posts[0].body.steps[0]).toEqual(step(0));
    expect(posts[0].auth).toBe('Bearer stu_token_1');
    expect(useApp.getState().stepsOut).toEqual([]);
  });

  it('a failed sync puts the steps back, in order, to be sent again (each id counts once on the server)', async () => {
    useApp.setState({ stepsOut: [step(1), step(2)] });
    stubFetch(() => ({ status: 500, body: { error: 'server_error' } }));
    await syncNow();
    expect(useApp.getState().stepsOut).toEqual([step(1), step(2)]);
    stubFetch(() => ({ body: { saved: 0, steps: 2 } }));
    await syncNow();
    expect(calls[0].body.steps).toEqual([step(1), step(2)]);
    expect(useApp.getState().stepsOut).toEqual([]);
  });

  it('two syncs at once are one: the second waits for the first', async () => {
    useApp.setState({ stepsOut: [step(1)] });
    stubFetch(() => ({ body: { saved: 0, steps: 1 } }));
    const a = syncNow(); const b = syncNow();
    expect(b).toBe(a);
    await a;
    expect(calls).toHaveLength(1);
  });

  it('loadClassGoal sends the waiting steps first, then keeps the answer and the scarf it earns', async () => {
    useApp.setState({ stepsOut: [step(1)] });
    stubFetch((url) => (url === '/api/class/goal' ? { body: GOAL } : { body: { saved: 0, steps: 1 } }));
    const g = await loadClassGoal();
    expect(calls.map((c) => c.url)).toEqual(['/api/progress', '/api/class/goal']);
    expect(g).toEqual(GOAL);
    expect(useApp.getState().classGoals['2026-11-01']).toEqual({ target: 60, have: 64, mine: 4, reached: true });
    expect(useApp.getState().look.earned).toContain('class-scarf');
    // seconds later the answer is still fresh: no new request
    await loadClassGoal();
    expect(calls).toHaveLength(2);
  });

  it('nothing is asked for a student with no class, and { on: false } is kept as it is', async () => {
    useApp.setState({ profile: { role: 'student', name: 'נועה', grade: '7' } });
    stubFetch(() => ({ body: GOAL }));
    expect(await loadClassGoal()).toBeNull();
    expect(calls).toHaveLength(0);
    useApp.setState({ profile: inClass });
    stubFetch((url) => (url === '/api/class/goal' ? { body: { on: false } } : { body: {} }));
    expect(await loadClassGoal({ force: true })).toEqual({ on: false });
    expect(useApp.getState().classGoals).toEqual({});
  });

  it('dayOfWeek counts from the Sunday', () => {
    expect(dayOfWeek('2026-11-01', '2026-11-01')).toBe(0);
    expect(dayOfWeek('2026-11-01', '2026-11-03')).toBe(2);
    expect(dayOfWeek('2026-11-01', '2026-11-07')).toBe(6);
  });
});
