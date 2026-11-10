// Trust and child safety, end to end (trust spec TRUST-3 §3.5). A person to talk to is one tap away whatever the tutor
// says: used up, offline, or without a server. A message that reads as distress shows the support card at once, before
// any answer, and never meets a limit sheet; a care reply that streams in pieces never shows its marker. The server is
// a fake (page.route, or a fetch that streams in pieces); nothing leaves the machine.
import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { NOW, student, answer, proceed } from './helpers.js';
import { fakeServer, API, CORS } from './fakeServer.js';

/** Open a route with a saved state, seeded before the app starts (as subscription.spec.js does). */
let seeds = 0;
async function open(page, route, state = null) {
  await page.clock.setFixedTime(NOW);
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

const withServer = (extra = {}) => ({ ...student('7', { ai: { mode: 'server', apiUrl: API, key: '', device: '' }, ...extra }), version: 3 });
const classStudent = () => withServer({ profile: { role: 'student', name: 'נועה', grade: '7', know: 1, classCode: 'K7Q2MD', className: 'ז׳3', token: 'stu_token_1', studentId: 's1' } });
const chatCalls = (log) => log.filter((r) => r.path === '/api/ai/chat');
const baseOf = () => test.info().project.use.baseURL || 'http://127.0.0.1:4173/';
const CARE_TEXT = 'תודה שכתבתם. מה שאתם מרגישים חשוב. אפשר להתקשר לער״ן, 1201, בכל שעה.';

// Screenshots to look at (TRUST_SHOTS=<folder>); nothing is compared.
async function shot(page, name) {
  const dir = process.env.TRUST_SHOTS; if (!dir) return;
  mkdirSync(dir, { recursive: true });
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${dir}/${test.info().project.name}-${name}.png`, fullPage: false });
}

/** Every way in on the card is a real link a phone can follow, at least 44px tall. */
async function expectCard(card) {
  await expect(card.getByRole('link', { name: /חיוג 1201/ })).toHaveAttribute('href', 'tel:1201');
  await expect(card.getByRole('link', { name: /וואטסאפ 052-845-1201/ })).toHaveAttribute('href', 'https://wa.me/972528451201');
  await expect(card.getByRole('link', { name: /וואטסאפ 055-957-1399/ })).toHaveAttribute('href', 'https://wa.me/972559571399');
  await expect(card.getByRole('link', { name: /חיוג 105/ })).toHaveAttribute('href', 'tel:105');
  await expect(card.getByRole('link', { name: /משטרה 100/ })).toHaveAttribute('href', 'tel:100');
  await expect(card.getByRole('link', { name: /מד״א 101/ })).toHaveAttribute('href', 'tel:101');
  await expect(card.getByText('וואטסאפ וצ׳אט: 08:00–02:00')).toBeVisible();
  for (const link of await card.getByRole('link').all()) {
    const box = await link.boundingBox();
    expect(box.height, await link.innerText()).toBeGreaterThanOrEqual(44);
  }
}

test.describe('distress', () => {
  test.skip(({ viewport }) => viewport.width > 800, 'phone layouts');

  test('(a) used up: the input still works, a maths question waits calmly, and the quiet link opens the people to talk to', async ({ page }) => {
    const { log } = await fakeServer(page, { freeLimit: 0 }, baseOf());
    await open(page, '#/assistant', withServer());
    await expect(page.getByText('להיום סיימנו עם העוזר החכם. מחר הוא כאן שוב.')).toBeVisible();
    const draft = page.getByLabel('ההודעה שלכם');
    await expect(draft).toBeEnabled();
    await expect(draft).toHaveAttribute('placeholder', 'העוזר החכם חוזר מחר');
    await draft.fill('מה זה שבר?'); await draft.press('Enter');
    await expect(draft).toHaveValue('מה זה שבר?'); // the draft waits for tomorrow
    await page.getByRole('button', { name: 'שליחה' }).click();
    await expect(draft).toHaveValue('מה זה שבר?');
    await expect(page.locator('.chat-rest')).toBeVisible();
    await expect(page.locator('.msg-row.user')).toHaveCount(0);
    expect(chatCalls(log)).toHaveLength(0);
    await expect(page.getByRole('dialog')).toHaveCount(0); // no limit sheet for a question that was never sent
    await shot(page, 'rest-dock');
    await page.locator('.chat-rest').getByRole('button', { name: 'צריכים לדבר עם מישהו?' }).click();
    const sheet = page.getByRole('dialog', { name: 'חשוב לנו שתהיו בסדר' });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText('אם משהו מציק לכם, מפחיד או מעציב אתכם, לא צריך להתמודד עם זה לבד.')).toBeVisible();
    await expect(sheet).not.toContainText('מה שכתבתם');
    await expectCard(sheet);
    // Madi waits beside the words, still
    await expect(sheet.locator('.support-madi')).toBeVisible();
    await shot(page, 'support-sheet');
    await sheet.getByRole('button', { name: 'חזרה' }).click();
    await expect(sheet).toHaveCount(0);
    expect(chatCalls(log)).toHaveLength(0);
  });

  test('(b) used up: a message that reads as distress shows the card at once, still asks the server, and no limit sheet opens', async ({ page }) => {
    const { log } = await fakeServer(page, { freeLimit: 0 }, baseOf());
    let answered = false;
    // the server's care path: never counted, never refused; it answers after 2 seconds
    await page.route(`${API}/api/ai/chat`, async (route) => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
      log.push({ path: '/api/ai/chat', body: route.request().postDataJSON() });
      await new Promise((r) => { setTimeout(r, 2000); });
      answered = true;
      return route.fulfill({ status: 200, contentType: 'text/plain; charset=utf-8', headers: CORS, body: `${CARE_TEXT}\n[[care]]` });
    });
    await open(page, '#/assistant', withServer());
    await expect(page.getByText('להיום סיימנו עם העוזר החכם. מחר הוא כאן שוב.')).toBeVisible();
    const draft = page.getByLabel('ההודעה שלכם');
    await draft.fill('אני רוצה להיעלם'); await draft.press('Enter');
    const card = page.locator('.chat .support-card');
    await expect(card).toBeVisible({ timeout: 1500 });
    expect(answered, 'the card is on screen before the server answers').toBe(false);
    await expect(card.getByText('מה שכתבתם חשוב. לא צריך להתמודד עם זה לבד.')).toBeVisible();
    await expect(page.locator('.msg-row.user')).toHaveText('אני רוצה להיעלם');
    await expect(draft).toHaveValue(''); // the message is not handed back
    await expect.poll(() => chatCalls(log).length).toBe(1); // the request still goes out
    await expect(page.locator('.msg-row.assistant').last()).toContainText('תודה שכתבתם', { timeout: 6000 });
    // the reply sits above the card of the message it answers
    const [reply, cardBox] = [await page.locator('.msg-row.assistant').last().boundingBox(), await card.boundingBox()];
    expect(reply.y).toBeLessThan(cardBox.y);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('.form-error')).toHaveCount(0);
    await expectCard(card);
    // the calm "back tomorrow" card steps aside for the reply and the support card...
    await expect(page.locator('.chat-rest')).toHaveCount(0);
    await shot(page, 'card-in-chat');
    await card.scrollIntoViewIfNeeded();
    await shot(page, 'card-in-chat-scrolled');
    // ...and comes back, with the draft kept and nothing sent, when a maths question is tried
    await draft.fill('ואיך פותרים את התרגיל?'); await draft.press('Enter');
    await expect(page.locator('.chat-rest')).toBeVisible();
    await expect(draft).toHaveValue('ואיך פותרים את התרגיל?');
    expect(chatCalls(log)).toHaveLength(1);
    // a class student could also ask the teacher; this device is not in a class, so the card does not offer it
    await expect(card.getByRole('button', { name: 'לבקש מהמורה לדבר איתי' })).toHaveCount(0);
  });

  test('(c) a care reply arriving in pieces never shows "[[", and the card follows it', async ({ page }) => {
    await fakeServer(page, {}, baseOf());
    // a fetch that streams the reply in pieces, the way the Worker sends it; a MutationObserver watches every change
    await page.addInitScript(() => {
      window.__sawMarker = false; window.__seen = [];
      const watch = () => {
        const check = () => {
          if ((document.body?.textContent || '').includes('[[')) window.__sawMarker = true;
          const live = document.querySelector('.streaming')?.textContent;
          if (live && window.__seen.at(-1) !== live) window.__seen.push(live);
        };
        new MutationObserver(check).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
      };
      if (document.documentElement) watch(); else document.addEventListener('DOMContentLoaded', watch);
      const real = window.fetch;
      window.fetch = (input, init) => {
        const url = typeof input === 'string' ? input : input.url;
        if (!url.endsWith('/api/ai/chat')) return real(input, init);
        const pieces = ['[[ca', 're]]\nאני כאן…', ' ספרו למבוגר שאתם סומכים עליו.', '\n[[ca', 're]]'];
        const enc = new TextEncoder();
        const body = new ReadableStream({
          async start(c) {
            for (const p of pieces) { await new Promise((r) => { setTimeout(r, 120); }); c.enqueue(enc.encode(p)); }
            c.close();
          },
        });
        return Promise.resolve(new Response(body, { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }));
      };
    });
    await open(page, '#/assistant', withServer());
    const draft = page.getByLabel('ההודעה שלכם');
    await expect(draft).toBeEnabled();
    await draft.fill('אני מרגיש מאוד לבד היום'); await draft.press('Enter');
    const reply = page.locator('.msg-row.assistant').last();
    await expect(reply).toHaveText('אני כאן… ספרו למבוגר שאתם סומכים עליו.', { timeout: 6000 });
    const card = page.locator('.chat .support-card');
    await expect(card).toBeVisible();
    const [r, c] = [await reply.boundingBox(), await card.boundingBox()];
    expect(r.y).toBeLessThan(c.y);
    expect(await page.evaluate(() => window.__sawMarker), '"[[" never on screen').toBe(false);
    // the observer did watch the reply arrive piece by piece
    const seen = await page.evaluate(() => window.__seen);
    expect(seen).toContain('אני כאן…');
    await expect(page.locator('.form-error')).toHaveCount(0);
  });

  test('(d) with no server, the Settings link and the "not connected" assistant both open the people to talk to', async ({ page }) => {
    await open(page, '#/settings', student('7'));
    const group = page.getByRole('region', { name: 'פרטיות ובטיחות' }).or(page.locator('section[aria-labelledby="safe-title"]'));
    await expect(group.getByRole('heading', { name: 'פרטיות ובטיחות' })).toBeVisible();
    const row = group.getByRole('button', { name: 'צריכים לדבר עם מישהו?' });
    const rowBox = await row.boundingBox();
    expect(rowBox.height).toBeGreaterThanOrEqual(44);
    await row.click();
    const sheet = page.getByRole('dialog', { name: 'חשוב לנו שתהיו בסדר' });
    await expectCard(sheet);
    await shot(page, 'settings-sheet');
    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
    await row.scrollIntoViewIfNeeded();
    await shot(page, 'settings-group');
    await page.goto('./#/assistant');
    await expect(page.getByRole('heading', { name: 'העוזר עוד לא מחובר' })).toBeVisible();
    const link = page.getByRole('button', { name: 'צריכים לדבר עם מישהו?' });
    await link.scrollIntoViewIfNeeded();
    expect((await link.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await shot(page, 'offline-link');
    // keyboard: the link is reached and opened without a pointer
    await link.focus();
    await page.keyboard.press('Enter');
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('link', { name: /חיוג 1201/ })).toHaveAttribute('href', 'tel:1201');
  });

  test('the limit sheet carries the quiet link too: it closes itself and opens the people to talk to, never two sheets', async ({ page }) => {
    const { st } = await fakeServer(page, {}, baseOf());
    await open(page, '#/lesson/signed/1', withServer());
    await answer(page, false); await proceed(page); await answer(page, false);
    await expect(page.locator('section.fb-reveal')).toBeVisible();
    st.freeLimit = 0; // used up on another screen in the meantime
    await page.getByRole('button', { name: 'למה טעיתי?' }).click();
    const limit = page.getByRole('dialog', { name: 'העוזר החכם חוזר מחר' });
    await expect(limit).toBeVisible();
    const link = limit.getByRole('button', { name: 'צריכים לדבר עם מישהו?' });
    expect((await link.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await shot(page, 'limit-sheet');
    await link.click();
    await expect(limit).toHaveCount(0);
    const sheet = page.getByRole('dialog', { name: 'חשוב לנו שתהיו בסדר' });
    await expectCard(sheet);
    await expect(page.getByRole('dialog')).toHaveCount(1);
  });

  test('a help note that reads as distress: the sheet stays open, says it was sent, and shows the card; a talk request sends no text', async ({ page }) => {
    const { log } = await fakeServer(page, {}, baseOf());
    await page.route(`${API}/api/help`, async (route) => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
      log.push({ path: '/api/help', body: route.request().postDataJSON() });
      return route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: '{"ok":true}' });
    });
    await open(page, '#/lesson/signed/1', classStudent());
    await page.getByRole('button', { name: 'למורה' }).click();
    const sheet = page.getByRole('dialog', { name: 'לבקש עזרה מהמורה' });
    await sheet.getByLabel('מה לא ברור? (לא חובה)').fill('לא הבנתי, וגם עושים לי חרם בכיתה');
    await sheet.getByRole('button', { name: 'שליחה למורה' }).click();
    await expect(sheet.getByText('הבקשה נשלחה למורה.')).toBeVisible();
    const card = sheet.locator('.support-card');
    await expect(card).toBeVisible();
    await expect(card.getByText('המורה יראה את מה שכתבתם בבקשה.')).toBeVisible();
    await expectCard(card);
    const helps = log.filter((r) => r.path === '/api/help');
    expect(helps).toHaveLength(1);
    expect(helps[0].body.note).toBe('לא הבנתי, וגם עושים לי חרם בכיתה');
    await shot(page, 'help-note');
    await card.getByRole('button', { name: 'לבקש מהמורה לדבר איתי' }).click();
    await expect(card.getByText('שלחנו למורה שאתם רוצים לדבר.')).toBeVisible();
    const talk = log.filter((r) => r.path === '/api/help').at(-1);
    expect(talk.body).toEqual({ kind: 'talk' });
    await shot(page, 'help-talk-sent');
    await sheet.getByRole('button', { name: 'חזרה' }).click();
    await expect(sheet).toHaveCount(0);
  });
});

test.describe('moderation', () => {
  test.skip(({ viewport }) => viewport.width > 800, 'phone layouts');

  /** The fake server's chat answers with this text (as the Worker streams it). */
  const chatSays = async (page, log, text) => page.route(`${API}/api/ai/chat`, async (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    log.push({ path: '/api/ai/chat', body: route.request().postDataJSON() });
    return route.fulfill({ status: 200, contentType: 'text/plain; charset=utf-8', headers: { ...CORS, 'X-AI-Tier': 'free', 'X-AI-Group': 'tutor', 'X-AI-Left': '1' }, body: text });
  });

  test('a reply the server stopped shows the calm sentence, never a red error', async ({ page }) => {
    const { log } = await fakeServer(page, {}, baseOf());
    await chatSays(page, log, 'נסו לחסר \n[[blocked]]');
    await open(page, '#/assistant', withServer());
    const draft = page.getByLabel('ההודעה שלכם');
    await draft.fill('איך פותרים?'); await draft.press('Enter');
    await expect(page.locator('.msg-row.assistant').last()).toHaveText('לא הצלחתי לענות על זה כמו שצריך. אפשר לנסח את השאלה אחרת?');
    await expect(page.locator('.form-error')).toHaveCount(0);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(draft).toHaveValue('');
  });

  test('personal details: a quiet line says what the tutor did not receive; links in a reply open only to checked places', async ({ page }) => {
    const { log } = await fakeServer(page, {}, baseOf());
    await chatSays(page, log, 'אפשר לקרוא [פתרונות](https://evil.example/answers) או לדבר עם [ער״ן](https://www.eran.org.il/online-emotional-help/). ![x](https://evil.example/x.png)');
    await open(page, '#/assistant', withServer());
    const draft = page.getByLabel('ההודעה שלכם');
    await draft.fill('אפשר לשלוח לי את הפתרון ל־0521234567?'); await draft.press('Enter');
    const note = page.locator('.msg-pii');
    await expect(note).toHaveText('הסרנו מהשאלה מספר טלפון. אין צורך לשלוח לעוזר פרטים אישיים.');
    await expect(page.locator('.msg-row.user')).toHaveText('אפשר לשלוח לי את הפתרון ל־0521234567?'); // the child's own words stay as written
    const reply = page.locator('.msg-row.assistant').last();
    await expect(reply).toContainText('פתרונות');
    await expect(reply.locator('a[href*="evil.example"]')).toHaveCount(0);
    await expect(reply.locator('img')).toHaveCount(0);
    const eran = reply.getByRole('link', { name: 'ער״ן' });
    await expect(eran).toHaveAttribute('href', 'https://www.eran.org.il/online-emotional-help/');
    await expect(eran).toHaveAttribute('rel', 'noopener noreferrer');
    await shot(page, 'pii-line');
    // the request went to the server as typed: the server masks it before the tutor, and counts it
    expect(log.filter((r) => r.path === '/api/ai/chat')[0].body.messages.at(-1).content).toContain('0521234567');
  });
});
