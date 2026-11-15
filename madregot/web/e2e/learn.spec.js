// Madregot 2.0 journeys, through the screens the way a student uses them: learning a stair before practising it,
// keeping the place, mastery only from a check without hints, a misconception repaired and verified,
// Exam Rescue from a diagnostic to a plan, today's mission, and the profile's numbers and data deletion.
import { test, expect } from '@playwright/test';
import { open, openOn, type, student, item, answer, saved, proceed, NOW, playDiscover, stageDone, expectNoSidewaysScroll } from './helpers.js';

// (a test whose title says "on both phones" runs on the two phones instead)
test.beforeEach(({}, info) => {
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
  await a.getByRole('button', { name: 'לדוגמה הפתורה', exact: true }).click();
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
  // percent (ח׳, October) is offered to ז׳ too: they meet it in relative frequency in February; and the functions unit
  // through its guest stair alone (func:1, a situation graph in May: stage5.md FUNC-6, guest.spec.js). Stage 2's areas
  // and boxes sit between the expressions and the data unit, as on the map
  await expect(heads).toHaveText(['מספרים מכוונים (כל הנושא)', 'מערכת צירים (כל הנושא)', 'זוויות (כל הנושא)', 'ביטויים אלגבריים (כל הנושא)', 'שטחים והיקפים (כל הנושא)', 'תיבה ומנסרה (כל הנושא)', 'נתונים ושכיחות (כל הנושא)', 'משוואות (כל הנושא)', 'אחוזים (כל הנושא)', 'מבוא לפונקציות (מה שלומדים בכיתה ז׳)', 'משפט פיתגורס (כל הנושא)']);
  await page.getByText('מציאת ניצב', { exact: true }).click();
  await expect(page.locator('.rescue-topic').last().locator('.rescue-topic-count')).toHaveText('1/5');
  await expectNoSidewaysScroll(page);

  await open(page, '#/rescue', student('8'));
  await toTopics();
  await expect(heads.filter({ hasText: 'משפט פיתגורס' })).toHaveText('משפט פיתגורס (כל הנושא)');
  await expect(heads.filter({ hasText: 'משוואות' }).last()).toHaveText('משוואות מכיתה ז׳ (כל הנושא)');
  // this year ח׳ learns the ז׳ data unit too (8.6): it is theirs, not revision from ז׳
  await expect(heads.filter({ hasText: 'נתונים ושכיחות' })).toHaveText('נתונים ושכיחות (כל הנושא)');
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
  // the unit's whole title: "פיתגורס במרחב" (space, the last unit of ח׳) has the word too
  const unit = page.locator('.unit').filter({ has: page.locator('.unit-title', { hasText: /^משפט פיתגורס$/ }) });
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
