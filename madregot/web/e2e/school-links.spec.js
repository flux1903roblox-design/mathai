// School links and sharing with nothing of the class in it (COUNCIL2-35, COUNCIL2-36), end to end against the fake
// server (e2e/fakeServer.js). Every name and address is synthetic (example.test).
//
// COUNCIL2-35: each assignment has its own link (#/a/<id>), for the class's channel, Google Classroom or a Moodle URL
// activity. The teacher's sheet of the assignment shows the link, the message, Classroom's share address and the three
// Moodle fields, with no student's name. The link opens the work on a class student's phone at once (?assignment=<id>);
// a phone with no one on it shows the work and the class, joins (a name, a 4-digit PIN) and then opens it. Another
// class's student, a teacher, an unknown link, a closed class and a copy with no server each say so and change nothing.
// The round trip is tagged @contract: it runs against the real Worker too (playwright.config.js CONTRACT_SPECS).
//
// COUNCIL2-36: "שליחה לעמית/ה" sends the demo class's link (it opens the made-up board on another phone), and the
// class goal's card is the class total against its own goal. Neither carries a name, the class's code or its name.
//
// SCHOOL_LINKS_SHOTS=<folder> keeps a picture of each new screen at 390 and at 320 (nothing is compared).
import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { NOW, student } from './helpers.js';
import { API, fakeServer } from './fakeServer.js';
import { classFor } from './contract.js';

/** Open a route on a device with a saved state (seeded before the app starts). `at: null` leaves the clock alone. */
let seeds = 0;
async function open(page, route, state = null, { at = NOW } = {}) {
  if (at) await page.clock.setFixedTime(at);
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
const fresh = () => withServer({ profile: null });
const keyTeacher = () => withServer({ profile: { role: 'teacher', name: 'רונית', grade: '7', classes: [{ code: 'K7Q2MD', key: 'tkey-123', className: 'ז׳3', grade: '7', createdHere: true }], active: 'K7Q2MD' } });
const inClass = (extra = {}) => withServer({ profile: { role: 'student', name: 'דנה', grade: '7', know: 1, classCode: 'K7Q2MD', className: 'ז׳3', teacherName: 'רונית', token: 'stok-a1', studentId: 'a1' }, ...extra });
const baseOf = () => test.info().project.use.baseURL || 'http://127.0.0.1:4173/';
const saved = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('madregot')).state);
const sheet = (page, name) => page.getByRole('dialog', { name });
const catchClipboard = (page) => page.evaluate(() => { window.__copied = null; navigator.clipboard.writeText = (t) => { window.__copied = t; return Promise.resolve(); }; });
const copied = (page) => page.evaluate(() => window.__copied);
// the names the class's own screens know; nothing shared may hold one, nor the class's code or name
const PRIVATE = ['דנה', 'יואב', 'רונית', 'ז׳3', 'K7Q2MD'];
const holdsNothingPrivate = (text) => { for (const p of PRIVATE) expect(text, `"${p}" in: ${text}`).not.toContain(p); };

const ID = 'a000000000000001';
const given = (over = {}) => ({ id: ID, kind: 'stair', skill: 'signed:1', title: 'מספרים מכוונים: חיבור וחיסור', note: 'לקראת המבחן ביום חמישי',
  startsOn: '2026-11-05', dueOn: '2026-11-12', forAll: true, targets: [], createdAt: '2026-11-05T07:00:00.000Z', ...over });

/** A picture of the screen at 390 and at 320, for a look (SCHOOL_LINKS_SHOTS). */
async function look(page, name) {
  const dir = process.env.SCHOOL_LINKS_SHOTS;
  if (!dir || test.info().project.name !== 'phone') return;
  mkdirSync(dir, { recursive: true });
  const was = page.viewportSize();
  for (const [w, h] of [[390, 844], [320, 568]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `${dir}/${name}-${w}.png` });
  }
  await page.setViewportSize(was);
}

test.describe('COUNCIL2-35: an assignment\'s own link', () => {
  test('the teacher\'s sheet: the link, the message, Classroom and the Moodle fields, with no student\'s name', async ({ page }) => {
    await fakeServer(page, { assignments: [given()] }, baseOf());
    await open(page, '#/teacher?tab=work', keyTeacher());
    await page.getByRole('list', { name: 'משימות פתוחות' }).getByRole('button', { name: /מספרים מכוונים: חיבור וחיסור/ }).click();
    const d = sheet(page, 'מספרים מכוונים: חיבור וחיסור');
    const toggle = d.getByRole('button', { name: 'קישור למשימה לשיתוף' });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect((await toggle.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await toggle.click();
    await expect(d.getByRole('button', { name: 'הסתרת הקישור למשימה' })).toHaveAttribute('aria-expanded', 'true');
    const share = d.getByRole('region', { name: 'הקישור למשימה' });
    const link = `${baseOf()}#/a/${ID}`;
    const message = `משימה חדשה במדרגות: מספרים מכוונים: חיבור וחיסור, עד יום חמישי 12.11. פותחים את הקישור, והמשימה נפתחת. ${link}`;
    await expect(share.getByTestId('work-message')).toHaveText(message);
    // the first action has the focus, so a keyboard goes on from the link's own buttons
    await expect(share.getByRole('button', { name: 'העתקת הודעה לתלמידים' })).toBeFocused();
    await look(page, 'assignment-link');
    await catchClipboard(page);
    await share.getByRole('button', { name: 'העתקת הודעה לתלמידים' }).click();
    await expect(page.getByText('ההודעה הועתקה')).toBeVisible();
    expect(await copied(page)).toBe(message);
    await share.getByRole('button', { name: 'העתקת הקישור' }).click();
    await expect(page.getByText('הקישור הועתק')).toBeVisible();
    expect(await copied(page)).toBe(link);
    const classroom = share.getByRole('link', { name: 'שיתוף ב־Google Classroom' });
    await expect(classroom).toHaveAttribute('href', `https://classroom.google.com/share?url=${encodeURIComponent(link)}&title=${encodeURIComponent('מספרים מכוונים: חיבור וחיסור')}`);
    await expect(classroom).toHaveAttribute('rel', 'noopener noreferrer');

    // Moodle's URL activity: a name, the address and a description, shown and copied in one
    const moodle = share.getByRole('button', { name: 'פרטים לפעילות קישור ב־Moodle' });
    await expect(moodle).toHaveAttribute('aria-expanded', 'false');
    await moodle.click();
    await expect(moodle).toHaveAttribute('aria-expanded', 'true');
    const fields = share.getByRole('region', { name: 'פרטים לפעילות קישור ב־Moodle' });
    await expect(fields.locator('dd').nth(0)).toHaveText('מספרים מכוונים: חיבור וחיסור · מדרגות');
    await expect(fields.locator('dd').nth(1)).toHaveText(link);
    await expect(fields.locator('dd').nth(2)).toContainText('עד יום חמישי 12.11');
    await fields.scrollIntoViewIfNeeded();
    await look(page, 'assignment-moodle');
    await fields.getByRole('button', { name: 'העתקת הפרטים ל־Moodle' }).click();
    await expect(page.getByText('הפרטים הועתקו')).toBeVisible();
    const text = await copied(page);
    expect(text.split('\n')).toHaveLength(3);
    expect(text).toMatch(new RegExp(`^שם: .+\\nכתובת: ${link.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}\\nתיאור: .+$`));
    // nothing of a student, the teacher or the class in what leaves the sheet (the class's code is not in the link)
    for (const t of [message, text, decodeURIComponent(await classroom.getAttribute('href'))]) holdsNothingPrivate(t);
  });

  test('a phone with no one on it: the work and the class, the join, then the stair with ?assignment=', { tag: '@contract' }, async ({ page }) => {
    const srv = await fakeServer(page, { assignments: [given()] }, baseOf());
    // the real Worker: a class made by its teacher, and the stair given to the whole class
    let id = ID; let className = 'ז׳3';
    if (srv.contract) {
      const c = await classFor(srv);
      const dueOn = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
      const a = await srv.api('/api/teacher/assignments', { method: 'POST', headers: { 'X-Class-Code': c.code, 'X-Teacher-Key': c.teacherKey }, body: { kind: 'stair', skill: 'signed:1', title: 'מספרים מכוונים: חיבור וחיסור', dueOn } });
      id = a.assignment.id; className = c.className;
    }
    await open(page, `#/a/${id}`, fresh(), { at: srv.contract ? null : NOW });
    const card = page.getByRole('region', { name: 'המשימה' });
    await expect(card).toContainText('מדרגה');
    await expect(card.getByRole('heading', { name: 'מספרים מכוונים: חיבור וחיסור' })).toBeVisible();
    await expect(card).toContainText(`כיתה ${className}`);
    await expect(page.getByRole('heading', { name: `מצטרפים לכיתה ${className}` })).toBeFocused();
    // the link's own request carries no one: no token, no device, and the answer names no student
    const linkCall = srv.log.find((r) => r.path === `/api/work/${id}`);
    expect(linkCall.method).toBe('GET');
    expect(linkCall.headers.authorization).toBeUndefined();
    await look(page, 'assignment-open-join');

    // a PIN that is not 4 digits is caught on the phone
    await page.getByLabel('השם שלכם').fill('נועה');
    await page.getByLabel('קוד אישי של 4 ספרות').fill('12');
    await page.getByRole('button', { name: 'הצטרפות ופתיחת המשימה' }).click();
    await expect(page.getByRole('alert')).toHaveText('בחרו קוד אישי של 4 ספרות.');
    await page.getByLabel('קוד אישי של 4 ספרות').fill('2468');
    await page.getByRole('button', { name: 'הצטרפות ופתיחת המשימה' }).click();
    await expect(page).toHaveURL(new RegExp(`#/learn/signed/1\\?assignment=${id}$`));
    const join = srv.log.find((r) => /^\/api\/classes\/[A-Z0-9]+\/join$/.test(r.path));
    expect(join.body).toMatchObject({ name: 'נועה', pin: '2468' });
    const p = (await saved(page)).profile;
    expect(p).toMatchObject({ role: 'student', name: 'נועה', grade: '7' });
    expect(p.token).toBeTruthy();
    expect(srv.log.some((r) => r.path === '/api/class/work' && r.headers.authorization === `Bearer ${p.token}`)).toBe(true);
  });

  test('a class student: the check opens at once, with ?assignment=; with no answer and nothing kept, it says so', async ({ page }) => {
    const check = given({ id: 'a000000000000002', kind: 'check', skill: 'signed:2', title: 'בדיקת שליטה: השוואת מספרים' });
    await fakeServer(page, { assignments: [given(), check] }, baseOf());
    await open(page, '#/a/a000000000000002', inClass());
    await expect(page).toHaveURL(/#\/lesson\/signed\/2\?kind=check&purpose=mastery&assignment=a000000000000002$/);
    // the link answers, but the class's work does not and the phone keeps none: no "not yours", only no connection
    const lost = (route) => route.abort('internetdisconnected');
    await page.route('**/api/class/work', lost);
    await open(page, `#/a/${ID}`, inClass());
    await expect(page.getByRole('alert')).toHaveText('אין חיבור לשרת. בדקו את האינטרנט ונסו שוב.');
    await expect(page.getByText('המשימה הזו לא נשלחה אליכם')).toHaveCount(0);
    await page.unroute('**/api/class/work', lost);
    await page.getByRole('button', { name: 'לנסות שוב' }).click();
    await expect(page).toHaveURL(new RegExp(`#/learn/signed/1\\?assignment=${ID}$`));
  });

  test('another class\'s student, a teacher, an unknown link, a closed class and no server: each says so, nothing changes', async ({ page }) => {
    const { st, log } = await fakeServer(page, { assignments: [given()] }, baseOf());
    // another class: its name, and this phone's student stays as they were (their own work holds nothing of this class)
    st.studentTokens['stok-b8'] = 'z9'; st.elsewhere = ['z9'];
    const other = inClass();
    other.state.profile = { ...other.state.profile, classCode: 'B8R3TN', className: 'ח׳2', token: 'stok-b8', studentId: 'z9' };
    await open(page, `#/a/${ID}`, other);
    await expect(page.getByText('המשימה הזו של כיתה ז׳3, והיא נפתחת בטלפונים של התלמידים שם. אתם בכיתה אחרת, ושום דבר כאן לא השתנה.')).toBeVisible();
    expect((await saved(page)).profile).toMatchObject({ classCode: 'B8R3TN', className: 'ח׳2', token: 'stok-b8' });
    await expect(page.getByRole('link', { name: 'למשימות שלי' })).toBeVisible();
    await look(page, 'assignment-open-other');
    // a teacher: the link is the students'
    await open(page, `#/a/${ID}`, keyTeacher());
    await expect(page.getByText('זה קישור למשימה בשביל התלמידים. בטלפון של תלמיד או תלמידה בכיתה הוא פותח את המשימה.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'ללוח המורה' })).toBeVisible();
    // an assignment the teacher deleted
    await open(page, '#/a/ffffffffffffffff', fresh());
    await expect(page.getByText('לא מצאנו את המשימה. ייתכן שהמורה מחק אותה.')).toBeVisible();
    // a closed class says so before the join (a member still comes in with their name and PIN)
    st.joinLocked = true;
    await open(page, `#/a/${ID}`, fresh());
    await expect(page.getByRole('note')).toHaveText('הכיתה סגורה כרגע לתלמידים חדשים. מי שכבר בכיתה מתחבר עם השם והקוד האישי.');
    // a copy of the app with no server asks nothing
    const n = log.length;
    await open(page, `#/a/${ID}`, student('7'));
    await expect(page.getByText('המשימות של הכיתה נפתחות באפליקציה של הכיתה, בכתובת שהמורה נתן.')).toBeVisible();
    expect(log.slice(n).filter((r) => r.path.startsWith('/api/work/'))).toHaveLength(0);
  });

  // A school behind one address: the public route counts the links a network opens in a day (300), and a class
  // student's phone must never be held back by it. The phone opens the work from the student's own list and asks the
  // public route nothing; when the route does refuse someone, they are shown a way forward, not only "tomorrow".
  test('a network that used up its links of the day: a class student\'s work still opens, and nobody is only told to wait', async ({ page }) => {
    const { st, log } = await fakeServer(page, { assignments: [given()] }, baseOf());
    st.linksFull = true;
    // a class student: the stair opens, and the public route was never asked
    await open(page, `#/a/${ID}`, inClass());
    await expect(page).toHaveURL(new RegExp(`#/learn/signed/1\\?assignment=${ID}$`));
    expect(log.filter((r) => r.path.startsWith('/api/work/'))).toHaveLength(0);
    expect(log.filter((r) => r.path === '/api/class/work').length).toBeGreaterThan(0);

    // a phone whose class token the server no longer knows (signed out by a fourth device) is counted as anyone: it is
    // sent to the student's missions
    const stale = inClass();
    stale.state.profile = { ...stale.state.profile, token: 'stok-gone' };
    await open(page, `#/a/${ID}`, stale);
    await expect(page.getByText('היום נפתחו הרבה קישורים מהרשת הזו, ולכן הקישור לא נפתח כרגע. המשימות שלכם מחכות במסך המשימות.')).toBeVisible();
    await expect(page.getByText('מחר')).toHaveCount(0);
    const mine = page.getByRole('link', { name: 'למשימות שלי' });
    expect((await mine.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await look(page, 'assignment-open-slow-student');
    await mine.click();
    await expect(page).toHaveURL(/#\/quests$/);

    // a phone with no one on it: the class code is the other way in
    await open(page, `#/a/${ID}`, fresh());
    await expect(page.getByText('היום נפתחו הרבה קישורים מהרשת הזו, ולכן הקישור לא נפתח כרגע. אפשר להצטרף לכיתה מדף הבית עם קוד הכיתה שהמורה נתן, או לנסות את הקישור שוב מחר.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'לדף הבית' })).toBeVisible();
    await look(page, 'assignment-open-slow-new');
  });
});

test.describe('COUNCIL2-36: passing the app on without the class', () => {
  test('"שליחה לעמית/ה": the demo class\'s link, nothing of this class; on another phone it opens the made-up board', async ({ page, browser }) => {
    await fakeServer(page, {}, baseOf());
    await open(page, '#/teacher', keyTeacher());
    await page.getByRole('navigation', { name: 'כלים' }).getByRole('button', { name: 'שליחה לעמית/ה' }).click();
    const s = sheet(page, 'שליחה לעמית/ה');
    await expect(s).toBeVisible();
    const link = `${baseOf()}#/?start=demo`;
    const message = s.getByTestId('share-message');
    await expect(message).toContainText(link);
    const text = (await message.textContent()).replace(/\s+/g, ' ').trim();
    holdsNothingPrivate(text);
    await expect(s.getByRole('link', { name: 'וואטסאפ' })).toHaveAttribute('href', new RegExp(encodeURIComponent(link).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    await look(page, 'colleague-sheet');
    await catchClipboard(page);
    await s.getByRole('button', { name: 'העתקת ההודעה' }).click();
    await expect(page.getByText('ההודעה הועתקה')).toBeVisible();
    const sent = await copied(page);
    expect(sent.endsWith(link)).toBe(true);
    holdsNothingPrivate(sent);
    for (const b of await s.locator('.ts-actions > *').all()) expect((await b.boundingBox()).height).toBeGreaterThanOrEqual(44);

    // the colleague's phone: the demo board, with no sign-up and no request to the server
    const u = test.info().project.use;
    const ctx = await browser.newContext({ baseURL: baseOf(), viewport: u.viewport, isMobile: u.isMobile, hasTouch: u.hasTouch, locale: 'he-IL', reducedMotion: 'reduce', serviceWorkers: 'block' });
    const them = await ctx.newPage();
    const calls = [];
    them.on('request', (r) => { if (r.url().includes('/api/')) calls.push(r.url()); });
    await them.goto(link);
    await expect(them.getByRole('heading', { name: 'ז׳3 (דוגמה)' })).toBeVisible();
    expect(calls).toEqual([]);
    await ctx.close();
  });

  test('the class goal\'s card: the total against the goal, no name in the card or the message', async ({ page }) => {
    await fakeServer(page, { goal: { on: true, week: '2026-11-01', target: 60, have: 23, reached: false, custom: null } }, baseOf());
    await open(page, '#/teacher', keyTeacher());
    const chip = page.getByRole('button', { name: 'מטרת הכיתה: 23 מתוך 60. שיתוף' });
    await expect(chip).toContainText('מטרת הכיתה: 23/60');
    expect((await chip.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await chip.click();
    const s = sheet(page, 'מטרת הכיתה השבוע');
    const card = s.getByRole('figure', { name: 'מטרת הכיתה השבוע: 23 מתוך 60 צעדים' });
    await expect(card).toContainText('23 מתוך 60 צעדים');
    const message = s.getByTestId('share-message');
    await expect(message).toContainText('השבוע הכיתה שלנו במדרגות: 23 צעדים מתוך 60, במטרה שהציבה לעצמה.');
    await expect(message).toContainText(baseOf());
    holdsNothingPrivate(await s.textContent());
    await look(page, 'goal-share');
    await catchClipboard(page);
    await s.getByRole('button', { name: 'העתקת ההודעה' }).click();
    await expect(page.getByText('ההודעה הועתקה')).toBeVisible();
    holdsNothingPrivate(await copied(page));
    await s.getByRole('button', { name: 'סגירה' }).click();
    await expect(chip).toBeFocused();
  });
});
