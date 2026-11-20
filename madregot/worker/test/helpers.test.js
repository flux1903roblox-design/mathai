// The test helpers other tests lean on: the system-prompt reader and the device key.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRequest, AI_KINDS } from '../../shared/ai.js';
import { devKey } from '../src/util.js';
import { systemText, devOf, makeEnv, INPUT, DEVICE } from './helpers.js';

test('systemText reads the system prompt as one string or as a list of text blocks', () => {
  assert.equal(systemText({ system: 'אחד' }), 'אחד');
  assert.equal(systemText({ system: [{ type: 'text', text: 'safety', cache_control: { type: 'ephemeral' } }, { type: 'text', text: 'task' }, { type: 'text', text: 'context' }] }),
    'safety\n\ntask\n\ncontext');
  assert.equal(systemText({ system: ['a', { type: 'text', text: '' }, { type: 'text', text: 'b' }] }), 'a\n\nb');
  assert.equal(systemText({}), ''); assert.equal(systemText(undefined), '');
  for (const kind of AI_KINDS) {
    const p = buildRequest(kind, INPUT[kind], { model: 'claude-sonnet-5-5' });
    assert.ok(systemText(p).length > 100, kind);
    assert.equal(systemText(p), typeof p.system === 'string' ? p.system : p.system.map((b) => b.text).join('\n\n'), kind);
  }
});

test('devOf gives the same key as the Worker\'s devKey', async () => {
  const env = makeEnv();
  assert.equal(await devOf(env), await devKey(env, DEVICE));
  assert.equal(await devOf(env, 'b'.repeat(32)), await devKey(env, 'b'.repeat(32)));
  assert.notEqual(await devOf(env, 'b'.repeat(32)), await devOf(env));
});
