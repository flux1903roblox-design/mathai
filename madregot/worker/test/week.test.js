// shared/week.js and shared/stairs.js, read by the Worker (the weekly email, PARENTS-7): the same fixture week as the
// web's learn/report.test.ts gives the same WeekReport here, so the email and the parent's page cannot disagree.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { weekFrom, weekStart, weekDays } from '../../shared/week.js';
import { stairName, STAIR_NAMES, TOPIC_NAMES } from '../../shared/stairs.js';
import { texToPlain } from '../../shared/plain.js';

const fixture = JSON.parse(readFileSync(new URL('../../shared/week.fixture.json', import.meta.url), 'utf8'));

test('the fixture week gives the same WeekReport as on the web', () => {
  assert.deepEqual(weekFrom(fixture.rows, fixture.start, fixture.today), fixture.expected);
  const rest = new Set(fixture.restDays);
  const w = weekFrom(fixture.rows, fixture.start, fixture.today, (d) => rest.has(d));
  assert.deepEqual(w.days.map((d) => d.rest), fixture.expectedRest);
});

test('the week runs Sunday to Saturday whatever the Worker\'s clock zone', () => {
  assert.equal(weekStart('2026-11-14'), '2026-11-08');
  assert.deepEqual(weekDays('2026-11-08'), ['2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14']);
});

test('stair names for the email: a known stair in full, an unknown id null', () => {
  assert.equal(stairName('signed:1'), 'מספרים מכוונים: חיבור וחיסור');
  assert.equal(stairName('sys:5'), 'משוואות ומערכות: אי־שוויונות');
  assert.equal(stairName('zz:1'), null);
  assert.equal(stairName('toString'), null);
  for (const id of Object.keys(STAIR_NAMES)) assert.ok(TOPIC_NAMES[id.split(':')[0]], id);
});

test('plain-text maths without isolates (a CSV cell) and with them (a report line)', () => {
  assert.equal(texToPlain('$(-3) \\cdot (-4) = -12$', { isolate: false }), '(−3) · (−4) = −12');
  assert.equal(texToPlain('$m x_1$'), '⁦m x₁⁩');
});
