// A class student's answers survive having no network (DURABLE-7): they wait on the device, the page can be closed,
// and when it opens again online the class server gets every answer exactly once, even when a reply is lost on the way.
import { test, expect } from '@playwright/test';
import { NOW, student, open, item, answer, proceedToNext, leaveEndScreens, saved } from './helpers.js';
import { API, fakeServer } from './fakeServer.js';

const baseOf = () => test.info().project.use.baseURL || 'http://127.0.0.1:4173/';
// seeded as a v3 save, as subscription.spec.js does, so the saved server address is kept
const classStudent = () => ({
  ...student('7', {
    ai: { mode: 'server', apiUrl: API, key: '', device: '' },
    profile: { role: 'student', name: 'נועה', grade: '7', know: 1, classCode: 'K7Q2MD', className: 'ז׳3', token: 'stu_token_1', studentId: 's1' },
    lastTopic: 'signed',
  }),
  version: 3,
});
const progressPosts = (log) => log.filter((r) => r.path === '/api/progress');

/**
 * No network for the whole device. context.setOffline blocks real requests, but a page.route handler would still answer,
 * so the fake server's address fails too while offline (a route added last runs first).
 */
async function network(context) {
  let offline = false;
  await context.route(`${API}/**`, (route) => (offline ? route.abort('internetdisconnected') : route.fallback()));
  return async (on) => { offline = !on; await context.setOffline(!on); };
}
const outboxIds = async (page) => (await saved(page)).outbox.map((e) => e.id);

/** Finish one practice lesson of the first stair with right answers, then go back to the map (all inside the app). */
async function lesson(page) {
  await page.evaluate(() => { window.location.hash = '#/lesson/signed/1'; });
  await expect.poll(() => item(page)).toBeTruthy();
  for (let n = 0; n < 20 && !(await page.locator('.done-screen').count()); n += 1) {
    await proceedToNext(page, await answer(page, true));
    if (await page.locator('.combo-pop').count()) await page.locator('.combo-pop').click();
  }
  await expect(page.locator('.done-screen')).toBeVisible();
  await leaveEndScreens(page);
  await expect(page.locator('.learn')).toBeVisible();
}

test.describe('class progress sync', () => {
  test.skip(({ viewport }) => viewport.width > 800, 'phone layouts');

  test('offline for three lessons, the page closed, opened again online: every answer reaches the class once', async ({ page }) => {
    const context = page.context();
    const { st, log } = await fakeServer(context, {}, baseOf());
    const online = await network(context);
    const signedLoaded = new Promise((done) => { page.on('response', (r) => { if (/\/signed-[\w-]+\.js$/.test(r.url()) && r.ok()) done(); }); });
    await open(page, '#/', classStudent());
    await expect(page.locator('.learn')).toBeVisible();
    // opening the app sends the levels (nothing is waiting yet)
    await expect.poll(() => progressPosts(log).length).toBeGreaterThan(0);
    expect(progressPosts(log).every((r) => r.body.events.length === 0)).toBe(true);
    // the teaching content loads one topic at a time (DURABLE-11): the topic worked on last loads once the app is idle.
    // These tests block the service worker (which would keep every topic), so that is what the offline lessons ask from
    await signedLoaded;

    await online(false);
    const sentOnline = progressPosts(log).length;
    for (let k = 0; k < 3; k += 1) await lesson(page);
    const ids = await outboxIds(page);
    const days = (await saved(page)).days['2026-11-05'];
    expect(days.lessons).toBe(3);
    expect(ids.length).toBe(days.q); // every answer of the three lessons waits, none was dropped
    expect(ids.length).toBeGreaterThanOrEqual(15);
    expect(ids.every((id) => /^[a-f0-9]{12}$/.test(id))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    expect(st.answers).toHaveLength(0); // no network: nothing reached the server
    expect(progressPosts(log)).toHaveLength(sentOnline);

    await page.close(); // closed while offline: the hidden moment's send fails, and nothing is lost
    st.loseProgressReplies = 1; // the first reply after this is lost on its way back
    await online(true);
    const again = await context.newPage();
    await again.clock.setFixedTime(NOW);
    await again.goto('./#/');
    await expect(again.locator('.learn')).toBeVisible();
    // the first send is stored but its reply is lost; the next moment (3 s after opening) sends the same answers again
    await expect.poll(() => outboxIds(again), { timeout: 15_000 }).toEqual([]);
    expect(st.loseProgressReplies).toBe(0);
    expect(st.answers.map((e) => e.id).sort()).toEqual([...ids].sort());
    const sentIds = progressPosts(log).flatMap((r) => r.body.events.map((e) => e.id));
    expect(sentIds.length).toBeGreaterThan(ids.length); // some were sent twice ...
    expect(new Set(st.answers.map((e) => e.id)).size).toBe(ids.length); // ... and kept once
    // only what the server stores went over the network
    const fields = new Set(st.answers.flatMap((e) => Object.keys(e)));
    expect([...fields].every((f) => ['id', 'topic', 'level', 'ok', 'first', 'hint', 'cat', 'secs', 'at'].includes(f))).toBe(true);
    // every send carried the class token (the server is on another address, so none used keepalive: see sync.test.js)
    expect(progressPosts(log).every((r) => r.headers.authorization === 'Bearer stu_token_1')).toBe(true);
  });
});
