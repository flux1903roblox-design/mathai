// "מדי שלי" (STUDENT-3): what learning unlocks for Madi, what stays earned, and how a piece is described.
import { describe, it, expect, beforeEach } from 'vitest';
import {
  COLORS, ITEMS, SLOTS, MADI_PALETTE, DEFAULT_LOOK, unlockedLook, ownedLook, newUnlocks, unlockedIds, earnIds, emptyLook,
  cleanLook, lockedReason, unlockReason, orderUnlocks, chestItem, wearing, isWorn, TRACK_EVERY,
} from './wardrobe.js';
import { chestAfter } from './path.js';
import { TOPICS, TOPIC } from '@/content/index.js';

/** A path with these stairs of a unit done (mastered). */
const withDone = (topic, levels, path = {}) => ({ ...path, [topic]: { parts: {}, reviews: 0, jumped: 0, done: Object.fromEntries(levels.map((l) => [l, 'mastered'])) } });
const all = (topic) => TOPIC[topic].levels.map((_, i) => i + 1);
const upTo = (n) => Array.from({ length: n }, (_, i) => i + 1);

describe('the wardrobe catalogue', () => {
  it('a fresh student has only the default blue and no items', () => {
    const u = unlockedLook({ path: {}, grade: '7' });
    expect([...u.colors]).toEqual(['sky']);
    expect([...u.items]).toEqual([]);
    expect(newUnlocks(u, [])).toEqual([]);
  });

  it('an open chest (stairs 1 to half done) gives the unit\'s accessory', () => {
    const u = unlockedLook({ path: withDone('angles', upTo(chestAfter('angles'))) });
    expect(u.items.has('protractor-crown')).toBe(true);
    expect(u.colors.has('petrol')).toBe(false); // the unit is not complete yet
    expect(u.why.get('protractor-crown')).toBe('מיחידת זוויות');
  });

  it('the chest opens in order: stairs 1 and 3 done but not 2 give nothing', () => {
    const u = unlockedLook({ path: withDone('angles', [1, 3]) });
    expect(u.items.has('protractor-crown')).toBe(false);
  });

  it('a completed unit gives its family\'s colour (stats: מג׳נטה), and its chest\'s item', () => {
    const u = unlockedLook({ path: withDone('stats', all('stats')), grade: '8' });
    expect(u.colors.has('fuchsia')).toBe(true);
    expect(u.items.has('bars-pin')).toBe(true);
    expect(u.why.get('fuchsia')).toBe('מיחידת סטטיסטיקה');
  });

  it('a completed sky unit gives gold, since the wardrobe\'s sky is the default blue', () => {
    const u = unlockedLook({ path: withDone('signed', all('signed')) });
    expect(u.colors.has('gold')).toBe(true);
    expect(u.colors.has('sky')).toBe(true);
    expect(unlockedIds(u)).toEqual(['gold', 'thermo-scarf']);
    expect(unlockReason('gold', withDone('signed', all('signed')))).toBe('סיימתם את כל המדרגות של מספרים מכוונים. מדי יכול להיות עכשיו זהב.');
  });

  it('a colour is named for the unit that gave it, the student\'s own grade first', () => {
    // petrol: angles (grade 7) and sys (grade 8); a grade 8 student who completed sys
    const u = unlockedLook({ path: withDone('sys', all('sys')), grade: '8' });
    expect(u.why.get('petrol')).toBe('מיחידת משוואות ומערכות');
    // grade 8's first petrol unit is percent now (the curriculum lane's units come before linear functions)
    expect(lockedReason('petrol', '8').text).toBe('נפתח כשתשלטו בכל המדרגות ביחידת אחוזים.');
    expect(lockedReason('petrol', '7').text).toBe('נפתח כשתשלטו בכל המדרגות ביחידת זוויות.');
  });

  it('every unit in TOPICS has exactly one accessory, so a new unit cannot ship without one', () => {
    for (const t of TOPICS) expect(ITEMS.filter((i) => i.topic === t.id).length, t.id).toBe(1);
    for (const t of TOPICS) expect(chestItem(t.id)?.topic, t.id).toBe(t.id);
  });

  it('every item is in one of the four slots, and names a unit that exists (or none: the class scarf, the pieces for stages and the quest chest\'s)', () => {
    for (const i of ITEMS) {
      expect(SLOTS, i.id).toContain(i.slot);
      if (i.topic === null) expect(Object.keys(i.unlock), i.id).toEqual([expect.stringMatching(/^(classGoal|stages|quest)$/)]);
      else expect(TOPIC[i.topic], i.id).toBeTruthy();
    }
    expect(new Set(ITEMS.map((i) => i.id)).size).toBe(ITEMS.length);
  });

  it('every colour has a palette, every unit family has a colour, and the default palette is the tokens\' blue', () => {
    for (const c of COLORS) expect(Object.keys(MADI_PALETTE[c.id])).toEqual(['hi', 'lo', 'edge', 'tread', 'limb']);
    for (const t of TOPICS) expect(COLORS.some((c) => c.unlock?.family === t.color), t.color).toBe(true);
    expect(MADI_PALETTE.sky.lo).toBe('#1a5cf5');
    expect(MADI_PALETTE.violet.lo).toBe('#7048e8');
  });

  it('newUnlocks leaves out what the student was shown', () => {
    const u = unlockedLook({ path: withDone('stats', all('stats')) });
    expect(newUnlocks(u, [])).toEqual(['fuchsia', 'bars-pin']);
    expect(newUnlocks(u, ['fuchsia'])).toEqual(['bars-pin']);
    expect(newUnlocks(u, ['fuchsia', 'bars-pin'])).toEqual([]);
  });

  it('the class scarf comes from a reached class goal the student added to', () => {
    expect(unlockedLook({ classGoals: { '2026-11-01': { reached: true, mine: 0 } } }).items.has('class-scarf')).toBe(false);
    expect(unlockedLook({ classGoals: { '2026-11-01': { reached: false, mine: 6 } } }).items.has('class-scarf')).toBe(false);
    const u = unlockedLook({ classGoals: { '2026-11-01': { reached: true, mine: 6 } } });
    expect(u.items.has('class-scarf')).toBe(true);
    expect(lockedReason('class-scarf').text).toBe('נפתח כשהכיתה מגיעה למטרה של השבוע.');
    expect(lockedReason('class-scarf').topic).toBeNull();
  });

  it('the locked and unlock sentences', () => {
    expect(lockedReason('protractor-crown', '7')).toEqual({ text: `נפתח כשתשלטו במדרגות 1 עד ${chestAfter('angles')} ביחידת זוויות.`, topic: 'angles' });
    expect(unlockReason('protractor-crown')).toBe('שלטתם בחצי הראשון של זוויות, ומדי קיבל כתר מד־זווית.');
    // gold comes with a sky unit: in grade 8 the first one is ratio and scale (grade 7's, signed numbers)
    expect(lockedReason('gold', '8')).toEqual({ text: 'נפתח כשתשלטו בכל המדרגות ביחידת יחס וקנה מידה.', topic: 'ratio' });
    expect(lockedReason('gold', '7')).toEqual({ text: 'נפתח כשתשלטו בכל המדרגות ביחידת מספרים מכוונים.', topic: 'signed' });
  });

  it('the unlock moment leads with the result\'s own unit', () => {
    expect(orderUnlocks(['gold', 'thermo-scarf', 'protractor-crown'], 'angles')).toEqual(['protractor-crown', 'gold', 'thermo-scarf']);
    expect(orderUnlocks(['gold', 'fuchsia', 'bars-pin'], 'stats')).toEqual(['fuchsia', 'bars-pin', 'gold']);
    expect(orderUnlocks(['gold'], null)).toEqual(['gold']);
  });

  it('a saved look is made safe to draw: unknown colours and items in the wrong slot fall back', () => {
    expect(cleanLook(undefined)).toEqual(DEFAULT_LOOK);
    expect(cleanLook({ color: 'neon', head: 'bars-pin', body: 'bars-pin', face: 'nope' })).toEqual({ ...DEFAULT_LOOK, body: 'bars-pin' });
    expect(wearing('x-cap')).toEqual({ head: 'x-cap' });
    expect(wearing('cobalt')).toEqual({ color: 'cobalt' });
    expect(isWorn({ head: 'x-cap' }, 'x-cap')).toBe(true);
    expect(isWorn({ color: 'sky' }, 'cobalt')).toBe(false);
  });
});

describe('earned for good', () => {
  it('earnIds remembers ids with the day, marks them shown unless asked not to, and ignores the default and unknown ids', () => {
    const a = earnIds(emptyLook(), ['protractor-crown', 'sky', 'nope'], '2026-11-05', { seen: false });
    expect(a.earned).toEqual(['protractor-crown']);
    expect(a.seen).toEqual([]);
    expect(a.earnedAt).toEqual({ 'protractor-crown': '2026-11-05' });
    const b = earnIds(a, ['protractor-crown'], '2026-11-08');
    expect(b.seen).toEqual(['protractor-crown']);
    expect(b.earnedAt['protractor-crown']).toBe('2026-11-05'); // the day it was earned, not the day it was shown
    expect(earnIds(b, ['protractor-crown'], '2026-11-09')).toBe(b); // nothing new: the same object
  });

  it('an earned item stays owned after its stair falls back (needs review again)', () => {
    const earned = ['protractor-crown'];
    const fellBack = withDone('angles', [1, 2]);
    expect(unlockedLook({ path: fellBack }).items.has('protractor-crown')).toBe(false);
    const o = ownedLook({ path: fellBack, earned });
    expect(o.items.has('protractor-crown')).toBe(true);
    expect(o.why.get('protractor-crown')).toBe('מיחידת זוויות');
  });
});

describe('the store: look, setLook, markEarned', async () => {
  const { useApp, today } = await import('./store.js');
  beforeEach(() => useApp.setState({ path: {}, look: emptyLook(), profile: { role: 'student', name: 'נועה', grade: '7' }, learn: useApp.getState().learn }));

  it('starts with the default look; an old save without one reads the default (no transform)', () => {
    expect(useApp.getState().look).toEqual({ ...DEFAULT_LOOK, earned: [], seen: [], earnedAt: {}, picks: {} });
  });

  it('setLook saves a choice at once; markEarned marks pieces earned and shown, with the day', () => {
    useApp.getState().setLook({ color: 'violet' });
    useApp.getState().setLook({ head: 'x-cap' });
    expect(useApp.getState().look).toMatchObject({ color: 'violet', head: 'x-cap', face: null });
    useApp.getState().markEarned(['x-cap']);
    expect(useApp.getState().look).toMatchObject({ earned: ['x-cap'], seen: ['x-cap'], earnedAt: { 'x-cap': today() } });
  });

  it('a mastery check remembers what it unlocks, and a kept stair reopened by a failed check takes nothing back', () => {
    // angles 1 to 3 kept from before mastery checks: the chest is open
    useApp.setState({ path: { angles: { parts: {}, reviews: 0, jumped: 0, done: { 1: 'kept', 2: 'kept', 3: 'kept' } } } });
    const failed = useApp.getState().completeCheck({ purpose: 'mastery', skill: 'angles:3', topic: 'angles', level: 3, right: 1, asked: 5, perSkill: {}, passed: false, xp: 0 });
    expect(failed.reopened).toBe(true);
    const st = useApp.getState();
    expect(unlockedLook({ path: st.path }).items.has('protractor-crown')).toBe(false);
    expect(st.look.earned).toEqual(['protractor-crown']);
    expect(st.look.seen).toEqual([]); // not shown yet: the next result shows it
    expect(ownedLook({ path: st.path, earned: st.look.earned }).items.has('protractor-crown')).toBe(true);
  });

  it('a passed check that opens a chest leaves the piece earned and new', () => {
    useApp.setState({ path: withDone('coord', [1, 2]) });
    const out = useApp.getState().completeCheck({ purpose: 'mastery', skill: 'coord:3', topic: 'coord', level: 3, right: 5, asked: 5, perSkill: {}, passed: true, xp: 15 });
    expect(out.chestOpened).toBe(true);
    const { look, path, learn } = useApp.getState();
    // the passed check is also this student's first stage worked (PRODUCT2-36): the first piece for stages comes with it
    expect(look.earned).toEqual(['compass-cap', 'party-hat']);
    expect(look.earnedAt['compass-cap']).toBe(today());
    expect(newUnlocks(ownedLook({ path, earned: look.earned, skills: learn.skills }), look.seen)).toEqual(['compass-cap', 'party-hat']);
  });

  it('resetProgress and signOut put the default look back', () => {
    useApp.getState().setLook({ color: 'gold', neck: 'thermo-scarf' });
    useApp.getState().markEarned(['gold', 'thermo-scarf']);
    useApp.getState().resetProgress();
    expect(useApp.getState().look).toEqual(emptyLook());
    useApp.getState().setLook({ color: 'gold' });
    useApp.getState().signOut();
    expect(useApp.getState().look).toEqual(emptyLook());
  });
});

describe('a piece in the first session, then one every few days (PRODUCT2-36)', async () => {
  const { useApp } = await import('./store.js');
  const { upcoming, leftText, unitLeft } = await import('./rewards.js');
  const { STAGE_MIN } = await import('@/learn/recommend.ts');
  const { stagesWorked } = await import('./path.js');
  beforeEach(() => {
    useApp.getState().resetProgress();
    useApp.setState({ profile: { role: 'student', name: 'נועה', grade: '7' } });
  });
  const ownedNow = () => {
    const { path, learn, look, classGoals } = useApp.getState();
    const o = ownedLook({ path, classGoals, grade: '7', earned: look.earned, skills: learn.skills });
    return { o, ids: new Set([...o.colors, ...o.items]), path, skills: learn.skills, look };
  };

  it('a fresh student earns a piece after the first session: finishing the first teaching stage', () => {
    expect(ownedNow().o.items.size).toBe(0);
    useApp.getState().completeStage('signed:1', 'A');
    const { o, look } = ownedNow();
    // earned for good at once (not shown yet: the stage's end shows it)
    expect(look.earned).toEqual(['party-hat']);
    expect(look.seen).toEqual([]);
    expect(newUnlocks(o, look.seen)).toEqual(['party-hat']);
    expect(o.why.get('party-hat')).toBe('על השלב הראשון');
    expect(unlockReason('party-hat')).toBe('סיימתם את השלב הראשון, ומדי קיבל כובע חגיגה.');
  });

  it('a first practice lesson that completes its practice stage is a first stage too', () => {
    // six right practice answers complete a stair's practice stage (path.js PRACTICE_OK)
    const at = '2026-11-05T10:00:00.000Z';
    useApp.setState({ learn: { ...useApp.getState().learn, skills: { 'coord:1': { attempts: Array.from({ length: 6 }, () => ({ purpose: 'practice', ok: true, at })) } } } });
    useApp.getState().completeLesson({ kind: 'node', topic: 'coord', level: 1, xp: 10, passed: true, bestCombo: 6, perfect: true });
    expect(useApp.getState().look.earned).toEqual(['party-hat']);
  });

  it('the meter: the next piece is TRACK_EVERY stages after the first, and it counts down stage by stage', () => {
    useApp.getState().completeStage('signed:1', 'A');
    let { ids, path, skills } = ownedNow();
    expect(upcoming({ path, skills, grade: '7', owned: ids })[0]).toMatchObject({ id: 'bow-tie', kind: 'stages', left: TRACK_EVERY, of: TRACK_EVERY });
    useApp.getState().completeStage('signed:1', 'B');
    useApp.getState().completeStage('signed:1', 'C');
    ({ ids, path, skills } = ownedNow());
    expect(upcoming({ path, skills, grade: '7', owned: ids })[0]).toMatchObject({ id: 'bow-tie', left: TRACK_EVERY - 2 });
    expect(leftText(TRACK_EVERY - 2)).toBe(`עוד ${TRACK_EVERY - 2} שלבים`);
    expect(leftText(1)).toBe('עוד שלב אחד');
  });

  it('the meter shows the nearest piece: a unit chest two stages away comes before the next piece for stages', () => {
    const half = chestAfter('signed');
    const done = Object.fromEntries(Array.from({ length: half - 1 }, (_, i) => [i + 1, 'mastered']));
    const skills = Object.fromEntries(Array.from({ length: half - 1 }, (_, i) => [`signed:${i + 1}`, { attempts: [], mastered: true }]));
    skills[`signed:${half}`] = { attempts: [], taught: { A: 'x', B: 'x', C: 'x' } };
    const path = { signed: { parts: {}, reviews: 0, jumped: 0, done } };
    const o = ownedLook({ path, skills, grade: '7' });
    const owned = new Set([...o.colors, ...o.items]);
    const worked = stagesWorked(path, skills);
    expect(worked).toBe(half - 1 + 3); // a mastery check is one stage; the three teaching stages are three
    expect(unitLeft('signed', path, skills, half)).toBe(2); // practice and the check of the last stair before the chest
    const next = upcoming({ path, skills, grade: '7', owned });
    expect(next[0]).toMatchObject({ id: 'thermo-scarf', kind: 'chest', topic: 'signed', left: 2, of: half * 5 });
    // and after it, the next piece for stages, then the unit's colour
    expect(next.find((p) => p.kind === 'stages')).toMatchObject({ id: ITEMS.find((i) => i.unlock.stages > worked).id });
    expect(next.find((p) => p.id === 'gold')).toMatchObject({ kind: 'colour', topic: 'signed' });
  });

  it('a stair passed over by a placement needs only its check: one stage', () => {
    const path = { coord: { parts: {}, reviews: 0, jumped: 2, done: {} } };
    expect(unitLeft('coord', path, {}, 2)).toBe(2);
  });

  it('pieces are deterministic: fixed thresholds, the same progress gives the same pieces in the same order, and no draw', async () => {
    const track = ITEMS.filter((i) => i.unlock.stages);
    expect(track.length).toBeGreaterThanOrEqual(8);
    expect(track.map((i) => i.unlock.stages)).toEqual(track.map((_, k) => 1 + k * TRACK_EVERY));
    // stair 1 whole (5 stages), stair 2 taught (3), stair 3 two stages in: 10 stages, the first piece and the next
    const skills = { 'signed:1': { attempts: [], taught: { A: 'x', B: 'x', C: 'x' }, mastered: true }, 'signed:2': { attempts: [], taught: { A: 'x', B: 'x', C: 'x' } }, 'signed:3': { attempts: [], taught: { A: 'x', B: 'x' } } };
    const path = { signed: { parts: { 1: 2 }, reviews: 0, jumped: 0, done: { 1: 'mastered' } } };
    expect(stagesWorked(path, skills)).toBe(10);
    expect(TRACK_EVERY).toBe(9);
    const a = unlockedIds(unlockedLook({ path, skills }));
    expect(unlockedIds(unlockedLook({ path, skills }))).toEqual(a);
    expect(a).toEqual(['party-hat', 'bow-tie']);
    expect(unlockedIds(unlockedLook({ path, skills: { ...skills, 'signed:3': { attempts: [], taught: { A: 'x' } } } }))).toEqual(['party-hat']);
    const o = ownedLook({ path, skills });
    expect(upcoming({ path, skills, owned: new Set([...o.colors, ...o.items]) })).toEqual(upcoming({ path, skills, owned: new Set([...o.colors, ...o.items]) }));
    const { default: wardrobeSrc } = await import('./wardrobe.js?raw');
    const { default: rewardsSrc } = await import('./rewards.js?raw');
    for (const src of [wardrobeSrc, rewardsSrc]) expect(src).not.toMatch(/Math\.random|randomHex|crypto/);
  });

  it('at 10 minutes a day: a piece on the first day, then about one every 2-3 days, never 4 days without one', () => {
    // a student who learns about 10 minutes a day, stage after stage up grade 7's first unit and on (learn/recommend.ts
    // STAGE_MIN: about 20 minutes a stair), starting each stage while the 10 minutes are not up
    const order = ['signed', 'coord', 'angles'].flatMap((t) => TOPIC[t].levels.map((_, i) => [t, i + 1]));
    const skills = {}; const path = {};
    let k = 0; let stage = 0; const STAGES = ['A', 'B', 'C', 'D', 'E'];
    const days = [];
    for (let day = 1; day <= 21; day += 1) {
      let used = 0;
      while (used < 10) {
        const [t, L] = order[k]; const id = `${t}:${L}`; const s = STAGES[stage];
        const rec = skills[id] || { attempts: [] };
        if (s === 'A' || s === 'B' || s === 'C') skills[id] = { ...rec, taught: { ...(rec.taught || {}), [s]: 'x' } };
        if (s === 'D') path[t] = { parts: { ...(path[t]?.parts || {}), [L]: 2 }, reviews: 0, jumped: 0, done: { ...(path[t]?.done || {}) } };
        if (s === 'E') { skills[id] = { ...rec, mastered: true }; path[t] = { ...path[t], done: { ...path[t].done, [L]: 'mastered' } }; }
        used += STAGE_MIN[s];
        stage += 1; if (stage === 5) { stage = 0; k += 1; }
      }
      days.push(unlockedIds(unlockedLook({ path, skills, grade: '7' })).length);
    }
    const got = days.map((n, i) => n - (i ? days[i - 1] : 0));
    expect(got[0]).toBeGreaterThanOrEqual(1);
    const twoWeeks = days[13];
    expect(twoWeeks).toBeGreaterThanOrEqual(5); // 14 days / 3
    expect(twoWeeks).toBeLessThanOrEqual(7); //   14 days / 2
    // no stretch of 4 days in the first three weeks without a new piece
    for (let i = 0; i + 4 <= got.length; i += 1) expect(got.slice(i, i + 4).some((n) => n > 0), `days ${i + 1}-${i + 4}: ${got}`).toBe(true);
  });
});
