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
