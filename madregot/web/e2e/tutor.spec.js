// What the browser tells the tutor (ai spec AI-1, the client side), end to end against the fake server: every AI request
// carries the version-2 context the device builds from the engine. The explain after a second miss names the mistake the
// screen named and may reveal; a chat on an open exercise withholds; the review of a checked exam reveals; the
// assistant's photo check is the student's own question (homework) and carries no exercise of the app's.
import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { NOW, student, item, type, proceed, answer, saved } from './helpers.js';
import { fakeServer, API, livePlan } from './fakeServer.js';

const FAMILY = `fd1.${'c'.repeat(64)}`;
// a device linked to a family plan, so the tutor is open and the lesson asks it by itself after a second miss
const family = (extra = {}) => ({ ...student('7', { ai: { mode: 'server', apiUrl: API, key: '', device: '', introSeen: true, familyDevice: { token: FAMILY, label: 'הטאבלט' } }, ...extra }), version: 3 });
const baseOf = () => test.info().project.use.baseURL || 'http://127.0.0.1:4173/';
// TUTOR_LOG=<folder> keeps each request body checked here, as the evidence of what leaves the device (nothing is compared)
const bodyOf = async (log, path) => {
  await expect.poll(() => log.some((r) => r.path === path), { message: `a request to ${path}` }).toBe(true);
  const body = log.filter((r) => r.path === path).at(-1).body;
  const dir = process.env.TUTOR_LOG;
  if (dir) {
    mkdirSync(dir, { recursive: true });
    const name = `${test.info().title.replace(/[^a-z]+/gi, '-').slice(0, 40)}${path.replace(/\//g, '-')}.json`;
    writeFileSync(`${dir}/${name}`, JSON.stringify({ ...body, image: body.image ? `${body.image.slice(0, 30)}…` : undefined }, null, 1));
  }
  return body;
};

/** Open a route on a seeded device (an init script, so a running app never writes its old state over the new one). */
let seeds = 0;
async function open(page, route, state, seed = '424242') {
  await page.clock.setFixedTime(NOW);
  await page.goto('about:blank');
  seeds += 1;
  const key = `seeded-${seeds}-${Date.now()}`;
  await page.addInitScript(([s, sd, k]) => {
    if (location.protocol === 'about:' || sessionStorage.getItem(k)) return;
    Object.keys(sessionStorage).filter((x) => !x.startsWith('seeded-')).forEach((x) => sessionStorage.removeItem(x));
    sessionStorage.setItem(k, '1');
    localStorage.clear();
    localStorage.setItem('madregot-debug', '1');
    localStorage.setItem('madregot-seed', sd);
    localStorage.setItem('madregot', JSON.stringify(s));
  }, [state, seed, key]);
  await page.goto(`./${route}`);
  await page.evaluate(() => document.fonts.ready);
}

/** Fixed seeds in turn until the lesson's first exercise is the one wanted (the same seed gives the same one each run). */
async function openOn(page, route, state, want) {
  for (let sd = 1; sd <= 120; sd += 1) {
    await open(page, route, state, String(sd));
    await expect.poll(() => item(page)).toBeTruthy();
    const it = await item(page);
    if (want(it)) return it;
  }
  throw new Error(`no seed opens ${route} on the exercise wanted`);
}

const check = (page) => page.getByRole('button', { name: 'בדיקה', exact: true }).click();

test.describe('what the tutor is told', () => {
  test.skip(({ viewport }) => viewport.width > 800, 'phone layouts');

  test('the explain request carries the app\'s diagnosis, and after the second miss may reveal', async ({ page }) => {
    const { st, log } = await fakeServer(page, { parentOk: true }, baseOf());
    st.devices.push({ id: 'd1', label: 'הטאבלט', token: FAMILY }); st.plan = livePlan();
    // a positive number minus a negative one, typed: a − (−b), whose minus-minus answer is a − b
    const it = await openOn(page, '#/lesson/signed/1', family(), (x) => /^sn1:(\d+) - \(-(\d+)\)$/.test(x.key));
    const [, a, b] = it.key.match(/^sn1:(\d+) - \(-(\d+)\)$/).map(Number);
    await page.locator('#slot-v').click();
    await type(page, a - b);
    await check(page);
    await expect(page.getByText(/^מה כנראה קרה: חיסור של מספר שלילי/)).toBeVisible();
    await proceed(page);
    await type(page, 90);
    await check(page);
    await expect(page.getByText('הסבר קצר מהעוזר.')).toBeVisible();
    const body = await bodyOf(log, '/api/ai/explain');
    const { ctx } = body;
    expect(ctx.v).toBe(2);
    expect(ctx.surface).toBe('lesson');
    expect(ctx.skill).toBe('signed:1');
    expect(ctx.tries.answers.map((x) => x.value)).toEqual([String(a - b), '90']);
    expect(ctx.tries.answers[0].ids[0]).toBe('minus-minus');
    expect(ctx.tries.answers[0].labels[0]).toMatch(/^חיסור של מספר שלילי/);
    expect(ctx.shown[0]).toMatch(/^מה כנראה קרה: חיסור של מספר שלילי/);
    expect(ctx.miscon.id).toBe('minus-minus');
    expect(ctx.policy.answer).toBe('reveal');
    expect(ctx.teach.idea.length).toBeGreaterThan(10);
    expect(ctx.item).toMatchObject({ answer: String(a + b), answerFrom: 'app', text: `חשבו: ${a} - (-${b})` });
    // nothing personal and no old flat fields
    expect(JSON.stringify(body)).not.toMatch(/נועה|2026-/);
    expect(body.question).toBeUndefined(); expect(body.studentAnswer).toBeUndefined();
  });

  test('a chat on an open exercise sends withhold, with no answers yet', async ({ page }) => {
    const { st, log } = await fakeServer(page, { parentOk: true }, baseOf());
    st.devices.push({ id: 'd1', label: 'הטאבלט', token: FAMILY }); st.plan = livePlan();
    await open(page, '#/lesson/signed/1', family());
    await expect.poll(() => item(page)).toBeTruthy();
    await page.getByRole('button', { name: 'שאלו את העוזר' }).click();
    const sheet = page.getByRole('dialog', { name: 'שאלו את העוזר' });
    await sheet.getByRole('button', { name: 'איך מתחילים?' }).click();
    await expect(sheet.getByText(/כדי לחבר מספרים/)).toBeVisible();
    const body = await bodyOf(log, '/api/ai/chat');
    expect(body.messages).toEqual([{ role: 'user', content: 'איך מתחילים?' }]);
    expect(body.ctx.v).toBe(2);
    expect(body.ctx.policy.answer).toBe('withhold');
    expect(body.ctx.tries.answers).toHaveLength(0);
    expect(body.ctx.tries.phase).toBe('answer');
    expect(body.ctx.item.answerFrom).toBe('app');
    expect(body.context).toBeUndefined();
  });

  test('the review of a checked exam sends reveal, and says the answer came from the AI check', async ({ page }) => {
    const { log } = await fakeServer(page, { parentOk: true }, baseOf());
    const q = { number: '1', prompt: 'פתרו: $2x + 3 = 11$', studentAnswer: '$x = 5$', status: 'wrong', correctAnswer: '$x = 4$', feedback: 'כדאי לבדוק את החיסור.', solution: ['$2x = 8$', '$x = 4$'], topic: 'eq', level: 2, skill: 'משוואה בשני צעדים' };
    const exam = { id: 'ex1', at: '2026-11-04T10:00:00.000Z', title: 'מבחן במשוואות', source: 'upload', practiceId: null, result: { readable: true, title: 'מבחן במשוואות', questions: [q], summary: 'כמעט.', weakTopics: [], nextSteps: [], care: false }, score: { correct: 0, total: 1, pct: 0 }, levels: {} };
    await open(page, '#/exams/ex1', family({ exams: [exam] }));
    await page.getByRole('button', { name: 'שאלו על השאלה' }).click();
    const sheet = page.getByRole('dialog', { name: 'שאלה 1' });
    await sheet.getByRole('button', { name: 'למה זה ככה?' }).click();
    const { ctx } = await bodyOf(log, '/api/ai/chat');
    expect(ctx.surface).toBe('exam-review');
    expect(ctx.policy.answer).toBe('reveal');
    expect(ctx.item).toEqual({ text: q.prompt, answer: q.correctAnswer, answerFrom: 'ai' });
    expect(ctx.tries.answers).toEqual([{ value: q.studentAnswer }]);
    expect(ctx.skill).toBe('eq:2');
  });

  test('the assistant\'s photo check sends homework, with no exercise of the app\'s', async ({ page }) => {
    const { st, log } = await fakeServer(page, { parentOk: true }, baseOf());
    st.devices.push({ id: 'd1', label: 'הטאבלט', token: FAMILY }); st.plan = livePlan();
    await open(page, '#/assistant', family());
    // the free chat on the assistant is homework too
    await page.getByRole('button', { name: 'איך מתחילים?' }).click();
    expect((await bodyOf(log, '/api/ai/chat')).ctx).toMatchObject({ surface: 'assistant', policy: { answer: 'homework' } });
    await page.getByRole('button', { name: 'בדיקת פתרון מצולם' }).click();
    const sheet = page.getByRole('dialog', { name: 'בדיקת פתרון מצולם' });
    // a small synthetic picture of a page (one white pixel)
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64');
    await sheet.locator('input[type="file"]').setInputFiles({ name: 'work.png', mimeType: 'image/png', buffer: png });
    await expect(sheet.getByRole('img', { name: 'התמונה שבחרתם' })).toBeVisible();
    await sheet.getByLabel('על איזה תרגיל מדובר? (לא חובה)').fill('3x = 12');
    await sheet.getByRole('button', { name: 'בדיקת הפתרון' }).click();
    await expect(sheet.getByText('התשובה הסופית נכונה.')).toBeVisible();
    const body = await bodyOf(log, '/api/ai/check');
    expect(body.ctx).toMatchObject({ v: 2, surface: 'assistant', grade: '7', policy: { answer: 'homework' } });
    expect(body.ctx.item).toBeUndefined();
    expect(body.question).toBe('3x = 12');
    expect(body.image).toMatch(/^data:image\/jpeg;base64,/);
  });
});

// ---------------------------------------------------------------- help from the tutor counts as help (ai spec AI-3)
const INTRO = {
  open: 'אני רואה את התרגיל. אעזור לכם להגיע לתשובה בעצמכם, צעד אחר צעד. מה לא ברור?',
  retry: 'אני רואה את התרגיל ואת מה שכתבתם. נבין יחד מה קרה, ואת התשובה תמצאו אתם.',
  shown: 'אני רואה את התרגיל, את מה שכתבתם ואת הפתרון. מה לא ברור?',
};
const HELP_NOTE = 'תשובה אחרי עזרה נספרת כתרגול, וזה בסדר גמור. בבדיקת השליטה עונים בלי עזרה.';
const chatSheet = (page) => page.getByRole('dialog', { name: 'שאלו את העוזר' });
const openChat = async (page) => { await page.getByRole('button', { name: 'שאלו את העוזר' }).click(); await expect(chatSheet(page)).toBeVisible(); };
const closeChat = async (page) => { await page.keyboard.press('Escape'); await expect(chatSheet(page)).toHaveCount(0); };

test.describe('help from the tutor counts as help', () => {
  test.skip(({ viewport }) => viewport.width > 800, 'phone layouts');

  test('asking the tutor before answering counts as help', async ({ page }) => {
    const { st } = await fakeServer(page, { parentOk: true }, baseOf());
    st.devices.push({ id: 'd1', label: 'הטאבלט', token: FAMILY }); st.plan = livePlan();
    await open(page, '#/lesson/signed/1', family());
    // two right first tries: the header counts them
    for (let i = 0; i < 2; i += 1) {
      await expect.poll(() => item(page)).toBeTruthy();
      const it = await answer(page, true);
      await expect(page.locator('#fb-title')).toBeVisible();
      await proceed(page);
      await expect.poll(async () => (await item(page))?.key !== it.key || (await item(page)) === undefined).toBe(true);
    }
    const chip = page.locator('.lesson-combo .combo-chip');
    await expect(chip).toHaveText(/^2\s*ברצף$/);
    // the third: ask the tutor first, while the exercise is still open
    const third = await item(page);
    await openChat(page);
    await expect(chatSheet(page).getByText(INTRO.open)).toBeVisible();
    await chatSheet(page).getByRole('button', { name: 'איך מתחילים?' }).click();
    await expect(chatSheet(page).getByText(/כדי לחבר מספרים/)).toBeVisible();
    // one quiet line under the first reply says what help means
    await expect(chatSheet(page).getByText(HELP_NOTE)).toHaveCount(1);
    await closeChat(page);
    // the app's own hint did not open: the tutor is not the hint button
    await expect(page.locator('.hint-bar')).toHaveCount(0);
    expect((await item(page)).key).toBe(third.key);
    await answer(page, true);
    await expect(page.locator('#fb-title')).toHaveText('נכון! פתרתם עם קצת עזרה.');
    await expect(chip).toHaveCount(0);
    await expect.poll(async () => (await saved(page)).learn?.skills?.['signed:1']?.attempts?.length).toBe(3);
    const attempts = (await saved(page)).learn.skills['signed:1'].attempts;
    expect(attempts.map((x) => [x.ok, x.independent])).toEqual([[true, true], [true, true], [true, false]]);
  });

  test('the chat intro follows the phase', async ({ page }, info) => {
    test.skip(info.project.name !== 'phone', 'the pictures are taken at 390×844');
    const { st } = await fakeServer(page, { parentOk: true }, baseOf());
    st.devices.push({ id: 'd1', label: 'הטאבלט', token: FAMILY }); st.plan = livePlan();
    // a typed exercise, so a wrong answer is one number on the keypad (the same seed opens it every run)
    await openOn(page, '#/lesson/signed/1', family(), (x) => x.form === 'num');
    const shot = async (name, intro, starters) => {
      await openChat(page);
      const sheet = chatSheet(page);
      await expect(sheet.getByText(intro)).toBeVisible();
      await expect(sheet.locator('.starter')).toHaveText(starters);
      await page.evaluate(() => document.fonts.ready);
      await expect(page).toHaveScreenshot(`tutor-intro-${name}.png`, { fullPage: false });
      await closeChat(page);
    };
    const STARTERS = ['איך מתחילים?', 'אפשר רמז קטן?', 'למה זה ככה?'];
    await shot('open', INTRO.open, STARTERS);
    // a first miss: the tutor helps find what happened, and the first question offered is about the student's answer
    await page.locator('#slot-v').click(); await type(page, 90); await check(page);
    await expect(page.locator('#fb-title')).toHaveText('עוד לא. נסו שוב');
    await shot('retry', INTRO.retry, ['מה הטעות שלי?', ...STARTERS]);
    // a second miss shows the answer: the tutor may use it
    await proceed(page);
    await page.locator('#slot-v').click(); await type(page, 91); await check(page);
    await expect(page.locator('#fb-title')).toHaveText('התשובה הנכונה:');
    await expect(page.getByText('הסבר קצר מהעוזר.')).toBeVisible();
    await shot('reveal', INTRO.shown, ['מה הטעות שלי?', ...STARTERS]);
  });
});
