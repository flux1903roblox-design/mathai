// Core journeys: first visit, placement test, a whole lesson with XP and saved progress,
// the AI tutor and the teacher view when there is no server, and a printable practice exam.
import { test, expect } from '@playwright/test';
import { open, student, item, answer, type, proceed, proceedToNext, saved, expectUsable, leaveEndScreens, playDiscover, stageDone } from './helpers.js';

// Journeys run on one phone and on desktop; the layout spec covers every size.
test.beforeEach(({}, info) => { test.skip(!['phone', 'desktop'].includes(info.project.name), 'journeys run on phone and desktop'); });

/** From the missions tab: today's mission opens the first stage of the first stair; closing it shows the stair's page, whose practice stage starts the lesson. */
async function startPractice(page) {
  await page.getByRole('link', { name: 'משימות', exact: true }).click();
  await page.locator('.continue-go').click(); // today's mission: the first stage of the first stair
  await page.getByRole('button', { name: 'סגירה. המקום נשמר' }).click(); // to the stair's page
  await page.getByRole('button', { name: 'מתרגלים לבד: פתיחה' }).click();
}

async function onboard(page, start) {
  await page.getByRole('button', { name: 'מתחילים', exact: true }).click();
  await page.fill('#w-name', 'נועה');
  await page.getByRole('button', { name: 'המשך', exact: true }).click();
  await expect(page.getByText('נעים להכיר, נועה! באיזו כיתה?')).toBeVisible(); // no pronoun right after the name (STUDENT-9 §5)
  await page.getByRole('radio', { name: /^כיתה ז׳/ }).click();
  await page.getByRole('button', { name: 'המשך', exact: true }).click();
  await page.getByRole('radio', { name: /^קצת מוכר/ }).click();
  await page.getByRole('button', { name: 'המשך', exact: true }).click();
  await page.getByRole('button', { name: 'המשך', exact: true }).click(); // daily goal: the default
  await page.getByRole('radio', { name: start === 'test' ? /^בדיקת רמה קצרה/ : /^מתחילים מההתחלה/ }).click();
  await page.getByRole('button', { name: start === 'test' ? 'לבדיקת הרמה' : 'לשיעור הראשון', exact: true }).click();
}

test('first visit, starting from the first stair: it starts by understanding, and the map is the home screen', async ({ page }) => {
  await open(page, '#/');
  await onboard(page, 'scratch');
  await expect(page).toHaveURL(/#\/learn\/signed\/1\/A/);
  await expect(page.locator('.step-player')).toBeVisible();
  await page.getByRole('button', { name: 'סגירה. המקום נשמר' }).click();
  await expect(page.locator('.journey')).toBeVisible();
  await page.getByRole('button', { name: 'למפה' }).click();
  await expect(page.locator('.unit').first()).toBeVisible();
  await expect(page.locator('.node-current').first()).toBeVisible();
  const st = await saved(page);
  expect(st.profile).toMatchObject({ name: 'נועה', grade: '7', know: 1 });
  await page.reload();
  await expect(page.locator('.node-current').first()).toBeVisible(); // the profile survives a reload
});

test('the first session gives something back: the first stage earns XP and the streak, and the counters move', async ({ page }) => {
  await open(page, '#/');
  await onboard(page, 'scratch');
  await expect(page).toHaveURL(/#\/learn\/signed\/1\/A/);
  await playDiscover(page);
  // a short, calm moment: the stage, its XP, the streak started, the stair's five stages, and what comes next
  const moment = await stageDone(page, 1);
  await expect(moment.locator('.badges')).toContainText('+10 XP');
  await expect(moment.locator('.badges')).toContainText('התחלתם רצף');
  await expect(moment.locator('.stage-done-segs')).toHaveAttribute('aria-valuenow', '1');
  await expect(moment.locator('.stage-done-next')).toContainText('הבא: דוגמה פתורה');
  await expectUsable(page, moment.getByRole('button', { name: 'לדוגמה הפתורה', exact: true }), 'the way on to the next stage');
  await moment.getByRole('button', { name: 'למפה', exact: true }).click();
  // the map: today's XP and the streak moved; the unit counts its first stage; the stair says to continue
  await expect(page.locator('.top-stat.xp')).toContainText('10/20');
  await expect(page.locator('.top-stat.streak')).toContainText('1');
  const unit = page.locator('.unit').first();
  // signed numbers: six stairs (signed:6, signed fractions and decimals), so 30 stages
  await expect(unit.locator('.unit-label')).toHaveText('יחידה 1 · 1 מתוך 30 שלבים');
  await expect(unit.locator('.unit-bar')).toHaveAttribute('aria-valuenow', '1');
  await expect(unit.locator('.node-start')).toHaveText('המשך');
  await expect(page.locator('.unit-label').nth(1)).toHaveText('יחידה 2 · 5 מדרגות'); // a unit not started says its size, not "0 of 5"
  // the topics screen: the unit's bar moved, one board says it in words, and no counter reads zero
  await page.goto('./#/topics');
  await expect(page.locator('.section-card').first().locator('.qbar')).toHaveAttribute('aria-valuetext', '1 מתוך 30 שלבים');
  await expect(page.locator('.section-card').first()).toContainText('עכשיו: חיבור וחיסור');
  await expect(page.locator('.board-level')).toHaveText('מדרגה אחת בדרך לשליטה');
  await expect(page.locator('.mm-tile').first()).toHaveAttribute('aria-label', /לומדים/);
  await expect(page.locator('.mm-stats, .board-track, .mm-count')).toHaveCount(0);
  await expect(page.locator('.topics-page')).not.toContainText(/(^|\s)0 (מתוך|\/)/);
  const st = await saved(page);
  expect(st.days['2026-11-05']).toMatchObject({ xp: 10, stages: 1 });
});

test('first visit with the placement test: every topic gets a starting stair', async ({ page }) => {
  await open(page, '#/');
  await onboard(page, 'test');
  await expect(page).toHaveURL(/#\/placement/);
  await expect.poll(() => item(page)).toBeTruthy(); // the first question is on screen
  // a probe is up to three questions at a level, all right to pass it; two probes per topic at most
  for (let n = 0; n < 24; n += 1) {
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
  // what moved: this stair's stages (its practice is done), not "0 of 5 stairs"
  await expect(page.locator('.done-screen .climb-caption')).toHaveText('חיבור וחיסור: 1 מתוך 5 שלבים');
  await expect(page.locator('.done-screen')).not.toContainText('0 מתוך 5 מדרגות');
  await leaveEndScreens(page);
  await expect(page.locator('.learn')).toBeVisible();
  const st = await saved(page);
  expect(st.xp).toBeGreaterThan(0);
  expect(st.path.signed.parts['1']).toBe(1);
  expect(st.days['2026-11-05'].lessons).toBe(1);
  await page.reload();
  expect((await saved(page)).xp).toBe(st.xp);
});

test('the daily goal has its own moment after the lesson, before the streak, and is said once (STUDENT-7)', async ({ page }) => {
  await open(page, '#/lesson/signed/1', student('7', { goalXp: 10 }));
  for (let n = 0; n < 16 && !(await page.locator('.done-screen').count()); n += 1) {
    await proceedToNext(page, await answer(page, true));
    if (await page.locator('.combo-pop').count()) await page.locator('.combo-pop').click();
  }
  expect((await saved(page)).days['2026-11-05'].xp).toBeGreaterThanOrEqual(10);
  // the lesson's summary: no goal chip any more
  await expect(page.locator('.done-screen .stats')).toBeVisible();
  await expect(page.getByText('הגעתם ליעד היומי')).toHaveCount(0);
  await page.locator('.done-screen .done-actions .btn').click();
  // the goal's moment: the title, today's XP, one button; the streak comes after it
  const goal = page.locator('.goal-stage');
  await expect(goal.getByRole('heading', { level: 1 })).toHaveText('הגעתם ליעד היומי!');
  await expect(goal.locator('.goal-sub')).toContainText('XP היום. מחר מתחילים יעד חדש.');
  await expect(page.getByText('הגעתם ליעד היומי')).toHaveCount(1);
  await expect(page.locator('.streak-screen')).toHaveCount(0);
  const go = goal.getByRole('button', { name: 'המשך', exact: true });
  await expectUsable(page, go, 'the way on from the goal');
  await expect(go).toBeFocused();
  await go.click();
  await expect(page.locator('.streak-screen')).toBeVisible();
  await expect(page.getByText('הגעתם ליעד היומי')).toHaveCount(0);
});

test('settings: sound and vibration are two choices, and changing sound is remembered as a choice (STUDENT-7)', async ({ page }) => {
  await open(page, '#/settings', student('7', { sound: true }));
  const snd = page.getByRole('radiogroup', { name: 'צלילים', exact: true });
  const vib = page.getByRole('radiogroup', { name: 'רטט', exact: true });
  await expect(snd).toBeVisible();
  await expect(vib).toBeVisible(); // Chromium can vibrate
  await expect(page.getByRole('heading', { name: 'צלילים ורטט' })).toHaveCount(0);
  await expect(snd.getByRole('radio', { name: 'פועלים' })).toHaveAttribute('aria-checked', 'true');
  await expect(vib.getByRole('radio', { name: 'פועל', exact: true })).toHaveAttribute('aria-checked', 'true');
  await vib.getByRole('radio', { name: 'כבוי', exact: true }).click();
  await expect(vib.getByRole('radio', { name: 'כבוי', exact: true })).toHaveAttribute('aria-checked', 'true');
  let st = await saved(page);
  expect(st).toMatchObject({ haptics: false, sound: true });
  expect(st.prefs?.soundSet).toBeFalsy(); // vibration is not a sound choice
  await snd.getByRole('radio', { name: 'כבויים' }).click();
  st = await saved(page);
  expect(st).toMatchObject({ sound: false, prefs: { soundSet: true } });
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

test('settings: a student sees no server address or key, and this build has no adult key screen at all', async ({ page }) => {
  // The tests build the app without VITE_ALLOW_PERSONAL_KEY (like a server build): there is no personal key and no
  // server address to set anywhere. The copies made with it (publish-pages.sh) add a "מתקדם" row for adults.
  await open(page, '#/settings', student('7'));
  await expect(page.getByRole('heading', { name: 'העוזר החכם', exact: true })).toBeVisible();
  await expect(page.locator('#ai-url, #ai-key')).toHaveCount(0);
  await expect(page.getByText('מפתח אישי')).toHaveCount(0);
  await expect(page.getByText('שרת הכיתה')).toHaveCount(0);
  await expect(page.getByText(/sk-ant|workers\.dev|Anthropic/)).toHaveCount(0);
  await expect(page.getByRole('link', { name: /חיבור העוזר לשרת או למפתח/ })).toHaveCount(0);
  await page.goto('./#/settings/advanced');
  await expect(page.getByRole('heading', { name: 'הגדרות', level: 1 })).toBeVisible();
  await expect(page.locator('#ai-url, #ai-key')).toHaveCount(0);
  // a student in a class is told the class connects it; nothing to set
  await open(page, '#/settings', student('7', { profile: { role: 'student', name: 'נועה', grade: '7', classCode: 'ABC123', className: 'ז׳3', teacherName: 'רונית', token: 't', studentId: 's1' } }));
  await expect(page.getByText('העוזר מחובר דרך הכיתה של רונית')).toBeVisible();
  await expect(page.locator('#ai-url, #ai-key')).toHaveCount(0);
});

test('the teacher view without a server sends the teacher to the full app (no server set-up steps)', async ({ page }) => {
  await open(page, '#/');
  await page.getByRole('button', { name: 'אני מורה', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'לוח המורה נמצא באתר המלא' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'ללוח המורה' })).toHaveAttribute('href', 'https://example.test/#/?start=teacher');
  await expect(page.locator('.teacher-off-steps')).toHaveCount(0);
  await page.getByRole('button', { name: 'חזרה', exact: true }).click();
  await expect(page.getByRole('button', { name: 'מתחילים', exact: true })).toBeVisible();
});

test('a practice exam is made from the chosen topics and prints without the app around it', async ({ page }) => {
  await open(page, '#/exams/new', student('7'));
  // a question flow: which topics, then how many questions
  await page.getByRole('button', { name: 'המשך', exact: true }).click();
  await page.getByRole('radio', { name: /10 שאלות/ }).click();
  await page.getByRole('button', { name: 'הכנת המבחן' }).click();
  await expect(page.locator('.exam-q')).toHaveCount(10);
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
  await expect(page.locator('.node-current').first()).toBeVisible();
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

test('the improvement plan is retired: an old /plan bookmark opens the quests, and what the exam lost is listed there', async ({ page }) => {
  // a checked exam two days ago lost a point on coord:2 and got signed:1 right
  const exam = { id: 'e1', at: '2026-11-03T10:00:00.000Z', title: 'מבחן במערכת צירים', source: 'upload', score: { correct: 1, total: 2, pct: 50 },
    result: { readable: true, questions: [{ number: 1, topic: 'coord', level: 2, status: 'wrong' }, { number: 2, topic: 'signed', level: 1, status: 'correct' }] } };
  await open(page, '#/plan', student('7', { exams: [exam], mistakes: { 'signed:sign': 3 } }));
  await expect(page).toHaveURL(/#\/quests$/);
  await expect(page.getByText('התוכנית שלי לשיפור')).toHaveCount(0);
  const lost = page.getByRole('region', { name: 'מה לחזק אחרי המבחן' });
  await expect(lost.locator('li')).toHaveCount(1);
  await expect(lost).toContainText('במבחן מ־3.11 ירדו כאן נקודות. תרגול קצר ואז בדיקה.');
  // the exams tab lists the same step, and no plan
  await page.getByRole('link', { name: 'מבחנים', exact: true }).click();
  await expect(page.getByText('התוכנית שלי לשיפור')).toHaveCount(0);
  const row = page.getByRole('region', { name: 'מה לחזק אחרי המבחן' }).locator('a.hub-row');
  await expect(row).toHaveCount(1);
  await row.click();
  // a stair not started yet: its step starts with its first stage
  await expect(page).toHaveURL(/#\/learn\/coord\/2\/A$/);
  // nothing in the saved state counts plan lessons or wins any more
  const st = await saved(page);
  expect(st.wins || {}).toEqual({});
  expect(st.planBase || {}).toEqual({});
});
