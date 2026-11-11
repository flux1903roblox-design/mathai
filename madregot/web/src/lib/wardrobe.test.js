// "מדי שלי" (STUDENT-3): what learning unlocks for Madi, what stays earned, and how a piece is described.
import { describe, it, expect, beforeEach } from 'vitest';
import {
  COLORS, ITEMS, SLOTS, MADI_PALETTE, DEFAULT_LOOK, unlockedLook, ownedLook, newUnlocks, unlockedIds, earnIds, emptyLook,
  cleanLook, lockedReason, unlockReason, orderUnlocks, chestItem, wearing, isWorn,
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

  it('a completed sky unit gives gold, since the default is already that blue', () => {
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

  it('every item is in one of the four slots, and names a unit that exists (or none, for the class scarf)', () => {
    for (const i of ITEMS) {
      expect(SLOTS, i.id).toContain(i.slot);
      if (i.topic === null) expect(i.unlock).toEqual({ classGoal: true });
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
    expect(useApp.getState().look).toEqual({ ...DEFAULT_LOOK, earned: [], seen: [], earnedAt: {} });
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
    const { look, path } = useApp.getState();
    expect(look.earned).toEqual(['compass-cap']);
    expect(look.earnedAt['compass-cap']).toBe(today());
    expect(newUnlocks(ownedLook({ path, earned: look.earned }), look.seen)).toEqual(['compass-cap']);
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
