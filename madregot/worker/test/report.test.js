// The parents' progress report on the Worker (PARENTS-3): a linked child device sends its day summaries (codes and
// counts only), the child and the parent each hold one switch, the parent reads and deletes, the night keeps 90 days,
// and the kill switch stops storing. Synthetic data only: example.test addresses, stubbed Claude and email, the paywall on.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  setup, signIn, accountId, insertSub, linkDevice, makeClass, bearer, rows, one, setCount, countOf, netOf,
} from './helpers.js';
import { readFileSync, readdirSync } from 'node:fs';
import { dayOf, monthOf, hourOf, jerusalemMidnight } from '../src/util.js';
import {
  shiftDay, REPORT_KEEP_DAYS, cleanDay, feedbackCounts, FEEDBACK_KEYS, weeklyQueue, flushWeekly, weeklyParams, weeklyWindow, unsubToken, UNSUB_TEXT,
} from '../src/report.js';
import { flushNotices, MAX_NOTICE_TRIES, renderNotice } from '../src/email.js';
import { purge, run } from '../src/cron.js';
import { weekStart, weekFrom } from '../../shared/week.js';
import { stairName } from '../../shared/stairs.js';
import { texToPlain } from '../../shared/plain.js';

let h;
afterEach(() => h?.done());

const today = () => dayOf();
const ago = (n) => shiftDay(today(), -n);
/** A DaySummary as the app sends it (web/src/learn/report.ts). */
const day = (d, over = {}) => ({
  v: 1, d, m: 18, q: 22, ls: 2, st: 1, sk: ['signed:1', 'coord:2'], ma: ['signed:1'], rv: 1, fx: [['signed:1', 'minus-minus', 'o']], sr: 3, ex: null, ...over,
});
const post = (headers, days, opts = {}) => h.call('POST', '/api/family/summary', { headers, body: { days }, ...opts });
const childSwitch = (headers, body) => h.call('POST', '/api/family/summary/sharing', { headers, body });
const parentSwitch = (fam, id, on) => h.call('POST', `/api/family/devices/${id}/sharing`, { headers: fam.parent, body: { on } });
const status = async (headers) => (await (await h.call('GET', '/api/ai/status', { headers })).json()).linked;
const daily = (deviceId) => rows(h.env, 'SELECT * FROM family_daily WHERE device_id = ? ORDER BY day', deviceId);

/** A parent with a family plan (or none), signed in, and one linked child device. */
async function family(email = 'parent@example.test', { plan = true, label = 'הטאבלט' } = {}) {
  const token = await signIn(h, email);
  const a = accountId(h.env, email);
  if (plan) insertSub(h.env, { kind: 'family', account_id: a });
  const dev = await linkDevice(h.env, a, label);
  return { token, a, dev, parent: { 'X-Account-Token': token } };
}

test('1. a linked device posts today and yesterday: two rows; a second post for today replaces it; the sync time is kept', async () => {
  h = await setup();
  const fam = await family();
  const r = await post(fam.dev.headers, [day(ago(1)), day(today())]);
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true, saved: 2, sharing: 'on' });
  assert.deepEqual(daily(fam.dev.id).map((x) => x.day), [ago(1), today()]);
  const first = one(h.env, 'SELECT summary_sent_at FROM family_devices WHERE id = ?', fam.dev.id).summary_sent_at;
  assert.ok(first, 'summary_sent_at is set');
  const again = await post(fam.dev.headers, [day(today(), { m: 40, q: 50, sk: ['coord:2'], ma: [], fx: [['signed:1', 'minus-minus', 'd']], ex: { d: shiftDay(today(), 5), n: 1, of: 3 } })]);
  assert.equal(again.status, 200);
  const rowsNow = daily(fam.dev.id);
  assert.equal(rowsNow.length, 2, 'upsert, not append');
  const t = rowsNow.find((x) => x.day === today());
  assert.deepEqual({ m: t.minutes, q: t.questions, worked: t.worked, mastered: t.mastered, fixes: t.fixes, exam: t.exam },
    { m: 40, q: 50, worked: '["coord:2"]', mastered: '[]', fixes: '[["signed:1","minus-minus","d"]]', exam: JSON.stringify({ d: shiftDay(today(), 5), n: 1, of: 3 }) });
  assert.equal(rowsNow.find((x) => x.day === ago(1)).minutes, 18, 'yesterday untouched');
});

test('2. validation: every bad summary is refused with its field and nothing is written; over 8 KB is 413', async () => {
  h = await setup();
  const fam = await family();
  const stairs13 = Array.from({ length: 13 }, (_, i) => `signed:${i + 1}`);
  const bad = {
    'a 13th stair': [[day(today(), { sk: stairs13 })], 'sk'],
    'a 13th mastered stair': [[day(today(), { ma: stairs13 })], 'ma'],
    'm: 601': [[day(today(), { m: 601 })], 'm'],
    'a fraction': [[day(today(), { q: 2.5 })], 'q'],
    'a count as text': [[day(today(), { ls: '2' })], 'ls'],
    'a negative streak': [[day(today(), { sr: -1 })], 'sr'],
    'an extra key "name"': [[{ ...day(today()), name: 'נועה' }], 'keys'],
    'a missing key': [[(({ rv, ...rest }) => rest)(day(today()))], 'keys'],
    'v: 2': [[day(today(), { v: 2 })], 'v'],
    'a day 9 days back': [[day(ago(9))], 'd'],
    'a day 2 days ahead': [[day(shiftDay(today(), 2))], 'd'],
    'not a real day': [[day('2026-02-30')], 'd'],
    'fx state "x"': [[day(today(), { fx: [['signed:1', 'minus-minus', 'x']] })], 'fx'],
    'a mistake id with Hebrew': [[day(today(), { fx: [['signed:1', 'טעות', 'o']] })], 'fx'],
    '9 repairs': [[day(today(), { fx: Array.from({ length: 9 }, (_, i) => ['signed:1', `m${i}`, 'o']) })], 'fx'],
    'a stair id in capitals': [[day(today(), { sk: ['SIGNED:1'] })], 'sk'],
    'a stair twice': [[day(today(), { sk: ['signed:1', 'signed:1'] })], 'sk'],
    'an exam with another key': [[day(today(), { ex: { d: today(), n: 1, of: 2, name: 'x' } })], 'ex'],
    'an exam with n > of': [[day(today(), { ex: { d: today(), n: 3, of: 2 } })], 'ex'],
    '9 days in one body': [Array.from({ length: 9 }, (_, i) => day(ago(i))), 'days'],
    'no days': [[], 'days'],
    'a duplicated day': [[day(today()), day(today(), { m: 1 })], 'd'],
  };
  for (const [why, [days, field]] of Object.entries(bad)) {
    const r = await post(fam.dev.headers, days);
    assert.equal(r.status, 400, why);
    assert.deepEqual(await r.json(), { error: 'bad_summary', message: 'bad_summary', field }, why);
  }
  const extraTop = await h.call('POST', '/api/family/summary', { headers: fam.dev.headers, body: { days: [day(today())], label: 'x' } });
  assert.equal(extraTop.status, 400);
  assert.equal(rows(h.env, 'SELECT * FROM family_daily').length, 0, 'nothing was written');
  // a body over 8 KB
  const big = await h.call('POST', '/api/family/summary', { headers: fam.dev.headers, body: JSON.stringify({ days: [day(today())], pad: 'x'.repeat(8200) }) });
  assert.equal(big.status, 413); assert.equal((await big.json()).error, 'too_large');
  // the edges of the window are accepted: 8 days back and tomorrow (a device's calendar may be ahead)
  assert.equal((await post(fam.dev.headers, [day(ago(8)), day(shiftDay(today(), 1))])).status, 200);
  // the longest repairs the whitelist allows fit the table (a 400, never a failed CHECK)
  const longest = Array.from({ length: 8 }, (_, i) => ['abcdefgh:12', `${'x'.repeat(28)}-${i}`, 'o']);
  const r = await post(fam.dev.headers, [day(today(), { fx: longest })]);
  assert.equal(r.status, 400); assert.equal((await r.json()).field, 'fx');
  assert.doesNotThrow(() => cleanDay(day(today(), { fx: longest.slice(0, 7) }), today()));
});

test('3. auth: a parent\'s session, a class student and an unknown device token are all 401 not_linked', async () => {
  h = await setup();
  const fam = await family();
  const asParent = await post(fam.parent, [day(today())]);
  assert.equal(asParent.status, 401); assert.equal((await asParent.json()).error, 'not_linked');
  assert.equal(asParent.headers.get('X-AI-Linked'), null);
  const cls = await makeClass(h, { students: ['דנה'] });
  const asStudent = await post(bearer(cls.students[0]), [day(today())]);
  assert.equal(asStudent.status, 401); assert.equal((await asStudent.json()).error, 'not_linked');
  const unknown = await post({ 'X-Family-Device': `fd1.${'e'.repeat(64)}` }, [day(today())]);
  assert.equal(unknown.status, 401); assert.equal((await unknown.json()).error, 'not_linked');
  assert.equal(unknown.headers.get('X-AI-Linked'), '0');
  // the child's switch needs the device too
  assert.equal((await childSwitch(fam.parent, { on: false })).status, 401);
  // and the parent's routes need the parent: the device token reaches nothing in the account
  for (const [m, p] of [['GET', '/api/family/summary'], ['POST', `/api/family/devices/${fam.dev.id}/sharing`], ['POST', `/api/family/devices/${fam.dev.id}/history/delete`]]) {
    const r = await h.call(m, p, { headers: fam.dev.headers, body: m === 'POST' ? { on: false } : undefined });
    assert.equal(r.status, 401, p); assert.equal((await r.json()).error, 'not_account', p);
  }
  assert.equal(rows(h.env, 'SELECT * FROM family_daily').length, 0);
});

test('4. no live plan: an ended plan answers 402 and stores nothing; a device linked with no plan reports no_plan', async () => {
  h = await setup();
  const token = await signIn(h, 'ended@example.test');
  const a = accountId(h.env, 'ended@example.test');
  insertSub(h.env, { kind: 'family', account_id: a, status: 'ended', start: new Date(Date.now() - 31 * 864e5).toISOString(), end: new Date(Date.now() - 864e5).toISOString() });
  const dev = await linkDevice(h.env, a);
  const r = await post(dev.headers, [day(today())]);
  assert.equal(r.status, 402); assert.equal((await r.json()).error, 'needs_subscription');
  assert.equal(rows(h.env, 'SELECT * FROM family_daily').length, 0);
  assert.equal((await status(dev.headers)).summary, 'no_plan');
  // a device linked for consent only (TRUST-9: no plan at all)
  const consent = await family('consent@example.test', { plan: false });
  assert.equal((await status(consent.dev.headers)).summary, 'no_plan');
  assert.equal((await post(consent.dev.headers, [day(today())])).status, 402);
  assert.ok(token);
});

test('5. the child\'s switch: stop and delete, then the parent\'s switch cannot turn it back on; only the child can', async () => {
  h = await setup();
  const fam = await family();
  await post(fam.dev.headers, [day(ago(1)), day(today())]);
  const off = await childSwitch(fam.dev.headers, { on: false, forget: true });
  assert.equal(off.status, 200); assert.deepEqual(await off.json(), { sharing: 'child_off' });
  assert.equal(daily(fam.dev.id).length, 0, 'the rows are gone');
  const dev = one(h.env, 'SELECT share_child, share_parent, share_at FROM family_devices WHERE id = ?', fam.dev.id);
  assert.equal(dev.share_child, 0); assert.equal(dev.share_parent, 1); assert.ok(dev.share_at);
  assert.equal((await status(fam.dev.headers)).summary, 'child_off');
  const refused = await post(fam.dev.headers, [day(today())]);
  assert.equal(refused.status, 403); assert.deepEqual(await refused.json(), { error: 'sharing_off', message: 'sharing_off', sharing: 'child_off' });
  // the parent turns theirs off: both off; back on: still off on the child's side, and a post is still refused
  assert.deepEqual(await (await parentSwitch(fam, fam.dev.id, false)).json(), { sharing: 'both_off' });
  assert.equal((await status(fam.dev.headers)).summary, 'both_off');
  assert.deepEqual(await (await parentSwitch(fam, fam.dev.id, true)).json(), { sharing: 'child_off' });
  assert.equal((await post(fam.dev.headers, [day(today())])).status, 403);
  assert.equal(daily(fam.dev.id).length, 0);
  // the child turns it back on
  assert.deepEqual(await (await childSwitch(fam.dev.headers, { on: true })).json(), { sharing: 'on' });
  assert.equal((await post(fam.dev.headers, [day(today())])).status, 200);
  // stopping without forgetting keeps the history for the parent
  await childSwitch(fam.dev.headers, { on: false });
  assert.equal(daily(fam.dev.id).length, 1);
  assert.equal((await childSwitch(fam.dev.headers, { on: 'no' })).status, 400);
});

test('6. the parent\'s switch: off stores nothing; the child cannot turn it back on; only the parent can', async () => {
  h = await setup();
  const fam = await family();
  assert.deepEqual(await (await parentSwitch(fam, fam.dev.id, false)).json(), { sharing: 'parent_off' });
  assert.equal((await status(fam.dev.headers)).summary, 'parent_off');
  const r = await post(fam.dev.headers, [day(today())]);
  assert.equal(r.status, 403); assert.equal((await r.json()).sharing, 'parent_off');
  assert.equal(daily(fam.dev.id).length, 0);
  assert.equal(one(h.env, 'SELECT summary_sent_at FROM family_devices WHERE id = ?', fam.dev.id).summary_sent_at, null);
  assert.deepEqual(await (await childSwitch(fam.dev.headers, { on: false })).json(), { sharing: 'both_off' });
  assert.deepEqual(await (await childSwitch(fam.dev.headers, { on: true })).json(), { sharing: 'parent_off' });
  assert.equal((await post(fam.dev.headers, [day(today())])).status, 403);
  assert.deepEqual(await (await parentSwitch(fam, fam.dev.id, true)).json(), { sharing: 'on' });
  assert.equal((await post(fam.dev.headers, [day(today())])).status, 200);
  // another account's device is not found; a bad body is refused
  const other = await family('other@example.test');
  assert.equal((await parentSwitch(fam, other.dev.id, false)).status, 404);
  assert.equal((await h.call('POST', `/api/family/devices/${fam.dev.id}/sharing`, { headers: fam.parent, body: { on: 1 } })).status, 400);
  // the audit names the switch and who, and nothing personal
  const audit = rows(h.env, "SELECT actor, action, target, detail FROM audit_log WHERE action LIKE 'summary.%' ORDER BY id");
  assert.deepEqual(audit.map((x) => x.action), ['summary.parent_off', 'summary.child_off', 'summary.child_on', 'summary.parent_on']);
  assert.deepEqual(audit.map((x) => x.actor.split(':')[0]), ['account', 'device', 'device', 'account']);
  assert.doesNotMatch(JSON.stringify(audit), /@|הטאבלט/);
});

test('7. the parent reads only their own devices, 7 to 90 days, as the app\'s DaySummary, also after the plan ended', async () => {
  h = await setup();
  const fam = await family();
  const other = await family('other@example.test', { label: 'הטלפון' });
  const sent = [day(ago(2), { ex: { d: shiftDay(today(), 3), n: 2, of: 4 } }), day(today())];
  await post(fam.dev.headers, sent);
  await post(other.dev.headers, [day(today(), { m: 99 })]);
  const raw = (d, m) => h.env.DB.raw.prepare(`INSERT INTO family_daily (device_id, day, minutes, updated_at) VALUES (?, ?, ?, 'x')`).run(fam.dev.id, d, m);
  raw(ago(10), 1); raw(ago(60), 2); raw(ago(89), 3);
  const get = async (q = '') => (await h.call('GET', `/api/family/summary${q}`, { headers: fam.parent })).json();
  const all = await get();
  assert.equal(all.retentionDays, REPORT_KEEP_DAYS);
  assert.equal(all.days, 56);
  assert.equal(all.devices.length, 1, 'never another account\'s device');
  const d = all.devices[0];
  assert.deepEqual({ id: d.id, label: d.label, sharing: d.sharing, sharingAt: d.sharingAt }, { id: fam.dev.id, label: 'הטאבלט', sharing: 'on', sharingAt: null });
  assert.ok(d.lastSync); assert.ok(d.linkedAt); assert.ok(d.lastSeen);
  assert.deepEqual(d.days.map((x) => x.d), [ago(10), ago(2), today()]);
  assert.deepEqual(d.days.slice(1), sent, 'the rows come back as the app sent them');
  // nothing of the other account: not its device's label, not its row (99 minutes), whatever the random ids hold
  assert.doesNotMatch(JSON.stringify(all), /הטלפון/);
  assert.ok(all.devices.every((x) => x.id !== other.dev.id && x.days.every((r) => r.m !== 99)));
  // days clamps to 7..90
  assert.equal((await get('?days=3')).days, 7);
  assert.deepEqual((await get('?days=3')).devices[0].days.map((x) => x.d), [ago(2), today()]);
  assert.equal((await get('?days=500')).days, 90);
  assert.deepEqual((await get('?days=500')).devices[0].days.map((x) => x.d), [ago(89), ago(60), ago(10), ago(2), today()]);
  assert.equal((await get('?days=abc')).days, 56);
  // what the server holds for the device in all, whatever the window
  assert.deepEqual(d.kept, { n: 5, from: ago(89), to: today() });
  assert.deepEqual((await get('?days=7')).devices[0].kept, { n: 5, from: ago(89), to: today() });
  // after the plan ended: still readable (and deletable), the state says why nothing new arrives
  h.env.DB.raw.prepare("UPDATE subscriptions SET status = 'ended', current_period_end = ? WHERE account_id = ?").run(new Date(Date.now() - 864e5).toISOString(), fam.a);
  const ended = await get();
  assert.equal(ended.devices[0].sharing, 'no_plan');
  assert.equal(ended.devices[0].days.length, 3);
  assert.equal((await h.call('GET', '/api/family/summary')).status, 401);
});

test('7b. a device whose only rows are 57 to 89 days old: no rows in the window, but kept says the server holds them, and delete history removes them', async () => {
  h = await setup();
  const fam = await family();
  await post(fam.dev.headers, [day(today())]);
  h.env.DB.raw.prepare('DELETE FROM family_daily').run();
  const raw = (d) => h.env.DB.raw.prepare(`INSERT INTO family_daily (device_id, day, minutes, updated_at) VALUES (?, ?, 5, 'x')`).run(fam.dev.id, d);
  raw(ago(60)); raw(ago(65)); raw(ago(70));
  const get = async () => (await (await h.call('GET', '/api/family/summary', { headers: fam.parent })).json()).devices[0];
  const d = await get();
  assert.deepEqual(d.days, [], 'nothing in the 8 weeks the page reads');
  assert.deepEqual(d.kept, { n: 3, from: ago(70), to: ago(60) });
  assert.ok(d.lastSync, 'the device has sent before');
  const del = await h.call('POST', `/api/family/devices/${fam.dev.id}/history/delete`, { headers: fam.parent, body: {} });
  assert.deepEqual(await del.json(), { ok: true, deleted: 3 });
  assert.deepEqual((await get()).kept, { n: 0, from: null, to: null });
});

test('8. deletion: unlink, leave and the parent\'s delete history remove the rows explicitly, with the FK cascade off', async () => {
  h = await setup();
  // the explicit delete is what is proved, not the cascade
  h.env.DB.raw.exec('PRAGMA foreign_keys = OFF');
  const fam = await family();
  const second = await linkDevice(h.env, fam.a, 'הטלפון');
  const third = await linkDevice(h.env, fam.a, 'המחשב');
  for (const d of [fam.dev, second, third]) assert.equal((await post(d.headers, [day(ago(1)), day(today())])).status, 200);
  // the parent deletes one device's history: rows gone, device kept
  const del = await h.call('POST', `/api/family/devices/${fam.dev.id}/history/delete`, { headers: fam.parent, body: {} });
  assert.deepEqual(await del.json(), { ok: true, deleted: 2 });
  assert.equal(daily(fam.dev.id).length, 0);
  assert.ok(one(h.env, 'SELECT id FROM family_devices WHERE id = ?', fam.dev.id), 'the device stays linked');
  assert.ok(one(h.env, "SELECT * FROM audit_log WHERE action = 'summary.delete'"));
  // the parent unlinks a device
  assert.equal((await h.call('POST', `/api/family/devices/${second.id}/unlink`, { headers: fam.parent, body: {} })).status, 200);
  assert.equal(daily(second.id).length, 0, 'unlink');
  // a device leaves by itself
  assert.equal((await h.call('POST', '/api/family/devices/leave', { headers: third.headers, body: {} })).status, 200);
  assert.equal(daily(third.id).length, 0, 'leave');
  assert.equal(rows(h.env, 'SELECT * FROM family_daily').length, 0);
  // another account cannot delete this account's history
  const other = await family('other@example.test');
  assert.equal((await h.call('POST', `/api/family/devices/${fam.dev.id}/history/delete`, { headers: other.parent, body: {} })).status, 404);
});

test('9. the night keeps exactly 90 days, and sweeps the rows of devices that are gone', async () => {
  h = await setup();
  const fam = await family();
  const now = new Date('2026-11-11T01:10:00Z'); // 03:10 in Jerusalem
  const t = dayOf(now);
  const ins = (dev, d) => h.env.DB.raw.prepare(`INSERT INTO family_daily (device_id, day, updated_at) VALUES (?, ?, 'x')`).run(dev, d);
  ins(fam.dev.id, shiftDay(t, -90)); ins(fam.dev.id, shiftDay(t, -89)); ins(fam.dev.id, t);
  // a device unused for a year (the family purge deletes it) and a row whose device is already gone, with the FK off
  h.env.DB.raw.exec('PRAGMA foreign_keys = OFF');
  const stale = await linkDevice(h.env, fam.a, 'ישן');
  h.env.DB.raw.prepare('UPDATE family_devices SET last_seen = ? WHERE id = ?').run(shiftDay(t, -400), stale.id);
  ins(stale.id, shiftDay(t, -1));
  ins('0000000000000000', shiftDay(t, -1));
  await purge(h.env, now);
  assert.deepEqual(daily(fam.dev.id).map((x) => x.day), [shiftDay(t, -89), t]);
  assert.ok(!one(h.env, 'SELECT id FROM family_devices WHERE id = ?', stale.id), 'the stale device was purged');
  assert.equal(rows(h.env, 'SELECT * FROM family_daily WHERE device_id != ?', fam.dev.id).length, 0, 'and its rows, and the orphan');
  // the cut moves with the clock
  await purge(h.env, new Date(now.getTime() + 864e5));
  assert.deepEqual(daily(fam.dev.id).map((x) => x.day), [t]);
});

test('10. the status shows the summary\'s state for each switch, the plan and the paywall', async () => {
  h = await setup();
  const fam = await family();
  assert.deepEqual(await status(fam.dev.headers), { label: 'הטאבלט', summary: 'on' });
  await childSwitch(fam.dev.headers, { on: false });
  assert.equal((await status(fam.dev.headers)).summary, 'child_off');
  await parentSwitch(fam, fam.dev.id, false);
  assert.equal((await status(fam.dev.headers)).summary, 'both_off');
  await childSwitch(fam.dev.headers, { on: true });
  assert.equal((await status(fam.dev.headers)).summary, 'parent_off');
  h.env.PARENT_REPORT = 'off';
  assert.equal((await status(fam.dev.headers)).summary, 'off');
  // a phone with no family device has no linked at all
  assert.equal(await status({}), null);
  h.done();
  // with the paywall off there is no family plan, so the report is off; the device still shows as linked
  h = await setup({ AI_PAYWALL: 'off' });
  const off = await family('off@example.test');
  const s = await (await h.call('GET', '/api/ai/status', { headers: off.dev.headers })).json();
  assert.equal(s.paywall, false);
  assert.deepEqual(s.linked, { label: 'הטאבלט', summary: 'off' });
  assert.equal(Object.hasOwn(await (await h.call('GET', '/api/ai/status')).json(), 'linked'), false);
  assert.equal((await post(off.dev.headers, [day(today())])).status, 503);
});

test('11. PARENT_REPORT "off": the device cannot store or turn sharing on; stopping, reading and deleting still work', async () => {
  h = await setup({ PARENT_REPORT: 'off' });
  const fam = await family();
  h.env.DB.raw.prepare(`INSERT INTO family_daily (device_id, day, updated_at) VALUES (?, ?, 'x')`).run(fam.dev.id, ago(3));
  const r = await post(fam.dev.headers, [day(today())]);
  assert.equal(r.status, 503); assert.equal((await r.json()).error, 'report_off');
  assert.equal((await childSwitch(fam.dev.headers, { on: true })).status, 503);
  assert.equal((await status(fam.dev.headers)).summary, 'off');
  const plans = await (await h.call('GET', '/api/billing/plans')).json();
  assert.equal(plans.report, false);
  const got = await (await h.call('GET', '/api/family/summary', { headers: fam.parent })).json();
  assert.equal(got.devices[0].sharing, 'off'); assert.equal(got.devices[0].days.length, 1, 'kept rows stay readable');
  const stop = await childSwitch(fam.dev.headers, { on: false, forget: true });
  assert.equal(stop.status, 200); assert.deepEqual(await stop.json(), { sharing: 'off' });
  assert.equal(daily(fam.dev.id).length, 0, 'and the child can still stop and delete');
  h.done();
  h = await setup();
  assert.equal((await (await h.call('GET', '/api/billing/plans')).json()).report, true, 'on by default with the paywall on');
});

test('12. at most 150 posts a day per device, also when 151 arrive at once, and 3000 per network', async () => {
  h = await setup();
  const fam = await family();
  const results = await Promise.all(Array.from({ length: 151 }, (_, i) => post(fam.dev.headers, [day(today(), { m: i % 600 })])));
  const codes = results.map((r) => r.status);
  assert.equal(codes.filter((c) => c === 200).length, 150);
  assert.equal(codes.filter((c) => c === 429).length, 1);
  assert.equal(countOf(h.env, `sum:d:${fam.dev.id}`), 150);
  const after = await post(fam.dev.headers, [day(today())]);
  assert.equal(after.status, 429); assert.equal((await after.json()).error, 'slow_down');
  // the network's ceiling, for another device
  const other = await family('net@example.test');
  await setCount(h.env, `sum:n:${await netOf(h.env)}`, 3000);
  assert.equal((await post(other.dev.headers, [day(today())])).status, 429);
  assert.equal((await post(other.dev.headers, [day(today())], { ip: '198.51.100.9' })).status, 200, 'another network');
});

test('13. what is stored is ASCII codes and counts: no Hebrew, no label, no name, no address', async () => {
  h = await setup();
  const fam = await family('privacy@example.test', { label: 'הטאבלט של נועה' });
  await post(fam.dev.headers, [
    day(ago(3), { sk: ['angles:5', 'expr:2', 'eq:1'], ma: ['eq:1'], fx: [['eq:1', 'move-no-flip', 'o'], ['angles:5', 'sum-180', 'd']], ex: { d: shiftDay(today(), 9), n: 1, of: 5 } }),
    day(ago(1), { m: 0, q: 0, sk: [], ma: [], fx: [] }),
    day(today()),
  ]);
  // a summary with Hebrew or a name in it never gets in
  for (const bad of [{ ...day(today()), label: 'נועה' }, day(today(), { sk: ['שבר:1'] }), day(today(), { fx: [['signed:1', 'privacy@example.test', 'o']] })]) {
    assert.equal((await post(fam.dev.headers, [bad])).status, 400);
  }
  const stored = rows(h.env, 'SELECT * FROM family_daily');
  assert.equal(stored.length, 3);
  for (const r of stored) {
    for (const [col, v] of Object.entries(r)) {
      if (typeof v !== 'string') continue;
      assert.match(v, /^[\x20-\x7e]*$/, `${col} is ASCII`);
      assert.doesNotMatch(v, /@/, col);
    }
  }
});

// ---------------------------------------------------------------- "הסיכום עוזר לכם?" (PARENTS-5)
const feedback = (fam, useful, extra = {}) => h.call('POST', '/api/report/feedback', { headers: fam.parent, body: { useful, ...extra } });

test('F1. feedback: a yes or a no adds one to the month\'s count, with no account in it; one answer a week per account', async () => {
  h = await setup();
  const one1 = await family('one@example.test');
  const two = await family('two@example.test');
  const three = await family('three@example.test', { plan: false });
  assert.equal((await feedback(one1, true)).status, 200);
  assert.equal((await feedback(two, false)).status, 200);
  assert.equal((await feedback(three, true)).status, 200, 'a parent whose plan ended may still answer');
  const month = monthOf(new Date());
  assert.equal(countOf(h.env, FEEDBACK_KEYS.yes), 2);
  assert.equal(countOf(h.env, FEEDBACK_KEYS.no), 1);
  assert.deepEqual(rows(h.env, "SELECT DISTINCT day FROM ai_usage WHERE who LIKE 'fb:report:%'").map((r) => r.day), [month], 'monthly keys');
  assert.deepEqual(await feedbackCounts(h.env), { yes: 2, no: 1 });
  // the aggregate keys hold no account: only the weekly key names one, on the week's Sunday
  const weekly = rows(h.env, "SELECT who, day, count FROM ai_usage WHERE who LIKE 'fb:a:%' ORDER BY who");
  assert.equal(weekly.length, 3);
  for (const w of weekly) { assert.equal(w.day, weekStart(dayOf())); assert.equal(w.count, 1); }
  // a second answer the same week: 429, and nothing counted
  const again = await feedback(one1, false);
  assert.equal(again.status, 429);
  assert.equal((await again.json()).error, 'already_answered');
  assert.deepEqual(await feedbackCounts(h.env), { yes: 2, no: 1 });
  // next week: one more answer
  const nextWeek = shiftDay(weekStart(dayOf()), 7);
  h.env.DB.raw.prepare('UPDATE ai_usage SET day = ? WHERE who LIKE ?').run(shiftDay(weekStart(dayOf()), -7), 'fb:a:%');
  assert.equal((await feedback(one1, false)).status, 200, `a new week (${nextWeek}) takes a new answer`);
  assert.deepEqual(await feedbackCounts(h.env), { yes: 2, no: 2 });
});

test('F2. feedback: only a signed-in parent, only { useful: boolean }, and not while the report is off', async () => {
  h = await setup();
  const fam = await family();
  assert.equal((await h.call('POST', '/api/report/feedback', { body: { useful: true } })).status, 401);
  assert.equal((await h.call('POST', '/api/report/feedback', { headers: fam.dev.headers, body: { useful: true } })).status, 401, 'not the child\'s device');
  for (const body of [{}, { useful: 'yes' }, { useful: 1 }, { useful: true, text: 'great' }]) {
    const r = await h.call('POST', '/api/report/feedback', { headers: fam.parent, body });
    assert.equal(r.status, 400, JSON.stringify(body));
    assert.equal((await r.json()).error, 'bad_feedback');
  }
  assert.deepEqual(await feedbackCounts(h.env), { yes: 0, no: 0 });
  assert.equal(rows(h.env, "SELECT * FROM ai_usage WHERE who LIKE 'fb:%'").length, 0, 'a refused answer counts nothing');
  h.done();
  h = await setup({ PARENT_REPORT: 'off' });
  const off = await family();
  const r = await h.call('POST', '/api/report/feedback', { headers: off.parent, body: { useful: true } });
  assert.equal(r.status, 503);
  assert.equal((await r.json()).error, 'report_off');
});

test('F3. the owner\'s daily summary has the month\'s answers: "משוב על הסיכום החודש: כן 2 · לא ממש 1"', async () => {
  h = await setup({ OWNER_DAILY_SUMMARY: 'true' });
  const night = new Date(jerusalemMidnight(dayOf()).ms + 3 * 3600_000 + 10 * 60_000);
  assert.ok(hourOf(night).endsWith('T03'));
  const lastMonth = monthOf(new Date(night.getTime() - 864e5));
  h.env.DB.raw.prepare("INSERT INTO ai_usage (who, day, count) VALUES (?1, ?3, 2), (?2, ?3, 1)").run(FEEDBACK_KEYS.yes, FEEDBACK_KEYS.no, lastMonth);
  await run(h.env, { now: night });
  const mail = h.net.log.email.find((m) => m.subject.startsWith('[מדרגות] סיכום יומי'));
  assert.ok(mail, 'sent');
  assert.match(mail.text, /משוב על הסיכום החודש: כן 2 · לא ממש 1/);
  // with the report off the line is left out
  h.done();
  h = await setup({ OWNER_DAILY_SUMMARY: 'true', PARENT_REPORT: 'off' });
  await run(h.env, { now: night });
  const quiet = h.net.log.email.find((m) => m.subject.startsWith('[מדרגות] סיכום יומי'));
  assert.ok(quiet, 'sent');
  assert.doesNotMatch(quiet.text, /משוב על הסיכום/);
});


// ---------------------------------------------------------------- the Sunday email (PARENTS-7, PARENTS-6 states 10-11)
// The clock: the coming Sunday in Jerusalem (whatever today is), so the plans written with the real clock are live then.
const SUN = (() => { const t = today(); const dow = new Date(`${t}T12:00:00Z`).getUTCDay(); return shiftDay(t, 7 - dow); })();
const at = (day, hh, mm = 7) => new Date(jerusalemMidnight(day).ms + hh * 3600_000 + mm * 60_000);
const sunday = at(SUN, 7);
const START = shiftDay(SUN, -7); const END = shiftDay(SUN, -1);
const dm = (d) => { const [, m, x] = d.split('-').map(Number); return `${x}.${m}`; };
const OLD = '2026-01-01T00:00:00.000Z';
/** A stored day row, written straight to the table (the week is the coming one, outside the post route's window). */
const putDay = (deviceId, d, over = {}) => {
  const x = day(d, over);
  h.env.DB.raw.prepare(`INSERT OR REPLACE INTO family_daily (device_id, day, minutes, questions, lessons, stages, reviews, streak, worked, mastered, fixes, exam, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'x')`).run(deviceId, x.d, x.m, x.q, x.ls, x.st, x.rv, x.sr, JSON.stringify(x.sk), JSON.stringify(x.ma), JSON.stringify(x.fx), x.ex ? JSON.stringify(x.ex) : null);
};
const emailSwitch = (fam, on) => h.call('POST', '/api/account/report-email', { headers: fam.parent, body: { on } });
/** A family that asked for the Sunday email, its device linked before the week (or `since`). */
async function weeklyFamily(email = 'parent@example.test', opts = {}) {
  const fam = await family(email, opts);
  if (opts.optIn !== false) assert.equal((await emailSwitch(fam, true)).status, 200);
  h.env.DB.raw.prepare('UPDATE accounts SET report_email_at = ? WHERE id = ? AND report_email_at IS NOT NULL').run(opts.since || OLD, fam.a);
  h.env.DB.raw.prepare('UPDATE family_devices SET created_at = ? WHERE id = ?').run(opts.since || OLD, fam.dev.id);
  return fam;
}
const weeklyRows = () => rows(h.env, "SELECT ref, kind, to_account, params, sent_at, tries FROM notices WHERE kind LIKE 'weekly:%' ORDER BY ref");
const batches = () => h.net.log.email.filter((m) => Array.isArray(m));
const sentWeekly = () => batches().flat();
/** Every misconception title the app's content gives these ids (read from the content files, as the app shows them). */
function titlesOf(ids) {
  const dir = new URL('../../web/src/learn/content/', import.meta.url);
  const out = new Map();
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.ts'))) {
    const src = readFileSync(new URL(f, dir), 'utf8');
    for (const m of src.matchAll(/id: '([a-z0-9-]+)', title: '((?:[^'\\]|\\.)+)'/g)) {
      if (ids.includes(m[1])) out.set(m[1], [...(out.get(m[1]) || []), m[2].replace(/\\\\/g, '\\')]);
    }
  }
  return out;
}

test('W1. the email switch: on and off, in the overview and the export, audited; off by default; on needs the report', async () => {
  h = await setup();
  const fam = await family();
  const ov = async () => (await (await h.call('GET', '/api/account', { headers: fam.parent })).json()).reportEmail;
  assert.equal(await ov(), false, 'off by default');
  const on = await emailSwitch(fam, true);
  assert.equal(on.status, 200); assert.deepEqual(await on.json(), { reportEmail: true });
  assert.equal(await ov(), true);
  const first = one(h.env, 'SELECT report_email_at FROM accounts WHERE id = ?', fam.a).report_email_at;
  assert.ok(first);
  await emailSwitch(fam, true);
  assert.equal(one(h.env, 'SELECT report_email_at FROM accounts WHERE id = ?', fam.a).report_email_at, first, 'on again keeps the date');
  const exported = await (await h.call('GET', '/api/account/export', { headers: fam.parent })).json();
  assert.equal(exported.account.report_email_at, first);
  assert.deepEqual(await (await emailSwitch(fam, false)).json(), { reportEmail: false });
  assert.equal(await ov(), false);
  assert.equal(one(h.env, 'SELECT report_email_at FROM accounts WHERE id = ?', fam.a).report_email_at, null);
  const audit = rows(h.env, "SELECT actor, action, target, detail FROM audit_log WHERE action LIKE 'report.email.%' ORDER BY id");
  assert.deepEqual(audit.map((x) => x.action), ['report.email.on', 'report.email.on', 'report.email.off']);
  assert.ok(audit.every((x) => x.actor === `account:${fam.a}`));
  assert.doesNotMatch(JSON.stringify(audit), /@/);
  for (const b of [{}, { on: 'yes' }, { on: true, email: 'x@example.test' }]) {
    const r = await h.call('POST', '/api/account/report-email', { headers: fam.parent, body: b });
    assert.equal(r.status, 400, JSON.stringify(b)); assert.equal((await r.json()).error, 'bad_report_email');
  }
  assert.equal((await h.call('POST', '/api/account/report-email', { headers: fam.dev.headers, body: { on: true } })).status, 401, 'not the child\'s device');
  h.env.PARENT_REPORT = 'off';
  assert.equal((await emailSwitch(fam, true)).status, 503);
  assert.equal((await emailSwitch(fam, false)).status, 200, 'off is always possible');
});

test('W2. Sunday 07:07 queues one notice per family that asked, has a plan and a device; 06:07 and Saturday queue nothing; a second run adds nothing', async () => {
  h = await setup();
  const yes = await weeklyFamily('yes@example.test');
  await weeklyFamily('noplan@example.test', { plan: false });
  const nodev = await signIn(h, 'nodevice@example.test');
  const nd = accountId(h.env, 'nodevice@example.test');
  insertSub(h.env, { kind: 'family', account_id: nd });
  assert.equal((await h.call('POST', '/api/account/report-email', { headers: { 'X-Account-Token': nodev }, body: { on: true } })).status, 200);
  await family('notasked@example.test');
  putDay(yes.dev.id, shiftDay(START, 1));
  assert.equal(weeklyWindow(at(END, 7)), null, 'Saturday');
  assert.equal(weeklyWindow(at(SUN, 6)), null, 'Sunday 06:07');
  assert.equal(weeklyWindow(at(SUN, 21)), null, 'Sunday 21:07');
  assert.deepEqual(weeklyWindow(at(SUN, 20)), { start: START, end: END });
  await run(h.env, { now: at(END, 7) });
  await run(h.env, { now: at(SUN, 6) });
  assert.equal(weeklyRows().length, 0);
  const r = await run(h.env, { now: sunday });
  assert.equal(r.weekly.queued, 1);
  const q = weeklyRows();
  assert.equal(q.length, 1);
  assert.deepEqual({ ref: q[0].ref, kind: q[0].kind, to: q[0].to_account, params: JSON.parse(q[0].params) },
    { ref: yes.a, kind: `weekly:${START}`, to: yes.a, params: { start: START, end: END } });
  assert.ok(q[0].sent_at, 'sent in the same run, after the other notices');
  assert.equal(r.weeklySend.sent, 1);
  const again = await run(h.env, { now: at(SUN, 8) });
  assert.equal(again.weekly.queued, 0, 'INSERT OR IGNORE');
  assert.equal(weeklyRows().length, 1);
  assert.equal(sentWeekly().length, 1, 'one email, once');
});

test('W3. the email: dates, each device, stair names in Hebrew, no mistake names and no price, the RFC 8058 headers', async () => {
  h = await setup({ BUSINESS_NAME: 'מדרגות בע״מ (לדוגמה)', BUSINESS_ID: '000000000' });
  const fam = await weeklyFamily('render@example.test');
  const phone = await linkDevice(h.env, fam.a, 'הטלפון');
  h.env.DB.raw.prepare('UPDATE family_devices SET created_at = ? WHERE id = ?').run(OLD, phone.id);
  const off = await linkDevice(h.env, fam.a, 'המחשב');
  h.env.DB.raw.prepare('UPDATE family_devices SET created_at = ?, share_child = 0 WHERE id = ?').run('2026-02-01T00:00:00.000Z', off.id);
  const fixes = [['signed:1', 'minus-minus', 'o'], ['signed:3', 'sign', 'd'], ['eq:1', 'move-no-flip', 'd']];
  putDay(fam.dev.id, START, { m: 12, q: 16, ls: 2, st: 0, sk: ['signed:1'], ma: [], fx: [], sr: 1 });
  putDay(fam.dev.id, shiftDay(START, 2), { m: 20, q: 24, ls: 1, st: 1, sk: ['signed:3', 'eq:1', 'coord:2', 'angles:1', 'expr:1'], ma: ['signed:3'], fx: fixes.slice(1), sr: 2 });
  // Friday: the streak still stands at the end of the week (Shabbat does not break it; a missed Friday would, as W3b shows)
  putDay(fam.dev.id, shiftDay(START, 5), { m: 9, q: 10, ls: 1, st: 0, sk: ['eq:1'], ma: ['eq:1'], fx: fixes.slice(0, 1), sr: 3 });
  putDay(fam.dev.id, shiftDay(START, -3), { sk: ['line:1'], ma: ['line:1'] }); // the week before: not in this email
  await weeklyQueue(h.env, sunday);
  assert.deepEqual(await flushWeekly(h.env, { now: sunday }), { sent: 1, skipped: 0, failed: 0 });
  const [m] = sentWeekly();
  assert.equal(m.subject, `סיכום שבועי ממדרגות · ${dm(START)}–${dm(END)}`);
  assert.deepEqual(m.to, ['render@example.test']);
  for (const line of [
    `זה הסיכום של השבוע ${dm(START)}–${dm(END)}.`,
    'הטאבלט\nימי תרגול: 3 · זמן תרגול: כ־41 דקות · שאלות: 50',
    `חדש בשליטה: ${stairName('eq:1')}, ${stairName('signed:3')}`,
    // newest first, as the page lists them (the days in order, each day's list reversed with them)
    `תורגלו: ${stairName('expr:1')}, ${stairName('angles:1')}, ${stairName('coord:2')}, ${stairName('eq:1')} ועוד שתי מדרגות`,
    'טעויות שחוזרות: טעות אחת בתיקון, שתי טעויות תוקנו השבוע',
    'רצף: 3 ימים (שבת לא שוברת רצף)',
    'הטלפון: השבוע לא היה תרגול.',
    'המחשב: הסיכום מהמכשיר הזה כבוי.',
    `רעיון לשיחה: בקשו שיסבירו לכם דוגמה אחת מ"${stairName('expr:1')}".`,
    'הפירוט המלא בעמוד ההורים: https://madregot.example.test/parents',
    'מדרגות בע״מ (לדוגמה) · 000000000 · hello@example.test',
  ]) assert.ok(m.text.includes(line), `text has: ${line}\n---\n${m.text}`);
  assert.doesNotMatch(m.text, new RegExp(stairName('line:1')), 'only the week');
  // no mistake's name, as the content gives it (with or without its maths)
  const titles = titlesOf(fixes.map((f) => f[1]));
  assert.equal(titles.size, 3, 'the fixture names real mistakes');
  for (const list of titles.values()) {
    for (const t of list) for (const part of [m.text, m.html]) { assert.ok(!part.includes(t), t); assert.ok(!part.includes(texToPlain(t, { isolate: false })), t); }
  }
  for (const id of ['minus-minus', 'move-no-flip']) assert.ok(!m.text.includes(id) && !m.html.includes(id), id);
  for (const part of [m.text, m.html, m.subject]) { assert.doesNotMatch(part, /₪|מחיר|מנוי|הנחה|לשדרג/); }
  // the unsubscribe link, in the text, the HTML and the headers
  const url = `https://madregot.example.test/api/report/unsubscribe?a=${fam.a}&t=${await unsubToken(h.env, fam.a)}`;
  assert.ok(m.text.includes(url));
  assert.ok(m.html.includes(url.replace('&', '&amp;')));
  assert.equal(m.headers['List-Unsubscribe'], `<${url}>`);
  assert.match(m.headers['List-Unsubscribe'], /^<https:\/\//);
  assert.equal(m.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
  assert.match(m.html, /^<div dir="rtl"/);
  assert.equal(m.reply_to, 'hello@example.test');
});

test('W4. batch and starvation: 50 to a call, at most 100 a run in 3 SELECTs, a failed call counts a try, and a cancellation never waits', async () => {
  let failBatch = true;
  h = await setup({}, { resend: (m) => (Array.isArray(m) && failBatch ? new Response('down', { status: 500 })
    : new Response(JSON.stringify({ id: 'em' }), { status: 200, headers: { 'Content-Type': 'application/json' } })) });
  const a = await weeklyFamily('one@example.test');
  const b = await weeklyFamily('two@example.test');
  for (const f of [a, b]) putDay(f.dev.id, shiftDay(START, 1));
  await weeklyQueue(h.env, sunday);
  assert.deepEqual(await flushWeekly(h.env, { now: sunday }), { sent: 0, skipped: 0, failed: 2 });
  assert.equal(batches().length, 1); assert.equal(batches()[0].length, 2, 'one call, an array of 2');
  assert.deepEqual(weeklyRows().map((r) => [r.tries, r.sent_at]), [[1, null], [1, null]]);
  failBatch = false;
  assert.deepEqual(await flushWeekly(h.env, { now: sunday }), { sent: 2, skipped: 0, failed: 0 });
  assert.equal(batches().length, 2);
  assert.ok(weeklyRows().every((r) => r.sent_at));
  h.done();

  // 120 families, then a cancellation: the cancellation goes first, the Sunday emails 100 a run
  h = await setup();
  const subs = [];
  for (let i = 0; i < 120; i++) {
    const id = `1${'0'.repeat(12)}${i.toString(16).padStart(3, '0')}`;
    h.env.DB.raw.prepare('INSERT INTO accounts (id, email, created_at, report_email_at) VALUES (?, ?, ?, ?)').run(id, `p${i}@example.test`, OLD, OLD);
    subs.push(insertSub(h.env, { kind: 'family', account_id: id }));
    const dev = await linkDevice(h.env, id, `מכשיר ${i}`);
    h.env.DB.raw.prepare('UPDATE family_devices SET created_at = ? WHERE id = ?').run(OLD, dev.id);
    putDay(dev.id, shiftDay(START, 2));
  }
  assert.equal((await weeklyQueue(h.env, sunday)).queued, 120);
  h.env.DB.raw.prepare("INSERT INTO notices (ref, kind, to_account, params, created_at) VALUES (?, 'canceled', ?, ?, ?)")
    .run(subs[0].id, subs[0].account_id, JSON.stringify({ requestedAt: new Date().toISOString(), endsAt: new Date().toISOString(), reference: 'C-TEST' }), new Date(sunday.getTime() + 60_000).toISOString());
  await flushNotices(h.env);
  const single = h.net.log.email.filter((x) => !Array.isArray(x));
  assert.equal(single.length, 1); assert.match(single[0].subject, /אישור ביטול המנוי/);
  assert.ok(weeklyRows().every((r) => r.sent_at === null && r.tries === 0), 'flushNotices touches no Sunday email');
  // count the SELECTs of one flush on the test database
  const prepare = h.env.DB.prepare; let selects = 0;
  h.env.DB.prepare = (sql) => { if (/^\s*SELECT\b/i.test(sql)) selects++; return prepare(sql); };
  const first = await flushWeekly(h.env, { now: sunday });
  h.env.DB.prepare = prepare;
  assert.deepEqual(first, { sent: 100, skipped: 0, failed: 0 });
  assert.ok(selects <= 3, `${selects} SELECTs`);
  assert.deepEqual(batches().map((x) => x.length), [50, 50]);
  assert.ok(batches().flat().every((m) => m.headers['List-Unsubscribe-Post'] === 'List-Unsubscribe=One-Click' && m.to.length === 1));
  assert.equal(new Set(batches().flat().map((m) => m.to[0])).size, 100, 'each family its own email');
  assert.deepEqual(await flushWeekly(h.env, { now: sunday }), { sent: 20, skipped: 0, failed: 0 });
  assert.equal(weeklyRows().filter((r) => r.sent_at).length, 120);
});

test('W5. an empty week is emailed once with its own words; a second empty week in a row is not, until practice returns', async () => {
  h = await setup();
  // the week before had practice: this empty week is the first, and it is sent
  const fam = await weeklyFamily('empty@example.test');
  putDay(fam.dev.id, shiftDay(START, -4));
  // both weeks empty, asked long ago, device linked long ago: last Sunday's email was the empty one, so nothing now
  const quiet = await weeklyFamily('quiet@example.test');
  // both weeks empty, but the parent asked only this week: their first email is sent
  const fresh = await weeklyFamily('fresh@example.test', { since: new Date(jerusalemMidnight(START).ms + 864e5).toISOString() });
  // both weeks empty, an empty row (no practice) does not count as practice
  const zero = await weeklyFamily('zero@example.test');
  putDay(zero.dev.id, shiftDay(START, -2), { m: 0, q: 0, ls: 0, st: 0, sk: [], ma: [], fx: [] });
  putDay(zero.dev.id, shiftDay(START, 2), { m: 0, q: 0, ls: 0, st: 0, sk: [], ma: [], fx: [] });
  await weeklyQueue(h.env, sunday);
  assert.deepEqual(await flushWeekly(h.env, { now: sunday }), { sent: 2, skipped: 2, failed: 0 });
  const byTo = Object.fromEntries(sentWeekly().map((m) => [m.to[0], m]));
  assert.deepEqual(Object.keys(byTo).sort(), ['empty@example.test', 'fresh@example.test']);
  for (const m of Object.values(byTo)) {
    assert.ok(m.text.includes('השבוע לא היה תרגול במכשיר הטאבלט. זה קורה, ואפשר לחזור מתי שרוצים.'), m.text);
    assert.ok(m.text.includes('אם גם בשבוע הבא לא יהיה תרגול, לא נשלח מייל עד שהתרגול יחזור.'));
    assert.doesNotMatch(m.text, /רעיון לשיחה|ימי תרגול/);
  }
  const done = Object.fromEntries(weeklyRows().map((r) => [r.ref, r]));
  for (const f of [quiet, zero]) { assert.equal(done[f.a].sent_at, null); assert.equal(done[f.a].tries, MAX_NOTICE_TRIES, 'closed, never retried'); }
  assert.ok(done[fresh.a].sent_at);
  // pure: the rule needs every device empty in both weeks
  const dev = (id, created_at = OLD) => ({ id, label: id, created_at, share_child: 1, share_parent: 1 });
  const row = (id, d) => ({ device_id: id, day: d, minutes: 5, questions: 3, lessons: 1, stages: 0, reviews: 0, streak: 1, worked: '[]', mastered: '[]', fixes: '[]', exam: null });
  const acc = { reportEmailAt: OLD, live: true };
  assert.equal(weeklyParams(acc, [dev('x'), dev('y')], [], { start: START, end: END }), null);
  assert.ok(weeklyParams(acc, [dev('x'), dev('y')], [row('y', shiftDay(START, -1))], { start: START, end: END }), 'one device practised the week before');
  assert.ok(weeklyParams(acc, [dev('x', new Date(jerusalemMidnight(START).ms + 1000).toISOString())], [], { start: START, end: END }), 'a device linked this week');
});

test('W6. opted out, unlinked or plan ended between the queue and the send: nothing is sent and the notice is closed', async () => {
  h = await setup();
  const out = await weeklyFamily('out@example.test');
  const link = await weeklyFamily('link@example.test');
  const ended = await weeklyFamily('ended@example.test');
  const unsub = await weeklyFamily('unsub@example.test');
  const stay = await weeklyFamily('stay@example.test');
  for (const f of [out, link, ended, unsub, stay]) putDay(f.dev.id, shiftDay(START, 1));
  await weeklyQueue(h.env, sunday);
  assert.equal(weeklyRows().length, 5);
  await emailSwitch(out, false);
  await h.call('POST', `/api/family/devices/${link.dev.id}/unlink`, { headers: link.parent, body: {} });
  h.env.DB.raw.prepare("UPDATE subscriptions SET status = 'ended', current_period_end = ? WHERE account_id = ?").run(new Date(Date.now() - 864e5).toISOString(), ended.a);
  const res = await h.call('POST', `/api/report/unsubscribe?a=${unsub.a}&t=${await unsubToken(h.env, unsub.a)}`, { body: 'List-Unsubscribe=One-Click', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  assert.equal(res.status, 200);
  assert.deepEqual(await flushWeekly(h.env, { now: sunday }), { sent: 1, skipped: 4, failed: 0 });
  assert.deepEqual(sentWeekly().map((m) => m.to[0]), ['stay@example.test']);
  for (const r of weeklyRows()) if (r.ref !== stay.a) assert.equal(r.tries, MAX_NOTICE_TRIES);
  // a notice of a week that is over is closed, not sent late
  h.env.DB.raw.prepare("INSERT INTO notices (ref, kind, to_account, params, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(stay.a, `weekly:${shiftDay(START, -7)}`, stay.a, JSON.stringify({ start: shiftDay(START, -7), end: shiftDay(END, -7) }), OLD);
  assert.deepEqual(await flushWeekly(h.env, { now: sunday }), { sent: 0, skipped: 1, failed: 0 });
});

test('W7. unsubscribe: the page changes nothing, the POST does (multipart, urlencoded, none), never a redirect; a bad token is 400', async () => {
  h = await setup();
  const fam = await weeklyFamily('leave@example.test');
  const tok = await unsubToken(h.env, fam.a);
  assert.match(tok, /^[a-f0-9]{32}$/);
  const path = `/api/report/unsubscribe?a=${fam.a}&t=${tok}`;
  const flag = () => one(h.env, 'SELECT report_email_at FROM accounts WHERE id = ?', fam.a).report_email_at;
  const page = await h.call('GET', path, { headers: { 'Content-Type': '' } });
  assert.equal(page.status, 200);
  assert.match(page.headers.get('Content-Type'), /^text\/html/);
  assert.match(page.headers.get('Content-Security-Policy'), /default-src 'none'; style-src 'unsafe-inline'; form-action 'self'/);
  assert.equal(page.headers.get('Cache-Control'), 'no-store');
  assert.equal(page.headers.get('Referrer-Policy'), 'no-referrer');
  const html = await page.text();
  assert.match(html, /<html lang="he" dir="rtl">/);
  assert.ok(html.includes(UNSUB_TEXT.askTitle) && html.includes(`<form method="post"><button type="submit">${UNSUB_TEXT.button}</button></form>`));
  assert.doesNotMatch(html, /<script|https?:\/\/(?!madregot\.example\.test)/, 'nothing from outside');
  assert.ok(flag(), 'GET leaves it on');
  const post = (p, body, type) => h.call('POST', p, { body, headers: type ? { 'Content-Type': type } : { 'Content-Type': '' } });
  const codes = [];
  // RFC 8058's own request: multipart/form-data
  const multipart = '--b0undary\r\nContent-Disposition: form-data; name="List-Unsubscribe"\r\n\r\nOne-Click\r\n--b0undary--\r\n';
  let r = await post(path, multipart, 'multipart/form-data; boundary=b0undary');
  codes.push(r.status);
  assert.equal(r.status, 200);
  const donePage = await r.text();
  assert.ok(donePage.includes(UNSUB_TEXT.doneTitle) && donePage.includes(UNSUB_TEXT.done));
  assert.doesNotMatch(donePage, /<form/);
  assert.equal(flag(), null);
  assert.ok(one(h.env, "SELECT * FROM audit_log WHERE action = 'report.email.off' AND actor = ?", `unsubscribe:${fam.a}`));
  // urlencoded, as a browser form and some mail programs send it; and with no body at all
  for (const [body, type] of [['List-Unsubscribe=One-Click', 'application/x-www-form-urlencoded'], [undefined, null], ['{}', 'application/json']]) {
    await emailSwitch(fam, true);
    r = await post(path, body, type);
    codes.push(r.status);
    assert.equal(r.status, 200, String(type)); assert.equal(flag(), null, String(type));
  }
  assert.equal(r.headers.get('Location'), null);
  // a wrong token, a short one, a bad id: 400 and nothing changes
  await emailSwitch(fam, true);
  for (const bad of [`?a=${fam.a}&t=${'0'.repeat(32)}`, `?a=${fam.a}&t=${tok.slice(0, 31)}`, `?a=${fam.a}`, `?a=XYZ&t=${tok}`, '']) {
    r = await post(`/api/report/unsubscribe${bad}`, 'List-Unsubscribe=One-Click', 'application/x-www-form-urlencoded');
    codes.push(r.status);
    assert.equal(r.status, 400, bad); const badPage = await r.text(); assert.ok(badPage.includes(UNSUB_TEXT.badTitle) && badPage.includes(UNSUB_TEXT.bad));
    assert.equal((await h.call('GET', `/api/report/unsubscribe${bad}`)).status, 400);
  }
  assert.ok(flag(), 'still on');
  // an account that does not exist, with its real token: the same 200 (no account oracle)
  const ghost = 'f'.repeat(16);
  r = await post(`/api/report/unsubscribe?a=${ghost}&t=${await unsubToken(h.env, ghost)}`, 'List-Unsubscribe=One-Click', 'application/x-www-form-urlencoded');
  codes.push(r.status);
  assert.equal(r.status, 200); assert.ok((await r.text()).includes(UNSUB_TEXT.done));
  assert.ok(codes.every((c) => c < 300 || c >= 400), `no redirect: ${codes}`);
  // a body over 4 KB is refused before anything is read into the database
  assert.equal((await post(path, 'x'.repeat(5000), 'text/plain')).status, 413);
  assert.ok(flag());
  // 200 a day from one network
  await setCount(h.env, `unsub:n:${await netOf(h.env)}`, 200);
  r = await post(path, 'List-Unsubscribe=One-Click', 'application/x-www-form-urlencoded');
  assert.equal(r.status, 429); assert.ok((await r.text()).includes(UNSUB_TEXT.busy));
  assert.ok(flag(), 'nothing changed');
});

test('W8. a deleted account: no Sunday email is queued, and a pending one goes with the account', async () => {
  h = await setup();
  const gone = await weeklyFamily('gone@example.test');
  const later = await weeklyFamily('later@example.test');
  for (const f of [gone, later]) putDay(f.dev.id, shiftDay(START, 1));
  assert.equal((await h.call('POST', '/api/account/delete', { headers: gone.parent, body: { confirm: 'DELETE' } })).status, 200);
  await weeklyQueue(h.env, sunday);
  assert.deepEqual(weeklyRows().map((r) => r.ref), [later.a]);
  assert.equal((await h.call('POST', '/api/account/delete', { headers: later.parent, body: { confirm: 'DELETE' } })).status, 200);
  assert.equal(weeklyRows().length, 0, 'the unsent notice went with the account');
  assert.deepEqual(await flushWeekly(h.env, { now: sunday }), { sent: 0, skipped: 0, failed: 0 });
  assert.equal(sentWeekly().length, 0);
});

test('W9. the email reads the shared fixture week exactly as the page does (shared/week.js)', () => {
  const fx = JSON.parse(readFileSync(new URL('../../shared/week.fixture.json', import.meta.url), 'utf8'));
  const toRow = (r) => ({ device_id: 'd1', day: r.d, minutes: r.m, questions: r.q, lessons: r.ls, stages: r.st, reviews: r.rv, streak: r.sr,
    worked: JSON.stringify(r.sk), mastered: JSON.stringify(r.ma), fixes: JSON.stringify(r.fx), exam: r.ex ? JSON.stringify(r.ex) : null });
  const end = shiftDay(fx.start, 6);
  const p = weeklyParams({ reportEmailAt: OLD, live: true }, [{ id: 'd1', label: 'הטאבלט', created_at: OLD, share_child: 1, share_parent: 1 }], fx.rows.map(toRow), { start: fx.start, end });
  const e = fx.expected;
  assert.deepEqual(weekFrom(fx.rows, fx.start, fx.today), e, 'the fixture is the one the web pins');
  assert.deepEqual(p.devices[0], {
    label: 'הטאבלט', sharing: 'on', activeDays: e.activeDays, minutes: e.minutes, questions: e.questions,
    mastered: [...e.mastered].reverse(), worked: [...e.worked].reverse(), open: e.open.length, fixed: e.fixed.length, streak: e.streak, empty: e.empty,
  });
  assert.equal(p.start, fx.start); assert.equal(p.end, end); assert.equal(p.allEmpty, false);
  // and the email it renders names nothing the parent's page would not
  const msg = renderNotice({ PUBLIC_URL: 'https://madregot.example.test' }, { kind: `weekly:${fx.start}`, params: JSON.stringify({ ...p, unsub: 'https://madregot.example.test/api/report/unsubscribe?a=x&t=y' }) });
  assert.ok(msg.text.includes(`ימי תרגול: ${e.activeDays} · זמן תרגול: כ־${e.minutes} דקות · שאלות: ${e.questions}`));
  assert.equal(renderNotice({}, { kind: `weekly:${fx.start}`, params: JSON.stringify(p) }), null, 'never without its unsubscribe link');
});

test('W3b. a streak that ended during the week is not in the email: the child would see 0, so the parent does too', () => {
  const toRow = (d, sr) => ({ device_id: 'd1', day: d, minutes: 5, questions: 8, lessons: 1, stages: 0, reviews: 0, streak: sr,
    worked: '[]', mastered: '[]', fixes: '[]', exam: JSON.stringify({ d: shiftDay(START, 3), n: 1, of: 3 }) });
  const dev = [{ id: 'd1', label: 'הטאבלט', created_at: OLD, share_child: 1, share_parent: 1 }];
  const p = weeklyParams({ reportEmailAt: OLD, live: true }, dev, [toRow(START, 4), toRow(shiftDay(START, 1), 5)], { start: START, end: END });
  assert.equal(p.devices[0].streak, 0, 'practice on Sunday and Monday only: the chain broke on Tuesday');
  const msg = renderNotice({ PUBLIC_URL: 'https://madregot.example.test' }, { kind: `weekly:${START}`, params: JSON.stringify({ ...p, unsub: 'https://madregot.example.test/u' }) });
  assert.ok(!msg.text.includes('רצף:'), msg.text);
  // up to Friday, the streak holds through Shabbat
  const q = weeklyParams({ reportEmailAt: OLD, live: true }, dev, [toRow(shiftDay(START, 4), 2), toRow(shiftDay(START, 5), 3)], { start: START, end: END });
  assert.equal(q.devices[0].streak, 3);
});

test('W10. with the report off (PARENT_REPORT "off", or the paywall off) nothing is queued and nothing is sent', async () => {
  for (const over of [{ PARENT_REPORT: 'off' }, { AI_PAYWALL: 'off' }]) {
    h = await setup();
    const fam = await weeklyFamily('off@example.test');
    putDay(fam.dev.id, shiftDay(START, 1));
    await weeklyQueue(h.env, sunday);
    assert.equal(weeklyRows().length, 1);
    Object.assign(h.env, over);
    assert.deepEqual(await weeklyQueue(h.env, at(SUN, 9)), { queued: 0 });
    h.env.DB.raw.prepare('DELETE FROM notices').run();
    assert.deepEqual(await weeklyQueue(h.env, at(SUN, 9)), { queued: 0 }, JSON.stringify(over));
    h.env.DB.raw.prepare("INSERT INTO notices (ref, kind, to_account, params, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(fam.a, `weekly:${START}`, fam.a, JSON.stringify({ start: START, end: END }), sunday.toISOString());
    assert.deepEqual(await flushWeekly(h.env, { now: sunday }), { sent: 0, skipped: 0, failed: 0 });
    await flushNotices(h.env);
    assert.equal(sentWeekly().length, 0); assert.equal(weeklyRows()[0].sent_at, null);
    h.done();
  }
  h = null;
});
