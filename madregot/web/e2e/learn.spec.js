// Madregot 2.0 journeys, through the screens the way a student uses them: learning a stair before practising it,
// keeping the place, mastery only from a check without hints, a misconception repaired and verified,
// Exam Rescue from a diagnostic to a plan, today's mission, and the profile's numbers and data deletion.
import { test, expect } from '@playwright/test';
import { open, student, item, answer, saved, proceed, NOW, playDiscover, stageDone } from './helpers.js';

test.beforeEach(({}, info) => { test.skip(!['phone', 'desktop'].includes(info.project.name), 'journeys run on phone and desktop'); });

const step = (page) => page.evaluate(() => window.__madregotStep);

test('a new stair is learned before it is practised: understand, a worked example, solve together', async ({ page }) => {
  await open(page, '#/learn/signed/1', student('7'));
  await expect(page.locator('.jstage.current')).toContainText('מבינים את הרעיון');
  await page.getByRole('button', { name: 'מתחילים ללמוד' }).click();
  await expect(page).toHaveURL(/learn\/signed\/1\/A/);
  // a prediction is a commitment, not a test: a wrong guess explains, and the step still goes on
  await playDiscover(page);
  // the stage ends in a short moment: XP, the streak started, the stair's first stage of five, and what comes next
  const a = await stageDone(page, 1);
  await expect(a.locator('.badges')).toContainText('+10 XP');
  await expect(a.locator('.badges')).toContainText('התחלתם רצף');
  await expect(a.locator('.climb-caption')).toHaveText('1 מתוך 5 שלבים במדרגה');
  await expect(a.locator('.stage-done-next')).toContainText('הבא: דוגמה פתורה');
  await a.getByRole('button', { name: 'לדוגמה הפתורה', exact: true }).click();
  await expect(page).toHaveURL(/learn\/signed\/1\/B/);
  // a worked example comes one step at a time, each with its reason
  await page.getByRole('button', { name: 'מתחילים' }).click();
  await expect(page.locator('.worked-step')).toHaveCount(1);
  await expect(page.locator('.worked-why').first()).toBeVisible();
  for (let e = 0; e < 2; e += 1) {
    while (await page.getByRole('button', { name: /^(מתחילים|הצעד הבא)$/ }).count()) await page.getByRole('button', { name: /^(מתחילים|הצעד הבא)$/ }).click();
    await page.getByRole('button', { name: /לדוגמה הבאה|לפתור יחד/ }).click();
  }
  const b = await stageDone(page, 2);
  await expect(b.locator('.badges')).toContainText('+5 XP');
  await expect(b.locator('.badges')).not.toContainText('רצף'); // the streak was already kept today
  await b.getByRole('button', { name: 'לפתור יחד', exact: true }).click();
  await expect(page).toHaveURL(/learn\/signed\/1\/C/);
  // solve together: a wrong move gets its own feedback and a hint; the last step is typed by the student
  // the same rule as teaching and practice: tapping a choice only selects it; "בדיקה" at the bottom judges it
  const check = page.locator('.lm-check');
  await expect(check).toBeDisabled();
  await page.locator('.tg-step .ls-choice').nth(1).click();
  await expect(page.locator('.tg-step .ls-choice.bad')).toHaveCount(0);
  await check.click();
  await expect(page.locator('.lm-actions.has-warm .bl-result')).toBeVisible();
  await expect(page.locator('.tg-step .ls-choice.bad')).toHaveCount(1);
  await expect(page.locator('.tg-hints')).toBeVisible();
  await expect(check).toBeDisabled();
  await page.locator('.tg-step .ls-choice').nth(0).click();
  await check.click();
  await expect(page.locator('.lm-actions.has-good')).toContainText('נכון');
  await page.getByRole('button', { name: 'המשך' }).click();
  await page.locator('.tg-step .ls-choice').nth(0).click();
  await check.click();
  await page.getByRole('button', { name: 'המשך' }).click();
  await page.locator('.tg-input').fill('5');
  await page.getByRole('button', { name: 'בדיקה' }).click();
  await expect(page.getByText('פתרתם את הצעד האחרון לבד')).toBeVisible();
  await page.getByRole('button', { name: 'המשך' }).click();
  await page.locator('.tg-step .ls-choice').nth(0).click();
  await check.click();
  await page.getByRole('button', { name: 'המשך' }).click();
  // a wrong last step is diagnosed: −10 is subtracting −5 as if it were 5 (or another reading of the same number)
  await page.locator('.tg-input').fill('-10');
  await page.getByRole('button', { name: 'בדיקה' }).click();
  await expect(page.locator('.lm-actions.has-warm')).toContainText('חיסור של מספר שלילי חושב כמו חיסור של חיובי');
  await expect(page.locator('.lm-actions.has-warm')).not.toContainText('בדקו את החישוב');
  await page.locator('.tg-input').fill('0');
  await page.getByRole('button', { name: 'בדיקה' }).click();
  // right after a hint: said warmly and truthfully, never "solved alone"
  await expect(page.locator('.lm-actions.has-good')).toContainText('נכון, בעזרת רמז');
  await expect(page.getByText('פתרתם לבד')).toHaveCount(0);
  await page.getByRole('button', { name: 'המשך' }).click();
  // three stages: 25 XP, past the day's goal of 20: the goal's own moment comes first (STUDENT-7), then the stage's
  const goal = page.locator('.goal-stage');
  await expect(goal.getByRole('heading', { level: 1 })).toHaveText('הגעתם ליעד היומי!');
  await expect(goal.locator('.goal-sub')).toContainText('XP היום. מחר מתחילים יעד חדש.');
  await goal.getByRole('button', { name: 'המשך', exact: true }).click();
  const c = await stageDone(page, 3);
  await expect(c.locator('.badges')).toContainText('+10 XP');
  await expect(c).not.toContainText('יעד היומי'); // said once, on its own screen
  await expect(c.locator('.climb-caption')).toHaveText('3 מתוך 5 שלבים במדרגה');
  await expect(c.getByRole('button', { name: 'לתרגול', exact: true })).toBeVisible();
  const day = (await saved(page)).days['2026-11-05'];
  expect(day).toMatchObject({ xp: 25, stages: 3 });
  // back on the stair: understanding, the example and solving together are done; practice is next
  await page.goto('./#/learn/signed/1');
  await expect(page.locator('.journey')).toBeVisible();
  await expect(page.locator('.jstage.done')).toHaveCount(3);
  await expect(page.locator('.jstage.current')).toContainText('מתרגלים לבד');
  // help in solving together is learning, never independent mastery
  const st = await saved(page);
  expect(Object.keys(st.learn.skills['signed:1'].taught).sort()).toEqual(['A', 'B', 'C']);
  expect(st.learn.skills['signed:1'].attempts.every((a) => !a.independent)).toBe(true);
  expect(st.learn.skills['signed:1'].mastered).toBeUndefined();
  // the diagnosed last step is evidence about the misconception it fits (learning with help is still evidence of it)
  expect(st.learn.miscon['signed:1|minus-minus']).toBeTruthy();
  await page.reload();
  await expect(page.locator('.jstage.done')).toHaveCount(3);
});

test('closing a teaching stage keeps the place', async ({ page }) => {
  await open(page, '#/learn/signed/1/A', student('7'));
  for (let i = 0; i < 3; i += 1) { await page.locator('.sp-next').click(); if ((await step(page)).kind !== 'say') break; }
  const at = await page.locator('.sp-progress').getAttribute('aria-valuenow');
  await page.getByRole('button', { name: 'סגירה. המקום נשמר' }).click();
  await page.getByRole('button', { name: 'מבינים את הרעיון: פתיחה' }).click();
  await expect(page.locator('.sp-progress')).toHaveAttribute('aria-valuenow', at);
});

test('mastery comes only from a check without hints, and a missed check takes nothing away', async ({ page }) => {
  await open(page, '#/lesson/signed/1?kind=check&purpose=mastery', student('7'));
  await expect.poll(() => item(page)).toBeTruthy();
  await expect(page.getByRole('button', { name: 'רמז' })).toHaveCount(0);
  for (let i = 0; i < 5; i += 1) {
    await answer(page, i > 1); // two misses
    await expect(page.locator('section.fb-retry')).toHaveCount(0); // one try: a miss shows the answer
    await page.locator('section.fb .fb-actions .btn').click();
  }
  await expect(page.getByRole('heading', { name: 'עוד לא, וזה בסדר' })).toBeVisible();
  expect((await saved(page)).learn.skills['signed:1'].mastered).toBeUndefined();
  await page.goto('./#/lesson/signed/1?kind=check&purpose=mastery');
  await page.reload();
  await expect.poll(() => item(page)).toBeTruthy();
  for (let i = 0; i < 5; i += 1) { await answer(page, true); await page.locator('section.fb .fb-actions .btn').click(); }
  await expect(page.getByRole('heading', { name: 'שולטים לבד!' })).toBeVisible();
  // the first review is the next day: "מחר", never "בעוד 1 יום"
  await expect(page.locator('.check-done .lead')).toContainText('מחר נבדוק בקצרה שזה נשאר.');
  await expect(page.locator('.check-done .lead')).not.toContainText('1 יום');
  const st = await saved(page);
  expect(st.learn.skills['signed:1'].mastered.box).toBe(0);
  await page.goto('./#/learn/signed/1');
  await expect(page.locator('.mastery-chip')).toContainText('שולטים לבד');
  await expect(page.locator('.mastery-chip')).toContainText('בדיקה חוזרת מחר');
});

test('a confirmed misconception is repaired with its own activity, then verified', async ({ page }) => {
  const at = new Date().toISOString();
  const st = student('7');
  st.state.learn = { skills: {}, events: [], missions: {}, exam: null, miscon: { 'signed:1|minus-minus': { skill: 'signed:1', id: 'minus-minus', score: 2, seen: ['a', 'b'], state: 'confirmed', at } } };
  st.version = 2;
  await open(page, '#/quests', st);
  // today's mission starts with the repair, and says why
  await expect(page.locator('.today-items li').first()).toContainText('תיקון');
  await page.locator('.continue-go').click();
  await expect(page).toHaveURL(/repair\/signed\/1\/minus-minus/);
  await expect(page.getByText('נראה שהחלק שמבלבל הוא מה קורה כשמחסרים מספר שלילי')).toBeVisible();
  await page.getByRole('button', { name: 'בואו נראה את זה' }).click();
  await expect(page.locator('.step-player')).toBeVisible();
  for (let i = 0; i < 6; i += 1) {
    await expect.poll(() => step(page)).toBeTruthy();
    const s = await step(page);
    if (s.kind === 'explore') { const d = s.answer - s.manip.start; for (let k = 0; k < Math.abs(d); k += 1) await page.getByRole('button', { name: d > 0 ? 'הסמן ימינה' : 'הסמן שמאלה' }).first().click(); await page.locator('.lm-check').click(); }
    if (s.kind === 'predict') { await page.locator('.ls-choice').nth(s.answer).click(); await page.locator('.lm-check').click(); }
    const last = (await page.locator('.sp-next').textContent()).includes('לבדיקה');
    await page.locator('.sp-next').click();
    if (last) break;
  }
  await page.getByRole('button', { name: 'לבדיקה', exact: true }).click();
  // the verification asks where the misconception would show again
  await expect.poll(() => item(page)).toBeTruthy();
  expect((await item(page)).could).toContain('minus-minus');
  for (let i = 0; i < 3; i += 1) { await answer(page, true); await page.locator('section.fb .fb-actions .btn').click(); }
  await expect(page.getByRole('heading', { name: 'תוקן!' })).toBeVisible();
  const after = await saved(page);
  expect(after.learn.miscon['signed:1|minus-minus'].state).toBe('resolved');
  expect(Object.values(after.learn.missions)[0].items.find((x) => x.kind === 'repair').done).toBeTruthy();
});

test('Exam Rescue: the exam\'s date and stairs, a short diagnostic, then a plan that says where the student stands', async ({ page }) => {
  await open(page, '#/rescue', student('7'));
  // one question per screen; the button stays off until the question has an answer
  await expect(page.getByRole('button', { name: 'המשך', exact: true })).toBeDisabled();
  // the app's clock is fixed (NOW, a Thursday): a date on Shabbat is caught at once, then the exam is on Monday
  await page.locator('#exam-date').fill('2026-11-07');
  await page.getByRole('button', { name: 'המשך', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('שבת');
  const d = new Date(NOW); d.setDate(d.getDate() + 4);
  await page.locator('#exam-date').fill(d.toLocaleDateString('en-CA'));
  await page.getByRole('button', { name: 'המשך', exact: true }).click();
  await expect(page.getByRole('button', { name: 'המשך', exact: true })).toBeDisabled();
  await page.getByText('מספרים מכוונים (כל הנושא)').click();
  await page.getByRole('button', { name: 'המשך', exact: true }).click();
  await page.getByRole('button', { name: 'המשך', exact: true }).click(); // confidence: the default
  await page.getByRole('button', { name: /לבניית התוכנית/ }).click();
  await expect(page.locator('.rescue-msg')).toContainText('בדיקה קצרה');
  await page.getByRole('button', { name: /לבדיקה הקצרה/ }).click();
  await expect.poll(() => item(page)).toBeTruthy();
  for (let i = 0; i < 10; i += 1) { await answer(page, i % 2 === 0); await page.locator('section.fb .fb-actions .btn').click(); }
  await expect(page.getByRole('heading', { name: 'הבדיקה הסתיימה' })).toBeVisible();
  await page.getByRole('button', { name: /לתוכנית ההכנה/ }).click();
  await expect(page.locator('.rescue-msg')).toContainText('ימים למבחן');
  await expect(page.locator('.rescue-day').first()).toContainText('היום');
  await expect(page.locator('.rescue-day').last()).toContainText('מבחן תרגול');
  // no day of the plan is Shabbat (Saturday 7.11 lies between today and the exam)
  await expect(page.locator('.rescue-day')).toHaveCount(3);
  await expect(page.locator('.rescue-day-name').filter({ hasText: 'שבת' })).toHaveCount(0);
  await expect(page.getByText('התוכנית לא מבטיחה ציון')).toBeVisible();
  const st = await saved(page);
  expect(Object.keys(st.learn.exam.diagnostic)).toHaveLength(5);
  await page.goto('./#/quests');
  await expect(page.locator('.today-exam')).toContainText('ההכנה למבחן');
});

test('the profile shows what the evidence says, on this device, and can delete everything', async ({ page }) => {
  await open(page, '#/me', student('7'));
  await expect(page.getByRole('heading', { name: 'הלמידה שלי במספרים' })).toBeVisible();
  await expect(page.getByText('עוד אין מספיק נתונים').first()).toBeVisible();
  // in the student's words: three numbers, the rest under "עוד מספרים" (STUDENT-9 §6)
  const nums = page.locator('.my-numbers');
  await expect(nums.locator(':scope > .nums dt')).toHaveText(['מדרגות שאתם שולטים בהן לבד', 'נכון בניסיון הראשון, בלי רמז', 'טעויות שתיקנתם']);
  await nums.getByText('עוד מספרים', { exact: true }).click();
  await expect(nums.locator('.nums-more dt')).toHaveText(['חזרות שהצלחתם', 'ימים שלמדתם', 'כמה השליטה שלכם השתפרה', 'שליטה שנשארה גם אחרי שבוע', 'שיעורים שהתחלתם / סיימתם']);
  await expect(nums).not.toContainText('בדיקות זיכרון');
  await page.getByRole('link', { name: 'הגדרות' }).click();
  await page.getByRole('button', { name: 'מחיקת כל הנתונים' }).click();
  await page.getByRole('button', { name: 'כן, למחוק הכול' }).click();
  await expect(page.getByRole('button', { name: 'מתחילים', exact: true })).toBeVisible(); // back to the first screen
  const left = await page.evaluate(() => JSON.parse(localStorage.getItem('madregot') || 'null')?.state?.profile ?? null);
  expect(left).toBeNull();
});

test('saved progress from before 2.0 survives the update', async ({ page }) => {
  const old = student('7', { xp: 120, path: { signed: { parts: { 1: 2, 2: 1 }, reviews: 0, jumped: 0 } }, gaps: { 'signed:sign': { level: 1, n: 2, ok: 0, at: '2026-11-01T10:00:00Z' } } });
  await open(page, '#/', old);
  await expect(page.locator('.node-current').first()).toBeVisible();
  const st = await saved(page);
  expect(st.xp).toBe(120);
  expect(st.path.signed.parts['1']).toBe(2);
  expect(st.gaps['signed:sign'].n).toBe(2);
  expect(st.learn.miscon['signed:1|sign'].state).toBe('confirmed');
  // the stair finished on the map counts as practised, not as mastered
  await page.goto('./#/topics');
  await expect(page.locator('.mm-tile').first()).toHaveAttribute('aria-label', /מתרגלים/);
});

test('reviewer P1: two right diagnostic answers per stair are "passed the first check", never "mastered"', async ({ page }) => {
  await open(page, '#/rescue', student('7'));
  const d = new Date(); d.setDate(d.getDate() + 3);
  if (d.getDay() === 6) d.setDate(d.getDate() + 1); // no exam on Shabbat: the form asks for another day (STUDENT-5)
  await page.locator('#exam-date').fill(d.toLocaleDateString('en-CA'));
  await page.getByRole('button', { name: 'המשך', exact: true }).click();
  await page.getByText('חיבור וחיסור', { exact: true }).click();
  await page.getByText('השוואת מספרים', { exact: true }).click();
  await page.getByRole('button', { name: 'המשך', exact: true }).click();
  await page.getByRole('button', { name: 'המשך', exact: true }).click();
  await page.getByRole('button', { name: /לבניית התוכנית/ }).click();
  await page.getByRole('button', { name: /לבדיקה הקצרה/ }).click();
  await expect.poll(() => item(page)).toBeTruthy();
  for (let i = 0; i < 4; i += 1) { await answer(page, true); await page.locator('section.fb .fb-actions .btn').click(); }
  await expect(page.getByRole('heading', { name: 'הבדיקה הסתיימה' })).toBeVisible();
  await page.getByRole('button', { name: /לתוכנית ההכנה/ }).click();
  const msg = page.locator('.rescue-msg');
  await expect(msg).toContainText('ב־2 מתוך 2 המדרגות עברתם את הבדיקה הראשונה: כנראה מוכנים, ובדיקת שליטה קצרה תאשר.');
  await expect(msg).not.toContainText('שולטים');
  await expect(page.locator('.standing-badge')).toHaveText(['עברו את הבדיקה הראשונה', 'עברו את הבדיקה הראשונה']);
  await expect(page.locator('.standing-legend')).toContainText('זו עוד לא שליטה');
  // the plan confirms with a mastery check instead of assuming mastery
  await expect(page.locator('.rescue-day').first()).toContainText('בדיקת שליטה: חיבור וחיסור');
  // and the map says the same thing in the same words
  await page.goto('./#/topics');
  await expect(page.locator('.board-level')).not.toContainText('שולטים');
  await expect(page.locator('.mm-tile[aria-label$="שולטים לבד"]')).toHaveCount(0);
  const st = await saved(page);
  expect(st.learn.skills['signed:1']?.mastered).toBeUndefined();
});

test('reviewer P2: the mission names the stage it asks for, and its completion says the stair is not done', async ({ page }) => {
  await open(page, '#/quests', student('7'));
  const first = page.locator('.today-items li').first();
  await expect(first).toContainText('מבינים את הרעיון: חיבור וחיסור');
  await expect(first).toContainText('שלב 1 מתוך 5');
  await page.locator('.continue-go').click();
  await expect(page).toHaveURL(/learn\/signed\/1\/A/);
  await playDiscover(page);
  await stageDone(page, 1, 'לדוגמה הפתורה');
  await expect(page).toHaveURL(/learn\/signed\/1\/B/);
  await page.goto('./#/quests');
  await expect(page.locator('#continue-title')).toHaveText('המשימה של היום הושלמה');
  await expect(page.locator('.today-head')).toContainText('במדרגה "חיבור וחיסור" סיימתם את שלב 1 מתוך 5 (מבינים את הרעיון). המדרגה עצמה עוד לא הושלמה: השלבים הבאים מחכים בדף שלה.');
  await page.goto('./#/learn/signed/1');
  await expect(page.locator('.jstage.done')).toHaveCount(1);
  await expect(page.locator('.mastery-chip')).toHaveText('לומדים');
});

test('done means mastered: practice fills the ring, and only a passed mastery check marks the stair done and moves the path', async ({ page }) => {
  const at = '2026-11-04T10:00:00.000Z';
  const practised = { taught: { A: at, B: at, C: at }, attempts: Array.from({ length: 6 }, () => ({ at, ok: true, independent: true, purpose: 'practice' })) };
  const st = student('7', { path: { signed: { parts: { 1: 2 }, reviews: 0, jumped: 0, done: {} } }, learn: { skills: { 'signed:1': practised }, miscon: {}, exam: null, missions: {}, events: [] } });
  await open(page, '#/', { ...st, version: 4 });
  const unit = page.locator('.unit').first();
  // two practice lessons done: four of the stair's five stages, but no stair counted yet; the next stage is the mastery check
  await expect(unit.locator('.unit-label')).toContainText('4 מתוך 25 שלבים');
  await expect(unit.locator('.unit-label')).not.toContainText('מדרגות');
  await expect(unit.locator('.node').first()).toHaveClass(/node-current/);
  await unit.locator('.node').first().click();
  await expect(page.locator('.node-card')).toContainText('בדיקת שליטה');
  await page.locator('.node-start-btn').click();
  await expect(page).toHaveURL(/kind=check&purpose=mastery/);
  for (let i = 0; i < 5; i += 1) { await expect.poll(() => item(page)).toBeTruthy(); await answer(page, true); await proceed(page); }
  await expect(page.getByRole('heading', { name: 'שולטים לבד!' })).toBeVisible();
  // the check moves the count (the council's "0 of 5" after mastery)
  await expect(page.locator('.climb-caption')).toContainText('1 מתוך 5 מדרגות');
  await page.getByRole('button', { name: 'למפה' }).click();
  await expect(unit.locator('.unit-label')).toContainText('1 מתוך 5 מדרגות');
  await expect(unit.locator('.node').first()).toHaveClass(/node-done/);
  await expect(unit.locator('.node').nth(1)).toHaveClass(/node-current/);
});

test('a stair that was done before mastery checks stays done, and is offered its check', async ({ page }) => {
  // saved by an older version: two practice lessons made a stair done then
  await open(page, '#/', student('7', { path: { signed: { parts: { 1: 2, 2: 1 }, reviews: 0, jumped: 0 } } }));
  const unit = page.locator('.unit').first();
  await expect(unit.locator('.unit-label')).toContainText('1 מתוך 5 מדרגות');
  await expect(unit.locator('.node').first()).toHaveClass(/node-done/);
  await unit.locator('.node').first().click();
  await expect(page.locator('.node-card')).toContainText('לפני שהיו בדיקות שליטה');
  await page.getByRole('button', { name: 'לבדיקת שליטה' }).click();
  await expect(page).toHaveURL(/lesson\/signed\/1\?kind=check&purpose=mastery/);
  // the check is missed: the stair is not counted as done any more, it is open again, and the practice stays
  for (let i = 0; i < 5; i += 1) { await expect.poll(() => item(page)).toBeTruthy(); await answer(page, i > 2); await proceed(page); }
  await expect(page.getByRole('heading', { name: 'עוד לא, וזה בסדר' })).toBeVisible();
  await expect(page.locator('.check-done .lead')).toContainText('המדרגה חוזרת להיות פתוחה במפה');
  const st = await saved(page);
  expect(st.path.signed.done).toEqual({});
  expect(st.path.signed.parts).toEqual({ 1: 2, 2: 1 });
  await page.getByRole('button', { name: 'למפה' }).click();
  await expect(unit.locator('.unit-label')).not.toContainText('מדרגות');
  await expect(unit.locator('.node').first()).toHaveClass(/node-open/);
});

test('a stair mastered out of order: the stairs before it are open, not locked, and the chest stays closed', async ({ page }) => {
  // Exam Rescue sent pyth:3 straight to its mastery check, and it was passed
  const at = '2026-11-04T10:00:00.000Z';
  const st = student('8', { path: { pyth: { parts: {}, reviews: 0, jumped: 0, done: { 3: 'mastered' } } }, learn: { skills: { 'pyth:3': { attempts: [], mastered: { at, box: 0, due: '2026-11-05T10:00:00.000Z' } } }, miscon: {}, exam: null, missions: {}, events: [] } });
  await open(page, '#/', { ...st, version: 4 });
  const unit = page.locator('.unit').filter({ has: page.locator('.unit-title', { hasText: 'פיתגורס' }) });
  const nodes = unit.locator('.node');
  await expect(nodes.nth(0)).toHaveClass(/node-current/);
  await expect(nodes.nth(1)).toHaveClass(/node-open/);
  await expect(nodes.nth(2)).toHaveClass(/node-done/);
  await expect(nodes.nth(3)).toHaveClass(/node-locked/);
  // the halfway chest opens with every stair up to it done, as the store awards it
  await expect(unit.getByRole('button', { name: /^תיבת אוצר\. נפתחת/ })).toBeVisible();
});
