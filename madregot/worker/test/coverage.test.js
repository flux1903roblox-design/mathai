// The Ministry programme in code (shared/programme.js) and the coverage computed from it (shared/coverage.js).
// The fixtures are skill lists typed here, so these numbers do not move when a stage lands: the council's 33 stairs,
// HEAD's 48 (after the algebra build), stage 1's (HEAD plus signed:6, ratio:1-4 and pct:1-5), stage 2's (stage 1's plus
// the measurement stairs area:1-5, solid:1-4, circle:1-4 and space:1-2), curriculum stage 3's (stage 1 plus data:1-4,
// stats:6-8 and prob:1-3), stage 5's before the classroom split (stage 1 plus func:1-4, eq:6 and eq:7), the classroom
// lane's (stage 1 plus signed:7, powers, CLASSROOM-5, and angles:6 and angles:7, the bisector and the quadrilateral,
// CLASSROOM-10 and -12), stage 2 with the classroom lane's three stairs, which is all of S2, and curriculum stage 4's
// (stage 1 with the transformations, transf:1-4, GEOM-4: units 7.11 and 8.5; then its congruence, congr:1-5, GEOM-5:
// 8.12; and its isosceles triangles and similarity, sim:1-4, GEOM-6: 8.13's second part). The hours and the
// per-unit taught hours are those of the Ministry's תשפ״ז schedules, as the curriculum spec (§0.3) and the stage-5
// spec (§0.3) checked them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PROGRAMME, ROADMAP_NEXT } from '../../shared/programme.js';
import { coverage, notYet, monthIndex, schoolMonth, coverageSentence, monthsText, hoursText, inSchoolOrder, GRADE_NAME } from '../../shared/coverage.js';
import { STAIR_NAMES } from '../../shared/stairs.js';

const COUNCIL = [
  'signed:1', 'signed:2', 'signed:3', 'signed:4', 'signed:5',
  'coord:1', 'coord:2', 'coord:3', 'coord:4', 'coord:5',
  'angles:1', 'angles:2', 'angles:3', 'angles:4', 'angles:5',
  'line:1', 'line:2', 'line:3', 'line:4', 'line:5', 'line:6', 'line:7', 'line:8',
  'pyth:1', 'pyth:2', 'pyth:3', 'pyth:4', 'pyth:5',
  'stats:1', 'stats:2', 'stats:3', 'stats:4', 'stats:5',
];
const HEAD = [
  ...COUNCIL,
  'expr:1', 'expr:2', 'expr:3', 'expr:4', 'expr:5',
  'eq:1', 'eq:2', 'eq:3', 'eq:4', 'eq:5',
  'sys:1', 'sys:2', 'sys:3', 'sys:4', 'sys:5',
];
const STAGE1 = [
  ...HEAD,
  'signed:6',
  'ratio:1', 'ratio:2', 'ratio:3', 'ratio:4',
  'pct:1', 'pct:2', 'pct:3', 'pct:4', 'pct:5',
];
// Stage 5 before the classroom split (stage5.md §0.3, "stage 5 before classroom"): the functions unit and the motion and
// denominator stairs, without angles:8, which cannot exist before the classroom lane's angles:6-7 (STAIRS.angles is a
// count). The classroom-inclusive fixture (ז׳ 114, 7.10 at 20 hours) lands with angles:8.
const S5_BEFORE_CLASSROOM = [...STAGE1, 'func:1', 'func:2', 'func:3', 'func:4', 'eq:6', 'eq:7'];
// the classroom lane (finish/specs/classroom.md): signed:7 makes 7.6 whole, 104 + 4 = 108 hours of ז׳; angles:6 and angles:7
// teach 7.10's two hours of the bisector and the quadrilateral, 110 (measuring stays S5's, for angles:8)
const CLASSROOM = [...STAGE1, 'signed:7', 'angles:6', 'angles:7'];
// curriculum stage 4 (finish/specs/stage4.md): the transformations teach 7.11 and, this year, 8.5 (5 hours each)
const TRANSF = ['transf:1', 'transf:2', 'transf:3', 'transf:4'];
const STAGE4 = [...STAGE1, ...TRANSF];
// congruence (GEOM-5): 8.12 lists congr:1-5; the lane's stage 6 built congr:1-4, when the part (16 hours) was not taught
// yet and the coverage stayed stage 4's; its stage 7 adds congr:5, and 8.12 is whole
const CONGR = ['congr:1', 'congr:2', 'congr:3', 'congr:4', 'congr:5'];
const STAGE6 = [...STAGE4, ...CONGR.slice(0, 4)];
const STAGE7 = [...STAGE4, ...CONGR];
// isosceles triangles and similarity (GEOM-6): 8.13's second part (13 hours) lists sim:1-4, the lane's stage 8; with it
// no part waits for S4 any more
const SIM = ['sim:1', 'sim:2', 'sim:3', 'sim:4'];
const STAGE8 = [...STAGE7, ...SIM];
const BRIDGE = ['frac:1', 'frac:2', 'frac:3', 'frac:4'];
// Curriculum stage 3 (data and probability): its ten stairs, all listed by the programme now (7.15-7.17, 8.6 and the
// first half of 8.16 list data:1-4; 8.10 and 8.11 list stats:6-8; the rest of 8.16 lists prob:1-3).
const STAGE3 = [
  'data:1', 'data:2', 'data:3', 'data:4',
  'stats:6', 'stats:7', 'stats:8',
  'prob:1', 'prob:2', 'prob:3',
];
// Stage 2 (measurement, stage2.md): the 15 stairs it adds, all listed by the programme now (7.12, 7.13, 8.4, 8.17).
const STAGE2_STAIRS = [
  'area:1', 'area:2', 'area:3', 'area:4', 'area:5',
  'solid:1', 'solid:2', 'solid:3', 'solid:4',
  'circle:1', 'circle:2', 'circle:3', 'circle:4',
  'space:1', 'space:2',
];
const STAGE2 = [...STAGE1, ...STAGE2_STAIRS];
// stage 2 with the classroom lane's three stairs (QA_MEASURE.md section 8): signed:7 teaches 7.6's four hours of powers,
// the last of S2, and angles:6-7 two of 7.10's four hours: ז׳ 128 of 150, ח׳ 78 of 147
const STAGE2_CLASSROOM = [...STAGE2, 'signed:7', 'angles:6', 'angles:7'];

// The schedules' hours per unit (7.1-7.17, 8.1-8.17) and the hours each milestone teaches, unit by unit.
const HOURS = {
  '7': [5, 5, 7, 5, 8, 6, 25, 21, 3, 20, 5, 10, 9, 6, 6, 5, 4],
  '8': [8, 7, 8, 6, 5, 8, 8, 8, 12, 12, 4, 16, 16, 13, 4, 6, 6],
};
const TAUGHT = {
  '7': {
    council: [5, 4, 5, 5, 6, 2, 0, 0, 1, 16, 0, 1, 0, 6, 2, 0, 0],
    head: [5, 4, 5, 5, 6, 2, 25, 21, 1, 16, 0, 1, 0, 6, 2, 0, 0],
    stage1: [5, 5, 7, 5, 8, 2, 25, 21, 1, 16, 0, 1, 0, 6, 2, 0, 0],
    // 7.9 1 → 3 (func:1, the situation graph); 7.8 stays 21 (eq:6-7 are a 0-hour cross-listing)
    s5BeforeClassroom: [5, 5, 7, 5, 8, 2, 25, 21, 3, 16, 0, 1, 0, 6, 2, 0, 0],
    // 7.6 2 → 6 (signed:7, powers), 7.10 16 → 18 (angles:6-7, the bisector and the quadrilateral)
    classroom: [5, 5, 7, 5, 8, 6, 25, 21, 1, 18, 0, 1, 0, 6, 2, 0, 0],
    // 7.11 0 → 5 (transf:1-4)
    stage4: [5, 5, 7, 5, 8, 2, 25, 21, 1, 16, 5, 1, 0, 6, 2, 0, 0],
  },
  '8': {
    council: [0, 0, 8, 0, 0, 1, 0, 8, 1, 8, 0, 0, 3, 1, 0, 0, 0],
    head: [0, 0, 8, 0, 0, 1, 0, 8, 6, 8, 0, 0, 3, 13, 4, 0, 0],
    stage1: [8, 7, 8, 0, 0, 1, 0, 8, 6, 8, 0, 0, 3, 13, 4, 0, 0],
    // 8.7 0 → 8 (func:1-3), 8.8 stays 8 (func:4 is a 0-hour cross-listing), 8.9 6 → 12 (eq:6-7)
    s5BeforeClassroom: [8, 7, 8, 0, 0, 1, 8, 8, 12, 8, 0, 0, 3, 13, 4, 0, 0],
    classroom: [8, 7, 8, 0, 0, 1, 0, 8, 6, 8, 0, 0, 3, 13, 4, 0, 0],
    // 8.5 0 → 5 (transf:1-4, the transition year)
    stage4: [8, 7, 8, 0, 5, 1, 0, 8, 6, 8, 0, 0, 3, 13, 4, 0, 0],
  },
};
// After stage 1, the hours each later stage adds (§0.3: S2 = 7.6, 7.12, 7.13, 8.4, 8.17; S3 = 7.15-7.17, 8.6, 8.10,
// 8.11, 8.16; S4 = 7.11, 8.5, 8.12, 8.13; S5 = 7.9, 7.10, 8.7, 8.9, and the 0-hour cross-listings 8.8's func:4 and
// 7.8's motion problems), and the totals after each (ז׳ 126, 139, 144, 150; ח׳ 78, 99, 133, 147). Curriculum stage 3
// has landed all of S3: ז׳'s 7.15-7.17 are taught by data:1-4 (13 hours, 104 + 13 = 117), and ח׳ learns the data unit
// too this year (8.6, 7 hours, and "הסתברות א" in 8.16, 2 hours), stats:6-8 the rest of 8.10 and 8.11 (8 hours) and
// prob:1-3 "הסתברות ב", the other 4 hours of 8.16: 66 + 21 = 87. Its fixture keeps 139 and 99 after S3 (BASE).
// Stage 2 has landed all of S2 with the classroom lane's signed:7: 7.12 is taught whole by area:1-5 (with coord:4), 7.13
// by solid:1-4, 8.4 by circle:1-4 and 8.17 by space:1-2; the hours those parts teach on the STAGE2 fixture are the hours
// their `later: 'S2'` parts promised, so the totals hold.
const AFTER = { '7': { S2: 126, S3: 139, S4: 144, S5: 150 }, '8': { S2: 78, S3: 99, S4: 133, S5: 147 } };
// The classroom fixture (stage 1 and the classroom lane's three stairs), the hours left for each later stage added up: S2 no
// longer brings 7.6's four hours of powers, S5 keeps only 7.10's two hours of measuring (and 7.9's situation graph), so
// ז׳ is 128, 141, 146, 150 after S2-S5 (the lane's own numbers); ח׳ is unchanged.
const AFTER_CLASSROOM = { '7': { S2: 128, S3: 141, S4: 146, S5: 150 }, '8': AFTER['8'] };
// Stage 4's fixtures (stage 1 with its stairs). With the transformations (7.11 and 8.5, 5 hours each) S4 still brings
// 8.12 and 8.13: the totals are ז׳ 131, 144, 144, 150 and ח׳ 83, 104, 133, 147.
const AFTER_STAGE4 = { '7': { S2: 131, S3: 144, S4: 144, S5: 150 }, '8': { S2: 83, S3: 104, S4: 133, S5: 147 } };
// With congr:5 too (the lane's stage 7) 8.12's 16 hours are taught already: ח׳ 99, 120, then the same 133 and 147.
const AFTER7 = { '7': AFTER_STAGE4['7'], '8': { S2: 99, S3: 120, S4: 133, S5: 147 } };
// With sim:1-4 too (the lane's stage 8) 8.13's 13 hours are taught as well: ח׳ 112, 133, and S4 brings nothing more.
const AFTER8 = { '7': AFTER_STAGE4['7'], '8': { S2: 112, S3: 133, S4: 133, S5: 147 } };
// The stairs a later stage brings, by stage (stage5.md FUNC-8 Design 2 (d)): with stage 1's fixtures, a part that lists
// one of them is untaught, and its stage is its stairs'. So stage 1's fixtures keep their numbers while later stages
// land. Every stair a part lists exists (Design 2 (a)); a stage's part that waits for a stair not built yet lists none
// and names its stage in `later` (7.10's measuring part waits for angles:8). The classroom lane's three stairs teach hours
// the roadmap had given to S2 (7.6's powers: signed:7) and S5 (7.10's bisector and quadrilateral: angles:6-7), so they
// count as those stages' here and stage 1's fixtures keep their numbers (the CLASSROOM fixture has its own).
const STAGE_OF_STAIR = Object.freeze({
  ...Object.fromEntries(STAGE2_STAIRS.map((s) => [s, 'S2'])),
  ...Object.fromEntries(STAGE3.map((s) => [s, 'S3'])),
  'signed:7': 'S2',
  ...Object.fromEntries([...TRANSF, ...CONGR, ...SIM].map((s) => [s, 'S4'])),
  'func:1': 'S5', 'func:2': 'S5', 'func:3': 'S5', 'func:4': 'S5', 'eq:6': 'S5', 'eq:7': 'S5', 'angles:6': 'S5', 'angles:7': 'S5', 'angles:8': 'S5',
});
const STAGES = ['S2', 'S3', 'S4', 'S5'];
/** The stage that teaches a part: its `later`, or, for a part with stairs, the latest stage among its stairs (none for stage 1's). */
const stageOf = (part) => part.later || part.skills.map((s) => STAGE_OF_STAIR[s]).filter(Boolean).sort().pop() || null;
const BASE = { '7': 117, '8': 87 };
// The units each stage teaches, by its parts' stage (stageOf: a part's `later`, or its stairs' stage). S2's five are all
// taught now: 7.6's powers by signed:7, 7.12 whole by area:1-5 (with coord:4), 7.13 by solid:1-4, 8.4 by circle:1-4 and
// 8.17 by space:1-2; their parts list their stairs and wait for no stage ("the next stage" test).
// S4's four are all taught too: 7.11 and 8.5 by transf:1-4, 8.12 by congr:1-5 and 8.13's second part by sim:1-4.
const COMPLETES = {
  S2: ['7.6', '7.12', '7.13', '8.4', '8.17'],
  S3: ['7.15', '7.16', '7.17', '8.6', '8.10', '8.11', '8.16'],
  S4: ['7.11', '8.5', '8.12', '8.13'],
  S5: ['7.8', '7.9', '7.10', '8.7', '8.8', '8.9'],
};

const sum = (a) => a.reduce((x, y) => x + y, 0);
const unitsOf = (g) => PROGRAMME.units.filter((u) => u.grade === g);
const allParts = PROGRAMME.units.flatMap((u) => u.parts.map((p) => ({ unit: u, part: p })));

test('the programme: 17 units a grade, in the schedules\' order, with their hours, domains and months', () => {
  assert.equal(PROGRAMME.year, 'תשפ״ז');
  assert.match(PROGRAMME.sources['7'], /^https:\/\/meyda\.education\.gov\.il\/.+prisa_7\.pdf$/);
  assert.match(PROGRAMME.sources['8'], /^https:\/\/meyda\.education\.gov\.il\/.+prisa_8\.pdf$/);
  for (const g of ['7', '8']) {
    const units = unitsOf(g);
    assert.deepEqual(units.map((u) => u.id), Array.from({ length: 17 }, (_, i) => `${g}.${i + 1}`));
    assert.deepEqual(units.map((u) => sum(u.parts.map((p) => p.hours))), HOURS[g], `grade ${g}: each unit's parts add up to its hours`);
    for (const u of units) {
      assert.ok(['numbers', 'algebra', 'geometry', 'uncertainty'].includes(u.domain), u.id);
      assert.ok(typeof u.title === 'string' && u.title.trim().length > 0, u.id);
      assert.ok(u.months.length > 0, u.id);
      // months are calendar months of the school year (no July or August), listed in school order
      const order = u.months.map((m) => (m >= 9 ? m - 9 : m + 3));
      assert.ok(u.months.every((m) => Number.isInteger(m) && ((m >= 9 && m <= 12) || (m >= 1 && m <= 6))), u.id);
      assert.deepEqual(order, [...order].sort((a, b) => a - b), `${u.id}: months in school order`);
      // a part has hours, or none with its stairs listed: a cross-listing of a stair a class meets without hours of its
      // own (8.8's func:4, uniform and non-uniform rate, whose December row's hours are line's: stage5.md FUNC-8 (f))
      assert.ok(u.parts.every((p) => Number.isInteger(p.hours) && (p.hours > 0 || (p.hours === 0 && p.skills.length > 0))), u.id);
      // a part's own months, when it has them (MEASURE-6.1): not empty, school months in school order, once each; a
      // part that teaches hours is in its unit's own months (7.12's parallelogram is April), and only a cross-listing
      // of no hours may be later than its unit (7.8's motion problems: June)
      for (const p of u.parts.filter((x) => x.months !== undefined)) {
        assert.ok(Array.isArray(p.months) && p.months.length > 0, `${u.id}: a part's months are not empty`);
        assert.ok(p.months.every((m) => Number.isInteger(m) && ((m >= 9 && m <= 12) || (m >= 1 && m <= 6))), `${u.id}: a part's months`);
        if (p.hours > 0) p.months.forEach((m) => assert.ok(u.months.includes(m), `${u.id}: month ${m} of a part is one of the unit's`));
        const po = p.months.map((m) => (m >= 9 ? m - 9 : m + 3));
        assert.deepEqual(po, [...new Set(po)].sort((a, b) => a - b), `${u.id}: a part's months in school order, once each`);
      }
    }
  }
  assert.equal(sum(HOURS['7']), 150);
  assert.equal(sum(HOURS['8']), 147);
  assert.equal(coverage('7', []).hours, 150);
  assert.equal(coverage('8', []).hours, 147);
});

test('the next stage: no part waits for a stage older than ROADMAP_NEXT', () => {
  // stage 2 and CLASSROOM-5 (signed:7, which teaches 7.6) are both merged, stage 3 and stage 4 too: ROADMAP_NEXT is the
  // lowest stage that still has a `later` part (S5: 7.10's measuring, for angles:8). Whoever merges the last stair of
  // that stage moves it on.
  assert.ok(STAGES.includes(ROADMAP_NEXT), ROADMAP_NEXT);
  for (const { unit, part } of allParts.filter(({ part: p }) => p.later !== undefined)) {
    assert.ok(STAGES.includes(part.later), `${unit.id}: ${part.later}`);
    assert.ok(STAGES.indexOf(part.later) >= STAGES.indexOf(ROADMAP_NEXT), `${unit.id} waits for ${part.later}, before ${ROADMAP_NEXT}`);
  }
  // and some part does wait for it: the next stage is not already done
  assert.ok(allParts.some(({ part }) => part.later === ROADMAP_NEXT), `no part waits for ${ROADMAP_NEXT}`);
  // stage 2 is whole (measurement, and 7.6's powers by the classroom lane's signed:7), and stages 3 and 4 (ח׳ geometry
  // is all built): no part waits for them
  assert.deepEqual(allParts.filter(({ part }) => ['S2', 'S3', 'S4'].includes(part.later)).map(({ unit }) => unit.id), []);
  assert.equal(ROADMAP_NEXT, 'S5');
});

test('every stair a part lists is a stair of the app; a part with none is a later stage\'s, with a note', () => {
  for (const { unit, part } of allParts) {
    if (part.skills.length) {
      part.skills.forEach((s) => assert.ok(Object.hasOwn(STAIR_NAMES, s), `${unit.id} lists ${s}, which is not a stair of the app (shared/stairs.js)`));
      assert.equal(part.later, undefined, `${unit.id}: a part with stairs is not waiting for a later stage`);
    } else {
      assert.ok(['S2', 'S3', 'S4', 'S5'].includes(part.later), `${unit.id}: an empty part names its stage`);
      assert.ok(typeof part.note === 'string' && part.note.trim().length > 0, `${unit.id}: an empty part says what it is`);
    }
  }
  // stage 1's own parts already name their stairs
  const listing = (id) => PROGRAMME.units.find((u) => u.id === id).parts.flatMap((p) => p.skills);
  for (const id of ['7.2', '7.3', '7.5']) assert.ok(listing(id).includes('signed:6'), id);
  // 7.6's powers are signed:7 (CLASSROOM-5): the roadmap's stage-2 "pow" topic is not built, the signed unit teaches them
  assert.deepEqual(listing('7.6'), ['pyth:1', 'signed:7']);
  // 7.10: angles:1-5, then the bisector and the quadrilateral (CLASSROOM-10, -12), then measuring (S5, angles:8)
  assert.deepEqual(PROGRAMME.units.find((u) => u.id === '7.10').parts.map((p) => [p.hours, p.skills, p.later]),
    [[16, ['angles:1', 'angles:2', 'angles:3', 'angles:4', 'angles:5'], undefined], [2, ['angles:6', 'angles:7'], undefined], [2, [], 'S5']]);
  assert.deepEqual(listing('8.1'), ['ratio:1', 'ratio:2', 'ratio:3', 'ratio:4']);
  assert.deepEqual(listing('8.2'), ['pct:1', 'pct:2', 'pct:3', 'pct:4', 'pct:5']);
  // stage 2's areas and perimeters (MEASURE-6.1): 7.12 whole, coord:4 and area:1-5, each area stair in its months
  assert.deepEqual(listing('7.12'), ['coord:4', 'area:1', 'area:2', 'area:3', 'area:4', 'area:5']);
  assert.deepEqual(['area:1', 'area:2', 'area:3', 'area:4', 'area:5'].map((s) => monthIndex(s, '7')), [3, 3, 4, 7, 8]);
  assert.equal(coverage('7', STAGE2).units.find((u) => u.id === '7.12').state, 'yes');
  // and 7.13 whole by solid:1-4: the box in January, the prism in May
  assert.deepEqual(listing('7.13'), ['solid:1', 'solid:2', 'solid:3', 'solid:4']);
  assert.deepEqual(['solid:1', 'solid:2', 'solid:3', 'solid:4'].map((s) => monthIndex(s, '7')), [4, 4, 8, 8]);
  assert.equal(coverage('7', STAGE2).units.find((u) => u.id === '7.13').state, 'yes');
  // and 8.4 whole by circle:1-4: the circle, the disc and the cylinder in October, the cone in November
  assert.deepEqual(listing('8.4'), ['circle:1', 'circle:2', 'circle:3', 'circle:4']);
  assert.deepEqual(['circle:1', 'circle:2', 'circle:3', 'circle:4'].map((s) => monthIndex(s, '8')), [1, 1, 1, 2]);
  assert.equal(coverage('8', STAGE2).units.find((u) => u.id === '8.4').state, 'yes');
  // and 8.17 whole by space:1-2, in May, the unit's month
  assert.deepEqual(listing('8.17'), ['space:1', 'space:2']);
  assert.deepEqual(['space:1', 'space:2'].map((s) => monthIndex(s, '8')), [8, 8]);
  assert.equal(coverage('8', STAGE2).units.find((u) => u.id === '8.17').state, 'yes');
  // with every stage-2 topic listed, the fixture is all of S2 but 7.6's signed:7 (CLASSROOM-5): ז׳ 122, ח׳ 78
  assert.deepEqual([coverage('7', STAGE2).taught, coverage('8', STAGE2).taught], [122, 78]);
  // the transformations are taught in ז׳ (7.11) and, in the transition year, in ח׳ too (8.5): one unit, two places
  assert.deepEqual(listing('7.11'), TRANSF);
  assert.deepEqual(listing('8.5'), TRANSF);
  for (const id of ['7.11', '8.5']) assert.ok(PROGRAMME.units.find((u) => u.id === id).parts.every((p) => p.later !== 'S4'), id);
  // congruence: 8.12 lists its five stairs; similarity: 8.13 lists angles:5 (the isosceles and exterior angles, 3 hours)
  // and sim:1-4 (13 hours)
  assert.deepEqual(listing('8.12'), CONGR);
  assert.deepEqual(listing('8.13'), ['angles:5', ...SIM]);
  // grade-8 geometry is all built: no part still waits for S4
  assert.deepEqual(allParts.filter(({ part }) => part.later === 'S4').map(({ unit }) => unit.id), []);
  // one stair can serve several units
  assert.deepEqual(PROGRAMME.units.filter((u) => u.parts.some((p) => p.skills.includes('pyth:1'))).map((u) => u.id), ['7.6', '7.14', '8.3']);
  assert.ok(listing('7.9').includes('line:1'));
  // stage 3: the ז׳ data unit (DATA-8)
  assert.deepEqual(PROGRAMME.units.find((u) => u.id === '7.15').parts, [{ hours: 2, skills: ['stats:1'] }, { hours: 4, skills: ['data:1'] }]);
  assert.deepEqual(listing('7.16'), ['data:2', 'data:3']);
  assert.deepEqual(listing('7.17'), ['data:4']);
  assert.ok(listing('8.3').includes('angles:4'));
});

test('the spec\'s two worked units, 7.3 and 8.9, are exactly as written', () => {
  const unit = (id) => PROGRAMME.units.find((u) => u.id === id);
  assert.deepEqual(unit('7.3').parts, [{ hours: 5, skills: ['signed:1'] }, { hours: 2, skills: ['signed:6'], note: 'שברים ועשרוניים מכוונים' }]);
  assert.deepEqual(unit('8.9').parts, [
    { hours: 1, skills: ['line:8'] },
    { hours: 5, skills: ['eq:1', 'eq:2', 'eq:3', 'eq:4', 'eq:5', 'sys:1'] },
    { hours: 6, skills: ['eq:6', 'eq:7'], note: 'שאלות תנועה, משתנה במכנה, משוואות בעזרת פרופורציה' },
  ]);
});

test('no part lists a bridge stair: elementary fractions add no hours', () => {
  for (const { unit, part } of allParts) assert.ok(part.skills.every((s) => !s.startsWith('frac:')), unit.id);
  for (const g of ['7', '8']) assert.equal(coverage(g, [...STAGE1, ...BRIDGE]).taught, coverage(g, STAGE1).taught);
});

test('coverage from the six fixtures: the council\'s 33 stairs, HEAD\'s 48, stage 1, stage 5 before the classroom split, the classroom lane, stage 1 with the transformations', () => {
  assert.equal(COUNCIL.length, 33);
  assert.equal(HEAD.length, 48);
  assert.equal(STAGE1.length, 58);
  assert.equal(S5_BEFORE_CLASSROOM.length, 64);
  assert.equal(CLASSROOM.length, 61);
  assert.equal(STAGE4.length, 62);
  const want = { council: [COUNCIL, 53, 30], head: [HEAD, 99, 51], stage1: [STAGE1, 104, 66], s5BeforeClassroom: [S5_BEFORE_CLASSROOM, 106, 80], classroom: [CLASSROOM, 110, 66], stage4: [STAGE4, 109, 71] };
  for (const [name, [skills, t7, t8]] of Object.entries(want)) {
    const c7 = coverage('7', skills); const c8 = coverage('8', skills);
    assert.deepEqual([c7.taught, c7.hours, c8.taught, c8.hours], [t7, 150, t8, 147], name);
    assert.equal(c7.pct, Math.round((100 * t7) / 150), name);
    assert.equal(c8.pct, Math.round((100 * t8) / 147), name);
    // unit by unit, the hours the curriculum spec checked
    assert.deepEqual(c7.units.map((u) => u.taught), TAUGHT['7'][name], `${name} ז׳`);
    assert.deepEqual(c8.units.map((u) => u.taught), TAUGHT['8'][name], `${name} ח׳`);
  }
  // the percentages the spec quotes (ז׳–ח׳ together: 28%, 51%, 57%)
  assert.deepEqual([coverage('7', COUNCIL).pct, coverage('8', COUNCIL).pct], [35, 20]);
  assert.deepEqual([coverage('7', HEAD).pct, coverage('8', HEAD).pct], [66, 35]);
  assert.deepEqual([coverage('7', STAGE1).pct, coverage('8', STAGE1).pct], [69, 45]);
  assert.equal(Math.round((100 * (104 + 66)) / 297), 57);
  // stage 5 before the classroom split: ז׳ 106 of 150 (71%), ח׳ 80 of 147 (54%), 63% together
  const c7 = coverage('7', S5_BEFORE_CLASSROOM); const c8 = coverage('8', S5_BEFORE_CLASSROOM);
  assert.deepEqual([c7.taught, c7.pct, c8.taught, c8.pct], [106, 71, 80, 54]);
  assert.equal(Math.round((100 * (c7.taught + c8.taught)) / (c7.hours + c8.hours)), 63);
  // the units stage 5 moves: 7.9 3, 8.7 8, 8.8 8 (func:4 adds no hour), 8.9 12; 7.10 waits for angles:8 (16 of 20)
  const hours = (c, id) => c.units.find((u) => u.id === id).taught;
  assert.deepEqual([hours(c7, '7.9'), hours(c8, '8.7'), hours(c8, '8.8'), hours(c8, '8.9')], [3, 8, 8, 12]);
  assert.deepEqual([hours(c7, '7.10'), c7.units.find((u) => u.id === '7.10').state], [16, 'part']);
  assert.deepEqual(['7.8', '7.9'].map((id) => c7.units.find((u) => u.id === id).state), ['yes', 'yes']);
  assert.deepEqual(['8.7', '8.8', '8.9'].map((id) => c8.units.find((u) => u.id === id)).map((u) => [u.state, u.missing]), [['yes', []], ['yes', []], ['yes', []]]);
  // the classroom lane: signed:7 teaches 7.6's four hours of powers, angles:6 and angles:7 7.10's two of the bisector and
  // the quadrilateral: ז׳ 104 + 4 + 2 = 110 of 150 (73%), both grades 176 of 297 (59%)
  assert.deepEqual([coverage('7', CLASSROOM).pct, coverage('8', CLASSROOM).pct], [73, 45]);
  assert.equal(Math.round((100 * (110 + 66)) / 297), 59);
  const u710 = coverage('7', CLASSROOM).units.find((u) => u.id === '7.10');
  assert.deepEqual([u710.taught, u710.state, u710.missing], [18, 'part', ['מדידה ואומדן של זוויות']]);
  assert.deepEqual(u710.parts.map((p) => [p.hours, p.taught, p.later]), [[16, true, null], [2, true, null], [2, false, 'S5']]);
  assert.deepEqual(coverage('7', CLASSROOM).units.find((u) => u.id === '7.6').stairs, ['pyth:1', 'signed:7']);
  assert.equal(coverage('7', STAGE1).units.find((u) => u.id === '7.6').state, 'part');
  assert.equal(coverage('7', CLASSROOM).units.find((u) => u.id === '7.6').state, 'yes');
  // curriculum stage 4, fixture by fixture
  {
    // the transformations: ז׳ 109 of 150 (73%), ח׳ 71 of 147 (48%), both grades 61%
    assert.deepEqual([coverage('7', STAGE4).pct, coverage('8', STAGE4).pct], [73, 48]);
    assert.equal(Math.round((100 * (109 + 71)) / 297), 61);
    assert.deepEqual([coverage('7', STAGE4).units.find((u) => u.id === '7.11').state, coverage('8', STAGE4).units.find((u) => u.id === '8.5').state], ['yes', 'yes']);
    // congr:1-4 (the lane's stage 6): the same hours, since 8.12 is taught only with congr:5; its four stairs are links
    const c8 = coverage('8', STAGE6);
    assert.deepEqual([coverage('7', STAGE6).taught, c8.taught], [109, 71]);
    assert.deepEqual(c8.units.find((u) => u.id === '8.12'), {
      id: '8.12', domain: 'geometry', title: 'חפיפת משולשים, צלעות במשולש, תיכון', months: [1, 2], hours: 16, taught: 0, state: 'no',
      stairs: CONGR.slice(0, 4), missing: ['חפיפת משולשים, צלעות במשולש ותיכון'],
      parts: [{ hours: 16, skills: CONGR, note: 'חפיפת משולשים, צלעות במשולש ותיכון', later: null, taught: false }],
    });
    // with congr:5 too (the lane's stage 7), the whole unit: ח׳ 87 of 147 (59%), both grades 66%
    const c7 = coverage('8', STAGE7);
    assert.equal(STAGE7.length, 67);
    assert.deepEqual([coverage('7', STAGE7).taught, c7.taught, c7.pct], [109, 87, 59]);
    assert.equal(Math.round((100 * (109 + 87)) / 297), 66);
    assert.deepEqual(c7.units.find((u) => u.id === '8.12'), {
      id: '8.12', domain: 'geometry', title: 'חפיפת משולשים, צלעות במשולש, תיכון', months: [1, 2], hours: 16, taught: 16, state: 'yes',
      stairs: CONGR, missing: [],
      parts: [{ hours: 16, skills: CONGR, note: 'חפיפת משולשים, צלעות במשולש ותיכון', later: null, taught: true }],
    });
    assert.deepEqual(c7.units.map((u) => u.taught), [8, 7, 8, 0, 5, 1, 0, 8, 6, 8, 0, 16, 3, 13, 4, 0, 0]);
    // with sim:1-4 too (the lane's stage 8), 8.13 whole: ח׳ 100 of 147 (68%), ז׳ still 109 of 150 (73%), both grades 70%
    const s8 = coverage('8', STAGE8);
    assert.equal(STAGE8.length, 71);
    assert.deepEqual([coverage('7', STAGE8).taught, coverage('7', STAGE8).pct, s8.taught, s8.pct], [109, 73, 100, 68]);
    assert.equal(Math.round((100 * (109 + 100)) / 297), 70);
    assert.deepEqual(s8.units.find((u) => u.id === '8.13'), {
      id: '8.13', domain: 'geometry', title: 'זווית חיצונית, שווה־שוקיים ומשפטים הפוכים, דמיון משולשים', months: [3, 4], hours: 16, taught: 16, state: 'yes',
      stairs: ['angles:5', ...SIM], missing: [],
      parts: [
        { hours: 3, skills: ['angles:5'], note: null, later: null, taught: true },
        { hours: 13, skills: SIM, note: 'משפטים הפוכים בשווה־שוקיים ודמיון משולשים', later: null, taught: true },
      ],
    });
    assert.deepEqual(s8.units.map((u) => u.taught), [8, 7, 8, 0, 5, 1, 0, 8, 6, 8, 0, 16, 16, 13, 4, 0, 0]);
  }
});

test('a unit\'s state, stairs and missing parts', () => {
  const at = (g, skills, id) => coverage(g, skills).units.find((u) => u.id === id);
  // whole, partial and absent units
  assert.deepEqual(at('7', HEAD, '7.1'), {
    id: '7.1', domain: 'numbers', title: 'מערכת צירים ברביע I', months: [9], hours: 5, taught: 5, state: 'yes',
    stairs: ['coord:1'], missing: [], parts: [{ hours: 5, skills: ['coord:1'], note: null, later: null, taught: true }],
  });
  const u73 = at('7', HEAD, '7.3');
  assert.equal(u73.state, 'part');
  assert.deepEqual(u73.stairs, ['signed:1']); // signed:6 is listed but does not exist at HEAD
  assert.deepEqual(u73.missing, ['שברים ועשרוניים מכוונים']);
  assert.deepEqual(u73.parts.map((p) => [p.taught, p.later]), [[true, null], [false, null]]); // no stage is promised
  assert.equal(at('7', STAGE1, '7.3').state, 'yes');
  const u81 = at('8', HEAD, '8.1');
  assert.deepEqual([u81.state, u81.taught, u81.stairs], ['no', 0, []]);
  assert.deepEqual(u81.missing, ['יחס, פרופורציה וקנה מידה']); // no note: the unit's title
  assert.deepEqual(at('8', STAGE1, '8.1').stairs, ['ratio:1', 'ratio:2', 'ratio:3', 'ratio:4']);
  // a part is taught only when every stair it lists exists
  assert.equal(at('8', [...HEAD.filter((s) => s !== 'sys:1')], '8.9').taught, 1);
  // 8.7 lists func:1-3 (stage5.md FUNC-8): untaught while one of them is missing, all 8 hours once they are there
  assert.equal(at('8', [...STAGE1, 'func:1', 'func:2'], '8.7').taught, 0);
  assert.equal(at('8', [...STAGE1, 'func:1', 'func:2', 'func:3'], '8.7').taught, 8);
  // 8.8 lists func:4 in a part of 0 hours (the schedule's December row, whose hours are line's): it moves no hour, and
  // while func:4 is missing the unit names it as missing though every hour is taught; with it, nothing is missing
  const u88 = at('8', [...STAGE1, 'func:1', 'func:2', 'func:3'], '8.8');
  assert.deepEqual([u88.taught, u88.hours, u88.missing], [8, 8, ['קצב שינוי אחיד ולא אחיד']]);
  assert.deepEqual(u88.parts.map((p) => [p.hours, p.skills, p.taught]), [[8, ['line:1', 'line:2', 'line:3', 'line:4', 'line:5', 'line:6', 'line:7', 'line:8'], true], [0, ['func:4'], false]]);
  const with4 = [...STAGE1, 'func:1', 'func:2', 'func:3', 'func:4'];
  assert.deepEqual(at('8', with4, '8.8').missing, []);
  assert.equal(coverage('8', with4).taught, coverage('8', [...STAGE1, 'func:1', 'func:2', 'func:3']).taught);
  assert.equal(coverage('8', with4).taught, 74);
  assert.equal(monthIndex('func:4', '8'), 2); // 8.8, November
  // 7.8 lists eq:6 and eq:7 in a part of 0 hours with its own month (June, the motion task: ח׳ content a ז׳ class meets
  // too): it moves no hour, and names the part as missing until both stairs are there
  const u78 = at('7', [...STAGE1, 'eq:6'], '7.8');
  assert.deepEqual([u78.taught, u78.hours, u78.state, u78.missing], [21, 21, 'yes', ['שאלות תנועה ומשוואות עם מכנים']]);
  const with67 = at('7', [...STAGE1, 'eq:6', 'eq:7'], '7.8');
  assert.deepEqual([with67.taught, with67.missing, with67.stairs.includes('eq:6'), with67.stairs.includes('eq:7')], [21, [], true, true]);
  assert.deepEqual(with67.parts.map((p) => [p.hours, p.skills, p.taught]), [[21, ['eq:1', 'eq:2', 'eq:3', 'eq:4', 'eq:5'], true], [0, ['eq:6', 'eq:7'], true]]);
  assert.deepEqual(PROGRAMME.units.find((u) => u.id === '7.8').parts[1].months, [6]);
  assert.equal(coverage('7', [...STAGE1, 'eq:6', 'eq:7']).taught, coverage('7', STAGE1).taught);
  // 8.9's third part, the motion problems, x in a denominator and proportions (6 hours), is eq:6 and eq:7's: untaught
  // until both are there; with the functions unit, ח׳ is then 80 of 147
  const S5_8 = [...STAGE1, 'func:1', 'func:2', 'func:3', 'func:4'];
  assert.deepEqual([at('8', [...S5_8, 'eq:6'], '8.9').taught, at('8', [...S5_8, 'eq:6', 'eq:7'], '8.9').taught], [6, 12]);
  assert.deepEqual(at('8', [...S5_8, 'eq:6', 'eq:7'], '8.9').missing, []);
  assert.deepEqual([coverage('8', [...S5_8, 'eq:6', 'eq:7']).taught, coverage('8', [...S5_8, 'eq:6', 'eq:7']).hours], [80, 147]);
  // func:1 teaches ז׳ 7.9's situation graph (2 hours): ז׳ 104 + 2 = 106 of 150, ח׳ unchanged at 66 of 147
  assert.deepEqual([coverage('7', [...STAGE1, 'func:1']).taught, coverage('8', [...STAGE1, 'func:1']).taught], [106, 66]);
  assert.deepEqual(at('7', [...STAGE1, 'func:1'], '7.9'), {
    id: '7.9', domain: 'algebra', title: 'נקודות על גרף ברביע I', months: [5], hours: 3, taught: 3, state: 'yes', stairs: ['line:1', 'func:1'], missing: [],
    parts: [{ hours: 1, skills: ['line:1'], note: null, later: null, taught: true }, { hours: 2, skills: ['func:1'], note: 'קריאת גרף שמתאר מצב', later: null, taught: true }],
  });
});

test('stage 3 complete: ז׳ 117 of 150 (78%), ח׳ 87 of 147 (59%); 7.15-7.17, 8.6, 8.10, 8.11 and 8.16 taught', () => {
  const c7 = coverage('7', [...STAGE1, ...STAGE3]); const c8 = coverage('8', [...STAGE1, ...STAGE3]);
  assert.deepEqual([c7.taught, c7.pct, c8.taught, c8.pct], [117, 78, 87, 59]);
  // ז׳–ח׳ together: 204 of 297 hours (69%), from 170 (57%) at stage 1
  assert.equal(c7.taught + c8.taught, 204);
  assert.equal(c7.hours + c8.hours, 297);
  assert.equal(Math.round((100 * (c7.taught + c8.taught)) / 297), 69);
  // the seven units the stage was for (§0.3) wait for no later stage: every part lists its stairs
  const S3_UNITS = ['7.15', '7.16', '7.17', '8.6', '8.10', '8.11', '8.16'];
  for (const id of S3_UNITS) {
    const u = PROGRAMME.units.find((x) => x.id === id);
    assert.ok(u.parts.every((p) => p.later === undefined && p.skills.length > 0), `${id}: a part still waits for a stage`);
    assert.ok(u.parts.flatMap((p) => p.skills).some((s) => STAGE3.includes(s)), `${id}: taught by a stage-3 stair`);
  }
  assert.deepEqual(PROGRAMME.units.filter((u) => u.parts.some((p) => p.later === 'S3')).map((u) => u.id), []);
  // stats:6-8 (DATA-5): the rest of 8.10 (range and two sources, 4 h) and all of 8.11 (interpolation, 4 h)
  assert.deepEqual(['8.10', '8.11'].map((id) => { const u = c8.units.find((x) => x.id === id); return [u.state, u.taught, u.hours]; }), [['yes', 12, 12], ['yes', 4, 4]]);
  const without6 = coverage('8', [...STAGE1, ...STAGE3.filter((s) => !/^stats:[678]$/.test(s))]);
  assert.equal(c8.taught - without6.taught, 8);
  for (const id of ['7.15', '7.16', '7.17']) assert.equal(c7.units.find((u) => u.id === id).state, 'yes', id);
  // ח׳, the transition year: 8.6 is the ז׳ unit (with the mode, stats:1), and data:4 is "הסתברות א – בסיס" in 8.16
  assert.deepEqual(['8.6', '8.16'].map((id) => { const u = c8.units.find((x) => x.id === id); return [u.state, u.taught, u.hours]; }), [['yes', 8, 8], ['yes', 6, 6]]);
  // prob:1-3 (DATA-6) are "הסתברות ב", the other 4 h of 8.16
  const withoutProb = coverage('8', [...STAGE1, ...STAGE3.filter((s) => !s.startsWith('prob:'))]);
  assert.equal(c8.taught - withoutProb.taught, 4);
  assert.deepEqual(c8.units.filter((u, i) => u.taught !== withoutProb.units[i].taught).map((u) => u.id), ['8.16']);
  const without8 = coverage('8', STAGE1);
  assert.equal(c8.taught - without8.taught, 21);
  assert.deepEqual(c8.units.filter((u, i) => u.taught !== without8.units[i].taught).map((u) => u.id), ['8.6', '8.10', '8.11', '8.16']);
  // the data stairs alone add 13 hours to ז׳, and only through 7.15-7.17
  const without = coverage('7', STAGE1);
  assert.equal(c7.taught - without.taught, 13);
  assert.deepEqual(c7.units.filter((u, i) => u.taught !== without.units[i].taught).map((u) => u.id), ['7.15', '7.16', '7.17']);
});

test('with the stage-1 and the stage-2 stairs, every untaught part names the later stage that brings it, and the stages add up', () => {
  assert.equal(STAGE2.length, STAGE1.length + 15);
  assert.equal(new Set(STAGE2).size, STAGE2.length);
  // the same totals from both fixtures: the hours stage 2's parts teach are the hours S2 promised (7.6's four wait for
  // signed:7, which neither fixture has)
  for (const [name, fixture] of [['stage 1', STAGE1], ['stage 2', STAGE2]]) {
    for (const g of ['7', '8']) {
      const c = coverage(g, fixture);
      let taught = c.taught;
      for (const u of c.units) {
        for (const p of u.parts.filter((x) => !x.taught)) assert.ok(STAGES.includes(stageOf(p)), `${u.id}: ${p.note || p.skills.join(', ')}`);
      }
      for (const stage of STAGES) {
        taught += sum(c.units.flatMap((u) => u.parts.filter((p) => !p.taught && stageOf(p) === stage).map((p) => p.hours)));
        assert.equal(taught, AFTER[g][stage], `${name}'s fixture, grade ${g} after ${stage}`);
      }
    }
  }
  // stage 2 with the classroom lane's three stairs: all of S2 is taught (ז׳ 128 of 150, 85%; ח׳ 78 of 147, 53%; both
  // grades 206 of 297, 69%), nothing of S2 is left, and the later stages add up to the classroom fixture's totals
  {
    const c7 = coverage('7', STAGE2_CLASSROOM); const c8 = coverage('8', STAGE2_CLASSROOM);
    assert.deepEqual([c7.taught, c7.pct, c8.taught, c8.pct], [128, 85, 78, 53]);
    assert.equal(Math.round((100 * (c7.taught + c8.taught)) / (c7.hours + c8.hours)), 69);
    for (const [g, c] of [['7', c7], ['8', c8]]) {
      const left = c.units.flatMap((u) => u.parts.filter((p) => !p.taught).map((p) => ({ id: u.id, stage: stageOf(p), hours: p.hours })));
      assert.deepEqual(left.filter((p) => p.stage === 'S2'), [], `grade ${g}: nothing of stage 2 is left`);
      let taught = c.taught;
      for (const stage of STAGES) {
        taught += sum(left.filter((p) => p.stage === stage).map((p) => p.hours));
        assert.equal(taught, AFTER_CLASSROOM[g][stage], `stage 2 with the classroom stairs, grade ${g} after ${stage}`);
      }
    }
  }
  // stage 5 before the classroom split: what is left is stages 2-4's hours, as with stage 1's stairs, and 7.10's last
  // four hours (S5: the classroom split's angles:6-7 part, 2 hours, and the measuring part angles:8 brings, 2 hours); with
  // them the programme is whole, ז׳ 150 and ח׳ 147
  for (const g of ['7', '8']) {
    const c = coverage(g, S5_BEFORE_CLASSROOM);
    const left = c.units.flatMap((u) => u.parts.filter((p) => !p.taught).map((p) => ({ id: u.id, stage: stageOf(p), hours: p.hours })));
    left.forEach((p) => assert.ok(STAGES.includes(p.stage), `${p.id} is untaught and names no later stage`));
    const stage1 = coverage(g, STAGE1).taught;
    const leftOf = (stage) => sum(left.filter((p) => p.stage === stage).map((p) => p.hours));
    assert.deepEqual(['S2', 'S3', 'S4'].map(leftOf), [AFTER[g].S2 - stage1, AFTER[g].S3 - AFTER[g].S2, AFTER[g].S4 - AFTER[g].S3], `grade ${g}: stages 2-4 keep their hours`);
    assert.deepEqual(left.filter((p) => p.stage === 'S5').map((p) => [p.id, p.hours]), g === '7' ? [['7.10', 2], ['7.10', 2]] : [], `grade ${g}: S5's parts left`);
    assert.equal(c.taught + sum(left.map((p) => p.hours)), AFTER[g].S5, `grade ${g}: every hour, after S5`);
  }
  // curriculum stage 3's fixture (stage 1 and its ten stairs): ז׳ 117 and ח׳ 87; nothing of S3 is left, and stages 2, 4
  // and 5 keep their hours
  for (const g of ['7', '8']) {
    const c = coverage(g, [...STAGE1, ...STAGE3]);
    assert.equal(c.taught, BASE[g], `grade ${g} after stage 3`);
    const left = c.units.flatMap((u) => u.parts.filter((p) => !p.taught).map((p) => ({ id: u.id, stage: stageOf(p), hours: p.hours })));
    left.forEach((p) => assert.ok(STAGES.includes(p.stage), `${p.id} is untaught and names no later stage`));
    const leftOf = (stage) => sum(left.filter((p) => p.stage === stage).map((p) => p.hours));
    const stage1 = coverage(g, STAGE1).taught;
    assert.deepEqual(STAGES.map(leftOf), [AFTER[g].S2 - stage1, 0, AFTER[g].S4 - AFTER[g].S3, AFTER[g].S5 - AFTER[g].S4], `grade ${g}: what is left after stage 3`);
    assert.equal(c.taught + sum(left.map((p) => p.hours)), AFTER[g].S5, `grade ${g}: every hour, after S5`);
  }
  // the classroom fixture (stage 1 and the lane's three stairs): every untaught part names its stage, and the stages add
  // up to the lane's totals (ז׳ 128, 141, 146, 150)
  for (const g of ['7', '8']) {
    const c = coverage(g, CLASSROOM);
    let taught = c.taught;
    for (const u of c.units) {
      for (const p of u.parts.filter((x) => !x.taught)) assert.ok(STAGES.includes(stageOf(p)), `${u.id}: ${p.note || p.skills.join(', ')}`);
    }
    for (const stage of STAGES) {
      taught += sum(c.units.flatMap((u) => u.parts.filter((p) => !p.taught && stageOf(p) === stage).map((p) => p.hours)));
      assert.equal(taught, AFTER_CLASSROOM[g][stage], `classroom fixture, grade ${g} after ${stage}`);
    }
  }
  for (const [stage, ids] of Object.entries(COMPLETES)) {
    assert.deepEqual(PROGRAMME.units.filter((u) => u.parts.some((p) => stageOf(p) === stage)).map((u) => u.id), ids, stage);
  }
  // a part's stage is its `later`, or its stairs' (a stage-1 stair brings none)
  assert.equal(stageOf({ hours: 2, skills: [], later: 'S3' }), 'S3');
  assert.equal(stageOf({ hours: 8, skills: ['func:1', 'func:2', 'func:3'] }), 'S5');
  assert.equal(stageOf({ hours: 5, skills: ['ratio:1'] }), null);
});

test('with the stage-1 stairs and the transformations (and congr:1-4, congr:1-5, then sim:1-4), every untaught part names the later stage that brings it, and the stages add up', () => {
  for (const skills of [STAGE4, STAGE6, STAGE7, STAGE8]) {
    for (const g of ['7', '8']) {
      const c = coverage(g, skills);
      let taught = c.taught;
      for (const u of c.units) {
        for (const p of u.parts.filter((x) => !x.taught)) assert.ok(STAGES.includes(stageOf(p)), `${u.id}: ${p.note || p.skills.join(', ')}`);
      }
      for (const stage of STAGES) {
        taught += sum(c.units.flatMap((u) => u.parts.filter((p) => !p.taught && stageOf(p) === stage).map((p) => p.hours)));
        assert.equal(taught, (skills === STAGE8 ? AFTER8 : skills === STAGE7 ? AFTER7 : AFTER_STAGE4)[g][stage], `grade ${g} after ${stage}`);
      }
    }
    // the units S4 still brings: 8.12 and 8.13 after the transformations; with congr:5, 8.12 is taught and S4 still
    // brings 8.13; with sim:1-4, S4 brings nothing more
    const units = ['7', '8'].flatMap((g) => coverage(g, skills).units);
    const want = skills === STAGE8 ? [] : skills === STAGE7 ? ['8.13'] : ['8.12', '8.13'];
    assert.deepEqual(units.filter((u) => u.parts.some((p) => !p.taught && stageOf(p) === 'S4')).map((u) => u.id), want);
  }
});

test('notYet: for each grade a list of non-empty Hebrew words, one per untaught part, without repeats', () => {
  // AI-5's shape: exactly the keys '7' and '8'
  for (const skills of [HEAD, STAGE1]) {
    const NOT_YET = { '7': notYet('7', skills), '8': notYet('8', skills) };
    assert.deepEqual(Object.keys(NOT_YET), ['7', '8']);
    for (const list of Object.values(NOT_YET)) {
      assert.ok(Array.isArray(list) && list.length > 0);
      list.forEach((s) => assert.ok(typeof s === 'string' && s.trim().length > 0 && /[֐-׿]/.test(s), s));
      assert.equal(new Set(list).size, list.length);
      list.forEach((s) => assert.ok(!/^[a-z]+:\d+$/.test(s), `a stair id, not words: ${s}`));
    }
  }
  // HEAD does not teach fractions in signed numbers, ratio or percent yet; stage 1 does
  assert.ok(notYet('7', HEAD).includes('שברים ועשרוניים מכוונים'));
  assert.ok(notYet('8', HEAD).includes('יחס, פרופורציה וקנה מידה'));
  assert.ok(notYet('8', HEAD).includes('אחוזים (הגדלה והקטנה באחוזים)'));
  assert.ok(!notYet('7', STAGE1).includes('שברים ועשרוניים מכוונים'));
  assert.ok(!notYet('8', STAGE1).includes('יחס, פרופורציה וקנה מידה'));
  // the list shrinks as stairs land, and is empty only when the whole programme is taught
  assert.ok(notYet('7', STAGE1).length < notYet('7', COUNCIL).length);
  // "שברים ועשרוניים מכוונים" is one entry, though three units (7.2, 7.3, 7.5) are waiting for it
  assert.equal(notYet('7', HEAD).filter((s) => s === 'שברים ועשרוניים מכוונים').length, 1);
});

test('the school calendar: the month a grade meets a stair, and where a date falls in the year', () => {
  // September 0 … June 9
  assert.equal(monthIndex('coord:1', '7'), 0);
  assert.equal(monthIndex('signed:3', '7'), 2); // November
  assert.equal(monthIndex('expr:1', '7'), 3); // December
  assert.equal(monthIndex('eq:1', '7'), 6); // March
  assert.equal(monthIndex('eq:1', '8'), 3); // 8.9, December
  // a part's own months come before its unit's: 7.8 lists eq:6 and eq:7 in June (the motion task), while eq:1-5 stay
  // March's; for ח׳ both are 8.9's, December
  assert.deepEqual([monthIndex('eq:6', '7'), monthIndex('eq:7', '7')], [9, 9]);
  for (let k = 1; k <= 5; k += 1) assert.equal(monthIndex(`eq:${k}`, '7'), 6, `eq:${k}`);
  assert.deepEqual([monthIndex('eq:6', '8'), monthIndex('eq:7', '8')], [3, 3]);
  // a stair in both grades has a month in each: pyth:1 is December in ז׳ (powers and roots) and September in ח׳
  assert.equal(monthIndex('pyth:1', '7'), 3);
  assert.equal(monthIndex('pyth:2', '7'), 6); // 7.14, March
  assert.equal(monthIndex('pyth:1', '8'), 0);
  assert.equal(monthIndex('ratio:1', '8'), 0);
  assert.equal(monthIndex('pct:1', '8'), 1); // October
  assert.equal(monthIndex('sys:5', '8'), 8); // May
  // the earliest of several units: line:8 is in 8.8 (November), 8.9 and 8.14
  assert.equal(monthIndex('line:8', '8'), 2);
  // not in that grade's programme, or not a programme stair at all
  assert.equal(monthIndex('ratio:1', '7'), null);
  assert.equal(monthIndex('frac:1', '7'), null);
  assert.equal(monthIndex('nope:1', '8'), null);
  // every stage-1 stair has a month in its own grade (the measurement stairs' months are asserted as each lands)
  const gradeOf = (s) => (/^(signed|coord|angles|expr|eq|area|solid):/.test(s) ? '7' : '8');
  STAGE1.forEach((s) => assert.equal(typeof monthIndex(s, gradeOf(s)), 'number', s));
  // stage 3's data unit: ז׳ January (7.15) and February (7.16, 7.17); probability is in no ז׳ unit
  assert.equal(monthIndex('data:1', '7'), 4);
  assert.equal(monthIndex('data:2', '7'), 5);
  assert.equal(monthIndex('data:4', '7'), 5);
  assert.equal(monthIndex('prob:1', '7'), null);
  // and in ח׳ this year: October (8.6) for data:1-3, March (8.16) for data:4
  assert.equal(monthIndex('data:1', '8'), 1);
  assert.equal(monthIndex('data:3', '8'), 1);
  assert.equal(monthIndex('data:4', '8'), 6);
  // stats:6-7 are ח׳'s December (8.10), stats:8 January (8.11); none of them is a ז׳ stair
  assert.equal(monthIndex('stats:6', '8'), 3);
  assert.equal(monthIndex('stats:7', '8'), 3);
  assert.equal(monthIndex('stats:8', '8'), 4);
  assert.equal(monthIndex('stats:6', '7'), null);
  assert.deepEqual(['area:1', 'solid:4', 'circle:1', 'space:2', 'ratio:1', 'pyth:5'].map(gradeOf), ['7', '7', '8', '8', '8', '8']);
  // the transformations: November in ז׳ (7.11) and in ח׳ (8.5)
  TRANSF.forEach((s) => { assert.equal(monthIndex(s, '7'), 2, s); assert.equal(monthIndex(s, '8'), 2, s); });
  // congruence: January in ח׳ (8.12), not in ז׳'s programme
  CONGR.forEach((s) => { assert.equal(monthIndex(s, '8'), 4, s); assert.equal(monthIndex(s, '7'), null, s); });

  assert.equal(schoolMonth('2026-09-01'), 0);
  assert.equal(schoolMonth('2026-11-10'), 2);
  assert.equal(schoolMonth('2026-12-31'), 3);
  assert.equal(schoolMonth('2027-01-01'), 4);
  assert.equal(schoolMonth('2027-06-30'), 9);
  assert.equal(schoolMonth('2027-07-15'), 9); // the summer counts as June: the whole year is taught
  assert.equal(schoolMonth('2027-08-31'), 9);
  assert.equal(schoolMonth(new Date(2026, 10, 10, 12)), 2); // a Date, in local time
  assert.equal(schoolMonth(new Date(2027, 2, 1).getTime()), 6);
  assert.equal(typeof schoolMonth(), 'number');
});

test('part months: a part with its own months is read by them, every other part by its unit\'s', () => {
  // the rule before part months: a stair's month is its units' earliest. No part that lists a stage-1 stair carries
  // months, so every stage-1 stair keeps its index, in both grades.
  const unitRule = (skill, g) => {
    const ms = unitsOf(g).filter((u) => u.parts.some((p) => p.skills.includes(skill))).flatMap((u) => u.months.map((m) => (m >= 9 ? m - 9 : Math.min(m + 3, 9))));
    return ms.length ? Math.min(...ms) : null;
  };
  for (const { unit, part } of allParts) {
    if (part.skills.some((s) => STAGE1.includes(s))) assert.equal(part.months, undefined, `${unit.id}: a stage-1 part has no months of its own`);
  }
  for (const g of ['7', '8']) {
    for (const s of [...STAGE1, ...BRIDGE, 'nope:1']) assert.equal(monthIndex(s, g), unitRule(s, g), `${s} in grade ${g}`);
    // a stair every part of which has no months of its own reads its units' months
    const plain = [...new Set(unitsOf(g).flatMap((u) => u.parts.flatMap((p) => p.skills)))]
      .filter((s) => unitsOf(g).every((u) => u.parts.every((p) => !p.skills.includes(s) || p.months === undefined)));
    plain.forEach((s) => assert.equal(monthIndex(s, g), unitRule(s, g), s));
  }

  // the rule itself, on a unit added for this test and taken out again: 7.12's months, December–January and April–May
  const probe = {
    id: '7.99', grade: '7', domain: 'geometry', title: 'בדיקה', months: [12, 1, 4, 5],
    parts: [
      { hours: 1, skills: ['zz:1'], months: [4] },
      { hours: 1, skills: ['zz:2'] },
      { hours: 1, skills: ['zz:3'], months: [12, 1] },
      { hours: 1, skills: ['zz:4'], months: [5] },
      { hours: 1, skills: ['zz:4', 'zz:5'], months: [1] },
    ],
  };
  PROGRAMME.units.push(probe);
  try {
    assert.equal(monthIndex('zz:1', '7'), 7); // April, not the unit's December
    assert.equal(monthIndex('zz:2', '7'), 3); // no months of its own: the unit's earliest, December
    assert.equal(monthIndex('zz:3', '7'), 3);
    assert.equal(monthIndex('zz:4', '7'), 4); // the earliest of its parts: January
    assert.equal(monthIndex('zz:5', '7'), 4);
    assert.equal(monthIndex('zz:1', '8'), null);
  } finally {
    PROGRAMME.units.splice(PROGRAMME.units.indexOf(probe), 1);
  }
  assert.equal(monthIndex('zz:1', '7'), null);
});

test('the words every surface quotes: the coverage sentence, the months, the hours, the school order', () => {
  // one sentence, filled from coverage(): the stage-1 fixture gives the spec's own example
  assert.equal(coverageSentence('7', coverage('7', STAGE1)), 'במדרגות יש כבר את החומר של 104 מתוך 150 שעות ההוראה של כיתה ז׳ (69%).');
  assert.equal(coverageSentence('7', coverage('7', CLASSROOM)), 'במדרגות יש כבר את החומר של 110 מתוך 150 שעות ההוראה של כיתה ז׳ (73%).');
  assert.equal(coverageSentence(8, coverage('8', HEAD)), 'במדרגות יש כבר את החומר של 51 מתוך 147 שעות ההוראה של כיתה ח׳ (35%).');
  assert.deepEqual(GRADE_NAME, { '7': 'ז׳', '8': 'ח׳' });
  // months: consecutive ones as a range, a gap as a comma, in school order (September first)
  assert.equal(monthsText([9]), 'ספטמבר');
  assert.equal(monthsText([9, 10]), 'ספטמבר–אוקטובר');
  assert.equal(monthsText([12, 1, 2, 3]), 'דצמבר–מרץ');
  assert.equal(monthsText([12, 1, 4, 5]), 'דצמבר–ינואר, אפריל–מאי');
  assert.equal(monthsText([5, 1]), 'ינואר, מאי');
  assert.equal(monthsText([10, 9, 10]), 'ספטמבר–אוקטובר');
  // every unit's months read as Hebrew month names, with no gaps in the words
  PROGRAMME.units.forEach((u) => assert.match(monthsText(u.months), /^[\u0590-\u05FF]+(–[\u0590-\u05FF]+)?(, [\u0590-\u05FF]+(–[\u0590-\u05FF]+)?)*$/, u.id));
  assert.equal(hoursText(1), 'שעה אחת');
  assert.equal(hoursText(2), 'שעתיים');
  assert.equal(hoursText(8), '8 שעות');
  // school order: by the first month, then as the Ministry lists them; every unit once
  ['7', '8'].forEach((g) => {
    const units = coverage(g, HEAD).units;
    const ordered = inSchoolOrder(units);
    assert.equal(ordered.length, units.length);
    assert.deepEqual(new Set(ordered.map((u) => u.id)), new Set(units.map((u) => u.id)));
    const first = (u) => Math.min(...u.months.map((m) => (m >= 9 ? m - 9 : m + 3)));
    ordered.slice(1).forEach((u, i) => assert.ok(first(ordered[i]) <= first(u), `${ordered[i].id} before ${u.id}`));
  });
  assert.deepEqual(inSchoolOrder(coverage('7', HEAD).units).slice(0, 3).map((u) => u.id), ['7.1', '7.2', '7.10']);
  assert.equal(inSchoolOrder(coverage('8', HEAD).units)[0].id, '8.1');
});
