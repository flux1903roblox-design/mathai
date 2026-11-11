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
    // every photo passes the step that hides personal details on the device (trust spec TRUST-5); here nothing to hide
    await page.getByRole('dialog', { name: 'מסתירים פרטים אישיים' }).getByRole('button', { name: 'סיימתי, אין בדף פרטים אישיים' }).click();
    await expect(sheet.getByRole('img', { name: 'התמונה שבחרתם' })).toBeVisible();
    await sheet.getByLabel('על איזה תרגיל מדובר? (לא חובה)').fill('3x = 12');
    await sheet.getByRole('button', { name: 'בדיקת הפתרון' }).click();
    await expect(sheet.getByText('התשובה הסופית נכונה.')).toBeVisible();
    const body = await bodyOf(log, '/api/ai/check');
    expect(body.ctx).toMatchObject({ v: 2, surface: 'assistant', grade: '7', policy: { answer: 'homework' } });
    expect(body.ctx.item).toBeUndefined();
    expect(body.question).toBe('3x = 12');
    expect(body.image).toMatch(/^data:image\/jpeg;base64,/);
    expect(body.prep).toEqual({ crop: false, boxes: 0 });
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

  test('a chat that failed is not help: the right answer keeps its praise and counts as independent (the AI review)', async ({ page }) => {
    const { st } = await fakeServer(page, { parentOk: true }, baseOf());
    st.devices.push({ id: 'd1', label: 'הטאבלט', token: FAMILY }); st.plan = livePlan();
    await open(page, '#/lesson/signed/1', family());
    await expect.poll(() => item(page)).toBeTruthy();
    // the tutor fails: no help reached the student
    st.breakNext = { status: 502, body: { error: 'bad_output' } };
    await openChat(page);
    await chatSheet(page).getByRole('button', { name: 'איך מתחילים?' }).click();
    await expect(chatSheet(page).getByRole('alert')).toBeVisible();
    await closeChat(page);
    await answer(page, true);
    await expect(page.locator('#fb-title')).not.toHaveText('נכון! פתרתם עם קצת עזרה.');
    await expect.poll(async () => (await saved(page)).learn?.skills?.['signed:1']?.attempts?.length).toBe(1);
    expect((await saved(page)).learn.skills['signed:1'].attempts[0].independent).toBe(true);
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

// ---------------------------------------------------------------- new exercises: code makes and grades them (ai spec AI-4)
const SHOTS = process.env.SHOTS_DIR;
test.describe('generated exercises', () => {
  test.skip(({ viewport }) => viewport.width > 800, 'phone layouts');

  test('a seed with a drawing that the AI kept is shown as the app shows it, never as the words for the drawing (the AI review)', async ({ page }) => {
    const { st, log } = await fakeServer(page, { parentOk: true }, baseOf());
    st.devices.push({ id: 'd1', label: 'הטאבלט', token: FAMILY }); st.plan = livePlan();
    await open(page, '#/assistant?generate=expr&level=2', family());
    const sheet = page.getByRole('dialog', { name: 'תרגילים חדשים' });
    await sheet.getByRole('button', { name: 'כתיבת תרגילים' }).click();
    const first = sheet.locator('.gen-q').first();
    await expect(first).toBeVisible();
    const body = log.filter((r) => r.path === '/api/ai/generate').at(-1).body;
    expect(body.seeds.every((sd) => sd.fig)).toBe(true);
    // the request carries the drawing in words for the tutor; the screen shows the app's own text and the drawing
    expect(body.seeds[0].text).toContain('[טבלה:');
    for (const q of await sheet.locator('.gen-q-text').all()) expect(await q.innerText()).not.toContain('[טבלה');
    await expect(first.locator('.gen-q-fig')).toBeVisible();
    await first.scrollIntoViewIfNeeded();
    await expect(first).toHaveScreenshot('gen-kept-fig.png');
  });

  test('generated exercises are graded by code', async ({ page }, info) => {
    const { st, log } = await fakeServer(page, { parentOk: true }, baseOf());
    st.devices.push({ id: 'd1', label: 'הטאבלט', token: FAMILY }); st.plan = livePlan();
    // stories for the first `count` seeds, in the seeds' own words; seed 0's story changes one of its numbers
    st.genReply = (body) => ({
      items: body.seeds.slice(0, body.count).map((sd) => {
        const first = sd.text.match(/\d+/)[0];
        const prompt = sd.i === 0 ? sd.text.replace(new RegExp(`(^|[^\\d])${first}(?!\\d)`, 'g'), `$1${Number(first) + 1000}`) : sd.text;
        return { seed: sd.i, prompt, hint: 'מתחילים מהמספר הראשון.', solution: ['מחשבים לפי הסדר.', `התוצאה: $= ${sd.answer}$`], kept: false, blind: 'ok' };
      }),
      dropped: { kept: 0, latex: 0, numbers: 0, leak: 0, solution: 0, equations: 0, blind: 0 },
      fallback: false,
    });
    await open(page, '#/assistant?generate=signed&level=1', family());
    const sheet = page.getByRole('dialog', { name: 'תרגילים חדשים' });
    await expect(sheet.getByText('את המספרים ואת התשובות קובעת האפליקציה', { exact: false })).toBeVisible();
    const before = (await saved(page)).learn?.skills?.['signed:1']?.attempts?.length || 0;
    await sheet.getByRole('button', { name: 'כתיבת תרגילים' }).click();
    const body = await bodyOf(log, '/api/ai/generate');
    // the request carries the app's exercises and its answers (count + 2), and nothing the AI is to invent
    expect(body).toMatchObject({ grade: '7', skill: 'signed:1', count: 3 });
    expect(body.seeds).toHaveLength(5);
    for (const sd of body.seeds) expect(Object.keys(sd).sort()).toEqual(['answer', 'fig', 'i', 'round', 'text']);
    expect(body.examples).toBeUndefined();

    // three exercises: the two stories that pass, then seed 0 from the app's bank
    const items = sheet.locator('.gen-q');
    await expect(items).toHaveCount(3);
    await expect(sheet.getByText('העוזר כתב את הסיפורים, הרמזים והפתרונות. האפליקציה קבעה את המספרים ובדקה כל תשובה.')).toBeVisible();
    await expect(sheet.getByText('חלק מהסיפורים לא עברו את הבדיקה, אז השלמנו בתרגילים מהמאגר.')).toBeVisible();
    await expect(items.nth(2).locator('.gen-src')).toHaveText('מהמאגר');
    await expect(items.locator('.gen-src')).toHaveCount(1);
    const seeds = await page.evaluate(() => window.__madregotGen.map((s) => ({ key: s.key, answer: s.answer })));
    expect(seeds.map((s) => s.key)).toHaveLength(3);
    expect(body.seeds[0].answer).toBe(String((await page.evaluate(() => window.__madregotGen[2].answer))));

    // a wrong answer the app diagnoses as subtracting a negative like a positive: on another exercise than the right one
    const pick = await page.evaluate(() => {
      const list = window.__madregotGen;
      for (let k = 0; k < list.length; k += 1) {
        for (let u = -40; u <= 40; u += 1) {
          const d = list[k].diagnosis?.(u);
          if (d?.kind === 'misconception' && !d.ambiguous && d.candidates.length === 1 && d.candidates[0].id === 'minus-minus') return { k, u };
        }
      }
      return null;
    });
    expect(pick, 'one of the exercises can show the minus-minus mistake').not.toBeNull();
    const right = pick.k === 0 ? 1 : 0;
    const answerIn = async (k, value) => {
      await items.nth(k).getByLabel(`התשובה לתרגיל ${k + 1}`).fill(String(value));
      await items.nth(k).getByRole('button', { name: 'בדיקה' }).click();
    };
    await answerIn(right, seeds[right].answer);
    await expect(items.nth(right).getByText('נכון!')).toBeVisible();
    await answerIn(pick.k, pick.u);
    await expect(items.nth(pick.k).getByText('עוד לא.')).toBeVisible();
    await expect(items.nth(pick.k).getByText('מה כנראה קרה: חיסור של מספר שלילי חושב כמו חיסור של חיובי.')).toBeVisible();
    // the list as a student sees it: what the AI wrote and what the app checked, a right answer, a named mistake
    await sheet.locator('.gen-note').scrollIntoViewIfNeeded();
    await page.evaluate(() => document.fonts.ready);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/generated-graded-${info.project.name}.png` });
    if (info.project.name === 'phone') await expect(page).toHaveScreenshot('generated-graded.png', { fullPage: false });
    // the first answer of each counts as practice, the mistake included
    await expect.poll(async () => (await saved(page)).learn?.skills?.['signed:1']?.attempts?.length || 0).toBe(before + 2);
    const st2 = await saved(page);
    const last = st2.learn.skills['signed:1'].attempts.slice(-2);
    expect(last.map((a) => a.ok)).toEqual([true, false]);
    expect(st2.mistakes['signed:minus-minus']).toBeGreaterThanOrEqual(1);
    // a second wrong answer shows the app's answer and the checked solution
    await answerIn(pick.k, pick.u + 100);
    await expect(items.nth(pick.k).locator('.gen-shown')).toContainText(`התשובה: ${seeds[pick.k].answer}`);
    await expect(items.nth(pick.k).locator('.gen-shown')).toContainText('מחשבים לפי הסדר.');
    await expect.poll(async () => (await saved(page)).learn.skills['signed:1'].attempts.length).toBe(before + 2);
    // opening the solution first locks the third exercise and records nothing
    const third = [0, 1, 2].find((k) => k !== right && k !== pick.k);
    await items.nth(third).getByText('פתרון ותשובה').click();
    await expect(items.nth(third).getByText('הפתרון כבר פתוח, אז את התרגיל הזה לא בודקים. אפשר לנסות את הבא.')).toBeVisible();
    await expect(items.nth(third).getByLabel(`התשובה לתרגיל ${third + 1}`)).toBeDisabled();
    if (SHOTS) {
      await items.nth(third).scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SHOTS}/generated-locked-${info.project.name}.png` });
    }
  });
});

// ---------------------------------------------------------------- exam checks: who decided right or wrong (ai spec AI-8)
test.describe('exam labels', () => {
  test.skip(({ viewport }) => viewport.width > 800, 'phone layouts');

  test('exam labels', async ({ page }, info) => {
    await fakeServer(page, { parentOk: true }, baseOf());
    // a practice exam of two questions: the first matched the app's key and code re-graded it; the second could not be
    // read, so the model's grade stands
    const keyQ = {
      number: '1', prompt: 'חשבו: $3 - (-5)$', studentAnswer: '$8$', status: 'correct', correctAnswer: '8', feedback: 'חיסור של שלילי הוא חיבור, ועשיתם את זה נכון.',
      solution: ['$3 - (-5) = 3 + 5 = 8$'], topic: 'signed', level: 1, skill: 'חיבור וחיסור', graded: 'key', overridden: true,
      item: { text: 'חשבו:', display: '3 - (-5)', fig: null, form: 'num', choices: null },
    };
    const aiQ = {
      number: '2', prompt: 'פתרו: $2x + 3 = 11$', studentAnswer: 'x = ?', status: 'partial', correctAnswer: '$x = 4$', feedback: 'הצעד הראשון נכון. בדקו את החילוק.',
      solution: ['$2x = 8$', '$x = 4$'], topic: 'eq', level: 2, skill: 'משוואה בשני צעדים', graded: 'ai',
    };
    const exam = {
      id: 'ex-labels', at: '2026-11-04T10:00:00.000Z', title: 'מבחן תרגול', source: 'practice', practiceId: 'p1',
      result: { readable: true, title: 'מבחן תרגול', questions: [keyQ, aiQ], summary: 'כמעט הכול נכון.', weakTopics: [], nextSteps: [], care: false },
      score: { correct: 1.5, total: 2, pct: 75 }, levels: {},
    };
    // an exam stored before the labels has no mark: its questions read as graded by the AI
    const old = { ...exam, id: 'ex-old', source: 'upload', practiceId: null, result: { ...exam.result, questions: [{ ...aiQ, graded: undefined }] } };
    await open(page, '#/exams/ex-labels', family({ exams: [exam, old] }));
    const cards = page.locator('.q-card');
    await expect(cards).toHaveCount(2);
    await expect(cards.nth(0).locator('.grade-chip')).toHaveText('נבדק מול מפתח התשובות');
    await expect(cards.nth(0).getByText('בדקנו את התשובה שכתבתם מול מפתח התשובות.')).toBeVisible();
    await expect(cards.nth(1).locator('.grade-chip')).toHaveText('נבדק על ידי העוזר החכם');
    await expect(cards.nth(1).locator('.q-overridden')).toHaveCount(0);
    const notes = page.locator('.exam-notes');
    await expect(notes.getByText('את הכתב קרא העוזר החכם, ואת ההשוואה למפתח התשובות עשתה האפליקציה. אם הוא קרא משהו לא נכון, כדאי להראות למורה.')).toBeVisible();
    await expect(notes.getByText('את השאלות שמסומנות כך בדק העוזר החכם, ולפעמים הוא טועה. אם משהו נראה לא נכון, כדאי להראות למורה.')).toBeVisible();
    await cards.nth(0).scrollIntoViewIfNeeded();
    await page.evaluate(() => document.fonts.ready);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/exam-labels-${info.project.name}.png` });
    if (info.project.name === 'phone') await expect(page).toHaveScreenshot('exam-labels.png', { fullPage: false });
    await notes.scrollIntoViewIfNeeded();
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/exam-labels-notes-${info.project.name}.png` });
    // the older exam: one AI chip, the AI footnote, and no key line
    await page.evaluate(() => { window.location.hash = '#/exams/ex-old'; });
    await expect(page.locator('.q-card')).toHaveCount(1);
    await expect(page.locator('.q-card .grade-chip')).toHaveText('נבדק על ידי העוזר החכם');
    await expect(page.locator('.exam-notes .footnote')).toHaveCount(2);
    await expect(page.getByText('את הכתב קרא העוזר החכם', { exact: false })).toHaveCount(0);
  });
});
