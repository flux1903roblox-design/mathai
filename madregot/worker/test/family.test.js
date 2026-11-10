// Linking a child's device to a family plan (spec §3.3): the code on the child's device, the parent's claim, the token
// collected once, the same-device shortcut, the 3-device limit, unlinking and leaving, and what a family-device token
// can never do. Claude and the email service are stubbed; every address is synthetic.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  setup, ai, signIn, accountId, insertSub, linkDevice, setCount, netOf, rows, one, countOf, advanceClock, DEVICE,
} from './helpers.js';

let h;
afterEach(() => h?.done());
const SECRET = 'b'.repeat(32);
const sha = (s) => createHash('sha256').update(s).digest('hex');

async function start(device = DEVICE, secret = SECRET, ip) {
  const r = await h.call('POST', '/api/family/link/start', { headers: { 'X-Device': device }, body: { secret }, ip });
  return { status: r.status, body: await r.json(), secret };
}
const finish = (code, secret = SECRET, ip) => h.call('POST', '/api/family/link/finish', { body: { code, secret }, ip });
const claim = (token, code, label) => h.call('POST', '/api/family/link/claim', { headers: { 'X-Account-Token': token }, body: { code, ...(label === undefined ? {} : { label }) } });
async function parent(email = 'parent@example.test', { plan = true } = {}) {
  const token = await signIn(h, email);
  const a = accountId(h.env, email);
  if (plan) insertSub(h.env, { kind: 'family', account_id: a });
  return { token, a };
}

test('link start returns a 6-character code and a /parents/link url; limited per device and per network', async () => {
  h = await setup();
  const s = await start();
  assert.equal(s.status, 201);
  assert.match(s.body.code, /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
  assert.equal(s.body.url, `https://madregot.example.test/parents/link?c=${s.body.code}`);
  const left = Date.parse(s.body.expiresAt) - Date.now();
  assert.ok(left > 59 * 60_000 && left <= 60 * 60_000, 'valid 60 minutes');
  // only hashes are stored: the code is an HMAC, the secret and the device are SHA-256
  const row = one(h.env, 'SELECT * FROM link_codes');
  assert.notEqual(row.code_hash, s.body.code); assert.equal(row.secret_hash, sha(SECRET)); assert.equal(row.device_hint, sha(DEVICE));
  assert.ok(!JSON.stringify(rows(h.env, 'SELECT * FROM link_codes')).includes(s.body.code));
  // no device id, or a bad secret
  assert.equal((await h.call('POST', '/api/family/link/start', { body: { secret: SECRET } })).status, 400);
  assert.equal((await start(DEVICE, 'short')).status, 400);
  // 10 a day per device
  for (let i = 1; i < 10; i++) assert.equal((await start()).status, 201, `start ${i + 1}`);
  const capped = await start();
  assert.equal(capped.status, 429); assert.equal(capped.body.error, 'too_many_links');
  assert.equal((await start('c'.repeat(32))).status, 201, 'another device on the same network');
  // 200 a day per network
  await setCount(h.env, `link:n:${await netOf(h.env)}`, 200);
  assert.equal((await start('d'.repeat(32))).status, 429);
  assert.equal((await start('d'.repeat(32), SECRET, '198.51.100.9')).status, 201, 'another network');
});

test('claim needs a signed-in account with a live family plan (402 otherwise)', async () => {
  h = await setup();
  const { body: { code } } = await start();
  assert.equal((await h.call('POST', '/api/family/link/claim', { body: { code } })).status, 401);
  const { token, a } = await parent('noplan@example.test', { plan: false });
  const r = await claim(token, code);
  assert.equal(r.status, 402); assert.equal((await r.json()).error, 'needs_subscription');
  // an ended plan is not live; a canceled plan still running is
  insertSub(h.env, { kind: 'family', account_id: a, status: 'ended', end: new Date(Date.now() - 1000).toISOString() });
  assert.equal((await claim(token, code)).status, 402);
  insertSub(h.env, { kind: 'family', account_id: a, status: 'canceled', cancel_at_period_end: 1 });
  assert.equal((await claim(token, code)).status, 200);
});

test('claim links the device and queues one device_linked email; finish returns the token exactly once', async () => {
  h = await setup();
  const { body: { code } } = await start();
  const w = await finish(code);
  assert.equal(w.status, 202); assert.deepEqual(await w.json(), { state: 'waiting' });
  const { token, a } = await parent();
  const c = await claim(token, code.toLowerCase(), '  הטאבלט\u0007 של נועה  ');
  assert.equal(c.status, 200);
  const cb = await c.json();
  assert.equal(cb.ok, true); assert.equal(cb.device.label, 'הטאבלט של נועה');
  // the same parent again (a refreshed page) gets the same device; nothing new is made
  assert.deepEqual(await (await claim(token, code)).json(), cb);
  assert.equal(rows(h.env, 'SELECT * FROM family_devices').length, 1);
  const dev = one(h.env, 'SELECT * FROM family_devices');
  assert.equal(dev.token_hash, null, 'no token until the device collects it');
  assert.equal(rows(h.env, "SELECT * FROM notices WHERE kind LIKE 'device_linked:%'").length, 1);
  await h.ctx.flush();
  const mail = h.net.log.email.filter((m) => m.subject === 'מכשיר חדש חובר למנוי');
  assert.equal(mail.length, 1);
  assert.deepEqual(mail[0].to, ['parent@example.test']);
  assert.match(mail[0].text, /חובר מכשיר חדש \(הטאבלט של נועה\) ב־/);
  assert.match(mail[0].text, /https:\/\/madregot\.example\.test\/parents/);
  assert.equal(mail[0].reply_to, 'hello@example.test');
  assert.ok(one(h.env, "SELECT * FROM audit_log WHERE action = 'device.link'"));

  const f = await finish(code);
  assert.equal(f.status, 200);
  const fb = await f.json();
  assert.match(fb.deviceToken, /^fd1\.[a-f0-9]{64}$/);
  assert.equal(fb.label, 'הטאבלט של נועה');
  assert.equal(one(h.env, 'SELECT token_hash FROM family_devices').token_hash, sha(fb.deviceToken));
  const again = await finish(code);
  assert.equal(again.status, 410, 'the token is returned once');
  assert.ok(!JSON.stringify(await again.json()).includes('fd1.'));
  // the token works for the AI, on the family plan
  const r = await ai(h, 'check', { 'X-Family-Device': fb.deviceToken, 'X-Device': DEVICE });
  assert.equal(r.status, 200); assert.equal(r.headers.get('X-AI-Tier'), 'family');
  assert.equal(countOf(h.env, `fam:${a}:check`), 1);
  const page = await (await h.call('GET', '/api/account', { headers: { 'X-Account-Token': token } })).json();
  assert.deepEqual(page.devices.map((d) => d.label), ['הטאבלט של נועה']);
});

test('two collections at once: only one gets the token', async () => {
  h = await setup();
  const { body: { code } } = await start();
  const { token } = await parent();
  await claim(token, code);
  const res = await Promise.all([finish(code), finish(code), finish(code)]);
  assert.deepEqual(res.map((r) => r.status).sort(), [200, 410, 410]);
});

test('finish with a wrong secret never returns a token; polling is limited per code and per network', async () => {
  h = await setup();
  const { body: { code } } = await start();
  const { token } = await parent();
  await claim(token, code);
  const wrong = await finish(code, 'e'.repeat(32));
  assert.equal(wrong.status, 404); assert.equal((await wrong.json()).error, 'link_not_found');
  assert.equal((await finish('ZZZZZZ')).status, 404);
  assert.equal((await finish('not a code')).status, 404);
  assert.equal(one(h.env, 'SELECT token_hash FROM family_devices').token_hash, null);
  // 400 polls per code a day
  const ch = one(h.env, 'SELECT code_hash FROM link_codes').code_hash;
  await setCount(h.env, `linkpoll:${ch.slice(0, 16)}`, 400);
  const slow = await finish(code);
  assert.equal(slow.status, 429); assert.equal((await slow.json()).error, 'slow_down');
  // 5000 a day per network
  await setCount(h.env, `linkpoll:${ch.slice(0, 16)}`, 0);
  await setCount(h.env, `linkpoll:n:${await netOf(h.env)}`, 5000);
  assert.equal((await finish(code)).status, 429);
  assert.equal((await finish(code, SECRET, '198.51.100.20')).status, 200);
});

test('a link code expires after 60 minutes (410) and cannot be claimed twice', async () => {
  h = await setup();
  const first = await start();
  const second = await start();
  const p1 = await parent('one@example.test');
  const p2 = await parent('two@example.test');
  assert.equal((await claim(p1.token, second.body.code)).status, 200);
  const used = await claim(p2.token, second.body.code);
  assert.equal(used.status, 409); assert.equal((await used.json()).error, 'link_used');
  // two parents claim one code at the same moment: exactly one wins
  const third = await start();
  const both = await Promise.all([claim(p1.token, third.body.code), claim(p2.token, third.body.code)]);
  assert.deepEqual(both.map((r) => r.status).sort(), [200, 409]);
  assert.equal(rows(h.env, 'SELECT * FROM link_codes WHERE claimed_at IS NOT NULL').length, 2);
  advanceClock(61 * 60_000);
  const late = await claim(p1.token, first.body.code);
  assert.equal(late.status, 410); assert.equal((await late.json()).error, 'link_expired');
  assert.equal((await finish(first.body.code)).status, 410);
  // a claimed code gives the child's device 15 minutes to collect, even near the end of the hour
  assert.equal((await finish(second.body.code)).status, 410, 'claimed 61 minutes ago and never collected');
});

test('a claimed code can be collected for 15 minutes after the claim, even at the end of the hour', async () => {
  h = await setup();
  const { body: { code } } = await start();
  const { token } = await parent();
  advanceClock(55 * 60_000);
  assert.equal((await claim(token, code)).status, 200);
  advanceClock(10 * 60_000);
  assert.equal((await finish(code)).status, 200);
});

test('a 4th device is 409 device_limit with the device list', async () => {
  h = await setup();
  const { token, a } = await parent();
  await linkDevice(h.env, a, 'הטאבלט');
  await linkDevice(h.env, a, 'הטלפון');
  const one3 = await start();
  assert.equal((await claim(token, one3.body.code, 'המחשב')).status, 200, 'a pending claim counts');
  const four = await start('f'.repeat(32));
  const r = await claim(token, four.body.code);
  assert.equal(r.status, 409);
  const b = await r.json();
  assert.equal(b.error, 'device_limit');
  assert.deepEqual(b.devices.map((d) => [d.label, !!d.pending]), [['הטאבלט', false], ['הטלפון', false], ['המחשב', true]],
    'every device that counts, for the parent to choose one to unlink');
  assert.ok(b.devices.every((d) => d.id && d.linkedAt && d.lastSeen));
  // a pending device can be unlinked too, which frees its place
  const pending = b.devices.find((d) => d.pending);
  assert.equal((await h.call('POST', `/api/family/devices/${pending.id}/unlink`, { headers: { 'X-Account-Token': token }, body: {} })).status, 200);
  assert.equal((await finish(one3.body.code)).status, 404, 'its code is gone with it');
  assert.equal((await claim(token, four.body.code, 'המחשב')).status, 200);
  // the same-device shortcut is limited the same way
  const t = await h.call('POST', '/api/family/devices/this', { headers: { 'X-Account-Token': token, 'X-Device': DEVICE }, body: {} });
  assert.equal(t.status, 409); assert.equal((await t.json()).error, 'device_limit');
  // two codes claimed at once against the last free place: one wins
  h.env.DB.raw.prepare("DELETE FROM family_devices WHERE label = 'המחשב'").run();
  const x = await start('1'.repeat(32)); const y = await start('2'.repeat(32));
  const both = await Promise.all([claim(token, x.body.code), claim(token, y.body.code)]);
  assert.deepEqual(both.map((res) => res.status).sort(), [200, 409]);
  assert.equal(rows(h.env, 'SELECT * FROM family_devices WHERE account_id = ?', a).length, 3);
});

test('devices/this links the device in the parent\'s hand and deletes the session that asked', async () => {
  h = await setup();
  const { token } = await parent();
  const other = await signIn(h, 'parent@example.test');
  assert.equal((await h.call('POST', '/api/family/devices/this', { headers: { 'X-Account-Token': token }, body: {} })).status, 400, 'needs X-Device');
  const r = await h.call('POST', '/api/family/devices/this', { headers: { 'X-Account-Token': token, 'X-Device': DEVICE }, body: { label: 'הטאבלט' } });
  assert.equal(r.status, 200);
  const b = await r.json();
  assert.match(b.deviceToken, /^fd1\.[a-f0-9]{64}$/); assert.equal(b.label, 'הטאבלט');
  assert.equal((await h.call('GET', '/api/account', { headers: { 'X-Account-Token': token } })).status, 401, 'the session on this device is gone');
  assert.equal((await h.call('GET', '/api/account', { headers: { 'X-Account-Token': other } })).status, 200, 'the parent\'s other sessions stay');
  assert.equal(one(h.env, 'SELECT token_hash FROM family_devices').token_hash, sha(b.deviceToken));
  assert.equal(rows(h.env, "SELECT * FROM notices WHERE kind LIKE 'device_linked:%'").length, 1);
  const ai1 = await ai(h, 'explain', { 'X-Family-Device': b.deviceToken, 'X-Device': DEVICE });
  assert.equal(ai1.headers.get('X-AI-Tier'), 'family');
  // without a live plan: 402
  const { token: t2 } = await parent('late@example.test', { plan: false });
  assert.equal((await h.call('POST', '/api/family/devices/this', { headers: { 'X-Account-Token': t2, 'X-Device': DEVICE }, body: {} })).status, 402);
});

test('a family-device token is refused by account, billing, claim and unlink routes; the status shows no email or plan', async () => {
  h = await setup();
  const { a } = await parent('private@example.test');
  const dev = await linkDevice(h.env, a, 'הטאבלט');
  const fd = { ...dev.headers, 'X-Device': DEVICE };
  const { body: { code } } = await start();
  for (const [m, p, body] of [
    ['GET', '/api/account'], ['GET', '/api/account/export'], ['POST', '/api/account/delete', { confirm: 'DELETE' }],
    ['POST', '/api/billing/checkout', { plan: 'family_month', adult: true, terms: '2026-11' }], ['POST', '/api/billing/cancel', { subscriptionId: 'x' }],
    ['GET', '/api/billing/portal'], ['POST', '/api/family/link/claim', { code }], ['POST', `/api/family/devices/${dev.id}/unlink`, {}],
    ['POST', '/api/family/devices/this', {}],
  ]) {
    const r = await h.call(m, p, { headers: { ...fd, 'Idempotency-Key': 'family-device-key-0001' }, body });
    assert.equal(r.status, 401, p); assert.equal((await r.json()).error, 'not_account', p);
  }
  const s = await h.call('GET', '/api/ai/status', { headers: fd });
  const text = await s.text();
  assert.deepEqual(JSON.parse(text).linked, { label: 'הטאבלט' });
  assert.doesNotMatch(text, /@|family_month|priceAgorot|₪/);
  assert.equal(rows(h.env, 'SELECT * FROM family_devices').length, 1, 'nothing was unlinked');
});

test('after unlink or leave the device is back on the free taste, and its old token is reported unlinked', async () => {
  h = await setup();
  const { token, a } = await parent();
  const d1 = await linkDevice(h.env, a, 'הטאבלט');
  const d2 = await linkDevice(h.env, a, 'הטלפון');
  // the parent unlinks the tablet; another parent cannot
  const { token: stranger } = await parent('stranger@example.test');
  assert.equal((await h.call('POST', `/api/family/devices/${d1.id}/unlink`, { headers: { 'X-Account-Token': stranger }, body: {} })).status, 404);
  const u = await h.call('POST', `/api/family/devices/${d1.id}/unlink`, { headers: { 'X-Account-Token': token }, body: {} });
  assert.deepEqual(await u.json(), { ok: true });
  const r1 = await ai(h, 'explain', { ...d1.headers, 'X-Device': DEVICE });
  assert.equal(r1.status, 200);
  assert.equal(r1.headers.get('X-AI-Tier'), 'free'); assert.equal(r1.headers.get('X-AI-Linked'), '0');
  assert.equal(countOf(h.env, `free:d:${DEVICE}`), 1);
  assert.equal((await ai(h, 'check', { ...d1.headers, 'X-Device': DEVICE })).status, 402);
  // the phone leaves by itself (as "delete all data" does); a second leave is the same answer
  const l = await h.call('POST', '/api/family/devices/leave', { headers: d2.headers, body: {} });
  assert.deepEqual(await l.json(), { ok: true });
  assert.deepEqual(await (await h.call('POST', '/api/family/devices/leave', { headers: d2.headers, body: {} })).json(), { ok: true });
  assert.equal((await h.call('POST', '/api/family/devices/leave', { body: {} })).status, 400);
  const st = await (await h.call('GET', '/api/ai/status', { headers: { ...d2.headers, 'X-Device': 'c'.repeat(32) } }));
  assert.equal(st.headers.get('X-AI-Linked'), '0');
  const sb = await st.json();
  assert.equal(sb.tier, 'free'); assert.equal(sb.linked, null);
  assert.equal(rows(h.env, 'SELECT * FROM family_devices').length, 0);
  assert.deepEqual(rows(h.env, "SELECT action, actor FROM audit_log WHERE action = 'device.unlink' ORDER BY id").map((x) => x.actor), [`account:${a}`, `device:${d2.id}`]);
});
