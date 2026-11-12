// The programme map against the stairs this build really has. The coverage numbers themselves are not asserted here:
// they move with every content stage (the fixtures in worker/test/coverage.test.js carry the numbers).
import { describe, expect, it } from 'vitest';
import { ALL_SKILLS, GRADE_OF, parseSkill } from './skills';
import { PROGRAMME, ROADMAP_NEXT, coverageOf, notYetOf, monthIndex, schoolMonth } from './programme';
import { coverage } from '@shared/coverage.js';
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

// Stage 1 is complete with percent: the stage-1 fixture of worker/test/coverage.test.js (HEAD's 48 stairs, signed:6,
// ratio:1-4 and pct:1-5) gives ז׳ 104 of 150 and ח׳ 66 of 147, 57%. The app has those stairs and may have more: a later
// stage adds its own (stage5.md FUNC-8 Design 3), so the live numbers are those of coverage() over the live stairs.
describe('stage 1\'s coverage, live', () => {
  const STAGE1 = [
    ...['signed', 'coord', 'angles', 'expr', 'eq', 'pyth', 'stats', 'sys'].flatMap((t) => Array.from({ length: 5 }, (_, i) => `${t}:${i + 1}`)),
    ...Array.from({ length: 8 }, (_, i) => `line:${i + 1}`),
    'signed:6', 'ratio:1', 'ratio:2', 'ratio:3', 'ratio:4', 'pct:1', 'pct:2', 'pct:3', 'pct:4', 'pct:5',
  ];
  // the stairs the content really has: every level of every unit (the bridge unit aside)
  const LIVE = TOPICS.filter((t) => !(t as { bridge?: boolean }).bridge).flatMap((t) => t.levels.map((_: unknown, i: number) => `${t.id}:${i + 1}`));
  it('has every stage-1 stair (the bridge unit aside), and stage 1\'s hours', () => {
    const have = new Set(ALL_SKILLS.filter((s) => !isBridge(s)));
    STAGE1.forEach((s) => expect(have.has(s), `${s} is gone`).toBe(true));
    const s7 = coverage('7', STAGE1); const s8 = coverage('8', STAGE1);
    expect([s7.taught, s7.hours]).toEqual([104, 150]);
    expect([s8.taught, s8.hours]).toEqual([66, 147]);
    expect(Math.round((100 * (s7.taught + s8.taught)) / (s7.hours + s8.hours))).toBe(57);
    expect(s8.units.find((u) => u.id === '8.2')).toMatchObject({ taught: 7, state: 'yes' });
  });
  it('the live coverage is coverage() of the stairs the content has, and never below stage 1\'s', () => {
    expect([...LIVE].sort()).toEqual(ALL_SKILLS.filter((s) => !isBridge(s)).sort());
    for (const g of ['7', '8'] as const) {
      expect(coverageOf(g)).toEqual(coverage(g, LIVE));
      expect(coverageOf(g).taught).toBeGreaterThanOrEqual(coverage(g, STAGE1).taught);
    }
  });
});

// Stage 5 (stage5.md FUNC-8 Design 3): the functions unit is whole. 8.7 lists func:1-3 (November, 8 hours); func:4 is
// a 0-hour part of 8.8, the schedule's December row "קצב שינוי אחיד/לא אחיד", whose hours are line's.
describe('stage 5\'s functions unit, live', () => {
  it('8.7 and 8.8 are taught whole, with no missing part', () => {
    const c8 = coverageOf('8');
    expect(c8.units.find((u) => u.id === '8.7')).toMatchObject({ hours: 8, taught: 8, state: 'yes', missing: [], stairs: ['func:1', 'func:2', 'func:3'] });
    const u88 = c8.units.find((u) => u.id === '8.8')!;
    expect(u88).toMatchObject({ hours: 8, taught: 8, state: 'yes', missing: [] });
    expect(u88.stairs).toContain('func:4');
    expect(u88.parts.find((p) => p.skills.includes('func:4'))).toMatchObject({ hours: 0, taught: true, note: 'קצב שינוי אחיד ולא אחיד' });
  });
  it('places each func stair in its school month: func:1 in ז׳ May and ח׳ November, func:2-4 in ח׳ November', () => {
    expect([monthIndex('func:1', '7'), monthIndex('func:1', '8')]).toEqual([8, 2]);
    for (const s of ['func:2', 'func:3', 'func:4']) expect(monthIndex(s, '8'), s).toBe(2);
  });
});

// Stage 5 (stage5.md FUNC-8 Design 1): the motion problems (eq:6) and equations with denominators (eq:7) are ח׳ 8.9's,
// and a ז׳ class meets them in June, the schedule's motion task: 7.8 lists them in a 0-hour part with its own months, so
// ז׳ is not told they are taught in March, and no ז׳ hour moves; 8.9's six hours are theirs.
describe('stage 5\'s motion problems and equations with denominators, live', () => {
  it('7.8 lists eq:6 and eq:7 in a 0-hour part of its own month, and stays whole', () => {
    const u78 = coverageOf('7').units.find((u) => u.id === '7.8')!;
    expect(u78).toMatchObject({ hours: 21, taught: 21, state: 'yes', missing: [] });
    expect(u78.stairs).toEqual(expect.arrayContaining(['eq:6', 'eq:7']));
    expect(u78.parts.find((p) => p.skills.includes('eq:6'))).toMatchObject({ hours: 0, skills: ['eq:6', 'eq:7'], taught: true, note: 'שאלות תנועה ומשוואות עם מכנים' });
    expect((PROGRAMME.units.find((u) => u.id === '7.8')!.parts.find((p) => p.skills.includes('eq:6')) as { months?: number[] }).months).toEqual([6]);
  });
  it('8.9 is taught whole: its six hours of motion, x in a denominator and proportion are eq:6 and eq:7\'s', () => {
    const u89 = coverageOf('8').units.find((u) => u.id === '8.9')!;
    expect(u89).toMatchObject({ hours: 12, taught: 12, state: 'yes', missing: [] });
    expect(u89.parts.find((p) => p.skills.includes('eq:7'))).toMatchObject({ hours: 6, skills: ['eq:6', 'eq:7'], taught: true, later: null });
  });
  it('places eq:6 and eq:7 in June for ז׳ and December for ח׳, and leaves eq:1-5 in March', () => {
    expect([monthIndex('eq:6', '7'), monthIndex('eq:7', '7')]).toEqual([9, 9]);
    expect([monthIndex('eq:6', '8'), monthIndex('eq:7', '8')]).toEqual([3, 3]);
    for (let k = 1; k <= 5; k += 1) expect(monthIndex(`eq:${k}`, '7'), `eq:${k}`).toBe(6);
  });
});

// Stage 5 as a whole (stage5.md FUNC-8 Design 3 and §0.3), before the classroom split: its six stairs are in the app,
// every ח׳ unit it completes is taught whole, and the one part left with `later: 'S5'` is 7.10's measuring part, which
// waits for the classroom lane's angles:6-7 and this stage's angles:8 (STAIRS.angles is a count).
describe('stage 5, before the classroom split', () => {
  const S5 = ['func:1', 'func:2', 'func:3', 'func:4', 'eq:6', 'eq:7'];
  it('has its six stairs, each in the programme', () => {
    S5.forEach((s) => expect(ALL_SKILLS, s).toContain(s));
    S5.forEach((s) => expect(programmeStairs.has(s), s).toBe(true));
  });
  it('8.7, 8.8 and 8.9 are taught whole', () => {
    const units = coverageOf('8').units;
    for (const id of ['8.7', '8.8', '8.9']) expect(units.find((u) => u.id === id), id).toMatchObject({ state: 'yes', missing: [] });
    expect(['8.7', '8.8', '8.9'].map((id) => units.find((u) => u.id === id)!.taught)).toEqual([8, 8, 12]);
    expect(coverageOf('7').units.find((u) => u.id === '7.9')).toMatchObject({ hours: 3, taught: 3, state: 'yes' });
  });
  it('places every stage-5 stair in its school month', () => {
    expect([monthIndex('func:1', '7'), monthIndex('func:1', '8')]).toEqual([8, 2]);
    for (const s of ['func:2', 'func:3', 'func:4']) expect(monthIndex(s, '8'), s).toBe(2);
    for (const s of ['eq:6', 'eq:7']) expect([monthIndex(s, '7'), monthIndex(s, '8')], s).toEqual([9, 3]);
    for (let k = 1; k <= 5; k += 1) expect(monthIndex(`eq:${k}`, '7'), `eq:${k}`).toBe(6);
  });
  it('leaves one part waiting for stage 5: 7.10\'s, for the classroom split', () => {
    const waiting = PROGRAMME.units.flatMap((u) => u.parts.filter((p) => (p as { later?: string }).later === 'S5').map((p) => ({ id: u.id, skills: p.skills })));
    expect(waiting).toEqual([{ id: '7.10', skills: [] }]);
    expect(PROGRAMME.units.flatMap((u) => u.parts.flatMap((p) => p.skills))).not.toContain('angles:8');
  });
  it('gives the "stage 5 before classroom" numbers on stage 1\'s stairs and its own: ז׳ 106/150, ח׳ 80/147, 63%', () => {
    const STAGE1 = [
      ...['signed', 'coord', 'angles', 'expr', 'eq', 'pyth', 'stats', 'sys'].flatMap((t) => Array.from({ length: 5 }, (_, i) => `${t}:${i + 1}`)),
      ...Array.from({ length: 8 }, (_, i) => `line:${i + 1}`),
      'signed:6', 'ratio:1', 'ratio:2', 'ratio:3', 'ratio:4', 'pct:1', 'pct:2', 'pct:3', 'pct:4', 'pct:5',
    ];
    const c7 = coverage('7', [...STAGE1, ...S5]); const c8 = coverage('8', [...STAGE1, ...S5]);
    expect([c7.taught, c7.pct, c8.taught, c8.pct]).toEqual([106, 71, 80, 54]);
    expect(Math.round((100 * (c7.taught + c8.taught)) / (c7.hours + c8.hours))).toBe(63);
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
