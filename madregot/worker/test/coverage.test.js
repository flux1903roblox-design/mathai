// The Ministry programme in code (shared/programme.js) and the coverage computed from it (shared/coverage.js).
// The fixtures are skill lists typed here, so these numbers do not move when a stage lands: the council's 33 stairs,
// HEAD's 48 (after the algebra build), and stage 1's (HEAD plus signed:6, ratio:1-4 and pct:1-5). The hours and the
// per-unit taught hours are those of the Ministry's תשפ״ז schedules, as the curriculum spec checked them (§0.3).
import test from 'node:test';
import assert from 'node:assert/strict';
import { PROGRAMME, ROADMAP_NEXT } from '../../shared/programme.js';
import { coverage, notYet, monthIndex, schoolMonth, coverageSentence, monthsText, hoursText, inSchoolOrder, GRADE_NAME } from '../../shared/coverage.js';

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
const BRIDGE = ['frac:1', 'frac:2', 'frac:3', 'frac:4'];
// Curriculum stage 3 (data and probability): its ten stairs, all listed by the programme now (7.15-7.17, 8.6 and the
// first half of 8.16 list data:1-4; 8.10 and 8.11 list stats:6-8; the rest of 8.16 lists prob:1-3).
const STAGE3 = [
  'data:1', 'data:2', 'data:3', 'data:4',
  'stats:6', 'stats:7', 'stats:8',
  'prob:1', 'prob:2', 'prob:3',
];

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
  },
  '8': {
    council: [0, 0, 8, 0, 0, 1, 0, 8, 1, 8, 0, 0, 3, 1, 0, 0, 0],
    head: [0, 0, 8, 0, 0, 1, 0, 8, 6, 8, 0, 0, 3, 13, 4, 0, 0],
    stage1: [8, 7, 8, 0, 0, 1, 0, 8, 6, 8, 0, 0, 3, 13, 4, 0, 0],
  },
};
// With the stairs built so far (stage 1 and all of stage 3), what is taught, and the hours each later stage still adds
// (§0.3: S2 = 7.6, 7.12, 7.13, 8.4, 8.17; S3 nothing left; S4 = 7.11, 8.5, 8.12, 8.13;
// S5 = 7.9, 7.10, 8.7, 8.9), and the totals after each. ז׳'s S3 units (7.15-7.17) are taught by data:1-4: 104 + 13 = 117,
// and the roadmap's ז׳ totals hold (139 after S2, 144, 150). ח׳ learns the data unit too this year: 8.6 (7 h, data:1-3)
// and "הסתברות א" in 8.16 (2 h, data:4), 66 + 9 = 75; stats:6-8 teach the rest of 8.10 (4 h) and 8.11 (4 h), 83; prob:1-3
// "הסתברות ב", the 4 h left of 8.16, 87; S2 still adds 12 (99), S3 nothing (99), and 133 and 147 hold.
const BASE = { '7': 117, '8': 87 };
const AFTER = { '7': { S2: 139, S3: 139, S4: 144, S5: 150 }, '8': { S2: 99, S3: 99, S4: 133, S5: 147 } };
const COMPLETES = {
  S2: ['7.6', '7.12', '7.13', '8.4', '8.17'],
  S3: [],
  S4: ['7.11', '8.5', '8.12', '8.13'],
  S5: ['7.9', '7.10', '8.7', '8.9'],
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
      assert.ok(u.parts.every((p) => Number.isInteger(p.hours) && p.hours > 0), u.id);
    }
  }
  assert.equal(sum(HOURS['7']), 150);
  assert.equal(sum(HOURS['8']), 147);
  assert.equal(coverage('7', []).hours, 150);
  assert.equal(coverage('8', []).hours, 147);
});

test('every stair a part lists is one of stage 1\'s or stage 3\'s; a part with none is a later stage\'s, with a note', () => {
  const known = new Set([...STAGE1, ...STAGE3]);
  for (const { unit, part } of allParts) {
    if (part.skills.length) {
      part.skills.forEach((s) => assert.ok(known.has(s), `${unit.id} lists ${s}, which is not a stage-1 or stage-3 stair`));
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
    { hours: 6, skills: [], note: 'שאלות תנועה, משתנה במכנה, משוואות בעזרת פרופורציה', later: 'S5' },
  ]);
});

test('no part lists a bridge stair: elementary fractions add no hours', () => {
  for (const { unit, part } of allParts) assert.ok(part.skills.every((s) => !s.startsWith('frac:')), unit.id);
  for (const g of ['7', '8']) assert.equal(coverage(g, [...STAGE1, ...BRIDGE]).taught, coverage(g, STAGE1).taught);
});

test('coverage from the three fixtures: the council\'s 33 stairs, HEAD\'s 48, stage 1', () => {
  assert.equal(COUNCIL.length, 33);
  assert.equal(HEAD.length, 48);
  assert.equal(STAGE1.length, 58);
  const want = { council: [COUNCIL, 53, 30], head: [HEAD, 99, 51], stage1: [STAGE1, 104, 66] };
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
  // an empty part is never taught, whatever the app has
  assert.equal(at('8', [...STAGE1, 'func:1', 'func:2'], '8.7').taught, 0);
});

test('stage 3 complete: ז׳ 117 of 150 (78%), ח׳ 87 of 147 (59%); 7.15-7.17, 8.6, 8.10, 8.11 and 8.16 taught', () => {
  const c7 = coverage('7', [...STAGE1, ...STAGE3]); const c8 = coverage('8', [...STAGE1, ...STAGE3]);
  assert.deepEqual([c7.taught, c7.pct, c8.taught, c8.pct], [117, 78, 87, 59]);
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

test('with the stairs built so far, every untaught part names the later stage that brings it, and the stages add up', () => {
  for (const g of ['7', '8']) {
    const c = coverage(g, [...STAGE1, ...STAGE3]);
    let taught = c.taught;
    assert.equal(taught, BASE[g], `grade ${g} now`);
    for (const u of c.units) {
      for (const p of u.parts.filter((x) => !x.taught)) assert.ok(['S2', 'S3', 'S4', 'S5'].includes(p.later), `${u.id}: ${p.note}`);
    }
    for (const stage of ['S2', 'S3', 'S4', 'S5']) {
      taught += sum(c.units.flatMap((u) => u.parts.filter((p) => !p.taught && p.later === stage).map((p) => p.hours)));
      assert.equal(taught, AFTER[g][stage], `grade ${g} after ${stage}`);
    }
  }
  for (const [stage, ids] of Object.entries(COMPLETES)) {
    assert.deepEqual(PROGRAMME.units.filter((u) => u.parts.some((p) => p.later === stage)).map((u) => u.id), ids, stage);
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
