// The weekly summary sent to a parent with no account (PARENTS-2, PARENTS-6 states 8 and 9, PARENTS-10 flows 1 and 2).
// Flow 1: the child opens the summary from the profile, sees the week, and opens the share sheet; the WhatsApp address
// carries the text and the link, unticking the repairs takes them out of the link, and nothing is sent to any server.
// The child's app knows its server (a fake Worker answers on the API host), so "nothing reaches it" is a real check.
// Flow 2: the parent opens the link on another phone (a fresh browser context, no profile): the same numbers, no
// request to /api/ or to any other host, and a cut link says so calmly. A phone whose app knows the server (as the
// production build does) makes no request to it either. The "no server" claim is proved by the network log, not
// stated. Flow 3 (PARENTS-4): a device linked to a family plan tells the child before anything is sent, and nothing is
// sent until "הבנתי"; then one post carries the days with activity and today, with X-Family-Device only; the profile
// shows the sign, the sheet shows what was sent, the child can stop it and delete what was sent; and a new profile on
// the same device is told again before anything goes. Flow 4 (PARENTS-5, PARENTS-6): the paying parent's /parents shows
// each device's progress, the week switch, 8 weeks with a table, their own switch, deleting a device's history, the
// usefulness question once, the unlink sentence, the checkout line, and every first-day state. Flow 5: a class
// student's numbers say the teacher sees them.
// Screenshots for the evidence folder with REPORT_SHOTS=<folder>.
import { mkdirSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { open, student, reportWeek, appReady, saved, NOW } from './helpers.js';
import { API, fakeServer, livePlan, TOKEN } from './fakeServer.js';

const API_HOST = new URL(API).host;
const WA = 'https://wa.me/?text=';
/** The week to report on, saved as a v3 save so the server address is kept (as monitor.spec.js does). */
const withServer = () => { const s = { ...reportWeek(), version: 3 }; s.state.ai = { mode: 'server', apiUrl: API, key: '', device: '' }; return s; };

/** Every request a page makes from now on: its address and its body. */
function watch(page) {
  const reqs = [];
  page.on('request', (r) => reqs.push({ url: r.url(), body: r.postData() || '' }));
  return reqs;
}

/** The WeekShare inside a payload ('1.' + base64url), as the server would see it if it ever got it. */
const decoded = (payload) => JSON.parse(Buffer.from(payload.slice(2), 'base64url').toString('utf8'));
const payloadIn = (text) => /#\/r\/(1\.[A-Za-z0-9_-]+)/.exec(text)?.[1];

/** Screenshots for the evidence folder (REPORT_SHOTS=<folder>); nothing is compared. */
async function shot(page, name, { fullPage = false } = {}) {
  const dir = process.env.REPORT_SHOTS; if (!dir) return;
  mkdirSync(dir, { recursive: true });
  await page.waitForTimeout(500); // a sheet's entrance ends
  await page.evaluate(() => document.getAnimations().forEach((a) => { try { a.finish(); } catch { /* infinite */ } }));
  const project = test.info().project.name;
  await page.screenshot({ path: `${dir}/${name}${project === 'phone' ? '' : `-${project}`}.png`, fullPage });
}

/** The number on a stat tile of the report, by its label. */
const tile = (page, label) => page.locator('.report-tiles .kpi').filter({ hasText: label }).locator('.kpi-num');

async function expectWeekNumbers(page) {
  await expect(tile(page, 'ימי תרגול')).toHaveText('4');
  await expect(tile(page, 'דקות')).toHaveText('62');
  await expect(tile(page, 'שאלות')).toHaveText('43');
  await expect(tile(page, 'ימים ברצף')).toHaveText('2');
  await expect(page.locator('.report-mastered li')).toHaveText(['מספרים מכוונים: השוואת מספרים', 'מספרים מכוונים: חיבור וחיסור']);
  await expect(page.locator('.report-worked .report-dots li')).toHaveText(['מערכת צירים: קריאת נקודה', 'מספרים מכוונים: השוואת מספרים', 'מספרים מכוונים: חיבור וחיסור']);
  const fixes = page.locator('.report-fix');
  await expect(fixes).toHaveCount(3);
  await expect(fixes.nth(0)).toContainText('מספרים מכוונים: השוואת מספרים');
  await expect(fixes.nth(0)).toContainText('בתיקון');
  await expect(fixes.nth(2)).toContainText('תוקן השבוע');
  await expect(page.locator('.report-exam')).toContainText('מבחן ב־12.11. 2 מתוך 3 המדרגות של המבחן כבר בשליטה.');
  await expect(page.locator('.report-dates')).toHaveText('א׳ 1.11 – ש׳ 7.11');
  await expect(page.getByRole('list', { name: 'ימי תרגול השבוע: 4' })).toBeVisible();
  await expect(page.locator('.report-day').nth(6)).toContainText('שבת, מנוחה');
}

/**
 * The child's part: from the profile to the share sheet, on a device whose app knows its server (a fake Worker).
 * Returns the sheet, every request from the tap on the card on, and the fake server's own log.
 */
async function childToSheet(page, baseURL) {
  const { log } = await fakeServer(page.context(), {}, baseURL);
  await open(page, '#/me', withServer());
  expect((await saved(page)).ai.apiUrl).toBe(API); // the app could reach its server
  await page.waitForLoadState('networkidle');
  const reqs = watch(page);
  const before = log.length;
  const card = page.getByRole('link', { name: /הסיכום השבועי/ });
  await expect(card).toContainText('4 ימי תרגול השבוע');
  await card.click();
  await expect(page.getByRole('heading', { level: 1, name: 'הסיכום השבועי' })).toBeVisible();
  await expect(page.getByText('זה הסיכום של השבוע שלכם. אם תשלחו אותו להורים, זה בדיוק מה שהם יראו.')).toBeVisible();
  // a Thursday: "השבוע" is chosen
  await expect(page.getByRole('radio', { name: 'השבוע', exact: true })).toHaveAttribute('aria-checked', 'true');
  await expectWeekNumbers(page);
  await shot(page, 'report-week');
  if (process.env.REPORT_SHOTS) {
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await shot(page, 'report-week-end');
    await page.evaluate(() => window.scrollTo(0, 0));
  }
  await page.getByRole('button', { name: 'לשלוח להורים' }).click();
  const sheet = page.getByRole('dialog', { name: 'לשלוח להורים' });
  await expect(sheet).toBeVisible();
  return { sheet, reqs, server: () => log.slice(before) };
}

const hrefOf = async (sheet) => sheet.getByRole('link', { name: 'וואטסאפ' }).getAttribute('href');

test('flow 1: the child previews the week and sends it, and nothing reaches a server', async ({ page, baseURL }) => {
  const { sheet, reqs, server } = await childToSheet(page, baseURL);
  await shot(page, 'share-sheet');
  const wa = sheet.getByRole('link', { name: 'וואטסאפ' });
  await expect(wa).toHaveAttribute('target', '_blank');
  expect(await wa.getAttribute('rel')).toMatch(/\bnoopener\b/);

  const href = await hrefOf(sheet);
  expect(href.startsWith(WA)).toBe(true);
  expect(href.length).toBeLessThanOrEqual(4096);
  const text = decodeURIComponent(href.slice(WA.length));
  expect(text).toContain('#/r/1.');
  expect(text.split('\n')).toEqual([
    'הסיכום השבועי של נועה במדרגות (1.11–7.11):',
    '• תרגלתי 4 ימים, בערך 62 דקות',
    '• עברתי בדיקת שליטה בשתי מדרגות: מספרים מכוונים: השוואת מספרים, מספרים מכוונים: חיבור וחיסור',
    '• תרגלתי: מערכת צירים: קריאת נקודה, מספרים מכוונים: השוואת מספרים, מספרים מכוונים: חיבור וחיסור',
    '• בתיקון עכשיו: שתי טעויות שחוזרות',
    '• רצף: יומיים',
    expect.stringMatching(/^לסיכום המלא: http:\/\/127\.0\.0\.1:\d+\/#\/r\/1\.[A-Za-z0-9_-]+$/),
  ]);
  // the sheet shows exactly that text
  await expect(sheet.getByTestId('share-text')).toContainText('הסיכום השבועי של נועה במדרגות (1.11–7.11):');
  await expect(sheet.getByTestId('share-text')).toContainText('• בתיקון עכשיו: שתי טעויות שחוזרות');
  const payload = payloadIn(text);
  const week = decoded(payload);
  expect(week).toMatchObject({ v: 1, w: '2026-11-01', e: '2026-11-07', dd: [1, 1, 0, 1, 1, 3, 3], m: 62, q: 43, sr: 2, ma: ['signed:2', 'signed:1'] });
  expect(week.fx).toEqual([['signed:2', 'neg-compare', 'o'], ['coord:1', 'swap', 'o'], ['signed:1', 'minus-minus', 'd']]);
  // the name is in the message the child sends, never in the link
  expect(JSON.stringify(week)).not.toContain('נועה');
  expect(Buffer.from(payload.slice(2), 'base64url').toString('latin1')).toMatch(/^[\x20-\x7e]*$/);

  // leaving the repairs out takes them out of the text and out of the link
  await sheet.getByRole('checkbox', { name: 'לכלול את מה שמתקנים עכשיו' }).uncheck();
  const href2 = await hrefOf(sheet);
  const text2 = decodeURIComponent(href2.slice(WA.length));
  expect(text2).not.toContain('בתיקון');
  const payload2 = payloadIn(text2);
  expect(Object.hasOwn(decoded(payload2), 'fx')).toBe(false);
  await expect(sheet.getByTestId('share-text')).not.toContainText('בתיקון');

  // copy the link: the toast says so
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  await sheet.getByRole('button', { name: 'העתקת הקישור' }).click();
  await expect(page.getByText('הקישור הועתק')).toBeVisible();

  // the network: nothing to the API host (the fake Worker heard nothing), nothing that carries the week, nothing to
  // another host
  const origin = new URL(baseURL).origin;
  expect(reqs.filter((r) => r.url.includes(API_HOST))).toEqual([]);
  expect(server()).toEqual([]);
  for (const p of [payload, payload2, payload.slice(2, 40)]) expect(reqs.filter((r) => r.url.includes(p) || r.body.includes(p))).toEqual([]);
  expect(reqs.filter((r) => !r.url.startsWith(origin) && !r.url.startsWith('data:') && !r.url.startsWith('blob:'))).toEqual([]);
});

test('flow 2: the parent opens the link on another phone: the same week, and no request to any server', async ({ page, browser, baseURL }) => {
  const { sheet } = await childToSheet(page, baseURL);
  const payload = payloadIn(decodeURIComponent((await hrefOf(sheet)).slice(WA.length)));

  // the parent's phone: a new browser with nothing stored, no profile, no account
  const ctx = await browser.newContext({ baseURL, viewport: page.viewportSize(), locale: 'he-IL', reducedMotion: 'reduce', serviceWorkers: 'block' });
  try {
    const parent = await ctx.newPage();
    await parent.clock.setFixedTime(new Date(NOW.getTime() + 2 * 864e5)); // read two days later, on Saturday
    const reqs = watch(parent);
    await parent.goto(`./#/r/${payload}`);
    await appReady(parent);
    await expect(parent.getByRole('heading', { level: 1, name: 'מדרגות · סיכום שבועי' })).toBeVisible();
    await expectWeekNumbers(parent);
    // the repairs were sent on Thursday, and the page says so
    await expect(parent.locator('.report-asof')).toHaveText('נכון ל־5.11');
    await expect(parent.getByText('הסיכום נוצר במכשיר של הילד ונשלח ממנו. מדרגות לא שומרת אותו.', { exact: false })).toBeVisible();
    const about = parent.getByRole('link', { name: 'מה זה מדרגות?' });
    await expect(about).toHaveAttribute('href', '#/parents');
    // no price and no plan on this page (the frame's footer keeps its static links, the cancel link among them)
    expect(await parent.locator('.parents-main').innerText()).not.toMatch(/₪|מנוי/);
    expect(await parent.locator('body').innerText()).not.toContain('₪');
    await shot(parent, 'r-view', { fullPage: true });

    const origin = new URL(baseURL).origin;
    expect(reqs.filter((r) => r.url.includes('/api/'))).toEqual([]);
    expect(reqs.filter((r) => !r.url.startsWith(origin) && !r.url.startsWith('data:') && !r.url.startsWith('blob:'))).toEqual([]);
    expect(reqs.filter((r) => r.url.includes(payload.slice(2, 40)) || r.body.includes(payload.slice(2, 40)))).toEqual([]);

    // offline, the account pages say they need the connection; the week does not, since it reads only its link
    await ctx.setOffline(true);
    await parent.evaluate(() => { window.location.hash = '#/parents/info'; });
    await expect(parent.getByText('כדי להמשיך צריך חיבור לאינטרנט.')).toBeVisible();
    await parent.evaluate((p) => { window.location.hash = `#/r/${p}`; }, payload);
    await expect(tile(parent, 'שאלות')).toHaveText('43');
    await expect(parent.getByText('כדי להמשיך צריך חיבור לאינטרנט.')).toHaveCount(0);
    await ctx.setOffline(false);

    // a link cut short (a message that lost its end): a calm sentence, and still no request
    const broken = await ctx.newPage();
    const reqs2 = watch(broken);
    await broken.goto(`./#/r/${payload.slice(0, 30)}`);
    await appReady(broken);
    await expect(broken.getByText('הקישור לא שלם.')).toBeVisible();
    await expect(broken.getByText('אפשר לבקש מהילד לשלוח אותו שוב.')).toBeVisible();
    await expect(broken.locator('.report')).toHaveCount(0);
    expect(reqs2.filter((r) => r.url.includes('/api/') || !r.url.startsWith(origin))).toEqual([]);
    await shot(broken, 'r-broken');
  } finally {
    await ctx.close();
  }

  // a phone whose app knows the server (as the production build does, on the same address), with no profile: the
  // link still makes no request to it
  const prod = await browser.newContext({ baseURL, viewport: page.viewportSize(), locale: 'he-IL', reducedMotion: 'reduce', serviceWorkers: 'block' });
  try {
    const { log } = await fakeServer(prod, {}, baseURL);
    const known = { ...student('7', { ai: { mode: 'server', apiUrl: API, key: '', device: '' } }), version: 3 };
    known.state.profile = null;
    await prod.addInitScript((s) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('madregot', s); sessionStorage.setItem('seeded', '1'); } }, JSON.stringify(known));
    const p = await prod.newPage();
    await p.clock.setFixedTime(NOW);
    const reqs = watch(p);
    await p.goto(`./#/r/${payload}`);
    await appReady(p);
    await expect(tile(p, 'שאלות')).toHaveText('43');
    expect((await saved(p)).ai.apiUrl).toBe(API); // the app could reach its server
    await p.waitForTimeout(1500);
    expect(log).toEqual([]);
    expect(reqs.filter((r) => r.url.includes(API_HOST) || r.url.includes('/api/'))).toEqual([]);
  } finally {
    await prod.close();
  }
});

test('state 8: a week with nothing yet: מדי, a calm line, and nothing to send yet', async ({ page }) => {
  await open(page, '#/report', student('7'));
  await expect(page.getByRole('heading', { name: 'עוד אין מה לסכם השבוע.' })).toBeVisible();
  await expect(page.getByText('אחרי השיעור הבא יופיע כאן.')).toBeVisible();
  const send = page.getByRole('button', { name: 'לשלוח להורים' });
  await expect(send).toBeDisabled();
  await expect(page.getByText('אחרי השיעור הבא יהיה כאן מה לשלוח.')).toBeVisible();
  await expect(page.locator('.report')).toHaveCount(0);
  await shot(page, 'report-empty');
  // last week is there to look at too
  await page.getByRole('radio', { name: 'השבוע שעבר' }).click();
  await expect(page.getByRole('heading', { name: 'בשבוע שעבר לא היה תרגול.' })).toBeVisible();
});

test('last week: its own days, no repairs as of now, and the switch is a radio group', async ({ page }) => {
  await open(page, '#/report', reportWeek());
  await page.getByRole('radio', { name: 'השבוע שעבר' }).click();
  await expect(page.getByRole('radio', { name: 'השבוע שעבר' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('.report-dates')).toHaveText('א׳ 25.10 – ש׳ 31.10');
  await expect(tile(page, 'ימי תרגול')).toHaveText('1');
  await expect(page.locator('.report-fixes')).toHaveCount(0);
});

test('the staging copy shows a fixed week with ?qa-report=week', async ({ page }) => {
  await open(page, '#/report?qa-report=week', student('7'));
  await expect(page.locator('.report-dates')).toHaveText('א׳ 8.11 – ש׳ 14.11');
  await expect(tile(page, 'ימי תרגול')).toHaveText('4');
  await expect(page.locator('.report-mastered li')).toHaveCount(2);
});

test('on a Sunday the summary opens on last week, the week that has just ended', async ({ page }) => {
  await open(page, '#/report', reportWeek());
  await page.clock.setFixedTime(new Date('2026-11-08T10:00:00')); // Sunday 8 November
  await page.reload();
  await appReady(page);
  await expect(page.getByRole('radio', { name: 'השבוע שעבר' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('.report-dates')).toHaveText('א׳ 1.11 – ש׳ 7.11');
  await expect(tile(page, 'ימי תרגול')).toHaveText('4');
  // this week has only just begun: its own empty state, and the button waits
  await page.getByRole('radio', { name: 'השבוע', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'עוד אין מה לסכם השבוע.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'לשלוח להורים' })).toBeDisabled();
});

// ---------------------------------------------------------------- flow 3: a linked device, the notice first (PARENTS-4)
const FD = `fd1.${'1'.repeat(64)}`;
const DEVICE = { id: 'd000000000000001', label: 'הטאבלט', token: FD };
/** The week to report on, on a device linked to a family plan; the backup question has been asked already. */
const linkedWeek = () => {
  const s = withServer();
  s.state.ai.familyDevice = { token: FD, label: 'הטאבלט' };
  s.state.durable = { nudgeCount: 2 };
  return s;
};
const notice = (page) => page.getByRole('dialog', { name: 'ההורים יראו סיכום קצר של התרגול' });
const summaryPosts = (log) => log.filter((r) => r.path === '/api/family/summary');

test('flow 3: the child is told first, nothing is sent before "הבנתי", and the child can see and stop what is shared', async ({ page, baseURL }) => {
  test.setTimeout(120_000);
  const { st, log } = await fakeServer(page.context(), { report: true, plan: livePlan(), devices: [{ ...DEVICE }] }, baseURL);
  await open(page, '#/', linkedWeek());
  const n = notice(page);
  await expect(n).toBeVisible();
  for (const word of ['דקות', 'שאלות', 'מדרגות', 'בדיקת שליטה', 'טעויות', 'רצף', 'מבחן']) await expect(n).toContainText(word);
  await expect(n).toContainText('לא נשלחים: התשובות עצמן, השיחות עם העוזר החכם, תמונות והשם שלכם.');
  // the app's first sync moment (3 s after it opened) comes and goes: nothing is sent while the notice waits
  await page.waitForTimeout(4000);
  expect(summaryPosts(log)).toEqual([]);
  expect(st.summaries).toEqual({});
  await shot(page, 'notice');

  // "הבנתי": exactly one post, the days with activity from 7 days back and today, with the device's token only
  await n.getByRole('button', { name: 'הבנתי' }).click();
  await expect(n).toBeHidden();
  await expect.poll(() => summaryPosts(log).length).toBe(1);
  await page.waitForTimeout(1500);
  expect(summaryPosts(log)).toHaveLength(1);
  const post = summaryPosts(log)[0];
  expect(post.headers['x-family-device']).toBe(FD);
  expect(post.headers).not.toHaveProperty('x-account-token');
  expect(post.headers).not.toHaveProperty('authorization');
  expect(post.body.days.map((d) => d.d)).toEqual(['2026-10-29', '2026-11-01', '2026-11-02', '2026-11-04', '2026-11-05']);
  expect(post.body.days.at(-1)).toMatchObject({ v: 1, d: '2026-11-05', q: 9, ls: 1, m: 10, sk: ['coord:1'] });
  expect(JSON.stringify(post.body)).not.toContain('נועה');
  expect(Object.keys(st.summaries[DEVICE.id]).sort()).toEqual(['2026-10-29', '2026-11-01', '2026-11-02', '2026-11-04', '2026-11-05']);
  expect((await saved(page)).ai.familyDevice).toMatchObject({ token: FD, sharingSeen: expect.any(String), lastSent: { days: post.body.days } });

  // the profile: the sign, and the numbers say the summary goes to the parents
  await page.evaluate(() => { window.location.hash = '#/me'; });
  const chip = page.getByRole('button', { name: 'משותף עם ההורים' });
  await expect(chip).toBeVisible();
  await expect(page.locator('.nums-where')).toContainText('סיכום קצר של התרגול נשלח להורים. בהגדרות אפשר לראות מה בדיוק.');
  await shot(page, 'me-chip');
  // the sheet: on, sent today at 10:00, today's row in words, and the rows sent
  await chip.click();
  const sheet = page.getByRole('dialog', { name: 'שיתוף עם ההורים' });
  await expect(sheet).toBeVisible();
  await expect(sheet.locator('.sharing-status')).toHaveText('פועל. הסיכום התעדכן לאחרונה היום ב־10:00.');
  await expect(sheet.getByRole('region', { name: 'מה נשלח היום' })).toContainText('שאלות שנענו9');
  await sheet.getByRole('button', { name: 'לראות' }).click();
  const rows = sheet.locator('.sharing-rows .report-dayview-title');
  await expect(rows).toHaveText(['היום, 5.11', 'יום רביעי 4.11', 'יום שני 2.11', 'יום ראשון 1.11', 'יום חמישי 29.10']);
  await expect(sheet).toContainText('מה לא נשלח אף פעם: התשובות עצמן, השיחות עם העוזר החכם, תמונות והשם שלכם.');
  await expect(sheet).toContainText('הסיכומים נשמרים 90 יום ואז נמחקים.');
  // no plan and no price on the child's screens
  expect(await sheet.innerText()).not.toMatch(/₪|מנוי/);

  // stop, and delete what was sent: one post with {on:false, forget:true}; the sign goes
  await sheet.getByRole('button', { name: 'להפסיק לשתף' }).click();
  const confirm = page.getByRole('dialog', { name: 'להפסיק לשלוח סיכום להורים?' });
  await expect(confirm).toContainText('ההורים יראו שהשיתוף כבוי במכשיר הזה, בלי סיבה ובלי פרטים.');
  await confirm.getByRole('checkbox', { name: 'למחוק גם את מה שכבר נשלח' }).check();
  await confirm.getByRole('button', { name: 'כן, להפסיק' }).click();
  await expect(sheet.locator('.sharing-status')).toHaveText('כבוי. ההורים רואים שהשיתוף כבוי, בלי סיבה ובלי פרטים.');
  const off = log.filter((r) => r.path === '/api/family/summary/sharing');
  expect(off).toHaveLength(1);
  expect(off[0].body).toEqual({ on: false, forget: true });
  expect(off[0].headers['x-family-device']).toBe(FD);
  expect(off[0].headers).not.toHaveProperty('x-account-token');
  expect(st.summaries[DEVICE.id]).toBeUndefined();
  await expect(sheet.getByRole('button', { name: 'להפעיל שוב את השיתוף' })).toBeVisible();
  await shot(page, 'sharing-off');
  await sheet.getByRole('button', { name: 'סגירה' }).click();
  await expect(chip).toHaveCount(0);

  // Settings: the row says it is off; it can be turned on again from there
  await page.evaluate(() => { window.location.hash = '#/settings'; });
  const row = page.getByRole('button', { name: /שיתוף עם ההורים/ });
  await expect(row).toContainText('כבוי');
  await row.click();
  const again = page.getByRole('dialog', { name: 'שיתוף עם ההורים' });
  await again.getByRole('button', { name: 'להפעיל שוב את השיתוף' }).click();
  await expect(again.locator('.sharing-status')).toHaveText(/^פועל\./);
  await expect.poll(() => log.filter((r) => r.path === '/api/family/summary/sharing').at(-1)?.body).toEqual({ on: true });
  await shot(page, 'settings-sharing');
  await again.getByRole('button', { name: 'סגירה' }).click();
  await expect(row).toContainText('פועל');

  // a new profile on the same device (התנתקות keeps the link): told again, and nothing goes before "הבנתי"
  await page.getByRole('button', { name: 'התנתקות מהמכשיר' }).click();
  await page.getByRole('dialog', { name: 'להתנתק מהמכשיר?' }).getByRole('button', { name: 'כן, להתנתק' }).click();
  await expect(page.getByRole('button', { name: 'מתחילים', exact: true })).toBeVisible();
  expect((await saved(page)).ai.familyDevice).toEqual({ token: FD, label: 'הטאבלט', sharingSeen: null, lastSent: null });
  const before = summaryPosts(log).length;
  await page.getByRole('button', { name: 'מתחילים', exact: true }).click();
  await page.fill('#w-name', 'יואב');
  await page.getByRole('button', { name: 'המשך', exact: true }).click();
  await page.getByRole('radio', { name: /^כיתה ז׳/ }).click();
  await page.getByRole('button', { name: 'המשך', exact: true }).click();
  await page.getByRole('radio', { name: /^קצת מוכר/ }).click();
  await page.getByRole('button', { name: 'המשך', exact: true }).click();
  await page.getByRole('button', { name: 'המשך', exact: true }).click();
  await page.getByRole('button', { name: 'המשך בלי קוד' }).click(); // the app has a server: a class code is offered
  await page.getByRole('radio', { name: /^מתחילים מההתחלה/ }).click();
  await page.getByRole('button', { name: 'לשיעור הראשון', exact: true }).click();
  // a teaching stage: never there
  await expect(page).toHaveURL(/#\/learn\/signed\/1\/A/);
  await page.waitForTimeout(2000);
  await expect(notice(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'סגירה. המקום נשמר' }).click();
  await expect(notice(page)).toBeVisible();
  await page.waitForTimeout(3500);
  expect(summaryPosts(log)).toHaveLength(before);
  await notice(page).getByRole('button', { name: 'הבנתי' }).click();
  await expect.poll(() => summaryPosts(log).length).toBe(before + 1);
});

test('the notice: closing it is "not yet", and it comes back when the app opens again; "לראות מה נשלח" shows the sheet first', async ({ page, baseURL }) => {
  const { log } = await fakeServer(page.context(), { report: true, plan: livePlan(), devices: [{ ...DEVICE }] }, baseURL);
  await open(page, '#/me', linkedWeek());
  await notice(page).getByRole('button', { name: 'סגירה' }).click();
  await expect(notice(page)).toBeHidden();
  await page.evaluate(() => { window.location.hash = '#/quests'; });
  await page.waitForTimeout(1500);
  await expect(notice(page)).toHaveCount(0);
  // the sign is there before the notice is seen: the summary is on, though nothing was sent yet
  await page.evaluate(() => { window.location.hash = '#/me'; });
  await expect(page.getByRole('button', { name: 'משותף עם ההורים' })).toBeVisible();
  await page.reload();
  await appReady(page);
  await expect(notice(page)).toBeVisible();
  await notice(page).getByRole('button', { name: 'לראות מה נשלח' }).click();
  const sheet = page.getByRole('dialog', { name: 'שיתוף עם ההורים' });
  await expect(sheet.locator('.sharing-status')).toHaveText('פועל. עוד לא נשלח סיכום.');
  await sheet.getByRole('button', { name: 'סגירה' }).click();
  // back to the notice, still nothing sent
  await expect(notice(page)).toBeVisible();
  expect(summaryPosts(log)).toEqual([]);
});

test('the parents switched the summary off: no notice, nothing sent, and the sheet says so', async ({ page, baseURL }) => {
  const { log } = await fakeServer(page.context(), { report: true, plan: livePlan(), devices: [{ ...DEVICE, shareParent: false }] }, baseURL);
  await open(page, '#/settings', linkedWeek());
  const row = page.getByRole('button', { name: /שיתוף עם ההורים/ });
  await expect(row).toContainText('כבוי');
  await row.scrollIntoViewIfNeeded();
  await shot(page, 'settings-row');
  await page.waitForTimeout(4000);
  await expect(notice(page)).toHaveCount(0);
  await row.click();
  const sheet = page.getByRole('dialog', { name: 'שיתוף עם ההורים' });
  await expect(sheet.locator('.sharing-status')).toHaveText('ההורים כיבו את הסיכום מהמכשיר הזה. כרגע לא נשלח כלום.');
  await expect(sheet.getByRole('button', { name: 'להפסיק לשתף' })).toBeVisible();
  await expect(sheet.getByRole('region', { name: 'מה נשלח היום' })).toHaveCount(0);
  expect(summaryPosts(log)).toEqual([]);
  // the sheets that delete or unlink name the summaries
  await sheet.getByRole('button', { name: 'סגירה' }).click();
  await page.getByRole('button', { name: 'מחיקת כל הנתונים' }).click();
  await expect(page.getByRole('dialog', { name: 'למחוק הכול?' })).toContainText('גם הסיכומים שנשלחו להורים מהמכשיר הזה יימחקו.');
});

// ---------------------------------------------------------------- flow 5: a class student's numbers say where they go
test('flow 5: a class student\'s numbers say the teacher sees every answer, not "nothing is sent"', async ({ page, baseURL }) => {
  await fakeServer(page.context(), {}, baseURL);
  const s = withServer();
  s.state.profile = { ...s.state.profile, classCode: 'K7Q2MD', className: 'ז׳3', token: 'stu_s1_1', studentId: 's1' };
  s.state.durable = { nudgeCount: 2 };
  await open(page, '#/me', s);
  await expect(page.locator('.nums-where')).toHaveText('המספרים האלה מחושבים במכשיר הזה. אתם בכיתה, ולכן כל תשובה בתרגול נשלחת גם ללוח של המורה. הזמן באפליקציה לא נספר כאן: רק מה שפתרתם לבד.');
  await expect(page.getByText('לשום מקום')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'משותף עם ההורים' })).toHaveCount(0);
});

// ---------------------------------------------------------------- flow 4: the parent's /parents (PARENTS-5, PARENTS-6)
const PARENT = TOKEN(9);
/** The parent's own phone: no profile, the app pointed at the fake server, the parent signed in (kept in localStorage). */
async function openParent(page, route = '#/parents') {
  const phone = withServer();
  phone.state.profile = null;
  await page.clock.setFixedTime(NOW);
  await page.goto('./');
  await page.evaluate(async ([s, t]) => {
    localStorage.clear();
    localStorage.setItem('madregot-debug', '1');
    localStorage.setItem('madregot', JSON.stringify(s));
    localStorage.setItem('madregot-parent', JSON.stringify({ token: t, email: 'parent@example.test' }));
    await new Promise((done) => { const r = indexedDB.deleteDatabase('madregot-durable'); r.onsuccess = done; r.onerror = done; r.onblocked = done; });
  }, [phone, PARENT]);
  await page.goto(`./${route}`);
  await page.reload();
  await appReady(page);
}
const srow = (d, over = {}) => ({ v: 1, d, m: 20, q: 12, ls: 1, st: 0, sk: ['signed:1'], ma: [], rv: 0, fx: [], sr: 1, ex: null, ...over });
const byDay = (rows) => Object.fromEntries(rows.map((r) => [r.d, r]));
/** The tablet's last weeks: this week (1–5.11) 4 days, 75 minutes, 46 questions; last week 2 days, 45 minutes; older weeks. */
const TABLET_ROWS = [
  srow('2026-09-30', { m: 10, q: 5 }), srow('2026-10-12', { m: 22, q: 14 }), srow('2026-10-19', { m: 16, q: 9, ls: 2 }),
  srow('2026-10-26', { m: 30, q: 20, ls: 2, sk: ['signed:1', 'coord:1'] }), srow('2026-10-28', { m: 15, q: 8 }),
  srow('2026-11-01', { m: 20, q: 12, ma: ['signed:1'], sr: 1 }), srow('2026-11-02', { m: 25, q: 15, ls: 2, sk: ['signed:2'], sr: 2 }),
  srow('2026-11-04', { m: 18, q: 10, ls: 0, st: 1, sk: ['coord:1'], sr: 3 }),
  srow('2026-11-05', { m: 12, q: 9, sk: ['coord:1'], fx: [['coord:1', 'swap', 'o']], sr: 4, ex: { d: '2026-11-12', n: 1, of: 3 } }),
];
const TABLET = { id: 'd000000000000001', label: 'הטאבלט', token: FD, linkedAt: '2026-09-20T16:00:00Z', lastSync: '2026-11-05T08:10:00Z' };
const PHONE = { id: 'd000000000000002', label: 'הטלפון', token: `fd1.${'2'.repeat(64)}`, linkedAt: '2026-10-20T18:00:00Z', lastSync: '2026-11-03T17:00:00Z' };
const parentServer = async (page, baseURL, over = {}) => {
  const server = await fakeServer(page.context(), {
    report: true, plan: livePlan(), devices: [{ ...PHONE }, { ...TABLET }],
    summaries: { [TABLET.id]: byDay(TABLET_ROWS), [PHONE.id]: byDay([srow('2026-11-03', { m: 14, q: 10, sk: ['stats:1'] })]) }, ...over,
  }, baseURL);
  server.st.sessions.add(PARENT);
  return server;
};
const deviceCard = (page, name) => page.locator('.report-device').filter({ has: page.getByRole('heading', { level: 3, name, exact: true }) });

test('flow 4: the parent sees each device\'s week and 8 weeks, holds their own switch, deletes a device\'s history, and is asked once if it helps', async ({ page, baseURL }) => {
  test.setTimeout(90_000);
  const { st, log } = await parentServer(page, baseURL);
  await openParent(page);
  await expect(page.getByRole('heading', { level: 2, name: 'ההתקדמות' })).toBeVisible();
  await expect(page.getByText('סיכום יומי מכל מכשיר מחובר.')).toBeVisible();
  // one card per device, in the order they were linked
  await expect(page.locator('.report-device-head h3')).toHaveText(['הטאבלט', 'הטלפון']);
  const tablet = deviceCard(page, 'הטאבלט');
  await expect(tablet.locator('.report-device-sync')).toHaveText(/^עודכן לאחרונה: היום ב־\d\d:\d\d$/);
  // this week, then last week: the numbers change
  await expect(tablet.getByRole('radio', { name: 'השבוע', exact: true })).toHaveAttribute('aria-checked', 'true');
  await expect(tile(tablet, 'ימי תרגול')).toHaveText('4');
  await expect(tile(tablet, 'דקות')).toHaveText('75');
  await expect(tile(tablet, 'שאלות')).toHaveText('46');
  await expect(tablet.locator('.report-dates')).toHaveText('א׳ 1.11 – ש׳ 7.11');
  await expect(tablet.getByText('הסיכום מתעדכן מהמכשיר במהלך היום ונשמר 90 יום. לא נכלל: התשובות עצמן, שיחות עם העוזר החכם ותמונות.')).toBeVisible();
  await tablet.getByRole('radio', { name: 'השבוע שעבר' }).click();
  await expect(tile(tablet, 'ימי תרגול')).toHaveText('2');
  await expect(tile(tablet, 'דקות')).toHaveText('45');
  await expect(tablet.locator('.report-dates')).toHaveText('א׳ 25.10 – ש׳ 31.10');
  await tablet.getByRole('radio', { name: 'השבוע', exact: true }).click();
  // 8 weeks: a hidden table with 8 rows, the same numbers
  const rows = tablet.locator('.weeks-chart table tbody tr');
  await expect(rows).toHaveCount(8);
  await expect(rows.nth(0)).toHaveText('1.11–7.11754');
  await expect(rows.nth(1)).toHaveText('25.10–31.10452');
  await expect(tablet.locator('.weeks-chart table thead th')).toHaveText(['שבוע', 'דקות', 'ימי תרגול']);
  // no percentage right anywhere on the page
  expect(await page.locator('.parents-report').innerText()).not.toMatch(/%/);
  await page.evaluate(() => document.getElementById('report-title').scrollIntoView({ block: 'start' }));
  await shot(page, 'parents-report-live');

  // the Sunday email (PARENTS-7): a switch, off until the parent turns it on, with where and when it comes
  const mail = page.getByRole('switch', { name: 'סיכום שבועי במייל' });
  await expect(mail).not.toBeChecked();
  await expect(page.locator('.report-email-hint')).toHaveText('בכל יום ראשון בבוקר, אל parent@example.test. אפשר להפסיק בכל רגע, גם מהמייל עצמו.');
  await expect(mail).toHaveAccessibleDescription('בכל יום ראשון בבוקר, אל parent@example.test. אפשר להפסיק בכל רגע, גם מהמייל עצמו.');
  const box = await page.locator('.report-email-row').boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(44);
  await mail.click();
  await expect(page.getByText('הסיכום השבועי יגיע ביום ראשון')).toBeVisible();
  await expect(mail).toBeChecked();
  expect(st.reportEmail).toBe(true);
  await mail.press('Space');
  await expect(page.getByText('הסיכום השבועי במייל הופסק')).toBeVisible();
  await expect(mail).not.toBeChecked();
  const mails = log.filter((r) => r.path === '/api/account/report-email');
  expect(mails.map((r) => r.body)).toEqual([{ on: true }, { on: false }]);
  expect(mails[0].headers['x-account-token']).toBe(PARENT);

  // usefulness, under the first card: one answer, then thanks; not asked again this week in this browser
  const fb = page.getByRole('region', { name: 'הסיכום עוזר לכם?' });
  await expect(fb).toBeVisible();
  await fb.getByRole('button', { name: 'כן', exact: true }).click();
  await expect(page.getByText('תודה. זה עוזר לנו לשפר.')).toBeVisible();
  expect(log.filter((r) => r.path === '/api/report/feedback').map((r) => r.body)).toEqual([{ useful: true }]);

  // the parent's own switch for the tablet: off, and back on
  await tablet.getByRole('button', { name: 'לכבות' }).click();
  await expect(tablet.getByText('כיביתם את הסיכום מהמכשיר הזה.')).toBeVisible();
  const sw = log.filter((r) => r.path === `/api/family/devices/${TABLET.id}/sharing`);
  expect(sw.map((r) => r.body)).toEqual([{ on: false }]);
  expect(sw[0].headers['x-account-token']).toBe(PARENT);
  expect(sw[0].headers).not.toHaveProperty('x-family-device');
  await tablet.getByRole('button', { name: 'להפעיל' }).click();
  await expect(tablet.getByText('הסיכום מהמכשיר הזה: פועל')).toBeVisible();

  // deleting the phone's history: asked first, then the card is back to its first day
  const phone = deviceCard(page, 'הטלפון');
  await phone.getByRole('button', { name: 'מחיקת ההיסטוריה של המכשיר' }).click();
  const del = page.getByRole('dialog', { name: 'למחוק את הסיכומים של הטלפון?' });
  await expect(del).toContainText('נמחק את כל הסיכומים שהגיעו מהמכשיר הזה. הסיכום הבא יגיע אחרי התרגול הבא.');
  await del.getByRole('button', { name: 'כן, למחוק' }).click();
  await expect(page.getByText('הסיכומים נמחקו')).toBeVisible();
  expect(log.filter((r) => r.path === `/api/family/devices/${PHONE.id}/history/delete`)).toHaveLength(1);
  expect(st.summaries[PHONE.id]).toBeUndefined();
  await expect(phone.getByRole('heading', { name: 'הטלפון: עוד אין סיכום' })).toBeVisible();

  // the parent's unlink sheet says the summaries go with the device
  await page.getByRole('button', { name: /^מכשירים מחוברים/ }).click();
  await page.locator('.parents-devices li').filter({ hasText: 'הטאבלט' }).getByRole('button', { name: 'ניתוק' }).click();
  const unlink = page.getByRole('dialog', { name: 'לנתק את המכשיר?' });
  await expect(unlink).toContainText('הסיכומים שהגיעו מהמכשיר הזה יימחקו.');
  await unlink.getByRole('button', { name: 'להשאיר מחובר' }).click();

  // a reload: the question is not asked again this week, and nothing more was sent
  await page.reload();
  await appReady(page);
  await expect(page.locator('.report-device').first()).toBeVisible();
  await expect(page.getByRole('region', { name: 'הסיכום עוזר לכם?' })).toHaveCount(0);
  expect(log.filter((r) => r.path === '/api/report/feedback')).toHaveLength(1);
});

test('flow 4: sharing off on the child\'s device: the parent is told when, never why, can still read, delete and switch their side', async ({ page, baseURL }) => {
  const { log } = await parentServer(page, baseURL, { devices: [{ ...TABLET, shareChild: false, sharingAt: '2026-11-02T18:00:00Z' }], summaries: { [TABLET.id]: byDay(TABLET_ROWS.slice(0, 6)) } });
  await openParent(page);
  const tablet = deviceCard(page, 'הטאבלט');
  await expect(tablet.getByText('השיתוף כבוי במכשיר עצמו מאז 2.11. אם תרצו, אפשר לדבר על זה יחד. רק במכשיר עצמו אפשר להפעיל אותו שוב.')).toBeVisible();
  await expect(tablet.getByText('השיתוף כבוי במכשיר עצמו.', { exact: true })).toBeVisible();
  await expect(tile(tablet, 'ימי תרגול')).toHaveText('1'); // what came before it was switched off is still there
  await expect(tablet.getByRole('button', { name: 'מחיקת ההיסטוריה של המכשיר' })).toBeVisible();
  await page.evaluate(() => document.getElementById('report-title').scrollIntoView({ block: 'start' }));
  await shot(page, 'parents-off-child-live');
  await tablet.getByRole('button', { name: 'לכבות' }).click();
  await expect(tablet.getByText('כיביתם את הסיכום, והשיתוף כבוי גם במכשיר עצמו.')).toBeVisible();
  await expect(tablet.getByText('הסיכום יחזור רק כשהשיתוף יופעל גם במכשיר.')).toBeVisible();
  expect(log.filter((r) => r.path === `/api/family/devices/${TABLET.id}/sharing`).map((r) => r.body)).toEqual([{ on: false }]);
});

test('flow 4: the QA state report-off shows the child\'s switch off and the parent\'s switch works with no server', async ({ page }) => {
  await open(page, '#/parents?qa-parent=report-off');
  const tablet = deviceCard(page, 'הטאבלט');
  await expect(tablet.getByText(/^השיתוף כבוי במכשיר עצמו מאז \d{1,2}\.\d{1,2}\. /)).toBeVisible();
  await page.evaluate(() => document.getElementById('report-title').scrollIntoView({ block: 'start' }));
  await shot(page, 'parents-off-child');
  await tablet.getByRole('button', { name: 'לכבות' }).click();
  await expect(tablet.getByText('כיביתם את הסיכום, והשיתוף כבוי גם במכשיר עצמו.')).toBeVisible();
});

test('flow 4, the first day: signed out, a plan with no device, linked with nothing yet, nothing this week, a device the plan does not cover', async ({ page, baseURL }) => {
  test.setTimeout(90_000);
  // 1. signed out: what the plan adds, and the free weekly summary
  const { st } = await parentServer(page, baseURL, { devices: [], summaries: {} });
  const phone = withServer(); phone.state.profile = null;
  await open(page, '#/parents', phone);
  await expect(page.getByRole('heading', { name: 'כניסה עם המייל' })).toBeVisible();
  await expect(page.locator('.parents-about li').first()).toHaveText('רואים מה הילד תרגל: סיכום יומי לכל מכשיר מחובר, וסיכום שבועי במייל אם תבחרו. הילד יודע על כך, רואה מה נשלח, ויכול להפסיק.');
  await expect(page.getByText('גם בלי מנוי: מהאפליקציה של הילד אפשר לשלוח לכם סיכום שבועי בוואטסאפ, בלי חשבון.')).toBeVisible();

  // 2. a plan, no device yet: the first-link card says what comes after linking
  await openParent(page);
  await expect(page.getByRole('heading', { name: 'חיבור המכשיר של הילד' })).toBeVisible();
  await expect(page.getByText('אחרי החיבור יופיע כאן סיכום יומי של התרגול במכשיר. הילד יקבל על כך הודעה, יוכל לראות בדיוק מה נשלח, ויוכל להפסיק.')).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'ההתקדמות' })).toHaveCount(0);

  // 3. linked, nothing sent yet: what will come, and an example that says it is one
  st.devices = [{ ...TABLET, lastSync: null }];
  await page.reload(); await appReady(page);
  const tablet = deviceCard(page, 'הטאבלט');
  await expect(tablet.getByRole('heading', { name: 'הטאבלט: עוד אין סיכום' })).toBeVisible();
  await expect(tablet).toContainText('הסיכום הראשון יופיע כאן אחרי התרגול הבא במכשיר.');
  await expect(tablet.getByText('דוגמה. אלה לא נתונים של הילד שלכם.')).toBeHidden();
  await tablet.getByText('איך זה ייראה (דוגמה)').click();
  await expect(tablet.getByText('דוגמה. אלה לא נתונים של הילד שלכם.')).toBeVisible();
  await expect(page.getByRole('region', { name: 'הסיכום עוזר לכם?' })).toHaveCount(0); // nothing to judge yet
  await page.evaluate(() => document.getElementById('report-title').scrollIntoView({ block: 'start' }));
  await shot(page, 'parents-first-day');

  // 4. summaries, but none this week: said, with the last practice day; last week still opens
  st.summaries = { [TABLET.id]: byDay(TABLET_ROWS.filter((r) => r.d < '2026-11-01')) };
  await page.reload(); await appReady(page);
  await expect(tablet.getByText('השבוע עוד לא היה תרגול במכשיר הזה.')).toBeVisible();
  await expect(tablet.getByText('התרגול האחרון: 28.10.')).toBeVisible();
  await tablet.getByRole('radio', { name: 'השבוע שעבר' }).click();
  await expect(tile(tablet, 'ימי תרגול')).toHaveText('2');

  // 6b. no plan, a device linked: what the plan holds, with no price; and the checkout says the child can stop sharing
  st.plan = null; st.summaries = {};
  await page.reload(); await appReady(page);
  await expect(page.getByText('הטאבלט: הסיכום היומי כלול במנוי המשפחתי.')).toBeVisible();
  expect(await page.locator('.parents-report').innerText()).not.toMatch(/₪/);
  await expect(page.locator('.parents-includes')).toHaveText('המנוי כולל: סיכום התקדמות לכל מכשיר, ועוזר חכם שמסביר, בודק דפים ומכין תרגילים. הילד רואה מה נשלח אליכם ויכול להפסיק את השיתוף.');
  await expect(page.getByRole('heading', { name: 'אין מנוי פעיל' }).locator('..')).toContainText('ויכול להפסיק את השיתוף');

  // 7. the plan ended, summaries kept: said, and they can be read and deleted
  st.summaries = { [TABLET.id]: byDay(TABLET_ROWS) };
  await page.reload(); await appReady(page);
  await expect(page.getByText('המנוי הסתיים. הסיכומים שכבר הגיעו נשמרים עד 90 יום ואז נמחקים. אפשר למחוק אותם עכשיו.')).toBeVisible();
  await expect(tile(tablet, 'ימי תרגול')).toHaveText('4');
  await expect(tablet.getByRole('button', { name: 'מחיקת ההיסטוריה של המכשיר' })).toBeVisible();
  await expect(tablet.getByRole('button', { name: 'לכבות' })).toHaveCount(0);
});

test('flow 4: the staging copy shows two devices\' progress with ?qa-parent=report, and asks nothing of a server', async ({ page }) => {
  const reqs = watch(page);
  await open(page, '#/parents?qa-parent=report');
  await expect(page.locator('.report-device-head h3')).toHaveText(['הטאבלט', 'הטלפון']);
  await expect(deviceCard(page, 'הטאבלט').locator('.weeks-chart table tbody tr')).toHaveCount(8);
  await page.evaluate(() => document.getElementById('report-title').scrollIntoView({ block: 'start' }));
  await shot(page, 'parents-report');
  await shot(page, 'parents-report-full', { fullPage: true });
  expect(reqs.filter((r) => r.url.includes('/api/'))).toEqual([]);
});
