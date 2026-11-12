// The class goal of the week (STUDENT-4), end to end against a fake server (page.route: no Worker). A class student
// sees, on Quests above today's missions, the class total and their own share, and never a classmate's name; the
// moment for a reached goal comes once and never after a reload; a goal the teacher turned off and a student with no
// class show no card at all; the steps waiting on the device go with the next sync; the teacher turns the goal on or
// off and sets its size on the class settings page (TEACHER-9 §1.8, FOLLOWUP-43), and sees the total in the board's
// header. The moment's maths burst (PKG-3) plays only with motion and with the app's sounds on (a class student starts
// with them off, "quiet for class", and then no burst flies and its chunk is not loaded), from the sheet's hero, and
// goes with the sheet.
// CLASS_GOAL_SHOTS=<folder> saves screenshots for a look (nothing is compared); PKG_SHOTS=<folder> the burst mid-way.
import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { NOW, student, expectUsable } from './helpers.js';

const API = 'https://api.madregot.test';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
// NOW is Thursday 5 Nov 2026: the week started on Sunday 1 Nov
const WEEK = '2026-11-01';
const LAST = '2026-10-25';
const goal = (over = {}) => ({ on: true, week: WEEK, target: 60, have: 23, mine: 4, reached: false, last: { week: LAST, target: 55, have: 61, reached: true, mine: 7 }, ...over });
// classmates the teacher's board knows; a student's screen must never show one
const CLASSMATES = ['יואב', 'דנה', 'עומר'];

/** A fake Worker: the class goal, the progress sync, the tutor's status and the teacher's board. */
async function fakeServer(page, over = {}) {
  const st = {
    goal: goal(), settings: { on: true, target: null }, teacherWeek: { target: 60, have: 23, reached: false },
    students: CLASSMATES.map((name, i) => ({ id: `s${i}`, name })), ...over,
  };
  const log = [];
  const teacherGoal = () => (st.settings.on
    ? { on: true, week: WEEK, ...st.teacherWeek, custom: st.settings.target }
    : { on: false, week: WEEK, target: null, have: st.teacherWeek.have, reached: false, custom: st.settings.target });
  await page.route(`${API}/**`, async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const path = new URL(req.url()).pathname; const h = req.headers();
    // a reach count (lib/metrics.js) is a beacon with a plain name, answered 204 as the Worker does
    if (path === '/api/metrics') { log.push({ path, method: req.method(), body: req.postData(), headers: h }); return route.fulfill({ status: 204, headers: CORS }); }
    const body = req.postData() ? JSON.parse(req.postData()) : {};
    log.push({ path, method: req.method(), body, headers: h });
    const reply = (code, data) => route.fulfill({ status: code, contentType: 'application/json', headers: CORS, body: JSON.stringify(data) });
    if (path === '/api/class/goal') return h.authorization === 'Bearer stu_token_1' ? reply(200, st.goal) : reply(401, { error: 'not_signed_in' });
    if (path === '/api/progress') return reply(200, { saved: (body.events || []).length, steps: (body.steps || []).length });
    if (path === '/api/ai/status') return reply(200, { paywall: false, tier: 'open', kinds: ['explain', 'chat', 'generate', 'check', 'exam'], groups: { all: { left: 40, limit: 40 } }, aiReady: true });
    if (path.startsWith('/api/teacher/')) {
      if (h['x-class-code'] !== 'K7Q2MD' || h['x-teacher-key'] !== 'tkey-123') return reply(401, { error: 'not_teacher' });
      if (path === '/api/teacher/dashboard') {
        return reply(200, {
          class: { code: 'K7Q2MD', name: 'ז׳3', grade: '7', teacherName: 'רונית' }, today: '2026-11-05', joinLocked: false, help: [], mistakes: [], exams: [],
          goal: teacherGoal(),
          students: st.students.map((s) => ({ ...s, lastSeen: '2026-11-05T08:00:00Z', lastPractice: '2026-11-05T08:00:00Z', pinReset: false, today: { n: 3, ok: 3, first: 2, minutes: 4 }, week: { n: 10, first: 8, days: 2, minutes: 20 }, levels: {} })),
        });
      }
      if (path === '/api/teacher/class/goal') {
        st.settings = { on: body.on, target: body.target };
        return reply(200, { goal: teacherGoal() });
      }
    }
    return reply(404, { error: 'not_found' });
  });
  return { st, log };
}

/** Open a route on a device with a saved state, seeded before the app starts (as subscription.spec.js does). */
let seeds = 0;
async function open(page, route, state, { at = NOW } = {}) {
  await page.clock.setFixedTime(at);
  await page.goto('about:blank');
  seeds += 1;
  const key = `seeded-${seeds}-${Date.now()}`;
  await page.addInitScript(([s, k]) => {
    if (location.protocol === 'about:' || sessionStorage.getItem(k)) return;
    sessionStorage.setItem(k, '1');
    localStorage.clear();
    localStorage.setItem('madregot-debug', '1');
    localStorage.setItem('madregot-seed', '424242');
    if (s) localStorage.setItem('madregot', JSON.stringify(s));
  }, [state, key]);
  await page.goto(`./${route}`);
  await page.evaluate(() => document.fonts.ready);
}
const saved = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('madregot')).state);
const withServer = (extra = {}) => ({ ...student('7', { ai: { mode: 'server', apiUrl: API, key: '', device: '' }, ...extra }), version: 3 });
// last week's goal (reached, with this student's part) had its moment already, unless a test says otherwise
const SEEN_LAST = { repairDismissed: null, pbWeek: null, goalSeen: { [LAST]: '2026-10-29' } };
const classStudent = (extra = {}) => withServer({ profile: { role: 'student', name: 'נועה', grade: '7', know: 1, classCode: 'K7Q2MD', className: 'ז׳3', token: 'stu_token_1', studentId: 's9' }, nudges: SEEN_LAST, ...extra });
const teacher = () => withServer({ profile: { role: 'teacher', name: 'רונית', classes: [{ code: 'K7Q2MD', key: 'tkey-123', className: 'ז׳3', grade: '7' }], active: 'K7Q2MD' } });
const goalCalls = (log) => log.filter((r) => r.path === '/api/class/goal');

async function burstShots(page, name) {
  const dir = process.env.PKG_SHOTS; if (!dir) return;
  mkdirSync(dir, { recursive: true });
  await page.waitForTimeout(350); // mid-burst: the symbols are up and spreading
  await page.screenshot({ path: `${dir}/${name}-390x844.png` });
  await page.setViewportSize({ width: 320, height: 568 });
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${dir}/${name}-320x568.png` });
  await page.setViewportSize({ width: 390, height: 844 });
}

async function shot(page, name) {
  const dir = process.env.CLASS_GOAL_SHOTS; if (!dir) return;
  mkdirSync(dir, { recursive: true });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${dir}/${test.info().project.name}-${name}.png`, fullPage: false });
}

test.describe('the class goal of the week', () => {
  test.skip(({ viewport }) => viewport.width > 800, 'phone layouts');

  test('on Quests, above today\'s missions: the class total and the student\'s own share, and no classmate\'s name', async ({ page }) => {
    const { log } = await fakeServer(page);
    await open(page, '#/quests', classStudent());
    const card = page.getByRole('region', { name: 'מטרת הכיתה השבוע' });
    await expect(card).toContainText('23 מתוך 60 צעדים');
    await expect(card).toContainText('החלק שלכם השבוע: 4 צעדים');
    await expect(card).toContainText('כל שיעור, שלב לימוד או בדיקה הוא צעד. בדיקת שליטה שעברתם שווה 3 צעדים.');
    await expect(card.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '23');
    await expect(card.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '60');
    // Thursday: last week's line shows only Sunday to Tuesday
    await expect(card).not.toContainText('בשבוע שעבר');
    const missions = page.getByRole('heading', { name: 'המשימות של היום' });
    expect((await card.boundingBox()).y).toBeLessThan((await missions.boundingBox()).y);
    const text = await page.locator('body').innerText();
    for (const name of CLASSMATES) expect(text).not.toContain(name);
    expect(text).not.toMatch(/דירוג|מקום ה|ליגה/);
    // nothing about the classroom or the school day: the goal is reached by practice at home
    expect(await card.innerText()).not.toMatch(/בבית הספר|בשיעור במחלקה|בהפסקה/);
    expect(goalCalls(log).length).toBeGreaterThan(0);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await card.scrollIntoViewIfNeeded();
    await shot(page, 'card-mid');
  });

  test('Sunday to Tuesday, last week\'s result shows; a new week with no steps yet says so', async ({ page }) => {
    await fakeServer(page, { goal: goal({ have: 0, mine: 0 }) });
    await open(page, '#/quests', classStudent(), { at: new Date('2026-11-03T10:00:00') });
    const card = page.getByRole('region', { name: 'מטרת הכיתה השבוע' });
    await expect(card).toContainText('שבוע חדש. המטרה: 60 צעדים, כולם יחד.');
    await expect(card).toContainText('בשבוע שעבר: 61 מתוך 55. הגעתם למטרה.');
    await expect(card).not.toContainText('עוד לא הוספתם');
    await card.scrollIntoViewIfNeeded();
    await shot(page, 'card-new-week');
  });

  test('reached with the student\'s part: the moment once, never again after a reload, and Madi gets the class scarf', async ({ page }) => {
    await fakeServer(page, { goal: goal({ have: 64, mine: 9, reached: true, last: null }) });
    await open(page, '#/', classStudent());
    const sheet = page.getByRole('dialog', { name: 'עשינו את זה יחד' });
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText('הכיתה שלכם עברה את המטרה של השבוע, ואתם הוספתם 9 צעדים. מדי קיבל צעיף כיתה.');
    await expect(sheet.getByRole('button', { name: 'לראות את מדי' })).toBeVisible();
    await shot(page, 'moment');
    await page.waitForTimeout(400);
    await expect(page.locator('canvas.math-burst')).toHaveCount(0); // reduced motion (the config's default): no burst
    let st = await saved(page);
    expect(st.nudges.goalSeen[WEEK]).toBe('2026-11-05');
    expect(st.look.earned).toContain('class-scarf');
    expect(st.look.seen).toContain('class-scarf');
    expect(st.classGoals[WEEK]).toEqual({ target: 60, have: 64, mine: 9, reached: true });
    await sheet.getByRole('button', { name: 'סגירה' }).click();
    await expect(sheet).toHaveCount(0);
    // after a reload, on the home screen and on Quests: the card says it, the moment does not come again
    await page.reload();
    await expect.poll(() => page.evaluate(() => document.querySelector('.learn') !== null)).toBe(true);
    await page.waitForTimeout(400);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.goto('./#/quests');
    await page.reload();
    const card = page.getByRole('region', { name: 'מטרת הכיתה השבוע' });
    await expect(card).toContainText('הכיתה הגיעה למטרה! מדי קיבל צעיף כיתה.');
    await expect(card).toContainText('החלק שלכם השבוע: 9 צעדים');
    await page.waitForTimeout(400);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    st = await saved(page);
    expect(st.nudges.goalSeen).toEqual({ [LAST]: '2026-10-29', [WEEK]: '2026-11-05' }); // still the first time it was shown

  });

  test('a reached week the student already celebrated: the card says so, Madi is happy, and there is no moment', async ({ page }) => {
    await fakeServer(page, { goal: goal({ have: 64, mine: 9, reached: true, last: null }) });
    await open(page, '#/quests', classStudent({ nudges: { ...SEEN_LAST, goalSeen: { ...SEEN_LAST.goalSeen, [WEEK]: '2026-11-04' } } }));
    const card = page.getByRole('region', { name: 'מטרת הכיתה השבוע' });
    await expect(card).toContainText('64 מתוך 60 צעדים');
    await expect(card).toContainText('הכיתה הגיעה למטרה! מדי קיבל צעיף כיתה.');
    await expect(card).toContainText('החלק שלכם השבוע: 9 צעדים');
    await expect(card.locator('.cg-madi')).toBeVisible();
    await page.waitForTimeout(400);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    // the picture comes from a first start: after a reload the test clock holds the page's fade-in part-way
    await card.scrollIntoViewIfNeeded();
    await shot(page, 'card-reached');
  });

  test('a goal reached last week that the student has not seen yet: its moment comes in the new week', async ({ page }) => {
    await fakeServer(page);
    await open(page, '#/quests', classStudent({ nudges: { repairDismissed: null, pbWeek: null } }));
    const sheet = page.getByRole('dialog', { name: 'עשינו את זה יחד' });
    await expect(sheet).toContainText('הכיתה שלכם עברה את המטרה של השבוע שעבר, ואתם הוספתם 7 צעדים. מדי קיבל צעיף כיתה.');
    await sheet.getByRole('button', { name: 'סגירה' }).click();
    await expect(page.getByRole('region', { name: 'מטרת הכיתה השבוע' })).toContainText('23 מתוך 60 צעדים');
    const st = await saved(page);
    expect(st.nudges.goalSeen).toEqual({ [LAST]: '2026-11-05' });
    expect(st.classGoals[LAST]).toEqual({ target: 55, have: 61, mine: 7, reached: true });
  });

  test.describe('with motion: the maths burst (PKG-3)', () => {
    test.use({ reducedMotion: 'no-preference' });
    const burst = (page) => page.locator('canvas.math-burst');
    // the student chose sounds (prefs.soundSet): the app is not in its quiet mode
    const withSounds = () => classStudent({ sound: true, prefs: { theme: 'system', soundSet: true } });

    test('plays from the sheet\'s hero as it opens, takes no tap, ends by itself, and does not come back', async ({ page }) => {
      await fakeServer(page, { goal: goal({ have: 64, mine: 9, reached: true, last: null }) });
      await open(page, '#/', withSounds());
      const sheet = page.getByRole('dialog', { name: 'עשינו את זה יחד' });
      await expect(sheet).toBeVisible();
      await expect(burst(page)).toHaveCount(1);
      await expect(burst(page)).toHaveAttribute('aria-hidden', 'true');
      // over the sheet, yet the sheet's buttons are what a tap meets
      expect(await burst(page).evaluate((el) => [getComputedStyle(el).pointerEvents, Number(getComputedStyle(el).zIndex) > Number(getComputedStyle(document.querySelector('.sheet')).zIndex)])).toEqual(['none', true]);
      await expectUsable(page, sheet.getByRole('button', { name: 'לראות את מדי' }), 'לראות את מדי');
      await expectUsable(page, sheet.getByRole('button', { name: 'סגירה' }), 'סגירה');
      await burstShots(page, 'class-goal');
      // the symbols fall in under 3 seconds and the canvas goes, while the sheet stays
      await expect.poll(() => burst(page).count(), { timeout: 8000 }).toBe(0);
      await expect(sheet).toBeVisible();
      await sheet.getByRole('button', { name: 'סגירה' }).click();
      // once a week: after a reload, no sheet and no burst
      await page.reload();
      await expect.poll(() => page.evaluate(() => document.querySelector('.learn') !== null)).toBe(true);
      await page.waitForTimeout(600);
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(burst(page)).toHaveCount(0);
    });

    test('quiet for class: with the sounds off (a class student\'s start), no burst plays and none is loaded', async ({ page }) => {
      const asked = [];
      page.on('request', (r) => { if (/confetti\.module/.test(r.url())) asked.push(r.url()); });
      await fakeServer(page, { goal: goal({ have: 64, mine: 9, reached: true, last: null }) });
      await open(page, '#/', classStudent()); // student() keeps sound: false, as quietForClass leaves a class student
      const sheet = page.getByRole('dialog', { name: 'עשינו את זה יחד' });
      await expect(sheet).toBeVisible();
      await page.waitForTimeout(800);
      await expect(burst(page)).toHaveCount(0);
      expect(asked).toEqual([]);
      expect((await saved(page)).sound).toBe(false);
    });

    test('closing the sheet during the burst removes its canvas at once', async ({ page }) => {
      await fakeServer(page, { goal: goal({ have: 64, mine: 9, reached: true, last: null }) });
      await open(page, '#/quests', withSounds());
      const sheet = page.getByRole('dialog', { name: 'עשינו את זה יחד' });
      await expect(burst(page)).toHaveCount(1);
      await sheet.getByRole('button', { name: 'סגירה' }).click();
      await expect(burst(page)).toHaveCount(0, { timeout: 600 });
      await expect(sheet).toHaveCount(0);
    });
  });

  test('the moment\'s button opens the wardrobe with the class scarf on Madi', async ({ page }) => {
    const { log } = await fakeServer(page, { goal: goal({ have: 64, mine: 1, reached: true, last: null }) });
    await open(page, '#/quests', classStudent());
    const sheet = page.getByRole('dialog', { name: 'עשינו את זה יחד' });
    await expect(sheet).toContainText('ואתם הוספתם צעד אחד.');
    await sheet.getByRole('button', { name: 'לראות את מדי' }).click();
    await expect(page).toHaveURL(/#\/me\/madi/);
    await expect(page.getByRole('radio', { name: /צעיף הכיתה/ })).toBeChecked();
    expect((await saved(page)).look.neck).toBe('class-scarf');
    // opening the wardrobe is counted by name only (STUDENT-14): a plain-text beacon, no token, no id
    await expect.poll(() => log.filter((l) => l.path === '/api/metrics').map((l) => l.body)).toEqual(['wardrobe_open']);
    expect(log.find((l) => l.path === '/api/metrics').headers.authorization).toBeUndefined();
  });

  test('reached without the student\'s part: a calm line, no moment and no scarf', async ({ page }) => {
    await fakeServer(page, { goal: goal({ have: 64, mine: 0, reached: true, last: null }) });
    await open(page, '#/quests', classStudent());
    const card = page.getByRole('region', { name: 'מטרת הכיתה השבוע' });
    await expect(card).toContainText('הכיתה הגיעה למטרה של השבוע. בשבוע הבא כל צעד שלכם נספר, ומי שמוסיף צעד מקבל צעיף כיתה למדי.');
    await expect(card).not.toContainText('עוד לא הוספתם');
    await page.waitForTimeout(400);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect((await saved(page)).look.earned || []).not.toContain('class-scarf');
    await card.scrollIntoViewIfNeeded();
    await shot(page, 'card-reached-not-mine');
  });

  test('a goal the teacher turned off shows no card; a student with no class shows none and asks nothing', async ({ page }) => {
    const { log } = await fakeServer(page, { goal: { on: false } });
    await open(page, '#/quests', classStudent());
    await expect.poll(() => goalCalls(log).length).toBeGreaterThan(0);
    await page.waitForTimeout(300);
    await expect(page.getByText('מטרת הכיתה השבוע')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'המשימות של היום' })).toBeVisible();

    const solo = await fakeServer(page);
    await open(page, '#/quests', withServer({ profile: { role: 'student', name: 'נועה', grade: '7', know: 1 } }));
    await expect(page.getByRole('heading', { name: 'המשימות של היום' })).toBeVisible();
    await page.waitForTimeout(400);
    await expect(page.getByText('מטרת הכיתה השבוע')).toHaveCount(0);
    expect(goalCalls(solo.log)).toHaveLength(0);
  });

  test('steps waiting on the device go with the next sync, before the goal is asked', async ({ page }) => {
    const { log } = await fakeServer(page);
    const waiting = [
      { sid: '11111111-1111-4111-8111-111111111111', at: '2026-11-05T07:00:00.000Z', pts: 1 },
      { sid: '22222222-2222-4222-8222-222222222222', at: '2026-11-05T07:05:00.000Z', pts: 3 },
    ];
    await open(page, '#/quests', classStudent({ stepsOut: waiting }));
    await expect(page.getByRole('region', { name: 'מטרת הכיתה השבוע' })).toBeVisible();
    const post = log.find((r) => r.path === '/api/progress' && (r.body.steps || []).length);
    expect(post.body.steps).toEqual(waiting);
    expect(post.headers.authorization).toBe('Bearer stu_token_1');
    expect(log.indexOf(post)).toBeLessThan(log.findIndex((r) => r.path === '/api/class/goal'));
    await expect.poll(async () => (await saved(page)).stepsOut).toEqual([]);
  });

  test('the teacher: the total in the header, the goal on or off and its size on the class settings page, from next week', async ({ page }) => {
    const { log } = await fakeServer(page);
    const chip = page.locator('.t-goal-chip');
    const block = page.getByRole('region', { name: 'מטרת כיתה שבועית' });
    // the board: the class total in the header; the block is no longer on the students' view (one copy, on the settings)
    await open(page, '#/teacher?tab=students', teacher());
    await expect(chip).toHaveText('מטרת הכיתה: 23/60');
    await expect(page.getByRole('tab', { name: 'תלמידים' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('region', { name: 'טבלת התלמידים' })).toBeVisible();
    await expect(block).toHaveCount(0);
    // the settings, from the board's tools: the block after the daily email and before how long data is kept
    await page.getByRole('navigation', { name: 'כלים' }).getByRole('link', { name: 'הגדרות הכיתה' }).click();
    await expect(page.getByRole('heading', { name: 'הגדרות הכיתה ז׳3' })).toBeVisible();
    await expect(block).toBeVisible();
    await expect(block).toHaveCount(1);
    // (this fake board has no AI policy, no licence and no daily email: those sections are not drawn)
    expect(await page.locator('.t-settings h2').allTextContents()).toEqual(['הכיתה', 'הכניסה לכיתה', 'שמירת ההתקדמות', 'מטרת כיתה שבועית', 'כמה זמן נשמר המידע', 'סוף שנת הלימודים']);
    await expect(block.getByRole('radio', { name: 'פועלת' })).toBeChecked();
    const size = block.getByLabel('גודל המטרה (צעדים בשבוע)');
    await expect(size).toHaveAttribute('placeholder', 'אוטומטי');
    await expect(size).toHaveValue('');
    await expect(block).toContainText('התלמידים רואים רק את הסכום של כל הכיתה ואת החלק של עצמם. אין דירוג ואין שמות. בלי מספר, המטרה היא 4 צעדים לכל תלמיד פעיל.');
    for (const el of [block.getByRole('radio', { name: 'פועלת' }), size, block.getByRole('button', { name: 'שמירה' })]) {
      expect((await el.boundingBox()).height).toBeGreaterThanOrEqual(44);
    }
    await block.scrollIntoViewIfNeeded();
    await shot(page, 'teacher-block');
    // a size out of range is explained, and nothing is sent
    await size.fill('5');
    await block.getByRole('button', { name: 'שמירה' }).click();
    await expect(block.getByRole('alert')).toContainText('מספר שלם בין 10 ל־400');
    expect(log.filter((r) => r.path === '/api/teacher/class/goal')).toHaveLength(0);
    await size.fill('50');
    await block.getByRole('button', { name: 'שמירה' }).click();
    await expect(page.getByText('נשמר. הגודל החדש ייכנס לתוקף בשבוע הבא.')).toBeVisible();
    expect(log.filter((r) => r.path === '/api/teacher/class/goal').at(-1).body).toEqual({ on: true, target: 50 });
    // off, from the keyboard: the arrows move between the two options
    await block.getByRole('radio', { name: 'פועלת' }).focus();
    await page.keyboard.press('ArrowLeft');
    await expect(block.getByRole('radio', { name: 'כבויה' })).toBeChecked();
    await expect(block.getByRole('radio', { name: 'כבויה' })).toBeFocused();
    await expect.poll(() => log.filter((r) => r.path === '/api/teacher/class/goal').at(-1).body).toEqual({ on: false, target: 50 });
    await expect(size).toHaveCount(0);
    await shot(page, 'teacher-block-off');
    // the board's header follows: no chip while the goal is off
    await page.getByRole('button', { name: 'חזרה ללוח' }).click();
    await expect(page.getByText('תרגלו היום')).toBeVisible();
    await expect(chip).toHaveCount(0);
    // and on again with a click, the size kept
    await page.getByRole('navigation', { name: 'כלים' }).getByRole('link', { name: 'הגדרות הכיתה' }).click();
    await block.getByRole('radio', { name: 'פועלת' }).click();
    await expect(size).toHaveValue('50');
    await expect.poll(() => log.filter((r) => r.path === '/api/teacher/class/goal').at(-1).body).toEqual({ on: true, target: 50 });
    await page.getByRole('button', { name: 'חזרה ללוח' }).click();
    await expect(chip).toHaveText('מטרת הכיתה: 23/60');
  });
});
