// Trust and child safety, end to end (trust spec TRUST-3 §3.5). A person to talk to is one tap away whatever the tutor
// says: used up, offline, or without a server. A message that reads as distress shows the support card at once, before
// any answer, and never meets a limit sheet; a care reply that streams in pieces never shows its marker. The server is
// a fake (page.route, or a fetch that streams in pieces); nothing leaves the machine.
import { test, expect } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { NOW, student, livedIn, answer, proceed, appReady } from './helpers.js';
import { fakeServer, API, CORS, livePlan } from './fakeServer.js';

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
    // the copy of the progress on the device goes too: the app's own open waits behind this delete
    indexedDB.deleteDatabase('madregot-durable');
  }, [state, key]);
  await page.goto(`./${route}`);
  await appReady(page);
}

const withServer = (extra = {}) => ({ ...student('7', { ai: { mode: 'server', apiUrl: API, key: '', device: '', introSeen: true }, ...extra }), version: 3 });
/** A device where nobody has used the tutor yet: the introduction is still due. */
const firstTime = (extra = {}) => withServer({ ai: { mode: 'server', apiUrl: API, key: '', device: '' }, ...extra });
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
  // under a message the number is in the card's head too: every link to it dials it
  const eran = await card.getByRole('link', { name: /חיוג 1201/ }).all();
  expect(eran.length).toBeGreaterThanOrEqual(1);
  for (const l of eran) await expect(l).toHaveAttribute('href', 'tel:1201');
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
    const { log } = await fakeServer(page, { parentOk: true, freeLimit: 0 }, baseOf());
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
    const { log } = await fakeServer(page, { parentOk: true, freeLimit: 0 }, baseOf());
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

  for (const used of [false, true]) {
    test(`(e) the first number is on the screen at once after a distress message, with no scrolling${used ? ', the questions used up' : ''} (the trust review)`, async ({ page }) => {
      await fakeServer(page, { parentOk: true, freeLimit: used ? 0 : 2 }, baseOf());
      await page.route(`${API}/api/ai/chat`, async (route) => {
        if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
        return route.fulfill({ status: 200, contentType: 'text/plain; charset=utf-8', headers: CORS, body: `${CARE_TEXT}\n[[care]]` });
      });
      await open(page, '#/assistant', withServer());
      const draft = page.getByLabel('ההודעה שלכם');
      await draft.fill('אני רוצה למות'); await draft.press('Enter');
      await expect(page.locator('.msg-row.assistant').last()).toContainText('תודה שכתבתם');
      const quick = page.locator('.chat .support-card .support-quick');
      await expect(quick).toHaveAttribute('href', 'tel:1201');
      // no manual scroll: the link is inside the window, above the docked input, and nothing covers its middle
      await expect.poll(() => quick.evaluate((el) => {
        const b = el.getBoundingClientRect();
        const dock = document.querySelector('.chat-dock-live')?.getBoundingClientRect().top ?? innerHeight;
        const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
        return b.top >= 0 && b.bottom <= Math.min(innerHeight, dock) && !!hit && (hit === el || el.contains(hit));
      }), { timeout: 4000 }).toBe(true);
      const box = await quick.boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(44);
      await shot(page, `card-first-number${used ? '-used' : ''}`);
    });
  }

  test('(c) a care reply arriving in pieces never shows "[[", and the card follows it', async ({ page }) => {
    await fakeServer(page, { parentOk: true }, baseOf());
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
    const { st } = await fakeServer(page, { parentOk: true }, baseOf());
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
    const { log } = await fakeServer(page, { parentOk: true }, baseOf());
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

  test('a help note that reads as distress and does not go (no network): the card says it waits here, and nothing about the tutor (FOLLOWUP-9)', async ({ page }) => {
    await fakeServer(page, { parentOk: true }, baseOf());
    await page.route(`${API}/api/help`, (route) => route.abort());
    await open(page, '#/lesson/signed/1', classStudent());
    await page.getByRole('button', { name: 'למורה' }).click();
    const sheet = page.getByRole('dialog', { name: 'לבקש עזרה מהמורה' });
    const note = 'לא הבנתי, וגם עושים לי חרם בכיתה';
    await sheet.getByLabel('מה לא ברור? (לא חובה)').fill(note);
    await sheet.getByRole('button', { name: 'שליחה למורה' }).click();
    const line = sheet.locator('.help-sent-line');
    await expect(line).toHaveText('לא הצלחנו לשלוח את הבקשה למורה. בדקו את החיבור לאינטרנט ונסו שוב.');
    await expect(line).toHaveClass(/is-quiet/);
    const card = sheet.locator('.support-card');
    await expect(card).toHaveAttribute('data-variant', 'help-unsent');
    await expect(card.locator('.support-opening')).toHaveText('מה שכתבתם חשוב. לא צריך להתמודד עם זה לבד.');
    await expect(card.locator('.support-quick')).toHaveAttribute('href', 'tel:1201');
    await expect(card.locator('.support-foot')).toHaveText('מה שכתבתם עוד לא נשלח. הוא מחכה כאן, ואפשר לשלוח שוב.');
    await expect(card).not.toContainText('העוזר החכם');
    await expectCard(card);
    await shot(page, 'help-note-unsent');
    // the note waits in the form
    await sheet.getByRole('button', { name: 'לנסות לשלוח שוב' }).click();
    await expect(sheet.getByLabel('מה לא ברור? (לא חובה)')).toHaveValue(note);
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
    const { log } = await fakeServer(page, { parentOk: true }, baseOf());
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
    const { log } = await fakeServer(page, { parentOk: true }, baseOf());
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
  test('the first message on a device opens the introduction; "הבנתי" sends that same message, and it never shows again', async ({ page }) => {
    const { log } = await fakeServer(page, { parentOk: true }, baseOf());
    await chatSays(page, log, 'כדי לחבר מספרים עם סימנים שונים, מחסרים.');
    await open(page, '#/assistant', firstTime());
    const draft = page.getByLabel('ההודעה שלכם');
    await draft.fill('מה זה מספר שלילי?'); await draft.press('Enter');
    const intro = page.getByRole('dialog', { name: 'לפני שמתחילים עם העוזר החכם' });
    await expect(intro).toBeVisible();
    await expect(intro.getByText('העוזר החכם הוא תוכנת בינה מלאכותית (Claude של Anthropic), לא אדם.', { exact: false })).toBeVisible();
    await expect(intro.getByText('מה שכותבים או מצלמים נשלח ל־Anthropic בארה״ב כדי לקבל תשובה. מדרגות לא שומרת את השיחות.')).toBeVisible();
    await expect(intro.getByText('אל תכתבו שם מלא, תעודת זהות, כתובת או טלפון, לא שלכם ולא של אחרים.')).toBeVisible();
    await expect(intro.locator('li')).toHaveCount(5);
    expect(chatCalls(log)).toHaveLength(0); // nothing is sent before it is read
    await expect(page.locator('.msg-row.user')).toHaveCount(0);
    const ok = intro.getByRole('button', { name: 'הבנתי, אפשר להתחיל' });
    expect((await ok.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await shot(page, 'ai-intro');
    await ok.click();
    await expect(intro).toHaveCount(0);
    await expect.poll(() => chatCalls(log).length).toBe(1);
    expect(chatCalls(log)[0].body.messages.at(-1).content).toBe('מה זה מספר שלילי?');
    await expect(page.locator('.msg-row.user')).toHaveText('מה זה מספר שלילי?');
    await expect(draft).toHaveValue('');
    await expect(page.locator('.msg-row.assistant').last()).toContainText('מחסרים');
    expect((await page.evaluate(() => JSON.parse(localStorage.getItem('madregot')).state.ai)).introSeen).toBe(true);
    // the next message goes at once, also after a reload
    await page.reload();
    await draft.fill('ועוד שאלה'); await draft.press('Enter');
    await expect.poll(() => chatCalls(log).length).toBe(2);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('the introduction: closing it sends nothing and keeps the draft; a message that reads as distress never meets it', async ({ page }) => {
    const { log } = await fakeServer(page, { parentOk: true }, baseOf());
    await chatSays(page, log, `${CARE_TEXT}\n[[care]]`);
    await open(page, '#/assistant', firstTime());
    const draft = page.getByLabel('ההודעה שלכם');
    await draft.fill('איך פותרים משוואה?'); await draft.press('Enter');
    const intro = page.getByRole('dialog', { name: 'לפני שמתחילים עם העוזר החכם' });
    await expect(intro).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(intro).toHaveCount(0);
    await expect(draft).toHaveValue('איך פותרים משוואה?');
    expect(chatCalls(log)).toHaveLength(0);
    // distress goes at once: the card, the request, no introduction
    await draft.fill('אני רוצה להיעלם'); await draft.press('Enter');
    await expect(page.locator('.chat .support-card')).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect.poll(() => chatCalls(log).length).toBe(1);
  });

  test('the introduction comes before a tool too, and the tool opens after it', async ({ page }) => {
    await fakeServer(page, { parentOk: true, paywall: false }, baseOf());
    await open(page, '#/assistant', firstTime());
    await page.getByRole('button', { name: 'בדיקת פתרון מצולם' }).click();
    const intro = page.getByRole('dialog', { name: 'לפני שמתחילים עם העוזר החכם' });
    await expect(intro).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'בדיקת פתרון מצולם' })).toHaveCount(0);
    await intro.getByRole('button', { name: 'הבנתי, אפשר להתחיל' }).click();
    await expect(page.getByRole('dialog', { name: 'בדיקת פתרון מצולם' })).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(1);
  });

  test('in a lesson the introduction opens over the chat, and the question goes after it', async ({ page }) => {
    const { log } = await fakeServer(page, { parentOk: true }, baseOf());
    await chatSays(page, log, 'נסו לחשוב על ציר המספרים.');
    await open(page, '#/lesson/signed/1', firstTime());
    await page.getByRole('button', { name: 'שאלו את העוזר' }).click();
    const sheet = page.getByRole('dialog', { name: 'שאלו את העוזר' });
    await sheet.getByLabel('ההודעה שלכם').fill('לא הבנתי את התרגיל'); await sheet.getByLabel('ההודעה שלכם').press('Enter');
    const intro = page.getByRole('dialog', { name: 'לפני שמתחילים עם העוזר החכם' });
    await expect(intro).toBeVisible();
    await shot(page, 'ai-intro-lesson');
    await intro.getByRole('button', { name: 'הבנתי, אפשר להתחיל' }).click();
    await expect(intro).toHaveCount(0);
    await expect.poll(() => chatCalls(log).length).toBe(1);
    await expect(sheet.locator('.msg-row.assistant').last()).toContainText('ציר המספרים');
  });

  test('reporting an answer sends the tutor\'s reply and never the child\'s words; the flag says it was sent', async ({ page }) => {
    const { log } = await fakeServer(page, { parentOk: true }, baseOf());
    await chatSays(page, log, 'כדי לחבר מספרים עם סימנים שונים, מחסרים ושמים את הסימן של הגדול.');
    await open(page, '#/assistant', withServer());
    const draft = page.getByLabel('ההודעה שלכם');
    await draft.fill('קוראים לי נועה, איך מחברים -3 ו־5?'); await draft.press('Enter');
    const reply = page.locator('.msg-row.assistant').last();
    await expect(reply).toContainText('מחסרים');
    const flag = page.getByRole('button', { name: 'דיווח על התשובה' });
    await expect(flag).toHaveCount(1); // one answer, one flag (never under the child's own message)
    const box = await flag.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(44); expect(box.width).toBeGreaterThanOrEqual(44);
    await shot(page, 'report-flag');
    await flag.click();
    const sheet = page.getByRole('dialog', { name: 'מה לא היה בסדר בתשובה?' });
    await expect(sheet).toBeVisible();
    const send = sheet.getByRole('button', { name: 'שליחה' });
    await expect(send).toBeDisabled(); // a reason first
    for (const r of ['יש בה טעות במתמטיקה', 'היא לא נעימה', 'היא לא מתאימה לילדים', 'משהו אחר']) await expect(sheet.getByRole('radio', { name: r })).toBeVisible();
    await sheet.getByRole('radio', { name: 'היא לא מתאימה לילדים' }).check();
    await shot(page, 'report-sheet');
    await send.click();
    await expect(page.getByText('תודה. נבדוק את התשובה.')).toBeVisible();
    await expect(sheet).toHaveCount(0);
    const sent = log.filter((r) => r.path === '/api/ai/report');
    expect(sent).toHaveLength(1);
    expect(sent[0].body).toEqual({ reason: 'not_for_kids', kind: 'chat', reply: 'כדי לחבר מספרים עם סימנים שונים, מחסרים ושמים את הסימן של הגדול.', tier: 'free' });
    expect(JSON.stringify(sent[0].body)).not.toContain('נועה');
    await expect(page.getByRole('button', { name: 'דיווחתם על התשובה הזו' })).toBeDisabled();
    await shot(page, 'report-sent');
  });

  test('the public build has no personal-key mode: no "מפתח אישי" anywhere in Settings', async ({ page }) => {
    await open(page, '#/settings', student('7'));
    await expect(page.getByRole('heading', { name: 'פרטיות ובטיחות' })).toBeVisible();
    await expect(page.getByText('מפתח אישי')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'מתקדם' })).toHaveCount(0);
    await page.goto('./#/settings/advanced');
    await expect(page).toHaveURL(/#\/settings$/);
    await expect(page.getByText('מפתח אישי')).toHaveCount(0);
    await expect(page.getByRole('radio', { name: 'מפתח אישי' })).toHaveCount(0);
  });
});

test.describe('adult step', () => {
  test.skip(({ viewport }) => viewport.width > 800, 'phone layouts');
  const GATE = 'המסך הזה בשביל ההורים';
  const signIn = (page) => page.getByRole('heading', { name: 'כניסה עם המייל' });

  test('on a child\'s device the parents\' area asks for a birth year first; a child\'s year closes it, and nothing about it is sent or kept', async ({ page }) => {
    const { log } = await fakeServer(page, { parentOk: true }, baseOf());
    await open(page, '#/parents?here=1', withServer());
    const gate = page.locator('.adult-gate');
    await expect(gate.getByRole('heading', { name: GATE })).toBeVisible();
    await expect(signIn(page)).toHaveCount(0);
    await expect(page.getByLabel('כתובת המייל')).toHaveCount(0);
    await expect(page.locator('.parents-main')).not.toContainText('₪'); // no prices before the step
    const year = gate.getByLabel('שנת הלידה שלכם');
    await expect(year).toHaveAttribute('inputmode', 'numeric');
    await expect(year).toHaveAttribute('maxlength', '4');
    await expect(year).toHaveAttribute('autocomplete', 'off');
    await expect(year).not.toHaveAttribute('placeholder', /\d/); // no example year to copy
    const go = gate.getByRole('button', { name: 'המשך' });
    await expect(go).toBeDisabled();
    await shot(page, 'adult-gate');
    await year.fill('2013');
    await go.click();
    await expect(gate.getByText('המסך הזה מיועד להורים. אפשר להראות להורים את הקוד מהמסך הקודם.')).toBeVisible();
    await expect(year).toBeDisabled();
    await expect(year).toHaveValue('');
    await expect(go).toBeDisabled();
    await shot(page, 'adult-gate-closed');
    // still closed after a reload: a time is kept, never the year
    await page.reload();
    await expect(page.locator('.adult-gate').getByLabel('שנת הלידה שלכם')).toBeDisabled();
    const stored = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
    expect(stored).not.toContain('2013');
    expect(await page.evaluate(() => localStorage.getItem('madregot-adult-wait'))).toMatch(/^\d{13}$/);
    expect(JSON.stringify(log)).not.toContain('2013');
    await expect(page.getByRole('link', { name: 'חזרה', exact: true })).toHaveAttribute('href', /#\/parents\/info$/);
  });

  test('a parent passes with their year (a new device), and the sign-in follows; the link page asks too', async ({ browser }) => {
    const use = test.info().project.use;
    const ctx = await browser.newContext({ baseURL: use.baseURL || baseOf(), viewport: use.viewport, isMobile: use.isMobile, hasTouch: use.hasTouch, deviceScaleFactor: use.deviceScaleFactor, locale: use.locale, reducedMotion: use.reducedMotion });
    const page = await ctx.newPage();
    const { log } = await fakeServer(ctx, { parentOk: true }, baseOf());
    await open(page, '#/parents/link?c=K7M4QX', withServer());
    const gate = page.locator('.adult-gate');
    await expect(gate.getByRole('heading', { name: GATE })).toBeVisible();
    await gate.getByLabel('שנת הלידה שלכם').fill('1985');
    await gate.getByRole('button', { name: 'המשך' }).click();
    await expect(signIn(page)).toBeVisible();
    await expect(page.getByLabel('כתובת המייל')).toBeVisible();
    await expect(page.locator('.adult-gate')).toHaveCount(0);
    await shot(page, 'adult-gate-passed');
    // passed for this tab: /parents does not ask again
    await page.goto('./#/parents');
    await expect(signIn(page)).toBeVisible();
    expect(JSON.stringify(log)).not.toContain('1985');
    expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain('1985');
    await ctx.close();
  });

  test('/cancel never shows the step: cancelling stays two taps from the email form', async ({ page }) => {
    await fakeServer(page, { parentOk: true }, baseOf());
    await open(page, '#/cancel', withServer());
    await expect(page.getByRole('heading', { name: 'ביטול מנוי' })).toBeVisible();
    await expect(signIn(page)).toBeVisible();
    await expect(page.locator('.adult-gate')).toHaveCount(0);
  });

  test('a device with no student profile (a parent\'s own phone) shows no step', async ({ page }) => {
    await fakeServer(page, { parentOk: true }, baseOf());
    const phone = withServer(); phone.state.profile = null;
    await open(page, '#/parents', phone);
    await expect(signIn(page)).toBeVisible();
    await expect(page.locator('.adult-gate')).toHaveCount(0);
  });
});

test.describe('class join', () => {
  test.skip(({ viewport }) => viewport.width > 800, 'phone layouts');

  test('once a class code is typed, the step says which name the teacher will see and how to tell two names apart', async ({ page }) => {
    await fakeServer(page, { parentOk: true }, baseOf());
    const fresh = withServer(); fresh.state.profile = null;
    await open(page, '#/', fresh);
    await page.getByRole('button', { name: 'מתחילים' }).click();
    await page.getByLabel('השם שלכם').fill('נועה');
    const next = page.getByRole('button', { name: 'המשך', exact: true });
    await next.click();
    await page.getByRole('radio', { name: /כיתה ז׳/ }).click(); await next.click();
    await page.getByRole('radio').first().click(); await next.click();
    await next.click(); // the daily goal keeps its default
    await expect(page.getByText('יש לכם קוד כיתה מהמורה?')).toBeVisible();
    await expect(page.locator('.ob-name-claim')).toHaveCount(0); // nothing to claim without a class
    await page.getByLabel('קוד כיתה').fill('K7Q2MD');
    await expect(page.locator('.ob-name-claim')).toHaveText('המורה יראה את השם נועה. אם יש בכיתה עוד מישהו עם אותו שם, חזרו אחורה והוסיפו אות משם המשפחה, למשל: נועה כ.');
    await page.locator('.ob-name-claim').scrollIntoViewIfNeeded();
    await shot(page, 'class-name-claim');
  });
});

test.describe('class AI off', () => {
  // the Ministry of Education's rules (trust spec TRUST-11 §6): a school class keeps student AI off until Madregot is in
  // the catalogue. The child sees a calm state, never a price or a way to buy round it, and can still write a message
  // that reads as distress.
  test.skip(({ viewport }) => viewport.width > 800, 'phone layouts');
  const refuse = (route) => (route.request().method() === 'OPTIONS'
    ? route.fulfill({ status: 204, headers: CORS })
    : route.fulfill({ status: 403, contentType: 'application/json', headers: CORS, body: JSON.stringify({ error: 'class_ai_off', message: 'class_ai_off' }) }));
  const OFF_TEXT = 'כך החליטו בכיתה, לפי ההנחיות של משרד החינוך. מדי, השיעורים והתרגול פתוחים כמו תמיד.';
  async function noPrice(page) {
    for (const w of ['₪', 'מנוי', 'מידע להורים']) await expect(page.locator('body')).not.toContainText(w);
  }

  test('the assistant says so calmly, with no tools and no price; a question waits, a message that reads as distress still goes', async ({ page }) => {
    const { log } = await fakeServer(page, { parentOk: true }, baseOf());
    await page.route(`${API}/api/ai/status`, refuse);
    await page.route(`${API}/api/ai/chat`, async (route) => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
      log.push({ path: '/api/ai/chat', body: route.request().postDataJSON() });
      // the server's fixed reply in a class whose tutor is off: no AI call behind it
      return route.fulfill({ status: 200, contentType: 'text/plain; charset=utf-8', headers: CORS, body: `${CARE_TEXT}\n[[care]]` });
    });
    await open(page, '#/assistant', classStudent());
    await expect(page.getByRole('heading', { name: 'בכיתה הזו העוזר החכם כבוי' })).toBeVisible();
    await expect(page.getByText(OFF_TEXT)).toBeVisible();
    await expect(page.locator('.assistant-note')).toHaveCount(0);
    await expect(page.getByRole('group', { name: 'עוד דרכים לעזרה' })).toHaveCount(0); // no photo check, no new exercises
    await expect(page.locator('.starter')).toHaveCount(0);
    const rest = page.locator('.chat-rest');
    await expect(rest.getByRole('button', { name: 'להמשיך לתרגל' })).toBeVisible();
    await expect(rest.getByRole('button', { name: 'צריכים לדבר עם מישהו?' })).toBeVisible();
    await noPrice(page);
    const draft = page.getByLabel('ההודעה שלכם');
    await expect(draft).toBeEnabled();
    await expect(draft).toHaveAttribute('placeholder', 'העוזר החכם כבוי בכיתה הזו');
    await draft.fill('מה זה שבר?'); await draft.press('Enter');
    await expect(draft).toHaveValue('מה זה שבר?');
    await expect(page.locator('.msg-row.user')).toHaveCount(0);
    expect(chatCalls(log)).toHaveLength(0);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    for (const b of await page.locator('.chat-rest button, .chat-input button').all()) expect((await b.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await shot(page, 'class-off-assistant');
    await draft.fill('אני רוצה להיעלם'); await draft.press('Enter');
    const card = page.locator('.chat .support-card');
    await expect(card).toBeVisible();
    await expect.poll(() => chatCalls(log).length).toBe(1);
    await expect(page.locator('.msg-row.assistant').last()).toContainText('תודה שכתבתם');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await noPrice(page);
  });

  test('an answer the server refuses with class_ai_off opens the calm sheet: the class\'s choice, practice on, no price', async ({ page }) => {
    const { log } = await fakeServer(page, { parentOk: true }, baseOf()); // the status still says free: the refusal comes with the answer
    await page.route(`${API}/api/ai/chat`, async (route) => { log.push({ path: '/api/ai/chat' }); return refuse(route); });
    await open(page, '#/assistant', classStudent());
    const draft = page.getByLabel('ההודעה שלכם');
    await draft.fill('איך פותרים 3x = 12?'); await draft.press('Enter');
    const sheet = page.getByRole('dialog', { name: 'בכיתה הזו העוזר החכם כבוי' });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText(OFF_TEXT)).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'להמשיך לתרגל' })).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'לשאול את מדי' })).toHaveCount(0);
    await expect(sheet.getByRole('button', { name: 'מידע להורים' })).toHaveCount(0);
    await expect(page.locator('.form-error')).toHaveCount(0); // never a red error
    await noPrice(page);
    await shot(page, 'class-off-sheet');
    await sheet.getByRole('button', { name: 'להמשיך לתרגל' }).click();
    await expect(sheet).toHaveCount(0);
    expect(chatCalls(log)).toHaveLength(1);
  });
});

test.describe('parent OK', () => {
  // a one-time parent's OK before a child alone uses the tutor (trust spec TRUST-9): the child is sent, calmly and with
  // no price, to the screen for the parents; a signed-in parent with no plan approves the device for free, with a box
  // they tick. A message that reads as distress still shows the card at once.
  test.skip(({ viewport }) => viewport.width > 800, 'phone layouts');
  const TITLE = 'קודם, אישור של הורה';
  const OK_TEXT = 'כדי לשאול את העוזר החכם, אחד ההורים צריך לאשר את זה פעם אחת. זה בחינם ולוקח דקה. בינתיים מדי, השיעורים והתרגול פתוחים כמו תמיד.';
  async function noPrice(page) {
    for (const w of ['₪', 'מנוי']) await expect(page.locator('body')).not.toContainText(w);
  }

  test('the assistant says so; the first send opens the sheet, and "להראות להורים" goes to the screen for the parents', async ({ page }) => {
    const { log } = await fakeServer(page, {}, baseOf()); // parentOk false, as on the real server
    await open(page, '#/assistant', withServer());
    await expect(page.getByRole('heading', { name: TITLE })).toBeVisible();
    await expect(page.getByText(OK_TEXT)).toBeVisible();
    await expect(page.locator('.assistant-note')).toHaveCount(0);
    await expect(page.getByRole('group', { name: 'עוד דרכים לעזרה' })).toHaveCount(0);
    await expect(page.locator('.starter')).toHaveCount(0);
    const rest = page.locator('.chat-rest');
    await expect(rest.getByRole('button', { name: 'להראות להורים' })).toBeVisible();
    await expect(rest.getByRole('button', { name: 'להמשיך לתרגל' })).toBeVisible();
    await expect(rest.getByRole('button', { name: 'צריכים לדבר עם מישהו?' })).toBeVisible();
    await noPrice(page);
    const draft = page.getByLabel('ההודעה שלכם');
    await expect(draft).toBeEnabled();
    await expect(draft).toHaveAttribute('placeholder', 'מחכים לאישור של הורה');
    for (const b of await page.locator('.chat-rest button, .chat-input button').all()) expect((await b.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await shot(page, 'parent-ok-assistant');
    await draft.fill('מה זה שבר?'); await draft.press('Enter');
    const sheet = page.getByRole('dialog', { name: TITLE });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText(OK_TEXT)).toBeVisible();
    await expect(draft).toHaveValue('מה זה שבר?'); // the question waits
    expect(chatCalls(log)).toHaveLength(0);
    await expect(page.locator('.form-error')).toHaveCount(0);
    for (const b of await sheet.getByRole('button').all()) expect((await b.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await noPrice(page);
    await shot(page, 'parent-ok-sheet');
    await sheet.getByRole('button', { name: 'להראות להורים' }).click();
    await page.waitForURL(/#\/parents\/info$/);
    await expect(page.getByRole('heading', { name: 'המסך הזה בשביל ההורים' })).toBeVisible();
    await expect(page.getByText('הורים, סרקו את הקוד בטלפון שלכם. שם תקראו על העוזר החכם ותוכלו לאשר אותו במכשיר הזה, בחינם או עם מנוי.')).toBeVisible();
    await expect(page.locator('.handoff-code')).toHaveText('K7M4QX');
    await shot(page, 'parent-ok-handoff');
  });

  test('a refusal that comes with the answer opens the same sheet; a message that reads as distress shows the card and no sheet', async ({ page }) => {
    const { st, log } = await fakeServer(page, { parentOk: true }, baseOf());
    await open(page, '#/assistant', withServer());
    await expect(page.getByText('שאלו כל שאלה במתמטיקה')).toBeVisible();
    st.parentOk = false; // the status said free; the server now answers parent_ok_needed
    const draft = page.getByLabel('ההודעה שלכם');
    await draft.fill('איך פותרים 3x = 12?'); await draft.press('Enter');
    const sheet = page.getByRole('dialog', { name: TITLE });
    await expect(sheet).toBeVisible();
    await expect(page.locator('.form-error')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
    await expect(draft).toHaveAttribute('placeholder', 'מחכים לאישור של הורה');
    await expect(page.getByRole('heading', { name: TITLE })).toBeVisible(); // the screen follows the state at once
    const before = chatCalls(log).length;
    await draft.fill('אני רוצה להיעלם'); await draft.press('Enter');
    await expect(page.locator('.chat .support-card')).toBeVisible();
    await expect.poll(() => chatCalls(log).length).toBe(before + 1); // it still goes (the server answers it with the fixed reply)
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('a lesson after a mistake offers Madi, whose sheet says the tutor waits for a parent', async ({ page }) => {
    const { log } = await fakeServer(page, {}, baseOf());
    await open(page, '#/lesson/signed/1', withServer());
    await answer(page, false); await proceed(page); await answer(page, false);
    await expect(page.locator('section.fb-reveal')).toBeVisible();
    await expect(page.getByRole('button', { name: 'למה טעיתי?' })).toHaveCount(0);
    await page.locator('section.fb-reveal').getByRole('button', { name: 'שאלה למדי' }).click();
    const madi = page.getByRole('dialog', { name: 'שאלה למדי' });
    await expect(madi.getByText('העוזר החכם מחכה לאישור של הורה.')).toBeVisible();
    expect(log.filter((r) => r.path.startsWith('/api/ai/') && r.path !== '/api/ai/status')).toHaveLength(0);
  });

  test('a signed-in parent with no plan approves the device for free: the tick is required, then the claim says consent', async ({ page }) => {
    // the child's device showed the code K7M4QX (its own start call is in the subscription flow)
    const { st, log } = await fakeServer(page, { links: { K7M4QX: { secret: 'f'.repeat(32), claimed: false, collected: false } } }, baseOf());
    const phone = withServer(); phone.state.profile = null; // the parent's own phone
    await open(page, '#/parents/link?c=K7M4QX', phone);
    await page.getByLabel('כתובת המייל שלכם').fill('parent@example.test');
    await page.getByRole('button', { name: 'שליחת קוד' }).click();
    await expect(page.getByText('שלחנו קוד בן 6 ספרות אל')).toBeVisible();
    await page.getByLabel('הקוד מהמייל').fill('123456'); // six digits sign in by themselves
    const card = page.locator('section', { has: page.getByRole('heading', { name: 'אישור העוזר החכם במכשיר של הילד' }) });
    await expect(card).toBeVisible();
    await expect(card.getByText('בחינם, העוזר עונה על 2 שאלות קצרות ביום. מה שהילד כותב לעוזר נשלח ל־Anthropic בארה״ב כדי לקבל תשובה, ולא נשמר אצלנו. אפשר לבטל את האישור בכל רגע כאן.')).toBeVisible();
    await expect(card.getByLabel('הקוד מהמכשיר של הילד')).toHaveValue('K7M4QX');
    const tick = card.getByLabel('אני ההורה או האפוטרופוס, ואני מאשר/ת לילד/ה להשתמש בעוזר החכם');
    await expect(tick).not.toBeChecked();
    await expect(page.getByRole('heading', { name: 'אין מנוי פעיל' })).toBeVisible(); // the plan offer stays below
    await card.scrollIntoViewIfNeeded();
    await shot(page, 'parent-ok-consent');
    const go = card.getByRole('button', { name: 'אישור וחיבור המכשיר' });
    expect((await go.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await go.click();
    await expect(card.getByRole('alert')).toHaveText('כדי לאשר צריך לסמן שאתם ההורים ומאשרים.');
    expect(log.find((r) => r.path === '/api/family/link/claim')).toBeUndefined();
    await tick.check();
    await go.click();
    await expect(page.getByText('אישרתם את העוזר החכם, ושלחנו לכם מייל עם הפרטים. המכשיר של הילד יתחבר ברגע שהמסך עם הקוד פתוח בו.')).toBeVisible();
    expect(log.find((r) => r.path === '/api/family/link/claim').body).toEqual({ code: 'K7M4QX', purpose: 'consent', consent: true });
    expect(st.purposes).toEqual(['consent']);
    // the approved device is listed, and the approval can be taken back here
    const approved = page.locator('section', { has: page.getByRole('heading', { name: /העוזר החכם מאושר ב/ }) });
    await expect(approved).toBeVisible();
    await expect(approved.getByRole('button', { name: 'ביטול האישור' })).toBeVisible();
    await shot(page, 'parent-ok-approved');
  });
});

test.describe('legal pages', () => {
  // trust spec TRUST-2: the four pages and the AI safety statement, their anchors in a hash router, the draft banner
  // that follows the owner's sign-off, and the links to them from the front page, the profile and the introduction
  test.skip(({ viewport }) => viewport.width > 800, 'phone layouts');
  const PAGES = [['#/privacy', 'מדיניות פרטיות'], ['#/terms', 'תקנון'], ['#/accessibility', 'הצהרת נגישות'], ['#/safety', 'בטיחות בעוזר החכם']];
  const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

  test('each page has its h1 and no sideways scroll at 320px; without a server each shows the draft banner and visible blanks', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await open(page, '#/');
    for (const [route, title] of PAGES) {
      await page.goto(`./${route}`);
      await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      await expect(page.getByRole('note')).toHaveText('טיוטה לבדיקה משפטית. הנוסח עוד לא סופי.');
      expect(await noSideScroll(page), route).toBe(true);
      await expect(page.locator('article.legal')).not.toContainText('{{');
      await expect(page.locator('article.legal')).not.toContainText('{#');
      await shot(page, `legal-${route.slice(2)}-320`);
    }
    await expect(page.locator('article.legal')).toContainText('ער״ן 1201');
    await expect(page.locator('article.legal')).toContainText('______'); // no server: the contact is a visible blank
  });

  test('the plain path /terms#cancel opens the cancel section, scrolled to and focused', async ({ page }) => {
    await open(page, '#/');
    await page.goto('./terms#cancel');
    await expect(page).toHaveURL(/\/#\/terms#cancel$/);
    const heading = page.getByRole('heading', { level: 2, name: 'ביטול והחזר' });
    await expect(heading).toBeFocused();
    await expect(heading).toBeInViewport();
    // under the sticky bar, not behind it
    const bar = await page.locator('.parents-bar').boundingBox();
    expect((await heading.boundingBox()).y).toBeGreaterThanOrEqual(bar.y + bar.height - 1);
    await shot(page, 'legal-terms-cancel');
  });

  test('a link inside a page moves inside the app, with no new page load', async ({ page }) => {
    await open(page, '#/terms');
    await page.evaluate(() => { window.__samePage = 'yes'; });
    await page.locator('article.legal').getByRole('link', { name: 'בטיחות בעוזר החכם' }).last().click();
    await expect(page).toHaveURL(/#\/safety$/);
    await expect(page.getByRole('heading', { level: 1, name: 'בטיחות בעוזר החכם' })).toBeVisible();
    expect(await page.evaluate(() => window.__samePage)).toBe('yes');
    // and the statement links back to the cancel section of the terms the same way
    await page.locator('article.legal').getByRole('link', { name: 'תקנון' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'תקנון' })).toBeVisible();
    expect(await page.evaluate(() => window.__samePage)).toBe('yes');
  });

  test('the draft banner follows the server\'s legalApproved, and the details fill in from it', async ({ page }) => {
    const { st } = await fakeServer(page, { parentOk: true }, baseOf());
    st.legalApproved = false;
    await open(page, '#/terms', withServer());
    await expect(page.getByRole('note')).toHaveText('טיוטה לבדיקה משפטית. הנוסח עוד לא סופי.');
    await expect(page.locator('article.legal')).toContainText('מדרגות בדיקה, עוסק מורשה 000000000');
    await expect(page.locator('article.legal')).toContainText('גרסה 2026-11 · עודכן ב־01.11.2026');
    st.legalApproved = true;
    await page.reload();
    await expect(page.locator('article.legal')).toContainText('מדרגות בדיקה');
    await expect(page.getByRole('note')).toHaveCount(0);
    await expect(page.getByText('טיוטה')).toHaveCount(0);
    await expect(page.locator('article.legal')).not.toContainText('______');
    await shot(page, 'legal-terms-approved');
  });

  test('the profile ends with the legal links; with a server, "ביטול מנוי" opens the cancel page', async ({ page }) => {
    await fakeServer(page, { parentOk: true }, baseOf());
    await open(page, '#/me', withServer());
    const nav = page.getByRole('navigation', { name: 'מידע משפטי' });
    for (const name of ['פרטיות', 'תקנון', 'נגישות', 'בטיחות', 'ביטול מנוי']) {
      const link = nav.getByRole('link', { name, exact: true });
      await expect(link).toBeVisible();
      expect((await link.boundingBox()).height, name).toBeGreaterThanOrEqual(44);
    }
    await nav.scrollIntoViewIfNeeded();
    await shot(page, 'me-footer');
    await nav.getByRole('link', { name: 'ביטול מנוי' }).click();
    await expect(page).toHaveURL(/#\/cancel$/);
    await expect(page.getByRole('heading', { name: 'ביטול מנוי' })).toBeVisible();
    // a copy without a server sells nothing: no cancel link there
    await open(page, '#/me', student());
    await expect(page.getByRole('navigation', { name: 'מידע משפטי' }).getByRole('link', { name: 'בטיחות' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'ביטול מנוי' })).toHaveCount(0);
  });

  test('the front page always links privacy, accessibility and safety; the cancel link and its note come with the paid tutor', async ({ page }) => {
    await open(page, '#/');
    let nav = page.getByRole('navigation', { name: 'מידע משפטי' });
    for (const name of ['פרטיות', 'נגישות', 'בטיחות']) await expect(nav.getByRole('link', { name, exact: true })).toBeVisible();
    for (const name of ['תקנון', 'ביטול מנוי', 'להורים']) await expect(page.getByRole('link', { name, exact: true })).toHaveCount(0);
    await nav.getByRole('link', { name: 'בטיחות' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'בטיחות בעוזר החכם' })).toBeVisible();
    await fakeServer(page, { parentOk: true }, baseOf());
    await open(page, '#/', withServer({ profile: null }));
    nav = page.getByRole('navigation', { name: 'להורים ומידע משפטי' });
    for (const name of ['להורים', 'ביטול מנוי', 'תקנון', 'פרטיות', 'נגישות', 'בטיחות']) await expect(nav.getByRole('link', { name, exact: true })).toBeVisible();
    const cancel = nav.getByRole('link', { name: 'ביטול מנוי' });
    await expect(cancel).toHaveAccessibleDescription('ביטול בשתי לחיצות, באתר, במייל או בטלפון');
    await expect(page.getByText('ביטול בשתי לחיצות, באתר, במייל או בטלפון')).toBeVisible();
    for (const b of ['מתחילים', 'אני מורה']) await expect(page.getByRole('button', { name: b })).toBeInViewport();
    await shot(page, 'welcome-legal');
  });

  test('the introduction links the safety statement: it closes, sends nothing, and comes again next time', async ({ page }) => {
    const { log } = await fakeServer(page, { parentOk: true }, baseOf());
    await open(page, '#/assistant', firstTime());
    const draft = page.getByLabel('ההודעה שלכם');
    await draft.fill('מה זה מספר שלילי?'); await draft.press('Enter');
    const intro = page.getByRole('dialog', { name: 'לפני שמתחילים עם העוזר החכם' });
    const more = intro.getByRole('link', { name: 'עוד על בטיחות ופרטיות' });
    expect((await more.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await more.click();
    await expect(page.getByRole('heading', { level: 1, name: 'בטיחות בעוזר החכם' })).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(chatCalls(log)).toHaveLength(0);
    await page.getByRole('button', { name: 'חזרה' }).click();
    await expect(page.getByLabel('ההודעה שלכם')).toBeVisible();
    await page.getByLabel('ההודעה שלכם').fill('שוב'); await page.getByLabel('ההודעה שלכם').press('Enter');
    await expect(intro).toBeVisible();
  });
});

test.describe('delete all', () => {
  test.skip(({ viewport }) => viewport.width > 800, 'phone layouts');
  // the council's repro (trust#56, council/trust/audit.json afterWipe): a dev build's key, the device id, the class
  // token, a family-device token and a parent's session were all still in localStorage after "delete all"
  const KEY = 'sk-ant-SYNTHETIC-TEST-KEY';
  const FD = `fd1.${'b'.repeat(64)}`;
  const DEVICE = 'c0ffee'.repeat(5) + 'c0';
  const PARENT = { token: 'd'.repeat(64), email: 'parent@example.com' };
  const repro = () => withServer({
    profile: { role: 'student', name: 'נועה', grade: '7', know: 1, classCode: 'K7Q2MD', className: 'ז׳3', token: 'stu_token_1', studentId: 's1' },
    ai: { mode: 'server', apiUrl: API, key: KEY, device: DEVICE, familyDevice: { token: FD, label: 'הטאבלט' }, introSeen: true },
  });
  const appKeys = (page) => page.evaluate(() => [...Object.keys(localStorage), ...Object.keys(sessionStorage)].filter((k) => k.startsWith('madregot')).sort());
  const storage = (page) => page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }));
  /** Settings of the repro's device, with the server's forget route under the test's control (`ctl.fail`, `ctl.hold`). */
  async function setUp(page, ctl = {}) {
    const server = await fakeServer(page, { parentOk: true, devices: [{ id: 'fd01', token: FD, label: 'הטאבלט' }], plan: livePlan() }, baseOf());
    const forgets = [];
    await page.route(`${API}/api/me/forget`, async (route) => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
      forgets.push(route.request().headers());
      if (ctl.hold) await ctl.hold;
      return route.fulfill({
        status: ctl.fail ? 500 : 200, contentType: 'application/json', headers: CORS,
        body: JSON.stringify(ctl.fail ? { error: 'server_error' } : { ok: true, student: true, familyDevice: true, device: true }),
      });
    });
    await open(page, '#/settings', repro());
    // the tutor's status answer is saved into the store (ai.lastTier): wait for it, so a "before" taken next is final
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('madregot') || '{}').state?.ai?.lastTier || null)).toBe('family');
    await page.evaluate((p) => {
      localStorage.setItem('madregot-parent', JSON.stringify(p));
      localStorage.setItem('madregot-staging', '{}');
      sessionStorage.setItem('madregot-checkout-family_month', 'checkout-key-0123456789');
    }, PARENT);
    return { ...server, forgets };
  }
  const wipeSheet = (page) => page.getByRole('dialog', { name: 'למחוק הכול?' });

  test('the council\'s repro: the key, the device id, the tokens and the parent\'s address are gone, here and on the server', async ({ page }) => {
    const s = await setUp(page);
    expect(await appKeys(page)).toEqual(expect.arrayContaining(['madregot', 'madregot-checkout-family_month', 'madregot-parent', 'madregot-staging']));
    expect(JSON.stringify(await storage(page))).toContain(KEY);
    await page.getByRole('button', { name: 'מחיקת כל הנתונים' }).click();
    const sheet = wipeSheet(page);
    await expect(sheet).toContainText('נמחק את כל מה שנשמר במכשיר הזה, וגם את מה שנשמר עליכם בשרת של הכיתה: השם, ההתקדמות, הבקשות למורה והמבחנים. המורה כבר לא יראה אתכם ברשימה.');
    await expect(sheet).toContainText('המכשיר גם ינותק מהמנוי המשפחתי, וההורים יקבלו על זה מייל. אי אפשר לבטל.');
    for (const b of await sheet.getByRole('button').all()) expect((await b.boundingBox()).height).toBeGreaterThanOrEqual(44);
    // both answers in view, at 320x568 too
    for (const name of ['לא למחוק', 'כן, למחוק הכול']) await expect(sheet.getByRole('button', { name })).toBeInViewport();
    await shot(page, 'wipe-ask');
    await sheet.getByRole('button', { name: 'כן, למחוק הכול' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'כל הנתונים נמחקו מהמכשיר הזה ומהשרת.' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'מתחילים', exact: true })).toBeVisible();
    // the server got every identity in one call, and the parent's session was ended there
    expect(s.forgets).toHaveLength(1);
    expect(s.forgets[0]).toMatchObject({ authorization: 'Bearer stu_token_1', 'x-family-device': FD, 'x-device': DEVICE });
    expect(s.log.find((r) => r.path === '/api/account/signout')?.headers['x-account-token']).toBe(PARENT.token);
    // and nothing is left on the device
    expect(await appKeys(page)).toEqual([]);
    const left = JSON.stringify(await storage(page)) + await page.content();
    for (const v of [KEY, DEVICE, FD, 'stu_token_1', PARENT.token, 'parent@example.com']) expect(left).not.toContain(v);
    await expect(page).not.toHaveURL(/wiped/);
    await shot(page, 'wipe-done');
  });

  test('a 500 deletes nothing and says why; "לנסות שוב" waits ("מוחקים…"), then deletes everything', async ({ page }) => {
    const ctl = { fail: true };
    const s = await setUp(page, ctl);
    const before = await storage(page);
    await page.getByRole('button', { name: 'מחיקת כל הנתונים' }).click();
    const sheet = wipeSheet(page);
    await sheet.getByRole('button', { name: 'כן, למחוק הכול' }).click();
    await expect(sheet.getByRole('alert')).toHaveText('לא הצלחנו למחוק מהשרת, ולכן עוד לא מחקנו כלום. בדקו את החיבור לאינטרנט ונסו שוב.');
    expect(await storage(page)).toEqual(before);
    expect(s.log.filter((r) => r.path === '/api/account/signout')).toHaveLength(0);
    await shot(page, 'wipe-failed');
    let release;
    Object.assign(ctl, { fail: false, hold: new Promise((r) => { release = r; }) });
    await sheet.getByRole('button', { name: 'לנסות שוב' }).click();
    await expect(sheet.getByRole('button', { name: 'מוחקים…' })).toBeDisabled();
    await expect(sheet.getByRole('button', { name: 'למחוק רק מהמכשיר' })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(sheet).toBeVisible(); // it cannot be closed while it works
    release();
    await expect(page.getByRole('status').filter({ hasText: 'כל הנתונים נמחקו מהמכשיר הזה ומהשרת.' })).toBeVisible();
    expect(s.forgets).toHaveLength(2);
    expect(await appKeys(page)).toEqual([]);
  });

  test('when the server stays down, "למחוק רק מהמכשיר" asks once more, says what stays on the server, and clears the device', async ({ page }) => {
    const s = await setUp(page, { fail: true });
    await page.getByRole('button', { name: 'מחיקת כל הנתונים' }).click();
    await wipeSheet(page).getByRole('button', { name: 'כן, למחוק הכול' }).click();
    await wipeSheet(page).getByRole('button', { name: 'למחוק רק מהמכשיר' }).click();
    const second = page.getByRole('dialog', { name: 'למחוק רק מהמכשיר?' });
    await expect(second).toContainText('המידע בשרת של הכיתה יישאר עד שהמורה ימחק אותו, או עד שיימחק מעצמו אחרי 400 יום.');
    await shot(page, 'wipe-device-only');
    // the safe answer is the big one
    await second.getByRole('button', { name: 'לא למחוק' }).click();
    await expect(second).toHaveCount(0);
    expect(await appKeys(page)).toEqual(expect.arrayContaining(['madregot', 'madregot-parent']));
    await page.getByRole('button', { name: 'מחיקת כל הנתונים' }).click();
    await wipeSheet(page).getByRole('button', { name: 'כן, למחוק הכול' }).click();
    await wipeSheet(page).getByRole('button', { name: 'למחוק רק מהמכשיר' }).click();
    await page.getByRole('dialog', { name: 'למחוק רק מהמכשיר?' }).getByRole('button', { name: 'כן, למחוק רק מהמכשיר' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'כל הנתונים נמחקו מהמכשיר הזה.' })).toBeVisible();
    await expect(page.getByText('ומהשרת')).toHaveCount(0);
    expect(s.forgets).toHaveLength(2);
    expect(await appKeys(page)).toEqual([]);
    await shot(page, 'wipe-done-device');
  });
});

test.describe('photo', () => {
  test.skip(({ viewport }) => viewport.width > 800, 'phone layouts');
  // a device with the family plan, where the exam check and the photo check are open (trust spec TRUST-5)
  const FD = `fd1.${'c'.repeat(64)}`;
  const family = () => withServer({ ai: { mode: 'server', apiUrl: API, key: '', device: '', introSeen: true, familyDevice: { token: FD, label: 'הטאבלט' } } });
  async function setUp(page) {
    const server = await fakeServer(page, { parentOk: true }, baseOf());
    server.st.devices.push({ id: 'd1', label: 'הטאבלט', token: FD }); server.st.plan = livePlan();
    return server;
  }
  /** A synthetic 1200×1600 exam page drawn in the page itself: the top 10% red (where a name and an ID would be). */
  const examPng = async (page, { red = true } = {}) => Buffer.from(await page.evaluate((r) => {
    const c = document.createElement('canvas'); c.width = 1200; c.height = 1600;
    const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, 1200, 1600);
    if (r) { x.fillStyle = '#ff0000'; x.fillRect(0, 0, 1200, 160); }
    x.fillStyle = '#222'; x.font = '48px sans-serif';
    for (let i = 0; i < 10; i += 1) x.fillText(`${i + 1})  3x + ${i} = ${3 * (i + 2) + i}`, 80, 320 + i * 110);
    return c.toDataURL('image/png').split(',')[1];
  }, red), 'base64');
  /** The page as the server got it, drawn into a canvas inside the page: its size and the colour of some pixels. */
  const sentPixels = (page, src, points) => page.evaluate(async ([s, pts]) => {
    const img = new Image(); img.src = s; await img.decode();
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    return { width: c.width, height: c.height, px: pts.map(([px, py]) => [...x.getImageData(px, py, 1, 1).data].slice(0, 3)) };
  }, [src, points]);
  const prepSheet = (page) => page.getByRole('dialog', { name: 'מסתירים פרטים אישיים' });
  const warnSheet = (page) => page.getByRole('dialog', { name: 'לפני שמצלמים' });

  test('exam: the warning comes first, page 1 loses its top band on the device, and the header pixel sent is not red', async ({ page }) => {
    const { log } = await setUp(page);
    await open(page, '#/exams/check', family());
    // the camera takes photos; the picker a picture or a PDF (PKG-2), whose pages go through the same step
    await expect(page.locator('input[type=file][capture]')).toHaveAttribute('accept', 'image/*');
    await expect(page.locator('input[type=file]:not([capture])')).toHaveAttribute('accept', 'image/*,application/pdf');
    await expect(page.getByRole('button', { name: 'תמונה או PDF' })).toBeVisible();
    await expect(page.getByText('לתמונה טובה: אור טוב, הדף שטוח וכולו בתמונה. בלי שם ובלי תעודת זהות.')).toBeVisible();
    // "צילום דף" opens the warning, never the camera
    let choosers = 0; page.on('filechooser', () => { choosers += 1; });
    await page.getByRole('button', { name: 'צילום דף' }).click();
    const warn = warnSheet(page);
    await expect(warn).toBeVisible();
    await expect(warn).toContainText('בדף של מבחן יש לפעמים שם, תעודת זהות, ציון, כיתה ובית ספר. את הפרטים האלה לא שולחים לעוזר.');
    await expect(warn).toContainText('התמונה נשלחת לעוזר החכם (Anthropic, בארה״ב) כדי לבדוק אותה, ולא נשמרת אצלנו.');
    expect(choosers).toBe(0);
    await shot(page, 'photo-warn');
    // its button opens the camera itself, in the same tap
    const camera = page.waitForEvent('filechooser');
    await warn.getByRole('button', { name: 'הבנתי, לצלם' }).click();
    const fc = await camera;
    expect(fc.isMultiple()).toBe(false);
    expect(await page.evaluate(() => sessionStorage.getItem('madregot-photo-warned'))).toBe('1');
    await fc.setFiles({ name: 'page1.png', mimeType: 'image/png', buffer: await examPng(page) });
    const prep = prepSheet(page);
    await expect(prep).toBeVisible();
    await expect(warn).toHaveCount(0);
    // page 1 of an exam: the top 15% is shaded and will not be sent
    const cut = prep.getByRole('slider', { name: 'כמה לחתוך מלמעלה' });
    await expect(cut).toHaveAttribute('aria-valuenow', '15');
    await expect(prep.getByText('השורה הזו לא תישלח')).toBeVisible();
    // the whole page is on the screen, nothing to scroll
    const frame = await prep.locator('.prep-frame').boundingBox();
    const vp = page.viewportSize();
    expect(frame.y).toBeGreaterThanOrEqual(0);
    expect(frame.y + frame.height).toBeLessThanOrEqual(vp.height);
    expect(frame.width / frame.height).toBeCloseTo(1200 / 1600, 1);
    await shot(page, 'photo-prep');
    // the keyboard: the line moves with the arrows, a box is added, moved and resized
    await cut.focus(); await page.keyboard.press('ArrowDown');
    await expect(cut).toHaveAttribute('aria-valuenow', '16');
    await page.keyboard.press('ArrowUp');
    await expect(cut).toHaveAttribute('aria-valuenow', '15');
    await prep.getByRole('button', { name: 'הוספת מלבן' }).click();
    const box = prep.getByRole('button', { name: 'מלבן שחור 1' });
    await expect(box).toBeFocused();
    const b0 = await box.boundingBox();
    await page.keyboard.press('ArrowDown');
    await expect.poll(async () => (await box.boundingBox()).y).toBeGreaterThan(b0.y);
    await page.keyboard.press('Shift+ArrowRight');
    await expect.poll(async () => (await box.boundingBox()).width).toBeGreaterThan(b0.width);
    await shot(page, 'photo-prep-box');
    // undo takes the last box away; one more box for the request
    await prep.getByRole('button', { name: 'ביטול האחרון' }).click();
    await expect(box).toHaveCount(0);
    await expect(prep.getByRole('button', { name: 'ביטול האחרון' })).toBeDisabled();
    await prep.getByRole('button', { name: 'הוספת מלבן' }).click();
    await prep.getByRole('button', { name: 'סיימתי, אין בדף פרטים אישיים' }).click();
    await expect(prep).toHaveCount(0);
    await expect(page.getByRole('img', { name: 'דף 1' })).toBeVisible();
    // the second photo of the session: no warning, the picker at once, and no cut on page 2
    const picker = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'תמונה או PDF' }).click();
    const fc2 = await picker;
    expect(fc2.isMultiple()).toBe(true);
    await expect(warnSheet(page)).toHaveCount(0);
    await fc2.setFiles({ name: 'page2.png', mimeType: 'image/png', buffer: await examPng(page, { red: false }) });
    await expect(prep.getByRole('slider', { name: 'כמה לחתוך מלמעלה' })).toHaveAttribute('aria-valuenow', '0');
    await expect(prep.getByText('השורה הזו לא תישלח')).toHaveCount(0);
    await prep.getByRole('button', { name: 'סיימתי, אין בדף פרטים אישיים' }).click();
    await expect(page.getByRole('img', { name: 'דף 2' })).toBeVisible();
    await shot(page, 'photo-pages');

    await page.getByRole('button', { name: 'בדיקת המבחן' }).click();
    await expect.poll(() => log.filter((r) => r.path === '/api/ai/exam').length).toBe(1);
    const sent = log.find((r) => r.path === '/api/ai/exam').body;
    expect(JSON.stringify(sent)).not.toContain('application/pdf');
    expect(sent.pages.map((p) => p.mediaType)).toEqual(['image/jpeg', 'image/jpeg']);
    expect(sent.prep).toEqual({ crop: true, boxes: 1 });
    // page 1 as sent: 15% shorter, pixel (10,10) is not the red header, and the box is solid black
    const one = await sentPixels(page, sent.pages[0].data, [[10, 10], [600, 680]]);
    expect([one.width, one.height]).toEqual([1200, 1360]);
    const [r, g] = one.px[0];
    expect(r < 200 || g > 80, `pixel (10,10) is ${one.px[0]}`).toBe(true);
    expect(Math.max(...one.px[1]), `the box is ${one.px[1]}`).toBeLessThan(40);
    // page 2 as sent: the whole page
    const two = await sentPixels(page, sent.pages[1].data, [[10, 10]]);
    expect([two.width, two.height]).toEqual([1200, 1600]);
  });

  test('notebook photo: the warning first, then the step with no cut; the check sends only the prepared picture', async ({ page }) => {
    const { log } = await setUp(page);
    await open(page, '#/assistant', family());
    await page.getByRole('button', { name: 'בדיקת פתרון מצולם' }).click();
    const sheet = page.getByRole('dialog', { name: 'בדיקת פתרון מצולם' });
    await sheet.getByRole('button', { name: 'צילום הדף' }).click();
    const warn = warnSheet(page);
    await expect(warn).toBeVisible();
    // closing the warning opens nothing, and it comes again
    await page.keyboard.press('Escape');
    await expect(warn).toHaveCount(0);
    await expect(sheet).toBeVisible();
    await sheet.getByRole('button', { name: 'צילום הדף' }).click();
    const camera = page.waitForEvent('filechooser');
    await warnSheet(page).getByRole('button', { name: 'הבנתי, לצלם' }).click();
    await (await camera).setFiles({ name: 'work.png', mimeType: 'image/png', buffer: await examPng(page) });
    const prep = prepSheet(page);
    await expect(prep.getByRole('slider', { name: 'כמה לחתוך מלמעלה' })).toHaveAttribute('aria-valuenow', '0');
    await expect(prep.getByText('השורה הזו לא תישלח')).toHaveCount(0);
    await shot(page, 'photo-check-prep');
    // "השחרה" draws a box with a drag
    await prep.getByRole('button', { name: 'השחרה' }).click();
    await expect(prep.getByRole('button', { name: 'השחרה' })).toHaveAttribute('aria-pressed', 'true');
    await expect(prep.getByText('גררו על הדף כדי להשחיר.')).toBeVisible();
    const f = await prep.locator('.prep-frame').boundingBox();
    await page.mouse.move(f.x + f.width * 0.05, f.y + f.height * 0.01);
    await page.mouse.down();
    await page.mouse.move(f.x + f.width * 0.6, f.y + f.height * 0.08, { steps: 5 });
    await page.mouse.up();
    await expect(prep.getByRole('button', { name: 'מלבן שחור 1' })).toBeVisible();
    await prep.getByRole('button', { name: 'סיימתי, אין בדף פרטים אישיים' }).click();
    await expect(sheet.getByRole('img', { name: 'התמונה שבחרתם' })).toBeVisible();
    await shot(page, 'photo-check-picked');
    await sheet.getByRole('button', { name: 'בדיקת הפתרון' }).click();
    await expect(sheet.getByText('התשובה הסופית נכונה.')).toBeVisible();
    const sent = log.find((r) => r.path === '/api/ai/check').body;
    expect(sent.prep).toEqual({ crop: false, boxes: 1 });
    expect(sent.image).toMatch(/^data:image\/jpeg;base64,/);
    // the whole page, and the red where the box was drawn is black now
    const px = await sentPixels(page, sent.image, [[300, 60]]);
    expect([px.width, px.height]).toEqual([1200, 1600]);
    expect(Math.max(...px.px[0]), `pixel ${px.px[0]}`).toBeLessThan(40);
  });

  // ---- PDFs (PKG-2): drawn on the device page by page (lib/pdfPages.js), each page through the same step as a photo.
  // The fixtures are synthetic (scripts/make-pdf-fixture.mjs): 2 A4 pages, a red band across the top of page 1.
  const PDF = fileURLToPath(new URL('./fixtures/exam-2-pages.pdf', import.meta.url));
  const BROKEN = fileURLToPath(new URL('./fixtures/broken.pdf', import.meta.url));
  const PDF_FAILED = 'לא הצלחנו לפתוח את ה־PDF. אפשר לצלם את הדפים במקום.';
  /** pdf.js's chunk is held until release(), so the "opening" line can be seen. */
  async function holdPdfEngine(page) {
    let release; const held = new Promise((r) => { release = r; });
    await page.route(/\/assets\/pdf-[\w-]+\.js$/, async (route) => { await held; await route.continue(); });
    return release;
  }
  /** Choose a file with "תמונה או PDF"; `warn`: the warning comes first (the first time in the session). */
  async function choose(page, scope, file, { warn = false } = {}) {
    const chooser = page.waitForEvent('filechooser');
    await scope.getByRole('button', { name: 'תמונה או PDF' }).click();
    if (warn) await warnSheet(page).getByRole('button', { name: 'הבנתי, לצלם' }).click();
    else await expect(warnSheet(page)).toHaveCount(0);
    const fc = await chooser;
    await fc.setFiles(file);
    return fc;
  }

  test('exam with a PDF: opened on the device, page 1 loses its band, page 2 is whole, and only 2 JPEG pages are sent', async ({ page }) => {
    const { log } = await setUp(page);
    const requests = [];
    page.on('request', (r) => requests.push(r.url()));
    await open(page, '#/exams/check', family());
    await shot(page, 'pdf-exam-start');
    // pdf.js is not loaded with the screen
    expect(requests.filter((u) => /\/assets\/pdf[-.]/.test(u))).toEqual([]);
    const release = await holdPdfEngine(page);
    const from = requests.length;
    const fc = await choose(page, page, PDF, { warn: true });
    expect(fc.isMultiple()).toBe(true);
    // the opening line, said to a screen reader too; nothing else can be added meanwhile
    const status = page.getByRole('status').filter({ hasText: 'פותחים את ה־PDF…' });
    await expect(status).toBeVisible();
    await expect(page.getByRole('button', { name: 'תמונה או PDF' })).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByRole('button', { name: 'בדיקת המבחן' })).toBeDisabled();
    await shot(page, 'pdf-opening');
    release();
    // page 1 of the PDF: the step opens with the top 15% shaded, the whole page on the screen
    const prep = prepSheet(page);
    await expect(prep).toBeVisible();
    await expect(prep.getByRole('slider', { name: 'כמה לחתוך מלמעלה' })).toHaveAttribute('aria-valuenow', '15');
    await expect(prep.getByText('השורה הזו לא תישלח')).toBeVisible();
    const frame = await prep.locator('.prep-frame').boundingBox();
    expect(frame.width / frame.height).toBeCloseTo(595 / 842, 1);
    expect(frame.y + frame.height).toBeLessThanOrEqual(page.viewportSize().height);
    await expect(status).toHaveCount(0);
    await shot(page, 'pdf-prep-page1');
    // everything the PDF needed came from the app itself: pdf.js, its worker, nothing from anywhere else
    const opened = requests.slice(from);
    expect(opened.some((u) => /\/assets\/pdf-[\w-]+\.js$/.test(u))).toBe(true);
    expect(opened.some((u) => /\/assets\/pdf\.worker\.min-[\w-]+\.mjs$/.test(u))).toBe(true);
    // (the app's own server, faked here, may be asked about the plan meanwhile; nothing goes anywhere else)
    expect(opened.filter((u) => ![baseOf(), API, 'blob:', 'data:'].some((ok) => u.startsWith(ok)))).toEqual([]);
    await prep.getByRole('button', { name: 'סיימתי, אין בדף פרטים אישיים' }).click();
    // page 2: no cut
    await expect(prep.getByRole('slider', { name: 'כמה לחתוך מלמעלה' })).toHaveAttribute('aria-valuenow', '0');
    await expect(prep.getByText('השורה הזו לא תישלח')).toHaveCount(0);
    await shot(page, 'pdf-prep-page2');
    await prep.getByRole('button', { name: 'סיימתי, אין בדף פרטים אישיים' }).click();
    await expect(prep).toHaveCount(0);
    await expect(page.getByRole('img', { name: 'דף 1' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'דף 2' })).toBeVisible();
    await shot(page, 'pdf-pages');

    await page.getByRole('button', { name: 'בדיקת המבחן' }).click();
    await expect.poll(() => log.filter((r) => r.path === '/api/ai/exam').length).toBe(1);
    const sent = log.find((r) => r.path === '/api/ai/exam').body;
    expect(JSON.stringify(sent)).not.toContain('application/pdf');
    expect(JSON.stringify(sent)).not.toContain('JVBERi'); // "%PDF" in base64: no PDF bytes either
    expect(sent.pages.map((p) => p.mediaType)).toEqual(['image/jpeg', 'image/jpeg']);
    for (const p of sent.pages) expect(p.data).toMatch(/^data:image\/jpeg;base64,/);
    expect(sent.prep).toEqual({ crop: true, boxes: 0 });
    // page 1 as sent: drawn at 1272 x 1800, then 15% cut off the top; pixel (10,10) is not the red band
    const one = await sentPixels(page, sent.pages[0].data, [[10, 10]]);
    expect(Math.max(one.width, one.height)).toBeLessThanOrEqual(1800);
    expect([one.width, one.height]).toEqual([1272, 1530]);
    const [r, g] = one.px[0];
    expect(r < 200 || g > 80, `pixel (10,10) is ${one.px[0]}`).toBe(true);
    const two = await sentPixels(page, sent.pages[1].data, [[10, 10]]);
    expect([two.width, two.height]).toEqual([1272, 1800]);
  });

  test('exam with a PDF: "צילום מחדש" on a PDF page drops that page and opens the picker; a broken PDF says so calmly', async ({ page }) => {
    await setUp(page);
    await open(page, '#/exams/check', family());
    await choose(page, page, BROKEN, { warn: true });
    await expect(page.getByText(PDF_FAILED, { exact: true })).toBeVisible();
    await expect(prepSheet(page)).toHaveCount(0);
    await expect(page.getByRole('img', { name: 'דף 1' })).toHaveCount(0);
    await shot(page, 'pdf-broken');
    // the PDF: page 1 is open; "צילום מחדש" drops it and opens the picker (pictures or a PDF) in the same tap
    await choose(page, page, PDF);
    const prep = prepSheet(page);
    await expect(prep.getByRole('slider', { name: 'כמה לחתוך מלמעלה' })).toHaveAttribute('aria-valuenow', '15');
    const picker = page.waitForEvent('filechooser');
    await prep.getByRole('button', { name: 'צילום מחדש' }).click();
    const fc = await picker;
    expect(fc.isMultiple()).toBe(true);
    expect(await fc.element().getAttribute('accept')).toBe('image/*,application/pdf');
    // the PDF's page 2 is next, and with page 1 gone it is the exam's first page now: its top band is cut
    await fc.setFiles({ name: 'page1-photo.png', mimeType: 'image/png', buffer: await examPng(page) });
    await expect(prep.getByRole('slider', { name: 'כמה לחתוך מלמעלה' })).toHaveAttribute('aria-valuenow', '15');
    await prep.getByRole('button', { name: 'סיימתי, אין בדף פרטים אישיים' }).click();
    // then the photo that replaced page 1
    await expect(prep.getByRole('slider', { name: 'כמה לחתוך מלמעלה' })).toHaveAttribute('aria-valuenow', '0');
    await prep.getByRole('button', { name: 'סיימתי, אין בדף פרטים אישיים' }).click();
    await expect(prep).toHaveCount(0);
    await expect(page.getByRole('img', { name: 'דף 2' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'דף 3' })).toHaveCount(0);
  });

  test('notebook photo with a PDF: its first page goes through the step, one JPEG is sent, and a longer PDF says only page 1 is checked', async ({ page }) => {
    const { log } = await setUp(page);
    await open(page, '#/assistant', family());
    await page.getByRole('button', { name: 'בדיקת פתרון מצולם' }).click();
    const sheet = page.getByRole('dialog', { name: 'בדיקת פתרון מצולם' });
    // the camera stays a camera; the picker takes a picture or a PDF
    await expect(sheet.locator('input[type=file][capture="environment"]')).toHaveAttribute('accept', 'image/*');
    await expect(sheet.locator('input[type=file]:not([capture])')).toHaveAttribute('accept', 'image/*,application/pdf');
    await shot(page, 'pdf-photo-check-start');
    const fc = await choose(page, sheet, PDF, { warn: true });
    expect(fc.isMultiple()).toBe(false);
    const prep = prepSheet(page);
    await expect(prep.getByRole('slider', { name: 'כמה לחתוך מלמעלה' })).toHaveAttribute('aria-valuenow', '0');
    await shot(page, 'pdf-photo-check-prep');
    await prep.getByRole('button', { name: 'סיימתי, אין בדף פרטים אישיים' }).click();
    await expect(sheet.getByRole('img', { name: 'התמונה שבחרתם' })).toBeVisible();
    await expect(sheet.getByRole('status').filter({ hasText: 'ב־PDF' })).toHaveText('ב־PDF יש 2 דפים. כאן בודקים דף אחד: את הדף הראשון.');
    await shot(page, 'pdf-photo-check-picked');
    await sheet.getByRole('button', { name: 'בדיקת הפתרון' }).click();
    await expect(sheet.getByText('התשובה הסופית נכונה.')).toBeVisible();
    const calls = log.filter((r) => r.path === '/api/ai/check');
    expect(calls).toHaveLength(1);
    const sent = calls[0].body;
    expect(JSON.stringify(sent)).not.toContain('application/pdf');
    expect(sent.mediaType).toBe('image/jpeg');
    expect(sent.image).toMatch(/^data:image\/jpeg;base64,/);
    expect(sent.prep).toEqual({ crop: false, boxes: 0 });
    const px = await sentPixels(page, sent.image, [[10, 400]]);
    expect([px.width, px.height]).toEqual([1272, 1800]);
    // a broken PDF: the same calm words, inline, and nothing opens
    await choose(page, sheet, BROKEN);
    await expect(sheet.getByRole('alert')).toHaveText(PDF_FAILED);
    await expect(prep).toHaveCount(0);
  });
});

test.describe('privacy lines', () => {
  // trust spec TRUST-1 §5: every line in the app about what is kept says it truly, beside the moment it is collected,
  // and points to the privacy notice (or, for the tutor, the safety statement) without losing what was typed
  test.skip(({ viewport }) => viewport.width > 800, 'phone layouts');
  const OLD = 'שומרים רק את כתובת המייל';

  test('the name step says where the name stays; the class step says what joining keeps, and "מה נשמר ולמה" opens the notice in a new tab', async ({ page }) => {
    await fakeServer(page.context(), { parentOk: true }, baseOf());
    const fresh = withServer(); fresh.state.profile = null;
    await open(page, '#/', fresh);
    await page.getByRole('button', { name: 'מתחילים' }).click();
    const name = page.getByLabel('השם שלכם');
    await expect(name).toHaveAccessibleDescription('השם נשמר רק במכשיר הזה, אלא אם תצטרפו לכיתה. אפשר גם כינוי.');
    await expect(page.getByText('השם נשמר רק במכשיר הזה')).toBeVisible();
    await shot(page, 'privacy-name');
    await name.fill('נועה');
    const next = page.getByRole('button', { name: 'המשך', exact: true });
    await next.click();
    await page.getByRole('radio', { name: /כיתה ז׳/ }).click(); await next.click();
    await page.getByRole('radio').first().click(); await next.click();
    await next.click(); // the daily goal keeps its default
    await expect(page.getByText('יש לכם קוד כיתה מהמורה?')).toBeVisible();
    await expect(page.getByText('השם שלכם והתשובות בתרגול יישמרו בשרת של מדרגות, והמורה יראה אותם. אפשר למחוק אותם בכל רגע בהגדרות')).toBeVisible();
    await page.getByLabel('קוד כיתה').fill('K7Q2MD');
    await shot(page, 'privacy-class-step');
    const more = page.getByRole('link', { name: /מה נשמר ולמה/ });
    await expect(more).toHaveAttribute('target', '_blank');
    const [tab] = await Promise.all([page.waitForEvent('popup'), more.click()]);
    await expect(tab).toHaveURL(/#\/privacy$/);
    await expect(tab.getByRole('heading', { level: 1, name: 'מדיניות פרטיות' })).toBeVisible();
    await tab.close();
    // the step and what was typed are still there
    await expect(page.getByLabel('קוד כיתה')).toHaveValue('K7Q2MD');
    await expect(page.getByText('יש לכם קוד כיתה מהמורה?')).toBeVisible();
  });

  test('the parents\' page says what is kept, never "only the email", and the email form says where the address goes', async ({ page }) => {
    await fakeServer(page, { parentOk: true }, baseOf());
    await open(page, '#/parents', withServer({ profile: null }));
    // one merged text with the parents lane's PARENTS-9 sentences (Parents.jsx ABOUT_DATA, reportCopy.test.js): the
    // child's summary and progress copy, and what the child writes to the tutor goes to Anthropic in the US
    const about = page.getByText(/^מה נשמר אצלנו: כתובת המייל שלכם, פרטי המנוי והתשלומים \(בלי פרטי כרטיס\),? והמכשירים שחיברתם\./);
    await expect(about).toBeVisible();
    await expect(about).toContainText('לעוזר נשלח ל־Anthropic בארה״ב כדי לקבל תשובה.');
    await expect(about.getByRole('link', { name: 'כל הפרטים במדיניות הפרטיות' })).toHaveAttribute('href', /#\/privacy$/);
    await expect(page.locator('body')).not.toContainText(OLD);
    const form = page.getByRole('region', { name: 'כניסה עם המייל' }).or(page.locator('section[aria-labelledby="signin-title"]'));
    await expect(form.getByText('המייל משמש לכניסה, לאישורים, לקבלות ולהודעות על המנוי. הוא עובר לשירות שליחת המיילים Resend (בארה״ב) ולחברת הסליקה.')).toBeVisible();
    const link = form.getByRole('link', { name: /מדיניות הפרטיות/ });
    await expect(link).toHaveAttribute('href', /#\/privacy$/);
    await expect(link).toHaveAttribute('target', '_blank');
    await about.scrollIntoViewIfNeeded();
    await shot(page, 'privacy-parents');
    await link.scrollIntoViewIfNeeded();
    await shot(page, 'privacy-email-note');
  });

  test('the tutor says who answers and where it goes; Settings opens the three pages; a class student\'s numbers say where they go', async ({ page }) => {
    await fakeServer(page, { parentOk: true }, baseOf());
    await open(page, '#/assistant', withServer());
    const note = page.locator('.assistant-note');
    await expect(note).toContainText('העוזר הוא Claude של Anthropic, תוכנה ולא אדם. מה שכותבים כאן נשלח ל־Anthropic בארה״ב ולא נשמר אצלנו.');
    const safety = note.getByRole('link', { name: /בטיחות ופרטיות/ });
    await expect(safety).toHaveAttribute('href', /#\/safety$/);
    await expect(safety).toHaveAttribute('target', '_blank');
    await shot(page, 'privacy-assistant');

    await open(page, '#/settings', student());
    const group = page.locator('section[aria-labelledby="safe-title"]');
    for (const [row, title] of [['מדיניות הפרטיות', 'מדיניות פרטיות'], ['בטיחות בעוזר החכם', 'בטיחות בעוזר החכם'], ['הצהרת נגישות', 'הצהרת נגישות']]) {
      const link = group.getByRole('link', { name: row });
      await link.scrollIntoViewIfNeeded();
      expect((await link.boundingBox()).height, row).toBeGreaterThanOrEqual(44);
      await link.click();
      await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
      await page.goBack();
      await expect(group.getByRole('link', { name: row })).toBeVisible();
    }

    await open(page, '#/me', classStudent());
    await expect(page.getByText('המספרים האלה מחושבים במכשיר הזה. אתם בכיתה, ולכן כל תשובה בתרגול נשלחת גם ללוח של המורה.')).toBeAttached();
    await expect(page.getByText('המספרים נשמרים רק במכשיר הזה')).toHaveCount(0);
    // outside a class: the durable lane's one sentence for where the progress lives (lib/durable/copy.js whereSavedText)
    await open(page, '#/me', student());
    await expect(page.locator('.nums-where')).toContainText('ההתקדמות נשמרת');
    await expect(page.locator('.nums-where')).toContainText('במכשיר הזה');
    await expect(page.locator('.nums-where')).not.toContainText('ללוח של המורה');
  });

  test('the help sheet says where the request is kept; a new teacher is told who sees the name, and the example is a family name', async ({ page }) => {
    await fakeServer(page, { parentOk: true }, baseOf());
    await open(page, '#/lesson/signed/1', classStudent());
    await page.getByRole('button', { name: 'למורה' }).click();
    const sheet = page.getByRole('dialog', { name: 'לבקש עזרה מהמורה' });
    await expect(sheet.getByLabel('מה לא ברור? (לא חובה)')).toHaveAccessibleDescription(/^הבקשה נשמרת בשרת של הכיתה\./);
    await shot(page, 'privacy-help');

    const fresh = withServer(); fresh.state.profile = null;
    await open(page, '#/', fresh);
    // the school lane's way in (screens/teacher/TeacherStart.jsx): a new class, the teacher's email, then the details
    await page.getByRole('button', { name: 'אני מורה', exact: true }).click();
    await expect(page.getByRole('radio', { name: /פתיחת כיתה חדשה/ })).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('button', { name: 'המשך', exact: true }).click();
    await page.getByLabel('כתובת המייל שלכם').fill('teacher@example.test');
    await page.getByRole('button', { name: 'שליחת קוד' }).click();
    await page.getByLabel('הקוד מהמייל').fill('123456');
    const name = page.getByLabel('השם שלכם (כך התלמידים יראו אותו)');
    await expect(name).toHaveAttribute('placeholder', 'למשל: המורה כהן');
    await expect(name).toHaveAccessibleDescription('השם יופיע לתלמידים שמצטרפים עם קוד הכיתה. אפשר לכתוב רק שם משפחה, למשל \'המורה כהן\'.');
    await shot(page, 'privacy-teacher');
  });
});

test.describe('accessibility statement', () => {
  // trust spec TRUST-2, Appendix C: accessibility.md says only what a check backs. Every line under "מה הותאם" maps to
  // a check here and runs on every screen its "מה בדקנו" names; a line with no check fails the first test, so a new
  // claim either gets a check or goes under "מה עוד לא נגיש". The owner's own pass with a screen reader is separate
  // (ACCESS_TESTED, TRUST-13 step 4).
  test.skip(({ viewport }) => viewport.width > 800, 'phone layouts');
  const md = readFileSync(new URL('../src/content/legal/accessibility.md', import.meta.url), 'utf8');
  const section = (id) => md.split(/^## /m).find((s) => s.includes(`{#${id}}`)) || '';
  const bullets = (id) => section(id).split('\n').filter((l) => l.startsWith('- ')).map((l) => l.slice(2).trim());
  const SCREENS = [
    ['מסך הפתיחה', '#/', null], ['המסך הראשי', '#/', livedIn('7')], ['שיעור ותרגול', '#/lesson/signed/1', student('7')],
    ['העוזר החכם', '#/assistant', livedIn('7')], ['ההגדרות', '#/settings', livedIn('7')], ['המסך "אני"', '#/me', livedIn('7')],
    ['הנושאים', '#/topics', livedIn('8')], ['המשימות', '#/quests', livedIn('7')], ['המבחנים', '#/exams', livedIn('7')],
    ['הכניסה לעמוד ההורים', '#/parents', null], ['ביטול המנוי', '#/cancel', null],
    ['התקנון', '#/terms', null], ['הפרטיות', '#/privacy', null], ['הנגישות', '#/accessibility', null], ['הבטיחות', '#/safety', null],
  ];
  // each line of "מה הותאם", word for word, and the check that backs it: a check run on every screen, or a test below
  const CLAIMS = {
    'השפה של הדף מוגדרת כעברית, וכיוון הכתיבה מימין לשמאל.': 'lang',
    'לכל כפתור, קישור ושדה יש שם שקוראי מסך מקריאים.': 'names',
    'אפשר להגיע לכל כפתור, קישור ושדה במקלדת (במקש Tab), ורואים מסגרת סביב מה שנבחר.': 'keyboard',
    'משוב על תשובה בתרגול מוקרא בקורא מסך מיד.': 'feedback',
    'לכל תרגיל עם גרירה (ציר מספרים, נקודות, קווים, זוויות ועוד) יש גם כפתורים שמזיזים בלי לגרור.': 'drag',
    'הניגודיות בין הטקסט לרקע עומדת בתקן: לפחות 4.5 ל־1, ובטקסט גדול לפחות 3 ל־1.': 'contrast',
    'המסכים מתאימים לטלפון ברוחב 320 פיקסלים, בלי גלילה הצידה.': 'narrow',
    'כשמבקשים ממערכת ההפעלה להפחית תנועה, שום דבר לא קופץ, מחליק או חוזר על עצמו. נשארות רק הופעות רכות.': 'motion',
  };
  const PER_SCREEN = ['lang', 'names', 'keyboard', 'contrast', 'narrow'];
  const claimOf = (id) => Object.keys(CLAIMS).find((k) => CLAIMS[k] === id);

  test('every line under "מה הותאם" has its check, and "מה בדקנו" names every screen the checks visit', () => {
    expect(bullets('done').sort()).toEqual(Object.keys(CLAIMS).sort());
    const tested = section('tested');
    for (const [label] of SCREENS) expect(tested, label).toContain(label);
    // the owner's pass is the owner's words, never ours
    expect(tested).toContain('{{ACCESS_TESTED}}');
  });

  /** A role with no name in the accessibility tree: "- button" or "- link [disabled]", with no quoted name. */
  const NAMELESS = /^\s*- (button|link|textbox|checkbox|radio|combobox|switch|slider|spinbutton|searchbox|tab|menuitem)(?=\s*(?::|\[|$))/;

  for (const [label, route, state] of SCREENS) {
    test(`on ${label}: language, names, keyboard, contrast and 320px`, async ({ page }) => {
      await open(page, route, state);
      // the screen itself, not the loading line its code shows while it arrives
      await expect(page.locator('.loading-state')).toHaveCount(0);
      await expect(page.locator('h1, h2').first()).toBeVisible();
      await page.waitForTimeout(200);

      const [lang, dir] = await page.evaluate(() => [document.documentElement.lang, document.documentElement.dir]);
      expect([lang, dir], claimOf('lang')).toEqual(['he', 'rtl']);

      const nameless = (await page.locator('body').ariaSnapshot()).split('\n').filter((l) => NAMELESS.test(l));
      expect(nameless, claimOf('names')).toEqual([]);

      // keyboard: Tab from the top reaches every control on the page, and each one shows a ring when it has the focus
      // (an outline or a shadow on it or on its row that is not there without the focus)
      const total = await page.evaluate(() => {
        const sig = (el) => { const out = []; for (let e = el, i = 0; e && i < 4; e = e.parentElement, i += 1) { const c = getComputedStyle(e); out.push(`${c.outlineStyle} ${c.outlineWidth} ${c.outlineColor} ${c.boxShadow}`); } return out.join('|'); };
        const all = [...document.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
          .filter((el) => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden' && !el.closest('[inert], [aria-hidden="true"]'))
          .filter((el) => !(el.type === 'radio' && !el.checked && document.querySelector(`input[type="radio"][name="${el.name}"]:checked`)))
          // the same for an ARIA radio group (the student lane's shared Segmented, Base UI, STUDENT-15): one Tab stop, the
          // checked choice; the arrow keys reach the others
          .filter((el) => !(el.getAttribute('role') === 'radio' && el.getAttribute('aria-checked') !== 'true'
            && el.closest('[role="radiogroup"]')?.querySelector('[role="radio"][aria-checked="true"]')));
        window.__a11y = { rest: new Map(all.map((el) => [el, sig(el)])), sig, hit: new Set() };
        document.activeElement?.blur?.(); window.scrollTo(0, 0);
        return all.length;
      });
      const reached = [];
      for (let i = 0; i < total + 6; i += 1) {
        await page.keyboard.press('Tab');
        const f = await page.evaluate(() => {
          const el = document.activeElement;
          if (!el || el === document.body) return null;
          const { rest, sig, hit } = window.__a11y;
          hit.add(el);
          el.dataset.a11yN ||= String(rest.size + Math.random());
          const what = `${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30)}"`;
          return { n: el.dataset.a11yN, what, known: rest.has(el), ring: rest.has(el) ? rest.get(el) !== sig(el) : true };
        });
        if (!f) continue;
        if (reached.length && reached[0].n === f.n) break;
        if (!reached.some((r) => r.n === f.n)) reached.push(f);
      }
      expect(reached.filter((r) => !r.ring).map((r) => r.what), `${claimOf('keyboard')} (a ring)`).toEqual([]);
      // (a control the page took away meanwhile, like the map's "back to the next step" once that step is in view, is not missed)
      const missed = await page.evaluate(() => [...window.__a11y.rest.keys()].filter((el) => el.isConnected && !window.__a11y.hit.has(el))
        .map((el) => `${el.tagName.toLowerCase()}.${el.className} "${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30)}"`));
      expect(missed, `${claimOf('keyboard')} (every control reached)`).toEqual([]);

      const low = await page.evaluate(() => {
        const rgb = (c) => { const m = String(c).match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map(parseFloat); return { r: p[0], g: p[1], b: p[2], a: p[3] ?? 1 }; };
        const mix = (top, base) => ({ r: top.r * top.a + base.r * (1 - top.a), g: top.g * top.a + base.g * (1 - top.a), b: top.b * top.a + base.b * (1 - top.a) });
        const lum = ({ r, g, b }) => { const f = (v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
        // the colour under an element: its own and its parents' backgrounds, down to the white page; unknown over a picture
        const under = (el) => {
          const layers = [];
          for (let e = el; e; e = e.parentElement) {
            const c = getComputedStyle(e);
            if (c.backgroundImage !== 'none') return null;
            const b = rgb(c.backgroundColor);
            if (b && b.a > 0) { layers.push(b); if (b.a >= 1) break; }
          }
          return layers.reverse().reduce((base, l) => mix(l, base), { r: 255, g: 255, b: 255 });
        };
        const out = []; const seen = new Set();
        const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        while (walk.nextNode()) {
          const el = walk.currentNode.parentElement;
          if (!el || seen.has(el) || !walk.currentNode.textContent.trim()) continue;
          seen.add(el);
          const r = el.getBoundingClientRect(); const c = getComputedStyle(el);
          if (!r.width || !r.height || c.visibility === 'hidden' || Number(c.opacity) === 0) continue;
          if (el.closest('[aria-hidden="true"], .visually-hidden, [disabled], [aria-disabled="true"], svg')) continue;
          const bg = under(el); const fg = rgb(c.color);
          if (!bg || !fg) continue;
          const L1 = lum(mix(fg, bg)); const L2 = lum(bg);
          const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
          const size = parseFloat(c.fontSize); const large = size >= 24 || (Number(c.fontWeight) >= 700 && size >= 18.66);
          if (ratio < (large ? 3 : 4.5)) out.push(`${ratio.toFixed(2)} "${walk.currentNode.textContent.trim().slice(0, 30)}"`);
        }
        return out;
      });
      expect(low, claimOf('contrast')).toEqual([]);

      await page.setViewportSize({ width: 320, height: 568 });
      await page.waitForTimeout(150);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(over, claimOf('narrow')).toBeLessThanOrEqual(0);
    });
  }

  test('feedback on an answer is announced at once', async ({ page }) => {
    await open(page, '#/lesson/signed/1', student('7'));
    await expect.poll(() => page.evaluate(() => !!window.__madregotItem)).toBe(true);
    await answer(page, false);
    const fb = page.locator('section.fb');
    await expect(fb, claimOf('feedback')).toBeVisible();
    await expect(fb).toHaveAttribute('aria-live', 'assertive');
    await expect(fb).toHaveAccessibleName(/.+/);
  });

  test('every exercise you drag also moves with buttons (manip.spec.js checks each kind)', () => {
    // manip.spec.js opens every interactive kind and moves it with a step button, without a drag, on every device
    const spec = readFileSync(new URL('./manip.spec.js', import.meta.url), 'utf8');
    expect(spec, claimOf('drag')).toContain("'a step button moved the object'");
    expect(spec).toContain('] of KINDS) {\n  test(`interactive exercise: ${name}`');
  });

  test('with reduced motion nothing moves or loops; without it, the same screens do move (so the check can see motion)', async ({ page }) => {
    // every CSS animation and transition ends at once (tokens.css), and the app's own animations (motion, with
    // reducedMotion "user") change no position, size or angle: only opacity is left
    const sample = async () => page.evaluate(() => ({
      slow: [...document.querySelectorAll('*')].filter((e) => {
        const c = getComputedStyle(e);
        const long = (v) => String(v).split(',').some((d) => parseFloat(d) * (d.trim().endsWith('ms') ? 0.001 : 1) > 0.001);
        return long(c.transitionDuration) || (c.animationName !== 'none' && (long(c.animationDuration) || c.animationIterationCount !== '1'));
      }).length,
      moving: document.getAnimations().filter((a) => !(a instanceof CSSAnimation) && !(a instanceof CSSTransition))
        .filter((a) => (a.effect?.getKeyframes?.() || []).some((k) => ['transform', 'translate', 'scale', 'rotate'].some((p) => p in k))).length,
    }));
    const visit = async () => {
      const seen = [];
      await open(page, '#/', livedIn('7')); seen.push(await sample());
      await open(page, '#/lesson/signed/1', student('7'));
      await expect.poll(() => page.evaluate(() => !!window.__madregotItem)).toBe(true);
      await answer(page, true); seen.push(await sample());
      await open(page, '#/settings', livedIn('7'));
      await page.getByRole('button', { name: 'מחיקת כל הנתונים' }).click();
      seen.push(await sample());
      return seen;
    };
    for (const s of await visit()) expect(s, claimOf('motion')).toEqual({ slow: 0, moving: 0 });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    expect((await visit()).some((s) => s.slow > 0), 'without reduced motion the screens do animate').toBe(true);
  });
});
