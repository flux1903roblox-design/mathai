// One "what next" (CURRICULUM-7): the home's next step, the mission's first row and Exam Rescue's start button name the
// same step and lead to the same route. The student has a review due and an exam in three days; the exam's steps come
// first, and the review is under them.
import { test, expect } from '@playwright/test';
import { open, student, item, answer, saved, expectUsable, expectNoSidewaysScroll } from './helpers.js';
import { API, fakeServer } from './fakeServer.js';

test.beforeEach(({}, info) => { test.skip(!['phone', 'phone-small'].includes(info.project.name), 'the next step runs on both phones'); });

const at = '2026-11-01T10:00:00.000Z';
const mastered = { taught: { A: at, B: at, C: at }, attempts: Array.from({ length: 6 }, () => ({ at, ok: true, independent: true, purpose: 'practice' })), mastered: { at, box: 0, due: '2026-11-02T10:00:00.000Z' } };
/** NOW is Thursday 5.11: the exam is on Sunday 8.11, diagnosed (חיבור וחיסור a gap, השוואת מספרים right twice); קריאת נקודה's review is due. */
function examSoon() {
  const st = student('7', { path: { coord: { parts: { 1: 2 }, reviews: 0, jumped: 0, done: { 1: 'mastered' } } } });
  st.state.learn = {
    skills: { 'coord:1': mastered }, miscon: {}, missions: {}, events: [], floor: null, challenges: {},
    exam: { grade: '7', date: '2026-11-08', skills: ['signed:1', 'signed:2'], confidence: 2, minutes: 15, createdAt: '2026-11-04T10:00:00.000Z', diagnostic: { 'signed:1': { asked: 2, right: 0, at: '2026-11-04T10:00:00.000Z' }, 'signed:2': { asked: 2, right: 2, at: '2026-11-04T10:00:00.000Z' } } },
  };
  return { ...st, version: 6 };
}

// Proof screenshots, only when NEXT_SHOTS names a folder.
const shot = async (page, name) => {
  const dir = process.env.NEXT_SHOTS; if (!dir) return;
  await page.waitForTimeout(900); // a screen that just opened has settled (its fade-in)
  await page.screenshot({ path: `${dir}/next-${name}-${test.info().project.name}.png`, animations: 'disabled' });
};
const route = (page) => new URL(page.url()).hash;
const STEP = 'לומדים: חיבור וחיסור';

test('the home banner, the mission\'s first row and Rescue\'s start button lead to the same step', async ({ page }) => {
  // home: the next step is an exam step, not a stop of the map, so it is the banner above the path
  await open(page, '#/', examSoon());
  const banner = page.getByRole('region', { name: 'הצעד הבא' });
  await expect(banner).toContainText(STEP);
  await expect(banner).toContainText('הכנה למבחן · 5 דק׳');
  await expect(page.locator('.next-banner')).toHaveCount(1);
  await expectUsable(page, banner.getByRole('button', { name: 'לצעד הבא' }), 'the banner button');
  await expectNoSidewaysScroll(page);
  await shot(page, 'home');
  await banner.getByRole('button', { name: 'לצעד הבא' }).click();
  const fromHome = route(page);
  expect(fromHome).toBe('#/learn/signed/1');

  // the mission: its first row is the same step, then the due review; the button starts it; the exam card names it
  await open(page, '#/quests', examSoon());
  const rows = page.locator('.today-items li');
  await expect(rows.first()).toContainText(STEP);
  await expect(page.locator('.today-exam .exam-cta-sub')).toHaveText(STEP);
  await shot(page, 'mission');
  await page.locator('.continue-go').click();
  expect(route(page)).toBe(fromHome);

  // Exam Rescue: today's first step, and its start button
  await open(page, '#/rescue', examSoon());
  const today = page.locator('.rescue-day.today');
  await expect(today.locator('.rescue-task').first()).toContainText(STEP);
  await today.scrollIntoViewIfNeeded();
  await shot(page, 'rescue');
  await today.getByRole('button', { name: 'מתחילים', exact: true }).click();
  expect(route(page)).toBe(fromHome);
});

// CURRICULUM-7.1 band 1 (FOLLOWUP-17): the teacher's work due tomorrow is the plan's top, so the mission's big button,
// the banner above the map and the profile's next step all lead to it, as its row on the missions tab does.
test('a class student with work due tomorrow: Today, the map\'s banner and Me all lead to it', async ({ page }) => {
  const work = { id: 'a000000000000001', kind: 'stair', skill: 'signed:1', title: 'מספרים מכוונים: חיבור וחיסור', note: '', startsOn: '2026-11-04', dueOn: '2026-11-06',
    forAll: true, targets: [], createdAt: '2026-11-04T07:00:00.000Z' };
  await fakeServer(page, { assignments: [work] }, test.info().project.use.baseURL);
  // the device fetched the class's work earlier today (it fetches again on opening): the plan has it from the first paint
  const inClass = () => ({ ...student('7', {
    profile: { role: 'student', name: 'דנה', grade: '7', know: 1, classCode: 'K7Q2MD', className: 'ז׳3', teacherName: 'רונית', token: 'stok-a1', studentId: 'a1' },
    ai: { mode: 'server', apiUrl: API, key: '', device: '', introSeen: true },
    classWork: { at: '2026-11-05T07:00:00.000Z', today: '2026-11-05', teacherName: 'רונית', help: [], exams: {}, seenAt: '2026-11-05T07:00:00.000Z', noticed: {},
      assignments: [{ id: work.id, kind: work.kind, skill: work.skill, title: work.title, note: '', startsOn: work.startsOn, dueOn: work.dueOn, createdAt: work.createdAt, hasExam: false, examCount: null, mine: null }] },
  }), version: 3 });
  const WORK = '#/learn/signed/1?assignment=a000000000000001';

  // Today: the teacher's row first, and the big button starts that work
  await open(page, '#/quests', inClass());
  const row = page.getByRole('region', { name: 'מהמורה רונית' }).getByRole('listitem').first();
  await expect(row).toContainText('מספרים מכוונים: חיבור וחיסור');
  await expect(row).toContainText('מדרגה ללמוד · עד מחר');
  const go = page.locator('.continue-go');
  await expect(go).toHaveText('מתחילים במשימה מהמורה');
  await expectUsable(page, go, 'the big button');
  await expectNoSidewaysScroll(page);
  // the mission's own parts never repeat the stair the teacher gave
  await expect(page.locator('.today-items li').filter({ hasText: 'חיבור וחיסור' })).toHaveCount(1);
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot(page, 'today-teacher');
  await go.click();
  expect(route(page)).toBe(WORK);
  await expect(page.getByText('משימה מהמורה, עד מחר')).toBeVisible();

  // the map: the next step is no stop of the map, so the banner above it names the work, and no second chip repeats it
  await open(page, '#/', inClass());
  const banner = page.getByRole('region', { name: 'הצעד הבא' });
  await expect(banner).toContainText('מספרים מכוונים: חיבור וחיסור');
  await expect(banner).toContainText('משימה מהמורה, עד מחר · ');
  await expect(page.locator('.learn-work-chip')).toHaveCount(0);
  await expectNoSidewaysScroll(page);
  await shot(page, 'home-teacher');
  await banner.getByRole('button', { name: 'לצעד הבא' }).click();
  expect(route(page)).toBe(WORK);

  // Me: the next step is the same work, and says it is from the teacher
  await open(page, '#/me', inClass());
  const next = page.locator('.ps-next');
  await expect(next).toContainText('מספרים מכוונים: חיבור וחיסור');
  await expect(next).toContainText('הצעד הבא: משימה מהמורה');
  await next.getByRole('button', { name: 'מתחילים' }).click();
  expect(route(page)).toBe(WORK);
});

test('with the next step a stair of the map, there is no banner and the map opens on that stair', async ({ page }) => {
  // a ז׳ student in November with nothing done: the next step is the first stair, the map's current stop
  await open(page, '#/', student('7'));
  await expect(page.locator('.learn-top')).toBeVisible();
  await expect(page.locator('.next-banner')).toHaveCount(0);
  await expect(page.locator('.node-current').first()).toBeVisible();
  // a stair kept from before mastery checks: its check is the next step, marked on the map, and its card leads with it
  const kept = student('7', { path: { signed: { parts: { 1: 2, 2: 2 }, reviews: 0, jumped: 0, done: { 1: 'kept', 2: 'kept' } } } });
  kept.state.learn = { skills: {}, miscon: {}, missions: {}, events: [], exam: null, floor: null, challenges: {} };
  await open(page, '#/', { ...kept, version: 6 });
  await expect(page.locator('.next-banner')).toHaveCount(0);
  const next = page.locator('.node-next');
  await expect(next).toHaveText('הצעד הבא');
  await shot(page, 'map-kept');
  await page.locator('.unit').first().locator('.node').first().click();
  await expect(page.locator('.node-card')).toContainText('המדרגה הושלמה לפני שהיו בדיקות שליטה');
  const check = page.locator('.node-card').getByRole('button', { name: 'לבדיקת שליטה' });
  // the card's foot just above the tab bar, so the unit's sticky banner covers none of it
  await page.locator('.node-card').evaluate((el) => window.scrollBy(0, el.getBoundingClientRect().bottom - (window.innerHeight - 88)));
  await expectUsable(page, check, 'the check button');
  await shot(page, 'card-kept');
  await check.click();
  await expect(page).toHaveURL(/lesson\/signed\/1\?kind=check&purpose=mastery/);
});

// The improvement plan is retired (CURRICULUM-7): its evidence is the plan's exam-loss band, and the daily quests point
// at the one mission instead of suggesting work of their own.
const review = { kind: 'review', skill: 'coord:1', title: 'בדיקת זיכרון: קריאת נקודה', reason: 'שלטתם בזה לפני 4 ימים. שלוש שאלות כדי לוודא שזה נשאר.', minutes: 2, to: '/lesson/coord/1?kind=check&purpose=review' };
/** A student whose mission today is one due review (saved, so it is fixed for the day), with practice mistakes and a checked exam. */
function missionOfOne({ exam = false } = {}) {
  const st = student('7', { mistakes: { 'signed:sign': 3 }, path: { coord: { parts: { 1: 2 }, reviews: 0, jumped: 0, done: { 1: 'mastered' } } } });
  if (exam) {
    st.state.exams = [{ id: 'e1', at: '2026-11-03T10:00:00.000Z', title: 'מבחן', source: 'upload', score: { correct: 1, total: 2, pct: 50 },
      result: { readable: true, questions: [{ number: 1, topic: 'coord', level: 2, status: 'wrong' }, { number: 2, topic: 'coord', level: 1, status: 'correct' }] } }];
  }
  st.state.learn = { skills: { 'coord:1': mastered }, miscon: {}, events: [], exam: null, floor: null, challenges: {}, missions: { '2026-11-05': { items: [review] } } };
  return { ...st, version: 6 };
}

test('an old /plan bookmark lands on the quests, which show no improvement plan', async ({ page }) => {
  await open(page, '#/plan', missionOfOne());
  await expect(page).toHaveURL(/#\/quests$/);
  await expect(page.getByRole('heading', { name: 'המשימה שלי להיום' })).toBeVisible();
  await expect(page.getByText('התוכנית שלי לשיפור')).toHaveCount(0);
  await expect(page.locator('a[href*="plan"]')).toHaveCount(0);
  // with no checked exam there is nothing lost to list
  await expect(page.getByRole('region', { name: 'מה לחזק אחרי המבחן' })).toHaveCount(0);
  await shot(page, 'quests-no-exam');
  // with a checked exam, the stair it lost is listed (the exams tab lists the same)
  await open(page, '#/quests', missionOfOne({ exam: true }));
  const lost = page.getByRole('region', { name: 'מה לחזק אחרי המבחן' });
  await expect(lost.locator('li')).toHaveCount(1);
  await lost.scrollIntoViewIfNeeded();
  await expectUsable(page, lost.locator('a.hub-row'), 'the exam-loss row');
  await expectNoSidewaysScroll(page);
  await shot(page, 'quests-exam-loss');
  await open(page, '#/exams', missionOfOne({ exam: true }));
  await expect(page.getByText('התוכנית שלי לשיפור')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'מה לחזק אחרי המבחן' }).locator('li')).toHaveCount(1);
  await expectNoSidewaysScroll(page);
  await shot(page, 'exams-exam-loss');
});

test('finishing the mission ticks the quest "השלימו את המשימה שלי להיום"', async ({ page }) => {
  await open(page, '#/quests', missionOfOne());
  const quest = page.locator('.quest-mission');
  await expect(quest).toContainText('השלימו את "המשימה שלי להיום"');
  await expect(quest).not.toHaveClass(/done/);
  await expect(quest.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  // the mission's one part is the due review: three questions
  await page.locator('.continue-go').click();
  await expect(page).toHaveURL(/lesson\/coord\/1\?kind=check&purpose=review/);
  for (let n = 0; n < 6 && !(await page.locator('.check-done').count()); n += 1) {
    await expect.poll(async () => (await page.locator('.check-done').count()) > 0 || !!(await item(page))).toBe(true);
    if (await page.locator('.check-done').count()) break;
    await answer(page, true);
    await page.locator('section.fb .fb-actions .btn').click();
  }
  await expect(page.locator('.check-done')).toBeVisible();
  expect((await saved(page)).days['2026-11-05'].missionDone).toBe(1);
  await page.goto('./#/quests');
  await expect(page.getByRole('heading', { name: 'המשימה של היום הושלמה' })).toBeVisible();
  await expect(page.locator('.quest-mission')).toHaveClass(/done/);
  await expect(page.locator('.quest-mission').getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
});
