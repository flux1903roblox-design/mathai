// The one-year plan, its renewal and the cooling-off clock (trust spec TRUST-10, Appendix E §E.7). The monthly plan
// renews by itself until cancelled (s.13ד); the yearly plan is one payment for one year (s.13א): it never charges
// again without a new act of the payer, its end is announced 30-45 days and 7 days ahead, a renewal is a new order with
// its own 14 days, and the 14 days run from the later of the payment and the confirmation email that really left
// (s.14ג). The test provider stands in for a payment company; Resend is stubbed; every address is synthetic.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { plansView, RENEW_DAYS } from '../src/billing.js';
import { addMonths, decide } from '../src/apply.js';
import { endFinished, reconcile, reminders, run, YEAR_ENDING_DAYS } from '../src/cron.js';
import { flushNotices, renderNotice, MAX_NOTICE_TRIES } from '../src/email.js';
import { setup, signIn, accountId, insertSub, signedTestEvent, rows, one, advanceClock } from './helpers.js';

let h;
afterEach(() => h?.done());
const DAY = 864e5;
const YEAR = 24900;
const MONTH = 2990;
const iso = (ms) => new Date(ms).toISOString();
let n = 0;

/** POST /api/billing/checkout for a plan, with a fresh idempotency key. → { status, body } */
async function checkout(token, plan, key = `renewal-test-${n++}-abcdefgh`) {
  const r = await h.call('POST', '/api/billing/checkout', { headers: { 'X-Account-Token': token, 'Idempotency-Key': key }, body: { plan, adult: true, terms: '2026-11' } });
  return { status: r.status, body: await r.json() };
}
/** A signed test-provider event through the webhook. → the results list. */
async function event(ev) {
  const s = await signedTestEvent(h.env, { currency: 'ILS', ...ev });
  const r = await h.call('POST', `/api/billing/webhook/test/${h.env.WEBHOOK_PATH_SECRET}`, { body: s.body, headers: s.headers });
  assert.equal(r.status, 200);
  return (await r.json()).results;
}
const paid = (orderId, amountAgorot, at = Date.now(), extra = {}) => event({ id: `ev_${n++}`, type: 'paid', order: orderId, payment: `pay_${orderId}`, amountAgorot, occurredAt: iso(at), ...extra });
/** A parent with a one-year plan paid `ago` ms back (its welcome email went out at the payment). → { token, a, sub } */
async function yearly(email, ago) {
  const token = await signIn(h, email);
  const { body } = await checkout(token, 'family_year');
  assert.deepEqual(await paid(body.orderId, YEAR, Date.now() - ago), ['applied']);
  await h.ctx.flush();
  const a = accountId(h.env, email);
  h.env.DB.raw.prepare('UPDATE subscriptions SET refund_until = ? WHERE account_id = ?').run(iso(Date.now() - ago + 14 * DAY), a);
  return { token, a, sub: one(h.env, 'SELECT * FROM subscriptions WHERE account_id = ?', a) };
}
const subOf = (id) => one(h.env, 'SELECT * FROM subscriptions WHERE id = ?', id);
const account = async (token) => (await h.call('GET', '/api/account', { headers: { 'X-Account-Token': token } })).json();

// ---------------------------------------------------------------- §1 the yearly plan is a one-year plan
test('plans: the yearly plan does not renew and runs 12 months; the monthly plan renews', async () => {
  h = await setup();
  const p = plansView(h.env).plans;
  assert.deepEqual(p.find((x) => x.id === 'family_year'), { id: 'family_year', kind: 'family', interval: 'year', amountAgorot: YEAR, vatAgorot: 3798, renews: false, termMonths: 12, online: true });
  assert.equal(p.find((x) => x.id === 'family_month').renews, true);
  const served = await (await h.call('GET', '/api/billing/plans')).json();
  assert.equal(served.plans.find((x) => x.id === 'family_year').renews, false);
});

test('the provider spy: a standing order only for the monthly plan; the yearly plan keeps no provider subscription id', async () => {
  h = await setup();
  const { default: provider } = await import('../src/providers/test.js');
  const real = provider.createCheckout;
  const seen = [];
  provider.createCheckout = async (env, args) => { seen.push([args.plan, args.recurring]); return real.call(provider, env, args); };
  try {
    const m = await signIn(h, 'month@example.test');
    const y = await signIn(h, 'year@example.test');
    const om = (await checkout(m, 'family_month')).body.orderId;
    const oy = (await checkout(y, 'family_year')).body.orderId;
    assert.deepEqual(seen, [['family_month', true], ['family_year', false]]);
    // paid on the test payment page: it opens a standing order only where the checkout asked for one
    for (const id of [om, oy]) assert.equal((await h.call('POST', `/api/billing/test-pay/${id}`, { body: { result: 'paid' } })).status, 303);
    await h.ctx.flush();
    assert.equal(one(h.env, 'SELECT provider_subscription_id FROM subscriptions WHERE account_id = ?', accountId(h.env, 'month@example.test')).provider_subscription_id, `tsub_${om}`);
    assert.equal(one(h.env, 'SELECT provider_subscription_id FROM subscriptions WHERE account_id = ?', accountId(h.env, 'year@example.test')).provider_subscription_id, null);
    // a provider that reports a standing order for a yearly payment anyway: none is stored, and a later charge on that
    // order is a second payment that goes back
    const z = await signIn(h, 'other@example.test');
    const oz = (await checkout(z, 'family_year')).body.orderId;
    assert.deepEqual(await paid(oz, YEAR, Date.now(), { subscription: `tsub_${oz}` }), ['applied']);
    const zs = one(h.env, 'SELECT * FROM subscriptions WHERE account_id = ?', accountId(h.env, 'other@example.test'));
    assert.equal(zs.provider_subscription_id, null);
    assert.deepEqual(await paid(oz, YEAR, Date.now() + 1000, { payment: `pay2_${oz}`, subscription: `tsub_${oz}` }), ['duplicate_payment']);
    assert.equal(one(h.env, "SELECT amount_agorot FROM refund_queue WHERE reason = 'duplicate' AND subscription_id = ?", zs.id).amount_agorot, YEAR);
    assert.equal(subOf(zs.id).current_period_end, zs.current_period_end, 'the year did not move');
  } finally { provider.createCheckout = real; }
});

test('a yearly plan paid on 10.11.2026 ends on 10.11.2027 by itself, and nothing is charged again', async () => {
  h = await setup();
  const { default: provider } = await import('../src/providers/test.js');
  const calls = [];
  const spied = ['refund', 'cancel', 'resume', 'fetchSubscription'].map((k) => [k, provider[k]]);
  for (const [k, f] of spied) provider[k] = async (...a) => { calls.push(k); return f.apply(provider, a); };
  try {
    const token = await signIn(h, 'year@example.test');
    const { body } = await checkout(token, 'family_year');
    assert.deepEqual(await paid(body.orderId, YEAR, Date.parse('2026-11-10T10:00:00.000Z')), ['applied']);
    const sub = one(h.env, 'SELECT * FROM subscriptions');
    assert.equal(sub.current_period_end, '2027-11-10T10:00:00.000Z');
    assert.equal(sub.current_period_end, addMonths(sub.first_paid_at, 12));
    // the nightly reconciliation asks no provider about it: it does not renew
    advanceClock(Date.parse('2027-11-10T01:30:00.000Z') - Date.now()); // 03:30 in Jerusalem
    const night = await run(h.env, { now: new Date() });
    assert.deepEqual(night.reconcile, { checked: 0, extended: 0, ended: 0, failed: 0 });
    assert.equal(subOf(sub.id).status, 'active', 'still in its year');
    advanceClock(Date.parse('2027-11-10T11:00:00.000Z') - Date.now()); // the end + 1 hour
    assert.equal(await endFinished(h.env), 1);
    const ended = subOf(sub.id);
    assert.deepEqual([ended.status, ended.ended_reason], ['ended', 'expired']);
    assert.equal(await endFinished(h.env), 0, 'once');
    assert.deepEqual(calls, [], 'no call to the payment company at all');
    assert.equal(rows(h.env, "SELECT * FROM payments WHERE kind = 'charge'").length, 1, 'one charge, ever');
  } finally { for (const [k, f] of spied) provider[k] = f; }
});

test('reconcile looks only at monthly plans; a yearly plan past its end is endFinished\'s', async () => {
  h = await setup();
  await signIn(h, 'a@example.test'); await signIn(h, 'b@example.test');
  const m = insertSub(h.env, { kind: 'family', plan: 'family_month', account_id: accountId(h.env, 'a@example.test'), provider: 'test', provider_subscription_id: 'tsub_x', start: iso(Date.now() - 40 * DAY), end: iso(Date.now() - 2 * DAY) });
  const y = insertSub(h.env, { kind: 'family', plan: 'family_year', account_id: accountId(h.env, 'b@example.test'), provider: 'test', start: iso(Date.now() - 370 * DAY), end: iso(Date.now() - 2 * DAY) });
  const r = await reconcile(h.env);
  assert.equal(r.checked, 1);
  assert.equal(subOf(y.id).status, 'active');
  await endFinished(h.env);
  assert.deepEqual([subOf(y.id).status, subOf(y.id).ended_reason], ['ended', 'expired']);
  assert.notEqual(subOf(m.id).ended_reason, 'expired');
});

// ---------------------------------------------------------------- §2 the end-date notices
test('year_ending is queued 30-45 days ahead (never at 61 or 29), year_ending_7 at 7 days; each once, to the payer', async () => {
  h = await setup();
  const at = (email, days, over = {}) => insertSub(h.env, { kind: 'family', plan: 'family_year', account_id: over.account === null ? null : accountId(h.env, email), price_agorot: YEAR, end: iso(Date.now() + days * DAY), ...over });
  for (const e of ['d40@example.test', 'd61@example.test', 'd29@example.test', 'd7@example.test', 'c40@example.test', 'm40@example.test']) await signIn(h, e);
  const d40 = at('d40@example.test', 40); const d61 = at('d61@example.test', 61); const d29 = at('d29@example.test', 29); const d7 = at('d7@example.test', 7);
  at('c40@example.test', 40, { status: 'canceled', cancel_at_period_end: 1 }); // the payer already said no
  insertSub(h.env, { kind: 'family', plan: 'family_month', account_id: accountId(h.env, 'm40@example.test'), price_agorot: MONTH, end: iso(Date.now() + 40 * DAY) });
  at(null, 40, { account: null }); // nobody to tell
  assert.deepEqual(YEAR_ENDING_DAYS, { from: 30, to: 45, last: 7 });
  assert.deepEqual(await reminders(h.env), { yearEnding: 1, yearEnding7: 1, licence: 0 });
  assert.deepEqual(await reminders(h.env), { yearEnding: 0, yearEnding7: 0, licence: 0 }, 'the next night queues nothing again');
  const kinds = rows(h.env, "SELECT ref, kind, to_account, params FROM notices WHERE kind LIKE 'year_ending%' ORDER BY kind");
  assert.deepEqual(kinds.map((x) => [x.ref, x.kind]), [[d40.id, `year_ending:${d40.current_period_end}`], [d7.id, `year_ending_7:${d7.current_period_end}`]]);
  assert.equal(kinds[0].to_account, accountId(h.env, 'd40@example.test'));
  assert.deepEqual(JSON.parse(kinds[0].params), { periodEnd: d40.current_period_end, priceAgorot: YEAR, vatAgorot: 3798 });
  assert.ok(![d61.id, d29.id].some((id) => kinds.some((k) => k.ref === id)), 'never at 61 or at 29 days');
  // the old yearly reminder is gone
  assert.equal(rows(h.env, "SELECT * FROM notices WHERE kind LIKE 'renewal_reminder:%'").length, 0);
  // both emails, as Appendix E §E.7 writes them, each with the one-tap renewal link
  await flushNotices(h.env);
  const mail = (subject) => h.net.log.email.find((m) => m.subject.startsWith(subject));
  const end = mail('המנוי לשנה מסתיים ב־');
  assert.ok(end && end.to[0] === 'd40@example.test');
  assert.match(end.text, /הוא לא מתחדש מעצמו, ולא נחייב אתכם שוב\./);
  assert.match(end.text, /אפשר לחדש לשנה נוספת ב־₪249\.00 \(כולל מע״מ\): https:\/\/madregot\.example\.test\/parents\?renew=year\. אחרי .+ אפשר להצטרף גם למנוי חודשי\./);
  assert.match(end.text, /העוזר החכם יחזור ל־2 שאלות ביום\. השיעורים, התרגול וההתקדמות נשארים כמו שהם\./);
  assert.match(end.text, /לביטול המנוי: https:\/\/madregot\.example\.test\/cancel/);
  const week = mail('עוד שבוע המנוי לשנה מסתיים');
  assert.ok(week && week.to[0] === 'd7@example.test');
  assert.match(week.text, /ולא מתחדש מעצמו\. לחידוש לשנה נוספת: https:\/\/madregot\.example\.test\/parents\?renew=year\. אם לא תעשו כלום, לא נחייב אתכם\./);
  assert.doesNotMatch(`${end.text}${week.text}`, /מתחדש ב־|מתחדש אוטומטית/);
});

// ---------------------------------------------------------------- §3 a renewal is a new consent
test('renewal: accepted 20 days before the end (409 at 50), paid → the plan runs a year from its old end; monthly while it is live → 409', async () => {
  h = await setup();
  const early = await yearly('early@example.test', 315 * DAY); // ends in about 50 days
  const late = await yearly('late@example.test', 345 * DAY); // ends in about 20 days
  const toEnd = (s) => Math.round((Date.parse(s.current_period_end) - Date.now()) / DAY);
  assert.ok(toEnd(early.sub) > RENEW_DAYS && toEnd(late.sub) < 30 && toEnd(late.sub) > 0, `${toEnd(early.sub)} / ${toEnd(late.sub)}`);
  const no = await checkout(early.token, 'family_year');
  assert.deepEqual([no.status, no.body.error], [409, 'already_subscribed']);
  assert.equal((await account(early.token)).plan.canRenew, false);
  const monthly = await checkout(late.token, 'family_month');
  assert.deepEqual([monthly.status, monthly.body.error], [409, 'already_subscribed'], 'a monthly standing order cannot start while the year runs');
  // the account page says the year can be renewed, and from when
  const before = (await account(late.token)).plan;
  assert.deepEqual([before.plan, before.renews, before.canRenew], ['family_year', false, true]);
  assert.equal(before.renewFrom, iso(Date.parse(late.sub.current_period_end) - RENEW_DAYS * DAY));
  // the renewal: an order of its own, which records the plan and the year it renews
  const r = await checkout(late.token, 'family_year');
  assert.equal(r.status, 201);
  assert.deepEqual({ ...one(h.env, 'SELECT * FROM order_renewals WHERE order_id = ?', r.body.orderId) },
    { order_id: r.body.orderId, subscription_id: late.sub.id, prev_start: late.sub.current_period_start, prev_end: late.sub.current_period_end });
  assert.deepEqual(await paid(r.body.orderId, YEAR), ['applied']);
  await h.ctx.flush();
  const s = subOf(late.sub.id);
  assert.equal(rows(h.env, 'SELECT * FROM subscriptions WHERE account_id = ?', late.a).length, 1, 'the same plan, not a second one');
  assert.equal(s.current_period_start, late.sub.current_period_end);
  assert.equal(s.current_period_end, addMonths(late.sub.current_period_end, 12));
  assert.deepEqual([s.status, s.price_agorot, s.provider_subscription_id], ['active', YEAR, null]);
  assert.ok(Math.abs(Date.parse(s.refund_until) - (Date.now() + 14 * DAY)) < 60_000, 'its own 14 days, from this payment and its email');
  const pays = rows(h.env, "SELECT * FROM payments WHERE subscription_id = ? AND kind = 'charge' ORDER BY occurred_at", s.id);
  assert.equal(pays.length, 2); assert.equal(pays[1].period_end, s.current_period_end); assert.equal(pays[1].order_id, r.body.orderId);
  assert.equal(one(h.env, 'SELECT subscription_id FROM orders WHERE id = ?', r.body.orderId).subscription_id, s.id);
  // its own confirmation email, with the one-payment wording and what a refund of it keeps
  const mail = h.net.log.email.find((m) => m.subject === 'המנוי לעוזר החכם של מדרגות חודש לשנה נוספת');
  assert.ok(mail && mail.to[0] === 'late@example.test');
  assert.match(mail.text, /מנוי משפחתי לשנה: ₪249\.00, כולל מע״מ\. תשלום אחד, בלי חידוש אוטומטי\./);
  assert.match(mail.text, /ב־14 הימים הקרובים אפשר לבטל את החידוש ולקבל החזר מלא\. המנוי הנוכחי ממשיך עד /);
  const after = (await account(late.token)).plan;
  assert.deepEqual([after.canRenew, after.canRefundNow, after.renewalUndoEnd], [false, true, late.sub.current_period_end]);
  // a second renewal of the same year (two tabs, two orders): the second payment goes back, and the year does not move
  const again = await checkout(late.token, 'family_year');
  assert.deepEqual([again.status, again.body.error], [409, 'already_subscribed']);
});

test('a second order for the same renewal, paid after the first, goes back in full', async () => {
  h = await setup();
  const p = await yearly('two@example.test', 345 * DAY);
  const o1 = (await checkout(p.token, 'family_year')).body.orderId;
  const o2 = (await checkout(p.token, 'family_year', 'renewal-second-tab-0001')).body.orderId;
  assert.notEqual(o1, o2);
  assert.deepEqual(await paid(o1, YEAR), ['applied']);
  const extended = subOf(p.sub.id).current_period_end;
  assert.deepEqual(await paid(o2, YEAR), ['duplicate_payment']);
  assert.equal(subOf(p.sub.id).current_period_end, extended, 'one year added, not two');
  assert.equal(one(h.env, "SELECT amount_agorot FROM refund_queue WHERE reason = 'duplicate'").amount_agorot, YEAR);
  assert.equal(one(h.env, 'SELECT status FROM orders WHERE id = ?', o2).status, 'paid');
});

test('a cooling-off refund of a renewal puts the old end back and keeps the plan active; the provider\'s refund report changes nothing more', async () => {
  h = await setup();
  const p = await yearly('back@example.test', 345 * DAY);
  const o = (await checkout(p.token, 'family_year')).body.orderId;
  await paid(o, YEAR);
  await h.ctx.flush();
  const r = await h.call('POST', '/api/billing/cancel', { headers: { 'X-Account-Token': p.token }, body: { subscriptionId: p.sub.id, mode: 'refund_now' } });
  assert.equal(r.status, 200);
  const ans = await r.json();
  assert.deepEqual([ans.status, ans.endsAt, ans.refundAgorot], ['active', p.sub.current_period_end, YEAR]);
  const s = subOf(p.sub.id);
  assert.deepEqual([s.status, s.current_period_start, s.current_period_end, s.refund_until, s.cancel_requested_at], ['active', p.sub.current_period_start, p.sub.current_period_end, null, null]);
  const q = one(h.env, 'SELECT * FROM refund_queue');
  assert.deepEqual([q.reason, q.amount_agorot, q.payment_id], ['cooling_off', YEAR, one(h.env, 'SELECT id FROM payments WHERE order_id = ?', o).id]);
  assert.ok(q.done_at, 'refunded through the provider at once');
  await h.ctx.flush();
  const mail = h.net.log.email.find((m) => m.subject.startsWith('אישור ביטול החידוש'));
  assert.ok(mail); assert.match(mail.text, /המנוי לשנה ממשיך עד .+, ולא יהיו חיובים נוספים\./);
  // the payment company reports the refund: recorded, and the plan stays as it is
  assert.deepEqual(await event({ id: 'ev_ref', type: 'refunded', payment: `pay_${o}`, amountAgorot: YEAR, occurredAt: iso(Date.now()) }), ['applied']);
  const t = subOf(p.sub.id);
  assert.deepEqual([t.status, t.current_period_end], ['active', p.sub.current_period_end]);
  // the account page: no second refund, no second renewal of this year (one cooling-off refund per plan)
  const view = (await account(p.token)).plan;
  assert.deepEqual([view.canRefundNow, view.canRenew], [false, false]);
  assert.equal((await checkout(p.token, 'family_year')).status, 409);
  // and the year still ends by itself
  advanceClock(Date.parse(p.sub.current_period_end) - Date.now() + 3600_000);
  await endFinished(h.env);
  assert.equal(subOf(p.sub.id).status, 'ended');
});

test('a refund of a renewal made at the payment company takes the new year back too; pro rata after the 14 days gives the whole renewal back', async () => {
  h = await setup();
  // at the company's dashboard
  const p = await yearly('dash@example.test', 345 * DAY);
  const o = (await checkout(p.token, 'family_year')).body.orderId;
  await paid(o, YEAR);
  assert.deepEqual(await event({ id: 'ev_dash', type: 'refunded', payment: `pay_${o}`, amountAgorot: YEAR, occurredAt: iso(Date.now()) }), ['applied']);
  const s = subOf(p.sub.id);
  assert.deepEqual([s.status, s.current_period_start, s.current_period_end, s.refund_until], ['active', p.sub.current_period_start, p.sub.current_period_end, null]);
  // pro rata, after the renewal's 14 days and before its year starts: none of it was used
  const q = await yearly('later@example.test', 335 * DAY); // ends in about 30 days
  const o2 = (await checkout(q.token, 'family_year')).body.orderId;
  await paid(o2, YEAR);
  await h.ctx.flush();
  advanceClock(15 * DAY);
  const view = (await account(q.token)).plan;
  assert.deepEqual([view.canRefundNow, view.canProrata, view.prorataAgorot], [false, true, YEAR]);
  const ans = await (await h.call('POST', '/api/billing/cancel', { headers: { 'X-Account-Token': q.token }, body: { subscriptionId: q.sub.id, mode: 'prorata' } })).json();
  assert.deepEqual([ans.status, ans.refundAgorot, ans.endsAt], ['active', YEAR, q.sub.current_period_end]);
  assert.deepEqual([subOf(q.sub.id).status, subOf(q.sub.id).current_period_end], ['active', q.sub.current_period_end]);
});

test('a renewal paid after the old year ended starts a new year from the payment', async () => {
  h = await setup();
  const p = await yearly('gap@example.test', 345 * DAY);
  const o = (await checkout(p.token, 'family_year')).body.orderId;
  advanceClock(Date.parse(p.sub.current_period_end) - Date.now() + 2 * 3600_000);
  await endFinished(h.env);
  assert.deepEqual(await paid(o, YEAR), ['applied']);
  const subs = rows(h.env, 'SELECT * FROM subscriptions WHERE account_id = ? ORDER BY created_at', p.a);
  assert.equal(subs.length, 2);
  assert.equal(subs[0].status, 'ended');
  assert.equal(subs[1].status, 'active');
  assert.equal(subs[1].current_period_end, addMonths(subs[1].first_paid_at, 12));
});

test('decide: a renewal\'s payment, in isolation (pure)', () => {
  const now = '2026-11-11T10:00:00.000Z';
  const sub = { id: 's1', kind: 'family', account_id: 'a1', plan: 'family_year', status: 'active', current_period_start: '2025-12-01T10:00:00.000Z', current_period_end: '2026-12-01T10:00:00.000Z', price_agorot: YEAR };
  const ctx = { mode: 'test', now, provider: 'test', eventId: 'e1', graceDays: 3, order: { id: 'o1', plan: 'family_year', account_id: 'a1', status: 'open', amount_agorot: YEAR }, renewal: { order_id: 'o1', subscription_id: 's1', prev_start: sub.current_period_start, prev_end: sub.current_period_end }, renewalSub: sub, live: sub, ids: { sub: 'new', payment: 'p1' } };
  const truth = { status: 'paid', mode: 'test', currency: 'ILS', amountAgorot: YEAR, orderRef: 'o1', providerPaymentId: 'pp1', occurredAt: now };
  const d = decide(truth, ctx);
  assert.equal(d.outcome, 'applied');
  const ext = d.ops.find((x) => x.op === 'sub.extendYear');
  assert.deepEqual([ext.prevEnd, ext.newEnd, ext.refundUntil], [sub.current_period_end, '2027-12-01T10:00:00.000Z', '2026-11-25T10:00:00.000Z']);
  assert.ok(!d.ops.some((x) => x.op === 'sub.insert'), 'no second plan');
  assert.deepEqual(d.notices.map((x) => x.kind), ['welcome:o1']);
  assert.equal(decide({ ...truth, amountAgorot: MONTH }, ctx).outcome, 'mismatch');
  assert.equal(decide(truth, { ...ctx, renewalSub: { ...sub, current_period_end: '2027-12-01T10:00:00.000Z' } }).outcome, 'duplicate_payment');
  // the plan ended before the payment came: a new plan from the payment
  const fresh = decide(truth, { ...ctx, renewalSub: { ...sub, status: 'ended' }, live: null });
  assert.equal(fresh.ops.find((x) => x.op === 'sub.insert').row.current_period_end, addMonths(now, 12));
});

// ---------------------------------------------------------------- §5 the cooling-off clock
test('the 14 days run from the welcome email when it left later: 3 days after the payment, refund_until moves to its sent_at + 14 d', async () => {
  h = await setup();
  const token = await signIn(h, 'late-mail@example.test');
  const o = (await checkout(token, 'family_year')).body.orderId;
  const paidAt = Date.now() - 3 * DAY;
  await paid(o, YEAR, paidAt);
  await h.ctx.flush();
  const s = one(h.env, 'SELECT * FROM subscriptions');
  const sent = one(h.env, "SELECT sent_at FROM notices WHERE kind = 'welcome'").sent_at;
  assert.ok(sent);
  assert.equal(s.refund_until, iso(Date.parse(sent) + 14 * DAY));
  assert.ok(Date.parse(s.refund_until) > paidAt + 14 * DAY);
  // the welcome email for the yearly plan: one payment, no renewal
  const mail = h.net.log.email.find((m) => m.subject === 'המנוי לעוזר החכם של מדרגות פעיל');
  assert.match(mail.text, /מנוי משפחתי לשנה: ₪249\.00, כולל מע״מ\. תשלום אחד, בלי חידוש אוטומטי\. בתוקף עד /);
  assert.doesNotMatch(mail.text, /מתחדש אוטומטית|החיוב הבא/);
});

test('with no email service (the local dev log), the clock does not move: nothing was sent', async () => {
  h = await setup({ RESEND_API_KEY: '', EMAIL_DEV_LOG: 'true', PUBLIC_URL: 'http://localhost:8787' });
  h.env.DB.raw.prepare("INSERT INTO accounts (id, email, created_at) VALUES ('0123456789abcdef', 'devlog@example.test', ?)").run(iso(Date.now()));
  const paidAt = Date.now() - 3 * DAY;
  const sub = insertSub(h.env, { kind: 'family', plan: 'family_year', account_id: '0123456789abcdef', price_agorot: YEAR, first_paid_at: iso(paidAt), refund_until: iso(paidAt + 14 * DAY) });
  h.env.DB.raw.prepare("INSERT INTO notices (ref, kind, to_account, params, created_at) VALUES (?, 'welcome', ?, ?, ?)")
    .run(sub.id, '0123456789abcdef', JSON.stringify({ plan: 'family_year', priceAgorot: YEAR, periodEnd: sub.current_period_end, paidAt: iso(paidAt) }), iso(Date.now()));
  await flushNotices(h.env);
  assert.ok(one(h.env, "SELECT sent_at FROM notices WHERE kind = 'welcome'").sent_at, 'marked sent in the dev log');
  assert.equal(h.net.log.email.length, 0, 'nothing went to Resend');
  assert.equal(subOf(sub.id).refund_until, iso(paidAt + 14 * DAY), 'unchanged');
});

test('a welcome email that fails for good: the refund window runs to 60 days after the payment, and the owner is told', async () => {
  // the welcome email bounces at Resend every time; the sign-in code still arrives
  h = await setup({}, { resend: (msg) => (msg.subject === 'המנוי לעוזר החכם של מדרגות פעיל'
    ? new Response('{}', { status: 500 }) : new Response(JSON.stringify({ id: 'em' }), { status: 200, headers: { 'Content-Type': 'application/json' } })) });
  const token = await signIn(h, 'bounce@example.test');
  const o = (await checkout(token, 'family_year')).body.orderId;
  const paidAt = Date.now() - DAY;
  await paid(o, YEAR, paidAt);
  await h.ctx.flush();
  const sub = one(h.env, 'SELECT * FROM subscriptions');
  assert.equal(sub.refund_until, iso(paidAt + 14 * DAY), 'not sent: the clock has not moved');
  for (let i = 1; i < MAX_NOTICE_TRIES; i += 1) await flushNotices(h.env);
  const w = one(h.env, "SELECT * FROM notices WHERE kind = 'welcome'");
  assert.deepEqual([w.sent_at, w.tries], [null, MAX_NOTICE_TRIES]);
  assert.equal(subOf(sub.id).refund_until, iso(paidAt + 60 * DAY));
  const owner = one(h.env, 'SELECT * FROM notices WHERE kind = ?', `owner:welcome_failed:${sub.id}`);
  assert.ok(owner); assert.equal(owner.to_account, null);
  assert.deepEqual(JSON.parse(owner.params), { subscription: sub.id, refundUntil: iso(paidAt + 60 * DAY) });
  // a later flush that sends nothing more changes nothing
  await flushNotices(h.env);
  assert.equal(subOf(sub.id).refund_until, iso(paidAt + 60 * DAY));
});

// ---------------------------------------------------------------- §6 the emails as text (Appendix E §E.7)
// The rendered emails are kept in test/fixtures/emails/ so a reviewer reads them as the parent will; WRITE_EMAIL_FIXTURES=1
// rewrites them after a wording change.
test('the one-year plan\'s emails as the parent reads them (fixtures)', async () => {
  const env = { PUBLIC_URL: 'https://madregot.example.test', CONTACT_EMAIL: 'hello@example.test', CONTACT_PHONE: '03-0000000', VAT_MODE: 'included', TERMS_VERSION: '2026-11', BUSINESS_NAME: 'שם העסק (לדוגמה)', AI_PAYWALL: 'on', FREE_DAILY_LIMIT: '2' };
  const end = '2027-11-10T10:00:00.000Z';
  const cases = {
    'year_ending.txt': { ref: 's1', kind: `year_ending:${end}`, params: { periodEnd: end, priceAgorot: YEAR, vatAgorot: 3798 } },
    'year_ending_7.txt': { ref: 's1', kind: `year_ending_7:${end}`, params: { periodEnd: end, priceAgorot: YEAR } },
    'welcome_year.txt': { ref: 's1', kind: 'welcome', params: { plan: 'family_year', priceAgorot: YEAR, periodEnd: end, paidAt: '2026-11-10T10:00:00.000Z' } },
    'welcome_renewal.txt': { ref: 's1', kind: 'welcome:o2', params: { plan: 'family_year', priceAgorot: YEAR, periodEnd: '2028-11-10T10:00:00.000Z', prevEnd: end, renewal: true } },
    'canceled_renewal.txt': { ref: 's1', kind: 'canceled:refund_now:2027-10-20T09:00:00.000Z', params: { requestedAt: '2027-10-20T09:00:00.000Z', endsAt: end, refundAgorot: YEAR, reference: 'C-7F3A', renewal: true } },
  };
  const dir = new URL('./fixtures/emails/', import.meta.url);
  if (process.env.WRITE_EMAIL_FIXTURES === '1') mkdirSync(dir, { recursive: true });
  for (const [file, row] of Object.entries(cases)) {
    const m = renderNotice(env, { ...row, params: JSON.stringify(row.params) });
    const text = `Subject: ${m.subject}\n\n${m.lines.join('\n')}\n`;
    if (process.env.WRITE_EMAIL_FIXTURES === '1') writeFileSync(new URL(file, dir), text);
    assert.equal(text, readFileSync(new URL(file, dir), 'utf8'), `${file} is out of date: WRITE_EMAIL_FIXTURES=1 node --test test/renewal.test.js`);
  }
});
