// Cloudflare's runtime reads every named export of a Worker's main module as an entry point and refuses to start one
// whose main module exports a plain value ("Incorrect type for map entry 'CLASS_MAX_STUDENTS': the provided value is not of
// type 'function or ExportedHandler'"): `wrangler dev` stopped there, and a deploy is checked the same way. src/index.js
// exports its default handler and nothing else; shared limits live in src/caps.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('the Worker\'s main module exports only its default handler (fetch and scheduled)', async () => {
  const mod = await import('../src/index.js');
  assert.deepEqual(Object.keys(mod), ['default']);
  assert.equal(typeof mod.default.fetch, 'function');
  assert.equal(typeof mod.default.scheduled, 'function');
});
