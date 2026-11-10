// Sign-in by email code and sessions: HMAC-keyed codes, atomic tries, single use, send caps, session rules, step-up.
// The email service is stubbed; every address is synthetic.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { sixDigits } from '../src/account.js';
import { hmacHex } from '../src/util.js';
import {
  setup, signIn, accountId, codeFromEmail, setCount, netOf, linkDevice, insertSub, rows, one, advanceClock,
} from './helpers.js';

let h;
afterEach(() => h?.done());
const sendCode = (email, opts = {}) => h.call('POST', '/api/account/code', { body: { email }, ...opts });
const verify = (email, code, headers = {}) => h.call('POST', '/api/account/verify', { body: { email, code }, headers });
const other = (code) => (code === '000000' ? '111111' : '000000');

test('code: the same reply for a new and a known address; the email holds the code; login_codes keeps only HMACs', async () => {
  h = await setup();
  const fresh = await sendCode('new@example.test');
  await signIn(h, 'known@example.test');
  h.env.DB.raw.prepare('DELETE FROM login_codes').run();
  const known = await sendCode('Known@Example.test ');
  assert.equal(fresh.status, 200); assert.equal(known.status, 200);
  assert.deepEqual(await fresh.json(), await known.json());
  const msg = h.net.log.email.at(-1);
  assert.deepEqual(msg.to, ['known@example.test']);
  assert.match(codeFromEmail(msg), /^\d{6}$/);
  assert.equal(msg.reply_to, 'hello@example.test');
  const stored = JSON.stringify(rows(h.env, 'SELECT * FROM login_codes'));
  assert.doesNotMatch(stored, /example\.test/);
  assert.doesNotMatch(stored, new RegExp(codeFromEmail(msg)));
  assert.equal(one(h.env, 'SELECT email_hash FROM login_codes').email_hash, await hmacHex(h.env.AUTH_SECRET, 'known@example.test'));
  assert.equal(rows(h.env, "SELECT * FROM accounts WHERE email = 'new@example.test'").length, 0, 'an address that never signed in is not stored');
});

test('code: a 60-second wait to resend, 5 per address from one network, 15 per address, 40 per network, a global cap', async () => {
  h = await setup();
  assert.equal((await sendCode('a@example.test')).status, 200);
  const wait = await sendCode('a@example.test');
  assert.equal(wait.status, 429);
  const w = await wait.json();
  assert.equal(w.error, 'wait_to_resend'); assert.ok(w.retryAfter > 0 && w.retryAfter <= 60);
  for (let i = 0; i < 4; i++) { advanceClock(61_000); assert.equal((await sendCode('a@example.test')).status, 200); }
  advanceClock(61_000);
  const sixth = await sendCode('a@example.test');
  assert.equal(sixth.status, 429); assert.equal((await sixth.json()).error, 'too_many_codes');
  // the same address from other networks: 15 in all
  for (let i = 0; i < 10; i++) { advanceClock(61_000); assert.equal((await sendCode('a@example.test', { ip: `198.51.100.${100 + Math.floor(i / 5)}` })).status, 200, `send ${i}`); }
  advanceClock(61_000);
  assert.equal((await sendCode('a@example.test', { ip: '198.51.100.120' })).status, 429, 'the 16th to one address');
  await setCount(h.env, `mail:n:${await netOf(h.env)}`, 40);
  assert.equal((await sendCode('b@example.test')).status, 429);
  assert.equal((await sendCode('b@example.test', { ip: '198.51.100.20' })).status, 200);
  await setCount(h.env, 'mail:all', 3000);
  const full = await sendCode('c@example.test', { ip: '198.51.100.21' });
  assert.equal(full.status, 429);
  assert.equal(rows(h.env, "SELECT * FROM notices WHERE kind LIKE 'owner:mail_cap:%'").length, 1, 'the owner hears that sign-in stopped');
  await sendCode('d@example.test', { ip: '198.51.100.22' });
  assert.equal(rows(h.env, "SELECT * FROM notices WHERE kind LIKE 'owner:mail_cap:%'").length, 1, 'once a day');
  assert.equal(h.net.log.email.length, 16);
});

test('code: the global cap is a var (MAIL_DAILY_CAP); IPv6 counts by its /48, so 25 /64s of one allocation share one network cap', async () => {
  h = await setup({ MAIL_DAILY_CAP: '5000' });
  let sent = 0;
  for (let net = 0; net < 25; net++) {
    for (let i = 0; i < 4; i++) {
      const r = await sendCode(`x${net}-${i}@example.test`, { ip: `2001:db8:0:${net.toString(16)}::${i + 1}` });
      if (r.status === 200) sent++;
    }
  }
  assert.equal(sent, 40, 'one /48 sends 40 codes a day, however many /64s it has');
  const other = await sendCode('parent@example.test', { ip: '2001:db8:1:1::1' });
  assert.equal(other.status, 200, 'another allocation is not affected');
  await setCount(h.env, 'mail:all', 4999);
  assert.equal((await sendCode('one-more@example.test', { ip: '203.0.113.60' })).status, 200);
  assert.equal((await sendCode('too-many@example.test', { ip: '203.0.113.61' })).status, 429);
});

test('verify: a stranger who knows the address cannot lock its owner out (30 wrong codes a day per network)', async () => {
  h = await setup();
  const victim = 'parent@example.test';
  const attacker = '198.51.100.9';
  const guess = () => h.call('POST', '/api/account/verify', { body: { email: victim, code: '000000' }, ip: attacker });
  // the attacker asks for codes (they go to the victim) and sends wrong ones after each: 5 sends, 25 wrong codes
  for (let i = 0; i < 5; i++) {
    assert.equal((await sendCode(victim, { ip: attacker })).status, 200);
    for (let k = 0; k < 5; k++) assert.equal((await guess()).status, 403);
    advanceClock(61_000);
  }
  assert.equal((await sendCode(victim, { ip: attacker })).status, 429, 'its 5 sends to that address are used up');
  // the victim's own sends are untouched; the attacker can still spoil one code with its last 5 wrong codes...
  assert.equal((await sendCode(victim, { ip: '203.0.113.50' })).status, 200);
  for (let k = 0; k < 5; k++) assert.equal((await guess()).status, 403);
  // ...and is stopped there: the victim's next code is safe from that network for the rest of the day
  advanceClock(61_000);
  assert.equal((await sendCode(victim, { ip: '203.0.113.50' })).status, 200);
  const code = codeFromEmail(h.net.log.email.at(-1));
  const late = await guess();
  assert.equal(late.status, 429); assert.equal((await late.json()).error, 'too_many_tries');
  assert.equal(one(h.env, 'SELECT tries FROM login_codes').tries, 0, 'the stopped network spent no try of the new code');
  const ok = await h.call('POST', '/api/account/verify', { body: { email: victim, code }, ip: '203.0.113.50' });
  assert.equal(ok.status, 200);
});

test('verify: a right code, an expired code or no code at all never counts against the network', async () => {
  h = await setup();
  const net = await netOf(h.env);
  await sendCode('fine@example.test');
  const code = codeFromEmail(h.net.log.email.at(-1));
  await verify('nobody@example.test', '123456');
  assert.equal((await verify('fine@example.test', code)).status, 200);
  assert.equal(rows(h.env, 'SELECT count FROM ai_usage WHERE who = ?', `verify:n:${net}`)[0]?.count || 0, 0);
  advanceClock(61_000);
  await sendCode('fine@example.test');
  await verify('fine@example.test', '000000');
  assert.equal(rows(h.env, 'SELECT count FROM ai_usage WHERE who = ?', `verify:n:${net}`)[0].count, 1);
});

test('verify: a wrong code counts down; 5 wrong end the code; 10 parallel wrong guesses never pass 5 tries', async () => {
  h = await setup();
  await sendCode('p@example.test');
  const code = codeFromEmail(h.net.log.email.at(-1));
  const wrong = await verify('p@example.test', other(code));
  assert.equal(wrong.status, 403);
  assert.deepEqual(await wrong.json(), { error: 'wrong_code', message: 'wrong_code', left: 4 });
  for (let i = 0; i < 4; i++) await verify('p@example.test', other(code));
  const locked = await verify('p@example.test', code);
  assert.equal(locked.status, 429); assert.equal((await locked.json()).error, 'too_many_tries');

  advanceClock(61_000);
  await sendCode('p@example.test');
  const code2 = codeFromEmail(h.net.log.email.at(-1));
  const guesses = await Promise.all(Array.from({ length: 10 }, () => verify('p@example.test', other(code2))));
  assert.equal(guesses.filter((r) => r.status === 403).length, 5);
  assert.equal(guesses.filter((r) => r.status === 429).length, 5);
  assert.equal(one(h.env, 'SELECT tries FROM login_codes').tries, 5);
  assert.equal((await verify('p@example.test', code2)).status, 429, 'even the right code is too late');
});

test('verify: an expired code is 410 code_expired; a used code fails the second time', async () => {
  h = await setup();
  await sendCode('e@example.test');
  const code = codeFromEmail(h.net.log.email.at(-1));
  advanceClock(11 * 60_000);
  assert.equal((await verify('e@example.test', code)).status, 410);
  advanceClock(61_000);
  await sendCode('e@example.test');
  const code2 = codeFromEmail(h.net.log.email.at(-1));
  assert.equal((await verify('e@example.test', code2)).status, 200);
  const again = await verify('e@example.test', code2);
  assert.equal(again.status, 410); assert.equal((await again.json()).error, 'code_expired');
  assert.equal((await verify('e@example.test', '12345')).status, 400, 'not 6 digits: bad_code');
  assert.equal((await sendCode('not-an-email')).status, 400);
});

test('two parallel verifies of the right code make one session', async () => {
  h = await setup();
  await sendCode('race@example.test');
  const code = codeFromEmail(h.net.log.email.at(-1));
  const res = await Promise.all([verify('race@example.test', code), verify('race@example.test', code)]);
  assert.deepEqual(res.map((r) => r.status).sort(), [200, 410]);
  assert.equal(rows(h.env, 'SELECT * FROM account_sessions').length, 1);
});

test('sessions: at most 3 per account; unused for 180 days = signed out; last_seen written at most hourly', async () => {
  h = await setup();
  const tokens = [];
  for (let i = 0; i < 4; i++) { advanceClock(1000); tokens.push(await signIn(h, 'fam@example.test')); }
  assert.equal(rows(h.env, 'SELECT * FROM account_sessions').length, 3);
  assert.equal((await h.call('GET', '/api/account', { headers: { 'X-Account-Token': tokens[0] } })).status, 401, 'the oldest was dropped');
  const t = tokens[3];
  const seen = () => one(h.env, 'SELECT last_seen FROM account_sessions WHERE account_id = ? ORDER BY created_at DESC', accountId(h.env, 'fam@example.test')).last_seen;
  const first = seen();
  advanceClock(30 * 60_000);
  assert.equal((await h.call('GET', '/api/account', { headers: { 'X-Account-Token': t } })).status, 200);
  assert.equal(seen(), first, 'not written within the hour');
  advanceClock(31 * 60_000);
  await h.call('GET', '/api/account', { headers: { 'X-Account-Token': t } });
  assert.notEqual(seen(), first, 'written after an hour');
  advanceClock(181 * 864e5);
  const idle = await h.call('GET', '/api/account', { headers: { 'X-Account-Token': t } });
  assert.equal(idle.status, 401); assert.equal((await idle.json()).error, 'not_account');
});

test('signout ends this session; signout {all: true} revokes every session', async () => {
  h = await setup();
  const t1 = await signIn(h, 'out@example.test');
  const t2 = await signIn(h, 'out@example.test');
  const t3 = await signIn(h, 'out@example.test');
  const one1 = await (await h.call('POST', '/api/account/signout', { headers: { 'X-Account-Token': t1 }, body: {} })).json();
  assert.deepEqual(one1, { ok: true, revoked: 1 });
  const allOut = await (await h.call('POST', '/api/account/signout', { headers: { 'X-Account-Token': t2 }, body: { all: true } })).json();
  assert.deepEqual(allOut, { ok: true, revoked: 2 });
  assert.equal((await h.call('GET', '/api/account', { headers: { 'X-Account-Token': t3 } })).status, 401);
});

test('the dev log works only on localhost with EMAIL_DEV_LOG, and never returns the code', async () => {
  h = await setup({ RESEND_API_KEY: undefined, EMAIL_DEV_LOG: 'true' });
  const logged = [];
  const real = console.log;
  console.log = (...a) => logged.push(a.join(' '));
  try {
    const remote = await sendCode('dev@example.test');
    assert.equal(remote.status, 503); assert.equal((await remote.json()).error, 'email_not_configured');
    const local = await sendCode('dev@example.test', { host: 'localhost:8787' });
    assert.equal(local.status, 200);
    const body = JSON.stringify(await local.json());
    const code = (logged.join('\n').match(/login code: (\d{6})/) || [])[1];
    assert.match(code, /^\d{6}$/);
    assert.ok(!body.includes(code));
    assert.ok(!logged.join('\n').includes('dev@example.test'), 'the address is not logged');
  } finally { console.log = real; }
  assert.equal(h.net.log.email.length, 0);
});

test('six-digit codes are uniform (chi-square over 60,000 draws)', () => {
  const first = Array(10).fill(0); const last = Array(10).fill(0);
  for (let i = 0; i < 60_000; i++) { const c = sixDigits(); first[+c[0]]++; last[+c[5]]++; }
  const chi = (counts) => counts.reduce((s, n) => s + (n - 6000) ** 2 / 6000, 0);
  assert.ok(chi(first) < 27.88, `first digit chi2 ${chi(first)}`);
  assert.ok(chi(last) < 27.88, `last digit chi2 ${chi(last)}`);
});

test('step-up: deleting the account needs a code from the last 10 minutes; the new code replaces the session', async () => {
  h = await setup();
  const t = await signIn(h, 'step@example.test');
  advanceClock(11 * 60_000);
  const late = await h.call('POST', '/api/account/delete', { headers: { 'X-Account-Token': t }, body: { confirm: 'DELETE' } });
  assert.equal(late.status, 401); assert.equal((await late.json()).error, 'reauth_needed');
  const fresh = await signIn(h, 'step@example.test', { 'X-Account-Token': t });
  assert.equal(rows(h.env, 'SELECT * FROM account_sessions').length, 1, 'the fresh token replaced the old one');
  assert.equal((await h.call('GET', '/api/account', { headers: { 'X-Account-Token': t } })).status, 401);
  assert.equal((await h.call('POST', '/api/account/delete', { headers: { 'X-Account-Token': fresh }, body: {} })).status, 400, 'confirm required');
  assert.equal((await h.call('POST', '/api/account/delete', { headers: { 'X-Account-Token': fresh }, body: { confirm: 'DELETE' } })).status, 200);
});

test('a family-device token alone is refused by the account and billing routes', async () => {
  h = await setup();
  await signIn(h, 'fd@example.test');
  const a = accountId(h.env, 'fd@example.test');
  const sub = insertSub(h.env, { kind: 'family', account_id: a });
  const d = await linkDevice(h.env, a);
  for (const [m, p, body] of [['GET', '/api/account'], ['GET', '/api/account/export'], ['POST', '/api/account/delete', { confirm: 'DELETE' }],
    ['POST', '/api/billing/cancel', { subscriptionId: sub.id, mode: 'period_end' }], ['POST', '/api/billing/resume', { subscriptionId: sub.id }],
    ['GET', '/api/billing/portal'], ['POST', '/api/billing/checkout', { plan: 'family_month', adult: true, terms: '2026-11' }]]) {
    const r = await h.call(m, p, { headers: d.headers, body });
    assert.equal(r.status, 401, p);
    assert.equal((await r.json()).error, 'not_account', p);
  }
  const s = await (await h.call('GET', '/api/ai/status', { headers: d.headers })).json();
  assert.equal(s.tier, 'family');
  assert.equal(JSON.stringify(s).includes('@') || 'plan' in s || JSON.stringify(s).includes('₪'), false, 'no email, plan or price');
});
