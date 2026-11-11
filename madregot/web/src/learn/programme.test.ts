// The programme map against the stairs this build really has. The coverage numbers themselves are not asserted here:
// they move with every content stage (the fixtures in worker/test/coverage.test.js carry the numbers).
import { describe, expect, it } from 'vitest';
import { ALL_SKILLS, ALSO_ON_PATH, GRADE_OF, parseSkill } from './skills';
import type { AlsoOnPath } from './skills';
import { PROGRAMME, ROADMAP_NEXT, coverageOf, notYetOf, monthIndex, schoolMonth } from './programme';
import { TOPIC, TOPICS } from '@/content/index.js';

// a bridge topic (CURRICULUM-3's frac) carries bridge: true
const isBridge = (skill: string) => (TOPIC as Record<string, { bridge?: boolean } | undefined>)[parseSkill(skill).topic]?.bridge === true;
const programmeStairs = new Set<string>(PROGRAMME.units.flatMap((u) => u.parts.flatMap((p) => p.skills)));

describe('every stair of the app has a place in the Ministry programme', () => {
  const stairs = ALL_SKILLS.filter((s) => !isBridge(s));
  it('is listed in some unit (a new stair cannot land without being placed in the programme)', () => {
    expect(stairs.length).toBeGreaterThan(0);
    stairs.forEach((s) => expect(programmeStairs.has(s), `${s} is in no unit of shared/programme.js`).toBe(true));
  });
  it('has a school month in its own grade', () => {
    stairs.forEach((s) => {
      const m = monthIndex(s, GRADE_OF[parseSkill(s).topic]!);
      expect(typeof m, `${s} has no month in grade ${GRADE_OF[parseSkill(s).topic]}`).toBe('number');
      expect(m).toBeGreaterThanOrEqual(0);
      expect(m).toBeLessThanOrEqual(9);
    });
  });
  it('a bridge stair (elementary fractions) is in no unit: it adds no hours', () => {
    [...programmeStairs].forEach((s) => expect(s.startsWith('frac:'), s).toBe(false));
    ALL_SKILLS.filter(isBridge).forEach((s) => expect(programmeStairs.has(s), s).toBe(false));
  });
});

// A unit also drawn on another grade's path (skills.ts ALSO_ON_PATH) is there because that grade's schedule teaches it
// this year: some unit of that grade lists one of its stairs. When the programme moves to the next year and the unit is
// no longer in that grade's schedule, this fails, and the entry is removed.
describe('a unit on two grades\' paths is in that grade\'s schedule', () => {
  const unlisted = (also: AlsoOnPath) => Object.entries(also).filter(([t, e]) => !PROGRAMME.units.some((u) => u.grade === e!.grade
    && u.parts.some((p) => p.skills.some((s) => parseSkill(s).topic === t)))).map(([t]) => t);
  it('every entry of ALSO_ON_PATH is listed in a unit of its other grade', () => {
    expect(Object.keys(ALSO_ON_PATH)).toEqual(['data']); // not vacuous: this year's entry
    expect(unlisted(ALSO_ON_PATH)).toEqual([]);
    // 8.6 lists data:1-3 (October–November), 8.16 data:4 (March, "הסתברות א – בסיס")
    expect(monthIndex('data:1', '8')).toBe(1);
    expect(monthIndex('data:3', '8')).toBe(1);
    expect(monthIndex('data:4', '8')).toBe(6);
    expect(monthIndex('data:1', '7')).toBe(4);
  });
  it('the rule bites: expressions are in no ח׳ unit, Pythagoras is in ז׳ 7.6 and 7.14', () => {
    expect(unlisted({ expr: { grade: '8', after: 'pct' } })).toEqual(['expr']);
    expect(unlisted({ pyth: { grade: '7', after: 'eq' } })).toEqual([]);
  });
});

// Stage 1 is complete with percent, and curriculum stage 3's data unit has landed: the live coverage, from the stairs
// this build has, is worker/test/coverage.test.js's stage-1 fixture (HEAD's 48 stairs, signed:6, ratio:1-4, pct:1-5)
// with data:1-4 (7.15-7.17 taught, and this year 8.6 and the first half of 8.16): ז׳ 117 of 150, ח׳ 75 of 147, 65%.
describe('stage 1\'s coverage, the data unit, stats:6-8 and probability, live', () => {
  const STAGE1 = [
    ...['signed', 'coord', 'angles', 'expr', 'eq', 'pyth', 'stats', 'sys'].flatMap((t) => Array.from({ length: 5 }, (_, i) => `${t}:${i + 1}`)),
    ...Array.from({ length: 8 }, (_, i) => `line:${i + 1}`),
    'signed:6', 'ratio:1', 'ratio:2', 'ratio:3', 'ratio:4', 'pct:1', 'pct:2', 'pct:3', 'pct:4', 'pct:5',
  ];
  const DATA = ['data:1', 'data:2', 'data:3', 'data:4'];
  // curriculum stage 3, DATA-5: the rest of ח׳ units 8.10 (range, two sources) and 8.11 (interpolation)
  const STATS2 = ['stats:6', 'stats:7', 'stats:8'];
  // DATA-6: "הסתברות ב", the rest of 8.16
  const PROB = ['prob:1', 'prob:2', 'prob:3'];
  it('has exactly the stage-1 stairs, data:1-4, stats:6-8 and prob:1-3 (the bridge unit aside), and their hours', () => {
    expect([...ALL_SKILLS.filter((s) => !isBridge(s))].sort()).toEqual([...STAGE1, ...DATA, ...STATS2, ...PROB].sort());
    const c7 = coverageOf('7'); const c8 = coverageOf('8');
    expect([c7.taught, c7.hours]).toEqual([117, 150]);
    expect([c8.taught, c8.hours]).toEqual([87, 147]);
    expect(Math.round((100 * (c7.taught + c8.taught)) / (c7.hours + c8.hours))).toBe(69);
    expect(c8.units.find((u) => u.id === '8.10')).toMatchObject({ taught: 12, state: 'yes' });
    expect(c8.units.find((u) => u.id === '8.11')).toMatchObject({ taught: 4, state: 'yes' });
    expect(c8.units.find((u) => u.id === '8.6')).toMatchObject({ taught: 8, state: 'yes' });
    expect(c8.units.find((u) => u.id === '8.16')).toMatchObject({ taught: 6, state: 'yes' });
    expect(c8.units.find((u) => u.id === '8.2')).toMatchObject({ taught: 7, state: 'yes' });
    for (const id of ['7.15', '7.16', '7.17']) expect(c7.units.find((u) => u.id === id), id).toMatchObject({ state: 'yes' });
  });
});

describe('coverage, bound to the stairs this build has', () => {
  it('counts every hour of both schedules, and only taught hours as taught', () => {
    const c7 = coverageOf('7'); const c8 = coverageOf('8');
    expect([c7.hours, c8.hours]).toEqual([150, 147]);
    for (const c of [c7, c8]) {
      expect(c.taught).toBeGreaterThan(0);
      expect(c.taught).toBeLessThanOrEqual(c.hours);
      expect(c.pct).toBe(Math.round((100 * c.taught) / c.hours));
      expect(c.taught).toBe(c.units.reduce((a, u) => a + u.taught, 0));
      c.units.forEach((u) => {
        expect(u.state).toBe(u.taught === u.hours ? 'yes' : u.taught === 0 ? 'no' : 'part');
        u.stairs.forEach((s) => expect(ALL_SKILLS).toContain(s)); // only stairs that exist become links
        expect(u.missing.length > 0).toBe(u.state !== 'yes');
      });
    }
  });
  it('a missing part promises a stage only when it names one, and the next stage is a real one', () => {
    expect(['S2', 'S3', 'S4', 'S5']).toContain(ROADMAP_NEXT);
    for (const g of ['7', '8'] as const) {
      coverageOf(g).units.flatMap((u) => u.parts).filter((p) => !p.taught).forEach((p) => {
        // a part whose stairs are listed but not built yet promises nothing; an empty part names its stage
        if (p.skills.length) expect(p.later).toBeNull(); else expect(['S2', 'S3', 'S4', 'S5']).toContain(p.later);
      });
    }
  });
});

describe('the "not yet" list (AI-5\'s rules, checked here until shared/stairs.js exists)', () => {
  const titles = new Set<string>(TOPICS.flatMap((t) => [t.title, ...t.levels.map((l) => l.title)]));
  it('has the keys 7 and 8, each a list of non-empty strings without repeats', () => {
    const NOT_YET = { '7': notYetOf('7'), '8': notYetOf('8') };
    expect(Object.keys(NOT_YET)).toEqual(['7', '8']);
    Object.values(NOT_YET).forEach((list) => {
      expect(list.length).toBeGreaterThan(0);
      list.forEach((s) => expect(typeof s === 'string' && s.trim().length > 0).toBe(true));
      expect(new Set(list).size).toBe(list.length);
    });
  });
  it('never names a topic or a stair the app teaches', () => {
    expect(titles.size).toBeGreaterThan(ALL_SKILLS.length / 2);
    [...notYetOf('7'), ...notYetOf('8')].forEach((s) => expect(titles.has(s), `"${s}" is both taught and not yet`).toBe(false));
  });
});

describe('the school calendar', () => {
  it('places a date in the school year: September 0 … June 9, the summer as June', () => {
    expect(schoolMonth('2026-11-10')).toBe(2);
    expect(schoolMonth('2027-07-15')).toBe(9);
    expect(schoolMonth('2026-09-01')).toBe(0);
    expect(schoolMonth('2027-06-01')).toBe(9);
  });
});
