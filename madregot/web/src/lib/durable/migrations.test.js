// Saved data from every earlier version reaches v5 sound (DURABLE-1): frozen synthetic saves of v1, v2, v3 and v4, plus
// a heavy year made from a seed (durable/testing.js). Each one validates after migrating, migrating twice changes
// nothing, the XP counter adds up, an unknown field survives, and the v1→v4 steps give exactly what the code before
// this module gave (its migrateState is kept below as the reference).
import { describe, it, expect, vi } from 'vitest';
import { migrate, MIGRATIONS, CURRENT_VERSION, AI_DEFAULTS, BACKUP_DEFAULTS, DURABLE_DEFAULTS } from './migrations.js';
import { validateState } from './validate.js';
import { sumXp, TAG } from './xp.js';
import { deepFreeze, heavyYear } from './testing.js';
import { emptyLearn, migrateLearn, relabelLegacyEvidence } from '@/learn/storeGlue.ts';
import { migratePath } from '../path.js';
import v1 from './fixtures/v1.json';
import v2 from './fixtures/v2.json';
import v3 from './fixtures/v3.json';
import v4 from './fixtures/v4.json';

/** store.js migrateState as it was before this module (5618298), word for word: the reference for the v1→v4 steps. */
function legacyMigrateState(saved, version, { personal = false } = {}) {
  const emptyAi = { mode: 'server', apiUrl: '', key: '', device: '', familyDevice: null, pendingLink: null, lastTier: null };
  let st = saved && typeof saved === 'object' ? { ...saved } : {};
  if (version < 2) st = { ...st, learn: migrateLearn(st.gaps || {}) };
  else st = { ...st, learn: st.learn && typeof st.learn === 'object' ? { ...emptyLearn(), ...st.learn } : emptyLearn() };
  if (version < 3) {
    const { account, ...ai } = st.ai && typeof st.ai === 'object' ? st.ai : {}; // eslint-disable-line no-unused-vars
    st.ai = { ...emptyAi, ...ai };
    if (!personal) st.ai = { ...st.ai, key: '', mode: 'server', apiUrl: '' };
  }
  if (version < 4) {
    const path = st.path && typeof st.path === 'object' ? st.path : {};
    const progress = st.progress && typeof st.progress === 'object' ? st.progress : {};
    st = { ...st, path: migratePath(path, progress, st.learn.skills || {}), learn: relabelLegacyEvidence(st.learn) };
  }
  return st;
}

const clone = (x) => JSON.parse(JSON.stringify(x));
const TAG1 = 'a1b2c3d4';
const fixed = { newTag: () => TAG1 };
const V5_ONLY = ['xpBy', 'resetAt', 'durable', 'backup'];
const withoutV5 = (st) => Object.fromEntries(Object.entries(st).filter(([k]) => !V5_ONLY.includes(k) && k !== 'xp'));

const FIXTURES = { v1, v2, v3, v4, heavy: heavyYear() };
Object.values(FIXTURES).forEach(deepFreeze);

describe('every saved version reaches v5 sound', () => {
  it('the steps are in order and end at the current version', () => {
    expect(MIGRATIONS.map((m) => m.to)).toEqual([2, 3, 4, 5]);
    expect(CURRENT_VERSION).toBe(5);
  });

  for (const [name, f] of Object.entries(FIXTURES)) {
    describe(`${name} (saved at v${f.version})`, () => {
      const once = migrate(f.state, f.version, fixed);

      it('validates after migrating', () => {
        expect(validateState(once)).toEqual([]);
      });
      it('migrating twice changes nothing', () => {
        expect(migrate(once, f.version, fixed)).toEqual(once);
        expect(migrate(clone(once), f.version)).toEqual(once); // a tag made the first time is kept, whatever makes new ones
      });
      it('XP becomes a counter of this device that adds up to the same XP', () => {
        expect(once.xp).toBe(f.state.xp);
        expect(sumXp(once.xpBy)).toBe(once.xp);
        expect(once.xpBy).toEqual(f.state.xp > 0 ? { [TAG1]: f.state.xp } : {});
      });
      it('gets the v5 defaults: no reset, the device tag, the backup off', () => {
        expect(once.resetAt).toBeNull();
        expect(once.durable).toEqual({ ...DURABLE_DEFAULTS, tag: TAG1 });
        expect(once.backup).toEqual(BACKUP_DEFAULTS);
      });
      it('keeps a field it does not know', () => {
        const out = migrate({ ...f.state, zzz: 1, other: { deep: [1, 2] } }, f.version, fixed);
        expect(out.zzz).toBe(1);
        expect(out.other).toEqual({ deep: [1, 2] });
      });
      it('the v1→v4 steps give exactly what the code before them gave', () => {
        expect(withoutV5(once)).toEqual(withoutV5(legacyMigrateState(f.state, f.version, { personal: false })));
      });
      it('never changes the save it was given', () => {
        expect(Object.isFrozen(f.state)).toBe(true); // migrate would have thrown on a write
      });
    });
  }

  it('a new device tag is 8 hex characters, and each migration makes its own', () => {
    const a = migrate(v4.state, 4); const b = migrate(v4.state, 4);
    expect(a.durable.tag).toMatch(TAG);
    expect(a.durable.tag).not.toBe(b.durable.tag);
    expect(a.xpBy).toEqual({ [a.durable.tag]: 85 });
  });
});

describe('what each step keeps', () => {
  it('a v1 save keeps its gaps, and its misconceptions seed the learning model', () => {
    const out = migrate(v1.state, 1, fixed);
    expect(out.gaps).toEqual(v1.state.gaps);
    expect(out.learn.miscon['signed:1|sign']).toBeTruthy();
    expect(out.learn.miscon['coord:2|swap']).toBeUndefined(); // cleared already (3 right)
    expect(out.ai).toEqual({ ...AI_DEFAULTS }); // the old server address is dropped in a build that cannot change it
  });
  it('a v2 save drops the parent account and the personal key, unless the build has one', () => {
    const out = migrate(v2.state, 2, fixed);
    expect(out.ai.account).toBeUndefined();
    expect(out.ai).toMatchObject({ mode: 'server', key: '', apiUrl: '', device: '0123456789abcdef0123456789abcdef' });
    expect(migrate(v2.state, 2, { ...fixed, personal: true }).ai).toMatchObject({ mode: 'personal', key: 'k-fixture-not-a-key', apiUrl: 'https://my-class.example.test' });
    expect(out.exams).toEqual(v2.state.exams);
  });
  it('a v3 save gets path[t].done as the v4 step always gave it, and its number-line evidence relabelled', () => {
    const out = migrate(v3.state, 3, fixed);
    expect(out.path.signed.done).toEqual({ 1: 'kept', 2: 'mastered', 3: 'kept' });
    expect(out.path.coord.done).toEqual({ 1: 'kept' });
    expect(out.path.signed.parts).toEqual({ 1: 2, 2: 2, 3: 2 });
    expect(out.learn.miscon['signed:1|sign']).toBeUndefined();
    expect(Object.keys(out.learn.miscon).sort()).toEqual(['signed:1|direction', 'signed:1|minus-minus']);
    expect(out.outbox).toEqual(v3.state.outbox); // a class student's waiting answers stay
  });
  it('a v4 save keeps its path as it is', () => {
    const out = migrate(v4.state, 4, fixed);
    expect(out.path).toEqual(v4.state.path);
    expect(out.learn).toEqual(v4.state.learn);
  });
});

describe('two builds on one address', () => {
  const v5 = () => clone(migrate(v3.state, 3, fixed));
  it('a stair its check reopened stays open when an older build wrote the save back as v3', () => {
    const st = v5();
    st.path.signed.done = { 2: 'mastered', 3: 'kept' }; // stair 1 was reopened by a missed check
    st.learn.skills['signed:4'] = { attempts: [], mastered: { at: '2026-09-04T10:00:00.000Z', box: 0, due: '2026-09-05T10:00:00.000Z' } };
    const out = migrate(st, 3, fixed);
    expect(out.path.signed.done).toEqual({ 2: 'mastered', 3: 'kept', 4: 'mastered' }); // the new mastery is added, nothing reopened comes back
  });
  it('XP an older build added without the counter is counted on this device', () => {
    const st = { ...v5(), xp: 260, xpBy: { [TAG1]: 150, b2c3d4e5: 60 } };
    const out = migrate(st, 4, fixed);
    expect(out.xpBy).toEqual({ [TAG1]: 200, b2c3d4e5: 60 });
    expect(sumXp(out.xpBy)).toBe(260);
  });
  it('a reset an older build made starts the counter again', () => {
    const out = migrate({ ...v5(), xp: 0, xpBy: { [TAG1]: 210 } }, 4, fixed);
    expect(out.xpBy).toEqual({});
    const after = migrate({ ...v5(), xp: 12, xpBy: { [TAG1]: 210, b2c3d4e5: 5 } }, 4, fixed);
    expect(after.xpBy).toEqual({ [TAG1]: 12 });
  });
  it('a save from a newer version runs no step and keeps every field', () => {
    const st = { ...v5(), zzz: 1, durable: { ...v5().durable, future: true } };
    const out = migrate(st, 9, fixed);
    expect(out).toEqual(st);
  });
});

describe('broken saves', () => {
  it('nothing, or not an object, starts from the defaults and still validates', () => {
    for (const bad of [null, undefined, 'x', 42, []]) {
      const out = migrate(bad, 1, fixed);
      expect(validateState(out)).toEqual([]);
      expect(out.xp).toBe(0);
      expect(out.xpBy).toEqual({});
    }
  });
  it('XP that is not a number becomes 0', () => {
    expect(migrate({ xp: 'many' }, 4, fixed)).toMatchObject({ xp: 0, xpBy: {} });
    expect(migrate({ xp: -5 }, 4, fixed)).toMatchObject({ xp: 0, xpBy: {} });
  });
  it('a development build says what is wrong after a migration, and still returns the data', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const out = migrate({ xp: 5, days: { yesterday: { q: 1 } } }, 4, fixed);
    expect(out.days.yesterday).toEqual({ q: 1 });
    expect(err).toHaveBeenCalledTimes(1);
    expect(err.mock.calls[0][0]).toContain('days.yesterday: the key is not a date');
    err.mockRestore();
  });
});

describe('validateState', () => {
  const sound = () => clone(migrate(v4.state, 4, fixed));
  it('a sound state has no problems', () => { expect(validateState(sound())).toEqual([]); });
  it('names a wrong type', () => {
    expect(validateState({ ...sound(), days: [] })).toContain('days: array, expected object');
    expect(validateState({ ...sound(), sound: 'yes' })).toContain('sound: string, expected boolean');
    expect(validateState({ ...sound(), learn: { ...sound().learn, events: {} } })).toContain('learn.events: object, expected array');
    expect(validateState(null)).toEqual(['state: not an object']);
  });
  it('XP must be the sum of its counter', () => {
    expect(validateState({ ...sound(), xp: 90 })).toContain('xpBy: adds up to 85, but xp is 90');
    expect(validateState({ ...sound(), xpBy: { [TAG1]: -1 }, xp: -1 })).toEqual(expect.arrayContaining(['xp: negative', `xpBy.${TAG1}: -1, expected a number 0 or more`]));
    const { xpBy, ...noCounter } = sound(); // eslint-disable-line no-unused-vars
    expect(validateState(noCounter)).toContain('xpBy: missing');
  });
  it('day keys are dates', () => {
    expect(validateState({ ...sound(), days: { '2026-11-5': { q: 1 } } })).toContain('days.2026-11-5: the key is not a date (YYYY-MM-DD)');
  });
  it('finds a number that is not finite, wherever it is', () => {
    const st = sound(); st.days['2026-11-04'].secs = NaN; st.learn.skills['pyth:3'].mastered.box = Infinity;
    expect(validateState(st)).toEqual(['days.2026-11-04.secs: not a finite number', 'learn.skills.pyth:3.mastered.box: not a finite number']);
  });
  it('a device tag is 8 hex characters', () => {
    expect(validateState({ ...sound(), durable: { ...sound().durable, tag: 'phone' } })).toContain('durable.tag: "phone", expected 8 hex characters or null');
  });
});
