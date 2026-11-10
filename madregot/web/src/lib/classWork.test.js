// Class work on the student's device (lib/classWork.js): the list from the server is kept; reports wait in workOutbox
// until the server confirms them (deleted on 200, kept on a lost connection, dropped on 404); a stair's stage is
// reported only when it adds something; leaving the class or signing out clears it all. Synthetic data only.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

function fakeStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k),
    clear: () => m.clear(), key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; },
  };
}
const API = 'https://madregot.example.test';
const ID = 'a000000000000001';
let calls; let answer;
const json = (data, status = 200) => new Response(JSON.stringify(data), { status });
const assignment = (over = {}) => ({ id: ID, kind: 'stair', skill: 'signed:1', title: 'מספרים מכוונים: חיבור וחיסור', note: '', startsOn: '2026-11-05', dueOn: '2026-11-12', createdAt: '2026-11-05T08:00:00.000Z', hasExam: false, examCount: null, mine: null, ...over });

beforeEach(() => {
  calls = []; answer = () => json({});
  vi.stubGlobal('localStorage', fakeStorage());
  vi.stubGlobal('sessionStorage', fakeStorage());
  vi.stubGlobal('fetch', vi.fn(async (url, init = {}) => {
    const call = { path: String(url).replace(API, ''), method: init.method || 'GET', headers: init.headers || {}, body: init.body ? JSON.parse(init.body) : null };
    calls.push(call);
    return answer(call);
  }));
});
afterEach(() => { vi.unstubAllGlobals(); });

async function load({ token = 'stok-a1' } = {}) {
  vi.resetModules();
  const { useApp } = await import('./store.js');
  useApp.getState().setAI({ apiUrl: API });
  useApp.getState().setProfile({ role: 'student', name: 'דנה', grade: '7', classCode: 'K7Q2MD', className: 'ז׳3', teacherName: 'רונית', ...(token ? { token, studentId: 'a1' } : {}) });
  return { useApp, cw: await import('./classWork.js') };
}

describe('fetchClassWork', () => {
  it('keeps the list, the teacher\'s name and the server\'s day', async () => {
    const { useApp, cw } = await load();
    answer = () => json({ today: '2026-11-05', teacherName: 'רונית', assignments: [assignment()], help: [] });
    await cw.fetchClassWork({ force: true });
    expect(calls[0]).toMatchObject({ path: '/api/class/work', method: 'GET', headers: { Authorization: 'Bearer stok-a1' } });
    const w = useApp.getState().classWork;
    expect(w).toMatchObject({ today: '2026-11-05', teacherName: 'רונית', assignments: [assignment()] });
    expect(w.at).toBeTruthy();
    // within five minutes it does not ask again, unless forced
    await cw.fetchClassWork();
    expect(calls).toHaveLength(1);
  });
  it('without a class token nothing is asked', async () => {
    const { cw } = await load({ token: null });
    await cw.fetchClassWork({ force: true });
    expect(calls).toHaveLength(0);
  });
});

describe('reportWork and flushWork', () => {
  it('a report is posted and, on 200, leaves the outbox; the server\'s copy is kept', async () => {
    const { useApp, cw } = await load();
    useApp.setState({ classWork: { ...useApp.getState().classWork, assignments: [assignment()] } });
    answer = () => json({ mine: { state: 'started', stage: 1, right: null, asked: null, passed: false, doneAt: null } });
    await cw.reportWork(ID, { state: 'started', stage: 1, passed: false });
    expect(calls).toEqual([expect.objectContaining({ path: `/api/class/work/${ID}`, method: 'POST', body: { state: 'started', stage: 1, passed: false } })]);
    expect(useApp.getState().workOutbox).toEqual({});
    expect(useApp.getState().classWork.assignments[0].mine).toMatchObject({ state: 'started', stage: 1 });
  });
  it('a lost connection keeps the report; the next flush sends it once', async () => {
    const { useApp, cw } = await load();
    answer = () => { throw new TypeError('Failed to fetch'); };
    await cw.reportWork(ID, { state: 'started', stage: 1, passed: false });
    await cw.reportWork(ID, { state: 'started', stage: 2, passed: false });
    expect(useApp.getState().workOutbox[ID]).toEqual({ state: 'started', stage: 2, passed: false });
    answer = () => json({ mine: { state: 'started', stage: 2 } });
    calls = [];
    await cw.flushWork();
    expect(calls).toHaveLength(1);
    expect(calls[0].body).toEqual({ state: 'started', stage: 2, passed: false });
    expect(useApp.getState().workOutbox).toEqual({});
  });
  it('404 (the teacher deleted it) drops the report; the device time of a done report is not sent', async () => {
    const { useApp, cw } = await load();
    answer = () => json({ error: 'not_found' }, 404);
    await cw.reportWork(ID, { state: 'done', right: 4, asked: 5, passed: true });
    expect(calls[0].body).toEqual({ state: 'done', right: 4, asked: 5, passed: true });
    expect(useApp.getState().workOutbox).toEqual({});
  });
  it('without a class token nothing is kept or sent', async () => {
    const { useApp, cw } = await load({ token: null });
    await cw.reportWork(ID, { state: 'started' });
    expect(calls).toHaveLength(0);
    expect(useApp.getState().workOutbox).toEqual({});
  });
});

describe('reportStairs', () => {
  it('reports a stair\'s stage once, and only what adds to what the server has', async () => {
    const { useApp, cw } = await load();
    const L = useApp.getState().learn;
    useApp.setState({
      classWork: { ...useApp.getState().classWork, assignments: [assignment(), assignment({ id: 'a000000000000002', kind: 'check' })] },
      learn: { ...L, skills: { 'signed:1': { attempts: [], taught: { A: '2026-11-05T09:00:00.000Z' } } } },
    });
    answer = () => json({ mine: { state: 'started', stage: 1, passed: false } });
    await cw.reportStairs();
    expect(calls.map((c) => [c.path, c.body])).toEqual([[`/api/class/work/${ID}`, { state: 'started', stage: 1, passed: false }]]);
    calls = [];
    await cw.reportStairs();
    expect(calls).toHaveLength(0);
  });
});

describe('leaving the class', () => {
  it('clears the class work and the waiting reports', async () => {
    const { useApp, cw } = await load();
    answer = () => { throw new TypeError('Failed to fetch'); };
    await cw.reportWork(ID, { state: 'started' });
    useApp.setState({ classWork: { ...useApp.getState().classWork, teacherName: 'רונית', assignments: [assignment()] } });
    useApp.getState().leaveClass();
    expect(useApp.getState().classWork.assignments).toEqual([]);
    expect(useApp.getState().workOutbox).toEqual({});
  });
});

describe('what the student sees', () => {
  const day = '2026-11-09';
  const row = (over) => assignment({ createdAt: '2026-11-09T07:00:00.000Z', ...over });
  it('the due day in calm words, never "late"', async () => {
    const { cw } = await load();
    expect(cw.dueLine('2026-11-09', day)).toBe('להיום');
    expect(cw.dueLine('2026-11-10', day)).toBe('עד מחר');
    expect(cw.dueLine('2026-11-12', day)).toBe('עד יום חמישי, 12.11');
    expect(cw.dueLine('2026-11-06', day)).toBe('המועד עבר, ועדיין אפשר להשלים');
    expect(cw.workBanner('2026-11-12', day)).toBe('משימה מהמורה, עד יום חמישי, 12.11');
    expect(cw.workBanner('2026-11-06', day)).toBe('משימה מהמורה. המועד עבר, ועדיין אפשר להשלים');
  });
  it('rows: due within 3 days or past by up to 14 and not done; later ones folded; done ones only on their day', async () => {
    const { cw } = await load();
    const list = [
      row({ id: 'a1', dueOn: '2026-11-12' }),
      row({ id: 'a2', kind: 'check', skill: 'signed:2', dueOn: '2026-11-06' }),
      row({ id: 'a3', dueOn: '2026-11-20' }),
      row({ id: 'a4', dueOn: '2026-10-20' }), // past by 20 days: not shown
      row({ id: 'a5', dueOn: '2026-11-10', mine: { state: 'done', stage: 5, passed: true, doneAt: '2026-11-09T09:00:00' } }),
      row({ id: 'a6', dueOn: '2026-11-10', mine: { state: 'done', stage: 5, passed: true, doneAt: '2026-11-08T09:00:00' } }),
      row({ id: 'a7', kind: 'exam', skill: null, dueOn: '2026-11-10' }), // the class exam comes with its own screens
    ];
    const r = cw.classRows({ assignments: list }, {}, day);
    expect(r.show.map((x) => x.a.id)).toEqual(['a2', 'a1', 'a5']);
    expect(r.later.map((x) => x.a.id)).toEqual(['a3']);
    expect(r.next.a.id).toBe('a2');
    expect(r.show[0].to).toBe('/lesson/signed/2?kind=check&purpose=mastery&assignment=a2');
    expect(r.show[1].to).toBe('/learn/signed/1?assignment=a1');
    // a check is 3 minutes; a stair not started is all five stages (5 + 3 + 4 + 5 + 3)
    expect(r.minutes).toBe(3 + 20);
    expect(r.allDone).toBe(false);
  });
  it('a report waiting on the device counts: a started stair says so, a done one is done', async () => {
    const { cw } = await load();
    const list = [row({ id: 'a1', dueOn: '2026-11-12' })];
    const started = cw.classRows({ assignments: list }, { a1: { state: 'started', stage: 2 } }, day);
    expect(started.next.started).toBe(true);
    expect(started.minutes).toBe(4 + 5 + 3);
    const done = cw.classRows({ assignments: list }, { a1: { state: 'done', stage: 5, passed: true, doneAt: '2026-11-09T09:00:00' } }, day);
    expect(done.next).toBeNull();
    expect(done.allDone).toBe(true);
  });
  it('the dot: work not done that came after the last look at the missions tab', async () => {
    const { cw } = await load();
    const list = [row({ id: 'a1', createdAt: '2026-11-09T07:00:00.000Z' })];
    expect(cw.hasNewWork({ assignments: list, seenAt: null })).toBe(true);
    expect(cw.hasNewWork({ assignments: list, seenAt: '2026-11-09T08:00:00.000Z' })).toBe(false);
    expect(cw.hasNewWork({ assignments: list, seenAt: '2026-11-09T06:00:00.000Z' })).toBe(true);
    expect(cw.hasNewWork({ assignments: list, seenAt: null }, { a1: { state: 'done' } })).toBe(false);
  });
  it('the chip on the home: the most urgent, with its day (none once the date passed)', async () => {
    const { cw } = await load();
    const r = cw.urgentWork({ assignments: [row({ id: 'a1', dueOn: '2026-11-12' }), row({ id: 'a3', dueOn: '2026-11-20' })] }, {}, day);
    expect(cw.urgentText(r)).toBe('משימה מהמורה: מספרים מכוונים: חיבור וחיסור · עד יום חמישי');
    expect(cw.urgentText(cw.urgentWork({ assignments: [row({ id: 'a1', dueOn: '2026-11-09' })] }, {}, day))).toBe('משימה מהמורה: מספרים מכוונים: חיבור וחיסור · להיום');
    expect(cw.urgentText(cw.urgentWork({ assignments: [row({ id: 'a1', dueOn: '2026-11-05' })] }, {}, day))).toBe('משימה מהמורה: מספרים מכוונים: חיבור וחיסור');
    expect(cw.urgentWork({ assignments: [row({ id: 'a3', dueOn: '2026-11-20' })] }, {}, day)).toBeNull();
  });
  it('a mastery check counts for the assignment its address names, else an open check on the same stair', async () => {
    const { useApp, cw } = await load();
    useApp.setState({ classWork: { ...useApp.getState().classWork, assignments: [row({ id: 'a2', kind: 'check', skill: 'signed:2' })] } });
    expect(cw.checkAssignment('signed:2', 'a9')).toBe('a9');
    expect(cw.checkAssignment('signed:2', null)).toBe('a2');
    expect(cw.checkAssignment('signed:1', null)).toBeNull();
  });
});
