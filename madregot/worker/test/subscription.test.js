// The paid AI tutor end to end through the Worker: the free taste, sign-in by email code, family subscriptions,
// class licences, payment webhooks, cancellation and the owner's admin endpoints. Claude and the email service are stubbed.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import { hmacHex } from '../src/util.js';
import { buildRequest, FALLBACK_BETA, LITE_MAX_TOKENS } from '../../shared/ai.js';
import { makeEnv, ctx, request, stubFetch, codeFromEmail } from './helpers.js';

let env; let net;
beforeEach(() => { env = makeEnv(); net = stubFetch(); });
afterEach(() => net.restore());

const call = (method, path, opts) => worker.fetch(request(method, path, opts), env, ctx);
const explain = (headers = {}, ip) => call('POST', '/api/ai/explain', { headers, ip, body: { question: '3 - 8', correct: '-5', studentAnswer: '5' } });
const DEVICE = 'a'.repeat(32);
const admin = { 'X-Admin-Key': 'admin-key-for-tests-0123456789' };

async function signIn(email, device = DEVICE) {
  const sent = await call('POST', '/api/account/code', { body: { email } });
  assert.equal(sent.status, 200);
  const code = codeFromEmail(net.log.email.at(-1));
  const res = await call('POST', '/api/account/verify', { body: { email, code }, headers: { 'X-Device': device } });
  assert.equal(res.status, 200);
  return (await res.json()).token;
}

// ---------------------------------------------------------------- the free taste
test('a device gets 2 free questions a day, on the low-cost model with short answers, then a clear limit', async () => {
  const h = { 'X-Device': DEVICE };
  for (let i = 0; i < 2; i++) {
    const r = await explain(h);
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('X-AI-Tier'), 'free');
    assert.equal(r.headers.get('X-AI-Left'), String(1 - i));
  }
  const third = await explain(h);
  assert.equal(third.status, 429);
  assert.deepEqual(await third.json(), { error: 'daily_limit', message: 'daily_limit', tier: 'free', limit: 2 });
  assert.equal(net.log.claude.length, 2);
  for (const p of net.log.claude) {
    assert.equal(p.model, 'claude-haiku-5-5');
    assert.ok(p.max_tokens <= LITE_MAX_TOKENS);
    assert.equal(p.fallbacks, undefined, 'Haiku requests carry no server-side fallback');
  }
});

test('the free taste is only the short kinds: generating exercises or checking a photo needs a subscription', async () => {
  const r = await call('POST', '/api/ai/generate', { headers: { 'X-Device': DEVICE }, body: { topic: 'מספרים מכוונים', level: 'חיבור', count: 3 } });
  assert.equal(r.status, 402);
  assert.equal((await r.json()).error, 'paid_only');
  assert.equal(net.log.claude.length, 0);
});

test('a failed call to Claude gives the free question back', async () => {
  net.restore();
  net = stubFetch({ claude: () => new Response(JSON.stringify({ type: 'error', error: { type: 'api_error', message: 'boom' } }), { status: 500, headers: { 'Content-Type': 'application/json' } }) });
  const h = { 'X-Device': DEVICE };
  const r = await explain(h);
  assert.equal(r.status, 502);
  net.restore(); net = stubFetch();
  assert.equal((await explain(h)).status, 200);
  assert.equal((await explain(h)).status, 200, 'both free questions are still there');
});

test('one network address has a cap on free questions, however many devices it has', async () => {
  env = makeEnv({ FREE_IP_DAILY: '3' });
  const devs = ['b', 'c', 'd'].map((x) => x.repeat(32));
  for (const d of devs) assert.equal((await explain({ 'X-Device': d })).status, 200);
  const r = await explain({ 'X-Device': 'e'.repeat(32) });
  assert.equal(r.status, 429);
  assert.equal((await explain({ 'X-Device': 'e'.repeat(32) }, '198.51.100.9')).status, 200, 'another address is not affected');
});

test('ALLOW_SOLO_AI = "false" turns the anonymous free taste off', async () => {
  env = makeEnv({ ALLOW_SOLO_AI: 'false' });
  const r = await explain({ 'X-Device': DEVICE });
  assert.equal(r.status, 403);
  assert.equal((await r.json()).error, 'solo_ai_off');
});

test('the status endpoint tells the app the tier and what is left today, without signing in', async () => {
  await explain({ 'X-Device': DEVICE });
  const r = await call('GET', '/api/ai/status', { headers: { 'X-Device': DEVICE } });
  const s = await r.json();
  assert.equal(s.tier, 'free');
  assert.equal(s.left, 1);
  assert.deepEqual(s.kinds, ['explain', 'chat']);
  assert.equal(s.signedIn, false);
  assert.equal(s.plan, null);
});

// ---------------------------------------------------------------- sign-in by email code
test('sign-in: a code by email, a wrong code counts down, the right one returns a session token', async () => {
  const email = 'Parent@Example.com';
  assert.equal((await call('POST', '/api/account/code', { body: { email } })).status, 200);
  const msg = net.log.email.at(-1);
  assert.deepEqual(msg.to, ['parent@example.com']);
  const code = codeFromEmail(msg);
  assert.match(code, /^\d{6}$/);
  const wrong = await call('POST', '/api/account/verify', { body: { email, code: code === '000000' ? '111111' : '000000' } });
  assert.equal(wrong.status, 403);
  assert.equal((await wrong.json()).left, 4);
  const ok = await call('POST', '/api/account/verify', { body: { email, code } });
  assert.equal(ok.status, 200);
  const { token } = await ok.json();
  assert.match(token, /^[a-f0-9]{64}$/);
  assert.equal((await call('POST', '/api/account/verify', { body: { email, code } })).status, 400, 'a code works once');
});

test('sign-in: five wrong codes end the code; a new one cannot be asked for within a minute', async () => {
  const email = 'p@example.com';
  await call('POST', '/api/account/code', { body: { email } });
  const code = codeFromEmail(net.log.email.at(-1));
  const bad = code === '123456' ? '654321' : '123456';
  for (let i = 0; i < 5; i++) assert.equal((await call('POST', '/api/account/verify', { body: { email, code: bad } })).status, 403);
  assert.equal((await call('POST', '/api/account/verify', { body: { email, code } })).status, 429);
  const again = await call('POST', '/api/account/code', { body: { email } });
  assert.equal(again.status, 429);
  assert.equal((await again.json()).error, 'wait_to_resend');
});

test('sign-in: an expired code is refused; a bad address is refused before anything is sent', async () => {
  const email = 'q@example.com';
  await call('POST', '/api/account/code', { body: { email } });
  const code = codeFromEmail(net.log.email.at(-1));
  env.DB.raw.prepare('UPDATE login_codes SET expires_at = ? WHERE email = ?').run(new Date(Date.now() - 1000).toISOString(), email);
  assert.equal((await call('POST', '/api/account/verify', { body: { email, code } })).status, 400);
  const n = net.log.email.length;
  assert.equal((await call('POST', '/api/account/code', { body: { email: 'not-an-email' } })).status, 400);
  assert.equal(net.log.email.length, n);
});

test('sign-in: without an email service the Worker says so instead of pretending', async () => {
  env = makeEnv({ RESEND_API_KEY: undefined });
  const r = await call('POST', '/api/account/code', { body: { email: 'x@example.com' } });
  assert.equal(r.status, 503);
  assert.equal((await r.json()).error, 'email_not_configured');
});

test('a family account keeps its newest 3 devices', async () => {
  const email = 'fam@example.com';
  const tokens = [];
  for (let i = 0; i < 4; i++) {
    env.DB.raw.prepare('DELETE FROM login_codes').run();
    tokens.push(await signIn(email));
  }
  const n = env.DB.raw.prepare('SELECT COUNT(*) AS n FROM account_sessions').get().n;
  assert.equal(n, 3);
  const first = await call('GET', '/api/ai/status', { headers: { 'X-Account-Token': tokens[0] } });
  assert.equal((await first.json()).signedIn, false, 'the oldest device was signed out');
});

// ---------------------------------------------------------------- family subscriptions
test('an account with a family subscription gets the full tutor: the main model, 40 a day, every kind', async () => {
  const token = await signIn('fam2@example.com');
  const g = await call('POST', '/api/admin/grant', { headers: admin, body: { kind: 'family', email: 'fam2@example.com', months: 1 } });
  assert.equal(g.status, 200);
  const h = { 'X-Account-Token': token };
  const r = await explain(h);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('X-AI-Tier'), 'paid');
  assert.equal(r.headers.get('X-AI-Left'), '39');
  assert.equal(net.log.claude.at(-1).model, 'claude-opus-5-5');
  assert.equal(net.log.claude.at(-1).fallbacks, 'default', 'the main model keeps its refusal fallback');
  const s = await (await call('GET', '/api/ai/status', { headers: h })).json();
  assert.equal(s.tier, 'paid');
  assert.equal(s.plan.kind, 'family');
  assert.equal(s.kinds, null);
});

test('the devices of one family share one daily limit', async () => {
  env = makeEnv({ AI_DAILY_LIMIT: '2' });
  const email = 'share@example.com';
  const t1 = await signIn(email, 'b'.repeat(32));
  env.DB.raw.prepare('DELETE FROM login_codes').run();
  const t2 = await signIn(email, 'c'.repeat(32));
  await call('POST', '/api/admin/grant', { headers: admin, body: { kind: 'family', email, months: 1 } });
  assert.equal((await explain({ 'X-Account-Token': t1 })).status, 200);
  assert.equal((await explain({ 'X-Account-Token': t2 })).status, 200);
  assert.equal((await explain({ 'X-Account-Token': t1 })).status, 429);
});

test('cancelling online: the subscription stops renewing and runs to the end of the paid period', async () => {
  const email = 'cancel@example.com';
  const token = await signIn(email);
  await call('POST', '/api/admin/grant', { headers: admin, body: { kind: 'family', email, months: 1 } });
  const r = await call('POST', '/api/billing/cancel', { headers: { 'X-Account-Token': token } });
  assert.equal(r.status, 200);
  const s = await (await call('GET', '/api/ai/status', { headers: { 'X-Account-Token': token } })).json();
  assert.equal(s.tier, 'paid', 'still paid until the end of the period');
  assert.equal(s.plan.cancelAtPeriodEnd, true);
  env.DB.raw.prepare('UPDATE subscriptions SET current_period_end = ?').run(new Date(Date.now() - 1000).toISOString());
  const after = await (await call('GET', '/api/ai/status', { headers: { 'X-Account-Token': token } })).json();
  assert.equal(after.tier, 'free');
});

test('deleting an account removes the email and its devices', async () => {
  const email = 'gone@example.com';
  const token = await signIn(email);
  const r = await call('POST', '/api/account/delete', { headers: { 'X-Account-Token': token } });
  assert.equal(r.status, 200);
  assert.equal(env.DB.raw.prepare('SELECT COUNT(*) AS n FROM accounts WHERE email = ?').get(email).n, 0);
  assert.equal(env.DB.raw.prepare('SELECT COUNT(*) AS n FROM account_sessions').get().n, 0);
});

// ---------------------------------------------------------------- class licences
async function classWithStudent() {
  const c = await (await call('POST', '/api/classes', { body: { className: 'ז׳3', teacherName: 'רונית', grade: '7' } })).json();
  const s = await (await call('POST', `/api/classes/${c.code}/join`, { body: { name: 'נועה', pin: '1234' } })).json();
  return { cls: c, student: s };
}

test('a class licence gives every student of the class the full tutor, each with their own daily limit', async () => {
  const { cls, student } = await classWithStudent();
  const before = await explain({ Authorization: `Bearer ${student.token}` });
  assert.equal(before.headers.get('X-AI-Tier'), 'free');
  const g = await call('POST', '/api/admin/grant', { headers: admin, body: { kind: 'class', classCode: cls.code, months: 10, note: 'בית ספר דוגמה, חשבונית 1' } });
  assert.equal(g.status, 200);
  const after = await explain({ Authorization: `Bearer ${student.token}` });
  assert.equal(after.headers.get('X-AI-Tier'), 'paid');
  const t = await explain({ 'X-Class-Code': cls.code, 'X-Teacher-Key': cls.teacherKey });
  assert.equal(t.headers.get('X-AI-Tier'), 'paid');
  assert.equal(t.headers.get('X-AI-Left'), '199');
});

test('a wrong teacher key is refused, not treated as a free user', async () => {
  const { cls } = await classWithStudent();
  const r = await explain({ 'X-Class-Code': cls.code, 'X-Teacher-Key': 'wrong' });
  assert.equal(r.status, 401);
});

// ---------------------------------------------------------------- admin
test('admin endpoints: hidden without an ADMIN_KEY, refused with a wrong key, and blocked after repeated failures', async () => {
  env = makeEnv({ ADMIN_KEY: undefined });
  assert.equal((await call('GET', '/api/admin/subscriptions', { headers: admin })).status, 404);
  env = makeEnv();
  for (let i = 0; i < 20; i++) assert.equal((await call('GET', '/api/admin/subscriptions', { headers: { 'X-Admin-Key': 'nope' } })).status, 401);
  assert.equal((await call('GET', '/api/admin/subscriptions', { headers: admin })).status, 429, 'the address is blocked for the day');
  const ok = await call('GET', '/api/admin/subscriptions', { headers: admin, ip: '198.51.100.1' });
  assert.equal(ok.status, 200);
});

test('admin can end a subscription at once', async () => {
  const email = 'end@example.com';
  const token = await signIn(email);
  const { id } = await (await call('POST', '/api/admin/grant', { headers: admin, body: { kind: 'family', email, months: 1 } })).json();
  assert.equal((await call('POST', '/api/admin/end', { headers: admin, body: { id } })).status, 200);
  const s = await (await call('GET', '/api/ai/status', { headers: { 'X-Account-Token': token } })).json();
  assert.equal(s.tier, 'free');
});

// ---------------------------------------------------------------- payment webhooks (generic provider)
async function signed(payload, secret = 'whsec-test') {
  const raw = JSON.stringify(payload);
  return { body: raw, headers: { 'X-Signature': `sha256=${await hmacHex(secret, raw)}` } };
}

test('a signed payment notification activates a family subscription; the same event twice applies once', async () => {
  env = makeEnv({ BILLING_PROVIDER: 'generic', BILLING_WEBHOOK_SECRET: 'whsec-test', BILLING_FAMILY_URL: 'https://pay.example.test/family', BILLING_CANCEL_URL: 'https://relay.example.test/cancel' });
  const email = 'paid@example.com';
  const token = await signIn(email);
  const checkout = await (await call('POST', '/api/billing/checkout', { headers: { 'X-Account-Token': token }, body: { plan: 'family' } })).json();
  const ref = new URL(checkout.url).searchParams.get('ref');
  assert.ok(ref);
  const periodEnd = new Date(Date.now() + 30 * 864e5).toISOString();
  const ev = await signed({ id: 'evt_1', type: 'activated', subscription: 'sub_1', kind: 'family', ref, periodEnd });
  assert.equal((await call('POST', '/api/billing/webhook/generic', ev)).status, 200);
  assert.equal((await call('POST', '/api/billing/webhook/generic', ev)).status, 200);
  assert.equal(env.DB.raw.prepare('SELECT COUNT(*) AS n FROM subscriptions').get().n, 1);
  assert.equal(env.DB.raw.prepare('SELECT COUNT(*) AS n FROM billing_events').get().n, 1);
  const s = await (await call('GET', '/api/ai/status', { headers: { 'X-Account-Token': token } })).json();
  assert.equal(s.tier, 'paid');
  const second = await call('POST', '/api/billing/checkout', { headers: { 'X-Account-Token': token }, body: { plan: 'family' } });
  assert.equal(second.status, 409, 'no second subscription while one runs');
});

test('online sign-up opens only when an online cancel can stop the charges too', async () => {
  env = makeEnv({ BILLING_PROVIDER: 'generic', BILLING_WEBHOOK_SECRET: 'whsec-test', BILLING_FAMILY_URL: 'https://pay.example.test/family' });
  const token = await signIn('half@example.com');
  const s = await (await call('GET', '/api/ai/status', { headers: { 'X-Account-Token': token } })).json();
  assert.equal(s.offer.family.online, false, 'no cancel relay: no online sign-up');
  const r = await call('POST', '/api/billing/checkout', { headers: { 'X-Account-Token': token }, body: { plan: 'family' } });
  assert.equal(r.status, 501);
  assert.equal((await r.json()).error, 'checkout_not_configured');
});

test('cancelling a paid-online plan asks the payment relay first; if it fails, nothing is marked cancelled', async () => {
  const relay = [];
  let relayOk = false;
  net.restore();
  net = stubFetch({ other: (url, bodyText, init) => { relay.push({ url, body: JSON.parse(bodyText), sig: init.headers['X-Signature'] }); return new Response('{}', { status: relayOk ? 200 : 500 }); } });
  {
    env = makeEnv({ BILLING_PROVIDER: 'generic', BILLING_WEBHOOK_SECRET: 'whsec-test', BILLING_FAMILY_URL: 'https://pay.example.test/family', BILLING_CANCEL_URL: 'https://relay.example.test/cancel' });
    const email = 'relay@example.com';
    const token = await signIn(email);
    const periodEnd = new Date(Date.now() + 20 * 864e5).toISOString();
    await call('POST', '/api/billing/webhook/generic', await signed({ id: 'evt_r', type: 'activated', subscription: 'sub_r', email, periodEnd }));
    const failed = await call('POST', '/api/billing/cancel', { headers: { 'X-Account-Token': token } });
    assert.equal(failed.status, 502);
    let s = await (await call('GET', '/api/ai/status', { headers: { 'X-Account-Token': token } })).json();
    assert.equal(s.plan.cancelAtPeriodEnd, false, 'still renewing: the payment company was not told');
    relayOk = true;
    const ok = await call('POST', '/api/billing/cancel', { headers: { 'X-Account-Token': token } });
    assert.equal(ok.status, 200);
    s = await (await call('GET', '/api/ai/status', { headers: { 'X-Account-Token': token } })).json();
    assert.equal(s.plan.cancelAtPeriodEnd, true);
    assert.equal(relay.at(-1).url, 'https://relay.example.test/cancel');
    assert.equal(relay.at(-1).body.subscription, 'sub_r');
    assert.equal(relay.at(-1).sig, await hmacHex('whsec-test', JSON.stringify(relay.at(-1).body)));
  }
});

test('without a cancel relay a paid-online plan cannot be marked cancelled here', async () => {
  env = makeEnv({ BILLING_PROVIDER: 'generic', BILLING_WEBHOOK_SECRET: 'whsec-test' });
  const email = 'norelay@example.com';
  const token = await signIn(email);
  await call('POST', '/api/billing/webhook/generic', await signed({ id: 'evt_n', type: 'activated', subscription: 'sub_n', email, periodEnd: new Date(Date.now() + 9 * 864e5).toISOString() }));
  const r = await call('POST', '/api/billing/cancel', { headers: { 'X-Account-Token': token } });
  assert.equal(r.status, 501);
  assert.equal((await r.json()).error, 'cancel_failed');
  const s = await (await call('GET', '/api/ai/status', { headers: { 'X-Account-Token': token } })).json();
  assert.equal(s.plan.cancelAtPeriodEnd, false);
});

test('a notification with a wrong signature changes nothing', async () => {
  env = makeEnv({ BILLING_PROVIDER: 'generic', BILLING_WEBHOOK_SECRET: 'whsec-test' });
  const ev = await signed({ id: 'evt_x', type: 'activated', subscription: 'sub_x', email: 'x@example.com', periodEnd: new Date(Date.now() + 864e5).toISOString() }, 'other-secret');
  const r = await call('POST', '/api/billing/webhook/generic', ev);
  assert.equal(r.status, 401);
  assert.equal(env.DB.raw.prepare('SELECT COUNT(*) AS n FROM subscriptions').get().n, 0);
});

test('renewal, a failed payment and the end, as the provider reports them', async () => {
  env = makeEnv({ BILLING_PROVIDER: 'generic', BILLING_WEBHOOK_SECRET: 'whsec-test' });
  const email = 'cycle@example.com';
  const token = await signIn(email);
  const soon = new Date(Date.now() + 864e5).toISOString();
  const later = new Date(Date.now() + 31 * 864e5).toISOString();
  const send = async (id, type, periodEnd) => call('POST', '/api/billing/webhook/generic', await signed({ id, type, subscription: 'sub_c', email, periodEnd }));
  await send('e1', 'activated', soon);
  await send('e2', 'renewed', later);
  let s = await (await call('GET', '/api/ai/status', { headers: { 'X-Account-Token': token } })).json();
  assert.equal(s.plan.endsAt, later);
  await send('e3', 'payment_failed', later);
  s = await (await call('GET', '/api/ai/status', { headers: { 'X-Account-Token': token } })).json();
  assert.equal(s.tier, 'paid', 'the provider is retrying; the paid period still runs');
  assert.equal(s.plan.status, 'past_due');
  await send('e4', 'ended');
  s = await (await call('GET', '/api/ai/status', { headers: { 'X-Account-Token': token } })).json();
  assert.equal(s.tier, 'free');
});

test('the manual provider has no online checkout and no webhook', async () => {
  const token = await signIn('m@example.com');
  const r = await call('POST', '/api/billing/checkout', { headers: { 'X-Account-Token': token }, body: { plan: 'family' } });
  assert.equal(r.status, 501);
  assert.equal((await call('POST', '/api/billing/webhook/manual', { body: {} })).status, 404);
});

// ---------------------------------------------------------------- request shapes
test('lite requests: Haiku without fallback, capped tokens, low effort; a free chat keeps the exercise context first', () => {
  const messages = Array.from({ length: 10 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `turn ${i}` }));
  const r = buildRequest('chat', { messages, context: { question: '3 - 8' } }, { model: 'claude-haiku-5-5', lite: true });
  assert.equal(r.max_tokens <= LITE_MAX_TOKENS, true);
  assert.equal(r.output_config.effort, 'low');
  assert.equal(r.fallbacks, undefined);
  assert.equal(r.betas.includes(FALLBACK_BETA), false);
  assert.equal(r.messages[0].role, 'user');
  assert.match(r.messages[0].content, /Exercise on screen: 3 - 8/);
  assert.ok(r.messages.length <= 6);
  const full = buildRequest('chat', { messages, context: { question: '3 - 8' } }, { model: 'claude-opus-5-5' });
  assert.equal(full.fallbacks, 'default');
});
