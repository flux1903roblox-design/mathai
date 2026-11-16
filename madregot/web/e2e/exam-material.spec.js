// EXAM-MATERIAL: a test tomorrow, and the material in hand. The student pastes the teacher's message (read on the device,
// in the build with no server, as the public copy runs), sees what was found as ticked chips with the parts it could not
// place, confirms, and gets the evening's plan within the minutes chosen; its first step (a stair's rule card) opens,
// then the stair's quick check. Where the smart helper is connected (the fake server), the material can be photographed:
// the warning, the crop and black-out step, then the same confirm screen. Every new state is scanned with axe, and the
// no-server build shows no photo button and no promise of one.
import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { NOW, student, withServer, open, answer, item, examPng, expectNoSidewaysScroll } from './helpers.js';
import { fakeServer } from './fakeServer.js';
import { expectNoAxeViolations } from './axe.js';

const SHOTS = process.env.SHOTS_DIR || '';
async function shot(page, name) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/${test.info().project.name}-${name}.png`, fullPage: true });
}
/** The screen is drawn: nothing loading, a heading on screen, its entrances ended (as a11y.spec.js waits). */
async function drawn(page) {
  await page.waitForFunction(() => !document.querySelector('.loading-state'));
  await expect(page.locator('h1:visible, h2:visible').first()).toBeVisible();
  await page.evaluate(() => { window.__axeQuiet = 0; });
  await page.waitForFunction(() => {
    const running = document.getAnimations().filter((a) => a.playState === 'running' && Number.isFinite(a.effect?.getComputedTiming().endTime));
    for (const a of running) { try { a.finish(); } catch { /* cancelled meanwhile */ } }
    window.__axeQuiet = running.length ? 0 : window.__axeQuiet + 1;
    return window.__axeQuiet >= 3;
  }, null, { polling: 100, timeout: 10_000 });
}
const scan = (page, what) => test.step(`axe: ${what}`, async () => {
  await drawn(page);
  await page.evaluate(() => document.fonts.ready);
  await expectNoAxeViolations(page, {}, `${what} (${test.info().project.name})`);
});
const next = (page) => page.getByRole('button', { name: /^המשך/ }).click();
/** The day after the app's fixed Thursday: Friday 6.11, not a rest day. */
const TOMORROW = (() => { const d = new Date(NOW); d.setDate(d.getDate() + 1); return d.toLocaleDateString('en-CA'); })();
const MESSAGE = "שלום לכולם, המבחן מחר על פרק 3: משוואות ובעיות מילוליות, בלי שאלות תנועה. עמ' 40-62 בספר.";

async function toWhatIsOnTheTest(page) {
  await page.locator('#exam-date').fill(TOMORROW);
  await next(page);
  await expect(page.getByRole('heading', { level: 1, name: 'מה יהיה במבחן?' })).toBeVisible();
}

test('paste the teacher\'s message: chips, the plan for tomorrow, and its first step opens (no server)', async ({ page }) => {
  await open(page, '#/rescue', student('7'));
  await toWhatIsOnTheTest(page);
  // the first choice is the material; with no smart helper there is no photo button and no promise of one
  const card = page.locator('.material-card');
  await expect(card.getByRole('heading', { name: 'יש לי את החומר למבחן' })).toBeVisible();
  await expect(card.getByRole('button', { name: 'להדביק או לכתוב את ההודעה' })).toBeVisible();
  await expect(card.getByRole('button', { name: /לצלם/ })).toHaveCount(0);
  await expect(card).toContainText('הדבקה של ההודעה עובדת כאן במכשיר, גם בלי העוזר החכם.');
  await expect(page.getByText(/יעבוד כשהעוזר החכם מחובר|צילום של רשימת הנושאים/)).toHaveCount(0);
  // the whole list stays below, to choose by hand
  await expect(page.getByRole('heading', { name: 'או בוחרים את המדרגות בעצמכם' })).toBeVisible();
  await expect(page.getByText('משוואות (כל הנושא)')).toBeVisible();
  await expectNoSidewaysScroll(page);
  await scan(page, 'Rescue, the material first');
  await shot(page, '1-material-first');

  await card.getByRole('button', { name: 'להדביק או לכתוב את ההודעה' }).click();
  const box = page.getByRole('textbox', { name: 'ההודעה מהמורה או רשימת הנושאים' });
  await expect(box).toBeFocused();
  await expect(page.getByRole('button', { name: 'מה יש במבחן?' })).toBeDisabled();
  await box.fill(MESSAGE);
  await scan(page, 'Rescue, the message pasted');
  await shot(page, '2-message');
  await page.getByRole('button', { name: 'מה יש במבחן?' }).click();

  // what it found: the equations' stairs 1-5 ticked, motion problems left out, the chapter and the pages listed
  await expect(page.locator('.material-found-line')).toContainText('מצאתי 5 מדרגות בנושא אחד');
  const eq = page.locator('.rescue-topic').filter({ hasText: 'משוואות (כל הנושא)' });
  await expect(eq.locator('.rescue-topic-count')).toHaveText('5/7');
  await expect(eq.getByRole('checkbox', { name: 'בעיות מילוליות' })).toBeChecked();
  await expect(eq.getByRole('checkbox', { name: 'שאלות תנועה' })).not.toBeChecked();
  // what the message leaves out is said, not done silently
  await expect(page.locator('.material-excluded')).toHaveText('לפי ההודעה, בלי: שאלות תנועה.');
  const unknown = page.locator('.material-unknown').last();
  await expect(unknown).toContainText('לא זיהיתי:');
  await expect(unknown).toContainText('פרק 3');
  await expect(unknown.locator('bdi').filter({ hasText: '40-62' })).toHaveCount(1);
  // the rest of the topics, folded, to add by hand
  await expect(page.getByRole('button', { name: 'עוד נושאים' })).toHaveAttribute('aria-expanded', 'false');
  await expectNoSidewaysScroll(page);
  await scan(page, 'Rescue, what the message names');
  await shot(page, '3-found');
  // the student edits: untick word problems, then tick it back; nothing is decided until "המשך"
  await eq.getByText('בעיות מילוליות', { exact: true }).click();
  await expect(eq.locator('.rescue-topic-count')).toHaveText('4/7');
  await eq.getByText('בעיות מילוליות', { exact: true }).click();
  await page.getByRole('button', { name: 'עוד נושאים' }).click();
  await expect(page.getByText('מספרים מכוונים (כל הנושא)')).toBeVisible();
  await scan(page, 'Rescue, what was found and the other topics');
  await next(page); // 5 stairs
  await next(page); // confidence: the default
  await page.getByRole('radio', { name: '15 דקות ביום' }).click();
  await page.getByRole('button', { name: /לבניית התוכנית \(5 מדרגות\)/ }).click();

  // the evening: no separate check first; what is left today within the 15 minutes, weakest first; the rest apart
  await expect(page.locator('.rescue-msg')).toContainText('המבחן מחר');
  const today = page.locator('.rescue-evening').first();
  await expect(today.getByRole('heading', { name: 'מה נשאר להיום' })).toBeVisible();
  await expect(today.locator('.evening-time')).toHaveText('כ־14 דקות, בתוך 15 הדקות שבחרתם');
  await expect(today.locator('.evening-step').first()).toContainText('נזכרים בכלל: משוואה ופתרון');
  await expect(today.locator('.evening-step').last()).toContainText('מבחן תרגול על כל הנושאים');
  await expect(page.getByRole('heading', { name: 'אם יש עוד זמן' })).toBeVisible();
  await expect(page.getByRole('button', { name: /לבדיקה הקצרה/ })).toHaveCount(0);
  await expectNoSidewaysScroll(page);
  await scan(page, 'Rescue, the evening before the exam');
  await shot(page, '4-evening');

  // the first step opens: the stair's rule card, then its quick check of three questions
  await today.getByRole('button', { name: 'מתחילים' }).click();
  await expect(page).toHaveURL(/#\/rescue\/rule\/eq\/1$/);
  await expect(page.getByRole('heading', { level: 1, name: 'נזכרים בכלל' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'משוואה ופתרון' })).toBeVisible();
  await expect(page.locator('.rule-card').first()).toBeVisible();
  await expectNoSidewaysScroll(page);
  await scan(page, 'Rescue, a stair\'s rule card');
  await shot(page, '5-rule');
  await page.getByRole('button', { name: 'הבנתי, לבדיקה המהירה' }).click();
  await expect(page).toHaveURL(/#\/rescue\/check\?skill=eq:1$/);
  await expect.poll(() => item(page)).toBeTruthy();
  for (let i = 0; i < 3; i += 1) { await answer(page, i !== 1); await page.locator('section.fb .fb-actions .btn').click(); }
  await expect(page.getByRole('heading', { name: 'עוד תרגול קצר' })).toBeVisible();
  await scan(page, 'the quick check\'s end');
  await page.getByRole('button', { name: /לתוכנית ההכנה/ }).click();
  // back on the plan: the rule and the check of eq:1 are done, its practice comes first now
  await expect(today.locator('.evening-step').first()).toContainText('מתרגלים: משוואה ופתרון');
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('madregot')).state.learn.exam);
  expect(st.quick['eq:1']).toMatchObject({ asked: 3, right: 2 });
  expect(st.rules['eq:1']).toBeTruthy();
  await shot(page, '6-after-check');
});

test('photograph the material where the smart helper is connected: the warning, the crop, then the same confirm screen', async ({ page }) => {
  const { st, log } = await fakeServer(page, { paywall: false, parentOk: true });
  st.syllabus = {
    // pyth:9 is no stair, and congr:3 is not one the ז׳ request offers: the confirm screen never shows them
    stairs: ['pyth:1', 'pyth:2', 'area:2', 'congr:3', 'pyth:9'],
    unplaced: ["עמ' 40", 'וקטורים'],
    examples: [{ text: 'מצאו את היתר: $a = 6$, $b = 8$', stair: 'pyth:1' }, { text: 'שטח המשולש $\\frac{6 \\cdot 4}{2}$', stair: 'area:2' }],
  };
  await open(page, '#/rescue', withServer());
  await toWhatIsOnTheTest(page);
  const card = page.locator('.material-card');
  await expect(card.getByRole('button', { name: 'לצלם את החומר (עד 4 תמונות)' })).toBeVisible();
  await expect(card).not.toContainText('גם בלי העוזר החכם');
  await card.getByRole('button', { name: 'לצלם את החומר (עד 4 תמונות)' }).click();
  await expect(page.getByRole('button', { name: 'לקרוא את החומר' })).toBeDisabled();
  await scan(page, 'Rescue, photographing the material');
  await shot(page, '7-photo');
  // the warning first, in the words of reading the material
  await page.getByRole('button', { name: 'צילום', exact: true }).click();
  const warn = page.getByRole('dialog', { name: 'לפני שמצלמים' });
  await expect(warn).toContainText('כדי לקרוא ממנה את נושאי המבחן');
  await scan(page, 'the warning before photographing the material');
  const chooser = page.waitForEvent('filechooser');
  await warn.getByRole('button', { name: 'הבנתי, לצלם' }).click();
  await (await chooser).setFiles({ name: 'material.png', mimeType: 'image/png', buffer: await examPng(page) });
  const prep = page.getByRole('dialog', { name: 'מסתירים פרטים אישיים' });
  await expect(prep.getByRole('slider', { name: 'כמה לחתוך מלמעלה' })).toHaveAttribute('aria-valuenow', '15');
  await prep.getByRole('button', { name: 'סיימתי, אין בדף פרטים אישיים' }).click();
  await expect(page.getByRole('img', { name: 'תמונה 1' })).toBeVisible();
  await shot(page, '8-photo-taken');
  await page.getByRole('button', { name: 'לקרוא את החומר' }).click();
  await expect.poll(() => log.filter((r) => r.path === '/api/ai/syllabus').length).toBe(1);
  const sent = log.find((r) => r.path === '/api/ai/syllabus').body;
  expect(sent.grade).toBe('7');
  expect(sent.pages.map((p) => p.mediaType)).toEqual(['image/jpeg']);
  expect(sent.prep).toEqual({ crop: true, boxes: 0 });
  expect(sent.stairs).toContain('pyth:1');
  expect(sent.stairs).toContain('frac:1');
  expect(sent.stairs).not.toContain('congr:3');
  // the same confirm screen: Pythagoras 1-2 and a triangle's area ticked, the pieces it could not place, the exercises
  await expect(page.locator('.material-found-line')).toContainText('מצאתי 3 מדרגות בשני נושאים');
  await expect(page.locator('.rescue-topic').filter({ hasText: 'משפט פיתגורס' }).locator('.rescue-topic-count')).toHaveText('2/5');
  await expect(page.locator('.rescue-topic').filter({ hasText: 'שטחים והיקפים' }).locator('.rescue-topic-count')).toHaveText('1/5');
  await expect(page.locator('.material-unknown')).toContainText('וקטורים');
  await expect(page.getByRole('heading', { name: 'תרגילים שראיתי בחומר' })).toBeVisible();
  await expect(page.locator('.material-example .katex').first()).toBeVisible();
  await expectNoSidewaysScroll(page);
  await scan(page, 'Rescue, what the pictures name');
  await shot(page, '9-photo-found');
  await next(page);
  await expect(page.getByRole('heading', { level: 1, name: 'כמה אתם מרגישים בטוחים?' })).toBeVisible();
});
