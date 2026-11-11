// The programme map against the stairs this build really has. The coverage numbers themselves are not asserted here:
// they move with every content stage (the fixtures in worker/test/coverage.test.js carry the numbers).
import { describe, expect, it } from 'vitest';
import { ALL_SKILLS, GRADE_OF, parseSkill } from './skills';
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
      const m = monthIndex(s, GRADE_OF[parseSkill(s).topic]);
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

// Stage 1 is complete with percent, and stage 2 adds its topics one at a time: the live coverage, from the stairs this
// build has, is the stage-1 fixture of worker/test/coverage.test.js (HEAD's 48 stairs, signed:6, ratio:1-4 and pct:1-5)
// with stage 2's areas and perimeters (area:1-5, ז׳ 7.12 whole) and boxes and prisms (solid:1-4, ז׳ 7.13 whole): ז׳ 122 of
// 150, ח׳ 66 of 147, 63%.
describe('stage 2\'s coverage, live', () => {
  const STAGE1 = [
    ...['signed', 'coord', 'angles', 'expr', 'eq', 'pyth', 'stats', 'sys'].flatMap((t) => Array.from({ length: 5 }, (_, i) => `${t}:${i + 1}`)),
    ...Array.from({ length: 8 }, (_, i) => `line:${i + 1}`),
    'signed:6', 'ratio:1', 'ratio:2', 'ratio:3', 'ratio:4', 'pct:1', 'pct:2', 'pct:3', 'pct:4', 'pct:5',
  ];
  const STAGE2 = [...STAGE1, 'area:1', 'area:2', 'area:3', 'area:4', 'area:5', 'solid:1', 'solid:2', 'solid:3', 'solid:4'];
  it('has exactly the stage-1 stairs and stage 2\'s landed ones (the bridge unit aside), and their hours', () => {
    expect([...ALL_SKILLS.filter((s) => !isBridge(s))].sort()).toEqual([...STAGE2].sort());
    const c7 = coverageOf('7'); const c8 = coverageOf('8');
    expect([c7.taught, c7.hours]).toEqual([122, 150]);
    expect([c8.taught, c8.hours]).toEqual([66, 147]);
    expect(Math.round((100 * (c7.taught + c8.taught)) / (c7.hours + c8.hours))).toBe(63);
    expect(c8.units.find((u) => u.id === '8.2')).toMatchObject({ taught: 7, state: 'yes' });
    expect(c7.units.find((u) => u.id === '7.12')).toMatchObject({ taught: 10, state: 'yes' });
    expect(c7.units.find((u) => u.id === '7.13')).toMatchObject({ taught: 9, state: 'yes' });
  });
  it('reads each area and solid stair in its own months (MEASURE-6.1): December, January, April, May', () => {
    expect(['area:1', 'area:2', 'area:3', 'area:4', 'area:5'].map((s) => monthIndex(s, '7'))).toEqual([3, 3, 4, 7, 8]);
    // the box in January, the prism in May
    expect(['solid:1', 'solid:2', 'solid:3', 'solid:4'].map((s) => monthIndex(s, '7'))).toEqual([4, 4, 8, 8]);
    // a stair with no months of its own keeps its unit's: Pythagoras is March in ז׳ (7.14) and September in ח׳ (8.3)
    expect(monthIndex('pyth:1', '7')).toBe(3);
    expect(monthIndex('pyth:1', '8')).toBe(0);
    expect(monthIndex('coord:4', '7')).toBe(1);
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
