// "מדי שלי" (STUDENT-3): Madi on the profile, the wardrobe (what is owned in one group per slot, built on Base UI radio
// groups in RTL; the meter of the next piece and the few pieces that come next, each saying how it opens; PRODUCT2-36),
// the path's chests that say what they hold, the unlock moment after a result (and after the first teaching stage),
// with the maths burst on a new colour (PKG-3), and the quest chest's choice of one of two pieces. The clock is fixed on
// Thursday 5 November 2026 (helpers.js NOW).
// PKG_SHOTS=<folder> saves pictures of the burst for a look (nothing is compared).
import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { open, student, answer, proceed, proceedToNext, saved, item, expectNoSidewaysScroll, expectUsable, dressed, doneStairs, playDiscover, stageDone, openUnit } from './helpers.js';
import { expectTextContrast } from './contrast.js';

const only = (...names) => ({}, info) => test.skip(!names.includes(info.project.name), `runs on ${names.join(' and ')}`);
// dressed (helpers.js, shared with a11y.spec.js): the angles chest open (stairs 1 to 3), the stats unit mastered (all 8,
// stats:6-8 since curriculum stage 3); טורקיז earned before, and stays earned
const done = doneStairs;
const lo = (page) => page.locator('.wardrobe-madi').getAttribute('style');

// the last stair of זוויות still to master; the unit's chest (the crown) was opened and shown before. The sounds are
// on (student() keeps them off): the burst also stays away with the app's sounds off (5f), so each burst test holds one
// reason at a time
// the angles unit's last stair: seven stairs since the classroom lane's angles:6 and angles:7
const lastStair = (extra = {}) => student('7', { path: { angles: done([1, 2, 3, 4, 5, 6]) }, look: { color: 'sky', head: null, face: null, neck: null, body: null, earned: ['protractor-crown'], seen: ['protractor-crown'], earnedAt: { 'protractor-crown': '2026-10-20' } }, sound: true, ...extra });
/** Pass a mastery check of five and go on to the unlock moment. */
async function passCheck(page, route, state) {
  await open(page, route, state);
  for (let i = 0; i < 5; i += 1) { await expect.poll(() => item(page)).toBeTruthy(); await answer(page, true); await proceed(page); }
  await expect(page.getByRole('heading', { name: 'שולטים לבד!' })).toBeVisible();
  await page.getByRole('button', { name: 'למפה' }).click();
  await expect(page.locator('.unlock-stage')).toBeVisible();
  return page.locator('.unlock-stage');
}
const COLOUR_REASON = 'סיימתם את כל המדרגות של זוויות. מדי יכול להיות עכשיו טורקיז.';
/** Requests for canvas-confetti's chunk (assets/confetti.module-*.js; none: it was never imported). */
const confettiRequests = (page) => { const urls = []; page.on('request', (r) => { if (/confetti\.module/.test(r.url())) urls.push(r.url()); }); return urls; };
async function burstShots(page, name) {
  const dir = process.env.PKG_SHOTS; if (!dir) return;
  mkdirSync(dir, { recursive: true });
  await page.waitForTimeout(350); // mid-burst: the symbols are up and spreading
  await page.screenshot({ path: `${dir}/${name}-390x844.png` });
  await page.setViewportSize({ width: 320, height: 568 });
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${dir}/${name}-320x568.png` });
  await page.setViewportSize({ width: 390, height: 844 });
}

test.describe('on a phone', () => {
  test.beforeEach(only('phone'));

  test('1. the profile shows the student\'s Madi, not a letter, in light and in dark, with the way to the wardrobe', async ({ page }) => {
    for (const scheme of ['light', 'dark']) {
      await page.emulateMedia({ colorScheme: scheme });
      await open(page, '#/me', dressed({ color: 'violet', head: 'protractor-crown' }));
      await expect(page.locator('.profile-avatar svg.mascot')).toBeVisible();
      await expect(page.locator('.avatar-initial')).toHaveCount(0);
      // the picture is hidden from screen readers: the name is the page's heading
      await expect(page.locator('.profile-avatar')).toHaveAttribute('aria-hidden', 'true');
      await expect(page.locator('.profile-avatar svg.mascot')).toHaveAttribute('style', /--madi-lo:\s*#7048e8/);
      await expect(page.locator('.profile-avatar g[data-item="protractor-crown"]')).toHaveCount(1);
      await expectTextContrast(page, `(profile, ${scheme})`);
    }
    await page.getByRole('link', { name: 'עיצוב מדי' }).click();
    await expect(page).toHaveURL(/#\/me\/madi$/);
    await expect(page.getByRole('heading', { level: 1, name: 'המדי שלי' })).toBeVisible();
  });

  test('2. choosing טורקיז puts it on the preview at once, and it is saved; only what is owned is in the groups', async ({ page }) => {
    await open(page, '#/me/madi', dressed());
    await expect(page.getByText('מדי מקבל חלקים חדשים כשלומדים: על שלבים שמסיימים, באמצע ובסוף כל יחידה, ובתיבת המשימות היומיות.')).toBeVisible();
    // a slot with nothing yet is left out: no wall of locked tiles (PRODUCT2-36)
    for (const h of ['צבע', 'על הראש', 'על המדרגה']) await expect(page.getByRole('radiogroup', { name: h })).toBeVisible();
    for (const h of ['על הפנים', 'על הצוואר']) await expect(page.getByRole('radiogroup', { name: h })).toHaveCount(0);
    await expect(page.locator('.wardrobe')).not.toContainText('נעול');
    const colours = page.getByRole('radiogroup', { name: 'צבע' });
    expect(await colours.getByRole('radio').allInnerTexts()).toEqual(['כחול', 'טורקיז\nמיחידת זוויות', 'מג׳נטה\nמיחידת סטטיסטיקה']);
    expect(await lo(page)).toBeNull(); // the default blue comes from tokens.css
    await colours.getByRole('radio', { name: /^טורקיז/ }).click();
    await expect(page.locator('.wardrobe-madi')).toHaveAttribute('style', /--madi-lo:\s*#0b7285/);
    await expect(colours.getByRole('radio', { name: /^טורקיז/ })).toHaveAttribute('aria-checked', 'true');
    expect((await saved(page)).look.color).toBe('petrol');
    // the class scarf is shown only to a student in a class (a solo student has no class goal)
    await expect(page.getByText('צעיף הכיתה')).toHaveCount(0);
    // and the colour goes with the student: back on the profile
    await page.getByRole('button', { name: 'חזרה' }).click();
    await expect(page.locator('.profile-avatar svg.mascot')).toHaveAttribute('style', /--madi-lo:\s*#0b7285/);
  });

  test('3. the meter names the next piece and how many stages are left; a coming piece says how it opens', async ({ page }) => {
    await open(page, '#/me/madi', dressed());
    // nothing learned in stages yet: the first piece is one stage away
    const meter = page.locator('.wardrobe-meter');
    await expect(meter.getByRole('heading', { level: 2 })).toHaveText('החלק הבא: עוד שלב אחד');
    await expect(meter).toContainText('כובע חגיגה');
    await expect(meter.getByRole('progressbar')).toHaveAttribute('aria-valuetext', 'כובע חגיגה: עוד שלב אחד');
    // the next two after it, then the count of the rest
    const soon = page.getByRole('region', { name: 'בדרך למדי' }).or(page.locator('.wardrobe-soon'));
    await expect(soon.locator('.wardrobe-soon-row')).toHaveCount(2);
    await expect(soon).toContainText(/ועוד \d+ חלקים שנפתחים בהמשך הלמידה ובתיבות המשימות\./);
    // a piece for stages: how many stages it takes, and no unit to go to
    const tie = soon.getByRole('button', { name: /^פפיון/ });
    await expect(tie).toContainText('עוד 10 שלבים · על כל שלב שתסיימו, בכל יחידה');
    await tie.click();
    const tieSheet = page.getByRole('dialog', { name: 'פפיון' });
    await expect(tieSheet).toContainText('נפתח אחרי 10 שלבים של לימוד');
    await expect(tieSheet.getByRole('button', { name: /^ליחידת/ })).toHaveCount(0);
    await page.keyboard.press('Escape');
    // a unit's chest piece (its stairs counted from the unit, which other lanes may lengthen): the nearest one, the
    // transformations' (two of its four stairs, 10 stages) since the stage-4 merge put that unit on the ז׳ path, before
    // the signed numbers' (three stairs, 15 stages: lib/path.js CHEST_KEPT)
    const scarf = soon.getByRole('button', { name: /^סיכת מראה/ });
    await expect(scarf).toContainText(/עוד \d+ שלבים · בתיבה של טרנספורמציות/);
    // keyboard: the row is a button; Enter opens how it opens, Escape gives the focus back
    await scarf.focus();
    await page.keyboard.press('Enter');
    const sheet = page.getByRole('dialog', { name: 'סיכת מראה' });
    await expect(sheet).toContainText(/נפתח כשתשלטו במדרגות 1 עד \d ביחידת טרנספורמציות\./);
    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
    await expect(scarf).toBeFocused();
    expect((await saved(page)).look.neck).toBeNull();
    await scarf.click();
    await page.getByRole('dialog', { name: 'סיכת מראה' }).getByRole('button', { name: 'ליחידת טרנספורמציות' }).click();
    await expect(page).toHaveURL(/#\/$/);
    await expect(page.locator('.unit').filter({ has: page.locator('.unit-title', { hasText: 'טרנספורמציות' }) })).toBeVisible();
  });

  test('4. the arrow keys move within a group, right to left, over what is owned', async ({ page }) => {
    await open(page, '#/me/madi', dressed());
    const head = page.getByRole('radiogroup', { name: 'על הראש' });
    const none = head.getByRole('radio', { name: 'בלי', exact: true });
    const crown = head.getByRole('radio', { name: /^כתר מד־זווית/ });
    await expect(head.getByRole('radio')).toHaveCount(2);
    await none.focus();
    await page.keyboard.press('ArrowLeft'); // right to left: the next option is on the left
    await expect(crown).toBeFocused();
    await expect(crown).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('.wardrobe-madi g[data-item="protractor-crown"]')).toHaveCount(1);
    expect((await saved(page)).look.head).toBe('protractor-crown');
    await page.keyboard.press('ArrowRight');
    await expect(none).toBeFocused();
    await expect(none).toHaveAttribute('aria-checked', 'true');
    expect((await saved(page)).look.head).toBeNull();
    await expect(page.locator('.wardrobe-madi g[data-item]')).toHaveCount(0);
  });

  test('4b. the first teaching stage brings the first piece, with its own moment, before the next stage (PRODUCT2-36)', async ({ page }) => {
    await open(page, '#/learn/signed/1/A', student('7'));
    await playDiscover(page);
    const moment = await stageDone(page, 1);
    await expect(moment.locator('.badges')).toContainText('מדי קיבל משהו חדש');
    await moment.getByRole('button', { name: 'לדוגמה הפתורה', exact: true }).click();
    const stage = page.locator('.unlock-stage');
    await expect(stage.getByRole('heading', { level: 1 })).toHaveText('מדי קיבל משהו חדש');
    await expect(stage.locator('.unlock-name')).toHaveText('כובע חגיגה');
    await expect(stage.locator('.unlock-reason')).toHaveText('סיימתם את השלב הראשון, ומדי קיבל כובע חגיגה.');
    await expect(stage.locator('.unlock-rays')).toHaveCount(1); // an accessory has its own moment, not only a colour
    await expect(stage.locator('g[data-item="party-hat"]')).toHaveCount(1);
    await stage.getByRole('button', { name: 'לשמור על מדי' }).click();
    // and on to where the student was going: the worked example
    await expect(page).toHaveURL(/learn\/signed\/1\/B/);
    const st = await saved(page);
    expect(st.look).toMatchObject({ head: 'party-hat', earned: ['party-hat'], seen: ['party-hat'] });
    // the wardrobe: the hat is owned, and the meter counts to the next piece
    await page.goto('./#/me/madi');
    await expect(page.locator('.wardrobe-meter').getByRole('heading', { level: 2 })).toHaveText('החלק הבא: עוד 9 שלבים');
    await expect(page.getByRole('radiogroup', { name: 'על הראש' }).getByRole('radio', { name: /^כובע חגיגה/ })).toContainText('על השלב הראשון');
  });

  test('4c. the quests tab: the chest\'s choice of one of two pieces is kept, and the other waits (PRODUCT2-36)', async ({ page }) => {
    await open(page, '#/quests', student('7', { days: { '2026-11-05': { lessons: 2, questsRewarded: true } } }));
    const choice = page.getByRole('group', { name: 'בחרו חלק אחד למדי' });
    await expect(choice.getByRole('button')).toHaveCount(2);
    const medal = choice.getByRole('button', { name: /^מדליה/ });
    await medal.click();
    await expect(medal).toHaveAttribute('aria-pressed', 'true');
    await expect(choice.getByRole('button', { name: /^כובע צמר/ })).toBeDisabled();
    await expect(choice).toContainText('מדליה אצל מדי. כובע צמר יחכה בתיבה הבאה.');
    const st = await saved(page);
    expect(st.look).toMatchObject({ earned: ['medal'], seen: ['medal'], picks: { '2026-11-05': 'medal' } });
    await page.goto('./#/me/madi');
    await expect(page.getByRole('radiogroup', { name: 'על הצוואר' }).getByRole('radio', { name: /^מדליה/ })).toContainText('מתיבת המשימות');
    await expect(page.locator('.chest-choice')).toHaveCount(0); // one piece a chest
  });

  test('4d. the lesson that finishes the day\'s quests: the freeze and the choice; "לשמור על מדי" puts the piece on', async ({ page }) => {
    // every quest of the day but one more lesson is done
    await open(page, '#/lesson/signed/1', student('7', { goalXp: 500, freezes: 0, days: { '2026-11-05': { lessons: 1, combo: 10, perfect: 1, ok: 30, xp: 60, missionDone: 1 } } }));
    await expect.poll(() => item(page)).toBeTruthy();
    for (let n = 0; n < 16 && !(await page.locator('.done-screen').count()); n += 1) {
      await proceedToNext(page, await answer(page, true));
      if (await page.locator('.combo-pop').count()) await page.locator('.combo-pop').click();
    }
    for (let k = 0; k < 6 && !(await page.locator('.quests-done-screen').count()); k += 1) {
      await page.locator('.done-screen .done-actions .btn').first().click();
      await page.waitForTimeout(300);
    }
    const chest = page.locator('.quests-done-screen');
    await expect(chest.locator('.streak-freeze')).toContainText('קיבלתם הקפאת רצף');
    const choice = chest.getByRole('group', { name: 'ובתיבה גם חלק למדי. בחרו אחד:' });
    await expect(choice.getByRole('button', { name: /^כובע צמר/ })).toBeVisible();
    await expect(chest.getByRole('button', { name: 'לבחור אחר כך' })).toBeVisible();
    await choice.getByRole('button', { name: /^כובע צמר/ }).click();
    await expect(chest.locator('.done-hero g[data-item="beanie"]')).toHaveCount(1); // Madi shows it on
    await chest.getByRole('button', { name: 'לשמור על מדי' }).click();
    const st = await saved(page);
    expect(st.freezes).toBe(1);
    expect(st.look).toMatchObject({ head: 'beanie', picks: { '2026-11-05': 'beanie' } });
    expect(st.look.earned).toContain('beanie');
  });

  test('5. a mastery check that opens a chest: the result, then the unlock moment; "לשמור על מדי" puts it on', async ({ page }) => {
    await open(page, '#/lesson/angles/3?kind=check&purpose=mastery', student('7', { path: { angles: done([1, 2]) } }));
    for (let i = 0; i < 5; i += 1) { await expect.poll(() => item(page)).toBeTruthy(); await answer(page, true); await proceed(page); }
    await expect(page.getByRole('heading', { name: 'שולטים לבד!' })).toBeVisible();
    await expect(page.locator('.check-done .badges')).toContainText('פתחתם תיבת אוצר');
    await page.getByRole('button', { name: 'למפה' }).click();
    const stage = page.locator('.unlock-stage');
    await expect(stage.getByRole('heading', { level: 1 })).toHaveText('מדי קיבל משהו חדש');
    await expect(stage.locator('.unlock-reason')).toHaveText('שלטתם בחצי הראשון של זוויות, ומדי קיבל כתר מד־זווית.');
    // the passed check is also the first stage this student worked through: the first piece for stages comes too
    await expect(stage.locator('.unlock-more')).toHaveText('ועוד חדש למדי: כובע חגיגה.');
    await expect(stage.locator('g[data-item="protractor-crown"]')).toHaveCount(1); // Madi already wears it
    expect((await saved(page)).look.head).toBeNull(); // not saved until the student says so
    await expect(stage.getByRole('button', { name: 'לשמור על מדי' })).toBeFocused();
    await stage.getByRole('button', { name: 'לשמור על מדי' }).click();
    await expect(page).toHaveURL(/#\/$/);
    const st = await saved(page);
    expect(st.look).toMatchObject({ head: 'protractor-crown', earned: ['protractor-crown', 'party-hat'], seen: ['protractor-crown', 'party-hat'], earnedAt: { 'protractor-crown': '2026-11-05' } });
    // the chest on the path now says what it gave, and the profile's Madi wears it
    const unit = await openUnit(page, 'זוויות');
    await unit.getByRole('button', { name: /^תיבת אוצר\. פתוחה/ }).click();
    await expect(unit.locator('.node-card')).toContainText('פתחתם: כתר מד־זווית.');
    await page.goto('./#/me');
    await expect(page.locator('.profile-avatar g[data-item="protractor-crown"]')).toHaveCount(1);
  });

  test('5b. after a lesson the unlock moment comes before the streak; "אחר כך" keeps the look and does not ask again', async ({ page }) => {
    await open(page, '#/lesson/signed/1', student('7', { goalXp: 500, path: { coord: done([1, 2, 3]) } }));
    await expect.poll(() => item(page)).toBeTruthy();
    for (let n = 0; n < 16 && !(await page.locator('.done-screen').count()); n += 1) {
      await proceedToNext(page, await answer(page, true));
      if (await page.locator('.combo-pop').count()) await page.locator('.combo-pop').click();
    }
    await expect(page.locator('.done-screen .stats')).toBeVisible();
    await page.locator('.done-screen .done-actions .btn').first().click();
    const stage = page.locator('.unlock-stage');
    await expect(stage.locator('.unlock-reason')).toHaveText('שלטתם בחצי הראשון של מערכת צירים, ומדי קיבל כובע מצפן.');
    await stage.getByRole('button', { name: 'אחר כך' }).click();
    // the next moment is the streak's (the first lesson of the day)
    await expect(page.locator('.streak-screen')).toBeVisible();
    const st = await saved(page);
    // the lesson completed the stair's practice, a first stage: the first piece for stages came with the chest's cap
    expect(st.look).toMatchObject({ head: null, earned: ['compass-cap', 'party-hat'], seen: ['compass-cap', 'party-hat'] });
  });

  test('5c. a completed unit gives its colour; under reduced motion (the default here) no burst plays and none is loaded', async ({ page }) => {
    const asked = confettiRequests(page);
    const stage = await passCheck(page, '#/lesson/angles/7?kind=check&purpose=mastery', lastStair());
    await expect(stage.locator('.unlock-reason')).toHaveText(COLOUR_REASON);
    await page.waitForTimeout(600);
    await expect(page.locator('canvas.math-burst')).toHaveCount(0);
    expect(asked).toEqual([]);
  });

  test.describe('with motion (PKG-3)', () => {
    test.use({ reducedMotion: 'no-preference' });

    test('5d. a new colour: the maths burst plays from the moment, takes no tap, and goes when the student goes on', async ({ page }) => {
      const stage = await passCheck(page, '#/lesson/angles/7?kind=check&purpose=mastery', lastStair());
      await expect(stage.locator('.unlock-reason')).toHaveText(COLOUR_REASON);
      const burst = page.locator('canvas.math-burst');
      await expect(burst).toHaveCount(1);
      await expect(burst).toHaveAttribute('aria-hidden', 'true');
      expect(await burst.evaluate((el) => { const s = getComputedStyle(el); return [s.position, s.pointerEvents, el.width > 0]; })).toEqual(['fixed', 'none', true]);
      // both buttons are what a finger meets, the canvas over them or not; the first still has the focus
      const keep = stage.getByRole('button', { name: 'לשמור על מדי' });
      await expectUsable(page, keep, 'לשמור על מדי');
      await expectUsable(page, stage.getByRole('button', { name: 'אחר כך' }), 'אחר כך');
      await expect(keep).toBeFocused();
      await burstShots(page, 'unlock-colour');
      await keep.click();
      await expect(page).toHaveURL(/#\/$/);
      await expect(burst).toHaveCount(0); // the moment closed: its canvas went with it
      expect((await saved(page)).look.color).toBe('petrol');
    });

    test('5e. a new accessory gets no burst', async ({ page }) => {
      const asked = confettiRequests(page);
      const stage = await passCheck(page, '#/lesson/angles/3?kind=check&purpose=mastery', student('7', { path: { angles: done([1, 2]) }, sound: true }));
      await expect(stage.locator('.unlock-reason')).toHaveText('שלטתם בחצי הראשון של זוויות, ומדי קיבל כתר מד־זווית.');
      await page.waitForTimeout(600);
      await expect(page.locator('canvas.math-burst')).toHaveCount(0);
      expect(asked).toEqual([]);
    });

    test('5f. with the app\'s sounds off (its quiet mode), a new colour plays no burst and loads nothing', async ({ page }) => {
      const asked = confettiRequests(page);
      const stage = await passCheck(page, '#/lesson/angles/7?kind=check&purpose=mastery', lastStair({ sound: false }));
      await expect(stage.locator('.unlock-reason')).toHaveText(COLOUR_REASON);
      await page.waitForTimeout(600);
      await expect(page.locator('canvas.math-burst')).toHaveCount(0);
      expect(asked).toEqual([]);
    });
  });

  test('the path\'s chests say what they hold, and an open one can be tried on', async ({ page }) => {
    await open(page, '#/', dressed());
    const coord = await openUnit(page, 'מערכת צירים');
    await coord.getByRole('button', { name: /^תיבת אוצר\. נפתחת/ }).click();
    await expect(coord.locator('.node-card')).toContainText('בתיבה: כובע מצפן למדי. היא נפתחת כשתשלטו במדרגות 1 עד 3.');
    await expect(coord.locator('.node-card svg [data-item="compass-cap"]')).toHaveCount(1);
    const angles = await openUnit(page, 'זוויות');
    await angles.getByRole('button', { name: /^תיבת אוצר\. פתוחה/ }).click();
    await expect(angles.locator('.node-card')).toContainText('פתחתם: כתר מד־זווית.');
    await angles.getByRole('button', { name: 'לנסות על מדי' }).click();
    await expect(page).toHaveURL(/#\/me\/madi$/); // the ?try= is used once, then dropped
    const crown = page.getByRole('radiogroup', { name: 'על הראש' }).getByRole('radio', { name: /^כתר מד־זווית/ });
    await expect(crown).toHaveAttribute('aria-checked', 'true');
    await expect(crown).toBeFocused();
    expect((await saved(page)).look.head).toBe('protractor-crown');
  });

  test('a student in a class sees the class scarf coming, until the class reaches its goal', async ({ page }) => {
    await open(page, '#/me/madi', student('7', { profile: { role: 'student', name: 'נועה', grade: '7', classCode: 'ABC123', className: 'ז׳3', teacherName: 'רונית', token: 't', studentId: 's1' } }));
    const row = page.locator('.wardrobe-soon').getByRole('button', { name: /^צעיף הכיתה/ });
    await expect(row).toContainText('כשהכיתה מגיעה למטרה של השבוע');
    await row.click();
    const sheet = page.getByRole('dialog', { name: 'צעיף הכיתה' });
    await expect(sheet).toContainText('נפתח כשהכיתה מגיעה למטרה של השבוע.');
    await expect(sheet.getByRole('button', { name: /^ליחידת/ })).toHaveCount(0);
  });

  test('the wardrobe reads well in dark mode', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await open(page, '#/me/madi', dressed({ color: 'petrol', head: 'protractor-crown', body: 'bars-pin' }));
    await expect(page.locator('.wardrobe-madi g[data-item="bars-pin"]')).toHaveCount(1);
    await expectTextContrast(page, '(wardrobe, dark)');
  });

  test('7. with a server, opening the wardrobe sends one count by name and nothing else (STUDENT-14)', async ({ page }) => {
    const sent = [];
    await page.route('https://api.madregot.test/**', (route) => {
      const r = route.request();
      if (new URL(r.url()).pathname === '/api/metrics') sent.push({ method: r.method(), body: r.postData(), type: r.headers()['content-type'] });
      return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
    });
    // version 3: a saved server address survives (older saves lose it in builds without a personal key)
    await open(page, '#/me/madi', { ...dressed(), version: 3, state: { ...dressed().state, ai: { mode: 'server', apiUrl: 'https://api.madregot.test', key: '' } } });
    await expect(page.locator('.wardrobe-madi')).toBeVisible();
    await expect.poll(() => sent.length).toBeGreaterThan(0);
    // the plain name as text: no id, no page, no answer to wait for
    for (const s of sent) expect(s).toEqual({ method: 'POST', body: 'wardrobe_open', type: expect.stringMatching(/^text\/plain/) });
  });
});

test.describe('on a small phone', () => {
  test.beforeEach(only('phone-small'));

  test('6. no sideways scroll on the profile, the wardrobe and the locked sheet', async ({ page }) => {
    await open(page, '#/me', dressed());
    await expect(page.locator('.profile-avatar svg.mascot')).toBeVisible();
    await expectNoSidewaysScroll(page);
    await page.goto('./#/me/madi');
    await expect(page.locator('.wardrobe-madi')).toBeVisible();
    await expectNoSidewaysScroll(page);
    // every option and every coming piece is a 44px target at least
    for (const box of await page.locator('.wardrobe-opt, .wardrobe-soon-row').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height))) expect(box).toBeGreaterThanOrEqual(44);
    await page.locator('.wardrobe-soon-row').first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expectNoSidewaysScroll(page);
  });

  // (its own test: open() on a page already running the app could have the old state saved back over the new one)
  test('6b. the unlock moment fits: both buttons on screen, no sideways scroll', async ({ page }) => {
    await open(page, '#/lesson/angles/3?kind=check&purpose=mastery', student('7', { path: { angles: done([1, 2]) } }));
    for (let i = 0; i < 5; i += 1) { await expect.poll(() => item(page)).toBeTruthy(); await answer(page, true); await proceed(page); }
    await page.getByRole('button', { name: 'למפה' }).click();
    await expect(page.locator('.unlock-stage')).toBeVisible();
    await expect(page.getByRole('button', { name: 'לשמור על מדי' })).toBeInViewport();
    await expect(page.getByRole('button', { name: 'אחר כך' })).toBeInViewport();
    await expectNoSidewaysScroll(page);
  });
});
