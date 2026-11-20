// Madregot 2.0 journeys, through the screens the way a student uses them: learning a stair before practising it,
// keeping the place, mastery only from a check without hints, a misconception repaired and verified,
// Exam Rescue from a diagnostic to a plan, today's mission, and the profile's numbers and data deletion.
import { test, expect } from '@playwright/test';
import { open, openOn, type, student, item, answer, saved, proceed, NOW, playDiscover, stageDone, leaveStage, expectNoSidewaysScroll, expectUsable, openUnit } from './helpers.js';

// journeys run on phone and desktop; a test tagged @phone-small measures the smallest phone and runs there only
// (a test whose title says "on both phones" runs on the two phones instead)
test.beforeEach(({}, info) => {
  if (info.tags.includes('@phone-small')) { test.skip(info.project.name !== 'phone-small', 'measured on the smallest phone'); return; }
  const phones = /on both phones/.test(info.title);
  test.skip(!(phones ? ['phone', 'phone-small'] : ['phone', 'desktop']).includes(info.project.name), phones ? 'this one is checked on the two phones' : 'journeys run on phone and desktop');
});

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
  // the first stage of all also brought מדי his first piece: its moment comes on the way (wardrobe.spec.js 4b)
  expect(await leaveStage(page, 'לדוגמה הפתורה')).toBe(true);
  await expect(page).toHaveURL(/learn\/signed\/1\/B/);
  // a worked example comes one step at a time, each with its reason
  await page.getByRole('button', { name: 'מתחילים' }).click();
  await expect(page.locator('.worked-step')).toHaveCount(1);
  await expect(page.locator('.worked-why').first()).toBeVisible();
  // four examples: two of one subtraction each, then the class's two chains of five bracketed numbers (CLASSROOM-2)
  for (let e = 0; e < 4; e += 1) {
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
  // a wrong last step is diagnosed from where the steps left it (SK-LEARN-4): the step wrote −5 + 5 and turned down
  // −5 − 5, so −10 is the distances added with the minus kept, not subtracting −5 as if it were 5
  await page.locator('.tg-input').fill('-10');
  await page.getByRole('button', { name: 'בדיקה' }).click();
  await expect(page.locator('.lm-actions.has-warm')).toContainText('חיברו מרחקים כשהסימנים שונים, במקום לחסר');
  await expect(page.locator('.lm-actions.has-warm')).not.toContainText('חיסור של מספר שלילי');
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
  // the diagnosed last step is evidence about the misconception it fits (learning with help is still evidence of it):
  // the distances added, not the subtraction the step had already turned down (SK-LEARN-4)
  expect(st.learn.miscon['signed:1|abs-add']).toBeTruthy();
  expect(st.learn.miscon['signed:1|minus-minus']).toBeUndefined();
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
  // two questions for each of the seven signed-number stairs (signed:6 and signed:7 included)
  for (let i = 0; i < 14; i += 1) { await answer(page, i % 2 === 0); await page.locator('section.fb .fb-actions .btn').click(); }
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
  expect(Object.keys(st.learn.exam.diagnostic)).toHaveLength(7); // the seven signed-number stairs
  await page.goto('./#/quests');
  await expect(page.locator('.today-exam')).toContainText('ההכנה למבחן');
});

test('Exam Rescue offers ז׳ Pythagoras (taught in March in ז׳) as one of theirs, and ח׳ the ז׳ algebra as revision', async ({ page }) => {
  const toTopics = async () => {
    const d = new Date(NOW); d.setDate(d.getDate() + 4);
    await page.locator('#exam-date').fill(d.toLocaleDateString('en-CA'));
    await page.getByRole('button', { name: 'המשך', exact: true }).click();
  };
  await open(page, '#/rescue', student('7'));
  await toTopics();
  const heads = page.locator('.rescue-topic-head .topic-row');
  // percent (ח׳, October) is offered to ז׳ too: they meet it in relative frequency in February; the functions unit
  // through its guest stair alone (func:1, a situation graph in May: stage5.md FUNC-6, guest.spec.js); and since
  // PRODUCT2-20 linear functions (7.9) and statistics (7.15) carry alsoFor ז׳, so Exam Rescue offers them as well. Stage
  // 2's areas and boxes sit between the expressions and the data unit, as on the map, and stage 4's transformations
  // between the angles and the expressions
  await expect(heads).toHaveText(['מספרים מכוונים (כל הנושא)', 'מערכת צירים (כל הנושא)', 'זוויות (כל הנושא)', 'טרנספורמציות (כל הנושא)', 'ביטויים אלגבריים (כל הנושא)', 'שטחים והיקפים (כל הנושא)', 'תיבה ומנסרה (כל הנושא)', 'נתונים ושכיחות (כל הנושא)', 'משוואות (כל הנושא)', 'אחוזים (כל הנושא)', 'מבוא לפונקציות (מה שלומדים בכיתה ז׳)', 'פונקציה קווית (כל הנושא)', 'משפט פיתגורס (כל הנושא)', 'סטטיסטיקה (כל הנושא)']);
  await page.getByText('מציאת ניצב', { exact: true }).click();
  await expect(page.locator('.rescue-topic').filter({ hasText: 'משפט פיתגורס' }).locator('.rescue-topic-count')).toHaveText('1/5');
  await expectNoSidewaysScroll(page);

  await open(page, '#/rescue', student('8'));
  await toTopics();
  await expect(heads.filter({ hasText: 'משפט פיתגורס' })).toHaveText('משפט פיתגורס (כל הנושא)');
  await expect(heads.filter({ hasText: 'משוואות' }).last()).toHaveText('משוואות מכיתה ז׳ (כל הנושא)');
  // this year ח׳ learns the ז׳ data unit too (8.6): it is theirs, not revision from ז׳
  await expect(heads.filter({ hasText: 'נתונים ושכיחות' })).toHaveText('נתונים ושכיחות (כל הנושא)');
  // and the transformations (8.5, November): on its path, right after the data unit, so this year's unit, not revision
  await expect(heads.filter({ hasText: 'טרנספורמציות' })).toHaveText('טרנספורמציות (כל הנושא)');
  await expect(heads.nth(2)).toHaveText('נתונים ושכיחות (כל הנושא)');
  await expect(heads.nth(3)).toHaveText('טרנספורמציות (כל הנושא)');
});

// The תשפ״ז transition year (DATA-1): ח׳ learns the ז׳ data unit too, in October–November, after percent. On the map it is
// their third unit, and its page numbers it as theirs.
test('a ח׳ student\'s map draws the data unit third, after percent, and its page says "יחידה 3"', async ({ page }) => {
  await open(page, '#/', student('8'));
  await expect(page.locator('.unit').first()).toBeVisible();
  await expect(page.locator('.unit-title').nth(1)).toHaveText('אחוזים');
  await expect(page.locator('.unit-title').nth(2)).toHaveText('נתונים ושכיחות');
  await expect(page.locator('.unit-title').filter({ hasText: 'נתונים ושכיחות' })).toHaveCount(1);
  await expectNoSidewaysScroll(page);
  await open(page, '#/topic/data', student('8'));
  await expect(page.getByText('יחידה 3', { exact: false }).first()).toBeVisible();
  await expect(page.getByText('יחידה 5', { exact: false })).toHaveCount(0);
});

test('this year\'s ח׳ map climbs the transformations after percent and the data unit, as unit 4', async ({ page }) => {
  await open(page, '#/', student('8'));
  // the open units and the folded rows (PRODUCT2-37), in the path's order
  const titles = page.locator('.unit .unit-title, .unit-row .unit-title');
  await expect(titles.nth(0)).toHaveText('יחס וקנה מידה');
  await expect(titles.nth(1)).toHaveText('אחוזים');
  await expect(titles.nth(2)).toHaveText('נתונים ושכיחות');
  await expect(titles.nth(3)).toHaveText('טרנספורמציות');
  await expect(titles.nth(4)).toHaveText('מבוא לפונקציות');
  const unit = page.locator('section.unit, section.unit-row').filter({ has: page.locator('.unit-title', { hasText: 'טרנספורמציות' }) });
  await expect(unit.locator('.unit-label')).toContainText('יחידה 4');
  // its guidebook numbers it from the student's path too
  await page.goto('./#/topic/transf');
  await expect(page.locator('.unit-label').first()).toHaveText('יחידה 4');
  await expectNoSidewaysScroll(page);
});

// GEOM-1 (curriculum stage 4): the ח׳ map climbs congruence and then isosceles triangles with similarity right after
// statistics (January to April in school), and every new unit wears its own emblem on its banner; the ז׳ map has the
// transformations between angles and expressions
async function newUnitsOnMaps(page) {
  // every unit on the path: the open ones and the folded rows (PRODUCT2-37), in the path's order
  const units = () => page.locator('.unit .unit-title, .unit-row .unit-title').allTextContents();
  await open(page, '#/', student('8'));
  await expect(page.locator('.unit').first()).toBeVisible();
  const g8 = await units();
  const at = g8.indexOf('סטטיסטיקה');
  expect(at, 'statistics is on the ח׳ map').toBeGreaterThanOrEqual(0);
  expect(g8.slice(at, at + 3)).toEqual(['סטטיסטיקה', 'חפיפת משולשים', 'שווה־שוקיים ודמיון']);
  for (const [title, id] of [['טרנספורמציות', 'transf'], ['חפיפת משולשים', 'congr'], ['שווה־שוקיים ודמיון', 'sim']]) {
    // a folded row opens with one tap; the opened unit wears its emblem on its banner
    const unit = await openUnit(page, new RegExp(`^${title}$`));
    await expect(unit).toHaveClass(new RegExp(`world-${id}`));
    await expect(unit.locator('.unit-title')).toHaveText(title);
    await unit.locator('.unit-head').scrollIntoViewIfNeeded();
    const emblem = unit.locator('.unit-head .emblem svg');
    await expect(emblem, `${id} has its emblem`).toBeVisible();
    const box = await emblem.boundingBox();
    expect(box.width, `${id}: the emblem is drawn`).toBeGreaterThan(20);
    expect(await emblem.locator('path, polygon, circle').count(), `${id}: the emblem has its shapes`).toBeGreaterThan(2);
  }
  await expectNoSidewaysScroll(page);

  await open(page, '#/', student('7'));
  await expect(page.locator('.unit').first()).toBeVisible();
  const g7 = await units();
  const t = g7.indexOf('טרנספורמציות');
  expect(g7.slice(t - 1, t + 2)).toEqual(['זוויות', 'טרנספורמציות', 'ביטויים אלגבריים']);
  const unit = await openUnit(page, /^טרנספורמציות$/);
  await expect(unit).toHaveClass(/world-transf/);
  await unit.locator('.unit-head').scrollIntoViewIfNeeded();
  await expect(unit.locator('.unit-head .emblem svg')).toBeVisible();
  // congruence and similarity are ח׳ units: not on the ז׳ map
  await expect(page.locator('.unit.world-congr, .unit.world-sim')).toHaveCount(0);
  expect(g7).not.toContain('חפיפת משולשים');
  expect(g7).not.toContain('שווה־שוקיים ודמיון');
  await expectNoSidewaysScroll(page);
}
test('the ח׳ map shows congruence and similarity after statistics, and ז׳ the transformations, each with its emblem', async ({ page }) => newUnitsOnMaps(page));
test('the new geometry units and their emblems on a 320×568 phone', { tag: '@phone-small' }, async ({ page }) => newUnitsOnMaps(page));

// GEOM-4 on the smallest phone: the point answer (two slots) of a transformations lesson fits, and the drawing of a
// "which move" mastery check is large enough to read
test('transf:1 on a 320×568 phone: the point answer row fits beside the drawing', { tag: '@phone-small' }, async ({ page }) => {
  const it = await openOn(page, '#/lesson/transf/1', student('7'), (x) => x.form === 'pt');
  expect(it.form).toBe('pt');
  await expectNoSidewaysScroll(page);
  const doc = await page.evaluate(() => ({ h: document.documentElement.scrollHeight, vh: innerHeight }));
  expect(doc.h, 'the page itself does not scroll').toBeLessThanOrEqual(doc.vh + 1);
  await expectUsable(page, page.locator('#qtext'), 'the question');
  const row = page.locator('.answer-bar .answer');
  await expectUsable(page, row, 'the answer row');
  const r = await row.boundingBox();
  expect(r.x, 'the row starts on screen').toBeGreaterThanOrEqual(0);
  expect(r.x + r.width, 'the row ends on screen').toBeLessThanOrEqual(320);
  for (const slot of await page.locator('.answer-bar .answer [id^="slot-"]').all()) {
    const b = await slot.boundingBox();
    expect(b.height, 'a slot a finger can press').toBeGreaterThanOrEqual(40);
    expect(b.x + b.width).toBeLessThanOrEqual(320);
  }
  await expectUsable(page, page.getByRole('button', { name: 'בדיקה', exact: true }), 'the check button');
  // the drawing (when the question has one) is inside the maths region
  const fig = page.locator('.lesson-main svg.figure').first();
  if (await fig.count()) {
    const f = await fig.boundingBox(); const m = await page.locator('.lesson-main').boundingBox();
    expect(f.y + f.height).toBeLessThanOrEqual(m.y + m.height + 1);
  }
  await answer(page, true);
  await expect(page.locator('section.fb-good')).toBeVisible();
});

test('transf:4 on a 320×568 phone: a mastery check\'s drawing is at least 150px tall', { tag: '@phone-small' }, async ({ page }) => {
  await openOn(page, '#/lesson/transf/4?kind=check&purpose=mastery', student('7'), (x) => !!x.fig);
  const fig = page.locator('.lesson-main svg.figure').first();
  await expect(fig).toBeVisible();
  const f = await fig.boundingBox();
  expect(f.height, 'the drawing is readable on a 320×568 phone').toBeGreaterThanOrEqual(150);
  expect(f.x + f.width).toBeLessThanOrEqual(320);
  await expectNoSidewaysScroll(page);
  await expectUsable(page, page.getByRole('button', { name: 'בדיקה', exact: true }), 'the check button');
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
  // deleting signs out (the first screen shows at once) and then reloads the page (nothing is written after the wipe):
  // wait for that reload, so the check below reads the new page
  const reloaded = page.waitForEvent('load');
  await page.getByRole('button', { name: 'כן, למחוק הכול' }).click();
  await reloaded;
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
  // three days after the page's fixed day (a Thursday), so the exam never falls on a Saturday whatever today is
  const d = new Date(NOW); d.setDate(d.getDate() + 3);
  await page.locator('#exam-date').fill(d.toLocaleDateString('en-CA'));
  await page.getByRole('button', { name: 'המשך', exact: true }).click();
  await page.getByText('חיבור וחיסור', { exact: true }).click();
  await page.getByText('השוואה וערך מוחלט', { exact: true }).click();
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
  await expect(unit.locator('.unit-label')).toContainText('4 מתוך 35 שלבים');
  await expect(unit.locator('.unit-label')).not.toContainText('מדרגות');
  await expect(unit.locator('.node').first()).toHaveClass(/node-current/);
  await unit.locator('.node').first().click();
  await expect(page.locator('.node-card')).toContainText('בדיקת שליטה');
  await page.locator('.node-start-btn').click();
  await expect(page).toHaveURL(/kind=check&purpose=mastery/);
  for (let i = 0; i < 5; i += 1) { await expect.poll(() => item(page)).toBeTruthy(); await answer(page, true); await proceed(page); }
  await expect(page.getByRole('heading', { name: 'שולטים לבד!' })).toBeVisible();
  // the check moves the count (the council's "0 of 5" after mastery)
  await expect(page.locator('.climb-caption')).toContainText('1 מתוך 7 מדרגות');
  await page.getByRole('button', { name: 'למפה' }).click();
  // the stages worked here (teaching, practice and now the check) earned מדי his first piece: its moment comes first
  await page.locator('.unlock-stage').getByRole('button', { name: 'אחר כך', exact: true }).click();
  await expect(unit.locator('.unit-label')).toContainText('1 מתוך 7 מדרגות');
  await expect(unit.locator('.node').first()).toHaveClass(/node-done/);
  await expect(unit.locator('.node').nth(1)).toHaveClass(/node-current/);
});

test('a stair that was done before mastery checks stays done, and is offered its check', async ({ page }) => {
  // saved by an older version: two practice lessons made a stair done then
  await open(page, '#/', student('7', { path: { signed: { parts: { 1: 2, 2: 1 }, reviews: 0, jumped: 0 } } }));
  const unit = page.locator('.unit').first();
  await expect(unit.locator('.unit-label')).toContainText('1 מתוך 7 מדרגות');
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
  // the unit is opened from its row if the path is on another unit (only the unit the student is on opens by itself);
  // the unit's whole title: "פיתגורס במרחב" (space, the last unit of ח׳) has the word too
  const unit = await openUnit(page, /^משפט פיתגורס$/);
  const nodes = unit.locator('.node');
  await expect(nodes.nth(0)).toHaveClass(/node-current/);
  await expect(nodes.nth(1)).toHaveClass(/node-open/);
  await expect(nodes.nth(2)).toHaveClass(/node-done/);
  await expect(nodes.nth(3)).toHaveClass(/node-locked/);
  // the halfway chest opens with every stair up to it done, as the store awards it
  await expect(unit.getByRole('button', { name: /^תיבת אוצר\. נפתחת/ })).toBeVisible();
});

// CLASSROOM-6: the class writes an expression constant-first ("−31 − 2x"). On expr:3 the two boxes typed the other way
// round count as right: the feedback is the right-answer one with no red cross, a quiet note (read politely by a screen
// reader) says which box holds the coefficient, and the record has a right answer and no misconception.
test('a constant-first expression on expr:3 counts as right, with a note on the boxes', async ({ page }) => {
  const it = await openOn(page, '#/lesson/expr/3', student('7'), (x) => x.form === 'lin' && /^ex3[bt]?:/.test(x.key) && x.answer.k !== x.answer.c && x.answer.k !== 0 && x.answer.c !== 0);
  await page.locator('#slot-k').click();
  await type(page, it.answer.c);
  await page.locator('#slot-c').click();
  await type(page, it.answer.k);
  await page.getByRole('button', { name: 'בדיקה', exact: true }).click();
  await expect(page.locator('section.fb-good')).toBeVisible();
  await expect(page.locator('section.fb-retry, section.fb-reveal')).toHaveCount(0);
  const note = page.locator('.answer-swap');
  await expect(note).toBeVisible();
  await expect(note).toHaveAttribute('role', 'status');
  await expect(note).toContainText('המקדם של');
  await expect(note).toContainText('נכתב בתיבה הראשונה');
  await expectNoSidewaysScroll(page);
  await expect.poll(async () => (await saved(page)).learn.skills['expr:3']?.attempts?.length || 0).toBeGreaterThan(0);
  const st = await saved(page);
  expect(st.learn.skills['expr:3'].attempts.at(-1).ok).toBe(true);
  expect(Object.keys(st.learn.miscon).filter((k) => k.startsWith('expr:3|'))).toEqual([]);
  // the next exercise clears the note
  await proceed(page);
  await expect(note).toHaveCount(0);
});

// With a 0 box the two boxes are not the same expression in another order: x-terms that cancel (0x + 26) typed as 26 in
// the x box is 26x, an x the expression no longer has, and 3x + 0 typed as 0 and 3 has lost its x. That is a wrong
// answer, in red, with no note about the order of the boxes.
test('on expr:3 a number typed in the x box when the x-terms cancel is wrong, with no swap note', async ({ page }) => {
  const it = await openOn(page, '#/lesson/expr/3', student('7'), (x) => x.form === 'lin' && /^ex3[bt]?:/.test(x.key) && (x.answer.k === 0) !== (x.answer.c === 0));
  await page.locator('#slot-k').click();
  await type(page, it.answer.c);
  await page.locator('#slot-c').click();
  await type(page, it.answer.k);
  await page.getByRole('button', { name: 'בדיקה', exact: true }).click();
  await expect(page.locator('section.fb-retry')).toBeVisible();
  await expect(page.locator('section.fb-good')).toHaveCount(0);
  await expect(page.locator('.answer-swap')).toHaveCount(0);
  await expectNoSidewaysScroll(page);
  await expect.poll(async () => (await saved(page)).learn.skills['expr:3']?.attempts?.length || 0).toBeGreaterThan(0);
  expect((await saved(page)).learn.skills['expr:3'].attempts.at(-1).ok).toBe(false);
});

// CURRICULUM-10: an angle check draws its numbers in the figure only (a triangle between parallels, a bisector, a split
// angle), so on the smallest phone the drawing must open readable with the question and the keypad, and nothing scrolls
// sideways
test('an angles:4 mastery check shows its drawing, the question and the keypad on both phones', async ({ page }) => {
  const it = await openOn(page, '#/lesson/angles/4?kind=check&purpose=mastery', student('7'), (x) => x.fig?.type === 'geo' && /^an4[tb]:/.test(x.key));
  const fig = page.locator('.lesson-main svg.figure.geo');
  await expect(fig).toBeVisible();
  expect((await fig.boundingBox()).height, 'the drawing is at least 150px tall').toBeGreaterThanOrEqual(150);
  await expect(page.locator('#qtext')).toBeVisible();
  await expect(page.locator('#qtext')).toContainText('המסומנת');
  await expect(page.locator('.keypad')).toBeVisible();
  await expect(page.getByRole('button', { name: 'בדיקה', exact: true })).toBeVisible();
  await expectNoSidewaysScroll(page);
  // the figure carries the numbers: the question names none, and the drawing says them to a screen reader
  expect(it.text.replace(/\$[^$]*\$/g, '')).not.toMatch(/\d/);
  await expect(fig).toHaveAttribute('aria-label', /\d+°/);
  // a check: no hint, and a right answer is taken
  await expect(page.getByRole('button', { name: 'רמז' })).toHaveCount(0);
  await answer(page, true);
  await expect(page.locator('section.fb-good')).toBeVisible();
});

// Solve together (stage 2, MEASURE-1.4): the last step of a cylinder problem is typed "with π". The whole value typed as a
// decimal (3.14 times the answer) is right in another form: a calm note in the brand blue with its own title, never the
// miss colours or "כמעט", and nothing counted; then the number before π solves the step.
test('solve together: the whole value in a □π step is noted calmly, not as a near miss', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await open(page, '#/learn/circle/3/C', student('8', { goalXp: 50 }));
  let final = null;
  for (let g = 0; g < 6 && !final; g += 1) {
    for (let k = 0; k < 8; k += 1) {
      await expect.poll(() => page.evaluate(() => window.__madregotGuided)).toBeTruthy();
      const gd = await page.evaluate(() => window.__madregotGuided);
      if (gd.final) {
        if (gd.final.after === '\\pi') { final = gd.final; break; }
        await page.locator('.tg-input').fill(String(gd.final.answer));
        await page.getByRole('button', { name: 'בדיקה' }).click();
        await page.evaluate(() => { window.__madregotGuided = null; });
        await page.getByRole('button', { name: 'המשך' }).click();
        break;
      }
      const ok = gd.step.choices.findIndex((c) => c.ok);
      const before = gd.step.prompt;
      await page.locator('.tg-step .ls-choice').nth(ok).click();
      await page.locator('.lm-check').click();
      await page.locator('.lm-actions.has-good .sp-next').click();
      await expect.poll(() => page.evaluate(() => window.__madregotGuided?.final ? 'final' : window.__madregotGuided?.step?.prompt)).not.toBe(before);
    }
  }
  expect(final, 'circle:3 has a guided problem whose last step is typed with π').not.toBeNull();
  await page.locator('.tg-input').fill(String(Math.round(3.14 * final.answer * 10) / 10));
  await page.getByRole('button', { name: 'בדיקה' }).click();
  const foot = page.locator('.lm-actions');
  await expect(foot).toHaveClass(/has-note/);
  await expect(foot).not.toHaveClass(/has-warm/);
  await expect(foot.locator('.lm-banner')).toHaveText('נכון, בצורה אחרת');
  await expect(foot).toContainText('נכון בקירוב');
  await expect(foot).not.toContainText('כמעט');
  await expect(foot.locator('.bl-result')).toBeVisible();
  await expect.poll(() => foot.locator('.bl-result').evaluate((el) => getComputedStyle(el).opacity)).toBe('1');
  await page.screenshot({ path: test.info().outputPath('together-pi-note-phone-small.png') });
  // the number before π: solved alone (the note was no miss, so no hint was shown)
  await page.locator('.tg-input').fill(String(final.answer));
  await page.getByRole('button', { name: 'בדיקה' }).click();
  await expect(page.getByText('פתרתם את הצעד האחרון לבד')).toBeVisible();
});

// PRODUCT2-35/37: the home path is a journey, not every unit at once. The unit the student is on is open, the next is
// previewed (its banner and its first stop), and every other unit is a folded row, one tap away. The page that was
// 5,524 CSS px on an iPhone 13 is now a few screens.
test('the home path: the unit the student is on, the next previewed, the others folded and opened with one tap', async ({ page }) => {
  await open(page, '#/', student('7'));
  const units = page.locator('section.unit');
  await expect(units).toHaveCount(2);
  await expect(units.first().locator('.node-current')).toHaveCount(1);
  const preview = page.locator('section.unit.is-preview');
  await expect(preview.locator('.node')).toHaveCount(1);
  await expect(preview.locator('.node')).toHaveClass(/node-preview/);
  await expect(preview.locator('.node')).toHaveAccessibleName(/המדרגה הראשונה של היחידה הבאה/);
  await expect(preview.locator('.path-chest, .path-art')).toHaveCount(0);
  // the ז׳ path's nine units (signed, coord, angles, transf, expr, area, solid, data, eq): two open, seven rows
  const rows = page.locator('section.unit-row');
  await expect(rows).toHaveCount(7);
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  expect(height, 'the home page, in CSS px').toBeLessThan(2600);

  // a row is a heading with one button that names the unit and its size; it opens the unit in place, with the keyboard
  // too, and moves to the unit's name
  const row = rows.first().getByRole('button');
  const title = (await rows.first().locator('.unit-title').textContent()).trim();
  await expect(row).toHaveAccessibleName(new RegExp(`^${title}\\s*יחידה 3\\s·\\s\\d+ מדרגות$`));
  expect((await row.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await row.focus();
  await page.keyboard.press('Enter');
  const opened = units.filter({ has: page.locator('h2.unit-title', { hasText: title }) });
  await expect(opened.locator('.node').first()).toBeVisible();
  await expect(opened.locator('h2.unit-title')).toBeFocused();
  await expect(rows).toHaveCount(6);
  // the previewed unit shows all its stops with "כל המדרגות של …"
  await preview.getByRole('button', { name: /^כל המדרגות של / }).click();
  await expect(units.nth(1).locator('.node').nth(1)).toBeVisible();
  await expect(units.nth(1)).not.toHaveClass(/is-preview/);
  await expectNoSidewaysScroll(page);
  // the topics list's "המשך" opens that unit wherever it is (it is then the unit the student is on)
  await page.goto('./#/topics');
  await page.locator('.section-card').filter({ hasText: title }).getByRole('button', { name: 'מעבר ליחידה' }).click();
  await expect(units.first().locator('h2.unit-title')).toHaveText(title);
});

// PRODUCT2-37: back on the map after a stair is done, מדי walks from the stop just finished to the next one and its
// lock lifts, once. Under reduced motion (this project's default) he is simply there and nothing moves.
for (const motion of ['reduce', 'no-preference']) {
  test(`after a stair is done, מדי is at the next stop (${motion === 'reduce' ? 'reduced motion: the end state' : 'he walks there and the stop opens, once'})`, async ({ page }) => {
    const at = '2026-11-04T10:00:00.000Z';
    const practised = { taught: { A: at, B: at, C: at }, attempts: Array.from({ length: 6 }, () => ({ at, ok: true, independent: true, purpose: 'practice' })) };
    const st = student('7', { path: { signed: { parts: { 1: 2 }, reviews: 0, jumped: 0, done: {} } }, learn: { skills: { 'signed:1': practised }, miscon: {}, exam: null, missions: {}, events: [] } });
    await page.emulateMedia({ reducedMotion: motion });
    await open(page, '#/', { ...st, version: 4 });
    // before: מדי stands at the first stop, and nothing walks
    await expect(page.locator('[data-stop="signed:node:1"] .path-walker')).toBeVisible();
    await page.locator('.unit').first().locator('.node').first().click();
    await page.locator('.node-start-btn').click();
    for (let i = 0; i < 5; i += 1) { await expect.poll(() => item(page)).toBeTruthy(); await answer(page, true); await proceed(page); }
    await page.getByRole('button', { name: 'למפה' }).click();
    await page.locator('.unlock-stage').getByRole('button', { name: 'אחר כך', exact: true }).click();
    const walker = page.locator('[data-stop="signed:node:2"] .path-walker');
    await expect(walker).toBeVisible();
    await expect(page.locator('.path-walker')).toHaveCount(1);
    await expect(walker).toHaveAttribute('aria-hidden', 'true');
    const moving = () => walker.evaluate((el) => el.getAnimations().length);
    const lock = page.locator('[data-stop="signed:node:2"] .node-unlock');
    if (motion === 'reduce') {
      expect(await moving()).toBe(0);
      await expect(lock).toHaveCount(0);
    } else {
      expect(await moving(), 'he walks from the stop just done').toBe(1);
      await expect(lock).toHaveCount(1);
      // once: away to the quests and Back to this same map, he is simply there
      await page.locator('.tabbar').getByRole('link', { name: /משימות/ }).click();
      await expect(page).toHaveURL(/#\/quests/);
      await expect(page.locator('.path-walker')).toHaveCount(0); // the map has left the screen
      await page.goBack();
      await expect(walker).toBeVisible();
      expect(await moving()).toBe(0);
      await expect(lock).toHaveCount(0);
    }
    await expect(page.locator('[data-stop="signed:node:2"] .node')).toHaveClass(/node-current/);
  });
}

// A stair kept from before mastery checks, mastered: the same moment as any stair mastered (one flag, award.mastered):
// the gold screen, then on the map מדי walks from that stair's stop, which pops. The stop he reaches was open already,
// so no padlock lifts off it.
test('a kept stair mastered: the gold moment, then מדי walks from that stop, and no lock lifts off an open stop', async ({ page }) => {
  const at = '2026-11-04T10:00:00.000Z';
  const practised = { taught: { A: at, B: at, C: at }, attempts: Array.from({ length: 6 }, () => ({ at, ok: true, independent: true, purpose: 'practice' })) };
  const st = student('7', { path: { signed: { parts: { 1: 2, 2: 2 }, reviews: 0, jumped: 0, done: { 1: 'kept', 2: 'kept' } } }, learn: { skills: { 'signed:1': practised, 'signed:2': practised }, miscon: {}, exam: null, missions: {}, events: [], floor: null, challenges: {} } });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await open(page, '#/lesson/signed/1?kind=check&purpose=mastery', { ...st, version: 6 });
  for (let i = 0; i < 5; i += 1) { await expect.poll(() => item(page)).toBeTruthy(); await answer(page, true); await proceed(page); }
  await expect(page.getByRole('heading', { name: 'שולטים לבד!' })).toBeVisible();
  await expect(page.locator('.celebrate-gold')).toHaveCount(1);
  await expect(page.locator('.mastered-badge')).toHaveCount(1);
  await page.getByRole('button', { name: 'למפה' }).click();
  // the passed check is the first stage this student worked through: the party hat comes first, as after any stair
  await page.locator('.unlock-stage').getByRole('button', { name: 'אחר כך', exact: true }).click();
  const walker = page.locator('[data-stop="signed:node:3"] .path-walker');
  await expect(walker).toBeVisible();
  expect(await walker.evaluate((el) => el.getAnimations().length), 'he walks from the stair just mastered').toBe(1);
  await expect(page.locator('[data-stop="signed:node:1"] .node-burst')).toHaveCount(1);
  await expect(page.locator('.node-unlock')).toHaveCount(0);
  await expect(page.locator('[data-stop="signed:node:3"] .node')).toHaveClass(/node-current/);
});

// PRODUCT2-10: a mixed number is typed on the phone keypad: the whole number, the space key (רווח), the fraction. The
// slot shows "5 1/3", beside it the mixed number as written, and the lesson takes it as the answer.
test('a mixed number on the keypad: a fraction sum answered as a whole number and a fraction (5 1/3)', async ({ page }) => {
  const mixed = (x) => x?.form === 'num' && x.answer > 1 && !Number.isInteger(Math.round(x.answer * 1e9) / 1e9) && [2, 3, 4, 5, 6, 8].some((d) => Math.abs(x.answer * d - Math.round(x.answer * d)) < 1e-9);
  const it = await openOn(page, '#/lesson/frac/3', student('7'), mixed);
  const d = [2, 3, 4, 5, 6, 8].find((q) => Math.abs(it.answer * q - Math.round(it.answer * q)) < 1e-9);
  const whole = Math.floor(it.answer); const num = Math.round((it.answer - whole) * d);
  const key = (name) => page.getByRole('button', { name, exact: true }).click();
  await page.locator('#slot-v').click();
  for (const ch of String(whole)) await key(ch);
  await key('רווח, בין השלם לשבר');
  for (const ch of String(num)) await key(ch);
  await key('שבר');
  for (const ch of String(d)) await key(ch);
  await expect(page.locator('#slot-v')).toHaveValue(`${whole} ${num}/${d}`);
  // the mixed number as it is written, beside the slot
  await expect(page.locator('.answer-echo .katex')).toBeVisible();
  // a second space is not typed
  await key('רווח, בין השלם לשבר');
  await expect(page.locator('#slot-v')).toHaveValue(`${whole} ${num}/${d}`);
  await page.getByRole('button', { name: 'בדיקה', exact: true }).click();
  await expect(page.locator('section.fb.fb-good')).toBeVisible();
});

// The lane's review: the space key let a stray space between digits through, and "−1 3" was graded as −13. A space inside
// a number, or one left after the whole number, is not an answer yet: the lesson says how a mixed number is written,
// takes no attempt, and the right answer typed again is taken.
test('a stray space between digits is not read as one number: "−1 3" is not −13, and nothing is graded', async ({ page }) => {
  const it = await openOn(page, '#/lesson/signed/1', student('7'), (x) => x?.form === 'num' && Number.isInteger(x.answer) && Math.abs(x.answer) >= 10 && Math.abs(x.answer) <= 99);
  const digits = String(Math.abs(it.answer));
  const key = (name) => page.getByRole('button', { name, exact: true }).click();
  const before = (await saved(page)).learn.skills['signed:1']?.attempts?.length || 0;
  await page.locator('#slot-v').click();
  if (it.answer < 0) await key('מינוס');
  await key(digits[0]);
  await key('רווח, בין השלם לשבר');
  await key(digits[1]);
  await expect(page.locator('#slot-v')).toHaveValue(`${it.answer < 0 ? '-' : ''}${digits[0]} ${digits[1]}`);
  await key('בדיקה');
  const say = page.getByRole('alert').filter({ hasText: 'מספר מעורב' });
  await expect(say).toHaveText('מספר מעורב, כמו ⁦5 1/3⁩, כותבים כך: שלם, רווח ושבר.');
  await expect(page.locator('section.fb')).toHaveCount(0);
  expect((await saved(page)).learn.skills['signed:1']?.attempts?.length || 0).toBe(before);
  // a whole number and a space, nothing after it: also not an answer yet
  await key('מחיקה');
  await expect(page.locator('#slot-v')).toHaveValue(`${it.answer < 0 ? '-' : ''}${digits[0]} `);
  await key('בדיקה');
  await expect(say).toBeVisible();
  await expect(page.locator('section.fb')).toHaveCount(0);
  // the number itself is taken
  await key('מחיקה');
  await key(digits[1]);
  await key('בדיקה');
  await expect(page.locator('section.fb.fb-good')).toBeVisible();
});

// The external review (16.11): after a wrong answer in "מבינים את הרעיון", "שאלה למדי" → "מה הטעות שלי?" said there was no
// wrong answer. Madi now hears about the question on screen in teaching as in practice: a wrong answer standing is
// explained in the content's words, one corrected since is said to be fixed, and a step left behind starts clean.
const askMadiMistake = async (page) => {
  await page.locator('button.tool[aria-label="שאלה למדי"], .bl-head button[aria-label="שאלה למדי"]').first().click();
  const sheet = page.getByRole('dialog', { name: 'שאלה למדי' });
  await expect(sheet).toBeVisible();
  const before = await sheet.locator('.tutor-a').count();
  await sheet.getByRole('button', { name: 'מה הטעות שלי?' }).click();
  await expect(sheet.locator('.tutor-a')).toHaveCount(before + 1);
  const reply = await sheet.locator('.tutor-a').last().innerText();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  return reply;
};
const MADI_NONE = 'עוד לא הייתה כאן תשובה שגויה';
const MADI_FIXED = 'כאן כבר תיקנתם את הטעות';
const MINUS_MINUS_CAUSE = 'קל לחשוב שזה עוד "מינוס 3"'; // signed:1's minus-minus misconception, in its own words

test('"מה הטעות שלי?" in teaching: none yet, a wrong guess, a named miss and its fix, a step left behind, a wrong move together', async ({ page }) => {
  await open(page, '#/learn/signed/1/A', student('7'));
  expect(await askMadiMistake(page)).toContain(MADI_NONE);
  // on through the steps (answered right) to the one wanted
  const toStep = async (want) => {
    for (let i = 0; i < 20; i += 1) {
      await expect.poll(() => step(page)).toBeTruthy();
      const st = await step(page);
      if (want(st)) return st;
      // a step still to check (not one answered already, like the wrong guess above)
      if ((st.kind === 'predict' || st.kind === 'explore') && await page.locator('.lm-check').count()) {
        if (st.kind === 'predict') await page.locator('.ls-choice').nth(st.answer).click();
        else { await page.waitForFunction(() => window.__madregotSolveStep?.forStep === window.__madregotStep); await page.evaluate(() => window.__madregotSolveStep()); }
        await page.locator('.lm-check').click();
        await expect(page.locator('.lm-actions.has-good')).toBeVisible();
      }
      const at = await page.locator('.sp-progress').getAttribute('aria-valuenow');
      await page.locator('.sp-next').click();
      await expect(page.locator('.sp-progress')).not.toHaveAttribute('aria-valuenow', at);
    }
    throw new Error('no such step');
  };
  // a wrong guess on a prediction: said again in the step's own words
  const guess = await toStep((st) => st.kind === 'predict' && st.wrongWhy && Object.keys(st.wrongWhy).length > 0);
  const wrong = Number(Object.keys(guess.wrongWhy)[0]);
  await page.locator('.ls-choice').nth(wrong).click();
  await page.locator('.lm-check').click();
  await expect(page.locator('.lm-actions.has-warm')).toBeVisible();
  const said = await askMadiMistake(page);
  expect(said).not.toContain(MADI_NONE);
  expect(said).toContain(guess.wrongWhy[wrong].replace(/\$[^$]*\$/g, ' ').trim().split(/\s+/).slice(0, 3).join(' '));
  // the number line: 2 − (−3) moved as 2 + (−3) is named; moved right after that, it is fixed
  await toStep((st) => st.kind === 'explore' && st.display === '2 - (-3)');
  for (let k = 0; k < 3; k += 1) await page.getByRole('button', { name: 'הסמן שמאלה' }).first().click();
  await page.locator('.lm-check').click();
  await expect(page.locator('.lm-actions.has-warm')).toBeVisible();
  expect(await askMadiMistake(page)).toContain(MINUS_MINUS_CAUSE);
  for (let k = 0; k < 6; k += 1) await page.getByRole('button', { name: 'הסמן ימינה' }).first().click();
  await page.locator('.lm-check').click();
  await expect(page.locator('.lm-actions.has-good')).toBeVisible();
  expect(await askMadiMistake(page)).toContain(MADI_FIXED);
  // the next step has no wrong answer: the one before is not shown as the one on screen
  const at = await page.locator('.sp-progress').getAttribute('aria-valuenow');
  await page.locator('.sp-next').click();
  await expect(page.locator('.sp-progress')).not.toHaveAttribute('aria-valuenow', at);
  expect(await askMadiMistake(page)).toContain(MADI_NONE);
  // solving together: "−3 − 8" for −3 − (−8) is the minus-minus move (the second choice of the first step)
  await open(page, '#/learn/signed/1/C', student('7'));
  expect(await askMadiMistake(page)).toContain(MADI_NONE);
  await page.locator('.tg-step .ls-choice').nth(1).click();
  await page.locator('.lm-check').click();
  await expect(page.locator('.lm-actions.has-warm')).toBeVisible();
  expect(await askMadiMistake(page)).toContain(MINUS_MINUS_CAUSE);
});

test('"מה הטעות שלי?" in practice: the named mistake outlives "נסו שוב", and a corrected one is said to be fixed', async ({ page }) => {
  // a typed signed:1 exercise and a wrong number its diag() names minus-minus (the same seeds every run)
  let wrongValue = null;
  for (let sd = 1; sd <= 40 && wrongValue == null; sd += 1) {
    await open(page, '#/lesson/signed/1', student('7'), String(sd));
    await expect.poll(() => item(page)).toBeTruthy();
    wrongValue = await page.evaluate(() => {
      const it = window.__madregotItem;
      if (it.form !== 'num' || typeof it.diag !== 'function') return null;
      for (let v = -40; v <= 40; v += 1) if (v !== it.answer && it.diag(v) === 'minus-minus') return v;
      return null;
    });
  }
  expect(wrongValue, 'a seed opens a typed exercise with a minus-minus miss').not.toBeNull();
  expect(await askMadiMistake(page)).toContain(MADI_NONE);
  await page.locator('#slot-v').click(); await type(page, wrongValue);
  await page.getByRole('button', { name: 'בדיקה', exact: true }).click();
  await expect(page.locator('section.fb-retry')).toBeVisible();
  await proceed(page); // נסו שוב: the feedback goes, the mistake stays known
  const again = await askMadiMistake(page);
  expect(again).toContain(MINUS_MINUS_CAUSE);
  expect(again).not.toContain('לא אנחש');
  await answer(page, true);
  await expect(page.locator('#fb-title')).toBeVisible();
  expect(await askMadiMistake(page)).toContain(MADI_FIXED);
});
