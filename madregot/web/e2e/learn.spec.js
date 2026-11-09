// Madregot 2.0 journeys, through the screens the way a student uses them: learning a stair before practising it,
// keeping the place, mastery only from a check without hints, a misconception repaired and verified,
// Exam Rescue from a diagnostic to a plan, today's mission, and the profile's numbers and data deletion.
import { test, expect } from '@playwright/test';
import { open, student, item, answer, saved } from './helpers.js';

test.beforeEach(({}, info) => { test.skip(!['phone', 'desktop'].includes(info.project.name), 'journeys run on phone and desktop'); });

const step = (page) => page.evaluate(() => window.__madregotStep);

/** Play the current teaching stage (A) to its end, through its own controls. */
async function playDiscover(page) {
  await expect(page.locator('.step-player')).toBeVisible();
  for (let i = 0; i < 20; i += 1) {
    await expect.poll(() => step(page)).toBeTruthy();
    const at = await page.locator('.sp-progress').getAttribute('aria-valuenow');
    const st = await step(page);
    if (st.kind === 'explore') {
      if (st.manip.kind === 'numberline') {
        const d = st.answer - st.manip.start;
        for (let k = 0; k < Math.abs(d); k += 1) await page.getByRole('button', { name: d > 0 ? 'הסמן ימינה' : 'הסמן שמאלה' }).first().click();
      }
      await page.locator('.lm-check').click();
      await expect(page.locator('.lm-actions.has-good')).toBeVisible();
    }
    if (st.kind === 'predict') {
      await page.locator('.ls-choice').nth(st.answer).click();
      await page.locator('.lm-check').click();
      await expect(page.locator('.lm-actions.has-good')).toBeVisible();
    }
    const next = page.locator('.sp-next');
    const last = (await next.textContent()).includes('לדוגמה');
    await next.click();
    if (last) return;
    await expect(page.locator('.sp-progress')).not.toHaveAttribute('aria-valuenow', at);
  }
  throw new Error('the stage did not end');
}

test('a new stair is learned before it is practised: understand, a worked example, solve together', async ({ page }) => {
  await open(page, '#/learn/signed/1', student('7'));
  await expect(page.locator('.jstage.current')).toContainText('מבינים את הרעיון');
  await page.getByRole('button', { name: 'מתחילים ללמוד' }).click();
  await expect(page).toHaveURL(/learn\/signed\/1\/A/);
  // a prediction is a commitment, not a test: a wrong guess explains, and the step still goes on
  await playDiscover(page);
  await expect(page).toHaveURL(/learn\/signed\/1\/B/);
  // a worked example comes one step at a time, each with its reason
  await page.getByRole('button', { name: 'מתחילים' }).click();
  await expect(page.locator('.worked-step')).toHaveCount(1);
  await expect(page.locator('.worked-why').first()).toBeVisible();
  for (let e = 0; e < 2; e += 1) {
    while (await page.getByRole('button', { name: /^(מתחילים|הצעד הבא)$/ }).count()) await page.getByRole('button', { name: /^(מתחילים|הצעד הבא)$/ }).click();
    await page.getByRole('button', { name: /לדוגמה הבאה|לפתור יחד/ }).click();
  }
  await expect(page).toHaveURL(/learn\/signed\/1\/C/);
  // solve together: a wrong move gets its own feedback and a hint; the last step is typed by the student
  await page.locator('.tg-step .ls-choice').nth(1).click();
  await expect(page.locator('.tg-step .ls-why.bad')).toBeVisible();
  await expect(page.locator('.tg-hints')).toBeVisible();
  await page.locator('.tg-step .ls-choice').nth(0).click();
  await page.locator('.tg-step .ls-choice').nth(0).click();
  await page.locator('.tg-input').fill('5');
  await page.getByRole('button', { name: 'בדיקה' }).click();
  await expect(page.getByText('פתרתם את הצעד האחרון לבד')).toBeVisible();
  await page.getByRole('button', { name: 'המשך' }).click();
  await page.locator('.tg-step .ls-choice').nth(0).click();
  await page.locator('.tg-input').fill('0');
  await page.getByRole('button', { name: 'בדיקה' }).click();
  await page.getByRole('button', { name: 'המשך' }).click();
  // back on the stair: understanding, the example and solving together are done; practice is next
  await expect(page.locator('.journey')).toBeVisible();
  await expect(page.locator('.jstage.done')).toHaveCount(3);
  await expect(page.locator('.jstage.current')).toContainText('מתרגלים לבד');
  // help in solving together is learning, never independent mastery
  const st = await saved(page);
  expect(Object.keys(st.learn.skills['signed:1'].taught).sort()).toEqual(['A', 'B', 'C']);
  expect(st.learn.skills['signed:1'].attempts.every((a) => !a.independent)).toBe(true);
  expect(st.learn.skills['signed:1'].mastered).toBeUndefined();
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
  const st = await saved(page);
  expect(st.learn.skills['signed:1'].mastered.box).toBe(0);
  await page.goto('./#/learn/signed/1');
  await expect(page.locator('.mastery-chip')).toContainText('שולטים לבד');
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
  const d = new Date(); d.setDate(d.getDate() + 4);
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
  await expect(page.locator('.mm-count')).toHaveText('שולטים לבד ב־0 מתוך 15');
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
  await expect(page).toHaveURL(/learn\/signed\/1\/B/);
  await page.goto('./#/quests');
  await expect(page.locator('#continue-title')).toHaveText('המשימה של היום הושלמה');
  await expect(page.locator('.today-head')).toContainText('במדרגה "חיבור וחיסור" סיימתם את שלב 1 מתוך 5 (מבינים את הרעיון). המדרגה עצמה עוד לא הושלמה: השלבים הבאים מחכים בדף שלה.');
  await page.goto('./#/learn/signed/1');
  await expect(page.locator('.jstage.done')).toHaveCount(1);
  await expect(page.locator('.mastery-chip')).toHaveText('לומדים');
});
