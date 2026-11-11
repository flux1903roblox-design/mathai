// The Ministry programme in code (shared/programme.js) and the coverage computed from it (shared/coverage.js).
// The fixtures are skill lists typed here, so these numbers do not move when a stage lands: the council's 33 stairs,
// HEAD's 48 (after the algebra build), stage 1's (HEAD plus signed:6, ratio:1-4 and pct:1-5), and stage 5's before the
// classroom split (stage 1 plus func:1-4, eq:6 and eq:7). The hours and the per-unit taught hours are those of the
// Ministry's תשפ״ז schedules, as the curriculum spec (§0.3) and the stage-5 spec (§0.3) checked them.
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
const BRIDGE = ['frac:1', 'frac:2', 'frac:3', 'frac:4'];

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
  },
  '8': {
    council: [0, 0, 8, 0, 0, 1, 0, 8, 1, 8, 0, 0, 3, 1, 0, 0, 0],
    head: [0, 0, 8, 0, 0, 1, 0, 8, 6, 8, 0, 0, 3, 13, 4, 0, 0],
    stage1: [8, 7, 8, 0, 0, 1, 0, 8, 6, 8, 0, 0, 3, 13, 4, 0, 0],
    // 8.7 0 → 8 (func:1-3), 8.8 stays 8 (func:4 is a 0-hour cross-listing), 8.9 6 → 12 (eq:6-7)
    s5BeforeClassroom: [8, 7, 8, 0, 0, 1, 8, 8, 12, 8, 0, 0, 3, 13, 4, 0, 0],
  },
};
// After stage 1, the hours each later stage adds (§0.3: S2 = 7.6, 7.12, 7.13, 8.4, 8.17; S3 = 7.15-7.17, 8.6, 8.10,
// 8.11, 8.16; S4 = 7.11, 8.5, 8.12, 8.13; S5 = 7.9, 7.10, 8.7, 8.9, and the 0-hour cross-listings 8.8's func:4 and
// 7.8's motion problems), and the totals after each (ז׳ 126, 139, 144, 150; ח׳ 78, 99, 133, 147).
const AFTER = { '7': { S2: 126, S3: 139, S4: 144, S5: 150 }, '8': { S2: 78, S3: 99, S4: 133, S5: 147 } };
// The stairs a later stage brings, by stage (stage5.md FUNC-8 Design 2 (d)): with stage 1's fixtures, a part that lists
// one of them is untaught, and its stage is its stairs'. So stage 1's fixtures keep their numbers while later stages
// land. Every stair a part lists exists (Design 2 (a)); a stage's part that waits for a stair not built yet lists none
// and names its stage in `later` (7.10's measuring part waits for the classroom split and angles:8).
const STAGE_OF_STAIR = Object.freeze({
  'func:1': 'S5', 'func:2': 'S5', 'func:3': 'S5', 'func:4': 'S5', 'eq:6': 'S5', 'eq:7': 'S5', 'angles:8': 'S5',
});
const STAGES = ['S2', 'S3', 'S4', 'S5'];
/** The stage that teaches a part: its `later`, or, for a part with stairs, the latest stage among its stairs (none for stage 1's). */
const stageOf = (part) => part.later || part.skills.map((s) => STAGE_OF_STAIR[s]).filter(Boolean).sort().pop() || null;
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
  assert.equal(ROADMAP_NEXT, 'S2');
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
      // a part's own months, when it has them, are school months in school order too (7.8's motion problems: June)
      for (const p of u.parts.filter((x) => x.months)) {
        const own = p.months.map((m) => (m >= 9 ? m - 9 : m + 3));
        assert.ok(p.months.length > 0 && p.months.every((m) => Number.isInteger(m) && ((m >= 9 && m <= 12) || (m >= 1 && m <= 6))), `${u.id}: a part's months`);
        assert.deepEqual(own, [...own].sort((a, b) => a - b), `${u.id}: a part's months in school order`);
      }
    }
  }
  assert.equal(sum(HOURS['7']), 150);
  assert.equal(sum(HOURS['8']), 147);
  assert.equal(coverage('7', []).hours, 150);
  assert.equal(coverage('8', []).hours, 147);
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
  assert.deepEqual(listing('8.1'), ['ratio:1', 'ratio:2', 'ratio:3', 'ratio:4']);
  assert.deepEqual(listing('8.2'), ['pct:1', 'pct:2', 'pct:3', 'pct:4', 'pct:5']);
  // one stair can serve several units
  assert.deepEqual(PROGRAMME.units.filter((u) => u.parts.some((p) => p.skills.includes('pyth:1'))).map((u) => u.id), ['7.6', '7.14', '8.3']);
  assert.ok(listing('7.9').includes('line:1'));
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

test('coverage from the four fixtures: the council\'s 33 stairs, HEAD\'s 48, stage 1, stage 5 before the classroom split', () => {
  assert.equal(COUNCIL.length, 33);
  assert.equal(HEAD.length, 48);
  assert.equal(STAGE1.length, 58);
  assert.equal(S5_BEFORE_CLASSROOM.length, 64);
  const want = { council: [COUNCIL, 53, 30], head: [HEAD, 99, 51], stage1: [STAGE1, 104, 66], s5BeforeClassroom: [S5_BEFORE_CLASSROOM, 106, 80] };
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

test('with the stage-1 stairs, every untaught part names the later stage that brings it, and the stages add up', () => {
  for (const g of ['7', '8']) {
    const c = coverage(g, STAGE1);
    let taught = c.taught;
    for (const u of c.units) {
      for (const p of u.parts.filter((x) => !x.taught)) assert.ok(STAGES.includes(stageOf(p)), `${u.id}: ${p.note || p.skills.join(', ')}`);
    }
    for (const stage of STAGES) {
      taught += sum(c.units.flatMap((u) => u.parts.filter((p) => !p.taught && stageOf(p) === stage).map((p) => p.hours)));
      assert.equal(taught, AFTER[g][stage], `grade ${g} after ${stage}`);
    }
  }
  // stage 5 before the classroom split: what is left is stages 2-4's hours, as with stage 1's stairs, and 7.10's
  // measuring part (S5, 4 hours: the classroom split takes 2 to angles:6-7, and angles:8 brings the other 2); with them
  // the programme is whole, ז׳ 150 and ח׳ 147
  for (const g of ['7', '8']) {
    const c = coverage(g, S5_BEFORE_CLASSROOM);
    const left = c.units.flatMap((u) => u.parts.filter((p) => !p.taught).map((p) => ({ id: u.id, stage: stageOf(p), hours: p.hours })));
    left.forEach((p) => assert.ok(STAGES.includes(p.stage), `${p.id} is untaught and names no later stage`));
    const stage1 = coverage(g, STAGE1).taught;
    const leftOf = (stage) => sum(left.filter((p) => p.stage === stage).map((p) => p.hours));
    assert.deepEqual(['S2', 'S3', 'S4'].map(leftOf), [AFTER[g].S2 - stage1, AFTER[g].S3 - AFTER[g].S2, AFTER[g].S4 - AFTER[g].S3], `grade ${g}: stages 2-4 keep their hours`);
    assert.deepEqual(left.filter((p) => p.stage === 'S5').map((p) => [p.id, p.hours]), g === '7' ? [['7.10', 4]] : [], `grade ${g}: S5's part left`);
    assert.equal(c.taught + sum(left.map((p) => p.hours)), AFTER[g].S5, `grade ${g}: every hour, after S5`);
  }
  for (const [stage, ids] of Object.entries(COMPLETES)) {
    assert.deepEqual(PROGRAMME.units.filter((u) => u.parts.some((p) => stageOf(p) === stage)).map((u) => u.id), ids, stage);
  }
  // a part's stage is its `later`, or its stairs' (a stage-1 stair brings none)
  assert.equal(stageOf({ hours: 2, skills: [], later: 'S3' }), 'S3');
  assert.equal(stageOf({ hours: 8, skills: ['func:1', 'func:2', 'func:3'] }), 'S5');
  assert.equal(stageOf({ hours: 5, skills: ['ratio:1'] }), null);
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
  // every stage-1 stair has a month in its own grade
  const gradeOf = (s) => (/^(signed|coord|angles|expr|eq):/.test(s) ? '7' : '8');
  STAGE1.forEach((s) => assert.equal(typeof monthIndex(s, gradeOf(s)), 'number', s));

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

test('the words every surface quotes: the coverage sentence, the months, the hours, the school order', () => {
  // one sentence, filled from coverage(): the stage-1 fixture gives the spec's own example
  assert.equal(coverageSentence('7', coverage('7', STAGE1)), 'במדרגות יש כבר את החומר של 104 מתוך 150 שעות ההוראה של כיתה ז׳ (69%).');
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
