// The safety-event writer: counts with no content, written in one batch, never failing the request that writes them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordSafety, safetyRow, SAFETY_KINDS, SAFETY_SURFACES, SAFETY_SOURCES, MAX_SAFETY_ROWS } from '../src/safety.js';
import { dayOf } from '../src/util.js';
import { makeEnv, makeCtx, rows, schemaSql } from './helpers.js';

test('the writer\'s fixed values are exactly the ones the table allows', () => {
  const sql = schemaSql().match(/CREATE TABLE IF NOT EXISTS safety_events \(([\s\S]*?)\n\);/)[1];
  const allowed = (col) => sql.match(new RegExp(`${col} TEXT NOT NULL CHECK \\(${col} IN \\(([^)]*)\\)\\)`))[1].split(',').map((s) => s.trim().replace(/'/g, ''));
  assert.deepEqual([...SAFETY_KINDS], allowed('kind'));
  assert.deepEqual([...SAFETY_SURFACES], allowed('surface'));
  assert.deepEqual([...SAFETY_SOURCES], allowed('source'));
});

test('recordSafety writes a batch of rows under ctx.waitUntil, on today\'s Jerusalem day, with no time and nothing else', async () => {
  const env = makeEnv();
  const ctx = makeCtx();
  let batches = 0;
  const batch = env.DB.batch; env.DB.batch = (list) => { batches += 1; return batch(list); };
  const p = recordSafety(env, [
    { kind: 'distress', surface: 'chat', source: 'regex', category: 'self_harm', tier: 'free' },
    { kind: 'pii_masked', surface: 'chat', source: 'server', category: 'phone' },
  ], ctx);
  await ctx.flush();
  assert.equal(await p, 2);
  assert.equal(batches, 1, 'one batch for the request');
  const got = rows(env, 'SELECT * FROM safety_events ORDER BY id');
  assert.deepEqual(got.map(({ id, ...r }) => r), [
    { day: dayOf(), kind: 'distress', category: 'self_harm', surface: 'chat', source: 'regex', tier: 'free' },
    { day: dayOf(), kind: 'pii_masked', category: 'phone', surface: 'chat', source: 'server', tier: '' },
  ]);
  assert.match(got[0].day, /^\d{4}-\d{2}-\d{2}$/, 'a day, never a time');
  // a single row works too
  assert.equal(await recordSafety(env, { kind: 'refusal', surface: 'explain', source: 'model' }), 1);
});

test('only fixed labels are stored: anything that could carry text or a person is dropped or blanked', async () => {
  const env = makeEnv();
  const n = await recordSafety(env, [
    { kind: 'distress', surface: 'chat', source: 'regex', category: 'אני רוצה למות', tier: 'free' }, // text as a category
    { kind: 'distress', surface: 'chat', source: 'regex', category: 'phone 0521234567', tier: 'student s1' },
    { kind: 'note', surface: 'chat', source: 'regex' }, // not a kind
    { kind: 'distress', surface: 'teacher', source: 'regex' }, // not a surface
    { kind: 'distress', surface: 'chat' }, // no source
    null, 'distress', 42,
    { kind: 'distress', surface: 'chat', source: 'regex', category: 'x'.repeat(21), tier: 'x'.repeat(11), student: 's1', text: 'שלום', day: '2020-01-01T10:00' },
  ]);
  assert.equal(n, 3);
  const got = rows(env, 'SELECT day, kind, category, surface, source, tier FROM safety_events ORDER BY id');
  assert.deepEqual(got.map((r) => [r.category, r.tier]), [['', 'free'], ['', ''], ['', '']]);
  for (const r of got) assert.equal(r.day, dayOf(), 'the writer sets the day itself');
  assert.doesNotMatch(JSON.stringify(got), /[֐-׿]|\d{5}|s1/);
  assert.equal(safetyRow({ kind: 'user_report', surface: 'exam', source: 'client', category: 'not_for_kids' }, '2026-11-10').category, 'not_for_kids');
});

test('recordSafety never throws or rejects: a failed write returns 0 and the request goes on', async () => {
  const env = makeEnv();
  env.DB.batch = async () => { throw new Error('D1 is down'); };
  const errors = []; const real = console.error; console.error = (...a) => errors.push(a.join(' '));
  try {
    const ctx = makeCtx();
    assert.equal(await recordSafety(env, { kind: 'distress', surface: 'chat', source: 'regex' }, ctx), 0);
    await ctx.flush();
    assert.equal(await recordSafety({}, { kind: 'distress', surface: 'chat', source: 'regex' }), 0, 'no database at all');
    assert.equal(await recordSafety(env, { kind: 'distress', surface: 'chat', source: 'regex' }, { waitUntil: () => { throw new Error('no ctx'); } }), 0);
    assert.equal(await recordSafety(env, undefined), 0);
    assert.equal(await recordSafety(env, []), 0);
  } finally { console.error = real; }
  assert.ok(errors.every((e) => e === 'safety_events: not recorded'), 'the log line carries nothing from the request');
});

test('one call writes at most MAX_SAFETY_ROWS rows', async () => {
  const env = makeEnv();
  const many = Array.from({ length: MAX_SAFETY_ROWS + 5 }, () => ({ kind: 'link_removed', surface: 'chat', source: 'server' }));
  assert.equal(await recordSafety(env, many), MAX_SAFETY_ROWS);
  assert.equal(rows(env, 'SELECT * FROM safety_events').length, MAX_SAFETY_ROWS);
});
