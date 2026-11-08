// Core journeys: first visit, placement test, a whole lesson with XP and saved progress,
// the AI tutor and the teacher view when there is no server, and a printable practice exam.
import { test, expect } from '@playwright/test';
import { open, student, item, answer, type, proceed, proceedToNext, saved, expectUsable, leaveEndScreens } from './helpers.js';

// Journeys run on one phone and on desktop; the layout spec covers every size.
test.beforeEach(({}, info) => { test.skip(!['phone', 'desktop'].includes(info.project.name), 'journeys run on phone and desktop'); });

/** From the home screen: today's mission opens the stair, and its practice stage starts the lesson. */
async function startPractice(page) {
  await page.locator('.continue-go').click();
  await page.getByRole('button', { name: 'מתרגלים לבד: פתיחה' }).click();
}

async function onboard(page, start) {
  await page.getByRole('button', { name: 'מתחילים', exact: true }).click();
  await page.fill('#w-name', 'נועה');
  await page.getByRole('button', { name: 'המשך', exact: true }).click();
  await page.getByRole('radio', { name: /^כיתה ז׳/ }).click();
  await page.getByRole('button', { name: 'המשך', exact: true }).click();
  await page.getByRole('radio', { name: /^קצת מוכר/ }).click();
  await page.getByRole('button', { name: 'המשך', exact: true }).click();
  await page.getByRole('button', { name: 'המשך', exact: true }).click(); // daily goal: the default
  await page.getByRole('radio', { name: start === 'test' ? /^בדיקת רמה קצרה/ : /^מתחילים מההתחלה/ }).click();
  await page.getByRole('button', { name: start === 'test' ? 'לבדיקת הרמה' : 'לשיעור הראשון', exact: true }).click();
}

test('first visit, starting from the first stair: it starts by understanding, and the map waits under today\'s mission', async ({ page }) => {
  await open(page, '#/');
  await onboard(page, 'scratch');
  await expect(page).toHaveURL(/#\/learn\/signed\/1\/A/);
  await expect(page.locator('.step-player')).toBeVisible();
  await page.getByRole('button', { name: 'סגירה. המקום נשמר' }).click();
  await expect(page.locator('.journey')).toBeVisible();
  await page.getByRole('link', { name: 'למפה' }).click();
  await expect(page.locator('.continue')).toBeVisible();
  await expect(page.locator('.unit').first()).toBeVisible();
  await expect(page.locator('.node-current').first()).toBeVisible();
  const st = await saved(page);
  expect(st.profile).toMatchObject({ name: 'נועה', grade: '7', know: 1 });
  await page.reload();
  await expect(page.locator('.continue')).toBeVisible(); // the profile survives a reload
});

test('first visit with the placement test: every topic gets a starting stair', async ({ page }) => {
  await open(page, '#/');
  await onboard(page, 'test');
  await expect(page).toHaveURL(/#\/placement/);
  await expect.poll(() => item(page)).toBeTruthy(); // the first question is on screen
  for (let n = 0; n < 12; n += 1) {
    if (await page.locator('.done-screen').count()) break;
    const it = await item(page);
    await answer(page, it.level <= 2);
    await proceedToNext(page, it); // the next answer must not be given to this exercise
  }
  await expect(page.getByText('מצאנו את המדרגה שלכם')).toBeVisible();
  await expect(page.locator('.place-row')).toHaveCount(3);
  const st = await saved(page);
  expect(Object.values(st.placement.results).every((r) => r.level === 2)).toBe(true);
  await leaveEndScreens(page);
  await expect(page.locator('#board-title')).toBeVisible();
});

test('a whole lesson: a mistake, its retry, the reveal, the end screens, XP and the path are saved', async ({ page }) => {
  await open(page, '#/lesson/signed/1', student('7'));
  await answer(page, false);
  await expect(page.locator('section.fb-retry')).toBeVisible();
  await proceed(page);
  await answer(page, false);
  await expect(page.locator('section.fb-reveal')).toBeVisible();
  await proceed(page);
  for (let n = 0; n < 16 && !(await page.locator('.done-screen').count()); n += 1) {
    await proceedToNext(page, await answer(page, true));
    if (await page.locator('.combo-pop').count()) await page.locator('.combo-pop').click();
  }
  await expect(page.locator('.done-screen')).toBeVisible();
  await expect(page.locator('.stat-gold')).toContainText('+');
  await leaveEndScreens(page);
  await expect(page.locator('.learn')).toBeVisible();
  const st = await saved(page);
  expect(st.xp).toBeGreaterThan(0);
  expect(st.path.signed.parts['1']).toBe(1);
  expect(st.days['2026-11-05'].lessons).toBe(1);
  await page.reload();
  expect((await saved(page)).xp).toBe(st.xp);
});

test('after a wrong try, a pasted or replaced answer is taken whole (not only its last character)', async ({ page }) => {
  await open(page, '#/lesson/signed/3', student('7'));
  expect((await item(page)).form).toBe('num');
  const box = page.locator('#slot-v');
  await box.fill('97');
  await page.getByRole('button', { name: 'בדיקה', exact: true }).first().click();
  await expect(page.locator('section.fb-retry')).toBeVisible();
  await proceed(page);
  await expect(box).toHaveClass(/struck/);
  await box.fill('41');
  await expect(box).toHaveValue('41');
  await expect(box).not.toHaveClass(/struck/);
});

test('the AI tutor without a connection says so and offers a way on, without actions that would fail', async ({ page }) => {
  await open(page, '#/assistant', student('7'));
  await expect(page.getByRole('heading', { name: 'העוזר עוד לא מחובר' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'כתיבת תרגילים' })).toHaveCount(0);
  await expect(page.locator('#chat-draft')).toHaveCount(0);
  await expectUsable(page, page.getByRole('link', { name: 'להמשיך לתרגל' }), 'the way back to practice');
  await page.getByRole('link', { name: 'להמשיך לתרגל' }).click();
  await expect(page.locator('.learn')).toBeVisible();
});

test('the teacher view without a server explains it and how to turn it on', async ({ page }) => {
  await open(page, '#/');
  await page.getByRole('button', { name: 'אני מורה', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'לוח המורה עובד עם שרת הכיתה' })).toBeVisible();
  await expect(page.locator('.teacher-off-steps li')).toHaveCount(3);
  await page.getByRole('button', { name: 'חזרה', exact: true }).click();
  await expect(page.getByRole('button', { name: 'מתחילים', exact: true })).toBeVisible();
});

test('a practice exam is made from the chosen topics and prints without the app around it', async ({ page }) => {
  await open(page, '#/exams/new', student('7'));
  await page.getByRole('button', { name: 'הכנת המבחן' }).click();
  await expect(page.locator('.exam-sheet, .page-sheet, ol').first()).toBeVisible();
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.tabbar')).toBeHidden();
});

test('Back from a lesson started on the map, with a partial answer: it asks, staying keeps the answer, fast repeated Backs keep asking', async ({ page }) => {
  const sheet = page.getByRole('heading', { name: 'לצאת מהשיעור?' });
  await open(page, '#/', student('7'));
  await startPractice(page); // from the home screen, the way a student starts practising
  await expect.poll(() => item(page)).toBeTruthy();
  const lessonUrl = page.url();
  // a partial answer, not checked: a digit typed, or the interactive object moved one step
  const manip = (await item(page)).form === 'manip';
  const kept = manip ? page.locator('.manip .step-label b').first() : page.locator('#slot-v');
  if (manip) await page.locator('.manip .step-btn:not(:disabled)').first().click();
  else { await page.locator('#slot-v').click(); await type(page, '7'); }
  const partial = manip ? await kept.textContent() : '7';
  await page.goBack();
  await expect(sheet).toBeVisible();
  await expect(page).toHaveURL(lessonUrl); // the router puts the address back right after it blocks
  await page.getByRole('button', { name: 'להמשיך ללמוד' }).click();
  await expect(sheet).toHaveCount(0);
  if (manip) await expect(kept).toHaveText(partial); else await expect(kept).toHaveValue(partial);
  // three quick Backs in a row: still in the lesson, still asking
  await page.goBack(); await page.goBack(); await page.goBack();
  await expect(sheet).toBeVisible();
  await expect(page).toHaveURL(lessonUrl);
  await page.getByRole('button', { name: 'יציאה', exact: true }).click();
  await expect(page.locator('.journey')).toBeVisible(); // Back leaves to where the lesson was started: the stair
});

test('Back after answering keeps the lesson progress when the student stays', async ({ page }) => {
  await open(page, '#/', student('7'));
  await startPractice(page);
  await expect.poll(() => item(page)).toBeTruthy();
  for (let k = 0; k < 2; k += 1) await proceedToNext(page, await answer(page, true));
  const pct = await page.locator('[role="progressbar"]').getAttribute('aria-valuenow');
  await page.goBack();
  await page.getByRole('button', { name: 'להמשיך ללמוד' }).click();
  await expect(page.locator('[role="progressbar"]')).toHaveAttribute('aria-valuenow', pct);
});

test('a lesson opened straight from a link: Back asks, and leaving goes to the map, not out of the app', async ({ page }) => {
  await open(page, '#/lesson/signed/1?part=1', student('7'));
  await expect.poll(() => item(page)).toBeTruthy();
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'לצאת מהשיעור?' })).toBeVisible();
  await page.getByRole('button', { name: 'יציאה', exact: true }).click();
  await expect(page.locator('.continue')).toBeVisible();
});

test('the QA hook: the current exercise is in <html data-qa-item>, readable from an isolated script context', async ({ page, browserName }, info) => {
  test.skip(info.project.name !== 'phone' || browserName !== 'chromium', 'one run is enough; isolated worlds are a Chromium feature');
  await open(page, '#/lesson/coord/1?part=1', student('7'));
  const it = await item(page);
  const fromHtml = JSON.parse(await page.locator('html').getAttribute('data-qa-item'));
  expect(fromHtml.key).toBe(it.key);
  expect(fromHtml.answer).toEqual(it.answer);
  const cdp = await page.context().newCDPSession(page);
  const { frameTree } = await cdp.send('Page.getFrameTree');
  const { executionContextId } = await cdp.send('Page.createIsolatedWorld', { frameId: frameTree.frame.id, worldName: 'qa-probe' });
  const r = await cdp.send('Runtime.evaluate', { expression: 'JSON.parse(document.documentElement.dataset.qaItem).key', contextId: executionContextId, returnByValue: true });
  expect(r.result.value).toBe(it.key);
  // it follows the exercise
  await proceedToNext(page, await answer(page, true));
  const next = await item(page);
  expect(JSON.parse(await page.locator('html').getAttribute('data-qa-item')).key).toBe(next.key);
});

test('a lesson from the improvement plan counts for the daily plan quest', async ({ page }) => {
  await open(page, '#/plan', student('7', { mistakes: { 'signed:sign': 3 } }));
  const link = page.locator('a[href*="from=plan"]').first();
  await expect(link).toBeVisible();
  await link.click();
  await expect.poll(() => item(page)).toBeTruthy(); // the lesson's first exercise is on screen
  for (let n = 0; n < 20 && !(await page.locator('.done-screen').count()); n += 1) {
    await proceedToNext(page, await answer(page, true));
    if (await page.locator('.combo-pop').count()) await page.locator('.combo-pop').click();
  }
  await expect(page.locator('.done-screen')).toBeVisible();
  expect((await saved(page)).days['2026-11-05'].planLessons).toBe(1);
});
