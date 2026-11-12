// The challenge track (CURRICULUM-6): a task solved end to end on a phone, a wrong first try then the right one, a proof
// ordered with the buttons from the keyboard alone, a counterexample typed into its slots, and the end screen's XP. A
// challenge counts for the day like a lesson and never touches mastery.
import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { open, student, saved, item, answer, expectNoSidewaysScroll, expectUsable } from './helpers.js';
import { API, CORS } from './fakeServer.js';

test.beforeEach(({}, info) => { test.skip(!['phone', 'phone-small'].includes(info.project.name), 'the challenge screen is checked on the two phones'); });

const at = '2026-11-04T10:00:00.000Z';
const mastered = { attempts: Array.from({ length: 5 }, () => ({ at, ok: true, independent: true, purpose: 'mastery' })), mastered: { at, box: 0, due: '2026-11-08T10:00:00.000Z' } };
/** A ח׳ student who has mastered pct:2 (pct:c1 follows it), saved at the current version (v6: no migration step runs, the learning model kept as it is). */
const pctStudent = () => ({
  ...student('8', {
    path: { pct: { parts: { 1: 2, 2: 2 }, reviews: 0, jumped: 0, done: { 1: 'mastered', 2: 'mastered' } } },
    learn: { skills: { 'pct:1': mastered, 'pct:2': mastered }, miscon: {}, exam: null, missions: {}, events: [], floor: null, challenges: {} },
  }),
  version: 6,
});
const go = (page, name) => page.locator('.ch-foot .ch-go', { hasText: name });
const KEY = { '.': 'נקודה עשרונית' };
const type = async (page, v) => { for (const ch of String(v)) await page.getByRole('button', { name: KEY[ch] || ch, exact: true }).click(); };

test('pct:c1, from a fixture with pct:2 mastered: a wrong first try, the right one, every part, and the XP at the end', async ({ page }, info) => {
  await open(page, '#/challenge/pct:c1', pctStudent());
  await expect(page.locator('.ch-title')).toHaveText('שתי דרכים לשלם עמלה');
  await expect(page.locator('.ch-count')).toHaveText('חלק 1 מתוך 4');
  // the story: on a tall phone pinned above the part, on a short one behind "לסיפור"
  if (info.project.name === 'phone-small') {
    const fold = page.getByRole('button', { name: 'לסיפור' });
    await expect(fold).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('.ch-story')).toHaveCount(0);
    await fold.click();
    await expect(fold).toHaveAttribute('aria-expanded', 'true');
  }
  await expect(page.locator('.ch-story')).toContainText('מסלול ב');
  await expectNoSidewaysScroll(page);

  // part 1: 7 is wrong, a second try is offered; 7.5 is right
  await type(page, '7');
  await go(page, 'בדיקה').click();
  await expect(page.locator('.ch-foot .lm-banner')).toHaveText('עוד לא. נסו שוב, יש עוד ניסיון.');
  await type(page, '7.5'); // the struck answer is replaced by the next key
  await expect(page.locator('#ch-slot-v')).toHaveValue('7.5');
  await go(page, 'בדיקה').click();
  await expect(page.locator('.ch-foot .lm-banner')).toHaveText('נכון!');
  await go(page, 'המשך').click();

  // part 2: the amount where both ways cost the same
  await expect(page.locator('.ch-count')).toHaveText('חלק 2 מתוך 4');
  await type(page, '400');
  await go(page, 'בדיקה').click();
  await expect(page.locator('.ch-foot .lm-banner')).toHaveText('נכון!');
  await go(page, 'המשך').click();

  // part 3: a choice
  await page.getByRole('radio', { name: /מסלול ב/ }).click();
  await go(page, 'בדיקה').click();
  await expect(page.locator('.ch-foot .lm-banner')).toHaveText('נכון!');
  await go(page, 'המשך').click();

  // part 4: in the student's own words, then the self-check; the words are never saved
  await page.locator('.ch-explain').fill('מי שקונה בפחות מ־400 משלם פחות במסלול א.');
  await go(page, 'סיימתי').click();
  await expect(page.getByRole('heading', { name: 'בדקו את התשובה שלכם' })).toBeVisible();
  await expect(page.locator('.ch-rubric input[type="checkbox"]')).toHaveCount(3);
  await expectNoSidewaysScroll(page);
  await go(page, 'לסיום').click();

  // the end: the lesson-complete words, and 20 + 5 × 2 parts right first time
  await expect(page.getByRole('heading', { name: 'אתגר הושלם. זה לא היה פשוט, והצלחתם.' })).toBeVisible();
  await expect(page.locator('.ch-done .stat-value')).toHaveText('+30');
  await expectNoSidewaysScroll(page);
  const st = await saved(page);
  expect(st.days['2026-11-05']).toMatchObject({ lessons: 1, xp: 30 });
  expect(st.learn.challenges['pct:c1']).toMatchObject({ firstTry: 2, parts: 3 });
  expect(st.learn.skills['pct:2']).toEqual(mastered); // no evidence, no check
  expect(JSON.stringify(st)).not.toContain('מי שקונה בפחות'); // the explanation stayed on the screen
  await page.getByRole('button', { name: 'המשך' }).click();
  await expect(page).toHaveURL(/#\/learn\/pct\/2$/);
});

// ------------------------------------------------------------------ the tutor's feedback on the explanation (FOLLOWUP-16)
// After "סיימתי", a device with the tutor's feedback tool has a second button. Only its press sends the text; the reply
// marks each rubric point "יש", "יש חלק" or "עוד חסר", with the student's own words highlighted and a tip; nothing is kept.
const SHOTS = process.env.SHOTS_DIR || '';
const WRITTEN = 'מי שקונה בפחות מ־400 משלם פחות במסלול א. מעל זה כדאי מסלול ב.';
const FEEDBACK_REPLY = {
  care: false,
  summary: 'כבר כתבתם מתי כל מסלול זול יותר. נשאר להוסיף דוגמה עם מספרים.',
  points: [
    { i: 0, status: 'yes', quote: 'מי שקונה בפחות מ־400 משלם פחות במסלול א', tip: '' },
    { i: 1, status: 'partly', quote: '400', tip: 'כתבו מה קורה בדיוק בסכום הזה.' },
    { i: 2, status: 'no', quote: '', tip: 'בחרו סכום אחד וחשבו את שתי העמלות.' },
  ],
};
const FAMILY_STATUS = {
  paywall: true, tier: 'family', kinds: ['explain', 'chat', 'check', 'generate', 'exam', 'feedback'], economy: false, shared: null, aiReady: true,
  groups: { tutor: { left: 29, limit: 30 }, check: { left: 6, limit: 6 }, generate: { left: 5, limit: 5 }, exam: { left: 2, limit: 2 } },
  resetsAt: '2026-11-06T00:00:00+02:00', linked: null,
};

/** Parts 1-3 of pct:c1, right first time, up to its explanation. */
async function toExplain(page) {
  await type(page, '7.5'); await go(page, 'בדיקה').click(); await go(page, 'המשך').click();
  await type(page, '400'); await go(page, 'בדיקה').click(); await go(page, 'המשך').click();
  await page.getByRole('radio', { name: /מסלול ב/ }).click(); await go(page, 'בדיקה').click(); await go(page, 'המשך').click();
  await expect(page.locator('.ch-count')).toHaveText('חלק 4 מתוך 4');
}

test('the tutor\'s feedback on the explanation: sent only on the press, each point\'s status, the student\'s words marked', async ({ page }, info) => {
  const sent = [];
  await page.route(`${API}/**`, async (route) => {
    const req = route.request(); const path = new URL(req.url()).pathname;
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    if (path === '/api/ai/status') return route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(FAMILY_STATUS) });
    if (path === '/api/ai/feedback') {
      sent.push(JSON.parse(req.postData()));
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { ...CORS, 'X-AI-Tier': 'family', 'X-AI-Group': 'tutor', 'X-AI-Left': '28' }, body: JSON.stringify(FEEDBACK_REPLY) });
    }
    return route.fulfill({ status: 204, headers: CORS });
  });
  const st = pctStudent();
  st.state.ai = { mode: 'server', apiUrl: API, key: '', introSeen: true };
  await open(page, '#/challenge/pct:c1', st);
  await toExplain(page);
  await page.locator('.ch-explain').fill(WRITTEN);
  const ask = page.getByRole('button', { name: 'בקשו מהעוזר משוב על ההסבר' });
  await expect(ask).toHaveCount(0); // not before the self-check
  await go(page, 'סיימתי').click();
  await expect(ask).toBeVisible();
  await ask.evaluate((el) => el.scrollIntoView({ block: 'center' })); // under the self-check: the student scrolls to it
  await expectUsable(page, ask, 'the feedback button');
  expect((await ask.boundingBox()).height).toBeGreaterThanOrEqual(44);
  expect(sent).toHaveLength(0); // the text has not left the device
  if (SHOTS) { mkdirSync(SHOTS, { recursive: true }); await ask.scrollIntoViewIfNeeded(); await page.screenshot({ path: `${SHOTS}/challenge-feedback-button-${info.project.name}.png` }); }

  await ask.click();
  const result = page.locator('.ch-fb-live .ch-fb-result');
  await expect(result).toBeVisible();
  await expect(result).toContainText('העוזר סימן אילו נקודות כבר יש בהסבר שלכם. את ההסבר עצמו הוא לא משנה, וזה לא ציון.');
  await expect(page.locator('.ch-fb-live')).toHaveAttribute('aria-live', 'polite');
  const point = (s) => result.locator(`.ch-fb-point[data-status="${s}"]`);
  await expect(point('yes').locator('.ch-fb-status')).toHaveText(/יש$/);
  await expect(point('partly').locator('.ch-fb-status')).toHaveText(/יש חלק$/);
  await expect(point('no').locator('.ch-fb-status')).toHaveText(/עוד חסר$/);
  await expect(point('yes')).toContainText('אמרתי מתי כל מסלול זול יותר');
  await expect(point('yes').locator('mark')).toHaveText('מי שקונה בפחות מ־400 משלם פחות במסלול א');
  await expect(point('yes').locator('.ch-fb-quote')).toContainText('. מעל זה כדאי מסלול ב.'); // marked inside the student's own text
  await expect(point('partly').locator('mark')).toHaveText('400');
  await expect(point('partly')).toContainText('כתבו מה קורה בדיוק בסכום הזה.');
  await expect(point('no').locator('mark')).toHaveCount(0);
  await expect(point('no')).toContainText('בחרו סכום אחד וחשבו את שתי העמלות.');
  await expect(result).toContainText(FEEDBACK_REPLY.summary);
  // asked once: the button stays where the focus was, says the reply is below, and does nothing more
  const ready = page.getByRole('button', { name: 'המשוב מהעוזר כאן למטה' });
  await expect(ready).toHaveAttribute('aria-disabled', 'true');
  await expect(ask).toHaveCount(0);
  await ready.click({ force: true });
  await expectNoSidewaysScroll(page);
  if (SHOTS) {
    await result.scrollIntoViewIfNeeded(); await page.screenshot({ path: `${SHOTS}/challenge-feedback-result-${info.project.name}.png` });
    await page.emulateMedia({ colorScheme: 'dark' }); await page.screenshot({ path: `${SHOTS}/challenge-feedback-result-dark-${info.project.name}.png` }); await page.emulateMedia({ colorScheme: 'light' });
  }

  // one request, with exactly the challenge's context, its rubric and model answer, and the text as typed
  expect(sent).toHaveLength(1);
  const body = sent[0];
  expect(Object.keys(body).sort()).toEqual(['ctx', 'rubric', 'sample', 'stream', 'text']);
  expect(body.stream).toBe(false);
  expect(body.text).toBe(WRITTEN);
  expect(body.rubric).toEqual(['אמרתי מתי כל מסלול זול יותר', 'השתמשתי בסכום שבו הם שווים', 'נתתי דוגמה עם מספרים']);
  expect(body.sample).toContain('מסלול א');
  expect(body.ctx).toMatchObject({ v: 2, surface: 'challenge', skill: 'pct:2', topicId: 'pct', grade: '8', policy: { answer: 'reveal' } });
  expect(body.ctx.item.text).toContain('למי כדאי מסלול א, ולמי מסלול ב?');

  // nothing of it is kept: not the text, not the reply
  await go(page, 'לסיום').click();
  await expect(page.getByRole('heading', { name: 'אתגר הושלם. זה לא היה פשוט, והצלחתם.' })).toBeVisible();
  const kept = JSON.stringify(await saved(page));
  expect(kept).not.toContain('מעל זה כדאי מסלול ב');
  expect(kept).not.toContain(FEEDBACK_REPLY.summary);
});

test('a QA build (no server) answers the feedback from its fixtures: every point still open, nothing sent', async ({ page }) => {
  const sent = [];
  await page.route('**/api/ai/**', (route) => { sent.push(route.request().url()); return route.abort(); });
  await open(page, '#/challenge/pct:c1?qa-ai=family', pctStudent());
  await toExplain(page);
  await page.locator('.ch-explain').fill(WRITTEN);
  await go(page, 'סיימתי').click();
  await page.getByRole('button', { name: 'בקשו מהעוזר משוב על ההסבר' }).click();
  const result = page.locator('.ch-fb-result');
  await expect(result).toBeVisible();
  await expect(result.locator('.ch-fb-point[data-status="no"]')).toHaveCount(3);
  await expect(result).toContainText('בגרסה הזו אין שרת');
  expect(sent).toEqual([]);
});

test('without the tutor on this device there is no feedback button, and the self-check is as it was', async ({ page }) => {
  await open(page, '#/challenge/pct:c1', pctStudent());
  await toExplain(page);
  await page.locator('.ch-explain').fill(WRITTEN);
  await go(page, 'סיימתי').click();
  await expect(page.getByRole('heading', { name: 'בדקו את התשובה שלכם' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'בקשו מהעוזר משוב על ההסבר' })).toHaveCount(0);
});

test('angles:c1: the proof put in order with the move buttons from the keyboard alone', async ({ page }) => {
  await open(page, '#/challenge/angles:c1', student('8'));
  await expect(page.locator('.ch-count')).toHaveText('חלק 1 מתוך 2');
  const ids = () => page.locator('.ch-order .ch-step-text').evaluateAll((els) => els.map((e) => Number(e.id.replace('ch-step-', ''))));
  const start = await ids();
  expect(start).not.toEqual([0, 1, 2, 3, 4]); // never shown already in order
  // every move button is a full 44px target with its name
  for (const b of await page.getByRole('button', { name: 'הזיזו למעלה' }).all()) {
    const box = await b.boundingBox();
    expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
  }
  // put step k at place k: focus its "up" button once, then Enter; the focus stays on the moved step
  for (let k = 0; k < 5; k += 1) {
    let order = await ids();
    let from = order.indexOf(k);
    if (from === k) continue;
    await page.locator(`.ch-move[aria-describedby="ch-step-${k}"][aria-label="הזיזו למעלה"]`).focus();
    while (from > k) {
      await page.keyboard.press('Enter');
      order = await ids();
      expect(order.indexOf(k)).toBe(from - 1);
      from -= 1;
      if (from > 0) await expect(page.locator(`.ch-move[aria-describedby="ch-step-${k}"][aria-label="הזיזו למעלה"]`)).toBeFocused();
      else await expect(page.locator(`.ch-move[aria-describedby="ch-step-${k}"][aria-label="הזיזו למטה"]`)).toBeFocused();
    }
  }
  expect(await ids()).toEqual([0, 1, 2, 3, 4]);
  await go(page, 'בדיקה').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.ch-foot .lm-banner')).toHaveText('נכון!');
  await go(page, 'המשך').click();
  // the reasons of the two equal angles
  for (let r = 0; r < 2; r += 1) {
    await page.getByRole('radio', { name: 'זוויות מתחלפות בין מקבילים' }).click();
    await go(page, 'בדיקה').click();
    await expect(page.locator('.ch-foot .lm-banner')).toHaveText('נכון!');
    await go(page, 'המשך').click();
  }
  await expect(page.locator('.ch-count')).toHaveText('חלק 2 מתוך 2');
  await type(page, '70');
  await go(page, 'בדיקה').click();
  await go(page, 'לסיום').click();
  await expect(page.locator('.ch-done .stat-value')).toHaveText('+30');
  await expectNoSidewaysScroll(page);
});

test('frac:c1: "sometimes", then the counterexample 3, 2, 1 typed into its slots is accepted', async ({ page }) => {
  await open(page, '#/challenge/frac:c1', student('7'));
  await expect(page.locator('.ch-claim')).toContainText('השבר גדל');
  await page.getByRole('radio', { name: 'לפעמים' }).click();
  await go(page, 'בדיקה').click();
  await expect(page.locator('.ch-foot .lm-banner')).toHaveText('נכון!');
  await go(page, 'המשך').click();
  await expect(page.getByRole('heading', { name: 'תנו דוגמה' })).toBeVisible();
  // the keypad types into the active slot, and its "next" key moves on: numerator, denominator, what is added
  await type(page, '3');
  await page.getByRole('button', { name: 'לשדה הבא' }).click();
  await type(page, '2');
  await page.getByRole('button', { name: 'לשדה הבא' }).click();
  await type(page, '1');
  await expect(page.locator('#ch-slot-a')).toHaveValue('3');
  await expect(page.locator('#ch-slot-b')).toHaveValue('2');
  await expect(page.locator('#ch-slot-k')).toHaveValue('1');
  await expectNoSidewaysScroll(page);
  await go(page, 'בדיקה').click();
  await expect(page.locator('.ch-foot .lm-banner')).toHaveText('נכון!');
  await go(page, 'המשך').click();
  await page.getByRole('radio', { name: 'לשברים חיוביים קטנים מ־1' }).click();
  await go(page, 'בדיקה').click();
  await go(page, 'לסיום').click();
  await expect(page.locator('.ch-done .stat-value')).toHaveText('+30');
});

test('func:c1: "sometimes", a start of 0° is not a counterexample, 8° is', async ({ page }) => {
  await open(page, '#/challenge/func:c1', student('8'));
  await expect(page.locator('.ch-title')).toHaveText('התחלה מאפס?');
  await expect(page.locator('.ch-claim')).toContainText('משתנה בקצב אחיד');
  await page.getByRole('radio', { name: 'לפעמים' }).click();
  await go(page, 'בדיקה').click();
  await expect(page.locator('.ch-foot .lm-banner')).toHaveText('נכון!');
  await go(page, 'המשך').click();
  await expect(page.getByRole('heading', { name: 'תנו דוגמה' })).toBeVisible();
  await page.locator('#ch-slot-s').fill('0'); // from 0°: 20° after 2 minutes and 40° after 4, the claim holds
  await go(page, 'בדיקה').click();
  await expect(page.locator('.ch-foot .lm-banner')).toHaveText('עוד לא. נסו שוב, יש עוד ניסיון.');
  await page.locator('#ch-slot-s').fill('8'); // from 8°: 6° a minute, 32° after 4 minutes
  await go(page, 'בדיקה').click();
  await expect(page.locator('.ch-foot .lm-banner')).toHaveText('נכון!');
  await go(page, 'המשך').click();
  await page.getByRole('radio').filter({ hasText: 'כשההתחלה' }).click();
  await go(page, 'בדיקה').click();
  await expect(page.locator('.ch-foot .lm-banner')).toHaveText('נכון!');
  await expectNoSidewaysScroll(page);
});

test('a wrong counterexample gets a second try, then the part goes on with its hint', async ({ page }) => {
  await open(page, '#/challenge/frac:c1', student('7'));
  await page.getByRole('radio', { name: 'תמיד נכון' }).click();
  await go(page, 'בדיקה').click();
  await expect(page.locator('.ch-foot .lm-banner')).toHaveText('עוד לא. נסו שוב, יש עוד ניסיון.');
  await page.getByRole('radio', { name: 'אף פעם' }).click();
  await go(page, 'בדיקה').click();
  await expect(page.locator('.ch-foot .lm-banner')).toHaveText('הנה הפתרון. ממשיכים.');
  await expect(page.getByRole('radio', { name: 'לפעמים' })).toHaveAttribute('aria-checked', 'true');
  await go(page, 'המשך').click();
  for (const name of ['a', 'b', 'k']) await page.locator(`#ch-slot-${name}`).fill('1');
  await page.locator('#ch-slot-a').fill('1'); await page.locator('#ch-slot-b').fill('2');
  await go(page, 'בדיקה').click(); // 1/2 grows to 2/3: not a counterexample
  await expect(page.locator('.ch-foot .lm-banner')).toHaveText('עוד לא. נסו שוב, יש עוד ניסיון.');
  await expect(page.locator('.ch-foot')).toContainText('נסו שבר שהמונה שלו גדול מהמכנה.');
});

// ------------------------------------------------------------------ where challenges appear (CURRICULUM-6.3)

/** A ח׳ student who has mastered pct:1 and learned pct:2 (taught, practised) but not checked it: pct:c1 follows pct:2. */
const beforeCheck = () => ({
  ...student('8', {
    path: { pct: { parts: { 1: 2, 2: 2 }, reviews: 0, jumped: 0, done: { 1: 'mastered' } } },
    learn: {
      skills: { 'pct:1': mastered, 'pct:2': { taught: { A: at, B: at, C: at }, attempts: Array.from({ length: 6 }, () => ({ at, ok: true, independent: true, purpose: 'practice' })) } },
      miscon: {}, exam: null, missions: {}, events: [], floor: null, challenges: {},
    },
  }),
  version: 6,
});
/** Pass pct:2's mastery check: five right answers. */
async function passCheck(page) {
  await expect.poll(() => item(page)).toBeTruthy();
  for (let i = 0; i < 5; i += 1) { await answer(page, true); await page.locator('section.fb .fb-actions .btn').click(); }
  await expect(page.getByRole('heading', { name: 'שולטים לבד!' })).toBeVisible();
}

test('the stair page: the challenge card is locked until the mastery check, then opens the task', async ({ page }) => {
  await open(page, '#/learn/pct/2', beforeCheck());
  const card = page.locator('.jchallenge');
  await expect(card).toHaveCount(1);
  await expect(card).toHaveClass(/locked/);
  await expect(card).toContainText('אתגר · לבחירה');
  await expect(card).toContainText('נפתח אחרי בדיקת השליטה');
  await expect(card.getByRole('button')).toHaveCount(0); // locked: nothing to press
  // a stair without a task has no card
  await page.goto('./#/learn/pct/1');
  await expect(page.locator('.journey-title')).toBeVisible();
  await expect(page.locator('.jchallenge')).toHaveCount(0);
  // pass the check; put the offer off for now
  await page.goto('./#/lesson/pct/2?kind=check&purpose=mastery');
  await page.reload();
  await passCheck(page);
  await page.getByRole('button', { name: 'לא עכשיו' }).click();
  await expect(page.locator('.check-challenge')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'שולטים לבד!' })).toBeFocused();
  // the stair page now opens it
  await page.goto('./#/learn/pct/2');
  await expect(card).not.toHaveClass(/locked/);
  await expect(card).toContainText('שתי דרכים לשלם עמלה');
  const go = card.getByRole('button', { name: 'לאתגר: שתי דרכים לשלם עמלה' });
  await go.scrollIntoViewIfNeeded();
  await expectUsable(page, go, 'the challenge button');
  expect((await go.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await expectNoSidewaysScroll(page);
  await go.click();
  await expect(page).toHaveURL(/#\/challenge\/pct:c1$/);
  await expect(page.locator('.ch-title')).toHaveText('שתי דרכים לשלם עמלה');
});

test('a passed mastery check offers the stair\'s challenge in a quiet card, which opens it', async ({ page }) => {
  await open(page, '#/lesson/pct/2?kind=check&purpose=mastery', beforeCheck());
  await passCheck(page);
  const card = page.locator('.check-challenge');
  await expect(card.getByRole('heading', { name: 'יש אתגר למדרגה הזאת. רוצים לנסות?' })).toBeVisible();
  await expect(card).toContainText('שתי דרכים לשלם עמלה');
  // the main button is still the plan's next step, never this stair's challenge a second time
  await expect(page.locator('.check-done .form-actions .btn-lg')).not.toContainText('אתגר');
  for (const name of ['לאתגר', 'לא עכשיו']) expect((await card.getByRole('button', { name }).boundingBox()).height).toBeGreaterThanOrEqual(44);
  await expectNoSidewaysScroll(page);
  await card.getByRole('button', { name: 'לאתגר' }).click();
  await expect(page).toHaveURL(/#\/challenge\/pct:c1$/);
  await expect(page.locator('.ch-count')).toHaveText('חלק 1 מתוך 4');
});

// ------------------------------------------------------------------ every task, every step, on the small phone
// A review found two solutions cut off at 320 px inside the part's own scroller (sys:c3's sample read "0 · 30" for
// "70 · 30"), where the page itself did not scroll sideways. Every task is walked to its end the way a struggling student
// meets the most text: each part missed twice (so its solution shows), each explanation sent for the self-check. At every
// step nothing inside the challenge screen scrolls sideways, and no piece of maths sits past the screen's edge.
// (curriculum stage 3's data and probability units included)
const TOPICS = ['frac', 'signed', 'coord', 'angles', 'expr', 'data', 'eq', 'ratio', 'pct', 'func', 'line', 'pyth', 'stats', 'sys', 'prob'];

async function nothingCutOff(page, where) {
  const over = await page.evaluate(async () => {
    await document.fonts.ready; // KaTeX's fonts load when maths first shows: measure with them
    const out = [];
    for (const e of document.querySelectorAll('.ch-screen, .ch-screen *')) {
      if (e.closest('.katex-mathml')) continue; // KaTeX's copy for screen readers: clipped to 1px on purpose
      const cs = getComputedStyle(e);
      if (cs.overflowX !== 'visible' && e.scrollWidth > e.clientWidth + 1) out.push(`${e.tagName.toLowerCase()}.${String(e.className).split(' ').join('.')} ${e.scrollWidth} > ${e.clientWidth}`);
    }
    for (const k of document.querySelectorAll('.ch-screen .katex')) {
      const b = k.getBoundingClientRect();
      if (b.width > 0 && (b.left < -1 || b.right > window.innerWidth + 1)) out.push(`maths at ${Math.round(b.left)}..${Math.round(b.right)}: ${k.querySelector('annotation')?.textContent}`);
    }
    return out;
  });
  expect(over, where).toEqual([]);
  await expectNoSidewaysScroll(page);
}

async function walk(page, id) {
  await page.goto(`./#/challenge/${id}`);
  await page.reload();
  await expect(page.locator('.ch-title')).toBeVisible();
  const goBtn = page.locator('.ch-foot .ch-go');
  for (let step = 0; step < 80; step += 1) {
    await nothingCutOff(page, `${id}, step ${step}`);
    if (await page.locator('.ch-done').count()) return step;
    const label = (await goBtn.textContent())?.trim();
    if (label === 'סיימתי') { await page.locator('.ch-explain').fill('בדקתי.'); await goBtn.click(); continue; }
    if (label !== 'בדיקה' && await goBtn.isEnabled()) { await goBtn.click(); continue; }
    // a part to answer: 1 in every open slot, else the first choice still open (a proof is checked as it stands)
    const slots = page.locator('input.ch-slot:not([readonly])');
    const radio = page.locator('[role=radio]:not([disabled]):not([aria-checked="true"])');
    if (await slots.count()) { for (const s of await slots.all()) await s.fill('1'); }
    else if (await radio.count()) await radio.first().click();
    await expect(goBtn, `${id}, step ${step}: nothing to press`).toBeEnabled();
    await goBtn.click();
  }
  throw new Error(`${id} did not end in 80 steps`);
}

// three tasks a topic, and one more where a later stair brought its own (eq:c4, after the motion problems of eq:6)
const COUNT = { eq: 4 };
for (const topic of TOPICS) {
  test(`at 320 px nothing is cut off in ${topic}'s challenges, at any step`, async ({ page }, info) => {
    test.skip(info.project.name !== 'phone-small', 'the narrow phone is the one that cuts');
    await open(page, '#/', student(['ratio', 'pct', 'func', 'line', 'pyth', 'stats', 'sys', 'prob'].includes(topic) ? '8' : '7'));
    for (let n = 1; n <= (COUNT[topic] || 3); n += 1) {
      const steps = await walk(page, `${topic}:c${n}`);
      expect(steps, `${topic}:c${n} walked`).toBeGreaterThan(2);
      await nothingCutOff(page, `${topic}:c${n}, the end`);
    }
  });
}
