// The teacher's one-time code after a PIN reset (COUNCIL2-25), end to end against the fake server (e2e/fakeServer.js
// answers as the Worker: claim_code_needed without the code, claim_code_bad when it does not match). The teacher resets
// a student's PIN on the student's page and sees the code once, with a calm line, a 44px copy button and the code
// spelled for a screen reader; the student, on another phone, joins under the same name, is asked for the code in plain
// words, and comes back in with it and a new PIN. Every name is synthetic.
// SHOTS=<folder> keeps a picture of each new screen there (the teacher's code box and the student's claim step).
import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { open, student } from './helpers.js';
import { API, fakeServer } from './fakeServer.js';

const CODE = 'H4WQ7N';
const withServer = (extra = {}) => ({ ...student('7', { ai: { mode: 'server', apiUrl: API, key: '', device: '', introSeen: true }, ...extra }), version: 3 });
const keyTeacher = () => withServer({ profile: { role: 'teacher', name: 'רונית', grade: '7', classes: [{ code: 'K7Q2MD', key: 'tkey-123', className: 'ז׳3', grade: '7', createdHere: true }], active: 'K7Q2MD' } });
const baseOf = () => test.info().project.use.baseURL;

/** A picture of the screen for a look outside the suite (SHOTS=<folder>), at the project's size and at 320 x 568. */
async function look(page, name, what) {
  const dir = process.env.SHOTS; if (!dir) return;
  mkdirSync(dir, { recursive: true });
  const size = page.viewportSize();
  await what.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${dir}/${name}-${size.width}.png` });
  await page.setViewportSize({ width: 320, height: 568 });
  await what.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${dir}/${name}-320.png` });
  await page.setViewportSize(size);
}

test('the teacher resets דנה\'s PIN and gives her the one-time code; she comes back in with it and a new PIN', async ({ page, browser }) => {
  // דנה joined K7Q2MD earlier with her PIN 1234 (a member of the class on the fake server)
  const { st, attach } = await fakeServer(page, { members: [{ id: 'a1', name: 'דנה', pin: '1234', tokens: [] }] }, baseOf());
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await open(page, '#/teacher', keyTeacher());
  await page.getByRole('tab', { name: 'תלמידים' }).click();
  await page.getByRole('row', { name: /דנה/ }).getByRole('button', { name: 'פרטים על דנה' }).click();
  const sheet = page.getByRole('dialog', { name: 'דנה' });
  await sheet.getByRole('button', { name: 'איפוס קוד אישי' }).click();

  // the code, once: a group named for her, the code large and left to right, what to do with it, and the copy button
  const box = sheet.getByRole('group', { name: 'קוד הכניסה של דנה' });
  await expect(box).toBeVisible();
  await expect(box).toBeFocused();
  await expect(box.locator('.ss-claim-code bdi')).toHaveText(CODE);
  await expect(box.locator('.ss-claim-code bdi')).toHaveAttribute('dir', 'ltr');
  await expect(box.locator('.visually-hidden')).toHaveText('H 4 W Q 7 N');
  await expect(box).toContainText('תנו את הקוד לדנה. בכניסה הבאה כותבים אותו ובוחרים קוד אישי חדש.');
  await expect(box).toContainText('הקוד עובד פעם אחת, עד 7 ימים. הוא מוצג רק עכשיו. אם הוא הולך לאיבוד, אפשר לתת קוד חדש.');
  const copy = box.getByRole('button', { name: 'העתקת הקוד H 4 W Q 7 N' });
  expect((await copy.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await look(page, 'teacher-claim-code', copy);
  await copy.click();
  await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'הקוד הועתק' })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(CODE);
  expect(st.students.find((s) => s.id === 'a1').pinReset).toBe(true);

  // the sheet opened again: the code is not shown again; she is waiting for it, and a new one can be given
  await sheet.getByRole('button', { name: 'סגירה' }).click();
  await page.getByRole('row', { name: /דנה/ }).getByRole('button', { name: 'פרטים על דנה' }).click();
  await expect(sheet.getByText('הקוד האישי אופס. כדי להיכנס, צריך את קוד הכניסה שנתתם.')).toBeVisible();
  await expect(sheet.getByText(CODE)).toHaveCount(0);
  await expect(sheet.getByRole('button', { name: 'קוד כניסה חדש' })).toBeVisible();

  // דנה, on a new phone: her name and a new PIN are not enough
  const u = test.info().project.use;
  const ctx = await browser.newContext({ baseURL: baseOf(), viewport: u.viewport, isMobile: u.isMobile, hasTouch: u.hasTouch, deviceScaleFactor: u.deviceScaleFactor, locale: 'he-IL', reducedMotion: 'reduce' });
  await attach(ctx);
  const kid = await ctx.newPage();
  await open(kid, '#/', withServer({ profile: null }));
  await kid.getByRole('button', { name: 'מתחילים', exact: true }).click();
  await kid.fill('#w-name', 'דנה');
  await kid.getByRole('button', { name: 'המשך', exact: true }).click();
  await kid.getByRole('radio', { name: /^כיתה ז׳/ }).click();
  await kid.getByRole('button', { name: 'המשך', exact: true }).click();
  await kid.getByRole('radio', { name: /^קצת מוכר/ }).click();
  await kid.getByRole('button', { name: 'המשך', exact: true }).click();
  await kid.getByRole('button', { name: 'המשך', exact: true }).click(); // the daily goal: the default
  await kid.getByLabel('קוד כיתה').fill('K7Q2MD');
  await kid.getByLabel('קוד אישי של 4 ספרות').fill('5678');
  await kid.getByRole('button', { name: 'הצטרפות לכיתה' }).click();

  // the field for the teacher's code appears, with a calm note (a status, no error), and takes the focus
  await expect(kid.getByRole('status').filter({ hasText: 'המורה איפס את הקוד האישי שלכם, ונתן לכם קוד של 6 תווים. כתבו אותו כאן, ובחרו קוד אישי חדש.' })).toBeVisible();
  const field = kid.getByLabel('הקוד מהמורה');
  await expect(field).toBeFocused();
  await expect(kid.getByRole('alert')).toHaveCount(0);
  await expect(kid.getByLabel('קוד אישי חדש של 4 ספרות')).toHaveValue('5678');
  await look(kid, 'student-claim-step', kid.getByRole('button', { name: 'הצטרפות לכיתה' }));

  // a wrong code: a plain message, and still not in
  await field.fill('AAAAAA');
  await kid.getByRole('button', { name: 'הצטרפות לכיתה' }).click();
  await expect(kid.getByRole('alert')).toHaveText('הקוד מהמורה לא מתאים. בדקו אותו שוב, או בקשו מהמורה קוד חדש.');
  expect(st.members[0].pin).toBe(null);

  // the code as she copies it from the board (lower case, a space): she is back in, with her new PIN
  await field.fill('h4w q7n');
  await expect(field).toHaveValue(CODE);
  await kid.getByRole('button', { name: 'הצטרפות לכיתה' }).click();
  await expect(kid.locator('[data-sonner-toast]').filter({ hasText: 'ברוכים השבים לכיתה ז׳3' })).toBeVisible();
  expect(st.members[0]).toMatchObject({ pin: '5678', claim: null });
  expect(st.students.find((s) => s.id === 'a1').pinReset).toBe(false);
  await ctx.close();
});

// Many wrong personal codes under one name in a day (COUNCIL2-25): the Worker stops comparing PINs for a phone that
// never signed in as that student and asks for the teacher's one-time code, with the reason. The teacher's board marks
// the student, the student's page says what happened and what to do, and the child is told in plain words, with no
// alarm, that the teacher's code is the way in today.
test('many wrong codes under יואב\'s name: the board marks him, his page says what to do, and he is asked for the teacher\'s code', async ({ page, browser }) => {
  const { st, attach } = await fakeServer(page, {
    students: [{ id: 'a1', name: 'דנה' }, { id: 'b2', name: 'יואב', manyWrongPins: true }],
    members: [{ id: 'b2', name: 'יואב', pin: '4321', tokens: [], manyWrong: true }],
  }, baseOf());
  await open(page, '#/teacher', keyTeacher());
  await page.getByRole('tab', { name: 'תלמידים' }).click();

  // the board: a chip on his row only
  const row = page.getByRole('row', { name: /יואב/ });
  await expect(row.locator('.t-wrong-pins')).toHaveText('הרבה קודים שגויים');
  await expect(page.getByRole('row', { name: /דנה/ }).locator('.t-wrong-pins')).toHaveCount(0);
  await look(page, 'teacher-wrong-pins-board', row.locator('.t-wrong-pins'));

  // his page: what happened, that his own phone still works, and the reset as the remedy
  await row.getByRole('button', { name: 'פרטים על יואב' }).click();
  const sheet = page.getByRole('dialog', { name: 'יואב' });
  const note = sheet.locator('.ss-wrong-pins');
  await expect(note).toHaveText('היום היו הרבה ניסיונות להיכנס בשם של יואב עם קוד אישי שגוי. ממכשיר שכבר מחובר ומהרשת הרגילה הכניסה ממשיכה לעבוד. אם הכניסה ממכשיר אחר לא מצליחה, אפסו את הקוד האישי ותנו את קוד הכניסה החד־פעמי.');
  await expect(note).toHaveAttribute('role', 'status');
  await expect(sheet.getByRole('button', { name: 'איפוס קוד אישי' })).toBeVisible();
  await look(page, 'teacher-wrong-pins-sheet', note);

  // יואב, on a phone that never signed in as him, with his right PIN: nothing is compared, and he is told why
  const u = test.info().project.use;
  const ctx = await browser.newContext({ baseURL: baseOf(), viewport: u.viewport, isMobile: u.isMobile, hasTouch: u.hasTouch, deviceScaleFactor: u.deviceScaleFactor, locale: 'he-IL', reducedMotion: 'reduce' });
  await attach(ctx);
  const kid = await ctx.newPage();
  await open(kid, '#/', withServer({ profile: null }));
  await kid.getByRole('button', { name: 'מתחילים', exact: true }).click();
  await kid.fill('#w-name', 'יואב');
  await kid.getByRole('button', { name: 'המשך', exact: true }).click();
  await kid.getByRole('radio', { name: /^כיתה ז׳/ }).click();
  await kid.getByRole('button', { name: 'המשך', exact: true }).click();
  await kid.getByRole('radio', { name: /^קצת מוכר/ }).click();
  await kid.getByRole('button', { name: 'המשך', exact: true }).click();
  await kid.getByRole('button', { name: 'המשך', exact: true }).click(); // the daily goal: the default
  await kid.getByLabel('קוד כיתה').fill('K7Q2MD');
  await kid.getByLabel('קוד אישי של 4 ספרות').fill('4321');
  await kid.getByRole('button', { name: 'הצטרפות לכיתה' }).click();
  await expect(kid.getByRole('status').filter({ hasText: 'היום היו הרבה ניסיונות להיכנס בשם הזה עם קוד אישי שגוי. כדי להיכנס מכאן צריך קוד חד־פעמי מהמורה: בקשו אותו, כתבו אותו כאן ובחרו קוד אישי חדש.' })).toBeVisible();
  await expect(kid.getByRole('status').filter({ hasText: 'המורה איפס את הקוד האישי שלכם' })).toHaveCount(0);
  await expect(kid.getByRole('alert')).toHaveCount(0);
  const field = kid.getByLabel('הקוד מהמורה');
  await expect(field).toBeFocused();
  expect((await field.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await look(kid, 'student-claim-many-wrong', kid.getByRole('button', { name: 'הצטרפות לכיתה' }));

  // the teacher resets his code; the note leaves his page and the chip leaves the board
  await sheet.getByRole('button', { name: 'איפוס קוד אישי' }).click();
  await expect(sheet.getByRole('group', { name: 'קוד הכניסה של יואב' })).toBeVisible();
  await expect(sheet.locator('.ss-wrong-pins')).toHaveCount(0);
  expect(st.students.find((s) => s.id === 'b2')).toMatchObject({ pinReset: true, manyWrongPins: false });

  // with the teacher's code and a new PIN he is back in
  await field.fill(CODE);
  await kid.getByLabel('קוד אישי חדש של 4 ספרות').fill('8642');
  await kid.getByRole('button', { name: 'הצטרפות לכיתה' }).click();
  await expect(kid.locator('[data-sonner-toast]').filter({ hasText: 'ברוכים השבים לכיתה ז׳3' })).toBeVisible();
  expect(st.members[0]).toMatchObject({ pin: '8642', claim: null, manyWrong: false });
  await ctx.close();
});
